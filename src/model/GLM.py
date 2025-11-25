from flask import Flask, request, jsonify
from flask_cors import CORS
from zhipuai import ZhipuAI

app = Flask(__name__)
CORS(app)

# 读取 API key 文件
def read_api_key(file_path):
    with open(file_path, 'r') as file:
        return file.read().strip()

# 初始化 ZhipuAI 客户端（使用你的 API key）
api_key = read_api_key("./dist/zhipuai_key.txt")
client = ZhipuAI(api_key=api_key)

# 定义一个简单的路由来处理用户消息
@app.route('/api/reply', methods=['POST'])
def reply():

    # 获取用户消息
    user_message = request.json.get('message')
    selected_layer = request.json.get('selectedLayer')
    task_name = request.json.get('taskName')
    education_context = request.json.get('educationContext')
    
    if user_message:
        # 调用 ZhipuAI API 获取回复
        try:
            # 构建上下文信息
            context_parts = ["你现在作为一名深度学习神经网络教学者,用简洁准确的语言为我解答与神经网络相关的问题。"]
            
            # 如果有选中的层，添加层信息到上下文
            if selected_layer:
                layer_type = selected_layer.get('layerType', '')
                layer_params = selected_layer.get('params', {})
                context_parts.append(f"\n当前用户选中了一个 {layer_type} 层。")
                if layer_params:
                    params_str = ", ".join([f"{k}: {v}" for k, v in layer_params.items()])
                    context_parts.append(f"该层的参数为: {params_str}。")
                context_parts.append("请根据这个层的信息，提供更有针对性的解答，例如解释该层的参数含义、作用等。")
            
            # 如果有当前任务，添加任务信息到上下文
            if task_name and task_name != "None":
                task_mapping = {
                    "MLP": "多层感知机",
                    "CNN": "卷积神经网络",
                    "RNN": "循环神经网络"
                }
                task_display_name = task_mapping.get(task_name, task_name)
                context_parts.append(f"\n当前用户正在进行 {task_display_name} 的学习任务。请结合该任务的特点提供建议。")
            
            # 如果有教学内容选中，添加进上下文
            if education_context:
                snippet = (education_context.get('text') or '').strip()
                mode = education_context.get('mode', 'custom')
                if snippet:
                    snippet = snippet[:1200]
                    if mode == 'summarize':
                        context_parts.append(f"\n请概括以下教学内容的要点，并突出重点：\n{snippet}\n")
                    elif mode == 'quiz':
                        context_parts.append(f"\n请根据以下教学内容设计三道测验题，并给出标准答案：\n{snippet}\n")
                    elif mode == 'explain':
                        context_parts.append(f"\n请用循序渐进的方式解释以下教学内容，并结合初学者视角：\n{snippet}\n")
                    else:
                        context_parts.append(f"\n以下是用户选中的教学内容，请在回答时参考：\n{snippet}\n")
            
            # 组合完整的提示词
            full_prompt = "".join(context_parts) + "\n\n用户问题: " + user_message
            
            print(full_prompt)
            response = client.chat.completions.create(
                model="glm-4",
                messages=[
                    {"role": "user", "content": full_prompt
                    }],
                top_p=0.7,
                temperature=0.9,
                stream=False,
                max_tokens=2000,
            )
            
            # 获取模型的回复内容
            print(response.choices[0].message.content)
            ai_reply = response.choices[0].message.content
            
            # 返回生成的回复
            return jsonify({"reply": ai_reply})

        except Exception as e:
            # 捕获异常并返回错误信息
            print(e)
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"error": "消息为空"}), 400

# 启动 Flask 服务
if __name__ == "__main__":
    # 本地测试使用以下代码
    app.run(debug=True, port=5000)
    
    # 部署到服务器使用以下代码
    # app.run(debug=True, host="0.0.0.0", port=5000)
