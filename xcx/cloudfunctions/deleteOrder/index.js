const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g26c0bcee3c74ed' });
const db = cloud.database();

/**
 * 删除订单云函数
 * 规则：
 *   - 用户只能删除自己的订单（_openid 校验）
 *   - 待核销（paid）状态不可删除
 *   - 待支付/已核销/已退款可删除
 *   - 管理员可以删除任何状态的订单（退款中除外）
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { orderId } = event;

  if (!orderId) {
    return { success: false, errMsg: '缺少订单ID' };
  }

  try {
    // 1. 查询订单
    const orderRes = await db.collection('orders').doc(orderId).get();
    const order = orderRes.data;

    if (!order) {
      return { success: false, errMsg: '订单不存在' };
    }

    // 2. 鉴权：仅订单所属用户可删除
    if (order._openid !== openid) {
      return { success: false, errMsg: '无权操作此订单' };
    }

    // 3. 状态校验：待核销不可删除
    if (order.status === 'paid') {
      return { success: false, errMsg: '已支付订单不可删除，请先申请退款' };
    }

    if (order.status === 'refunding') {
      return { success: false, errMsg: '退款处理中，请等待退款完成后再删除' };
    }

    // 4. 执行删除
    await db.collection('orders').doc(orderId).remove();

    console.log('[deleteOrder] 订单已删除:', { orderId, orderNo: order.orderNo, status: order.status });

    return { success: true, msg: '订单已删除' };
  } catch (err) {
    console.error('[deleteOrder] 删除失败:', err);
    return { success: false, errMsg: err.message || '删除失败' };
  }
};
