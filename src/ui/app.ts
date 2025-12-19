import * as d3 from "d3";
import { buildNetworkDAG, topologicalSort } from "../model/build_network";
import { generateJulia, generatePython } from "../model/code_generation";
import { changeDataset, dataset, AirPassengersData } from "../model/data";
import { download, graphToJson } from "../model/export_model";
import { setupPlots, setupTestResults, showPredictions } from "../model/graphs";
import { train, getTrainingHistory, stopTrainingHandler, resetTrainingFlag} from "../model/mnist_model";
import { model } from "../model/params_object";
import { loadStateIfPossible, storeNetworkInUrl } from "../model/save_state_url";
import { clearError, displayError } from "./error";
import { blankTemplate, defaultTemplate, resnetTemplate, rnnTemplate, lstmTemplate } from "./model_templates";
import { Activation, Relu, Sigmoid, Softmax, Tanh } from "./shapes/activation";
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
import { LSTM } from "./shapes/layers/lstm";
import { MaxPooling2D } from "./shapes/layers/maxpooling";
import { Output } from "./shapes/layers/output";
import { Recurrent } from "./shapes/layers/rnn";
import { Reshape } from "./shapes/layers/reshape";
import { TextBox } from "./shapes/textbox";
import { WireGuide } from "./shapes/wireguide";
import { Point } from "./shapes/shape";
import { copyTextToClipboard, getSvgOriginalBoundingBox } from "./utils";
import { windowProperties } from "./window";
import { switchTask, toggleTaskSteps,verifyStepCompletion,isTaskAlready, getCurrentTask } from './taskModule';
import { appendMessage, fetchAiResponse } from './ai_assistant';
import { authService } from './auth/authService';
import { authDialog } from './auth/authDialog';
import { loginPage } from './auth/loginPage';
import { noteManager } from './noteManager';


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

interface IChatMessage {
    sender: "user" | "assistant";
    content: string;
}

interface IConversation {
    id: number;
    title: string;
    messages: IChatMessage[];
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
let aiBackdropElement: HTMLElement | null = null;
let pendingAiAttachment: AiAttachment | null = null;
let educationSelectionHandle: HTMLDivElement | null = null;
let educationSelectionText: string | null = null;
let voiceRecognition: any = null;
let isRecording: boolean = false;
let conversations: IConversation[] = [];
let currentConversationId: number | null = null;
let aiConversationSelectElement: HTMLSelectElement | null = null;
let aiNewConversationButtonElement: HTMLButtonElement | null = null;

document.addEventListener("DOMContentLoaded", () => {

    // 首先初始化登录页面（应用入口）
    loginPage.init();

    // This function runs when the DOM is ready, i.e. when the document has been parsed
    setupPlots();
    setupTestResults();

    // 初始化认证系统
    setupAuthSystem();

    setupOptionOnClicks();
    setupIndividualOnClicks();

    const categoryElements = document.getElementsByClassName("categoryTitle") as HTMLCollectionOf<HTMLElement>;
    for (const elmt of categoryElements) {
        makeCollapsable(elmt);
    }

    window.addEventListener("resize", resizeMiddleSVG);
    window.addEventListener("resize", setupPlots);

    // 只在主应用显示时才调用resizeMiddleSVG
    // 如果main是hidden的，会在登录成功后自动调用
    const mainDivCheck = document.getElementById("main");
    if (mainDivCheck && !mainDivCheck.classList.contains("hidden")) {
        resizeMiddleSVG();
    }

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

    // 延迟加载网络状态，直到主应用显示
    // 如果主应用已经显示，立即加载；否则等待显示事件
    const mainDiv = document.getElementById("main");
    if (mainDiv && !mainDiv.classList.contains("hidden")) {
        svgData = loadStateIfPossible();
    } else {
        // 监听主应用显示事件
        const loadNetworkState = () => {
            svgData = loadStateIfPossible();
            // 加载后重新计算布局
            setTimeout(() => {
                resizeMiddleSVG();
            }, 100);
        };
        
        // 监听登录成功事件
        window.addEventListener('userLoggedIn', loadNetworkState, { once: true });
        
        // 也监听主应用显示（通过检查main的class变化）
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target as HTMLElement;
                    if (target.id === 'main' && !target.classList.contains('hidden')) {
                        loadNetworkState();
                        observer.disconnect();
                    }
                }
            });
        });
        
        if (mainDiv) {
            observer.observe(mainDiv, { attributes: true });
        }
    }

    // 不再默认选中输入层，让用户手动选择
    // svgData.input.select();

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
    aiBackdropElement = document.getElementById("aiBackdrop");
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
    // AI 对话框不需要拖拽和调整大小功能，保持居中固定
    setupEducationSelectionWatcher();
    setupNoteFeature();
});

function getOrCreateCurrentConversation(): IConversation {
    if (currentConversationId != null) {
        const existing = conversations.find((c) => c.id === currentConversationId);
        if (existing) {
            return existing;
        }
    }
    const nextId = conversations.length > 0 ? conversations[conversations.length - 1].id + 1 : 1;
    const conversation: IConversation = {
        id: nextId,
        title: `对话 ${nextId}`,
        messages: [],
    };
    conversations.push(conversation);
    currentConversationId = conversation.id;
    updateConversationSelectOptions();
    return conversation;
}

