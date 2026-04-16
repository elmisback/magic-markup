/*

Synchronous update algorithm:
  - If the update is a no-op, return the old state.
  - Compute a plan: a new annotation list plus optional new document text.
  - Effect (1): SYNCHRONOUSLY write the annotation list to disk.
      If it fails, there's nothing to clean up — return the old state.
  - If the document text needs to change:
    - Effect (2): SYNCHRONOUSLY write the new document text with fs.writeFileSync
      (NOT VSCode's edit API).
      If it fails, SYNCHRONOUSLY revert the annotation file and return the old state.
    - After this completes, VSCode's file watcher may fire onchange. That's fine:
      applyChangesToAnnotations short-circuits when startingContent === currentContent,
      which it will be because we just patched both.
  - Apply decorations synchronously.
  - Notify the panel.

Design principles (from the original header):

  1. Minimal interface. No withAnnotations / withDecorationTypes / etc. cruft.
     State construction happens only at the top level of createAnnotationTracker.
     Helpers take the pieces of state they need and return just what they modify.

  2. Anti-corruption layer. VSCode types like TextDocumentContentChangeEvent and
     TextEditorDecorationType are parsed at the edge into our own domain types
     (ContentChange, DecorationDisposer, DecorationSpec) before entering the core.

  3. Reify all effects as data, all the way down. The pure core computes plans
     (AnnotationUpdatePlan, DecorationSpec[]) describing what should happen. The
     thin shell in createAnnotationTracker executes them. The core never touches
     I/O or VSCode APIs.

*/

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { createPatch, applyPatch } from "diff";
import { AnnotationManagerPanel } from "./panels/AnnotationManagerPanel";

