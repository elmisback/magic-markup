import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { createPatch, applyPatch } from "diff";
import { AnnotationManagerPanel } from "./panels/AnnotationManagerPanel";

export interface Annotation {
  // HACK this just duplicates "../webview-ui/src/Annotation.tsx"
  id: string;
  start: number;
  end: number;
  document: string;
  documentDiff?: string; // only exists when loaded from disk; used to resolve document
  tool: string;
  metadata: { [key: string]: any };
  original: {
    document: string;
    documentDiff?: string; // only exists when loaded from disk; used to resolve document
    start: number;
    end: number;
  };
}

export interface TrackerState {
  documentAnnotations: Map<string, Annotation[]>;
  decorationTypes: Map<string, vscode.TextEditorDecorationType[]>;
  fileChangeTimers: Map<string, NodeJS.Timeout>;
  documentContentCache: Map<string, string>;
  pendingChanges: Map<string, vscode.TextDocumentContentChangeEvent[]>;
}


// ═══════════════════════════════════════════════════════════════════════════════
// Pure functions — exported for testing. These never touch TrackerState.
// ═══════════════════════════════════════════════════════════════════════════════

export function getAnnotationsFilePath(documentPath: string, createDir: boolean = false): string {
  let currentDir = path.dirname(documentPath);

  while (currentDir !== path.parse(currentDir).root) {
    if (fs.existsSync(path.join(currentDir, ".git"))) {
      break;
    }
    currentDir = path.dirname(currentDir);
  }

  const relPath = path.relative(currentDir, documentPath);
  const annotationsDir = path.join(currentDir, "codetations", path.dirname(relPath));

  if (createDir && !fs.existsSync(annotationsDir)) {
    fs.mkdirSync(annotationsDir, { recursive: true });
  }

  return path.join(annotationsDir, path.basename(documentPath) + ".annotations.json");
}

export function reconstructAnnotationsFromDisk(diskState: {
  document: string;
  annotations: (Annotation & { documentDiff?: string })[];
}): Annotation[] {
  return diskState.annotations.map((ann) => {
    const reconstructedDoc = ann.documentDiff
      ? applyPatch(diskState.document, ann.documentDiff) || diskState.document
      : ann.document || diskState.document;

    const originalDoc = ann.original.documentDiff
      ? applyPatch(diskState.document, ann.original.documentDiff) || reconstructedDoc
      : ann.original.document;

    return {
      ...ann,
      document: reconstructedDoc,
      original: { ...ann.original, document: originalDoc },
    };
  });
}

export function serializeAnnotationsForDisk(
  annotations: Annotation[],
  documentText: string,
  fileName: string
): { document: string; annotations: object[] } {
  const globalDocument = annotations.length > 0 ? annotations[0].document : documentText;

  const serialized = annotations.map((ann) => {
    const { document: annDoc, ...rest } = ann;

    let documentDiff: string | undefined;
    if (annDoc !== globalDocument) {
      try {
        documentDiff = createPatch(fileName, globalDocument, annDoc);
      } catch (e) {
        documentDiff = undefined;
        console.error("Error creating document diff:", e);
      }
    }

    const {
      original: { document: originalDocument, ...restOriginal },
    } = ann;

    let originalDocumentDiff: string | undefined;
    if (originalDocument !== globalDocument) {
      try {
        originalDocumentDiff = createPatch(fileName, globalDocument, originalDocument);
      } catch (e) {
        originalDocumentDiff = undefined;
        console.error("Error creating original document diff:", e);
      }
    }

    return {
      ...rest,
      documentDiff,
      original: { ...restOriginal, documentDiff: originalDocumentDiff },
    };
  });

  return { document: globalDocument, annotations: serialized };
}

