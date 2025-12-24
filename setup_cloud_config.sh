#!/bin/bash

# BBVDLE 云端配置脚本
# 功能：在云端服务器上快速配置IP地址、API密钥和GLM.py部署设置
# 用法：./setup_cloud_config.sh

set -e

PROJECT_DIR="/home/ec2-user/bbvdle"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

info() {
    echo -e "${BLUE}[信息]${NC} $1"
}

# 检查是否在正确的目录
if [ ! -d "$PROJECT_DIR" ]; then
    error "项目目录不存在: $PROJECT_DIR"
fi

cd "$PROJECT_DIR"

log "=========================================="
log "BBVDLE 云端配置向导"
log "=========================================="

# ==================== 配置1: 设置后端IP地址 ====================
log "配置1: 设置后端IP地址 (dist/ip.txt)"

# 尝试自动检测IP
info "正在自动检测服务器公网IP..."
AUTO_IP=$(curl -s --max-time 5 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || \
          curl -s --max-time 5 https://checkip.amazonaws.com 2>/dev/null | tr -d '\n' || echo "")

if [ -n "$AUTO_IP" ] && echo "$AUTO_IP" | grep -qE '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'; then
    info "检测到公网IP: $AUTO_IP"
    read -p "是否使用此IP? (Y/n): " use_auto_ip
    if [[ "$use_auto_ip" =~ ^[Nn]$ ]]; then
        read -p "请输入服务器公网IP地址: " SERVER_IP
    else
        SERVER_IP="$AUTO_IP"
    fi
else
    read -p "请输入服务器公网IP地址: " SERVER_IP
fi

# 验证IP格式
if ! echo "$SERVER_IP" | grep -qE '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'; then
    error "IP地址格式不正确: $SERVER_IP"
fi

# 确保dist目录存在
mkdir -p dist

# 写入IP地址
echo "$SERVER_IP" > dist/ip.txt
log "✓ 已设置IP地址: $SERVER_IP"

# ==================== 配置2: 设置AI API密钥 ====================
log ""
log "配置2: 设置AI API密钥 (dist/zhipuai_key.txt)"

# 检查是否已有密钥
if [ -f "dist/zhipuai_key.txt" ] && [ -s "dist/zhipuai_key.txt" ]; then
    CURRENT_KEY=$(cat dist/zhipuai_key.txt | tr -d '\n')
    info "当前已配置密钥: ${CURRENT_KEY:0:10}... (已隐藏)"
    read -p "是否更新密钥? (y/N): " update_key
    if [[ ! "$update_key" =~ ^[Yy]$ ]]; then
        log "保留现有密钥"
        API_KEY="$CURRENT_KEY"
    else
        read -p "请输入ZhipuAI API密钥: " API_KEY
    fi
else
    read -p "请输入ZhipuAI API密钥: " API_KEY
fi

# 验证密钥不为空
if [ -z "$API_KEY" ]; then
    error "API密钥不能为空"
fi

# 写入API密钥
echo "$API_KEY" > dist/zhipuai_key.txt
log "✓ 已设置API密钥"

# ==================== 配置3: 修改GLM.py部署设置 ====================
log ""
log "配置3: 修改GLM.py部署设置"

GLM_FILE="src/model/GLM.py"

if [ ! -f "$GLM_FILE" ]; then
    error "找不到文件: $GLM_FILE"
fi

# 备份原文件
cp "$GLM_FILE" "${GLM_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
log "已备份原文件: ${GLM_FILE}.backup.*"

# 检查当前配置
if grep -q "# 本地测试使用以下代码" "$GLM_FILE" && grep -q "app.run(debug=True" "$GLM_FILE"; then
    info "检测到当前为本地测试配置，将切换为部署配置"
    
    # 使用sed修改文件
    # 注释掉本地测试代码
    sed -i 's/^    app\.run(debug=True, port=5000)$/    # app.run(debug=True, port=5000)/' "$GLM_FILE"
    
    # 取消注释部署代码
    sed -i 's/^    # 部署到服务器使用以下代码$/    # 部署到服务器使用以下代码/' "$GLM_FILE"
    sed -i 's/^    # app\.run(debug=False, host="0\.0\.0\.0", port=5000)$/    app.run(debug=False, host="0.0.0.0", port=5000)/' "$GLM_FILE"
    
    log "✓ 已切换为部署配置"
elif grep -q "app.run(debug=False, host=\"0.0.0.0\"" "$GLM_FILE"; then
    info "当前已经是部署配置"
    read -p "是否切换回本地测试配置? (y/N): " switch_back
    if [[ "$switch_back" =~ ^[Yy]$ ]]; then
        # 注释掉部署代码
        sed -i 's/^    app\.run(debug=False, host="0\.0\.0\.0", port=5000)$/    # app.run(debug=False, host="0.0.0.0", port=5000)/' "$GLM_FILE"
        
        # 取消注释本地测试代码
        sed -i 's/^    # app\.run(debug=True, port=5000)$/    app.run(debug=True, port=5000)/' "$GLM_FILE"
        
        log "✓ 已切换为本地测试配置"
    else
        log "保持部署配置"
    fi
else
    warn "无法识别当前配置，请手动检查 $GLM_FILE"
    warn "应该包含以下内容："
    warn "    # 本地测试使用以下代码"
    warn "    # app.run(debug=True, port=5000)"
    warn "    "
    warn "    # 部署到服务器使用以下代码"
    warn "    app.run(debug=False, host=\"0.0.0.0\", port=5000)"
fi

# 显示当前配置
log ""
log "当前 GLM.py 配置："
grep -A 5 "if __name__" "$GLM_FILE" | head -6 || true

# ==================== 验证配置 ====================
log ""
log "=========================================="
log "配置验证"
log "=========================================="

# 验证IP配置
if [ -f "dist/ip.txt" ] && [ -s "dist/ip.txt" ]; then
    CONFIGURED_IP=$(cat dist/ip.txt | tr -d '\n')
    log "✓ IP地址: $CONFIGURED_IP"
else
    warn "✗ IP地址未配置"
fi

# 验证API密钥配置
if [ -f "dist/zhipuai_key.txt" ] && [ -s "dist/zhipuai_key.txt" ]; then
    KEY_LENGTH=$(cat dist/zhipuai_key.txt | tr -d '\n' | wc -c)
    log "✓ API密钥: 已配置 (长度: $KEY_LENGTH 字符)"
else
    warn "✗ API密钥未配置"
fi

# 验证GLM.py配置
if grep -q "app.run(debug=False, host=\"0.0.0.0\"" "$GLM_FILE"; then
    log "✓ GLM.py: 部署配置"
elif grep -q "app.run(debug=True" "$GLM_FILE"; then
    warn "✗ GLM.py: 本地测试配置（需要切换为部署配置）"
else
    warn "✗ GLM.py: 配置状态未知"
fi

log ""
log "=========================================="
log "配置完成！"
log "=========================================="
log "下一步："
log "1. 运行部署脚本（跳过代码同步）:"
log "   ./deploy_complete.sh --skip-sync"
log ""
log "2. 或运行完整部署（包含代码同步）:"
log "   ./deploy_complete.sh"
log ""
log "3. 或手动启动后端服务:"
log "   nohup python src/model/GLM.py > backend.log 2>&1 &"
log "=========================================="

exit 0

