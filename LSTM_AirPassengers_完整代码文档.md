# LSTM模板训练AirPassengers完整代码文档

本文档详细说明LSTM模板训练AirPassengers数据集的所有相关代码。

## 一、数据加载和预处理 (`src/model/data.ts`)

### 1.1 AirPassengersData类定义

```typescript
export class AirPassengersData {
    // 数据属性
    public readonly IMAGE_HEIGHT: number = 12;  // 时间步数（滑动窗口大小）
    public readonly IMAGE_WIDTH: number = 1;   // 特征数（单变量时序）
    public readonly NUM_CLASSES: number = 1;   // 回归任务，输出1个值
    
    // 原始数据（1949-1960，共144个月）
    private readonly rawData: number[] = [112, 118, 132, ...]; // 144个值
    
    // 内部数据存储
    private trainData: Tensor<Rank.R3>;  // [samples, timeSteps, features]
    private testData: Tensor<Rank.R3>;
    private trainLabels: Tensor<Rank.R2>; // [samples, 1]
    private testLabels: Tensor<Rank.R2>;
    private minValue: number = 0;  // 用于归一化
    private maxValue: number = 0;
    private timeSteps: number = 12; // 使用12个月预测下1个月
}
```

### 1.2 数据归一化

```typescript
// 归一化：将数据缩放到[0, 1]范围
private normalize(value: number): number {
    return (value - this.minValue) / (this.maxValue - this.minValue);
}

// 反归一化：将归一化的值还原为原始值
public denormalize(value: number): number {
    return value * (this.maxValue - this.minValue) + this.minValue;
}
```

### 1.3 创建滑动窗口序列

```typescript
// 使用前12个月预测下1个月
private createSequences(data: number[], timeSteps: number): 
    {sequences: number[][], targets: number[]} {
    const sequences: number[][] = [];
    const targets: number[] = [];

    for (let i = 0; i < data.length - timeSteps; i++) {
        const seq = data.slice(i, i + timeSteps).map(v => this.normalize(v));
        const target = this.normalize(data[i + timeSteps]);
        sequences.push(seq);
        targets.push(target);
    }

    return {sequences, targets};
}
```

### 1.4 数据加载和划分 (`load()` 方法)

```typescript
public async load(): Promise<void> {
    // 1. 划分训练集和测试集（前80%训练，后20%测试）
    const splitIndex = Math.floor(this.rawData.length * 0.8); // 115
    const trainRaw = this.rawData.slice(0, splitIndex);  // 前115个月
    const testRaw = this.rawData.slice(splitIndex);      // 后29个月

    // 2. 创建训练序列
    const {sequences: trainSequences, targets: trainTargets} = 
        this.createSequences(trainRaw, this.timeSteps);
    // trainSequences: 103个序列，每个序列12个月
    // trainTargets: 103个目标值

    // 3. 创建测试序列（保持时序连续性）
    const testStartData = [
        ...this.rawData.slice(splitIndex - this.timeSteps, splitIndex), 
        ...testRaw
    ];
    const {sequences: testSequences, targets: testTargets} = 
        this.createSequences(testStartData, this.timeSteps);
    
    // 4. 过滤掉使用训练集数据的测试序列（避免数据泄露）
    const filteredTestSequences: number[][] = [];
    const filteredTestTargets: number[] = [];
    for (let i = 0; i < testSequences.length; i++) {
        const originalStartIndex = (splitIndex - this.timeSteps) + i;
        if (originalStartIndex >= splitIndex) {
            filteredTestSequences.push(testSequences[i]);
            filteredTestTargets.push(testTargets[i]);
        }
    }
    // 最终测试集：约17-29个样本

    // 5. 转换为Tensor
    // 训练数据: [103, 12, 1]
    const trainDataArray: number[][][] = trainSequences.map(
        seq => seq.map(val => [val])
    );
    this.trainData = tf.tensor3d(trainDataArray, 
        [trainSequences.length, this.timeSteps, 1]);
    
    // 训练标签: [103, 1]
    this.trainLabels = tf.tensor2d(trainTargets, 
        [trainTargets.length, 1]);
    
    // 测试数据: [17, 12, 1]
    const testDataArray: number[][][] = filteredTestSequences.map(
        seq => seq.map(val => [val])
    );
    this.testData = tf.tensor3d(testDataArray, 
        [filteredTestSequences.length, this.timeSteps, 1]);
    
    // 测试标签: [17, 1]
    this.testLabels = tf.tensor2d(filteredTestTargets, 
        [filteredTestTargets.length, 1]);
}
```

