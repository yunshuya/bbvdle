import { IDraggableData } from "./app";
import { Activation, Relu, Tanh } from "./shapes/activation";
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
import { Reshape } from "./shapes/layers/reshape";
import { Sigmoid } from "./shapes/activation";
import { getSvgOriginalBoundingBox } from "./utils";
import { windowProperties } from "./window";

export function resetWorkspace(svgData: IDraggableData): void {
    // Deselect current element
    if (windowProperties.selectedElement != null) {
        windowProperties.selectedElement.unselect();
    }
    // Set input and output locations
    if (svgData.input != null) {
        svgData.input.setPosition(svgData.input.defaultLocation);
        svgData.input.wires.forEach((w) => w.delete());
        svgData.input.deleteCircularWires();  // 清理循环连接
    }
    if (svgData.output != null) {
        svgData.output.setPosition(svgData.output.defaultLocation);
        svgData.output.deleteCircularWires();  // 清理循环连接
    }

    // Remove all other layers
    for (const layer of svgData.draggable) {
        layer.delete();  // delete() 方法会自动清理循环连接
    }

    // Clear the current list of draggables
    svgData.draggable = [];
}

export function defaultTemplate(svgData: IDraggableData): void {
    resetWorkspace(svgData);

    // Initialize each of the layers and activations
    const canvasBoundingBox = getSvgOriginalBoundingBox(document.getElementById("svg") as any as SVGSVGElement);
    const convStartingPosition = new Point(canvasBoundingBox.width / 4, canvasBoundingBox.height / 2.5);
    const flatStartingPosition = new Point(canvasBoundingBox.width / 1.75, canvasBoundingBox.height / 2.5);
    const denseStartingPosition = new Point(canvasBoundingBox.width * 5 / 6.5, canvasBoundingBox.height / 2.5);
    const conv: ActivationLayer = new Conv2D(convStartingPosition);
    const convRelu: Activation = new Relu(convStartingPosition);

    const flat: Layer = new Flatten(flatStartingPosition);
    const dense: ActivationLayer = new Dense(denseStartingPosition);
    const denseRelu: Activation = new Relu(denseStartingPosition);

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

    // Initialize each of the layers and activations
    const canvasBoundingBox = getSvgOriginalBoundingBox(document.getElementById("svg") as any as SVGSVGElement);
    const width = canvasBoundingBox.width;
    const height = canvasBoundingBox.height;

    // 获取当前数据集类型
    const currentDataset = svgData.input.getParams().dataset;
    const isTimeSeries = currentDataset === "airpassengers";

    const inputPos = new Point(width / 5, height / 3);
    const rnn1Pos = isTimeSeries ? new Point(width / 2.5, height / 2) : new Point(width / 2.5, height / 2);
    const densePos = new Point(width / 1.5, height / 2);
    const outputPos = new Point(width - 100, height / 2);

    // 对于时序数据（AirPassengers），数据已经是3D格式[12, 1]，不需要Reshape层
    // 对于图像数据（MNIST/CIFAR），需要Reshape层
    let reshape: Layer | null = null;
    let dropout: Layer | null = null;
    
    if (!isTimeSeries) {
        const reshapePos = new Point(width / 4, height / 2);
        const dropoutPos = new Point(width / 1.2, height / 2);
        
        // Reshape层：将图像 (28, 28, 1) 或 (32, 32, 3) 转换为序列格式
        reshape = new Reshape(reshapePos);
        if (currentDataset === "cifar") {
            // CIFAR-10: (32, 32, 3) -> (32, 96) 其中32是时间步，96是特征（32*3）
            reshape.parameterDefaults.targetShape1 = 32;
            reshape.parameterDefaults.targetShape2 = 96;
        } else {
            // MNIST: (28, 28, 1) -> (28, 28) 其中28是时间步，28是特征
            reshape.parameterDefaults.targetShape1 = 28;
            reshape.parameterDefaults.targetShape2 = 28;
        }
        
        dropout = new Dropout(dropoutPos);
        // 设置dropout比例为0.2，避免过高的dropout导致训练不稳定
        dropout.parameterDefaults.rate = 0.2;
    }
    
    const rnn1: ActivationLayer = new Recurrent(rnn1Pos);
    // 设置RNN层units为64以提高表达能力
    rnn1.parameterDefaults.units = 64;
    // 为RNN层添加tanh激活函数（RNN的默认激活函数，比ReLU更适合序列数据）
    const rnnTanh: Activation = new Tanh(rnn1Pos);
    
    const dense: ActivationLayer = new Dense(densePos);
    if (isTimeSeries) {
        // 时序数据：回归任务，输出1个值
        dense.parameterDefaults.units = 1;
    } else {
        // 图像数据：分类任务，输出10个类别
        dense.parameterDefaults.units = 10;
    }
    // 注意：Dense层不使用激活函数，因为Output层会自动应用softmax（分类任务）
    // 对于回归任务（时序数据），Output层不会应用softmax

    // Add activations
    rnn1.addActivation(rnnTanh);
    // Dense层不添加激活函数，让Output层处理softmax（分类任务）

    // Add relationships among layers
    svgData.input.setPosition(inputPos);
    svgData.output.setPosition(outputPos);
    
    if (isTimeSeries) {
        // 时序数据：Input -> RNN -> Dense(1) -> Output
        svgData.input.addChild(rnn1);
        rnn1.addChild(dense);
        dense.addChild(svgData.output);
        
        // Store the new network
        svgData.draggable.push(rnn1);
        svgData.draggable.push(rnnTanh);
        svgData.draggable.push(dense);
    } else {
        // 图像数据：Input -> Reshape -> RNN -> Dropout -> Dense(10) -> Output
        svgData.input.addChild(reshape);
        reshape.addChild(rnn1);
        rnn1.addChild(dropout);
        dropout.addChild(dense);
        dense.addChild(svgData.output);
        
        // Store the new network
        svgData.draggable.push(reshape);
        svgData.draggable.push(rnn1);
        svgData.draggable.push(rnnTanh);
        svgData.draggable.push(dropout);
        svgData.draggable.push(dense);
    }
    // 注意：Output层会自动应用softmax（分类任务），所以Dense层不需要激活函数
}

