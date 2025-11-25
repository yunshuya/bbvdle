import * as d3 from "d3";
import { buildNetworkDAG, topologicalSort } from "../model/build_network";
import { generateJulia, generatePython } from "../model/code_generation";
import { changeDataset } from "../model/data";
import { download, graphToJson } from "../model/export_model";
import { setupPlots, setupTestResults, showPredictions } from "../model/graphs";
import { train, getTrainingHistory, stopTrainingHandler, resetTrainingFlag} from "../model/mnist_model";
import { model } from "../model/params_object";
import { loadStateIfPossible, storeNetworkInUrl } from "../model/save_state_url";
import { clearError, displayError } from "./error";
import { blankTemplate, defaultTemplate, resnetTemplate } from "./model_templates";
import { Activation, Relu, Sigmoid, Tanh } from "./shapes/activation";
import { ActivationLayer } from "./shapes/activationlayer";
import { Draggable } from "./shapes/draggable";
import { Layer } from "./shapes/layer";
import { Add } from "./shapes/layers/add";
import { BatchNorm } from "./shapes/layers/batchnorm";
import { Concatenate } from "./shapes/layers/concatenate";
import { Conv2D } from "./shapes/layers/convolutional";
import { Dense } from "./shapes/layers/dense";
import { Dropout } from "./shapes/layers/dropout";
import { Flatten } from "./shapes/layers/flatten";
import { Input } from "./shapes/layers/input";
import { MaxPooling2D } from "./shapes/layers/maxpooling";
import { Output } from "./shapes/layers/output";
import { TextBox } from "./shapes/textbox";
import { WireGuide } from "./shapes/wireguide";
import { copyTextToClipboard } from "./utils";
import { windowProperties } from "./window";
import { switchTask, toggleTaskSteps,verifyStepCompletion,isTaskAlready, getCurrentTask } from './taskModule';
import { appendMessage, fetchAiResponse } from './ai_assistant';


export interface IDraggableData {
    draggable: Draggable[];
    input: Input;
    output: Output;
}

interface IAiLayerContext {
    layerType: string;
    params: { [key: string]: any };
}

type AiAttachment =
    | { kind: "layer"; layerType: string; params: { [key: string]: any } }
    | { kind: "education"; text: string; displayText: string };

type EducationAction = "explain" | "summarize" | "quiz";

interface IEducationContextPayload {
    text: string;
    mode?: EducationAction | "custom";
}

export let svgData: IDraggableData = {
    draggable: [],
    input: null,
    output: null,
};

let aiAssistantDialogElement: HTMLElement | null = null;
let aiDialogInputElement: HTMLInputElement | null = null;
let aiDialogContentElement: HTMLElement | null = null;
let aiContextAttachmentElement: HTMLElement | null = null;
let aiContextTextElement: HTMLElement | null = null;
let aiContextActionsElement: HTMLElement | null = null;
let pendingAiAttachment: AiAttachment | null = null;
let educationSelectionHandle: HTMLDivElement | null = null;
let educationSelectionText: string | null = null;

