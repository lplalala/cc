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
    // 升级推荐
    currentUpgrade: null
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

  // 切换分类
  onCategoryTap(e) {
    const category = e.currentTarget.dataset.category;
    if (category === this.data.activeCategory) return;
    this.setData({ activeCategory: category, page: 1, hasMore: true, products: [], loading: true });
    this.loadProducts(1, category);
  },

  // 加载商品列表
  loadProducts(page, category) {
    const that = this;
    page = page || 1;
    category = category || this.data.activeCategory;

    let query = db.collection(COLLECTIONS.PRODUCTS).where({ status: 'on' });

    if (category !== 'all') {
      query = query.where({ categoryId: category });
    }

    this.setData({ loading: true });

    return query
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * this.data.pageSize)
      .limit(this.data.pageSize)
      .get()
      .then(res => {
        const products = page === 1 ? res.data : [...that.data.products, ...res.data];
        const hasMore = res.data.length >= that.data.pageSize;
        that.setData({ products, page, hasMore, loading: false });
      })
      .catch(err => {
        console.error('加载商品失败（集合可能未创建）:', err.message);
        that.setData({ loading: false, hasMore: false });
      });
  },

  // 点击商品→弹窗
  onProductTap(e) {
    const product = e.currentTarget.dataset.product;
    const totalPrice = (product.price * 1).toFixed(2);
    // 取第一个升级推荐
    const currentUpgrade = (product.upgrade_options && product.upgrade_options.length)
      ? product.upgrade_options[0] : null;
    this.setData({ showDetail: true, currentProduct: product, buyQuantity: 1, totalPrice, currentUpgrade });
  },

  // 关闭弹窗
  closeDetail() {
    this.setData({ showDetail: false, currentProduct: null, currentUpgrade: null });
  },

  // 数量变化
  onQuantityChange(e) {
    const type = e.currentTarget.dataset.type;
    let qty = this.data.buyQuantity;
    if (type === 'plus' && qty < 10) qty++;
    if (type === 'minus' && qty > 1) qty--;
    const totalPrice = (this.data.currentProduct.price * qty).toFixed(2);
    this.setData({ buyQuantity: qty, totalPrice });
  },

  // 立即下单
  goBuy() {
    const product = this.data.currentProduct;
    const qty = this.data.buyQuantity;
    this.setData({ showDetail: false });
    wx.navigateTo({
      url: `/pages/shop/confirm/confirm?productId=${product._id}&quantity=${qty}`
    });
  },

  /** 立即升级 — 加载升级目标商品 */
  goUpgrade() {
    const upgrade = this.data.currentUpgrade;
    if (!upgrade) {
      wx.showToast({ title: '暂无可升级的商品', icon: 'none' });
      return;
    }

    if (upgrade.productId) {
      wx.showLoading({ title: '加载中...' });
      db.collection(COLLECTIONS.PRODUCTS).doc(upgrade.productId).get()
        .then(res => {
          wx.hideLoading();
          if (res.data && res.data.status === 'on') {
            this.showUpgradedProduct(res.data);
          } else if (res.data && res.data.status === 'off') {
            wx.showToast({ title: '升级商品已下架', icon: 'none' });
          } else {
            wx.showToast({ title: '暂无可升级的商品', icon: 'none' });
          }
        })
        .catch(err => {
          wx.hideLoading();
          console.error('[goUpgrade] 查询失败:', err);
          wx.showToast({ title: '暂无可升级的商品', icon: 'none' });
        });
    } else {
      // 没有 productId，按差价模式下单
      if (upgrade.priceDiff || upgrade.name) {
        this.goBuyWithUpgrade();
      } else {
        wx.showToast({ title: '暂无可升级的商品', icon: 'none' });
      }
    }
  },

  /** 加载升级商品后替换弹窗 */
  showUpgradedProduct(upgradedProduct) {
    const totalPrice = (upgradedProduct.price * 1).toFixed(2);
    const currentUpgrade = (upgradedProduct.upgrade_options && upgradedProduct.upgrade_options.length)
      ? upgradedProduct.upgrade_options[0] : null;
    this.setData({
      currentProduct: upgradedProduct,
      buyQuantity: 1,
      totalPrice,
      currentUpgrade
    });
    wx.showToast({ title: '已切换到升级商品', icon: 'success', duration: 1500 });
  },

  /** 带升级标记下单 */
  goBuyWithUpgrade() {
    const product = this.data.currentProduct;
    const upgrade = this.data.currentUpgrade;
    const qty = this.data.buyQuantity;
    this.setData({ showDetail: false });
    const params = [
      `productId=${product._id}`,
      `quantity=${qty}`,
      `isUpgrade=true`,
      `upgradePriceDiff=${upgrade.priceDiff || 0}`
    ];
    wx.navigateTo({
      url: `/pages/shop/confirm/confirm?${params.join('&')}`
    });
  }
});
