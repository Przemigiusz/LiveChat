import { User, ChatMessage, ErrorResponse, SuccessResponse, InfoResponse, InfoCode } from "../../models/interfaces.js";
import { match, removeFromPool } from "./start.js";

function addToPool(user: User): Promise<ErrorResponse | SuccessResponse<void>> {
    return fetch('/pool', {
        method: 'POST',
        body: JSON.stringify({ user: user }),
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json());
}

function getMessages(userId: string, latestMessageTimestamp: number): Promise<ErrorResponse | SuccessResponse<ChatMessage[]> | InfoResponse> {
    return fetch(`/messages/${userId}?latestMessageTimestamp=${latestMessageTimestamp}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json());
}

function sendMessage(userId: string, message: ChatMessage): Promise<ErrorResponse | SuccessResponse<void> | InfoResponse> {
    return fetch('/messages', {
        method: 'POST',
        body: JSON.stringify({ userId: userId, message: message }),
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json());
}

function disconnect(userId: string): Promise<ErrorResponse | SuccessResponse<void> | InfoResponse> {
    return fetch('/disconnect', {
        method: 'POST',
        body: JSON.stringify({ userId: userId }),
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json());
}

function getConnectionStatus(userId: string): Promise<ErrorResponse | InfoResponse> {
    return fetch(`/connectionStatus/${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json());
}

export default async function setupChat(onDisconnect: () => void, onSkip: () => void, onError: () => void): Promise<void> {
    let errorOccured = false;
    const handleError = (err: unknown) => {
        console.error(err);
        if (!errorOccured) {
            onError();
            errorOccured = true;
        }
    };

    try {
        const messageForm = document.querySelector('#message-form') as HTMLFormElement;
        const messageInput = document.querySelector('#message-form input') as HTMLInputElement;
        const chatMessages = document.querySelector('.chat .messages') as HTMLDivElement;
        const connectionStatus = document.querySelector('.chat .connection-status span') as HTMLSpanElement;
        const skipButton = document.querySelector('.chat-navigation .skip') as HTMLButtonElement;
        const disconnectButton = document.querySelector('.chat-navigation .disconnect') as HTMLButtonElement;
        const spinner = document.querySelector('.spinner') as HTMLDivElement;

        if (!messageForm || !messageInput || !chatMessages || !connectionStatus || !skipButton || !disconnectButton) throw new Error('Page content was not generated correctly.');

        const item = sessionStorage.getItem('customUser');
        const user: User = item ? JSON.parse(item) : null;
        if (!user) throw new Error('User not found');

        const submitCallback = async (evt: Event) => {
            evt.preventDefault();
            const messageContent = messageInput.value;
            messageInput.value = '';

            const message: ChatMessage = { id: '', sender: user, content: messageContent, timestamp: Date.now() };
            const response = await sendMessage(user.id, message);

            if (response.status === 'info') console.info(response.message);
        }

        messageForm.addEventListener('submit', submitCallback);

        let latestMessageTimestamp: number = 0;

        const getMessagesLoop = async () => {
            try {
                const response = await getMessages(user.id, latestMessageTimestamp);
                if (response.status === 'success') {
                    if (response.data) {
                        const sortedMessages = response.data.sort((a, b) => a.timestamp - b.timestamp);
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
                        setTimeout(getMessagesLoop, 5000);
                    }
                } else {
                    if (response.status === 'info') console.info(response.message);
                    else throw new Error(response.message);
                }
            } catch (err) {
                handleError(err);
            }
        }

        await getMessagesLoop();

        disconnectButton.addEventListener('click', async () => {
            try {
                const response = await disconnect(user.id);
                if (response.status === 'success') onDisconnect();
                else {
                    if (response.status === 'info') {
                        console.info(response.message);
                        onDisconnect();
                    }
                    else throw new Error(response.message);
                }
            } catch (err) {
                handleError(err);
            }
        });

        const stopMatching = async () => {
            try {
                const response = await removeFromPool(user.id);
                if (response.status === 'success') spinner.classList.toggle('visible');
                else {
                    if (response.status === 'error') throw new Error(response.message);
                    else console.info(response.message);
                }
            } catch (err) {
                handleError(err);
            }
        }

        skipButton.addEventListener('click', async () => {
            try {
                const disconnectResponse = await disconnect(user.id);
                if (disconnectResponse.status === 'info') console.info(disconnectResponse.message);
                else if (disconnectResponse.status === 'error') throw new Error(disconnectResponse.message);

                const poolResponse = await addToPool(user);
                if (poolResponse.status === 'success') {
                    spinner.classList.toggle('visible');
                    const matchResponse = await match(user.id);
                    if (matchResponse.status === 'success') onSkip();
                    else {
                        if (matchResponse.status === 'error') throw new Error(matchResponse.message);
                        else console.info(matchResponse.message);
                        await stopMatching();
                    }
                } else throw new Error(poolResponse.message);
            } catch (err) {
                handleError(err);
            }
        })

        const connectionStatusResponse = await getConnectionStatus(user.id);
        if (connectionStatusResponse.status === 'info') connectionStatus.style.backgroundColor = '#dc2f02';
        else throw new Error(connectionStatusResponse.message);

    } catch (err) {
        handleError(err);
    }

}