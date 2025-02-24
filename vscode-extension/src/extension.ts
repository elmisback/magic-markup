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
        await handler(req, res);
      } catch (e) {
        vscode.window
          .showErrorMessage(`Error running ${endpoint}: ${e}`, "Copy to clipboard")
          .then((action) => {
            if (action === "Copy to clipboard") {
              vscode.env.clipboard.writeText((e as Error).cause?.toString() || (e as Error).stack || (e as Error).message);
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

// Set up websocket server on a port to provide a document's text to all listeners
function runWSFileServer(port: number) {
  // Create a WebSocket server
  const wss = new WebSocket.Server({ port });

  function validate(documentURI: string) {
    return true;
    // we only access files that exist, and are in the directory where this server is running.
    // return documentURI.startsWith(process.cwd()) && fs.existsSync(documentURI);
  }

  type MySocket = WebSocket & { documentURI?: string } & {
    watcher?: chokidar.FSWatcher;
  };

  wss.on("connection", (ws: MySocket) => {
    console.log("new connection");
    ws.on("message", (message) => {
      console.debug(`Received message => ${message}`);
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

        // TODO: figure out why this is called twice on file change
        watcher.on("change", (path, stats) => {
          console.debug("file changed:", path);
          const state = fs.readFileSync(documentURI, "utf8");
          if (!state) {
            console.error("change: no state to send");
            return;
          }
          ws.send(state);
        });
        watcher.on("add", (path, stats) => {
          console.debug("file added:", path);
          const state = fs.readFileSync(documentURI, "utf8");
          if (!state) {
            console.error("change: no state to send");
            return;
          }
          ws.send(state);
        });
        ws.watcher = watcher;

        try {
          const state = fs.readFileSync(documentURI, "utf8");
          ws.send(state);
        } catch (e) {
          // HACK for now, just send an empty string if the file doesn't exist
          console.error("file read error:", e);
          const state = "";
          ws.send(state);
        }
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
          console.debug("File saved:", documentURI);
        });

        // // send state to all listeners
        // wss.clients.forEach((ws1: MySocket) => {
        //   if (ws1.documentURI === ws.documentURI && ws1.readyState === WebSocket.OPEN) {
        //     ws1.send(state);
        //   }
        // });
      }
    });
    ws.on("close", () => {
      console.log("closing connection");
      // close file watcher
      ws.watcher?.close();
    });
  });
  return wss;
}

export function activate(context: ExtensionContext) {
  // Retag server
  const retagServerPort = 8071;
  const retagServer = runEndpointDictWithErrorHandlingOnPort(
    8071,
    {
      "/retag": async (req: any, res: any) => {
        console.log("Retagging document");
        const { codeWithSnippetDelimited, updatedCodeWithoutDelimiters, delimiter } = req.body;
        const apiKey = vscode.workspace.getConfiguration().get("codetations.apiKey") as string;
        const out = await retagUpdate(
          codeWithSnippetDelimited,
          updatedCodeWithoutDelimiters,
          delimiter,
          apiKey
        );

        res.json(out);
      },
    },
    "Retag"
  );

  // Document + state server
  const fileServerPort = 8072;
  const fileServer = runWSFileServer(8072);

  // Create the show hello world command
  const showAnnotationsCommand = commands.registerCommand("codetations.showAnnotations", () => {
    HelloWorldPanel.render(context.extensionUri, retagServerPort, fileServerPort);
  });

  // Create a command that allows a user to set an API key for the extension
  const setAPIKeyCommand = commands.registerCommand("codetations.setAPIKey", async () => {
    const apiKey = await vscode.window.showInputBox({
      prompt: "Enter your OpenAI API key",
      placeHolder: "API Key",
    });
    if (apiKey) {
      vscode.workspace.getConfiguration().update("codetations.apiKey", apiKey);
    }
  });

  // Add another command to test messaging the webview
  const sendMessageCommand = commands.registerCommand("codetations.sendTestMessage", () => {
    HelloWorldPanel.currentPanel?.sendMessageObject({
      command: "test",
      data: vscode.window.activeTextEditor?.document.fileName,
    });
  });

  const chooseAnnotationType = () => {
    HelloWorldPanel.render(context.extensionUri, retagServerPort, fileServerPort);
    const editor = vscode.window.activeTextEditor;
    HelloWorldPanel.currentPanel?.sendMessageObject({
      command: "chooseAnnotationType",
      data: {
        start: editor?.document.offsetAt(editor.selection.start),
        end: editor?.document.offsetAt(editor.selection.end),
        documentContent: editor?.document.getText(),
      },
    });
  };

  // Create a command for adding annotations
  const addAnnotationsCommand = commands.registerCommand("codetations.addAnnotation", () => {
    if (HelloWorldPanel.currentPanel) {
      HelloWorldPanel.currentPanel.addAnnotation();
    } else {
      chooseAnnotationType();
    }
  });

  // Command for removing annotations
  const removeAnnotationsCommand = commands.registerCommand("codetations.removeAnnotation", () => {
    HelloWorldPanel.currentPanel?.removeAnnotation();
  });

  // Command for setting annotation color
  const setAnnotationColorCommand = commands.registerCommand("codetations.setAnnotationColor", () => {
    HelloWorldPanel.currentPanel?.setAnnotationColor();
  });

  context.subscriptions.push(
    showAnnotationsCommand,
    sendMessageCommand,
    addAnnotationsCommand,
    removeAnnotationsCommand,
    setAnnotationColorCommand,
  );
}
