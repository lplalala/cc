Component({
  properties: {
    toothPosition: {
      type: String,
      value: '',
      // 关键：一旦传入的字符串变化，立即重绘整个牙位图
      observer: function(newVal, oldVal) {
        const safePos = typeof newVal === 'string' ? newVal : '';
        this.buildTeethData(safePos);
      }
    },
    interactive: {
      type: Boolean,
      value: false
    },
    showAll: {
      type: Boolean,
      value: true
    }
  },

  data: {
    upperLeft:  [],
    upperRight: [],
    lowerLeft:  [],
    lowerRight: []
  },

  lifetimes: {
    attached() {
      // 组件第一次出现时也画一下
      const safePos = typeof this.properties.toothPosition === 'string' ? this.properties.toothPosition : '';
      this.buildTeethData(safePos);
    }
  },

  methods: {
    // 构建四个象限的牙齿数据
    buildTeethData(posStr) {
      // 安全保护，避免 split 报错
      if (typeof posStr !== 'string') posStr = '';
      const selectedArr = posStr.split(',').filter(id => id && id.length > 0);

      const makeQuadrant = (prefix, nums) => nums.map(num => ({
        id: prefix + num,
        num: num,
        selected: selectedArr.includes(prefix + num)
      }));

      this.setData({
        upperLeft:  makeQuadrant('UL', [1,2,3,4,5,6,7,8]),
        upperRight: makeQuadrant('UR', [1,2,3,4,5,6,7,8]),
        lowerLeft:  makeQuadrant('LL', [1,2,3,4,5,6,7,8]),
        lowerRight: makeQuadrant('LR', [1,2,3,4,5,6,7,8])
      });
    },

    onTap(e) {
      if (!this.properties.interactive) return;
      const toothId = e.currentTarget.dataset.id;
      this.triggerEvent('tapTooth', { tooth: toothId });
    }
  }
});