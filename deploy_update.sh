#!/bin/bash
# BBVDLE项目更新脚本
# 用于在EC2服务器上快速更新代码

set -e  # 遇到错误立即退出

echo "=========================================="
echo "BBVDLE 项目更新脚本"
echo "=========================================="

# 项目目录
PROJECT_DIR="/home/ec2-user/bbvdle"
APACHE_DIR="/var/www/html"
BRANCH="${1:-main}"  # 默认使用main分支，可通过参数指定

cd "$PROJECT_DIR"

echo "1. 拉取最新代码 (分支: $BRANCH)..."
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "2. 检查是否有新的npm依赖..."
if [ -f package.json ]; then
    npm install --ignore-scripts
    # 重新构建 node-sass（修复 vendor 目录缺失问题）
    echo "   重新构建 node-sass..."
    npm rebuild node-sass || echo "   警告: node-sass 重建失败，但继续构建"
fi

echo "3. 重新构建前端..."
npm run build

echo "4. 检查是否有新的Python依赖..."
if [ -f requirements.txt ]; then
    source py38_env/bin/activate 2>/dev/null || true
    pip install -r requirements.txt
fi

echo "5. 重启后端服务..."
sudo systemctl restart bbvdle-backend 2>/dev/null || {
    echo "   警告: systemd服务未找到，尝试使用nohup方式..."
    # 如果使用nohup，需要手动重启
    pkill -f "python.*GLM.py" || true
    cd "$PROJECT_DIR"
    source py38_env/bin/activate
    nohup python src/model/GLM.py > backend.log 2>&1 &
}

echo "6. 复制文件到Apache目录..."
sudo cp -r "$PROJECT_DIR"/* "$APACHE_DIR/"
sudo chown -R apache:apache "$APACHE_DIR"
sudo systemctl reload httpd

echo "=========================================="
echo "更新完成！"
echo "=========================================="
echo "前端访问: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
echo "后端API: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):5000"
echo "=========================================="

