import Annotation from './Annotation';

interface AnnotationUpdate {
  document?: string;
  metadata?: any;
}

interface AnnotationEditorProps {
  value: Annotation,
  setValue: (value: AnnotationUpdate) => void,
  utils?: any;
}

export default AnnotationEditorProps;