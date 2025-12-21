import * as tf from "@tensorflow/tfjs";
import * as d3 from "d3";
import { generateTfjsModel, topologicalSort } from "../../model/build_network";
import { changeDataset } from "../../model/data";
import { svgData, sendLayerContextToAi } from "../app";
import { displayError, clearError } from "../error";
import { parseString } from "../utils";
import { windowProperties } from "../window";
import { Draggable } from "./draggable";
import { Point, Shape } from "./shape";
import { Wire } from "./wire";
import { CircularWire } from "./circularwire";


export interface ILayerJson {
    layer_name: string;
    id: number;
    children_ids: number[];
    parent_ids: number[];
    params: any;
    xPosition: number;
    yPosition: number;
}

// TODO params for entering things in UI for layer properties

export abstract class Layer extends Draggable {

    public static getNextID(): number {
        const id = Layer.nextID;
        Layer.nextID += 1;
        return id;
    }

    private static nextID: number = 0;   // a global id counter for labeling layers
    public layerType: string = "";  // A string indicating layer type for each layer used for serialization
    public parameterDefaults: { [key: string]: any };  // tfjs keys for layer parameters to input values
    public children: Set<Layer> = new Set();  // Predecessors (closer to the input layer)
    public parents: Set<Layer> = new Set();  // Successors (closer to the output layer)
    public wires: Set<Wire> = new Set();  // The line objects connecting this layer to other layers
    public circularWires: Set<CircularWire> = new Set();  // The circular wire objects for recurrent connections
    public uid: number;  // Each layer gets a unique ID
    public shape: number[];  // The shape/dimensions of the layer.

    public readonly outputWiresAllowed: boolean = true;
    public readonly wireGuidePresent: boolean = true;
    protected tfjsLayer: tf.SymbolicTensor;

    protected readonly tfjsEmptyLayer: any;
    protected paramBox: HTMLElement;
    private selectText: any = d3.select("body")
                        .append("div")
                        .style("position", "absolute")
                        .style("padding", "6px")
                        .style("background", "rgba(0, 0, 0, 0.8)")
                        .style("color", "#eee")
                        .style("border-radius", "2px")
                        .style("display", "none")
                        .style("font-family", "Helvetica")
                        .style("user-select", "none");

    private block: Shape[];
    private aiHandle: d3.Selection<SVGGElement, unknown, HTMLElement, any> | null = null;

    constructor(block: Shape[], defaultLocation: Point) {
        super(defaultLocation);
        this.uid = Layer.nextID;
        Layer.nextID += 1;
        this.block = block;

        for (const rect of this.block) {
            this.svgComponent.call(rect.svgAppender.bind(rect));
        }

        this.paramBox = document.createElement("div");
        this.paramBox.className = "parambox";
        this.paramBox.style.visibility = "hidden";
        this.paramBox.style.position = "absolute";
        document.getElementById("paramtruck").appendChild(this.paramBox);

        // 移除原有的点击事件，重新绑定以支持AI圆点
        this.svgComponent.on("click.layer", function() {
                             this.select();
                             window.clearTimeout(this.moveTimeout);
                             this.hoverText.style("visibility", "hidden");
                        }.bind(this));
        this.populateParamBox();
        this.initializeAiHandle();
    }
    public abstract lineOfPython(): string;
    public abstract getHoverText(): string;
    public abstract clone(): Layer;

