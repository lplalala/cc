# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目结构

本仓库包含以下独立项目：

- **`pomodoro.html`** — 单文件番茄钟应用，无依赖，浏览器直接打开
- **`xcx/`** — 同进仁华口腔连锁微信小程序（云开发），主要工作区
- **`yjb/`** — 员工月度业绩Excel表（人工录入），每月12人，每人含多sheet（初诊/复诊/洁牙/业绩/义诊等）
- **`check_output/`** — 业绩核对输出目录，每个员工一个Excel + 汇总表
- **`generate_check_excel.py`** — 业绩核对脚本：读取yjb Excel → 调用e看牙API → 对比输出
- **`.claude/skills/dental-secretary/generate_performance_report.py`** — 🆕 **业绩报表生成模块**：直接从系统生成任意员工任意月份业绩表
- **`小程序新需求`** — 业绩核对规则文档（洁牙师映射、核对逻辑、产出目标）
- **`tools/`** — 辅助工具脚本
- **`.claude/skills/dental-secretary/`** — 口腔秘书 Skill（e看牙 API 封装）

### 新增：口腔项目 PDF 数据处理

根目录下的 `process_dental_pdf.py` 用于从手写扫描 PDF 中提取学生数据并填入 Excel 模板。工作流程：
1. 从 PDF 提取 JPEG 图片 → 2. OCR 识别（PaddleOCR/EasyOCR）→ 3. 解析学生信息 → 4. 填充 Excel

关键文件：
- `厦岗小学—儿童口腔疾病综合干预项目登记表(学龄儿童）.pdf` — 8页扫描PDF
- `儿童口腔项目（窝沟封闭）登记表（手工录入） - 副本.xlsx` — Excel模板
- `*_by_PaddleOCR-VL-1.6*.md` — PaddleOCR 识别结果（HTML表格格式）
- `process_dental_pdf.py` — 自动化脚本
- `pdf_pages/` — 从PDF提取的JPEG页面图片
- `extracted_students.json` — 提取的学生数据

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
    createOrder/           #  [商城] 创建订单 + API v2 统一下单（依赖 xml2js）
    handlePaymentCallback/ #  [商城] 支付回调（前端主动调用），更新订单+扣库存
    verifyCode/            #  [商城] 核销（需管理员权限）
    refundOrder/           #  [商城] 退款（需管理员权限，含API证书）
    refundCallback/        #  [商城] 退款回调处理
    deleteOrder/           #  [商城] 删除订单
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
- **支付**：API v2 直连方案（`api.mch.weixin.qq.com/pay/unifiedorder`），MD5 签名，XML 解析。云函数 `createOrder` 依赖 `xml2js`。前端仅走真实支付，不保留模拟支付回退
- **图片**：云存储图片用 `convertCloudUrls()` 转换；商品默认占位图 `/images/default-goods-image.png`
- **挂号**：医生卡片点击展开全屏 Overlay；日期生成 `今天+7天`（不再按周一到周日）；时段分三区（上午3/下午3/晚上3）；三重防过期；`appointments` 强制含 `openid`；查询按 `openid` 非 `phone`
- **样式**：宝矿力主题 `#1A8CFF` / `#FF7F32`；卡片白底 16rpx 圆角；医生卡片姓名与星级间距为 0；医生 Overlay `position:fixed; bottom`
- **质保卡**：京东礼品卡风格深蓝渐变 + 金色；`endDate==='终身'` 或 `is_lifetime` 强制终身显示
- **鉴权**：云函数内查询 `admins` 集合判断 `openid`
- **客服**：仅企业微信客服（`wx.openCustomerServiceChat`），已移除 `open-type="contact"` 原生客服
- **注意事项**：首页四宫格入口，数据复用的 `projectTemplates` 集合（`name`+`noteImages[0]`），profile 页已移除注意事项入口
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
| `attendance-calculator` | 自定义 | **考勤自动计算**（打卡月报→出勤统计） |
| `skill-creator` | 官方 | 创建和优化 Skill |
| `canvas-design` | 官方 | 图片/海报生成 |
| `frontend-design` | 官方 | 前端界面设计 |
| `miniprogram-development` | 系统内置 | 微信小程序开发 |
| `dental-secretary` | 自定义 | **口腔秘书** — 连接领健e看牙API查诊所数据 |
| `silicon-paddle-ocr` | GitHub | PaddleOCR 图片文字识别（SiliconFlow API） |
| `paddleocr-text-recognition` | GitHub | PaddleOCR 文本识别（paddleocr.com API） |

