import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LogOut, FileText, User, Settings, FolderKanban, Database } from 'lucide-react';
import * as XLSX from 'xlsx';
import TRDManagement from './pages/TRDManagement';
import PDFConversion from './pages/PDFConversion';
import Dependencies from './pages/Dependencies';
import MassUpload from './pages/MassUpload';
import UsersManagement from './pages/UsersManagement';
import Automation from './pages/Automation';
import './App.css';

// --- Components ---

// Login Component
function Login() {
  const [doc, setDoc] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:3001/api/auth/login', {
        document_no: doc,
        password: pass
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user)); // Store user info
      navigate('/dashboard');
    } catch (err) {
      console.error("Login error:", err);
      if (err.response) {
        // Server responded with a status code outside 2xx
        setError(err.response.data.error || 'Error de autenticación');
      } else if (err.request) {
        // The request was made but no response was received
        setError('Error de conexión con el servidor. Verifique que el backend esté corriendo.');
      } else {
        // Something happened in setting up the request
        setError('Error al procesar la solicitud.');
      }
    }
  };

  return (
    <div className="login-container">
      <div className="card login-card">
        <h2>Iniciar Sesión AES</h2>
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
  // Simple check, real app should verify token expiry
  return children;
}

// Layout Component (Sidebar + Content)
function Layout({ children }) {
  const navigate = useNavigate();
  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
  } catch (e) {
    console.error("Error parsing user data:", e);
    // localStorage.removeItem('user'); // Option: clear it
  }

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h3>SISTEMA AES</h3>
          <p className="user-info">{user.name}</p>
          <span className="role-badge">{user.role}</span>
        </div>
        <nav className="sidebar-nav">
          <Link to="/dashboard" className="nav-item"><User size={18} /> Dashboard</Link>
          <Link to="/dependencies" className="nav-item"><Database size={18} /> Dependencias</Link>
          <Link to="/trd" className="nav-item"><FolderKanban size={18} /> Gestión TRD</Link>
          <Link to="/mass-upload" className="nav-item"><Database size={18} /> Cargue Masivo</Link>
          <Link to="/conversion" className="nav-item"><FileText size={18} /> Conversión PDF</Link>
          <Link to="/letters" className="nav-item"><Settings size={18} /> Cartas Masivas</Link>
          <Link to="/automation" className="nav-item"><Play size={18} /> Automatización</Link>
          {user.role === 'admin' && (
            <Link to="/users" className="nav-item"><User size={18} /> Usuarios</Link>
          )}
        </nav>
        <button onClick={logout} className="logout-btn"><LogOut size={18} /> Salir</button>
      </aside>
      <main className="content-area">
        {children}
      </main>
    </div>
  );
}

// Dashboard Component
function Dashboard() {
  return (
    <div>
      <h1>Bienvenido al Sistema de Gestión Documental AES</h1>
      <p>Seleccione una opción del menú lateral para comenzar a trabajar.</p>
    </div>
  );
}

