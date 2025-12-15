from flask import Flask, request, jsonify
from flask_cors import CORS
from zhipuai import ZhipuAI
import re
from datetime import datetime, timedelta
from database import (
    init_database, create_user, get_user_by_username, 
    get_user_by_email, get_user_by_id, update_last_login,
    save_session, get_session_by_token, delete_session, delete_expired_sessions,
    save_user_progress, get_user_progress, update_task_completion, get_user_task_completion
)
from auth_utils import hash_password, verify_password, generate_token, verify_token

app = Flask(__name__)
CORS(app)

# 初始化数据库
init_database()

# 读取 API key 文件
def read_api_key(file_path):
    with open(file_path, 'r') as file:
        return file.read().strip()

# 初始化 ZhipuAI 客户端（使用你的 API key）
api_key = read_api_key("./dist/zhipuai_key.txt")
client = ZhipuAI(api_key=api_key)

# ==================== 认证相关 API ====================

def validate_email(email: str) -> bool:
    """验证邮箱格式"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_username(username: str) -> bool:
    """验证用户名格式（3-20个字符，只能包含字母、数字、下划线）"""
    pattern = r'^[a-zA-Z0-9_]{3,20}$'
    return re.match(pattern, username) is not None

def validate_password(password: str):
    """验证密码强度（至少6个字符）"""
    if len(password) < 6:
        return (False, "密码长度至少为6个字符")
    return (True, "")

@app.route('/api/auth/register', methods=['POST'])
def register():
    """用户注册"""
    try:
        data = request.json
        username = data.get('username', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        # 验证输入
        if not username:
            return jsonify({"success": False, "error": "用户名不能为空"}), 400
        if not email:
            return jsonify({"success": False, "error": "邮箱不能为空"}), 400
        if not password:
            return jsonify({"success": False, "error": "密码不能为空"}), 400
        
        if not validate_username(username):
            return jsonify({"success": False, "error": "用户名格式不正确（3-20个字符，只能包含字母、数字、下划线）"}), 400
        
        if not validate_email(email):
            return jsonify({"success": False, "error": "邮箱格式不正确"}), 400
        
        is_valid, error_msg = validate_password(password)
        if not is_valid:
            return jsonify({"success": False, "error": error_msg}), 400
        
        # 检查用户名是否已存在
        if get_user_by_username(username):
            return jsonify({"success": False, "error": "用户名已存在"}), 400
        
        # 检查邮箱是否已注册
        if get_user_by_email(email):
            return jsonify({"success": False, "error": "邮箱已被注册"}), 400
        
        # 创建用户
        password_hash = hash_password(password)
        user_id = create_user(username, email, password_hash)
        
        if not user_id:
            return jsonify({"success": False, "error": "注册失败"}), 500
        
        # 生成token
        token = generate_token(user_id, username)
        expires_at = datetime.utcnow() + timedelta(hours=168)
        save_session(user_id, token, expires_at)
        
        return jsonify({
            "success": True,
            "user_id": user_id,
            "token": token,
            "username": username,
            "email": email
        }), 201
        
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        print(f"注册错误: {e}")
        return jsonify({"success": False, "error": "服务器错误"}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    """用户登录"""
    try:
        data = request.json
        username_or_email = data.get('username', '').strip()
        password = data.get('password', '')
        remember_me = data.get('remember_me', False)
        
        if not username_or_email:
            return jsonify({"success": False, "error": "用户名或邮箱不能为空"}), 400
        if not password:
            return jsonify({"success": False, "error": "密码不能为空"}), 400
        
        # 根据输入判断是用户名还是邮箱
        if '@' in username_or_email:
            user = get_user_by_email(username_or_email.lower())
        else:
            user = get_user_by_username(username_or_email)
        
        if not user:
            return jsonify({"success": False, "error": "用户名或密码错误"}), 401
        
        # 验证密码
        if not verify_password(password, user['password_hash']):
            return jsonify({"success": False, "error": "用户名或密码错误"}), 401
        
        # 检查用户是否激活
        if not user['is_active']:
            return jsonify({"success": False, "error": "账户已被禁用"}), 403
        
        # 更新最后登录时间
        update_last_login(user['id'])
        
        # 生成token
        token = generate_token(user['id'], user['username'])
        expires_at = datetime.utcnow() + timedelta(hours=168 if remember_me else 24)
        save_session(user['id'], token, expires_at)
        
        return jsonify({
            "success": True,
            "user_id": user['id'],
            "token": token,
            "username": user['username'],
            "email": user['email']
        }), 200
        
    except Exception as e:
        print(f"登录错误: {e}")
        return jsonify({"success": False, "error": "服务器错误"}), 500

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """用户登出"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"success": False, "error": "未提供token"}), 401
        
        token = auth_header.split(' ')[1]
        delete_session(token)
        
        return jsonify({"success": True}), 200
    except Exception as e:
        print(f"登出错误: {e}")
        return jsonify({"success": False, "error": "服务器错误"}), 500

