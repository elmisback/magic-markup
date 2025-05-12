import { vscode } from "./utilities/vscode";
import "./App.css";
import Annotation from "./Annotation";
import { tools, toolNames } from "./tools";
import React, { useState, useEffect, useRef } from "react";
import DarkModeToggle from "./DarkModeToggle";
import Header from "./Header";
import EmptyState from "./EmptyState";
import AnnotationTile from "./AnnotationTile";
import AddAnnotationBanner from "./AddAnnotationBanner";

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

  return (
    <div className="annotation-container">
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
        annotationRefs.current[closestAnnotationIndex]?.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
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
        annotationId: value.id
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

  if (annotations.length === 0) {
    return (
      <EmptyState
        title="No Annotations Yet"
        message="Highlight text in the editor and click 'Add Note' to create annotations."
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        }
      />
    );
  }

  return (
    <div className="annotations-list">
      {[...annotations].sort(key((a: Annotation) => a.start)).map((annotation, index) => (
        <div
          key={annotation.id}
          ref={(ref) => (annotationRefs.current[index] = ref)}
        >
          <AnnotationTile
            annotation={annotation}
            selected={props.selectedAnnotationId === annotation.id}
            isOutOfSync={isAnnotationOutOfSync(annotation, documentText)}
            documentText={documentText}
            onClick={handleClick(annotation.id)}
            onDelete={handleDeleteClick}
          >
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
          </AnnotationTile>
        </div>
      ))}
    </div>
  );
}

