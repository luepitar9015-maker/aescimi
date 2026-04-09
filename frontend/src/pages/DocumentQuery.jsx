import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Eye, FileText, ChevronRight, Filter, Info, UserCheck } from 'lucide-react';

function DocumentQuery() {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedExpediente, setSelectedExpediente] = useState(null);
    const [expedienteDocs, setExpedienteDocs] = useState([]);
    const [loadingDocs, setLoadingDocs] = useState(false);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!searchTerm) {
            alert("Por favor ingrese un término de búsqueda (ID, Nombre o Código)");
            return;
        }
        
        setLoading(true);
        try {
            const res = await axios.get(`/api/expedientes/search?term=${encodeURIComponent(searchTerm)}`);
            setSearchResults(res.data.data || []);
            setSelectedExpediente(null);
        } catch (err) {
            console.error('Error searching expedientes:', err);
            alert("Error al buscar expedientes");
        } finally {
            setLoading(false);
        }
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

    const handleView = (doc) => {
        window.open(`/api/ades/view/${doc.id}`, '_blank');
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
                            placeholder="Buscar por Código de Expediente, ID o Título..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
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
                                <div className="flex justify-between items-start mb-2">
                                    <span className="bg-indigo-600 text-white text-xs px-2.5 py-1 rounded-full font-bold">
                                        ID: {exp.id}
                                    </span>
                                    <ChevronRight size={18} className={selectedExpediente?.id === exp.id ? 'text-indigo-500' : 'text-gray-300'} />
                                </div>
                                <h3 className="font-bold text-gray-900 line-clamp-1">{exp.title}</h3>
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
                            <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 p-6 text-white">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <FileText size={22} className="text-indigo-300" /> {selectedExpediente.title}
                                </h2>
                                <p className="text-indigo-200 text-sm mt-1">{selectedExpediente.subserie || 'Serie/Subserie no definida'}</p>
                            </div>
                            
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                        Documentos Adjuntos
                                        <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
                                            {expedienteDocs.length}
                                        </span>
                                    </h3>
                                </div>

                                {loadingDocs ? (
                                    <div className="flex justify-center p-12">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                                    </div>
                                ) : expedienteDocs.length > 0 ? (
                                    <div className="space-y-3">
                                        {expedienteDocs.map(doc => (
                                            <div 
                                                key={doc.id}
                                                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-indigo-50 hover:border-indigo-100 transition-all group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-white p-2.5 rounded-lg shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                        <FileText size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-800 text-sm">{doc.filename}</p>
                                                        <p className="text-xs text-indigo-500 font-medium">{doc.typology_name || 'Sin tipología'}</p>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleView(doc)}
                                                    className="flex items-center gap-2 bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                                                >
                                                    <Eye size={14} /> Visualizar
                                                </button>
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
