import * as d3 from "d3";
import { windowProperties } from "../window";
import { Layer } from "./layer";
import { verifyCircularConnectionStep } from "../taskModule";

/**
 * 循环连接类 - 用于LSTM等循环神经网络中的循环连接可视化
 * 绘制从输出回到输入的曲线箭头，表示时间步之间的循环连接
 */
export class CircularWire {
    public readonly wireGuidePresent: boolean = false;

    private source: Layer;  // 源层（如 H_t）
    public dest: Layer;    // 目标层（如 H_{t-1}，用于下一时刻）- 公开以便外部访问
    public path: d3.Selection<SVGGraphicsElement, {}, HTMLElement, any>;  // 公开以便外部访问和调试
    public triangle: d3.Selection<SVGGraphicsElement, {}, HTMLElement, any>;  // 公开以便外部访问和调试
    private group: d3.Selection<SVGGraphicsElement, {}, HTMLElement, any>;
    private label: d3.Selection<SVGGraphicsElement, {}, HTMLElement, any> | null = null;  // 可选的标签文本

    constructor(source: Layer, dest: Layer, labelText?: string) {
        this.source = source;
        this.dest = dest;

        this.group = d3.select<SVGGraphicsElement, {}>("#svg")
                        .append<SVGGraphicsElement>("g")
                        .attr("class", "circular-wire");

        // 创建SVG路径（使用二次贝塞尔曲线）
        this.path = this.group.append<SVGGraphicsElement>("path")
                            .style("fill", "none")
                            .style("stroke", "#4169E1")  // 使用蓝色区分循环连接
                            .style("stroke-width", 4)
                            .style("stroke-dasharray", "8,4")  // 虚线样式，表示循环
                            .style("cursor", "pointer")
                            .style("opacity", 0.8);

        // 创建箭头三角形
        this.triangle = this.group.append<SVGGraphicsElement>("polygon")
                                .attr("points", "0,12, 16,0, 0,-12")
                                .style("fill", "#4169E1")
                                .style("stroke", "#4169E1")
                                .style("stroke-width", 1)
                                .style("cursor", "pointer");

        // 可选：添加标签文本（如 "t+1" 或 "next timestep"）
        if (labelText) {
            this.label = this.group.append<SVGGraphicsElement>("text")
                                .text(labelText)
                                .style("font-size", "12px")
                                .style("fill", "#4169E1")
                                .style("font-weight", "bold")
                                .style("pointer-events", "none")
                                .style("font-family", "Arial, sans-serif");
        }

        // 确保循环连接在最上层显示
        this.group.raise();
        this.updatePosition();
        this.source.raise();
        this.dest.raise();
        // 再次确保循环连接在最上层
        this.group.raise();

        // 点击循环连接时，触发任务验证（如果当前有教学任务）
        this.path.on("click", () => { 
            this.select();
            // 触发任务验证：循环连接点击应该验证"循环连接"步骤
            verifyCircularConnectionStep();
        });
        this.triangle.on("click", () => { 
            this.select();
            verifyCircularConnectionStep();
        });
    }

    /**
     * 计算循环连接的曲线路径
     * 使用二次贝塞尔曲线，从源层右侧出发，绕到目标层左侧
     */
    private calculateCurvePath(): string {
        const sourceCenter = this.source.getPosition().add(this.source.center());
        const destCenter = this.dest.getPosition().add(this.dest.center());

        console.log("CircularWire.calculateCurvePath() - 源层中心:", sourceCenter, "目标层中心:", destCenter);

        // 计算控制点，使曲线形成一个弧形
        // 控制点的x坐标在源和目标之间，y坐标向上偏移形成弧形
        const controlPointX = (sourceCenter.x + destCenter.x) / 2;
        // 根据标签判断是否是 H_t -> H_{t+1} 连接，如果是则使用更大的弧度
        const isHiddenStateConnection = this.label && this.label.text() && 
                                       (this.label.text().includes("H_t") || this.label.text().includes("H_{t+1}"));
        const offsetY = isHiddenStateConnection ? 150 : 80;  // H_t -> H_{t+1} 使用更大的弧度（150像素）
        const controlPointY = Math.min(sourceCenter.y, destCenter.y) - offsetY;

        // 计算起点和终点（从源层右侧，到目标层左侧）
        // 如果源层和目标层是同一个层（自循环），使用特殊处理
        const isSelfLoop = this.source === this.dest;
        const startX = isSelfLoop ? sourceCenter.x + 40 : sourceCenter.x + 30;  // 源层右侧
        const startY = sourceCenter.y;
        const endX = isSelfLoop ? destCenter.x - 40 : destCenter.x - 30;      // 目标层左侧
        const endY = destCenter.y;

        // 使用二次贝塞尔曲线 Q x1 y1, x y
        const pathString = `M ${startX} ${startY} Q ${controlPointX} ${controlPointY}, ${endX} ${endY}`;
        
        console.log("CircularWire.calculateCurvePath() - 路径字符串:", pathString);
        return pathString;
    }

