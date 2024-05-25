import { User } from "../../models/interfaces.js";
import { ErrorResponse, NotAllowedResponse, SuccessResponse } from '../../models/interfaces.js';

function addToPool(username: string): Promise<ErrorResponse | NotAllowedResponse | SuccessResponse<User>> {
    return fetch('/addToPool', {
        method: 'POST',
        body: JSON.stringify({ username: username }),
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json());
}

function match(userId: string): Promise<ErrorResponse | NotAllowedResponse | SuccessResponse<string>> {
    return fetch('/match', {
        method: 'POST',
        body: JSON.stringify({ userId: userId }),
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json());
}

function removeFromPool(userId: string): Promise<ErrorResponse | NotAllowedResponse | SuccessResponse<string>> {
    return fetch(`/removeFromPool/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json());
}

export default function connect(onMatchFound: () => void): void {
    const usernameForm = document.querySelector('#username-form') as HTMLFormElement;
    const connectBtn = document.querySelector('#username-form button') as HTMLButtonElement;
    const usernameInput = document.querySelector('#username-form input') as HTMLInputElement;
    const spinner = document.querySelector('.spinner') as HTMLDivElement;

    let connectionTries = 0;
    const maxConnections = 5;

    let matchingIntervalId: NodeJS.Timeout | undefined;

    let user: User;

    usernameForm.addEventListener('submit', async (evt) => {
        evt.preventDefault();
        spinner.classList.toggle('visible');

        if (spinner.classList.contains('visible')) {
            connectBtn.textContent = 'Disconnect';
            ++connectionTries;
            try {
                const response = await addToPool(usernameInput.value);
                if (response.status === 'success') {
                    user = response.data;
                    sessionStorage.setItem('customUser', JSON.stringify(user));
                    matchingIntervalId = setInterval(async () => {
                        try {
                            const matchResponse = await match(user.id);
                            if (matchResponse.status === 'success') {
                                clearInterval(matchingIntervalId);
                                onMatchFound();
                            } else {
                                console.error(matchResponse.message);
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    }, 5000);
                } else {
                    throw new Error(response.message);
                }
            } catch (err) {
                console.error(err);
            }
        } else {
            try {
                connectBtn.textContent = 'Connect';
                const response = await removeFromPool(user.id);
                if (response.status === 'success') {
                    clearInterval(matchingIntervalId);
                    if (connectionTries >= maxConnections) {
                        connectBtn.disabled = true;
                        alert('You have reached the maximum number of connection attempts. Please wait 30 seconds before trying again.');
                        setTimeout(() => {
                            connectBtn.disabled = false;
                            connectionTries = 0;
                        }, 30000);
                    }
                } else {
                    throw new Error(response.message);
                }
            } catch (err) {
                clearInterval(matchingIntervalId);
                console.error(err);
            }
        }
    })
}

