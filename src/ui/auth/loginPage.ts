/**
 * 登录页面逻辑
 */

import { authService, AuthResponse } from './authService';

class LoginPage {
    private loginPageElement: HTMLElement | null = null;
    private isMainAppShown: boolean = false; // 标记主应用是否已显示

    /**
     * 初始化登录页面
     */
    public init(): void {
        this.loginPageElement = document.getElementById('loginPage');

        this.attachEventListeners();
        this.checkAuthStatus();
    }

    /**
     * 检查认证状态
     */
    private async checkAuthStatus(): Promise<void> {
        // 如果主应用已经显示，完全跳过认证检查（使用标记和DOM检查双重保护）
        if (this.isMainAppShown) {
            return;
        }
        
        const mainDiv = document.getElementById('main');
        if (mainDiv && !mainDiv.classList.contains('hidden')) {
            // 主应用已显示，更新标记并完全跳过认证检查
            this.isMainAppShown = true;
            return;
        }
        
        // 只有在主应用确实隐藏时才进行认证检查
        if (!mainDiv || !mainDiv.classList.contains('hidden')) {
            return;
        }
        
        // 如果已登录，验证token
        if (authService.isAuthenticated()) {
            try {
                const isValid = await authService.verifyToken();
                if (isValid) {
                    // 再次检查主应用状态，确保它仍然隐藏
                    const currentMainDiv = document.getElementById('main');
                    if (currentMainDiv && currentMainDiv.classList.contains('hidden') && !this.isMainAppShown) {
                        this.showMainApp();
                    }
                    return;
                }
            } catch (error) {
                console.warn('验证token时出错，但不影响当前操作:', error);
                // 如果验证失败但不影响当前操作，不强制显示登录页
                // 再次检查主应用状态
                const currentMainDiv = document.getElementById('main');
                if (currentMainDiv && currentMainDiv.classList.contains('hidden') && !this.isMainAppShown) {
                    this.showLoginPage();
                }
                return;
            }
        }

        // 未登录或token无效，只有在主应用确实隐藏时才显示登录页面
        const currentMainDiv = document.getElementById('main');
        if (currentMainDiv && currentMainDiv.classList.contains('hidden') && !this.isMainAppShown) {
            this.showLoginPage();
        }
    }

    /**
     * 显示登录页面
     */
    public showLoginPage(): void {
        // 重置主应用显示标记
        this.isMainAppShown = false;
        
        if (this.loginPageElement) {
            this.loginPageElement.classList.remove('hidden');
            // 移除可能存在的内联 display 样式，确保登录页面能正常显示
            this.loginPageElement.style.removeProperty('display');
        }
        // 隐藏主应用的所有内容
        const mainDiv = document.getElementById('main');
        if (mainDiv) {
            mainDiv.classList.add('hidden');
            // 移除主应用的内联 display 样式，确保下次显示时能正常工作
            mainDiv.style.removeProperty('display');
        }
    }

