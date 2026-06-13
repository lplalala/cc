const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g26c0bcee3c74ed' });
const db = cloud.database();

/**
 * 退款云函数 v2.0（仅管理员可调用）
 * - 调用 cloud.cloudPay.refund 真实退款
 * - 退款中状态 → 调用成功 → 已退款
 * - 调用失败 → 回滚为 paid 并记录错误
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { orderId, reason } = event;

  if (!orderId) {
    return { success: false, errMsg: '缺少订单ID' };
  }

  try {
    // 1. 验证管理员身份
    const adminRes = await db.collection('admins').where({ openid }).get();
    if (adminRes.data.length === 0) {
      return { success: false, errMsg: '无退款权限' };
    }

    // 2. 查询订单
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

    if (order.status === 'refunding') {
      return { success: false, errMsg: '退款处理中，请勿重复操作' };
    }

    if (order.status !== 'paid') {
      return { success: false, errMsg: '仅已支付订单可退款' };
    }

    // 3. 生成退款单号
    const outRefundNo = 'RF' + Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).substring(2, 6).toUpperCase();

    // 4. 先更新为「退款中」
    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'refunding',
        outRefundNo,
        refundReason: reason || '门店退款',
        refundApplyTime: new Date(),
        updatedAt: new Date()
      }
    });

    // 5. 调用微信支付真实退款接口
    const refundResult = await cloud.cloudPay.refund({
      subMchId: '1746314749',          // 商户号（与支付接口保持一致）
      functionName: 'refundCallback',  // 退款回调云函数
      nonceStr: outRefundNo,
      outTradeNo: order.orderNo,
      outRefundNo,
      totalFee: Math.round(order.totalAmount * 100),
      refundFee: Math.round(order.totalAmount * 100),
      refundDesc: reason || '门店退款'
    });

    console.log('[refundOrder] 退款接口返回:', refundResult);

    // 6. 根据退款结果更新订单
    if (refundResult.returnCode === 'SUCCESS' && refundResult.resultCode === 'SUCCESS') {
      await db.collection('orders').doc(orderId).update({
        data: {
          status: 'refunded',
          refundTime: new Date(),
          refundTransactionId: refundResult.refundId || '',
          updatedAt: new Date()
        }
      });
      return {
        success: true,
        msg: '退款申请已提交，预计1-3个工作日内到账',
        refundId: refundResult.refundId || outRefundNo
      };
    } else {
      // 退款失败，恢复订单状态为 paid
      const errDetail = refundResult.errCodeDes || refundResult.returnMsg || '退款接口返回失败';
      await db.collection('orders').doc(orderId).update({
        data: {
          status: 'paid',
          refundError: errDetail,
          updatedAt: new Date()
        }
      });
      return { success: false, errMsg: errDetail };
    }
  } catch (err) {
    console.error('[refundOrder] 退款异常:', err);
    // 尝试恢复订单状态
    try {
      await db.collection('orders').doc(orderId).update({
        data: {
          status: 'paid',
          refundError: err.message || '退款异常',
          updatedAt: new Date()
        }
      });
    } catch (e) {
      console.error('[refundOrder] 恢复订单状态失败:', e);
    }
    return { success: false, errMsg: err.message || '退款失败，请重试' };
  }
};