### 1.5 数据获取方法

```typescript
// 获取训练数据
public getTrainData(numExamples?: number): 
    {xs: Tensor<Rank.R3>, labels: Tensor<Rank.R2>} {
    // 返回: xs=[samples, 12, 1], labels=[samples, 1]
    return {xs: this.trainData, labels: this.trainLabels};
}

// 获取测试数据
public getTestData(numExamples?: number): 
    {xs: Tensor<Rank.R3>, labels: Tensor<Rank.R2>} {
    // 返回: xs=[samples, 12, 1], labels=[samples, 1]
    return {xs: this.testData, labels: this.testLabels};
}
```

---

## 二、模型模板创建 (`src/ui/model_templates.ts`)

### 2.1 LSTM模板函数

```typescript
export function lstmTemplate(svgData: IDraggableData): void {
    // 1. 检测数据集类型
    const currentDataset = svgData.input.getParams().dataset;
    const isTimeSeries = currentDataset === "airpassengers";

    // 2. 创建层
    const input = svgData.input;  // Input层
    const lstm1 = new LSTM(lstm1Pos);  // LSTM层，默认units=16
    const dense = new Dense(densePos); // Dense层
    
    // 3. 根据数据集类型配置
    if (isTimeSeries) {
        // 时序数据：Input -> LSTM -> Dense(1) -> Output
        // 不需要Reshape层，不需要激活函数
        dense.parameterDefaults.units = 1;  // 回归任务
        input.addChild(lstm1);
        lstm1.addChild(dense);
        dense.addChild(svgData.output);
    } else {
        // 图像数据：Input -> Reshape -> LSTM -> Dense(10) -> Output
        const reshape = new Reshape(reshapePos);
        dense.parameterDefaults.units = 10;  // 分类任务
        input.addChild(reshape);
        reshape.addChild(lstm1);
        lstm1.addChild(dense);
        dense.addChild(svgData.output);
    }
}
```

---

## 三、模型层定义

### 3.1 Input层 (`src/ui/shapes/layers/input.ts`)

```typescript
public generateTfjsLayer(): void {
    const params = this.getParams();
    const isTimeSeries = params.dataset === "airpassengers";
    
    if (isTimeSeries) {
        // 时序数据: shape=[12, 1]（不包含批次维度）
        this.tfjsLayer = tf.input({
            shape: [dataset.IMAGE_HEIGHT, dataset.IMAGE_WIDTH]
            // shape: [12, 1]
        });
    } else {
        // 图像数据: shape=[28, 28, 1] 或 [32, 32, 3]
        this.tfjsLayer = tf.input({
            shape: [IMAGE_HEIGHT, IMAGE_WIDTH, IMAGE_CHANNELS]
        });
    }
}
```

### 3.2 LSTM层 (`src/ui/shapes/layers/lstm.ts`)

```typescript
public generateTfjsLayer(): void {
    const parameters = {
        units: 16,  // 默认16个单元
        returnSequences: false,
        dropout: 0.1,
        recurrentDropout: 0.1
    };
    
    const parent = this.parents.values().next().value;
    const parentLayer = parent.getTfjsLayer();
    const parentShape = parentLayer.shape;
    const isTimeSeries = dataset instanceof AirPassengersData;
    
    // 对于时序数据，Input层直接连接LSTM
    if (isTimeSeries && parent.layerType === "Input" && parentShape.length === 2) {
        // Input层shape是[12, 1]，LSTM可以直接处理
        // TensorFlow.js会自动添加批次维度
        this.tfjsLayer = tf.layers.lstm(parameters).apply(parentLayer);
        return;
    }
    
    // 其他情况（图像数据）的处理...
}
```

### 3.3 Output层 (`src/ui/shapes/layers/output.ts`)

```typescript
public generateTfjsLayer(): void {
    const isTimeSeries = dataset instanceof AirPassengersData;
    const parameters: any = {};
    
    if (isTimeSeries) {
        // 回归任务：1个输出单元，无激活函数（线性输出）
        parameters.units = 1;
        // 不设置activation，使用默认线性激活
    } else {
        // 分类任务：10个输出单元，softmax激活
        parameters.units = dataset.NUM_CLASSES;
        parameters.activation = "softmax";
    }
    
    this.tfjsLayer = tf.layers.dense(parameters).apply(parentLayer);
}
```

