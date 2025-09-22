import { AnnotationEditorProps } from "./App";
import React, { useEffect, useState } from "react";
import { ObjectInspector } from "react-inspector";
import e from "cors";
import './tools.css';
import LMUnitTest from "./LMUnitTest";
import ShowDebuggedExample from "./ShowDebuggedExample";
import { ChatMessage, lmApi } from "./lm-api-client";
import { vscode } from "./utilities/vscode";

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
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginLeft: '40px' }}>
        ⤷
        <div style={{ fontSize: '12px' }}>Reply</div>
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
            `
          }
        ]
        const parsed = await lmApi.chat(prompt, {
          vendor: 'copilot',
          family: 'gpt-4o',
          temperature: 0.3
        })
    
        const newExpression = parsed;
        setExpression(newExpression);
        // Store in metadata for persistence
        props.utils.setMetadata({ expression: newExpression });
        setRetryParse(false);
      }

      parseText(props.utils.getText());
    }
  }, [props.utils, retryParse]);

  // Update metadata when user manually edits the expression
  const handleExpressionChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const newExpression = evt.target.value;
    setExpression(newExpression);
    props.utils.setMetadata({ expression: newExpression });
  };

  const odysseyBase = "https://herbie-fp.github.io/odyssey/?spec="
  const url = odysseyBase + encodeURIComponent(expression);

  return (
    <div className="odyssey">
      <p>Parsed the following expression from highlighted text:</p>
      <input type="text" className="odyssey-text"
        onChange={handleExpressionChange} value={expression}/>
      <button onClick={() => setRetryParse(true)}>Retry</button>
      <p>
        Explore floating-point error in this expression with
        <button className="open-external" onClick={() => vscode.postMessage({command: "open-external", url})}>
          Odyssey 
          <svg className="open-external-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M224,104a8,8,0,0,1-16,0V59.32l-66.33,66.34a8,8,0,0,1-11.32-11.32L196.68,48H152a8,8,0,0,1,0-16h64a8,8,0,0,1,8,8Zm-40,24a8,8,0,0,0-8,8v72H48V80h72a8,8,0,0,0,0-16H48A16,16,0,0,0,32,80V208a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V136A8,8,0,0,0,184,128Z"></path></svg>
        </button>
      </p>
    </div>
  );
};

/* TODO: Define additional tools as React components here. */
const ExplainInEnglish: React.FC<AnnotationEditorProps> = (props) => {
  // State management
  const [englishExplanation, setEnglishExplanation] = useState(
    props.value.metadata.englishExplanation || ''
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<string | null>(
    props.value.metadata.executionResult || null
  );
  const [executionError, setExecutionError] = useState<string | null>(
    props.value.metadata.executionError || null
  );
  const [useMock, setUseMock] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  
  // Track if component is mounted
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Get the highlighted code and document context
  const highlightedCode = props.utils.getText();
  const documentText = props.value.document || '';
  const startPos = props.value.start;
  const endPos = props.value.end;

  // Save state changes to metadata
  useEffect(() => {
    props.utils.setMetadata({ 
      englishExplanation,
      executionResult,
      executionError
    });
  }, [englishExplanation, executionResult, executionError]);

  // Create formatted document with highlighted section
  const createFormattedDocument = () => {
    if (!documentText) {
      return '';
    }
    
    const before = documentText.substring(0, startPos);
    const highlighted = documentText.substring(startPos, endPos);
    const after = documentText.substring(endPos);
    
    return `${before}<<<HIGHLIGHTED>${highlighted}</HIGHLIGHTED>>>${after}`;
  };

  // Generate English explanation
  const generateExplanation = async () => {
    if (!highlightedCode.trim()) {
      setError('No code selected to explain');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formattedDocument = createFormattedDocument();
      
      const prompt: ChatMessage[] = [
        { 
          role: "system", 
          content: `You are a helpful assistant that explains JavaScript code in simple, clear English. 
          
You will be given a document with a highlighted section marked by <<<HIGHLIGHTED>...</HIGHLIGHTED>>> tags.

Your task is to:
1. Explain what the highlighted code does in plain English
2. Break down complex operations into simple steps
3. Explain the purpose and context of the code
4. Use non-technical language that a beginner could understand
5. Include relevant context from the surrounding code if it helps explain the highlighted section

