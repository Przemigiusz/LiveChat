import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { User, ChatMessage } from './models/interfaces.js';
import { ErrorResponse, NotAllowedResponse, SuccessResponse } from './models/interfaces.js';

let pool: User[] = [];
let potentialMatches: [User, User][] = [];
let matched: [User, User, ChatMessage[]][] = [];

function checkConnectionStatus(user: User): Promise<string> {
    return new Promise((resolve, reject) => {
        const match = matched.find(match => match[0].id === user.id || match[1].id === user.id);
        match ? resolve('Connected') : reject('Not connected');
    });
}

function sendMessage(user: User, message: ChatMessage): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const match = matched.find(match => match[0].id === user.id || match[1].id === user.id);
            if (match) {
                message.id = crypto.randomUUID();
                match[2].push(message);
                resolve();
            } else {
                reject('Conversation not found');
            }
        } catch (err) {
            reject(err);
        }
    })
}

export function getMessages(user: User): Promise<ChatMessage[]> {
    return new Promise((resolve, reject) => {
        const match = matched.find(match => match[0].id === user.id || match[1].id === user.id);
        if (match) {
            const messages: ChatMessage[] = match[2];
            resolve(messages);
        } else {
            reject('No conversation found');
        }
    });
}

function addToPool(body: Buffer[]): Promise<User> {
    return new Promise((resolve, reject) => {
        try {
            let user: User = JSON.parse(Buffer.concat(body).toString());
            user.id = crypto.randomUUID();
            pool.push(user);
            resolve(user);
        } catch (err) {
            reject(err);
        }
    });
}

function removeFromPool(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const userIndex = pool.findIndex((user) => user.id === userId);
        if (userIndex !== -1) {
            pool.splice(userIndex, 1);
            resolve();
        } else {
            reject(`An error occurred while adding user to the pool`);
        }
    });
}

function matchUsers(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (pool.length < 1) {
            reject('Not enough people in the pool.');
        } else {
            const user1 = pool.find(user => user.id === userId);
            if (!user1) {
                reject('User not found in the pool.');
            } else {
                const user2 = pool.find(user => user.id !== userId);
                if (!user2) {
                    reject('No other users to match with.');
                } else {
                    const existingMatch = potentialMatches.find(match =>
                        (match[0].id === user1.id && match[1].id === user2.id) ||
                        (match[0].id === user2.id && match[1].id === user1.id)
                    );
                    if (!existingMatch) {
                        potentialMatches.push([user1, user2]);
                    } else {
                        potentialMatches = potentialMatches.filter(match =>
                            !(match[0].id === user1.id && match[1].id === user2.id) &&
                            !(match[0].id === user2.id && match[1].id === user1.id)
                        );
                        pool = pool.filter(user =>
                            !(user.id !== user1.id && user.id !== user2.id)
                        );
                        matched.push([user1, user2, []]);
                    }

                    resolve();
                }
            }
        }
    });
}

function sendSuccessResponse<T>(res: http.ServerResponse, data: T): void {
    const response: SuccessResponse<T> = { status: 'success', data: data };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
}

function sendErrorResponse(res: http.ServerResponse, message: string): void {
    const response: ErrorResponse = { status: 'error', message: message };
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
}

function sendNotAllowedResponse(res: http.ServerResponse, message: string): void {
    const response: NotAllowedResponse = { status: 'error', message: message };
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
}

