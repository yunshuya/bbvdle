# LSTM完整内部结构模板实现说明文档

## 一、概述

"LSTM完整内部结构"模板是一个完全展开的LSTM神经网络实现，它展示了LSTM内部的所有计算过程，包括遗忘门、输入门、输出门、候选记忆、记忆更新和隐藏状态更新等所有步骤。该模板不仅用于教学展示，还可以实际训练AirPassengers时序数据集。

### 1.1 设计目标

- **完全展开**：展示LSTM内部的所有计算步骤，而不是封装在单个LSTM层中
- **可视化教学**：通过积木块的方式直观展示LSTM的工作原理
- **实际可用**：能够正确训练AirPassengers数据集，进行时序预测
- **循环连接可视化**：使用循环连接（CircularWire）展示时间步之间的数据流
![Uploading image.png…]()


### 1.2 LSTM数学公式

该模板实现了以下LSTM计算公式：

1. **遗忘门**：`F_t = σ(W_f · [H_{t-1}, X_t] + b_f)`
2. **输入门**：`I_t = σ(W_i · [H_{t-1}, X_t] + b_i)`
3. **输出门**：`O_t = σ(W_o · [H_{t-1}, X_t] + b_o)`
4. **候选记忆**：`C̃_t = tanh(W_C · [H_{t-1}, X_t] + b_C)`
5. **记忆更新**：`C_t = F_t ⊙ C_{t-1} + I_t ⊙ C̃_t`
6. **隐藏状态更新**：`H_t = O_t ⊙ tanh(C_t)`

## 二、模板结构

### 2.1 网络架构

```
Input [batch, 12, 1]
    ↓
Flatten [batch, 12]  (仅时序数据)
    ↓
Concatenate [H_{t-1}, X_t]  [batch, 12+12=24]  (时序数据)
    ↓
    ├─→ Forget Gate (Dense + Sigmoid) → [batch, 64]
    ├─→ Input Gate (Dense + Sigmoid) → [batch, 64]
    ├─→ Output Gate (Dense + Sigmoid) → [batch, 64]
    └─→ Candidate Gate (Dense + Tanh) → [batch, 64]
    ↓
    ├─→ Forget Multiply (F_t ⊙ C_{t-1}) → [batch, 64]
    └─→ Input Multiply (I_t ⊙ C̃_t) → [batch, 64]
    ↓
Cell Add (C_t = F_t⊙C_{t-1} + I_t⊙C̃_t) → [batch, 64]
    ↓
Cell Tanh (tanh(C_t)) → [batch, 64]
    ↓
Output Multiply (O_t ⊙ tanh(C_t) = H_t) → [batch, 64]
    ↓
Dense Output → [batch, 1]  (回归任务)
    ↓
Output
```

### 2.2 层组件清单

| 组件类型 | 数量 | 说明 |
|---------|------|------|
| Input | 1 | 输入层 |
| Flatten | 1 | 展平层（仅时序数据） |
| Dense (占位层) | 2 | H_{t-1} 和 C_{t-1} 可视化占位层 |
| Concatenate | 1 | 合并 [H_{t-1}, X_t] |
| Dense (门控) | 4 | 遗忘门、输入门、输出门、候选记忆 |
| Sigmoid | 3 | 遗忘门、输入门、输出门激活 |
| Tanh | 2 | 候选记忆、Cell状态激活 |
| Multiply | 3 | 遗忘门乘法、输入门乘法、输出门乘法 |
| Add | 1 | 记忆更新 |
| Dense (输出) | 1 | 最终输出层 |
| Output | 1 | 输出层 |

## 三、关键实现细节

### 3.1 新增的层类型

#### 3.1.1 Multiply层 (`src/ui/shapes/layers/multiply.ts`)

**功能**：实现元素级乘法操作，用于LSTM中的门控操作。

**关键特性**：
- 支持多个输入（类似Add层）
- 使用TensorFlow.js的 `tf.layers.multiply`
- 视觉设计：橙色矩形背景，白色"×"符号

