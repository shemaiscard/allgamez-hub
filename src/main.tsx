import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

try {
  registerSW({ immediate: true });
} catch {
  // Service worker registration skipped in unsupported environments
}

createRoot(document.getElementById('root')!).render(<App />);
