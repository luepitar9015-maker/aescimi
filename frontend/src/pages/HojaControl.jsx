import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import html2pdf from 'html2pdf.js';
import { Search, FileText, Download, Check, Briefcase } from 'lucide-react';

function HojaControl() {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedExp, setSelectedExp] = useState(null);
    const [documentos, setDocumentos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generandoPDF, setGenerandoPDF] = useState(false);
    
    // Form fields State
    const [responsable, setResponsable] = useState('');
    const [formSede, setFormSede] = useState('');
    const [formCodSede, setFormCodSede] = useState('');
    const [formUnidad, setFormUnidad] = useState('');
    const [formCodUnidad, setFormCodUnidad] = useState('');
    const [formOficina, setFormOficina] = useState('');
    const [formCodOficina, setFormCodOficina] = useState('');

    const templateRef = useRef(null);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchTerm) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/expedientes/search?term=${encodeURIComponent(searchTerm)}`);
            setSearchResults(res.data.data);
            setSelectedExp(null); 
            setDocumentos([]);
        } catch (err) {
            console.error(err);
            alert("Error al buscar expedientes");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectExpediente = async (exp) => {
        setLoading(true);
        try {
            // Load full details for this expediente
            const expRes = await axios.get(`/api/expedientes/detail/${exp.id}`);
            const expDetail = expRes.data.data;
            setSelectedExp(expDetail);

            // Load documents for this expediente
            const res = await axios.get(`/api/documents/expediente/${exp.id}`);
            const docs = res.data.data || [];
            
            // Format documents for the table
            const formattedDocs = docs.map(d => ({
                id: d.id,
                fecha: d.document_date ? d.document_date.split('T')[0] : '',
                tipo: d.typology_name || d.filename,
                soporte: d.origen || 'ELECTRONICO', // Mapping Origen to Soporte
                folios: '',
                obs: expDetail.expediente_code || ''
            }));
            
            setDocumentos(formattedDocs);
            
            // Pre-fill fields based on Expediente detail data
            setFormSede(expDetail.regional_name || '');
            setFormCodSede(expDetail.regional_code || '');
            setFormUnidad(expDetail.center_name || '');
            setFormCodUnidad((expDetail.regional_code && expDetail.center_code) ? `${expDetail.regional_code}.${expDetail.center_code}` : '');
            setFormOficina(expDetail.section_name || '');
            
            let oficiaCode = expDetail.section_code || '';
            if (expDetail.regional_code && expDetail.center_code && expDetail.section_code) {
                if (expDetail.section_code === expDetail.center_code) {
                    oficiaCode = `${expDetail.regional_code}.${expDetail.center_code}`;
                } else {
                    oficiaCode = `${expDetail.regional_code}.${expDetail.center_code}.${expDetail.section_code}`;
                }
            }
            setFormCodOficina(oficiaCode);
        } catch (err) {
            console.error(err);
            alert("Error al cargar detalles y documentos del expediente");
        } finally {
            setLoading(false);
        }
    };

    const addEmptyDocumentRow = () => {
        setDocumentos([
            ...documentos,
            { id: Date.now(), fecha: '', tipo: '', soporte: 'ELECTRONICO', folios: '', obs: '', isManuallyAdded: true }
        ]);
    };

    const updateDocField = (idx, field, value) => {
        const newDocs = [...documentos];
        newDocs[idx][field] = value;
        setDocumentos(newDocs);
    };

    const removeDocRow = (idx) => {
        const newDocs = documentos.filter((_, i) => i !== idx);
        setDocumentos(newDocs);
    };

    const generarPDF = () => {
        if (!selectedExp) {
            alert("Por favor seleccione un expediente primero.");
            return;
        }

        setGenerandoPDF(true);
        
        // Show template temporarily for capturing
        if(templateRef.current) {
            templateRef.current.style.display = 'block';
        }

        const opt = {
            margin:       [10, 10, 10, 10], 
            filename:     `Hoja_Control_GDF003_${selectedExp.expediente_code || 'Vacia'}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'letter', orientation: 'portrait' } 
        };

        html2pdf().set(opt).from(templateRef.current).save().then(() => {
            // Hide template again
            if(templateRef.current) {
                templateRef.current.style.display = 'none';
            }
            setGenerandoPDF(false);
        }).catch(err => {
            console.error("Error generating PDF", err);
            setGenerandoPDF(false);
            if(templateRef.current) templateRef.current.style.display = 'none';
            alert("Hubo un error al generar el PDF.");
        });
    };

    return (
        <div className="space-y-6">
            <style>{`
                .pdf-table { width: 100%; border-collapse: collapse; font-size: 10px; font-family: "Arial", sans-serif; color: black; }
                .pdf-table th, .pdf-table td { border: 1px solid black; padding: 3px 4px; vertical-align: middle; line-height: 1.2; }
                .pdf-bold { font-weight: bold; }
                .pdf-center { text-align: center; }
            `}</style>
            
            {/* Header / Buscador */}
            <div className="bg-white p-6 justify-between items-center rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 text-[#39A900]"><FileText /> Hoja de Control GD-F-003</h2>
                        <p className="text-gray-500 text-sm mt-1">Busque un expediente para cargar sus documentos y generar la hoja de control.</p>
                    </div>
                </div>

                <form onSubmit={handleSearch} className="flex gap-4 mb-6">
                    <input 
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar expediente..." 
                        className="flex-1 border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#39A900] outline-none"
                    />
                    <button type="submit" disabled={loading} className="bg-[#39A900] text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2 font-medium">
                        <Search size={18} /> {loading ? 'Buscando...' : 'Buscar'}
                    </button>
                </form>

                {searchResults.length > 0 && !selectedExp && (
                    <div className="mt-4 border rounded overflow-hidden">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="bg-gray-100 text-gray-700">
                                <tr>
                                    <th className="px-4 py-2">Código</th>
                                    <th className="px-4 py-2">Título</th>
                                    <th className="px-4 py-2">Subserie</th>
                                    <th className="px-4 py-2 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {searchResults.map(exp => (
                                    <tr key={exp.id} className="border-b hover:bg-gray-50">
                                        <td className="px-4 py-2">{exp.expediente_code}</td>
                                        <td className="px-4 py-2">{exp.title}</td>
                                        <td className="px-4 py-2">{exp.subserie}</td>
                                        <td className="px-4 py-2 text-center">
                                            <button onClick={() => handleSelectExpediente(exp)} className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded font-bold">Seleccionar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* FORMULARIO DE HOJA DE CONTROL UI */}
            {selectedExp && (
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200 max-w-5xl mx-auto">
                    {/* Header App */}
                    <div className="bg-[#39A900] p-6 text-white flex justify-between items-center">
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2"><Briefcase size={20}/> Diligenciamiento de Hoja de Control</h1>
                            <p className="text-green-100 text-sm mt-1">Expediente: {selectedExp.expediente_code || selectedExp.title}</p>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => setSelectedExp(null)} className="bg-white/20 text-white hover:bg-white/30 font-bold py-2 px-4 rounded shadow transition-colors text-sm">
                                Cambiar Exp.
                            </button>
                            <button onClick={generarPDF} disabled={generandoPDF} className="bg-white text-[#39A900] hover:bg-gray-100 font-bold py-2 px-4 rounded shadow transition-colors flex items-center gap-2 text-sm disabled:opacity-50">
                                <Download size={18} />
                                {generandoPDF ? 'Generando...' : 'Generar PDF'}
                            </button>
                        </div>
                    </div>

                    <div className="p-8">
                        <div className="space-y-8">
                            {/* SECCIÓN: METADATOS DEL EXPEDIENTE */}
                            <div>
                                <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex justify-between items-center">
                                    <span>1. Identificación y Metadatos</span>
                                    <span className="text-xs font-normal text-blue-600 bg-blue-50 px-2 py-1 rounded">Campos prellenados (modificables)</span>
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                    <div className="md:col-span-8">
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Sede</label>
                                        <input type="text" value={formSede} onChange={e=>setFormSede(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-[#39A900] outline-none" />
                                    </div>
                                    <div className="md:col-span-4">
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Código Sede</label>
                                        <input type="text" value={formCodSede} onChange={e=>setFormCodSede(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-[#39A900] outline-none" />
                                    </div>

                                    <div className="md:col-span-8">
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Unidad Administrativa</label>
                                        <input type="text" value={formUnidad} onChange={e=>setFormUnidad(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-[#39A900] outline-none" />
                                    </div>
                                    <div className="md:col-span-4">
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Código Unidad</label>
                                        <input type="text" value={formCodUnidad} onChange={e=>setFormCodUnidad(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-[#39A900] outline-none" />
                                    </div>

                                    <div className="md:col-span-8">
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Oficina Productora</label>
                                        <input type="text" value={formOficina} onChange={e=>setFormOficina(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-[#39A900] outline-none" />
                                    </div>
                                    <div className="md:col-span-4">
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Código Oficina</label>
                                        <input type="text" value={formCodOficina} onChange={e=>setFormCodOficina(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-[#39A900] outline-none" />
                                    </div>

                                    <div className="md:col-span-8">
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Serie Documental</label>
                                        <input type="text" value={selectedExp.series_name || ''} readOnly className="w-full border border-gray-200 bg-gray-50 rounded p-2 text-sm outline-none" />
                                    </div>
                                    <div className="md:col-span-4">
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Código Serie</label>
                                        <input type="text" value={selectedExp.series_code || ''} readOnly className="w-full border border-gray-200 bg-gray-50 rounded p-2 text-sm outline-none" />
                                    </div>

                                    <div className="md:col-span-8">
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Subserie</label>
                                        <input type="text" value={selectedExp.subseries_name || ''} readOnly className="w-full border border-gray-200 bg-gray-50 rounded p-2 text-sm outline-none" />
                                    </div>
                                    <div className="md:col-span-4">
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Código Subserie</label>
                                        <input type="text" value={selectedExp.subseries_code || ''} readOnly className="w-full border border-gray-200 bg-gray-50 rounded p-2 text-sm outline-none" />
                                    </div>

                                    <div className="md:col-span-12">
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Identificación del Expediente (Nombre/Título)</label>
                                        <input type="text" value={`${selectedExp.title || ''} - ${Object.values(selectedExp.metadata_values || {}).filter(v=>v).join(', ')}`} readOnly className="w-full border border-blue-200 rounded p-2 text-sm font-semibold text-blue-800 bg-blue-50 outline-none" />
                                    </div>
                                </div>
                            </div>

                            {/* SECCIÓN: DOCUMENTOS (FILAS DINÁMICAS) */}
                            <div>
                                <div className="flex justify-between items-center mb-4 border-b pb-2">
                                    <h2 className="text-lg font-bold text-gray-800">2. Registro de Tipos Documentales</h2>
                                    <button onClick={addEmptyDocumentRow} className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold py-1.5 px-3 rounded flex items-center gap-1 transition-colors">
                                        + Agregar Fila Manual
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-max text-sm">
                                        <thead>
                                            <tr className="bg-gray-100 text-gray-600 text-xs uppercase">
                                                <th className="p-2 border">Fecha Ingreso</th>
                                                <th className="p-2 border">Identificación del Tipo Documental</th>
                                                <th className="p-2 border w-28">Soporte</th>
                                                <th className="p-2 border w-24">Folios (Del-Al)</th>
                                                <th class="p-2 border">Observaciones</th>
                                                <th className="p-2 border w-10 text-center">X</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {documentos.map((doc, idx) => (
                                                <tr key={doc.id} className="bg-white hover:bg-gray-50">
                                                    <td className="p-1 border"><input type="date" value={doc.fecha} onChange={e=>updateDocField(idx, 'fecha', e.target.value)} className="w-full p-1 text-xs border rounded outline-none focus:border-blue-500" /></td>
                                                    <td className="p-1 border"><input type="text" value={doc.tipo} onChange={e=>updateDocField(idx, 'tipo', e.target.value)} className="w-full p-1 text-xs border rounded outline-none focus:border-blue-500" /></td>
                                                    <td className="p-1 border">
                                                        <select value={doc.soporte} onChange={e=>updateDocField(idx, 'soporte', e.target.value)} className="w-full p-1 text-xs border rounded outline-none focus:border-blue-500 bg-white">
                                                            <option value="FISICO">Físico</option>
                                                            <option value="ELECTRONICO">Electrónico</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-1 border"><input type="text" value={doc.folios} onChange={e=>updateDocField(idx, 'folios', e.target.value)} className="w-full p-1 text-xs border rounded outline-none focus:border-blue-500 text-center" placeholder="1 - 5" /></td>
                                                    <td className="p-1 border"><input type="text" value={doc.obs} onChange={e=>updateDocField(idx, 'obs', e.target.value)} className="w-full p-1 text-xs border rounded outline-none focus:border-blue-500" /></td>
                                                    <td className="p-1 border text-center">
                                                        <button onClick={() => removeDocRow(idx)} className="text-red-500 hover:bg-red-100 p-1 w-full rounded font-bold">X</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* SECCIÓN: RESPONSABLE */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Nombres y Apellidos del Responsable de Archivar la Información:</label>
                                <input type="text" value={responsable} onChange={e=>setResponsable(e.target.value)} className="w-full border border-gray-300 rounded p-2 focus:ring-[#39A900] outline-none" />
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                PLANTILLA PDF OCULTA (FORMATO EXACTO GD-F-003)
                ========================================== */}
            <div ref={templateRef} style={{ display: 'none', backgroundColor: 'white', padding: '20px' }} id="pdfTemplate">
                <table className="pdf-table">
                    <colgroup>
                        <col style={{ width: '13%' }} />
                        <col style={{ width: '37%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '24%' }} />
                    </colgroup>
                    <tbody>
                        {/* ENCABEZADOS Y LOGO */}
                        <tr>
                            <td rowSpan="2" colSpan="4" className="pdf-center" style={{ padding: '8px' }}>
                                <img src="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIgogICB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgd2lkdGg9IjEwMCIKICAgaGVpZ2h0PSI5OCIKICAgdmlld0JveD0iMCAwIDc0Ljk5OTk5NyA3My41IgogICB2ZXJzaW9uPSIxLjEiCiAgIGlkPSJzdmcxMiIKICAgc29kaXBvZGk6ZG9jbmFtZT0iU0VOQSBsb2dvLnN2ZyIKICAgaW5rc2NhcGU6dmVyc2lvbj0iMC45Mi40ICg1ZGE2ODljMzEzLCAyMDE5LTAxLTE0KSI+CiAgPHRpdGxlCiAgICAgaWQ9InRpdGxlMjIyIj5TRU5BIENvbG9tYmlhIGxvZ288L3RpdGxlPgogIDxtZXRhZGF0YQogICAgIGlkPSJtZXRhZGF0YTE4Ij4KICAgIDxyZGY6UkRGPgogICAgICA8Y2M6V29yawogICAgICAgICByZGY6YWJvdXQ9IiI+CiAgICAgICAgPGRjOmZvcm1hdD5pbWFnZS9zdmcreG1sPC9kYzpmb3JtYXQ+CiAgICAgICAgPGRjOnR5cGUKICAgICAgICAgICByZGY6cmVzb3VyY2U9Imh0dHA6Ly9wdXJsLm9yZy9kYy9kY21pdHlwZS9TdGlsbEltYWdlIiAvPgogICAgICAgIDxkYzp0aXRsZT5TRU5BIENvbG9tYmlhIGxvZ288L2RjOnRpdGxlPgogICAgICA8L2NjOldvcms+CiAgICA8L3JkZjpSREY+CiAgPC9tZXRhZGF0YT4KICA8ZGVmcwogICAgIGlkPSJkZWZzMTYiPgogICAgPHBhdHRlcm4KICAgICAgIHk9IjAiCiAgICAgICB4PSIwIgogICAgICAgaGVpZ2h0PSI2IgogICAgICAgd2lkdGg9IjYiCiAgICAgICBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9IkVNRmhiYXNlcGF0dGVybiIgLz4KICAgIDxwYXR0ZXJuCiAgICAgICB5PSIwIgogICAgICAgeD0iMCIKICAgICAgIGhlaWdodD0iNiIKICAgICAgIHdpZHRoPSI2IgogICAgICAgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJFTUZoYmFzZXBhdHRlcm4tMCIgLz4KICA8L2RlZnM+CiAgPHNvZGlwb2RpOm5hbWVkdmlldwogICAgIHBhZ2Vjb2xvcj0iI2ZmZmZmZiIKICAgICBib3JkZXJjb2xvcj0iIzY2NjY2NiIKICAgICBib3JkZXJvcGFjaXR5PSIxIgogICAgIG9iamVjdHRvbGVyYW5jZT0iMSIKICAgICBncmlkdG9sZXJhbmNlPSIxIgogICAgIGd1aWRldG9sZXJhbmNlPSIxIgogICAgIGlua3NjYXBlOnBhZ2VvcGFjaXR5PSIwIgogICAgIGlua3NjYXBlOnBhZ2VzaGFkb3c9IjIiCiAgICAgaW5rc2NhcGU6d2luZG93LXdpZHRoPSIxMzY2IgogICAgIGlua3NjYXBlOndpbmRvdy1oZWlnaHQ9IjcwNSIKICAgICBpZD0ibmFtZWR2aWV3MTQiCiAgICAgc2hvd2dyaWQ9ImZhbHNlIgogICAgIHVuaXRzPSJweCIKICAgICBpbmtzY2FwZTpzaG93cGFnZXNoYWRvdz0iZmFsc2UiCiAgICAgaW5rc2NhcGU6em9vbT0iMSIKICAgICBpbmtzY2FwZTpjeD0iOTYuMjY1MTA0IgogICAgIGlua3NjYXBlOmN5PSI1Ni43NDcyOTQiCiAgICAgaW5rc2NhcGU6d2luZG93LXg9Ii04IgogICAgIGlua3NjYXBlOndpbmRvdy15PSItOCIKICAgICBpbmtzY2FwZTp3aW5kb3ctbWF4aW1pemVkPSIxIgogICAgIGlua3NjYXBlOmN1cnJlbnQtbGF5ZXI9InN2ZzEyIj4KICAgIDxpbmtzY2FwZTpncmlkCiAgICAgICB0eXBlPSJ4eWdyaWQiCiAgICAgICBpZD0iZ3JpZDU4IiAvPgogIDwvc29kaXBvZGk6bmFtZWR2aWV3PgogIDxnCiAgICAgaWQ9IiNmZmZmZmZmZiIKICAgICB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwLC0xMzAuNSkiIC8+CiAgPHBhdGgKICAgICBzdHlsZT0iZmlsbDojMzlBOTAwO2ZpbGwtb3BhY2l0eToxO3N0cm9rZTpub25lO3N0cm9rZS13aWR0aDowLjE1MzU2Njk0cHg7c3Ryb2tlLWxpbmVjYXA6YnV0dDtzdHJva2UtbGluZWpvaW46bWl0ZXI7c3Ryb2tlLW1pdGVybGltaXQ6NDtzdHJva2UtZGFzaGFycmF5Om5vbmU7c3Ryb2tlLW9wYWNpdHk6MSIKICAgICBkPSJNIDM3LjcyOTMxMiwwLjc2NzA5MjExIEEgNy45NjcxMjI1LDcuOTY3MTIyNSAwIDAgMCAyOS43NzMzNzEsOC43NDE1NDUgNy45NjcxMjI1LDcuOTY3MTIyNSAwIDAgMCAzNy43NDQ2MDUsMTYuNzAxMTA3IDcuOTY3MTIyNSw3Ljk2NzEyMjUgMCAwIDAgNDUuNzA3Nzg4LDguNzMzODk4IFYgOC43MTg2MDggQSA3Ljk2NzEyMjUsNy45NjcxMjI1IDAgMCAwIDM3LjcyOTMxMiwwLjc2NzA5MjExIFogTSAxMS40NDY5ODIsMTkuMTY5NTUzIGMgLTEuNDAwMDYyLDAuMDA4NCAtMi44MjM0ODYyLDAuMDg1OTkgLTQuMTU4NDg1NywwLjQyMjYxIC0wLjg3OTU5MDUsMC4yMjI2OTQgLTEuNzMxNTQ0OSwwLjU4OTIzNCAtMi4yODQxMDg2LDEuMTU5NTYyIC0wLjY5Mzk1NzMsMC43MTQ2OSAtMC43ODMwNTE2LDEuNjgzMzc1IC0wLjQ0NDc0NjMsMi41MTA3MDggMC4zMDI3Mzc4LDAuNzI4OTMyIDEuMTE2NDEyLDEuMjc1OTM0IDIuMDIyODkzNiwxLjU4ODYxMiAxLjk1MDAxNzUsMC42NjgwNzkgNC4xMTc0NTUsMC44MDk2MTIgNi4xNjgwOTYsMS4yMzAzOTkgMC4zNzgyMDcsMC4wOTI1NyAwLjc5NjU1NiwwLjE5NDQ5OCAxLjAzMDc2NiwwLjQ1Mjc5NiAwLjI0Mjg4NSwwLjMwNjg1MiAwLjA5ODcxLDAuNzI5OTg2IC0wLjI5OTQ0NiwwLjkyMjkwMSAtMC42NjYyMDQsMC4zMzg1NzIgLTEuNTE3MDY3LDAuMzQxMjg5IC0yLjI5MjU2LDAuMzI5NjM2IC0wLjcwODcwOSwtMC4wMjkxMyAtMS40ODYwMjQ3LC0wLjA4ODc4IC0yLjA0OTg2MzQsLTAuNDQzNTQgLTAuNDE0NjM4MiwtMC4yNTUwNjEgLTAuNDg3MjUzLC0wLjg2OTI3OCAtMC4zOTQ0MzQzLC0xLjA2MjE2MSBsIC00LjU3MTQzNzQsNC4xM2UtNCBjIC0wLjAxMjE0NCwwLjY5NTkxNyAwLjEyMzA1MjgsMS40MjIxNTcgMC42MzMxMTA4LDIuMDE5Njc0IDAuNDI1OTE2OCwwLjUxMDEyNCAxLjExMzg1NjEsMC44Njk0NDMgMS44NTQ2NTUyLDEuMDg2MzEgMS4xODIzMjc0LDAuMzQ3NjM1IDIuNDYzMzM5NywwLjQ1MjQ3IDMuNzI0NjA2MSwwLjQ4NDE5MSAxLjcxMTQ2OCwwLjAyOTEzIDMuNDU2MDg2LC0wLjAyMTcyIDUuMDk5ODk1LC0wLjQxMDEzMyAwLjk3OTM0OSwtMC4yMzgyMzEgMS45NDIzMTEsLTAuNjI0Mjc4IDIuNTY5NDczLC0xLjI1MDkyNyAxLjExMzc5OCwtMS4xMTc5OTggMC44NTE2NDMsLTIuODg4NTk5IC0wLjYyOTA4NiwtMy43NTgwMTEgLTAuNzM3MzI5LC0wLjQyOTIwMyAtMS42MjAzNjIsLTAuNjk1ODA1IC0yLjUyMDc3LC0wLjg2NzM1NyAtMS4zMTY3ODEsLTAuMjczMTg4IC0yLjY1NzcyNCwtMC40NzI5NzcgLTMuOTkxODU1LC0wLjY5MzA4MSAtMC40Njg0MjEsLTAuMDkxMjcgLTAuOTYzNzY0MSwtMC4xNzE4MyAtMS4zNTc1ODY3LC0wLjM5MzIyOSAtMC40MTIwMzQ3LC0wLjIyMTM5OSAtMC40NDUxOTg4LC0wLjc0MjUyMSAtMC4wMjUzNTUsLTAuOTcwMzkzIDAuNTQzMDIwNywtMC4zMDYyMDMgMS4yNjY1MTQ3LC0wLjMwNDAzNSAxLjkxNjIzNzcsLTAuMzA0NjgxIDAuNjg1MjgsMC4wMTE2NSAxLjQzMDQ3NiwwLjA1NDgzIDEuOTk0MzE1LDAuMzc1OTIxIDAuMzE1NzUsMC4xNzY3MyAwLjQ0MjQ4NSwwLjQ3MzQ0MyAwLjQ0NTk1NSwwLjc1ODI4MyBsIDQuMzQ0ODM3LC0wLjAxMDA0IGMgLTAuMDE3MzQsLTAuNTUwOTI1IC0wLjExODczMSwtMS4xMjMxMjMgLTAuNTIxMjI3LC0xLjU5ODI4OSAtMC40NjY2ODYsLTAuNTg1MjE4IC0xLjI4NzQ3NywtMC45NTQwNTIgLTIuMTMyMzcsLTEuMTY5NjI1IC0xLjMyNTQ1NywtMC4zMzUzMzQgLTIuNzQxMDAyLC0wLjQwNDA2MSAtNC4xMzE1MTUsLTAuNDEwNTM1IHogbSA5LjQyNTgxNywwLjMyODgzMSAtMC4wMDE5LDEwLjM4MTMyIDEyLjY3MDI1Niw0LjEyZS00IC0wLjAwMTEsLTIuMjYzMTc4IEggMjUuNTE4MTU3IFYgMjUuNjAxNjkgaCA3LjE1NDU5MiB2IC0yLjIxMjQ2NSBoIC03LjE1NDU5MiBsIC0wLjAwMTYsLTEuNjUyNjA3IDcuNzM0MTY3LC0wLjAwMiAtMC4wMDQ0LC0yLjIzNjIxMyB6IG0gMjAuODc0OTMyLDAuMDAzNiBjIDAsMCAtMy45MTQ5MSwwLjAwMTIgLTUuODcxODY4LDAuMDAxMiBsIC04LjI1ZS00LDEwLjM4MjEyNSA0LjQ0ODI3NCw0LjEyZS00IC0wLjAwMjgsLTYuOTg2MzUxIDYuMDkzMjM1LDYuOTgwNzE2IDYuMTA0OTA1LDAuMDA1NiAtMC4wMDE2LC0xMC4zODI1MjcgLTQuNDUxODk3LDcuOTdlLTQgMC4wMDUyLDYuOTM2NDQzIHogbSAxOC43MDI3MTMsMC4wMTczMSBjIDAsMCAtNC43OTUxMzUsNi45MjU3NTcgLTcuMjA0ODk5LDEwLjM4MzMzMiBsIDQuNjY5MjM5LDQuMTJlLTQgMS4xMjAxMTgsLTEuODczMTY5IGggNy4yMTQ1NiBsIDEuMDQ1MjU2LDEuODczOTc0IDUuMTg2NDM0LC03Ljk2ZS00IC02Ljg3Mjg0OCwtMTAuMzgyMTI1IHogbSAyLjMzMzIxNCwyLjQ3ODEwNSAyLjIxNDA3NCwzLjc2MDgzIC00LjU3NjY2OSwwLjAwNjUgeiBtIC02Mi4yNjgxOTQ4OSwxMC44MTg4MSAwLjA0MDI0NTksNS42NTE3MDcgMjEuMTE4ODM3OTksLTAuMDc1MjcgYyAxLjA3NzA2LDAuMjMxODQxIDEuNzAyNCwwLjkzMjk2NCAxLjQ4MjM1NSwyLjUyNjgwNyBsIC0xMi45ODk0MjcsMjIuNzM4MDcgNC4yMzEzMzUsMy45NTU2MzEgMjAuMTE4NjYyLC0zNC43OTY5MTggeiBtIDQwLjI5OTMwMjg5LDAuMDQ4MyAxOS43ODQxOTYsMzQuNjQ5MjA4IDQuMzcyMjA1LC0zLjkzMDI3NSAtMTMuMTQwMzYsLTIyLjY3ODQ3MiBjIC0wLjIyMDExLC0xLjU5ODc2MyAwLjQwNTQ0NCwtMi4zMDc5NjMgMS40ODI3NTksLTIuNTQwNDkxIGwgMjEuMTIzMjY0LDAuMDc1MjcgLTAuMDA1NiwtNS41NTc5MjggeiBtIC0zLjMzNzgxNCw1LjczMzgxNCAtMTguNTUyOTkyLDMxLjg0NTQ5MSA0LjkyODAzOCwyLjQwMTYzNSAxMi4zODAwNjUsLTIwLjkyNDAzNSBjIDAuNDI2NTIyLC0wLjM0ODkyMyAwLjg1ODQ5NywtMC41MzQ4NDcgMS4yOTA3NzIsLTAuNTUyMjEyIDAuNDU1MzI1LC0wLjAxNzQ0IDAuOTE2NjU1LDAuMTUxMDA0IDEuMzc3NzA5LDAuNTExNTU4IGwgMTIuMzUxNDg3LDIwLjk4ODAzMyA1LjA4MzM5OCwtMi42NTE1OCB6IgogICAgIGlkPSJwYXRoNDctNSIKICAgICBpbmtzY2FwZTpjb25uZWN0b3ItY3VydmF0dXJlPSIwIiAvPgogIDxnCiAgICAgaWQ9IiMwMDAwMDBmZi0yIgogICAgIHRyYW5zZm9ybT0ibWF0cml4KDAuMzE1NzA2MTEsMCwwLDAuMjM1NjA3NzQsLTM5MS40OTY5OCwtMTAuNjAxMTI2KSIKICAgICBzdHlsZT0iZmlsbDojMzlBOTAwO2ZpbGwtb3BhY2l0eToxIiAvPgo8L3N2Zz4K" alt="SENA" style={{ height: '45px', display: 'block', margin: '0 auto' }} />
                            </td>
                            <td colSpan="2" style={{ paddingLeft: '5px' }}>Versión: 04</td>
                        </tr>
                        <tr>
                            <td colSpan="2" style={{ paddingLeft: '5px' }}>Código:<br/>GD-F-003</td>
                        </tr>
                        
                        <tr>
                            <td colSpan="6" className="pdf-center pdf-bold" style={{ fontSize: '11px', padding: '4px' }}>
                                PROCESO GESTIÓN DOCUMENTAL
                            </td>
                        </tr>
                        <tr>
                            <td colSpan="6" className="pdf-center pdf-bold" style={{ fontSize: '11px', padding: '4px' }}>
                                HOJA DE CONTROL
                            </td>
                        </tr>

                        {/* METADATOS EXPEDIENTE */}
                        <tr style={{ height: '22px' }}>
                            <td className="pdf-bold">SEDE</td>
                            <td>{formSede}</td>
                            <td colSpan="2" className="pdf-center pdf-bold">CÓDIGO</td>
                            <td colSpan="2" className="pdf-center">{formCodSede}</td>
                        </tr>
                        <tr style={{ height: '22px' }}>
                            <td className="pdf-bold">UNIDAD ADMINISTRATIVA</td>
                            <td>{formUnidad}</td>
                            <td colSpan="2" className="pdf-center pdf-bold">CÓDIGO</td>
                            <td colSpan="2" className="pdf-center">{formCodUnidad}</td>
                        </tr>
                        <tr style={{ height: '22px' }}>
                            <td className="pdf-bold">OFICINA PRODUCTORA</td>
                            <td>{formOficina}</td>
                            <td colSpan="2" className="pdf-center pdf-bold">CÓDIGO</td>
                            <td colSpan="2" className="pdf-center">{formCodOficina}</td>
                        </tr>
                        <tr style={{ height: '22px' }}>
                            <td className="pdf-bold">SERIE DOCUMENTAL</td>
                            <td>{selectedExp?.series_name || ''}</td>
                            <td colSpan="2" className="pdf-center pdf-bold">CÓDIGO</td>
                            <td colSpan="2" className="pdf-center">{selectedExp?.series_code || ''}</td>
                        </tr>
                        <tr style={{ height: '22px' }}>
                            <td className="pdf-bold">SUBSERIE</td>
                            <td>{selectedExp?.subseries_name || ''}</td>
                            <td colSpan="2" className="pdf-center pdf-bold">CÓDIGO</td>
                            <td colSpan="2" className="pdf-center">{selectedExp?.subseries_code || ''}</td>
                        </tr>
                        <tr style={{ height: '35px' }}>
                            <td className="pdf-bold">IDENTIFICACIÓN DEL<br/>EXPEDIENTE</td>
                            <td colSpan="5" style={{ verticalAlign: 'middle' }}><span className="pdf-bold">{`${selectedExp?.title || ''} - ${Object.values(selectedExp?.metadata_values || {}).filter(v=>v).join(', ')}`}</span></td>
                        </tr>

                        {/* ENCABEZADO DE TABLA GRILLA */}
                        <tr className="pdf-center pdf-bold">
                            <td rowSpan="2">FECHA DE<br/>INGRESO<br/>AAAA/MM/DD</td>
                            <td rowSpan="2">IDENTIFICACIÓN DEL TIPO DOCUMENTAL</td>
                            <td colSpan="2">SOPORTE</td>
                            <td rowSpan="2">No. DE<br/>FOLIOS<br/>DEL - AL</td>
                            <td rowSpan="2">OBSERVACIONES</td>
                        </tr>
                        <tr className="pdf-center pdf-bold">
                            <td>FÍSICO</td>
                            <td>ELECTRÓNICO</td>
                        </tr>

                        {Array.from({ length: Math.max(15, documentos.length) }).map((_, i) => {
                            const doc = documentos[i];
                            if (doc) {
                                // Format date consistently
                                const fechaRaw = doc.fecha;
                                let fechaFormateada = "";
                                if(fechaRaw) {
                                    const parts = fechaRaw.split('-');
                                    if(parts.length===3) fechaFormateada = `${parts[0]}/${parts[1]}/${parts[2]}`;
                                }
                                
                                return (
                                    <tr key={doc.id || i}>
                                        <td className="pdf-center" style={{ height: '20px' }}>{fechaFormateada}</td>
                                        <td>{doc.tipo}</td>
                                        <td className="pdf-center">{doc.soporte === 'FISICO' ? 'X' : ''}</td>
                                        <td className="pdf-center">{doc.soporte === 'ELECTRONICO' ? 'X' : ''}</td>
                                        <td className="pdf-center">{doc.folios}</td>
                                        <td>{doc.obs}</td>
                                    </tr>
                                );
                            } else {
                                // Empty row to fill the template to minimum 15 rows
                                return (
                                    <tr key={`empty-${i}`}>
                                        <td style={{ height: '20px' }}></td><td></td><td></td><td></td><td></td><td></td>
                                    </tr>
                                );
                            }
                        })}
                        
                        <tr>
                            <td colSpan="5" className="pdf-bold" style={{ paddingTop: '5px', paddingBottom: '20px', verticalAlign: 'top', borderRight: 'none' }}>
                                <span style={{ fontSize: '9px' }}>NOMBRES Y APELLIDOS DEL RESPONSABLE DE ARCHIVAR LA INFORMACIÓN:</span> <br/>
                                <span style={{ fontWeight: 'normal', marginTop: '10px', display: 'inline-block', fontSize: '11px' }}>{responsable}</span>
                            </td>
                            <td colSpan="1" className="pdf-center" style={{ verticalAlign: 'bottom', paddingBottom: '10px', borderLeft: 'none' }}>
                                PÁGINA 1 DE _
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
        </div>
    );
}

export default HojaControl;