// Original Letter Generator (Adapted with Data Visualizer)
function LetterGenerator() {
  const [file, setFile] = useState(null)
  const [letterType, setLetterType] = useState('initial')
  const [status, setStatus] = useState('')
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [excelData, setExcelData] = useState([])
  const [previewRow, setPreviewRow] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [templateFile, setTemplateFile] = useState(null)
  const [filenameColumn, setFilenameColumn] = useState('')
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [columnMapping, setColumnMapping] = useState({})
  const [showMapping, setShowMapping] = useState(false)

  const handleTemplateChange = (e) => {
    setTemplateFile(e.target.files[0])
  }

  // Row selection handlers
  const toggleRow = (index) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedRows(newSelected)
  }

  const toggleAll = () => {
    if (selectedRows.size === excelData.length) {
      setSelectedRows(new Set())
    } else {
      const allIndices = new Set(excelData.map((_, i) => i))
      setSelectedRows(allIndices)
    }
  }

  // Field mapping configuration
  const fieldMappings = {
    initial: ['TIPO', 'DOCUMENTO', 'NOMBRE', 'APELLIDOS', 'CORREO ELECTRONICO', 'DIRECCION', 'FECHA', 'NIVEL', 'PROGRAMA', 'TIPO FORMACION', 'FECHA DE INICIO', 'FICHA', 'INSTRUCTOR', 'RADICADO', 'HORA DE NOTIFICACION'],
    final: ['NOMBRE', 'DOCUMENTO', 'CORREO ELECTRONICO', 'DIRECCION', 'PROGRAMA', 'FICHA', 'COMUNICADO ANTERIOR', 'FECHA COMUNICADO', 'RESOLUCION', 'FECHA RESOLUCION', 'RADICADO FINAL', 'FECHA RADICADO FINAL']
  }

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0]
    setFile(selectedFile)
    setStatus('')
    setDownloadUrl(null)
    setExcelData([])

    if (selectedFile) {
      try {
        // Parse Excel file
        const reader = new FileReader()

        reader.onload = (event) => {
          const data = new Uint8Array(event.target.result)
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(sheet)

          setExcelData(jsonData)
          // Auto-select all rows by default
          const allIndices = new Set(jsonData.map((_, i) => i))
          setSelectedRows(allIndices)
          
          // Auto-match columns to fields
          const headers = Object.keys(jsonData[0] || {})
          const currentFields = fieldMappings[letterType] // Access from state/closure
          const newMapping = {}
          
          currentFields.forEach(field => {
            // Try exact match
            if (headers.includes(field)) {
              newMapping[field] = field
            } else {
              // Try case-insensitive match
              const match = headers.find(h => h.toUpperCase() === field.toUpperCase())
              if (match) newMapping[field] = match
            }
          })
          setColumnMapping(newMapping)
          setShowMapping(true) // Show mapping section automatically if data loaded

          setStatus(`${jsonData.length} registros cargados`)
        }

        reader.readAsArrayBuffer(selectedFile)
      } catch (error) {
        console.error('Error parsing Excel:', error)
        setStatus('Error al leer el archivo Excel')
      }
    }
  }

  const handlePreview = (row) => {
    setPreviewRow(row)
    setShowPreview(true)
  }

  const handleUpload = async () => {
    if (!file) {
      setStatus('Por favor seleccione un archivo Excel.')
      return
    }

    setLoading(true)
    setStatus('Generando cartas...')
    setDownloadUrl(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('letterType', letterType)
    if (templateFile) {
      formData.append('template', templateFile)
    }
    if (filenameColumn) {
      formData.append('filenameColumn', filenameColumn)
    }

    // Filter data based on selection
    if (selectedRows.size > 0) {
      const selectedData = excelData.filter((_, index) => selectedRows.has(index))
      formData.append('selectedData', JSON.stringify(selectedData))
    }

    formData.append('columnMapping', JSON.stringify(columnMapping))

    try {
      const response = await axios.post('http://localhost:3001/api/generate-letters', formData, {
        responseType: 'blob',
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      setDownloadUrl(url)
      setStatus('¡Cartas generadas exitosamente!')
    } catch (error) {
      console.error('Error uploading file:', error)
      setStatus('Hubo un error al generar las cartas.')
    } finally {
      setLoading(false)
    }
  }

  const currentFields = fieldMappings[letterType]
  const availableColumns = excelData.length > 0 ? Object.keys(excelData[0]) : []
  const mappedColumns = availableColumns.filter(col => currentFields.includes(col))
  const unmappedColumns = availableColumns.filter(col => !currentFields.includes(col))

  return (
    <div className="card">
      <h1>Generador de Cartas Masivas SENA</h1>
      <p>Sube tu archivo Excel con los datos de los aprendices para generar las cartas.</p>

      <div className="form-group" style={{ marginBottom: '20px' }}>
        <label><strong>Tipo de Carta:</strong></label>
        <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="radio"
              name="letterType"
              value="initial"
              checked={letterType === 'initial'}
              onChange={(e) => setLetterType(e.target.value)}
              style={{ marginRight: '8px' }}
            />
            Notificación Inicial
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="radio"
              name="letterType"
              value="final"
              checked={letterType === 'final'}
              onChange={(e) => setLetterType(e.target.value)}
              style={{ marginRight: '8px' }}
            />
            Notificación Final - Deserciones
          </label>
        </div>
      </div>

      <div className="upload-section" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}><strong>1. Cargar Excel (Datos):</strong></label>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className="file-input"
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}><strong>2. Cargar Plantilla Word (Opcional):</strong></label>
          <input
            type="file"
            accept=".docx"
            onChange={handleTemplateChange}
            className="file-input"
          />
          <small style={{ display: 'block', color: '#666' }}>Si no carga plantilla, se usará la predeterminada del sistema.</small>
        </div>

        {excelData.length > 0 && (
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}><strong>3. Columna para Nombre de Archivo:</strong></label>
            <select
              value={filenameColumn}
              onChange={(e) => setFilenameColumn(e.target.value)}
              style={{ padding: '8px', width: '100%', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">-- Seleccionar Columna (Por defecto: RADICADO / RADICADO FINAL) --</option>
              {availableColumns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || loading || excelData.length === 0 || selectedRows.size === 0}
          className="generate-btn"
          style={{ marginTop: '10px' }}
        >
          {loading ? 'Generando...' : `Generar ${selectedRows.size} Cartas`}
        </button>
      </div>

      {status && <p className={`status ${status.includes('error') ? 'error' : 'success'}`}>{status}</p>}

      {/* Field Mapping Section */}
      {excelData.length > 0 && showMapping && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '8px', border: '1px solid #90caf9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3>Configuración de Campos</h3>
            <button onClick={() => setShowMapping(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#1976d2' }}>
              Ocultar
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#666' }}>
            Asocie las columnas de su Excel con los campos requeridos por la carta.
            Los campos marcados en verde están listos.
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px', marginTop: '10px' }}>
            {(fieldMappings[letterType] || []).map(field => {
              const mappedCol = columnMapping[field]
              const isMapped = !!mappedCol
              
              return (
                <div key={field} style={{ 
                  padding: '8px', 
                  backgroundColor: 'white', 
                  borderRadius: '4px', 
                  borderLeft: `4px solid ${isMapped ? '#4CAF50' : '#f44336'}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '12px' }}>{field}</strong>
                    {isMapped && <span style={{ fontSize: '10px', color: '#4CAF50' }}>✓ OK</span>}
                  </div>
                  <select 
                    value={mappedCol || ''} 
                    onChange={(e) => setColumnMapping(prev => ({ ...prev, [field]: e.target.value }))}
                    style={{ width: '100%', padding: '4px', fontSize: '12px', borderColor: isMapped ? '#4CAF50' : '#ccc' }}
                  >
                    <option value="">-- Seleccionar Columna --</option>
                    {availableColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Manual toggle for mapping if hidden */}
      {excelData.length > 0 && !showMapping && (
        <button 
          onClick={() => setShowMapping(true)}
          style={{ marginTop: '10px', padding: '8px', backgroundColor: '#607d8b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          ⚙️ Configurar Campos
        </button>
      )}

      {/* Field Mapping Indicators (Dynamic based on selected mapping) */}
      {excelData.length > 0 && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
          <h3>Campos para Combinación de Correspondencia</h3>
          <div style={{ marginBottom: '10px' }}>
            <strong>Campos Mapeados ({mappedColumns.length}):</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              {mappedColumns.map(col => (
                <span key={col} style={{ padding: '4px 12px', backgroundColor: '#4CAF50', color: 'white', borderRadius: '4px', fontSize: '12px' }}>
                  ✓ {col}
                </span>
              ))}
            </div>
          </div>
          {unmappedColumns.length > 0 && (
            <div>
              <strong>Campos No Utilizados ({unmappedColumns.length}):</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {unmappedColumns.map(col => (
                  <span key={col} style={{ padding: '4px 12px', backgroundColor: '#9E9E9E', color: 'white', borderRadius: '4px', fontSize: '12px' }}>
                    {col}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Data Table */}
      {excelData.length > 0 && (
        <div style={{ marginTop: '20px', overflowX: 'auto' }}>
          <h3>Datos Cargados ({excelData.length} registros)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#2196F3', color: 'white' }}>
                <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={excelData.length > 0 && selectedRows.size === excelData.length}
                    onChange={toggleAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>Acción</th>
                {availableColumns.map(col => (
                  <th key={col} style={{
                    padding: '8px',
                    border: '1px solid #ddd',
                    backgroundColor: mappedColumns.includes(col) ? '#4CAF50' : '#2196F3'
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {excelData.map((row, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white' }}>
                  <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedRows.has(idx)}
                      onChange={() => toggleRow(idx)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                    <button
                      onClick={() => handlePreview(row)}
                      style={{ padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                    >
                      👁️ Ver
                    </button>
                  </td>
                  {availableColumns.map(col => (
                    <td key={col} style={{ padding: '8px', border: '1px solid #ddd' }}>
                      {row[col] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewRow && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'auto',
            width: '90%'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2>Vista Previa de Carta</h2>
              <button onClick={() => setShowPreview(false)} style={{ fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ border: '1px solid #ddd', padding: '20px', backgroundColor: '#f9f9f9' }}>
              <h3>Datos que se usarán:</h3>
              {mappedColumns.map(col => (
                <div key={col} style={{ marginBottom: '8px' }}>
                  <strong>{col}:</strong> {previewRow[col] || 'N/A'}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {downloadUrl && (
        <div className="download-section">
          <a href={downloadUrl} download={`Cartas_${letterType === 'final' ? excelData[0]?.['RADICADO FINAL'] || 'SENA' : 'SENA'}.pdf`} className="download-btn">
            Descargar PDF Unificado
          </a>
        </div>
      )}
    </div>
  )
}


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/dashboard" element={
          <ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>
        } />
        <Route path="/dependencies" element={
          <ProtectedRoute><Layout><Dependencies /></Layout></ProtectedRoute>
        } />
        <Route path="/mass-upload" element={
          <ProtectedRoute><Layout><MassUpload /></Layout></ProtectedRoute>
        } />
        <Route path="/trd" element={
          <ProtectedRoute><Layout><TRDManagement /></Layout></ProtectedRoute>
        } />
        <Route path="/conversion" element={
          <ProtectedRoute><Layout><PDFConversion /></Layout></ProtectedRoute>
        } />
        <Route path="/letters" element={
          <ProtectedRoute><Layout><LetterGenerator /></Layout></ProtectedRoute>
        } />
        {/* <Route path="/automation" element={
          <ProtectedRoute><Layout><Automation /></Layout></ProtectedRoute>
        } /> */}
        <Route path="/users" element={
          <ProtectedRoute><Layout><UsersManagement /></Layout></ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
