import { AnnotationEditorProps } from "./App";
import React from "react";
import { useState, useEffect } from "react";

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
  useEffect(() => {
    props.utils.setMetadata({ code: props.utils.getText() });
  }, []); // Empty dependency array ensures this runs only once after mount

  function runCode(): void {
    try {
      if (!props.value.metadata.code) {
        props.utils.setMetadata({
          error: "No code to run",
          response: undefined,
        });
        return;
      }
      const result = new Function(props.value.metadata.code)();
      props.utils.setMetadata({ response: result, error: undefined });
    } catch (e) {
      props.utils.setMetadata({
        response: undefined,
        error: e instanceof Error ? e.message : String(e),
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
      <textarea
        value={props.value.metadata.code || ""}
        onChange={(e) => props.utils.setMetadata({ code: e.target.value })}
      />
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
};
