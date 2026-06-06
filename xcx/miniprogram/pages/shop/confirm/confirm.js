const db = wx.cloud.database();
const { COLLECTIONS } = require('../../../utils/db');
const { PAYMENT_CONFIG } = require('../../../utils/config'); // callbackFunction 仍在使用

Page({
  data: {
    product: null,
    quantity: 1,
    totalAmount: 0,
    phone: '',
    remark: '',
    nickName: ''
  },

  onLoad(options) {
    const productId = options.productId;
    const quantity = parseInt(options.quantity) || 1;

    db.collection(COLLECTIONS.PRODUCTS).doc(productId).get().then(res => {
      const product = res.data;
      this.setData({
        product,
        quantity,
        totalAmount: (product.price * quantity).toFixed(2),
        phone: getApp().globalData.phone || wx.getStorageSync('userPhone') || '',
        nickName: getApp().globalData.nickName || wx.getStorageSync('userNickName') || ''
      });
    }).catch(err => {
      console.error('加载商品失败', err);
      wx.showToast({ title: '商品信息加载失败', icon: 'none' });
    });
  },

  onRemarkInput(e) { this.setData({ remark: e.detail.value }); },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },

  // 确认支付（纯云函数方案，仅真实支付）
  confirmPay() {
    const { product, quantity, totalAmount, phone, remark, nickName } = this.data;

    if (!phone) {
      wx.showToast({ title: '请填写手机号', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '下单中...', mask: true });

    const orderData = {
      items: [{
        productId: product._id,
        productName: product.name,
        imageUrl: product.imageUrl || '',
        price: product.price,
        quantity
      }],
      totalAmount: parseFloat(totalAmount),
      phone,
      remark,
      nickName
    };

    wx.cloud.callFunction({ name: 'createOrder', data: orderData })
      .then(res => {
        const result = res.result;
        if (!result.success) {
          wx.hideLoading();
          wx.showToast({ title: result.errMsg || '下单失败', icon: 'none' });
          return;
        }

        // 仅真实支付，不保留模拟支付回退
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
