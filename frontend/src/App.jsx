// Force update
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LogOut, FileText, User, Settings as SettingsIcon, FolderKanban, Database, Play, Network, Folder, Cloud, Globe, Shield, FileSpreadsheet, Upload } from 'lucide-react';
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
import Formatos from './pages/Formatos'; // Nuevo módulo de Formatos
import ComunicacionesProducidas from './pages/ComunicacionesProducidas'; // Nuevo módulo
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

  if (requirePasswordChange) {
      return (
        <div className="login-container">
          <div className="card login-card" style={{ borderTop: '4px solid #f59e0b' }}>
            <h2>Cambio de Contraseña Obligatorio</h2>
            <p className="text-sm text-gray-600 mb-4 text-center">Es su primera vez ingresando o un administrador restableció su acceso.</p>
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label>Nueva Contraseña</label>
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  required
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label>Confirmar Contraseña</label>
                <input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  required
                  placeholder="Repita la nueva contraseña"
                  minLength={6}
                />
              </div>
              {error && <p className="error" style={{ color: '#d97706', backgroundColor: '#fef3c7', padding: '8px', borderRadius: '4px' }}>{error}</p>}
              <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#f59e0b' }}>Actualizar Contraseña</button>
              <button type="button" className="btn" style={{ marginTop: '10px', width: '100%', backgroundColor: '#eee', color: '#333' }} onClick={() => { setRequirePasswordChange(false); setError(''); setPass(''); }}>Cancelar</button>
            </form>
          </div>
        </div>
      );
  }

  return (
    <div className="login-container">
      <div className="card login-card">
        <h2>Automatizador de Gestión Documental</h2>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>No. Consumo (Usuario)</label>
            <input
              type="text"
              value={doc}
              onChange={(e) => setDoc(e.target.value)}
              required
              placeholder="Ingrese su número de documento"
            />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              required
              placeholder="Ingrese su contraseña"
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-primary">Ingresar</button>
        </form>
      </div>
    </div>
  );
}

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

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
