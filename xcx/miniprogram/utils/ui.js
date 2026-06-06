/**
 * UI交互工具模块
 * 提供统一的弹窗、提示等交互封装
 */

/**
 * Promise 版本的 wx.showModal
 * @param {Object} opts - 同 wx.showModal 参数
 * @returns {Promise<Object>} resolve 时返回 { confirm, cancel }
 */
function showModalAsync(opts) {
  return new Promise((resolve) => {
    wx.showModal({
      ...opts,
      success: (res) => {
        resolve({ ...res, confirm: res.confirm, cancel: !res.confirm });
      },
      fail: () => resolve({ confirm: false, cancel: true })
    });
  });
}

/**
 * 统一的错误提示
 * @param {Error|string} err - 错误对象或消息
 * @param {string} fallbackMsg - 兜底提示文字
 */
function showError(err, fallbackMsg) {
  console.error(err);
  const msg = typeof err === 'string' ? err : (err.message || fallbackMsg || '操作失败，请重试');
  wx.showToast({ title: msg, icon: 'none' });
}

/**
 * 显示加载中
 * @param {string} title - 加载文字
 */
function showLoading(title) {
  wx.showLoading({ title: title || '加载中...', mask: true });
}

/**
 * 隐藏加载中
 */
function hideLoading() {
  wx.hideLoading();
}

/**
 * 统一的 Toast（返回 Promise）
 * @param {string} title
 * @param {string} icon
 */
function showToastAsync(title, icon) {
  return new Promise(resolve => {
    wx.showToast({ title, icon: icon || 'none', duration: 1500, success: resolve, fail: resolve });
  });
}

module.exports = { showModalAsync, showError, showLoading, hideLoading, showToastAsync };
