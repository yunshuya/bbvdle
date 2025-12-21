import * as tf from "@tensorflow/tfjs";
import { ActivationLayer } from "../activationlayer";
import { PathShape, Point } from "../shape";

/**
 * RNN Cell 层 - 使用 Dense 和 Tanh 实现 RNN 计算
 * 这个层会被 tf.layers.rnn 包装，处理时间步循环
 */
export class RNNCell extends ActivationLayer {
    public layerType: string = "RNNCell";
    public parameterDefaults: { [key: string]: any } = {
        units: 128,
        dropout: 0.2,
    };
    public readonly tfjsEmptyLayer: any = null; // 不使用标准层

    constructor(defaultLocation: Point = Point.randomPoint(100, 40, ActivationLayer.defaultInitialLocation)) {
        super([
            new PathShape("M-10 -10 h20 v20 h-20 v-20 Z", "#8B4513"),
            new PathShape("M-5 -15 L5 15 M5 -15 L-5 15", "#000")
        ], defaultLocation);
    }

    public populateParamBox(): void {
        const line1 = document.createElement("div");
        line1.className = "paramline";
        const name1 = document.createElement("div");
        name1.className = "paramname";
        name1.innerHTML = "Units:";
        name1.setAttribute("data-name", "units");
        const value1 = document.createElement("input");
        value1.className = "paramvalue layerparamvalue";
        value1.value = "128";
        line1.appendChild(name1);
        line1.appendChild(value1);
        this.paramBox.append(line1);

        const line2 = document.createElement("div");
        line2.className = "paramline";
        const name2 = document.createElement("div");
        name2.className = "paramname";
        name2.innerHTML = "Dropout:";
        name2.setAttribute("data-name", "dropout");
        const value2 = document.createElement("input");
        value2.className = "paramvalue layerparamvalue";
        value2.value = "0.2";
        line2.appendChild(name2);
        line2.appendChild(value2);
        this.paramBox.append(line2);

        const info = document.createElement("div");
        info.className = "paramline";
        info.style.color = "#666";
        info.style.fontSize = "12px";
        info.innerHTML = "RNN Cell（使用 Dense + Tanh 实现）";
        this.paramBox.append(info);
        this.focusing();
    }

    public getHoverText(): string { 
        return "RNN Cell\nh_t = tanh(W·[x_t, h_{t-1}] + b)"; 
    }

    public lineOfPython(): string {
        return `# RNN Cell with Dense + Tanh\n# h_t = tanh(W·[x_t, h_{t-1}] + b)`;
    }

    public initLineOfJulia(): string {
        return "# RNN Cell (visualization only)\n";
    }

    /**
     * 创建自定义 RNN Cell
     * 使用 Dense 层和 Tanh 激活函数实现 RNN 计算
     */
    public createRNNCell(): any {
        const params = this.getParams();
        const units = parseInt(params.units, 10) || 128;
        const dropout = parseFloat(params.dropout) || 0;

        // 创建自定义 RNN Cell
        class CustomRNNCell extends tf.layers.Layer {
            private denseLayer: tf.layers.Layer;
            private dropoutLayer: tf.layers.Layer | null = null;
            private cellUnits: number;

            constructor(cellUnits: number, cellDropout: number) {
                super({ name: 'CustomRNNCell' });
                this.cellUnits = cellUnits;
                
                // 创建 Dense 层：输入是 [x_t, h_{t-1}] 的拼接
                // 对于 AirPassengers，x_t 是 [1]，h_{t-1} 是 [units]
                // 所以输入维度是 1 + units
                this.denseLayer = tf.layers.dense({
                    units: cellUnits,
                    activation: 'tanh',
                    name: 'rnn_cell_dense'
                });
                
                if (cellDropout > 0) {
                    this.dropoutLayer = tf.layers.dropout({
                        rate: cellDropout,
                        name: 'rnn_cell_dropout'
                    });
                }
            }

            call(inputs: tf.Tensor | tf.Tensor[], _kwargs: any): tf.Tensor | tf.Tensor[] {
                // inputs[0] 是 x_t，inputs[1] 是 h_{t-1}（如果存在）
                // 对于 RNN，我们需要处理两种情况：
                // 1. 第一个时间步：只有 x_t，h_{t-1} 是零向量
                // 2. 后续时间步：有 x_t 和 h_{t-1}
                
                let x_t: tf.Tensor;
                let h_t_prev: tf.Tensor;
                
                if (Array.isArray(inputs)) {
                    x_t = inputs[0];
                    h_t_prev = inputs.length > 1 ? inputs[1] : tf.zeros([x_t.shape[0], this.cellUnits]);
                } else {
                    x_t = inputs;
                    h_t_prev = tf.zeros([x_t.shape[0], this.cellUnits]);
                }
                
                // 拼接 [x_t, h_{t-1}]
                const concat = tf.concat([x_t, h_t_prev], 1);
                
                // 通过 Dense 层和 Tanh 激活
                let output = this.denseLayer.apply(concat) as tf.Tensor;
                
                // 应用 dropout（如果存在）
                if (this.dropoutLayer) {
                    output = this.dropoutLayer.apply(output) as tf.Tensor;
                }
                
                return output;
            }

            getConfig(): any {
                return { units: this.cellUnits, dropout: this.dropoutLayer ? 0.2 : 0 };
            }
        }

        return new CustomRNNCell(units, dropout);
    }

    public generateTfjsLayer(): void {
        // RNN Cell 本身不直接生成层
        // 它会被 RNNInternal 层使用
        // 这里我们创建一个占位层，实际使用在 RNNInternal 中
        const params = this.getParams();
        const units = parseInt(params.units, 10) || 128;
        
        // 创建一个简单的 Dense 层作为占位
        // 实际的计算会在 RNNInternal 中使用 createRNNCell()
        this.tfjsLayer = tf.layers.dense({
            units: units,
            activation: 'tanh'
        }).apply(tf.input({ shape: [units + 1] })) as tf.SymbolicTensor;
    }

    public clone(): RNNCell {
        return new RNNCell();
    }
}

