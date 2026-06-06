const db = wx.cloud.database();
const { COLLECTIONS } = require('../../../utils/db');

Page({
  data: {
    order: null,
    orderId: ''
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
      this.setData({ order: res.data });
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

  // 申请退款
  requestRefund() {
    wx.showModal({
      title: '申请退款',
      content: '确定要申请退款吗？',
      success: res => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        wx.cloud.callFunction({
          name: 'refundOrder',
          data: { orderId: this.data.orderId, reason: '用户申请退款' }
        }).then(resp => {
          wx.hideLoading();
          if (resp.result.success) {
            wx.showToast({ title: '退款成功', icon: 'success' });
            this.loadOrder(this.data.orderId);
          } else {
            wx.showToast({ title: resp.result.errMsg || '退款失败', icon: 'none' });
          }
        }).catch(err => {
          wx.hideLoading();
          console.error('退款失败', err);
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
  }
});