Keep your explanation concise but comprehensive. Focus on WHAT the code does and WHY, not just HOW.`
        },
        { 
          role: "user", 
          content: `Here is the code with the highlighted section:\n\n${formattedDocument || highlightedCode}\n\n` +
                   `Please explain what the highlighted code does in simple English.`
        }
      ];

      let response: string;
      if (useMock) {
        // Mock response for testing
        await new Promise(resolve => setTimeout(resolve, 1000));
        response = `This code performs the following actions:
1. It initializes variables and sets up the necessary data structures
2. It processes the input data through a series of transformations
3. It handles edge cases and error conditions appropriately
4. Finally, it returns the processed result

In simple terms: This code takes some input, transforms it according to specific rules, and produces an output that can be used by other parts of the program.`;
      } else {
        try {
          response = await lmApi.chat(prompt, {
            vendor: 'copilot',
            family: 'gpt-4o',
            temperature: 0.7
          });
        } catch (apiError) {
          console.log('API call failed, falling back to mock:', apiError);
          // Fallback to mock response
          response = `This code performs the following actions:
1. It initializes variables and sets up the necessary data structures
2. It processes the input data through a series of transformations
3. It handles edge cases and error conditions appropriately
4. Finally, it returns the processed result

In simple terms: This code takes some input, transforms it according to specific rules, and produces an output that can be used by other parts of the program.`;
        }
      }

      if (isMounted.current) {
        setEnglishExplanation(response);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred while generating explanation';
      
      if (isMounted.current) {
        setError(errorMsg);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  // Execute the highlighted code
  const executeCode = async () => {
    setIsExecuting(true);
    setExecutionError(null);
    setExecutionResult(null);

    try {
      // Create a more isolated execution environment
      const code = highlightedCode.trim();
      
      // Check if the code is a complete statement or expression
      let result;
      
      // Try to execute as-is first
      try {
        const asyncFunction = new Function(`
          'use strict';
          return (async () => {
            ${code}
          })();
        `);
        result = await asyncFunction();
      } catch (firstError) {
        // If that fails, try wrapping the last line with return
        const lines = code.split('\n');
        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1].trim();
          if (!lastLine.startsWith('return') && !lastLine.startsWith('throw')) {
            lines[lines.length - 1] = `return ${lastLine}`;
            const modifiedCode = lines.join('\n');
            
            try {
              const asyncFunction = new Function(`
                'use strict';
                return (async () => {
                  ${modifiedCode}
                })();
              `);
              result = await asyncFunction();
            } catch (secondError) {
              // If both attempts fail, throw the original error
              throw firstError;
            }
          } else {
            throw firstError;
          }
        } else {
          throw firstError;
        }
      }

      // Format the result for display
      if (result === undefined) {
        setExecutionResult('undefined');
      } else if (result === null) {
        setExecutionResult('null');
      } else if (typeof result === 'object') {
        setExecutionResult(JSON.stringify(result, null, 2));
      } else {
        setExecutionResult(String(result));
      }
    } catch (err) {
      setExecutionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div style={{ 
      padding: "12px", 
      fontFamily: "Poppins, -apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: "14px",
      maxWidth: "100%"
    }}>
      <div style={{ marginBottom: "16px" }}>
        <h3 style={{ 
          margin: "0 0 12px 0", 
          fontSize: "16px", 
          fontWeight: "600",
          color: "#333"
        }}>
          Code Explanation in Plain English
        </h3>
        
        <div style={{ 
          display: "flex", 
          gap: "10px", 
          alignItems: "center",
          marginBottom: "12px"
        }}>
          <button
            onClick={generateExplanation}
            disabled={isLoading}
            style={{
              padding: "8px 16px",
              backgroundColor: isLoading ? "#e0e0e0" : "#0078D4",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "500",
              transition: "background-color 0.2s"
            }}
          >
            {isLoading ? "Generating..." : "Generate Explanation"}
          </button>
          
          <label style={{ 
            display: "flex", 
            alignItems: "center", 
            fontSize: "13px",
            cursor: "pointer",
            color: "#666"
          }}>
            <input 
              type="checkbox"
              checked={useMock}
              onChange={() => setUseMock(!useMock)}
              style={{ marginRight: "6px" }}
            />
            Use mock API
          </label>
        </div>

        {error && (
          <div style={{ 
            color: "#D83B01", 
            backgroundColor: "#FFF4F2", 
            padding: "10px", 
            borderRadius: "4px",
            marginBottom: "12px",
            fontSize: "13px",
            border: "1px solid #FDBCB4"
          }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ marginBottom: "16px" }}>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontWeight: "600",
            fontSize: "14px",
            color: "#444"
          }}>
            English Explanation:
          </label>
          <textarea
            value={englishExplanation}
            onChange={(e) => setEnglishExplanation(e.target.value)}
            placeholder="Click 'Generate Explanation' to get an English explanation of the code, or write your own..."
            style={{
              width: "100%",
              minHeight: "120px",
              padding: "10px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "14px",
              lineHeight: "1.5",
              resize: "vertical",
              fontFamily: "inherit",
              backgroundColor: "#FAFAFA"
            }}
          />
        </div>

        <div style={{ 
          borderTop: "1px solid #E1E1E1",
          paddingTop: "16px",
          marginTop: "16px"
        }}>
          <h4 style={{ 
            margin: "0 0 12px 0", 
            fontSize: "15px", 
            fontWeight: "600",
            color: "#333"
          }}>
            Code Execution
          </h4>
          
          <button
            onClick={executeCode}
            disabled={isExecuting || !highlightedCode.trim()}
            style={{
              padding: "8px 16px",
              backgroundColor: isExecuting ? "#e0e0e0" : "#107C10",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: (isExecuting || !highlightedCode.trim()) ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "500",
              marginBottom: "12px",
              transition: "background-color 0.2s"
            }}
          >
            {isExecuting ? "Executing..." : "▶ Execute Code"}
          </button>

          {executionResult !== null && (
            <div style={{ 
              backgroundColor: "#F0FFF4",
              border: "1px solid #B7EB8F",
              borderRadius: "4px",
              padding: "12px",
              marginTop: "12px"
            }}>
              <div style={{ 
                fontWeight: "600", 
                marginBottom: "8px",
                color: "#52C41A",
                fontSize: "13px"
              }}>
                ✓ Execution Result:
              </div>
              <pre style={{ 
                margin: 0,
                fontFamily: "Consolas, Monaco, 'Courier New', monospace",
                fontSize: "13px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "#333",
                backgroundColor: "white",
                padding: "8px",
                borderRadius: "3px"
              }}>
                {executionResult}
              </pre>
            </div>
          )}

          {executionError && (
            <div style={{ 
              backgroundColor: "#FFF2F0",
              border: "1px solid #FFCCC7",
              borderRadius: "4px",
              padding: "12px",
              marginTop: "12px"
            }}>
              <div style={{ 
                fontWeight: "600", 
                marginBottom: "8px",
                color: "#FF4D4F",
                fontSize: "13px"
              }}>
                ✗ Execution Error:
              </div>
              <pre style={{ 
                margin: 0,
                fontFamily: "Consolas, Monaco, 'Courier New', monospace",
                fontSize: "13px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "#8B0000",
                backgroundColor: "white",
                padding: "8px",
                borderRadius: "3px"
              }}>
                {executionError}
              </pre>
            </div>
          )}
        </div>

        <div style={{
          marginTop: "16px",
          padding: "10px",
          backgroundColor: "#F5F5F5",
          borderRadius: "4px",
          fontSize: "12px",
          color: "#666"
        }}>
          <strong>Highlighted Code:</strong>
          <pre style={{
            margin: "8px 0 0 0",
            padding: "8px",
            backgroundColor: "white",
            borderRadius: "3px",
            fontSize: "12px",
            overflow: "auto",
            border: "1px solid #E0E0E0"
          }}>
            {highlightedCode || "(No code selected)"}
          </pre>
        </div>
      </div>
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
  yesNoQuestion: LMUnitTest, // Add the new component
  debugExample: ShowDebuggedExample, // Add the debugging example component
  // lmApiTest: LMAPITest, // Add the debugging component
};

export const toolNames = {
  comment: "Comment",
  colorPicker: "Color Picker",
  // runCodeSegment: "Run Code Segment",
  imageUpload: "Image Upload",
  displayHTML: "HTML Preview",
  odyssey: "Analyze Floating-point Expression",
  yesNoQuestion: "LM Unit Test", // Add the new component name
  debugExample: "Show Debugged Example", // Add the debugging example component name
  // lmApiTest: "LM API Test", // Add the debugging component name
};
