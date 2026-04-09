import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Folder, FileText, ChevronRight, ChevronDown, Database } from 'lucide-react';

export default function TRDQuery() {
    const [series, setSeries] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedSeries, setExpandedSeries] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTRD();
    }, []);

    const fetchTRD = async () => {
        try {
            const res = await axios.get('/api/trd/all');
            // Assuming the API returns a structured list or we group it here
            setSeries(res.data.data);
        } catch (err) {
            console.error("Error fetching TRD:", err);
        } finally {
            setLoading(false);
        }
    };

    const toggleSeries = (id) => {
        setExpandedSeries(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const filteredSeries = series.filter(s => 
        s.series_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.series_code.includes(searchTerm) ||
        (s.subseries && s.subseries.some(sub => 
            sub.subseries_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sub.subseries_code.includes(searchTerm)
        ))
    );

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Database className="text-indigo-600" /> Consulta de Series y Subseries (TRD)
                    </h1>
                    <p className="text-gray-500 text-sm">Visualice y busque la estructura documental oficial.</p>
                </div>
            </div>

            <div className="mb-6 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar por código o nombre de serie/subserie..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="text-center p-12 text-gray-500 italic">Cargando estructura TRD...</div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {filteredSeries.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">No se encontraron resultados para la búsqueda.</div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {filteredSeries.map(s => (
                                <div key={s.id} className="group">
                                    <div 
                                        onClick={() => toggleSeries(s.id)}
                                        className="p-4 hover:bg-indigo-50 cursor-pointer flex items-center justify-between transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                                                <Folder size={20} />
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-indigo-400 uppercase tracking-tighter">{s.series_code}</span>
                                                <h3 className="font-bold text-gray-800 leading-tight">{s.series_name}</h3>
                                            </div>
                                        </div>
                                        {s.subseries && s.subseries.length > 0 && (
                                            <div className="text-gray-400 group-hover:text-indigo-500">
                                                {expandedSeries[s.id] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                            </div>
                                        )}
                                    </div>

                                    {expandedSeries[s.id] && s.subseries && (
                                        <div className="bg-gray-50 ml-12 border-l-2 border-indigo-100 pb-2">
                                            {s.subseries.map(sub => (
                                                <div key={sub.id} className="p-3 border-b border-gray-100 last:border-0 flex items-center gap-3">
                                                    <FileText size={16} className="text-gray-400" />
                                                    <div>
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">{sub.subseries_code}</span>
                                                        <p className="text-sm font-medium text-gray-700">{sub.subseries_name}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
