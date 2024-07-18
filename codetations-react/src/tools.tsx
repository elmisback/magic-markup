import { AnnotationEditorProps } from "./App";
import React, { TextareaHTMLAttributes } from "react";
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

const ImageUpload: React.FC<AnnotationEditorProps> = (props) => {
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && event.target.result) {
          props.utils.setMetadata({ image: event.target.result as string });
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleImageUpload} />
      {props.value.metadata.image && (
        <img src={props.value.metadata.image} alt="Uploaded" />
      )}
    </div>
  );
};

const DisplayHTML: React.FC<AnnotationEditorProps> = (props) => {
  const [htmlContent, setHtmlContent] = useState(
    props.value.metadata.html || ""
  );

  const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    const newHtmlContent = e.target.value;
    setHtmlContent(newHtmlContent);
    props.utils.setMetadata({ html: newHtmlContent });
  };

  return (
    <div>
      <textarea
        value={htmlContent}
        onChange={handleChange}
        placeholder="Write your HTML code here"
        style={{ width: "100%", height: "150px" }}
      />
      <div
        style={{ marginTop: "10px", border: "1px solid #ccc", padding: "10px" }}
      >
        <h3>Preview:</h3>
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      </div>
    </div>
  );
};

const RunCodeSegment: React.FC<AnnotationEditorProps> = (props) => {
  const [code, setCode] = useState(props.value.metadata.code || "");

  function addReturn(code: string): string {
    // Match the last line in the string
    const lines: Array<String> = code.trim().split("\n");

    if (lines.length === 0) {
      return "";
    }

    const lastLine = lines[lines.length - 1];
    lines[lines.length - 1] = `return ${lastLine.trim()}`;

    return lines.join("\n");
  }

  function runAndUpdateCode(): void {
    try {
      if (code === "") {
        props.utils.setMetadata({
          error: "No code to run",
          response: undefined,
          code: code,
        });
        return;
      }
      let result = new Function(code)();
      if (result === undefined) {
        const newCode: string = addReturn(code);
        try {
          result = new Function(newCode)();
        } catch {}
      }
      props.utils.setMetadata({
        response: result || "Undefined",
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
      <textarea
        rows={4}
        cols={72}
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
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
  imageUpload: ImageUpload,
  displayHTML: DisplayHTML,
};
