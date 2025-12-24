#!/bin/bash

# BBVDLE 完整部署脚本
# 功能：一键完成代码同步、构建、部署和重启服务
# 重要：此脚本只从远程拉取代码，不会推送任何本地更改到远程仓库
# 用法：./deploy_complete.sh [分支名] [--skip-sync]
# 示例：./deploy_complete.sh main              # 完整部署（包含代码同步）
#        ./deploy_complete.sh main --skip-sync # 跳过代码同步，直接部署
#        ./deploy_complete.sh develop          # 部署develop分支

set -e  # 遇到错误立即退出

# 配置变量
PROJECT_DIR="/home/ec2-user/bbvdle"
APACHE_DIR="/var/www/html"
BACKUP_DIR="/tmp/bbvdle_backup_$(date +%Y%m%d_%H%M%S)"

# 解析参数
BRANCH="main"
SKIP_SYNC=false

for arg in "$@"; do
    case $arg in
        --skip-sync)
            SKIP_SYNC=true
            ;;
        *)
            # 如果不是选项，则认为是分支名
            if [[ ! "$arg" =~ ^-- ]]; then
                BRANCH="$arg"
            fi
            ;;
    esac
done

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

error() {
    echo -e "${RED}[错误]${NC} $1"
    exit 1
}

# 检查是否在正确的目录
if [ ! -d "$PROJECT_DIR" ]; then
    error "项目目录不存在: $PROJECT_DIR"
fi

cd "$PROJECT_DIR"

log "=========================================="
log "开始部署 BBVDLE 项目"
log "分支: $BRANCH"
if [ "$SKIP_SYNC" = true ]; then
    log "模式: 跳过代码同步（直接部署）"
else
    log "模式: 完整部署（包含代码同步）"
fi
log "=========================================="

# ==================== 步骤1: 备份重要配置文件和可能被修改的文件 ====================
log "步骤1: 备份重要配置文件和可能被修改的文件..."

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 备份 dist/ip.txt（如果存在）
if [ -f "dist/ip.txt" ]; then
    cp "dist/ip.txt" "$BACKUP_DIR/ip.txt.bak"
    log "已备份 dist/ip.txt"
fi

# 备份 dist/zhipuai_key.txt（如果存在）
if [ -f "dist/zhipuai_key.txt" ]; then
    cp "dist/zhipuai_key.txt" "$BACKUP_DIR/zhipuai_key.txt.bak"
    log "已备份 dist/zhipuai_key.txt"
fi

# 备份 src/model/GLM.py（云端可能修改）
if [ -f "src/model/GLM.py" ]; then
    cp "src/model/GLM.py" "$BACKUP_DIR/GLM.py.bak"
    log "已备份 src/model/GLM.py"
fi

# 备份数据库（如果存在）
if [ -f "data/bbvdle.db" ]; then
    cp "data/bbvdle.db" "$BACKUP_DIR/bbvdle.db.bak"
    log "已备份数据库"
fi

log "备份完成: $BACKUP_DIR"

# ==================== 步骤2: 强制同步远程代码（丢弃本地修改） ====================
if [ "$SKIP_SYNC" = true ]; then
    log "步骤2: 跳过代码同步（使用 --skip-sync 选项）"
    log "将直接使用当前代码进行部署"
else
    log "步骤2: 强制同步远程代码（分支: $BRANCH，将丢弃所有本地修改）..."
    
    # 获取当前分支
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
    
    # 如果当前不在目标分支，切换到目标分支
    if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
        log "切换到分支: $BRANCH"
        git fetch origin "$BRANCH" || warn "无法获取分支 $BRANCH"
        git checkout "$BRANCH" || error "无法切换到分支 $BRANCH"
    fi
    
    # 获取最新远程代码
    log "获取远程最新代码..."
    git fetch origin "$BRANCH" || error "无法获取远程代码"
    
    # 强制重置到远程分支（丢弃所有本地修改和未提交的更改）
    log "强制同步到远程分支（丢弃所有本地修改）..."
    git reset --hard "origin/$BRANCH" || error "无法重置到远程分支"
    
    # 清理未跟踪的文件
    log "清理未跟踪的文件..."
    git clean -fd || warn "清理文件时出现问题"
    
    log "代码同步完成（已强制同步到远程最新版本）"