    private initializeAiHandle(): void {
        this.aiHandle = this.svgComponent.append<SVGGElement>("g")
            .attr("class", "ai-handle")
            .style("display", "none")
            .style("cursor", "pointer")
            .style("pointer-events", "all"); // 确保可以接收点击事件

        const circle = this.aiHandle.append("circle")
            .attr("r", 10)
            .style("pointer-events", "all");

        this.aiHandle.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .text("AI")
            .style("pointer-events", "none"); // 文本不接收事件，由circle接收

        // 使用D3事件处理，阻止事件冒泡
        this.aiHandle.on("click.ai-handle", function() {
            const d3Event = d3.event;
            if (d3Event) {
                d3Event.stopPropagation();
            }
            console.log("AI圆点被点击，层类型:", this.layerType);
            if (sendLayerContextToAi) {
                sendLayerContextToAi(this);
            }
        }.bind(this));
        
        // 在circle上也绑定事件
        circle.on("click.ai-handle", function() {
            const d3Event = d3.event;
            if (d3Event) {
                d3Event.stopPropagation();
            }
            console.log("AI圆点被点击（circle），层类型:", this.layerType);
            if (sendLayerContextToAi) {
                sendLayerContextToAi(this);
            }
        }.bind(this));
        
        // 阻止mousedown事件冒泡，避免触发拖拽
        this.aiHandle.on("mousedown.ai-handle", function() {
            const d3Event = d3.event;
            if (d3Event) {
                d3Event.stopPropagation();
            }
        }.bind(this));
        
        circle.on("mousedown.ai-handle", function() {
            const d3Event = d3.event;
            if (d3Event) {
                d3Event.stopPropagation();
            }
        }.bind(this));
        
        // 确保AI圆点在DOM中位于最后，这样在视觉上会显示在最上层
        this.aiHandle.raise();
    }

    private positionAiHandle(): void {
        if (!this.aiHandle) {
            return;
        }
        const previousDisplay = this.aiHandle.style("display");
        this.aiHandle.style("display", "none");
        const bbox = this.outerBoundingBox();
        this.aiHandle.style("display", previousDisplay);

        const offset = 12;
        const x = bbox.right + offset;
        const y = bbox.top - offset;
        this.aiHandle.attr("transform", `translate(${x}, ${y})`);
    }

    private showAiHandle(): void {
        if (!this.aiHandle) {
            return;
        }
        this.positionAiHandle();
        this.aiHandle.style("display", "block");
        // 确保AI圆点在视觉上位于最上层
        this.aiHandle.raise();
    }

    private hideAiHandle(): void {
        if (this.aiHandle) {
            this.aiHandle.style("display", "none");
        }
    }

    public moveAction(): void {
        for (const wire of this.wires) {
            wire.updatePosition();
        }
        
        // 更新所有循环连接的位置
        for (const cw of this.circularWires) {
            cw.updatePosition();
        }
        
        // 更新所有指向此层的循环连接
        // 通过 svgData 访问所有层
        for (const draggable of svgData.draggable) {
            if (draggable instanceof Layer) {
                for (const cw of draggable.circularWires) {
                    // 检查循环连接的目标是否是当前层
                    if (cw.dest === this) {
                        cw.updatePosition();
                    }
                }
            }
        }

        if (windowProperties.selectedElement === this) {
            windowProperties.shapeTextBox.setPosition(this.getPosition());
            this.positionAiHandle();
        }
    }

    public raise(): void {
        this.wires.forEach((w) => w.raiseGroup());
        this.circularWires.forEach((cw) => cw.raiseGroup());
        this.parents.forEach((p) => p.raiseGroup());
        this.children.forEach((c) => c.raiseGroup());
        this.raiseGroup();
    }

