// Force update
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LogOut, FileText, User, Settings as SettingsIcon, FolderKanban, Database, Play, Network, Folder, Cloud, Globe, Shield, FileSpreadsheet, Upload, BarChart2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import CreationModule from './pages/CreationModule'; // New
import ExpedienteCreation from './pages/ExpedienteCreation'; // New Module
import UsersManagement from './pages/UsersManagement';
import Automation from './pages/Automation';
import DocumentManagement from './pages/DocumentManagement'; // New Module
import DocumentQuery from './pages/DocumentQuery'; // New Module
import CargueAes from './pages/CargueAes'; // New Module
import OneDriveSettings from './pages/OneDriveSettings'; // New
import AesSettings from './pages/AesSettings'; // New
import PermissionsManagement from './pages/PermissionsManagement'; // New
import Dashboard from './pages/Dashboard'; // New
import TRDQuery from './pages/TRDQuery'; // New
import SuperuserModule from './pages/SuperuserModule'; // New
import ExploradorDocumental from './pages/ExploradorDocumental'; // Explorador archivos
import Formatos from './pages/Formatos'; // Nuevo módulo de Formatos
import ComunicacionesProducidas from './pages/ComunicacionesProducidas'; // Nuevo módulo
import SeguimientoExpedientes from './pages/SeguimientoExpedientes'; // Seguimiento
import './App.css';

// --- Global Axios Interceptors ---
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      if (!config.headers) {
          config.headers = {};
      }
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Axios Interceptor: 401 detectado, expulsando al usuario...');
      
      // Permitir reintentos fallidos en login (credenciales incorrectas) sin expulsar infinitamente
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Forzar redireccionamiento agresivo.
        setTimeout(() => {
            window.location.href = "/login";
        }, 100);
      }
    }
    return Promise.reject(error);
  }
);

// --- Components ---

