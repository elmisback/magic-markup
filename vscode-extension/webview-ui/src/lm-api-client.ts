// lm-api-client.ts
// Enhanced with debugging

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

// Check if vscode API is available
if (typeof window !== 'undefined') {
  if (!window.vscode) {
    debugLog("WARNING: window.vscode is not defined! This might not be running in a VSCode webview");
  } else {
    debugLog("window.vscode is available");
  }
}

// Declare vscode API provided by the webview
declare global {
  interface Window {
    vscode?: {
      postMessage: (message: any) => void;
    };
  }
}

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
    
    // Setup periodic logging of pending requests
    setInterval(() => {
      if (this.pendingRequests.size > 0) {
        const now = Date.now();
        const pendingInfo = Array.from(this.pendingRequests.entries()).map(([id, req]) => {
          return {
            id,
            timeElapsed: (now - req.timestamp) / 1000
          };
        });
        debugLog(`Currently ${this.pendingRequests.size} pending requests`, pendingInfo);
      }
    }, 5000);
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
    
    // Check if vscode is available before proceeding
    if (!window.vscode) {
      debugLog("ERROR: window.vscode is not available. Cannot send request.");
      return Promise.reject(new Error("VSCode API not available"));
    }
    
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
        window.vscode?.postMessage(request);
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
    
    // Check if vscode is available before proceeding
    if (!window.vscode) {
      debugLog("ERROR: window.vscode is not available. Cannot send streaming request.");
      return Promise.reject(new Error("VSCode API not available"));
    }
    
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
        window.vscode?.postMessage(request);
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
      window.vscode?.postMessage({
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
   * Test if the LM API is working with a simple request
   * @returns Promise that resolves if the API is working
   */
  testConnection(): Promise<boolean> {
    debugLog("Testing LM API connection");
    return this.chat(
      [{ role: "user", content: "Test connection. Respond with YES only." }],
      { temperature: 0 }
    ).then(response => {
      const success = response.includes("YES");
      debugLog(`Connection test ${success ? "passed" : "failed"}`, { response });
      return success;
    }).catch(err => {
      debugLog("Connection test failed with error", { 
        error: err instanceof Error ? err.message : String(err)
      });
      throw err;
    });
  }
}

// Create a singleton instance
export const lmApi = new LMApiClient();

// Run connection test on initialization
setTimeout(() => {
  if (window.vscode) {
    debugLog("Running connection test after initialization");
    lmApi.testConnection()
      .then(result => debugLog(`Connection test completed with result: ${result}`))
      .catch(err => debugLog("Connection test encountered an error", { 
        error: err instanceof Error ? err.message : String(err) 
      }));
  } else {
    debugLog("Skipping connection test - VSCode API not available");
  }
}, 2000);