// LSTM模板
export function lstmTemplate(svgData: IDraggableData): void {
    resetWorkspace(svgData);

    // Initialize each of the layers and activations
    const canvasBoundingBox = getSvgOriginalBoundingBox(document.getElementById("svg") as any as SVGSVGElement);
    const width = canvasBoundingBox.width;
    const height = canvasBoundingBox.height;

    // 获取当前数据集类型
    const currentDataset = svgData.input.getParams().dataset;
    const isTimeSeries = currentDataset === "airpassengers";

    const inputPos = new Point(width / 5, height / 3);
    const lstm1Pos = isTimeSeries ? new Point(width / 2.5, height / 2) : new Point(width / 2.5, height / 2);
    const densePos = new Point(width / 1.5, height / 2);
    const outputPos = new Point(width - 100, height / 2);

    // 对于时序数据（AirPassengers），数据已经是3D格式[12, 1]，不需要Reshape层
    // 对于图像数据（MNIST/CIFAR），需要Reshape层
    let reshape: Layer | null = null;
    if (!isTimeSeries) {
        const reshapePos = new Point(width / 4, height / 2);
        reshape = new Reshape(reshapePos);
        if (currentDataset === "cifar") {
            // CIFAR-10: (32, 32, 3) -> (32, 96) 其中32是时间步，96是特征（32*3）
            reshape.parameterDefaults.targetShape1 = 32;
            reshape.parameterDefaults.targetShape2 = 96;
        } else {
            // MNIST: (28, 28, 1) -> (28, 28) 其中28是时间步，28是特征
            reshape.parameterDefaults.targetShape1 = 28;
            reshape.parameterDefaults.targetShape2 = 28;
        }
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
        // 图像数据：Input -> Reshape -> LSTM -> Dense -> Output
        svgData.input.addChild(reshape!);
        reshape!.addChild(lstm1);
        lstm1.addChild(dense);
        dense.addChild(svgData.output);
    }

    // Store the new network
    if (reshape) {
        svgData.draggable.push(reshape);
    }
    svgData.draggable.push(lstm1);
    if (lstmRelu) {
        svgData.draggable.push(lstmRelu);
    }
    svgData.draggable.push(dense);
}