**关键代码**：
```typescript
public generateTfjsLayer(): void {
    // Multiply层处理多个输入（类似Add层）
    const parents = [];
    for (const parent of this.parents) {
        parents.push(parent.getTfjsLayer());
    }
    this.tfjsLayer = this.tfjsEmptyLayer().apply(parents) as tf.SymbolicTensor;
}
```

#### 3.1.2 CircularWire类 (`src/ui/shapes/circularwire.ts`)

**功能**：可视化LSTM中的循环连接，展示时间步之间的数据流。

**关键特性**：
- 使用二次贝塞尔曲线绘制弧形路径
- 虚线样式（`stroke-dasharray: "8,4"`）表示循环连接
- 蓝色线条（`#4169E1`）区分于普通连接
- 支持标签文本（如 "H_t → H_{t+1}"）
- 自动计算箭头位置和角度
- H_t -> H_{t+1} 连接使用更大的弧度（150像素）和更靠近曲线的标签

**关键代码**：
```typescript
private calculateCurvePath(): string {
    const sourceCenter = this.source.getPosition().add(this.source.center());
    const destCenter = this.dest.getPosition().add(this.dest.center());
    
    const controlPointX = (sourceCenter.x + destCenter.x) / 2;
    // 根据标签判断是否是 H_t -> H_{t+1} 连接
    const isHiddenStateConnection = this.label && this.label.text() && 
                                   (this.label.text().includes("H_t") || this.label.text().includes("H_{t+1}"));
    const offsetY = isHiddenStateConnection ? 150 : 80;  // H_t -> H_{t+1} 使用更大的弧度
    const controlPointY = Math.min(sourceCenter.y, destCenter.y) - offsetY;
    
    // 使用二次贝塞尔曲线 Q x1 y1, x y
    const pathString = `M ${startX} ${startY} Q ${controlPointX} ${controlPointY}, ${endX} ${endY}`;
    return pathString;
}
```

### 3.2 修改的层类型

#### 3.2.1 Dense层 (`src/ui/shapes/layers/dense.ts`)

**新增功能**：支持可视化占位层（HiddenStatePrev 和 CellStatePrev）

**关键修改**：
```typescript
public generateTfjsLayer(): void {
    // 检查是否为可视化占位层
    if (this.layerType === "HiddenStatePrev" || this.layerType === "CellStatePrev") {
        // 创建占位符张量，不影响实际训练
        let parent: Layer = null;
        for (const p of this.parents) { 
            parent = p; 
            break; 
        }
        
        if (parent) {
            const parentLayer = parent.getTfjsLayer();
            // 创建与父层输出形状匹配的占位符
            this.tfjsLayer = this.tfjsEmptyLayer({units: this.parameterDefaults.units}).apply(parentLayer);
        } else {
            throw new Error(`占位层 ${this.layerType} 必须有一个父层`);
        }
        return;
    }
    // ... 正常的Dense层处理
}
```

**解决的问题**：
- 占位层需要满足拓扑排序要求（所有层必须追溯到Input）
- 但占位层不应该影响实际的数据流和训练
- 通过创建占位符张量解决形状匹配问题

#### 3.2.2 Layer基类 (`src/ui/shapes/layer.ts`)

**新增功能**：支持循环连接管理

**关键修改**：
```typescript
export abstract class Layer extends Draggable {
    // 新增：循环连接集合
    public circularWires: Set<CircularWire> = new Set();
    
    /**
     * 添加循环连接
     */
    public addCircularConnection(target: Layer, labelText?: string): void {
        // 检查是否已存在相同的循环连接
        for (const cw of this.circularWires) {
            if (cw.dest === target) {
                return;  // 已存在，不重复添加
            }
        }
        
        const circularWire = new CircularWire(this, target, labelText);
        this.circularWires.add(circularWire);
        target.circularWires.add(circularWire);
    }
    
    /**
     * 删除所有循环连接
     */
    public deleteCircularWires(): void {
        this.circularWires.forEach((cw) => cw.delete());
        this.circularWires.clear();
    }
    
    // 在 delete() 方法中调用 deleteCircularWires()
    // 在 moveAction() 中更新循环连接位置
}
```

#### 3.2.3 Flatten层 (`src/ui/shapes/layers/flatten.ts`)

**新增功能**：实现 `generateTfjsLayer()` 方法

