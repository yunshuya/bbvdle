import { displayError } from "../ui/error";
import { ActivationLayer } from "../ui/shapes/activationlayer";
import { Layer } from "../ui/shapes/layer";
import { juliaSkeleton } from "./julia_skeleton";
import { pythonSkeleton } from "./python_skeleton";
/**
 * Creates corresponding Python code.
 * @param sorted topologically sorted list of layers
 */
export function generatePython(sorted: Layer[]): string {
    let pythonScript: string = "";
    for (const layer of sorted) {
        const layerstring = layer.lineOfPython();
        let applystring = ""; // Nothing to apply if no parents (input)
        
        // 对于RNN层，我们需要检查输入形状并可能添加reshape层来处理MNIST数据
        // 但如果用户已经手动添加了Reshape层，就不需要自动添加了
        if (layer.layerType === "Recurrent") {
            // 获取父层
            const parent = layer.parents.values().next().value;
            
            // 检查父层是否是Reshape层
            if (parent && parent.layerType === "Reshape") {
                // 如果父层是Reshape层，直接使用父层的输出
                if (layer.parents.size === 1) {
                    applystring = `(x${parent.uid})`;
                } else if (layer.parents.size > 1) {
                    applystring = `([${[...layer.parents].map((p) => "x" + p.uid).join(", ")}])`;
                }
                pythonScript += `x${layer.uid} = ` + layerstring + applystring + "\n";
            } else {
                // 如果父层不是Reshape层，自动添加reshape层来将4D张量(批次, 28, 28, 1)转换为3D张量(批次, 28, 28)
                const parentUid = parent.uid;
                pythonScript += `# Reshape layer for RNN input\n`;
                pythonScript += `x_reshape_${layer.uid} = Reshape((28, 28))(x${parentUid})\n`;
                pythonScript += `x${layer.uid} = ` + layerstring + `(x_reshape_${layer.uid})` + "\n";
            }
        } else {
            if (layer.parents.size === 1) {
                applystring = `(x${layer.parents.values().next().value.uid})`;
            } else if (layer.parents.size > 1) {
                applystring = `([${[...layer.parents].map((p) => "x" + p.uid).join(", ")}])`;
            }
            pythonScript += `x${layer.uid} = ` + layerstring + applystring + "\n";
        }
        
        // TODO: Move this to BatchNorm and generalize layerstring to an array
        if (layer.layerType === "BatchNorm" && (layer as ActivationLayer).activation != null) {
            if (this.activation != null && this.activation.activationType !== "relu") {
                displayError(new Error("Batch Normalization does not support activations other than ReLu"));
            }
            pythonScript += `x${layer.uid} = ` + "ReLU()" + `(x${layer.uid})` + "\n";
        }
    }
    pythonScript += `model = Model(inputs=x${sorted[0].uid}, outputs=x${sorted[sorted.length - 1].uid})`;
    return pythonSkeleton(pythonScript);
}
/**
 * Creates corresponding Julia code.
 * @param sorted topologically sorted list of layers
 */
export function generateJulia(sorted: Layer[]): string {
    let juliaInitialization: string = "";
    let juliaScript: string = "";
    for (const layer of sorted) {
        juliaInitialization += layer.initLineOfJulia();
        juliaScript += layer.lineOfJulia();
    }
    return juliaSkeleton(juliaInitialization, juliaScript);
}