import { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { Save, Download, Trash, FileText, Database, FileSpreadsheet, Search, RefreshCw, X } from 'lucide-react';

function ExpedienteCreation() {
    const [activeTab, setActiveTab] = useState('creacion');
    
    // Visualizador State
    const [savedExpedientes, setSavedExpedientes] = useState([]);
    const [savedLoading, setSavedLoading] = useState(false);
    const [savedSearchTerm, setSavedSearchTerm] = useState('');
    const [editExpModal, setEditExpModal] = useState(null);

    const fetchSavedExpedientes = async () => {
        setSavedLoading(true);
        try {
            const res = await axios.get('/api/expedientes/search', { params: { term: savedSearchTerm } });
            setSavedExpedientes(res.data.data || []);
        } catch (err) {
            console.error("Error fetching saved expedientes:", err);
        } finally {
            setSavedLoading(false);
        }
    };

    const handleDeleteSaved = async (id) => {
        if (!window.confirm('¿Está seguro de que desea eliminar este expediente de la base de datos? Esta acción no se puede deshacer.')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`/api/expedientes/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            alert('✅ Expediente eliminado correctamente.');
            fetchSavedExpedientes();
        } catch (err) {
            alert('❌ Error al eliminar: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleUpdateExpediente = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`/api/expedientes/${editExpModal.id}`, editExpModal, { headers: { Authorization: `Bearer ${token}` } });
            alert('✅ Expediente actualizado correctamente.');
            setEditExpModal(null);
            fetchSavedExpedientes();
        } catch (err) {
            alert('❌ Error al actualizar: ' + (err.response?.data?.error || err.message));
        }
    };

    useEffect(() => {
        if (activeTab === 'visualizador') {
            fetchSavedExpedientes();
        }
    }, [activeTab]);

    const [expedientes, setExpedientes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    
    // Form State
    const [formData, setFormData] = useState({
        expediente_code: '',
        box_id: '',
        opening_date: '',
        subserie: '',
        regional: '',
        centro: '',
        dependencia: '',
        storage_type: '',
        title: '',
        valor1: '', valor2: '', valor3: '', valor4: '',
        valor5: '', valor6: '', valor7: '', valor8: ''
    });

    const [allSubseries, setAllSubseries] = useState([]);
    const [currentLabels, setCurrentLabels] = useState({});
    const [typologies, setTypologies] = useState([]);
    const [loadingTypologies, setLoadingTypologies] = useState(false);

    const fetchTypologies = async (subserieCode) => {
        if (!subserieCode) { setTypologies([]); return; }
        setLoadingTypologies(true);
        try {
            const res = await axios.get('/api/trd/typologies-for-expediente', {
                params: { subserie: subserieCode }
            });
            setTypologies(res.data.data || []);
        } catch (err) {
            console.error('Error fetching typologies:', err);
            setTypologies([]);
        } finally {
            setLoadingTypologies(false);
        }
    };

    const autoSaveLabels = async (subseriesCode, labels) => {
        try {
            // Find ID for the code
            const resSub = await axios.get(`/api/trd/subseries/all`);
            const sub = (resSub.data.data || []).find(s => s.subseries_code === subseriesCode);
            if (!sub) return;

            await axios.post('/api/trd/metadata-labels', {
                type: sub.type || 'subseries',
                id: sub.id,
                labels: labels
            });
        } catch (err) {
            console.error("Error auto-saving labels:", err);
        }
    };

    useEffect(() => {
        const fetchSubseriesList = async () => {
            try {
                const res = await axios.get('/api/trd/subseries/all');
                setAllSubseries(res.data.data || []);
            } catch (err) {
                console.error("Error fetching subseries list:", err);
            }
        };
        fetchSubseriesList();
    }, []);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData({ ...formData, [id]: value });

        // If subserie changes, update labels, organizational fields, and typologies
        if (id === 'subserie') {
            const selected = allSubseries.find(s =>
                s.subseries_code === value ||
                s.series_code === value ||
                s.concatenated_code === value
            );
            if (selected) {
                setCurrentLabels(selected.metadata_labels || {});
                setFormData(prev => ({
                    ...prev,
                    subserie: value,
                    regional: selected.regional_code || prev.regional,
                    centro: selected.center_code || prev.centro,
                    dependencia: selected.section_code || prev.dependencia
                }));
                // Fetch typologies for this series/subserie
                fetchTypologies(value);
            } else {
                setCurrentLabels({});
                setTypologies([]);
            }
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Combine values into metadata object
        const metadata = {
            valor1: formData.valor1, valor2: formData.valor2,
            valor3: formData.valor3, valor4: formData.valor4,
            valor5: formData.valor5, valor6: formData.valor6,
            valor7: formData.valor7, valor8: formData.valor8
        };

        const newExpediente = {
            ...formData,
            metadata_values: metadata,
            id: Date.now() // Temp ID for frontend list
        };

        setExpedientes([...expedientes, newExpediente]);
        
        // Reset form but keep some consistent fields if needed? No, reset all for now.
        setFormData({
            ...formData,
            expediente_code: '',
            title: '',
            valor1: '', valor2: '', valor3: '', valor4: '',
            valor5: '', valor6: '', valor7: '', valor8: ''
        });
    };

    const handleDelete = (index) => {
        const newExpedientes = [...expedientes];
        newExpedientes.splice(index, 1);
        setExpedientes(newExpedientes);
    };

    const handleSelectRow = (exp) => {
        setFormData({
            expediente_code: exp.expediente_code || '',
            box_id: exp.box_id || '',
            opening_date: exp.opening_date || '',
            subserie: exp.subserie || '',
            storage_type: exp.storage_type || '',
            title: exp.title || '',
            valor1: exp.metadata_values?.valor1 || '',
            valor2: exp.metadata_values?.valor2 || '',
            valor3: exp.metadata_values?.valor3 || '',
            valor4: exp.metadata_values?.valor4 || '',
            valor5: exp.metadata_values?.valor5 || '',
            valor6: exp.metadata_values?.valor6 || '',
            valor7: exp.metadata_values?.valor7 || '',
            valor8: exp.metadata_values?.valor8 || '',
        });
        
        // Update labels if subserie is present
        if (exp.subserie) {
            const selected = allSubseries.find(s => s.subseries_code === exp.subserie);
            if (selected && selected.metadata_labels) {
                setCurrentLabels(selected.metadata_labels);
            }
        }

        // Scroll to form for better UX
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleClearTable = () => {
        if (confirm("¿Estás seguro de que deseas eliminar todos los registros ingresados?")) {
            setExpedientes([]);
        }
    };

    const saveToBackend = async () => {
        if (expedientes.length === 0) return alert("No hay datos para guardar.");
        
        setLoading(true);
        setStatus('Guardando...');

        try {
            await axios.post('/api/expedientes/mass', expedientes);
            setStatus('¡Guardado exitoso en base de datos!');
            setExpedientes([]); // Clear after save? Or keep? Let's clear for now.
        } catch (err) {
            console.error(err);
            setStatus('Error al guardar: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const exportToCSV = () => {
        if (expedientes.length === 0) {
            alert("No hay datos para exportar. Ingresa al menos un expediente.");
            return;
        }

        const dataToExport = expedientes.map(exp => {
            const row = {
                "Codigo Expediente": exp.expediente_code,
                "Id Caja": exp.box_id,
                "Fecha Apertura": exp.opening_date,
                "Subserie": exp.subserie,
                "Tipo Almacenamiento": exp.storage_type,
                "Titulo": exp.title,
            };
            // Use dynamic labels for metadata columns
            for (let i = 1; i <= 8; i++) {
                const label = currentLabels[`meta_${i}`] || `Valor${i}`;
                row[label] = exp.metadata_values[`valor${i}`] || '';
            }
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Expedientes");
        XLSX.writeFile(wb, "Nuevos_Expedientes_AES.xlsx");
    };

    const handleDownloadTemplate = async () => {
        try {
            const response = await axios.get('/api/expedientes/template', {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'Plantilla_Creacion_Expedientes.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("Error downloading template:", err);
            alert("Error al descargar la plantilla.");
        }
    };


    // Normalization helper
    const normalize = (str) => {
        if (!str) return '';
        return str.toString()
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
            .replace(/[\s\-_]/g, '') // Remove spaces, dashes, underscores
            .trim();
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        console.log("Iniciando carga de archivo:", file.name);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = evt.target.result;
                const wb = XLSX.read(data, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const jsonData = XLSX.utils.sheet_to_json(ws);

                console.log("Datos leídos del Excel:", jsonData);

                if (jsonData.length === 0) {
                    alert("El archivo está vacío o no tiene datos legibles.");
                    return;
                }

                // Get ALL headers from the first row of the sheet (more robust)
                const range = XLSX.utils.decode_range(ws['!ref']);
                const firstRow = [];
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
                    if (cell && cell.v) firstRow.push(String(cell.v));
                }

                const allHeaders = firstRow.length > 0 ? firstRow : Object.keys(jsonData[0]);
                console.log("Cabeceras reales detectadas:", allHeaders);
                
                const normalizedHeaders = allHeaders.map(h => ({ original: h, normalized: normalize(h) }));

                // --- MAPPING LOGIC ---
                const findHeader = (synonyms) => {
                    const found = normalizedHeaders.find(h => synonyms.some(s => h.normalized === normalize(s)));
                    return found ? found.original : null;
                };

                const colMap = {
                    expediente_code: findHeader(['Codigo Expediente', 'Cod Exp', 'Nro Expediente', 'Expediente']),
                    box_id: findHeader(['Id Caja', 'Caja', 'Caja No']),
                    opening_date: findHeader(['Fecha Apertura', 'Fecha Inicio', 'Apertura', 'Fecha']),
                    subserie: findHeader(['Subserie', 'Cod Subserie', 'Codigo Subserie']),
                    storage_type: findHeader(['Tipo Almacenamiento', 'Tipo Almacen', 'Soporte']),
                    title: findHeader(['Titulo', 'Nombre Expediente', 'Asunto', 'Descripcion']),
                };

                // Detect metadata headers (Valor 1 - 8)
                const metadataCols = Array(8).fill(null);
                for (let i = 1; i <= 8; i++) {
                    const h = findHeader([`Valor ${i}`, `Valor${i}`, `Metadato ${i}`, `Metadato${i}`, `Meta ${i}`, `Meta${i}`]);
                    if (h) metadataCols[i - 1] = h;
                }

                // If some slots are still empty, use headers that are NOT standard
                const standardOriginals = Object.values(colMap).filter(Boolean);
                const metadataOriginals = metadataCols.filter(Boolean);
                const unmappedHeaders = allHeaders.filter(h => !standardOriginals.includes(h) && !metadataOriginals.includes(h));

                unmappedHeaders.forEach(h => {
                    for (let i = 0; i < 8; i++) {
                        if (!metadataCols[i]) {
                            metadataCols[i] = h;
                            break;
                        }
                    }
                });

                const parseDate = (val) => {
                    if (!val) return '';
                    if (typeof val === 'number') {
                        // Excel serial date to YYYY-MM-DD
                        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
                        return date.toISOString().split('T')[0];
                    }
                    return String(val).trim();
                };

                const newExpedientes = jsonData.map((row, index) => {
                    const metadata = {};
                    for (let i = 1; i <= 8; i++) {
                        const colName = metadataCols[i - 1];
                        let val = '';
                        if (colName && row[colName] !== undefined) {
                            val = String(row[colName]);
                        } else {
                            // Try explicit fallback if column map missed it
                            const altH = findHeader([`valor${i}`, `valor ${i}`, `valor_${i}`]);
                            if (altH && row[altH] !== undefined) val = String(row[altH]);
                        }
                        metadata[`valor${i}`] = val.trim();
                    }

                    return {
                        id: Date.now() + index + Math.random(),
                        expediente_code: colMap.expediente_code ? String(row[colMap.expediente_code] || '').trim() : '',
                        box_id: colMap.box_id ? String(row[colMap.box_id] || '').trim() : '',
                        opening_date: parseDate(colMap.opening_date ? row[colMap.opening_date] : ''),
                        subserie: colMap.subserie ? String(row[colMap.subserie] || '').trim() : '',
                        storage_type: colMap.storage_type ? String(row[colMap.storage_type] || '').trim() : 'Fisico',
                        title: colMap.title ? String(row[colMap.title] || '').trim() : 'Sin Título',
                        metadata_values: metadata
                    };
                });

                if (newExpedientes.length > 0) {
                    setExpedientes(prev => [...prev, ...newExpedientes]);

                    const labelsMap = {};
                    metadataCols.forEach((h, i) => {
                        if (h && i < 8) labelsMap[`meta_${i + 1}`] = h;
                    });
                    
                    if (Object.keys(labelsMap).length > 0) {
                        setCurrentLabels(labelsMap);
                        const uniqueSubseries = [...new Set(newExpedientes.map(e => e.subserie).filter(Boolean))];
                        for (const subserieCod of uniqueSubseries) {
                            await autoSaveLabels(subserieCod, labelsMap);
                        }
                        const res = await axios.get('/api/trd/subseries/all');
                        setAllSubseries(res.data.data || []);
                    }

                    alert(`${newExpedientes.length} registros cargados exitosamente.`);
                } else {
                    alert("No se pudieron extraer registros válidos.");
                }

            } catch (err) {
                console.error("Error leyendo el archivo:", err);
                alert("Error crítico al leer el archivo Excel.");
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = null;
    };

    const handleFileUpdateMassive = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        console.log("Iniciando carga de archivo para actualización masiva:", file.name);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = evt.target.result;
                const wb = XLSX.read(data, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const jsonData = XLSX.utils.sheet_to_json(ws);

                if (jsonData.length === 0) {
                    alert("El archivo está vacío o no tiene datos legibles.");
                    return;
                }

                if (!confirm(`Se intentarán actualizar ${jsonData.length} expedientes. Asegúrese de que el Título y Código Expediente estén correctos. ¿Continuar?`)) {
                    e.target.value = null;
                    return;
                }

                setLoading(true);
                setStatus('Actualizando códigos masivamente...');

                try {
                    const token = localStorage.getItem('token');
                    const res = await axios.post('/api/expedientes/mass-update', jsonData, { 
                        headers: { Authorization: `Bearer ${token}` } 
                    });
                    
                    const msg = `✅ Proceso finalizado. ${res.data.updated} actualizados, ${res.data.errors?.length || 0} errores.`;
                    setStatus(msg);
                    alert(msg);
                    
                    if (res.data.errors?.length > 0) {
                        console.warn("Errores en actualización masiva:", res.data.errors);
                        alert("Hubo errores en algunos registros. Revise la consola (F12) para más detalles.");
                    }

                    if (activeTab === 'visualizador') {
                        fetchSavedExpedientes();
                    }
                } catch (updateErr) {
                    console.error("Error en actualización masiva:", updateErr);
                    setStatus('Error al actualizar masivamente.');
                    alert("Ocurrió un error al enviar los datos al servidor.");
                } finally {
                    setLoading(false);
                }

            } catch (err) {
                console.error("Error leyendo el archivo:", err);
                alert("Error crítico al leer el archivo Excel para actualización.");
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = null;
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            
            {/* Encabezado */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-green-800">Módulo de Creación Masiva de Expedientes</h1>
                    <p className="text-sm text-gray-500">Gestión y registro de expedientes en el sistema</p>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                    <label className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg font-medium shadow transition-colors flex items-center gap-2 cursor-pointer text-sm">
                        <Database size={16} />
                        <span>Cargar Nuevos</span>
                        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                    </label>
                    <label className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-lg font-medium shadow transition-colors flex items-center gap-2 cursor-pointer text-sm" title="Usa el Excel para ponerles Código a expedientes que ya existen en el sistema.">
                        <RefreshCw size={16} />
                        <span>Actualizar Códigos</span>
                        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpdateMassive} className="hidden" />
                    </label>
                    <button onClick={handleDownloadTemplate} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium shadow transition-colors flex items-center gap-2 text-sm">
                        <FileSpreadsheet size={16} />
                        <span>Plantilla</span>
                    </button>
                    <button onClick={exportToCSV} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg font-medium shadow transition-colors flex items-center gap-2 text-sm">
                        <Download size={16} />
                        <span>Exportar Actual</span>
                    </button>
                    <button onClick={saveToBackend} disabled={loading || expedientes.length === 0} className="bg-green-800 hover:bg-green-900 text-white px-3 py-2 rounded-lg font-medium shadow transition-colors flex items-center gap-2 text-sm">
                        <Save size={16} />
                        <span>{loading ? 'Guardando...' : 'Guardar BD'}</span>
                    </button>
                </div>
            </div>

            {/* PESTAÑAS DE NAVEGACIÓN */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('creacion')}
                    className={`py-2 px-4 font-semibold text-sm transition-colors border-b-2 ${
                        activeTab === 'creacion' 
                        ? 'border-green-600 text-green-700' 
                        : 'border-transparent text-gray-500 hover:text-green-600'
                    }`}
                >
                    Creación de Expedientes
                </button>
                <button
                    onClick={() => setActiveTab('visualizador')}
                    className={`py-2 px-4 font-semibold text-sm transition-colors border-b-2 ${
                        activeTab === 'visualizador' 
                        ? 'border-green-600 text-green-700' 
                        : 'border-transparent text-gray-500 hover:text-green-600'
                    }`}
                >
                    Expedientes Creados
                </button>
            </div>

            {status && (
                <div className={`p-4 rounded-lg ${status.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {status}
                </div>
            )}

            {activeTab === 'creacion' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* FORMULARIO DE INGRESO */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
                    <h2 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">Nuevo Expediente</h2>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Datos Principales */}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Código Expediente (Opcional)</label>
                            <input type="text" id="expediente_code" value={formData.expediente_code} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" placeholder="Ej: EXP-2026-001" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Id Caja</label>
                                <input type="text" id="box_id" value={formData.box_id} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" placeholder="Opcional: ID Caja" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Apertura</label>
                                <input type="date" id="opening_date" value={formData.opening_date} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                            </div>
                        </div>

                        {/* Hidden organizational fields (linking data) */}
                        <div className="hidden">
                            <input type="text" id="regional" value={formData.regional} onChange={handleChange} />
                            <input type="text" id="centro" value={formData.centro} onChange={handleChange} />
                            <input type="text" id="dependencia" value={formData.dependencia} onChange={handleChange} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Código (Serie / Subserie)</label>
                                <select
                                    id="subserie"
                                    value={formData.subserie}
                                    onChange={handleChange}
                                    className="w-full border-2 border-green-500 rounded-md p-2 text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white"
                                >
                                    <option value="">{allSubseries.length > 0 ? '-- Seleccione un código TRD --' : 'Cargando...'}</option>
                                    {allSubseries.map(s => {
                                        const code = s.concatenated_code || s.subseries_code || s.series_code || '';
                                        const name = s.subseries_name || s.series_name || '';
                                        const label = `${code} - ${name}`;
                                        return (
                                            <option key={`${s.type}-${s.id}`} value={code}>
                                                {label}
                                            </option>
                                        );
                                    })}
                                </select>
                                {/* Tipologías disponibles */}
                                {loadingTypologies && <p className="text-xs text-gray-400 mt-1">Cargando tipologías...</p>}
                                {!loadingTypologies && typologies.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-xs font-semibold text-green-700 mb-1">Tipologías disponibles:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {typologies.map(t => (
                                                <span key={t.id} className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full border border-green-300">
                                                    {t.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {!loadingTypologies && formData.subserie && typologies.length === 0 && (
                                    <p className="text-xs text-orange-500 mt-1">⚠ Sin tipologías registradas para este código.</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo Almacenamiento</label>
                                <input type="text" id="storage_type" value={formData.storage_type} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" placeholder="Ej: Físico" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Título del Expediente</label>
                            <input type="text" id="title" value={formData.title} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" placeholder="Nombre descriptivo del expediente" />
                        </div>

                        {/* Valores Adicionales (Acordeón Simple) */}
                        <div className="pt-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                Campos Personalizados {formData.subserie ? `(${formData.subserie})` : ''}
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {[1,2,3,4,5,6,7,8].map(i => (
                                    <div key={i}>
                                        <label className="block text-[10px] font-bold text-gray-500 mb-1">
                                            {currentLabels[`meta_${i}`] || `Valor ${i}`}
                                        </label>
                                        <input 
                                            type="text" 
                                            id={`valor${i}`} 
                                            value={formData[`valor${i}`]} 
                                            onChange={handleChange} 
                                            className="w-full border border-gray-300 rounded-md p-2 text-xs focus:ring-1 focus:ring-green-400 outline-none" 
                                            placeholder={currentLabels[`meta_${i}`] || `Valor ${i}`} 
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4">
                            <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-md font-medium transition-colors flex items-center justify-center gap-2">
                                <FileText size={16} /> Agregar a la Tabla
                            </button>
                        </div>
                    </form>
                </div>

                {/* VISTA DE TABLA */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <h2 className="text-lg font-semibold text-gray-700">Registros Actuales ({expedientes.length})</h2>
                        <button onClick={handleClearTable} className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 border border-red-200 rounded hover:bg-red-50 transition-colors">
                            Vaciar Tabla
                        </button>
                    </div>
                    
                    <div className="overflow-x-auto overflow-y-auto flex-grow table-container">
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead className="sticky top-0 bg-gray-100 z-10 shadow-sm">
                                <tr className="text-gray-600 text-xs uppercase tracking-wider">
                                    <th className="p-3 border-b">Cód. Exp.</th>
                                    <th className="p-3 border-b">Id Caja</th>
                                    <th className="p-3 border-b">Apertura</th>
                                    <th className="p-3 border-b">Código</th>
                                    <th className="p-3 border-b">Tipo</th>
                                    <th className="p-3 border-b">Título</th>
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                        <th key={i} className="p-3 border-b">{currentLabels[`meta_${i}`] || `Valor ${i}`}</th>
                                    ))}
                                    <th className="p-3 border-b text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-gray-200">
                                {expedientes.length === 0 ? (
                                    <tr>
                                        <td colSpan="15" className="p-8 text-center text-gray-400">
                                            No hay registros. Llena el formulario para agregar expedientes.
                                        </td>
                                    </tr>
                                ) : (
                                    expedientes.map((exp, index) => {
                                        return (
                                            <tr key={index} className="hover:bg-green-50 transition-colors">
                                                <td className="p-3 font-medium text-gray-700">{exp.expediente_code || '-'}</td>
                                                <td className="p-3">{exp.box_id}</td>
                                                <td className="p-3">{exp.opening_date}</td>
                                                <td className="p-3 text-gray-600">{exp.subserie}</td>
                                                <td className="p-3"><span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">{exp.storage_type}</span></td>
                                                <td className="p-3 font-medium text-green-900 max-w-xs truncate" title={exp.title}>{exp.title}</td>
                                                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                                    <td key={i} className="p-3 text-xs text-gray-500">
                                                        {exp.metadata_values[`valor${i}`] || '-'}
                                                    </td>
                                                ))}
                                                <td className="p-3 text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <button 
                                                            onClick={() => handleSelectRow(exp)} 
                                                            className="text-blue-500 hover:text-blue-700 bg-blue-100 hover:bg-blue-200 w-8 h-8 rounded-full inline-flex items-center justify-center transition-colors"
                                                            title="Seleccionar para editar"
                                                        >
                                                            <FileText size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(index)} 
                                                            className="text-red-500 hover:text-red-700 bg-red-100 hover:bg-red-200 w-8 h-8 rounded-full inline-flex items-center justify-center transition-colors"
                                                            title="Eliminar de la lista"
                                                        >
                                                            <Trash size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
            )} {/* FIN TAB CREACION */}

            {/* VISTA DEL VISUALIZADOR */}
            {activeTab === 'visualizador' && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 w-full mb-6 relative">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div className="relative w-full md:w-1/2">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Buscar por código, título, caja o subserie..."
                                value={savedSearchTerm}
                                onChange={e => setSavedSearchTerm(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && fetchSavedExpedientes()}
                                className="w-full pl-10 pr-4 py-3 border-2 border-green-500 rounded-lg focus:ring-2 focus:ring-green-200 outline-none text-sm font-medium transition-all"
                            />
                        </div>
                        <button
                            onClick={fetchSavedExpedientes}
                            disabled={savedLoading}
                            className="bg-green-700 hover:bg-green-800 text-white px-6 py-3 rounded-lg font-bold shadow-md transition-all flex items-center gap-2 whitespace-nowrap min-w-max"
                        >
                            <RefreshCw size={18} className={savedLoading ? 'animate-spin' : ''} /> 
                            {savedLoading ? 'Buscando...' : 'Buscar / Actualizar'}
                        </button>
                    </div>
                    
                    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-inner">
                        <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
                            <thead className="bg-green-50 border-b-2 border-green-200">
                                <tr className="text-green-800 font-semibold uppercase text-xs tracking-wider">
                                    <th className="p-4 border-b">Código</th>
                                    <th className="p-4 border-b">Título</th>
                                    <th className="p-4 border-b">Caja</th>
                                    <th className="p-4 border-b">Subserie</th>
                                    <th className="p-4 border-b">Fecha Apertura</th>
                                    <th className="p-4 border-b text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {savedLoading ? (
                                    <tr>
                                        <td colSpan="6" className="p-10 text-center text-gray-500 font-medium">Buscando en la base de datos...</td>
                                    </tr>
                                ) : savedExpedientes.length > 0 ? (
                                    savedExpedientes.map((exp) => (
                                        <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-bold text-green-900">{exp.expediente_code}</td>
                                            <td className="p-4 text-gray-700">{exp.title || <span className="text-gray-400 italic">Sin título</span>}</td>
                                            <td className="p-4 text-gray-600">{exp.box_id || '-'}</td>
                                            <td className="p-4 text-gray-600">{exp.subserie}</td>
                                            <td className="p-4 text-gray-600">{exp.opening_date ? exp.opening_date.slice(0, 10) : '-'}</td>
                                            <td className="p-4">
                                                <div className="flex gap-2 justify-center">
                                                    <button 
                                                        onClick={() => setEditExpModal(exp)} 
                                                        className="text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded flex items-center gap-1 text-xs font-semibold transition-colors"
                                                    >
                                                        ✏️ Editar
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteSaved(exp.id)} 
                                                        className="text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded flex items-center gap-1 text-xs font-semibold transition-colors"
                                                    >
                                                        <Trash size={14} /> Eliminar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="p-16 text-center text-gray-400">
                                            <Database size={48} className="mx-auto mb-4 opacity-20" />
                                            <p className="text-base font-medium">No se encontraron expedientes en el sistema</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )} {/* FIN TAB VISUALIZADOR */}

            {/* MODAL EDITAR EXPEDIENTE */}
            {editExpModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
                            <h3 className="font-bold text-lg flex items-center gap-2">✏️ Editar Expediente</h3>
                            <button onClick={() => setEditExpModal(null)} className="text-white hover:text-gray-200 transition-colors"><X size={24} /></button>
                        </div>
                        
                        <div className="p-6 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">CÓDIGO EXPEDIENTE</label>
                                <input 
                                    type="text" 
                                    value={editExpModal.expediente_code || ''} 
                                    onChange={e => setEditExpModal({...editExpModal, expediente_code: e.target.value})} 
                                    className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 outline-none" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">TÍTULO</label>
                                <input 
                                    type="text" 
                                    value={editExpModal.title || ''} 
                                    onChange={e => setEditExpModal({...editExpModal, title: e.target.value})} 
                                    className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 outline-none" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">SUBSERIE</label>
                                <input 
                                    type="text" 
                                    value={editExpModal.subserie || ''} 
                                    onChange={e => setEditExpModal({...editExpModal, subserie: e.target.value})} 
                                    className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 outline-none" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">ID CAJA</label>
                                <input 
                                    type="text" 
                                    value={editExpModal.box_id || ''} 
                                    onChange={e => setEditExpModal({...editExpModal, box_id: e.target.value})} 
                                    className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 outline-none" 
                                />
                            </div>
                        </div>
                        
                        <div className="p-4 bg-gray-50 border-t flex justify-end">
                            <button 
                                onClick={handleUpdateExpediente} 
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-6 rounded-lg shadow transition-colors flex items-center gap-2"
                            >
                                <Save size={18} /> Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ExpedienteCreation;
