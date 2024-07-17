import { AnnotationEditorProps } from "./App";
import React from "react";
import { useState, useEffect } from "react";
import { ObjectInspector } from "react-inspector";
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
  const [code, setCode] = useState(props.value.metadata.code || "");

  function addReturn(code: string): string {
    // Match the last line in the string
    const regex = /.*$/gm;
    const lines = code.match(regex);

    if (!lines) {
      return "";
    }

    // Get the last line
    const lastLine = lines[lines.length - 1];

    // Replace the last line with 'return ' prepended to it
    const updatedCode = code.replace(lastLine, "return " + lastLine);

    return updatedCode;
  }

  function runAndUpdateCode(): void {
    try {
      if (!props.value.metadata.code) {
        props.utils.setMetadata({
          error: "No code to run",
          response: undefined,
          code: code,
        });
        return;
      }
      let result = new Function(props.value.metadata.code)();
      if (result === undefined) {
        const newCode: string = addReturn(props.value.metadata.code);
        try {
          result = new Function(newCode)() || "Undefined";
        } catch {}
      }
      props.utils.setMetadata({
        response: result,
        error: undefined,
        code: code,
      });
    } catch (e) {
      props.utils.setMetadata({
        response: undefined,
        error: e instanceof Error ? e.message : String(e),
        code: code,
      });
    }
  }

  return (
    <div>
      {props.value.metadata.error && (
        <div style={{ color: "red" }}>
          An error occurred: {props.value.metadata.error}
        </div>
      )}
      {props.value.metadata.response && (
        <div>
          Response: &nbsp;{" "}
          <ObjectInspector data={props.value.metadata.response} />
        </div>
      )}
      <textarea value={code} onChange={(e) => setCode(e.target.value)} />
      <br></br>
      <button onClick={runAndUpdateCode}>Run Highlighted Code</button>
      <br></br>
      <button
        onClick={() =>
          props.utils.setMetadata({
            response: undefined,
            error: undefined,
          })
        }
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
  markdownComment: MarkdownComment,
};
