const db = wx.cloud.database();
const { COLLECTIONS } = require('../../utils/db');

Page({
  data: {
    phone: '',
    nickName: '',
    loading: true
  },

  onLoad() {
    // 确保 openid 可用：退出登录后 globalData.openid 被清空，需要重新获取
    const app = getApp();
    if (!app.globalData.openid) {
      wx.showLoading({ title: '初始化中...' });
      wx.cloud.callFunction({ name: 'getOpenId' }).then(res => {
        wx.hideLoading();
        const openid = res && res.result ? res.result.openid : '';
        if (openid) {
          app.globalData.openid = openid;
          wx.setStorageSync('openid', openid);
        }
        this.setData({ loading: false });
      }).catch(() => {
        wx.hideLoading();
        this.setData({ loading: false });
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      });
    } else {
      this.setData({ loading: false });
    }
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
        // 自动获取手机号后，聚焦昵称输入
      } else {
        wx.showToast({ title: '验证失败，请稍后再试', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  // 实时更新昵称
  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value.trim() });
  },
  onNickNameBlur(e) {
    this.setData({ nickName: e.detail.value.trim() });
  },

  // 手动确认
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
    if (!phone) {
      wx.showToast({ title: '请先授权手机号', icon: 'none' });
      return;
    }
    if (!nickName) {
      wx.showToast({ title: '请填写昵称', icon: 'none' });
      return;
    }

    // 确保 openid 存在
    const openid = getApp().globalData.openid || wx.getStorageSync('openid') || '';
    if (!openid) {
      // 最后尝试一次获取
      wx.showLoading({ title: '初始化中...' });
      wx.cloud.callFunction({ name: 'getOpenId' }).then(res => {
        wx.hideLoading();
        const oid = res && res.result ? res.result.openid : '';
        if (oid) {
          getApp().globalData.openid = oid;
          wx.setStorageSync('openid', oid);
          this.doSave(oid);
        } else {
          wx.showToast({ title: '初始化失败，请重启小程序', icon: 'none' });
        }
      }).catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      });
      return;
    }

    this.doSave(openid);
  },

  doSave(openid) {
    const { phone, nickName } = this.data;
    wx.showLoading({ title: '保存中...' });

    db.collection(COLLECTIONS.USERS).where({ openid }).get().then(res => {
      if (res.data.length > 0) {
        return db.collection(COLLECTIONS.USERS).doc(res.data[0]._id).update({
          data: { phone, nickName, updatedAt: new Date() }
        });
      } else {
        return db.collection(COLLECTIONS.USERS).add({
          data: { openid, phone, nickName, createdAt: new Date() }
        });
      }
    }).then(() => {
      // 持久化到本地和全局
      wx.setStorageSync('userPhone', phone);
      wx.setStorageSync('userNickName', nickName);
      wx.removeStorageSync('loggedOut');
      const app = getApp();
      app.globalData.phone = phone;
      app.globalData.nickName = nickName;
      wx.hideLoading();
      wx.showToast({ title: '授权完成', icon: 'success', duration: 800 });
      this._navTimer = setTimeout(() => {
        wx.navigateBack({
          delta: 1,
          fail: () => {
            wx.switchTab({ url: '/pages/index/index' });
          }
        });
      }, 900);
    }).catch(err => {
      wx.hideLoading();
      console.error('保存用户数据失败', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    });
  },

  onUnload() {
    if (this._navTimer) clearTimeout(this._navTimer);
  }
});