const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    let pathname = new URL(req.url || '', `http://${req.headers.host}`).pathname;
    if (pathname === '/addToPool') {
        if (req.method === 'POST') {
            let body: Buffer[] = [];
            req.on('data', (chunk) => {
                body.push(chunk);
            });
            req.on('end', async () => {
                try {
                    const user = await addToPool(body);
                    sendSuccessResponse(res, user);
                } catch (err: any) {
                    sendErrorResponse(res, err);
                }
            });
        } else {
            sendNotAllowedResponse(res, 'Method not allowed, DELETE required.');
        }
    } else if (pathname.startsWith('/removeFromPool')) {
        if (req.method === 'DELETE') {
            const userId = pathname.split('/')[2];

            removeFromPool(userId)
                .then(() => {
                    sendSuccessResponse(res, 'User removed from pool');
                })
                .catch((err) => {
                    sendErrorResponse(res, err);
                });
        } else {
            sendNotAllowedResponse(res, 'Method not allowed, DELETE required.');
        }
    } else if (pathname === '/match') {
        if (req.method === 'POST') {
            let body: Buffer[] = [];
            req.on('data', (chunk) => {
                body.push(chunk);
            });
            req.on('end', async () => {
                try {
                    const userId: string = JSON.parse(Buffer.concat(body).toString()).userId;
                    matchUsers(userId)
                        .then(() => {
                            sendSuccessResponse(res, 'Users matched successfully');
                        })
                        .catch((err) => {
                            sendErrorResponse(res, err);
                        });
                } catch (err: any) {
                    sendErrorResponse(res, err);
                }
            });
        } else {
            sendNotAllowedResponse(res, 'Method not allowed, POST required.');
        }
    } else if (pathname === '/unmatch') {

    } else if (pathname === '/getMessages') {
        if (req.method === 'POST') {
            let body: Buffer[] = [];
            req.on('data', (chunk) => {
                body.push(chunk);
            });
            req.on('end', async () => {
                try {
                    const parsedBody = JSON.parse(Buffer.concat(body).toString());
                    const user: User = parsedBody.user;
                    getMessages(user)
                        .then(messages => {
                            sendSuccessResponse(res, messages);
                        })
                        .catch((err) => {
                            sendErrorResponse(res, err);
                        });
                } catch (err: any) {
                    sendErrorResponse(res, err);
                }
            });
        } else {
            sendNotAllowedResponse(res, 'Method not allowed, POST required.');
        }
    } else if (pathname === '/sendMessage') {
        if (req.method === 'POST') {
            let body: Buffer[] = [];
            req.on('data', (chunk) => {
                body.push(chunk);
            });
            req.on('end', async () => {
                try {
                    const parsedBody = JSON.parse(Buffer.concat(body).toString());
                    const user: User = parsedBody.user;
                    const message: ChatMessage = parsedBody.message;
                    sendMessage(user, message)
                        .then(() => {
                            sendSuccessResponse(res, 'Message sent successfully');
                        })
                        .catch((err) => {
                            sendErrorResponse(res, err);
                        });
                } catch (err: any) {
                    sendErrorResponse(res, err);
                }
            });
        } else {
            sendNotAllowedResponse(res, 'Method not allowed, POST required.');
        }
    } else if (pathname === '/connectionStatus') {
        if (req.method === 'POST') {
            let body: Buffer[] = [];
            req.on('data', (chunk) => {
                body.push(chunk);
            });
            req.on('end', async () => {
                const parsedBody = JSON.parse(Buffer.concat(body).toString());
                const user: User = parsedBody.user;
                checkConnectionStatus(user)
                    .then(status => {
                        sendSuccessResponse(res, status);
                    })
                    .catch((err) => {
                        sendErrorResponse(res, err);
                    });
            })
        } else {
            sendNotAllowedResponse(res, 'Method not allowed, POST required.');
        }

    } else {
        let filePath: string;
        let contentType: string;

        if (pathname.startsWith('/scripts') || pathname.startsWith('/html') || pathname.startsWith('/css')) {
            filePath = path.join(process.cwd(), 'src/public', pathname);
            switch (path.extname(filePath)) {
                case '.js':
                    contentType = 'text/javascript';
                    break;
                case '.html':
                    contentType = 'text/html';
                    break;
                case '.css':
                    contentType = 'text/css';
                    break;
                default:
                    contentType = 'text/plain';
            }
        } else {
            filePath = path.join(process.cwd(), 'src/public/html', 'index.html');
            contentType = 'text/html';
        }

        fs.readFile(filePath, (err: NodeJS.ErrnoException | null, data: Buffer) => {
            if (err) {
                sendErrorResponse(res, `Server Error: ${err.code}`);
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data, 'utf-8');
            }
        });
    }
});

const PORT = 5000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));