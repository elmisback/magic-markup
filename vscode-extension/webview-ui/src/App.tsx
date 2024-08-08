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

type RetagFunction = (currentDocument: string, annotation: Annotation) => Promise<Annotation | undefined>;

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
): [string | undefined, (object: any) => void] {
  // TODO May want to read up on how to do websockets with React properly, 
  // e.g. https://stackoverflow.com/questions/60152922/proper-way-of-using-react-hooks-websockets
  const [document, setDocument] = useState(undefined as (string | undefined));

  if (!serverUrl || !documentURI) {
    return [undefined, () => { }];
  }

  const ws = new WebSocket(serverUrl);

  ws.onmessage = (event) => {
    try {
      const document = event.data;
      setDocument(readCallback(document));
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



const preprocessAnnotation = (annotation: Annotation) => {
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
  return {
    codeWithSnippetDelimited,
    delimiter
  };
}

const useRetagFromAPI = (retagServerUrl: string, APIKey: string) => async (currentDocument: string, annotation: Annotation) => {
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
      APIKey
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
}

function RetagHeadlineWarning(props: {
  currentDocument: string | undefined;
  annotations: Annotation[];
  setAnnotations: (annotations: Annotation[]) => void;
  retag: RetagFunction | undefined;
}) {
  const { currentDocument, annotations, setAnnotations, retag } = props;

  return (
    <>
      {currentDocument &&
        <>
          Document is out of date!
          {retag &&
            <button
              onClick={async () => {

                // Update the annotations after awaiting retagging promises
              const newAnnotations = await Promise.all(annotations.map(async annotation => {
                  // TODO error handling
                  return await retag(currentDocument, annotation) || annotation;
                }
                ));
                setAnnotations(newAnnotations);
              }}
            >Retag</button>}
        </>
      }
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
      // case "test":
      //   console.log("Test message received");
      //   break;
      case "setDocumentURI":
        setDocumentURI(data.documentURI);
        break;
      case "setAnnotationURI":
        setAnnotationURI(data.annotationURI);
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

function App() {
  // Data source configuration
  const [fileServerURL, setFileServerUrl] = useState(undefined as string | undefined);
  const [annotationURI, setAnnotationURI] = useState(undefined as string | undefined);
  const [documentURI, setDocumentURI] = useState(undefined as string | undefined);

  // Data
  const [annotations, setAnnotations] = useState(annotationsDefault.annotations); // useObjectFromWSServer("ws://localhost:8073", annotationURI);
  const [currentDocument, setCurrentDocument] = useDocumentFromWSFileServer(fileServerURL, documentURI)

  // Transient editor + UI state
  const [currentLineNumber, setCurrentLineNumber] = useState(undefined as number | undefined);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(undefined as number | undefined);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState(undefined as number | undefined);

  // Other configuration
  const [retagServerURL, setRetagServerURL] = useState(undefined as string | undefined);
  
  // HACK For now, use browser storage to initialize API key
  const [APIKey, setAPIKey] = useState(
    () => window.localStorage.getItem('APIKey') || undefined
  );

  // Listen for configuration updates from editor
  listenForEditorMessages(setDocumentURI, setAnnotationURI, setFileServerUrl, setCurrentLineNumber, setRetagServerURL);

  const documentOutOfDate = annotations.some(annotation => {
    return annotation.document !== currentDocument;
  });

  const retag = retagServerURL && APIKey ? useRetagFromAPI(retagServerURL, APIKey) : undefined;

  console.log('currentDocument', currentDocument)
  return (
    <main>
      {documentOutOfDate && <RetagHeadlineWarning currentDocument={currentDocument} annotations={annotations} setAnnotations={setAnnotations} retag={retag} />}
      <AnnotationSidebarView annotations={annotations} setAnnotations={(annotations) => { }} currentLineNumber={currentLineNumber} selectedAnnotationId={selectedAnnotationId} setSelectedAnnotationId={() => { }} hoveredAnnotationId={hoveredAnnotationId} setHoveredAnnotationId={() => { }} />
    </main>
  );
}

export default App;
