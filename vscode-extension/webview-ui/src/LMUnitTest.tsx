import React, { useState, useEffect } from 'react';
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

const LMUnitTest: React.FC<AnnotationEditorProps> = (props) => {
  // State management
  const [question, setQuestion] = useState(props.value.metadata.question || '');
  const [answer, setAnswer] = useState<boolean | null>(props.value.metadata.answer || null);
  const [explanation, setExplanation] = useState(props.value.metadata.explanation || '');
  const [suggestion, setSuggestion] = useState(props.value.metadata.suggestion || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the anchor text and document text
  const anchorText = props.utils.getText();
  const documentText = props.value.document || '';
  const startPos = props.value.start;
  const endPos = props.value.end;

  // Save state changes to metadata
  useEffect(() => {
    props.utils.setMetadata({ 
      question, 
      answer, 
      explanation,
      suggestion
    });
  }, [question, answer, explanation, suggestion]);

  // Create formatted document text with anchor highlighted
  const createFormattedDocument = () => {
    if (!documentText) return '';
    
    const before = documentText.substring(0, startPos);
    const highlighted = documentText.substring(startPos, endPos);
    const after = documentText.substring(endPos);

    return `${before}<<<HIGHLIGHTED>${highlighted}</HIGHLIGHTED>>>${after}`;
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

    try {
      // Prepare the prompt for the language model with structured output format
      const formattedDocument = createFormattedDocument();
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

      // Call the language model
      const response = await lmApi.chat(prompt, {
        vendor: 'copilot',
        family: 'gpt-4o',
        temperature: 0.3
      });

      // Parse the response to get structured data
      try {
        // Find JSON in the response - it might have markdown code blocks or other text
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                         response.match(/```\s*([\s\S]*?)\s*```/) ||
                         response.match(/({[\s\S]*})/);
                
        const jsonStr = jsonMatch ? jsonMatch[1] : response;
        const parsedResponse: YesNoResponse = JSON.parse(jsonStr);
        
        // Update state with structured response
        setAnswer(parsedResponse.answer);
        setExplanation(parsedResponse.explanation);
        
        if (!parsedResponse.answer && parsedResponse.suggestion) {
          setSuggestion(parsedResponse.suggestion);
        }
      } catch (parseError) {
        // If we can't parse JSON, make a second call to fix the format
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
        
        const fixedResponse = await lmApi.chat(fixPrompt, {
          vendor: 'copilot',
          family: 'gpt-4o',
          temperature: 0.1
        });
        
        try {
          const fixedJsonMatch = fixedResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
                                fixedResponse.match(/```\s*([\s\S]*?)\s*```/) ||
                                fixedResponse.match(/({[\s\S]*})/);
                                
          const fixedJsonStr = fixedJsonMatch ? fixedJsonMatch[1] : fixedResponse;
          const parsedFixed: YesNoResponse = JSON.parse(fixedJsonStr);
          
          setAnswer(parsedFixed.answer);
          setExplanation(parsedFixed.explanation);
          
          if (!parsedFixed.answer && parsedFixed.suggestion) {
            setSuggestion(parsedFixed.suggestion);
          }
        } catch (secondError) {
          // If we still can't parse, fallback to basic parsing
          const isYes = /yes|true|correct|right/i.test(response.toLowerCase());
          setAnswer(isYes);
          setExplanation("Couldn't parse a structured response.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while asking the question');
    } finally {
      setIsLoading(false);
    }
  };

  // Apply the suggested text to the document
  const applySuggestion = () => {
    if (suggestion && window.confirm('Are you sure you want to update the text in your document?')) {
      window.vscode.postMessage({
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