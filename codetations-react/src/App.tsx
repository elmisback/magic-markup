import React, { useEffect, useState } from 'react';
// import logo from './logo.svg';
import './App.css';
import DocumentViewer from './DocumentViewer';
import Annotation from './Annotation';
import ReactDiffViewer from 'react-diff-viewer-continued';

// import retag from './retag';

// import JsxParser from 'react-jsx-parser'

import { useContext } from 'react';
import { DocumentContext, DocumentProvider } from './DocumentContext';
import { DiskStateContext, DiskStateProvider } from './DiskStateContext';

function useDocument() {
  const context = useContext(DocumentContext);
  if (context === undefined) {
    throw new Error('useDocument must be used within a DocumentProvider');
  }
  return context;
}

function useDiskState() {
  const context = useContext(DiskStateContext);
  console.log('using disk state', context)
  if (context === undefined) {
    throw new Error('useDiskState must be used within a DiskStateProvider');
  }
  return context;
}

interface AnnotationUpdate {
  document?: string;
  metadata?: any;
}

interface AnnotationEditorProps {
  value: Annotation,
  setValue: (value: AnnotationUpdate) => void,
  utils?: any;
}

const ColorPicker: React.FC<AnnotationEditorProps> = (props) => {
  console.log('color', JSON.stringify(props.utils.getText()));
  return (
    <input type="color"
      value={props.utils.getText()}
      onChange={e => props.utils.setText(e.target.value)} />
  );
}

function AnnotationEditorContainer(props: { value: Annotation, setValue: (value: AnnotationUpdate) => void }) {
  const { value, setValue } = props;

  type ToolTypes = {
    [key: string]: React.FC<AnnotationEditorProps>;
  };

  const toolTypes : ToolTypes  = {
    colorPicker: ColorPicker,
  }

  return (
    <div>
      <h2>Annotation</h2>
      <div>Start: {value.start}</div>
      <div>End: {value.end}</div>
      <div>Document: {value.document}</div>
      <div>Tool: {value.tool}</div>
      <div>Metadata: {JSON.stringify(value.metadata)}</div>
      <div>Original Document: {value.original.document}</div>
      <div>Original Start: {value.original.start}</div>
      <div>Original End: {value.original.end}</div>
      <div>Editor:</div>
      {toolTypes[value.tool]?.({
        value,
        setValue:
          (v: AnnotationUpdate) =>
            setValue({ ...value, document: v.document, metadata: v.metadata }),
        utils: {
          getText: () => value.document.slice(value.start, value.end),
          setText: (newText: string) => {
            setValue({
              document: value.document.slice(0, value.start) + newText + value.document.slice(value.end),
              metadata: value.metadata
            });
          }
        }
      })}
    </div>
  )
}

const SomeComponent: React.FC = () => {
  const { documentContent } = useDocument();
  
  return (
    <div>
      <h3>Document Content:</h3>
      <pre>{documentContent}</pre>
    </div>
  );
};

function App() {
  return (
    <DiskStateProvider serverUrl='ws://localhost:3002' stateURI='example/.sample.txt.ann.json'>
      <DocumentProvider serverUrl='ws://localhost:3002' documentURI='example/sample.txt'>
        <Main />
      </DocumentProvider>
    </DiskStateProvider>
  );
}

