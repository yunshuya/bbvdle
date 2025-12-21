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
import { Point } from "./shapes/shape";
import { Recurrent } from "./shapes/layers/rnn";
import { Reshape } from "./shapes/layers/reshape";
import { getSvgOriginalBoundingBox } from "./utils";
import { windowProperties } from "./window";
import { dataset } from "../model/data";

export function resetWorkspace(svgData: IDraggableData): void {
    // Deselect current element
    if (windowProperties.selectedElement != null) {
        windowProperties.selectedElement.unselect();
    }
    // Set input and output locations
    if (svgData.input != null) {
        svgData.input.setPosition(svgData.input.defaultLocation);
        svgData.input.wires.forEach((w) => w.delete());
    }
    if (svgData.output != null) {
        svgData.output.setPosition(svgData.output.defaultLocation);
    }

    // Remove all other layers
    for (const layer of svgData.draggable) {
        layer.delete();
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

    // 获取当前数据集类型，设置正确的输出单元数
    // 注意：defaultTemplate 主要用于图像分类任务（MNIST/CIFAR-10）
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