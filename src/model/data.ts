// Adapted from https://github.com/tensorflow/tfjs-examples/blob/master/mnist/data.js

import * as tf from "@tensorflow/tfjs";
import { Rank, Tensor } from "@tensorflow/tfjs";
import { Cifar10 } from "tfjs-cifar10-web";
import { model } from "./params_object";

const NUM_DATASET_ELEMENTS = 65000;

export const NUM_TRAIN_ELEMENTS = 55000;
// const NUM_TEST_ELEMENTS = NUM_DATASET_ELEMENTS - NUM_TRAIN_ELEMENTS;

const MNIST_IMAGES_SPRITE_PATH =
    "https://storage.googleapis.com/learnjs-data/model-builder/mnist_images.png";
const MNIST_LABELS_PATH =
    "https://storage.googleapis.com/learnjs-data/model-builder/mnist_labels_uint8";

/**
 * A class that serves as a schema for loading image data.
 */
export abstract class ImageData {
    public readonly IMAGE_HEIGHT: number;
    public readonly IMAGE_WIDTH: number;
    public readonly IMAGE_CHANNELS: number;
    public readonly IMAGE_SIZE: number;
    public readonly NUM_CLASSES: number;
    public pythonName: string;

    public dataLoaded: boolean = false;

    public readonly classStrings: string[] = null;

    protected trainImages: Tensor<Rank.R4>;
    protected testImages: Tensor<Rank>;
    protected trainLabels: Tensor<Rank>;
    protected testLabels: Tensor<Rank>;
    protected datasetName: string;

    public abstract load(): Promise<void>;

    /**
     * Get all training data as a data tensor and a labels tensor.
     *
     * @returns
     *   xs: The data tensor, of shape `[numTrainExamples, IMAGE_HEIGHT, IMAGE_WIDTH, IMAGE_CHANNELS]`.
     *   labels: The one-hot encoded labels tensor, of shape `[numTrainExamples, NUM_CLASSES]`.
     */
    public getTrainData(numExamples: number = 15000): {xs: Tensor<tf.Rank.R4>, labels: Tensor<tf.Rank.R2>} {
        let xs = tf.reshape<tf.Rank.R4>(this.trainImages, [this.trainImages.size / this.IMAGE_SIZE,
                                                           this.IMAGE_HEIGHT,
                                                           this.IMAGE_WIDTH,
                                                           this.IMAGE_CHANNELS]);
        let labels = tf.reshape<tf.Rank.R2>(this.trainLabels,
                                            [this.trainLabels.size / this.NUM_CLASSES, this.NUM_CLASSES]);
        if (numExamples != null) {
            xs = xs.slice([0, 0, 0, 0], [numExamples, this.IMAGE_HEIGHT, this.IMAGE_WIDTH, this.IMAGE_CHANNELS]);
            labels = labels.slice([0, 0], [numExamples, this.NUM_CLASSES]);
        }
        return {xs, labels};
    }

    /**
     * Get all test data as a data tensor a a labels tensor.
     *
     * @param {number} numExamples Optional number of examples to get. If not provided,
     *   all test examples will be returned.
     * @returns
     *   xs: The data tensor, of shape `[numTrainExamples, IMAGE_HEIGHT, IMAGE_WIDTH, IMAGE_CHANNELS]`.
     *   labels: The one-hot encoded labels tensor, of shape `[numTestExamples, NUM_CLASSES]`.
     */
    public getTestData(numExamples: number = 1500): {xs: Tensor<tf.Rank.R4>, labels: Tensor<tf.Rank.R2>} {
        let xs = tf.reshape<tf.Rank.R4>(this.testImages, [this.testImages.size / this.IMAGE_SIZE,
                                                          this.IMAGE_HEIGHT,
                                                          this.IMAGE_WIDTH,
                                                          this.IMAGE_CHANNELS]);
        let labels = tf.reshape<tf.Rank.R2>(this.testLabels,
                                            [this.testLabels.size / this.NUM_CLASSES, this.NUM_CLASSES]);

        if (numExamples != null) {
            xs = xs.slice([0, 0, 0, 0], [numExamples, this.IMAGE_HEIGHT, this.IMAGE_WIDTH, this.IMAGE_CHANNELS]);
            labels = labels.slice([0, 0], [numExamples, this.NUM_CLASSES]);
        }
        return {xs, labels};
    }

