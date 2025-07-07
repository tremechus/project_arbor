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
  console.log('[APP] App component initializing...');
  
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('playerName') || null);
  const [selectedAction, setSelectedAction] = useState('till');
  const [isPermanentlyDisconnected, setIsPermanentlyDisconnected] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const ws = useRef(null);
  const messageQueue = useRef([]); // Create the message queue here
  const reconnectAttempts = useRef(0);
  const isMounted = useRef(true);

  // Debug logging
  useEffect(() => {
    console.log('[APP] App component mounted successfully');
    console.log('[APP] Initial state:', {
      playerName,
      selectedAction,
      isLoggedIn,
      isConnecting,
      isPermanentlyDisconnected
    });
  }, []);

  const connect = () => {
    if (!playerName || isConnecting) return;
    
    setIsConnecting(true);
    
    // Close existing connection if any
    if (ws.current) {
      ws.current.onclose = null;
      ws.current.close();
      ws.current = null;
    }

    const serverIpAddress = '192.168.1.128';
    const wsUrl = `ws://${serverIpAddress}:8000/ws`;
    console.log(`[CLIENT] Attempting to connect to ${wsUrl}...`);
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('[CLIENT] WebSocket connection opened.');
      if (isMounted.current) {
        setIsConnecting(false);
      }
      // Send join request immediately after connection opens
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        // Add a small delay to ensure the connection is fully established
        setTimeout(() => {
          if (ws.current && ws.current.readyState === WebSocket.OPEN && isMounted.current) {
            console.log('[CLIENT] Sending join request...');
            ws.current.send(JSON.stringify({ type: 'player_join_request', name: playerName }));
          }
        }, 50);
      }
    };

    // The message handler is now defined here, in the same scope as the WebSocket
    ws.current.onmessage = (event) => {
        if (!isMounted.current) return;
        
        const message = JSON.parse(event.data);
        console.log('[CLIENT] Received message:', message.type, message);
        
        if (message.type === 'join_success') {
            setIsLoggedIn(true);
            reconnectAttempts.current = 0;
            setIsPermanentlyDisconnected(false);
        }
        if (message.type === 'error' && message.reason === 'name_taken') {
            alert('That name is already in use. Please choose another.');
            handleLogout();
            return;
        }
        
        // Push all game-related messages to the queue
        messageQueue.current.push(message);
    };

    ws.current.onclose = (event) => {
      console.log('[CLIENT] WebSocket disconnected.', { code: event.code, reason: event.reason, wasClean: event.wasClean });
      if (isMounted.current) {
        setIsConnecting(false);
        ws.current = null;
        if (isLoggedIn && event.code !== 1000) {
          setIsLoggedIn(false);
          handleReconnect();
        }
      }
    };

    ws.current.onerror = (error) => {
      console.error('[CLIENT] WebSocket Error:', error);
      console.log('[CLIENT] WebSocket readyState:', ws.current?.readyState);
      if (isMounted.current) {
        setIsConnecting(false);
        // Only attempt reconnection if we're not in cleanup mode and actually logged in
        if (isLoggedIn && ws.current) {
          handleReconnect();
        }
      }
    };
  };

  const handleReconnect = () => {
    if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS && !isConnecting) {
      reconnectAttempts.current++;
      console.log(`[CLIENT] Reconnect attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS}`);
      setTimeout(() => {
        connect();
      }, 3000);
    } else {
      setIsPermanentlyDisconnected(true);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    if (playerName && !isConnecting && !ws.current) {
      localStorage.setItem('playerName', playerName);
      connect();
    }
    return () => {
        isMounted.current = false;
        if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
            console.log('[CLIENT] Cleanup: Closing WebSocket connection');
            ws.current.onclose = null;
            ws.current.onerror = null;
            ws.current.onopen = null;
            ws.current.onmessage = null;
            ws.current.close();
            ws.current = null;
        }
    }
  }, [playerName]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setIsConnecting(false);
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
        <Game 
            ws={ws} 
            selectedAction={selectedAction}
            messageQueue={messageQueue} // Pass the queue to the game
        />
        <Chat ws={ws} />
      </>
    );
  };

  return (
    <div className="App">
      {/* Debug info for production deployment */}
      <div style={{ position: 'fixed', top: 0, right: 0, background: 'rgba(0,0,0,0.8)', color: 'white', padding: '5px', fontSize: '10px', zIndex: 9999 }}>
        App Loaded ✅ | Player: {playerName || 'None'} | Connected: {isLoggedIn ? 'Yes' : 'No'}
      </div>
      {renderContent()}
    </div>
  );
}

export default App;
