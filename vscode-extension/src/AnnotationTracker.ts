/*

At a high level, the update algo should be synchronous:
    if the update is a no-op, just return the old state
    generate just a patched annotation list
        compute the full update, including possible modifications to the document and annotation positions for each annotation
    effect (1): SYNCHRONOUSLY try to patch the annotation list on disk
        if this fails, nothing to clean, just return the old state
    if the document text needs an update
        (2) SYNCHRONOUSLY try to patch the file on disk
            [don't use VSCode's edit API, just write to the disk]
            [after this synchronous chain completes, onchange may fire because we modified the document, but this is not a risk because we (need to ensure we) ignore changes that leave the file in a state identical to that pointed at by the current annotation list, which was previously synced by effect (1)]
            if this fails and we previously patched annotations
                clean up: SYNCHRONOUSLY revert annotations on disk -- this should (mostly) always succeed since we just wrote to it
                just return the old state
    now apply decorations (also synchronously)
    finally, the disk representation of the document and annotations are in sync and align with our state, so we can safely notify the panel that there has been an update

Other plans:

Principle of minimal interface: I don't want to see withAnnotations or other state constructions occuring outside of the top level. (I don't want to see withAnnotations at all, it's cruft, just explicitly construct a new state at the top level from the results of helpers.) The top level function operates on the state. Everything below the top is a helper that should only need parts of the state. It's very unlikely anything below the top is so important that it should need to return an update for every part of the state at the same time. If a function returns a piece of the state, it should have to possibly modify that piece of the state.
Anti-corruption layer/Object parsing: we need to parse datatypes like the TextDocumentContentChangeEvent and TextEditorDecorationType into our own system rather than treating raw VSCode objects like they are part of our own state.
Reify all effects as data: pure functions in the center compute and return __what should happen__; a thin outer shell actually does it. The core never touches I/O directly, including commands for/feedback from the editor.


All TODOs in the file should be addressed (other than diff loading)

*/

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
  readonly documentAnnotations: ReadonlyMap<string, Annotation[]>;
  // TODO convert this to a set of functions () => void that just do the disposal for each file, we aren't using the rest of these objects at all
  readonly oldDecorationCleanupFunctions: ReadonlyMap<string, vscode.TextEditorDecorationType[]>;
  readonly fileChangeTimers: ReadonlyMap<string, NodeJS.Timeout>;
  // TODO eliminate this cache, it's not used 
  readonly documentContentCache: ReadonlyMap<string, string>;
  // TODO only store the necessary data from the content changes, not the full objects
  readonly pendingChanges: ReadonlyMap<string, vscode.TextDocumentContentChangeEvent[]>;
}


// ═══════════════════════════════════════════════════════════════════════════════
// Pure functions — exported for testing. These never touch TrackerState.
// (Unchanged from the original.)
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
    // TODO refactor this loop body into a separate pure function of the form `(annotation, {rangeOffset, rangeLength, text}) => updatedAnnotation` so it can be tested in isolation

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

/**
 * Step 1 of updateAnnotation: validate and build the updated list.
 * Returns null if the update should be skipped (identical annotation).
 */
export function buildAnnotationUpdate(
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


// ═══════════════════════════════════════════════════════════════════════════════
// I/O functions — read/write disk and VS Code APIs. No TrackerState access.
// (Unchanged from the original.)
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

async function applyAnnotationDocumentTextEdit(
  document: vscode.TextDocument,
  newText: string
): Promise<boolean> {
  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );
  edit.replace(document.uri, fullRange, newText);
  return vscode.workspace.applyEdit(edit);
}


// ═══════════════════════════════════════════════════════════════════════════════
// Immutable state helpers. Every transition returns a new TrackerState; Maps
// are cloned, not mutated. Object.freeze is applied at the top level (Maps
// themselves remain structurally mutable, so correctness relies on never
// calling .set/.delete on them outside these helpers).
// ═══════════════════════════════════════════════════════════════════════════════

function mapWith<K, V>(m: ReadonlyMap<K, V>, key: K, value: V): ReadonlyMap<K, V> {
  const next = new Map(m);
  next.set(key, value);
  return next;
}

function mapWithout<K, V>(m: ReadonlyMap<K, V>, key: K): ReadonlyMap<K, V> {
  const next = new Map(m);
  next.delete(key);
  return next;
}

