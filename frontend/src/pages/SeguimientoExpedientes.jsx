import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  BarChart2, Users, FolderOpen, CheckCircle, Clock,
  UserCheck, Search, X, RefreshCw, Trash2, Package, Eye
} from 'lucide-react';

/* ─── Barra de progreso ─────────────────────────────────── */
function ProgressBar({ value, color = '#39A900' }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div style={{ background: '#e5e7eb', borderRadius: 99, height: 8, width: '100%' }}>
      <div style={{ width: `${pct}%`, background: color, borderRadius: 99, height: 8, transition: 'width .5s' }} />
    </div>
  );
}

/* ─── Tarjeta KPI ───────────────────────────────────────── */
function KPICard({ icon, label, value, sub, color = '#39A900' }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '20px 24px',
      boxShadow: '0 2px 12px rgba(0,0,0,.07)', display: 'flex', alignItems: 'center', gap: 16,
      border: '1px solid #f3f4f6'
    }}>
      <div style={{ background: color + '18', borderRadius: 12, padding: 14, color }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#111', lineHeight: '1.2' }}>{value}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginTop: 4 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ─── Gráfico de Barra Horizontal ───────────────────────── */
function HorizontalBarChart({ data, colorStart = '#39A900', colorEnd = '#6bc235' }) {
  // data: [{ label: string, value: number, subLabel?: string }]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {data.map((item, index) => (
        <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#4b5563' }}>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }}>
              {item.label} {item.subLabel ? `(${item.subLabel})` : ''}
            </span>
            <span style={{ color: '#111', fontWeight: 700 }}>{item.value}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: '#f3f4f6', borderRadius: 99, height: 12, flex: 1, position: 'relative', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
              <div style={{ 
                width: `${item.value}%`, 
                background: `linear-gradient(90deg, ${colorStart} 0%, ${colorEnd} 100%)`, 
                borderRadius: 99, 
                height: '100%', 
                transition: 'width 1s ease-out' 
              }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Gráfico de Columnas Verticales SVG ────────────────── */
function SVGVerticalBarChart({ data, height = 180 }) {
  // data: [{ label: string, value: number, tooltip?: string }]
  const chartHeight = height - 40;
  const barWidth = 32;
  const gap = 16;
  const chartWidth = Math.max(280, data.length * (barWidth + gap) + 50);

  return (
    <div style={{ overflowX: 'auto', padding: '10px 0', width: '100%' }}>
      <svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`} style={{ display: 'block', margin: '0 auto' }}>
        <defs>
          <linearGradient id="chartGreenGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#39A900" />
            <stop offset="100%" stopColor="#81c784" />
          </linearGradient>
        </defs>
        {/* Grid Lines */}
        {[0, 25, 50, 75, 100].map((tick, i) => {
          const y = (height - 30) - (tick / 100) * chartHeight;
          return (
            <g key={i}>
              <line x1="35" y1={y} x2={chartWidth} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <text x="5" y={y + 4} style={{ fontSize: 9, fill: '#9ca3af', fontWeight: 'bold', fontFamily: 'sans-serif' }}>{tick}%</text>
            </g>
          );
        })}
        {/* Bars */}
        {data.map((item, idx) => {
          const x = idx * (barWidth + gap) + 45;
          const barHeight = (item.value / 100) * chartHeight;
          const y = (height - 30) - barHeight;

          return (
            <g key={idx} style={{ cursor: 'pointer' }}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 2)}
                rx="4"
                fill="url(#chartGreenGrad)"
                style={{ transition: 'all 0.5s ease' }}
              />
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                style={{ fontSize: 9, fontWeight: 'bold', fill: '#39A900', fontFamily: 'sans-serif' }}
              >
                {Math.round(item.value)}%
              </text>
              <text
                x={x + barWidth / 2}
                y={height - 12}
                textAnchor="middle"
                style={{ fontSize: 9, fill: '#4b5563', fontWeight: '600', fontFamily: 'sans-serif' }}
              >
                {item.label.length > 8 ? `${item.label.substring(0, 7)}..` : item.label}
              </text>
              <title>{item.tooltip || `${item.label}: ${item.value}%`}</title>
            </g>
          );
        })}
        {/* Baseline */}
        <line x1="35" y1={height - 30} x2={chartWidth} y2={height - 30} stroke="#d1d5db" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/* ─── Gráfico de Dona SVG ───────────────────────────────── */
function SVGDoughnutChart({ data, size = 160 }) {
  // data: [{ label: string, value: number, color: string }]
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = size * 0.35;
  const strokeWidth = radius * 0.3;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let currentAngle = -90; // start at top

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {total === 0 ? (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
        ) : (
          data.map((item, idx) => {
            const percentage = (item.value / total) * 100;
            const strokeLength = (percentage / 100) * circumference;
            const strokeOffset = circumference - strokeLength;
            const angle = (percentage / 100) * 360;
            const rotation = currentAngle;
            currentAngle += angle;

            return (
              <circle
                key={idx}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                transform={`rotate(${rotation} ${center} ${center})`}
                style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
              >
                <title>{item.label}: {item.value} ({Math.round(percentage)}%)</title>
              </circle>
            );
          })
        )}
        <circle cx={center} cy={center} r={radius - strokeWidth / 2 - 2} fill="#fff" />
        <text
          x={center}
          y={center + 5}
          textAnchor="middle"
          style={{ fontSize: 13, fontWeight: '800', fill: '#374151', fontFamily: 'sans-serif' }}
        >
          {total} Total
        </text>
      </svg>
      {/* Legends */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', fontSize: 11, width: '100%' }}>
        {data.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f9fafb', padding: '4px 10px', borderRadius: 6, border: '1px solid #f3f4f6' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
            <span style={{ color: '#4b5563', fontWeight: 600 }}>{item.label}: {item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════════ */
export default function SeguimientoExpedientes() {
  const [tab, setTab] = useState('estadisticas');
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [searchExpedienteTerm, setSearchExpedienteTerm] = useState('');
  const [filtroUsuarioStats, setFiltroUsuarioStats] = useState('todos');
  const [allAsignaciones, setAllAsignaciones] = useState([]);
  const [loadingAllAsig, setLoadingAllAsig] = useState(false);

  /* Asignaciones */
  const [asignaciones, setAsignaciones] = useState([]);
  const [loadingAsig, setLoadingAsig] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroSearch, setFiltroSearch] = useState('');

  /* Modal asignar */
  const [showModal, setShowModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [expSinAsignar, setExpSinAsignar] = useState([]);
  const [searchExp, setSearchExp] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedExps, setSelectedExps] = useState([]);
  const [obsModal, setObsModal] = useState('');
  const [saving, setSaving] = useState(false);

  /* Paquetes */
  const [paquetes, setPaquetes] = useState([]);
  const [loadingPaq, setLoadingPaq] = useState(false);
  const [showPaqModal, setShowPaqModal] = useState(false);
  const [paqNombre, setPaqNombre] = useState('');
  const [paqDesc, setPaqDesc] = useState('');
  const [paqUser, setPaqUser] = useState('');
  const [paqExps, setPaqExps] = useState([]);
  const [searchPaqExp, setSearchPaqExp] = useState('');
  const [expParaPaq, setExpParaPaq] = useState([]);
  const [savingPaq, setSavingPaq] = useState(false);
  const [viewPaq, setViewPaq] = useState(null);
  const [paqItems, setPaqItems] = useState([]);

  /* ── Carga de estadísticas ── */
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const r = await axios.get('/api/seguimiento/estadisticas');
      setStats(r.data);
    } catch (e) {
      console.error(e);
    } finally { setLoadingStats(false); }
  }, []);

  /* ── Carga de asignaciones ── */
  const fetchAsignaciones = useCallback(async () => {
    setLoadingAsig(true);
    try {
      const r = await axios.get('/api/seguimiento/asignaciones', {
        params: { estado: filtroEstado || undefined, search: filtroSearch || undefined }
      });
      setAsignaciones(r.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoadingAsig(false); }
  }, [filtroEstado, filtroSearch]);

  /* Paquetes fetch */
  const fetchPaquetes = useCallback(async () => {
    setLoadingPaq(true);
    try {
      const r = await axios.get('/api/seguimiento/paquetes');
      setPaquetes(r.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoadingPaq(false); }
  }, []);

  const fetchAllAsignaciones = async () => {
    setLoadingAllAsig(true);
    try {
      const r = await axios.get('/api/seguimiento/asignaciones');
      setAllAsignaciones(r.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAllAsig(false);
    }
  };

  useEffect(() => {
    if (tab === 'estadisticas') {
      fetchStats();
      fetchPaquetes();
      fetchAllAsignaciones();
    }
  }, [tab, fetchStats, fetchPaquetes]);
  useEffect(() => { if (tab === 'asignaciones') fetchAsignaciones(); }, [tab, fetchAsignaciones]);
  useEffect(() => { if (tab === 'paquetes') fetchPaquetes(); }, [tab, fetchPaquetes]);

  /* ── Abrir modal asignar ── */
  const openModal = async () => {
    setShowModal(true);
    setSelectedExps([]); setSelectedUser(''); setObsModal(''); setSearchExp('');
    try {
      const [ru, re] = await Promise.all([
        axios.get('/api/users'),
        axios.get('/api/seguimiento/expedientes-sin-asignar', { params: { search: '' } })
      ]);
      setUsers(ru.data.data || []);
      setExpSinAsignar(re.data.data || []);
    } catch (e) { console.error(e); }
  };

  /* ── Abrir modal paquete ── */
  const openPaqModal = async () => {
    setShowPaqModal(true);
    setPaqNombre(''); setPaqDesc(''); setPaqUser(''); setPaqExps([]); setSearchPaqExp('');
    try {
      const [ru, re] = await Promise.all([
        axios.get('/api/users'),
        axios.get('/api/seguimiento/expedientes-sin-asignar', { params: { search: '' } })
      ]);
      setUsers(ru.data.data || []);
      setExpParaPaq(re.data.data || []);
    } catch (e) { console.error(e); }
  };

  const buscarExpPaq = async () => {
    try {
      const r = await axios.get('/api/seguimiento/expedientes-sin-asignar', { params: { search: searchPaqExp } });
      setExpParaPaq(r.data.data || []);
    } catch (e) { console.error(e); }
  };

  const guardarPaquete = async () => {
    if (!paqNombre || !paqUser || paqExps.length === 0) {
      alert('Complete nombre, usuario y seleccione expedientes.'); return;
    }
    setSavingPaq(true);
    try {
      const r = await axios.post('/api/seguimiento/paquetes', {
        nombre: paqNombre, descripcion: paqDesc,
        user_id: parseInt(paqUser), expediente_ids: paqExps
      });
      alert(`✅ ${r.data.message}`);
      setShowPaqModal(false);
      fetchPaquetes();
    } catch (e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
    } finally { setSavingPaq(false); }
  };

  const verPaquete = async (paq) => {
    setViewPaq(paq);
    try {
      const r = await axios.get(`/api/seguimiento/paquetes/${paq.id}/expedientes`);
      setPaqItems(r.data.data || []);
    } catch (e) { console.error(e); }
  };

  const eliminarPaquete = async (id) => {
    if (!confirm('¿Eliminar este paquete?')) return;
    try {
      await axios.delete(`/api/seguimiento/paquetes/${id}`);
      fetchPaquetes();
    } catch (e) { alert('Error: ' + (e.response?.data?.error || e.message)); }
  };

  /* ── Buscar expedientes sin asignar ── */
  const buscarExp = async () => {
    try {
      const r = await axios.get('/api/seguimiento/expedientes-sin-asignar', { params: { search: searchExp } });
      setExpSinAsignar(r.data.data || []);
    } catch (e) { console.error(e); }
  };

  const toggleExp = (id) => setSelectedExps(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  /* ── Guardar asignación ── */
  const guardarAsignacion = async () => {
    if (!selectedUser || selectedExps.length === 0) {
      alert('Seleccione usuario y al menos un expediente.'); return;
    }
    setSaving(true);
    try {
      const r = await axios.post('/api/seguimiento/asignar', {
        expediente_ids: selectedExps, user_id: parseInt(selectedUser), observaciones: obsModal
      });
      alert(`✅ ${r.data.message}`);
      setShowModal(false);
      fetchAsignaciones();
    } catch (e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
    } finally { setSaving(false); }
  };

  /* ── Eliminar asignación ── */
  const eliminarAsignacion = async (id) => {
    if (!confirm('¿Eliminar esta asignación?')) return;
    try {
      await axios.delete(`/api/seguimiento/asignaciones/${id}`);
      fetchAsignaciones();
    } catch (e) { alert('Error: ' + (e.response?.data?.error || e.message)); }
  };

  /* ── Cambiar estado asignación ── */
  const cambiarEstado = async (id, estado) => {
    try {
      await axios.put(`/api/seguimiento/asignaciones/${id}`, { estado });
      fetchAsignaciones();
    } catch (e) { console.error(e); }
  };

  const G = stats?.global || {};

  return (
    <div style={{ padding: '24px 32px', fontFamily: "'Inter','Segoe UI',sans-serif", maxWidth: 1200 }}>

      {/* Encabezado */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111', margin: 0 }}>
          📊 Seguimiento de Expedientes
        </h1>
        <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
          Control de cargue por dependencia y usuario · Asignación de expedientes
        </p>
      </div>

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, borderBottom: '2px solid #e5e7eb' }}>
        {[
          { id: 'estadisticas', label: '📈 Estadísticas' },
          { id: 'paquetes', label: '📦 Paquetes' },
          { id: 'asignaciones', label: '👤 Asignaciones' }
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 20px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 13,
            background: tab === t.id ? '#39A900' : 'transparent',
            color: tab === t.id ? '#fff' : '#6b7280',
            marginBottom: -2, borderBottom: tab === t.id ? '2px solid #39A900' : 'none'
          }}>{t.label}</button>
        ))}
      </div>

      {/* ═══ TAB: ESTADÍSTICAS ═══ */}
      {tab === 'estadisticas' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <button onClick={fetchStats} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600
            }}>
              <RefreshCw size={14} /> Actualizar
            </button>
          </div>

          {stats && (
            <div style={{
              background: '#fff', borderRadius: 14, padding: '16px 24px',
              boxShadow: '0 2px 12px rgba(0,0,0,.05)', marginBottom: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
              border: '1px solid #e5e7eb'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111' }}>
                  👤 Analizar por Usuario
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                  Visualiza gráficos interactivos del avance, lotes y expedientes asignados.
                </p>
              </div>
              <div>
                <select
                  value={filtroUsuarioStats}
                  onChange={e => setFiltroUsuarioStats(e.target.value)}
                  style={{
                    padding: '8px 16px', border: '1.5px solid #d1d5db', borderRadius: 8,
                    fontSize: 13, fontWeight: 600, background: '#fff', color: '#374151',
                    outline: 'none', cursor: 'pointer', minWidth: 200
                  }}
                >
                  <option value="todos">Todos los Usuarios (Global)</option>
                  {(stats.usuarios || []).map(u => (
                    <option key={u.user_id} value={u.user_id}>{u.usuario}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {loadingStats ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Cargando estadísticas...</div>
          ) : stats ? (
            <>
              {filtroUsuarioStats === 'todos' ? (
                <>
                  {/* KPIs Globales */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 32 }}>
                    <KPICard icon={<FolderOpen size={22}/>} label="Total Expedientes" value={G.total_expedientes || 0} color="#39A900" />
                    <KPICard icon={<CheckCircle size={22}/>} label="Con Documentos" value={G.expedientes_con_docs || 0} color="#3b82f6" />
                    <KPICard icon={<BarChart2 size={22}/>} label="% Cargue Global" value={`${G.porcentaje_global || 0}%`} color="#8b5cf6" />
                    <KPICard icon={<Users size={22}/>} label="Total Asignaciones" value={G.total_asignaciones || 0} color="#f59e0b" />
                  </div>

                  {/* Panel de Gráficos Globales */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 28 }}>
                    {/* Gráfico 1: Avance por Dependencia */}
                    <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.07)', border: '1px solid #f3f4f6' }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 16 }}>🏢 Avance por Dependencia</h3>
                      <HorizontalBarChart 
                        data={(stats.dependencias || []).slice(0, 5).map(d => ({
                          label: d.dependencia,
                          value: Number(d.porcentaje_cargue) || 0,
                          subLabel: `${d.expedientes_con_docs}/${d.total_expedientes} exp.`
                        }))} 
                      />
                    </div>

                    {/* Gráfico 2: Avance por Usuario (Top) */}
                    <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.07)', border: '1px solid #f3f4f6' }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 16 }}>👤 Avance por Usuario (Top)</h3>
                      <SVGVerticalBarChart 
                        data={(stats.usuarios || [])
                          .filter(u => u.expedientes_asignados > 0)
                          .slice(0, 6)
                          .map(u => ({
                            label: u.usuario,
                            value: Number(u.porcentaje_cargue) || 0,
                            tooltip: `${u.usuario}: ${u.porcentaje_cargue}% (${u.total_documentos} docs)`
                          }))}
                      />
                    </div>

                    {/* Gráfico 3: Distribución Global de Expedientes */}
                    <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.07)', border: '1px solid #f3f4f6' }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 16 }}>📊 Distribución de Expedientes</h3>
                      <SVGDoughnutChart 
                        data={[
                          { label: 'Con Documentos', value: G.expedientes_con_docs || 0, color: '#3b82f6' },
                          { label: 'Sin Documentos', value: (G.total_expedientes || 0) - (G.expedientes_con_docs || 0), color: '#ef4444' }
                        ]}
                      />
                    </div>

                    {/* Gráfico 4: Avance de Lotes/Paquetes del Sistema */}
                    <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.07)', border: '1px solid #f3f4f6' }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 16 }}>📦 Avance de Lotes/Paquetes</h3>
                      <HorizontalBarChart 
                        data={paquetes.slice(0, 5).map(p => ({
                          label: p.nombre,
                          value: p.total_docs > 0 ? Math.round((Number(p.docs_cargados) / Number(p.total_docs)) * 100) : 0,
                          subLabel: p.usuario_nombre
                        }))} 
                        colorStart="#8b5cf6" 
                        colorEnd="#a78bfa"
                      />
                    </div>
                  </div>

                  {/* Por Dependencia */}
                  <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.07)', marginBottom: 28 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 16 }}>
                      🏢 % Cargue por Dependencia
                    </h2>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#f9fafb' }}>
                            {['Dependencia','Total Exp.','Con Docs','% Cargue','Documentos'].map(h => (
                              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(stats.dependencias || []).map((d, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111' }}>{d.dependencia}</td>
                              <td style={{ padding: '10px 12px', color: '#374151' }}>{d.total_expedientes}</td>
                              <td style={{ padding: '10px 12px', color: '#374151' }}>{d.expedientes_con_docs}</td>
                              <td style={{ padding: '10px 12px', minWidth: 160 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <ProgressBar value={d.porcentaje_cargue} color={Number(d.porcentaje_cargue) >= 80 ? '#39A900' : Number(d.porcentaje_cargue) >= 40 ? '#f59e0b' : '#ef4444'} />
                                  <span style={{ fontSize: 12, fontWeight: 700, minWidth: 40 }}>{d.porcentaje_cargue}%</span>
                                </div>
                              </td>
                              <td style={{ padding: '10px 12px', color: '#374151' }}>{d.total_documentos}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Por Usuario */}
                  <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.07)' }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 16 }}>
                      👤 % Cargue por Usuario
                    </h2>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#f9fafb' }}>
                            {['Usuario','Área','Exp. Asignados','Con Docs','% Cargue','Documentos'].map(h => (
                              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(stats.usuarios || []).filter(u => u.expedientes_asignados > 0).map((u, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111' }}>{u.usuario}</td>
                              <td style={{ padding: '10px 12px', color: '#6b7280' }}>{u.area || '—'}</td>
                              <td style={{ padding: '10px 12px' }}>{u.expedientes_asignados}</td>
                              <td style={{ padding: '10px 12px' }}>{u.expedientes_con_docs}</td>
                              <td style={{ padding: '10px 12px', minWidth: 160 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <ProgressBar value={u.porcentaje_cargue} color={Number(u.porcentaje_cargue) >= 80 ? '#39A900' : Number(u.porcentaje_cargue) >= 40 ? '#f59e0b' : '#ef4444'} />
                                  <span style={{ fontSize: 12, fontWeight: 700, minWidth: 40 }}>{u.porcentaje_cargue}%</span>
                                </div>
                              </td>
                              <td style={{ padding: '10px 12px' }}>{u.total_documentos}</td>
                            </tr>
                          ))}
                          {(stats.usuarios || []).filter(u => u.expedientes_asignados > 0).length === 0 && (
                            <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                              Sin usuarios con expedientes asignados aún.
                            </td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Por Expediente */}
                  <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.07)', marginTop: 28 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: 0 }}>
                        📁 Avance Detallado por Expediente
                      </h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 12px' }}>
                        <Search size={14} style={{ color: '#9ca3af' }} />
                        <input
                          type="text"
                          placeholder="Buscar por código o título..."
                          value={searchExpedienteTerm}
                          onChange={e => setSearchExpedienteTerm(e.target.value)}
                          style={{ border: 'none', outline: 'none', fontSize: 13, width: 220 }}
                        />
                        {searchExpedienteTerm && (
                          <button onClick={() => setSearchExpedienteTerm('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}>
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#f9fafb' }}>
                            {['Código', 'Título', 'Dependencia', 'TRD', 'Documentos', '% Avance'].map(h => (
                              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(stats.expedientes || [])
                            .filter(exp => {
                              const term = searchExpedienteTerm.toLowerCase().trim();
                              if (!term) return true;
                              return (exp.expediente_code && exp.expediente_code.toLowerCase().includes(term)) ||
                                     (exp.title && exp.title.toLowerCase().includes(term)) ||
                                     (exp.dependencia && exp.dependencia.toLowerCase().includes(term)) ||
                                     (exp.subserie && exp.subserie.toLowerCase().includes(term));
                            })
                            .map((exp) => {
                              const pct = Number(exp.avance) || 0;
                              return (
                                <tr key={exp.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111' }}>{exp.expediente_code || `ID: ${exp.id}`}</td>
                                  <td style={{ padding: '10px 12px', color: '#374151' }} title={exp.title}>{exp.title || 'Sin Título'}</td>
                                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{exp.dependencia || '—'}</td>
                                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{exp.subserie || '—'}</td>
                                  <td style={{ padding: '10px 12px', color: '#374151' }}>
                                    <span style={{ fontWeight: 600 }}>{exp.cargados}</span>
                                    <span style={{ color: '#9ca3af' }}> / {exp.total_requeridos}</span>
                                  </td>
                                  <td style={{ padding: '10px 12px', minWidth: 160 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <ProgressBar value={pct} color={pct >= 80 ? '#39A900' : pct >= 40 ? '#f59e0b' : '#ef4444'} />
                                      <span style={{ fontSize: 12, fontWeight: 700, minWidth: 40 }}>{pct}%</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          }
                          {(stats.expedientes || []).filter(exp => {
                            const term = searchExpedienteTerm.toLowerCase().trim();
                            if (!term) return true;
                            return (exp.expediente_code && exp.expediente_code.toLowerCase().includes(term)) ||
                                   (exp.title && exp.title.toLowerCase().includes(term)) ||
                                   (exp.dependencia && exp.dependencia.toLowerCase().includes(term)) ||
                                   (exp.subserie && exp.subserie.toLowerCase().includes(term));
                          }).length === 0 && (
                            <tr>
                              <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                                No se encontraron expedientes coincidentes.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (() => {
                const userStatsObj = (stats.usuarios || []).find(u => u.user_id === Number(filtroUsuarioStats));
                const userLotes = paquetes.filter(p => p.usuario_nombre === userStatsObj?.usuario);
                const userExps = allAsignaciones
                  .filter(a => a.usuario_nombre === userStatsObj?.usuario)
                  .map(a => {
                    const expInfo = (stats.expedientes || []).find(e => e.id === a.expediente_id);
                    return {
                      id: a.expediente_id,
                      code: a.expediente_code || `EXP-${a.expediente_id}`,
                      title: a.expediente_titulo || 'Sin Título',
                      dependencia: a.dependencia || '—',
                      subserie: a.subserie || '—',
                      avance: expInfo ? expInfo.avance : 0,
                      cargados: expInfo ? expInfo.cargados : a.doc_count,
                      requeridos: expInfo ? expInfo.total_requeridos : 0
                    };
                  });

                return (
                  <>
                    {/* KPIs del Usuario */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 32 }}>
                      <KPICard icon={<FolderOpen size={22}/>} label="Exp. Asignados" value={userStatsObj?.expedientes_asignados || 0} color="#39A900" />
                      <KPICard icon={<CheckCircle size={22}/>} label="Con Documentos" value={userStatsObj?.expedientes_con_docs || 0} color="#3b82f6" />
                      <KPICard icon={<BarChart2 size={22}/>} label="% Avance Promedio" value={`${userStatsObj?.porcentaje_cargue || 0}%`} color="#8b5cf6" />
                      <KPICard icon={<Users size={22}/>} label="Documentos Cargados" value={userStatsObj?.total_documentos || 0} color="#f59e0b" />
                    </div>

                    {/* Gráficos del Usuario */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 28 }}>
                      {/* Lotes del Usuario */}
                      <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.07)', border: '1px solid #f3f4f6' }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 16 }}>📦 Avance por Lote / Paquete</h3>
                        {userLotes.length === 0 ? (
                          <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>El usuario no tiene lotes asignados.</div>
                        ) : (
                          <HorizontalBarChart 
                            data={userLotes.map(p => ({
                              label: p.nombre,
                              value: p.total_docs > 0 ? Math.round((Number(p.docs_cargados) / Number(p.total_docs)) * 100) : 0,
                              subLabel: `${p.docs_cargados}/${p.total_docs} docs`
                            }))}
                            colorStart="#8b5cf6" 
                            colorEnd="#a78bfa"
                          />
                        )}
                      </div>

                      {/* Expedientes del Usuario */}
                      <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.07)', border: '1px solid #f3f4f6' }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 16 }}>📁 Avance por Expediente (Top 6)</h3>
                        {userExps.length === 0 ? (
                          <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>El usuario no tiene expedientes asignados.</div>
                        ) : (
                          <SVGVerticalBarChart 
                            data={userExps.slice(0, 6).map(e => ({
                              label: e.code,
                              value: Number(e.avance) || 0,
                              tooltip: `${e.title}: ${e.avance}% (${e.cargados}/${e.requeridos} docs)`
                            }))}
                          />
                        )}
                      </div>
                    </div>

                    {/* Tabla de Expedientes del Usuario */}
                    <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.07)' }}>
                      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 16 }}>
                        📁 Expedientes Asignados a {userStatsObj?.usuario}
                      </h2>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: '#f9fafb' }}>
                              {['Código', 'Título', 'Dependencia', 'TRD', 'Documentos', '% Avance'].map(h => (
                                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {userExps.map((exp) => (
                              <tr key={exp.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111' }}>{exp.code}</td>
                                <td style={{ padding: '10px 12px', color: '#374151' }}>{exp.title}</td>
                                <td style={{ padding: '10px 12px', color: '#6b7280' }}>{exp.dependencia}</td>
                                <td style={{ padding: '10px 12px', color: '#6b7280' }}>{exp.subserie}</td>
                                <td style={{ padding: '10px 12px', color: '#374151' }}>
                                  <span style={{ fontWeight: 600 }}>{exp.cargados}</span>
                                  <span style={{ color: '#9ca3af' }}> / {exp.requeridos}</span>
                                </td>
                                <td style={{ padding: '10px 12px', minWidth: 160 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <ProgressBar value={exp.avance} color={exp.avance >= 80 ? '#39A900' : exp.avance >= 40 ? '#f59e0b' : '#ef4444'} />
                                    <span style={{ fontSize: 12, fontWeight: 700, minWidth: 40 }}>{exp.avance}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {userExps.length === 0 && (
                              <tr>
                                <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                                  Sin expedientes asignados.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Sin datos. Haga clic en Actualizar.</div>
          )}
        </div>
      )}

      {/* ═══ TAB: PAQUETES ═══ */}
      {tab === 'paquetes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>{paquetes.length} paquete(s) registrado(s)</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={fetchPaquetes} style={{ padding: '8px 14px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={14} /> Actualizar
              </button>
              <button onClick={openPaqModal} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#39A900', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                <Package size={15} /> Crear Paquete
              </button>
            </div>
          </div>

          {loadingPaq ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>Cargando paquetes...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {paquetes.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,.07)', borderLeft: '4px solid #39A900' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#111' }}>{p.nombre}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{p.descripcion || 'Sin descripción'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => verPaquete(p)} style={{ padding: '5px 10px', background: '#dbeafe', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#1d4ed8', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Eye size={13} /> Ver
                      </button>
                      <button onClick={() => eliminarPaquete(p.id)} style={{ padding: '5px 8px', background: '#fef2f2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#ef4444' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 12 }}>
                    <div><span style={{ color: '#9ca3af' }}>Usuario: </span><strong>{p.usuario_nombre}</strong></div>
                    <div><span style={{ color: '#9ca3af' }}>Expedientes: </span><strong>{p.total_expedientes}</strong></div>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#6b7280', fontWeight: 600 }}>Avance Lote (AES):</span>
                      <strong style={{ color: '#39A900' }}>
                        {p.total_docs > 0 ? Math.round((Number(p.docs_cargados) / Number(p.total_docs)) * 100) : 0}%
                      </strong>
                    </div>
                    <ProgressBar value={p.total_docs > 0 ? (Number(p.docs_cargados) / Number(p.total_docs)) * 100 : 0} color="#39A900" />
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, textAlign: 'right' }}>
                      {p.docs_cargados || 0} / {p.total_docs || 0} docs cargados
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                    Creado: {new Date(p.created_at).toLocaleDateString('es-CO')} por {p.creado_por || '—'}
                  </div>
                </div>
              ))}
              {paquetes.length === 0 && (
                <div style={{ gridColumn: '1/-1', padding: 60, textAlign: 'center', color: '#9ca3af' }}>
                  Sin paquetes. Haga clic en "Crear Paquete" para asignar expedientes por grupo a un usuario.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal ver paquete */}
      {viewPaq && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 700, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>📦 {viewPaq.nombre}</h2>
              <button onClick={() => setViewPaq(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Código','Título','Estado','Automatizador','AES','% Cargue'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paqItems.map(e => {
                  const pct = e.doc_count > 0 ? Math.round((Number(e.docs_cargados) / Number(e.doc_count)) * 100) : 0;
                  return (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{e.expediente_code || `#${e.id}`}</td>
                    <td style={{ padding: '8px 12px', color: '#374151' }}>{e.title?.substring(0, 40)}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                        background: e.estado_asignacion === 'Completado' ? '#dcfce7' : e.estado_asignacion === 'En Proceso' ? '#dbeafe' : '#fef9c3',
                        color: e.estado_asignacion === 'Completado' ? '#166534' : e.estado_asignacion === 'En Proceso' ? '#1d4ed8' : '#92400e'
                      }}>{e.estado_asignacion || 'Pendiente'}</span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#111', fontWeight: 600 }}>{e.doc_count} <span style={{fontSize: 10, color:'#6b7280', fontWeight: 'normal'}}>docs</span></td>
                    <td style={{ padding: '8px 12px', color: '#39A900', fontWeight: 600 }}>{e.docs_cargados || 0} <span style={{fontSize: 10, color:'#6b7280', fontWeight: 'normal'}}>docs</span></td>
                    <td style={{ padding: '8px 12px', minWidth: 100 }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1 }}><ProgressBar value={pct} color={pct >= 100 ? '#39A900' : '#f59e0b'} /></div>
                          <span style={{ fontSize: 11, fontWeight: 700 }}>{pct}%</span>
                       </div>
                    </td>
                  </tr>
                )})}
                {paqItems.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Sin expedientes en este paquete.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal crear paquete */}
      {showPaqModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>📦 Crear Paquete de Expedientes</h2>
              <button onClick={() => setShowPaqModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>NOMBRE DEL PAQUETE *</label>
                <input value={paqNombre} onChange={e => setPaqNombre(e.target.value)} placeholder="Ej: Paquete Regional Bogotá" style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>ASIGNAR A USUARIO *</label>
                <select value={paqUser} onChange={e => setPaqUser(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                  <option value=''>— Seleccione —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>DESCRIPCIÓN (opcional)</label>
              <input value={paqDesc} onChange={e => setPaqDesc(e.target.value)} placeholder="Descripción del paquete..." style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>EXPEDIENTES *</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input value={searchPaqExp} onChange={e => setSearchPaqExp(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscarExpPaq()} placeholder="Buscar expediente..." style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
                <button onClick={buscarExpPaq} style={{ padding: '8px 14px', background: '#39A900', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Buscar</button>
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 220, overflowY: 'auto' }}>
                {expParaPaq.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Sin expedientes disponibles</div>
                ) : expParaPaq.map(e => (
                  <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', background: paqExps.includes(e.id) ? '#f0fdf4' : '#fff' }}>
                    <input type="checkbox" checked={paqExps.includes(e.id)} onChange={() => setPaqExps(prev => prev.includes(e.id) ? prev.filter(x => x !== e.id) : [...prev, e.id])} style={{ accentColor: '#39A900', width: 15, height: 15 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{e.expediente_code || `#${e.id}`} — {e.title?.substring(0, 45)}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{e.dependencia || 'Sin dep.'} · {e.doc_count} doc(s)</div>
                    </div>
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{paqExps.length} expediente(s) seleccionado(s)</div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowPaqModal(false)} style={{ padding: '9px 20px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancelar</button>
              <button onClick={guardarPaquete} disabled={savingPaq} style={{ padding: '9px 20px', background: savingPaq ? '#9ca3af' : '#39A900', color: '#fff', border: 'none', borderRadius: 8, cursor: savingPaq ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13 }}>
                {savingPaq ? 'Creando...' : `Crear Paquete (${paqExps.length} exp.)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: ASIGNACIONES ═══ */}
      {tab === 'asignaciones' && (
        <div>
          {/* Barra de acciones */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <button onClick={openModal} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
              background: '#39A900', color: '#fff', border: 'none', borderRadius: 8,
              cursor: 'pointer', fontWeight: 700, fontSize: 13
            }}>
              <UserCheck size={15} /> Asignar Expedientes
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 12px' }}>
              <Search size={14} style={{ color: '#9ca3af' }} />
              <input value={filtroSearch} onChange={e => setFiltroSearch(e.target.value)}
                placeholder="Buscar..." style={{ border: 'none', outline: 'none', fontSize: 13, width: 180 }} />
            </div>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, background: '#fff' }}>
              <option value="">Todos los estados</option>
              <option value="Pendiente">Pendiente</option>
              <option value="En Proceso">En Proceso</option>
              <option value="Completado">Completado</option>
            </select>
            <button onClick={fetchAsignaciones} style={{
              padding: '8px 14px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6
            }}><RefreshCw size={14} /> Actualizar</button>
          </div>

          {/* Tabla asignaciones */}
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,.07)', overflow: 'hidden' }}>
            {loadingAsig ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Cargando...</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Expediente','Usuario','Dependencia','Docs','Estado','Asignado','Acciones'].map(h => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {asignaciones.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#111' }}>{a.expediente_code || '—'}</div>
                        <div style={{ color: '#6b7280', fontSize: 11 }}>{a.expediente_titulo?.substring(0, 40)}</div>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{a.usuario_nombre}</td>
                      <td style={{ padding: '10px 14px', color: '#6b7280' }}>{a.dependencia || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          background: Number(a.doc_count) > 0 ? '#dcfce7' : '#fef9c3',
                          color: Number(a.doc_count) > 0 ? '#166534' : '#92400e',
                          padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700
                        }}>{a.doc_count}</span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <select value={a.estado} onChange={e => cambiarEstado(a.id, e.target.value)}
                          style={{
                            padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid #e5e7eb',
                            background: a.estado === 'Completado' ? '#dcfce7' : a.estado === 'En Proceso' ? '#dbeafe' : '#fef9c3',
                            color: a.estado === 'Completado' ? '#166534' : a.estado === 'En Proceso' ? '#1d4ed8' : '#92400e'
                          }}>
                          <option>Pendiente</option>
                          <option>En Proceso</option>
                          <option>Completado</option>
                        </select>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#9ca3af', fontSize: 11 }}>
                        {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString('es-CO') : '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={() => eliminarAsignacion(a.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}
                          title="Eliminar asignación">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {asignaciones.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                      Sin asignaciones. Use el botón "Asignar Expedientes" para comenzar.
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ═══ MODAL: ASIGNAR ═══ */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 700,
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Asignar Expedientes a Usuario</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Seleccionar usuario */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                USUARIO *
              </label>
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                <option value="">— Seleccione un usuario —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name} {u.area ? `· ${u.area}` : ''}</option>
                ))}
              </select>
            </div>

            {/* Buscar expedientes */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                EXPEDIENTES SIN ASIGNAR
              </label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input value={searchExp} onChange={e => setSearchExp(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && buscarExp()}
                  placeholder="Buscar expediente..." style={{
                    flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13
                  }} />
                <button onClick={buscarExp} style={{
                  padding: '8px 14px', background: '#39A900', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13
                }}>Buscar</button>
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 220, overflowY: 'auto' }}>
                {expSinAsignar.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Sin expedientes disponibles</div>
                ) : expSinAsignar.map(e => (
                  <label key={e.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                    cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                    background: selectedExps.includes(e.id) ? '#f0fdf4' : '#fff'
                  }}>
                    <input type="checkbox" checked={selectedExps.includes(e.id)}
                      onChange={() => toggleExp(e.id)} style={{ accentColor: '#39A900', width: 15, height: 15 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111' }}>
                        {e.expediente_code || `#${e.id}`} — {e.title?.substring(0, 50)}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        {e.dependencia || 'Sin dep.'} · {e.doc_count} doc(s)
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                {selectedExps.length} expediente(s) seleccionado(s)
              </div>
            </div>

            {/* Observaciones */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                OBSERVACIONES (opcional)
              </label>
              <textarea value={obsModal} onChange={e => setObsModal(e.target.value)} rows={2}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                placeholder="Instrucciones o notas..." />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{
                padding: '9px 20px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13
              }}>Cancelar</button>
              <button onClick={guardarAsignacion} disabled={saving} style={{
                padding: '9px 20px', background: saving ? '#9ca3af' : '#39A900', color: '#fff',
                border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13
              }}>
                {saving ? 'Guardando...' : `Asignar (${selectedExps.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
