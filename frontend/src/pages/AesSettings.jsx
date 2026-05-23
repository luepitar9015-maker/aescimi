import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Globe, Shield, RefreshCw, Brain } from 'lucide-react';

function AesSettings() {
    const [settings, setSettings] = useState({
        ades_url: '',
        ades_username: '',
        ades_password: '',
        gemini_api_key: ''
    });
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/settings/all', {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            setSettings({
                ades_url: res.data.ades_url || '',
                ades_username: res.data.ades_username || '',
                ades_password: res.data.ades_password || '',
                gemini_api_key: res.data.gemini_api_key || ''
            });
        } catch (err) {
            console.error("Error fetching AES settings:", err);
            setMessage({ text: 'Error al cargar la configuración de AES', type: 'error' });
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

    const handleSave = async (e) => {
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
            setMessage({ text: 'Configuración de AES guardada exitosamente', type: 'success' });
        } catch (err) {
            console.error("Error saving AES settings:", err);
            setMessage({ text: 'Error al guardar la configuración de AES', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-4">Cargando configuración de AES...</div>;

    return (
        <div className="settings-container">
            <h2>Configuraciones del Sistema</h2>
            <p className="text-muted" style={{ marginBottom: '20px' }}>Establezca los parámetros de conexión de automatización y claves de servicios.</p>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="card" style={{ maxWidth: '600px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                        <Globe size={24} color="#39a900" />
                        <h3 style={{ margin: 0 }}>Acceso al Sistema ECM (OnBase / AES)</h3>
                    </div>
                    
                    <div className="form-group">
                        <label>URL del Web Client</label>
                        <input 
                            type="url" 
                            name="ades_url" 
                            value={settings.ades_url} 
                            onChange={handleChange} 
                            placeholder="http://onbase-server/AppNet" 
                            required
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Usuario</label>
                        <input 
                            type="text" 
                            name="ades_username" 
                            value={settings.ades_username} 
                            onChange={handleChange} 
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Contraseña</label>
                        <input 
                            type="password" 
                            name="ades_password" 
                            value={settings.ades_password} 
                            onChange={handleChange} 
                        />
                    </div>
                </div>

                {isAdmin && (
                    <div className="card" style={{ maxWidth: '600px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                            <Brain size={24} color="#39a900" />
                            <h3 style={{ margin: 0 }}>Inteligencia Artificial (Gemini)</h3>
                        </div>
                        
                        <div className="form-group">
                            <label>Gemini API Key</label>
                            <input 
                                type="password" 
                                name="gemini_api_key" 
                                value={settings.gemini_api_key} 
                                onChange={handleChange} 
                                placeholder="AIzaSy..." 
                            />
                            <small style={{ color: '#666', marginTop: '6px', display: 'block', lineHeight: '1.4' }}>
                                Obtenga una clave API gratuita en <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#39a900', fontWeight: 'bold', textDecoration: 'underline' }}>Google AI Studio</a> para habilitar las clasificaciones, resúmenes y asistente de chat de IA.
                            </small>
                        </div>
                    </div>
                )}

                {message.text && (
                    <div className={`status ${message.type}`} style={{ maxWidth: '600px', padding: '10px', borderRadius: '8px', border: '1px solid' }}>
                        {message.text}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '10px', maxWidth: '600px' }}>
                    <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <Save size={18} /> {saving ? 'Guardando...' : 'Guardar Configuraciones'}
                    </button>
                    <button type="button" onClick={fetchSettings} className="btn btn-secondary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <RefreshCw size={18} /> Reestablecer
                    </button>
                </div>
            </form>
        </div>
    );
}

export default AesSettings;
