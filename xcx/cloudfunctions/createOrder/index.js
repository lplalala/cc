const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g26c0bcee3c74ed' });
const db = cloud.database();

/**
 * 创建订单 + 获取支付参数（纯云函数方案）
 * 不需外部 API Base，全部走云开发
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { items, totalAmount, remark, phone, nickName } = event;

  if (!items || !items.length || !totalAmount) {
    return { success: false, errMsg: '缺少必要参数' };
  }

  // 生成订单号
  const orderNo = Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).substring(2, 8).toUpperCase();

  // 生成 6 位核销码
  const verifyCode = generateCode(6);

  try {
    // 校验库存
    for (const item of items) {
      const product = await db.collection('products').doc(item.productId).get();
      if (!product.data || product.data.status !== 'on') {
        return { success: false, errMsg: `商品「${item.productName}」已下架` };
      }
    }

    // 创建订单 — 显式写入 _openid 确保前端可查询
    const orderData = {
      _openid: openid,         // CloudBase 查询关键字段
      openid,                  // 兼容旧查询
      orderNo,
      nickName: nickName || '',
      phone: phone || '',
      items,
      totalAmount,
      verify_code: verifyCode,
      status: 'pending_payment',
      remark: remark || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('[createOrder] 写入订单:', { orderNo, _openid: openid, status: 'pending_payment' });

    const result = await db.collection('orders').add({ data: orderData });
    const orderId = result._id;

    // 调用微信支付统一下单（仅真实支付，不保留模拟回退）
    const payResult = await cloud.cloudPay.unifiedOrder({
      body: items.map(i => i.productName).join('、'),
      outTradeNo: orderNo,
      totalFee: Math.round(totalAmount * 100), // 单位：分
      spbillCreateIp: '127.0.0.1',
      subMchId: '',  // 服务商模式下填写子商户号
      functionName: 'handlePaymentCallback',
      envId: 'cloud1-1g26c0bcee3c74ed',
      tradeType: 'JSAPI',
      openid: openid
    });

    return {
      success: true,
      orderId,
      orderNo,
      verifyCode,
      paymentParams: payResult.payment
    };
  } catch (err) {
    console.error('创建订单失败:', err);
    return { success: false, errMsg: err.message || '创建订单失败' };
  }
};

/** 生成随机字母数字码（排除易混淆字符） */
function generateCode(len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < len; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
