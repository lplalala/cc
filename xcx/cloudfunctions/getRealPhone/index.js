const cloud = require('wx-server-sdk');
cloud.init({
  env: 'cloud1-1g26c0bcee3c74ed'  // 例如 cloud1-xxxxx
});

exports.main = async (event, context) => {
  // 获取从小程序端传来的 code
  const { code } = event;

  if (!code) {
    return { success: false, errMsg: '缺少code参数' };
  }

  try {
    // 调用微信开放接口，用 code 换取手机号
    const result = await cloud.openapi.phonenumber.getPhoneNumber({
      code: code
    });
    
    // 返回手机号信息
    return {
      success: true,
      phoneInfo: result.phoneInfo  // 包含 phoneNumber, purePhoneNumber, countryCode 等
    };
  } catch (err) {
    console.error('换取手机号失败:', err);
    return {
      success: false,
      errMsg: err.message
    };
  }
};