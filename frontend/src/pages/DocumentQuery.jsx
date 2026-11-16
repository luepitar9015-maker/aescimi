import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, Eye, FileText, ChevronRight, Filter, Info, UserCheck, Folder, FileSpreadsheet, Pencil, Upload, Save, X, Share2, Plus, Check } from 'lucide-react';

function DocumentQuery() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedExpediente, setSelectedExpediente] = useState(null);
    const [expedienteDocs, setExpedienteDocs] = useState([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [editingDoc, setEditingDoc] = useState(null);
    const [editTypologies, setEditTypologies] = useState([]);
    const [savingEdit, setSavingEdit] = useState(false);
    const [sharingDoc, setSharingDoc] = useState(null);
    const [shareSearchTerm, setShareSearchTerm] = useState('');
    const [shareSearchResults, setShareSearchResults] = useState([]);
    const [searchingShareExp, setSearchingShareExp] = useState(false);
    const [shareSelectedExps, setShareSelectedExps] = useState([]);
    const [shareLoading, setShareLoading] = useState(false);
    const [sharedInfoDoc, setSharedInfoDoc] = useState(null);
    const [sharedInfoList, setSharedInfoList] = useState([]);
    const [loadingSharedInfo, setLoadingSharedInfo] = useState(false);
    const debounceRef = useRef(null);
    const shareDebounceRef = useRef(null);

    const currentUser = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';

    useEffect(() => {
        if (!isAdmin) {
            setLoading(true);
            axios.get('/api/expedientes/search?term=')
                .then(res => setSearchResults(res.data.data || []))
                .catch(err => console.error('Error preloading expedientes:', err))
                .finally(() => setLoading(false));
        }
    }, []);

    const runSearch = async (termVal) => {
        if (!termVal && isAdmin) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/expedientes/search?term=${encodeURIComponent(termVal || '')}`);
            setSearchResults(res.data.data || []);
            setSelectedExpediente(null);
        } catch (err) {
            console.error('Error searching expedientes:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!searchTerm && isAdmin) {
            alert("Por favor ingrese un término de búsqueda (Cédula, Nombre, Ficha, ID o Código)");
            return;
        }
        await runSearch(searchTerm);
    };

    const handleInputChange = (val) => {
        setSearchTerm(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            if (!isAdmin || val.trim().length >= 2) {
                runSearch(val);
            }
        }, 350);
    };

    const fetchExpedienteDocuments = async (exp) => {
        setSelectedExpediente(exp);
        setLoadingDocs(true);
        try {
            const res = await axios.get(`/api/documents/expediente/${exp.id}`);
            setExpedienteDocs(res.data.data || []);
        } catch (err) {
            console.error('Error fetching docs:', err);
        } finally {
            setLoadingDocs(false);
        }
    };

    const handleOpenEdit = async (doc) => {
        let currentDesc = '';
        if (doc.metadata_values) {
            try {
                const meta = typeof doc.metadata_values === 'string' ? JSON.parse(doc.metadata_values) : doc.metadata_values;
                currentDesc = meta.description || '';
            } catch (_) {}
        }
        setEditingDoc({
            ...doc,
            newFilename: (doc.filename || '').replace(/\.pdf$/i, ''),
            customFilenameEdited: false,
            newTypology: doc.typology_name || '',
            newDate: doc.document_date ? doc.document_date.substring(0, 16) : new Date().toISOString().substring(0, 16),
            newOrigen: doc.origen || 'ELECTRONICO',
            newDescription: currentDesc,
            replacementFile: null,
            syncShared: Number(doc.shared_count || 1) > 1
        });

        const subCode = doc.subserie || selectedExpediente?.subserie || '';
        try {
            let list = [];
            if (subCode) {
                const r = await axios.get(`/api/trd/typologies-for-expediente?subserie=${encodeURIComponent(subCode)}`);
                list = r.data.data || [];
            }
            if (list.length === 0) {
                const rAll = await axios.get('/api/trd/all-typologies');
                list = rAll.data.data || [];
            }
            setEditTypologies(list.map((t, idx) => ({ ...t, trd_order: t.trd_order || idx + 1 })));
        } catch (_) {
            setEditTypologies([]);
        }
    };

    const handleSaveEdit = async () => {
        if (!editingDoc) return;
        setSavingEdit(true);
        try {
            const formData = new FormData();
            formData.append('filename', editingDoc.newFilename || '');
            formData.append('custom_filename_override', editingDoc.customFilenameEdited ? 'true' : 'false');
            formData.append('typology_name', editingDoc.newTypology || '');
            formData.append('document_date', editingDoc.newDate || '');
            formData.append('origen', editingDoc.newOrigen || 'ELECTRONICO');
            formData.append('metadata_values', JSON.stringify({ description: editingDoc.newDescription || '' }));
            if (Number(editingDoc.shared_count || 1) > 1) {
                formData.append('sync_shared', editingDoc.syncShared ? 'true' : 'false');
            }
            if (editingDoc.replacementFile) {
                formData.append('file', editingDoc.replacementFile);
            }
            await axios.put(`/api/documents/${editingDoc.id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setEditingDoc(null);
            if (selectedExpediente) await fetchExpedienteDocuments(selectedExpediente);
            alert('Documento actualizado correctamente.');
        } catch (err) {
            alert('Error al actualizar documento: ' + (err.response?.data?.error || err.message));
        } finally {
            setSavingEdit(false);
        }
    };

    const openShareModal = (doc) => {
        setSharingDoc(doc);
        setShareSearchTerm('');
        setShareSearchResults([]);
        setShareSelectedExps([]);
    };

    const handleShareSearchChange = (term) => {
        setShareSearchTerm(term);
        if (shareDebounceRef.current) clearTimeout(shareDebounceRef.current);
        if (!term || term.trim().length < 2) {
            setShareSearchResults([]);
            return;
        }
        shareDebounceRef.current = setTimeout(async () => {
            setSearchingShareExp(true);
            try {
                const res = await axios.get(`/api/expedientes/search?term=${encodeURIComponent(term.trim())}`);
                setShareSearchResults((res.data.data || []).slice(0, 60));
            } catch (_) {}
            finally { setSearchingShareExp(false); }
        }, 300);
    };

    const submitShareDocument = async () => {
        if (!sharingDoc || shareSelectedExps.length === 0) return;
        setShareLoading(true);
        try {
            const res = await axios.post(`/api/documents/${sharingDoc.id}/share`, {
                expediente_ids: shareSelectedExps.map(e => e.id),
                typology_name: sharingDoc.typology_name
            });
            alert(`✅ Documento vinculado en ${res.data?.created_count || 0} expediente(s) adicional(es).`);
            setSharingDoc(null);
            if (selectedExpediente) await fetchExpedienteDocuments(selectedExpediente);
        } catch (err) {
            alert('Error al compartir documento: ' + (err.response?.data?.error || err.message));
        } finally {
            setShareLoading(false);
        }
    };

    const openSharedInfoModal = async (doc) => {
        setSharedInfoDoc(doc);
        setSharedInfoList([]);
        setLoadingSharedInfo(true);
        try {
            const res = await axios.get(`/api/documents/${doc.id}/shared-expedientes`);
            setSharedInfoList(res.data?.data || []);
        } catch (_) {}
        finally { setLoadingSharedInfo(false); }
    };

    // Usa la ruta con fallback automático (disco principal → backup local)
    const handleView = (doc) => {
        window.open(`/api/documents/file/${doc.id}`, '_blank');
    };


    return (
        <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-extrabold text-indigo-900 tracking-tight">Consulta de Documentos</h1>
                    <p className="text-indigo-600 mt-1 flex items-center gap-2">
                        <UserCheck size={16} /> Módulo para trámite de firmas y visualización de expedientes
                    </p>
                </div>
            </header>

            {/* Search Bar */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 mb-8 transition-all hover:shadow-md">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-indigo-400">
                            <Search size={20} />
                        </div>
                        <input 
                            type="text" 
                            className="block w-full pl-12 pr-4 py-3 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 bg-indigo-50/10"
                            placeholder="Buscar por Cédula/TI, Nombre del Aprendiz, Ficha, Código de Expediente o Título..."
                            value={searchTerm}
                            onChange={(e) => handleInputChange(e.target.value)}
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-200 active:scale-95"
                    >
                        {loading ? 'Buscando...' : (
                            <>
                                <Search size={18} /> Buscar
                            </>
                        )}
                    </button>
                    <button 
                        type="button"
                        onClick={() => { setSearchTerm(''); setSearchResults([]); setSelectedExpediente(null); }}
                        className="text-indigo-600 hover:bg-indigo-50 px-6 py-3 rounded-xl font-semibold transition-colors border border-indigo-100"
                    >
                        Limpiar
                    </button>
                </form>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Results Column */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="flex items-center justify-between px-2 mb-2">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Filter size={18} className="text-indigo-500" /> Resultados ({searchResults.length})
                        </h2>
                    </div>

                    {searchResults.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border-2 border-dashed border-gray-200 text-center">
                            <div className="bg-gray-50 p-4 rounded-full mb-4">
                                <Info size={32} className="text-gray-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-500">Sin resultados</h3>
                            <p className="text-gray-400 max-w-xs mt-2">Realice una búsqueda para ver los expedientes cargados en el sistema.</p>
                            <p className="text-xs text-indigo-400 mt-2 max-w-xs">
                                ⚠️ Si ya buscó y no aparecen resultados, es posible que no tenga series/subseries asignadas. Contacte al administrador.
                            </p>
                        </div>
                    )}

                    <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-350px)] pr-2 scrollbar-indigo">
                        {searchResults.map(exp => (
                            <div 
                                key={exp.id}
                                onClick={() => fetchExpedienteDocuments(exp)}
                                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                                    selectedExpediente?.id === exp.id 
                                        ? 'border-indigo-500 bg-indigo-50 shadow-md ring-4 ring-indigo-50' 
                                        : 'border-white bg-white hover:border-indigo-200 hover:shadow-lg hover:translate-x-1'
                                } shadow-sm`}
                            >
                                <div className="flex justify-between items-center mb-2 gap-2">
                                    <span className="bg-indigo-600 text-white text-xs px-2.5 py-1 rounded-full font-bold">
                                        {exp.expediente_code || `ID: ${exp.id}`}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/documents?exp_id=${encodeURIComponent(exp.id)}`);
                                            }}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
                                            title="Ir directo a Gestionar / Cargar documentos de este expediente"
                                        >
                                            <Upload size={12} /> Gestionar
                                        </button>
                                        <ChevronRight size={18} className={selectedExpediente?.id === exp.id ? 'text-indigo-500' : 'text-gray-300'} />
                                    </div>
                                </div>
                                <h3 className="font-bold text-gray-900 line-clamp-1">{exp.title || exp.subseries_name || exp.series_name || exp.subserie}</h3>
                                <p className="text-sm text-indigo-500 font-medium mt-1">Ref: {exp.expediente_code || 'S/N'}</p>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Caja</div>
                                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Apertura</div>
                                    <div className="text-xs text-gray-700 font-semibold">{exp.box_id || '-'}</div>
                                    <div className="text-xs text-gray-700 font-semibold">
                                        {exp.opening_date ? new Date(exp.opening_date).toLocaleDateString() : '-'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Details Column */}
                <div className="lg:col-span-7">
                    {selectedExpediente ? (
                        <div className="bg-white rounded-2xl shadow-xl border border-indigo-100 overflow-hidden sticky top-6">
                            <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 p-6 text-white flex flex-wrap justify-between items-center gap-3">
                                <div>
                                    <h2 className="text-xl font-bold flex items-center gap-2">
                                        <FileText size={22} className="text-indigo-300" /> {selectedExpediente.title || selectedExpediente.subseries_name || selectedExpediente.series_name || selectedExpediente.subserie}
                                    </h2>
                                    <p className="text-indigo-200 text-sm mt-1">{selectedExpediente.subserie || 'Serie/Subserie no definida'} {selectedExpediente.expediente_code ? `· ${selectedExpediente.expediente_code}` : ''}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => navigate(`/documents?exp_id=${encodeURIComponent(selectedExpediente.id)}`)}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md transition-all"
                                >
                                    <Upload size={15} /> Gestionar / Cargar Docs
                                </button>
                            </div>
                            
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                        Documentos Adjuntos
                                        <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
                                            {expedienteDocs.length}
                                        </span>
                                    </h3>
                                    <a 
                                        href={`/formatos`}
                                        className="flex items-center gap-2 text-sm bg-amber-100 text-amber-700 hover:bg-amber-600 hover:text-white px-4 py-2 rounded-lg font-bold transition-all shadow-sm"
                                    >
                                        <FileSpreadsheet size={16} /> Ver Hoja de Control
                                    </a>
                                </div>

                                {loadingDocs ? (
                                    <div className="flex justify-center p-12">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                                    </div>
                                ) : expedienteDocs.length > 0 ? (
                                    <div className="space-y-6">
                                        {Object.entries(expedienteDocs.reduce((acc, doc) => {
                                            const type = doc.typology_name || 'Documento_General';
                                            if (!acc[type]) acc[type] = [];
                                            acc[type].push(doc);
                                            return acc;
                                        }, {})).map(([typology, docs]) => (
                                            <div key={typology} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                                <h4 className="font-bold text-indigo-800 mb-3 flex items-center gap-2">
                                                    <Folder size={18} /> {typology}
                                                </h4>
                                                <div className="space-y-2 pl-4 border-l-2 border-indigo-100">
                                                    {docs.map(doc => (
                                                        <div key={doc.id} className="flex flex-col p-3 bg-white rounded-lg border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all group space-y-2">
                                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <FileText size={18} className="text-gray-400 group-hover:text-indigo-500 transition-colors shrink-0" />
                                                                    <div className="min-w-0">
                                                                        <p className="font-semibold text-gray-700 text-sm truncate">{doc.filename}</p>
                                                                        {Number(doc.shared_count || 1) > 1 && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openSharedInfoModal(doc)}
                                                                                className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 hover:bg-purple-200 transition-colors"
                                                                            >
                                                                                🔗 Relacionado en {doc.shared_count} expedientes
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <button 
                                                                        onClick={() => handleOpenEdit(doc)}
                                                                        className="flex items-center gap-1 text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white px-2.5 py-1.5 rounded-md text-xs font-bold transition-all"
                                                                        title="Editar datos o reemplazar archivo"
                                                                    >
                                                                        <Pencil size={13} /> Editar
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => openShareModal(doc)}
                                                                        className="flex items-center gap-1 text-purple-700 bg-purple-50 hover:bg-purple-600 hover:text-white px-2.5 py-1.5 rounded-md text-xs font-bold transition-all"
                                                                        title="Compartir / relacionar en otros expedientes"
                                                                    >
                                                                        <Share2 size={13} /> Compartir
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleView(doc)}
                                                                        className="flex items-center gap-1 text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-md text-xs font-bold transition-all"
                                                                    >
                                                                        <Eye size={14} /> Visualizar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            {doc.metadata_values && (() => {
                                                                try {
                                                                    const meta = typeof doc.metadata_values === 'string' ? JSON.parse(doc.metadata_values) : doc.metadata_values;
                                                                    if (meta && meta.description) {
                                                                        return (
                                                                            <p className="text-xs text-gray-500 italic border-t border-gray-100 pt-2 pl-7">
                                                                                📝 {meta.description}
                                                                            </p>
                                                                        );
                                                                    }
                                                                } catch(e) {}
                                                                return null;
                                                            })()}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center p-12 border-2 border-dashed border-gray-100 rounded-xl">
                                        <p className="text-gray-400 font-medium">No hay documentos asociados a este expediente.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-gray-100/50 rounded-2xl border-2 border-dashed border-gray-200">
                            <Info size={48} className="text-gray-300 mb-4" />
                            <h3 className="text-xl font-bold text-gray-400">Seleccione un expediente</h3>
                            <p className="text-gray-400">Para ver sus documentos y realizar trámites</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL EDICIÓN DE DOCUMENTO */}
            {editingDoc && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="bg-indigo-700 p-4 text-white flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-bold flex items-center gap-2"><Pencil size={17} /> Editar Datos o Reemplazar Archivo</h3>
                                <p className="text-xs text-indigo-200 mt-0.5 truncate max-w-[380px]">Actual: {editingDoc.filename}</p>
                            </div>
                            <button onClick={() => setEditingDoc(null)} className="hover:rotate-90 transition-transform"><X size={20} /></button>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Tipología Documental (TRD)</label>
                                {editTypologies.length > 0 ? (
                                    <select
                                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={editingDoc.newTypology || ''}
                                        onChange={(e) => {
                                            const chosenName = e.target.value;
                                            const matched = editTypologies.find(t => t.name === chosenName);
                                            const suggestedName = matched
                                                ? `${String(matched.trd_order || 99).padStart(2, '0')}_${chosenName.replace(/[^a-zA-Z0-9\s-_]/g, '').trim()}`
                                                : editingDoc.newFilename;
                                            setEditingDoc({
                                                ...editingDoc,
                                                newTypology: chosenName,
                                                newFilename: editingDoc.customFilenameEdited ? editingDoc.newFilename : suggestedName
                                            });
                                        }}
                                    >
                                        {editingDoc.newTypology && !editTypologies.some(t => t.name === editingDoc.newTypology) && (
                                            <option value={editingDoc.newTypology}>{editingDoc.newTypology} (Actual)</option>
                                        )}
                                        <option value="">-- Seleccione una tipología --</option>
                                        {editTypologies.map((t, idx) => (
                                            <option key={t.id || idx} value={t.name}>
                                                {String(t.trd_order || idx + 1).padStart(2, '0')} - {t.name}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={editingDoc.newTypology}
                                        onChange={(e) => setEditingDoc({ ...editingDoc, newTypology: e.target.value })}
                                    />
                                )}
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
                                <label className="text-xs font-bold text-amber-900 uppercase flex items-center gap-1.5">
                                    <Upload size={14} /> ¿Cargó mal el archivo? Seleccionar PDF/Imagen de reemplazo
                                </label>
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff"
                                    onChange={(e) => setEditingDoc({ ...editingDoc, replacementFile: e.target.files?.[0] || null })}
                                    className="block w-full text-xs text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-amber-600 file:text-white hover:file:bg-amber-700 cursor-pointer"
                                />
                                {editingDoc.replacementFile && (
                                    <p className="text-[11px] text-green-700 font-semibold">✅ Reemplazar por: {editingDoc.replacementFile.name}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha del Documento</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={editingDoc.newDate}
                                        onChange={(e) => setEditingDoc({ ...editingDoc, newDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Soporte</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={editingDoc.newOrigen}
                                        onChange={(e) => setEditingDoc({ ...editingDoc, newOrigen: e.target.value })}
                                    >
                                        <option value="ELECTRONICO">ELECTRÓNICO</option>
                                        <option value="FISICO">FÍSICO</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre del Archivo (Sin .pdf)</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={editingDoc.newFilename}
                                    onChange={(e) => setEditingDoc({ ...editingDoc, newFilename: e.target.value, customFilenameEdited: true })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Texto / Descripción</label>
                                <textarea
                                    rows="2"
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={editingDoc.newDescription || ''}
                                    onChange={(e) => setEditingDoc({ ...editingDoc, newDescription: e.target.value })}
                                    placeholder="Descripción opcional..."
                                />
                            </div>

                            {Number(editingDoc.shared_count || 1) > 1 && (
                                <label className="flex items-center gap-2 text-xs text-purple-900 bg-purple-50 border border-purple-200 rounded-lg p-2.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(editingDoc.syncShared)}
                                        onChange={(e) => setEditingDoc({ ...editingDoc, syncShared: e.target.checked })}
                                        className="rounded text-purple-600"
                                    />
                                    <span>🔗 Sincronizar cambios en los <strong>{editingDoc.shared_count} expedientes</strong> relacionados</span>
                                </label>
                            )}

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleSaveEdit}
                                    disabled={savingEdit}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md transition-colors"
                                >
                                    {savingEdit ? 'Guardando...' : <><Save size={16} /> Guardar Cambios</>}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEditingDoc(null)}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL COMPARTIR EN OTROS EXPEDIENTES */}
            {sharingDoc && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[105] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="bg-purple-700 p-4 text-white flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-bold flex items-center gap-2"><Share2 size={18} /> Compartir y Relacionar en Otros Expedientes</h3>
                                <p className="text-xs text-purple-200 mt-0.5 truncate max-w-[440px]">{sharingDoc.filename}</p>
                            </div>
                            <button onClick={() => setSharingDoc(null)}><X size={20} /></button>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Buscar Expedientes Destino (Cédula, Nombre, Ficha o Código)</label>
                                <input
                                    type="text"
                                    value={shareSearchTerm}
                                    onChange={(e) => handleShareSearchChange(e.target.value)}
                                    placeholder="Escriba Ficha, Cédula o Nombre..."
                                    className="w-full border border-purple-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                            {searchingShareExp && <p className="text-xs text-gray-400">Buscando...</p>}
                            {shareSearchResults.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-gray-600">{shareSearchResults.length} resultado(s)</span>
                                        {shareSearchResults.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const srcId = Number(sharingDoc.expediente_id || 0);
                                                    setShareSelectedExps(prev => {
                                                        const setIds = new Set(prev.map(x => Number(x.id)));
                                                        return [...prev, ...shareSearchResults.filter(e => Number(e.id) !== srcId && !setIds.has(Number(e.id)))];
                                                    });
                                                }}
                                                className="text-xs font-bold text-purple-700 bg-purple-100 hover:bg-purple-200 px-2.5 py-1 rounded flex items-center gap-1"
                                            >
                                                <Plus size={13} /> Agregar todos ({shareSearchResults.length})
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-40 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
                                        {shareSearchResults.map(exp => {
                                            const isSource = Number(exp.id) === Number(sharingDoc.expediente_id);
                                            const isAdded = shareSelectedExps.some(x => Number(x.id) === Number(exp.id));
                                            return (
                                                <div key={exp.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs hover:bg-purple-50/40">
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-gray-800 truncate">{exp.title}</div>
                                                        <div className="text-[10px] text-gray-500">{exp.expediente_code || `ID-${exp.id}`}</div>
                                                    </div>
                                                    {isSource ? (
                                                        <span className="text-[10px] text-gray-400 font-bold">Origen</span>
                                                    ) : isAdded ? (
                                                        <span className="text-[10px] text-green-700 font-bold flex items-center gap-1"><Check size={11} /> Agregado</span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => setShareSelectedExps(prev => [...prev, exp])}
                                                            className="bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1 rounded font-bold text-[11px]"
                                                        >
                                                            + Agregar
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {shareSelectedExps.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-purple-50 border border-purple-200 rounded-lg">
                                    {shareSelectedExps.map(exp => (
                                        <span key={exp.id} className="inline-flex items-center gap-1 bg-white border border-purple-300 text-purple-900 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                                            <span className="max-w-[200px] truncate">{exp.title || exp.expediente_code}</span>
                                            <button type="button" onClick={() => setShareSelectedExps(prev => prev.filter(x => Number(x.id) !== Number(exp.id)))} className="hover:text-red-600">
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={submitShareDocument}
                                    disabled={shareLoading || shareSelectedExps.length === 0}
                                    className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md"
                                >
                                    {shareLoading ? 'Vinculando...' : <><Share2 size={15} /> Vincular en {shareSelectedExps.length} Expediente(s)</>}
                                </button>
                                <button type="button" onClick={() => setSharingDoc(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 rounded-xl">
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL VER EXPEDIENTES VINCULADOS */}
            {sharedInfoDoc && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[105] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
                        <div className="bg-purple-800 p-4 text-white flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-sm">🔗 Expedientes Relacionados ({sharedInfoList.length})</h3>
                            <button onClick={() => setSharedInfoDoc(null)}><X size={20} /></button>
                        </div>
                        <div className="p-4 overflow-y-auto space-y-2">
                            {loadingSharedInfo ? (
                                <p className="text-center text-xs text-gray-400 py-6">Cargando...</p>
                            ) : (
                                sharedInfoList.map(item => (
                                    <div key={item.id} className="p-3 border border-gray-200 rounded-lg flex items-center justify-between gap-2 bg-gray-50">
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-gray-900 truncate">{item.title || `Expediente #${item.expediente_id}`}</div>
                                            <div className="text-[11px] text-gray-500">{item.expediente_code || `ID-${item.expediente_id}`} · {item.filename}</div>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${item.status === 'Cargado' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                            {item.status || 'Pendiente'}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .scrollbar-indigo::-webkit-scrollbar {
                    width: 6px;
                }
                .scrollbar-indigo::-webkit-scrollbar-track {
                    background: transparent;
                }
                .scrollbar-indigo::-webkit-scrollbar-thumb {
                    background: #e0e7ff;
                    border-radius: 10px;
                }
                .scrollbar-indigo::-webkit-scrollbar-thumb:hover {
                    background: #c7d2fe;
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

export default DocumentQuery;
