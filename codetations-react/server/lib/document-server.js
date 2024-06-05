import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import WebSocket from 'ws';
const wss = new WebSocket.Server({ port: 3002 });
function validate(documentURI) {
    return documentURI.startsWith(process.cwd()) && fs.existsSync(documentURI);
}
wss.on('connection', (ws) => {
    console.log('new connection');
    ws.on('message', (message) => {
        console.log(`Received message => ${message}`);
        const messageObj = JSON.parse(message.toString());
        if (messageObj.type === 'listen') {
            const documentURI = path.resolve(messageObj.documentURI);
            if (!validate(documentURI)) {
                console.log('invalid document URI:', documentURI, 'current working directory:', process.cwd());
                return;
            }
            ws.documentURI = documentURI;
            const watcher = chokidar.watch(documentURI, {
                persistent: true,
                awaitWriteFinish: false,
            });
            watcher.on('change', (path, stats) => {
                console.log('file changed');
                const state = fs.readFileSync(documentURI, 'utf8');
                ws.send(state);
            });
            ws.watcher = watcher;
            const state = fs.readFileSync(documentURI, 'utf8');
            ws.send(state);
        }
        else if (messageObj.type === 'write') {
            const documentURI = path.resolve(messageObj.documentURI);
            const state = messageObj.state;
            if (!validate(documentURI)) {
                console.log('invalid document URI');
                return;
            }
            ws.documentURI = documentURI;
            fs.writeFile(documentURI, state, (err) => {
                if (err) {
                    console.error(err);
                    return;
                }
                console.log('File saved.');
            });
            wss.clients.forEach((ws1) => {
                if (ws1.documentURI === ws.documentURI && ws1.readyState === WebSocket.OPEN) {
                    ws1.send(state);
                }
            });
        }
    });
    ws.on('close', () => {
        var _a;
        console.log('closing connection');
        (_a = ws.watcher) === null || _a === void 0 ? void 0 : _a.close();
    });
});
//# sourceMappingURL=document-server.js.map