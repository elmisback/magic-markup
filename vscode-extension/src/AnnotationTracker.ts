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
  
  // Store the document content cache
  private documentContentCache = new Map<string, string>();
  
  // Track accumulated changes for proper position updates
  private pendingChanges = new Map<string, vscode.TextDocumentContentChangeEvent[]>();
  
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
   * Handler for document changes - collects changes for batch processing
   */
  private onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
    // Skip if document is not loaded
    if (!this.documentAnnotations.has(event.document.uri.toString())) {
      return;
    }

    const docKey = event.document.uri.toString();
    
    // Initialize document content cache if not already set
    if (!this.documentContentCache.has(docKey)) {
      this.documentContentCache.set(docKey, event.document.getText());
      return;
    }
    
    // Collect changes for this document
    let pendingChanges = this.pendingChanges.get(docKey) || [];
    pendingChanges = [...pendingChanges, ...event.contentChanges];
    this.pendingChanges.set(docKey, pendingChanges);
    
    // Debounce the processing of changes
    if (this.fileChangeTimers.has(docKey)) {
      clearTimeout(this.fileChangeTimers.get(docKey)!);
    }

    this.fileChangeTimers.set(docKey, setTimeout(() => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.uri.toString() !== docKey) {
        console.error("Editor not active or document not loaded");
        this.pendingChanges.delete(docKey);
        this.fileChangeTimers.delete(docKey);
        return;
      }
      
      // Process all accumulated changes at once
      this.processAccumulatedChanges(editor.document);
      
      // Update cache and cleanup
      this.documentContentCache.set(docKey, editor.document.getText());
      this.pendingChanges.delete(docKey);
      this.fileChangeTimers.delete(docKey);
    }, 100));
  }

  /**
   * Process all accumulated changes for a document
   */
  private processAccumulatedChanges(document: vscode.TextDocument): void {
    const documentKey = document.uri.toString();
    const annotations = this.documentAnnotations.get(documentKey);
    const changes = this.pendingChanges.get(documentKey) || [];
    
    if (!annotations || annotations.length === 0 || changes.length === 0) {
      return;
    }
    
    // Get the cached document content before any changes
    const startingContent = this.documentContentCache.get(documentKey)!;
    const currentContent = document.getText();
    
    // Skip if no actual change occurred
    if (startingContent === currentContent) {
      return;
    }
    
    // Create working copies of annotations that we can update
    // These working copies will maintain their position references relative to startingContent
    let workingAnnotations = annotations.map(ann => ({...ann}));
    
    // Track if any annotations were modified
    let annotationsModified = false;
    
    // Apply each change one by one to compute the new positions
    for (const change of changes) {
      const startOffset = change.rangeOffset;
      const endOffset = change.rangeOffset + change.rangeLength;
      const textLengthDiff = change.text.length - change.rangeLength;
      
      for (let i = 0; i < workingAnnotations.length; i++) {
        const annotation = workingAnnotations[i];
        
        // Only update annotations that are synced with our starting document content
        if (annotation.document !== startingContent) {
          continue;
        }
        
        // Case 1: Annotation is completely before the change - no position change
        if (annotation.end <= startOffset) {
          // No position change needed
          continue;
        }
        
        // Case 2: Annotation is completely after the change - shift both start and end
        if (annotation.start >= endOffset) {
          annotation.start += textLengthDiff;
          annotation.end += textLengthDiff;
          annotationsModified = true;
          continue;
        }
        
        // Case 3: Change affects the annotation - needs special handling
        // Various overlap scenarios are possible
        
        // 3a: Change starts before annotation and completely contains it
        if (startOffset <= annotation.start && endOffset >= annotation.end) {
          // Annotation is completely replaced or deleted
          // Special case: if the new text is empty or very small, the annotation might be effectively deleted
          if (change.text.length === 0) {
            annotation.start = startOffset;
            annotation.end = startOffset;
          } else {
            // Try to preserve the annotation at the start of the new text
            annotation.start = startOffset;
            annotation.end = startOffset + Math.min(change.text.length, annotation.end - annotation.start);
          }
          annotationsModified = true;
          continue;
        }
        
        // 3b: Change starts before annotation but ends within it
        if (startOffset <= annotation.start && endOffset > annotation.start && endOffset < annotation.end) {
          // The beginning of the annotation is affected
          const newStart = startOffset + change.text.length;
          const charsRemoved = annotation.start - startOffset;
          const charsRemaining = annotation.end - endOffset;
          
          annotation.start = newStart;
          annotation.end = newStart + charsRemaining;
          annotationsModified = true;
          continue;
        }
        
        // 3c: Change is completely inside the annotation
        if (startOffset > annotation.start && endOffset < annotation.end) {
          // Only the length changes
          annotation.end += textLengthDiff;
          annotationsModified = true;
          continue;
        }
        
        // 3d: Change starts inside annotation and extends beyond it
        if (startOffset >= annotation.start && startOffset < annotation.end && endOffset >= annotation.end) {
          // End of annotation is affected
          annotation.end = startOffset + change.text.length;
          annotationsModified = true;
          continue;
        }
      }
    }
    
    // If annotations were modified, update them all with the current document content
    if (annotationsModified) {
      const finalAnnotations = workingAnnotations.map(ann => ({
        ...ann,
        document: currentContent
      }));
      
      // Update the document's annotations
      this.documentAnnotations.set(documentKey, finalAnnotations);
      
      // Update decorations, save, and notify
      this.updateDecorations(document);
      this.saveAnnotationsForDocument(document);
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
      // Skip if the document text doesn't match the annotation's document
      if (annotation.document !== document.getText()) {
        continue;
      }
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
    if (!types) {return;}
    
    for (const type of types) {
      type.dispose();
    }
    
    this.decorationTypes.set(documentKey, []);
  }

  /**
   * Handler for active editor changes
   */
  private onActiveEditorChanged(editor: vscode.TextEditor | undefined): void {
    if (!editor) {return;}
    
    // Load annotations for the new editor
    this.loadAnnotationsForDocument(editor.document);
    this.documentContentCache.set(editor.document.uri.toString(), editor.document.getText());
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