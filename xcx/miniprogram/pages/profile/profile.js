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
    hasAuth: false
  },

  onLoad() {
    this._refreshAll();
  },

  onShow() {
    // 首次加载后仅刷新高频数据
    if (!this._firstLoadDone) {
      this._refreshAll();
      this._firstLoadDone = true;
      return;
    }
    // 后续 onShow 只做轻量刷新
    this._lightRefresh();
  },

  /** 首次全量加载 */
  _refreshAll() {
    const loggedOut = wx.getStorageSync('loggedOut');
    if (loggedOut) {
      this.setData({
        openid: '', phone: '', nickName: '', hasAuth: false, isAdmin: false,
        bookings: [], patients: []
      });
      return;
    }

    const app = getApp();
    const openid = app.globalData.openid || wx.getStorageSync('openid') || '';
    const phone = app.globalData.phone || wx.getStorageSync('userPhone') || '';
    const nickName = app.globalData.nickName || wx.getStorageSync('userNickName') || '';
    const hasAuth = !!(openid && (phone || nickName));

    // 合并一次 setData
    const updateData = {
      openid, phone, nickName, hasAuth,
      isAdmin: app.globalData.isAdmin || false
    };

    if (!hasAuth) {
      updateData.bookings = [];
      updateData.patients = [];
      this.setData(updateData);
      return;
    }

    // 先设置基础信息，再异步加载列表
    this.setData(updateData);
    this.loadUserInfo();
    Promise.all([this.loadBookings(), this.loadPatients()]);
  },

  /** 轻量刷新：只查全局状态，不重新查数据库 */
  _lightRefresh() {
    const app = getApp();
    const openid = app.globalData.openid || wx.getStorageSync('openid') || '';
    const phone = app.globalData.phone || wx.getStorageSync('userPhone') || '';
    const nickName = app.globalData.nickName || wx.getStorageSync('userNickName') || '';
    const hasAuth = !!(openid && (phone || nickName));

    this.setData({
      openid, phone, nickName, hasAuth,
      isAdmin: app.globalData.isAdmin || false
    });

    if (hasAuth) {
      // 仅刷新列表，不重查 users 表（昵称/手机号变更概率低）
      Promise.all([this.loadBookings(), this.loadPatients()]);
    }
  },

  loadUserInfo() {
    const openid = this.data.openid;
    if (!openid) return;
    db.collection(COLLECTIONS.USERS).where({ openid }).get().then(res => {
      if (res.data.length > 0) {
        const user = res.data[0];
        const data = {};
        if (user.nickName) { data.nickName = user.nickName; wx.setStorageSync('userNickName', user.nickName); }
        if (user.phone) { data.phone = user.phone; wx.setStorageSync('userPhone', user.phone); }
        if (Object.keys(data).length) this.setData(data);
      }
    }).catch(() => {});
  },

  onNickNameBlur(e) {
    const nickName = e.detail.value;
    if (!nickName) return;
    this.setData({ nickName });
    wx.setStorageSync('userNickName', nickName);
    wx.cloud.callFunction({ name: 'updateUserInfo', data: { nickName } }).catch(() => {});
  },

  copyId() {
    const openid = this.data.openid;
    if (!openid) { wx.showToast({ title: 'ID 未获取', icon: 'none' }); return; }
    wx.setClipboardData({ data: openid, success: () => wx.showToast({ title: '已复制 ID', icon: 'success' }) });
  },

  loadBookings() {
    const openid = this.data.openid;
    if (!openid) return Promise.resolve();
    return db.collection(COLLECTIONS.APPOINTMENTS).where({ openid }).orderBy('createdAt', 'desc').get().then(res => {
      this.setData({ bookings: res.data });
    }).catch(() => {});
  },

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
          }).catch(() => wx.showToast({ title: '删除失败', icon: 'none' }));
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
          }).catch(() => wx.showToast({ title: '删除失败', icon: 'none' }));
        }
      }
    });
  },

  goAddress() { wx.openLocation(CLINIC_LOCATION); },
  goMyOrders() { wx.navigateTo({ url: '/pages/shop/orders/orders' }); },
  goAdmin() { wx.navigateTo({ url: '/pages/admin/admin' }); },
  goLogin() { wx.navigateTo({ url: '/pages/auth/auth' }); },

  logout() {
    ['openid', 'userPhone', 'userNickName', 'userInfo', 'sessionKey', 'userAvatarUrl'].forEach(key => {
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
      bookings: [], patients: [], showBookings: false, showPatients: false
    });
  }
});
