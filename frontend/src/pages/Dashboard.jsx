import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    LayoutDashboard, CheckCircle, Clock, FileText,
    Network, FolderKanban, Folder, Globe, Play,
    Upload, FileSpreadsheet, Database, Cloud,
    Settings, Shield, User, ChevronRight, Star,
    Lock, Zap
} from 'lucide-react';

// Catálogo completo de módulos con sus rutas, íconos y colores
const MODULOS_CATALOGO = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        desc: 'Panel principal del sistema',
        ruta: '/dashboard',
        icon: LayoutDashboard,
        color: 'from-purple-500 to-indigo-600',
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-700',
    },
    {
        id: 'trd',
        label: 'Estructura y TRD',
        desc: 'Gestión de series, subseries y estructura documental',
        ruta: '/creation',
        icon: Network,
        color: 'from-blue-500 to-cyan-600',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-700',
    },
    {
        id: 'expedientes',
        label: 'Crear Expedientes',
        desc: 'Creación y gestión de expedientes',
        ruta: '/expedientes',
        icon: FolderKanban,
        color: 'from-orange-500 to-amber-600',
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-700',
    },
    {
        id: 'documents',
        label: 'Gestión Documental',
        desc: 'Subir y gestionar documentos en carpetas',
        ruta: '/documents',
        icon: Folder,
        color: 'from-teal-500 to-green-600',
        bg: 'bg-teal-50',
        border: 'border-teal-200',
        text: 'text-teal-700',
    },
    {
        id: 'query',
        label: 'Consulta de Documentos',
        desc: 'Buscar en toda la base documental',
        ruta: '/query',
        icon: Globe,
        color: 'from-sky-500 to-blue-600',
        bg: 'bg-sky-50',
        border: 'border-sky-200',
        text: 'text-sky-700',
    },
    {
        id: 'cargue-aes',
        label: 'Cargue AES',
        desc: 'Automatizar cargue en OnBase/AES',
        ruta: '/cargue-aes',
        icon: Play,
        color: 'from-green-500 to-emerald-600',
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-700',
    },
    {
        id: 'comunicaciones-producidas',
        label: 'Com. Producidas',
        desc: 'Gestión de comunicaciones oficiales',
        ruta: '/comunicaciones-producidas',
        icon: Upload,
        color: 'from-violet-500 to-purple-600',
        bg: 'bg-violet-50',
        border: 'border-violet-200',
        text: 'text-violet-700',
    },
    {
        id: 'formatos',
        label: 'Formatos (FUID/Control)',
        desc: 'Inventario Documental GD-F-004 y Hoja de Control',
        ruta: '/formatos',
        icon: FileSpreadsheet,
        color: 'from-amber-500 to-orange-600',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-700',
    },
    {
        id: 'trd_query',
        label: 'Consulta TRD',
        desc: 'Consultar la Tabla de Retención Documental',
        ruta: '/trd-query',
        icon: Database,
        color: 'from-rose-500 to-pink-600',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        text: 'text-rose-700',
    },
    {
        id: 'onedrive',
        label: 'Config. OneDrive',
        desc: 'Configurar integración con OneDrive',
        ruta: '/config-onedrive',
        icon: Cloud,
        color: 'from-blue-500 to-indigo-600',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-700',
    },
    {
        id: 'config-aes',
        label: 'Config. AES / OnBase',
        desc: 'Parámetros de conexión al sistema AES',
        ruta: '/config-aes',
        icon: Settings,
        color: 'from-slate-500 to-gray-600',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        text: 'text-slate-700',
    },
    {
        id: 'automation',
        label: 'Automatización',
        desc: 'Flujos automáticos de procesamiento',
        ruta: '/automation',
        icon: Zap,
        color: 'from-yellow-500 to-amber-600',
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-700',
    },
    {
        id: 'users',
        label: 'Usuarios',
        desc: 'Administrar cuentas de usuario',
        ruta: '/users',
        icon: User,
        color: 'from-indigo-500 to-violet-600',
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        text: 'text-indigo-700',
    },
    {
        id: 'permissions',
        label: 'Permisos',
        desc: 'Gestionar roles y permisos del sistema',
        ruta: '/permissions',
        icon: Shield,
        color: 'from-red-500 to-rose-600',
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-700',
    },
];

const ROLE_COLORS = {
    superadmin: 'bg-gradient-to-r from-pink-500 to-rose-600 text-white',
    admin:      'bg-gradient-to-r from-purple-500 to-indigo-600 text-white',
    user:       'bg-gradient-to-r from-green-500 to-teal-600 text-white',
};