document.addEventListener("DOMContentLoaded", () => {

    // This function runs when the DOM is ready, i.e. when the document has been parsed
    setupPlots();
    setupTestResults();

    setupOptionOnClicks();
    setupIndividualOnClicks();

    const categoryElements = document.getElementsByClassName("categoryTitle") as HTMLCollectionOf<HTMLElement>;
    for (const elmt of categoryElements) {
        makeCollapsable(elmt);
    }

    window.addEventListener("resize", resizeMiddleSVG);
    window.addEventListener("resize", setupPlots);

    resizeMiddleSVG();

    window.onkeyup = (event: KeyboardEvent) => {
        switch (event.key) {
            case "Escape":
                if (windowProperties.selectedElement) {
                    windowProperties.selectedElement.unselect();
                    windowProperties.selectedElement = null;
                }
                break;
            case "Delete":
                if (document.getElementsByClassName("focusParam").length === 0) {
                    deleteSelected();
                }
                break;
            case "Backspace":
                if (document.getElementsByClassName("focusParam").length === 0) {
                    deleteSelected();
                }
                break;
            case "Enter":
                break;
        }
    };

    windowProperties.wireGuide = new WireGuide();
    windowProperties.shapeTextBox = new TextBox();

    d3.select("#svg").on("mousemove", () => {
        if (windowProperties.selectedElement instanceof Layer) {
            windowProperties.wireGuide.moveToMouse();
        }
    });

    svgData = loadStateIfPossible();

    // Select the input block when we load the page
    svgData.input.select();

    //task open
    const taskTitle = document.getElementById("taskTitle");
    if (taskTitle) {
        taskTitle.addEventListener("click", () => {
            toggleTaskSteps();
        });
    }
    setupAiAssistant();
    const taskSteps = document.querySelector('#taskSteps') as HTMLElement;
    aiAssistantDialogElement = document.querySelector('#aiAssistantDialog') as HTMLElement;
    aiContextAttachmentElement = document.getElementById("aiContextAttachment");
    aiContextTextElement = aiContextAttachmentElement?.querySelector(".ai-context-text") as HTMLElement;
    aiContextActionsElement = document.getElementById("aiContextActions");
    const clearAiContextButton = document.getElementById("clearAiContext");
    if (clearAiContextButton) {
        clearAiContextButton.addEventListener("click", () => {
            pendingAiAttachment = null;
            updateAiContextAttachment();
        });
    }
    if (aiContextActionsElement) {
        aiContextActionsElement.addEventListener("click", (event) => {
            const target = event.target as HTMLElement;
            if (!target || target.tagName !== "BUTTON") {
                return;
            }
            const action = target.getAttribute("data-action") as EducationAction;
            if (action) {
                handleAiContextAction(action).catch((error) => console.error(error));
            }
        });
    }
    if (taskSteps) {
        makeDraggable(taskSteps);
        makeResizable(taskSteps);
    }
    if (aiAssistantDialogElement) {
        makeDraggable(aiAssistantDialogElement);
        makeResizable(aiAssistantDialogElement);
    }
    setupEducationSelectionWatcher();
});

function addOnClickToOptions(categoryId: string, func: (optionValue: string, element: HTMLElement) => void): void {
    for (const element of document.getElementById(categoryId).getElementsByClassName("option")) {
        element.addEventListener("click", () => {
            func(element.getAttribute("data-optionValue"), element as HTMLElement);
        });
    }
}

function setupOptionOnClicks(): void {
    addOnClickToOptions("tabselector", (tabType) => switchTab(tabType));
    addOnClickToOptions("layers", (layerType) => appendItem(layerType));
    addOnClickToOptions("activations", (activationType) => appendItem(activationType));
    addOnClickToOptions("templates", (templateType) => createTemplate(templateType));
    addOnClickToOptions("educationLayers", (articleType) => {
        document.getElementById("education" + articleType).scrollIntoView(true);
    });
    addOnClickToOptions("educationStory", (articleType) => {
        document.getElementById("education" + articleType).scrollIntoView(true);
    });
    addOnClickToOptions("educationModel", (articleType) => {
        document.getElementById("education" + articleType).scrollIntoView(true);
    });
    addOnClickToOptions("classes", (_, element) => {
        selectOption("classes", element);
        if (model.architecture != null) {
            showPredictions();
        }
    });
    addOnClickToOptions("optimizers", (optimizerType, element) => {
        selectOption("optimizers", element);
        model.params.optimizer = optimizerType;
    });
    addOnClickToOptions("losses", (lossType, element) => {
        selectOption("losses", element);
        model.params.loss = lossType;
    });
    //new
    const taskOptions = document.querySelectorAll("#tasks .option");
    taskOptions.forEach((option) => {
        option.addEventListener("click", () => {
            const taskType = option.getAttribute("data-optionValue");
            if (!taskType) {
                return;
            }
            // 高亮当前任务
            selectOption("tasks", option as HTMLElement);
            // 点击任务，修改当前任务的全局变量
            switchTask(taskType);
        });
    });
}

function selectOption(optionCategoryId: string, optionElement: HTMLElement): void {
    console.log("optionCategoryId, optionElement");
    for (const option of document.getElementById(optionCategoryId).getElementsByClassName("option")) {
        option.classList.remove("selected");
    }
    optionElement.classList.add("selected");
}

function createTemplate(template: string): void {
    switch (template) {
        case "blank": {
            blankTemplate(svgData);
            if(isTaskAlready){
                console.log(template);
                verifyStepCompletion(svgData.input);
            }
             break;
            //当前有教学任务时，验证是否生成input和output；
            
                

        }
        
        case "default": defaultTemplate(svgData); break;
        case "resnet": resnetTemplate(svgData); break;

    }
}

