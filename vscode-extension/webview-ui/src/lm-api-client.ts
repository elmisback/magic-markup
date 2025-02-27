// lm-api-client.ts
// Updated to use VSCodeAPIWrapper instead of window.vscode

import { vscode } from "./utilities/vscode";

// Type definitions
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LMOptions {
  vendor?: string;
  family?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface StreamingCallbacks {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

// Debug logging helper
const debugLog = (message: string, data?: any) => {
  const logMessage = data ? `${message}: ${JSON.stringify(data, null, 2)}` : message;
  console.log(`[LM API Client] ${logMessage}`);
};

// Main API client class
class LMApiClient {
  private nextRequestId = 1;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    onChunk?: (chunk: string) => void;
    onComplete?: (fullResponse: string) => void;
    timestamp: number;
  }>();

  constructor() {
    debugLog("Initializing LM API Client");
    
    // Setup message listener
    window.addEventListener('message', this.handleMessage.bind(this));
    debugLog("Message listener attached");
    
    // Log initial status
    debugLog("VSCode API wrapper available:", { available: !!vscode });
  }

  // Process incoming messages from extension host
  private handleMessage(event: MessageEvent) {
    try {
      debugLog("Received message from extension", { 
        type: typeof event.data,
        data: typeof event.data === 'string' ? event.data.substring(0, 100) : event.data 
      });
      
      const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      
      if (!message || !message.id) {
        debugLog("Message missing id, ignoring", message);
        return;
      }
      
      const pendingRequest = this.pendingRequests.get(message.id);
      if (!pendingRequest) {
        debugLog(`No pending request found for id: ${message.id}`);
        return;
      }
      
      debugLog(`Found pending request for id: ${message.id}`);
      
      // Handle streaming chunks
      if ('chunk' in message) {
        debugLog(`Received chunk for request ${message.id}`, { 
          contentLength: message.chunk.content?.length,
          isComplete: message.chunk.isComplete
        });
        
        if (message.chunk.content && pendingRequest.onChunk) {
          pendingRequest.onChunk(message.chunk.content);
        }
        
        if (message.chunk.isComplete) {
          debugLog(`Request ${message.id} is complete (streaming)`);
          if (pendingRequest.onComplete) {
            pendingRequest.onComplete(message.payload?.result?.content || '');
          }
          pendingRequest.resolve(message.payload?.result?.content || '');
          this.pendingRequests.delete(message.id);
        }
        return;
      }
      
      // Handle regular (non-streaming) responses
      if (message.isResponse) {
        if (message.error) {
          debugLog(`Request ${message.id} failed with error`, message.error);
          const errorObj = typeof message.error === 'string' 
            ? this.safeJsonParse(message.error) || { message: message.error }
            : message.error;
          pendingRequest.reject(new Error(errorObj.message || 'Unknown error'));
        } else {
          debugLog(`Request ${message.id} succeeded`, { 
            responseLength: message.payload?.result?.content?.length 
          });
          pendingRequest.resolve(message.payload?.result?.content || '');
        }
        this.pendingRequests.delete(message.id);
        debugLog(`Removed request ${message.id} from pending requests`);
      }
    } catch (error) {
      debugLog('Error handling message', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  // Safely parse JSON with error handling
  private safeJsonParse(text: string) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  /**
   * Send a chat request to the language model
   * @param messages Array of chat messages
   * @param options Model options
   * @returns Promise that resolves with the model's response
   */
  chat(messages: ChatMessage[], options: LMOptions = {}): Promise<string> {
    const id = `req_${this.nextRequestId++}`;
    debugLog(`Creating new chat request with id: ${id}`, { messages, options });
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { 
        resolve, 
        reject, 
        timestamp: Date.now() 
      });
      
      const request = {
        command: "lm.chat",
        id,
        data: {
          messages,
          options
        }
      };
      
      debugLog(`Sending request ${id} to extension`, request);
      
      try {
        // Use the vscode wrapper instead of window.vscode
        vscode.postMessage(request);
        debugLog(`Request ${id} sent successfully`);
      } catch (err) {
        debugLog(`Error sending request ${id}`, { 
          error: err instanceof Error ? err.message : String(err) 
        });
        this.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  /**
   * Send a streaming chat request to the language model
   * @param messages Array of chat messages
   * @param options Model options
   * @param callbacks Callbacks for streaming responses
   * @returns Promise that resolves with the complete response
   */
  streamChat(
    messages: ChatMessage[], 
    options: LMOptions = {}, 
    callbacks: StreamingCallbacks = {}
  ): Promise<string> {
    const id = `req_${this.nextRequestId++}`;
    const streamOptions = { ...options, stream: true };
    
    debugLog(`Creating new streaming chat request with id: ${id}`, { 
      messages, 
      options: streamOptions
    });
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { 
        resolve, 
        reject,
        onChunk: callbacks.onChunk,
        onComplete: callbacks.onComplete,
        timestamp: Date.now()
      });
      
      const request = {
        command: "lm.chat",
        id,
        data: {
          messages,
          options: streamOptions
        }
      };
      
      debugLog(`Sending streaming request ${id} to extension`, request);
      
      try {
        // Use the vscode wrapper instead of window.vscode
        vscode.postMessage(request);
        debugLog(`Streaming request ${id} sent successfully`);
      } catch (err) {
        debugLog(`Error sending streaming request ${id}`, { 
          error: err instanceof Error ? err.message : String(err) 
        });
        this.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  /**
   * Cancel an ongoing request
   * @param requestId The ID of the request to cancel
   */
  cancelRequest(requestId: string): void {
    debugLog(`Attempting to cancel request ${requestId}`);
    
    if (!this.pendingRequests.has(requestId)) {
      debugLog(`Request ${requestId} not found in pending requests`);
      return;
    }
    
    try {
      vscode.postMessage({
        command: "lm.cancelRequest",
        id: requestId
      });
      debugLog(`Cancel request sent for ${requestId}`);
    } catch (err) {
      debugLog(`Error sending cancel request for ${requestId}`, { 
        error: err instanceof Error ? err.message : String(err) 
      });
    }
    
    const pendingRequest = this.pendingRequests.get(requestId);
    if (pendingRequest) {
      pendingRequest.reject(new Error('Request was cancelled'));
      this.pendingRequests.delete(requestId);
      debugLog(`Request ${requestId} marked as cancelled and removed from pending`);
    }
  }

  /**
   * Use mock response instead of real API (for testing)
   */
  mockChat(messages: ChatMessage[]): Promise<string> {
    debugLog("Using mock chat response");
    return new Promise((resolve) => {
      setTimeout(() => {
        const lastUserMessage = messages.find(m => m.role === 'user')?.content || '';
        const isYesNo = messages[0]?.content?.includes('yes/no') || false;
        
        if (isYesNo) {
          resolve(`{
            "answer": false,
            "explanation": "This is a mock response for testing the Yes/No component",
            "suggestion": "Mock suggested improvement for the highlighted code"
          }`);
        } else {
          resolve(`This is a mock response from the LM API client.\nYou asked: "${lastUserMessage}"\n\nThis is a simulated response for testing purposes.`);
        }
      }, 1000);
    });
  }
}

// Create a singleton instance
export const lmApi = new LMApiClient();

// Add a fallback mock implementation
// This can be used if the real API isn't working
export const mockLmApi = {
  chat: (messages: ChatMessage[], options?: LMOptions) => lmApi.mockChat(messages),
  streamChat: (messages: ChatMessage[], options?: LMOptions, callbacks?: StreamingCallbacks) => {
    if (callbacks?.onChunk) {
      const { onChunk } = callbacks;
      if (onChunk) {
        setTimeout(() => onChunk("This is a mock streaming "), 200);
        setTimeout(() => onChunk("response for "), 400);
        setTimeout(() => onChunk("testing purposes."), 600);
      }
    }
    return lmApi.mockChat(messages);
  }
};