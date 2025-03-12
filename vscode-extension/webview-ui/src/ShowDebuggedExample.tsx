import React, { useState, useEffect, useRef } from 'react';
import { AnnotationEditorProps } from "./App";
import { lmApi, mockLmApi, ChatMessage } from './lm-api-client';
import { vscode } from "./utilities/vscode";

interface DebugResponse {
  code: string;
  explanation: string;
}

const ShowDebuggedExample: React.FC<AnnotationEditorProps> = (props) => {
  // State management
  const [debugCode, setDebugCode] = useState(props.value.metadata.debugCode || '');
  const [explanation, setExplanation] = useState(props.value.metadata.explanation || '');
  const [executionResult, setExecutionResult] = useState<any>(props.value.metadata.executionResult || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useMock, setUseMock] = useState(false);
  const [debugPrompt, setDebugPrompt] = useState(props.value.metadata.debugPrompt || '');

  // Track if component is mounted
  const isMounted = useRef(true);

  // Get the anchor text and document text
  const anchorText = props.utils.getText();
  const documentText = props.value.document || '';
  const startPos = props.value.start;
  const endPos = props.value.end;

  // Log for debugging
  const logDebug = (message: string, data?: any) => {
    const logMessage = data ? `${message}: ${JSON.stringify(data)}` : message;
    console.log(`[ShowDebuggedExample] ${logMessage}`);
  };

  useEffect(() => {
    logDebug("Component mounted");
    
    // Check if we should automatically generate debug code on first load
    if (!debugCode && anchorText) {
      logDebug("No debug code exists yet and anchor text is available");
      generateDebugCode();
    }
    
    return () => {
      isMounted.current = false;
      logDebug("Component unmounted");
    };
  }, []);

  // Save state changes to metadata
  useEffect(() => {
    logDebug("Updating metadata");
    props.utils.setMetadata({ 
      debugCode, 
      explanation,
      executionResult: executionResult,
      debugPrompt
    });
  }, [debugCode, explanation, executionResult, debugPrompt]);

  // Create formatted document text with anchor highlighted
  const createFormattedDocument = () => {
    if (!documentText) {
      logDebug("Document text is empty");
      return '';
    }
    
    const before = documentText.substring(0, startPos);
    const highlighted = documentText.substring(startPos, endPos);
    const after = documentText.substring(endPos);
    
    return `${before}<<<HIGHLIGHTED>${highlighted}</HIGHLIGHTED>>>${after}`;
  };

  // Generate debug code using the language model
  const generateDebugCode = async () => {
    if (!anchorText || anchorText.trim() === '') {
      setError('No code selected to debug.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Prepare the prompt for the language model
      const formattedDocument = createFormattedDocument();
      
      if (!formattedDocument) {
        throw new Error("Failed to format document for the prompt");
      }
      
      const prompt: ChatMessage[] = [
        { 
          role: "system", 
          content: `You are a JavaScript debugging assistant. You will be given a document with a highlighted section of JavaScript code marked by <<<HIGHLIGHTED>...</HIGHLIGHTED>>> tags.

Your task is to create a runnable example that demonstrates how the highlighted code works, with appropriate debugging instrumentation. Follow these guidelines:

1. Analyze the highlighted code and its surrounding context to understand what it does
2. Create a standalone, executable JavaScript example that includes the highlighted code
3. Add any necessary variable declarations, function definitions, or imports that would be needed
4. Use reasonable default values for any missing variables or parameters
5. Add console.log statements to show intermediate values and execution flow
6. Make sure the example actually runs the highlighted code (don't just show it)
7. Structure your response as valid, executable JavaScript code only
8. Add comments to explain what the debugging code is doing

YOUR RESPONSE MUST BE IN THE FOLLOWING JSON FORMAT:
{
  "code": "// Your complete, executable debugging example here as a string with all necessary setup and logging",
  "explanation": "A brief explanation of what your debugging code demonstrates"
}

Focus on making the code runnable in a browser JavaScript environment without any external dependencies.`
        },
        { 
          role: "user", 
          content: `Here is the document with the highlighted section:\n\n${formattedDocument}\n\n` +
                   `Please create a runnable debugging example for the highlighted code.` +
                   (debugPrompt ? `\n\nAdditional instructions: ${debugPrompt}` : '')
        }
      ];

      logDebug("Prepared prompt for LM");

      // Call the language model
      let response: string;
      try {
        logDebug("Sending request to language model");
        response = await (useMock ? mockLmApi : lmApi).chat(prompt, {
          vendor: 'copilot',
          family: 'gpt-4o',
          temperature: 0.3
        });
        logDebug("Received response from LM API");
      } catch (apiError) {
        logDebug(`API call error: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
        throw new Error(`Failed to generate debug code: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
      }

      // Parse the response to get structured data
      try {
        logDebug("Attempting to parse JSON response");
        // Find JSON in the response - it might have markdown code blocks or other text
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                         response.match(/```\s*([\s\S]*?)\s*```/) ||
                         response.match(/({[\s\S]*})/);
                
        const jsonStr = jsonMatch ? jsonMatch[1] : response;
        
        const parsedResponse: DebugResponse = JSON.parse(jsonStr);
        logDebug("Successfully parsed JSON");
        
        // Update state with structured response
        if (isMounted.current) {
          setDebugCode(parsedResponse.code);
          setExplanation(parsedResponse.explanation);
          setExecutionResult(null); // Clear previous results
        }
      } catch (parseError) {
        logDebug(`JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        
        // Try to extract code blocks if JSON parsing fails
        const codeBlockMatch = response.match(/```(?:js|javascript)\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
          setDebugCode(codeBlockMatch[1]);
          setExplanation("Generated debug code from model response.");
        } else {
          // Just use the raw response as a fallback
          setDebugCode(response);
          setExplanation("Couldn't parse a structured response. You may need to edit the code.");
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred while generating debug code';
      logDebug(`Overall error: ${errorMsg}`);
      
      if (isMounted.current) {
        setError(errorMsg);
      }
    } finally {
      if (isMounted.current) {
        setIsGenerating(false);
      }
    }
  };

  // Execute the debug code
  const executeCode = async () => {
    if (!debugCode.trim()) {
      setError('No debug code to execute');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create an async function to execute the code
      const asyncFunction = new Function(`return (async () => { 
        try {
          // Capture console.log output
          const logs = [];
          const originalConsoleLog = console.log;
          console.log = (...args) => {
            logs.push(args.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' '));
            originalConsoleLog.apply(console, args);
          };

          // Execute the debug code
          ${debugCode}
          
          // Restore console.log
          console.log = originalConsoleLog;
          
          return { success: true, logs, error: null };
        } catch (error) {
          return { 
            success: false, 
            logs: [], 
            error: error instanceof Error ? error.message : String(error)
          };
        }
      })();`);

      const result = await asyncFunction();
      
      if (isMounted.current) {
        setExecutionResult(result);
        if (!result.success) {
          setError(`Execution error: ${result.error}`);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred during execution';
      
      if (isMounted.current) {
        setError(errorMsg);
        setExecutionResult({ success: false, logs: [], error: errorMsg });
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div style={{ padding: "10px", fontFamily: "Poppins, sans-serif" }}>
      <div style={{ marginBottom: "12px" }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "8px"
        }}>
          <label style={{ fontWeight: "bold", fontSize: "14px" }}>
            Debug Example Code:
          </label>
          <div>
            <button
              onClick={generateDebugCode}
              disabled={isGenerating}
              style={{
                padding: "6px 12px",
                backgroundColor: isGenerating ? "#cccccc" : "#0078D4",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: isGenerating ? "default" : "pointer",
                fontSize: "14px",
                marginRight: "8px"
              }}
            >
              {isGenerating ? "Generating..." : "Regenerate"}
            </button>
            <button
              onClick={executeCode}
              disabled={isLoading || !debugCode.trim()}
              style={{
                padding: "6px 12px",
                backgroundColor: isLoading ? "#cccccc" : "#107C10",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: isLoading ? "default" : "pointer",
                fontSize: "14px"
              }}
            >
              {isLoading ? "Executing..." : "Run Code"}
            </button>
          </div>
        </div>
        
        <div style={{ marginBottom: "10px" }}>
          <label style={{ 
            display: "block",
            fontWeight: "bold", 
            fontSize: "14px",
            marginBottom: "5px"
          }}>
            Debugging Instructions:
          </label>
          <input
            type="text"
            value={debugPrompt}
            onChange={(e) => setDebugPrompt(e.target.value)}
            placeholder="E.g., 'Use TypeScript', 'Focus on error handling', 'Test edge cases'..."
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "13px",
              marginBottom: "10px"
            }}
          />
          <div style={{
            fontSize: "12px",
            color: "#666",
            fontStyle: "italic"
          }}>
            Add natural language instructions to guide how the code is debugged
          </div>
        </div>
        
        {explanation && (
          <div style={{ 
            padding: "8px", 
            backgroundColor: "#EFF6FC", 
            borderRadius: "4px",
            marginBottom: "10px",
            fontSize: "13px"
          }}>
            {explanation}
          </div>
        )}
        
        <textarea
          value={debugCode}
          onChange={(e) => setDebugCode(e.target.value)}
          placeholder="Generated debug code will appear here..."
          style={{
            width: "100%",
            padding: "8px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            fontSize: "13px",
            minHeight: "150px",
            fontFamily: "monospace",
            resize: "vertical"
          }}
        />
      </div>

      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        marginBottom: "8px"
      }}>
        <label style={{ 
          display: "flex", 
          alignItems: "center", 
          fontSize: "12px",
          cursor: "pointer",
          marginRight: "auto"
        }}>
          <input 
            type="checkbox"
            checked={useMock}
            onChange={() => setUseMock(!useMock)}
            style={{ marginRight: "5px" }}
          />
          Use mock API (for testing)
        </label>
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

      {executionResult && (
        <div style={{ marginTop: "15px" }}>
          <div style={{ 
            fontWeight: "bold", 
            marginBottom: "5px", 
            fontSize: "14px",
            display: "flex",
            alignItems: "center"
          }}>
            <div style={{ 
              width: "10px", 
              height: "10px", 
              borderRadius: "50%", 
              backgroundColor: executionResult.success ? "#107C10" : "#D83B01",
              marginRight: "8px" 
            }}></div>
            Execution Results:
          </div>
          
          <div style={{ 
            padding: "10px", 
            backgroundColor: "#F3F3F3", 
            borderRadius: "4px",
            marginBottom: "10px",
            fontSize: "13px",
            fontFamily: "monospace",
            maxHeight: "300px",
            overflowY: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word"
          }}>
            {executionResult.logs && executionResult.logs.length > 0 ? (
              executionResult.logs.map((log: string, index: number) => (
                <div key={index} style={{ 
                  borderBottom: index < executionResult.logs.length - 1 ? "1px solid #ddd" : "none",
                  paddingBottom: "4px",
                  marginBottom: "4px"
                }}>
                  <span style={{ color: "#666", marginRight: "5px" }}>[{index + 1}]</span> {log}
                </div>
              ))
            ) : executionResult.success ? (
              <em>Code executed successfully with no console output</em>
            ) : (
              <div style={{ color: "#D83B01" }}>
                {executionResult.error || "Execution failed with no specific error message"}
              </div>
            )}
          </div>
          
          {!executionResult.success && (
            <div style={{ color: "#D83B01", fontSize: "13px" }}>
              The code execution failed. Try editing the debug code to fix any errors.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ShowDebuggedExample;
