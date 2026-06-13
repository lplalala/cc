const db = wx.cloud.database();
const { COLLECTIONS } = require('../../../utils/db');
const { PAYMENT_CONFIG } = require('../../../utils/config');

Page({
  data: {
    // 商品信息
    product: null,
    quantity: 1,
    unitPrice: 0,
    totalAmount: 0,

    // 升级信息
    isUpgrade: false,
    upgradePriceDiff: 0,          // 升级差价（数值）
    upgradePriceDiffDisplay: '0.00',

    // 规格
    specName: '',

    // 配送方式
    deliveryMethod: 'pickup',     // 'pickup' | 'express'

    // 收货地址（快递时使用）
    recipientName: '',
    recipientPhone: '',
    recipientRegion: '',
    recipientAddress: '',

    // 联系信息
    phone: '',
    remark: '',
    nickName: '',

    // 实付金额
    finalAmount: 0
  },

  onLoad(options) {
    const productId = options.productId;
    const quantity = parseInt(options.quantity) || 1;
    const isUpgrade = options.isUpgrade === 'true';
    const upgradePriceDiff = parseFloat(options.upgradePriceDiff) || 0;
    const specName = options.specName ? decodeURIComponent(options.specName) : '';

    db.collection(COLLECTIONS.PRODUCTS).doc(productId).get().then(res => {
      const product = res.data;

      // 确定单价：如果有规格名，从 specs 中找对应价格
      let unitPrice = product.price;
      if (specName && product.specs && product.specs.length) {
        const matched = product.specs.find(s => s.name === specName);
        if (matched) unitPrice = matched.price;
      }

      const totalAmount = (unitPrice * quantity).toFixed(2);
      const upgradeDisplay = upgradePriceDiff.toFixed(2);
      const finalAmount = (parseFloat(totalAmount) + upgradePriceDiff).toFixed(2);

      this.setData({
        product,
        quantity,
        unitPrice,
        totalAmount,
        isUpgrade,
        upgradePriceDiff,
        upgradePriceDiffDisplay: upgradeDisplay,
        specName,
        finalAmount,
        // 实物类默认也显示自取，用户可切换
        deliveryMethod: 'pickup',
        phone: getApp().globalData.phone || wx.getStorageSync('userPhone') || '',
        nickName: getApp().globalData.nickName || wx.getStorageSync('userNickName') || ''
      });
    }).catch(err => {
      console.error('加载商品失败', err);
      wx.showToast({ title: '商品信息加载失败', icon: 'none' });
    });
  },

  // ========== 配送方式 ==========
  onDeliveryChange(e) {
    const method = e.currentTarget.dataset.method;
    this.setData({ deliveryMethod: method });
  },

  // ========== 输入处理 ==========
  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },
  onRemarkInput(e) { this.setData({ remark: e.detail.value }); },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },

  // ========== 确认支付 ==========
  confirmPay() {
    const { product, quantity, totalAmount, phone, remark, nickName,
            deliveryMethod, recipientName, recipientPhone, recipientRegion, recipientAddress,
            isUpgrade, specName, unitPrice, finalAmount } = this.data;

    // 校验手机号（必填）
    if (!phone) {
      wx.showToast({ title: '请填写手机号', icon: 'none' });
      return;
    }

    // 快递配送时校验地址
    if (deliveryMethod === 'express') {
      if (!recipientName) {
        wx.showToast({ title: '请填写收货人姓名', icon: 'none' });
        return;
      }
      if (!recipientPhone) {
        wx.showToast({ title: '请填写收货人手机号', icon: 'none' });
        return;
      }
      if (!recipientRegion || !recipientAddress) {
        wx.showToast({ title: '请填写完整收货地址', icon: 'none' });
        return;
      }
    }

    wx.showLoading({ title: '下单中...', mask: true });

    // 构建配送信息
    const shippingInfo = deliveryMethod === 'express' ? {
      recipientName,
      recipientPhone,
      recipientRegion,
      recipientAddress
    } : null;

    const orderData = {
      items: [{
        productId: product._id,
        productName: product.name,
        imageUrl: product.imageUrl || '',
        price: unitPrice,          // 使用实际单价（规格价格）
        quantity
      }],
      totalAmount: parseFloat(finalAmount),  // 含升级差价的总金额
      phone,
      remark,
      nickName,
      // 新增字段
      deliveryMethod,
      shippingAddress: shippingInfo,
      selectedSpec: specName || '',
      isUpgrade,
      // 记录商品原始价格（用于追踪升级）
      itemOriginalTotal: parseFloat(totalAmount)
    };

    wx.cloud.callFunction({ name: 'createOrder', data: orderData })
      .then(res => {
        const result = res.result;
        if (!result.success) {
          wx.hideLoading();
          wx.showToast({ title: result.errMsg || '下单失败', icon: 'none' });
          return;
        }

        // 仅真实支付
        if (result.paymentParams) {
          this.realPay(result.orderId, result.paymentParams);
        } else {
          wx.hideLoading();
          wx.showToast({ title: result.mockMsg || result.errMsg || '支付配置异常，请联系管理员', icon: 'none', duration: 3000 });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('下单失败', err);
        wx.showToast({ title: '下单失败，请重试', icon: 'none' });
      });
  },

  // 真实微信支付
  realPay(orderId, paymentParams) {
    wx.requestPayment({
      timeStamp: paymentParams.timeStamp,
      nonceStr: paymentParams.nonceStr,
      package: paymentParams.package,
      signType: paymentParams.signType || 'MD5',
      paySign: paymentParams.paySign,
      success: () => this.onPaySuccess(orderId),
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '支付取消', icon: 'none' });
      }
    });
  },

  // 支付成功回调
  onPaySuccess(orderId) {
    wx.showLoading({ title: '确认支付...', mask: true });
    wx.cloud.callFunction({
      name: PAYMENT_CONFIG.callbackFunction,
      data: { orderId }
    }).then(res => {
      wx.hideLoading();
      if (res.result.success) {
        wx.redirectTo({
          url: `/pages/shop/orderSuccess/orderSuccess?orderId=${orderId}&code=${res.result.verificationCode || ''}`
        });
      } else {
        wx.showToast({ title: '支付确认异常，请联系客服', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('支付回调失败', err);
      wx.redirectTo({
        url: `/pages/shop/orderSuccess/orderSuccess?orderId=${orderId}`
      });
    });
  }
});
