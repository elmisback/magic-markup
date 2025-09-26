import React from 'react';
import { toolNames } from './tools';

interface AddAnnotationBannerProps {
  selectedTool: string | undefined;
  setSelectedTool: (tool: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  toolTypes: {
    [key: string]: React.FC<any>;
  };
}

const AddAnnotationBanner: React.FC<AddAnnotationBannerProps> = ({
  selectedTool,
  setSelectedTool,
  onConfirm,
  onCancel,
  toolTypes
}) => {
  return (
    <div className="add-note-banner">
      <div className="add-note-content">
        <div className="add-note-header">
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{ marginRight: '8px' }}
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span style={{ fontWeight: 'bold' }}>Add Annotation</span>
        </div>
        
        <div className="add-note-form">
          <label htmlFor="annotation-type-select">Annotation Type</label>
          <select
            id="annotation-type-select"
            value={selectedTool || ''}
            onChange={(e) => setSelectedTool(e.target.value)}
            className="annotation-type-select"
          >
            {Object.keys(toolTypes).map((toolKey) => (
              <option key={toolKey} value={toolKey}>
                {toolNames[toolKey as keyof typeof toolNames]}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="add-note-actions">
        <button
          onClick={onCancel}
          className="secondary"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="primary"
        >
          Add Note
        </button>
      </div>
    </div>
  );
};

export default AddAnnotationBanner;