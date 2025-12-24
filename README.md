# 基于可视化积木编程的深度学习教学平台

项目改进自开源项目 [ENNUI](https://github.com/martinjm97/ENNUI)，是一个基于浏览器的神经网络可视化教学平台，允许用户：

- 🎨 使用拖放界面构建神经网络架构
- 📚 循序渐进地学习神经网络搭建方法
- 🚀 在浏览器中训练这些网络
- 📊 可视化训练过程和结果
- 🤖 集成AI助手辅助学习

## 技术栈

### 前端
- **TypeScript** - 类型安全的JavaScript
- **Webpack 4** - 模块打包工具
- **SCSS** - CSS预处理器
- **TensorFlow.js** - 浏览器端机器学习框架
- **D3.js** - 数据可视化库

### 后端
- **Flask** - Python Web框架
- **SQLite** - 轻量级数据库
- **ZhipuAI** - 智谱AI大模型API

## 项目结构

```
bbvdle/
├── src/                    # 源代码目录
│   ├── ui/                # 前端UI组件
│   │   ├── auth/          # 用户认证模块
│   │   ├── shapes/        # 可拖拽组件（层、激活函数等）
│   │   ├── app.ts         # 主应用入口
│   │   └── style.scss     # 样式文件
│   └── model/             # 后端核心功能
│       ├── GLM.py         # Flask后端服务（AI助手+认证）
│       ├── database.py    # 数据库操作
│       ├── auth_utils.py  # 认证工具函数
│       └── *.ts           # TypeScript模型文件
├── built/                  # TypeScript编译输出
├── dist/                   # Webpack打包输出
│   ├── bundle.js          # 打包后的JavaScript文件
│   ├── ip.txt             # 后端服务IP配置
│   └── zhipuai_key.txt    # AI API密钥配置
├── data/                   # 数据目录
│   └── bbvdle.db          # SQLite数据库文件
├── resources/              # 静态资源
├── index.html             # 主HTML文件
├── package.json           # Node.js依赖配置
├── requirements.txt       # Python依赖配置
├── webpack.config.js      # Webpack配置
├── tsconfig.json          # TypeScript配置
└── build_prod.sh          # 生产环境构建脚本
```

## 环境要求

### 必需环境
- **Node.js**: v13.14.0（必须使用此版本）
- **Python**: 3.8
- **npm**: 随Node.js安装

### 可选工具
- **Visual Studio Build Tools**（Windows下安装canvas依赖时需要）
- **Apache**（Linux生产环境部署时需要）

## 部署流程

### 一、Windows本地开发环境部署

#### 1. 安装Node.js

下载并安装 [Node.js v13.14.0](https://pan.baidu.com/s/1Cvkd-Bclmcj0SRWhz5nFAg?pwd=okb3)（Windows x64版本）

**注意**：必须使用 v13.14.0 版本，其他版本可能导致依赖安装失败。

#### 2. 安装Python环境

```bash
# 确保Python版本为3.8
python --version
```

#### 3. 克隆项目

```bash
git clone --recursive https://github.com/yunshuya/bbvdle.git
cd bbvdle

# 安装Python依赖
pip install -r requirements.txt
```

#### 4. 安装前端依赖

```bash
# 如果canvas安装失败，使用以下命令跳过原生模块编译
npm install --ignore-scripts

# 或者单独安装canvas
npm install canvas@2.8.0 --ignore-scripts
npm install
```

#### 5. 配置后端服务

**配置AI助手API密钥**：
```bash
# 编辑 dist/zhipuai_key.txt，填入你的智谱AI API密钥
# 申请地址：https://open.bigmodel.cn/usercenter/proj-mgmt/apikeys
echo "your-api-key-here" > dist/zhipuai_key.txt
```

**配置后端服务地址**（本地开发）：
```bash
# 编辑 dist/ip.txt，设置为 localhost
echo "localhost" > dist/ip.txt
```

**修改后端代码**：
- 编辑`src/model/GLM.py`文件

```bash
# 把部署服务器的代码注释掉，保留本地的那一行的代码
if __name__ == "__main__":
    # 本地测试使用以下代码
    app.run(debug=True, port=5000)
    
    # 部署到服务器使用以下代码
    # app.run(debug=False, host="0.0.0.0", port=5000)
```

#### 6. 构建项目

```bash
# 构建前端资源（编译TypeScript、打包Webpack、编译SCSS）
npm run build
```

构建过程包括：
- TypeScript编译：`tsc --skipLibCheck`
- Webpack打包：`webpack --mode development`
- SCSS编译：`node-sass src/ui -o src/ui`

#### 7. 启动开发服务器

**方式一：使用http-server**
```bash
# 全局安装http-server
npm install -g http-server

# 启动服务器（端口8080）
http-server . -p 8080
```

**方式二：使用VS Code插件**
- 安装 `Live Server` 或 `Five Server` 插件
- 右键点击 `index.html`，选择 "Open with Live Server"

#### 8. 启动后端服务

```bash
# 切换到项目根目录
cd bbvdle

# 启动Flask后端服务（默认端口5000）
python src/model/GLM.py
```

---

### 二、Linux生产环境部署（AWS EC2）

#### 1. 系统准备

```bash
# 更新系统
sudo yum update -y

# 安装Git
sudo yum install git -y
```

#### 2. 安装Node.js

```bash
# 使用fnm（Fast Node Manager）安装Node.js 13
curl -fsSL https://fnm.vercel.app/install | bash
source ~/.bashrc
fnm use --install-if-missing 13

# 验证安装
node --version  # 应显示 v13.14.0
npm --version
```

#### 3. 安装Python 3.8

```bash
# 下载Miniconda
wget https://mirrors.tuna.tsinghua.edu.cn/anaconda/miniconda/Miniconda3-py38_23.10.0-1-Linux-x86_64.sh

# 安装Miniconda
bash Miniconda3-py38_23.10.0-1-Linux-x86_64.sh
source ~/.bashrc

# 创建Python虚拟环境
python3.8 -m venv py38_env
source py38_env/bin/activate

# 安装Python依赖
pip install -r requirements.txt
```

#### 4. 部署前端项目

**一、首次部署**

```bash
# 克隆项目
git clone --recursive https://github.com/yunshuya/bbvdle.git
cd bbvdle

# 安装依赖
npm install --ignore-scripts
npm rebuild node-sass

# 构建项目
npm run build

# 方式一：使用配置脚本（推荐）
chmod +x setup_cloud_config.sh
./setup_cloud_config.sh

# 方式二：手动配置
# 1. 配置后端IP地址（替换为实际公网IP）
echo "your-server-public-ip" > dist/ip.txt

# 2. 配置AI API密钥
echo "your-zhipuai-api-key" > dist/zhipuai_key.txt

# 3. 修改src/model/GLM.py文件
# 编辑文件，将部署代码取消注释，本地代码注释掉：
# if __name__ == "__main__":
#     # 本地测试使用以下代码
#     # app.run(debug=True, port=5000)
#     
#     # 部署到服务器使用以下代码
#     app.run(debug=False, host="0.0.0.0", port=5000)

```

**二、部署后进行日常维护**

```bash
cd /home/ec2-user/bbvdle
chmod +x deploy_complete.sh

# 如果已经运行过 setup_cloud_config.sh 配置，使用 --skip-sync 跳过代码同步
./deploy_complete.sh --skip-sync

# 或者运行完整部署（包含代码同步）
./deploy_complete.sh
```

脚本会自动完成所有部署步骤（见下方"项目维护"章节）。

#### 5. 配置Apache Web服务器

```bash
# 安装Apache
sudo yum install -y httpd

# 复制项目文件到Apache根目录
sudo cp -r /home/ec2-user/bbvdle/dist /var/www/html/
sudo cp -r /home/ec2-user/bbvdle/src/ui /var/www/html/src/
sudo cp /home/ec2-user/bbvdle/index.html /var/www/html/
sudo cp -r /home/ec2-user/bbvdle/resources /var/www/html/ 2>/dev/null || true

# 设置文件权限
sudo chown -R apache:apache /var/www/html/
sudo chmod -R 755 /var/www/html/

# 配置缓存控制
sudo bash -c "cat > /var/www/html/.htaccess << 'EOF'
<FilesMatch \"\.(js|css)$\">
    Header set Cache-Control \"no-cache, no-store, must-revalidate\"
    Header set Pragma \"no-cache\"
    Header set Expires \"0\"
</FilesMatch>
EOF"

# 启动Apache服务
sudo systemctl start httpd
sudo systemctl enable httpd  # 设置开机自启
sudo systemctl reload httpd
```

#### 6. 配置防火墙和安全组

**AWS EC2安全组配置**：
- 添加入站规则：HTTP (80端口)
- 添加入站规则：HTTPS (443端口，如使用SSL)
- 添加入站规则：自定义TCP (5000端口，后端API)

**本地防火墙配置**（如需要）：
```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

#### 7. 部署后端服务

**修改后端配置**：
编辑 `src/model/GLM.py`，确保 `host` 设置为 `"0.0.0.0"` 以允许外部访问：

```python
if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=False)
```

**使用nohup后台运行**（推荐方式）：

```bash
cd /home/ec2-user/bbvdle

# 停止可能正在运行的进程
pkill -f "python.*GLM.py" || true

# 激活虚拟环境（如果存在）
source py38_env/bin/activate

# 启动后端服务
nohup python src/model/GLM.py > backend.log 2>&1 &

# 查看日志
tail -f backend.log
```

**管理后端服务**：

```bash
# 查看服务状态
ps aux | grep "python.*GLM.py"

# 停止服务
pkill -f "python.*GLM.py"

# 查看日志
tail -f /home/ec2-user/bbvdle/backend.log

# 重启服务
pkill -f "python.*GLM.py"
cd /home/ec2-user/bbvdle
source py38_env/bin/activate
nohup python src/model/GLM.py > backend.log 2>&1 &
```

#### 8. 验证部署

- 前端访问：`http://your-server-ip`
- 后端API测试：`http://your-server-ip:5000/api/health`（如配置了健康检查）

---

### 三、生产环境构建（优化版本）

使用提供的构建脚本生成生产版本：

```bash
# 赋予执行权限
chmod +x build_prod.sh

# 执行构建
./build_prod.sh
```

构建脚本会：
1. 执行 `npm run build`
2. 创建 `prod/` 目录
3. 复制并优化 `index.html`
4. 压缩CSS和JavaScript文件
5. 复制所有dist资源

生产版本位于 `prod/` 目录，可直接部署到Web服务器。

---

## 常见问题排查

### 1. npm install 失败（canvas无法安装）

**错误信息**：
```
gyp ERR! find VS could not find any Visual Studio installation to use
```

**解决方案**：
```bash
# 方法一：跳过原生模块编译（推荐）
npm install --ignore-scripts

# 方法二：单独安装canvas
npm config set proxy false
npm cache clean --force
npm install canvas@2.8.0 --ignore-scripts
npm install
```

### 2. npm run build 失败（node-sass编译错误）

**解决方案**：
```bash
# 方法一：重新构建node-sass
npm rebuild node-sass

# 方法二：重新安装node-sass
npm uninstall node-sass
npm cache clean --force
npm install node-sass@4.14.1
```

### 3. 后端服务无法启动

**检查项**：
- Python版本是否为3.8
- 是否安装了所有依赖：`pip install -r requirements.txt`
- API密钥文件是否存在：`dist/zhipuai_key.txt`
- 数据库文件权限是否正确
- 端口5000是否被占用

### 4. 前端无法连接后端

**检查项**：
- `dist/ip.txt` 中的IP地址是否正确
- 后端服务是否正在运行
- 防火墙/安全组是否开放5000端口
- 浏览器控制台是否有CORS错误

### 5. 数据库相关错误

**解决方案**：
```bash
# 删除旧数据库，重新初始化
rm data/bbvdle.db
python src/model/GLM.py  # 会自动创建新数据库
```

---

## 开发命令参考

### npm脚本

```bash
# 构建项目
npm run build

# 编译SCSS
npm run scss

# 监听SCSS变化
npm run scss-watch

# 监听TypeScript变化
npm run ts-watch

# 监听Webpack变化
npm run webpack-watch

# 同时监听所有变化（开发模式）
npm run watch
```

### Python后端

```bash
# 启动开发服务器
python src/model/GLM.py

# 测试认证API（如存在测试脚本）
python test_auth_api.py
```

---

## 项目维护

### 完整部署脚本

**一键部署脚本** - 整合了所有部署步骤：

```bash
cd /home/ec2-user/bbvdle
chmod +x deploy_complete.sh

# 完整部署（包含代码同步）
./deploy_complete.sh

# 跳过代码同步，直接部署（推荐在配置完成后使用）
./deploy_complete.sh --skip-sync

# 使用指定分支
./deploy_complete.sh develop
./deploy_complete.sh develop --skip-sync
```

这个脚本会自动完成：
1. ✅ 同步代码（使用 `--skip-sync` 可跳过此步骤）
2. ✅ 安装和更新依赖（npm 和 Python）
3. ✅ 构建项目（生成 `style.css` 和 `bundle.js`）
4. ✅ 备份Apache目录
5. ✅ 复制所有必要文件到Apache目录
6. ✅ 设置文件权限
7. ✅ 配置Apache缓存控制
8. ✅ 重启Apache和后端服务
9. ✅ 验证部署结果

**重要说明**：
- **使用 `--skip-sync` 选项**：跳过代码同步，直接使用当前代码进行部署（推荐在运行 `setup_cloud_config.sh` 后使用）
- **不使用 `--skip-sync`**：会同步代码，但会保留本地修改的 `dist/ip.txt`、`dist/zhipuai_key.txt` 和 `src/model/GLM.py`
- `dist/ip.txt` 会被自动备份和恢复（服务器特定配置）


### 更新依赖

```bash
# 更新npm依赖
npm update

# 更新Python依赖
pip install -r requirements.txt --upgrade
```

### 数据库备份

```bash
# 备份数据库
cp data/bbvdle.db data/bbvdle.db.backup

# 恢复数据库
cp data/bbvdle.db.backup data/bbvdle.db
```

### 日志查看

```bash
# 查看后端服务日志（nohup方式）
tail -f /home/ec2-user/bbvdle/backend.log

# 查看后端服务状态
ps aux | grep "python.*GLM.py"

# 查看Apache错误日志
sudo tail -f /var/log/httpd/error_log

# 查看Apache访问日志
sudo tail -f /var/log/httpd/access_log
```

---
