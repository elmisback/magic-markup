import AnnotationEditorProps from '../../AnnotationEditorProps';
const ColorPicker: React.FC<AnnotationEditorProps> = (props) => {
  return (<input type="color"
    value={props.utils.getText()}
    onChange={e => props.utils.setText(e.target.value)} />);
}

export default ColorPicker;