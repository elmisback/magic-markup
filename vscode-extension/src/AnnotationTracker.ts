import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { AnnotationManagerPanel } from "./panels/AnnotationManagerPanel";
export interface Annotation {
  // HACK this just duplicates "../webview-ui/src/Annotation.tsx"
  id: string;
  start: number;
  end: number;
  document: string;
  tool: string;
  metadata: { [key: string]: any };
  original: {
    document: string;
    start: number;
    end: number;
  };
}

interface AnnotationState {
  annotations: Annotation[];
}

export class AnnotationTracker implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private documentAnnotations: Map<string, Annotation[]> = new Map();
  private decorationTypes: Map<string, vscode.TextEditorDecorationType[]> = new Map();
  private fileChangeTimers: Map<string, NodeJS.Timeout> = new Map();
  private skipNextDocumentChanges: boolean = false;
  
  constructor(private context: vscode.ExtensionContext) {
    // Setup buffer change listeners
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(this.onDocumentChanged, this),
      vscode.window.onDidChangeActiveTextEditor(this.onActiveEditorChanged, this)
    );
    
    // Load initial annotations if there's an active editor
    if (vscode.window.activeTextEditor) {
      this.loadAnnotationsForDocument(vscode.window.activeTextEditor.document);
    }
  }

  /**
   * Loads annotations for the given document from the associated annotations file
   */
  public async loadAnnotationsForDocument(document: vscode.TextDocument): Promise<Annotation[]> {
    const documentKey = document.uri.toString();
    const annotationsUri = this.getAnnotationsFilePath(document.uri.fsPath);
    
    try {
      // Check if file exists
      if (fs.existsSync(annotationsUri)) {
        const content = fs.readFileSync(annotationsUri, "utf8");
        const state = JSON.parse(content) as AnnotationState;
        
        // Store annotations for this document
        this.documentAnnotations.set(documentKey, state.annotations);
        
        // Update decorations
        this.updateDecorations(document);
        
        // Notify the webview if it's open
        this.notifyAnnotationsChanged(document);
        
        return state.annotations;
      } else {
        // No annotations file yet
        this.documentAnnotations.set(documentKey, []);
        return [];
      }
    } catch (error) {
      console.error(`Error loading annotations for ${documentKey}:`, error);
      this.documentAnnotations.set(documentKey, []);
      return [];
    }
  }

  /**
   * Saves annotations for the given document to the associated annotations file
   */
  public async saveAnnotationsForDocument(document: vscode.TextDocument): Promise<void> {
    const documentKey = document.uri.toString();
    const annotations = this.documentAnnotations.get(documentKey) || [];
    const annotationsUri = this.getAnnotationsFilePath(document.uri.fsPath);

    // Ensure directory exists
    const dir = path.dirname(annotationsUri);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write annotations to file
    const state: AnnotationState = { annotations };
    fs.writeFileSync(annotationsUri, JSON.stringify(state, null, 2), "utf8");
  }

  /**
   * Handler for document changes - updates annotation positions
   */
  private onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
    // Skip if we're in the middle of a programmatic edit or if document is not loaded
    if (this.skipNextDocumentChanges || !this.documentAnnotations.has(event.document.uri.toString())) {
      return;
    }

    // Debounce changes to prevent excessive processing
    const docKey = event.document.uri.toString();
    if (this.fileChangeTimers.has(docKey)) {
      clearTimeout(this.fileChangeTimers.get(docKey)!);
    }

    this.fileChangeTimers.set(docKey, setTimeout(() => {
      this.updateAnnotationPositions(event.document, event.contentChanges);
      this.fileChangeTimers.delete(docKey);
    }, 50)); // Small delay to batch multiple quick edits
  }

  /**
   * Updates annotation positions based on document changes
   */
  private updateAnnotationPositions(
    document: vscode.TextDocument, 
    changes: readonly vscode.TextDocumentContentChangeEvent[]
  ): void {
    const documentKey = document.uri.toString();
    const annotations = this.documentAnnotations.get(documentKey);
    
    if (!annotations || annotations.length === 0) {
      return; // No annotations to update
    }

    let updatedAnnotations = [...annotations];
    let documentModified = false;
    
    // Process each change to update annotation positions
    for (const change of changes) {
      const startOffset = change.rangeOffset;
      const endOffset = change.rangeOffset + change.rangeLength;
      const textLengthDiff = change.text.length - change.rangeLength;

      documentModified = true;

      // Update annotations based on the change
      updatedAnnotations = updatedAnnotations.map(annotation => {
        // Case 1: Annotation is completely before the change
        if (annotation.end <= startOffset) {
          return annotation; // No adjustment needed
        }
        
        // Case 2: Annotation is completely after the change
        if (annotation.start >= endOffset) {
          // Shift the annotation by the difference in text length
          return {
            ...annotation,
            start: annotation.start + textLengthDiff,
            end: annotation.end + textLengthDiff,
            document: document.getText(),
          };
        }
        
        // Case 3: Annotation overlaps with the change - needs more complex handling
        // For these cases, we update nothing, the frontend will warn the user
        // TODO confirm that non-update is handled correctly elsewhere (e.g. for decorations)
        return annotation;
      });
    }

    if (documentModified) {
      // Update the document's annotations
      this.documentAnnotations.set(documentKey, updatedAnnotations);
      
      // Update decorations
      this.updateDecorations(document);
      
      // Notify the webview
      this.notifyAnnotationsChanged(document);
    }
  }

  /**
   * Updates the decorations in the editor
   */
  private updateDecorations(document: vscode.TextDocument): void {
    const documentKey = document.uri.toString();
    const annotations = this.documentAnnotations.get(documentKey) || [];
    
    // Clear existing decorations
    this.clearDecorations(documentKey);
    
    // Find editors displaying this document
    const editors = vscode.window.visibleTextEditors.filter(
      editor => editor.document.uri.toString() === documentKey
    );
    
    if (editors.length === 0) {
      return; // No visible editor for this document
    }
    
    const decorations: vscode.TextEditorDecorationType[] = [];
    
    // Create and apply decorations for each annotation
    for (const annotation of annotations) {
      // TODO if the document text doesn't match the annotation's document, skip
      try {
        // Create a decoration type with the annotation's style
        const decorationType = vscode.window.createTextEditorDecorationType({
          backgroundColor: annotation.metadata?.color || "rgba(255,255,0,0.3)",
        });
        
        // Create the decoration range
        const startPos = document.positionAt(annotation.start);
        const endPos = document.positionAt(annotation.end);
        const range = new vscode.Range(startPos, endPos);
        
        // Apply to all editors
        for (const editor of editors) {
          editor.setDecorations(decorationType, [range]);
        }
        
        decorations.push(decorationType);
      } catch (error) {
        console.error("Error creating decoration:", error);
      }
    }
    
    // Store the new decoration types
    this.decorationTypes.set(documentKey, decorations);
  }

  /**
   * Clears decorations for a document
   */
  private clearDecorations(documentKey: string): void {
    const types = this.decorationTypes.get(documentKey);
    if (!types) return;
    
    for (const type of types) {
      type.dispose();
    }
    
    this.decorationTypes.set(documentKey, []);
  }

  /**
   * Handler for active editor changes
   */
  private onActiveEditorChanged(editor: vscode.TextEditor | undefined): void {
    if (!editor) return;
    
    // Load annotations for the new editor
    this.loadAnnotationsForDocument(editor.document);
  }

  /**
   * Notifies the annotation panel of changed annotations
   */
  private notifyAnnotationsChanged(document: vscode.TextDocument): void {
    if (AnnotationManagerPanel.currentPanel) {
      const documentKey = document.uri.toString();
      const annotations = this.documentAnnotations.get(documentKey) || [];
      
      AnnotationManagerPanel.currentPanel.sendMessageObject({
        command: "updateAnnotations",
        data: {
          documentUri: document.uri.toString(),
          annotations,
          documentText: document.getText()
        }
      });
    }
  }

  /**
   * Gets the path to the annotations file for a document
   */
  private getAnnotationsFilePath(documentPath: string): string {
    let currentDir = path.dirname(documentPath);
    
    // Look for git root or fall back to document directory
    while (currentDir !== path.parse(currentDir).root) {
      if (fs.existsSync(path.join(currentDir, ".git"))) {
        break;
      }
      currentDir = path.dirname(currentDir);
    }
    
    // Create the relative path for annotations
    const relPath = path.relative(currentDir, documentPath);
    const annotationsDir = path.join(currentDir, 'codetations', path.dirname(relPath));
    
    // Ensure directory exists
    if (!fs.existsSync(annotationsDir)) {
      fs.mkdirSync(annotationsDir, { recursive: true });
    }
    
    // Return full path to annotations file
    return path.join(annotationsDir, path.basename(documentPath) + ".annotations.json");
  }

  /**
   * Adds a new annotation for the given document
   */
  public addAnnotation(document: vscode.TextDocument, annotation: Annotation): void {
    const documentKey = document.uri.toString();
    const annotations = this.documentAnnotations.get(documentKey) || [];
    
    // Add the new annotation
    const updatedAnnotations = [...annotations, annotation];
    this.documentAnnotations.set(documentKey, updatedAnnotations);
    
    // Update decorations and save
    this.updateDecorations(document);
    this.saveAnnotationsForDocument(document);
    this.notifyAnnotationsChanged(document);
  }

  /**
   * Removes an annotation by ID
   */
  public removeAnnotation(document: vscode.TextDocument, annotationId: string): void {
    const documentKey = document.uri.toString();
    const annotations = this.documentAnnotations.get(documentKey) || [];
    
    // Filter out the annotation to remove
    const updatedAnnotations = annotations.filter(a => a.id !== annotationId);
    this.documentAnnotations.set(documentKey, updatedAnnotations);
    
    // Update decorations and save
    this.updateDecorations(document);
    this.saveAnnotationsForDocument(document);
    this.notifyAnnotationsChanged(document);
  }

  /**
   * Updates an existing annotation
   */
  public updateAnnotation(document: vscode.TextDocument, updatedAnnotation: Annotation): void {
    const documentKey = document.uri.toString();
    const annotations = this.documentAnnotations.get(documentKey) || [];
    
    // Update the annotation
    const updatedAnnotations = annotations.map(a => 
      a.id === updatedAnnotation.id ? updatedAnnotation : a
    );
    
    this.documentAnnotations.set(documentKey, updatedAnnotations);
    
    // Update decorations and save
    this.updateDecorations(document);
    this.saveAnnotationsForDocument(document);
    this.notifyAnnotationsChanged(document);
  }

  /**
   * Returns annotations for a document
   */
  public getAnnotationsForDocument(document: vscode.TextDocument): Annotation[] {
    const documentKey = document.uri.toString();
    return this.documentAnnotations.get(documentKey) || [];
  }

  public dispose(): void {
    // Dispose all decoration types
    for (const types of this.decorationTypes.values()) {
      for (const type of types) {
        type.dispose();
      }
    }
    
    // Clear timers
    for (const timer of this.fileChangeTimers.values()) {
      clearTimeout(timer);
    }
    
    // Dispose other resources
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}