import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define the context type
interface DocumentContextType {
  documentContent: string,
  setDocumentContent: (documentContent: string) => void,
}

// Create the context with an empty default value
const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

// Define the provider props type
interface DocumentProviderProps {
  serverUrl: string;
  documentURI: string;
  children: ReactNode;
}

// Provider component
const DocumentProvider: React.FC<DocumentProviderProps> = ({ serverUrl, documentURI, children }) => {
  const [documentContent, setDocumentContent] = useState<string>('');
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(serverUrl);
    setWs(ws);

    ws.onopen = () => {
      // Send message to server to start listening to document updates
      ws.send(JSON.stringify({
        type: 'listen',
        documentURI
      }));
    };

    ws.onmessage = (event) => {
      setDocumentContent(event.data);
    };

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, [documentURI, serverUrl]);

  const handleSetDocument = (documentContent: any) => {
    if (!ws) {return}
    // Send message to server to update the state
    ws.send(JSON.stringify({
      type: 'write',
      documentURI,
      state: documentContent
    }));
  }

  return (
    <DocumentContext.Provider value={{ documentContent, setDocumentContent: handleSetDocument }}>
      {children}
    </DocumentContext.Provider>
  );
};

export { DocumentProvider, DocumentContext };