@app.route('/api/auth/verify', methods=['GET'])
def verify():
    """验证token有效性"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"valid": False, "error": "未提供token"}), 401
        
        token = auth_header.split(' ')[1]
        
        # 验证JWT token
        payload = verify_token(token)
        if not payload:
            return jsonify({"valid": False, "error": "token无效或已过期"}), 401
        
        # 检查数据库中的会话
        session = get_session_by_token(token)
        if not session:
            return jsonify({"valid": False, "error": "会话不存在或已过期"}), 401
        
        user = get_user_by_id(payload['user_id'])
        if not user or not user['is_active']:
            return jsonify({"valid": False, "error": "用户不存在或已被禁用"}), 401
        
        return jsonify({
            "valid": True,
            "user_id": user['id'],
            "username": user['username'],
            "email": user['email']
        }), 200
        
    except Exception as e:
        print(f"验证错误: {e}")
        return jsonify({"valid": False, "error": "服务器错误"}), 500

# 定期清理过期会话的装饰器（可选）
@app.before_request
def cleanup_expired_sessions():
    """在每次请求前清理过期会话（可以优化为定时任务）"""
    try:
        delete_expired_sessions()
    except:
        pass  # 忽略清理错误，不影响主流程

# ==================== 阶段二：学习进度 API ====================

def get_user_from_token():
    """从请求头中获取用户信息（辅助函数）"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header.split(' ')[1]
    payload = verify_token(token)
    if not payload:
        return None
    
    session = get_session_by_token(token)
    if not session:
        return None
    
    user = get_user_by_id(payload['user_id'])
    if not user or not user['is_active']:
        return None
    
    return user

@app.route('/api/progress/save', methods=['POST'])
def save_progress():
    """保存用户学习进度"""
    try:
        user = get_user_from_token()
        if not user:
            return jsonify({"success": False, "error": "未授权"}), 401
        
        data = request.json
        task_type = data.get('task_type')
        step_index = data.get('step_index')
        step_name = data.get('step_name')
        completed = data.get('completed', False)
        
        if not task_type or step_index is None or not step_name:
            return jsonify({"success": False, "error": "缺少必要参数"}), 400
        
        success = save_user_progress(
            user['id'], 
            task_type, 
            step_index, 
            step_name, 
            completed
        )
        
        if success:
            return jsonify({"success": True}), 200
        else:
            return jsonify({"success": False, "error": "保存失败"}), 500
            
    except Exception as e:
        print(f"保存进度错误: {e}")
        return jsonify({"success": False, "error": "服务器错误"}), 500

@app.route('/api/progress/get', methods=['GET'])
def get_progress():
    """获取用户学习进度"""
    try:
        user = get_user_from_token()
        if not user:
            return jsonify({"success": False, "error": "未授权"}), 401
        
        task_type = request.args.get('task_type')
        progress = get_user_progress(user['id'], task_type)
        
        return jsonify({
            "success": True,
            "progress": progress
        }), 200
        
    except Exception as e:
        print(f"获取进度错误: {e}")
        return jsonify({"success": False, "error": "服务器错误"}), 500

@app.route('/api/progress/task-completion', methods=['POST'])
def update_task_completion_api():
    """更新任务完成状态"""
    try:
        user = get_user_from_token()
        if not user:
            return jsonify({"success": False, "error": "未授权"}), 401
        
        data = request.json
        task_type = data.get('task_type')
        completion_rate = data.get('completion_rate', 0.0)
        completed = data.get('completed', False)
        
        if not task_type:
            return jsonify({"success": False, "error": "缺少任务类型"}), 400
        
        success = update_task_completion(
            user['id'],
            task_type,
            completion_rate,
            completed
        )
        
        if success:
            return jsonify({"success": True}), 200
        else:
            return jsonify({"success": False, "error": "更新失败"}), 500
            
    except Exception as e:
        print(f"更新任务完成状态错误: {e}")
        return jsonify({"success": False, "error": "服务器错误"}), 500

@app.route('/api/progress/tasks', methods=['GET'])
def get_all_tasks():
    """获取用户所有任务的完成情况"""
    try:
        user = get_user_from_token()
        if not user:
            return jsonify({"success": False, "error": "未授权"}), 401
        
        tasks = get_user_task_completion(user['id'])
        
        return jsonify({
            "success": True,
            "tasks": tasks
        }), 200
        
    except Exception as e:
        print(f"获取任务列表错误: {e}")
        return jsonify({"success": False, "error": "服务器错误"}), 500

# ==================== AI 助手 API ====================

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
