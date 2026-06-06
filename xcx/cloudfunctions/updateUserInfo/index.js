const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-1g26c0bcee3c74ed' });

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { nickName, avatarUrl } = event;

  if (!nickName && !avatarUrl) {
    return { success: false, errMsg: '没有要更新的内容' };
  }

  // 检查用户是否已有记录
  const userRes = await db.collection('users').where({ openid }).get();
  if (userRes.data.length > 0) {
    // 更新
    await db.collection('users').where({ openid }).update({
      data: {
        ...(nickName && { nickName }),
        ...(avatarUrl && { avatarUrl }),
        updatedAt: new Date()
      }
    });
  } else {
    // 新增
    await db.collection('users').add({
      data: {
        openid,
        nickName: nickName || '',
        avatarUrl: avatarUrl || '',
        createdAt: new Date()
      }
    });
  }
  return { success: true };
};