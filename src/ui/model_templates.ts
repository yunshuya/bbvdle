import { IDraggableData } from "./app";
import { Activation, Relu, Sigmoid, Tanh } from "./shapes/activation";
import { ActivationLayer } from "./shapes/activationlayer";
import { Layer } from "./shapes/layer";
import { Add } from "./shapes/layers/add";
import { BatchNorm } from "./shapes/layers/batchnorm";
import { Concatenate } from "./shapes/layers/concatenate";
import { Conv2D } from "./shapes/layers/convolutional";
import { Dense } from "./shapes/layers/dense";
import { Dropout } from "./shapes/layers/dropout";
import { Flatten } from "./shapes/layers/flatten";
import { LSTM } from "./shapes/layers/lstm";
import { MaxPooling2D } from "./shapes/layers/maxpooling";
import { Multiply } from "./shapes/layers/multiply";
import { Point } from "./shapes/shape";
import { Recurrent } from "./shapes/layers/rnn";
// Reshape 层已从前端移除
import { FormulaLabel } from "./shapes/formula_label";
import { getSvgOriginalBoundingBox } from "./utils";
import { windowProperties } from "./window";
import { dataset, changeDataset } from "../model/data";
import { model } from "../model/params_object";

export function resetWorkspace(svgData: IDraggableData): void {
    // Deselect current element
    if (windowProperties.selectedElement != null) {
        windowProperties.selectedElement.unselect();
    }
    
    // 先清理 input 和 output 的连接
    if (svgData.input != null) {
        svgData.input.wires.forEach((w) => w.delete());
        svgData.input.deleteCircularWires();  // 清理循环连接
        svgData.input.setPosition(svgData.input.defaultLocation);
    }
    if (svgData.output != null) {
        svgData.output.deleteCircularWires();  // 清理循环连接
        svgData.output.setPosition(svgData.output.defaultLocation);
    }

    // 创建 draggable 数组的副本，避免在迭代时修改数组导致问题
    const layersToDelete = [...svgData.draggable];
    
    // Remove all other layers
    for (const layer of layersToDelete) {
        layer.delete();
    }

    // Clear the current list of draggables
    svgData.draggable = [];
    
    // 清理公式标签
    if ((svgData as any).formulaLabels) {
        const formulaLabels = (svgData as any).formulaLabels as FormulaLabel[];
        formulaLabels.forEach(label => label.remove());
        (svgData as any).formulaLabels = undefined;
    }
    
    // 额外清理：直接查询 DOM 并删除任何残留的层和连线
    // 这确保即使 svgData.draggable 与 DOM 不同步，也能彻底清理
    const svgElement = document.getElementById("svg");
    if (svgElement) {
        // 删除所有非 input/output 的层（通过 draggable-id 属性）
        const allLayers = svgElement.querySelectorAll('g[draggable-id]');
        allLayers.forEach((layer) => {
            const layerElement = layer as HTMLElement;
            const draggableId = layerElement.getAttribute('draggable-id');
            // 只删除非 input/output 的层
            if (draggableId && draggableId !== 'input' && draggableId !== 'output') {
                layer.remove();
            }
        });
        
        // 删除所有连线（通过 wire-id 属性）
        const allWires = svgElement.querySelectorAll('line[wire-id]');
        allWires.forEach((wire) => {
            wire.remove();
        });
    }
}

export function defaultTemplate(svgData: IDraggableData): void {
    resetWorkspace(svgData);

    // Initialize each of the layers and activations
    const canvasBoundingBox = getSvgOriginalBoundingBox(document.getElementById("svg") as any as SVGSVGElement);
    const width = canvasBoundingBox.width;
    const height = canvasBoundingBox.height;
    
    // 显式设置 Input 和 Output 层的位置
    const inputPos = new Point(100, height / 2);
    const outputPos = new Point(width - 100, height / 2);
    svgData.input.setPosition(inputPos);
    svgData.output.setPosition(outputPos);
    
    // 注意：不在这里调用 changeDataset，让训练时自动处理数据集切换
    // 这样可以避免在模板创建时重置 dataLoaded 状态
    // 数据集会在训练时通过 startTraining() 中的 changeDataset(svgData.input.getParams().dataset) 来设置
    
    // 默认模板总是创建 MNIST 的网络结构（与初始版本一致）
    // 如果用户想使用 CIFAR-10，可以在创建模板后手动在 Input 层中选择
    // 获取当前数据集类型（用于判断是否需要创建 CIFAR-10 结构）
    // 如果 Input 层的 paramBox 已经初始化，尝试获取其参数
    let currentDataset = "mnist"; // 默认值
    try {
        const inputParams = svgData.input.getParams();
        if (inputParams && inputParams.dataset) {
            currentDataset = inputParams.dataset;
        }
    } catch (e) {
        // 如果 paramBox 还没有初始化，使用默认值 MNIST
        // 这是正常情况，因为模板创建时 paramBox 可能还没有初始化
    }
    
    const isCifar10 = currentDataset === "cifar";  // 注意：Input层中CIFAR-10的值是"cifar"，不是"cifar10"
    
    // 图像分类任务：根据数据集类型选择不同的网络结构
    if (isCifar10) {
        // CIFAR-10: 使用更深的网络结构（3个Conv2D + 2个MaxPooling + Dropout + Flatten + Dense）
        // CIFAR-10 比 MNIST 更难，需要更强的特征提取能力和正则化
        
        // 自动设置学习率为 0.001（CIFAR-10 需要较小的学习率以获得更好的训练效果）
        model.params.learningRate = 0.001;
        // 同时更新 HTML 输入框的值，确保 UI 显示一致
        const learningRateInput = document.getElementById("learningRate") as HTMLInputElement;
        if (learningRateInput) {
            learningRateInput.value = "0.001";
            console.log("CIFAR-10 默认模板：学习率已自动设置为 0.001");
        }
        
        // 布局定义
        const conv1Pos = new Point(width * 0.15, height * 0.5);
        const maxpool1Pos = new Point(width * 0.25, height * 0.5);
        const conv2Pos = new Point(width * 0.35, height * 0.5);
        const maxpool2Pos = new Point(width * 0.45, height * 0.5);
        const conv3Pos = new Point(width * 0.55, height * 0.5);
        const flatPos = new Point(width * 0.7, height * 0.5);
        const dropoutPos = new Point(width * 0.8, height * 0.5);
        const densePos = new Point(width * 0.9, height * 0.5);
        
        // 第一层：32 filters
        const conv1: ActivationLayer = new Conv2D(conv1Pos);
        const conv1Relu: Activation = new Relu(conv1Pos);
        conv1.parameterDefaults.filters = 32;
        conv1.parameterDefaults.kernelSize = [3, 3];
        conv1.parameterDefaults.padding = "same";
        
        const maxpool1: Layer = new MaxPooling2D(maxpool1Pos);
        maxpool1.parameterDefaults.poolSize = [2, 2];
        
        // 第二层：64 filters
        const conv2: ActivationLayer = new Conv2D(conv2Pos);
        const conv2Relu: Activation = new Relu(conv2Pos);
        conv2.parameterDefaults.filters = 64;
        conv2.parameterDefaults.kernelSize = [3, 3];
        conv2.parameterDefaults.padding = "same";
        
        const maxpool2: Layer = new MaxPooling2D(maxpool2Pos);
        maxpool2.parameterDefaults.poolSize = [2, 2];
        
        // 第三层：128 filters
        const conv3: ActivationLayer = new Conv2D(conv3Pos);
        const conv3Relu: Activation = new Relu(conv3Pos);
        conv3.parameterDefaults.filters = 128;
        conv3.parameterDefaults.kernelSize = [3, 3];
        conv3.parameterDefaults.padding = "same";
        
        const flat: Layer = new Flatten(flatPos);
        
        // Dropout 层防止过拟合
        const dropout: Layer = new Dropout(dropoutPos);
        dropout.parameterDefaults.rate = 0.5;
        
        const dense: ActivationLayer = new Dense(densePos);
        const denseRelu: Activation = new Relu(densePos);
        dense.parameterDefaults.units = 10;
        
        // 连接关系
        svgData.input.addChild(conv1);
        conv1.addActivation(conv1Relu);
        conv1.addChild(maxpool1);
        
        maxpool1.addChild(conv2);
        conv2.addActivation(conv2Relu);
        conv2.addChild(maxpool2);
        
        maxpool2.addChild(conv3);
        conv3.addActivation(conv3Relu);
        conv3.addChild(flat);
        
        flat.addChild(dropout);
        dropout.addChild(dense);
        dense.addActivation(denseRelu);
        dense.addChild(svgData.output);
        
        // Store the new network
        svgData.draggable.push(conv1);
        svgData.draggable.push(conv1Relu);
        svgData.draggable.push(maxpool1);
        svgData.draggable.push(conv2);
        svgData.draggable.push(conv2Relu);
        svgData.draggable.push(maxpool2);
        svgData.draggable.push(conv3);
        svgData.draggable.push(conv3Relu);
        svgData.draggable.push(flat);
        svgData.draggable.push(dropout);
        svgData.draggable.push(dense);
        svgData.draggable.push(denseRelu);
    } else {
        // MNIST: 使用简单的网络结构（1个Conv2D + Flatten + Dense）
        // MNIST 是灰度图像，相对简单，一个卷积层就足够了
        const convStartingPosition = new Point(width / 4, height / 2.5);
        const flatStartingPosition = new Point(width / 1.75, height / 2.5);
        const denseStartingPosition = new Point(width * 5 / 6.5, height / 2.5);
        
        const conv: ActivationLayer = new Conv2D(convStartingPosition);
        const convRelu: Activation = new Relu(convStartingPosition);
        // MNIST 使用默认的 16 个 filters
        
        const flat: Layer = new Flatten(flatStartingPosition);
        const dense: ActivationLayer = new Dense(denseStartingPosition);
        const denseRelu: Activation = new Relu(denseStartingPosition);
        
        // MNIST 有 10 个类别
        dense.parameterDefaults.units = 10;
        
        // Add relationships among layers and activations
        svgData.input.addChild(conv);
        conv.addChild(flat);
        conv.addActivation(convRelu);
        
        flat.addChild(dense);
        dense.addChild(svgData.output);
        dense.addActivation(denseRelu);
        
        // Store the new network
        svgData.draggable.push(conv);
        svgData.draggable.push(dense);
        svgData.draggable.push(flat);
        svgData.draggable.push(convRelu);
        svgData.draggable.push(denseRelu);
    }
}

