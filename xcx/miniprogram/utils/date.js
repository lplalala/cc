/**
 * 日期工具模块
 * 提供日期格式化、月份加减等常用日期操作
 */

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date|string} date - 日期对象或字符串
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date) {
  if (!date) return '';
  if (typeof date === 'string') return date;
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm
 * @param {Date|string} date - 日期对象或字符串
 * @returns {string} 格式化后的日期时间字符串
 */
function formatDateTime(date) {
  if (!date) return '';
  if (typeof date === 'string') return date;
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const h = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

/**
 * 在给定日期上增加指定月数（修复月末溢出问题）
 * @param {string} dateStr - 日期字符串，格式 YYYY-MM-DD
 * @param {number} months - 要增加的月数
 * @returns {string} 计算后的日期字符串
 */
function addMonths(dateStr, months) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1 + months, 1);
  const targetMonth = date.getMonth();
  date.setDate(Math.min(d, new Date(date.getFullYear(), targetMonth + 1, 0).getDate()));
  return formatDate(date);
}

module.exports = { formatDate, formatDateTime, addMonths };
