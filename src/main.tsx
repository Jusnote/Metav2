import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Conectar ao servidor de ferramentas do navegador
const socket = new WebSocket('ws://localhost:3025');

socket.onopen = () => {
  console.log('🔗 Conectado ao servidor de ferramentas do navegador');
};

socket.onerror = (error) => {
  console.error('❌ Erro na conexão com o servidor de ferramentas:', error);
};

createRoot(document.getElementById("root")!).render(<App />);
