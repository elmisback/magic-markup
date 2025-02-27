import React, { useState, useEffect, useRef } from 'react';
import { AnnotationEditorProps } from "./App";
import { lmApi } from './lm-api-client';

interface YesNoResponse {
  answer: boolean;
  explanation: string;
  suggestion?: string;
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
}

// Helper for debugging
const debugLog = (message: string, data?: any) => {
  const logMessage = data ? `${message}: ${JSON.stringify(data)}` : message;
  console.log(`[LMUnitTest Debug] ${logMessage}`);
};

const LMUnitTest: React.FC<AnnotationEditorProps> = (props) => {
  // State management
  const [question, setQuestion] = useState(props.value.metadata.question || '');
  const [answer, setAnswer] = useState<boolean | null>(props.value.metadata.answer || null);
  const [explanation, setExplanation] = useState(props.value.metadata.explanation || '');
  const [suggestion, setSuggestion] = useState(props.value.metadata.suggestion || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  
  // Track if component is mounted
  const isMounted = useRef(true);

  useEffect(() => {
    debugLog("Component mounted");
    return () => {
      isMounted.current = false;
      debugLog("Component unmounted");
    };
  }, []);

  // Get the anchor text and document text
  const anchorText = props.utils.getText();
  const documentText = props.value.document || '';
  const startPos = props.value.start;
  const endPos = props.value.end;

  useEffect(() => {
    debugLog("Component props received", { 
      anchorText, 
      startPos, 
      endPos, 
      documentTextLength: documentText?.length || 0
    });
  }, []);

  // Save state changes to metadata
  useEffect(() => {
    debugLog("Updating metadata", { question, answer, explanation });
    props.utils.setMetadata({ 
      question, 
      answer, 
      explanation,
      suggestion
    });
  }, [question, answer, explanation, suggestion]);

  // Create formatted document text with anchor highlighted
  const createFormattedDocument = () => {
    if (!documentText) {
      debugLog("Document text is empty");
      return '';
    }
    
    const before = documentText.substring(0, startPos);
    const highlighted = documentText.substring(startPos, endPos);
    const after = documentText.substring(endPos);

    debugLog("Created formatted document", { 
      beforeLength: before.length, 
      highlightedLength: highlighted.length, 
      afterLength: after.length 
    });
    
    return `${before}<<<HIGHLIGHTED>${highlighted}</HIGHLIGHTED>>>${after}`;
  };

  // Add debug info
  const addDebugInfo = (info: string, data?: any) => {
    const logMessage = data ? `${info}: ${JSON.stringify(data)}` : info;
    console.log(`[LMUnitTest Debug] ${logMessage}`);
    setDebugInfo(prev => [...prev, logMessage]);
  };

  // Check if lmApi is properly defined
  useEffect(() => {
    if (!lmApi) {
      addDebugInfo("ERROR: lmApi is not defined. Check import.");
    } else {
      addDebugInfo("lmApi is defined properly");
      // Check if chat method exists
      if (typeof lmApi.chat !== 'function') {
        addDebugInfo("ERROR: lmApi.chat is not a function");
      } else {
        addDebugInfo("lmApi.chat is defined properly");
      }
    }
  }, []);

  // Mock function for testing when the real API isn't working
  const mockApiCall = async (messages: ChatMessage[]): Promise<string> => {
    addDebugInfo("Using mock API instead of real API");
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`{
          "answer": false,
          "explanation": "This is a mock response for testing",
          "suggestion": "Mock suggested improvement"
        }`);
      }, 1000);
    });
  };

  // Ask question to the language model
  const askQuestion = async () => {
    if (!question.trim()) {
      setError('Please enter a question first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnswer(null);
    setExplanation('');
    setSuggestion('');
    setDebugInfo([]);

    addDebugInfo("Starting LM request process");

    try {
      // Prepare the prompt for the language model with structured output format
      const formattedDocument = createFormattedDocument();
      
      // Check if document formatting succeeded
      if (!formattedDocument) {
        throw new Error("Failed to format document for the prompt");
      }
      
      const prompt: ChatMessage[] = [
        { 
          role: "system", 
          content: `You are an assistant helping analyze code or text. You will be given a document with a highlighted section marked by <<<HIGHLIGHTED>...</HIGHLIGHTED>>> tags. 
          
Answer the user's yes/no question about the highlighted section.

YOUR RESPONSE MUST BE IN THE FOLLOWING JSON FORMAT:
{
  "answer": boolean,
  "explanation": "brief explanation of your answer",
  "suggestion": "improved version of the highlighted text that would make the answer true" (only include if answer is false)
}

The "answer" field must be true or false. The "explanation" should be brief and clear. If the answer is false, include a "suggestion" field with your recommended improved text.`
        },
        { 
          role: "user", 
          content: `Here is the document with the highlighted section:\n\n${formattedDocument}\n\n` +
                   `Question about the highlighted section: ${question}`
        }
      ];

      addDebugInfo("Prepared prompt for LM");
      addDebugInfo(`Prompt first 100 chars: ${prompt[1].content.substring(0, 100)}...`);

      // Try to call the language model, with fallback to mock
      let response = '';
      try {
        addDebugInfo("Calling lmApi.chat()");
        response = await lmApi.chat(prompt, {
          vendor: 'copilot',
          family: 'gpt-4o',
          temperature: 0.3
        });
        addDebugInfo("Received response from LM API");
      } catch (apiError) {
        addDebugInfo(`API call error: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
        addDebugInfo("Falling back to mock API");
        response = await mockApiCall(prompt);
      }

      addDebugInfo(`Response first 100 chars: ${response.substring(0, 100)}...`);

      // Parse the response to get structured data
      try {
        addDebugInfo("Attempting to parse JSON response");
        // Find JSON in the response - it might have markdown code blocks or other text
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                         response.match(/```\s*([\s\S]*?)\s*```/) ||
                         response.match(/({[\s\S]*})/);
                
        const jsonStr = jsonMatch ? jsonMatch[1] : response;
        addDebugInfo(`Extracted JSON string: ${jsonStr.substring(0, 100)}...`);
        
        const parsedResponse: YesNoResponse = JSON.parse(jsonStr);
        addDebugInfo("Successfully parsed JSON", parsedResponse);
        
        // Update state with structured response
        if (isMounted.current) {
          setAnswer(parsedResponse.answer);
          setExplanation(parsedResponse.explanation);
          
          if (!parsedResponse.answer && parsedResponse.suggestion) {
            setSuggestion(parsedResponse.suggestion);
          }
          addDebugInfo("Updated state with response data");
        }
      } catch (parseError) {
        addDebugInfo(`JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        // If we can't parse JSON, make a second call to fix the format
        addDebugInfo("Making second call to fix format");
        
        const fixPrompt: ChatMessage[] = [
          {
            role: "system",
            content: `Extract the yes/no answer, explanation, and suggestion (if applicable) from the following LLM response 
            and format it as clean JSON with these fields:
            {
              "answer": boolean,
              "explanation": "brief explanation",
              "suggestion": "improved text" (only if answer is false)
            }`
          },
          {
            role: "user",
            content: response
          }
        ];
        
        let fixedResponse = '';
        try {
          addDebugInfo("Calling API for format fixing");
          fixedResponse = await lmApi.chat(fixPrompt, {
            vendor: 'copilot',
            family: 'gpt-4o',
            temperature: 0.1
          });
          addDebugInfo("Received fixed format response");
        } catch (secondApiError) {
          addDebugInfo(`Second API call error: ${secondApiError instanceof Error ? secondApiError.message : String(secondApiError)}`);
          // Fallback to mock for testing
          fixedResponse = `{"answer": false, "explanation": "Mock explanation after error", "suggestion": "Mock suggestion after error"}`;
        }
        
        try {
          addDebugInfo("Attempting to parse fixed JSON response");
          const fixedJsonMatch = fixedResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
                                fixedResponse.match(/```\s*([\s\S]*?)\s*```/) ||
                                fixedResponse.match(/({[\s\S]*})/);
                                
          const fixedJsonStr = fixedJsonMatch ? fixedJsonMatch[1] : fixedResponse;
          addDebugInfo(`Fixed JSON string: ${fixedJsonStr.substring(0, 100)}...`);
          
          const parsedFixed: YesNoResponse = JSON.parse(fixedJsonStr);
          addDebugInfo("Successfully parsed fixed JSON", parsedFixed);
          
          if (isMounted.current) {
            setAnswer(parsedFixed.answer);
            setExplanation(parsedFixed.explanation);
            
            if (!parsedFixed.answer && parsedFixed.suggestion) {
              setSuggestion(parsedFixed.suggestion);
            }
            addDebugInfo("Updated state with fixed response data");
          }
        } catch (secondError) {
          addDebugInfo(`Second JSON parse error: ${secondError instanceof Error ? secondError.message : String(secondError)}`);
          // If we still can't parse, fallback to basic parsing
          addDebugInfo("Falling back to basic text parsing");
          const isYes = /yes|true|correct|right/i.test(response.toLowerCase());
          
          if (isMounted.current) {
            setAnswer(isYes);
            setExplanation("Couldn't parse a structured response.");
            addDebugInfo(`Set fallback answer to ${isYes ? "YES" : "NO"}`);
          }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred while asking the question';
      addDebugInfo(`Overall error: ${errorMsg}`);
      
      if (isMounted.current) {
        setError(errorMsg);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        addDebugInfo("Process completed, loading state set to false");
      }
    }
  };

  // Apply the suggested text to the document
  const applySuggestion = () => {
    if (suggestion && window.confirm('Are you sure you want to update the text in your document?')) {
      addDebugInfo(`Applying suggestion to document: ${suggestion.substring(0, 50)}...`);
      
      window.vscode?.postMessage({
        command: "replaceText",
        data: {
          start: startPos,
          end: endPos,
          text: suggestion
        }
      });
      
      // Update the answer to reflect the change
      setAnswer(true);
      setSuggestion('');
      addDebugInfo("Suggestion applied, state updated");
    }
  };

  return (
    <div style={{ padding: "10px", fontFamily: "Poppins, sans-serif" }}>
      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold", fontSize: "14px" }}>
          Ask a yes/no question about this code:
        </label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Is this code correct? Does this function handle all edge cases?"
          style={{
            width: "100%",
            padding: "8px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            fontSize: "14px",
            minHeight: "60px",
            resize: "vertical"
          }}
        />
      </div>

      <div style={{ marginBottom: "15px" }}>
        <button
          onClick={askQuestion}
          disabled={isLoading || !question.trim()}
          style={{
            padding: "6px 12px",
            backgroundColor: isLoading ? "#cccccc" : "#0078D4",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isLoading ? "default" : "pointer",
            fontSize: "14px"
          }}
        >
          {isLoading ? "Asking..." : "Ask Question"}
        </button>
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

      {debugInfo.length > 0 && (
        <div style={{
          marginBottom: "12px",
          padding: "8px",
          backgroundColor: "#F0F0F0",
          border: "1px solid #ccc",
          borderRadius: "4px",
          fontSize: "12px",
          fontFamily: "monospace",
          maxHeight: "150px",
          overflowY: "auto"
        }}>
          <div style={{ fontWeight: "bold", marginBottom: "5px" }}>Debug Info:</div>
          {debugInfo.map((info, i) => (
            <div key={i}>{info}</div>
          ))}
        </div>
      )}

      {answer !== null && (
        <div style={{ 
          marginBottom: "12px",
          padding: "10px",
          borderRadius: "4px",
          backgroundColor: answer ? "#DFF6DD" : "#FED9CC",
          border: `1px solid ${answer ? "#107C10" : "#D83B01"}`,
          fontSize: "14px"
        }}>
          <div style={{ 
            fontWeight: "bold", 
            marginBottom: "5px",
            color: answer ? "#107C10" : "#D83B01"
          }}>
            {answer ? "YES" : "NO"}
          </div>
          <div style={{ marginTop: "5px" }}>
            {explanation}
          </div>
        </div>
      )}

      {!answer && suggestion && (
        <div style={{ marginTop: "15px" }}>
          <div style={{ fontWeight: "bold", marginBottom: "5px", fontSize: "14px" }}>
            Suggested improvement:
          </div>
          <div style={{ 
            padding: "8px", 
            backgroundColor: "#F0F0F0", 
            borderRadius: "4px",
            marginBottom: "10px",
            fontSize: "14px",
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word"
          }}>
            {suggestion}
          </div>
          <button
            onClick={applySuggestion}
            style={{
              padding: "6px 12px",
              backgroundColor: "#107C10",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            Apply Suggestion
          </button>
        </div>
      )}
    </div>
  );
};

export default LMUnitTest;