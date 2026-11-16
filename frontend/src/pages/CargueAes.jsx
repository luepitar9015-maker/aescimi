import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { Play, CheckCircle, CheckSquare, Clock, AlertCircle, FileText, Search, RefreshCw, Monitor, X, Globe, Settings as SettingsIcon, Save, Download, Trash, Database, Eye, ChevronDown, ChevronRight, Maximize2 } from 'lucide-react';

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
    const [statusFilter, setStatusFilter] = useState(() => {
        const urlStatus = new URLSearchParams(window.location.search).get('status');
        return ['Todos', 'Pendiente', 'Cargado', 'SinCodigo'].includes(urlStatus) ? urlStatus : 'Pendiente';
    }); // 'Todos', 'Pendiente', 'Cargado'
    const [dependencyFilter, setDependencyFilter] = useState('all'); // 'all', '9224', '9224.4', '9224.2'
    const [subserieFilter, setSubserieFilter] = useState('all'); // 'all' o código de subserie documental TRD
    const [selectedOnBaseUser, setSelectedOnBaseUser] = useState('auto'); // 'auto', 'JRROZO', 'EDHERNANDEZM', 'luepitar'
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [logs, setLogs] = useState([]);
    const [automationLoading, setAutomationLoading] = useState(false);
    const [liveFrame, setLiveFrame] = useState(null);
    const [isMonitorExpanded, setIsMonitorExpanded] = useState(false);
    const [manualText, setManualText] = useState('');
    const [isInteracting, setIsInteracting] = useState(false);

    // ── ESTADO MULTI-BOT (3 BOTS CONCURRENTES POR USUARIO ONBASE) ──
    const [activeMonitorBot, setActiveMonitorBot] = useState('9224.4'); // '9224' | '9224.4' | '9224.2'
    const [mosaicView, setMosaicView] = useState(false);
    const [frameTick, setFrameTick] = useState(Date.now());
    const pollIntervalRef = useRef(null);
    const lastProcessedTotalRef = useRef(0);
    const [botsStatus, setBotsStatus] = useState({
        '9224': { botKey: '9224', label: 'Bot 1 · Subdirección (9224)', shortName: 'Subdirección', onbaseUser: 'TVILLAMIZARJ', running: false, completed: false, error: null, logs: [], totalDocs: 0, processedDocs: 0, currentStep: '', currentDocName: '', hasFrame: false, waitingForVerifier: false, stepStuckSeconds: 0, isBlocked: false },
        '9224.4': { botKey: '9224.4', label: 'Bot 2 · Formación (9224.4)', shortName: 'Formación', onbaseUser: 'EDHERNANDEZM', running: false, completed: false, error: null, logs: [], totalDocs: 0, processedDocs: 0, currentStep: '', currentDocName: '', hasFrame: false, waitingForVerifier: false, stepStuckSeconds: 0, isBlocked: false },
        '9224.2': { botKey: '9224.2', label: 'Bot 3 · Adm. Educativa (9224.2)', shortName: 'Adm. Educativa', onbaseUser: 'luepitar', running: false, completed: false, error: null, logs: [], totalDocs: 0, processedDocs: 0, currentStep: '', currentDocName: '', hasFrame: false, waitingForVerifier: false, stepStuckSeconds: 0, isBlocked: false },
        'VERIFICADOR': { botKey: 'VERIFICADOR', label: 'Bot 4 · Verificador OnBase (SGDEA Expediente)', shortName: 'Verificador OnBase', onbaseUser: 'TVILLAMIZARJ', running: false, completed: false, error: null, logs: [], totalDocs: 0, processedDocs: 0, currentStep: '⏸️ En espera (listo para verificar 50% / 100%)', currentDocName: '', hasFrame: false, autoVerifyEnabled: true, stepStuckSeconds: 0, isBlocked: false }
    });
    const [systemAlerts, setSystemAlerts] = useState([]);
    const [autoVerifyEvery5Min, setAutoVerifyEvery5Min] = useState(true);
    const [verifyingExpCode, setVerifyingExpCode] = useState(null);
    const [liveVerification, setLiveVerification] = useState(null);
    const [recentVerifications, setRecentVerifications] = useState([]);
    const [showVerifierPanel, setShowVerifierPanel] = useState(true);
    const [unlockingBotKey, setUnlockingBotKey] = useState(null);
    const [alertModalOpen, setAlertModalOpen] = useState(false);
    const [savingAlertSettings, setSavingAlertSettings] = useState(false);
    const [testingAlert, setTestingAlert] = useState(false);
    const [alertSettingsForm, setAlertSettingsForm] = useState({
        onbase_alert_email: '',
        onbase_alert_ntfy_topic: 'sena-cimi-onbase-alertas',
        onbase_alert_telegram_token: '',
        onbase_alert_telegram_chat_id: '',
        onbase_watchdog_timeout_sec: '90',
        onbase_auto_verify_5min: 'true'
    });
    const seenAlertIdsRef = useRef(new Set());

    // Sonido Web Audio API + Notificación nativa del navegador
    const playNotificationSound = (type = 'success') => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            if (type === 'critical' || type === 'warning') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(520, ctx.currentTime);
                osc.frequency.setValueAtTime(360, ctx.currentTime + 0.18);
                osc.frequency.setValueAtTime(520, ctx.currentTime + 0.36);
                gain.gain.setValueAtTime(0.18, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
                osc.start();
                osc.stop(ctx.currentTime + 0.65);
            } else {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, ctx.currentTime);
                osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
                gain.gain.setValueAtTime(0.12, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
                osc.start();
                osc.stop(ctx.currentTime + 0.45);
            }
        } catch {}
    };

    const notifyIncomingAlerts = (incomingAlerts = []) => {
        if (!Array.isArray(incomingAlerts)) return;
        setSystemAlerts(incomingAlerts);
        incomingAlerts.forEach(al => {
            if (!al || !al.id || seenAlertIdsRef.current.has(al.id)) return;
            seenAlertIdsRef.current.add(al.id);
            playNotificationSound(al.level || 'info');
            try {
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification(al.title || 'Aviso Sistema OnBase SENA', {
                        body: al.message || '',
                        tag: al.id
                    });
                }
            } catch {}
        });
    };

    // Estado dinámico de usuarios OnBase asignados a dependencias
    const [orgUsers, setOrgUsers] = useState({
        '9224': 'TVILLAMIZARJ',
        '9224.4': 'EDHERNANDEZM',
        '9224.2': 'luepitar'
    });

    useEffect(() => {
        (async () => {
            try {
                const token = localStorage.getItem('token');
                const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
                const res = await axios.get('/api/organization', { headers: authHeaders });
                const list = res.data?.data || [];
                const mapping = {};
                list.forEach(o => {
                    const sub = (o.subsection_code || '').trim();
                    const u = (o.onbase_user || o.onbase_username || '').trim();
                    if (sub === '9224.4' && u) mapping['9224.4'] = u;
                    else if (sub === '9224.2' && u) mapping['9224.2'] = u;
                    else if ((!sub || sub === '9224') && u) mapping['9224'] = u;
                });
                setOrgUsers(prev => ({ ...prev, ...mapping }));
            } catch (e) {
                console.error('Error fetching org users:', e);
            }
        })();
    }, []);

    // Helper de Dependencia y Usuario OnBase
    const getDepBadge = (code, user) => {
        const u = (user || '').toUpperCase();
        const c = String(code || '');
        if (c.includes('9224.4') || u.includes('EDHERNANDEZ')) {
            return {
                label: 'Grupo de Formación Profesional Integral',
                shortLabel: 'Formación (9224.4)',
                code: '9224.4',
                user: user || orgUsers['9224.4'] || 'EDHERNANDEZM',
                icon: '🎓',
                bg: '#e8f5e9',
                color: '#1b5e20',
                border: '#a5d6a7',
                pillBg: '#c8e6c9'
            };
        }
        if (c.includes('9224.2') || u.includes('LUEPITAR')) {
            return {
                label: 'Grupo Administración Educativa',
                shortLabel: 'Adm. Educativa (9224.2)',
                code: '9224.2',
                user: user || orgUsers['9224.2'] || 'luepitar',
                icon: '📚',
                bg: '#f3e5f5',
                color: '#4a148c',
                border: '#ce93d8',
                pillBg: '#e1bee7'
            };
        }
        return {
            label: 'Subdirección de Centro',
            shortLabel: 'Subdirección (9224)',
            code: '9224',
            user: user || orgUsers['9224'] || 'TVILLAMIZARJ',
            icon: '🏢',
            bg: '#e3f2fd',
            color: '#0d47a1',
            border: '#90caf9',
            pillBg: '#bbdefb'
        };
    };

    // Helper que clasifica un documento en uno de los 3 Bots ('9224', '9224.4', '9224.2')
    const getDocBotKey = (doc) => {
        if (!doc) return '9224';
        const dep = String(doc.dependency_code || '').trim();
        const sub = String(doc.subserie || '').trim();
        const u = String(doc.target_onbase_user || '').toUpperCase();
        if (dep === '9224.4' || sub.includes('9224.4') || u.includes('EDHERNANDEZ')) return '9224.4';
        if (dep === '9224.2' || sub.includes('9224.2') || u.includes('LUEPITAR')) return '9224.2';
        return '9224';
    };

    // Automation Flow Tracking
    const [currentStepIndex, setCurrentStepIndex] = useState(-1);
    const [automationError, setAutomationError] = useState(false);
    const [selectedDocs, setSelectedDocs] = useState([]);
    const [launchingBot, setLaunchingBot] = useState(false);
    const selectedDocsSet = useMemo(() => new Set(selectedDocs), [selectedDocs]);

    const automationSteps = [
        { id: 'start', label: '1. Conectando e Iniciando Sesión (OnBase Web Client)', match: ['Iniciando proceso', 'Conectando con OnBase', 'Autenticación exitosa', 'Post-login URL', 'PASO 1'] },
        { id: 'nav', label: '2. Abriendo Menú y "Nuevo Formulario"', match: ['Buscando menú principal', 'Menú hamburguesa', 'Nuevo Formulario" seleccionado', 'PASO 2'] },
        { id: 'type', label: '3. Seleccionando "SGDEA - Ingreso a Expediente" / Código de Expediente', match: ['Buscando tipo documental SGDEA', 'Tipo documental seleccionado:', 'ETAPA 3 DIRECTA', 'Código de Expediente', 'PASO 3'] },
        { id: 'fill', label: '4. Diligenciando Metadatos e Índices', match: ['Diligenciando metadatos', 'Metadatos diligenciados', 'PASO 4'] },
        { id: 'upload', label: '5. Adjuntando Archivo Electrónico PDF', match: ['Adjuntando archivo', 'Click en botón "Importar"', 'Archivo PDF cargado', 'PASO 5'] },
        { id: 'save', label: '6. Guardando y Radicando Documento', match: ['Guardando y radicando', 'Botón guardar activado', 'Documento radicado exitosamente', 'Ventana aceptada', 'PASO 6'] },
        { id: 'restart', label: '7. Continuar Siguiente Documento (Inicia en Etapa 3)', match: ['Esperando para procesar', 'Reiniciando ciclo', 'ETAPA 3 DIRECTA'] }
    ];

    // Sincronizar vista del Monitor Activo (logs, frame, paso actual y estado de error) cuando cambia el bot seleccionado o su estado
    const activeBotState = botsStatus[activeMonitorBot] || botsStatus['9224.4'] || {};
    useEffect(() => {
        const botLogs = activeBotState.logs || [];
        setLogs(botLogs);
        if (activeBotState.hasFrame) {
            const token = localStorage.getItem('token');
            setLiveFrame(`/api/automation/frame?bot=${encodeURIComponent(activeMonitorBot)}&t=${frameTick}&token=${token}`);
        } else {
            setLiveFrame(null);
        }
        if (activeBotState.error) {
            setAutomationError(true);
        } else if (!activeBotState.running && activeBotState.completed) {
            setAutomationError(false);
            setCurrentStepIndex(automationSteps.length);
        } else if (!activeBotState.running && botLogs.length === 0) {
            setAutomationError(false);
            setCurrentStepIndex(-1);
        }
    }, [activeMonitorBot, botsStatus, frameTick]);

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
    const fetchDocuments = async (filter, dep) => {
        const activeFilter = filter !== undefined ? filter : statusFilter;
        const activeDep = dep !== undefined ? dep : dependencyFilter;
        setLoading(true);
        try {
            let url = `/api/ades/pending?status=${activeFilter}`;
            if (activeDep && activeDep !== 'all') {
                url += `&dependency=${activeDep}`;
            }
            const res = await axios.get(url);
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
    const fetchPending = () => fetchDocuments(statusFilter, dependencyFilter);

    useEffect(() => {
        fetchDocuments(statusFilter, dependencyFilter);
        fetchSubseriesList();
    }, [statusFilter, dependencyFilter]);

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
            const typRes = await axios.get('/api/trd/all-typologies');
            setAllTypologies(typRes.data?.data || []);
        } catch (err) {
            console.error("Error fetching subseries list:", err);
        }
    };

    const startStatusPolling = () => {
        if (pollIntervalRef.current) return; // Ya hay un polling activo

        pollIntervalRef.current = setInterval(async () => {
            try {
                const token = localStorage.getItem('token');
                const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
                const statusRes = await axios.get('/api/automation/status', { headers: authHeaders });
                const st = statusRes.data;

                if (st.bots) {
                    setBotsStatus(st.bots);
                    setFrameTick(Date.now());

                    const vBot = st.bots.VERIFICADOR || {};
                    const liveVerif = st.liveVerification || vBot.liveVerification || null;
                    const recentVerif = st.recentVerifications || vBot.recentVerifications || [];
                    if (liveVerif) setLiveVerification(liveVerif);
                    if (Array.isArray(recentVerif) && recentVerif.length > 0) setRecentVerifications(recentVerif);

                    // Actualizar en tiempo real el estado de los documentos en pantalla conforme el Verificador los valida uno por uno
                    if (liveVerif && Array.isArray(liveVerif.documents)) {
                        const docMap = new Map();
                        liveVerif.documents.forEach(ld => {
                            if (ld.id) docMap.set(ld.id, ld);
                        });
                        if (docMap.size > 0) {
                            setDocuments(prev => prev.map(d => {
                                const ld = docMap.get(d.id);
                                if (!ld) return d;
                                if (ld.verifyState === 'cargado') {
                                    return {
                                        ...d,
                                        status: 'Cargado',
                                        onbase_verified: 2,
                                        onbase_verify_stage: 'Verificado en OnBase ✅',
                                        _liveMatchedRow: ld.matchedRow
                                    };
                                }
                                if (ld.verifyState === 'no_cargado') {
                                    return {
                                        ...d,
                                        onbase_verified: -1,
                                        onbase_verify_stage: 'No encontrado en OnBase ❌',
                                        _liveMatchedRow: ld.matchedRow
                                    };
                                }
                                return {
                                    ...d,
                                    _liveVerifying: true
                                };
                            }));
                        }
                    }

                    if (!vBot.running) {
                        setVerifyingExpCode(null);
                    }

                    // Calcular total de documentos procesados entre los 4 bots para refrescar la tabla en tiempo real cuando avance
                    const totalProc = Object.values(st.bots).reduce((acc, b) => acc + (b.processedDocs || 0) + (b.verifiedCount || 0), 0);
                    if (totalProc > lastProcessedTotalRef.current) {
                        lastProcessedTotalRef.current = totalProc;
                        fetchPending();
                    }
                }
                if (st.alerts) {
                    notifyIncomingAlerts(st.alerts);
                }
                if (st.autoVerifyEvery5Min !== undefined) {
                    setAutoVerifyEvery5Min(!!st.autoVerifyEvery5Min);
                }

                const anyActive = st.anyRunning !== undefined ? st.anyRunning : st.running;
                setAutomationLoading(!!anyActive);

                if (!anyActive) {
                    if (pollIntervalRef.current) {
                        clearInterval(pollIntervalRef.current);
                        pollIntervalRef.current = null;
                    }
                    lastProcessedTotalRef.current = 0;
                    await fetchPending();
                }
            } catch (pollErr) {
                console.error("Error al consultar estado de automatización:", pollErr);
            }
        }, 1500);
    };

    // Al montar la vista, consultar si ya hay alguno de los 3 Bots ejecutándose en segundo plano
    useEffect(() => {
        (async () => {
            try {
                const token = localStorage.getItem('token');
                const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
                const statusRes = await axios.get('/api/automation/status', { headers: authHeaders });
                const st = statusRes.data;
                if (st?.bots) {
                    setBotsStatus(st.bots);
                    setFrameTick(Date.now());
                    const vBot = st.bots.VERIFICADOR || {};
                    if (st.liveVerification || vBot.liveVerification) {
                        setLiveVerification(st.liveVerification || vBot.liveVerification);
                    }
                    if (Array.isArray(st.recentVerifications || vBot.recentVerifications)) {
                        setRecentVerifications(st.recentVerifications || vBot.recentVerifications);
                    }
                }
                if (st?.activeBotKey) {
                    setActiveMonitorBot(st.activeBotKey);
                }
                if (st?.alerts) {
                    st.alerts.forEach(a => a?.id && seenAlertIdsRef.current.add(a.id));
                    setSystemAlerts(st.alerts);
                }
                if (st?.autoVerifyEvery5Min !== undefined) {
                    setAutoVerifyEvery5Min(!!st.autoVerifyEvery5Min);
                }
                if (st?.anyRunning || st?.running) {
                    setAutomationLoading(true);
                    startStatusPolling();
                }
                if ('Notification' in window && Notification.permission === 'default') {
                    Notification.requestPermission().catch(() => {});
                }
            } catch {}
        })();
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, []);

    const handleRunAutomation = async (specificDocId = null, targetBotKey = null) => {
        if (launchingBot) return;

        // Filtrar documentos pendientes a procesar (individual, por Bot específico o todos los seleccionados) con Set O(1)
        let docsToProcess = [];
        if (specificDocId) {
            docsToProcess = documents.filter(d => d.id === specificDocId);
        } else if (selectedDocs.length > 0) {
            docsToProcess = documents.filter(d => selectedDocsSet.has(d.id) && d.status === 'Pendiente');
            if (targetBotKey && targetBotKey !== 'all') {
                docsToProcess = docsToProcess.filter(d => getDocBotKey(d) === targetBotKey);
            }
        } else if (targetBotKey && targetBotKey !== 'all') {
            return alert(`Seleccione al menos un documento pendiente de ${targetBotKey} marcando las casillas.`);
        } else {
            return alert("Seleccione al menos un documento pendiente de la lista marcando las casillas.");
        }

        if (docsToProcess.length === 0) {
            return alert(targetBotKey
                ? `No hay documentos pendientes seleccionados para el Bot ${targetBotKey}.`
                : "Los documentos seleccionados no son válidos o ya están cargados."
            );
        }

        setLaunchingBot(true);
        if (specificDocId) setConfigDoc(null);
        setAutomationLoading(true);
        setAutomationError(false);

        const focusBot = targetBotKey && targetBotKey !== 'all'
            ? targetBotKey
            : getDocBotKey(docsToProcess[0]);
        setActiveMonitorBot(focusBot);
        setLogs([`⏳ Validando lote (${docsToProcess.length} documento(s)) e iniciando Bot ${focusBot}...`]);

        const token = localStorage.getItem('token');
        const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

        try {
            // ── VALIDACIÓN MASIVA EN 1 SOLA PETICIÓN (<50ms en lugar de N peticiones secuenciales) ──
            const uniqueExpIds = [...new Set(docsToProcess.map(d => d.expediente_id).filter(Boolean))];
            if (uniqueExpIds.length > 0) {
                try {
                    const valRes = await axios.post(
                        '/api/seguimiento/validar-primer-doc-lote',
                        { expedienteIds: uniqueExpIds },
                        { headers: authHeaders, timeout: 8000 }
                    );
                    const missingMap = valRes.data?.missingByExpId || {};
                    const missingExps = Object.entries(missingMap);
                    if (missingExps.length > 0) {
                        const expSampleByExpId = new Map();
                        docsToProcess.forEach(d => {
                            if (d.expediente_id && !expSampleByExpId.has(d.expediente_id)) {
                                expSampleByExpId.set(d.expediente_id, d.expediente_code || d.filename);
                            }
                        });
                        const previewLines = missingExps.slice(0, 10).map(([eId, reqTyp]) =>
                            `• ${expSampleByExpId.get(Number(eId)) || `Exp #${eId}`} → falta: "${reqTyp}"`
                        ).join('\n');
                        const moreTxt = missingExps.length > 10 ? `\n... y ${missingExps.length - 10} expediente(s) más.` : '';
                        const continuar = window.confirm(
                            `⚠️ ADVERTENCIA: ${missingExps.length} expediente(s) NO tienen el primer documento obligatorio cargado:\n\n${previewLines}${moreTxt}\n\n¿Desea continuar de todas formas?`
                        );
                        if (!continuar) {
                            setAutomationLoading(false);
                            setLaunchingBot(false);
                            return;
                        }
                    }
                } catch { /* no bloquear si falla la validación */ }
            }

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
            const res = await axios.post('/api/automation/execute', {
                url: settings.ades_url,
                username: settings.ades_username,
                password: settings.ades_password,
                target_user: targetBotKey && targetBotKey !== 'all' ? targetBotKey : selectedOnBaseUser,
                bot_key: targetBotKey && targetBotKey !== 'all' ? targetBotKey : undefined,
                documentIds: docIdsToProcess
            }, { headers: authHeaders });

            if (res.data?.bots) {
                setBotsStatus(res.data.bots);
                setFrameTick(Date.now());
            }
            if (res.data?.activeBotKey) {
                setActiveMonitorBot(res.data.activeBotKey);
            }
            // Desmarcar de la selección los documentos que ya se enviaron a este(os) Bot(s)
            const sentSet = new Set(docIdsToProcess);
            setSelectedDocs(prev => prev.filter(id => !sentSet.has(id)));

            // Iniciar o mantener el polling de los 3 Bots
            startStatusPolling();

        } catch (err) {
            console.error("Automation error:", err);
            const errMsg = err.response?.data?.error || err.message || 'El proceso falló. Revise la conexión con OnBase.';
            setLogs(prev => [...prev, `Error: ${errMsg}`]);
            setAutomationError(true);
            setAutomationLoading(false);
        } finally {
            setLaunchingBot(false);
        }
    };
    // Documentos filtrados por dependencia (base para calcular subcategorías de Subserie TRD)
    const depFilteredDocs = documents.filter(doc => {
        if (dependencyFilter !== 'all') {
            const docDep = doc.dependency_code || (doc.subserie && doc.subserie.includes('9224.4') ? '9224.4' : (doc.subserie && doc.subserie.includes('9224.2') ? '9224.2' : '9224'));
            if (docDep !== dependencyFilter) return false;
        }
        return true;
    });

    // Subcategorías de Subserie Documental TRD disponibles (ordenadas por código de subserie)
    const subseriesSummaryList = (() => {
        const map = new Map();
        depFilteredDocs.forEach(doc => {
            const code = String(doc.subserie || '').trim() || 'SIN-SUBSERIE';
            if (!map.has(code)) {
                const catMatch = allSubseries.find(s =>
                    s.subseries_code === code || s.concatenated_code === code || s.series_code === code
                );
                map.set(code, {
                    code,
                    name: doc.subserie_name || doc.series_name || catMatch?.subseries_name || catMatch?.series_name || (code === 'SIN-SUBSERIE' ? 'Sin Subserie Asignada' : 'Subserie Documental'),
                    expIds: new Set(),
                    docCount: 0,
                    pendingCount: 0
                });
            }
            const item = map.get(code);
            if (doc.expediente_id) item.expIds.add(doc.expediente_id);
            item.docCount += 1;
            if (doc.status === 'Pendiente' && !doc.is_duplicate_typology) item.pendingCount += 1;
        });
        return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    })();

    const filteredDocs = depFilteredDocs.filter(doc => {
        // Filtro por Subcategoría de Subserie Documental TRD
        if (subserieFilter !== 'all') {
            const docSub = String(doc.subserie || '').trim() || 'SIN-SUBSERIE';
            if (docSub !== subserieFilter) return false;
        }

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
            doc.subserie_name,
            doc.dependency_name,
            doc.dependency_code,
            doc.target_onbase_user,
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
            grupo: 'TRD',
            _initTyp: setEditingTypology(prev => ({ ...prev, [doc.id]: doc.typology_name || '' }))
        });
    };

    const updateExpedienteCode = (id, val) => {
        setEditingCode(prev => ({ ...prev, [id]: val }));
    };

    const handleView = (doc) => {
        setEditingTypology(prev => ({
            ...prev,
            [doc.id]: prev[doc.id] !== undefined ? prev[doc.id] : (doc.typology_name || '')
        }));
        setInlinePreviewDocIds(prev =>
            prev.includes(doc.id) ? prev.filter(id => id !== doc.id) : [...prev, doc.id]
        );
    };

    const [allTypologies, setAllTypologies] = useState([]);
    const [inlinePreviewDocIds, setInlinePreviewDocIds] = useState([]);
    const [editingTypology, setEditingTypology] = useState({});
    const [savingTypologyId, setSavingTypologyId] = useState(null);
    const [showModalPreview, setShowModalPreview] = useState(false);

    const getTypologiesForDoc = (doc) => {
        if (!allTypologies || allTypologies.length === 0) return [];
        const rawSub = String(doc?.subserie || '').trim().toUpperCase();
        const bareCode = rawSub.includes('-') ? rawSub.split('-').pop().trim() : rawSub;
        let matched = allTypologies.filter(t => {
            const sCode = String(t.series_code || '').trim().toUpperCase();
            const subCode = String(t.subseries_code || '').trim().toUpperCase();
            if (!rawSub) return false;
            return (
                subCode === rawSub ||
                sCode === rawSub ||
                (bareCode && (subCode.endsWith(`-${bareCode}`) || sCode.endsWith(`-${bareCode}`) || subCode === bareCode || sCode === bareCode))
            );
        });
        const source = matched.length > 0 ? matched : allTypologies;
        const seen = new Set();
        const unique = [];
        source.forEach(t => {
            const nameKey = String(t.name || '').trim().toUpperCase();
            if (nameKey && !seen.has(nameKey)) {
                seen.add(nameKey);
                unique.push(t);
            }
        });
        return unique;
    };

    const saveDocTypology = async (docId, newTypologyValue) => {
        const cleanTyp = String(newTypologyValue ?? editingTypology[docId] ?? '').trim();
        if (!cleanTyp) {
            return alert('⚠️ Por favor seleccione o escriba una tipología documental válida.');
        }
        setSavingTypologyId(docId);
        try {
            const token = localStorage.getItem('token');
            const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post('/api/ades/update-typology', {
                id: docId,
                typology_name: cleanTyp
            }, { headers: authHeaders });

            const updatedFilename = res.data?.filename;
            const updatedPath = res.data?.path;
            const updatedOnbase = res.data?.onbase_name;

            setDocuments(prev => prev.map(d => d.id === docId ? {
                ...d,
                typology_name: cleanTyp,
                filename: updatedFilename || d.filename,
                path: updatedPath || d.path,
                onbase_name: updatedOnbase !== undefined ? updatedOnbase : d.onbase_name
            } : d));

            setEditingTypology(prev => ({ ...prev, [docId]: cleanTyp }));

            if (configDoc && configDoc.id === docId) {
                setConfigDoc(prev => prev ? ({
                    ...prev,
                    typology_name: cleanTyp,
                    filename: updatedFilename || prev.filename,
                    path: updatedPath || prev.path,
                    onbase_name: updatedOnbase !== undefined ? updatedOnbase : prev.onbase_name
                }) : null);
            }
            alert(`✅ Tipología actualizada a: "${cleanTyp}"`);
        } catch (err) {
            alert('❌ Error al actualizar la tipología: ' + (err.response?.data?.error || err.message));
        } finally {
            setSavingTypologyId(null);
        }
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
                await axios.post('/api/automation/click', { x, y, button: e.button === 2 ? 'right' : 'left', bot: activeMonitorBot }, {
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
            await axios.post('/api/automation/type', { text: manualText, bot: activeMonitorBot }, {
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
            await axios.post('/api/automation/press-key', { key, bot: activeMonitorBot }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            alert('Error al enviar tecla: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsInteracting(false);
        }
    };

    const killAutomation = async (botKeyToKill = null) => {
        const targetBot = typeof botKeyToKill === 'string' ? botKeyToKill : activeMonitorBot;
        const msg = targetBot === 'all'
            ? '¿Seguro que deseas detener TODOS los Bots de automatización activos?'
            : `¿Seguro que deseas detener el Bot ${targetBot} (${orgUsers[targetBot] || targetBot})? Los demás Bots seguirán ejecutándose normalmente.`;
        if (!window.confirm(msg)) return;
        setIsInteracting(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/automation/kill', { bot: targetBot }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data?.bots) {
                setBotsStatus(res.data.bots);
            }
            if (targetBot === 'all') {
                setIsMonitorExpanded(false);
            }
            alert(res.data?.message || 'Bot detenido por el usuario.');
        } catch (err) {
            alert('Error al detener: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsInteracting(false);
        }
    };

    // Destrabar sesión de Bot OnBase (Watchdog Manual / Remoto)
    const handleUnlockBot = async (botKeyToUnlock = null) => {
        const targetBot = botKeyToUnlock || activeMonitorBot || '9224.4';
        setUnlockingBotKey(targetBot);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/automation/unlock-bot', {
                bot: targetBot,
                action: 'escape_and_close_modals'
            }, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data?.bots) setBotsStatus(res.data.bots);
            setFrameTick(Date.now());
            alert(`🔓 ${res.data?.message || `Maniobra de desbloqueo ejecutada en Bot ${targetBot}.`}`);
        } catch (err) {
            alert('Error al destrabar Bot: ' + (err.response?.data?.error || err.message));
        } finally {
            setUnlockingBotKey(null);
        }
    };

    // Adelantar espera de 3 minutos entre oleadas para ingresar a verificar de inmediato
    const handleSkipVerifierWait = async (botKey = 'all') => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/automation/skip-verifier-wait', { bot: botKey }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data?.bots) setBotsStatus(res.data.bots);
        } catch (err) {
            alert('Error al adelantar verificación: ' + (err.response?.data?.error || err.message));
        }
    };

    // Lanzar Bot 4 · Verificador OnBase (SGDEA Expediente) para un expediente o para todos los expedientes visibles
    const handleVerifyExpedientesOnBase = async (singleExpCode = null, autoReuploadMissing = true) => {
        const token = localStorage.getItem('token');
        const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
        let expCodes = [];
        if (singleExpCode) {
            expCodes = [singleExpCode];
        } else {
            const selectedDocsList = documents.filter(d => selectedDocsSet.has(d.id));
            const sourceDocs = selectedDocsList.length > 0 ? selectedDocsList : filteredDocs;
            expCodes = [...new Set(sourceDocs.map(d => (d.expediente_code || '').trim()).filter(Boolean))];
        }
        if (expCodes.length === 0) {
            return alert('No hay códigos de expediente válidos para verificar en OnBase.');
        }

        // Expandir automáticamente las carpetas (expedientes) que se van a verificar para ver sus documentos en tiempo real
        const matchingExpIds = documents
            .filter(d => expCodes.includes((d.expediente_code || '').trim()) && d.expediente_id)
            .map(d => d.expediente_id);
        if (matchingExpIds.length > 0) {
            setExpandedExpedientes(prev => [...new Set([...prev, ...matchingExpIds])]);
        }

        // Inicializar vista previa en tiempo real mientras conecta con OnBase
        const firstCode = expCodes[0];
        const firstExpDocs = documents
            .filter(d => (d.expediente_code || '').trim() === firstCode)
            .map((d, idx) => ({
                id: d.id,
                index: idx + 1,
                filename: d.filename,
                typology_name: d.typology_name,
                dbStatus: d.status,
                verifyState: 'verificando',
                matchedRow: 'Conectando con OnBase para verificar...'
            }));
        setLiveVerification({
            expedienteCode: firstCode,
            status: 'VERIFICANDO',
            step: `Iniciando sesión en OnBase y consultando carpeta "${firstCode}"...`,
            foundInOnBaseCount: 0,
            verifiedCount: 0,
            missingCount: 0,
            documents: firstExpDocs
        });
        setShowVerifierPanel(true);
        setVerifyingExpCode(singleExpCode || 'ALL');
        setActiveMonitorBot('VERIFICADOR');
        try {
            const res = await axios.post('/api/automation/verify-expedientes', {
                expedienteCodes: expCodes,
                stage: 'MANUAL',
                autoReuploadMissing
            }, { headers: authHeaders });
            if (res.data?.bots) {
                setBotsStatus(res.data.bots);
                setFrameTick(Date.now());
            }
            startStatusPolling();
        } catch (err) {
            setVerifyingExpCode(null);
            alert('Error al iniciar verificación en OnBase: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleToggleAutoVerify5Min = async () => {
        try {
            const token = localStorage.getItem('token');
            const nextState = !autoVerifyEvery5Min;
            const res = await axios.post('/api/automation/toggle-auto-verify', {
                enabled: nextState
            }, { headers: { Authorization: `Bearer ${token}` } });
            setAutoVerifyEvery5Min(!!res.data?.autoVerifyEvery5Min);
            if (res.data?.bots) setBotsStatus(res.data.bots);
        } catch (err) {
            alert('Error al cambiar verificación periódica: ' + (err.response?.data?.error || err.message));
        }
    };

    const openAlertSettingsModal = async () => {
        setAlertModalOpen(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/automation/alert-settings', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data?.settings) {
                setAlertSettingsForm(prev => ({ ...prev, ...res.data.settings }));
            }
        } catch {}
    };

    const handleSaveAlertSettings = async (e) => {
        if (e) e.preventDefault();
        setSavingAlertSettings(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/automation/alert-settings', alertSettingsForm, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('✅ Configuración de alertas a Móvil y Equipo guardada correctamente.');
            setAlertModalOpen(false);
        } catch (err) {
            alert('Error al guardar alertas: ' + (err.response?.data?.error || err.message));
        } finally {
            setSavingAlertSettings(false);
        }
    };

    const handleSendTestAlert = async () => {
        setTestingAlert(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/automation/alert-settings', alertSettingsForm, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const res = await axios.post('/api/automation/test-alert', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data?.alerts) notifyIncomingAlerts(res.data.alerts);
            alert('📲 Alerta de prueba enviada al Móvil (Ntfy / Telegram), Correo y Panel del Sistema.');
        } catch (err) {
            alert('Error enviando alerta de prueba: ' + (err.response?.data?.error || err.message));
        } finally {
            setTestingAlert(false);
        }
    };

    const handleClearAlerts = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/automation/clear-alerts', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSystemAlerts([]);
        } catch {}
    };

    const saveExpedienteCode = async (docId) => {
        try {
            const doc = documents.find(d => d.id === docId);
            if (!doc) return;
            const newCode = editingCode[docId];
            if (newCode === undefined || newCode === doc.expediente_code) return;

            await axios.put(`/api/expedientes/${doc.expediente_id}`, {
                expediente_code: newCode
            });
            setDocuments(prev => prev.map(d =>
                d.expediente_id === doc.expediente_id ? { ...d, expediente_code: newCode } : d
            ));
            console.log(`[CARGUE-AES] Código de expediente actualizado silenciosamente a: ${newCode}`);
        } catch (err) {
            console.error("Error al actualizar código de expediente:", err);
        }
    };

    // Marcar manualmente lote de documentos seleccionados como Cargado
    const handleMarkSelectedAsCargado = async () => {
        if (selectedDocs.length === 0) {
            alert('Seleccione al menos un documento marcando las casillas.');
            return;
        }
        if (!window.confirm(`¿Confirmas marcar ${selectedDocs.length} documento(s) seleccionado(s) como "Cargado" en AES (OnBase)?`)) {
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/ades/mark-documents-cargado',
                { document_ids: selectedDocs },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert(`✅ ${res.data?.message || 'Documentos marcados como Cargados correctamente en AES.'}`);
            setSelectedDocs([]);
            fetchPending();
        } catch (err) {
            alert('Error al marcar como cargado: ' + (err.response?.data?.error || err.message));
        }
    };

    // Marcar todo un expediente como Cargado
    const handleMarkExpedienteAsCargado = async (exp) => {
        if (!window.confirm(`¿Confirmas marcar TODOS los documentos del expediente "${exp.title}" (${exp.expediente_code}) como "Cargado" en AES (OnBase)?`)) {
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/ades/mark-documents-cargado',
                { expediente_ids: [exp.expediente_id] },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert(`✅ ${res.data?.message || 'Expediente marcado como Cargado correctamente en AES.'}`);
            fetchPending();
        } catch (err) {
            alert('Error al marcar expediente: ' + (err.response?.data?.error || err.message));
        }
    };

    // Marcar un solo documento como Cargado
    const handleMarkSingleDocumentAsCargado = async (doc) => {
        if (!window.confirm(`¿Confirmas marcar el documento "${doc.typology_name}" (${doc.filename}) como "Cargado" en AES?`)) {
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/ades/mark-documents-cargado',
                { document_ids: [doc.id] },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert(`✅ Documento marcado como Cargado en AES.`);
            fetchPending();
        } catch (err) {
            alert('Error al marcar documento: ' + (err.response?.data?.error || err.message));
        }
    };

    // ── ESTADO Y FUNCIONES DE LA PESTAÑA "VERIFICADOR" MANUAL DEL DIRECTOR ──
    const [verifierDocs, setVerifierDocs] = useState([]);
    const [verifierLoading, setVerifierLoading] = useState(false);
    const [verifierFilter, setVerifierFilter] = useState('PorRevisar'); // 'PorRevisar' | 'Todos' | 'VerificadosOK' | 'ConPendientes'
    const [verifierDepFilter, setVerifierDepFilter] = useState('all');
    const [verifierSearch, setVerifierSearch] = useState('');
    const [verifierExpandedExps, setVerifierExpandedExps] = useState([]);
    const [verifierSelectedDocs, setVerifierSelectedDocs] = useState([]);
    const [verifierPreviewDocIds, setVerifierPreviewDocIds] = useState([]);
    const [copiedExpCode, setCopiedExpCode] = useState(null);
    const [verifierToast, setVerifierToast] = useState(null);

    const showVerifierNotice = (msg) => {
        setVerifierToast(msg);
        setTimeout(() => setVerifierToast(null), 2600);
    };

    const fetchVerifierDocuments = async () => {
        setVerifierLoading(true);
        try {
            const res = await axios.get('/api/ades/pending?status=Todos');
            const data = Array.isArray(res.data) ? res.data : [];
            setVerifierDocs(data);
        } catch (err) {
            console.error('Error cargando documentos del Verificador:', err);
        } finally {
            setVerifierLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'verificador') {
            fetchVerifierDocuments();
        }
    }, [activeTab]);

    const openExpedienteInVerificador = (exp) => {
        setActiveTab('verificador');
        if (exp?.expediente_code) {
            setVerifierSearch(exp.expediente_code);
            setVerifierFilter('Todos');
        }
        if (exp?.expediente_id) {
            setVerifierExpandedExps(prev => prev.includes(exp.expediente_id) ? prev : [...prev, exp.expediente_id]);
        }
        fetchVerifierDocuments();
    };

    const handleManualVerifyAction = async ({ action = 'ok', documentIds = [], expedienteIds = [], label = '' }) => {
        try {
            const token = localStorage.getItem('token');
            const isOk = action === 'ok';
            // Actualización optimista inmediata en ambas tablas (Verificador y Gestión de Cargue)
            const applyLocalUpdate = (list) => list.map(d => {
                const hit = (documentIds.length > 0 && documentIds.includes(d.id)) ||
                            (expedienteIds.length > 0 && expedienteIds.includes(d.expediente_id));
                if (!hit) return d;
                return {
                    ...d,
                    status: isOk ? 'Cargado' : 'Pendiente',
                    onbase_verified: isOk ? 2 : 0,
                    onbase_verify_stage: isOk ? 'Verificado Manualmente OK ✅' : null
                };
            });
            setVerifierDocs(prev => applyLocalUpdate(prev));
            setDocuments(prev => applyLocalUpdate(prev));

            await axios.post(
                '/api/ades/manual-verify',
                { action, document_ids: documentIds, expediente_ids: expedienteIds },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (documentIds.length > 0) {
                setVerifierSelectedDocs(prev => prev.filter(id => !documentIds.includes(id)));
            }
            showVerifierNotice(
                isOk
                    ? `✅ OK confirmado${label ? `: ${label}` : ''}`
                    : `↩️ Devuelto a Pendiente para cargue${label ? `: ${label}` : ''}`
            );
            fetchPending();
        } catch (err) {
            alert('Error al actualizar estado de verificación: ' + (err.response?.data?.error || err.message));
            fetchVerifierDocuments();
        }
    };

    const handleCopyExpCode = (code) => {
        if (!code) return;
        try {
            navigator.clipboard.writeText(code);
            setCopiedExpCode(code);
            setTimeout(() => setCopiedExpCode(null), 1800);
        } catch {}
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
        const expedientesSnapshot = [...expedientes];
        const responsiblesSnapshot = [...selectedResponsibles];
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/expedientes/mass', {
                expedientes: expedientesSnapshot,
                assigned_user_ids: responsiblesSnapshot.map(u => u.id)
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
                        let fallbackUserId = null;
                        try {
                           const payload = JSON.parse(atob(token.split('.')[1]));
                           if (payload.role !== 'superadmin') {
                               fallbackUserId = payload.id;
                           }
                        } catch(e) {}

                        const packagesToCreate = [];
                        if (responsiblesSnapshot.length > 0) {
                            for (const resp of responsiblesSnapshot) {
                                packagesToCreate.push({
                                    nombre: responsiblesSnapshot.length > 1 ? `${nombreLote} (${resp.full_name})` : nombreLote,
                                    user_id: resp.id,
                                    expediente_ids: created_ids
                                });
                            }
                        } else {
                            const byAssignedUser = new Map();
                            expedientesSnapshot.forEach((exp, idx) => {
                                const expId = created_ids[idx];
                                if (!expId) return;
                                const targetUid = Number(exp.assigned_user_id) || fallbackUserId;
                                if (!targetUid) return;
                                if (!byAssignedUser.has(targetUid)) byAssignedUser.set(targetUid, []);
                                byAssignedUser.get(targetUid).push(expId);
                            });
                            if (byAssignedUser.size === 0 && fallbackUserId) {
                                packagesToCreate.push({ nombre: nombreLote, user_id: fallbackUserId, expediente_ids: created_ids });
                            } else {
                                for (const [uid, idsForUser] of byAssignedUser.entries()) {
                                    packagesToCreate.push({
                                        nombre: nombreLote,
                                        user_id: uid,
                                        expediente_ids: idsForUser
                                    });
                                }
                            }
                        }

                        for (const pkg of packagesToCreate) {
                            await axios.post('/api/seguimiento/paquetes', {
                                nombre: pkg.nombre,
                                descripcion: 'Lote creado automáticamente desde Cargue AES',
                                user_id: pkg.user_id,
                                expediente_ids: pkg.expediente_ids
                            }, { headers: { Authorization: `Bearer ${token}` } });
                        }
                        
                        if (packagesToCreate.length > 0) {
                            alert(`✅ ¡Guardado exitoso!\nSe creó automáticamente el paquete de seguimiento "${nombreLote}".`);
                        } else {
                            alert('✅ ¡Guardado exitoso en base de datos!');
                        }
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
            const typRes = await axios.get('/api/trd/all-typologies');
            setAllTypologies(typRes.data?.data || []);
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
        const pendingDocIds = exp.documents.filter(d => d.status === 'Pendiente' && !d.is_duplicate_typology).map(d => d.id);
        if (checked) {
            setSelectedDocs(prev => [...new Set([...prev, ...pendingDocIds])]);
        } else {
            setSelectedDocs(prev => prev.filter(id => !pendingDocIds.includes(id)));
        }
    };

    const handleSelectSubserieGroup = (subCode, checked) => {
        const targetSub = String(subCode || '').trim() || 'SIN-SUBSERIE';
        const subDocIds = filteredDocs
            .filter(d => (String(d.subserie || '').trim() || 'SIN-SUBSERIE') === targetSub && d.status === 'Pendiente' && !d.is_duplicate_typology)
            .map(d => d.id);
        if (checked) {
            setSelectedDocs(prev => [...new Set([...prev, ...subDocIds])]);
        } else {
            setSelectedDocs(prev => prev.filter(id => !subDocIds.includes(id)));
        }
    };

    // Group filteredDocs by expediente and sort by Subcategoría Subserie TRD -> Código Expediente -> Orden Tipología TRD
    const groupedExpedientes = [];
    const expGroupMap = {};

    filteredDocs.forEach(doc => {
        const expId = doc.expediente_id || 999999;
        if (!expGroupMap[expId]) {
            const codeSub = String(doc.subserie || '').trim();
            const catMatch = allSubseries.find(s =>
                s.subseries_code === codeSub || s.concatenated_code === codeSub || s.series_code === codeSub
            );
            expGroupMap[expId] = {
                expediente_id: doc.expediente_id,
                expediente_code: doc.expediente_code || '',
                title: doc.title || 'Expediente Sin Título',
                subserie: codeSub,
                subserie_name: doc.subserie_name || doc.series_name || catMatch?.subseries_name || catMatch?.series_name || '',
                box_id: doc.box_id || '',
                storage_type: doc.storage_type || '',
                opening_date: doc.opening_date || '',
                expediente_metadata: doc.expediente_metadata || {},
                has_first_three_typologies: doc.has_first_three_typologies ?? true,
                dependency_name: doc.dependency_name || 'Subdirección de Centro',
                dependency_code: doc.dependency_code || (doc.subserie && doc.subserie.includes('9224.4') ? '9224.4' : (doc.subserie && doc.subserie.includes('9224.2') ? '9224.2' : '9224')),
                target_onbase_user: doc.target_onbase_user || (doc.subserie && doc.subserie.includes('9224.4') ? (orgUsers['9224.4'] || 'EDHERNANDEZM') : (doc.subserie && doc.subserie.includes('9224.2') ? (orgUsers['9224.2'] || 'luepitar') : (orgUsers['9224'] || 'TVILLAMIZARJ'))),
                documents: []
            };
            groupedExpedientes.push(expGroupMap[expId]);
        }
        expGroupMap[expId].documents.push(doc);
    });

    // Ordenar documentos internos de cada expediente por orden de tipología TRD (1ra tipología, 2da tipología...)
    groupedExpedientes.forEach(exp => {
        exp.documents.sort((a, b) => {
            const ordA = Number(a.typology_order ?? 9999);
            const ordB = Number(b.typology_order ?? 9999);
            if (ordA !== ordB) return ordA - ordB;
            return (a.id || 0) - (b.id || 0);
        });
    });

    // Ordenar expedientes por Subcategoría Subserie Documental TRD y luego por Código de Expediente
    groupedExpedientes.sort((a, b) => {
        const subA = a.subserie || 'ZZZZ';
        const subB = b.subserie || 'ZZZZ';
        if (subA !== subB) return subA.localeCompare(subB, undefined, { numeric: true });
        return String(a.expediente_code || '').localeCompare(String(b.expediente_code || ''), undefined, { numeric: true });
    });

    return (
        <div className="cargue-ades-container" style={{ padding: '20px', width: '100%', maxWidth: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ margin: 0, color: '#2e7d32' }}>Cargue AES (OnBase)</h1>
                <div className="tabs" style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => setActiveTab('cargue')}
                        style={{ padding: '10px 20px', borderRadius: '8px 8px 0 0', border: 'none', background: activeTab === 'cargue' ? '#fff' : '#e0e0e0', color: activeTab === 'cargue' ? '#1b5e20' : '#444', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === 'cargue' ? '3px solid #2e7d32' : 'none' }}
                    >
                        🚀 Gestión de Cargue
                    </button>
                    <button
                        onClick={() => setActiveTab('verificador')}
                        style={{ padding: '10px 22px', borderRadius: '8px 8px 0 0', border: 'none', background: activeTab === 'verificador' ? '#e8f5e9' : '#e0e0e0', color: activeTab === 'verificador' ? '#1b5e20' : '#333', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === 'verificador' ? '3px solid #2e7d32' : 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        ✅ Verificador
                    </button>
                    <button
                        onClick={() => setActiveTab('creacion')}
                        style={{ padding: '10px 20px', borderRadius: '8px 8px 0 0', border: 'none', background: activeTab === 'creacion' ? '#fff' : '#e0e0e0', color: activeTab === 'creacion' ? '#1b5e20' : '#444', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === 'creacion' ? '3px solid #2e7d32' : 'none' }}
                    >
                        📁 Creación de Expedientes
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
                                    {[
                                        { id: 'SinCódigo', label: 'Sin Código' },
                                        { id: 'Pendiente', label: 'Pendientes (Con Código)' },
                                        { id: 'Cargado', label: 'Cargados' },
                                        { id: 'Todos', label: 'Todos' }
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setStatusFilter(tab.id)}
                                            style={{
                                                padding: '6px 14px',
                                                border: 'none',
                                                background: statusFilter === tab.id ? '#2e7d32' : 'transparent',
                                                color: statusFilter === tab.id ? '#fff' : '#444',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {tab.label}
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

                            {/* Barra de Filtro por Dependencia Institucional */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', padding: '10px 14px', backgroundColor: '#f9fbf9', borderRadius: '10px', border: '1px solid #e0ede0', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    🏛️ Dependencia TRD:
                                </span>
                                {[
                                    { id: 'all', label: 'Todas las Dependencias', count: documents.length, color: '#37474f', bg: '#eceff1' },
                                    { id: '9224', label: `🏢 Subdirección (9224) • ${orgUsers['9224'] || 'TVILLAMIZARJ'}`, count: documents.filter(d => d.dependency_code === '9224' || (!d.dependency_code && (!d.subserie || !d.subserie.includes('9224.')))).length, color: '#0d47a1', bg: '#e3f2fd' },
                                    { id: '9224.4', label: `🎓 Formación Profesional (9224.4) • ${orgUsers['9224.4'] || 'EDHERNANDEZM'}`, count: documents.filter(d => d.dependency_code === '9224.4' || (d.subserie && d.subserie.includes('9224.4'))).length, color: '#1b5e20', bg: '#e8f5e9' },
                                    { id: '9224.2', label: `📚 Adm. Educativa (9224.2) • ${orgUsers['9224.2'] || 'luepitar'}`, count: documents.filter(d => d.dependency_code === '9224.2' || (d.subserie && d.subserie.includes('9224.2'))).length, color: '#4a148c', bg: '#f3e5f5' }
                                ].map(dep => {
                                    const isSelected = dependencyFilter === dep.id;
                                    return (
                                        <button
                                            key={dep.id}
                                            onClick={() => setDependencyFilter(dep.id)}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '20px',
                                                border: isSelected ? `2px solid ${dep.color}` : '1px solid #d0d7de',
                                                backgroundColor: isSelected ? dep.bg : '#ffffff',
                                                color: isSelected ? dep.color : '#555',
                                                fontWeight: isSelected ? 'bold' : '500',
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                boxShadow: isSelected ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
                                                transition: 'all 0.15s ease-in-out'
                                            }}
                                        >
                                            <span>{dep.label}</span>
                                            <span style={{
                                                padding: '1px 7px',
                                                borderRadius: '10px',
                                                fontSize: '10px',
                                                fontWeight: 'bold',
                                                backgroundColor: isSelected ? dep.color : '#e0e0e0',
                                                color: isSelected ? '#fff' : '#555'
                                            }}>
                                                {dep.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Barra de Subcategorías por Subserie Documental TRD (Ordenado por Oleadas de Tipología + Espera 3m Pre-Verificación) */}
                            {subseriesSummaryList.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px', padding: '10px 14px', backgroundColor: '#f1f8e9', borderRadius: '10px', border: '1px solid #c5e1a5' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1b5e20', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            🗂️ Subcategorías por Subserie Documental TRD ({subseriesSummaryList.length}):
                                        </span>
                                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#00695c', backgroundColor: '#e0f2f1', padding: '3px 10px', borderRadius: '12px', border: '1px solid #80cbc4' }}>
                                            🌊 Cargue Continuo por Oleadas de Tipología (Sin pausas automáticas · Revisión en pestaña "✅ Verificador")
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', maxHeight: '115px', overflowY: 'auto', paddingRight: '4px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setSubserieFilter('all')}
                                            style={{
                                                padding: '5px 11px',
                                                borderRadius: '16px',
                                                border: subserieFilter === 'all' ? '2px solid #2e7d32' : '1px solid #c8e6c9',
                                                backgroundColor: subserieFilter === 'all' ? '#2e7d32' : '#ffffff',
                                                color: subserieFilter === 'all' ? '#ffffff' : '#2e7d32',
                                                fontWeight: 'bold',
                                                fontSize: '11px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Todas las Subseries ({depFilteredDocs.length} docs)
                                        </button>
                                        {subseriesSummaryList.map(subItem => {
                                            const isSubSelected = subserieFilter === subItem.code;
                                            return (
                                                <button
                                                    type="button"
                                                    key={subItem.code}
                                                    onClick={() => setSubserieFilter(isSubSelected ? 'all' : subItem.code)}
                                                    title={`${subItem.code} — ${subItem.name} (${subItem.expIds.size} expediente(s), ${subItem.docCount} documento(s))`}
                                                    style={{
                                                        padding: '5px 10px',
                                                        borderRadius: '16px',
                                                        border: isSubSelected ? '2px solid #1b5e20' : '1px solid #c5e1a5',
                                                        backgroundColor: isSubSelected ? '#c8e6c9' : '#ffffff',
                                                        color: isSubSelected ? '#1b5e20' : '#33691e',
                                                        fontWeight: isSubSelected ? 'bold' : '600',
                                                        fontSize: '11px',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px'
                                                    }}
                                                >
                                                    <span>📁 {subItem.code}</span>
                                                    {subItem.name && (
                                                        <span style={{ maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'normal', opacity: 0.9 }}>
                                                            · {subItem.name}
                                                        </span>
                                                    )}
                                                    <span style={{
                                                        padding: '1px 6px',
                                                        borderRadius: '10px',
                                                        fontSize: '10px',
                                                        fontWeight: 'bold',
                                                        backgroundColor: isSubSelected ? '#1b5e20' : '#e8f5e9',
                                                        color: isSubSelected ? '#fff' : '#1b5e20'
                                                    }}>
                                                        {subItem.expIds.size} exp / {subItem.docCount} docs
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#e8f5e9', textAlign: 'left', borderBottom: '2px solid #2e7d32' }}>
                                            <th style={{ padding: '12px', width: '70px', textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    onChange={(e) => {
                                                        const pendingIds = filteredDocs.filter(d => d.status === 'Pendiente' && !d.is_duplicate_typology).map(d => d.id);
                                                        if (e.target.checked) setSelectedDocs(pendingIds);
                                                        else setSelectedDocs([]);
                                                    }}
                                                    checked={filteredDocs.filter(d => d.status === 'Pendiente' && !d.is_duplicate_typology).length > 0 && selectedDocs.length === filteredDocs.filter(d => d.status === 'Pendiente' && !d.is_duplicate_typology).length}
                                                    style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                                                />
                                            </th>
                                            <th style={{ padding: '12px', width: '140px' }}>Código Expediente</th>
                                            <th style={{ padding: '12px' }}>Detalle de Expediente</th>
                                            <th style={{ padding: '12px', width: '130px' }}>Cant. Documentos</th>
                                            <th style={{ padding: '12px', width: '140px' }}>Subserie TRD</th>
                                            <th style={{ padding: '12px', width: '220px' }}>Dependencia & Usuario OnBase</th>
                                            <th style={{ padding: '12px', width: '200px', textAlign: 'center' }}>Seguimiento / Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupedExpedientes.length > 0 ? groupedExpedientes.map((exp, expIdx) => {
                                            const isExpanded = expandedExpedientes.includes(exp.expediente_id);
                                            const firstDoc = exp.documents[0];
                                            const firstDocId = firstDoc?.id;
                                            const pendingDocs = exp.documents.filter(d => d.status === 'Pendiente' && !d.is_duplicate_typology);
                                            const isAllSelected = pendingDocs.length > 0 && pendingDocs.every(d => selectedDocsSet.has(d.id));
                                            const isSomeSelected = !isAllSelected && pendingDocs.some(d => selectedDocsSet.has(d.id));

                                            // Detectar si inicia una nueva Subcategoría de Subserie Documental TRD
                                            const currentSubKey = exp.subserie || 'SIN-SUBSERIE';
                                            const prevSubKey = expIdx > 0 ? (groupedExpedientes[expIdx - 1].subserie || 'SIN-SUBSERIE') : null;
                                            const isFirstOfSubserie = expIdx === 0 || currentSubKey !== prevSubKey;

                                            const subserieExps = isFirstOfSubserie
                                                ? groupedExpedientes.filter(g => (g.subserie || 'SIN-SUBSERIE') === currentSubKey)
                                                : [];
                                            const subseriePendingDocIds = isFirstOfSubserie
                                                ? subserieExps.flatMap(g => g.documents.filter(d => d.status === 'Pendiente' && !d.is_duplicate_typology).map(d => d.id))
                                                : [];
                                            const isSubAllSelected = subseriePendingDocIds.length > 0 && subseriePendingDocIds.every(id => selectedDocsSet.has(id));
                                            const maxWavesInSub = isFirstOfSubserie
                                                ? subserieExps.reduce((mx, g) => Math.max(mx, g.documents.filter(d => !d.is_duplicate_typology).length), 0)
                                                : 0;

                                            return (
                                                <Fragment key={exp.expediente_id || Math.random()}>
                                                    {/* Cabecera de Subcategoría por Subserie Documental TRD */}
                                                    {isFirstOfSubserie && (
                                                        <tr style={{ backgroundColor: '#e8f5e9', borderTop: '2px solid #2e7d32', borderBottom: '1px solid #a5d6a7' }}>
                                                            <td colSpan="7" style={{ padding: '8px 14px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isSubAllSelected}
                                                                            disabled={subseriePendingDocIds.length === 0}
                                                                            onChange={(e) => handleSelectSubserieGroup(currentSubKey, e.target.checked)}
                                                                            title="Seleccionar todos los expedientes pendientes de esta Subserie Documental"
                                                                            style={{ transform: 'scale(1.2)', cursor: subseriePendingDocIds.length === 0 ? 'not-allowed' : 'pointer' }}
                                                                        />
                                                                        <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#1b5e20' }}>
                                                                            🗂️ SUBSERIE DOCUMENTAL: {currentSubKey} {exp.subserie_name ? `— ${exp.subserie_name}` : ''}
                                                                        </span>
                                                                        <span style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: '#ffffff', color: '#2e7d32', padding: '2px 9px', borderRadius: '12px', border: '1px solid #81c784' }}>
                                                                            📁 {subserieExps.length} expediente(s) · 🌊 {maxWavesInSub} oleada(s) de tipología
                                                                        </span>
                                                                    </div>
                                                                    <span style={{ fontSize: '11px', color: '#004d40', fontWeight: '600' }}>
                                                                        🔄 Orden continuo: Tipología #1 en los {subserieExps.length} exp. ➡️ Tipología #2 ➡️ Tipología #3... (Revisión en pestaña Verificador)
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
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
                                                        <td style={{ padding: '12px' }}>
                                                            {(() => {
                                                                const b = getDepBadge(exp.dependency_code, exp.target_onbase_user);
                                                                return (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                        <span style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            padding: '3px 8px',
                                                                            borderRadius: '6px',
                                                                            fontSize: '11px',
                                                                            fontWeight: 'bold',
                                                                            backgroundColor: b.bg,
                                                                            color: b.color,
                                                                            border: `1px solid ${b.border}`,
                                                                            width: 'fit-content'
                                                                        }}>
                                                                            <span>{b.icon}</span>
                                                                            <span>{b.shortLabel}</span>
                                                                        </span>
                                                                        <div style={{ fontSize: '11px', color: '#555', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            OnBase: <strong style={{ color: '#111', backgroundColor: '#f0f0f0', padding: '1px 5px', borderRadius: '4px' }}>{exp.target_onbase_user || b.user}</strong>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                                            {(() => {
                                                                const verified100Count = exp.documents.filter(d => Number(d.onbase_verified) === 2).length;
                                                                const verified50Count = exp.documents.filter(d => Number(d.onbase_verified) === 1).length;
                                                                const missingVerifiedCount = exp.documents.filter(d => Number(d.onbase_verified) === -1).length;
                                                                const allVerified100 = exp.documents.length > 0 && verified100Count === exp.documents.length;
                                                                const has50Checkpoint = verified50Count > 0 || verified100Count > 0;
                                                                return (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                            <span style={{
                                                                                padding: '3px 9px',
                                                                                borderRadius: '10px',
                                                                                fontSize: '11px',
                                                                                fontWeight: 'bold',
                                                                                backgroundColor: pendingDocs.length === 0 ? '#e8f5e9' : '#fff3e0',
                                                                                color: pendingDocs.length === 0 ? '#2e7d32' : '#ef6c00',
                                                                                border: `1px solid ${pendingDocs.length === 0 ? '#c8e6c9' : '#ffe0b2'}`
                                                                            }}>
                                                                                {pendingDocs.length === 0 ? 'Cargado Local' : `${pendingDocs.length} pendiente(s)`}
                                                                            </span>
                                                                            {allVerified100 ? (
                                                                                <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#e0f2f1', color: '#00695c', border: '1px solid #80cbc4' }} title="Verificado 100% en OnBase mediante Consulta Personalizada SGDEA Expediente">
                                                                                    🛡️ Verificado 100% OnBase ({verified100Count}/{exp.documents.length})
                                                                                </span>
                                                                            ) : missingVerifiedCount > 0 ? (
                                                                                <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a' }}>
                                                                                    ⚠️ {missingVerifiedCount} faltante(s) en OnBase
                                                                                </span>
                                                                            ) : has50Checkpoint ? (
                                                                                <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#e3f2fd', color: '#0d47a1', border: '1px solid #90caf9' }}>
                                                                                    ⏳ Verificado 50% ({verified100Count + verified50Count}/{exp.documents.length})
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openExpedienteInVerificador(exp)}
                                                                                title="Abrir este expediente en la pestaña Verificador para revisar sus archivos y dar el OK"
                                                                                style={{
                                                                                    padding: '5px 9px',
                                                                                    background: '#e0f7fa',
                                                                                    border: '1px solid #4dd0e1',
                                                                                    color: '#006064',
                                                                                    borderRadius: '6px',
                                                                                    cursor: 'pointer',
                                                                                    fontSize: '11px',
                                                                                    fontWeight: 'bold',
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '4px'
                                                                                }}
                                                                            >
                                                                                🔍 Ir a Verificador
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleManualVerifyAction({
                                                                                    action: 'ok',
                                                                                    expedienteIds: [exp.expediente_id],
                                                                                    label: `Expediente ${exp.expediente_code || exp.title}`
                                                                                })}
                                                                                title="Dar OK a todos los documentos de este expediente (confirmar como Cargados)"
                                                                                style={{ 
                                                                                    padding: '5px 10px', 
                                                                                    background: '#2e7d32', 
                                                                                    border: '1px solid #1b5e20', 
                                                                                    color: '#fff',
                                                                                    borderRadius: '6px', 
                                                                                    cursor: 'pointer', 
                                                                                    fontSize: '11px', 
                                                                                    fontWeight: 'bold',
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '4px'
                                                                                }}
                                                                            >
                                                                                <CheckCircle size={13} /> Dar OK
                                                                            </button>
                                                                            <button
                                                                                onClick={() => toggleExpediente(exp.expediente_id)}
                                                                                style={{ 
                                                                                    padding: '5px 10px', 
                                                                                    background: '#f5f5f5', 
                                                                                    border: '1px solid #ccc', 
                                                                                    borderRadius: '6px', 
                                                                                    cursor: 'pointer', 
                                                                                    fontSize: '11px', 
                                                                                    fontWeight: 'bold',
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '4px'
                                                                                }}
                                                                            >
                                                                                {isExpanded ? 'Ocultar' : 'Ver Documentos'}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                    </tr>

                                                    {/* Child Row (Expanded Documents List) */}
                                                    {isExpanded && (
                                                        <tr style={{ backgroundColor: '#fafafa' }}>
                                                            <td colSpan="7" style={{ padding: '15px 15px 15px 50px', borderTop: '1px dashed #c8e6c9', borderBottom: '1px solid #e0e0e0' }}>
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
                                                                                <th style={{ padding: '8px 12px', width: '160px' }}>Usuario OnBase</th>
                                                                                <th style={{ padding: '8px 12px', width: '110px' }}>Fecha</th>
                                                                                <th style={{ padding: '8px 12px', width: '110px' }}>Estado</th>
                                                                                <th style={{ padding: '8px 12px', width: '160px', textAlign: 'center' }}>Acciones</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {exp.documents.map((doc, docIdx) => {
                                                                                const docBadge = getDepBadge(doc.dependency_code || exp.dependency_code, doc.target_onbase_user || exp.target_onbase_user);
                                                                                const isDupTyp = !!doc.is_duplicate_typology;
                                                                                return (
                                                                                <Fragment key={doc.id}>
                                                                                <tr style={{ borderBottom: '1px solid #f0f0f0', backgroundColor: inlinePreviewDocIds.includes(doc.id) ? '#e3f2fd' : (selectedDocsSet.has(doc.id) ? '#f1f8e9' : (isDupTyp ? '#fff8e1' : 'transparent')) }}>
                                                                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={selectedDocsSet.has(doc.id)}
                                                                                            disabled={doc.status === 'Cargado' || isDupTyp}
                                                                                            onChange={(e) => {
                                                                                                if (e.target.checked) setSelectedDocs(prev => [...prev, doc.id]);
                                                                                                else setSelectedDocs(prev => prev.filter(id => id !== doc.id));
                                                                                            }}
                                                                                            style={{ transform: 'scale(1.1)', cursor: (doc.status === 'Cargado' || isDupTyp) ? 'not-allowed' : 'pointer' }}
                                                                                        />
                                                                                    </td>
                                                                                    <td style={{ padding: '8px 12px' }}>
                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
                                                                                            <FileText size={14} color="#1976d2" />
                                                                                            <span onClick={() => handleView(doc)} title="Clic para ver/ocultar vista previa debajo" style={{ wordBreak: 'break-all', cursor: 'pointer', color: inlinePreviewDocIds.includes(doc.id) ? '#1565c0' : 'inherit', textDecoration: inlinePreviewDocIds.includes(doc.id) ? 'underline' : 'none' }}>{doc.filename}</span>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td style={{ padding: '8px 12px', color: '#555' }}>
                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                                            <span style={{ padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#e0f2f1', color: '#00695c', border: '1px solid #80cbc4' }}>
                                                                                                🌊 Oleada #{docIdx + 1}
                                                                                            </span>
                                                                                            <span>{doc.typology_name}</span>
                                                                                            {isDupTyp && (
                                                                                                <span style={{ padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#ffecb3', color: '#e65100', border: '1px solid #ffb300' }} title="Tipología repetida dentro del mismo expediente: se bloquea automáticamente para evitar duplicados en OnBase">
                                                                                                    🛡️ Duplicado omitido
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    </td>
                                                                                    <td style={{ padding: '8px 12px' }}>
                                                                                        <span style={{
                                                                                            display: 'inline-flex',
                                                                                            alignItems: 'center',
                                                                                            gap: '4px',
                                                                                            padding: '2px 7px',
                                                                                            borderRadius: '4px',
                                                                                            fontSize: '11px',
                                                                                            fontWeight: 'bold',
                                                                                            backgroundColor: docBadge.bg,
                                                                                            color: docBadge.color,
                                                                                            border: `1px solid ${docBadge.border}`
                                                                                        }}>
                                                                                            {docBadge.icon} {doc.target_onbase_user || docBadge.user}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td style={{ padding: '8px 12px', color: '#666' }}>
                                                                                        {new Date(doc.document_date).toLocaleDateString()}
                                                                                    </td>
                                                                                    <td style={{ padding: '8px 12px' }}>
                                                                                        {(() => {
                                                                                            const liveDoc = (liveVerification?.expedienteCode && String(liveVerification.expedienteCode).trim() === String(exp.expediente_code).trim() && Array.isArray(liveVerification.documents))
                                                                                                ? liveVerification.documents.find(ld => Number(ld.id) === Number(doc.id))
                                                                                                : null;
                                                                                            const isVerifyingNow = (liveDoc && liveDoc.verifyState === 'verificando') || (verifyingExpCode === exp.expediente_code && liveVerification?.status === 'VERIFICANDO' && !liveDoc);
                                                                                            const isVerifiedOk = (liveDoc && liveDoc.verifyState === 'cargado') || Number(doc.onbase_verified) > 0;
                                                                                            const isVerifiedMissing = (liveDoc && liveDoc.verifyState === 'no_cargado') || Number(doc.onbase_verified) === -1;
                                                                                            return (
                                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                                                                                                    <span style={{
                                                                                                        padding: '2px 8px',
                                                                                                        borderRadius: '10px',
                                                                                                        fontSize: '11px',
                                                                                                        fontWeight: 'bold',
                                                                                                        backgroundColor: (doc.status === 'Cargado' || isVerifiedOk) ? '#e8f5e9' : '#fff3e0',
                                                                                                        color: (doc.status === 'Cargado' || isVerifiedOk) ? '#2e7d32' : '#ef6c00',
                                                                                                        border: `1px solid ${(doc.status === 'Cargado' || isVerifiedOk) ? '#c8e6c9' : '#ffe0b2'}`
                                                                                                    }}>
                                                                                                        {(doc.status === 'Cargado' || isVerifiedOk) ? 'Cargado' : doc.status}
                                                                                                    </span>
                                                                                                    {isVerifyingNow && (
                                                                                                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#006064', backgroundColor: '#e0f7fa', padding: '2px 7px', borderRadius: '8px', border: '1px solid #4dd0e1', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                                                            🔄 Verificando en OnBase...
                                                                                                        </span>
                                                                                                    )}
                                                                                                    {!isVerifyingNow && isVerifiedOk && (
                                                                                                        <span title={liveDoc?.matchedRow || doc.onbase_verify_note || 'Confirmado en SGDEA Expediente'} style={{ fontSize: '10px', fontWeight: 'bold', color: '#00695c', backgroundColor: '#e0f2f1', padding: '2px 7px', borderRadius: '8px', border: '1px solid #80cbc4' }}>
                                                                                                            ✅ SÍ CARGADO EN AES ({doc.onbase_verify_stage || 'OnBase OK'})
                                                                                                        </span>
                                                                                                    )}
                                                                                                    {!isVerifyingNow && isVerifiedMissing && (
                                                                                                        <span title={doc.onbase_verify_note || 'No aparece en Consultas personalizadas -> SGDEA Expediente'} style={{ fontSize: '10px', fontWeight: 'bold', color: '#c62828', backgroundColor: '#ffebee', padding: '2px 7px', borderRadius: '8px', border: '1px solid #ef9a9a' }}>
                                                                                                            ❌ NO CARGADO EN AES
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                            );
                                                                                        })()}
                                                                                    </td>
                                                                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                                                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                                                                            <button
                                                                                                onClick={() => handleView(doc)}
                                                                                                title="Visualizar Archivo"
                                                                                                style={{ padding: '5px', background: inlinePreviewDocIds.includes(doc.id) ? '#2e7d32' : '#e8f5e9', border: '1px solid #2e7d32', borderRadius: '4px', color: inlinePreviewDocIds.includes(doc.id) ? '#fff' : '#2e7d32', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                                                            >
                                                                                                <Eye size={13} />
                                                                                            </button>
                                                                                            {doc.status === 'Cargado' ? (
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
                                                                                            ) : (
                                                                                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                                                                    <button
                                                                                                        onClick={() => handleMarkSingleDocumentAsCargado(doc)}
                                                                                                        title="Marcar este documento como Cargado en AES (OnBase)"
                                                                                                        style={{ padding: '3px 8px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '4px', color: '#1b5e20', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px' }}
                                                                                                    >
                                                                                                        <CheckCircle size={11} /> Cargado
                                                                                                    </button>
                                                                                                    <button
                                                                                                        onClick={() => handleConfig(doc)}
                                                                                                        className="btn-config"
                                                                                                        title="Formulario de Configuración"
                                                                                                        style={{ padding: '3px 8px', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '4px', color: '#1976d2', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px' }}
                                                                                                    >
                                                                                                        <SettingsIcon size={12} /> Config
                                                                                                    </button>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                                {inlinePreviewDocIds.includes(doc.id) && (
                                                                                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #90caf9' }}>
                                                                                        <td colSpan="7" style={{ padding: '12px 16px' }}>
                                                                                            <div style={{ border: '1px solid #90caf9', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 4px 12px rgba(25, 118, 210, 0.12)' }}>
                                                                                                {/* Barra superior de Vista Previa y Edición Rápida de Tipología */}
                                                                                                <div style={{ background: 'linear-gradient(90deg, #e3f2fd 0%, #f1f8e9 100%)', padding: '10px 14px', borderBottom: '1px solid #bbdefb', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                                                                                                        <span style={{ fontWeight: 'bold', color: '#0d47a1', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                                                            <Eye size={15} /> Vista Previa: <span style={{ color: '#1b5e20' }}>{doc.filename}</span>
                                                                                                        </span>
                                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginLeft: '8px', flex: 1, minWidth: '320px' }}>
                                                                                                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>Tipología TRD:</span>
                                                                                                            <select
                                                                                                                value=""
                                                                                                                onChange={(e) => {
                                                                                                                    if (e.target.value) {
                                                                                                                        setEditingTypology(prev => ({ ...prev, [doc.id]: e.target.value }));
                                                                                                                    }
                                                                                                                }}
                                                                                                                style={{ padding: '5px 8px', borderRadius: '5px', border: '1px solid #1976d2', fontSize: '11px', backgroundColor: '#fff', color: '#0d47a1', fontWeight: '600', maxWidth: '250px', cursor: 'pointer' }}
                                                                                                            >
                                                                                                                <option value="">📋 Elegir de lista TRD...</option>
                                                                                                                {getTypologiesForDoc(doc).map(t => (
                                                                                                                    <option key={t.id} value={t.name}>
                                                                                                                        {t.trd_order ? `${String(t.trd_order).padStart(2, '0')}. ` : ''}{t.name}{t.stage ? ` (${t.stage})` : ''}
                                                                                                                    </option>
                                                                                                                ))}
                                                                                                            </select>
                                                                                                            <input
                                                                                                                type="text"
                                                                                                                value={editingTypology[doc.id] !== undefined ? editingTypology[doc.id] : (doc.typology_name || '')}
                                                                                                                onChange={(e) => setEditingTypology(prev => ({ ...prev, [doc.id]: e.target.value }))}
                                                                                                                placeholder="Escriba o seleccione la tipología..."
                                                                                                                style={{ flex: 1, minWidth: '200px', padding: '5px 8px', borderRadius: '5px', border: '1px solid #39a900', fontSize: '11px', fontWeight: 'bold', color: '#1b5e20', backgroundColor: '#fff' }}
                                                                                                            />
                                                                                                            <button
                                                                                                                onClick={() => saveDocTypology(doc.id)}
                                                                                                                disabled={savingTypologyId === doc.id}
                                                                                                                title="Guardar cambio de Tipología"
                                                                                                                style={{ padding: '5px 10px', background: '#39a900', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                                                            >
                                                                                                                <Save size={12} /> {savingTypologyId === doc.id ? 'Guardando...' : 'Guardar Tipología'}
                                                                                                            </button>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                                        <button
                                                                                                            onClick={() => window.open(`/api/ades/view/${doc.id}`, '_blank')}
                                                                                                            title="Abrir documento en pestaña aparte"
                                                                                                            style={{ padding: '4px 8px', background: '#fff', color: '#1976d2', border: '1px solid #90caf9', borderRadius: '5px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                                                        >
                                                                                                            <Maximize2 size={11} /> Pestaña
                                                                                                        </button>
                                                                                                        <button
                                                                                                            onClick={() => handleView(doc)}
                                                                                                            title="Cerrar vista previa"
                                                                                                            style={{ padding: '4px 8px', background: '#ffebee', color: '#c62828', border: '1px solid #ffcdd2', borderRadius: '5px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                                                        >
                                                                                                            <X size={12} /> Cerrar Vista Previa
                                                                                                        </button>
                                                                                                    </div>
                                                                                                </div>
                                                                                                {/* Visor PDF embebido debajo del documento */}
                                                                                                <iframe
                                                                                                    src={`/api/ades/view/${doc.id}#toolbar=1&navpanes=0&view=FitH`}
                                                                                                    title={`Vista previa ${doc.filename}`}
                                                                                                    style={{ width: '100%', height: '580px', border: 'none', display: 'block', backgroundColor: '#525659' }}
                                                                                                />
                                                                                            </div>
                                                                                        </td>
                                                                                    </tr>
                                                                                )}
                                                                                </Fragment>
                                                                                );
                                                                            })}
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
                                                <td colSpan="7" style={{ padding: '60px', textAlign: 'center' }}>
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

                            {filteredDocs.length > 0 && (() => {
                                const selectedDocsList = documents.filter(d => selectedDocsSet.has(d.id) && d.status === 'Pendiente');
                                const subCount = selectedDocsList.filter(d => getDocBotKey(d) === '9224').length;
                                const formCount = selectedDocsList.filter(d => getDocBotKey(d) === '9224.4').length;
                                const adminCount = selectedDocsList.filter(d => getDocBotKey(d) === '9224.2').length;

                                const botCards = [
                                    { key: '9224', icon: '🏢', title: 'Bot 1 · Subdirección', code: '9224', user: orgUsers['9224'] || 'TVILLAMIZARJ', count: subCount, bg: '#e3f2fd', border: '#90caf9', color: '#0d47a1', isVerifier: false },
                                    { key: '9224.4', icon: '🎓', title: 'Bot 2 · Formación', code: '9224.4', user: orgUsers['9224.4'] || 'EDHERNANDEZM', count: formCount, bg: '#e8f5e9', border: '#a5d6a7', color: '#1b5e20', isVerifier: false },
                                    { key: '9224.2', icon: '📚', title: 'Bot 3 · Adm. Educativa', code: '9224.2', user: orgUsers['9224.2'] || 'luepitar', count: adminCount, bg: '#f3e5f5', border: '#ce93d8', color: '#4a148c', isVerifier: false }
                                ];

                                return (
                                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {/* Acceso Rápido a la Pestaña Verificador Manual */}
                                    <div style={{ backgroundColor: '#e8f5e9', border: '2px solid #2e7d32', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1b5e20' }}>
                                                ✅ Verificación Manual de Expedientes y Documentos:
                                            </span>
                                            <span style={{ fontSize: '12px', color: '#2e7d32' }}>
                                                Los Bots cargan de forma continua sin interrupciones. Revise los archivos y dé el <strong>OK</strong> en la pestaña <strong>Verificador</strong>.
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('verificador')}
                                            style={{
                                                padding: '8px 16px',
                                                backgroundColor: '#2e7d32',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                boxShadow: '0 2px 6px rgba(46,125,50,0.25)'
                                            }}
                                        >
                                            ✅ Abrir Pestaña Verificador ({groupedExpedientes.length} expedientes)
                                        </button>
                                    </div>

                                    {/* Panel de Control de 3 Bots Cargadores Independientes */}
                                    <div style={{ backgroundColor: '#f5faf5', border: '1px solid #c8e6c9', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1b5e20' }}>
                                                    🤖 Arquitectura 3 Bots Cargadores en Paralelo (Sin pausas automáticas):
                                                </span>
                                                <select
                                                    value={selectedOnBaseUser}
                                                    onChange={(e) => setSelectedOnBaseUser(e.target.value)}
                                                    style={{
                                                        padding: '6px 12px',
                                                        borderRadius: '6px',
                                                        border: '2px solid #39a900',
                                                        backgroundColor: '#fff',
                                                        color: '#1b5e20',
                                                        fontWeight: 'bold',
                                                        fontSize: '12px',
                                                        outline: 'none',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <option value="auto">⚡ Simultáneo Automático por Dependencia TRD (Continuo)</option>
                                                    <option value={orgUsers['9224'] || 'TVILLAMIZARJ'}>🏢 Forzar todo por Bot 1 · Subdirección ({orgUsers['9224'] || 'TVILLAMIZARJ'})</option>
                                                    <option value={orgUsers['9224.4'] || 'EDHERNANDEZM'}>🎓 Forzar todo por Bot 2 · Formación ({orgUsers['9224.4'] || 'EDHERNANDEZM'})</option>
                                                    <option value={orgUsers['9224.2'] || 'luepitar'}>📚 Forzar todo por Bot 3 · Adm. Educativa ({orgUsers['9224.2'] || 'luepitar'})</option>
                                                </select>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => { setMosaicView(true); setIsMonitorExpanded(true); }}
                                                    style={{
                                                        padding: '6px 12px',
                                                        borderRadius: '6px',
                                                        border: '1px solid #1976d2',
                                                        backgroundColor: '#e3f2fd',
                                                        color: '#0d47a1',
                                                        fontWeight: 'bold',
                                                        fontSize: '12px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    <Monitor size={14} /> Ver Mosaico de Bots en Vivo
                                                </button>
                                            </div>
                                        </div>

                                        {/* Tarjetas de estado y lanzamiento individual por cada uno de los 4 Bots */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px' }}>
                                            {botCards.map(b => {
                                                const st = botsStatus[b.key] || {};
                                                const isFocused = activeMonitorBot === b.key;
                                                const stuckSec = st.stepStuckSeconds || 0;
                                                return (
                                                    <div
                                                        key={b.key}
                                                        onClick={() => setActiveMonitorBot(b.key)}
                                                        style={{
                                                            backgroundColor: st.isBlocked ? '#fff8f8' : '#fff',
                                                            border: st.isBlocked ? '2px solid #d32f2f' : (isFocused ? `2px solid ${b.color}` : `1px solid ${b.border}`),
                                                            borderRadius: '8px',
                                                            padding: '10px 12px',
                                                            cursor: 'pointer',
                                                            boxShadow: isFocused ? '0 3px 10px rgba(0,0,0,0.08)' : 'none',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '6px'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ fontWeight: 'bold', fontSize: '12px', color: b.color }}>
                                                                {b.icon} {b.title}
                                                            </span>
                                                            <span style={{
                                                                fontSize: '10px',
                                                                fontWeight: 'bold',
                                                                padding: '2px 7px',
                                                                borderRadius: '10px',
                                                                backgroundColor: st.isBlocked ? '#ffcdd2' : (st.waitingForVerifier ? '#fff9c4' : (st.running ? '#c8e6c9' : (st.completed ? '#e3f2fd' : '#f5f5f5'))),
                                                                color: st.isBlocked ? '#b71c1c' : (st.waitingForVerifier ? '#f57f17' : (st.running ? '#1b5e20' : (st.completed ? '#0d47a1' : '#666')))
                                                            }}>
                                                                {st.isBlocked
                                                                    ? `🚨 Bloqueado (${stuckSec}s)`
                                                                    : st.waitingForVerifier
                                                                        ? `⏸️ Esperando Verificador`
                                                                        : st.running
                                                                            ? (b.isVerifier ? `🔍 Verificando (${st.processedDocs || 0}/${st.totalDocs || 0})` : `🟢 Activo (${st.processedDocs || 0}/${st.totalDocs || 0})`)
                                                                            : (st.completed ? `✅ Listo (${st.processedDocs || 0}/${st.totalDocs || 0})` : '⏸️ En espera')}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#555' }}>
                                                            <span>Usuario: <strong>{st.onbaseUser || b.user}</strong></span>
                                                            <span style={{ backgroundColor: b.bg, color: b.color, padding: '1px 7px', borderRadius: '10px', fontWeight: 'bold' }}>
                                                                {b.isVerifier ? `Expedientes: ${b.count}` : `Seleccionados: ${b.count}`}
                                                            </span>
                                                        </div>
                                                        {(st.running || b.isVerifier) && st.currentStep && (
                                                            <div style={{ fontSize: '10px', color: st.isBlocked ? '#c62828' : '#006064', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                ⚡ {st.currentStep}
                                                            </div>
                                                        )}
                                                        <div style={{ display: 'flex', gap: '5px', marginTop: '2px', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                                                            {b.isVerifier ? (
                                                                st.running ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => killAutomation('VERIFICADOR')}
                                                                        style={{ flex: 1, padding: '5px 8px', backgroundColor: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                                                    >
                                                                        🛑 Detener Verificador
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        disabled={verifyingExpCode !== null}
                                                                        onClick={() => handleVerifyExpedientesOnBase(null, true)}
                                                                        style={{
                                                                            flex: 1,
                                                                            padding: '5px 8px',
                                                                            backgroundColor: '#00838f',
                                                                            color: '#fff',
                                                                            border: 'none',
                                                                            borderRadius: '6px',
                                                                            fontSize: '11px',
                                                                            fontWeight: 'bold',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        🔍 Verificar en OnBase Ahora
                                                                    </button>
                                                                )
                                                            ) : st.running ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => killAutomation(b.key)}
                                                                    style={{ flex: 1, padding: '5px 8px', backgroundColor: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                                                >
                                                                    🛑 Detener
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    disabled={b.count === 0 || launchingBot}
                                                                    onClick={() => handleRunAutomation(null, b.key)}
                                                                    style={{
                                                                        flex: 1,
                                                                        padding: '5px 8px',
                                                                        backgroundColor: (b.count > 0 && !launchingBot) ? b.color : '#e0e0e0',
                                                                        color: (b.count > 0 && !launchingBot) ? '#fff' : '#888',
                                                                        border: 'none',
                                                                        borderRadius: '6px',
                                                                        fontSize: '11px',
                                                                        fontWeight: 'bold',
                                                                        cursor: (b.count > 0 && !launchingBot) ? 'pointer' : 'not-allowed'
                                                                    }}
                                                                >
                                                                    {launchingBot ? '⏳ Iniciando...' : `▶️ Lanzar Bot (${b.count})`}
                                                                </button>
                                                            )}
                                                            {st.waitingForVerifier && !b.isVerifier && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSkipVerifierWait(b.key)}
                                                                    title="Saltar la espera de 3 minutos de la oleada y verificar inmediatamente en OnBase"
                                                                    style={{ padding: '5px 8px', backgroundColor: '#e0f7fa', color: '#006064', border: '1px solid #00acc1', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                                                >
                                                                    ⚡ Verificar Ya (Saltar 3m)
                                                                </button>
                                                            )}
                                                            {(st.running || st.isBlocked) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUnlockBot(b.key)}
                                                                    disabled={unlockingBotKey === b.key}
                                                                    title="Destrabar OnBase si se quedó pensando o bloqueado en un modal"
                                                                    style={{ padding: '5px 7px', backgroundColor: '#fff3e0', color: '#e65100', border: '1px solid #ffb74d', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                                                >
                                                                    🔓 {unlockingBotKey === b.key ? '...' : 'Destrabar'}
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => { setActiveMonitorBot(b.key); setMosaicView(false); }}
                                                                style={{ padding: '5px 8px', backgroundColor: isFocused ? b.bg : '#f5f5f5', color: isFocused ? b.color : '#555', border: `1px solid ${isFocused ? b.border : '#ddd'}`, borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                                                title="Ver este Bot en el monitor lateral"
                                                            >
                                                                👁️ Monitor
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        {selectedDocs.length > 0 && (
                                            <button
                                                className="btn"
                                                onClick={() => setSelectedDocs([])}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '12px 16px',
                                                    backgroundColor: '#f5f5f5',
                                                    color: '#555',
                                                    border: '1px solid #ccc',
                                                    borderRadius: '8px',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                title="Deseleccionar todos los documentos"
                                            >
                                                <X size={16} /> Limpiar
                                            </button>
                                        )}
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => handleRunAutomation()}
                                            disabled={selectedDocs.length === 0 || launchingBot}
                                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', opacity: (selectedDocs.length === 0 || launchingBot) ? 0.65 : 1 }}
                                        >
                                            <Play size={18} />
                                            {launchingBot
                                                ? '⏳ Validando e Iniciando Bots...'
                                                : selectedOnBaseUser === 'auto'
                                                    ? `🚀 Iniciar Cargue Simultáneo con los 3 Bots (${selectedDocs.length} Docs seleccionados)`
                                                    : `Iniciar Cargue AES (${selectedDocs.length} de ${filteredDocs.filter(d => d.status === 'Pendiente').length} Docs seleccionados)`}
                                        </button>

                                        <button
                                            className="btn"
                                            onClick={handleMarkSelectedAsCargado}
                                            disabled={selectedDocs.length === 0}
                                            style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center', 
                                                gap: '8px', 
                                                padding: '12px 20px', 
                                                backgroundColor: selectedDocs.length > 0 ? '#2e7d32' : '#cccccc',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontWeight: 'bold',
                                                cursor: selectedDocs.length > 0 ? 'pointer' : 'not-allowed',
                                                whiteSpace: 'nowrap'
                                            }}
                                            title="Marcar manualmente los documentos seleccionados como cargados en AES"
                                        >
                                            <CheckSquare size={18} /> Marcar Seleccionados como Cargados ({selectedDocs.length})
                                        </button>
                                    </div>
                                </div>
                                );
                            })()}
                        </div>
                    </div>

                    <div style={{ width: '480px' }}>
                        <div className="card" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '12px', borderLeft: '4px solid #39a900' }}>
                            <h3 style={{ marginTop: 0, fontSize: '16px', borderBottom: '1px solid #eee', paddingBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Monitor size={18} /> Monitoreo en Vivo (4 Bots)
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {(activeBotState.running || activeBotState.isBlocked) && (
                                        <button
                                            onClick={() => handleUnlockBot(activeMonitorBot)}
                                            disabled={unlockingBotKey === activeMonitorBot}
                                            style={{
                                                background: '#ef6c00',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '4px 8px',
                                                cursor: 'pointer',
                                                fontSize: '11px',
                                                fontWeight: 'bold'
                                            }}
                                            title="Destrabar OnBase en este Bot (cierra alertas/modales y reactiva)"
                                        >
                                            🔓 Destrabar
                                        </button>
                                    )}
                                    {activeBotState.running && (
                                        <button
                                            onClick={() => killAutomation(activeMonitorBot)}
                                            style={{
                                                background: '#d32f2f',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '4px 8px',
                                                cursor: 'pointer',
                                                fontSize: '11px',
                                                fontWeight: 'bold'
                                            }}
                                            title="Detener solo este Bot"
                                        >
                                            🛑 Detener Bot
                                        </button>
                                    )}
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
                                        <Maximize2 size={13} /> Ampliar / Mosaico
                                    </button>
                                </div>
                            </h3>

                            {/* Pestañas selectoras de los 4 Bots en el Monitor en Vivo */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginBottom: '10px' }}>
                                {[
                                    { key: '9224', icon: '🏢', label: 'Bot 1 (9224)', user: orgUsers['9224'] || 'TVILLAMIZARJ', activeBg: '#0d47a1' },
                                    { key: '9224.4', icon: '🎓', label: 'Bot 2 (9224.4)', user: orgUsers['9224.4'] || 'EDHERNANDEZM', activeBg: '#1b5e20' },
                                    { key: '9224.2', icon: '📚', label: 'Bot 3 (9224.2)', user: orgUsers['9224.2'] || 'luepitar', activeBg: '#4a148c' },
                                    { key: 'VERIFICADOR', icon: '🔍', label: 'Bot 4 (Verificador)', user: 'SGDEA Expediente', activeBg: '#006064' }
                                ].map(tab => {
                                    const bst = botsStatus[tab.key] || {};
                                    const isSel = activeMonitorBot === tab.key;
                                    return (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => setActiveMonitorBot(tab.key)}
                                            style={{
                                                flex: 1,
                                                padding: '6px 6px',
                                                borderRadius: '6px',
                                                border: isSel ? `2px solid ${tab.activeBg}` : '1px solid #ddd',
                                                backgroundColor: isSel ? tab.activeBg : '#f8f9fa',
                                                color: isSel ? '#fff' : '#333',
                                                cursor: 'pointer',
                                                fontSize: '11px',
                                                fontWeight: 'bold',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '2px'
                                            }}
                                        >
                                            <span>{bst.running ? '🟢' : (bst.completed ? '✅' : '⚪')} {tab.icon} {tab.label}</span>
                                            <span style={{ fontSize: '9px', opacity: isSel ? 0.9 : 0.7 }}>
                                                {bst.onbaseUser || tab.user} {bst.totalDocs > 0 ? `(${bst.processedDocs || 0}/${bst.totalDocs})` : ''}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {liveFrame ? (
                                <div style={{ border: '2px solid #000', borderRadius: '8px', overflow: 'hidden', background: '#000', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
                                    <img 
                                        src={liveFrame} 
                                        alt="Live Stream" 
                                        onClick={() => { setMosaicView(false); setIsMonitorExpanded(true); }}
                                        style={{ width: '100%', display: 'block', maxHeight: '350px', objectFit: 'contain', cursor: 'pointer' }} 
                                        title="Haz clic para ampliar pantalla e interactuar con este Bot"
                                    />
                                    <div style={{ background: activeBotState.running ? '#ff0000' : '#263238', color: '#fff', fontSize: '11px', padding: '4px 10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ width: '8px', height: '8px', background: '#fff', borderRadius: '50%', display: 'inline-block', animation: activeBotState.running ? 'blink 1s step-end infinite' : 'none' }}></span>
                                            {activeBotState.label || `Bot ${activeMonitorBot}`} ({activeBotState.onbaseUser})
                                        </span>
                                        <span>{activeBotState.totalDocs > 0 ? `${activeBotState.processedDocs || 0}/${activeBotState.totalDocs} Docs` : ''}</span>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', border: '2px dashed #ccc', color: '#999', borderRadius: '8px' }}>
                                    <Monitor size={48} style={{ marginBottom: '12px', opacity: 0.4 }} />
                                    <p style={{ fontSize: '13px', textAlign: 'center', padding: '0 20px', fontWeight: '500' }}>
                                        {activeBotState.running ? `Conectando ${activeBotState.label} (${activeBotState.onbaseUser})... espere` : `Sin actividad en ${activeBotState.label || `Bot ${activeMonitorBot}`}`}
                                    </p>
                                    {activeBotState.running && <p style={{ fontSize: '11px', color: '#aaa', marginTop: '5px' }}>El video aparecerá cuando este Bot abra OnBase</p>}
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
            ) : activeTab === 'verificador' ? (
                (() => {
                    const sourceDocs = verifierDocs.length > 0 ? verifierDocs : documents;
                    const docsWithExpCode = sourceDocs.filter(d => d.expediente_code && String(d.expediente_code).trim() !== '');

                    // Filtrar por Dependencia
                    const depDocs = docsWithExpCode.filter(doc => {
                        if (verifierDepFilter === 'all') return true;
                        const docDep = doc.dependency_code || (doc.subserie && doc.subserie.includes('9224.4') ? '9224.4' : (doc.subserie && doc.subserie.includes('9224.2') ? '9224.2' : '9224'));
                        return docDep === verifierDepFilter;
                    });

                    // Agrupar por Expediente
                    const verifExpMap = {};
                    const verifExpedientesAll = [];
                    depDocs.forEach(doc => {
                        const expId = doc.expediente_id || `CODE_${doc.expediente_code}`;
                        if (!verifExpMap[expId]) {
                            verifExpMap[expId] = {
                                expediente_id: doc.expediente_id,
                                expediente_code: String(doc.expediente_code || '').trim(),
                                title: doc.title || 'Expediente Sin Título',
                                subserie: String(doc.subserie || '').trim(),
                                subserie_name: doc.subserie_name || doc.series_name || '',
                                box_id: doc.box_id || '',
                                opening_date: doc.opening_date || '',
                                dependency_code: doc.dependency_code || (doc.subserie && doc.subserie.includes('9224.4') ? '9224.4' : (doc.subserie && doc.subserie.includes('9224.2') ? '9224.2' : '9224')),
                                target_onbase_user: doc.target_onbase_user || (doc.subserie && doc.subserie.includes('9224.4') ? (orgUsers['9224.4'] || 'EDHERNANDEZM') : (doc.subserie && doc.subserie.includes('9224.2') ? (orgUsers['9224.2'] || 'luepitar') : (orgUsers['9224'] || 'TVILLAMIZARJ'))),
                                documents: []
                            };
                            verifExpedientesAll.push(verifExpMap[expId]);
                        }
                        verifExpMap[expId].documents.push(doc);
                    });

                    verifExpedientesAll.forEach(exp => {
                        exp.documents.sort((a, b) => {
                            const ordA = Number(a.typology_order ?? 9999);
                            const ordB = Number(b.typology_order ?? 9999);
                            if (ordA !== ordB) return ordA - ordB;
                            return (a.id || 0) - (b.id || 0);
                        });
                        exp.totalCount = exp.documents.length;
                        exp.okCount = exp.documents.filter(d => Number(d.onbase_verified) === 2).length;
                        exp.cargadoCount = exp.documents.filter(d => d.status === 'Cargado').length;
                        exp.pendingCount = exp.documents.filter(d => d.status === 'Pendiente').length;
                        exp.isAllOk = exp.totalCount > 0 && exp.okCount === exp.totalCount;
                    });

                    verifExpedientesAll.sort((a, b) => {
                        const subA = a.subserie || 'ZZZZ';
                        const subB = b.subserie || 'ZZZZ';
                        if (subA !== subB) return subA.localeCompare(subB, undefined, { numeric: true });
                        return String(a.expediente_code || '').localeCompare(String(b.expediente_code || ''), undefined, { numeric: true });
                    });

                    // Totales globales para las tarjetas de resumen
                    const totalExpsCount = verifExpedientesAll.length;
                    const totalExpsAllOk = verifExpedientesAll.filter(e => e.isAllOk).length;
                    const totalExpsPendingReview = verifExpedientesAll.filter(e => !e.isAllOk).length;
                    const totalDocsCount = depDocs.length;
                    const totalDocsOk = depDocs.filter(d => Number(d.onbase_verified) === 2).length;
                    const totalDocsWithoutOk = depDocs.filter(d => Number(d.onbase_verified) !== 2).length;
                    const totalDocsPendingUpload = depDocs.filter(d => d.status === 'Pendiente').length;

                    // Filtrar por pestaña de estado del Verificador y por texto de búsqueda
                    const filteredVerifExps = verifExpedientesAll.filter(exp => {
                        if (verifierFilter === 'PorRevisar' && exp.isAllOk) return false;
                        if (verifierFilter === 'VerificadosOK' && !exp.isAllOk) return false;
                        if (verifierFilter === 'ConPendientes' && exp.pendingCount === 0) return false;

                        if (!verifierSearch.trim()) return true;
                        const q = verifierSearch.toLowerCase().trim();
                        const matchExp = `${exp.expediente_code} ${exp.title} ${exp.subserie} ${exp.subserie_name} ${exp.target_onbase_user}`.toLowerCase().includes(q);
                        if (matchExp) return true;
                        return exp.documents.some(d => `${d.filename || ''} ${d.typology_name || ''}`.toLowerCase().includes(q));
                    });

                    const visibleDocIds = filteredVerifExps.flatMap(e => e.documents.map(d => d.id));

                    return (
                        <div className="verificador-manual-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                            {verifierToast && (
                                <div style={{
                                    position: 'fixed',
                                    bottom: '24px',
                                    right: '24px',
                                    zIndex: 9999,
                                    backgroundColor: '#1b5e20',
                                    color: '#fff',
                                    padding: '12px 20px',
                                    borderRadius: '10px',
                                    fontWeight: 'bold',
                                    fontSize: '14px',
                                    boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
                                    border: '2px solid #81c784'
                                }}>
                                    {verifierToast}
                                </div>
                            )}

                            {/* Tarjetas de Resumen del Verificador Manual */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                                <div style={{ background: '#fff', borderRadius: '12px', padding: '14px 18px', borderLeft: '5px solid #1976d2', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                                    <div style={{ fontSize: '12px', color: '#555', fontWeight: 'bold' }}>📁 Total Carpetas con Código</div>
                                    <div style={{ fontSize: '26px', fontWeight: '900', color: '#0d47a1', marginTop: '4px' }}>{totalExpsCount}</div>
                                    <div style={{ fontSize: '11px', color: '#666' }}>{totalDocsCount} documentos en total</div>
                                </div>
                                <div style={{ background: '#fff', borderRadius: '12px', padding: '14px 18px', borderLeft: '5px solid #f57c00', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                                    <div style={{ fontSize: '12px', color: '#555', fontWeight: 'bold' }}>🔎 Carpetas por Revisar / Dar OK</div>
                                    <div style={{ fontSize: '26px', fontWeight: '900', color: '#e65100', marginTop: '4px' }}>{totalExpsPendingReview}</div>
                                    <div style={{ fontSize: '11px', color: '#666' }}>{totalDocsWithoutOk} documento(s) esperando tu OK</div>
                                </div>
                                <div style={{ background: '#fff', borderRadius: '12px', padding: '14px 18px', borderLeft: '5px solid #2e7d32', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                                    <div style={{ fontSize: '12px', color: '#555', fontWeight: 'bold' }}>✅ Confirmados con OK Manual</div>
                                    <div style={{ fontSize: '26px', fontWeight: '900', color: '#1b5e20', marginTop: '4px' }}>{totalDocsOk} <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#2e7d32' }}>docs ({totalExpsAllOk} carpetas)</span></div>
                                    <div style={{ fontSize: '11px', color: '#666' }}>Revisados y aprobados por ti</div>
                                </div>
                                <div style={{ background: '#fff', borderRadius: '12px', padding: '14px 18px', borderLeft: '5px solid #7b1fa2', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                                    <div style={{ fontSize: '12px', color: '#555', fontWeight: 'bold' }}>⏳ En Cola Pendientes de Cargue</div>
                                    <div style={{ fontSize: '26px', fontWeight: '900', color: '#4a148c', marginTop: '4px' }}>{totalDocsPendingUpload}</div>
                                    <div style={{ fontSize: '11px', color: '#666' }}>Listos para subir con los Bots</div>
                                </div>
                            </div>

                            {/* Panel Principal de Revisión Manual */}
                            <div className="card" style={{ padding: '18px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '15px', paddingBottom: '12px', borderBottom: '1px solid #e0e0e0' }}>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: '19px', color: '#1b5e20', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            ✅ Verificador Manual de Expedientes y Documentos (Control Directo)
                                        </h2>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#555' }}>
                                            Copie el código del expediente, revise sus archivos PDF o en OnBase y presione <strong>"✅ Dar OK"</strong> por documento o por carpeta completa. Si falta algún archivo en OnBase, presione <strong>"↩️ Pasar a Pendiente"</strong> para que el Bot lo vuelva a cargar.
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <a
                                            href="https://onbase.sena.edu.co/AppNet/Login.aspx"
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{
                                                padding: '9px 14px',
                                                backgroundColor: '#0d47a1',
                                                color: '#fff',
                                                borderRadius: '8px',
                                                textDecoration: 'none',
                                                fontWeight: 'bold',
                                                fontSize: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <Globe size={15} /> Abrir OnBase Web
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (verifierExpandedExps.length === filteredVerifExps.length) {
                                                    setVerifierExpandedExps([]);
                                                } else {
                                                    setVerifierExpandedExps(filteredVerifExps.map(e => e.expediente_id));
                                                }
                                            }}
                                            style={{
                                                padding: '9px 14px',
                                                backgroundColor: '#e8f5e9',
                                                color: '#1b5e20',
                                                border: '1px solid #a5d6a7',
                                                borderRadius: '8px',
                                                fontWeight: 'bold',
                                                fontSize: '12px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {verifierExpandedExps.length === filteredVerifExps.length && filteredVerifExps.length > 0
                                                ? '📁 Contraer Todas las Carpetas'
                                                : '📂 Desplegar Todos los Archivos'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={fetchVerifierDocuments}
                                            disabled={verifierLoading}
                                            style={{
                                                padding: '9px 14px',
                                                backgroundColor: '#f5f5f5',
                                                color: '#333',
                                                border: '1px solid #ccc',
                                                borderRadius: '8px',
                                                fontWeight: 'bold',
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <RefreshCw size={15} className={verifierLoading ? 'spin' : ''} /> Actualizar Lista
                                        </button>
                                    </div>
                                </div>

                                {/* Buscador y Filtros de Estado del Verificador */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                                    <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
                                        <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} size={18} />
                                        <input
                                            type="text"
                                            placeholder="Buscar en el Verificador por Código (2026EX-...), Nombre, Subserie o Tipología..."
                                            value={verifierSearch}
                                            onChange={e => setVerifierSearch(e.target.value)}
                                            style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '2px solid #2e7d32', outline: 'none', fontSize: '14px', fontWeight: '500' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '5px', background: '#f0f0f0', padding: '5px', borderRadius: '8px', flexWrap: 'wrap' }}>
                                        {[
                                            { id: 'PorRevisar', label: `🔎 Por Revisar / Sin OK (${totalExpsPendingReview})` },
                                            { id: 'Todos', label: `📁 Todos (${totalExpsCount})` },
                                            { id: 'VerificadosOK', label: `✅ Con OK Completo (${totalExpsAllOk})` },
                                            { id: 'ConPendientes', label: `⏳ Con Pendientes de Subir (${verifExpedientesAll.filter(e => e.pendingCount > 0).length})` }
                                        ].map(t => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setVerifierFilter(t.id)}
                                                style={{
                                                    padding: '7px 13px',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer',
                                                    backgroundColor: verifierFilter === t.id ? '#2e7d32' : 'transparent',
                                                    color: verifierFilter === t.id ? '#fff' : '#444'
                                                }}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Filtro por Dependencia y Acciones Masivas en Lote */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '15px', padding: '10px 14px', backgroundColor: '#f9fbf9', borderRadius: '10px', border: '1px solid #e0ede0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#2e7d32' }}>🏛️ Dependencia:</span>
                                        {[
                                            { id: 'all', label: 'Todas' },
                                            { id: '9224', label: `🏢 Subdirección (9224)` },
                                            { id: '9224.4', label: `🎓 Formación Profesional (9224.4)` },
                                            { id: '9224.2', label: `📚 Adm. Educativa (9224.2)` }
                                        ].map(dep => (
                                            <button
                                                key={dep.id}
                                                type="button"
                                                onClick={() => setVerifierDepFilter(dep.id)}
                                                style={{
                                                    padding: '5px 12px',
                                                    borderRadius: '16px',
                                                    border: verifierDepFilter === dep.id ? '2px solid #2e7d32' : '1px solid #ccc',
                                                    backgroundColor: verifierDepFilter === dep.id ? '#e8f5e9' : '#fff',
                                                    color: verifierDepFilter === dep.id ? '#1b5e20' : '#555',
                                                    fontWeight: 'bold',
                                                    fontSize: '11px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {dep.label}
                                            </button>
                                        ))}
                                    </div>

                                    {verifierSelectedDocs.length > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1b5e20' }}>
                                                {verifierSelectedDocs.length} documento(s) seleccionado(s):
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleManualVerifyAction({
                                                    action: 'ok',
                                                    documentIds: verifierSelectedDocs,
                                                    label: `${verifierSelectedDocs.length} documento(s)`
                                                })}
                                                style={{
                                                    padding: '6px 14px',
                                                    backgroundColor: '#2e7d32',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontWeight: 'bold',
                                                    fontSize: '12px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '5px'
                                                }}
                                            >
                                                <CheckCircle size={14} /> Dar OK a Seleccionados ({verifierSelectedDocs.length})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleManualVerifyAction({
                                                    action: 'pendiente',
                                                    documentIds: verifierSelectedDocs,
                                                    label: `${verifierSelectedDocs.length} documento(s)`
                                                })}
                                                style={{
                                                    padding: '6px 14px',
                                                    backgroundColor: '#fff3e0',
                                                    color: '#e65100',
                                                    border: '1px solid #ffb74d',
                                                    borderRadius: '6px',
                                                    fontWeight: 'bold',
                                                    fontSize: '12px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                ↩️ Pasar Seleccionados a Pendiente
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setVerifierSelectedDocs([])}
                                                style={{
                                                    padding: '6px 10px',
                                                    backgroundColor: '#f5f5f5',
                                                    color: '#555',
                                                    border: '1px solid #ccc',
                                                    borderRadius: '6px',
                                                    fontSize: '11px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Limpiar
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Tabla Maestra de Expedientes y Documentos para Dar OK */}
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#e8f5e9', textAlign: 'left', borderBottom: '2px solid #2e7d32' }}>
                                                <th style={{ padding: '12px', width: '65px', textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={visibleDocIds.length > 0 && visibleDocIds.every(id => verifierSelectedDocs.includes(id))}
                                                        onChange={e => {
                                                            if (e.target.checked) {
                                                                setVerifierSelectedDocs(prev => [...new Set([...prev, ...visibleDocIds])]);
                                                            } else {
                                                                setVerifierSelectedDocs(prev => prev.filter(id => !visibleDocIds.includes(id)));
                                                            }
                                                        }}
                                                        style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                                                    />
                                                </th>
                                                <th style={{ padding: '12px', width: '190px' }}>Código Expediente</th>
                                                <th style={{ padding: '12px' }}>Expediente / Aprendiz o Contratista</th>
                                                <th style={{ padding: '12px', width: '160px' }}>Subserie TRD</th>
                                                <th style={{ padding: '12px', width: '180px' }}>Progreso Revisión</th>
                                                <th style={{ padding: '12px', width: '320px', textAlign: 'center' }}>Acción Manual (Dar OK / Revisar)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredVerifExps.length > 0 ? filteredVerifExps.map(exp => {
                                                const isExpOpen = verifierExpandedExps.includes(exp.expediente_id);
                                                const expDocIds = exp.documents.map(d => d.id);
                                                const isExpSelected = expDocIds.length > 0 && expDocIds.every(id => verifierSelectedDocs.includes(id));
                                                const depBadge = getDepBadge(exp.dependency_code, exp.target_onbase_user);

                                                return (
                                                    <Fragment key={exp.expediente_id || exp.expediente_code}>
                                                        <tr style={{
                                                            borderTop: '1px solid #c8e6c9',
                                                            backgroundColor: exp.isAllOk ? '#f1f8e9' : (isExpOpen ? '#fffde7' : '#ffffff')
                                                        }}>
                                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isExpSelected}
                                                                        onChange={e => {
                                                                            if (e.target.checked) {
                                                                                setVerifierSelectedDocs(prev => [...new Set([...prev, ...expDocIds])]);
                                                                            } else {
                                                                                setVerifierSelectedDocs(prev => prev.filter(id => !expDocIds.includes(id)));
                                                                            }
                                                                        }}
                                                                        style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setVerifierExpandedExps(prev => prev.includes(exp.expediente_id) ? prev.filter(i => i !== exp.expediente_id) : [...prev, exp.expediente_id])}
                                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2e7d32', padding: '2px', display: 'flex', alignItems: 'center' }}
                                                                    >
                                                                        {isExpOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '12px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                    <span style={{
                                                                        fontFamily: 'monospace',
                                                                        fontWeight: 'bold',
                                                                        fontSize: '13px',
                                                                        color: '#1b5e20',
                                                                        backgroundColor: '#e8f5e9',
                                                                        padding: '4px 8px',
                                                                        borderRadius: '6px',
                                                                        border: '1px solid #81c784'
                                                                    }}>
                                                                        {exp.expediente_code}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleCopyExpCode(exp.expediente_code)}
                                                                        title="Copiar código para buscarlo en OnBase"
                                                                        style={{
                                                                            padding: '3px 7px',
                                                                            fontSize: '10px',
                                                                            fontWeight: 'bold',
                                                                            borderRadius: '5px',
                                                                            border: '1px solid #90caf9',
                                                                            backgroundColor: copiedExpCode === exp.expediente_code ? '#1976d2' : '#e3f2fd',
                                                                            color: copiedExpCode === exp.expediente_code ? '#fff' : '#0d47a1',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        {copiedExpCode === exp.expediente_code ? '✓ Copiado' : '📋 Copiar'}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '12px' }}>
                                                                <div style={{ fontWeight: 'bold', color: '#1b5e20', fontSize: '14px' }}>{exp.title}</div>
                                                                <div style={{ fontSize: '11px', color: '#666', marginTop: '3px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                    <span>{depBadge.icon} {depBadge.shortLabel} ({exp.target_onbase_user})</span>
                                                                    {exp.opening_date && <span>· Apertura: {new Date(exp.opening_date).toLocaleDateString()}</span>}
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '12px', fontSize: '12px', color: '#333' }}>
                                                                <div style={{ fontWeight: 'bold' }}>{exp.subserie || '-'}</div>
                                                                {exp.subserie_name && <div style={{ fontSize: '11px', color: '#666' }}>{exp.subserie_name}</div>}
                                                            </td>
                                                            <td style={{ padding: '12px' }}>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                    <span style={{
                                                                        padding: '3px 9px',
                                                                        borderRadius: '10px',
                                                                        fontSize: '11px',
                                                                        fontWeight: 'bold',
                                                                        width: 'fit-content',
                                                                        backgroundColor: exp.isAllOk ? '#c8e6c9' : '#fff3e0',
                                                                        color: exp.isAllOk ? '#1b5e20' : '#e65100',
                                                                        border: `1px solid ${exp.isAllOk ? '#81c784' : '#ffcc80'}`
                                                                    }}>
                                                                        {exp.isAllOk
                                                                            ? `✅ OK Completo (${exp.okCount}/${exp.totalCount})`
                                                                            : `🔎 OK: ${exp.okCount}/${exp.totalCount} docs`}
                                                                    </span>
                                                                    <span style={{ fontSize: '11px', color: '#555' }}>
                                                                        📤 Cargados: <strong>{exp.cargadoCount}</strong> · ⏳ Pendientes: <strong>{exp.pendingCount}</strong>
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleManualVerifyAction({
                                                                            action: 'ok',
                                                                            expedienteIds: [exp.expediente_id],
                                                                            label: `Carpeta ${exp.expediente_code}`
                                                                        })}
                                                                        style={{
                                                                            padding: '6px 12px',
                                                                            backgroundColor: exp.isAllOk ? '#e8f5e9' : '#2e7d32',
                                                                            color: exp.isAllOk ? '#1b5e20' : '#ffffff',
                                                                            border: '1px solid #1b5e20',
                                                                            borderRadius: '6px',
                                                                            fontWeight: 'bold',
                                                                            fontSize: '12px',
                                                                            cursor: 'pointer',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '5px'
                                                                        }}
                                                                        title="Confirmar y dar OK a todos los documentos de este expediente"
                                                                    >
                                                                        <CheckCircle size={14} /> {exp.isAllOk ? 'OK Confirmado ✓' : 'Dar OK a Carpeta'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setVerifierExpandedExps(prev => prev.includes(exp.expediente_id) ? prev.filter(i => i !== exp.expediente_id) : [...prev, exp.expediente_id])}
                                                                        style={{
                                                                            padding: '6px 10px',
                                                                            backgroundColor: isExpOpen ? '#1976d2' : '#e3f2fd',
                                                                            color: isExpOpen ? '#fff' : '#0d47a1',
                                                                            border: '1px solid #90caf9',
                                                                            borderRadius: '6px',
                                                                            fontWeight: 'bold',
                                                                            fontSize: '11px',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        {isExpOpen ? '▲ Ocultar Archivos' : `📂 Revisar Archivos (${exp.totalCount})`}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>

                                                        {/* Subtabla de Documentos del Expediente en la Pestaña Verificador */}
                                                        {isExpOpen && (
                                                            <tr style={{ backgroundColor: '#f8faf8' }}>
                                                                <td colSpan="6" style={{ padding: '12px 18px 16px 46px', borderBottom: '2px solid #c8e6c9' }}>
                                                                    <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #c8e6c9', overflow: 'hidden' }}>
                                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                                                            <thead>
                                                                                <tr style={{ backgroundColor: '#f1f8e9', color: '#1b5e20', textAlign: 'left', borderBottom: '1px solid #c8e6c9' }}>
                                                                                    <th style={{ padding: '8px 10px', width: '40px', textAlign: 'center' }}>#</th>
                                                                                    <th style={{ padding: '8px 10px' }}>Archivo PDF</th>
                                                                                    <th style={{ padding: '8px 10px' }}>Tipología Documental TRD</th>
                                                                                    <th style={{ padding: '8px 10px', width: '110px' }}>Fecha</th>
                                                                                    <th style={{ padding: '8px 10px', width: '190px' }}>Estado de Verificación</th>
                                                                                    <th style={{ padding: '8px 10px', width: '290px', textAlign: 'center' }}>Tu Decisión (OK / Ver PDF / Re-cargar)</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {exp.documents.map((doc, dIdx) => {
                                                                                    const isDocOk = Number(doc.onbase_verified) === 2;
                                                                                    const isDocCargado = doc.status === 'Cargado';
                                                                                    const isPreviewOpen = verifierPreviewDocIds.includes(doc.id);
                                                                                    return (
                                                                                        <Fragment key={doc.id}>
                                                                                            <tr style={{
                                                                                                borderBottom: '1px solid #eee',
                                                                                                backgroundColor: isDocOk ? '#f1f8e9' : (isDocCargado ? '#ffffff' : '#fff8e1')
                                                                                            }}>
                                                                                                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: '#555' }}>
                                                                                                    <input
                                                                                                        type="checkbox"
                                                                                                        checked={verifierSelectedDocs.includes(doc.id)}
                                                                                                        onChange={e => {
                                                                                                            if (e.target.checked) setVerifierSelectedDocs(prev => [...prev, doc.id]);
                                                                                                            else setVerifierSelectedDocs(prev => prev.filter(id => id !== doc.id));
                                                                                                        }}
                                                                                                        style={{ marginRight: '6px', cursor: 'pointer' }}
                                                                                                    />
                                                                                                    {dIdx + 1}
                                                                                                </td>
                                                                                                <td style={{ padding: '8px 10px' }}>
                                                                                                    <div
                                                                                                        onClick={() => setVerifierPreviewDocIds(prev => prev.includes(doc.id) ? prev.filter(id => id !== doc.id) : [...prev, doc.id])}
                                                                                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: '600', color: '#1565c0' }}
                                                                                                        title="Haz clic para abrir/cerrar el visor PDF de este archivo"
                                                                                                    >
                                                                                                        <FileText size={14} />
                                                                                                        <span style={{ textDecoration: 'underline' }}>{doc.filename}</span>
                                                                                                    </div>
                                                                                                </td>
                                                                                                <td style={{ padding: '8px 10px', color: '#333', fontWeight: '500' }}>
                                                                                                    {doc.typology_name}
                                                                                                </td>
                                                                                                <td style={{ padding: '8px 10px', color: '#666' }}>
                                                                                                    {doc.document_date ? new Date(doc.document_date).toLocaleDateString() : '-'}
                                                                                                </td>
                                                                                                <td style={{ padding: '8px 10px' }}>
                                                                                                    {isDocOk ? (
                                                                                                        <span style={{ padding: '3px 9px', borderRadius: '10px', backgroundColor: '#c8e6c9', color: '#1b5e20', fontWeight: 'bold', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                                                            ✅ OK Confirmado
                                                                                                        </span>
                                                                                                    ) : isDocCargado ? (
                                                                                                        <span style={{ padding: '3px 9px', borderRadius: '10px', backgroundColor: '#e3f2fd', color: '#0d47a1', fontWeight: 'bold', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                                                            📤 Cargado (Falta dar OK)
                                                                                                        </span>
                                                                                                    ) : (
                                                                                                        <span style={{ padding: '3px 9px', borderRadius: '10px', backgroundColor: '#fff3e0', color: '#e65100', fontWeight: 'bold', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                                                            ⏳ Pendiente de Cargue
                                                                                                        </span>
                                                                                                    )}
                                                                                                </td>
                                                                                                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            onClick={() => setVerifierPreviewDocIds(prev => prev.includes(doc.id) ? prev.filter(id => id !== doc.id) : [...prev, doc.id])}
                                                                                                            style={{
                                                                                                                padding: '4px 9px',
                                                                                                                backgroundColor: isPreviewOpen ? '#1565c0' : '#e3f2fd',
                                                                                                                color: isPreviewOpen ? '#fff' : '#0d47a1',
                                                                                                                border: '1px solid #90caf9',
                                                                                                                borderRadius: '5px',
                                                                                                                fontWeight: 'bold',
                                                                                                                fontSize: '11px',
                                                                                                                cursor: 'pointer',
                                                                                                                display: 'flex',
                                                                                                                alignItems: 'center',
                                                                                                                gap: '4px'
                                                                                                            }}
                                                                                                        >
                                                                                                            <Eye size={12} /> {isPreviewOpen ? 'Ocultar PDF' : 'Ver PDF'}
                                                                                                        </button>
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            onClick={() => handleManualVerifyAction({
                                                                                                                action: 'ok',
                                                                                                                documentIds: [doc.id],
                                                                                                                label: doc.filename
                                                                                                            })}
                                                                                                            style={{
                                                                                                                padding: '4px 10px',
                                                                                                                backgroundColor: isDocOk ? '#c8e6c9' : '#2e7d32',
                                                                                                                color: isDocOk ? '#1b5e20' : '#fff',
                                                                                                                border: '1px solid #1b5e20',
                                                                                                                borderRadius: '5px',
                                                                                                                fontWeight: 'bold',
                                                                                                                fontSize: '11px',
                                                                                                                cursor: 'pointer',
                                                                                                                display: 'flex',
                                                                                                                alignItems: 'center',
                                                                                                                gap: '4px'
                                                                                                            }}
                                                                                                            title="Confirmar que este documento está OK en OnBase"
                                                                                                        >
                                                                                                            <CheckCircle size={12} /> {isDocOk ? 'OK ✓' : 'Dar OK'}
                                                                                                        </button>
                                                                                                        {(isDocCargado || isDocOk) && (
                                                                                                            <button
                                                                                                                type="button"
                                                                                                                onClick={() => handleManualVerifyAction({
                                                                                                                    action: 'pendiente',
                                                                                                                    documentIds: [doc.id],
                                                                                                                    label: doc.filename
                                                                                                                })}
                                                                                                                style={{
                                                                                                                    padding: '4px 8px',
                                                                                                                    backgroundColor: '#fff3e0',
                                                                                                                    color: '#e65100',
                                                                                                                    border: '1px solid #ffb74d',
                                                                                                                    borderRadius: '5px',
                                                                                                                    fontWeight: 'bold',
                                                                                                                    fontSize: '11px',
                                                                                                                    cursor: 'pointer'
                                                                                                                }}
                                                                                                                title="Devolver a estado Pendiente para que el Bot lo vuelva a cargar en OnBase"
                                                                                                            >
                                                                                                                ↩️ Falta (Pendiente)
                                                                                                            </button>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </td>
                                                                                            </tr>
                                                                                            {isPreviewOpen && (
                                                                                                <tr style={{ backgroundColor: '#f0f4f8' }}>
                                                                                                    <td colSpan="6" style={{ padding: '10px 14px' }}>
                                                                                                        <div style={{ border: '1px solid #90caf9', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fff' }}>
                                                                                                            <div style={{ padding: '6px 12px', backgroundColor: '#e3f2fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                                                <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#0d47a1' }}>
                                                                                                                    📄 Vista Previa PDF: {doc.filename} ({doc.typology_name})
                                                                                                                </span>
                                                                                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                                                                                    <button
                                                                                                                        type="button"
                                                                                                                        onClick={() => window.open(`/api/ades/view/${doc.id}`, '_blank')}
                                                                                                                        style={{ padding: '3px 8px', background: '#fff', color: '#0d47a1', border: '1px solid #90caf9', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                                                                                                    >
                                                                                                                        Abrir en pestaña nueva ↗
                                                                                                                    </button>
                                                                                                                    <button
                                                                                                                        type="button"
                                                                                                                        onClick={() => setVerifierPreviewDocIds(prev => prev.filter(id => id !== doc.id))}
                                                                                                                        style={{ padding: '3px 8px', background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                                                                                                    >
                                                                                                                        ✕ Cerrar
                                                                                                                    </button>
                                                                                                                </div>
                                                                                                            </div>
                                                                                                            <iframe
                                                                                                                src={`/api/ades/view/${doc.id}#toolbar=1&navpanes=0&view=FitH`}
                                                                                                                title={`Verificador PDF ${doc.filename}`}
                                                                                                                style={{ width: '100%', height: '520px', border: 'none', display: 'block' }}
                                                                                                            />
                                                                                                        </div>
                                                                                                    </td>
                                                                                                </tr>
                                                                                            )}
                                                                                        </Fragment>
                                                                                    );
                                                                                })}
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
                                                    <td colSpan="6" style={{ padding: '45px', textAlign: 'center', color: '#777', fontSize: '14px' }}>
                                                        {verifierLoading ? 'Cargando expedientes y documentos para verificar...' : 'No hay expedientes en este filtro.'}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    );
                })()
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
                    <div className="modal-content" style={{ background: '#white', borderRadius: '12px', width: '100%', maxWidth: showModalPreview ? '920px' : '620px', backgroundColor: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', overflow: 'hidden', maxHeight: '92vh', overflowY: 'auto', transition: 'max-width 0.2s ease' }}>
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

                            {/* Información Institucional TRD y OnBase */}
                            {(() => {
                                const mb = getDepBadge(configDoc.dependency_code, configDoc.target_onbase_user);
                                return (
                                    <div style={{ padding: '12px', borderRadius: '8px', background: mb.bg, border: `1px solid ${mb.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>DEPENDENCIA TRD / SECCIÓN</div>
                                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: mb.color }}>
                                                {mb.icon} {configDoc.dependency_name || mb.label} ({configDoc.dependency_code || mb.code})
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '10px', color: '#666', fontWeight: 'bold' }}>USUARIO ONBASE</div>
                                            <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '6px', backgroundColor: mb.pillBg, color: mb.color, fontWeight: 'bold', fontSize: '12px' }}>
                                                {configDoc.target_onbase_user || mb.user}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '5px' }}>GRUPO DOCUMENTAL</label>
                                <input type="text" value="TRD" readOnly style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', backgroundColor: '#f9f9f9' }} />
                            </div>

                            <div className="form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#666' }}>TIPO DOCUMENTAL (TRD)</label>
                                    {configDoc.onbase_name && (
                                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#1565c0', background: '#e3f2fd', padding: '2px 6px', borderRadius: '4px' }}>
                                            En OnBase/AES: {configDoc.onbase_name}
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <select
                                        value=""
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val) {
                                                setEditingTypology(prev => ({ ...prev, [configDoc.id]: val }));
                                                setModalEditFields(f => ({ ...f, typology_name: val }));
                                            }
                                        }}
                                        style={{ width: '100%', padding: '9px 10px', border: '1px solid #1976d2', borderRadius: '6px', backgroundColor: '#e3f2fd', color: '#0d47a1', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
                                    >
                                        <option value="">📋 Seleccionar Tipología Oficial de la TRD ({getTypologiesForDoc(configDoc).length} disponibles)...</option>
                                        {getTypologiesForDoc(configDoc).map(t => (
                                            <option key={t.id} value={t.name}>
                                                {t.trd_order ? `${String(t.trd_order).padStart(2, '0')}. ` : ''}{t.name}{t.stage ? ` — [${t.stage}]` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <input
                                            type="text"
                                            value={editingModal ? (modalEditFields.typology_name ?? editingTypology[configDoc.id] ?? configDoc.typology_name ?? '') : (editingTypology[configDoc.id] ?? configDoc.typology_name ?? '')}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setEditingTypology(prev => ({ ...prev, [configDoc.id]: val }));
                                                if (editingModal) setModalEditFields(f => ({ ...f, typology_name: val }));
                                            }}
                                            placeholder="Escriba o seleccione la tipología documental..."
                                            style={{ flex: 1, padding: '10px', border: '2px solid #39a900', borderRadius: '6px', backgroundColor: '#fff', fontWeight: 'bold', color: '#1b5e20' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const valToSave = editingModal
                                                    ? (modalEditFields.typology_name ?? editingTypology[configDoc.id] ?? configDoc.typology_name)
                                                    : (editingTypology[configDoc.id] ?? configDoc.typology_name);
                                                saveDocTypology(configDoc.id, valToSave);
                                            }}
                                            disabled={savingTypologyId === configDoc.id}
                                            title="Guardar cambio de Tipología Documental"
                                            style={{ padding: '10px 14px', background: '#39a900', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                                        >
                                            <Save size={16} /> {savingTypologyId === configDoc.id ? 'Guardando...' : 'Guardar Tipología'}
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowModalPreview(prev => !prev)}
                                        style={{ marginTop: '2px', padding: '8px 12px', background: showModalPreview ? '#1565c0' : '#e8f5e9', color: showModalPreview ? '#fff' : '#2e7d32', border: `1px solid ${showModalPreview ? '#0d47a1' : '#a5d6a7'}`, borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                    >
                                        <Eye size={15} /> {showModalPreview ? 'Ocultar Vista Previa del Documento' : `Ver Vista Previa del Documento (${configDoc.filename}) aquí debajo`}
                                    </button>
                                    {showModalPreview && (
                                        <div style={{ marginTop: '6px', border: '1px solid #90caf9', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#525659' }}>
                                            <iframe
                                                src={`/api/ades/view/${configDoc.id}#toolbar=1&navpanes=0&view=FitH`}
                                                title={`Vista previa ${configDoc.filename}`}
                                                style={{ width: '100%', height: '480px', border: 'none', display: 'block' }}
                                            />
                                        </div>
                                    )}
                                </div>
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
                                                    const { description, filename: _ignoredJoinedName, ...restFields } = modalEditFields;
                                                    const resolvedTypology = modalEditFields.typology_name ?? editingTypology[configDoc.id] ?? configDoc.typology_name;
                                                    const payload = {
                                                        ...restFields,
                                                        typology_name: resolvedTypology,
                                                        metadata_values: JSON.stringify({ description: description || '' })
                                                    };
                                                    await axios.put(`/api/documents/${configDoc.id}`, payload, { headers: authHeaders });
                                                    setEditingTypology(prev => ({ ...prev, [configDoc.id]: resolvedTypology }));
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

            {/* Modal de Monitoreo Ampliado (Individual o Mosaico 3 Bots) */}
            {isMonitorExpanded && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(0,0,0,0.88)',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '15px'
                }}>
                    <div style={{
                        position: 'relative',
                        width: '96%',
                        maxWidth: mosaicView ? '1550px' : '1250px',
                        backgroundColor: '#000',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        border: '2px solid #555'
                    }}>
                        <div style={{
                            padding: '12px 20px',
                            background: '#1e293b',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '10px',
                            borderBottom: '1px solid #444'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                                    <Monitor size={18} color="#39a900" /> Monitoreo OnBase Multi-Bot en Vivo
                                </span>
                                {/* Selector de los 4 Bots */}
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {[
                                        { key: '9224', icon: '🏢', title: 'Bot 1 · Subdirección', color: '#1565c0' },
                                        { key: '9224.4', icon: '🎓', title: 'Bot 2 · Formación', color: '#2e7d32' },
                                        { key: '9224.2', icon: '📚', title: 'Bot 3 · Adm. Educativa', color: '#6a1b9a' },
                                        { key: 'VERIFICADOR', icon: '🔍', title: 'Bot 4 · Verificador SGDEA', color: '#00838f' }
                                    ].map(b => {
                                        const st = botsStatus[b.key] || {};
                                        const active = !mosaicView && activeMonitorBot === b.key;
                                        return (
                                            <button
                                                key={b.key}
                                                type="button"
                                                onClick={() => { setActiveMonitorBot(b.key); setMosaicView(false); }}
                                                style={{
                                                    padding: '5px 10px',
                                                    borderRadius: '6px',
                                                    border: active ? '2px solid #fff' : '1px solid #555',
                                                    backgroundColor: active ? b.color : '#334155',
                                                    color: '#fff',
                                                    fontSize: '12px',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {st.running ? '🟢' : (st.completed ? '✅' : '⚪')} {b.icon} {b.title} ({st.onbaseUser || orgUsers[b.key]}) {st.totalDocs > 0 ? `[${st.processedDocs || 0}/${st.totalDocs}]` : ''}
                                            </button>
                                        );
                                    })}
                                    <button
                                        type="button"
                                        onClick={() => setMosaicView(prev => !prev)}
                                        style={{
                                            padding: '5px 12px',
                                            borderRadius: '6px',
                                            border: mosaicView ? '2px solid #ffeb3b' : '1px solid #90caf9',
                                            backgroundColor: mosaicView ? '#f57f17' : '#0d47a1',
                                            color: '#fff',
                                            fontSize: '12px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        🎛️ {mosaicView ? 'Viendo Mosaico 3 Bots (Clic para Individual)' : 'Vista Mosaico 3 Bots Simultáneos'}
                                    </button>
                                </div>
                            </div>
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

                        {mosaicView ? (
                            <div style={{ padding: '14px', backgroundColor: '#0f172a', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', maxHeight: '80vh', overflowY: 'auto' }}>
                                {[
                                    { key: '9224', icon: '🏢', title: 'Bot 1 · Subdirección (9224)', color: '#1e88e5' },
                                    { key: '9224.4', icon: '🎓', title: 'Bot 2 · Formación (9224.4)', color: '#43a047' },
                                    { key: '9224.2', icon: '📚', title: 'Bot 3 · Adm. Educativa (9224.2)', color: '#8e24aa' },
                                    { key: 'VERIFICADOR', icon: '🔍', title: 'Bot 4 · Verificador OnBase (SGDEA Expediente)', color: '#00838f' }
                                ].map(b => {
                                    const st = botsStatus[b.key] || {};
                                    const token = localStorage.getItem('token');
                                    const frameUrl = st.hasFrame ? `/api/automation/frame?bot=${encodeURIComponent(b.key)}&t=${frameTick}&token=${token}` : null;
                                    const lastLogLine = (st.logs && st.logs.length > 0) ? st.logs[st.logs.length - 1] : 'Sin actividad reciente';
                                    return (
                                        <div key={b.key} style={{ backgroundColor: '#1e293b', border: `2px solid ${st.running ? b.color : '#334155'}`, borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ padding: '8px 12px', backgroundColor: b.color, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                                                <span>{b.icon} {b.title} — {st.onbaseUser || orgUsers[b.key]}</span>
                                                <span>{st.running ? `🟢 ${st.processedDocs || 0}/${st.totalDocs || 0}` : (st.completed ? `✅ ${st.processedDocs || 0}/${st.totalDocs || 0}` : '⚪ Inactivo')}</span>
                                            </div>
                                            <div style={{ height: '280px', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                                {frameUrl ? (
                                                    <img
                                                        src={frameUrl}
                                                        alt={b.title}
                                                        onClick={() => { setActiveMonitorBot(b.key); setMosaicView(false); }}
                                                        style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer' }}
                                                        title="Clic para ampliar y controlar este Bot"
                                                    />
                                                ) : (
                                                    <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '15px' }}>
                                                        <Monitor size={32} style={{ opacity: 0.4, marginBottom: '6px' }} />
                                                        <div>{st.running ? 'Iniciando navegador OnBase...' : 'Bot en espera de lote'}</div>
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ padding: '8px 10px', fontSize: '11px', color: '#cbd5e1', backgroundColor: '#0f172a', borderTop: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ color: '#38bdf8', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    Paso: {st.currentStep || 'En espera'}
                                                </div>
                                                <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#4ade80', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    &gt; {lastLogLine}
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setActiveMonitorBot(b.key); setMosaicView(false); }}
                                                        style={{ flex: 1, padding: '5px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                                    >
                                                        🔍 Controlar este Bot
                                                    </button>
                                                    {st.running && (
                                                        <button
                                                            type="button"
                                                            onClick={() => killAutomation(b.key)}
                                                            style={{ padding: '5px 8px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                                        >
                                                            🛑 Detener
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : liveFrame ? (
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
                                            placeholder={`Escribir en ${activeBotState.label || `Bot ${activeMonitorBot}`} (${activeBotState.onbaseUser || ''})...`}
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

                                    {/* Botones de desbloqueo y cierre forzado de sesión (individual o todos) */}
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => handleUnlockBot(activeMonitorBot)}
                                            disabled={isInteracting || unlockingBotKey === activeMonitorBot}
                                            style={{
                                                background: '#ef6c00',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '6px',
                                                padding: '8px 14px',
                                                fontWeight: 'bold',
                                                fontSize: '12px',
                                                cursor: isInteracting ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            🔓 Destrabar OnBase ({activeMonitorBot})
                                        </button>
                                        <button
                                            onClick={() => killAutomation(activeMonitorBot)}
                                            disabled={isInteracting}
                                            style={{
                                                background: '#d32f2f',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '6px',
                                                padding: '8px 14px',
                                                fontWeight: 'bold',
                                                fontSize: '12px',
                                                cursor: isInteracting ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            🛑 Detener Bot ({activeMonitorBot})
                                        </button>
                                        <button
                                            onClick={() => killAutomation('all')}
                                            disabled={isInteracting}
                                            style={{
                                                background: '#7f1d1d',
                                                color: '#fff',
                                                border: '1px solid #ef4444',
                                                borderRadius: '6px',
                                                padding: '8px 14px',
                                                fontWeight: 'bold',
                                                fontSize: '12px',
                                                cursor: isInteracting ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            🛑 Detener los 3 Bots
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ height: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
                                Sin transmisión activa en {activeBotState.label || `Bot ${activeMonitorBot}`}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Configuración de Alertas a Móvil y Equipo (Watchdog Anti-Bloqueo y Verificador OnBase) */}
            {alertModalOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ backgroundColor: '#fff', borderRadius: '12px', maxWidth: '560px', width: '100%', overflow: 'hidden', boxShadow: '0 15px 35px rgba(0,0,0,0.25)' }}>
                        <div style={{ background: 'linear-gradient(135deg, #006064 0%, #00838f 100%)', color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                📱 Alertas a Móvil / PC y Watchdog Anti-Bloqueo OnBase
                            </h3>
                            <button onClick={() => setAlertModalOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveAlertSettings} style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
                            <div style={{ backgroundColor: '#e0f7fa', border: '1px solid #80deea', borderRadius: '8px', padding: '10px 12px', color: '#006064', lineHeight: 1.4 }}>
                                <strong>¿Cómo funciona?</strong> Cuando cualquiera de los Bots se quede pensando o bloqueado en OnBase o cuando un expediente complete su verificación al <strong>50% y 100%</strong>, el sistema intentará destrabarlo automáticamente y enviará una notificación instantánea a su celular y correo.
                            </div>
                            <div>
                                <label style={{ display: 'block', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                                    📲 Canal Push para Celular (App gratuita Ntfy.sh — Android / iPhone)
                                </label>
                                <input
                                    type="text"
                                    value={alertSettingsForm.onbase_alert_ntfy_topic || ''}
                                    onChange={e => setAlertSettingsForm(f => ({ ...f, onbase_alert_ntfy_topic: e.target.value }))}
                                    placeholder="sena-cimi-onbase-alertas"
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ccc', fontWeight: 'bold', color: '#006064' }}
                                />
                                <div style={{ fontSize: '10px', color: '#666', marginTop: '3px' }}>
                                    Descargue la app <strong>ntfy</strong> en su celular y suscríbase al tema: <code>{alertSettingsForm.onbase_alert_ntfy_topic || 'sena-cimi-onbase-alertas'}</code> (o abra <code>https://ntfy.sh/{alertSettingsForm.onbase_alert_ntfy_topic || 'sena-cimi-onbase-alertas'}</code>).
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                                    📧 Correo(s) Electrónico(s) de Alerta (recibe captura de pantalla del bloqueo)
                                </label>
                                <input
                                    type="text"
                                    value={alertSettingsForm.onbase_alert_email || ''}
                                    onChange={e => setAlertSettingsForm(f => ({ ...f, onbase_alert_email: e.target.value }))}
                                    placeholder="ejemplo@sena.edu.co, soporte@sena.edu.co"
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ccc' }}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                                        🤖 Telegram Bot Token (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={alertSettingsForm.onbase_alert_telegram_token || ''}
                                        onChange={e => setAlertSettingsForm(f => ({ ...f, onbase_alert_telegram_token: e.target.value }))}
                                        placeholder="123456:ABC-DEF..."
                                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ccc' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                                        💬 Telegram Chat ID (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={alertSettingsForm.onbase_alert_telegram_chat_id || ''}
                                        onChange={e => setAlertSettingsForm(f => ({ ...f, onbase_alert_telegram_chat_id: e.target.value }))}
                                        placeholder="987654321"
                                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ccc' }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '8px', pt: '10px', borderTop: '1px solid #eee' }}>
                                <button
                                    type="button"
                                    onClick={handleSendTestAlert}
                                    disabled={testingAlert}
                                    style={{ padding: '9px 14px', borderRadius: '6px', border: '1px solid #ef6c00', backgroundColor: '#fff3e0', color: '#e65100', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    📲 {testingAlert ? 'Enviando Prueba...' : 'Enviar Alerta de Prueba al Móvil/PC'}
                                </button>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setAlertModalOpen(false)}
                                        style={{ padding: '9px 14px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#f5f5f5', color: '#555', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingAlertSettings}
                                        style={{ padding: '9px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#00838f', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                        💾 {savingAlertSettings ? 'Guardando...' : 'Guardar Configuración'}
                                    </button>
                                </div>
                            </div>
                        </form>
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
