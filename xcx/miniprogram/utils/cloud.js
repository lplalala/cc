/**
 * 云存储工具模块
 * 集中处理 cloud:// 临时链接转换等云存储相关操作
 */

/**
 * 将列表中 cloud:// 开头的云文件链接批量转换为临时链接
 * @param {Array} list - 数据列表
 * @param {string} fieldName - 需要转换的字段名
 * @returns {Promise<Array>} 转换后的列表
 */
function convertCloudUrls(list, fieldName) {
  if (!list || list.length === 0) return Promise.resolve(list);

  const fileIDs = [];
  list.forEach(item => {
    if (item[fieldName] && item[fieldName].startsWith('cloud://')) {
      fileIDs.push(item[fieldName]);
    }
  });

  if (fileIDs.length === 0) return Promise.resolve(list);

  return wx.cloud.getTempFileURL({ fileList: fileIDs }).then(res => {
    const fileList = res.fileList;
    list.forEach(item => {
      const found = fileList.find(f => f.fileID === item[fieldName]);
      if (found && found.tempFileURL) {
        item[fieldName] = found.tempFileURL;
      }
    });
    return list;
  });
}

module.exports = { convertCloudUrls };
