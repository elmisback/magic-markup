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
      
      const [model] = await vscode.lm.selectChatModels(modelOptions);
      if (!model) {
        this.sendErrorResponse(message, JSON.stringify({
          message: 'No suitable language model found',
          code: 'MODEL_NOT_FOUND'
        }));
        return;
      }
      
      // Create cancel token
      const cancelTokenSource = new vscode.CancellationTokenSource();
      
      // Store for potential cancellation
      this._pendingRequests.set(message.id, {
        cancelToken: cancelTokenSource
      });
      
      // Check if this is a streaming request
      if (message.data.options?.stream) {
        // Create a progress callback for streaming
        const handleProgress = (progress: any) => {
          // Send chunk to webview
          this._webview.postMessage(JSON.stringify({
            id: message.id,
            command: message.command,
            chunk: {
              content: progress.content,
              isComplete: false
            }
          }));
        };
        
        // Send the streaming request
        try {
          const result = await model.sendRequest(
            message.data.messages,
            { ...message.data.options, onProgress: handleProgress },
            cancelTokenSource.token
          );
          
          // Send the final complete message
          this._webview.postMessage(JSON.stringify({
            id: message.id,
            command: message.command,
            chunk: {
              content: '',
              isComplete: true
            },
            payload: { result }
          }));
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          this.sendErrorResponse(message, `Streaming error: ${errorMessage}`);
        }
      } else {
        // Send non-streaming request
        const result = await model.sendRequest(
          message.data.messages,
          message.data.options || {},
          cancelTokenSource.token
        );
        
        this._webview.postMessage(JSON.stringify({
          id: message.id,
          command: message.command,
          isResponse: true,
          payload: { result }
        }));
      }
      
      // Clean up after request is complete
      this._pendingRequests.delete(message.id);
    } catch (error) {
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
    const pendingRequest = this._pendingRequests.get(id);
    if (pendingRequest?.cancelToken) {
      pendingRequest.cancelToken.cancel();
      this._pendingRequests.delete(id);
    }
  }
  
  // Send error response back to webview
  private sendErrorResponse(request: any, errorMessage: string) {
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
    
    // Also log the error to the extension console
    console.error(`Error in request ${request.command}:`, errorMessage);
  }
}