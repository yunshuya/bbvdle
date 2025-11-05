# 团队协作开发指南

## 📋 目录
1. [Git 分支策略](#git-分支策略)
2. [代码分工建议](#代码分工建议)
3. [开发工作流程](#开发工作流程)
4. [冲突预防与解决](#冲突预防与解决)
5. [代码审查流程](#代码审查流程)
6. [快速开始](#快速开始)

---

## 🌿 Git 分支策略

### 推荐使用 **Feature 分支工作流**（适合小团队）

```
main (主分支 - 稳定版本)
  ├── feature/rnn-layers (RNN层组件)
  ├── feature/rnn-templates (RNN模板)
  ├── feature/task-validation (任务验证增强)
  ├── feature/error-handling (错误处理改进)
  └── feature/ai-assistant-improve (AI助手优化)
```

### 分支命名规范
- `feature/功能名称` - 新功能开发
- `bugfix/问题描述` - 修复Bug
- `refactor/重构内容` - 代码重构
- `docs/文档说明` - 文档更新

---

## 👥 代码分工建议

### 基于项目结构的功能模块划分

#### **模块1：UI层组件开发** 👤 成员A
**负责文件：**
- `src/ui/shapes/layers/*.ts` - 新增层组件
- `src/ui/shapes/activation.ts` - 激活函数
- `src/ui/model_templates.ts` - 网络模板

**任务示例：**
- ✅ 已完成：RNN三层组件（SimpleRNN、LSTM、GRU）
- 待开发：RNN模板、激活函数扩展

**注意事项：**
- 新增层组件需继承 `ActivationLayer` 或 `Layer`
- 必须实现：`populateParamBox()`, `lineOfPython()`, `generateTfjsLayer()`
- 在 `app.ts` 中注册新组件

---

#### **模块2：网络构建与验证** 👤 成员B
**负责文件：**
- `src/model/build_network.ts` - 网络构建逻辑
- `src/model/export_model.ts` - 序列化/反序列化
- `src/model/code_generation.ts` - 代码生成

**任务示例：**
- 网络合法性校验增强
- RNN层序列化支持
- 错误提示优化

**注意事项：**
- 修改 `build_network.ts` 需确保不影响现有CNN/MLP
- 导出功能需同时支持Python和Julia（或标注不支持）

---

#### **模块3：任务系统与教学** 👤 成员C
**负责文件：**
- `src/ui/taskModule.ts` - 任务步骤验证
- `dist/tasksteps.json` - 任务步骤定义
- `src/ui/app.ts` - 任务相关UI逻辑

**任务示例：**
- 添加RNN教学任务步骤
- 步骤完成验证规则
- 任务面板UI优化

**注意事项：**
- `tasksteps.json` 格式需保持一致
- 验证逻辑需与层组件类型匹配

---

#### **模块4：错误处理与用户提示** 👤 成员D
**负责文件：**
- `src/ui/error.ts` - 错误显示
- `src/ui/shapes/layer.ts` - 层级错误检查
- 各层的 `generateTfjsLayer()` 错误处理

**任务示例：**
- RNN形状不匹配提示
- 多父输入友好错误
- 网络连通性检查

**注意事项：**
- 错误信息需清晰易懂
- 避免阻断用户操作流程

---

#### **模块5：AI助手与数据支持** 👤 成员E（可选）
**负责文件：**
- `src/ui/ai_assistant.ts` - AI助手前端
- `src/model/data.ts` - 数据集管理
- `src/model/GLM.py` - AI后端

**任务示例：**
- AI助手功能增强
- 序列数据支持（RNN训练用）

---

## 🔄 开发工作流程

### 1. 开始新功能开发

```bash
# 1. 确保本地代码是最新的
git checkout main
git pull origin main

# 2. 创建功能分支
git checkout -b feature/rnn-templates

# 3. 开发功能...
# （编辑文件、测试等）

# 4. 提交代码
git add .
git commit -m "feat: 添加RNN模板功能"

# 5. 推送到远程
git push origin feature/rnn-templates
```

### 2. 合并到主分支（通过 Pull Request）

```bash
# 在GitHub上创建Pull Request
# 1. 进入仓库页面
# 2. 点击 "Pull requests" -> "New pull request"
# 3. 选择 base: main <- compare: feature/rnn-templates
# 4. 填写PR描述，请求代码审查
# 5. 等待审查通过后合并
```

### 3. 合并后清理

```bash
# 1. 切换回主分支
git checkout main

# 2. 拉取最新代码（包含你的PR）
git pull origin main

# 3. 删除本地功能分支（可选）
git branch -d feature/rnn-templates

# 4. 删除远程分支（可选）
git push origin --delete feature/rnn-templates
```

---

## ⚠️ 冲突预防与解决

### 预防冲突的方法

1. **及时同步主分支**
   ```bash
   # 每天开始工作前
   git checkout main
   git pull origin main
   git checkout feature/your-branch
   git merge main  # 或 git rebase main
   ```

2. **模块化开发**
   - 每个成员负责不同模块，减少文件重叠
   - 如必须修改共享文件，先沟通协调

3. **小步提交**
   - 功能完成后立即提交，不要累积大量改动
   - 提交信息清晰，便于追踪

### 解决冲突的步骤

```bash
# 1. 拉取最新代码发现冲突
git pull origin main

# 2. 打开冲突文件，Git会标记冲突位置
# <<<<<<< HEAD
# 你的代码
# =======
# 其他人的代码
# >>>>>>> branch-name

# 3. 手动解决冲突，保留需要的代码，删除标记

# 4. 标记冲突已解决
git add <冲突文件>

# 5. 完成合并
git commit -m "merge: 解决与main分支的冲突"
```

---

## 🔍 代码审查流程

### Pull Request 检查清单

- [ ] 代码符合项目风格（TypeScript规范）
- [ ] 没有引入新的Linter错误
- [ ] 功能测试通过（本地运行验证）
- [ ] 不破坏现有功能（CNN/MLP仍可正常使用）
- [ ] 提交信息清晰（使用约定格式）

### 提交信息格式

```
feat: 添加RNN层组件支持
fix: 修复网络构建时的形状错误
docs: 更新README部署说明
refactor: 重构错误处理逻辑
```

---

## 🚀 快速开始

### 首次克隆项目

```bash
git clone https://github.com/sunyia123/bbvdle.git
cd bbvdle
npm install
npm run build
```

### 日常开发流程

```bash
# 1. 更新代码
git checkout main
git pull origin main

# 2. 创建功能分支
git checkout -b feature/your-feature-name

# 3. 开发并测试
# ... 修改代码 ...
npm run build  # 构建检查

# 4. 提交并推送
git add .
git commit -m "feat: 你的功能描述"
git push origin feature/your-feature-name

# 5. 在GitHub创建PR
```

---

## 📝 重要文件修改注意事项

### 高冲突风险文件（需协调）

1. **`src/ui/app.ts`**
   - 多人可能同时添加菜单项
   - 建议：先沟通，一人负责注册逻辑

2. **`src/model/export_model.ts`**
   - 序列化/反序列化逻辑
   - 建议：按层类型分工，一人负责一类

3. **`dist/tasksteps.json`**
   - 任务步骤定义
   - 建议：使用JSON格式，避免手动编辑冲突

### 低冲突风险文件（可并行开发）

- `src/ui/shapes/layers/*.ts` - 各层组件独立
- `src/ui/shapes/activation.ts` - 激活函数独立
- `src/ui/taskModule.ts` - 任务验证逻辑相对独立

---

## 🎯 当前项目状态

### 已完成
- ✅ RNN三层组件（SimpleRNN、LSTM、GRU）
- ✅ 基础网络搭建功能

### 待开发（建议分工）
- [ ] RNN模板功能
- [ ] RNN任务步骤定义
- [ ] 错误处理增强
- [ ] 序列数据支持

---

## 💡 协作建议

1. **每日同步**：每天开始前拉取最新代码
2. **及时沟通**：修改共享文件前在群里确认
3. **小步迭代**：功能完成后立即提交，不要等到完美
4. **测试验证**：提交前本地测试，确保不影响现有功能
5. **文档更新**：重要功能变更需更新README

---

## 📞 遇到问题？

- Git冲突：参考“冲突预防与解决”章节
- 功能不工作：检查是否从main分支最新代码开始
- 构建失败：检查依赖是否安装完整 `npm install`

