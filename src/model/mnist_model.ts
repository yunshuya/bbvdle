// Adapted from https://github.com/tensorflow/tfjs-examples/tree/master/mnist
// 图像分类任务训练模块
// 专门处理图像分类任务（如MNIST、CIFAR-10）

import * as tf from "@tensorflow/tfjs";
import {plotAccuracy,
        plotLoss,
        resetPlotValues,
        setupPlots,
        setupTestResults,
        showConfusionMatrix,
        showPredictions} from "./graphs";

import {dataset, AirPassengersData} from "./data";
import { model } from "./params_object";
import { displayError } from "../ui/error";
import { trainTimeSeries } from "./time_series_model";

export interface IBatchMetric {
    batch: number;
    loss: number | null;
    accuracy: number | null;
}

export interface IEpochMetric {
    epoch: number;
    valLoss: number | null;
    valAccuracy: number | null;
}

interface ITestMetric {
    loss: number;
    accuracy: number;
}

export interface ITrainingHistory {
    startedAt: string;
    finishedAt?: string;
    dataset: string;
    hyperparameters: {
        learningRate: number;
        batchSize: number;
        epochs: number;
        optimizer: string;
        loss: string;
    };
    batchMetrics: IBatchMetric[];
    epochMetrics: IEpochMetric[];
    testMetrics?: ITestMetric;
}

/**
 * Compile and train the given model.
 *
 * @param {*} model The model to
 */

export let stopTraining = false;
let trainingHistory: ITrainingHistory | null = null;

export function stopTrainingHandler() {
    stopTraining = true;
    console.log("Training stop triggered.");
}

export function resetTrainingFlag() {
    stopTraining = false;
    console.log("Training flag reset. Ready to start new training.");
}

export function getTrainingHistory(): ITrainingHistory | null {
    return trainingHistory;
}

/**
 * 更新训练指标标签为分类任务的标签
 */
function updateTrainingIndicatorLabels(): void {
    const accBox = document.getElementById("ti_acc");
    const lossBox = document.getElementById("ti_loss");
    const vaccBox = document.getElementById("ti_vacc");
    const vlossBox = document.getElementById("ti_vloss");
    
    if (!accBox || !lossBox || !vaccBox || !vlossBox) {
        console.warn("无法找到训练指标元素，跳过标签更新");
        return;
    }
    
    // 分类数据：显示准确率和损失率
    accBox.children[0].innerHTML = "准确率：";
    lossBox.children[0].innerHTML = "损失率：";
    vaccBox.children[0].innerHTML = "验证集准确率：";
    vlossBox.children[0].innerHTML = "验证集损失率：";
}

/**
 * 训练图像分类模型
 */
