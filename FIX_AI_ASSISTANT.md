# AI助手无法连接后端服务 - 排查和修复指南

## 问题原因

AI助手无法连接后端服务的常见原因：

1. **`dist/ip.txt` 文件内容错误**（最可能）
   - 当前内容是 `localhost`
   - 需要改为云服务器的公网IP

2. **后端服务未运行**
   - Flask服务可能没有启动

3. **安全组未开放5000端口**
   - AWS EC2安全组需要开放5000端口

4. **CORS问题**
   - 浏览器可能阻止跨域请求

## 完整排查步骤

### 步骤1：检查并更新 `dist/ip.txt` 文件

**在云服务器上执行：**

```bash
# SSH连接到服务器
ssh -i your-key.pem ec2-user@your-server-ip

# 进入项目目录
cd ~/bbvdle

# 获取服务器的公网IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo "服务器公网IP: $PUBLIC_IP"

# 更新 ip.txt 文件
echo "$PUBLIC_IP" > dist/ip.txt

# 验证
cat dist/ip.txt
# 应该显示你的公网IP，而不是 localhost
```

### 步骤2：检查后端服务是否运行

```bash
# 检查后端服务状态（如果使用systemd）
sudo systemctl status bbvdle-backend

# 如果服务未运行，启动它
sudo systemctl start bbvdle-backend

# 或者检查进程（如果使用nohup）
ps aux | grep GLM.py

# 如果进程不存在，启动后端服务
cd ~/bbvdle
source py38_env/bin/activate
nohup python src/model/GLM.py > backend.log 2>&1 &
```

### 步骤3：测试后端API是否可访问

```bash
# 在服务器上测试本地连接
curl http://localhost:5000/api/reply -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"测试"}'

# 应该返回JSON响应，而不是连接错误

# 测试从外部访问（替换为你的公网IP）
curl http://your-public-ip:5000/api/reply -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"测试"}'
```

### 步骤4：检查安全组配置

**在AWS控制台：**
1. EC2 → 安全组 → 选择你的安全组
2. 检查入站规则中是否有：
   - 类型：自定义TCP
   - 端口：5000
   - 来源：0.0.0.0/0（或你的IP）

### 步骤5：更新Apache文件并重新加载

```bash
# 复制更新的文件到Apache目录
sudo cp -r ~/bbvdle/* /var/www/html/
sudo chown -R apache:apache /var/www/html/
sudo systemctl reload httpd

# 验证 ip.txt 文件在Apache目录中
cat /var/www/html/dist/ip.txt
# 应该显示公网IP
```

### 步骤6：在浏览器中测试

1. **打开浏览器开发者工具**（F12）
2. **切换到Network标签**
3. **尝试使用AI助手**
4. **查看请求详情**：
   - 请求URL应该是：`http://your-public-ip:5000/api/reply`
   - 如果显示 `localhost:5000`，说明 `ip.txt` 没有正确更新
   - 如果显示CORS错误，检查后端CORS配置

5. **在控制台检查**：
```javascript
// 在浏览器控制台执行
fetch('/dist/ip.txt')
  .then(r => r.text())
  .then(ip => console.log('读取到的IP:', ip))
  .catch(e => console.error('读取失败:', e));
```

## 快速修复脚本

在云服务器上执行以下脚本：

```bash
#!/bin/bash
# 快速修复AI助手连接问题

cd ~/bbvdle

# 1. 更新IP地址
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo "更新IP地址为: $PUBLIC_IP"
echo "$PUBLIC_IP" > dist/ip.txt
cat dist/ip.txt

# 2. 检查后端服务
echo ""
echo "检查后端服务状态..."
if systemctl is-active --quiet bbvdle-backend; then
    echo "✓ 后端服务正在运行"
else
    echo "✗ 后端服务未运行，正在启动..."
    sudo systemctl start bbvdle-backend
    sleep 2
    sudo systemctl status bbvdle-backend --no-pager | head -5
fi

# 3. 测试后端API
echo ""
echo "测试后端API..."
curl -s http://localhost:5000/api/reply -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"测试"}' | head -c 100
echo ""

# 4. 更新Apache文件
echo ""
echo "更新Apache文件..."
sudo cp dist/ip.txt /var/www/html/dist/ip.txt
sudo chown apache:apache /var/www/html/dist/ip.txt
sudo systemctl reload httpd

echo ""
echo "修复完成！请刷新浏览器页面测试。"
```

保存为 `fix_ai.sh`，然后执行：
```bash
chmod +x fix_ai.sh
./fix_ai.sh
```

## 常见错误和解决方案

### 错误1：CORS错误

**错误信息：**
```
Access to XMLHttpRequest at 'http://xxx:5000/api/reply' from origin 'http://xxx' has been blocked by CORS policy
```

**解决方案：**
- 检查 `GLM.py` 中是否有 `CORS(app)`
- 确保后端服务正在运行

### 错误2：连接被拒绝

**错误信息：**
```
Failed to connect to xxx:5000
```

**解决方案：**
- 检查后端服务是否运行
- 检查安全组是否开放5000端口
- 检查防火墙设置

### 错误3：读取ip.txt失败

**错误信息：**
```
获取 IP 地址失败: ...
```

**解决方案：**
- 确保 `dist/ip.txt` 文件存在
- 确保Apache可以访问该文件
- 检查文件权限

## 验证清单

修复后，请确认：

- [ ] `dist/ip.txt` 内容是公网IP（不是localhost）
- [ ] 后端服务正在运行（`sudo systemctl status bbvdle-backend`）
- [ ] 可以从服务器本地访问API（`curl http://localhost:5000/api/reply`）
- [ ] 安全组开放了5000端口
- [ ] Apache文件已更新（`cat /var/www/html/dist/ip.txt`）
- [ ] 浏览器控制台没有CORS错误
- [ ] 浏览器Network标签显示请求URL是公网IP

