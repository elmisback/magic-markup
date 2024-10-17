import { AnnotationEditorProps } from "./App";
import React, { TextareaHTMLAttributes, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import ReactMarkdown from "react-markdown";
import { useState, useEffect } from "react";
import { ObjectInspector } from "react-inspector";
import e from "cors";
import './tools.css';

type AnnotationType = React.FC<AnnotationEditorProps>
interface ImageData {
  file: File;
  src: string;
}

const commonTextStyle: React.CSSProperties = {
  fontFamily: "Poppins, sans-serif",
  fontSize: "14px",
  color: "black",
};

const ColorPicker: AnnotationType = (props) => {
  return (
    <div className="color-picker">
      <input
        value={props.value.metadata.colorName}
        onChange={(e) => props.utils.setMetadata({ colorName: e.target.value })}
      />
      <input
        type="color"
        value={props.utils.getText()}
        onChange={(e) => props.utils.setText(e.target.value)}
      />
    </div>
  );
};

const Comment: React.FC<AnnotationEditorProps> = (props) => {
  type Reply = {
    datetime: string;
    text: string;
  };

  const [comment, setComment] = useState(props.value.metadata.comment || "");
  const [replies, setReplies] = useState<Reply[]>(props.value.metadata.replies || []);
  const [newReplyText, setNewReplyText] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      props.utils.setMetadata({ comment, replies });
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [comment, replies]);

  const handleAddReply = () => {
    if (newReplyText.trim() !== "") {
      setReplies([...replies, { text: newReplyText, datetime: new Date().toLocaleString() }]);
      setNewReplyText("");
    }
  };

  const handleDeleteReply = (index: number) => {
    const newReplies = replies.filter((_, i) => i !== index);
    setReplies(newReplies);
  };

  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ fontFamily: "Poppins, sans-serif", display: 'flex', gap: '10px', alignItems: 'center' }}>
        <div style={{ fontWeight: 'bold', fontSize: "12px" }}>Alex Smith</div>
        <div style={{
          fontSize: "10px", 
          // align bottom of line
         }}>Today at 12:00 PM</div>
      </div>
      <div style={{ display: 'flex' }}>
        {/* user icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="30"
          height="30"
          fill="currentColor"
          viewBox="0 0 64 64"
          style={{ margin: "10px", marginLeft: "5px" }}
        >
          <circle cx="32" cy="32" r="30" fill="none" stroke="#999" stroke-width="2"/>
          <circle cx="32" cy="20" r="12" fill="#ccc" stroke="#999" stroke-width="2"/>
          <path d="M16 52c0-8.8 7.2-16 16-16s16 7.2 16 16v4H16v-4z" fill="#ccc" stroke="#999" stroke-width="2"/>
        </svg>
      
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Enter your comment here..."
        className="textarea"
      />
      <div
        style={{
          ...commonTextStyle,
          width: "calc(100% - 22px)",
          height: "80px",
          padding: "4px",
          border: "none", //"1px solid #ccc",
          // borderRadius: "4px",
          backgroundColor: "transparent",
          lineHeight: "16px",
          fontSize: "12px",
        }}
        />
      </div>
      {/* reply button */}
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginLeft: '40px' }}>
        ⤷
        <div style={{ fontSize: '12px' }}>Reply</div>
      </div>
      <div style={{ marginTop: "10px" }}>
        <strong style={{ color: "#525252" }}>Replies:</strong>
        {replies.map((reply, index) => (
          <div
            key={index}
            onClick={() => handleDeleteReply(index)}
            style={{
              marginTop: "5px",
              paddingLeft: "10px",
              borderLeft: "2px solid #ccc",
              color: "#525252",
              cursor: "pointer",
            }}>
            <i>Test User on {reply.datetime}:</i> {reply.text}
          </div>
        ))}
      </div>
      <div style={{ marginTop: "10px" }}>
        <textarea
          value={newReplyText}
          onChange={(e) => setNewReplyText(e.target.value)}
          placeholder="Enter your reply here..."
          className="textarea"
        />
        <button
          onClick={handleAddReply}
          style={{
            marginTop: "5px",
            ...commonTextStyle,
            padding: "5px 10px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer",
          }}>
          Add Reply
        </button>
      </div>
    </div>
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
      <input type="file" accept="image/*" onChange={handleImageUpload} style={commonTextStyle} />
      {props.value.metadata.image && <img src={props.value.metadata.image} alt="Uploaded" />}
    </div>
  );
};

