import { Disposable, Webview, WebviewPanel, window, Uri, ViewColumn } from "vscode";
import { getUri } from "../utilities/getUri";
import { getNonce } from "../utilities/getNonce";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ActiveEditorTracker } from "../extension";

/**
 * This class manages the state and behavior of HelloWorld webview panels.
 *
 * It contains all the data and methods for:
 *
 * - Creating and rendering HelloWorld webview panels
 * - Properly cleaning up and disposing of webview resources when the panel is closed
 * - Setting the HTML (and by proxy CSS/JavaScript) content of the webview panel
 * - Setting message listeners so data can be passed between the webview and extension
 */
export class HelloWorldPanel {
  public static currentPanel: HelloWorldPanel | undefined;
  public static tracker: ActiveEditorTracker;
  private readonly _panel: WebviewPanel;
  private _disposables: Disposable[] = [];
  private _isFileEditListenerSet: boolean = false;
  private _isCursorPositionListenerSet: boolean = false;
  private _prevDecorationTypes: vscode.TextEditorDecorationType[] = [];

  /**
   * The HelloWorldPanel class private constructor (called only from the render method).
   *
   * @param panel A reference to the webview panel
   * @param extensionUri The URI of the directory containing the extension
   */
  private constructor(panel: WebviewPanel, extensionUri: Uri) {
    this._panel = panel;

    // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
    // the panel or when the panel is closed programmatically)
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Set the HTML content for the webview panel
    this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);

    // Set an event listener to listen for messages passed from the webview context
    this._setWebviewMessageListener(this._panel.webview);

    // Set an event listener to listen for changes in the active text editor
    this._setActiveTextEditorChangeListener(this._panel.webview);

    // Set an event listener to listen for changes in the cursor position
    this._setCursorChangeListener(this._panel.webview);