function withAnnotations(s: TrackerState, key: string, anns: Annotation[]): TrackerState {
  return { ...s, documentAnnotations: mapWith(s.documentAnnotations, key, anns) };
}
function withDecorationTypes(s: TrackerState, key: string, types: vscode.TextEditorDecorationType[]): TrackerState {
  return { ...s, oldDecorationCleanupFunctions: mapWith(s.oldDecorationCleanupFunctions, key, types) };
}
function withContentCache(s: TrackerState, key: string, text: string): TrackerState {
  return { ...s, documentContentCache: mapWith(s.documentContentCache, key, text) };
}
function withPendingChanges(s: TrackerState, key: string, changes: vscode.TextDocumentContentChangeEvent[]): TrackerState {
  return { ...s, pendingChanges: mapWith(s.pendingChanges, key, changes) };
}
function withoutPendingChanges(s: TrackerState, key: string): TrackerState {
  return { ...s, pendingChanges: mapWithout(s.pendingChanges, key) };
}
function withTimer(s: TrackerState, key: string, timer: NodeJS.Timeout): TrackerState {
  return { ...s, fileChangeTimers: mapWith(s.fileChangeTimers, key, timer) };
}
function withoutTimer(s: TrackerState, key: string): TrackerState {
  return { ...s, fileChangeTimers: mapWithout(s.fileChangeTimers, key) };
}


// ═══════════════════════════════════════════════════════════════════════════════
// State transitions. Each takes a TrackerState and returns a new TrackerState.
// Side effects (disk I/O, editor decorations, panel notifications) may happen,
// but in-memory state is only updated via the returned value.
// ═══════════════════════════════════════════════════════════════════════════════

function refreshDecorationsAndNotify(state: TrackerState, document: vscode.TextDocument): TrackerState {
  const key = document.uri.toString();
  const annotations = state.documentAnnotations.get(key) || [];
  const oldTypes = state.oldDecorationCleanupFunctions.get(key);
  const newTypes = rebuildDecorations(oldTypes, annotations, document);
  notifyPanel(document, annotations);
  return withDecorationTypes(state, key, newTypes);
}

function saveAndRefresh(state: TrackerState, document: vscode.TextDocument): TrackerState {
  const annotations = state.documentAnnotations.get(document.uri.toString()) || [];
  writeAnnotationsToDisk(annotations, document);
  return refreshDecorationsAndNotify(state, document);
}

function loadAnnotationsForDocument(state: TrackerState, document: vscode.TextDocument): TrackerState {
  const key = document.uri.toString();
  console.debug(`Loading annotations for ${key}`);
  // TODO we have only sort-of validated that diff loading works correctly.
  if (state.documentAnnotations.has(key)) {
    return state;
  }
  const loaded = readAnnotationsFromDisk(document.uri.fsPath);
  if (loaded !== null) {
    return refreshDecorationsAndNotify(withAnnotations(state, key, loaded), document);
  }

  return withAnnotations(state, key, []);
}

function getAnnotationsForDocument(state: TrackerState, document: vscode.TextDocument): Annotation[] {
  return state.documentAnnotations.get(document.uri.toString()) || [];
}

function processAccumulatedChanges(state: TrackerState, document: vscode.TextDocument): TrackerState {
  const key = document.uri.toString();
  const annotations = state.documentAnnotations.get(key);
  const changes = state.pendingChanges.get(key) || [];
  if (!annotations || annotations.length === 0 || changes.length === 0) {
    return state;
  }
  const startingContent = annotations[0].document;
  const currentContent = document.getText();
  const updated = applyChangesToAnnotations(annotations, changes, startingContent, currentContent);
  return saveAndRefresh(withAnnotations(state, key, updated), document);
}

/**
 * Triggered by the deferred flush timer. Processes whatever changes have
 * accumulated for `documentKey`, re-seeds the content cache, and clears the
 * pending-changes / timer entries.
 */
function flushAccumulatedChanges(state: TrackerState, documentKey: string): TrackerState {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.toString() !== documentKey) {
    console.error(
      "Editor not active or document not loaded",
      editor,
      editor?.document.uri.toString(),
      documentKey
    );
    return withoutTimer(withoutPendingChanges(state, documentKey), documentKey);
  }
  const afterProcess = processAccumulatedChanges(state, editor.document);
  const afterCache = withContentCache(afterProcess, documentKey, editor.document.getText());
  return withoutTimer(withoutPendingChanges(afterCache, documentKey), documentKey);
}

/**
 * `scheduleFlush` is a narrow capability: it only lets the callee arrange for
 * a known future transition (flushAccumulatedChanges) to run on docKey. It
 * does NOT expose setState. The existing timer is cleared here because
 * clearTimeout is a side effect on the OS, not a state mutation.
 */
