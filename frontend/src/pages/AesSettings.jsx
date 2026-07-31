import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Globe, RefreshCw, Brain, Key, Lock, FolderKey } from 'lucide-react';

function AesSettings() {
    const [settings, setSettings] = useState({
        ades_url: '',
        ades_username: '',
        ades_password: '',
        gemini_api_key: ''
    });
    const [dependenciesList, setDependenciesList] = useState([]);
    const [dependenciesCredentials, setDependenciesCredentials] = useState({}); // { depId: { user, pass } }
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [depSavingId, setDepSavingId] = useState(null);
    const [message, setMessage] = useState({ text: '', type: '' });

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
            
            // 1. Fetch general system settings
            const resSettings = await axios.get('/api/settings/all', { headers: authHeaders });
            setSettings({
                ades_url: resSettings.data.ades_url || '',
                ades_username: resSettings.data.ades_username || '',
                ades_password: resSettings.data.ades_password || '',
                gemini_api_key: resSettings.data.gemini_api_key || ''
            });

            // 2. Fetch dependencies list (organization_structure)
            const resDeps = await axios.get('/api/organization', { headers: authHeaders });
            const list = resDeps.data.data || [];
            setDependenciesList(list);

            // Rebuild dependencies credentials map
            const creds = {};
            list.forEach(d => {
                creds[d.id] = {
                    onbase_user: d.onbase_user || '',
                    onbase_pass: d.onbase_pass || ''
                };
            });
            setDependenciesCredentials(creds);

        } catch (err) {
            console.error("Error fetching AES settings:", err);
            setMessage({ text: 'Error al cargar la configuración de AES y Dependencias', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            setIsAdmin(user.role === 'admin' || user.role === 'superadmin');
        } catch (e) {
            console.error("Error loading user role in settings:", e);
        }
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleDepChange = (depId, field, value) => {
        setDependenciesCredentials(prev => ({
            ...prev,
            [depId]: {
                ...prev[depId],
                [field]: value
            }
        }));
    };

    const handleSaveGeneral = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ text: '', type: '' });
        
        try {
            const token = localStorage.getItem('token');
            const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
            const promises = Object.entries(settings).map(([key, value]) => 
                axios.post('/api/settings', { key, value }, { headers: authHeaders })
            );
            await Promise.all(promises);
            setMessage({ text: 'Configuración general guardada exitosamente', type: 'success' });
        } catch (err) {
            console.error("Error saving AES settings:", err);
            setMessage({ text: 'Error al guardar la configuración general', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveDepCreds = async (depId) => {
        setDepSavingId(depId);
        setMessage({ text: '', type: '' });
        try {
            const token = localStorage.getItem('token');
            const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
            const creds = dependenciesCredentials[depId] || { onbase_user: '', onbase_pass: '' };
            
            await axios.put(`/api/organization/${depId}`, {
                onbase_user: creds.onbase_user,
                onbase_pass: creds.onbase_pass
            }, { headers: authHeaders });

            setMessage({ text: 'Credenciales de la dependencia actualizadas con éxito', type: 'success' });
        } catch (err) {
            console.error("Error saving dependency credentials:", err);
            setMessage({ text: 'Error al guardar credenciales de la dependencia', type: 'error' });
        } finally {
            setDepSavingId(null);
        }
    };

    if (loading) return <div className="p-4">Cargando configuración de AES y Dependencias...</div>;

    return (
        <div className="settings-container" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
                Configuraciones del Sistema
            </h2>
            <p className="text-muted" style={{ color: '#4b5563', fontSize: '13px', marginBottom: '24px' }}>
                Establezca los parámetros de conexión de automatización y claves de servicios.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* CARD 1: General Web Client */}
                <form onSubmit={handleSaveGeneral} className="card" style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <Globe size={22} className="text-purple-600" />
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'semibold', color: '#1f2937' }}>
                            Acceso al Sistema ECM (OnBase / AES) - General
                        </h3>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '20px' }}>
                        <div className="form-group">
                            <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '6px', display: 'block' }}>
                                URL del Web Client (Única para todas las dependencias)
                            </label>
                            <input 
                                type="url" 
                                name="ades_url" 
                                value={settings.ades_url} 
                                onChange={handleChange} 
                                placeholder="http://onbase-server/AppNet" 
                                required
                                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                            />
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="form-group">
                                <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '6px', display: 'block' }}>
                                    Usuario General (Fallback)
                                </label>
                                <input 
                                    type="text" 
                                    name="ades_username" 
                                    value={settings.ades_username} 
                                    onChange={handleChange} 
                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                                />
                            </div>
                            
                            <div className="form-group">
                                <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '6px', display: 'block' }}>
                                    Contraseña General (Fallback)
                                </label>
                                <input 
                                    type="password" 
                                    name="ades_password" 
                                    value={settings.ades_password} 
                                    onChange={handleChange} 
                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px' }}>
                            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Configuración General'}
                        </button>
                    </div>
                </form>

                {/* CARD 2: Credenciales específicas por Dependencia */}
                <div className="card" style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                        <FolderKey size={22} className="text-purple-600" />
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'semibold', color: '#1f2937' }}>
                            Usuarios de OnBase específicos por Dependencia (Estructura Organizacional)
                        </h3>
                    </div>
                    <p style={{ color: '#6b7280', fontSize: '12px', marginBottom: '20px', lineHeight: '1.4' }}>
                        Configure credenciales personalizadas para cada dependencia. Si se dejan en blanco, el automatizador usará el Usuario General (Fallback) configurado arriba.
                    </p>

                    <div style={{ overflowX: 'auto' }}>
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #f3f4f6', color: '#4b5563' }}>
                                    <th style={{ padding: '10px 8px', fontWeight: '600' }}>Código</th>
                                    <th style={{ padding: '10px 8px', fontWeight: '600' }}>Nombre Dependencia</th>
                                    <th style={{ padding: '10px 8px', fontWeight: '600' }}>Sección / Tipo</th>
                                    <th style={{ padding: '10px 8px', fontWeight: '600', width: '200px' }}>Usuario OnBase</th>
                                    <th style={{ padding: '10px 8px', fontWeight: '600', width: '200px' }}>Contraseña OnBase</th>
                                    <th style={{ padding: '10px 8px', fontWeight: '600', width: '90px', textAlign: 'center' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dependenciesList.map(d => {
                                    const cred = dependenciesCredentials[d.id] || { onbase_user: '', onbase_pass: '' };
                                    const depName = d.subsection_name || d.section_name;
                                    const depCode = d.subsection_code || d.section_code || 'N/A';
                                    const sectionType = d.subsection_name ? 'Subsección' : 'Sección Principal';
                                    
                                    return (
                                        <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '12px 8px', fontWeight: '500', color: '#374151' }}>
                                                {depCode}
                                            </td>
                                            <td style={{ padding: '12px 8px', color: '#1f2937', fontWeight: '500' }}>
                                                {depName}
                                            </td>
                                            <td style={{ padding: '12px 8px', color: '#6b7280', fontStyle: 'italic' }}>
                                                {sectionType}
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                <div style={{ position: 'relative' }}>
                                                    <Key size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                                                    <input 
                                                        type="text" 
                                                        value={cred.onbase_user}
                                                        onChange={(e) => handleDepChange(d.id, 'onbase_user', e.target.value)}
                                                        placeholder="Usuario OnBase"
                                                        style={{ width: '100%', padding: '6px 8px 6px 26px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                                                    />
                                                </div>
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                <div style={{ position: 'relative' }}>
                                                    <Lock size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                                                    <input 
                                                        type="password" 
                                                        value={cred.onbase_pass}
                                                        onChange={(e) => handleDepChange(d.id, 'onbase_pass', e.target.value)}
                                                        placeholder="••••••••"
                                                        style={{ width: '100%', padding: '6px 8px 6px 26px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px' }}
                                                    />
                                                </div>
                                            </td>
                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveDepCreds(d.id)}
                                                    disabled={depSavingId === d.id}
                                                    className="btn btn-primary"
                                                    style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px', width: '100%' }}
                                                >
                                                    {depSavingId === d.id ? 'Guardando' : 'Guardar'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* CARD 3: Gemini IA */}
                {isAdmin && (
                    <div className="card" style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                            <Brain size={22} className="text-purple-600" />
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'semibold', color: '#1f2937' }}>
                                Inteligencia Artificial (Gemini)
                            </h3>
                        </div>
                        
                        <div className="form-group">
                            <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '6px', display: 'block' }}>
                                Gemini API Key
                            </label>
                            <input 
                                type="password" 
                                name="gemini_api_key" 
                                value={settings.gemini_api_key} 
                                onChange={handleChange} 
                                placeholder="AIzaSy..." 
                                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                            />
                            <small style={{ color: '#6b7280', marginTop: '6px', display: 'block', lineHeight: '1.4', fontSize: '11px' }}>
                                Obtenga una clave API gratuita en <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#7c3aed', fontWeight: 'bold', textDecoration: 'underline' }}>Google AI Studio</a> para habilitar las clasificaciones, resúmenes y asistente de chat de IA.
                            </small>
                        </div>
                    </div>
                )}

                {message.text && (
                    <div className={`status ${message.type}`} style={{ padding: '12px', borderRadius: '8px', border: '1px solid', fontSize: '13px', backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2', borderColor: message.type === 'success' ? '#bbf7d0' : '#fca5a5', color: message.type === 'success' ? '#15803d' : '#b91c1c' }}>
                        {message.text}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={fetchSettings} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px' }}>
                        <RefreshCw size={16} /> Reestablecer todo
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AesSettings;
