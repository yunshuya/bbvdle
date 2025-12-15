"""
数据库模型和初始化
"""
import sqlite3
import os
from datetime import datetime
from typing import Optional, Dict, Any
import hashlib

DB_PATH = os.path.join(os.path.dirname(__file__), '../../data', 'bbvdle.db')

def get_db_connection():
    """获取数据库连接"""
    # 确保数据目录存在
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # 使返回结果可以像字典一样访问
    return conn

def init_database():
    """初始化数据库表"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 创建用户表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            is_active BOOLEAN DEFAULT 1
        )
    ''')
    
    # 创建用户会话表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token VARCHAR(500) UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    
    # 创建用户学习进度表（阶段二）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            task_type VARCHAR(50) NOT NULL,
            step_index INTEGER NOT NULL,
            step_name TEXT NOT NULL,
            completed BOOLEAN DEFAULT 0,
            completed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, task_type, step_index)
        )
    ''')
    
    # 创建用户任务完成记录表（阶段二）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_task_completion (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            task_type VARCHAR(50) NOT NULL,
            completed BOOLEAN DEFAULT 0,
            completion_rate REAL DEFAULT 0.0,
            started_at DATETIME,
            completed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, task_type)
        )
    ''')
    
    conn.commit()
    conn.close()
    print(f"数据库初始化完成: {DB_PATH}")

def create_user(username: str, email: str, password_hash: str) -> Optional[int]:
    """创建新用户"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO users (username, email, password_hash)
            VALUES (?, ?, ?)
        ''', (username, email, password_hash))
        conn.commit()
        user_id = cursor.lastrowid
        return user_id
    except sqlite3.IntegrityError as e:
        if 'username' in str(e):
            raise ValueError("用户名已存在")
        elif 'email' in str(e):
            raise ValueError("邮箱已被注册")
        raise
    finally:
        conn.close()

def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """根据用户名获取用户"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE username = ?', (username,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """根据邮箱获取用户"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """根据ID获取用户"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def update_last_login(user_id: int):
    """更新最后登录时间"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE users SET last_login = ? WHERE id = ?
    ''', (datetime.now().isoformat(), user_id))
    conn.commit()
    conn.close()

def save_session(user_id: int, token: str, expires_at: datetime):
    """保存用户会话"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO user_sessions (user_id, token, expires_at)
        VALUES (?, ?, ?)
    ''', (user_id, token, expires_at.isoformat()))
    conn.commit()
    conn.close()

def get_session_by_token(token: str) -> Optional[Dict[str, Any]]:
    """根据token获取会话"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT s.*, u.username, u.email, u.is_active
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > datetime('now')
    ''', (token,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def delete_session(token: str):
    """删除会话"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM user_sessions WHERE token = ?', (token,))
    conn.commit()
    conn.close()

def delete_expired_sessions():
    """删除过期会话"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM user_sessions WHERE expires_at < datetime('now')")
    conn.commit()
    conn.close()

# ========== 阶段二：学习进度相关函数 ==========

def save_user_progress(user_id: int, task_type: str, step_index: int, step_name: str, completed: bool):
    """保存或更新用户学习进度"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # 使用 INSERT OR REPLACE 来更新或插入
        cursor.execute('''
            INSERT OR REPLACE INTO user_progress 
            (user_id, task_type, step_index, step_name, completed, completed_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ''', (
            user_id, 
            task_type, 
            step_index, 
            step_name, 
            1 if completed else 0,
            datetime.now().isoformat() if completed else None
        ))
        conn.commit()
        return True
    except Exception as e:
        print(f"保存进度错误: {e}")
        return False
    finally:
        conn.close()

def get_user_progress(user_id: int, task_type: str = None) -> list:
    """获取用户学习进度"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if task_type:
            cursor.execute('''
                SELECT * FROM user_progress 
                WHERE user_id = ? AND task_type = ?
                ORDER BY step_index ASC
            ''', (user_id, task_type))
        else:
            cursor.execute('''
                SELECT * FROM user_progress 
                WHERE user_id = ?
                ORDER BY task_type, step_index ASC
            ''', (user_id,))
        
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()

def update_task_completion(user_id: int, task_type: str, completion_rate: float, completed: bool = False):
    """更新任务完成状态"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # 检查是否已存在记录
        cursor.execute('''
            SELECT id FROM user_task_completion 
            WHERE user_id = ? AND task_type = ?
        ''', (user_id, task_type))
        existing = cursor.fetchone()
        
        if existing:
            # 更新现有记录
            cursor.execute('''
                UPDATE user_task_completion 
                SET completed = ?, completion_rate = ?, 
                    completed_at = ?, updated_at = datetime('now')
                WHERE user_id = ? AND task_type = ?
            ''', (
                1 if completed else 0,
                completion_rate,
                datetime.now().isoformat() if completed else None,
                user_id,
                task_type
            ))
        else:
            # 插入新记录
            cursor.execute('''
                INSERT INTO user_task_completion 
                (user_id, task_type, completed, completion_rate, started_at, completed_at)
                VALUES (?, ?, ?, ?, datetime('now'), ?)
            ''', (
                user_id,
                task_type,
                1 if completed else 0,
                completion_rate,
                datetime.now().isoformat() if completed else None
            ))
        
        conn.commit()
        return True
    except Exception as e:
        print(f"更新任务完成状态错误: {e}")
        return False
    finally:
        conn.close()

def get_user_task_completion(user_id: int) -> list:
    """获取用户所有任务的完成情况"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT * FROM user_task_completion 
            WHERE user_id = ?
            ORDER BY task_type
        ''', (user_id,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()

# 初始化数据库
if __name__ == "__main__":
    init_database()

