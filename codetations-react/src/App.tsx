import React, { useEffect, useState } from 'react';
// import logo from './logo.svg';
import './App.css';
import DocumentViewer from './DocumentViewer';
import Annotation from './Annotation';
import ReactDiffViewer from 'react-diff-viewer-continued';
import Split from 'react-split'
import './App.css'
import CodeMirror, { Decoration, EditorState, EditorView, RangeSetBuilder, basicSetup } from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';



import { useContext } from 'react';
import { DocumentContext, DocumentProvider } from './DocumentContext';
import { DiskStateContext, DiskStateProvider } from './DiskStateContext';

function App3(props: { documentContent: string, annotations: Annotation[] }) {
  // just render the document content with the annotations highlighted
  // write it all out here
  const { documentContent, annotations } = props;
  // const contentWithAnnotations = annotations.reduce((acc, annotation) => {
    
  return (
    <div>
      <h1>Document Content</h1>
      <pre>{documentContent}</pre>
      <h1>Annotations</h1>
      {annotations.map((annotation, index) => (
        <div key={index}>
          <div>Start: {annotation.start}</div>
          <div>End: {annotation.end}</div>
          <div>Document: {annotation.document}</div>
          <div>Tool: {annotation.tool}</div>
          <div>Metadata: {JSON.stringify(annotation.metadata)}</div>
        </div>
      ))}
    </div>
  );
}

// function App2(props: { documentContent: string, annotations: Annotation[]}) {
//   // get document from props
//   const { documentContent, annotations } = props;

//   // const [value, setValue] = React.useState("console.log('hello world!');");

//   // readonly, so we don't need to update the document
//   // const onChange = React.useCallback((val:any, viewUpdate:any) => {
//   //   console.log('val:', val);
//   //   setValue(val);
//   // }, []);

//   // Define decorations for highlighting annotations
//   const createDecorations = (annotations: Annotation[]) => {
//     const builder = new RangeSetBuilder<Decoration>();
//     annotations.forEach((annotation) => {
//       const { start, end } = annotation;
//       builder.add(start, end, Decoration.mark({ class: 'highlight-annotation' }));
//     });
//     return builder.finish();
//   };

//   // Create a plugin to add the decoration to the view
//   const highlightLinePlugin = ViewPlugin.fromClass(class {
//     constructor(view: any) {
//       this.decorations = [lineDecoration];
//       this.update = this.update.bind(this);
//       this.decorationsPlugin = Decoration.plugin(this.decorations);
//       this.decorationsPlugin(view);
//     }

//     update(update) {
//       const oldRanges = this.decorations.map(d => d.range);
//       const updatedRanges = update.state.doc.lines.map((_, i) => ({
//         anchor: i,
//         head: i
//       }));
//       const diff = Decoration.diff(oldRanges, updatedRanges);
//       this.decorations = this.decorations
//         .filter(d => !diff.deletions.includes(d))
//         .concat(diff.additions.map(range => Decoration.line({
//           attributes: {
//             style: 'background-color: red;'
//           },
//           range
//         })));
//       this.decorationsPlugin.update({
//         decorations: this.decorations
//       });
//     }
//   });


//   // Editor state, initialized with decorations for annotations
//   const [editorState, setEditorState] = useState(() => EditorState.create({
//     doc: annotations[0]?.document || '',
//     extensions: [
//       basicSetup(),
//       EditorState.readOnly.of(true),
//       // EditorView.updateListener.of(handleEditorUpdate),
//       // EditorView.decorations.of(createDecorations(annotations)),
//       EditorView.decorations.compute([], state => createDecorations(annotations))
//     ]
//   }));

//   return <CodeMirror value={documentContent} height="200px" extensions={[javascript({ jsx: true })]} />;
// }

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

  if (annotations === undefined) {
    console.error("Error: annotations couldn't be read", diskState);
    return <div>Error: annotations couldn't be read</div>;
  }
  
  return (
    <DiskStateProvider stateURI='example/.sample.txt.ann.json' serverUrl='ws://localhost:3002'>
      <DocumentProvider serverUrl="ws://localhost:3002" documentURI='example/sample.txt'>
        <Split className="split">
          {/* <App2 documentContent={documentContent} annotations={ annotations }></App2> */}
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
      <div> 
        {/* list of annotations */}
        <h1>Annotations</h1>
        {annotations?.map((annotation, index) => (
          <AnnotationEditorContainer value={annotation} setValue={(a) => setAnnotation(index, a)} key={index} />
        ))}
            </div>
        </div>
        {/* show the disk state */}
          </Split>
    </DocumentProvider>
    </DiskStateProvider>
  );
}


export default App;
