/**
 * 日期工具模块
 * 提供日期格式化、月份加减等常用日期操作
 */

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date} date - 日期对象
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 在给定日期上增加指定月数（修复月末溢出问题）
 * @param {string} dateStr - 日期字符串，格式 YYYY-MM-DD
 * @param {number} months - 要增加的月数
 * @returns {string} 计算后的日期字符串
 */
function addMonths(dateStr, months) {
  const [y, m, d] = dateStr.split('-').map(Number);
  // 先取目标月份的第一天，再 setDate 夹到实际最大天数，避免月末溢出
  const date = new Date(y, m - 1 + months, 1);
  const targetMonth = date.getMonth();
  date.setDate(Math.min(d, new Date(date.getFullYear(), targetMonth + 1, 0).getDate()));
  return formatDate(date);
}

module.exports = { formatDate, addMonths };
