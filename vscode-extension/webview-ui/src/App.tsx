import { vscode } from "./utilities/vscode";
import "./App.css";
import Annotation from "./Annotation";
import { tools } from "./tools";
import React, { useState, useEffect, useRef } from "react";
import * as path from "path";

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

type RetagFunction = (
  currentDocument: string,
  annotation: Annotation
) => Promise<Annotation | undefined>;

function AnnotationSidebarView(props: {
  annotations: Annotation[];
  setAnnotations: (annotations: Annotation[]) => void;
  currentLineNumber: number | undefined;
  selectedAnnotationId: number | undefined;
  setSelectedAnnotationId: (id: number | undefined) => void;
  hoveredAnnotationId: number | undefined;
  setHoveredAnnotationId: (id: number | undefined) => void;
}) {
  const { annotations, setAnnotations } = props;
  return (
    <>
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
          setSelectedAnnotation={() => {}}
        />
      ))}
    </>
  );
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
function _useDocumentFromWSFileServer<T>(
  serverUrl: string | undefined,
  documentURI: string | undefined,
  readCallback: (document: string) => T | undefined,
  serializeCallback: (object: T) => string,
): [T | undefined, ((object: T) => void) | undefined] {
  const [document, setDocument] = useState(undefined as T | undefined);
  // Uses refs to do websockets with React properly (open single socket connection)
  // TODO may need to handle closing etc. properly
  // see https://stackoverflow.com/questions/60152922/proper-way-of-using-react-hooks-websockets
  const wsRef = useRef<WebSocket | undefined>(undefined);

  useEffect(() => {
    console.log("Opening WebSocket connection for document:", documentURI);
    if (!serverUrl || !documentURI) {
      return;
    }
    const ws = new WebSocket(serverUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const document = event.data;
        setDocument(readCallback(document));
      } catch (error) {
        console.error("Error parsing JSON: ", error);
      }
    };

    ws.onopen = () => {
      // Send message to server to start listening to document updates
      ws.send(
        JSON.stringify({
          type: "listen",
          documentURI,
        })
      );
    };

    return () => {
      console.log("Closing WebSocket connection");
      wsRef.current && ws.close();
    };
  }, [serverUrl, documentURI]);

  if (!serverUrl || !documentURI) {
    return [undefined, undefined];
  }

  const updateDocumentState = (object: T) => {
    if (!wsRef.current) {
      console.error("No WebSocket connection");
      return;
    }
    console.log("Sending update to server:", object);
    wsRef.current.send(
      JSON.stringify({
        type: "write",
        documentURI,
        state: serializeCallback(object),
      })
    );
  };

  return [document, updateDocumentState];
}

function useDocumentFromWSFileServer(
  serverUrl: string | undefined,
  documentURI: string | undefined
) {
  return _useDocumentFromWSFileServer(serverUrl, documentURI, 
    (document) => document,
    (document) => document
  );
}

function useObjectFromWSFileServer<T>(serverUrl: string | undefined, documentURI: string | undefined) {
  // Handles JSON parsing/stringify and errors
  return _useDocumentFromWSFileServer<T>(
    serverUrl,
    documentURI,
    (document) => {
      try {
        return JSON.parse(document) as T | undefined;
      } catch (error) {
        console.error("Error parsing JSON: ", error);
      }
    },
    (object: T) => {
      console.log("Serializing object:", object);
      return JSON.stringify(object)
    }
  );
}

const preprocessAnnotation = (annotation: Annotation) => {
  const oldDocumentContent = annotation.document;
  const codeUpToSnippet = oldDocumentContent.slice(0, annotation.start);
  const codeAfterSnippet = oldDocumentContent.slice(annotation.end);
  const annotationText = oldDocumentContent.slice(annotation.start, annotation.end);
  const delimiter = "★";
  const codeWithSnippetDelimited =
    codeUpToSnippet + delimiter + annotationText + delimiter + codeAfterSnippet;
  return {
    codeWithSnippetDelimited,
    delimiter,
  };
};

const useRetagFromAPI =
  (retagServerUrl: string, APIKey: string) =>
  async (currentDocument: string, annotation: Annotation) => {
    console.debug("Retagging annotation:", annotation);
    const { codeWithSnippetDelimited, delimiter } = preprocessAnnotation(annotation);

    const output = await fetch(retagServerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        codeWithSnippetDelimited,
        updatedCodeWithoutDelimiters: currentDocument,
        delimiter,
        APIKey,
      }),
    }).then((res) => res.json());

    // update the annotation
    console.log("Output:", output);
    return {
      ...annotation,
      document: currentDocument,
      start: output.out.leftIdx,
      end: output.out.rightIdx,
    };
  };

