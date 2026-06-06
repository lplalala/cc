const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g26c0bcee3c74ed' });
const db = cloud.database();

/**
 * 核销云函数（仅管理员）
 * 验证 6 位核销码，更新订单状态为 verified
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { orderId, code } = event;

  if (!orderId || !code) {
    return { success: false, errMsg: '缺少订单ID或核销码' };
  }

  try {
    // 管理员鉴权
    const adminRes = await db.collection('admins').where({ openid }).get();
    if (adminRes.data.length === 0) {
      return { success: false, errMsg: '无核销权限' };
    }

    // 查询订单
    const orderRes = await db.collection('orders').doc(orderId).get();
    const order = orderRes.data;

    if (!order) {
      return { success: false, errMsg: '订单不存在' };
    }

    if (order.status === 'verified') {
      return { success: false, errMsg: '该订单已核销' };
    }

    if (order.status === 'refunded') {
      return { success: false, errMsg: '该订单已退款' };
    }

    if (order.status !== 'paid') {
      return { success: false, errMsg: '订单状态不正确，请确认已支付' };
    }

    // 验证核销码
    if (order.verify_code !== code.toUpperCase()) {
      return { success: false, errMsg: '核销码错误' };
    }

    // 执行核销
    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'verified',
        verifyTime: new Date(),
        updatedAt: new Date()
      }
    });

    return { success: true, msg: '核销成功' };
  } catch (err) {
    console.error('核销失败:', err);
    return { success: false, errMsg: err.message || '核销失败' };
  }
};
