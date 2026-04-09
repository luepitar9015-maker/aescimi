import { useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { Play, CheckCircle, AlertCircle, Upload, FileText, RotateCcw, Monitor, RefreshCw } from 'lucide-react';

const STEPS = [
  { icon: '🖥️', title: 'Conectar OnBase', desc: 'Detectar ventana Unity Client' },
  { icon: '📥', title: 'Click Importar', desc: 'Ribbon → botón Importar' },
  { icon: '📂', title: 'Seleccionar PDF', desc: 'Examinar y abrir archivo' },
  { icon: '📝', title: 'Llenar campos', desc: 'NIS, Radicado, Asunto, etc.' },
  { icon: '✅', title: 'Confirmar', desc: 'Click final Importar' },
];

function StepBar({ currentStep, success }) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
      {STEPS.map((s, i) => {
        const done = success || i < currentStep;
        const active = i === currentStep && !success;
        return (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              background: done ? '#22c55e' : active ? '#3b82f6' : '#e5e7eb',
              color: done || active ? '#fff' : '#6b7280',
              borderRadius: '50%', width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 4px', fontSize: '14px',
              boxShadow: active ? '0 0 0 3px #93c5fd' : 'none',
              transition: 'all 0.3s'
            }}>
              {done ? '✓' : s.icon}
            </div>
            <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.2 }}>{s.title}</div>
            {i < STEPS.length - 1 && (
              <div style={{
                position: 'absolute', display: 'none'
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ComunicacionesProducidas() {
  const [form, setForm] = useState({
    file_path: '',
    radicado_compuesto: '',
    nis: '',
    cod_regional: '',
    medio_ingreso: 'FISICO',
    entrega_mano: 'NO',
    tipo_documento: '01-Comunicacion Producida (PAPEL)',
    num_anexos: '',
    descripcion_anexos: '',
    tipo_digitalizacion: 'TOTAL',
    asunto: '',
    descripcion_asunto: '',
    cod_dependencia_remitente: '',
    mail_cc: '',
    destinatario_externo: '',
    dependencia_destinatario: '',
    funcionario_destinatario: '',
    direccion_destinatario: '',
    municipio_destinatario: '',
    depto_destinatario: '',
    pais_destinatario: '',
    mail_to: '',
  });

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(-1);
  const [activeTab, setActiveTab] = useState('individual'); // 'individual' or 'masiva'
  
  // Masiva State
  const [massRecords, setMassRecords] = useState([]);
  const [massLoading, setMassLoading] = useState(false);
  const [massStatus, setMassStatus] = useState('');

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const inferStep = (logLines) => {
    const last = logLines[logLines.length - 1] || '';
    if (last.includes('Conectando')) return 0;
    if (last.includes('Importar') && last.includes('ribbon')) return 1;
    if (last.includes('Examinar') || last.includes('archivo')) return 2;
    if (last.includes('Llenando') || last.includes('auto_id')) return 3;
    if (last.includes('boton final') || last.includes('Importar' && 'final')) return 4;
    if (last.includes('completada')) return 5;
    return 0;
  };

  const handleRun = async () => {
    if (!form.file_path) {
      setError('Ingresa la ruta completa del archivo PDF');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess(false);
    setCurrentStep(0);
    setLogs(['Iniciando automatización de Comunicaciones Producidas...']);

    try {
      const res = await axios.post('/api/automation/unity-robot', form, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      const allLogs = res.data.logs || [];
      setLogs(allLogs);
      setCurrentStep(5);
      setSuccess(true);
    } catch (err) {
      const errLogs = err.response?.data?.logs || [];
      setLogs(prev => [...prev, ...errLogs, `❌ Error: ${err.response?.data?.error || err.message}`]);
      setError(err.response?.data?.error || err.message);
      setCurrentStep(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setLogs([]);
    setSuccess(false);
    setError('');
    setCurrentStep(-1);
  };

  const normalizeText = (str) => {
    if (!str) return '';
    return str.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s\-_]/g, '').trim();
  };

  const handleMassFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target.result;
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws);
        if (jsonData.length === 0) return alert("El archivo está vacío.");

        // Define expected columns and synonyms mapping directly to form state keys
        const colMap = {
            file_path: ['Ruta del Archivo PDF', 'Ruta', 'Archivo', 'PDF'],
            radicado_compuesto: ['No. Radicado Producida Comp.', 'Radicado Compuesto', 'Radicado'],
            nis: ['N.I.S', 'NIS'],
            cod_regional: ['Cód. Regional', 'Cod Regional', 'Regional'],
            medio_ingreso: ['Medio de Ingreso', 'Medio Ingreso'],
            entrega_mano: ['Entrega a la Mano', 'Entrega Mano'],
            tipo_documento: ['Tipo de Documento', 'Tipo Documento'],
            num_anexos: ['No. de Anexos', 'Anexos'],
            descripcion_anexos: ['Descripción de Anexos', 'Desc Anexos'],
            tipo_digitalizacion: ['Tipo de Digitalización', 'Digitalizacion'],
            asunto: ['Asunto'],
            descripcion_asunto: ['Descripción Asunto', 'Desc Asunto'],
            cod_dependencia_remitente: ['Cód. Dependencia Remitente', 'Cod Dependencia Remitente'],
            mail_cc: ['MAIL Cc', 'Cc'],
            destinatario_externo: ['Destinatario Externo'],
            dependencia_destinatario: ['Dependencia Destinatario Ext.', 'Dependencia Destinatario'],
            funcionario_destinatario: ['Funcionario Destinatario Ext.', 'Funcionario Destinatario'],
            direccion_destinatario: ['Dirección Destinatario Ext.', 'Direccion Destinatario'],
            municipio_destinatario: ['Municipio Destinatario Ext.', 'Municipio Destinatario'],
            depto_destinatario: ['Depto. Destinatario', 'Departamento Destinatario'],
            pais_destinatario: ['País Destinatario', 'Pais Destinatario'],
            mail_to: ['MAIL To', 'To']
        };

        const range = XLSX.utils.decode_range(ws['!ref']);
        const firstRow = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
            if (cell && cell.v) firstRow.push(String(cell.v));
        }
        const allHeaders = firstRow.length > 0 ? firstRow : Object.keys(jsonData[0]);
        const normalizedHeaders = allHeaders.map(h => ({ original: h, normalized: normalizeText(h) }));

        const findHeader = (synonyms) => {
            const found = normalizedHeaders.find(h => synonyms.some(s => h.normalized === normalizeText(s)));
            return found ? found.original : null;
        };

        const mappedHeaders = {};
        for(const [key, synonyms] of Object.entries(colMap)) {
            mappedHeaders[key] = findHeader(synonyms);
        }

        const newRecords = jsonData.map((row, idx) => {
          const record = { id: Date.now() + idx, status: 'Pendiente', logs: [] };
          // For each expected field, pull the value from row matching the found header
          Object.keys(colMap).forEach(key => {
              const headerVal = mappedHeaders[key];
              record[key] = headerVal && row[headerVal] !== undefined ? String(row[headerVal]).trim() : form[key] || ''; // fallback to default form value
          });
          return record;
        });

        setMassRecords(prev => [...prev, ...newRecords]);
        alert(`${newRecords.length} registros cargados exitosamente.`);
      } catch (err) {
        console.error(err);
        alert("Error al leer Excel.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = null;
  };

  const handleExportTemplate = () => {
    const dataToExport = [{
      "Ruta del Archivo PDF": "C:\\Users\\Usuario\\Downloads\\doc_ejemplo.pdf",
      "No. Radicado Producida Comp.": "68-2-2026-000001",
      "N.I.S": "2026-01-105854",
      "Cód. Regional": "68",
      "Medio de Ingreso": "FISICO",
      "Entrega a la Mano": "NO",
      "Tipo de Documento": "01-Comunicacion Producida (PAPEL)",
      "No. de Anexos": "0",
      "Descripción de Anexos": "Ninguno",
      "Tipo de Digitalización": "TOTAL",
      "Asunto": "RESPUESTA SOLICITUD",
      "Descripción Asunto": "Detalle general",
      "Cód. Dependencia Remitente": "",
      "MAIL Cc": "",
      "Destinatario Externo": "Juan Perez",
      "Dependencia Destinatario Ext.": "",
      "Funcionario Destinatario Ext.": "",
      "Dirección Destinatario Ext.": "Calle 1",
      "Municipio Destinatario Ext.": "Bucaramanga",
      "Depto. Destinatario": "Santander",
      "País Destinatario": "Colombia",
      "MAIL To": ""
    }];

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla_ComProducidas");
    XLSX.writeFile(wb, "Plantilla_Cargue_Com_Producidas.xlsx");
  };

  const runBulkImport = async () => {
    const pendingRecords = massRecords.filter(r => r.status === 'Pendiente' || r.status === 'Error');
    if(pendingRecords.length === 0) return alert("No hay registros pendientes para procesar.");
    
    setMassLoading(true);
    let updatedRecords = [...massRecords];

    for (let i = 0; i < updatedRecords.length; i++) {
        if(updatedRecords[i].status !== 'Pendiente' && updatedRecords[i].status !== 'Error') continue;

        // Mark as Processing
        updatedRecords[i] = { ...updatedRecords[i], status: 'Procesando...', logs: ['Iniciando automatización...'] };
        setMassRecords([...updatedRecords]);

        try {
            // Strip out UI-only fields (id, status, logs) before sending
            const { id, status, logs: oldLogs, ...payload } = updatedRecords[i];
            const res = await axios.post('/api/automation/unity-robot', payload, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            updatedRecords[i] = { ...updatedRecords[i], status: 'Éxito', logs: res.data.logs || [] };
        } catch (err) {
            const errLogs = err.response?.data?.logs || [];
            updatedRecords[i] = { 
                ...updatedRecords[i], 
                status: 'Error', 
                logs: [...errLogs, `❌ Error: ${err.response?.data?.error || err.message}`] 
            };
            // Break on error to avoid compounding OnBase state errors (like popups blocking the UI)
            setMassRecords([...updatedRecords]);
            alert(`El cargue se detuvo en el registro de la fila ${i+1} debido a un error en OnBase. Revisa OnBase y reanuda el proceso.`);
            break; 
        }
        
        setMassRecords([...updatedRecords]);
        // Wait 3 seconds between records so OnBase UI settles
        if(i < updatedRecords.length -1) {
             await new Promise(r => setTimeout(r, 3000));
        }
    }
    setMassLoading(false);
  };

  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' };
  const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', marginBottom: 12, boxSizing: 'border-box' };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Header and Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#111827', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={24} color="#2e7d32" /> Comunicaciones Producidas
          </h2>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>
            Automatización de importación a OnBase Unity — Grupo: COMUNICACIONES PRODUCIDAS
          </p>
        </div>
        <div className="tabs" style={{ display: 'flex', gap: '5px' }}>
            <button
                onClick={() => setActiveTab('individual')}
                style={{ padding: '10px 20px', borderRadius: '8px 8px 0 0', border: 'none', background: activeTab === 'individual' ? '#fff' : '#e0e0e0', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === 'individual' ? '3px solid #2e7d32' : 'none' }}
            >
                Importación Individual
            </button>
            <button
                onClick={() => setActiveTab('masiva')}
                style={{ padding: '10px 20px', borderRadius: '8px 8px 0 0', border: 'none', background: activeTab === 'masiva' ? '#fff' : '#e0e0e0', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === 'masiva' ? '3px solid #2e7d32' : 'none' }}
            >
                Importación Masiva
            </button>
        </div>
      </div>

      {activeTab === 'individual' && (
        <>
          {/* Step bar */}
      {(loading || success || currentStep >= 0) && (
        <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
          <StepBar currentStep={currentStep} success={success} />
          {loading && (
            <div style={{ textAlign: 'center', color: '#3b82f6', fontSize: 13, fontWeight: 600, animation: 'pulse 1.5s infinite' }}>
              ⏳ Procesando en OnBase Unity...
            </div>
          )}
          {success && (
            <div style={{ textAlign: 'center', color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
              <CheckCircle size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              ¡Documento importado exitosamente en OnBase!
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Form */}
        <div className="card" style={{ maxHeight: '800px', overflowY: 'auto' }}>
          <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 15, color: '#1f2937', position: 'sticky', top: 0, background: '#fff', paddingBottom: 10, borderBottom: '1px solid #eee', zIndex: 10 }}>📋 Datos del Documento</h3>

          <label style={labelStyle}>Ruta del Archivo PDF *</label>
          <input
            type="text"
            value={form.file_path}
            onChange={set('file_path')}
            placeholder="C:\Users\Usuario\Downloads\documento.pdf"
            style={{ ...inputStyle, borderColor: error && !form.file_path ? '#ef4444' : '#d1d5db' }}
          />

          {/* User Requested Order fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <div>
              <label style={labelStyle}>No. Radicado Producida Comp.</label>
              <input type="text" value={form.radicado_compuesto} onChange={set('radicado_compuesto')} placeholder="68-2-2026-000001" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>N.I.S</label>
              <input type="text" value={form.nis} onChange={set('nis')} placeholder="2026-01-105854" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <div>
              <label style={labelStyle}>Cód. Regional</label>
              <input type="text" value={form.cod_regional} onChange={set('cod_regional')} placeholder="Ej: 68" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Medio de Ingreso</label>
              <select value={form.medio_ingreso} onChange={set('medio_ingreso')} style={inputStyle}>
                <option value="FISICO">FÍSICO</option>
                <option value="E-MAIL">E-MAIL</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <div>
              <label style={labelStyle}>Entrega a la Mano</label>
              <select value={form.entrega_mano} onChange={set('entrega_mano')} style={inputStyle}>
                <option value="SI">SI</option>
                <option value="NO">NO</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Tipo de Documento</label>
              <select value={form.tipo_documento} onChange={set('tipo_documento')} style={inputStyle}>
                <option value="01-Comunicacion Producida (PAPEL)">01-Comunicacion Producida (PAPEL)</option>
                <option value="02-Comunicacion Producida (ELEC)">02-Comunicacion Producida (ELEC)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <div>
              <label style={labelStyle}>No. de Anexos</label>
              <input type="number" value={form.num_anexos} onChange={set('num_anexos')} placeholder="0" style={inputStyle} min={0} />
            </div>
            <div>
              <label style={labelStyle}>Descripción de Anexos</label>
              <input type="text" value={form.descripcion_anexos} onChange={set('descripcion_anexos')} placeholder="Anexos..." style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <div>
              <label style={labelStyle}>Tipo de Digitalización</label>
              <select value={form.tipo_digitalizacion} onChange={set('tipo_digitalizacion')} style={inputStyle}>
                <option value="TOTAL">TOTAL</option>
                <option value="PARCIAL">PARCIAL</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Asunto</label>
              <input type="text" value={form.asunto} onChange={set('asunto')} placeholder="Asunto..." style={inputStyle} />
            </div>
          </div>

          <label style={labelStyle}>Descripción Asunto</label>
          <input type="text" value={form.descripcion_asunto} onChange={set('descripcion_asunto')} placeholder="Descripción detallada..." style={inputStyle} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <div>
              <label style={labelStyle}>Cód. Dependencia Remitente</label>
              <input type="text" value={form.cod_dependencia_remitente} onChange={set('cod_dependencia_remitente')} placeholder="Código..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>MAIL Cc</label>
              <input type="text" value={form.mail_cc} onChange={set('mail_cc')} placeholder="cc@ejemplo.com" style={inputStyle} />
            </div>
          </div>

          <label style={labelStyle}>Destinatario Externo</label>
          <input type="text" value={form.destinatario_externo} onChange={set('destinatario_externo')} placeholder="Nombre destinatario..." style={inputStyle} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <div>
              <label style={labelStyle}>Dependencia Destinatario Ext.</label>
              <input type="text" value={form.dependencia_destinatario} onChange={set('dependencia_destinatario')} placeholder="Dependencia..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Funcionario Destinatario Ext.</label>
              <input type="text" value={form.funcionario_destinatario} onChange={set('funcionario_destinatario')} placeholder="Funcionario..." style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <div>
              <label style={labelStyle}>Dirección Destinatario Ext.</label>
              <input type="text" value={form.direccion_destinatario} onChange={set('direccion_destinatario')} placeholder="Dirección..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Municipio Destinatario Ext.</label>
              <input type="text" value={form.municipio_destinatario} onChange={set('municipio_destinatario')} placeholder="Municipio..." style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
            <div>
              <label style={labelStyle}>Depto. Destinatario</label>
              <input type="text" value={form.depto_destinatario} onChange={set('depto_destinatario')} placeholder="Depto..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>País Destinatario</label>
              <input type="text" value={form.pais_destinatario} onChange={set('pais_destinatario')} placeholder="País..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>MAIL To</label>
              <input type="text" value={form.mail_to} onChange={set('mail_to')} placeholder="to@ejemplo.com" style={inputStyle} />
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', fontSize: 13 }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button
            onClick={handleRun}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#93c5fd' : success ? '#16a34a' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'background 0.2s'
            }}
          >
            {loading ? (
              <>⏳ Ejecutando en OnBase...</>
            ) : success ? (
              <><CheckCircle size={18} /> Importado Exitosamente</>
            ) : (
              <><Play size={18} /> Importar a OnBase Unity</>
            )}
          </button>

          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
            ⚠️ Asegúrese de que OnBase Unity Client esté abierto antes de ejecutar
          </p>
        </div>

        {/* Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Quick guide */}
          <div className="card" style={{ padding: '14px 18px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#1f2937' }}>📌 Flujo del Proceso</h4>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: success || (currentStep > i) ? '#22c55e' : currentStep === i ? '#3b82f6' : '#f3f4f6',
                  color: success || currentStep >= i ? '#fff' : '#9ca3af',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0, transition: 'all 0.3s'
                }}>
                  {success || currentStep > i ? '✓' : i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Log console */}
          <div className="card" style={{ flex: 1, padding: '14px 18px', minHeight: 300 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14, color: '#1f2937' }}>🖥️ Consola de Logs</h4>
              {loading && <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700 }}>● EN VIVO</span>}
            </div>
            <div style={{
              background: '#0f172a',
              borderRadius: 6,
              padding: '10px 14px',
              height: 280,
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: 12,
              color: '#94a3b8'
            }}>
              {logs.length === 0 ? (
                <span style={{ color: '#475569' }}>// Los logs aparecerán aquí al ejecutar...</span>
              ) : (
                logs.map((line, i) => {
                  const isError = line.includes('ERROR') || line.includes('Error') || line.includes('❌');
                  const isOk = line.includes('exitosamente') || line.includes('✅') || line.includes('OK');
                  return (
                    <div key={i} style={{
                      color: isError ? '#f87171' : isOk ? '#4ade80' : '#94a3b8',
                      marginBottom: 2,
                      wordBreak: 'break-all'
                    }}>
                      {line}
                    </div>
                  );
                })
              )}
              {loading && <div style={{ color: '#60a5fa', marginTop: 4 }}>▌</div>}
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {activeTab === 'masiva' && (
          <div className="workspace" style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
              <div className="card" style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', width: '100%' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #eee' }}>
                      <div>
                          <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1b5e20' }}>
                             <Upload size={20}/> Cargue Masivo por Excel
                          </h3>
                          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#666' }}>
                              Sube un archivo Excel con los registros a importar secuencialmente a OnBase Unity.
                          </p>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                              onClick={handleExportTemplate}
                              className="btn btn-secondary"
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontWeight: 'bold', color: '#333' }}
                          >
                              <FileText size={16} /> Descargar Plantilla
                          </button>
                          
                          <label className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', background: '#2e7d32', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>
                              <Upload size={16} /> Subir Excel
                              <input type="file" accept=".xlsx, .xls" onChange={handleMassFileUpload} style={{ display: 'none' }} disabled={massLoading} />
                          </label>
                          {massRecords.length > 0 && (
                            <button
                                onClick={() => { if(window.confirm("¿Limpiar todos los registros?")) setMassRecords([]); }}
                                style={{ padding: '10px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                            >
                                <RotateCcw size={16} />
                            </button>
                          )}
                      </div>
                  </div>

                  <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '1200px' }}>
                          <thead>
                              <tr style={{ backgroundColor: '#f1f8e9', textAlign: 'left', borderBottom: '2px solid #c8e6c9' }}>
                                  <th style={{ padding: '12px', width: '50px' }}>#</th>
                                  <th style={{ padding: '12px', width: '120px' }}>Estado</th>
                                  <th style={{ padding: '12px', width: '250px' }}>Ruta PDF</th>
                                  <th style={{ padding: '12px', width: '150px' }}>Radicado Compuesto</th>
                                  <th style={{ padding: '12px', width: '150px' }}>NIS</th>
                                  <th style={{ padding: '12px' }}>Asunto</th>
                              </tr>
                          </thead>
                          <tbody>
                              {massRecords.length > 0 ? massRecords.map((rec, i) => {
                                  let statusColor = '#fff3e0'; let textColor = '#ef6c00'; // Pendiente
                                  if (rec.status === 'Éxito') { statusColor = '#e8f5e9'; textColor = '#2e7d32'; }
                                  else if (rec.status === 'Error') { statusColor = '#ffebee'; textColor = '#c62828'; }
                                  else if (rec.status.includes('Procesando')) { statusColor = '#e3f2fd'; textColor = '#1565c0'; }

                                  return (
                                  <tr key={rec.id} style={{ borderBottom: '1px solid #eee' }}>
                                      <td style={{ padding: '10px', fontWeight: 'bold', color: '#666' }}>{i + 1}</td>
                                      <td style={{ padding: '10px' }}>
                                          <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: statusColor, color: textColor, fontWeight: 'bold', fontSize: '11px', display: 'flex', alignItems: 'center', width: 'fit-content', gap: '4px' }}>
                                              {rec.status === 'Éxito' && <CheckCircle size={12}/>}
                                              {rec.status === 'Error' && <AlertCircle size={12}/>}
                                              {rec.status.includes('Procesando') && <RefreshCw size={12} className="spin"/>}
                                              {rec.status}
                                          </span>
                                      </td>
                                      <td style={{ padding: '10px', wordBreak: 'break-all', color: '#1976d2' }}>{rec.file_path}</td>
                                      <td style={{ padding: '10px' }}>{rec.radicado_compuesto || '-'}</td>
                                      <td style={{ padding: '10px' }}>{rec.nis || '-'}</td>
                                      <td style={{ padding: '10px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rec.asunto || '-'}</td>
                                  </tr>
                                  );
                              }) : (
                                  <tr>
                                      <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                                          <Upload size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                                          <p>No hay registros. Descarga la plantilla y sube un Excel con los datos.</p>
                                      </td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>

                  {massRecords.length > 0 && (
                      <button
                          className="btn btn-primary"
                          onClick={runBulkImport}
                          disabled={massLoading}
                          style={{ width: '100%', padding: '16px', fontSize: '16px', fontWeight: 'bold', borderRadius: '8px', background: massLoading ? '#9ca3af' : '#2e7d32', color: '#fff', border: 'none', cursor: massLoading ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
                      >
                          {massLoading ? (
                              <><RefreshCw className="spin" size={20} /> Procesando Lote ({massRecords.filter(r=>r.status!=='Pendiente').length}/{massRecords.length})...</>
                          ) : (
                              <><Play size={20} /> Iniciar Procesamiento Masivo ({massRecords.filter(r=>r.status === 'Pendiente' || r.status === 'Error').length} PDtes)</>
                          )}
                      </button>
                  )}
              </div>
          </div>
      )}

    </div>
  );
}

export default ComunicacionesProducidas;