function appendItem(itemType: string): void {
    const item: Draggable = new ({
        add: Add,
        batchnorm: BatchNorm,
        concatenate: Concatenate,
        conv2D: Conv2D,
        dense: Dense,
        dropout: Dropout,
        flatten: Flatten,
        maxPooling2D: MaxPooling2D,
        relu: Relu,
        sigmoid: Sigmoid,
        tanh: Tanh,
    } as any)[itemType]();

    svgData.draggable.push(item);
    //这里是验证教学任务的步骤
    if(isTaskAlready){
            verifyStepCompletion(item);    
    }
   
  
    
}

function setupIndividualOnClicks(): void {
    document.getElementById("exportPython").addEventListener("click", () => {
        changeDataset(svgData.input.getParams().dataset);
        const filename = svgData.input.getParams().dataset + "_model.py";
        download(generatePython(topologicalSort(svgData.input)), filename);
    });

    document.getElementById("exportJulia").addEventListener("click", () => {
        changeDataset(svgData.input.getParams().dataset);
        if (svgData.input.getParams().dataset === "cifar") {
            displayError(new Error("Julia Export does not support CIFAR10, use MNIST instead."));
        } else {
            const filename = svgData.input.getParams().dataset + "_model.jl";
            download(generateJulia(topologicalSort(svgData.input)), filename);
        }
    });

    document.getElementById("copyModel").addEventListener("click", () => {
        changeDataset(svgData.input.getParams().dataset); // TODO change dataset should happen when the dataset changes
        const state = graphToJson(svgData);
        const baseUrl: string = window.location.href;
        const urlParam: string = storeNetworkInUrl(state);
        copyTextToClipboard(baseUrl + "#" + urlParam);
    });

    const exportTrainingJsonBtn = document.getElementById("exportTrainingHistoryJson");
    if (exportTrainingJsonBtn) {
        exportTrainingJsonBtn.addEventListener("click", () => exportTrainingHistory("json"));
    }
    const exportTrainingCsvBtn = document.getElementById("exportTrainingHistoryCsv");
    if (exportTrainingCsvBtn) {
        exportTrainingCsvBtn.addEventListener("click", () => exportTrainingHistory("csv"));
    }
    const exportTrainingChartsBtn = document.getElementById("exportTrainingCharts");
    if (exportTrainingChartsBtn) {
        exportTrainingChartsBtn.addEventListener("click", () => exportTrainingCharts());
    }

    document.getElementById("train").addEventListener("click", trainOnClick);

    document.getElementById("informationEducation").addEventListener("click", () => {
        document.getElementById("informationOverlay").style.display = "none";
        switchTab("education");
    });

    document.getElementById("informationOverlay").addEventListener("click", () => {
        document.getElementById("informationOverlay").style.display = "none";
    });

    document.getElementById("x").addEventListener("click", () => clearError());

    document.getElementById("svg").addEventListener("click", (event) => {
        // Only click if there is a selected element, and the clicked element is an SVG Element, and its id is "svg"
        // It does this to prevent unselecting if we click on a layer block or other svg shape
        if (windowProperties.selectedElement && event.target instanceof SVGElement && event.target.id === "svg") {
            windowProperties.selectedElement.unselect();
            windowProperties.selectedElement = null;
        }
    });
}

function deleteSelected(): void {
    if (windowProperties.selectedElement) {
        windowProperties.selectedElement.delete();
        windowProperties.selectedElement = null;
    }
}