/**
 * LSTM内部结构测试模板 - 用于测试Multiply层的功能
 * 展示LSTM单元内部的遗忘门、输入门、输出门等组件，使用Multiply层实现门控机制
 */
export function lstmInternalStructureTestTemplate(svgData: IDraggableData): void {
    resetWorkspace(svgData);

    const canvasBoundingBox = getSvgOriginalBoundingBox(document.getElementById("svg") as any as SVGSVGElement);
    const width = canvasBoundingBox.width;
    const height = canvasBoundingBox.height;

    // ========== 布局定义 ==========
    // 左侧：输入区域
    const inputPos = new Point(width * 0.1, height * 0.5);
    const hiddenStatePrevPos = new Point(width * 0.1, height * 0.3);  // H_{t-1} 占位层
    const cellStatePrevPos = new Point(width * 0.1, height * 0.7);     // C_{t-1} 占位层
    
    // 中间：LSTM内部结构
    const concatInputPos = new Point(width * 0.25, height * 0.5);      // 合并输入 [X_t, H_{t-1}]
    
    // 门控层（垂直排列）
    const forgetGatePos = new Point(width * 0.4, height * 0.25);       // 遗忘门
    const inputGatePos = new Point(width * 0.4, height * 0.45);       // 输入门
    const outputGatePos = new Point(width * 0.4, height * 0.65);      // 输出门
    const candidatePos = new Point(width * 0.4, height * 0.85);        // 候选记忆
    
    // 乘法操作（使用Multiply层）
    const forgetMultPos = new Point(width * 0.55, height * 0.5);      // F_t ⊙ C_{t-1}
    const inputMultPos = new Point(width * 0.55, height * 0.7);         // I_t ⊙ C̃_t
    
    // 加法操作
    const cellAddPos = new Point(width * 0.65, height * 0.6);          // C_t = F_t⊙C_{t-1} + I_t⊙C̃_t
    
    // Tanh激活（用于C_t）
    const cellTanhPos = new Point(width * 0.75, height * 0.6);          // tanh(C_t)
    
    // 输出门乘法
    const outputMultPos = new Point(width * 0.8, height * 0.5);        // O_t ⊙ tanh(C_t)
    
    // 右侧：输出
    const denseOutputPos = new Point(width * 0.9, height * 0.5);

    // ========== 创建层 ==========
    
    // 1. 输入层（当前输入 X_t）
    svgData.input.setPosition(inputPos);
    
    // 2. 前一时刻的隐藏状态和记忆状态（占位层，用于演示）
    const hiddenStatePrev = new Dense(hiddenStatePrevPos);
    hiddenStatePrev.parameterDefaults.units = 64;
    
    const cellStatePrev = new Dense(cellStatePrevPos);
    cellStatePrev.parameterDefaults.units = 64;
    
    // 3. 合并输入和隐藏状态
    const concatInput = new Concatenate(concatInputPos);
    
    // 4. 遗忘门：F_t = σ(W_f · [X_t, H_{t-1}] + b_f)
    const forgetGate = new Dense(forgetGatePos);
    forgetGate.parameterDefaults.units = 64;
    const forgetSigmoid = new Sigmoid(forgetGatePos);
    forgetGate.addActivation(forgetSigmoid);
    
    // 5. 输入门：I_t = σ(W_i · [X_t, H_{t-1}] + b_i)
    const inputGate = new Dense(inputGatePos);
    inputGate.parameterDefaults.units = 64;
    const inputSigmoid = new Sigmoid(inputGatePos);
    inputGate.addActivation(inputSigmoid);
    
    // 6. 输出门：O_t = σ(W_o · [X_t, H_{t-1}] + b_o)
    const outputGate = new Dense(outputGatePos);
    outputGate.parameterDefaults.units = 64;
    const outputSigmoid = new Sigmoid(outputGatePos);
    outputGate.addActivation(outputSigmoid);
    
    // 7. 候选记忆：C̃_t = tanh(W_c · [X_t, H_{t-1}] + b_c)
    const candidateGate = new Dense(candidatePos);
    candidateGate.parameterDefaults.units = 64;
    const candidateTanh = new Tanh(candidatePos);
    candidateGate.addActivation(candidateTanh);
    
    // 8. Multiply层：遗忘门操作 F_t ⊙ C_{t-1}
    const forgetMultiply = new Multiply(forgetMultPos);
    
    // 9. Multiply层：输入门操作 I_t ⊙ C̃_t
    const inputMultiply = new Multiply(inputMultPos);
    
    // 10. Add层：记忆更新 C_t = F_t ⊙ C_{t-1} + I_t ⊙ C̃_t
    const cellAdd = new Add(cellAddPos);
    
    // 11. Tanh激活：tanh(C_t)
    const cellTanhLayer = new Dense(cellTanhPos);
    cellTanhLayer.parameterDefaults.units = 64;
    const cellTanhActivation = new Tanh(cellTanhPos);
    cellTanhLayer.addActivation(cellTanhActivation);
    
    // 12. Multiply层：输出门操作 O_t ⊙ tanh(C_t)
    const outputMultiply = new Multiply(outputMultPos);
    
    // 13. 输出层
    const denseOutput = new Dense(denseOutputPos);
    denseOutput.parameterDefaults.units = 1;  // 假设回归任务
    
    // ========== 连接关系 ==========
    
    // 输入合并：X_t 和 H_{t-1} 合并
    svgData.input.addChild(concatInput);
    hiddenStatePrev.addChild(concatInput);
    
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
    
    // 输出
    outputMultiply.addChild(denseOutput);
    denseOutput.addChild(svgData.output);
    
    // ========== 存储所有层 ==========
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
    svgData.draggable.push(denseOutput);
    
    // ========== 添加循环连接 ==========
    
    // 1. H_t 循环连接到 H_{t-1}（用于下一时刻）
    // 从输出层（outputMultiply）循环连接到隐藏状态占位层（hiddenStatePrev）
    outputMultiply.addCircularConnection(hiddenStatePrev, "t+1");
    
    // 2. C_t 循环连接到 C_{t-1}（用于下一时刻）
    // 从记忆更新层（cellAdd）循环连接到记忆状态占位层（cellStatePrev）
    cellAdd.addCircularConnection(cellStatePrev, "t+1");
    
    console.log("LSTM内部结构测试模板已创建，Multiply层和循环连接已集成");
}

