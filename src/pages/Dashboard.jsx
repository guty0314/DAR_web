import { useState, useEffect, useRef } from 'react';
import { getEmergencies, getEmergencyResponses } from '../services/api';
import wsService from '../services/websocket';
import EmergencyMap from '../components/Map';
import EmergencyDetail from '../components/EmergencyDetail';
import Logs from './Logs';

const ITEMS_PER_PAGE = 10;
const colorPriority = { rojo: 0, amarillo: 1, violeta: 2 };
const colorLabels = { rojo: '🔴 Rojas', amarillo: '🟡 Amarillas', violeta: '🟣 Violetas' };

export default function Dashboard({ token, onLogout }) {
  const [emergencies, setEmergencies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [page, setPage] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mapKey, setMapKey] = useState(0);
  const [currentView, setCurrentView] = useState('dashboard');
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchEmergencies();
    intervalRef.current = setInterval(fetchEmergencies, 15000);
    wsService.onStatusChange = (status) => setConnected(status);
    wsService.onMessage = (data) => {
      if (data && data.emergency_id) fetchEmergencies();
    };
    wsService.connect(token);
    wsService.startHeartbeat();
    return () => {
      clearInterval(intervalRef.current);
      wsService.disconnect();
    };
  }, []);

  const fetchEmergencies = async () => {
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
  };

  const handleSelect = async (emergency) => {
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

  const filtered = emergencies.filter((e) => {
    if (filter === 'active') return e.active;
    if (filter === 'closed') return !e.active;
    return true;
  });

  const activeCount = emergencies.filter(e => e.active).length;
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const grouped = {};
  paginated.forEach(e => {
    const key = e.color || 'otro';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  });

  const handleFilterChange = (f) => {
    setFilter(f);
    setPage(1);
  };

  return (
    <div style={styles.container}>

      {/* ── Navbar ── */}
      <div style={styles.navbar}>
        <div style={styles.navLogo}>
          <span style={styles.navDA}>DA</span>
          <span style={styles.navR}>R</span>
          <span style={styles.navTitle}>Panel de Monitoreo - 911</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { key: 'dashboard', label: '🗺 Dashboard' },
            { key: 'logs',      label: '📋 Logs' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setCurrentView(tab.key)}
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
          <div style={{ ...styles.statusDot, backgroundColor: connected ? '#43A047' : '#E53935' }} />
          <span style={styles.statusText}>{connected ? 'Conectado' : 'Sin conexión'}</span>
          <button onClick={onLogout} style={styles.logoutBtn}>Cerrar sesión</button>
        </div>
      </div>

      {/* ── Contenido según tab ── */}
      {currentView === 'logs' ? (
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#0A0F1E' }}>
          <Logs />
        </div>
      ) : (
        <div style={styles.body}>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              ...styles.toggleBtn,
              left: sidebarOpen ? '320px' : '0px',
            }}
          >
            {sidebarOpen ? '‹' : '›'}
          </button>

          {sidebarOpen && (
            <div style={styles.sidebar}>
              <div style={styles.filters}>
                {['active', 'closed', 'all'].map((f) => (
                  <button
                    key={f}
                    onClick={() => handleFilterChange(f)}
                    style={{
                      ...styles.filterBtn,
                      backgroundColor: filter === f ? '#2196F3' : 'transparent',
                      color: filter === f ? '#fff' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {f === 'all' ? `Todas (${emergencies.length})` :
                     f === 'active' ? `Activas (${activeCount})` :
                     `Cerradas (${emergencies.filter(e => !e.active).length})`}
                  </button>
                ))}
              </div>

              <div style={styles.list}>
                {loading ? (
                  <div style={styles.centerText}>Cargando...</div>
                ) : filtered.length === 0 ? (
                  <div style={styles.centerText}>No hay emergencias</div>
                ) : (
                  <>
                    {Object.entries(grouped).map(([color, items]) => (
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
                              backgroundColor: e.active ? 'rgba(229,57,53,0.15)' : 'rgba(255,255,255,0.05)',
                              color: e.active ? '#E53935' : 'rgba(255,255,255,0.3)',
                              borderColor: e.active ? 'rgba(229,57,53,0.4)' : 'rgba(255,255,255,0.1)',
                            }}>
                              {e.active ? 'Activa' : 'Cerrada'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}

                    {totalPages > 1 && (
                      <div style={styles.pagination}>
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                          style={{ ...styles.pageBtn, opacity: page === 1 ? 0.3 : 1 }}
                        >‹</button>
                        <span style={styles.pageInfo}>{page} / {totalPages}</span>
                        <button
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          style={{ ...styles.pageBtn, opacity: page === totalPages ? 0.3 : 1 }}
                        >›</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div style={{ flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>
            <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
              <EmergencyMap
                key={mapKey}
                emergencies={filtered}
                selected={selected}
                onSelect={handleSelect}
                getColor={getColor}
                sidebarOpen={sidebarOpen}
                detailOpen={!!detail}
              />
            </div>

            {detail && (
              <EmergencyDetail
                detail={detail}
                getColor={getColor}
                onClose={handleCloseDetail}
              />
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
    return arg.toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
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
  statusDot: { width: '8px', height: '8px', borderRadius: '50%' },
  statusText: { color: 'rgba(255,255,255,0.5)', fontSize: '12px' },
  logoutBtn: { backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' },
  body: { flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' },
  toggleBtn: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 1000, backgroundColor: '#0D1B2A', border: '1px solid rgba(255,255,255,0.15)', borderLeft: 'none', color: 'rgba(255,255,255,0.7)', width: '20px', height: '48px', borderRadius: '0 8px 8px 0', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'left 0.3s' },
  sidebar: { width: '320px', backgroundColor: '#0D1B2A', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  filters: { display: 'flex', padding: '12px', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  filterBtn: { flex: 1, border: 'none', borderRadius: '8px', padding: '6px 4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' },
  list: { flex: 1, overflowY: 'auto', padding: '8px' },
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
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '8px' },
  pageBtn: { backgroundColor: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pageInfo: { color: 'rgba(255,255,255,0.5)', fontSize: '12px' },
};