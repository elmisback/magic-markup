    import { AnnotationEditorProps } from "./App";
    import React, { useEffect, useState, useRef  } from "react";
    import { ObjectInspector } from "react-inspector";
    import e from "cors";
    import './tools.css';
    import LMUnitTest from "./LMUnitTest";
    import ShowDebuggedExample from "./ShowDebuggedExample";
    import { ChatMessage, lmApi, mockLmApi } from "./lm-api-client";
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
              vendor: 'copilot-chat',
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
      // State management for explanations
      const [explanations, setExplanations] = useState({
        what: props.value.metadata.whatExplanation || '',
        how: props.value.metadata.howExplanation || '',
        context: props.value.metadata.contextExplanation || '',
        why: props.value.metadata.whyExplanation || ''
      });
      
      const [presentationSummary, setPresentationSummary] = useState(
        props.value.metadata.presentationSummary || ''
      );
      
      const [explanationMode, setExplanationMode] = useState<'presentation' | 'in-depth'>(
        props.value.metadata.explanationMode || 'presentation'
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
          whatExplanation: explanations.what,
          howExplanation: explanations.how,
          contextExplanation: explanations.context,
          whyExplanation: explanations.why,
          presentationSummary,
          explanationMode,
          executionResult,
          executionError
        });
      }, [explanations, presentationSummary, explanationMode, executionResult, executionError]);

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
          
          const basePrompt = `You are a helpful assistant that explains JavaScript code in simple, clear English. 

    You will be given a document with a highlighted section marked by <<<HIGHLIGHTED>...</HIGHLIGHTED>>> tags.

    Please provide explanations for the highlighted code in four specific categories:

    1. WHAT: What does this code do? (describe the main functionality and purpose)
    2. HOW: How does this code work? (explain the technical implementation and logic flow)
    3. CONTEXT: What is this code's function in the context of the entire class/component it belongs to? (explain its role in the larger system)
    4. WHY: Why is this code needed? (explain the problem it solves and its importance)

    Use clear, non-technical language that a beginner could understand. Focus on being concise but comprehensive.`;

          if (explanationMode === 'presentation') {
            const presentationPrompt: ChatMessage[] = [
              { 
                role: "system", 
                content: `${basePrompt}

    Format your response as a single cohesive explanation with bullet points for each category:

    **What the code does:**
    • [2-3 concise bullet points]

    **How the code works:**
    • [2-3 concise bullet points]

    **Context within the class/component:**
    • [2-3 concise bullet points]

    **Why it's needed:**
    • [2-3 concise bullet points]

    Keep each bullet point to 1-2 sentences maximum. This should be easy to read without scrolling.`
              },
              { 
                role: "user", 
                content: `Here is the code with the highlighted section:\n\n${formattedDocument || highlightedCode}\n\n` +
                        `Please explain the highlighted code in presentation format.`
              }
            ];

            let response: string;
            if (useMock) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              response = `**What the code does:**
    • Sets up state variables for managing user interface interactions
    • Handles data processing and validation logic
    • Manages component lifecycle and cleanup operations

    **How the code works:**
    • Uses React hooks to track component state changes
    • Implements async functions for API communication
    • Applies error handling with try-catch blocks

    **Context within the class/component:**
    • Serves as the core data processing logic for the component
    • Integrates with other component methods for state management
    • Provides essential functionality for user interactions

    **Why it's needed:**
    • Ensures proper data flow and state consistency
    • Prevents memory leaks and handles edge cases
    • Enables responsive user experience and error recovery`;
            } else {
              try {
                response = await lmApi.chat(presentationPrompt, {
                  vendor: 'copilot-chat',
                  family: 'gpt-4o',
                  temperature: 0.7
                });
              } catch (apiError) {
                console.log('API call failed, falling back to mock:', apiError);
                response = `**What the code does:**
    • Sets up state variables for managing user interface interactions
    • Handles data processing and validation logic
    • Manages component lifecycle and cleanup operations

    **How the code works:**
    • Uses React hooks to track component state changes
    • Implements async functions for API communication
    • Applies error handling with try-catch blocks

    **Context within the class/component:**
    • Serves as the core data processing logic for the component
    • Integrates with other component methods for state management
    • Provides essential functionality for user interactions

    **Why it's needed:**
    • Ensures proper data flow and state consistency
    • Prevents memory leaks and handles edge cases
    • Enables responsive user experience and error recovery`;
              }
            }

            if (isMounted.current) {
              setPresentationSummary(response);
            }
          } else {
            // In-depth mode - get detailed explanations for each category
            const inDepthPrompt: ChatMessage[] = [
              { 
                role: "system", 
                content: `${basePrompt}

    You MUST respond with ONLY a valid JSON object. No additional text, explanations, or formatting outside the JSON.

    The JSON should have exactly this structure:
    {
      "what": "Detailed explanation of what the code does (3-5 sentences)...",
      "how": "Detailed explanation of how it works technically (3-5 sentences)...",
      "context": "Detailed explanation of its role in the larger system (3-5 sentences)...",
      "why": "Detailed explanation of why it's necessary (3-5 sentences)..."
    }

    Each value should be a single string with 3-5 sentences. Do not include any markdown, formatting, or line breaks within the strings.`
              },
              { 
                role: "user", 
                content: `Here is the code with the highlighted section:\n\n${formattedDocument || highlightedCode}\n\n` +
                        `Please provide detailed explanations for each category in JSON format.`
              }
            ];

            let response: string;
            if (useMock) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              response = JSON.stringify({
                what: "This code defines state management and UI interaction logic for a React component. It establishes multiple state variables using the useState hook to track different aspects of the component's behavior, including user inputs, loading states, error conditions, and execution results. The code also sets up effect hooks to handle component lifecycle events and data persistence.\n\nThe primary function is to create a controlled interface that responds to user actions while maintaining data integrity. It manages both the visual presentation of information and the underlying data processing that supports the component's functionality.\n\nAdditionally, this code implements proper cleanup mechanisms to prevent memory leaks and ensures that asynchronous operations are handled correctly even when the component unmounts during execution.",
                how: "The implementation uses React's built-in hooks pattern to manage state and side effects. The useState hooks create reactive state variables that automatically trigger re-renders when their values change. Each state variable serves a specific purpose and is updated through setter functions that maintain immutability principles.\n\nThe useEffect hooks create a dependency tracking system that automatically runs cleanup or update logic when specific values change. This creates a reactive programming model where changes in one part of the system automatically propagate to other dependent parts.\n\nThe code also implements proper error boundary patterns using try-catch blocks and loading states, ensuring that the user interface remains responsive and informative even when operations fail or take time to complete.",
                context: "Within the larger component architecture, this code serves as the foundational state management layer that all other component methods depend on. It acts as the single source of truth for the component's current status and provides the reactive infrastructure that other functions can interact with.\n\nThis state management setup enables other parts of the component to perform operations like API calls, user input handling, and data validation while maintaining consistent state across the entire component lifecycle. It integrates with the component's rendering logic to ensure that UI changes reflect the current application state.\n\nThe code also establishes the communication patterns between this component and its parent components or global state management systems, ensuring that data flows correctly throughout the application hierarchy.",
                why: "This state management structure is essential for creating a reliable and user-friendly interface. Without proper state tracking, the component would not be able to provide visual feedback to users about loading states, errors, or successful operations, leading to a poor user experience.\n\nThe structured approach to state management prevents common React pitfalls like state inconsistencies, memory leaks from unmounted components, and race conditions from asynchronous operations. This defensive programming approach ensures the component remains stable even under adverse conditions.\n\nFurthermore, this pattern establishes a maintainable codebase where future developers can easily understand and modify the component's behavior. The clear separation of concerns and consistent naming conventions make the code self-documenting and reduce the likelihood of bugs during maintenance or feature additions."
              });
            } else {
              try {
                response = await lmApi.chat(inDepthPrompt, {
                  vendor: 'copilot-chat',
                  family: 'gpt-4o',
                  temperature: 0.7
                });
              } catch (apiError) {
                console.log('API call failed, falling back to mock:', apiError);
                response = JSON.stringify({
                  what: "This code defines state management and UI interaction logic for a React component. It establishes multiple state variables using the useState hook to track different aspects of the component's behavior, including user inputs, loading states, error conditions, and execution results. The code also sets up effect hooks to handle component lifecycle events and data persistence.",
                  how: "The implementation uses React's built-in hooks pattern to manage state and side effects. The useState hooks create reactive state variables that automatically trigger re-renders when their values change. Each state variable serves a specific purpose and is updated through setter functions that maintain immutability principles.",
                  context: "Within the larger component architecture, this code serves as the foundational state management layer that all other component methods depend on. It acts as the single source of truth for the component's current status and provides the reactive infrastructure that other functions can interact with.",
                  why: "This state management structure is essential for creating a reliable and user-friendly interface. Without proper state tracking, the component would not be able to provide visual feedback to users about loading states, errors, or successful operations, leading to a poor user experience."
                });
              }
            }

            try {
              // Try to parse as JSON first
              const parsedResponse = JSON.parse(response);
              if (isMounted.current) {
                setExplanations({
                  what: parsedResponse.what || '',
                  how: parsedResponse.how || '',
                  context: parsedResponse.context || '',
                  why: parsedResponse.why || ''
                });
              }
            } catch (parseError) {
              // If JSON parsing fails, try to extract content between JSON markers or use fallback
              console.log('JSON parsing failed, attempting to extract or use fallback:', parseError);
              
              try {
                // Try to find JSON content within the response
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const parsedResponse = JSON.parse(jsonMatch[0]);
                  if (isMounted.current) {
                    setExplanations({
                      what: parsedResponse.what || '',
                      how: parsedResponse.how || '',
                      context: parsedResponse.context || '',
                      why: parsedResponse.why || ''
                    });
                  }
                } else {
                  // Fallback: treat the response as a single explanation and distribute it
                  const fallbackText = response.trim();
                  const sections = fallbackText.split(/(?:\n\s*){2,}/); // Split on double line breaks
                  
                  if (isMounted.current) {
                    setExplanations({
                      what: sections[0] || fallbackText,
                      how: sections[1] || 'Technical implementation details for the highlighted code.',
                      context: sections[2] || 'This code functions as part of the larger component/class structure.',
                      why: sections[3] || 'This code is necessary to ensure proper functionality and user experience.'
                    });
                  }
                }
              } catch (secondParseError) {
                console.log('All parsing attempts failed, using basic fallback');
                if (isMounted.current) {
                  setExplanations({
                    what: response || 'Unable to generate explanation',
                    how: 'Technical implementation could not be parsed from the response.',
                    context: 'Context information could not be extracted.',
                    why: 'Reasoning could not be determined from the response.'
                  });
                }
              }
            }
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

      // Execute the highlighted code (keeping original logic)
      const executeCode = async () => {
        setIsExecuting(true);
        setExecutionError(null);
        setExecutionResult(null);

        try {
          const code = highlightedCode.trim();
          let result;
          
          try {
            const asyncFunction = new Function(`
              'use strict';
              return (async () => {
                ${code}
              })();
            `);
            result = await asyncFunction();
          } catch (firstError) {
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
                  throw firstError;
                }
              } else {
                throw firstError;
              }
            } else {
              throw firstError;
            }
          }

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
              marginBottom: "12px",
              flexWrap: "wrap"
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
              
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ fontSize: "13px", color: "#666", fontWeight: "500" }}>
                  Mode:
                </label>
                <select
                  value={explanationMode}
                  onChange={(e) => setExplanationMode(e.target.value as 'presentation' | 'in-depth')}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    fontSize: "13px",
                    backgroundColor: "white"
                  }}
                >
                  <option value="presentation">Presentation (Summary)</option>
                  <option value="in-depth">In-Depth (Detailed)</option>
                </select>
              </div>
              
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

            {explanationMode === 'presentation' ? (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "8px", 
                  fontWeight: "600",
                  fontSize: "14px",
                  color: "#444"
                }}>
                  Code Explanation Summary:
                </label>
                <textarea
                  value={presentationSummary}
                  onChange={(e) => setPresentationSummary(e.target.value)}
                  placeholder="Click 'Generate Explanation' to get a concise summary with bullet points for What, How, Context, and Why..."
                  style={{
                    width: "100%",
                    minHeight: "200px",
                    padding: "12px",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    fontSize: "14px",
                    lineHeight: "1.6",
                    resize: "vertical",
                    fontFamily: "inherit",
                    backgroundColor: "#FAFAFA"
                  }}
                />
              </div>
            ) : (
              <div style={{ marginBottom: "16px" }}>
                {[
                  { key: 'what', title: 'What does this code do?', color: '#E3F2FD' },
                  { key: 'how', title: 'How does this code work?', color: '#F3E5F5' },
                  { key: 'context', title: 'Context within the class/component', color: '#E8F5E8' },
                  { key: 'why', title: 'Why is this code needed?', color: '#FFF3E0' }
                ].map(({ key, title, color }) => (
                  <div key={key} style={{ marginBottom: "16px" }}>
                    <label style={{ 
                      display: "block", 
                      marginBottom: "8px", 
                      fontWeight: "600",
                      fontSize: "14px",
                      color: "#444"
                    }}>
                      {title}
                    </label>
                    <textarea
                      value={explanations[key as keyof typeof explanations]}
                      onChange={(e) => setExplanations(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={`Detailed explanation of ${key}...`}
                      style={{
                        width: "100%",
                        minHeight: "120px",
                        padding: "12px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                        fontSize: "14px",
                        lineHeight: "1.6",
                        resize: "vertical",
                        fontFamily: "inherit",
                        backgroundColor: color
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

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

    const OutputVisualizer: React.FC<AnnotationEditorProps> = (props) => {
      const [predictedOutput, setPredictedOutput] = useState(
        props.value.metadata.predictedOutput || ''
      );
      const [variableChanges, setVariableChanges] = useState(
        props.value.metadata.variableChanges || []
      );
      const [llmExplanation, setLlmExplanation] = useState(
        props.value.metadata.llmExplanation || ''
      );
      const [confidence, setConfidence] = useState(
        props.value.metadata.confidence || 'medium'
      );
      const [isAnalyzing, setIsAnalyzing] = useState(false);
      const [testInputs, setTestInputs] = useState(
        props.value.metadata.testInputs || ''
      );
      const [actualOutput, setActualOutput] = useState(
        props.value.metadata.actualOutput || null
      );
      const [executionError, setExecutionError] = useState(
        props.value.metadata.executionError || null
      );

      // Get the highlighted code and document context
      const highlightedCode = props.utils.getText();
      const documentText = props.value.document || '';

      // Save state to metadata
      useEffect(() => {
        props.utils.setMetadata({
          predictedOutput,
          variableChanges,
          llmExplanation,
          confidence,
          testInputs,
          actualOutput,
          executionError
        });
      }, [predictedOutput, variableChanges, llmExplanation, confidence, testInputs, actualOutput, executionError]);

      // Analyze code and predict output
      const analyzeCode = async () => {
        setIsAnalyzing(true);
        
        // Simulate analysis (in real implementation, this would call an LLM API)
        setTimeout(() => {
          const code = highlightedCode.trim();
          
          // Check if it's the quickSort function
          if (code.includes('quickSort') && code.includes('partition')) {
            setPredictedOutput('A sorted version of the input array \'arr\'');
            setVariableChanges([
              {
                variable: 'arr',
                before: 'The input array passed to quickSort',
                after: 'The sorted version of the input array'
              }
            ]);
            setLlmExplanation('The highlighted \'quickSort\' function sorts the input array \'arr\' in-place using the partitioning logic defined in the \'partition\' function. The \'arr\' variable is modified directly during the sorting process.');
            setConfidence('high');
          }
          // Check if it's the partition function
          else if (code.includes('partition') && code.includes('pivot')) {
            setPredictedOutput('The index position where the pivot element is placed after partitioning');
            setVariableChanges([
              {
                variable: 'arr',
                before: 'The array segment between low and high indices',
                after: 'Rearranged with elements less than pivot on left, greater on right'
              },
              {
                variable: 'i',
                before: 'Initialized to low - 1',
                after: 'Final position before the pivot'
              }
            ]);
            setLlmExplanation('The \'partition\' function rearranges the array segment between \'low\' and \'high\' indices, using the last element as a pivot. It returns the final position of the pivot after partitioning.');
            setConfidence('high');
          }
          // Generic function detection
          else if (code.includes('function') || code.includes('=>')) {
            setPredictedOutput('Function output depends on input parameters');
            setVariableChanges([]);
            setLlmExplanation('This appears to be a function definition. The actual output will depend on the input parameters provided when the function is called.');
            setConfidence('low');
          }
          // Default case
          else {
            setPredictedOutput('Code execution result');
            setVariableChanges([]);
            setLlmExplanation('The highlighted code performs operations. Specific output depends on the context and any variables it uses.');
            setConfidence('low');
          }
          
          setIsAnalyzing(false);
        }, 1000);
      };

      // Execute code with test inputs
      const executeCode = async () => {
        if (!testInputs.trim()) {
          setExecutionError('Please provide test inputs to execute the function');
          return;
        }

        try {
          const code = highlightedCode.trim();
          let executionCode = code;
          
          // Detect if it's a function and create test call
          const functionMatch = code.match(/function\s+(\w+)/);
          if (functionMatch) {
            executionCode = `${code}\n\n${functionMatch[1]}(${testInputs})`;
          }

          const asyncFunction = new Function(`
            'use strict';
            return (async () => {
              ${executionCode}
            })();
          `);
          
          const result = await asyncFunction();
          
          if (result === undefined) {
            setActualOutput('undefined (no return value)');
          } else if (result === null) {
            setActualOutput('null');
          } else if (typeof result === 'object') {
            setActualOutput(JSON.stringify(result, null, 2));
          } else {
            setActualOutput(String(result));
          }
          setExecutionError(null);
        } catch (err) {
          setExecutionError(err instanceof Error ? err.message : String(err));
          setActualOutput(null);
        }
      };

      const getConfidenceColor = () => {
        switch(confidence) {
          case 'high': return '#22c55e';
          case 'medium': return '#f59e0b';
          case 'low': return '#ef4444';
          default: return '#6b7280';
        }
      };

      return (
        <div style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: "14px",
          lineHeight: "1.6",
          color: "#1f2937"
        }}>
          {/* Predicted Output Section */}
          <div style={{
            backgroundColor: "#f9fafb",
            padding: "16px",
            borderRadius: "8px",
            marginBottom: "16px"
          }}>
            <div style={{
              fontWeight: "600",
              marginBottom: "8px",
              fontSize: "15px"
            }}>
              Predicted return / output:
            </div>
            <div style={{
              backgroundColor: "white",
              padding: "12px",
              borderRadius: "6px",
              border: "1px solid #e5e7eb"
            }}>
              {predictedOutput || 
                <span style={{ color: "#9ca3af", fontStyle: "italic" }}>
                  Click "Analyze Code" to predict output
                </span>
              }
            </div>
          </div>

          {/* Variable Changes Section */}
          <div style={{
            backgroundColor: "#f9fafb",
            padding: "16px",
            borderRadius: "8px",
            marginBottom: "16px"
          }}>
            <div style={{
              fontWeight: "600",
              marginBottom: "12px",
              fontSize: "15px"
            }}>
              Predicted variable changes:
            </div>
            {variableChanges.length > 0 ? (
              <table style={{
                width: "100%",
                backgroundColor: "white",
                borderRadius: "6px",
                overflow: "hidden",
                border: "1px solid #e5e7eb"
              }}>
                <thead>
                  <tr style={{ backgroundColor: "#f3f4f6" }}>
                    <th style={{
                      padding: "10px",
                      textAlign: "left",
                      fontWeight: "600",
                      borderBottom: "1px solid #e5e7eb",
                      width: "20%"
                    }}>
                      Variable
                    </th>
                    <th style={{
                      padding: "10px",
                      textAlign: "left",
                      fontWeight: "600",
                      borderBottom: "1px solid #e5e7eb",
                      width: "40%"
                    }}>
                      Before
                    </th>
                    <th style={{
                      padding: "10px",
                      textAlign: "left",
                      fontWeight: "600",
                      borderBottom: "1px solid #e5e7eb",
                      width: "40%"
                    }}>
                      After
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {variableChanges.map((change: any, index: number) => (
                    <tr key={index}>
                      <td style={{
                        padding: "10px",
                        fontFamily: "monospace",
                        fontSize: "13px",
                        fontWeight: "500"
                      }}>
                        {change.variable}
                      </td>
                      <td style={{
                        padding: "10px",
                        fontSize: "13px",
                        color: "#4b5563"
                      }}>
                        {change.before}
                      </td>
                      <td style={{
                        padding: "10px",
                        fontSize: "13px",
                        color: "#4b5563"
                      }}>
                        {change.after}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{
                backgroundColor: "white",
                padding: "12px",
                borderRadius: "6px",
                border: "1px solid #e5e7eb",
                color: "#9ca3af",
                fontStyle: "italic"
              }}>
                No variable changes predicted
              </div>
            )}
          </div>

          {/* LLM Explanation Section */}
          <div style={{
            backgroundColor: "#f9fafb",
            padding: "16px",
            borderRadius: "8px",
            marginBottom: "16px"
          }}>
            <div style={{
              fontWeight: "600",
              marginBottom: "8px",
              fontSize: "15px"
            }}>
              LLM explanation:
            </div>
            <div style={{
              backgroundColor: "white",
              padding: "12px",
              borderRadius: "6px",
              border: "1px solid #e5e7eb",
              color: "#374151"
            }}>
              {llmExplanation || 
                <span style={{ color: "#9ca3af", fontStyle: "italic" }}>
                  Click "Analyze Code" to get explanation
                </span>
              }
            </div>
            {llmExplanation && (
              <div style={{
                marginTop: "8px",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}>
                <span style={{ color: "#6b7280" }}>Confidence:</span>
                <span style={{
                  color: getConfidenceColor(),
                  fontWeight: "600"
                }}>
                  {confidence}
                </span>
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div style={{
            display: "flex",
            gap: "12px",
            marginBottom: "16px"
          }}>
            <button
              onClick={analyzeCode}
              disabled={isAnalyzing || !highlightedCode.trim()}
              style={{
                padding: "8px 20px",
                backgroundColor: isAnalyzing ? "#e5e7eb" : "#3b82f6",
                color: isAnalyzing ? "#9ca3af" : "white",
                border: "none",
                borderRadius: "6px",
                cursor: (isAnalyzing || !highlightedCode.trim()) ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "500",
                transition: "background-color 0.2s"
              }}
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Code"}
            </button>
          </div>

          {/* Test Execution Section (Optional) */}
          <details style={{ marginTop: "20px" }}>
            <summary style={{
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              color: "#4b5563",
              marginBottom: "12px",
              userSelect: "none"
            }}>
              Test Execution (Optional)
            </summary>
            
            <div style={{
              backgroundColor: "#f9fafb",
              padding: "16px",
              borderRadius: "8px",
              marginTop: "8px"
            }}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{
                  display: "block",
                  marginBottom: "6px",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#374151"
                }}>
                  Test Inputs:
                </label>
                <input
                  value={testInputs}
                  onChange={(e) => setTestInputs(e.target.value)}
                  placeholder="e.g., [3, 5, 2, 8, 1], 0, 4"
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid #d1d5db",
                    fontSize: "13px",
                    fontFamily: "monospace"
                  }}
                />
              </div>

              <button
                onClick={executeCode}
                style={{
                  padding: "6px 16px",
                  backgroundColor: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "500",
                  marginBottom: "12px"
                }}
              >
                Execute with Test Inputs
              </button>

              {actualOutput !== null && (
                <div style={{
                  backgroundColor: "white",
                  padding: "10px",
                  borderRadius: "4px",
                  border: "1px solid #d1d5db",
                  marginTop: "8px"
                }}>
                  <div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "4px", color: "#059669" }}>
                    Actual Output:
                  </div>
                  <pre style={{
                    margin: 0,
                    fontFamily: "monospace",
                    fontSize: "12px",
                    whiteSpace: "pre-wrap",
                    color: "#1f2937"
                  }}>
                    {actualOutput}
                  </pre>
                </div>
              )}

              {executionError && (
                <div style={{
                  backgroundColor: "#fef2f2",
                  padding: "10px",
                  borderRadius: "4px",
                  border: "1px solid #fecaca",
                  marginTop: "8px"
                }}>
                  <div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "4px", color: "#dc2626" }}>
                    Execution Error:
                  </div>
                  <pre style={{
                    margin: 0,
                    fontFamily: "monospace",
                    fontSize: "11px",
                    whiteSpace: "pre-wrap",
                    color: "#991b1b"
                  }}>
                    {executionError}
                  </pre>
                </div>
              )}
            </div>
          </details>

          {/* Code Reference */}
          <details style={{ marginTop: "16px" }}>
            <summary style={{
              cursor: "pointer",
              fontSize: "13px",
              color: "#6b7280",
              userSelect: "none"
            }}>
              View highlighted code
            </summary>
            <pre style={{
              marginTop: "8px",
              padding: "10px",
              backgroundColor: "#f3f4f6",
              borderRadius: "4px",
              fontSize: "11px",
              overflow: "auto",
              fontFamily: "monospace",
              color: "#374151"
            }}>
              {highlightedCode || "(No code selected)"}
            </pre>
          </details>
        </div>
      );
    };
    const FormalSpecification: React.FC<AnnotationEditorProps> = (props) => {
    const [highlightedSpec, setHighlightedSpec] = useState({ formal: "", simple: "" });
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState({ highlighted: true });

    const highlightedCode = props.utils.getText() || "";

    // persist specs to metadata
    useEffect(() => {
      props.utils.setMetadata({ highlightedSpec });
    }, [highlightedSpec]);

    const basePrompt = `
  You are a formal methods assistant that writes CORRECT formal program specifications
  for JavaScript code using clear mathematical notation.

  Given the input code, produce two synchronized outputs:

  1. "formal" — a formal specification suitable for program verification,
    including preconditions, postconditions, invariants, and input-output relations,
    using symbols like ∀, ∃, ⇒, ∧, ∨, =, and set-builder notation when needed.

  2. "simple" — a plain-English presentation of the same specification (non-mathematical).

  Respond with ONLY valid JSON of this form:
  {
    "formal": "...",
    "simple": "..."
  }
  `;

    // normalize LLM output
    const extractTextFromResponse = (resp: any): string => {
      if (typeof resp === "string") return resp;
      if (resp && typeof resp === "object") {
        if (resp.content) return resp.content;
        if (resp.text) return resp.text;
        if (Array.isArray(resp.choices) && resp.choices[0]?.message?.content)
          return resp.choices[0].message.content;
        if (Array.isArray(resp)) return resp.map((r) => r.content || r.text || "").join("\n");
        try {
          return JSON.stringify(resp);
        } catch {
          return String(resp);
        }
      }
      return String(resp);
    };

    // parse JSON safely
    const tryParseSpecFromText = (text: string) => {
      const trimmed = text.trim();
      try {
        return { parsed: JSON.parse(trimmed) };
      } catch {
        const match = trimmed.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            return { parsed: JSON.parse(match[0]) };
          } catch {
            return { error: "Found JSON-like text but parsing failed." };
          }
        }
        return { error: "No valid JSON found in response." };
      }
    };

    const generateSpec = async () => {
      const code = highlightedCode.trim();
      if (!code) {
        setError("No code selected for specification generation.");
        return;
      }

      setIsGenerating(true);
      setError(null);

      const prompt: ChatMessage[] = [
        { role: "system", content: basePrompt },
        {
          role: "user",
          content: `Here is the highlighted code section:\n\n${code}\n\nPlease output JSON with keys "formal" and "simple".`,
        },
      ];

      try {
        const resp = await lmApi.chat(prompt, {
          vendor: "copilot-chat",
          family: "gpt-4o",
          temperature: 0.2,
        });
        const text = extractTextFromResponse(resp);
        const { parsed, error: parseErr } = tryParseSpecFromText(text);

        if (parseErr || !parsed?.formal || !parsed?.simple) {
          setError("Unable to parse LLM response. Please retry.");
          return;
        }

        const cleanSpec = {
          formal: parsed.formal.trim(),
          simple: parsed.simple.trim(),
        };

        setHighlightedSpec(cleanSpec);
      } catch (err: any) {
        setError(`Error generating specification: ${err.message || String(err)}`);
      } finally {
        setIsGenerating(false);
      }
    };

    const renderSplitBox = (
      title: string,
      spec: { formal: string; simple: string }
    ) => {
      const isOpen = expanded.highlighted;
      return (
        <details
          open={isOpen}
          onToggle={(e) =>
            setExpanded((prev) => ({
              ...prev,
              highlighted: (e.target as HTMLDetailsElement).open,
            }))
          }
          style={{
            marginBottom: "16px",
            border: "1px solid #ccc",
            borderRadius: "6px",
            backgroundColor: "#fafafa",
            overflow: "hidden",
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "15px",
              padding: "10px 12px",
              backgroundColor: "#f3f4f6",
              borderBottom: "1px solid #ddd",
              userSelect: "none",
            }}
          >
            {title}
          </summary>
          <div style={{ display: "flex", minHeight: "180px" }}>
            <div
              style={{
                flex: 1,
                padding: "12px",
                backgroundColor: "#f9fafb",
                borderRight: "1px solid #ddd",
                fontFamily: "monospace",
                fontSize: "13px",
                whiteSpace: "pre-wrap",
              }}
            >
              <strong>Formal Specification</strong>
              <hr />
              {spec.formal || (
                <span style={{ color: "#999" }}>No specification yet</span>
              )}
            </div>
            <div
              style={{
                flex: 1,
                padding: "12px",
                backgroundColor: "#ffffff",
                fontFamily: "Poppins, sans-serif",
                fontSize: "13px",
                lineHeight: "1.5",
                whiteSpace: "pre-wrap",
              }}
            >
              <strong>Plain-English Explanation</strong>
              <hr />
              {spec.simple || (
                <span style={{ color: "#999" }}>No explanation yet</span>
              )}
            </div>
          </div>
        </details>
      );
    };

    return (
      <div
        style={{
          fontFamily: "Poppins, sans-serif",
          fontSize: "14px",
          color: "#333",
          padding: "12px",
        }}
      >
        <h3 style={{ marginBottom: "12px", fontWeight: "600" }}>
          🧮 Formal Program Specification Generator
        </h3>

        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "16px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => generateSpec()}
            disabled={isGenerating}
            style={{
              padding: "8px 16px",
              backgroundColor: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isGenerating ? "not-allowed" : "pointer",
              fontWeight: "500",
            }}
          >
            {isGenerating ? "Generating..." : "Generate Specification"}
          </button>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              padding: "10px",
              borderRadius: "4px",
              marginBottom: "16px",
              fontSize: "13px",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {renderSplitBox("Specification for Highlighted Code", highlightedSpec)}
      </div>
    );
  };
  const Generator: React.FC<AnnotationEditorProps> = (props) => {
    // State management
    const [userInput, setUserInput] = useState(props.value.metadata.userInput || '');
    const [generatedCode, setGeneratedCode] = useState(props.value.metadata.generatedCode || '');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [useMock, setUseMock] = useState(false);
    const [apiDiagnostics, setApiDiagnostics] = useState<string>('');
    const [GeneratedComponent, setGeneratedComponent] = useState<React.FC<AnnotationEditorProps> | null>(null);
    
    const isMounted = useRef(true);

    // Fallback mock API - only used when real API completely fails
    // This does NOT generate predetermined templates - it shows an error
    const fallbackMockLmApi = {
      chat: async (messages: any, options?: any) => {
        console.log('[FallbackMockAPI] Real API failed - showing error component');
        
        // Return a simple error component instead of predetermined templates
        return `
  const [error] = useState('API unavailable');

  console.log('[FallbackComponent] Real API failed, showing error');

  return React.createElement('div',
    { style: { padding: '10px', fontFamily: 'Poppins, sans-serif', color: '#D83B01' } },
    React.createElement('h3', 
      { style: { ...commonTextStyle, marginBottom: '10px', color: '#D83B01' } },
      '⚠️ API Unavailable'
    ),
    React.createElement('p',
      { style: { ...commonTextStyle, fontSize: '12px' } },
      'The component generation API is not available. Please check your connection or API configuration.'
    ),
    React.createElement('p',
      { style: { ...commonTextStyle, fontSize: '11px', color: '#666', marginTop: '10px' } },
      'Your request: "${userInput}"'
    ),
    React.createElement('p',
      { style: { ...commonTextStyle, fontSize: '11px', color: '#666', marginTop: '5px' } },
      'Highlighted text: ' + props.utils.getText()
    )
  );
        `.trim();
      }
    };

    useEffect(() => {
      // Comprehensive API diagnostics
      const diagnostics = [];
      
      diagnostics.push('=== API Diagnostics ===');
      diagnostics.push(`vscode: ${typeof vscode} ${vscode ? '✓' : '✗'}`);
      diagnostics.push(`lmApi: ${typeof lmApi} ${lmApi ? '✓' : '✗'}`);
      
      if (lmApi) {
        diagnostics.push(`lmApi.chat: ${typeof lmApi.chat} ${typeof lmApi.chat === 'function' ? '✓' : '✗'}`);
      }
      
      diagnostics.push(`fallbackMockLmApi: ${typeof fallbackMockLmApi} ${fallbackMockLmApi ? '✓' : '✗'}`);
      
      const diagText = diagnostics.join('\n');
      setApiDiagnostics(diagText);
      console.log(diagText);
      
      // Only use mock if the real API is not available
      const lmApiAvailable = typeof lmApi !== 'undefined' && lmApi !== null && typeof lmApi.chat === 'function';
      
      if (!lmApiAvailable) {
        console.warn('[Generator] Real lmApi not available - fallback mode enabled');
        setUseMock(true);
      } else {
        console.log('[Generator] Real lmApi is available');
        setUseMock(false);
      }
      
      return () => {
        isMounted.current = false;
      };
    }, []);

    // Load existing generated component on mount
    useEffect(() => {
      if (generatedCode && isMounted.current) {
        try {
          compileComponent(generatedCode);
        } catch (err) {
          console.error("[Generator] Failed to compile existing code:", err);
        }
      }
    }, []);

    // Save state to metadata
    useEffect(() => {
      props.utils.setMetadata({
        userInput,
        generatedCode,
      });
    }, [userInput, generatedCode]);

    // Get document context
    const anchorText = props.utils.getText();
    const documentText = props.value.document || '';
    const startPos = props.value.start;
    const endPos = props.value.end;

    const createFormattedDocument = () => {
      if (!documentText) return '';
      
      const before = documentText.substring(0, startPos);
      const highlighted = documentText.substring(startPos, endPos);
      const after = documentText.substring(endPos);
      
      return `${before}<<<HIGHLIGHTED>${highlighted}</HIGHLIGHTED>>>${after}`;
    };

    const generateAnnotation = async () => {
      if (!userInput.trim()) {
        setError('Please describe what you want the annotation to do');
        return;
      }

      setIsGenerating(true);
      setError(null);

      try {
        const formattedDocument = createFormattedDocument();
        
        const prompt: ChatMessage[] = [
          {
            role: "system",
            content: `You are an expert React developer creating annotation components for a code annotation system. 

  CONTEXT:
  - You will receive a description of what the annotation should do
  - You have access to the highlighted code/text and surrounding document context
  - The annotation component receives props of type AnnotationEditorProps with these key utilities:
    * props.utils.getText() - gets the highlighted text
    * props.utils.setText(newText) - updates the highlighted text
    * props.utils.setMetadata(obj) - persists data across sessions
    * props.value.metadata - retrieves persisted data
    * props.value.document - the full document text for context
    * props.value.start/end - position of highlighted text

  CRITICAL REQUIREMENT - NO JSX:
  You MUST use React.createElement() instead of JSX syntax because the code will be compiled without a JSX transformer.
  DO NOT use angle brackets like <div>, <button>, etc.
  Instead use: React.createElement('div', { style: {...} }, 'content')

  REQUIREMENTS:
  1. Generate ONLY the component function body using React.createElement
  2. Do NOT include: imports, export statements, or the component function declaration
  3. Use React hooks (useState, useEffect, useRef) as needed - they're available from React destructuring
  4. Store all state in metadata using props.utils.setMetadata() for persistence
  5. Use the commonTextStyle constant for consistent styling: { fontFamily: "Poppins, sans-serif", fontSize: "14px", color: "black" }
  6. Include comprehensive console.log statements for debugging with format: console.log('[ComponentName] message', data)
  7. Handle errors gracefully with try-catch blocks
  8. The lmApi is available with this EXACT signature:
    const response = await lmApi.chat(messages, { vendor: 'copilot-chat', family: 'gpt-4o', temperature: 0.32 });
    IMPORTANT: lmApi.chat() returns a STRING directly, NOT an object. Use it like: const text = await lmApi.chat(messages, options);
  9. Use props.value.document to understand code context for better defaults and behavior
  10. Keep explanations and messages concise and user-friendly
  11. GENERATE EXACTLY WHAT THE USER REQUESTS - do not fall back to predetermined templates

  OUTPUT FORMAT:
  Return ONLY valid JavaScript code using React.createElement().
  Start directly with useState/useEffect declarations or the return statement.
  DO NOT wrap code in markdown code blocks.

  EXAMPLE OUTPUT STRUCTURE:
  const [value, setValue] = useState(props.value.metadata.value || '');
  console.log('[ComponentName] Initialized with value:', value);

  useEffect(() => {
    props.utils.setMetadata({ value });
  }, [value]);

  const handleAction = async () => {
    console.log('[ComponentName] Action triggered');
    try {
      const result = await lmApi.chat([
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello' }
      ], { vendor: 'copilot-chat', family: 'gpt-4o', temperature: 0.5 });
      console.log('[ComponentName] Got result:', result);
    } catch (error) {
      console.error('[ComponentName] Error:', error);
    }
  };

  return React.createElement('div', 
    { style: { padding: "10px", fontFamily: "Poppins, sans-serif" } },
    React.createElement('button', 
      { onClick: handleAction, style: commonTextStyle },
      'Click Me'
    ),
    React.createElement('p', { style: commonTextStyle }, value)
  );`
          },
          {
            role: "user",
            content: `Create an annotation component based on this EXACT description:
  ${userInput}

  Document context (highlighted section marked):
  ${formattedDocument || 'No document context available'}

  Highlighted text:
  ${anchorText || 'No text highlighted'}

  IMPORTANT: Generate a component that fulfills the EXACT request above. Do not use predetermined templates or generic components. Create custom functionality that matches what the user specifically asked for.

  Generate the component implementation now.`
          }
        ];

        console.log('[Generator] Starting generation...');
        console.log('[Generator] Force fallback mode:', useMock);
        console.log('[Generator] User request:', userInput);
        
        let response: string;
        let apiUsed = 'unknown';
        
        if (useMock) {
          console.log('[Generator] Using fallback API (manual override - NOT RECOMMENDED)');
          response = await fallbackMockLmApi.chat(prompt);
          apiUsed = 'fallback-manual';
        } else {
          console.log('[Generator] Attempting real lmApi...');
          console.log('[Generator] lmApi type:', typeof lmApi);
          console.log('[Generator] lmApi.chat type:', typeof lmApi?.chat);
          
          try {
            const startTime = Date.now();
            response = await lmApi.chat(prompt, {
              vendor: 'copilot-chat',
              family: 'gpt-4o',
              temperature: 0.3
            });
            const elapsed = Date.now() - startTime;
            console.log(`[Generator] Real API succeeded in ${elapsed}ms`);
            apiUsed = 'real';
          } catch (apiError: unknown) {
            console.error('[Generator] Real API failed:', apiError);
            console.error('[Generator] Error type:', (apiError as any)?.constructor?.name);
            console.error('[Generator] Error message:', (apiError instanceof Error) ? apiError.message : String(apiError));
            console.log('[Generator] Falling back to error component');
            
            response = await fallbackMockLmApi.chat(prompt);
            apiUsed = 'fallback-auto';
          }
        }

        console.log('[Generator] API used:', apiUsed);
        console.log('[Generator] Response length:', response?.length);
        console.log('[Generator] Response preview:', response?.substring(0, 100));

        // Extract code from response (remove markdown code blocks if present)
        let code = response.trim();
        const codeBlockMatch = code.match(/```(?:javascript|typescript|jsx|tsx)?\n([\s\S]*?)\n```/);
        if (codeBlockMatch) {
          code = codeBlockMatch[1].trim();
          console.log('[Generator] Extracted code from markdown block');
        }

        console.log('[Generator] Final code length:', code.length);
        
        if (isMounted.current) {
          setGeneratedCode(code);
          compileComponent(code);
          console.log('[Generator] Component compiled successfully');
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'An error occurred while generating the annotation';
        console.error('[Generator] Error:', errorMsg, err);
        if (isMounted.current) {
          setError(errorMsg);
        }
      } finally {
        if (isMounted.current) {
          setIsGenerating(false);
        }
      }
    };

    const compileComponent = (code: string) => {
      try {
        console.log('[Generator] Compiling component...');
        
        const commonTextStyle = {
          fontFamily: "Poppins, sans-serif",
          fontSize: "14px",
          color: "black",
        };

        // Create a function that returns a React component
        const componentFunction = new Function(
          'React',
          'props',
          'lmApi',
          'mockLmApi',
          'vscode',
          'commonTextStyle',
          `
          const { useState, useEffect, useRef } = React;
          ${code}
          `
        );

        // Create a wrapper component
        const WrappedComponent: React.FC<AnnotationEditorProps> = (componentProps) => {
          return componentFunction(
            React,
            componentProps,
            lmApi,
            mockLmApi,
            vscode,
            commonTextStyle
          );
        };

        setGeneratedComponent(() => WrappedComponent);
        console.log('[Generator] Component compiled and set successfully');
      } catch (err) {
        console.error('[Generator] Compilation error:', err);
        throw new Error(`Failed to compile generated component: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    const resetGenerator = () => {
      console.log('[Generator] Resetting generator');
      setGeneratedCode('');
      setGeneratedComponent(null);
      setError(null);
    };

    // If we have a generated component, render it
    if (GeneratedComponent) {
      return (
        <div style={{ padding: "10px", fontFamily: "Poppins, sans-serif" }}>
          <div style={{
            marginBottom: "10px",
            padding: "8px",
            backgroundColor: "#E8F5E9",
            border: "1px solid #4CAF50",
            borderRadius: "4px",
            fontSize: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span>✓ Generated annotation active</span>
            <button
              onClick={resetGenerator}
              style={{
                padding: "4px 8px",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px"
              }}
            >
              Reset
            </button>
          </div>
          <GeneratedComponent {...props} />
        </div>
      );
    }

    // Otherwise, show the input interface
    return (
      <div style={{ padding: "10px", fontFamily: "Poppins, sans-serif" }}>
        {apiDiagnostics && (
          <details style={{ marginBottom: "15px", fontSize: "11px", color: "#666" }}>
            <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
              API Diagnostics (click to expand)
            </summary>
            <pre style={{
              marginTop: "8px",
              padding: "8px",
              backgroundColor: "#f5f5f5",
              borderRadius: "4px",
              overflow: "auto"
            }}>
              {apiDiagnostics}
            </pre>
          </details>
        )}
        
        <div style={{ marginBottom: "12px" }}>
          <label style={{
            display: "block",
            marginBottom: "6px",
            fontWeight: "bold",
            fontSize: "14px"
          }}>
            Describe the annotation you want to create:
          </label>
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Example: Create a color picker that lets me change the hex color value in this code... or Create a timer that counts down from the number in this variable..."
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "14px",
              minHeight: "80px",
              resize: "vertical",
              fontFamily: "Poppins, sans-serif"
            }}
          />
        </div>

        <div style={{ marginBottom: "15px", display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={generateAnnotation}
            disabled={isGenerating || !userInput.trim()}
            style={{
              padding: "6px 12px",
              backgroundColor: isGenerating ? "#cccccc" : "#0078D4",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isGenerating ? "default" : "pointer",
              fontSize: "14px"
            }}
          >
            {isGenerating ? "Generating..." : "Generate"}
          </button>

          <label style={{
            display: "flex",
            alignItems: "center",
            fontSize: "12px",
            cursor: "pointer",
            marginLeft: "10px"
          }}>
            <input
              type="checkbox"
              checked={useMock}
              onChange={() => setUseMock(!useMock)}
              style={{ marginRight: "5px" }}
            />
            Force fallback mode (shows error - for testing only)
          </label>
          
          <span style={{ fontSize: "11px", color: "#666", marginLeft: "10px" }}>
            {useMock ? "⚠️ Fallback Mode" : "✓ Real API"}
          </span>
        </div>

        {error && (
          <div style={{
            color: "#D83B01",
            backgroundColor: "#FED9CC",
            padding: "8px",
            borderRadius: "4px",
            marginBottom: "12px",
            fontSize: "14px"
          }}>
            {error}
          </div>
        )}

        {generatedCode && !GeneratedComponent && (
          <div style={{
            marginTop: "15px",
            padding: "10px",
            backgroundColor: "#FFF3CD",
            border: "1px solid #FFC107",
            borderRadius: "4px",
            fontSize: "12px"
          }}>
            <strong>Generated code (failed to compile):</strong>
            <pre style={{
              marginTop: "8px",
              padding: "8px",
              backgroundColor: "#F5F5F5",
              borderRadius: "4px",
              overflow: "auto",
              maxHeight: "200px",
              fontSize: "11px"
            }}>
              {generatedCode}
            </pre>
          </div>
        )}

        <div style={{
          marginTop: "15px",
          padding: "10px",
          backgroundColor: "#F0F0F0",
          borderRadius: "4px",
          fontSize: "12px",
          color: "#666"
        }}>
          <strong>Tips:</strong>
          <ul style={{ marginTop: "5px", marginBottom: "0", paddingLeft: "20px" }}>
            <li>Be specific about what the annotation should do</li>
            <li>Describe the exact behavior and UI you want</li>
            <li>Mention if it should interact with the highlighted text</li>
            <li>State if data should persist across sessions</li>
            <li>Examples: "rating stars", "color picker", "countdown timer", "progress tracker"</li>
          </ul>
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
