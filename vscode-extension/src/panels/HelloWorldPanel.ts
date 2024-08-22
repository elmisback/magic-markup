import { Disposable, Webview, WebviewPanel, window, Uri, ViewColumn } from "vscode";
import { getUri } from "../utilities/getUri";
import { getNonce } from "../utilities/getNonce";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

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
  private readonly _panel: WebviewPanel;
  private _disposables: Disposable[] = [];
  private _prevTextEditor: vscode.TextEditor | undefined;
  private _isFileEditListenerSet: boolean = false;

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

    // Set an event listener to listen for changes in the active file
    this._setFileEditListener(this._panel.webview);

    // Set previous text editor
    this._prevTextEditor = vscode.window.activeTextEditor;
  }

  /**
   * Returns the URI of the annotations JSON file for the current document.
   * @param documentURI The URI of the active text editor.
   */
  private static getAnnotationsURI(documentURI: string): string {
    let currentDir = path.dirname(documentURI);
    const annotationsFilename = (dir: string, documentURI: string) => {
      const annotationsDir = path.join(dir, "codetations");
      if (!fs.existsSync(annotationsDir)) {
        fs.mkdirSync(annotationsDir);
      }
      return path.join(annotationsDir, path.basename(documentURI) + ".annotations.json");
    };
    while (currentDir !== path.parse(currentDir).root) {
      if (fs.existsSync(path.join(currentDir, ".git"))) {
        return annotationsFilename(currentDir, documentURI);
        //return path.join(currentDir, 'codetations', path.basename(documentURI) + ".annotations.json");
      }
      currentDir = path.dirname(currentDir);
    }
    return annotationsFilename(path.dirname(documentURI), documentURI);
    //return path.join(path.dirname(documentURI), 'codetations', path.basename(documentURI) + ".annotations.json");
  }

  public addAnnotation(): void {
    const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
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
    const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
    this._panel.webview.postMessage(
      JSON.stringify({
        command: "removeAnnotation",
        data: {
          start: editor?.document.offsetAt(editor.selection.start),
          end: editor?.document.offsetAt(editor.selection.end),
        },
      })
    );
  }

  /**
   * Renders the current webview panel if it exists otherwise a new webview panel
   * will be created and displayed.
   *
   * @param extensionUri The URI of the directory containing the extension.
   */
  public static render(extensionUri: Uri, retagServerPort: number, fileServerPort: number) {
    if (HelloWorldPanel.currentPanel) {
      // If the webview panel already exists reveal it
      HelloWorldPanel.currentPanel._panel.reveal(ViewColumn.Two, true);
    } else {
      // If a webview panel does not already exist create and show a new one
      const panel = window.createWebviewPanel(
        // Panel view type
        "showHelloWorld",
        // Panel title
        "Hello World",
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

      if (vscode.window.activeTextEditor) {
        // Send the file server url to the webview
        HelloWorldPanel.currentPanel.sendMessageObject({
          command: "setDocumentURI",
          data: { documentURI: vscode.window.activeTextEditor?.document.fileName },
        });

        HelloWorldPanel.currentPanel.sendMessageObject({
          command: "setAnnotationsURI",
          data: {
            annotationsURI: path.join(
              HelloWorldPanel.getAnnotationsURI(vscode.window.activeTextEditor?.document.fileName)
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
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}' http://localhost:*; connect-src 'self' ws://localhost:8072/ http://localhost:*; ">
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

  /**
   * Listen for changes to the active text editor and post a message to the webview.
   * @param webview VSCode webview
   */
  private _setActiveTextEditorChangeListener(webview: Webview) {
    vscode.window.onDidChangeActiveTextEditor(() => {
      if (vscode.window.activeTextEditor) {
        this._panel.webview.postMessage(
          JSON.stringify({
            command: "setDocumentURI",
            data: { documentURI: vscode.window.activeTextEditor?.document.fileName },
          })
        );
        this._prevTextEditor = vscode.window.activeTextEditor;
        // Find parent directory of documentURI that contains a git repository
        // If there isn't a git repository, use the same directory as the documentURI
        this._panel.webview.postMessage(
          JSON.stringify({
            command: "setAnnotationsURI",
            data: {
              annotationsURI: HelloWorldPanel.getAnnotationsURI(
                vscode.window.activeTextEditor?.document.fileName
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
    // Create a decoration type
    const annotationDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: "rgba(255,255,0,0.3)", // Yellow highlight with some transparency
    });
    // Function to show annotations
    const updateDecorations = (annotations: { start: number; end: number }[]) => {
      const editor = vscode.window.activeTextEditor || this._prevTextEditor;
      if (!editor) {
        window.showErrorMessage(
          "Error showing annotations: no active or previously active text editor"
        );
        return;
      }

      const decorations: vscode.DecorationOptions[] = annotations.map((annotation) => {
        const startPos = editor.document.positionAt(annotation.start);
        const endPos = editor.document.positionAt(annotation.end);
        return { range: new vscode.Range(startPos, endPos) };
      });

      editor.setDecorations(annotationDecorationType, decorations);
    };

    // Function to clear annotations from editor
    const clearDecorations = () => {
      console.log("Clearing decorations");
      const editor = vscode.window.activeTextEditor || this._prevTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage(
          "Error hiding annotations: no active or previously active text editor"
        );
        return;
      }

      editor.setDecorations(annotationDecorationType, []);
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
            clearDecorations();
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