Skills 安装信息记录在 `skills-lock.json`。Skill 文件分布：
- `.claude/skills/` — 自定义 Skill（reconciliation-helper、attendance-calculator、dental-secretary）
- `.agents/skills/` — 官方 Skill 资源文件（xlsx、docx、pdf，通过 symlink 引用）
- `C:\Users\LIN\.claude\skills\` — 通过 `npx skills add` 安装的 Skill（silicon-paddle-ocr、paddleocr-text-recognition）

### OCR 可用工具

- **easyocr**：可通过 `uv run --with easyocr python` 直接运行，模型已缓存于 `~/.EasyOCR/`，支持中英文
- **PaddleOCR skill**：`paddleocr-text-recognition` skill 已安装，需 `PADDLEOCR_OCR_API_URL` + `PADDLEOCR_ACCESS_TOKEN` 环境变量
- **SiliconFlow skill**：`silicon-paddle-ocr` skill 已安装，需 `SILICONFLOW_API_KEY` 环境变量

### reconciliation-helper（对账 Skill）

这是项目中最复杂的自定义 Skill，用于多平台财务对账。六大核心规则：
1. 人工表宽格式（每渠道一列）→ 转长格式
2. 美团/抖音验券时间聚类（多张券→人工一笔总额）
3. 组合支付分析（同患者同日多渠道）
4. 渠道记错检测（如 POS 收钱记到对公）
5. T+N 结算识别（抖音月末延迟）
6. 冲销/作废记录配对

详见 `.claude/skills/reconciliation-helper/SKILL.md`。

### attendance-calculator（考勤 Skill）

自动处理企业微信「上下班打卡_月报」Excel，生成考勤统计报告。核心规则（经多轮审核优化）：

1. **三种班次**：早班 8:50-18:30 / 晚班 10:00-20:30 / 义诊班 7:30-21:00，双端 ±30min 匹配
2. **核心原则**：单次打卡不猜（→缺卡），≥2次打卡有进出才判半天班/早退
3. **半天班**：所有时间在半天区间 ±15min + 跨度 ≥90 分钟 → 上午 0.3 天 / 下午 0.5 天。上下午配对合并 → 1 天
4. **迟到**：上班 > 班次上班 + 离起点 ≤180min（补卡豁免）
5. **早退**：下班 < 班次下班，不限窗口（有进出就能判，补卡豁免）
6. **缺卡**：单 punch / 跨度 <4h 双 punch / 无法匹配班次
7. **乐捐**：¥20/次，同天多异常独立记录

使用方式：`python .claude/skills/attendance-calculator/scripts/calculate.py <输入文件>`

详见 `.claude/skills/attendance-calculator/SKILL.md`。

### dental-secretary（口腔秘书 Skill）

连接**领健 e看牙（LinkedCare）API**，以只读模式查询东莞同进仁华口腔诊所数据。核心能力：

- **患者消费查询**：按病历号查累计消费 + 逐项收费明细
- **经营分析**：预约量/初诊/复诊/到诊率/成交率、环比同比
- **记录完整性检查**：初诊患者是否写了咨询记录 + 病历记录，按医生归类
- **员工业绩核对**：读 Excel → 对照系统收费数据逐行核实

关键坑：
1. **`actualPrice` ≠ `totalPrice`**：收费明细中 `totalPrice` 是折前金额，展示给用户必须用 `actualPrice`（实收）
2. **计费拆分**：系统会拆成多条明细行（如全瓷冠 0.8+0.1+0.1），需按 `(项目名, 牙位)` 归组合并
3. **空行过滤**：`count=0, actualPrice=0` 是治疗计划占位，必须过滤
4. **只读**：绝对不调用 PUT/DELETE 接口

详见 `.claude/skills/dental-secretary/SKILL.md`。

### ⚡ 员工业绩核对（yjb → e看牙）v11

**核心脚本**: `generate_check_excel.py`

**运行流程：**
```bash
# 1. 拉取 e看牙数据（1-6月全覆盖，确保所有5月payDateTime收费不遗漏）
python -c "
import requests, json, threading
from concurrent.futures import ThreadPoolExecutor, as_completed
s = requests.Session()
r = s.post('https://dghljd.linkedcare.cn/LogOn', data={'account':'苏里','password':'Sl159767'}, headers={'X-Requested-With':'XMLHttpRequest'})
td = {}
for c in s.cookies:
    if c.name == 'AresToken': td = json.loads(c.value)
