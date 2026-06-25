const db = wx.cloud.database();
const { COLLECTIONS } = require('../../../utils/db');
const { formatDateTime } = require('../../../utils/date');

Page({
  data: {
    order: null,
    orderId: '',
    deleting: false      // 防重复点击
  },

  onLoad(options) {
    const orderId = options.orderId;
    if (orderId) {
      this.setData({ orderId });
      this.loadOrder(orderId);
    }
  },

  loadOrder(orderId) {
    db.collection(COLLECTIONS.ORDERS).doc(orderId).get().then(res => {
      const order = res.data;
      if (!order) {
        wx.showToast({ title: '订单不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }
      // 格式化所有时间字段
      if (order.createdAt) order.createdAt = formatDateTime(order.createdAt);
      if (order.verifyTime) order.verifyTime = formatDateTime(order.verifyTime);
      if (order.refundTime) order.refundTime = formatDateTime(order.refundTime);
      if (order.refundApplyTime) order.refundApplyTime = formatDateTime(order.refundApplyTime);
      this.setData({ order });
    }).catch(err => {
      console.error('加载订单失败', err);
      wx.showToast({ title: '订单加载失败', icon: 'none' });
    });
  },

  // 复制核销码
  copyCode() {
    const code = this.data.order.verify_code;
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: () => wx.showToast({ title: '已复制核销码', icon: 'success' })
    });
  },

  // 申请退款（防重复点击）
  requestRefund() {
    if (this.data.deleting) return;
    this.setData({ deleting: true });
    wx.showModal({
      title: '申请退款',
      content: '确定要申请退款吗？',
      success: res => {
        if (!res.confirm) {
          this.setData({ deleting: false });
          return;
        }
        wx.showLoading({ title: '处理中...' });
        wx.cloud.callFunction({
          name: 'refundOrder',
          data: { orderId: this.data.orderId, reason: '用户申请退款' }
        }).then(resp => {
          wx.hideLoading();
          if (resp.result.success) {
            wx.showToast({ title: '退款申请已提交，预计1-3个工作日到账', icon: 'success', duration: 3000 });
            this.loadOrder(this.data.orderId);
          } else {
            wx.showToast({ title: resp.result.errMsg || '退款失败', icon: 'none' });
          }
          this.setData({ deleting: false });
        }).catch(err => {
          wx.hideLoading();
          console.error('退款失败', err);
          this.setData({ deleting: false });
        });
      }
    });
  },

  // 查看核销码弹窗
  showCode() {
    const code = this.data.order.verify_code;
    if (!code) return;
    wx.showModal({
      title: '核销码',
      content: code,
      showCancel: false,
      confirmText: '复制',
      success: () => {
        wx.setClipboardData({ data: code });
      }
    });
  },

  // 重新支付（待支付订单）
  retryPayment() {
    const order = this.data.order;
    if (!order) return;
    wx.redirectTo({
      url: `/pages/shop/confirm/confirm?productId=${order.items[0].productId}&quantity=${order.items[0].quantity}`
    });
  },

  // 删除订单
  deleteOrder() {
    const order = this.data.order;
    if (!order || !order._id) return;

    // 待核销状态不可删除
    if (order.status === 'paid') {
      wx.showToast({ title: '已支付订单请先申请退款', icon: 'none' });
      return;
    }

    if (this.data.deleting) return;
    this.setData({ deleting: true });

    const statusMap = {
      pending_payment: '待支付',
      verified: '已核销',
      refunded: '已退款',
      refunding: '退款中'
    };
    const statusText = statusMap[order.status] || order.status;

    wx.showModal({
      title: '确认删除',
      content: `确定要删除此${statusText}订单吗？删除后无法恢复。`,
      confirmColor: '#F44336',
      success: res => {
        if (!res.confirm) {
          this.setData({ deleting: false });
          return;
        }

        wx.showLoading({ title: '删除中...', mask: true });
        wx.cloud.callFunction({
          name: 'deleteOrder',
          data: { orderId: order._id }
        }).then(resp => {
          wx.hideLoading();
          if (resp.result.success) {
            wx.showToast({ title: '已删除', icon: 'success', duration: 2000 });
            // 返回上一页
            setTimeout(() => wx.navigateBack(), 1500);
          } else {
            wx.showToast({ title: resp.result.errMsg || '删除失败', icon: 'none' });
          }
          this.setData({ deleting: false });
        }).catch(err => {
          wx.hideLoading();
          console.error('删除订单失败:', err);
          wx.showToast({ title: '删除失败，请重试', icon: 'none' });
          this.setData({ deleting: false });
        });
      }
    });
  }
});
