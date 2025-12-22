#!/bin/bash
# 修复后端连接问题

PROJECT_DIR="/home/ec2-user/bbvdle"

echo "=========================================="
echo "修复后端连接问题"
echo "=========================================="
echo ""

# 1. 停止可能存在的后端进程
echo "1. 停止现有后端进程..."
pkill -f "python.*GLM.py" || echo "   没有运行中的后端进程"
sleep 2

# 2. 检查并激活虚拟环境
echo "2. 检查Python环境..."
cd "$PROJECT_DIR"
if [ -d "py38_env" ]; then
    source py38_env/bin/activate
    echo "   ✓ 虚拟环境已激活"
else
    echo "   ⚠ 虚拟环境不存在，使用系统Python"
fi

# 3. 检查必要文件
echo "3. 检查必要文件..."
if [ ! -f "src/model/GLM.py" ]; then
    echo "   ✗ GLM.py 不存在！"
    exit 1
fi

if [ ! -f "dist/zhipuai_key.txt" ]; then
    echo "   ⚠ API密钥文件不存在，后端可能无法正常工作"
fi

# 4. 检查CORS配置
echo "4. 检查CORS配置..."
if grep -q "CORS(app" src/model/GLM.py; then
    echo "   ✓ CORS 已配置"
else
    echo "   ✗ CORS 未正确配置"
    echo "   需要添加: CORS(app, resources={r\"/api/*\": {\"origins\": \"*\"}})"
fi

# 5. 检查host配置
echo "5. 检查host配置..."
if grep -q 'host="0.0.0.0"' src/model/GLM.py; then
    echo "   ✓ host 配置正确 (0.0.0.0)"
else
    echo "   ✗ host 配置不正确"
    echo "   需要设置为: app.run(host=\"0.0.0.0\", port=5000, debug=False)"
fi

# 6. 启动后端服务
echo "6. 启动后端服务..."
nohup python src/model/GLM.py > backend.log 2>&1 &
BACKEND_PID=$!

# 等待服务启动
sleep 3

# 7. 检查服务是否启动成功
if ps -p $BACKEND_PID > /dev/null 2>&1; then
    echo "   ✓ 后端服务已启动 (PID: $BACKEND_PID)"
else
    echo "   ✗ 后端服务启动失败！"
    echo "   查看日志: tail -20 backend.log"
    exit 1
fi

# 8. 检查端口监听
echo "7. 检查端口监听..."
sleep 2
if netstat -tuln 2>/dev/null | grep -q ":5000" || ss -tuln 2>/dev/null | grep -q ":5000"; then
    echo "   ✓ 端口5000正在监听"
else
    echo "   ⚠ 端口5000可能未监听，请检查日志"
fi

# 9. 测试本地连接
echo "8. 测试本地连接..."
sleep 1
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/reply -X POST \
    -H "Content-Type: application/json" \
    -H "Origin: http://54.80.168.204" \
    -d '{"message":"test"}' 2>&1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "500" ]; then
    echo "   ✓ 本地连接成功 (HTTP $HTTP_CODE)"
else
    echo "   ✗ 本地连接失败 (HTTP $HTTP_CODE)"
    echo "   查看日志: tail -20 backend.log"
fi

echo ""
echo "=========================================="
echo "修复完成"
echo "=========================================="
echo ""
echo "后端服务状态:"
echo "  PID: $BACKEND_PID"
echo "  日志: $PROJECT_DIR/backend.log"
echo ""
echo "查看日志: tail -f $PROJECT_DIR/backend.log"
echo "停止服务: pkill -f 'python.*GLM.py'"
echo ""

