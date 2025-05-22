document.addEventListener('DOMContentLoaded', function() {
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const sendPreferencesBtn = document.getElementById('send-preferences');
    const showPreferencesBtn = document.getElementById('show-preferences');
    const preferencesPanel = document.getElementById('preferences-panel');
    const closePreferencesBtn = document.getElementById('close-preferences');

    // 添加全局状态变量
    let isGenerating = false;
    let currentTypewriterTimeout = null;
    let shouldStopGenerating = false;

    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';

        // Enable/disable send button (only if not generating)
        if (!isGenerating) {
            sendButton.disabled = !this.value.trim();
        }
    });

    // Send message on Enter (but not Shift+Enter)
    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (isGenerating) {
                stopGeneration();
            } else {
                sendMessage();
            }
        }
    });

    // Send button click - 支持发送和停止
    sendButton.addEventListener('click', function() {
        if (isGenerating) {
            stopGeneration();
        } else {
            sendMessage();
        }
    });

    // Send preferences button
    sendPreferencesBtn.addEventListener('click', function() {
        if (isGenerating) return; // 防止在生成时触发

        const preferencesMessage = "I'm doing a travel guide for China. Please provide personalized travel recommendations based on my preferences. I'd like suggestions for destinations, activities, and travel tips that match my style.";
        sendMessage(preferencesMessage, true);
    });

    // Show preferences panel
    showPreferencesBtn.addEventListener('click', function() {
        preferencesPanel.classList.add('open');
    });

    // Close preferences panel
    closePreferencesBtn.addEventListener('click', function() {
        preferencesPanel.classList.remove('open');
    });

    // Close preferences panel when clicking outside
    document.addEventListener('click', function(e) {
        if (preferencesPanel.classList.contains('open') &&
            !preferencesPanel.contains(e.target) &&
            !showPreferencesBtn.contains(e.target)) {
            preferencesPanel.classList.remove('open');
        }
    });

