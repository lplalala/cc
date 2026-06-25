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
    categoryIndex: 0,
    tags: '',
    stock: '999',
    status: 'on',
    imageUrl: '',

    // 升级推荐
    upgradeOptions: [],

    // 数据源
    categories: SHOP_CATEGORIES.filter(c => c.id !== 'all'),
    allProducts: [],
    allProductNames: []
  },

  onLoad(options) {
    this.loadAllProducts();
    if (options.id) {
      this.setData({ editId: options.id });
      this.loadProduct(options.id);
    } else {
      this.setData({ categoryIndex: 0 });
    }
  },

  /** 加载全部上架商品供升级目标选择 */
  loadAllProducts() {
    db.collection(COLLECTIONS.PRODUCTS)
      .where({ status: 'on' })
      .field({ name: true })
      .limit(100)
      .get()
      .then(res => {
        const names = res.data.map(p => p.name);
        this.setData({ allProducts: res.data, allProductNames: names });
      })
      .catch(err => console.error('加载商品列表失败', err));
  },

  loadProduct(id) {
    db.collection(COLLECTIONS.PRODUCTS).doc(id).get().then(res => {
      const p = res.data;
      const categoryIdx = this.data.categories.findIndex(c => c.id === p.categoryId);
      this.setData({
        name: p.name || '',
        description: p.description || '',
        price: String(p.price || ''),
        originalPrice: String(p.originalPrice || ''),
        category: p.category || '',
        categoryId: p.categoryId || 'oral_care',
        categoryIndex: categoryIdx >= 0 ? categoryIdx : 0,
        tags: (p.tags || []).join(','),
        stock: String(p.stock || '999'),
        status: p.status || 'on',
        imageUrl: p.imageUrl || '',
        upgradeOptions: (p.upgrade_options || []).map(u => ({
          name: u.name || '',
          imageUrl: u.imageUrl || '',
          priceDiff: String(u.priceDiff || 0),
          productId: u.productId || '',
          improvements: u.improvements || []
        }))
      });
    });
  },

  // ========== 基础输入 ==========
  onCategoryChange(e) {
    const idx = parseInt(e.detail.value);
    this.setData({
      categoryId: this.data.categories[idx].id,
      category: this.data.categories[idx].name,
      categoryIndex: idx
    });
  },
  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },
  onStatusChange(e) {
    this.setData({ status: e.detail.value });
  },

  // ========== 图片上传 ==========
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

  // ========== 升级推荐管理 ==========
  addUpgrade() {
    const upgradeOptions = [...this.data.upgradeOptions, {
      name: '',
      imageUrl: '',
      priceDiff: '0',
      productId: '',
      improvements: []
    }];
    this.setData({ upgradeOptions });
  },

  onUpgradeInput(e) {
    const { index, field } = e.currentTarget.dataset;
    const upgradeOptions = [...this.data.upgradeOptions];
    if (field === 'upName') upgradeOptions[index].name = e.detail.value;
    if (field === 'upPriceDiff') upgradeOptions[index].priceDiff = e.detail.value;
    this.setData({ upgradeOptions });
  },

  /** 从现有商品列表中选择升级目标 */
  onUpgradeProductChange(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    const pickedIndex = parseInt(e.detail.value);
    const upgradeOptions = [...this.data.upgradeOptions];
    const pickedProduct = this.data.allProducts[pickedIndex];
    if (pickedProduct) {
      upgradeOptions[idx].productId = pickedProduct._id;
      // 自动填充名称
      upgradeOptions[idx].name = pickedProduct.name;
      this.setData({ upgradeOptions });
    }
  },

  deleteUpgrade(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    const upgradeOptions = this.data.upgradeOptions.filter((_, i) => i !== idx);
    this.setData({ upgradeOptions });
  },

  /** 升级推荐图片上传 */
  chooseUpgradeImage(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    wx.chooseImage({
      count: 1,
      success: res => {
        wx.showLoading({ title: '上传中...' });
        const cloudPath = 'upgrades/' + Date.now() + '_' + idx + '.png';
        wx.cloud.uploadFile({
          cloudPath,
          filePath: res.tempFilePaths[0],
          success: upRes => {
            wx.hideLoading();
            const upgradeOptions = [...this.data.upgradeOptions];
            upgradeOptions[idx].imageUrl = upRes.fileID;
            this.setData({ upgradeOptions });
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

  clearUpgradeImage(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    const upgradeOptions = [...this.data.upgradeOptions];
    upgradeOptions[idx].imageUrl = '';
    this.setData({ upgradeOptions });
  },

  // ========== 性能提升指标 ==========
  addImprovement(e) {
    const upgradeIndex = parseInt(e.currentTarget.dataset.upgradeIndex);
    const upgradeOptions = [...this.data.upgradeOptions];
    upgradeOptions[upgradeIndex].improvements.push({ label: '', value: '' });
    this.setData({ upgradeOptions });
  },

  onImproveInput(e) {
    const { upgradeIndex, improveIndex, field } = e.currentTarget.dataset;
    const upgradeOptions = [...this.data.upgradeOptions];
    const imp = upgradeOptions[upgradeIndex].improvements[improveIndex];
    if (field === 'impLabel') imp.label = e.detail.value;
    if (field === 'impValue') imp.value = e.detail.value;
    this.setData({ upgradeOptions });
  },

  deleteImprovement(e) {
    const { upgradeIndex, improveIndex } = e.currentTarget.dataset;
    const upgradeOptions = [...this.data.upgradeOptions];
    upgradeOptions[upgradeIndex].improvements = upgradeOptions[upgradeIndex].improvements.filter((_, i) => i !== improveIndex);
    this.setData({ upgradeOptions });
  },

  // ========== 保存 ==========
  save() {
    const { editId, name, price, originalPrice, description, category, categoryId, tags, stock, status, imageUrl, upgradeOptions } = this.data;

    if (!name || !price) {
      wx.showToast({ title: '名称和价格必填', icon: 'none' });
      return;
    }

    // 调试：打印 editId，确认编辑模式
    console.log('[productForm.save] editId:', editId, '集合名:', COLLECTIONS.PRODUCTS);

    // 清理升级推荐
    const cleanUpgrades = upgradeOptions.map(u => ({
      name: u.name || '',
      imageUrl: u.imageUrl || '',
      priceDiff: parseFloat(u.priceDiff) || 0,
      productId: u.productId || '',
      improvements: (u.improvements || [])
        .filter(imp => imp.label && imp.label.trim())
        .map(imp => ({ label: imp.label.trim(), value: imp.value.trim() }))
    })).filter(u => u.name);

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
      upgrade_options: cleanUpgrades,
      updatedAt: new Date()
    };

    if (!editId) data.createdAt = new Date();

    console.log('[productForm.save] 即将写入的数据:', JSON.stringify(data, null, 2));

    if (editId) {
      // 编辑模式：先查询确认文档存在再更新
      db.collection(COLLECTIONS.PRODUCTS).doc(editId).get().then(res => {
        console.log('[productForm.save] 文档存在，当前数据:', res.data);
        return db.collection(COLLECTIONS.PRODUCTS).doc(editId).update({ data });
      }).then(updateRes => {
        console.log('[productForm.save] update 返回:', JSON.stringify(updateRes));
        console.log('[productForm.save] stats.updated:', updateRes.stats && updateRes.stats.updated);
        console.log('[productForm.save] 当前用户 openid:', getApp().globalData.openid);
        // 再次读取验证是否真的写入
        return db.collection(COLLECTIONS.PRODUCTS).doc(editId).get();
      }).then(verifyRes => {
        console.log('[productForm.save] 验证写入结果 — name:', verifyRes.data.name, 'category:', verifyRes.data.category, 'categoryId:', verifyRes.data.categoryId);
        wx.showToast({ title: '保存成功', icon: 'success' });
        wx.navigateBack();
      }).catch(err => {
        console.error('[productForm.save] 保存失败:', err);
        wx.showToast({ title: '保存失败: ' + (err.message || '未知错误'), icon: 'none' });
      });
    } else {
      // 新增模式
      db.collection(COLLECTIONS.PRODUCTS).add({ data }).then(addRes => {
        console.log('[productForm.save] add 返回:', addRes);
        wx.showToast({ title: '新增成功', icon: 'success' });
        wx.navigateBack();
      }).catch(err => {
        console.error('[productForm.save] 新增失败:', err);
        wx.showToast({ title: '新增失败: ' + (err.message || '未知错误'), icon: 'none' });
      });
    }
  }
});
