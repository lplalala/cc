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
  },

  onLoad() {
    const app = getApp();
    this.setData({
      phone: app.globalData.phone || wx.getStorageSync('userPhone') || '',
      openid: app.globalData.openid || '',
      isAdmin: app.globalData.isAdmin || false
    });
    this.loadUserInfo();
  },

  onShow() {
    // 首次加载或标记脏数据时才重新请求
    if (!this._initialized) {
      this._initialized = true;
      const phone = getApp().globalData.phone || wx.getStorageSync('userPhone') || '';
      if (phone && !this.data.phone) {
        this.setData({ phone });
      }
      this.loadUserInfo();
      Promise.all([this.loadBookings(), this.loadPatients()]);
    }
    // 每次回来只刷新预约和就诊人（数据变化频率高）
    Promise.all([this.loadBookings(), this.loadPatients()]);
  },

  // 加载昵称
  loadUserInfo() {
    const openid = this.data.openid;
    if (!openid) return;
    db.collection(COLLECTIONS.USERS).where({ openid }).get().then(res => {
      if (res.data.length > 0) {
        const user = res.data[0];
        this.setData({
          nickName: user.nickName || '',
          phone: user.phone || this.data.phone,
          avatarUrl: user.avatarUrl || ''
        });
      }
    });
  },

  // 保存昵称
  onNickNameBlur(e) {
    const nickName = e.detail.value;
    if (!nickName) return;
    this.setData({ nickName });
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
      success: () => {
        wx.showToast({ title: '已复制 ID', icon: 'success' });
      }
    });
  },

  // 加载预约（按 creator openid 查询，确保用户能看到自己代他人挂的号）
  loadBookings() {
    const openid = this.data.openid;
    if (!openid) return Promise.resolve();
    return db.collection(COLLECTIONS.APPOINTMENTS).where({ openid }).orderBy('createdAt', 'desc').get().then(res => {
      this.setData({ bookings: res.data });
    });
  },
  // 加载就诊人
  loadPatients() {
    const openid = this.data.openid;
    return db.collection(COLLECTIONS.PATIENTS).where({ openid }).get().then(res => {
      this.setData({ patients: res.data });
    });
  },

  toggleBookings() { this.setData({ showBookings: !this.data.showBookings }); },
  togglePatients() { this.setData({ showPatients: !this.data.showPatients }); },

  // 删除预约
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
  // 删除就诊人
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
    wx.removeStorageSync('userPhone');
    getApp().globalData.phone = '';
    wx.reLaunch({ url: '/pages/auth/auth' });
  }
});