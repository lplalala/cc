const db = wx.cloud.database();
const { COLLECTIONS } = require('../../../utils/db');
const { SHOP_CATEGORIES } = require('../../../utils/config');

Page({
  data: {
    editId: null,
    name: '',
    description: '',
    price: '',
    originalPrice: '',
    category: '',
    categoryId: 'oral_care',
    tags: '',
    stock: '999',
    status: 'on',
    imageUrl: '',
    categories: SHOP_CATEGORIES.filter(c => c.id !== 'all')
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ editId: options.id });
      this.loadProduct(options.id);
    }
  },

  loadProduct(id) {
    db.collection(COLLECTIONS.PRODUCTS).doc(id).get().then(res => {
      const p = res.data;
      this.setData({
        name: p.name || '',
        description: p.description || '',
        price: String(p.price || ''),
        originalPrice: String(p.originalPrice || ''),
        category: p.category || '',
        categoryId: p.categoryId || 'oral_care',
        tags: (p.tags || []).join(','),
        stock: String(p.stock || '999'),
        status: p.status || 'on',
        imageUrl: p.imageUrl || ''
      });
    });
  },

  // 分类选择
  onCategoryChange(e) {
    const idx = parseInt(e.detail.value);
    this.setData({ categoryId: this.data.categories[idx].id, category: this.data.categories[idx].name });
  },

  // 通用输入
  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  // 状态切换
  onStatusChange(e) {
    this.setData({ status: e.detail.value });
  },

  // 选择图片
  chooseImage() {
    wx.chooseImage({
      count: 1,
      success: res => {
        wx.showLoading({ title: '上传中...' });
        const cloudPath = 'products/' + Date.now() + '.png';
        wx.cloud.uploadFile({
          cloudPath,
          filePath: res.tempFilePaths[0],
          success: upRes => {
            wx.hideLoading();
            this.setData({ imageUrl: upRes.fileID });
            wx.showToast({ title: '上传成功' });
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({ title: '上传失败', icon: 'none' });
          }
        });
      }
    });
  },

  // 保存
  save() {
    const { editId, name, price, description, originalPrice, category, categoryId, tags, stock, status, imageUrl } = this.data;

    if (!name || !price) {
      wx.showToast({ title: '名称和价格必填', icon: 'none' });
      return;
    }

    const data = {
      name,
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : null,
      description,
      category,
      categoryId,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      stock: parseInt(stock) || 999,
      status,
      imageUrl,
      updatedAt: new Date()
    };

    if (!editId) data.createdAt = new Date();

    const method = editId
      ? db.collection(COLLECTIONS.PRODUCTS).doc(editId).update({ data })
      : db.collection(COLLECTIONS.PRODUCTS).add({ data });

    method.then(() => {
      wx.showToast({ title: '保存成功', icon: 'success' });
      wx.navigateBack();
    }).catch(err => {
      console.error('保存失败', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    });
  }
});
