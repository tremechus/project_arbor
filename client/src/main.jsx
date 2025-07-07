import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

console.log('[MAIN] Starting React application...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('[MAIN] Root element not found!');
  document.body.innerHTML = '<div style="padding: 20px; color: red; font-family: Arial;">❌ Error: Root element not found. The app cannot start.</div>';
} else {
  console.log('[MAIN] Root element found, creating React root...');
  
  try {
    const root = createRoot(rootElement);
    console.log('[MAIN] React root created, rendering app...');
    
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
    
    console.log('[MAIN] App rendering initiated successfully');
  } catch (error) {
    console.error('[MAIN] Error creating React root:', error);
    document.body.innerHTML = `<div style="padding: 20px; color: red; font-family: Arial;">❌ Error starting app: ${error.message}</div>`;
  }
}
