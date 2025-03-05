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
        console.error("Editor not active or document not loaded", editor, editor?.document.uri.toString(), docKey);
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
    
    // Apply each change one by one to compute the new positions
    for (const change of changes) {
      const startOffset = change.rangeOffset;
      const endOffset = change.rangeOffset + change.rangeLength;
      const textLengthDiff = change.text.length - change.rangeLength;
      
      // Check if the change is only whitespace
      const isWhitespaceChange = /^\s*$/.test(change.text);
      
      for (let i = 0; i < workingAnnotations.length; i++) {
        const annotation = workingAnnotations[i];
        
        // Skip annotations that don't match the current document content
        if (annotation.document !== startingContent) {
          continue;
        }
        
        // CASE 1: Change is completely before the annotation
        if (endOffset < annotation.start) {
          // Simply shift the annotation
          annotation.start += textLengthDiff;
          annotation.end += textLengthDiff;
          continue;
        }
        
        // CASE 2: Change is completely after the annotation
        if (startOffset > annotation.end) {
          // No adjustment needed
          continue;
        }
        
        // CASE 3: Change is adjacent to the annotation (immediately before)
        if (endOffset === annotation.start) {
          // If not whitespace, include it in the annotation
          if (!isWhitespaceChange) {
            annotation.start = startOffset;
            annotation.end += textLengthDiff;
          } else {
            // If whitespace, just shift the annotation
            annotation.start += textLengthDiff;
            annotation.end += textLengthDiff;
          }
          continue;
        }
        
        // CASE 4: Change is adjacent to the annotation (immediately after)
        if (startOffset === annotation.end) {
          // If not whitespace, include it in the annotation
          if (!isWhitespaceChange) {
            annotation.end += change.text.length;
          }
          // If whitespace, don't expand the annotation
          continue;
        }
        
        // CASE 5: Change is completely inside the annotation
        if (startOffset >= annotation.start && endOffset <= annotation.end) {
          // Grow or shrink the annotation by the exact amount of the change
          annotation.end += textLengthDiff;
          continue;
        }
        
        // CASE 6: Change partially overlaps with the start of the annotation
        if (startOffset < annotation.start && endOffset > annotation.start && endOffset <= annotation.end) {
          // If the change contains whitespace at the beginning or end, determine how to handle
          if (isWhitespaceChange) {
            // For whitespace changes, adjust start to after the whitespace
            annotation.start = startOffset + change.text.length;
            annotation.end += textLengthDiff;
          } else {
            // For non-whitespace changes, include the change
            annotation.start = startOffset;
            annotation.end += textLengthDiff;
          }
          continue;
        }
        
        // CASE 7: Change partially overlaps with the end of the annotation
        if (startOffset >= annotation.start && startOffset < annotation.end && endOffset > annotation.end) {
          // If the change contains whitespace at the beginning or end, determine how to handle
          if (isWhitespaceChange) {
            // For whitespace changes, don't expand the annotation
            annotation.end = startOffset;
          } else {
            // For non-whitespace changes, include the change
            annotation.end = startOffset + change.text.length;
          }
          continue;
        }
        
        // CASE 8: Change completely contains the annotation
        if (startOffset < annotation.start && endOffset > annotation.end) {
          if (change.text.length === 0) {
            // If the text is deleted, collapse the annotation
            annotation.start = startOffset;
            annotation.end = startOffset;
          } else if (isWhitespaceChange) {
            // If change is whitespace, try to maintain relative position
            annotation.start = startOffset;
            annotation.end = startOffset;
          } else {
            // Otherwise, try to map to some portion of the new text
            annotation.start = startOffset;
            annotation.end = startOffset + change.text.length;
          }
          continue;
        }
      }
    }
    
    // Update all annotations with the current document content
    const finalAnnotations = workingAnnotations.map(ann => ({
      ...ann,
      document: ann.document !== startingContent ? ann.document : currentContent
    }));
    
    // Update the document's annotations
    this.documentAnnotations.set(documentKey, finalAnnotations);
    
    // Update decorations, save, and notify
    this.updateDecorations(document);
    this.saveAnnotationsForDocument(document);
    this.notifyAnnotationsChanged(document);
  }

  /**
   * Updates the decorations in the editor
   */
  public updateDecorations(document: vscode.TextDocument): void {
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
    
    // Get selected annotation ID from the panel if available
    const selectedAnnotationId = AnnotationManagerPanel.currentPanel?.selectedAnnotationId;
    
    const decorations: vscode.TextEditorDecorationType[] = [];
    
    // Create and apply decorations for each annotation
    for (const annotation of annotations) {
      // Skip if the document text doesn't match the annotation's document
      if (annotation.document !== document.getText()) {
        continue;
      }
      try {
        // Check if this is the selected annotation
        const isSelected = selectedAnnotationId === annotation.id;
        
        // Extract base color from metadata or use default
        const baseColor = annotation.metadata?.color || "rgba(255,255,0,0.3)";
        
        // Increase opacity for selected annotation
        let decorationColor = baseColor;
        if (isSelected) {
          if (baseColor.startsWith("rgba")) {
            // Parse the rgba color values
            const rgbaMatch = baseColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
            if (rgbaMatch) {
              const [_, r, g, b] = rgbaMatch;
              // Use a fixed higher opacity value for selected annotations
              decorationColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
            }
          } else if (baseColor.startsWith("rgb")) {
            // For rgb format, add alpha
            const rgbMatch = baseColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (rgbMatch) {
              const [_, r, g, b] = rgbMatch;
              decorationColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
            }
          } else if (baseColor.startsWith("#")) {
            // For hex format, convert to rgba
            const hex = baseColor.slice(1);
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            decorationColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
          }
        }
        
        // Create a decoration type with the annotation's style
        const decorationType = vscode.window.createTextEditorDecorationType({
          backgroundColor: decorationColor,
          // Add a border for selected annotations
          border: isSelected ? '2px solid #007fd4' : undefined,
          borderRadius: isSelected ? '3px' : undefined,
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