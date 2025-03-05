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
  onDelete: (id: string) => void;
}) {
  const { value, setValue, setSelectedAnnotationId, onDelete } = props;

  const handleClick = () => {
    setSelectedAnnotationId(value.id);

    // Find the element by ID and scroll into view
    const startElement = document.getElementById(`annotation-${value.start}`);
    if (startElement) {
      startElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    
    // Send message to jump to annotation in editor
    vscode.postMessage({
      command: "jumpToAnnotation",
      data: {
        start: value.start,
        end: value.end
      }
    });
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

function AnnotationSidebarView(props: {
  annotations: Annotation[];
  setAnnotations: (annotations: Annotation[]) => void;
  documentText: string;
  charNum: number | undefined;
  selectedAnnotationId: string | undefined;
  setSelectedAnnotationId: (id: string | undefined) => void;
  hoveredAnnotationId: string | undefined;
  setHoveredAnnotationId: (id: string | undefined) => void;
  onDeleteAnnotation: (id: string) => void;
}) {
  const { annotations, setAnnotations, charNum, documentText, onDeleteAnnotation } = props;
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
    if (charNum !== undefined) {
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

  const handleClick = (id: string) => () => {
    props.setSelectedAnnotationId(id);
  };

  const handleAnnotationUpdate = (id: string, value: AnnotationUpdate) => {
    console.log("Updating annotation:", id, value);
    
    const annotation = annotations.find(a => a.id === id);
    if (!annotation) return;
    
    const updatedAnnotation = {
      ...annotation,
      ...(value.document ? { document: value.document } : {}),
      ...(value.metadata ? { metadata: { ...annotation.metadata, ...value.metadata } } : {})
    };
    
    // Send update to extension
    vscode.postMessage({
      command: "updateAnnotation",
      data: {
        updatedAnnotation
      }
    });
  };

  const handleDeleteClick = (id: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering the tile click
    onDeleteAnnotation(id);
  };

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
              alignItems: "center"
            }}>
            <div className="line-number">
              Line {documentText.slice(0, annotation.start).split("\n").length}
            </div>
            -
            <div className="annotation-type" style={{ fontWeight: "bold" }}>
              {toolNames[annotation.tool as keyof typeof toolNames]}
            </div>
            {isAnnotationOutOfSync(annotation, documentText) && (
              <div className="needs-retag-indicator" style={{ color: "red", marginLeft: "auto" }}>
                Needs Retag
              </div>
            )}
            <button 
              className="delete-button"
              onClick={(e) => handleDeleteClick(annotation.id, e)}
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#d32f2f",
                fontSize: "12px",
                padding: "4px 8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              title="Delete Annotation"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
          <AnnotationEditorContainer
            key={index}
            value={annotation}
            setValue={(value) => handleAnnotationUpdate(annotation.id, value)}
            hoveredAnnotationId={props.hoveredAnnotationId}
            setHoveredAnnotationId={props.setHoveredAnnotationId}
            selectedAnnotationId={props.selectedAnnotationId}
            setSelectedAnnotationId={props.setSelectedAnnotationId}
            onDelete={onDeleteAnnotation}
          />
        </div>
      ))}
    </>
  );
}

