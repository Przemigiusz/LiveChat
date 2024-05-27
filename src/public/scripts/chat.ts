import { User, ChatMessage, ErrorResponse, SuccessResponse } from "../../models/interfaces.js";

function getMessages(user: User, latestMessageTimestamp: number): Promise<ErrorResponse | SuccessResponse<ChatMessage[]>> {
    return fetch('/messages', {
        method: 'POST',
        body: JSON.stringify({ user: user, method: 'GET', latestMessageTimestamp: latestMessageTimestamp }),
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json());
}

function sendMessage(user: User, message: ChatMessage): Promise<ErrorResponse | SuccessResponse<void>> {
    return fetch('/messages', {
        method: 'POST',
        body: JSON.stringify({ user: user, message: message, method: 'POST' }),
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json());
}

function checkConnectionStatus(user: User): Promise<ErrorResponse | SuccessResponse<string>> {
    return fetch('/connectionStatus', {
        method: 'POST',
        body: JSON.stringify({ user: user }),
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json());
}

export default function setupChat(): void {
    const messageForm = document.querySelector('#message-form') as HTMLFormElement;
    const messageInput = document.querySelector('#message-form input') as HTMLInputElement;
    const chatMessages = document.querySelector('.chat .messages') as HTMLDivElement;
    const connectionStatus = document.querySelector('.chat .connection-status span') as HTMLSpanElement;

    if (messageForm && messageInput && chatMessages && connectionStatus) {
        try {
            const item = sessionStorage.getItem('customUser');
            const user: User = item ? JSON.parse(item) : null;
            if (!user) {
                throw new Error('User not found');
            }

            const submitCallback = async (evt: Event) => {
                evt.preventDefault();
                const messageContent = messageInput.value;
                messageInput.value = '';

                const message: ChatMessage = { id: '', sender: user, content: messageContent, timestamp: Date.now() };
                const response = await sendMessage(user, message);

                if (response.status !== 'success') {
                    console.error(response.message);
                };
            }

            messageForm.addEventListener('submit', submitCallback);

            let latestMessageTimestamp: number = 0;

            const getMessagesIntervalId = setInterval(async () => {
                try {
                    const response = await getMessages(user, latestMessageTimestamp);
                    if (response.status === 'success') {
                        //chatMessages.innerHTML = '';
                        if (response.data) {
                            const sortedMessages = response.data.sort((a, b) => a.timestamp - b.timestamp);
                            console.log(response.data);
                            if (sortedMessages.length > 0) {
                                latestMessageTimestamp = sortedMessages[sortedMessages.length - 1].timestamp;
                            }

                            sortedMessages.forEach((message: ChatMessage) => {
                                const messageDiv = document.createElement('div');
                                messageDiv.classList.add('message');
                                messageDiv.classList.add(message.sender.id === user.id ? 'sender-message' : 'receiver-message');

                                const usernameP = document.createElement('p');
                                usernameP.classList.add('username');
                                usernameP.textContent = message.sender.username;

                                const contentDiv = document.createElement('div');
                                contentDiv.classList.add('message-content');

                                const contentP = document.createElement('p');
                                contentP.textContent = message.content;

                                contentDiv.appendChild(contentP);
                                messageDiv.appendChild(usernameP);
                                messageDiv.appendChild(contentDiv);

                                chatMessages.appendChild(messageDiv);
                            });
                        }
                    } else {
                        console.error(response.message);
                    }
                } catch (err) {
                    clearInterval(getMessagesIntervalId);
                    console.error(err);
                }
            }, 2500);

        } catch (err) {
            console.error(err);
        }

    } else {
        console.error('Form, input or chat messages not found');
    }

};