export function applyChangesToAnnotations(
  annotations: Annotation[],
  changes: readonly vscode.TextDocumentContentChangeEvent[],
  startingContent: string,
  currentContent: string
): Annotation[] {
  if (startingContent === currentContent) {
    return annotations;
  }

  let current = annotations;

  for (const change of changes) {
    const startOffset = change.rangeOffset;
    const endOffset = change.rangeOffset + change.rangeLength;
    const textLengthDiff = change.text.length - change.rangeLength;
    const isWhitespaceChange = /^\s*$/.test(change.text);

    current = current.map((annotation) => {
      if (annotation.document !== startingContent) {
        return annotation;
      }

      // CASE 1: Change is completely before the annotation
      if (endOffset < annotation.start) {
        return { ...annotation, start: annotation.start + textLengthDiff, end: annotation.end + textLengthDiff };
      }

      // CASE 2: Change is completely after the annotation
      if (startOffset > annotation.end) {
        return annotation;
      }

      // CASE 3: Change is adjacent to the annotation (immediately before)
      if (endOffset === annotation.start) {
        if (!isWhitespaceChange) {
          return { ...annotation, start: startOffset, end: annotation.end + textLengthDiff };
        }
        return { ...annotation, start: annotation.start + textLengthDiff, end: annotation.end + textLengthDiff };
      }

      // CASE 4: Change is adjacent to the annotation (immediately after)
      if (startOffset === annotation.end) {
        if (!isWhitespaceChange) {
          return { ...annotation, end: annotation.end + change.text.length };
        }
        return annotation;
      }

      // CASE 5: Change is completely inside the annotation
      if (startOffset >= annotation.start && endOffset <= annotation.end) {
        return { ...annotation, end: annotation.end + textLengthDiff };
      }

      // CASE 6: Change partially overlaps with the start of the annotation
      if (startOffset < annotation.start && endOffset > annotation.start && endOffset <= annotation.end) {
        if (isWhitespaceChange) {
          return { ...annotation, start: startOffset + change.text.length, end: annotation.end + textLengthDiff };
        }
        return { ...annotation, start: startOffset, end: annotation.end + textLengthDiff };
      }

      // CASE 7: Change partially overlaps with the end of the annotation
      if (startOffset >= annotation.start && startOffset < annotation.end && endOffset > annotation.end) {
        if (isWhitespaceChange) {
          return { ...annotation, end: startOffset };
        }
        return { ...annotation, end: startOffset + change.text.length };
      }

      // CASE 8: Change completely contains the annotation
      if (startOffset < annotation.start && endOffset > annotation.end) {
        if (change.text.length === 0 || isWhitespaceChange) {
          return { ...annotation, start: startOffset, end: startOffset };
        }
        return { ...annotation, start: startOffset, end: startOffset + change.text.length };
      }

      return annotation;
    });
  }

  return current.map((ann) =>
    ann.document === startingContent ? { ...ann, document: currentContent } : ann
  );
}