function exportTrainingHistory(format: "json" | "csv"): void {
    const history = getTrainingHistory();
    if (!history || history.batchMetrics.length === 0) {
        displayError(new Error("请先完成一次训练，再导出训练数据。"));
        return;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    if (format === "json") {
        const filename = `training_history_${timestamp}.json`;
        download(JSON.stringify(history, null, 2), filename);
        return;
    }
    const rows: Array<Array<string>> = [];
    rows.push(["type", "step", "loss", "accuracy"]);
    history.batchMetrics.forEach((metric) => {
        rows.push(["batch", `${metric.batch}`, formatNumber(metric.loss), formatNumber(metric.accuracy)]);
    });
    history.epochMetrics.forEach((metric) => {
        rows.push(["epoch", `${metric.epoch}`, formatNumber(metric.valLoss), formatNumber(metric.valAccuracy)]);
    });
    if (history.testMetrics) {
        rows.push(["test", "final", formatNumber(history.testMetrics.loss), formatNumber(history.testMetrics.accuracy)]);
    }
    const metaLines = [
        ["#dataset", history.dataset || ""],
        ["#startedAt", history.startedAt || ""],
        ["#finishedAt", history.finishedAt || ""],
        ["#learningRate", `${history.hyperparameters.learningRate}`],
        ["#batchSize", `${history.hyperparameters.batchSize}`],
        ["#epochs", `${history.hyperparameters.epochs}`],
        ["#optimizer", history.hyperparameters.optimizer || ""],
        ["#loss", history.hyperparameters.loss || ""],
    ];
    const csvLines = [
        ...metaLines.map((line) => line.join(",")),
        ...rows.map((line) => line.join(",")),
    ];
    const filename = `training_history_${timestamp}.csv`;
    download(csvLines.join("\n"), filename);
}

function exportTrainingCharts(): void {
    const chartTargets = [
        { id: "loss-canvas", name: "loss_curve" },
        { id: "accuracy-canvas", name: "accuracy_curve" },
        { id: "confusion-matrix-canvas", name: "confusion_matrix" },
    ];
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    let exportedCount = 0;
    const renderPromises = chartTargets.map(async (target) => {
        const container = document.getElementById(target.id);
        if (!container) {
            return;
        }
        const dataUrl = await renderChartContainerToImage(container);
        if (dataUrl) {
            downloadDataUrl(dataUrl, `${target.name}_${timestamp}.png`);
            exportedCount++;
        }
    });
    Promise.all(renderPromises).then(() => {
        if (exportedCount === 0) {
            displayError(new Error("未找到可导出的图表，请先运行一次训练。"));
        }
    });
}

async function renderChartContainerToImage(container: HTMLElement): Promise<string | null> {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) {
        return null;
    }
    const scale = window.devicePixelRatio || 1;
    const composite = document.createElement("canvas");
    composite.width = Math.ceil(rect.width * scale);
    composite.height = Math.ceil(rect.height * scale);
    const ctx = composite.getContext("2d");
    ctx.scale(scale, scale);

    const drawOperations: Array<Promise<void>> = [];

    const drawCanvas = (canvas: HTMLCanvasElement): void => {
        const canvasRect = canvas.getBoundingClientRect();
        const offsetX = canvasRect.left - rect.left;
        const offsetY = canvasRect.top - rect.top;
        ctx.drawImage(canvas, offsetX, offsetY, canvasRect.width, canvasRect.height);
    };

    Array.from(container.querySelectorAll("canvas")).forEach((canvas) => {
        if (canvas.width && canvas.height) {
            drawCanvas(canvas);
        }
    });

    const svgElements = Array.from(container.querySelectorAll("svg"));
    svgElements.forEach((svg) => {
        const promise = new Promise<void>((resolve) => {
            const cloned = svg.cloneNode(true) as SVGSVGElement;
            const svgRect = svg.getBoundingClientRect();
            cloned.setAttribute("width", `${svgRect.width}`);
            cloned.setAttribute("height", `${svgRect.height}`);

            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(cloned);
            const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                const offsetX = svgRect.left - rect.left;
                const offsetY = svgRect.top - rect.top;
                ctx.drawImage(img, offsetX, offsetY, svgRect.width, svgRect.height);
                URL.revokeObjectURL(url);
                resolve();
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve();
            };
            img.src = url;
        });
        drawOperations.push(promise);
    });

    await Promise.all(drawOperations);
    return composite.toDataURL("image/png");
}

function formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return "";
    }
    return value.toString();
}

