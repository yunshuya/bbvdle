import * as tf from "@tensorflow/tfjs";
import * as tfvis from "@tensorflow/tfjs-vis";
import { tabSelected } from "../ui/app";
import { dataset, AirPassengersData } from "./data";
import { model } from "./params_object";

const GRAPH_FONT_SIZE: number = 14;
const NUM_CLASSES: number = 10;

const testExamples: number = 50;

/**
 * Show predictions on a number of test examples.
 */
export async function showPredictions(): Promise<void> {
  if (tabSelected() === "visualizationTab" && dataset.dataLoaded) {
    // 对于时序数据，显示预测结果可视化（包括验证集和测试集）
    if (dataset instanceof AirPassengersData) {
      // 清理分类结果显示（images元素中的长框框）
      const imagesElement = document.getElementById("images");
      if (imagesElement) {
        imagesElement.innerHTML = "";
        imagesElement.style.display = "none";
      }
      
      // 清理visulaization元素（注意：HTML中有拼写错误）
      const visulaizationElement = document.getElementById("visulaization");
      if (visulaizationElement) {
        visulaizationElement.innerHTML = "";
      }
      
      // 清理旧的时序预测结果容器（如果存在）
      const existingContainer = document.getElementById("time-series-predictions-container");
      if (existingContainer) {
        existingContainer.remove();
      }
      
      const testData = dataset.getTestData();
      const validationData = dataset.getValidationData();
      renderTimeSeriesPredictions(testData, validationData, dataset);
      return;
    }
    
    // 对于分类数据，使用原有的逻辑
    // 显示images元素
    const imagesElement = document.getElementById("images");
    if (imagesElement) {
      imagesElement.style.display = "grid";
    }
    
    // 清理旧的时序预测结果容器（如果存在）
    const existingContainer = document.getElementById("time-series-predictions-container");
    if (existingContainer) {
      existingContainer.remove();
    }
    
    let label: string = null;
    const classesElement = document.getElementById("classes");
    if (classesElement) {
      const options = classesElement.getElementsByClassName("option");
      for (const option of options) {
          if (option.classList.contains("selected")) {
              label = option.getAttribute("data-optionValue");
              break;
          }
      }
    }

    dataset.getTestDataWithLabel(testExamples, label).then(({xs, labels}) => {
      // Code wrapped in a tf.tidy() function callback will have their tensors freed
      // from GPU memory after execution without having to call dispose().
      // The tf.tidy callback runs synchronously.
      tf.tidy(() => {
        const output = model.architecture.predict(xs) as tf.Tensor<tf.Rank.R1>;

        // tf.argMax() returns the indices of the maximum values in the tensor along
        // a specific axis. Categorical classification tasks like this one often
        // represent classes as one-hot vectors. One-hot vectors are 1D vectors with
        // one element for each output class. All values in the vector are 0
        // except for one, which has a value of 1 (e.g. [0, 0, 0, 1, 0]). The
        // output from model.predict() will be a probability distribution, so we use
        // argMax to get the index of the vector element that has the highest
        // probability. This is our prediction.
        // (e.g. argmax([0.07, 0.1, 0.03, 0.75, 0.05]) == 3)
        // dataSync() synchronously downloads the tf.tensor values from the GPU so
        // that we can use them in our normal CPU JavaScript code
        // (for a non-blocking version of this function, use data()).
        const axis = 1;
        const newLabels = Array.from(labels.argMax(axis).dataSync());
        const predictions = Array.from(output.argMax(axis).dataSync());

        showTestResults({xs, labels}, predictions, newLabels);
      });
    });
  }
}

// TOOD: Remove this peice of problematic global state.
let confusionValues: any = [];
for (let i = 0; i < NUM_CLASSES; i++) {
  const arr = new Array(NUM_CLASSES);
  arr.fill(0, 0, NUM_CLASSES);
  confusionValues.push(arr);
}

export function showConfusionMatrix(): void {
  if (tabSelected() === "progressTab" && dataset.dataLoaded) {
    const {xs, labels} = dataset.getTestData(1000);
    tf.tidy(() => {
      const output = model.architecture.predict(xs) as tf.Tensor<tf.Rank.R1>;

      const fixedLabels = labels.argMax(1) as tf.Tensor<tf.Rank.R1>;
      const predictions = output.argMax(1) as tf.Tensor<tf.Rank.R1>;

      tfvis.metrics.confusionMatrix(fixedLabels, predictions, NUM_CLASSES).then((confusionVals) => {
        confusionValues = confusionVals;
        renderConfusionMatrix();
      });

    });
  }

}

