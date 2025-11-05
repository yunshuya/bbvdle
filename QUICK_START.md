# 🚀 快速开始 - 5分钟上手协作开发

## 当前状态

你已经完成了RNN层组件的开发，但代码还未提交。建议按以下步骤处理：

## 步骤1：提交当前工作

```bash
# 1. 查看当前修改
git status

# 2. 添加新文件
git add src/ui/shapes/layers/simplernn.ts
git add src/ui/shapes/layers/lstm.ts
git add src/ui/shapes/layers/gru.ts

# 3. 添加修改的文件
git add src/ui/app.ts
git add src/model/export_model.ts

# 4. 提交（可选：暂时不提交dist/bundle.js等构建产物）
git commit -m "feat: 添加RNN三层组件支持 (SimpleRNN, LSTM, GRU)"
```

## 步骤2：推送到远程并创建功能分支

```bash
# 方案A：直接推送到main（如果团队允许）
git push origin main

# 方案B：创建功能分支（推荐）
git checkout -b feature/rnn-layers
git push origin feature/rnn-layers
# 然后在GitHub创建Pull Request
```

## 步骤3：团队成员协作

### 对于其他成员（从零开始）

```bash
# 1. 克隆项目
git clone https://github.com/sunyia123/bbvdle.git
cd bbvdle

# 2. 安装依赖
npm install

# 3. 构建项目
npm run build

# 4. 创建自己的功能分支
git checkout -b feature/your-feature-name
```

### 对于已有项目的成员（更新代码）

```bash
# 1. 拉取最新代码
git checkout main
git pull origin main

# 2. 如果RNN组件已合并，创建新分支开始开发
git checkout -b feature/your-feature-name
```

## 常用命令速查

```bash
# 查看状态
git status

# 查看分支
git branch

# 切换分支
git checkout branch-name

# 创建并切换分支
git checkout -b feature/new-feature

# 添加文件
git add <file>

# 提交
git commit -m "feat: 功能描述"

# 推送到远程
git push origin branch-name

# 拉取最新代码
git pull origin main

# 合并分支
git merge branch-name
```

## 避免冲突的黄金法则

1. ✅ **每天开始前**：`git pull origin main`
2. ✅ **功能完成后**：立即提交，不要累积
3. ✅ **修改共享文件前**：在群里确认
4. ✅ **提交前**：运行 `npm run build` 确保无错误

## 遇到问题？

- **构建失败**：删除 `node_modules` 和 `built`，重新 `npm install`
- **冲突**：参考 `COLLABORATION_GUIDE.md`
- **不确定**：查看 `TEAM_TASKS.md` 了解任务分工