export function blankTemplate(svgData: IDraggableData): void {
    resetWorkspace(svgData);
}

export function resnetTemplate(svgData: IDraggableData): void {
    resetWorkspace(svgData);

    // Initialize each of the layers and activations
    const canvasBoundingBox = getSvgOriginalBoundingBox(document.getElementById("svg") as any as SVGSVGElement);
    const width = canvasBoundingBox.width;
    const height = canvasBoundingBox.height;

    const conv0Pos = new Point(width * 0.26, height * 0.57);
    const conv1Pos = new Point(width * 0.26, height * 0.372);
    const conv2Pos = new Point(width * 0.404, height * 0.372);
    const conv3Pos = new Point(width * 0.404, height * 0.78);
    const conv4Pos = new Point(width * 0.537, height * 0.78);
    const add1Pos = new Point(width * 0.387, height * 0.547);
    const add2Pos = new Point(width * 0.521, height * 0.547);
    const flattenPos = new Point(width * 0.708, height * 0.606);
    const densePos = new Point(width * 0.702, height * 0.566);
    const dropoutPos = new Point(width * 0.778, height * 0.477);

    const conv0: ActivationLayer = new Conv2D(conv0Pos);
    const conv1: ActivationLayer = new Conv2D(conv1Pos);
    const conv2: ActivationLayer = new Conv2D(conv2Pos);
    const conv3: ActivationLayer = new Conv2D(conv3Pos);
    const conv4: ActivationLayer = new Conv2D(conv4Pos);
    const conv1Relu: Activation = new Relu(conv1Pos);
    const conv3Relu: Activation = new Relu(conv3Pos);
    const add1: ActivationLayer = new Add(add1Pos);
    const add2: ActivationLayer = new Add(add2Pos);
    const add1Relu: Activation = new Relu(add1Pos);
    const add2Relu: Activation = new Relu(add2Pos);
    const flatten: Flatten = new Flatten(flattenPos);
    const dense: ActivationLayer = new Dense(densePos);
    const denseRelu: Activation = new Relu(densePos);
    const dropout: Layer = new Dropout(dropoutPos);

    // 获取当前数据集类型，设置正确的输出单元数
    // 注意：resnetTemplate 用于图像分类任务（MNIST/CIFAR-10）
    const currentDataset = svgData.input.getParams().dataset;
    const isTimeSeries = currentDataset === "airpassengers";
    
    if (isTimeSeries) {
        // 时序数据：回归任务，输出1个值
        dense.parameterDefaults.units = 1;
    } else {
        // 图像数据：分类任务，根据数据集设置类别数
        // 使用 dataset 的 NUM_CLASSES（MNIST 和 CIFAR-10 都是 10）
        // 如果 dataset 尚未加载，使用默认值 10
        const numClasses = (dataset && 'NUM_CLASSES' in dataset) ? dataset.NUM_CLASSES : 10;
        dense.parameterDefaults.units = numClasses;
    }

    // Add activations to layers
    conv1.addActivation(conv1Relu);
    conv3.addActivation(conv3Relu);
    add1.addActivation(add1Relu);
    add2.addActivation(add2Relu);
    dense.addActivation(denseRelu);

    // Add relationships among layers and activations
    svgData.input.addChild(conv0);

    conv0.addChild(add1);
    conv0.addChild(conv1);

    conv1.addChild(conv2);
    conv2.addChild(add1);

    add1.addChild(conv3);
    add1.addChild(add2);

    conv3.addChild(conv4);
    conv4.addChild(add2);

    add2.addChild(flatten);
    flatten.addChild(dense);
    dense.addChild(dropout);
    dropout.addChild(svgData.output);

    // Store the new network
    svgData.draggable.push(conv0);
    svgData.draggable.push(conv1);
    svgData.draggable.push(conv2);
    svgData.draggable.push(conv3);
    svgData.draggable.push(conv4);
    svgData.draggable.push(add1);
    svgData.draggable.push(add2);
    svgData.draggable.push(flatten);
    svgData.draggable.push(dense);
    svgData.draggable.push(dropout);
    svgData.draggable.push(conv1Relu);
    svgData.draggable.push(conv3Relu);
    svgData.draggable.push(add1Relu);
    svgData.draggable.push(add2Relu);
    svgData.draggable.push(denseRelu);
}

