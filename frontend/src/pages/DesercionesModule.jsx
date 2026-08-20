import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  FileSpreadsheet, 
  Upload, 
  UserCheck, 
  Mail, 
  Paperclip, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  RefreshCw, 
  Play, 
  Plus, 
  Trash2, 
  FileText, 
  Send,
  Calendar,
  Clock,
  MapPin,
  HelpCircle,
  Download
} from 'lucide-react';

export default function DesercionesModule() {
  const [activeTab, setActiveTab] = useState('citacion'); // 'citacion' | 'resolucion' | 'historico'
  const textareaRef = useRef(null);

  // Excel & File States
  const [excelFile, setExcelFile] = useState(null);
  const [excelData, setExcelData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [uploadingExcel, setUploadingExcel] = useState(false);

  // Template State (Texto Inicial) con Persistencia en localStorage
  const [textoInicialCitacion, setTextoInicialCitacion] = useState(() => {
    return localStorage.getItem('sena_deserciones_citacion_text') || 
`Por medio de la presente, se le cita a Comité de Evaluación y Seguimiento de acuerdo con el Reglamento del Aprendiz SENA.

Ficha de Formación: {{ficha}}
Programa: {{programa}}
Causal de Deserción: {{causal_desercion}}

Fecha de la Cita: {{fecha_comite}}
Hora: {{hora_comite}}
Lugar / Enlace: {{lugar_comite}}

Es indispensable su asistencia para ejercer su derecho a la defensa y presentar los descargos correspondientes.`;
  });

  const [textoInicialResolucion, setTextoInicialResolucion] = useState(() => {
    return localStorage.getItem('sena_deserciones_resolucion_text') || 
`Por medio de la presente, se le notifica formalmente la emisión de la Resolución de Cancelación de Matrícula por causa de deserción del programa de formación {{programa}} correspondiente a la Ficha No. {{ficha}}.

Se adjunta de manera explícita la Resolución correspondiente a su trámite para su conocimiento y fines legales.

Usted cuenta con los recursos de ley de conformidad con la normatividad institucional SENA.`;
  });

  // Persistir plantillas de texto en localStorage cuando cambian
  useEffect(() => {
    localStorage.setItem('sena_deserciones_citacion_text', textoInicialCitacion);
  }, [textoInicialCitacion]);

  useEffect(() => {
    localStorage.setItem('sena_deserciones_resolucion_text', textoInicialResolucion);
  }, [textoInicialResolucion]);

  // OnBase User & CC Emails
  const [onbaseUsers, setOnbaseUsers] = useState([]);
  const [selectedOnbaseUser, setSelectedOnbaseUser] = useState('');
  const [ccEmails, setCcEmails] = useState([
    { name: 'Subdirección Centro', email: 'subdireccion_centro@sena.edu.co' },
    { name: 'Coordinación Académica', email: 'coordinacion_academica@sena.edu.co' }
  ]);
  const [newCcName, setNewCcName] = useState('');
  const [newCcEmail, setNewCcEmail] = useState('');

  // Row Selection & Explicit Attachments per Row
  const [selectedRows, setSelectedRows] = useState({});
  const [rowAttachments, setRowAttachments] = useState({}); // { [rowId]: { name, path } }
  const [uploadingAttachmentId, setUploadingAttachmentId] = useState(null);
  const [uploadingBatchAttachments, setUploadingBatchAttachments] = useState(false);

  // Preview Modal State
  const [previewItem, setPreviewItem] = useState(null);
  const [previewText, setPreviewText] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Historico & Actions State
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [processingSave, setProcessingSave] = useState(false);
  const [processingOnBase, setProcessingOnBase] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  // Variables estándar SENA por defecto
  const standardChips = [
    '{{aprendiz_nombre}}',
    '{{aprendiz_doc_tipo}}',
    '{{aprendiz_doc_numero}}',
    '{{ficha}}',
    '{{programa}}',
    '{{aprendiz_correo}}',
    '{{causal_desercion}}',
    '{{fecha_comite}}',
    '{{hora_comite}}',
    '{{lugar_comite}}'
  ];

  // Variables disponibles para combinar: dinámicas desde los títulos de columna del Excel cargado
  const availableChips = columns && columns.length > 0
    ? Array.from(new Set([...columns.map(col => `{{${col.trim()}}}`), ...standardChips]))
    : standardChips;

  // Fetch active users for OnBase assignment & Historico on mount
  useEffect(() => {
    fetchUsers();
    fetchHistorico();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/users/active');
      const users = res.data?.data || res.data || [];
      setOnbaseUsers(users);
      if (users.length > 0) {
        setSelectedOnbaseUser(users[0].full_name || users[0].document_no);
      }
    } catch (e) {
      console.error('Error al cargar usuarios:', e);
    }
  };

  const fetchHistorico = async () => {
    setLoadingHistorico(true);
    try {
      const res = await axios.get('/api/deserciones/casos');
      setHistorico(res.data?.data || []);
    } catch (e) {
      console.error('Error al cargar histórico:', e);
    } finally {
      setLoadingHistorico(false);
    }
  };

  // 1. Manejo de Carga de Excel
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setExcelFile(file);

    const formData = new FormData();
    formData.append('excel', file);

    setUploadingExcel(true);
    setStatusMessage({ type: 'info', text: 'Parseando archivo Excel...' });

    try {
      const res = await axios.post('/api/deserciones/upload-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setExcelData(res.data.rows || []);
      setColumns(res.data.columns || []);

      // Seleccionar todas las filas por defecto
      const selMap = {};
      (res.data.rows || []).forEach(r => { selMap[r.id_temp] = true; });
      setSelectedRows(selMap);

      setStatusMessage({ 
        type: 'success', 
        text: `Excel cargado con éxito. Se extrajeron ${res.data.total} registros de aprendices.` 
      });
    } catch (err) {
      console.error('Error subiendo Excel:', err);
      setStatusMessage({ 
        type: 'error', 
        text: err.response?.data?.error || 'Error al procesar el archivo Excel.' 
      });
    } finally {
      setUploadingExcel(false);
    }
  };

  // 2. Manejo de Subida de Anexo Explícito por Fila
  const handleRowAttachmentUpload = async (rowId, file) => {
    if (!file) return;
    setUploadingAttachmentId(rowId);

    const formData = new FormData();
    formData.append('anexo', file);

    try {
      const res = await axios.post('/api/deserciones/upload-anexo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setRowAttachments(prev => ({
        ...prev,
        [rowId]: {
          name: res.data.originalName,
          path: res.data.path
        }
      }));

      setStatusMessage({ type: 'success', text: `Anexo explícito asignado a la comunicación (${res.data.originalName}).` });
    } catch (err) {
      console.error('Error subiendo anexo:', err);
      alert('Error al subir el anexo explícito.');
    } finally {
      setUploadingAttachmentId(null);
    }
  };

  // 2.1 Manejo de Carga Masiva de Paquete de Anexos con Auto-reconocimiento por documento/aprendiz
  const handleBatchAttachmentsUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (excelData.length === 0) {
      alert('Por favor cargue primero el archivo Excel con los datos de los aprendices para realizar el emparejamiento automático.');
      return;
    }

    setUploadingBatchAttachments(true);
    setStatusMessage({ type: 'info', text: `Subiendo paquete masivo de ${files.length} anexos...` });

    const formData = new FormData();
    files.forEach(f => formData.append('anexos', f));

    try {
      const res = await axios.post('/api/deserciones/upload-masivo-anexos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const uploadedFiles = res.data.files || [];
      const newAttachments = { ...rowAttachments };
      let matchedCount = 0;

      uploadedFiles.forEach(file => {
        const originalFileName = (file.originalName || '').trim();
        const baseFileName = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || originalFileName;
        const cleanFileName = baseFileName.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Buscar en excelData la fila que coincida por resolución, documento, ficha, nombre o cualquier casilla de la fila
        const matchedRow = excelData.find(row => {
          // 1. Verificar coincidencia con cualquier celda del raw_row (ej. Resolución, No. Resolución, etc.)
          if (row.raw_row && typeof row.raw_row === 'object') {
            for (const [colKey, cellVal] of Object.entries(row.raw_row)) {
              if (cellVal === undefined || cellVal === null) continue;
              const strVal = String(cellVal).trim();
              if (!strVal || strVal.length < 3) continue;

              const cleanVal = strVal.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (!cleanVal || cleanVal.length < 3) continue;

              // Coincidencia limpia si el archivo contiene el valor de la celda de resolución o viceversa
              if (cleanFileName.includes(cleanVal) || cleanVal.includes(cleanFileName)) {
                return true;
              }

              // Coincidencia directa insensible a mayúsculas
              if (baseFileName.toLowerCase().includes(strVal.toLowerCase()) || strVal.toLowerCase().includes(baseFileName.toLowerCase())) {
                return true;
              }
            }
          }

          // 2. Verificar coincidencia con campos mapeados principales
          const candidates = [
            row.resolucion,
            row.aprendiz_doc_numero,
            row.ficha,
            row.aprendiz_nombre
          ];

          for (const cand of candidates) {
            if (!cand) continue;
            const strCand = String(cand).trim();
            if (!strCand || strCand.length < 3) continue;

            const cleanCand = strCand.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanCand && cleanCand.length >= 3) {
              if (cleanFileName.includes(cleanCand) || cleanCand.includes(cleanFileName)) {
                return true;
              }
            }
          }

          return false;
        });

        if (matchedRow) {
          newAttachments[matchedRow.id_temp] = {
            name: file.originalName,
            path: file.path
          };
          matchedCount++;
        }
      });

      setRowAttachments(newAttachments);
      setStatusMessage({
        type: 'success',
        text: `Carga masiva completada: ${uploadedFiles.length} archivos subidos. ${matchedCount} anexos reconocidos y emparejados automáticamente con sus oficios.`
      });
    } catch (err) {
      console.error('Error en carga masiva de anexos:', err);
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.error || 'Error al procesar el paquete masivo de anexos.'
      });
    } finally {
      setUploadingBatchAttachments(false);
    }
  };

  // 3. Insertar Chip de Variable en el Editor de Texto (en la posición actual del cursor)
  const insertChip = (chipText) => {
    const textarea = textareaRef.current;
    const currentText = activeTab === 'citacion' ? textoInicialCitacion : textoInicialResolucion;

    if (!textarea) {
      if (activeTab === 'citacion') {
        setTextoInicialCitacion(prev => prev + ' ' + chipText);
      } else {
        setTextoInicialResolucion(prev => prev + ' ' + chipText);
      }
      return;
    }

    const start = textarea.selectionStart !== undefined ? textarea.selectionStart : currentText.length;
    const end = textarea.selectionEnd !== undefined ? textarea.selectionEnd : currentText.length;

    const newText = currentText.substring(0, start) + chipText + currentText.substring(end);

    if (activeTab === 'citacion') {
      setTextoInicialCitacion(newText);
    } else {
      setTextoInicialResolucion(newText);
    }

    // Mantener enfoque y mover cursor justo después de la variable insertada
    setTimeout(() => {
      textarea.focus();
      const nextPos = start + chipText.length;
      textarea.setSelectionRange(nextPos, nextPos);
    }, 0);
  };

  // 4. Agregar / Eliminar Correos CC
  const handleAddCcEmail = () => {
    if (!newCcEmail.trim()) return;
    setCcEmails(prev => [...prev, { name: newCcName.trim() || newCcEmail.split('@')[0], email: newCcEmail.trim() }]);
    setNewCcName('');
    setNewCcEmail('');
  };

  const handleRemoveCcEmail = (idx) => {
    setCcEmails(prev => prev.filter((_, i) => i !== idx));
  };

  // 5. Vista Previa de Correspondencia Combinada
  const handleOpenPreview = async (item) => {
    setPreviewItem(item);
    const template = activeTab === 'citacion' ? textoInicialCitacion : textoInicialResolucion;
    try {
      const res = await axios.post('/api/deserciones/preview-merge', {
        template: template,
        row: item
      });
      setPreviewText(res.data.mergedText);
      setShowPreviewModal(true);
    } catch (e) {
      console.error('Error obteniendo vista previa:', e);
    }
  };

  // 6. Guardar casos (con opción de generar PDF o directo para Robot OnBase)
  const handleGuardarYGenerar = async (opts = { generatePdf: true }) => {
    const rowsToProcess = excelData.filter(r => selectedRows[r.id_temp]);

    if (rowsToProcess.length === 0) {
      setStatusMessage({ type: 'warning', text: 'Debe seleccionar al menos un aprendiz/fila de la tabla.' });
      return;
    }

    setProcessingSave(true);
    setStatusMessage({ 
      type: 'info', 
      text: opts.generatePdf ? 'Generando correspondencias combinadas en PDF...' : 'Guardando campos de formulario y anexos para el Robot OnBase...' 
    });

    const etapa = activeTab === 'citacion' ? 'CITACION_COMITE' : 'NOTIFICACION_RESOLUCION';
    const textoInicial = activeTab === 'citacion' ? textoInicialCitacion : textoInicialResolucion;

    // Adjuntar las rutas de los anexos explícitos asignados por fila
    const casosConAnexos = rowsToProcess.map(row => ({
      ...row,
      anexo_path: rowAttachments[row.id_temp]?.path || ''
    }));

    try {
      const res = await axios.post('/api/deserciones/guardar-casos', {
        etapa: etapa,
        texto_inicial: textoInicial,
        casos: casosConAnexos,
        onbase_target_user: selectedOnbaseUser,
        copy_emails: ccEmails,
        generate_pdf: opts.generatePdf
      });

      setStatusMessage({
        type: 'success',
        text: res.data.message
      });

      fetchHistorico();
      setActiveTab('historico');
    } catch (err) {
      console.error('Error guardando casos:', err);
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.error || 'Error al guardar los casos de deserción.'
      });
    } finally {
      setProcessingSave(false);
    }
  };

  // 7. Cargar casos a OnBase Web
  const handleCargueOnBaseBatch = async (casoIds) => {
    if (!casoIds || casoIds.length === 0) {
      alert('Seleccione casos del histórico para realizar el cargue a OnBase.');
      return;
    }

    setProcessingOnBase(true);
    try {
      const res = await axios.post('/api/deserciones/cargue-onbase', {
        caso_ids: casoIds
      });

      alert(res.data.message);
      fetchHistorico();
    } catch (err) {
      console.error('Error cargando a OnBase:', err);
      alert(err.response?.data?.error || 'Error ejecutando cargue a OnBase Web.');
    } finally {
      setProcessingOnBase(false);
    }
  };

  // 8. Limpiar / vaciar histórico de casos de prueba
  const handleLimpiarCasos = async () => {
    if (!window.confirm('¿Está seguro de que desea eliminar todos los datos de prueba del histórico de OnBase?')) {
      return;
    }
    try {
      const res = await axios.post('/api/deserciones/limpiar-casos');
      setStatusMessage({ type: 'success', text: res.data.message });
      fetchHistorico();
    } catch (err) {
      console.error('Error al vaciar histórico:', err);
      alert('Error al vaciar el histórico de casos.');
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Header del Módulo */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        background: 'linear-gradient(135deg, #00324d 0%, #39a900 100%)', 
        color: 'white', 
        padding: '24px 32px', 
        borderRadius: '16px', 
        marginBottom: '24px',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileSpreadsheet size={32} color="#fff" />
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '700', letterSpacing: '-0.5px' }}>
              Módulo de Deserciones y Comunicaciones (OnBase Web)
            </h1>
          </div>
          <p style={{ margin: '8px 0 0 44px', opacity: 0.9, fontSize: '14px' }}>
            Gestión masiva de Citaciones a Comité y Notificación de Resoluciones con correspondencia combinada y envío de anexos a OnBase.
          </p>
        </div>
        <button 
          onClick={fetchHistorico}
          style={{ 
            background: 'rgba(255,255,255,0.2)', 
            border: '1px solid rgba(255,255,255,0.4)', 
            color: 'white', 
            padding: '10px 16px', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            fontWeight: '600',
            backdropFilter: 'blur(4px)'
          }}
        >
          <RefreshCw size={16} /> Actualizar Datos
        </button>
      </div>

      {/* Alerta de Estado / Mensajes */}
      {statusMessage.text && (
        <div style={{ 
          padding: '14px 20px', 
          borderRadius: '10px', 
          marginBottom: '20px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          fontWeight: '500',
          background: statusMessage.type === 'success' ? '#dcfce7' : statusMessage.type === 'error' ? '#fee2e2' : '#e0f2fe',
          color: statusMessage.type === 'success' ? '#166534' : statusMessage.type === 'error' ? '#991b1b' : '#075985',
          border: `1px solid ${statusMessage.type === 'success' ? '#86efac' : statusMessage.type === 'error' ? '#fca5a5' : '#7dd3fc'}`
        }}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Tabs Switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid #e2e8f0', paddingBottom: '2px' }}>
        <button 
          onClick={() => setActiveTab('citacion')}
          style={{
            padding: '12px 24px',
            borderRadius: '10px 10px 0 0',
            border: 'none',
            fontWeight: '600',
            fontSize: '15px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: activeTab === 'citacion' ? '#39a900' : '#f1f5f9',
            color: activeTab === 'citacion' ? '#fff' : '#64748b',
            transition: 'all 0.2s'
          }}
        >
          <Calendar size={18} /> 1. Citación a Comité
        </button>
        <button 
          onClick={() => setActiveTab('resolucion')}
          style={{
            padding: '12px 24px',
            borderRadius: '10px 10px 0 0',
            border: 'none',
            fontWeight: '600',
            fontSize: '15px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: activeTab === 'resolucion' ? '#39a900' : '#f1f5f9',
            color: activeTab === 'resolucion' ? '#fff' : '#64748b',
            transition: 'all 0.2s'
          }}
        >
          <FileText size={18} /> 2. Notificación de Resoluciones
        </button>
        <button 
          onClick={() => setActiveTab('historico')}
          style={{
            padding: '12px 24px',
            borderRadius: '10px 10px 0 0',
            border: 'none',
            fontWeight: '600',
            fontSize: '15px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: activeTab === 'historico' ? '#00324d' : '#f1f5f9',
            color: activeTab === 'historico' ? '#fff' : '#64748b',
            transition: 'all 0.2s'
          }}
        >
          <Send size={18} /> 3. Histórico y Cargue OnBase ({historico.length})
        </button>
      </div>

      {/* PESTAÑA 1 Y 2: VISTA PRINCIPAL DE TRÁMITE */}
      {(activeTab === 'citacion' || activeTab === 'resolucion') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>
          
          {/* Panel Izquierdo: Excel, Editor y Tabla */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Box 1: Carga de Excel */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={20} color="#39a900" />
                1. Cargar Base de Datos desde Excel (.xlsx / .xls)
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <input 
                  type="file" 
                  accept=".xlsx, .xls"
                  onChange={handleExcelUpload}
                  style={{ display: 'none' }}
                  id="excel-file-input"
                />
                <label 
                  htmlFor="excel-file-input"
                  style={{
                    background: '#f8fafc',
                    border: '2px dashed #cbd5e1',
                    borderRadius: '10px',
                    padding: '16px 24px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flex: 1,
                    justifyContent: 'center',
                    color: '#475569',
                    fontWeight: '500'
                  }}
                >
                  <FileSpreadsheet size={24} color="#00324d" />
                  {excelFile ? excelFile.name : 'Haz clic aquí para examinar y cargar tu archivo Excel'}
                </label>
                {excelData.length > 0 && (
                  <div style={{ background: '#ecfdf5', color: '#047857', padding: '12px 18px', borderRadius: '8px', fontWeight: '600' }}>
                    ✓ {excelData.length} Aprendices
                  </div>
                )}
              </div>
            </div>

            {/* Box 2: Editor de Texto Inicial y Combinación de Campos */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={20} color="#39a900" />
                  2. Redactar Texto Inicial y Combinar Campos
                </h3>
                <span style={{ fontSize: '12px', background: '#ecfdf5', color: '#047857', padding: '4px 10px', borderRadius: '6px', fontWeight: '600', border: '1px solid #a7f3d0' }}>
                  ✓ Plantilla Almacenada
                </span>
              </div>
              
              <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#64748b' }}>
                Haz clic en cualquier etiqueta/chip para insertar la variable {columns.length > 0 ? 'extraída del Excel cargado' : 'estándar SENA'} en la plantilla:
              </p>

              {/* Chips de variables (Campos de Excel de los títulos de cada columna) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px', maxHeight: '120px', overflowY: 'auto', padding: '6px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                {availableChips.map(chip => (
                  <button 
                    key={chip}
                    onClick={() => insertChip(chip)}
                    style={{
                      background: '#e0f2fe',
                      color: '#0369a1',
                      border: '1px solid #bae6fd',
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title={`Haga clic para insertar la variable ${chip}`}
                  >
                    + {chip}
                  </button>
                ))}
              </div>

              <textarea 
                ref={textareaRef}
                rows={8}
                value={activeTab === 'citacion' ? textoInicialCitacion : textoInicialResolucion}
                onChange={(e) => activeTab === 'citacion' ? setTextoInicialCitacion(e.target.value) : setTextoInicialResolucion(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
                placeholder="Escriba aquí el texto inicial de la comunicación..."
              />
            </div>

            {/* Box 3: Tabla de Aprendices y Anexos Explícitos / Masivos */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Paperclip size={20} color="#39a900" />
                  3. Tabla Combinada y Anexo Explícito por Aprendiz ({activeTab === 'citacion' ? 'Anexo del Comité' : 'Anexo de Resolución'})
                </h3>

                {/* Botón de Cargue Masivo de Paquete de Anexos */}
                {excelData.length > 0 && (
                  <label style={{
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#00324d',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    boxShadow: '0 2px 6px rgba(0,50,77,0.2)'
                  }}>
                    <Upload size={16} />
                    {uploadingBatchAttachments ? 'Cargando Paquete Masivo...' : 'Cargar Paquete Masivo de Adjuntos'}
                    <input 
                      type="file" 
                      multiple 
                      accept=".pdf,.doc,.docx"
                      onChange={handleBatchAttachmentsUpload}
                      style={{ display: 'none' }}
                      disabled={uploadingBatchAttachments}
                    />
                  </label>
                )}
              </div>

              {excelData.length === 0 ? (
                <div style={{ padding: '40px', textIndent: 'center', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '8px' }}>
                  Carga un archivo Excel arriba para visualizar las filas combinadas y adjuntar los archivos de anexo.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', textTransform: 'uppercase', fontSize: '11px', color: '#475569' }}>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Sel</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Aprendiz</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Documento</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Ficha</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Programa</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Causal</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Anexo Explícito / Masivo</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {excelData.map((row, idx) => (
                        <tr key={row.id_temp || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <input 
                              type="checkbox"
                              checked={!!selectedRows[row.id_temp]}
                              onChange={(e) => setSelectedRows(prev => ({ ...prev, [row.id_temp]: e.target.checked }))}
                            />
                          </td>
                          <td style={{ padding: '10px', fontWeight: '600', color: '#0f172a' }}>{row.aprendiz_nombre || 'N/A'}</td>
                          <td style={{ padding: '10px' }}>{row.aprendiz_doc_tipo} {row.aprendiz_doc_numero}</td>
                          <td style={{ padding: '10px' }}>{row.ficha}</td>
                          <td style={{ padding: '10px' }}>{row.programa}</td>
                          <td style={{ padding: '10px' }}>{row.causal_desercion || 'DESERCIÓN'}</td>
                          
                          {/* Adjunto Explícito por comunicación */}
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <input 
                                type="file" 
                                onChange={(e) => handleRowAttachmentUpload(row.id_temp, e.target.files[0])}
                                style={{ display: 'none' }}
                              />
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '600',
                                background: rowAttachments[row.id_temp] ? '#dcfce7' : '#f1f5f9',
                                color: rowAttachments[row.id_temp] ? '#15803d' : '#64748b',
                                border: `1px solid ${rowAttachments[row.id_temp] ? '#86efac' : '#cbd5e1'}`
                              }}>
                                {uploadingAttachmentId === row.id_temp ? 'Subiendo...' : rowAttachments[row.id_temp] ? `✓ ${rowAttachments[row.id_temp].name}` : '+ Adjuntar Anexo'}
                              </span>
                            </label>
                          </td>

                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <button 
                              onClick={() => handleOpenPreview(row)}
                              style={{
                                background: '#e0f2fe',
                                color: '#0284c7',
                                border: 'none',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}
                            >
                              <Eye size={14} /> Ver Carta
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* Panel Derecho: Configuración OnBase & Envíos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* OnBase Destination User */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <h3 style={{ margin: '0 0 14px 0', color: '#0f172a', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck size={18} color="#00324d" />
                Usuario OnBase Destino
              </h3>
              <label style={{ display: 'block', fontSize: '13px', color: '#475569', marginBottom: '6px' }}>
                Selecciona el usuario de OnBase para el cargue:
              </label>
              <select 
                value={selectedOnbaseUser}
                onChange={(e) => setSelectedOnbaseUser(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  background: '#f8fafc'
                }}
              >
                {onbaseUsers.map((u, i) => (
                  <option key={u.id || i} value={u.full_name || u.document_no}>
                    {u.full_name} ({u.area || u.role || 'OnBase User'})
                  </option>
                ))}
              </select>
            </div>

            {/* Correos en Copia (CC) */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <h3 style={{ margin: '0 0 14px 0', color: '#0f172a', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={18} color="#00324d" />
                Correos en Copia (CC desde OnBase)
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                {ccEmails.map((cc, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}>
                    <div>
                      <strong style={{ color: '#0f172a' }}>{cc.name}</strong>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{cc.email}</div>
                    </div>
                    <button 
                      onClick={() => handleRemoveCcEmail(idx)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Form de agregar nuevo correo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder="Nombre de la persona/dependencia"
                  value={newCcName}
                  onChange={(e) => setNewCcName(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input 
                    type="email" 
                    placeholder="correo@sena.edu.co"
                    value={newCcEmail}
                    onChange={(e) => setNewCcEmail(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                  <button 
                    onClick={handleAddCcEmail}
                    style={{ background: '#00324d', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Acciones Finales (Robot OnBase sin PDF vs Generar PDF) */}
            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={() => handleGuardarYGenerar({ generatePdf: false })}
                disabled={processingSave || excelData.length === 0}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #00324d 0%, #00507a 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '14px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: (processingSave || excelData.length === 0) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(0,50,77,0.25)',
                  opacity: excelData.length === 0 ? 0.6 : 1
                }}
              >
                <Play size={18} color="#39a900" />
                {processingSave ? 'Procesando...' : 'Guardar y Preparar para Robot OnBase (Sin PDF)'}
              </button>

              <button 
                onClick={() => handleGuardarYGenerar({ generatePdf: true })}
                disabled={processingSave || excelData.length === 0}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #39a900 0%, #2e8b00 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: (processingSave || excelData.length === 0) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: excelData.length === 0 ? 0.6 : 1
                }}
              >
                <FileText size={16} />
                Generar Correspondencias PDF y Guardar
              </button>
            </div>

          </div>

        </div>
      )}

      {/* PESTAÑA 3: HISTÓRICO Y CARGUE A ONBASE */}
      {activeTab === 'historico' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: '20px' }}>Histórico de Comunicaciones y Estado de Cargue a OnBase</h2>
              <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
                Monitoreo general de citaciones y resoluciones generadas y su estado en el trámite de OnBase.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {historico.length > 0 && (
                <button 
                  onClick={handleLimpiarCasos}
                  style={{
                    background: '#fef2f2',
                    color: '#dc2626',
                    border: '1px solid #fca5a5',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  title="Eliminar todos los registros de prueba del histórico"
                >
                  <Trash2 size={16} /> Limpiar Histórico
                </button>
              )}

              <button 
                onClick={() => {
                  const pendIds = historico.filter(h => h.status === 'Pendiente').map(h => h.id);
                  handleCargueOnBaseBatch(pendIds);
                }}
                disabled={processingOnBase || historico.filter(h => h.status === 'Pendiente').length === 0}
                style={{
                  background: '#00324d',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Send size={18} /> Cargar Pendientes a OnBase Web ({historico.filter(h => h.status === 'Pendiente').length})
              </button>
            </div>
          </div>

          {loadingHistorico ? (
            <div style={{ padding: '40px', textIndent: 'center', textAlign: 'center', color: '#64748b' }}>
              Cargando historial de correspondencia...
            </div>
          ) : historico.length === 0 ? (
            <div style={{ padding: '40px', textIndent: 'center', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '8px' }}>
              Aún no se han generado comunicaciones de deserciones.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', textTransform: 'uppercase', fontSize: '11px', color: '#475569' }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}>ID / Fecha</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Etapa</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Aprendiz</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Ficha</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Usuario OnBase</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Carta PDF</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Anexo Explícito</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map(caso => (
                    <tr key={caso.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px', fontWeight: '600' }}>
                        #{caso.id}<br/>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{new Date(caso.created_at).toLocaleDateString('es-CO')}</span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '700',
                          background: caso.etapa === 'CITACION_COMITE' ? '#e0f2fe' : '#fef3c7',
                          color: caso.etapa === 'CITACION_COMITE' ? '#0369a1' : '#b45309'
                        }}>
                          {caso.etapa === 'CITACION_COMITE' ? 'Citación Comité' : 'Notif. Resolución'}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <strong style={{ color: '#0f172a' }}>{caso.aprendiz_nombre}</strong><br/>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{caso.aprendiz_doc_tipo} {caso.aprendiz_doc_numero}</span>
                      </td>
                      <td style={{ padding: '12px' }}>{caso.ficha}</td>
                      <td style={{ padding: '12px' }}>{caso.onbase_target_user || 'Sin asignar'}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {caso.comunicacion_pdf_path ? (
                          <span style={{ color: '#39a900', fontWeight: '600', fontSize: '12px' }}>✓ Creada</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {caso.anexo_path ? (
                          <span style={{ color: '#0284c7', fontWeight: '600', fontSize: '12px' }}>✓ Adjunto</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Sin anexo</span>
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '700',
                          background: caso.status === 'Cargado' ? '#dcfce7' : '#f3f4f6',
                          color: caso.status === 'Cargado' ? '#15803d' : '#4b5563'
                        }}>
                          {caso.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Vista Previa de Carta */}
      {showPreviewModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            maxWidth: '750px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '32px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#00324d', borderBottom: '2px solid #39a900', paddingBottom: '10px' }}>
              Vista Previa de Comunicación Combinada
            </h3>
            
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '14px', marginBottom: '24px' }}>
              {previewText}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowPreviewModal(false)}
                style={{
                  background: '#00324d',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cerrar Vista Previa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
