#!/bin/bash
# 诊断后端服务连接问题

PROJECT_DIR="/home/ec2-user/bbvdle"
SERVER_IP="54.80.168.204"

echo "=========================================="
echo "后端服务诊断脚本"
echo "=========================================="
echo ""

# 1. 检查后端进程是否运行
echo "1. 检查后端进程..."
if pgrep -f "python.*GLM.py" > /dev/null; then
    BACKEND_PID=$(pgrep -f "python.*GLM.py" | head -1)
    echo "   ✓ 后端进程正在运行 (PID: $BACKEND_PID)"
    ps aux | grep "python.*GLM.py" | grep -v grep
else
    echo "   ✗ 后端进程未运行！"
    echo "   启动命令: cd $PROJECT_DIR && source py38_env/bin/activate && nohup python src/model/GLM.py > backend.log 2>&1 &"
fi
echo ""

# 2. 检查端口5000是否被监听
echo "2. 检查端口5000监听状态..."
if netstat -tuln 2>/dev/null | grep -q ":5000" || ss -tuln 2>/dev/null | grep -q ":5000"; then
    echo "   ✓ 端口5000正在监听"
    netstat -tuln 2>/dev/null | grep ":5000" || ss -tuln 2>/dev/null | grep ":5000"
else
    echo "   ✗ 端口5000未被监听！"
fi
echo ""

# 3. 检查本地连接
echo "3. 测试本地连接..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/reply -X POST -H "Content-Type: application/json" -d '{"message":"test"}' | grep -q "200\|400\|500"; then
    echo "   ✓ 本地连接正常"
else
    echo "   ✗ 本地连接失败"
    echo "   尝试连接: curl -v http://localhost:5000/api/reply"
fi
echo ""

# 4. 检查防火墙
echo "4. 检查防火墙状态..."
if command -v firewall-cmd &> /dev/null; then
    if sudo firewall-cmd --list-ports 2>/dev/null | grep -q "5000"; then
        echo "   ✓ 防火墙已开放5000端口"
    else
        echo "   ⚠ 防火墙可能未开放5000端口"
        echo "   开放命令: sudo firewall-cmd --permanent --add-port=5000/tcp && sudo firewall-cmd --reload"
    fi
else
    echo "   ℹ 未检测到firewall-cmd（可能使用iptables或其他防火墙）"
fi
echo ""

# 5. 检查后端日志
echo "5. 检查后端日志（最后20行）..."
if [ -f "$PROJECT_DIR/backend.log" ]; then
    echo "   最近日志:"
    tail -20 "$PROJECT_DIR/backend.log" | sed 's/^/   /'
else
    echo "   ⚠ 日志文件不存在: $PROJECT_DIR/backend.log"
fi
echo ""

# 6. 检查GLM.py配置
echo "6. 检查后端配置..."
if [ -f "$PROJECT_DIR/src/model/GLM.py" ]; then
    if grep -q 'host="0.0.0.0"' "$PROJECT_DIR/src/model/GLM.py"; then
        echo "   ✓ host 配置为 0.0.0.0（允许外部访问）"
    else
        echo "   ✗ host 配置可能不正确"
        echo "   应该设置为: app.run(host=\"0.0.0.0\", port=5000, debug=False)"
    fi
    
    if grep -q "CORS" "$PROJECT_DIR/src/model/GLM.py"; then
        echo "   ✓ CORS 已配置"
    else
        echo "   ✗ CORS 未配置"
    fi
else
    echo "   ✗ GLM.py 文件不存在"
fi
echo ""

# 7. 检查API密钥文件
echo "7. 检查API密钥文件..."
if [ -f "$PROJECT_DIR/dist/zhipuai_key.txt" ]; then
    echo "   ✓ API密钥文件存在"
else
    echo "   ✗ API密钥文件不存在: $PROJECT_DIR/dist/zhipuai_key.txt"
fi
echo ""

# 8. 测试外部连接
echo "8. 测试外部连接..."
echo "   从服务器测试: curl -v http://$SERVER_IP:5000/api/reply -X POST -H \"Content-Type: application/json\" -d '{\"message\":\"test\"}'"
echo ""

# 9. 检查AWS安全组（提示）
echo "9. AWS安全组检查提示..."
echo "   请确保AWS EC2安全组已添加规则："
echo "   - 类型: 自定义TCP"
echo "   - 端口: 5000"
echo "   - 来源: 0.0.0.0/0 (或特定IP)"
echo ""

# 10. 提供修复建议
echo "=========================================="
echo "修复建议"
echo "=========================================="
echo ""
echo "如果后端进程未运行："
echo "  cd $PROJECT_DIR"
echo "  source py38_env/bin/activate"
echo "  nohup python src/model/GLM.py > backend.log 2>&1 &"
echo ""
echo "如果端口未被监听，检查："
echo "  1. 后端服务是否正常启动"
echo "  2. 查看日志: tail -f $PROJECT_DIR/backend.log"
echo ""
echo "如果本地连接失败，检查："
echo "  1. 后端服务是否崩溃（查看日志）"
echo "  2. 端口是否被其他程序占用: lsof -i :5000"
echo ""
echo "如果外部无法访问，检查："
echo "  1. AWS安全组是否开放5000端口"
echo "  2. 后端host是否设置为0.0.0.0"
echo "  3. 防火墙是否阻止连接"
echo ""