    /**
     * 显示主应用
     */
    public showMainApp(): void {
        const mainDiv = document.getElementById('main');
        if (!mainDiv) {
            console.error('主应用元素未找到！ID为"main"的元素不存在');
            return;
        }
        
        // 如果主应用已经显示（使用标记和DOM检查双重保护），完全跳过
        if (this.isMainAppShown || !mainDiv.classList.contains('hidden')) {
            // 更新标记以确保一致性
            this.isMainAppShown = true;
            return;
        }
        
        // 添加调用栈检查，如果不是从预期的位置调用，则忽略
        const stack = new Error().stack;
        if (stack) {
            // 检查调用栈，如果是从任务模块调用的，则忽略
            if (stack.includes('switchTask') || stack.includes('taskModule') || stack.includes('getProgress')) {
                console.warn('showMainApp被任务模块或进度服务意外调用，已忽略');
                return;
            }
        }
        
        console.log('showMainApp 被调用');
        
        // 设置标记，防止重复调用
        this.isMainAppShown = true;
        
        // 先立即隐藏登录页面，避免闪现
        if (this.loginPageElement) {
            console.log('立即隐藏登录页面');
            this.loginPageElement.classList.add('hidden');
            // 使用!important确保隐藏优先级最高
            this.loginPageElement.style.display = 'none';
        } else {
            console.warn('登录页面元素未找到');
        }
        
        // 然后显示主应用
        // 立即显示主应用
        console.log('显示主应用');
        mainDiv.classList.remove('hidden');
        mainDiv.style.display = 'block';
        console.log('主应用应该已显示');
        
        // 多次尝试重新计算布局，确保布局正确
        const tryResize = (attempt: number = 0) => {
            if (attempt > 5) {
                console.warn('多次尝试后仍无法计算布局');
                return;
            }
            
            // 使用requestAnimationFrame确保DOM完全渲染
            requestAnimationFrame(() => {
                setTimeout(() => {
                    const middleElement = document.getElementById('middle');
                    if (middleElement && middleElement.clientWidth > 0) {
                        // 触发resize事件以重新计算SVG布局
                        window.dispatchEvent(new Event('resize'));
                        console.log('已触发resize事件，重新计算布局');
                        
                        // 如果resizeMiddleSVG函数可用，直接调用
                        if (typeof (window as any).resizeMiddleSVG === 'function') {
                            (window as any).resizeMiddleSVG();
                            console.log(`直接调用了resizeMiddleSVG (尝试 ${attempt + 1})`);
                        } else {
                            console.warn('resizeMiddleSVG函数不可用');
                            // 如果函数还未加载，继续重试
                            if (attempt < 3) {
                                tryResize(attempt + 1);
                            }
                        }
                    } else {
                        // 如果middle元素尺寸为0，继续重试
                        console.log(`middle元素尺寸为0，重试中... (尝试 ${attempt + 1})`);
                        tryResize(attempt + 1);
                    }
                }, 100 * (attempt + 1)); // 每次重试延迟递增
            });
        };
        
        // 开始尝试（延迟一点，确保登录页面已隐藏）
        setTimeout(() => {
            tryResize(0);
        }, 50);
    }

