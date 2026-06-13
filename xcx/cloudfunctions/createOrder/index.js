const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g26c0bcee3c74ed' });
const db = cloud.database();

/**
 * 创建订单 + 获取支付参数（纯云函数方案 v2.0）
 * 新增：配送方式、收货地址、规格、升级标记
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const {
    items, totalAmount, remark, phone, nickName,
    // 新增字段 ↓
    deliveryMethod,       // 'pickup' | 'express'
    shippingAddress,      // { recipientName, recipientPhone, recipientRegion, recipientAddress }
    selectedSpec,         // 用户选择的规格名称
    isUpgrade,            // 是否通过升级推荐购买
    itemOriginalTotal     // 升级前原价（用于追踪）
  } = event;

  if (!items || !items.length || !totalAmount) {
    return { success: false, errMsg: '缺少必要参数' };
  }

  // 生成订单号
  const orderNo = Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).substring(2, 8).toUpperCase();

  // 生成 6 位核销码
  const verifyCode = generateCode(6);

  try {
    // 校验库存 & 商品上下架状态
    for (const item of items) {
      const product = await db.collection('products').doc(item.productId).get();
      if (!product.data || product.data.status !== 'on') {
        return { success: false, errMsg: `商品「${item.productName}」已下架` };
      }
    }

    // 构建订单数据
    const orderData = {
      _openid: openid,
      openid,
      orderNo,
      nickName: nickName || '',
      phone: phone || '',
      items,
      totalAmount,
      verify_code: verifyCode,
      status: 'pending_payment',
      remark: remark || '',

      // 新增字段
      deliveryMethod: deliveryMethod || 'pickup',
      shippingAddress: shippingAddress || null,
      selectedSpec: selectedSpec || '',
      isUpgrade: !!isUpgrade,
      itemOriginalTotal: itemOriginalTotal || totalAmount,

      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('[createOrder] 写入订单:', {
      orderNo, _openid: openid, status: 'pending_payment',
      deliveryMethod: orderData.deliveryMethod,
      isUpgrade: orderData.isUpgrade
    });

    const result = await db.collection('orders').add({ data: orderData });
    const orderId = result._id;

    // 调用微信支付统一下单
    const payResult = await cloud.cloudPay.unifiedOrder({
      body: items.map(i => i.productName).join('、'),
      outTradeNo: orderNo,
      totalFee: Math.round(totalAmount * 100), // 单位：分
      spbillCreateIp: '127.0.0.1',
      subMchId: '1746314749',
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
