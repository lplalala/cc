const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g26c0bcee3c74ed' });
const db = cloud.database();

/**
 * 退款云函数（仅管理员可调用）
 * 仅对已支付未核销的订单可退款
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { orderId, reason } = event;

  if (!orderId) {
    return { success: false, errMsg: '缺少订单ID' };
  }

  try {
    // 验证管理员身份
    const adminRes = await db.collection('admins').where({ openid }).get();
    if (adminRes.data.length === 0) {
      return { success: false, errMsg: '无退款权限' };
    }

    // 查询订单
    const orderRes = await db.collection('orders').doc(orderId).get();
    const order = orderRes.data;

    if (!order) {
      return { success: false, errMsg: '订单不存在' };
    }

    if (order.status === 'verified') {
      return { success: false, errMsg: '已核销订单不可退款' };
    }

    if (order.status === 'refunded') {
      return { success: false, errMsg: '订单已退款' };
    }

    if (order.status !== 'paid') {
      return { success: false, errMsg: '仅已支付订单可退款' };
    }

    // 执行退款
    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'refunded',
        refundTime: new Date(),
        refundReason: reason || '门店退款',
        updatedAt: new Date()
      }
    });

    return { success: true, msg: '退款成功' };
  } catch (err) {
    console.error('退款失败:', err);
    return { success: false, errMsg: err.message || '退款失败' };
  }
};
