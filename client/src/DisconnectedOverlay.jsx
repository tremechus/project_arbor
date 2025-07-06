import React from 'react';
import './Disconnected.css';

export const DisconnectedOverlay = () => {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="disconnected-overlay">
      <div className="disconnected-container">
        <h1>Connection Lost</h1>
        <p>Could not reconnect to the server.</p>
        <button onClick={handleReload}>Reload Page</button>
      </div>
    </div>
  );
};