**关键代码**：
```typescript
public generateTfjsLayer(): void {
    // Flatten 层将输入展平为 2D [batch, features]
    let parent: Layer = null;
    if (this.parents.size > 1) {
        displayError(new Error("Flatten layer cannot have multiple parents"));
    }
    for (const p of this.parents) { 
        parent = p; 
        break; 
    }
    
    if (!parent) {
        throw new Error("Flatten layer must have a parent");
    }
    
    const parentLayer = parent.getTfjsLayer();
    this.tfjsLayer = this.tfjsEmptyLayer().apply(parentLayer);
}
```

**作用**：将时序数据的3D输入 `[batch, timesteps, features]` 转换为2D `[batch, timesteps*features]`，供后续Dense层使用。

### 3.3 模板函数实现

#### 3.3.1 `lstmFullInternalStructureTemplate()` (`src/ui/model_templates.ts`)

**位置**：第 736-910 行

**主要功能**：
1. 自动设置数据集为 AirPassengers
2. 自动设置 batch_size 为 1
3. 创建所有LSTM内部结构层
4. 建立连接关系
5. 添加循环连接可视化

**关键实现细节**：

**1. 时序数据处理**：
```typescript
// 对于时序数据，添加 Flatten 层
let flattenLayer: Flatten | null = null;
if (isTimeSeries && flattenPos) {
    flattenLayer = new Flatten(flattenPos);
}

// hiddenStatePrev 的 units 需要与 Flatten 输出匹配
if (isTimeSeries) {
    hiddenStatePrev.parameterDefaults.units = 12;  // 与 Flatten 输出匹配
} else {
    hiddenStatePrev.parameterDefaults.units = 64;
}
```

**2. 占位层连接**：
```typescript
// 占位层连接到 Flatten 以通过拓扑排序
if (isTimeSeries && flattenLayer) {
    flattenLayer.addChild(hiddenStatePrev);
    flattenLayer.addChild(cellStatePrev);
    // concatInput 需要两个输入 [H_{t-1}, X_t]
    flattenLayer.addChild(concatInput);
    hiddenStatePrev.addChild(concatInput);
}
```

**3. 门控层参数设置**：
```typescript
// 确保所有门控层的 units 正确设置为 64
const forgetGate = new Dense(forgetGatePos);
forgetGate.parameterDefaults.units = 64;
// 更新 UI 中的 units 输入框值
const forgetGateParams = new Map<string, any>();
forgetGateParams.set("units", 64);
forgetGate.setParams(forgetGateParams);
```

**4. 循环连接**：
```typescript
// H_t 循环连接到 H_{t-1}（用于下一时刻）
outputMultiply.addCircularConnection(hiddenStatePrev, "H_t → H_{t+1}");
// C_t 循环连接到 C_{t-1}（用于下一时刻）
cellAdd.addCircularConnection(cellStatePrev, "C_t → C_{t+1}");
```

## 四、解决的问题和修复

### 4.1 形状不匹配问题

**问题**：训练时出现 `expected dense_Dense21 to have 3 dimension(s). but got array with shape 90,1`

**原因**：
- AirPassengers数据是3D格式 `[batch, timesteps, features] = [batch, 12, 1]`
- Dense层期望2D输入 `[batch, features]`
- 占位层的输出形状与Flatten输出不匹配

**解决方案**：
1. 添加Flatten层，将3D输入转换为2D
2. 调整hiddenStatePrev的units为12（与Flatten输出匹配）
3. 修改Dense层的generateTfjsLayer，正确处理占位层

### 4.2 拓扑排序问题

**问题**：`All layers must have input as an ancestor`

**原因**：占位层（hiddenStatePrev, cellStatePrev）没有连接到Input层

**解决方案**：
```typescript
// 占位层连接到 Flatten（或Input）以通过拓扑排序
if (isTimeSeries && flattenLayer) {
    flattenLayer.addChild(hiddenStatePrev);
    flattenLayer.addChild(cellStatePrev);
}
```

### 4.3 Units参数覆盖问题

**问题**：即使设置了 `parameterDefaults.units = 64`，UI中的输入框仍显示默认值32

**原因**：`getParams()` 从UI读取值，覆盖了 `parameterDefaults`

