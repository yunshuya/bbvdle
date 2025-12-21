import * as tf from "@tensorflow/tfjs";
import { displayError } from "../../error";
import { ActivationLayer } from "../activationlayer";
import { Line, PathShape, Point } from "../shape";

export class Multiply extends ActivationLayer {
    public layerType: string = "Multiply";
    public parameterDefaults: { [key: string]: any } = {};
    public readonly tfjsEmptyLayer: any = tf.layers.multiply;

    constructor(defaultLocation: Point = Point.randomPoint(100, 40, ActivationLayer.defaultInitialLocation)) {
        // 使用乘法符号 "×" 的形状设计
        // 主形状：一个矩形框
        // 内部：两条交叉的线形成 "×" 符号
        super([
            new PathShape("M-20 -20 h40 v40 h-40 v-40 Z", "#E67E22"),  // 橙色矩形背景
            new Line(new Point(-12, -12), new Point(12, 12), 4, "#FFFFFF"),  // 白色对角线（左上到右下）
            new Line(new Point(-12, 12), new Point(12, -12), 4, "#FFFFFF")   // 白色对角线（左下到右上）
        ], defaultLocation);
    }

    public populateParamBox(): void { 
        return; 
    }

    public getHoverText(): string { 
        return "Multiply"; 
    }

    public lineOfPython(): string {
        return `Multiply()`;
    }

    public initLineOfJulia(): string {
        displayError(Error("Export to Julia does not support Multiply Layers"));
        throw Error;
    }

    public generateTfjsLayer(): void {
        // Multiply层处理多个输入（类似Add层）
        const parents = [];
        for (const parent of this.parents) {
            parents.push(parent.getTfjsLayer());
        }
        this.tfjsLayer = this.tfjsEmptyLayer().apply(parents) as tf.SymbolicTensor;
    }

    public clone(): Multiply {
        const newLayer = new Multiply();
        return newLayer;
    }
}

