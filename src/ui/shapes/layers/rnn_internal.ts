import * as tf from "@tensorflow/tfjs";
import { ActivationLayer } from "../activationlayer";
import { Layer } from "../layer";
import { PathShape, Point } from "../shape";
import { RNNCell } from "./rnn_cell";

/**
 * RNN Internal 层 - 使用 tf.layers.rnn 包装自定义 RNN Cell
 * 这个层处理时间步循环，使用自定义 Cell 进行计算
 */
export class RNNInternal extends ActivationLayer {
    public layerType: string = "RNNInternal";
    public parameterDefaults: { [key: string]: any } = {
        units: 128,
        returnSequences: false,
        dropout: 0.2,
    };
    public readonly tfjsEmptyLayer: any = null;
    private rnnCell: RNNCell | null = null;

    constructor(defaultLocation: Point = Point.randomPoint(100, 40, ActivationLayer.defaultInitialLocation)) {
        super([
            new PathShape("M-8 -90 h26 v100 h-8 v-10 h-10 v10 h-8 v-100 Z", "#8B4513"),
        ], defaultLocation);
    }

    public setRNNCell(cell: RNNCell): void {
        this.rnnCell = cell;
    }

    public populateParamBox(): void {
        const info = document.createElement("div");
        info.className = "paramline";
        info.style.color = "#666";
        info.style.fontSize = "12px";
        info.innerHTML = "RNN Internal（使用自定义 Cell）";
        this.paramBox.append(info);
        this.focusing();
    }

    public getHoverText(): string { 
        return "RNN Internal\n(使用 Dense + Tanh 实现)"; 
    }

    public lineOfPython(): string {
        return "# RNN Internal (uses custom cell)";
    }

    public initLineOfJulia(): string {
        return "# RNN Internal (uses custom cell)\n";
    }

    public generateTfjsLayer(): void {
        if (!this.rnnCell) {
            throw new Error("RNNInternal layer requires an RNNCell");
        }

        const params = this.getParams();
        const returnSequences = Boolean(params.returnSequences);

        let parent: Layer = null;
        for (const p of this.parents) { 
            parent = p; 
            break; 
        }
        
        if (!parent) {
            throw new Error("RNNInternal layer must have a parent layer");
        }
        
        const parentLayer = parent.getTfjsLayer();
        
        // 创建自定义 RNN Cell
        const customCell = this.rnnCell.createRNNCell();
        
        // 使用 tf.layers.rnn 包装 Cell，处理时间步循环
        const rnnLayer = tf.layers.rnn({
            cell: customCell,
            returnSequences: returnSequences,
            returnState: false
        });
        
        this.tfjsLayer = rnnLayer.apply(parentLayer) as tf.SymbolicTensor;
    }

    public clone(): RNNInternal {
        return new RNNInternal();
    }
}

