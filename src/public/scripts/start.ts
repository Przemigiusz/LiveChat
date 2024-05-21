function updateConnectionStatus(): NodeJS.Timeout {
    const connectBtn = document.querySelector('#usernameForm button') as HTMLButtonElement;
    let isIncreasing = true;
    const maxDots = 3;
    const baseString = 'Connecting';
    let connectionStatusString = baseString;
    let dotCount = 0;

    const intervalId = setInterval(() => {
        if (isIncreasing) {
            if (dotCount < maxDots) {
                connectionStatusString += '.';
                ++dotCount;
            } else {
                isIncreasing = false;
            }
        } else {
            if (dotCount > 0) {
                connectionStatusString = connectionStatusString.slice(0, -1);
                --dotCount;
            } else {
                isIncreasing = true;
            }
        }
        connectBtn.textContent = connectionStatusString;
    }, 1000);
    return intervalId;
}

function addToPool(username: string): Promise<Response> {
    return fetch('/addToPool', {
        method: 'POST',
        body: JSON.stringify({ username: username }),
        headers: { 'Content-Type': 'application/json' }
    });
}

function removeFromPool(userId: string): Promise<Response> {
    return fetch(`/removeFromPool/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
    });
}

export default function connect(): void {
    const connectBtn = document.querySelector('#usernameForm button') as HTMLButtonElement;
    const usernameInput = document.querySelector('#usernameForm input') as HTMLInputElement;
    const spinner = document.querySelector('.spinner') as HTMLDivElement;

    let connectingIntervalId: NodeJS.Timeout | undefined;

    let connectionTries = 0;
    const maxConnections = 5;

    let matchingIntervalId: NodeJS.Timeout | undefined;

    connectBtn.addEventListener('click', (evt) => {
        evt.preventDefault();
        spinner.classList.toggle('visible');

        if (spinner.classList.contains('visible')) {
            connectingIntervalId = updateConnectionStatus();
            ++connectionTries;
            addToPool(usernameInput.value).then(response => {
                if (response.ok) {
                    console.log(response.json());
                }
            });

        } else {
            if (connectingIntervalId !== undefined) {
                clearInterval(connectingIntervalId);
                connectingIntervalId = undefined;
                connectBtn.textContent = 'Connect';
                if (connectionTries >= maxConnections) {
                    connectBtn.disabled = true;
                    alert('You have reached the maximum number of connection attempts. Please wait 30 seconds before trying again.');
                    setTimeout(() => {
                        connectBtn.disabled = false;
                        connectionTries = 0;
                    }, 30000);
                }
            }
        }
    })
}

