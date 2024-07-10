import { AnnotationEditorProps } from "./App";
import React from "react";
import { useState } from "react";

const ColorPicker: React.FC<AnnotationEditorProps> = (props) => {
  return (
    <input
      type="color"
      value={props.utils.getText()}
      onChange={(e) => props.utils.setText(e.target.value)}
    />
  );
};

const Comment: React.FC<AnnotationEditorProps> = (props) => {
  return (
    <textarea
      value={props.value.metadata.comment || ""}
      onChange={(e) => props.utils.setMetadata({ comment: e.target.value })}
    />
  );
};

const RunCodeSegment: React.FC<AnnotationEditorProps> = (props) => {
  const [response, setResponse] = useState(null);
  const [error, setError] = useState("");

  function runCode(): void {
    try {
      const result = new Function(props.utils.getText())();
      setResponse(result);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResponse(null);
    }
  }

  return (
    <div>
      {error && <div style={{ color: "red" }}>{error}</div>}
      {response && <div>{response}</div>}
      <input
        type="text"
        value={props.utils.getText()}
        onChange={(e) => props.utils.setText(e.target.value)}
      />
      <button onClick={runCode}>Run Highlighted Code</button>
    </div>
  );
};

/* TODO: Define additional tools as React components here. */

/* TODO: Add all tools to be used here. */
export const tools = {
  comment: Comment,
  colorPicker: ColorPicker,
  runCodeSegment: RunCodeSegment,
};
