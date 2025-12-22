# 修复网络搭建页面"清空"功能问题

## 问题描述

在云服务器部署后，网络搭建页面的"清空"功能无法正常工作：
- 页面加载时显示默认模板
- 点击"清空"无法清除默认模板，只能清除input和output
- 切换到其他模板时，原来的模板还在，页面同时出现两个模板
- 再次点击"清空"，后加的模板被清空，但原始模板始终存在

**注意**：这个问题在本地部署时不存在。

## 问题原因

1. **浏览器缓存**：浏览器缓存了旧版本的 `bundle.js`，导致前端代码没有更新
2. **Apache文件未更新**：Apache目录中的文件可能没有正确更新
3. **Apache缓存配置**：Apache可能配置了缓存，导致浏览器一直使用旧文件

## 解决方案

### 方案1：使用修复脚本（推荐）

在云服务器上执行：

```bash
cd /home/ec2-user/bbvdle
chmod +x fix_template_clear_issue.sh
./fix_template_clear_issue.sh
```

这个脚本会：
1. 重新构建项目
2. 清理Apache目录中的旧文件
3. 复制最新文件到Apache目录
4. 配置Apache禁用JavaScript和CSS文件的缓存
5. 重新加载Apache配置

### 方案2：手动修复

#### 步骤1：重新构建项目

```bash
cd /home/ec2-user/bbvdle
npm run build
```

#### 步骤2：清理并更新Apache目录

```bash
# 清理旧文件
sudo rm -rf /var/www/html/dist /var/www/html/src /var/www/html/node_modules
sudo rm -f /var/www/html/bundle.js

# 复制最新文件
sudo cp -r /home/ec2-user/bbvdle/dist /var/www/html/
sudo cp /home/ec2-user/bbvdle/index.html /var/www/html/

# 设置权限
sudo chown -R apache:apache /var/www/html
sudo chmod -R 755 /var/www/html
```

#### 步骤3：配置Apache禁用缓存

创建或编辑 `/var/www/html/.htaccess`：

```apache
# 禁用JavaScript和CSS文件的缓存
<FilesMatch "\.(js|css)$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
    Header set Pragma "no-cache"
    Header set Expires "0"
</FilesMatch>

# 禁用HTML文件的缓存
<FilesMatch "\.(html|htm)$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
    Header set Pragma "no-cache"
    Header set Expires "0"
</FilesMatch>
```

确保Apache启用了headers模块：

```bash
sudo a2enmod headers  # Debian/Ubuntu
# 或
sudo yum install mod_headers  # CentOS/RHEL/Amazon Linux
```

#### 步骤4：重新加载Apache

```bash
sudo systemctl reload httpd
```

### 方案3：清除浏览器缓存

如果文件已经更新，但浏览器仍使用旧版本：

1. **强制刷新**：
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

2. **清除浏览器缓存**：
   - Chrome: 设置 > 隐私和安全 > 清除浏览数据 > 选择"缓存的图片和文件"
   - Firefox: 设置 > 隐私与安全 > Cookie和网站数据 > 清除数据
   - Edge: 设置 > 隐私、搜索和服务 > 清除浏览数据

3. **使用无痕模式测试**：
   - 打开浏览器的无痕/隐私模式，访问网站测试

## 代码改进

已改进 `src/ui/model_templates.ts` 中的 `resetWorkspace` 函数，确保：
1. 先断开所有层的连接关系，避免删除时出现引用问题
2. 使用数组副本遍历，避免在删除过程中修改数组
3. 添加错误处理，避免删除失败导致的问题

## 验证修复

修复后，请验证以下功能：

1. **清空功能**：
   - 进入网络搭建页面
   - 点击"清空"按钮
   - 应该只保留input和output层，其他层都被清除

2. **模板切换**：
   - 点击"默认模板"
   - 点击"清空"
   - 应该只保留input和output层
   - 点击其他模板（如"ResNet"）
   - 应该只显示新模板，没有旧模板残留

3. **浏览器控制台**：
   - 打开浏览器开发者工具（F12）
   - 查看网络标签页
   - 刷新页面
   - 检查 `bundle.js` 的响应头是否包含 `Cache-Control: no-cache`

## 预防措施

1. **更新部署脚本**：`deploy_update.sh` 已更新，会自动配置缓存控制
2. **版本号**：考虑在 `bundle.js` 文件名中添加版本号或时间戳（如 `bundle.v1.2.3.js`）
3. **定期清理**：定期清理Apache目录中的旧文件

## 相关文件

- `src/ui/model_templates.ts` - 清空功能的实现
- `fix_template_clear_issue.sh` - 修复脚本
- `deploy_update.sh` - 更新后的部署脚本
- `/var/www/html/.htaccess` - Apache缓存配置

## 如果问题仍然存在

1. **检查浏览器控制台**：查看是否有JavaScript错误
2. **检查网络请求**：确认 `bundle.js` 是否从服务器正确加载
3. **检查Apache日志**：`sudo tail -f /var/log/httpd/error_log`
4. **检查文件时间戳**：确认Apache目录中的文件是否是最新的
5. **联系支持**：如果以上方法都无法解决问题，请提供详细的错误信息

