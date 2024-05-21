import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { User } from './models/interfaces.js';

const pool: User[] = [];
const matched: [User, User][] = [];

function removeFromPool(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const userIndex = pool.findIndex((user) => user.id === userId);
        if (userIndex !== -1) {
            pool.splice(userIndex, 1);
            resolve();
        } else {
            reject();
        }
    });
}

const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    let pathname = new URL(req.url || '', `http://${req.headers.host}`).pathname;

    if (pathname === '/addToPool') { //searching for match
        let body: Buffer[] = [];
        req.on('data', (chunk) => {
            body.push(chunk);
        });
        req.on('end', () => {
            let user: User = JSON.parse(Buffer.concat(body).toString());
            user.id = crypto.randomUUID();
            pool.push(user);
            console.log(`Look at this little fool ya: ${user}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(user));
        });
    } else if (pathname.startsWith('/removeFromPool')) {
        if (req.method === 'DELETE') {
            const userId = pathname.split('/')[2];

            removeFromPool(userId)
                .then(() => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'success', message: 'User removed from pool' }));
                })
                .catch((err) => {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'error', message: 'An error occurred' }));
                });
        } else {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: 'Method not allowed' }));
        }
    } else if (pathname === '/match') {

    } else if (pathname === '/unmatch') {

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
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data, 'utf-8');
            }
        });
    }
});

const PORT = 5000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));