    /**
     * Returns test examples with the desired label.
     *
     * @param {number} numExamples number of examples to get.
     * @returns xs: The data tensor, of shape `[numTrainExamples, IMAGE_HEIGHT, IMAGE_WIDTH, IMAGE_CHANNELS]`.
     *          labels: The one-hot encoded labels tensor, of shape `[numTestExamples, NUM_CLASSES]`.
     */
    public async getTestDataWithLabel(numExamples: number,
                                      label: string): Promise<{xs: Tensor<tf.Rank.R4>, labels: Tensor<tf.Rank.R2>}> {
        if (label === "all") {
            return this.getTestData(numExamples);
        }

        let {xs, labels} = this.getTestData();

        // select only the numbers with the given label
        const classLabels = labels.argMax(1).arraySync() as number[];
        const mask = tf.equal(classLabels, parseInt(label, 10));
        xs = await tf.booleanMaskAsync(xs, mask) as Tensor<tf.Rank.R4>;
        labels = await tf.booleanMaskAsync(labels, mask) as Tensor<tf.Rank.R2>;
        xs = xs.slice([0, 0, 0, 0], [numExamples, xs.shape[1], xs.shape[2], xs.shape[3]]) as Tensor<tf.Rank.R4>;
        labels = labels.slice([0, 0], [numExamples, labels.shape[1]]) as Tensor<tf.Rank.R2>;
        return {xs, labels};
    }

    protected toggleLoadingOverlay(): void {
        if (document.getElementById("loadingDataTab").style.display === "none") {
            document.getElementById("datasetLoadingName").innerText = this.datasetName;
            document.getElementById("loadingDataTab").style.display = "block";
        } else {
            document.getElementById("loadingDataTab").style.display = "none";
        }
    }
}

/**
 * A class that fetches the sprited CIFAR dataset and provide data as
 * Tensors.
 */
export class Cifar10Data extends ImageData {

    public static get Instance(): ImageData {
        return this.instance || (this.instance = new this());
    }

    private static instance: Cifar10Data;
    public readonly IMAGE_HEIGHT: number = 32;
    public readonly IMAGE_WIDTH: number = 32;
    public readonly IMAGE_CHANNELS: number = 3;
    public readonly IMAGE_SIZE: number;
    public readonly NUM_CLASSES: number = 10;

    public datasetName: string = "CIFAR-10";
    public pythonName: string = "cifar10";

    constructor() {
        super();
        this.IMAGE_SIZE = this.IMAGE_HEIGHT * this.IMAGE_WIDTH * this.IMAGE_CHANNELS;
    }

    public readonly classStrings: string[] =
        ["Airplane", "Automobile", "Bird", "Cat", "Deer", "Dog", "Frog", "Horse", "Ship", "Truck"];

    public async load(): Promise<void> {
        if (this.dataLoaded) {
            return;
        }

        this.toggleLoadingOverlay();

        try {
            // Ensure TensorFlow.js backend is ready
            await tf.ready();
            
            const data = new Cifar10();
            await data.load();
            
            const {xs: trainX, ys: trainY} = data.nextTrainBatch(15000);
            const {xs: testX, ys: testY} = data.nextTestBatch(1500);
            
            // Ensure tensors are properly created and convert them to the correct format
            if (trainX && trainY && testX && testY) {
                // Convert to proper tensor format using tf.tensor API
                // CIFAR-10 train data: 15000 samples of 32x32x3 images
                const trainXData = await trainX.data();
                this.trainImages = tf.tensor4d(trainXData, [15000, 32, 32, 3]);
                
                // CIFAR-10 train labels: 15000 samples with 10 classes
                const trainYData = await trainY.data();
                this.trainLabels = tf.tensor2d(trainYData, [15000, 10]);
                
                // CIFAR-10 test data: 1500 samples of 32x32x3 images
                const testXData = await testX.data();
                this.testImages = tf.tensor4d(testXData, [1500, 32, 32, 3]);
                
                // CIFAR-10 test labels: 1500 samples with 10 classes
                const testYData = await testY.data();
                this.testLabels = tf.tensor2d(testYData, [1500, 10]);
                
                this.dataLoaded = true;
            } else {
                throw new Error("Failed to load CIFAR-10 data: tensors are undefined");
            }
        } catch (error) {
            console.error("Error loading CIFAR-10 dataset:", error);
            throw new Error(`Failed to load CIFAR-10 dataset: ${error.message}`);
        } finally {
            document.getElementById("loadingDataTab").style.display = "none";
        }
    }

}

