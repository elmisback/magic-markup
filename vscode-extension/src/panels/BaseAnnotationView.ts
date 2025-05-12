import { Disposable, Webview, window, Uri } from "vscode";
import { getUri } from "../utilities/getUri";
import { getNonce } from "../utilities/getNonce";
import * as vscode from "vscode";

import { LMApiHandler } from "./LMApiHandler";
import { annotationTracker } from "../extension";
import { Annotation } from "../AnnotationTracker";
import retagUpdate from "../server/retag";

/**
 * Base abstract class for annotation views
 * Contains shared functionality between panel and sidebar views
 */
export abstract class BaseAnnotationView {
  protected _lmApiHandler: LMApiHandler;
  protected _disposables: Disposable[] = [];
  protected _prevTextEditor: vscode.TextEditor | undefined;
  
  // Add a property to store the selected annotation ID
  public selectedAnnotationId: string | undefined;

  /**
   * Constructor for the base annotation view
   * @param webview The webview to use
   */
  constructor(protected readonly webview: Webview, protected readonly extensionUri: Uri) {
    // Initialize the LM API Handler
    this._lmApiHandler = new LMApiHandler(webview);

    // Set previous text editor
    this._prevTextEditor = vscode.window.activeTextEditor;

    // Set event listeners
    this._setWebviewMessageListener(webview);
    this._setActiveTextEditorChangeListener(webview);

    // If there's an active editor, load its annotations
    if (vscode.window.activeTextEditor) {
      this._loadAnnotationsForActiveEditor();
    }
  }

  /**
   * Gets the current editor, falling back to previous editor if current is undefined
   */
  protected _getCurrentEditor(): vscode.TextEditor | undefined {
    return vscode.window.activeTextEditor || this._prevTextEditor;
  }

  /**
   * Loads annotations for the active editor and sends them to the webview
   */
  protected _loadAnnotationsForActiveEditor(): void {
    const editor = this._getCurrentEditor();
    if (!editor) {
      return;
    }

    // Get annotations from the tracker
    const annotations = annotationTracker.getAnnotationsForDocument(editor.document);

    // Get dark mode preference
    const isDarkMode = vscode.workspace.getConfiguration().get('codetations.darkMode', false);

    // Send information to webview
    this.sendMessageObject({
      command: "initialize",
      data: {
        documentUri: editor.document.uri.toString(),
        documentText: editor.document.getText(),
        annotations: annotations,
        isDarkMode: isDarkMode
      },
    });
  }

  /**
   * Get the webview HTML content
   */
  protected _getWebviewContent(webview: Webview, extensionUri: Uri): string {
    // The CSS file from the React build output
    const stylesUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "index.css"]);
    // The JS file from the React build output
    const scriptUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "index.js"]);

    const nonce = getNonce();

    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}  https://*.googleapis.com 'unsafe-eval'; script-src 'nonce-${nonce}' http://localhost:* 'unsafe-eval'; connect-src 'self' http://localhost:*; font-src https://fonts.gstatic.com; img-src * data:;">
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
  protected _setActiveTextEditorChangeListener(webview: Webview) {
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
              position: position,
              selection: {
                start: editor.document.offsetAt(editor.selection.start),
                end: editor.document.offsetAt(editor.selection.end),
              }
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
  protected _setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage(
      async (message: any) => {
        const command = message.command;
        const editor = this._getCurrentEditor();

        if (!editor) {
          // Most commands require an active editor
          if (command !== "hello" && command !== "lm.chat" && command !== "lm.cancelRequest" &&
              command !== "setDarkMode" && command !== "open-external") {
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
            await this._lmApiHandler.handleLMRequest(message);
            return;

          case "lm.cancelRequest":
            // Handle cancellation request
            this._lmApiHandler.cancelRequest(message.id);
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

          case "setDarkMode":
            // Store dark mode preference in extension context
            try {
              // Store the dark mode preference in the extension's global state
              vscode.workspace.getConfiguration().update(
                'codetations.darkMode',
                message.data.isDarkMode,
                vscode.ConfigurationTarget.Global
              );
            } catch (error) {
              console.error("Error saving dark mode preference to extension:", error);
            }
            return;

          case "open-external":
            // Open link in external window
            vscode.env.openExternal(vscode.Uri.parse(message.url));
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
  protected _preprocessAnnotation(annotation: Annotation) {
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
  protected async _retagAnnotation(
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
        window.showErrorMessage("Error retagging annotation: no result returned (maybe all annotation anchor text was deleted?)");
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
    // Implement in child classes
    this.webview.postMessage(JSON.stringify(message));
  }
  
  /**
   * Handles the command to add an annotation from the current selection
   */
  public addAnnotation(): void {
    const editor = this._getCurrentEditor();
    if (!editor) {
      window.showErrorMessage("No active text editor found");
      return;
    }

    this.webview.postMessage(
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
    this.webview.postMessage(
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
        this.webview.postMessage(
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
   * Cleans up and disposes of resources.
   */
  public dispose() {
    // Dispose of all disposables
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