export function complexTemplate(svgData: IDraggableData): void {
    resetWorkspace(svgData);

    // Initialize each of the layers and activations
    const canvasBoundingBox = getSvgOriginalBoundingBox(document.getElementById("svg") as any as SVGSVGElement);
    const width = canvasBoundingBox.width;
    const height = canvasBoundingBox.height;
    const convStartingPosition = new Point(width / 3.5, height / 3);
    const denseStartingPosition = new Point(width * 3 / 4, height / 2);
    const conv2StartingPosition = new Point(width / 3.5, height * 2 / 3);
    const batchStartingPosition = new Point(width / 2.5, height * 2 / 3);
    const maxpoolingStartingPosition = new Point(width / 2.5, height / 3);
    const concatStartingPosition = new Point(width * 2 / 3, height / 1.9);
    const flat1StartingPosition = new Point(width / 1.7, height / 2.2);
    const flat2StartingPosition = new Point(width / 1.7, height * 2 / 3);

    const conv: ActivationLayer = new Conv2D(convStartingPosition);
    const convRelu: Activation = new Relu(convStartingPosition);
    const dense: ActivationLayer = new Dense(denseStartingPosition);
    const denseRelu: Activation = new Relu(denseStartingPosition);
    const conv2: ActivationLayer = new Conv2D(conv2StartingPosition);
    const maxpooling: MaxPooling2D = new MaxPooling2D(maxpoolingStartingPosition);
    const concat: Concatenate = new Concatenate(concatStartingPosition);
    const batch: ActivationLayer = new BatchNorm(batchStartingPosition);
    const batchRelu2: Activation = new Relu(batchStartingPosition);
    const flat1: Flatten = new Flatten(flat1StartingPosition);
    const flat2: Flatten = new Flatten(flat2StartingPosition);

    // 获取当前数据集类型，设置正确的输出单元数
    // 注意：complexTemplate 用于图像分类任务（MNIST/CIFAR-10）
    const currentDataset = svgData.input.getParams().dataset;
    const isTimeSeries = currentDataset === "airpassengers";
    
    if (isTimeSeries) {
        // 时序数据：回归任务，输出1个值
        dense.parameterDefaults.units = 1;
    } else {
        // 图像数据：分类任务，根据数据集设置类别数
        // 使用 dataset 的 NUM_CLASSES（MNIST 和 CIFAR-10 都是 10）
        // 如果 dataset 尚未加载，使用默认值 10
        const numClasses = (dataset && 'NUM_CLASSES' in dataset) ? dataset.NUM_CLASSES : 10;
        dense.parameterDefaults.units = numClasses;
    }

    // Add relationships among layers and activations
    // in -> conv, in -> conv2
    svgData.input.addChild(conv);
    svgData.input.addChild(conv2);

    // conv -> maxpool
    conv.addChild(maxpooling);
    conv.addActivation(convRelu);

    // maxpooling -> flat1
    maxpooling.addChild(flat1);

    // conv2 -> batch
    conv2.addChild(batch);
    batch.addActivation(batchRelu2);

    // batch -> flat2
    batch.addChild(flat2);

    // flat1, flat2 -> concat
    flat1.addChild(concat);
    flat2.addChild(concat);

    // concat -> dense
    concat.addChild(dense);
    dense.addActivation(denseRelu);

    // dense -> out
    dense.addChild(svgData.output);

    // Store the new network
    svgData.draggable.push(conv);
    svgData.draggable.push(dense);
    svgData.draggable.push(conv2);
    svgData.draggable.push(maxpooling);
    svgData.draggable.push(concat);
    svgData.draggable.push(flat1);
    svgData.draggable.push(flat2);
    svgData.draggable.push(batch);
    svgData.draggable.push(convRelu);
    svgData.draggable.push(denseRelu);
    svgData.draggable.push(batchRelu2);
}

