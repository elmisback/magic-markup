import React from 'react';
import AnnotationEditorProps from '../../AnnotationEditorProps';
type Tool = React.FC<AnnotationEditorProps>;
const ColorPicker: Tool = (props) => {
  return (<input type="color"
    value={props.utils.getText()}
    onChange={e =>
      props.utils.setText(e.target.value)} />);
}

export default ColorPicker;