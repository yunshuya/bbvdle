import * as tf from "@tensorflow/tfjs";
import { ActivationLayer } from "../activationlayer";
import { PathShape, Point } from "../shape";

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
}
