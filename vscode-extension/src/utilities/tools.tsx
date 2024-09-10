import React, { TextareaHTMLAttributes, useCallback } from "react";
import { useState, useEffect } from "react";
import { ObjectInspector } from "react-inspector";

interface ImageData {
  file: File;
  src: string;
}

interface AnnotationUpdate {
  document?: string;
  metadata?: any;
}

interface AnnotationEditorProps {
  value: Annotation;
  setValue: (value: AnnotationUpdate) => void;
  utils?: any;
}

interface Annotation {
  id: string;
  start: number;
  end: number;
  document: string;
  tool: string;
  metadata: any;
  original: { document: string; start: number; end: number };
}

// const MarkdownComment: React.FC<AnnotationEditorProps> = (props) => {
//   const [markdown, setMarkdown] = useState(props.value.metadata.markdown || "");
//   const [uploadedImages, setUploadedImages] = useState<ImageData[]>(
//     props.value.metadata.images || []
//   );

//   useEffect(() => {
//     props.utils.setMetadata({ markdown, images: uploadedImages });
//   }, [markdown, uploadedImages]);

//   const onDrop = useCallback(
//     (acceptedFiles: File[]) => {
//       acceptedFiles.forEach((file) => {
//         const reader = new FileReader();
//         reader.onload = () => {
//           const binaryStr = reader.result as string;
//           const newImage: ImageData = { file, src: binaryStr };
//           setUploadedImages((prev) => [...prev, newImage]);
//           props.utils.setMetadata({
//             markdown,
//             images: [...uploadedImages, newImage],
//           });
//         };
//         reader.readAsDataURL(file);
//       });
//     },
//     [markdown, uploadedImages]
//   );

//   const { getRootProps, getInputProps } = useDropzone({ onDrop });

//   const handleMarkdownChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
//     const newMarkdown = event.target.value;
//     setMarkdown(newMarkdown);
//     props.utils.setMetadata({
//       markdown: newMarkdown,
//       images: uploadedImages,
//     });
//   };

//   const insertImage = (src: string) => {
//     const newMarkdown = `${markdown}\n![image](${src})`;
//     setMarkdown(newMarkdown);
//     props.utils.setMetadata({
//       markdown: newMarkdown,
//       images: uploadedImages,
//     });
//   };

//   return (
//     <div>
//       <textarea
//         value={markdown}
//         onChange={handleMarkdownChange}
//         rows={10}
//         cols={50}
//         placeholder="Enter your markdown here..."
//       />
//       <div
//         {...getRootProps()}
//         style={{
//           border: "1px dashed #ccc",
//           padding: "20px",
//           marginTop: "10px",
//         }}>
//         <input {...getInputProps()} />
//         <p>Drag 'n' drop some files here, or click to select files</p>
//       </div>
//       <div style={{ marginTop: "10px" }}>
//         {uploadedImages.map((img, index) => (
//           <div key={index} style={{ marginBottom: "10px" }}>
//             <img src={img.src} alt="Uploaded" style={{ maxWidth: "200px" }} />
//             <button onClick={() => insertImage(img.src)}>Insert Image</button>
//           </div>
//         ))}
//       </div>
//       <div style={{ marginTop: "20px" }}>
//         <h3>Preview</h3>
//         <ReactMarkdown>{markdown}</ReactMarkdown>
//       </div>
//     </div>
//   );
// };

const ColorPicker: React.FC<AnnotationEditorProps> = (props) => {
  return (
    <input
      type="color"
      value={props.utils.getText()}
      onChange={(e) => props.utils.setText(e.target.value)}
    />
  );
};

const Comment: React.FC<AnnotationEditorProps> = (props) => {
  return (
    <textarea
      value={props.value.metadata.comment || ""}
      onChange={(e) => props.utils.setMetadata({ comment: e.target.value })}
    />
  );
};

