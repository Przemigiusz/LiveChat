import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { User, ChatMessage, ErrorResponse, SuccessResponse, InfoResponse, ErrorCode, InfoCode, ErrorMessage, InfoMessage } from './models/interfaces.js';

let pool: User[] = [];
let potentialMatches: [User, User][] = [];
let matched: [User, User, ChatMessage[]][] = [];

function addToPool(username: string): Promise<User>;
function addToPool(user: User): Promise<void>;
function addToPool(input: string | User): Promise<User | void> {
    return new Promise((resolve, reject) => {
        try {
            if (typeof input === 'string') {
                const user: User = { id: crypto.randomUUID(), username: input };
                pool.push(user);
                resolve(user);
            } else {
                pool.push(input);
                resolve();
            }
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
            if (userIndex !== -1 && matchIndex !== -1) reject(InfoCode.DisconnectNotAllowed);
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
                    const ourMatch = potentialMatches.find(match => match[0].id === user1.id || match[1].id === user1.id);
                    if (ourMatch) {
                        const ourDefiniteMatch = matched.find(match => match[0].id === user1.id || match[1].id === user1.id);
                        if (!ourDefiniteMatch) matched.push([ourMatch[0], ourMatch[1], []]);
                        else potentialMatches = potentialMatches.filter(match => match[0].id !== user1.id && match[1].id !== user1.id);
                        pool = pool.filter(user => user.id !== user1.id);
                        clearInterval(matchInterval);
                        resolve();
                    } else {
                        const user2 = pool.find(user => user.id !== userId);
                        if (user2) {
                            const isUser2Matched = potentialMatches.find(match => match[0].id === user2.id || match[1].id === user2.id);
                            if (!isUser2Matched) {
                                potentialMatches.push([user1, user2]);
                            }
                        }
                    }
                }
                ++counter;
            }
        }, interval);
    });
}

function removeMatch(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const matchIndex = matched.findIndex(match => match[0].id === userId || match[1].id === userId);
        if (matchIndex !== -1) {
            matched.splice(matchIndex, 1);
            resolve();
        } else {
            reject(InfoCode.DisconnectOccured);
        }
    })
}

function sendMessage(userId: string, message: ChatMessage): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const match = matched.find(match => match[0].id === userId || match[1].id === userId);
            if (match) {
                message.id = crypto.randomUUID();
                match[2].push(message);
                resolve();
            } else {
                reject(InfoCode.ConversationNotFound);
            }
        } catch (err) {
            reject(err);
        }
    })
}

function getMessages(userId: string, latestMessageTimestamp: number): Promise<ChatMessage[]> {
    return new Promise((resolve, reject) => {
        const match = matched.find(match => match[0].id === userId || match[1].id === userId);
        if (match) {
            const messages: ChatMessage[] = match[2].filter(message => message.timestamp > latestMessageTimestamp);
            resolve(messages);
        } else {
            reject(InfoCode.ConversationNotFound);
        }
    });
}