    /**
     * 附加事件监听器
     */
    private attachEventListeners(): void {
        // 切换登录/注册
        const switchToRegister = document.getElementById('loginPageSwitchToRegister');
        const switchToLogin = document.getElementById('loginPageSwitchToLogin');

        if (switchToRegister) {
            switchToRegister.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchMode('register');
            });
        }

        if (switchToLogin) {
            switchToLogin.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchMode('login');
            });
        }

        // 登录表单提交
        const loginForm = document.getElementById('loginPageLoginFormElement') as HTMLFormElement;
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // 注册表单提交
        const registerForm = document.getElementById('loginPageRegisterFormElement') as HTMLFormElement;
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }

        // 跳过登录按钮
        const skipLoginButton = document.getElementById('skipLoginButton');
        if (skipLoginButton) {
            skipLoginButton.addEventListener('click', () => {
                console.log('跳过登录，直接进入主应用');
                // 直接显示主应用，不进行认证
                this.showMainApp();
            });
        }
    }

    /**
     * 切换登录/注册模式
     */
    private switchMode(mode: 'login' | 'register'): void {
        const loginForm = document.getElementById('loginPageLoginForm');
        const registerForm = document.getElementById('loginPageRegisterForm');
        const loginError = document.getElementById('loginPageError');
        const registerError = document.getElementById('loginPageRegisterError');

        if (mode === 'login') {
            if (loginForm) loginForm.classList.remove('hidden');
            if (registerForm) registerForm.classList.add('hidden');
            if (loginError) loginError.classList.add('hidden');
        } else {
            if (loginForm) loginForm.classList.add('hidden');
            if (registerForm) registerForm.classList.remove('hidden');
            if (registerError) registerError.classList.add('hidden');
        }
    }

    /**
     * 显示错误信息
     */
    private showError(message: string, isLogin: boolean = true): void {
        const errorElement = isLogin 
            ? document.getElementById('loginPageError')
            : document.getElementById('loginPageRegisterError');
        
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        }
    }

    /**
     * 隐藏错误信息
     */
    private hideError(isLogin: boolean = true): void {
        const errorElement = isLogin 
            ? document.getElementById('loginPageError')
            : document.getElementById('loginPageRegisterError');
        
        if (errorElement) {
            errorElement.classList.add('hidden');
        }
    }

    /**
     * 处理登录
     */
    private async handleLogin(): Promise<void> {
        const usernameInput = document.getElementById('loginPageUsername') as HTMLInputElement;
        const passwordInput = document.getElementById('loginPagePassword') as HTMLInputElement;
        const rememberMeInput = document.getElementById('loginPageRememberMe') as HTMLInputElement;
        const submitButton = document.querySelector('#loginPageLoginFormElement button[type="submit"]') as HTMLButtonElement;

        if (!usernameInput || !passwordInput) return;

        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const rememberMe = rememberMeInput ? rememberMeInput.checked : false;

        if (!username || !password) {
            this.showError('请填写完整信息', true);
            return;
        }

        this.hideError(true);
        if (submitButton) {
            submitButton.disabled = true;
            const buttonText = submitButton.querySelector('.login-button-text');
            if (buttonText) buttonText.textContent = '登录中...';
        }

        try {
            console.log('开始调用登录API...');
            const response: AuthResponse = await authService.login(username, password, rememberMe);
            console.log('登录API返回:', response);
            
            if (response.success && response.user_id) {
                console.log('登录成功，准备显示主应用');
                // 先立即隐藏登录页面，避免闪现
                if (this.loginPageElement) {
                    this.loginPageElement.classList.add('hidden');
                    this.loginPageElement.style.display = 'none';
                }
                // 登录成功，显示主应用
                this.showMainApp();
                // 触发自定义事件，通知其他模块（延迟触发，确保页面已切换）
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('userLoggedIn', { 
                        detail: { user: response } 
                    }));
                }, 100);
            } else {
                console.error('登录失败:', response.error);
                this.showError(response.error || '登录失败', true);
            }
        } catch (error) {
            console.error('登录异常:', error);
            this.showError(`登录失败: ${error instanceof Error ? error.message : '未知错误'}`, true);
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                const buttonText = submitButton.querySelector('.login-button-text');
                if (buttonText) buttonText.textContent = '登录';
            }
        }
    }

    /**
     * 处理注册
     */
    private async handleRegister(): Promise<void> {
        const usernameInput = document.getElementById('loginPageRegisterUsername') as HTMLInputElement;
        const emailInput = document.getElementById('loginPageRegisterEmail') as HTMLInputElement;
        const passwordInput = document.getElementById('loginPageRegisterPassword') as HTMLInputElement;
        const passwordConfirmInput = document.getElementById('loginPageRegisterPasswordConfirm') as HTMLInputElement;
        const submitButton = document.querySelector('#loginPageRegisterFormElement button[type="submit"]') as HTMLButtonElement;

        if (!usernameInput || !emailInput || !passwordInput || !passwordConfirmInput) return;

        const username = usernameInput.value.trim();
        const email = emailInput.value.trim().toLowerCase();
        const password = passwordInput.value;
        const passwordConfirm = passwordConfirmInput.value;

        // 验证输入
        if (!username || !email || !password || !passwordConfirm) {
            this.showError('请填写完整信息', false);
            return;
        }

        if (password !== passwordConfirm) {
            this.showError('两次输入的密码不一致', false);
            return;
        }

        if (password.length < 6) {
            this.showError('密码长度至少为6个字符', false);
            return;
        }

        this.hideError(false);
        if (submitButton) {
            submitButton.disabled = true;
            const buttonText = submitButton.querySelector('.login-button-text');
            if (buttonText) buttonText.textContent = '注册中...';
        }

        try {
            console.log('开始调用注册API...');
            const response: AuthResponse = await authService.register(username, email, password);
            console.log('注册API返回:', response);
            
            if (response.success && response.user_id) {
                console.log('注册成功，准备显示主应用');
                // 先立即隐藏登录页面，避免闪现
                if (this.loginPageElement) {
                    this.loginPageElement.classList.add('hidden');
                    this.loginPageElement.style.display = 'none';
                }
                // 注册成功，显示主应用
                this.showMainApp();
                // 触发自定义事件，通知其他模块（延迟触发，确保页面已切换）
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('userLoggedIn', { 
                        detail: { user: response } 
                    }));
                }, 100);
            } else {
                console.error('注册失败:', response.error);
                this.showError(response.error || '注册失败', false);
            }
        } catch (error) {
            console.error('注册异常:', error);
            this.showError(`注册失败: ${error instanceof Error ? error.message : '未知错误'}`, false);
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                const buttonText = submitButton.querySelector('.login-button-text');
                if (buttonText) buttonText.textContent = '注册';
            }
        }
    }
}

// 导出单例
export const loginPage = new LoginPage();