function createNewConversation(): void {
    const nextId = conversations.length > 0 ? conversations[conversations.length - 1].id + 1 : 1;
    const conversation: IConversation = {
        id: nextId,
        title: `对话 ${nextId}`,
        messages: [],
    };
    conversations.push(conversation);
    currentConversationId = conversation.id;
    updateConversationSelectOptions();
    renderCurrentConversation();
}

function updateConversationSelectOptions(): void {
    if (!aiConversationSelectElement) {
        return;
    }
    aiConversationSelectElement.innerHTML = "";
    for (const conv of conversations) {
        const option = document.createElement("option");
        option.value = String(conv.id);
        option.textContent = conv.title;
        aiConversationSelectElement.appendChild(option);
    }
    if (currentConversationId != null) {
        aiConversationSelectElement.value = String(currentConversationId);
    }
}

function renderCurrentConversation(): void {
    if (!aiDialogContentElement) {
        return;
    }
    aiDialogContentElement.innerHTML = "";
    if (currentConversationId == null) {
        return;
    }
    const conv = conversations.find((c) => c.id === currentConversationId);
    if (!conv) {
        return;
    }
    for (const msg of conv.messages) {
        appendMessage(aiDialogContentElement, msg.sender, msg.content);
    }
}

function appendMessageToCurrentConversation(sender: "user" | "assistant", content: string): void {
    if (!aiDialogContentElement) {
        return;
    }
    const conv = getOrCreateCurrentConversation();
    conv.messages.push({ sender, content });
    
    // 如果是第一条用户消息，更新对话标题
    if (sender === "user" && conv.messages.length === 1) {
        const titleText = content.length > 20 ? content.substring(0, 20) + "..." : content;
        conv.title = titleText;
        updateConversationSelectOptions();
    }
    
    appendMessage(aiDialogContentElement, sender, content);
}

