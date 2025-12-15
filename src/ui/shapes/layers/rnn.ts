import * as tf from "@tensorflow/tfjs";
import { dataset, AirPassengersData } from "../../../model/data";
import { ActivationLayer } from "../activationlayer";
import { Layer } from "../layer";
import { PathShape, Point } from "../shape";

export class Recurrent extends ActivationLayer {
    public layerType: string = "Recurrent";
    public parameterDefaults: { [key: string]: any } = {
        units: 64,  // 设置units为64以提高表达能力，适合图像分类任务
        returnSequences: false,
        dropout: 0.1,  // 降低dropout率，避免训练后期性能突然下降
        recurrentDropout: 0.1,  // 降低recurrent dropout，防止RNN梯度问题
        timestep: 12  // 时间窗口大小（时间步数），用于时序数据预处理
    };
    public readonly tfjsEmptyLayer: any = tf.layers.simpleRNN;

    constructor(defaultLocation: Point = Point.randomPoint(100, 40, ActivationLayer.defaultInitialLocation)) {
        super([
            new PathShape("M-8 -90 h26 v100 h-8 v-10 h-10 v10 h-8 v-100 Z", "#8B4513"),
            new PathShape("M-4 -80 h18 v20 h-18 v-20 Z", "#D2691E"),
            new PathShape("M-4 -50 h18 v20 h-18 v-20 Z", "#D2691E"),
            new PathShape("M-4 -20 h18 v20 h-18 v-20 Z", "#D2691E")
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
        value1.value = "64";  // 修改默认值为64以提高表达能力
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

        // Time Step参数（时间窗口大小）
        const line5 = document.createElement("div");
        line5.className = "paramline";
        const name5 = document.createElement("div");
        name5.className = "paramname";
        name5.innerHTML = "Time Step:";
        name5.setAttribute("data-name", "timestep");
        const value5 = document.createElement("input");
        value5.className = "paramvalue layerparamvalue";
        value5.value = "12";  // 默认值12，使用前12个时间步预测下1个时间步
        value5.type = "number";
        value5.min = "1";
        value5.max = "50";
        line5.appendChild(name5);
        line5.appendChild(value5);
        this.paramBox.append(line5);

        // 添加事件监听器，当timestep改变时触发数据重新加载
        value5.addEventListener("change", () => {
            const timestepValue = parseInt(value5.value, 10);
            if (timestepValue > 0 && timestepValue <= 50) {
                // 通知数据集更新timestep并重新加载
                this.notifyTimestepChange(timestepValue);
            }
        });

        this.focusing();
    }

    /**
     * 通知数据集timestep参数已改变，需要重新加载数据并重建模型
     */
    private notifyTimestepChange(newTimestep: number): void {
        // 检查是否为时序数据集
        if (dataset instanceof AirPassengersData) {
            // 更新数据集的timestep
            dataset.setTimeSteps(newTimestep);
            // 如果数据已加载，重新加载数据
            if (dataset.dataLoaded) {
                dataset.load().then(() => {
                    console.log(`时间窗口大小已更新为 ${newTimestep}，数据已重新加载`);
                    // 触发模型重建以匹配新的输入shape
                    // 通过触发Input层的generateTfjsLayer来更新输入形状
                    this.triggerModelRebuild();
                }).catch((error) => {
                    console.error("重新加载数据时出错:", error);
                });
            } else {
                // 即使数据未加载，也需要更新Input层的形状
                this.triggerModelRebuild();
            }
        }
    }

    /**
     * 触发模型重建（通过找到Input层并重新生成其tfjsLayer）
     */
    private triggerModelRebuild(): void {
        // 找到Input层（通过向上遍历父层）
        let currentLayer: Layer = this;
        const visited = new Set<Layer>();
        
        // 向上查找Input层
        while (currentLayer && currentLayer.layerType !== "Input") {
            if (visited.has(currentLayer)) {
                break; // 避免循环
            }
            visited.add(currentLayer);
            
            // 获取第一个父层
            const parent = currentLayer.parents.values().next().value;
            if (parent) {
                currentLayer = parent;
            } else {
                break;
            }
        }
        
        // 如果找到了Input层，重新生成其tfjsLayer
        if (currentLayer && currentLayer.layerType === "Input") {
            try {
                currentLayer.generateTfjsLayer();
                console.log("Input层已更新以匹配新的timestep");
                // 如果模型已构建，可以在这里触发模型重建
                // 但通常模型会在训练时自动重建，所以这里只更新Input层即可
            } catch (error) {
                console.error("更新Input层时出错:", error);
            }
        }
    }

    public getHoverText(): string { return "Recurrent"; }

    public lineOfPython(): string {
        const params = this.getParams();
        const activation = this.getActivationText();
        const activationText = activation == null ? "" : `, activation='${activation}'`;
        const returnSeqText = params.returnSequences ? ", return_sequences=True" : "";
        const dropoutText = params.dropout > 0 ? `, dropout=${params.dropout}` : "";
        const recurrentDropoutText = params.recurrentDropout > 0 ? `, recurrent_dropout=${params.recurrentDropout}` : "";
        
        return `SimpleRNN(${params.units}${activationText}${returnSeqText}${dropoutText}${recurrentDropoutText})`;
    }

    public initLineOfJulia(): string {
        const params = this.getParams();
        const activation = this.getActivationText();
        const activationText = activation == null ? "" : `, ${activation}`;
        const returnSeqText = params.returnSequences ? ", return_sequences=true" : "";
        
        return `x${this.uid} = insert!(net, (shape) -> RNN(shape[1], ${params.units}${activationText}${returnSeqText}))\n`;
    }

    public generateTfjsLayer(): void {
        // 使用parameterDefaults作为基础，然后用getParams()中的用户配置覆盖
        const parameters = { ...this.parameterDefaults };
        const userParams = this.getParams();
        
        // 将用户配置的参数合并到默认参数中
        for (const key of Object.keys(userParams)) {
            if (userParams[key] !== undefined && userParams[key] !== null && userParams[key] !== "") {
                parameters[key] = userParams[key];
            }
        }
        
        // 确保参数类型正确
        parameters.units = parseInt(parameters.units, 10);
        parameters.returnSequences = Boolean(parameters.returnSequences);
        parameters.dropout = parseFloat(parameters.dropout) || 0;
        parameters.recurrentDropout = parseFloat(parameters.recurrentDropout) || 0;
        
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
        
        // 检测是否为时序数据（AirPassengers）
        const isTimeSeries = dataset instanceof AirPassengersData;
        
        // 获取父层的输出形状
        const parentShape = parentLayer.shape;
        
        console.log(`RNN layer: parent type=${parent.layerType}, parentShape=${JSON.stringify(parentShape)}, isTimeSeries=${isTimeSeries}`);
        
        // 如果父层是Reshape层，直接使用父层的输出
        if (parent && parent.layerType === "Reshape") {
            this.tfjsLayer = this.tfjsEmptyLayer(parameters).apply(parentLayer);
            return;
        }
        
        // 对于时序数据，特殊处理：Input层直接连接RNN
        if (isTimeSeries && parent && parent.layerType === "Input") {
            // 时序数据：Input层shape是[timeSteps, features]（如[12, 1]）
            // RNN可以直接处理，TensorFlow.js会自动添加批次维度
            // 关键：不要尝试任何reshape操作
            console.log("RNN: 时序数据，Input层直接连接，跳过所有reshape");
            this.tfjsLayer = this.tfjsEmptyLayer(parameters).apply(parentLayer);
            return;
        }
        
        // 对于其他情况（图像数据），使用原有的处理逻辑
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
                
                // 然后应用Recurrent层
                this.tfjsLayer = this.tfjsEmptyLayer(parameters).apply(reshaped);
            } else if (parentShape.length === 3) {
                // 3D输入（批次，时间步，特征）- 已经是正确的格式
                this.tfjsLayer = this.tfjsEmptyLayer(parameters).apply(parentLayer);
            } else if (parentShape.length === 2) {
                // 2D输入（批次，特征）- 需要添加时间维度
                // 但只对非时序数据这样做
                if (!isTimeSeries) {
                    const reshapeLayer = tf.layers.reshape({targetShape: [1, parentShape[1]]});
                    const reshaped = reshapeLayer.apply(parentLayer);
                    this.tfjsLayer = this.tfjsEmptyLayer(parameters).apply(reshaped);
                } else {
                    // 时序数据的2D输入，直接应用（不应该到达这里，因为上面已经处理了）
                    this.tfjsLayer = this.tfjsEmptyLayer(parameters).apply(parentLayer);
                }
            } else {
                // 对于其他情况，尝试直接应用Recurrent层
                this.tfjsLayer = this.tfjsEmptyLayer(parameters).apply(parentLayer);
            }
        } catch (error) {
            console.error("RNN layer error:", error, "parentShape:", parentShape);
            // 如果重塑失败，尝试直接应用Recurrent层
            this.tfjsLayer = this.tfjsEmptyLayer(parameters).apply(parentLayer);
        }
    }

    public clone(): Recurrent {
        const newLayer = new Recurrent(Point.randomPoint(100, 40, ActivationLayer.defaultInitialLocation));
        newLayer.paramBox = this.paramBox;
        newLayer.activation = this.activation;
        return newLayer;
    }
}