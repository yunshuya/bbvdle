/**
 * 认证服务：处理用户登录、注册、token管理
 */

export interface UserInfo {
    user_id: number;
    username: string;
    email: string;
}

export interface AuthResponse {
    success: boolean;
    user_id?: number;
    token?: string;
    username?: string;
    email?: string;
    error?: string;
}

export interface VerifyResponse {
    valid: boolean;
    user_id?: number;
    username?: string;
    email?: string;
    error?: string;
}

const API_BASE_URL = 'http://localhost:5000/api';
const TOKEN_KEY = 'bbvdle_auth_token';
const USER_KEY = 'bbvdle_user_info';

class AuthService {
    private currentUser: UserInfo | null = null;
    private token: string | null = null;

    constructor() {
        // 从localStorage加载token和用户信息
        this.loadFromStorage();
    }

    /**
     * 从localStorage加载token和用户信息
     */
    private loadFromStorage(): void {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        const storedUser = localStorage.getItem(USER_KEY);
        
        if (storedToken && storedUser) {
            this.token = storedToken;
            try {
                this.currentUser = JSON.parse(storedUser);
            } catch (e) {
                console.error('解析用户信息失败:', e);
                this.clearStorage();
            }
        }
    }

    /**
     * 保存到localStorage
     */
    private saveToStorage(token: string, userInfo: UserInfo): void {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(userInfo));
        this.token = token;
        this.currentUser = userInfo;
    }

    /**
     * 清除localStorage
     */
    private clearStorage(): void {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        this.token = null;
        this.currentUser = null;
    }

    /**
     * 获取当前token
     */
    public getToken(): string | null {
        return this.token;
    }

    /**
     * 获取当前用户信息
     */
    public getCurrentUser(): UserInfo | null {
        return this.currentUser;
    }

    /**
     * 检查是否已登录（包括游客模式）
     */
    public isAuthenticated(): boolean {
        // 游客模式：currentUser不为null但token为null
        // 正常登录：currentUser和token都不为null
        return this.currentUser !== null;
    }

    /**
     * 设置游客身份
     */
    public setGuestMode(): void {
        const guestUser: UserInfo = {
            user_id: 0,
            username: '游客',
            email: 'guest@bbvdle.local'
        };
        this.currentUser = guestUser;
        this.token = null; // 游客模式不使用token
        // 不保存到localStorage，游客身份只在当前会话有效
    }

    /**
     * 检查是否为游客模式
     */
    public isGuest(): boolean {
        return this.currentUser !== null && this.currentUser.user_id === 0;
    }

    /**
     * 用户注册
     */
    public async register(username: string, email: string, password: string): Promise<AuthResponse> {
        try {
            console.log('开始注册请求:', { username, email });
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    email,
                    password,
                }),
            });

            console.log('注册响应状态:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: '服务器错误' }));
                console.error('注册失败响应:', errorData);
                return {
                    success: false,
                    error: errorData.error || `服务器错误: ${response.status}`,
                };
            }

            const data: AuthResponse = await response.json();
            console.log('注册响应数据:', data);

            if (data.success && data.token && data.user_id) {
                const userInfo: UserInfo = {
                    user_id: data.user_id,
                    username: data.username!,
                    email: data.email!,
                };
                this.saveToStorage(data.token, userInfo);
                console.log('注册成功，已保存token和用户信息');
                return data;
            } else {
                console.error('注册响应格式错误:', data);
                return data;
            }
        } catch (error) {
            console.error('注册网络错误:', error);
            return {
                success: false,
                error: `网络错误: ${error instanceof Error ? error.message : '请检查网络连接和后端服务是否启动'}`,
            };
        }
    }

    /**
     * 用户登录
     */
    public async login(usernameOrEmail: string, password: string, rememberMe: boolean = false): Promise<AuthResponse> {
        try {
            console.log('开始登录请求:', { usernameOrEmail, rememberMe });
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: usernameOrEmail,
                    password,
                    remember_me: rememberMe,
                }),
            });

            console.log('登录响应状态:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: '服务器错误' }));
                console.error('登录失败响应:', errorData);
                return {
                    success: false,
                    error: errorData.error || `服务器错误: ${response.status}`,
                };
            }

            const data: AuthResponse = await response.json();
            console.log('登录响应数据:', data);

            if (data.success && data.token && data.user_id) {
                const userInfo: UserInfo = {
                    user_id: data.user_id,
                    username: data.username!,
                    email: data.email!,
                };
                this.saveToStorage(data.token, userInfo);
                console.log('登录成功，已保存token和用户信息');
                return data;
            } else {
                console.error('登录响应格式错误:', data);
                return data;
            }
        } catch (error) {
            console.error('登录网络错误:', error);
            return {
                success: false,
                error: `网络错误: ${error instanceof Error ? error.message : '请检查网络连接和后端服务是否启动'}`,
            };
        }
    }

    /**
     * 用户登出
     */
    public async logout(): Promise<void> {
        // 如果是游客，直接清除，不需要调用API
        if (this.isGuest()) {
            this.clearStorage();
            return;
        }
        
        if (this.token) {
            try {
                await fetch(`${API_BASE_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json',
                    },
                });
            } catch (error) {
                console.error('登出请求失败:', error);
            }
        }
        this.clearStorage();
    }

    /**
     * 验证token有效性
     */
    public async verifyToken(): Promise<boolean> {
        if (!this.token) {
            return false;
        }

        try {
            // 使用AbortController设置超时，避免长时间等待
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时
            
            try {
                const response = await fetch(`${API_BASE_URL}/auth/verify`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                    },
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                const data: VerifyResponse = await response.json();

                if (data.valid && data.user_id) {
                    // 更新用户信息
                    this.currentUser = {
                        user_id: data.user_id,
                        username: data.username!,
                        email: data.email!,
                    };
                    localStorage.setItem(USER_KEY, JSON.stringify(this.currentUser));
                    return true;
                } else {
                    // token无效，清除存储
                    this.clearStorage();
                    return false;
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                const error = fetchError as any;
                if (error.name === 'AbortError') {
                    console.log('验证token超时');
                } else {
                    console.error('验证token失败:', error);
                }
                // 网络错误时不清除存储，允许离线使用
                // this.clearStorage();
                return false;
            }
        } catch (error) {
            console.error('验证token异常:', error);
            // 异常时不清除存储，允许离线使用
            // this.clearStorage();
            return false;
        }
    }

    /**
     * 获取认证请求头
     */
    public getAuthHeaders(): { [key: string]: string } {
        if (this.token) {
            return {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            };
        }
        return {
            'Content-Type': 'application/json',
        };
    }
}

// 导出单例
export const authService = new AuthService();

