const { COLLECTIONS } = require('./utils/db');
const { ENV_ID } = require('./utils/config');

App({
  onLaunch: function () {
    wx.cloud.init({
      env: ENV_ID,
      traceUser: true
    });
    this.getOpenId();
  },

  getOpenId() {
    wx.cloud.callFunction({
      name: 'getOpenId'
    }).then(res => {
      console.log('云函数返回 openid:', res.result.openid);
      const openid = res.result.openid;
      this.globalData.openid = openid;
      wx.setStorageSync('openid', openid);   // 持久化，供各页面 fallback
      this.checkAdmin(openid);
    }).catch(err => {
      console.error('云函数调用失败:', err);
    });
  },

  checkAdmin(openid) {
    const db = wx.cloud.database();
    db.collection(COLLECTIONS.ADMINS).where({
      openid: openid
    }).get().then(res => {
      const isAdmin = res.data.length > 0;
      console.log('是管理员?', isAdmin, '找到记录:', res.data);
      this.globalData.isAdmin = isAdmin;
      // 通知首页刷新（如果首页已经加载，需要重新设置）
      const pages = getCurrentPages();
      if (pages.length > 0) {
        const indexPage = pages[0];
        if (indexPage && indexPage.setData) {
          indexPage.setData({ isAdmin: isAdmin });
        }
      }
    }).catch(err => {
      console.error('查询管理员失败:', err);
    });
  },

  globalData: {
    openid: '',
    isAdmin: false
  }
});