function getConnectionStatus(userId: string): Promise<InfoCode> {
    return new Promise((resolve, reject) => {
        const connectionInterval = setInterval(() => {
            const matchIndex = matched.findIndex(match => match[0].id === userId || match[1].id === userId);
            if (matchIndex === -1) {
                clearInterval(connectionInterval);
                resolve(InfoCode.DisconnectOccured);
            }
        }, 5000);
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
                    const parsedBody = JSON.parse(Buffer.concat(body).toString());
                    const username: string = parsedBody.username;
                    const user: User = parsedBody.user;
                    if (username && username.trim() !== '') {
                        addToPool(username)
                            .then(user => sendSuccessResponse(res, user))
                            .catch(err => sendErrorResponse(res, err));
                    } else if (user) {
                        addToPool(user)
                            .then(() => sendSuccessResponse(res))
                            .catch(err => sendErrorResponse(res, err));
                    } else sendErrorResponse(res, ErrorCode.NoUserData);
                } catch (err: any) {
                    sendErrorResponse(res, err);
                }
            });
        } else if (req.method === 'DELETE') {
            const userId = pathname.split('/')[2];
            if (userId && userId.trim() !== '') {
                removeFromPool(userId)
                    .then(() => sendSuccessResponse(res))
                    .catch(code => {
                        if (code === InfoCode.DisconnectNotAllowed) sendInfoResponse(res, code);
                        else sendErrorResponse(res, code);
                    });
            } else sendErrorResponse(res, ErrorCode.NoUserId);
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
                    if (userId && userId.trim() !== '') {
                        matchUsers(userId)
                            .then(() => sendSuccessResponse(res))
                            .catch(code => {
                                if (code === InfoCode.Timeout) sendInfoResponse(res, code);
                                else sendErrorResponse(res, code);
                            });
                    } else sendErrorResponse(res, ErrorCode.NoUserId);
                } catch (err: any) {
                    sendErrorResponse(res, err);
                }
            });
        } else {
            sendErrorResponse(res, ErrorCode.MethodNotAllowed);
        }
    } else if (pathname.startsWith('/messages')) {
        if (req.method === 'POST') {
            let body: Buffer[] = [];
            req.on('data', (chunk) => {
                body.push(chunk);
            });
            req.on('end', async () => {
                try {
                    const parsedBody = JSON.parse(Buffer.concat(body).toString());
                    const userId: string = parsedBody.userId;
                    const message: ChatMessage = parsedBody.message;
                    if (userId && userId.trim() !== '' && message) {
                        sendMessage(userId, message)
                            .then(() => sendSuccessResponse(res))
                            .catch(err => {
                                if (err === InfoCode.ConversationNotFound) sendInfoResponse(res, err);
                                else sendErrorResponse(res, err);
                            });
                    } else {
                        if (!userId || userId.trim() === '') sendErrorResponse(res, ErrorCode.NoUserId);
                        else sendErrorResponse(res, ErrorCode.NoMessage);
                    }
                }
                catch (err: any) {
                    sendErrorResponse(res, err);
                }
            });
        } else if (req.method === 'GET') {
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            const userId = url.pathname.split('/')[2];
            const latestMessageTimestamp = Number(url.searchParams.get('latestMessageTimestamp'));
            if (userId && userId.trim() !== '' && !isNaN(latestMessageTimestamp) && latestMessageTimestamp >= 0) {
                getMessages(userId, latestMessageTimestamp)
                    .then(messages => sendSuccessResponse(res, messages))
                    .catch(code => sendInfoResponse(res, code));
            } else {
                if (!userId || userId.trim() === '') sendErrorResponse(res, ErrorCode.NoUserId);
                else sendErrorResponse(res, ErrorCode.NoMessageTimestamp);
            }
        }
        else {
            sendErrorResponse(res, ErrorCode.MethodNotAllowed);
        }
    } else if (pathname === '/disconnect') {
        if (req.method === 'POST') {
            let body: Buffer[] = [];
            req.on('data', (chunk) => {
                body.push(chunk);
            });
            req.on('end', async () => {
                try {
                    const userId: string = JSON.parse(Buffer.concat(body).toString()).userId;
                    if (userId && userId.trim() !== '') {
                        removeMatch(userId)
                            .then(() => sendSuccessResponse(res))
                            .catch(code => sendInfoResponse(res, code));
                    } else sendErrorResponse(res, ErrorCode.NoUserId);
                } catch (err: any) {
                    sendErrorResponse(res, err);
                }
            });
        } else {
            sendErrorResponse(res, ErrorCode.MethodNotAllowed);
        }
    } else if (pathname.startsWith('/connectionStatus')) {
        if (req.method === 'GET') {
            let body: Buffer[] = [];
            req.on('data', (chunk) => {
                body.push(chunk);
            });
            req.on('end', async () => {
                const userId = pathname.split('/')[2];
                if (userId && userId.trim() !== '') {
                    getConnectionStatus(userId)
                        .then(mess => sendInfoResponse(res, mess))
                } else sendErrorResponse(res, ErrorCode.NoUserId);
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
            if (err) sendErrorResponse(res, ErrorCode.ServerError);
            else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data, 'utf-8');
            }
        });
    }
});

const PORT = 5000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));