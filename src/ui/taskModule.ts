
import { Layer } from "./shapes/layer";


import { Draggable } from "./shapes/draggable";
import { Activation,} from "./shapes/activation";
// taskModule.ts
let CurrentTask: string = "None";  // 当前学习的任务，全局变量，初始为 "None"
let taskSteps: { [key: string]: { step: string, requiredBlock: string, completed: boolean , parentLayer?: string  }[] } = {}; // 定义 taskSteps 类型,parentLayer是可选属性
export const taskMapping = {
    MLP: "多层感知机",
    CNN: "卷积神经网络",
    RNN: "循环神经网络",
} as const;

export async function switchTask(taskType: string): Promise<void> {
    console.log("Switching to task: " + taskType);
    const taskDisplay = document.getElementById("taskTitleText");
    const stepsList = document.getElementById("stepsList");
    if (!taskDisplay || !stepsList) return;
    //更新当前的任务类型
    CurrentTask = taskType; 
    taskDisplay.textContent = "当前任务: " + (taskMapping[taskType as keyof typeof taskMapping] || "未知任务");
    try {
        const response = await fetch('dist/tasksteps.json');
        if (!response.ok) throw new Error('无法加载任务步骤数据');
        const taskData = await response.json();
        taskSteps = taskData;
        // 将加载的任务步骤保存到 localStorage 中
        localStorage.setItem("taskSteps", JSON.stringify(taskSteps));  // 保存到 localStorage
        const steps = taskData[taskType] || ['未找到对应任务的步骤'];
        console.log(steps);
        stepsList.innerHTML = '';
        steps.forEach((step: { step: string, requiredBlock: string, completed: boolean }, index: number) => {
            const li = document.createElement('li');
            li.id = `step-${index}`;  // 给每个步骤添加唯一 ID
            li.textContent = step.step;
            stepsList.appendChild(li);
        });
        toggleTaskSteps(true);
    } catch (error) {
        console.error('加载任务步骤失败:', error);
        stepsList.innerHTML = '<li>任务步骤加载失败，请检查网络或联系管理员。</li>';
    }
}

export function toggleTaskSteps(forceOpen?: boolean): void {
    console.log("toggleTaskSteps");
    const taskContent = document.getElementById("taskContent");
    const arrow = document.getElementById("arrow");
    if (taskContent && arrow) {
        const isHidden = taskContent.style.display === 'none';
        if (forceOpen !== undefined) {
            taskContent.style.display = forceOpen ? 'block' : 'none';
            arrow.classList.toggle('open', forceOpen);
        } else {
            taskContent.style.display = isHidden ? 'block' : 'none';
            arrow.classList.toggle('open', isHidden);
        }
    }
}
//验证任务是否完成
export function verifyStepCompletion(item: Draggable): void {
    // 如果当前任务是 "None"，不进行任何操作
    if (CurrentTask === "None") {
        console.log("当前没有正在进行的任务");
        return;
    }

    // 获取当前任务的步骤
    const task = taskSteps[CurrentTask];
    if (!task) {
        console.error(`任务类型 '${CurrentTask}' 不存在`);
        return;  // 任务类型不存在时退出
    }
    // 定义一个映射，将字符串映射到相应的类
    // const layerTypeMap: { [key: string]: any } = {
    //     "input": Input,
    //     "dense": Dense,
    //     "dropout": Dropout,
    //     "relu": Relu,
    //     "batchnorm": BatchNorm,
    //     "concatenate": Concatenate,
    //     "conv2d": Conv2D,
    //     "flatten": Flatten,
    //     "maxpooling2d": MaxPooling2D,
    //     "sigmoid": Sigmoid,
    //     "tanh": Tanh,
    //     // 其他层类型的映射...
    // };

    // 遍历当前任务的步骤，检查是否有步骤需要当前 item 类型
    for (let i = 0; i < task.length; i++) {
        const step = task[i];
        // 如果当前步骤没有完成
        if (!step.completed) {
            // 如果当前步骤需要的模块是传入的模块类型
            let itemname = "None";
            if (item instanceof Layer) 
                itemname = item.layerType;
            else if(item instanceof Activation)
                itemname = item.activationType;

            if (step.requiredBlock === itemname.toLowerCase()) {
                markStepAsCompleted(i);
                break; // 标记步骤完成
            }
            // 如果步骤要求是连接（connected）
            // else if (step.requiredBlock === "connected") {
            //     // 获取当前步骤中的 parentLayer，判断当前层是否连接到正确的父层
            //     if (step.parentLayer) {
            //         // 使用映射将 parentLayer 字符串转换为对应的类
            //         const parentLayerType = layerTypeMap[step.parentLayer.toLowerCase()];

            //         // 使用 hasParentType 方法检查当前层是否已经连接到正确的父层
            //         if (parentLayerType && item.hasParentType(parentLayerType)) {
            //             console.log(parentLayerType);
            //             markStepAsCompleted(i);
            //         } else {
            //             markStepAsFault(i);
            //         }
            //     }
            //     break; // 处理完后跳出
            // } 
            else {if(step.requiredBlock ==="None"){
                markStepAsCompleted(i);
                break;
            }
            else {markStepAsFault(i);  // 如果步骤不符合，标记为失败
            break;}
            }
        }
    }
   
}


// 标记步骤为完成，并更新 UI
export function markStepAsCompleted(stepIndex: number): void {
    const stepsList = document.getElementById("stepsList");
    if (!stepsList) return;

    const stepElement = document.getElementById(`step-${stepIndex}`);
    if (stepElement) {
        // 删除叉标记（如果存在）
        stepElement.innerHTML = stepElement.innerHTML.replace('<span class="checkmark">×</span>', '');

        // 如果没有勾标记，添加勾
        if (!stepElement.innerHTML.includes('<span class="checkmark">✔</span>')) {
            stepElement.innerHTML += `<span class="checkmark">✔</span>`;
        }
        // 给步骤添加完成样式
        stepElement.classList.add('completed-step');
        stepElement.classList.remove('failed-step');

        // 更新任务步骤的 completed 状态
        const task = taskSteps[CurrentTask];
        if (task) {
            task[stepIndex].completed = true;
            console.log(task[stepIndex]);
        }
    }
}

// 标记步骤为失败，并更新 UI
export function markStepAsFault(stepIndex: number): void {
    const stepsList = document.getElementById("stepsList");
    if (!stepsList) return;

    const stepElement = document.getElementById(`step-${stepIndex}`);
    if (stepElement) {
        // 删除勾标记（如果存在）
        stepElement.innerHTML = stepElement.innerHTML.replace('<span class="checkmark">✔</span>', '');

        // 如果没有叉标记，添加叉
        if (!stepElement.innerHTML.includes('<span class="checkmark">×</span>')) {
            stepElement.innerHTML = `${stepElement.innerHTML}<span class="checkmark">×</span>`;
        }
        // 给步骤添加失败样式
        stepElement.classList.add('failed-step');
        stepElement.classList.remove('completed-step');
        

        // 更新任务步骤的 completed 状态
        const task = taskSteps[CurrentTask];
        if (task) {
            task[stepIndex].completed = false;  // 设置步骤为未完成
            console.log(task[stepIndex]);
        }
    }
}




//检查当前是否有教学任务
export function isTaskAlready(): boolean {
    if(CurrentTask =="None") return false;
        else return true;


}