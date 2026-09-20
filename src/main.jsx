import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { applyApiUrlFromQuery } from './services/api.js';
import './styles/tokens.css';
import './styles/app.css';

// Opening the site with ?api=<backend url> connects it to that backend.
const connectedFromLink = applyApiUrlFromQuery();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App initialNotice={connectedFromLink ? 'Backend URL loaded from the link you opened.' : ''} />
    </ErrorBoundary>
  </React.StrictMode>
);
