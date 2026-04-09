import { useState, useEffect } from 'react';
import axios from 'axios';
import { LayoutDashboard, CheckCircle, Clock, Star, Zap,Shield, ArrowRight } from 'lucide-react';

export default function Dashboard() {
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState({ pending: 0, completed: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        setUser(storedUser);
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await axios.get('/api/documents/stats/summary');
            setStats(res.data.data);
        } catch (err) {
            console.error("Error fetching stats:", err);
        } finally {
            setLoading(false);
        }
    };

    const benefits = [
        { 
            icon: <Zap className="text-yellow-500" />, 
            title: "Automatización Inteligente", 
            description: "Carga y clasifica documentos de forma automática en OnBase, reduciendo el error manual." 
        },
        { 
            icon: <Shield className="text-green-500" />, 
            title: "Cumplimiento TRD", 
            description: "Asegura que todos tus expedientes sigan la Tabla de Retención Documental vigente." 
        },
        { 
            icon: <Star className="text-purple-500" />, 
            title: "Eficiencia Operativa", 
            description: "Generación masiva de cartas y gestión centralizada desde OneDrive." 
        }
    ];

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Bienvenida */}
            <div className="bg-gradient-to-r from-purple-700 to-indigo-800 rounded-2xl p-8 mb-8 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold mb-2">¡Bienvenido, {user?.name || 'Usuario'}! 🚀</h1>
                    <p className="text-purple-100 text-lg opacity-90">
                        Tu panel de control para la gestión documental inteligente está listo. 
                        ¿Qué vamos a optimizar hoy?
                    </p>
                </div>
                <LayoutDashboard className="absolute right-0 bottom-0 text-white opacity-10 w-64 h-64 -mb-12 -mr-12" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Actividades Pendientes - Resumen */}
                <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
                        <Clock className="text-orange-500" /> Actividades Pendientes del Día
                    </h2>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-orange-50 p-4 rounded-lg flex items-center gap-4 border border-orange-100 hover:shadow-md transition-shadow">
                            <div className="bg-orange-500 p-3 rounded-full text-white">
                                <FileText size={24} />
                            </div>
                            <div>
                                <span className="block text-2xl font-bold text-orange-700">{loading ? '...' : stats.pending}</span>
                                <span className="text-sm text-orange-600 font-medium">Documentos por cargar</span>
                            </div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg flex items-center gap-4 border border-green-100 hover:shadow-md transition-shadow">
                            <div className="bg-green-500 p-3 rounded-full text-white">
                                <CheckCircle size={24} />
                            </div>
                            <div>
                                <span className="block text-2xl font-bold text-green-700">{loading ? '...' : stats.completed}</span>
                                <span className="text-sm text-green-600 font-medium">Cargas completadas hoy</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6">
                        <p className="text-sm text-gray-500 mb-4 italic">
                            Tienes {stats.pending} documentos en estado "Pendiente" esperando ser procesados en el módulo de Cargue AES.
                        </p>
                        <button className="flex items-center gap-2 text-indigo-600 font-bold hover:gap-3 transition-all">
                            Ir a Gestionar Documentos <ArrowRight size={18} />
                        </button>
                    </div>
                </div>

                {/* Beneficios Rápidos */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
                    <h2 className="text-xl font-bold mb-4 text-gray-800">Beneficios Clave</h2>
                    <ul className="space-y-4">
                        {benefits.map((b, i) => (
                            <li key={i} className="flex gap-3">
                                <div className="mt-1">{b.icon}</div>
                                <div>
                                    <h4 className="font-bold text-sm text-gray-800">{b.title}</h4>
                                    <p className="text-xs text-gray-500 leading-relaxed">{b.description}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Acceso Rápido */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button className="p-4 bg-white border border-gray-100 rounded-xl hover:border-purple-300 hover:shadow-md transition-all text-left">
                    <span className="block font-bold text-gray-800 text-sm">Nuevo Expediente</span>
                    <span className="text-xs text-gray-400">Crear estructura de archivo</span>
                </button>
                <button className="p-4 bg-white border border-gray-100 rounded-xl hover:border-purple-300 hover:shadow-md transition-all text-left">
                    <span className="block font-bold text-gray-800 text-sm">Gestionar Documentos</span>
                    <span className="text-xs text-gray-400">Subir archivos a carpetas</span>
                </button>
                <button className="p-4 bg-white border border-gray-100 rounded-xl hover:border-purple-300 hover:shadow-md transition-all text-left">
                    <span className="block font-bold text-gray-800 text-sm">Cargue AES</span>
                    <span className="text-xs text-gray-400">Automatizar en OnBase</span>
                </button>
                <button className="p-4 bg-white border border-gray-100 rounded-xl hover:border-purple-300 hover:shadow-md transition-all text-left">
                    <span className="block font-bold text-gray-800 text-sm">Consulta Global</span>
                    <span className="text-xs text-gray-400">Buscar en toda la base</span>
                </button>
            </div>
        </div>
    );
}

// Re-import icon because of scope
import { FileText } from 'lucide-react';
