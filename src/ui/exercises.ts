export interface QuizAnswerMap {
    [questionIndex: number]: string;
}

export const quizAnswers: { [category: string]: QuizAnswerMap } = {
    overview_quiz: {
        1: "B",
        2: "C",
        3: "A"
    },
    overfitting_quiz: {
        1: "C",
        2: "B",
        3: "A"
    },
    mlp_quiz: {
        1: "A",
        2: "B",
        3: "D"
    },
    cnn_quiz: {
        1: "B",
        2: "A",
        3: "C"
    },
    modern_cnn_quiz: {
        1: "C",
        2: "B",
        3: "D"
    },
    rnn_quiz: {
        1: "A",
        2: "D",
        3: "B"
    },
    modern_rnn_quiz: {
        1: "B",
        2: "C",
        3: "A"
    },
    transformer_quiz: {
        1: "C",
        2: "A",
        3: "D"
    },
    activations_quiz: {
        1: "B",
        2: "A",
        3: "C"
    }
};

export function initializeExerciseSystem(): void {
    document.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (!target) return;

        // 开始练习：展开题目区域
        if (target.classList.contains("start-exercise-btn") || target.closest(".start-exercise-btn")) {
            const btn = target.classList.contains("start-exercise-btn")
                ? target
                : (target.closest(".start-exercise-btn") as HTMLElement);
            const card = btn.closest(".exercise-card") as HTMLElement;
            if (!card) return;
            const content = card.querySelector(".card-content") as HTMLElement;
            const questions = card.querySelector(".card-questions") as HTMLElement;
            if (content && questions) {
                content.style.display = "none";
                questions.style.display = "block";
                questions.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }

        // 收起练习：返回简介视图
        if (target.classList.contains("close-exercise-btn") || target.closest(".close-exercise-btn")) {
            const btn = target.classList.contains("close-exercise-btn")
                ? target
                : (target.closest(".close-exercise-btn") as HTMLElement);
            const card = btn.closest(".exercise-card") as HTMLElement;
            if (!card) return;
            const content = card.querySelector(".card-content") as HTMLElement;
            const questions = card.querySelector(".card-questions") as HTMLElement;
            if (content && questions) {
                questions.style.display = "none";
                content.style.display = "block";
            }
        }

        // 提交答案
        if (target.classList.contains("submit-quiz-btn") || target.closest(".submit-quiz-btn")) {
            const btn = target.classList.contains("submit-quiz-btn")
                ? target
                : (target.closest(".submit-quiz-btn") as HTMLElement);
            const category = btn.getAttribute("data-category");
            if (!category) return;
            submitQuizAnswers(category);
        }
    });
}

export function submitQuizAnswers(category: string): void {
    const card = document.querySelector(`.exercise-card[data-exercise="${category}"]`) as HTMLElement | null;
    if (!card) return;

    const questionsContainer = card.querySelector(".card-questions") as HTMLElement | null;
    if (!questionsContainer) return;

    const questions = questionsContainer.querySelectorAll(".question");
    if (!questions.length) return;

    const answers = quizAnswers[category] || {};
    let score = 0;

    questions.forEach((qEl, index) => {
        const questionIndex = index + 1;
        const selected = qEl.querySelector('input[type="radio"]:checked') as HTMLInputElement | null;

        const existingFeedback = qEl.querySelector(".answer-feedback");
        if (existingFeedback) existingFeedback.remove();

        const feedback = document.createElement("div");
        feedback.classList.add("answer-feedback");

        const correct = answers[questionIndex];
        if (selected) {
            if (selected.value === correct) {
                score++;
                feedback.classList.add("correct");
                feedback.textContent = `✓ 回答正确！正确答案：${correct}`;
            } else {
                feedback.classList.add("incorrect");
                feedback.textContent = `✗ 回答错误。正确答案：${correct}`;
            }
        } else {
            feedback.classList.add("incorrect");
            feedback.textContent = `⚠ 请先选择一个选项。正确答案：${correct}`;
        }

        qEl.appendChild(feedback);
    });

    updateCardScore(card, score, questions.length);
}

function updateCardScore(card: HTMLElement, score: number, total: number): void {
    const progressText = card.querySelector(".progress-text") as HTMLElement | null;
    const progressFill = card.querySelector(".progress-fill") as HTMLElement | null;
    const scoreDisplay = card.querySelector(".score-display") as HTMLElement | null;

    const percent = Math.round((score / total) * 100);

    if (progressText) {
        progressText.textContent = `${score}/${total} 已正确 (${percent}%)`;
    }
    if (progressFill) {
        progressFill.style.width = `${percent}%`;
    }
    if (scoreDisplay) {
        scoreDisplay.textContent = `本次得分：${score} / ${total}`;
    }

    if (percent === 100) {
        card.classList.add("completed");
    }
}


