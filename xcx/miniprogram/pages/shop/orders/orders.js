const db = wx.cloud.database();
const { COLLECTIONS } = require('../../../utils/db');
const { formatDateTime } = require('../../../utils/date');

Page({
  data: {
    activeTab: 'paid',  // paid / verified / refunded / pending_payment
    orders: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: true
  },

  onLoad() {
    this.loadOrders();
  },

  onShow() {
    // 从详情页返回时刷新当前tab
    this.loadOrders(1, this.data.activeTab);
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true });
    this.loadOrders(1, this.data.activeTab).then(() => wx.stopPullDownRefresh());
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
      return Promise.resolve();
    }

    this.setData({ loading: true });

    const that = this;
    return db.collection(COLLECTIONS.ORDERS)
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
  },

  // 继续支付（待支付订单，阻止冒泡到 goDetail）
  continuePay(e) {
    const order = e.currentTarget.dataset.order;
    if (!order) return;
    wx.navigateTo({
      url: `/pages/shop/orderDetail/orderDetail?orderId=${order._id}`
    });
  },

  // 删除订单
  deleteOrder(e) {
    const order = e.currentTarget.dataset.order;
    if (!order || !order._id) return;

    const statusMap = {
      pending_payment: '待支付',
      verified: '已核销',
      refunded: '已退款'
    };
    const statusText = statusMap[order.status] || order.status;

    wx.showModal({
      title: '确认删除',
      content: `确定要删除此${statusText}订单吗？删除后无法恢复。`,
      confirmColor: '#F44336',
      success: res => {
        if (!res.confirm) return;

        wx.showLoading({ title: '删除中...', mask: true });
        wx.cloud.callFunction({
          name: 'deleteOrder',
          data: { orderId: order._id }
        }).then(resp => {
          wx.hideLoading();
          if (resp.result.success) {
            wx.showToast({ title: '已删除', icon: 'success' });
            // 从本地列表中移除
            const orders = this.data.orders.filter(o => o._id !== order._id);
            this.setData({ orders });
          } else {
            wx.showToast({ title: resp.result.errMsg || '删除失败', icon: 'none' });
          }
        }).catch(err => {
          wx.hideLoading();
          console.error('删除订单失败:', err);
          wx.showToast({ title: '删除失败，请重试', icon: 'none' });
        });
      }
    });
  }
});
