import { useState, useEffect, Fragment } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { Play, CheckCircle, Clock, AlertCircle, FileText, Search, RefreshCw, Monitor, X, Globe, Settings as SettingsIcon, Save, Download, Trash, Database, Eye, ChevronDown, ChevronRight, Maximize2 } from 'lucide-react';

function CargueAes() {
    const currentUser = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
    const isAuthorized = currentUser.role === 'admin' || currentUser.role === 'superadmin';

    const [activeTab, setActiveTab] = useState('cargue'); // 'cargue' or 'creacion'
    const [expandedExpedientes, setExpandedExpedientes] = useState([]);

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
    const [isMonitorExpanded, setIsMonitorExpanded] = useState(false);
    const [manualText, setManualText] = useState('');
    const [isInteracting, setIsInteracting] = useState(false);

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
    const [autoLote, setAutoLote] = useState(true); // Nuevo estado para auto-lote

    // Preview modal states
    const [previewData, setPreviewData] = useState([]);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewLabels, setPreviewLabels] = useState({});
    
    // Asignación de Responsables State
    const [activeUsers, setActiveUsers] = useState([]);
    const [selectedResponsibles, setSelectedResponsibles] = useState([]);
    const [userSearchText, setUserSearchText] = useState('');
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [individualResponsible, setIndividualResponsible] = useState(null);
    const [individualSearchText, setIndividualSearchText] = useState('');
    const [showIndividualDropdown, setShowIndividualDropdown] = useState(false);
    
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
            const res = await axios.get(`/api/ades/pending?status=${activeFilter}`);
            const data = res.data || [];
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

    useEffect(() => {
        const fetchActiveUsers = async () => {
            try {
                const res = await axios.get('/api/users/active');
                const users = res.data.data || [];
                setActiveUsers(users);
                const defaultResp = users.find(u => u.full_name.toLowerCase().includes('luis ernesto parada moreno'));
                if (defaultResp) {
                    setIndividualResponsible(defaultResp);
                    setIndividualSearchText(defaultResp.full_name);
                    setSelectedResponsibles([defaultResp]);
                }
            } catch (err) {
                console.error("Error fetching active users:", err);
            }
        };
        fetchActiveUsers();
    }, []);


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

        // Fetch latest settings once before batch
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

        const docIdsToProcess = docsToProcess.map(d => d.id);

        setLogs([
            `=== Procesando Lote de ${docsToProcess.length} documento(s) ===`,
            'Iniciando proceso de cargue AES en sesión única de OnBase...',
            'Conectando con OnBase...'
        ]);
        setLiveFrame(null);
        setCurrentStepIndex(0);
        setAutomationError(false);

        // START LIVE STREAM
        const eventSource = new EventSource(`/api/automation/stream?token=${encodeURIComponent(token || '')}`);
        eventSource.onmessage = (event) => {
            setLiveFrame(`data:image/jpeg;base64,${event.data}`);
        };
        eventSource.onerror = () => {
            eventSource.close();
        };

        try {
            const res = await axios.post('/api/automation/execute', {
                url: settings.ades_url,
                username: settings.ades_username,
                password: settings.ades_password,
                documentIds: docIdsToProcess
            }, { headers: authHeaders });

            setLogs(prev => [...prev, ...(res.data.logs || []), 'Proceso de cargue de lote completado.']);
            setCurrentStepIndex(automationSteps.length);
            await fetchPending();
            setSelectedDocs([]);
        } catch (err) {
            console.error("Automation error:", err);
            if (err.response && err.response.data && err.response.data.logs) {
                setLogs(prev => [...prev, ...err.response.data.logs]);
            }
            const errMsg = err.response?.data?.error || err.message || 'El proceso falló. Revise la conexión con OnBase.';
            setLogs(prev => [...prev, `Error: ${errMsg}`]);
            setAutomationError(true);
        } finally {
            eventSource.close();
            setAutomationLoading(false);
        }
    };
    const filteredDocs = documents.filter(doc => {
        // Status filter: Bypass client-side filtering as the backend handles the correct
        // documents for each status tab ('Pendiente', 'Cargado', or 'Todos').
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
        let joinedName = [1, 2, 3, 4, 5, 6, 7, 8]
            .map(i => meta[`valor${i}`] || meta[`Metadato ${i}`])
            .filter(v => v)
            .join(' ');

        // Append description/text if it exists
        const docDesc = doc.document_metadata?.description;
        if (docDesc) {
            joinedName = `${joinedName} ${docDesc}`;
        }

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

    const [clickPoint, setClickPoint] = useState(null);

    const handleImageClick = async (e) => {
        if (!liveFrame || isInteracting) return;
        setIsInteracting(true);
        const target = e.currentTarget;
        const rect = target.getBoundingClientRect();

        const clickX = e.nativeEvent ? e.nativeEvent.offsetX : (e.clientX - rect.left);
        const clickY = e.nativeEvent ? e.nativeEvent.offsetY : (e.clientY - rect.top);

        setClickPoint({ x: clickX, y: clickY });
        setTimeout(() => setClickPoint(null), 700);

        const naturalWidth = target.naturalWidth || 1366;
        const naturalHeight = target.naturalHeight || 900;

        const imageRatio = naturalWidth / naturalHeight;
        const elementRatio = rect.width / rect.height;

        let renderedWidth = rect.width;
        let renderedHeight = rect.height;
        let leftOffset = 0;
        let topOffset = 0;

        if (imageRatio > elementRatio) {
            renderedHeight = rect.width / imageRatio;
            topOffset = (rect.height - renderedHeight) / 2;
        } else {
            renderedWidth = rect.height * imageRatio;
            leftOffset = (rect.width - renderedWidth) / 2;
        }

        const relativeX = clickX - leftOffset;
        const relativeY = clickY - topOffset;

        if (relativeX >= 0 && relativeX <= renderedWidth && relativeY >= 0 && relativeY <= renderedHeight) {
            const x = Math.round((relativeX / renderedWidth) * 1366);
            const y = Math.round((relativeY / renderedHeight) * 900);

            console.log(`[CLICK-SENT] Display (${clickX.toFixed(0)}, ${clickY.toFixed(0)}) -> OnBase Viewport (${x}, ${y})`);

            try {
                const token = localStorage.getItem('token');
                await axios.post('/api/automation/click', { x, y, button: e.button === 2 ? 'right' : 'left' }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } catch (err) {
                console.error('Manual click failed:', err);
                alert('No se pudo enviar el clic: ' + (err.response?.data?.error || err.message));
            }
        }
        setIsInteracting(false);
    };

    const sendManualText = async () => {
        if (!manualText || isInteracting) return;
        setIsInteracting(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/automation/type', { text: manualText }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setManualText('');
        } catch (err) {
            alert('Error al escribir: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsInteracting(false);
        }
    };

    const sendManualKey = async (key) => {
        if (isInteracting) return;
        setIsInteracting(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/automation/press-key', { key }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            alert('Error al enviar tecla: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsInteracting(false);
        }
    };

    const killAutomation = async () => {
        if (!window.confirm('¿Seguro que deseas forzar el cierre de la automatización activa?')) return;
        setIsInteracting(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/automation/kill', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsMonitorExpanded(false);
            alert('Automatización finalizada por el usuario.');
        } catch (err) {
            alert('Error al detener: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsInteracting(false);
        }
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
        
        let val1 = formData.valor1 || '';
        let val3 = formData.valor3 || '';
        const v1Clean = val1.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const v3Clean = val3.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        if (v1Clean === 'tecnico' && v3Clean.startsWith('tecnologo')) {
            val1 = 'TECNÓLOGO';
            setFormData(prev => ({ ...prev, valor1: 'TECNÓLOGO' }));
        }

        const metadata = {
            valor1: val1, valor2: formData.valor2,
            valor3: formData.valor3, valor4: formData.valor4,
            valor5: formData.valor5, valor6: formData.valor6,
            valor7: formData.valor7, valor8: formData.valor8
        };
        const newExpediente = {
            ...formData,
            metadata_values: metadata,
            assigned_user_id: individualResponsible ? individualResponsible.id : null,
            assigned_user_name: individualResponsible ? individualResponsible.full_name : '',
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
        setIndividualResponsible(null);
        setIndividualSearchText('');
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
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/expedientes/mass', {
                expedientes,
                assigned_user_ids: selectedResponsibles.map(u => u.id)
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            const { message, errors, created_ids } = res.data;
            
            if (errors && errors.length > 0) {
                const errDetail = errors.slice(0, 3).map(e => `• ${e.expediente}: ${e.error}`).join('\n');
                const moreMsg = errors.length > 3 ? `\n...y ${errors.length - 3} más.` : '';
                setMassCreationStatus(`⚠️ ${message}`);
                alert(`${message}\n\nErrores detectados:\n${errDetail}${moreMsg}`);
            } else {
                setMassCreationStatus('¡Guardado exitoso en base de datos!');
                setExpedientes([]);
                setSelectedResponsibles([]);
                
                // Si el autoLote está activado y se crearon expedientes
                if (autoLote && created_ids && created_ids.length > 0) {
                    try {
                        const nombreLote = `Lote Excel (AES) - ${new Date().toLocaleString('es-CO')}`;
                        let userId = 1;
                        try {
                           const payload = JSON.parse(atob(token.split('.')[1]));
                           userId = payload.id;
                        } catch(e) {}

                        await axios.post('/api/seguimiento/paquetes', {
                            nombre: nombreLote,
                            descripcion: 'Lote creado automáticamente desde Cargue AES',
                            user_id: userId,
                            expediente_ids: created_ids
                        }, { headers: { Authorization: `Bearer ${token}` } });
                        
                        alert(`✅ ¡Guardado exitoso!\nSe creó automáticamente el paquete de seguimiento "${nombreLote}".`);
                    } catch (loteErr) {
                        console.error('Error creando lote automático:', loteErr);
                        alert(`Los expedientes se guardaron, pero hubo un error al crear el lote de seguimiento: ${loteErr.response?.data?.error || loteErr.message}`);
                    }
                } else if (created_ids && created_ids.length > 0) {
                    alert('✅ ¡Guardado exitoso en base de datos!');
                }
            }
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
        return str.toString()
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
            .replace(/[\s\-_]/g, '') // Remove spaces, dashes, underscores
            .trim();
    };

    const parseDate = (val) => {
        if (!val) return '';
        if (typeof val === 'number') {
            // Excel serial date to YYYY-MM-DD
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            return date.toISOString().split('T')[0];
        }
        return String(val).trim();
    };

    const autoSaveLabels = async (subseriesCode, labels) => {
        try {
            const resSub = await axios.get(`/api/trd/subseries/all`);
            const sub = (resSub.data.data || []).find(s => s.subseries_code === subseriesCode);
            if (!sub) return;

            await axios.post('/api/trd/metadata-labels', {
                type: sub.type || 'subseries',
                id: sub.id,
                labels: labels
            });
        } catch (err) {
            console.error("Error auto-saving labels:", err);
        }
    };

    const getRowWarnings = (exp) => {
        const w = [];
        if (!exp.subserie) w.push('Sin código TRD');
        if (!exp.title || exp.title.trim() === '' || exp.title === 'Sin Título') w.push('⚠️ Sin título — la carpeta se creará mal');
        if (!exp.opening_date) w.push('Sin fecha');
        return w;
    };

    const hasCriticalWarnings = (exp) => {
        return !exp.title || exp.title.trim() === '' || exp.title === 'Sin Título';
    };

    const updatePreviewRow = (idx, field, value) => {
        setPreviewData(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
    };

    // Valida si un código TRD existe en el catálogo del sistema
    const validTRDCodes = new Set(
        allSubseries.flatMap(s => [
            s.subseries_code, s.concatenated_code, s.series_code
        ].filter(Boolean)).map(c => String(c).trim())
    );
    const isValidTRD = (code) => !!code && validTRDCodes.has(String(code).trim());

    const handleConfirmPreview = async () => {
        setExpedientes(prev => [...prev, ...previewData]);
        if (Object.keys(previewLabels).length > 0) {
            setCurrentLabels(previewLabels);
            const uniqueSubseries = [...new Set(previewData.map(e => e.subserie).filter(Boolean))];
            for (const subserieCod of uniqueSubseries) {
                await autoSaveLabels(subserieCod, previewLabels);
            }
            try {
                const res = await axios.get('/api/trd/subseries/all');
                setAllSubseries(res.data.data || []);
            } catch (e) { console.error(e); }
        }
        setShowPreviewModal(false);
        setPreviewData([]);
        setPreviewLabels({});
    };

    const handleMassFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        console.log("Iniciando carga de archivo:", file.name);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = evt.target.result;
                const wb = XLSX.read(data, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                // ── Detección automática de fila de encabezados ──────────────
                const range = XLSX.utils.decode_range(ws['!ref']);
                const knownColSynonyms = [
                    'Codigo Expediente','Cod Exp','Nro Expediente','Expediente',
                    'Id Caja','Caja','Caja No',
                    'Fecha Apertura','Fecha Inicio','Apertura','Fecha',
                    'Subserie','Cod Subserie','Codigo Subserie',
                    'Tipo Almacenamiento','Tipo Almacen','Soporte',
                    'Titulo','Nombre Expediente','Asunto','Descripcion',
                    'Valor 1','Valor 2','Valor 3','Valor 4','Metadato 1','Meta 1',
                ];
                const normalizedKnown = knownColSynonyms.map(normalizeText);

                let bestHeaderRow = range.s.r;
                let bestScore = 0;
                const scanLimit = Math.min(range.s.r + 14, range.e.r);
                for (let R = range.s.r; R <= scanLimit; ++R) {
                    let score = 0;
                    for (let C = range.s.c; C <= range.e.c; ++C) {
                        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
                        if (cell && cell.v) {
                            if (normalizedKnown.includes(normalizeText(String(cell.v)))) score++;
                        }
                    }
                    if (score > bestScore) { bestScore = score; bestHeaderRow = R; }
                }
                console.log(`[EXCEL] Encabezados en fila ${bestHeaderRow + 1} (score: ${bestScore})`);

                // Recortar el sheet desde la fila de encabezados detectada
                const wsClipped = {};
                for (const addr in ws) {
                    if (addr.startsWith('!')) continue;
                    const cc = XLSX.utils.decode_cell(addr);
                    if (cc.r >= bestHeaderRow) wsClipped[addr] = ws[addr];
                }
                wsClipped['!ref'] = XLSX.utils.encode_range({ s: { r: bestHeaderRow, c: range.s.c }, e: range.e });

                const jsonData = XLSX.utils.sheet_to_json(wsClipped, { defVal: '' });
                console.log(`[EXCEL] Registros extraídos: ${jsonData.length}`);

                if (jsonData.length === 0) {
                    alert("El archivo está vacío o no tiene datos legibles.");
                    return;
                }

                // Leer encabezados de la fila detectada
                const firstRow = [];
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cell = ws[XLSX.utils.encode_cell({ r: bestHeaderRow, c: C })];
                    if (cell && cell.v) firstRow.push(String(cell.v));
                }
                const allHeaders = firstRow.length > 0 ? firstRow : Object.keys(jsonData[0] || {});
                console.log("Cabeceras reales detectadas:", allHeaders);
                const normalizedHeaders = allHeaders.map(h => ({ original: h, normalized: normalizeText(h) }));

                // --- MAPPING LOGIC ---
                const findHeader = (synonyms) => {
                    const found = normalizedHeaders.find(h => synonyms.some(s => h.normalized === normalizeText(s)));
                    return found ? found.original : null;
                };

                const colMap = {
                    expediente_code: findHeader([
                        'Codigo Expediente', 'Cod Exp', 'Nro Expediente', 'Expediente',
                        'Numero Expediente', 'No Expediente', 'No. Expediente',
                        'ID Expediente', 'Codigo', 'Cod', 'No', 'Numero', 'N'
                    ]),
                    box_id: findHeader(['Id Caja', 'Caja', 'Caja No', 'No Caja', 'Numero Caja', 'Box']),
                    opening_date: findHeader([
                        'Fecha Apertura', 'Fecha Inicio', 'Apertura', 'Fecha',
                        'Fecha Ingreso', 'Fecha Creacion', 'Fecha Matricula', 'Fecha de Inicio',
                        'Fecha de Grado', 'Fecha Grado', 'Ano', 'Year', 'Vigencia'
                    ]),
                    subserie: findHeader([
                        'Subserie', 'Cod Subserie', 'Codigo Subserie',
                        'Codigo Serie Subserie', 'Cod Serie Subserie', 'Serie Subserie',
                        'TRD', 'Cod TRD', 'Codigo TRD', 'Codigo de la Serie',
                        'Cod Serie', 'Codigo Serie', 'Serie', 'Clasificacion TRD',
                        'Clasificacion', 'Tabla Retencion', 'Tabla de Retencion',
                        'Tipo Expediente', 'Tipo de Expediente'
                    ]),
                    storage_type: findHeader([
                        'Tipo Almacenamiento', 'Tipo Almacen', 'Soporte', 'Medio',
                        'Tipo Soporte', 'Formato', 'Tipo'
                    ]),
                    title: findHeader([
                        'Titulo', 'Nombre Expediente', 'Asunto', 'Descripcion',
                        'Nombre', 'Nombres', 'Nombre Completo', 'Nombre del Estudiante',
                        'Aprendiz', 'Nombre Aprendiz', 'Beneficiario',
                        'Nombre del Trabajador', 'Trabajador', 'Funcionario',
                        'Contratista', 'Nombre Contratista', 'Denominacion'
                    ]),
                    responsable: findHeader(['Responsable', 'Asignado a', 'AsignadoA', 'Responsables', 'Asignado'])
                };

                // Detect metadata headers (Valor 1 - 8)
                const metadataCols = Array(8).fill(null);
                for (let i = 1; i <= 8; i++) {
                    const h = findHeader([`Valor ${i}`, `Valor${i}`, `Metadato ${i}`, `Metadato${i}`, `Meta ${i}`, `Meta${i}`]);
                    if (h) metadataCols[i - 1] = h;
                }

                // If some slots are still empty, use headers that are NOT standard
                const standardOriginals = Object.values(colMap).filter(Boolean);
                const metadataOriginals = metadataCols.filter(Boolean);
                const unmappedHeaders = allHeaders.filter(h => !standardOriginals.includes(h) && !metadataOriginals.includes(h));

                unmappedHeaders.forEach(h => {
                    for (let i = 0; i < 8; i++) {
                        if (!metadataCols[i]) {
                            metadataCols[i] = h;
                            break;
                        }
                    }
                });

                const newExpedientes = jsonData.map((row, index) => {
                    const metadata = {};
                    for (let i = 1; i <= 8; i++) {
                        const colName = metadataCols[i - 1];
                        let val = '';
                        if (colName && row[colName] !== undefined) {
                            val = String(row[colName]);
                        } else {
                            const altH = findHeader([`valor${i}`, `valor ${i}`, `valor_${i}`]);
                            if (altH && row[altH] !== undefined) val = String(row[altH]);
                        }
                        metadata[`valor${i}`] = val.trim();
                    }

                    // Auto-correction rule Técnico -> Tecnólogo
                    const v1 = metadata.valor1 || '';
                    const v3 = metadata.valor3 || '';
                    const v1Clean = v1.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                    const v3Clean = v3.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                    if (v1Clean === 'tecnico' && v3Clean.startsWith('tecnologo')) {
                        metadata.valor1 = 'TECNÓLOGO';
                    }

                    let assigned_user_id = null;
                    let assigned_user_name = '';
                    if (colMap.responsable && row[colMap.responsable]) {
                        const respVal = normalizeText(String(row[colMap.responsable]));
                        const foundUser = activeUsers.find(u => 
                            normalizeText(u.full_name) === respVal || 
                            normalizeText(u.email) === respVal || 
                            normalizeText(u.document_no) === respVal
                        );
                        if (foundUser) {
                            assigned_user_id = foundUser.id;
                            assigned_user_name = foundUser.full_name;
                        }
                    }

                    return {
                        id: Date.now() + index + Math.random(),
                        expediente_code: colMap.expediente_code ? String(row[colMap.expediente_code] || '').trim() : '',
                        box_id: colMap.box_id ? String(row[colMap.box_id] || '').trim() : '',
                        opening_date: parseDate(colMap.opening_date ? row[colMap.opening_date] : ''),
                        subserie: colMap.subserie ? String(row[colMap.subserie] || '').trim() : '',
                        storage_type: colMap.storage_type ? String(row[colMap.storage_type] || '').trim() : 'Fisico',
                        title: colMap.title ? String(row[colMap.title] || '').trim() : '',
                        metadata_values: metadata,
                        assigned_user_id,
                        assigned_user_name
                    };
                });

                if (newExpedientes.length > 0) {
                    const labelsMap = {};
                    metadataCols.forEach((h, i) => {
                        if (h && i < 8) labelsMap[`meta_${i + 1}`] = h;
                    });
                    setPreviewLabels(labelsMap);
                    setPreviewData(newExpedientes);
                    setShowPreviewModal(true);
                } else {
                    alert("No se pudieron extraer registros válidos del archivo.");
                }

            } catch (err) {
                console.error("Error leyendo el archivo:", err);
                alert("Error crítico al leer el archivo Excel.");
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = null;
    };

    if (!isAuthorized) {
        return (
            <div style={{ padding: '40px', maxWidth: '600px', margin: '80px auto', textAlign: 'center', background: '#fff', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #ffebee' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#ffebee', color: '#c62828', marginBottom: '24px' }}>
                    <AlertCircle size={40} />
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#b71c1c', margin: '0 0 12px 0' }}>Acceso Restringido</h1>
                <p style={{ fontSize: '15px', color: '#555', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                    Esta sección y la ejecución del <strong>Cargue AES (OnBase)</strong> están reservadas exclusivamente para Administradores y Superusuarios del sistema.
                </p>
                <div style={{ fontSize: '13px', color: '#888', borderTop: '1px solid #eee', paddingTop: '16px' }}>
                    Si considera que esto es un error, por favor comuníquese con el Administrador de TI.
                </div>
            </div>
        );
    }

    const toggleExpediente = (expId) => {
        setExpandedExpedientes(prev =>
            prev.includes(expId) ? prev.filter(id => id !== expId) : [...prev, expId]
        );
    };

    const handleSelectExpediente = (exp, checked) => {
        const pendingDocIds = exp.documents.filter(d => d.status === 'Pendiente').map(d => d.id);
        if (checked) {
            setSelectedDocs(prev => [...new Set([...prev, ...pendingDocIds])]);
        } else {
            setSelectedDocs(prev => prev.filter(id => !pendingDocIds.includes(id)));
        }
    };

    // Group filteredDocs by expediente
    const groupedExpedientes = [];
    const expGroupMap = {};

    filteredDocs.forEach(doc => {
        const expId = doc.expediente_id || 999999;
        if (!expGroupMap[expId]) {
            expGroupMap[expId] = {
                expediente_id: doc.expediente_id,
                expediente_code: doc.expediente_code || '',
                title: doc.title || 'Expediente Sin Título',
                subserie: doc.subserie || '',
                box_id: doc.box_id || '',
                storage_type: doc.storage_type || '',
                opening_date: doc.opening_date || '',
                expediente_metadata: doc.expediente_metadata || {},
                has_first_three_typologies: doc.has_first_three_typologies ?? true,
                documents: []
            };
            groupedExpedientes.push(expGroupMap[expId]);
        }
        expGroupMap[expId].documents.push(doc);
    });

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
                                        <tr style={{ backgroundColor: '#e8f5e9', textAlign: 'left', borderBottom: '2px solid #2e7d32' }}>
                                            <th style={{ padding: '12px', width: '70px', textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    onChange={(e) => {
                                                        const pendingIds = filteredDocs.filter(d => d.status === 'Pendiente').map(d => d.id);
                                                        if (e.target.checked) setSelectedDocs(pendingIds);
                                                        else setSelectedDocs([]);
                                                    }}
                                                    checked={filteredDocs.filter(d => d.status === 'Pendiente').length > 0 && selectedDocs.length === filteredDocs.filter(d => d.status === 'Pendiente').length}
                                                    style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                                                />
                                            </th>
                                            <th style={{ padding: '12px', width: '140px' }}>Código Expediente</th>
                                            <th style={{ padding: '12px' }}>Detalle de Expediente</th>
                                            <th style={{ padding: '12px', width: '150px' }}>Cant. Documentos</th>
                                            <th style={{ padding: '12px', width: '150px' }}>Subserie TRD</th>
                                            <th style={{ padding: '12px', width: '220px', textAlign: 'center' }}>Seguimiento / Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupedExpedientes.length > 0 ? groupedExpedientes.map(exp => {
                                            const isExpanded = expandedExpedientes.includes(exp.expediente_id);
                                            const firstDoc = exp.documents[0];
                                            const firstDocId = firstDoc?.id;
                                            const pendingDocs = exp.documents.filter(d => d.status === 'Pendiente');
                                            const isAllSelected = pendingDocs.length > 0 && pendingDocs.every(d => selectedDocs.includes(d.id));
                                            const isSomeSelected = !isAllSelected && pendingDocs.some(d => selectedDocs.includes(d.id));

                                            return (
                                                <Fragment key={exp.expediente_id || Math.random()}>
                                                    {/* Parent Row */}
                                                    <tr style={{ 
                                                        borderTop: '1px solid #c8e6c9', 
                                                        backgroundColor: isAllSelected ? '#f1f8e9' : isExpanded ? '#f9fbe7' : 'transparent',
                                                        transition: 'background-color 0.2s'
                                                    }}>
                                                        <td style={{ padding: '12px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isAllSelected}
                                                                disabled={pendingDocs.length === 0}
                                                                ref={el => {
                                                                    if (el) el.indeterminate = isSomeSelected;
                                                                }}
                                                                onChange={(e) => handleSelectExpediente(exp, e.target.checked)}
                                                                style={{ transform: 'scale(1.2)', cursor: pendingDocs.length === 0 ? 'not-allowed' : 'pointer' }}
                                                            />
                                                            <button
                                                                onClick={() => toggleExpediente(exp.expediente_id)}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', color: '#2e7d32' }}
                                                                title={isExpanded ? "Contraer" : "Expandir"}
                                                            >
                                                                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                            </button>
                                                        </td>
                                                        <td style={{ padding: '12px' }}>
                                                            {firstDocId ? (
                                                                <input
                                                                    type="text"
                                                                    value={editingCode[firstDocId] || ''}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setEditingCode(prev => ({ ...prev, [firstDocId]: val }));
                                                                    }}
                                                                    onBlur={() => saveExpedienteCode(firstDocId)}
                                                                    style={{ width: '110px', padding: '6px', border: '2px solid #39a900', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', color: '#1b5e20', outline: 'none' }}
                                                                    placeholder="Código"
                                                                />
                                                            ) : '-'}
                                                        </td>
                                                        <td style={{ padding: '12px' }}>
                                                            <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#1b5e20', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                                <span>{exp.title}</span>
                                                                {!exp.has_first_three_typologies && (
                                                                    <span style={{
                                                                        padding: '2px 8px',
                                                                        borderRadius: '12px',
                                                                        fontSize: '11px',
                                                                        backgroundColor: '#ffebee',
                                                                        color: '#c62828',
                                                                        border: '1px solid #ffcdd2',
                                                                        fontWeight: 'bold',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px'
                                                                    }}>
                                                                        <AlertCircle size={12} /> Falta 3 primeras tipologías (Seguimiento)
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                                                                ID Caja: {exp.box_id || '-'} | Almacenamiento: {exp.storage_type || '-'} | Apertura: {exp.opening_date ? new Date(exp.opening_date).toLocaleDateString() : '-'}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#555' }}>
                                                            <span style={{ 
                                                                padding: '4px 10px', 
                                                                borderRadius: '12px', 
                                                                backgroundColor: '#e0f2f1', 
                                                                color: '#00695c',
                                                                fontSize: '12px' 
                                                            }}>
                                                                {exp.documents.length} documento(s)
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '12px', color: '#333', fontSize: '12px' }}>
                                                            {exp.subserie || '-'}
                                                        </td>
                                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                                <span style={{
                                                                    padding: '4px 10px',
                                                                    borderRadius: '10px',
                                                                    fontSize: '11px',
                                                                    fontWeight: 'bold',
                                                                    backgroundColor: pendingDocs.length === 0 ? '#e8f5e9' : '#fff3e0',
                                                                    color: pendingDocs.length === 0 ? '#2e7d32' : '#ef6c00',
                                                                    border: `1px solid ${pendingDocs.length === 0 ? '#c8e6c9' : '#ffe0b2'}`
                                                                }}>
                                                                    {pendingDocs.length === 0 ? 'Completado' : `${pendingDocs.length} pendiente(s)`}
                                                                </span>
                                                                <button
                                                                    onClick={() => toggleExpediente(exp.expediente_id)}
                                                                    style={{ 
                                                                        padding: '6px 12px', 
                                                                        background: '#f5f5f5', 
                                                                        border: '1px solid #ccc', 
                                                                        borderRadius: '6px', 
                                                                        cursor: 'pointer', 
                                                                        fontSize: '12px', 
                                                                        fontWeight: 'bold',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px'
                                                                    }}
                                                                >
                                                                    {isExpanded ? 'Ocultar' : 'Ver Documentos'}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {/* Child Row (Expanded Documents List) */}
                                                    {isExpanded && (
                                                        <tr style={{ backgroundColor: '#fafafa' }}>
                                                            <td colSpan="6" style={{ padding: '15px 15px 15px 50px', borderTop: '1px dashed #c8e6c9', borderBottom: '1px solid #e0e0e0' }}>
                                                                <div style={{ 
                                                                    backgroundColor: '#fff', 
                                                                    borderRadius: '8px', 
                                                                    border: '1px solid #e0e0e0', 
                                                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                                                                    overflow: 'hidden'
                                                                }}>
                                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                                                        <thead>
                                                                            <tr style={{ backgroundColor: '#f5f5f5', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>
                                                                                <th style={{ padding: '8px 12px', width: '40px', textAlign: 'center' }}></th>
                                                                                <th style={{ padding: '8px 12px' }}>Archivo Original</th>
                                                                                <th style={{ padding: '8px 12px' }}>Tipología</th>
                                                                                <th style={{ padding: '8px 12px', width: '110px' }}>Fecha</th>
                                                                                <th style={{ padding: '8px 12px', width: '110px' }}>Estado</th>
                                                                                <th style={{ padding: '8px 12px', width: '160px', textAlign: 'center' }}>Acciones</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {exp.documents.map(doc => (
                                                                                <tr key={doc.id} style={{ borderBottom: '1px solid #f0f0f0', backgroundColor: selectedDocs.includes(doc.id) ? '#f1f8e9' : 'transparent' }}>
                                                                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={selectedDocs.includes(doc.id)}
                                                                                            disabled={doc.status === 'Cargado'}
                                                                                            onChange={(e) => {
                                                                                                if (e.target.checked) setSelectedDocs(prev => [...prev, doc.id]);
                                                                                                else setSelectedDocs(prev => prev.filter(id => id !== doc.id));
                                                                                            }}
                                                                                            style={{ transform: 'scale(1.1)', cursor: doc.status === 'Cargado' ? 'not-allowed' : 'pointer' }}
                                                                                        />
                                                                                    </td>
                                                                                    <td style={{ padding: '8px 12px' }}>
                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
                                                                                            <FileText size={14} color="#1976d2" />
                                                                                            <span style={{ wordBreak: 'break-all' }}>{doc.filename}</span>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td style={{ padding: '8px 12px', color: '#555' }}>
                                                                                        {doc.typology_name}
                                                                                    </td>
                                                                                    <td style={{ padding: '8px 12px', color: '#666' }}>
                                                                                        {new Date(doc.document_date).toLocaleDateString()}
                                                                                    </td>
                                                                                    <td style={{ padding: '8px 12px' }}>
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
                                                                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                                                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                                                                            <button
                                                                                                onClick={() => handleView(doc)}
                                                                                                title="Visualizar Archivo"
                                                                                                style={{ padding: '5px', background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: '4px', color: '#2e7d32', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                                                            >
                                                                                                <Eye size={13} />
                                                                                            </button>
                                                                                            {doc.status === 'Cargado' ? (
                                                                                                <>
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
                                                                                                                alert(`✅ Documento "${doc.typology_name}" revertido a Pendiente.`);
                                                                                                                fetchPending();
                                                                                                            } catch (err) {
                                                                                                                alert('Error al revertir: ' + (err.response?.data?.error || err.message));
                                                                                                            }
                                                                                                        }}
                                                                                                        style={{ padding: '3px 8px', background: '#fff3e0', border: '1px solid #ffcc02', borderRadius: '4px', color: '#e65100', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px' }}
                                                                                                    >
                                                                                                        <RefreshCw size={11} /> Revertir
                                                                                                    </button>
                                                                                                </>
                                                                                            ) : (
                                                                                                <button
                                                                                                    onClick={() => handleConfig(doc)}
                                                                                                    className="btn-config"
                                                                                                    title="Formulario de Configuración"
                                                                                                    style={{ padding: '3px 8px', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '4px', color: '#1976d2', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px' }}
                                                                                                >
                                                                                                    <SettingsIcon size={12} /> Config
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            );
                                        }) : (
                                            <tr>
                                                <td colSpan="6" style={{ padding: '60px', textAlign: 'center' }}>
                                                    <div style={{ color: '#999', fontSize: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                        {loading ? (
                                                            <p>Cargando expedientes...</p>
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
                                                                <p>No hay expedientes con documentos pendientes de cargue.</p>
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
                                        {automationLoading ? 'Ejecutando proceso en OnBase...' : <><Play size={18} /> Iniciar Cargue AES ({selectedDocs.length} de {filteredDocs.filter(d => d.status === 'Pendiente').length} Docs seleccionados)</>}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ width: '480px' }}>
                        <div className="card" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '12px', borderLeft: '4px solid #39a900' }}>
                            <h3 style={{ marginTop: 0, fontSize: '16px', borderBottom: '1px solid #eee', paddingBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Monitor size={18} /> Monitoreo en Vivo
                                </span>
                                {liveFrame && (
                                    <button 
                                        onClick={() => setIsMonitorExpanded(true)}
                                        style={{
                                            background: '#1976d2',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            padding: '4px 8px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '12px',
                                            fontWeight: '600'
                                        }}
                                    >
                                        <Maximize2 size={13} /> Ampliar
                                    </button>
                                )}
                            </h3>
                            {liveFrame ? (
                                <div style={{ border: '2px solid #000', borderRadius: '8px', overflow: 'hidden', background: '#000', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
                                    <img 
                                        src={liveFrame} 
                                        alt="Live Stream" 
                                        onClick={() => setIsMonitorExpanded(true)}
                                        style={{ width: '100%', display: 'block', maxHeight: '350px', objectFit: 'contain', cursor: 'pointer' }} 
                                        title="Haz clic para ampliar pantalla"
                                    />
                                    <div style={{ background: '#ff0000', color: '#fff', fontSize: '11px', padding: '4px 10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ width: '8px', height: '8px', background: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'blink 1s step-end infinite' }}></span>
                                        CONEXIÓN LIVE — OnBase Web (Clic para ampliar)
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginTop: '20px' }}>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
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
                                    <label style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginLeft: '10px' }}>
                                        <input type="checkbox" checked={autoLote} onChange={e => setAutoLote(e.target.checked)} style={{ cursor: 'pointer' }} />
                                        Crear lote de seguimiento automático
                                    </label>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                                    <div style={{ position: 'relative', width: '260px' }}>
                                        <input
                                            type="text"
                                            placeholder="Asignar responsables al lote..."
                                            value={userSearchText}
                                            onChange={e => {
                                                setUserSearchText(e.target.value);
                                                setShowUserDropdown(true);
                                            }}
                                            onFocus={() => setShowUserDropdown(true)}
                                            onBlur={() => setTimeout(() => setShowUserDropdown(false), 250)}
                                            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '12px', outline: 'none' }}
                                        />
                                        {showUserDropdown && (
                                            <div style={{ position: 'absolute', zIndex: 100, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', width: '100%', maxH: '200px', overflowY: 'auto', marginTop: '4px', right: 0, textAlign: 'left' }}>
                                                {activeUsers
                                                    .filter(u => {
                                                        const term = userSearchText.toLowerCase();
                                                        return !term || 
                                                            u.full_name.toLowerCase().includes(term) || 
                                                            (u.area && u.area.toLowerCase().includes(term));
                                                    })
                                                    .map(u => (
                                                        <div
                                                            key={u.id}
                                                            onMouseDown={() => {
                                                                if (!selectedResponsibles.some(su => su.id === u.id)) {
                                                                    setSelectedResponsibles([...selectedResponsibles, u]);
                                                                }
                                                                setUserSearchText('');
                                                                setShowUserDropdown(false);
                                                            }}
                                                            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: '11px' }}
                                                            onMouseEnter={(e) => e.target.style.backgroundColor = '#f1f8e9'}
                                                            onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
                                                        >
                                                            <strong>{u.full_name}</strong> <span style={{ color: '#666' }}>({u.area || 'Sin área'})</span>
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        )}
                                    </div>
                                    {selectedResponsibles.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '300px', justifyContent: 'flex-end' }}>
                                            {selectedResponsibles.map(u => (
                                                <span key={u.id} style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', fontSize: '10px', padding: '2px 8px', borderRadius: '12px', border: '1px solid #a5d6a7', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {u.full_name.split(' ')[0]}
                                                    <button type="button" onClick={() => setSelectedResponsibles(prev => prev.filter(x => x.id !== u.id))} style={{ color: '#d32f2f', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', padding: 0 }}>×</button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
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

                                {/* Selector de Responsable Individual */}
                                <div style={{ position: 'relative' }}>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '5px' }}>Responsable del Expediente</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <div style={{ position: 'relative', flexGrow: 1 }}>
                                            <input
                                                type="text"
                                                placeholder="Buscar usuario por nombre o área..."
                                                value={individualSearchText}
                                                onChange={e => {
                                                    setIndividualSearchText(e.target.value);
                                                    setShowIndividualDropdown(true);
                                                }}
                                                onFocus={() => setShowIndividualDropdown(true)}
                                                onBlur={() => setTimeout(() => setShowIndividualDropdown(false), 250)}
                                                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                            />
                                            {showIndividualDropdown && (
                                                <div style={{ position: 'absolute', zIndex: 100, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', width: '100%', maxHeight: '180px', overflowY: 'auto', marginTop: '4px' }}>
                                                    {activeUsers
                                                        .filter(u => {
                                                            const term = individualSearchText.toLowerCase();
                                                            return !term || 
                                                                u.full_name.toLowerCase().includes(term) || 
                                                                (u.area && u.area.toLowerCase().includes(term));
                                                        })
                                                        .map(u => (
                                                            <div
                                                                key={u.id}
                                                                onMouseDown={() => {
                                                                    setIndividualResponsible(u);
                                                                    setIndividualSearchText(u.full_name);
                                                                    setShowIndividualDropdown(false);
                                                                }}
                                                                style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: '11px' }}
                                                                onMouseEnter={(e) => e.target.style.backgroundColor = '#f1f8e9'}
                                                                onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
                                                            >
                                                                <strong>{u.full_name}</strong> <span style={{ color: '#666' }}>({u.area || 'Sin área'} - {u.position || 'Sin cargo'})</span>
                                                            </div>
                                                        ))
                                                    }
                                                    {activeUsers.filter(u => {
                                                        const term = individualSearchText.toLowerCase();
                                                        return !term || u.full_name.toLowerCase().includes(term) || (u.area && u.area.toLowerCase().includes(term));
                                                    }).length === 0 && (
                                                        <div style={{ padding: '10px', textAlign: 'center', fontSize: '11px', color: '#999' }}>No se encontraron usuarios activos</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {individualResponsible && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIndividualResponsible(null);
                                                    setIndividualSearchText('');
                                                }}
                                                style={{ background: '#ffebee', color: '#c62828', border: '1px solid #ffcdd2', borderRadius: '4px', padding: '0 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                title="Quitar responsable"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
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
                                            <th style={{ padding: '8px' }}>Responsable</th>
                                            <th style={{ padding: '8px' }}>Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {expedientes.length > 0 ? expedientes.map((exp, idx) => (
                                            <tr key={idx} style={{ borderTop: '1px solid #eee' }}>
                                                <td style={{ padding: '8px' }}>{exp.expediente_code}</td>
                                                <td style={{ padding: '8px' }}>{exp.title}</td>
                                                <td style={{ padding: '8px' }}>{exp.subserie}</td>
                                                <td style={{ padding: '8px', color: '#666', fontWeight: 'bold' }}>{exp.assigned_user_name || 'Sin asignar'}</td>
                                                <td style={{ padding: '8px' }}>
                                                    <button onClick={() => handleMassDelete(idx)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}><Trash size={14} /></button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Lista vacía. Cargue un Excel o use el formulario.</td>
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

                            {/* TEXTO ADICIONAL DEL DOCUMENTO */}
                            {editingModal ? (
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '5px' }}>TEXTO ADICIONAL DEL DOCUMENTO</label>
                                    <textarea
                                        value={modalEditFields.description ?? configDoc.document_metadata?.description ?? ''}
                                        onChange={(e) => setModalEditFields(f => ({ ...f, description: e.target.value }))}
                                        rows={2}
                                        style={{ width: '100%', padding: '10px', border: '2px solid #e65100', borderRadius: '6px', backgroundColor: '#fff3e0', fontFamily: 'inherit', fontSize: '13px', resize: 'vertical' }}
                                        placeholder="Escriba texto adicional si aplica..."
                                    />
                                </div>
                            ) : (
                                configDoc.document_metadata?.description && (
                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '5px' }}>TEXTO ADICIONAL DEL DOCUMENTO</label>
                                        <textarea
                                            value={configDoc.document_metadata.description}
                                            readOnly
                                            rows={2}
                                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', backgroundColor: '#f9f9f9', fontFamily: 'inherit', fontSize: '13px', resize: 'vertical' }}
                                        />
                                    </div>
                                )
                            )}

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
                                                    const { description, ...restFields } = modalEditFields;
                                                    const payload = {
                                                        ...restFields,
                                                        metadata_values: JSON.stringify({ description: description || '' })
                                                    };
                                                    await axios.put(`/api/documents/${configDoc.id}`, payload, { headers: authHeaders });
                                                    // Actualizar configDoc localmente
                                                    setConfigDoc(prev => {
                                                        const updatedDoc = {
                                                            ...prev,
                                                            ...restFields,
                                                            document_metadata: {
                                                                ...(prev.document_metadata || {}),
                                                                description: description || ''
                                                            }
                                                        };
                                                        let meta = { ...(updatedDoc.expediente_metadata || {}), ...(updatedDoc.document_metadata || {}) };
                                                        let joined = [1, 2, 3, 4, 5, 6, 7, 8]
                                                            .map(i => meta[`valor${i}`] || meta[`Metadato ${i}`])
                                                            .filter(v => v)
                                                            .join(' ');
                                                        
                                                        const docDesc = updatedDoc.document_metadata?.description;
                                                        if (docDesc) {
                                                            joined = `${joined} ${docDesc}`;
                                                        }
                                                        updatedDoc.joinedName = restFields.filename ?? joined;
                                                        return updatedDoc;
                                                    });
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
                                                    path: configDoc.path || '',
                                                    description: configDoc.document_metadata?.description || ''
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

            {/* ══════════════════════════════════════════
                MODAL VISTA PREVIA — IMPORTACIÓN EXCEL
            ══════════════════════════════════════════ */}
            {showPreviewModal && (
                <div className="fixed inset-0 z-[200]" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px', backdropFilter: 'blur(4px)' }}>
                    <div style={{ backgroundColor: '#fff', borderRadius: '16px', display: 'flex', flexDirection: 'column', width: '96vw', height: '94vh', overflow: 'hidden', border: '1px solid #c8e6c9', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>

                        {/* ── Header ── */}
                        <div style={{background: 'linear-gradient(135deg, #14532d 0%, #166534 60%, #15803d 100%)', padding: '20px', color: '#fff'}}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <FileText size={22}/> Vista Previa — Revisión antes de Cargar
                                    </h2>
                                    <p style={{ margin: '5px 0 0 0', color: '#a5d6a7', fontSize: '13px' }}>Revise cada fila. Los datos con advertencias se marcan en naranja/rojo. Confirme sólo si todo está correcto.</p>
                                </div>
                                <button
                                    onClick={() => { setShowPreviewModal(false); setPreviewData([]); setPreviewLabels({}); }}
                                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                ><X size={20}/></button>
                            </div>

                            {/* Stats and Batch Assignment */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '15px', marginTop: '10px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '12px', padding: '10px 20px', textAlign: 'center', minWidth: '90px' }}>
                                        <div style={{ fontSize: '24px', fontWeight: '900' }}>{previewData.length}</div>
                                        <div style={{ fontSize: '10px', color: '#c8e6c9', textTransform: 'uppercase', tracking: '0.1em', marginTop: '2px' }}>Total</div>
                                    </div>
                                    <div style={{ background: 'rgba(76,175,80,0.25)', borderRadius: '12px', padding: '10px 20px', textAlign: 'center', minWidth: '90px' }}>
                                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#a5d6a7' }}>{previewData.filter(e => getRowWarnings(e).length === 0).length}</div>
                                        <div style={{ fontSize: '10px', color: '#a5d6a7', textTransform: 'uppercase', tracking: '0.1em', marginTop: '2px' }}>Sin errores</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,152,0,0.25)', borderRadius: '12px', padding: '10px 20px', textAlign: 'center', minWidth: '90px' }}>
                                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#ffe082' }}>{previewData.filter(e => getRowWarnings(e).length > 0 && e.subserie).length}</div>
                                        <div style={{ fontSize: '10px', color: '#ffe082', textTransform: 'uppercase', tracking: '0.1em', marginTop: '2px' }}>Advertencias</div>
                                    </div>
                                    <div style={{ background: 'rgba(244,67,54,0.25)', borderRadius: '12px', padding: '10px 20px', textAlign: 'center', minWidth: '90px' }}>
                                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#ffcdd2' }}>{previewData.filter(e => !e.subserie).length}</div>
                                        <div style={{ fontSize: '10px', color: '#ffcdd2', textTransform: 'uppercase', tracking: '0.1em', marginTop: '2px' }}>Sin TRD</div>
                                    </div>
                                </div>
                                
                                {/* Asignador masivo en el modal */}
                                <div style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', padding: '10px 15px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#e8f5e9' }}>
                                        Asignar responsable a todo el lote:
                                    </div>
                                    <select
                                        style={{ backgroundColor: '#1b5e20', border: '1px solid #2e7d32', borderRadius: '8px', padding: '8px', fontSize: '12px', color: '#fff', outline: 'none', cursor: 'pointer', minWidth: '200px' }}
                                        value=""
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (!val) return;
                                            const foundUser = activeUsers.find(u => u.id === parseInt(val));
                                            if (foundUser && window.confirm(`¿Desea asignar a ${foundUser.full_name} como responsable para TODOS los ${previewData.length} expedientes en vista previa?`)) {
                                                setPreviewData(prev => prev.map(row => ({
                                                    ...row,
                                                    assigned_user_id: foundUser.id,
                                                    assigned_user_name: foundUser.full_name
                                                })));
                                            }
                                        }}
                                    >
                                        <option value="" style={{color: '#111'}}>— Seleccionar responsable —</option>
                                        {activeUsers.map(u => (
                                            <option key={u.id} value={u.id} style={{color: '#111'}}>
                                                {u.full_name} ({u.area || 'Sin área'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Datalist compartido para autocomplete de códigos TRD */}
                        <datalist id="preview-subseries-list">
                            {allSubseries.map(s => (
                                <option key={s.id} value={s.subseries_code || s.concatenated_code}>
                                    {s.subseries_name || s.series_name}
                                </option>
                            ))}
                        </datalist>

                        <div style={{ overflow: 'auto', flex: 1, padding: '0 15px' }}>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '12px' }}>
                                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                        <th style={{ padding: '12px 8px', fontWeight: 'bold' }}>#</th>
                                        <th style={{ padding: '12px 8px', fontWeight: 'bold' }}>Estado</th>
                                        <th style={{ padding: '12px 8px', fontWeight: 'bold' }}>Cód. Expediente</th>
                                        <th style={{ padding: '12px 8px', fontWeight: 'bold' }}>Fecha Apertura</th>
                                        <th style={{ padding: '12px 8px', fontWeight: 'bold', minWidth: '180px' }}>Subserie / TRD 🗒️</th>
                                        <th style={{ padding: '12px 8px', fontWeight: 'bold' }}>Tipo Almac.</th>
                                        <th style={{ padding: '12px 8px', fontWeight: 'bold', minWidth: '200px' }}>Título</th>
                                        <th style={{ padding: '12px 8px', fontWeight: 'bold', minWidth: '150px' }}>Responsable</th>
                                        {Object.entries(previewLabels).map(([k, lbl]) => (
                                            <th key={k} style={{ padding: '12px 8px', fontWeight: 'bold', color: '#1976d2' }}>{lbl || k}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.map((exp, rowIdx) => {
                                        const warns = getRowWarnings(exp);
                                        const trdValid = isValidTRD(exp.subserie);
                                        const isError = !exp.subserie;
                                        const rowBg = isError ? '#fff7f7' : warns.length > 0 ? '#fffbeb' : (rowIdx % 2 === 0 ? '#ffffff' : '#f0fdf4');
                                        
                                        const cellInput = {
                                            width: '100%', background: 'transparent', border: 'none',
                                            outline: 'none', padding: '2px 4px', fontSize: '12px',
                                            borderBottom: '1px dashed #cbd5e1', color: '#111827',
                                            minWidth: '80px'
                                        };
                                        return (
                                            <tr key={rowIdx} style={{ backgroundColor: rowBg, borderBottom: '1px solid #e5e7eb' }}>
                                                {/* # */}
                                                <td style={{ padding: '8px', color: '#9ca3af', fontFamily: 'monospace' }}>{rowIdx + 1}</td>

                                                {/* Estado */}
                                                <td style={{ padding: '8px' }}>
                                                    {warns.length === 0 ? (
                                                        <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>✓ OK</span>
                                                    ) : (
                                                        <span title={warns.join(' | ')} style={{
                                                            background: isError ? '#fee2e2' : '#ffedd5',
                                                            color: isError ? '#dc2626' : '#c2410c',
                                                            fontSize: '10px', padding: '2px 8px', borderRadius: '999px', fontWeight: 700,
                                                            cursor: 'help', display: 'inline-block', maxWidth: '180px',
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                        }}>
                                                            ⚠ {warns.join(' · ')}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Código expediente */}
                                                <td style={{ padding: '8px' }}>
                                                    <input
                                                        style={{...cellInput, fontFamily: 'monospace'}}
                                                        value={exp.expediente_code || ''}
                                                        onChange={e => updatePreviewRow(rowIdx, 'expediente_code', e.target.value)}
                                                        placeholder="—"
                                                        title="Editar código de expediente"
                                                    />
                                                </td>

                                                {/* Fecha */}
                                                <td style={{ padding: '8px' }}>
                                                    <input
                                                        type="date"
                                                        style={cellInput}
                                                        value={exp.opening_date || ''}
                                                        onChange={e => updatePreviewRow(rowIdx, 'opening_date', e.target.value)}
                                                        title="Editar fecha"
                                                    />
                                                </td>

                                                {/* Subserie TRD — con autocomplete y validación */}
                                                <td style={{ padding: '8px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <input
                                                            list="preview-subseries-list"
                                                            style={{
                                                                ...cellInput,
                                                                fontFamily: 'monospace', fontWeight: 700,
                                                                borderBottomColor: trdValid ? '#16a34a' : (exp.subserie ? '#dc2626' : '#cbd5e1'),
                                                                borderBottomStyle: 'solid',
                                                                color: trdValid ? '#15803d' : (exp.subserie ? '#dc2626' : '#6b7280'),
                                                                minWidth: '130px'
                                                            }}
                                                            value={exp.subserie || ''}
                                                            onChange={e => updatePreviewRow(rowIdx, 'subserie', e.target.value)}
                                                            placeholder="Ingrese código TRD..."
                                                            title={trdValid ? 'Código TRD válido ✓' : (exp.subserie ? 'Código TRD no reconocido – verifíquelo' : 'Ingrese el código TRD')}
                                                        />
                                                        {exp.subserie && (
                                                            <span style={{ fontSize: '14px', fontWeight: 900, color: trdValid ? '#16a34a' : '#dc2626', flexShrink: 0 }}>
                                                                {trdValid ? '✓' : '✗'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {exp.subserie && trdValid && (
                                                        <div style={{ fontSize: '9px', color: '#16a34a', marginTop: '1px', paddingLeft: '4px' }}>
                                                            {allSubseries.find(s => (s.subseries_code || s.concatenated_code) === exp.subserie.trim())?.subseries_name || ''}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Tipo almacenamiento */}
                                                <td style={{ padding: '8px' }}>
                                                    <select
                                                        style={{...cellInput, cursor: 'pointer'}}
                                                        value={exp.storage_type || ''}
                                                        onChange={e => updatePreviewRow(rowIdx, 'storage_type', e.target.value)}
                                                    >
                                                        <option value="">— Seleccionar —</option>
                                                        <option value="Fisico">Físico</option>
                                                        <option value="Digital">Digital</option>
                                                        <option value="Electronico">Electronico</option>
                                                        <option value="Hibrido">Híbrido</option>
                                                    </select>
                                                </td>

                                                {/* Título */}
                                                <td style={{ padding: '8px' }}>
                                                    <input
                                                        style={{...cellInput, fontWeight: 500}}
                                                        value={exp.title === 'Sin Título' ? '' : (exp.title || '')}
                                                        onChange={e => updatePreviewRow(rowIdx, 'title', e.target.value)}
                                                        placeholder="Sin título..."
                                                        title="Editar título"
                                                    />
                                                </td>

                                                {/* Responsable */}
                                                <td style={{ padding: '8px' }}>
                                                    <select
                                                        style={{...cellInput, cursor: 'pointer', minWidth: '150px'}}
                                                        value={exp.assigned_user_id || ''}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            const foundUser = activeUsers.find(u => u.id === parseInt(val));
                                                            updatePreviewRow(rowIdx, 'assigned_user_id', foundUser ? foundUser.id : null);
                                                            updatePreviewRow(rowIdx, 'assigned_user_name', foundUser ? foundUser.full_name : '');
                                                        }}
                                                    >
                                                        <option value="">— Sin Responsable —</option>
                                                        {activeUsers.map(u => (
                                                            <option key={u.id} value={u.id}>{u.full_name} ({u.area || 'Sin área'})</option>
                                                        ))}
                                                    </select>
                                                </td>

                                                {/* Metadatos */}
                                                {Object.entries(previewLabels).map(([k], metaIdx) => {
                                                    const val = exp.metadata_values?.[`valor${metaIdx + 1}`] || '';
                                                    return (
                                                        <td key={k} style={{ padding: '8px', maxWidth: '130px' }}>
                                                            <input
                                                                style={cellInput}
                                                                value={val}
                                                                onChange={e => {
                                                                    const newMeta = { ...(exp.metadata_values || {}), [`valor${metaIdx + 1}`]: e.target.value };
                                                                    updatePreviewRow(rowIdx, 'metadata_values', newMeta);
                                                                }}
                                                                placeholder="—"
                                                                title={`Editar ${previewLabels[k] || k}`}
                                                            />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* ── Footer ── */}
                        <div style={{ background: '#f8fafc', padding: '15px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                {previewData.filter(e => !e.subserie).length > 0 && (
                                    <span style={{ color: '#dc2626', fontWeight: 600 }}>
                                        ⚠ {previewData.filter(e => !e.subserie).length} fila(s) sin código TRD — se cargarán pero no se podrán vincular a permisos.
                                    </span>
                                )}
                                {previewData.filter(e => !e.subserie).length === 0 && (
                                    <span style={{ color: '#15803d', fontWeight: 500 }}>✓ Todos los registros tienen código TRD asignado.</span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={() => { setShowPreviewModal(false); setPreviewData([]); setPreviewLabels({}); }}
                                    style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #ccc', background: '#fff', color: '#333', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                    ✕ Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmPreview}
                                    style={{ padding: '10px 25px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #2e7d32, #1b5e20)', color: '#fff', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                >
                                    Confirmar y Cargar {previewData.length} Registros →
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* Modal de Monitoreo Ampliado */}
            {isMonitorExpanded && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div style={{
                        position: 'relative',
                        width: '90%',
                        maxWidth: '1200px',
                        backgroundColor: '#000',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        border: '2px solid #555'
                    }}>
                        <div style={{
                            padding: '12px 20px',
                            background: '#222',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid #444'
                        }}>
                            <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Monitor size={18} color="#39a900" /> Monitoreo Ampliado en Vivo (OnBase Web Client)
                            </span>
                            <button 
                                onClick={() => setIsMonitorExpanded(false)}
                                style={{
                                    background: '#e53935',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '13px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <X size={15} /> Cerrar Pantalla
                            </button>
                        </div>
                        {liveFrame ? (
                            <div style={{ position: 'relative' }}>
                                <img 
                                    src={liveFrame} 
                                    alt="Live Stream Expanded" 
                                    onMouseDown={handleImageClick}
                                    onContextMenu={(e) => e.preventDefault()}
                                    onDragStart={(e) => e.preventDefault()}
                                    style={{ 
                                        width: '100%', 
                                        maxHeight: '70vh', 
                                        objectFit: 'contain', 
                                        display: 'block', 
                                        cursor: isInteracting ? 'wait' : 'crosshair' 
                                    }} 
                                />
                                {clickPoint && (
                                    <div style={{
                                        position: 'absolute',
                                        left: `${clickPoint.x}px`,
                                        top: `${clickPoint.y}px`,
                                        width: '16px',
                                        height: '16px',
                                        borderRadius: '50%',
                                        backgroundColor: 'rgba(255, 0, 0, 0.8)',
                                        border: '2px solid #fff',
                                        transform: 'translate(-50%, -50%)',
                                        pointerEvents: 'none',
                                        boxShadow: '0 0 10px red',
                                        zIndex: 10
                                    }} />
                                )}
                                
                                {/* Panel de control manual */}
                                <div style={{
                                    padding: '12px 20px',
                                    background: '#1a1a1a',
                                    borderTop: '1px solid #333',
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '15px'
                                }}>
                                    {/* Control de teclado */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '300px' }}>
                                        <input 
                                            type="text" 
                                            placeholder="Escribe texto para enviar al navegador..." 
                                            value={manualText}
                                            onChange={e => setManualText(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') sendManualText(); }}
                                            disabled={isInteracting}
                                            style={{
                                                flex: 1,
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                border: '1px solid #444',
                                                background: '#333',
                                                color: '#fff',
                                                outline: 'none',
                                                fontSize: '13px'
                                            }}
                                        />
                                        <button 
                                            onClick={sendManualText}
                                            disabled={isInteracting || !manualText}
                                            style={{
                                                background: '#39a900',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '6px',
                                                padding: '8px 16px',
                                                fontWeight: 'bold',
                                                fontSize: '13px',
                                                cursor: (isInteracting || !manualText) ? 'not-allowed' : 'pointer',
                                                opacity: (isInteracting || !manualText) ? 0.6 : 1
                                            }}
                                        >
                                            Enviar Texto
                                        </button>
                                    </div>
                                    
                                    {/* Botones de teclas rápidas */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                        {['Enter', 'Tab', 'Escape', 'Backspace'].map(k => (
                                            <button
                                                key={k}
                                                onClick={() => sendManualKey(k)}
                                                disabled={isInteracting}
                                                style={{
                                                    background: '#2a2a2a',
                                                    color: '#eee',
                                                    border: '1px solid #444',
                                                    borderRadius: '6px',
                                                    padding: '8px 14px',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    cursor: isInteracting ? 'not-allowed' : 'pointer'
                                                }}
                                            >
                                                {k === 'Backspace' ? 'Borrar' : k === 'Escape' ? 'Esc' : k}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Botón de cierre forzado de sesión */}
                                    <div>
                                        <button
                                            onClick={killAutomation}
                                            disabled={isInteracting}
                                            style={{
                                                background: '#d32f2f',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '6px',
                                                padding: '8px 16px',
                                                fontWeight: 'bold',
                                                fontSize: '13px',
                                                cursor: isInteracting ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            Forzar Cierre Navegador
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ height: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
                                Sin transmisión activa
                            </div>
                        )}
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
