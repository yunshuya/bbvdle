import { displayError } from "../../error";
import { Layer } from "../layer";
import { PathShape, Point } from "../shape";
import { verifyCircularConnectionStep } from "../../taskModule";

/**
 * 循环连接层 - 用于创建两个层之间的循环连接
 * 这是一个可视化工具层，不参与实际计算
 */
export class CircularConnection extends Layer {
    public layerType: string = "CircularConnection";
    public parameterDefaults: { [key: string]: any } = {};
    public readonly tfjsEmptyLayer: any = null;  // 不参与实际计算
    
    private sourceLayer: Layer | null = null;  // 源层
    private targetLayer: Layer | null = null;  // 目标层
    private labelText: string = "";  // 标签文本

    constructor(defaultLocation: Point = Point.randomPoint(100, 40, new Point(100, 100))) {
        // 使用循环箭头的形状，蓝色
        super([
            new PathShape("M-20 -10 Q 0 -30, 20 -10", "#4169E1"),  // 弧形路径
            new PathShape("M 15 -12 L 25 -10 L 15 -8 Z", "#4169E1")  // 箭头
        ], defaultLocation);
    }

    public populateParamBox(): void {
        const info = document.createElement("div");
        info.className = "paramline";
        info.style.color = "#666";
        info.style.fontSize = "12px";
        info.innerHTML = "循环连接层";
        this.paramBox.append(info);

        const instruction = document.createElement("div");
        instruction.className = "paramline";
        instruction.style.color = "#999";
        instruction.style.fontSize = "11px";
        instruction.style.marginTop = "10px";
        instruction.style.paddingTop = "10px";
        instruction.style.borderTop = "1px solid #ddd";
        instruction.innerHTML = "使用说明：<br>1. 点击此层<br>2. 点击源层（如 H_t）<br>3. 点击目标层（如 H_{t-1}）<br>4. 输入标签文本（可选）";
        this.paramBox.append(instruction);

        // 源层选择
        const sourceLine = document.createElement("div");
        sourceLine.className = "paramline";
        sourceLine.style.marginTop = "10px";
        const sourceName = document.createElement("div");
        sourceName.className = "paramname";
        sourceName.innerHTML = "源层:";
        const sourceValue = document.createElement("div");
        sourceValue.className = "paramvalue";
        sourceValue.style.width = "60%";
        sourceValue.style.textAlign = "left";
        sourceValue.innerHTML = this.sourceLayer ? this.sourceLayer.layerType : "未选择";
        sourceValue.id = `circular-source-${this.uid}`;
        sourceLine.appendChild(sourceName);
        sourceLine.appendChild(sourceValue);
        this.paramBox.append(sourceLine);

        // 目标层选择
        const targetLine = document.createElement("div");
        targetLine.className = "paramline";
        const targetName = document.createElement("div");
        targetName.className = "paramname";
        targetName.innerHTML = "目标层:";
        const targetValue = document.createElement("div");
        targetValue.className = "paramvalue";
        targetValue.style.width = "60%";
        targetValue.style.textAlign = "left";
        targetValue.innerHTML = this.targetLayer ? this.targetLayer.layerType : "未选择";
        targetValue.id = `circular-target-${this.uid}`;
        targetLine.appendChild(targetName);
        targetLine.appendChild(targetValue);
        this.paramBox.append(targetLine);

        // 标签文本输入
        const labelLine = document.createElement("div");
        labelLine.className = "paramline";
        const labelName = document.createElement("div");
        labelName.className = "paramname";
        labelName.innerHTML = "标签:";
        const labelInput = document.createElement("input");
        labelInput.className = "paramvalue layerparamvalue";
        labelInput.value = this.labelText;
        labelInput.placeholder = "如: H_t → H_{t+1}";
        labelInput.id = `circular-label-${this.uid}`;
        labelInput.onchange = () => {
            this.labelText = labelInput.value;
            // 如果连接已创建，更新标签
            if (this.sourceLayer && this.targetLayer) {
                this.createConnection();
            }
        };
        labelLine.appendChild(labelName);
        labelLine.appendChild(labelInput);
        this.paramBox.append(labelLine);

        // 创建连接按钮
        const buttonLine = document.createElement("div");
        buttonLine.className = "paramline";
        buttonLine.style.marginTop = "10px";
        const createButton = document.createElement("button");
        createButton.innerHTML = "创建循环连接";
        createButton.style.width = "100%";
        createButton.style.padding = "8px";
        createButton.style.backgroundColor = "#4169E1";
        createButton.style.color = "white";
        createButton.style.border = "none";
        createButton.style.borderRadius = "4px";
        createButton.style.cursor = "pointer";
        createButton.onclick = () => {
            if (!this.sourceLayer || !this.targetLayer) {
                displayError(new Error("请先选择源层和目标层"));
                return;
            }
            this.createConnection();
        };
        buttonLine.appendChild(createButton);
        this.paramBox.append(buttonLine);

        this.focusing();
    }

