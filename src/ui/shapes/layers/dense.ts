import * as tf from "@tensorflow/tfjs";
import { ActivationLayer } from "../activationlayer";
import { PathShape, Point } from "../shape";
import { dataset, AirPassengersData, ImageData } from "../../../model/data";
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

    /**
     * 递归检查当前层是否最终连接到Output层
     * @param layer 要检查的层
     * @param visited 已访问的层集合，用于避免循环引用
     * @returns 如果最终连接到Output层，返回true
     */
    private isConnectedToOutput(layer: Layer, visited: Set<Layer> = new Set()): boolean {
        // 避免循环引用
        if (visited.has(layer)) {
            return false;
        }
        visited.add(layer);
        
        // 如果当前层就是Output层，返回true
        if (layer.layerType === "Output") {
            return true;
        }
        
        // 递归检查所有子层
        for (const child of layer.children) {
            if (this.isConnectedToOutput(child, visited)) {
                return true;
            }
        }
        
        return false;
    }

    public generateTfjsLayer(): void {
        // 检测是否为时序数据（回归任务）
        const isTimeSeries = dataset instanceof AirPassengersData;
        
        // 使用parameterDefaults作为基础，然后用getParams()中的用户配置覆盖
        const parameters = { ...this.parameterDefaults };
        const userParams = this.getParams();
        
        // 将用户配置的参数合并到默认参数中
        for (const param of Object.keys(userParams)) {
            parameters[param] = userParams[param];
        }
        
        // 递归检查是否最终连接到Output层（即使中间有其他层如Dropout）
        const isOutputParent = this.isConnectedToOutput(this);
        
        // 对于时序数据，强制设置units=1（回归任务）
        if (isTimeSeries) {
            parameters.units = 1;
        } else if (isOutputParent) {
            // 对于分类任务，如果Dense层最终连接到Output层，应该设置为数据集的类别数
            // 这样可以避免形状不匹配的错误（即使中间有Dropout等层）
            if (dataset && dataset instanceof ImageData) {
                parameters.units = dataset.NUM_CLASSES;
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
