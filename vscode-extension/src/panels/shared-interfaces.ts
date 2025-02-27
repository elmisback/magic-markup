// shared-interfaces.ts

// Message interfaces
export interface Message {
  id?: string;
  command: string;
  data?: any;
}

export interface ResponseMessage extends Message {
  isResponse: true;
  error?: string;
  payload?: any;
}

export interface StreamChunkMessage extends Message {
  chunk: {
    content?: string;
    isComplete: boolean;
  }
}

// LM API specific interfaces
export interface LMChatRequestData {
  messages: Array<{
    role: string;
    content: string;
  }>;
  options?: {
    maxTokens?: number;
    temperature?: number;
    stopSequences?: string[];
    stream?: boolean;
    vendor?: string;
    family?: string;
  };
}

export interface LMChatRequest extends Message {
  command: 'lm.chat';
  data: LMChatRequestData;
}

export interface LMCancelRequest extends Message {
  command: 'lm.cancelRequest';
  id: string;
}

// Other message types specific to your application
export interface ShowAnnotationsRequest extends Message {
  command: 'showAnnotations';
  data: {
    annotations: Array<{
      start: number;
      end: number;
      metadata: {
        color: string;
      }
    }>;
  };
}

export interface HideAnnotationsRequest extends Message {
  command: 'hideAnnotations';
}

// ... add more message interfaces specific to your application