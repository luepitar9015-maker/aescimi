import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    LayoutDashboard, CheckCircle, Clock, FileText,
    Network, FolderKanban, Folder, Globe, Play,
    Upload, FileSpreadsheet, Database, Cloud,
    Settings, Shield, User, ChevronRight,
    Lock, Zap, FolderOpen, FolderX, Files
} from 'lucide-react';

// ── Catálogo completo de módulos ──────────────────────────────────────────────
const MODULOS = [
    { id: 'dashboard',                label: 'Dashboard',              desc: 'Panel principal del sistema',                          ruta: '/dashboard',                icon: LayoutDashboard,  color: 'from-purple-500 to-indigo-600',  border: 'border-purple-200', text: 'text-purple-700' },
    { id: 'trd',                      label: 'Estructura y TRD',       desc: 'Gestión de series, subseries y estructura documental',  ruta: '/creation',                 icon: Network,          color: 'from-blue-500 to-cyan-600',      border: 'border-blue-200',   text: 'text-blue-700' },
    { id: 'expedientes',              label: 'Crear Expedientes',      desc: 'Creación y gestión de expedientes',                    ruta: '/expedientes',              icon: FolderKanban,     color: 'from-orange-500 to-amber-600',   border: 'border-orange-200', text: 'text-orange-700' },
    { id: 'documents',                label: 'Gestión Documental',     desc: 'Subir y gestionar documentos en carpetas',             ruta: '/documents',                icon: Folder,           color: 'from-teal-500 to-green-600',     border: 'border-teal-200',   text: 'text-teal-700' },
    { id: 'query',                    label: 'Consulta de Documentos', desc: 'Buscar en toda la base documental',                   ruta: '/query',                    icon: Globe,            color: 'from-sky-500 to-blue-600',       border: 'border-sky-200',    text: 'text-sky-700' },
    { id: 'cargue-aes',               label: 'Cargue AES',             desc: 'Automatizar cargue en OnBase/AES',                    ruta: '/cargue-aes',               icon: Play,             color: 'from-green-500 to-emerald-600',  border: 'border-green-200',  text: 'text-green-700' },
    { id: 'comunicaciones-producidas',label: 'Com. Producidas',        desc: 'Gestión de comunicaciones oficiales',                 ruta: '/comunicaciones-producidas',icon: Upload,           color: 'from-violet-500 to-purple-600',  border: 'border-violet-200', text: 'text-violet-700' },
    { id: 'formatos',                 label: 'Formatos (FUID/Control)',desc: 'Inventario Documental GD-F-004 y Hoja de Control',     ruta: '/formatos',                 icon: FileSpreadsheet,  color: 'from-amber-500 to-orange-600',   border: 'border-amber-200',  text: 'text-amber-700' },
    { id: 'trd_query',                label: 'Consulta TRD',           desc: 'Consultar la Tabla de Retención Documental',          ruta: '/trd-query',                icon: Database,         color: 'from-rose-500 to-pink-600',      border: 'border-rose-200',   text: 'text-rose-700' },
    { id: 'onedrive',                 label: 'Config. OneDrive',       desc: 'Configurar integración con OneDrive',                 ruta: '/config-onedrive',          icon: Cloud,            color: 'from-blue-500 to-indigo-600',    border: 'border-blue-200',   text: 'text-blue-700' },
    { id: 'config-aes',               label: 'Config. AES / OnBase',  desc: 'Parámetros de conexión al sistema AES',               ruta: '/config-aes',               icon: Settings,         color: 'from-slate-500 to-gray-600',     border: 'border-slate-200',  text: 'text-slate-700' },
    { id: 'automation',               label: 'Automatización',         desc: 'Flujos automáticos de procesamiento',                 ruta: '/automation',               icon: Zap,              color: 'from-yellow-500 to-amber-600',   border: 'border-yellow-200', text: 'text-yellow-700' },
    { id: 'users',                    label: 'Usuarios',               desc: 'Administrar cuentas de usuario',                      ruta: '/users',                    icon: User,             color: 'from-indigo-500 to-violet-600',  border: 'border-indigo-200', text: 'text-indigo-700' },
    { id: 'permissions',              label: 'Permisos',               desc: 'Gestionar roles y permisos del sistema',              ruta: '/permissions',              icon: Shield,           color: 'from-red-500 to-rose-600',       border: 'border-red-200',    text: 'text-red-700' },
];

