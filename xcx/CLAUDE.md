# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

同进仁华口腔连锁微信小程序，基于**微信云开发**（CloudBase），原生框架无第三方依赖。
涵盖功能：首页展示、**医生点击展开预约**（全屏 Overlay 内完成挂号）、质保卡查询（京东礼品卡风格）、线上商城（商品浏览→下单→支付→核销）、后台管理。

## 开发环境

- 使用**微信开发者工具**打开 `xcx/` 目录，无需 `npm install` 或构建步骤
- 云函数部署：在开发者工具中右键云函数目录 →「上传并部署：云端安装依赖」
- 本项目是 `D:\Desktop\first-cc\` 的子目录，父目录下的 `pomodoro.html` 等文件与本项目无关

## 架构概览

```
xcx/
  cloudfunctions/           # 云函数（Node.js，wx-server-sdk）
    getOpenId/              #  获取用户 openid
    getRealPhone/           #  手机号授权解密
    updateUserInfo/         #  更新用户昵称
    quickstartFunctions/    #  精简后仅保留 getOpenId
    createOrder/            #  [商城] 创建订单 + cloudpay统一下单
    handlePaymentCallback/  #  [商城] 支付回调，生成核销码，扣库存
    verifyCode/             #  [商城] 核销确认（需管理员权限）
    refundOrder/            #  [商城] 退款处理（需管理员权限）
  miniprogram/
    app.js                  # 入口：云环境初始化 + openid获取(含storage持久化) + 管理员判断
    app.json                # 页面路由 + TabBar（首页/商城/我的）
    app.wxss                # 全局设计 Token（CSS 变量风格，宝矿力主题）
    utils/
      cloud.js              #  convertCloudUrls() — cloud:// → 临时链接
      date.js               #  formatDate()、addMonths()（修正月末溢出）
      db.js                 #  COLLECTIONS 常量 — 统一管理12个集合名
      config.js             #  ENV_ID / CLINIC_LOCATION / WECOM_CS / PAYMENT_CONFIG / SHOP_CATEGORIES
      ui.js                 #  showModalAsync() / showError() / showLoading() / hideLoading() / showToastAsync()
    components/
      tooth-chart/          # 牙位图组件（交互/静态双模式）
    pages/
      index/                # 首页：轮播图 + 四宫格(Grid) + 医生卡片(点击展开Overlay预约)
      auth/                 # 授权页
      query/                # 质保卡查询入口→自动跳转
      selectPatient/        # 按手机号选就诊人
      warrantyCard/         # 电子质保卡（深蓝渐变+金色+终身徽章+种植牙分项+Flex牙位图）
      warrantyForm/         # 质保卡新增/编辑
      booking/              # 自助挂号（日历网格+两列时段+余量，防过期拦截）
      createPatient/        # 新增就诊人（校验：姓名非空/年龄1-120/手机11位，返回确认）
      profile/              # 个人中心（两行紧凑预约卡片+就诊人+注意事项+我的订单）
      admin/                # 后台管理（8 Tab按需加载，挂号Tab含日期筛选picker）
        productForm/        #  商品新增/编辑表单
      shop/                 # 商城
        index/              #  商城首页
        confirm/            #  下单确认（纯云函数支付，isMock开关）
        orderSuccess/       #  支付成功（6位核销码）
        orders/             #  订单列表（_openid查询）
        orderDetail/        #  订单详情（核销码+退款）
