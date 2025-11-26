import * as tf from "@tensorflow/tfjs";
import { ActivationLayer } from "../activationlayer";
import { Layer } from "../layer";
import { PathShape, Point } from "../shape";

export class LSTM extends ActivationLayer {
    public layerType: string = "LSTM";
    public parameterDefaults: { [key: string]: any } = {
        units: 32,  // 设置units为32以平衡性能和表达能力
        returnSequences: false,
        dropout: 0.2,  // 添加默认dropout以防止过拟合
        recurrentDropout: 0.2  // 添加recurrent dropout
    };
    public readonly tfjsEmptyLayer: any = tf.layers.lstm;

    constructor(defaultLocation: Point = Point.randomPoint(100, 40, ActivationLayer.defaultInitialLocation)) {
        super([
            new PathShape("M-8 -90 h26 v100 h-8 v-10 h-10 v10 h-8 v-100 Z", "#4169E1"),
            new PathShape("M-4 -80 h18 v20 h-18 v-20 Z", "#6495ED"),
            new PathShape("M-4 -50 h18 v20 h-18 v-20 Z", "#6495ED"),
            new PathShape("M-4 -20 h18 v20 h-18 v-20 Z", "#6495ED")
        ], defaultLocation);
    }

    public populateParamBox(): void {
        // Units参数
        const line1 = document.createElement("div");
        line1.className = "paramline";
        const name1 = document.createElement("div");
        name1.className = "paramname";
        name1.innerHTML = "Units:";
        name1.setAttribute("data-name", "units");
        const value1 = document.createElement("input");
        value1.className = "paramvalue layerparamvalue";
        value1.value = "32";  // 修改默认值为32
        line1.appendChild(name1);
        line1.appendChild(value1);
        this.paramBox.append(line1);

        // Return Sequences参数
        const line2 = document.createElement("div");
        line2.className = "paramline";
        const name2 = document.createElement("div");
        name2.className = "paramname";
        name2.innerHTML = "Return Sequences:";
        name2.setAttribute("data-name", "returnSequences");
        const value2 = document.createElement("input");
        value2.className = "paramvalue layerparamvalue";
        value2.type = "checkbox";
        line2.appendChild(name2);
        line2.appendChild(value2);
        this.paramBox.append(line2);

        // Dropout参数
        const line3 = document.createElement("div");
        line3.className = "paramline";
        const name3 = document.createElement("div");
        name3.className = "paramname";
        name3.innerHTML = "Dropout:";
        name3.setAttribute("data-name", "dropout");
        const value3 = document.createElement("input");
        value3.className = "paramvalue layerparamvalue";
        value3.value = "0.2";  // 修改默认值为0.2
        line3.appendChild(name3);
        line3.appendChild(value3);
        this.paramBox.append(line3);

        // Recurrent Dropout参数
        const line4 = document.createElement("div");
        line4.className = "paramline";
        const name4 = document.createElement("div");
        name4.className = "paramname";
        name4.innerHTML = "Recurrent Dropout:";
        name4.setAttribute("data-name", "recurrentDropout");
        const value4 = document.createElement("input");
        value4.className = "paramvalue layerparamvalue";
        value4.value = "0.2";  // 修改默认值为0.2
        line4.appendChild(name4);
        line4.appendChild(value4);
        this.paramBox.append(line4);

        this.focusing();
    }

    public getHoverText(): string { return "LSTM"; }

    public lineOfPython(): string {
        const params = this.getParams();
        const activation = this.getActivationText();
        const activationText = activation == null ? "" : `, activation='${activation}'`;
        const returnSeqText = params.returnSequences ? ", return_sequences=True" : "";
        const dropoutText = params.dropout > 0 ? `, dropout=${params.dropout}` : "";
        const recurrentDropoutText = params.recurrentDropout > 0 ? `, recurrent_dropout=${params.recurrentDropout}` : "";
        
        return `LSTM(${params.units}${activationText}${returnSeqText}${dropoutText}${recurrentDropoutText})`;
    }

