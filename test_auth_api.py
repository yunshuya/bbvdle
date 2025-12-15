"""
测试认证API的脚本
用于检查后端服务是否正常运行
"""
import requests
import json

API_BASE = "http://localhost:5000/api"

def test_register():
    """测试注册API"""
    print("=" * 50)
    print("测试注册API")
    print("=" * 50)
    
    url = f"{API_BASE}/auth/register"
    data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "123456"
    }
    
    try:
        response = requests.post(url, json=data)
        print(f"状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        print(f"响应内容: {response.text}")
        
        if response.status_code == 201:
            result = response.json()
            print(f"✅ 注册成功!")
            print(f"   User ID: {result.get('user_id')}")
            print(f"   Username: {result.get('username')}")
            print(f"   Token: {result.get('token')[:50]}...")
            return result.get('token')
        else:
            print(f"❌ 注册失败")
            result = response.json()
            print(f"   错误: {result.get('error')}")
            return None
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到后端服务!")
        print("   请确保后端服务正在运行: python src/model/GLM.py")
        return None
    except Exception as e:
        print(f"❌ 发生错误: {e}")
        return None

def test_login():
    """测试登录API"""
    print("\n" + "=" * 50)
    print("测试登录API")
    print("=" * 50)
    
    url = f"{API_BASE}/auth/login"
    data = {
        "username": "testuser",
        "password": "123456",
        "remember_me": False
    }
    
    try:
        response = requests.post(url, json=data)
        print(f"状态码: {response.status_code}")
        print(f"响应内容: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ 登录成功!")
            print(f"   User ID: {result.get('user_id')}")
            print(f"   Username: {result.get('username')}")
            print(f"   Token: {result.get('token')[:50]}...")
            return result.get('token')
        else:
            print(f"❌ 登录失败")
            result = response.json()
            print(f"   错误: {result.get('error')}")
            return None
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到后端服务!")
        print("   请确保后端服务正在运行: python src/model/GLM.py")
        return None
    except Exception as e:
        print(f"❌ 发生错误: {e}")
        return None

def test_verify(token):
    """测试验证API"""
    if not token:
        print("\n跳过验证测试（没有token）")
        return
    
    print("\n" + "=" * 50)
    print("测试验证API")
    print("=" * 50)
    
    url = f"{API_BASE}/auth/verify"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    try:
        response = requests.get(url, headers=headers)
        print(f"状态码: {response.status_code}")
        print(f"响应内容: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Token验证成功!")
            print(f"   User ID: {result.get('user_id')}")
            print(f"   Username: {result.get('username')}")
        else:
            print(f"❌ Token验证失败")
            result = response.json()
            print(f"   错误: {result.get('error')}")
    except Exception as e:
        print(f"❌ 发生错误: {e}")

if __name__ == "__main__":
    print("开始测试认证API...")
    print("请确保后端服务正在运行: python src/model/GLM.py\n")
    
    # 测试注册
    token = test_register()
    
    # 测试登录
    login_token = test_login()
    
    # 测试验证
    test_verify(login_token or token)
    
    print("\n" + "=" * 50)
    print("测试完成!")
    print("=" * 50)

