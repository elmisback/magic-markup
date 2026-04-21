import assert from "assert/strict";
import { test } from "node:test";

import type { Annotation } from "../AnnotationTracker";

const moduleLoader = require("module") as {
  _load: (request: string, parent: NodeModule, isMain: boolean) => unknown;
};

const originalLoad = moduleLoader._load;
const vscodeStub = {};

moduleLoader._load = function patchedLoad(request: string, parent: NodeModule, isMain: boolean) {
  if (request === "vscode") {
    return vscodeStub;
  }
  return originalLoad(request, parent, isMain);
};

const { exportedForTesting } = require("../AnnotationTracker") as typeof import("../AnnotationTracker");

moduleLoader._load = originalLoad;

const { applyChangeToAnnotation } = exportedForTesting;

function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  const baseOriginal = {
    document: "abcdefghi",
    start: 4,
    end: 10,
  };

  return {
    id: "annotation-1",
    start: 4,
    end: 10,
    document: "abcdefghi",
    tool: "tool",
    metadata: {},
    ...overrides,
    original: {
      document: overrides.original?.document ?? baseOriginal.document,
      start: overrides.original?.start ?? baseOriginal.start,
      end: overrides.original?.end ?? baseOriginal.end,
    },
  };
}

test("returns the original annotation when the document does not match the starting content", () => {
  const annotation = makeAnnotation({ document: "other-doc" });
  const result = applyChangeToAnnotation(
    annotation,
    { rangeOffset: 0, rangeLength: 0, text: "x" },
    "abcdefghi"
  );

  assert.strictEqual(result, annotation);
});

test("case 1: shifts the annotation when the change is completely before it", () => {
  const annotation = makeAnnotation();
  const result = applyChangeToAnnotation(
    annotation,
    { rangeOffset: 1, rangeLength: 1, text: "xy" },
    "abcdefghi"
  );

  assert.deepStrictEqual(result, {
    ...annotation,
    start: 5,
    end: 11,
  });
});

test("case 2: leaves the annotation unchanged when the change is completely after it", () => {
  const annotation = makeAnnotation();
  const result = applyChangeToAnnotation(
    annotation,
    { rangeOffset: 12, rangeLength: 1, text: "xy" },
    "abcdefghi"
  );

  assert.strictEqual(result, annotation);
});

test("case 3: updates the annotation when the change is immediately before it", () => {
  const annotation = makeAnnotation();
  const result = applyChangeToAnnotation(
    annotation,
    { rangeOffset: 2, rangeLength: 2, text: "XYZ" },
    "abcdefghi"
  );

  assert.deepStrictEqual(result, {
    ...annotation,
    start: 2,
    end: 11,
  });
});

test("case 3 whitespace branch: shifts the annotation when whitespace is inserted immediately before it", () => {
  const annotation = makeAnnotation();
  const result = applyChangeToAnnotation(
    annotation,
    { rangeOffset: 3, rangeLength: 1, text: "  " },
    "abcdefghi"
  );

  assert.deepStrictEqual(result, {
    ...annotation,
    start: 5,
    end: 11,
  });
});

test("case 4: extends the annotation when the change is immediately after it", () => {
  const annotation = makeAnnotation();
  const result = applyChangeToAnnotation(
    annotation,
    { rangeOffset: 10, rangeLength: 1, text: "XYZ" },
    "abcdefghi"
  );

  assert.deepStrictEqual(result, {
    ...annotation,
    end: 13,
  });
});

test("case 4 whitespace branch: leaves the annotation unchanged when whitespace is inserted immediately after it", () => {
  const annotation = makeAnnotation();
  const result = applyChangeToAnnotation(
    annotation,
    { rangeOffset: 10, rangeLength: 1, text: " " },
    "abcdefghi"
  );

  assert.strictEqual(result, annotation);
});

test("case 5: shrinks or grows the end when the change is fully inside the annotation", () => {
  const annotation = makeAnnotation();
  const result = applyChangeToAnnotation(
    annotation,
    { rangeOffset: 6, rangeLength: 2, text: "wxyz" },
    "abcdefghi"
  );

  assert.deepStrictEqual(result, {
    ...annotation,
    end: 12,
  });
});

test("case 6: adjusts the start and end when the change overlaps the start of the annotation", () => {
  const annotation = makeAnnotation();
  const result = applyChangeToAnnotation(
    annotation,
    { rangeOffset: 2, rangeLength: 5, text: "XYZ" },
    "abcdefghi"
  );

  assert.deepStrictEqual(result, {
    ...annotation,
    start: 2,
    end: 8,
  });
});

test("case 6 whitespace branch: anchors the new start to the inserted whitespace length", () => {
  const annotation = makeAnnotation();
  const result = applyChangeToAnnotation(
    annotation,
    { rangeOffset: 2, rangeLength: 5, text: "  " },
    "abcdefghi"
  );

  assert.deepStrictEqual(result, {
    ...annotation,
    start: 4,
    end: 7,
  });
});

test("case 7: adjusts the end when the change overlaps the end of the annotation", () => {
  const annotation = makeAnnotation();
  const result = applyChangeToAnnotation(
    annotation,
    { rangeOffset: 8, rangeLength: 4, text: "XYZ" },
    "abcdefghi"
  );

  assert.deepStrictEqual(result, {
    ...annotation,
    end: 11,
  });
});

test("case 7 whitespace branch: snaps the end to the start of the overlapping change", () => {
  const annotation = makeAnnotation();
  const result = applyChangeToAnnotation(
    annotation,
    { rangeOffset: 8, rangeLength: 4, text: "  " },
    "abcdefghi"
  );

  assert.deepStrictEqual(result, {
    ...annotation,
    end: 8,
  });
});

test("case 8: collapses the annotation when the change fully contains it and removes the text", () => {
  const annotation = makeAnnotation();
  const result = applyChangeToAnnotation(
    annotation,
    { rangeOffset: 2, rangeLength: 10, text: "" },
    "abcdefghi"
  );

  assert.deepStrictEqual(result, {
    ...annotation,
    start: 2,
    end: 2,
  });
});

test("case 8 whitespace branch: collapses the annotation when the change fully contains it and inserts whitespace", () => {
  const annotation = makeAnnotation();
  const result = applyChangeToAnnotation(
    annotation,
    { rangeOffset: 2, rangeLength: 10, text: "  " },
    "abcdefghi"
  );

  assert.deepStrictEqual(result, {
    ...annotation,
    start: 2,
    end: 2,
  });
});