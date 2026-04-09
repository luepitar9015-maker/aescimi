import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit, Trash2, Save, X, ShieldAlert, Upload, Download, Power } from 'lucide-react';

export default function UsersManagement() {
    
    const [users, setUsers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showTrdModal, setShowTrdModal] = useState(false);
    const [showMassUploadModal, setShowMassUploadModal] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [selectedUserTrd, setSelectedUserTrd] = useState(null);
    const [userTrdPerms, setUserTrdPerms] = useState([]);
    const [allTrdItems, setAllTrdItems] = useState([]);
    const [formData, setFormData] = useState({
        full_name: '',
        document_no: '',
        email: '',
        area: '',
        position: '',
        role: 'user',
        organization_id: '',
        password: '' // Only for creation or reset
    });
    const [dependencies, setDependencies] = useState([]);
    const [error, setError] = useState('');

    const fetchDependencies = async () => {
        try {
            const res = await axios.get('/api/organization');
            setDependencies(res.data.data);
        } catch (err) {
            console.error("Error fetching dependencies:", err);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await axios.get('/api/users');
            setUsers(res.data.data);
        } catch (err) {
            console.error("Error fetching users:", err);
            setError('Error al cargar usuarios');
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchDependencies();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingUser) {
                await axios.put(`/api/users/${editingUser.id}`, formData);
            } else {
                await axios.post('/api/users', formData);
            }
            fetchUsers();
            setShowModal(false);
            setEditingUser(null);
            setFormData({ full_name: '', document_no: '', email: '', area: '', position: '', role: 'user', organization_id: '', password: '' });
        } catch (err) {
            console.error("Error saving user:", err);
            setError('Error al guardar usuario');
        }
    };

    const handleEdit = (user) => {
        setEditingUser(user);
        setFormData({
            full_name: user.full_name,
            document_no: user.document_no,
            email: user.email || '',
            area: user.area || '',
            position: user.position || '',
            role: user.role || 'user',
            organization_id: user.organization_id || '',
            password: '' // Don't populate password on edit
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Está seguro de eliminar este usuario?')) {
            try {
                await axios.delete(`/api/users/${id}`);
                fetchUsers();
            } catch (err) {
                console.error("Error deleting user:", err);
                setError('Error al eliminar usuario');
            }
        }
    };

    const handleToggleStatus = async (user) => {
        if (window.confirm(`¿Está seguro de ${user.is_active === 1 ? 'suspender' : 'activar'} a este usuario?`)) {
            try {
                await axios.put(`/api/users/${user.id}/toggle-status`, {});
                fetchUsers();
            } catch (err) {
                console.error("Error toggling status:", err);
                setError(err.response?.data?.error || 'Error al cambiar estado del usuario');
            }
        }
    };

    const handlePasswordReset = async (id) => {
        const newPassword = prompt("Ingrese la nueva contraseña:");
        if (newPassword) {
            try {
                await axios.put(`/api/users/${id}/password`, { password: newPassword });
                alert("Contraseña actualizada correctamente");
            } catch (err) {
                console.error("Error resetting password:", err);
                alert("Error al restablecer contraseña");
            }
        }
    }

    const downloadTemplate = async () => {
        try {
            const res = await axios.get('/api/users/template', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'plantilla_usuarios.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("Error descargando la plantilla:", err);
            alert("No se pudo descargar la plantilla.");
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setUploadFile(e.target.files[0]);
        }
    };

    const handleMassUpload = async (e) => {
        e.preventDefault();
        if (!uploadFile) {
            alert("Por favor seleccione un archivo Excel/CSV.");
            return;
        }

        const formData = new FormData();
        formData.append('file', uploadFile);

        setUploading(true);
        try {
            const res = await axios.post('/api/users/bulk', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const data = res.data;
            if (data.errors && data.errors.length > 0) {
                let errorMsg = `Se procesaron ${data.success} usuarios exitosamente. Fallaron ${data.failed}:\n\n`;
                data.errors.slice(0, 5).forEach(e => errorMsg += `- ${e}\n`);
                if (data.errors.length > 5) errorMsg += `... y ${data.errors.length - 5} más.`;
                alert(errorMsg);
            } else {
                alert(`Carga masiva completada: ${data.success} usuarios creados exitosamente.`);
            }

            fetchUsers();
            setShowMassUploadModal(false);
            setUploadFile(null);
        } catch (err) {
            console.error("Error en carga masiva:", err);
            alert(err.response?.data?.error || "Error al procesar el archivo de carga masiva.");
        } finally {
            setUploading(false);
        }
    };

    const openTrdPermissions = async (user) => {
        setSelectedUserTrd(user);
        setShowTrdModal(true);
        fetchUserTrdPerms(user.id);
        if (allTrdItems.length === 0) fetchAllTrdItems();
    };

    const fetchUserTrdPerms = async (userId) => {
        try {
            const res = await axios.get(`/api/trd-permissions/user/${userId}`);
            setUserTrdPerms(res.data.data);
        } catch (err) { console.error(err); }
    };

    const fetchAllTrdItems = async () => {
        try {
            const res = await axios.get('/api/trd/subseries/all');
            setAllTrdItems(res.data.data);
        } catch (err) { console.error(err); }
    };

    const addTrdPermission = async (trd) => {
        const isSub = trd.type === 'subseries';
        try {
            await axios.post('/api/trd-permissions', {
                user_id: selectedUserTrd.id,
                series_id: isSub ? null : trd.id,
                subseries_id: isSub ? trd.id : null,
                can_view: 1,
                can_upload: 1
            });
            fetchUserTrdPerms(selectedUserTrd.id);
        } catch { alert("Error asignando permiso"); }
    };

    const deleteTrdPermission = async (id) => {
        try {
            await axios.delete(`/api/trd-permissions/${id}`);
            fetchUserTrdPerms(selectedUserTrd.id);
        } catch { alert("Error eliminando permiso"); }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowMassUploadModal(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-green-700"
                    >
                        <Upload size={20} /> Carga Masiva
                    </button>
                    <button
                        onClick={() => {
                            setEditingUser(null);
                            setFormData({ full_name: '', document_no: '', email: '', area: '', position: '', role: 'user', organization_id: '', password: '' });
                            setShowModal(true);
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
                    >
                        <Plus size={20} /> Nuevo Usuario
                    </button>
                </div>
            </div>

            {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documento</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Area / Cargo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap">{user.document_no}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="font-medium text-gray-900">{user.full_name}</div>
                                    <div className="text-sm text-gray-500">{user.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">
                                        {dependencies.find(d => d.id === user.organization_id)?.section_name || user.area}
                                    </div>
                                    <div className="text-sm text-gray-500">{user.position}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                                        }`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.is_active === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {user.is_active === 1 ? 'Activo' : 'Suspendido'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium gap-2 flex">
                                    <button onClick={() => handleEdit(user)} className="text-indigo-600 hover:text-indigo-900" title="Editar">
                                        <Edit size={18} />
                                    </button>
                                    <button onClick={() => handleToggleStatus(user)} className={`${user.is_active === 1 ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'}`} title={user.is_active === 1 ? 'Suspender' : 'Activar'}>
                                        <Power size={18} />
                                    </button>
                                    <button onClick={() => handlePasswordReset(user.id)} className="text-yellow-600 hover:text-yellow-900" title="Cambiar Contraseña">
                                        <Save size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-900" title="Eliminar">
                                        <Trash2 size={18} />
                                    </button>
                                    <button onClick={() => openTrdPermissions(user)} className="text-pink-600 hover:text-pink-900" title="Permisos TRD">
                                        <ShieldAlert size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h2 className="text-xl font-semibold">
                                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                                <input
                                    type="text"
                                    name="full_name"
                                    value={formData.full_name}
                                    onChange={handleInputChange}
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Documento (Usuario)</label>
                                <input
                                    type="text"
                                    name="document_no"
                                    value={formData.document_no}
                                    onChange={handleInputChange}
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                />
                            </div>

                            {!editingUser && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        placeholder="Dejar en blanco para usar Documento"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Cargo / Posición</label>
                                    <input
                                        type="text"
                                        name="position"
                                        value={formData.position}
                                        onChange={handleInputChange}
                                        required
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Dependencia (SENA)</label>
                                    <select
                                        name="organization_id"
                                        value={formData.organization_id}
                                        onChange={(e) => {
                                            const depId = e.target.value;
                                            const dep = dependencies.find(d => String(d.id) === String(depId));
                                            setFormData(prev => ({ 
                                                ...prev, 
                                                organization_id: depId,
                                                area: dep ? dep.section_name : '' 
                                            }));
                                        }}
                                        required
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                    >
                                        <option value="">Seleccione Dependencia</option>
                                        {dependencies.map(dep => (
                                            <option key={dep.id} value={dep.id}>
                                                {dep.section_name} {dep.subsection_name ? `- ${dep.subsection_name}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Rol</label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleInputChange}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                >
                                    <option value="user">Usuario</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showMassUploadModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h2 className="text-xl font-semibold">Carga Masiva de Usuarios</h2>
                            <button onClick={() => setShowMassUploadModal(false)} className="text-gray-500 hover:text-gray-700">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6">
                            <div className="bg-blue-50 text-blue-800 p-4 rounded-lg mb-6 text-sm">
                                <p className="mb-2">Para realizar la carga masiva, por favor utilice la plantilla estandarizada.</p>
                                <button 
                                    onClick={downloadTemplate}
                                    className="flex items-center gap-2 text-blue-700 font-medium hover:text-blue-900"
                                >
                                    <Download size={18} /> Descargar Plantilla
                                </button>
                            </div>

                            <form onSubmit={handleMassUpload} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Archivo Excel (.xlsx, .csv)</label>
                                    <input
                                        type="file"
                                        accept=".xlsx, .csv"
                                        onChange={handleFileChange}
                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border rounded-lg"
                                        required
                                    />
                                </div>
                                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                                    <button
                                        type="button"
                                        onClick={() => setShowMassUploadModal(false)}
                                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                                        disabled={uploading}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700 flex items-center gap-2"
                                        disabled={uploading || !uploadFile}
                                    >
                                        {uploading ? (
                                            <>Procesando...</>
                                        ) : (
                                            <><Upload size={18} /> Cargar Usuarios</>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {showTrdModal && selectedUserTrd && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b">
                            <div>
                                <h2 className="text-xl font-semibold">Permisos TRD Granulares</h2>
                                <p className="text-sm text-gray-500">Usuario: {selectedUserTrd.full_name}</p>
                            </div>
                            <button onClick={() => setShowTrdModal(false)} className="text-gray-500 hover:text-gray-700">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-2 gap-6">
                            <div>
                                <h3 className="font-bold mb-3 text-gray-700 border-b pb-2">Series/Subseries Disponibles</h3>
                                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                                    {allTrdItems.map(item => (
                                        <div key={`${item.type}-${item.id}`} className="flex justify-between items-center p-2 bg-gray-50 rounded border text-sm">
                                            <span>
                                                <strong className="text-blue-600 mr-2">[{item.concatenated_code}]</strong>
                                                {item.subseries_name}
                                            </span>
                                            <button 
                                                onClick={() => addTrdPermission(item)}
                                                className="text-blue-600 hover:bg-blue-100 p-1 rounded"
                                            >
                                                Asignar
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="font-bold mb-3 text-gray-700 border-b pb-2">Permisos Asignados</h3>
                                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                                    {userTrdPerms.length === 0 && <p className="text-gray-400 italic text-sm">No hay permisos asignados.</p>}
                                    {userTrdPerms.map(p => (
                                        <div key={p.id} className="flex justify-between items-center p-2 bg-pink-50 rounded border border-pink-100 text-sm">
                                            <span>
                                                {p.subseries_name || p.series_name}
                                                <div className="text-[10px] text-gray-500">
                                                    Ver: {p.can_view ? 'SÍ' : 'NO'} | Cargar: {p.can_upload ? 'SÍ' : 'NO'}
                                                </div>
                                            </span>
                                            <button 
                                                onClick={() => deleteTrdPermission(p.id)}
                                                className="text-red-600 hover:bg-red-100 p-1 rounded"
                                            >
                                                Quitar
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t bg-gray-50 flex justify-end">
                            <button onClick={() => setShowTrdModal(false)} className="bg-gray-800 text-white px-6 py-2 rounded">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
