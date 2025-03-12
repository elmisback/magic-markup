import { commands, ExtensionContext } from "vscode";
import { AnnotationManagerPanel } from "./panels/AnnotationManagerPanel";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import * as vscode from "vscode";
import fs from "fs";
import path from "path";

// import retagUpdate from "./server/retag";
import { SidebarProvider } from "./panels/AnnotationManagerPanel";
import { AnnotationTracker } from "./AnnotationTracker";

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

// Global annotation tracker instance
export let annotationTracker: AnnotationTracker;

export function activate(context: vscode.ExtensionContext) {
  // Initialize the annotation tracker
  annotationTracker = new AnnotationTracker(context);
  context.subscriptions.push(annotationTracker);

  // Register Sidebar Provider
  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      sidebarProvider
    )
  );

  // Create the show annotations command
  const showAnnotationsCommand = commands.registerCommand("codetations.showAnnotations", () => {
    AnnotationManagerPanel.render(context.extensionUri);
  });

  const chooseAnnotationType = () => {
    AnnotationManagerPanel.render(context.extensionUri);
    const editor = vscode.window.activeTextEditor;
    AnnotationManagerPanel.currentPanel?.sendMessageObject({
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
    if (AnnotationManagerPanel.currentPanel) {
      AnnotationManagerPanel.currentPanel.addAnnotation();
    } else {
      chooseAnnotationType();
    }
  });

  // Command for removing annotations
  const removeAnnotationsCommand = commands.registerCommand("codetations.removeAnnotation", () => {
    AnnotationManagerPanel.currentPanel?.removeAnnotation();
  });

  // Command for setting annotation color
  const setAnnotationColorCommand = commands.registerCommand("codetations.setAnnotationColor", () => {
    AnnotationManagerPanel.currentPanel?.setAnnotationColor();
  });

  // Command for moving selected annotation
  const moveSelectedCommand = commands.registerCommand("codetations.moveSelected", () => {
    AnnotationManagerPanel.currentPanel?.moveSelectedAnnotation();
  });

  context.subscriptions.push(
    showAnnotationsCommand,
    addAnnotationsCommand,
    removeAnnotationsCommand,
    setAnnotationColorCommand,
    moveSelectedCommand
  );
}