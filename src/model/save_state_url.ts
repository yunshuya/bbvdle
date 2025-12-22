import { IDraggableData } from "../ui/app";
import { defaultTemplate, resetWorkspace } from "../ui/model_templates";
import { Input } from "../ui/shapes/layers/input";
import { Output } from "../ui/shapes/layers/output";
import { ISerializedNetwork, stateFromJson } from "./export_model";

export function storeNetworkInUrl(state: ISerializedNetwork): string {
    // To encode in URL
    return encodeURI(JSON.stringify(state));
}

/**
 * Load a network from a URL if possible. Otherwise, load the default workspace.
 * 注意：这个函数会更新传入的 svgData 对象，而不是返回新的对象
 */
export function loadStateIfPossible(existingSvgData?: IDraggableData): IDraggableData {
    console.log("loadStateIfPossible: 开始加载网络状态");
    
    // 如果传入了现有的 svgData，先清理它
    let svgData: IDraggableData;
    if (existingSvgData) {
        console.log("loadStateIfPossible: 使用现有的 svgData，先清理");
        svgData = existingSvgData;
        // 先清理现有的DOM元素和引用
        resetWorkspace(svgData);
    } else {
        // 如果没有传入，创建新的（向后兼容）
        console.log("loadStateIfPossible: 创建新的 svgData");
        svgData = {
            draggable : [],
            input: null,
            output: null,
        };
    }

    const urlParams: string = window.location.hash;
    console.log("loadStateIfPossible: URL参数长度:", urlParams.length);
    
    try {
        if (urlParams.length > 1) {
            console.log("loadStateIfPossible: 从URL加载网络状态");
            const network: ISerializedNetwork = JSON.parse(decodeURI(urlParams.slice(1)));

            // Serialize the model if it exists
            // stateFromJson 会更新传入的 svgData 对象，不需要重新赋值
            stateFromJson(svgData, network);
            console.log("loadStateIfPossible: 从URL加载完成，层数量:", svgData.draggable.length);
        } else {
            console.log("loadStateIfPossible: 创建默认模板");
            // 确保 input 和 output 存在
            if (!svgData.input) {
                svgData.input = new Input();
            }
            if (!svgData.output) {
                svgData.output = new Output();
            }
            defaultTemplate(svgData);
            console.log("loadStateIfPossible: 默认模板创建完成，层数量:", svgData.draggable.length);
        }
    } catch (err) {
        console.error("loadStateIfPossible: 加载失败，使用默认模板", err);
        // 确保 input 和 output 存在
        if (!svgData.input) {
            svgData.input = new Input();
        }
        if (!svgData.output) {
            svgData.output = new Output();
        }
        defaultTemplate(svgData);
        console.log("loadStateIfPossible: 错误恢复完成，层数量:", svgData.draggable.length);
    }

    // Used for getting positions of each draggable in terms of percents of svg canvas
    // useful if creating a new template
    // let canvasBoundingBox = getSvgOriginalBoundingBox(document.getElementById("svg"));
    // let width = canvasBoundingBox.width;
    // let height = canvasBoundingBox.height;

    // for (let draggable of svgData.draggable) {
    //     let pos = draggable.getPosition()
    //     console.log(pos.x / width, pos.y / height, draggable.getHoverText())
    // }

    history.replaceState(null, null, " ");

    console.log("loadStateIfPossible: 加载完成，最终层数量:", svgData.draggable.length);
    return svgData;
}