async function trainClassification(): Promise<void> {
    // Set up all of the plots
    resetPlotValues();
    setupPlots();
    setupTestResults();
    await dataset.load();
    
    // ==================== 0. 检查模型架构是否存在 ====================
    if (!model.architecture) {
        const errorMsg = "模型架构尚未构建！请确保网络结构已正确连接（从Input到Output）。";
        console.error(errorMsg);
        displayError(new Error(errorMsg));
        return;
    }
    
    trainingHistory = {
        startedAt: new Date().toISOString(),
        dataset: dataset.pythonName ?? dataset.constructor.name ?? "unknown",
        hyperparameters: {
            learningRate: model.params.learningRate,
            batchSize: model.params.batchSize,
            epochs: model.params.epochs,
            optimizer: model.params.optimizer,
            loss: model.params.loss,
        },
        batchMetrics: [],
        epochMetrics: [],
    };

    const onIteration = () => showPredictions();
    
    // ==================== 1. 优化器定义 ====================
    const optimizer = model.params.getOptimizer();
    
    // ==================== 2. 更新训练指标标签 ====================
    updateTrainingIndicatorLabels();
    
    // ==================== 3. 损失函数设置 ====================
    // 对于分类任务，使用用户选择的损失函数
    const loss = model.params.loss;
    
    // ==================== 4. 指标设置 ====================
    const metrics = ["accuracy"];

    // ==================== 5. 模型编译 ====================
    try {
        model.architecture.compile({
            loss,
            metrics,
            optimizer,
        });
        console.log("模型编译成功：loss=", loss, "optimizer=", model.params.optimizer, "learningRate=", model.params.learningRate);
    } catch (compileError) {
        const errorMsg = `模型编译失败: ${compileError.message}`;
        console.error(errorMsg, compileError);
        displayError(new Error(errorMsg));
        return;
    }
    
    // ==================== 6. 训练参数设置 ====================
    const batchSize = model.params.batchSize;
    const validationSplit = 0.15; // 对于分类数据，使用随机分割

    const trainEpochs = model.params.epochs;

    // We'll keep a buffer of loss and accuracy values over time.
    let trainBatchCount: number = 0;
    let prevTrainBatchCount: number = 0;
    let totalLoss: number = 0;
    let totalAccuracy: number = 0;
    const plotLossFrequency: number = 25;

    const trainData = dataset.getTrainData();
    const testData = dataset.getTestData();
    const totalNumBatches = Math.ceil(trainData.xs.shape[0] * (1 - validationSplit) / batchSize) * trainEpochs;

    // ==================== 7. 构建训练选项 ====================
    const fitOptions: any = {
        batchSize,
        epochs: trainEpochs,
        callbacks: {
            onBatchEnd: async (batch: number, logs: tf.Logs) => {

                if (stopTraining) {
                    console.log("Training stopped by user.");
                    model.architecture.stopTraining = true;
                    model.architecture.resetStates();
                    return;
                }

                trainBatchCount++;
                const accBox = document.getElementById("ti_acc");
                const lossBox = document.getElementById("ti_loss");
                const trainBox = document.getElementById("ti_training");
                accBox.children[1].innerHTML = String(Number((100 * logs.acc).toFixed(2)));
                lossBox.children[1].innerHTML = String(Number((logs.loss).toFixed(2)));
                trainBox.children[1].innerHTML = String((trainBatchCount / totalNumBatches * 100).toFixed(1) + "%");
                // For logging training in console.
                // console.log(
                //     `Training... (` +
                //     `${(trainBatchCount / totalNumBatches * 100).toFixed(1)}%` +
                //     ` complete). To stop training, refresh or close page.`);
                totalLoss += logs.loss;
                totalAccuracy += logs.acc;
                if (batch % plotLossFrequency === 0) {
                  // Compute the average loss for the last plotLossFrequency iterations
                  plotLoss(trainBatchCount, totalLoss / (trainBatchCount - prevTrainBatchCount), "train");
                  plotAccuracy(trainBatchCount, totalAccuracy / (trainBatchCount - prevTrainBatchCount), "train");
                  prevTrainBatchCount = trainBatchCount;
                  totalLoss = 0;
                  totalAccuracy = 0;
                }
                if (batch % 60 === 0) {
                  onIteration();
                }
                await tf.nextFrame();
            },
            onEpochEnd: async (_: number, logs: tf.Logs) => {

                if (stopTraining) {
                    console.log("Training stopped by user.");
                    model.architecture.stopTraining = true;
                    model.architecture.resetStates();
                    return;
                }

                const valAcc = logs.val_acc;
                const valLoss = logs.val_loss;
                const accBox = document.getElementById("ti_vacc");
                const lossBox = document.getElementById("ti_vloss");
                accBox.children[1].innerHTML = String(Number((100 * valAcc).toFixed(2)));
                lossBox.children[1].innerHTML = String(Number((valLoss).toFixed(2)));
                plotLoss(trainBatchCount, logs.val_loss, "validation");
                plotAccuracy(trainBatchCount, logs.val_acc, "validation");
                showConfusionMatrix();
                onIteration();
                await tf.nextFrame();
            },
        },
        validationSplit,
    };
    
    // ==================== 8. 开始训练 ====================
    await model.architecture.fit(trainData.xs, trainData.labels, fitOptions);

    const testResult = model.architecture.evaluate(testData.xs, testData.labels) as Array<tf.Tensor<tf.Rank.R0>>;
    
    // TensorFlow.js evaluate() 返回顺序: [loss, ...metrics]
    // 由于编译时 metrics = ["accuracy"]，所以:
    // testResult[0] = loss
    // testResult[1] = accuracy (0-1之间的值)
    const testLoss = testResult[0].dataSync()[0];
    const testAccuracy = testResult[1].dataSync()[0];
    
    // 调试：打印实际值以便诊断问题
    console.log("测试集评估结果:");
    console.log("Loss:", testLoss);
    console.log("Accuracy (原始值 0-1):", testAccuracy);
    console.log("Accuracy (百分比):", 100 * testAccuracy);
    
    const vaccBox = document.getElementById("ti_vacc");
    const vlossBox = document.getElementById("ti_vloss");
    
    // 确保 accuracy 是 0-1 之间的值，然后转换为百分比
    // 如果 testAccuracy 已经是百分比（0-100），则不需要再乘以 100
    // 但根据 TensorFlow.js 文档，accuracy 应该是 0-1 之间的值
    if (testAccuracy > 1.0) {
        // 如果已经是百分比形式，直接使用
        console.warn("警告: accuracy 值大于 1.0，可能是百分比形式，直接使用:", testAccuracy);
        vaccBox.children[1].innerHTML = String(Number(testAccuracy.toFixed(2)));
    } else {
        // 正常情况：accuracy 是 0-1 之间的值，转换为百分比
        vaccBox.children[1].innerHTML = String(Number((100 * testAccuracy).toFixed(2)));
    }
    vlossBox.children[1].innerHTML = String(Number(testLoss.toFixed(2)));
}

/**
 * 统一的训练入口函数
 * 根据数据集类型自动选择相应的训练函数
 */
export async function train(): Promise<void> {
    // 检测数据集类型
    const isTimeSeries = dataset instanceof AirPassengersData;
    
    // 初始化训练历史
    trainingHistory = {
        startedAt: new Date().toISOString(),
        dataset: dataset.pythonName ?? dataset.constructor.name ?? "unknown",
        hyperparameters: {
            learningRate: model.params.learningRate,
            batchSize: model.params.batchSize,
            epochs: model.params.epochs,
            optimizer: model.params.optimizer,
            loss: model.params.loss,
        },
        batchMetrics: [],
        epochMetrics: [],
    };
    
    if (isTimeSeries) {
        // 时序预测任务
        await trainTimeSeries(trainingHistory);
    } else {
        // 图像分类任务
        await trainClassification();
    }
}
