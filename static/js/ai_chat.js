document.addEventListener('DOMContentLoaded', function() {
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const sendPreferencesBtn = document.getElementById('send-preferences');
    const showPreferencesBtn = document.getElementById('show-preferences');
    const preferencesPanel = document.getElementById('preferences-panel');
    const closePreferencesBtn = document.getElementById('close-preferences');

    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';

        // Enable/disable send button
        sendButton.disabled = !this.value.trim();
    });

    // Send message on Enter (but not Shift+Enter)
    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Send button click
    sendButton.addEventListener('click', sendMessage);

    // Send preferences button
    sendPreferencesBtn.addEventListener('click', function() {
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

    function sendMessage(customMessage = null, includePreferences = false) {
        const message = customMessage || messageInput.value.trim();
        if (!message) return;

        // Add user message to chat
        addMessage(message, 'user');

        // Clear input
        if (!customMessage) {
            messageInput.value = '';
            messageInput.style.height = 'auto';
            sendButton.disabled = true;
        }

        // Show typing indicator
        showTypingIndicator();

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
            hideTypingIndicator();

            if (data.success) {
                addMessage(data.message, 'ai');
            } else {
                addMessage('Sorry, I encountered an error. Please try again.', 'ai');
                console.error('AI Error:', data.error);
            }
        })
        .catch(error => {
            hideTypingIndicator();
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
                <p>${formatMessage(content)}</p>
            </div>
            <div class="message-time">${timeString}</div>
        `;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function formatMessage(text) {
        // Basic formatting for AI responses
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }

    function showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message ai-message typing-indicator';
        typingDiv.id = 'typing-indicator';

        typingDiv.innerHTML = `
            <div class="message-content">
                <div class="typing-dots">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;

        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    // Initialize chat state
    sendButton.disabled = true;
});