function addOnClickToOptions(categoryId: string, func: (optionValue: string, element: HTMLElement) => void): void {
    console.log("addOnClickToOptions called for categoryId:", categoryId);
    const container = document.getElementById(categoryId);
    if (!container) {
        console.error("Container not found for categoryId:", categoryId);
        return;
    }
    const elements = container.getElementsByClassName("option");
    console.log("Found elements:", elements.length);
    for (const element of elements) {
        console.log("Adding click listener to element with data-optionValue:", element.getAttribute("data-optionValue"));
        element.addEventListener("click", () => {
            const optionValue = element.getAttribute("data-optionValue");
            console.log("Element clicked with optionValue:", optionValue);
            func(optionValue, element as HTMLElement);
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
    addOnClickToOptions("educationAct", (articleType) => {
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
        case "rnn": rnnTemplate(svgData); break;
        case "lstm": lstmTemplate(svgData); break;

    }
}

function appendItem(itemType: string): void {
    console.log("appendItem called with itemType:", itemType);
    
    // 检查 itemType 是否在映射中
    const itemMap: { [key: string]: any } = {
        add: Add,
        batchnorm: BatchNorm,
        concatenate: Concatenate,
        conv2D: Conv2D,
        dense: Dense,
        dropout: Dropout,
        flatten: Flatten,
        lstm: LSTM,
        maxPooling2D: MaxPooling2D,
        recurrent: Recurrent,
        relu: Relu,
        reshape: Reshape,
        sigmoid: Sigmoid,
        softmax: Softmax,
        tanh: Tanh,
    };
    
    if (!itemMap[itemType]) {
        console.error("Unknown itemType:", itemType);
        return;
    }
    
    try {
        // 获取画布大小并计算中心位置
        const svgElement = document.getElementById("svg") as unknown as SVGSVGElement;
        if (!svgElement) {
            console.error("SVG element not found");
            return;
        }
        
        const canvasBoundingBox = getSvgOriginalBoundingBox(svgElement);
        const centerX = canvasBoundingBox.width / 2;
        const centerY = canvasBoundingBox.height / 2;
        const centerPoint = new Point(centerX, centerY);
        
        // 在画布中心周围生成随机位置（随机范围：宽150px，高100px）
        const randomLocation = Point.randomPoint(150, 100, centerPoint);
        
        // 创建积木块并传入中心位置的随机坐标
        const item: Draggable = new itemMap[itemType](randomLocation);
        
        console.log("Created item:", item);

    svgData.draggable.push(item);
    //这里是验证教学任务的步骤
    if(isTaskAlready){
            verifyStepCompletion(item);    
    }
    } catch (error) {
        console.error("Error creating item of type", itemType, error);
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

    const middleElement = document.getElementById("middle");
    if (!middleElement) {
        console.warn("resizeMiddleSVG: middle元素未找到，可能主应用还未显示");
        return;
    }

    // 检查主应用是否显示
    const mainDiv = document.getElementById("main");
    if (mainDiv && mainDiv.classList.contains("hidden")) {
        console.warn("resizeMiddleSVG: 主应用还在隐藏状态，跳过布局计算");
        return;
    }

    const svgWidth = middleElement.clientWidth;
    const svgHeight = middleElement.clientHeight;

    // 如果尺寸为0，说明元素还未完全显示，延迟重试
    if (svgWidth === 0 || svgHeight === 0) {
        console.warn("resizeMiddleSVG: 元素尺寸为0，延迟重试");
        setTimeout(() => resizeMiddleSVG(), 100);
        return;
    }

    // 最初版本：只按宽度计算缩放比，水平居中
    const ratio = svgWidth / originalSVGWidth;

    const xTranslate = (svgWidth - originalSVGWidth) / 2;
    const yTranslate = Math.max(0, (svgHeight * ratio - svgHeight) / 2);

    const yOffsetDelta = yTranslate / ratio - windowProperties.svgYOffset;
    ActivationLayer.defaultInitialLocation.y += yOffsetDelta;
    Activation.defaultLocation.y += yOffsetDelta;

    windowProperties.svgYOffset = yTranslate / ratio;
    windowProperties.svgTransformRatio = ratio;

    const svgElement = document.getElementById("svg");
    if (svgElement) {
        svgElement.setAttribute(
            "transform",
            `translate(${xTranslate}, 0) scale(${ratio}, ${ratio})  `
        );
        console.log(
            `resizeMiddleSVG: 已设置transform, xTranslate=${xTranslate}, ratio=${ratio}`
        );
    }

    // 调整所有可拖拽元素的位置，确保仍在画布内
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

// 将resizeMiddleSVG暴露到全局作用域，以便其他模块调用
(window as any).resizeMiddleSVG = resizeMiddleSVG;

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

/**
 * 根据dataset类型更新visualizationMenu的显示
 * 当dataset为airpassengers时，隐藏分类菜单；当为其他dataset时，显示分类菜单
 */
function updateVisualizationMenu(): void {
    const classesCategory = document.getElementById("classes");
    if (!classesCategory) {
        return;
    }
    
    // 检测是否为时序数据（AirPassengers）
    const isTimeSeries = dataset instanceof AirPassengersData;
    
    // 根据dataset类型显示/隐藏分类菜单
    if (isTimeSeries) {
        // 时序数据：隐藏分类菜单
        classesCategory.style.display = "none";
    } else {
        // 分类数据：显示分类菜单
        classesCategory.style.display = "block";
    }
}

function switchTab(tabType: string): void {
    // Hide all tabs
    document.getElementById("networkTab").style.display = "none";
    document.getElementById("progressTab").style.display = "none";
    document.getElementById("visualizationTab").style.display = "none";
    document.getElementById("educationTab").style.display = "none";
    
    // 隐藏笔记栏（除非切换到education标签）
    const noteSidebar = document.getElementById("educationNoteSidebar");
    const noteShowBtn = document.getElementById("noteSidebarShowBtn");
    if (tabType !== "education") {
        if (noteSidebar) {
            noteSidebar.style.display = "none";
        }
        if (noteShowBtn) {
            noteShowBtn.style.display = "none";
        }
    }

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

    // 当切换到visualization标签时，根据dataset类型更新菜单显示
    if (tabType === "visualization") {
        updateVisualizationMenu();
    }

    switch (tabType) {
        case "network":
            // 确保笔记栏隐藏
            const networkNoteSidebar = document.getElementById("educationNoteSidebar");
            const networkNoteShowBtn = document.getElementById("noteSidebarShowBtn");
            if (networkNoteSidebar) {
                networkNoteSidebar.style.display = "none";
                networkNoteSidebar.classList.add("hidden");
            }
            if (networkNoteShowBtn) {
                networkNoteShowBtn.style.display = "none";
            }
            resizeMiddleSVG();
            break;
        case "progress":
            // 确保笔记栏隐藏
            const progressNoteSidebar = document.getElementById("educationNoteSidebar");
            const progressNoteShowBtn = document.getElementById("noteSidebarShowBtn");
            if (progressNoteSidebar) {
                progressNoteSidebar.style.display = "none";
                progressNoteSidebar.classList.add("hidden");
            }
            if (progressNoteShowBtn) {
                progressNoteShowBtn.style.display = "none";
            }
            setupPlots();
            break;
        case "visualization":
            // 确保笔记栏隐藏
            const vizNoteSidebar = document.getElementById("educationNoteSidebar");
            const vizNoteShowBtn = document.getElementById("noteSidebarShowBtn");
            if (vizNoteSidebar) {
                vizNoteSidebar.style.display = "none";
                vizNoteSidebar.classList.add("hidden");
            }
            if (vizNoteShowBtn) {
                vizNoteShowBtn.style.display = "none";
            }
            showPredictions();
            break;
        case "education":
            document.getElementById("paramshell").style.display = "none";
            // 显示笔记栏（仅在教学页面）
            const noteSidebar = document.getElementById("educationNoteSidebar");
            const noteShowBtn = document.getElementById("noteSidebarShowBtn");
            if (noteSidebar) {
                noteSidebar.classList.remove("hidden");
                noteSidebar.style.display = "flex";
                if (noteShowBtn && !noteSidebar.classList.contains("hidden")) {
                    noteShowBtn.style.display = "none";
                }
            }
            // 重新设置笔记标记的点击事件
            setTimeout(() => {
                setupNoteMarkClickHandlers();
            }, 100);
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


function openAiDialog(): void {
    if (!aiAssistantDialogElement) {
        return;
    }
    aiAssistantDialogElement.classList.remove("hidden");
    aiBackdropElement?.classList.remove("hidden");
}

function closeAiDialog(): void {
    if (!aiAssistantDialogElement) {
        return;
    }
    aiAssistantDialogElement.classList.add("hidden");
    aiBackdropElement?.classList.add("hidden");
}

// 封装 AI 助手事件监听器
function setupAiAssistant(): void {
    const aiButton = document.getElementById("aiAssistantButton");
    const aiDialog = document.getElementById("aiAssistantDialog");
    const dialogContent = document.getElementById("dialogContent");
    const dialogInput = document.getElementById("dialogInput") as HTMLInputElement;
    const sendButton = document.getElementById("sendButton");
    const closeButton = document.getElementById("closeAiDialog");
    const voiceInputButton = document.getElementById("voiceInputButton") as HTMLButtonElement;
    aiConversationSelectElement = document.getElementById("aiConversationSelect") as HTMLSelectElement;
    aiNewConversationButtonElement = document.getElementById("aiNewConversation") as HTMLButtonElement;

    if (!aiButton || !aiDialog || !dialogContent || !dialogInput || !sendButton) return;

    // 初始化语音识别
    initializeVoiceRecognition(voiceInputButton, dialogInput);

    aiAssistantDialogElement = aiDialog;
    aiDialogInputElement = dialogInput;
    aiDialogContentElement = dialogContent;

    // 初始化会话列表（至少一个默认会话）
    getOrCreateCurrentConversation();
    updateConversationSelectOptions();

    // 显示/隐藏对话框（悬浮居中 + 蒙版）
    aiButton.addEventListener("click", () => {
        if (aiDialog.classList.contains("hidden")) {
            openAiDialog();
        } else {
            closeAiDialog();
        }
    });

    // 点击蒙版关闭对话框
    if (aiBackdropElement) {
        aiBackdropElement.addEventListener("click", () => {
            closeAiDialog();
        });
    }

    // 发送消息
    sendButton.addEventListener("click", async () => {
        const userMessage = dialogInput.value.trim();
        if (!userMessage) {
            return;
        }
            dialogInput.value = "";
        await sendAiMessage(userMessage);
    });

    // 在输入框中按下 Enter 键发送消息
    dialogInput.addEventListener("keydown", async (event: KeyboardEvent) => {
        if (event.key === "Enter") {
            event.preventDefault();
            const userMessage = dialogInput.value.trim();
            if (!userMessage) {
                return;
            }
            dialogInput.value = "";
            await sendAiMessage(userMessage);
        }
    });

    // 右上角关闭按钮
    if (closeButton) {
        closeButton.addEventListener("click", () => {
            closeAiDialog();
        });
    }

    // 切换历史对话
    if (aiConversationSelectElement) {
        aiConversationSelectElement.addEventListener("change", () => {
            const value = aiConversationSelectElement.value;
            const id = Number(value);
            if (!Number.isNaN(id)) {
                currentConversationId = id;
                renderCurrentConversation();
            }
        });
    }

    // 新建对话
    if (aiNewConversationButtonElement) {
        aiNewConversationButtonElement.addEventListener("click", () => {
            createNewConversation();
        });
    }
}

function initializeVoiceRecognition(voiceButton: HTMLButtonElement | null, inputElement: HTMLInputElement): void {
    if (!voiceButton) {
        return;
    }

    // 检查浏览器是否支持语音识别
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
        // 不支持语音识别时，禁用按钮并提示
        voiceButton.disabled = true;
        voiceButton.title = "您的浏览器不支持语音输入";
        voiceButton.style.opacity = "0.5";
        return;
    }

    voiceRecognition = new SpeechRecognition();
    voiceRecognition.lang = "zh-CN"; // 设置为中文
    voiceRecognition.continuous = false; // 不连续识别
    voiceRecognition.interimResults = false; // 不返回临时结果

    voiceRecognition.onstart = () => {
        isRecording = true;
        voiceButton.classList.add("recording");
        voiceButton.title = "正在录音，点击停止";
    };

    voiceRecognition.onend = () => {
        isRecording = false;
        voiceButton.classList.remove("recording");
        voiceButton.title = "语音输入";
    };

    voiceRecognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (inputElement) {
            inputElement.value = transcript;
            inputElement.focus();
        }
    };

    voiceRecognition.onerror = (event: any) => {
        console.error("语音识别错误:", event.error);
        isRecording = false;
        voiceButton.classList.remove("recording");
        voiceButton.title = "语音输入";
        
        if (event.error === "not-allowed") {
            alert("请允许浏览器使用麦克风权限");
        } else if (event.error === "no-speech") {
            alert("未检测到语音，请重试");
        }
    };

    voiceButton.addEventListener("click", () => {
        if (isRecording) {
            voiceRecognition.stop();
        } else {
            try {
                voiceRecognition.start();
            } catch (error) {
                console.error("启动语音识别失败:", error);
            }
        }
    });
}

export function sendLayerContextToAi(layer: Layer): void {
    if (!aiAssistantDialogElement || !aiDialogInputElement) {
        return;
    }
    openAiDialog();
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
    appendMessageToCurrentConversation("user", userMessage);

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
    appendMessageToCurrentConversation("assistant", aiResponse);
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
    openAiDialog();
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
            hideNoteSelectionToolbar();
            return;
        }
        const text = selection.toString().trim();
        if (!text) {
            hideEducationSelectionHandle();
            hideNoteSelectionToolbar();
            return;
        }
        const range = selection.getRangeAt(0);
        if (!isNodeWithinEducation(range.commonAncestorContainer)) {
            hideEducationSelectionHandle();
            hideNoteSelectionToolbar();
            return;
        }
        const rect = getRangeRect(range);
        if (!rect) {
            hideEducationSelectionHandle();
            hideNoteSelectionToolbar();
            return;
        }
        educationSelectionText = text;
        // 保存选中信息供笔记功能使用
        noteManager.saveCurrentSelection();
        // 显示原有的AI按钮
        showEducationSelectionHandle(rect);
        // 显示笔记工具栏
        showNoteSelectionToolbar(rect);
    });
    
    // 点击其他地方时隐藏工具栏
    document.addEventListener("mousedown", (event) => {
        const toolbar = document.getElementById("educationSelectionToolbar");
        const dialog = document.getElementById("noteEditDialog");
        if (toolbar && !toolbar.contains(event.target as Node) && 
            (!dialog || !dialog.contains(event.target as Node))) {
            // 如果点击的不是工具栏或对话框，检查是否是文本选择
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
                hideNoteSelectionToolbar();
            }
        }
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
    openAiDialog();
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

// 笔记功能相关函数
function setupNoteFeature(): void {
    // 初始化笔记栏显示状态
    const sidebar = document.getElementById("educationNoteSidebar");
    const toggleBtn = document.getElementById("noteSidebarToggle");
    const showBtn = document.getElementById("noteSidebarShowBtn");
    
    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            if (sidebar) {
                sidebar.classList.add("hidden");
                if (showBtn) {
                    showBtn.style.display = "block";
                }
            }
        });
    }
    
    if (showBtn) {
        showBtn.addEventListener("click", () => {
            if (sidebar) {
                sidebar.classList.remove("hidden");
                showBtn.style.display = "none";
            }
        });
    }
    
    // 高亮按钮
    const highlightBtn = document.getElementById("highlightBtn");
    if (highlightBtn) {
        highlightBtn.addEventListener("click", () => {
            const success = noteManager.highlightSelection();
            if (success) {
                hideNoteSelectionToolbar();
                updateNoteList();
            }
        });
    }
    
    // 做笔记按钮
    const noteBtn = document.getElementById("noteBtn");
    if (noteBtn) {
        noteBtn.addEventListener("click", () => {
            showNoteEditDialog();
        });
    }
    
    // 笔记编辑对话框
    const noteEditDialog = document.getElementById("noteEditDialog");
    const noteEditClose = document.getElementById("noteEditClose");
    const noteEditCancel = document.getElementById("noteEditCancel");
    const noteEditSave = document.getElementById("noteEditSave");
    const noteEditTextarea = document.getElementById("noteEditTextarea") as HTMLTextAreaElement;
    
    const closeNoteDialog = () => {
        if (noteEditDialog) {
            noteEditDialog.style.display = "none";
            noteEditDialog.removeAttribute('data-editing-note-id');
        }
        if (noteEditTextarea) {
            noteEditTextarea.value = "";
        }
        hideNoteSelectionToolbar();
    };
    
    if (noteEditClose) {
        noteEditClose.addEventListener("click", closeNoteDialog);
    }
    
    if (noteEditCancel) {
        noteEditCancel.addEventListener("click", closeNoteDialog);
    }
    
    if (noteEditSave) {
        noteEditSave.addEventListener("click", () => {
            if (noteEditTextarea && noteEditDialog) {
                const noteContent = noteEditTextarea.value.trim();
                if (noteContent) {
                    const editingNoteId = noteEditDialog.getAttribute('data-editing-note-id');
                    
                    if (editingNoteId) {
                        // 编辑模式：更新现有笔记
                        const updated = noteManager.updateNote(editingNoteId, noteContent);
                        if (updated) {
                            closeNoteDialog();
                            updateNoteList();
                            // 滚动到更新后的笔记项并高亮
                            setTimeout(() => {
                                scrollToNoteInSidebar(editingNoteId);
                            }, 100);
                        }
                    } else {
                        // 新建模式：创建新笔记
                        const note = noteManager.createNote(noteContent);
                        if (note) {
                            closeNoteDialog();
                            updateNoteList();
                            // 等待DOM更新后再添加点击事件和滚动
                            setTimeout(() => {
                                const markElement = document.getElementById(note.id);
                                if (markElement) {
                                    addNoteMarkClickHandler(markElement);
                                }
                                scrollToNoteInSidebar(note.id);
                            }, 100);
                        }
                    }
                }
            }
        });
    }
    
    // 监听笔记创建事件
    document.addEventListener('noteCreated', ((event: CustomEvent) => {
        const noteId = event.detail.noteId;
        setTimeout(() => {
            const markElement = document.getElementById(noteId);
            if (markElement) {
                addNoteMarkClickHandler(markElement);
            }
        }, 100);
    }) as EventListener);
    
    // 点击对话框背景关闭
    if (noteEditDialog) {
        noteEditDialog.addEventListener("click", (event) => {
            if (event.target === noteEditDialog) {
                closeNoteDialog();
            }
        });
    }
    
    // 初始化笔记列表
    updateNoteList();
    
    // 延迟设置，确保DOM已完全加载
    setTimeout(() => {
        setupNoteMarkClickHandlers();
    }, 100);
    
    // 监听DOM变化，为新创建的笔记标记添加点击事件
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node instanceof HTMLElement) {
                    // 检查是否是笔记标记
                    if (node.classList.contains('education-note-mark')) {
                        addNoteMarkClickHandler(node);
                    }
                    // 检查子元素中是否有笔记标记
                    const noteMarks = node.querySelectorAll?.('.education-note-mark');
                    if (noteMarks) {
                        noteMarks.forEach((mark: Element) => {
                            addNoteMarkClickHandler(mark as HTMLElement);
                        });
                    }
                }
            });
        });
    });
    
    const educationTab = document.getElementById("educationTab");
    if (educationTab) {
        observer.observe(educationTab, {
            childList: true,
            subtree: true
        });
    }
    
    // 当切换到education标签时，重新设置笔记标记的点击事件
    const originalSwitchTab = (window as any).switchTab;
    if (originalSwitchTab) {
        (window as any).switchTab = function(tabType: string) {
            originalSwitchTab(tabType);
            if (tabType === "education") {
                setTimeout(() => {
                    setupNoteMarkClickHandlers();
                }, 100);
            }
        };
    }
}