function RetagHeadlineWarning(props: {
  currentDocument: string | undefined;
  annotations: Annotation[];
  setAnnotations: (annotations: Annotation[]) => void;
  retag: RetagFunction | undefined;
}) {
  const { currentDocument, annotations, setAnnotations, retag } = props;

  return (
    <>
      {currentDocument && (
        <>
          Document is out of date!
          {retag && (
            <button
              onClick={async () => {
                // Update the annotations after awaiting retagging promises
                const newAnnotations = await Promise.all(
                  annotations.map(async (annotation) => {
                    // TODO error handling
                    return (await retag(currentDocument, annotation)) || annotation;
                  })
                );
                setAnnotations(newAnnotations);
              }}>
              Retag
            </button>
          )}
        </>
      )}
    </>
  );
}

function listenForEditorMessages(
  setDocumentURI: (documentURI: string) => void,
  setAnnotationURI: (annotationURI: string) => void,
  setFileServerURL: (serverUrl: string) => void,
  setCurrentLineNumber: (currentLineNumber: number) => void,
  setRetagServerURL: (retagServerURL: string) => void
) {
  window.addEventListener("message", (event) => {
    console.debug("Codetations: webview received message:", event);
    const message = JSON.parse(event.data);
    console.debug("Codetations: webview message command:", message.command);
    console.debug("Codetations: webview message data:", message.data);
    const data = message.data;
    switch (message.command) {
      case "setDocumentURI":
        setDocumentURI(data.documentURI);
        break;
      case "setAnnotationsURI":
        setAnnotationURI(data.annotationsURI);
        break;
      case "setFileServerURL":
        setFileServerURL(data.fileServerURL);
        break;
      case "setCurrentLineNumber":
        setCurrentLineNumber(data.currentLineNumber);
        break;
      case "setRetagServerURL":
        setRetagServerURL(data.retagServerURL);
        break;
      default:
        break;
    }
  });
}

function handleAddAnnotation(annotations: Annotation[], stateURI: string) {
  if (!stateURI) {
    console.error("No document URI");
    return;
  }
}

type State = {
  annotations: Annotation[];
};

function App() {
  // Data source configuration
  const [fileServerURL, setFileServerUrl] = useState(undefined as string | undefined);
  const [annotationURI, setAnnotationURI] = useState(undefined as string | undefined);
  const [documentURI, setDocumentURI] = useState(undefined as string | undefined);

  // Data
  const [annotationState, setAnnotationState] = useObjectFromWSFileServer<State>(fileServerURL, annotationURI); // useState(annotationsDefault.annotations); // 
  const [currentDocument, setCurrentDocument] = useDocumentFromWSFileServer(
    fileServerURL,
    documentURI
  );

  const annotations = annotationState?.annotations || []
  const setAnnotations = (annotations: Annotation[]) => {
    if (!setAnnotationState) {
      console.error("No setAnnotationState function yet");
      return;
    }
    setAnnotationState({ annotations });
  }

  // Transient editor + UI state
  const [currentLineNumber, setCurrentLineNumber] = useState(undefined as number | undefined);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(undefined as number | undefined);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState(undefined as number | undefined);

  // Other configuration
  const [retagServerURL, setRetagServerURL] = useState(undefined as string | undefined);
  const [APIKey, setAPIKey] = useState(
    // HACK For now, use browser storage to initialize API key
    () => window.localStorage.getItem("APIKey") || undefined
  );

  // Listen for configuration updates from editor
  listenForEditorMessages(
    setDocumentURI,
    setAnnotationURI,
    setFileServerUrl,
    setCurrentLineNumber,
    setRetagServerURL
  );

  // Set up retagging function
  const retag = retagServerURL && APIKey ? useRetagFromAPI(retagServerURL, APIKey) : undefined;

  const documentOutOfDate = annotations && annotations.some((annotation: Annotation) => {
    return annotation.document !== currentDocument;
  });

  return (
    <main>
      {documentOutOfDate && (
        <RetagHeadlineWarning
          currentDocument={currentDocument}
          annotations={annotations}
          setAnnotations={setAnnotations}
          retag={retag}
        />
      )}
      <AnnotationSidebarView
        annotations={annotations}
        setAnnotations={(annotations) => {}}
        currentLineNumber={currentLineNumber}
        selectedAnnotationId={selectedAnnotationId}
        setSelectedAnnotationId={() => {}}
        hoveredAnnotationId={hoveredAnnotationId}
        setHoveredAnnotationId={() => {}}
      />

      {/* Show document content in a div for testing */}
      <div>
        <h1>Document</h1>
        <pre>{currentDocument}</pre>
      </div>
      <div>
        <button disabled={!documentURI} onClick={() => setAnnotations(annotations)}>
          Add Annotation
        </button>
      </div>
    </main>
  );
}

export default App;
