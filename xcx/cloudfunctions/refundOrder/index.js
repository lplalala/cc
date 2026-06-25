const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g26c0bcee3c74ed' });
const db = cloud.database();
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ==================== 微信支付配置 ====================
const MCH_ID = '1746314749';           // 商户号
const APP_ID = 'wx123ac09958bdab6d';   // 小程序 AppID（来自 project.config.json）

// ⚠️ API 密钥：登录 pay.weixin.qq.com → 账户中心 → API安全 → API密钥
//    如果从未设置过，就在那里设一个（32位字母数字）
const API_KEY = 'tP5qR8vX2mLf9A3bD6cG1hJ4kN7sUw0y';                     // ← 待填写！

/**
 * 退款云函数 v3.0 — 直连微信支付退款 API
 *
 * 不依赖 CloudBase 控制台的「微信支付」配置（那些在 2026 年找不到入口了）
 * 证书文件直接放本目录，API 密钥在代码里配置
 *
 * 前置准备（只需做一次）：
 *   1. 登录 https://pay.weixin.qq.com
 *   2. 账户中心 → API安全 → API密钥 → 设置/查看 32 位密钥 → 填到上面 API_KEY
 *   3. 同一页面 → API证书 → 下载 → 得到 apiclient_cert.pem 和 apiclient_key.pem
 *   4. 将两个 .pem 文件放到 cloudfunctions/refundOrder/ 目录下
 *   5. 重新部署本云函数
 */

// ==================== 工具函数 ====================

/** MD5 签名（微信支付 V2 规范） */
function md5Sign(params, key) {
  const sorted = Object.keys(params)
    .filter(k => params[k] != null && params[k] !== '')
    .sort();
  const raw = sorted.map(k => `${k}=${params[k]}`).join('&') + `&key=${key}`;
  return crypto.createHash('md5').update(raw, 'utf8').digest('hex').toUpperCase();
}

/** 随机字符串 */
function nonceStr(len) {
  len = len || 32;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let r = '';
  for (let i = 0; i < len; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}

/** JS 对象 → 微信支付 XML */
function toXML(obj) {
  let s = '<xml>';
  for (const k in obj) {
    if (obj[k] != null && obj[k] !== '') s += `<${k}><![CDATA[${obj[k]}]]></${k}>`;
  }
  return s + '</xml>';
}

/** 微信支付 XML → JS 对象 */
function fromXML(xml) {
  const r = {};
  const re = /<(\w+)><!\[CDATA\[(.*?)\]\]><\/\1>|<(\w+)>(.*?)<\/\3>/g;
  let m;
  while ((m = re.exec(xml)) !== null) r[m[1] || m[3]] = m[2] || m[4];
  return r;
}

/** HTTPS POST（带客户端证书） */
function httpsPost(url, data, cert, key) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname,
      method: 'POST',
      cert: cert,
      key: key,
      headers: { 'Content-Type': 'application/xml' }
    };
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ==================== 主函数 ====================

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { orderId, reason } = event;

  if (!orderId) return { success: false, errMsg: '缺少订单ID' };

  // ===== 校验 API 密钥是否已配置 =====
  if (!API_KEY || API_KEY.length !== 32) {
    return {
      success: false,
      errMsg: '服务端 API 密钥未配置，请联系管理员在云函数中填写 API_KEY'
    };
  }

  try {
    // ===== 1. 验证管理员 =====
    const adminRes = await db.collection('admins').where({ openid }).get();
    if (adminRes.data.length === 0) return { success: false, errMsg: '无退款权限' };

    // ===== 2. 查询订单 =====
    const orderRes = await db.collection('orders').doc(orderId).get();
    const order = orderRes.data;
    if (!order) return { success: false, errMsg: '订单不存在' };
    if (order.status === 'verified') return { success: false, errMsg: '已核销订单不可退款' };
    if (order.status === 'refunded')  return { success: false, errMsg: '订单已退款' };
    if (order.status === 'refunding') return { success: false, errMsg: '退款处理中，请勿重复操作' };
    if (order.status !== 'paid') return { success: false, errMsg: '仅已支付订单可退款' };

    // ===== 3. 读取证书 =====
    let certPem, keyPem;
    try {
      certPem = fs.readFileSync(path.join(__dirname, 'apiclient_cert.pem'));
      keyPem  = fs.readFileSync(path.join(__dirname, 'apiclient_key.pem'));
    } catch (e) {
      return {
        success: false,
        errMsg: '证书文件缺失，请将 apiclient_cert.pem 和 apiclient_key.pem 放入云函数目录后重新部署。\n下载地址：pay.weixin.qq.com → API安全 → API证书'
      };
    }

    // ===== 4. 生成退款单号 =====
    const outRefundNo = 'RF' +
      Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).substring(2, 6).toUpperCase();

    // 标记退款中
    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'refunding',
        outRefundNo,
        refundReason: reason || '门店退款',
        refundApplyTime: new Date(),
        updatedAt: new Date()
      }
    });

    // ===== 5. 构建退款请求参数 =====
    const totalFen = Math.round(order.totalAmount * 100);
    const params = {
      appid: APP_ID,
      mch_id: MCH_ID,
      nonce_str: nonceStr(),
      sign_type: 'MD5',
      out_refund_no: outRefundNo,
      total_fee: totalFen,
      refund_fee: totalFen,
      refund_desc: reason || '门店退款'
    };
    // 优先用微信交易号，没有则用商户订单号
    if (order.transactionId) {
      params.transaction_id = order.transactionId;
    } else {
      params.out_trade_no = order.orderNo;
    }
    params.sign = md5Sign(params, API_KEY);

    console.log('[refundOrder] 请求参数:', JSON.stringify({ ...params, sign: '***' }));

    // ===== 6. 调用微信支付退款 API =====
    const xmlBody = toXML(params);
    const xmlResp = await httpsPost(
      'https://api.mch.weixin.qq.com/secapi/pay/refund',
      xmlBody,
      certPem,
      keyPem
    );
    const result = fromXML(xmlResp);
    console.log('[refundOrder] 响应:', JSON.stringify(result));

    // ===== 7. 处理结果 =====
    if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
      await db.collection('orders').doc(orderId).update({
        data: {
          status: 'refunded',
          refundTime: new Date(),
          refundTransactionId: result.refund_id || '',
          updatedAt: new Date()
        }
      });
      return {
        success: true,
        msg: '退款成功，预计1-3个工作日内到账',
        refundId: result.refund_id || outRefundNo
      };
    }

    // 退款失败 → 回滚状态
    const errDetail = result.err_code_des || result.return_msg || '退款接口返回失败';
    await db.collection('orders').doc(orderId).update({
      data: { status: 'paid', refundError: errDetail, updatedAt: new Date() }
    });
    return { success: false, errMsg: errDetail };

  } catch (err) {
    console.error('[refundOrder] 异常:', err);
    try {
      await db.collection('orders').doc(orderId).update({
        data: { status: 'paid', refundError: err.message || '退款异常', updatedAt: new Date() }
      });
    } catch (e) { /* 尽力了 */ }
    return { success: false, errMsg: err.message || '退款失败' };
  }
};
