import { AnnotationEditorProps } from './App'
import React from 'react';

/* TODO: Define additional tools as React components here. */

const ColorPicker: React.FC<AnnotationEditorProps> = (props) => {
  return (
    <input type="color"
      value={props.utils.getText()}
      onChange={e => props.utils.setText(e.target.value)} />
  );
}

const Comment: React.FC<AnnotationEditorProps> = (props) => {
  return (
    <textarea
      value={props.value.metadata.comment || ""}
      onChange={e =>
        props.utils.setMetadata({comment: e.target.value})} />
  );
}
  

/* TODO: Add all tools to be used here. */
export const tools = {
    comment: Comment,
    colorPicker: ColorPicker
}