export function rnnTemplate(svgData: IDraggableData): void {
    resetWorkspace(svgData);

    // 自动设置数据集为 AirPassengers
    // 先更新全局数据集
    changeDataset("airpassengers");
    
    // 然后使用 setParams 设置 Input 层的参数
    // setParams 方法会自动更新 paramBox 中的 select 元素
    const params = new Map<string, any>();
    params.set("dataset", "airpassengers");
    svgData.input.setParams(params);
    
    console.log("RNN 模板：数据集已自动设置为 AirPassengers");

    // Initialize each of the layers and activations
    const canvasBoundingBox = getSvgOriginalBoundingBox(document.getElementById("svg") as any as SVGSVGElement);
    const width = canvasBoundingBox.width;
    const height = canvasBoundingBox.height;

    // 获取当前数据集类型（现在应该是 airpassengers）
    const currentDataset = svgData.input.getParams().dataset;
    const isTimeSeries = currentDataset === "airpassengers";
    
    // 对于 AirPassengers 数据集，自动设置 epochs 和学习率
    if (isTimeSeries) {
        model.params.epochs = 100;  // 增加训练轮数以提高性能
        model.params.learningRate = 0.0005;  // 降低学习率以提高训练稳定性
        // 同时更新 HTML 输入框的值，确保 UI 显示一致
        const epochsInput = document.getElementById("epochs") as HTMLInputElement;
        const lrInput = document.getElementById("learningRate") as HTMLInputElement;
        if (epochsInput) {
            epochsInput.value = "100";
        }
        if (lrInput) {
            lrInput.value = "0.0005";
        }
        console.log("RNN 模板训练 AirPassengers：epochs 已自动设置为 100，学习率已自动设置为 0.0005");
    }

    if (isTimeSeries) {
        // ==================== 时序数据：RNN 结构（类似 ResNet 风格）====================
        // 对于 AirPassengers 数据集，Input 层的输出是 [12, 1]（timeSteps, features）
        // RNN 层可以直接处理这种格式，不需要 Reshape 层
        // 创建一个简洁但清晰的网络结构，展示 RNN 的计算流程
        
        // 输入层位置（左侧）
        const inputPos = new Point(width * 0.15, height * 0.5);
        
        // RNN 层位置（中间）
        const rnn1Pos = new Point(width * 0.5, height * 0.5);
        
        // 最终输出层（右侧）
        const finalDensePos = new Point(width * 0.75, height * 0.5);
        const outputPos = new Point(width * 0.9, height * 0.5);
        
        // 创建真正的 RNN 层（核心，可以运行）- 处理整个序列
        // RNN 层会自动处理 [12, 1] 格式的输入，无需 Reshape
        const rnn1: ActivationLayer = new Recurrent(rnn1Pos);
        rnn1.parameterDefaults.units = 128;  // 增加容量以提高预测性能
        rnn1.parameterDefaults.dropout = 0.2;  // 输入 dropout
        rnn1.parameterDefaults.recurrentDropout = 0.1;  // 循环 dropout
        // 添加 Tanh 激活函数积木块（用于可视化展示）
        // 注意：TensorFlow.js 的 SimpleRNN 默认使用 tanh，添加外部 tanh 会覆盖默认值
        // 这里添加是为了在前端可视化中展示 RNN 使用了 tanh 激活函数
        const rnnTanh: Activation = new Tanh(rnn1Pos);
        rnn1.addActivation(rnnTanh);
        
        // 最终输出层
        const finalDense: ActivationLayer = new Dense(finalDensePos);
        finalDense.parameterDefaults.units = 1;  // 回归任务，输出1个值
        
        // 构建网络结构：Input -> RNN -> Dense(1) -> Output
        // Input 层输出 [12, 1]，RNN 层直接处理，无需 Reshape
        svgData.input.setPosition(inputPos);
        svgData.input.addChild(rnn1);  // RNN 层直接处理 [12, 1] 格式的输入
        rnn1.addChild(finalDense);
        finalDense.addChild(svgData.output);
        svgData.output.setPosition(outputPos);
        
        // Store the new network
        svgData.draggable.push(rnn1);
        svgData.draggable.push(rnnTanh);
        svgData.draggable.push(finalDense);
        
        console.log("=".repeat(80));
        console.log("RNN 模板已创建（AirPassengers 数据集）");
        console.log("网络结构：Input([12, 1]) -> RNN(128, dropout=0.2, recurrentDropout=0.1) -> Dense(1) -> Output");
        console.log("\nRNN 内部计算流程（自动展开）：");
        console.log("  时间步 0: h_0 = tanh(W_x·x_0 + W_h·h_{-1} + b)");
        console.log("  时间步 1: h_1 = tanh(W_x·x_1 + W_h·h_0 + b)");
        console.log("  ...");
        console.log("  时间步 11: h_11 = tanh(W_x·x_11 + W_h·h_10 + b)");
        console.log("  最终输出: y = Dense(h_11)");
        console.log("\n注意：");
        console.log("  - Input 层输出 [12, 1] 格式（timeSteps, features）");
        console.log("  - RNN 层可以直接处理这种格式，无需 Reshape 层");
        console.log("  - RNN 层会自动处理整个序列（12个时间步），权重在时间步间共享");
        console.log("  - 类似 ResNet 的残差连接，RNN 通过循环连接传递隐藏状态");
        console.log("=".repeat(80));
    } else {
        // 图像数据：Input -> Flatten -> Dense -> Dropout -> Dense(10) -> Output
        // 注意：Reshape 层已从前端移除，对于图像数据使用 Flatten + Dense 替代
        const inputPos = new Point(width / 5, height / 3);
        const flattenPos = new Point(width / 4, height / 2);
        const dense1Pos = new Point(width / 2.5, height / 2);
        const dropoutPos = new Point(width / 1.2, height / 2);
        const dense2Pos = new Point(width / 1.5, height / 2);
        const outputPos = new Point(width - 100, height / 2);
        
        const flatten = new Flatten(flattenPos);
        
        const dropout = new Dropout(dropoutPos);
        dropout.parameterDefaults.rate = 0.2;
        
        const dense1: ActivationLayer = new Dense(dense1Pos);
        dense1.parameterDefaults.units = 64;
        const dense1Relu: Activation = new Relu(dense1Pos);
        dense1.addActivation(dense1Relu);
        
        const dense2: ActivationLayer = new Dense(dense2Pos);
        dense2.parameterDefaults.units = 10;  // 图像数据：分类任务，输出10个类别
        
        // Add relationships among layers
        svgData.input.setPosition(inputPos);
        svgData.output.setPosition(outputPos);
        svgData.input.addChild(flatten);
        flatten.addChild(dense1);
        dense1.addChild(dropout);
        dropout.addChild(dense2);
        dense2.addChild(svgData.output);
        
        // Store the new network
        svgData.draggable.push(flatten);
        svgData.draggable.push(dense1);
        svgData.draggable.push(dense1Relu);
        svgData.draggable.push(dropout);
        svgData.draggable.push(dense2);
    }
    // 注意：Output层会自动应用softmax（分类任务），所以Dense层不需要激活函数
}

