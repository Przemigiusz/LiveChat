import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { User, ChatMessage, ErrorResponse, SuccessResponse, InfoResponse, ErrorCode, InfoCode, ErrorMessage, InfoMessage } from './models/interfaces.js';

let pool: User[] = [];
let potentialMatches: [User, User][] = [];
let matched: [User, User, ChatMessage[]][] = [];

function addToPool(body: Buffer[]): Promise<User> {
    return new Promise((resolve, reject) => {
        try {
            let user: User = JSON.parse(Buffer.concat(body).toString());
            user.id = crypto.randomUUID();
            pool.push(user);
            resolve(user);
        } catch (err) {
            reject(ErrorCode.AddUserError);
        }
    });
}

function removeFromPool(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const userIndex = pool.findIndex(user => user.id === userId);
        const matchIndex = potentialMatches.findIndex(match => match[0].id === userId || match[1].id === userId);
        if (userIndex !== -1 && matchIndex === -1) {
            pool.splice(userIndex, 1);
            resolve();
        } else {
            if (matchIndex !== -1) reject(InfoCode.DisconnectNotAllowed);
            else reject(ErrorCode.RemoveUserError);
        }
    });
}

function matchUsers(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const interval = 1000;

        let counter = 0;
        const timeout = 10;

        const matchInterval = setInterval(() => {
            if (counter >= timeout) {
                clearInterval(matchInterval);
                reject(InfoCode.Timeout);
            } else {
                const user1 = pool.find(user => user.id === userId);
                if (!user1) {
                    clearInterval(matchInterval);
                    reject(ErrorCode.UserNotFound);
                } else {
                    const user2 = pool.find(user => user.id !== userId);
                    if (user2) {
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
                            clearInterval(matchInterval);
                            resolve();
                        }
                    }
                }
                ++counter;
            }
        }, interval);
    });
}

function sendMessage(user: User, message: ChatMessage): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const match = matched.find(match => {
                return match[0].id === user.id || match[1].id === user.id;
            });
            if (match) {
                message.id = crypto.randomUUID();
                match[2].push(message);
                resolve();
            } else {
                reject(ErrorCode.ConversationNotFound);
            }
        } catch (err) {
            reject(err);
        }
    })
}

export function getMessages(user: User): Promise<ChatMessage[]> {
    return new Promise((resolve, reject) => {
        const match = matched.find(match => {
            return match[0].id === user.id || match[1].id === user.id;
        });
        if (match) {
            const messages: ChatMessage[] = match[2];
            resolve(messages);
        } else {
            reject(ErrorCode.ConversationNotFound);
        }
    });
}

function sendSuccessResponse<T>(res: http.ServerResponse, data?: T): void {
    const response: SuccessResponse<T> = { status: 'success', data: data };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
}

function sendErrorResponse(res: http.ServerResponse, errorCode: ErrorCode): void {
    const response: ErrorResponse = { status: 'error', code: errorCode, message: ErrorMessage[errorCode] };
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
}

function sendInfoResponse(res: http.ServerResponse, infoCode: InfoCode): void {
    const response: InfoResponse = { status: 'info', code: infoCode, message: InfoMessage[infoCode] };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
}

const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    let pathname = new URL(req.url || '', `http://${req.headers.host}`).pathname;
    if (pathname.startsWith('/pool')) {
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
        } else if (req.method === 'DELETE') {
            const userId = pathname.split('/')[2];
            if (userId) {
                removeFromPool(userId)
                    .then(() => {
                        sendSuccessResponse(res);
                    })
                    .catch(err => {
                        if (err === InfoCode.DisconnectNotAllowed) sendInfoResponse(res, err);
                        else sendErrorResponse(res, err);
                    });
            } else {
                sendErrorResponse(res, ErrorCode.NoUserId);
            }
        } else {
            sendErrorResponse(res, ErrorCode.MethodNotAllowed);
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
                            sendSuccessResponse(res);
                        })
                        .catch(err => {
                            if (err === InfoCode.Timeout) sendInfoResponse(res, err);
                            else sendErrorResponse(res, err);
                        });
                } catch (err: any) {
                    sendErrorResponse(res, err);
                }
            });
        } else {
            sendErrorResponse(res, ErrorCode.MethodNotAllowed);
        }
    } else if (pathname === '/messages') {
        if (req.method === 'POST') {
            let body: Buffer[] = [];
            req.on('data', (chunk) => {
                body.push(chunk);
            });
            req.on('end', async () => {
                try {
                    const parsedBody = JSON.parse(Buffer.concat(body).toString());
                    const user: User = parsedBody.user;
                    if (parsedBody.method === 'GET') {
                        getMessages(user)
                            .then(messages => {
                                sendSuccessResponse(res, messages);
                            })
                            .catch((err) => {
                                sendErrorResponse(res, err);
                            });
                    } else if (parsedBody.method === 'POST') {
                        const message: ChatMessage = parsedBody.message;
                        sendMessage(user, message)
                            .then(() => {
                                sendSuccessResponse(res);
                            })
                            .catch((err) => {
                                sendErrorResponse(res, err);
                            });
                    }
                } catch (err: any) {
                    sendErrorResponse(res, err);
                }
            });
        } else {
            sendErrorResponse(res, ErrorCode.MethodNotAllowed);
        }
    } else {
        let filePath: string;
        let contentType: string;

        if (pathname.startsWith('/scripts') || pathname.startsWith('/html') || pathname.startsWith('/css') || pathname.startsWith('/models')) {
            if (pathname.startsWith('/models')) filePath = path.join(process.cwd(), 'src', pathname);
            else filePath = path.join(process.cwd(), 'src/public', pathname);
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
                sendErrorResponse(res, ErrorCode.ServerError);
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data, 'utf-8');
            }
        });
    }
});

const PORT = 5000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));