function setupNoteMarkClickHandlers(): void {
    const noteMarks = document.querySelectorAll('.education-note-mark');
    noteMarks.forEach((mark) => {
        addNoteMarkClickHandler(mark as HTMLElement);
    });
}

function addNoteMarkClickHandler(markElement: HTMLElement): void {
    // 避免重复添加事件监听
    if (markElement.hasAttribute('data-note-click-handler')) {
        return;
    }
    markElement.setAttribute('data-note-click-handler', 'true');
    
    markElement.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        const noteId = markElement.id || markElement.getAttribute('data-note-id');
        if (noteId) {
            // 确保笔记栏可见
            const sidebar = document.getElementById("educationNoteSidebar");
            const showBtn = document.getElementById("noteSidebarShowBtn");
            if (sidebar) {
                if (sidebar.classList.contains("hidden")) {
                    sidebar.classList.remove("hidden");
                    sidebar.style.display = "flex";
                    if (showBtn) {
                        showBtn.style.display = "none";
                    }
                }
            }
            // 滚动到对应的笔记并高亮（稍微延迟确保笔记栏已显示）
            setTimeout(() => {
                scrollToNoteInSidebar(noteId);
            }, 100);
        }
    });
}

function showNoteSelectionToolbar(rect: DOMRect): void {
    const toolbar = document.getElementById("educationSelectionToolbar");
    if (!toolbar) {
        return;
    }
    
    // 计算工具栏位置（在选中文本上方）
    const toolbarTop = window.scrollY + rect.top - 40;
    const toolbarLeft = window.scrollX + rect.left + (rect.width / 2) - 80; // 居中显示
    
    toolbar.style.top = `${toolbarTop}px`;
    toolbar.style.left = `${toolbarLeft}px`;
    toolbar.style.display = "flex";
}

