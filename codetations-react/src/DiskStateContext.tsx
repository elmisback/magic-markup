import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import Annotation from './Annotation';

interface DiskState {
  annotations: Annotation[];
}

// Define the context type
interface DiskStateContextType {
  diskState: DiskState | undefined;
  setDiskState: (newState: any) => void;
}

// Create the context with an empty default value
const DiskStateContext = createContext<DiskStateContextType | undefined>(undefined);

// Define the provider props type
interface DiskStateProviderProps {
  serverUrl: string;
  stateURI: string;
  children: ReactNode;
}

// Provider component
const DiskStateProvider: React.FC<DiskStateProviderProps> = ({ serverUrl, stateURI: documentURI, children }) => {
  const [diskState, setDiskState] = useState<DiskState>();
  const [ws, setWs] = useState<WebSocket>();

  useEffect(() => {
    const ws = new WebSocket(serverUrl);
    setWs(ws)

    ws.onopen = () => {
      // Send message to server to start listening to document updates
      ws.send(JSON.stringify({
        type: 'listen',
        documentURI
      }));
    };

    ws.onmessage = (event) => {
      try {
        const state = JSON.parse(event.data);
        setDiskState(state);
      } catch (error) {
        console.error('Error parsing JSON: ', error);
      };
    }

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, [serverUrl]);

  const handleSetDiskState = (newState: any) => {
    if (!ws) {return}
    // Send message to server to update the state
    ws.send(JSON.stringify({
      type: 'write',
      documentURI,
      state: JSON.stringify(newState, undefined, 2)
    }));
  }

  return (
    <DiskStateContext.Provider value={{ diskState: diskState, setDiskState: handleSetDiskState }}>
      {children}
    </DiskStateContext.Provider>
  );
};

export { DiskStateProvider, DiskStateContext };
