const db = wx.cloud.database();
const { convertCloudUrls } = require('../../utils/cloud');
const { COLLECTIONS } = require('../../utils/db');
const { showModalAsync } = require('../../utils/ui');
const { formatDateTime } = require('../../utils/date');

Page({
  data: {
    tab: 0,
    banners: [],
    doctors: [],
    warranties: [],
    allWarranties: [],
    searchQuery: '',
    patients: [],
    appointments: [],
    allAppointments: [],       // 全部挂号记录（用于前端日期筛选）
    appointmentDate: '',       // 筛选日期，默认当天
    filteredAppointments: [],  // 筛选后的挂号记录
    users: [],
    // 商城管理
    products: [],
    adminOrders: [],
    orderTab: 'paid',
    loading: true
  },

  onShow() {
    // 初始化日期选择器为今天
    if (!this.data.appointmentDate) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      this.setData({ appointmentDate: y + '-' + m + '-' + d });
    }
    this.loadTabData(this.data.tab);
  },

  switchTab(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    this.setData({ tab: idx });
    this.loadTabData(idx);   // 仅加载当前 Tab 数据
  },

  // 按需加载：只查当前 Tab 需要的集合
  loadTabData(idx) {
    const PAGE_SIZE = 50;
    this.setData({ loading: true });
    const jobs = [];

    if (idx === 0) {
      jobs.push(db.collection(COLLECTIONS.BANNERS).get()
        .then(res => convertCloudUrls(res.data, 'imageUrl'))
        .then(banners => this.setData({ banners })));
    }
    if (idx === 1) {
      jobs.push(db.collection(COLLECTIONS.DOCTORS).get()
        .then(res => convertCloudUrls(res.data, 'avatarUrl'))
        .then(doctors => this.setData({ doctors })));
    }
    if (idx === 2) {
      jobs.push(db.collection(COLLECTIONS.WARRANTY_CARDS).limit(PAGE_SIZE).get()
        .then(res => { this.setData({ allWarranties: res.data }); this.filterWarranties(); }));
    }
    if (idx === 3) {
      jobs.push(db.collection(COLLECTIONS.PATIENTS).limit(PAGE_SIZE).get()
        .then(res => this.setData({ patients: res.data })));
    }
    if (idx === 4) {
      jobs.push(db.collection(COLLECTIONS.APPOINTMENTS).limit(PAGE_SIZE).orderBy('createdAt', 'desc').get()
        .then(res => {
          this.setData({ allAppointments: res.data });
          this.filterAppointments();
        }));
    }
    if (idx === 5) {
      jobs.push(db.collection(COLLECTIONS.USERS).limit(PAGE_SIZE).get()
        .then(res => this.setData({ users: res.data })));
    }
    if (idx === 6) {
      jobs.push(db.collection(COLLECTIONS.PRODUCTS).limit(PAGE_SIZE).orderBy('createdAt', 'desc').get()
        .then(res => this.setData({ products: res.data }))
        .catch(() => this.setData({ products: [] })));
    }
    if (idx === 7) {
      jobs.push(db.collection(COLLECTIONS.ORDERS).where({ status: this.data.orderTab }).limit(PAGE_SIZE).orderBy('createdAt', 'desc').get()
        .then(res => this.setData({ adminOrders: res.data.map(o => ({ ...o, createdAt: formatDateTime(o.createdAt) })) }))
        .catch(() => this.setData({ adminOrders: [] })));
    }

    if (jobs.length > 0) {
      Promise.all(jobs).finally(() => this.setData({ loading: false }));
    } else {
      this.setData({ loading: false });
    }
  },

  // loadAllData 保留，增删改操作后刷新当前 Tab
  loadAllData() {
    this.loadTabData(this.data.tab);
  },

  // ========= 挂号日期筛选 =========
  onAppointmentDateChange(e) {
    this.setData({ appointmentDate: e.detail.value }, () => {
      this.filterAppointments();
    });
  },
  filterAppointments() {
    const pickerDate = this.data.appointmentDate; // '2026-06-05'
    const all = this.data.allAppointments;
    if (!pickerDate || !all.length) {
      this.setData({ filteredAppointments: all });
      return;
    }
    // picker 返回 'YYYY-MM-DD'，数据库存储 'M月D日'，需转换
    const parts = pickerDate.split('-');
    const m = parseInt(parts[1], 10); // 去掉前导零
    const d = parseInt(parts[2], 10);
    const targetStr = m + '月' + d + '日'; // '6月5日'
    const filtered = all.filter(item => {
      return item.date === targetStr;
    });
    this.setData({ filteredAppointments: filtered });
  },

  // ========= 轮播图 =========
  addBanner() {
    wx.chooseImage({
      count: 1,
      success: res => {
        const filePath = res.tempFilePaths[0];
        const cloudPath = 'banners/' + Date.now() + '.png';
        wx.cloud.uploadFile({
          cloudPath,
          filePath,
          success: uploadRes => {
            db.collection(COLLECTIONS.BANNERS).add({
              data: { imageUrl: uploadRes.fileID }
            }).then(() => {
              wx.showToast({ title: '上传成功' });
              this.loadAllData();      // 立即刷新列表
            });
          }
        });
      }
    });
  },
  deleteBanner(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除？',
      success: res => {
        if (res.confirm) {
          db.collection(COLLECTIONS.BANNERS).doc(id).remove().then(() => {
            wx.showToast({ title: '已删除' });
            this.loadAllData();
          });
        }
      }
    });
  },

  // ========= 医生 =========
  addDoctor() { this.editDoctorModal(); },
  editDoctor(e) {
    const id = e.currentTarget.dataset.id;
    this.editDoctorModal(id);
  },
  editDoctorModal(docId) {
    const isEdit = !!docId;
    wx.showModal({
      title: isEdit ? '编辑医生' : '新增医生',
      content: '点击确定后依次输入信息',
      success: res => {
        if (res.confirm) this.inputDoctorInfo(docId);
      }
    });
  },
  inputDoctorInfo(docId) {
    const getDoc = docId ? db.collection(COLLECTIONS.DOCTORS).doc(docId).get() : Promise.resolve({ data: {} });

    getDoc.then(async res => {
      const old = res.data || {};

      // 姓名
      const r1 = await showModalAsync({ title: '姓名', editable: true, placeholderText: old.name || '' });
      if (!r1.confirm) return;
      const name = r1.content || old.name;

      // 职称
      const r2 = await showModalAsync({ title: '职称', editable: true, placeholderText: old.title || '' });
      if (!r2.confirm) return;
      const title = r2.content || old.title;

      // 简介
      const r3 = await showModalAsync({ title: '简介', editable: true, placeholderText: old.description || '' });
      if (!r3.confirm) return;
      const description = r3.content || old.description;

      // 头像
      wx.showActionSheet({
        itemList: ['更换头像', '不换'],
        success: sr => {
          if (sr.tapIndex === 0) {
            wx.chooseImage({
              count: 1,
              success: imgRes => {
                const cloudPath = 'doctors/' + Date.now() + '.png';
                wx.cloud.uploadFile({
                  cloudPath,
                  filePath: imgRes.tempFilePaths[0],
                  success: upRes => {
                    this.saveDoctor(docId, { name, title, description, avatarUrl: upRes.fileID });
                  }
                });
              }
            });
          } else {
            this.saveDoctor(docId, { name, title, description, avatarUrl: old.avatarUrl || '' });
          }
        }
      });
    });
  },
  saveDoctor(docId, data) {
    if (docId) {
      db.collection(COLLECTIONS.DOCTORS).doc(docId).update({ data }).then(() => {
        wx.showToast({ title: '更新成功' });
        this.loadAllData();
      });
    } else {
      db.collection(COLLECTIONS.DOCTORS).add({ data }).then(() => {
        wx.showToast({ title: '添加成功' });
        this.loadAllData();
      });
    }
  },
  deleteDoctor(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除？',
      success: res => {
        if (res.confirm) {
          db.collection(COLLECTIONS.DOCTORS).doc(id).remove().then(() => {
            wx.showToast({ title: '已删除' });
            this.loadAllData();
          });
        }
      }
    });
  },

  // ========= 质保卡（带搜索） =========
  addWarranty() {
    wx.navigateTo({ url: '/pages/warrantyForm/warrantyForm' });
  },
  editWarranty(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/warrantyForm/warrantyForm?id=${id}` });
  },
  deleteWarranty(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除？',
      success: res => {
        if (res.confirm) {
          db.collection(COLLECTIONS.WARRANTY_CARDS).doc(id).remove().then(() => {
            wx.showToast({ title: '已删除' });
            this.loadAllData();
          });
        }
      }
    });
  },
  // 搜索框输入
  onSearchInput(e) {
    this.setData({ searchQuery: e.detail.value }, () => {
      this.filterWarranties();
    });
  },
  filterWarranties() {
    const q = this.data.searchQuery.trim().toLowerCase();
    const all = this.data.allWarranties;
    if (!q) {
      this.setData({ warranties: all });
      return;
    }
    const filtered = all.filter(item =>
      (item.queryNo && item.queryNo.toLowerCase().includes(q)) ||
      (item.patientName && item.patientName.toLowerCase().includes(q))
    );
    this.setData({ warranties: filtered });
  },

  // ========= 商品管理 =========
  addProduct() { wx.navigateTo({ url: '/pages/admin/productForm/productForm' }); },
  editProduct(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/admin/productForm/productForm?id=${id}` });
  },
  toggleProduct(e) {
    const id = e.currentTarget.dataset.id;
    const newStatus = e.currentTarget.dataset.status === 'on' ? 'off' : 'on';
    db.collection(COLLECTIONS.PRODUCTS).doc(id).update({ data: { status: newStatus, updatedAt: new Date() } }).then(() => {
      wx.showToast({ title: newStatus === 'on' ? '已上架' : '已下架' });
      this.loadAllData();
    });
  },
  deleteProduct(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除商品？',
      success: res => {
        if (res.confirm) {
          db.collection(COLLECTIONS.PRODUCTS).doc(id).remove().then(() => {
            wx.showToast({ title: '已删除' });
            this.loadAllData();
          });
        }
      }
    });
  },

  // ========= 订单管理 =========
  switchOrderTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ orderTab: tab });
    this.loadAllData();
  },
  verifyOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '核销确认',
      content: '请输入该订单的核销码',
      editable: true,
      placeholderText: '输入6位核销码',
      success: res => {
        if (res.confirm && res.content) {
          wx.cloud.callFunction({
            name: 'verifyCode',
            data: { orderId, code: res.content }
          }).then(resp => {
            if (resp.result.success) {
              wx.showToast({ title: '核销成功', icon: 'success' });
            } else {
              wx.showToast({ title: resp.result.errMsg, icon: 'none' });
            }
            this.loadAllData();
          });
        }
      }
    });
  },
  refundOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认退款？',
      content: '退款后金额将退回用户',
      success: res => {
        if (res.confirm) {
          wx.cloud.callFunction({
            name: 'refundOrder',
            data: { orderId, reason: '管理员操作退款' }
          }).then(resp => {
            if (resp.result.success) {
              wx.showToast({ title: '退款申请已提交，预计1-3个工作日到账', icon: 'success', duration: 3000 });
            } else {
              wx.showToast({ title: resp.result.errMsg, icon: 'none', duration: 3000 });
            }
            this.loadAllData();
          });
        }
      }
    });
  }
});