function Main() {
  const { documentContent, setDocumentContent } = useDocument();
  const { diskState, setDiskState } = useDiskState();
  const [continuousRetag, setContinuousRetag] = useState(false);
  const [documentOutOfDate, setDocumentOutOfDate] = useState(false);
  // const [annotations, setAnnotations] = useState<Annotation[]>([
  //   new Annotation(23, 31, 'test note', [], 'test explanation', 'test function', (content: any, editText: (arg0: any) => void) => <div>
  //     <input type="color" value={content} onChange={e => {console.log('input'); editText(e.target.value)}} />
  // </div>, 'test original document #0000FF'),
  //   new Annotation(5, 14, 'test note', [], 'test explanation', 'test function', () => "hi", 'test original document #0000FF'),
  // ]);
  const annotations = diskState?.annotations;

  const setAnnotation = (index: number, annotationUpdate: AnnotationUpdate) => {
    console.log('setting annotation', index, annotationUpdate);
    // if the document is out of date, disable setting the annotation
    if (documentOutOfDate) {
      console.error('Document is out of date');
      return;
    }
    // if the annotation involves setting the document, first we need to do that
    if (annotationUpdate.document && annotationUpdate.document !== documentContent) {
      // set the document content
      setDocumentContent(annotationUpdate.document);
    }
    setDiskState({ annotations: annotations?.map((value, i) => i === index ? {...annotations[i], ...annotationUpdate} : value) });
  }

  const [documentURI, setDocumentURI] = useState('/home/elm/codetations/codetations-react/example/sample.txt');
  const [stateURI, setStateURI] = useState('/home/elm/codetations/codetations-react/example/.sample.txt.ann');

  useEffect(() => {
    // check if the document is out of date
    // compare the document content to the state file
    // if the document is out of date, setDocumentOutOfDate(true)
    // if the document is up to date, setDocumentOutOfDate(false)
    console.log('Checking if document is out of date');
    const oldDocumentContent = diskState?.annotations[0]?.document;
    if (documentContent !== oldDocumentContent) {
      setDocumentOutOfDate(true);
    }
    if (documentContent === oldDocumentContent) {
      setDocumentOutOfDate(false);
    }
  }, [documentContent, diskState?.annotations])

  const handleRetag = async () => {
    // send message to server to retag
    console.log('Retagging document');
    if (!annotations) {
      console.error('Error: no annotations');
      return;
    }
    for (let i = 0; i < annotations.length; i++) {
      const annotation = annotations[i];
      console.log('Annotation:', annotation);
      const oldDocumentContent = annotation.document;
      const codeUpToSnippet = oldDocumentContent.slice(0, annotation.start);
      const codeAfterSnippet = oldDocumentContent.slice(annotation.end);
      const annotationText = oldDocumentContent.slice(annotation.start, annotation.end);
      const delimiter = '★';
      const codeWithSnippetDelimited = codeUpToSnippet + delimiter + annotationText + delimiter + codeAfterSnippet;
      const updatedCodeWithoutDelimiters = documentContent
      const output = await fetch('http://localhost:3004/retag',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ codeWithSnippetDelimited, updatedCodeWithoutDelimiters, delimiter })
        }).then(res => res.json());

      // update the annotation
      console.log('Output:', output);
      const updatedAnnotation = { ...annotation, document: updatedCodeWithoutDelimiters, start:  output.out.leftIdx, end: output.out.rightIdx };
      setDiskState({ annotations: annotations.map((value, j) => j === i ? updatedAnnotation : value) });
    }
    
  }
  
  return (
    <DiskStateProvider stateURI='example/.sample.txt.ann.json' serverUrl='ws://localhost:3002'>
      <DocumentProvider serverUrl="ws://localhost:3002" documentURI='example/sample.txt'>
    <div className="App">
      {/* Document path to open */}
      <div>Document URI: &nbsp;
        <input type="text" value={documentURI} onChange={e => setDocumentURI(e.target.value)} />
      </div>
      <div>State URI: &nbsp;
        <input type="text" value={stateURI} onChange={e => setStateURI(e.target.value)} />
      </div>
          <hr></hr>
          {/* if document is out of date, show a warning */}
          {documentOutOfDate && <div style={{ color: 'red' }}>Document is out of date! Annotation updates are disabled. Re-apply tags to enable updates.</div>}
          {documentOutOfDate &&
            <ReactDiffViewer
              oldValue={diskState?.annotations[0]?.document || ''}
              newValue={documentContent || ''}
              splitView={true} />}
      <div>Retag document</div>
      <button onClick={handleRetag} disabled={
        !documentOutOfDate || continuousRetag || documentURI === ''
        || stateURI === ''
       }>Retag</button>

      <div>Continuous Retag: &nbsp;
        <input type="checkbox" checked={continuousRetag} onChange={e => setContinuousRetag(e.target.checked)} />
      </div>
      <hr></hr>
      {/* <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header> */}
      
      <div> 
        {/* list of annotations */}
        <h1>Annotations</h1>
        {annotations?.map((annotation, index) => (
          <AnnotationEditorContainer value={annotation} setValue={(a) => setAnnotation(index, a)} key={index} />
        ))}
      </div>
        <DocumentViewer serverUrl='ws://localhost:3002' />
        <SomeComponent />
      
        </div>
        {/* show the disk state */}
        <pre>{JSON.stringify(diskState, undefined, 2)}</pre>
    </DocumentProvider>
    </DiskStateProvider>
  );
}

export default App;
