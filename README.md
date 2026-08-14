# 米菲记账 - 个人记账网站

简单可爱的个人记账网站，采用米菲主题风格，支持手机和电脑浏览器访问。

## 技术栈

- **前端**: HTML5 + CSS3 + Vanilla JavaScript (SPA)
- **后端**: Node.js + Express
- **数据库**: SQLite (better-sqlite3)
- **认证**: JWT + bcryptjs

## 功能特性

- 收入/支出快速记账
- 自定义资金模块（自动扣减）
- 收支分类管理（预置分类 + 自定义）
- 账单查询、修改、删除（自动恢复模块金额）
- 月度收支统计（趋势图、分类占比、模块使用）
- 米菲主题清新界面
- 手机/平板/电脑全响应式适配
- 用户数据隔离

## 快速开始

### 环境要求

- Node.js >= 16
- npm >= 7

### 安装与运行

```bash
# 1. 进入项目目录
cd miffy-account

# 2. 安装依赖
npm install

# 3. 启动服务器
npm start
```

启动后访问：

- **本机访问**: http://localhost:3300
- **手机端访问**: http://<你的电脑IP>:3300

### 手机端同网段访问

确保手机和电脑在同一个 Wi-Fi 网络下：

1. Windows: 运行 `ipconfig` 查看 IPv4 地址
2. Mac/Linux: 运行 `ifconfig` 查看 IP 地址
3. 手机浏览器输入 `http://<IP>:3300`

## 项目结构

```
miffy-account/
├── server/
│   ├── index.js          # 服务器入口
│   ├── db.js             # 数据库初始化与操作
│   ├── auth.js           # JWT 认证中间件
│   ├── data/             # SQLite 数据库文件
│   └── routes/
│       ├── auth.js       # 注册/登录 API
│       ├── bills.js      # 账单 CRUD API
│       ├── categories.js # 分类管理 API
│       ├── modules.js    # 资金模块 API
│       └── stats.js      # 统计分析 API
├── public/
│   ├── index.html        # SPA 入口页面
│   ├── css/
│   │   └── style.css     # 完整样式（米菲主题）
│   └── js/
│       ├── miffy.js      # 米菲 SVG 插图
│       ├── api.js        # API 客户端
│       └── app.js        # 主应用逻辑
├── package.json
└── README.md
```

## 数据库

使用 SQLite，首次启动自动建表并初始化。每个注册用户自动创建默认收支分类。

## 页面结构

| 页面 | 路径 | 说明 |
|------|------|------|
| 登录/注册 | / | 用户认证 |
| 首页 | #/home | 月度概览、快速记账、模块卡片 |
| 记账 | #/add | 收入/支出快速录入 |
| 账单列表 | #/bills | 筛选、搜索、查看详情 |
| 资金模块 | #/modules | 创建、编辑、查看模块 |
| 统计 | #/stats | 月度收支、分类占比、趋势图 |
| 分类管理 | #/categories | 新增、显示/隐藏分类 |
| 我的 | #/mine | 个人信息、修改密码 |

## 资金模块扣减逻辑

- 记录支出 → 自动扣除对应模块金额
- 修改支出 → 先恢复原模块，再扣除新模块
- 删除支出 → 恢复对应模块金额
- 余额不足 → 温和提醒，允许继续（显示负数）

## 配色方案 (米菲主题)

- 奶油白 #FFFBF5
- 柔和粉 #FF9FB5
- 淡蓝 #93B5E1
- 浅黄 #FFE8A0
- 鼠尾草绿 #B5C9A8
- 暖棕文字 #5A4A3A
