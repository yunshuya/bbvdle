import * as tf from "@tensorflow/tfjs";
import { displayError } from "../ui/error";

/** All the hyperparameters for the network */
export interface IHyperparameterData {
    learningRate: number;
    batchSize: number;
    optimizerId: string;
    epochs: number;
    lossId: string;
}

class NetworkParameters {
    public learningRate: number = 0.001;  // 降低学习率以提高训练稳定性
    public batchSize: number = 64;
    public optimizer: string = "adam";  // 使用Adam优化器，通常比SGD表现更好
    public epochs: number = 1200;  // 参考PyTorch代码，使用1200个epochs进行训练
    public loss: string = "categoricalCrossentropy";
    private paramNames: Set<string> = new Set(["optimizer", "loss"]);

    public isParam(param: string): boolean {
        return this.paramNames.has(param);
    }

    public getOptimizer(): tf.Optimizer {
        switch (this.optimizer) {
            case "sgd":
                return tf.train.sgd(this.learningRate);

            case "rmsprop":
                return tf.train.rmsprop(this.learningRate);

            case "adagrad":
                return tf.train.adagrad(this.learningRate);

            case "adam":
                // Adam优化器参数：learningRate, beta1, beta2, epsilon
                // 注意：TensorFlow.js的adam函数不支持clipNorm作为直接参数
                // 梯度裁剪可以通过模型编译时的clipNorm选项实现
                return tf.train.adam(this.learningRate);

            default:
                throw new Error("Undefined optimizer!");
        }
    }

    public getPythonLoss(): string {
        return this.loss.split(/(?=[A-Z])/).join("_").toLowerCase();
    }

    public getPythonOptimizer(): string {
        switch (this.optimizer) {
            case "sgd":
                return "SGD";

            case "rmsprop":
                return "RMSprop";

            case "adagrad":
                return "Adagrad";

            case "adam":
                return "Adam";

            default:
                throw new Error("Undefined optimizer!");
        }
    }

    public getJuliaLoss(): string {
        switch (this.loss) {
            case "categoricalCrossentropy":
                return "crossentropy";

            case "hinge":
                displayError(new Error("Hinge loss is not yet implemented in Julia. "));

            case "meanSquaredError":
                return "mse";

            case "meanAbsoluteError":
                return "((pred, y) -> mean(abs.(pred .- y)))";

            default:
                throw new Error("Undefined loss!");
        }
    }

    public getJuliaOptimizer(): string {
        switch (this.optimizer) {
            case "sgd":
                return "Descent";

            case "rmsprop":
                return "RMSProp";

            case "adagrad":
                return "ADAGrad";

            case "adam":
                return "ADAM";

            default:
                throw new Error("Undefined optimizer!");
        }
    }
}

/**
 * Create a singleton model.
 */
class Model {
    private static instance: Model;
    public params: NetworkParameters = new NetworkParameters();
    public architecture: tf.LayersModel = null;

    private constructor() {}

    public static get Instance(): Model {
        return this.instance || (this.instance = new this());
    }
}

export const model = Model.Instance;