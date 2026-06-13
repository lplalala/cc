/**
 * 全局配置模块
 * 集中管理环境ID、诊所信息等常量
 */

const ENV_ID = 'cloud1-1g26c0bcee3c74ed';

const APP_NAME = '同进仁华口腔';

const CLINIC_LOCATION = {
  latitude: 23.030804,
  longitude: 113.983771,
  name: '同进仁华口腔连锁',
  address: '广东省东莞市横沥镇育才路御河湾商铺115号'
};

/** 企业微信客服配置 */
const WECOM_CS = {
  url: 'https://work.weixin.qq.com/kfid/kfcd93980fede4fe9f9',
  corpId: 'ww919512198efa1baf'
};

/** 微信支付配置 */
const PAYMENT_CONFIG = {
  /** 模拟支付开关：true=开发阶段跳过真支付，false=走真实微信支付 */
  isMock: false,
  /** 微信支付商户号（isMock=false 时必须填写） */
  mchId: '1746314749',
  /** 支付回调云函数名 */
  callbackFunction: 'handlePaymentCallback',
};

/** 商城商品分类 */
const SHOP_CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'oral_care', name: '洁牙' },
  { id: 'whitening', name: '美白' },
  { id: 'implant', name: '种植' },
  { id: 'restoration', name: '修复' },
  { id: 'pediatric', name: '儿童齿科' },
];

/** 商品类型 */
const PRODUCT_TYPES = [
  { value: 'service', label: '服务类' },
  { value: 'physical', label: '实物类' },
];

/** 配送方式 */
const DELIVERY_METHODS = [
  { value: 'pickup', label: '到店自取' },
  { value: 'express', label: '快递配送' },
];

module.exports = {
  ENV_ID, APP_NAME, CLINIC_LOCATION, WECOM_CS, PAYMENT_CONFIG,
  SHOP_CATEGORIES, PRODUCT_TYPES, DELIVERY_METHODS
};
