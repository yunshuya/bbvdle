import * as tf from "@tensorflow/tfjs";
import { displayError } from "../../error";
import { getSvgOriginalBoundingBox } from "../../utils";
import { dataset, AirPassengersData } from "../../../model/data";
import { ActivationLayer } from "../activationlayer";
import { Layer } from "../layer";
import { Point, Rectangle } from "../shape";

export class Output extends ActivationLayer {
    public layerType: string = "Output";
    public parameterDefaults: { [key: string]: any } = {units: 10, activation: "softmax"};
    public readonly tfjsEmptyLayer: any = tf.layers.dense ;
    public readonly outputWiresAllowed: boolean = false;
    public readonly wireGuidePresent: boolean = false;

    public defaultLocation: Point = new Point(
        getSvgOriginalBoundingBox(document.getElementById("svg") as any as SVGSVGElement).width - 100,
        getSvgOriginalBoundingBox(document.getElementById("svg") as any as SVGSVGElement).height / 2);
    private juliaFinalLineId: number = null;
    constructor() {
        super([new Rectangle(new Point(-8, -90), 30, 200, "#806CB7")],
               new Point(getSvgOriginalBoundingBox(document.getElementById("svg") as any as SVGSVGElement).width - 100,
               getSvgOriginalBoundingBox(document.getElementById("svg") as any as SVGSVGElement).height / 2));

    }

    public getHoverText(): string { return "Output"; }

    public delete(): void { this.unselect(); }

    public populateParamBox(): void {return; }

    public lineOfPython(): string {
        // 检测是否为时序数据（回归任务）
        const isTimeSeries = dataset instanceof AirPassengersData;
        
        if (isTimeSeries) {
            // 回归任务：1个输出单元，无激活函数
            return `Dense(1)`;
        } else {
            // 分类任务：使用数据集类别数，softmax激活
            return `Dense(${dataset.NUM_CLASSES}, activation='softmax')`;
        }
    }

    public initLineOfJulia(): string {
        let init = `x${this.uid} = insert!(net, (shape) -> Dense(shape[1], 10))\n`;
        if (this.juliaFinalLineId == null) {
            this.juliaFinalLineId = Layer.getNextID();
        }
        init += `x${this.juliaFinalLineId} = insert!(net, (shape) -> (x) -> softmax(x))`;
        return init;
    }

    public lineOfJulia(): string {
        const connections = super.lineOfJulia();
        return connections + `connect!(net, x${this.uid}, x${this.juliaFinalLineId})`;
    }

    public clone(): Output {
        const newLayer = new Output();
        newLayer.paramBox = this.paramBox;
        return newLayer;
    }

    public addChild(_: Layer): void {
        displayError(new Error("Output cannot have children. "));
    }

    public generateTfjsLayer(): void {
        // Output层需要创建一个新的Dense层，根据数据集类型设置正确的输出单元数
        // 检测是否为时序数据（回归任务）
        const isTimeSeries = dataset instanceof AirPassengersData;
        
        // 使用parameterDefaults作为基础
        const parameters = { ...this.parameterDefaults };
        
        // 根据数据集类型设置正确的units
        if (isTimeSeries) {
            // 时序数据：回归任务，输出1个值
            parameters.units = 1;
            // 回归任务不需要softmax激活函数
            parameters.activation = undefined;
        } else {
            // 分类任务：根据数据集设置类别数
            if (dataset && 'NUM_CLASSES' in dataset) {
                parameters.units = dataset.NUM_CLASSES;
            } else {
                // 如果数据集尚未加载，使用默认值 10（MNIST 和 CIFAR-10 都是 10）
                parameters.units = 10;
            }
            // 分类任务使用softmax激活函数
            parameters.activation = "softmax";
        }
        
        // 确保units是整数
        parameters.units = parseInt(parameters.units, 10);

        let parent: Layer = null;
        if (this.parents.size > 1) {
            displayError(new Error("Output层不能有多个父层"));
        }
        for (const p of this.parents) { 
            parent = p; 
            break; 
        }

        if (!parent) {
            throw new Error("Output层必须有一个父层");
        }

        // 创建新的Dense层，根据数据集类型设置正确的输出单元数和激活函数
        this.tfjsLayer = this.tfjsEmptyLayer(parameters).apply(parent.getTfjsLayer());
    }
}