export const exportedForTesting = {
  getAnnotationsFilePath,
  reconstructAnnotationsFromDisk,
  serializeAnnotationsForDisk,
  parseContentChange,
  applyChangeToAnnotation,
  applyChangesToAnnotations,
  resolveDecorationColor,
  resolveGutterColor,
  annotationsAreIdentical,
  computeDecorationSpecs,
  planAnnotationUpdate,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Domain types.
// ═══════════════════════════════════════════════════════════════════════════════

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

type AnnotationUpdate = Annotation & {
  settingAnchorTextOnly?: boolean; // if true, only update the annotation's text, not its full document
};

/** Anti-corruption: parsed form of vscode.TextDocumentContentChangeEvent. */
export interface ContentChange {
  readonly rangeOffset: number;
  readonly rangeLength: number;
  readonly text: string;
}

/** Anti-corruption: a DecorationType collapsed down to just the capability we use. */
export type DecorationDisposer = () => void;

/**
 * Anti-corruption: a pure description of a decoration to apply. The shell turns
 * this into vscode.TextEditorDecorationType instances and Range objects.
 */
export interface DecorationSpec {
  readonly annotationId: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly textBorderColor: string;
  readonly gutterBorderColor: string;
}

type DocumentKey = string; // document URI as string

export interface TrackerState {
  readonly documentAnnotations: ReadonlyMap<DocumentKey, Annotation[]>;
  // TODO don't need an array, just a single disposer per annotation file
  readonly decorationDisposers: ReadonlyMap<DocumentKey, DecorationDisposer[]>;
  readonly fileChangeTimers: ReadonlyMap<DocumentKey, NodeJS.Timeout>;
  readonly pendingChanges: ReadonlyMap<DocumentKey, ContentChange[]>;
}

/** Plan returned by planAnnotationUpdate: the reified effect of an update. */
export type AnnotationUpdatePlan =
  | { readonly kind: "noop" }
  | {
      readonly kind: "update";
      readonly newAnnotations: Annotation[];
      /** non-null iff the document text on disk needs to change */
      readonly newDocumentText: string | null;
    };


// ═══════════════════════════════════════════════════════════════════════════════
// Pure functions — exported for testing. No I/O, no VSCode API, no TrackerState.
// ═══════════════════════════════════════════════════════════════════════════════

function getAnnotationsFilePath(documentPath: string, createDir: boolean = false): string {
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

function reconstructAnnotationsFromDisk(diskState: {
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

function serializeAnnotationsForDisk(
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

/** Anti-corruption: parse a VSCode change event into our domain type. */
function parseContentChange(event: vscode.TextDocumentContentChangeEvent): ContentChange {
  return {
    rangeOffset: event.rangeOffset,
    rangeLength: event.rangeLength,
    text: event.text,
  };
}

/**
 * Apply a single content change to a single annotation. Pure; testable in
 * isolation. Annotations whose document doesn't match the starting content are
 * passed through unchanged.
 */
function applyChangeToAnnotation(
  annotation: Annotation,
  change: ContentChange,
  startingContent: string
): Annotation {
  if (annotation.document !== startingContent) {
    return annotation;
  }

  const startOffset = change.rangeOffset;
  const endOffset = change.rangeOffset + change.rangeLength;
  const textLengthDiff = change.text.length - change.rangeLength;
  const isWhitespaceChange = /^\s*$/.test(change.text);

  // CASE 1: Change is completely before the annotation
  if (endOffset < annotation.start) {
    return {
      ...annotation,
      start: annotation.start + textLengthDiff,
      end: annotation.end + textLengthDiff,
    };
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
    return {
      ...annotation,
      start: annotation.start + textLengthDiff,
      end: annotation.end + textLengthDiff,
    };
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
      return {
        ...annotation,
        start: startOffset + change.text.length,
        end: annotation.end + textLengthDiff,
      };
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
}

function applyChangesToAnnotations(
  annotations: Annotation[],
  changes: readonly ContentChange[],
  startingContent: string,
  currentContent: string
): Annotation[] {
  // Short-circuit: if the document's net content is what the annotations already
  // reflect, there's nothing to do. This is what lets the synchronous update
  // algorithm safely ignore VSCode's onchange events after we write to disk.
  if (startingContent === currentContent) {
    return annotations;
  }

  let current = annotations;
  for (const change of changes) {
    current = current.map((a) => applyChangeToAnnotation(a, change, startingContent));
  }

  return current.map((ann) =>
    ann.document === startingContent ? { ...ann, document: currentContent } : ann
  );
}

function resolveDecorationColor(baseColor: string, isSelected: boolean): string {
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

function resolveGutterColor(baseColor: string): string {
  if (baseColor.startsWith("rgba")) {
    const m = baseColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (m) { return `rgb(${m[1]}, ${m[2]}, ${m[3]})`; }
  }
  return baseColor;
}

function annotationsAreIdentical(a: Annotation, b: Annotation): boolean {
  return (
    a.start === b.start &&
    a.end === b.end &&
    a.document === b.document &&
    JSON.stringify(a.metadata) === JSON.stringify(b.metadata)
  );
}

/**
 * Pure: compute the decoration specs for a list of annotations against a given
 * document text. Annotations whose document doesn't match are skipped.
 */
function computeDecorationSpecs(
  annotations: Annotation[],
  documentText: string,
  selectedAnnotationId: string | undefined
): DecorationSpec[] {
  const specs: DecorationSpec[] = [];
  for (const ann of annotations) {
    if (ann.document !== documentText) {
      continue;
    }
    const isSelected = selectedAnnotationId === ann.id;
    const baseColor = ann.metadata?.color || "rgba(255,255,0,0.3)";
    specs.push({
      annotationId: ann.id,
      startOffset: ann.start,
      endOffset: ann.end,
      textBorderColor: resolveDecorationColor(baseColor, isSelected),
      gutterBorderColor: resolveGutterColor(baseColor),
    });
  }
  return specs;
}

/**
 * Pure: given the current annotations and a proposed updated annotation, plan
 * the full update. Returns { kind: "noop" } if the update would be a no-op, or
 * { kind: "update", newAnnotations, newDocumentText } describing what needs to
 * be written.
 *
 * newDocumentText is non-null iff the updated annotation's document differs
 * from the current on-disk document text.
 */
function planAnnotationUpdate(
  currentAnnotations: Annotation[],
  updatedAnnotation: AnnotationUpdate,
  currentDocumentText: string
): AnnotationUpdatePlan {
  // TODO this isn't correctly handling mixed file writes between the user and the extension, it's very tricky
  // fortunately we should be able to unit test to describe and validate the intended behavior
  const currentAnnotation = currentAnnotations.find((a) => a.id === updatedAnnotation.id)!;
  const resolvedDoc = updatedAnnotation.settingAnchorTextOnly ? currentDocumentText.slice(0, currentAnnotation.start) + updatedAnnotation.document.slice(updatedAnnotation.start, updatedAnnotation.end) + currentDocumentText.slice(currentAnnotation.end) : updatedAnnotation.document || currentDocumentText;
  const normalized: AnnotationUpdate = { ...updatedAnnotation, document: resolvedDoc };

  const existing = currentAnnotations.find((a) => a.id === updatedAnnotation.id);
  if (existing && annotationsAreIdentical(existing, normalized)) {
    return { kind: "noop" };
  }

  const newAnnotations = currentAnnotations.map((a) =>
    a.id === updatedAnnotation.id ? normalized : a
  );

  const newDocumentText = resolvedDoc !== currentDocumentText ? resolvedDoc : null;

  return { kind: "update", newAnnotations, newDocumentText };
}


// ═══════════════════════════════════════════════════════════════════════════════
// Shell: I/O and VSCode API. These are the only functions allowed to touch the
// filesystem, VSCode APIs, or the panel.
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

/**
 * Synchronously write the annotation list for a document. An empty list deletes
 * the annotations file. Returns true on success, false on failure.
 */
function tryWriteAnnotationsFile(
  documentFsPath: string,
  documentText: string,
  fileName: string,
  annotations: Annotation[]
): boolean {
  try {
    const annotationsPath = getAnnotationsFilePath(documentFsPath, annotations.length > 0);

    if (annotations.length === 0) {
      if (fs.existsSync(annotationsPath)) {
        fs.unlinkSync(annotationsPath);
      }
      return true;
    }

    const dir = path.dirname(annotationsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const state = serializeAnnotationsForDisk(annotations, documentText, fileName);
    fs.writeFileSync(annotationsPath, JSON.stringify(state, null, 2), "utf8");
    console.debug(`Saved annotations to ${annotationsPath}`);
    return true;
  } catch (error) {
    console.error(`Failed to write annotations for ${documentFsPath}:`, error);
    return false;
  }
}

/**
 * Synchronously write new text to a document file on disk, bypassing VSCode's
 * edit API entirely. The file watcher will eventually fire onchange; that's
 * handled by the short-circuit in applyChangesToAnnotations.
 */
function tryWriteDocumentFile(documentFsPath: string, newText: string): boolean {
  try {
    fs.writeFileSync(documentFsPath, newText, "utf8");
    return true;
  } catch (error) {
    console.error(`Failed to write document ${documentFsPath}:`, error);
    return false;
  }
}

function notifyPanel(
  documentUri: vscode.Uri,
  annotations: Annotation[],
  documentText: string
): void {
  if (!AnnotationManagerPanel.currentPanel) {
    return;
  }
  console.log("Notifying annotation panel of changes for document", documentUri.toString());
  AnnotationManagerPanel.currentPanel.sendMessageObject({
    command: "updateAnnotations",
    data: {
      documentUri: documentUri.toString(),
      annotations,
      documentText,
    },
  });
}

/**
 * Execute a list of decoration specs: dispose old disposers, create new VSCode
 * decoration types for each spec, apply them to visible editors of `document`,
 * and return the new disposer list.
 */
function applyDecorations(
  oldDisposers: DecorationDisposer[] | undefined,
  specs: DecorationSpec[],
  document: vscode.TextDocument
): DecorationDisposer[] {
  if (oldDisposers) {
    for (const dispose of oldDisposers) {
      try { dispose(); } catch (e) { console.error("Decoration dispose failed:", e); }
    }
  }

  const documentKey = document.uri.toString();
  const editors = vscode.window.visibleTextEditors.filter(
    (e) => e.document.uri.toString() === documentKey
  );
  if (editors.length === 0) {
    return [];
  }

  const disposers: DecorationDisposer[] = [];

  for (const spec of specs) {
    try {
      const startPos = document.positionAt(spec.startOffset);
      const endPos = document.positionAt(spec.endOffset);
      const range = new vscode.Range(startPos, endPos);

      const textDecorationType = vscode.window.createTextEditorDecorationType({
        borderColor: spec.textBorderColor,
        borderStyle: "none none solid none",
      });
      const gutterDecorationType = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        borderColor: spec.gutterBorderColor,
        borderWidth: "3px",
        borderStyle: "none solid none none",
      });

      for (const editor of editors) {
        editor.setDecorations(textDecorationType, [range]);
        editor.setDecorations(gutterDecorationType, [range]);
      }

      disposers.push(() => textDecorationType.dispose());
      disposers.push(() => gutterDecorationType.dispose());
    } catch (error) {
      console.error("Error creating decoration:", error);
    }
  }

  return disposers;
}


// ═══════════════════════════════════════════════════════════════════════════════
// createAnnotationTracker — the only place that owns state. State construction
// happens here and only here.
// ═══════════════════════════════════════════════════════════════════════════════

export interface TrackerHandle extends vscode.Disposable {
  readonly state: Readonly<TrackerState>;
  loadAnnotationsForDocument(document: vscode.TextDocument): Annotation[];
  saveAnnotationsForDocument(document: vscode.TextDocument): void;
  addAnnotation(document: vscode.TextDocument, annotation: Annotation): void;
  removeAnnotation(document: vscode.TextDocument, annotationId: string): void;
  updateAnnotation(document: vscode.TextDocument, updatedAnnotation: AnnotationUpdate): void;
  moveAnnotation(
    document: vscode.TextDocument,
    annotationId: string,
    newStart: number,
    newEnd: number
  ): void;
  getAnnotationsForDocument(document: vscode.TextDocument): Annotation[];
  updateDecorations(document: vscode.TextDocument): void;
  dispose(): void;
}

export function createAnnotationTracker(_context: vscode.ExtensionContext): TrackerHandle {
  let state: TrackerState = {
    documentAnnotations: new Map(),
    decorationDisposers: new Map(),
    fileChangeTimers: new Map(),
    pendingChanges: new Map(),
  };

  const getSelectedId = (): string | undefined =>
    AnnotationManagerPanel.currentPanel?.selectedAnnotationId;

  /**
   * Top-level commit: given a document and a new annotation list, rebuild
   * decorations against the document, update state, and notify the panel.
   * This is the single place where decoration disposers and documentAnnotations
   * are swapped together — it combines I/O (decoration API, panel message) with
   * the resulting state update.
   */
  const commitAnnotations = (
    document: vscode.TextDocument,
    newAnnotations: Annotation[]
  ): void => {
    const key = document.uri.toString();
    const specs = computeDecorationSpecs(newAnnotations, document.getText(), getSelectedId());
    const newDisposers = applyDecorations(state.decorationDisposers.get(key), specs, document);

    const nextAnnotations = new Map(state.documentAnnotations);
    nextAnnotations.set(key, newAnnotations);
    const nextDisposers = new Map(state.decorationDisposers);
    nextDisposers.set(key, newDisposers);

    state = {
      documentAnnotations: nextAnnotations,
      decorationDisposers: nextDisposers,
      fileChangeTimers: state.fileChangeTimers,
      pendingChanges: state.pendingChanges,
    };

    notifyPanel(document.uri, newAnnotations, document.getText());
  };

  /** Load annotations for a document if not already loaded. */
  const ensureLoaded = (document: vscode.TextDocument): void => {
    const key = document.uri.toString();
    if (state.documentAnnotations.has(key)) {
      return;
    }
    const loaded = readAnnotationsFromDisk(document.uri.fsPath);
    if (loaded !== null) {
      commitAnnotations(document, loaded);
      return;
    }
    // No file on disk — record an empty entry without notifying the panel,
    // matching the original behavior.
    const nextAnnotations = new Map(state.documentAnnotations);
    nextAnnotations.set(key, []);
    state = {
      documentAnnotations: nextAnnotations,
      decorationDisposers: state.decorationDisposers,
      fileChangeTimers: state.fileChangeTimers,
      pendingChanges: state.pendingChanges,
    };
  };

  /** Flush accumulated pending changes for a document key. */
  const flushPendingChanges = (documentKey: string): void => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== documentKey) {
      console.error(
        "Editor not active or document not loaded",
        editor?.document.uri.toString(),
        documentKey
      );
      const clearedPending = new Map(state.pendingChanges);
      clearedPending.delete(documentKey);
      const clearedTimers = new Map(state.fileChangeTimers);
      clearedTimers.delete(documentKey);
      state = {
        documentAnnotations: state.documentAnnotations,
        decorationDisposers: state.decorationDisposers,
        fileChangeTimers: clearedTimers,
        pendingChanges: clearedPending,
      };
      return;
    }

    const document = editor.document;
    const annotations = state.documentAnnotations.get(documentKey);
    const changes = state.pendingChanges.get(documentKey) || [];

    // Clear the pending/timer entries regardless of whether we have work to do.
    const clearedPending = new Map(state.pendingChanges);
    clearedPending.delete(documentKey);
    const clearedTimers = new Map(state.fileChangeTimers);
    clearedTimers.delete(documentKey);
    state = {
      documentAnnotations: state.documentAnnotations,
      decorationDisposers: state.decorationDisposers,
      fileChangeTimers: clearedTimers,
      pendingChanges: clearedPending,
    };

    if (!annotations || annotations.length === 0 || changes.length === 0) {
      return;
    }

    const startingContent = annotations[0].document;
    const currentContent = document.getText();
    const updated = applyChangesToAnnotations(annotations, changes, startingContent, currentContent);

    // Persist the (possibly-unchanged) annotations and unconditionally rebuild
    // decorations. The unconditional rebuild matters: if updateAnnotation just
    // rewrote the document on disk, VSCode will fire onchange with a no-op
    // applyChangesToAnnotations result — but decorations still need to be
    // rebuilt against the refreshed document text.
    tryWriteAnnotationsFile(
      document.uri.fsPath,
      document.getText(),
      document.fileName,
      updated
    );
    commitAnnotations(document, updated);
  };

  /** Handle a VSCode text-document change event. */
  const onDocumentChanged = (event: vscode.TextDocumentChangeEvent): void => {
    const docKey = event.document.uri.toString();
    if (!state.documentAnnotations.has(docKey)) {
      return;
    }

    const parsed = event.contentChanges.map(parseContentChange);
    const existingChanges = state.pendingChanges.get(docKey) || [];
    const nextChanges = [...existingChanges, ...parsed];

    const existingTimer = state.fileChangeTimers.get(docKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    const newTimer = setTimeout(() => flushPendingChanges(docKey), 50);

    const nextPending = new Map(state.pendingChanges);
    nextPending.set(docKey, nextChanges);
    const nextTimers = new Map(state.fileChangeTimers);
    nextTimers.set(docKey, newTimer);

    state = {
      documentAnnotations: state.documentAnnotations,
      decorationDisposers: state.decorationDisposers,
      fileChangeTimers: nextTimers,
      pendingChanges: nextPending,
    };
  };

  /** Handle a VSCode active-editor change event. */
  const onActiveEditorChanged = (editor: vscode.TextEditor | undefined): void => {
    if (!editor) {
      return;
    }
    ensureLoaded(editor.document);
  };

  const disposables: vscode.Disposable[] = [
    vscode.workspace.onDidChangeTextDocument(onDocumentChanged),
    vscode.window.onDidChangeActiveTextEditor(onActiveEditorChanged),
  ];

  // Initial load. onActiveEditorChanged handles the undefined case internally.
  onActiveEditorChanged(vscode.window.activeTextEditor);

  return {
    get state() { return state; },

    loadAnnotationsForDocument(document) {
      ensureLoaded(document);
      return state.documentAnnotations.get(document.uri.toString()) || [];
    },

    saveAnnotationsForDocument(document) {
      const annotations = state.documentAnnotations.get(document.uri.toString()) || [];
      tryWriteAnnotationsFile(
        document.uri.fsPath,
        document.getText(),
        document.fileName,
        annotations
      );
    },

    addAnnotation(document, annotation) {
      const key = document.uri.toString();
      const current = state.documentAnnotations.get(key) || [];
      const newAnnotations = [...current, annotation];
      tryWriteAnnotationsFile(
        document.uri.fsPath,
        document.getText(),
        document.fileName,
        newAnnotations
      );
      commitAnnotations(document, newAnnotations);
    },

    removeAnnotation(document, annotationId) {
      const key = document.uri.toString();
      const current = state.documentAnnotations.get(key) || [];
      const newAnnotations = current.filter((a) => a.id !== annotationId);
      tryWriteAnnotationsFile(
        document.uri.fsPath,
        document.getText(),
        document.fileName,
        newAnnotations
      );
      commitAnnotations(document, newAnnotations);
    },

    /**
     * The centerpiece: fully synchronous update.
     *
     *   1. Plan the update (pure).
     *   2. If no-op, return.
     *   3. SYNC write annotations. On failure, return old state.
     *   4. If the document text changed, SYNC write the document. On failure,
     *      SYNC revert the annotations file and return old state.
     *   5. Commit: rebuild decorations, update state, notify panel.
     *
     * The subsequent onchange from VSCode's file watcher is benign: the
     * annotations already reflect the new text, so applyChangesToAnnotations
     * short-circuits on startingContent === currentContent.
     */
    updateAnnotation(document, updatedAnnotation) {
      const key = document.uri.toString();
      const currentAnnotations = state.documentAnnotations.get(key) || [];
      const plan = planAnnotationUpdate(currentAnnotations, updatedAnnotation, document.getText());

      if (plan.kind === "noop") {
        console.log("Skipping annotation update; identical to existing annotation");
        return;
      }

      // Effect 1: write the new annotation list.
      const wroteAnnotations = tryWriteAnnotationsFile(
        document.uri.fsPath,
        document.getText(),
        document.fileName,
        plan.newAnnotations
      );
      if (!wroteAnnotations) {
        return;
      }

      // Effect 2 (conditional): write the new document text.
      if (plan.newDocumentText !== null) {
        const wroteDoc = tryWriteDocumentFile(document.uri.fsPath, plan.newDocumentText);
        if (!wroteDoc) {
          // Revert: put the old annotation list back. This "should (mostly)
          // always succeed since we just wrote to it".
          tryWriteAnnotationsFile(
            document.uri.fsPath,
            document.getText(),
            document.fileName,
            currentAnnotations
          );
          return;
        }
      }

      // Commit decorations + state + panel. Note: VSCode's in-memory document
      // may still hold the OLD text at this moment; decoration positions will
      // briefly be computed against it. The file-watcher onchange will fire
      // shortly after and flushPendingChanges will rebuild decorations against
      // the refreshed document.
      commitAnnotations(document, plan.newAnnotations);
    },

    moveAnnotation(document, annotationId, newStart, newEnd) {
      const key = document.uri.toString();
      const current = state.documentAnnotations.get(key) || [];
      if (!current.some((a) => a.id === annotationId)) {
        vscode.window.showErrorMessage(`Annotation with ID ${annotationId} not found.`);
        return;
      }
      const newAnnotations = current.map((a) =>
        a.id === annotationId
          ? { ...a, start: newStart, end: newEnd, document: document.getText() }
          : a
      );
      tryWriteAnnotationsFile(
        document.uri.fsPath,
        document.getText(),
        document.fileName,
        newAnnotations
      );
      commitAnnotations(document, newAnnotations);
    },

    getAnnotationsForDocument(document) {
      return state.documentAnnotations.get(document.uri.toString()) || [];
    },

    updateDecorations(document) {
      const current = state.documentAnnotations.get(document.uri.toString()) || [];
      commitAnnotations(document, current);
    },

    dispose() {
      for (const disposers of state.decorationDisposers.values()) {
        for (const d of disposers) {
          try { d(); } catch (e) { console.error("Decoration dispose failed:", e); }
        }
      }
      for (const timer of state.fileChangeTimers.values()) {
        clearTimeout(timer);
      }
      for (const d of disposables) { d.dispose(); }
    },
  };
}