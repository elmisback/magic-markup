import { AnnotationEditorProps } from "./App";
import React, { useEffect, useState, useRef  } from "react";
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
              vendor: 'copilot',
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
              vendor: 'copilot',
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
  explainInEnglish: ExplainInEnglish, // Add this line
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
  // lmApiTest: "LM API Test",
};
