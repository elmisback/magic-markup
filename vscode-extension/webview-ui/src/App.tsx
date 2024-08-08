import { vscode } from "./utilities/vscode";
import "./App.css";
import Annotation from "./Annotation";
import { tools } from "./tools";
import React, { useState, useEffect } from "react";

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

type RetagFunction = (oldDocument: string, currentDocument: string, annotation: Annotation) => Annotation | undefined;

type OutOfDateFunction = (oldDocument: string, currentDocument: string) => boolean;

type SetAnnotationsHandler = (setAnnotations: (annotations: Annotation[]) => void) => void;
/* Basically, we want to write a component like this:

<AnnotationSidebarView annotations={annotations} setAnnotations={setAnnotations}  // annotation setter and getter
  currentLineNumber={} // line number, so we can scroll to the most relevant annotation
  
  selectedAnnotation={} setSelectedAnnotation={} // annotation that is currently selected, if any
  hoveredAnnotation={} setHoveredAnnotation={} // annotation that is currently hovered, if any
  />
  
  <AnnotationSyncer annotations={} setAnnotations={}

  // These parts are separate and handle keeping the annotations up to date
  documentOutOfDate={OutOfDateFunction} currentDocument={} retag={RetagFunction} // functions to watch the document and retag it when it is out of date
  />

  when the currentDocument changes, call retag on each annotation and setAnnotations to the new annotations

  when the currentLineNumber changes, scroll to the annotation with the closest start value

  when the selectedAnnotation changes, scroll to that annotation

This shows a view of the annotations.
*/

function AnnotationSidebarView(props: {
  annotations: Annotation[];
  setAnnotations: (annotations: Annotation[]) => void;
  currentLineNumber: number;
  selectedAnnotation: Annotation | undefined;
  setSelectedAnnotation: (annotation: Annotation | undefined) => void;
  hoveredAnnotation: Annotation | null;
  setHoveredAnnotation: (annotation: Annotation | null) => void;
}) {
  const { annotations, setAnnotations } = props;
  return <>
    <h1>Annotations</h1>
    {/* <ul>
      {annotations.map((annotation, index) => (
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
    </ul> */}
    {annotations.map((annotation, index) => (
      <AnnotationEditorContainer
        key={index}
        value={annotation}
        setValue={(value) => {
          annotations[index] = { ...annotations[index], ...value };
          setAnnotations(annotations);
        }}
        hoveredAnnotation={null}
        selectedAnnotation={undefined}
        setSelectedAnnotation={() => { }}
      />
    ))}
  </>
}

const annotationsDefault: { annotations: Annotation[] } = {
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

/* Generic function to use a document from a WebSocket server,
   with a read and write callback to convert between the document and an object type if needed
*/
function useDocumentFromWSFileServer(serverUrl: string | undefined, documentURI: string | undefined,
  readCallback: (document: string) => any = document => document,
  writeCallback: (object: any) => string = document => document
) {
  // TODO May want to read up on how to do websockets with React properly, 
  // e.g. https://stackoverflow.com/questions/60152922/proper-way-of-using-react-hooks-websockets
  const [document, setDocument] = useState(undefined as (string | undefined));

  if (!serverUrl || !documentURI) {
    return [undefined, undefined];
  }

  const ws = new WebSocket(serverUrl);

  ws.onmessage = (event) => {
    try {
      const document = event.data;
      readCallback(document);
    } catch (error) {
      console.error('Error parsing JSON: ', error);
    };
  }

  ws.onopen = () => {
    // Send message to server to start listening to document updates
    ws.send(JSON.stringify({
      type: 'listen',
      documentURI
    }));
  };

  const updateDocumentState = (object: any) => {
    ws.send(JSON.stringify({
      type: 'write',
      documentURI,
      state: writeCallback(object)
    }));
  }

  return [document, updateDocumentState];
}

function useObjectFromWSFileServer(serverUrl: string | undefined, documentURI: string | undefined) {
  // Handles JSON parsing/stringify and errors
  useDocumentFromWSFileServer(serverUrl, documentURI,
    document => {
      try {
        return JSON.parse(document);
      } catch (error) {
        console.error('Error parsing JSON: ', error);
      }
    },
    object => JSON.stringify(object)
  );
}

function listenForEditorMessages(
  setDocumentURI: (documentURI: string) => void,
  setAnnotationURI: (annotationURI: string) => void,
  setServerUrl: (serverUrl: string) => void,
  setCurrentLineNumber: (currentLineNumber: number) => void
) {
  window.addEventListener("message", (event) => {
    console.debug("Codetations: webview received message:", event); 
    const message = JSON.parse(event.data);
    console.debug("Codetations: webview message command:", message.command);
    console.debug("Codetations: webview message data:", message.data);
    const data = message.data;
    switch (message.command) {
      // case "test":
      //   console.log("Test message received");
      //   break;
      case "setDocumentURI":
        setDocumentURI(data.documentURI);
        break;
      case "setAnnotationURI":
        setAnnotationURI(data.annotationURI);
        break;
      case "setServerUrl":
        setServerUrl(data.serverUrl);
        break;
      case "setCurrentLineNumber":
        setCurrentLineNumber(data.currentLineNumber);
        break;
      default:
        break;
    }
  });
}

function App() {
  // Data source configuration
  const [annotationURI, setAnnotationURI] = useState(undefined as string | undefined);
  const [documentURI, setDocumentURI] = useState(undefined as string | undefined);
  const [serverUrl, setServerUrl] = useState(undefined as string | undefined);

  // Data
  const [annotations, setAnnotations] = useState(annotationsDefault); // useObjectFromWSServer("ws://localhost:8073", annotationURI);
  const [currentDocument, setCurrentDocument] = useDocumentFromWSFileServer(serverUrl, documentURI)

  // Transient editor + UI state
  const [currentLineNumber, setCurrentLineNumber] = useState(undefined as number | undefined);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(undefined as number | undefined);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState(undefined as number | undefined);

  // Listen for configuration updates from editor
  listenForEditorMessages(setDocumentURI, setAnnotationURI, setServerUrl, setCurrentLineNumber);



  return (
    <main>
      <AnnotationSidebarView annotations={annotations.annotations} setAnnotations={(annotations) => { }} currentLineNumber={0} selectedAnnotation={undefined} setSelectedAnnotation={() => { }} hoveredAnnotation={null} setHoveredAnnotation={() => { }} />
      <button>
        Retag
      </button>
    </main>
  );
}

export default App;
