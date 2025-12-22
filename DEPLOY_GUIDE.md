# 使用 deploy_update.sh 更新脚本指南

## 一、首次设置

### 1. 将脚本上传到 EC2 服务器

**方法一：使用 SCP（推荐）**

在本地（Windows PowerShell 或 Git Bash）执行：

```bash
# 替换以下信息：
# - your-key.pem: 你的EC2密钥文件路径
# - your-server-ip: EC2实例的公网IP地址

scp -i your-key.pem deploy_update.sh ec2-user@your-server-ip:/home/ec2-user/
```

**方法二：直接在服务器上创建**

SSH连接到服务器后：

```bash
# SSH连接
ssh -i your-key.pem ec2-user@your-server-ip

# 创建脚本文件
nano ~/deploy_update.sh
# 然后复制脚本内容，粘贴后保存（Ctrl+X, Y, Enter）
```

### 2. 赋予脚本执行权限

```bash
# SSH连接到服务器
ssh -i your-key.pem ec2-user@your-server-ip

# 赋予执行权限
chmod +x ~/deploy_update.sh

# 验证权限
ls -l ~/deploy_update.sh
# 应该看到 -rwxr-xr-x 权限
```

### 3. 验证脚本路径和配置

```bash
# 检查项目目录是否存在
ls -la /home/ec2-user/bbvdle

# 检查Git仓库是否已初始化
cd /home/ec2-user/bbvdle
git remote -v

# 如果没有配置远程仓库，需要添加：
git remote add origin https://github.com/yunshuya/bbvdle.git
```

## 二、日常使用（更新代码）

### 基本使用步骤

1. **在本地修改代码并推送到GitHub**

```bash
# 在本地项目目录
git add .
git commit -m "更新说明"
git push origin main  # 或 git push origin dev
```

2. **SSH连接到EC2服务器**

```bash
ssh -i your-key.pem ec2-user@your-server-ip
```

3. **运行更新脚本**

```bash
# 更新main分支（默认）
~/deploy_update.sh main

# 或更新dev分支
~/deploy_update.sh dev

# 如果脚本在项目目录中，也可以：
cd ~/bbvdle
./deploy_update.sh main
```

### 脚本执行过程

脚本会自动执行以下步骤：

1. ✅ 拉取最新代码（从GitHub）
2. ✅ 更新npm依赖（如果有新依赖）
3. ✅ 重新构建前端（npm run build）
4. ✅ 更新Python依赖（如果有新依赖）
5. ✅ 重启后端服务（bbvdle-backend）
6. ✅ 复制文件到Apache目录
7. ✅ 重新加载Apache服务

### 预期输出示例

```
==========================================
BBVDLE 项目更新脚本
==========================================
1. 拉取最新代码 (分支: main)...
From https://github.com/yunshuya/bbvdle
 * branch            main       -> FETCH_HEAD
Already up to date.
2. 检查是否有新的npm依赖...
3. 重新构建前端...
4. 检查是否有新的Python依赖...
5. 重启后端服务...
6. 复制文件到Apache目录...
==========================================
更新完成！
==========================================
前端访问: http://your-server-ip
后端API: http://your-server-ip:5000
==========================================
```

## 三、常见问题排查

### 1. 权限错误

**错误信息**：
```
Permission denied (publickey)
```

**解决方案**：
```bash
# 检查密钥文件权限（本地）
chmod 400 your-key.pem

# 检查脚本权限（服务器）
chmod +x ~/deploy_update.sh
```

### 2. Git 认证失败

**错误信息**：
```
fatal: could not read Username for 'https://github.com'
```

**解决方案**：

**方法一：使用SSH方式（推荐）**

```bash
# 在服务器上切换到项目目录
cd ~/bbvdle

# 检查当前远程URL
git remote -v

# 如果显示HTTPS URL，改为SSH
git remote set-url origin git@github.com:yunshuya/bbvdle.git

# 配置SSH密钥（如果没有）
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
cat ~/.ssh/id_rsa.pub
# 将公钥添加到GitHub: Settings -> SSH and GPG keys -> New SSH key
```

**方法二：使用Personal Access Token**

```bash
# 在GitHub创建Personal Access Token
# Settings -> Developer settings -> Personal access tokens -> Generate new token
# 权限选择：repo

# 使用token拉取代码
git pull https://YOUR_TOKEN@github.com/yunshuya/bbvdle.git main
```

