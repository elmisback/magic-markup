import React, { useState, useRef } from 'react';
import { AnnotationEditorProps } from "./App";
import { lmApi, ChatMessage } from './lm-api-client';

const LMApiTest: React.FC<AnnotationEditorProps> = (props) => {
  const [prompt, setPrompt] = useState(props.value.metadata.prompt || '');
  const [response, setResponse] = useState(props.value.metadata.response || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState(props.value.metadata.model || 'gpt-4o');
  const [vendor, setVendor] = useState(props.value.metadata.vendor || 'copilot');
  const [isStreaming, setIsStreaming] = useState(props.value.metadata.isStreaming !== false);
  const [requestId, setRequestId] = useState<string | null>(null);
  
  // Save state to metadata
  const saveMetadata = () => {
    props.utils.setMetadata({ 
      prompt, 
      response, 
      model, 
      vendor,
      isStreaming
    });
  };

  // Send request to the language model
  const sendRequest = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResponse('');
    
    try {
      // Prepare message format
      const messages: ChatMessage[] = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt }
      ];
      
      if (isStreaming) {
        // Use streaming API
        const responseText = await lmApi.streamChat(
          messages,
          {
            vendor,
            family: model,
            temperature: 0.7
          },
          {
            onChunk: (chunk) => {
              setResponse((prev: string) => prev + chunk);
            },
            onComplete: (fullResponse) => {
              // This is redundant as we're building the response in onChunk,
              // but included for completeness
              setResponse(fullResponse);
              saveMetadata();
            }
          }
        );
      } else {
        // Use regular API
        const responseText = await lmApi.chat(
          messages,
          {
            vendor,
            family: model,
            temperature: 0.7
          }
        );
        
        setResponse(responseText);
        saveMetadata();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while sending the request');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: "10px", fontFamily: "Poppins, sans-serif" }}>
      <div style={{ marginBottom: "15px" }}>
        <label style={{ fontWeight: "bold", fontSize: "14px", marginBottom: "5px", display: "block" }}>
          LM API Test Tool
        </label>
        <p style={{ fontSize: "12px", color: "#666", marginBottom: "10px" }}>
          This tool is for testing the Language Model API integration.
        </p>
      </div>
      
      <div style={{ marginBottom: "15px", display: "flex", gap: "10px" }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: "14px", marginBottom: "5px", display: "block" }}>
            Vendor:
          </label>
          <select 
            value={vendor}
            onChange={(e) => {
              setVendor(e.target.value);
              props.utils.setMetadata({ ...props.value.metadata, vendor: e.target.value });
            }}
            style={{
              padding: "6px",
              width: "100%",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "14px"
            }}
          >
            <option value="copilot">Copilot</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>
        
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: "14px", marginBottom: "5px", display: "block" }}>
            Model:
          </label>
          <select 
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              props.utils.setMetadata({ ...props.value.metadata, model: e.target.value });
            }}
            style={{
              padding: "6px",
              width: "100%",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "14px"
            }}
          >
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            <option value="claude-3-opus">Claude 3 Opus</option>
            <option value="claude-3-sonnet">Claude 3 Sonnet</option>
          </select>
        </div>
      </div>
      
      <div style={{ marginBottom: "10px" }}>
        <label style={{ display: "flex", alignItems: "center", fontSize: "14px", cursor: "pointer" }}>
          <input 
            type="checkbox" 
            checked={isStreaming} 
            onChange={() => {
              setIsStreaming(!isStreaming);
              props.utils.setMetadata({ ...props.value.metadata, isStreaming: !isStreaming });
            }}
            style={{ marginRight: "6px" }}
          />
          Enable streaming
        </label>
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label style={{ fontSize: "14px", marginBottom: "5px", display: "block" }}>
          Prompt:
        </label>
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            // No need to save on each keystroke
          }}
          placeholder="Enter your prompt here..."
          style={{
            width: "100%",
            padding: "8px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            fontSize: "14px",
            minHeight: "100px",
            resize: "vertical"
          }}
        />
      </div>

      <div style={{ marginBottom: "15px", display: "flex", gap: "10px" }}>
        <button
          onClick={sendRequest}
          disabled={isLoading || !prompt.trim()}
          style={{
            padding: "8px 16px",
            backgroundColor: isLoading || !prompt.trim() ? "#cccccc" : "#0078D4",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isLoading || !prompt.trim() ? "default" : "pointer",
            fontSize: "14px"
          }}
        >
          {isLoading ? "Sending..." : "Send Request"}
        </button>
        
        <button
          onClick={() => {
            setPrompt('');
            setResponse('');
            setError(null);
            props.utils.setMetadata({ 
              ...props.value.metadata, 
              prompt: '', 
              response: '' 
            });
          }}
          style={{
            padding: "8px 16px",
            backgroundColor: "#f0f0f0",
            color: "#333",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px"
          }}
        >
          Clear
        </button>
      </div>

      {error && (
        <div style={{ 
          color: "#D83B01", 
          backgroundColor: "#FED9CC", 
          padding: "8px", 
          borderRadius: "4px",
          marginBottom: "15px",
          fontSize: "14px"
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ marginBottom: "10px" }}>
        <label style={{ fontSize: "14px", marginBottom: "5px", display: "block" }}>
          Response:
        </label>
        <div 
          style={{
            width: "100%",
            padding: "8px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            backgroundColor: "#f8f8f8",
            fontSize: "14px",
            minHeight: "150px",
            maxHeight: "400px",
            overflowY: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word"
          }}
        >
          {isLoading && !response ? (
            <div style={{ color: "#666", fontStyle: "italic" }}>Waiting for response...</div>
          ) : response ? (
            response
          ) : (
            <div style={{ color: "#666", fontStyle: "italic" }}>Response will appear here</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LMApiTest;