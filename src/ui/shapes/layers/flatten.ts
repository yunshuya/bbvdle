import * as tf from "@tensorflow/tfjs";
import { displayError } from "../../error";
import { ActivationLayer } from "../activationlayer";
import { Layer } from "../layer";
import { PathShape, Point } from "../shape";

export class Flatten extends Layer {
    public layerType: string = "Flatten";
    public parameterDefaults: { [key: string]: any } = {};
    public readonly tfjsEmptyLayer: any  = tf.layers.flatten;

    constructor(defaultLocation: Point = Point.randomPoint(100, 40, ActivationLayer.defaultInitialLocation)) {
        super([new PathShape("M-90 -90 h15 v-30 h15 v100 h-15 v-30 h-15 v-40 Z", "#AA222F")], defaultLocation);
    }

    public populateParamBox(): void {return; }

    public getHoverText(): string { return "Flatten"; }

    public lineOfPython(): string {
        return `Flatten()`;
    }

    public initLineOfJulia(): string {
        return `x${this.uid} = insert!(net, (shape) -> (x) -> reshape(x, :, size(x, 4)))\n`;
    }

    public clone(): Flatten {
        return new Flatten();
    }

    public generateTfjsLayer(): void {
        // Flatten 层将输入展平为 2D [batch, features]
        let parent: Layer = null;
        if (this.parents.size > 1) {
            displayError(new Error("Flatten layer cannot have multiple parents"));
        }
        for (const p of this.parents) { 
            parent = p; 
            break; 
        }
        
        if (!parent) {
            throw new Error("Flatten layer must have a parent");
        }
        
        const parentLayer = parent.getTfjsLayer();
        this.tfjsLayer = this.tfjsEmptyLayer().apply(parentLayer);
    }
}
