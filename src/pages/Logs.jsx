// src/pages/Logs.jsx
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const ACTION_COLORS = {
  login:                { bg: 'rgba(33,150,243,0.15)',  color: '#64B5F6', border: 'rgba(33,150,243,0.3)',  label: 'login' },
  logout:               { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: 'rgba(255,255,255,0.1)', label: 'logout' },
  emergency_sent:       { bg: 'rgba(229,57,53,0.15)',   color: '#EF9A9A', border: 'rgba(229,57,53,0.3)',   label: 'emergencia enviada' },
  emergency_accepted:   { bg: 'rgba(67,160,71,0.15)',   color: '#81C784', border: 'rgba(67,160,71,0.3)',   label: 'aceptó' },
  emergency_arrived:    { bg: 'rgba(186,5,247,0.15)',   color: '#CE93D8', border: 'rgba(186,5,247,0.3)',   label: 'llegó' },
  emergency_cancelled:  { bg: 'rgba(255,152,0,0.15)',   color: '#FFB74D', border: 'rgba(255,152,0,0.3)',   label: 'canceló' },
};

const ITEMS_PER_PAGE = 15;

const formatDate = (ts) => {
  if (!ts) return '-';
  try {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return 'Hoy ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ts; }
};

const getInitials = (fullName, username) => {
  if (fullName) {
    const parts = fullName.trim().split(' ');
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }
  return (username?.[0] || '?').toUpperCase();
};

const avatarColors = ['#1E3A5F', '#1B4332', '#4A1942', '#1A237E', '#4E342E'];
const getAvatarColor = (username) => {
  let hash = 0;
  for (let i = 0; i < (username?.length || 0); i++) hash += username.charCodeAt(i);
  return avatarColors[hash % avatarColors.length];
};

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await api.get('/admin/activity-logs?limit=500');
      setLogs(Array.isArray(resp.data) ? resp.data : []);
    } catch (e) {
      console.error('Error cargando logs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Filtros
  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      l.username?.toLowerCase().includes(search.toLowerCase()) ||
      l.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.detail?.toLowerCase().includes(search.toLowerCase());
    const matchAction = !actionFilter || l.action === actionFilter;
    const matchDate = !dateFilter || l.timestamp?.startsWith(dateFilter);
    return matchSearch && matchAction && matchDate;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Métricas
  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = logs.filter(l => l.timestamp?.startsWith(today));
  const emergenciasHoy = todayLogs.filter(l => l.action === 'emergency_sent').length;
  const loginsHoy = todayLogs.filter(l => l.action === 'login').length;
  const usuariosActivos = [...new Set(todayLogs.map(l => l.username))].length;

  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  const exportCSV = () => {
    const headers = ['Usuario', 'Nombre', 'Acción', 'Detalle', 'Fecha'];
    const rows = filtered.map(l => [
      l.username, l.full_name, l.action, l.detail, l.timestamp
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${today}.csv`;
    a.click();
  };

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.title}>Logs de actividad</div>
          <div style={s.subtitle}>Historial de acciones del sistema</div>
        </div>
        <button onClick={exportCSV} style={s.exportBtn}>
          Exportar CSV
        </button>
      </div>

      {/* Métricas */}
      <div style={s.stats}>
        {[
          { label: 'Total logs', value: logs.length, color: '#fff' },
          { label: 'Emergencias hoy', value: emergenciasHoy, color: '#EF9A9A' },
          { label: 'Logins hoy', value: loginsHoy, color: '#64B5F6' },
          { label: 'Usuarios activos hoy', value: usuariosActivos, color: '#81C784' },
        ].map((m, i) => (
          <div key={i} style={s.statCard}>
            <div style={s.statLabel}>{m.label}</div>
            <div style={{ ...s.statValue, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={s.filters}>
        <input
          style={{ ...s.input, flex: 1, minWidth: '160px' }}
          placeholder="Buscar por usuario o detalle..."
          value={search}
          onChange={handleFilterChange(setSearch)}
        />
        <select style={s.select} value={actionFilter} onChange={handleFilterChange(setActionFilter)}>
          <option value="">Todas las acciones</option>
          {Object.keys(ACTION_COLORS).map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <input
          style={s.input}
          type="date"
          value={dateFilter}
          onChange={handleFilterChange(setDateFilter)}
        />
        {(search || actionFilter || dateFilter) && (
          <button
            style={s.clearBtn}
            onClick={() => { setSearch(''); setActionFilter(''); setDateFilter(''); setPage(1); }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div style={s.tableWrap}>
        {loading ? (
          <div style={s.center}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={s.center}>No hay logs que coincidan</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {['Usuario', 'Acción', 'Detalle', 'Fecha y hora'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((l, i) => {
                const ac = ACTION_COLORS[l.action] || { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: 'rgba(255,255,255,0.1)', label: l.action };
                return (
                  <tr key={l.id_log ?? i} style={s.tr}>
                    <td style={s.td}>
                      <div style={s.userCell}>
                        <div style={{ ...s.avatar, background: getAvatarColor(l.username) }}>
                          {getInitials(l.full_name, l.username)}
                        </div>
                        <div>
                          <div style={s.userName}>{l.full_name || l.username || '-'}</div>
                          <div style={s.userLeg}>{l.username}</div>
                        </div>
                      </div>
                    </td>
                    <td style={s.td}>
                      <span style={{
                        ...s.badge,
                        background: ac.bg,
                        color: ac.color,
                        border: `1px solid ${ac.border}`,
                      }}>
                        {ac.label}
                      </span>
                    </td>
                    <td style={{ ...s.td, color: 'rgba(255,255,255,0.5)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.detail || '-'}
                    </td>
                    <td style={{ ...s.td, color: 'rgba(255,255,255,0.35)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {formatDate(l.timestamp)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div style={s.pagination}>
            <button
              style={{ ...s.pageBtn, opacity: page === 1 ? 0.3 : 1 }}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >‹</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  style={{ ...s.pageBtn, ...(page === p ? s.pageBtnActive : {}) }}
                  onClick={() => setPage(p)}
                >{p}</button>
              );
            })}
            {totalPages > 5 && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>... {totalPages} págs</span>}
            <button
              style={{ ...s.pageBtn, opacity: page === totalPages ? 0.3 : 1 }}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >›</button>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  container: { padding: '20px', color: '#fff', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' },
  title: { fontSize: '16px', fontWeight: '500', color: '#fff' },
  subtitle: { fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' },
  exportBtn: { background: '#1D4ED8', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' },
  statCard: { background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px 14px' },
  statLabel: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' },
  statValue: { fontSize: '20px', fontWeight: '500' },
  filters: { display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' },
  input: { background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', padding: '7px 12px', outline: 'none' },
  select: { background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', padding: '7px 12px', outline: 'none' },
  clearBtn: { background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.5)', fontSize: '12px', padding: '7px 12px', cursor: 'pointer' },
  tableWrap: { background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
  th: { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.8px', fontSize: '10px', padding: '10px 14px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  tr: {},
  td: { padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.8)', verticalAlign: 'middle' },
  userCell: { display: 'flex', alignItems: 'center', gap: '8px' },
  avatar: { width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '500', color: '#90CAF9', flexShrink: 0 },
  userName: { fontWeight: '500', color: '#fff', fontSize: '12px' },
  userLeg: { fontSize: '10px', color: 'rgba(255,255,255,0.4)' },
  badge: { display: 'inline-block', padding: '3px 9px', borderRadius: '6px', fontSize: '10px', fontWeight: '500', whiteSpace: 'nowrap' },
  center: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '40px', fontSize: '13px' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' },
  pageBtn: { background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.5)', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  pageBtnActive: { background: '#1D4ED8', color: '#fff' },
};