// src/services/websocket.js

const BASE_WS_URL = 'wss://dar-backend-test.onrender.com';


class WebSocketService {
  constructor() {
    this.ws = null;
    this.onMessage = null;
    this.onStatusChange = null;
    this.reconnectTimer = null;
    this.token = null;
    this._intentionalClose = false;
  }

  connect(token) {
    this.token = token;
    this._intentionalClose = false;
    this._connect();
  }

  _connect() {
    if (this._intentionalClose) return;

    try {
      const ws = new WebSocket(`${BASE_WS_URL}/emergencies/im_on_alert/`);
      this.ws = ws;

      ws.onopen = () => {
        if (this._intentionalClose || this.ws !== ws) { ws.close(); return; }
        console.log('✅ WebSocket conectado');
        // Enviar token dentro del onopen, no antes
        ws.send(this.token);
        if (this.onStatusChange) this.onStatusChange(true);
      };

      ws.onmessage = (event) => {
        // Ignorar "pong" sin intentar parsearlo
        if (event.data === 'pong') return;
        try {
          const data = JSON.parse(event.data);
          if (this.onMessage) this.onMessage(data);
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      ws.onclose = () => {
        console.log('❌ WebSocket desconectado, reconectando...');
        if (this.onStatusChange) this.onStatusChange(false);
        if (!this._intentionalClose) {
          this.reconnectTimer = setTimeout(() => this._connect(), 5000);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };

    } catch (e) {
      console.error('Error conectando WebSocket:', e);
    }
  }

  startHeartbeat() {
    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('ping');
      }
    }, 20000);
  }

  disconnect() {
    this._intentionalClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }
}

export default new WebSocketService();