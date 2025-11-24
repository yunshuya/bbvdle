import * as d3 from "d3";
import { buildNetworkDAG, topologicalSort } from "../model/build_network";
import { generateJulia, generatePython } from "../model/code_generation";
import { changeDataset } from "../model/data";
import { download, graphToJson } from "../model/export_model";
import { setupPlots, setupTestResults, showPredictions } from "../model/graphs";
import { train } from "../model/mnist_model";
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
import { switchTask, toggleTaskSteps,verifyStepCompletion,isTaskAlready } from './taskModule';
import { appendMessage, fetchAiResponse } from './ai_assistant';
import { stopTrainingHandler, resetTrainingFlag} from "../model/mnist_model";


export interface IDraggableData {
    draggable: Draggable[];
    input: Input;
    output: Output;
}

export let svgData: IDraggableData = {
    draggable: [],
    input: null,
    output: null,
};

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
    const aiAssistantDialog = document.querySelector('#aiAssistantDialog') as HTMLElement;       
    makeDraggable(taskSteps);
    makeDraggable(aiAssistantDialog);
    makeResizable(taskSteps);
    makeResizable(aiAssistantDialog);
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
    taskOptions.forEach(option => {
        option.addEventListener("click", () => {
            const taskType = option.getAttribute("data-optionValue");
            //点击任务，修改当前任务的全局变量
            
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

    // 显示/隐藏对话框
    aiButton.addEventListener("click", () => {
        aiDialog.classList.toggle("hidden");
    });

    // 发送消息并模拟 AI 回复
    sendButton.addEventListener("click", async () => {
        const userMessage = dialogInput.value.trim();
        if (userMessage) {
            appendMessage(dialogContent, "user", userMessage);
            dialogInput.value = "";
            const aiResponse = await fetchAiResponse(userMessage);
            appendMessage(dialogContent, "assistant", aiResponse);
        }
       
    });
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
    

    
 
        