function onDocumentChanged(
  state: TrackerState,
  event: vscode.TextDocumentChangeEvent,
  scheduleFlush: (documentKey: string) => NodeJS.Timeout
): TrackerState {
  const docKey = event.document.uri.toString();

  if (!state.documentAnnotations.has(docKey)) {
    return state;
  }

  if (!state.documentContentCache.has(docKey)) {
    return withContentCache(state, docKey, event.document.getText());
  }

  const existingChanges = state.pendingChanges.get(docKey) || [];
  const nextChanges = [...existingChanges, ...event.contentChanges];

  const existingTimer = state.fileChangeTimers.get(docKey);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  const newTimer = scheduleFlush(docKey);

  return withTimer(withPendingChanges(state, docKey, nextChanges), docKey, newTimer);
}

function onActiveEditorChanged(
  state: TrackerState,
  editor: vscode.TextEditor | undefined
): TrackerState {
  if (!editor) {
    return state;
  }
  const afterLoad = loadAnnotationsForDocument(state, editor.document);
  return withContentCache(afterLoad, editor.document.uri.toString(), editor.document.getText());
}

function addAnnotation(
  state: TrackerState,
  document: vscode.TextDocument,
  annotation: Annotation
): TrackerState {
  const key = document.uri.toString();
  const annotations = state.documentAnnotations.get(key) || [];
  return saveAndRefresh(withAnnotations(state, key, [...annotations, annotation]), document);
}

function removeAnnotation(
  state: TrackerState,
  document: vscode.TextDocument,
  annotationId: string
): TrackerState {
  const key = document.uri.toString();
  const annotations = state.documentAnnotations.get(key) || [];
  const updated = annotations.filter((a) => a.id !== annotationId);
  const next = withAnnotations(state, key, updated);
  if (updated.length === 0) {
    deleteAnnotationsFile(document.uri.fsPath);
    return refreshDecorationsAndNotify(next, document);
  }
  return saveAndRefresh(next, document);
}

function moveAnnotation(
  state: TrackerState,
  document: vscode.TextDocument,
  annotationId: string,
  newStart: number,
  newEnd: number
): TrackerState {
  const key = document.uri.toString();
  const annotations = state.documentAnnotations.get(key) || [];
  const index = annotations.findIndex((a) => a.id === annotationId);
  if (index === -1) {
    vscode.window.showErrorMessage(`Annotation with ID ${annotationId} not found.`);
    return state;
  }
  const updated = annotations.map((a, i) =>
    i === index ? { ...a, start: newStart, end: newEnd, document: document.getText() } : a
  );
  return saveAndRefresh(withAnnotations(state, key, updated), document);
}


// ─── updateAnnotation phases ──────────────────────────────────────────────────
// updateAnnotation has an async workspace-edit step that may race with other
// events. To preserve the original's "re-read state after each await" behavior
// without leaking getState/setState into the helper, the async orchestration
// lives in the returned method of createAnnotationTracker; each phase below is
// a pure state transition invoked between awaits.

interface UpdateBeginResult {
  nextState: TrackerState;
  needsDocumentEdit: boolean;
  skipped: boolean;
}

function beginAnnotationUpdate(
  state: TrackerState,
  document: vscode.TextDocument,
  updatedAnnotation: Annotation
): UpdateBeginResult {
  console.log(
    "Updating annotation", updatedAnnotation.id,
    "for document", document.uri.toString(),
    "with updated annotation", updatedAnnotation
  );
  const key = document.uri.toString();
  const annotations = state.documentAnnotations.get(key) || [];
  const updated = buildAnnotationUpdate(annotations, updatedAnnotation, document.getText());
  if (updated === null) {
    return { nextState: state, needsDocumentEdit: false, skipped: true };
  }
  writeAnnotationsToDisk(updated, document);
  const needsDocumentEdit =
    !!updatedAnnotation.document && updatedAnnotation.document !== document.getText();
  return {
    nextState: withAnnotations(state, key, updated),
    needsDocumentEdit,
    skipped: false,
  };
}

function completeAnnotationUpdateAfterEdit(
  state: TrackerState,
  document: vscode.TextDocument,
  updatedAnnotation: Annotation
): TrackerState {
  const key = document.uri.toString();
  const annotations = state.documentAnnotations.get(key) || [];
  const repatched = patchAnnotationInList(
    annotations,
    updatedAnnotation.id,
    updatedAnnotation,
    document.getText()
  );
  return saveAndRefresh(withAnnotations(state, key, repatched), document);
}