---

## 四、训练过程 (`src/model/mnist_model.ts`)

### 4.1 训练函数入口

```typescript
export async function train(): Promise<void> {
    // 1. 初始化
    resetPlotValues();
    setupPlots();
    setupTestResults();
    await dataset.load();  // 加载数据
    
    // 2. 检测数据集类型
    const isTimeSeries = dataset instanceof AirPassengersData;
    
    // 3. 设置损失函数和指标
    // ...（见4.2节）
    
    // 4. 编译模型
    model.architecture.compile({ loss, metrics, optimizer });
    
    // 5. 准备验证集（见4.3节）
    
    // 6. 训练模型
    await model.architecture.fit(trainData.xs, trainData.labels, fitOptions);
    
    // 7. 评估测试集（见4.6节）
}
```

### 4.2 损失函数和指标设置

```typescript
// 创建自定义MAE损失函数（TensorFlow.js不支持'meanAbsoluteError'字符串）
const maeLossFn = (yTrue: tf.Tensor, yPred: tf.Tensor): tf.Tensor => {
    return tf.mean(tf.abs(tf.sub(yTrue, yPred)));
};
Object.defineProperty(maeLossFn, 'name', { value: 'mae', writable: false });

// 创建自定义MAE指标函数
const maeMetricFn = (yTrue: tf.Tensor, yPred: tf.Tensor): tf.Tensor => {
    return tf.mean(tf.abs(tf.sub(yTrue, yPred)));
};
Object.defineProperty(maeMetricFn, 'name', { value: 'mae', writable: false });

// 根据用户选择确定损失函数
if (isTimeSeries) {
    if (model.params.loss === "meanAbsoluteError") {
        loss = maeLossFn;  // 使用自定义MAE函数
    } else if (model.params.loss === "meanSquaredError") {
        loss = "meanSquaredError";  // 使用MSE
    } else {
        loss = "meanSquaredError";  // 默认MSE
    }
    metrics = [maeMetricFn];  // 使用MAE作为指标
} else {
    loss = model.params.loss;  // 分类任务
    metrics = ["accuracy"];
}
```

### 4.3 验证集划分（时序数据特殊处理）

```typescript
if (isTimeSeries) {
    // 对于时序数据，手动创建验证集（从训练集的末尾取15%）
    // 注意：不能使用validationSplit，因为它会随机打乱数据
    const fullTrainData = dataset.getTrainData();
    const totalTrainSamples = fullTrainData.xs.shape[0];  // 103
    const valSize = Math.floor(totalTrainSamples * 0.15);  // 15
    const trainSize = totalTrainSamples - valSize;  // 88
    
    // 验证集：从训练集的末尾取15%（保持时间顺序）
    const valXs = fullTrainData.xs.slice([trainSize, 0, 0], 
        [valSize, 12, 1]);  // [15, 12, 1]
    const valLabels = fullTrainData.labels.slice([trainSize, 0], 
        [valSize, 1]);  // [15, 1]
    
    // 训练集：使用前85%
    const trainXs = fullTrainData.xs.slice([0, 0, 0], 
        [trainSize, 12, 1]);  // [88, 12, 1]
    const trainLabels = fullTrainData.labels.slice([0, 0], 
        [trainSize, 1]);  // [88, 1]
    
    validationData = [valXs, valLabels];  // 手动指定验证集
    validationSplit = undefined;  // 不使用随机分割
} else {
    validationSplit = 0.15;  // 分类数据使用随机分割
    validationData = undefined;
}
```

### 4.4 Batch级别的损失和指标计算

