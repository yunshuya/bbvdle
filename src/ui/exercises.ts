export interface QuizAnswerMap {
    [questionIndex: number]: string;
}

export const quizAnswers: { [category: string]: QuizAnswerMap } = {
    // 模块一：基础组件（神经网络层与激活函数）
    neural_layers_quiz: {
        1: "B", 2: "C", 3: "C", 4: "B", 5: "C",
        6: "C", 7: "B", 8: "A", 9: "B", 10: "C",
        11: "B", 12: "B", 13: "C", 14: "A", 15: "C",
        16: "C", 17: "B", 18: "C", 19: "B", 20: "A",
        21: "B", 22: "B", 23: "B", 24: "B", 25: "B",
        26: "B", 27: "B", 28: "B", 29: "B", 30: "B"
    },
    activations_quiz: {
        1: "B", 2: "B", 3: "A", 4: "C", 5: "C",
        6: "D", 7: "C", 8: "B", 9: "C", 10: "C",
        11: "C", 12: "D", 13: "B", 14: "C", 15: "D",
        16: "B", 17: "A", 18: "B", 19: "C", 20: "C"
    },
    
    // 模块二：核心架构
    perceptron_quiz: {
        1: "D", 2: "D", 3: "B", 4: "B", 5: "B",
        6: "C", 7: "A", 8: "A", 9: "B", 10: "D"
    },
    cnn_quiz: {
        1: "A", 2: "B", 3: "C", 4: "D", 5: "B",
        6: "B", 7: "A", 8: "B", 9: "B", 10: "B",
        11: "B", 12: "B", 13: "C", 14: "B", 15: "B"
    },
    rnn_quiz: {
        1: "B", 2: "B", 3: "B", 4: "B", 5: "B",
        6: "B", 7: "B", 8: "B", 9: "B", 10: "B",
        11: "C", 12: "A", 13: "A", 14: "B", 15: "B"
    },
    transformer_quiz: {
        1: "C", 2: "A", 3: "A", 4: "B", 5: "B",
        6: "A", 7: "D", 8: "A", 9: "B", 10: "B"
    },
    
    // 模块三：综合应用与高阶概念
    arch_selection_quiz: {
        1: "C", 2: "C", 3: "C", 4: "C", 5: "B",
        6: "B", 7: "B", 8: "A", 9: "C", 10: "D",
        11: "C", 12: "B", 13: "A", 14: "B", 15: "B",
        16: "B", 17: "C", 18: "B", 19: "A", 20: "B"
    },
    problem_diagnosis_quiz: {
        1: "B", 2: "B", 3: "D", 4: "B", 5: "C",
        6: "B", 7: "C", 8: "D", 9: "B", 10: "D",
        11: "A", 12: "A", 13: "B", 14: "B", 15: "D"
    },
    advanced_quiz: {
        1: "B", 2: "B", 3: "A", 4: "C", 5: "B",
        6: "B", 7: "B", 8: "A", 9: "B", 10: "B",
        11: "A", 12: "C", 13: "C", 14: "B", 15: "B",
        16: "C", 17: "D", 18: "A", 19: "A", 20: "B"
    }
};

// 保存题目状态
function saveQuestionStatus(status: Record<number, 'correct' | 'incorrect' | 'unanswered'>): void {
    localStorage.setItem('question_status', JSON.stringify(status));
}

// 获取题目状态
function getQuestionStatus(): Record<number, 'correct' | 'incorrect' | 'unanswered'> {
    const statusStr = localStorage.getItem('question_status');
    return statusStr ? JSON.parse(statusStr) : {};
}

// 根据题目分类和模块内编号计算全局题目编号
function getGlobalQuestionIndex(category: string, questionIndex: number): number {
    // 根据category确定起始题目编号
    switch(category) {
        case 'neural_layers_quiz':
            return questionIndex; // 1-30
        case 'activations_quiz':
            return 30 + questionIndex; // 31-50
        case 'perceptron_quiz':
            return 50 + questionIndex; // 51-60
        case 'cnn_quiz':
            return 60 + questionIndex; // 61-80
        case 'rnn_quiz':
            return 80 + questionIndex; // 81-100
        case 'transformer_quiz':
            return 100 + questionIndex; // 101-110
        case 'arch_selection_quiz':
            return 110 + questionIndex; // 111-130
        case 'problem_diagnosis_quiz':
            return 130 + questionIndex; // 131-150
        case 'advanced_quiz':
            return 150 + questionIndex; // 151-170
        default:
            return questionIndex;
    }
}

