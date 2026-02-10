import { vscode } from "./utilities/vscode";
import "./App.css";
import Annotation from "./Annotation";
import { tools, toolNames } from "./tools";
import React, { useState, useEffect, useRef, Suspense, lazy } from "react";

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

// Base tool types from our internal components
const baseToolTypes: ToolTypes = {
  ...tools,
};

// Dynamic user-defined components will be stored here
let userToolTypes: ToolTypes = {};
let userToolNames: { [key: string]: string } = {};

// Function to dynamically load a user component
function loadUserComponent(componentPath: string) {
  console.log(`Attempting to load component from path: ${componentPath}`);
  
  try {
    // Convert file:// URL to a relative path if needed
    let path = componentPath;
    if (path.startsWith('file://')) {
      // Remove file:// prefix and convert to a format that works with dynamic imports
      path = path.replace(/^file:\/\//, '');
      console.log(`Converted path to: ${path}`);
    }
    
    // For testing purposes, let's also log what we're trying to import
    console.log(`Dynamic import path: ${path}`);
    
    // Dynamic imports have different behavior in different environments
    // In vite/browser context, they need to be relative or absolute URLs
    return lazy(() => {
      console.log(`Actually importing: ${path}`);
      return import(/* @vite-ignore */ path)
        .then(module => {
          console.log(`Import succeeded for ${path}, module:`, module);
          return module;
        })
        .catch(err => {
          console.error(`Import failed for ${path}:`, err);
          throw err;
        });
    });
  } catch (error) {
    console.error(`Error setting up dynamic import for ${componentPath}:`, error);
    return null;
  }
}

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
  
  // Combine base and user-defined tool types
  const allToolTypes = { ...baseToolTypes, ...userToolTypes };
  const ToolComponent = allToolTypes[value.tool];

  return (
    <div className="annotation-container">
      {ToolComponent ? (
        <Suspense fallback={<div>Loading component...</div>}>
          <ToolComponent
            value={value}
            setValue={(v: AnnotationUpdate) =>
              setValue({ ...value, document: v.document, metadata: v.metadata })
            }
            utils={{
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
            }}
          />
        </Suspense>
      ) : (
        <div>Component not found: {value.tool}</div>
      )}
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

    const value = annotations.find((a) => a.id === id);
    if (!value) return;

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
        end: value.end,
        annotationId: value.id  // Add the annotation ID
      }
    });

    // Set the selected annotation id
    vscode.postMessage({
      command: "setSelectedAnnotationId",
      data: {
        annotationId: id
      }
    });
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
          key={annotation.id}
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
  // console.log('currentDocumentText', currentDocumentText)
  // console.log('annotation.document', annotation.document);
  if (currentDocumentText !== annotation.document) {
    console.debug('Annotation out of sync');
  }
  return currentDocumentText !== annotation.document || annotation.start === annotation.end;
};

function AddNoteBanner(props: {
  onConfirm: () => void;
  selectedTool: string | undefined;
  setSelectedTool: (tool: string) => void;
  onCancel: () => void;
  toolTypes: ToolTypes;
}) {
  // Combine base and user tool names
  const allToolNames = { ...toolNames, ...userToolNames };
  
  return (
    <div className="add-note-banner">
      <div className="add-note-title">Choose annotation type:</div>
      <div className="add-note-tools">
        {Object.entries(allToolNames).map(([key, name]) => (
          <div
            key={key}
            className={`add-note-tool ${props.selectedTool === key ? "selected" : ""}`}
            onClick={() => props.setSelectedTool(key)}>
            {name}
          </div>
        ))}
      </div>
      <div className="add-note-actions">
        <button onClick={props.onCancel}>Cancel</button>
        <button onClick={props.onConfirm} disabled={!props.selectedTool}>
          Create
        </button>
      </div>
    </div>
  );
}

