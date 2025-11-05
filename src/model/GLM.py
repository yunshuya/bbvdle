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
    
    if user_message:
        # 调用 ZhipuAI API 获取回复
        try:
            print(user_message)
            response = client.chat.completions.create(
                model="glm-4",
                messages=[
                    {"role": "user", "content": "你现在作为一名深度学习神经网络教学者,用简洁准确的语言为我解答与神经网络相关的问题。"+ user_message
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