```typescript
onBatchEnd: async (batch: number, logs: tf.Logs) => {
    trainBatchCount++;
    
    // 1. 提取MAE值（时序数据）
    if (isTimeSeries) {
        let mae = 0;
        const logKeys = Object.keys(logs);
        const possibleKeys = ['mae', 'MAE', 'metric_0', 'metric_1', ...];
        
        for (const key of possibleKeys) {
            if (key in logs && typeof logs[key] === "number") {
                mae = logs[key];
                break;
            }
        }
        
        // 显示在UI
        accBox.children[1].innerHTML = String(Number(mae.toFixed(4)));
    }
    
    // 2. 提取损失值
    const lossValue = (typeof logs.loss === "number" && 
                       !isNaN(logs.loss) && isFinite(logs.loss)) 
                       ? logs.loss : 0;
    lossBox.children[1].innerHTML = String(Number(lossValue.toFixed(4)));
    
    // 3. 累积值用于绘图
    const validLoss = (lossValue > 0 && isFinite(lossValue)) ? lossValue : 0;
    totalLoss += validLoss;
    
    let maeValue = 0;
    if (isTimeSeries) {
        // 从logs中提取MAE
        // ...（同上）
        totalAccuracy += maeValue;
    } else {
        totalAccuracy += logs.acc || 0;
    }
    
    // 4. 每25个batch绘制一次
    if (batch % plotLossFrequency === 0 && batch > 0) {
        const avgLoss = totalLoss / (trainBatchCount - prevTrainBatchCount);
        const avgMetric = totalAccuracy / (trainBatchCount - prevTrainBatchCount);
        
        plotLoss(trainBatchCount, avgLoss, "train");
        plotAccuracy(trainBatchCount, avgMetric, "train");
        
        prevTrainBatchCount = trainBatchCount;
        totalLoss = 0;
        totalAccuracy = 0;
    }
}
```

### 4.5 Epoch级别的验证指标计算

```typescript
onEpochEnd: async (epoch: number, logs: tf.Logs) => {
    // 重置RNN状态
    model.architecture.resetStates();
    
    // 1. 提取验证MAE（时序数据）
    if (isTimeSeries) {
        const logKeys = Object.keys(logs);
        const valMaeKey = logKeys.find(key => 
            key === 'val_mae' ||
            key.toLowerCase().includes('mae') && key.includes('val') ||
            key === 'val_metric_0'
        );
        valMetric = valMaeKey ? logs[valMaeKey] : 0;
    } else {
        valMetric = logs.val_acc;
    }
    
    // 2. 显示验证指标
    const accBox = document.getElementById("ti_vacc");
    if (isTimeSeries) {
        accBox.children[1].innerHTML = String(Number(valMetric.toFixed(4)));
    } else {
        accBox.children[1].innerHTML = String(Number((100 * valMetric).toFixed(2)));
    }
    
    // 3. 显示验证损失
    const lossBox = document.getElementById("ti_vloss");
    lossBox.children[1].innerHTML = String(Number(logs.val_loss.toFixed(4)));
    
    // 4. 绘制验证集曲线
    plotLoss(trainBatchCount, logs.val_loss, "validation");
    plotAccuracy(trainBatchCount, valMetric || 0, "validation");
}
```

### 4.6 测试集评估

```typescript
// 训练完成后评估测试集
const testResult = model.architecture.evaluate(
    testData.xs, 
    testData.labels
) as Array<tf.Tensor<tf.Rank.R0>>;

const testLoss = testResult[0].dataSync()[0];  // 损失值
const testMetric = testResult[1].dataSync()[0];  // MAE指标值

// 显示测试集结果
if (isTimeSeries) {
    vaccBox.children[1].innerHTML = String(Number(testMetric.toFixed(4)));
    vlossBox.children[1].innerHTML = String(Number(testLoss.toFixed(4)));
}

// 生成预测结果可视化
renderTimeSeriesPredictions(testData, dataset as AirPassengersData);
```

---

## 五、损失和准确率的绘制 (`src/model/graphs.ts`)

### 5.1 损失值绘制

```typescript
let lossValues: Array<Array<{x: number, y: number}>> = [[], []];

export function plotLoss(batchNum: number, loss: number, set: string): void {
    const series = set === "train" ? 0 : 1;
    lossValues[series].push({x: batchNum, y: loss});
    
    if (tabSelected() === "progressTab") {
        renderLossPlot();
    }
}

export function renderLossPlot(): void {
    const lossContainer = document.getElementById("loss-canvas");
    tfvis.render.linechart(
        {
            values: lossValues, 
            series: ["train", "validation"]
        }, 
        lossContainer, 
        {
            xLabel: "Batch #",
            yLabel: "Loss",
            width: canvasWidth() / 2,
            height: canvasHeight() / 2,
            fontSize: GRAPH_FONT_SIZE,
        }
    );
}
```

### 5.2 准确率/MAE绘制