// LSTM模板
export function lstmTemplate(svgData: IDraggableData): void {
    resetWorkspace(svgData);

    // 自动设置数据集为 AirPassengers
    // 先更新全局数据集
    changeDataset("airpassengers");
    
    // 然后使用 setParams 设置 Input 层的参数
    // setParams 方法会自动更新 paramBox 中的 select 元素
    const params = new Map<string, any>();
    params.set("dataset", "airpassengers");
    svgData.input.setParams(params);
    
    console.log("LSTM 模板：数据集已自动设置为 AirPassengers");

    // Initialize each of the layers and activations
    const canvasBoundingBox = getSvgOriginalBoundingBox(document.getElementById("svg") as any as SVGSVGElement);
    const width = canvasBoundingBox.width;
    const height = canvasBoundingBox.height;

    // 获取当前数据集类型（现在应该是 airpassengers）
    const currentDataset = svgData.input.getParams().dataset;
    const isTimeSeries = currentDataset === "airpassengers";
    
    // 对于 AirPassengers 数据集，自动设置 epochs 为 20
    if (isTimeSeries) {
        model.params.epochs = 20;
        // 同时更新 HTML 输入框的值，确保 UI 显示一致
        const epochsInput = document.getElementById("epochs") as HTMLInputElement;
        if (epochsInput) {
            epochsInput.value = "20";
            console.log("LSTM 模板训练 AirPassengers：epochs 已自动设置为 20");
        }
    }

    const inputPos = new Point(width / 5, height / 3);
    const lstm1Pos = isTimeSeries ? new Point(width / 2.5, height / 2) : new Point(width / 2.5, height / 2);
    const densePos = new Point(width / 1.5, height / 2);
    const outputPos = new Point(width - 100, height / 2);

    // 对于时序数据（AirPassengers），数据已经是3D格式[12, 1]，不需要Reshape层
    // 对于图像数据（MNIST/CIFAR），使用 Flatten + Dense 替代 Reshape
    let flatten: Flatten | null = null;
    let dense1: ActivationLayer | null = null;
    if (!isTimeSeries) {
        const flattenPos = new Point(width / 4, height / 2);
        flatten = new Flatten(flattenPos);
        
        const dense1Pos = new Point(width / 3, height / 2);
        dense1 = new Dense(dense1Pos);
        dense1.parameterDefaults.units = 64;
        const dense1Relu: Activation = new Relu(dense1Pos);
        dense1.addActivation(dense1Relu);
        svgData.draggable.push(dense1Relu);
    }
    
    const lstm1: ActivationLayer = new LSTM(lstm1Pos);
    // LSTM层：units=64, dropout=0（参考PyTorch代码）
    
    // 对于时序预测任务，LSTM通常不需要激活函数
    // 对于分类任务，可以添加ReLU激活函数
    let lstmRelu: Activation | null = null;
    if (!isTimeSeries) {
        lstmRelu = new Relu(lstm1Pos);
        lstm1.addActivation(lstmRelu);
    }
    
    const dense: ActivationLayer = new Dense(densePos);
    if (isTimeSeries) {
        // 时序预测任务：输出1个值（回归任务）
        dense.parameterDefaults.units = 1;
        // 回归任务不需要激活函数
    } else {
        // 分类任务：输出10个类别
        dense.parameterDefaults.units = 10;
        // 为Dense层添加ReLU激活函数
        const denseRelu: Activation = new Relu(densePos);
        dense.addActivation(denseRelu);
        svgData.draggable.push(denseRelu);
    }

    // Add relationships among layers
    svgData.input.setPosition(inputPos);
    svgData.output.setPosition(outputPos);
    
    if (isTimeSeries) {
        // 时序数据：Input -> LSTM -> Dense -> Output（不需要Reshape和激活函数）
        svgData.input.addChild(lstm1);
        lstm1.addChild(dense);
        dense.addChild(svgData.output);
    } else {
        // 图像数据：Input -> Flatten -> Dense -> LSTM -> Dense -> Output
        svgData.input.addChild(flatten!);
        flatten!.addChild(dense1!);
        dense1!.addChild(lstm1);
        lstm1.addChild(dense);
        dense.addChild(svgData.output);
    }

    // Store the new network
    if (flatten) {
        svgData.draggable.push(flatten);
    }
    if (dense1) {
        svgData.draggable.push(dense1);
    }
    svgData.draggable.push(lstm1);
    if (lstmRelu) {
        svgData.draggable.push(lstmRelu);
    }
    svgData.draggable.push(dense);
}

/**
 * LSTM完整内部结构模板 - 完全展开LSTM的所有计算过程
 * 展示遗忘门、输入门、输出门、候选记忆、记忆更新、隐藏状态更新等所有步骤
 * 前端显示名称：LSTM完整内部结构
 * 
 * LSTM计算公式：
 * 1. f_t = σ(W_f · [h_{t-1}, x_t] + b_f)  // 遗忘门
 * 2. i_t = σ(W_i · [h_{t-1}, x_t] + b_i)  // 输入门
 * 3. o_t = σ(W_o · [h_{t-1}, x_t] + b_o)  // 输出门
 * 4. C̃_t = tanh(W_C · [h_{t-1}, x_t] + b_C)  // 候选记忆
 * 5. C_t = f_t ⊙ C_{t-1} + i_t ⊙ C̃_t  // 记忆更新
 * 6. h_t = o_t ⊙ tanh(C_t)  // 隐藏状态更新
 */
