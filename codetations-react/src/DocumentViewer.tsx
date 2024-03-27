import React, { useState, useEffect } from 'react';

// Define the props type
interface DocumentViewerProps {
  serverUrl: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ serverUrl }) => {
  const [documentContent, setDocumentContent] = useState<string>('');

  useEffect(() => {
    // Establish the WebSocket connection
    const ws = new WebSocket(serverUrl);

    ws.onopen = () => {
      console.log("Connected to the WebSocket server.");
      // Send a message to start listening to the document updates
      ws.send(JSON.stringify({
        type: 'listen',
        documentURI: 'temp/sample.txt'
      }));
    };

    ws.onmessage = (event) => {
      console.log("Received document update.");
      setDocumentContent(event.data);
    };

    ws.onerror = (error: Event) => {
      console.error("WebSocket error: ", error);
    };

    return () => {
      ws.close();
      console.log("Disconnected from the WebSocket server.");
    };
  }, [serverUrl]); // Re-run the effect only if the serverUrl changes

  return (
    <div>
      <h3>Document Contents:</h3>
      <pre>{documentContent}</pre>
    </div>
  );
};

export default DocumentViewer;
