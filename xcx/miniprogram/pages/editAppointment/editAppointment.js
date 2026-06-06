const db = wx.cloud.database();
const { COLLECTIONS } = require('../../utils/db');

Page({
  data: {
    id: '',
    patientName: '',
    date: '',
    selectedTime: '',
    timeSlots: ['上午 09:00-10:00', '上午 10:00-11:00', '上午 11:00-12:00', 
                '下午 14:00-15:00', '下午 15:00-16:00', '下午 16:00-17:00'],
    timeIndex: 0
  },

  onLoad(options) {
    const id = options.id;
    if (id) {
      this.setData({ id });
      db.collection(COLLECTIONS.APPOINTMENTS).doc(id).get().then(res => {
        const appt = res.data;
        const timeIndex = this.data.timeSlots.indexOf(appt.time);
        this.setData({
          patientName: appt.patientName,
          date: appt.date,
          selectedTime: appt.time,
          timeIndex: timeIndex >= 0 ? timeIndex : 0
        });
      });
    }
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value });
  },

  onTimeChange(e) {
    const idx = parseInt(e.detail.value);
    this.setData({
      timeIndex: idx,
      selectedTime: this.data.timeSlots[idx]
    });
  },

  save() {
    const { id, date, selectedTime } = this.data;
    if (!date || !selectedTime) {
      wx.showToast({ title: '日期和时段不能为空', icon: 'none' });
      return;
    }
    db.collection(COLLECTIONS.APPOINTMENTS).doc(id).update({
      data: { date, time: selectedTime }
    }).then(() => {
      wx.showToast({ title: '修改成功' });
      wx.navigateBack();
    }).catch(err => {
      wx.showToast({ title: '修改失败', icon: 'none' });
      console.error(err);
    });
  }
});