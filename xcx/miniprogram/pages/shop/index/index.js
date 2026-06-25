const db = wx.cloud.database();
const { COLLECTIONS } = require('../../../utils/db');
const { SHOP_CATEGORIES } = require('../../../utils/config');

Page({
  data: {
    categories: SHOP_CATEGORIES,
    activeCategory: 'all',
    products: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: true,
    refreshing: false,
    // 弹窗
    showDetail: false,
    currentProduct: null,
    buyQuantity: 1,
    totalPrice: '0.00',
    currentUpgrades: [],
    searchKeyword: '',
    filteredProducts: []
  },

  onLoad() {
    this.loadProducts();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true, refreshing: true });
    this.loadProducts(1, this.data.activeCategory).then(() => {
      this.setData({ refreshing: false });
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return;
    this.loadProducts(this.data.page + 1, this.data.activeCategory);
  },

  onCategoryTap(e) {
    const category = e.currentTarget.dataset.category;
    if (category === this.data.activeCategory) return;
    this.setData({ activeCategory: category, page: 1, hasMore: true, products: [], loading: true });
    this.loadProducts(1, category);
  },

  loadProducts(page, category) {
    const that = this;
    page = page || 1;
    category = category || this.data.activeCategory;

    let query = db.collection(COLLECTIONS.PRODUCTS).where({ status: 'on' });
    if (category !== 'all') query = query.where({ categoryId: category });

    this.setData({ loading: true });

    return query
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * this.data.pageSize)
      .limit(this.data.pageSize)
      .get()
      .then(res => {
        const products = page === 1 ? res.data : [...that.data.products, ...res.data];
        that.setData({
          products,
          filteredProducts: products,
          page,
          hasMore: res.data.length >= that.data.pageSize,
          loading: false
        });
      })
      .catch(err => {
        console.error('加载商品失败:', err.message);
        that.setData({ loading: false, hasMore: false });
      });
  },

  // 搜索（本地过滤，避免额外请求）
  onSearchInput(e) {
    const keyword = e.detail.value.trim().toLowerCase();
    this.setData({
      searchKeyword: keyword,
      filteredProducts: keyword
        ? this.data.products.filter(p =>
            (p.name && p.name.toLowerCase().includes(keyword)) ||
            (p.description && p.description.toLowerCase().includes(keyword)))
        : this.data.products
    });
  },

  // 打开商品弹窗 → 阻止背景滚动
  onProductTap(e) {
    const product = e.currentTarget.dataset.product;
    const upgrades = (product.upgrade_options && product.upgrade_options.length)
      ? product.upgrade_options : [];
    this.setData({
      showDetail: true,
      currentProduct: product,
      buyQuantity: 1,
      totalPrice: (product.price * 1).toFixed(2),
      currentUpgrades: upgrades
    });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  // 关闭弹窗
  closeDetail() {
    this.setData({ showDetail: false, currentProduct: null, currentUpgrades: [] });
  },

  onQuantityChange(e) {
    const type = e.currentTarget.dataset.type;
    let qty = this.data.buyQuantity;
    if (type === 'plus' && qty < 10) qty++;
    if (type === 'minus' && qty > 1) qty--;
    this.setData({
      buyQuantity: qty,
      totalPrice: (this.data.currentProduct.price * qty).toFixed(2)
    });
  },

  goBuy() {
    const { currentProduct, buyQuantity } = this.data;
    this.setData({ showDetail: false });
    wx.navigateTo({
      url: `/pages/shop/confirm/confirm?productId=${currentProduct._id}&quantity=${buyQuantity}`
    });
  },

  onSelectUpgrade(e) {
    const upgrade = e.currentTarget.dataset.upgrade;
    if (!upgrade || !upgrade.productId) {
      wx.showToast({ title: '暂无可升级的商品', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '加载中...' });
    db.collection(COLLECTIONS.PRODUCTS).doc(upgrade.productId).get()
      .then(res => {
        wx.hideLoading();
        if (res.data && res.data.status === 'on') {
          const p = res.data;
          const upgrades = (p.upgrade_options && p.upgrade_options.length) ? p.upgrade_options : [];
          this.setData({
            currentProduct: p,
            buyQuantity: 1,
            totalPrice: (p.price * 1).toFixed(2),
            currentUpgrades: upgrades
          });
          wx.showToast({ title: '已切换到升级商品', icon: 'success', duration: 1500 });
        } else {
          wx.showToast({ title: '升级商品已下架', icon: 'none' });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('[onSelectUpgrade]', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  }
});
