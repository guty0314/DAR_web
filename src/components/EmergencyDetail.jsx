// src/components/EmergencyDetail.jsx
import { useState, useEffect, useRef } from 'react';
import { ChatWebSocketService } from '../services/chatWebsocket';
import api from '../services/api';

const SERVER_URL = 'https://dar-backend-test.onrender.com';

export default function EmergencyDetail({ detail, getColor, onClose }) {
  const color = getColor(detail.color);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [chatConnected, setChatConnected] = useState(false);
  const [sendingImage, setSendingImage] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const fileInputRef = useRef(null);

  const myUserId = parseInt(localStorage.getItem('user_id') || '0');

  useEffect(() => {
    setMessages([]);
    setChatConnected(false);

    api.get(`/chat/${detail.id}/messages/`)
      .then(r => setMessages(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});

    if (!detail.active) return;

    const ws = new ChatWebSocketService();
    wsRef.current = ws;

    ws.onMessage = (msg) => {
      setMessages(prev =>
        prev.some(m => m.id_message === msg.id_message) ? prev : [...prev, msg]
      );
    };
    ws.onStatusChange = (status) => setChatConnected(status);

    const token = localStorage.getItem('token');
    ws.connect(token, detail.id);

    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, [detail.id, detail.active]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || !chatConnected || !wsRef.current) return;
    wsRef.current.sendMessage(text);
    setDraft('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    setSendingImage(true);
    try {
      const formData = new FormData();
      formData.append('token', token);
      formData.append('file', file);

      const resp = await fetch(
        `${SERVER_URL}/chat/${detail.id}/upload-image/`,
        { method: 'POST', body: formData }
      );

      if (!resp.ok) {
        alert('Error al subir la imagen');
      }
    } catch (e) {
      console.error('Error subiendo imagen:', e);
    } finally {
      setSendingImage(false);
      // Limpiar el input para permitir subir la misma imFagen de nuevo
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      const arg = new Date(d.getTime() - 3 * 60 * 60 * 1000);
      return arg.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  };

  return (
    <div style={styles.container}>
      {/* Lightbox */}
      {lightboxUrl && (
        <div style={styles.lightbox} onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="imagen" style={styles.lightboxImg} />
          <span style={styles.lightboxClose}>✕</span>
        </div>
      )}

      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={{ ...styles.colorDot, backgroundColor: color }} />
          <div>
            <div style={{ ...styles.typeName, color }}>{detail.type_name}</div>
            <div style={styles.category}>
              {detail.color?.charAt(0).toUpperCase() + detail.color?.slice(1)}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={styles.closeBtn}>✕</button>
      </div>

      <div style={styles.body}>

        <div style={{
          ...styles.statusBanner,
          backgroundColor: detail.active ? 'rgba(229,57,53,0.15)' : 'rgba(255,255,255,0.05)',
          borderColor: detail.active ? 'rgba(229,57,53,0.4)' : 'rgba(255,255,255,0.1)',
        }}>
          <span style={{ color: detail.active ? '#E53935' : 'rgba(255,255,255,0.4)', fontWeight: 'bold', fontSize: '13px' }}>
            {detail.active ? '🔴 Emergencia Activa' : '⚫ Emergencia Cerrada'}
          </span>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>👤 Interviniente</div>
          <div style={styles.infoCard}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Nombre</span>
              <span style={styles.infoValue}>{detail.full_name || detail.username || '-'}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Legajo</span>
              <span style={styles.infoValue}>{detail.username || '-'}</span>
            </div>
            {detail.number_phone && (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Teléfono</span>
                <a href={`tel:${detail.number_phone}`} style={{ color: '#43A047', textDecoration: 'none', fontSize: '12px', fontWeight: 'bold' }}>
                  {detail.number_phone}
                </a>
              </div>
            )}
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Fecha</span>
              <span style={styles.infoValue}>{formatDate(detail.date_created)}</span>
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>📍 Ubicación</div>
          <div style={styles.infoCard}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Latitud</span>
              <span style={styles.infoValue}>{detail.latitude}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Longitud</span>
              <span style={styles.infoValue}>{detail.longitude}</span>
            </div>
            <a href={`https://www.google.com/maps/?q=${detail.latitude},${detail.longitude}`}
              target="_blank" rel="noopener noreferrer" style={styles.mapsLink}>
              Ver en Google Maps
            </a>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>🛡️ Agentes que respondieron ({detail.responses?.length || 0})</div>
          {detail.responses?.length === 0 ? (
            <div style={styles.emptyResponses}>Ningún agente respondió aún</div>
          ) : (
            detail.responses?.map((r, i) => (
              <div key={i} style={styles.responseCard}>
                <div style={styles.responseLeft}>
                  <div style={styles.responseAvatar}>
                    {(r.full_name || r.username || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={styles.responseName}>{r.full_name || r.username || '-'}</div>
                    <div style={styles.responseLegajo}>Legajo: {r.username || '-'}</div>
                  </div>
                </div>
                <div style={styles.responseBadges}>
                  {r.accepted && <div style={styles.badgeAccepted}>✓ Aceptó</div>}
                  {r.arrived && <div style={styles.badgeArrived}>📍 Llegó</div>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Chat */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            💬 Chat
            {detail.active ? (
              <span style={{ marginLeft: '8px', fontSize: '10px', color: chatConnected ? '#43A047' : '#E53935', fontWeight: 'normal', textTransform: 'none', letterSpacing: 0 }}>
                ● {chatConnected ? 'Conectado' : 'Desconectado'}
              </span>
            ) : (
              <span style={{ marginLeft: '8px', fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 'normal', textTransform: 'none', letterSpacing: 0 }}>
                (solo lectura)
              </span>
            )}
          </div>

          <div style={styles.chatMessages}>
            {messages.length === 0 ? (
              <div style={styles.chatEmpty}>Sin mensajes</div>
            ) : (
              messages.map((m) => {
                const isOwn = m.id_user === myUserId;
                return (
                  <div key={m.id_message} style={{
                    ...styles.bubble,
                    alignSelf: isOwn ? 'flex-end' : 'flex-start',
                    backgroundColor: isOwn ? '#1D4ED8' : 'rgba(255,255,255,0.06)',
                    borderRadius: isOwn ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                    border: isOwn ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    padding: m.image_url ? '4px' : '8px 11px',
                  }}>
                    {!isOwn && !m.image_url && (
                      <div style={styles.bubbleSender}>{m.sender_name} · {m.sender_role}</div>
                    )}
                    {m.image_url ? (
                      <img
                        src={m.image_url}
                        alt="imagen"
                        style={styles.chatImage}
                        onClick={() => setLightboxUrl(m.image_url)}
                      />
                    ) : (
                      <div style={styles.bubbleText}>{m.message}</div>
                    )}
                    <div style={{ ...styles.bubbleTime, alignSelf: isOwn ? 'flex-end' : 'flex-start', padding: m.image_url ? '0 6px 4px' : '0' }}>
                      {formatTime(m.timestamp)}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {detail.active && (
            <div style={styles.chatInputRow}>
              {/* Input imagen oculto */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />
              {/* Botón imagen */}
              <button
                style={{
                  ...styles.imageBtn,
                  opacity: chatConnected && !sendingImage ? 1 : 0.35,
                  cursor: chatConnected && !sendingImage ? 'pointer' : 'not-allowed',
                }}
                onClick={() => chatConnected && !sendingImage && fileInputRef.current?.click()}
                disabled={!chatConnected || sendingImage}
                title="Enviar imagen"
              >
                {sendingImage ? '⏳' : '🖼'}
              </button>

              <textarea
                style={{
                  ...styles.chatTextarea,
                  opacity: chatConnected ? 1 : 0.4,
                  cursor: chatConnected ? 'text' : 'not-allowed',
                }}
                rows={2}
                placeholder="Escribí un mensaje…"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!chatConnected}
              />
              <button
                style={{
                  ...styles.chatSendBtn,
                  opacity: chatConnected && draft.trim() ? 1 : 0.35,
                  cursor: chatConnected && draft.trim() ? 'pointer' : 'not-allowed',
                }}
                onClick={handleSend}
                disabled={!chatConnected || !draft.trim()}
              >
                ➤
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

const styles = {
  container: { width: '300px', backgroundColor: '#0D1B2A', borderLeft: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' },
  lightbox: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'zoom-out' },
  lightboxImg: { maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px', objectFit: 'contain' },
  lightboxClose: { position: 'absolute', top: '20px', right: '24px', color: '#fff', fontSize: '24px', cursor: 'pointer' },
  header: { padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  colorDot: { width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0 },
  typeName: { fontSize: '15px', fontWeight: 'bold' },
  category: { color: 'rgba(255,255,255,0.4)', fontSize: '11px' },
  closeBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '16px', padding: '4px' },
  body: { flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' },
  statusBanner: { padding: '10px 14px', borderRadius: '10px', border: '1px solid', textAlign: 'center' },
  section: { display: 'flex', flexDirection: 'column', gap: '8px' },
  sectionTitle: { color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center' },
  infoCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { color: 'rgba(255,255,255,0.4)', fontSize: '12px' },
  infoValue: { color: '#ffffff', fontSize: '12px', fontWeight: 'bold', textAlign: 'right', maxWidth: '160px', wordBreak: 'break-word' },
  mapsLink: { color: '#2196F3', fontSize: '12px', textDecoration: 'none', marginTop: '4px' },
  emptyResponses: { color: 'rgba(255,255,255,0.3)', fontSize: '12px', textAlign: 'center', padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '10px' },
  responseCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  responseLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  responseAvatar: { width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#1E3A5F', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', flexShrink: 0 },
  responseName: { color: '#ffffff', fontSize: '12px', fontWeight: 'bold' },
  responseLegajo: { color: 'rgba(255,255,255,0.4)', fontSize: '11px' },
  responseBadges: { display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' },
  badgeAccepted: { backgroundColor: 'rgba(67,160,71,0.2)', border: '1px solid rgba(67,160,71,0.4)', color: '#43A047', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold' },
  badgeArrived: { backgroundColor: 'rgba(33,150,243,0.2)', border: '1px solid rgba(33,150,243,0.4)', color: '#2196F3', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold' },
  chatMessages: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', padding: '10px', minHeight: '160px', maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' },
  chatEmpty: { color: 'rgba(255,255,255,0.25)', fontSize: '12px', textAlign: 'center', marginTop: '50px' },
  bubble: { maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' },
  bubbleSender: { fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginBottom: '2px' },
  bubbleText: { color: '#ffffff', fontSize: '13px', lineHeight: '1.4', wordBreak: 'break-word' },
  bubbleTime: { fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' },
  chatImage: { width: '100%', maxWidth: '220px', borderRadius: '10px', display: 'block', cursor: 'zoom-in', objectFit: 'cover' },
  chatInputRow: { display: 'flex', gap: '6px', alignItems: 'flex-end' },
  imageBtn: { backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '16px', padding: '6px 10px', alignSelf: 'flex-end', transition: 'opacity 0.15s', flexShrink: 0 },
  chatTextarea: { flex: 1, resize: 'none', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#ffffff', fontFamily: 'system-ui, sans-serif', fontSize: '13px', padding: '8px 10px', outline: 'none' },
  chatSendBtn: { backgroundColor: '#1D4ED8', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '16px', padding: '8px 12px', alignSelf: 'flex-end', transition: 'opacity 0.15s' },
};