import React from 'react';

export default function NotebookPlaceholder({ title, description }) {
  return (
    <div className="notebook-placeholder">
      <p className="notebook-kicker">Coming next</p>
      <h3 className="notebook-placeholder-title">{title}</h3>
      <p className="notebook-placeholder-copy">{description}</p>
    </div>
  );
}