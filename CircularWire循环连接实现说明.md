# CircularWire 循环连接实现说明

## 概述

CircularWire 类用于在可视化界面中表示循环神经网络（如 LSTM、GRU）中的循环连接。它使用曲线箭头来展示从当前时刻的输出回到下一时刻输入的数据流。

## 实现特性

### 1. 视觉设计

- **曲线路径**: 使用 SVG 二次贝塞尔曲线（Quadratic Bezier Curve）绘制弧形路径
- **虚线样式**: 使用 `stroke-dasharray: "8,4"` 创建虚线效果，区分循环连接和普通连接
- **颜色区分**: 使用蓝色（#4169E1）区别于普通连接的黑色
- **箭头指示**: 在目标层左侧显示箭头，指示数据流向
- **可选标签**: 支持添加文本标签（如 "t+1"）说明循环连接的含义

### 2. 核心功能

#### 2.1 路径计算
```typescript
calculateCurvePath(): string
```
- 从源层右侧出发
- 经过控制点形成向上弧形
- 到达目标层左侧
- 使用二次贝塞尔曲线：`M startX startY Q controlX controlY, endX endY`

#### 2.2 箭头定位
```typescript
calculateArrowPosition(): { x: number; y: number; angle: number }
```
- 箭头位于目标层左侧
- 角度根据曲线在终点处的切线方向计算
- 确保箭头正确指向目标层

#### 2.3 位置更新
```typescript
updatePosition(): void
```
- 当层移动时自动更新路径和箭头位置
- 更新标签位置（如果存在）

### 3. 交互功能

- **选中**: 点击循环连接时变为金色高亮
- **取消选中**: 恢复蓝色
- **删除**: 支持删除循环连接
- **提升**: 支持提升到最上层显示

## 集成到 Layer 类

### 新增属性

```typescript
public circularWires: Set<CircularWire> = new Set();
```

### 新增方法

#### addCircularConnection()
```typescript
public addCircularConnection(target: Layer, labelText?: string): void
```
- 添加循环连接到指定目标层
- 自动检查是否已存在相同连接，避免重复
- 支持可选的标签文本

#### deleteCircularWires()
```typescript
public deleteCircularWires(): void
```
- 删除所有循环连接
- 在层删除时自动调用

### 更新的方法

#### moveAction()
- 更新所有循环连接的位置
- 更新所有指向当前层的循环连接

#### raise()
- 提升循环连接的显示层级

#### delete()
- 自动清理所有循环连接

## 使用示例

### 在 LSTM 内部结构模板中使用

```typescript
// H_t 循环连接到 H_{t-1}（用于下一时刻）
outputMultiply.addCircularConnection(hiddenStatePrev, "t+1");

// C_t 循环连接到 C_{t-1}（用于下一时刻）
cellAdd.addCircularConnection(cellStatePrev, "t+1");
```

### 手动创建循环连接

```typescript
// 从输出层循环连接到输入层
const outputLayer = ...;
const inputLayer = ...;
outputLayer.addCircularConnection(inputLayer, "循环到下一时刻");
```

## 文件结构

```
src/ui/shapes/
├── circularwire.ts      # CircularWire 类实现
├── layer.ts             # Layer 类（已更新，添加循环连接支持）
└── wire.ts              # Wire 类（普通连接，作为参考）
```

## 样式特点

### 默认样式
- **路径颜色**: #4169E1（蓝色）
- **路径宽度**: 4px
- **虚线**: 8px 实线，4px 空白
- **透明度**: 0.8
- **箭头**: 蓝色填充，16x12 像素

### 选中样式
- **路径颜色**: #FFD700（金色）
- **路径宽度**: 5px
- **箭头**: 金色填充

## 技术细节

### SVG 路径格式
```
M startX startY Q controlX controlY, endX endY
```
- `M`: 移动到起点
- `Q`: 二次贝塞尔曲线
- 控制点位于源和目标中点上方，形成弧形

### 箭头旋转
箭头使用 SVG transform 属性旋转：
```typescript
transform: `translate(x, y) rotate(angle)`
```
角度根据曲线在终点处的切线方向计算。

## 测试验证

### 测试场景

1. **创建循环连接**
   - ✅ 成功创建 CircularWire 实例
   - ✅ 正确绘制曲线路径
   - ✅ 箭头正确指向目标层

2. **位置更新**
   - ✅ 层移动时循环连接自动更新
   - ✅ 标签位置正确更新

3. **交互功能**
   - ✅ 点击选中功能正常
   - ✅ 删除功能正常
   - ✅ 提升层级功能正常

4. **LSTM 模板集成**
   - ✅ 在 LSTM 内部结构模板中正确显示
   - ✅ H_t 到 H_{t-1} 的循环连接
   - ✅ C_t 到 C_{t-1} 的循环连接

## 已知限制

1. **循环连接不参与模型构建**: 循环连接仅用于可视化，不参与实际的 TensorFlow.js 模型构建
2. **序列化支持**: 当前循环连接信息不包含在 JSON 序列化中（未来可扩展）
3. **方向固定**: 当前实现假设循环连接从右到左（可扩展支持其他方向）

## 未来改进建议

1. **序列化支持**: 将循环连接信息保存到 JSON，支持导入/导出
2. **方向配置**: 支持向上、向下、向左、向右等不同方向的循环连接
3. **动画效果**: 添加虚线动画效果，更清晰地表示数据流动
4. **多路径支持**: 支持同一对层之间的多条循环连接（不同标签）
5. **交互编辑**: 支持拖拽控制点调整曲线形状

## 使用说明

### 在模板中使用

1. 创建源层和目标层
2. 调用 `sourceLayer.addCircularConnection(targetLayer, "标签文本")`
3. 循环连接会自动显示

### 在 UI 中使用

当前版本不支持通过 UI 直接创建循环连接，需要通过代码或模板创建。未来可以添加：
- 右键菜单选项
- 拖拽创建循环连接
- 可视化编辑器

## 总结

CircularWire 类成功实现了循环连接的视觉表示，为 LSTM 等循环神经网络的可视化提供了重要支持。通过曲线箭头和虚线样式，用户可以清晰地看到时间步之间的数据流动。

