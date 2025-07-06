import { useEffect, useRef, useState } from 'react';
import './App.css';
import { Game } from './Game';
import { Chat } from './Chat';
import { Login } from './Login';
import { ActionBar } from './ActionBar';
import { PlayerActions } from './PlayerActions';
import { DisconnectedOverlay } from './DisconnectedOverlay';
import './Chat.css';
import './Login.css';
import './ActionBar.css';
import './PlayerActions.css';
import './Disconnected.css';

const MAX_RECONNECT_ATTEMPTS = 3;

function App() {
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('playerName') || null);
  const [selectedAction, setSelectedAction] = useState('till');
  const [isPermanentlyDisconnected, setIsPermanentlyDisconnected] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const ws = useRef(null);
  const reconnectAttempts = useRef(0);

  const connect = () => {
    if (!playerName || ws.current) return;

    const serverIpAddress = '192.168.1.128';
    const wsUrl = `ws://${serverIpAddress}:8000/ws`;
    console.log(`[CLIENT] Attempting to connect to ${wsUrl}...`);
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('[CLIENT] WebSocket connection opened.');
      ws.current.send(JSON.stringify({ type: 'player_join_request', name: playerName }));
      console.log('[CLIENT] Sent player_join_request.');
    };

    ws.current.onmessage = (event) => {
        console.log('[CLIENT] Received raw message:', event.data);
        const message = JSON.parse(event.data);
        
        if (message.type === 'join_success') {
            console.log("[CLIENT] Join successful!");
            setIsLoggedIn(true);
            reconnectAttempts.current = 0;
            setIsPermanentlyDisconnected(false);
        } else if (message.type === 'error' && message.reason === 'name_taken') {
            alert('That name is already in use. Please choose another.');
            handleLogout();
        }
    };

    ws.current.onclose = (event) => {
      console.log(`[CLIENT] WebSocket disconnected. Clean: ${event.wasClean}, Code: ${event.code}, Reason: ${event.reason}`);
      ws.current = null;
      if (isLoggedIn) {
        setIsLoggedIn(false);
        handleReconnect();
      }
    };

    ws.current.onerror = (error) => {
      console.error('[CLIENT] WebSocket Error:', error);
    };
  };

  const handleReconnect = () => {
    if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts.current++;
      console.log(`[CLIENT] Reconnection attempt #${reconnectAttempts.current} in 3 seconds...`);
      setTimeout(() => {
        connect();
      }, 3000);
    } else {
      console.log('[CLIENT] Max reconnection attempts reached.');
      setIsPermanentlyDisconnected(true);
    }
  };

  useEffect(() => {
    if (playerName) {
      console.log('[CLIENT] Player name set. Initiating connection.');
      localStorage.setItem('playerName', playerName);
      connect();
    }
    return () => {
        if (ws.current) {
            console.log('[CLIENT] App unmounting. Closing WebSocket.');
            ws.current.onclose = null;
            ws.current.close();
        }
    }
  }, [playerName]);

  const handleLogout = () => {
    console.log('[CLIENT] Logging out.');
    setIsLoggedIn(false);
    localStorage.removeItem('playerName');
    if (ws.current) {
      ws.current.onclose = null;
      ws.current.close();
      ws.current = null;
    }
    setPlayerName(null);
    reconnectAttempts.current = 0;
    setIsPermanentlyDisconnected(false);
  };

  const renderContent = () => {
    if (isPermanentlyDisconnected) {
      return <DisconnectedOverlay />;
    }
    if (!playerName) {
      return <Login onNameSubmit={setPlayerName} />;
    }
    return (
      <>
        <ActionBar onLogout={handleLogout} />
        <PlayerActions selectedAction={selectedAction} onActionSelect={setSelectedAction} />
        <Game ws={ws} selectedAction={selectedAction} />
        <Chat ws={ws} />
      </>
    );
  };

  return (
    <div className="App">
      {renderContent()}
    </div>
  );
}

export default App;
