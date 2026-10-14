# 服装管理平台 · MVP v0.2.1

以「款」为中心的数据底座 + 样衣管理台 + 回复模板库。Node + SQLite，单人维护。

## 启动

```bash
cd fashion-manager/server
npm install
npm start
```

浏览器打开 http://localhost:3100（手机浏览器打开同一地址即可，页面为手机端优先）。

数据存在 `server/data/garment.db`，样衣照片在 `server/data/uploads/`。
改端口：`PORT=8080 npm start`。

## MVP 功能

- **款档案**：新建款自动生成款号（`26S-DR-001`，规则：年2+季1+类2+流水3），状态流转 设计中→样衣中→已确认（只能向前推）
- **版次管理**：V1/V2/V3…，改版说明；新版次可一键复制上一版的尺寸/面辅料/工艺/照片
- **样衣录入**：尺寸表（动态增删部位）、面辅料明细（名称/部位/用量/单价/供应商）、工艺描述、批版意见、拍照上传（自动压缩）
- **报价单**：从面辅料+工费自动汇总成本，利润率可调，最终报价可手动改；一键复制报价文本（落款 Yingzi），粘到阿里/微信即用
- **全局搜索**：顶层按款号/款名搜索；左侧四台导航（设计/样衣/模板/制版，对标 SoulChat 侧边栏：桌面端可收起，移动端为左侧抽屉），设计台与制版台为二期占位

## v0.2.1
- 导航栏从底部改到左侧（用户反馈底部别扭），对标 SoulChat 侧边栏布局

## v0.2.0 新增：回复模板库

- **模板管理**：按语言（EN/ES/PT/FR/DE/AR）× 场景（首回/追问/报价/跟进）筛选；种子模板来自过去一周 22 个买家档案的现成草稿（定稿版），开服表空时自动灌入；支持新增/编辑/删除自定义模板；种子删了可一键重建（`POST /api/reply-templates/reseed`）
- **填空位**：`{{buyer_name}} {{product}} {{price}} {{lead_time}} {{quantity}} {{country}} {{size}} {{color}}`；详情页按模板实际用到的位动态生成表单，实时预览
- **红线**：模板含 `{{price}}` / `{{lead_time}}` 时，空着不许复制发出——前端复制按钮置灰 + toast，后端 `POST /api/reply-templates/:id/render` 直接 400
- **跟进模板**：EN/ES/PT/FR/AR 各一条通用三段式（叫出名字→给一条图上看不到的信息→只问两个低门槛问题）

## 二期（未做）

AI 改款出图（POST /api/redesign 三步流水线，见方案）、公式计算器、纸样库、设计台/制版台页面。

## API 一览

- `GET /api/config` · `GET /api/garments?q=` · `POST /api/garments` · `GET /api/garments/:id`
- `PATCH /api/garments/:id`（状态推进）· `POST /api/garments/:id/versions`
- `PUT /api/samples/:id` · `POST /api/samples/:id/photos`（base64）
- `POST /api/quotations` · `GET/PUT /api/quotations/:id` · `GET /api/quotations/:id/text`
- `GET /api/reply-templates?lang=&scene=` · `GET/POST /api/reply-templates` · `GET/PUT/DELETE /api/reply-templates/:id`
- `POST /api/reply-templates/:id/render`（填空渲染；价格/交期缺失报 400）· `POST /api/reply-templates/reseed`（种子重建）