function hideNoteSelectionToolbar(): void {
    const toolbar = document.getElementById("educationSelectionToolbar");
    if (toolbar) {
        toolbar.style.display = "none";
    }
}

function showNoteEditDialog(noteId?: string): void {
    const dialog = document.getElementById("noteEditDialog");
    const textarea = document.getElementById("noteEditTextarea") as HTMLTextAreaElement;
    const dialogTitle = dialog?.querySelector('.note-edit-header > span') as HTMLElement;
    
    if (dialog && textarea) {
        dialog.style.display = "flex";
        
        if (noteId) {
            // 编辑模式：加载现有笔记内容
            const note = noteManager.getNote(noteId);
            if (note) {
                textarea.value = note.noteContent;
                if (dialogTitle) {
                    dialogTitle.textContent = "编辑笔记";
                }
                // 保存当前编辑的笔记ID到dialog的data属性
                dialog.setAttribute('data-editing-note-id', noteId);
            }
        } else {
            // 新建模式
            textarea.value = "";
            if (dialogTitle) {
                dialogTitle.textContent = "添加笔记";
            }
            dialog.removeAttribute('data-editing-note-id');
        }
        
        textarea.focus();
        // 将光标移到文本末尾
        if (textarea.value) {
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
    }
    hideNoteSelectionToolbar();
}

function updateNoteList(): void {
    const noteList = document.getElementById("educationNoteList");
    if (!noteList) {
        return;
    }
    
    const notes = noteManager.getAllNotes();
    noteList.innerHTML = "";
    
    if (notes.length === 0) {
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "note-empty-message";
        emptyMsg.textContent = "暂无笔记";
        emptyMsg.style.textAlign = "center";
        emptyMsg.style.color = "#999";
        emptyMsg.style.padding = "20px";
        noteList.appendChild(emptyMsg);
        return;
    }
    
    // 按照在页面中的位置排序笔记（从上到下）
    const educationTab = document.getElementById("educationTab");
    const notesWithPosition = notes.map(note => {
        const position = noteManager.getNotePosition(note.id);
        return { note, position: position ? position.top : 0 };
    });
    notesWithPosition.sort((a, b) => a.position - b.position);
    
    notesWithPosition.forEach(({ note }) => {
        const noteItem = document.createElement("div");
        noteItem.className = "note-item";
        // 先设置属性，避免innerHTML覆盖
        noteItem.setAttribute("data-note-id", note.id);
        noteItem.id = `note-item-${note.id}`;
        
        // 显示原文（截断）
        const textPreview = note.text.length > 50 
            ? note.text.substring(0, 50) + "..." 
            : note.text;
        
        // 处理笔记内容中的换行
        const noteContentHtml = escapeHtml(note.noteContent).replace(/\n/g, '<br>');
        
        // 创建内容（确保属性不会被覆盖）
        const headerDiv = document.createElement("div");
        headerDiv.className = "note-item-header";
        
        const textDiv = document.createElement("div");
        textDiv.className = "note-item-text";
        textDiv.textContent = `"${textPreview}"`;
        
        // 创建按钮容器
        const buttonsContainer = document.createElement("div");
        buttonsContainer.className = "note-item-buttons";
        buttonsContainer.style.display = "flex";
        buttonsContainer.style.gap = "5px";
        
        // 编辑按钮
        const editBtn = document.createElement("button");
        editBtn.className = "note-item-edit";
        editBtn.setAttribute("data-note-id", note.id);
        editBtn.title = "编辑";
        editBtn.textContent = "✎";
        
        // 删除按钮
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "note-item-delete";
        deleteBtn.setAttribute("data-note-id", note.id);
        deleteBtn.title = "删除";
        deleteBtn.textContent = "×";
        
        buttonsContainer.appendChild(editBtn);
        buttonsContainer.appendChild(deleteBtn);
        
        headerDiv.appendChild(textDiv);
        headerDiv.appendChild(buttonsContainer);
        
        const contentDiv = document.createElement("div");
        contentDiv.className = "note-item-content";
        contentDiv.innerHTML = noteContentHtml;
        
        noteItem.appendChild(headerDiv);
        noteItem.appendChild(contentDiv);
        
        // 编辑按钮事件
        editBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            showNoteEditDialog(note.id);
        });
        
        // 删除按钮事件
        deleteBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            if (confirm("确定要删除这条笔记吗？")) {
                const deleted = noteManager.deleteNote(note.id);
                if (deleted) {
                    updateNoteList();
                }
            }
        });
        
        // 点击笔记项可以滚动到对应的文本位置
        noteItem.style.cursor = "pointer";
        noteItem.addEventListener("click", (event) => {
            // 如果点击的是删除按钮或编辑按钮，不触发定位
            const target = event.target as HTMLElement;
            if (target.classList.contains('note-item-delete') || 
                target.classList.contains('note-item-edit') ||
                target.closest('.note-item-buttons')) {
                return;
            }
            
            const element = document.getElementById(note.id);
            if (element && educationTab) {
                // 确保笔记栏可见
                const sidebar = document.getElementById("educationNoteSidebar");
                if (sidebar && sidebar.classList.contains("hidden")) {
                    sidebar.classList.remove("hidden");
                    const showBtn = document.getElementById("noteSidebarShowBtn");
                    if (showBtn) {
                        showBtn.style.display = "none";
                    }
                }
                
                // 滚动到正文中的笔记位置
                element.scrollIntoView({ behavior: "smooth", block: "center" });
                // 高亮一下
                element.style.transition = "background-color 0.3s";
                element.style.backgroundColor = "rgba(255, 215, 0, 0.3)";
                setTimeout(() => {
                    element.style.backgroundColor = "";
                }, 1000);
            }
        });
        
        noteList.appendChild(noteItem);
    });
}

