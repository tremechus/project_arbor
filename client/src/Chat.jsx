import { useState } from 'react';
import './Chat.css'; // We'll create this file for styling

export const Chat = ({ ws }) => {
  const [message, setMessage] = useState('');

  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'player_chat',
        text: message.trim()
      }));
      setMessage(''); // Clear the input after sending
    }
  };

  return (
    <div className="chat-container">
      <form onSubmit={sendMessage}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Say something..."
          maxLength="50"
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};
