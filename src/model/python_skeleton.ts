import { setModelHyperparameters } from "../ui/app";
import { dataset, AirPassengersData } from "./data";
import { model } from "./params_object";

export function pythonSkeleton(modelCode: string, timestep: number = 12): string {
    setModelHyperparameters();
    
    // 检测是否为时序数据（AirPassengers）
    const isTimeSeries = dataset instanceof AirPassengersData;
    
    if (isTimeSeries) {
        // AirPassengers时序数据集的Python代码
        return `from __future__ import print_function
import numpy as np
import pandas as pd
from statsmodels.datasets import airpassengers
from sklearn.preprocessing import MinMaxScaler
from tensorflow import keras
from keras.models import Model
from keras.layers import Dense, Dropout, Flatten, Input, Concatenate, BatchNormalization, Add
from keras.layers import Conv2D, MaxPooling2D, ReLU, SimpleRNN, Reshape, LSTM
from keras.optimizers import Adam

batch_size = ${model.params.batchSize}
epochs = ${model.params.epochs}

# ---------------------- 1. 加载并预处理AirPassengers数据集 ----------------------
# 加载数据集
data = airpassengers.load_pandas().data
values = data['AirPassengers'].values.reshape(-1, 1)  # (144, 1)

# 归一化（针对数值型时间序列，用MinMaxScaler）
scaler = MinMaxScaler(feature_range=(0, 1))
scaled_values = scaler.fit_transform(values)

# 参考PyTorch代码：先划分原始数据（split=120），再分别创建序列
split = 120  # 前120个月训练，后24个月测试
train_data = scaled_values[:split]
test_data = scaled_values[split:]

# 构建时间序列数据集：用前${timestep}个月预测下1个月
time_step = ${timestep}  # 时间步长（用${timestep}个月预测第${timestep + 1}个月）

def make_dataset(data, seq_length):
    x, y = [], []
    for i in range(len(data) - seq_length):
        x.append(data[i:i+seq_length, 0])
        y.append(data[i+seq_length, 0])
    return np.array(x), np.array(y)

x_train, y_train = make_dataset(train_data, time_step)
x_test, y_test = make_dataset(test_data, time_step)

# 调整LSTM输入格式：(样本数, 时间步长, 特征数)
x_train = np.reshape(x_train, (x_train.shape[0], x_train.shape[1], 1))  # (108, 12, 1)
x_test = np.reshape(x_test, (x_test.shape[0], x_test.shape[1], 1))     # (12, 12, 1)

input_shape = (time_step, 1)

print('x_train shape:', x_train.shape)
print('x_test shape:', x_test.shape)
print(x_train.shape[0], 'train samples')
print(x_test.shape[0], 'test samples')

############################# Architecture made by Ennui
${modelCode}
#############################

# 编译模型：回归任务用MSE损失和MAE指标
model.compile(optimizer=keras.optimizers.${model.params.getPythonOptimizer()}(learning_rate=${model.params.learningRate}),
              loss='mean_squared_error',
              metrics=['mae'])

# 训练模型
history = model.fit(x_train, y_train,
                    batch_size=batch_size,
                    epochs=epochs,
                    verbose=1,
                    validation_data=(x_test, y_test))

# 评估模型
score = model.evaluate(x_test, y_test, verbose=0)
print('Test MSE loss:', score[0])
print('Test MAE:', score[1])

# 反归一化预测结果（还原真实乘客数）
y_pred = model.predict(x_test)
y_test_original = scaler.inverse_transform(y_test.reshape(-1, 1))
y_pred_original = scaler.inverse_transform(y_pred)
print('真实值示例:', y_test_original[:5].flatten())
print('预测值示例:', y_pred_original[:5].flatten())
`;
    } else {
        // 图像数据集的Python代码（MNIST/CIFAR-10）
        return `from __future__ import print_function
import keras
from keras.datasets import ${dataset.pythonName}
from keras.models import Model
from keras.layers import Dense, Dropout, Flatten, Input, Concatenate, BatchNormalization, Add
from keras.layers import Conv2D, MaxPooling2D, ReLU, SimpleRNN, Reshape, LSTM
from keras import backend as K

batch_size = ${model.params.batchSize}
num_classes = ${dataset.NUM_CLASSES}
epochs = ${model.params.epochs}

# input image dimensions
img_rows, img_cols, channels = ${dataset.IMAGE_HEIGHT}, ${dataset.IMAGE_WIDTH}, ${dataset.IMAGE_CHANNELS}

# the data, split between train and test sets
(x_train, y_train), (x_test, y_test) = ${dataset.pythonName}.load_data()

if K.image_data_format() == 'channels_first':
    x_train = x_train.reshape(x_train.shape[0], channels, img_rows, img_cols)
    x_test = x_test.reshape(x_test.shape[0], channels, img_rows, img_cols)
    input_shape = (channels, img_rows, img_cols)
else:
    x_train = x_train.reshape(x_train.shape[0], img_rows, img_cols, channels)
    x_test = x_test.reshape(x_test.shape[0], img_rows, img_cols, channels)
    input_shape = (img_rows, img_cols, channels)

x_train = x_train.astype('float32')
x_test = x_test.astype('float32')
x_train /= 255
x_test /= 255
print('x_train shape:', x_train.shape)
print(x_train.shape[0], 'train samples')
print(x_test.shape[0], 'test samples')

# convert class vectors to binary class matrices
y_train = keras.utils.to_categorical(y_train, num_classes)
y_test = keras.utils.to_categorical(y_test, num_classes)

############################# Architecture made by Ennui
${modelCode}
#############################

model.compile(loss=keras.losses.${model.params.getPythonLoss()},
              optimizer=keras.optimizers.${model.params.getPythonOptimizer()}(learning_rate=${model.params.learningRate}),
              metrics=['accuracy'])

model.fit(x_train, y_train,
          batch_size=batch_size,
          epochs=epochs,
          verbose=1,
          validation_data=(x_test, y_test))
score = model.evaluate(x_test, y_test, verbose=0)
print('Test loss:', score[0])
print('Test accuracy:', score[1])
`;
    }
}
