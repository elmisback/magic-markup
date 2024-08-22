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

/* Generic function to use a document from a WebSocket server,
   with a read and write callback to convert between the document and an object type if needed
*/
function _useDocumentFromWSFileServer<T>(
  serverUrl: string | undefined,
  documentURI: string | undefined,
  readCallback: (document: string) => T | undefined,
  serializeCallback: (object: T) => string
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
  return _useDocumentFromWSFileServer(
    serverUrl,
    documentURI,
    (document) => document,
    (document) => document
  );
}

function useObjectFromWSFileServer<T>(
  serverUrl: string | undefined,
  documentURI: string | undefined
) {
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
      return JSON.stringify(object);
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

// TODO refactor to not use a wrapper function
const useRetagFromAPI =
  (retagServerUrl: string) =>
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
        delimiter
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
  setRetagServerURL: (retagServerURL: string) => void,
  handleAddAnnotation: (start: number, end: number, document: string) => void,
  setChooseAnnotationType: (chooseAnnotationType: boolean) => void,
  setStart: (start: number) => void,
  setEnd: (end: number) => void,
  setDocumentContent: (documentContent: string) => void
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
        return;
      case "setAnnotationsURI":
        setAnnotationURI(data.annotationsURI);
        return;
      case "setFileServerURL":
        setFileServerURL(data.fileServerURL);
        return;
      case "setCurrentLineNumber":
        setCurrentLineNumber(data.currentLineNumber);
        return;
      case "setRetagServerURL":
        setRetagServerURL(data.retagServerURL);
        return;
      case "addAnnotation":
        handleAddAnnotation(data.start, data.end, data.documentContent);
        return;
      case "chooseAnnotationType":
        setChooseAnnotationType(true);
        setStart(data.start);
        setEnd(data.end);
        setDocumentContent(data.documentContent);
        vscode.setState({
          chooseAnnotationType: true,
          start: data.start,
          end: data.end,
          documentContent: data.documentContent,
        });
        return;
      default:
        return;
    }
  });
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
  const [annotationState, setAnnotationState] = useObjectFromWSFileServer<State>(
    fileServerURL,
    annotationURI
  ); // useState(annotationsDefault.annotations); //
  const [currentDocument, setCurrentDocument] = useDocumentFromWSFileServer(
    fileServerURL,
    documentURI
  );

  const annotations = annotationState?.annotations || [];
  const setAnnotations = (annotations: Annotation[]) => {
    if (!setAnnotationState) {
      console.error("No setAnnotationState function yet");
      return;
    }
    setAnnotationState({ annotations });
  };

  // Transient editor + UI state
  const prevState = vscode.getState();
  const [currentLineNumber, setCurrentLineNumber] = useState(undefined as number | undefined);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(undefined as number | undefined);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState(undefined as number | undefined);
  const [error, setError] = useState(undefined as string | undefined);
  const [chooseAnnotationType, setChooseAnnotationType] = useState(
    prevState?.chooseAnnotationType || false
  );
  const [start, setStart] = useState(prevState?.start || undefined);
  const [end, setEnd] = useState(prevState?.end || undefined);
  // TODO: make sure this state doesn't persist after user selects tool
  // It shouldn't because I reset the state after the user selects a tool
  const [documentContent, setDocumentContent] = useState(prevState?.documentContent || undefined);
  const defaultTool: string | undefined =
    Object.keys(toolTypes).length > 0 ? Object.keys(toolTypes)[0] : undefined;
  const [newTool, setNewTool] = useState(prevState?.newTool || (defaultTool as string | undefined));
  // Other configuration
  const [retagServerURL, setRetagServerURL] = useState(undefined as string | undefined);

  // Set up retagging function
  const retag = retagServerURL ? useRetagFromAPI(retagServerURL) : undefined;

  const handleAddAnnotation = (start: number, end: number, documentContent: string) => {
    // Ensure all required variables for annotation are defined
    console.log("START: " + start);
    console.log("END: " + end);
    if (!start || !end) {
      setError("Error adding annotations: no highlighted text");
      return;
    } else if (start === end) {
      setError("Error adding annotations: selection must not be empty");
      return;
    } else if (!documentContent) {
      setError("Error adding annotations: no document content");
      return;
    } else if (!newTool) {
      setError("Error adding annotations: no tool selected");
      return;
    }

    // Create new annotation based on message
    const newAnnotation: Annotation = {
      start,
      end,
      document: documentContent,
      tool: newTool,
      metadata: {},
      original: {
        document: documentContent,
        start,
        end,
      },
    };
    setAnnotations([...annotations, newAnnotation]);
    setError(undefined);
  };

  // Listen for configuration updates from editor
  listenForEditorMessages(
    setDocumentURI,
    setAnnotationURI,
    setFileServerUrl,
    setCurrentLineNumber,
    setRetagServerURL,
    handleAddAnnotation,
    setChooseAnnotationType,
    setStart,
    setEnd,
    setDocumentContent
  );

  const documentOutOfDate =
    annotations &&
    annotations.some((annotation: Annotation) => {
      return annotation.document !== currentDocument;
    });

  if (!chooseAnnotationType) {
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
          Tool: &nbsp;
          {/* select with dropdown */}
          {/* <input type="text" value={addTool} onChange={e => setAddTool(e.target.value)} /> */}
          <select
            value={newTool}
            onChange={(e) => {
              setNewTool(e.target.value);
              vscode.setState({ newTool: e.target.value, chooseAnnotationType: false });
            }}>
            {Object.keys(toolTypes).map((toolKey) => (
              <option key={toolKey} value={toolKey}>
                {toolKey}
              </option>
            ))}
          </select>
        </div>
        <div>
          <text>{error}</text>
          <br></br>
          <button onClick={() => setError(undefined)}>Clear Error</button>
        </div>
      </main>
    );
  } else {
    return (
      <main>
        <div>Choose Annotation Type</div>
        <select
          value={newTool}
          onChange={(e) => {
            setNewTool(e.target.value);
            vscode.setState({ newTool: e.target.value });
          }}>
          {Object.keys(toolTypes).map((toolKey) => (
            <option key={toolKey} value={toolKey}>
              {toolKey}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            handleAddAnnotation(start, end, documentContent);
            setChooseAnnotationType(false);
            setStart(undefined);
            setEnd(undefined);
            setDocumentContent(undefined);
            vscode.setState({ chooseAnnotationType: false });
          }}>
          Submit
        </button>
      </main>
    );
  }
}

export default App;
