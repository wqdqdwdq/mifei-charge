# 米菲记账 (Miffy Charge) — 个人记账网站

简单可爱的个人记账网站，采用米菲（Miffy / Dick Bruna）主题风格，支持手机与电脑浏览器访问。支持多用户、资金模块自动扣减、家庭只读互看、月度统计等。

## 技术栈

- **前端**：HTML5 + CSS3 + Vanilla JavaScript（单页应用，hash 路由）
- **后端**：Node.js + Express
- **数据库**：**PostgreSQL**（早期基于 SQLite，已通过 `server/migrate-to-pg.js` 迁移；驱动 `pg`）
- **认证**：JWT（Bearer Token）+ bcryptjs
- **部署**：nginx 反向代理 + systemd 服务

## 功能特性

- 收入 / 支出快速记账，账单查询、修改、删除（自动恢复模块金额）
- 自定义资金模块（月度自动扣减，余额不足温和提醒）
- 收支分类管理（预置分类 + 自定义，可隐藏）
- 月度收支统计：趋势折线图、分类占比、资金模块使用环图
- 家庭模块：**6 位邀请码授权、配对账号间只读互看账单**（严格越权防护，不可跨用户增删改）
- 米菲主题清新界面，手机 / 平板 / 电脑全响应式适配（统计页已针对移动端竖排重排）
- 多用户数据隔离（每用户独立账本）
- PWA 支持（manifest + Service Worker 离线缓存）

## 快速开始

### 环境要求

- Node.js >= 18（推荐 20）
- PostgreSQL >= 14

### 本地开发

```bash
# 1. 进入项目目录
cd miffy-account

# 2. 安装依赖
npm install

# 3. 准备 PostgreSQL 数据库（示例）
createdb miffy
psql -c "CREATE USER miffy WITH PASSWORD '你的密码';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE miffy TO miffy;"

# 4. 配置数据库连接（二选一）
#    a) 设置环境变量 DATABASE_URL
export DATABASE_URL=postgres://miffy:你的密码@127.0.0.1:5432/miffy
#    b) 或在 deploy/miffy-backend.service 的 Environment 中填写

# 5. 启动后端 API（127.0.0.1:8080）
npm start
#    或 node server/index.js

# 6. 另开终端，启动前端静态服务（127.0.0.1:8081）
node frontend-server.js
```

启动后访问：

- 前端页面：http://localhost:8081
- 后端 API：http://localhost:8080

> 首次启动后端会自动建表并初始化；每个注册用户会自动创建默认收支分类。

## 项目结构

```
miffy-account/
├── server/                     # 后端服务（Node.js + Express）
│   ├── index.js               # API 服务器入口（127.0.0.1:8080）
│   ├── db.js                  # PostgreSQL 连接与初始化
│   ├── auth.js                # JWT 认证中间件
│   ├── periodUtil.js          # 资金模块周期（月度）自动重置逻辑
│   ├── migrate-to-pg.js       # SQLite → PostgreSQL 迁移脚本
│   ├── data/                  # 运行时数据（PG 下为空，不入库）
│   ├── uploads/               # 用户上传文件（头像 / 模块图标，不入库）
│   └── routes/
│       ├── auth.js            # 注册 / 登录 API
│       ├── bills.js           # 账单 CRUD API
│       ├── categories.js      # 分类管理 API
│       ├── modules.js         # 资金模块 API
│       ├── stats.js           # 统计分析 API
│       └── family.js          # 家庭模块 API（只读互看 + 邀请码）
├── public/                    # 前端源码（SPA）
│   ├── index.html             # SPA 入口（依次加载 miffy.js / api.js / app.js）
│   ├── css/style.css          # 米菲主题样式（含移动端适配）
│   ├── js/
│   │   ├── miffy.js           # 米菲 SVG 插图素材库
│   │   ├── api.js             # API 客户端（baseURL 带 /mifei-charge/api 子路径）
│   │   └── app.js             # 主应用逻辑（真正运行的前端）
│   ├── sw.js                  # Service Worker（PWA 离线）
│   └── manifest.json          # PWA 清单
├── deploy/                    # 部署配置
│   ├── setup.sh               # 服务器一键部署（Debian 12）
│   ├── nginx-miffy.conf       # nginx 反向代理模板
│   ├── miffy-backend.service  # systemd 后端服务（8080，含 DATABASE_URL）
│   └── miffy-frontend.service # systemd 前端服务（8081）
├── frontend-server.js         # 前端静态服务（127.0.0.1:8081）
├── AGENTS.md                  # 开发者 / AI 编码约束
├── DEPLOY.md                  # 服务器部署与运维备忘
├── package.json
├── .gitignore
└── README.md
```