    public select(): void {
        // 检查是否处于循环连接选择模式（新的实现：不依赖 CircularConnection 积木块）
        const selectMode = (window as any).circularConnectionSelectMode;
        console.log("Layer.select() 被调用，selectMode:", selectMode, "layerType:", this.layerType);
        
        if (selectMode && selectMode.step) {
            console.log("检测到循环连接选择模式，当前步骤:", selectMode.step);
            
            if (selectMode.step === "source") {
                // 选择源层
                // 检查是否已经选择了源层（防止重复点击）
                if (selectMode.sourceLayer === this) {
                    console.log("源层已经选择，请点击目标层");
                    return;  // 已经选择了这个层作为源层，不执行任何操作
                }
                
                selectMode.sourceLayer = this;
                selectMode.step = "target";
                console.log(`✓ 源层已选择: ${this.layerType}，请点击目标层`);
                // 显示提示信息（不抛出错误，只显示消息）
                const errorElement = document.getElementById("error");
                const errorMessageElement = document.getElementById("errorMessage");
                if (errorElement && errorMessageElement) {
                    errorElement.style.display = null;
                    errorMessageElement.innerHTML = `源层已选择: ${this.layerType}，请点击目标层`;
                    errorElement.title = `源层已选择: ${this.layerType}，请点击目标层`;
                    // 3秒后自动清除
                    setTimeout(() => {
                        clearError();
                    }, 3000);
                }
                // 不执行正常的 select 逻辑，但也不阻止用户看到选中效果
                // 让用户知道源层已被选中
                this.svgComponent.selectAll("path").style("stroke", "#4169E1").style("stroke-width", "3");
                this.svgComponent.selectAll(".outerShape").style("stroke", "#4169E1").style("stroke-width", "3");
                this.svgComponent.classed("layer-selected", true);
                windowProperties.selectedElement = this;
                return;
            } else if (selectMode.step === "target") {
                // 选择目标层，自动创建循环连接
                const sourceLayer = selectMode.sourceLayer;
                
                // 检查源层是否已选择
                if (!sourceLayer) {
                    console.error("错误：源层未选择，无法创建循环连接");
                    // 重置选择模式
                    (window as any).circularConnectionSelectMode = null;
                    return;
                }
                
                // 检查是否点击了源层本身（自循环）
                if (sourceLayer === this) {
                    console.log("警告：不能选择源层本身作为目标层，请选择不同的层");
                    // 显示提示信息
                    const errorElement = document.getElementById("error");
                    const errorMessageElement = document.getElementById("errorMessage");
                    if (errorElement && errorMessageElement) {
                        errorElement.style.display = null;
                        errorMessageElement.innerHTML = "不能选择源层本身作为目标层，请选择不同的层";
                        errorElement.title = "不能选择源层本身作为目标层，请选择不同的层";
                        setTimeout(() => {
                            clearError();
                        }, 3000);
                    }
                    return;  // 不创建循环连接
                }
                
                selectMode.targetLayer = this;
                const targetLayer = selectMode.targetLayer;
                const labelText = selectMode.labelText || undefined;
                
                console.log("准备创建循环连接，源层:", sourceLayer?.layerType, "目标层:", targetLayer?.layerType);
                
                if (sourceLayer && targetLayer) {
                    try {
                        // 创建循环连接（蓝色虚线箭头）
                        sourceLayer.addCircularConnection(targetLayer, labelText);
                        console.log(`✓ 循环连接已创建（蓝色虚线箭头）: ${sourceLayer.layerType} → ${targetLayer.layerType}`);
                        
                        // 确保循环连接正确显示（强制更新位置）
                        // 延迟更新，确保 DOM 已更新
                        setTimeout(() => {
                            for (const cw of sourceLayer.circularWires) {
                                if (cw.dest === targetLayer) {
                                    cw.updatePosition();
                                    const pathString = cw.path.attr("d");
                                    console.log("循环连接位置已更新，路径:", pathString);
                                    if (!pathString || pathString === "null" || pathString === "") {
                                        console.warn("警告：循环连接路径为空，重新计算");
                                        cw.updatePosition();
                                    }
                                    break;
                                }
                            }
                        }, 10);
                        
                        // 触发任务验证（异步导入避免循环依赖）
                        setTimeout(() => {
                            import("../taskModule").then(module => {
                                module.verifyCircularConnectionStep();
                            }).catch(err => {
                                console.warn("无法导入任务验证模块:", err);
                            });
                        }, 0);
                        
                        // 清除选择模式，恢复正常的 select 逻辑
                        (window as any).circularConnectionSelectMode = null;
                        clearError();
                        console.log("循环连接选择模式已清除");
                        
                        // 恢复目标层的正常选中状态（显示黄色边框）
                        this.svgComponent.selectAll("path").style("stroke", "yellow").style("stroke-width", "2");
                        this.svgComponent.selectAll(".outerShape").style("stroke", "yellow").style("stroke-width", "2");
                        this.svgComponent.classed("layer-selected", true);
                        windowProperties.selectedElement = this;
                        
                        // 重要：阻止创建普通的 Wire 连接
                        // 因为循环连接不应该创建父子关系，所以需要阻止 addChild 被调用
                        // 通过 return 来阻止继续执行正常的 select 逻辑
                        return;
                    } catch (error) {
                        console.error("创建循环连接时出错:", error);
                        displayError(error as Error);
                        // 即使出错，也要清除选择模式，恢复正常的 select 逻辑
                        (window as any).circularConnectionSelectMode = null;
                    }
                } else {
                    console.error("源层或目标层为空，无法创建循环连接");
                    // 即使出错，也要清除选择模式，恢复正常的 select 逻辑
                    (window as any).circularConnectionSelectMode = null;
                }
                // 如果创建循环连接失败，继续执行正常的 select 逻辑
                // 但成功创建后应该 return，不执行正常的 select 逻辑
            } else {
                // 如果选择模式存在但没有 step，清除它并继续正常逻辑
                (window as any).circularConnectionSelectMode = null;
            }
            
            // 如果选择模式已被清除，继续执行正常的 select 逻辑
            // 如果选择模式仍然存在，不执行正常的 select 逻辑
            if ((window as any).circularConnectionSelectMode !== null) {
                return;  // 仍在选择模式中，不执行正常的 select 逻辑
            }
        }

        const currSelected = windowProperties.selectedElement;
        if (currSelected != null && currSelected !== this &&
                currSelected instanceof Layer && currSelected.outputWiresAllowed) {
            currSelected.addChild(this);
           
        }
        super.select();
        document.getElementById("defaultparambox").style.display = "none";
        this.paramBox.style.visibility = "visible";
        this.svgComponent.selectAll("path").style("stroke", "yellow").style("stroke-width", "2");
        this.svgComponent.selectAll(".outerShape").style("stroke", "yellow").style("stroke-width", "2");
        this.svgComponent.classed("layer-selected", true);
        this.showAiHandle();

        const bbox = this.outerBoundingBox();
        windowProperties.shapeTextBox.setOffset(new Point((bbox.left + bbox.right) / 2, bbox.bottom + 25));
        // 修复：检查 layerShape() 是否返回 null，避免 toString() 错误
        const shape = this.layerShape();
        if (shape !== null && shape !== undefined) {
            windowProperties.shapeTextBox.setText("[" + shape.toString() + "]");
        } else {
            windowProperties.shapeTextBox.setText("[?]");
        }
        windowProperties.shapeTextBox.setPosition(this.getPosition());
        windowProperties.shapeTextBox.show();
    }

