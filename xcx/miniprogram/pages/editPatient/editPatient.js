const db = wx.cloud.database();
const { COLLECTIONS } = require('../../utils/db');

Page({
  data: {
    id: '',
    name: '',
    phone: '',
    age: '',
    gender: '男'
  },

  onLoad(options) {
    const id = options.id;
    if (id) {
      this.setData({ id });
      // 加载该就诊人数据
      db.collection(COLLECTIONS.PATIENTS).doc(id).get().then(res => {
        const patient = res.data;
        this.setData({
          name: patient.name,
          phone: patient.phone,
          age: patient.age || '',
          gender: patient.gender || '男'
        });
      });
    }
  },

  onNameInput(e) { this.setData({ name: e.detail.value }); },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },
  onAgeInput(e) { this.setData({ age: e.detail.value }); },
  onGenderChange(e) { this.setData({ gender: e.detail.value }); },

  save() {
    const { id, name, phone, age, gender } = this.data;
    if (!name || !phone) {
      wx.showToast({ title: '姓名和手机号必填', icon: 'none' });
      return;
    }
    db.collection(COLLECTIONS.PATIENTS).doc(id).update({
      data: { name, phone, age, gender }
    }).then(() => {
      wx.showToast({ title: '修改成功' });
      wx.navigateBack(); // 返回上一页，自动触发 onShow 刷新
    }).catch(err => {
      wx.showToast({ title: '修改失败', icon: 'none' });
      console.error(err);
    });
  }
});