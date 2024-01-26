import { useState } from 'react';
import logo from './logo.svg';
import './App.css';

import JsxParser from 'react-jsx-parser'

class Annotation {
  // start (index)
  // stop (index)
  // note (string)
  // comments (string [])
  // explanation (string)
  // test_function (string -- function)
  // editor (string -- react component with setValue argument)
  // original_document (string)
  constructor(
    public start: number=0,
    public stop: number=0,
    public note: string='default note',
    public comments: string[]=[],
    public explanation: string='',
    public test_function: string='',
    public editor: any=``, // this string is a react component that we need to eval
    public original_document: string=''
  ) {}
}

function AnnotationEditor(props: { value: Annotation, setValue: (value: Annotation) => void }) {
  const { value, setValue } = props;
  // show all properties of the annotation and allow editing
  // content is document from start to stop
  const content = value.original_document.slice(value.start, value.stop);
  const setNote = (note: string) => {
    setValue(new Annotation(value.start, value.stop, note, value.comments, value.explanation, value.test_function, value.editor, value.original_document));
  }

  // const [note, setNote] = useState(value.note);
  const addComment = () => {
    // add comment to annotation
  }
  // for now, the "editor" is just a button that calls the edit server with the editor's value
  const editText = (newValue: string) => {
    // call edit server
    console.log("TODO call edit server", newValue);
  }

  return (
    <div>
      <h2>Annotation</h2>
      {/* <p>Start: {value.start}</p>
      <p>Stop: {value.stop}</p> */}
      <p>Content: { content }</p>
      <p>Note:</p>
      <textarea value={value.note} onChange={e => setNote(e.target.value)} />
      {/* <button onClick={() => setNoteClick(note)}>Set Note</button> */}
      <p>Comments: {value.comments}</p>
      {/* <p>Explanation: {value.explanation}</p>
      <p>Test Function: {value.test_function}</p> */}
      {/* editor: we eval the editor string to get a react component that calls editText */}
      {/* <JsxParser
        bindings={{ setValue: editText }}
        jsx={value.editor}
        renderError={err => <div>{err.toString()}</div>}
      /> */}
      {value.editor(content, editText)}
      <p>Original Document: {value.original_document}</p>
    </div>
  )
}

function App() {

  const [annotations, setAnnotations] = useState<Annotation[]>([
    new Annotation(23, 31, 'test note', [], 'test explanation', 'test function', (content: any, editText: (arg0: any) => void) => <div>
      <input type="color" value={content} onChange={e => {console.log('input'); editText(e.target.value)}} />
  </div>, 'test original document #0000FF'),
    new Annotation(5, 14, 'test note', [], 'test explanation', 'test function', () => "hi", 'test original document #0000FF'),
  ]);

  const setAnnotation = (index: number, annotation: Annotation) => {
    setAnnotations(annotations.map((value, i) => i === index ? annotation : value));
  }
  const [documentURI, setDocumentURI] = useState('/home/elm/codetations/codetations-react/temp/sample.txt');
  const [stateURI, setStateURI] = useState('/home/elm/codetations/codetations-react/temp/.sample.txt.codetations');

  return (
    <div className="App">
      {/* Document path to open */}
      <div>Document URI: &nbsp;
        <input type="text" value={documentURI} onChange={e => setDocumentURI(e.target.value)} />
      </div>
      <div>State URI: &nbsp;
        <input type="text" value={stateURI} onChange={e => setStateURI(e.target.value)} />
      </div>
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
        {annotations.map((annotation, index) => (
          <AnnotationEditor value={annotation} setValue={(a) => setAnnotation(index, a)} key={index} />
        ))}
      </div>
    </div>
  );
}

// Create a WebSocket connection to the server
const socket = new WebSocket('ws://localhost:8080');

// Connection opened
socket.addEventListener('open', (event) => {
  console.log('WebSocket connection opened');
  // can use socket.send to send messages to the server
});

// Listen for messages
socket.addEventListener('message', (event) => {
    console.log('Message from server: ', event.data);
    const state = JSON.parse(event.data);
    // Now you can use the state object to update your application
});

// Connection closed
socket.addEventListener('close', (event) => {
    console.log('WebSocket connection closed');
});

// Connection error
socket.addEventListener('error', (event) => {
    console.log('WebSocket error: ', event);
});

export default App;
