import * as tf from "@tensorflow/tfjs";
import { dataset, AirPassengersData } from "../../../model/data";
import { getSvgOriginalBoundingBox } from "../../utils";
import { Layer } from "../layer";
import { Point, Rectangle } from "../shape";

export class Input extends Layer {
    public layerType: string = "Input";
    public parameterDefaults: { [key: string]: any } = {};
    public readonly tfjsEmptyLayer: any = tf.input;

    public defaultLocation: Point = new Point(100,
        getSvgOriginalBoundingBox(document.getElementById("svg") as any as SVGSVGElement).height / 2);

    constructor() {
        super([new Rectangle(new Point(0, 0), 40, 40, "#806CB7")],
              new Point(100,
                getSvgOriginalBoundingBox(document.getElementById("svg") as any as SVGSVGElement).height / 2));
    }

    public getHoverText(): string { return "Input"; }

    public delete(): void { this.unselect(); }

    public populateParamBox(): void {
        // Dataset input box
        // TODO: separate this logic out.
        const line = document.createElement("div");
        line.className = "paramline selectline";

        const name = document.createElement("div");
        name.className = "paramname";
        name.innerHTML = "Dataset:";
        name.setAttribute("data-name", "dataset");

        const selectDiv = document.createElement("div");
        selectDiv.className = "select";

        const arrow = document.createElement("div");
        arrow.className = "select__arrow";

        const select = document.createElement("select");
        select.className = "parameter-select";

        for (const value of [["mnist", "MNIST"], ["cifar", "Cifar-10"], ["airpassengers", "AirPassengers"]]) {
            const option = document.createElement("option");
            option.value = value[0];
            option.innerHTML = value[1];
            select.appendChild(option);
        }

        line.appendChild(name);
        line.appendChild(selectDiv);
        selectDiv.appendChild(select);
        selectDiv.appendChild(arrow);
        this.paramBox.append(line);
        this.focusing();
    }

    public generateTfjsLayer(): void {
        // TODO make this a member variable
        // 对于时序数据（AirPassengers），使用[timeSteps, features]格式
        // 对于图像数据（MNIST/CIFAR），使用[height, width, channels]格式
        const params = this.getParams();
        const isTimeSeries = params.dataset === "airpassengers" || 
                           (dataset as any).pythonName === "airpassengers";
        
        if (isTimeSeries) {
            // 时序数据: [timeSteps, features]
            // 尝试从第一个LSTM或RNN子层读取timestep参数
            let timestep = dataset.IMAGE_HEIGHT; // 默认使用数据集的timestep
            const rnnLayer = this.findFirstRNNOrLSTMLayer();
            if (rnnLayer) {
                const rnnParams = rnnLayer.getParams();
                if (rnnParams.timestep) {
                    timestep = parseInt(rnnParams.timestep, 10);
                    // 同步更新数据集的timestep
                    if (dataset instanceof AirPassengersData) {
                        dataset.setTimeSteps(timestep);
                    }
                }
            }
            this.tfjsLayer = this.tfjsEmptyLayer({shape: [
                timestep,
                dataset.IMAGE_WIDTH]});
        } else {
            // 图像数据: [height, width, channels]
            this.tfjsLayer = this.tfjsEmptyLayer({shape: [
                dataset.IMAGE_HEIGHT,
                dataset.IMAGE_WIDTH,
                dataset.IMAGE_CHANNELS]});
        }
    }

    /**
     * 查找第一个RNN或LSTM子层（递归查找）
     */
    private findFirstRNNOrLSTMLayer(): any {
        const visited = new Set<Layer>();
        const queue: Layer[] = [];
        
        // 从当前层的所有子层开始
        for (const child of this.children) {
            queue.push(child);
        }
        
        while (queue.length > 0) {
            const layer = queue.shift();
            if (visited.has(layer)) {
                continue;
            }
            visited.add(layer);
            
            // 如果找到LSTM或RNN层，返回它
            if (layer.layerType === "LSTM" || layer.layerType === "Recurrent") {
                return layer;
            }
            
            // 继续查找子层
            for (const child of layer.children) {
                if (!visited.has(child)) {
                    queue.push(child);
                }
            }
        }
        
        return null;
    }

    public lineOfPython(): string {
        // Relies on an input_shape being defined in the python skeleton
        return `Input(shape=input_shape)`;
    }

    public initLineOfJulia(): string {
        return `x${this.uid} = insert!(net, (shape) -> x -> x)\n`;
    }

    public clone(): Input {
        const newLayer = new Input();
        return newLayer;
    }
}
