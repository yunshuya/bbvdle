# 团队任务分工表 - RNN功能改进

## 📌 项目目标
为深度学习教学平台添加RNN（循环神经网络）支持，包括：
1. RNN层组件（✅ 已完成）
2. RNN网络模板
3. RNN教学任务步骤
4. 错误处理与提示
5. 序列数据支持（可选）

---

## 👥 成员分工

### 成员A：RNN模板与UI集成 👤

**负责模块：** UI层组件与模板

**任务清单：**

#### ✅ 已完成
- [x] SimpleRNN、LSTM、GRU三层组件实现
- [x] 在 `app.ts` 中注册RNN层

#### 🔄 待完成
- [ ] **任务1：创建RNN模板**
  - 文件：`src/ui/model_templates.ts`
  - 功能：添加 `rnnTemplate()` 函数
  - 架构示例：`Input → SimpleRNN(+relu) → Dense(+relu) → Output`
  - 参考：`defaultTemplate()` 和 `resnetTemplate()` 的实现

- [ ] **任务2：在模板菜单注册**
  - 文件：`src/ui/app.ts`
  - 功能：在 `createTemplate()` 中添加 `case "rnn": rnnTemplate(svgData);`
  - 注意：需确认HTML中是否有对应的菜单项

- [ ] **任务3：测试模板功能**
  - 验证：点击模板后能正确生成RNN网络
  - 验证：网络可以正常训练（可能需要序列数据）

**预计工作量：** 2-3小时

**依赖关系：** 无（可独立开发）

**可能冲突：** 如果修改 `app.ts` 的 `createTemplate()`，需先与成员D沟通

---

### 成员B：序列化与代码导出 👤

**负责模块：** 网络构建与导出

**任务清单：**

#### ✅ 已完成
- [x] RNN层在 `export_model.ts` 中的反序列化支持

#### 🔄 待完成
- [ ] **任务1：完善Python代码生成**
  - 文件：`src/model/code_generation.ts`
  - 功能：确保RNN层的Python代码格式正确
  - 检查：`SimpleRNN(units=32, return_sequences=False, activation='relu')`
  - 注意：`returnSequences` 需转换为Python的布尔值

- [ ] **任务2：Julia导出处理**
  - 文件：`src/ui/shapes/layers/*.ts`
  - 功能：目前RNN层返回注释，确认是否需要改进
  - 决定：是否实现Julia支持，或保持"不支持"状态

- [ ] **任务3：测试导出功能**
  - 验证：导出Python代码可以正常运行
  - 验证：序列化/反序列化RNN网络正常工作

**预计工作量：** 2-3小时

**依赖关系：** 依赖成员A的RNN层组件（已完成）

**可能冲突：** 如果修改 `code_generation.ts`，需注意与其他层导出逻辑的一致性

---

### 成员C：教学任务系统 👤

**负责模块：** 任务步骤与验证

**任务清单：**

#### 🔄 待完成
- [ ] **任务1：设计RNN教学任务步骤**
  - 文件：`dist/tasksteps.json`
  - 功能：添加 `"RNN"` 任务数组
  - 步骤示例：
    ```json
    {
      "step": "添加Input层",
      "requiredBlock": "input",
      "completed": false
    },
    {
      "step": "添加SimpleRNN层，设置units=32",
      "requiredBlock": "simplernn",
      "completed": false
    },
    {
      "step": "连接SimpleRNN到Dense层",
      "requiredBlock": "dense",
      "completed": false,
      "parentLayer": "simplernn"
    },
    {
      "step": "连接Dense到Output层",
      "requiredBlock": "output",
      "completed": false,
      "parentLayer": "dense"
    }
    ```

- [ ] **任务2：扩展验证逻辑**
  - 文件：`src/ui/taskModule.ts`
  - 功能：在 `verifyStepCompletion()` 中支持RNN层类型识别
  - 检查：`itemname === "simplernn" || itemname === "lstm" || itemname === "gru"`

- [ ] **任务3：更新任务映射**
  - 文件：`src/ui/taskModule.ts`
  - 功能：在 `taskMapping` 中添加 `RNN: "循环神经网络"`

- [ ] **任务4：测试任务流程**
  - 验证：选择RNN任务后，步骤列表正确显示
  - 验证：添加对应层后，步骤自动标记完成

**预计工作量：** 3-4小时

**依赖关系：** 依赖成员A的RNN层组件（已完成）

