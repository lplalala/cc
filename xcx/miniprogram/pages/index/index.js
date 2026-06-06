const db = wx.cloud.database();
const { convertCloudUrls } = require('../../utils/cloud');
const { COLLECTIONS } = require('../../utils/db');
const { showModalAsync } = require('../../utils/ui');

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

Page({
  data: {
    banners: [],
    navItems: [],
    doctors: [],
    isAdmin: false,
    loading: true,

    // 医生展开预约 Overlay
    showOverlay: false,
    currentDoctor: null,
    // 日期
    weekDates: [],
    selectedDate: '',
    // 两列时间段
    morningSlots: [
      { time: '09:00-10:00', remain: 3 },
      { time: '10:00-11:00', remain: 4 },
      { time: '11:00-12:00', remain: 5 },
    ],
    afternoonSlots: [
      { time: '14:00-15:00', remain: 2 },
      { time: '15:00-16:00', remain: 4 },
      { time: '16:00-17:00', remain: 3 },
    ],
    eveningSlots: [
      { time: '17:00-18:00', remain: 5 },
      { time: '18:00-19:00', remain: 3 },
      { time: '19:00-20:00', remain: 2 },
    ],
    selectedTime: '',
    // 就诊人
    patients: [],
    selectedPatientId: ''
  },

  onLoad() {
    const app = getApp();
    this.setData({ isAdmin: app.globalData.isAdmin });

    const bannersP = db.collection(COLLECTIONS.BANNERS).get()
      .then(res => convertCloudUrls(res.data, 'imageUrl'))
      .then(banners => this.setData({ banners }))
      .catch(err => console.error('加载轮播图失败', err));

    const doctorsP = db.collection(COLLECTIONS.DOCTORS).get()
      .then(res => convertCloudUrls(res.data, 'avatarUrl'))
      .then(doctors => this.setData({ doctors }))
      .catch(err => console.error('加载医生失败', err));

    const navP = this.loadNavItems();

    Promise.all([bannersP, doctorsP, navP]).finally(() => {
      this.setData({ loading: false });
    });
    this._loadedOnce = true;
  },

  onShow() {
    // 从 createPatient 页面返回时刷新就诊人列表并自动选中新建的
    if (this._loadedOnce && this.data.showOverlay) {
      this.loadPatients().then(() => {
        const newId = getApp().globalData._newPatientId;
        if (newId) {
          this.setData({ selectedPatientId: newId });
          getApp().globalData._newPatientId = null;
        }
      });
    }
  },

  loadNavItems() {
    const defaultNav = [
      { id: 'contact', name: '在线咨询', type: 'contact', icon: '💬' },
      { id: 'warranty', name: '质保卡查询', type: 'warranty', icon: '🔍' },
      { id: 'notice', name: '注意事项', type: 'notice', icon: '📋' },
    ];
    return db.collection(COLLECTIONS.NAV_CONFIG).get().then(res => {
      if (res.data.length > 0) {
        this.setData({ navItems: res.data });
      } else {
        this.setData({ navItems: defaultNav });
      }
    }).catch(err => {
      console.log('导航加载失败，使用默认', err);
      this.setData({ navItems: defaultNav });
    });
  },

  onNavTap(e) {
    const id = e.currentTarget.dataset.id;
    const navItems = this.data.navItems;
    const item = navItems.find(n => n.id === id);

    if (!item) {
      wx.showToast({ title: '未找到该功能', icon: 'none' });
      return;
    }

    let type = item.type;
    if (!type) {
      if (id === 'warranty') type = 'warranty';
      else if (id === 'call') type = 'call';
    }

    switch (type) {
      case 'warranty':
        wx.navigateTo({ url: '/pages/query/query' });
        break;
      case 'call':
        if (item.phone) {
          wx.makePhoneCall({ phoneNumber: item.phone });
        } else {
          wx.showToast({ title: '电话号码未配置', icon: 'none' });
        }
        break;
      case 'contact':
        wx.openCustomerServiceChat({
          extInfo: { url: 'https://work.weixin.qq.com/kfid/kfcd93980fede4fe9f9' },
          corpId: 'ww919512198efa1baf',
          success(res) { console.log('企业微信客服会话已打开', res); },
          fail(err) { console.error('打开企业微信客服失败', err); }
        });
        break;
      case 'notice':
        wx.navigateTo({ url: '/pages/notice/index' });
        break;
      case 'booking':
        // 自助挂号已迁移至首页医生卡片点击展开预约
        wx.showToast({ title: '请点击下方医生卡片进行挂号', icon: 'none', duration: 2000 });
        break;
      default:
        wx.showToast({ title: '功能开发中', icon: 'none' });
    }
  },

  // ==================== 医生卡展开 Overlay ====================

  // 点击医生卡片 → 展开预约面板
  onDoctorTap(e) {
    const doctor = e.currentTarget.dataset.doctor;
    this.generateWeek();
    this.loadPatients();
    // 重置时段状态
    this.resetSlots();
    const defaultDate = this.data.weekDates.find(d => d.isToday);
    this.setData({
      showOverlay: true,
      currentDoctor: doctor,
      selectedTime: '',
      selectedPatientId: '',
      selectedDate: defaultDate?.dateStr || this.data.weekDates[0]?.dateStr
    });
    // 若默认选中今天，过滤已过时段
    if (defaultDate && defaultDate.isToday) {
      this.filterPastSlots();
    }
  },

  // 关闭 Overlay
  closeOverlay() {
    this.setData({ showOverlay: false, currentDoctor: null });
  },

  // 阻止冒泡
  stopBubble() {},

  // 生成从今天起未来 7 天日期（今天固定在第一位，自动滚动）
  generateWeek() {
    const today = new Date();
    const todayYmd = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const dateStr = `${month}月${day}日`;
      const isToday = i === 0;
      const ymd = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      const isPast = ymd < todayYmd;
      weekDates.push({ dateStr, month, day, weekday: WEEKDAYS[d.getDay()], isToday, isPast });
    }
    const defaultDate = weekDates[0]; // 今天始终在第一位
    this.setData({ weekDates, selectedDate: defaultDate.dateStr });
  },

  // 加载就诊人（返回 Promise 供链式调用）
  loadPatients() {
    const openid = getApp().globalData.openid;
    if (!openid) return Promise.resolve();
    return db.collection(COLLECTIONS.PATIENTS).where({ openid }).get().then(res => {
      this.setData({ patients: res.data });
      return res.data;
    }).catch(() => []);
  },

  selectDate(e) {
    const dateStr = e.currentTarget.dataset.date;
    const dateItem = this.data.weekDates.find(d => d.dateStr === dateStr);
    if (dateItem && dateItem.isPast) return; // 过去日期不可选
    this.setData({ selectedDate: dateStr, selectedTime: '' });
    // 今天：过滤已过时段；非今天：重置所有时段为可选
    if (dateItem && dateItem.isToday) {
      this.filterPastSlots();
    } else {
      this.resetSlots();
    }
  },

  // 重置所有时段：清除 isPast 标记
  resetSlots() {
    this.setData({
      morningSlots: this.data.morningSlots.map(s => ({ time: s.time, remain: s.remain })),
      afternoonSlots: this.data.afternoonSlots.map(s => ({ time: s.time, remain: s.remain })),
      eveningSlots: this.data.eveningSlots.map(s => ({ time: s.time, remain: s.remain }))
    });
  },

  // 过滤今天已过的时间段
  filterPastSlots() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotal = currentHour * 60 + currentMinute;

    const filterFunc = s => {
      const startTime = s.time.split('-')[0];
      const parts = startTime.split(':');
      const slotTotal = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      return { ...s, isPast: slotTotal <= currentTotal };
    };

    const newMorning = this.data.morningSlots.map(filterFunc);
    const newAfternoon = this.data.afternoonSlots.map(filterFunc);
    const newEvening = this.data.eveningSlots.map(filterFunc);

    this.setData({ morningSlots: newMorning, afternoonSlots: newAfternoon, eveningSlots: newEvening });
    // 清除可能选中的过去时段
    const allSlots = [...newMorning, ...newAfternoon, ...newEvening];
    const sel = allSlots.find(s => s.time === this.data.selectedTime);
    if (sel && sel.isPast) {
      this.setData({ selectedTime: '' });
    }
  },

  selectTime(e) {
    this.setData({ selectedTime: e.currentTarget.dataset.time });
  },

  selectPatient(e) {
    this.setData({ selectedPatientId: e.currentTarget.dataset.id });
  },

  // 在 Overlay 中跳转新建就诊人页面
  addPatientInOverlay() {
    wx.navigateTo({ url: '/pages/createPatient/createPatient' });
  },

  // 确认挂号 → 先弹温馨提示
  async confirmBooking() {
    const { selectedTime, selectedDate, selectedPatientId, patients } = this.data;
    if (!selectedTime || !selectedDate) {
      wx.showToast({ title: '请选择日期和时段', icon: 'none' });
      return;
    }
    // 强制选择就诊人
    if (!selectedPatientId) {
      wx.showToast({ title: '请选择就诊人', icon: 'none' });
      return;
    }

    const patient = patients.find(p => p._id === selectedPatientId);
    if (!patient) {
      wx.showToast({ title: '请选择有效的就诊人', icon: 'none' });
      return;
    }

    // 温馨提示弹窗
    const result = await showModalAsync({
      title: '就诊提醒',
      content: '为保证您的就诊体验，若该医生近期门诊较满，我们将根据您的具体需求，为您灵活安排或推荐更适合的专家。如有变动，我们会第一时间与您沟通。',
      confirmText: '继续挂号',
      cancelText: '取消'
    });

    if (!result.confirm) return;

    const patientName = patient.name;
    const phone = patient.phone;

    wx.showLoading({ title: '预约中...', mask: true });

    // 后备超时：10 秒后强制隐藏 loading 并提示
    const timeoutId = setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ title: '网络繁忙，请重试', icon: 'none' });
    }, 10000);

    try {
      const doctor = this.data.currentDoctor || {};
      const res = await db.collection(COLLECTIONS.APPOINTMENTS).add({
        data: {
          patientId: selectedPatientId,
          patientName,
          phone,
          // 医生信息（强制关联）
          doctorId: doctor._id || '',
          doctorName: doctor.name || '',
          doctorTitle: doctor.title || '',
          date: selectedDate,
          time: selectedTime,
          createdAt: new Date(),
          status: '已预约',
          openid: getApp().globalData.openid || ''
        }
      });
      clearTimeout(timeoutId);
      wx.hideLoading();
      wx.showToast({ title: '挂号成功！', icon: 'success' });
      this.setData({ showOverlay: false, selectedTime: '', selectedPatientId: '' });
    } catch (err) {
      clearTimeout(timeoutId);
      wx.hideLoading();
      wx.showToast({ title: '挂号失败，请重试', icon: 'none' });
      console.error('confirmBooking 挂号失败:', err);
    }
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' });
  }
});
