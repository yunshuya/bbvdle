/**
 * 登录/注册对话框组件
 */

import { authService, AuthResponse } from './authService';

export type AuthMode = 'login' | 'register';

export interface AuthDialogCallbacks {
    onSuccess?: (userInfo: { user_id: number; username: string; email: string }) => void;
    onClose?: () => void;
}

class AuthDialog {
    private dialogElement: HTMLElement | null = null;
    private backdropElement: HTMLElement | null = null;
    private currentMode: AuthMode = 'login';
    private callbacks: AuthDialogCallbacks = {};

    /**
     * 初始化对话框
     */
    public init(): void {
        this.createDialog();
        this.attachEventListeners();
    }

    /**
     * 创建对话框HTML
     */
    private createDialog(): void {
        // 创建背景遮罩
        const backdrop = document.createElement('div');
        backdrop.id = 'authBackdrop';
        backdrop.className = 'auth-backdrop hidden';
        backdrop.addEventListener('click', () => this.close());
        this.backdropElement = backdrop;

        // 创建对话框
        const dialog = document.createElement('div');
        dialog.id = 'authDialog';
        dialog.className = 'auth-dialog hidden';
        dialog.innerHTML = `
            <div class="auth-dialog-header">
                <div class="auth-dialog-title">
                    <span id="authDialogTitle">登录</span>
                </div>
                <button id="authDialogClose" class="auth-dialog-close" title="关闭">×</button>
            </div>
            <div class="auth-dialog-content">
                <div id="authError" class="auth-error hidden"></div>
                
                <!-- 登录表单 -->
                <form id="loginForm" class="auth-form">
                    <div class="auth-form-group">
                        <label for="loginUsername">用户名或邮箱</label>
                        <input type="text" id="loginUsername" name="username" required autocomplete="username">
                    </div>
                    <div class="auth-form-group">
                        <label for="loginPassword">密码</label>
                        <input type="password" id="loginPassword" name="password" required autocomplete="current-password">
                    </div>
                    <div class="auth-form-group">
                        <label class="auth-checkbox-label">
                            <input type="checkbox" id="rememberMe" name="rememberMe">
                            <span>记住我</span>
                        </label>
                    </div>
                    <button type="submit" class="auth-button auth-button-primary">登录</button>
                </form>

                <!-- 注册表单 -->
                <form id="registerForm" class="auth-form hidden">
                    <div class="auth-form-group">
                        <label for="registerUsername">用户名</label>
                        <input type="text" id="registerUsername" name="username" required 
                               pattern="[a-zA-Z0-9_]{3,20}" 
                               title="3-20个字符，只能包含字母、数字、下划线"
                               autocomplete="username">
                        <small class="auth-form-hint">3-20个字符，只能包含字母、数字、下划线</small>
                    </div>
                    <div class="auth-form-group">
                        <label for="registerEmail">邮箱</label>
                        <input type="email" id="registerEmail" name="email" required autocomplete="email">
                    </div>
                    <div class="auth-form-group">
                        <label for="registerPassword">密码</label>
                        <input type="password" id="registerPassword" name="password" required 
                               minlength="6"
                               autocomplete="new-password">
                        <small class="auth-form-hint">至少6个字符</small>
                    </div>
                    <div class="auth-form-group">
                        <label for="registerPasswordConfirm">确认密码</label>
                        <input type="password" id="registerPasswordConfirm" name="passwordConfirm" required 
                               autocomplete="new-password">
                    </div>
                    <button type="submit" class="auth-button auth-button-primary">注册</button>
                </form>

                <!-- 切换链接 -->
                <div class="auth-switch">
                    <span id="authSwitchText">还没有账号？</span>
                    <a href="#" id="authSwitchLink">立即注册</a>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);
        document.body.appendChild(dialog);
        this.dialogElement = dialog;
    }

    /**
     * 附加事件监听器
     */
    private attachEventListeners(): void {
        if (!this.dialogElement) return;

        // 关闭按钮
        const closeBtn = this.dialogElement.querySelector('#authDialogClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // 切换登录/注册
        const switchLink = this.dialogElement.querySelector('#authSwitchLink');
        if (switchLink) {
            switchLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchMode();
            });
        }

        // 登录表单提交
        const loginForm = this.dialogElement.querySelector('#loginForm') as HTMLFormElement;
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // 注册表单提交
        const registerForm = this.dialogElement.querySelector('#registerForm') as HTMLFormElement;
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }
    }

    /**
     * 切换登录/注册模式
     */
    private switchMode(): void {
        this.currentMode = this.currentMode === 'login' ? 'register' : 'login';
        this.updateUI();
    }

    /**
     * 更新UI显示
     */
    private updateUI(): void {
        if (!this.dialogElement) return;

        const title = this.dialogElement.querySelector('#authDialogTitle');
        const loginForm = this.dialogElement.querySelector('#loginForm');
        const registerForm = this.dialogElement.querySelector('#registerForm');
        const switchText = this.dialogElement.querySelector('#authSwitchText');
        const switchLink = this.dialogElement.querySelector('#authSwitchLink');

        if (this.currentMode === 'login') {
            if (title) title.textContent = '登录';
            if (loginForm) loginForm.classList.remove('hidden');
            if (registerForm) registerForm.classList.add('hidden');
            if (switchText) switchText.textContent = '还没有账号？';
            if (switchLink) switchLink.textContent = '立即注册';
        } else {
            if (title) title.textContent = '注册';
            if (loginForm) loginForm.classList.add('hidden');
            if (registerForm) registerForm.classList.remove('hidden');
            if (switchText) switchText.textContent = '已有账号？';
            if (switchLink) switchLink.textContent = '立即登录';
        }

        // 清除错误信息
        this.hideError();
    }

    /**
     * 显示错误信息
     */
    private showError(message: string): void {
        if (!this.dialogElement) return;
        const errorElement = this.dialogElement.querySelector('#authError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        }
    }

    /**
     * 隐藏错误信息
     */
    private hideError(): void {
        if (!this.dialogElement) return;
        const errorElement = this.dialogElement.querySelector('#authError');
        if (errorElement) {
            errorElement.classList.add('hidden');
        }
    }

    /**
     * 处理登录
     */
    private async handleLogin(): Promise<void> {
        if (!this.dialogElement) return;

        const usernameInput = this.dialogElement.querySelector('#loginUsername') as HTMLInputElement;
        const passwordInput = this.dialogElement.querySelector('#loginPassword') as HTMLInputElement;
        const rememberMeInput = this.dialogElement.querySelector('#rememberMe') as HTMLInputElement;

        if (!usernameInput || !passwordInput) return;

        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const rememberMe = rememberMeInput ? rememberMeInput.checked : false;

        if (!username || !password) {
            this.showError('请填写完整信息');
            return;
        }

        this.hideError();
        const submitButton = this.dialogElement.querySelector('#loginForm button[type="submit"]') as HTMLButtonElement;
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = '登录中...';
        }

        try {
            const response: AuthResponse = await authService.login(username, password, rememberMe);
            
            if (response.success && response.user_id) {
                this.close();
                if (this.callbacks.onSuccess) {
                    this.callbacks.onSuccess({
                        user_id: response.user_id,
                        username: response.username!,
                        email: response.email!,
                    });
                }
            } else {
                this.showError(response.error || '登录失败');
            }
        } catch (error) {
            console.error('登录错误:', error);
            this.showError('登录失败，请稍后重试');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = '登录';
            }
        }
    }

    /**
     * 处理注册
     */
    private async handleRegister(): Promise<void> {
        if (!this.dialogElement) return;

        const usernameInput = this.dialogElement.querySelector('#registerUsername') as HTMLInputElement;
        const emailInput = this.dialogElement.querySelector('#registerEmail') as HTMLInputElement;
        const passwordInput = this.dialogElement.querySelector('#registerPassword') as HTMLInputElement;
        const passwordConfirmInput = this.dialogElement.querySelector('#registerPasswordConfirm') as HTMLInputElement;

        if (!usernameInput || !emailInput || !passwordInput || !passwordConfirmInput) return;

        const username = usernameInput.value.trim();
        const email = emailInput.value.trim().toLowerCase();
        const password = passwordInput.value;
        const passwordConfirm = passwordConfirmInput.value;

        // 验证输入
        if (!username || !email || !password || !passwordConfirm) {
            this.showError('请填写完整信息');
            return;
        }

        if (password !== passwordConfirm) {
            this.showError('两次输入的密码不一致');
            return;
        }

        if (password.length < 6) {
            this.showError('密码长度至少为6个字符');
            return;
        }

        this.hideError();
        const submitButton = this.dialogElement.querySelector('#registerForm button[type="submit"]') as HTMLButtonElement;
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = '注册中...';
        }

        try {
            const response: AuthResponse = await authService.register(username, email, password);
            
            if (response.success && response.user_id) {
                this.close();
                if (this.callbacks.onSuccess) {
                    this.callbacks.onSuccess({
                        user_id: response.user_id,
                        username: response.username!,
                        email: response.email!,
                    });
                }
            } else {
                this.showError(response.error || '注册失败');
            }
        } catch (error) {
            console.error('注册错误:', error);
            this.showError('注册失败，请稍后重试');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = '注册';
            }
        }
    }

    /**
     * 打开对话框
     */
    public open(mode: AuthMode = 'login', callbacks: AuthDialogCallbacks = {}): void {
        this.currentMode = mode;
        this.callbacks = callbacks;
        this.updateUI();

        if (this.dialogElement) {
            this.dialogElement.classList.remove('hidden');
        }
        if (this.backdropElement) {
            this.backdropElement.classList.remove('hidden');
        }

        // 聚焦到第一个输入框
        setTimeout(() => {
            if (this.dialogElement) {
                const firstInput = this.dialogElement.querySelector('input') as HTMLInputElement;
                if (firstInput) {
                    firstInput.focus();
                }
            }
        }, 100);
    }

    /**
     * 关闭对话框
     */
    public close(): void {
        if (this.dialogElement) {
            this.dialogElement.classList.add('hidden');
            // 清除表单
            const forms = this.dialogElement.querySelectorAll('form');
            forms.forEach(form => form.reset());
        }
        if (this.backdropElement) {
            this.backdropElement.classList.add('hidden');
        }
        this.hideError();

        if (this.callbacks.onClose) {
            this.callbacks.onClose();
        }
    }
}

// 导出单例
export const authDialog = new AuthDialog();

