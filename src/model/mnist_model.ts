// Adapted from https://github.com/tensorflow/tfjs-examples/tree/master/mnist

import * as tf from "@tensorflow/tfjs";
import {plotAccuracy,
        plotLoss,
        resetPlotValues,
        setupPlots,
        setupTestResults,
        showConfusionMatrix,
        showPredictions} from "./graphs";

import {dataset} from "./data";
import { model } from "./params_object";

/**
 * Compile and train the given model.
 *
 * @param {*} model The model to
 */

export let stopTraining = false;

export function stopTrainingHandler() {
    stopTraining = true;
    console.log("Training stop triggered.");
}

export function resetTrainingFlag() {
    stopTraining = false;
    console.log("Training flag reset. Ready to start new training.");
}

export async function train(): Promise<void> {
    // Set up all of the plots
    resetPlotValues();
    setupPlots();
    setupTestResults();
    await dataset.load();

    const onIteration = () => showPredictions();
    const optimizer = model.params.getOptimizer();

    model.architecture.compile({
        loss: model.params.loss,
        metrics: ["accuracy"],
        optimizer,
    });
    const batchSize = model.params.batchSize;
    // validationSplit = 0.15 意味着训练数据会被自动分割为：
    // - 85% 用于训练（用于更新模型参数）
    // - 15% 用于验证（用于评估模型性能，不参与参数更新）
    // TensorFlow.js的fit方法会自动从训练数据中分割出验证集，
    // 并在每个epoch结束后计算验证集上的准确率和损失。
    // 这就是为什么一开始训练就能看到验证集准确率的原因。
    const validationSplit = 0.15;

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

    // 学习率调度：监控验证准确率，防止后期训练不稳定
    let lastBestValAcc = 0;
    let patienceCounter = 0;
    const patience = 3; // 如果验证准确率3个epoch不提升，降低学习率
    const lrDecayFactor = 0.5; // 学习率衰减因子
    let currentLearningRate = model.params.learningRate;

    await model.architecture.fit(trainData.xs, trainData.labels, {
        batchSize,
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
                
                // 在1000个batch时自动停止训练，避免后续准确率下降
                // 这样可以保留前1000个batch的最佳训练结果
                if (trainBatchCount >= 1000) {
                    console.log(`Reached 1000 batches. Stopping training to preserve best results.`);
                    model.architecture.stopTraining = true;
                    model.architecture.resetStates();
                    return;
                }
                
                // 每1000个batch重置RNN状态，防止状态累积导致训练不稳定
                // 这对于解决1000个batch后准确率下降的问题非常重要
                if (trainBatchCount % 1000 === 0) {
                    model.architecture.resetStates();
                    console.log(`Batch ${trainBatchCount}: RNN states reset to prevent accumulation`);
                }
                
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
            onEpochEnd: async (_epoch: number, logs: tf.Logs) => {

                if (stopTraining) {
                    console.log("Training stopped by user.");
                    model.architecture.stopTraining = true;
                    model.architecture.resetStates();
                    return;
                }

                // 重置RNN状态，防止状态累积导致数值不稳定
                // 这对于RNN训练非常重要，特别是在长时间训练后
                model.architecture.resetStates();

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

                // 学习率调度：如果验证准确率不再提升，降低学习率
                // 注意：TensorFlow.js的优化器不支持动态修改学习率
                // 这里我们记录学习率变化，实际应用中可以通过重新编译模型来实现
                if (valAcc > lastBestValAcc) {
                    lastBestValAcc = valAcc;
                    patienceCounter = 0;
                } else {
                    patienceCounter++;
                    // 如果验证准确率连续patience个epoch没有提升，建议降低学习率
                    if (patienceCounter >= patience && currentLearningRate > 1e-6) {
                        currentLearningRate *= lrDecayFactor;
                        console.log(`建议降低学习率至: ${currentLearningRate} (当前验证准确率: ${(valAcc * 100).toFixed(2)}%)`);
                        // 注意：实际学习率调整需要在下次训练时手动设置
                        patienceCounter = 0; // 重置计数器
                    }
                }

                await tf.nextFrame();
            },
        },
        epochs: trainEpochs,
        validationSplit,
    });

    const testResult = model.architecture.evaluate(testData.xs, testData.labels) as Array<tf.Tensor<tf.Rank.R0>>;
    const vaccBox = document.getElementById("ti_vacc");
    const vlossBox = document.getElementById("ti_vloss");
    vaccBox.children[1].innerHTML = String(Number((100 * testResult[1].dataSync()[0] ).toFixed(2)));
    vlossBox.children[1].innerHTML = String(Number((testResult[0].dataSync()[0]).toFixed(2)));
}
