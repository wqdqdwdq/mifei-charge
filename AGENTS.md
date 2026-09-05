# AGENTS.md - 米菲记账项目开发约束

## 性能约束

本机服务器只有2核心2gb做一切动作 都要优先关注服务器性能 禁止大并发 大负载做任务 避免把服务器卡死

本文件是项目内所有开发者（含 AI 编码助手）必须遵守的约束。先读本文件，再开始任何开发工作。

## 项目概览

- 技术栈：前端 Vanilla JS SPA（`public/`）+ Node.js/Express 后端（`server/`）
- 后端服务：`server/index.js`（systemd: `miffy-backend`，127.0.0.1:8080）
- 前端服务：`server/frontend-server.js`（systemd: `miffy-frontend`，127.0.0.1:8081）
- 对外入口：nginx IP 子路径直连（`http://8.134.189.32/mifei-charge/`）→ 8081（前端）/ 8080（API、uploads）；
  Cloudflare Tunnel 已移除；`127.0.0.1:8443` 本地入口保留仅供导航页探活
- 数据库：PostgreSQL（库名 miffy，运行时数据，禁止入库）

## 一、Git 规范化开发要求

### 1. 工作树必须干净

- **禁止在脏工作树下继续开发。** 开始任何任务前，先检查 `git status --porcelain`。
- 若工作树不干净：先将已有改动提交或暂存（stash），确认干净后再开始新任务。
- 不允许把未提交的改动与正在进行的开发混在一起；开发期间新产生的改动，必须在任务收尾时统一提交。

### 2. 提交规范

- 每个提交只包含一个逻辑变更，禁止把无关改动混入同一提交。
- 提交信息使用 Conventional Commits 格式：
  - `feat:` 新功能
  - `fix:` 修复问题
  - `refactor:` 重构
  - `docs:` 文档（README、AGENTS.md 等）
  - `chore:` 构建/依赖/配置等杂项
  - `style:` 不影响逻辑的格式调整
  - `perf:` 性能优化
  - `test:` 测试
- 提交信息用中文或英文均可，但需简洁、能说明"改了什么、为什么"。
- 提交前必须 `git status` 检查暂存内容，禁止误提交：
  - `node_modules/`
  - `server/data/`（数据库文件）
  - `server/uploads/`（上传文件）
  - `backups/`、`.env`、日志等 `.gitignore` 已排除的内容

### 3. 提交前验证

- 改动的 JS 文件先通过语法检查：`node --check <file>`
- 确认相关服务仍可运行：`systemctl is-active miffy-backend miffy-frontend`
- 有前端改动时，确认页面/接口可正常访问后再提交。

### 4. 危险操作禁令

- 未经用户明确同意，禁止执行 `git reset --hard`、`git checkout --`、`git clean -fd`、force push 等破坏性命令。
- 禁止改写已推送的历史；必要时先询问用户。
- `main` 分支应始终保持可部署状态。

## 二、部署策略

### 1. 前端改动：立即部署

以下改动属于前端范畴，**完成后无需询问，立即部署生效**：

- `public/` 下的页面、样式、脚本、图标等静态资源
- `server/frontend-server.js` 前端静态服务
- `deploy/nginx-miffy.conf`、`deploy/miffy-frontend.service` 等前端相关部署配置

部署动作：

1. 静态资源改动无需重启（按请求实时读取）；若改动涉及服务入口或配置，执行 `systemctl restart miffy-frontend`。
2. 若改了 `deploy/` 下的 systemd 单元，同步到 `/etc/systemd/system/` 并 `systemctl daemon-reload`。
3. 部署后验证：`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8081/` 应返回 200，或确认页面正常访问。

### 2. 后端改动：先询问，后部署

以下改动属于后端范畴，**完成后必须先向用户汇报并征得同意，才能部署**：

- `server/index.js`、`server/routes/`、`server/db.js`、`server/auth.js`
- 数据库结构、迁移脚本（如 `server/migrate-to-pg.js`）
- `deploy/miffy-backend.service` 等后端相关部署配置

部署动作（须在用户确认后进行）：

1. `systemctl restart miffy-backend`。
2. 若涉及数据库结构变更，先说明迁移步骤，经用户确认后再执行。
3. 部署后验证：`systemctl is-active miffy-backend` 为 active，且 `/api/` 接口可正常响应。

## 三、其他

- 不修改运行时数据文件（数据库、上传图片）作为"开发内容"。
- 改动部署配置时，`deploy/` 源码与系统实际配置要保持一致。
- 有疑问或决策点（如是否要迁移数据库、是否要动生产数据）时，停下来询问用户，不要擅自执行。
