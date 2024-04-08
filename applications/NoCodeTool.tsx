import AnnotationEditorProps from '../codetations-react/src/AnnotationEditorProps';

import NoCodeToolLib from './lib/NoCodeTool/NoCodeTool';

const NoCodeTool: React.FC<AnnotationEditorProps> = (props) => {
  console.log('color', JSON.stringify(props.utils.getText()));
  return (
    <input type="color"
      value={props.utils.getText()}
      onChange={e => props.utils.setText(e.target.value)} />
  );
}

export default NoCodeTool;