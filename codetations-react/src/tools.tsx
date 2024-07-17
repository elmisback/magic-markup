import { AnnotationEditorProps } from "./App";
import React from "react";
import { useState, useEffect } from "react";
import MarkdownComment from "./applications/src/MarkdownComment";

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
  const [code, setCode] = useState(props.utils.getText());

  function runCode(): void {
    console.log("Running code:", code);
    try {
      const result = new Function(code)();
      console.log(result)
      props.utils.setMetadata({ response: result, error: null });
    } catch (e) {
      props.utils.setMetadata({
        response: null,
        error: e instanceof Error ? e.message : e,
      });
    }
  }

  return (
    <div>
      {props.value.metadata.error && (
        <div style={{ color: "red" }}>
          An error occured: {props.value.metadata.error}
        </div>
      )}
      {props.value.metadata.response && (
        <div>Response: &nbsp; {props.value.metadata.response}</div>
      )}
      <textarea value={code} onChange={(e) => setCode(e.target.value)} />
      <br></br>
      <button onClick={runCode}>Run Highlighted Code</button>
      <br></br>
      <button
        onClick={() => props.utils.setMetadata({ response: null, error: null })}
      >
        Clear Output
      </button>
    </div>
  );
};

/* TODO: Define additional tools as React components here. */

/* TODO: Add all tools to be used here. */
export const tools = {
  comment: Comment,
  colorPicker: ColorPicker,
  runCodeSegment: RunCodeSegment,
  markdownComment: MarkdownComment
};
