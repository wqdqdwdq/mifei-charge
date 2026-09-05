# 米菲记账 — 服务器部署与运维备忘

## 服务器信息
- **系统**：Debian 12 (bookworm) x86_64
- **公网 IP**：`8.134.189.32`
- **SSH**：`ssh -i "C:\Users\admin\.ssh\20260719_ed25519" root@8.134.189.32`（或别名 `Guangzhou`）
- **规格**：2 核 / 1.6Gi 内存 / 40G 磁盘
- **部署目录**：`/opt/miffy-account`

## 架构
```
浏览器 ──http://8.134.189.32/────────────► nginx :80 (外网唯一入口)
       ──http://8.134.189.32/v15767602297/─► nginx :80  (安全路径，内部剥离前缀)
                                              │
                          ┌───────────────────┼───────────────────┐
                          ▼                                       ▼
              前端静态服务 127.0.0.1:8081             后端 API 127.0.0.1:8080
              (frontend-server.js)                   (/api/*, /uploads/*)
```

- 后端 + 前端均只绑 `127.0.0.1`，外网不可直连，仅经 nginx 反代。
- 安全路径 `/v15767602297` 属于**路径混淆**，并非真正安全。如需更强防护，建议：
  加登录访问墙、限制来源 IP、或上 HTTPS（Let's Encrypt）。

## 访问地址
- 直接访问：`http://8.134.189.32/`
- 安全路径：`http://8.134.189.32/v15767602297/`

## 常用运维命令（服务器上执行）
```bash
# 查看三个服务状态
systemctl status miffy-backend miffy-frontend nginx

# 重启（改代码后）
systemctl restart miffy-backend        # 后端
systemctl restart miffy-frontend       # 前端
systemctl restart nginx                # 反代

# 查看日志
journalctl -u miffy-backend -f         # 后端运行日志
journalctl -u miffy-frontend -f        # 前端运行日志
tail -f /var/log/nginx/error.log       # nginx 错误日志

# 端口监听检查
ss -tlnp | grep -E ':(80|8080|8081)\b'
```

## 更新代码流程
```bash
# 本地：打包（排除 node_modules/.git/*.db/uploads）传上去，再 npm install
cd /opt/miffy-account
npm install --omit=dev          # 仅安装生产依赖
systemctl restart miffy-backend miffy-frontend
```

## 数据与备份
- 数据库（PostgreSQL）：库名 `miffy`、用户 `miffy`，连接串由 `miffy-backend.service` 的 `DATABASE_URL` 提供
- 用户上传（头像/模块图标）：`/opt/miffy-account/server/uploads/`
- 备份建议：低峰期用 `pg_dump -U miffy miffy > miffy_$(date +%F).sql` 导出后拷回本地。

## 故障排查
- **页面打不开 / 404**：先 `nginx -s reload`（nginx 首次启动偶发配置未生效）；再看 `ss -tlnp` 确认 8080/8081/80 都在监听。
- **上传图片失败**：检查 `server/uploads/` 目录权限，`client_max_body_size 2M`（nginx 已设）。
- **依赖问题**：依赖含 `pg`（PostgreSQL 驱动）；重装后需确保 `miffy-backend.service` 的 `DATABASE_URL` 指向正确的数据库。

## 环境版本
- Node 18.20.4 / npm 9.2.0（Debian 系统包；better-sqlite3 ^11 兼容 Node 18）
- nginx 1.22.1
- npm 镜像：`registry.npmmirror.com`（加速用）