function RetagBanner(props: {
  onRetag: () => void;
}) {
  return (
    <div className="banner retag-banner">
      <div className="banner-content">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span>Document has been edited and some annotations need updating</span>
        </div>
      </div>
      <button onClick={props.onRetag} className="primary">Update Annotations</button>
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

// Kept for backwards compatibility, but no longer in use
// Instead using the enhanced AddAnnotationBanner component
function AddNoteBanner(props: {
  onConfirm: () => void;
  selectedTool: string | undefined;
  setSelectedTool: (tool: string) => void;
  onCancel: () => void;
  toolTypes: ToolTypes;
}) {
  const { onConfirm, selectedTool, setSelectedTool, toolTypes } = props;

  return (
    <AddAnnotationBanner
      onConfirm={onConfirm}
      selectedTool={selectedTool}
      setSelectedTool={setSelectedTool}
      onCancel={props.onCancel}
      toolTypes={toolTypes}
    />
  );
}

function App() {
  // State for document and annotations
  const [documentUri, setDocumentUri] = useState<string | undefined>(undefined);
  const [documentText, setDocumentText] = useState<string>("");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // UI state
  const [charNum, setCharNum] = useState<number | undefined>(undefined);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | undefined>(undefined);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | undefined>(undefined);
  const [chooseAnnotationType, setChooseAnnotationType] = useState<boolean>(false);
  const [confirmAnnotation, setConfirmAnnotation] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Annotation creation state
  const [start, setStart] = useState<number | undefined>(undefined);
  const [end, setEnd] = useState<number | undefined>(undefined);
  const defaultTool = Object.keys(toolTypes).length > 0 ? Object.keys(toolTypes)[0] : undefined;
  const [newTool, setNewTool] = useState<string | undefined>(defaultTool);

  // Track current selection in editor
  const [currentSelection, setCurrentSelection] = useState<{start: number, end: number} | null>(null);
  const hasSelection = currentSelection && currentSelection.start !== currentSelection.end;

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
    setStart(start);
    setEnd(end);
    // Instead of showing confirmation dialog, just set hasSelection to enable the banner
  };

  // Rename this function to be clearer since it now directly adds the annotation
  const handleCreateAnnotation = () => {
    // Update state once the add note button is clicked
    setConfirmAnnotation(false);
    setChooseAnnotationType(false);
    setCurrentSelection(null);

    if (start === undefined || end === undefined) {
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
      tool: newTool,
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

  const handleCancelAddAnnotation = () => {
    setConfirmAnnotation(false);
    setStart(undefined);
    setEnd(undefined);
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newDarkModeState = !isDarkMode;
    setIsDarkMode(newDarkModeState);

    // Update body class for CSS
    if (newDarkModeState) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }

    // Save preference to localStorage
    try {
      localStorage.setItem('codetations-dark-mode', newDarkModeState ? 'true' : 'false');
    } catch (e) {
      console.error("Error saving dark mode preference:", e);
    }

    // Send dark mode change to extension
    vscode.postMessage({
      command: "setDarkMode",
      data: {
        isDarkMode: newDarkModeState
      }
    });
  };

  // Load dark mode preference on startup
  useEffect(() => {
    try {
      // Try to get from localStorage
      const savedDarkMode = localStorage.getItem('codetations-dark-mode');
      const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

      // First check localStorage, then check system preference
      const shouldUseDarkMode = savedDarkMode
        ? savedDarkMode === 'true'
        : prefersDarkMode;

      if (shouldUseDarkMode) {
        setIsDarkMode(true);
        document.body.classList.add('dark-mode');
      }
    } catch (e) {
      console.error("Error loading dark mode preference:", e);
    }

    // Listen for system color scheme changes
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleColorSchemeChange = (e: MediaQueryListEvent) => {
      // Only change if user hasn't set a preference
      if (!localStorage.getItem('codetations-dark-mode')) {
        setIsDarkMode(e.matches);
        if (e.matches) {
          document.body.classList.add('dark-mode');
        } else {
          document.body.classList.remove('dark-mode');
        }
      }
    };

    try {
      // Add listener for system preference changes
      darkModeMediaQuery.addEventListener('change', handleColorSchemeChange);
      // Remove listener on cleanup
      return () => darkModeMediaQuery.removeEventListener('change', handleColorSchemeChange);
    } catch (e) {
      // Fallback for older browsers that don't support addEventListener on MediaQueryList
      console.warn("Browser doesn't support MediaQueryList.addEventListener", e);
    }
  }, []);

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

          // Check if dark mode preference is present in initialization data
          if (message.data.isDarkMode !== undefined) {
            setIsDarkMode(message.data.isDarkMode);
            if (message.data.isDarkMode) {
              document.body.classList.add('dark-mode');
            } else {
              document.body.classList.remove('dark-mode');
            }
          }
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
          // Track selection state
          if (message.data.selection) {
            const selection = message.data.selection;
            if (selection.start === selection.end) {
              setCurrentSelection(null);
            } else {
              setCurrentSelection({
                start: selection.start,
                end: selection.end
              });
              setStart(selection.start);
              setEnd(selection.end);
            }
          }
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
        // Set the selected annotation id
        vscode.postMessage({
          command: "setSelectedAnnotationId",
          data: {
            annotationId: annotation.id
          }
        });
        setSelectedAnnotationId(annotation.id);
      }
    }
  }, [charNum, annotations]);

  if (!chooseAnnotationType) {
    return (
      <main>
        <Header
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          onRetag={handleRetag}
          needsRetagging={showRetagBanner}
        />

        <div className="app-container">
          <div className="content-area">
            {showRetagBanner && (
              <RetagBanner onRetag={handleRetag} />
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
          </div>

          {hasSelection && (
            <AddAnnotationBanner
              onConfirm={handleCreateAnnotation}
              selectedTool={newTool}
              setSelectedTool={setNewTool}
              onCancel={handleCancelAddAnnotation}
              toolTypes={toolTypes}
            />
          )}
        </div>
      </main>
    );
  } else {
    return (
      <main>
        <Header
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          needsRetagging={false}
        />

        <div className="app-container">
          <div className="content-area">
            <div className="banner">
              <div className="banner-content">
                <h3>Choose Annotation Type</h3>
                <p>Select the type of annotation you would like to create</p>

                <div className="form-control">
                  <select
                    value={newTool || ''}
                    onChange={(e) => {
                      setNewTool(e.target.value);
                    }}
                    className="annotation-type-select"
                  >
                    {Object.keys(toolTypes).map((toolKey) => (
                      <option key={toolKey} value={toolKey}>
                        {toolNames[toolKey as keyof typeof toolNames]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="button-group">
                  <button
                    onClick={handleCreateAnnotation}
                    className="primary"
                  >
                    Create Annotation
                  </button>
                  <button
                    onClick={handleCancelAddAnnotation}
                    className="secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>

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
          </div>
        </div>
      </main>
    );
  }
}

export default App;