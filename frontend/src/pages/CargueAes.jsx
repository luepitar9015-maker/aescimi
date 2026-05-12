import { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { Play, CheckCircle, Clock, AlertCircle, FileText, Search, RefreshCw, Monitor, X, Globe, Settings as SettingsIcon, Save, Download, Trash, Database, Eye } from 'lucide-react';

function CargueAes() {
    const [activeTab, setActiveTab] = useState('cargue'); // 'cargue' or 'creacion'

    // Cargue AES State
    const [configDoc, setConfigDoc] = useState(null);
    const [editingModal, setEditingModal] = useState(false);
    const [modalEditFields, setModalEditFields] = useState({});
    const [editingCode, setEditingCode] = useState({});
    const [statusFilter, setStatusFilter] = useState('Pendiente'); // 'Todos', 'Pendiente', 'Cargado'
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [logs, setLogs] = useState([]);
    const [automationLoading, setAutomationLoading] = useState(false);
    const [liveFrame, setLiveFrame] = useState(null);

    // Automation Flow Tracking
    const [currentStepIndex, setCurrentStepIndex] = useState(-1);
    const [automationError, setAutomationError] = useState(false);
    const [selectedDocs, setSelectedDocs] = useState([]);

    const automationSteps = [
        { id: 'start', label: '1. Conectando e Iniciando Sesión (OnBase Web Client)', match: ['Iniciando proceso', 'Conectando con OnBase', 'Autenticación exitosa', 'Post-login URL'] },
        { id: 'nav', label: '2. Abriendo Menú y "Nuevo Formulario"', match: ['Buscando menú principal', 'Menú hamburguesa', 'Nuevo Formulario" seleccionado'] },
        { id: 'type', label: '3. Seleccionando "SGDEA - Ingreso a Expediente"', match: ['Buscando tipo documental SGDEA', 'Tipo documental seleccionado:'] },
        { id: 'fill', label: '4. Diligenciando Metadatos e Índices', match: ['Diligenciando metadatos', 'Metadatos diligenciados'] },
        { id: 'upload', label: '5. Adjuntando Archivo Electrónico PDF', match: ['Adjuntando archivo', 'Click en botón "Importar"', 'Archivo PDF cargado'] },
        { id: 'save', label: '6. Guardando y Radicando Documento', match: ['Guardando y radicando', 'Botón guardar activado', 'Documento radicado exitosamente', 'Ventana aceptada'] },
        { id: 'restart', label: '7. Cerrar y si sigue el siguiente documento, reinicia al paso 1', match: ['Esperando para procesar', 'Reiniciando ciclo'] }
    ];

    useEffect(() => {
        if (logs.length > 0) {
            const lastLog = logs[logs.length - 1] || '';
            const isError = lastLog.includes('Error:') || lastLog.includes('[ERROR]') || lastLog.includes('falló') || lastLog.includes('WARN] Could not find a way') || lastLog.includes('failed:');

            if (isError) {
                setAutomationError(true);
            } else {
                let foundIndex = -1;
                for (let i = automationSteps.length - 1; i >= 0; i--) {
                    if (automationSteps[i].match.some(m => lastLog.includes(m))) {
                        foundIndex = i;
                        break;
                    }
                }

                if (foundIndex !== -1) {
                    setCurrentStepIndex(foundIndex);
                    // Also clear error if we are advancing successfully after a retry
                    setAutomationError(false);
                } else if (lastLog.includes('form saved successfully') || lastLog.includes('Proceso de cargue completado')) {
                    setCurrentStepIndex(automationSteps.length); // All done
                }
            }
        }
    }, [logs]);

    // Creación Masiva State
    const [expedientes, setExpedientes] = useState([]);
    const [massCreationLoading, setMassCreationLoading] = useState(false);
    const [massCreationStatus, setMassCreationStatus] = useState('');
    const [formData, setFormData] = useState({
        expediente_code: '',
        box_id: '',
        opening_date: '',
        subserie: '',
        storage_type: '',
        title: '',
        valor1: '', valor2: '', valor3: '', valor4: '',
        valor5: '', valor6: '', valor7: '', valor8: ''
    });
    const [allSubseries, setAllSubseries] = useState([]);
    const [currentLabels, setCurrentLabels] = useState({});
    const fetchDocuments = async (filter) => {
        const activeFilter = filter !== undefined ? filter : statusFilter;
        setLoading(true);
        try {
            let data = [];
            if (activeFilter === 'Pendiente') {
                // Use the specialized ADES endpoint with full expediente metadata
                const res = await axios.get('/api/ades/pending');
                data = res.data;
            } else {
                // Use /api/documents which always works — filter by status client-side
                const res = await axios.get('/api/documents');
                const allDocs = res.data?.data || res.data || [];
                data = activeFilter === 'Todos'
                    ? allDocs
                    : allDocs.filter(d => d.status === activeFilter);
                // Normalize keys to match ADES format
                data = data.map(d => ({
                    ...d,
                    expediente_metadata: d.expediente_metadata || {},
                    document_metadata: d.document_metadata || {},
                    expediente_code: d.expediente_code || '',
                    title: d.expediente_title || d.title || '',
                    subserie: d.subserie || '',
                    storage_type: d.storage_type || '',
                    box_id: d.box_id || '',
                    opening_date: d.opening_date || '',
                }));
            }
            setDocuments(data);
            const codes = {};
            data.forEach(d => { codes[d.id] = d.expediente_code || ''; });
            setEditingCode(codes);
        } catch (err) {
            console.error("Error fetching documents:", err);
        } finally {
            setLoading(false);
        }
    };

    // alias for backward compat
    const fetchPending = () => fetchDocuments(statusFilter);

    useEffect(() => {
        fetchDocuments(statusFilter);
        fetchSubseriesList();
    }, [statusFilter]);


    const fetchSubseriesList = async () => {
        try {
            const res = await axios.get('/api/trd/subseries/all');
            setAllSubseries(res.data.data || []);
        } catch (err) {
            console.error("Error fetching subseries list:", err);
        }
    };

    const handleRunAutomation = async (specificDocId = null) => {
        // Enforce the logical order and filter only 'Pendiente' documents for bulk processing
        let docsToProcess = [];
        if (specificDocId) {
            docsToProcess = documents.filter(d => d.id === specificDocId);
        } else if (selectedDocs.length > 0) {
            docsToProcess = documents.filter(d => selectedDocs.includes(d.id) && d.status === 'Pendiente');
        } else {
            return alert("Seleccione al menos un documento pendiente de la lista marcando las casillas.");
        }

        if (docsToProcess.length === 0) return alert("Los documentos seleccionados no son válidos o ya están cargados.");

        // ── VALIDACIÓN: Primer documento obligatorio ──────────────────
        const docsSinPrimerDoc = [];
        for (const doc of docsToProcess) {
            if (!doc.expediente_id) continue;
            try {
                const val = await axios.get(`/api/seguimiento/validar-primer-doc/${doc.expediente_id}`);
                if (!val.data.valid && val.data.primer_documento) {
                    docsSinPrimerDoc.push({
                        filename: doc.filename,
                        primer_doc: val.data.primer_documento
                    });
                }
            } catch { /* no bloquear si falla la validación */ }
        }
        if (docsSinPrimerDoc.length > 0) {
            const lista = docsSinPrimerDoc.map(d => `• ${d.filename} → falta: "${d.primer_doc}"`).join('\n');
            const continuar = window.confirm(
                `⚠️ ADVERTENCIA: Los siguientes expedientes NO tienen el primer documento obligatorio cargado:\n\n${lista}\n\n¿Desea continuar de todas formas?`
            );
            if (!continuar) return;
        }
        // ─────────────────────────────────────────────────────────────

        if (specificDocId) setConfigDoc(null); // Close modal if starting from there
        setAutomationLoading(true);

        // Fetch latest settings once before loop
        const token = localStorage.getItem('token');
        const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
        let settings;
        try {
            const settingsRes = await axios.get('/api/settings/all', { headers: authHeaders });
            settings = settingsRes.data;
            if (!settings.ades_url) throw new Error("La URL de AES no está configurada. Vaya a Configuración AES.");
        } catch (err) {
            setLogs([`Error de configuración: ${err.message}`]);
            setAutomationError(true);
            setAutomationLoading(false);
            return;
        }

        // Processing loop for all selected documents
        for (let i = 0; i < docsToProcess.length; i++) {
            const docToProcess = docsToProcess[i];

            setLogs([
                `=== Procesando ${i + 1} de ${docsToProcess.length} ===`,
                'Iniciando proceso de cargue AES...',
                'Obteniendo configuración del sistema...'
            ]);
            setLiveFrame(null);
            setCurrentStepIndex(0);
            setAutomationError(false);

            // START LIVE STREAM
            const eventSource = new EventSource('/api/automation/stream');
            eventSource.onmessage = (event) => {
                setLiveFrame(`data:image/jpeg;base64,${event.data}`);
            };
            eventSource.onerror = () => {
                eventSource.close();
            };

            setLogs(prev => [...prev, `Iniciando cargue para: ${docToProcess.filename}...`]);

            try {
                const res = await axios.post('/api/automation/execute', {
                    url: settings.ades_url,
                    username: settings.ades_username,
                    password: settings.ades_password,
                    documentId: docToProcess.id
                }, { headers: authHeaders });

                setLogs(prev => [...prev, ...res.data.logs, res.data.test_mode ? '✅ PRUEBA finalizada — el documento vuelve a estado Pendiente.' : 'Proceso de cargue completado.']);

                if (res.data.test_mode) {
                    // MODO PRUEBA: no cambiar estado, el documento queda Pendiente
                    setCurrentStepIndex(automationSteps.length);
                    await fetchPending();
                } else if (!res.data.logs.some(log => log.includes('[ERROR]') || log.includes('Fallo crítico'))) {
                    // MODO REAL: marcar como Cargado
                    setCurrentStepIndex(automationSteps.length);
                    await axios.post('/api/ades/update-status', {
                        id: docToProcess.id,
                        status: 'Cargado',
                        ades_id: 'AES-' + Math.floor(Math.random() * 1000000)
                    });
                    await fetchPending();
                } else {
                    setAutomationError(true);
                    eventSource.close();
                    break;
                }
            } catch (err) {
                console.error("Automation error:", err);
                setLogs(prev => [...prev, `Error: ${err.message || 'El proceso falló. Revise la conexión con OnBase.'}`]);
                setAutomationError(true);
                eventSource.close();
                break; // Stop bulk processing
            }

            eventSource.close();

            // Wait a few seconds between documents
            if (i < docsToProcess.length - 1) {
                setLogs(prev => [...prev, '\nEsperando para procesar el siguiente documento...']);
                await new Promise(r => setTimeout(r, 4000));
            }
        }

        setAutomationLoading(false);
    };
    const filteredDocs = documents.filter(doc => {
        // Status filter
        if (statusFilter !== 'Todos' && doc.status !== statusFilter) return false;

        if (!searchTerm) return true;
        const s = searchTerm.toLowerCase().trim();

        // Helper to stringify values safely
        const getStr = (v) => (v === null || v === undefined) ? '' : String(v).toLowerCase();

        // Comprehensive string build for searching
        const mExp = doc.expediente_metadata && typeof doc.expediente_metadata === 'object'
            ? Object.values(doc.expediente_metadata).map(getStr).join(' ')
            : '';
        const mDoc = doc.document_metadata && typeof doc.document_metadata === 'object'
            ? Object.values(doc.document_metadata).map(getStr).join(' ')
            : '';

        const searchableText = [
            doc.filename,
            doc.expediente_code,
            doc.title,
            doc.typology_name,
            doc.box_id,
            doc.subserie,
            mExp,
            mDoc
        ].map(getStr).join(' ');

        return searchableText.includes(s);
    });

    const handleConfig = (doc) => {
        let meta = { ...(doc.expediente_metadata || {}), ...(doc.document_metadata || {}) };

        // Join metadata 1-8 by space
        const joinedName = [1, 2, 3, 4, 5, 6, 7, 8]
            .map(i => meta[`valor${i}`] || meta[`Metadato ${i}`])
            .filter(v => v)
            .join(' ');

        setConfigDoc({
            ...doc,
            joinedName: joinedName || doc.filename,
            grupo: 'TRD'
        });
    };

    const updateExpedienteCode = (id, val) => {
        setEditingCode(prev => ({ ...prev, [id]: val }));
    };

    const handleView = (doc) => {
        window.open(`/api/ades/view/${doc.id}`, '_blank');
    };

    const saveExpedienteCode = async (docId) => {
        try {
            const doc = documents.find(d => d.id === docId);
            await axios.put(`/api/expedientes/${doc.expediente_id}`, {
                expediente_code: editingCode[docId]
            });
            setDocuments(prev => prev.map(d =>
                d.expediente_id === doc.expediente_id ? { ...d, expediente_code: editingCode[docId] } : d
            ));
            alert("Código de expediente actualizado");
        } catch (err) {
            console.error(err);
            alert("Error al actualizar código");
        }
    };

    // --- CREACION MASIVA LOGIC ---
    const handleMassChange = (e) => {
        const { id, value } = e.target;
        setFormData({ ...formData, [id]: value });

        if (id === 'subserie') {
            const selected = allSubseries.find(s => s.subseries_code === value);
            if (selected && selected.metadata_labels) {
                let labels = {};
                try {
                    labels = typeof selected.metadata_labels === 'string'
                        ? JSON.parse(selected.metadata_labels)
                        : selected.metadata_labels;
                } catch { labels = {}; }
                setCurrentLabels(labels);
            } else {
                setCurrentLabels({});
            }
        }
    };

    const handleMassSubmit = (e) => {
        e.preventDefault();
        const metadata = {
            valor1: formData.valor1, valor2: formData.valor2,
            valor3: formData.valor3, valor4: formData.valor4,
            valor5: formData.valor5, valor6: formData.valor6,
            valor7: formData.valor7, valor8: formData.valor8
        };
        const newExpediente = {
            ...formData,
            metadata_values: metadata,
            id: Date.now()
        };
        setExpedientes([...expedientes, newExpediente]);
        setFormData({
            ...formData,
            expediente_code: '',
            title: '',
            valor1: '', valor2: '', valor3: '', valor4: '',
            valor5: '', valor6: '', valor7: '', valor8: ''
        });
    };

    const handleMassDelete = (index) => {
        const newExps = [...expedientes];
        newExps.splice(index, 1);
        setExpedientes(newExps);
    };

    const handleSaveToBackend = async () => {
        if (expedientes.length === 0) return alert("No hay datos para guardar.");
        setMassCreationLoading(true);
        setMassCreationStatus('Guardando...');
        try {
            await axios.post('/api/expedientes/mass', expedientes);
            setMassCreationStatus('¡Guardado exitoso en base de datos!');
            setExpedientes([]);
        } catch (err) {
            console.error(err);
            setMassCreationStatus('Error: ' + (err.response?.data?.error || err.message));
        } finally {
            setMassCreationLoading(false);
        }
    };

    const handleExportTemplate = () => {
        const dataToExport = expedientes.length > 0 ? expedientes.map(exp => {
            const row = {
                "Codigo Expediente": exp.expediente_code,
                "Id Caja": exp.box_id,
                "Fecha Apertura": exp.opening_date,
                "Subserie": exp.subserie,
                "Tipo Almacenamiento": exp.storage_type,
                "Titulo": exp.title,
            };
            for (let i = 1; i <= 8; i++) {
                const label = currentLabels[`meta_${i}`] || `Valor${i}`;
                row[label] = exp.metadata_values[`valor${i}`] || '';
            }
            return row;
        }) : [{
            "Codigo Expediente": "EXP-001", "Id Caja": "123", "Fecha Apertura": "2026-01-01",
            "Subserie": "100.1", "Tipo Almacenamiento": "Fisico", "Titulo": "Ejemplo"
        }];

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Expedientes");
        XLSX.writeFile(wb, "Plantilla_Expedientes_AES.xlsx");
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

                const colMap = {
                    exp_code: findHeader(['Codigo Expediente', 'Cod Exp', 'Nro Expediente', 'Expediente']),
                    box: findHeader(['Id Caja', 'Caja', 'Caja No']),
                    date: findHeader(['Fecha Apertura', 'Fecha Inicio', 'Apertura', 'Fecha']),
                    sub: findHeader(['Subserie', 'Cod Subserie', 'Codigo Subserie']),
                    storage: findHeader(['Tipo Almacenamiento', 'Tipo Almacen', 'Soporte']),
                    tit: findHeader(['Titulo', 'Nombre Expediente', 'Asunto', 'Descripcion']),
                };

                const metadataCols = Array(8).fill(null);
                for (let i = 1; i <= 8; i++) {
                    metadataCols[i - 1] = findHeader([`Valor ${i}`, `Valor${i}`, `Metadato ${i}`, `Metadato${i}`, `Meta ${i}`, `Meta${i}`]);
                }

                const newExps = jsonData.map((row, idx) => {
                    const metadata = {};
                    for (let i = 1; i <= 8; i++) {
                        const colName = metadataCols[i - 1];
                        metadata[`valor${i}`] = colName && row[colName] !== undefined ? String(row[colName]).trim() : '';
                    }
                    return {
                        id: Date.now() + idx + Math.random(),
                        expediente_code: colMap.exp_code ? String(row[colMap.exp_code] || '').trim() : '',
                        box_id: colMap.box ? String(row[colMap.box] || '').trim() : '',
                        opening_date: colMap.date ? String(row[colMap.date] || '').trim() : '',
                        subserie: colMap.sub ? String(row[colMap.sub] || '').trim() : '',
                        storage_type: colMap.storage ? String(row[colMap.storage] || '').trim() : 'Fisico',
                        title: colMap.tit ? String(row[colMap.tit] || '').trim() : 'Sin Título',
                        metadata_values: metadata
                    };
                });
                setExpedientes(prev => [...prev, ...newExps]);
                alert(`${newExps.length} registros cargados.`);
            } catch (err) {
                console.error(err);
                alert("Error al leer Excel.");
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = null;
    };

    return (
        <div className="cargue-ades-container" style={{ padding: '20px', width: '100%', maxWidth: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ margin: 0, color: '#2e7d32' }}>Cargue AES (OnBase)</h1>
                <div className="tabs" style={{ display: 'flex', gap: '5px' }}>
                    <button
                        onClick={() => setActiveTab('cargue')}
                        style={{ padding: '10px 20px', borderRadius: '8px 8px 0 0', border: 'none', background: activeTab === 'cargue' ? '#fff' : '#e0e0e0', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === 'cargue' ? '3px solid #2e7d32' : 'none' }}
                    >
                        Gestión de Cargue
                    </button>
                    <button
                        onClick={() => setActiveTab('creacion')}
                        style={{ padding: '10px 20px', borderRadius: '8px 8px 0 0', border: 'none', background: activeTab === 'creacion' ? '#fff' : '#e0e0e0', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === 'creacion' ? '3px solid #2e7d32' : 'none' }}
                    >
                        Creación de Expedientes
                    </button>
                </div>
            </div>

            {activeTab === 'cargue' ? (
                <div className="workspace" style={{ display: 'flex', gap: '15px', width: '100%' }}>
                    <div style={{ flex: '1' }}>
                        <div className="card" style={{ padding: '15px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', gap: '10px' }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} size={20} />
                                    <input
                                        type="text"
                                        placeholder="Busque por cualquier dato: Nombre, # Identificación (72025...), Caja, Expediente..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        style={{ width: '100%', padding: '12px 12px 12px 45px', borderRadius: '8px', border: '2px solid #39a900', outline: 'none', fontSize: '15px', fontWeight: '500' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '5px', background: '#f0f0f0', padding: '5px', borderRadius: '8px' }}>
                                    {['Todos', 'Pendiente', 'Cargado'].map(st => (
                                        <button
                                            key={st}
                                            onClick={() => setStatusFilter(st)}
                                            style={{
                                                padding: '6px 12px',
                                                border: 'none',
                                                background: statusFilter === st ? '#2e7d32' : 'transparent',
                                                color: statusFilter === st ? '#fff' : '#666',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {st}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={fetchPending}
                                    className="btn btn-secondary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', whiteSpace: 'nowrap' }}
                                    disabled={loading}
                                >
                                    <RefreshCw size={18} className={loading ? 'spin' : ''} /> Actualizar Datos
                                </button>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f5f5f5', textAlign: 'left' }}>
                                            <th style={{ padding: '12px', width: '40px', textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    onChange={(e) => {
                                                        const pendingIds = filteredDocs.filter(d => d.status === 'Pendiente').map(d => d.id);
                                                        if (e.target.checked) setSelectedDocs(pendingIds);
                                                        else setSelectedDocs([]);
                                                    }}
                                                    checked={filteredDocs.filter(d => d.status === 'Pendiente').length > 0 && selectedDocs.length === filteredDocs.filter(d => d.status === 'Pendiente').length}
                                                />
                                            </th>
                                            <th style={{ padding: '12px', width: '140px' }}>Asignar Código</th>
                                            <th style={{ padding: '12px' }}>Información Detallada del Expediente</th>
                                            <th style={{ padding: '12px', width: '180px' }}>Archivo Original</th>
                                            <th style={{ padding: '12px', width: '130px' }}>Tipología</th>
                                            <th style={{ padding: '12px', width: '90px' }}>Fecha</th>
                                            <th style={{ padding: '12px', width: '90px' }}>Estado</th>
                                            <th style={{ padding: '12px', textAlign: 'center', width: '60px' }}>Acc.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredDocs.length > 0 ? filteredDocs.map(doc => (
                                            <tr key={doc.id} style={{ borderTop: '1px solid #eee', backgroundColor: selectedDocs.includes(doc.id) ? '#f1f8e9' : 'transparent' }}>
                                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedDocs.includes(doc.id)}
                                                        disabled={doc.status === 'Cargado'}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedDocs(prev => [...prev, doc.id]);
                                                            else setSelectedDocs(prev => prev.filter(id => id !== doc.id));
                                                        }}
                                                        style={{ transform: 'scale(1.2)', cursor: doc.status === 'Cargado' ? 'not-allowed' : 'pointer' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '10px' }}>
                                                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                                        <input
                                                            type="text"
                                                            value={editingCode[doc.id] || ''}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setEditingCode(prev => ({ ...prev, [doc.id]: val }));
                                                            }}
                                                            onBlur={async () => {
                                                                try {
                                                                    await axios.put(`/api/expedientes/${doc.expediente_id}`, {
                                                                        expediente_code: editingCode[doc.id]
                                                                    });
                                                                    setDocuments(prev => prev.map(d => d.expediente_id === doc.expediente_id ? { ...d, expediente_code: editingCode[doc.id] } : d));
                                                                } catch (err) { console.error(err); }
                                                            }}
                                                            style={{ width: '100px', padding: '6px', border: '2px solid #39a900', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold', color: '#1b5e20', outline: 'none' }}
                                                            placeholder="M-00XX"
                                                        />
                                                    </div>
                                                </td>
                                                <td style={{ padding: '12px' }}>
                                                    <div style={{ backgroundColor: '#e8f5e9', padding: '12px', borderRadius: '10px', border: '1px solid #c8e6c9', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
                                                        <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#1b5e20', marginBottom: '10px', borderBottom: '2px solid #c8e6c9', paddingBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>{doc.title || 'Expediente Sin Título'}</span>
                                                            <span style={{ fontSize: '10px', color: '#666', fontWeight: 'normal' }}>ID: {doc.expediente_id}</span>
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', fontSize: '12px' }}>
                                                            <div style={{ display: 'flex', gap: '5px' }}><strong style={{ color: '#2e7d32' }}>Subserie:</strong> <span style={{ wordBreak: 'break-all' }}>{doc.subserie || '-'}</span></div>
                                                            <div style={{ display: 'flex', gap: '5px' }}><strong style={{ color: '#2e7d32' }}>Caja ID:</strong> <span>{doc.box_id || '-'}</span></div>
                                                            <div style={{ display: 'flex', gap: '5px' }}><strong style={{ color: '#2e7d32' }}>Tipo Almac.:</strong> <span>{doc.storage_type || '-'}</span></div>
                                                            <div style={{ display: 'flex', gap: '5px' }}><strong style={{ color: '#2e7d32' }}>Apertura:</strong> <span>{doc.opening_date || '-'}</span></div>
                                                            {(() => {
                                                                const mExp = doc.expediente_metadata || {};
                                                                const mDoc = doc.document_metadata || {};
                                                                const allMeta = { ...mDoc, ...mExp };
                                                                return Object.entries(allMeta)
                                                                    .filter(([, v]) => v && v.toString().trim() !== '')
                                                                    .map(([k, v]) => (
                                                                        <div key={k} style={{ display: 'flex', gap: '5px' }}>
                                                                            <strong style={{ color: '#2e7d32', textTransform: 'capitalize' }}>{k.replace('valor', 'Valor ')}:</strong>
                                                                            <span style={{ color: '#000' }}>{v}</span>
                                                                        </div>
                                                                    ));
                                                            })()}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        <FileText size={14} color="#1976d2" />
                                                        {doc.filename}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px' }}>{doc.typology_name}</td>
                                                <td style={{ padding: '10px' }}>{new Date(doc.document_date).toLocaleDateString()}</td>
                                                <td style={{ padding: '10px' }}>
                                                    <span style={{
                                                        padding: '2px 8px',
                                                        borderRadius: '10px',
                                                        fontSize: '11px',
                                                        backgroundColor: doc.status === 'Cargado' ? '#e8f5e9' : '#fff3e0',
                                                        color: doc.status === 'Cargado' ? '#2e7d32' : '#ef6c00',
                                                        border: `1px solid ${doc.status === 'Cargado' ? '#c8e6c9' : '#ffe0b2'}`
                                                    }}>
                                                        {doc.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                                        <button
                                                            onClick={() => handleView(doc)}
                                                            title="Visualizar Archivo"
                                                            style={{ padding: '6px', background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: '4px', color: '#2e7d32', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        {doc.status === 'Cargado' ? (
                                                            <>
                                                                <div title="Ya cargado en OnBase" style={{ padding: '5px 10px', background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: '4px', color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 'bold' }}>
                                                                    <CheckCircle size={14} /> Cargado
                                                                </div>
                                                                <button
                                                                    title="Revertir a Pendiente"
                                                                    onClick={async () => {
                                                                        if (!window.confirm(`¿Revertir "${doc.typology_name}" a estado Pendiente?`)) return;
                                                                        try {
                                                                            const token = localStorage.getItem('token');
                                                                            await axios.post('/api/ades/update-status',
                                                                                { id: doc.id, status: 'Pendiente', ades_id: null },
                                                                                { headers: { Authorization: `Bearer ${token}` } }
                                                                            );
                                                                            alert(`✅ Documento "${doc.typology_name}" revertido a Pendiente. Mostrando lista de Pendientes.`);
                                                                            setStatusFilter('Pendiente');

                                                                        } catch (err) {
                                                                            alert('Error al revertir: ' + (err.response?.data?.error || err.message));
                                                                        }
                                                                    }}
                                                                    style={{ padding: '5px 10px', background: '#fff3e0', border: '1px solid #ffcc02', borderRadius: '4px', color: '#e65100', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 'bold' }}
                                                                >
                                                                    <RefreshCw size={13} /> Revertir
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleConfig(doc)}
                                                                className="btn-config"
                                                                title="Formulario de Configuración"
                                                                style={{ padding: '5px 10px', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '4px', color: '#1976d2', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                                                            >
                                                                <SettingsIcon size={14} /> Config
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="7" style={{ padding: '60px', textAlign: 'center' }}>
                                                    <div style={{ color: '#999', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                        {loading ? (
                                                            <p>Cargando documentos...</p>
                                                        ) : searchTerm ? (
                                                            <>
                                                                <Search size={40} style={{ marginBottom: '15px', opacity: 0.3 }} />
                                                                <p>No se encontraron resultados para "<strong>{searchTerm}</strong>"</p>
                                                                <button
                                                                    onClick={() => setSearchTerm('')}
                                                                    style={{ marginTop: '10px', color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '14px' }}
                                                                >
                                                                    Limpiar búsqueda
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <FileText size={40} style={{ marginBottom: '15px', opacity: 0.3 }} />
                                                                <p>No hay documentos pendientes de cargue.</p>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {filteredDocs.length > 0 && (
                                <div style={{ marginTop: '20px' }}>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => handleRunAutomation()}
                                        disabled={automationLoading}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
                                    >
                                        {automationLoading ? 'Ejecutando proceso en OnBase...' : <><Play size={18} /> Iniciar Cargue AES ({filteredDocs.length} Docs)</>}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ width: '480px' }}>
                        <div className="card" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '12px', borderLeft: '4px solid #39a900' }}>
                            <h3 style={{ marginTop: 0, fontSize: '16px', borderBottom: '1px solid #eee', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Monitor size={18} /> Monitoreo en Vivo
                            </h3>
                            {liveFrame ? (
                                <div style={{ border: '2px solid #000', borderRadius: '8px', overflow: 'hidden', background: '#000', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
                                    <img src={liveFrame} alt="Live Stream" style={{ width: '100%', display: 'block', maxHeight: '350px', objectFit: 'contain' }} />
                                    <div style={{ background: '#ff0000', color: '#fff', fontSize: '11px', padding: '4px 10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ width: '8px', height: '8px', background: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'blink 1s step-end infinite' }}></span>
                                        CONEXIÓN LIVE — OnBase Web
                                    </div>
                                </div>
                            ) : (
                                <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', border: '2px dashed #ccc', color: '#999', borderRadius: '8px' }}>
                                    <Monitor size={48} style={{ marginBottom: '12px', opacity: 0.4 }} />
                                    <p style={{ fontSize: '13px', textAlign: 'center', padding: '0 20px', fontWeight: '500' }}>{automationLoading ? 'Conectando a OnBase... espere' : 'Sin actividad de automatización'}</p>
                                    {automationLoading && <p style={{ fontSize: '11px', color: '#aaa', marginTop: '5px' }}>El video aparecerá cuando el robot abra OnBase</p>}
                                </div>
                            )}
                        </div>

                        <div className="card" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '12px', borderLeft: '4px solid #1976d2', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                            <h3 style={{ marginTop: 0, fontSize: '16px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>Flujo de Automatización</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                                {automationSteps.map((step, idx) => {
                                    let statusColor = '#e0e0e0';
                                    let icon = <Clock size={16} color="#999" />;
                                    let textColor = '#666';

                                    if (currentStepIndex > idx || currentStepIndex === automationSteps.length) {
                                        // Passed step
                                        statusColor = '#4caf50'; // Green
                                        icon = <CheckCircle size={16} color="#fff" />;
                                        textColor = '#333';
                                    } else if (currentStepIndex === idx) {
                                        // Current step
                                        if (automationError) {
                                            statusColor = '#f44336'; // Red
                                            icon = <AlertCircle size={16} color="#fff" />;
                                            textColor = '#f44336';
                                        } else {
                                            if (!automationLoading && idx === 0 && !automationError) {
                                                statusColor = '#e0e0e0';
                                            } else {
                                                statusColor = '#1976d2'; // Blue
                                                icon = <RefreshCw size={16} className="spin" color="#fff" />;
                                                textColor = '#1976d2';
                                            }
                                        }
                                    }

                                    return (
                                        <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
                                            {idx < automationSteps.length - 1 && (
                                                <div style={{
                                                    position: 'absolute',
                                                    left: '14px',
                                                    top: '28px',
                                                    bottom: '-15px',
                                                    width: '2px',
                                                    backgroundColor: currentStepIndex > idx ? '#4caf50' : '#e0e0e0',
                                                    zIndex: 0
                                                }} />
                                            )}
                                            <div style={{
                                                width: '30px', height: '30px', borderRadius: '50%', backgroundColor: statusColor,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                transition: 'background-color 0.3s', zIndex: 1, boxShadow: currentStepIndex === idx ? '0 0 0 4px rgba(25, 118, 210, 0.2)' : 'none'
                                            }}>
                                                {icon}
                                            </div>
                                            <div style={{ fontWeight: currentStepIndex === idx ? 'bold' : 'normal', color: textColor, fontSize: '13px', lineHeight: '1.2' }}>
                                                {step.label}
                                                {currentStepIndex === idx && automationError && (
                                                    <div style={{ color: '#f44336', fontSize: '11px', marginTop: '2px', fontWeight: 'normal' }}>Error en este punto de la tarea</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="card" style={{ padding: '15px', backgroundColor: '#fff', borderRadius: '12px', borderLeft: '4px solid #2d3e50' }}>
                            <h3 style={{ marginTop: 0, fontSize: '16px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>Logs del Sistema</h3>
                            <div style={{ background: '#1e1e1e', color: '#0f0', padding: '10px', borderRadius: '4px', height: '350px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.4' }}>
                                {logs.length > 0 ? logs.map((log, i) => <div key={i} style={{ marginBottom: '4px' }}>&gt; {log}</div>) : <div style={{ color: '#555' }}>Esperando ejecución...</div>}
                                {automationLoading && <div className="blink">&gt; _</div>}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="mass-creation-container">
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                        <div style={{ flex: 1, background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                            <h2 style={{ color: '#2e7d32', marginTop: 0 }}>Módulo de Creación Masiva</h2>
                            <p style={{ color: '#666', fontSize: '14px' }}>Complete la plantilla de expedientes para el cargue AES.</p>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                <label className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <Database size={18} /> Cargar Excel
                                    <input type="file" accept=".xlsx, .xls" onChange={handleMassFileUpload} style={{ display: 'none' }} />
                                </label>
                                <button onClick={handleExportTemplate} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Download size={18} /> Descargar Plantilla
                                </button>
                                <button onClick={handleSaveToBackend} disabled={massCreationLoading || expedientes.length === 0} className="btn" style={{ background: '#2e7d32', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Save size={18} /> {massCreationLoading ? 'Guardando...' : 'Guardar en BD'}
                                </button>
                            </div>
                            {massCreationStatus && <div style={{ marginTop: '10px', padding: '10px', borderRadius: '6px', background: massCreationStatus.includes('Error') ? '#ffebee' : '#e8f5e9', color: massCreationStatus.includes('Error') ? '#c62828' : '#2e7d32' }}>{massCreationStatus}</div>}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '20px' }}>
                        {/* FORMULARIO */}
                        <div className="card" style={{ flex: '1', padding: '20px', backgroundColor: '#fff', borderRadius: '12px' }}>
                            <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Nuevo Expediente</h3>
                            <form onSubmit={handleMassSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '5px' }}>CÓDIGO EXPEDIENTE</label>
                                    <input type="text" id="expediente_code" value={formData.expediente_code} onChange={handleMassChange} placeholder="M-00XX" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '5px' }}>FECHA APERTURA</label>
                                        <input type="date" id="opening_date" value={formData.opening_date} onChange={handleMassChange} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '5px' }}>SUBSERIE</label>
                                        <input type="text" id="subserie" list="sub-list" value={formData.subserie} onChange={handleMassChange} placeholder="100.1" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                        <datalist id="sub-list">
                                            {allSubseries.map(s => <option key={s.id} value={s.subseries_code}>{s.subseries_name}</option>)}
                                        </datalist>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '5px' }}>TÍTULO EXPEDIENTE</label>
                                    <input type="text" id="title" value={formData.title} onChange={handleMassChange} placeholder="Nombre descriptivo" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                        <div key={i}>
                                            <label style={{ display: 'block', fontSize: '10px', color: '#888' }}>{currentLabels[`meta_${i}`] || `Valor ${i}`}</label>
                                            <input type="text" id={`valor${i}`} value={formData[`valor${i}`]} onChange={handleMassChange} style={{ width: '100%', padding: '6px', border: '1px solid #eee', borderRadius: '4px', fontSize: '11px' }} />
                                        </div>
                                    ))}
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ marginTop: '10px', background: '#2e7d32' }}>Agregar a la Lista</button>
                            </form>
                        </div>

                        {/* TABLA DE REGISTROS */}
                        <div className="card" style={{ flex: '2', padding: '20px', backgroundColor: '#fff', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3 style={{ margin: 0 }}>Registros para Cargar ({expedientes.length})</h3>
                                <button onClick={() => setExpedientes([])} style={{ fontSize: '11px', color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>Vaciar Todo</button>
                            </div>
                            <div style={{ overflowX: 'auto', flexGrow: 1, maxHeight: '400px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f9f9f9', textAlign: 'left' }}>
                                            <th style={{ padding: '8px' }}>Código</th>
                                            <th style={{ padding: '8px' }}>Título</th>
                                            <th style={{ padding: '8px' }}>Subserie</th>
                                            <th style={{ padding: '8px' }}>Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {expedientes.length > 0 ? expedientes.map((exp, idx) => (
                                            <tr key={idx} style={{ borderTop: '1px solid #eee' }}>
                                                <td style={{ padding: '8px' }}>{exp.expediente_code}</td>
                                                <td style={{ padding: '8px' }}>{exp.title}</td>
                                                <td style={{ padding: '8px' }}>{exp.subserie}</td>
                                                <td style={{ padding: '8px' }}>
                                                    <button onClick={() => handleMassDelete(idx)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}><Trash size={14} /></button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Lista vacía. Cargue un Excel o use el formulario.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CONFIGURACIÓN AES */}
            {configDoc && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="modal-content" style={{ background: '#white', borderRadius: '12px', width: '100%', maxWidth: '500px', backgroundColor: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ background: editingModal ? '#e65100' : '#1976d2', color: '#fff', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <SettingsIcon size={20} />
                                {editingModal ? '✏️ Editando Documento' : 'Formulario de Configuración AES'}
                            </h3>
                            <button onClick={() => { setConfigDoc(null); setEditingModal(false); setModalEditFields({}); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>

                            {/* Código Expediente - siempre editable */}
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '5px' }}>CÓDIGO EXPEDIENTE</label>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <input
                                        type="text"
                                        value={editingCode[configDoc.id] || ''}
                                        onChange={(e) => updateExpedienteCode(configDoc.id, e.target.value)}
                                        style={{ flex: 1, padding: '10px', border: '2px solid #39a900', borderRadius: '6px', fontWeight: 'bold', color: '#1b5e20' }}
                                        placeholder="2025EX-XXXXXX"
                                    />
                                    <button
                                        onClick={() => saveExpedienteCode(configDoc.id)}
                                        className="btn-save"
                                        title="Guardar código"
                                        style={{ padding: '10px', background: '#39a900', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <Save size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '5px' }}>GRUPO DOCUMENTAL</label>
                                <input type="text" value="TRD" readOnly style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', backgroundColor: '#f9f9f9' }} />
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '5px' }}>TIPO DOCUMENTAL</label>
                                <input
                                    type="text"
                                    value={editingModal ? (modalEditFields.typology_name ?? configDoc.typology_name ?? '') : (configDoc.typology_name || '')}
                                    readOnly={!editingModal}
                                    onChange={(e) => setModalEditFields(f => ({ ...f, typology_name: e.target.value }))}
                                    style={{ width: '100%', padding: '10px', border: editingModal ? '2px solid #e65100' : '1px solid #ddd', borderRadius: '6px', backgroundColor: editingModal ? '#fff3e0' : '#f9f9f9' }}
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '5px' }}>ORIGEN</label>
                                <input type="text" value="ELECTRONICO" readOnly style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', backgroundColor: '#e8f5e9', fontWeight: 'bold', color: '#2e7d32' }} />
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '5px' }}>NOMBRE DEL DOCUMENTO (Metadatos Concatenados)</label>
                                <textarea
                                    value={editingModal ? (modalEditFields.filename ?? configDoc.joinedName ?? '') : configDoc.joinedName}
                                    readOnly={!editingModal}
                                    onChange={(e) => setModalEditFields(f => ({ ...f, filename: e.target.value }))}
                                    rows={3}
                                    style={{ width: '100%', padding: '10px', border: editingModal ? '2px solid #e65100' : '1px solid #ddd', borderRadius: '6px', backgroundColor: editingModal ? '#fff3e0' : '#f9f9f9', fontFamily: 'inherit', fontSize: '13px', resize: 'vertical' }}
                                />
                            </div>

                            {/* Mostrar metadatos individuales */}
                            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => {
                                    const meta = { ...(configDoc.expediente_metadata || {}), ...(configDoc.document_metadata || {}) };
                                    const val = meta[`valor${i}`] || meta[`Metadato ${i}`] || '';
                                    if (!val && !editingModal) return null; // Ocultar si está vacío en modo lectura
                                    return (
                                        <div key={i}>
                                            <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#666', marginBottom: '4px', textTransform: 'uppercase' }}>VALOR {i}</label>
                                            <input
                                                type="text"
                                                value={editingModal ? (modalEditFields[`valor${i}`] ?? val) : val}
                                                readOnly={!editingModal}
                                                onChange={(e) => {
                                                    const newVal = e.target.value;
                                                    setModalEditFields(f => ({ ...f, [`valor${i}`]: newVal }));
                                                }}
                                                style={{ width: '100%', padding: '8px', border: editingModal ? '1px solid #e65100' : '1px solid #ddd', borderRadius: '6px', backgroundColor: editingModal ? '#fff' : '#f9f9f9', fontSize: '12px' }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '5px' }}>FECHA DE CREACIÓN DOCUMENTO</label>
                                <input
                                    type={editingModal ? 'date' : 'text'}
                                    value={editingModal
                                        ? (modalEditFields.document_date ?? (configDoc.document_date ? configDoc.document_date.split('T')[0] : ''))
                                        : new Date(configDoc.document_date).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(',', '')}
                                    readOnly={!editingModal}
                                    onChange={(e) => setModalEditFields(f => ({ ...f, document_date: e.target.value }))}
                                    style={{ width: '100%', padding: '10px', border: editingModal ? '2px solid #e65100' : '1px solid #ddd', borderRadius: '6px', backgroundColor: editingModal ? '#fff3e0' : '#f9f9f9' }}
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '5px' }}>IMPORTAR (Ruta OneDrive)</label>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <input
                                        type="text"
                                        value={editingModal ? (modalEditFields.path ?? configDoc.path ?? '') : (configDoc.path ? configDoc.path.substring(0, Math.max(configDoc.path.lastIndexOf('\\'), configDoc.path.lastIndexOf('/')) + 1) : '')}
                                        readOnly={!editingModal}
                                        onChange={(e) => setModalEditFields(f => ({ ...f, path: e.target.value }))}
                                        style={{ flex: 1, padding: '10px', border: editingModal ? '2px solid #e65100' : '1px solid #ddd', borderRadius: '6px', backgroundColor: editingModal ? '#fff3e0' : '#f9f9f9', fontSize: '11px' }}
                                    />
                                    {!editingModal && (
                                        <a href={`file://${configDoc.path ? configDoc.path.substring(0, Math.max(configDoc.path.lastIndexOf('\\'), configDoc.path.lastIndexOf('/')) + 1) : ''}`} target="_blank" rel="noreferrer" style={{ padding: '10px', background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: '6px', color: '#2e7d32', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                                            <Globe size={16} />
                                        </a>
                                    )}
                                </div>
                            </div>

                            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                                {editingModal ? (
                                    <>
                                        {/* Botón Guardar Cambios */}
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const authHeaders = { Authorization: `Bearer ${localStorage.getItem('token')}` };
                                                    await axios.put(`/api/documents/${configDoc.id}`, modalEditFields, { headers: authHeaders });
                                                    // Actualizar configDoc localmente
                                                    setConfigDoc(prev => ({ ...prev, ...modalEditFields, joinedName: modalEditFields.filename ?? prev.joinedName }));
                                                    setEditingModal(false);
                                                    setModalEditFields({});
                                                    fetchPending();
                                                    alert('✅ Datos actualizados correctamente.');
                                                } catch (err) {
                                                    alert('❌ Error al guardar: ' + (err.response?.data?.error || err.message));
                                                }
                                            }}
                                            style={{ width: '100%', padding: '12px', background: '#e65100', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                        >
                                            <Save size={18} /> Guardar Cambios
                                        </button>
                                        <button
                                            onClick={() => { setEditingModal(false); setModalEditFields({}); }}
                                            style={{ width: '100%', padding: '10px', background: '#f5f5f5', color: '#666', border: '1px solid #ddd', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                                        >
                                            Cancelar Edición
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        {/* Botón Editar Datos */}
                                        <button
                                            onClick={() => {
                                                setEditingModal(true);
                                                setModalEditFields({
                                                    typology_name: configDoc.typology_name || '',
                                                    filename: configDoc.joinedName || '',
                                                    document_date: configDoc.document_date ? configDoc.document_date.split('T')[0] : '',
                                                    path: configDoc.path || ''
                                                });
                                            }}
                                            style={{ width: '100%', padding: '10px', background: '#fff3e0', color: '#e65100', border: '2px solid #e65100', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                        >
                                            ✏️ Editar Datos del Documento
                                        </button>

                                        {/* Botón Iniciar Cargue */}
                                        <button
                                            onClick={() => handleRunAutomation(configDoc.id)}
                                            disabled={automationLoading}
                                            style={{ width: '100%', padding: '12px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                        >
                                            {automationLoading ? 'Procesando...' : <><Play size={18} /> Iniciar Cargue de este Documento</>}
                                        </button>

                                        <button
                                            onClick={() => setConfigDoc(null)}
                                            style={{ width: '100%', padding: '10px', background: '#f5f5f5', color: '#666', border: '1px solid #ddd', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                                        >
                                            Cerrar y Regresar
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .blink { animation: blink 1s step-end infinite; }
                @keyframes blink { 50% { opacity: 0; } }
                .btn-config:hover { background-color: #bbdefb !important; }
            `}</style>
        </div>
    );
}

export default CargueAes;