    public lineOfJulia(): string {
        const params = this.getParams();
        const activation = this.getActivationText();
        const activationText = activation == null ? "" : `, ${activation}`;
        const returnSeqText = params.returnSequences ? ", return_sequences=true" : "";
        
        return `x${this.uid} = insert!(net, (shape) -> LSTM(shape[1], ${params.units}${activationText}${returnSeqText}))\n`;
    }

    public initLineOfJulia(): string {
        const params = this.getParams();
        const activation = this.getActivationText();
        const activationText = activation == null ? "" : `, ${activation}`;
        const returnSeqText = params.returnSequences ? ", return_sequences=true" : "";
        
        return `x${this.uid} = insert!(net, (shape) -> LSTM(shape[1], ${params.units}${activationText}${returnSeqText}))\n`;
    }

    public generateTfjsLayer(): void {
        // 获取参数
        const parameters = this.getParams();
        
        // 获取激活函数
        if (this.activation != null) {
            parameters.activation = this.activation.activationType;
        }

        let parent: Layer = null;
        for (const p of this.parents) { 
            parent = p; 
            break; 
        }
        
        // 获取父层的输出
        const parentLayer = parent.getTfjsLayer();
        
        // 如果父层是Reshape层，直接使用父层的输出，不需要再次reshape
        if (parent && parent.layerType === "Reshape") {
            this.tfjsLayer = this.tfjsEmptyLayer(parameters).apply(parentLayer);
            return;
        }
        
        // 对于LSTM，我们需要将2D图像数据重塑为适合RNN的格式
        // 首先将图像展平为序列格式
        const parentShape = parentLayer.shape;
        
        try {
            // 如果输入是4D张量（批次，高度，宽度，通道），我们需要将其重塑
            if (parentShape.length === 4) {
                // 支持MNIST数据 (批次, 28, 28, 1) 和CIFAR-10数据 (批次, 32, 32, 3)
                // 重塑为 (批次, 时间步, 特征) 格式
                const timeSteps = parentShape[1]; // 高度 (28 for MNIST, 32 for CIFAR-10)
                const features = parentShape[2] * parentShape[3]; // 宽度 * 通道数
                
                // 创建一个Lambda层来重塑数据
                const reshapeLayer = tf.layers.reshape({targetShape: [timeSteps, features]});
                const reshaped = reshapeLayer.apply(parentLayer);
                
                // 然后应用LSTM层
                this.tfjsLayer = this.tfjsEmptyLayer(parameters).apply(reshaped);
            } else if (parentShape.length === 2) {
                // 如果输入是2D张量（批次，特征），我们需要添加时间维度
                // 将其重塑为（批次，1，特征）
                const reshapeLayer = tf.layers.reshape({targetShape: [1, parentShape[1]]});
                const reshaped = reshapeLayer.apply(parentLayer);
                
                // 然后应用LSTM层
                this.tfjsLayer = this.tfjsEmptyLayer(parameters).apply(reshaped);
            } else if (parentShape.length === 3) {
                // 如果输入已经是3D张量（批次，时间步，特征），直接应用LSTM层
                this.tfjsLayer = this.tfjsEmptyLayer(parameters).apply(parentLayer);
            } else {
                // 对于其他情况，尝试直接应用LSTM层
                this.tfjsLayer = this.tfjsEmptyLayer(parameters).apply(parentLayer);
            }
        } catch (error) {
            // 如果重塑失败，尝试直接应用LSTM层
            console.warn("LSTM layer reshape failed, applying layer directly: ", error);
            this.tfjsLayer = this.tfjsEmptyLayer(parameters).apply(parentLayer);
        }
    }

    public clone(): LSTM {
        const newLayer = new LSTM(Point.randomPoint(100, 40, ActivationLayer.defaultInitialLocation));
        newLayer.paramBox = this.paramBox;
        newLayer.activation = this.activation;
        return newLayer;
    }
}