import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, HardDrive, RefreshCw, Folder } from 'lucide-react';

function OneDriveSettings() {
    const [storagePath, setStoragePath] = useState('');
    const [dependencies, setDependencies] = useState([]);
    const [trdData, setTrdData] = useState({}); // { depId: [tree] }
    const [loading, setLoading] = useState(true);
    const [loadingTrd, setLoadingTrd] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    // Hierarchy Editor State
    const [editingItem, setEditingItem] = useState(null); // { type, id, name, hierarchy }
    const [tempHierarchy, setTempHierarchy] = useState([]);

    const baseOptions = [
        { value: 'reg', label: 'Código Regional' },
        { value: 'ctr', label: 'Código Centro' },
        { value: 'dep', label: 'Código Dependencia (Sola)' },
        { value: 'dep_conc', label: 'Código Dependencia (Concatenada)' },
        { value: 'ser', label: 'Código Serie' },
        { value: 'ser_name', label: 'Nombre Serie' },
        { value: 'ser_conc', label: 'Código Serie (Concatenada)' },
        { value: 'sub', label: 'Código Subserie' },
        { value: 'sub_name', label: 'Nombre Subserie' },
        { value: 'sub_conc', label: 'Código Subserie (Concatenada)' },
        { value: 'typ_val', label: 'Valor del Tipo (OnBase/AES)' },
        { value: 'meta_1', label: 'Valor 1' },
        { value: 'meta_2', label: 'Valor 2' },
        { value: 'meta_3', label: 'Valor 3' },
        { value: 'meta_4', label: 'Valor 4' },
        { value: 'meta_5', label: 'Valor 5' },
        { value: 'meta_6', label: 'Valor 6' },
        { value: 'meta_7', label: 'Valor 7' },
        { value: 'meta_8', label: 'Valor 8' }
    ];

    const getOptions = () => baseOptions;

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const pathRes = await axios.get('/api/settings/storage_path', {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            setStoragePath(pathRes.data.value || '');
        } catch (err) {
            console.error("Error fetching settings:", err);
            setMessage({ text: 'Error al cargar la ruta base', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const fetchTrds = async () => {
        setLoadingTrd(true);
        try {
            const token = localStorage.getItem('token');
            const opts = { headers: token ? { Authorization: `Bearer ${token}` } : {} };
            
            const orgRes = await axios.get('/api/organization', opts);
            const deps = orgRes.data.data;
            setDependencies(deps);

            const trdMap = {};
            for (const dep of deps) {
                try {
                    const trdRes = await axios.get(`/api/trd/${dep.id}`, opts);
                    trdMap[dep.id] = trdRes.data;
                } catch (e) {
                    console.error(`Error fetching TRD for dep ${dep.id}:`, e);
                }
            }
            setTrdData(trdMap);
        } catch (err) {
            console.error("Error fetching TRD info:", err);
        } finally {
            setLoadingTrd(false);
        }
    };

    useEffect(() => {
        fetchSettings();
        fetchTrds();
    }, []);

    const startEditing = (type, item) => {
        const defaultHierarchy = [
            { id: '1', type: 'reg', label: 'Código Regional' },
            { id: '2', type: 'ctr', label: 'Código Centro' },
            { id: '3', type: 'dep', label: 'Código Dependencia' },
            { id: '4', type: 'ser', label: 'Código Serie' },
            { id: '5', type: 'sub', label: 'Código Subserie' },
            { id: '6', type: 'meta_1', label: 'Valor 1' },
            { id: '7', type: 'meta_2', label: 'Valor 2' }
        ];
        setEditingItem({
            type,
            id: item.id,
            name: item.name || item.code,
        });
        setTempHierarchy(item.folder_hierarchy || defaultHierarchy);
    };

    const addLevel = () => {
        const newId = (tempHierarchy.length + 1).toString();
        const firstMeta = getOptions().find(o => o.value === 'meta_1');
        setTempHierarchy([...tempHierarchy, { id: newId, type: 'meta_1', label: firstMeta.label }]);
    };

    const removeLevel = (id) => {
        setTempHierarchy(tempHierarchy.filter(item => item.id !== id));
    };

    const updateLevelType = (id, type) => {
        const option = getOptions().find(o => o.value === type);
        setTempHierarchy(tempHierarchy.map(item => item.id === id ? { ...item, type, label: option.label } : item));
    };



    const saveHierarchy = async () => {
        setSaving(true);
        try {
            console.log('[DEBUG] Saving hierarchy for:', editingItem);
            const token = localStorage.getItem('token');
            const response = await axios.post('/api/trd/hierarchy', {
                type: editingItem.type,
                id: editingItem.id,
                hierarchy: tempHierarchy
            }, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            console.log('[DEBUG] Save response:', response.data);

            setMessage({ text: `✅ Configuración de carpetas guardada correctamente`, type: 'success' });
            setEditingItem(null);
            fetchTrds();
        } catch (err) {
            console.error("Error saving hierarchy:", err);
            const errMsg = err.response?.data?.error || err.message || 'Error desconocido';
            setMessage({ text: `❌ Error al guardar: ${errMsg}`, type: 'error' });
        } finally {
            setSaving(false);
        }
    };


    const handleSavePath = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ text: '', type: '' });
        
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/settings', { key: 'storage_path', value: storagePath }, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            setMessage({ text: 'Ruta de OneDrive guardada exitosamente', type: 'success' });
        } catch (err) {
            console.error("Error saving path:", err);
            setMessage({ text: 'Error al guardar la ruta', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-4">Cargando configuración de OneDrive...</div>;

    return (
        <div className="settings-container">
            <style>{`
                .hierarchy-builder-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                }
                .hierarchy-modal {
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    width: 100%;
                    max-width: 650px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                    max-height: 90vh;
                    overflow-y: auto;
                }
                .btn-config {
                    background: #f0f4f8;
                    color: #1976d2;
                    border: 1px solid #1976d2;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    transition: all 0.2s;
                }
                .btn-config:hover {
                    background: #1976d2;
                    color: white;
                }
                .hierarchy-summary {
                    font-size: 11px;
                    color: #666;
                    margin-top: 4px;
                    display: block;
                    font-style: italic;
                }
                .level-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 10px;
                    background: #f8f9fa;
                    padding: 10px;
                    border-radius: 6px;
                    border-left: 4px solid #ff9800;
                }

            `}</style>

            <h2>Configuración de OneDrive</h2>
            <p className="text-muted" style={{ marginBottom: '20px' }}>Defina la ruta base y configure la estructura de carpetas para cada Serie o Subserie.</p>

            <form onSubmit={handleSavePath}>
                <div className="card" style={{ maxWidth: '600px', marginBottom: '30px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                        <HardDrive size={24} color="#1976d2" />
                        <h3 style={{ margin: 0 }}>Ruta del Repositorio</h3>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Ruta Local (Carpeta OneDrive)</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input 
                                type="text" 
                                value={storagePath} 
                                onChange={(e) => setStoragePath(e.target.value)} 
                                placeholder="C:\\Users\\...\\OneDrive\\Documentos" 
                                required
                                style={{ flex: 1 }}
                            />
                            <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>
                                <Save size={18} />
                            </button>
                        </div>
                        <small style={{ color: '#666' }}>Ruta base donde se crearán las subcarpetas dinámicas.</small>
                    </div>

                    {message.text && (
                        <div className={`status ${message.type}`} style={{ marginTop: '15px' }}>
                            {message.text}
                        </div>
                    )}
                </div>
            </form>

            {/* TRD Visualization & Config */}
            <div className="trd-visualization">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                    <RefreshCw size={24} color="#4caf50" className={loadingTrd ? 'spin' : ''} />
                    <h3 style={{ margin: 0 }}>Estructura TRD y Configuración de Carpetas</h3>
                </div>
                
                {loadingTrd ? (
                    <p>Cargando listado de TRDs...</p>
                ) : (
                    <div className="trd-table-container">
                        {dependencies.map(dep => (
                            <div key={dep.id} className="dependency-section" style={{ marginBottom: '25px', background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
                                <h4 style={{ color: '#1976d2', borderBottom: '2px solid #1976d2', paddingBottom: '5px' }}>
                                    Dependencia: {dep.subsection_code} - {dep.subsection_name || dep.section_name}
                                </h4>
                                
                                <div style={{ marginTop: '10px' }}>
                                    {trdData[dep.id] && trdData[dep.id].length > 0 ? (
                                        <table className="trd-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                                                    <th style={{ padding: '10px', border: '1px solid #eee' }}>Serie</th>
                                                    <th style={{ padding: '10px', border: '1px solid #eee' }}>Subserie</th>
                                                    <th style={{ padding: '10px', border: '1px solid #eee', width: '250px' }}>Configuración Carpeta</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {trdData[dep.id].map(series => (
                                                    series.subseries && series.subseries.length > 0 ? (
                                                        series.subseries.map((sub, idx) => (
                                                            <tr key={`${series.id}-${sub.id}`}>
                                                                {idx === 0 && (
                                                                    <td rowSpan={series.subseries.length} style={{ padding: '10px', border: '1px solid #eee', verticalAlign: 'top' }}>
                                                                        <div style={{ fontWeight: 'bold' }}>{series.code}</div>
                                                                        <div style={{ fontSize: '12px' }}>{series.name}</div>
                                                                    </td>
                                                                )}
                                                                <td style={{ padding: '10px', border: '1px solid #eee' }}>
                                                                    <div style={{ fontWeight: 'bold' }}>{sub.code}</div>
                                                                    <div style={{ fontSize: '12px' }}>{sub.name}</div>
                                                                </td>
                                                                <td style={{ padding: '10px', border: '1px solid #eee' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                                                        <button className="btn-config" onClick={() => startEditing('subseries', sub)}>
                                                                            <Folder size={16} /> Configurar Niveles
                                                                        </button>
                                                                        {sub.folder_hierarchy ? (
                                                                            <span style={{ fontSize: '11px', background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: '12px', border: '1px solid #2e7d32', fontWeight: 'bold' }}>
                                                                                Configurado
                                                                            </span>
                                                                        ) : (
                                                                            <span style={{ fontSize: '11px', background: '#fff3e0', color: '#ef6c00', padding: '2px 8px', borderRadius: '12px', border: '1px solid #ef6c00', fontWeight: 'bold' }}>
                                                                                Pendiente
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {sub.folder_hierarchy && (
                                                                        <span className="hierarchy-summary">
                                                                            Estructura: {sub.folder_hierarchy.map(h => h.label).join(' > ')}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr key={series.id}>
                                                            <td style={{ padding: '10px', border: '1px solid #eee' }}>
                                                                <div style={{ fontWeight: 'bold' }}>{series.code}</div>
                                                                <div style={{ fontSize: '12px' }}>{series.name}</div>
                                                            </td>
                                                            <td style={{ padding: '10px', border: '1px solid #eee', color: '#888' }}>
                                                                (Serie Simple)
                                                            </td>
                                                            <td style={{ padding: '10px', border: '1px solid #eee' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                                                    <button className="btn-config" onClick={() => startEditing('series', series)}>
                                                                        <Folder size={16} /> Configurar Niveles
                                                                    </button>
                                                                    {series.folder_hierarchy ? (
                                                                        <span style={{ fontSize: '11px', background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: '12px', border: '1px solid #2e7d32', fontWeight: 'bold' }}>
                                                                            Configurado
                                                                        </span>
                                                                    ) : (
                                                                        <span style={{ fontSize: '11px', background: '#fff3e0', color: '#ef6c00', padding: '2px 8px', borderRadius: '12px', border: '1px solid #ef6c00', fontWeight: 'bold' }}>
                                                                            Pendiente
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {series.folder_hierarchy && (
                                                                    <span className="hierarchy-summary">
                                                                        Estructura: {series.folder_hierarchy.map(h => h.label).join(' > ')}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p className="text-muted">No hay series configuradas para esta dependencia.</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Hierarchy Editor Modal */}
            {editingItem && (
                <div className="hierarchy-builder-overlay">
                    <div className="hierarchy-modal">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <Folder size={28} color="#ff9800" />
                            <h3 style={{ margin: 0 }}>Configuración de Carpeta</h3>
                        </div>
                        <p style={{ marginBottom: '20px', fontSize: '14px', color: '#666' }}>
                            Configure la estructura de carpetas para: 
                            <strong style={{ color: '#333', display: 'block', marginTop: '5px' }}>{editingItem.name}</strong>
                        </p>
                        <p style={{ marginBottom: '15px', fontSize: '13px', background: '#e8f5e9', color: '#2e7d32', padding: '10px', borderRadius: '6px', border: '1px solid #a5d6a7' }}>
                            ℹ️ Las etiquetas de metadatos se obtienen automáticamente de los encabezados del Excel cargado en el Módulo de Creación Masiva.
                        </p>

                        <div style={{ marginBottom: '10px' }}>
                            <h4 style={{ fontSize: '14px', marginBottom: '10px', color: '#1976d2' }}>Niveles de Carpeta</h4>
                            <div className="levels-container">
                                {tempHierarchy.map((level, index) => (
                                    <div key={level.id} className="level-item">
                                        <span style={{ fontWeight: 'bold', minWidth: '70px' }}>Nivel {index + 1}:</span>
                                        <select 
                                            value={level.type} 
                                            onChange={(e) => updateLevelType(level.id, e.target.value)}
                                            style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                                        >
                                            {getOptions().map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                        <button className="btn-danger" onClick={() => removeLevel(level.id)} style={{ padding: '5px 10px' }}>
                                            &times;
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button className="btn btn-secondary" onClick={addLevel} style={{ width: '100%', marginTop: '10px', border: '1px dashed #666', background: '#fff', color: '#666' }}>
                            + Agregar Nivel de Carpeta
                        </button>

                        <div style={{ borderTop: '1px solid #eee', marginTop: '25px', paddingTop: '20px', display: 'flex', gap: '15px' }}>
                            <button className="btn btn-primary" onClick={saveHierarchy} disabled={saving} style={{ flex: 1, padding: '12px' }}>
                                {saving ? 'Guardando...' : 'Guardar Todo'}
                            </button>
                            <button className="btn btn-secondary" onClick={() => setEditingItem(null)} style={{ flex: 1, padding: '12px' }}>
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default OneDriveSettings;
