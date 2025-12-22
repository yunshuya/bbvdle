#!/bin/bash
# 修复网络搭建页面"清空"功能问题的脚本
# 解决浏览器缓存和Apache文件更新问题

set -e

echo "=========================================="
echo "修复网络搭建页面'清空'功能问题"
echo "=========================================="

PROJECT_DIR="/home/ec2-user/bbvdle"
APACHE_DIR="/var/www/html"

cd "$PROJECT_DIR"

echo "1. 检查并重新构建项目..."
npm run build

echo "2. 检查构建产物..."
if [ ! -f "dist/bundle.js" ]; then
    echo "   错误: bundle.js 不存在！"
    exit 1
fi

# 获取文件修改时间
BUNDLE_TIME=$(stat -c %Y dist/bundle.js)
echo "   bundle.js 最后修改时间: $(date -d @$BUNDLE_TIME)"

echo "3. 备份Apache目录中的旧文件..."
sudo mkdir -p "$APACHE_DIR/backup_$(date +%Y%m%d_%H%M%S)"
sudo cp -r "$APACHE_DIR"/* "$APACHE_DIR/backup_$(date +%Y%m%d_%H%M%S)/" 2>/dev/null || true

echo "4. 清理Apache目录中的旧文件（保留必要的配置文件）..."
# 只删除前端相关文件，保留可能的配置文件
sudo rm -rf "$APACHE_DIR/dist" "$APACHE_DIR/src" "$APACHE_DIR/node_modules" 2>/dev/null || true
sudo rm -f "$APACHE_DIR/bundle.js" "$APACHE_DIR/index.html" 2>/dev/null || true

echo "5. 复制最新文件到Apache目录..."
# 只复制必要的文件
sudo cp -r dist "$APACHE_DIR/"
sudo cp index.html "$APACHE_DIR/"
sudo cp -r data "$APACHE_DIR/" 2>/dev/null || true

# 确保dist目录中的文件也被复制到Apache的dist目录
if [ -d "$PROJECT_DIR/dist" ]; then
    sudo cp -r "$PROJECT_DIR/dist"/* "$APACHE_DIR/dist/"
fi

echo "6. 设置正确的文件权限..."
sudo chown -R apache:apache "$APACHE_DIR"
sudo chmod -R 755 "$APACHE_DIR"

echo "7. 配置Apache禁用缓存（对JavaScript和CSS文件）..."
# 创建或更新.htaccess文件
sudo bash -c "cat > $APACHE_DIR/.htaccess << 'EOF'
# 禁用JavaScript和CSS文件的缓存
<FilesMatch \"\.(js|css)$\">
    Header set Cache-Control \"no-cache, no-store, must-revalidate\"
    Header set Pragma \"no-cache\"
    Header set Expires \"0\"
</FilesMatch>

# 禁用HTML文件的缓存
<FilesMatch \"\.(html|htm)$\">
    Header set Cache-Control \"no-cache, no-store, must-revalidate\"
    Header set Pragma \"no-cache\"
    Header set Expires \"0\"
</FilesMatch>
EOF"

# 确保Apache启用了headers模块
sudo a2enmod headers 2>/dev/null || {
    echo "   注意: 无法启用headers模块，可能需要手动配置"
}

echo "8. 重新加载Apache配置..."
sudo systemctl reload httpd

echo "9. 验证文件..."
echo "   检查 bundle.js 是否存在:"
if [ -f "$APACHE_DIR/dist/bundle.js" ]; then
    APACHE_BUNDLE_TIME=$(stat -c %Y "$APACHE_DIR/dist/bundle.js")
    echo "   ✓ Apache目录中的 bundle.js 最后修改时间: $(date -d @$APACHE_BUNDLE_TIME)"
    
    if [ "$BUNDLE_TIME" -eq "$APACHE_BUNDLE_TIME" ]; then
        echo "   ✓ 文件时间戳匹配，更新成功"
    else
        echo "   ⚠ 警告: 文件时间戳不匹配，可能需要重新复制"
    fi
else
    echo "   ✗ 错误: Apache目录中找不到 bundle.js"
    exit 1
fi

echo ""
echo "=========================================="
echo "修复完成！"
echo "=========================================="
echo ""
echo "下一步操作："
echo "1. 在浏览器中按 Ctrl+Shift+R (Windows/Linux) 或 Cmd+Shift+R (Mac) 强制刷新"
echo "2. 或者清除浏览器缓存："
echo "   - Chrome: 设置 > 隐私和安全 > 清除浏览数据 > 选择'缓存的图片和文件'"
echo "   - Firefox: 设置 > 隐私与安全 > Cookie和网站数据 > 清除数据"
echo "3. 测试'清空'功能是否正常工作"
echo ""
echo "如果问题仍然存在，请检查："
echo "- 浏览器控制台是否有JavaScript错误"
echo "- 网络标签页中 bundle.js 的响应头是否包含 'Cache-Control: no-cache'"
echo "- Apache错误日志: sudo tail -f /var/log/httpd/error_log"
echo "=========================================="

