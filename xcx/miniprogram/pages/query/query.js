// pages/query/query.js
Page({
  data: {
    phone: '',
    loading: true
  },

  onLoad() {
    this.checkAndGo();
  },

  onShow() {
    // 每次回到这个页面都重新检查
    this.checkAndGo();
  },

  // 核心函数：有手机号就自动跳转到就诊人选择页，并关闭当前页
  checkAndGo() {
    const phone = getApp().globalData.phone || wx.getStorageSync('userPhone') || '';
    this.setData({ phone, loading: true });

    if (phone) {
      // 使用 redirectTo 关闭当前页，再打开选择就诊人
      // 这样页面栈里就没有 query 页了，返回时直接回首页
      wx.redirectTo({
        url: '/pages/selectPatient/selectPatient?queryNo=' + phone,
        fail: () => {
          wx.showToast({ title: '请稍后重试', icon: 'none' });
          this.setData({ loading: false });
        }
      });
    } else {
      // 没手机号，停止加载，显示去登录按钮
      this.setData({ loading: false });
    }
  },

  goAuth() {
    wx.reLaunch({ url: '/pages/auth/auth' });
  }
});