## 数据库

使用 **PostgreSQL**（库名 `miffy`，用户 `miffy`）。连接串通过环境变量 `DATABASE_URL` 提供，例如：

```
postgres://miffy:密码@127.0.0.1:5432/miffy
```

后端启动后自动建表并初始化。本项目早期基于 SQLite（better-sqlite3），已通过 `server/migrate-to-pg.js` 迁移至 PostgreSQL，迁移脚本保留在仓库中备查。

> 备份示例（服务器端）：
> `pg_dump -U miffy miffy > miffy_$(date +%F).sql`

## 家庭模块（只读互看）

家庭模块允许两个账号**配对后互相查看账单**，设计为严格的「只读」：

- **邀请码绑定**：在「家庭」页生成 6 位随机邀请码（10 分钟过期、防重复使用、不可自绑）；对方在「家庭」页输入邀请码即可建立**双向**绑定（双方各写一条授权记录）。
- **权限边界**：所有读取对方数据的接口都前置校验「对方 → 我」的 accepted 记录，否则返回 403；绑定解除时双向记录同删。
- **安全铁律**：家庭接口**只读取、绝不修改**对方数据；任何跨用户的增删改都走各自 `user_id` 隔离的常规接口，不存在接受客户端传入他人 `user_id` 的通道。

## 页面结构

| 页面 | 路径 | 说明 |
|------|------|------|
| 登录 / 注册 | / | 用户认证 |
| 首页 | #/home | 月度概览、快速记账、资金模块卡片 |
| 记账 | #/add | 收入 / 支出快速录入 |
| 账单列表 | #/bills | 筛选、搜索、查看详情 |
| 资金模块 | #/modules | 创建、编辑、查看模块 |
| 统计 | #/stats | 月度收支、分类占比、趋势图（移动端竖排重排） |
| 家庭 | #/family | 生成 / 输入邀请码、查看对方账单（只读） |
| 分类管理 | #/categories | 新增、显示 / 隐藏分类 |
| 我的 | #/mine | 个人信息、修改密码 |

## 统计页移动端适配

统计页含 4 个图表（趋势折线、支出饼图、收入饼图、模块环图）。在微信等移动浏览器中，大 `viewBox` 的 SVG 不会被自动缩放、会保留内在宽度撑破布局。已通过 **JS 层包裹 `.stats-charts-grid`（flex 竖排）+ CSS 锁死宽度** 解决，而非简单 `overflow` 裁剪。

## 资金模块扣减逻辑

- 记录支出 → 自动扣除对应模块金额
- 修改支出 → 先恢复原模块，再扣除新模块
- 删除支出 → 恢复对应模块金额
- 月度周期（monthly）跨月自动清零 `spent_amount`，保留 `budget_amount`
- 余额不足 → 温和提醒，允许继续（显示负数）

## 生产部署

在 Debian 12 服务器（以 root）执行一键部署：

```bash
bash deploy/setup.sh
```

脚本会安装 Node 20、nginx，配置 systemd 服务并启动：

- **miffy-backend**（后端 API）：`127.0.0.1:8080`，由 `DATABASE_URL` 连接 PostgreSQL
- **miffy-frontend**（前端静态）：`127.0.0.1:8081`
- **nginx**：对外反向代理，对外入口为子路径 `http://8.134.189.32/mifei-charge/`
  - 前端资源与 API 经该子路径分发（`/mifei-charge/` → 8081，API 前缀 `/mifei-charge/api` → 8080）
  - 前端 `public/js/api.js` 的 `baseURL` 必须为 `/mifei-charge/api`（部署在子路径下，否则会打到错误端口）

> 部署前请将 `deploy/miffy-backend.service` 中的 `DATABASE_URL` 密码 `CHANGE_ME` 替换为真实数据库密码；`JWT_SECRET` 也应通过 `Environment` 注入（请勿依赖代码默认值）。

## 配色方案（米菲主题）

- 奶油白 #FFFBF5
- 柔和粉 #FF9FB5
- 淡蓝 #93B5E1
- 浅黄 #FFE8A0
- 鼠尾草绿 #B5C9A8
- 暖棕文字 #5A4A3A

## .gitignore 约定

以下文件不入库：

- `node_modules/`
- `server/data/`（数据库，PG 下为空）、`*.db*` 历史残留
- `server/uploads/`（用户上传）
- `.env`、`.env.local`（密钥）
- 系统文件 `.DS_Store`、`Thumbs.db`