function updateSendButton(generating = false) {
    const sendIcon = sendButton.querySelector('svg');

    if (generating) {
        // 切换到停止图标
        sendIcon.innerHTML = `
            <image href="/static/images/travel-icons/stop.svg" width="20" height="20"/>
        `;
        sendButton.title = 'Stop generating';
        sendButton.disabled = false;
    } else {
        // 切换到发送图标
        sendIcon.innerHTML = `
            <image href="/static/images/travel-icons/start.svg" width="20" height="20"/>
            `;
        sendButton.title = 'Send message';
        sendButton.disabled = !messageInput.value.trim();
    }
}

    function stopGeneration() {
        shouldStopGenerating = true;
        isGenerating = false;

        // 清除当前的打字效果
        if (currentTypewriterTimeout) {
            clearTimeout(currentTypewriterTimeout);
            currentTypewriterTimeout = null;
        }

        // 隐藏思考指示器
        hideThinkingIndicator();

        // 重置按钮状态
        updateSendButton(false);

        // 添加停止消息
        addMessage('Response generation stopped.', 'ai');

        console.log('Generation stopped by user');
    }

    function sendMessage(customMessage = null, includePreferences = false) {
        const message = customMessage || messageInput.value.trim();
        if (!message || isGenerating) return;

        // 设置生成状态
        isGenerating = true;
        shouldStopGenerating = false;
        updateSendButton(true);

        // Add user message to chat
        addMessage(message, 'user');

        // Clear input
        if (!customMessage) {
            messageInput.value = '';
            messageInput.style.height = 'auto';
        }

        // Show thinking indicator
        showThinkingIndicator();

        // Send to AI
        fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                include_preferences: includePreferences
            })
        })
        .then(response => response.json())
        .then(data => {
            hideThinkingIndicator();

            // 检查是否被用户停止
            if (shouldStopGenerating) {
                return;
            }

            if (data.success) {
                // Use typewriter effect for AI response
                addMessageWithTypewriter(data.message, 'ai');
            } else {
                isGenerating = false;
                updateSendButton(false);
                addMessage('Sorry, I encountered an error. Please try again.', 'ai');
                console.error('AI Error:', data.error);
            }
        })
        .catch(error => {
            hideThinkingIndicator();
            isGenerating = false;
            updateSendButton(false);
            addMessage('Sorry, I\'m having trouble connecting. Please check your internet connection and try again.', 'ai');
            console.error('Network Error:', error);
        });
    }

    function addMessage(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;

        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-text">${formatMessage(content)}</div>
            </div>
            <div class="message-time">${timeString}</div>
        `;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addMessageWithTypewriter(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;

        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-text"></div>
            </div>
            <div class="message-time">${timeString}</div>
        `;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        const messageTextDiv = messageDiv.querySelector('.message-text');

        // 直接使用原始文本进行打字效果，不转换为纯文本
        typewriterEffectWithMarkdown(messageTextDiv, content, 10);
    }

    function typewriterEffectWithMarkdown(element, text, delay) {
        let index = 0;
        element.innerHTML = '';

        function type() {
            // 检查是否应该停止
            if (shouldStopGenerating) {
                isGenerating = false;
                updateSendButton(false);
                return;
            }

            if (index < text.length) {
                // 逐字添加原始文本
                const currentText = text.substring(0, index + 1);
                // 实时解析markdown并显示
                element.innerHTML = formatMessage(currentText);
                index++;
                chatMessages.scrollTop = chatMessages.scrollHeight;

                // 保存timeout引用以便取消
                currentTypewriterTimeout = setTimeout(type, delay);
            } else {
                // 打字完成
                isGenerating = false;
                updateSendButton(false);
                currentTypewriterTimeout = null;
            }
        }

        type();
    }

    function formatMessage(text) {
        // 改进的markdown解析，保持格式的同时确保正确显示
        let formatted = text
            // 首先处理换行
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')

            // 处理标题 - 必须在行首
            .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
            .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
            .replace(/^# (.*?)$/gm, '<h1>$1</h1>')

            // 处理粗体和斜体
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>')

            // 处理无序列表
            .replace(/^[\s]*[-*+]\s(.+)$/gm, '<li>$1</li>')

            // 处理有序列表
            .replace(/^[\s]*\d+\.\s(.+)$/gm, '<li>$1</li>')

            // 处理代码块
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/`([^`\n]+?)`/g, '<code>$1</code>')

            // 处理段落分隔 - 两个换行符表示段落分隔
            .replace(/\n\s*\n/g, '</p><p>')

            // 处理单个换行 - 转为br标签
            .replace(/\n/g, '<br>');

        // 包装列表项
        formatted = formatted.replace(/(<li>.*?<\/li>(?:\s*<br>)*)+/gs, function(match) {
            const cleanedMatch = match.replace(/<br>/g, '');
            return '<ul>' + cleanedMatch + '</ul>';
        });

        // 如果没有段落标签，包装整个内容
        if (!formatted.includes('<p>') && !formatted.includes('<h1>') && !formatted.includes('<h2>') && !formatted.includes('<h3>') && !formatted.includes('<ul>')) {
            formatted = '<p>' + formatted + '</p>';
        } else if (!formatted.startsWith('<')) {
            formatted = '<p>' + formatted;
        }

        if (!formatted.endsWith('>')) {
            formatted = formatted + '</p>';
        }

        // 清理多余的段落标签
        formatted = formatted
            .replace(/<p><\/p>/g, '')
            .replace(/<p>(<h[1-3]>)/g, '$1')
            .replace(/(<\/h[1-3]>)<\/p>/g, '$1')
            .replace(/<p>(<ul>)/g, '$1')
            .replace(/(<\/ul>)<\/p>/g, '$1')
            .replace(/<p>(<pre>)/g, '$1')
            .replace(/(<\/pre>)<\/p>/g, '$1');

        return formatted;
    }

    let thinkingStartTime;
    let thinkingInterval;

    function showThinkingIndicator() {
        thinkingStartTime = Date.now();

        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'message ai-message thinking-indicator';
        thinkingDiv.id = 'thinking-indicator';

        thinkingDiv.innerHTML = `
            <div class="message-content">
                <div class="thinking-container">
                    <div class="thinking-dots">
                        <div class="thinking-dot"></div>
                        <div class="thinking-dot"></div>
                        <div class="thinking-dot"></div>
                    </div>
                    <div class="thinking-text">Thinking<span class="thinking-ellipsis">...</span></div>
                    <div class="thinking-time">(<span id="thinking-elapsed">1</span>s / Expected 20s)</div>
                </div>
            </div>
        `;

        chatMessages.appendChild(thinkingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Update thinking time
        thinkingInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - thinkingStartTime) / 1000);
            const elapsedSpan = document.getElementById('thinking-elapsed');
            if (elapsedSpan) {
                elapsedSpan.textContent = elapsed;
            }
        }, 1000);
    }

    function hideThinkingIndicator() {
        const thinkingIndicator = document.getElementById('thinking-indicator');
        if (thinkingIndicator) {
            thinkingIndicator.remove();
        }
        if (thinkingInterval) {
            clearInterval(thinkingInterval);
            thinkingInterval = null;
        }
    }

    // Initialize chat state
    sendButton.disabled = true;
    updateSendButton(false);
});