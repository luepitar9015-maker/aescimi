import { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, FileDown, Database, CheckCircle, AlertCircle } from 'lucide-react';

function MassUpload() {
    const [dependencies, setDependencies] = useState([]);
    const [series, setSeries] = useState([]);
    const [subseries, setSubseries] = useState([]);

    const [selectedDep, setSelectedDep] = useState('');
    const [selectedSeries, setSelectedSeries] = useState('');
    const [selectedSubseries, setSelectedSubseries] = useState('');

    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        axios.get('/api/dependencies').then(res => setDependencies(res.data.data));
    }, []);

    useEffect(() => {
        if (selectedDep) {
            // In a real app we might filter series by dependency if the API supported it, 
            // for now we fetch all and filter client side or just fetch all.
            // Let's fetch all series for now as the API is simple.
            axios.get('/api/trd/series').then(res => {
                setSeries(res.data.data.filter(s => s.dependency_id == selectedDep));
            });
        } else {
            setSeries([]);
        }
        setSelectedSeries('');
        setSelectedSubseries('');
    }, [selectedDep]);

    useEffect(() => {
        if (selectedSeries) {
            const ser = series.find(s => s.id == selectedSeries);
            if (ser && ser.type === 'complex') {
                axios.get(`/api/trd/subseries?series_id=${selectedSeries}`).then(res => {
                    setSubseries(res.data.data);
                });
            } else {
                setSubseries([]);
            }
        } else {
            setSubseries([]);
        }
        setSelectedSubseries('');
    }, [selectedSeries]);

    const handleDownloadTemplate = async () => {
        if (!selectedSeries) return alert('Seleccione una Serie');

        // Determine context (Series or Subseries)
        // If series is complex, user MUST select subseries to get the specific schema? 
        // Or we enforce metadata on the Series level? 
        // Guidelines say: "Cada serie y subserie... debe crear el formulario". 
        // So we prioritized the most specific one.

        let type = 'series';
        let id = selectedSeries;

        if (selectedSubseries) {
            type = 'subseries';
            id = selectedSubseries;
        } else {
            // If it's complex and no subseries selected, warn?
            // For now, allow series level if that's where metadata is.
        }

        try {
            const res = await axios.get(`/api/metadata/template/${type}/${id}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Plantilla_Cargue_${type}_${id}.xlsx`);
            document.body.appendChild(link);
            link.click();
        } catch (err) {
            alert("Error descargando plantilla");
        }
    };

    const handleUpload = async () => {
        if (!file) return alert("Seleccione un archivo");

        let type = 'series';
        let id = selectedSeries;
        if (selectedSubseries) {
            type = 'subseries';
            id = selectedSubseries;
        }

        const formData = new FormData();
        formData.append('file', file);

        setLoading(true);
        setStatus('Procesando...');

        try {
            const res = await axios.post(`/api/metadata/upload/${type}/${id}`, formData);
            setStatus(`Éxito: ${res.data.message}`);
            setFile(null);
        } catch (err) {
            setStatus('Error en el cargue: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="trd-container">
            <h2>Cargue Masivo de Información</h2>
            <div className="card">
                <h3>1. Selección de Contexto</h3>
                <div className="form-row">
                    <div className="form-group">
                        <label>Dependencia</label>
                        <select value={selectedDep} onChange={e => setSelectedDep(e.target.value)}>
                            <option value="">Seleccione...</option>
                            {dependencies.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Serie</label>
                        <select value={selectedSeries} onChange={e => setSelectedSeries(e.target.value)} disabled={!selectedDep}>
                            <option value="">Seleccione...</option>
                            {series.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
                        </select>
                    </div>
                    {subseries.length > 0 && (
                        <div className="form-group">
                            <label>Subserie</label>
                            <select value={selectedSubseries} onChange={e => setSelectedSubseries(e.target.value)}>
                                <option value="">Seleccione...</option>
                                {subseries.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            <div className="workspace" style={{ marginTop: 20 }}>
                <div className="card">
                    <h3>2. Descargar Plantilla</h3>
                    <p>Obtenga el archivo Excel con los campos de metadatos configurados para esta serie/subserie.</p>
                    <button className="btn btn-secondary" onClick={handleDownloadTemplate} disabled={!selectedSeries}>
                        <FileDown size={18} /> Descargar Excel
                    </button>
                </div>

                <div className="card">
                    <h3>3. Subir Información</h3>
                    <p>Cargue el archivo Excel diligenciado.</p>
                    <input type="file" onChange={e => setFile(e.target.files[0])} accept=".xlsx" />
                    <button className="btn btn-primary" onClick={handleUpload} disabled={!file || loading} style={{ marginTop: 10 }}>
                        {loading ? 'Cargando...' : <><Upload size={18} /> Procesar Cargue</>}
                    </button>
                    {status && (
                        <div className={`status-msg ${status.includes('Error') ? 'error' : 'success'}`} style={{ marginTop: 10, padding: 10, background: status.includes('Error') ? '#fee' : '#eef', borderRadius: 4 }}>
                            {status.includes('Error') ? <AlertCircle size={16} /> : <CheckCircle size={16} />} {status}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default MassUpload;
