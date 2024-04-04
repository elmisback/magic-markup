import React, { useContext, useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { basicSetup } from '@codemirror/basic-setup';
import { EditorState, RangeSetBuilder } from '@codemirror/state';
import { Decoration, ViewUpdate } from '@codemirror/view';
import { DiskStateContext } from './DiskStateContext'; // Adjust import paths as necessary
import Annotation from './Annotation';

const CodeMirrorEditor = () => {
  const { diskState, setDiskState } = useContext(DiskStateContext);
  const [annotations, setAnnotations] = useState(diskState?.annotations || []);
  const [selectedTextRange, setSelectedTextRange] = useState(null);

  // Define decorations for highlighting annotations
  const createDecorations = (annotations: Annotation[]) => {
    const builder = new RangeSetBuilder<Decoration>();
    annotations.forEach((annotation) => {
      const { start, end } = annotation;
      builder.add(start, end, Decoration.mark({ class: 'highlight-annotation' }));
    });
    return builder.finish();
  };

  // Editor state, initialized with decorations for annotations
  const [editorState, setEditorState] = useState(() => EditorState.create({
    doc: annotations[0]?.document || '',
    extensions: [
      basicSetup,
      EditorState.readOnly.of(true),
      EditorState.decorations.of(createDecorations(annotations))
    ]
  }));

  // Update decorations when annotations change
  useEffect(() => {
    const decorations = createDecorations(annotations);
    setEditorState(currentState => currentState.update({
      effects: EditorState.decorations.reconfigure(decorations)
    }));
  }, [annotations]);

  // Function to apply annotation
  const applyAnnotation = (color) => {
    if (!selectedTextRange) return;

    // For simplicity, we're just console.logging here.
    // In practice, you'd update the annotations state and send updates to the server or parent component.
    console.log(`Applying annotation from ${selectedTextRange.from} to ${selectedTextRange.to} with color ${color}`);

    // Reset selection after applying annotation
    setSelectedTextRange(null);
  };

  return (
    <div className="editor-container">
      <CodeMirror
        value={editorState.doc.toString()}
        height="500px"
        extensions={[basicSetup, editorState]}
        onChange={(value, viewUpdate) => {
          // No need to handle changes as the editor is read-only
        }}
        onUpdate={(update) => {
          if (update.docChanged) {
            // Handle document changes
          }
          if (update.selectionSet) {
            const { from, to } = update.state.selection.main;
            if (from !== to) {
              // Text is selected
              setSelectedTextRange({ from, to });
            } else {
              setSelectedTextRange(null);
            }
          }
        }}
      />
      {/* Context menu for annotation application */}
      {selectedTextRange && (
        <div style={{ marginTop: '20px' }}>
          <label>Apply annotation:</label>
          <button onClick={() => applyAnnotation('red')}>Red</button>
          <button onClick={() => applyAnnotation('green')}>Green</button>
          <button onClick={() => applyAnnotation('blue')}>Blue</button>
        </div>
      )}
    </div>
  );
};

export default CodeMirrorEditor;
