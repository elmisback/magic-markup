import React, { useEffect, useState } from "react";
// import logo from './logo.svg';
// import DocumentViewer from "./DocumentViewer";
import Annotation from "./Annotation";
import ReactDiffViewer from "react-diff-viewer-continued";
// import Split from "react-split";
import "./App.css";
import { tools } from "./tools";

import { useContext } from "react";
import { DocumentContext, DocumentProvider } from "./DocumentContext";
import { DiskStateContext, DiskStateProvider } from "./DiskStateContext";

const HTMLEditor = (props: {
  documentContent: string;
  annotations: Annotation[];
  setAnnotations: (anns: Annotation[]) => void;
  hoveredAnnotation: Annotation | null;
  setHoveredAnnotation: (ann: Annotation | null) => void;
  selectedAnnotation: Annotation | undefined;
  setSelectedAnnotation: (ann: Annotation | undefined) => void;
}) => {
  const {
    documentContent,
    annotations,
    setAnnotations,
    hoveredAnnotation,
    setHoveredAnnotation,
    selectedAnnotation,
    setSelectedAnnotation,
  } = props;

  // Just render the document content with the annotations highlighted.
  // We break the document into characters and put a span on each character.
  // We set the index on each span so that we can get the character index via the selection API when the user selects text in order to create an annotation.
  // For each span, we adjust the highlight opacity based on the number of overlapping annotations at that index.
  // We also add a hover handler that sets that annotation as "hovered" so it can be highlighted in the annotation list on the right.
  // We also add a click handler that sets that annotation as "selected" so it can be scrolled to in the annotation list on the right.
  // We also add a mouseleave handler that clears the "hovered" annotation.

  // const [hoveredAnnotation, setHoveredAnnotation] = useState<Annotation | null>(null);
  // const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [addStartEnd, setAddStartEnd] = useState<
    [number, number, boolean] | null
  >(null);
  const [addTool, setAddTool] = useState<string>("colorPicker");

  const handleMouseEnter = (index: number) => {
    const annotation = annotations.find(
      (annotation) => index >= annotation.start && index <= annotation.end
    );
    if (!annotation) {
      return;
    }
    setHoveredAnnotation(annotation);
  };

  const handleMouseLeave = () => {
    setHoveredAnnotation(null);
  };

  const handleClick = (index: number) => {
    const annotation = annotations.find(
      (annotation) => index >= annotation.start && index <= annotation.end
    );
    if (!annotation) {
      setSelectedAnnotation(undefined);
      return;
    }
    setSelectedAnnotation(annotation);
  };

  const numOverlappingAnnotations = (index: number) => {
    return annotations.filter(
      (annotation) => index >= annotation.start && index <= annotation.end
    ).length;
  };

  const maxOverlappingAnnotations = [
    ...new Array(documentContent.length),
  ].reduce((acc, _, index) => {
    const numOverlapping = numOverlappingAnnotations(index);
    return numOverlapping > acc ? numOverlapping : acc;
  }, 0);

  const getOpacity = (index: number) => {
    const maxOpacity = 1;
    const minOpacity = 0.3;
    // handle case of no overlapping annotations
    if (maxOverlappingAnnotations === 0) {
      return maxOpacity;
    }
    const numOverlapping = numOverlappingAnnotations(index);
    return numOverlapping === 0
      ? 0
      : minOpacity +
          (maxOpacity - minOpacity) *
            (numOverlapping / maxOverlappingAnnotations);
  };

  const handleSelection = (e: any) => {
    const selection = window.getSelection();
    if (!selection) {
      clearSelection();
      return;
    }
    if (
      !selection.anchorNode?.parentElement?.dataset.index ||
      !selection.focusNode?.parentElement?.dataset.index
    ) {
      clearSelection();
      return;
    }
    // Get the data-index of the start and end nodes of the selection
    const anchorIndex = parseInt(
      selection.anchorNode?.parentElement?.dataset.index || "0"
    );
    const focusIndex = parseInt(
      selection.focusNode?.parentElement?.dataset.index || "0"
    );
    const start = Math.min(anchorIndex, focusIndex);
    const end = Math.max(anchorIndex, focusIndex);
    const isCaret = selection.type === "Caret";
    // console.log("Selection:", start, end);
    setAddStartEnd([start, end, isCaret]);
  };
  useEffect(() => {
    document.addEventListener("selectionchange", handleSelection);
    return () => {
      document.removeEventListener("selectionchange", handleSelection);
    };
  });

  const clearSelection = () => {
    setAddStartEnd(null);
  };

  const 
  handleAddAnnotationClick = () => {
    if (!addStartEnd) {
      console.error("Error: no selection");
      return;
    }
    let [start, end] = addStartEnd;
    // end = end + 1; // HACK fix off-by-one error
    const newAnnotation: Annotation = {
      start,
      end,
      document: documentContent,
      tool: addTool,
      metadata: {},
      original: {
        document: documentContent,
        start,
        end,
      },
    };
    console.log("Adding annotation:", newAnnotation);
    setAnnotations([...annotations, newAnnotation]);
    clearSelection();
  };

  /* TODO handle case where the selected character is the end of the line (can't do inline-block) */

  return (
    <div className="html-editor">
      <div style={{ display: "flex" }}>
        <div style={{ flex: 1 }}>
          <div className="document-view-title">Document view</div>
          <div
            className="html-annotator"
            style={{ whiteSpace: "pre-wrap", fontFamily: "Source Code Pro" }}
          >
            {documentContent.split("").map((char, index) => {
              let style = {};
              // We want to highlight the character based on the number of overlapping annotations
              style = {
                backgroundColor: `rgba(255, 255, 0, ${getOpacity(index)})`,
              };
              // if character is part of a currently hovered annotation, highlight in light gray
              if (
                hoveredAnnotation &&
                index >= hoveredAnnotation.start &&
                index <= hoveredAnnotation.end
              ) {
                style = { backgroundColor: "lightgray" };
              }

              // if the character is part of a currently selected annotation, highlight in green
              if (
                selectedAnnotation &&
                index >= selectedAnnotation.start &&
                index <= selectedAnnotation.end
              ) {
                style = { backgroundColor: "rgba(0, 255, 0, 0.5)" };
              }
              // If the character is part of a currently selected addStartEnd, highlight it in a different color
              if (
                addStartEnd &&
                index >= addStartEnd[0] &&
                index <= addStartEnd[1]
              ) {
                style = { backgroundColor: "rgba(0, 255, 0, 0.5)" };
                // if it's a caret, just add a border to the left side
                if (addStartEnd[2]) {
                  style = {
                    borderLeft: "2px solid green",
                    "box-sizing": "border-box",
                    width: ".6em",
                    display: "inline-block",
                  };
                }
              }

              // Assign ID to span if part of an annotation
              const id = annotations.find(
                (annotation) =>
                  index >= annotation.start && index <= annotation.end
              )
                ? `annotation-${index}`
                : undefined;

              return (
                <span
                  key={index}
                  data-index={index}
                  style={style}
                  onMouseEnter={(e) => {
                    handleMouseEnter(index);
                  }}
                  onMouseLeave={(e) => {
                    handleMouseLeave();
                  }}
                  onClick={() => handleClick(index)}
                  id={id}
                >
                  {char}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <div>
        <div className="add-annotation-title">Add Annotation</div>
        <div className="add-annotation">
          <div>
            Tool: &nbsp;
            {/* select with dropdown */}
            {/* <input type="text" value={addTool} onChange={e => setAddTool(e.target.value)} /> */}
            <select
              value={addTool}
              onChange={(e) => setAddTool(e.target.value)}
            >
              {Object.keys(toolTypes).map((toolKey) => (
                <option key={toolKey} value={toolKey}>
                  {toolKey}
                </option>
              ))}
            </select>
          </div>
          <button onClick={handleAddAnnotationClick}>Add</button>
        </div>
      </div>
      {/* delete annotation button if there's a selected annotation */}
      {selectedAnnotation && (
        <div>
          <h4>Delete Annotation</h4>
          <button
            onClick={() =>
              setAnnotations(
                annotations.filter(
                  (annotation) => annotation !== selectedAnnotation
                )
              )
            }
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

function useDocument() {
  const context = useContext(DocumentContext);
  if (context === undefined) {
    throw new Error("useDocument must be used within a DocumentProvider");
  }
  return context;
}

function useDiskState() {
  const context = useContext(DiskStateContext);
  console.log("using disk state", context);
  if (context === undefined) {
    throw new Error("useDiskState must be used within a DiskStateProvider");
  }
  return context;
}

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
                value.document.slice(0, value.start) +
                newText +
                value.document.slice(value.end),
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
  const [documentURI, setDocumentURI] = useState(
    localStorage.getItem("DocumentURI") || ""
  );
  const [stateURI, setStateURI] = useState(
    localStorage.getItem("StateURI") ||
      getStateURI(localStorage.getItem("DocumentURI")) ||
      ""
  );

  // currently there's a bug with Windows firefox on WSL -- I think the WS server being on ipv6 causes the connection to fail?
  // it does work if the IP is changed to match the WSL IP
  // chrome works fine with localhost, so we should focus on chrome support for now
  return (
    <DiskStateProvider serverUrl="ws://localhost:3002" stateURI={stateURI}>
      <DocumentProvider
        serverUrl="ws://localhost:3002"
        documentURI={documentURI}
      >
        <Main
          documentURI={documentURI}
          stateURI={stateURI}
          setStateURI={setStateURI}
          setDocumentURI={setDocumentURI}
        />
      </DocumentProvider>
    </DiskStateProvider>
  );
}

type MainProps = {
  documentURI: string;
  stateURI: string;
  setStateURI: (newURI: string) => void;
  setDocumentURI: (newURI: string) => void;
};

function getStateURI(docURI: string | null): string {
  if (!docURI) return "";
  const re: RegExp = /^(.*\/)([^/]+)$/;
  const match: RegExpMatchArray | null = docURI.match(re);
  if (match && match.length === 3) {
    return match[1] + "." + match[2] + ".ann.json";
  }
  return "";
}

function Main({
  documentURI,
  stateURI,
  setStateURI,
  setDocumentURI,
}: MainProps) {
  const { documentContent, setDocumentContent } = useDocument();
  const { diskState, setDiskState } = useDiskState();
  // const {diskState, setDiskState} = useContext(DiskStateContext)
  const [continuousRetag] = useState(false);
  const [documentOutOfDate, setDocumentOutOfDate] = useState(false);
  const [hoveredAnnotation, setHoveredAnnotation] = useState<Annotation | null>(
    null
  );
  const [selectedAnnotation, setSelectedAnnotation] = useState<
    Annotation | undefined
  >(undefined);
  const [APIKey, setAPIKey] = useState(localStorage.getItem("APIKey") || "");
  const annotations = diskState?.annotations;

  const setAnnotation = (index: number, annotationUpdate: AnnotationUpdate) => {
    console.log("setting annotation", index, annotationUpdate);
    // if the document is out of date, disable setting the annotation
    if (documentOutOfDate) {
      return;
    }
    // if the annotation involves setting the document, first we need to do that
    if (
      annotationUpdate.document &&
      annotationUpdate.document !== documentContent
    ) {
      // set the document content
      setDocumentContent(annotationUpdate.document);
    }
    setDiskState({
      annotations: annotations?.map((value, i) =>
        i === index ? { ...annotations[i], ...annotationUpdate } : value
      ),
    });
  };

  function updateURIs(documentURI: string) {
    setDocumentURI(documentURI);
    localStorage.setItem("StateURI", getStateURI(documentURI));
    setStateURI(getStateURI(documentURI));
  }

  useEffect(() => {
    // check if the document is out of date
    // compare the document content to the state file
    // if the document is out of date, setDocumentOutOfDate(true)
    // if the document is up to date, setDocumentOutOfDate(false)
    console.log("Checking if document is out of date");
    const oldDocumentContent = diskState?.annotations[0]?.document;
    if (documentContent !== oldDocumentContent) {
      setDocumentOutOfDate(true);
    }
    if (documentContent === oldDocumentContent) {
      setDocumentOutOfDate(false);
    }
  }, [documentContent, diskState?.annotations]);

  const handleRetag = async () => {
    // send message to server to retag
    console.log("Retagging document");
    if (!annotations) {
      console.error("Error: no annotations");
      return;
    }
    const updatedAnnotations = await Promise.all(
      annotations.map(async (annotation) => {
        console.log("Annotation:", annotation);
        const oldDocumentContent = annotation.document;
        const codeUpToSnippet = oldDocumentContent.slice(0, annotation.start);
        const codeAfterSnippet = oldDocumentContent.slice(annotation.end);
        const annotationText = oldDocumentContent.slice(
          annotation.start,
          annotation.end
        );
        const delimiter = "★";
        const codeWithSnippetDelimited =
          codeUpToSnippet +
          delimiter +
          annotationText +
          delimiter +
          codeAfterSnippet;
        const updatedCodeWithoutDelimiters = documentContent;
        const output = await fetch("http://localhost:3004/retag", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            codeWithSnippetDelimited,
            updatedCodeWithoutDelimiters,
            delimiter,
            APIKey,
          }),
        }).then((res) => res.json());

        // update the annotation
        console.log("Output:", output);
        return {
          ...annotation,
          document: updatedCodeWithoutDelimiters,
          start: output.out.leftIdx,
          end: output.out.rightIdx,
        };
      })
    );
    setDiskState({ annotations: updatedAnnotations });
  };

  const setAnnotations = (anns: Annotation[]) => {
    setDiskState({ annotations: anns });
  };

  return (
    <div className="Main">
      <div className="annotator">
        {annotations !== undefined && (
          <HTMLEditor
            documentContent={documentContent}
            annotations={annotations}
            setAnnotations={setAnnotations}
            hoveredAnnotation={hoveredAnnotation}
            selectedAnnotation={selectedAnnotation}
            setHoveredAnnotation={setHoveredAnnotation}
            setSelectedAnnotation={setSelectedAnnotation}
          ></HTMLEditor>
        )}
      </div>
      <div className="tools">
        <div className="App">
          <div className="annotation-view-title">Annotation settings</div>

          {/* Document path to open */}
          <div>
            Document URI: &nbsp;
            <input
              type="text"
              value={documentURI}
              onChange={(e) => {
                localStorage.setItem("DocumentURI", e.target.value);
                updateURIs(e.target.value);
              }}
            />
          </div>
          <div>
            State URI: &nbsp;
            <input
              type="text"
              value={stateURI}
              onChange={(e) => {
                localStorage.setItem("StateURI", e.target.value);
                setStateURI(e.target.value);
              }}
            />
          </div>
          <div>
            API Key: &nbsp;
            <input
              type="password"
              value={APIKey}
              onChange={(e) => {
                localStorage.setItem("APIKey", e.target.value);
                setAPIKey(e.target.value);
              }}
            />
          </div>
          <hr></hr>
          {/* if document is out of date, show a warning */}
          {documentOutOfDate && (
            <ReactDiffViewer
              oldValue={diskState?.annotations[0]?.document || ""}
              newValue={documentContent || ""}
              splitView={true}
            />
          )}

          <div className="retag-document">
            Retag document:{" "}
            <button
              onClick={handleRetag}
              disabled={
                !documentOutOfDate ||
                continuousRetag ||
                documentURI === "" ||
                stateURI === "" ||
                APIKey === ""
              }
              style={{
                backgroundColor:
                  documentOutOfDate &&
                  !(
                    continuousRetag ||
                    documentURI === "" ||
                    stateURI === "" ||
                    APIKey === ""
                  )
                    ? "chartreuse"
                    : "initial",
              }}
            >
              Retag
            </button>
            {APIKey === "" && (
              <div style={{ color: "red" }}>(API key is required)</div>
            )}
          </div>
          {/* <div>Continuous Retag: &nbsp;
        <input type="checkbox" checked={continuousRetag} onChange={e => setContinuousRetag(e.target.checked)} />
      </div> */}
          <div className="section-divider"></div>

          <div className="annotation-list">
            <div className="annotation-list-title">Annotations</div>
            {/* list of annotations */}
            {annotations?.map((annotation, index) => (
              <div>
                <AnnotationEditorContainer
                  value={annotation}
                  setValue={(a) => setAnnotation(index, a)}
                  key={index}
                  hoveredAnnotation={hoveredAnnotation}
                  selectedAnnotation={selectedAnnotation}
                  setSelectedAnnotation={setSelectedAnnotation}
                />
                <div className="annotation-separator"></div>
              </div>
            ))}
            <div className="bottom-space"></div>
          </div>
        </div>
        {/* show the disk state */}
      </div>
    </div>
  );
}

export default App;
