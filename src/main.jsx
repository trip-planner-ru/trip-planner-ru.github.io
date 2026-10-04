import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { TripProvider } from './context/TripContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TripProvider>
      <App />
    </TripProvider>
  </StrictMode>,
);
