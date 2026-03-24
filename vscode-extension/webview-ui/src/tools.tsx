import { AnnotationEditorProps } from "./App";
import React, { useEffect, useState, useRef } from "react";
import e from "cors";
import "./tools.css";
import LMUnitTest from "./LMUnitTest";
import ShowDebuggedExample from "./ShowDebuggedExample";
import { ChatMessage, lmApi, mockLmApi } from "./lm-api-client";
import { vscode } from "./utilities/vscode";

import {
  Generator,
  FormalSpecification,
  ExplainInEnglish,
  OutputVisualizer,
} from "./additionalTools";

type AnnotationType = React.FC<AnnotationEditorProps>;
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

  // useEffect(() => {
  //   const handler = setTimeout(() => {
  //     props.utils.setMetadata({ comment, replies });
  //   }, 300);

  //   return () => {
  //     clearTimeout(handler);
  //   };
  // }, [comment, replies]);

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
  // setComment(e.target.value)}
  return (
    <div style={{ marginBottom: "10px" }}>
      <div
        style={{
          fontFamily: "Poppins, sans-serif",
          display: "flex",
          gap: "10px",
          alignItems: "center",
        }}>
        <div style={{ fontWeight: "bold", fontSize: "12px" }}>Alex Smith</div>
        <div
          style={{
            fontSize: "10px",
            // align bottom of line
          }}>
          Today at 12:00 PM
        </div>
      </div>
      <div style={{ display: "flex" }}>
        {/* user icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="30"
          height="30"
          fill="currentColor"
          viewBox="0 0 64 64"
          style={{ margin: "10px", marginLeft: "5px" }}>
          <circle cx="32" cy="32" r="30" fill="none" stroke="#999" stroke-width="2" />
          <circle cx="32" cy="20" r="12" fill="#ccc" stroke="#999" stroke-width="2" />
          <path
            d="M16 52c0-8.8 7.2-16 16-16s16 7.2 16 16v4H16v-4z"
            fill="#ccc"
            stroke="#999"
            stroke-width="2"
          />
        </svg>

        <textarea
          value={props.value.metadata.comment}
          onChange={(e) => props.utils.setMetadata({ comment: e.target.value })}
          placeholder="Enter your comment here..."
          className="textarea"
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
      <div style={{ display: "flex", gap: "5px", alignItems: "center", marginLeft: "40px" }}>
        ⤷<div style={{ fontSize: "12px" }}>Reply</div>
      </div>
      {/* <div style={{ marginTop: "10px" }}>
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
          </div> */}
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
      {props.value.metadata.image && (
        <div
          style={{
            width: "320px",
            height: "220px",
            resize: "both",
            overflow: "auto",
            border: "1px solid #ccc",
            marginTop: "8px",
          }}>
          <img
            src={props.value.metadata.image}
            alt="Uploaded"
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />
        </div>
      )}
    </div>
  );
};

const DisplayHTML: React.FC<AnnotationEditorProps> = (props) => {
  return (
    <div>
      <div
        dangerouslySetInnerHTML={{ __html: props.utils.getText() }}
        style={{ height: "50px", resize: "both", overflow: "auto", border: "1px solid #ccc" }}
      />
    </div>
  );
};

const Odyssey: React.FC<AnnotationEditorProps> = (props) => {
  const [expression, setExpression] = useState(props.value.metadata.expression || "loading...");
  const [retryParse, setRetryParse] = useState(false);

  useEffect(() => {
    // Only make API call if expression is "loading..." or retry was clicked
    if (expression === "loading..." || retryParse) {
      const parseText = async (text: string) => {
        const prompt: ChatMessage[] = [
          {
            role: "system",
            content: `Can you parse this piece of text or code to find an expression 
                  and convert it to mathjs parsable syntax? All math.h operators are allowed. 
                  If a term of the expression can be written with simple mathematical operators,
                  use those instead of 'function' like operators, for example, use 'x^y' instead of
                  pow(x,y).

                  Do not output any other text besides the mathjs parasable string, 
                  with no quotation marks.
                  
                  The text to parse is as follows:
                  ${text}
                `,
          },
        ];
        const parsed = await lmApi.chat(prompt, {
          vendor: "copilot",
          family: "gpt-4o",
          temperature: 0.3,
        });

        const newExpression = parsed;
        setExpression(newExpression);
        // Store in metadata for persistence
        props.utils.setMetadata({ expression: newExpression });
        setRetryParse(false);
      };

      parseText(props.utils.getText());
    }
  }, [props.utils, retryParse]);

  // Update metadata when user manually edits the expression
  const handleExpressionChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const newExpression = evt.target.value;
    setExpression(newExpression);
    props.utils.setMetadata({ expression: newExpression });
  };

  const odysseyBase = "https://herbie-fp.github.io/odyssey/?spec=";
  const url = odysseyBase + encodeURIComponent(expression);

  return (
    <div className="odyssey">
      <p>Parsed the following original expression from highlighted text:</p>
      <input
        type="text"
        className="odyssey-text"
        onChange={handleExpressionChange}
        value={expression}
      />
      <button onClick={() => setRetryParse(true)}>Retry</button>
      <p>
        Explore floating-point error in this expression with
        <button
          className="open-external"
          onClick={() => vscode.postMessage({ command: "open-external", url })}>
          Odyssey
          <svg
            className="open-external-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256">
            <path d="M224,104a8,8,0,0,1-16,0V59.32l-66.33,66.34a8,8,0,0,1-11.32-11.32L196.68,48H152a8,8,0,0,1,0-16h64a8,8,0,0,1,8,8Zm-40,24a8,8,0,0,0-8,8v72H48V80h72a8,8,0,0,0,0-16H48A16,16,0,0,0,32,80V208a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V136A8,8,0,0,0,184,128Z"></path>
          </svg>
        </button>
      </p>
    </div>
  );
};

/* TODO: Add all tools to be used here. */
export const tools = {
  comment: Comment,
  colorPicker: ColorPicker,
  // runCodeSegment: RunCodeSegment,
  imageUpload: ImageUpload,
  displayHTML: DisplayHTML,
  odyssey: Odyssey,
  yesNoQuestion: LMUnitTest,
  debugExample: ShowDebuggedExample,
  explainInEnglish: ExplainInEnglish,
  outputVisualizer: OutputVisualizer,
  formalSpecification: FormalSpecification,
  Generator: Generator,
  // lmApiTest: LMAPITest,
};

export const toolNames = {
  comment: "Comment",
  colorPicker: "Color Picker",
  // runCodeSegment: "Run Code Segment",
  imageUpload: "Image Upload",
  displayHTML: "HTML Preview",
  odyssey: "Analyze Floating-point Expression",
  yesNoQuestion: "LM Unit Test",
  debugExample: "Show Debugged Example",
  explainInEnglish: "Explain in English",
  outputVisualizer: "Output Visualizer",
  formalSpecification: "Formal Specification",
  Generator: "Annotation Generator",
  // lmApiTest: "LM API Test",
};