function downloadDataUrl(dataUrl: string, filename: string): void {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// async function trainOnClick(): Promise<void> {

//     // Only train if not already training

//     const training = document.getElementById("train");
//     if (!training.classList.contains("train-active")) {
//         clearError();

//         changeDataset(svgData.input.getParams().dataset); // TODO change dataset should happen when the dataset changes

//         // Grab hyperparameters
//         setModelHyperparameters();

//         const trainingBox = document.getElementById("ti_training");
//         trainingBox.children[1].innerHTML = "Yes";
//         training.innerHTML = "Training";
//         training.classList.add("train-active");
//         try {
//             model.architecture = buildNetworkDAG(svgData.input);
//             await train();
//         } catch (error) {
//             displayError(error);
//         } finally {
//             training.innerHTML = "Train";
//             training.classList.remove("train-active");
//             trainingBox.children[1].innerHTML = "No";
//         }
//     }
// }

function resizeMiddleSVG(): void {
    const originalSVGWidth = 1000;

    const svgWidth = document.getElementById("middle").clientWidth;
    const svgHeight = document.getElementById("middle").clientHeight;

    const ratio = svgWidth / originalSVGWidth;

    const xTranslate = (svgWidth - originalSVGWidth) / 2;
    const yTranslate = Math.max(0, (svgHeight * ratio - svgHeight) / 2);

    // Modify initialization heights for random locations for layers/activations so they don't appear above the svg
    const yOffsetDelta = yTranslate / ratio - windowProperties.svgYOffset;
    ActivationLayer.defaultInitialLocation.y += yOffsetDelta;
    Activation.defaultLocation.y += yOffsetDelta;

    windowProperties.svgYOffset = yTranslate / ratio;
    windowProperties.svgTransformRatio = ratio;

    document.getElementById("svg").setAttribute("transform", `translate(${xTranslate}, 0) scale(${ratio}, ${ratio})  `);

    // Call crop position on each draggable to ensure it is within the new canvas boundary
    if (svgData.input != null) {
        svgData.input.cropPosition();
        svgData.input.moveAction();
    }
    if (svgData.output != null) {
        svgData.output.cropPosition();
        svgData.output.moveAction();
    }
    svgData.draggable.forEach((elem) => {
        elem.cropPosition();
        elem.moveAction();
    });
}

function toggleExpanderTriangle(categoryTitle: Element): void {
    categoryTitle.getElementsByClassName("expander")[0].classList.toggle("expanded");
}

function makeCollapsable(elmt: Element): void {
    elmt.addEventListener("click", () => {
        toggleExpanderTriangle(elmt);
        const arr = Array.prototype.slice.call(elmt.parentElement.children).slice(1);

        if (elmt.getAttribute("data-expanded") === "false") {
            for (const sib of arr) {
                if (sib.id !== "defaultparambox") {
                    sib.style.display = "block";
                }
            }

            elmt.setAttribute("data-expanded", "true");
        } else {
            for (const sib of arr) {
                sib.style.display = "none";
            }
            elmt.setAttribute("data-expanded", "false");
        }
    });
}

/**
 * Takes the hyperparemeters from the html and assigns them to the global model
 */
export function setModelHyperparameters(): void {
    let temp: number = 0;
    const hyperparams = document.getElementsByClassName("hyperparamvalue");

    for (const hp of hyperparams) {
        const name: string = hp.id;

        temp = Number(( document.getElementById(name) as HTMLInputElement).value);
        if (temp < 0 || temp == null) {
            const error: Error = Error("Hyperparameters should be positive numbers.");
            displayError(error);
            return;
        }
        switch (name) {
            case "learningRate":
                model.params.learningRate = temp;
                break;

            case "epochs":
                model.params.epochs = Math.trunc(temp);
                break;

            case "batchSize":
                model.params.batchSize = Math.trunc(temp);
                break;
        }
    }
}

export function tabSelected(): string {
    if (document.getElementById("networkTab").style.display !== "none") {
        return "networkTab";
    } else if (document.getElementById("progressTab").style.display !== "none") {
        return "progressTab";
    } else if (document.getElementById("visualizationTab").style.display !== "none") {
        return "visualizationTab";
    } else if (document.getElementById("educationTab").style.display !== "none") {
        return "educationTab";
    } else {
        throw new Error("No tab selection found");
    }
}

function switchTab(tabType: string): void {
    // Hide all tabs
    document.getElementById("networkTab").style.display = "none";
    document.getElementById("progressTab").style.display = "none";
    document.getElementById("visualizationTab").style.display = "none";
    document.getElementById("educationTab").style.display = "none";

    // Hide all menus
    document.getElementById("networkMenu").style.display = "none";
    document.getElementById("progressMenu").style.display = "none";
    document.getElementById("visualizationMenu").style.display = "none";
    document.getElementById("educationMenu").style.display = "none";

    // Hide all paramshells
    document.getElementById("networkParamshell").style.display = "none";
    document.getElementById("progressParamshell").style.display = "none";
    document.getElementById("visualizationParamshell").style.display = "none";
    document.getElementById("educationParamshell").style.display = "none";

    // Hide taskSteps by default
    const taskSteps = document.getElementById("taskSteps");
    if (taskSteps) {
        taskSteps.style.display = "none";
    }

    // Unselect all tabs
    document.getElementById("network").classList.remove("tab-selected");
    document.getElementById("progress").classList.remove("tab-selected");
    document.getElementById("visualization").classList.remove("tab-selected");
    document.getElementById("education").classList.remove("tab-selected");

    // Display only the selected tab
    document.getElementById(tabType + "Tab").style.display = null;
    document.getElementById(tabType).classList.add("tab-selected");
    document.getElementById(tabType + "Menu").style.display = null;
    document.getElementById(tabType + "Paramshell").style.display = null;
    document.getElementById("paramshell").style.display = null;
    document.getElementById("menu").style.display = null;
    // document.getElementById("menu_expander").style.display = null;

    // Show taskSteps only for "network" tab
    if (tabType === "network" && taskSteps) {
        taskSteps.style.display = "block";
    }

    switch (tabType) {
        case "network": resizeMiddleSVG(); break;
        case "progress": setupPlots(); break;
        case "visualization": showPredictions(); break;
        case "education":
            document.getElementById("paramshell").style.display = "none";
            break;
    }

    // Give border radius to top and bottom neighbors
    if (document.getElementsByClassName("top_neighbor_tab-selected").length > 0) {
        document.getElementsByClassName("top_neighbor_tab-selected")[0].classList
            .remove("top_neighbor_tab-selected");
        document.getElementsByClassName("bottom_neighbor_tab-selected")[0].classList
            .remove("bottom_neighbor_tab-selected");
    }

    const tabMapping = ["blanktab", "network", "progress", "visualization",
        "middleblanktab", "education", "bottomblanktab"];
    const index = tabMapping.indexOf(tabType);

    document.getElementById(tabMapping[index - 1]).classList.add("top_neighbor_tab-selected");
    document.getElementById(tabMapping[index + 1]).classList.add("bottom_neighbor_tab-selected");
}


// 封装 AI 助手事件监听器
function setupAiAssistant(): void {
    const aiButton = document.getElementById("aiAssistantButton");
    const aiDialog = document.getElementById("aiAssistantDialog");
    const dialogContent = document.getElementById("dialogContent");
    const dialogInput = document.getElementById("dialogInput") as HTMLInputElement;
    const sendButton = document.getElementById("sendButton");

    if (!aiButton || !aiDialog || !dialogContent || !dialogInput || !sendButton) return;

    aiAssistantDialogElement = aiDialog;
    aiDialogInputElement = dialogInput;
    aiDialogContentElement = dialogContent;

    // 显示/隐藏对话框
    aiButton.addEventListener("click", () => {
        aiDialog.classList.toggle("hidden");
    });

    // 发送消息
    sendButton.addEventListener("click", async () => {
        const userMessage = dialogInput.value.trim();
        if (!userMessage) {
            return;
        }
        dialogInput.value = "";
        await sendAiMessage(userMessage);
    });
}

export function sendLayerContextToAi(layer: Layer): void {
    if (!aiAssistantDialogElement || !aiDialogInputElement) {
        return;
    }
    aiAssistantDialogElement.classList.remove("hidden");
    pendingAiAttachment = {
        kind: "layer",
        layerType: layer.layerType,
        params: layer.getParams()
    };
    updateAiContextAttachment();
    aiDialogInputElement.focus();
}

function updateAiContextAttachment(): void {
    if (!aiContextAttachmentElement || !aiContextTextElement) {
        return;
    }
    if (!pendingAiAttachment) {
        aiContextAttachmentElement.classList.add("hidden");
        aiContextActionsElement?.classList.add("hidden");
        return;
    }

    aiContextAttachmentElement.classList.remove("hidden");
    if (pendingAiAttachment.kind === "layer") {
        const params = pendingAiAttachment.params;
        const paramText = Object.keys(params).length > 0
            ? Object.entries(params).map(([key, value]) => `${key}: ${value}`).join(", ")
            : "无参数";
        aiContextTextElement.textContent = `已附加：${pendingAiAttachment.layerType}（${paramText}）`;
        aiContextActionsElement?.classList.add("hidden");
    } else {
        aiContextTextElement.textContent = `已选内容：${pendingAiAttachment.displayText}`;
        aiContextActionsElement?.classList.remove("hidden");
    }
}

async function sendAiMessage(
    userMessage: string,
    overrides?: {
        educationContext?: IEducationContextPayload;
        layerContext?: IAiLayerContext;
    }
): Promise<void> {
    if (!aiDialogContentElement) {
        return;
    }
    appendMessage(aiDialogContentElement, "user", userMessage);

    let layerContext: IAiLayerContext | undefined = overrides?.layerContext;
    if (!layerContext && pendingAiAttachment?.kind === "layer") {
        layerContext = {
            layerType: pendingAiAttachment.layerType,
            params: pendingAiAttachment.params
        };
    } else if (!layerContext && windowProperties.selectedElement instanceof Layer) {
        const layer = windowProperties.selectedElement;
        layerContext = {
            layerType: layer.layerType,
            params: layer.getParams()
        };
    }

    let educationContext: IEducationContextPayload | undefined = overrides?.educationContext;
    if (!educationContext && pendingAiAttachment?.kind === "education") {
        educationContext = {
            text: pendingAiAttachment.text,
            mode: "custom"
        };
    }

    const taskName = getCurrentTask();
    const aiResponse = await fetchAiResponse(userMessage, layerContext, taskName, educationContext);
    appendMessage(aiDialogContentElement, "assistant", aiResponse);
    pendingAiAttachment = null;
    updateAiContextAttachment();
}

async function handleAiContextAction(action: EducationAction): Promise<void> {
    if (!pendingAiAttachment || pendingAiAttachment.kind !== "education") {
        return;
    }
    const text = pendingAiAttachment.text;
    let prompt = "";
    switch (action) {
        case "explain":
            prompt = `请用通俗易懂的语言解释以下内容：\n${text}`;
            break;
        case "summarize":
            prompt = `请概括以下内容的要点，突出关键信息：\n${text}`;
            break;
        case "quiz":
            prompt = `请根据以下内容设计三道测验题，并给出参考答案：\n${text}`;
            break;
    }
    aiAssistantDialogElement?.classList.remove("hidden");
    if (aiDialogInputElement) {
        aiDialogInputElement.value = "";
    }
    await sendAiMessage(prompt, { educationContext: { text, mode: action } });
}

function setupEducationSelectionWatcher(): void {
    document.addEventListener("selectionchange", () => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            hideEducationSelectionHandle();
            return;
        }
        const text = selection.toString().trim();
        if (!text) {
            hideEducationSelectionHandle();
            return;
        }
        const range = selection.getRangeAt(0);
        if (!isNodeWithinEducation(range.commonAncestorContainer)) {
            hideEducationSelectionHandle();
            return;
        }
        const rect = getRangeRect(range);
        if (!rect) {
            hideEducationSelectionHandle();
            return;
        }
        educationSelectionText = text;
        showEducationSelectionHandle(rect);
    });
}