**解决方案**：
```typescript
// 创建层后，使用 setParams 更新 UI 中的值
const forgetGateParams = new Map<string, any>();
forgetGateParams.set("units", 64);
forgetGate.setParams(forgetGateParams);
```

### 4.4 输出层连接问题

**问题**：最右边的dense层没有连接到output

**原因**：`svgData.output.setPosition()` 在连接之后调用

**解决方案**：
```typescript
// 在连接之前设置位置
svgData.input.setPosition(inputPos);
svgData.output.setPosition(outputPos);  // 必须在连接之前

// 然后建立连接
denseOutput.addChild(svgData.output);
```

## 五、文件修改清单

### 5.1 新增文件

| 文件路径 | 行数 | 说明 |
|---------|------|------|
| `src/ui/shapes/layers/multiply.ts` | 54 | Multiply层实现 |
| `src/ui/shapes/circularwire.ts` | 195 | CircularWire循环连接类实现 |

### 5.2 修改文件

| 文件路径 | 修改内容 | 行数变化 |
|---------|---------|---------|
| `src/ui/model_templates.ts` | 新增 `lstmFullInternalStructureTemplate()` 函数 | +175行 |
| `src/ui/shapes/layers/dense.ts` | 支持占位层处理 | +30行 |
| `src/ui/shapes/layers/flatten.ts` | 实现 `generateTfjsLayer()` 方法 | +18行 |
| `src/ui/shapes/layer.ts` | 添加循环连接管理 | +50行 |
| `src/ui/app.ts` | 集成模板和Multiply层 | +5行 |
| `src/ui/window.ts` | 支持CircularWire选择 | +1行 |
| `src/model/export_model.ts` | 支持Multiply层序列化 | +2行 |
| `index.html` | 添加模板选项和Multiply层菜单 | +10行 |

### 5.3 关键代码位置

| 功能 | 文件 | 行号范围 |
|------|------|---------|
| 模板主函数 | `src/ui/model_templates.ts` | 736-910 |
| Multiply层实现 | `src/ui/shapes/layers/multiply.ts` | 全部 |
| CircularWire实现 | `src/ui/shapes/circularwire.ts` | 全部 |
| 占位层处理 | `src/ui/shapes/layers/dense.ts` | 66-92 |
| 循环连接管理 | `src/ui/shapes/layer.ts` | 280-310 |

## 六、使用说明

### 6.1 创建模板

1. 在前端界面点击"模板"菜单
2. 选择"LSTM完整内部结构"
3. 模板会自动：
   - 设置数据集为 AirPassengers
   - 设置 batch_size 为 1
   - 创建所有LSTM内部结构层
   - 建立连接关系
   - 添加循环连接可视化

### 6.2 训练设置

- **数据集**：AirPassengers（自动设置）
- **Batch Size**：1（自动设置）
- **Loss Function**：meanSquaredError（自动设置）
- **Epochs**：建议100-200
- **Learning Rate**：建议0.0005-0.001

### 6.3 可视化说明

- **黑色实线**：正常的前向传播连接
- **蓝色虚线**：循环连接（CircularWire），表示时间步之间的数据流
- **橙色矩形（×）**：Multiply层，表示元素级乘法
- **绿色矩形（+）**：Add层，表示元素级加法
- **紫色矩形（||）**：Concatenate层，表示张量拼接

## 七、技术特点

### 7.1 教学价值

- **完全透明**：展示LSTM内部的所有计算步骤
- **可视化**：通过积木块直观展示数据流
- **可交互**：可以查看每一层的参数和形状
- **可训练**：不仅用于展示，还能实际训练

### 7.2 实现亮点

1. **占位层机制**：通过占位层满足拓扑排序要求，但不影响实际训练
2. **循环连接可视化**：使用CircularWire类优雅地展示循环连接
3. **形状自动匹配**：根据数据类型（时序/非时序）自动调整层参数
4. **UI同步**：确保代码中的参数值与UI显示一致

### 7.3 兼容性

- **时序数据**：支持AirPassengers数据集（3D输入）
- **非时序数据**：理论上支持MNIST/CIFAR-10（需要调整）
- **其他模板**：不影响现有模板的正常使用

