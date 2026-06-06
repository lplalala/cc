const db = wx.cloud.database();
const { COLLECTIONS } = require('../../utils/db');

Page({
  data: {
    patients: []
  },
  onLoad(options) {
    const queryNo = options.queryNo;
    db.collection(COLLECTIONS.WARRANTY_CARDS).where({
      queryNo: queryNo
    }).get().then(res => {
      // 按姓名去重
      const cards = res.data;
      const nameSet = new Set();
      const uniquePatients = [];
      cards.forEach(card => {
        if (card.patientName && !nameSet.has(card.patientName)) {
          nameSet.add(card.patientName);
          uniquePatients.push({ name: card.patientName });
        }
      });
      this.setData({ patients: uniquePatients });
    });
  },

  selectPatient(e) {
    const name = e.currentTarget.dataset.name;
    const queryNo = this.options.queryNo;
    wx.navigateTo({
      url: `/pages/warrantyCard/warrantyCard?queryNo=${queryNo}&patientName=${name}`
    });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }

});