import React from 'react';
import './ActionBar.css';

export const ActionBar = ({ onLogout }) => {
  return (
    <div className="action-bar-container">
      <button onClick={onLogout} className="logout-button">Logout</button>
    </div>
  );
};
