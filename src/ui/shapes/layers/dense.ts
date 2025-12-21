import * as tf from "@tensorflow/tfjs";
import { ActivationLayer } from "../activationlayer";
import { PathShape, Point } from "../shape";
import { dataset, AirPassengersData } from "../../../model/data";
import { Layer } from "../layer";
import { displayError } from "../../error";

export class Dense extends ActivationLayer {
    public layerType: string = "Dense";
    public parameterDefaults: { [key: string]: any } = {units: 32};
    public readonly tfjsEmptyLayer: any = tf.layers.dense;
    


    constructor(defaultLocation: Point = Point.randomPoint(100, 40, ActivationLayer.defaultInitialLocation)) {
        super([new PathShape("M-8 -90 h26 v100 h-8 v-10 h-10 v10 h-8 v-100 Z", "#F7473B")], defaultLocation);
        
    }

    public populateParamBox(): void {
        //创建一个新的 <div> 元素，用于包含参数名称和输入框。
        const line = document.createElement("div");
        //设置该 <div> 的 CSS 类名为 paramline，用来样式化这一行内容。
        line.className = "paramline";
        const name = document.createElement("div");
        name.className = "paramname";
        //设置名称文本为 Units:，即表示该参数是神经元数量。
        name.innerHTML = "Units:";
        //为 name 添加一个自定义属性 data-name，该属性值是 units，用于在 JavaScript 中引用和识别该参数
        name.setAttribute("data-name", "units");
        const value = document.createElement("input");
        value.className = "paramvalue layerparamvalue";
        value.value = "32";
        
        
        line.appendChild(name);
        line.appendChild(value);
        //将 line（包含标签和输入框）添加到 paramBox 中
        this.paramBox.append(line);
        
        // 如果是占位层（HiddenStatePrev），添加占位层标记
        if (this.layerType === "HiddenStatePrev") {
            const info = document.createElement("div");
            info.className = "paramline";
            info.style.color = "#999";
            info.style.fontSize = "11px";
            info.style.fontStyle = "italic";
            info.style.marginTop = "5px";
            info.style.paddingTop = "5px";
            info.style.borderTop = "1px solid #ddd";
            info.innerHTML = "⚠️ 占位层（用于拓扑排序和循环连接可视化）";
            this.paramBox.appendChild(info);
        }
        
        this.focusing();
    }

    public getHoverText(): string { return "Dense"; }

    public lineOfPython(): string {
        const params = this.getParams();
        const activation = this.getActivationText();
        const activationText = activation == null ? "" : `, activation='${activation}'`;
        return `Dense(${params.units}${activationText})`;
    }

    public initLineOfJulia(): string {
        const params = this.getParams();
        const activation = this.getActivationText();
        const activationText = activation == null ? "" : `, ${activation}`;
        return `x${this.uid} = insert!(net, (shape) -> Dense(shape[1], ${params.units}${activationText}))\n`;
    }

    public clone(): Dense {
        const newLayer = new Dense(Point.randomPoint(100, 40, ActivationLayer.defaultInitialLocation));
        newLayer.paramBox = this.paramBox;
        newLayer.activation = this.activation;
        return newLayer;
    }

    public generateTfjsLayer(): void {
        // 检查是否为可视化占位层（HiddenStatePrev 或 CellStatePrev）
        // 这些层不应该参与实际的模型构建，它们只是用于可视化循环连接
        if (this.layerType === "HiddenStatePrev" || this.layerType === "CellStatePrev") {
            // 对于占位层，我们需要创建一个占位符张量，但不影响实际训练
            // 方法：使用父层的输出作为占位符（如果存在）
            // 如果没有父层，创建一个零张量
            let parent: Layer = null;
            for (const p of this.parents) { 
                parent = p; 
                break; 
            }
            
            if (parent) {
                // 使用父层的输出作为占位符，但确保形状正确
                const parentLayer = parent.getTfjsLayer();
                // 创建一个与父层输出形状相同的占位符
                // 对于时序数据，如果父层是 Flatten，输出是 [batch, timesteps*features]
                // 我们需要创建一个 [batch, units] 的占位符
                this.tfjsLayer = this.tfjsEmptyLayer({units: this.parameterDefaults.units}).apply(parentLayer);
            } else {
                // 如果没有父层，创建一个零张量占位符
                // 这种情况不应该发生，但为了安全起见
                throw new Error(`占位层 ${this.layerType} 必须有一个父层`);
            }
            return;
        }
        
        // 检测是否为时序数据（回归任务）
        const isTimeSeries = dataset instanceof AirPassengersData;
        
        // 使用parameterDefaults作为基础，然后用getParams()中的用户配置覆盖
        const parameters = { ...this.parameterDefaults };
        const userParams = this.getParams();
        
        // 将用户配置的参数合并到默认参数中
        // 注意：如果 userParams 中的值为空字符串或未定义，则使用 parameterDefaults 中的值
        for (const param of Object.keys(userParams)) {
            if (userParams[param] !== undefined && userParams[param] !== null && userParams[param] !== "") {
                // 对于 units 参数，确保使用正确的类型（整数）
                if (param === "units") {
                    const unitsValue = parseInt(userParams[param], 10);
                    if (!isNaN(unitsValue) && unitsValue > 0) {
                        parameters[param] = unitsValue;
                    }
                } else {
                    parameters[param] = userParams[param];
                }
            }
        }
        
        // 确保 units 有值（优先使用 parameterDefaults，如果 userParams 中没有有效值）
        if (!parameters.units || parameters.units === "" || isNaN(parseInt(parameters.units, 10))) {
            parameters.units = this.parameterDefaults.units || 32;
        }
        
        // 检查是否连接到 Output 层
        let isConnectedToOutput = false;
        for (const child of this.children) {
            if (child.layerType === "Output") {
                isConnectedToOutput = true;
                break;
            }
        }
        
        // 对于时序数据，只有在连接到 Output 层时才强制设置units=1（回归任务）
        // 注意：不是所有时序数据的 Dense 层都应该设置为 1，只有输出层才需要
        if (isTimeSeries && isConnectedToOutput) {
            parameters.units = 1;
        } else if (isConnectedToOutput) {
            // 如果连接到 Output 层且不是时序数据，根据数据集设置正确的类别数
            // 这确保分类任务的输出层有正确的单元数
            if (dataset && 'NUM_CLASSES' in dataset) {
                parameters.units = dataset.NUM_CLASSES;
            } else {
                // 如果数据集尚未加载，使用默认值 10（MNIST 和 CIFAR-10 都是 10）
                parameters.units = 10;
            }
        }
        
        // 确保units是整数
        parameters.units = parseInt(parameters.units, 10);
        
        // 获取激活函数
        if (this.activation != null) {
            parameters.activation = this.activation.activationType;
        } else if (isTimeSeries) {
            // 时序数据（回归任务）不需要激活函数
            // 不设置activation，使用默认的线性激活
        }

        let parent: Layer = null;
        if (this.parents.size > 1) {
            displayError(new Error("Must use a concatenate when a layer has multiple parents"));
        }
        for (const p of this.parents) { parent = p; break; }

        this.tfjsLayer = this.tfjsEmptyLayer(parameters).apply(parent.getTfjsLayer());
    }
}
