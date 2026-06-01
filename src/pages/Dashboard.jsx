import { useState, useEffect, useRef, useCallback } from 'react';
import { getEmergencies, getEmergencyResponses } from '../services/api';
import wsService from '../services/websocket';
import EmergencyMap from '../components/Map';
import EmergencyDetail from '../components/EmergencyDetail';
import Logs from './Logs';

const ITEMS_PER_PAGE_CLOSED = 15;
const colorPriority = { rojo: 0, amarillo: 1, violeta: 2 };
const colorLabels = { rojo: '🔴 Rojas', amarillo: '🟡 Amarillas', violeta: '🟣 Violetas' };

export default function Dashboard({ token, onLogout }) {
  const [emergencies, setEmergencies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mapKey, setMapKey] = useState(0);
  const [currentView, setCurrentView] = useState('dashboard');
  const [searchClosed, setSearchClosed] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [alarmPlaying, setAlarmPlaying] = useState(false);

  const intervalRef = useRef(null);
  const alarmRef = useRef(null);
  const alarmPendingRef = useRef(false);
  const seenEmergenciesRef = useRef(new Set());

  // Pedir permiso de notificaciones al montar
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const showNotification = useCallback((data) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const title = `🚨 Nueva emergencia — ${data.type_name || data.emergency_color || 'Emergencia'}`;
    const body = `Agente: ${data.full_name || data.username || 'Desconocido'}`;
    const notif = new Notification(title, {
      body,
      icon: '/favicon.ico',
      requireInteraction: true,
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  }, []);

  const playAlarm = useCallback(() => {
    if (alarmRef.current) return;
    const audio = new Audio('/alarma.mp3');
    audio.volume = 1.0;
    audio.loop = true;
    alarmRef.current = audio;
    setAlarmPlaying(true);
    audio.play().catch(() => {
      alarmPendingRef.current = true;
    });
  }, []);

  const stopAlarm = useCallback(() => {
    alarmPendingRef.current = false;
    if (alarmRef.current) {
      alarmRef.current.pause();
      alarmRef.current.currentTime = 0;
      alarmRef.current = null;
    }
    setAlarmPlaying(false);
  }, []);

  const handleUserInteraction = useCallback(() => {
    if (alarmPendingRef.current && alarmRef.current) {
      alarmRef.current.play().catch(() => {});
      alarmPendingRef.current = false;
    }
  }, []);

  const fetchEmergencies = useCallback(async () => {
    try {
      const data = await getEmergencies();
      data.sort((a, b) => {
        const colorDiff = (colorPriority[a.color] ?? 3) - (colorPriority[b.color] ?? 3);
        if (colorDiff !== 0) return colorDiff;
        return new Date(b.date_created) - new Date(a.date_created);
      });
      setEmergencies(data);
    } catch (e) {
      console.error('Error cargando emergencias:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const playAlarmRef = useRef(playAlarm);
  const fetchEmergenciesRef = useRef(fetchEmergencies);
  const showNotificationRef = useRef(showNotification);
  useEffect(() => {
    playAlarmRef.current = playAlarm;
    fetchEmergenciesRef.current = fetchEmergencies;
    showNotificationRef.current = showNotification;
  });

  useEffect(() => {
    fetchEmergenciesRef.current();
    intervalRef.current = setInterval(() => fetchEmergenciesRef.current(), 15000);
    wsService.onStatusChange = (status) => setConnected(status);
    wsService.onMessage = (data) => {
      if (data && data.emergency_id) {
        const id = data.emergency_id.toString();
        if (!seenEmergenciesRef.current.has(id)) {
          seenEmergenciesRef.current.add(id);
          playAlarmRef.current();
          showNotificationRef.current(data);
        }
        fetchEmergenciesRef.current();
      }
    };
    wsService.connect(token);
    wsService.startHeartbeat();
    return () => {
      clearInterval(intervalRef.current);
      wsService.disconnect();
      if (alarmRef.current) {
        alarmRef.current.pause();
        alarmRef.current = null;
      }
    };
  }, []);

  const handleSelect = async (emergency) => {
    seenEmergenciesRef.current.add(emergency.id.toString());
    stopAlarm();
    setSelected(emergency);
    try {
      const resp = await getEmergencyResponses(emergency.id);
      setDetail({ ...emergency, responses: Array.isArray(resp) ? resp : [] });
    } catch (e) {
      setDetail({ ...emergency, responses: [] });
    }
  };

  const handleCloseDetail = () => {
    setDetail(null);
    setSelected(null);
    setTimeout(() => setMapKey(k => k + 1), 50);
  };

  const getColor = (color) => {
    switch (color) {
      case 'rojo': return '#D62828';
      case 'amarillo': return '#F4B000';
      case 'violeta': return '#BA05F7';
      default: return '#888';
    }
  };

  const activeEmergencies = emergencies.filter(e => e.active);

  const closedEmergencies = emergencies
    .filter(e => !e.active)
    .filter(e => {
      const matchSearch = !searchClosed ||
        e.full_name?.toLowerCase().includes(searchClosed.toLowerCase()) ||
        e.username?.toLowerCase().includes(searchClosed.toLowerCase()) ||
        e.type_name?.toLowerCase().includes(searchClosed.toLowerCase());
      const matchColor = !filterColor || e.color === filterColor;
      return matchSearch && matchColor;
    });

  const activeCount = activeEmergencies.length;
  const closedCount = emergencies.filter(e => !e.active).length;

  const grouped = {};
  activeEmergencies.forEach(e => {
    const key = e.color || 'otro';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  });

  const totalPagesClosed = Math.ceil(closedEmergencies.length / ITEMS_PER_PAGE_CLOSED);
  const paginatedClosed = closedEmergencies.slice((page - 1) * ITEMS_PER_PAGE_CLOSED, page * ITEMS_PER_PAGE_CLOSED);

  const handleViewChange = (view) => {
    setCurrentView(view);
    setPage(1);
    setSearchClosed('');
    setFilterColor('');
    if (view !== 'dashboard') {
      setDetail(null);
      setSelected(null);
    }
  };

  return (
    <div
      style={styles.container}
      onClick={handleUserInteraction}
      onKeyDown={handleUserInteraction}
    >

      {/* ── Navbar ── */}
      <div style={styles.navbar}>
        <div style={styles.navLogo}>
          <span style={styles.navDA}>DA</span>
          <span style={styles.navR}>R</span>
          <span style={styles.navTitle}>Panel de Monitoreo - 911</span>
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { key: 'dashboard', label: '🗺 Dashboard' },
            { key: 'closed',    label: `📁 Historial${closedCount > 0 ? ` (${closedCount})` : ''}` },
            { key: 'logs',      label: '📋 Logs' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => handleViewChange(tab.key)}
              style={{
                background: currentView === tab.key ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: 'none',
                color: currentView === tab.key ? '#fff' : 'rgba(255,255,255,0.4)',
                fontSize: '12px',
                padding: '6px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: currentView === tab.key ? '600' : '400',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={styles.navRight}>
          {activeCount > 0 && (
            <div style={styles.activeBadge}>
              🚨 {activeCount} activa{activeCount !== 1 ? 's' : ''}
            </div>
          )}
          {alarmPlaying && (
            <button onClick={stopAlarm} style={styles.silenceBtn}>
              🔇 Silenciar
            </button>
          )}
          <div style={{ ...styles.statusDot, backgroundColor: connected ? '#43A047' : '#E53935' }} />
          <span style={styles.statusText}>{connected ? 'Conectado' : 'Sin conexión'}</span>
          <button onClick={onLogout} style={styles.logoutBtn}>Cerrar sesión</button>
        </div>
      </div>

      {/* ── Logs ── */}
      {currentView === 'logs' && (
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#0A0F1E' }}>
          <Logs />
        </div>
      )}

      {/* ── Historial de cerradas ── */}
      {currentView === 'closed' && (
        <div style={styles.closedContainer}>
          <div style={styles.closedHeader}>
            <div>
              <div style={styles.closedTitle}>Historial de emergencias</div>
              <div style={styles.closedSubtitle}>{closedEmergencies.length} emergencias cerradas</div>
            </div>
          </div>

          <div style={styles.closedFilters}>
            <input
              style={styles.closedSearch}
              placeholder="Buscar por agente o tipo..."
              value={searchClosed}
              onChange={e => { setSearchClosed(e.target.value); setPage(1); }}
            />
            <select
              style={styles.closedSelect}
              value={filterColor}
              onChange={e => { setFilterColor(e.target.value); setPage(1); }}
            >
              <option value="">Todos los tipos</option>
              <option value="rojo">🔴 Rojas</option>
              <option value="amarillo">🟡 Amarillas</option>
              <option value="violeta">🟣 Violetas</option>
            </select>
          </div>

          <div style={styles.closedList}>
            {loading ? (
              <div style={styles.centerText}>Cargando...</div>
            ) : paginatedClosed.length === 0 ? (
              <div style={styles.centerText}>No hay emergencias cerradas</div>
            ) : (
              paginatedClosed.map(e => (
                <div
                  key={e.id}
                  onClick={() => handleSelect(e)}
                  style={{
                    ...styles.closedCard,
                    borderColor: selected?.id === e.id ? getColor(e.color) : 'rgba(255,255,255,0.08)',
                    backgroundColor: selected?.id === e.id ? 'rgba(255,255,255,0.05)' : '#0D1B2A',
                  }}
                >
                  <div style={{ ...styles.closedColorBar, backgroundColor: getColor(e.color) }} />
                  <div style={styles.closedCardInfo}>
                    <div style={styles.closedCardType}>{e.type_name}</div>
                    <div style={styles.closedCardMeta}>
                      <span>👤 {e.full_name || e.username}</span>
                      <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
                      <span>🕐 {formatDate(e.date_created)}</span>
                    </div>
                  </div>
                  <div style={styles.closedBadge}>⚫ Cerrada</div>
                </div>
              ))
            )}
          </div>

          {totalPagesClosed > 1 && (
            <div style={styles.closedPagination}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ ...styles.pageBtn, opacity: page === 1 ? 0.3 : 1 }}>‹</button>
              <span style={styles.pageInfo}>{page} / {totalPagesClosed}</span>
              <button onClick={() => setPage(p => Math.min(totalPagesClosed, p + 1))} disabled={page === totalPagesClosed}
                style={{ ...styles.pageBtn, opacity: page === totalPagesClosed ? 0.3 : 1 }}>›</button>
            </div>
          )}

          {detail && (
            <div style={styles.closedDetailOverlay}>
              <EmergencyDetail detail={detail} getColor={getColor} onClose={handleCloseDetail} />
            </div>
          )}
        </div>
      )}

      {/* ── Dashboard (solo activas) ── */}
      {currentView === 'dashboard' && (
        <div style={styles.body}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ ...styles.toggleBtn, left: sidebarOpen ? '320px' : '0px' }}
          >
            {sidebarOpen ? '‹' : '›'}
          </button>

          {sidebarOpen && (
            <div style={styles.sidebar}>
              <div style={styles.sidebarHeader}>
                <span style={styles.sidebarTitle}>Emergencias activas</span>
                <span style={styles.sidebarCount}>{activeCount}</span>
              </div>

              <div style={styles.list}>
                {loading ? (
                  <div style={styles.centerText}>Cargando...</div>
                ) : activeEmergencies.length === 0 ? (
                  <div style={styles.emptyActive}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
                    <div>Sin emergencias activas</div>
                  </div>
                ) : (
                  Object.entries(grouped).map(([color, items]) => (
                    <div key={color}>
                      <div style={styles.groupHeader}>
                        <div style={{ ...styles.groupDot, backgroundColor: getColor(color) }} />
                        <span style={styles.groupLabel}>{colorLabels[color] || color}</span>
                        <span style={styles.groupCount}>{items.length}</span>
                      </div>
                      {items.map((e) => (
                        <div
                          key={e.id}
                          onClick={() => handleSelect(e)}
                          style={{
                            ...styles.card,
                            borderColor: selected?.id === e.id ? getColor(e.color) : 'rgba(255,255,255,0.08)',
                            backgroundColor: selected?.id === e.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                          }}
                        >
                          <div style={styles.cardLeft}>
                            <div style={{ ...styles.colorBar, backgroundColor: getColor(e.color) }} />
                            <div style={styles.cardInfo}>
                              <div style={styles.cardType}>{e.type_name}</div>
                              <div style={styles.cardUser}>👤 {e.full_name || e.username}</div>
                              <div style={styles.cardDate}>🕐 {formatDate(e.date_created)}</div>
                            </div>
                          </div>
                          <div style={{
                            ...styles.statusBadge,
                            backgroundColor: 'rgba(229,57,53,0.15)',
                            color: '#E53935',
                            borderColor: 'rgba(229,57,53,0.4)',
                          }}>
                            Activa
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div style={{ flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>
            <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
              <EmergencyMap
                key={mapKey}
                emergencies={activeEmergencies}
                selected={selected}
                onSelect={handleSelect}
                getColor={getColor}
                sidebarOpen={sidebarOpen}
                detailOpen={!!detail}
              />
            </div>
            {detail && (
              <EmergencyDetail detail={detail} getColor={getColor} onClose={handleCloseDetail} />
            )}
          </div>
        </div>
      )}

    </div>
  );
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const arg = new Date(d.getTime() - 3 * 60 * 60 * 1000);
    return arg.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
};

const styles = {
  container: { height: '100vh', backgroundColor: '#0A0F1E', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' },
  navbar: { backgroundColor: '#0D1B2A', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  navLogo: { display: 'flex', alignItems: 'center', gap: '8px' },
  navDA: { color: '#ffffff', fontSize: '28px', fontWeight: 'bold', letterSpacing: '2px' },
  navR: { color: '#E53935', fontSize: '28px', fontWeight: 'bold', letterSpacing: '2px' },
  navTitle: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginLeft: '8px' },
  navRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  activeBadge: { backgroundColor: 'rgba(229,57,53,0.15)', border: '1px solid rgba(229,57,53,0.4)', color: '#E53935', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' },
  silenceBtn: { backgroundColor: 'rgba(229,57,53,0.2)', border: '1px solid rgba(229,57,53,0.4)', color: '#E53935', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  statusDot: { width: '8px', height: '8px', borderRadius: '50%' },
  statusText: { color: 'rgba(255,255,255,0.5)', fontSize: '12px' },
  logoutBtn: { backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' },
  body: { flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' },
  toggleBtn: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 1000, backgroundColor: '#0D1B2A', border: '1px solid rgba(255,255,255,0.15)', borderLeft: 'none', color: 'rgba(255,255,255,0.7)', width: '20px', height: '48px', borderRadius: '0 8px 8px 0', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'left 0.3s' },
  sidebar: { width: '320px', backgroundColor: '#0D1B2A', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  sidebarHeader: { padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sidebarTitle: { color: '#fff', fontSize: '13px', fontWeight: '600' },
  sidebarCount: { backgroundColor: 'rgba(229,57,53,0.2)', border: '1px solid rgba(229,57,53,0.4)', color: '#E53935', padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' },
  list: { flex: 1, overflowY: 'auto', padding: '8px' },
  emptyActive: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '40px 20px', fontSize: '13px' },
  centerText: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '40px', fontSize: '13px' },
  groupHeader: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 4px 6px', marginTop: '8px' },
  groupDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  groupLabel: { color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', flex: 1 },
  groupCount: { backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', padding: '1px 7px', borderRadius: '10px', fontSize: '11px' },
  card: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '10px', border: '1px solid', marginBottom: '6px', cursor: 'pointer', transition: 'all 0.2s' },
  cardLeft: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1 },
  colorBar: { width: '4px', height: '44px', borderRadius: '4px', flexShrink: 0 },
  cardInfo: { display: 'flex', flexDirection: 'column', gap: '3px' },
  cardType: { color: '#ffffff', fontSize: '13px', fontWeight: 'bold' },
  cardUser: { color: 'rgba(255,255,255,0.5)', fontSize: '11px' },
  cardDate: { color: 'rgba(255,255,255,0.3)', fontSize: '11px' },
  statusBadge: { padding: '3px 8px', borderRadius: '8px', border: '1px solid', fontSize: '10px', fontWeight: 'bold', flexShrink: 0 },
  closedContainer: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' },
  closedHeader: { padding: '20px 24px 0', flexShrink: 0 },
  closedTitle: { fontSize: '16px', fontWeight: '600', color: '#fff' },
  closedSubtitle: { fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' },
  closedFilters: { display: 'flex', gap: '10px', padding: '16px 24px', flexShrink: 0 },
  closedSearch: { flex: 1, background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', padding: '8px 12px', outline: 'none' },
  closedSelect: { background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', padding: '8px 12px', outline: 'none' },
  closedList: { flex: 1, overflowY: 'auto', padding: '0 24px' },
  closedCard: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', border: '1px solid', marginBottom: '8px', cursor: 'pointer', transition: 'all 0.2s' },
  closedColorBar: { width: '4px', height: '44px', borderRadius: '4px', flexShrink: 0 },
  closedCardInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' },
  closedCardType: { color: '#ffffff', fontSize: '13px', fontWeight: 'bold' },
  closedCardMeta: { display: 'flex', gap: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '11px' },
  closedBadge: { color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: 'bold', flexShrink: 0 },
  closedPagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 },
  closedDetailOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 100 },
  pageBtn: { backgroundColor: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pageInfo: { color: 'rgba(255,255,255,0.5)', fontSize: '12px' },
};