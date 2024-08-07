import { commands, ExtensionContext } from "vscode";
import { HelloWorldPanel } from "./panels/HelloWorldPanel";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import * as vscode from "vscode";
import fs from "fs";
import WebSocket from "ws";
import path from "path";
import chokidar from "chokidar";

import retagUpdate from "./server/retag";

export function activate(context: ExtensionContext) {
  // Helper to run REST endpoints
  const runEndpointDictWithErrorHandlingOnPort = (
    port: number,
    endpointDict: { [key: string]: (req: any, res: any) => void },
    serverName: string
  ) => {
    const app = express();
    app.use(cors());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    Object.entries(endpointDict).forEach(([endpoint, handler]) => {
      app.post(endpoint, async (req: any, res: any) => {
        console.log(endpoint, req.body);
        try {
          handler(req, res);
        } catch (e) {
          vscode.window
            .showErrorMessage(`Error running ${endpoint}: ${e}`, "Copy to clipboard")
            .then((action) => {
              if (action === "Copy to clipboard") {
                vscode.env.clipboard.writeText(e as string);
              }
            });
          console.error(e);
        }
      });
    });
    return app.listen(port, () => {
      console.log(`${serverName} is running on port ${port}`);
    });
  };

  // Retag server
  const retagServer = runEndpointDictWithErrorHandlingOnPort(
    8071,
    {
      "/retag": async (req: any, res: any) => {
        console.log("Retagging document");
        const { codeWithSnippetDelimited, updatedCodeWithoutDelimiters, delimiter, APIKey } =
          req.body;

        const out = await retagUpdate(
          codeWithSnippetDelimited,
          updatedCodeWithoutDelimiters,
          delimiter,
          APIKey
        );

        res.json(out);
      },
    },
    "Retag"
  );

  // Document server
  const documentServer = new WebSocket.Server({ port: 8072 });

  function validate(documentURI: string) {
    // we only access files that exist, and are in the directory where this server is running.
    return documentURI.startsWith(process.cwd()) && fs.existsSync(documentURI);
  }

  type MySocket = WebSocket & { documentURI?: string } & { watcher?: chokidar.FSWatcher };

  documentServer.on("connection", (ws: MySocket) => {
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
        documentServer.clients.forEach((ws1: MySocket) => {
          if (ws1.documentURI === ws.documentURI && ws1.readyState === WebSocket.OPEN) {
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

  // State server
  const stateServer = new WebSocket.Server({ port: 8073 });

  let stateURI = "";

  stateServer.on("connection", (ws: WebSocket.WebSocket) => {
    console.log("new connection");
    ws.on("message", (message) => {
      console.log(`Received message => ${message}`);
      const messageObj = JSON.parse(message.toString());

      if (messageObj.type === "listen") {
        const state = fs.readFileSync(stateURI, "utf8");
        ws.send(state);
      } else if (messageObj.type === "save") {
        // read file uri from req.body
        stateURI = messageObj.stateURI;
        const state = messageObj.state;

        // open the file and save the new state
        fs.writeFile(stateURI, JSON.stringify(state), (err: any) => {
          if (err) {
            console.error(err);
            return;
          }
          console.log("File saved.");
        });

        // send state to all listeners
        stateServer.clients.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(state);
          }
        });
      }
    });
  });

  // Create the show hello world command
  const showHelloWorldCommand = commands.registerCommand("hello-world.showHelloWorld", () => {
    HelloWorldPanel.render(context.extensionUri);
  });

  // Add command to the extension context
  context.subscriptions.push(showHelloWorldCommand);
}