export function setupTestResults(): void {
  const imagesElement = document.getElementById("images");
  imagesElement.innerHTML = "";
  for (let i = 0; i < testExamples; i++) {
    const div = document.createElement("div");
    div.className = "pred-container";

    const canvas = document.createElement("canvas");
    canvas.width = dataset.IMAGE_WIDTH;
    canvas.height = dataset.IMAGE_HEIGHT;
    canvas.className = "prediction-canvas";
    const ctx = canvas.getContext("2d");
    ctx.rect(0, 0, 1000, 5000);
    ctx.fillStyle = "#888";
    ctx.fill();

    const pred = document.createElement("div");
    pred.className = `pred pred-none`;
    pred.innerText = `pred: -`;

    div.appendChild(pred);
    div.appendChild(canvas);

    imagesElement.appendChild(div);
  }
}

export function showTestResults(batch: {xs: tf.Tensor<tf.Rank.R4>, labels: tf.Tensor<tf.Rank.R2>},
                                predictions: number[],
                                labels: number[]): void {
  const imagesElement = document.getElementById("images");
  imagesElement.innerHTML = "";
  for (let i = 0; i < testExamples; i++) {
    const image = batch.xs.slice([i, 0], [1, batch.xs.shape[1]]);

    const div = document.createElement("div");
    div.className = "pred-container";

    const canvas = document.createElement("canvas");
    canvas.className = "prediction-canvas";
    draw(image.flatten(), canvas);

    const pred = document.createElement("div");

    const prediction = predictions[i];
    const label = labels[i];
    const correct = prediction === label;

    pred.className = `pred ${(correct ? "pred-correct" : "pred-incorrect")}`;
    pred.innerText = `pred: ${prediction}`;

    div.appendChild(pred);
    div.appendChild(canvas);

    imagesElement.appendChild(div);
  }
}

// TOOD: Remove this piece of problematic global state.
let lossValues: Array<Array<{x: number, y: number}>> = [[], []];
export function plotLoss(batchNum: number, loss: number, set: string): void {
  const series = set === "train" ? 0 : 1;
  // Set the first validation loss as the first training loss
  if (series === 0 && lossValues[1].length === 0) {
    lossValues[1].push({x: batchNum, y: loss});
  }
  lossValues[series].push({x: batchNum, y: loss});
  if (tabSelected() === "progressTab") {
    renderLossPlot();
  }
}

export function renderLossPlot(): void {
  const lossContainer = document.getElementById("loss-canvas");
  
  // 检测是否为时序数据（回归任务）
  const isTimeSeries = dataset instanceof AirPassengersData;
  
  // 确定y轴标签
  let yLabel: string;
  if (isTimeSeries) {
    // 对于时序数据，根据损失函数类型显示对应的标签
    const lossFunction = model.params.loss;
    if (lossFunction === "meanAbsoluteError") {
      yLabel = "MAE (损失)";
    } else {
      // 默认使用MSE
      yLabel = "MSE";
    }
  } else {
    // 对于分类数据，显示通用的"Loss"
    yLabel = "Loss";
  }
  
  tfvis.render.linechart(
      {values: lossValues, series: ["train", "validation"]}, lossContainer, {
        xLabel: "Batch #",
        yLabel: yLabel,  // tslint:disable-next-line: object-literal-sort-keys
        width: canvasWidth() / 2,
        height: canvasHeight() / 2,
        fontSize: GRAPH_FONT_SIZE,
      });
}

export function resetPlotValues(): void {
  // set initial accuracy values to 0,0 for validation
  accuracyValues = [[], [{x: 0, y: 0}]];
  lossValues = [[], []];
}

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
  
  // 检测是否为时序数据（回归任务）
  const isTimeSeries = dataset instanceof AirPassengersData;
  
  // 构建配置对象
  const config: any = {
    xLabel: "Batch #",
    width: canvasWidth() / 2,
    height: canvasHeight() / 2,
    fontSize: GRAPH_FONT_SIZE,
  };
  
  if (isTimeSeries) {
    // 时序数据：显示MAE，移除固定y轴范围（因为MAE反归一化后可能远大于1）
    config.yLabel = "MAE (乘客数)";
    // 不设置yAxisDomain，让图表自动适配范围
  } else {
    // 分类数据：显示准确率，固定y轴范围为[0, 1]
    config.yLabel = "Accuracy";
    config.yAxisDomain = [0, 1];
  }
  
  tfvis.render.linechart(
      {values: accuracyValues, series: ["train", "validation"]},
      accuracyContainer,
      config);
}

function renderConfusionMatrix(): void {
  const confusionMatrixElement = document.getElementById("confusion-matrix-canvas");
  tfvis.render.confusionMatrix({
    labels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    values: confusionValues ,
  }, confusionMatrixElement, {
    fontSize: GRAPH_FONT_SIZE,
    shadeDiagonal: false,
  });
}

