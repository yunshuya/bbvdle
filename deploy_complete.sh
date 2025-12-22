#!/bin/bash
# BBVDLE 完整部署脚本
# 整合了代码更新、构建、部署和修复功能

set -e  # 遇到错误立即退出

PROJECT_DIR="/home/ec2-user/bbvdle"
APACHE_DIR="/var/www/html"
BRANCH="${1:-main}"  # 默认使用main分支，可通过参数指定

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
}

cd "$PROJECT_DIR"

log_section "BBVDLE 完整部署脚本"

# ==================== 步骤1: 更新代码 ====================
log_section "步骤1: 更新代码（强制同步到仓库最新版本）"

log_info "检查Git状态..."
git fetch origin

# 备份 ip.txt（如果存在）- 必须在重置前备份
if [ -f "dist/ip.txt" ]; then
    cp dist/ip.txt dist/ip.txt.backup
    CURRENT_IP=$(cat dist/ip.txt | tr -d '\n\r ')
    log_info "已备份 IP: $CURRENT_IP"
else
    CURRENT_IP=""
fi

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    log_warn "发现本地未提交的更改，将强制丢弃..."
    git status --short
fi

# 切换到目标分支
log_info "切换到分支: $BRANCH"
git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" origin/"$BRANCH"

# 强制重置到远程分支的最新状态（丢弃所有本地更改）
log_info "强制重置到远程最新版本（丢弃所有本地更改）..."
git reset --hard origin/"$BRANCH"

# 清理未跟踪的文件（可选，但更彻底）
log_info "清理未跟踪的文件..."
git clean -fd

LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/$BRANCH)
log_info "当前提交: ${LOCAL_COMMIT:0:8}"
log_info "远程提交: ${REMOTE_COMMIT:0:8}"

# 恢复备份的 ip.txt（服务器特定配置）
if [ -n "$CURRENT_IP" ] && [ -f "dist/ip.txt.backup" ]; then
    cp dist/ip.txt.backup dist/ip.txt
    rm dist/ip.txt.backup
    log_info "已恢复服务器 IP: $CURRENT_IP"
elif [ -n "$CURRENT_IP" ]; then
    # 如果备份文件不存在但之前有IP，创建新的ip.txt
    echo "$CURRENT_IP" > dist/ip.txt
    log_info "已恢复服务器 IP: $CURRENT_IP"
fi

log_info "✓ 代码已强制同步到仓库最新版本"

# ==================== 步骤2: 检查并安装依赖 ====================
log_section "步骤2: 检查依赖"

if [ -f "package.json" ]; then
    log_info "检查npm依赖..."
    npm install --ignore-scripts
    
    # 重新构建 node-sass（修复 vendor 目录缺失问题）
    log_info "重新构建 node-sass..."
    npm rebuild node-sass || log_warn "node-sass 重建失败，但继续构建"
fi

# ==================== 步骤3: 构建项目 ====================
log_section "步骤3: 构建项目"

log_info "开始构建前端..."
npm run build

# 验证构建结果
if [ ! -f "src/ui/style.css" ]; then
    log_error "style.css 构建失败！"
    exit 1
fi

if [ ! -f "dist/bundle.js" ]; then
    log_error "bundle.js 构建失败！"
    exit 1
fi

# 检查关键功能是否包含在构建文件中
if grep -q "resetWorkspace: 开始清空工作区" dist/bundle.js 2>/dev/null; then
    log_info "✓ bundle.js 包含清空功能的调试日志"
else
    log_warn "bundle.js 不包含调试日志（可能正常，如果代码已优化）"
fi

PROJECT_BUNDLE_SIZE=$(stat -c%s dist/bundle.js 2>/dev/null || stat -f%z dist/bundle.js)
log_info "构建完成 - bundle.js 大小: $PROJECT_BUNDLE_SIZE 字节"

# ==================== 步骤4: 更新Python依赖 ====================
log_section "步骤4: 更新Python依赖"

if [ -f "requirements.txt" ]; then
    log_info "检查Python依赖..."
    if [ -d "py38_env" ]; then
        source py38_env/bin/activate 2>/dev/null || true
    fi
    pip install -r requirements.txt --quiet
    log_info "✓ Python依赖已更新"
fi

# ==================== 步骤5: 备份Apache目录 ====================
log_section "步骤5: 备份Apache目录"

