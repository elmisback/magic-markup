import React, { useState, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { useDropzone } from "react-dropzone";
import { AnnotationEditorProps } from "../../App";

interface ImageData {
  file: File;
  src: string;
}

const MarkdownComment: React.FC<AnnotationEditorProps> = (props) => {
  const [markdown, setMarkdown] = useState(props.value.metadata.markdown || "");
  const [uploadedImages, setUploadedImages] = useState<ImageData[]>(
    props.value.metadata.images || []
  );

  useEffect(() => {
    props.utils.setMetadata({ markdown, images: uploadedImages });
  }, [markdown, uploadedImages]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const binaryStr = reader.result as string;
          const newImage: ImageData = { file, src: binaryStr };
          setUploadedImages((prev) => [...prev, newImage]);
          props.utils.setMetadata({
            markdown,
            images: [...uploadedImages, newImage],
          });
        };
        reader.readAsDataURL(file);
      });
    },
    [markdown, uploadedImages]
  );

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  const handleMarkdownChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const newMarkdown = event.target.value;
    setMarkdown(newMarkdown);
    props.utils.setMetadata({
      markdown: newMarkdown,
      images: uploadedImages,
    });
  };

  const insertImage = (src: string) => {
    const newMarkdown = `${markdown}\n![image](${src})`;
    setMarkdown(newMarkdown);
    props.utils.setMetadata({
      markdown: newMarkdown,
      images: uploadedImages,
    });
  };

  return (
    <div>
      <textarea
        value={markdown}
        onChange={handleMarkdownChange}
        rows={10}
        cols={50}
        placeholder="Enter your markdown here..."
      />
      <div
        {...getRootProps()}
        style={{
          border: "1px dashed #ccc",
          padding: "20px",
          marginTop: "10px",
        }}
      >
        <input {...getInputProps()} />
        <p>Drag 'n' drop some files here, or click to select files</p>
      </div>
      <div style={{ marginTop: "10px" }}>
        {uploadedImages.map((img, index) => (
          <div key={index} style={{ marginBottom: "10px" }}>
            <img src={img.src} alt="Uploaded" style={{ maxWidth: "200px" }} />
            <button onClick={() => insertImage(img.src)}>Insert Image</button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "20px" }}>
        <h3>Preview</h3>
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
};

export default MarkdownComment;