/**
 * LSTM结构模板 - 用于训练AirPassengers数据集
 * 展示LSTM内部结构的完整组件（遗忘门、输入门、输出门等），同时确保可以成功训练AirPassengers数据集
 * 前端显示名称：LSTM结构模版
 */
export function lstmStructureTemplate(svgData: IDraggableData): void {
    resetWorkspace(svgData);

    const canvasBoundingBox = getSvgOriginalBoundingBox(document.getElementById("svg") as any as SVGSVGElement);
    const width = canvasBoundingBox.width;
    const height = canvasBoundingBox.height;

    // 获取当前数据集类型
    const currentDataset = svgData.input.getParams().dataset;
    const isTimeSeries = currentDataset === "airpassengers";

    // ========== 布局定义 ==========
    // 左侧：输入区域
    const inputPos = new Point(width * 0.1, height * 0.5);
    const hiddenStatePrevPos = new Point(width * 0.1, height * 0.3);  // H_{t-1} 占位层（仅用于可视化）
    const cellStatePrevPos = new Point(width * 0.1, height * 0.7);     // C_{t-1} 占位层（仅用于可视化）
    
    // 对于时序数据，不需要在输入处使用Flatten层
    // 因为数据已经是3D格式[batch, 12, 1]，Input层定义的形状是[12, 1]（不含batch）
    // 后续的Dense层可以处理3D输入（会自动在最后一个维度上应用）
    
    // 中间：LSTM内部结构
    const concatInputPos = new Point(width * 0.25, height * 0.5);      // 合并输入 [X_t, H_{t-1}]
    
    // 门控层（垂直排列）
    const forgetGatePos = new Point(width * 0.4, height * 0.25);       // 遗忘门
    const inputGatePos = new Point(width * 0.4, height * 0.45);       // 输入门
    const outputGatePos = new Point(width * 0.4, height * 0.65);      // 输出门
    const candidatePos = new Point(width * 0.4, height * 0.85);        // 候选记忆
    
    // 乘法操作（使用Multiply层）
    const forgetMultPos = new Point(width * 0.55, height * 0.5);      // F_t ⊙ C_{t-1}
    const inputMultPos = new Point(width * 0.55, height * 0.7);         // I_t ⊙ C̃_t
    
    // 加法操作
    const cellAddPos = new Point(width * 0.65, height * 0.6);          // C_t = F_t⊙C_{t-1} + I_t⊙C̃_t
    
    // Tanh激活（用于C_t）
    const cellTanhPos = new Point(width * 0.75, height * 0.6);          // tanh(C_t)
    
    // 输出门乘法
    const outputMultPos = new Point(width * 0.8, height * 0.5);        // O_t ⊙ tanh(C_t)
    
    // Flatten层（仅时序数据需要，确保维度正确）
    // 必须在创建时就初始化，以便后续可以正确连接
    let outputFlatten: Layer | null = null;
    const outputFlattenPos = new Point(width * 0.85, height * 0.5);
    if (isTimeSeries) {
        outputFlatten = new Flatten(outputFlattenPos);
        console.log("为时序数据创建了Flatten层");
    }
    
    // 右侧：输出
    const denseOutputPos = new Point(width * 0.9, height * 0.5);
    const outputPos = new Point(width - 50, height * 0.5);

    // ========== 创建层 ==========
    
    // 1. 输入层（当前输入 X_t）
    svgData.input.setPosition(inputPos);
    
    // 2. 注意：对于时序数据，不需要在输入处使用Flatten层
    // 数据格式是 [batch, 12, 1]（3D），Input层定义的形状是 [12, 1]（2D，不含batch）
    // 后续的Dense层可以处理3D输入，会自动在最后一个维度上应用
    
    // 3. 前一时刻的隐藏状态和记忆状态（占位层，仅用于可视化，不参与训练）
    const hiddenStatePrev = new Dense(hiddenStatePrevPos);
    hiddenStatePrev.parameterDefaults.units = 64;
    hiddenStatePrev.layerType = "HiddenStatePrev";  // 标记为可视化层，不参与训练
    
    const cellStatePrev = new Dense(cellStatePrevPos);
    cellStatePrev.parameterDefaults.units = 64;
    cellStatePrev.layerType = "CellStatePrev";  // 标记为可视化层，不参与训练
    
    // 4. 合并输入和隐藏状态
    const concatInput = new Concatenate(concatInputPos);
    
    // 5. 遗忘门：F_t = σ(W_f · [X_t, H_{t-1}] + b_f)
    const forgetGate = new Dense(forgetGatePos);
    forgetGate.parameterDefaults.units = 64;
    const forgetSigmoid = new Sigmoid(forgetGatePos);
    forgetGate.addActivation(forgetSigmoid);
    
    // 6. 输入门：I_t = σ(W_i · [X_t, H_{t-1}] + b_i)
    const inputGate = new Dense(inputGatePos);
    inputGate.parameterDefaults.units = 64;
    const inputSigmoid = new Sigmoid(inputGatePos);
    inputGate.addActivation(inputSigmoid);
    
    // 7. 输出门：O_t = σ(W_o · [X_t, H_{t-1}] + b_o)
    const outputGate = new Dense(outputGatePos);
    outputGate.parameterDefaults.units = 64;
    const outputSigmoid = new Sigmoid(outputGatePos);
    outputGate.addActivation(outputSigmoid);
    
    // 8. 候选记忆：C̃_t = tanh(W_c · [X_t, H_{t-1}] + b_c)
    const candidateGate = new Dense(candidatePos);
    candidateGate.parameterDefaults.units = 64;
    const candidateTanh = new Tanh(candidatePos);
    candidateGate.addActivation(candidateTanh);
    
    // 9. Multiply层：遗忘门操作 F_t ⊙ C_{t-1}
    const forgetMultiply = new Multiply(forgetMultPos);
    
    // 10. Multiply层：输入门操作 I_t ⊙ C̃_t
    const inputMultiply = new Multiply(inputMultPos);
    
    // 11. Add层：记忆更新 C_t = F_t ⊙ C_{t-1} + I_t ⊙ C̃_t
    const cellAdd = new Add(cellAddPos);
    
    // 12. Tanh激活：tanh(C_t) - 直接在cellAdd上应用，不需要额外的Dense层
    const cellTanhActivation = new Tanh(cellTanhPos);
    cellAdd.addActivation(cellTanhActivation);
    
    // 13. Multiply层：输出门操作 O_t ⊙ tanh(C_t)
    const outputMultiply = new Multiply(outputMultPos);
    
    // 14. Flatten层已在上面创建（仅时序数据需要，将可能的3D输出展平为2D）
    
    // 15. 输出层
    const denseOutput = new Dense(denseOutputPos);
    if (isTimeSeries) {
        // 时序预测任务：输出1个值（回归任务）
        denseOutput.parameterDefaults.units = 1;
    } else {
        // 分类任务：输出10个类别
        denseOutput.parameterDefaults.units = 10;
    }
    
    // ========== 连接关系（训练路径）==========
    
    // 训练路径：Input -> 内部结构层 -> Output
    // 注意：占位层（hiddenStatePrev, cellStatePrev）不在训练路径上
    
    // 对于时序数据和非时序数据，都直接从Input连接到concatInput
    // 后续的Dense层可以处理3D输入
    svgData.input.addChild(concatInput);
    
    // 注意：占位层不连接到concatInput，因为它们不在训练路径上
    // 为了展示内部结构，我们需要一个输入源来替代H_{t-1}
    // 这里我们使用一个Dense层来处理输入，然后连接到concatInput
    // 但实际上，对于训练，我们只需要X_t，H_{t-1}应该来自上一时刻的输出
    // 为了简化，我们让concatInput只接收X_t（通过一个Dense层处理）
    // 但这样就不是真正的LSTM内部结构了
    
    // 实际上，对于展示LSTM内部结构，我们需要：
    // 1. X_t 从Input来
    // 2. H_{t-1} 应该来自上一时刻的outputMultiply输出
    // 3. 但为了训练，我们需要让整个结构能够工作
    
    // 解决方案：让concatInput接收两个输入：
    // - 一个来自Input（经过处理）
    // - 一个来自占位层（但占位层需要初始化值）
    
    // 为了能够训练，我们让concatInput只接收来自Input的数据
    // 占位层仅用于可视化循环连接
    
    // 所有门控层都从合并输入接收数据
    // 但concatInput需要两个输入，所以我们创建一个临时的输入处理层
    const inputDense = new Dense(new Point(width * 0.2, height * 0.5));
    inputDense.parameterDefaults.units = 12;  // 对于时序数据，输入是12
    
    // 直接从Input连接到inputDense（Dense层可以处理3D输入）
    svgData.input.addChild(inputDense);
    
    // 现在concatInput接收两个输入：inputDense和hiddenStatePrev
    // 但hiddenStatePrev不在训练路径上，所以我们需要另一种方式
    // 实际上，对于训练，我们可以让concatInput只接收inputDense的输出
    // 然后通过一个Dense层来模拟[X_t, H_{t-1}]的合并
    
    // 更好的方案：让inputDense的输出直接连接到所有门控层
    // 这样就不需要concatInput了，但这样就失去了展示合并操作的意义
    
    // 让我们采用一个折中方案：
    // 1. inputDense处理输入X_t
    // 2. 创建一个初始化的hiddenStatePrev（通过一个Dense层，units=64）
    // 3. concatInput合并这两个输入
    // 4. 但hiddenStatePrev不在训练路径上，所以我们需要让它从inputDense接收数据（作为初始化）
    
    // 实际上，对于第一次前向传播，H_{t-1}应该是零或随机初始化
    // 我们可以让hiddenStatePrev从inputDense接收数据，但units不同
    
    // 简化方案：让hiddenStatePrev和cellStatePrev直接从Input接收初始值
    // 这样可以避免Dense层之间的连接（Input -> Dense 是可以的）
    // 在真正的LSTM中，H_{t-1}和C_{t-1}应该来自上一时刻的输出（通过循环连接）
    // 但在第一次迭代时，它们需要初始值
    svgData.input.addChild(hiddenStatePrev);  // Input -> Dense (不是Dense -> Dense)
    svgData.input.addChild(cellStatePrev);    // Input -> Dense (不是Dense -> Dense)
    
    // concatInput接收两个输入：inputDense（代表X_t）和hiddenStatePrev（代表H_{t-1}）
    inputDense.addChild(concatInput);
    hiddenStatePrev.addChild(concatInput);
    
    // 所有门控层都从合并输入接收数据
    concatInput.addChild(forgetGate);
    concatInput.addChild(inputGate);
    concatInput.addChild(outputGate);
    concatInput.addChild(candidateGate);
    
    // 遗忘门操作：F_t ⊙ C_{t-1}
    forgetGate.addChild(forgetMultiply);
    cellStatePrev.addChild(forgetMultiply);  // C_{t-1}从Input获取初始值
    
    // 输入门操作：I_t ⊙ C̃_t
    inputGate.addChild(inputMultiply);
    candidateGate.addChild(inputMultiply);
    
    // 记忆更新：C_t = F_t⊙C_{t-1} + I_t⊙C̃_t
    forgetMultiply.addChild(cellAdd);
    inputMultiply.addChild(cellAdd);
    
    // 隐藏状态计算：H_t = O_t ⊙ tanh(C_t)
    // cellAdd输出C_t，通过Tanh激活函数得到tanh(C_t)
    // 注意：Tanh激活函数已经在cellAdd上添加，所以cellAdd的输出就是tanh(C_t)
    outputGate.addChild(outputMultiply);
    cellAdd.addChild(outputMultiply);  // tanh(C_t) 和 O_t 相乘
    
    // 输出：对于时序数据，需要先Flatten确保维度正确
    if (isTimeSeries && outputFlatten) {
        // 确保Flatten层被正确连接
        outputMultiply.addChild(outputFlatten);
        outputFlatten.addChild(denseOutput);
        console.log("Flatten层已连接: outputMultiply -> outputFlatten -> denseOutput");
    } else {
        outputMultiply.addChild(denseOutput);
        console.log("非时序数据: outputMultiply -> denseOutput (无Flatten层)");
    }
    denseOutput.addChild(svgData.output);
    svgData.output.setPosition(outputPos);
    
    // ========== 存储所有层 ==========
    svgData.draggable.push(inputDense);
    // 注意：hiddenStateInit和cellStateInit已被移除，避免Dense层直接连接
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
    if (outputFlatten) {
        svgData.draggable.push(outputFlatten);
    }
    svgData.draggable.push(cellAdd);
    svgData.draggable.push(cellTanhActivation);  // Tanh激活函数直接附加到cellAdd上
    svgData.draggable.push(denseOutput);
    
    // ========== 添加循环连接可视化 ==========
    
    // 1. H_t 循环连接到 H_{t-1}（用于下一时刻）
    // 从输出层（outputMultiply）循环连接到隐藏状态占位层（hiddenStatePrev）
    outputMultiply.addCircularConnection(hiddenStatePrev, "t+1");
    
    // 2. C_t 循环连接到 C_{t-1}（用于下一时刻）
    // 从记忆更新层（cellAdd）循环连接到记忆状态占位层（cellStatePrev）
    cellAdd.addCircularConnection(cellStatePrev, "t+1");
    
    console.log("LSTM结构模板已创建，展示完整的LSTM内部结构");
    console.log("训练流程: Input -> LSTM内部结构 -> Flatten -> Dense -> Output");
    if (isTimeSeries) {
        console.log("数据集: AirPassengers (时序数据)");
        console.log("输入形状: [batch, 12, 1] (3D，Dense层会自动处理)");
        console.log("输出: 1个值 (回归任务)");
    }
}