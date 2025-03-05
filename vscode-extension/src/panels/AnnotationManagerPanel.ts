import { Disposable, Webview, WebviewPanel, window, Uri, ViewColumn } from "vscode";
import { getUri } from "../utilities/getUri";
import { getNonce } from "../utilities/getNonce";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

import { LMApiHandler } from "./LMApiHandler";
import { annotationTracker } from "../extension";
import { Annotation } from "../AnnotationTracker";

/**
 * This class manages the state and behavior of annotation manager webview panels.
 */
export class AnnotationManagerPanel {
  private _lmApiHandler: LMApiHandler;
  public static currentPanel: AnnotationManagerPanel | undefined;
  private readonly _panel: WebviewPanel;
  private _disposables: Disposable[] = [];
  private _prevTextEditor: vscode.TextEditor | undefined;
  private _retagServerPort: number;
  private _showingRetagBanner: boolean = false;

  /**
   * The AnnotationManagerPanel class private constructor (called only from the render method).
   *
   * @param panel A reference to the webview panel
   * @param extensionUri The URI of the directory containing the extension
   */
  private constructor(panel: WebviewPanel, extensionUri: Uri, retagServerPort: number) {
    this._panel = panel;
    this._retagServerPort = retagServerPort;

    // Initialize the LM API Handler
    this._lmApiHandler = new LMApiHandler(this._panel.webview);

    // Set an event listener to listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Set the HTML content for the webview panel
    this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);

    // Set an event listener to listen for messages passed from the webview context
    this._setWebviewMessageListener(this._panel.webview);

    // Set an event listener to listen for changes in the active text editor
    this._setActiveTextEditorChangeListener(this._panel.webview);

    // Set previous text editor
    this._prevTextEditor = vscode.window.activeTextEditor;

