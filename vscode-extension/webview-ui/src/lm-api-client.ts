// lm-api-client.ts

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

// Declare vscode API provided by the webview
declare global {
  interface Window {
    vscode: {
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
  }>();

  constructor() {
    // Setup message listener
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  // Process incoming messages from extension host
  private handleMessage(event: MessageEvent) {
    try {
      const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      
      if (!message || !message.id) return;
      
      const pendingRequest = this.pendingRequests.get(message.id);
      if (!pendingRequest) return;
      
      // Handle streaming chunks
      if ('chunk' in message) {
        if (message.chunk.content && pendingRequest.onChunk) {
          pendingRequest.onChunk(message.chunk.content);
        }
        
        if (message.chunk.isComplete) {
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
          const errorObj = typeof message.error === 'string' 
            ? JSON.parse(message.error) 
            : message.error;
          pendingRequest.reject(new Error(errorObj.message || 'Unknown error'));
        } else {
          pendingRequest.resolve(message.payload?.result?.content || '');
        }
        this.pendingRequests.delete(message.id);
      }
    } catch (error) {
      console.error('Error handling message:', error);
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
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      window.vscode?.postMessage({
        command: "lm.chat",
        id,
        data: {
          messages,
          options
        }
      });
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
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { 
        resolve, 
        reject,
        onChunk: callbacks.onChunk,
        onComplete: callbacks.onComplete
      });
      
      window.vscode?.postMessage({
        command: "lm.chat",
        id,
        data: {
          messages,
          options: streamOptions
        }
      });
    });
  }

  /**
   * Cancel an ongoing request
   * @param requestId The ID of the request to cancel
   */
  cancelRequest(requestId: string): void {
    window.vscode?.postMessage({
      command: "lm.cancelRequest",
      id: requestId
    });
    
    const pendingRequest = this.pendingRequests.get(requestId);
    if (pendingRequest) {
      pendingRequest.reject(new Error('Request was cancelled'));
      this.pendingRequests.delete(requestId);
    }
  }
}

// Create a singleton instance
export const lmApi = new LMApiClient();