/**
 * A class that fetches the sprited MNIST dataset and provide data as
 * Tensors.
 */
export class MnistData extends ImageData {

    public static get Instance(): ImageData {
        return this.instance || (this.instance = new this());
    }

    private static instance: MnistData;
    public IMAGE_HEIGHT: number = 28;
    public IMAGE_WIDTH: number = 28;
    public IMAGE_CHANNELS: number = 1;
    public IMAGE_SIZE: number = this.IMAGE_HEIGHT * this.IMAGE_WIDTH * this.IMAGE_CHANNELS;
    public NUM_CLASSES: number = 10;

    public datasetName: string = "MNIST";
    public pythonName: string = "mnist";

    public async load(): Promise<void> {
        // Make a request for the MNIST sprited image.
        if (this.dataLoaded) {
            return;
        }

        this.toggleLoadingOverlay();

        const img = new Image();
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const imgRequest = new Promise<Float32Array>((resolve, _) => {
            img.crossOrigin = "";
            img.onload = () => {
                img.width = img.naturalWidth;
                img.height = img.naturalHeight;

                const datasetBytesBuffer = new ArrayBuffer(NUM_DATASET_ELEMENTS * this.IMAGE_SIZE * 4);

                const chunkSize = 5000;
                canvas.width = img.width;
                canvas.height = chunkSize;

                for (let i = 0; i < NUM_DATASET_ELEMENTS / chunkSize; i++) {
                    const datasetBytesView = new Float32Array(
                        datasetBytesBuffer, i * this.IMAGE_SIZE * chunkSize * 4,
                        this.IMAGE_SIZE * chunkSize);
                    ctx.drawImage(
                        img, 0, i * chunkSize, img.width, chunkSize, 0, 0, img.width,
                        chunkSize);

                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                    for (let j = 0; j < imageData.data.length / 4; j++) {
                        // All channels hold an equal value since the image is grayscale, so
                        // just read the red channel.
                        datasetBytesView[j] = imageData.data[j * 4] / 255;
                    }
                }
                const dataImages = new Float32Array(datasetBytesBuffer);

                resolve(dataImages);
            };
            img.src = MNIST_IMAGES_SPRITE_PATH;
        });

        const labelsRequest = fetch(MNIST_LABELS_PATH);
        const [datasetImages, labelsResponse] = await Promise.all([imgRequest, labelsRequest]);

        const datasetLabels = new Uint8Array(await labelsResponse.arrayBuffer());

        // Slice the the images and labels into train and test sets.
        const trainImages = datasetImages.slice(0, this.IMAGE_SIZE * NUM_TRAIN_ELEMENTS);
        this.trainImages = tf.tensor4d(trainImages, [trainImages.length / this.IMAGE_SIZE,
                                                     this.IMAGE_HEIGHT, this.IMAGE_WIDTH,
                                                     this.IMAGE_CHANNELS]);
        const testImages = datasetImages.slice(this.IMAGE_SIZE * NUM_TRAIN_ELEMENTS);
        this.testImages = tf.tensor4d(testImages, [testImages.length / this.IMAGE_SIZE,
                                                   this.IMAGE_HEIGHT, this.IMAGE_WIDTH,
                                                   this.IMAGE_CHANNELS]);
        const trainLabels = datasetLabels.slice(0, this.NUM_CLASSES * NUM_TRAIN_ELEMENTS);
        this.trainLabels = tf.tensor2d(trainLabels, [trainImages.length / this.IMAGE_SIZE, this.NUM_CLASSES]);
        const testLabels =
            datasetLabels.slice(this.NUM_CLASSES * NUM_TRAIN_ELEMENTS);
        this.testLabels = tf.tensor2d(testLabels, [testImages.length / this.IMAGE_SIZE, this.NUM_CLASSES]);

        this.dataLoaded = true;

        document.getElementById("loadingDataTab").style.display = "none";
    }

}

/**
 * AirPassengers时序数据集
 * 1949年1月到1960年12月，共144个月的国际航空乘客数量
 * 用于LSTM时序预测任务
 */
export class AirPassengersData {
    public static get Instance(): AirPassengersData {
        return this.instance || (this.instance = new this());
    }

    private static instance: AirPassengersData;
    
