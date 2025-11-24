import * as tf from "@tensorflow/tfjs";
import { svgData } from "../../app";
import { Layer } from "../layer";
import { ActivationLayer } from "../activationlayer";
import { PathShape, Point } from "../shape";

export class Reshape extends Layer {
    public static defaultInitialLocation: Point = ActivationLayer.defaultInitialLocation;
    public layerType: string = "Reshape";
    public parameterDefaults: { [key: string]: any } = {
        targetShape1: 28,
        targetShape2: 28
    };
    public readonly tfjsEmptyLayer: any = tf.layers.reshape;

    constructor(defaultLocation: Point = Point.randomPoint(100, 40, new Point(100, 250))) {
        super([
            // 紧凑的阶梯形状，表示 reshape 的概念
            // 主形状：L 形，右侧突出，使用深绿色
            new PathShape("M-8 -90 h26 v100 h-8 v-10 h-10 v10 h-8 v-100 Z", "#228B22"),
            // 内部装饰块，紧密贴合主形状，使用浅绿色，形成层次感
            new PathShape("M-4 -80 h18 v20 h-18 v-20 Z", "#32CD32"),
            new PathShape("M-4 -50 h18 v20 h-18 v-20 Z", "#32CD32"),
            new PathShape("M-4 -20 h18 v20 h-18 v-20 Z", "#32CD32"),
            new PathShape("M-4 10 h18 v20 h-18 v-20 Z", "#32CD32")
        ], defaultLocation);
        // 确保积木块在可见区域内
        this.cropPosition();
    }

    public populateParamBox(): void {
        // 根据当前数据集自动设置默认值
        let defaultShape1 = 28;
        let defaultShape2 = 28;
        
        // 尝试获取当前数据集
        try {
            if (svgData && svgData.input) {
                const currentDataset = svgData.input.getParams().dataset;
                if (currentDataset === "cifar") {
                    // CIFAR-10: (32, 32, 3) -> (32, 96)
                    defaultShape1 = 32;
                    defaultShape2 = 96;
                }
            }
        } catch (e) {
            // 如果获取失败，使用默认值28
        }
        
        // Target Shape 1 参数
        const line1 = document.createElement("div");
        line1.className = "paramline";
        const name1 = document.createElement("div");
        name1.className = "paramname";
        name1.innerHTML = "Target Shape 1:";
        name1.setAttribute("data-name", "targetShape1");
        const value1 = document.createElement("input");
        value1.className = "paramvalue layerparamvalue";
        value1.value = defaultShape1.toString();
        line1.appendChild(name1);
        line1.appendChild(value1);
        this.paramBox.append(line1);

        // Target Shape 2 参数
        const line2 = document.createElement("div");
        line2.className = "paramline";
        const name2 = document.createElement("div");
        name2.className = "paramname";
        name2.innerHTML = "Target Shape 2:";
        name2.setAttribute("data-name", "targetShape2");
        const value2 = document.createElement("input");
        value2.className = "paramvalue layerparamvalue";
        value2.value = defaultShape2.toString();
        line2.appendChild(name2);
        line2.appendChild(value2);
        this.paramBox.append(line2);

        this.focusing();
    }

    public getHoverText(): string { return "Reshape"; }

    public lineOfPython(): string {
        const params = this.getParams();
        return `Reshape((${params.targetShape1}, ${params.targetShape2}))`;
    }

    public initLineOfJulia(): string {
        const params = this.getParams();
        return `x${this.uid} = insert!(net, (shape) -> (x) -> reshape(x, (${params.targetShape1}, ${params.targetShape2}, :)))\n`;
    }

    public generateTfjsLayer(): void {
        // 获取参数
        const parameters = this.getParams();
        
        let parent: Layer = null;
        for (const p of this.parents) { 
            parent = p; 
            break; 
        }
        
        const parentLayer = parent.getTfjsLayer();
        const parentShape = parentLayer.shape;
        
        // 如果输入是4D张量（批次，高度，宽度，通道），需要自动调整目标形状
        // 确保元素总数匹配，避免"Total size of new array must be unchanged"错误
        if (parentShape.length === 4) {
            // 计算输入的总元素数（不包括批次维度）
            const inputSize = parentShape[1] * parentShape[2] * parentShape[3];
            // 计算目标形状的总元素数
            const targetSize = parameters.targetShape1 * parameters.targetShape2;
            
            // 如果元素总数不匹配，自动调整目标形状
            // 对于RNN，通常将高度作为时间步，宽度*通道数作为特征
            if (inputSize !== targetSize) {
                // 使用高度作为时间步，宽度*通道数作为特征
                const timeSteps = parentShape[1]; // 高度
                const features = parentShape[2] * parentShape[3]; // 宽度 * 通道数
                parameters.targetShape = [timeSteps, features];
            } else {
                // 如果元素总数匹配，使用用户指定的形状
                parameters.targetShape = [parameters.targetShape1, parameters.targetShape2];
            }
        } else {
            // 对于非4D输入，直接使用用户指定的形状
            parameters.targetShape = [parameters.targetShape1, parameters.targetShape2];
        }
        
        this.tfjsLayer = this.tfjsEmptyLayer(parameters).apply(parentLayer);
    }

    /**
     * 根据当前数据集更新参数框中的显示值
     * 只在参数框已创建且值为默认值时才更新
     */
    public updateParamBoxFromDataset(): void {
        if (!this.paramBox || this.paramBox.children.length === 0) {
            return;
        }
        
        try {
            if (svgData && svgData.input) {
                const currentDataset = svgData.input.getParams().dataset;
                let newShape1: number | null = null;
                let newShape2: number | null = null;
                
                if (currentDataset === "cifar") {
                    newShape1 = 32;
                    newShape2 = 96;
                } else if (currentDataset === "mnist") {
                    newShape1 = 28;
                    newShape2 = 28;
                }
                
                if (newShape1 !== null && newShape2 !== null) {
                    // 更新参数框中的值
                    for (const line of this.paramBox.children) {
                        const name = (line.children[0] as HTMLElement).getAttribute("data-name");
                        if (name === "targetShape1" || name === "targetShape2") {
                            const inputElement = line.children[1] as HTMLInputElement;
                            if (inputElement && inputElement.type !== "checkbox") {
                                const currentValue = parseInt(inputElement.value, 10);
                                // 如果当前值是默认值（28或32），则更新为新值
                                if (name === "targetShape1") {
                                    if (currentValue === 28 || currentValue === 32) {
                                        inputElement.value = newShape1.toString();
                                    }
                                } else if (name === "targetShape2") {
                                    if (currentValue === 28 || currentValue === 96) {
                                        inputElement.value = newShape2.toString();
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            // 如果更新失败，忽略错误
        }
    }

    public select(): void {
        // 在选择时根据数据集更新参数框的值（在调用super.select()之前更新，确保layerShape()使用新值）
        this.updateParamBoxFromDataset();
        // 调用父类的select()，它会调用layerShape()来显示形状
        // layerShape()会重新生成所有层，所以会使用更新后的参数值
        super.select();
    }

    public clone(): Reshape {
        const newLayer = new Reshape(Point.randomPoint(100, 40, new Point(100, 250)));
        newLayer.paramBox = this.paramBox;
        return newLayer;
    }
}