BACKUP_DIR="$APACHE_DIR/backup_$(date +%Y%m%d_%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"
sudo cp "$APACHE_DIR/dist/bundle.js" "$BACKUP_DIR/" 2>/dev/null || true
sudo cp "$APACHE_DIR/src/ui/style.css" "$BACKUP_DIR/" 2>/dev/null || true
log_info "备份目录: $BACKUP_DIR"

# ==================== 步骤6: 复制文件到Apache目录 ====================
log_section "步骤6: 部署文件到Apache"

log_info "清理旧文件..."
sudo rm -rf "$APACHE_DIR/dist" "$APACHE_DIR/src" "$APACHE_DIR/node_modules" 2>/dev/null || true
sudo rm -f "$APACHE_DIR/bundle.js" 2>/dev/null || true

log_info "复制 dist 目录..."
sudo cp -r "$PROJECT_DIR/dist" "$APACHE_DIR/"
log_info "✓ dist 目录已复制"

log_info "复制 src/ui 目录（包含编译后的 style.css）..."
if [ -d "$PROJECT_DIR/src/ui" ]; then
    sudo mkdir -p "$APACHE_DIR/src/ui"
    sudo cp -r "$PROJECT_DIR/src/ui"/* "$APACHE_DIR/src/ui/"
    log_info "✓ src/ui 目录已复制"
else
    log_error "src/ui 目录不存在！"
    exit 1
fi

log_info "复制 index.html..."
sudo cp "$PROJECT_DIR/index.html" "$APACHE_DIR/"
log_info "✓ index.html 已复制"

log_info "复制 resources 目录（图片等静态资源）..."
if [ -d "$PROJECT_DIR/resources" ]; then
    sudo cp -r "$PROJECT_DIR/resources" "$APACHE_DIR/" 2>/dev/null || true
    log_info "✓ resources 目录已复制"
else
    log_warn "resources 目录不存在（可能不影响功能）"
fi

log_info "复制 data 目录..."
if [ -d "$PROJECT_DIR/data" ]; then
    sudo cp -r "$PROJECT_DIR/data" "$APACHE_DIR/" 2>/dev/null || true
    log_info "✓ data 目录已复制"
fi

log_info "复制 favicon.ico..."
if [ -f "$PROJECT_DIR/favicon.ico" ]; then
    sudo cp "$PROJECT_DIR/favicon.ico" "$APACHE_DIR/" 2>/dev/null || true
    log_info "✓ favicon.ico 已复制"
fi

# 确保dist目录中的文件也被正确复制
if [ -d "$PROJECT_DIR/dist" ]; then
    sudo cp -r "$PROJECT_DIR/dist"/* "$APACHE_DIR/dist/"
fi

# ==================== 步骤7: 设置文件权限 ====================
log_section "步骤7: 设置文件权限"

log_info "设置Apache目录权限..."
sudo chown -R apache:apache "$APACHE_DIR"
sudo chmod -R 755 "$APACHE_DIR"
log_info "✓ 权限已设置"

# ==================== 步骤8: 配置Apache缓存控制 ====================
log_section "步骤8: 配置Apache缓存控制"

log_info "创建 .htaccess 文件..."
sudo bash -c "cat > $APACHE_DIR/.htaccess << 'EOF'
<FilesMatch \"\.(js|css)$\">
    Header set Cache-Control \"no-cache, no-store, must-revalidate\"
    Header set Pragma \"no-cache\"
    Header set Expires \"0\"
</FilesMatch>
<FilesMatch \"\.(html|htm)$\">
    Header set Cache-Control \"no-cache, no-store, must-revalidate\"
    Header set Pragma \"no-cache\"
    Header set Expires \"0\"
</FilesMatch>
EOF"

# 确保Apache启用了headers模块
if command -v a2enmod &> /dev/null; then
    sudo a2enmod headers 2>/dev/null || true
fi

log_info "✓ 缓存控制已配置"

# ==================== 步骤9: 重启服务 ====================
log_section "步骤9: 重启服务"

log_info "重新加载Apache..."
sudo systemctl reload httpd
log_info "✓ Apache 已重新加载"

log_info "重启后端服务（nohup方式）..."
# 停止可能正在运行的进程
pkill -f "python.*GLM.py" || true
sleep 1  # 等待进程完全停止

# 切换到项目目录
cd "$PROJECT_DIR"

# 激活虚拟环境（如果存在）
if [ -d "py38_env" ]; then
    source py38_env/bin/activate
    PYTHON_CMD="python"
elif command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
else
    PYTHON_CMD="python"
fi

# 使用nohup启动后端服务
log_info "启动后端服务..."
nohup $PYTHON_CMD src/model/GLM.py > backend.log 2>&1 &
BACKEND_PID=$!

# 等待一下，检查进程是否成功启动
sleep 2
if ps -p $BACKEND_PID > /dev/null 2>&1; then
    log_info "✓ 后端服务已启动（PID: $BACKEND_PID）"
    log_info "  日志文件: $PROJECT_DIR/backend.log"
else
    log_error "后端服务启动失败！"
    log_info "查看日志: tail -20 $PROJECT_DIR/backend.log"
    exit 1
fi

# ==================== 步骤10: 验证部署 ====================
log_section "步骤10: 验证部署"

log_info "验证关键文件..."

# 检查 bundle.js
if [ -f "$APACHE_DIR/dist/bundle.js" ]; then
    APACHE_BUNDLE_SIZE=$(stat -c%s "$APACHE_DIR/dist/bundle.js" 2>/dev/null || stat -f%z "$APACHE_DIR/dist/bundle.js")
    APACHE_BUNDLE_TIME=$(stat -c%y "$APACHE_DIR/dist/bundle.js" 2>/dev/null || stat -f%Sm "$APACHE_DIR/dist/bundle.js")
    
    log_info "Apache bundle.js: $APACHE_BUNDLE_SIZE 字节, 修改时间: $APACHE_BUNDLE_TIME"
    
    if [ "$PROJECT_BUNDLE_SIZE" -eq "$APACHE_BUNDLE_SIZE" ]; then
        log_info "✓ bundle.js 文件大小匹配"
    else
        log_warn "bundle.js 文件大小不匹配（项目: $PROJECT_BUNDLE_SIZE, Apache: $APACHE_BUNDLE_SIZE）"
    fi
    
    # 检查是否包含关键功能
    if grep -q "resetWorkspace" "$APACHE_DIR/dist/bundle.js" 2>/dev/null; then
        log_info "✓ bundle.js 包含清空功能代码"
    else
        log_warn "bundle.js 可能不包含清空功能代码"
    fi
else
    log_error "bundle.js 不存在！"
    exit 1
fi

# 检查 style.css
if [ -f "$APACHE_DIR/src/ui/style.css" ]; then
    CSS_SIZE=$(stat -c%s "$APACHE_DIR/src/ui/style.css" 2>/dev/null || stat -f%z "$APACHE_DIR/src/ui/style.css")
    log_info "✓ style.css 存在 (大小: $CSS_SIZE 字节)"
else
    log_error "style.css 不存在！"
    exit 1
fi

# 检查 index.html
if [ -f "$APACHE_DIR/index.html" ]; then
    log_info "✓ index.html 存在"
else
    log_error "index.html 不存在！"
    exit 1
fi

# 检查后端服务状态
log_info "检查后端服务状态..."
if pgrep -f "python.*GLM.py" > /dev/null; then
    BACKEND_PID=$(pgrep -f "python.*GLM.py" | head -1)
    log_info "✓ 后端服务正在运行（PID: $BACKEND_PID）"
    log_info "  查看日志: tail -f $PROJECT_DIR/backend.log"
else
    log_warn "后端服务未运行！"
    log_info "手动启动: cd $PROJECT_DIR && source py38_env/bin/activate && nohup python src/model/GLM.py > backend.log 2>&1 &"
fi

# ==================== 完成 ====================
log_section "部署完成！"

# 获取服务器IP（从ip.txt或metadata服务）
if [ -f "dist/ip.txt" ]; then
    SERVER_IP=$(cat dist/ip.txt | tr -d '\n\r ')
else
    SERVER_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "your-server-ip")
fi

echo ""
log_info "前端访问: http://$SERVER_IP"
log_info "后端API: http://$SERVER_IP:5000"
echo ""
log_info "下一步操作："
echo "  1. 清除浏览器缓存："
echo "     - Windows/Linux: Ctrl+Shift+R"
echo "     - Mac: Cmd+Shift+R"
echo "     - 或使用无痕/隐私模式访问"
echo ""
echo "  2. 打开浏览器控制台（F12），点击'清空'按钮"
echo "     - 应该看到调试日志输出"
echo ""
echo "  3. 如果问题仍然存在，检查："
echo "     - 浏览器控制台 > 网络标签 > bundle.js 的响应头"
echo "     - 直接访问: http://$SERVER_IP/dist/bundle.js"
echo "     - Apache错误日志: sudo tail -f /var/log/httpd/error_log"
echo ""
log_section "部署完成"

