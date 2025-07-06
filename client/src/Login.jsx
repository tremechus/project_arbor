import { useState } from 'react';
import './Login.css';

export const Login = ({ onNameSubmit }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const validChars = /^[a-zA-Z0-9+\-!_.]+$/;
    
    if (name.length === 0) {
      setError('Please enter a name.');
      return;
    }
    if (name.length > 8) {
      setError('Name cannot be longer than 8 characters.');
      return;
    }
    if (!validChars.test(name)) {
      setError('Name contains invalid characters.');
      return;
    }

    setError('');
    onNameSubmit(name);
  };

  return (
    <div className="login-overlay">
      <div className="login-container">
        <h1>Welcome to Project Arbor</h1>
        <p>Please choose your name.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Player Name"
            autoFocus
          />
          <button type="submit">Enter World</button>
          {error && <p className="error-message">{error}</p>}
        </form>
      </div>
    </div>
  );
};
