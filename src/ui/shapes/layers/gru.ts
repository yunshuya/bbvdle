import * as tf from "@tensorflow/tfjs";
import { ActivationLayer } from "../activationlayer";
import { PathShape, Point } from "../shape";

export class GRU extends ActivationLayer {
    public layerType: string = "GRU";
    public parameterDefaults: { [key: string]: any } = { units: 32, returnSequences: false };
    public readonly tfjsEmptyLayer: any = tf.layers.gru;

    constructor(defaultLocation: Point = Point.randomPoint(100, 40, ActivationLayer.defaultInitialLocation)) {
        super([new PathShape("M-10 -70 h20 v90 h-6 v-10 h-8 v10 h-6 v-90 Z", "#D58C6C")], defaultLocation);
    }

    public populateParamBox(): void {
        const line1 = document.createElement("div");
        line1.className = "paramline";
        const name1 = document.createElement("div");
        name1.className = "paramname";
        name1.innerHTML = "Units:";
        name1.setAttribute("data-name", "units");
        const value1 = document.createElement("input");
        value1.className = "paramvalue layerparamvalue";
        value1.value = "32";
        line1.appendChild(name1);
        line1.appendChild(value1);
        this.paramBox.append(line1);

        const line2 = document.createElement("div");
        line2.className = "paramline selectline";
        const name2 = document.createElement("div");
        name2.className = "paramname";
        name2.innerHTML = "Return sequences:";
        name2.setAttribute("data-name", "returnSequences");
        const selectDiv = document.createElement("div");
        selectDiv.className = "select";
        const arrow = document.createElement("div");
        arrow.className = "select__arrow";
        const select = document.createElement("select");
        select.className = "parameter-select";
        for (const value of [["false", "False"], ["true", "True"]]) {
            const option = document.createElement("option");
            option.value = value[0];
            option.innerHTML = value[1];
            select.appendChild(option);
        }
        line2.appendChild(name2);
        line2.appendChild(selectDiv);
        selectDiv.appendChild(select);
        selectDiv.appendChild(arrow);
        this.paramBox.append(line2);

        this.focusing();
    }

    public getHoverText(): string { return "GRU"; }

    public lineOfPython(): string {
        const params = this.getParams();
        const activation = this.getActivationText();
        const activationText = activation == null ? "" : `, activation='${activation}'`;
        return `GRU(${params.units}, return_sequences=${params.returnSequences}${activationText})`;
    }

    public initLineOfJulia(): string {
        return `# GRU not supported for Julia export\n`;
    }

    public clone(): GRU {
        const newLayer = new GRU(Point.randomPoint(100, 40, ActivationLayer.defaultInitialLocation));
        newLayer.paramBox = this.paramBox;
        newLayer.activation = this.activation;
        return newLayer;
    }
}


