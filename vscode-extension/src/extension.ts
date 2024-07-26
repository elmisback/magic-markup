import { commands, ExtensionContext } from "vscode";
import { HelloWorldPanel } from "./panels/HelloWorldPanel";
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as vscode from 'vscode';

export function activate(context: ExtensionContext) {

  const runEndpointDictWithErrorHandlingOnPort = (port: number, endpointDict: { [key: string]: (req: any, res: any) => void}, serverName: string ) => {
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
          vscode.window.showErrorMessage(`Error running ${endpoint}: ${e}`, 'Copy to clipboard').then((action) => {
            if (action === 'Copy to clipboard') {
              vscode.env.clipboard.writeText(e as string)
            }
          });
          console.error(e);
        }
      });
    });
    return app.listen(port, () => {
      console.log(`${serverName} is running on port ${port}`);
    });
  }

  const retagServer = runEndpointDictWithErrorHandlingOnPort(8071, {
    '/retag': async (req: any, res: any) => {
        // Handle retagging endpoint here
        // res.json({ out });
    }
  }, 'Retag')

  const documentServer = runEndpointDictWithErrorHandlingOnPort(8072, {
    '/listen': async (req: any, res: any) => {
        // Handle document endpoint here
        // res.json({ out });
    }
  }, 'Document')

  const stateServer = runEndpointDictWithErrorHandlingOnPort(8073, {
    '/listen': async (req: any, res: any) => {
        // Handle state endpoint here
        // res.json({ out });
    }
  }, 'State')
  

  // Create the show hello world command
  const showHelloWorldCommand = commands.registerCommand("hello-world.showHelloWorld", () => {
    HelloWorldPanel.render(context.extensionUri);
  });

  // Add command to the extension context
  context.subscriptions.push(showHelloWorldCommand);
}
