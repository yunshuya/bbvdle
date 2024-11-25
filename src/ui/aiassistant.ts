
// 添加消息到对话框，并注明发送者
export function appendMessage(container: HTMLElement, sender: string, message: string): void {
    const messageWrapper = document.createElement("div");
    messageWrapper.className = sender === "user" ? "message user" : "message assistant";

    // 发送者标签
    const senderLabel = document.createElement("span");
    senderLabel.className = "sender-label";
    senderLabel.textContent = sender === "user" ? "用户" : "助手";

    // 消息内容
    const messageContent = document.createElement("div");
    messageContent.className = "message-content";
    messageContent.textContent = message;

    // 组合消息元素
    messageWrapper.appendChild(senderLabel);
    messageWrapper.appendChild(messageContent);
    container.appendChild(messageWrapper);

    // 自动滚动到最新消息
    container.scrollTop = container.scrollHeight;
}

// 调用 AI 响应（保留，供后续真实使用）
export async function fetchAiResponse(userMessage: string): Promise<string> {
    console.log(userMessage);
    return "暂未开放，请访问https://chatglm.cn/"; // 模拟固定回复
    // // 实例化对象
    // const apiKey = 'c7d010e5a72e05b370fd5c7ce71f6d3b.u6g5A7ALeBZGo5wo'; // 替换为你的实际API密钥
    // const chat = new ChatGLM(apiKey);
    // try {
    //     const {result} = await chat.completions.careate({
    //         model: "chatglm-4",
    //         stream: false,
    //         messages: [
    //             { role: "user", content: userMessage },
    //         ]
    //     });
    //     console.log(result.choices[0].message, "message")
    //     return typeof result.choices[0].message === 'string' ? result : "AI 无响应";
    // } catch (error) {
    //     console.error("AI 请求失败:", error);
    //     return "请求失败，请稍后再试。";
    // }
}
