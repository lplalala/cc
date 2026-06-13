const db = wx.cloud.database();
const { COLLECTIONS } = require('../../../utils/db');
const { formatDateTime } = require('../../../utils/date');

Page({
  data: {
    activeTab: 'paid',  // paid / verified / refunded
    orders: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: true
  },

  onLoad() {
    this.loadOrders();
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab, page: 1, hasMore: true, orders: [] });
    this.loadOrders(1, tab);
  },

  onReachBottom() {
    if (!this.data.hasMore) return;
    this.loadOrders(this.data.page + 1, this.data.activeTab);
  },

  loadOrders(page, tab) {
    page = page || 1;
    tab = tab || this.data.activeTab;

    // 健壮获取 openid：globalData → storage → cloud
    const openid = getApp().globalData.openid || wx.getStorageSync('openid') || '';

    if (!openid) {
      console.warn('[我的订单] openid 为空，尝试重新获取...');
      // 异步重试获取 openid
      wx.cloud.callFunction({ name: 'getOpenId' }).then(res => {
        const oid = res.result.openid;
        getApp().globalData.openid = oid;
        wx.setStorageSync('openid', oid);
        this.loadOrders(1, this.data.activeTab);
      }).catch(() => {
        this.setData({ loading: false, orders: [] });
      });
      return;
    }

    this.setData({ loading: true });

    const that = this;
    db.collection(COLLECTIONS.ORDERS)
      .where({ _openid: openid, status: tab })
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * that.data.pageSize)
      .limit(that.data.pageSize)
      .get()
      .then(res => {
        const orders = res.data.map(o => ({
          ...o,
          createdAt: formatDateTime(o.createdAt)
        }));
        const merged = page === 1 ? orders : [...that.data.orders, ...orders];
        that.setData({
          orders: merged,
          page,
          hasMore: res.data.length >= that.data.pageSize,
          loading: false
        });
      })
      .catch(err => {
        console.error('加载订单失败', err);
        that.setData({ loading: false });
      });
  },

  // 点击订单进详情
  goDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/shop/orderDetail/orderDetail?orderId=${orderId}` });
  }
});