    // 为了兼容现有代码，提供这些属性
    // 对于LSTM，输入形状应该是[timeSteps, features]，即[12, 1]
    public readonly IMAGE_HEIGHT: number = 12;  // 时间步数（滑动窗口大小）
    public readonly IMAGE_WIDTH: number = 1;   // 特征数（单变量时序）
    public readonly IMAGE_CHANNELS: number = 1; // 保持兼容性
    public readonly IMAGE_SIZE: number = 12;
    public readonly NUM_CLASSES: number = 1;     // 回归任务，输出1个值
    public pythonName: string = "airpassengers";
    public datasetName: string = "AirPassengers";
    public dataLoaded: boolean = false;
    public readonly classStrings: string[] = null;

    // AirPassengers原始数据（1949-1960，共144个月）
    // 数据来源：R语言内置的AirPassengers数据集
    // 格式：每月乘客数量（单位：千人），从1949年1月到1960年12月
    private readonly rawData: number[] = [
        112, 118, 132, 129, 121, 135, 148, 148, 136, 119, 104, 118,  // 1949年1-12月
        115, 126, 141, 135, 125, 149, 170, 170, 158, 133, 114, 140,  // 1950年1-12月
        145, 150, 178, 163, 172, 178, 199, 199, 184, 162, 146, 166,  // 1951年1-12月
        171, 180, 193, 181, 183, 218, 230, 242, 209, 191, 172, 194,  // 1952年1-12月
        196, 196, 236, 235, 229, 243, 264, 272, 237, 211, 180, 201,  // 1953年1-12月
        204, 188, 235, 227, 234, 264, 302, 293, 259, 229, 203, 229,  // 1954年1-12月
        242, 233, 267, 269, 270, 315, 364, 347, 312, 274, 237, 278,  // 1955年1-12月
        284, 277, 317, 313, 318, 374, 413, 405, 355, 306, 271, 306,  // 1956年1-12月
        315, 301, 356, 348, 355, 422, 465, 467, 404, 347, 305, 336,  // 1957年1-12月
        340, 318, 362, 348, 363, 435, 491, 505, 404, 359, 310, 337,  // 1958年1-12月
        360, 342, 406, 396, 420, 472, 548, 559, 463, 407, 362, 405,  // 1959年1-12月
        417, 391, 419, 461, 472, 535, 622, 606, 508, 461, 390, 432   // 1960年1-12月
    ];

    private trainData: Tensor<Rank.R3> | null = null;  // [samples, timeSteps, features]
    private testData: Tensor<Rank.R3> | null = null;
    private trainLabels: Tensor<Rank.R2> | null = null; // [samples, 1] 回归任务
    private testLabels: Tensor<Rank.R2> | null = null;
    private minValue: number = 0;  // 归一化参数，在load()中基于全量数据计算
    private maxValue: number = 0;  // 归一化参数，在load()中基于全量数据计算
    private timeSteps: number = 12; // 使用12个月预测下1个月

    constructor() {
        // minValue和maxValue将在load()方法中基于全量数据计算
        // 这样可以确保归一化参数基于完整的训练+测试集，避免数据泄露
    }

    /**
     * 归一化数据到[0, 1]范围
     * 注意：此方法依赖minValue和maxValue，必须在load()方法中先计算
     */
    private normalize(value: number): number {
        if (this.maxValue === this.minValue) {
            // 如果所有值相同，返回0（避免除以0）
            return 0;
        }
        return (value - this.minValue) / (this.maxValue - this.minValue);
    }
    
    /**
     * 反归一化：将归一化的值还原为原始值
     * 注意：此方法依赖minValue和maxValue，必须在load()方法中先计算
     */
    public denormalize(value: number): number {
        if (!this.dataLoaded) {
            console.warn("警告：数据尚未加载，minValue和maxValue可能未初始化。请先调用load()方法。");
        }
        if (this.maxValue === this.minValue) {
            // 如果所有值相同，返回minValue
            return this.minValue;
        }
        return value * (this.maxValue - this.minValue) + this.minValue;
    }
    
    /**
     * 获取原始数据（用于可视化）
     */
    public getRawData(): number[] {
        return [...this.rawData];
    }
    
