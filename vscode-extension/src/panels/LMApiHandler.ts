import * as vscode from "vscode";

export class LMApiHandler {
  private _webview: vscode.Webview;
  private _pendingRequests = new Map<string, {
    cancelToken: vscode.CancellationTokenSource;
  }>();

  constructor(webview: vscode.Webview) {
    this._webview = webview;
  }

  // Process an incoming LM request from the webview
  public async handleLMRequest(message: any) {
    if (!Array.isArray(message.data?.messages)) {
      this.sendErrorResponse(message, 'Missing or invalid messages array');
      return;
    }
    
    try {
      // Select appropriate model based on options
      const modelOptions = {
        vendor: message.data.options?.vendor || 'copilot',
        family: message.data.options?.family || 'gpt-4o'
      };
      
      console.log(`Selecting model with options:`, modelOptions);
      const [model] = await vscode.lm.selectChatModels(modelOptions);
      
      if (!model) {
        this.sendErrorResponse(message, JSON.stringify({
          message: 'No suitable language model found',
          code: 'MODEL_NOT_FOUND'
        }));
        return;
      }
      
      console.log(`Selected model: ${model.name}`);
      
      // Create cancel token
      const cancelTokenSource = new vscode.CancellationTokenSource();
      
      // Store for potential cancellation
      this._pendingRequests.set(message.id, {
        cancelToken: cancelTokenSource
      });
      
      // Whether the client requested streaming
      const clientWantsStreaming = message.data.options?.stream === true;
      console.log(`Client wants streaming: ${clientWantsStreaming}`);
      
      // Send the request - all requests return a stream in newer VSCode API
      const response = await model.sendRequest(
        message.data.messages,
        message.data.options || {},
        cancelTokenSource.token
      );
      
      console.log(`Received response object:`, response);
      
      // Handle the response based on whether client wants streaming
      if (clientWantsStreaming) {
        // For streaming requests, send chunks as they arrive
        try {
          console.log(`Processing streaming response`);
          
          // Start consuming the stream and sending chunks
          let fullContent = '';
          for await (const chunk of response.text) {
            fullContent += chunk;
            
            // Send chunk to webview
            this._webview.postMessage(JSON.stringify({
              id: message.id,
              command: message.command,
              chunk: {
                content: chunk,
                isComplete: false
              }
            }));
          }
          
          // Send the final complete message
          console.log(`Stream completed, sending final message`);
          this._webview.postMessage(JSON.stringify({
            id: message.id,
            command: message.command,
            chunk: {
              content: '',
              isComplete: true
            },
            payload: { result: { content: fullContent } }
          }));
        } catch (err) {
          console.error(`Error processing stream:`, err);
          const errorMessage = err instanceof Error ? err.message : String(err);
          this.sendErrorResponse(message, `Streaming error: ${errorMessage}`);
        }
      } else {
        // For non-streaming requests, collect the full content first then send once
        try {
          console.log(`Processing non-streaming response`);
          
          // Collect the full content from the stream
          let fullContent = '';
          for await (const chunk of response.text) {
            fullContent += chunk;
          }
          
          console.log(`Collected full content, length: ${fullContent.length}`);
          
          // Send the complete response at once
          this._webview.postMessage(JSON.stringify({
            id: message.id,
            command: message.command,
            isResponse: true,
            payload: { result: { content: fullContent } }
          }));
        } catch (err) {
          console.error(`Error collecting full content:`, err);
          const errorMessage = err instanceof Error ? err.message : String(err);
          this.sendErrorResponse(message, `Response processing error: ${errorMessage}`);
        }
      }
      
      // Clean up after request is complete
      this._pendingRequests.delete(message.id);
      console.log(`Request ${message.id} completed and cleaned up`);
      
    } catch (error) {
      console.error(`LM API error:`, error);
      
      // Handle specific language model errors
      if (error instanceof vscode.LanguageModelError) {
        const errorInfo = {
          message: error.message,
          code: error.code,
          cause: error.cause instanceof Error ? error.cause.message : undefined,
          type: 'LanguageModelError'
        };
        
        // Check for specific error conditions
        if (error.cause instanceof Error && error.cause.message.includes('off_topic')) {
          errorInfo.message = "I'm sorry, I can only explain computer science concepts.";
        }
        
        this.sendErrorResponse(message, JSON.stringify(errorInfo));
        
        // Notify user via VSCode UI for critical errors
        if (['QuotaExceeded', 'ModelNotFound', 'ContentPolicy'].includes(error.code)) {
          vscode.window.showErrorMessage(`Language Model API: ${errorInfo.message}`);
        }
      } else {
        // Generic error handling
        this.sendErrorResponse(message, JSON.stringify({
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'UNKNOWN_ERROR'
        }));
      }
      
      // Clean up after request error
      this._pendingRequests.delete(message.id);
    }
  }
  
  // Cancel an ongoing request
  public cancelRequest(id: string) {
    console.log(`Cancelling request ${id}`);
    const pendingRequest = this._pendingRequests.get(id);
    if (pendingRequest?.cancelToken) {
      pendingRequest.cancelToken.cancel();
      this._pendingRequests.delete(id);
      console.log(`Request ${id} cancelled`);
    } else {
      console.log(`Request ${id} not found for cancellation`);
    }
  }
  
  // Send error response back to webview
  private sendErrorResponse(request: any, errorMessage: string) {
    console.error(`Sending error response for ${request.command}:`, errorMessage);
    
    // Try to parse the error message as JSON
    let error: string;
    try {
      // If already JSON, keep it as is
      JSON.parse(errorMessage);
      error = errorMessage;
    } catch {
      // Otherwise, create a simple error object
      error = JSON.stringify({
        message: errorMessage,
        code: 'UNKNOWN_ERROR'
      });
    }
    
    this._webview.postMessage(JSON.stringify({
      id: request.id,
      command: request.command,
      isResponse: true,
      error
    }));
  }
}