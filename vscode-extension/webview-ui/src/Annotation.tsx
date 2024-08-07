interface Annotation {
  start: number;
  end: number;
  document: string;
  tool: string;
  metadata: any;
  original: { document: string, start: number, end: number };
}

export default Annotation;