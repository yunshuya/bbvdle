// taskModule.ts
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
    taskDisplay.textContent = "当前任务: " + (taskMapping[taskType as keyof typeof taskMapping] || "未知任务");
    try {
        const response = await fetch('dist/tasksteps.json');
        if (!response.ok) throw new Error('无法加载任务步骤数据');
        const taskSteps = await response.json();
        const steps: string[] = taskSteps[taskType] || ['未找到对应任务的步骤'];
        stepsList.innerHTML = '';
        steps.forEach((step) => {
            const li = document.createElement('li');
            li.textContent = step;
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