function RetagBanner(props: {
  onRetag: () => void;
}) {
  return (
    <div className="retag-banner" style={{ 
      padding: "10px", 
      marginBottom: "10px", 
      backgroundColor: "#ffe0e0", 
      borderRadius: "4px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }}>
      <span>Document has been edited and some annotations need updating</span>
      <div>
        <button onClick={props.onRetag} style={{ marginRight: "8px" }}>Update Annotations</button>
      </div>
    </div>
  );
}

// Helper to determine if an annotation needs retagging
const isAnnotationOutOfSync = (annotation: Annotation, currentDocumentText: string): boolean => {
  return currentDocumentText !== annotation.document;
};

function App() {
  // State for document and annotations
  const [documentUri, setDocumentUri] = useState<string | undefined>(undefined);
  const [documentText, setDocumentText] = useState<string>("");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [retagServerURL, setRetagServerURL] = useState<string | undefined>(undefined);

  // UI state
  const [charNum, setCharNum] = useState<number | undefined>(undefined);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | undefined>(undefined);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | undefined>(undefined);
  const [chooseAnnotationType, setChooseAnnotationType] = useState<boolean>(false);
  const [confirmAnnotation, setConfirmAnnotation] = useState<boolean>(false);
  
  // Annotation creation state
  const [start, setStart] = useState<number | undefined>(undefined);
  const [end, setEnd] = useState<number | undefined>(undefined);
  const defaultTool = Object.keys(toolTypes).length > 0 ? Object.keys(toolTypes)[0] : undefined;
  const [newTool, setNewTool] = useState<string | undefined>(defaultTool);

  const showRetagBanner = annotations.some((annotation) =>
    isAnnotationOutOfSync(annotation, documentText)
  );

  // Utility functions
  const showErrorMessage = (error: string) => {
    console.log("Show error called, error: " + error);
    vscode.postMessage({
      command: "showErrorMessage",
      data: {
        error,
      },
    });
  };

  const handleRetag = () => {
    vscode.postMessage({
      command: "retagAnnotations"
    });
  };

  const handleChooseAnnType = (start: number, end: number, documentContent: string) => {
    setChooseAnnotationType(true);
    setStart(start);
    setEnd(end);
    setDocumentText(documentContent);
  };

  const handleAddAnnotation = (start: number, end: number) => {
    setConfirmAnnotation(true);
    setStart(start);
    setEnd(end);
  };

  const handleDeleteAnnotation = (annotationId: string) => {
    vscode.postMessage({
      command: "removeAnnotation",
      data: { annotationId }
    });
    
    if (selectedAnnotationId === annotationId) {
      setSelectedAnnotationId(undefined);
    }
  };

  const handleRemoveAnnotation = () => {
    if (!selectedAnnotationId) {
      showErrorMessage("Error removing annotations: no selected annotation");
      return;
    }
    
    vscode.postMessage({
      command: "removeAnnotation",
      data: { annotationId: selectedAnnotationId }
    });
    
    setSelectedAnnotationId(undefined);
  };

  const handleSetAnnotationColor = (color: string) => {
    if (!selectedAnnotationId) {
      showErrorMessage("Error setting annotation color: no selected annotation");
      return;
    }
    
    vscode.postMessage({
      command: "setAnnotationColor",
      data: {
        annotationId: selectedAnnotationId,
        color
      }
    });
  };

  const handleAddAnnotationConfirm = () => {
    // Update state once confirm is clicked
    setConfirmAnnotation(false);
    setChooseAnnotationType(false);

    if (!start || !end) {
      showErrorMessage("Error adding annotations: no highlighted text");
      return;
    }

    if (start === end) {
      showErrorMessage("Error adding annotations: selection must not be empty");
      return;
    }

    if (!newTool) {
      showErrorMessage("Error adding annotations: no tool selected");
      return;
    }

    // Check for overlapping annotations
    for (let i = 0; i < annotations.length; i++) {
      if (annotations[i].start === start && annotations[i].end === end) {
        showErrorMessage("Error adding annotations: annotation already exists in selected area");
        return;
      }
    }

    // Create new annotation and send to extension
    const newAnnotation: Annotation = {
      id: Date.now().toString(), // Use timestamp for unique ID
      start,
      end,
      document: documentText,
      tool: newTool,
      metadata: {},
      original: {
        document: documentText,
        start,
        end,
      },
    };
    
    vscode.postMessage({
      command: "addAnnotationConfirm",
      data: {
        annotation: newAnnotation
      }
    });
  };

  useEffect(() => {
    // Message handler for communication with extension
    const handleMessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data);
      console.debug("Received message:", message);
      
      switch (message.command) {
        case "initialize":
          // Initialize the UI with document data and annotations
          setDocumentUri(message.data.documentUri);
          setDocumentText(message.data.documentText);
          setAnnotations(message.data.annotations || []);
          setRetagServerURL(message.data.retagServerURL);
          return;
          
        case "updateAnnotations":
          // Update annotations from extension
          if (message.data.documentUri === documentUri) {
            setAnnotations(message.data.annotations || []);
            setDocumentText(message.data.documentText);
          }
          return;
          
        case "handleCursorPositionChange":
          // Handle cursor position change
          setCharNum(message.data.position);
          return;
          
        case "addAnnotation":
          // Start annotation creation flow
          handleAddAnnotation(message.data.start, message.data.end);
          return;
          
        case "removeAnnotation":
          // Remove selected annotation
          handleRemoveAnnotation();
          return;
          
        case "setAnnotationColor":
          // Set color for selected annotation
          handleSetAnnotationColor(message.data.color);
          return;
          
        case "chooseAnnotationType":
          // Choose annotation type
          handleChooseAnnType(message.data.start, message.data.end, message.data.documentContent);
          return;
      }
    };
    
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [documentUri]);

  // Find the selected annotation based on the character position
  useEffect(() => {
    if (charNum !== undefined) {
      const annotation = annotations.find(
        (annotation) => annotation.start <= charNum && annotation.end >= charNum
      );
      if (annotation) {
        setSelectedAnnotationId(annotation.id);
      }
    }
  }, [charNum, annotations]);

  if (!chooseAnnotationType) {
    return (
      <main>
        {showRetagBanner && (
          <RetagBanner 
            onRetag={handleRetag} 
          />
        )}
        
        <AnnotationSidebarView
          annotations={annotations}
          setAnnotations={setAnnotations}
          documentText={documentText}
          charNum={charNum}
          selectedAnnotationId={selectedAnnotationId}
          setSelectedAnnotationId={setSelectedAnnotationId}
          hoveredAnnotationId={hoveredAnnotationId}
          setHoveredAnnotationId={setHoveredAnnotationId}
          onDeleteAnnotation={handleDeleteAnnotation}
        />

        {confirmAnnotation && (
          <>
            <div>
              Tool: &nbsp;
              <select
                value={newTool}
                onChange={(e) => {
                  setNewTool(e.target.value);
                }}>
                {Object.keys(toolTypes).map((toolKey) => (
                  <option key={toolKey} value={toolKey}>
                    {toolNames[toolKey as keyof typeof toolNames]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              Add annotation?
              <br></br>
              <button onClick={handleAddAnnotationConfirm}>Confirm</button>
            </div>
          </>
        )}

        <p>To add more annotations, highlight and use the right-click context menu.</p>
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
              {toolNames[toolKey as keyof typeof toolNames]}
            </option>
          ))}
        </select>
        <button onClick={handleAddAnnotationConfirm}>Submit</button>
      </main>
    );
  }
}

export default App;