import AnnotationEditorProps from '../../AnnotationEditorProps';

import NoCodeTool from '../lib/NoCodeTool/NoCodeTool';

const ColorPicker: React.FC<AnnotationEditorProps> = (props) => {
  console.log('color', JSON.stringify(props.utils.getText()));
  return (
    <input type="color"
      value={props.utils.getText()}
      onChange={e => props.utils.setText(e.target.value)} />
  );
}

export default ColorPicker;