    // Set an event listener to listen for changes in the active file
    this._setFileEditListener(this._panel.webview);
  }

  /**
   * Returns the URI of the annotations JSON file for the current document.
   * @param documentURI The URI of the active text editor.
   */
  private static getAnnotationsURI(documentURI: string): string {
    let currentDir = path.dirname(documentURI);
    const annotationsFilename = (dir: string, documentURI: string) => {
      // Get relative path from git root/base dir to the document
      const relPath = path.relative(dir, documentURI);
      // Create the full annotations directory path including subdirectories
      const annotationsDir = path.join(dir, 'codetations', path.dirname(relPath));
      
      // Create all intermediate directories recursively
      fs.mkdirSync(annotationsDir, { recursive: true });
      
      // Return full path including filename
      return path.join(annotationsDir, path.basename(documentURI) + ".annotations.json");
    };
  
    // Look for git root or fallback to document directory
    while (currentDir !== path.parse(currentDir).root) {
      if (fs.existsSync(path.join(currentDir, ".git"))) {
        return annotationsFilename(currentDir, documentURI);
      }
      currentDir = path.dirname(currentDir);
    }
    return annotationsFilename(path.dirname(documentURI), documentURI);
  }

  public addAnnotation(): void {
    const editor = HelloWorldPanel.tracker.getLastNonWebviewEditor();
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

  public removeAnnotation(): void {
    this._panel.webview.postMessage(
      JSON.stringify({
        command: "removeAnnotation",
      })
    );
  }

  public setAnnotationColor(): void {
    // Get the color from the user
    vscode.window.showInputBox({ prompt: "Enter a color" }).then((color) => {
      this._panel.webview.postMessage(
        JSON.stringify({
          command: "setAnnotationColor",
          data: {
            color: color,
          },
        })
      );
    });
  }

  // Function to clear annotations from editor
  public clearDecorations = () => {
    const editor = HelloWorldPanel.tracker.getLastNonWebviewEditor();
    if (!editor) {
      vscode.window.showErrorMessage(
        "Error hiding annotations: no active or previously active text editor"
      );
      return;
    }

    this._prevDecorationTypes.map((type) => {
      editor.setDecorations(type, []);
    });
  };

  /**
   * Renders the current webview panel if it exists otherwise a new webview panel
   * will be created and displayed.
   *
   * @param extensionUri The URI of the directory containing the extension.
   */
  public static render(extensionUri: Uri, retagServerPort: number, fileServerPort: number, tracker: ActiveEditorTracker) {
    if (HelloWorldPanel.currentPanel) {
      // If the webview panel already exists reveal it
      HelloWorldPanel.currentPanel._panel.reveal(ViewColumn.Two, true);
    } else {
      // If a webview panel does not already exist create and show a new one
      const panel = window.createWebviewPanel(
        // Panel view type
        "showHelloWorld",
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

      HelloWorldPanel.currentPanel = new HelloWorldPanel(panel, extensionUri);
      HelloWorldPanel.tracker = tracker;

      // Send the retag server url to the webview
      HelloWorldPanel.currentPanel.sendMessageObject({
        command: "setFileServerURL",
        data: { fileServerURL: `ws://localhost:${fileServerPort}` },
      });

      // Send the retag server url to the webview
      HelloWorldPanel.currentPanel.sendMessageObject({
        command: "setRetagServerURL",
        data: { retagServerURL: `http://localhost:${retagServerPort}/retag` },
      });
      const editor = tracker.getLastNonWebviewEditor();

      if (editor) {
        // Send the file server url to the webview
        HelloWorldPanel.currentPanel.sendMessageObject({
          command: "setDocumentURI",
          data: { documentURI: editor.document.fileName },
        });

        HelloWorldPanel.currentPanel.sendMessageObject({
          command: "setAnnotationsURI",
          data: {
            annotationsURI: path.join(
              HelloWorldPanel.getAnnotationsURI(editor.document.fileName)
            ),
          },
        });
      }
    }
  }

  /**
   * Cleans up and disposes of webview resources when the webview panel is closed.
   */
  public dispose() {
    HelloWorldPanel.currentPanel?.clearDecorations();

    HelloWorldPanel.currentPanel = undefined;

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
   * @remarks This is also the place where references to the React webview build files
   * are created and inserted into the webview HTML.
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
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}  https://*.googleapis.com 'unsafe-eval'; script-src 'nonce-${nonce}' http://localhost:* 'unsafe-eval'; connect-src 'self' ws://localhost:8072/ http://localhost:*; font-src https://fonts.gstatic.com; ">
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>Hello World</title>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }

  private _setFileEditListener(webview: Webview) {
    if (!this._isFileEditListenerSet) {
      vscode.workspace.onDidChangeTextDocument(() => {
        this._panel.webview.postMessage(
          JSON.stringify({
            command: "handleFileEdit",
          })
        );
      });
      this._isFileEditListenerSet = true;
    }
  }

  private _setCursorChangeListener(webview: Webview) {
    if (!this._isCursorPositionListenerSet) {
      vscode.window.onDidChangeTextEditorSelection(() => {
        const editor = HelloWorldPanel.tracker.getLastNonWebviewEditor();
        this._panel.webview.postMessage(
          JSON.stringify({
            command: "handleCursorPositionChange",
            data: {
              position: editor?.document.offsetAt(editor.selection.start),
            },
          })
        );
      });
      this._isCursorPositionListenerSet = true;
    }
  }

  /**
   * Listen for changes to the active text editor and post a message to the webview.
   * @param webview VSCode webview
   */
  private _setActiveTextEditorChangeListener(webview: Webview) {
    vscode.window.onDidChangeActiveTextEditor(() => {
      const editor = HelloWorldPanel.tracker.getLastNonWebviewEditor();
      if (editor) {
        this._panel.webview.postMessage(
          JSON.stringify({
            command: "setDocumentURI",
            data: { documentURI: editor.document.fileName },
          })
        );
        // Find parent directory of documentURI that contains a git repository
        // If there isn't a git repository, use the same directory as the documentURI
        this._panel.webview.postMessage(
          JSON.stringify({
            command: "setAnnotationsURI",
            data: {
              annotationsURI: HelloWorldPanel.getAnnotationsURI(
                editor.document.fileName
              ),
            },
          })
        );
      }
    });
  }

  /**
   * Sets up an event listener to listen for messages passed from the webview context and
   * executes code based on the message that is recieved.
   *
   * @param webview A reference to the extension webview
   * @param context A reference to the extension context
   */
  private _setWebviewMessageListener(webview: Webview) {
    // Function to show annotations
    const updateDecorations = (
      annotations: { start: number; end: number; metadata: { color: "string" } }[]
    ) => {
      const editor = HelloWorldPanel.tracker.getLastNonWebviewEditor();
      if (!editor) {
        window.showErrorMessage(
          "Error showing annotations: no active or previously active text editor"
        );
        return;
      }

      this.clearDecorations();

      // editor.setDecorations(annotationDecorationType, decorations);
      // instead, we create a new decoration type with the color specified in the annotation
      const types: vscode.TextEditorDecorationType[] = [];
      annotations.map((annotation) => {
        const startPos = editor.document.positionAt(annotation.start);
        const endPos = editor.document.positionAt(annotation.end);
        const decorationType = vscode.window.createTextEditorDecorationType({
          backgroundColor: annotation.metadata.color || "rgba(255,255,0,0.3)",
        });
        types.push(decorationType);
        editor.setDecorations(decorationType, [new vscode.Range(startPos, endPos)]);
      });
      this._prevDecorationTypes = types;
    };

    webview.onDidReceiveMessage(
      (message: any) => {
        const command = message.command;

        switch (command) {
          case "hello":
            // Code that should run in response to the hello message command
            window.showInformationMessage(message.text);
            return;
          // Add more switch case statements here as more webview message commands
          // are created within the webview context (i.e. inside media/main.js)
          case "showErrorMessage":
            window.showErrorMessage(message.data.error);
            return;
          case "showAnnotations":
            updateDecorations(message.data.annotations);
            return;
          case "hideAnnotations":
            this.clearDecorations();
            return;
          case "scrollToPosition":
            const editor = HelloWorldPanel.tracker.getLastNonWebviewEditor();
            const position = editor?.document.positionAt(message.data.position);
            if (!position) { return; }
            editor?.revealRange(new vscode.Range(position, position));
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