export function resolveDecorationColor(baseColor: string, isSelected: boolean): string {
  if (!isSelected) {
    return baseColor;
  }
  if (baseColor.startsWith("rgba")) {
    const m = baseColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (m) { return `rgba(${m[1]}, ${m[2]}, ${m[3]}, 0.5)`; }
  } else if (baseColor.startsWith("rgb")) {
    const m = baseColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) { return `rgba(${m[1]}, ${m[2]}, ${m[3]}, 0.5)`; }
  } else if (baseColor.startsWith("#")) {
    const hex = baseColor.slice(1);
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.5)`;
  }
  return baseColor;
}

export function resolveGutterColor(baseColor: string): string {
  if (baseColor.startsWith("rgba")) {
    const m = baseColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (m) { return `rgb(${m[1]}, ${m[2]}, ${m[3]})`; }
  }
  return baseColor;
}

export function annotationsAreIdentical(a: Annotation, b: Annotation): boolean {
  return (
    a.start === b.start &&
    a.end === b.end &&
    a.document === b.document &&
    JSON.stringify(a.metadata) === JSON.stringify(b.metadata)
  );
}

/**
 * Returns a new annotations list with one annotation replaced by a patched version.
 */
export function patchAnnotationInList(
  annotations: Annotation[],
  annotationId: string,
  patch: Partial<Annotation>,
  fallbackDocument: string
): Annotation[] {
  return annotations.map((a) =>
    a.id === annotationId
      ? { ...a, ...patch, document: patch.document || fallbackDocument }
      : a
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// I/O functions — read/write disk and VS Code APIs. No TrackerState access.
// ═══════════════════════════════════════════════════════════════════════════════

function readAnnotationsFromDisk(documentFsPath: string): Annotation[] | null {
  const annotationsPath = getAnnotationsFilePath(documentFsPath);
  console.debug(`Loading annotations from ${annotationsPath}`);

  if (!fs.existsSync(annotationsPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(annotationsPath, "utf8");
    const diskState = JSON.parse(content);
    return reconstructAnnotationsFromDisk(diskState);
  } catch (error) {
    console.error(`Error loading annotations from ${annotationsPath}:`, error);
    return null;
  }
}

function writeAnnotationsToDisk(
  annotations: Annotation[],
  document: vscode.TextDocument
): void {
  if (annotations.length === 0) {
    return;
  }
  const annotationsUri = getAnnotationsFilePath(document.uri.fsPath, true);
  const dir = path.dirname(annotationsUri);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  console.debug(`Saving annotations to ${annotationsUri}`);
  const state = serializeAnnotationsForDisk(annotations, document.getText(), document.fileName);
  fs.writeFileSync(annotationsUri, JSON.stringify(state, null, 2), "utf8");
}

function deleteAnnotationsFile(documentFsPath: string): void {
  try {
    const filePath = getAnnotationsFilePath(documentFsPath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Failed to remove annotations file:", error);
  }
}

function notifyPanel(document: vscode.TextDocument, annotations: Annotation[]): void {
  console.log("Notifying annotation panel of changes for document", document.uri.toString());
  if (AnnotationManagerPanel.currentPanel) {
    AnnotationManagerPanel.currentPanel.sendMessageObject({
      command: "updateAnnotations",
      data: {
        documentUri: document.uri.toString(),
        annotations,
        documentText: document.getText(),
      },
    });
  }
}

/**
 * Disposes old decoration types for a document key, creates new ones from the
 * given annotations, applies them to visible editors, and returns the new
 * decoration type array.
 */
function rebuildDecorations(
  oldDecorations: vscode.TextEditorDecorationType[] | undefined,
  annotations: Annotation[],
  document: vscode.TextDocument
): vscode.TextEditorDecorationType[] {
  const documentKey = document.uri.toString();

  console.log("Updating decorations for document", documentKey);
  console.log(annotations);

  // Dispose old
  if (oldDecorations) {
    for (const d of oldDecorations) {
      d.dispose();
    }
  }

  const editors = vscode.window.visibleTextEditors.filter(
    (e) => e.document.uri.toString() === documentKey
  );
  if (editors.length === 0) {
    return [];
  }

  const selectedAnnotationId = AnnotationManagerPanel.currentPanel?.selectedAnnotationId;
  const docText = document.getText();
  const result: vscode.TextEditorDecorationType[] = [];

  for (const annotation of annotations) {
    if (annotation.document !== docText) {
      continue;
    }
    try {
      const isSelected = selectedAnnotationId === annotation.id;
      const baseColor = annotation.metadata?.color || "rgba(255,255,0,0.3)";
      const decorationColor = resolveDecorationColor(baseColor, isSelected);
      const gutterColor = resolveGutterColor(baseColor);

      const startPos = document.positionAt(annotation.start);
      const endPos = document.positionAt(annotation.end);
      const range = new vscode.Range(startPos, endPos);

      const textDecorationType = vscode.window.createTextEditorDecorationType({
        borderColor: decorationColor,
        borderStyle: "none none solid none",
      });
      const gutterDecorationType = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        borderColor: gutterColor,
        borderWidth: "3px",
        borderStyle: "none solid none none",
      });

      for (const editor of editors) {
        editor.setDecorations(textDecorationType, [range]);
        editor.setDecorations(gutterDecorationType, [range]);
      }

      result.push(textDecorationType, gutterDecorationType);
    } catch (error) {
      console.error("Error creating decoration:", error);
    }
  }

  return result;
}


// ═══════════════════════════════════════════════════════════════════════════════
// Orchestration — these take TrackerState, call pure/IO functions, and write
// back into state. They are the "outermost level" that owns state updates.
// ═══════════════════════════════════════════════════════════════════════════════

function refreshDecorationsAndNotify(state: TrackerState, document: vscode.TextDocument): void {
  const documentKey = document.uri.toString();
  const annotations = state.documentAnnotations.get(documentKey) || [];
  state.decorationTypes.set(
    documentKey,
    rebuildDecorations(state.decorationTypes.get(documentKey), annotations, document)
  );
  notifyPanel(document, annotations);
}

function saveAndRefresh(state: TrackerState, document: vscode.TextDocument): void {
  const documentKey = document.uri.toString();
  const annotations = state.documentAnnotations.get(documentKey) || [];
  writeAnnotationsToDisk(annotations, document);
  refreshDecorationsAndNotify(state, document);
}

function loadAnnotationsForDocument(state: TrackerState, document: vscode.TextDocument): Annotation[] {
  const documentKey = document.uri.toString();
  const annotationsUri = getAnnotationsFilePath(document.uri.fsPath);
  console.debug(`Loading annotations for ${documentKey} from ${annotationsUri}`);
  // TODO we have only sort-of validated that diff loading works correctly.

  if (state.documentAnnotations.has(documentKey)) {
    return state.documentAnnotations.get(documentKey) as Annotation[];
  }

  const loaded = readAnnotationsFromDisk(document.uri.fsPath);
  if (loaded !== null) {
    state.documentAnnotations.set(documentKey, loaded);
    refreshDecorationsAndNotify(state, document);
    return loaded;
  }

  state.documentAnnotations.set(documentKey, []);
  return [];
}

function processAccumulatedChanges(state: TrackerState, document: vscode.TextDocument): void {
  const documentKey = document.uri.toString();
  const annotations = state.documentAnnotations.get(documentKey);
  const changes = state.pendingChanges.get(documentKey) || [];

  if (!annotations || annotations.length === 0 || changes.length === 0) {
    return;
  }

  const startingContent = state.documentContentCache.get(documentKey)!;
  const currentContent = document.getText();

  const updated = applyChangesToAnnotations(annotations, changes, startingContent, currentContent);
  state.documentAnnotations.set(documentKey, updated);
  saveAndRefresh(state, document);
}

function onDocumentChanged(state: TrackerState, event: vscode.TextDocumentChangeEvent): void {
  const docKey = event.document.uri.toString();

  if (!state.documentAnnotations.has(docKey)) {
    return;
  }

  if (!state.documentContentCache.has(docKey)) {
    state.documentContentCache.set(docKey, event.document.getText());
    return;
  }

  const existing = state.pendingChanges.get(docKey) || [];
  state.pendingChanges.set(docKey, [...existing, ...event.contentChanges]);

  if (state.fileChangeTimers.has(docKey)) {
    clearTimeout(state.fileChangeTimers.get(docKey)!);
  }

  state.fileChangeTimers.set(docKey, setTimeout(() => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== docKey) {
      console.error("Editor not active or document not loaded", editor, editor?.document.uri.toString(), docKey);
      state.pendingChanges.delete(docKey);
      state.fileChangeTimers.delete(docKey);
      return;
    }

    processAccumulatedChanges(state, editor.document);

    state.documentContentCache.set(docKey, editor.document.getText());
    state.pendingChanges.delete(docKey);
    state.fileChangeTimers.delete(docKey);
  }, 50));
}

function onActiveEditorChanged(state: TrackerState, editor: vscode.TextEditor | undefined): void {
  if (!editor) { return; }
  loadAnnotationsForDocument(state, editor.document);
  state.documentContentCache.set(editor.document.uri.toString(), editor.document.getText());
}

function addAnnotation(state: TrackerState, document: vscode.TextDocument, annotation: Annotation): void {
  const documentKey = document.uri.toString();
  const annotations = state.documentAnnotations.get(documentKey) || [];
  state.documentAnnotations.set(documentKey, [...annotations, annotation]);
  saveAndRefresh(state, document);
}

function removeAnnotation(state: TrackerState, document: vscode.TextDocument, annotationId: string): void {
  const documentKey = document.uri.toString();
  const annotations = state.documentAnnotations.get(documentKey) || [];
  const updated = annotations.filter((a) => a.id !== annotationId);

  state.documentAnnotations.set(documentKey, updated);

  if (updated.length === 0) {
    deleteAnnotationsFile(document.uri.fsPath);
    refreshDecorationsAndNotify(state, document);
  } else {
    saveAndRefresh(state, document);
  }
}

/**
 * Step 1 of updateAnnotation: validate and build the updated list.
 * Returns null if the update should be skipped (identical annotation).
 */
function buildAnnotationUpdate(
  annotations: Annotation[],
  updatedAnnotation: Annotation,
  currentDocText: string
): Annotation[] | null {
  const fixedDoc = updatedAnnotation.document || currentDocText;
  const existing = annotations.find((a) => a.id === updatedAnnotation.id);
  if (existing && annotationsAreIdentical(existing, { ...updatedAnnotation, document: fixedDoc })) {
    console.log("Skipping annotation update because it is identical to the existing annotation");
    return null;
  }
  return patchAnnotationInList(annotations, updatedAnnotation.id, updatedAnnotation, currentDocText);
}

/**
 * Step 2 of updateAnnotation (only when the annotation carries new document text):
 * apply a workspace edit to bring the editor in sync with the annotation's document.
 */
async function applyAnnotationDocumentEdit(
  state: TrackerState,
  document: vscode.TextDocument,
  updatedAnnotation: Annotation,
  previousAnnotations: Annotation[]
): Promise<void> {
  const documentKey = document.uri.toString();

  console.debug("Annotation document text differs from current document text, updating document to match annotation");

  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );
  edit.replace(document.uri, fullRange, updatedAnnotation.document);

  const success = await vscode.workspace.applyEdit(edit);
  if (!success) {
    console.error("Failed to update document text to match annotation");
    const reverted = previousAnnotations.map((a) =>
      a.id === updatedAnnotation.id ? { ...a, document: document.getText() } : a
    );
    state.documentAnnotations.set(documentKey, reverted);
    refreshDecorationsAndNotify(state, document);
    return;
  }

  // Re-patch against the now-updated document text
  const freshAnnotations = state.documentAnnotations.get(documentKey) || [];
  const repatched = patchAnnotationInList(freshAnnotations, updatedAnnotation.id, updatedAnnotation, document.getText());
  state.documentAnnotations.set(documentKey, repatched);
  saveAndRefresh(state, document);

  console.debug("finished updating document text to match annotation for", updatedAnnotation);
  const updatedDoc = await vscode.workspace.openTextDocument(document.uri);
  const finalAnnotations = state.documentAnnotations.get(documentKey) || [];
  const finalPatched = patchAnnotationInList(finalAnnotations, updatedAnnotation.id, updatedAnnotation, updatedDoc.getText());
  state.documentAnnotations.set(documentKey, finalPatched);
  writeAnnotationsToDisk(finalPatched, updatedDoc);
  state.decorationTypes.set(
    documentKey,
    rebuildDecorations(state.decorationTypes.get(documentKey), finalPatched, updatedDoc)
  );
}

async function updateAnnotation(
  state: TrackerState,
  document: vscode.TextDocument,
  updatedAnnotation: Annotation
): Promise<void> {
  console.log("Updating annotation", updatedAnnotation.id, "for document", document.uri.toString(), "with updated annotation", updatedAnnotation);
  const documentKey = document.uri.toString();
  const annotations = state.documentAnnotations.get(documentKey) || [];

  // Step 1: build the update (pure)
  const updated = buildAnnotationUpdate(annotations, updatedAnnotation, document.getText());
  if (updated === null) {
    return;
  }

  state.documentAnnotations.set(documentKey, updated);
  writeAnnotationsToDisk(updated, document);

  // Step 2: if the annotation's document text differs, apply workspace edit
  if (updatedAnnotation.document && updatedAnnotation.document !== document.getText()) {
    await applyAnnotationDocumentEdit(state, document, updatedAnnotation, annotations);
    return;
  }

  // Step 3: normal case — just refresh
  refreshDecorationsAndNotify(state, document);
  console.debug("Finished updating annotation", updatedAnnotation);
}

function moveAnnotation(
  state: TrackerState,
  document: vscode.TextDocument,
  annotationId: string,
  newStart: number,
  newEnd: number
): void {
  const documentKey = document.uri.toString();
  const annotations = state.documentAnnotations.get(documentKey) || [];

  const index = annotations.findIndex((a) => a.id === annotationId);
  if (index === -1) {
    vscode.window.showErrorMessage(`Annotation with ID ${annotationId} not found.`);
    return;
  }

  const updated = annotations.map((a, i) =>
    i === index ? { ...a, start: newStart, end: newEnd, document: document.getText() } : a
  );

  state.documentAnnotations.set(documentKey, updated);
  saveAndRefresh(state, document);
}

function getAnnotationsForDocument(state: TrackerState, document: vscode.TextDocument): Annotation[] {
  return state.documentAnnotations.get(document.uri.toString()) || [];
}


// ═══════════════════════════════════════════════════════════════════════════════
// Setup — creates state, wires VS Code events, returns a handle.
// ═══════════════════════════════════════════════════════════════════════════════

export interface TrackerHandle extends vscode.Disposable {
  state: TrackerState;
  loadAnnotationsForDocument(document: vscode.TextDocument): Promise<Annotation[]>;
  saveAnnotationsForDocument(document: vscode.TextDocument): Promise<void>;
  addAnnotation(document: vscode.TextDocument, annotation: Annotation): void;
  removeAnnotation(document: vscode.TextDocument, annotationId: string): void;
  updateAnnotation(document: vscode.TextDocument, updatedAnnotation: Annotation): Promise<void>;
  moveAnnotation(document: vscode.TextDocument, annotationId: string, newStart: number, newEnd: number): void;
  getAnnotationsForDocument(document: vscode.TextDocument): Annotation[];
  updateDecorations(document: vscode.TextDocument): void;
  dispose(): void;
}

export function createAnnotationTracker(_context: vscode.ExtensionContext): TrackerHandle {
  const state: TrackerState = {
    documentAnnotations: new Map(),
    decorationTypes: new Map(),
    fileChangeTimers: new Map(),
    documentContentCache: new Map(),
    pendingChanges: new Map(),
  };

  const disposables = [
    vscode.workspace.onDidChangeTextDocument((e) => onDocumentChanged(state, e)),
    vscode.window.onDidChangeActiveTextEditor((e) => onActiveEditorChanged(state, e)),
  ];

  if (vscode.window.activeTextEditor) {
    loadAnnotationsForDocument(state, vscode.window.activeTextEditor.document);
  }

  return {
    state,
    loadAnnotationsForDocument: (doc) => Promise.resolve(loadAnnotationsForDocument(state, doc)),
    saveAnnotationsForDocument: (doc) => { writeAnnotationsToDisk(state.documentAnnotations.get(doc.uri.toString()) || [], doc); return Promise.resolve(); },
    addAnnotation: (doc, ann) => addAnnotation(state, doc, ann),
    removeAnnotation: (doc, id) => removeAnnotation(state, doc, id),
    updateAnnotation: (doc, ann) => updateAnnotation(state, doc, ann),
    moveAnnotation: (doc, id, s, e) => moveAnnotation(state, doc, id, s, e),
    getAnnotationsForDocument: (doc) => getAnnotationsForDocument(state, doc),
    updateDecorations: (doc) => refreshDecorationsAndNotify(state, doc),
    dispose() {
      for (const types of state.decorationTypes.values()) {
        for (const t of types) { t.dispose(); }
      }
      for (const timer of state.fileChangeTimers.values()) {
        clearTimeout(timer);
      }
      for (const d of disposables) { d.dispose(); }
    },
  };
}