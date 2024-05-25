import { User } from "../../models/interfaces.js";
import { ChatMessage } from "../../models/interfaces.js";
import { ErrorResponse, NotAllowedResponse, SuccessResponse } from "../../models/interfaces.js";

function getMessages(user: User): Promise<ErrorResponse | NotAllowedResponse | SuccessResponse<ChatMessage[]>> {
    return fetch('/getMessages', {
        method: 'POST',
        body: JSON.stringify({ user: user }),
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json());
}

function sendMessage(user: User, message: ChatMessage): Promise<ErrorResponse | NotAllowedResponse | SuccessResponse<void>> {
    return fetch('/sendMessage', {
        method: 'POST',
        body: JSON.stringify({ user: user, message: message }),
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json());
}

export default function setupChat(): void {
    const messageForm = document.querySelector('#message-form') as HTMLFormElement;
    const messageInput = document.querySelector('#message-form input') as HTMLInputElement;
    const chatMessages = document.querySelector('.chat .messages') as HTMLDivElement;

    if (messageForm && messageInput && chatMessages) {
        try {
            const item = sessionStorage.getItem('customUser');
            const user: User = item ? JSON.parse(item) : null;
            if (!user) {
                throw new Error('User not found');
            }

            messageForm.addEventListener('submit', async (evt) => {
                evt.preventDefault();
                const messageContent = messageInput.value;
                messageInput.value = '';

                const message: ChatMessage = { id: '', sender: user, content: messageContent, timestamp: Date.now() };
                const response = await sendMessage(user, message);

                if (response.status !== 'success') {
                    console.error(response.message);
                };
            });

            setInterval(async () => {
                try {
                    const response = await getMessages(user);
                    if (response.status === 'success') {
                        chatMessages.innerHTML = '';

                        console.log(response.data);
                        const sortedMessages = response.data.sort((a, b) => a.timestamp - b.timestamp);

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
                    } else {
                        throw new Error(response.message);
                    }
                } catch (err) {
                    console.error(err);
                }
            }, 5000)
        } catch (err) {
            console.error(err);
        }

    } else {
        console.error('Form, input or chat messages not found');
    }

};