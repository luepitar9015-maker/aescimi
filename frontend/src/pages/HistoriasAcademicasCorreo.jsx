import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Mail, FolderCheck, Search, RefreshCw, CheckCircle, Upload,
  FileText, Users, Eye, Trash2, Play, Square, ShieldCheck, PlusCircle
} from 'lucide-react';

export default function HistoriasAcademicasCorreo() {
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';

  const [activeTab, setActiveTab] = useState('historias'); // 'historias' | 'bandeja' | 'sync' | 'coordinaciones'
  const [typologies, setTypologies] = useState([]);
  const [toast, setToast] = useState(null);

  // ── TAB 1: BANDEJA DE VERIFICACIÓN CORREO -> PDF ──
  const [bandejaItems, setBandejaItems] = useState([]);
  const [bandejaStatus, setBandejaStatus] = useState('Pendiente');
  const [bandejaSearch, setBandejaSearch] = useState('');
  const [loadingBandeja, setLoadingBandeja] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedBandejaIds, setSelectedBandejaIds] = useState(new Set());
  const [approvingId, setApprovingId] = useState(null);
  const [expSearchQuery, setExpSearchQuery] = useState('');
  const [expSearchResults, setExpSearchResults] = useState([]);
  const [editApprovalForm, setEditApprovalForm] = useState({
    expediente_id: '',
    typology_name: '',
    pdf_mode: 'UNIFICADO',
    document_date: ''
  });

  // ── TAB 2: SINCRONIZACIÓN OUTLOOK 365 + IMPORTACIÓN ──
  const [mailboxEmail, setMailboxEmail] = useState('leparadam@sena.edu.co');
  const [mailboxPass, setMailboxPass] = useState('');
  const [folderName, setFolderName] = useState('Bandeja de entrada');
  const [outlookQuery, setOutlookQuery] = useState('');
  const [maxMsgs, setMaxMsgs] = useState(30);
  const [outlookStatus, setOutlookStatus] = useState({
    isRunning: false,
    status: 'idle',
    logs: [],
    stats: {},
    mfaNumber: null,
    authPrompt: null,
    lastFrame: null
  });
  const [manualInputText, setManualInputText] = useState('');
  const [importFiles, setImportFiles] = useState([]);
  const [importing, setImporting] = useState(false);
  const [liveTypeInput, setLiveTypeInput] = useState('');
  const syncPollRef = useRef(null);

  // ── TAB 3: AUDITORÍA DE HISTORIAS ACADÉMICAS Y 36 TIPOLOGÍAS ──
  const [historias, setHistorias] = useState([]);
  const [histKpis, setHistKpis] = useState({});
  const [histTotalMatch, setHistTotalMatch] = useState(0);
  const [histSearch, setHistSearch] = useState('');
  const [histCodeFilter, setHistCodeFilter] = useState('all');
  const [histDocsFilter, setHistDocsFilter] = useState('all');
  const [onlyMine, setOnlyMine] = useState(!isAdmin);
  const [loadingHistorias, setLoadingHistorias] = useState(false);
  const [detailModal, setDetailModal] = useState(null); // { expediente, documents, typology_matrix }
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [uploadTypTarget, setUploadTypTarget] = useState('');
  const [uploadTypFiles, setUploadTypFiles] = useState([]);
  const [uploadTypDate, setUploadTypDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [uploadTypNote, setUploadTypNote] = useState('');
  const [uploadingDirectPdf, setUploadingDirectPdf] = useState(false);

  // ── TAB 4: ASIGNACIÓN A USUARIOS DE COORDINACIONES ──
  const [coordUsers, setCoordUsers] = useState([]);
  const [coordFichas, setCoordFichas] = useState([]);
  const [selectedCoordUserId, setSelectedCoordUserId] = useState('');
  const [selectedFichasSet, setSelectedFichasSet] = useState(new Set());
  const [fichaSearch, setFichaSearch] = useState('');
  const [assigningCoord, setAssigningCoord] = useState(false);

  const showNotice = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 6000);
  };

  // Cargar las 36 tipologías oficiales
  useEffect(() => {
    axios.get('/api/historias-academicas/typologies')
      .then(res => setTypologies(res.data?.data || []))
      .catch(() => {});
  }, []);

  const fetchBandeja = useCallback(async () => {
    setLoadingBandeja(true);
    try {
      const res = await axios.get('/api/historias-academicas/bandeja', {
        params: { status: bandejaStatus, search: bandejaSearch }
      });
      const rows = res.data?.data || [];
      setBandejaItems(rows);
      if (rows.length > 0 && !selectedItem) {
        selectBandejaRow(rows[0]);
      }
    } catch (err) {
      console.error('Error cargando bandeja:', err);
    } finally {
      setLoadingBandeja(false);
    }
  }, [bandejaStatus, bandejaSearch]);

  const fetchHistorias = useCallback(async () => {
    setLoadingHistorias(true);
    try {
      const res = await axios.get('/api/historias-academicas/expedientes', {
        params: {
          search: histSearch,
          code_filter: histCodeFilter,
          docs_filter: histDocsFilter,
          only_mine: onlyMine ? 'true' : 'false',
          limit: 200
        }
      });
      setHistorias(res.data?.data || []);
      setHistKpis(res.data?.kpis || {});
      setHistTotalMatch(res.data?.total_matching || 0);
    } catch (err) {
      console.error('Error cargando historias académicas:', err);
    } finally {
      setLoadingHistorias(false);
    }
  }, [histSearch, histCodeFilter, histDocsFilter, onlyMine]);

  const fetchCoordinaciones = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await axios.get('/api/historias-academicas/coordinaciones');
      setCoordUsers(res.data?.users || []);
      setCoordFichas(res.data?.fichas || []);
    } catch (err) {
      console.error('Error cargando coordinaciones:', err);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab === 'bandeja') fetchBandeja();
    else if (activeTab === 'historias') fetchHistorias();
    else if (activeTab === 'coordinaciones') fetchCoordinaciones();
  }, [activeTab, fetchBandeja, fetchHistorias, fetchCoordinaciones]);

  // Polling cuando está en la pestaña de sincronización Outlook
  useEffect(() => {
    if (activeTab !== 'sync') {
      if (syncPollRef.current) clearInterval(syncPollRef.current);
      return;
    }
    const poll = async () => {
      try {
        const res = await axios.get('/api/historias-academicas/outlook/status');
        setOutlookStatus(res.data || {});
      } catch (_) {}
    };
    poll();
    syncPollRef.current = setInterval(poll, 2200);
    return () => { if (syncPollRef.current) clearInterval(syncPollRef.current); };
  }, [activeTab]);

  const selectBandejaRow = (row) => {
    setSelectedItem(row);
    setEditApprovalForm({
      expediente_id: row.matched_expediente_id || '',
      typology_name: row.suggested_typology_name || (typologies[0]?.typology_name || ''),
      pdf_mode: row.pdf_mode || 'UNIFICADO',
      document_date: row.email_date ? new Date(row.email_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
    });
    setExpSearchResults([]);
    setExpSearchQuery('');
  };

  const handleSearchExpForManualLink = async (q) => {
    setExpSearchQuery(q);
    if (!q || q.trim().length < 3) {
      setExpSearchResults([]);
      return;
    }
    try {
      const res = await axios.get('/api/historias-academicas/expedientes', {
        params: { search: q.trim(), limit: 15 }
      });
      setExpSearchResults(res.data?.data || []);
    } catch (_) {}
  };

  const handleApproveSingle = async () => {
    if (!selectedItem) return;
    if (!editApprovalForm.expediente_id) {
      return alert('Seleccione el expediente de Historia Académica del aprendiz.');
    }
    setApprovingId(selectedItem.id);
    try {
      const res = await axios.post(`/api/historias-academicas/bandeja/${selectedItem.id}/aprobar`, editApprovalForm);
      showNotice('success', res.data?.message || 'PDF generado y asignado exitosamente.');
      setSelectedItem(null);
      fetchBandeja();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al generar y asignar PDF.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleApproveBatch = async () => {
    const ids = Array.from(selectedBandejaIds);
    if (ids.length === 0) return alert('Seleccione al menos un correo con expediente identificado.');
    setApprovingId('BATCH');
    try {
      const res = await axios.post('/api/historias-academicas/bandeja/aprobar-lote', { ids });
      showNotice('success', res.data?.message || 'Lote procesado.');
      setSelectedBandejaIds(new Set());
      fetchBandeja();
    } catch (err) {
      alert(err.response?.data?.error || 'Error en aprobación por lote.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleDiscardItem = async (id) => {
    if (!window.confirm('¿Descartar este correo de la bandeja pendiente?')) return;
    try {
      await axios.delete(`/api/historias-academicas/bandeja/${id}`);
      if (selectedItem?.id === id) setSelectedItem(null);
      fetchBandeja();
    } catch (_) {}
  };

  const handleStartOutlookSync = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/historias-academicas/outlook/start', {
        mailbox_email: mailboxEmail,
        password: mailboxPass,
        folder_name: folderName,
        search_query: outlookQuery,
        max_messages: maxMsgs
      });
      setMailboxPass('');
      showNotice('info', 'Sincronización Outlook 365 iniciada. Observe el visor en vivo.');
    } catch (err) {
      alert(err.response?.data?.error || 'Error iniciando Outlook 365.');
    }
  };

  const handleStopOutlookSync = async (closeBrowser = false) => {
    try {
      await axios.post('/api/historias-academicas/outlook/stop', { close_browser: closeBrowser });
    } catch (_) {}
  };

  const handleFrameClick = async (e) => {
    if (!outlookStatus.lastFrame) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = 1366 / rect.width;
    const scaleY = 820 / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    try {
      const res = await axios.post('/api/historias-academicas/outlook/interact', { type: 'click', x, y });
      if (res.data?.lastFrame) setOutlookStatus(p => ({ ...p, lastFrame: res.data.lastFrame }));
    } catch (_) {}
  };

  const handleSendLiveText = async (e) => {
    e.preventDefault();
    if (!liveTypeInput) return;
    try {
      const res = await axios.post('/api/historias-academicas/outlook/interact', {
        type: 'type',
        text: liveTypeInput,
        pressEnter: true
      });
      setLiveTypeInput('');
      if (res.data?.lastFrame) setOutlookStatus(p => ({ ...p, lastFrame: res.data.lastFrame }));
    } catch (_) {}
  };

  const handleManualImport = async (e) => {
    e.preventDefault();
    if (importFiles.length === 0 && !manualInputText.trim()) {
      return alert('Adjunte archivos (.pdf, .eml, .docx, imagen) o pegue el texto del correo.');
    }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('raw_email_text', manualInputText);
      fd.append('mailbox_email', mailboxEmail);
      Array.from(importFiles).forEach(f => fd.append('files', f));
      const res = await axios.post('/api/historias-academicas/bandeja/importar', fd);
      showNotice('success', res.data?.message || 'Importación completada.');
      setManualInputText('');
      setImportFiles([]);
      setActiveTab('bandeja');
    } catch (err) {
      alert(err.response?.data?.error || 'Error importando archivos.');
    } finally {
      setImporting(false);
    }
  };

  const openHistoriaDetail = async (expId) => {
    setLoadingDetail(true);
    try {
      const res = await axios.get(`/api/historias-academicas/expedientes/${expId}/detalle`);
      setDetailModal(res.data);
      setUploadTypTarget(res.data?.typology_matrix?.[0]?.typology_name || '');
      setUploadTypFiles([]);
      setUploadTypNote('');
    } catch (err) {
      alert(err.response?.data?.error || 'Error cargando detalle de Historia Académica.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDirectUploadToTypology = async (e) => {
    e.preventDefault();
    if (!detailModal?.expediente?.id) return;
    if (!uploadTypTarget) return alert('Seleccione una tipología.');
    if (uploadTypFiles.length === 0 && !uploadTypNote.trim()) {
      return alert('Seleccione al menos un archivo (PDF, Imagen o Word) o ingrese una nota/correo para convertir a PDF.');
    }
    setUploadingDirectPdf(true);
    try {
      const fd = new FormData();
      fd.append('typology_name', uploadTypTarget);
      fd.append('document_date', uploadTypDate);
      fd.append('note_text', uploadTypNote);
      Array.from(uploadTypFiles).forEach(f => fd.append('files', f));
      const res = await axios.post(
        `/api/historias-academicas/expedientes/${detailModal.expediente.id}/subir-pdf-tipologia`,
        fd
      );
      showNotice('success', res.data?.message || 'PDF guardado correctamente.');
      setUploadTypFiles([]);
      setUploadTypNote('');
      await openHistoriaDetail(detailModal.expediente.id);
      fetchHistorias();
    } catch (err) {
      alert(err.response?.data?.error || 'Error subiendo documento.');
    } finally {
      setUploadingDirectPdf(false);
    }
  };

  const handleToggleUserMenuAccess = async (u) => {
    const nextVal = u.has_menu_access === 1 ? 0 : 1;
    try {
      await axios.post('/api/permissions/user-modules/assign', {
        user_id: u.id,
        module_id: 'historias-academicas',
        can_view: nextVal
      });
      fetchCoordinaciones();
      showNotice('success', `Acceso al menú ${nextVal === 1 ? 'habilitado' : 'retirado'} para ${u.full_name}.`);
    } catch (err) {
      alert(err.response?.data?.error || 'Error cambiando acceso.');
    }
  };

  const handleEnableAllFormacion = async () => {
    const ids = coordUsers.filter(u => u.organization_id === 8 || u.organization_id === 7).map(u => u.id);
    if (ids.length === 0) return;
    try {
      await axios.post('/api/permissions/user-modules/assign', {
        user_ids: ids,
        module_id: 'historias-academicas',
        can_view: 1
      });
      fetchCoordinaciones();
      showNotice('success', `Menú habilitado para los ${ids.length} usuarios activos de Coordinaciones.`);
    } catch (err) {
      alert(err.response?.data?.error || 'Error habilitando en bloque.');
    }
  };

  const handleAssignFichasToCoordinator = async () => {
    if (!selectedCoordUserId) return alert('Seleccione primero el usuario de Coordinación.');
    const fichasArr = Array.from(selectedFichasSet);
    if (fichasArr.length === 0) return alert('Seleccione al menos una Ficha para asignar.');
    setAssigningCoord(true);
    try {
      const res = await axios.post('/api/historias-academicas/coordinaciones/asignar', {
        user_id: selectedCoordUserId,
        fichas: fichasArr,
        grant_menu_access: true
      });
      showNotice('success', res.data?.message || 'Fichas asignadas.');
      setSelectedFichasSet(new Set());
      fetchCoordinaciones();
    } catch (err) {
      alert(err.response?.data?.error || 'Error asignando fichas.');
    } finally {
      setAssigningCoord(false);
    }
  };

  // Agrupar las 36 tipologías por etapa para los <optgroup>
  const groupedTypologies = {
    '1. Ingreso': typologies.filter(t => (t.stage || '').includes('Ingreso')),
    '2. Ejecución': typologies.filter(t => (t.stage || '').includes('Ejecuci')),
    '3. Certificación': typologies.filter(t => (t.stage || '').includes('Certificaci'))
  };

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, color: '#00324d', fontSize: 23, display: 'flex', alignItems: 'center', gap: 10 }}>
            <FolderCheck size={26} color="#39a900" />
            Historias Académicas (68.9224.4-37) · Validación TRD y Sincronización de Correo
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
            Verificación integral de Historias Académicas registradas, validación de las <strong>36 Tipologías Documentales</strong>, conversión a PDF y sincronización con correo institucional.
          </p>
        </div>
      </div>

      {toast && (
        <div style={{
          padding: '11px 16px',
          borderRadius: 10,
          marginBottom: 14,
          fontWeight: 700,
          fontSize: 13,
          background: toast.type === 'success' ? '#dcfce7' : '#e0f2fe',
          color: toast.type === 'success' ? '#166534' : '#075985',
          border: `1px solid ${toast.type === 'success' ? '#86efac' : '#7dd3fc'}`
        }}>
          {toast.text}
        </div>
      )}

      {/* Pestañas Principales */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '2px solid #e2e8f0', marginBottom: 18 }}>
        {[
          { id: 'historias', label: '🎓 1. Historias Académicas y 36 Tipologías' },
          { id: 'bandeja', label: '📥 2. Bandeja Verificación Correo → PDF' },
          { id: 'sync', label: '📧 3. Sincronizar Correo (Outlook 365 / Archivos)' },
          ...(isAdmin ? [{ id: 'coordinaciones', label: '👥 4. Asignar a Usuarios de Coordinaciones' }] : [])
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px',
              borderRadius: '10px 10px 0 0',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: 13,
              background: activeTab === tab.id ? '#00324d' : '#f1f5f9',
              color: activeTab === tab.id ? '#ffffff' : '#334155',
              borderBottom: activeTab === tab.id ? '3px solid #39a900' : 'none'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          PESTAÑA 1: HISTORIAS ACADÉMICAS REGISTRADAS Y MATRIZ DE 36 TIPOLOGÍAS
         ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'historias' && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>TOTAL HISTORIAS (68.9224.4-37)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#00324d' }}>{histKpis.total_historias || 0}</div>
            </div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>CON DOCUMENTOS PDF</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#15803d' }}>{histKpis.con_documentos || 0}</div>
            </div>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b' }}>SIN DOCUMENTOS (0 PDFs)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>{histKpis.sin_documentos || 0}</div>
            </div>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af' }}>CON CÓDIGO AES / SIN CÓDIGO</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1e3a8a' }}>
                {histKpis.con_codigo_aes || 0} <span style={{ fontSize: 13, color: '#64748b' }}>/ {histKpis.sin_codigo_aes || 0}</span>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14, background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{ position: 'relative', flex: '1 1 280px' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Buscar por Aprendiz, Cédula/TI/PPT, Número de Ficha o Código EX..."
                value={histSearch}
                onChange={e => setHistSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
            </div>
            <select value={histDocsFilter} onChange={e => setHistDocsFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5 }}>
              <option value="all">Documentos: Todos</option>
              <option value="con_docs">Con Documentos (&gt;0 PDFs)</option>
              <option value="sin_docs">Sin Documentos (0 PDFs)</option>
            </select>
            <select value={histCodeFilter} onChange={e => setHistCodeFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5 }}>
              <option value="all">Código AES: Todos</option>
              <option value="con_codigo">Con Código EX</option>
              <option value="sin_codigo">Sin Código EX</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#00324d', cursor: 'pointer' }}>
              <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} />
              Solo Mis Asignadas
            </label>
            <button onClick={fetchHistorias} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5 }}>
              <RefreshCw size={14} className={loadingHistorias ? 'animate-spin' : ''} /> Filtrar ({histTotalMatch})
            </button>
          </div>

          {/* Tabla de Historias Académicas */}
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#00324d', color: '#fff', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Código AES</th>
                  <th style={{ padding: '10px 12px' }}>Ficha</th>
                  <th style={{ padding: '10px 12px' }}>Identificación</th>
                  <th style={{ padding: '10px 12px' }}>Aprendiz</th>
                  <th style={{ padding: '10px 12px' }}>Programa de Formación</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>PDFs</th>
                  <th style={{ padding: '10px 12px' }}>Responsable Asignado</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {historias.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>
                      {loadingHistorias ? 'Cargando Historias Académicas...' : 'No se encontraron Historias Académicas con este filtro. (Desmarque "Solo Mis Asignadas" para ver todas).'}
                    </td>
                  </tr>
                ) : (
                  historias.map(h => (
                    <tr key={h.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 800, color: h.expediente_code ? '#15803d' : '#94a3b8' }}>
                        {h.expediente_code || 'Sin código'}
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: 800, color: '#00324d' }}>{h.ficha || '—'}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{h.doc_tipo} {h.doc_numero}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#0f172a' }}>{h.aprendiz_nombre}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11.5, color: '#475569', maxWidth: 280 }}>{h.programa}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 9px',
                          borderRadius: 99,
                          fontWeight: 800,
                          fontSize: 11.5,
                          background: h.docs_count > 0 ? '#dcfce7' : '#fee2e2',
                          color: h.docs_count > 0 ? '#166534' : '#991b1b'
                        }}>
                          {h.docs_count} PDF(s)
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 11.5, color: '#334155' }}>{h.assigned_names || '—'}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                        <button
                          onClick={() => openHistoriaDetail(h.id)}
                          style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#00324d', color: '#fff', fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}
                        >
                          Validar Tipologías / PDF
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          PESTAÑA 2: BANDEJA DE VERIFICACIÓN DE CORREOS -> CONVERSIÓN PDF Y TIPOLOGÍA
         ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'bandeja' && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedItem ? '1.15fr 1fr' : '1fr', gap: 16 }}>
          {/* Columna Izquierda: Lista de Correos / Soportes */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {['Pendiente', 'Verificado_Asignado', 'Todos'].map(st => (
                  <button
                    key={st}
                    onClick={() => setBandejaStatus(st)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 7,
                      border: '1px solid #cbd5e1',
                      background: bandejaStatus === st ? '#00324d' : '#fff',
                      color: bandejaStatus === st ? '#fff' : '#334155',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    {st === 'Verificado_Asignado' ? 'Ya Asignados (PDF)' : st}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {selectedBandejaIds.size > 0 && (
                  <button
                    onClick={handleApproveBatch}
                    disabled={approvingId === 'BATCH'}
                    style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#39a900', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                  >
                    ⚡ Guardar y Asignar en Lote ({selectedBandejaIds.size})
                  </button>
                )}
                <button onClick={fetchBandeja} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}>
                  <RefreshCw size={14} className={loadingBandeja ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <input
              type="text"
              placeholder="Filtrar bandeja por asunto, aprendiz, cédula, ficha o radicado..."
              value={bandejaSearch}
              onChange={e => setBandejaSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, marginBottom: 12 }}
            />

            {bandejaItems.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                No hay correos en estado <strong>{bandejaStatus}</strong>. Use la pestaña <strong>3. Sincronizar Correo</strong> para escanear su buzón Outlook 365 o importar archivos.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 620, overflowY: 'auto' }}>
                {bandejaItems.map(item => {
                  const isSel = selectedItem?.id === item.id;
                  const checked = selectedBandejaIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => selectBandejaRow(item)}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        border: isSel ? '2px solid #39a900' : '1px solid #e2e8f0',
                        background: isSel ? '#f0fdf4' : '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {item.verification_status === 'Pendiente' && item.matched_expediente_id && (
                            <input
                              type="checkbox"
                              checked={checked}
                              onClick={e => e.stopPropagation()}
                              onChange={e => {
                                setSelectedBandejaIds(prev => {
                                  const n = new Set(prev);
                                  if (e.target.checked) n.add(item.id);
                                  else n.delete(item.id);
                                  return n;
                                });
                              }}
                            />
                          )}
                          <strong style={{ fontSize: 13, color: '#0f172a' }}>{item.subject}</strong>
                        </div>
                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 99,
                          background: item.matched_expediente_id ? '#dcfce7' : '#fef3c7',
                          color: item.matched_expediente_id ? '#166534' : '#92400e',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.matched_expediente_id ? `Ficha ${item.detected_ficha}` : 'Asignar Manual'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#475569', marginTop: 4 }}>
                        {item.detected_aprendiz_nombre
                          ? `👤 ${item.detected_doc_tipo} ${item.detected_doc_numero} · ${item.detected_aprendiz_nombre}`
                          : `De: ${item.sender_email || ''}`}
                      </div>
                      <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 700, marginTop: 4 }}>
                        📑 Tipología sugerida: {item.suggested_typology_name}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Columna Derecha: Validador y Asignador a PDF */}
          {selectedItem && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, color: '#00324d', fontSize: 16 }}>
                  🔎 Verificación y Asignación Documental a PDF
                </h3>
                {selectedItem.verification_status === 'Pendiente' && (
                  <button
                    onClick={() => handleDiscardItem(selectedItem.id)}
                    style={{ background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Trash2 size={13} /> Descartar
                  </button>
                )}
              </div>

              {/* 1. Expediente Destino */}
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#00324d', marginBottom: 4 }}>
                  1. Historia Académica Destino (68.9224.4-37):
                </label>
                {editApprovalForm.expediente_id ? (
                  <div style={{ fontSize: 12.5, color: '#166534', fontWeight: 700, marginBottom: 6 }}>
                    ✅ Vinculado a ID #{editApprovalForm.expediente_id} · {selectedItem.detected_aprendiz_nombre || selectedItem.matched_expediente_title} (Ficha {selectedItem.detected_ficha || '—'})
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#b45309', fontWeight: 700, marginBottom: 6 }}>
                    ⚠️ Busque abajo al aprendiz por cédula, nombre o ficha para vincularlo:
                  </div>
                )}
                <input
                  type="text"
                  placeholder="Cambiar o buscar aprendiz por cédula, nombre o ficha..."
                  value={expSearchQuery}
                  onChange={e => handleSearchExpForManualLink(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                />
                {expSearchResults.length > 0 && (
                  <div style={{ marginTop: 6, maxHeight: 150, overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff' }}>
                    {expSearchResults.map(er => (
                      <div
                        key={er.id}
                        onClick={() => {
                          setEditApprovalForm(p => ({ ...p, expediente_id: er.id }));
                          setSelectedItem(p => ({
                            ...p,
                            matched_expediente_id: er.id,
                            detected_ficha: er.ficha,
                            detected_doc_tipo: er.doc_tipo,
                            detected_doc_numero: er.doc_numero,
                            detected_aprendiz_nombre: er.aprendiz_nombre
                          }));
                          setExpSearchResults([]);
                          setExpSearchQuery('');
                        }}
                        style={{ padding: '6px 10px', fontSize: 12, borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                      >
                        <strong>Ficha {er.ficha}</strong> · {er.doc_tipo} {er.doc_numero} · {er.aprendiz_nombre} ({er.docs_count} PDFs)
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Selección entre las 36 Tipologías Oficiales */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#00324d', marginBottom: 4 }}>
                  2. Tipología Documental Oficial a Asignar (36 Tipologías TRD):
                </label>
                <select
                  value={editApprovalForm.typology_name}
                  onChange={e => setEditApprovalForm(p => ({ ...p, typology_name: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #39a900', fontSize: 12, fontWeight: 700 }}
                >
                  {Object.entries(groupedTypologies).map(([stageLabel, list]) => (
                    <optgroup key={stageLabel} label={`── ${stageLabel} ──`}>
                      {list.map(t => (
                        <option key={t.id} value={t.typology_name}>{t.typology_name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* 3. Modo de Conversión a PDF y Fecha */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#00324d', marginBottom: 4 }}>
                    3. Modo de Guardado en PDF:
                  </label>
                  <select
                    value={editApprovalForm.pdf_mode}
                    onChange={e => setEditApprovalForm(p => ({ ...p, pdf_mode: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  >
                    <option value="UNIFICADO">Correo + Adjuntos en 1 solo PDF</option>
                    <option value="SOLO_ADJUNTO">Solo Archivo(s) Adjunto(s) PDF</option>
                    <option value="SOLO_CORREO">Solo Cuerpo del Correo a PDF</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#00324d', marginBottom: 4 }}>
                    Fecha Creación Doc.:
                  </label>
                  <input
                    type="date"
                    value={editApprovalForm.document_date}
                    onChange={e => setEditApprovalForm(p => ({ ...p, document_date: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                </div>
              </div>

              {selectedItem.verification_status === 'Verificado_Asignado' && selectedItem.generated_document_id ? (
                <a
                  href={`/api/ades/view/${selectedItem.generated_document_id}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 11, borderRadius: 9, background: '#15803d', color: '#fff', fontWeight: 800, textDecoration: 'none', marginBottom: 14 }}
                >
                  <Eye size={16} /> Ver PDF Ya Guardado en el Expediente (#{selectedItem.generated_document_id})
                </a>
              ) : (
                <button
                  onClick={handleApproveSingle}
                  disabled={approvingId === selectedItem.id}
                  style={{ width: '100%', padding: '11px 16px', borderRadius: 9, border: 'none', background: '#39a900', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', marginBottom: 14 }}
                >
                  {approvingId === selectedItem.id ? 'Generando PDF y Asignando...' : '✅ Verificar, Guardar en PDF y Asignar a la Historia Académica'}
                </button>
              )}

              {/* Vista previa del contenido del correo */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#475569', marginBottom: 6 }}>
                  Vista Previa del Correo / Contenido Detectado:
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, maxHeight: 250, overflowY: 'auto', fontSize: 11.5, whiteSpace: 'pre-wrap', color: '#1e293b' }}>
                  {selectedItem.body_text || '(Sin texto en el cuerpo — archivo adjunto directo)'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          PESTAÑA 3: SINCRONIZAR MI CORREO (OUTLOOK 365 EN VIVO + CARGA RÁPIDA)
         ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sync' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 18 }}>
          {/* Izquierda: Formulario Outlook 365 + Carga Rápida de Archivos/Texto */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 10px', color: '#00324d', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={19} color="#39a900" />
                1. Sincronización Directa con Correo Institucional (Outlook 365)
              </h3>
              <form onSubmit={handleStartOutlookSync} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Correo Institucional (@sena.edu.co):</label>
                  <input
                    type="email"
                    required
                    value={mailboxEmail}
                    onChange={e => setMailboxEmail(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 3 }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Contraseña (solo si pide login):</label>
                    <input
                      type="password"
                      placeholder="Sesión persistente"
                      value={mailboxPass}
                      onChange={e => setMailboxPass(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 3 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Carpeta del Buzón:</label>
                    <select
                      value={folderName}
                      onChange={e => setFolderName(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 3 }}
                    >
                      <option value="Bandeja de entrada">Bandeja de entrada</option>
                      <option value="Elementos enviados">Elementos enviados</option>
                      <option value="Producidas">Carpeta Producidas</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Filtro opcional en Outlook (Ficha / Palabra clave):</label>
                    <input
                      type="text"
                      placeholder="Ej: etapa productiva, novedad, 3139626..."
                      value={outlookQuery}
                      onChange={e => setOutlookQuery(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 3 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700 }}>Máx. correos:</label>
                    <input
                      type="number"
                      min={5}
                      max={80}
                      value={maxMsgs}
                      onChange={e => setMaxMsgs(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 3 }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    type="submit"
                    disabled={outlookStatus.isRunning}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: 'none', background: '#39a900', color: '#fff', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Play size={15} /> {outlookStatus.isRunning ? 'Sincronizando Buzón...' : 'Conectar y Sincronizar Correo'}
                  </button>
                  {outlookStatus.isRunning && (
                    <button
                      type="button"
                      onClick={() => handleStopOutlookSync(false)}
                      style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <Square size={14} /> Detener
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Importación Rápida de Soportes / EML / Texto */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 8px', color: '#00324d', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Upload size={19} color="#0284c7" />
                2. Carga Rápida de Correos (.eml / Texto) o Soportes (.pdf / .docx / Imagen)
              </h3>
              <form onSubmit={handleManualImport} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.eml,.docx,.png,.jpg,.jpeg"
                  onChange={e => setImportFiles(e.target.files)}
                  style={{ padding: 8, border: '1px dashed #94a3b8', borderRadius: 8, fontSize: 12 }}
                />
                <textarea
                  rows={4}
                  placeholder="Opcional: pegue aquí el texto del correo electrónico para convertirlo en PDF y cruzarlo automáticamente con el aprendiz..."
                  value={manualInputText}
                  onChange={e => setManualInputText(e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                />
                <button
                  type="submit"
                  disabled={importing}
                  style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: '#00324d', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                >
                  {importing ? 'Analizando y Cruzando...' : '📥 Procesar y Enviar a Bandeja de Verificación'}
                </button>
              </form>
            </div>
          </div>

          {/* Derecha: Visor Interactivo en Vivo de Outlook 365 + Bitácora */}
          <div style={{ background: '#0f172a', color: '#fff', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 13 }}>🖥️ Visor en Vivo Buzón Outlook 365 (Servidor)</strong>
              <span style={{ fontSize: 11.5, color: '#86efac', fontWeight: 700 }}>
                Escaneados: {outlookStatus.stats?.scanned || 0} · Nuevos: {outlookStatus.stats?.savedToInbox || 0} · Cruzados: {outlookStatus.stats?.matched || 0}
              </span>
            </div>

            {outlookStatus.mfaNumber && (
              <div style={{ background: '#fef08a', color: '#713f12', padding: '10px 14px', borderRadius: 8, fontWeight: 800, textAlign: 'center', fontSize: 15 }}>
                🔐 Apruebe en Microsoft Authenticator el número: <span style={{ fontSize: 22, padding: '2px 10px', background: '#fff', borderRadius: 6 }}>{outlookStatus.mfaNumber}</span>
              </div>
            )}

            <div style={{ background: '#020617', borderRadius: 8, minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #334155' }}>
              {outlookStatus.lastFrame ? (
                <img
                  src={outlookStatus.lastFrame}
                  alt="Visor Outlook 365"
                  onClick={handleFrameClick}
                  style={{ width: '100%', cursor: 'crosshair', display: 'block' }}
                  title="Haga clic sobre cualquier elemento para interactuar con Outlook"
                />
              ) : (
                <span style={{ color: '#64748b', fontSize: 12.5 }}>
                  Pulse &ldquo;Conectar y Sincronizar Correo&rdquo; para abrir su buzón institucional.
                </span>
              )}
            </div>

            <form onSubmit={handleSendLiveText} style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="Enviar texto o contraseña al visor activo y pulsar Enter..."
                value={liveTypeInput}
                onChange={e => setLiveTypeInput(e.target.value)}
                style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid #475569', background: '#1e293b', color: '#fff', fontSize: 12 }}
              />
              <button type="submit" style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#39a900', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                Enviar
              </button>
            </form>

            <div style={{ background: '#020617', borderRadius: 8, padding: 10, height: 150, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11.5, color: '#cbd5e1' }}>
              {(outlookStatus.logs || []).length === 0
                ? 'Sin actividad reciente.'
                : outlookStatus.logs.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          PESTAÑA 4: ASIGNACIÓN A USUARIOS DE COORDINACIONES (MENÚ + FICHAS)
         ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'coordinaciones' && isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 18 }}>
          {/* Izquierda: Usuarios de Coordinaciones y Permiso de Menú */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: '#00324d', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={19} color="#39a900" />
                Usuarios de Coordinaciones (Acceso al Menú)
              </h3>
              <button
                onClick={handleEnableAllFormacion}
                style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#00324d', color: '#fff', fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}
              >
                ✅ Habilitar a Todas las Coordinaciones
              </button>
            </div>
            <div style={{ maxHeight: 540, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', color: '#0f172a', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px' }}>Funcionario / Instructor</th>
                    <th style={{ padding: '8px 10px' }}>Coordinación</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Historias Asignadas</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Ver Menú</th>
                  </tr>
                </thead>
                <tbody>
                  {coordUsers.map(u => (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedCoordUserId(String(u.id))}
                      style={{
                        borderTop: '1px solid #e2e8f0',
                        background: String(selectedCoordUserId) === String(u.id) ? '#f0fdf4' : '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{u.full_name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{u.position || 'Funcionario'} · Doc: {u.document_no}</div>
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 11, color: '#334155' }}>
                        {u.subsection_code || '9224'} {u.subsection_name ? `· ${u.subsection_name.slice(0, 28)}...` : ''}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#00324d' }}>
                        {u.assigned_historias_count || 0}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleUserMenuAccess(u)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 99,
                            border: 'none',
                            fontWeight: 800,
                            fontSize: 11,
                            cursor: 'pointer',
                            background: u.root_admin || u.role === 'admin' || u.has_menu_access === 1 ? '#dcfce7' : '#e2e8f0',
                            color: u.role === 'admin' || u.has_menu_access === 1 ? '#166534' : '#475569'
                          }}
                        >
                          {u.role === 'admin' ? 'Admin' : (u.has_menu_access === 1 ? 'Activo ✓' : 'Inactivo')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Derecha: Asignación de Fichas de Historias Académicas al Usuario Seleccionado */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 10px', color: '#00324d', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={19} color="#39a900" />
              Asignar Fichas de Historias Académicas a Usuario de Coordinación
            </h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <select
                value={selectedCoordUserId}
                onChange={e => setSelectedCoordUserId(e.target.value)}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #00324d', fontWeight: 700, fontSize: 12.5 }}
              >
                <option value="">-- Seleccione Usuario de Coordinación Destino --</option>
                {coordUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.position || 'Coordinación'} - {u.subsection_code || '9224'})
                  </option>
                ))}
              </select>
              <button
                onClick={handleAssignFichasToCoordinator}
                disabled={assigningCoord || !selectedCoordUserId || selectedFichasSet.size === 0}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#39a900', color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}
              >
                {assigningCoord ? 'Asignando...' : `Asignar Fichas (${selectedFichasSet.size})`}
              </button>
            </div>

            <input
              type="text"
              placeholder="Buscar ficha o programa (ej. 3433784, Soldadura, Software)..."
              value={fichaSearch}
              onChange={e => setFichaSearch(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, marginBottom: 10 }}
            />

            <div style={{ maxHeight: 470, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', color: '#0f172a', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px', width: 32 }}></th>
                    <th style={{ padding: '8px 10px' }}>Ficha</th>
                    <th style={{ padding: '8px 10px' }}>Programa</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Con PDF / Sin PDF</th>
                    <th style={{ padding: '8px 10px' }}>Responsables</th>
                  </tr>
                </thead>
                <tbody>
                  {coordFichas
                    .filter(f => !fichaSearch || `${f.ficha} ${f.programa} ${f.responsables || ''}`.toLowerCase().includes(fichaSearch.toLowerCase()))
                    .slice(0, 200)
                    .map(f => {
                      const isChecked = selectedFichasSet.has(f.ficha);
                      return (
                        <tr key={f.ficha} style={{ borderTop: '1px solid #e2e8f0', background: isChecked ? '#f0fdf4' : '#fff' }}>
                          <td style={{ padding: '7px 10px' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                setSelectedFichasSet(prev => {
                                  const n = new Set(prev);
                                  if (e.target.checked) n.add(f.ficha);
                                  else n.delete(f.ficha);
                                  return n;
                                });
                              }}
                            />
                          </td>
                          <td style={{ padding: '7px 10px', fontWeight: 800, color: '#00324d' }}>{f.ficha}</td>
                          <td style={{ padding: '7px 10px', fontSize: 11.5, color: '#334155' }}>{f.programa}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700 }}>
                            <span style={{ color: '#15803d' }}>{f.con_docs}</span> / <span style={{ color: f.sin_docs > 0 ? '#dc2626' : '#64748b' }}>{f.sin_docs}</span>
                          </td>
                          <td style={{ padding: '7px 10px', fontSize: 11, color: '#475569' }}>{f.responsables || 'Sin asignar'}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          MODAL DETALLE DE HISTORIA ACADÉMICA + CHECKLIST DE 36 TIPOLOGÍAS Y CARGA PDF
         ═══════════════════════════════════════════════════════════════════════════ */}
      {(detailModal || loadingDetail) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 1120, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 14px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ background: '#00324d', color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17 }}>
                  {loadingDetail
                    ? 'Cargando Historia Académica...'
                    : `🎓 ${detailModal.expediente.doc_tipo} ${detailModal.expediente.doc_numero} · ${detailModal.expediente.aprendiz_nombre} (Ficha ${detailModal.expediente.ficha})`}
                </h3>
                {!loadingDetail && (
                  <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                    Código AES: <strong>{detailModal.expediente.expediente_code || 'Pendiente de crear'}</strong> · Programa: {detailModal.expediente.programa} · Total PDFs: <strong>{detailModal.documents.length}</strong>
                  </div>
                )}
              </div>
              <button
                onClick={() => setDetailModal(null)}
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 800 }}
              >
                Cerrar ✕
              </button>
            </div>

            {!loadingDetail && detailModal && (
              <div style={{ padding: 18, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 18 }}>
                {/* Izquierda: Checklist de las 36 Tipologías Oficiales */}
                <div>
                  <h4 style={{ margin: '0 0 10px', color: '#00324d' }}>
                    Matriz de Verificación de las 36 Tipologías Documentales (68.9224.4-37)
                  </h4>
                  <div style={{ maxHeight: 520, overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: 10 }}>
                    {['1. Ingreso', '2. Ejecución', '3. Certificación'].map(stageName => {
                      const items = (detailModal.typology_matrix || []).filter(t => (t.stage || '').includes(stageName.slice(3, 9)));
                      return (
                        <div key={stageName}>
                          <div style={{ background: '#f1f5f9', padding: '7px 12px', fontWeight: 800, fontSize: 12, color: '#00324d', borderBottom: '1px solid #cbd5e1' }}>
                            Etapa {stageName} ({items.filter(x => x.has_documents).length}/{items.length} con soporte)
                          </div>
                          {items.map(t => (
                            <div
                              key={t.id}
                              onClick={() => setUploadTypTarget(t.typology_name)}
                              style={{
                                padding: '8px 12px',
                                borderBottom: '1px solid #f1f5f9',
                                background: uploadTypTarget === t.typology_name ? '#eff6ff' : (t.has_documents ? '#f0fdf4' : '#fff'),
                                cursor: 'pointer',
                                fontSize: 11.5
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: t.has_documents ? 800 : 600, color: t.has_documents ? '#14532d' : '#334155' }}>
                                  {t.has_documents ? '✅ ' : '⚪ '} {t.typology_name}
                                </span>
                                <span style={{ fontSize: 10.5, color: '#2563eb', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  + Asignar PDF
                                </span>
                              </div>
                              {t.documents && t.documents.length > 0 && (
                                <div style={{ marginTop: 5, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  {t.documents.map(doc => (
                                    <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '4px 8px', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                                      <span>
                                        <FileText size={11} style={{ display: 'inline', marginRight: 4, color: '#15803d' }} />
                                        <strong>{doc.filename}</strong> ({doc.status} {doc.page_count ? `· ${doc.page_count} folios` : ''} · {doc.disk_ok ? 'Disco OK' : '⚠️ Ruta'})
                                      </span>
                                      <a href={`/api/ades/view/${doc.id}`} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', fontWeight: 800, textDecoration: 'none' }}>
                                        Ver PDF
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Derecha: Guardar / Convertir Nuevo PDF en la Tipología Seleccionada */}
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, border: '1px solid #cbd5e1', alignSelf: 'start' }}>
                  <h4 style={{ margin: '0 0 10px', color: '#00324d', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PlusCircle size={18} color="#39a900" />
                    Guardar PDF y Asignar a Tipología del Aprendiz
                  </h4>
                  <form onSubmit={handleDirectUploadToTypology} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Tipología Documental Destino:</label>
                      <select
                        value={uploadTypTarget}
                        onChange={e => setUploadTypTarget(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #39a900', fontSize: 11.5, fontWeight: 700 }}
                      >
                        {(detailModal.typology_matrix || []).map(t => (
                          <option key={t.id} value={t.typology_name}>
                            [{t.stage}] {t.typology_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Fecha de Creación del Documento:</label>
                      <input
                        type="date"
                        required
                        value={uploadTypDate}
                        onChange={e => setUploadTypDate(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Archivo(s) Soporte (.pdf, Imagen o .docx):</label>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.docx"
                        onChange={e => setUploadTypFiles(e.target.files)}
                        style={{ width: '100%', padding: 8, background: '#fff', borderRadius: 8, border: '1px dashed #64748b', fontSize: 12 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Texto / Correo opcional para incluir o convertir a PDF:</label>
                      <textarea
                        rows={4}
                        placeholder="Si pega aquí un correo o acta de verificación, se convertirá automáticamente en PDF oficial (y se unirá a los adjuntos si seleccionó archivos)..."
                        value={uploadTypNote}
                        onChange={e => setUploadTypNote(e.target.value)}
                        style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12 }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={uploadingDirectPdf}
                      style={{ padding: '11px 16px', borderRadius: 9, border: 'none', background: '#39a900', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                    >
                      {uploadingDirectPdf ? 'Convirtiendo y Guardando en Disco...' : '💾 Guardar en PDF y Asignar al Expediente'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
