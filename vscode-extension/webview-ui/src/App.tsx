import { vscode } from "./utilities/vscode";
import "./App.css";
import Annotation from "./Annotation";
import { tools } from "./tools";
import React, { useState } from "react";

interface AnnotationUpdate {
  document?: string;
  metadata?: any;
}

export interface AnnotationEditorProps {
  value: Annotation;
  setValue: (value: AnnotationUpdate) => void;
  utils?: any;
}

type ToolTypes = {
  [key: string]: React.FC<AnnotationEditorProps>;
};

const toolTypes: ToolTypes = {
  ...tools,
};

function AnnotationEditorContainer(props: {
  value: Annotation;
  setValue: (value: AnnotationUpdate) => void;
  hoveredAnnotation: Annotation | null;
  selectedAnnotation: Annotation | undefined;
  setSelectedAnnotation: (value: Annotation | undefined) => void;
}) {
  const { value, setValue, setSelectedAnnotation } = props;

  const handleClick = () => {
    setSelectedAnnotation(value);

    // Find the element by ID and scroll into view
    const startElement = document.getElementById(`annotation-${value.start}`);
    if (startElement) {
      startElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const style = {
    backgroundColor:
      props.selectedAnnotation === value
        ? "lightgreen"
        : props.hoveredAnnotation === value
        ? "lightgray"
        : "transparent",
  };

  return (
    <div className="annotation-container" style={style} onClick={handleClick}>
      {/* <h2>Annotation</h2>*/}
      {/* <div>Start: {value.start}</div>
      <div>End: {value.end}</div>
      <div>Document: {value.document}</div>
      <div>Tool: {value.tool}</div>
      <div>Metadata: {JSON.stringify(value.metadata)}</div>
      <div>Original Document: {value.original.document}</div>
      <div>Original Start: {value.original.start}</div>
      <div>Original End: {value.original.end}</div> */}
      {/* <div>Editor:</div> */}
      {toolTypes[value.tool]?.({
        value,
        setValue: (v: AnnotationUpdate) =>
          setValue({ ...value, document: v.document, metadata: v.metadata }),
        utils: {
          getText: () => value.document.slice(value.start, value.end),
          setText: (newText: string) => {
            setValue({
              document:
                value.document.slice(0, value.start) + newText + value.document.slice(value.end),
              metadata: value.metadata,
            });
          },
          setMetadata: (newMetadata: any) => {
            setValue({
              document: value.document,
              metadata: { ...value.metadata, ...newMetadata },
            });
          },
        },
      })}
    </div>
  );
}

function App() {
  const [filePath, setFilePath] = useState("");

  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.command) {
      case "setFilepath":
        setFilePath(message.filepath);
    }
  });

  const annotations = {
    annotations: [
      {
        document:
          "This hex code has a color picker: #80ffff\nSo does this one: #a8d7bd\n(added a new line)",
        start: 34,
        end: 41,
        tool: "colorPicker",
        metadata: {},
        original: {
          document: "test original document #0000FF",
          start: 23,
          end: 31,
        },
      },
      {
        start: 60,
        end: 67,
        document:
          "This hex code has a color picker: #80ffff\nSo does this one: #a8d7bd\n(added a new line)",
        tool: "colorPicker",
        metadata: {},
        original: {
          document:
            "This hex code has a color picker: #80ffff\nSo does this one: #80ffff\nAnd this one: #80ffff",
          start: 60,
          end: 67,
        },
      },
      {
        start: 77,
        end: 80,
        document:
          "This hex code has a color picker: #80ffff\nSo does this one: #a8d7bd\n(added a new line)",
        tool: "comment",
        metadata: {
          comment: "abcde",
        },
        original: {
          document:
            "This hex code has a color picker: #80ffff\nSo does this one: #a8d7bd\n(added a new line)",
          start: 77,
          end: 80,
        },
      },
    ],
  };

  return (
    <main>
      <h1>Annotations</h1>
      <ul>
        {annotations.annotations.map((annotation, index) => (
          <li key={index}>
            <p>Document: {annotation.document}</p>
            <p>Start: {annotation.start}</p>
            <p>End: {annotation.end}</p>
            <p>Tool: {annotation.tool}</p>
            <p>Metadata: {JSON.stringify(annotation.metadata)}</p>
            <p>Original Document: {annotation.original.document}</p>
            <p>Original Start: {annotation.original.start}</p>
            <p>Original End: {annotation.original.end}</p>
          </li>
        ))}
      </ul>
      {annotations.annotations.map((annotation, index) => (
        <AnnotationEditorContainer
          key={index}
          value={annotation}
          setValue={(value) => {
            annotations.annotations[index] = { ...annotations.annotations[index], ...value };
          }}
          hoveredAnnotation={null}
          selectedAnnotation={undefined}
          setSelectedAnnotation={() => {}}
        />
      ))}
      <h2>Filepath</h2>
      <text>{filePath}</text>
      <button onClick={() => vscode.postMessage({ command: "getFilepath" })}>
        Update Filepath
      </button>
    </main>
  );
}

export default App;
