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
    totalPrice: '0.00'
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
      // 按分类筛选（根据实际 categoryId 字段调整为你的数据库字段）
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
    this.setData({ showDetail: true, currentProduct: product, buyQuantity: 1, totalPrice });
  },

  // 关闭弹窗
  closeDetail() {
    this.setData({ showDetail: false, currentProduct: null });
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
  }
});