```typescript
let accuracyValues = [[], [{x: 0, y: 0}]];

export function plotAccuracy(epochs: number, accuracy: number, set: string): void {
    const series = set === "train" ? 0 : 1;
    accuracyValues[series].push({x: epochs, y: accuracy});
    
    if (tabSelected() === "progressTab") {
        renderAccuracyPlot();
    }
}

export function renderAccuracyPlot(): void {
    const accuracyContainer = document.getElementById("accuracy-canvas");
    tfvis.render.linechart(
        {
            values: accuracyValues, 
            series: ["train", "validation"]
        },
        accuracyContainer, 
        {
            xLabel: "Batch #",
            yLabel: "Accuracy",  // 对于时序数据，实际显示的是MAE
            width: canvasWidth() / 2,
            height: canvasHeight() / 2,
            yAxisDomain: [0, 1],  // 注意：对于MAE，这个范围可能不合适
            fontSize: GRAPH_FONT_SIZE,
        }
    );
}
```

### 5.3 预测结果可视化

```typescript
export function renderTimeSeriesPredictions(
    testData: {xs: tf.Tensor, labels: tf.Tensor},
    airPassengersData: AirPassengersData
): void {
    // 1. 在测试集上进行预测
    const predictions = model.architecture.predict(testData.xs) as tf.Tensor;
    
    // 2. 获取真实值和预测值（归一化的）
    const trueValuesNormalized = Array.from(testData.labels.dataSync());
    const predValuesNormalized = Array.from(predictions.dataSync());
    
    // 3. 反归一化
    const trueValues = trueValuesNormalized.map(
        v => airPassengersData.denormalize(v)
    );
    const predValues = predValuesNormalized.map(
        v => airPassengersData.denormalize(v)
    );
    
    // 4. 获取时间范围
    const timeRange = airPassengersData.getTestDataTimeRange();
    const timeIndices: number[] = [];
    for (let i = 0; i < trueValues.length; i++) {
        timeIndices.push(timeRange.start + i);
    }
    
    // 5. 准备可视化数据
    const trueData = timeIndices.map((t, i) => ({x: t, y: trueValues[i]}));
    const predData = timeIndices.map((t, i) => ({x: t, y: predValues[i]}));
    
    // 6. 渲染折线图
    tfvis.render.linechart(
        {
            values: [trueData, predData],
            series: ["真实值", "预测值"]
        },
        predictionContainer,
        {
            xLabel: "时间（月份索引，从0开始）",
            yLabel: "乘客数量",
            width: canvasWidth(),
            height: 400,
            fontSize: GRAPH_FONT_SIZE,
            zoomToFit: true,
        }
    );
}
```

---

## 六、关键代码文件总结

### 文件清单

1. **数据加载和预处理**
   - `src/model/data.ts`: `AirPassengersData` 类
   - 数据归一化、滑动窗口、训练/测试集划分

2. **模型模板**
   - `src/ui/model_templates.ts`: `lstmTemplate()` 函数
   - 根据数据集类型动态创建网络结构

3. **模型层定义**
   - `src/ui/shapes/layers/input.ts`: Input层（动态设置shape）
   - `src/ui/shapes/layers/lstm.ts`: LSTM层（处理时序数据）
   - `src/ui/shapes/layers/output.ts`: Output层（回归/分类）
   - `src/ui/shapes/layers/reshape.ts`: Reshape层（时序数据跳过）

4. **训练过程**
   - `src/model/mnist_model.ts`: `train()` 函数
   - 损失函数/指标设置、验证集划分、训练回调

5. **可视化**
   - `src/model/graphs.ts`: 损失/准确率/预测结果绘制

6. **数据集切换**
   - `src/model/data.ts`: `changeDataset()` 函数
   - 自动切换损失函数（MSE/MAE）

---

## 七、数据流程总结

### 7.1 数据流程

```
原始数据 (144个月)
    ↓
划分: 前80% (115个月) | 后20% (29个月)
    ↓
创建滑动窗口序列
    ↓
训练集: [103, 12, 1] → [103, 1]
测试集: [17, 12, 1] → [17, 1]
    ↓
归一化到[0, 1]
    ↓
训练时再划分验证集: 训练集[88, 12, 1] + 验证集[15, 12, 1]
```

### 7.2 模型结构

```
Input([12, 1])
    ↓
LSTM(16, dropout=0.1, recurrentDropout=0.1)
    ↓
Dense(1)  // 回归任务，无激活函数
    ↓
Output  // 输出1个值
```

### 7.3 训练流程

