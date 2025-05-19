document.addEventListener('DOMContentLoaded', function () {
    const questions = document.querySelectorAll('.question-container');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');
    const progressFill = document.getElementById('progress-fill');
    const steps = document.querySelectorAll('.step');

    let currentQuestion = 1;
    const totalQuestions = questions.length;

    // 添加调试信息
    console.log("总问题数:", totalQuestions);
    console.log("步骤元素数量:", steps.length);

    // 正确初始化为数组
    const userSelections = {
        travel_style: [],
        activities: [],
        transportation: [],
        accommodation: [],
        budget: [],
        duration: []
    };

    // Initialize the question view
    updateQuestionView();

    // 确保步骤指示器可点击
    steps.forEach((step, index) => {
        console.log(`初始化步骤 ${index + 1} 点击事件`);

        // 确保步骤有明确的点击样式
        step.style.cursor = 'pointer';

        // 添加明确的点击效果
        step.addEventListener('mousedown', function() {
            this.style.transform = 'scale(0.95)';
        });

        step.addEventListener('mouseup', function() {
            this.style.transform = 'scale(1)';
        });

        // 主要点击事件
        step.addEventListener('click', function(event) {
            console.log(`点击了步骤 ${index + 1}`);
            event.preventDefault(); // 防止默认行为

            const targetQuestion = index + 1;

            // 改为允许点击任何步骤
            currentQuestion = targetQuestion;
            updateQuestionView();

            return false; // 防止事件冒泡
        });
    });

    // Option selection
    document.querySelectorAll('.option-card').forEach(option => {
        option.addEventListener('click', function () {
            // 获取问题和选项信息
            const questionContainer = this.closest('.question-container');
            const questionId = questionContainer.id.split('-')[1];
            const category = getQuestionCategory(questionId);
            const value = this.dataset.value;

            // 检查选项是否已被选中
            if (this.classList.contains('selected')) {
                // 已选中，则取消选择
                this.classList.remove('selected');

                // 从选择列表中移除
                const index = userSelections[category].indexOf(value);
                if (index !== -1) {
                    userSelections[category].splice(index, 1);
                }
            } else {
                // 检查是否已达到最大选择数（3个）
                if (userSelections[category].length >= 3) {
                    alert('You can select a maximum of 3 options for each question.');
                    return;
                }

                // 未选中，添加选择
                this.classList.add('selected');

                // 添加到选择列表
                userSelections[category].push(value);
            }

            // 启用下一步按钮，只要有至少一个选择
            nextBtn.disabled = userSelections[category].length === 0;

            // 如果是最后一个问题，也更新提交按钮状态
            if (currentQuestion === totalQuestions) {
                submitBtn.disabled = userSelections[category].length === 0;
            }
        });
    });

    // Previous button click
    prevBtn.addEventListener('click', function () {
        if (currentQuestion > 1) {
            currentQuestion--;
            updateQuestionView();
        }
    });

    // Next button click
    nextBtn.addEventListener('click', function () {
        if (currentQuestion < totalQuestions) {
            // 检查用户是否至少选择了一个选项
            const category = getQuestionCategory(currentQuestion);
            if (userSelections[category].length === 0) {
                alert('Please select at least one option to continue');
                return;
            }

            currentQuestion++;
            updateQuestionView();
        }
    });

    // Submit button click
    submitBtn.addEventListener('click', function () {
        // 检查用户是否至少选择了一个选项
        const category = getQuestionCategory(currentQuestion);
        if (userSelections[category].length === 0) {
            alert('Please select at least one option to continue');
            return;
        }

        console.log("准备提交选择:", userSelections);

        // 发送数据到服务器
        fetch('/process-questionnaire', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userSelections),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.location.href = '/results';
            } else {
                alert('Error processing your preferences. Please try again.');
            }
        })
        .catch((error) => {
            console.error('Error:', error);
            alert('An error occurred. Please try again.');
        });
    });

    // 更新 updateQuestionView 函数
    function updateQuestionView() {
        console.log(`更新视图到问题 ${currentQuestion}`);

        // 隐藏所有问题
        questions.forEach(q => {
            q.classList.add('hidden');
        });

        // 显示当前问题
        const currentQuestionEl = document.getElementById(`question-${currentQuestion}`);
        if (currentQuestionEl) {
            currentQuestionEl.classList.remove('hidden');
        } else {
            console.error(`找不到问题元素: question-${currentQuestion}`);
        }

        // 更新进度条
        const progressPercentage = (currentQuestion / totalQuestions) * 100;
        progressFill.style.width = `${progressPercentage}%`;

        // 更新步骤
        steps.forEach((step, index) => {
            // 移除所有状态类
            step.classList.remove('active', 'completed');

            // 给已完成的问题添加 completed 类
            if (index + 1 < currentQuestion) {
                const category = getQuestionCategory(index + 1);
                if (userSelections[category] && userSelections[category].length > 0) {
                    step.classList.add('completed');
                }
            }
            // 当前问题添加 active 类
            else if (index + 1 === currentQuestion) {
                step.classList.add('active');
            }
        });

        // 设置当前问题的选中状态
        const currentCategory = getQuestionCategory(currentQuestion);
        if (currentQuestionEl) {
            const options = currentQuestionEl.querySelectorAll('.option-card');
            options.forEach(option => {
                const value = option.dataset.value;
                if (userSelections[currentCategory] && userSelections[currentCategory].includes(value)) {
                    option.classList.add('selected');
                } else {
                    option.classList.remove('selected');
                }
            });
        }

        // 更新按钮状态
        prevBtn.disabled = currentQuestion === 1;

        if (currentQuestion === totalQuestions) {
            nextBtn.classList.add('hidden');
            submitBtn.classList.remove('hidden');

            // 检查当前问题是否有选择
            submitBtn.disabled = userSelections[currentCategory] ? userSelections[currentCategory].length === 0 : true;
        } else {
            nextBtn.classList.remove('hidden');
            submitBtn.classList.add('hidden');

            // 检查当前问题是否有选择
            nextBtn.disabled = userSelections[currentCategory] ? userSelections[currentCategory].length === 0 : true;
        }
    }

    // Function to get the category based on question number
    function getQuestionCategory(questionNumber) {
        const categories = [
            'travel_style',
            'activities',
            'transportation',
            'accommodation',
            'budget',
            'duration'
        ];

        return categories[parseInt(questionNumber) - 1];
    }
});