const db = wx.cloud.database();
const { COLLECTIONS } = require('../../utils/db');

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

Page({
  data: {
    patients: [],
    selectedPatientId: '',
    // 日历模式：今天起未来7天
    weekDates: [],        // [{dateStr, month, day, weekday, isToday, isPast}]
    selectedDate: '',
    timeSlots: [
      { time: '上午 09:00-10:00', remain: 3 },
      { time: '上午 10:00-11:00', remain: 4 },
      { time: '上午 11:00-12:00', remain: 5 },
      { time: '下午 14:00-15:00', remain: 2 },
      { time: '下午 15:00-16:00', remain: 4 },
      { time: '下午 16:00-17:00', remain: 3 },
      { time: '晚上 17:00-18:00', remain: 5 },
      { time: '晚上 18:00-19:00', remain: 3 },
      { time: '晚上 19:00-20:00', remain: 2 },
    ],
    selectedTime: ''
  },

  onLoad() {
    this.generateWeek();
    this.loadPatients();
    this._loadedOnce = true;
  },

  onShow() {
    if (this._loadedOnce) {
      this.loadPatients();
    }
  },

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
    this.setData({
      weekDates,
      selectedDate: defaultDate.dateStr
    });
    // 默认选中今天时过滤已过时段
    if (defaultDate && defaultDate.isToday) {
      this.filterTodaySlots();
    }
  },

  loadPatients() {
    const openid = getApp().globalData.openid;
    if (!openid) return;
    db.collection(COLLECTIONS.PATIENTS).where({ openid }).get().then(res => {
      this.setData({ patients: res.data });
    }).catch(err => {
      console.error('加载就诊人失败:', err);
    });
  },

  goAddPatient() {
    wx.navigateTo({ url: '/pages/createPatient/createPatient' });
  },

  selectPatient(e) {
    this.setData({ selectedPatientId: e.currentTarget.dataset.id });
  },

  selectDate(e) {
    const dateStr = e.currentTarget.dataset.date;
    const dateItem = this.data.weekDates.find(d => d.dateStr === dateStr);
    if (dateItem && dateItem.isPast) return;
    this.setData({ selectedDate: dateStr, selectedTime: '' });
    // 今天：过滤已过时段；非今天：重置所有时段
    if (dateItem && dateItem.isToday) {
      this.filterTodaySlots();
    } else {
      this.resetTodaySlots();
    }
  },

  // 重置所有时段：清除 isPast 标记，保留余量
  resetTodaySlots() {
    this.setData({
      timeSlots: this.data.timeSlots.map(s => ({ time: s.time, remain: s.remain }))
    });
  },

  // 过滤今天已过的时间段
  filterTodaySlots() {
    const now = new Date();
    const currentHour = now.getHours();
    const nowTotal = currentHour * 60 + now.getMinutes();
    const slots = this.data.timeSlots.map(s => {
      // 时段格式 '上午 09:00-10:00'
      const match = s.time.match(/(\d{2}):(\d{2})/);
      if (match) {
        const slotTotal = parseInt(match[1]) * 60 + parseInt(match[2]);
        return { ...s, isPast: slotTotal <= nowTotal };
      }
      return { ...s, isPast: false };
    });
    this.setData({ timeSlots: slots });
    // 清除可能选中的过去时段
    if (this.data.selectedTime) {
      const sel = slots.find(s => s.time === this.data.selectedTime);
      if (sel && sel.isPast) {
        this.setData({ selectedTime: '' });
      }
    }
  },

  selectTime(e) {
    this.setData({ selectedTime: e.currentTarget.dataset.time });
  },

  async makeAppointment() {
    const { selectedPatientId, selectedDate, selectedTime } = this.data;
    const patient = this.data.patients.find(p => p._id === selectedPatientId);
    if (!patient) {
      wx.showToast({ title: '请选择就诊人', icon: 'none' });
      return;
    }

    if (!selectedDate || !selectedTime) {
      wx.showToast({ title: '请选择日期和时段', icon: 'none' });
      return;
    }

    // 服务端时间校验：防止预约过去的时间
    const now = new Date();
    const dateItem = this.data.weekDates.find(d => d.dateStr === selectedDate);
    if (dateItem && dateItem.isPast) {
      wx.showToast({ title: '无法预约已过去的日期', icon: 'none' });
      return;
    }
    // 时段时间校验
    const timeMatch = selectedTime.match(/(\d{2}):(\d{2})/);
    if (dateItem && dateItem.isToday && timeMatch) {
      const slotTotal = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
      const nowTotal = now.getHours() * 60 + now.getMinutes();
      if (slotTotal <= nowTotal) {
        wx.showToast({ title: '该时段已过，请重新选择', icon: 'none' });
        return;
      }
    }

    wx.showLoading({ title: '预约中...', mask: true });

    // 后备超时：10 秒后强制隐藏 loading 并提示
    const timeoutId = setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ title: '网络繁忙，请重试', icon: 'none' });
    }, 10000);

    try {
      await db.collection(COLLECTIONS.APPOINTMENTS).add({
        data: {
          patientId: patient._id,
          patientName: patient.name,
          phone: patient.phone,
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
      this.setData({ selectedPatientId: '', selectedDate: '', selectedTime: '' });
      // 更新对应时段的余量
      this.updateSlotRemain(selectedTime);
    } catch (err) {
      clearTimeout(timeoutId);
      wx.hideLoading();
      wx.showToast({ title: '挂号失败，请重试', icon: 'none' });
      console.error('makeAppointment 挂号失败:', err);
    }
  },

  // 本地更新时段余量（前端展示用）
  updateSlotRemain(time) {
    const slots = this.data.timeSlots.map(s => {
      if (s.time === time) return { ...s, remain: Math.max(0, s.remain - 1) };
      return s;
    });
    this.setData({ timeSlots: slots });
  }
});
