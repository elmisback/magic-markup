import { Disposable, Webview, WebviewPanel, window, Uri, ViewColumn } from "vscode";
import { getUri } from "../utilities/getUri";
import { getNonce } from "../utilities/getNonce";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

import { LMApiHandler } from "./LMApiHandler";
import { annotationTracker } from "../extension";
import { Annotation } from "../AnnotationTracker";
import retagUpdate from "../server/retag";
import { BaseAnnotationView } from "./BaseAnnotationView";

/**
 * This class manages the state and behavior of annotation manager webview panels.
 * Extends the base annotation view class.
 */
export class AnnotationManagerPanel extends BaseAnnotationView {
  public static currentPanel: AnnotationManagerPanel | undefined;
  private readonly _panel: WebviewPanel;
  // Add property to track selected annotation ID
  public selectedAnnotationId: string | undefined;

  /**
   * The AnnotationManagerPanel class private constructor (called only from the render method).
   *
   * @param panel A reference to the webview panel
   * @param extensionUri The URI of the directory containing the extension
   */
  private constructor(panel: WebviewPanel, extensionUri: Uri) {
    super(panel.webview, extensionUri);
    this._panel = panel;

    // Set an event listener to listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Set the HTML content for the webview panel
    this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);
  }

  /**
   * Renders the current webview panel if it exists otherwise a new webview panel
   * will be created and displayed.
   *
   * @param extensionUri The URI of the directory containing the extension.
   */
  public static render(extensionUri: Uri) {
    if (AnnotationManagerPanel.currentPanel) {
      // If the webview panel already exists reveal it
      AnnotationManagerPanel.currentPanel._panel.reveal(ViewColumn.Two, true);
    } else {
      // If a webview panel does not already exist create and show a new one
      const panel = window.createWebviewPanel(
        "showAnnotations",
        "Codetations",
        { viewColumn: ViewColumn.Two, preserveFocus: true },
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            Uri.joinPath(extensionUri, "out"),
            Uri.joinPath(extensionUri, "webview-ui/build"),
          ],
        }
      );

      AnnotationManagerPanel.currentPanel = new AnnotationManagerPanel(
        panel,
        extensionUri
      );
    }
  }

  /**
   * Cleans up and disposes of webview resources when the webview panel is closed.
   * Overrides the base dispose method.
   */
  public dispose() {
    AnnotationManagerPanel.currentPanel = undefined;
    
    // Dispose of the current webview panel
    this._panel.dispose();
    
    // Call the parent dispose method
    super.dispose();
  }

  /**
   * Moves the currently selected annotation to the currently selected text range in the editor
   */
  public moveSelectedAnnotation(): void {
    // Check if there's a selected annotation
    if (!this.selectedAnnotationId) {
      vscode.window.showErrorMessage("No annotation is selected to move.");
      return;
    }

    const editor = vscode.window.activeTextEditor;
    // Check if there's an active editor
    if (!editor) {
      vscode.window.showErrorMessage("No active editor found.");
      return;
    }

    // Check if there's any text selected
    if (editor.selection.isEmpty) {
      vscode.window.showErrorMessage("Please select some text as the new target location.");
      return;
    }

    // Get start and end offsets
    const startOffset = editor.document.offsetAt(editor.selection.start);
    const endOffset = editor.document.offsetAt(editor.selection.end);

    // Use the annotation tracker to move the annotation
    annotationTracker.moveAnnotation(
      editor.document,
      this.selectedAnnotationId,
      startOffset,
      endOffset
    );
  }
}

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codetations-annotations";
  private _view?: vscode.WebviewView;
  private _disposables: Disposable[] = [];
  private _prevTextEditor: vscode.TextEditor | undefined;
  private _lmApiHandler: LMApiHandler | undefined;
  // Add a property to store the selected annotation ID
  public selectedAnnotationId: string | undefined;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;
    
    webviewView.webview.options = {
      enableScripts: true,
      // retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, "out"),
        vscode.Uri.joinPath(this._extensionUri, "webview-ui/build"),
      ],
    };

    // Initialize the LM API Handler
    this._lmApiHandler = new LMApiHandler(webviewView.webview);

    webviewView.webview.html = this._getWebviewContent(webviewView.webview, this._extensionUri);

    // Set an event listener to listen for messages passed from the webview context
    this._setWebviewMessageListener(webviewView.webview);

    // Set an event listener to listen for changes in the active text editor
    this._setActiveTextEditorChangeListener(webviewView.webview);

    // Set previous text editor
    this._prevTextEditor = vscode.window.activeTextEditor;

    // If there's an active editor, load its annotations
    if (vscode.window.activeTextEditor) {
      this._loadAnnotationsForActiveEditor();
    }
    
    // Handle panel disposal
    webviewView.onDidDispose(() => {
      while (this._disposables.length) {
        const disposable = this._disposables.pop();
        if (disposable) {
          disposable.dispose();
        }
      }
    });
  }

  /**
   * Gets the current editor, falling back to previous editor if current is undefined
   */
  private _getCurrentEditor(): vscode.TextEditor | undefined {
    return vscode.window.activeTextEditor || this._prevTextEditor;
  }

  /**
   * Loads annotations for the active editor and sends them to the webview
   */
  private _loadAnnotationsForActiveEditor(): void {
    const editor = this._getCurrentEditor();
    if (!editor || !this._view) {
      return;
    }

    // Get annotations from the tracker
    const annotations = annotationTracker.getAnnotationsForDocument(editor.document);

    // Send information to webview
    this.sendMessageObject({
      command: "initialize",
      data: {
        documentUri: editor.document.uri.toString(),
        documentText: editor.document.getText(),
        annotations: annotations
      },
    });
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
   */
  private _setActiveTextEditorChangeListener(webview: vscode.Webview) {
    vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        if (editor) {
          // Update the previous editor reference
          this._prevTextEditor = editor;

          // Load annotations for the new editor
          this._loadAnnotationsForActiveEditor();
        }
      },
      null,
      this._disposables
    );
    
    // Add selection change listener to track cursor position
    vscode.window.onDidChangeTextEditorSelection(
      (event) => {
        const editor = event.textEditor;
        if (editor) {
          // Get the cursor position as character offset
          const position = editor.document.offsetAt(editor.selection.active);
          
          // Send the cursor position to the webview
          this.sendMessageObject({
            command: "handleCursorPositionChange",
            data: {
              position: position
            }
          });
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Sets up an event listener to listen for messages passed from the webview context
   */
  private _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      async (message: any) => {
        const command = message.command;
        const editor = this._getCurrentEditor();

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
            if (!editor) {
              window.showErrorMessage("No active text editor found");
              return;
            }
            const { annotation: newAnnotation } = message.data;
            annotationTracker.addAnnotation(editor.document, newAnnotation);
            return;

          case "removeAnnotation":
            // Remove an annotation from the active document
            if (!editor) {
              window.showErrorMessage("No active text editor found");
              return;
            }
            const { annotationId } = message.data;
            annotationTracker.removeAnnotation(editor.document, annotationId);
            return;

          case "updateAnnotation":
            // Update an existing annotation
            if (!editor) {
              window.showErrorMessage("No active text editor found");
              return;
            }
            const { updatedAnnotation } = message.data;
            annotationTracker.updateAnnotation(editor.document, updatedAnnotation);
            return;

          case "retagAnnotations":
            // Retag annotations in the active document
            this.retagAnnotations();
            return;
            
          case "setSelectedAnnotationId":
            // Set the selected annotation ID
            if (!editor) {
              window.showErrorMessage("No active text editor found");
              return;
            }
            this.selectedAnnotationId = message.data.annotationId;
            annotationTracker.updateDecorations(editor.document);
            return;

          case "jumpToAnnotation":
            // Jump cursor to annotation location
            if (!editor) {
              window.showErrorMessage("No active text editor found");
              return;
            }
            const { start, end } = message.data;
            const startPos = editor.document.positionAt(start);
            const endPos = editor.document.positionAt(end);
            editor.selection = new vscode.Selection(startPos, endPos);
            editor.revealRange(
              new vscode.Range(startPos, endPos),
              vscode.TextEditorRevealType.InCenter
            );
            return;

          case "showErrorMessage":
            // Display error message
            window.showErrorMessage(message.data.error);
            return;

          case "lm.chat":
            // Handle chat request via LM API
            if (this._lmApiHandler) {
              await this._lmApiHandler.handleLMRequest(message);
            }
            return;

          case "lm.cancelRequest":
            // Handle cancellation request
            if (this._lmApiHandler) {
              this._lmApiHandler.cancelRequest(message.id);
            }
            return;

          case "setAnnotationColor":
            // Set color for the selected annotation
            if (!editor) {
              window.showErrorMessage("No active text editor found");
              return;
            }
            const { annotationId: id, color } = message.data;
            const annotations = annotationTracker.getAnnotationsForDocument(editor.document);
            const annotation = annotations.find((a) => a.id === id);

            if (annotation) {
              const updated = {
                ...annotation,
                metadata: {
                  ...annotation.metadata,
                  color,
                },
              };

              annotationTracker.updateAnnotation(editor.document, updated);
            }
            return;
        }
      },
      undefined,
      this._disposables
    );
  }

  /**
   * Preprocesses an annotation for retagging
   */
  private _preprocessAnnotation(annotation: Annotation) {
    const oldDocumentContent = annotation.document;
    const codeUpToSnippet = oldDocumentContent.slice(0, annotation.start);
    const codeAfterSnippet = oldDocumentContent.slice(annotation.end);
    const annotationText = oldDocumentContent.slice(annotation.start, annotation.end);
    const delimiter = "★";
    const codeWithSnippetDelimited =
      codeUpToSnippet + delimiter + annotationText + delimiter + codeAfterSnippet;

    return {
      codeWithSnippetDelimited,
      delimiter,
    };
  }

  /**
   * Retags a single annotation by calculating its new position in the updated document
   */
  private async _retagAnnotation(
    annotation: Annotation,
    currentDocumentText: string
  ): Promise<Annotation> {
    const { codeWithSnippetDelimited, delimiter } = this._preprocessAnnotation(annotation);

    try {
      // Get the API key from settings
      const apiKey = vscode.workspace.getConfiguration().get("codetations.apiKey") as string;

      // Use the retagUpdate function to get the new positions
      const result = await retagUpdate(
        codeWithSnippetDelimited,
        currentDocumentText,
        delimiter
      );
      if (!result.out) {
        window.showErrorMessage("Error retagging annotation: no result returned");
        console.error("Error retagging annotation: no result returned");
        console.error(codeWithSnippetDelimited);
        return annotation;
      }

      // Update the annotation with the new positions
      return {
        ...annotation,
        document: currentDocumentText,
        start: result.out.leftIdx,
        end: result.out.rightIdx,
      };
    } catch (error) {
      console.error("Error retagging annotation:", error);
      window.showErrorMessage(`Error retagging annotation: ${error}`);
      return annotation; // Return original annotation on error
    }
  }

  /**
   * Handles the command to retag annotations (update their positions after document changes)
   */
  public async retagAnnotations(): Promise<void> {
    const editor = this._getCurrentEditor();
    if (!editor) {
      window.showErrorMessage("No active text editor found");
      return;
    }

    const currentDocumentText = editor.document.getText();
    const annotations = annotationTracker.getAnnotationsForDocument(editor.document);

    // Show progress notification
    window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Retagging annotations...",
        cancellable: false,
      },
      async (progress) => {
        try {
          // Update progress as we process each annotation
          const total = annotations.length;
          let processed = 0;

          // Retag all annotations
          const updatedAnnotations = await Promise.all(
            annotations.map(async (annotation) => {
              // HACK -- if the annotation is empty, use the original positions
              if (annotation.start === annotation.end) {
                annotation.document = annotation.original.document;
                annotation.start = annotation.original.start;
                annotation.end = annotation.original.end;
              }
              if (annotation.document === currentDocumentText) { return annotation; }
              const retagged = await this._retagAnnotation(annotation, currentDocumentText);
              processed++;
              progress.report({
                message: `Processed ${processed}/${total} annotations`,
                increment: (1 / total) * 100,
              });
              return retagged;
            })
          );

          // Update all annotations at once
          annotations.forEach((oldAnnotation, index) => {
            annotationTracker.updateAnnotation(editor.document, updatedAnnotations[index]);
          });

          // Notify webview of the updated annotations
          this._loadAnnotationsForActiveEditor();

          return true;
        } catch (error) {
          console.error("Error retagging annotations:", error);
          window.showErrorMessage(`Error retagging annotations: ${error}`);
          return false;
        }
      }
    );
  }

  /**
   * Sends a message to the webview context.
   */
  public sendMessageObject(message: any) {
    if (this._view) {
      this._view.webview.postMessage(JSON.stringify(message));
    }
  }
  
  /**
   * Handles the command to add an annotation from the current selection
   */
  public addAnnotation(): void {
    const editor = this._getCurrentEditor();
    if (!editor || !this._view) {
      window.showErrorMessage("No active text editor found");
      return;
    }

    this._view.webview.postMessage(
      JSON.stringify({
        command: "addAnnotation",
        data: {
          start: editor.document.offsetAt(editor.selection.start),
          end: editor.document.offsetAt(editor.selection.end),
        },
      })
    );
  }

  /**
   * Handles the command to remove the selected annotation
   */
  public removeAnnotation(): void {
    if (!this._view) return;
    
    this._view.webview.postMessage(
      JSON.stringify({
        command: "removeAnnotation",
      })
    );
  }

  /**
   * Handles the command to set the color of the selected annotation
   */
  public setAnnotationColor(): void {
    if (!this._view) return;
    
    // Get the color from the user
    vscode.window.showInputBox({ prompt: "Enter a color" }).then((color) => {
      if (color && this._view) {
        this._view.webview.postMessage(
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
}