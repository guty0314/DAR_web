// src/services/chatWebsocket.js

const BASE_WS_URL = 'wss://dar-backend-test.onrender.com';
export class ChatWebSocketService {
  constructor() {
    this.ws = null;
    this.onMessage = null;
    this.onStatusChange = null;
    this.reconnectTimer = null;
    this.token = null;
    this.emergencyId = null;
    this._closed = false;
  }

  connect(token, emergencyId) {
    this._closed = false;
    this.token = token;
    this.emergencyId = emergencyId;
    this._connect();
  }

  _connect() {
    if (this._closed) return;

    try {
      const ws = new WebSocket(
        `${BASE_WS_URL}/chat/ws/${this.emergencyId}/`
      );
      this.ws = ws;

      ws.onopen = () => {
        if (this._closed || this.ws !== ws) { ws.close(); return; }
        console.log(`✅ Chat WS conectado — emergencia #${this.emergencyId}`);
        ws.send(JSON.stringify({ token: this.token }));
        if (this.onStatusChange) this.onStatusChange(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.id_message && this.onMessage) this.onMessage(data);
        } catch (e) {}
      };

      ws.onclose = () => {
        if (this.onStatusChange) this.onStatusChange(false);
        if (!this._closed) {
          this.reconnectTimer = setTimeout(() => this._connect(), 5000);
        }
      };

      ws.onerror = () => {};

    } catch (e) {
      console.error('Error conectando Chat WS:', e);
    }
  }

  sendMessage(text) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !text?.trim()) return;
    this.ws.send(JSON.stringify({ message: text.trim() }));
  }

  disconnect() {
    this._closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }
}
export default ChatWebSocketService;