```
1. 加载数据 → 2. 编译模型 → 3. 划分验证集
    ↓
4. 训练循环 (fit)
    ├─ onBatchEnd: 计算并显示batch损失/MAE
    └─ onEpochEnd: 计算并显示epoch验证损失/MAE
    ↓
5. 评估测试集 → 6. 生成预测可视化
```

---

## 八、关键参数

- **时间步数**: 12个月
- **训练集**: 前80%数据，103个序列
- **验证集**: 训练集的后15%，15个序列
- **测试集**: 后20%数据，17个序列
- **LSTM单元数**: 16
- **Dropout**: 0.1
- **Recurrent Dropout**: 0.1
- **损失函数**: MSE 或 MAE（用户选择）
- **指标**: MAE
- **归一化**: Min-Max到[0, 1]

---

## 九、准确率和损失率的计算详解

### 9.1 Batch级别的计算

```typescript
onBatchEnd: async (batch: number, logs: tf.Logs) => {
    // 1. 从logs中提取MAE（时序数据）
    if (isTimeSeries) {
        let mae = 0;
        const possibleKeys = ['mae', 'MAE', 'metric_0', 'metric_1', ...];
        for (const key of possibleKeys) {
            if (key in logs && typeof logs[key] === "number") {
                mae = logs[key];
                break;
            }
        }
        // 显示在UI的"准确率"位置（实际是MAE）
        accBox.children[1].innerHTML = String(Number(mae.toFixed(4)));
    }
    
    // 2. 提取损失值
    const lossValue = (typeof logs.loss === "number" && 
                       !isNaN(logs.loss) && isFinite(logs.loss)) 
                       ? logs.loss : 0;
    lossBox.children[1].innerHTML = String(Number(lossValue.toFixed(4)));
    
    // 3. 累积值用于绘图（每25个batch绘制一次）
    totalLoss += validLoss;
    totalAccuracy += maeValue;  // 对于时序数据，这是MAE
    
    if (batch % 25 === 0 && batch > 0) {
        const avgLoss = totalLoss / batchCount;
        const avgMetric = totalAccuracy / batchCount;
        plotLoss(trainBatchCount, avgLoss, "train");
        plotAccuracy(trainBatchCount, avgMetric, "train");
    }
}
```

### 9.2 Epoch级别的计算

```typescript
onEpochEnd: async (epoch: number, logs: tf.Logs) => {
    // 1. 提取验证MAE
    if (isTimeSeries) {
        const valMaeKey = logKeys.find(key => 
            key === 'val_mae' ||
            (key.toLowerCase().includes('mae') && key.includes('val')) ||
            key === 'val_metric_0'
        );
        valMetric = valMaeKey ? logs[valMaeKey] : 0;
    } else {
        valMetric = logs.val_acc;
    }
    
    // 2. 显示验证指标
    accBox.children[1].innerHTML = String(Number(valMetric.toFixed(4)));
    lossBox.children[1].innerHTML = String(Number(logs.val_loss.toFixed(4)));
    
    // 3. 绘制验证集曲线
    plotLoss(trainBatchCount, logs.val_loss, "validation");
    plotAccuracy(trainBatchCount, valMetric || 0, "validation");
}
```

### 9.3 测试集评估

```typescript
// 评估测试集
const testResult = model.architecture.evaluate(
    testData.xs, 
    testData.labels
) as Array<tf.Tensor<tf.Rank.R0>>;

// testResult[0]: 损失值（MSE或MAE，取决于损失函数）
// testResult[1]: MAE指标值

const testLoss = testResult[0].dataSync()[0];
const testMetric = testResult[1].dataSync()[0];

// 如果损失函数是MAE，testResult[0]和testResult[1]都是MAE，值相同
// 如果损失函数是MSE，testResult[0]是MSE，testResult[1]是MAE
```

---

## 十、注意事项

1. **时序数据不能随机打乱**: 验证集必须从训练集末尾按时间顺序取
2. **避免数据泄露**: 测试集序列不能包含训练集数据
3. **MAE指标**: TensorFlow.js不支持'meanAbsoluteError'字符串，需使用自定义函数
4. **形状匹配**: Input层输出[12,1]，LSTM期望[batch, 12, 1]，TensorFlow.js自动处理批次维度
5. **回归任务**: Output层units=1，无激活函数（线性输出）
6. **准确率显示**: 对于时序数据，UI中显示的"准确率"实际是MAE值
7. **损失和指标**: 如果使用MAE作为损失函数，损失值和指标值会相同（都是MAE）


