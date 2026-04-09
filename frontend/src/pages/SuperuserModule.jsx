import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Database, Trash2, Edit2, Save, X, Calendar, AlertTriangle, RefreshCw } from 'lucide-react';

const API_URL = '/api/superuser';

const SuperuserModule = () => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [data, setData] = useState({ columns: [], rows: [] });
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [expirationDate, setExpirationDate] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const res = await axios.get(`${API_URL}/tables`, { headers });
      setTables(res.data);
      if (res.data.length > 0) {
        handleTableSelect(res.data[0]);
      }
    } catch (err) {
      showError('Error cargando tablas');
    }
  };

  const handleTableSelect = async (tableName) => {
    setSelectedTable(tableName);
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/table/${tableName}`, { headers });
      setData(res.data);
      setEditingRow(null);
    } catch (err) {
      showError(`Error cargando tabla ${tableName}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este registro?')) return;
    try {
      await axios.delete(`${API_URL}/table/${selectedTable}/${id}`, { headers });
      setData({ ...data, rows: data.rows.filter(r => r.id !== id) });
      showSuccess('Registro eliminado');
    } catch (err) {
      showError('Error al eliminar');
    }
  };

  const startEdit = (row) => {
    setEditingRow(row.id);
    setEditValues({ ...row });
  };

  const handleUpdate = async () => {
    try {
      await axios.put(`${API_URL}/table/${selectedTable}/${editingRow}`, editValues, { headers });
      setData({
        ...data,
        rows: data.rows.map(r => r.id === editingRow ? editValues : r)
      });
      setEditingRow(null);
      showSuccess('Registro actualizado');
    } catch (err) {
      showError('Error al actualizar');
    }
  };

  const updateExpiration = async () => {
    try {
      await axios.post(`${API_URL}/set-expiration`, { date: expirationDate }, { headers });
      showSuccess('Fecha de caducidad actualizada');
    } catch (err) {
      showError('Error al actualizar caducidad');
    }
  };

  const showError = (text) => setMessage({ type: 'error', text });
  const showSuccess = (text) => {
    setMessage({ type: 'success', text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 p-2 rounded-lg text-white">
              <Database size={28} />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Módulo de Gestión Superadmin</h1>
          </div>

          <div className="flex items-center gap-4 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
            <Calendar size={20} className="text-purple-600" />
            <span className="text-sm font-medium text-gray-600">Caducidad del Sistema:</span>
            <input
              type="date"
              className="border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
            />
            <button
              onClick={updateExpiration}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              Establecer
            </button>
          </div>
        </header>

        {message.text && (
          <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${message.type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'
            }`}>
            {message.type === 'error' ? <AlertTriangle size={20} /> : <div className="w-2 h-2 rounded-full bg-green-500" />}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar - Tables */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-fit">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h2 className="font-semibold text-gray-700">Tablas</h2>
              <button onClick={fetchTables} className="text-gray-400 hover:text-purple-600 transition-colors">
                <RefreshCw size={16} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {tables.map(table => (
                <button
                  key={table}
                  onClick={() => handleTableSelect(table)}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-2 ${selectedTable === table
                      ? 'bg-purple-50 text-purple-700 border-r-4 border-purple-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 border-r-4 border-transparent'
                    }`}
                >
                  <Database size={14} />
                  {table}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content - Table Viewer */}
          <div className="md:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                Explorador de Datos: <span className="text-purple-600">{selectedTable}</span>
              </h2>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center text-gray-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                  Cargando datos...
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
                    <tr>
                      {data.columns.map(col => (
                        <th key={col} className="px-4 py-3 border-b border-gray-100">{col}</th>
                      ))}
                      <th className="px-4 py-3 border-b border-gray-100 sticky right-0 bg-gray-50">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.rows.map(row => (
                      <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                        {data.columns.map(col => (
                          <td key={col} className="px-4 py-2 text-gray-600 max-w-[200px] truncate">
                            {editingRow === row.id ? (
                              col === 'id' ? row[col] : (
                                <input
                                  className="border rounded px-2 py-1 w-full focus:ring-1 focus:ring-purple-500 outline-none"
                                  value={editValues[col] || ''}
                                  onChange={(e) => setEditValues({ ...editValues, [col]: e.target.value })}
                                />
                              )
                            ) : (
                              String(row[col])
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-2 sticky right-0 bg-white/80 backdrop-blur-sm border-l border-gray-50">
                          <div className="flex gap-2">
                            {editingRow === row.id ? (
                              <>
                                <button onClick={handleUpdate} className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors">
                                  <Save size={18} />
                                </button>
                                <button onClick={() => setEditingRow(null)} className="p-1 text-gray-500 hover:bg-gray-50 rounded transition-colors">
                                  <X size={18} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEdit(row)} className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors">
                                  <Edit2 size={18} />
                                </button>
                                <button onClick={() => handleDelete(row.id)} className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors">
                                  <Trash2 size={18} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {!loading && data.rows.length === 0 && (
              <div className="p-12 text-center text-gray-400">
                Esta tabla está vacía.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperuserModule;
