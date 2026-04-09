import { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, Save, RefreshCw, Check, X } from 'lucide-react';

const MODULE_LABELS = {
    'dashboard': 'Dashboard',
    'trd': 'Estructura y TRD',
    'expedientes': 'Crear Expedientes',
    'documents': 'Gestión Documental',
    'query': 'Consulta de Documentos',
    'mass-upload': 'Cargue Masivo',
    'cargue-aes': 'Cargue AES',
    'letters': 'Cartas Masivas',
    'onedrive': 'Config. OneDrive',
    'config-aes': 'Config. AES',
    'automation': 'Automatización',
    'users': 'Usuarios',
    'permissions': 'Permisos',
    'trd_query': 'Consulta TRD',
    'formatos': 'Formatos (FUID/Control)'
};

const ROLES = ['admin', 'user'];

export default function PermissionsManagement() {
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState('');

    useEffect(() => {
        fetchPermissions();
    }, []);

    const fetchPermissions = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/permissions');
            setPermissions(res.data.data);
        } catch (err) {
            console.error("Error fetching permissions:", err);
            setStatus('Error al cargar permisos');
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = async (role, moduleId, currentValue) => {
        const newValue = currentValue === 1 ? 0 : 1;
        setSaving(true);
        try {
            await axios.post('/api/permissions/update', {
                role,
                module_id: moduleId,
                can_view: newValue
            });
            
            // Update local state
            setPermissions(prev => prev.map(p => 
                (p.role_name === role && p.module_id === moduleId) 
                ? { ...p, can_view: newValue } 
                : p
            ));
            
            setStatus('Permiso actualizado correctamente');
            setTimeout(() => setStatus(''), 3000);
        } catch (err) {
            console.error("Error updating permission:", err);
            setStatus('Error al actualizar permiso');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async (role) => {
        if (!window.confirm(`¿Desea restablecer todos los permisos para el rol ${role}? Todos los accesos se desactivarán.`)) return;
        
        try {
            await axios.post('/api/permissions/reset', { role });
            fetchPermissions();
            setStatus('Permisos restablecidos');
        } catch (err) {
            setStatus('Error al restablecer');
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500"><RefreshCw className="animate-spin inline mr-2" /> Cargando permisos...</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Shield className="text-purple-600" /> Control de Accesos por Rol
                </h1>
                {status && (
                    <div className={`px-4 py-2 rounded text-sm font-medium ${status.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {status}
                    </div>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="p-4 font-bold">Módulo / Funcionalidad</th>
                                {ROLES.map(role => (
                                    <th key={role} className="p-4 text-center font-bold">
                                        ROL: <span className="text-purple-700 uppercase">{role}</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {Object.entries(MODULE_LABELS).map(([moduleId, label]) => (
                                <tr key={moduleId} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 font-medium text-gray-700">
                                        {label} <span className="text-[10px] text-gray-400 block uppercase">{moduleId}</span>
                                    </td>
                                    {ROLES.map(role => {
                                        const perm = permissions.find(p => p.role_name === role && p.module_id === moduleId);
                                        const isAllowed = perm ? perm.can_view === 1 : false;
                                        
                                        return (
                                            <td key={role} className="p-4 text-center">
                                                <button
                                                    onClick={() => togglePermission(role, moduleId, isAllowed ? 1 : 0)}
                                                    disabled={saving}
                                                    className={`w-12 h-6 rounded-full transition-all relative ${isAllowed ? 'bg-green-500' : 'bg-gray-300'}`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${isAllowed ? 'left-7' : 'left-1'}`}></div>
                                                </button>
                                                <div className="text-[9px] mt-1 uppercase font-bold text-gray-400">
                                                    {isAllowed ? <span className="text-green-600">Visible</span> : 'Oculto'}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-between">
                    <div className="text-xs text-gray-500 italic flex items-center gap-1">
                         Los cambios se aplican automáticamente y se reflejarán al recargar el sidebar.
                    </div>
                    <div className="flex gap-2">
                        {ROLES.map(role => (
                            <button 
                                key={role}
                                onClick={() => handleReset(role)}
                                className="text-[10px] text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-50 uppercase font-bold"
                            >
                                Reiniciar {role}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
