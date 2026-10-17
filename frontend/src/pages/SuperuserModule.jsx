import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Database, Trash2, Edit2, Save, X, Calendar, AlertTriangle, RefreshCw, 
  ShieldAlert, CheckCircle2, Activity, Wifi, Clock, UserCheck, FileText, Search, Users, Download,
  Server, Cpu, HardDrive, Zap, PlayCircle, ShieldCheck
} from 'lucide-react';

const API_URL = '/api/superuser';

const SuperuserModule = () => {
  const [activeSection, setActiveSection] = useState('server_monitor'); // 'server_monitor', 'bitacora', 'online_users', 'explorer', 'reportes'
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [data, setData] = useState({ columns: [], rows: [] });
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [expirationDate, setExpirationDate] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // ── Monitoreo de Servidor y Sistema ─────────────────
  const [serverStatus, setServerStatus] = useState(null);
  const [serverLoading, setServerLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [autoRefreshServer, setAutoRefreshServer] = useState(true);

  // ── Reportes Excel ─────────────────────────────────
  const [reportDate, setReportDate] = useState('');
  const [loadingAesReport, setLoadingAesReport] = useState(false);
  const [loadingNoCodeReport, setLoadingNoCodeReport] = useState(false);

  // ── Monitoreo y Bitácora ──────────────────────────
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [logsSearch, setLogsSearch] = useState('');
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  const [confirmText, setConfirmText] = useState('');
  const [limpiandо, setLimpiando] = useState(false);
  const [resultadoLimpieza, setResultadoLimpieza] = useState(null);

  const filteredLogs = auditLogs.filter(log => {
    if (!logsSearch) return true;
    const term = logsSearch.toLowerCase();
    return (
      (log.user_name && log.user_name.toLowerCase().includes(term)) ||
      (log.user_role && log.user_role.toLowerCase().includes(term)) ||
      (log.action && log.action.toLowerCase().includes(term)) ||
      (log.details && log.details.toLowerCase().includes(term)) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(term))
    );
  });

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();

  useEffect(() => {
    if (currentUser.role === 'superadmin' || currentUser.role === 'admin') {
      fetchServerStatus();
      fetchTables();
      fetchExpirationDate();
      fetchOnlineUsers();
      fetchAuditLogs();
    }
  }, []);

  // Intervalo de auto-refresco del estado del servidor cada 5 segundos si está activo
  useEffect(() => {
    let interval = null;
    if (autoRefreshServer && activeSection === 'server_monitor') {
      interval = setInterval(() => {
        fetchServerStatus(true);
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefreshServer, activeSection]);

  const fetchServerStatus = async (isSilent = false) => {
    if (!isSilent) setServerLoading(true);
    try {
      const res = await axios.get(`${API_URL}/server-status`, { headers });
      if (res.data?.success) {
        setServerStatus(res.data);
      }
    } catch (err) {
      if (!isSilent) showError('Error al consultar métricas del servidor');
    } finally {
      if (!isSilent) setServerLoading(false);
    }
  };

  const handleServerAction = async (action, target = '') => {
    setActionLoading(`${action}_${target}`);
    try {
      const res = await axios.post(`${API_URL}/server-action`, { action, target }, { headers });
      showSuccess(res.data?.message || 'Acción completada.');
      setTimeout(() => fetchServerStatus(true), 1500);
    } catch (err) {
      showError(err.response?.data?.error || 'Error al ejecutar acción en el servidor');
    } finally {
      setActionLoading('');
    }
  };

  if (currentUser.role !== 'superadmin' && currentUser.role !== 'admin') {
    return (
      <div className="p-12 text-center">
        <div className="max-w-md mx-auto bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
          <ShieldAlert size={48} className="text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Acceso Restringido</h2>
          <p className="text-sm text-gray-500 mb-6">
            El Módulo de Gestión Superadmin está reservado para administradores del sistema. Tu usuario es <strong>{currentUser.name || currentUser.username || 'Jesús'}</strong> (Rol: <strong>{currentUser.role || 'usuario'}</strong>).
          </p>
          <a href="/dashboard" className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">
            Volver al Dashboard
          </a>
        </div>
      </div>
    );
  }

  const fetchExpirationDate = async () => {
    try {
      const res = await axios.get('/api/settings/system_expiration_date', { headers });
      if (res.data && res.data.value) {
        setExpirationDate(res.data.value);
      }
    } catch (err) {
      console.error("Error fetching expiration date:", err);
    }
  };

  const fetchTables = async () => {
    try {
      const res = await axios.get(`${API_URL}/tables`, { headers });
      setTables(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setTables([]);
      showError('Error cargando tablas');
    }
  };

  const fetchOnlineUsers = async () => {
    setOnlineLoading(true);
    try {
      const res = await axios.get(`${API_URL}/online-users`, { headers });
      setOnlineUsers(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setOnlineUsers([]);
      showError('Error cargando usuarios conectados');
    } finally {
      setOnlineLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/audit-logs`, { headers });
      setAuditLogs(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setAuditLogs([]);
      showError('Error cargando bitácora de auditoría');
    } finally {
      setLogsLoading(false);
    }
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'Sin actividad reciente';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Hace unos segundos';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} hr`;
    return `Hace ${diffDays} día(s) (${date.toLocaleDateString()})`;
  };

  const handleTableSelect = async (tableName) => {
    setSelectedTable(tableName);
    setActiveSection('explorer');
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/table/${tableName}`, { headers });
      setData({
        columns: Array.isArray(res.data?.columns) ? res.data.columns : [],
        rows: Array.isArray(res.data?.rows) ? res.data.rows : []
      });
      setEditingRow(null);
    } catch (err) {
      setData({ columns: [], rows: [] });
      showError(`Error cargando tabla ${tableName}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este registro?')) return;
    try {
      await axios.delete(`${API_URL}/table/${selectedTable}/${id}`, { headers });
      setData({ ...data, rows: data.rows.filter(r => r.id !== id) });
      showSuccess('Registro eliminado');
    } catch (err) {
      showError('Error al eliminar');
    }
  };

  const startEdit = (row) => {
    setEditingRow(row.id);
    setEditValues({ ...row });
  };

  const handleUpdate = async () => {
    try {
      await axios.put(`${API_URL}/table/${selectedTable}/${editingRow}`, editValues, { headers });
      setData({
        ...data,
        rows: data.rows.map(r => r.id === editingRow ? editValues : r)
      });
      setEditingRow(null);
      showSuccess('Registro actualizado');
    } catch (err) {
      showError('Error al actualizar');
    }
  };

  const updateExpiration = async () => {
    try {
      await axios.post(`${API_URL}/set-expiration`, { date: expirationDate }, { headers });
      showSuccess('Fecha de caducidad actualizada');
    } catch (err) {
      showError('Error al actualizar caducidad');
    }
  };

  // ── Limpieza masiva de expedientes ──────────────────────────
  const handleLimpiezaMasiva = async () => {
    if (confirmText !== 'ELIMINAR') return;
    setLimpiando(true);
    setResultadoLimpieza(null);
    try {
      const res = await axios.post(
        `${API_URL}/limpiar-expedientes`,
        { confirmacion: 'ELIMINAR' },
        { headers }
      );
      setResultadoLimpieza(res.data.eliminados);
      setConfirmText('');
      // Refrescar tabla activa si es expedientes o documents
      if (selectedTable === 'expedientes' || selectedTable === 'documents') {
        handleTableSelect(selectedTable);
      }
      showSuccess(`✓ ${res.data.eliminados.expedientes} expedientes y ${res.data.eliminados.documentos} documentos eliminados.`);
    } catch (err) {
      showError(err.response?.data?.error || 'Error al ejecutar la limpieza');
    } finally {
      setLimpiando(false);
    }
  };

  const showError = (text) => setMessage({ type: 'error', text });
  const showSuccess = (text) => {
    setMessage({ type: 'success', text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const downloadAesReport = async () => {
    setLoadingAesReport(true);
    try {
      const res = await axios.get(`${API_URL}/reports/aes-loaded`, {
        headers,
        params: { date: reportDate },
        responseType: 'blob'
      });
      
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', reportDate ? `Reporte_AES_Cargados_${reportDate}.xlsx` : 'Reporte_AES_Cargados_Todos.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showSuccess('Reporte de cargados en AES descargado con éxito.');
    } catch (err) {
      console.error("Error downloading AES report:", err);
      showError('Error al descargar el reporte de cargados en AES.');
    } finally {
      setLoadingAesReport(false);
    }
  };

  const downloadNoCodeReport = async () => {
    setLoadingNoCodeReport(true);
    try {
      const res = await axios.get(`${API_URL}/reports/no-code-documents`, {
        headers,
        responseType: 'blob'
      });
      
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Expedientes_Sin_Codigo_Para_Regional.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showSuccess('Reporte para la Regional descargado con éxito.');
    } catch (err) {
      console.error("Error downloading no code report:", err);
      showError('Error al descargar el reporte para la Regional.');
    } finally {
      setLoadingNoCodeReport(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 p-2 rounded-lg text-white">
              <Database size={28} />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Módulo de Gestión Superadmin</h1>
          </div>

          <div className="flex items-center gap-4 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
            <Calendar size={20} className="text-purple-600" />
            <span className="text-sm font-medium text-gray-600">Caducidad del Sistema:</span>
            <input
              type="date"
              className="border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
            />
            <button
              onClick={updateExpiration}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              Establecer
            </button>
          </div>
        </header>

        {message.text && (
          <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${message.type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'
            }`}>
            {message.type === 'error' ? <AlertTriangle size={20} /> : <div className="w-2 h-2 rounded-full bg-green-500" />}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar - Navigation */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-fit flex flex-col gap-4 p-4">
            
            {/* Sección de Monitoreo */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">Monitoreo y Control</h3>
              <div className="space-y-1">
                <button
                  onClick={() => { setActiveSection('server_monitor'); fetchServerStatus(); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between ${
                    activeSection === 'server_monitor'
                      ? 'bg-purple-600 text-white font-semibold shadow-sm'
                      : 'text-gray-700 hover:bg-purple-50 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Server size={16} className={activeSection === 'server_monitor' ? 'text-white' : 'text-purple-600'} />
                    <span>Estado del Servidor</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeSection === 'server_monitor' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'}`}>
                    En Vivo
                  </span>
                </button>
                <button
                  onClick={() => { setActiveSection('bitacora'); fetchAuditLogs(); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between ${
                    activeSection === 'bitacora'
                      ? 'bg-purple-50 text-purple-700 font-semibold shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Activity size={16} className={activeSection === 'bitacora' ? 'text-purple-600' : 'text-gray-400'} />
                    <span>Bitácora de Actividad</span>
                  </div>
                  <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">Bitácora</span>
                </button>
                <button
                  onClick={() => { setActiveSection('online_users'); fetchOnlineUsers(); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between ${
                    activeSection === 'online_users'
                      ? 'bg-purple-50 text-purple-700 font-semibold shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Wifi size={16} className={activeSection === 'online_users' ? 'text-purple-600' : 'text-gray-400'} />
                    <span>Usuarios Conectados</span>
                  </div>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                </button>
                <button
                  onClick={() => { setActiveSection('reportes'); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between ${
                    activeSection === 'reportes'
                      ? 'bg-purple-50 text-purple-700 font-semibold shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText size={16} className={activeSection === 'reportes' ? 'text-purple-600' : 'text-gray-400'} />
                    <span>Reportes Excel</span>
                  </div>
                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">Nuevo</span>
                </button>
              </div>
            </div>

            {/* Sección de Explorador */}
            <div>
              <div className="flex justify-between items-center mb-2 px-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Explorador de Datos</h3>
                <button onClick={fetchTables} className="text-gray-400 hover:text-purple-600 transition-colors">
                  <RefreshCw size={12} />
                </button>
              </div>
              <div className="space-y-1 max-h-[40vh] overflow-y-auto pr-1">
                {tables.map(table => (
                  <button
                    key={table}
                    onClick={() => handleTableSelect(table)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                      activeSection === 'explorer' && selectedTable === table
                        ? 'bg-purple-50 text-purple-700 font-semibold shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Database size={14} className={activeSection === 'explorer' && selectedTable === table ? 'text-purple-600' : 'text-gray-400'} />
                    <span className="truncate">{table}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content - Dynamic Section Panels */}
          <div className="md:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            
            {/* 0. SECCIÓN: MONITOREO DE SERVIDOR Y SISTEMA EN VIVO */}
            {activeSection === 'server_monitor' && (
              <div className="p-6 space-y-6">
                {/* Header de la sección */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                      </span>
                      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Server size={20} className="text-purple-600" />
                        Monitoreo del Servidor del Sistema
                      </h2>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Métricas en tiempo real de CPU, Memoria RAM, Almacenamiento, Procesos PM2 y Base de Datos PostgreSQL.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                      <input 
                        type="checkbox" 
                        checked={autoRefreshServer} 
                        onChange={(e) => setAutoRefreshServer(e.target.checked)}
                        className="rounded text-purple-600 focus:ring-purple-500" 
                      />
                      <span>Auto-refresco (5s)</span>
                    </label>

                    <button
                      onClick={() => fetchServerStatus()}
                      disabled={serverLoading}
                      className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all"
                    >
                      <RefreshCw size={13} className={serverLoading ? 'animate-spin' : ''} />
                      <span>{serverLoading ? 'Actualizando...' : 'Refrescar'}</span>
                    </button>
                  </div>
                </div>

                {serverLoading && !serverStatus ? (
                  <div className="p-16 text-center text-gray-400">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-sm font-medium">Obteniendo telemetría del servidor...</p>
                  </div>
                ) : serverStatus ? (
                  <div className="space-y-6">

                    {/* Tarjetas de Métricas Principales */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      
                      {/* 1. CPU */}
                      <div className="bg-gradient-to-br from-purple-50 to-white p-4 rounded-xl border border-purple-100 shadow-sm">
                        <div className="flex items-center justify-between text-purple-700 mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider">CPU / Procesador</span>
                          <Cpu size={18} />
                        </div>
                        <div className="text-2xl font-black text-gray-800">
                          {serverStatus.os?.cpuCount} Cores
                        </div>
                        <div className="text-xs text-gray-500 mt-1 truncate" title={serverStatus.os?.cpuModel}>
                          {serverStatus.os?.cpuModel}
                        </div>
                        <div className="mt-3 pt-2 border-t border-purple-100 flex justify-between text-[11px] text-gray-500">
                          <span>Carga (1m / 5m):</span>
                          <span className="font-mono font-semibold text-purple-700">
                            {serverStatus.os?.loadAvg ? `${serverStatus.os.loadAvg[0].toFixed(2)} / ${serverStatus.os.loadAvg[1].toFixed(2)}` : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* 2. Memoria RAM */}
                      <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-xl border border-blue-100 shadow-sm">
                        <div className="flex items-center justify-between text-blue-700 mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider">Memoria RAM</span>
                          <Zap size={18} />
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-gray-800">{serverStatus.os?.usedMemMB}</span>
                          <span className="text-xs text-gray-400">/ {serverStatus.os?.totalMemMB} MB</span>
                        </div>
                        <div className="w-full bg-blue-100 rounded-full h-2 mt-2 overflow-hidden">
                          <div 
                            className={`h-2 rounded-full transition-all duration-500 ${
                              serverStatus.os?.memPercent > 85 ? 'bg-red-500' : serverStatus.os?.memPercent > 70 ? 'bg-amber-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${Math.min(100, serverStatus.os?.memPercent || 0)}%` }}
                          />
                        </div>
                        <div className="mt-2.5 flex justify-between text-[11px] text-gray-500">
                          <span>Uso actual:</span>
                          <span className="font-bold text-blue-700">{serverStatus.os?.memPercent}%</span>
                        </div>
                      </div>

                      {/* 3. Base de Datos PostgreSQL */}
                      <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-xl border border-emerald-100 shadow-sm">
                        <div className="flex items-center justify-between text-emerald-700 mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider">PostgreSQL</span>
                          <Database size={18} />
                        </div>
                        <div className="text-2xl font-black text-gray-800">
                          {serverStatus.stats?.totalExpedientes}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Expedientes registrados
                        </div>
                        <div className="mt-3 pt-2 border-t border-emerald-100 flex justify-between text-[11px] text-gray-500">
                          <span>Documentos:</span>
                          <span className="font-semibold text-emerald-700">
                            {serverStatus.stats?.docsCargados} cargados / {serverStatus.stats?.totalDocumentos} tot.
                          </span>
                        </div>
                      </div>

                      {/* 4. Servidor Uptime y Host */}
                      <div className="bg-gradient-to-br from-amber-50 to-white p-4 rounded-xl border border-amber-100 shadow-sm">
                        <div className="flex items-center justify-between text-amber-700 mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider">Host & Uptime</span>
                          <Clock size={18} />
                        </div>
                        <div className="text-lg font-bold text-gray-800 truncate" title={serverStatus.os?.hostname}>
                          {serverStatus.os?.hostname || 'Servidor SENA'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {serverStatus.os?.platform} ({serverStatus.os?.release})
                        </div>
                        <div className="mt-3 pt-2 border-t border-amber-100 flex justify-between text-[11px] text-gray-500">
                          <span>Activo desde:</span>
                          <span className="font-bold text-amber-700">
                            {serverStatus.os?.uptimeSeconds 
                              ? `${Math.floor(serverStatus.os.uptimeSeconds / 86400)}d ${Math.floor((serverStatus.os.uptimeSeconds % 86400) / 3600)}h`
                              : '0h'}
                          </span>
                        </div>
                      </div>

                    </div>

                    {/* Estado de Servicios Vitales y Almacenamiento */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                      {/* Servicios Vitales */}
                      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                          <ShieldCheck size={16} className="text-green-600" />
                          Servicios del Sistema
                        </h3>
                        <div className="space-y-2.5">
                          {serverStatus.services?.map((svc, sIdx) => (
                            <div key={sIdx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                              <div className="flex items-center gap-2.5">
                                <span className={`w-2.5 h-2.5 rounded-full ${svc.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
                                <div>
                                  <div className="text-xs font-bold text-gray-800">{svc.name}</div>
                                  <div className="text-[11px] text-gray-500">{svc.details}</div>
                                </div>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                svc.status === 'healthy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {svc.status === 'healthy' ? 'OPERATIVO' : 'FALLA'}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Botón de Mantenimiento de BD */}
                        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                          <button
                            onClick={() => handleServerAction('vacuum_db')}
                            disabled={actionLoading === 'vacuum_db_'}
                            className="text-xs text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5"
                          >
                            <Database size={13} />
                            <span>{actionLoading === 'vacuum_db_' ? 'Optimizando...' : 'Optimizar Base de Datos (VACUUM)'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Espacio en Disco */}
                      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                            <HardDrive size={16} className="text-blue-600" />
                            Almacenamiento en Disco
                          </h3>
                          {serverStatus.disks && serverStatus.disks.length > 0 ? (
                            <div className="space-y-3">
                              {serverStatus.disks.map((d, dIdx) => (
                                <div key={dIdx} className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-gray-800 truncate max-w-[200px]" title={d.filesystem}>
                                      {d.mount} ({d.filesystem})
                                    </span>
                                    <span className="font-semibold text-gray-700">{d.used} de {d.size} ({d.usePercent})</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                    <div 
                                      className="bg-blue-600 h-2 rounded-full"
                                      style={{ width: d.usePercent || '0%' }}
                                    />
                                  </div>
                                  <div className="text-[10px] text-gray-400 mt-1">Disponible: {d.avail}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-6 text-center text-xs text-gray-400">
                              Información de almacenamiento no disponible para esta plataforma.
                            </div>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                          <button
                            onClick={() => handleServerAction('flush_pm2_logs')}
                            disabled={actionLoading === 'flush_pm2_logs_'}
                            className="text-xs text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5"
                          >
                            <Trash2 size={13} />
                            <span>{actionLoading === 'flush_pm2_logs_' ? 'Vaciando...' : 'Vaciar Logs PM2'}</span>
                          </button>
                        </div>
                      </div>

                    </div>

                    {/* Procesos en Segundo Plano (PM2) */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                          <Zap size={16} className="text-purple-600" />
                          Procesos en Segundo Plano (PM2 Cluster)
                        </h3>
                        <span className="text-[11px] text-gray-400">
                          {serverStatus.pm2?.length || 0} aplicación(es) monitoreada(s)
                        </span>
                      </div>

                      {serverStatus.pm2 && serverStatus.pm2.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-semibold border-b border-gray-200">
                              <tr>
                                <th className="p-2.5">ID</th>
                                <th className="p-2.5">Proceso</th>
                                <th className="p-2.5">Estado</th>
                                <th className="p-2.5">CPU</th>
                                <th className="p-2.5">Memoria</th>
                                <th className="p-2.5">Reinicios</th>
                                <th className="p-2.5 text-right">Acción</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {serverStatus.pm2.map((p) => (
                                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="p-2.5 font-mono text-gray-400">#{p.id}</td>
                                  <td className="p-2.5 font-bold text-gray-800">{p.name}</td>
                                  <td className="p-2.5">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      p.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                                      {p.status}
                                    </span>
                                  </td>
                                  <td className="p-2.5 font-mono">{p.cpu}%</td>
                                  <td className="p-2.5 font-mono">{p.memory}</td>
                                  <td className="p-2.5 font-mono text-gray-500">{p.restarts}</td>
                                  <td className="p-2.5 text-right">
                                    <button
                                      onClick={() => handleServerAction('restart_process', p.name)}
                                      disabled={actionLoading === `restart_process_${p.name}`}
                                      className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded transition-colors inline-flex items-center gap-1"
                                      title={`Reiniciar proceso ${p.name}`}
                                    >
                                      <RefreshCw size={11} className={actionLoading === `restart_process_${p.name}` ? 'animate-spin' : ''} />
                                      <span>Reiniciar</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-6 text-center text-xs text-gray-400">
                          No se encontraron procesos PM2 activos en este entorno.
                        </div>
                      )}
                    </div>

                  </div>
                ) : null}
              </div>
            )}

            {/* 1. SECCIÓN: BITÁCORA DE ACTIVIDAD */}
            {activeSection === 'bitacora' && (
              <div>
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                      <Activity size={18} className="text-purple-600" />
                      Bitácora de Actividad del Sistema
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">Historial detallado de los últimos 500 cambios de estado realizados.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Buscar en la bitácora..."
                        value={logsSearch}
                        onChange={(e) => setLogsSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs border rounded-lg w-full sm:w-[220px] focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                      <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                    </div>
                    <button 
                      onClick={fetchAuditLogs} 
                      disabled={logsLoading}
                      className="p-1.5 text-gray-400 hover:text-purple-600 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <RefreshCw size={14} className={logsLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                  {logsLoading ? (
                    <div className="p-12 text-center text-gray-400">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                      Cargando bitácora...
                    </div>
                  ) : filteredLogs.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                      No se encontraron registros en la bitácora.
                    </div>
                  ) : (
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold sticky top-0 bg-gray-50 shadow-sm z-10">
                        <tr>
                          <th className="px-4 py-3 border-b border-gray-100">Fecha y Hora</th>
                          <th className="px-4 py-3 border-b border-gray-100">Usuario</th>
                          <th className="px-4 py-3 border-b border-gray-100">Acción</th>
                          <th className="px-4 py-3 border-b border-gray-100">Detalles</th>
                          <th className="px-4 py-3 border-b border-gray-100">Dirección IP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredLogs.map(log => (
                          <tr key={log.id} className="hover:bg-gray-50/55 transition-colors">
                            <td className="px-4 py-3 text-gray-600 font-mono text-xs whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-800">{log.user_name}</div>
                              <div className="text-[10px] text-purple-600 font-semibold uppercase">{log.user_role}</div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold mr-1.5 ${
                                log.action.startsWith('POST') ? 'bg-green-100 text-green-700' :
                                log.action.startsWith('PUT') ? 'bg-blue-100 text-blue-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {log.action.split(' ')[0]}
                              </span>
                              {log.action.split(' ').slice(1).join(' ')}
                            </td>
                            <td className="px-4 py-3 max-w-[280px]">
                              {log.details ? (
                                <pre className="text-[10px] bg-gray-50 p-2 rounded max-h-[80px] overflow-y-auto overflow-x-auto font-mono text-gray-600 border border-gray-100">
                                  {(() => {
                                    if (typeof log.details !== 'string') return JSON.stringify(log.details, null, 2);
                                    try {
                                      return JSON.stringify(JSON.parse(log.details), null, 2);
                                    } catch (e) {
                                      return log.details;
                                    }
                                  })()}
                                </pre>
                              ) : (
                                <span className="text-gray-400 text-xs italic">Sin detalles</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                              {log.ip_address}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* 2. SECCIÓN: USUARIOS CONECTADOS */}
            {activeSection === 'online_users' && (
              <div>
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                      <Users size={18} className="text-purple-600" />
                      Monitoreo de Usuarios en Tiempo Real
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">Control de actividad y estado de conexión de los usuarios registrados.</p>
                  </div>
                  <button 
                    onClick={fetchOnlineUsers} 
                    disabled={onlineLoading}
                    className="p-1.5 text-gray-400 hover:text-purple-600 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <RefreshCw size={14} className={onlineLoading ? 'animate-spin' : ''} />
                  </button>
                </div>

                <div className="p-6">
                  {onlineLoading ? (
                    <div className="p-12 text-center text-gray-400">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                      Cargando estados de conexión...
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {onlineUsers.map(user => (
                        <div key={user.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="font-semibold text-gray-800 text-sm leading-snug">{user.full_name}</h3>
                                <p className="text-xs text-gray-500 font-mono mt-0.5">{user.email || 'sin-correo@sena.edu.co'}</p>
                              </div>
                              
                              {/* Indicador de conexión */}
                              {user.is_online ? (
                                <span className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                                  <span className="flex h-1.5 w-1.5 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                                  </span>
                                  Activo
                                </span>
                              ) : (
                                <span className="inline-flex items-center bg-gray-50 border border-gray-200 text-gray-500 text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0">
                                  Inactivo
                                </span>
                              )}
                            </div>

                            <div className="space-y-1 text-xs text-gray-600 border-t border-gray-100 pt-2.5">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Rol:</span>
                                <span className="font-semibold uppercase text-purple-600">{user.role}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Cédula:</span>
                                <span className="font-mono">{user.document_no}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Cargo:</span>
                                <span className="truncate max-w-[150px] font-medium">{user.position || 'No especificado'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Área:</span>
                                <span className="truncate max-w-[150px] font-medium">{user.area || 'No especificada'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3.5 border-t border-gray-100 pt-2.5 flex items-center justify-between text-[11px] text-gray-500">
                            <div className="flex items-center gap-1 text-gray-400">
                              <Clock size={12} />
                              <span>Última Actividad:</span>
                            </div>
                            <span className={`font-medium ${user.is_online ? 'text-green-600 font-bold' : 'text-gray-600'}`}>
                              {formatRelativeTime(user.last_activity)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. SECCIÓN: EXPLORADOR DE TABLAS (ZONA POR DEFECTO ANTERIOR) */}
            {activeSection === 'explorer' && (
              <div>
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                  <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                    <Database size={18} className="text-purple-600" />
                    Explorador de Datos: <span className="text-purple-600">{selectedTable}</span>
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="p-12 text-center text-gray-400">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                      Cargando datos...
                    </div>
                  ) : (
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
                        <tr>
                          {data.columns.map(col => (
                            <th key={col} className="px-4 py-3 border-b border-gray-100">{col}</th>
                          ))}
                          <th className="px-4 py-3 border-b border-gray-100 sticky right-0 bg-gray-50">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.rows.map(row => (
                          <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                            {data.columns.map(col => (
                              <td key={col} className="px-4 py-2 text-gray-600 max-w-[200px] truncate">
                                {editingRow === row.id ? (
                                  col === 'id' ? row[col] : (
                                    <input
                                      className="border rounded px-2 py-1 w-full focus:ring-1 focus:ring-purple-500 outline-none"
                                      value={editValues[col] || ''}
                                      onChange={(e) => setEditValues({ ...editValues, [col]: e.target.value })}
                                    />
                                  )
                                ) : (
                                  String(row[col])
                                )}
                              </td>
                            ))}
                            <td className="px-4 py-2 sticky right-0 bg-white/80 backdrop-blur-sm border-l border-gray-50">
                              <div className="flex gap-2">
                                {editingRow === row.id ? (
                                  <>
                                    <button onClick={handleUpdate} className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors">
                                      <Save size={18} />
                                    </button>
                                    <button onClick={() => setEditingRow(null)} className="p-1 text-gray-500 hover:bg-gray-50 rounded transition-colors">
                                      <X size={18} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => startEdit(row)} className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors">
                                      <Edit2 size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(row.id)} className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors">
                                      <Trash2 size={18} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                {!loading && data.rows.length === 0 && (
                  <div className="p-12 text-center text-gray-400">
                    Esta tabla está vacía.
                  </div>
                )}
              </div>
            )}

            {/* 4. SECCIÓN: REPORTES EXCEL */}
            {activeSection === 'reportes' && (
              <div className="p-6">
                <div className="border-b border-gray-100 pb-4 mb-6">
                  <h2 className="font-semibold text-gray-700 flex items-center gap-2 text-lg">
                    <FileText size={20} className="text-purple-600" />
                    Generación de Reportes Excel
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Descarga reportes especializados y plantillas en formato Excel para la gestión de expedientes.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Tarjeta 1: AES Cargados */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="bg-purple-100 p-2.5 rounded-xl text-purple-700">
                          <CheckCircle2 size={24} />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-800 text-sm leading-snug">Expedientes Cargados en AES</h3>
                          <p className="text-xs text-purple-600 font-semibold uppercase">OnBase / AES</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                        Genera un reporte detallado con los datos de todos los expedientes y sus respectivos archivos que ya han sido cargados en AES. Puedes especificar una fecha de cargue para filtrar los resultados.
                      </p>

                      <div className="space-y-2 mb-6">
                        <label className="text-xs font-semibold text-gray-600 block">Fecha de Cargue Específica (Opcional):</label>
                        <div className="flex items-center gap-2">
                          <Calendar size={16} className="text-gray-400" />
                          <input
                            type="date"
                            value={reportDate}
                            onChange={(e) => setReportDate(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-xs w-full focus:ring-2 focus:ring-purple-500 outline-none"
                          />
                          {reportDate && (
                            <button
                              onClick={() => setReportDate('')}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1"
                              title="Limpiar fecha"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={downloadAesReport}
                      disabled={loadingAesReport}
                      className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-sm"
                    >
                      {loadingAesReport ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          Generando...
                        </>
                      ) : (
                        <>
                          <Download size={16} />
                          Descargar Reporte AES
                        </>
                      )}
                    </button>
                  </div>

                  {/* Tarjeta 2: Expedientes sin código */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="bg-green-100 p-2.5 rounded-xl text-green-700">
                          <AlertTriangle size={24} />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-800 text-sm leading-snug">Expedientes Sin Código (Para Regional)</h3>
                          <p className="text-xs text-green-600 font-semibold uppercase">Plantilla de Creación</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                        Obtiene el listado de expedientes que tienen documentos guardados en el almacenamiento local pero no poseen un Código de Expediente en la base de datos. Se exporta con la estructura y metadatos (Valor 1 a 8) requeridos para enviarse a la Regional.
                      </p>
                    </div>

                    <div className="mt-auto pt-6">
                      <button
                        onClick={downloadNoCodeReport}
                        disabled={loadingNoCodeReport}
                        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-sm"
                      >
                        {loadingNoCodeReport ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            Generando...
                          </>
                        ) : (
                          <>
                            <Download size={16} />
                            Descargar Listado Regional
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── ZONA PELIGROSA ─────────────────────────────────────────── */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
          <div className="p-4 border-b border-red-100 bg-red-50 flex items-center gap-3">
            <ShieldAlert size={20} className="text-red-600" />
            <h2 className="font-bold text-red-700">Zona Peligrosa — Eliminación Masiva de Expedientes</h2>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

              {/* Descripción */}
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  Esta acción eliminará <strong>todos los expedientes y documentos</strong> registrados
                  en el sistema de forma permanente. Las secuencias de IDs serán reiniciadas a 1.
                </p>
                <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside mb-4">
                  <li>Se eliminarán todos los registros de la tabla <code className="bg-gray-100 px-1 rounded">expedientes</code></li>
                  <li>Se eliminarán todos los registros de la tabla <code className="bg-gray-100 px-1 rounded">documents</code></li>
                  <li>Los IDs volverán a comenzar desde 1</li>
                  <li>Los archivos físicos en el servidor NO se eliminan por esta acción</li>
                </ul>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm text-amber-700">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>Esta acción es <strong>irreversible</strong>. Asegúrate de tener un respaldo antes de continuar.</span>
                </div>
              </div>

              {/* Panel de confirmación */}
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  Para confirmar, escribe <span className="font-mono text-red-600 bg-red-50 px-1 rounded">ELIMINAR</span> en el campo:
                </p>
                <input
                  id="confirm-delete-input"
                  type="text"
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none transition-colors mb-4"
                  placeholder="Escribe ELIMINAR para confirmar"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={limpiandо}
                />
                <button
                  id="btn-limpiar-expedientes"
                  onClick={handleLimpiezaMasiva}
                  disabled={confirmText !== 'ELIMINAR' || limpiandо}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    confirmText === 'ELIMINAR' && !limpiandо
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-lg'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {limpiandо ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Eliminar todos los expedientes
                    </>
                  )}
                </button>

                {/* Resultado */}
                {resultadoLimpieza && (
                  <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                    <CheckCircle2 size={20} className="text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-green-700">Limpieza completada</p>
                      <p className="text-sm text-green-600 mt-1">
                        <strong>{resultadoLimpieza.expedientes}</strong> expedientes eliminados<br />
                        <strong>{resultadoLimpieza.documentos}</strong> documentos eliminados<br />
                        <span className="text-xs text-green-500">IDs reiniciados desde 1</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SuperuserModule;
