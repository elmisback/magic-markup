import React from 'react';
import { toolNames } from './tools';

interface AnnotationTileProps {
  annotation: any;
  selected: boolean;
  isOutOfSync: boolean;
  documentText: string;
  onClick: () => void;
  onDelete: (id: string, event: React.MouseEvent) => void;
  children: React.ReactNode;
}

const AnnotationTile: React.FC<AnnotationTileProps> = ({
  annotation,
  selected,
  isOutOfSync,
  documentText,
  onClick,
  onDelete,
  children
}) => {
  const lineNumber = documentText
    .slice(0, annotation.start)
    .split('\n')
    .length;
    
  const colorStyle = {
    borderLeft: annotation.metadata?.color
      ? `5px solid ${annotation.metadata.color}`
      : '5px solid rgba(255,255,0,0.3)',
  };

  return (
    <div
      className={`annotation-tile ${selected ? 'selected' : ''}`}
      style={colorStyle}
      onClick={onClick}
    >
      <div className="annotation-info">
        <div className="line-number">
          Line {lineNumber}
        </div>
        {annotation.tool && (
          <div className="annotation-type">
            {toolNames[annotation.tool as keyof typeof toolNames]}
          </div>
        )}
        {isOutOfSync && (
          <div className="needs-retag-indicator">
            Needs Update
          </div>
        )}
        <button 
          className="delete-button"
          onClick={(e) => onDelete(annotation.id, e)}
          title="Delete Annotation"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      </div>
      <div className="annotation-content">
        {children}
      </div>
    </div>
  );
};

export default AnnotationTile;