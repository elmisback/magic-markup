import { vscode } from "./utilities/vscode";
import "./App.css";
import Annotation from "./Annotation";
import { tools } from "./tools";
import React, { CSSProperties, useState, useEffect, useRef } from "react";

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
  hoveredAnnotationId: string | undefined;
  setHoveredAnnotationId: (value: string | undefined) => void;
  selectedAnnotationId: string | undefined;
  setSelectedAnnotationId: (value: string | undefined) => void;
}) {
  const { value, setValue, setSelectedAnnotationId } = props;

  const handleClick = () => {
    setSelectedAnnotationId(value.id);

    // Find the element by ID and scroll into view
    const startElement = document.getElementById(`annotation-${value.start}`);
    if (startElement) {
      startElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const style: CSSProperties = {
    border:
      props.selectedAnnotationId === value.id
        ? "1px solid lightgreen"
        : props.hoveredAnnotationId === value.id
        ? "1px solid lightgray"
        : "1px solid transparent",
    padding: "8px",
    boxSizing: "border-box",
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
  setCurrentDocument: ((document: string) => void) | undefined;
  charNum: number | undefined;
  selectedAnnotationId: string | undefined;
  setSelectedAnnotationId: (id: string | undefined) => void;
  hoveredAnnotationId: string | undefined;
  setHoveredAnnotationId: (id: string | undefined) => void;
}) {
  const { annotations, setAnnotations, charNum } = props;
  const annotationRefs = useRef<(HTMLDivElement | null)[]>([]);

  const findClosestAnnotationIndex = (annotations: Annotation[], charNum: number) => {
    let closestIndex = -1;
    let closestDistance = Infinity;
    annotations.forEach((annotation, index) => {
      const distance = Math.min(
        Math.abs(annotation.start - charNum),
        Math.abs(annotation.end - charNum)
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    return closestIndex;
  };

  useEffect(() => {
    if (charNum !== undefined) {
      const closestAnnotationIndex = findClosestAnnotationIndex(annotations, charNum);
      if (closestAnnotationIndex !== -1 && annotationRefs.current[closestAnnotationIndex]) {
        annotationRefs.current[closestAnnotationIndex]?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [charNum, annotations]);

  const key = (fn: (a: any) => number) => (a: Annotation, b: Annotation) =>
    fn(a) < fn(b) ? -1 : fn(a) > fn(b) ? 1 : 0;

  // HACK to add IDs to annotations
  annotations.map((a, i) => {
    a.id = i.toString();
  });

  return (
    <>
      <h3>Annotations</h3>
      {[...annotations].sort(key((a: Annotation) => a.start)).map((annotation, index) => (
        <div key={index} ref={(ref) => (annotationRefs.current[index] = ref)}>
          <AnnotationEditorContainer
            key={index}
            value={annotation}
            setValue={(value) => {
              console.log("Setting annotation:", value);
              // annotations[index] = { ...annotations[index], ...value };
              const newAnnotations = annotations.map((a) =>
                a.id === annotation.id ? { ...a, ...value } : a
              );
              console.log("New annotations:", newAnnotations);
              setAnnotations(newAnnotations);
              if (value.document) {
                props.setCurrentDocument && props.setCurrentDocument(value.document);
              }
            }}
            hoveredAnnotationId={props.hoveredAnnotationId}
            setHoveredAnnotationId={props.setHoveredAnnotationId}
            selectedAnnotationId={props.selectedAnnotationId}
            setSelectedAnnotationId={props.setSelectedAnnotationId}
          />
        </div>
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
      const document = event.data;
      setDocument(readCallback(document));
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
    console.debug("Sending update to server:", object, documentURI, serializeCallback(object));
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
      console.debug("Parsing document:", documentURI);
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
  (retagServerUrl: string) => async (currentDocument: string, annotation: Annotation) => {
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
  setCharNum: (charNum: number) => void,
  setRetagServerURL: (retagServerURL: string) => void,
  handleAddAnnotation: (start: number, end: number) => void,
  handleRemoveAnnotation: () => void,
  handleSetAnnotationColor: (color: string) => void,
  handleChooseAnnType: (start: number, end: number, documentContent: string) => void,
  updateAnnotationDecorations: (position: number) => void
) {
  const handleMessage = (event: any) => {
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
      case "handleCursorPositionChange":
        setCharNum(data.position);
        return;
      case "setRetagServerURL":
        setRetagServerURL(data.retagServerURL);
        return;
      case "addAnnotation":
        handleAddAnnotation(data.start, data.end);
        return;
      case "removeAnnotation":
        handleRemoveAnnotation();
        return;
      case "setAnnotationColor":
        handleSetAnnotationColor(data.color);
        return;
      case "chooseAnnotationType":
        handleChooseAnnType(data.start, data.end, data.documentContent);
        return;
      case "handleFileEdit":
        updateAnnotationDecorations(data.position);
        return;
      default:
        return;
    }
  };
  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
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

  const showErrorMessage = (error: string) => {
    console.log("Show error called, error: " + error);
    vscode.postMessage({
      command: "showErrorMessage",
      data: {
        error,
      },
    });
  };

  const handleChooseAnnType = (start: number, end: number, documentContent: string) => {
    setChooseAnnotationType(true);
    setStart(start);
    setEnd(end);
    setTempDocumentContent(documentContent);
  };

  const handleAddAnnotationConf = () => {
    // Update state once confirm is clicked
    setConfirmAnnotation(false);
    setChooseAnnotationType(false);

    if (!start || !end) {
      showErrorMessage("Error adding annotations: no highlighted text");
      return;
    }

    if (currentDocument !== tempDocumentContent) {
      // Ensure file hasn't been changed since annotation was added
      showErrorMessage("Document content has changed since annotation was added");
      return;
    }

    for (let i = 0; i < annotations.length; i++) {
      if (annotations[i].start === start && annotations[i].end === end) {
        showErrorMessage("Error adding annotations: annotation already exists in selected area");
        return;
      }
    }

    // Ensure all required variables for annotation are defined
    console.log("START: " + start);
    console.log("END: " + end);
    if (start === end) {
      showErrorMessage("Error adding annotations: selection must not be empty");
      return;
    } else if (!tempDocumentContent) {
      showErrorMessage("Error adding annotations: no document content");
      return;
    } else if (!newTool) {
      showErrorMessage("Error adding annotations: no tool selected");
      return;
    }

    // Create new annotation based on message
    const newAnnotation: Annotation = {
      id: annotations.length.toString(),
      start,
      end,
      document: tempDocumentContent,
      tool: newTool,
      metadata: {},
      original: {
        document: tempDocumentContent,
        start,
        end,
      },
    };
    setAnnotations([...annotations, newAnnotation]);
    setTempDocumentContent(undefined);
  };

  const annotations = annotationState?.annotations || [];
  const setAnnotations = (annotations: Annotation[]) => {
    if (!setAnnotationState) {
      console.error("No setAnnotationState function yet");
      return;
    }
    setAnnotationState({ annotations });
  };

  const handleAddAnnotation = (start: number, end: number) => {
    setConfirmAnnotation(true);
    setStart(start);
    setEnd(end);
    setTempDocumentContent(currentDocument);
  };

  const handleRemoveAnnotation = () => {
    if (!selectedAnnotationId) {
      showErrorMessage("Error removing annotations: no selected annotation");
    }
    const newAnnotations = annotations.filter(
      (annotation) => annotation.id !== selectedAnnotationId
    );
    console.log("Annotation removed successfully");
    setAnnotations(newAnnotations);
    updateAnnotationDecorations(-1);
  };

  const handleSetAnnotationColor = (color: string) => {
    const selectedAnnotation = annotations.find(
      (annotation) => annotation.id === selectedAnnotationId
    );

    if (!selectedAnnotation) {
      showErrorMessage("Error setting annotation color: no selected annotation");
      return;
    }

    const updatedAnnotations = annotations.map((annotation) =>
      annotation.id === selectedAnnotationId
        ? { ...annotation, metadata: { ...annotation.metadata, color } }
        : annotation
    );

    setAnnotations(updatedAnnotations);
    showAnnotations();
  }

  const hideAnnotations = () => {
    vscode.postMessage({
      command: "hideAnnotations",
    });
  };

  const showAnnotations = () => {
    vscode.postMessage({
      command: "showAnnotations",
      data: { annotations },
    });
  };

  // Check if document content in annotations lines up with current document
  /**
   *
   * @param position the position of the cursor
   * @returns true if the annotations are up to date, false otherwise
   */
  const updateAnnotationDecorations = (position: number): void => {
    if (annotations.length === 0 || annotations[0].document === currentDocument) {
      showAnnotations();
      return;
    }

    let disable: boolean = false;
    if (position !== -1) {
      let newAnnotations: Annotation[];
      if (!currentDocument) {
        return;
      }
      newAnnotations = annotations.map((annotation) => {
        if (annotation.end + 15 < position) {
          return { ...annotation, document: currentDocument };
        } else if (position < annotation.start - 15) {
          console.log("Pushing annotations");
          return {
            ...annotation,
            start: annotation.start + 1,
            end: annotation.end + 1,
            document: currentDocument,
          };
        } else {
          disable = true;
          return annotation;
        }
      });
      if (!disable) {
        setAnnotations(newAnnotations);
        showAnnotations();
      } else {
        hideAnnotations();
      }
    }
  };

  // Transient editor + UI state
  const [charNum, setCharNum] = useState(undefined as number | undefined);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(undefined as string | undefined);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState(undefined as string | undefined);
  const [chooseAnnotationType, setChooseAnnotationType] = useState(false);
  const [start, setStart] = useState(undefined as number | undefined);
  const [end, setEnd] = useState(undefined as number | undefined);
  const [tempDocumentContent, setTempDocumentContent] = useState(undefined as string | undefined);
  const defaultTool: string | undefined =
    Object.keys(toolTypes).length > 0 ? Object.keys(toolTypes)[0] : undefined;
  const [newTool, setNewTool] = useState(defaultTool as string | undefined);
  // Other configuration
  const [retagServerURL, setRetagServerURL] = useState(undefined as string | undefined);
  const [confirmAnnotation, setConfirmAnnotation] = useState(false);

  // Listen for configuration updates from editor
  listenForEditorMessages(
    setDocumentURI,
    setAnnotationURI,
    setFileServerUrl,
    setCharNum,
    setRetagServerURL,
    handleAddAnnotation,
    handleRemoveAnnotation,
    handleSetAnnotationColor,
    handleChooseAnnType,
    updateAnnotationDecorations
  );

  // find the selected annotation based on the character position
  useEffect(() => {
    if (charNum) {
      const annotation = annotations.find(
        (annotation) => annotation.start <= charNum && annotation.end >= charNum
      );
      if (annotation) {
        setSelectedAnnotationId(annotation.id);
      }
    }
  }, [charNum, annotations]);

  const documentOutOfDate =
    annotations &&
    annotations.some((annotation: Annotation) => {
      return annotation.document !== currentDocument;
    });

  // Set up retagging function
  const retag = retagServerURL ? useRetagFromAPI(retagServerURL) : undefined;

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
          setAnnotations={setAnnotations}
          setCurrentDocument={setCurrentDocument}
          charNum={charNum}
          selectedAnnotationId={selectedAnnotationId}
          setSelectedAnnotationId={setSelectedAnnotationId}
          hoveredAnnotationId={hoveredAnnotationId}
          setHoveredAnnotationId={setHoveredAnnotationId}
        />

        {confirmAnnotation && (
          <>
            <div>
              Tool: &nbsp;
              {/* select with dropdown */}
              {/* <input type="text" value={addTool} onChange={e => setAddTool(e.target.value)} /> */}
              <select
                value={newTool}
                onChange={(e) => {
                  setNewTool(e.target.value);
                }}>
                {Object.keys(toolTypes).map((toolKey) => (
                  <option key={toolKey} value={toolKey}>
                    {toolKey}
                  </option>
                ))}
              </select>
            </div>
            <div>
              Add annotation?
              <br></br>
              <button onClick={handleAddAnnotationConf}>Confirm</button>
            </div>
          </>
        )}

        <br />
        <>
          <p>To add more annotations, highlight and use the right-click context menu.</p>
          <p>
            To open the annotation panel, click on the lightning bolt icon in the top right corner
            of the editor.
          </p>
        </>
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
          }}>
          {Object.keys(toolTypes).map((toolKey) => (
            <option key={toolKey} value={toolKey}>
              {toolKey}
            </option>
          ))}
        </select>
        <button onClick={handleAddAnnotationConf}>Submit</button>
      </main>
    );
  }
}

export default App;