api_host = td['api_host']; at = td['access_token']
h = {'Authorization': f'bearer {at}', 'Content-Type': 'application/json'}
V1 = f'{api_host}/api/v1'
r = s.get(f'{V1}/appointments/search', headers=h, params={'officeId':40,'startTime':'2026-01-01T00:00:00','endTime':'2026-06-30T23:59:59','pageIndex':0,'pageCount':8000})
appts = r.json()
with open('may_appts.json','w',encoding='utf-8') as f: json.dump(appts, f, ensure_ascii=False)
# ...并发拉取收费明细到 may_charges.json
"

# 2. 运行核对
python generate_check_excel.py
# 输出 → check_output/{员工名}_核对表.xlsx（多sheet + 问题汇总sheet）
```

**核心匹配逻辑（v11 最终版）：**

| # | 规则 | 说明 |
|---|------|------|
| 1 | **纯 payDateTime 匹配** | 不看预约时间，只看收费时间。索引: `charge_by_key[(payDateTime, privateId)]` |
| 2 | **收费单状态过滤** | 只取 `status="已收费"`，排除 未收费/已合并撤销/退费 |
| 3 | **医生业绩过滤** | 医生/洁牙师按 `doctorName` + `consultantName` + 注释代码过滤；介绍人/开发人不过滤 |
| 4 | **备注栏代码** | 查 `chargeOrder.comments` 字段：`ld/ql/mm/xq/lq/yl` 及 `qlh/ldh`(洁牙后) |
| 5 | **助手后缀映射** | 动态唯一字符+硬编码（`李胜祥｜曾`=曾祁玲），歧义字符排歧 |
| 6 | **全局搜索仅洁牙师** | 按 comments 代码全月搜索仅对洁牙师启用，医生不用（避免跨患者误匹配） |
| 7 | **跨sheet逐项匹配** | 同(date,pid)在多sheet出现时按治疗项目名匹配，智能选单项or全部 |
| 8 | **POS付款计入** | `count=0` 但 `actualPrice>0` 必须计入 |
| 9 | **退费不算当月** | 退费状态自动排除，应在退款月算负业绩 |
| 10 | **同天多笔合并** | 同一患者同一天多笔收费自动汇总，显示"N笔" |

**洁牙师映射表：** 02→王秀琴, 24→陈柳青, 52→李丹, 88→毛登镕, 27→吴越乐, 68→曾祁玲

**缩写映射表：** ld→李丹, ql→曾祁玲, mm→毛登镕, xq→王秀琴, lq→陈柳青, yl→吴越乐

详见 `.claude/skills/dental-secretary/SKILL.md` 和 `memory/performance-check-rules.md`。

### 🆕 业绩报表生成模块

```bash
# 直接从系统生成业绩表（无需yjb Excel模板）
python .claude/skills/dental-secretary/generate_performance_report.py <员工名> <开始日期> <结束日期>

# 示例
python .claude/skills/dental-secretary/generate_performance_report.py 曾祁玲 2026-06-01 2026-06-20
python .claude/skills/dental-secretary/generate_performance_report.py 李丹 2026-06-01 2026-06-30 check_output/李丹_6月.xlsx
```

模块内置全部11条核对规则，自动拉数据→建索引→过滤→输出Excel。

## 重要规则

1. **禁止 C 盘操作**：所有安装、下载、缓存必须在 D 盘。npm 缓存已设在 `D:\npm-cache`
2. **中文交互**：所有确认、询问永远使用中文
3. **临时文件清理**：对账分析完成后删除临时 Python 脚本，只保留报告
4. **数据安全**：Excel 财务数据只在本地处理，不上传任何外部服务
