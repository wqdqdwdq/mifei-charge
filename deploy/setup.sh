#!/bin/bash
# 米菲记账 - 服务器一键部署脚本（Debian 12）
# 用法：在服务器上 bash /opt/miffy-account/deploy/setup.sh
set -e
export DEBIAN_FRONTEND=noninteractive

echo "==> [1/5] 安装 Node 20"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get update
  apt-get install -y nodejs
fi
node -v

echo "==> [2/5] 安装 nginx + 编译兜底工具"
apt-get update
apt-get install -y nginx build-essential python3

echo "==> [3/5] 安装项目依赖"
cd /opt/miffy-account
npm install --omit=dev

echo "==> [4/5] 配置 nginx"
cp /opt/miffy-account/deploy/nginx-miffy.conf /etc/nginx/conf.d/miffy.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx

echo "==> [5/5] 配置 systemd 服务"
cp /opt/miffy-account/deploy/miffy-backend.service /etc/systemd/system/
cp /opt/miffy-account/deploy/miffy-frontend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now miffy-backend miffy-frontend

echo "=== 部署完成 ==="
systemctl status miffy-backend --no-pager | head -4
systemctl status miffy-frontend --no-pager | head -4
