// 时序预测任务训练模块
// 专门处理时序数据（如AirPassengers）的回归预测任务

import * as tf from "@tensorflow/tfjs";
import {plotAccuracy,
        plotLoss,
        resetPlotValues,
        setupPlots,
        setupTestResults,
        renderTimeSeriesPredictions} from "./graphs";

import {dataset, AirPassengersData} from "./data";
import { model } from "./params_object";
import { displayError } from "../ui/error";
import { showPredictions } from "./graphs";
import { ITrainingHistory, IBatchMetric, IEpochMetric, stopTraining } from "./mnist_model";

/**
 * 更新训练指标标签为时序预测任务的标签
 */
function updateTrainingIndicatorLabels(lossFunction: string): void {
    const accBox = document.getElementById("ti_acc");
    const lossBox = document.getElementById("ti_loss");
    const vaccBox = document.getElementById("ti_vacc");
    const vlossBox = document.getElementById("ti_vloss");
    
    if (!accBox || !lossBox || !vaccBox || !vlossBox) {
        console.warn("无法找到训练指标元素，跳过标签更新");
        return;
    }
    
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
}

/**
 * 训练时序预测模型
 */
export async function trainTimeSeries(trainingHistory: ITrainingHistory): Promise<void> {
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
    
    const onIteration = () => showPredictions();
    
    // ==================== 1. 优化器定义 ====================
    const optimizer = model.params.getOptimizer();
    
    // ==================== 2. 更新训练指标标签 ====================
    let initialLoss = model.params.loss;
    // 对于时序数据，确保损失函数是MSE或MAE
    if (initialLoss !== "meanAbsoluteError" && initialLoss !== "meanSquaredError") {
        initialLoss = "meanSquaredError"; // 默认使用MSE
    }
    updateTrainingIndicatorLabels(initialLoss);
    
    // ==================== 3. 损失函数设置 ====================
    let loss: string;
    if (model.params.loss === "meanAbsoluteError") {
        loss = "meanAbsoluteError";
    } else if (model.params.loss === "meanSquaredError") {
        loss = "meanSquaredError";
    } else {
        // 如果用户选择了不合适的损失函数（如交叉熵），强制使用MSE并给出警告
        console.warn(`Loss function '${model.params.loss}' is not suitable for regression tasks. Using MSE instead.`);
        loss = "meanSquaredError";
    }
    
    // ==================== 4. 指标设置 ====================
    const metrics = ["mae"];
    
    // 打印编译信息以便调试
    console.log("Compiling model for time series with loss:", loss, "metrics:", metrics);
    console.log("Model input shape:", model.architecture.inputs[0].shape);
    console.log("Model output shape:", model.architecture.outputs[0].shape);
    console.log("Model summary:");
    model.architecture.summary();
    
    // 检查模型输入输出形状是否合理
    const inputShape = model.architecture.inputs[0].shape;
    const outputShape = model.architecture.outputs[0].shape;
    
    if (!inputShape || inputShape.length === 0) {
        const errorMsg = "模型输入形状无效！请检查网络结构。";
        console.error(errorMsg);
        displayError(new Error(errorMsg));
        return;
    }
    
    if (!outputShape || outputShape.length === 0) {
        const errorMsg = "模型输出形状无效！请检查网络结构。";
        console.error(errorMsg);
        displayError(new Error(errorMsg));
        return;
    }
    
    console.log("模型形状检查通过：输入", inputShape, "输出", outputShape);

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
    
    // 对于时序数据，手动创建验证集（从训练集的末尾取15%）
    // 这样可以保持时间顺序，避免数据泄露
    const fullTrainData = dataset.getTrainData();
    const testData = dataset.getTestData();
    
    const totalTrainSamples = fullTrainData.xs.shape[0];
    const valSize = Math.floor(totalTrainSamples * 0.15);
    const trainSize = totalTrainSamples - valSize;
    
    // 验证集：从训练集的末尾取15%（保持时间顺序）
    const valXs = (fullTrainData.xs as tf.Tensor<tf.Rank.R3>).slice([trainSize, 0, 0], [valSize, fullTrainData.xs.shape[1], fullTrainData.xs.shape[2]]) as tf.Tensor<tf.Rank.R3>;
    const valLabels = (fullTrainData.labels as tf.Tensor<tf.Rank.R2>).slice([trainSize, 0], [valSize, fullTrainData.labels.shape[1]]) as tf.Tensor<tf.Rank.R2>;
    
    // 训练集：使用前85%
    const trainXs = (fullTrainData.xs as tf.Tensor<tf.Rank.R3>).slice([0, 0, 0], [trainSize, fullTrainData.xs.shape[1], fullTrainData.xs.shape[2]]) as tf.Tensor<tf.Rank.R3>;
    const trainLabels = (fullTrainData.labels as tf.Tensor<tf.Rank.R2>).slice([0, 0], [trainSize, fullTrainData.labels.shape[1]]) as tf.Tensor<tf.Rank.R2>;
    
    // TensorFlow.js要求validationData是{xs, ys}对象，而非数组
    const validationData = {xs: valXs, ys: valLabels};
    
    console.log(`时序数据划分: 训练集${trainSize}个样本, 验证集${valSize}个样本 (都来自前80%的数据)`);
    console.log(`注意：验证集从训练集的末尾取，保持时间顺序，避免随机打乱`);

    const trainEpochs = model.params.epochs;

    // We'll keep a buffer of loss and accuracy values over time.
    let trainBatchCount: number = 0;
    let prevTrainBatchCount: number = 0;
    let totalLoss: number = 0;
    let totalAccuracy: number = 0;

    const trainData = {xs: trainXs, labels: trainLabels};
    
    // 验证数据格式
    console.log("Train data shape:", trainData.xs.shape);
    console.log("Train labels shape:", trainData.labels.shape);
    console.log("Test data shape:", testData.xs.shape);
    console.log("Test labels shape:", testData.labels.shape);
    
    // 编译后检查模型是否可以正确预测（在训练前）
    console.log("Testing model prediction before training...");
    const testSample = (trainData.xs as tf.Tensor<tf.Rank.R3>).slice([0, 0, 0], [1, trainData.xs.shape[1], trainData.xs.shape[2]]);
    const testPred = model.architecture.predict(testSample) as tf.Tensor;
    const testPredValue = testPred.dataSync()[0];
    console.log("Pre-training prediction sample:", testPredValue, "shape:", testPred.shape);
    
    // 检查预测值是否合理
    if (isNaN(testPredValue) || !isFinite(testPredValue)) {
        console.warn("警告：训练前预测值为NaN或Inf，模型可能未正确初始化");
    }
    
    // 检查多个样本的预测值是否都相同
    const testSample2 = (trainData.xs as tf.Tensor<tf.Rank.R3>).slice([1, 0, 0], [1, trainData.xs.shape[1], trainData.xs.shape[2]]);
    const testPred2 = model.architecture.predict(testSample2) as tf.Tensor;
    const testPredValue2 = testPred2.dataSync()[0];
    console.log("Pre-training prediction sample 2:", testPredValue2);
    
    if (Math.abs(testPredValue - testPredValue2) < 1e-6) {
        console.warn("警告：多个样本的预测值完全相同，模型可能未正确初始化或权重未更新");
    }
    
    testSample.dispose();
    testPred.dispose();
    testSample2.dispose();
    testPred2.dispose();
    
    // 检查数据是否包含NaN或Inf
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
    
    const totalNumBatches = Math.ceil(trainData.xs.shape[0] / batchSize) * trainEpochs;

    // 学习率调度：监控验证MAE，防止后期训练不稳定
    let lastBestValAcc = Infinity; // 对于MAE，越小越好
    let patienceCounter = 0;
    const patience = 3;
    const lrDecayFactor = 0.5;
    let currentLearningRate = model.params.learningRate;

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
                
                // 添加详细的调试信息（只在第一个batch打印）
                if (batch === 0) {
                    console.log(`Batch ${batch} - logs keys:`, Object.keys(logs));
                    console.log(`Batch ${batch} - logs values:`, logs);
                    console.log(`Batch ${batch} - isTimeSeries: true, looking for MAE`);
                }
                
                // 对于时序数据，显示MAE
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
                const maeValue = (typeof mae === "number" && !isNaN(mae) && isFinite(mae)) ? mae : 0;
                accBox.children[1].innerHTML = String(Number(maeValue.toFixed(4)));
                
                // 显示损失值
                const lossValue = (typeof logs.loss === "number" && !isNaN(logs.loss) && isFinite(logs.loss)) ? logs.loss : 0;
                if (batch === 0) {
                    console.log(`Batch ${batch} - Loss value:`, lossValue, "logs.loss:", logs.loss, "type:", typeof logs.loss);
                    if (lossValue === 0 || !isFinite(lossValue)) {
                        console.warn(`Batch ${batch} - Loss is 0 or invalid. This may indicate a training problem.`);
                    }
                }
                lossBox.children[1].innerHTML = String(Number(lossValue.toFixed(4)));
                trainBox.children[1].innerHTML = String((trainBatchCount / totalNumBatches * 100).toFixed(1) + "%");
                
                // 确保loss是有效数字
                const validLoss = (typeof logs.loss === "number" && !isNaN(logs.loss) && isFinite(logs.loss) && logs.loss > 0) ? logs.loss : null;
                
                // 对于时序数据，检查损失值是否合理
                if (validLoss !== null) {
                    if (validLoss > 1000) {
                        console.warn(`警告：损失值异常大 (${validLoss})，可能是学习率过大或数据未归一化`);
                    } else if (validLoss < 1e-10) {
                        console.warn(`警告：损失值异常小 (${validLoss})，可能是模型已收敛或出现问题`);
                    }
                }
                
                // 获取MAE值（用于累积）
                let maeValueForAccum: number | null = null;
                let maeForAccum = logs.mae;
                if (maeForAccum === undefined || maeForAccum === null) {
                    maeForAccum = (logs as any).metric_0;
                }
                if (maeForAccum === undefined || maeForAccum === null) {
                    const logKeys = Object.keys(logs);
                    const maeKey = logKeys.find(key => key.toLowerCase().includes('mae') || key === 'metric_0');
                    if (maeKey) {
                        maeForAccum = (logs as any)[maeKey];
                    }
                }
                if (typeof maeForAccum === "number" && !isNaN(maeForAccum) && isFinite(maeForAccum)) {
                    maeValueForAccum = maeForAccum;
                }
                
                // 累积值（只累积有效值）
                if (validLoss !== null) {
                    totalLoss += validLoss;
                } else if (batch === 0) {
                    console.warn(`Batch ${batch} - Invalid loss:`, logs.loss, "type:", typeof logs.loss);
                }
                
                if (maeValueForAccum !== null) {
                    totalAccuracy += maeValueForAccum;
                }
                
                // 对于时序数据，每个batch都绘制
                const shouldPlot = trainBatchCount > prevTrainBatchCount;
                
                if (shouldPlot) {
                    const batchCount = trainBatchCount - prevTrainBatchCount;
                    const avgLoss = batchCount > 0 ? totalLoss / batchCount : validLoss || 0;
                    const avgMetric = batchCount > 0 ? totalAccuracy / batchCount : (maeValueForAccum || 0);
                    
                    if (batch % 50 === 0) {
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
                }
                
                if (trainingHistory) {
                    const batchMetric: IBatchMetric = {
                        batch: trainBatchCount,
                        loss: validLoss !== null ? Number(validLoss.toFixed(4)) : null,
                        accuracy: maeValueForAccum !== null ? Number(maeValueForAccum.toFixed(4)) : null,
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
                model.architecture.resetStates();

                // 获取验证集MAE
                const logKeys = Object.keys(logs);
                let valMaeKey = logKeys.find(key => 
                    key === 'val_mae' ||
                    key === 'val_metric_0' ||
                    key.startsWith('val_metric_')
                );
                if (!valMaeKey) {
                    valMaeKey = logKeys.find(key => 
                        key.toLowerCase().includes('mae') && key.toLowerCase().includes('val')
                    );
                }
                let valMetric = valMaeKey ? ((logs as any)[valMaeKey] || 0) : 0;
                
                // 如果找不到，尝试手动计算验证集MAE
                if (!valMaeKey || valMetric === 0) {
                    if (logKeys.length > 0) {
                        console.log("Epoch", epoch + 1, "- Validation MAE not found or is 0, available keys:", logKeys);
                    }
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
                
                // 获取验证集损失值，如果无效则手动计算
                let valLoss = logs.val_loss;
                let valLossValue: number;
                
                if (typeof valLoss !== "number" || isNaN(valLoss) || !isFinite(valLoss)) {
                    if (validationData) {
                        try {
                            const valPredictions = model.architecture.predict(validationData.xs) as tf.Tensor;
                            if (loss === "meanSquaredError") {
                                valLoss = tf.losses.meanSquaredError(validationData.ys, valPredictions).dataSync()[0];
                            } else if (loss === "meanAbsoluteError") {
                                valLoss = tf.losses.absoluteDifference(validationData.ys, valPredictions).dataSync()[0];
                            } else {
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
                
                accBox.children[1].innerHTML = String(Number((valMetric || 0).toFixed(4)));
                lossBox.children[1].innerHTML = String(Number(valLossValue.toFixed(4)));
                
                // 绘制验证集loss和MAE
                if (valLossValue > 0 && isFinite(valLossValue)) {
                    plotLoss(trainBatchCount, valLossValue, "validation");
                }
                if (valMetric !== undefined && valMetric !== null && valMetric >= 0 && isFinite(valMetric)) {
                    plotAccuracy(trainBatchCount, valMetric, "validation");
                }
                
                // 对于时序数据，隐藏混淆矩阵
                const confusionMatrixElement = document.getElementById("confusion-matrix-canvas");
                if (confusionMatrixElement) {
                    confusionMatrixElement.style.display = "none";
                }
                
                onIteration();
                
                // 记录训练历史数据
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

                // 学习率调度：如果验证MAE不再降低，建议降低学习率
                const isBetter = valMetric < lastBestValAcc; // MAE越小越好
                if (isBetter) {
                    lastBestValAcc = valMetric;
                    patienceCounter = 0;
                } else {
                    patienceCounter++;
                    if (patienceCounter >= patience && currentLearningRate > 1e-6) {
                        currentLearningRate *= lrDecayFactor;
                        console.log(`建议降低学习率至: ${currentLearningRate} (当前验证MAE: ${valMetric.toFixed(4)})`);
                        patienceCounter = 0;
                    }
                }

                await tf.nextFrame();
            },
        },
        validationData,
    };
    
    // ==================== 8. 开始训练 ====================
    await model.architecture.fit(trainData.xs, trainData.labels, fitOptions);

    // 评估测试集
    const testResult = model.architecture.evaluate(testData.xs, testData.labels) as Array<tf.Tensor<tf.Rank.R0>>;
    let testLoss = testResult[0].dataSync()[0];
    let testMetric = testResult[1].dataSync()[0];
    
    // 检查值是否有效
    if (!isFinite(testLoss) || isNaN(testLoss)) {
        console.error("测试集损失值为NaN或Inf，尝试手动计算");
        const predictions = model.architecture.predict(testData.xs) as tf.Tensor;
        const labels = testData.labels;
        if (loss === "meanSquaredError") {
            testLoss = tf.losses.meanSquaredError(labels, predictions).dataSync()[0];
        } else if (loss === "meanAbsoluteError") {
            testLoss = tf.losses.absoluteDifference(labels, predictions).dataSync()[0];
        }
        predictions.dispose();
    }
    
    if (!isFinite(testMetric) || isNaN(testMetric)) {
        console.error("测试集MAE指标值为NaN或Inf，尝试手动计算");
        const predictions = model.architecture.predict(testData.xs) as tf.Tensor;
        const labels = testData.labels;
        testMetric = tf.losses.absoluteDifference(labels, predictions).dataSync()[0];
        predictions.dispose();
    }
    
    console.log("测试集评估结果 - Loss:", testLoss, "Metric:", testMetric);
    
    const vaccBox = document.getElementById("ti_vacc");
    const vlossBox = document.getElementById("ti_vloss");
    
    const testLossValue = Number(testLoss.toFixed(4));
    const testMetricValue = Number(testMetric.toFixed(4));
    
    // 显示测试集结果
    vaccBox.children[1].innerHTML = String(testMetricValue);
    vlossBox.children[1].innerHTML = String(testLossValue);
    
    // 添加控制台说明
    if (model.params.loss === "meanAbsoluteError") {
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
        const validationDataForViz = (dataset as AirPassengersData).getValidationData();
        renderTimeSeriesPredictions(testData, validationDataForViz, dataset as AirPassengersData);
    } else {
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
        const validationDataForViz = (dataset as AirPassengersData).getValidationData();
        renderTimeSeriesPredictions(testData, validationDataForViz, dataset as AirPassengersData);
    }
    
    if (trainingHistory) {
        trainingHistory.testMetrics = {
            accuracy: Number(testMetric.toFixed(4)),
            loss: Number(testLoss.toFixed(4)),
        };
        trainingHistory.finishedAt = new Date().toISOString();
    }
    
    // 训练完成后释放内存
    tf.dispose([valXs, valLabels, trainXs, trainLabels]);
    console.log("已释放临时Tensor内存");
}