    /**
     * 获取测试集的原始索引范围（用于时间轴）
     * 注意：现在基于序列划分，测试集的第一个序列对应的原始数据索引需要重新计算
     */
    public getTestDataTimeRange(): {start: number, end: number} {
        // 计算全量序列数
        const totalSequences = this.rawData.length - this.timeSteps; // 144-12=132
        // 计算序列划分点（前80%训练）
        const sequenceSplitIndex = Math.floor(totalSequences * 0.8); // 132*0.8≈105
        // 测试集的第一个序列对应的原始数据索引
        // 序列索引sequenceSplitIndex对应的原始数据索引是sequenceSplitIndex + timeSteps（因为序列从索引0开始，对应原始数据索引timeSteps）
        const startIndex = sequenceSplitIndex + this.timeSteps;
        return {
            start: startIndex, // 测试集的第一个目标值对应的原始数据索引
            end: this.rawData.length - 1 // 最后一个数据点
        };
    }


    /**
     * 创建滑动窗口数据集
     * 使用前timeSteps个月预测下1个月
     */
    private createSequences(data: number[], timeSteps: number): {sequences: number[][], targets: number[]} {
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

    public async load(): Promise<void> {
        if (this.dataLoaded) {
            return;
        }

        // 如果之前有加载的数据，先释放旧的Tensor
        if (this.trainData || this.testData || this.trainLabels || this.testLabels) {
            this.dispose();
        }

        this.toggleLoadingOverlay();

        try {
            await tf.ready();

            // 重要：计算全量数据的min/max（训练+测试集，时序预测需全局归一化）
            // 必须在划分数据之前计算，确保归一化参数基于完整数据集，避免数据泄露
            this.minValue = Math.min(...this.rawData);
            this.maxValue = Math.max(...this.rawData);
            
            console.log(`AirPassengers数据归一化参数: min=${this.minValue}, max=${this.maxValue} (基于全量${this.rawData.length}个数据点)`);

            // 第一步：创建全量序列（基于完整rawData）
            // 这样可以确保所有序列都使用相同的归一化参数，避免数据泄露
            const {sequences: allSequences, targets: allTargets} = this.createSequences(this.rawData, this.timeSteps);
            // 全量序列数：144-12=132个
            
            console.log(`创建了${allSequences.length}个序列（基于全量${this.rawData.length}个数据点）`);

            // 第二步：划分训练/测试序列（时序划分，前80%训练）
            // 注意：对于时序数据，必须严格按照时间顺序划分，不能随机划分
            const splitIndex = Math.floor(allSequences.length * 0.8); // 132*0.8≈105
            const trainSequences = allSequences.slice(0, splitIndex);
            const trainTargets = allTargets.slice(0, splitIndex);
            const testSequences = allSequences.slice(splitIndex);
            const testTargets = allTargets.slice(splitIndex);
            
            console.log(`序列划分: 训练集${trainSequences.length}个序列, 测试集${testSequences.length}个序列`);

            // 转换为Tensor
            // 训练数据: [samples, timeSteps, features]
            // 需要将每个序列转换为[samples, timeSteps, 1]格式
            const trainDataArray: number[][][] = trainSequences.map(seq => seq.map(val => [val]));
            this.trainData = tf.tensor3d(trainDataArray, [trainSequences.length, this.timeSteps, 1]);
            // 训练标签: [samples, 1]
            this.trainLabels = tf.tensor2d(trainTargets, [trainTargets.length, 1]);

            // 测试数据
            const testDataArray: number[][][] = testSequences.map(seq => seq.map(val => [val]));
            this.testData = tf.tensor3d(testDataArray, [testSequences.length, this.timeSteps, 1]);
            // 测试标签
            this.testLabels = tf.tensor2d(testTargets, [testTargets.length, 1]);

            this.dataLoaded = true;
            console.log(`AirPassengers数据加载完成: 训练样本${trainSequences.length}个, 测试样本${testSequences.length}个`);
        } catch (error) {
            console.error("加载AirPassengers数据集错误:", error);
            throw new Error(`加载AirPassengers数据集失败: ${error.message}`);
        } finally {
            document.getElementById("loadingDataTab").style.display = "none";
        }
    }

    /**
     * 释放Tensor资源，避免内存泄漏
     */
    public dispose(): void {
        if (this.trainData) {
            this.trainData.dispose();
            this.trainData = null;
        }
        if (this.testData) {
            this.testData.dispose();
            this.testData = null;
        }
        if (this.trainLabels) {
            this.trainLabels.dispose();
            this.trainLabels = null;
        }
        if (this.testLabels) {
            this.testLabels.dispose();
            this.testLabels = null;
        }
        this.dataLoaded = false;
    }

    /**
     * 获取训练数据
     * 返回格式: xs为3D张量[samples, timeSteps, features], labels为2D张量[samples, 1]
     */
    public getTrainData(numExamples?: number): {xs: Tensor<Rank.R3>, labels: Tensor<Rank.R2>} {
        if (!this.dataLoaded || !this.trainData || !this.trainLabels) {
            throw new Error("数据尚未加载，请先调用load()方法");
        }

        let xs = this.trainData;
        let labels = this.trainLabels;

        if (numExamples != null && numExamples < xs.shape[0]) {
            xs = xs.slice([0, 0, 0], [numExamples, this.timeSteps, 1]) as Tensor<Rank.R3>;
            labels = labels.slice([0, 0], [numExamples, 1]) as Tensor<Rank.R2>;
        }

        return {xs, labels};
    }

    /**
     * 获取测试数据
     */
    public getTestData(numExamples?: number): {xs: Tensor<Rank.R3>, labels: Tensor<Rank.R2>} {
        if (!this.dataLoaded || !this.testData || !this.testLabels) {
            throw new Error("数据尚未加载，请先调用load()方法");
        }

        let xs = this.testData;
        let labels = this.testLabels;

        if (numExamples != null && numExamples < xs.shape[0]) {
            xs = xs.slice([0, 0, 0], [numExamples, this.timeSteps, 1]) as Tensor<Rank.R3>;
            labels = labels.slice([0, 0], [numExamples, 1]) as Tensor<Rank.R2>;
        }

        return {xs, labels};
    }

    /**
     * 为了兼容ImageData接口，提供这个方法（时序数据不需要）
     */
    public async getTestDataWithLabel(numExamples: number, _label: string): Promise<{xs: Tensor<Rank.R4>, labels: Tensor<Rank.R2>}> {
        const {xs, labels} = this.getTestData(numExamples);
        // 转换为4D以兼容接口（虽然时序数据是3D）
        const xs4d = xs.reshape([xs.shape[0], 1, xs.shape[1], xs.shape[2]]) as Tensor<Rank.R4>;
        return {xs: xs4d, labels};
    }

    /**
     * 获取验证集数据（从训练集的末尾15%）
     * 验证集用于在训练过程中评估模型性能
     */
    public getValidationData(): {xs: Tensor<Rank.R3>, labels: Tensor<Rank.R2>} {
        if (!this.dataLoaded || !this.trainData || !this.trainLabels) {
            throw new Error("数据尚未加载，请先调用load()方法");
        }

        const totalTrainSamples = this.trainData.shape[0];
        const valSize = Math.floor(totalTrainSamples * 0.15);
        const trainSize = totalTrainSamples - valSize;

        // 验证集：从训练集的末尾取15%（保持时间顺序）
        const valXs = this.trainData.slice([trainSize, 0, 0], [valSize, this.timeSteps, 1]) as Tensor<Rank.R3>;
        const valLabels = this.trainLabels.slice([trainSize, 0], [valSize, 1]) as Tensor<Rank.R2>;

        return {xs: valXs, labels: valLabels};
    }

    /**
     * 获取验证集的时间范围（原始数据索引）
     */
    public getValidationDataTimeRange(): {start: number, end: number} {
        // 计算全量序列数
        const totalSequences = this.rawData.length - this.timeSteps;
        // 计算序列划分点（前80%训练）
        const sequenceSplitIndex = Math.floor(totalSequences * 0.8);
        // 训练集的序列数
        const trainSequences = sequenceSplitIndex;
        // 验证集从训练集的末尾15%开始
        const valStartSequenceIndex = Math.floor(trainSequences * 0.85);
        // 验证集的第一个序列对应的原始数据索引
        const startIndex = valStartSequenceIndex + this.timeSteps;
        // 验证集的最后一个序列对应的原始数据索引
        const endIndex = sequenceSplitIndex + this.timeSteps - 1;
        
        return {
            start: startIndex,
            end: endIndex
        };
    }

    /**
     * 获取当前时间步数
     */
    public getTimeSteps(): number {
        return this.timeSteps;
    }

    /**
     * 设置时间步数
     * 注意：如果数据已经加载，调用者需要手动调用load()来重新加载数据以应用新的时间步数
     */
    public setTimeSteps(timestep: number): void {
        if (timestep <= 0) {
            throw new Error("时间步数必须大于0");
        }
        if (timestep === this.timeSteps) {
            // 如果时间步数没有变化，不需要重新加载
            return;
        }
        this.timeSteps = timestep;
        // 如果数据已经加载，标记为未加载，需要调用者手动重新加载
        if (this.dataLoaded) {
            this.dataLoaded = false;
        }
    }

    protected toggleLoadingOverlay(): void {
        if (document.getElementById("loadingDataTab").style.display === "none") {
            document.getElementById("datasetLoadingName").innerText = this.datasetName;
            document.getElementById("loadingDataTab").style.display = "block";
        } else {
            document.getElementById("loadingDataTab").style.display = "none";
        }
    }
}

export let dataset: ImageData | AirPassengersData = MnistData.Instance;

export function changeDataset(newDataset: string): void {
    // 在切换数据集之前，释放旧数据集的Tensor资源（如果存在dispose方法）
    if (dataset && typeof (dataset as any).dispose === 'function') {
        (dataset as any).dispose();
    }
    
    switch (newDataset) {
        case "mnist": dataset = MnistData.Instance; break;
        case "cifar": dataset = Cifar10Data.Instance; break;
        case "airpassengers": dataset = AirPassengersData.Instance; break;
    }

    // Set the image visualizations divs with class name identifiers
    if (dataset instanceof ImageData) {
        Array.from(document.getElementById("classes").getElementsByClassName("option")).forEach((element, i) => {
            if (i !== 0) { // Skip the first since it represents 'Any' class
                element.innerHTML = (i - 1) + ( dataset.classStrings != null ? ` (${dataset.classStrings[i]})` : "");
            }
        });
    }
    
    // 根据数据集类型建议损失函数，但不强制覆盖用户的选择
    // 对于时序数据（AirPassengers），建议使用MSE或MAE；对于分类数据，建议使用交叉熵
    const isTimeSeries = newDataset === "airpassengers";
    
    // 只在用户当前没有选择合适损失函数时，才自动切换
    // 如果用户已经选择了合适的损失函数（如MAE），则保持用户的选择
    const currentLoss = model && model.params ? model.params.loss : "categoricalCrossentropy";
    const isRegressionLoss = currentLoss === "meanSquaredError" || currentLoss === "meanAbsoluteError";
    
    if (isTimeSeries && !isRegressionLoss) {
        // 对于时序数据，如果当前损失函数不适合回归任务，自动切换到MSE
        const targetLossId = "meanSquaredError";
        
        // 更新损失函数的UI选择
        const lossesContainer = document.getElementById("losses");
        if (lossesContainer) {
            // 移除所有选项的selected类
            Array.from(lossesContainer.getElementsByClassName("option")).forEach((option) => {
                option.classList.remove("selected");
            });
            
            // 找到目标损失函数选项并选中
            const targetLossOption = Array.from(lossesContainer.getElementsByClassName("option")).find(
                (option) => (option as HTMLElement).getAttribute("data-optionValue") === targetLossId
            );
            
            if (targetLossOption) {
                targetLossOption.classList.add("selected");
                // 同时更新model.params.loss
                if (model && model.params) {
                    model.params.loss = targetLossId;
                }
            }
        }
    } else if (!isTimeSeries && isRegressionLoss) {
        // 对于分类数据，如果当前损失函数不适合分类任务，自动切换到交叉熵
        const targetLossId = "categoricalCrossentropy";
        
        // 更新损失函数的UI选择
        const lossesContainer = document.getElementById("losses");
        if (lossesContainer) {
            // 移除所有选项的selected类
            Array.from(lossesContainer.getElementsByClassName("option")).forEach((option) => {
                option.classList.remove("selected");
            });
            
            // 找到目标损失函数选项并选中
            const targetLossOption = Array.from(lossesContainer.getElementsByClassName("option")).find(
                (option) => (option as HTMLElement).getAttribute("data-optionValue") === targetLossId
            );
            
            if (targetLossOption) {
                targetLossOption.classList.add("selected");
                // 同时更新model.params.loss
                if (model && model.params) {
                    model.params.loss = targetLossId;
                }
            }
        }
    }
    // 如果用户已经选择了合适的损失函数，不做任何更改，保持用户的选择
}