    public unselect(): void {
        super.unselect();
        document.getElementById("defaultparambox").style.display = null;
        this.paramBox.style.visibility = "hidden";
        this.svgComponent.selectAll("path").style("stroke", null).style("stroke-width", null);
        this.svgComponent.selectAll(".outerShape").style("stroke", null).style("stroke-width", null);
        this.svgComponent.classed("layer-selected", false);
        this.hideAiHandle();
        this.selectText.style("visibility", "hidden");
        windowProperties.shapeTextBox.hide();

    }

    /**
     * Add a child layer of this node (successor).
     * @param child the layer pointed to by the given wire
     */
    public addChild(child: Layer): void {
        if (!this.children.has(child) && !child.children.has(this)) {
            this.children.add(child);
            child.parents.add(this);

            const newWire = new Wire(this, child);
            this.wires.add(newWire);
            child.wires.add(newWire);

        }
        // if(isTaskAlready){
            
        //     verifyStepCompletion(this);
        // }
    }

    /**
     * Add a parent layer of this node (predecessor).
     * @param parent the layer pointed to by the given wire
     */
    public addParent(parent: Layer): void {
        parent.addChild(this);
       
    }

    /**
     * 添加循环连接（用于LSTM等循环结构）
     * @param target 目标层（通常是同一层或前一时刻的层）
     * @param labelText 可选的标签文本（如 "t+1"）
     */
    public addCircularConnection(target: Layer, labelText?: string): void {
        // 检查是否已存在相同的循环连接
        for (const cw of this.circularWires) {
            if (cw.dest === target) {
                return;  // 已存在，不重复添加
            }
        }

        const circularWire = new CircularWire(this, target, labelText);
        this.circularWires.add(circularWire);
        target.circularWires.add(circularWire);
    }

