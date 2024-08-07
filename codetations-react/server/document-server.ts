/* 
document server
  /listen URI -- for now, filepath
    clients receive document update push they didn't initiate
    (later) clients receive document editable status
  /write data to document
    should lead to a document update push
*/
import fs from "fs";
import path from "path";
import chokidar from "chokidar";
import WebSocket from "ws";

// Create a WebSocket server
const wss = new WebSocket.Server({ port: 3002 });

function validate(documentURI: string) {
  // we only access files that exist, and are in the directory where this server is running.
  return documentURI.startsWith(process.cwd()) && fs.existsSync(documentURI);
}

type MySocket = WebSocket & { documentURI?: string } & {
  watcher?: chokidar.FSWatcher;
};

wss.on("connection", (ws: MySocket) => {
  console.log("new connection");
  ws.on("message", (message) => {
    console.log(`Received message => ${message}`);
    const messageObj = JSON.parse(message.toString());

    if (messageObj.type === "listen") {
      const documentURI = path.resolve(messageObj.documentURI);
      if (!validate(documentURI)) {
        console.log(
          "invalid document URI:",
          documentURI,
          "current working directory:",
          process.cwd()
        );
        return;
      }
      ws.documentURI = documentURI;

      const watcher = chokidar.watch(documentURI, {
        persistent: true,
        awaitWriteFinish: false,
      });

      watcher.on("change", (path, stats) => {
        console.log("file changed");
        const state = fs.readFileSync(documentURI, "utf8");
        ws.send(state);
      });
      ws.watcher = watcher;

      const state = fs.readFileSync(documentURI, "utf8");
      ws.send(state);
    } else if (messageObj.type === "write") {
      // read file uri from req.body
      const documentURI = path.resolve(messageObj.documentURI);
      const state = messageObj.state;

      if (!validate(documentURI)) {
        console.log("invalid document URI");
        return;
      }
      ws.documentURI = documentURI;

      // open the file and save the new state
      fs.writeFile(documentURI, state, (err: any) => {
        if (err) {
          console.error(err);
          return;
        }
        console.log("File saved.");
      });

      // send state to all listeners
      wss.clients.forEach((ws1: MySocket) => {
        if (
          ws1.documentURI === ws.documentURI &&
          ws1.readyState === WebSocket.OPEN
        ) {
          ws1.send(state);
        }
      });
    }
  });
  ws.on("close", () => {
    console.log("closing connection");
    // close file watcher
    ws.watcher?.close();
  });
});
