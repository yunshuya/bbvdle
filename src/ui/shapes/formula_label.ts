import * as d3 from "d3";
import { Point } from "./shape";

/**
 * 公式标签 - 用于在画布上显示数学公式
 * 使用 SVG foreignObject 嵌入 HTML，支持 MathJax 渲染
 */
export class FormulaLabel {
    private group: d3.Selection<SVGGraphicsElement, {}, HTMLElement, any>;
    private foreignObject: d3.Selection<SVGForeignObjectElement, {}, HTMLElement, any>;
    public position: Point; // Used in setPosition method
    public formula: string; // Used in setFormula method
    private width: number;
    private height: number;

    constructor(position: Point, formula: string, width: number = 200, height: number = 40) {
        this.position = position;
        this.formula = formula;
        this.width = width;
        this.height = height;
        
        this.group = d3.select("#svg").append("g")
            .attr("class", "formula-label");
        
        // 使用 foreignObject 来嵌入 HTML，支持 MathJax
        this.foreignObject = this.group.append("foreignObject")
            .attr("x", position.x - width / 2)
            .attr("y", position.y - height / 2)
            .attr("width", width)
            .attr("height", height);
        
        const div = this.foreignObject.append("xhtml:div")
            .style("width", `${width}px`)
            .style("height", `${height}px`)
            .style("text-align", "center")
            .style("font-size", "11px")
            .style("color", "#333")
            .style("background", "rgba(255, 255, 255, 0.95)")
            .style("border", "1px solid #999")
            .style("border-radius", "4px")
            .style("padding", "5px")
            .style("display", "flex")
            .style("align-items", "center")
            .style("justify-content", "center")
            .html(`<span class="math inline">${formula}</span>`);
        
        // 触发 MathJax 重新渲染
        if ((window as any).MathJax && (window as any).MathJax.Hub) {
            (window as any).MathJax.Hub.Queue(["Typeset", (window as any).MathJax.Hub, div.node()]);
        }
    }

    public setPosition(position: Point): void {
        this.position = position;
        this.foreignObject
            .attr("x", position.x - this.width / 2)
            .attr("y", position.y - this.height / 2);
    }

    public setFormula(formula: string): void {
        this.formula = formula;
        const div = this.foreignObject.select("xhtml:div");
        div.html(`<span class="math inline">${formula}</span>`);
        
        if ((window as any).MathJax && (window as any).MathJax.Hub) {
            (window as any).MathJax.Hub.Queue(["Typeset", (window as any).MathJax.Hub, div.node()]);
        }
    }

    public remove(): void {
        this.group.remove();
    }

    public raise(): void {
        this.group.raise();
    }
}