export function lstmFullInternalStructureTemplate(svgData: IDraggableData): void {
    resetWorkspace(svgData);

    // 自动设置数据集为 AirPassengers（用于时序数据训练）
    // 先更新全局数据集
    changeDataset("airpassengers");
    
    // 注意：populateParamBox 已经在 Layer 构造函数中调用过了
    // 所以不需要再次调用，直接使用 setParams 更新参数即可
    // setParams 方法会自动更新 paramBox 中的 select 元素
    const params = new Map<string, any>();
    params.set("dataset", "airpassengers");
    svgData.input.setParams(params);

    const canvasBoundingBox = getSvgOriginalBoundingBox(document.getElementById("svg") as any as SVGSVGElement);
    const width = canvasBoundingBox.width;
    const height = canvasBoundingBox.height;

    // 获取当前数据集类型（现在应该是 airpassengers）
    const currentDataset = svgData.input.getParams().dataset;
    const isTimeSeries = currentDataset === "airpassengers";
    
    // 对于 LSTM 完整内部结构模板，自动设置 batch_size 为 1
    // 这对于时序数据训练很重要，因为 batch_size=1 可以确保每个时间步都独立处理
    model.params.batchSize = 1;
    // 同时更新 HTML 输入框的值，确保 UI 显示一致
    const batchSizeInput = document.getElementById("batchSize") as HTMLInputElement;
    if (batchSizeInput) {
        batchSizeInput.value = "1";
    }
    
    console.log("LSTM完整内部结构模板：数据集已自动设置为 AirPassengers，batch_size 已自动设置为 1");

    // ========== 布局定义（参考 ResNet 模板的紧凑布局，减少线条交叉）==========
    // 左侧：输入和前一时刻的状态（紧凑垂直排列）
    const inputPos = new Point(width * 0.15, height * 0.5);           // X_t
    const hiddenStatePrevPos = new Point(width * 0.15, height * 0.38);  // H_{t-1}
    const cellStatePrevPos = new Point(width * 0.15, height * 0.62);    // C_{t-1}
    
    // 对于时序数据，需要添加 Flatten 层将 3D [batch, timesteps, features] 转换为 2D [batch, timesteps*features]
    // 对于非时序数据，不需要 Flatten
    const flattenPos = isTimeSeries ? new Point(width * 0.20, height * 0.5) : null;
    
    // 第一层：合并输入（居中，连接 X_t 和 H_{t-1}）
    const concatPos = new Point(width * 0.26, height * 0.44);          // [H_{t-1}, X_t]
    
    // 第二层：门控层（紧凑垂直排列，间距更小，参考 ResNet 风格）
    const forgetGatePos = new Point(width * 0.38, height * 0.35);      // 遗忘门 F_t
    const inputGatePos = new Point(width * 0.38, height * 0.44);      // 输入门 I_t
    const outputGatePos = new Point(width * 0.38, height * 0.53);     // 输出门 O_t
    const candidatePos = new Point(width * 0.38, height * 0.62);       // 候选记忆 C̃_t
    
    // 第三层：乘法操作（紧凑排列，与门控层对齐，减少交叉）
    // Forget Multiply 需要连接 Forget Gate 和 C_{t-1}
    const forgetMultPos = new Point(width * 0.50, height * 0.48);      // F_t ⊙ C_{t-1}
    // Input Multiply 需要连接 Input Gate 和 Candidate
    const inputMultPos = new Point(width * 0.50, height * 0.53);      // I_t ⊙ C̃_t
    
    // 第四层：记忆更新（居中，连接两个 Multiply）
    const cellAddPos = new Point(width * 0.60, height * 0.50);         // C_t = F_t⊙C_{t-1} + I_t⊙C̃_t
    
    // 第五层：隐藏状态计算（紧凑排列，减少交叉）
    const cellTanhPos = new Point(width * 0.70, height * 0.50);        // tanh(C_t)
    // Output Multiply 需要连接 Output Gate 和 tanh(C_t)
    const outputMultPos = new Point(width * 0.80, height * 0.47);     // O_t ⊙ tanh(C_t) = H_t
    
    // 第六层：Dropout 正则化（防止过拟合）
    const dropoutPos = new Point(width * 0.85, height * 0.47);
    
    // 右侧：输出
    const outputPos = new Point(width - 30, height * 0.47);

    // ========== 创建层 ==========
    
    // 1. 输入层
    svgData.input.setPosition(inputPos);
    
    // 2. 对于时序数据，添加 Flatten 层（将 [batch, timesteps, features] 转换为 [batch, timesteps*features]）
    let flattenLayer: Flatten | null = null;
    if (isTimeSeries && flattenPos) {
        flattenLayer = new Flatten(flattenPos);
    }
    
    // 3. 前一时刻的状态（用于循环连接）
    // 注意：这些是占位层，用于可视化。在实际训练中，它们不应该参与计算
    // 但为了通过拓扑排序，我们需要让它们连接到 Input
    const hiddenStatePrev = new Dense(hiddenStatePrevPos);
    // 对于时序数据，hiddenStatePrev 的输出应该与 Flatten 的输出维度匹配
    // Flatten 输出 [batch, timesteps*features] = [batch, 12*1] = [batch, 12]
    // 所以 hiddenStatePrev 的 units 应该设置为 12（与 Flatten 输出匹配）
    if (isTimeSeries) {
        hiddenStatePrev.parameterDefaults.units = 12;  // 与 Flatten 输出匹配
    } else {
        hiddenStatePrev.parameterDefaults.units = 64;
    }
    hiddenStatePrev.layerType = "HiddenStatePrev";
    
    const cellStatePrev = new Dense(cellStatePrevPos);
    // cellStatePrev 用于 forgetMultiply，需要与 C_{t-1} 的维度匹配
    // 在 LSTM 中，C_t 的维度是 units（64），所以这里保持 64
    cellStatePrev.parameterDefaults.units = 64;
    cellStatePrev.layerType = "CellStatePrev";
    
    // 4. 合并输入和隐藏状态 [H_{t-1}, X_t]
    const concatInput = new Concatenate(concatPos);
    
    // 4. 遗忘门：F_t = σ(W_f · [H_{t-1}, X_t] + b_f)
    const forgetGate = new Dense(forgetGatePos);
    forgetGate.parameterDefaults.units = 64;
    // 更新 UI 中的 units 输入框值
    const forgetGateParams = new Map<string, any>();
    forgetGateParams.set("units", 64);
    forgetGate.setParams(forgetGateParams);
    const forgetSigmoid = new Sigmoid(forgetGatePos);
    forgetGate.addActivation(forgetSigmoid);
    
    // 5. 输入门：I_t = σ(W_i · [H_{t-1}, X_t] + b_i)
    const inputGate = new Dense(inputGatePos);
    inputGate.parameterDefaults.units = 64;
    const inputGateParams = new Map<string, any>();
    inputGateParams.set("units", 64);
    inputGate.setParams(inputGateParams);
    const inputSigmoid = new Sigmoid(inputGatePos);
    inputGate.addActivation(inputSigmoid);
    
    // 6. 输出门：O_t = σ(W_o · [H_{t-1}, X_t] + b_o)
    const outputGate = new Dense(outputGatePos);
    outputGate.parameterDefaults.units = 64;
    const outputGateParams = new Map<string, any>();
    outputGateParams.set("units", 64);
    outputGate.setParams(outputGateParams);
    const outputSigmoid = new Sigmoid(outputGatePos);
    outputGate.addActivation(outputSigmoid);
    
    // 7. 候选记忆：C̃_t = tanh(W_C · [H_{t-1}, X_t] + b_C)
    const candidateGate = new Dense(candidatePos);
    candidateGate.parameterDefaults.units = 64;
    const candidateGateParams = new Map<string, any>();
    candidateGateParams.set("units", 64);
    candidateGate.setParams(candidateGateParams);
    const candidateTanh = new Tanh(candidatePos);
    candidateGate.addActivation(candidateTanh);
    
    // 8. Multiply层：遗忘门操作 F_t ⊙ C_{t-1}
    const forgetMultiply = new Multiply(forgetMultPos);
    
    // 9. Multiply层：输入门操作 I_t ⊙ C̃_t
    const inputMultiply = new Multiply(inputMultPos);
    
    // 10. Add层：记忆更新 C_t = F_t ⊙ C_{t-1} + I_t ⊙ C̃_t
    const cellAdd = new Add(cellAddPos);
    
    // 11. Tanh激活：tanh(C_t)
    // 注意：在数学上，tanh(C_t) 是对 C_t 的每个元素应用 tanh 函数
    // 这里使用 Dense 层 + Tanh 激活来近似表示（units 与 C_t 维度相同）
    // 在实际训练中，这个 Dense 层会学习到合适的权重
    const cellTanhLayer = new Dense(cellTanhPos);
    cellTanhLayer.parameterDefaults.units = 64;  // 与 C_t 维度相同
    const cellTanhParams = new Map<string, any>();
    cellTanhParams.set("units", 64);
    cellTanhLayer.setParams(cellTanhParams);
    const cellTanhActivation = new Tanh(cellTanhPos);
    cellTanhLayer.addActivation(cellTanhActivation);
    
    // 12. Multiply层：输出门操作 O_t ⊙ tanh(C_t) = H_t
    const outputMultiply = new Multiply(outputMultPos);
    
    // 13. Dropout 层：防止过拟合（用于实际训练）
    const dropout = new Dropout(dropoutPos);
    dropout.parameterDefaults.rate = 0.2;  // 与 RNN 内部结构模板的 dropout 参数一致
    
    // ========== 设置输入和输出位置（必须在连接之前）==========
    svgData.input.setPosition(inputPos);
    svgData.output.setPosition(outputPos);
    
    // ========== 连接关系 ==========
    
    // 注意：hiddenStatePrev 和 cellStatePrev 是可视化占位层
    // 为了通过拓扑排序检查，我们需要让它们也能追溯到 Input
    // 但为了避免形状不匹配问题，我们让它们不参与实际的数据流
    // 方法：让它们连接到 Input（或 Flatten），但不连接到 concatInput
    
    // 对于时序数据，Input -> Flatten -> Concat
    // 对于非时序数据，Input -> Concat
    if (isTimeSeries && flattenLayer) {
        svgData.input.addChild(flattenLayer);
        // 占位层连接到 Flatten 以通过拓扑排序
        flattenLayer.addChild(hiddenStatePrev);
        flattenLayer.addChild(cellStatePrev);
        // concatInput 需要两个输入 [H_{t-1}, X_t]
        // 时序数据：Flatten 输出 [batch, 12]，hiddenStatePrev 输出 [batch, 12]，可以 concat
        flattenLayer.addChild(concatInput);
        hiddenStatePrev.addChild(concatInput);
    } else {
        svgData.input.addChild(concatInput);
        // 对于非时序数据，占位层连接到 Input 以通过拓扑排序
        svgData.input.addChild(hiddenStatePrev);
        svgData.input.addChild(cellStatePrev);
        // 非时序数据：Input -> concatInput, hiddenStatePrev -> concatInput
        hiddenStatePrev.addChild(concatInput);
    }
    
    // 所有门控层都从合并输入接收数据
    concatInput.addChild(forgetGate);
    concatInput.addChild(inputGate);
    concatInput.addChild(outputGate);
    concatInput.addChild(candidateGate);
    
    // 遗忘门操作：F_t ⊙ C_{t-1}
    forgetGate.addChild(forgetMultiply);
    cellStatePrev.addChild(forgetMultiply);
    
    // 输入门操作：I_t ⊙ C̃_t
    inputGate.addChild(inputMultiply);
    candidateGate.addChild(inputMultiply);
    
    // 记忆更新：C_t = F_t⊙C_{t-1} + I_t⊙C̃_t
    forgetMultiply.addChild(cellAdd);
    inputMultiply.addChild(cellAdd);
    
    // 隐藏状态计算：H_t = O_t ⊙ tanh(C_t)
    cellAdd.addChild(cellTanhLayer);  // C_t -> tanh(C_t)
    outputGate.addChild(outputMultiply);
    cellTanhLayer.addChild(outputMultiply);  // tanh(C_t) 和 O_t 相乘
    
    // 输出：outputMultiply -> dropout -> Output
    // Dropout 层用于防止过拟合，提高模型泛化能力
    // Output 层会自动创建 Dense 层来匹配输出维度（时序数据：1维，分类数据：10维）
    outputMultiply.addChild(dropout);
    dropout.addChild(svgData.output);
    
    // ========== 添加循环连接 ==========
    // H_t 循环连接到 H_{t-1}（用于下一时刻）
    outputMultiply.addCircularConnection(hiddenStatePrev, "H_t → H_{t+1}");
    // C_t 循环连接到 C_{t-1}（用于下一时刻）
    cellAdd.addCircularConnection(cellStatePrev, "C_t → C_{t+1}");
    
    // ========== 存储所有层 ==========
    if (flattenLayer) {
        svgData.draggable.push(flattenLayer);
    }
    svgData.draggable.push(hiddenStatePrev);
    svgData.draggable.push(cellStatePrev);
    svgData.draggable.push(concatInput);
    svgData.draggable.push(forgetGate);
    svgData.draggable.push(forgetSigmoid);
    svgData.draggable.push(inputGate);
    svgData.draggable.push(inputSigmoid);
    svgData.draggable.push(outputGate);
    svgData.draggable.push(outputSigmoid);
    svgData.draggable.push(candidateGate);
    svgData.draggable.push(candidateTanh);
    svgData.draggable.push(forgetMultiply);
    svgData.draggable.push(inputMultiply);
    svgData.draggable.push(outputMultiply);
    svgData.draggable.push(cellAdd);
    svgData.draggable.push(cellTanhLayer);
    svgData.draggable.push(cellTanhActivation);
    svgData.draggable.push(dropout);
    
    console.log("LSTM完整内部结构模板已创建");
    console.log("展示了所有门控机制和计算过程：");
    console.log("1. 遗忘门 F_t = σ(W_f · [H_{t-1}, X_t] + b_f)");
    console.log("2. 输入门 I_t = σ(W_i · [H_{t-1}, X_t] + b_i)");
    console.log("3. 输出门 O_t = σ(W_o · [H_{t-1}, X_t] + b_o)");
    console.log("4. 候选记忆 C̃_t = tanh(W_C · [H_{t-1}, X_t] + b_C)");
    console.log("5. 记忆更新 C_t = F_t ⊙ C_{t-1} + I_t ⊙ C̃_t");
    console.log("6. 隐藏状态 H_t = O_t ⊙ tanh(C_t)");
    console.log("7. Dropout 正则化：防止过拟合（rate=0.2）");
    console.log("8. 输出层：y = Dense(H_t)（Output 层自动创建）");
    if (isTimeSeries) {
        console.log("数据集: AirPassengers (时序数据)");
        console.log("输入形状: [12, 1] (12个时间步，1个特征)");
        console.log("输出: 1个值 (回归任务)");
        console.log("注意：此模板可用于实际训练，包含 Dropout 正则化以提高泛化能力");
    }
}