    /**
     * 设置源层（通过点击选择）
     */
    public setSourceLayer(layer: Layer): void {
        this.sourceLayer = layer;
        const sourceValue = document.getElementById(`circular-source-${this.uid}`);
        if (sourceValue) {
            sourceValue.innerHTML = layer.layerType;
        }
    }

    /**
     * 设置目标层（通过点击选择）
     */
    public setTargetLayer(layer: Layer): void {
        this.targetLayer = layer;
        const targetValue = document.getElementById(`circular-target-${this.uid}`);
        if (targetValue) {
            targetValue.innerHTML = layer.layerType;
        }
        
        // 当源层和目标层都已选择时，自动创建循环连接
        if (this.sourceLayer && this.targetLayer) {
            this.createConnection();
        }
    }

    /**
     * 创建循环连接（生成蓝色虚线箭头）
     */
    public createConnection(): void {
        if (!this.sourceLayer || !this.targetLayer) {
            displayError(new Error("源层和目标层都必须选择"));
            return;
        }

        // 获取标签文本
        const labelInput = document.getElementById(`circular-label-${this.uid}`) as HTMLInputElement;
        if (labelInput) {
            this.labelText = labelInput.value;
        }

        // 创建循环连接（这会生成蓝色虚线箭头）
        this.sourceLayer.addCircularConnection(this.targetLayer, this.labelText || undefined);
        
        console.log(`循环连接已创建（蓝色虚线箭头）: ${this.sourceLayer.layerType} → ${this.targetLayer.layerType}`);
        
        // 触发任务验证
        verifyCircularConnectionStep();
    }

    public getHoverText(): string { 
        return "循环连接层\n点击此层后，再点击源层和目标层来创建循环连接"; 
    }

    public lineOfPython(): string {
        return `# Circular Connection: ${this.sourceLayer?.layerType || "?"} → ${this.targetLayer?.layerType || "?"}`;
    }

    public initLineOfJulia(): string {
        return `# Circular Connection (visualization only)\n`;
    }

    /**
     * 循环连接层不参与实际计算，返回 null
     */
    public generateTfjsLayer(): void {
        // 循环连接层不参与实际计算，标记为可视化层
        (this as any).isVisualizationOnly = true;
        // 创建一个占位张量，但不会被使用
        this.tfjsLayer = null as any;
    }

    public clone(): CircularConnection {
        const newLayer = new CircularConnection();
        newLayer.sourceLayer = this.sourceLayer;
        newLayer.targetLayer = this.targetLayer;
        newLayer.labelText = this.labelText;
        return newLayer;
    }

    /**
     * 重写 select 方法，实现点击选择源层和目标层的功能
     */
    public select(): void {
        super.select();
        
        // 设置选择模式：点击此层后，下一个点击的层将成为源层，再下一个点击的层将成为目标层
        if (!this.sourceLayer) {
            // 等待选择源层
            (window as any).circularConnectionSelectMode = {
                circularConnection: this,
                step: "source"
            };
            console.log("请点击源层（如 H_t）");
        } else if (!this.targetLayer) {
            // 等待选择目标层
            (window as any).circularConnectionSelectMode = {
                circularConnection: this,
                step: "target"
            };
            console.log("请点击目标层（如 H_{t-1}）");
        } else {
            // 两个层都已选择，可以创建连接
            console.log("源层和目标层已选择，点击'创建循环连接'按钮来创建连接");
        }
    }
}