function canvasWidth(): number {
  const columnGap = parseInt(getComputedStyle(document.getElementById("progressTab")).gridColumnGap, 10);
  return document.getElementById("middle").clientWidth - columnGap;
}

function canvasHeight(): number {
  const verticalPadding = parseInt(getComputedStyle(document.getElementById("progressTab")).padding, 10);
  const height = document.getElementById("middle").clientHeight - 2 * verticalPadding;
  return height;
}

export function setupPlots(): void {
  renderLossPlot();
  renderAccuracyPlot();
  
  // 检测是否为时序数据
  const isTimeSeries = dataset instanceof AirPassengersData;
  if (!isTimeSeries) {
    // 分类数据：显示混淆矩阵
    renderConfusionMatrix();
    const confusionMatrixElement = document.getElementById("confusion-matrix-canvas");
    if (confusionMatrixElement) {
      confusionMatrixElement.style.display = "block";
    }
    // 隐藏验证集和测试集指标图表
    const metricsCanvas = document.getElementById("validation-test-metrics-canvas");
    if (metricsCanvas) {
      metricsCanvas.style.display = "none";
    }
  } else {
    // 时序数据：隐藏混淆矩阵，显示验证集和测试集指标图表（训练完成后会显示）
    const confusionMatrixElement = document.getElementById("confusion-matrix-canvas");
    if (confusionMatrixElement) {
      confusionMatrixElement.style.display = "none";
    }
    const metricsCanvas = document.getElementById("validation-test-metrics-canvas");
    if (metricsCanvas) {
      metricsCanvas.style.display = "none"; // 训练完成后会显示
    }
  }
}

/**
 * 在visualization界面渲染时序数据的真实值和预测值对比图（仅用于时序数据）
 * 此函数已被弃用，现在使用 renderTimeSeriesPredictions 在 visualization 页面显示
 * @deprecated 使用 renderTimeSeriesPredictions 代替
 */
export function renderTimeSeriesPredictionsInProgress(
    testData: {xs: tf.Tensor, labels: tf.Tensor},
    airPassengersData: AirPassengersData
): void {
    // 直接调用 renderTimeSeriesPredictions，在 visualization 页面显示
    // 需要获取验证集数据
    const validationData = airPassengersData.getValidationData();
    renderTimeSeriesPredictions(testData, validationData, airPassengersData);
    return;
    
    // 以下代码已不再使用，保留用于参考
    const container = document.getElementById("validation-test-metrics-canvas");
    if (!container) {
        console.warn("找不到validation-test-metrics-canvas容器");
        return;
    }

    // 检测是否为时序数据
    const isTimeSeries = dataset instanceof AirPassengersData;
    if (!isTimeSeries) {
        // 非时序数据，隐藏容器
        container.style.display = "none";
        return;
    }

    // 显示容器并清空之前的内容（防止显示旧的MSE/MAE图表）
    container.style.display = "block";
    container.innerHTML = ""; // 清空容器，移除任何旧的图表
    
    try {
        // 使用tf.tidy自动管理Tensor内存
        const {trueValuesNormalized, predValuesNormalized} = tf.tidy(() => {
            // 在测试集上进行预测
            const predictions = model.architecture.predict(testData.xs) as tf.Tensor;
            
            // 获取真实值和预测值（归一化的）
            const trueValuesNormalized = Array.from(testData.labels.dataSync());
            let predValuesRaw: number[];
            
            // 处理预测值的shape
            if (predictions.shape.length === 2) {
                predValuesRaw = Array.from(predictions.dataSync());
            } else if (predictions.shape.length === 1) {
                predValuesRaw = Array.from(predictions.dataSync());
            } else {
                const reshaped = predictions.reshape([-1]);
                predValuesRaw = Array.from(reshaped.dataSync());
            }
            
            // 确保长度一致
            const minLength = Math.min(trueValuesNormalized.length, predValuesRaw.length);
            const trueValuesNorm = trueValuesNormalized.slice(0, minLength);
            const predValuesNorm = predValuesRaw.slice(0, minLength);
            
            return {
                trueValuesNormalized: trueValuesNorm,
                predValuesNormalized: predValuesNorm
            };
        });
        
        // 反归一化
        const trueValues = trueValuesNormalized.map(v => airPassengersData.denormalize(v));
        const predValues = predValuesNormalized.map(v => airPassengersData.denormalize(v));
        
        // 获取时间范围
        const timeRange = airPassengersData.getTestDataTimeRange();
        const timeIndices: number[] = [];
        for (let i = 0; i < trueValues.length; i++) {
            timeIndices.push(timeRange.start + i);
        }
        
        // 准备可视化数据
        const trueData = timeIndices.map((t, i) => ({x: t, y: trueValues[i]}));
        const predData = timeIndices.map((t, i) => ({x: t, y: predValues[i]}));
        
        // 使用tfvis渲染折线图
        // 占据整个右侧区域，显示真实值和预测值的对比
        tfvis.render.linechart(
            {
                values: [trueData, predData],
                series: ["真实值", "预测值"]
            },
            container,
            {
                xLabel: "时间（月份索引）",
                yLabel: "乘客数量",
                width: canvasWidth() / 2,
                height: canvasHeight(),
                fontSize: GRAPH_FONT_SIZE,
                zoomToFit: true,
            }
        );
        
        // 打印统计信息
        const mae = trueValues.reduce((sum, val, i) => sum + Math.abs(val - predValues[i]), 0) / trueValues.length;
        const mse = trueValues.reduce((sum, val, i) => sum + Math.pow(val - predValues[i], 2), 0) / trueValues.length;
        const rmse = Math.sqrt(mse);
        
        console.log("Progress界面 - 测试集预测结果:");
        console.log(`MAE: ${mae.toFixed(2)}, RMSE: ${rmse.toFixed(2)}`);
        
    } catch (error) {
        console.error("渲染真实值和预测值对比图时出错:", error);
    }
}

