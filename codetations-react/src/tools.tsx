import { AnnotationEditorProps } from './App'
import React from 'react';

/* TODO: Define additional tools as React components here. */
const Comment: React.FC<AnnotationEditorProps> = (props) => {
    return (
      <input type="text"
        value={props.utils.getText()}
        onChange={e => props.utils.setText(e.target.value)} />
    );
  }
  

/* TODO: Add all tools to be used here. */
export const additionalTools = {
    comment: Comment
}