function showEducationSelectionHandle(rect: DOMRect): void {
    if (!educationSelectionHandle) {
        educationSelectionHandle = document.createElement("div");
        educationSelectionHandle.className = "education-ai-handle hidden";
        educationSelectionHandle.textContent = "AI";
        educationSelectionHandle.addEventListener("mousedown", (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
        educationSelectionHandle.addEventListener("click", () => {
            if (educationSelectionText) {
                attachEducationSelection(educationSelectionText);
            }
        });
        document.body.appendChild(educationSelectionHandle);
    }
    educationSelectionHandle.style.top = `${window.scrollY + rect.top - 30}px`;
    educationSelectionHandle.style.left = `${window.scrollX + rect.right + 10}px`;
    educationSelectionHandle.classList.remove("hidden");
}

function hideEducationSelectionHandle(): void {
    if (educationSelectionHandle) {
        educationSelectionHandle.classList.add("hidden");
    }
    educationSelectionText = null;
}

function attachEducationSelection(text: string): void {
    const cleaned = text.trim();
    if (!cleaned) {
        return;
    }
    const displayText = cleaned.length > 180 ? `${cleaned.slice(0, 180)}...` : cleaned;
    pendingAiAttachment = {
        kind: "education",
        text: cleaned,
        displayText
    };
    updateAiContextAttachment();
    aiAssistantDialogElement?.classList.remove("hidden");
    aiDialogInputElement?.focus();
    hideEducationSelectionHandle();
    const selection = window.getSelection();
    if (selection) {
        selection.removeAllRanges();
    }
}

function isNodeWithinEducation(node: Node | null): boolean {
    while (node) {
        if (node instanceof HTMLElement && node.id === "educationTab") {
            return true;
        }
        let parent: Node | null = null;
        if (node instanceof HTMLElement && node.parentElement) {
            parent = node.parentElement;
        }
        if (!parent && node.parentNode) {
            parent = node.parentNode;
        }
        node = parent;
    }
    return false;
}

function getRangeRect(range: Range): DOMRect | null {
    const rect = range.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
        return rect;
    }
    const clientRects = range.getClientRects();
    if (clientRects.length > 0) {
        return clientRects[0];
    }
    return null;
}

async function trainOnClick(): Promise<void> {
    const training = document.getElementById("train");

    // Check if training is active (i.e., the button text is "训练")
    if (training.classList.contains("train-active")) {
        // If training is active, stop the training and reset everything
        await stopTraining();
    } else {
        // If training is not active, start the training process
        await startTraining();
    }
}

async function startTraining(): Promise<void> {
    const training = document.getElementById("train");
    clearError();

    changeDataset(svgData.input.getParams().dataset); // Change dataset if needed
    setModelHyperparameters();

    resetTrainingFlag();

    const trainingBox = document.getElementById("ti_training");
    trainingBox.children[1].innerHTML = "Yes";
    training.classList.add("train-active");

    try {
        training.innerHTML = "点击终止"; // Change button text 
        model.architecture = buildNetworkDAG(svgData.input);
        await train(); // Start training  
    } catch (error) {
        displayError(error);
    } finally {
        training.innerHTML = "训练";
        training.classList.remove("train-active");
        trainingBox.children[1].innerHTML = "No";
    }   
}

async function stopTraining(): Promise<void> {
    const training = document.getElementById("train");

    // Reset the button text and class
    training.innerHTML = "训练";
    training.classList.remove("train-active");

    // Reset the training state, cancel any ongoing training process
    const trainingBox = document.getElementById("ti_training");
    trainingBox.children[1].innerHTML = "No";

    // Add any cleanup logic to stop the training, such as canceling ongoing requests
    // For example, you might have a training process that can be aborted:

    stopTrainingHandler() 
}
    //    // 获取ai谈话窗口弹窗元素
    //    const dialog = document.getElementById('aiAssistantDialog') as HTMLElement;
    //    const dialogHeader = dialog.querySelector('.dialog-header') as HTMLElement;
   
    //    let isDragging = false;
    //    let offsetX = 0;
    //    let offsetY = 0;
   
    //    // 监听鼠标按下事件，开始拖拽
    //    dialogHeader.addEventListener('mousedown', (e) => {
    //        isDragging = true;
    //        offsetX = e.clientX - dialog.getBoundingClientRect().left;
    //        offsetY = e.clientY - dialog.getBoundingClientRect().top;
   
    //        // 禁止文本选中，提高拖拽体验
    //        document.body.style.userSelect = 'none';
    //    });
   
    //    // 监听鼠标移动事件，进行拖动
    //    document.addEventListener('mousemove', (e) => {
    //        if (isDragging) {
    //            const left = e.clientX - offsetX;
    //            const top = e.clientY - offsetY;
   
    //            // 设置新的位置
    //            dialog.style.left = `${left}px`;
    //            dialog.style.top = `${top}px`;
    //        }
    //    });
   
    //    // 监听鼠标松开事件，结束拖拽
    //    document.addEventListener('mouseup', () => {
    //        isDragging = false;
    //        document.body.style.userSelect = 'auto'; // 恢复文本选中
    //    });
    

    function makeDraggable(element: HTMLElement) {
        let offsetX: number, offsetY: number;
    
        // 鼠标按下时触发
        element.addEventListener('mousedown', function (e: MouseEvent) {
            offsetX = e.clientX - element.getBoundingClientRect().left;
            offsetY = e.clientY - element.getBoundingClientRect().top;
    
            // 鼠标移动时触发
            function onMouseMove(e: MouseEvent) {
                element.style.left = `${e.clientX - offsetX}px`;
                element.style.top = `${e.clientY - offsetY}px`;
            }
    
            // 鼠标松开时停止拖拽
            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }
    
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }
    function makeResizable(element: HTMLElement) {
        const resizer = document.createElement('div');
        resizer.style.width = '10px';
        resizer.style.height = '10px';
        resizer.style.backgroundColor = '#888';
        resizer.style.position = 'absolute';
        resizer.style.right = '0';
        resizer.style.bottom = '0';
        resizer.style.cursor = 'se-resize';
        element.appendChild(resizer);
    
        let startX: number, startY: number, startWidth: number, startHeight: number;
    
        // 鼠标按下时触发
        resizer.addEventListener('mousedown', function (e: MouseEvent) {
            startX = e.clientX;
            startY = e.clientY;
            startWidth = element.offsetWidth;
            startHeight = element.offsetHeight;
    
            // 鼠标移动时触发
            function onMouseMove(e: MouseEvent) {
                const newWidth = startWidth + (e.clientX - startX);
                const newHeight = startHeight + (e.clientY - startY);
    
                // 更新元素的宽高
                element.style.width = `${newWidth}px`;
                element.style.height = `${newHeight}px`;
            }
    
            // 鼠标松开时停止缩放
            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }
    
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }
    

    
 
        
