import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

const toastStyle = {
  fontSize: '13px',
  padding: '10px 12px',
  borderRadius: '8px',
  background: '#1b1a16',
  color: '#f5f2ea',
  border: '1px solid #2c2a24',
  boxShadow: '0 8px 24px rgba(27, 26, 22, 0.16)',
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: toastStyle,
            success: { iconTheme: { primary: '#2f6b4a', secondary: '#f5f2ea' } },
            error: { iconTheme: { primary: '#9c3323', secondary: '#f5f2ea' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