/**
 * 为时序数据渲染预测结果可视化
 * 横坐标：时间（月份索引）
 * 纵坐标：值（乘客数量）
 * 包括：验证集和测试集的真实值和预测值
 */
export function renderTimeSeriesPredictions(
    testData: {xs: tf.Tensor, labels: tf.Tensor},
    validationData: {xs: tf.Tensor, labels: tf.Tensor},
    airPassengersData: AirPassengersData
): void {
    console.log("renderTimeSeriesPredictions 被调用");
    console.log("testData:", testData, "validationData:", validationData, "airPassengersData:", airPassengersData);
    
    if (!airPassengersData) {
        console.error("AirPassengersData 参数无效");
        return;
    }
    
    if (!model || !model.architecture) {
        console.error("模型尚未初始化，无法进行预测");
        return;
    }
    
    try {
        // 使用tf.tidy自动管理Tensor内存，确保所有中间Tensor被正确释放
        // 同时获取训练集的预测结果，用于完整序列可视化
        const {testTrueValuesNorm, testPredValuesNorm, valTrueValuesNorm, valPredValuesNorm, trainTrueValuesNorm, trainPredValuesNorm} = tf.tidy(() => {
            // 在测试集上进行预测
            const testPredictions = model.architecture.predict(testData.xs) as tf.Tensor;
            
            // 在验证集上进行预测
            const valPredictions = model.architecture.predict(validationData.xs) as tf.Tensor;
            
            // 获取训练集数据（不包括验证集部分）
            const trainData = airPassengersData.getTrainData();
            const totalTrainSamples = trainData.xs.shape[0];
            const valSize = Math.floor(totalTrainSamples * 0.15);
            const trainSize = totalTrainSamples - valSize;
            
            // 训练集：使用前85%（不包括验证集）
            const trainXs = (trainData.xs as tf.Tensor<tf.Rank.R3>).slice([0, 0, 0], [trainSize, trainData.xs.shape[1], trainData.xs.shape[2]]) as tf.Tensor<tf.Rank.R3>;
            const trainLabels = (trainData.labels as tf.Tensor<tf.Rank.R2>).slice([0, 0], [trainSize, trainData.labels.shape[1]]) as tf.Tensor<tf.Rank.R2>;
            
            // 在训练集上进行预测
            const trainPredictions = model.architecture.predict(trainXs) as tf.Tensor;
            
            console.log("测试集预测tensor shape:", testPredictions.shape);
            console.log("验证集预测tensor shape:", valPredictions.shape);
            console.log("训练集预测tensor shape:", trainPredictions.shape);
            
            // 处理测试集的预测值
            const testTrueValuesNormalized = Array.from(testData.labels.dataSync());
            let testPredValuesRaw: number[];
            if (testPredictions.shape.length === 2) {
                testPredValuesRaw = Array.from(testPredictions.dataSync());
            } else if (testPredictions.shape.length === 1) {
                testPredValuesRaw = Array.from(testPredictions.dataSync());
            } else {
                const reshaped = testPredictions.reshape([-1]);
                testPredValuesRaw = Array.from(reshaped.dataSync());
            }
            const testMinLength = Math.min(testTrueValuesNormalized.length, testPredValuesRaw.length);
            const testTrueValuesNorm = testTrueValuesNormalized.slice(0, testMinLength);
            const testPredValuesNorm = testPredValuesRaw.slice(0, testMinLength);
            
            // 处理验证集的预测值
            const valTrueValuesNormalized = Array.from(validationData.labels.dataSync());
            let valPredValuesRaw: number[];
            if (valPredictions.shape.length === 2) {
                valPredValuesRaw = Array.from(valPredictions.dataSync());
            } else if (valPredictions.shape.length === 1) {
                valPredValuesRaw = Array.from(valPredictions.dataSync());
            } else {
                const reshaped = valPredictions.reshape([-1]);
                valPredValuesRaw = Array.from(reshaped.dataSync());
            }
            const valMinLength = Math.min(valTrueValuesNormalized.length, valPredValuesRaw.length);
            const valTrueValuesNorm = valTrueValuesNormalized.slice(0, valMinLength);
            const valPredValuesNorm = valPredValuesRaw.slice(0, valMinLength);
            
            // 处理训练集的预测值
            const trainTrueValuesNormalized = Array.from(trainLabels.dataSync());
            let trainPredValuesRaw: number[];
            if (trainPredictions.shape.length === 2) {
                trainPredValuesRaw = Array.from(trainPredictions.dataSync());
            } else if (trainPredictions.shape.length === 1) {
                trainPredValuesRaw = Array.from(trainPredictions.dataSync());
            } else {
                const reshaped = trainPredictions.reshape([-1]);
                trainPredValuesRaw = Array.from(reshaped.dataSync());
            }
            const trainMinLength = Math.min(trainTrueValuesNormalized.length, trainPredValuesRaw.length);
            const trainTrueValuesNorm = trainTrueValuesNormalized.slice(0, trainMinLength);
            const trainPredValuesNorm = trainPredValuesRaw.slice(0, trainMinLength);
            
            // 释放临时Tensor
            trainXs.dispose();
            trainLabels.dispose();
            trainPredictions.dispose();
            
            // 返回提取的数据
            return {
                testTrueValuesNorm,
                testPredValuesNorm,
                valTrueValuesNorm,
                valPredValuesNorm,
                trainTrueValuesNorm,
                trainPredValuesNorm
            };
        });
        
        // 反归一化测试集数据
        const testTrueValues = testTrueValuesNorm.map(v => airPassengersData.denormalize(v));
        const testPredValues = testPredValuesNorm.map(v => airPassengersData.denormalize(v));
        
        // 反归一化验证集数据
        const valTrueValues = valTrueValuesNorm.map(v => airPassengersData.denormalize(v));
        const valPredValues = valPredValuesNorm.map(v => airPassengersData.denormalize(v));
        
        // 反归一化训练集数据
        const trainTrueValues = trainTrueValuesNorm.map(v => airPassengersData.denormalize(v));
        const trainPredValues = trainPredValuesNorm.map(v => airPassengersData.denormalize(v));
        
        // 获取时间范围
        const testTimeRange = airPassengersData.getTestDataTimeRange();
        const valTimeRange = airPassengersData.getValidationDataTimeRange();
        
        // 计算训练集的时间范围（从0开始到验证集之前）
        const timeSteps = airPassengersData.getTimeSteps();
        
        // 训练集的第一个序列对应的原始数据索引
        const trainStartIndex = timeSteps; // 第一个序列从timeSteps开始
        
        // 准备训练集可视化数据
        const trainTimeIndices: number[] = [];
        for (let i = 0; i < trainTrueValues.length; i++) {
            trainTimeIndices.push(trainStartIndex + i);
        }
        const trainTrueData = trainTimeIndices.map((t, i) => ({x: t, y: trainTrueValues[i]}));
        
        // 准备验证集可视化数据（需要在完整序列之前定义）
        const valTimeIndices: number[] = [];
        for (let i = 0; i < valTrueValues.length; i++) {
            valTimeIndices.push(valTimeRange.start + i);
        }
        const valTrueData = valTimeIndices.map((t, i) => ({x: t, y: valTrueValues[i]}));
        
        // 准备测试集可视化数据
        const testTimeIndices: number[] = [];
        for (let i = 0; i < testTrueValues.length; i++) {
            testTimeIndices.push(testTimeRange.start + i);
        }
        const testTrueData = testTimeIndices.map((t, i) => ({x: t, y: testTrueValues[i]}));
        // testPredData暂时未使用（Test Set Only图表已注释）
        // const testPredData = testTimeIndices.map((t, i) => ({x: t, y: testPredValues[i]}));
        
        // 准备完整序列数据（训练集+验证集+测试集）
        // 注意：验证集是训练集的一部分，需要包含在完整序列中
        // 但是，验证集的最后一个目标值索引是119，测试集的第一个目标值索引是132
        // 中间120-131的数据是测试集第一个序列的输入数据，不是目标值
        // 为了完整显示，我们需要检查是否有间隙，如果有，需要填充原始数据
        
        // 检查验证集和测试集之间是否有间隙
        const valLastIndex = valTimeIndices.length > 0 ? valTimeIndices[valTimeIndices.length - 1] : (trainTimeIndices.length > 0 ? trainTimeIndices[trainTimeIndices.length - 1] : 0);
        const testFirstIndex = testTimeIndices.length > 0 ? testTimeIndices[0] : valLastIndex + 1;
        const gapStart = valLastIndex + 1;
        const gapEnd = testFirstIndex - 1;
        
        // 如果有间隙（gapEnd >= gapStart），填充原始数据
        let gapActualValues: number[] = [];
        let gapPredValues: number[] = [];
        let gapTimeIndices: number[] = [];
        
        if (gapEnd >= gapStart) {
            // 获取原始数据来填充间隙
            const rawData = airPassengersData.getRawData();
            for (let i = gapStart; i <= gapEnd; i++) {
                if (i < rawData.length) {
                    gapActualValues.push(rawData[i]);
                    // 对于间隙部分，预测值使用NaN或null（因为模型没有预测这些点）
                    gapPredValues.push(NaN);
                    gapTimeIndices.push(i);
                }
            }
            console.log(`检测到数据间隙: ${gapStart}-${gapEnd}，填充了${gapActualValues.length}个原始数据点`);
        }
        
        // 合并所有数据：训练集 + 验证集 + 间隙原始数据 + 测试集
        const fullActual = [...trainTrueValues, ...valTrueValues, ...gapActualValues, ...testTrueValues];
        const fullPred = [...trainPredValues, ...valPredValues, ...gapPredValues, ...testPredValues];
        const fullTimeIndices = [...trainTimeIndices, ...valTimeIndices, ...gapTimeIndices, ...testTimeIndices];
        
        // 过滤掉NaN值（对于可视化，我们可以保留NaN，但图表库可能不支持）
        // 或者我们可以用前一个值或线性插值来填充
        const fullActualData = fullTimeIndices.map((t, i) => ({x: t, y: fullActual[i]}));
        const fullPredData = fullTimeIndices.map((t, i) => {
            // 如果预测值是NaN，使用前一个非NaN值（如果有）
            let predValue = fullPred[i];
            if (isNaN(predValue)) {
                // 向前查找最近的非NaN值
                for (let j = i - 1; j >= 0; j--) {
                    if (!isNaN(fullPred[j])) {
                        predValue = fullPred[j];
                        break;
                    }
                }
                // 如果找不到，向后查找
                if (isNaN(predValue)) {
                    for (let j = i + 1; j < fullPred.length; j++) {
                        if (!isNaN(fullPred[j])) {
                            predValue = fullPred[j];
                            break;
                        }
                    }
                }
            }
            return {x: t, y: predValue};
        });
        
        console.log("训练集数据准备完成:");
        console.log("  时间范围:", trainTimeIndices[0], "-", trainTimeIndices[trainTimeIndices.length - 1]);
        console.log("  真实值范围:", Math.min(...trainTrueValues).toFixed(2), "-", Math.max(...trainTrueValues).toFixed(2));
        console.log("  预测值范围:", Math.min(...trainPredValues).toFixed(2), "-", Math.max(...trainPredValues).toFixed(2));
        console.log("  数据点数量:", trainTrueData.length);
        
        console.log("验证集数据准备完成:");
        console.log("  时间范围:", valTimeIndices[0], "-", valTimeIndices[valTimeIndices.length - 1]);
        console.log("  真实值范围:", Math.min(...valTrueValues).toFixed(2), "-", Math.max(...valTrueValues).toFixed(2));
        console.log("  预测值范围:", Math.min(...valPredValues).toFixed(2), "-", Math.max(...valPredValues).toFixed(2));
        console.log("  数据点数量:", valTrueData.length);
        
        console.log("测试集数据准备完成:");
        console.log("  时间范围:", testTimeIndices[0], "-", testTimeIndices[testTimeIndices.length - 1]);
        console.log("  真实值范围:", Math.min(...testTrueValues).toFixed(2), "-", Math.max(...testTrueValues).toFixed(2));
        console.log("  预测值范围:", Math.min(...testPredValues).toFixed(2), "-", Math.max(...testPredValues).toFixed(2));
        console.log("  数据点数量:", testTrueData.length);
        
        console.log("完整序列数据准备完成:");
        console.log("  时间范围:", fullTimeIndices[0], "-", fullTimeIndices[fullTimeIndices.length - 1]);
        console.log("  总数据点数量:", fullActualData.length);
        
        // 等待DOM更新完成后再渲染图表
        setTimeout(() => {
            try {
                // 创建或获取可视化容器
                const visualizationTab = document.getElementById("visualizationTab");
                if (!visualizationTab) {
                    console.error("找不到visualizationTab容器");
                    return;
                }
                
                // 检查标签页是否可见
                if (visualizationTab.style.display === "none") {
                    console.warn("visualizationTab当前不可见，延迟渲染");
                    return;
                }
                
                console.log("找到visualizationTab容器，开始创建图表");
                
                // 清空之前的可视化内容
                const existingContainer = document.getElementById("time-series-predictions-container");
                if (existingContainer) {
                    existingContainer.remove();
                }
                
                // 确保images元素被隐藏和清空（分类结果显示）
                const imagesElement = document.getElementById("images");
                if (imagesElement) {
                    imagesElement.innerHTML = "";
                    imagesElement.style.display = "none";
                }
            
                // 创建主容器
                const container = document.createElement("div");
                container.id = "time-series-predictions-container";
                container.style.width = "100%";
                container.style.marginTop = "20px";
                container.style.padding = "10px";
                container.style.overflow = "auto";
                visualizationTab.appendChild(container);
                
                // 计算指标：训练集和测试集的RMSE和MAE
                const trainMae = trainTrueValues.reduce((sum, val, i) => sum + Math.abs(val - trainPredValues[i]), 0) / trainTrueValues.length;
                const trainMse = trainTrueValues.reduce((sum, val, i) => sum + Math.pow(val - trainPredValues[i], 2), 0) / trainTrueValues.length;
                const trainRmse = Math.sqrt(trainMse);
                
                const testMae = testTrueValues.reduce((sum, val, i) => sum + Math.abs(val - testPredValues[i]), 0) / testTrueValues.length;
                const testMse = testTrueValues.reduce((sum, val, i) => sum + Math.pow(val - testPredValues[i], 2), 0) / testTrueValues.length;
                const testRmse = Math.sqrt(testMse);
                
                // 创建指标显示区域
                const metricsDiv = document.createElement("div");
                metricsDiv.style.marginBottom = "20px";
                metricsDiv.style.padding = "15px";
                metricsDiv.style.backgroundColor = "#f5f5f5";
                metricsDiv.style.borderRadius = "4px";
                metricsDiv.style.border = "1px solid #ddd";
                
                const metricsTitle = document.createElement("h3");
                metricsTitle.textContent = "评估指标";
                metricsTitle.style.marginTop = "0";
                metricsTitle.style.marginBottom = "10px";
                metricsTitle.style.color = "#333";
                metricsDiv.appendChild(metricsTitle);
                
                const metricsContent = document.createElement("div");
                metricsContent.style.display = "grid";
                metricsContent.style.gridTemplateColumns = "1fr 1fr";
                metricsContent.style.gap = "15px";
                
                // 训练集指标
                const trainMetricsDiv = document.createElement("div");
                trainMetricsDiv.innerHTML = `
                    <h4 style="margin-top: 0; color: #555;">训练集指标:</h4>
                    <p style="margin: 5px 0;"><strong>RMSE:</strong> ${trainRmse.toFixed(4)}</p>
                    <p style="margin: 5px 0;"><strong>MAE:</strong> ${trainMae.toFixed(4)}</p>
                `;
                metricsContent.appendChild(trainMetricsDiv);
                
                // 测试集指标
                const testMetricsDiv = document.createElement("div");
                testMetricsDiv.innerHTML = `
                    <h4 style="margin-top: 0; color: #555;">测试集指标:</h4>
                    <p style="margin: 5px 0;"><strong>RMSE:</strong> ${testRmse.toFixed(4)}</p>
                    <p style="margin: 5px 0;"><strong>MAE:</strong> ${testMae.toFixed(4)}</p>
                `;
                metricsContent.appendChild(testMetricsDiv);
                
                metricsDiv.appendChild(metricsContent);
                container.appendChild(metricsDiv);
                
                // 创建完整序列标题
                const fullTitle = document.createElement("h3");
                fullTitle.textContent = "Air Passengers - Full Sequence";
                fullTitle.style.marginTop = "20px";
                fullTitle.style.marginBottom = "10px";
                fullTitle.style.color = "#333";
                container.appendChild(fullTitle);
                
                // 创建完整序列图表容器
                const fullContainer = document.createElement("div");
                fullContainer.id = "full-sequence-predictions-canvas";
                fullContainer.style.width = "100%";
                fullContainer.style.height = "400px";
                fullContainer.style.marginBottom = "30px";
                fullContainer.style.border = "1px solid #ddd";
                fullContainer.style.borderRadius = "4px";
                fullContainer.style.padding = "10px";
                container.appendChild(fullContainer);
                
                // 创建测试集标题（已注释，暂时不显示）
                // const testTitle = document.createElement("h3");
                // testTitle.textContent = "Air Passengers - Test Set Only";
                // testTitle.style.marginTop = "20px";
                // testTitle.style.marginBottom = "10px";
                // testTitle.style.color = "#333";
                // container.appendChild(testTitle);
                
                // 创建测试集图表容器（已注释，暂时不显示）
                // const testContainer = document.createElement("div");
                // testContainer.id = "test-predictions-canvas";
                // testContainer.style.width = "100%";
                // testContainer.style.height = "400px";
                // testContainer.style.border = "1px solid #ddd";
                // testContainer.style.borderRadius = "4px";
                // testContainer.style.padding = "10px";
                // container.appendChild(testContainer);
                
                console.log("图表容器已创建，完整序列容器:", fullContainer);
                
                // 计算图表宽度（使用visualizationTab的宽度或默认值）
                let chartWidth = 800; // 默认宽度
                try {
                    const tab = document.getElementById("visualizationTab");
                    if (tab) {
                        chartWidth = Math.max(600, tab.clientWidth - 40); // 减去一些边距
                    }
                } catch (e) {
                    console.warn("无法获取visualizationTab宽度，使用默认值:", e);
                }
                
                // 渲染完整序列图表（训练集+测试集）
                console.log("开始渲染完整序列图表，数据点数:", fullActualData.length, fullPredData.length);
                tfvis.render.linechart(
                    {
                        values: [fullActualData, fullPredData],
                        series: ["Actual", "Predicted"]
                    },
                    fullContainer,
                    {
                        xLabel: "时间（月份索引）",
                        yLabel: "乘客数量",
                        width: chartWidth,
                        height: 400,
                        fontSize: GRAPH_FONT_SIZE,
                        zoomToFit: true,
                    }
                );
                
                // 在完整序列图上添加训练/测试分割线
                // 注意：tfvis可能不支持直接添加垂直线，这里我们通过添加一个额外的数据点来实现
                // 或者使用SVG/D3来绘制分割线（如果需要的话）
                
                // 渲染测试集图表（仅测试集）（已注释，暂时不显示）
                // console.log("开始渲染测试集图表，数据点数:", testTrueData.length, testPredData.length);
                // tfvis.render.linechart(
                //     {
                //         values: [testTrueData, testPredData],
                //         series: ["Actual Test", "Predicted Test"]
                //     },
                //     testContainer,
                //     {
                //         xLabel: "时间（月份索引）",
                //         yLabel: "乘客数量",
                //         width: chartWidth,
                //         height: 400,
                //         fontSize: GRAPH_FONT_SIZE,
                //         zoomToFit: true,
                //     }
                // );
                
                // 打印统计信息到控制台
                console.log("=".repeat(50));
                console.log("训练集指标:");
                console.log(`RMSE: ${trainRmse.toFixed(4)}`);
                console.log(`MAE: ${trainMae.toFixed(4)}`);
                console.log("\n测试集指标:");
                console.log(`RMSE: ${testRmse.toFixed(4)}`);
                console.log(`MAE: ${testMae.toFixed(4)}`);
                console.log("=".repeat(50));
            } catch (domError) {
                console.error("渲染图表时DOM操作出错:", domError);
            }
        }, 100); // 延迟100ms确保DOM已更新
        
        // 注意：所有Tensor已在tf.tidy中自动释放，无需手动dispose
    } catch (error) {
        console.error("生成预测结果可视化时出错:", error);
        console.error("错误堆栈:", error.stack);
    }
}

export function draw(image: tf.Tensor, canvas: HTMLCanvasElement): void {
  const [width, height] = [dataset.IMAGE_HEIGHT, dataset.IMAGE_WIDTH];
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const imageData = new ImageData(width, height);
  const data = image.dataSync();
  for (let i = 0; i < height * width; ++i) {
    const j = i * 4;
    if (dataset.IMAGE_CHANNELS === 3) {
      const k = i * 3;
      imageData.data[j + 0] = data[k + 0] * 255;
      imageData.data[j + 1] = data[k + 1] * 255;
      imageData.data[j + 2] = data[k + 2] * 255;
      imageData.data[j + 3] = 255;
    } else {
      imageData.data[j + 0] = data[i] * 255;
      imageData.data[j + 1] = data[i] * 255;
      imageData.data[j + 2] = data[i] * 255;
      imageData.data[j + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}
