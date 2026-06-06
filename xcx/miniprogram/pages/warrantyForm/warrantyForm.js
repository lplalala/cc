const db = wx.cloud.database();
const { formatDate, addMonths } = require('../../utils/date');
const { COLLECTIONS } = require('../../utils/db');

Page({
  data: {
    form: { queryNo: '', patientName: '', brand: '', startDate: '', endDate: '' },
    projectNames: [],
    projectTemplates: [],
    selectedProjectName: '',
    selectedProjectIndex: -1,
    showDateRange: false,
    showSubItems: false,
    selectedSubItems: [],
    selectedTeethStr: '',
    selectedTeeth: [],
    editId: null
  },

  onLoad(options) {
    this.loadProjectTemplates();
    if (options.id) {
      this.setData({ editId: options.id });
      this.loadExistingCard(options.id);
    }
  },

  // 加载项目模板，后续可改用云函数或者一次性读取
  loadProjectTemplates() {
    db.collection(COLLECTIONS.PROJECT_TEMPLATES).get().then(res => {
      const templates = res.data || [];
      const names = templates.map(t => t.name);
      this.setData({ projectTemplates: templates, projectNames: names });
    }).catch(err => console.error('加载模板失败', err));
  },

  // 编辑已有质保卡时的数据回填
  loadExistingCard(id) {
    db.collection(COLLECTIONS.WARRANTY_CARDS).doc(id).get().then(res => {
      const card = res.data;
      if (!card) return;

      const template = this.data.projectTemplates.find(t => t.name === card.item);
      if (template) {
        const index = this.data.projectNames.indexOf(template.name);
        this.setData({
          selectedProjectIndex: index,
          selectedProjectName: template.name,
          showDateRange: !template.hasSubItems,
          showSubItems: !!template.hasSubItems, // 强制转布尔
          selectedSubItems: Array.isArray(card.warrantyItems) ? card.warrantyItems : []
        });
      }
      this.setData({
        form: {
          queryNo: card.queryNo || '',
          patientName: card.patientName || '',
          brand: card.brand || '',
          startDate: card.startDate || '',
          endDate: card.endDate || ''
        },
        // 安全处理牙位数据
        selectedTeethStr: card.toothPosition || '',
        selectedTeeth: (typeof card.toothPosition === 'string' && card.toothPosition.length > 0)
          ? card.toothPosition.split(',').map(Number) : []
      });
    });
  },

  // 项目选择
  onProjectChange(e) {
    const index = parseInt(e.detail.value);
    const template = this.data.projectTemplates[index];
    if (!template) return;

    const now = formatDate(new Date());
    let newForm = { ...this.data.form };

    // 统一转换为布尔值，防止数据库存错类型
    if (template.hasSubItems === true || template.hasSubItems === 'true') {
      // 有子项目（种植牙等）
      const subItems = (template.subItems && template.subItems.length > 0)
        ? template.subItems.map(sub => {
            const dur = Number(sub.duration) || 0;
            const end = dur === 0 ? '终身' : addMonths(now, dur);
            return { name: sub.name, startDate: now, endDate: end, duration: dur };
          })
        : [];

      this.setData({
        selectedProjectIndex: index,
        selectedProjectName: template.name,
        showDateRange: false,
        showSubItems: true,
        selectedSubItems: subItems,
        form: { ...newForm, startDate: '', endDate: '' }
      });
    } else {
      // 普通项目
      let dur = Number(template.duration);
      if (isNaN(dur) || dur <= 0) dur = 12; // 默认一年
      const endDate = addMonths(now, dur);

      this.setData({
        selectedProjectIndex: index,
        selectedProjectName: template.name,
        showDateRange: true,
        showSubItems: false,
        selectedSubItems: [],
        form: { ...newForm, startDate: now, endDate: endDate }
      });
    }
  },

  // 通用输入框
  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['form.' + field]: e.detail.value });
  },

  // 牙位点击
  onTapTooth(e) {
    console.log('🔵 父页面收到牙位事件，tooth:', e.detail.tooth);
    const tooth = e.detail.tooth;
    let selected = Array.isArray(this.data.selectedTeeth) ? [...this.data.selectedTeeth] : [];
    const idx = selected.indexOf(tooth);
    if (idx > -1) selected.splice(idx, 1);
    else selected.push(tooth);
    this.setData({ selectedTeeth: selected, selectedTeethStr: selected.join(',') });
  },

  // 子项目日期修改
  onSubItemInput(e) {
    const index = e.currentTarget.dataset.index;
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    let subItems = Array.isArray(this.data.selectedSubItems) ? [...this.data.selectedSubItems] : [];
    if (subItems[index]) {
      subItems[index] = { ...subItems[index], [field]: value };
      this.setData({ selectedSubItems: subItems });
    }
  },

  // 保存
  save() {
    const { form, selectedTeethStr, showSubItems, selectedSubItems, editId, selectedProjectName } = this.data;
    if (!form.queryNo || !form.patientName || !selectedProjectName) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }
    let data = {
      queryNo: form.queryNo,
      patientName: form.patientName,
      brand: form.brand,
      item: selectedProjectName,
      toothPosition: selectedTeethStr,
    };
    if (showSubItems) {
      data.warrantyItems = selectedSubItems;
      data.startDate = '';
      data.endDate = '';
    } else {
      data.startDate = form.startDate;
      data.endDate = form.endDate;
    }

    const method = editId
      ? db.collection(COLLECTIONS.WARRANTY_CARDS).doc(editId).update({ data })
      : db.collection(COLLECTIONS.WARRANTY_CARDS).add({ data });
    method.then(() => {
      wx.showToast({ title: '保存成功' });
      wx.navigateBack();
    }).catch(err => {
      console.error('保存失败', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    });
  }
});