/**
 * RNN 完整内部结构模板函数（参考 LSTM 完整内部结构模板）
 * 展示 RNN 的所有训练流程，包括输入合并、线性变换、激活函数等
 */
export function rnnInternalStructureTemplate(svgData: IDraggableData): void {
    resetWorkspace(svgData);

    // 自动设置数据集为 AirPassengers
    changeDataset("airpassengers");
    const params = new Map<string, any>();
    params.set("dataset", "airpassengers");
    svgData.input.setParams(params);
    
    // 自动设置 epochs 和学习率
    model.params.epochs = 100;
    model.params.learningRate = 0.0005;
    // 对于 RNN 完整内部结构模板，自动设置 batch_size 为 1
    model.params.batchSize = 1;
    const epochsInput = document.getElementById("epochs") as HTMLInputElement;
    const lrInput = document.getElementById("learningRate") as HTMLInputElement;
    const batchSizeInput = document.getElementById("batchSize") as HTMLInputElement;
    if (epochsInput) { epochsInput.value = "100"; }
    if (lrInput) { lrInput.value = "0.0005"; }
    if (batchSizeInput) { batchSizeInput.value = "1"; }

    console.log("RNN 完整内部结构模板：数据集已自动设置为 AirPassengers，batch_size 已自动设置为 1");

    const canvasBoundingBox = getSvgOriginalBoundingBox(document.getElementById("svg") as any as SVGSVGElement);
    const width = canvasBoundingBox.width;
    const height = canvasBoundingBox.height;

    // 获取当前数据集类型（现在应该是 airpassengers）
    const currentDataset = svgData.input.getParams().dataset;
    const isTimeSeries = currentDataset === "airpassengers";
    
    // ========== 布局定义（优化后的清晰布局，主要数据流在同一水平线）==========
    // 主数据流水平线：height * 0.5（所有主要层都在这一条线上）
    const mainDataFlowY = height * 0.5;
    
    // 左侧：输入（主数据流起点）
    const inputPos = new Point(width * 0.10, mainDataFlowY);           // X_t（当前输入）
    
    // 前一时刻的隐藏状态（占位层，位于上方，不参与主数据流）
    const hiddenStatePrevPos = new Point(width * 0.10, height * 0.30);  // H_{t-1}（前一时刻隐藏状态）
    
    // 对于时序数据，需要添加 Flatten 层将 3D [batch, timesteps, features] 转换为 2D [batch, timesteps*features]
    const flattenPos = isTimeSeries ? new Point(width * 0.22, mainDataFlowY) : null;
    
    // 第一层：合并输入 [H_{t-1}, X_t]（主数据流上）
    const concatPos = new Point(width * 0.35, mainDataFlowY);
    
    // 第二层：线性变换 z_t = W · [X_t, H_{t-1}] + b（主数据流上）
    const denseTransformPos = new Point(width * 0.50, mainDataFlowY);
    
    // 第三层：Tanh 激活 H_t = tanh(z_t)（与 Dense 层位置相同，作为激活函数）
    const tanhPos = new Point(width * 0.50, mainDataFlowY);  // Tanh 激活函数与 Dense 层位置相同
    
    // 第四层：Dropout 正则化（主数据流上）
    const dropoutPos = new Point(width * 0.65, mainDataFlowY);
    
    // 右侧：输出（主数据流终点）
    const outputPos = new Point(width - 60, mainDataFlowY);

    // ========== 创建层 ==========
    
    // 1. 输入层
    svgData.input.setPosition(inputPos);
    
    // 2. 对于时序数据，添加 Flatten 层
    let flattenLayer: Flatten | null = null;
    if (isTimeSeries && flattenPos) {
        flattenLayer = new Flatten(flattenPos);
    }
    
    // 3. 前一时刻的隐藏状态（占位层，用于循环连接和拓扑排序）
    // 注意：这是占位层，用于：
    //   - 提供 H_{t-1} 的输入路径，使 concatInput 有两个父层（符合 RNN 语义）
    //   - 通过拓扑排序检查（所有父层必须已被访问）
    //   - 在可视化上表示"前一时刻的隐藏状态"
    // 在实际训练中，循环连接由 TensorFlow.js 的 RNN 层内部处理
    const hiddenStatePrev = new Dense(hiddenStatePrevPos);
    // 对于时序数据，hiddenStatePrev 的输出应该与 Flatten 的输出维度匹配
    // Flatten 输出 [batch, timesteps*features] = [batch, 12*1] = [batch, 12]
    if (isTimeSeries) {
        hiddenStatePrev.parameterDefaults.units = 12;  // 与 Flatten 输出匹配
    } else {
        hiddenStatePrev.parameterDefaults.units = 128;
    }
    hiddenStatePrev.parameterDefaults.activation = "linear";
    hiddenStatePrev.layerType = "HiddenStatePrev";
    // 注意：占位层标记在 Dense 类的 populateParamBox 中根据 layerType 自动添加
    
    // 4. 合并输入和隐藏状态 [H_{t-1}, X_t]
    const concatInput = new Concatenate(concatPos);
    
    // 5. 线性变换：z_t = W · [X_t, H_{t-1}] + b
    const denseTransform = new Dense(denseTransformPos);
    denseTransform.parameterDefaults.units = 128;
    denseTransform.parameterDefaults.activation = "linear";
    const denseTransformParams = new Map<string, any>();
    denseTransformParams.set("units", 128);
    denseTransform.setParams(denseTransformParams);
    
    // 6. Tanh 激活：H_t = tanh(z_t)
    const tanhActivation = new Tanh(tanhPos);
    denseTransform.addActivation(tanhActivation);
    
    // 7. Dropout 层：防止过拟合（用于实际训练）
    const dropout = new Dropout(dropoutPos);
    dropout.parameterDefaults.rate = 0.2;  // 与标准 RNN 模板的 dropout 参数一致
    
    // ========== 设置输入和输出位置（必须在连接之前）==========
    svgData.input.setPosition(inputPos);
    svgData.output.setPosition(outputPos);
    
    // ========== 连接关系 ==========
    
    // 注意：hiddenStatePrev 是可视化占位层
    // 为了通过拓扑排序检查，我们需要让它们也能追溯到 Input
    // 对于时序数据，Input -> Flatten -> Concat
    // 对于非时序数据，Input -> Concat
    if (isTimeSeries && flattenLayer) {
        svgData.input.addChild(flattenLayer);
        // 占位层连接到 Flatten 以通过拓扑排序
        flattenLayer.addChild(hiddenStatePrev);
        // concatInput 需要两个输入 [H_{t-1}, X_t]
        // 时序数据：Flatten 输出 [batch, 12]，hiddenStatePrev 输出 [batch, 12]，可以 concat
        flattenLayer.addChild(concatInput);
        hiddenStatePrev.addChild(concatInput);
    } else {
        svgData.input.addChild(concatInput);
        // 对于非时序数据，占位层连接到 Input 以通过拓扑排序
        svgData.input.addChild(hiddenStatePrev);
        // 非时序数据：Input -> concatInput, hiddenStatePrev -> concatInput
        hiddenStatePrev.addChild(concatInput);
    }
    
    // 线性变换：concatInput -> denseTransform
    concatInput.addChild(denseTransform);
    
    // Tanh 激活：denseTransform -> tanhActivation（已通过 addActivation 连接）
    // 注意：tanhActivation 是激活函数，不直接作为子层连接
    
    // 隐藏状态计算：denseTransform -> Dropout -> Output
    // 由于 tanhActivation 是激活函数，数据流是 denseTransform -> Dropout -> Output
    // Dropout 层用于防止过拟合，提高模型泛化能力
    // Output 层会自动创建 Dense 层来匹配输出维度（时序数据：1维，分类数据：10维）
    denseTransform.addChild(dropout);
    dropout.addChild(svgData.output);
    
    // ========== 添加循环连接 ==========
    // H_t 循环连接到 H_{t-1}（用于下一时刻）
    // 注意：denseTransform 的输出是 H_t（经过 Tanh 激活）
    // hiddenStatePrev 是占位层，用于拓扑排序和提供 H_{t-1} 的输入路径
    denseTransform.addCircularConnection(hiddenStatePrev, "H_t → H_{t+1}");
    
    // ========== 存储所有层 ==========
    if (flattenLayer) {
        svgData.draggable.push(flattenLayer);
    }
    svgData.draggable.push(hiddenStatePrev);
    svgData.draggable.push(concatInput);
    svgData.draggable.push(denseTransform);
    svgData.draggable.push(tanhActivation);
    svgData.draggable.push(dropout);
    
    console.log("=".repeat(80));
    console.log("RNN 完整内部结构模板已创建");
    console.log("展示了所有计算步骤：");
    console.log("1. 输入合并：[X_t, H_{t-1}]");
    console.log("2. 线性变换：z_t = W · [X_t, H_{t-1}] + b");
    console.log("3. Tanh 激活：H_t = tanh(z_t)");
    console.log("4. Dropout 正则化：防止过拟合（rate=0.2）");
    console.log("5. 输出层：y = Dense(H_t)");
    console.log("6. 循环连接：H_t → H_{t+1}");
    if (isTimeSeries) {
        console.log("数据集: AirPassengers (时序数据)");
        console.log("输入形状: [12, 1] (12个时间步，1个特征)");
        console.log("输出: 1个值 (回归任务)");
        console.log("注意：此模板可用于实际训练，包含 Dropout 正则化以提高泛化能力");
    }
    console.log("=".repeat(80));
}