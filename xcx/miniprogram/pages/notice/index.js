/**
 * 注意事项展示页 — 四宫格布局
 * 数据来源：云数据库 projectTemplates 集合
 * 字段：_id, name, noteImages, duration, hasSubItems
 */
const db = wx.cloud.database();
const { COLLECTIONS } = require('../../utils/db');

Page({
  data: {
    templates: [],
    loading: true,
    // 当前查看的注意事项（有 _id 即进入详情模式）
    currentTemplate: {}
  },

  onLoad() {
    this.loadTemplates();
  },

  /** 从 projectTemplates 集合加载所有注意事项 */
  loadTemplates() {
    this.setData({ loading: true });
    db.collection(COLLECTIONS.PROJECT_TEMPLATES)
      .get()
      .then(async res => {
        const templates = res.data;
        // 为每个模板转换封面图（noteImages 首图）
        const enriched = [];
        for (const t of templates) {
          const coverImage = t.noteImages && t.noteImages.length > 0
            ? t.noteImages[0]
            : '';
          // 转换云文件链接
          let coverUrl = '';
          if (coverImage && coverImage.startsWith('cloud://')) {
            try {
              const urlRes = await wx.cloud.getTempFileURL({ fileList: [coverImage] });
              coverUrl = (urlRes.fileList[0] && urlRes.fileList[0].tempFileURL) || '';
            } catch (e) {
              coverUrl = '';
            }
          } else {
            coverUrl = coverImage;
          }
          enriched.push({ ...t, coverImage: coverUrl });
        }
        this.setData({ templates: enriched, loading: false });
      })
      .catch(err => {
        console.error('加载注意事项失败:', err);
        this.setData({ loading: false });
        wx.showToast({ title: '加载失败，请下拉刷新', icon: 'none' });
      });
  },

  onPullDownRefresh() {
    this.loadTemplates();
    wx.stopPullDownRefresh();
  },

  /** 点击某条注意事项 → 转换全部图片后直接展示 */
  async onNoticeTap(e) {
    const item = e.currentTarget.dataset.item;
    const noteImages = item.noteImages || [];
    let imageUrls = [];
    if (noteImages.length > 0) {
      const cloudFiles = noteImages.filter(f => f.startsWith('cloud://'));
      if (cloudFiles.length > 0) {
        wx.showLoading({ title: '加载中...' });
        try {
          const urlRes = await wx.cloud.getTempFileURL({ fileList: cloudFiles });
          const urlMap = {};
          urlRes.fileList.forEach(f => { urlMap[f.fileID] = f.tempFileURL; });
          imageUrls = noteImages.map(f => urlMap[f] || f);
        } catch (e) {
          imageUrls = noteImages;
        }
        wx.hideLoading();
      } else {
        imageUrls = noteImages;
      }
    }
    this.setData({
      currentTemplate: { ...item, imageUrls }
    });
  },

  /** 返回列表 */
  backToList() {
    this.setData({ currentTemplate: {} });
  },

  /** 预览大图 */
  previewImages(e) {
    const url = e.currentTarget.dataset.url;
    const urls = this.data.currentTemplate.imageUrls || [];
    wx.previewImage({ current: url, urls });
  }
});