function App() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [documentText, setDocumentText] = useState<string>("");
  const [documentUri, setDocumentUri] = useState<string>("");
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | undefined>(undefined);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | undefined>(undefined);
  const [charNum, setCharNum] = useState<number | undefined>(undefined);
  const [isOutOfSync, setIsOutOfSync] = useState<boolean>(false);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [selectedTool, setSelectedTool] = useState<string | undefined>(undefined);
  const [showRetagBanner, setShowRetagBanner] = useState<boolean>(false);
  const [addingAnnotationRange, setAddingAnnotationRange] = useState<
    { start: number; end: number } | undefined
  >(undefined);

  // ... rest of the existing code ...

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log("Received message:", message);

      switch (message.command) {
        case "initialize":
          setDocumentText(message.data.documentText);
          setDocumentUri(message.data.documentUri);
          setAnnotations(message.data.annotations);
          break;
        case "refreshComponents":
          // Load user-defined components
          loadUserDefinedComponents(message.components);
          break;
        case "addAnnotation":
          // Handle add annotation request
          setIsAdding(true);
          setAddingAnnotationRange({
            start: message.data.start,
            end: message.data.end
          });
          break;
        case "updateAnnotations":
          // Update annotations list
          if (message.data.documentUri === documentUri) {
            setAnnotations(message.data.annotations || []);
            if (message.data.documentText) {
              setDocumentText(message.data.documentText);
            }
          }
          break;
        case "handleCursorPositionChange":
          // Handle cursor position change
          setCharNum(message.data.position);
          break;
        case "chooseAnnotationType":
          // Set up for annotation type selection
          setIsAdding(true);
          setAddingAnnotationRange({
            start: message.data.start,
            end: message.data.end
          });
          if (message.data.documentContent) {
            setDocumentText(message.data.documentContent);
          }
          break;
        case "removeAnnotation":
          // Handled by parent, but we may want to update UI state
          if (selectedAnnotationId === message.data.annotationId) {
            setSelectedAnnotationId(undefined);
          }
          break;
        case "setAnnotationColor":
          // Update is handled by the extension
          break;
        // ... existing cases ...
      }
    };

    // Register the event listener
    window.addEventListener("message", handleMessage);

    // Clean up the event listener when the component unmounts
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // Function to load user-defined components
  const loadUserDefinedComponents = (components: { [key: string]: { name: string; path: string } }) => {
    console.log("loadUserDefinedComponents called with:", components);
    
    const newUserToolTypes: ToolTypes = {};
    const newUserToolNames: { [key: string]: string } = {};
    
    // Process each component
    if (!components || Object.keys(components).length === 0) {
      console.warn("No components received in loadUserDefinedComponents");
      return;
    }
    
    for (const [key, component] of Object.entries(components)) {
      console.log(`Processing component: ${key} with path: ${component.path}`);
      try {
        // Load the component dynamically
        const UserComponent = loadUserComponent(component.path);
        if (UserComponent) {
          console.log(`Successfully loaded component: ${key}`);
          newUserToolTypes[key] = UserComponent;
          newUserToolNames[key] = component.name;
        } else {
          console.warn(`Component loaded but is null/undefined: ${key}`);
        }
      } catch (error) {
        console.error(`Failed to load component ${component.name}:`, error);
      }
    }
    
    // Update the user components
    userToolTypes = newUserToolTypes;
    userToolNames = newUserToolNames;
    
    console.log("Updated user components:", Object.keys(userToolTypes));
    console.log("Updated user tool names:", userToolNames);
  };

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

  const handleCreateAnnotation = () => {
    // Update state
    setIsAdding(false);
    
    if (!addingAnnotationRange) {
      showErrorMessage("Error adding annotations: no highlighted text");
      return;
    }

    const { start, end } = addingAnnotationRange;
    
    if (start === end) {
      showErrorMessage("Error adding annotations: selection must not be empty");
      return;
    }

    if (!selectedTool) {
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

    // Pick a colorblind-friendly annotation color, rotating through a list
    const colorblindFriendlyColors = [
      "rgba(188, 189, 34, 0.3)", // yellow
      "rgba(31, 119, 180, 0.3)", // blue
      "rgba(255, 127, 14, 0.3)", // orange
      "rgba(44, 160, 44, 0.3)",  // green
      "rgba(214, 39, 40, 0.3)",  // red
      "rgba(148, 103, 189, 0.3)", // purple
      "rgba(140, 86, 75, 0.3)",  // brown
      "rgba(227, 119, 194, 0.3)", // pink
      "rgba(127, 127, 127, 0.3)", // gray
    ];
    const colorIndex = annotations.length % colorblindFriendlyColors.length;
    const annotationColor = colorblindFriendlyColors[colorIndex];

    // Create new annotation and send to extension
    const newAnnotation: Annotation = {
      id: Date.now().toString(), // Use timestamp for unique ID
      start,
      end,
      document: documentText,
      tool: selectedTool,
      metadata: {
        color: annotationColor
      },
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

  const handleDeleteAnnotation = (annotationId: string) => {
    vscode.postMessage({
      command: "removeAnnotation",
      data: { annotationId }
    });
    
    if (selectedAnnotationId === annotationId) {
      setSelectedAnnotationId(undefined);
    }
  };

  const handleCancelAddAnnotation = () => {
    setIsAdding(false);
    setAddingAnnotationRange(undefined);
  };

  // Add a useEffect to check if annotations need retagging
  useEffect(() => {
    // Check if any annotations need to be retagged
    const needsRetag = annotations.some(annotation => 
      isAnnotationOutOfSync(annotation, documentText)
    );
    setShowRetagBanner(needsRetag);
  }, [annotations, documentText]);

  // ... rest of the existing code ...

  return (
    <div className="App">
      {showRetagBanner && <RetagBanner onRetag={handleRetag} />}
      {isAdding && (
        <AddNoteBanner
          onConfirm={handleCreateAnnotation}
          selectedTool={selectedTool}
          setSelectedTool={setSelectedTool}
          onCancel={handleCancelAddAnnotation}
          toolTypes={{ ...baseToolTypes, ...userToolTypes }}
        />
      )}
      {annotations.length === 0 ? (
        <div className="no-annotations">No annotations found</div>
      ) : (
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
      )}
    </div>
  );
}

export default App;