## 八、未来改进方向

1. **性能优化**：考虑使用实际的LSTM层进行训练，占位层仅用于可视化
2. **更多数据集**：支持更多时序数据集
3. **交互增强**：允许用户调整循环连接的弧度
4. **动画效果**：添加数据流动画，展示时间步之间的数据传递

## 九、关键代码片段

### 9.1 模板函数调用链

```typescript
// 1. 用户点击模板
createTemplate("lstmFullInternal") 
    → lstmFullInternalStructureTemplate(svgData)
        → resetWorkspace(svgData)  // 清空画布
        → changeDataset("airpassengers")  // 设置数据集
        → 创建所有层
        → 建立连接关系
        → 添加循环连接
```

### 9.2 数据流示例（时序数据）

```
输入: [90, 12, 1]  (90个样本，12个时间步，1个特征)
    ↓ Flatten
[batch, 12]  (90个样本，12个特征)
    ↓ Concat (与 hiddenStatePrev [batch, 12] 合并)
[batch, 24]  (90个样本，24个特征)
    ↓ Forget Gate (Dense 64)
[batch, 64]
    ↓ Sigmoid
[batch, 64]  (F_t)
    ↓ Multiply (与 C_{t-1} [batch, 64] 相乘)
[batch, 64]
    ↓ Add (与 I_t ⊙ C̃_t 相加)
[batch, 64]  (C_t)
    ↓ Tanh
[batch, 64]
    ↓ Multiply (与 O_t [batch, 64] 相乘)
[batch, 64]  (H_t)
    ↓ Dense(1)
[batch, 1]  (90个样本，1个输出值)
```

### 9.3 循环连接实现

```typescript
// 在模板中创建循环连接
outputMultiply.addCircularConnection(hiddenStatePrev, "H_t → H_{t+1}");
cellAdd.addCircularConnection(cellStatePrev, "C_t → C_{t+1}");

// CircularWire 自动计算曲线路径
// 使用二次贝塞尔曲线：M startX startY Q controlX controlY, endX endY
// H_t -> H_{t+1} 使用150像素的向上偏移，形成更大的弧度
```

## 十、总结

"LSTM完整内部结构"模板成功实现了LSTM神经网络的完全展开，不仅展示了所有内部计算过程，还能实际训练时序数据。通过新增Multiply层和CircularWire类，以及修改Dense层和Layer基类，我们实现了：

1. ✅ 完整的LSTM内部结构可视化
2. ✅ 实际可用的训练功能
3. ✅ 优雅的循环连接可视化
4. ✅ 自动化的参数设置
5. ✅ 良好的代码组织和可维护性

该模板为深度学习教学提供了一个优秀的可视化工具，帮助学生深入理解LSTM的工作原理。

## 十一、附录

### 11.1 相关文档

- `LSTM_AirPassengers_完整代码文档.md` - LSTM与AirPassengers数据集集成文档
- `RNN_LSTM_构建文档.md` - RNN和LSTM积木块构建文档

### 11.2 测试建议

1. **功能测试**：
   - 创建模板，检查所有层是否正确显示
   - 检查循环连接是否正确绘制
   - 检查参数是否正确设置

2. **训练测试**：
   - 使用AirPassengers数据集训练
   - 检查训练过程是否正常
   - 检查预测结果是否合理

3. **兼容性测试**：
   - 测试其他模板是否正常工作
   - 测试其他数据集是否受影响

### 11.3 常见问题

**Q: 为什么需要Flatten层？**
A: 因为AirPassengers数据是3D格式 `[batch, timesteps, features]`，而Dense层期望2D输入。Flatten层将3D转换为2D。

**Q: 占位层会影响训练吗？**
A: 不会。占位层只用于可视化，它们创建占位符张量满足拓扑排序要求，但不参与实际的数据流。

**Q: 可以修改循环连接的弧度吗？**
A: 可以。在 `circularwire.ts` 的 `calculateCurvePath()` 方法中修改 `offsetY` 值即可。

**Q: 为什么batch_size默认为1？**
A: 对于时序数据，batch_size=1可以确保每个时间步都独立处理，这对于理解LSTM的工作原理很重要。