function scrollToNoteInSidebar(noteId: string): void {
    // 确保笔记栏可见
    const sidebar = document.getElementById("educationNoteSidebar");
    if (sidebar) {
        if (sidebar.classList.contains("hidden")) {
            sidebar.classList.remove("hidden");
            sidebar.style.display = "flex";
            const showBtn = document.getElementById("noteSidebarShowBtn");
            if (showBtn) {
                showBtn.style.display = "none";
            }
        }
    }
    
    // 等待一小段时间确保DOM更新完成
    setTimeout(() => {
        // 使用多种选择器尝试找到笔记项
        let noteItem: HTMLElement | null = null;
        
        // 方法1: 通过类名和data-note-id查找（最精确）
        noteItem = document.querySelector(`.note-item[data-note-id="${noteId}"]`) as HTMLElement;
        
        // 方法2: 通过ID查找
        if (!noteItem) {
            noteItem = document.getElementById(`note-item-${noteId}`) as HTMLElement;
        }
        
        // 方法3: 通过笔记列表遍历查找
        if (!noteItem) {
            const noteList = document.getElementById("educationNoteList");
            if (noteList) {
                const items = noteList.querySelectorAll('.note-item');
                for (let i = 0; i < items.length; i++) {
                    const item = items[i] as HTMLElement;
                    const itemNoteId = item.getAttribute('data-note-id');
                    if (itemNoteId === noteId) {
                        noteItem = item;
                        break;
                    }
                }
            }
        }
        
        if (noteItem) {
            // 滚动到笔记项（在笔记栏内部滚动）
            const noteList = document.getElementById("educationNoteList");
            if (noteList) {
                // 计算笔记项相对于笔记列表的位置进行精确滚动
                const itemRect = noteItem.getBoundingClientRect();
                const listRect = noteList.getBoundingClientRect();
                const scrollTop = noteList.scrollTop;
                const itemTop = itemRect.top - listRect.top + scrollTop;
                
                // 平滑滚动到笔记项位置
                noteList.scrollTo({
                    top: itemTop - 20, // 留一些顶部空间
                    behavior: 'smooth'
                });
            } else {
                noteItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
            
            // 高亮笔记项（使用更强的视觉效果）
            const originalBg = noteItem.style.backgroundColor || window.getComputedStyle(noteItem).backgroundColor;
            const originalShadow = noteItem.style.boxShadow || window.getComputedStyle(noteItem).boxShadow;
            const originalBorder = noteItem.style.borderColor || window.getComputedStyle(noteItem).borderColor;
            
            noteItem.style.transition = "background-color 0.3s, box-shadow 0.3s, border-color 0.3s";
            noteItem.style.backgroundColor = "rgba(255, 215, 0, 0.5)";
            noteItem.style.boxShadow = "0 4px 16px rgba(255, 215, 0, 0.7)";
            noteItem.style.borderColor = "#FFD700";
            noteItem.style.borderWidth = "2px";
            
            setTimeout(() => {
                noteItem.style.backgroundColor = originalBg;
                noteItem.style.boxShadow = originalShadow;
                noteItem.style.borderColor = originalBorder;
                noteItem.style.borderWidth = "";
            }, 2000);
        } else {
            // 调试信息：输出所有笔记项的ID以便排查问题
            const allItems = document.querySelectorAll('.note-item');
            const allNoteIds = Array.from(allItems).map(item => ({
                id: (item as HTMLElement).id,
                dataNoteId: (item as HTMLElement).getAttribute('data-note-id')
            }));
            console.warn(`找不到笔记项: ${noteId}`, {
                searchNoteId: noteId,
                allNoteItems: allNoteIds
            });
        }
    }, 50);
}

function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
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

/**
 * 初始化认证系统
 */
function setupAuthSystem(): void {
    // 初始化认证对话框
    authDialog.init();

    // 获取UI元素
    const userInfoElement = document.getElementById('userInfo');
    const loginButtonsElement = document.getElementById('loginButtons');
    const userNameElement = document.getElementById('userName');
    const logoutButton = document.getElementById('logoutButton');

    // 更新用户状态显示
    function updateUserStatus(): void {
        const user = authService.getCurrentUser();
        const isAuthenticated = authService.isAuthenticated();

        if (isAuthenticated && user) {
            // 显示用户信息
            if (userInfoElement) userInfoElement.classList.remove('hidden');
            if (loginButtonsElement) loginButtonsElement.classList.add('hidden');
            if (userNameElement) userNameElement.textContent = user.username;
        } else {
            // 隐藏用户信息（登出后返回登录页面，不需要显示登录按钮）
            if (userInfoElement) userInfoElement.classList.add('hidden');
            if (loginButtonsElement) loginButtonsElement.classList.add('hidden');
        }
    }

    // 登出按钮点击事件
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            await authService.logout();
            updateUserStatus();
            // 登出后返回登录页面
            loginPage.showLoginPage();
            console.log('已登出');
        });
    }

    // 监听登录成功事件
    window.addEventListener('userLoggedIn', async () => {
        updateUserStatus();
        
        // 登录成功后重新计算布局
        // 使用requestAnimationFrame确保DOM完全渲染
        requestAnimationFrame(() => {
            setTimeout(() => {
                resizeMiddleSVG();
                console.log('登录成功后重新计算SVG布局');
            }, 300);
        });
    });

    // 页面加载时验证token（由loginPage处理）
    // 这里只更新状态栏显示
    updateUserStatus();
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
    

    
 
        
