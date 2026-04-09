import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Globe, Shield, RefreshCw } from 'lucide-react';

function AesSettings() {
    const [settings, setSettings] = useState({
        ades_url: '',
        ades_username: '',
        ades_password: ''
    });
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
                ades_password: res.data.ades_password || ''
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
            <h2>Configuración de AES (OnBase)</h2>
            <p className="text-muted" style={{ marginBottom: '20px' }}>Establezca los parámetros de conexión para el cargue automático.</p>

            <form onSubmit={handleSave}>
                <div className="card" style={{ maxWidth: '600px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                        <Globe size={24} color="#4caf50" />
                        <h3 style={{ margin: 0 }}>Acceso al Sistema</h3>
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

                    {message.text && (
                        <div className={`status ${message.type}`} style={{ marginTop: '15px' }}>
                            {message.text}
                        </div>
                    )}

                    <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                        <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Save size={18} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                        <button type="button" onClick={fetchSettings} className="btn btn-secondary" disabled={saving}>
                            <RefreshCw size={18} /> Reestablecer
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}

export default AesSettings;
