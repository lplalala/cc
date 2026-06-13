const db = wx.cloud.database();
const { COLLECTIONS } = require('../../utils/db');
const { CLINIC_LOCATION } = require('../../utils/config');

Page({
  data: {
    nickName: '',
    phone: '',
    openid: '',
    isAdmin: false,
    bookings: [],
    patients: [],
    showBookings: false,
    showPatients: false,
    hasAuth: false       // 是否已完成授权（手机号+昵称）
  },

  onLoad() {
    this._refreshAll();
  },

  onShow() {
    // 每次回来都刷新（auth 页授权完回来后需要更新）
    this._refreshAll();
  },

  /** 统一刷新所有用户数据 */
  _refreshAll() {
    const loggedOut = wx.getStorageSync('loggedOut');
    if (loggedOut) {
      this.setData({
        openid: '',
        phone: '',
        nickName: '',
        hasAuth: false,
        isAdmin: false
      });
      return;
    }

    const app = getApp();
    const openid = app.globalData.openid || wx.getStorageSync('openid') || '';
    const phone = app.globalData.phone || wx.getStorageSync('userPhone') || '';
    const nickName = app.globalData.nickName || wx.getStorageSync('userNickName') || '';

    // hasAuth：有 openid 且有手机号或昵称才视为已授权
    const hasAuth = !!(openid && (phone || nickName));

    this.setData({
      openid,
      phone,
      nickName,
      hasAuth,
      isAdmin: app.globalData.isAdmin || false
    });

    // 已授权才加载后台数据
    if (hasAuth) {
      this.loadUserInfo();
      Promise.all([this.loadBookings(), this.loadPatients()]);
    }
  },

  // 从 users 集合加载昵称和手机号
  loadUserInfo() {
    const openid = this.data.openid;
    if (!openid) return;
    db.collection(COLLECTIONS.USERS).where({ openid }).get().then(res => {
      if (res.data.length > 0) {
        const user = res.data[0];
        this.setData({
          nickName: user.nickName || this.data.nickName,
          phone: user.phone || this.data.phone,
          hasAuth: true
        });
        // 同步到本地
        if (user.phone) wx.setStorageSync('userPhone', user.phone);
        if (user.nickName) wx.setStorageSync('userNickName', user.nickName);
      }
    }).catch(() => {});
  },

  // 保存昵称
  onNickNameBlur(e) {
    const nickName = e.detail.value;
    if (!nickName) return;
    this.setData({ nickName });
    wx.setStorageSync('userNickName', nickName);
    wx.cloud.callFunction({
      name: 'updateUserInfo',
      data: { nickName }
    }).catch(err => console.error('更新昵称失败', err));
  },

  // 复制 ID
  copyId() {
    const openid = this.data.openid;
    if (!openid) {
      wx.showToast({ title: 'ID 未获取', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: openid,
      success: () => wx.showToast({ title: '已复制 ID', icon: 'success' })
    });
  },

  // 加载预约
  loadBookings() {
    const openid = this.data.openid;
    if (!openid) return Promise.resolve();
    return db.collection(COLLECTIONS.APPOINTMENTS).where({ openid }).orderBy('createdAt', 'desc').get().then(res => {
      this.setData({ bookings: res.data });
    }).catch(() => {});
  },

  // 加载就诊人
  loadPatients() {
    const openid = this.data.openid;
    if (!openid) return Promise.resolve();
    return db.collection(COLLECTIONS.PATIENTS).where({ openid }).get().then(res => {
      this.setData({ patients: res.data });
    }).catch(() => {});
  },

  toggleBookings() { this.setData({ showBookings: !this.data.showBookings }); },
  togglePatients() { this.setData({ showPatients: !this.data.showPatients }); },

  deleteBooking(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除？',
      success: res => {
        if (res.confirm) {
          db.collection(COLLECTIONS.APPOINTMENTS).doc(id).remove().then(() => {
            wx.showToast({ title: '已删除' });
            this.loadBookings();
          });
        }
      }
    });
  },

  deletePatient(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除？',
      success: res => {
        if (res.confirm) {
          db.collection(COLLECTIONS.PATIENTS).doc(id).remove().then(() => {
            wx.showToast({ title: '已删除' });
            this.loadPatients();
          });
        }
      }
    });
  },

  goAddress() {
    wx.openLocation(CLINIC_LOCATION);
  },
  goMyOrders() { wx.navigateTo({ url: '/pages/shop/orders/orders' }); },
  goAdmin() { wx.navigateTo({ url: '/pages/admin/admin' }); },

  goLogin() {
    wx.navigateTo({ url: '/pages/auth/auth' });
  },

  logout() {
    const keysToRemove = ['openid', 'userPhone', 'userNickName', 'userInfo', 'sessionKey', 'userAvatarUrl'];
    keysToRemove.forEach(key => {
      try { wx.removeStorageSync(key); } catch (e) {}
    });
    wx.setStorageSync('loggedOut', true);

    const app = getApp();
    app.globalData.openid = '';
    app.globalData.phone = '';
    app.globalData.nickName = '';
    app.globalData.isAdmin = false;
    app.globalData.userInfo = null;

    this.setData({
      openid: '', phone: '', nickName: '', hasAuth: false, isAdmin: false,
      bookings: [], patients: []
    });
  }
});
