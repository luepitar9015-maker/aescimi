import React, { useState, useEffect } from 'react';
import { Plus, Trash, Database, ChevronRight, Layout, Map, Building } from 'lucide-react';
import axios from 'axios';

function CreationModule() {
    const [structure, setStructure] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [form, setForm] = useState({
        entity_name: 'SENA',
        regional_code: '', regional_name: '',
        center_code: '', center_name: '',
        section_code: '', section_name: '',
        subsection_code: '', subsection_name: '',
        storage_path: '', // New field for OneDrive path
        isComplex: false // Default to Simple
    });

    // --- TRD State ---
    const [selectedNode, setSelectedNode] = useState(null);
    const [trdData, setTrdData] = useState([]);
    const [trdForm, setTrdForm] = useState({
        series_code: '', series_name: '',
        isComplex: false,
        subseries_code: '', subseries_name: '',
        typology_name: ''
    });

    const API_URL = '/api';

    useEffect(() => {
        fetchStructure();
    }, []);

    const fetchStructure = async () => {
        try {
            const res = await axios.get(`${API_URL}/organization`);
            setStructure(res.data.data || []);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching organization structure:", err);
            setError(err.response?.data?.error || err.message);
            setLoading(false);
        }
    };

    const fetchTRD = async (nodeId) => {
        if (!nodeId) return;
        try {
            const res = await axios.get(`${API_URL}/trd/${nodeId}`);
            setTrdData(res.data);
        } catch (err) {
            console.error("Error fetching TRD:", err);
        }
    };

    // --- Storage Path Global State ---
    const [editStoragePath, setEditStoragePath] = useState('');
    const [editBackupPath, setEditBackupPath] = useState('');

    useEffect(() => {
        fetchGlobalSettings();
    }, []);

    const fetchGlobalSettings = async () => {
        try {
            const res = await axios.get(`${API_URL}/settings/storage_path`);
            setEditStoragePath(res.data.value || '');
            setForm(prev => ({ ...prev, storage_path: res.data.value || '' })); // Sync with creation form too
            
            const resBackup = await axios.get(`${API_URL}/settings/backup_path`);
            setEditBackupPath(resBackup.data.value || '');
        } catch (err) {
            console.error("Error fetching settings:", err);
        }
    };

    const handleUpdatePath = async () => {
        try {
            await axios.post(`${API_URL}/settings`, { key: 'storage_path', value: editStoragePath });
            await axios.post(`${API_URL}/settings`, { key: 'backup_path', value: editBackupPath });
            alert('Rutas globales actualizadas correctamente. Estas rutas se usarán para todo el sistema.');
            fetchGlobalSettings(); // Refresh
        } catch (err) {
            alert('Error updating path: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...form };
            if (!form.isComplex) {
                payload.subsection_code = '';
                payload.subsection_name = '';
            }

            await axios.post(`${API_URL}/organization`, payload);

            setForm({
                ...form,
                section_code: '', section_name: '',
                subsection_code: '', subsection_name: ''
            });

            fetchStructure();
            alert('Dependencia creada exitosamente.');
        } catch (err) {
            alert('Error creating record: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Está seguro de eliminar este registro?')) return;
        try {
            await axios.delete(`${API_URL}/organization/${id}`);
            fetchStructure();
            if (selectedNode && selectedNode.id === id) setSelectedNode(null);
        } catch (err) {
            alert('Error deleting record: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleClearAll = () => {
        setForm({
            entity_name: 'SENA',
            regional_code: '', regional_name: '',
            center_code: '', center_name: '',
            section_code: '', section_name: '',
            subsection_code: '', subsection_name: '',
            storage_path: '',
            isComplex: false
        });
    }

    const handleNodeClick = (node) => {
        if (node.type === 'section' || node.type === 'subsection') {
            setSelectedNode(node);
            fetchTRD(node.id);
            setTrdForm({
                series_code: '', series_name: '',
                isComplex: false,
                subseries_code: '', subseries_name: '',
                typology_name: ''
            });
        }
    };

    const handleCreateSeries = async (e) => {
        e.preventDefault();
        if (!selectedNode) return;
        try {
            await axios.post(`${API_URL}/trd/series`, {
                dependency_id: selectedNode.id,
                code: trdForm.series_code,
                name: trdForm.series_name
            });

            fetchTRD(selectedNode.id);
            setTrdForm({ ...trdForm, series_code: '', series_name: '' });
            alert('Serie creada. Ahora agregue ' + (trdForm.isComplex ? 'Subseries' : 'Tipologías'));
        } catch (err) {
            alert('Error creating series: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleCreateSubseries = async (series) => {
        const parentCode = series.code;
        const code = prompt(`Ingrese el código de la subserie para la serie "${parentCode}":\n(El sistema guardará: ${parentCode}.X)`);
        const name = prompt("Nombre de la Subserie:");
        if (code && name) {
            try {
                await axios.post(`${API_URL}/trd/subseries`, { series_id: series.id, code, name });
                fetchTRD(selectedNode.id);
            } catch (err) {
                alert('Error: ' + (err.response?.data?.error || err.message));
            }
        }
    };

    const handleCreateTypology = async (seriesId, subseriesId = null) => {
        const name = prompt("Nombre Tipología:");
        if (name) {
            try {
                await axios.post(`${API_URL}/trd/typology`, { series_id: seriesId, subseries_id: subseriesId, name });
                fetchTRD(selectedNode.id);
            } catch (err) { 
                alert('Error: ' + (err.response?.data?.error || err.message)); 
            }
        }
    };

    const handleEditSeries = async (series) => {
        const code = prompt('Nuevo código de serie:', series.code);
        const name = prompt('Nuevo nombre de serie:', series.name);
        if (!code || !name) return;
        try {
            await axios.put(`${API_URL}/trd/series/${series.id}`, { code, name });
            fetchTRD(selectedNode.id);
        } catch (err) { alert(err.response?.data?.error || err.message); }
    };

    const handleDeleteSeries = async (seriesId) => {
        if (!confirm('¿Eliminar esta serie y TODAS sus subseries y tipologías?')) return;
        try {
            await axios.delete(`${API_URL}/trd/series/${seriesId}`);
            fetchTRD(selectedNode.id);
        } catch (err) { alert(err.response?.data?.error || err.message); }
    };

    const handleEditSubseries = async (sub) => {
        const code = prompt('Nuevo código de subserie:', sub.code);
        const name = prompt('Nuevo nombre de subserie:', sub.name);
        if (!code || !name) return;
        try {
            await axios.put(`${API_URL}/trd/subseries/${sub.id}`, { code, name });
            fetchTRD(selectedNode.id);
        } catch (err) { alert(err.response?.data?.error || err.message); }
    };

    const handleDeleteSubseries = async (subId) => {
        if (!confirm('¿Eliminar esta subserie y sus tipologías?')) return;
        try {
            await axios.delete(`${API_URL}/trd/subseries/${subId}`);
            fetchTRD(selectedNode.id);
        } catch (err) { alert(err.response?.data?.error || err.message); }
    };

    const handleEditTypology = async (t) => {
        const name = prompt('Nuevo nombre de tipología:', t.name);
        if (!name) return;
        try {
            await axios.put(`${API_URL}/trd/typology/${t.id}`, { name });
            fetchTRD(selectedNode.id);
        } catch (err) { alert(err.response?.data?.error || err.message); }
    };

    const handleDeleteTypology = async (typId) => {
        if (!confirm('¿Eliminar esta tipología?')) return;
        try {
            await axios.delete(`${API_URL}/trd/typology/${typId}`);
            fetchTRD(selectedNode.id);
        } catch (err) { alert(err.response?.data?.error || err.message); }
    };


    // --- Tree Transformation Helper (Safe) ---
    const buildTree = (flatData) => {
        const tree = {};
        if (!Array.isArray(flatData)) return {};

        try {
            flatData.forEach(item => {
                const regKey = item.regional_code || 'UNK';
                if (!tree[regKey]) {
                    tree[regKey] = {
                        type: 'regional',
                        code: item.regional_code || '?',
                        name: item.regional_name || 'Desconocido',
                        children: {}
                    };
                }

                const cenKey = item.center_code || 'UNK';
                if (!tree[regKey].children[cenKey]) {
                    tree[regKey].children[cenKey] = {
                        type: 'center',
                        code: item.center_code || '?',
                        name: item.center_name || 'Desconocido',
                        children: {}
                    };
                }

                const secKey = item.section_code || 'UNK';
                if (!tree[regKey].children[cenKey].children[secKey]) {
                    tree[regKey].children[cenKey].children[secKey] = {
                        type: 'section',
                        code: item.section_code || '?',
                        name: item.section_name || 'Desconocido',
                        regional_code: item.regional_code || '68',
                        children: {}
                    };
                }

                if (item.subsection_code) {
                    const subKey = item.subsection_code;
                    tree[regKey].children[cenKey].children[secKey].children[subKey] = {
                        type: 'subsection',
                        code: item.subsection_code,
                        name: item.subsection_name,
                        regional_code: item.regional_code || '68',
                        id: item.id,
                        storage_path: item.storage_path // Include storage_path
                    };
                } else {
                    tree[regKey].children[cenKey].children[secKey].id = item.id;
                    tree[regKey].children[cenKey].children[secKey].storage_path = item.storage_path; // Include storage_path
                }
            });
        } catch (e) {
            console.error("Error building tree:", e);
        }

        return tree;
    };

    const organogramData = buildTree(structure);

    const TreeNode = ({ node, level }) => {
        if (!node) return null;
        const hasChildren = node.children && Object.keys(node.children).length > 0;

        let bgColor = '#fff';
        let borderColor = '#ccc';
        let titleColor = '#333';

        if (level === 'regional') { bgColor = '#e8f5e9'; borderColor = '#39A900'; titleColor = '#1b5e20'; }
        if (level === 'center') { bgColor = '#e3f2fd'; borderColor = '#00324D'; titleColor = '#0d47a1'; }
        if (level === 'section') { bgColor = '#fff3e0'; borderColor = '#FC7323'; titleColor = '#e65100'; }
        if (level === 'subsection') { bgColor = '#f3e5f5'; borderColor = '#9c27b0'; titleColor = '#4a148c'; }

        const isSelected = selectedNode && selectedNode.id === node.id && selectedNode.code === node.code;
        if (isSelected) {
            borderColor = '#2962ff';
            bgColor = '#e3f2fd';
        }

        return (
            <div className="tree-node" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                margin: '10px'
            }}>
                <div
                    onClick={() => node.id && handleNodeClick(node)}
                    style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: `2px solid ${borderColor}`,
                        background: bgColor,
                        minWidth: '150px',
                        textAlign: 'center',
                        position: 'relative',
                        boxShadow: isSelected ? '0 0 0 4px rgba(41, 98, 255, 0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
                        cursor: node.id ? 'pointer' : 'default',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <strong style={{ display: 'block', fontSize: '12px', color: titleColor }}>{node.code}</strong>
                    <span style={{ fontSize: '11px', fontWeight: '500' }}>{node.name}</span>
                    {node.id && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(node.id); }}
                            style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                background: '#ff5252',
                                color: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '20px',
                                height: '20px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            title="Eliminar Dependencia"
                        >
                            <Trash size={10} />
                        </button>
                    )}
                </div>

                {hasChildren && (
                    <div style={{ display: 'flex', marginTop: '20px', position: 'relative' }}>
                        <div style={{ display: 'flex', gap: '20px', borderTop: '2px solid #ccc', paddingTop: '20px' }}>
                            {Object.values(node.children).map((child) => (
                                <TreeNode key={child.code} node={child} level={child.type} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (error) {
        return <div style={{ color: 'red', padding: '20px' }}>Error: {error}</div>;
    }

    return (
        <div className="creation-module-container" style={{ padding: '20px', maxWidth: '100%', overflowX: 'auto' }}>
            <h2 style={{ marginBottom: '20px', borderBottom: '2px solid #00324D', paddingBottom: '10px' }}>
                Módulo de Creación de Estructura y TRD
            </h2>

            {/* --- STEP 1: GLOBAL STORAGE PATH (INDEPENDENT) --- */}
            <div style={{ background: '#FFF8E1', border: '2px solid #F57F17', borderRadius: '8px', padding: '20px', marginBottom: '30px' }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#F57F17', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={20} /> PASO 1 — Configuración de Ruta de Almacenamiento
                </h3>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#555' }}>
                    Configure primero la ruta base donde se guardarán todas las carpetas y expedientes del sistema. <strong>Solo se configura una vez.</strong>
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontWeight: 'bold', fontSize: '13px', display: 'block', marginBottom: '5px' }}>
                                Ruta Base (OneDrive / Servidor):
                            </label>
                            <input
                                type="text"
                                value={editStoragePath}
                                onChange={(e) => setEditStoragePath(e.target.value)}
                                className="form-control"
                                placeholder="C:\Users\Usuario\OneDrive - SENA\Gestión Documental"
                                style={{ width: '100%' }}
                            />
                            {editStoragePath && (
                                <small style={{ color: '#2e7d32', fontWeight: 'bold', display: 'block', marginTop: '4px' }}>✔ Ruta configurada: {editStoragePath}</small>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontWeight: 'bold', fontSize: '13px', display: 'block', marginBottom: '5px' }}>
                                Ruta de Copia de Seguridad (Backup en tiempo real):
                            </label>
                            <input
                                type="text"
                                value={editBackupPath}
                                onChange={(e) => setEditBackupPath(e.target.value)}
                                className="form-control"
                                placeholder="D:\Backup_SENA\Gestion_Documental"
                                style={{ width: '100%' }}
                            />
                            {editBackupPath && (
                                <small style={{ color: '#2e7d32', fontWeight: 'bold', display: 'block', marginTop: '4px' }}>✔ Backup configurado: {editBackupPath}</small>
                            )}
                        </div>
                        <button
                            onClick={handleUpdatePath}
                            style={{ background: '#F57F17', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', height: '38px', whiteSpace: 'nowrap' }}
                        >
                            Guardar Rutas
                        </button>
                    </div>
                </div>
            </div>

            <div className="workspace" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

                {/* --- STRUCTURE FORMS --- */}
                <div className="input-area" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                    <form onSubmit={handleCreate}>
                        {/* 1. SUBMODULO REGIONAL */}
                        <div className="submodule" style={{ marginBottom: '20px', background: '#F4F6F8', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #39A900' }}>
                            <h4 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center' }}><Map size={18} style={{ marginRight: '8px' }} /> Submódulo Regional</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#444' }}>Código</label>
                                    <input type="text" value={form.regional_code} onChange={e => setForm({ ...form, regional_code: e.target.value })} placeholder="11" required
                                        style={{ padding: '8px 10px', border: '1.5px solid #bbb', borderRadius: '5px', fontSize: '14px', outline: 'none', background: '#fff' }} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#444' }}>Nombre</label>
                                    <input type="text" value={form.regional_name} onChange={e => setForm({ ...form, regional_name: e.target.value })} required
                                        style={{ padding: '8px 10px', border: '1.5px solid #bbb', borderRadius: '5px', fontSize: '14px', outline: 'none', background: '#fff' }} />
                                </div>
                            </div>
                        </div>

                        {/* 2. SUBMODULO CENTRO */}
                        <div className="submodule" style={{ marginBottom: '20px', background: '#F4F6F8', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #00324D' }}>
                            <h4 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center' }}><Building size={18} style={{ marginRight: '8px' }} /> Submódulo Centro</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#444' }}>Código</label>
                                    <input type="text" value={form.center_code} onChange={e => setForm({ ...form, center_code: e.target.value })} placeholder="9205" required
                                        style={{ padding: '8px 10px', border: '1.5px solid #bbb', borderRadius: '5px', fontSize: '14px', outline: 'none', background: '#fff' }} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#444' }}>Nombre</label>
                                    <input type="text" value={form.center_name} onChange={e => setForm({ ...form, center_name: e.target.value })} required
                                        style={{ padding: '8px 10px', border: '1.5px solid #bbb', borderRadius: '5px', fontSize: '14px', outline: 'none', background: '#fff' }} />
                                </div>
                            </div>
                        </div>

                        {/* 3. MODULO DEPENDENCIAS */}
                        <div className="submodule" style={{ marginBottom: '20px', background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <h4 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', color: '#FC7323' }}><Database size={18} style={{ marginRight: '8px' }} /> Módulo de Dependencias</h4>

                            <div style={{ marginBottom: '15px', padding: '10px', background: '#FFF8E1', borderRadius: '4px', display: 'flex', alignItems: 'center' }}>
                                <span style={{ fontWeight: 'bold', marginRight: '10px' }}>Tipo:</span>
                                <label style={{ marginRight: '15px' }}><input type="radio" checked={!form.isComplex} onChange={() => setForm({ ...form, isComplex: false })} /> Simple</label>
                                <label><input type="radio" checked={form.isComplex} onChange={() => setForm({ ...form, isComplex: true })} /> Compleja</label>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '10px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#444' }}>Código Sección</label>
                                    <input type="text" value={form.section_code} onChange={e => setForm({ ...form, section_code: e.target.value })} required
                                        style={{ padding: '8px 10px', border: '1.5px solid #bbb', borderRadius: '5px', fontSize: '14px', outline: 'none', background: '#fff' }} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#444' }}>Nombre Sección</label>
                                    <input type="text" value={form.section_name} onChange={e => setForm({ ...form, section_name: e.target.value })} required
                                        style={{ padding: '8px 10px', border: '1.5px solid #bbb', borderRadius: '5px', fontSize: '14px', outline: 'none', background: '#fff' }} />
                                </div>
                            </div>

                            {form.isComplex && (
                                <div style={{ marginTop: '10px', paddingLeft: '20px', borderLeft: '2px solid #ddd' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#444' }}>Cód. Subsección</label>
                                            <input type="text" value={form.subsection_code} onChange={e => setForm({ ...form, subsection_code: e.target.value })} required
                                                style={{ padding: '8px 10px', border: '1.5px solid #bbb', borderRadius: '5px', fontSize: '14px', outline: 'none', background: '#fff' }} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#444' }}>Nombre Subsección</label>
                                            <input type="text" value={form.subsection_name} onChange={e => setForm({ ...form, subsection_name: e.target.value })} required
                                                style={{ padding: '8px 10px', border: '1.5px solid #bbb', borderRadius: '5px', fontSize: '14px', outline: 'none', background: '#fff' }} />
                                        </div>
                                    </div>
                                </div>
                            )}



                            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                                <button type="button" onClick={handleClearAll} style={{ padding: '10px', background: '#eee', border: 'none' }}>Limpiar</button>
                                <button type="submit" style={{ flex: 1, padding: '10px', background: '#FC7323', color: 'white', border: 'none', fontWeight: 'bold' }}><Plus size={16} /> Crear Dependencia</button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* --- STEP 2: MASS TRD UPLOAD (ALWAYS VISIBLE) --- */}
                <div style={{ background: '#E8F5E9', border: '2px solid #2e7d32', borderRadius: '8px', padding: '20px', marginBottom: '10px' }}>
                    <h3 style={{ margin: '0 0 8px 0', color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Database size={20} /> PASO 2 — Carga Masiva de TRD (Excel)
                    </h3>
                    <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#555' }}>
                        Descargue la plantilla, diligénciela y súbala para crear Series, Subseries y Tipologías en bloque.
                    </p>

                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        {/* Download */}
                        <button
                            onClick={() => window.open('/api/trd/template', '_blank')}
                            style={{ background: '#fff', border: '2px solid #2e7d32', color: '#2e7d32', padding: '10px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Database size={16} /> Descargar Plantilla Excel
                        </button>

                        {/* Dependency selector */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '220px' }}>
                            <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Dependencia destino:</label>
                            <select
                                id="mass-upload-dependency"
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #aaa', fontSize: '13px' }}
                            >
                                <option value="">-- Seleccione una dependencia --</option>
                                {structure.map(item => (
                                    <option key={item.id} value={item.id}>
                                        {item.section_code} - {item.section_name}
                                        {item.subsection_code ? ` > ${item.subsection_code} - ${item.subsection_name}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Upload */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Archivo Excel (.xlsx):</label>
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                id="mass-upload-file-global"
                                style={{ fontSize: '13px' }}
                                onChange={async (e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    const depSelect = document.getElementById('mass-upload-dependency');
                                    const depId = depSelect ? depSelect.value : '';
                                    if (!depId) {
                                        alert('Por favor seleccione primero una Dependencia destino.');
                                        e.target.value = null;
                                        return;
                                    }
                                    if (!confirm(`¿Cargar "${file.name}" en la dependencia seleccionada?`)) {
                                        e.target.value = null;
                                        return;
                                    }
                                    const formData = new FormData();
                                    formData.append('file', file);
                                    formData.append('dependency_id', depId);
                                    try {
                                        const res = await axios.post(`${API_URL}/trd/upload`, formData, {
                                            headers: { 'Content-Type': 'multipart/form-data' }
                                        });
                                        alert('✔ ' + (res.data.message || 'Carga exitosa'));
                                        fetchStructure();
                                    } catch (err) {
                                        alert('Error al intentar cargar el archivo: ' + (err.response?.data?.error || err.message));
                                    }
                                    e.target.value = null;
                                }}
                            />
                        </div>
                    </div>
                </div>


                <div className="organogram-area" style={{ overflowX: 'auto', textAlign: 'center', borderTop: '2px solid #eee', paddingTop: '20px' }}>
                    <h3 style={{ color: '#00324D', margin: '0 0 15px 0' }}>PASO 3 — Estructura Organizacional</h3>
                    <p style={{ fontSize: '13px', color: '#555', marginBottom: '20px' }}>
                        Haga clic en una <strong>Sección (Naranja)</strong> o <strong>Subsección (Violeta)</strong> para ver y gestionar su TRD manualmente.
                    </p>

                    {loading ? <p>Cargando estructura...</p> : (
                        <div className="organogram-container" style={{ display: 'inline-block', minWidth: '100%' }}>
                            <div style={{ display: 'flex', gap: '40px', justifyContent: 'center' }}>
                                {organogramData && Object.values(organogramData).map((regional) => (
                                    <TreeNode key={regional.code} node={regional} level="regional" />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* --- TRD MANAGEMENT PANEL (Conditionally Rendered) --- */}
                {selectedNode && (
                    <div id="trd-panel" style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '2px solid #2962ff', scrollMarginTop: '20px' }} tabIndex="0">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, color: '#2962ff' }}>
                                Gestión de TRD: <span style={{ color: '#333' }}>{selectedNode.code} - {selectedNode.name}</span>
                            </h3>
                            <button onClick={() => setSelectedNode(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
                        </div>


                        {/* STORAGE PATH REMINDER (read-only) */}
                        {editStoragePath && (
                            <div style={{ background: '#E8F5E9', padding: '10px 15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #A5D6A7', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Database size={16} style={{ color: '#2e7d32', flexShrink: 0 }} />
                                <span style={{ fontSize: '13px', color: '#2e7d32' }}><strong>Ruta de Almacenamiento:</strong> {editStoragePath}</span>
                            </div>
                        )}

                        {/* NEW SERIES FORM */}
                        <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                            <h4 style={{ marginTop: 0 }}>Nueva Serie</h4>
                            <form onSubmit={handleCreateSeries}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ccc', borderRadius: '4px', background: '#fff', overflow: 'hidden' }}>
                                        <span style={{ padding: '8px', background: '#eee', borderRight: '1px solid #ccc', fontSize: '11px', color: '#666', whiteSpace: 'nowrap' }}>
                                            {selectedNode.regional_code + '.' + selectedNode.code + '-'}
                                        </span>
                                        <input
                                            type="text"
                                            placeholder="Ej: 100"
                                            value={trdForm.series_code}
                                            onChange={e => setTrdForm({ ...trdForm, series_code: e.target.value })}
                                            required
                                            style={{ border: 'none', padding: '8px', flex: 1, outline: 'none', width: '100%' }}
                                        />
                                    </div>
                                    <input type="text" placeholder="Nombre Serie" value={trdForm.series_name} onChange={e => setTrdForm({ ...trdForm, series_name: e.target.value })} required style={{ padding: '8px' }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <label><input type="radio" checked={!trdForm.isComplex} onChange={() => setTrdForm({ ...trdForm, isComplex: false })} /> Simple</label>
                                        <label><input type="radio" checked={trdForm.isComplex} onChange={() => setTrdForm({ ...trdForm, isComplex: true })} /> Compleja</label>
                                    </div>
                                </div>
                                <button type="submit" style={{ background: '#2962ff', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
                                    Crear Serie
                                </button>
                            </form>
                        </div>

                        {/* MASS UPLOAD + UPDATE SECTION */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>

                            {/* CARGA MASIVA (Agregar) */}
                            <div style={{ background: '#e8f5e9', padding: '15px', borderRadius: '8px', border: '1px solid #c8e6c9' }}>
                                <h4 style={{ marginTop: 0, color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Database size={16} /> Carga Masiva (Agregar)
                                </h4>
                                <p style={{ fontSize: '12px', color: '#555', marginBottom: '10px' }}>
                                    Agrega Series, Subseries y Tipologías <strong>sin borrar</strong> las existentes.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <button
                                        onClick={() => window.open('/api/trd/template', '_blank')}
                                        style={{ background: '#fff', border: '1px solid #2e7d32', color: '#2e7d32', padding: '7px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                    >
                                        📥 Descargar Plantilla
                                    </button>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        id="trd-upload"
                                        style={{ fontSize: '12px' }}
                                        onChange={async (e) => {
                                            const file = e.target.files[0];
                                            if (!file) return;
                                            if (!confirm(`¿Agregar datos del archivo "${file.name}" a la dependencia ${selectedNode.code}?`)) { e.target.value = null; return; }
                                            const formData = new FormData();
                                            formData.append('file', file);
                                            formData.append('dependency_id', selectedNode.id);
                                            try {
                                                const res = await axios.post(`${API_URL}/trd/upload`, formData, {
                                                    headers: { 'Content-Type': 'multipart/form-data' }
                                                });
                                                alert('✔ ' + (res.data.message || 'Exito'));
                                                fetchTRD(selectedNode.id);
                                            } catch (err) {
                                                alert("Error al subir archivo: " + (err.response?.data?.error || err.message));
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {/* ACTUALIZAR TRD (Reemplazar todo) */}
                            <div style={{ background: '#fff3e0', padding: '15px', borderRadius: '8px', border: '1px solid #ffcc80' }}>
                                <h4 style={{ marginTop: 0, color: '#e65100', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Database size={16} /> Actualizar TRD (Reemplazar)
                                </h4>
                                <p style={{ fontSize: '12px', color: '#555', marginBottom: '10px' }}>
                                    ⚠️ <strong>Borra toda la TRD actual</strong> de esta dependencia y la reemplaza con el Excel.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <button
                                        onClick={() => window.open('/api/trd/template', '_blank')}
                                        style={{ background: '#fff', border: '1px solid #e65100', color: '#e65100', padding: '7px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                    >
                                        📥 Descargar Plantilla
                                    </button>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        id="trd-update-upload"
                                        style={{ fontSize: '12px' }}
                                        onChange={async (e) => {
                                            const file = e.target.files[0];
                                            if (!file) return;
                                            if (!confirm(`⚠️ ADVERTENCIA: Esto eliminará TODA la TRD actual de "${selectedNode.name}" y la reemplazará con el archivo "${file.name}".\n\n¿Continuar?`)) { e.target.value = null; return; }
                                            const formData = new FormData();
                                            formData.append('file', file);
                                            formData.append('dependency_id', selectedNode.id);
                                            try {
                                                const res = await axios.post(`${API_URL}/trd/update-upload`, formData, {
                                                    headers: { 'Content-Type': 'multipart/form-data' }
                                                });
                                                alert('✔ ' + (res.data.message || 'TRD actualizada (reemplazada) con éxito'));
                                                fetchTRD(selectedNode.id);
                                            } catch (err) {
                                                alert("Error al reemplazar: " + (err.response?.data?.error || err.message));
                                            }
                                            e.target.value = null;
                                        }}
                                    />
                                </div>
                            </div>

                        </div>


                        {/* EXISTING TRD LIST */}
                        <div className="trd-list">
                            <h4>Tabla de Retención Documental (TRD)</h4>
                            {!Array.isArray(trdData) || trdData.length === 0 ? <p style={{ color: '#888' }}>No hay series registradas para esta dependencia.</p> : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ background: '#ddd', textAlign: 'left' }}>
                                            <th style={{ padding: '8px' }}>Cód.</th>
                                            <th style={{ padding: '8px' }}>Nombre Serie / Subserie</th>
                                            <th style={{ padding: '8px' }}>Tipologías Documentales</th>
                                            <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.isArray(trdData) && trdData.map(series => (
                                            <React.Fragment key={'s-' + series.id}>
                                                {/* SERIES ROW */}
                                                <tr style={{ background: '#e3f2fd', borderBottom: '1px solid #ccc' }}>
                                                    <td style={{ padding: '8px' }}><strong>{series.code}</strong></td>
                                                    <td style={{ padding: '8px' }}><strong>{series.name}</strong></td>
                                                    <td style={{ padding: '8px' }}>
                                                        {series.typologies && Array.isArray(series.typologies) && series.typologies.length > 0 ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                {series.typologies.map((t, index) => (
                                                                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', background: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', border: '1px solid #ddd' }}>
                                                                        <span>{index + 1}. {t.name}</span>
                                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                                            <button onClick={() => handleEditTypology(t)} title="Editar tipología" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1565c0', fontSize: '11px', padding: '0 2px' }}>✏</button>
                                                                            <button onClick={() => handleDeleteTypology(t.id)} title="Eliminar tipología" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c62828', fontSize: '11px', padding: '0 2px' }}>✕</button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (!series.subseries || series.subseries.length === 0) && <em style={{ color: '#888' }}>Sin tipologías</em>}
                                                    </td>
                                                    <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                                                        {series.subseries.length === 0 && (
                                                            <button onClick={() => handleCreateTypology(series.id)} title="Agregar tipología" style={{ margin: '2px', fontSize: '11px', background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: '3px', cursor: 'pointer', padding: '2px 6px' }}>+ Tipología</button>
                                                        )}
                                                        <button onClick={() => handleCreateSubseries(series)} title="Agregar subserie" style={{ margin: '2px', fontSize: '11px', background: '#e3f2fd', border: '1px solid #1e88e5', borderRadius: '3px', cursor: 'pointer', padding: '2px 6px' }}>+ Subserie</button>
                                                        <button onClick={() => handleEditSeries(series)} title="Editar serie" style={{ margin: '2px', fontSize: '11px', background: '#fff8e1', border: '1px solid #ffa726', borderRadius: '3px', cursor: 'pointer', padding: '2px 6px' }}>✏ Editar</button>
                                                        <button onClick={() => handleDeleteSeries(series.id)} title="Eliminar serie" style={{ margin: '2px', fontSize: '11px', background: '#ffebee', border: '1px solid #e53935', color: '#c62828', borderRadius: '3px', cursor: 'pointer', padding: '2px 6px' }}>🗑 Eliminar</button>
                                                    </td>
                                                </tr>
                                                {/* SUBSERIES ROWS */}
                                                {series.subseries && Array.isArray(series.subseries) && series.subseries.map(sub => (
                                                    <tr key={'sub-' + sub.id} style={{ background: '#fff', borderBottom: '1px solid #eee' }}>
                                                        <td style={{ padding: '8px', paddingLeft: '30px', color: '#666' }}>↳ {sub.code}</td>
                                                        <td style={{ padding: '8px', color: '#666' }}>{sub.name}</td>
                                                        <td style={{ padding: '8px' }}>
                                                            {sub.typologies && Array.isArray(sub.typologies) && sub.typologies.length > 0 && (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                    {sub.typologies.map((t, index) => (
                                                                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', background: '#f5f5f5', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', border: '1px solid #ddd' }}>
                                                                            <span>{index + 1}. {t.name}</span>
                                                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                                                <button onClick={() => handleEditTypology(t)} title="Editar tipología" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1565c0', fontSize: '11px', padding: '0 2px' }}>✏</button>
                                                                                <button onClick={() => handleDeleteTypology(t.id)} title="Eliminar tipología" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c62828', fontSize: '11px', padding: '0 2px' }}>✕</button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                                                            <button onClick={() => handleCreateTypology(series.id, sub.id)} style={{ margin: '2px', fontSize: '11px', background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: '3px', cursor: 'pointer', padding: '2px 6px' }}>+ Tipología</button>
                                                            <button onClick={() => handleEditSubseries(sub)} title="Editar subserie" style={{ margin: '2px', fontSize: '11px', background: '#fff8e1', border: '1px solid #ffa726', borderRadius: '3px', cursor: 'pointer', padding: '2px 6px' }}>✏ Editar</button>
                                                            <button onClick={() => handleDeleteSubseries(sub.id)} title="Eliminar subserie" style={{ margin: '2px', fontSize: '11px', background: '#ffebee', border: '1px solid #e53935', color: '#c62828', borderRadius: '3px', cursor: 'pointer', padding: '2px 6px' }}>🗑 Eliminar</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

export default CreationModule;
