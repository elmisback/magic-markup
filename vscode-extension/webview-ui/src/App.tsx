import { vscode } from "./utilities/vscode";
import "./App.css";
import Annotation from "./Annotation";
import { tools, toolNames } from "./tools";
import React, { useState, useEffect, useRef } from "react";

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

  return (
    <div className="annotation-container" onClick={handleClick}>
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

  const sortAnnotations = (annotations: Annotation[]): Annotation[] => {
    return annotations.slice().sort((a, b) => a.start - b.start);
  };

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
    if (charNum) {
      const closestAnnotationIndex = findClosestAnnotationIndex(
        sortAnnotations(annotations),
        charNum
      );
      if (
        closestAnnotationIndex !== -1 &&
        annotationRefs &&
        annotationRefs.current[closestAnnotationIndex]
      ) {
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

  const handleClick = (id: string) => () => {
    props.setSelectedAnnotationId(id);
  };

  // <svg
  //       width="30"
  //       height="30"
  //       viewBox="0 0 30 30"
  //       xmlns="http://www.w3.org/2000/svg"
  //       xmlnsXlink="http://www.w3.org/1999/xlink">
  //       <title>ic_fluent_comment_24_regular</title>
  //       <desc>Created with Sketch.</desc>
  //       <g id="🔍-Product-Icons" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
  //         <g id="ic_fluent_comment_24_regular" fill="#212121" fillRule="nonzero">
  //           <path
  //             d="M5.25,18 C3.45507456,18 2,16.5449254 2,14.75 L2,6.25 C2,4.45507456 3.45507456,3 5.25,3 L18.75,3 C20.5449254,3 22,4.45507456 22,6.25 L22,14.75 C22,16.5449254 20.5449254,18 18.75,18 L13.0124851,18 L7.99868152,21.7506795 C7.44585139,22.1641649 6.66249789,22.0512036 6.2490125,21.4983735 C6.08735764,21.2822409 6,21.0195912 6,20.7499063 L5.99921427,18 L5.25,18 Z M12.5135149,16.5 L18.75,16.5 C19.7164983,16.5 20.5,15.7164983 20.5,14.75 L20.5,6.25 C20.5,5.28350169 19.7164983,4.5 18.75,4.5 L5.25,4.5 C4.28350169,4.5 3.5,5.28350169 3.5,6.25 L3.5,14.75 C3.5,15.7164983 4.28350169,16.5 5.25,16.5 L7.49878573,16.5 L7.49899997,17.2497857 L7.49985739,20.2505702 L12.5135149,16.5 Z"
  //             id="🎨-Color"></path>
  //         </g>
  //       </g>
  //     </svg>

  return (
    <>
      {[...annotations].sort(key((a: Annotation) => a.start)).map((annotation, index) => (
        <div
          key={index}
          ref={(ref) => (annotationRefs.current[index] = ref)}
          className={`annotation-tile ${
            props.selectedAnnotationId === annotation.id ? "selected" : ""
          }`}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            // use color from annotation metadata for left side if available
            borderLeft: annotation.metadata?.color
              ? `5px solid ${annotation.metadata.color}`
              : "5px solid rgba(255,255,0,0.3)",
          }}
          onClick={handleClick(annotation.id)}>
          <div
            className="annotation-info"
            style={{
              // use flexbox to align items
              display: "flex",
              gap: "4px",
              fontSize: "smaller",
            }}>
            <div className="line-number">
              Line {annotation.document.slice(0, annotation.start).split("\n").length}
            </div>
            -
            <div className="annotation-type" style={{ fontWeight: "bold" }}>
              {toolNames[annotation.tool as keyof typeof toolNames]}
            </div>
          </div>
          <AnnotationEditorContainer
            key={index}
            value={annotation}
            setValue={(value) => {
              console.log("Setting annotation:", value);
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
  updateAnnotationDecorations: () => void
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
        updateAnnotationDecorations();
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
  };

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
  const updateAnnotationDecorations = (): void => {
    if (annotations.length === 0) {
      showAnnotations();
    } else if (annotations[0].document === currentDocument) {
      showAnnotations();
    } else if (
      currentDocument &&
      annotations[0].start + currentDocument.length - annotations[0].document.length >= 0 &&
      currentDocument.substring(
        annotations[0].start + currentDocument.length - annotations[0].document.length
      ) === annotations[0].document.substring(annotations[0].start)
    ) {
      // case 1: all changes are before the first annotation
      const newAnnotations: Annotation[] = annotations.map((annotation) => {
        return (annotation = {
          ...annotation,
          original: {
            document: annotation.document,
            start: annotation.start,
            end: annotation.end,
          },
          start: annotation.start + currentDocument.length - annotation.document.length,
          end: annotation.end + currentDocument.length - annotation.document.length,
          document: currentDocument,
        });
      });
      setAnnotations(newAnnotations);
      showAnnotations();
    } else if (
      currentDocument &&
      annotations[Math.max(annotations.length - 1, 0)].end < currentDocument.length &&
      currentDocument.substring(0, annotations[Math.max(annotations.length - 1, 0)].end) ===
        annotations[Math.max(annotations.length - 1, 0)].document.substring(
          0,
          annotations[Math.max(annotations.length - 1, 0)].end
        )
    ) {
      // case 2: all changes are after the last annotation
      // no need to update indices
      const newAnnotations: Annotation[] = annotations.map((annotation) => {
        return (annotation = {
          ...annotation,
          document: currentDocument,
        });
      });
      setAnnotations(newAnnotations);
      showAnnotations();
    } else if (annotations.length >= 2 && currentDocument) {
      // case 3: changes are in the middle of the annotations
      let firstAnnInd: number = -1;
      for (let i: number = 0; i < annotations.length - 1; i++) {
        const leftAnn = annotations[i];
        const rightAnn = annotations[i + 1];
        if (leftAnn.document !== rightAnn.document) {
          continue;
        }
        const lenDiff: number = currentDocument.length - leftAnn.document.length;
        if (
          // TODO finish bounds checks
          rightAnn.end + lenDiff < currentDocument.length &&
          leftAnn.end < currentDocument.length &&
          leftAnn.document.substring(0, leftAnn.end) ===
            currentDocument.substring(0, leftAnn.end) &&
          rightAnn.document.substring(rightAnn.start) ===
            currentDocument.substring(rightAnn.start + lenDiff)
        ) {
          firstAnnInd = i;
          break;
        }
      }
      if (firstAnnInd === -1) {
        hideAnnotations();
      } else {
        const newAnnotations: Annotation[] = annotations.map((annotation, index) => {
          if (index <= firstAnnInd) {
            return annotation;
          } else {
            return {
              ...annotation,
              start: annotation.start + currentDocument.length - annotation.document.length,
              end: annotation.end + currentDocument.length - annotation.document.length,
              document: currentDocument,
            };
          }
        });
        setAnnotations(newAnnotations);
        showAnnotations;
      }
    } else {
      hideAnnotations();
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

  useEffect(() => {
    updateAnnotationDecorations();
  }, [annotations, currentDocument]);

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

        {/* <br />
        <> */}
        <p>To add more annotations, highlight and use the right-click context menu.</p>
        {/* <p>
            To open the annotation panel, click on the lightning bolt icon in the top right corner
            of the editor.
          </p> */}
        {/* </> */}
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