export default function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState({ pending: 0, completed: 0 });
    const [permissions, setPermissions] = useState([]);
    const [loadingStats, setLoadingStats] = useState(true);
    const [loadingPerms, setLoadingPerms] = useState(true);

    useEffect(() => {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        setUser(storedUser);
        fetchStats();
        if (storedUser.role) fetchPermissions(storedUser.role);
    }, []);

    const fetchStats = async () => {
        try {
            const res = await axios.get('/api/documents/stats/summary');
            setStats(res.data.data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        } finally {
            setLoadingStats(false);
        }
    };

    const fetchPermissions = async (role) => {
        try {
            const res = await axios.get(`/api/permissions/${role}`);
            setPermissions(res.data.data || []);
        } catch (err) {
            console.error('Error fetching permissions:', err);
        } finally {
            setLoadingPerms(false);
        }
    };

    // Determina si el usuario puede ver un módulo
    const canView = (moduleId) => {
        if (!user) return false;
        if (user.role === 'admin' || user.role === 'superadmin') return true;
        const perm = permissions.find(p => p.module_id === moduleId);
        return perm ? perm.can_view === 1 || perm.can_view === true : false;
    };

    // Módulos a los que tiene acceso
    const modulosAccesibles = MODULOS_CATALOGO.filter(m => canView(m.id));

    const roleBadge = ROLE_COLORS[user?.role] || 'bg-gray-200 text-gray-700';

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">

            {/* ── BANNER BIENVENIDA ── */}
            <div className="bg-gradient-to-r from-[#39A900] to-emerald-700 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                        <h1 className="text-3xl font-black tracking-tight">
                            ¡Bienvenido, {user?.name || 'Usuario'}!
                        </h1>
                        <span className={`text-xs font-black uppercase px-3 py-1 rounded-full ${roleBadge}`}>
                            {user?.role || 'rol'}
                        </span>
                    </div>
                    <p className="text-green-100 text-base opacity-90 max-w-2xl">
                        Panel de control del <strong>Automatizador de Gestión Documental</strong>.
                        Accede a los módulos habilitados para tu perfil.
                    </p>
                </div>
                <LayoutDashboard className="absolute right-0 bottom-0 text-white opacity-10 w-64 h-64 -mb-12 -mr-12" />
            </div>

            {/* ── STATS ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-orange-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="bg-orange-100 p-3 rounded-full"><Clock size={22} className="text-orange-600" /></div>
                    <div>
                        <span className="block text-2xl font-black text-orange-700">{loadingStats ? '—' : stats.pending}</span>
                        <span className="text-xs text-orange-500 font-semibold">Docs. Pendientes</span>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-green-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="bg-green-100 p-3 rounded-full"><CheckCircle size={22} className="text-green-600" /></div>
                    <div>
                        <span className="block text-2xl font-black text-green-700">{loadingStats ? '—' : stats.completed}</span>
                        <span className="text-xs text-green-500 font-semibold">Cargados Hoy</span>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="bg-blue-100 p-3 rounded-full"><FileText size={22} className="text-blue-600" /></div>
                    <div>
                        <span className="block text-2xl font-black text-blue-700">{loadingPerms ? '—' : modulosAccesibles.length}</span>
                        <span className="text-xs text-blue-500 font-semibold">Módulos Activos</span>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="bg-purple-100 p-3 rounded-full"><Star size={22} className="text-purple-600" /></div>
                    <div>
                        <span className="block text-2xl font-black text-purple-700">{MODULOS_CATALOGO.length}</span>
                        <span className="text-xs text-purple-500 font-semibold">Total Sistema</span>
                    </div>
                </div>
            </div>

            {/* ── MÓDULOS ACCESIBLES ── */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                        <Shield size={20} className="text-[#39A900]" />
                        Mis accesos habilitados
                    </h2>
                    <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full font-semibold">
                        {loadingPerms ? 'Cargando...' : `${modulosAccesibles.length} de ${MODULOS_CATALOGO.length} módulos`}
                    </span>
                </div>

                {loadingPerms ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : modulosAccesibles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
                        <Lock size={40} className="text-gray-300 mb-3" />
                        <p className="text-gray-500 font-semibold">Sin módulos habilitados</p>
                        <p className="text-gray-400 text-sm mt-1">Contacta a un administrador para solicitar acceso.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {modulosAccesibles.map((mod) => {
                            const Icon = mod.icon;
                            return (
                                <button
                                    key={mod.id}
                                    onClick={() => navigate(mod.ruta)}
                                    className={`group text-left p-5 bg-white rounded-xl border ${mod.border} hover:shadow-lg transition-all duration-200 hover:-translate-y-1 active:scale-95`}
                                >
                                    <div className={`inline-flex p-2.5 rounded-lg bg-gradient-to-br ${mod.color} mb-3 shadow-sm`}>
                                        <Icon size={20} className="text-white" />
                                    </div>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className={`font-black text-sm ${mod.text}`}>{mod.label}</h3>
                                            <p className="text-xs text-gray-400 mt-1 leading-relaxed">{mod.desc}</p>
                                        </div>
                                        <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 mt-0.5 flex-shrink-0 transition-colors" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── MÓDULOS SIN ACCESO (solo para admin/superadmin lo ven) ── */}
            {(user?.role === 'admin' || user?.role === 'superadmin') && (() => {
                const sinAcceso = MODULOS_CATALOGO.filter(m => !canView(m.id));
                if (sinAcceso.length === 0) return null;
                return (
                    <div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Lock size={14} /> Módulos no visibles para tu rol
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            {sinAcceso.map((mod) => {
                                const Icon = mod.icon;
                                return (
                                    <div key={mod.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl opacity-50 flex flex-col items-center text-center gap-1">
                                        <Icon size={18} className="text-gray-400" />
                                        <span className="text-[10px] font-semibold text-gray-500">{mod.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

        </div>
    );
}
