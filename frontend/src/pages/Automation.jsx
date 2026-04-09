import { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, CheckCircle, AlertCircle, Monitor, Globe, FileInput, Settings, ListTree } from 'lucide-react';
import ProcessFlow from '../components/ProcessFlow';

function Automation() {
    const [activeTab, setActiveTab] = useState('web'); // 'web' or 'unity'
    const [viewMode, setViewMode] = useState('visual'); // 'visual' (screenshot/logs) or 'workflow' (flowchart)
    
    // Web State
    const [url, setUrl] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    
    // Unity State
    const [unityData, setUnityData] = useState({
        asunto: '',
        remitente: '',
        tipo: 'Entrante'
    });

    const [logs, setLogs] = useState([]);
    const [screenshot, setScreenshot] = useState(null);
    const [liveFrame, setLiveFrame] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Load settings on mount
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const keys = ['onbase_url', 'onbase_user', 'onbase_pass'];
                const values = await Promise.all(keys.map(k => 
                    axios.get(`/api/settings/${k}`).then(r => r.data.value)
                ));
                
                if (values[0]) setUrl(values[0]);
                if (values[1]) setUsername(values[1]);
                if (values[2]) setPassword(values[2]);
            } catch (err) {
                console.error("Error loading automation settings:", err);
            }
        };
        fetchSettings();
    }, []);

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await Promise.all([
                axios.post('/api/settings', { key: 'onbase_url', value: url }),
                axios.post('/api/settings', { key: 'onbase_user', value: username }),
                axios.post('/api/settings', { key: 'onbase_pass', value: password })
            ]);
            alert("Configuración guardada exitosamente");
        } catch (err) {
            console.error("Error saving settings:", err);
            alert("Error al guardar la configuración");
        } finally {
            setSaving(false);
        }
    };

    const handleRunWeb = async () => {
        if (!url) return alert("Por favor ingresa una URL");
        setLoading(true);
        setError('');
        setLogs(['Iniciando automatización Web...', 'Conectando con Puppeteer...']);
        setScreenshot(null);
        setLiveFrame(null);

        // --- START LIVE VIDEO STREAM ---
        const eventSource = new EventSource('/api/automation/stream');
        eventSource.onmessage = (event) => {
            setLiveFrame(`data:image/jpeg;base64,${event.data}`);
        };
        eventSource.onerror = () => {
            eventSource.close();
        };

        try {
            const res = await axios.post('/api/automation/execute', { 
                url, username, password
            });
            setLogs(prev => [...prev, ...res.data.logs, 'Automatización Web completada.']);
            setScreenshot(res.data.screenshot);
        } catch (err) {
            setError(err.response?.data?.error || 'Error en automatización Web');
            setLogs(prev => [...prev, 'Error: Fallo en la automatización.']);
        } finally {
            setLoading(false);
            eventSource.close();
        }
    };

    const handleRunUnity = async () => {
        setLoading(true);
        setError('');
        setLogs(['Iniciando automatización Unity (Escritorio)...', 'Verificando proceso OnBase...']);
        
        try {
            const res = await axios.post('/api/automation/unity-execute', { 
                action: 'radicacion_correspondencia',
                data: unityData
            });
            setLogs(prev => [...prev, ...res.data.logs, 'Comandos enviados a Unity.']);
        } catch (err) {
            setError(err.response?.data?.error || 'Error en automatización Unity');
            setLogs(prev => [...prev, 'Error: No se pudo interactuar con Unity.']);
        } finally {
            setLoading(false);
        }
    };

    const webSteps = [
        { title: 'Navegación', description: 'Abrir URL de OnBase Web Client.' },
        { title: 'Autenticación', description: 'Credenciales del sistema.' },
        { title: 'Menú Grid', description: 'Apertura del lanzador de apps.' },
        { title: 'Nuevo Formulario', description: 'Opción de ingreso documental.' },
        { title: 'Filtrar SGDEA', description: 'Selección de proceso SENA.' },
        { title: 'Indexación', description: 'Cargue automático de metadatos.' },
        { title: 'Importar Archivo', description: 'Cargue físico del documento.' },
        { title: 'Finalizar', description: 'Guardado de cambios en BD.' }
    ];

    const unitySteps = [
        { title: 'Detección', description: 'Búsqueda del proceso OnBase.' },
        { title: 'Activación', description: 'Enfoque de ventana Unity.' },
        { title: 'Navegación', description: 'Atajo Alt+F+N.' },
        { title: 'Diligenciamiento', description: 'Escritura de campos remota.' }
    ];

    const getCurrentStep = () => {
        if (!loading && logs.length === 0) return -1;
        const lastLog = logs[logs.length - 1] || '';
        
        if (activeTab === 'web') {
            if (lastLog.includes('Navigating')) return 0;
            if (lastLog.includes('login fields')) return 1;
            if (lastLog.includes('menu icon')) return 2;
            if (lastLog.includes('Nuevo formulario')) return 3;
            if (lastLog.includes('Filtering for')) return 4;
            if (lastLog.includes('keywords')) return 5;
            if (lastLog.includes('Importar')) return 6;
            if (lastLog.includes('saved successfully')) return 7;
            return loading ? 0 : -1;
        } else {
            if (lastLog.includes('Verificando')) return 0;
            if (lastLog.includes('Generando script')) return 1;
            if (lastLog.includes('Alt+F')) return 2;
            if (lastLog.includes('Resultado')) return 3;
            return loading ? 0 : -1;
        }
    }

    return (
        <div className="automation-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Módulo de Automatización</h2>
                <div style={{ display: 'flex', gap: '5px', background: '#eee', padding: '4px', borderRadius: '8px' }}>
                    <button 
                        onClick={() => setActiveTab('web')}
                        className={`btn ${activeTab === 'web' ? 'btn-primary' : ''}`}
                        style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Globe size={16} /> Web Client
                    </button>
                    <button 
                        onClick={() => setActiveTab('unity')}
                        className={`btn ${activeTab === 'unity' ? 'btn-primary' : ''}`}
                        style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Monitor size={16} /> Unity Desktop
                    </button>
                </div>
                
                <div style={{ display: 'flex', gap: '5px', border: '1px solid #ddd', padding: '3px', borderRadius: '8px' }}>
                    <button 
                        onClick={() => setViewMode('visual')}
                        className={`btn ${viewMode === 'visual' ? 'btn-secondary' : ''}`}
                        style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', border: 'none' }}
                    > Visual </button>
                    <button 
                        onClick={() => setViewMode('workflow')}
                        className={`btn ${viewMode === 'workflow' ? 'btn-secondary' : ''}`}
                        style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', border: 'none' }}
                    > <ListTree size={14} style={{ verticalAlign: 'middle' }} /> Flujo </button>
                </div>
            </div>

            <div className="workspace" style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: '1' }}>
                    {activeTab === 'web' ? (
                        <div className="card">
                            <h3>OnBase Web Automation</h3>
                            <div className="form-group">
                                <label>URL de Inicio</label>
                                <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." style={{ width: '100%', marginBottom: '10px' }} />
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Usuario" style={{ flex: 1 }} />
                                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" style={{ flex: 1 }} />
                                </div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <button 
                                        className="btn btn-secondary" 
                                        onClick={handleSaveSettings} 
                                        disabled={saving} 
                                        style={{ flex: 1, padding: '8px', fontSize: '13px' }}
                                    >
                                        {saving ? 'Guardando...' : '💾 Guardar Configuración'}
                                    </button>
                                    <button 
                                        className="btn btn-primary" 
                                        onClick={handleRunWeb} 
                                        disabled={loading} 
                                        style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    >
                                        {loading ? 'Procesando...' : <><Play size={18} /> Iniciar Flujo Web</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="card">
                            <h3>Radicación de Correspondencia (Unity)</h3>
                            <div className="form-group">
                                <label>Asunto / Descripción</label>
                                <input 
                                    type="text" 
                                    value={unityData.asunto} 
                                    onChange={e => setUnityData({...unityData, asunto: e.target.value})} 
                                    placeholder="Ej: Solicitud de información" 
                                    style={{ width: '100%', marginBottom: '10px' }} 
                                />
                                <label>Remitente</label>
                                <input 
                                    type="text" 
                                    value={unityData.remitente} 
                                    onChange={e => setUnityData({...unityData, remitente: e.target.value})} 
                                    placeholder="Nombre o ID del remitente" 
                                    style={{ width: '100%', marginBottom: '10px' }} 
                                />
                                <label>Tipo de Correspondencia</label>
                                <select 
                                    value={unityData.tipo} 
                                    onChange={e => setUnityData({...unityData, tipo: e.target.value})} 
                                    style={{ width: '100%', marginBottom: '15px', padding: '8px' }}
                                >
                                    <option>Entrante</option>
                                    <option>Saliente</option>
                                    <option>Interna</option>
                                </select>
                                <button className="btn btn-primary" onClick={handleRunUnity} disabled={loading} style={{ width: '100%' }}>
                                    {loading ? 'Ejecutando script...' : <><FileInput size={18} /> Radicar en Unity</>}
                                </button>
                                <small style={{ display: 'block', marginTop: '10px', color: '#666' }}>
                                    Asegúrese de que OnBase Unity esté abierto en la pantalla de Radicación.
                                </small>
                            </div>
                        </div>
                    )}

                    <div className="card" style={{ marginTop: '20px' }}>
                        <h3>Logs de Ejecución</h3>
                        <div style={{ background: '#1e1e1e', color: '#0f0', padding: '10px', borderRadius: '4px', height: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '13px' }}>
                            {logs.map((log, i) => <div key={i}>&gt; {log}</div>)}
                            {loading && <div className="blink">&gt; _</div>}
                        </div>
                        {error && <div style={{ color: 'red', marginTop: '10px', fontSize: '14px' }}><AlertCircle size={16} inline /> {error}</div>}
                    </div>
                </div>

                <div style={{ flex: '1' }}>
                    <div className="card" style={{ height: '100%', minHeight: '400px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                           <h3>{viewMode === 'visual' ? (activeTab === 'web' ? 'Vista en Vivo' : 'Vigilancia Unity') : 'Diagrama de Flujo'}</h3>
                           {loading && <div style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 'bold' }}>EJECUTANDO...</div>}
                        </div>

                        {viewMode === 'workflow' ? (
                            <div style={{ background: '#f9fafb', borderRadius: '12px', height: 'calc(100% - 40px)', overflowY: 'auto' }}>
                                <ProcessFlow 
                                    steps={activeTab === 'web' ? webSteps : unitySteps} 
                                    currentStep={getCurrentStep()} 
                                />
                            </div>
                        ) : activeTab === 'web' ? (
                            liveFrame ? (
                                <div style={{ border: '2px solid #000', borderRadius: '4px', overflow: 'hidden', background: '#000' }}>
                                    <img src={liveFrame} alt="Live Stream" style={{ width: '100%', display: 'block' }} />
                                    <div style={{ background: '#ff0000', color: '#fff', fontSize: '10px', padding: '2px 8px', fontWeight: 'bold' }}>LIVE</div>
                                </div>
                            ) : screenshot ? (
                                <div>
                                    <img src={screenshot} alt="Visual Result" style={{ width: '100%', border: '1px solid #ddd' }} />
                                    <div style={{ background: '#666', color: '#fff', fontSize: '10px', padding: '2px 8px' }}>CAPTURA FINAL</div>
                                </div>
                            ) : (
                                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', border: '2px dashed #ddd', color: '#999' }}>
                                    {loading ? 'Cargando video en vivo...' : 'Esperando ejecución...'}
                                </div>
                            )
                        ) : (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                                <Monitor size={48} style={{ marginBottom: '10px', opacity: 0.5 }} />
                                <p>La automatización Unity se ejecuta directamente en su escritorio.</p>
                                <p style={{ fontSize: '12px' }}>Revise los logs para confirmar el estado de las pulsaciones de teclado.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Automation;