// Login Component
function Login() {
  const [doc, setDoc] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [tempToken, setTempToken] = useState(null);
  const [showPass, setShowPass] = useState(false);
  
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post('/api/auth/login', {
        document_no: doc,
        password: pass
      });
      
      if (res.data.user.mustChangePassword) {
         setTempToken(res.data.token);
         setRequirePasswordChange(true);
         setError('Por seguridad, debe crear una nueva contraseña.');
         return;
      }

      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/dashboard');
    } catch (err) {
      console.error("Login error:", err);
      if (err.response) {
        setError(err.response.data.error || 'Error de autenticación');
      } else if (err.request) {
        setError('Error de conexión con el servidor. Verifique que el backend esté corriendo.');
      } else {
        setError('Error al procesar la solicitud.');
      }
    }
  };

  const handleChangePassword = async (e) => {
      e.preventDefault();
      if (newPass !== confirmPass) {
          setError('Las contraseñas no coinciden');
          return;
      }
      try {
          await axios.post('/api/users/change-password', { password: newPass }, {
              headers: { Authorization: `Bearer ${tempToken}` }
          });
          alert("Contraseña actualizada exitosamente. Ingrese con su nueva contraseña.");
          setRequirePasswordChange(false);
          setPass('');
          setNewPass('');
          setConfirmPass('');
          setError('');
      } catch (err) {
          setError(err.response?.data?.error || 'Error al cambiar la contraseña');
      }
  };

  // ── Cambio de contraseña obligatorio ─────────────────────────────────────
  if (requirePasswordChange) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.leftPanel}>
          <BrandPanel />
        </div>
        <div style={styles.rightPanel}>
          <div style={styles.formBox}>
            <div style={styles.formHeader}>
              <span style={{ fontSize: 32 }}>🔑</span>
              <h2 style={styles.formTitle}>Cambio de Contraseña</h2>
              <p style={styles.formSubtitle}>Por seguridad, cree una nueva contraseña para continuar.</p>
            </div>
            <form onSubmit={handleChangePassword} style={{ width: '100%' }}>
              <div style={styles.field}>
                <label style={styles.label}>Nueva Contraseña</label>
                <input style={styles.input} type="password" value={newPass}
                  onChange={e => setNewPass(e.target.value)} required placeholder="Mínimo 6 caracteres" minLength={6} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Confirmar Contraseña</label>
                <input style={styles.input} type="password" value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)} required placeholder="Repita la nueva contraseña" minLength={6} />
              </div>
              {error && <p style={styles.errorBox}>{error}</p>}
              <button type="submit" style={styles.btnPrimary}>Actualizar Contraseña</button>
              <button type="button" style={styles.btnSecondary}
                onClick={() => { setRequirePasswordChange(false); setError(''); setPass(''); }}>
                Cancelar
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Login principal ───────────────────────────────────────────────────────
  return (
    <div style={styles.wrapper}>
      {/* Panel izquierdo — Branding */}
      <div style={styles.leftPanel}>
        <BrandPanel />
      </div>

      {/* Panel derecho — Formulario */}
      <div style={styles.rightPanel}>
        <div style={styles.formBox}>
          <div style={styles.formHeader}>
            <h2 style={styles.formTitle}>Bienvenido</h2>
            <p style={styles.formSubtitle}>Ingrese sus credenciales para acceder al sistema</p>
          </div>

          <form onSubmit={handleLogin} style={{ width: '100%' }}>
            <div style={styles.field}>
              <label style={styles.label}>No. Consumo (Usuario)</label>
              <input
                id="login-doc"
                style={styles.input}
                type="text"
                value={doc}
                onChange={e => setDoc(e.target.value)}
                required
                placeholder="Ingrese su número de documento"
                autoComplete="username"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-pass"
                  style={{ ...styles.input, paddingRight: '44px' }}
                  type={showPass ? 'text' : 'password'}
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  required
                  placeholder="Ingrese su contraseña"
                  autoComplete="current-password"
                />
                <button type="button"
                  onClick={() => setShowPass(s => !s)}
                  style={styles.eyeBtn}
                  title={showPass ? 'Ocultar' : 'Mostrar'}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && <p style={styles.errorBox}>{error}</p>}

            <button type="submit" style={styles.btnPrimary}>
              Ingresar al Sistema
            </button>
          </form>

          <p style={styles.footerNote}>
            Sistema de uso institucional — Acceso restringido
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Panel de branding izquierdo ───────────────────────────────────────────────
function BrandPanel() {
  return (
    <div style={styles.brand}>
      {/* Círculos decorativos */}
      <div style={styles.circle1} />
      <div style={styles.circle2} />
      <div style={styles.circle3} />

      <div style={styles.brandContent}>
        {/* Ícono principal */}
        <div style={styles.brandIcon}>
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <rect width="52" height="52" rx="14" fill="rgba(255,255,255,0.15)" />
            <path d="M13 14h16l8 8v16H13V14z" fill="rgba(255,255,255,0.9)" />
            <path d="M29 14l8 8h-8V14z" fill="rgba(255,255,255,0.5)" />
            <rect x="18" y="24" width="14" height="2" rx="1" fill="#4ade80" />
            <rect x="18" y="28" width="10" height="2" rx="1" fill="#4ade80" />
            <rect x="18" y="32" width="12" height="2" rx="1" fill="#4ade80" />
          </svg>
        </div>

        <p style={styles.brandTagline}>Gestión Documental Inteligente</p>
        <h1 style={styles.brandTitle}>Automatizador de<br />Gestión Documental</h1>
        <div style={styles.brandDivider} />
        <p style={styles.brandDesc}>
          Plataforma institucional para la gestión, organización y automatización 
          de expedientes y documentos digitales.
        </p>

        {/* Badges de características */}
        <div style={styles.badges}>
          {['📁 Expedientes', '🔄 Automatización', '📊 Reportes'].map(b => (
            <span key={b} style={styles.badge}>{b}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Estilos en objeto (sin dependencia de CSS externo) ────────────────────────
const styles = {
  wrapper: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  },
  // Panel izquierdo verde
  leftPanel: {
    flex: '1 1 50%',
    background: 'linear-gradient(145deg, #4CAF50 0%, #39A900 50%, #2E7D32 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    minHeight: '100vh',
  },
  brand: {
    position: 'relative',
    zIndex: 1,
    color: 'white',
    padding: '48px 40px',
    maxWidth: '480px',
  },
  brandContent: { position: 'relative', zIndex: 2 },
  brandIcon: { marginBottom: '24px' },
  brandTagline: {
    fontSize: '13px',
    fontWeight: '600',
    letterSpacing: '3px',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: '12px',
  },
  brandTitle: {
    fontSize: '38px',
    fontWeight: '900',
    lineHeight: '1.15',
    color: '#ffffff',
    margin: '0 0 24px',
  },
  brandDivider: {
    width: '60px',
    height: '3px',
    background: 'rgba(255,255,255,0.4)',
    borderRadius: '2px',
    marginBottom: '20px',
  },
  brandDesc: {
    fontSize: '15px',
    lineHeight: '1.7',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: '32px',
  },
  badges: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  badge: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.25)',
    color: 'white',
    fontSize: '12px',
    fontWeight: '600',
    padding: '6px 14px',
    borderRadius: '20px',
  },
  // Círculos decorativos
  circle1: {
    position: 'absolute', top: '-80px', right: '-80px',
    width: '300px', height: '300px', borderRadius: '50%',
    background: 'rgba(255,255,255,0.06)',
  },
  circle2: {
    position: 'absolute', bottom: '-100px', left: '-60px',
    width: '350px', height: '350px', borderRadius: '50%',
    background: 'rgba(255,255,255,0.05)',
  },
  circle3: {
    position: 'absolute', top: '40%', right: '-40px',
    width: '180px', height: '180px', borderRadius: '50%',
    background: 'rgba(255,255,255,0.08)',
  },
  // Panel derecho blanco
  rightPanel: {
    flex: '1 1 50%',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
    minHeight: '100vh',
  },
  formBox: {
    width: '100%',
    maxWidth: '400px',
    background: '#ffffff',
    borderRadius: '20px',
    padding: '40px 36px',
    boxShadow: '0 4px 40px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  formHeader: { textAlign: 'center', marginBottom: '28px' },
  formTitle: {
    fontSize: '26px', fontWeight: '800', color: '#1a1a2e', margin: '8px 0 6px',
  },
  formSubtitle: { fontSize: '14px', color: '#6b7280', margin: 0 },
  field: { width: '100%', marginBottom: '18px' },
  label: {
    display: 'block', fontSize: '13px', fontWeight: '600',
    color: '#374151', marginBottom: '7px',
  },
  input: {
    width: '100%', padding: '11px 14px', fontSize: '14px',
    border: '1.5px solid #e5e7eb', borderRadius: '10px',
    outline: 'none', transition: 'border-color 0.2s',
    boxSizing: 'border-box', color: '#111827',
  },
  eyeBtn: {
    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px',
  },
  errorBox: {
    width: '100%', background: '#fef2f2', border: '1px solid #fecaca',
    color: '#dc2626', borderRadius: '8px', padding: '10px 14px',
    fontSize: '13px', margin: '0 0 14px',
  },
  btnPrimary: {
    width: '100%', padding: '13px', fontSize: '15px', fontWeight: '700',
    background: 'linear-gradient(135deg, #39A900, #2E7D32)',
    color: 'white', border: 'none', borderRadius: '10px',
    cursor: 'pointer', marginTop: '4px', marginBottom: '10px',
    boxShadow: '0 4px 14px rgba(57,169,0,0.45)',
    transition: 'opacity 0.2s',
  },
  btnSecondary: {
    width: '100%', padding: '11px', fontSize: '14px', fontWeight: '600',
    background: '#f1f5f9', color: '#475569', border: 'none',
    borderRadius: '10px', cursor: 'pointer',
  },
  footerNote: {
    marginTop: '24px', fontSize: '11px', color: '#9ca3af', textAlign: 'center',
  },
};


// Protected Route Wrapper

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

// Layout Component (Sidebar + Content)
function Layout({ children }) {
  const navigate = useNavigate();
  const [permissions, setPermissions] = useState([]);
  const [isLoadingPerms, setIsLoadingPerms] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      setCurrentUser(storedUser);
      if (storedUser.role) {
        fetchPermissions(storedUser.role);
      } else {
        setIsLoadingPerms(false);
      }
    } catch (e) {
      console.error("Error parsing user data:", e);
      setIsLoadingPerms(false);
    }
  }, []);

  const fetchPermissions = async (role) => {
    try {
      const res = await axios.get(`/api/permissions/${role}`);
      setPermissions(res.data.data);
    } catch (err) {
      console.error("Error fetching role permissions:", err);
    } finally {
      setIsLoadingPerms(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const canView = (moduleId) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin' || currentUser.role === 'superadmin') return true;
    const perm = permissions.find(p => p.module_id === moduleId);
    return perm ? perm.can_view === 1 : false;
  };

  if (!currentUser) return <div className="p-8">Cargando perfil...</div>;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h3>Automatizador de Gestión Documental</h3>
          <p className="user-info">{currentUser.name}</p>
          <span className="role-badge">{currentUser.role}</span>
        </div>
        <nav className="sidebar-nav">
          {canView('dashboard') && <Link to="/dashboard" className="nav-item"><User size={18} /> Dashboard</Link>}
          {canView('trd') && <Link to="/creation" className="nav-item"><Network size={18} /> Estructura y TRD</Link>}
          {canView('expedientes') && <Link to="/expedientes" className="nav-item"><FolderKanban size={18} /> Crear Expedientes</Link>}
          {canView('documents') && <Link to="/documents" className="nav-item"><Folder size={18} /> Gestión Documental</Link>}
          {canView('query') && <Link to="/query" className="nav-item"><Globe size={18} /> Consulta de Documentos</Link>}
          {canView('cargue-aes') && <Link to="/cargue-aes" className="nav-item"><Play size={18} /> Cargue AES</Link>}
          {canView('comunicaciones-producidas') && <Link to="/comunicaciones-producidas" className="nav-item"><Upload size={18} /> Com. Producidas</Link>}
          {canView('formatos') && <Link to="/formatos" className="nav-item"><FileSpreadsheet size={18} /> Formatos (FUID/Control)</Link>}
          {canView('trd_query') && <Link to="/trd-query" className="nav-item"><Database size={18} /> Consulta TRD</Link>}

          {(canView('onedrive') || canView('config-aes') || canView('automation') || canView('permissions')) && (
             <div style={{ marginTop: '10px', fontSize: '11px', color: '#999', padding: '0 12px' }}>CONFIGURACIÓN</div>
          )}

          {canView('onedrive') && <Link to="/config-onedrive" className="nav-item"><Cloud size={18} /> Config. OneDrive</Link>}
          {canView('config-aes') && <Link to="/config-aes" className="nav-item"><Globe size={18} /> Config. AES</Link>}
          {canView('automation') && <Link to="/automation" className="nav-item"><Play size={18} /> Automatización</Link>}

          {(currentUser.role === 'admin' || currentUser.role === 'superadmin') && (
            <>
              {canView('users') && <Link to="/users" className="nav-item"><User size={18} /> Usuarios</Link>}
              {canView('permissions') && <Link to="/permissions" className="nav-item"><Shield size={18} /> Permisos</Link>}
            </>
          )}

          {currentUser.role === 'superadmin' && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '11px', color: '#f472b6', padding: '0 12px', fontWeight: 'bold' }}>SUPERUSUARIO</div>
              <Link to="/superuser" className="nav-item" style={{ color: '#db2777' }}>
                <Database size={18} /> Gestión de Sistema
              </Link>
              <Link to="/explorador" className="nav-item" style={{ color: '#db2777' }}>
                <Folder size={18} /> Explorador Archivos
              </Link>
              <Link to="/seguimiento" className="nav-item" style={{ color: '#db2777' }}>
                <BarChart2 size={18} /> Seguimiento Expedientes
              </Link>
            </div>
          )}
        </nav>
        <button onClick={logout} className="logout-btn"><LogOut size={18} /> Salir</button>
        <div className="sidebar-footer">
          Elaborado por Estrategia 180
        </div>
      </aside>
      <main className="content-area">
        {isLoadingPerms ? (
          <div className="p-8 text-center text-gray-500">Verificando permisos...</div>
        ) : children}
      </main>
    </div>
  );
}

