import { useState, useEffect, useCallback, Fragment } from 'react';
import axios from 'axios';
import {
  Clock, CheckCircle, Download, Mail, RefreshCw, Search,
  ChevronDown, ChevronRight, Settings, FileText, Eye, Printer
} from 'lucide-react';

export default function AesConfirmationsPanel() {
  const todayBogota = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [botFilter, setBotFilter] = useState('all');
  const [subserieFilter, setSubserieFilter] = useState('all');
  const [onlyCompleted, setOnlyCompleted] = useState(false);
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState({});
  const [expedientes, setExpedientes] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);
  const [expandedKeys, setExpandedKeys] = useState(new Set());

  const [sendingEmail, setSendingEmail] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [emailConfig, setEmailConfig] = useState({
    aes_confirmation_email: 'leparadam@sena.edu.co',
    aes_auto_email_on_batch_end: 'true',
    smtp_host: 'smtp.office365.com',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: ''
  });
  const [bannerMsg, setBannerMsg] = useState(null);

  const fetchConfirmations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/aes-confirmations', {
        params: {
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          bot_key: botFilter,
          subserie: subserieFilter,
          only_completed: onlyCompleted ? 'true' : undefined,
          search: search || undefined,
          limit: 5000
        }
      });
      setKpis(res.data.kpis || {});
      setExpedientes(res.data.expedientes || []);
      setEmailLogs(res.data.email_logs || []);
    } catch (err) {
      console.error('Error cargando confirmaciones AES:', err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, botFilter, subserieFilter, onlyCompleted, search]);

  const fetchEmailSettings = useCallback(async () => {
    try {
      const res = await axios.get('/api/aes-confirmations/settings');
      if (res.data?.settings) {
        setEmailConfig(prev => ({ ...prev, ...res.data.settings, smtp_pass: '' }));
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchConfirmations();
    fetchEmailSettings();
  }, [fetchConfirmations, fetchEmailSettings]);

  const applyQuickRange = (mode) => {
    if (mode === 'today') {
      setDateFrom(todayBogota);
      setDateTo(todayBogota);
    } else if (mode === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const y = d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      setDateFrom(y);
      setDateTo(y);
    } else if (mode === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setDateFrom(d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }));
      setDateTo(todayBogota);
    } else {
      setDateFrom('');
      setDateTo('');
    }
  };

  const toggleExpand = (key) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDownloadExcel = async () => {
    try {
      const res = await axios.get('/api/aes-confirmations/export-excel', {
        params: {
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          bot_key: botFilter,
          subserie: subserieFilter,
          only_completed: onlyCompleted ? 'true' : undefined,
          search: search || undefined
        },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Confirmacion_Horaria_Cargue_AES_${dateFrom || todayBogota}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error al exportar el Excel de confirmaciones: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSendToEmail = async () => {
    setSendingEmail(true);
    setBannerMsg(null);
    try {
      const res = await axios.post('/api/aes-confirmations/send-email', {
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        bot_key: botFilter !== 'all' ? botFilter : undefined,
        recipient_email: emailConfig.aes_confirmation_email || 'leparadam@sena.edu.co'
      });
      const d = res.data || {};
      if (d.delivery_status === 'ENVIADO') {
        setBannerMsg({
          type: 'success',
          text: `✅ Reporte enviado a ${d.recipient_email} vía ${d.delivery_channel} (${d.total_expedientes} expedientes / ${d.total_documents} documentos).`
        });
      } else {
        setBannerMsg({
          type: 'info',
          text: `📁 Acta Excel generada y respaldada (${d.excel_filename}). Para envío directo sin contraseña de aplicación, mantenga su sesión abierta en "Historias Académicas (Correo)" o configure SMTP en Configurar Correo.`
        });
      }
      fetchConfirmations();
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.error || 'Error enviando reporte al correo.'
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await axios.post('/api/aes-confirmations/settings', emailConfig);
      setShowSettingsModal(false);
      setBannerMsg({
        type: 'success',
        text: `✅ Configuración guardada. Destinatario activo: ${emailConfig.aes_confirmation_email}`
      });
    } catch (err) {
      alert(err.response?.data?.error || 'Error guardando configuración.');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div style={{ background: '#ffffff', borderRadius: 14, padding: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
      {/* Encabezado y Botones de Acción */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, color: '#00324d', fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={22} color="#39a900" />
            Bitácora Oficial de Confirmación Horaria de Cargue AES
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
            Registro exacto (hora Colombia) de cada expediente y cada documento PDF confirmado en OnBase, sincronizable a <strong>{emailConfig.aes_confirmation_email}</strong>.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={fetchConfirmations}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
          <button
            onClick={handleDownloadExcel}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: 'none', background: '#15803d', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
          >
            <Download size={15} /> Descargar Excel Oficial
          </button>
          <button
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, border: '1px solid #00324d', background: '#fff', color: '#00324d', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
          >
            <Printer size={15} /> Imprimir / PDF
          </button>
          <button
            onClick={handleSendToEmail}
            disabled={sendingEmail}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: 'none', background: '#00324d', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
          >
            <Mail size={15} /> {sendingEmail ? 'Enviando...' : 'Enviar Reporte a Mi Correo'}
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}
            title="Configurar correo automático al terminar cada lote"
          >
            <Settings size={15} /> Configurar Correo
          </button>
        </div>
      </div>

      {bannerMsg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          marginBottom: 14,
          fontSize: 13,
          fontWeight: 600,
          background: bannerMsg.type === 'success' ? '#dcfce7' : bannerMsg.type === 'error' ? '#fee2e2' : '#e0f2fe',
          color: bannerMsg.type === 'success' ? '#166534' : bannerMsg.type === 'error' ? '#991b1b' : '#075985',
          border: `1px solid ${bannerMsg.type === 'success' ? '#86efac' : bannerMsg.type === 'error' ? '#fca5a5' : '#7dd3fc'}`
        }}>
          {bannerMsg.text}
        </div>
      )}

      {/* Tarjetas KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>Cargados Hoy</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#14532d' }}>
            {kpis.expedientes_today || 0} <span style={{ fontSize: 13, fontWeight: 600 }}>exp. ({kpis.docs_today || 0} PDFs)</span>
          </div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Expedientes Completados 100%</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#00324d' }}>
            {kpis.total_expedientes_completed || 0} <span style={{ fontSize: 12, color: '#64748b' }}>/ {kpis.total_expedientes_touched || 0}</span>
          </div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Total Documentos Confirmados</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{kpis.total_docs_confirmed || 0}</div>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 700, textTransform: 'uppercase' }}>Última Confirmación Registrada</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1e3a8a', marginTop: 4 }}>
            {kpis.last_confirmed_at_bogota || '—'}
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => applyQuickRange('today')} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: dateFrom === todayBogota && dateTo === todayBogota ? '#00324d' : '#fff', color: dateFrom === todayBogota && dateTo === todayBogota ? '#fff' : '#334155', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Hoy</button>
          <button onClick={() => applyQuickRange('yesterday')} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Ayer</button>
          <button onClick={() => applyQuickRange('7days')} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>7 días</button>
          <button onClick={() => applyQuickRange('all')} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: !dateFrom && !dateTo ? '#00324d' : '#fff', color: !dateFrom && !dateTo ? '#fff' : '#334155', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Todo</button>
        </div>

        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }} title="Desde" />
        <span style={{ fontSize: 12, color: '#64748b' }}>a</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }} title="Hasta" />

        <select value={botFilter} onChange={e => setBotFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}>
          <option value="all">Todos los Bots / Cuentas</option>
          <option value="9224">Bot 1 · Subdirección (9224)</option>
          <option value="9224.4">Bot 2 · Formación (9224.4)</option>
          <option value="9224.2">Bot 3 · Adm. Educativa (9224.2)</option>
        </select>

        <select value={subserieFilter} onChange={e => setSubserieFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}>
          <option value="all">Todas las Subseries</option>
          <option value="9224.4-37">68.9224.4-37 Historias Académicas</option>
          <option value="9224-27">68.9224-27 Derechos de Petición</option>
          <option value="22.10">68.9224-22.10 Contratos</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyCompleted} onChange={e => setOnlyCompleted(e.target.checked)} />
          Solo Expedientes 100%
        </label>

        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={15} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Buscar por código EX, Ficha, Cédula, Aprendiz o PDF..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '6px 10px 6px 30px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
          />
        </div>
      </div>

      {/* Tabla Maestra Agrupada por Expediente y Desplegable por Documento */}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#00324d', color: '#fff', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px', width: 34 }}></th>
              <th style={{ padding: '10px 12px' }}>Expediente AES</th>
              <th style={{ padding: '10px 12px' }}>Subserie</th>
              <th style={{ padding: '10px 12px' }}>Ficha / Contrato / Radicado</th>
              <th style={{ padding: '10px 12px' }}>Aprendiz / Titular</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Documentos</th>
              <th style={{ padding: '10px 12px' }}>Hora Inicio</th>
              <th style={{ padding: '10px 12px' }}>Hora Exacta Confirmación</th>
              <th style={{ padding: '10px 12px' }}>Cuenta OnBase</th>
            </tr>
          </thead>
          <tbody>
            {expedientes.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>
                  {loading ? 'Consultando bitácora de confirmaciones...' : 'No hay confirmaciones registradas para el filtro seleccionado.'}
                </td>
              </tr>
            ) : (
              expedientes.slice(0, 400).map((exp) => {
                const isExp = expandedKeys.has(exp.key);
                return (
                  <Fragment key={exp.key}>
                    <tr
                      onClick={() => toggleExpand(exp.key)}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        background: isExp ? '#f0fdf4' : '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      <td style={{ padding: '9px 12px', color: '#00324d' }}>
                        {isExp ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: 800, color: '#00324d' }}>
                        {exp.expediente_code}
                      </td>
                      <td style={{ padding: '9px 12px', color: '#334155' }}>{exp.subserie}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#1e293b' }}>{exp.ficha || '—'}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{exp.titular_nombre || '—'}</div>
                        {exp.titular_documento && <div style={{ fontSize: 11, color: '#64748b' }}>Doc: {exp.titular_documento}</div>}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 9px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 800,
                          background: exp.expediente_completed ? '#dcfce7' : '#fef3c7',
                          color: exp.expediente_completed ? '#166534' : '#92400e'
                        }}>
                          <CheckCircle size={12} /> {exp.docs_loaded}/{exp.docs_total} PDFs
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 11.5, color: '#475569' }}>
                        {exp.first_started_at_bogota || '—'}
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: 800, color: '#15803d', fontSize: 12 }}>
                        {exp.expediente_completed_at_bogota || exp.last_confirmed_at_bogota || '—'}
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#334155', fontSize: 11.5 }}>
                        {exp.onbase_user || '—'}
                      </td>
                    </tr>

                    {isExp && (
                      <tr>
                        <td colSpan={9} style={{ background: '#f8fafc', padding: '10px 24px 14px 40px', borderBottom: '2px solid #cbd5e1' }}>
                          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#00324d', marginBottom: 6 }}>
                            Detalle de Documentos Confirmados en {exp.expediente_code} ({exp.documents.length} archivo(s)):
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, background: '#fff', border: '1px solid #cbd5e1' }}>
                            <thead>
                              <tr style={{ background: '#e2e8f0', color: '#1e293b' }}>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>ID Doc</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Archivo PDF</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Tipología TRD</th>
                                <th style={{ padding: '6px 8px', textAlign: 'center' }}>Folios</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Hora Exacta Cargue (Colombia)</th>
                                <th style={{ padding: '6px 8px', textAlign: 'center' }}>Duración</th>
                                <th style={{ padding: '6px 8px', textAlign: 'center' }}>Ver</th>
                              </tr>
                            </thead>
                            <tbody>
                              {exp.documents.map(doc => (
                                <tr key={doc.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '6px 8px', color: '#64748b' }}>#{doc.document_id}</td>
                                  <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f172a' }}>
                                    <FileText size={12} style={{ display: 'inline', marginRight: 4, color: '#dc2626' }} />
                                    {doc.filename}
                                  </td>
                                  <td style={{ padding: '6px 8px', color: '#334155' }}>{doc.typology_name}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>{doc.page_count || '—'}</td>
                                  <td style={{ padding: '6px 8px', fontWeight: 800, color: '#15803d' }}>{doc.confirmed_at_bogota}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b' }}>
                                    {doc.duration_ms ? `${(doc.duration_ms / 1000).toFixed(1)}s` : 'Histórico'}
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                    {doc.document_id && (
                                      <a
                                        href={`/api/ades/view/${doc.document_id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                                      >
                                        <Eye size={13} /> PDF
                                      </a>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {expedientes.length > 400 && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#64748b', textAlign: 'right' }}>
          Mostrando primeros 400 de {expedientes.length} expedientes en pantalla. Al exportar Excel se incluyen todos los {expedientes.length} registros.
        </div>
      )}

      {/* Historial reciente de reportes enviados al correo */}
      {emailLogs.length > 0 && (
        <div style={{ marginTop: 18, background: '#f8fafc', borderRadius: 10, padding: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#00324d', marginBottom: 6 }}>
            📧 Últimos Reportes de Confirmación Sincronizados / Respaldados:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5 }}>
            {emailLogs.slice(0, 5).map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', color: '#334155', borderBottom: '1px dashed #e2e8f0', paddingBottom: 3 }}>
                <span><strong>{l.created_at_bogota}</strong> → {l.recipient_email} ({l.total_expedientes} exp. / {l.total_documents} docs)</span>
                <span style={{ fontWeight: 700, color: l.delivery_status === 'ENVIADO' ? '#15803d' : '#0369a1' }}>
                  {l.delivery_channel} · {l.delivery_status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Configuración de Envío Automático al Correo */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, padding: 24, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 12px', color: '#00324d' }}>📧 Configuración de Sincronización a Correo Electrónico</h3>
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Correo Destinatario de Actas de Confirmación AES:</label>
                <input
                  type="email"
                  required
                  value={emailConfig.aes_confirmation_email}
                  onChange={e => setEmailConfig(p => ({ ...p, aes_confirmation_email: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={String(emailConfig.aes_auto_email_on_batch_end) !== 'false'}
                  onChange={e => setEmailConfig(p => ({ ...p, aes_auto_email_on_batch_end: e.target.checked ? 'true' : 'false' }))}
                />
                Enviar automáticamente el Excel con horas exactas al finalizar cada tanda de Cargue AES
              </label>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                <div style={{ fontSize: 11.5, color: '#475569', marginBottom: 8 }}>
                  <strong>Canal Automático:</strong> Si mantiene su buzón autenticado en el menú <em>Historias Académicas (Correo)</em>, el sistema envía desde su sesión Outlook 365 sin clave adicional. Opcionalmente puede configurar SMTP:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    placeholder="Servidor SMTP (smtp.office365.com)"
                    value={emailConfig.smtp_host}
                    onChange={e => setEmailConfig(p => ({ ...p, smtp_host: e.target.value }))}
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                  <input
                    type="text"
                    placeholder="Puerto (587)"
                    value={emailConfig.smtp_port}
                    onChange={e => setEmailConfig(p => ({ ...p, smtp_port: e.target.value }))}
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input
                    type="email"
                    placeholder="Usuario SMTP opcional"
                    value={emailConfig.smtp_user}
                    onChange={e => setEmailConfig(p => ({ ...p, smtp_user: e.target.value }))}
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                  <input
                    type="password"
                    placeholder="Contraseña aplicación opcional"
                    value={emailConfig.smtp_pass}
                    onChange={e => setEmailConfig(p => ({ ...p, smtp_pass: e.target.value }))}
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setShowSettingsModal(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                <button type="submit" disabled={savingSettings} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#39a900', color: '#fff', cursor: 'pointer', fontWeight: 800 }}>
                  {savingSettings ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
