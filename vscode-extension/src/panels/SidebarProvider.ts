import * as vscode from "vscode";
import { BaseAnnotationView } from "./BaseAnnotationView";

export class SidebarProvider extends BaseAnnotationView implements vscode.WebviewViewProvider {
  public static readonly viewType = "codetations-annotations";
  private _view?: vscode.WebviewView;

  constructor(extensionUri: vscode.Uri) {
    // We'll initialize the base class in resolveWebviewView when we get the actual webview
    super(undefined as any, extensionUri);
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;
    
    // Re-initialize with the actual webview
    (this as any).webview = webviewView.webview;
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "out"),
        vscode.Uri.joinPath(this.extensionUri, "webview-ui/build"),
      ],
    };

    // Set the HTML content
    webviewView.webview.html = this._getWebviewContent(webviewView.webview, this.extensionUri);
    
    // Set up event listeners - already handled by base class constructor
    // this._setWebviewMessageListener(webviewView.webview);
    // this._setActiveTextEditorChangeListener(webviewView.webview);
    
    // Re-initialize the LMApiHandler with the actual webview
    this._lmApiHandler = new (require("./LMApiHandler").LMApiHandler)(webviewView.webview);
    
    // If there's an active editor, load its annotations
    if (vscode.window.activeTextEditor) {
      this._loadAnnotationsForActiveEditor();
    }
    
    // Handle panel disposal
    webviewView.onDidDispose(() => {
      this.dispose();
    });
  }
}