### 3. npm 构建失败

**错误信息**：
```
npm ERR! code ELIFECYCLE
npm ERR! errno 1
```

**解决方案**：
```bash
# 清理缓存并重新安装
cd ~/bbvdle
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --ignore-scripts
npm run build
```

### 4. 后端服务重启失败

**错误信息**：
```
Failed to restart bbvdle-backend.service: Unit bbvdle-backend.service not found
```

**解决方案**：

**如果使用systemd服务**：
```bash
# 检查服务文件是否存在
ls -la /etc/systemd/system/bbvdle-backend.service

# 如果不存在，创建服务文件（参考README.md）
sudo nano /etc/systemd/system/bbvdle-backend.service
# 复制README.md中的服务配置内容
sudo systemctl daemon-reload
sudo systemctl enable bbvdle-backend
sudo systemctl start bbvdle-backend
```

**如果使用nohup方式**：
```bash
# 脚本会自动处理，但可以手动检查
ps aux | grep GLM.py
# 如果进程不存在，手动启动：
cd ~/bbvdle
source py38_env/bin/activate
nohup python src/model/GLM.py > backend.log 2>&1 &
```

### 5. Apache文件复制失败

**错误信息**：
```
cp: cannot create regular file '/var/www/html/...': Permission denied
```

**解决方案**：
```bash
# 检查Apache目录权限
ls -la /var/www/html

# 确保脚本中有sudo权限
# 如果sudo需要密码，配置免密sudo（可选）
sudo visudo
# 添加：ec2-user ALL=(ALL) NOPASSWD: /bin/cp, /bin/chown, /bin/systemctl
```

## 四、高级配置

### 1. 配置免密SSH（可选）

如果不想每次都输入密钥路径：

```bash
# 在本地 ~/.ssh/config 文件中添加：
Host bbvdle-ec2
    HostName your-server-ip
    User ec2-user
    IdentityFile ~/path/to/your-key.pem

# 然后可以直接使用：
ssh bbvdle-ec2
scp deploy_update.sh bbvdle-ec2:/home/ec2-user/
```

### 2. 创建快捷命令别名

在服务器上添加到 `~/.bashrc`：

```bash
# SSH连接到服务器
nano ~/.bashrc

# 添加以下行：
alias update-bbvdle='~/deploy_update.sh main'
alias update-bbvdle-dev='~/deploy_update.sh dev'

# 保存后执行
source ~/.bashrc

# 之后可以直接使用：
update-bbvdle
```

### 3. 添加日志记录

修改脚本，添加日志功能：

```bash
# 在脚本开头添加日志文件
LOG_FILE="/home/ec2-user/bbvdle-update.log"

# 在执行命令时添加日志
echo "$(date): 开始更新" >> "$LOG_FILE"
git pull origin "$BRANCH" >> "$LOG_FILE" 2>&1
```

## 五、完整工作流程示例

### 典型更新流程

```bash
# === 本地操作 ===
# 1. 修改代码
# 2. 提交并推送
git add .
git commit -m "修复登录bug"
git push origin main

# === 服务器操作 ===
# 3. SSH连接
ssh -i your-key.pem ec2-user@your-server-ip

# 4. 运行更新脚本
~/deploy_update.sh main

# 5. 验证更新
curl http://localhost:5000/api/auth/verify
# 或访问前端页面检查

# 6. 查看日志（如有问题）
sudo journalctl -u bbvdle-backend -n 50
sudo tail -f /var/log/httpd/error_log
```

## 六、安全检查建议

1. **定期备份数据库**
   ```bash
   cp ~/bbvdle/data/bbvdle.db ~/bbvdle/data/bbvdle.db.backup.$(date +%Y%m%d)
   ```

2. **更新前检查Git差异**
   ```bash
   cd ~/bbvdle
   git fetch origin
   git diff main origin/main
   ```

3. **在测试环境先验证**
   - 如果有dev分支，先在dev环境测试
   - 确认无误后再更新生产环境

4. **保留回滚方案**
   ```bash
   # 如果需要回滚
   cd ~/bbvdle
   git log  # 查看提交历史
   git reset --hard <previous-commit-hash>
   ~/deploy_update.sh main
   ```

---

**提示**：首次使用前，建议在测试环境或非生产时间先测试一次，确保脚本正常工作。

