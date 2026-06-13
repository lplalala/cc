const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g26c0bcee3c74ed' });
const db = cloud.database();

/**
 * 退款回调云函数
 * 微信支付退款成功后异步通知，更新订单状态
 */
exports.main = async (event, context) => {
  console.log('[refundCallback] 收到退款回调:', JSON.stringify(event));

  const { outTradeNo, outRefundNo, returnCode, resultCode } = event;

  try {
    if (returnCode === 'SUCCESS' && resultCode === 'SUCCESS') {
      // 按订单号找到对应订单并更新
      const orderRes = await db.collection('orders')
        .where({ orderNo: outTradeNo })
        .get();

      if (orderRes.data.length > 0) {
        const order = orderRes.data[0];
        await db.collection('orders').doc(order._id).update({
          data: {
            status: 'refunded',
            refundTime: new Date(),
            refundTransactionId: outRefundNo,
            updatedAt: new Date()
          }
        });
        console.log('[refundCallback] 订单已更新为已退款:', order._id);
      }
    }

    return {
      code: 'SUCCESS',
      message: '成功'
    };
  } catch (err) {
    console.error('[refundCallback] 处理失败:', err);
    return {
      code: 'FAIL',
      message: err.message
    };
  }
};
