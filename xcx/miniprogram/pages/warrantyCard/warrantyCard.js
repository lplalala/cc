const db = wx.cloud.database();
const { COLLECTIONS } = require('../../utils/db');

Page({
  data: {
    cards: [],
    templates: {}   // 项目名称 → noteImages 映射
  },

  onLoad(options) {
    const queryNo = options.queryNo;
    const patientName = options.patientName;

    db.collection(COLLECTIONS.WARRANTY_CARDS).where({
      queryNo: queryNo,
      patientName: patientName
    }).get().then(res => {
      const now = new Date();
      const cards = res.data.map(card => this.processCard(card, now));
      this.setData({ cards });
    });

    this.loadNoteImages();
  },

  /**
   * 处理单张质保卡：细分各子项目的过期状态
   * 修复「种植牙植体终身但牙冠有期限」的一刀切过期问题
   */
  processCard(card, now) {
    const result = { ...card };
    const items = card.warrantyItems;

    // 有子项目（种植牙等）→ 逐项判断
    if (items && items.length > 0) {
      let allExpired = true;
      result._items = items.map(sub => {
        const isLifetime = sub.endDate === '终身' || sub.endDate === '终身有效' || sub.is_lifetime === true;
        const end = (!isLifetime && sub.endDate) ? new Date(sub.endDate) : null;
        const expired = !isLifetime && end && !isNaN(end.getTime()) && now > end;

        if (!expired) allExpired = false;

        return {
          ...sub,
          isLifetime,
          expired,
          statusText: isLifetime ? '终身有效' : (expired ? '已过期' : '有效中'),
          displayEnd: isLifetime ? '终身' : sub.endDate
        };
      });

      result.isExpired = allExpired;
      result._hasLifetime = result._items.some(s => s.isLifetime);
      result._anyActive = !allExpired;
    } else {
      // 无子项目（普通质保）→ 按 endDate 判断
      const end = card.endDate ? new Date(card.endDate) : new Date(0);
      result.isExpired = isNaN(end.getTime()) ? false : now > end;
      result._items = null;
      result._hasLifetime = false;
      result._anyActive = !result.isExpired;
    }

    return result;
  },

  // 从 projectTemplates 集合取出注意事项图片映射
  loadNoteImages() {
    db.collection(COLLECTIONS.PROJECT_TEMPLATES).get().then(res => {
      const templates = {};
      res.data.forEach(tpl => {
        if (tpl.noteImages && tpl.noteImages.length > 0) {
          templates[tpl.name] = tpl.noteImages;
        }
      });
      this.setData({ templates });
    });
  },

  // 点击卡片 → 查看注意事项图片
  openNotes(e) {
    const card = e.currentTarget.dataset.item;
    const itemName = card.item;
    if (!itemName) return;

    let noteImages = null;
    for (const key in this.data.templates) {
      if (itemName.startsWith(key) || key === itemName) {
        noteImages = this.data.templates[key];
        break;
      }
    }

    if (!noteImages || noteImages.length === 0) {
      wx.showToast({ title: '暂无注意事项', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '加载中...' });
    wx.cloud.getTempFileURL({ fileList: noteImages }).then(res => {
      wx.hideLoading();
      const urls = res.fileList.filter(f => f.tempFileURL).map(f => f.tempFileURL);
      if (urls.length === 0) {
        wx.showToast({ title: '图片加载失败', icon: 'none' });
        return;
      }
      wx.previewImage({ current: urls[0], urls });
    }).catch(err => {
      wx.hideLoading();
      console.error('获取图片链接失败', err);
      wx.showToast({ title: '图片加载失败', icon: 'none' });
    });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
