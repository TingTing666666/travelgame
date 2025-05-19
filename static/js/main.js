document.addEventListener('DOMContentLoaded', function () {
    console.log("Document loaded, initializing application...");

    try {
        // 从隐藏的数据元素获取资源数据
        const resourceElement = document.getElementById('resource-data');
        if (!resourceElement) {
            throw new Error('Resource data element not found');
        }

        const resourcesJson = resourceElement.getAttribute('data-resources');
        if (!resourcesJson) {
            throw new Error('data-resources attribute is empty');
        }

        console.log("Resource JSON:", resourcesJson);

        const resources = JSON.parse(resourcesJson);
        console.log("Parsed resources:", resources);

        // 初始化头像创建器
        const avatarCreator = new AvatarCreator(resources);
        avatarCreator.initialize();

        // 标签切换逻辑
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            button.addEventListener('click', function () {
                // 移除所有active类
                tabButtons.forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.options-panel').forEach(
                    panel => panel.classList.remove('active')
                );

                // 添加active类到当前点击的按钮
                this.classList.add('active');
                const tabId = this.getAttribute('data-tab');
                document.getElementById(`${tabId}-options`).classList.add('active');
            });
        });

        // 随机生成按钮
        document.getElementById('random-btn').addEventListener('click', function () {
            avatarCreator.randomize();
        });

        // 下载按钮
        document.getElementById('download-btn').addEventListener('click', function () {
            avatarCreator.downloadAvatar();
        });

        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) {
            continueBtn.addEventListener('click', function () {
                const nameInput = document.getElementById('avatar-name');
                if (!nameInput.value.trim()) {
                    alert('Please enter your name to continue');
                    nameInput.focus();
                    return;
                }

                // 禁用按钮防止重复点击
                continueBtn.disabled = true;
                continueBtn.textContent = 'Processing...';

                // 发送数据到服务器
                fetch('/save-avatar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: nameInput.value,
                        selections: avatarCreator.currentSelection  // 发送选择项而非SVG
                    }),
                    credentials: 'same-origin'
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            window.location.href = '/questionnaire';
                        } else {
                            throw new Error(data.error || 'Unknown error');
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('An error occurred: ' + error.message);
                        continueBtn.disabled = false;
                        continueBtn.textContent = 'Continue';
                    });
            });
        }

    } catch (error) {
        console.error("Error initializing application:", error);
        alert("Application initialization failed. Please check the console for details.");
    }
});