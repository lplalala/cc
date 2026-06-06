const db = wx.cloud.database();
const { COLLECTIONS } = require('../../utils/db');

Page({
  data: {
    phone: '',
    nickName: ''
  },

  onLoad() {
  
  },

  // 手机号授权回调
  getRealPhoneNumber(e) {
    const { code } = e.detail;
    if (!code) {
      wx.showToast({ title: '获取手机号失败，请重试', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '验证手机号...' });
    wx.cloud.callFunction({
      name: 'getRealPhone',
      data: { code }
    }).then(res => {
      wx.hideLoading();
      if (res.result.success) {
        const phoneNumber = res.result.phoneInfo.purePhoneNumber;
        this.setData({ phone: phoneNumber });
      } else {
        wx.showToast({ title: '验证失败，请稍后再试', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  // 实时更新昵称（解决微信昵称选择后不触发 blur 的问题）
  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value.trim() });
  },

  // 失焦时也更新昵称（备用）
  onNickNameBlur(e) {
    this.setData({ nickName: e.detail.value.trim() });
  },

  // 手动确认昵称按钮
  confirmNickName() {
    const nickName = this.data.nickName;
    if (!nickName) {
      wx.showToast({ title: '请填写昵称', icon: 'none' });
      return;
    }
    this.saveAndEnter();
  },

  // 保存信息并进入首页
  saveAndEnter() {
    const { phone, nickName } = this.data;
    if (!phone || !nickName) return;

    wx.showLoading({ title: '保存授权信息...' });
    const openid = getApp().globalData.openid;

    db.collection(COLLECTIONS.USERS).where({ openid }).get().then(res => {
      if (res.data.length > 0) {
        return db.collection(COLLECTIONS.USERS).where({ openid }).update({
          data: { phone, nickName, updatedAt: new Date() }
        });
      } else {
        return db.collection(COLLECTIONS.USERS).add({
          data: { openid, phone, nickName, createdAt: new Date() }
        });
      }
    }).then(() => {
      wx.setStorageSync('userPhone', phone);
      wx.setStorageSync('userNickName', nickName);
      getApp().globalData.phone = phone;
      getApp().globalData.nickName = nickName;
      wx.hideLoading();
      wx.showToast({ title: '授权完成', icon: 'success', duration: 800 });
      setTimeout(() => {
        wx.navigateBack({
          delta: 1,
          fail: () => {
            // 如果没有上一页（比如直接打开授权页），则去首页
            wx.switchTab({ url: '/pages/index/index' });
          }
        });
      }, 900);
    }).catch(err => {
      wx.hideLoading();
      console.error('保存用户数据失败', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    });
  }
});