    /**
     * 删除所有循环连接
     */
    public deleteCircularWires(): void {
        this.circularWires.forEach((cw) => cw.delete());
        this.circularWires.clear();
    }

    public delete(): void {
        super.delete();
        this.wires.forEach((w) => w.delete()); // deleting wires should delete layer connection sets
        this.deleteCircularWires();  // 删除循环连接
    }

    public toJson(): ILayerJson {
        return {
            children_ids: Array.from(this.children, (child) => child.uid),
            id: this.uid,
            layer_name: this.layerType,
            params: this.getJSONParams(),
            parent_ids: Array.from(this.parents, (parent) => parent.uid),
            xPosition: this.getPosition().x,
            yPosition: this.getPosition().y,
        };
    }

    public getJSONParams(): { [key: string]: any } {
        const params: { [key: string]: any } = {};
        const defaultParams = this.parameterDefaults;
        for (const line of this.paramBox.children) {
            const name = line.children[0].getAttribute("data-name");
            if (line.children[1].className === "select") {
                const selectElement: HTMLSelectElement =  line.children[1].children[0] as HTMLSelectElement;
                params[name] = selectElement.options[selectElement.selectedIndex].value;
            } else {
                const inputElement = line.children[1] as HTMLInputElement;
                // 处理checkbox类型
                if (inputElement.type === "checkbox") {
                    params[name] = inputElement.checked;
                } else {
                    const value = inputElement.value;
                    // Need to not parse as integer for float parameters
                    // 安全检查：确保defaultParams中存在该参数，避免undefined.toString()错误
                    if (defaultParams[name] !== undefined && defaultParams[name] !== null) {
                        if ((defaultParams[name].toString()).indexOf(".") >= 0) {
                            params[name] = parseFloat(value);
                        } else {
                            params[name] = parseString(value);
                        }
                    } else {
                        // 如果参数不在defaultParams中，尝试根据值判断类型
                        // 如果值包含小数点，解析为浮点数；否则解析为字符串
                        if (value.indexOf(".") >= 0 && !isNaN(parseFloat(value))) {
                            params[name] = parseFloat(value);
                        } else {
                            params[name] = parseString(value);
                        }
                    }
                }
            }
        }
        return params;
    }

    public getParams(): { [key: string]: any; } {
        const params: { [key: string]: any } = {};
        const defaultParams = this.parameterDefaults;
        for (const line of this.paramBox.children) {
            const name = line.children[0].getAttribute("data-name");
            if (line.children[1].className === "select") {
                const selectElement: HTMLSelectElement =  line.children[1].children[0] as HTMLSelectElement;
                params[name] = selectElement.options[selectElement.selectedIndex].value;
            } else {
                const inputElement = line.children[1] as HTMLInputElement;
                // 处理checkbox类型
                if (inputElement.type === "checkbox") {
                    params[name] = inputElement.checked;
                } else {
                    const value = inputElement.value;
                    // Need to not parse as integer for float parameters
                    // 安全检查：确保defaultParams中存在该参数，避免undefined.toString()错误
                    if (defaultParams[name] !== undefined && defaultParams[name] !== null) {
                        if ((defaultParams[name].toString()).indexOf(".") >= 0) {
                            params[name] = parseFloat(value);
                        } else {
                            params[name] = parseString(value);
                        }
                    } else {
                        // 如果参数不在defaultParams中，尝试根据值判断类型
                        // 如果值包含小数点，解析为浮点数；否则解析为字符串
                        if (value.indexOf(".") >= 0 && !isNaN(parseFloat(value))) {
                            params[name] = parseFloat(value);
                        } else {
                            params[name] = parseString(value);
                        }
                    }
                }
            }
        }
        return params;
    }

