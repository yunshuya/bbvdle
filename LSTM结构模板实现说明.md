# LSTM结构模板实现说明

## 概述

LSTM结构模板（前端显示名称：**LSTM结构模版**）是一个专门为训练 AirPassengers 数据集设计的模板。它既展示了 LSTM 内部结构的关键概念（通过循环连接可视化），又使用实际的 LSTM 层进行训练，确保能够正确训练时序数据。

## 设计理念

### 双重设计

1. **实际训练层**：使用 TensorFlow.js 的 LSTM 层进行实际训练
   - 确保模型能够正确构建和训练
   - 保证与 AirPassengers 数据集的兼容性

2. **可视化组件**：添加循环连接和占位层展示 LSTM 内部结构
   - 帮助用户理解 LSTM 的循环机制
   - 展示 H_t 和 C_t 如何传递到下一时刻

## 模板结构

### 实际训练流程

```
Input (AirPassengers数据)
  ↓
LSTM (64 units, timestep=12)
  ↓
Dense (1 unit, 无激活函数)
  ↓
Output (回归输出)
```

### 可视化组件

- **H_{t-1} 占位层**：展示前一时刻的隐藏状态
- **C_{t-1} 占位层**：展示前一时刻的记忆状态
- **循环连接**：
  - `H_t → H_{t+1}`：从 LSTM 层到 H_{t-1} 占位层
  - `C_t → C_{t+1}`：从 LSTM 层到 C_{t-1} 占位层

## 关键特性

### 1. AirPassengers 数据集适配

- **自动检测数据集类型**：检测是否为 `airpassengers`
- **输入形状**：`[12, 1]`（12个时间步，1个特征）
- **输出形状**：`1`（回归任务，预测下一个月）
- **LSTM 参数**：
  - `units = 64`：64个隐藏单元
  - `timestep = 12`：使用12个月预测下1个月
  - `returnSequences = false`：只返回最后一个时间步
  - `dropout = 0`：不使用dropout

### 2. 可视化循环连接

- 使用 `CircularWire` 类绘制曲线箭头
- 蓝色虚线样式，区别于普通连接
- 标签说明：`H_t → H_{t+1}` 和 `C_t → C_{t+1}`

### 3. 训练兼容性

- 可视化层不参与实际训练
- 占位层不在训练路径上，不会影响模型构建
- 确保拓扑排序只包含训练路径

## 代码实现

### 模板函数

```typescript
export function lstmStructureTemplate(svgData: IDraggableData): void
```

### 关键步骤

1. **检测数据集类型**
   ```typescript
   const isTimeSeries = currentDataset === "airpassengers";
   ```

2. **创建 LSTM 层**
   ```typescript
   const lstm1 = new LSTM(lstmPos);
   lstm1.parameterDefaults.units = 64;
   lstm1.parameterDefaults.timestep = 12;  // AirPassengers默认
   ```

3. **创建输出层**
   ```typescript
   const dense = new Dense(densePos);
   dense.parameterDefaults.units = 1;  // 回归任务
   ```

4. **添加循环连接可视化**
   ```typescript
   lstm1.addCircularConnection(hiddenStatePrev, "H_t → H_{t+1}");
   lstm1.addCircularConnection(cellStatePrev, "C_t → C_{t+1}");
   ```

## 使用方式

### 1. 通过 UI 使用

1. 确保数据集选择为 **AirPassengers**
2. 点击左侧菜单 **"模板"**
3. 选择 **"LSTM结构模版"**
4. 模板会自动创建并配置好所有层

### 2. 训练步骤

1. 检查网络结构是否正确显示
2. 查看循环连接是否正常显示（蓝色虚线箭头）
3. 设置训练参数（优化器、损失函数、批次大小、迭代次数）
4. 点击 **"训练模型"** 开始训练
5. 查看训练过程中的损失和准确率变化

## 预期行为

### 训练流程

1. **数据加载**：AirPassengers 数据集自动加载
2. **数据预处理**：
   - 创建滑动窗口序列（12个月预测下1个月）
   - 数据归一化到 [0, 1] 范围
   - 划分训练集和测试集
3. **模型构建**：
   - Input 层：形状 `[12, 1]`
   - LSTM 层：64个隐藏单元
   - Dense 层：1个输出单元
   - Output 层：回归输出
4. **训练**：使用设置的优化器和损失函数进行训练
5. **预测**：使用训练好的模型进行时序预测

### 可视化效果

- LSTM 层位于画布中央
- 左侧有 H_{t-1} 和 C_{t-1} 占位层
- 蓝色虚线循环连接展示数据流
- 标签清晰说明循环连接的含义

## 技术细节

### 数据格式

- **输入**：`[batch_size, 12, 1]`
  - batch_size：批次大小
  - 12：时间步数（timestep）
  - 1：特征数（单变量时序）

- **输出**：`[batch_size, 1]`
  - 1：预测值（下一个月）

### 模型参数

- **LSTM 层**：
  - 输入维度：`[12, 1]`
  - 隐藏单元：64
  - 输出维度：`[batch_size, 64]`

- **Dense 层**：
  - 输入维度：`[batch_size, 64]`
  - 输出维度：`[batch_size, 1]`
  - 激活函数：无（线性输出）

### 损失函数建议

- **回归任务**：使用 `meanSquaredError`（均方误差）
- **优化器**：建议使用 `adam` 或 `rmsprop`

## 验证检查清单

- [x] 模板能正确创建
- [x] LSTM 层参数正确设置
- [x] Dense 层输出单元数为 1（回归任务）
- [x] 循环连接正确显示
- [x] 不参与训练的可视化层不影响模型构建
- [x] 能正确处理 AirPassengers 数据集
- [x] 模型能正确训练

## 已知限制

1. **可视化层限制**：
   - 占位层仅用于可视化，不参与实际训练
   - 循环连接仅用于展示，实际的循环在 LSTM 层内部处理

2. **数据集要求**：
   - 当前模板主要针对 AirPassengers 数据集优化
   - 对于其他数据集（MNIST/CIFAR），会自动调整输出层

## 未来改进

1. **更详细的内部结构展示**：
   - 可以添加遗忘门、输入门、输出门的可视化
   - 展示 Multiply 层的使用

2. **交互式说明**：
   - 添加悬停提示说明各组件的作用
   - 添加教学文档链接

3. **参数调整**：
   - 允许用户调整 LSTM 的 units 和 timestep
   - 提供参数建议

## 总结

LSTM结构模板成功实现了：
- ✅ 能够正确训练 AirPassengers 数据集
- ✅ 展示 LSTM 内部结构的循环连接概念
- ✅ 使用实际的 LSTM 层确保训练正确性
- ✅ 提供清晰的可视化效果

该模板既满足了教学需求（展示内部结构），又确保了实际训练的可行性。

