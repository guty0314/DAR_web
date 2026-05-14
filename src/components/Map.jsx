import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix iconos leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createIcon = (color) => {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 36px;
        height: 36px;
        background-color: ${color};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      ">
        <div style="
          transform: rotate(45deg);
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        ">⚠️</div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
};

// Fuerza redibujado cuando cambia el sidebar
function MapResizer({ sidebarOpen, detailOpen }) {
  const map = useMap();
  
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 400);
    return () => clearTimeout(timer);
  }, [sidebarOpen, detailOpen]);

  // ✅ también al montar
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return null;
}

// Centra el mapa en la emergencia seleccionada
function MapCenter({ selected }) {
  const map = useMap();
  useEffect(() => {
    if (selected?.latitude && selected?.longitude) {
      map.flyTo([selected.latitude, selected.longitude], 16, {
        duration: 1.2,
      });
    }
  }, [selected]);
  return null;
}

export default function EmergencyMap({ emergencies, selected, onSelect, getColor, sidebarOpen }) {
  const defaultCenter = [-24.2208016, -65.2706483];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />

      {/* Redibujado automático */}
      <MapResizer sidebarOpen={sidebarOpen} />
      <MapCenter selected={selected} />

      {emergencies.map((e) => {
        if (!e.latitude || !e.longitude) return null;
        const color = getColor(e.color);

        return (
          <Marker
            key={e.id}
            position={[e.latitude, e.longitude]}
            icon={createIcon(color)}
            eventHandlers={{
              click: () => onSelect(e),
            }}
          >
            <Popup>
              <div style={{ fontFamily: 'system-ui', minWidth: '180px' }}>
                <div style={{
                  fontWeight: 'bold',
                  fontSize: '14px',
                  color: color,
                  marginBottom: '6px',
                }}>
                  {e.type_name}
                </div>
                <div style={{ fontSize: '12px', color: '#555', marginBottom: '4px' }}>
                  👤 {e.full_name || e.username}
                </div>
                <div style={{ fontSize: '12px', color: '#555', marginBottom: '4px' }}>
                  📋 Legajo: {e.username}
                </div>
                <div style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  backgroundColor: e.active ? '#ffebee' : '#f5f5f5',
                  color: e.active ? '#E53935' : '#888',
                  marginTop: '4px',
                }}>
                  {e.active ? '🔴 Activa' : '⚫ Cerrada'}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}