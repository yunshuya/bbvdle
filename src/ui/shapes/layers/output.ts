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
        // Output层仅作为模型输出标记，直接复用父层（通常是Dense层）的输出
        // 不需要创建新的Dense层，因为Dense层已经在模型结构中独立定义
        let parent: Layer = null;
        for (const p of this.parents) { 
            parent = p; 
            break; 
        }

        if (!parent) {
            throw new Error("Output层必须有一个父层");
        }

        // 直接复用父层的输出，无需重新创建Dense层
        this.tfjsLayer = parent.getTfjsLayer();
    }
}