const ImageUpload: React.FC<AnnotationEditorProps> = (props) => {
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && event.target.result) {
          props.utils.setMetadata({ image: event.target.result as string });
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleImageUpload} />
      {props.value.metadata.image && <img src={props.value.metadata.image} alt="Uploaded" />}
    </div>
  );
};

const DisplayHTML: React.FC<AnnotationEditorProps> = (props) => {
  const [htmlContent, setHtmlContent] = useState(props.value.metadata.html || "");

  const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    const newHtmlContent = e.target.value;
    setHtmlContent(newHtmlContent);
    props.utils.setMetadata({ html: newHtmlContent });
  };

  return (
    <div>
      <textarea
        value={htmlContent}
        onChange={handleChange}
        placeholder="Write your HTML code here"
        style={{ width: "100%", height: "150px" }}
      />
      <div style={{ marginTop: "10px", border: "1px solid #ccc", padding: "10px" }}>
        <h3>Preview:</h3>
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      </div>
    </div>
  );
};

const RunCodeSegment: React.FC<AnnotationEditorProps> = (props) => {
  const [code, setCode] = useState<string[]>(props.value.metadata.code || [""]);

  // Add a return statement to a code block if none is found.
  function addReturn(code: string): string {
    // Match the last line in the string
    const lines: string[] = code.trim().split("\n");

    if (lines.length === 0) {
      return "";
    }

    const lastLine = lines[lines.length - 1];
    lines[lines.length - 1] = `return ${lastLine.trim()}`;

    return lines.join("\n");
  }

  function runAndUpdateCode(): void {
    try {
      let empty: Boolean = true;
      for (let i = 0; i < code.length; i++) {
        if (code[i].trim() !== "") {
          empty = false;
          break;
        }
      }
      if (empty) {
        props.utils.setMetadata({
          error: "No code to run",
          response: undefined,
          code: code,
        });
        return;
      }
      let result = new Function(code.join("\n"))();
      if (result === undefined) {
        const newCode: string = addReturn(code.join("\n"));
        try {
          result = new Function(newCode)();
        } catch {}
      }
      props.utils.setMetadata({
        response: result || "Undefined",
        error: undefined,
        code: code,
      });
    } catch (e) {
      props.utils.setMetadata({
        response: undefined,
        error: e instanceof Error ? e.message : String(e),
        code: code,
      });
    }
  }

  return (
    <div>
      {props.value.metadata.error && (
        <div style={{ color: "red" }}>An error occurred: {props.value.metadata.error}</div>
      )}
      {props.value.metadata.response && (
        <div>
          Response: &nbsp; <ObjectInspector data={props.value.metadata.response} />
        </div>
      )}
      {code.map((c, i) => (
        <div>
          <textarea
            key={i}
            rows={4}
            cols={72}
            value={c}
            onChange={(e) => {
              const newCode = [...code];
              newCode[i] = e.target.value;
              setCode(newCode);
            }}
          />
          <button
            onClick={() => {
              const newCode = [...code];
              newCode.splice(i, 1);
              setCode(newCode);
            }}>
            Remove Code Block
          </button>
        </div>
      ))}
      <br></br>
      <button
        onClick={() => {
          const newCode = [...code];
          newCode.push("");
          setCode(newCode);
        }}>
        Add Code Block
      </button>
      <br></br>
      <button onClick={runAndUpdateCode}>Run Highlighted Code</button>
      <br></br>
      <button
        onClick={() =>
          props.utils.setMetadata({
            response: undefined,
            error: undefined,
          })
        }>
        Clear Output
      </button>
    </div>
  );
};

/* TODO: Define additional tools as React components here. */

/* TODO: Add all tools to be used here. */
export const tools = {
  comment: Comment,
  colorPicker: ColorPicker,
  runCodeSegment: RunCodeSegment,
  // markdownComment: MarkdownComment,
  imageUpload: ImageUpload,
  displayHTML: DisplayHTML,
};