fi

# ==================== 步骤3: 恢复云端配置（同步后重新配置） ====================
if [ "$SKIP_SYNC" = true ]; then
    log "步骤3: 跳过配置文件恢复（使用当前配置）"
    # 跳过代码同步时，不需要恢复备份，直接使用当前配置
    log "将使用当前已配置的文件（dist/ip.txt, dist/zhipuai_key.txt, src/model/GLM.py）"
else
    log "步骤3: 恢复云端配置（同步后重新配置云端特定文件）..."
    
    # 确保dist目录存在
    mkdir -p dist
    
    # 恢复 dist/ip.txt（优先使用备份，否则自动检测）
    if [ -f "$BACKUP_DIR/ip.txt.bak" ]; then
        cp "$BACKUP_DIR/ip.txt.bak" "dist/ip.txt"
        log "✓ 已恢复 dist/ip.txt（从备份）"
    else
        # 如果备份不存在，尝试自动检测IP
        log "未找到IP备份，尝试自动检测..."
        CURRENT_IP=$(curl -s --max-time 5 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || \
                     curl -s --max-time 5 https://checkip.amazonaws.com 2>/dev/null | tr -d '\n' || echo "")
        
        if [ -n "$CURRENT_IP" ] && echo "$CURRENT_IP" | grep -qE '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'; then
            echo "$CURRENT_IP" > "dist/ip.txt"
            log "✓ 已自动检测并设置IP: $CURRENT_IP"
        else
            warn "无法自动检测IP，请手动设置 dist/ip.txt"
        fi
    fi
    
    # 恢复 dist/zhipuai_key.txt（从备份）
    if [ -f "$BACKUP_DIR/zhipuai_key.txt.bak" ]; then
        cp "$BACKUP_DIR/zhipuai_key.txt.bak" "dist/zhipuai_key.txt"
        log "✓ 已恢复 dist/zhipuai_key.txt（从备份）"
    else
        warn "未找到 zhipuai_key.txt 备份，请手动配置"
        warn "提示：可以运行 ./setup_cloud_config.sh 进行配置"
    fi
    
    # 恢复 src/model/GLM.py（从备份，恢复云端部署配置）
    if [ -f "$BACKUP_DIR/GLM.py.bak" ]; then
        # 检查备份文件是否包含部署配置
        if grep -q "app.run(debug=False, host=\"0.0.0.0\"" "$BACKUP_DIR/GLM.py.bak"; then
            # 备份文件已经是部署配置，直接恢复
            cp "$BACKUP_DIR/GLM.py.bak" "src/model/GLM.py"
            log "✓ 已恢复 src/model/GLM.py（部署配置）"
        else
            # 备份文件是本地配置，需要修改为部署配置
            cp "$BACKUP_DIR/GLM.py.bak" "src/model/GLM.py"
            log "检测到备份为本地配置，切换为部署配置..."
            
            # 修改为部署配置
            sed -i 's/^    app\.run(debug=True, port=5000)$/    # app.run(debug=True, port=5000)/' "src/model/GLM.py" 2>/dev/null || true
            sed -i 's/^    # app\.run(debug=False, host="0\.0\.0\.0", port=5000)$/    app.run(debug=False, host="0.0.0.0", port=5000)/' "src/model/GLM.py" 2>/dev/null || true
            
            log "✓ 已恢复并切换 src/model/GLM.py 为部署配置"
        fi
    else
        warn "未找到 GLM.py 备份，将使用远程版本"
        warn "提示：如果远程版本是本地配置，请运行 ./setup_cloud_config.sh 进行配置"
    fi
    
    # 数据库备份信息
    if [ -f "$BACKUP_DIR/bbvdle.db.bak" ]; then
        log "数据库备份已保存: $BACKUP_DIR/bbvdle.db.bak（不自动恢复）"
    fi
    
    log "云端配置恢复完成"
fi

# ==================== 步骤4: 安装和更新依赖 ====================
log "步骤4: 安装和更新依赖..."

# 检查Node.js
if ! command -v node &> /dev/null; then
    error "Node.js 未安装，请先安装 Node.js"
fi

# 检查npm
if ! command -v npm &> /dev/null; then
    error "npm 未安装，请先安装 npm"
fi

# 安装npm依赖
log "安装npm依赖..."
npm install --ignore-scripts || error "npm install 失败"

# 重新构建node-sass（如果需要）
log "重新构建 node-sass..."
npm rebuild node-sass || warn "node-sass 重建失败，但继续执行"

# 检查Python虚拟环境
if [ -f "py38_env/bin/activate" ]; then
    log "激活Python虚拟环境..."
    source py38_env/bin/activate
    
    # 安装Python依赖
    log "安装Python依赖..."
    pip install -r requirements.txt --quiet || error "pip install 失败"
else
    warn "未找到Python虚拟环境，跳过Python依赖安装"
fi

log "依赖安装完成"

# ==================== 步骤5: 构建项目 ====================
log "步骤5: 构建项目..."

# 构建前端
log "构建前端（TypeScript + Webpack + SCSS）..."
npm run build || error "项目构建失败"

# 验证构建产物
if [ ! -f "dist/bundle.js" ]; then
    error "构建失败：未找到 dist/bundle.js"
fi

if [ ! -f "src/ui/style.css" ]; then
    error "构建失败：未找到 src/ui/style.css"
fi

log "项目构建完成"

# ==================== 步骤6: 备份Apache目录 ====================
log "步骤6: 备份Apache目录..."

if [ -d "$APACHE_DIR" ]; then
    # 备份Apache目录中的关键文件
    sudo mkdir -p "$BACKUP_DIR/apache"
    
    if [ -f "$APACHE_DIR/index.html" ]; then
        sudo cp "$APACHE_DIR/index.html" "$BACKUP_DIR/apache/" 2>/dev/null || true
    fi
    
    if [ -d "$APACHE_DIR/dist" ]; then
        sudo cp -r "$APACHE_DIR/dist" "$BACKUP_DIR/apache/" 2>/dev/null || true
    fi
    
    if [ -d "$APACHE_DIR/src" ]; then
        sudo cp -r "$APACHE_DIR/src" "$BACKUP_DIR/apache/" 2>/dev/null || true
    fi
    
    log "Apache目录备份完成"
else
    warn "Apache目录不存在，跳过备份"
fi

# ==================== 步骤7: 复制文件到Apache目录 ====================
log "步骤7: 复制文件到Apache目录..."

if [ ! -d "$APACHE_DIR" ]; then
    error "Apache目录不存在: $APACHE_DIR"
fi

# 复制dist目录
log "复制 dist 目录..."
sudo cp -r dist "$APACHE_DIR/" || error "复制 dist 目录失败"

# 复制src/ui目录（包含style.css）
log "复制 src/ui 目录..."
sudo mkdir -p "$APACHE_DIR/src"
sudo cp -r src/ui "$APACHE_DIR/src/" || error "复制 src/ui 目录失败"

# 复制index.html
log "复制 index.html..."
sudo cp index.html "$APACHE_DIR/" || error "复制 index.html 失败"

# 复制resources目录（如果存在）
if [ -d "resources" ]; then
    log "复制 resources 目录..."
    sudo cp -r resources "$APACHE_DIR/" 2>/dev/null || warn "复制 resources 目录失败"
fi

# 复制favicon.ico（如果存在）
if [ -f "favicon.ico" ]; then
    log "复制 favicon.ico..."
    sudo cp favicon.ico "$APACHE_DIR/" 2>/dev/null || warn "复制 favicon.ico 失败"
fi

log "文件复制完成"

# ==================== 步骤8: 设置文件权限 ====================
log "步骤8: 设置文件权限..."

sudo chown -R apache:apache "$APACHE_DIR" || error "设置文件所有者失败"
sudo chmod -R 755 "$APACHE_DIR" || error "设置文件权限失败"

log "文件权限设置完成"

# ==================== 步骤9: 配置Apache缓存控制 ====================
log "步骤9: 配置Apache缓存控制..."

# 创建.htaccess文件
sudo bash -c "cat > $APACHE_DIR/.htaccess << 'EOF'
<FilesMatch \"\.(js|css)$\">
    Header set Cache-Control \"no-cache, no-store, must-revalidate\"
    Header set Pragma \"no-cache\"
    Header set Expires \"0\"
</FilesMatch>
EOF" || warn "创建 .htaccess 文件失败"

log "Apache缓存控制配置完成"

# ==================== 步骤10: 重启Apache服务 ====================
log "步骤10: 重启Apache服务..."

if systemctl is-active --quiet httpd 2>/dev/null; then
    log "重新加载Apache配置..."
    sudo systemctl reload httpd || error "重新加载Apache失败"
else
    log "启动Apache服务..."
    sudo systemctl start httpd || error "启动Apache失败"
fi

# 确保Apache开机自启
sudo systemctl enable httpd 2>/dev/null || warn "设置Apache开机自启失败"

log "Apache服务已重启"

# ==================== 步骤11: 重启后端服务 ====================
log "步骤11: 重启后端服务..."

# 停止可能正在运行的后端服务
if pgrep -f "python.*GLM.py" > /dev/null; then
    log "停止现有后端服务..."
    pkill -f "python.*GLM.py" || true
    sleep 2
fi

# 启动后端服务
log "启动后端服务..."
cd "$PROJECT_DIR"

# 激活虚拟环境（如果存在）
if [ -f "py38_env/bin/activate" ]; then
    source py38_env/bin/activate
fi

# 使用nohup后台运行
nohup python src/model/GLM.py > backend.log 2>&1 &

# 等待服务启动
sleep 3

# 验证服务是否启动
if pgrep -f "python.*GLM.py" > /dev/null; then
    PID=$(pgrep -f "python.*GLM.py")
    log "后端服务已启动，PID: $PID"
else
    error "后端服务启动失败，请查看日志: $PROJECT_DIR/backend.log"
fi

log "后端服务已重启"

# ==================== 步骤12: 验证部署结果 ====================
log "步骤12: 验证部署结果..."

# 检查Apache服务状态
if systemctl is-active --quiet httpd 2>/dev/null; then
    log "✓ Apache服务运行正常"
else
    error "✗ Apache服务未运行"
fi

# 检查后端服务状态
if pgrep -f "python.*GLM.py" > /dev/null; then
    log "✓ 后端服务运行正常"
else
    error "✗ 后端服务未运行"
fi

# 检查关键文件
if [ -f "$APACHE_DIR/index.html" ]; then
    log "✓ index.html 存在"
else
    error "✗ index.html 不存在"
fi

if [ -f "$APACHE_DIR/dist/bundle.js" ]; then
    log "✓ bundle.js 存在"
else
    error "✗ bundle.js 不存在"
fi

if [ -f "$APACHE_DIR/src/ui/style.css" ]; then
    log "✓ style.css 存在"
else
    error "✗ style.css 不存在"
fi

# 获取服务器IP
SERVER_IP=$(cat "$PROJECT_DIR/dist/ip.txt" 2>/dev/null | tr -d '\n' || echo "未配置")

log "=========================================="
log "部署完成！"
log "=========================================="
log "前端访问地址: http://$SERVER_IP"
log "后端API地址: http://$SERVER_IP:5000"
log "备份目录: $BACKUP_DIR"
log "后端日志: $PROJECT_DIR/backend.log"
log "=========================================="

# 清理备份目录（可选，保留最近3个备份）
log "清理旧备份（保留最近3个）..."
BACKUP_COUNT=$(ls -d /tmp/bbvdle_backup_* 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 3 ]; then
    ls -dt /tmp/bbvdle_backup_* | tail -n +4 | xargs rm -rf 2>/dev/null || true
    log "已清理旧备份"
fi

log "部署脚本执行完成！"

exit 0

