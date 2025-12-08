import { displayError } from "../ui/error";
import { dataset, AirPassengersData } from "./data";
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
        
        // 检测是否为时序数据
        const isTimeSeries = dataset instanceof AirPassengersData;
        
        // 对于RNN和LSTM层，我们需要检查输入形状并可能添加reshape层
        // 但对于时序数据（AirPassengers），数据已经是正确的3D格式，不需要reshape
        if (layer.layerType === "Recurrent" || layer.layerType === "LSTM") {
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
            } else if (isTimeSeries && parent && parent.layerType === "Input") {
                // 对于时序数据，Input层直接连接到LSTM，数据已经是正确的3D格式
                if (layer.parents.size === 1) {
                    applystring = `(x${parent.uid})`;
                } else if (layer.parents.size > 1) {
                    applystring = `([${[...layer.parents].map((p) => "x" + p.uid).join(", ")}])`;
                }
                pythonScript += `x${layer.uid} = ` + layerstring + applystring + "\n";
            } else {
                // 对于图像数据，如果父层不是Reshape层，自动添加reshape层
                // 将4D张量(批次, 28, 28, 1)转换为3D张量(批次, 28, 28)
                const parentUid = parent.uid;
                const imgRows = dataset.IMAGE_HEIGHT;
                const imgCols = dataset.IMAGE_WIDTH * dataset.IMAGE_CHANNELS;
                pythonScript += `# Reshape layer for ${layer.layerType} input\n`;
                pythonScript += `x_reshape_${layer.uid} = Reshape((${imgRows}, ${imgCols}))(x${parentUid})\n`;
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
    
    // 查找LSTM或RNN层以获取timestep参数（用于时序数据）
    let timestep = 12; // 默认值
    if (dataset instanceof AirPassengersData) {
        for (const layer of sorted) {
            if (layer.layerType === "LSTM" || layer.layerType === "Recurrent") {
                const rnnParams = layer.getParams();
                if (rnnParams.timestep) {
                    timestep = parseInt(rnnParams.timestep, 10);
                    break;
                }
            }
        }
    }
    
    return pythonSkeleton(pythonScript, timestep);
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