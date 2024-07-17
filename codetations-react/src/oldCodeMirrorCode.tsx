// import CodeMirror, {
//   Decoration,
//   EditorState,
//   EditorView,
//   RangeSetBuilder,
//   ViewPlugin,
//   basicSetup,
// } from "@uiw/react-codemirror";
// import { javascript } from "@codemirror/lang-javascript";

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
export { }