    /**
     * 计算箭头的位置和角度
     * 箭头应该指向目标层的左侧
     */
    private calculateArrowPosition(): { x: number; y: number; angle: number } {
        const sourceCenter = this.source.getPosition().add(this.source.center());
        const destCenter = this.dest.getPosition().add(this.dest.center());

        // 箭头放在目标层左侧
        const arrowX = destCenter.x - 30;
        const arrowY = destCenter.y;

        // 计算角度：从控制点到终点的角度
        const controlPointX = (sourceCenter.x + destCenter.x) / 2;
        // 使用与 calculateCurvePath 相同的偏移量
        const isHiddenStateConnection = this.label && this.label.text() && 
                                       (this.label.text().includes("H_t") || this.label.text().includes("H_{t+1}"));
        const offsetY = isHiddenStateConnection ? 150 : 80;
        const controlPointY = Math.min(sourceCenter.y, destCenter.y) - offsetY;
        
        // 计算曲线在终点处的切线角度
        // 对于二次贝塞尔曲线，终点处的切线方向是从控制点到终点的方向
        const dx = arrowX - controlPointX;
        const dy = arrowY - controlPointY;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        return { x: arrowX, y: arrowY, angle };
    }

    public raise(): void {
        this.group.raise();
        this.source.raiseGroup();
        this.dest.raiseGroup();
    }

    public raiseGroup(): void {
        this.group.raise();
    }

    public select(): void {
        if (windowProperties.selectedElement != null) {
            if (windowProperties.selectedElement === this) {
                return;
            }
            windowProperties.selectedElement.unselect();
        }
        windowProperties.selectedElement = this;
        this.raise();
        this.path.style("stroke", "#FFD700")  // 选中时变为金色
                  .style("stroke-width", 5);
        this.triangle.style("fill", "#FFD700")
                     .style("stroke", "#FFD700");
        if (this.label) {
            this.label.style("fill", "#FFD700");
        }
    }

    public unselect(): void {
        this.path.style("stroke", "#4169E1")
                  .style("stroke-width", 4);
        this.triangle.style("fill", "#4169E1")
                     .style("stroke", "#4169E1");
        if (this.label) {
            this.label.style("fill", "#4169E1");
        }
    }

    public delete(): void {
        this.path.remove();
        this.triangle.remove();
        if (this.label) {
            this.label.remove();
        }
        this.group.remove();
    }

    public updatePosition(): void {
        const pathString = this.calculateCurvePath();
        console.log("CircularWire.updatePosition() - 路径字符串:", pathString);
        this.path.attr("d", pathString);
        
        // 确保路径样式正确应用
        this.path.style("stroke", "#4169E1")
                  .style("stroke-width", 4)
                  .style("stroke-dasharray", "8,4")
                  .style("opacity", 0.8)
                  .style("display", null);  // 确保显示

        const arrowPos = this.calculateArrowPosition();
        console.log("CircularWire.updatePosition() - 箭头位置:", arrowPos);
        this.triangle.attr("transform", 
            `translate(${arrowPos.x}, ${arrowPos.y}) rotate(${arrowPos.angle})`);
        
        // 确保箭头样式正确应用
        this.triangle.style("fill", "#4169E1")
                     .style("stroke", "#4169E1")
                     .style("display", null);  // 确保显示

        // 更新标签位置（放在曲线中点上方）
        if (this.label) {
            const sourceCenter = this.source.getPosition().add(this.source.center());
            const destCenter = this.dest.getPosition().add(this.dest.center());
            const controlPointX = (sourceCenter.x + destCenter.x) / 2;
            // 使用与 calculateCurvePath 相同的偏移量
            const isHiddenStateConnection = this.label && this.label.text() && 
                                           (this.label.text().includes("H_t") || this.label.text().includes("H_{t+1}"));
            const offsetY = isHiddenStateConnection ? 150 : 80;
            const controlPointY = Math.min(sourceCenter.y, destCenter.y) - offsetY;
            // H_t -> H_{t+1} 标签更靠近曲线（减少偏移量）
            const labelOffsetY = isHiddenStateConnection ? 5 : 10;  // H_t -> H_{t+1} 只偏移5像素，其他保持10像素
            this.label.attr("x", controlPointX)
                      .attr("y", controlPointY - labelOffsetY)
                      .attr("text-anchor", "middle");
        }
        
        // 确保循环连接在最上层
        this.group.raise();
    }
}

