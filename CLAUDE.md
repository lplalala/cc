# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目结构

本仓库包含两个独立项目：

- **`pomodoro.html`** — 单文件番茄钟应用，无依赖，浏览器直接打开
- **`xcx/`** — 同进仁华口腔连锁微信小程序（云开发），主要工作区

另有财务对账相关的 Excel 文件（`交易明细_*.xls`）会临时出现在根目录。

## xcx 微信小程序

基于**微信云开发**（CloudBase），原生框架无第三方依赖。涵盖：首页展示、医生点击展开预约（全屏 Overlay）、质保卡查询、线上商城（浏览→下单→支付→核销）、后台管理。

### 开发环境

- 使用**微信开发者工具**打开 `xcx/` 目录，无需 `npm install`
- 云函数部署：右键云函数目录 →「上传并部署：云端安装依赖」
- 根目录的 `pomodoro.html` 等文件与小程序无关

### 架构

```
xcx/
  cloudfunctions/          # 云函数（Node.js，wx-server-sdk）
    getOpenId/             #  获取用户 openid
    getRealPhone/          #  手机号授权解密
    updateUserInfo/        #  更新用户昵称
    createOrder/           #  [商城] 创建订单 + 统一下单
    handlePaymentCallback/ #  [商城] 支付回调，生成核销码，扣库存
    verifyCode/            #  [商城] 核销（需管理员权限）
    refundOrder/           #  [商城] 退款（需管理员权限）
  miniprogram/
    app.js                 # 云环境初始化 + openid获取 + 管理员判断
    app.json               # 页面路由 + TabBar（首页/商城/我的）
    app.wxss               # 全局设计 Token（宝矿力主题）
    utils/
      cloud.js             # convertCloudUrls() — cloud:// → 临时链接
      date.js              # formatDate()、addMonths()
      db.js                # COLLECTIONS 常量 — 12个集合名
      config.js            # ENV_ID / CLINIC_LOCATION / 支付配置 / 商城分类
      ui.js                # Modal/Toast 封装
    components/
      tooth-chart/         # 牙位图组件（交互/静态双模式）
    pages/
      index/               # 首页：轮播图 + 四宫格 + 医生卡片
      booking/             # 挂号：日历网格 + 两列时段 + 余量
      shop/                # 商城：商品→下单→支付→核销
      warrantyCard/        # 电子质保卡（京东礼品卡风格）
      profile/             # 个人中心
      admin/               # 后台（8 Tab按需加载 + 商品/订单管理）
```

### 核心开发规范

- **数据库**：集合名通过 `COLLECTIONS` 常量引用，不可硬编码字符串
- **性能**：admin 后台按需加载 Tab 数据；首页 `Promise.all()` 并行查询；合并 `setData` 调用
- **支付**：`PAYMENT_CONFIG.isMock` 控制模拟/真实支付；核销码 6 位，字段名 `verify_code`
- **图片**：云存储图片用 `convertCloudUrls()` 转换；商品默认占位图 `/images/default-goods-image.png`
- **挂号**：医生卡片点击展开全屏 Overlay；`+新建` 跳转独立页面；`try/catch+await` 写入 + 10s 超时；三重防过期（日历UI禁用+时段过滤+提交校验）；`appointments` 强制含 `openid` 字段；查询按 `openid` 非 `phone`
- **样式**：宝矿力主题 `#1A8CFF` / `#FF7F32`；卡片白底 16rpx 圆角；医生 Overlay `position:fixed; bottom`；时段上午3个/下午6个各1小时（9:00-20:00）
- **质保卡**：京东礼品卡风格深蓝渐变 + 金色；`endDate==='终身'` 或 `is_lifetime` 强制终身显示
- **鉴权**：云函数内查询 `admins` 集合判断 `openid`
- **后台**：admin Tab 4 挂号记录含日期筛选 picker，`YYYY-MM-DD` → `M月D日` 格式转换
- **个人中心**：预约卡片两行紧凑布局；状态彩色标签

详细架构见 `xcx/CLAUDE.md`。

## Skills（AI 技能）

项目安装了以下 Claude Code Skills：

| Skill | 来源 | 用途 |
|-------|------|------|
| `xlsx` | 官方 | 读写 Excel |
| `docx` | 官方 | 读写 Word |
| `pdf` | 官方 | PDF 处理（Snyk 标记 High Risk） |
| `reconciliation-helper` | 自定义 | **多平台财务对账**（核心工具） |
| `skill-creator` | 官方 | 创建和优化 Skill |
| `canvas-design` | 官方 | 图片/海报生成 |
| `frontend-design` | 官方 | 前端界面设计 |
| `miniprogram-development` | 系统内置 | 微信小程序开发 |

Skills 安装信息记录在 `skills-lock.json`。

### reconciliation-helper（对账 Skill）

这是项目中最复杂的自定义 Skill，用于多平台财务对账。六大核心规则：
1. 人工表宽格式（每渠道一列）→ 转长格式
2. 美团/抖音验券时间聚类（多张券→人工一笔总额）
3. 组合支付分析（同患者同日多渠道）
4. 渠道记错检测（如 POS 收钱记到对公）
5. T+N 结算识别（抖音月末延迟）
6. 冲销/作废记录配对

详见 `.claude/skills/reconciliation-helper/SKILL.md`。

## 重要规则

1. **禁止 C 盘操作**：所有安装、下载、缓存必须在 D 盘。npm 缓存已设在 `D:\npm-cache`
2. **中文交互**：所有确认、询问永远使用中文
3. **临时文件清理**：对账分析完成后删除临时 Python 脚本，只保留报告
4. **数据安全**：Excel 财务数据只在本地处理，不上传任何外部服务
