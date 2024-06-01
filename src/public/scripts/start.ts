import { User, ErrorResponse, SuccessResponse, InfoResponse, ErrorCode, InfoCode } from '../../models/interfaces.js';

export function addToPool(username: string): Promise<ErrorResponse | SuccessResponse<User>> {
    return fetch('/pool', {
        method: 'POST',
        body: JSON.stringify({ username: username }),
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json());
}

export function removeFromPool(userId: string): Promise<ErrorResponse | SuccessResponse<void> | InfoResponse> {
    return fetch(`/pool/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json());
}

export function match(userId: string): Promise<ErrorResponse | SuccessResponse<void> | InfoResponse> {
    return fetch('/match', {
        method: 'POST',
        body: JSON.stringify({ userId: userId }),
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json());
}

export default function connect(onMatch: () => void, onError: () => void): void {
    const usernameForm = document.querySelector('#username-form') as HTMLFormElement;
    const connectBtn = document.querySelector('#username-form button') as HTMLButtonElement;
    const usernameInput = document.querySelector('#username-form input') as HTMLInputElement;
    const spinner = document.querySelector('.spinner') as HTMLDivElement;

    let connectionTries = 0;
    const maxConnections = 5;

    let user: User;

    const stopMatching = async () => {
        const response = await removeFromPool(user.id);
        if (response.status === 'success') {
            spinner.classList.toggle('visible');
            connectBtn.textContent = 'Connect';
            if (connectionTries >= maxConnections) {
                connectBtn.disabled = true;
                alert('You have reached the maximum number of connection attempts. Please wait 30 seconds before trying again.');
                setTimeout(() => {
                    connectBtn.disabled = false;
                    connectionTries = 0;
                }, 30000);
            }
        } else {
            if (response.status === 'error') throw new Error(response.message);
            else console.info(response.message);
        }
    }

    usernameForm.addEventListener('submit', async (evt) => {
        evt.preventDefault();
        spinner.classList.toggle('visible');

        if (spinner.classList.contains('visible')) {
            connectBtn.textContent = 'Disconnect';
            ++connectionTries;
            try {
                const response = await addToPool(usernameInput.value);
                if (response.status === 'success') {
                    if (response.data) {
                        user = response.data;
                        sessionStorage.setItem('customUser', JSON.stringify(user));
                        const matchResponse = await match(user.id);
                        if (matchResponse.status === 'success') onMatch();
                        else {
                            await stopMatching();
                            if (matchResponse.status === 'error') throw new Error(matchResponse.message);
                            else console.info(matchResponse.message);
                        }
                    }
                } else throw new Error(response.message);
            } catch (err) {
                console.error(err);
                onError();
            }
        } else {
            try {
                await stopMatching();
            } catch (err) {
                console.error(err);
                onError();
            }
        }
    })
}