// Dashboard Component - Now imported from ./pages/Dashboard

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/dashboard" element={
          <ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>
        } />
        <Route path="/creation" element={
          <ProtectedRoute><Layout><CreationModule /></Layout></ProtectedRoute>
        } />
        <Route path="/expedientes" element={
          <ProtectedRoute><Layout><ExpedienteCreation /></Layout></ProtectedRoute>
        } />
        <Route path="/automation" element={
          <ProtectedRoute><Layout><Automation /></Layout></ProtectedRoute>
        } />
        <Route path="/documents" element={
          <ProtectedRoute><Layout><DocumentManagement /></Layout></ProtectedRoute>
        } />
        <Route path="/query" element={
          <ProtectedRoute><Layout><DocumentQuery /></Layout></ProtectedRoute>
        } />
        <Route path="/cargue-aes" element={
          <ProtectedRoute><Layout><CargueAes /></Layout></ProtectedRoute>
        } />
        <Route path="/config-onedrive" element={
          <ProtectedRoute><Layout><OneDriveSettings /></Layout></ProtectedRoute>
        } />
        <Route path="/config-aes" element={
          <ProtectedRoute><Layout><AesSettings /></Layout></ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute><Layout><UsersManagement /></Layout></ProtectedRoute>
        } />
        <Route path="/permissions" element={
          <ProtectedRoute><Layout><PermissionsManagement /></Layout></ProtectedRoute>
        } />
        <Route path="/trd-query" element={
          <ProtectedRoute><Layout><TRDQuery /></Layout></ProtectedRoute>
        } />
        <Route path="/formatos" element={
          <ProtectedRoute><Layout><Formatos /></Layout></ProtectedRoute>
        } />
        <Route path="/comunicaciones-producidas" element={
          <ProtectedRoute><Layout><ComunicacionesProducidas /></Layout></ProtectedRoute>
        } />
        <Route path="/superuser" element={
          <ProtectedRoute><Layout><SuperuserModule /></Layout></ProtectedRoute>
        } />
        <Route path="/explorador" element={
          <ProtectedRoute><Layout><ExploradorDocumental /></Layout></ProtectedRoute>
        } />
        <Route path="/seguimiento" element={
          <ProtectedRoute><Layout><SeguimientoExpedientes /></Layout></ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