    public setParams(params: Map<string, any>): void {
        for (const line of this.paramBox.children) {
            const name = line.children[0].getAttribute("data-name");
            if (line.children[1].className === "select") {
                const selectElement: HTMLSelectElement =  line.children[1].children[0] as HTMLSelectElement;
                // Get index with the correct value and select it
                for (let i = 0; i < selectElement.options.length; i++) {
                    if (selectElement.options.item(i).value === params.get(name)) {
                        selectElement.selectedIndex = i;
                        break;
                    }
                }
            } else {
                ( line.children[1] as HTMLInputElement).value = params.get(name);
            }
        }
    }

    /**
     * Make parent -> this become parent -> layer -> this.
     * @param layer a layer that will become the new parent
     * @param parent a parent of this
     */
    public addParentLayerBetween(layer: Layer, parent: Layer): void {
        parent.children.delete(this);
        parent.children.add(layer);

        layer.parents.add(parent);
        layer.children.add(this);

        this.parents.delete(parent);
        this.parents.add(layer);
    }

    /**
     * Make parents -> this become parents -> layer -> this.
     * @param parent a parent of this
     */
    public addParentLayer(layer: Layer): void {
        for (const parent of this.parents) {
            parent.children.delete(this);
            parent.children.add(layer);
        }

        layer.parents = new Set([...layer.parents, ...this.parents]);
        layer.children.add(this);

        this.parents.clear();
        this.parents.add(layer);
    }

    /**
     * Make new child -> this become this -> newChild -> old children.
     * @param newChild a new child of this
     */
    public addChildLayerBetween(newChild: Layer): void {
        for (const child of this.children) {
            newChild.addChild(child);
            child.parents.delete(this);
        }
        this.children.clear();
        this.addChild(newChild);
        newChild.addParent(this);
    }

    public getTfjsLayer(): tf.SymbolicTensor {
        return this.tfjsLayer;
    }

    public generateTfjsLayer(): void {
        // TODO change defaults to class level
        const parameters = this.getParams();

        let parent: Layer = null;
        for (const p of this.parents) { parent = p; break; }
        // Concatenate layers handle fan-in

        if (this.parents.size > 1) {
            displayError(new Error("Must use a concatenate when a layer has multiple parents"));
        }

        this.tfjsLayer = this.tfjsEmptyLayer(parameters).apply(parent.getTfjsLayer());
    }

    public layerShape(): number[] {
        // Computes all of the predecessors to determine shape
        if (this.layerType === "Input") {
            changeDataset(svgData.input.getParams().dataset);
        }
        try {
            generateTfjsModel(topologicalSort(svgData.input, false));
            return this.getTfjsLayer().shape;
        } catch (err) {  // Hide errors while building the network
            return null;
        }
    }

    public initLineOfJulia(): string {
        return "";
    }

    public lineOfJulia(): string {
        let connections = "";
        for (const child of this.children) {
            connections += `connect!(net, x${this.uid}, x${child.uid})\n`;
        }
        return connections;
    }

    public hasParentType(type: any ): boolean {
        for (const p of this.parents) {
            if (p instanceof type) {
                return true;
            }
        }

        return false;
    }

    protected abstract populateParamBox(): void;

    protected focusing(): void {
        for (const line of this.paramBox.children) {
            const inputElement = line.children[1] as HTMLInputElement;
            if (inputElement && inputElement instanceof HTMLInputElement) {
                inputElement.onfocus = this.toggleFocus.bind(inputElement);
                inputElement.onblur = this.toggleFocus.bind(inputElement);
            }
        }
    }

    private toggleFocus(textField: any): void {
        textField.target.classList.toggle("focusParam");
    }

}
