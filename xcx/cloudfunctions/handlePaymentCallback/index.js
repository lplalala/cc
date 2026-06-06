const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g26c0bcee3c74ed' });
const db = cloud.database();

/**
 * 支付回调处理（纯云函数方案）
 * 支付成功后：更新订单状态、扣库存
 * 核销码已在 createOrder 中预生成
 */
exports.main = async (event, context) => {
  const { orderId, transactionId } = event;

  if (!orderId) {
    return { success: false, errMsg: '缺少 orderId' };
  }

  try {
    // 幂等检查
    const orderRes = await db.collection('orders').doc(orderId).get();
    const order = orderRes.data;

    if (!order) {
      return { success: false, errMsg: '订单不存在' };
    }

    if (order.status === 'paid' || order.status === 'verified') {
      return {
        success: true,
        verificationCode: order.verify_code
      };
    }

    console.log('[handlePaymentCallback] 支付成功，更新订单:', { orderId, oldStatus: order.status });

    // 更新订单状态为已支付
    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'paid',
        transactionId: transactionId || '',
        paymentTime: new Date(),
        updatedAt: new Date()
      }
    });

    // 扣库存
    for (const item of (order.items || [])) {
      const productRes = await db.collection('products').doc(item.productId).get();
      if (productRes.data) {
        const newStock = Math.max(0, (productRes.data.stock || 0) - (item.quantity || 1));
        const newSales = (productRes.data.salesCount || 0) + (item.quantity || 1);
        await db.collection('products').doc(item.productId).update({
          data: { stock: newStock, salesCount: newSales, updatedAt: new Date() }
        });
      }
    }

    return {
      success: true,
      verificationCode: order.verify_code
    };
  } catch (err) {
    console.error('支付回调处理失败:', err);
    return { success: false, errMsg: err.message || '处理失败' };
  }
};
