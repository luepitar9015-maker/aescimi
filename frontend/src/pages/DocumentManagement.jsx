import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, Upload, FileText, Save, Eye, X, Check, Folder, Pencil, Edit, Trash2, Download } from 'lucide-react';

function CustomPdfViewer({ fileUrl, onTextExtracted, activeTargetName }) {
    const [pdf, setPdf] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [numPages, setNumPages] = useState(0);
    const [scale, setScale] = useState(1.2);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const renderTaskRef = useRef(null);

    // Selection state refs for synchronous drag tracking
    const isSelectingRef = useRef(false);
    const startCoordsRef = useRef({ x: 0, y: 0 });
    const [selection, setSelection] = useState(null); // { x, y, width, height }

    // Global mouseup listener to avoid sticking if mouse released outside canvas
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (isSelectingRef.current) {
                isSelectingRef.current = false;
                setSelection(prev => {
                    if (prev && (prev.width < 10 || prev.height < 10)) {
                        return null;
                    }
                    return prev;
                });
            }
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    // Load PDF
    useEffect(() => {
        if (!fileUrl) return;
        setPageNumber(1);
        setSelection(null);
        
        const checkAndLoadPdf = () => {
            if (!window.pdfjsLib) {
                setTimeout(checkAndLoadPdf, 100);
                return;
            }

            const loadingTask = window.pdfjsLib.getDocument(fileUrl);
            loadingTask.promise.then(
                (loadedPdf) => {
                    setPdf(loadedPdf);
                    setNumPages(loadedPdf.numPages);
                },
                (error) => {
                    console.error("Error loading PDF: ", error);
                }
            );
        };

        checkAndLoadPdf();
    }, [fileUrl]);

    // Render Page
    useEffect(() => {
        if (!pdf) return;
        
        pdf.getPage(pageNumber).then((page) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const context = canvas.getContext('2d');
            
            const viewport = page.getViewport({ scale });
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // Cancel previous render task if exists
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            const renderTask = page.render(renderContext);
            renderTaskRef.current = renderTask;
            
            renderTask.promise.then(
                () => {
                    renderTaskRef.current = null;
                },
                (error) => {
                    if (error.name !== 'RenderingCancelledException') {
                        console.error("Render error: ", error);
                    }
                }
            );
        });
    }, [pdf, pageNumber, scale]);

    const handleMouseDown = (e) => {
        if (isOcrLoading) return;
        e.preventDefault(); // Previene la selección/arrastre nativo del navegador para dibujar el área
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        isSelectingRef.current = true;
        startCoordsRef.current = { x, y };
        setSelection({ x, y, width: 0, height: 0 });
    };

    const handleMouseMove = (e) => {
        if (!isSelectingRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        
        const startX = startCoordsRef.current.x;
        const startY = startCoordsRef.current.y;
        
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const width = Math.abs(startX - currentX);
        const height = Math.abs(startY - currentY);
        
        setSelection({ x, y, width, height });
    };

    const handleMouseUp = () => {
        if (isSelectingRef.current) {
            isSelectingRef.current = false;
            setSelection(prev => {
                if (prev && (prev.width < 10 || prev.height < 10)) {
                    return null;
                }
                return prev;
            });
        }
    };

    const handleExtract = async () => {
        if (!selection || !canvasRef.current) return;
        
        setIsOcrLoading(true);
        try {
            const canvas = canvasRef.current;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = selection.width * scaleX;
            cropCanvas.height = selection.height * scaleY;
            const cropCtx = cropCanvas.getContext('2d');

            // Rellenar con fondo blanco para evitar que las transparencias del PDF se conviertan en negro al usar JPEG
            cropCtx.fillStyle = '#FFFFFF';
            cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);

            cropCtx.drawImage(
                canvas,
                selection.x * scaleX,
                selection.y * scaleY,
                selection.width * scaleX,
                selection.height * scaleY,
                0,
                0,
                cropCanvas.width,
                cropCanvas.height
            );

            const base64Image = cropCanvas.toDataURL('image/jpeg', 0.95);
            
            const token = localStorage.getItem('token');
            const response = await axios.post('/api/ai/ocr-image', { image: base64Image }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.data.text && response.data.text.trim()) {
                onTextExtracted(response.data.text.trim());
                // Clear selection after successful extraction
                setSelection(null);
            } else {
                alert("La IA no pudo detectar texto en la zona seleccionada. Por favor, asegúrese de seleccionar una región con texto claro.");
            }
        } catch (error) {
            console.error("OCR error: ", error);
            const errMsg = error.response?.data?.error || error.message;
            alert("Error al extraer texto del PDF con la IA: " + errMsg);
        } finally {
            setIsOcrLoading(false);
        }
    };

    const handleClearSelection = () => {
        setSelection(null);
    };

    return (
        <div className="flex flex-col bg-gray-100 rounded-lg overflow-hidden border border-gray-200" style={{ height: '620px' }}>
            {/* Toolbar */}
            <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between text-xs select-none">
                <div className="flex items-center gap-2">
                    <button 
                        disabled={pageNumber <= 1}
                        onClick={() => { setPageNumber(prev => prev - 1); setSelection(null); }}
                        className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-2 py-1 rounded font-bold"
                    >
                        Anterior
                    </button>
                    <span>Pág {pageNumber} de {numPages}</span>
                    <button 
                        disabled={pageNumber >= numPages}
                        onClick={() => { setPageNumber(prev => prev + 1); setSelection(null); }}
                        className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-2 py-1 rounded font-bold"
                    >
                        Siguiente
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setScale(s => Math.max(s - 0.1, 0.5))} className="bg-gray-700 px-2 py-0.5 rounded font-bold text-base">-</button>
                    <span>{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(s => Math.min(s + 0.1, 3.0))} className="bg-gray-700 px-2 py-0.5 rounded font-bold text-base">+</button>
                </div>
            </div>

            {/* Subtitle about Capture Target */}
            <div className="bg-green-50 border-b border-green-200 px-4 py-1.5 text-[11px] text-green-800 font-medium flex items-center justify-between">
                <span className="truncate max-w-[80%]">
                    {activeTargetName 
                        ? `📌 Destino activo: ${activeTargetName}`
                        : "⚠️ Seleccione una casilla de texto a la izquierda para habilitar la captura."}
                </span>
                {selection && (
                    <button onClick={handleClearSelection} className="text-red-500 hover:text-red-700 underline font-bold shrink-0">
                        Quitar selección
                    </button>
                )}
            </div>

            {/* PDF View Container */}
            <div className="flex-1 overflow-auto p-4 flex justify-center relative bg-gray-500">
                <div 
                    ref={containerRef}
                    className="relative shadow-lg select-none"
                    style={{ position: 'relative', height: 'fit-content', width: 'fit-content' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                >
                    <canvas ref={canvasRef} className="block select-none pointer-events-none" />
                    
                    {/* Render Selection Rect */}
                    {selection && (
                        <>
                            <div 
                                style={{
                                    position: 'absolute',
                                    left: selection.x + 'px',
                                    top: selection.y + 'px',
                                    width: selection.width + 'px',
                                    height: selection.height + 'px',
                                    border: '2px dashed #22c55e',
                                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                    pointerEvents: 'none'
                                }}
                            />
                            {/* Floating Action Button */}
                            <button
                                style={{
                                    position: 'absolute',
                                    left: Math.max(0, selection.x + selection.width / 2 - 50) + 'px',
                                    top: (selection.y + selection.height + 6) + 'px',
                                    zIndex: 50,
                                }}
                                disabled={isOcrLoading}
                                onClick={() => {
                                    if (!activeTargetName) {
                                        alert("Por favor, active la opción '¿Se agregará un texto?' en la columna de la izquierda y haga clic dentro del cuadro de texto correspondiente para indicar dónde quiere copiar el texto extraído.");
                                        return;
                                    }
                                    handleExtract();
                                }}
                                className={`px-2.5 py-1 text-[11px] font-bold text-white rounded shadow-md flex items-center gap-1 transition-all ${
                                    activeTargetName 
                                        ? 'bg-green-600 hover:bg-green-700' 
                                        : 'bg-orange-500 hover:bg-orange-600 animate-pulse'
                                }`}
                            >
                                {isOcrLoading ? (
                                    <>
                                        <div className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Procesando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>{activeTargetName ? '✨ Extraer texto' : '⚠️ Sin destino activo'}</span>
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function DocumentManagement() {
    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedExpediente, setSelectedExpediente] = useState(null);
    const [typologies, setTypologies] = useState([]);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [viewMode, setViewMode] = useState('search');
    const [previewIdx, setPreviewIdx] = useState(null);
    const [activeTab, setActiveTab] = useState('buscar');
    const [savedDocs, setSavedDocs] = useState([]);
    const [loadingSaved, setLoadingSaved] = useState(false);

    const [assignments, setAssignments] = useState([]);
    const [editingDoc, setEditingDoc] = useState(null);
    const [hybridStatus, setHybridStatus] = useState(null);
    const [backupLoading, setBackupLoading] = useState(false);
    const [classifyingIdx, setClassifyingIdx] = useState(null); // Nuevo estado IA
    const [expedienteSummary, setExpedienteSummary] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);

    const [activeTextTarget, setActiveTextTarget] = useState(null);

    // Automatically set active text target when previewed file changes or text options change
    useEffect(() => {
        if (previewIdx === null || !files[previewIdx]) {
            setActiveTextTarget(null);
            return;
        }
        
        const entry = files[previewIdx];
        if (!entry.isSplit) {
            if (entry.addTextOption === 'si') {
                setActiveTextTarget(prev => {
                    if (prev && prev.type === 'single' && prev.fileIdx === previewIdx) return prev;
                    return { type: 'single', fileIdx: previewIdx };
                });
            } else {
                setActiveTextTarget(prev => {
                    if (prev && prev.type === 'single' && prev.fileIdx === previewIdx) return null;
                    return prev;
                });
            }
        } else {
            const firstActiveRangeIdx = entry.ranges.findIndex(r => r.addTextOption === 'si');
            if (firstActiveRangeIdx !== -1) {
                setActiveTextTarget(prev => {
                    if (prev && prev.type === 'split' && prev.fileIdx === previewIdx && prev.rangeIdx === firstActiveRangeIdx) return prev;
                    return { type: 'split', fileIdx: previewIdx, rangeIdx: firstActiveRangeIdx };
                });
            } else {
                setActiveTextTarget(prev => {
                    if (prev && prev.type === 'split' && prev.fileIdx === previewIdx) return null;
                    return prev;
                });
            }
        }
    }, [previewIdx, files[previewIdx]?.addTextOption, files[previewIdx]?.isSplit]);

    const handleOcrTextExtracted = (extractedText) => {
        if (!activeTextTarget) return;

        if (activeTextTarget.type === 'single') {
            const { fileIdx } = activeTextTarget;
            setFiles(prev => prev.map((f, i) => {
                if (i !== fileIdx) return f;
                const currentText = f.documentText || '';
                const newText = currentText ? `${currentText}\n${extractedText}` : extractedText;
                return { ...f, documentText: newText };
            }));
        } else if (activeTextTarget.type === 'split') {
            const { fileIdx, rangeIdx } = activeTextTarget;
            setFiles(prev => prev.map((f, i) => {
                if (i !== fileIdx) return f;
                const newRanges = f.ranges.map((r, ri) => {
                    if (ri !== rangeIdx) return r;
                    const currentText = r.documentText || '';
                    const newText = currentText ? `${currentText}\n${extractedText}` : extractedText;
                    return { ...r, documentText: newText };
                });
                return { ...f, ranges: newRanges };
            }));
        } else if (activeTextTarget.type === 'edit') {
            setEditingDoc(prev => {
                if (!prev) return null;
                const currentText = prev.newDescription || '';
                const newText = currentText ? `${currentText}\n${extractedText}` : extractedText;
                return { ...prev, newDescription: newText };
            });
        }
    };

    const getActiveTargetName = () => {
        if (!activeTextTarget) return null;
        if (activeTextTarget.type === 'single') {
            const file = files[activeTextTarget.fileIdx];
            return file ? `Documento "${file.file.name}"` : 'Texto de documento';
        }
        if (activeTextTarget.type === 'split') {
            const file = files[activeTextTarget.fileIdx];
            const range = file?.ranges?.[activeTextTarget.rangeIdx];
            return file && range ? `Rango ${range.start}-${range.end} de "${file.file.name}"` : 'Texto de rango';
        }
        if (activeTextTarget.type === 'edit') {
            return editingDoc ? `Editar descripción de "${editingDoc.filename}"` : 'Editar descripción';
        }
        return null;
    };

    // Leer usuario actual del localStorage
    const currentUser = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';

    const fetchSavedDocs = async () => {
        setLoadingSaved(true);
        try {
            const res = await axios.get('/api/documents');
            setSavedDocs(res.data.data || []);
        } catch (err) {
            console.error('Error fetching saved docs:', err);
        } finally {
            setLoadingSaved(false);
        }
    };

    useEffect(() => { fetchSavedDocs(); }, []);

    // Search Expedientes
    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchTerm) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/expedientes/search?term=${encodeURIComponent(searchTerm)}`);
            setSearchResults(res.data.data);
            setSelectedExpediente(null); 
            setViewMode('search');
        } catch (err) {
            console.error(err);
            alert("Error al buscar expedientes");
        } finally {
            setLoading(false);
        }
    };

    // Handle "Gestionar" Click
    const handleManage = async (exp) => {
        setSelectedExpediente(exp);
        setAssignments([]);
        setFiles([]);
        setStatus('');
        setHybridStatus(null);
        
        // Fetch Typologies: matching by subseries code (exp.subserie now stores the code)
        try {
            let typologiesFound = [];

            // Try 1: search by subserie (stores the code)
            if (exp.subserie) {
                const res = await axios.get(`/api/trd/typologies-for-expediente?subserie=${encodeURIComponent(exp.subserie)}`);
                typologiesFound = res.data.data || [];
            }

            // Try 2: search by series name/code if subserie didn't yield results
            if (typologiesFound.length === 0 && exp.title) {
                const res = await axios.get(`/api/trd/typologies-for-expediente?subserie=${encodeURIComponent(exp.title)}`);
                typologiesFound = res.data.data || [];
            }

            // Try 3: get ALL typologies as fallback
            if (typologiesFound.length === 0) {
                const res = await axios.get(`/api/trd/all-typologies`);
                typologiesFound = res.data.data || [];
            }

            setTypologies(typologiesFound);
        } catch (err) {
            console.error("Error fetching typologies:", err);
            setTypologies([]);
        }
        
        setViewMode('upload');
    };


    const handleBack = () => {
        setViewMode('search');
        setSelectedExpediente(null);
        setHybridStatus(null);
    };

    // Visualizar PDF con fallback automático (si el disco/OneDrive no está disponible, usa backup local)
    const handleView = (doc) => {
        window.open(`/api/documents/file/${doc.id}`, '_blank');
    };

    // Descargar copia de seguridad de todos los PDFs
    const handleBackupPdf = async () => {
        setBackupLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/system/backup-pdf', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                alert('Error al generar copia de seguridad: ' + (err.error || response.statusText));
                return;
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
            a.href = url;
            a.download = `backup_pdf_sena_${dateStr}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('Error al descargar la copia de seguridad: ' + err.message);
        } finally {
            setBackupLoading(false);
        }
    };

    const handleEditDoc = (doc) => {
        let currentDesc = '';
        if (doc.metadata_values) {
            try {
                const meta = typeof doc.metadata_values === 'string' ? JSON.parse(doc.metadata_values) : doc.metadata_values;
                currentDesc = meta.description || '';
            } catch(e) {}
        }
        setEditingDoc({
            ...doc,
            newFilename: doc.filename.replace('.pdf', ''),
            newTypology: doc.typology_name,
            newDate: doc.document_date ? doc.document_date.substring(0, 16) : new Date().toISOString().substring(0, 16),
            newOrigen: doc.origen || 'ELECTRONICO',
            newDescription: currentDesc
        });
    };

    const saveDocChanges = async () => {
        if (!editingDoc) return;
        setLoading(true);
        try {
            await axios.put(`/api/documents/${editingDoc.id}`, {
                filename: editingDoc.newFilename,
                typology_name: editingDoc.newTypology,
                document_date: editingDoc.newDate,
                origen: editingDoc.newOrigen,
                metadata_values: JSON.stringify({ description: editingDoc.newDescription })
            });
            alert("Documento actualizado correctamente");
            setEditingDoc(null);
            fetchSavedDocs();
        } catch (err) {
            console.error(err);
            alert("Error al actualizar documento: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteDoc = async (doc) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente el archivo "${doc.filename}"? Esta acción borrará el archivo físico de OneDrive.`)) {
            return;
        }

        setLoading(true);
        try {
            await axios.delete(`/api/documents/${doc.id}`);
            alert("Documento eliminado correctamente");
            fetchSavedDocs();
        } catch (err) {
            console.error(err);
            alert("Error al eliminar documento: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    // --- CLASIFICACIÓN CON IA ---
    const classifyFileWithAI = async (id, file) => {
        if (!file || file.type !== 'application/pdf') {
            return;
        }

        setFiles(prev => prev.map(entry => 
            entry.id === id ? { ...entry, aiAnalysisStatus: 'loading' } : entry
        ));

        try {
            const formData = new FormData();
            formData.append('file', file);

            const token = localStorage.getItem('token');
            const subserieParam = selectedExpediente ? `?subserie=${encodeURIComponent(selectedExpediente.subserie || '')}` : '';
            const res = await axios.post(`/api/ai/classify-document${subserieParam}`, formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}` 
                }
            });

            const sugerencia = res.data.tipologia_sugerida;
            const confianza = res.data.confianza;
            const razon = res.data.razon;

            if (sugerencia && sugerencia !== 'Desconocida') {
                const cleanStr = (s) => s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") : "";
                const matchedTyp = typologies.find(t => {
                    const cleanT = cleanStr(t.name);
                    const cleanS = cleanStr(sugerencia);
                    return cleanT === cleanS || cleanS.includes(cleanT) || cleanT.includes(cleanS);
                });
                
                setFiles(prev => prev.map(entry => {
                    if (entry.id === id) {
                        return {
                            ...entry,
                            aiAnalysisStatus: 'success',
                            aiSuggestedTypology: sugerencia,
                            aiConfidence: confianza,
                            aiReason: razon,
                            typologyId: matchedTyp ? matchedTyp.id : entry.typologyId,
                            typologyName: matchedTyp ? matchedTyp.name : entry.typologyName
                        };
                    }
                    return entry;
                }));
            } else {
                setFiles(prev => prev.map(entry => 
                    entry.id === id ? { 
                        ...entry, 
                        aiAnalysisStatus: 'success', 
                        aiSuggestedTypology: 'Desconocida', 
                        aiConfidence: confianza || 0,
                        aiReason: razon || 'La IA no pudo determinar la tipología con seguridad.' 
                    } : entry
                ));
            }
        } catch (error) {
            console.error('Error auto-clasificando:', error);
            setFiles(prev => prev.map(entry => 
                entry.id === id ? { ...entry, aiAnalysisStatus: 'error' } : entry
            ));
        }
    };

    const handleMockUpload = async () => {
        try {
            const response = await fetch('/documento_prueba.pdf');
            if (!response.ok) throw new Error("No se pudo descargar el archivo del servidor.");
            const blob = await response.blob();
            const file = new File([blob], "documento_prueba.pdf", { type: "application/pdf" });
            
            const fakeEvent = {
                target: {
                    files: [file],
                    value: null
                }
            };
            onFileChange(fakeEvent);
        } catch (err) {
            console.error("Error cargando PDF de prueba:", err);
            alert("No se pudo cargar el PDF de prueba: " + err.message);
        }
    };

    // Handle File Upload - multi-file
    const onFileChange = (e) => {
        const allowedTypes = [
            'application/pdf', 
            'image/jpeg', 'image/png', 'image/jpg',
            'image/tiff', 'image/x-tiff'
        ];
        const selectedFiles = Array.from(e.target.files).filter(f => allowedTypes.includes(f.type));
        
        if (selectedFiles.length === 0) {
            alert('Por favor seleccione archivos PDF o imágenes (JPG/PNG).');
            return;
        }

        const defaultDate = (() => {
            if (selectedExpediente && selectedExpediente.opening_date) {
                const od = selectedExpediente.opening_date;
                if (od.includes('T')) return od.slice(0, 16);
                const datePart = od.split(' ')[0].split('T')[0];
                return `${datePart}T12:00`;
            }
            return new Date().toISOString().slice(0, 16);
        })();

        const newEntries = selectedFiles.map(f => ({
            id: Date.now() + Math.random(),
            file: f,
            typologyId: '',
            typologyName: '',
            creationDate: defaultDate,
            origen: 'ELECTRONICO',
            addTextOption: 'no',
            documentText: '',
            isSplit: false,
            ranges: [{ start: 1, end: 1, typologyId: '', typologyName: '', addTextOption: 'no', documentText: '' }],
            url: URL.createObjectURL(f),  // create preview URL
            aiAnalysisStatus: 'idle', // 'idle' | 'loading' | 'success' | 'error'
            aiSuggestedTypology: '',
            aiConfidence: null,
            aiReason: ''
        }));

        setFiles(prev => {
            const updated = [...prev, ...newEntries];
            if (previewIdx === null) setPreviewIdx(updated.length - newEntries.length); 
            return updated;
        });

        // Trigger AI classification automatically for PDF files
        newEntries.forEach(entry => {
            if (entry.file.type === 'application/pdf') {
                classifyFileWithAI(entry.id, entry.file);
            }
        });

        e.target.value = null;
    };

    const removeFile = (index) => {
        setFiles(prev => {
            const updated = prev.filter((_, i) => i !== index);
            if (previewIdx !== null) {
                if (updated.length === 0) setPreviewIdx(null);
                else if (previewIdx >= updated.length) setPreviewIdx(updated.length - 1);
            }
            return updated;
        });
    };

    const updateFileTypology = (index, typologyId) => {
        const typ = typologies.find(t => t.id == typologyId);
        setFiles(prev => prev.map((entry, i) =>
            i === index ? { ...entry, typologyId, typologyName: typ ? typ.name : '' } : entry
        ));
    };

    const updateFileDate = (index, creationDate) => {
        setFiles(prev => prev.map((entry, i) =>
            i === index ? { ...entry, creationDate } : entry
        ));
    };

    const toggleSplit = (index) => {
        setFiles(prev => prev.map((entry, i) =>
            i === index ? { ...entry, isSplit: !entry.isSplit } : entry
        ));
    };

    const addRange = (fileIdx) => {
        setFiles(prev => prev.map((entry, i) =>
            i === fileIdx ? { ...entry, ranges: [...entry.ranges, { start: 1, end: 1, typologyId: '', typologyName: '', addTextOption: 'no', documentText: '' }] } : entry
        ));
    };

    const removeRange = (fileIdx, rangeIdx) => {
        setFiles(prev => prev.map((entry, i) =>
            i === fileIdx ? { ...entry, ranges: entry.ranges.filter((_, ri) => ri !== rangeIdx) } : entry
        ));
    };

    const updateRange = (fileIdx, rangeIdx, field, value) => {
        setFiles(prev => prev.map((entry, i) => {
            if (i !== fileIdx) return entry;
            const newRanges = entry.ranges.map((r, ri) => {
                if (ri !== rangeIdx) return r;
                let updated = { ...r, [field]: value };
                if (field === 'typologyId') {
                    const typ = typologies.find(t => t.id == value);
                    updated.typologyName = typ ? typ.name : '';
                }
                return updated;
            });
            return { ...entry, ranges: newRanges };
        }));
    };



    // --- RESUMEN DE EXPEDIENTE CON IA ---
    const handleSummarizeExpediente = async () => {
        if (!selectedExpediente) return;
        setSummaryLoading(true);
        setExpedienteSummary(null);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`/api/ai/summarize-expediente/${selectedExpediente.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setExpedienteSummary(res.data.summary);
        } catch (error) {
            console.error('Error resumiendo expediente:', error);
            alert('Error al generar resumen del expediente con Inteligencia Artificial.');
        } finally {
            setSummaryLoading(false);
        }
    };

    // Submit / Save - sends each file individually
    const handleSave = async () => {
        if (files.length === 0 || !selectedExpediente) return;

        // Validation
        for (const f of files) {
            if (!f.isSplit && !f.typologyName) {
                alert(`Por favor asigne una tipología al archivo: ${f.file.name}`);
                return;
            }
            if (!f.isSplit && f.addTextOption === 'si' && !f.documentText?.trim()) {
                alert(`Por favor escriba el texto del documento para el archivo: ${f.file.name}`);
                return;
            }
            if (f.isSplit) {
                if (f.ranges.length === 0) {
                    alert(`El archivo ${f.file.name} tiene división activa pero no hay rangos.`);
                    return;
                }
                if (f.ranges.some(r => !r.typologyName)) {
                    alert(`Todos los rangos en ${f.file.name} deben tener tipología.`);
                    return;
                }
                if (f.ranges.some(r => r.addTextOption === 'si' && !r.documentText?.trim())) {
                    alert(`Por favor escriba el texto para cada rango con texto activo en el archivo: ${f.file.name}`);
                    return;
                }
            }
        }

        setLoading(true);
        let successCount = 0;
        let errors = [];
        let lastSavedPath = null;

        for (let i = 0; i < files.length; i++) {
            const entry = files[i];
            setStatus(`Procesando archivo ${i + 1} de ${files.length}: ${entry.file.name}...`);
            
            const formData = new FormData();
            formData.append('file', entry.file);
            formData.append('expediente', JSON.stringify(selectedExpediente));
            formData.append('document_date', entry.creationDate);
            formData.append('origen', hybridStatus === 'no' ? 'ELECTRONICO' : (entry.origen || 'ELECTRONICO'));
            
            if (entry.isSplit) {
                formData.append('split', 'true');
                const typs = entry.ranges.map(r => ({
                    name: r.typologyName,
                    range: `${r.start}-${r.end}`,
                    description: r.addTextOption === 'si' ? r.documentText : ''
                }));
                formData.append('typology', JSON.stringify(typs));
            } else {
                formData.append('split', 'false');
                formData.append('typology', JSON.stringify([{
                    name: entry.typologyName,
                    range: '1',
                    description: entry.addTextOption === 'si' ? entry.documentText : ''
                }]));
            }

            try {
                const res = await axios.post('/api/documents/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                successCount++;
                if (res.data.storage_path) lastSavedPath = res.data.storage_path;
            } catch (err) {
                errors.push(entry.file.name + ': ' + (err.response?.data?.error || err.message));
            }
        }

        setLoading(false);
        if (errors.length === 0) {
            const pathMsg = lastSavedPath ? `\nGuardado en: ${lastSavedPath}` : '';
            setStatus(`¡${successCount} archivo(s) guardado(s) en OneDrive exitosamente!${pathMsg}`);
            setFiles([]);
            setPreviewIdx(null);
            fetchSavedDocs();
        } else {
            setStatus(`${successCount} guardados. Errores: ${errors.join(' | ')}`);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-green-800 flex items-center gap-2">
                <Folder /> Gestión Documental
            </h1>

            {/* TABS */}
            {viewMode === 'search' && (
                <div className="flex gap-1 border-b border-gray-200 mb-2">
                    <button onClick={() => setActiveTab('buscar')} className={`px-5 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${activeTab === 'buscar' ? 'border-green-600 text-green-700 bg-green-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        🔍 Buscar Expediente
                    </button>
                    <button onClick={() => { setActiveTab('guardados'); fetchSavedDocs(); }} className={`px-5 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${activeTab === 'guardados' ? 'border-green-600 text-green-700 bg-green-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        📁 Documentos Guardados ({savedDocs.length})
                    </button>
                </div>
            )}

            {/* VISTA 1: BUSCADOR Y TABLA */}
            {viewMode === 'search' && activeTab === 'buscar' && (
            <>
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <form onSubmit={handleSearch} className="flex gap-4">
                            <input 
                                type="text" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar por todos los metadatos (Código, Título, Subserie...)" 
                                className="flex-1 border border-gray-300 rounded p-2 focus:ring-2 focus:ring-green-500 outline-none"
                            />
                            <button type="submit" disabled={loading} className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2 font-medium">
                                <Search size={18} /> {loading ? 'Buscando...' : 'Buscar'}
                            </button>
                        </form>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700">Registros Encontrados ({searchResults.length})</h3>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                                    <tr>
                                        <th className="px-6 py-3">Cód. Exp.</th>
                                        <th className="px-6 py-3">ID Caja</th>
                                        <th className="px-6 py-3">Apertura</th>
                                        <th className="px-6 py-3">Código</th>
                                        <th className="px-6 py-3">Título</th>
                                        {[1,2,3,4,5,6,7,8].map(i => (
                                            <th key={i} className="px-6 py-3 whitespace-nowrap">Valor {i}</th>
                                        ))}
                                        <th className="px-6 py-3 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {searchResults.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                                                No hay registros. Realice una búsqueda para gestionar expedientes.
                                            </td>
                                        </tr>
                                    ) : (
                                        searchResults.map((exp) => (
                                            <tr key={exp.id} className="bg-white border-b hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium text-gray-900">{exp.expediente_code || '-'}</td>
                                                <td className="px-6 py-4">{exp.box_id || '-'}</td>
                                                <td className="px-6 py-4">{exp.opening_date?.split('T')[0] || '-'}</td>
                                                <td className="px-6 py-4">{exp.subserie || '-'}</td>
                                                <td className="px-6 py-4">{exp.title || '-'}</td>
                                                {[1,2,3,4,5,6,7,8].map(i => (
                                                    <td key={i} className="px-6 py-4 text-xs whitespace-nowrap">
                                                        {exp.metadata_values?.[`valor${i}`] || '-'}
                                                    </td>
                                                ))}
                                                <td className="px-6 py-4 text-center">
                                                    <button 
                                                        onClick={() => handleManage(exp)}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 mx-auto"
                                                    >
                                                       <Upload size={14} /> Gestionar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* DOCUMENTOS GUARDADOS */}
            {viewMode === 'search' && activeTab === 'guardados' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-700">Documentos Guardados ({savedDocs.length})</h3>
                        <div className="flex items-center gap-2">
                            {isAdmin && (
                                <button
                                    onClick={handleBackupPdf}
                                    disabled={backupLoading}
                                    title="Descargar copia de seguridad de todos los PDFs (.zip)"
                                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded shadow-sm transition-colors disabled:opacity-60"
                                >
                                    <Download size={13} />
                                    {backupLoading ? 'Generando...' : '💾 Copia de Seguridad PDF'}
                                </button>
                            )}
                            <button onClick={fetchSavedDocs} className="text-xs text-green-700 font-medium px-3 py-1.5 border border-green-200 rounded hover:bg-green-50">↻ Actualizar</button>
                        </div>
                    </div>
                    {loadingSaved ? (
                        <div className="p-8 text-center text-gray-400">Cargando...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-600">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                                    <tr>
                                        <th className="px-4 py-3">Archivo</th>
                                        <th className="px-4 py-3">Tipología</th>
                                        <th className="px-4 py-3">Expediente</th>
                                        <th className="px-4 py-3">Código</th>
                                        <th className="px-4 py-3">Fecha Doc.</th>
                                        <th className="px-4 py-3">Guardado</th>
                                        <th className="px-4 py-3">Ruta OneDrive</th>
                                        <th className="px-4 py-3">Soporte</th>
                                        <th className="px-4 py-3 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {savedDocs.length === 0 ? (
                                        <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-400">No hay documentos guardados aún.</td></tr>
                                    ) : (
                                        savedDocs.map(doc => (
                                            <tr key={doc.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 font-medium text-gray-800"><FileText size={13} className="inline text-red-500 mr-1" />{doc.filename}</td>
                                                <td className="px-4 py-3"><span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">{doc.typology_name || '-'}</span>
                                                    {doc.metadata_values && (() => {
                                                        try {
                                                            const meta = typeof doc.metadata_values === 'string' ? JSON.parse(doc.metadata_values) : doc.metadata_values;
                                                            if (meta && meta.description) {
                                                                return (
                                                                    <div className="text-[11px] text-gray-500 italic mt-1 max-w-[200px] truncate" title={meta.description}>
                                                                        📝 {meta.description}
                                                                    </div>
                                                                );
                                                            }
                                                        } catch(e) {}
                                                        return null;
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3"><div className="font-medium">{doc.expediente_title || '-'}</div><div className="text-xs text-gray-400">{doc.expediente_code}</div></td>
                                                <td className="px-4 py-3 text-xs">{doc.subserie || doc.subseries_name || '-'}</td>
                                                <td className="px-4 py-3 text-xs">{doc.document_date ? new Date(doc.document_date).toLocaleDateString('es-CO') : '-'}</td>
                                                <td className="px-4 py-3 text-xs text-gray-400">{doc.created_at ? new Date(doc.created_at).toLocaleString('es-CO') : '-'}</td>
                                                <td className="px-4 py-3 text-xs text-gray-600" style={{wordBreak:'break-all', minWidth:'250px'}}>
                                                    {doc.path
                                                        ? doc.path.replace(/\\/g, '/').split('/').slice(0, -1).join('/')
                                                        : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-bold text-green-700">{doc.origen || '-'}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <button 
                                                            onClick={() => handleView(doc)}
                                                            className="text-green-600 hover:text-green-800 p-1.5 bg-green-50 rounded-full border border-green-100 transition-colors"
                                                            title="Visualizar documento"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleEditDoc(doc)}
                                                            className="text-blue-600 hover:text-blue-800 p-1.5 bg-blue-50 rounded-full border border-blue-100 transition-colors"
                                                            title="Editar nombre/metadatos"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteDoc(doc)}
                                                            className="text-red-600 hover:text-red-800 p-1.5 bg-red-50 rounded-full border border-red-100 transition-colors"
                                                            title="Eliminar permanentemente"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* VISTA 2: INTERFAZ DE CARGA (GESTIONAR) */}
            {viewMode === 'upload' && selectedExpediente && (
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                    {/* Header */}
                    <div className="bg-green-50 p-4 border-b border-green-200 flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold text-green-900 flex items-center gap-2">
                                <FileText size={20} /> Gestionar Expediente: {selectedExpediente.title}
                                <button
                                    onClick={handleSummarizeExpediente}
                                    disabled={summaryLoading}
                                    className="ml-4 text-xs font-bold text-white bg-indigo-500 hover:bg-indigo-600 px-2 py-1 rounded flex items-center gap-1 transition-colors shadow-sm disabled:opacity-60"
                                >
                                    {summaryLoading ? 'Generando Resumen...' : '✨ Resumir con IA'}
                                </button>
                            </h2>
                            {expedienteSummary && (
                                <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-900 shadow-inner">
                                    <strong>✨ Resumen IA:</strong> {expedienteSummary}
                                </div>
                            )}
                            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-[11px] text-green-700 bg-white/60 p-3 rounded-lg border border-green-100 shadow-inner">
                                <div className="flex gap-2 border-b border-green-50 pb-1">
                                    <span className="font-bold uppercase opacity-60">Código Exp:</span>
                                    <span>{selectedExpediente.expediente_code || '-'}</span>
                                </div>
                                <div className="flex gap-2 border-b border-green-50 pb-1">
                                    <span className="font-bold uppercase opacity-60">Código:</span>
                                    <span>{selectedExpediente.subserie || '-'}</span>
                                </div>
                                <div className="flex gap-2 border-b border-green-50 pb-1">
                                    <span className="font-bold uppercase opacity-60">Caja:</span>
                                    <span>{selectedExpediente.box_id || '-'}</span>
                                </div>
                                <div className="flex gap-2 border-b border-green-50 pb-1">
                                    <span className="font-bold uppercase opacity-60">Apertura:</span>
                                    <span>{selectedExpediente.opening_date?.split('T')[0] || '-'}</span>
                                </div>
                                <div className="flex gap-2 border-b border-green-50 pb-1">
                                    <span className="font-bold uppercase opacity-60">Tipo Almac.:</span>
                                    <span>{selectedExpediente.storage_type || '-'}</span>
                                </div>
                                <div className="flex gap-2 border-b border-green-50 pb-1">
                                    <span className="font-bold uppercase opacity-60">Título:</span>
                                    <span className="truncate">{selectedExpediente.title || '-'}</span>
                                </div>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => {
                                    const key = `valor${i}`;
                                    const label = (selectedExpediente.metadata_labels && selectedExpediente.metadata_labels[key]) || `Valor ${i}`;
                                    const value = (selectedExpediente.metadata_values && selectedExpediente.metadata_values[key]) || '-';
                                    return (
                                        <div key={key} className="flex gap-2 border-b border-green-50 pb-1">
                                            <span className="font-bold uppercase opacity-60 truncate max-w-[80px]">{label}:</span>
                                            <span className={value === '-' ? 'text-gray-400 italic' : 'text-green-800'}>{value}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <button onClick={handleBack} className="text-gray-600 hover:text-gray-900 flex items-center gap-1 text-sm font-medium bg-white px-3 py-1.5 rounded border shadow-sm">
                            Volver a la lista
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {hybridStatus === null ? (
                            <div className="flex flex-col items-center justify-center p-12 bg-white border-2 border-gray-200 rounded-xl shadow-sm">
                                <h3 className="text-xl font-bold mb-6 text-gray-800 text-center">¿Este expediente es Híbrido?</h3>
                                <div className="flex gap-4">
                                    <button onClick={() => setHybridStatus('yes')} className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-sm transition-colors text-lg">Sí</button>
                                    <button onClick={() => setHybridStatus('no')} className="px-8 py-3 bg-gray-500 text-white rounded-lg font-bold hover:bg-gray-600 shadow-sm transition-colors text-lg">No</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* UPLOAD DROP ZONE - always visible */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="font-semibold text-gray-700">Archivos PDF <span className="text-green-700 font-bold">({files.length} seleccionado{files.length !== 1 ? 's' : ''})</span></label>
                                        <button onClick={() => setHybridStatus(null)} className="text-sm text-gray-500 hover:text-gray-800 underline">Cambiar estado híbrido</button>
                                    </div>
                            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-green-300 border-dashed rounded-lg cursor-pointer bg-green-50 hover:bg-green-100 transition-colors">
                                <div className="flex flex-col items-center justify-center py-4">
                                    <Upload className="w-10 h-10 text-green-500 mb-2" />
                                    <p className="text-base text-gray-700 font-medium">Click para agregar PDFs</p>
                                    <p className="text-sm text-gray-500">Puede seleccionar múltiples archivos a la vez</p>
                                </div>
                                <input type="file" className="hidden" accept="application/pdf" multiple onChange={onFileChange} />
                            </label>
                            <div className="flex gap-2 mt-2">
                                <button
                                    type="button"
                                    onClick={handleMockUpload}
                                    className="bg-green-700 hover:bg-green-800 text-white text-xs px-3.5 py-1.5 rounded-lg shadow-sm font-bold flex items-center gap-1.5 transition-colors"
                                >
                                    <span>✨ Cargar PDF de Prueba (Exposición)</span>
                                </button>
                            </div>
                        </div>

                        {/* FILE LIST + PREVIEW - Two column layout */}
                        {files.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px', alignItems: 'start' }}>
                                {/* LEFT: File List */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                            <Check className="text-green-600" /> {files.length} Archivo{files.length !== 1 ? 's' : ''}
                                        </h3>
                                        <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                            {selectedExpediente.subserie || 'Sin código'}
                                        </div>
                                    </div>

                                    <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                                        {files.map((entry, idx) => (
                                            <div
                                                key={entry.id || idx}
                                                className={`bg-white border-2 rounded-lg p-3 transition-all ${
                                                    previewIdx === idx
                                                        ? 'border-green-500 shadow-md bg-green-50'
                                                        : 'border-gray-200 hover:border-gray-300 shadow-sm'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0" onClick={() => setPreviewIdx(idx)}>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <p className="font-bold text-gray-800 text-xs truncate flex-1 cursor-pointer">
                                                                <FileText size={12} className="text-red-500 inline mr-1" />
                                                                {entry.file.name}
                                                            </p>
                                                            {(entry.file.type.startsWith('image/') || entry.file.name.toLowerCase().endsWith('.tif') || entry.file.name.toLowerCase().endsWith('.tiff')) && (
                                                                <span className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">To PDF</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] text-gray-400">{(entry.file.size / 1024).toFixed(0)} KB</span>
                                                            <label className="flex items-center gap-1 cursor-pointer select-none">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={entry.isSplit} 
                                                                    onChange={() => toggleSplit(idx)}
                                                                    className="w-3 h-3 text-green-600 rounded"
                                                                />
                                                                <span className="text-[10px] font-bold text-green-700 uppercase">Dividir</span>
                                                            </label>
                                                        </div>

                                                        <div className="mt-2 text-xs">
                                                            <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Fecha de Creación Documento</label>
                                                            <input 
                                                                type="datetime-local" 
                                                                className="w-full p-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-green-500 outline-none mb-2"
                                                                value={entry.creationDate}
                                                                onChange={(e) => updateFileDate(idx, e.target.value)}
                                                            />
                                                            {hybridStatus === 'yes' && (
                                                                <>
                                                                    <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Soporte Documento</label>
                                                                    <select 
                                                                        className="w-full p-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-green-500 outline-none mb-2 bg-gray-50"
                                                                        value={entry.origen}
                                                                        onChange={(e) => {
                                                                            setFiles(prev => prev.map((f, i) => i === idx ? { ...f, origen: e.target.value } : f));
                                                                        }}
                                                                    >
                                                        <option value="ELECTRONICO">ELECTRÓNICO</option>
                                                                        <option value="FISICO">FÍSICO</option>
                                                                    </select>
                                                                </>
                                                            )}
                                                        </div>
                                                            
                                                            {/* Single Mode */}
                                                            {!entry.isSplit && (
                                                                <div className="mt-2 space-y-2">
                                                                    <div>
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <label className="text-[10px] text-gray-400 font-bold uppercase">Tipología</label>
                                                                            {entry.file.type === 'application/pdf' && (
                                                                                <button 
                                                                                    type="button" 
                                                                                    onClick={(e) => { e.stopPropagation(); classifyFileWithAI(entry.id, entry.file); }}
                                                                                    disabled={entry.aiAnalysisStatus === 'loading'}
                                                                                    className="text-[9px] font-bold text-white bg-indigo-500 hover:bg-indigo-600 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors"
                                                                                >
                                                                                    {entry.aiAnalysisStatus === 'loading' ? 'Procesando...' : '✨ Sugerir IA'}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                        <select
                                                                            className={`w-full p-1.5 border rounded text-xs focus:ring-2 focus:ring-green-500 outline-none ${
                                                                                !entry.typologyId ? 'border-orange-300 bg-orange-50' : 'border-gray-300'
                                                                            }`}
                                                                            value={entry.typologyId}
                                                                            onChange={(e) => updateFileTypology(idx, e.target.value)}
                                                                        >
                                                                            <option value="">-- Tipología --</option>
                                                                            {typologies.map(t => (
                                                                                <option key={t.id} value={t.id}>{t.name}</option>
                                                                            ))}
                                                                        </select>

                                                                        {/* AI Analysis Suggestion & Validation Box */}
                                                                        {entry.aiAnalysisStatus === 'loading' && (
                                                                            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-[10px] text-blue-800 animate-pulse flex items-center gap-1.5 font-medium">
                                                                                <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                                                <span>Analizando documento con IA...</span>
                                                                            </div>
                                                                        )}
                                                                        {entry.aiAnalysisStatus === 'success' && (
                                                                            <div className="mt-2 p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-[10px] text-indigo-900 shadow-sm space-y-1">
                                                                                <div className="flex items-center justify-between">
                                                                                    <span className="font-bold text-indigo-800 flex items-center gap-1">✨ Análisis de IA</span>
                                                                                    <span className="bg-indigo-100 text-indigo-700 text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                                                                                        {entry.aiConfidence}% conf.
                                                                                    </span>
                                                                                </div>
                                                                                <div>
                                                                                    <span className="font-semibold text-gray-700">Sugerencia:</span>{" "}
                                                                                    <span className="font-bold text-indigo-900">{entry.aiSuggestedTypology}</span>
                                                                                </div>
                                                                                <div className="text-gray-600 italic leading-relaxed pt-0.5 border-t border-indigo-100/50">
                                                                                    "{entry.aiReason}"
                                                                                </div>
                                                                                <div className="text-[9px] text-green-700 font-bold flex items-center gap-1 pt-1">
                                                                                    <span>✓</span>
                                                                                    <span>Por favor, verifique y confirme la tipología seleccionada arriba.</span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        {entry.aiAnalysisStatus === 'error' && (
                                                                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-[10px] text-red-800 flex items-center gap-1 font-medium">
                                                                                <span>⚠️ Error al clasificar con IA.</span>
                                                                                <button 
                                                                                    type="button" 
                                                                                    onClick={(e) => { e.stopPropagation(); classifyFileWithAI(entry.id, entry.file); }}
                                                                                    className="text-red-700 underline font-bold hover:text-red-900 ml-auto"
                                                                                >
                                                                                    Reintentar
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                <div>
                                                                    <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">¿Se agregará un texto para el documento?</label>
                                                                    <select
                                                                        className="w-full p-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-green-500 outline-none bg-white"
                                                                        value={entry.addTextOption || 'no'}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            setFiles(prev => prev.map((f, i) => i === idx ? { ...f, addTextOption: val, documentText: val === 'si' ? (f.documentText || '') : '' } : f));
                                                                        }}
                                                                    >
                                                                        <option value="no">No</option>
                                                                        <option value="si">Sí</option>
                                                                    </select>
                                                                    {entry.addTextOption === 'si' && (
                                                                        <div className="mt-1.5 relative">
                                                                            <textarea
                                                                                className={`w-full p-1.5 border rounded text-xs focus:ring-2 focus:ring-green-500 outline-none bg-white transition-all ${
                                                                                    activeTextTarget && activeTextTarget.type === 'single' && activeTextTarget.fileIdx === idx
                                                                                        ? 'border-green-600 ring-2 ring-green-200'
                                                                                        : 'border-green-300'
                                                                                }`}
                                                                                rows="2"
                                                                                placeholder="Escriba el texto del documento aquí..."
                                                                                value={entry.documentText || ''}
                                                                                onFocus={() => setActiveTextTarget({ type: 'single', fileIdx: idx })}
                                                                                onChange={(e) => {
                                                                                    const txt = e.target.value;
                                                                                    setFiles(prev => prev.map((f, i) => i === idx ? { ...f, documentText: txt } : f));
                                                                                }}
                                                                            />
                                                                            {activeTextTarget && activeTextTarget.type === 'single' && activeTextTarget.fileIdx === idx && (
                                                                                <div className="absolute top-1 right-2 bg-green-600 text-white text-[9px] font-bold px-1 py-0.5 rounded shadow-sm">
                                                                                    Captura activa
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Split Mode */}
                                                        {entry.isSplit && (
                                                            <div className="mt-3 space-y-2 border-l-2 border-green-200 pl-2">
                                                                {entry.ranges.map((range, ridx) => (
                                                                    <div key={ridx} className="bg-white border rounded p-2 text-[10px] space-y-2 relative group">
                                                                        <div className="flex items-center gap-1">
                                                                            <input 
                                                                                type="number" 
                                                                                className="w-10 border rounded px-1" 
                                                                                value={range.start} 
                                                                                onChange={e => updateRange(idx, ridx, 'start', e.target.value)}
                                                                                placeholder="D"
                                                                            />
                                                                            <span>a</span>
                                                                            <input 
                                                                                type="number" 
                                                                                className="w-10 border rounded px-1" 
                                                                                value={range.end} 
                                                                                onChange={e => updateRange(idx, ridx, 'end', e.target.value)}
                                                                                placeholder="H"
                                                                            />
                                                                            <select
                                                                                className="flex-1 border rounded px-1"
                                                                                value={range.typologyId}
                                                                                onChange={e => updateRange(idx, ridx, 'typologyId', e.target.value)}
                                                                            >
                                                                                <option value="">Tipología...</option>
                                                                                {typologies.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                                            </select>
                                                                            {entry.ranges.length > 1 && (
                                                                                <button onClick={() => removeRange(idx, ridx)} className="text-red-400 hover:text-red-600 font-bold">×</button>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-[9px] text-gray-400 font-bold uppercase block mb-1">¿Agregar texto?</label>
                                                                            <select
                                                                                className="w-full p-1 border border-gray-300 rounded text-[9px] outline-none bg-white"
                                                                                value={range.addTextOption || 'no'}
                                                                                onChange={(e) => updateRange(idx, ridx, 'addTextOption', e.target.value)}
                                                                            >
                                                                                <option value="no">No</option>
                                                                                <option value="si">Sí</option>
                                                                            </select>
                                                                            {range.addTextOption === 'si' && (
                                                                                <div className="mt-1 relative">
                                                                                    <textarea
                                                                                        className={`w-full p-1 border rounded text-[9px] outline-none bg-white transition-all ${
                                                                                            activeTextTarget && activeTextTarget.type === 'split' && activeTextTarget.fileIdx === idx && activeTextTarget.rangeIdx === ridx
                                                                                                ? 'border-green-600 ring-1 ring-green-200'
                                                                                                : 'border-green-300'
                                                                                        }`}
                                                                                        rows="1"
                                                                                        placeholder="Texto del rango..."
                                                                                        value={range.documentText || ''}
                                                                                        onFocus={() => setActiveTextTarget({ type: 'split', fileIdx: idx, rangeIdx: ridx })}
                                                                                        onChange={(e) => updateRange(idx, ridx, 'documentText', e.target.value)}
                                                                                    />
                                                                                    {activeTextTarget && activeTextTarget.type === 'split' && activeTextTarget.fileIdx === idx && activeTextTarget.rangeIdx === ridx && (
                                                                                        <div className="absolute top-0.5 right-1.5 bg-green-600 text-white text-[8px] font-bold px-1 rounded shadow-sm">
                                                                                            Captura activa
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                <button 
                                                                    onClick={() => addRange(idx)}
                                                                    className="w-full py-1 text-[10px] bg-green-50 text-green-700 border border-green-200 border-dashed rounded hover:bg-green-100 font-bold"
                                                                >
                                                                    + Agregar rango
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded flex-shrink-0"
                                                        title="Quitar"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="pt-3 border-t border-gray-200 space-y-2">
                                        <button
                                            onClick={handleSave}
                                            disabled={loading}
                                            className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-bold shadow flex justify-center items-center gap-2"
                                        >
                                            {loading ? 'Procesando...' : <><Save size={18} /> Guardar {files.length} Archivo{files.length !== 1 ? 's' : ''}</>}
                                        </button>
                                        {status && <p className="text-center text-xs font-medium text-green-700 bg-green-50 p-2 rounded">{status}</p>}
                                    </div>
                                </div>

                                {/* RIGHT: PDF Preview */}
                                <div className="sticky top-4">
                                    {previewIdx !== null && files[previewIdx] ? (
                                        <div className="border-2 border-green-300 rounded-lg overflow-hidden shadow-lg bg-white">
                                            <div className="bg-green-50 border-b border-green-200 px-3 py-2 flex items-center justify-between">
                                                <span className="text-xs font-bold text-green-800 flex items-center gap-1">
                                                    <Eye size={13} /> Vista Previa — {files[previewIdx].file.name}
                                                </span>
                                                <span className="text-xs text-green-600">{previewIdx + 1} / {files.length}</span>
                                            </div>
                                            <CustomPdfViewer
                                                key={previewIdx}
                                                fileUrl={files[previewIdx].url}
                                                onTextExtracted={handleOcrTextExtracted}
                                                activeTargetName={getActiveTargetName()}
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-gray-400">
                                            <Eye size={40} className="mb-2 opacity-40" />
                                            <p className="text-sm">Haga clic en un archivo para ver la vista previa</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                            </>
                        )}
                    </div>
                </div>
            )}
            {/* MODAL EDICIÓN DOCUMENTO */}
            {editingDoc && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><Edit size={18} /> Editar Documento</h3>
                            <button onClick={() => setEditingDoc(null)} className="hover:rotate-90 transition-transform"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre del Archivo (Sin .pdf)</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={editingDoc.newFilename}
                                    onChange={(e) => setEditingDoc({...editingDoc, newFilename: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipología</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={editingDoc.newTypology}
                                    onChange={(e) => setEditingDoc({...editingDoc, newTypology: e.target.value})}
                                    list="typs-list"
                                />
                                <datalist id="typs-list">
                                    {typologies.map((t, idx) => <option key={idx} value={t.name} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha del Documento</label>
                                <input 
                                    type="datetime-local" 
                                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={editingDoc.newDate}
                                    onChange={(e) => setEditingDoc({...editingDoc, newDate: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Texto del Documento</label>
                                <div className="relative">
                                    <textarea 
                                        className={`w-full border rounded-lg p-3 text-sm focus:ring-2 outline-none transition-all ${
                                            activeTextTarget && activeTextTarget.type === 'edit'
                                                ? 'border-green-600 ring-2 ring-green-200 focus:ring-green-500'
                                                : 'border-gray-300 focus:ring-blue-500'
                                        }`}
                                        rows="3"
                                        placeholder="Texto adicional para el documento..."
                                        value={editingDoc.newDescription || ''}
                                        onFocus={() => setActiveTextTarget({ type: 'edit' })}
                                        onChange={(e) => setEditingDoc({...editingDoc, newDescription: e.target.value})}
                                    />
                                    {activeTextTarget && activeTextTarget.type === 'edit' && (
                                        <div className="absolute top-2 right-3 bg-green-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                                            Captura activa
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Soporte</label>
                                <select 
                                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold text-gray-700"
                                    value={editingDoc.newOrigen}
                                    onChange={(e) => setEditingDoc({...editingDoc, newOrigen: e.target.value})}
                                >
                                    <option value="ELECTRONICO">ELECTRÓNICO</option>
                                    <option value="FISICO">FÍSICO</option>
                                </select>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button 
                                    onClick={saveDocChanges}
                                    disabled={loading}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg"
                                >
                                    {loading ? 'Guardando...' : <><Save size={18} /> Guardar Cambios</>}
                                </button>
                                <button 
                                    onClick={() => setEditingDoc(null)}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DocumentManagement;

