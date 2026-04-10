import { useState } from 'react';
import { FileSpreadsheet, ClipboardList, LayoutDashboard } from 'lucide-react';
import HojaControl from './HojaControl';
import InventarioDocumental from './InventarioDocumental';

function Formatos() {
    const [activeTab, setActiveTab] = useState('inventario');

    return (
        <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
            <header className="mb-8 flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-orange-100">
                <div>
                    <h1 className="text-3xl font-extrabold text-orange-900 tracking-tight flex items-center gap-3">
                        <FileSpreadsheet size={32} className="text-orange-600" /> 
                        Módulo de Formatos
                    </h1>
                    <p className="text-orange-600 mt-2 flex items-center gap-2 font-medium">
                        Gestión de Inventario Documental y Hoja de Control
                    </p>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div className="bg-white rounded-t-xl border-b border-gray-200 flex overflow-x-auto shadow-sm">
                <button
                    onClick={() => setActiveTab('inventario')}
                    className={`flex items-center gap-2 px-6 py-4 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
                        activeTab === 'inventario'
                            ? 'border-orange-600 text-orange-700 bg-orange-50/50'
                            : 'border-transparent text-gray-500 hover:text-orange-600 hover:bg-orange-50/30'
                    }`}
                >
                    <LayoutDashboard size={18} />
                    Inventario Documental
                </button>
                <button
                    onClick={() => setActiveTab('hoja_control')}
                    className={`flex items-center gap-2 px-6 py-4 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
                        activeTab === 'hoja_control'
                            ? 'border-orange-600 text-orange-700 bg-orange-50/50'
                            : 'border-transparent text-gray-500 hover:text-orange-600 hover:bg-orange-50/30'
                    }`}
                >
                    <ClipboardList size={18} />
                    Hoja de Control
                </button>
            </div>

            {/* Tab Content */}
            <div className="bg-white p-6 rounded-b-xl shadow-sm border border-t-0 border-gray-200 min-h-[500px]">
                {activeTab === 'inventario' && (
                    <div className="animate-fadeIn">
                        <InventarioDocumental />
                    </div>
                )}

                {activeTab === 'hoja_control' && (
                    <div className="animate-fadeIn">
                        <HojaControl />
                    </div>
                )}
            </div>
            
            <style>{`
                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-in-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

export default Formatos;