const ROLE_BADGE = {
    superadmin: 'bg-gradient-to-r from-pink-500 to-rose-600 text-white',
    admin:      'bg-gradient-to-r from-purple-500 to-indigo-600 text-white',
    user:       'bg-gradient-to-r from-green-500 to-teal-600 text-white',
};

// ── Tarjeta de estadística ────────────────────────────────────────────────────
function StatCard({ icon: Icon, value, label, sublabel, colorBg, colorIcon, colorText, loading, onClick }) {
    return (
        <button
            onClick={onClick}
            disabled={!onClick}
            className={`bg-white rounded-xl border ${colorBg} shadow-sm p-4 flex items-center gap-4 text-left w-full transition-all ${onClick ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : 'cursor-default'}`}
        >
            <div className={`p-3 rounded-full ${colorBg}`}>
                <Icon size={22} className={colorIcon} />
            </div>
            <div>
                <span className={`block text-2xl font-black ${colorText}`}>
                    {loading ? '—' : (value ?? 0)}
                </span>
                <span className={`text-xs font-semibold ${colorIcon}`}>{label}</span>
                {sublabel && <span className="block text-[10px] text-gray-400 mt-0.5">{sublabel}</span>}
            </div>
        </button>
    );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser]           = useState(null);
    const [stats, setStats]         = useState(null);
    const [permissions, setPerms]   = useState([]);
    const [loadingStats, setLoadingStats] = useState(true);
    const [loadingPerms, setLoadingPerms] = useState(true);

    useEffect(() => {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        // Mostrar el nombre completo; si no existe 'name', usar 'username'
        setUser(stored);
        fetchStats();
        if (stored.role) fetchPerms(stored.role);
    }, []);

    const fetchStats = async () => {
        try {
            const res = await axios.get('/api/documents/stats/dashboard');
            setStats(res.data.data);
        } catch {
            setStats({});
        } finally {
            setLoadingStats(false);
        }
    };

    const fetchPerms = async (role) => {
        try {
            const res = await axios.get(`/api/permissions/${role}`);
            setPerms(res.data.data || []);
        } catch {
            setPerms([]);
        } finally {
            setLoadingPerms(false);
        }
    };

    const canView = (moduleId) => {
        if (!user) return false;
        if (user.role === 'admin' || user.role === 'superadmin') return true;
        const p = permissions.find(p => p.module_id === moduleId);
        return p ? p.can_view === 1 || p.can_view === true : false;
    };

    const modulosAccesibles = MODULOS.filter(m => canView(m.id));
    const isSuperOrAdmin = user?.role === 'admin' || user?.role === 'superadmin';

    // Nombre a mostrar: preferir name, luego username, luego 'Usuario'
    const displayName = user?.name || user?.username || user?.document_no || 'Usuario';
    const roleBadge   = ROLE_BADGE[user?.role] || 'bg-gray-200 text-gray-700';
    const scopeLabel  = isSuperOrAdmin ? 'Sistema completo' : 'Tu dependencia';

    return (
        <div className="p-5 max-w-7xl mx-auto space-y-7">

            {/* ── BANNER BIENVENIDA ─────────────────────────────────────── */}
            <div className="bg-gradient-to-r from-[#39A900] to-emerald-700 rounded-2xl p-7 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase">
                            ¡Bienvenido, {displayName}!
                        </h1>
                        <span className={`text-[11px] font-black uppercase px-3 py-1 rounded-full ${roleBadge}`}>
                            {user?.role || 'rol'}
                        </span>
                    </div>
                    <p className="text-green-100 text-sm opacity-90 max-w-2xl">
                        Panel de control del <strong>Automatizador de Gestión Documental</strong>.
                        {isSuperOrAdmin
                            ? ' Visualizando estadísticas globales del sistema.'
                            : ' Visualizando datos de tu dependencia.'}
                    </p>
                </div>
                <LayoutDashboard className="absolute right-0 bottom-0 text-white opacity-10 w-56 h-56 -mb-10 -mr-10" />
            </div>

            {/* ── ESTADÍSTICAS DE EXPEDIENTES ──────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-black text-gray-700 flex items-center gap-2">
                        <FolderKanban size={18} className="text-[#39A900]" />
                        Expedientes — <span className="text-gray-400 font-semibold text-sm">{scopeLabel}</span>
                    </h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <StatCard
                        icon={FolderOpen}
                        value={stats?.total_expedientes}
                        label="Aperturados"
                        sublabel={isSuperOrAdmin ? 'Total sistema' : 'En tu dependencia'}
                        colorBg="border-green-100 bg-green-50"
                        colorIcon="text-green-600"
                        colorText="text-green-700"
                        loading={loadingStats}
                        onClick={() => navigate('/expedientes')}
                    />
                    <StatCard
                        icon={FileText}
                        value={stats?.expedientes_con_docs}
                        label="Con documentos"
                        sublabel="Expedientes cargados"
                        colorBg="border-blue-100 bg-blue-50"
                        colorIcon="text-blue-600"
                        colorText="text-blue-700"
                        loading={loadingStats}
                        onClick={() => navigate('/documents')}
                    />
                    <StatCard
                        icon={FolderX}
                        value={stats?.expedientes_sin_docs}
                        label="Sin documentos"
                        sublabel="Pendientes por cargar"
                        colorBg="border-orange-100 bg-orange-50"
                        colorIcon="text-orange-600"
                        colorText="text-orange-700"
                        loading={loadingStats}
                        onClick={() => navigate('/documents')}
                    />
                    <StatCard
                        icon={Clock}
                        value={stats?.docs_pendientes}
                        label="Docs. Pendientes"
                        sublabel="Por procesar en AES"
                        colorBg="border-red-100 bg-red-50"
                        colorIcon="text-red-600"
                        colorText="text-red-700"
                        loading={loadingStats}
                        onClick={canView('cargue-aes') ? () => navigate('/cargue-aes') : null}
                    />
                    <StatCard
                        icon={CheckCircle}
                        value={stats?.docs_cargados_hoy}
                        label="Cargados Hoy"
                        sublabel="Procesados hoy"
                        colorBg="border-teal-100 bg-teal-50"
                        colorIcon="text-teal-600"
                        colorText="text-teal-700"
                        loading={loadingStats}
                    />
                    <StatCard
                        icon={Files}
                        value={stats?.total_docs}
                        label="Total Docs."
                        sublabel={isSuperOrAdmin ? 'En el sistema' : 'En tu dependencia'}
                        colorBg="border-purple-100 bg-purple-50"
                        colorIcon="text-purple-600"
                        colorText="text-purple-700"
                        loading={loadingStats}
                    />
                </div>
            </div>

            {/* ── MÓDULOS ACCESIBLES ────────────────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-black text-gray-700 flex items-center gap-2">
                        <Shield size={18} className="text-[#39A900]" />
                        Mis accesos habilitados
                    </h2>
                    <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full font-semibold">
                        {loadingPerms ? 'Cargando...' : `${modulosAccesibles.length} de ${MODULOS.length} módulos`}
                    </span>
                </div>

                {loadingPerms ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : modulosAccesibles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 bg-white rounded-2xl border border-dashed border-gray-300">
                        <Lock size={36} className="text-gray-300 mb-3" />
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
                                    className={`group text-left p-4 bg-white rounded-xl border ${mod.border} hover:shadow-lg transition-all duration-200 hover:-translate-y-1 active:scale-95`}
                                >
                                    <div className={`inline-flex p-2.5 rounded-lg bg-gradient-to-br ${mod.color} mb-3 shadow-sm`}>
                                        <Icon size={18} className="text-white" />
                                    </div>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className={`font-black text-sm ${mod.text}`}>{mod.label}</h3>
                                            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{mod.desc}</p>
                                        </div>
                                        <ChevronRight size={15} className="text-gray-300 group-hover:text-gray-500 mt-0.5 flex-shrink-0 transition-colors" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── MÓDULOS SIN ACCESO (solo admin/superadmin) ───────────── */}
            {isSuperOrAdmin && (() => {
                const sinAcceso = MODULOS.filter(m => !canView(m.id));
                if (!sinAcceso.length) return null;
                return (
                    <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Lock size={12} /> Módulos no visibles para tu rol actual
                        </h3>
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                            {sinAcceso.map(mod => {
                                const Icon = mod.icon;
                                return (
                                    <div key={mod.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl opacity-40 flex flex-col items-center text-center gap-1">
                                        <Icon size={16} className="text-gray-400" />
                                        <span className="text-[9px] font-semibold text-gray-500 leading-tight">{mod.label}</span>
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
