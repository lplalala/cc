const { showToastAsync } = require('../../../utils/ui');

Page({
  data: {
    orderId: '',
    verificationCode: '',
    qrData: ''
  },

  onLoad(options) {
    const orderId = options.orderId || '';
    const code = options.code || '';
    this.setData({ orderId, verificationCode: code, qrData: 'VERIFY:' + code });
  },

  // 复制核销码
  copyCode() {
    wx.setClipboardData({
      data: this.data.verificationCode,
      success: () => wx.showToast({ title: '已复制核销码', icon: 'success' })
    });
  },

  // 查看订单
  goOrder() {
    wx.redirectTo({ url: `/pages/shop/orderDetail/orderDetail?orderId=${this.data.orderId}` });
  },

  // 返回商城
  goShop() {
    wx.switchTab({ url: '/pages/shop/index/index' });
  }
});
