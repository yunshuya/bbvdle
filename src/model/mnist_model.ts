// Adapted from https://github.com/tensorflow/tfjs-examples/tree/master/mnist

import * as tf from "@tensorflow/tfjs";
import {plotAccuracy,
        plotLoss,
        resetPlotValues,
        setupPlots,
        setupTestResults,
        showConfusionMatrix,
        showPredictions,
        renderTimeSeriesPredictions} from "./graphs";

import {dataset, AirPassengersData} from "./data";
import { model } from "./params_object";

interface IBatchMetric {
    batch: number;
    loss: number | null;
    accuracy: number | null;
}

interface IEpochMetric {
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
 * 根据数据集类型和损失函数更新训练指标标签
 * 对于时序数据（回归任务），显示MSE和MAE
 * 对于分类数据，显示准确率和损失率
 */
function updateTrainingIndicatorLabels(isTimeSeries: boolean, lossFunction: string): void {
    const accBox = document.getElementById("ti_acc");
    const lossBox = document.getElementById("ti_loss");
    const vaccBox = document.getElementById("ti_vacc");
    const vlossBox = document.getElementById("ti_vloss");
    
    if (!accBox || !lossBox || !vaccBox || !vlossBox) {
        console.warn("无法找到训练指标元素，跳过标签更新");
        return;
    }
    
    if (isTimeSeries) {
        // 时序数据：显示MAE和MSE/MAE
        accBox.children[0].innerHTML = "MAE：";
        vaccBox.children[0].innerHTML = "验证集 MAE：";
        
        // 根据损失函数类型显示对应的标签
        if (lossFunction === "meanAbsoluteError") {
            lossBox.children[0].innerHTML = "MAE (损失)：";
            vlossBox.children[0].innerHTML = "验证集 MAE (损失)：";
        } else {
            // 默认使用MSE
            lossBox.children[0].innerHTML = "MSE：";
            vlossBox.children[0].innerHTML = "验证集 MSE：";
        }
    } else {
        // 分类数据：显示准确率和损失率
        accBox.children[0].innerHTML = "准确率：";
        lossBox.children[0].innerHTML = "损失率：";
        vaccBox.children[0].innerHTML = "验证集准确率：";
        vlossBox.children[0].innerHTML = "验证集损失率：";
    }
}

export async function train(): Promise<void> {
    // Set up all of the plots
    resetPlotValues();
    setupPlots();
    setupTestResults();
    await dataset.load();
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
    // 从模型参数中获取优化器（支持Adam、SGD等）
    // 例如：tf.train.adam(learningRate) 或 tf.train.sgd(learningRate)
    const optimizer = model.params.getOptimizer();
    
    // ==================== 2. 检测数据集类型 ====================
    // 检测是否为时序数据（回归任务）
    const isTimeSeries = dataset instanceof AirPassengersData;
    
    // ==================== 2.5. 更新训练指标标签 ====================
    // 根据数据集类型和损失函数更新前端显示的标签文本
    // 注意：这里使用model.params.loss，因为实际的loss变量还没有确定
    // 但我们需要先更新标签，所以先使用用户选择的损失函数
    let initialLoss = model.params.loss;
    if (isTimeSeries) {
        // 对于时序数据，确保损失函数是MSE或MAE
        if (initialLoss !== "meanAbsoluteError" && initialLoss !== "meanSquaredError") {
            initialLoss = "meanSquaredError"; // 默认使用MSE
        }
    }
    updateTrainingIndicatorLabels(isTimeSeries, initialLoss);
    
    // ==================== 3. 损失函数设置 ====================
    // 对于时序数据，允许用户选择MSE或MAE作为损失函数
    // 对于分类任务，使用用户选择的损失函数
    let loss: string;
    
    // 根据用户选择的损失函数和数据集类型确定实际使用的损失函数
    // TensorFlow.js支持字符串形式的'meanAbsoluteError'，无需自定义函数
    if (isTimeSeries) {
        // 对于时序数据，如果用户选择了MAE，直接使用字符串形式
        if (model.params.loss === "meanAbsoluteError") {
            loss = "meanAbsoluteError";
        } else if (model.params.loss === "meanSquaredError") {
            // 如果用户选择了MSE，使用MSE
            loss = "meanSquaredError";
        } else {
            // 如果用户选择了不合适的损失函数（如交叉熵），强制使用MSE并给出警告
            console.warn(`Loss function '${model.params.loss}' is not suitable for regression tasks. Using MSE instead.`);
            loss = "meanSquaredError";
        }
    } else {
        // 对于分类任务，使用用户选择的损失函数
        loss = model.params.loss;
    }
    
    // ==================== 4. 指标设置 ====================
    // TensorFlow.js支持字符串形式的'mae'作为指标（不是'meanAbsoluteError'）
    // 对于时序数据：使用MAE作为评估指标
    // 对于分类数据：使用accuracy作为评估指标
    const metrics = isTimeSeries ? ["mae"] : ["accuracy"];
    
    // 打印编译信息以便调试
    if (isTimeSeries) {
        console.log("Compiling model for time series with loss:", loss, "metrics:", metrics);
        console.log("Model input shape:", model.architecture.inputs[0].shape);
        console.log("Model output shape:", model.architecture.outputs[0].shape);
        console.log("Model summary:");
        model.architecture.summary();
    }

    // ==================== 5. 模型编译 ====================
    // 编译模型：设置损失函数、指标和优化器
    model.architecture.compile({
        loss,        // 损失函数：'meanSquaredError' 或 'meanAbsoluteError'（时序）/'categoricalCrossentropy'（分类）
        metrics,     // 评估指标：['mae']（时序）或 ['accuracy']（分类）
        optimizer,   // 优化器：从model.params.getOptimizer()获取（如Adam、SGD等）
    });
    
    // ==================== 6. 训练参数设置 ====================
    const batchSize = model.params.batchSize;  // 批次大小：时序预测建议使用小批次（如8）更稳定
    
    // 对于时序数据，不能使用随机分割，必须按时间顺序分割
    // 对于分类数据，可以使用随机分割
    let validationSplit: number | undefined;
    let validationData: {xs: tf.Tensor, ys: tf.Tensor} | undefined;
    
    // 先获取完整的训练数据和测试数据
    const fullTrainData = dataset.getTrainData();
    const testData = dataset.getTestData();
    
    // 对于时序数据，手动创建验证集（从训练集的末尾取15%）
    // 这样可以保持时间顺序，避免数据泄露
    // 注意：TensorFlow.js的validationSplit会随机打乱数据，这对时序数据是错误的
    let valXs: tf.Tensor | null = null;
    let valLabels: tf.Tensor | null = null;
    let trainXs: tf.Tensor | null = null;
    let trainLabels: tf.Tensor | null = null;
    
    if (isTimeSeries) {
        const totalTrainSamples = fullTrainData.xs.shape[0];
        const valSize = Math.floor(totalTrainSamples * 0.15);
        const trainSize = totalTrainSamples - valSize;
        
        // 验证集：从训练集的末尾取15%（保持时间顺序）
        valXs = (fullTrainData.xs as tf.Tensor<tf.Rank.R3>).slice([trainSize, 0, 0], [valSize, fullTrainData.xs.shape[1], fullTrainData.xs.shape[2]]) as tf.Tensor<tf.Rank.R3>;
        valLabels = (fullTrainData.labels as tf.Tensor<tf.Rank.R2>).slice([trainSize, 0], [valSize, fullTrainData.labels.shape[1]]) as tf.Tensor<tf.Rank.R2>;
        
        // 训练集：使用前85%
        trainXs = (fullTrainData.xs as tf.Tensor<tf.Rank.R3>).slice([0, 0, 0], [trainSize, fullTrainData.xs.shape[1], fullTrainData.xs.shape[2]]) as tf.Tensor<tf.Rank.R3>;
        trainLabels = (fullTrainData.labels as tf.Tensor<tf.Rank.R2>).slice([0, 0], [trainSize, fullTrainData.labels.shape[1]]) as tf.Tensor<tf.Rank.R2>;
        
        // TensorFlow.js要求validationData是{xs, ys}对象，而非数组
        validationData = {xs: valXs, ys: valLabels};
        
        // 更新fullTrainData为分割后的训练集
        (fullTrainData as any).xs = trainXs;
        (fullTrainData as any).labels = trainLabels;
        
        console.log(`时序数据划分: 训练集${trainSize}个样本, 验证集${valSize}个样本 (都来自前80%的数据)`);
        console.log(`注意：验证集从训练集的末尾取，保持时间顺序，避免随机打乱`);
        
        // 使用手动创建的验证集，不使用validationSplit
        validationSplit = undefined;
    } else {
        // 对于分类数据，使用随机分割
        // validationSplit = 0.15 意味着训练数据会被自动分割为：
        // - 85% 用于训练（用于更新模型参数）
        // - 15% 用于验证（用于评估模型性能，不参与参数更新）
        validationSplit = 0.15;
        validationData = undefined;
    }

    const trainEpochs = model.params.epochs;

    // We'll keep a buffer of loss and accuracy values over time.
    let trainBatchCount: number = 0;
    let prevTrainBatchCount: number = 0;
    let totalLoss: number = 0;
    let totalAccuracy: number = 0;
    const plotLossFrequency: number = 25;

    const trainData = fullTrainData;
    
    // 验证数据格式
    console.log("Train data shape:", trainData.xs.shape);
    console.log("Train labels shape:", trainData.labels.shape);
    console.log("Test data shape:", testData.xs.shape);
    console.log("Test labels shape:", testData.labels.shape);
    
    // 编译后检查模型是否可以正确预测（在训练前）
    if (isTimeSeries) {
        console.log("Testing model prediction before training...");
        const testSample = (trainData.xs as tf.Tensor<tf.Rank.R3>).slice([0, 0, 0], [1, trainData.xs.shape[1], trainData.xs.shape[2]]);
        const testPred = model.architecture.predict(testSample) as tf.Tensor;
        const testPredValue = testPred.dataSync()[0];
        console.log("Pre-training prediction sample:", testPredValue, "shape:", testPred.shape);
        testSample.dispose();
        testPred.dispose();
    }
    
    // 检查数据是否包含NaN或Inf
    if (isTimeSeries) {
        const xsMin = trainData.xs.min().dataSync()[0];
        const xsMax = trainData.xs.max().dataSync()[0];
        const labelsMin = trainData.labels.min().dataSync()[0];
        const labelsMax = trainData.labels.max().dataSync()[0];
        console.log("Train data range: xs=[", xsMin, ",", xsMax, "], labels=[", labelsMin, ",", labelsMax, "]");
        
        // 检查是否有NaN或Inf
        const xsHasNaN = !isFinite(xsMin) || !isFinite(xsMax);
        const labelsHasNaN = !isFinite(labelsMin) || !isFinite(labelsMax);
        if (xsHasNaN || labelsHasNaN) {
            console.error("Data contains NaN or Inf values!");
        }
    }
    
    // 对于时序数据，需要将3D张量转换为适合fit的格式
    // 但AirPassengersData已经返回正确的格式，所以这里不需要转换
    const totalNumBatches = Math.ceil(trainData.xs.shape[0] * (1 - validationSplit) / batchSize) * trainEpochs;

    // 学习率调度：监控验证准确率，防止后期训练不稳定
    let lastBestValAcc = 0;
    let patienceCounter = 0;
    const patience = 3; // 如果验证准确率3个epoch不提升，降低学习率
    const lrDecayFactor = 0.5; // 学习率衰减因子
    let currentLearningRate = model.params.learningRate;

    // ==================== 7. 构建训练选项 ====================
    // 构建fit选项，不能同时指定validationData和validationSplit
    const fitOptions: any = {
        batchSize,  // 批次大小：时序预测小批次更稳定（如8），分类任务可以使用较大批次
        epochs: trainEpochs,  // 训练轮数：从model.params.epochs获取（如50）
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
                
                // 添加详细的调试信息（只在第一个batch打印，用于确认指标是否正确）
                if (batch === 0) {
                    console.log(`Batch ${batch} - logs keys:`, Object.keys(logs));
                    console.log(`Batch ${batch} - logs values:`, logs);
                    if (isTimeSeries) {
                        console.log(`Batch ${batch} - isTimeSeries: true, looking for MAE`);
                    }
                }
                
                // 对于时序数据，显示MAE；对于分类数据，显示准确率
                if (isTimeSeries) {
                    // TensorFlow.js使用'mae'作为指标时，logs中的键可能是'mae'或'metric_0'
                    let mae = logs.mae;
                    if (mae === undefined || mae === null) {
                        // 尝试其他可能的键名
                        mae = (logs as any).metric_0;
                    }
                    if (mae === undefined || mae === null) {
                        // 如果还是找不到，尝试从所有键中查找
                        const logKeys = Object.keys(logs);
                        const maeKey = logKeys.find(key => key.toLowerCase().includes('mae') || key === 'metric_0');
                        if (maeKey) {
                            mae = (logs as any)[maeKey];
                        }
                    }
                    const maeValue = (typeof mae === "number" && !isNaN(mae) && isFinite(mae)) ? mae : 0;
                    accBox.children[1].innerHTML = String(Number(maeValue.toFixed(4)));
                } else {
                    accBox.children[1].innerHTML = String(Number((100 * (logs.acc || 0)).toFixed(2)));
                }
                
                // 显示损失值，如果是NaN或undefined则显示0
                const lossValue = (typeof logs.loss === "number" && !isNaN(logs.loss) && isFinite(logs.loss)) ? logs.loss : 0;
                if (batch === 0) {
                    console.log(`Batch ${batch} - Loss value:`, lossValue, "logs.loss:", logs.loss, "type:", typeof logs.loss);
                    if (lossValue === 0 || !isFinite(lossValue)) {
                        console.warn(`Batch ${batch} - Loss is 0 or invalid. This may indicate a training problem.`);
                    }
                }
                lossBox.children[1].innerHTML = String(Number(lossValue.toFixed(4)));
                trainBox.children[1].innerHTML = String((trainBatchCount / totalNumBatches * 100).toFixed(1) + "%");
                
                
                // For logging training in console.
                // console.log(
                //     `Training... (` +
                //     `${(trainBatchCount / totalNumBatches * 100).toFixed(1)}%` +
                //     ` complete). To stop training, refresh or close page.`);
                // 确保loss是有效数字
                const validLoss = (typeof logs.loss === "number" && !isNaN(logs.loss) && isFinite(logs.loss) && logs.loss > 0) ? logs.loss : null;
                
                // 对于内置指标，直接从logs中获取
                let maeValue: number | null = null;
                if (isTimeSeries) {
                    // TensorFlow.js使用'mae'作为指标时，logs中的键可能是'mae'或'metric_0'
                    let mae = logs.mae;
                    if (mae === undefined || mae === null) {
                        mae = (logs as any).metric_0;
                    }
                    if (mae === undefined || mae === null) {
                        const logKeys = Object.keys(logs);
                        const maeKey = logKeys.find(key => key.toLowerCase().includes('mae') || key === 'metric_0');
                        if (maeKey) {
                            mae = (logs as any)[maeKey];
                        }
                    }
                    if (typeof mae === "number" && !isNaN(mae) && isFinite(mae)) {
                        maeValue = mae;
                    }
                }
                
                // 累积值（只累积有效值）
                if (validLoss !== null) {
                    totalLoss += validLoss;
                } else if (batch === 0) {
                    console.warn(`Batch ${batch} - Invalid loss:`, logs.loss, "type:", typeof logs.loss);
                }
                
                if (isTimeSeries) {
                    if (maeValue !== null) {
                        totalAccuracy += maeValue;
                    }
                } else {
                    const acc = logs.acc;
                    if (typeof acc === "number" && !isNaN(acc) && isFinite(acc)) {
                        totalAccuracy += acc;
                    }
                }
                
                // 对于时序数据，每个batch都绘制（因为batch数量少）
                // 对于其他数据，按plotLossFrequency频率绘制
                const shouldPlot = isTimeSeries 
                    ? (trainBatchCount > prevTrainBatchCount)  // 时序数据：每个batch都绘制
                    : (batch % plotLossFrequency === 0 && batch > 0 && trainBatchCount > prevTrainBatchCount);  // 其他数据：按频率绘制
                
                if (shouldPlot) {
                  // Compute the average loss for the last period
                  const batchCount = trainBatchCount - prevTrainBatchCount;
                  const avgLoss = batchCount > 0 ? totalLoss / batchCount : validLoss || 0;
                  const avgMetric = batchCount > 0 ? totalAccuracy / batchCount : (maeValue || 0);
                  
                  if (batch % 50 === 0 || isTimeSeries) {
                      console.log(`Plotting at batch ${batch}: avgLoss=${avgLoss}, avgMetric=${avgMetric}, batchCount=${batchCount}`);
                  }
                  
                  // 确保值有效
                  if (isFinite(avgLoss) && avgLoss > 0) {
                      plotLoss(trainBatchCount, avgLoss, "train");
                  } else {
                      console.warn(`Invalid loss value at batch ${batch}: ${avgLoss} (totalLoss=${totalLoss}, batchCount=${batchCount})`);
                  }
                  
                  if (isFinite(avgMetric) && avgMetric >= 0) {
                      plotAccuracy(trainBatchCount, avgMetric, "train");
                  } else {
                      console.warn(`Invalid metric value at batch ${batch}: ${avgMetric} (totalAccuracy=${totalAccuracy}, batchCount=${batchCount})`);
                  }
                  
                  prevTrainBatchCount = trainBatchCount;
                  totalLoss = 0;
                  totalAccuracy = 0;
                } else if (batch === 0 && trainBatchCount === 1 && !isTimeSeries) {
                    // 对于非时序数据，第一个batch时也绘制一个初始点
                    if (validLoss !== null && validLoss > 0) {
                        plotLoss(trainBatchCount, validLoss, "train");
                    }
                    if (maeValue !== null && maeValue >= 0) {
                        plotAccuracy(trainBatchCount, maeValue, "train");
                    }
                }
                if (trainingHistory) {
                    // 提取 MAE 值（如果是时序数据）- 重用上面已经找到的maeValue
                    let batchMaeValue: number | null = null;
                    if (isTimeSeries) {
                        // 重用上面已经找到的maeValue
                        batchMaeValue = maeValue !== null ? Number(maeValue.toFixed(4)) : null;
                    }
                    
                    const batchMetric: IBatchMetric = {
                        batch: trainBatchCount,
                        loss: validLoss !== null ? Number(validLoss.toFixed(4)) : null,
                        accuracy: isTimeSeries ? batchMaeValue : 
                            (typeof logs.acc === "number" ? Number(logs.acc.toFixed(4)) : null),
                    };
                    trainingHistory.batchMetrics.push(batchMetric);
                }
                if (batch % 60 === 0) {
                  onIteration();
                }
                await tf.nextFrame();
            },
            onEpochEnd: async (epoch: number, logs: tf.Logs) => {

                if (stopTraining) {
                    console.log("Training stopped by user.");
                    model.architecture.stopTraining = true;
                    model.architecture.resetStates();
                    return;
                }

                // 重置RNN状态，防止状态累积导致数值不稳定
                // 这对于RNN训练非常重要，特别是在长时间训练后
                model.architecture.resetStates();

                // 内置指标在验证日志中可能以不同的键出现
                let valMetric: number;
                if (isTimeSeries) {
                    // TensorFlow.js使用'mae'作为指标时，验证集的键可能是'val_mae'或'val_metric_0'
                    const logKeys = Object.keys(logs);
                    let valMaeKey = logKeys.find(key => 
                        key === 'val_mae' ||
                        key === 'val_metric_0' ||
                        key.startsWith('val_metric_')
                    );
                    // 如果找不到，尝试查找包含'mae'和'val'的键
                    if (!valMaeKey) {
                        valMaeKey = logKeys.find(key => 
                            key.toLowerCase().includes('mae') && key.toLowerCase().includes('val')
                        );
                    }
                    valMetric = valMaeKey ? ((logs as any)[valMaeKey] || 0) : 0;
                    // 如果找不到，尝试手动计算验证集MAE
                    if (!valMaeKey || valMetric === 0) {
                        if (logKeys.length > 0) {
                            console.log("Epoch", epoch + 1, "- Validation MAE not found or is 0, available keys:", logKeys);
                        }
                        // 如果validationData存在，手动计算MAE
                        if (validationData && valMetric === 0) {
                            try {
                                const valPredictions = model.architecture.predict(validationData.xs) as tf.Tensor;
                                const valMAE = tf.losses.absoluteDifference(validationData.ys, valPredictions).dataSync()[0];
                                valMetric = valMAE;
                                valPredictions.dispose();
                                console.log("Epoch", epoch + 1, "- Manually calculated validation MAE:", valMetric);
                            } catch (e) {
                                console.warn("Epoch", epoch + 1, "- Failed to manually calculate validation MAE:", e);
                            }
                        }
                    } else if (valMaeKey) {
                        console.log("Epoch", epoch + 1, "- Found validation MAE at key:", valMaeKey, "value:", valMetric);
                    }
                } else {
                    valMetric = logs.val_acc;
                }
                
                // 获取验证集损失值，如果无效则手动计算
                let valLoss = logs.val_loss;
                let valLossValue: number;
                
                // 检查valLoss是否有效
                if (typeof valLoss !== "number" || isNaN(valLoss) || !isFinite(valLoss)) {
                    // 如果valLoss无效，尝试手动计算
                    if (validationData) {
                        try {
                            const valPredictions = model.architecture.predict(validationData.xs) as tf.Tensor;
                            if (loss === "meanSquaredError") {
                                valLoss = tf.losses.meanSquaredError(validationData.ys, valPredictions).dataSync()[0];
                            } else if (loss === "meanAbsoluteError") {
                                valLoss = tf.losses.absoluteDifference(validationData.ys, valPredictions).dataSync()[0];
                            } else {
                                // 对于其他损失函数，使用默认的MSE
                                valLoss = tf.losses.meanSquaredError(validationData.ys, valPredictions).dataSync()[0];
                            }
                            valPredictions.dispose();
                            console.log(`Epoch ${epoch + 1} - 手动计算验证集损失: ${valLoss.toFixed(4)}`);
                        } catch (e) {
                            console.warn(`Epoch ${epoch + 1} - 无法计算验证集损失:`, e);
                            valLoss = 0;
                        }
                    } else {
                        valLoss = 0;
                    }
                }
                
                valLossValue = (typeof valLoss === "number" && !isNaN(valLoss) && isFinite(valLoss)) ? valLoss : 0;
                
                const accBox = document.getElementById("ti_vacc");
                const lossBox = document.getElementById("ti_vloss");
                
                // 对于时序数据，显示MAE；对于分类数据，显示准确率
                if (isTimeSeries) {
                    accBox.children[1].innerHTML = String(Number((valMetric || 0).toFixed(4)));
                } else {
                    accBox.children[1].innerHTML = String(Number((100 * (valMetric || 0)).toFixed(2)));
                }
                // 显示验证损失值
                lossBox.children[1].innerHTML = String(Number(valLossValue.toFixed(4)));
                
                // 绘制验证集loss和MAE
                // 对于时序数据，loss是MSE或MAE，metric是MAE
                // 使用当前的trainBatchCount作为x轴，这样可以与训练集数据对齐
                // 注意：如果valLossValue为0或无效，不绘制，避免显示错误的数据
                if (valLossValue > 0 && isFinite(valLossValue)) {
                    plotLoss(trainBatchCount, valLossValue, "validation");
                }
                if (valMetric !== undefined && valMetric !== null && valMetric >= 0 && isFinite(valMetric)) {
                    plotAccuracy(trainBatchCount, valMetric, "validation");
                }
                
                // 时序数据不需要混淆矩阵
                if (!isTimeSeries) {
                    showConfusionMatrix();
                } else {
                    // 对于时序数据，隐藏混淆矩阵，显示验证集和测试集指标
                    const confusionMatrixElement = document.getElementById("confusion-matrix-canvas");
                    if (confusionMatrixElement) {
                        confusionMatrixElement.style.display = "none";
                    }
                }
                onIteration();
                
                // 记录训练历史数据（用于导出功能）
                if (trainingHistory) {
                    const epochMetric: IEpochMetric = {
                        epoch: epoch + 1,
                        valLoss: (typeof valLossValue === "number" && valLossValue > 0 && isFinite(valLossValue)) 
                            ? Number(valLossValue.toFixed(4)) 
                            : null,
                        valAccuracy: typeof valMetric === "number" ? Number(valMetric.toFixed(4)) : null,
                    };
                    trainingHistory.epochMetrics.push(epochMetric);
                }

                // 学习率调度：如果验证指标不再提升，降低学习率
                // 对于时序数据，MAE越小越好；对于分类数据，准确率越大越好
                const isBetter = isTimeSeries ? (valMetric < lastBestValAcc) : (valMetric > lastBestValAcc);
                if (isBetter) {
                    lastBestValAcc = valMetric;
                    patienceCounter = 0;
                } else {
                    patienceCounter++;
                    // 如果验证指标连续patience个epoch没有提升，建议降低学习率
                    if (patienceCounter >= patience && currentLearningRate > 1e-6) {
                        currentLearningRate *= lrDecayFactor;
                        const metricName = isTimeSeries ? "MAE" : "准确率";
                        const metricValue = isTimeSeries ? valMetric.toFixed(4) : `${(valMetric * 100).toFixed(2)}%`;
                        console.log(`建议降低学习率至: ${currentLearningRate} (当前验证${metricName}: ${metricValue})`);
                        // 注意：实际学习率调整需要在下次训练时手动设置
                        patienceCounter = 0; // 重置计数器
                    }
                }

                await tf.nextFrame();
            },
        },
    };
    
    // ==================== 8. 验证集设置 ====================
    // 根据情况添加validationData或validationSplit
    // 注意：不能同时指定validationData和validationSplit
    if (validationData) {
        // 时序数据：使用手动创建的验证集（保持时间顺序）
        fitOptions.validationData = validationData;  // 格式：{xs: tf.Tensor, ys: tf.Tensor}
    } else if (validationSplit !== undefined) {
        // 分类数据：使用随机分割（validationSplit = 0.15 表示15%用于验证）
        fitOptions.validationSplit = validationSplit;
    }
    
    // ==================== 9. 开始训练 ====================
    // 调用fit方法开始训练模型
    await model.architecture.fit(trainData.xs, trainData.labels, fitOptions);

    // 评估测试集
    const testResult = model.architecture.evaluate(testData.xs, testData.labels) as Array<tf.Tensor<tf.Rank.R0>>;
    let testLoss = testResult[0].dataSync()[0];
    let testMetric = testResult[1].dataSync()[0];
    
    // 检查值是否有效
    if (!isFinite(testLoss) || isNaN(testLoss)) {
        console.error("测试集损失值为NaN或Inf，尝试手动计算");
        // 手动计算损失值
        const predictions = model.architecture.predict(testData.xs) as tf.Tensor;
        const labels = testData.labels;
        if (loss === "meanSquaredError") {
            testLoss = tf.losses.meanSquaredError(labels, predictions).dataSync()[0];
        } else if (loss === "meanAbsoluteError") {
            testLoss = tf.losses.absoluteDifference(labels, predictions).dataSync()[0];
        }
    }
    
    if (!isFinite(testMetric) || isNaN(testMetric)) {
        console.error("测试集MAE指标值为NaN或Inf，尝试手动计算");
        // 手动计算MAE
        const predictions = model.architecture.predict(testData.xs) as tf.Tensor;
        const labels = testData.labels;
        testMetric = tf.losses.absoluteDifference(labels, predictions).dataSync()[0];
    }
    
    console.log("测试集评估结果 - Loss:", testLoss, "Metric:", testMetric);
    
    // 注意：ti_vacc 和 ti_vloss 在训练过程中显示验证集结果
    // 训练结束后，这里显示的是测试集的结果（会覆盖最后一个epoch的验证集结果）
    const vaccBox = document.getElementById("ti_vacc");
    const vlossBox = document.getElementById("ti_vloss");
    
    // 对于时序数据，显示MAE；对于分类数据，显示准确率
    if (isTimeSeries) {
        // 对于时序数据：
        // - testResult[0] 是损失值（如果损失函数是MSE，这是MSE；如果是MAE，这是MAE）
        // - testResult[1] 是MAE指标值
        // 如果损失函数是MAE，两个值会相同，这是正常的（因为损失和指标都是MAE）
        
        const testLossValue = Number(testLoss.toFixed(4));
        const testMetricValue = Number(testMetric.toFixed(4));
        
        // 显示测试集结果（会覆盖验证集的最后结果）
        vaccBox.children[1].innerHTML = String(testMetricValue);
        vlossBox.children[1].innerHTML = String(testLossValue);
        
        // 添加控制台说明
        if (model.params.loss === "meanAbsoluteError") {
            // 如果损失函数是MAE，损失值和指标值都是MAE，所以值相同是正常的
            console.log("=".repeat(60));
            console.log("测试集评估完成（使用MAE损失函数）");
            console.log(`测试集 MAE (损失函数): ${testLossValue}`);
            console.log(`测试集 MAE (指标): ${testMetricValue}`);
            console.log("注意：因为损失函数和指标都是MAE，所以两个值相同是正常的");
            
            // 比较验证集和测试集的性能
            const valMetric = trainingHistory?.epochMetrics[trainingHistory.epochMetrics.length - 1]?.valAccuracy;
            if (valMetric !== null && valMetric !== undefined) {
                const valMetricValue = Number(valMetric);
                console.log(`\n性能对比:`);
                console.log(`验证集 MAE: ${valMetricValue.toFixed(4)} (来自训练集的前80%数据的后15%)`);
                console.log(`测试集 MAE: ${testMetricValue} (来自数据的后20%)`);
                if (testMetricValue < valMetricValue) {
                    console.log(`\n⚠️  注意：测试集MAE (${testMetricValue}) < 验证集MAE (${valMetricValue.toFixed(4)})`);
                    console.log(`这可能是因为：`);
                    console.log(`1. 验证集来自训练集的末尾，可能包含更难预测的数据`);
                    console.log(`2. 测试集虽然来自不同的时间段，但可能更容易预测`);
                    console.log(`3. 或者模型在验证集上过拟合了`);
                } else if (testMetricValue > valMetricValue) {
                    console.log(`\n⚠️  注意：测试集MAE (${testMetricValue}) > 验证集MAE (${valMetricValue.toFixed(4)})`);
                    console.log(`这可能是因为：`);
                    console.log(`1. 测试集来自不同的时间段，具有不同的时间特征`);
                    console.log(`2. 模型在前80%的数据上训练，可能无法很好地泛化到后20%的数据`);
                    console.log(`3. 这是时序数据常见的现象，称为"分布偏移"`);
                }
            }
            console.log("=".repeat(60));
            
            // 生成预测结果可视化
            renderTimeSeriesPredictions(testData, (dataset as AirPassengersData).getValidationData(), dataset as AirPassengersData);
            
            // 获取验证集的最后一个epoch的指标值用于可视化
            const lastEpochMetric = trainingHistory?.epochMetrics[trainingHistory.epochMetrics.length - 1];
            let valLoss = lastEpochMetric?.valLoss ?? null;
            let valMAE = lastEpochMetric?.valAccuracy ?? null;
            
            // 如果验证集的损失值为null或NaN，尝试从验证集重新计算
            // 注意：这个检查现在主要是为了确保最终记录的值是有效的
            // 在onEpochEnd回调中已经尝试手动计算了，所以这里应该很少会触发
            if (valLoss === null || isNaN(valLoss) || !isFinite(valLoss)) {
                console.warn("验证集损失值在训练结束后仍为无效，尝试重新计算");
                if (validationData) {
                    try {
                        const valPredictions = model.architecture.predict(validationData.xs) as tf.Tensor;
                        if (loss === "meanSquaredError") {
                            valLoss = tf.losses.meanSquaredError(validationData.ys, valPredictions).dataSync()[0];
                        } else if (loss === "meanAbsoluteError") {
                            valLoss = tf.losses.absoluteDifference(validationData.ys, valPredictions).dataSync()[0];
                        } else {
                            // 对于其他损失函数，使用MSE作为默认值
                            valLoss = tf.losses.meanSquaredError(validationData.ys, valPredictions).dataSync()[0];
                        }
                        valPredictions.dispose();
                        console.log(`重新计算的验证集损失: ${valLoss.toFixed(4)}`);
                        
                        // 将重新计算的验证集loss绘制到图表中（使用最后一个epoch对应的batch数）
                        if (valLoss > 0 && isFinite(valLoss)) {
                            // 计算最后一个epoch对应的batch数
                            const batchesPerEpoch = Math.ceil(trainData.xs.shape[0] * (1 - (validationSplit || 0)) / batchSize);
                            const finalBatchNum = trainEpochs * batchesPerEpoch;
                            plotLoss(finalBatchNum, valLoss, "validation");
                        }
                    } catch (e) {
                        console.error("重新计算验证集损失时出错:", e);
                    }
                } else {
                    console.warn("无法重新计算验证集损失：validationData不存在");
                }
            }
            
            // 如果验证集的MAE为null或NaN，尝试从验证集重新计算
            if (valMAE === null || isNaN(valMAE) || !isFinite(valMAE)) {
                console.warn("验证集MAE为无效，尝试重新计算");
                if (validationData) {
                    const valPredictions = model.architecture.predict(validationData.xs) as tf.Tensor;
                    valMAE = tf.losses.absoluteDifference(validationData.ys, valPredictions).dataSync()[0];
                    valPredictions.dispose();
                    // 将重新计算的验证集MAE绘制到图表中
                    if (valMAE >= 0 && isFinite(valMAE)) {
                        const batchesPerEpoch = Math.ceil(trainData.xs.shape[0] * (1 - (validationSplit || 0)) / batchSize);
                        const finalBatchNum = trainEpochs * batchesPerEpoch;
                        plotAccuracy(finalBatchNum, valMAE, "validation");
                    }
                }
            }
            
            console.log("验证集和测试集指标 - ValLoss:", valLoss, "ValMAE:", valMAE, "TestLoss:", testLossValue, "TestMAE:", testMetricValue);
            
            // 真实值和预测值的对比图现在在visualization页面显示
            // 当用户切换到visualization页面时，showPredictions()会自动调用renderTimeSeriesPredictions
        } else {
            // 如果损失函数是MSE，损失值是MSE，指标值是MAE
            console.log("=".repeat(60));
            console.log("测试集评估完成（使用MSE损失函数）");
            console.log(`测试集 MSE (损失): ${testLossValue}`);
            console.log(`测试集 MAE (指标): ${testMetricValue}`);
            
            // 比较验证集和测试集的性能
            const valMetric = trainingHistory?.epochMetrics[trainingHistory.epochMetrics.length - 1]?.valAccuracy;
            if (valMetric !== null && valMetric !== undefined) {
                const valMetricValue = Number(valMetric);
                console.log(`\n性能对比:`);
                console.log(`验证集 MAE: ${valMetricValue.toFixed(4)} (来自训练集的前80%数据的后15%)`);
                console.log(`测试集 MAE: ${testMetricValue} (来自数据的后20%)`);
                if (testMetricValue < valMetricValue) {
                    console.log(`\n⚠️  注意：测试集MAE (${testMetricValue}) < 验证集MAE (${valMetricValue.toFixed(4)})`);
                    console.log(`这可能是因为：`);
                    console.log(`1. 验证集来自训练集的末尾，可能包含更难预测的数据`);
                    console.log(`2. 测试集虽然来自不同的时间段，但可能更容易预测`);
                    console.log(`3. 或者模型在验证集上过拟合了`);
                } else if (testMetricValue > valMetricValue) {
                    console.log(`\n⚠️  注意：测试集MAE (${testMetricValue}) > 验证集MAE (${valMetricValue.toFixed(4)})`);
                    console.log(`这可能是因为：`);
                    console.log(`1. 测试集来自不同的时间段，具有不同的时间特征`);
                    console.log(`2. 模型在前80%的数据上训练，可能无法很好地泛化到后20%的数据`);
                    console.log(`3. 这是时序数据常见的现象，称为"分布偏移"`);
                }
            }
            console.log("=".repeat(60));
            
            // 生成预测结果可视化
            renderTimeSeriesPredictions(testData, (dataset as AirPassengersData).getValidationData(), dataset as AirPassengersData);
            
            // 获取验证集的最后一个epoch的指标值用于可视化
            const lastEpochMetric = trainingHistory?.epochMetrics[trainingHistory.epochMetrics.length - 1];
            let valLoss = lastEpochMetric?.valLoss ?? null;
            let valMAE = lastEpochMetric?.valAccuracy ?? null;
            
            // 如果验证集的损失值为null或NaN，尝试从验证集重新计算
            if (valLoss === null || isNaN(valLoss) || !isFinite(valLoss)) {
                console.warn("验证集损失值为无效，尝试重新计算");
                if (validationData) {
                    const valPredictions = model.architecture.predict(validationData.xs) as tf.Tensor;
                    if (loss === "meanSquaredError") {
                        valLoss = tf.losses.meanSquaredError(validationData.ys, valPredictions).dataSync()[0];
                    } else if (loss === "meanAbsoluteError") {
                        valLoss = tf.losses.absoluteDifference(validationData.ys, valPredictions).dataSync()[0];
                    }
                    valPredictions.dispose();
                }
            }
            
            // 如果验证集的MAE为null或NaN，尝试从验证集重新计算
            if (valMAE === null || isNaN(valMAE) || !isFinite(valMAE)) {
                console.warn("验证集MAE为无效，尝试重新计算");
                if (validationData) {
                    const valPredictions = model.architecture.predict(validationData.xs) as tf.Tensor;
                    valMAE = tf.losses.absoluteDifference(validationData.ys, valPredictions).dataSync()[0];
                    valPredictions.dispose();
                }
            }
            
            console.log("验证集和测试集指标 - ValLoss:", valLoss, "ValMAE:", valMAE, "TestLoss:", testLossValue, "TestMAE:", testMetricValue);
            
            // 真实值和预测值的对比图现在在visualization页面显示
            // 当用户切换到visualization页面时，showPredictions()会自动调用renderTimeSeriesPredictions
        }
    } else {
        // 对于分类数据
        vaccBox.children[1].innerHTML = String(Number((100 * testMetric).toFixed(2)));
        vlossBox.children[1].innerHTML = String(Number(testLoss.toFixed(4)));
        console.log("=".repeat(60));
        console.log("测试集评估完成");
        console.log(`测试集损失: ${Number(testLoss.toFixed(4))}`);
        console.log(`测试集准确率: ${(testMetric * 100).toFixed(2)}%`);
        console.log("=".repeat(60));
    }
    
    if (trainingHistory) {
        trainingHistory.testMetrics = {
            accuracy: Number(testMetric.toFixed(4)),
            loss: Number(testLoss.toFixed(4)),
        };
        trainingHistory.finishedAt = new Date().toISOString();
    }
    
    // 训练完成后释放内存
    // 释放临时Tensor（仅对时序数据）
    if (isTimeSeries && valXs && valLabels && trainXs && trainLabels) {
        tf.dispose([valXs, valLabels, trainXs, trainLabels]);
        console.log("已释放临时Tensor内存");
    }
    
    // 注意：模型和数据集不在这里释放，因为它们可能还需要用于预测和可视化
    // 如果需要释放，可以在适当的时机调用：
    // await model.architecture.dispose();
    // dataset.dispose();
}
