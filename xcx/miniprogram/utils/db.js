/**
 * 数据库集合名称常量
 * 统一管理所有集合名，避免硬编码字符串散落各处
 */

const COLLECTIONS = {
  BANNERS: 'banners',
  NAV_CONFIG: 'navConfig',
  DOCTORS: 'doctors',
  WARRANTY_CARDS: 'warrantyCards',
  PATIENTS: 'patients',
  APPOINTMENTS: 'appointments',
  USERS: 'users',
  PROJECT_TEMPLATES: 'projectTemplates',
  ADMINS: 'admins',
  // 商城模块
  PRODUCTS: 'products',
  ORDERS: 'orders',
  VERIFICATION_CODES: 'verificationCodes',
};

module.exports = { COLLECTIONS };