const DisplayHTML: React.FC<AnnotationEditorProps> = (props) => {
  const [htmlContent, setHtmlContent] = useState(props.value.metadata.html || 
    //get text
    props.utils.getText() || ""
  );

  const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    const newHtmlContent = e.target.value;
    setHtmlContent(newHtmlContent);
    props.utils.setMetadata({ html: newHtmlContent });
  };

  return (
    <div>
      {/* <textarea
        value={htmlContent}
        onChange={handleChange}
        placeholder="Write your HTML code here"
        style={{ ...commonTextStyle, width: "100%", height: "150px" }}
      /> */}
      <div dangerouslySetInnerHTML={{ __html: htmlContent }} style={{ height: '50px', resize: 'both', overflow: 'auto', border: "1px solid #ccc", }} />
    </div >
  );
};

const RunCodeSegment: React.FC<AnnotationEditorProps> = (props) => {
  const [apiResName, setApiResName] = useState<string>(props.value.metadata.apiResName || "");
  const [apiRes, setApiRes] = useState<string>(props.value.metadata.apiRes || "");
  const [code, setCode] = useState<string[]>(props.value.metadata.code || ["", "", ""]);
  const [pinBody, setPinBody] = useState<boolean>(props.value.metadata.pinBody || false);
  const [showHead, setShowHead] = useState<boolean>(props.value.metadata.showHead || false);
  const [showTail, setShowTail] = useState<boolean>(props.value.metadata.showTail || false);

  function addReturn(code: string): string {
    const lines = code.trim().split("\n");
    if (lines.length === 0) {
      return "";
    }
    const lastLine = lines[lines.length - 1];
    lines[lines.length - 1] = `return ${lastLine.trim()}`;
    return lines.join("\n");
  }

  async function runAndUpdateCode(): Promise<void> {
    try {
      let empty = true;
      for (let i = 0; i < code.length; i++) {
        if (String(code[i]).trim() !== "") {
          empty = false;
          break;
        }
      }
      if (apiRes !== "" && apiResName === "") {
        empty = false;
      }
      if (empty) {
        props.utils.setMetadata({
          error: "No code to run",
          response: undefined,
          code: code,
        });
        return;
      }

      let joinedCode = code.join("\n");
      if (apiRes !== "" && apiResName !== "") {
        joinedCode = `const ${apiResName} = Promise.resolve(${apiRes});\n${joinedCode}`;
      }

      const asyncFunction = new Function(`return (async () => { ${joinedCode} })();`);
      let result = await asyncFunction();

      if (result === undefined) {
        const newCode = addReturn(joinedCode);
        try {
          const asyncReturnFunction = new Function(`return (async () => { ${newCode} })();`);
          result = await asyncReturnFunction();
        } catch {}
      }

      props.utils.setMetadata({
        response: result || "Undefined",
        error: undefined,
        code,
        apiRes,
        apiResName,
      });
    } catch (e) {
      props.utils.setMetadata({
        response: undefined,
        error: e instanceof Error ? e.message : String(e),
        code,
        apiRes,
        apiResName,
      });
    }
  }

  return (
    <div style={{ marginBottom: "10px" }}>
      
      <div style={{ marginBottom: "10px" }}>
        <label style={commonTextStyle}>
          <strong>Cached API Response</strong>
        </label>
        <div style={{ marginBottom: "10px" }}>
          <label style={commonTextStyle}>Mock Response:</label>
          <br></br>
          <textarea
            rows={4}
            value={apiRes}
            placeholder="Enter a JavaScript object..."
            onChange={(e) => setApiRes(e.target.value)}
            style={{
              ...commonTextStyle,
              width: "-webkit-fill-available",
              padding: "5px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </div>
        <div style={{ marginBottom: "10px" }}>
          <label style={commonTextStyle}>Mock Response Variable Name:</label>
          <br />
          <input
            value={apiResName}
            placeholder="Enter a variable name..."
            onChange={(e) => setApiResName(e.target.value)}
            style={{
              ...commonTextStyle,
              marginBottom: "10px",
              width: "-webkit-fill-available",
              padding: "5px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </div>
        <div style={{ marginBottom: "10px" }}>
          <label style={commonTextStyle}>Head:</label>
          <br></br>
          <textarea
            rows={4}
            value={code[0]}
            placeholder="Enter other JS preprocessing code..."
            onChange={(e) => {
              const newCode = [...code];
              newCode[0] = e.target.value;
              setCode(newCode);
            }}
            style={{
              ...commonTextStyle,
              width: "-webkit-fill-available",
              marginBottom: "10px",
              padding: "5px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </div>
        <div style={{ marginBottom: "10px" }}>
          <label style={commonTextStyle}>Body:</label>
          <br></br>
          <textarea
            rows={4}
            placeholder="Enter a JavaScript expression..."
            value={pinBody ? props.utils.getText() : code[1]}
            onChange={(e) => {
              if (!pinBody) {
                const newCode = [...code];
                newCode[1] = e.target.value;
                setCode(newCode);
              }
            }}
            style={{
              ...commonTextStyle,
              width: "-webkit-fill-available",
              padding: "5px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
          <div>
            <label style={commonTextStyle}>
              <input
                type="checkbox"
                checked={pinBody}
                onChange={() => {
                  setPinBody(!pinBody);
                  props.utils.setMetadata({ pinBody: !pinBody });
                }}
              />
              Pin body to annotated document text
            </label>
          </div>
        </div>
        <div style={{ marginBottom: "10px" }}>
          <label style={commonTextStyle}>Tail:</label>
          <br></br>
          <textarea
            rows={4}
            placeholder="Enter other JS postprocessing code..."
            value={code[2]}
            onChange={(e) => {
              const newCode = [...code];
              newCode[2] = e.target.value;
              setCode(newCode);
            }}
            style={{
              ...commonTextStyle,
              width: "-webkit-fill-available",
              marginBottom: "10px",
              padding: "5px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </div>
      </div>
      {props.value.metadata.error && (
        <div style={{ color: "red", marginBottom: "10px", ...commonTextStyle }}>
          An error occurred: {props.value.metadata.error}
        </div>
      )}
      {props.value.metadata.response && (
        <div style={{ marginBottom: "10px", ...commonTextStyle }}>
          <strong>Response:</strong> <ObjectInspector data={props.value.metadata.response} />
        </div>
      )}
      <div style={{ marginBottom: "10px" }}>
        <button
          onClick={runAndUpdateCode}
          style={{
            marginRight: "10px",
            ...commonTextStyle,
            padding: "5px 10px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer",
          }}>
          Run Code
        </button>
        { props.value.metadata.response
         && <button
            onClick={() =>
              props.utils.setMetadata({
                response: undefined,
                error: undefined,
              })
            }
            style={{
              ...commonTextStyle,
              padding: "5px 10px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
            }}>
            Clear Output
          </button>
        }
      </div>
    </div>
  );
};

/* TODO: Define additional tools as React components here. */

/* TODO: Add all tools to be used here. */
export const tools = {
  comment: Comment,
  colorPicker: ColorPicker,
  runCodeSegment: RunCodeSegment,
  imageUpload: ImageUpload,
  displayHTML: DisplayHTML,
};

export const toolNames = {
  comment: "Comment",
  colorPicker: "Color Picker",
  runCodeSegment: "Run Code Segment",
  imageUpload: "Image Upload",
  displayHTML: "HTML Preview",
};