    // If there's an active editor, load its annotations
    if (vscode.window.activeTextEditor) {
      this._loadAnnotationsForActiveEditor();
    }
  }

  /**
   * Loads annotations for the active editor and sends them to the webview
   */
  private _loadAnnotationsForActiveEditor(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // Get annotations from the tracker
    const annotations = annotationTracker.getAnnotationsForDocument(editor.document);
    
    // Send information to webview
    this.sendMessageObject({
      command: "initialize",
      data: {
        documentUri: editor.document.uri.toString(),
        documentText: editor.document.getText(),
        annotations: annotations,
        retagServerURL: `http://localhost:${this._retagServerPort}/retag`
      }
    });
  }

  /**
   * Renders the current webview panel if it exists otherwise a new webview panel
   * will be created and displayed.
   *
   * @param extensionUri The URI of the directory containing the extension.
   */
  public static render(extensionUri: Uri, retagServerPort: number) {
    if (AnnotationManagerPanel.currentPanel) {
      // If the webview panel already exists reveal it
      AnnotationManagerPanel.currentPanel._panel.reveal(ViewColumn.Two, true);
    } else {
      // If a webview panel does not already exist create and show a new one
      const panel = window.createWebviewPanel(
        // Panel view type
        "showAnnotations",
        // Panel title
        "Codetations",
        // The editor column the panel should be displayed in
        { viewColumn: ViewColumn.Two, preserveFocus: true },
        // Extra panel configurations
        {
          // Enable JavaScript in the webview
          enableScripts: true,
          retainContextWhenHidden: true,
          // Restrict the webview to only load resources from the `out` and `webview-ui/build` directories
          localResourceRoots: [
            Uri.joinPath(extensionUri, "out"),
            Uri.joinPath(extensionUri, "webview-ui/build"),
          ],
        }
      );

      AnnotationManagerPanel.currentPanel = new AnnotationManagerPanel(panel, extensionUri, retagServerPort);
    }
  }

  /**
   * Handles the command to add an annotation from the current selection
   */
  public addAnnotation(): void {
    const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
    if (!editor) return;

    this._panel.webview.postMessage(
      JSON.stringify({
        command: "addAnnotation",
        data: {
          start: editor?.document.offsetAt(editor.selection.start),
          end: editor?.document.offsetAt(editor.selection.end),
        },
      })
    );
  }

  /**
   * Handles the command to remove the selected annotation
   */
  public removeAnnotation(): void {
    this._panel.webview.postMessage(
      JSON.stringify({
        command: "removeAnnotation",
      })
    );
  }

  /**
   * Handles the command to set the color of the selected annotation
   */
  public setAnnotationColor(): void {
    // Get the color from the user
    vscode.window.showInputBox({ prompt: "Enter a color" }).then((color) => {
      if (color) {
        this._panel.webview.postMessage(
          JSON.stringify({
            command: "setAnnotationColor",
            data: {
              color: color,
            },
          })
        );
      }
    });
  }

  /**
   * Shows a banner in the webview to indicate that annotations need retagging
   */
  public showRetagBanner(): void {
    if (this._showingRetagBanner) return;
    
    this._showingRetagBanner = true;
    this.sendMessageObject({
      command: "showRetagBanner",
    });
  }

  /**
   * Hides the retag banner in the webview
   */
  public hideRetagBanner(): void {
    this._showingRetagBanner = false;
    this.sendMessageObject({
      command: "hideRetagBanner",
    });
  }

  /**
   * Cleans up and disposes of webview resources when the webview panel is closed.
   */
  public dispose() {
    AnnotationManagerPanel.currentPanel = undefined;

    // Dispose of the current webview panel
    this._panel.dispose();

    // Dispose of all disposables (i.e. commands) for the current webview panel
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Defines and returns the HTML that should be rendered within the webview panel.
   *
   * @param webview A reference to the extension webview
   * @param extensionUri The URI of the directory containing the extension
   * @returns A template string literal containing the HTML that should be
   * rendered within the webview panel
   */
  private _getWebviewContent(webview: Webview, extensionUri: Uri) {
    // The CSS file from the React build output
    const stylesUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "index.css"]);
    // The JS file from the React build output
    const scriptUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "index.js"]);

    const nonce = getNonce();

    // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}  https://*.googleapis.com 'unsafe-eval'; script-src 'nonce-${nonce}' http://localhost:* 'unsafe-eval'; connect-src 'self' http://localhost:*; font-src https://fonts.gstatic.com; ">
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>Annotations</title>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }

  /**
   * Listen for changes to the active text editor and update the webview.
   * @param webview VSCode webview
   */
  private _setActiveTextEditorChangeListener(webview: Webview) {
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        // Load annotations for the new editor
        this._loadAnnotationsForActiveEditor();
      }
    }, null, this._disposables);
  }

  /**
   * Sets up an event listener to listen for messages passed from the webview context and
   * executes code based on the message that is received.
   *
   * @param webview A reference to the extension webview
   */
  private _setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage(
      async (message: any) => {
        const command = message.command;
        const editor = vscode.window.activeTextEditor;
        
        if (!editor) {
          // Most commands require an active editor
          if (command !== "hello" && command !== "lm.chat" && command !== "lm.cancelRequest") {
            window.showErrorMessage("No active text editor found");
            return;
          }
        }

        switch (command) {
          case "hello":
            // Code that should run in response to the hello message command
            window.showInformationMessage(message.text);
            return;
            
          case "addAnnotationConfirm":
            // Add a new annotation to the active document
            const { annotation } = message.data;
            annotationTracker.addAnnotation(editor!.document, annotation);
            return;
            
          case "removeAnnotation":
            // Remove an annotation from the active document
            const { annotationId } = message.data;
            annotationTracker.removeAnnotation(editor!.document, annotationId);
            return;
            
          case "updateAnnotation":
            // Update an existing annotation
            const { updatedAnnotation } = message.data;
            annotationTracker.updateAnnotation(editor!.document, updatedAnnotation);
            return;
            
          case "retagAnnotations":
            // Retag all annotations that need it
            await annotationTracker.retagAnnotations(editor!.document);
            this.hideRetagBanner();
            return;
            
          case "jumpToAnnotation":
            // Jump cursor to annotation location
            const { start, end } = message.data;
            if (editor) {
              const startPos = editor.document.positionAt(start);
              const endPos = editor.document.positionAt(end);
              editor.selection = new vscode.Selection(startPos, endPos);
              editor.revealRange(new vscode.Range(startPos, endPos), vscode.TextEditorRevealType.InCenter);
            }
            return;
            
          case "showErrorMessage":
            // Display error message
            window.showErrorMessage(message.data.error);
            return;
            
          case "lm.chat":
            // Handle chat request via LM API
            await this._lmApiHandler.handleLMRequest(message);
            return;

          case "lm.cancelRequest":
            // Handle cancellation request
            this._lmApiHandler.cancelRequest(message.id);
            return;
            
          case "setAnnotationColor":
            // Set color for the selected annotation
            const { annotationId: id, color } = message.data;
            if (editor) {
              const annotations = annotationTracker.getAnnotationsForDocument(editor.document);
              const annotation = annotations.find((a: Annotation) => a.id === id);
              
              if (annotation) {
                const updated = {
                  ...annotation,
                  metadata: {
                    ...annotation.metadata,
                    color
                  }
                };
                
                annotationTracker.updateAnnotation(editor.document, updated);
              }
            }
            return;
        }
      },
      undefined,
      this._disposables
    );
  }

  /**
   * Sends a message to the webview context.
   *
   * @param message The message to be sent to the webview context
   */
  public sendMessageObject(message: any) {
    // Assume message is an object
    this._panel.webview.postMessage(JSON.stringify(message));
  }
}

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codetations-annotations";

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, "out"),
        vscode.Uri.joinPath(this._extensionUri, "webview-ui/build"),
      ],
    };

    webviewView.webview.html = this._getWebviewContent(webviewView.webview, this._extensionUri);

    // Reuse message handling logic from HelloWorldPanel
    this._setWebviewMessageListener(webviewView.webview);
  }

  private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
    const stylesUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "index.css"]);
    const scriptUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "index.js"]);

    const nonce = getNonce();

    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>Codetations</title>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }

  private _setWebviewMessageListener(webview: vscode.Webview) {
    // Implement message handling similar to AnnotationManagerPanel
    webview.onDidReceiveMessage(
      async (message: any) => {
        const command = message.command;
        
        switch (command) {
          case "hello":
            window.showInformationMessage(message.text);
            return;
            
          // Add sidebar-specific message handling here
          
          case "showErrorMessage":
            window.showErrorMessage(message.data.error);
            return;
        }
      }
    );
  }
}