**可能冲突：** `tasksteps.json` 是JSON文件，多人编辑需注意格式

---

### 成员D：错误处理与验证 👤

**负责模块：** 错误提示与网络验证

**任务清单：**

#### 🔄 待完成
- [ ] **任务1：RNN多父输入检查**
  - 文件：`src/ui/shapes/layers/simplernn.ts`（以及LSTM、GRU）
  - 功能：重写 `generateTfjsLayer()` 或添加检查
  - 逻辑：RNN层不支持多父输入（需使用Concatenate合并）
  - 提示：`"RNN层不支持多个输入，请使用Concatenate层合并后再连接RNN"`

- [ ] **任务2：RNN形状错误提示**
  - 文件：`src/model/build_network.ts` 或各RNN层
  - 功能：捕获TFJS形状错误，转换为友好提示
  - 提示：`"RNN层需要序列输入，请确保输入形状为 (timesteps, features)"`

- [ ] **任务3：returnSequences参数验证**
  - 文件：`src/ui/shapes/layers/*.ts`（RNN层）
  - 功能：当 `returnSequences=true` 时，检查子层是否支持序列输入
  - 提示：`"returnSequences=true时，后续层需要支持序列输入，或添加Flatten层"`

- [ ] **任务4：测试错误提示**
  - 验证：各种错误场景都能显示清晰提示
  - 验证：错误提示不影响正常功能

**预计工作量：** 3-4小时

**依赖关系：** 依赖成员A的RNN层组件（已完成）

**可能冲突：** 如果修改RNN层的 `generateTfjsLayer()`，需与成员A确认

---

### 成员E：序列数据支持（可选） 👤

**负责模块：** 数据管理与AI助手

**任务清单：**

#### 🔄 待完成（可选）
- [ ] **任务1：序列数据模式**
  - 文件：`src/model/data.ts`
  - 功能：为MNIST提供序列视角（28×28 → 28步×28特征）
  - 或：添加新的简单序列数据集

- [ ] **任务2：Input层数据集选择**
  - 文件：`src/ui/shapes/layers/input.ts`
  - 功能：在数据集下拉中添加"序列模式"选项

- [ ] **任务3：训练适配**
  - 文件：`src/model/mnist_model.ts`
  - 功能：确保序列数据能正常训练RNN模型

**预计工作量：** 4-5小时（可选，如果时间允许）

**依赖关系：** 依赖RNN层组件和训练流程

---

## 📅 时间安排建议

### 第一周
- **成员A**：完成RNN模板（2-3小时）
- **成员B**：完善导出功能（2-3小时）
- **成员C**：设计教学任务（3-4小时）
- **成员D**：实现错误处理（3-4小时）

### 第二周（可选）
- **成员E**：序列数据支持（4-5小时）
- **全员**：集成测试、Bug修复、文档更新

---

## 🔗 任务依赖图

```
RNN层组件（成员A，已完成）
    ├── RNN模板（成员A）
    ├── 导出功能（成员B）
    ├── 教学任务（成员C）
    └── 错误处理（成员D）
            └── 序列数据（成员E，可选）
```

---

## ✅ 验收标准

### 功能验收
- [ ] 可以从菜单添加RNN层（SimpleRNN、LSTM、GRU）
- [ ] RNN模板可以一键生成网络
- [ ] 教学任务可以引导用户搭建RNN
- [ ] 错误提示清晰易懂
- [ ] 网络可以导出为Python代码

### 质量验收
- [ ] 代码通过Linter检查
- [ ] 不影响现有CNN/MLP功能
- [ ] 本地测试通过
- [ ] 代码已提交并合并到main分支

---

## 📝 提交规范

### 分支命名
- `feature/rnn-templates` - RNN模板
- `feature/rnn-tasks` - 教学任务
- `feature/rnn-error-handling` - 错误处理
- `feature/rnn-export` - 导出功能

### 提交信息
```
feat: 添加RNN模板功能
feat: 实现RNN教学任务步骤
fix: 修复RNN层多父输入错误提示
docs: 更新RNN功能说明文档
```

---

## 🆘 遇到问题？

1. **代码冲突**：参考 `COLLABORATION_GUIDE.md` 的冲突解决章节
2. **功能不工作**：检查是否从最新的main分支开始
3. **测试失败**：确保所有依赖已安装 `npm install`
4. **不确定怎么做**：查看相似功能的实现（如CNN模板、MLP任务）

