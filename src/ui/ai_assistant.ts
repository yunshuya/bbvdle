import axios from 'axios';

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

// 从 dist 目录读取 ip.txt 文件的内容
async function getServerIP() {
    try {
      const response = await fetch('/dist/ip.txt');  // 假设 ip.txt 放在静态目录下
      const ip = await response.text();
      return ip.trim();  // 去掉任何多余的换行符或空格
    } catch (error) {
      console.error('获取 IP 地址失败:', error);
      return 'localhost';  // 如果失败，可以返回默认的本地地址
    }
  }

// 调用 Python 后端的 REST API 获取回复
export async function fetchAiResponse(
    userMessage: string,
    selectedLayerInfo?: {
        layerType: string;
        params: { [key: string]: any };
    },
    taskName?: string,
    educationContext?: {
        text: string;
        mode?: string;
    }
): Promise<string> {
    // return "你好，我是AI助手，有什么可以帮助你的吗？"
    const serverIP = await getServerIP();
    const apiUrl = `http://${serverIP}:5000/api/reply`;

    try {
        const response = await axios.post(apiUrl, {
            message: userMessage,
            selectedLayer: selectedLayerInfo,
            taskName: taskName,
            educationContext
        });
        return response.data.reply;
    } catch (error) {
        console.error("请求失败:", error);
        return "无法连接到后端服务。";
    }
}