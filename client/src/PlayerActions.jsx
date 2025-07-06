import React from 'react';
import './PlayerActions.css';

export const PlayerActions = ({ selectedAction, onActionSelect }) => {
  const actions = ['till', 'drop_food'];

  return (
    <div className="player-actions-container">
      {actions.map(action => (
        <button
          key={action}
          className={`action-button ${selectedAction === action ? 'selected' : ''}`}
          onClick={() => onActionSelect(action)}
          title={action.replace('_', ' ')}
        >
          {/* You can replace these with icons later */}
          {action.charAt(0).toUpperCase()}
        </button>
      ))}
    </div>
  );
};