```

## 核心开发模式

### 页面标准写法

```javascript
const db = wx.cloud.database();
const { COLLECTIONS } = require('../../utils/db');
Page({
  data: { /* 初始数据 */ },
  onLoad() { /* 数据加载 */ },
});
```

### 数据库操作

- 所有集合名通过 `COLLECTIONS` 常量引用，不可硬编码字符串
- 云存储图片先用 `convertCloudUrls()` 转换再渲染
- 商品默认占位图：`/images/default-goods-image.png`

### 性能优化原则

- **按需加载**：admin 后台 8 个 Tab，仅加载当前 Tab 所需集合（`loadTabData(idx)` 而非全量 `loadAllData()`）
- **并行查询**：首页等页面用 `Promise.all([...]).finally()` 而非串行 `.then()`
- **脏标记**：profile 页 `onShow` 首次全量加载，后续仅刷新高频数据（预约+就诊人）
- **图片懒加载**：轮播图/头像加 `lazy-load="true"` 属性
- **避免无效 setData**：合并 `setData` 调用，不在循环中频繁调用

### 云函数鉴权模式

```javascript
const adminRes = await db.collection('admins').where({ openid }).get();
if (adminRes.data.length === 0) return { success: false, errMsg: '无权限' };
```

### 支付流程（纯云函数方案）

```
createOrder → cloud.cloudPay.unifiedOrder / mock → wx.requestPayment → handlePaymentCallback → 生成6位核销码
```
- `PAYMENT_CONFIG.isMock: true` → 开发阶段模拟支付（`confirm.js` 中的 `mockPay()`）
- `PAYMENT_CONFIG.isMock: false` → 真实微信支付（云函数调 `cloud.cloudPay.unifiedOrder`）
- 核销码6位，字段名 `verify_code`，订单查询用 `_openid` 字段

### 医生展开预约 Overlay 模式

点击首页医生卡片 → 全屏 Overlay（`position: fixed; bottom; border-radius 32rpx`），结构：
- **上部**：医生头像+姓名+职称+星级+擅长标签
- **下部**：就诊人选择（横滑chip，点击 `＋新建` **跳转 `createPatient` 独立页面**）→ 7天日历（默认选中今天）→ 两列时段（上午 3 个 / 下午 6 个，每个 1 小时，9:00-20:00）
- **确认**：点击确认挂号 → 弹温馨提示（仅提示不阻断）→ `try/catch + await` 写入 `appointments` 集合（强制含 `doctorId/doctorName/doctorTitle/openid`，10 秒超时保护）

### 挂号防过期机制（三重防御）

1. **日历 UI**：`generateWeek()` 用 `YYYY-MM-DD` 格式比较生成 `isPast` 标记，过去日期 `pointer-events: none`（**不可用 `toDateString()` 比较，字典序含星期几会错乱**）
2. **时段过滤**：选中今天时 `filterPastSlots()` 滤掉已过时段；切到非今天时 `resetSlots()` 清除所有 `isPast` 标记
3. **提交校验**：`confirmBooking()` 在数据库写入前二次校验日期+时段，防止篡改绕过

### 挂号归属权

- 写入 `appointments` 时强制存 `openid: getApp().globalData.openid`（下单人）
- `profile.js loadBookings()` 按 `openid` 查询（**不是 phone**），确保用户看到自己代他人挂的号

### 就诊人创建（createPatient 页面）

- 三个必填项：姓名（非空）、年龄（1-120）、手机号（11位 `1\d{10}`）
- "保存并返回"大按钮；写入 `patients` 后存 `_newPatientId` 到 `globalData`
- 返回时 `onShow` 自动刷新列表并选中新建就诊人
- 顶部返回：若有输入则弹「信息未保存，是否退出？」确认

### 质保卡过期逻辑

`warrantyCard.js` 的 `processCard()` 逐项判断：
- `endDate === '终身'` 或 `is_lifetime === true` → 强制显示「♾️ 终身质保」
- 有子项目时仅全部子项过期才标「已过期」，植体终身则不标过期
- 卡片使用京东礼品卡风格：深蓝渐变 + 金色标题 + Flex 左右布局（文字flex:1 + 牙位图固定130rpx）

### 后台管理挂号筛选

- admin Tab 4（挂号记录）：顶部 `picker mode="date"`，默认当天
- 数据加载后存 `allAppointments`，经 `filterAppointments()` 筛选到 `filteredAppointments`
- picker 返回值 `YYYY-MM-DD` 需转换为 `M月D日` 格式匹配数据库中的 `date` 字段
- 空态显示"当天无预约记录"

### 个人中心预约卡片

- profile 页预约列表：每卡片两行紧凑布局
- 第一行：医生名+职称（左）| 日期+时段（右），加粗
- 第二行：就诊人姓名（左）| 状态标签（右），彩色圆角（待就诊蓝/已就诊绿/已取消灰）

## 数据库集合

| 集合名 | 用途 | 关键字段 |
|--------|------|----------|
| `admins` | 管理员 | `openid` |
| `banners` | 首页轮播图 | `imageUrl` |
| `navConfig` | 首页导航 | `type`, `id` |
| `doctors` | 医生 | `name`, `title`, `rating`, `specialties` |
| `warrantyCards` | 质保卡 | `queryNo`, `patientName`, `warrantyItems` |
| `patients` | 就诊人 | `openid`, `name`, `phone` |
| `appointments` | 挂号记录 | `patientId`, `doctorId`, `doctorName`, `date`, `time`, `openid`, `status` |
| `users` | 用户 | `openid`, `nickName`, `phone` |
| `projectTemplates` | 质保项目模板 | `name`, `noteImages`, `subItems` |
| `products` | 商城商品 | `status`, `categoryId`, `price` |
| `orders` | 商城订单 | `_openid`, `status`, `verify_code` |

## UI 设计规范

宝矿力 POCARI SWEAT 清新风格：
- 主色 `#1A8CFF`、强调色 `#FF7F32`、页面背景 `#F5F7FA`
- 卡片：白色背景 + 16rpx 圆角 + `0 4rpx 16rpx rgba(0,0,0,0.06)` 阴影
- 文字：`#1A1A1A`(主) / `#666`(次) / `#999`(辅)
- 医生卡片：100rpx头像 + `padding: 28rpx 24rpx` + 简介 `-webkit-line-clamp: 2` 截断
- 四宫格等网格使用 CSS Grid（`grid-template-columns: repeat(2, 1fr)`）
- 质保卡使用深蓝渐变（`#1A6FB0 → #0A3B5A`）+ 金色（`#D4AF37`）
