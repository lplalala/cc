const db = wx.cloud.database();
const { COLLECTIONS } = require('../../utils/db');

Page({
  data: {
    name: '',
    phone: '',
    age: '',
    gender: '男',
    hasInput: false  // 跟踪用户是否有输入，用于返回确认
  },

  onLoad() {
    // 自动填入当前登录手机号
    const phone = getApp().globalData.phone || wx.getStorageSync('userPhone') || '';
    this.setData({ phone });
  },

  // 输入绑定
  inputName(e)   { this.setData({ name: e.detail.value, hasInput: true }); },
  inputPhone(e)  { this.setData({ phone: e.detail.value, hasInput: true }); },
  inputAge(e)    { this.setData({ age: e.detail.value, hasInput: true }); },
  radioChange(e) { this.setData({ gender: e.detail.value, hasInput: true }); },

  // 返回按钮：若有输入则提示确认
  goBack() {
    if (this.data.hasInput) {
      wx.showModal({
        title: '提示',
        content: '信息未保存，是否退出？',
        confirmText: '退出',
        cancelText: '继续填写',
        success: (res) => {
          if (res.confirm) {
            wx.navigateBack();
          }
        }
      });
    } else {
      wx.navigateBack();
    }
  },

  // 保存并返回
  save() {
    const { name, phone, age, gender } = this.data;

    // 校验：姓名非空
    if (!name || !name.trim()) {
      wx.showToast({ title: '请输入就诊人姓名', icon: 'none' });
      return;
    }

    // 校验：年龄 1-120
    const ageNum = parseInt(age, 10);
    if (!age || isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
      wx.showToast({ title: '请输入有效年龄（1-120）', icon: 'none' });
      return;
    }

    // 校验：手机号格式（11位，以1开头）
    const phoneTrimmed = (phone || '').trim();
    if (!phoneTrimmed || !/^1\d{10}$/.test(phoneTrimmed)) {
      wx.showToast({ title: '请输入有效的11位手机号', icon: 'none' });
      return;
    }

    const openid = getApp().globalData.openid;
    if (!openid) {
      wx.showToast({ title: '用户信息未获取，请重新登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    db.collection(COLLECTIONS.PATIENTS).add({
      data: {
        name: name.trim(),
        phone: phoneTrimmed,
        age: ageNum,
        gender,
        openid,
        createdAt: new Date()
      }
    }).then((res) => {
      wx.hideLoading();
      wx.showToast({ title: '新建成功', icon: 'success' });
      // 将新建的就诊人 ID 暂存到全局，供上一页自动选中
      getApp().globalData._newPatientId = res._id;
      this._navTimer = setTimeout(() => {
        wx.navigateBack();
      }, 800);
    }).catch(err => {
      wx.hideLoading();
      console.error('保存就诊人失败', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    });
  },

  onUnload() {
    if (this._navTimer) clearTimeout(this._navTimer);
  }
});