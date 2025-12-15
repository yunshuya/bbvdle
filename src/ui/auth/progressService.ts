/**
 * 学习进度同步服务
 * 阶段二：处理学习进度的保存和获取
 */

import { authService } from './authService';

const API_BASE_URL = 'http://localhost:5000/api';

export interface ProgressStep {
    step_index: number;
    step_name: string;
    completed: boolean;
    completed_at?: string;
}

export interface UserProgress {
    id?: number;
    user_id: number;
    task_type: string;
    step_index: number;
    step_name: string;
    completed: boolean;
    completed_at?: string;
    created_at?: string;
    updated_at?: string;
}

export interface TaskCompletion {
    id?: number;
    user_id: number;
    task_type: string;
    completed: boolean;
    completion_rate: number;
    started_at?: string;
    completed_at?: string;
    created_at?: string;
    updated_at?: string;
}

class ProgressService {
    /**
     * 保存学习进度
     */
    public async saveProgress(
        taskType: string,
        stepIndex: number,
        stepName: string,
        completed: boolean
    ): Promise<boolean> {
        try {
            if (!authService.isAuthenticated()) {
                console.warn('用户未登录，进度将保存到本地');
                this.saveProgressToLocal(taskType, stepIndex, stepName, completed);
                return false;
            }

            const headers = authService.getAuthHeaders();
            const response = await fetch(`${API_BASE_URL}/progress/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
                body: JSON.stringify({
                    task_type: taskType,
                    step_index: stepIndex,
                    step_name: stepName,
                    completed: completed,
                }),
            });

            if (!response.ok) {
                // 如果是401错误，说明token无效，保存到本地即可
                if (response.status === 401) {
                    console.warn('保存进度失败：未授权，保存到本地');
                    this.saveProgressToLocal(taskType, stepIndex, stepName, completed);
                    return false;
                }
                const errorData = await response.json().catch(() => ({ error: '服务器错误' }));
                console.error('保存进度失败:', errorData);
                // 如果保存失败，保存到本地
                this.saveProgressToLocal(taskType, stepIndex, stepName, completed);
                return false;
            }

            const data = await response.json();
            if (data.success) {
                console.log('进度已保存到服务器');
                // 保存成功后，清除本地缓存
                this.clearLocalProgress(taskType, stepIndex);
                return true;
            }

            return false;
        } catch (error) {
            console.error('保存进度网络错误:', error);
            // 网络错误时保存到本地
            this.saveProgressToLocal(taskType, stepIndex, stepName, completed);
            return false;
        }
    }

    /**
     * 获取学习进度
     */
    public async getProgress(taskType?: string): Promise<UserProgress[]> {
        // 完全静默地获取进度，不触发任何认证检查
        // 如果主应用已显示，只使用本地进度，不尝试从服务器获取
        const mainDiv = document.getElementById('main');
        const isMainAppVisible = mainDiv && !mainDiv.classList.contains('hidden');
        
        // 如果主应用已显示，只使用本地进度，避免触发任何认证检查
        if (isMainAppVisible) {
            return this.getProgressFromLocal(taskType);
        }
        
        try {
            // 先检查是否已登录，如果未登录直接返回本地进度
            if (!authService.isAuthenticated()) {
                return this.getProgressFromLocal(taskType);
            }

            // 尝试从服务器获取进度，但不阻塞或影响UI
            const headers = authService.getAuthHeaders();
            const url = taskType
                ? `${API_BASE_URL}/progress/get?task_type=${encodeURIComponent(taskType)}`
                : `${API_BASE_URL}/progress/get`;

            // 使用AbortController设置超时，避免长时间等待
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2秒超时（缩短超时时间）

            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers,
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    // 任何错误都返回本地进度，不触发任何认证检查
                    return this.getProgressFromLocal(taskType);
                }

                const data = await response.json();
                if (data.success) {
                    return data.progress || [];
                }

                return [];
            } catch (fetchError) {
                clearTimeout(timeoutId);
                // 任何错误都返回本地进度
                return this.getProgressFromLocal(taskType);
            }
        } catch (error) {
            // 任何错误都返回本地进度，不抛出异常，避免影响UI
            return this.getProgressFromLocal(taskType);
        }
    }

    /**
     * 更新任务完成状态
     */
    public async updateTaskCompletion(
        taskType: string,
        completionRate: number,
        completed: boolean = false
    ): Promise<boolean> {
        try {
            if (!authService.isAuthenticated()) {
                console.warn('用户未登录，任务完成状态将保存到本地');
                this.saveTaskCompletionToLocal(taskType, completionRate, completed);
                return false;
            }

            const headers = authService.getAuthHeaders();
            const response = await fetch(`${API_BASE_URL}/progress/task-completion`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
                body: JSON.stringify({
                    task_type: taskType,
                    completion_rate: completionRate,
                    completed: completed,
                }),
            });

            if (!response.ok) {
                // 如果是401错误，说明token无效，保存到本地即可
                if (response.status === 401) {
                    console.warn('更新任务完成状态失败：未授权，保存到本地');
                    this.saveTaskCompletionToLocal(taskType, completionRate, completed);
                    return false;
                }
                console.error('更新任务完成状态失败');
                this.saveTaskCompletionToLocal(taskType, completionRate, completed);
                return false;
            }

            const data = await response.json();
            return data.success || false;
        } catch (error) {
            console.error('更新任务完成状态网络错误:', error);
            this.saveTaskCompletionToLocal(taskType, completionRate, completed);
            return false;
        }
    }

    /**
     * 获取所有任务的完成情况
     */
    public async getAllTasks(): Promise<TaskCompletion[]> {
        try {
            if (!authService.isAuthenticated()) {
                return this.getTaskCompletionFromLocal();
            }

            const headers = authService.getAuthHeaders();
            const response = await fetch(`${API_BASE_URL}/progress/tasks`, {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                return this.getTaskCompletionFromLocal();
            }

            const data = await response.json();
            if (data.success) {
                return data.tasks || [];
            }

            return [];
        } catch (error) {
            console.error('获取任务列表网络错误:', error);
            return this.getTaskCompletionFromLocal();
        }
    }

    /**
     * 同步本地进度到服务器（登录后调用）
     */
    public async syncLocalProgress(): Promise<void> {
        try {
            if (!authService.isAuthenticated()) {
                return;
            }

            const localProgress = this.getProgressFromLocal();
            const localTasks = this.getTaskCompletionFromLocal();

            // 同步步骤进度
            for (const progress of localProgress) {
                await this.saveProgress(
                    progress.task_type,
                    progress.step_index,
                    progress.step_name,
                    progress.completed
                );
            }

            // 同步任务完成状态
            for (const task of localTasks) {
                await this.updateTaskCompletion(
                    task.task_type,
                    task.completion_rate,
                    task.completed
                );
            }

            // 同步成功后清除本地缓存
            localStorage.removeItem('bbvdle_local_progress');
            localStorage.removeItem('bbvdle_local_tasks');
            console.log('本地进度已同步到服务器');
        } catch (error) {
            console.error('同步本地进度错误:', error);
        }
    }

    // ========== 本地存储辅助方法 ==========

    private saveProgressToLocal(
        taskType: string,
        stepIndex: number,
        stepName: string,
        completed: boolean
    ): void {
        const key = 'bbvdle_local_progress';
        const localProgress = this.getProgressFromLocal();
        
        // 查找是否已存在
        const index = localProgress.findIndex(
            p => p.task_type === taskType && p.step_index === stepIndex
        );

        const progressItem: UserProgress = {
            user_id: 0, // 本地存储时user_id为0
            task_type: taskType,
            step_index: stepIndex,
            step_name: stepName,
            completed: completed,
            completed_at: completed ? new Date().toISOString() : undefined,
        };

        if (index >= 0) {
            localProgress[index] = progressItem;
        } else {
            localProgress.push(progressItem);
        }

        localStorage.setItem(key, JSON.stringify(localProgress));
    }

    private getProgressFromLocal(taskType?: string): UserProgress[] {
        const key = 'bbvdle_local_progress';
        const data = localStorage.getItem(key);
        if (!data) return [];

        try {
            const progress: UserProgress[] = JSON.parse(data);
            if (taskType) {
                return progress.filter(p => p.task_type === taskType);
            }
            return progress;
        } catch (error) {
            console.error('解析本地进度错误:', error);
            return [];
        }
    }

    private clearLocalProgress(taskType: string, stepIndex: number): void {
        const key = 'bbvdle_local_progress';
        const localProgress = this.getProgressFromLocal();
        const filtered = localProgress.filter(
            p => !(p.task_type === taskType && p.step_index === stepIndex)
        );
        localStorage.setItem(key, JSON.stringify(filtered));
    }

    private saveTaskCompletionToLocal(
        taskType: string,
        completionRate: number,
        completed: boolean
    ): void {
        const key = 'bbvdle_local_tasks';
        const localTasks = this.getTaskCompletionFromLocal();
        
        const index = localTasks.findIndex(t => t.task_type === taskType);
        const taskItem: TaskCompletion = {
            user_id: 0,
            task_type: taskType,
            completed: completed,
            completion_rate: completionRate,
            completed_at: completed ? new Date().toISOString() : undefined,
        };

        if (index >= 0) {
            localTasks[index] = taskItem;
        } else {
            localTasks.push(taskItem);
        }

        localStorage.setItem(key, JSON.stringify(localTasks));
    }

    private getTaskCompletionFromLocal(): TaskCompletion[] {
        const key = 'bbvdle_local_tasks';
        const data = localStorage.getItem(key);
        if (!data) return [];

        try {
            return JSON.parse(data) as TaskCompletion[];
        } catch (error) {
            console.error('解析本地任务完成状态错误:', error);
            return [];
        }
    }
}

// 导出单例
export const progressService = new ProgressService();

