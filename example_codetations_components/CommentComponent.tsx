import React from 'react';

/**
 * A simple comment component that renders markdown-formatted text
 */
export default function CommentComponent({ text, color = "#ffcc00" }) {
  const style = {
    padding: '8px 12px',
    backgroundColor: color,
    borderRadius: '4px',
    maxWidth: '400px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    lineHeight: '1.5',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  return (
    <div style={style}>
      {text || "Add your comment here"}
    </div>
  );
}