// 更新特定题目的状态
export function updateQuestionStatus(questionIndex: number, isCorrect: boolean): void {
    const status = getQuestionStatus();
    
    status[questionIndex] = isCorrect ? 'correct' : 'incorrect';
    saveQuestionStatus(status);
    updateStatusDisplay();
}

// 初始化状态显示
export function initializeStatusDisplay(): void {
    updateStatusDisplay();
}

// 更新状态显示
function updateStatusDisplay(): void {
    const status = getQuestionStatus();
    const statusItems = document.querySelectorAll(".status-item");
    
    statusItems.forEach(item => {
        const question = item.getAttribute("data-question");
        
        if (question) {
            const questionIndex = parseInt(question, 10);
            
            // 移除所有状态类
            item.classList.remove("correct", "incorrect", "unanswered");
            
            // 获取当前题目的状态
            const questionStatus = status[questionIndex];
            
            // 添加对应的状态类
            if (questionStatus) {
                item.classList.add(questionStatus);
            } else {
                item.classList.add("unanswered");
            }
        }
    });
}

export function initializeExerciseSystem(): void {
    // 初始化状态显示
    initializeStatusDisplay();
    
    // 为开始练习按钮添加事件监听器
    const startButtons = document.querySelectorAll(".start-exercise-btn");
    console.log("找到的开始练习按钮数量:", startButtons.length);
    startButtons.forEach((button, index) => {
        console.log(`为按钮 ${index} 添加事件监听器`);
        button.addEventListener("click", function(event) {
            event.stopPropagation();
            console.log("按钮被点击了");
            const card = this.closest(".exercise-card") as HTMLElement;
            console.log("找到的练习卡片:", card);
            if (card) {
                const content = card.querySelector(".card-content") as HTMLElement;
                const questions = card.querySelector(".card-questions") as HTMLElement;
                console.log("找到的card-content:", content);
                console.log("找到的card-questions:", questions);
                if (content && questions) {
                    content.style.display = "none";
                    questions.style.display = "block";
                    // 延迟滚动，确保DOM已更新
                    setTimeout(() => {
                        const centerContent = document.querySelector(".exercise-center-content") as HTMLElement;
                        if (centerContent) {
                            // 在中间内容区域内滚动到第一个题目
                            const firstQuestion = questions.querySelector(".question-item, .quiz-question, .exercise-card") as HTMLElement;
                            if (firstQuestion) {
                                const rect = firstQuestion.getBoundingClientRect();
                                const centerRect = centerContent.getBoundingClientRect();
                                const scrollTop = centerContent.scrollTop + rect.top - centerRect.top - 20;
                                centerContent.scrollTo({
                                    top: Math.max(0, scrollTop),
                                    behavior: "smooth"
                                });
                            } else {
                                questions.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                        } else {
                            questions.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                    }, 100);

                    console.log("已切换到题目视图");
                } else {
                    console.log("未找到card-content或card-questions元素");
                }
            } else {
                console.log("未找到练习卡片");
            }
        });
    });
    
    // 为收起练习按钮添加事件监听器
    const closeButtons = document.querySelectorAll(".close-exercise-btn");
    closeButtons.forEach(button => {
        button.addEventListener("click", function(event) {
            event.stopPropagation();
            const card = this.closest(".exercise-card") as HTMLElement;
            if (card) {
                const content = card.querySelector(".card-content") as HTMLElement;
                const questions = card.querySelector(".card-questions") as HTMLElement;
                if (content && questions) {
                    content.style.display = "block";
                    questions.style.display = "none";
                }
            }
        });
    });
    
    // 为提交答案按钮添加事件监听器
    const submitButtons = document.querySelectorAll(".submit-quiz-btn");
    console.log("找到的提交答案按钮数量:", submitButtons.length);
    submitButtons.forEach((button, index) => {
        console.log(`为提交按钮 ${index} 添加事件监听器`);
        button.addEventListener("click", function(event) {
            console.log("提交按钮被点击了");
            event.stopPropagation();
            const category = this.getAttribute("data-category");
            console.log("按钮的data-category属性值:", category);
            if (category) {
                console.log(`调用submitQuizAnswers函数，category: ${category}`);
                submitQuizAnswers(category);
            } else {
                console.log("未找到data-category属性");
            }
        });
    });
}

// 答题历史记录接口
export interface QuizHistory {
    [category: string]: {
        attempts: number;
        correctAttempts: number;
        lastScore: number;
        bestScore: number;
        lastAttemptDate: string;
    };
}

// 题目状态接口
export interface QuestionStatus {
    [questionIndex: number]: 'unanswered' | 'correct' | 'incorrect';
}

// 获取答题历史记录
function getQuizHistory(): QuizHistory {
    const historyStr = localStorage.getItem('quiz_history');
    return historyStr ? JSON.parse(historyStr) : {};
}

// 保存答题历史记录
function saveQuizHistory(history: QuizHistory): void {
    localStorage.setItem('quiz_history', JSON.stringify(history));
}

// 更新答题历史
function updateQuizHistory(category: string, score: number, total: number): void {
    const history = getQuizHistory();
    const categoryHistory = history[category] || {
        attempts: 0,
        correctAttempts: 0,
        lastScore: 0,
        bestScore: 0,
        lastAttemptDate: ''
    };
    
    categoryHistory.attempts++;
    categoryHistory.lastScore = score;
    categoryHistory.bestScore = Math.max(categoryHistory.bestScore, score);
    categoryHistory.lastAttemptDate = new Date().toLocaleDateString();
    
    if (score === total) {
        categoryHistory.correctAttempts++;
    }
    
    history[category] = categoryHistory;
    saveQuizHistory(history);
}

export function submitQuizAnswers(category: string): void {
    // 首先尝试在当前活动标签页中查找
    const activeTab = document.querySelector('.tab-content[style*="display: block"]');
    let card: HTMLElement | null = null;
    
    if (activeTab) {
        card = activeTab.querySelector(`.exercise-card[data-exercise="${category}"]`) as HTMLElement | null;
    }
    
    // 如果在活动标签中找不到，尝试全局查找
    if (!card) {
        card = document.querySelector(`.exercise-card[data-exercise="${category}"]`) as HTMLElement | null;
    }
    
    if (!card) {
        console.error(`未找到分类为${category}的练习卡片`);
        return;
    }

    const questionsContainer = card.querySelector(".card-questions") as HTMLElement | null;
    if (!questionsContainer) {
        console.error(`练习卡片中未找到题目容器`);
        return;
    }

    const questions = questionsContainer.querySelectorAll(".question");
    if (!questions.length) {
        console.error(`练习卡片中未找到题目`);
        return;
    }

    const answers = quizAnswers[category] || {};
    let score = 0;

    questions.forEach((qEl, index) => {
        // 使用索引+1作为每个模块内的局部编号
        const questionIndex = index + 1;
        
        // 使用更直接的方式查找选中的选项
        let selected: HTMLInputElement | null = null;
        const allInputs = qEl.querySelectorAll('input[type="radio"]');
        
        // 遍历所有radio input，找到被选中的那个
        for (const input of allInputs) {
            if ((input as HTMLInputElement).checked) {
                selected = input as HTMLInputElement;
                break;
            }
        }

        const existingFeedback = qEl.querySelector(".answer-feedback");
        if (existingFeedback) existingFeedback.remove();

        const feedback = document.createElement("div");
        feedback.classList.add("answer-feedback");

        const correct = answers[questionIndex] || "";
        
        let isCorrect = false;
        
        if (selected) {
            if (selected.value === correct) {
                score++;
                isCorrect = true;
                feedback.classList.add("correct");
                feedback.textContent = `✓ 回答正确！正确答案：${correct}`;
            } else {
                isCorrect = false;
                feedback.classList.add("incorrect");
                feedback.textContent = `✗ 回答错误。正确答案：${correct}`;
            }
        } else {
            isCorrect = false;
            feedback.classList.add("incorrect");
            feedback.textContent = `⚠ 请先选择一个选项。`;
        }
        
        // 更新右侧做题状态
        // 根据题目索引计算全局题目编号
        const globalQuestionIndex = getGlobalQuestionIndex(category, questionIndex);
        updateQuestionStatus(globalQuestionIndex, isCorrect);

        qEl.appendChild(feedback);
    });

    // 更新答题历史
    updateQuizHistory(category, score, questions.length);
    
    // 更新显示
    updateCardScore(card, score, questions.length);
    
    // 显示详细统计信息
    displayDetailedStats(card, category);
}

function updateCardScore(card: HTMLElement, score: number, total: number): void {
    const progressText = card.querySelector(".progress-text") as HTMLElement | null;
    const progressFill = card.querySelector(".progress-fill") as HTMLElement | null;
    const scoreDisplay = card.querySelector(".score-display") as HTMLElement | null;

    const percent = Math.round((score / total) * 100);

    // 更新进度条和文本
    if (progressText) {
        progressText.textContent = `${score}/${total} 已正确 (${percent}%)`;
    }
    if (progressFill) {
        // 根据得分设置不同的颜色
        if (percent >= 80) {
            progressFill.style.backgroundColor = '#4CAF50'; // 绿色
        } else if (percent >= 60) {
            progressFill.style.backgroundColor = '#FFC107'; // 黄色
        } else {
            progressFill.style.backgroundColor = '#F44336'; // 红色
        }
        progressFill.style.width = `${percent}%`;
    }
    if (scoreDisplay) {
        scoreDisplay.textContent = `本次得分：${score} / ${total} (${percent}%)`;
        // 添加额外的样式
        scoreDisplay.style.fontWeight = 'bold';
        scoreDisplay.style.marginBottom = '15px';
        scoreDisplay.style.padding = '10px';
        scoreDisplay.style.borderRadius = '5px';
        scoreDisplay.style.backgroundColor = percent >= 80 ? '#E8F5E9' : percent >= 60 ? '#FFF8E1' : '#FFEBEE';
    }

    if (percent === 100) {
        card.classList.add("completed");
        // 显示完成徽章
        let badge = card.querySelector(".completion-badge") as HTMLElement;
        if (!badge) {
            badge = document.createElement("div");
            badge.classList.add("completion-badge");
            badge.textContent = "✓ 已完成";
            badge.style.position = 'absolute';
            badge.style.top = '10px';
            badge.style.right = '10px';
            badge.style.backgroundColor = '#4CAF50';
            badge.style.color = 'white';
            badge.style.padding = '5px 10px';
            badge.style.borderRadius = '15px';
            badge.style.fontSize = '12px';
            badge.style.fontWeight = 'bold';
            const header = card.querySelector(".card-header") as HTMLElement;
            if (header) {
                header.style.position = 'relative';
                header.appendChild(badge);
            }
        }
    }
}

// 显示详细的统计信息
function displayDetailedStats(card: HTMLElement, category: string): void {
    const history = getQuizHistory();
    const categoryHistory = history[category];
    
    if (!categoryHistory) return;
    
    // 获取或创建统计信息容器
    let statsContainer = card.querySelector(".quiz-stats") as HTMLElement;
    if (!statsContainer) {
        statsContainer = document.createElement("div");
        statsContainer.classList.add("quiz-stats");
        statsContainer.style.marginTop = '15px';
        statsContainer.style.padding = '10px';
        statsContainer.style.backgroundColor = '#F5F5F5';
        statsContainer.style.borderRadius = '5px';
        
        const scoreDisplay = card.querySelector(".score-display") as HTMLElement;
        if (scoreDisplay) {
            scoreDisplay.after(statsContainer);
        } else {
            const questions = card.querySelector(".card-questions") as HTMLElement;
            if (questions) {
                questions.appendChild(statsContainer);
            }
        }
    }
    
    // 计算总体正确率
    const overallAccuracy = categoryHistory.attempts > 0 
        ? Math.round((categoryHistory.correctAttempts / categoryHistory.attempts) * 100) 
        : 0;
    
    // 更新统计信息内容
    statsContainer.innerHTML = `
        <h5 style="margin-top: 0; color: #333;">练习统计</h5>
        <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <div style="flex: 1; min-width: 120px; padding: 8px; background: white; border-radius: 5px;">
                <div style="font-size: 12px; color: #666;">尝试次数</div>
                <div style="font-size: 18px; font-weight: bold;">${categoryHistory.attempts}</div>
            </div>
            <div style="flex: 1; min-width: 120px; padding: 8px; background: white; border-radius: 5px;">
                <div style="font-size: 12px; color: #666;">最佳成绩</div>
                <div style="font-size: 18px; font-weight: bold;">${categoryHistory.bestScore}/3</div>
            </div>
            <div style="flex: 1; min-width: 120px; padding: 8px; background: white; border-radius: 5px;">
                <div style="font-size: 12px; color: #666;">总体正确率</div>
                <div style="font-size: 18px; font-weight: bold; color: ${overallAccuracy >= 80 ? '#4CAF50' : overallAccuracy >= 60 ? '#FFC107' : '#F44336'};">
                    ${overallAccuracy}%
                </div>
            </div>
        </div>
        <div style="margin-top: 8px; font-size: 12px; color: #666;">
            最后尝试: ${categoryHistory.lastAttemptDate}
        </div>
    `;
}