function revertAnnotationUpdate(
  state: TrackerState,
  document: vscode.TextDocument,
  updatedAnnotation: Annotation
): TrackerState {
  console.error("Failed to update document text to match annotation");
  const key = document.uri.toString();
  const annotations = state.documentAnnotations.get(key) || [];
  const reverted = annotations.map((a) =>
    a.id === updatedAnnotation.id ? { ...a, document: document.getText() } : a
  );
  return refreshDecorationsAndNotify(withAnnotations(state, key, reverted), document);
}


// ═══════════════════════════════════════════════════════════════════════════════
// createAnnotationTracker — the only place that owns state.
// ═══════════════════════════════════════════════════════════════════════════════

export interface TrackerHandle extends vscode.Disposable {
  readonly state: Readonly<TrackerState>;
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
  let state: Readonly<TrackerState> = {
    documentAnnotations: new Map(),
    oldDecorationCleanupFunctions: new Map(),
    fileChangeTimers: new Map(),
    documentContentCache: new Map(),
    pendingChanges: new Map(),
  };

  const getState = (): TrackerState => state;
  const setState = (next: TrackerState): void => { state = next; };

  // Narrow capability handed to onDocumentChanged. Not setState — only the
  // ability to schedule a known future transition on a known docKey.
  const scheduleFlush = (docKey: string): NodeJS.Timeout =>
    setTimeout(() => setState(flushAccumulatedChanges(getState(), docKey)), 50);

  const disposables = [
    vscode.workspace.onDidChangeTextDocument((e) =>
      setState(onDocumentChanged(getState(), e, scheduleFlush))
    ),
    vscode.window.onDidChangeActiveTextEditor((editor) =>
      setState(onActiveEditorChanged(getState(), editor))
    ),
  ];

  // Initial load. No conditional here — onActiveEditorChanged handles the
  // undefined-editor case internally.
  setState(onActiveEditorChanged(getState(), vscode.window.activeTextEditor));

  return {
    get state() { return getState(); },

    loadAnnotationsForDocument: async (doc) => {
      setState(loadAnnotationsForDocument(getState(), doc));
      return getAnnotationsForDocument(getState(), doc);
    },

    saveAnnotationsForDocument: async (doc) => {
      writeAnnotationsToDisk(getAnnotationsForDocument(getState(), doc), doc);
    },

    addAnnotation: (doc, ann) => setState(addAnnotation(getState(), doc, ann)),

    removeAnnotation: (doc, id) => setState(removeAnnotation(getState(), doc, id)),

    updateAnnotation: async (doc, ann) => {
      // Phase 1: sync validate + patch + write.
      const { nextState, needsDocumentEdit, skipped } = beginAnnotationUpdate(getState(), doc, ann);
      if (skipped) { return; }
      setState(nextState);

      // Phase 2a: no workspace edit required — just refresh decorations.
      if (!needsDocumentEdit) {
        setState(refreshDecorationsAndNotify(getState(), doc));
        console.debug("Finished updating annotation", ann);
        return;
      }

      // Phase 2b: apply workspace edit. Each await re-reads state afterwards
      // via getState() so we survive concurrent mutations.
      console.debug("Annotation document text differs from current; applying workspace edit");
      const success = await applyAnnotationDocumentTextEdit(doc, ann.document);
      if (!success) {
        setState(revertAnnotationUpdate(getState(), doc, ann));
        return;
      }

      setState(completeAnnotationUpdateAfterEdit(getState(), doc, ann));

      // Re-open the document to pick up any normalization vscode may have done
      // (line endings, etc.) and patch one more time against that canonical text.
      const updatedDoc = await vscode.workspace.openTextDocument(doc.uri);
      setState(completeAnnotationUpdateAfterEdit(getState(), updatedDoc, ann));

      console.debug("Finished updating annotation", ann);
    },

    moveAnnotation: (doc, id, start, end) => setState(moveAnnotation(getState(), doc, id, start, end)),

    getAnnotationsForDocument: (doc) => getAnnotationsForDocument(getState(), doc),

    updateDecorations: (doc) => setState(refreshDecorationsAndNotify(getState(), doc)),

    dispose() {
      const finalState = getState();
      for (const types of finalState.oldDecorationCleanupFunctions.values()) {
        for (const t of types) { t.dispose(); }
      }
      for (const timer of finalState.fileChangeTimers.values()) {
        clearTimeout(timer);
      }
      for (const d of disposables) { d.dispose(); }
    },
  };
}