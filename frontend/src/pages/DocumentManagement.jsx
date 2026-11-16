import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Search, Upload, FileText, Save, Eye, X, Check, Folder, Pencil, Edit, Trash2, Download, Share2, Plus, FileDown, CheckCircle2, Clock } from 'lucide-react';
import InventoryPdfModal from '../components/InventoryPdfModal';

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
        if (isOcrLoading || !containerRef.current) return;
        e.preventDefault(); // Previene la selección/arrastre nativo del navegador para dibujar el área
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        
        isSelectingRef.current = true;
        startCoordsRef.current = { x, y };
        setSelection({ x, y, width: 0, height: 0 });
    };

    const handleMouseMove = (e) => {
        if (!isSelectingRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const currentX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const currentY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        
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
        const activeTextTargetRef = useRef(null);

        useEffect(() => {
            activeTextTargetRef.current = activeTextTarget;
        }, [activeTextTarget]);

    // Merge mode states
    const [mergeMode, setMergeMode] = useState(false);
    const [mergedTypologyId, setMergedTypologyId] = useState('');
    const [mergedTypologyName, setMergedTypologyName] = useState('');
    const [mergedAssignedName, setMergedAssignedName] = useState('');
    const [mergedStage, setMergedStage] = useState('');
    const [mergedDate, setMergedDate] = useState('');
    const [mergedOrigen, setMergedOrigen] = useState('ELECTRONICO');
    const [mergedAddText, setMergedAddText] = useState('no');
    const [mergedText, setMergedText] = useState('');
    const [existingDocs, setExistingDocs] = useState([]);
    const [loadingExisting, setLoadingExisting] = useState(false);
    const [selectedStageFilter, setSelectedStageFilter] = useState('ALL');
    const [userAllowedStages, setUserAllowedStages] = useState(null);
    const [checklistTab, setChecklistTab] = useState('pendientes'); // 'pendientes' | 'cargados' | 'todas'
    const [checklistSearch, setChecklistSearch] = useState('');
    const [dragOverTypId, setDragOverTypId] = useState(null);
    const [showInventoryPdfModal, setShowInventoryPdfModal] = useState(false);
    const assistedInputRef = useRef(null);
    const assistedTargetTypRef = useRef(null);

    const moveFile = (index, direction) => {
        setFiles(prev => {
            const updated = [...prev];
            const targetIndex = index + direction;
            if (targetIndex >= 0 && targetIndex < updated.length) {
                const temp = updated[index];
                updated[index] = updated[targetIndex];
                updated[targetIndex] = temp;
                
                // Adjust preview index accordingly
                if (previewIdx === index) setPreviewIdx(targetIndex);
                else if (previewIdx === targetIndex) setPreviewIdx(index);
            }
            return updated;
        });
    };

    // Automatically set active text target when previewed file changes or text options change
    useEffect(() => {
        if (mergeMode) {
            if (mergedAddText === 'si') {
                setActiveTextTarget({ type: 'merged' });
            } else {
                setActiveTextTarget(null);
            }
            return;
        }

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
    }, [previewIdx, files[previewIdx]?.addTextOption, files[previewIdx]?.isSplit, mergeMode, mergedAddText]);

    const handleOcrTextExtracted = (extractedText) => {
        const currentTarget = activeTextTargetRef.current;
        if (!currentTarget) return;

        if (currentTarget.type === 'single') {
            const { fileIdx } = currentTarget;
            setFiles(prev => prev.map((f, i) => {
                if (i !== fileIdx) return f;
                const currentText = f.documentText || '';
                const newText = currentText ? `${currentText}\n${extractedText}` : extractedText;
                return { ...f, documentText: newText };
            }));
        } else if (currentTarget.type === 'split') {
            const { fileIdx, rangeIdx } = currentTarget;
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
        } else if (currentTarget.type === 'edit') {
            setEditingDoc(prev => {
                if (!prev) return null;
                const currentText = prev.newDescription || '';
                const newText = currentText ? `${currentText}\n${extractedText}` : extractedText;
                return { ...prev, newDescription: newText };
            });
        } else if (currentTarget.type === 'merged') {
            setMergedText(prev => prev ? `${prev}\n${extractedText}` : extractedText);
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
        if (activeTextTarget.type === 'merged') {
            return 'Texto de documento unido';
        }
        return null;
    };

    // Leer usuario actual del localStorage
    const currentUser = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';

    const [searchParams, setSearchParams] = useSearchParams();
    const initUrlFilter = searchParams.get('filter') || '';
    const initUrlTab = searchParams.get('tab') || '';
    const initUrlStatus = searchParams.get('status') || '';
    const initUrlScope = searchParams.get('scope') || '';
    const initUrlUserId = searchParams.get('user_id') || '';

    const [docFilter, setDocFilter] = useState(
        ['sin_documentos', 'con_documentos', 'todos'].includes(initUrlFilter) ? initUrlFilter : 'todos'
    );
    const [scopeFilter, setScopeFilter] = useState(
        initUrlScope === 'assigned' ? 'assigned' : (!isAdmin ? 'assigned' : 'global')
    );
    const [targetUserFilter, setTargetUserFilter] = useState(initUrlUserId || '');
    const [savedQuickFilter, setSavedQuickFilter] = useState(
        initUrlFilter === 'hoy' ? 'hoy' : (initUrlStatus === 'Pendiente' ? 'Pendiente' : (initUrlStatus === 'Cargado' ? 'Cargado' : 'todos'))
    );
    const [savedSearchTerm, setSavedSearchTerm] = useState('');
    const [editTypologies, setEditTypologies] = useState([]);
    const [editExpSearch, setEditExpSearch] = useState('');
    const [editExpResults, setEditExpResults] = useState([]);
    const [searchingEditExp, setSearchingEditExp] = useState(false);
    const [sharingDoc, setSharingDoc] = useState(null);
    const [shareSearchTerm, setShareSearchTerm] = useState('');
    const [shareSearchResults, setShareSearchResults] = useState([]);
    const [searchingShareExp, setSearchingShareExp] = useState(false);
    const [shareSelectedExps, setShareSelectedExps] = useState([]);
    const [shareLoading, setShareLoading] = useState(false);
    const [sharedInfoDoc, setSharedInfoDoc] = useState(null);
    const [sharedInfoList, setSharedInfoList] = useState([]);
    const [loadingSharedInfo, setLoadingSharedInfo] = useState(false);
    const searchDebounceRef = useRef(null);
    const savedSearchDebounceRef = useRef(null);
    const shareSearchDebounceRef = useRef(null);

    const fetchSavedDocs = async (overrideQuickFilter = savedQuickFilter, overrideScope = scopeFilter, overrideQ = savedSearchTerm) => {
        setLoadingSaved(true);
        try {
            const params = new URLSearchParams();
            if (overrideQuickFilter === 'hoy') params.set('filter', 'hoy');
            else if (overrideQuickFilter === 'Pendiente') params.set('status', 'Pendiente');
            else if (overrideQuickFilter === 'Cargado') params.set('status', 'Cargado');
            if (overrideScope === 'assigned') params.set('assigned_only', '1');
            if (overrideQ && overrideQ.trim()) params.set('q', overrideQ.trim());
            const qs = params.toString();
            const res = await axios.get(`/api/documents${qs ? `?${qs}` : ''}`);
            setSavedDocs(res.data.data || []);
        } catch (err) {
            console.error('Error fetching saved docs:', err);
        } finally {
            setLoadingSaved(false);
        }
    };

    const executeExpedienteSearch = async (termVal = searchTerm, dFilter = docFilter, sFilter = scopeFilter, uId = targetUserFilter) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('term', termVal || '');
            if (dFilter && dFilter !== 'todos') params.set('doc_filter', dFilter);
            if (sFilter === 'assigned') params.set('assigned_only', '1');
            if (uId) params.set('user_id', uId);
            const res = await axios.get(`/api/expedientes/search?${params.toString()}`);
            setSearchResults(res.data.data || []);
            setSelectedExpediente(null);
            setViewMode('search');
        } catch (err) {
            console.error('Error searching expedientes:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const uFilter = searchParams.get('filter') || '';
        const uTab = searchParams.get('tab') || '';
        const uStatus = searchParams.get('status') || '';
        const uScope = searchParams.get('scope') || '';
        const uUserId = searchParams.get('user_id') || '';
        const uExpId = searchParams.get('exp_id') || '';

        const effectiveScope = uScope === 'assigned' ? 'assigned' : (uScope === 'global' ? 'global' : (!isAdmin ? 'assigned' : 'global'));
        setScopeFilter(effectiveScope);
        setTargetUserFilter(uUserId);

        if (uExpId) {
            fetchSavedDocs('todos', effectiveScope, '');
            axios.get(`/api/expedientes/search?term=${encodeURIComponent(uExpId)}`)
                .then(res => {
                    const list = res.data.data || [];
                    setSearchResults(list);
                    const exact = list.find(e => String(e.id) === String(uExpId) || String(e.expediente_code) === String(uExpId)) || list[0];
                    if (exact) handleManage(exact);
                })
                .catch(err => console.error('Error opening exp_id:', err));
            return;
        }

        if (uTab === 'guardados') {
            setActiveTab('guardados');
            const qf = uFilter === 'hoy' ? 'hoy' : (uStatus === 'Pendiente' ? 'Pendiente' : (uStatus === 'Cargado' ? 'Cargado' : 'todos'));
            setSavedQuickFilter(qf);
            fetchSavedDocs(qf, effectiveScope, '');
        } else {
            setActiveTab('buscar');
            const df = ['sin_documentos', 'con_documentos', 'todos'].includes(uFilter) ? uFilter : 'todos';
            setDocFilter(df);
            fetchSavedDocs('todos', effectiveScope, '');
            if (!isAdmin || uFilter || uUserId || uScope) {
                executeExpedienteSearch(searchTerm, df, effectiveScope, uUserId);
            }
        }
    }, [searchParams]);

    // Search Expedientes
    const handleSearch = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        await executeExpedienteSearch(searchTerm, docFilter, scopeFilter, targetUserFilter);
    };

    const handleSearchInputChange = (val) => {
        setSearchTerm(val);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            if (!isAdmin || val.trim().length >= 2 || val.trim().length === 0) {
                if (isAdmin && val.trim().length === 0 && docFilter === 'todos' && !targetUserFilter && scopeFilter === 'global') {
                    return;
                }
                executeExpedienteSearch(val, docFilter, scopeFilter, targetUserFilter);
            }
        }, 350);
    };

    // Handle "Gestionar" Click
    const handleManage = async (exp) => {
        setSelectedExpediente(exp);
        setAssignments([]);
        setFiles([]);
        setStatus('');
        setHybridStatus(null);
        setMergeMode(false);
        const defaultDate = (() => {
            if (exp && exp.opening_date) {
                const od = exp.opening_date;
                if (od.includes('T')) return od.slice(0, 16);
                const datePart = od.split(' ')[0].split('T')[0];
                return `${datePart}T12:00`;
            }
            return new Date().toISOString().slice(0, 16);
        })();
        setMergedDate(defaultDate);
        setMergedTypologyId('');
        setMergedTypologyName('');
        setMergedAssignedName('');
        setMergedStage('');
        setMergedOrigen('ELECTRONICO');
        setMergedAddText('no');
        setMergedText('');
        setSelectedStageFilter('ALL');
        setUserAllowedStages(null);
        setChecklistTab('pendientes');
        setChecklistSearch('');
        
        // Fetch Typologies: matching by subseries code (exp.subserie now stores the code)
        try {
            let typologiesFound = [];
            let allowedStagesFound = null;

            // Try 1: search by subserie (stores the code)
            if (exp.subserie) {
                const res = await axios.get(`/api/trd/typologies-for-expediente?subserie=${encodeURIComponent(exp.subserie)}`);
                typologiesFound = res.data.data || [];
                allowedStagesFound = res.data.allowed_stages || null;
            }

            // Try 2: search by series name/code if subserie didn't yield results
            if (typologiesFound.length === 0 && exp.title) {
                const res = await axios.get(`/api/trd/typologies-for-expediente?subserie=${encodeURIComponent(exp.title)}`);
                typologiesFound = res.data.data || [];
                allowedStagesFound = res.data.allowed_stages || null;
            }

            // Try 3: get ALL typologies as fallback
            if (typologiesFound.length === 0) {
                const res = await axios.get(`/api/trd/all-typologies`);
                typologiesFound = res.data.data || [];
            }

            // Ensure trd_order is present on every typology
            const withOrder = typologiesFound.map((t, idx) => ({
                ...t,
                trd_order: t.trd_order || (idx + 1)
            }));

            setTypologies(withOrder);
            setUserAllowedStages(allowedStagesFound);
            if (Array.isArray(allowedStagesFound) && allowedStagesFound.length > 0) {
                setSelectedStageFilter(allowedStagesFound[0]);
            }
        } catch (err) {
            console.error("Error fetching typologies:", err);
            setTypologies([]);
        }
        
        fetchExistingDocs(exp.id);
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

    const handleEditDoc = async (doc) => {
        let currentDesc = '';
        if (doc.metadata_values) {
            try {
                const meta = typeof doc.metadata_values === 'string' ? JSON.parse(doc.metadata_values) : doc.metadata_values;
                currentDesc = meta.description || '';
            } catch(e) {}
        }

        const subCode = doc.subserie || selectedExpediente?.subserie || '';
        setEditExpSearch('');
        setEditExpResults([]);
        setEditingDoc({
            ...doc,
            newFilename: (doc.filename || '').replace(/\.pdf$/i, ''),
            customFilenameEdited: false,
            newTypology: doc.typology_name || '',
            newDate: doc.document_date ? doc.document_date.substring(0, 16) : new Date().toISOString().substring(0, 16),
            newOrigen: doc.origen || 'ELECTRONICO',
            newDescription: currentDesc,
            replacementFile: null,
            newExpedienteId: doc.expediente_id || selectedExpediente?.id || '',
            newExpedienteLabel: doc.expediente_title || selectedExpediente?.title || (doc.expediente_code ? `Exp. ${doc.expediente_code}` : ''),
            newExpedienteCode: doc.expediente_code || selectedExpediente?.expediente_code || '',
            showReassignExp: false,
            resetStatus: doc.status === 'Cargado',
            syncShared: Number(doc.shared_count || 1) > 1
        });

        try {
            let list = [];
            if (subCode) {
                const res = await axios.get(`/api/trd/typologies-for-expediente?subserie=${encodeURIComponent(subCode)}`);
                list = res.data.data || [];
            }
            if (list.length === 0 && typologies.length > 0) {
                list = typologies;
            }
            if (list.length === 0) {
                const resAll = await axios.get('/api/trd/all-typologies');
                list = resAll.data.data || [];
            }
            const withOrder = list.map((t, idx) => ({ ...t, trd_order: t.trd_order || (idx + 1) }));
            setEditTypologies(withOrder);
        } catch (err) {
            console.error('Error cargando tipologías para edición:', err);
            setEditTypologies(typologies || []);
        }
    };

    const searchTargetExpedientesForEdit = async (term) => {
        setEditExpSearch(term);
        if (!term || term.trim().length < 2) {
            setEditExpResults([]);
            return;
        }
        setSearchingEditExp(true);
        try {
            const res = await axios.get(`/api/expedientes/search?term=${encodeURIComponent(term.trim())}`);
            setEditExpResults((res.data.data || []).slice(0, 15));
        } catch (err) {
            console.error('Error buscando expediente destino:', err);
        } finally {
            setSearchingEditExp(false);
        }
    };

    const saveDocChanges = async () => {
        if (!editingDoc) return;
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('filename', editingDoc.newFilename || '');
            formData.append('custom_filename_override', editingDoc.customFilenameEdited ? 'true' : 'false');
            formData.append('typology_name', editingDoc.newTypology || '');
            formData.append('document_date', editingDoc.newDate || '');
            formData.append('origen', editingDoc.newOrigen || 'ELECTRONICO');
            formData.append('metadata_values', JSON.stringify({ description: editingDoc.newDescription || '' }));
            if (editingDoc.newExpedienteId) {
                formData.append('expediente_id', String(editingDoc.newExpedienteId));
            }
            if (editingDoc.status === 'Cargado') {
                formData.append('reset_status', editingDoc.resetStatus ? 'true' : 'false');
            }
            if (Number(editingDoc.shared_count || 1) > 1) {
                formData.append('sync_shared', editingDoc.syncShared ? 'true' : 'false');
            }
            if (editingDoc.replacementFile) {
                formData.append('file', editingDoc.replacementFile);
            }

            await axios.put(`/api/documents/${editingDoc.id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert("Documento actualizado correctamente");
            setEditingDoc(null);
            fetchSavedDocs(savedQuickFilter, scopeFilter, savedSearchTerm);
            if (selectedExpediente) fetchExistingDocs(selectedExpediente.id);
        } catch (err) {
            console.error(err);
            alert("Error al actualizar documento: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
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
        if (shareSearchDebounceRef.current) clearTimeout(shareSearchDebounceRef.current);
        if (!term || term.trim().length < 2) {
            setShareSearchResults([]);
            return;
        }
        shareSearchDebounceRef.current = setTimeout(async () => {
            setSearchingShareExp(true);
            try {
                const res = await axios.get(`/api/expedientes/search?term=${encodeURIComponent(term.trim())}`);
                setShareSearchResults((res.data.data || []).slice(0, 60));
            } catch (err) {
                console.error('Error buscando expedientes para compartir:', err);
            } finally {
                setSearchingShareExp(false);
            }
        }, 300);
    };

    const addShareTargetExp = (exp) => {
        if (!exp || Number(exp.id) === Number(sharingDoc?.expediente_id)) return;
        setShareSelectedExps(prev => prev.some(x => Number(x.id) === Number(exp.id)) ? prev : [...prev, exp]);
    };

    const addAllShareResults = () => {
        const currentExpId = Number(sharingDoc?.expediente_id || 0);
        setShareSelectedExps(prev => {
            const existingIds = new Set(prev.map(x => Number(x.id)));
            const added = shareSearchResults.filter(e => Number(e.id) !== currentExpId && !existingIds.has(Number(e.id)));
            return [...prev, ...added];
        });
    };

    const submitShareDocument = async () => {
        if (!sharingDoc || shareSelectedExps.length === 0) return;
        setShareLoading(true);
        try {
            const res = await axios.post(`/api/documents/${sharingDoc.id}/share`, {
                expediente_ids: shareSelectedExps.map(e => e.id),
                typology_name: sharingDoc.typology_name
            });
            const createdCount = res.data?.created_count || 0;
            const totalShared = res.data?.shared_count || (createdCount + 1);
            alert(`✅ Documento vinculado en ${createdCount} expediente(s) adicional(es) (Total relacionados: ${totalShared}).`);
            setSharingDoc(null);
            fetchSavedDocs(savedQuickFilter, scopeFilter, savedSearchTerm);
            if (selectedExpediente) fetchExistingDocs(selectedExpediente.id);
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
        } catch (err) {
            console.error('Error cargando expedientes relacionados:', err);
        } finally {
            setLoadingSharedInfo(false);
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

    const fetchExistingDocs = async (expId) => {
        setLoadingExisting(true);
        try {
            const res = await axios.get(`/api/documents/expediente/${expId}`);
            setExistingDocs(res.data.data || []);
        } catch (err) {
            console.error('Error fetching existing docs:', err);
        } finally {
            setLoadingExisting(false);
        }
    };

    const handleDeleteExistingDoc = async (doc) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente el archivo "${doc.filename}"? Esta acción borrará el archivo físico de OneDrive.`)) {
            return;
        }

        setLoading(true);
        try {
            await axios.delete(`/api/documents/${doc.id}`);
            alert("Documento eliminado correctamente");
            if (selectedExpediente) fetchExistingDocs(selectedExpediente.id);
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
                        const autoName = matchedTyp ? buildStandardDocName(matchedTyp) : entry.assignedName;
                        return {
                            ...entry,
                            aiAnalysisStatus: 'success',
                            aiSuggestedTypology: sugerencia,
                            aiConfidence: confianza,
                            aiReason: razon,
                            typologyId: matchedTyp ? matchedTyp.id : entry.typologyId,
                            typologyName: matchedTyp ? matchedTyp.name : entry.typologyName,
                            typologyStage: matchedTyp ? (matchedTyp.stage || '') : (entry.typologyStage || ''),
                            trdOrder: matchedTyp ? matchedTyp.trd_order : entry.trdOrder,
                            assignedName: autoName || ''
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
        const selectedFiles = Array.from(e.target.files || []).filter(f => {
            const ext = (f.name.split('.').pop() || '').toLowerCase();
            return allowedTypes.includes(f.type) || ['pdf', 'jpg', 'jpeg', 'png', 'tif', 'tiff'].includes(ext);
        });
        
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
            typologyStage: '',
            trdOrder: null,
            assignedName: '',
            creationDate: defaultDate,
            origen: 'ELECTRONICO',
            addTextOption: 'no',
            documentText: '',
            isSplit: false,
            selectedForMerge: true,
            ranges: [{ start: 1, end: 1, typologyId: '', typologyName: '', typologyStage: '', trdOrder: null, assignedName: '', creationDate: defaultDate, origen: 'ELECTRONICO', addTextOption: 'no', documentText: '' }],
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

    // Helper to compute standardized filename based on TRD order and existing docs in expediente
    const buildStandardDocName = (typ, extraOffset = 0) => {
        if (!typ || !typ.name) return '';
        const safeName = typ.name.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
        const orderNum = typ.trd_order || (typologies.findIndex(x => x.id == typ.id) + 1) || 99;
        const paddedOrder = String(orderNum).padStart(2, '0');
        const existingForTyp = (existingDocs || []).filter(
            d => (d.typology_name || '').trim().toUpperCase() === typ.name.trim().toUpperCase()
        ).length;
        const totalIndex = existingForTyp + 1 + extraOffset;
        if (totalIndex > 1) {
            return `${paddedOrder}_${safeName}_${totalIndex}`;
        }
        return `${paddedOrder}_${safeName}`;
    };

    const availableStages = (() => {
        const stages = [];
        typologies.forEach(t => {
            if (t.stage && !stages.includes(t.stage)) {
                if (!userAllowedStages || userAllowedStages.length === 0 || userAllowedStages.includes(t.stage)) {
                    stages.push(t.stage);
                }
            }
        });
        return stages;
    })();

    const getFilteredTypologies = () => {
        return typologies.filter(t => {
            if (userAllowedStages && userAllowedStages.length > 0 && t.stage && !userAllowedStages.includes(t.stage)) {
                return false;
            }
            if (selectedStageFilter !== 'ALL' && t.stage) {
                return t.stage === selectedStageFilter;
            }
            return true;
        });
    };

    const renderTypologyOptions = () => {
        const list = getFilteredTypologies();
        const hasStages = list.some(t => t.stage);
        if (selectedStageFilter === 'ALL' && hasStages) {
            const groups = {};
            const noStage = [];
            list.forEach(t => {
                if (t.stage) {
                    if (!groups[t.stage]) groups[t.stage] = [];
                    groups[t.stage].push(t);
                } else {
                    noStage.push(t);
                }
            });
            return (
                <>
                    {Object.entries(groups).map(([stageName, items]) => (
                        <optgroup key={stageName} label={`📌 Etapa: ${stageName}`}>
                            {items.map(t => (
                                <option key={t.id} value={t.id}>
                                    {String(t.trd_order || '').padStart(2, '0')}. {t.name}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                    {noStage.length > 0 && (
                        <optgroup label="Otras Tipologías">
                            {noStage.map(t => (
                                <option key={t.id} value={t.id}>
                                    {String(t.trd_order || '').padStart(2, '0')}. {t.name}
                                </option>
                            ))}
                        </optgroup>
                    )}
                </>
            );
        }
        return list.map(t => (
            <option key={t.id} value={t.id}>
                {t.trd_order ? `${String(t.trd_order).padStart(2, '0')}. ` : ''}{t.name}
            </option>
        ));
    };

    const normalizeTypKey = (s) =>
        String(s || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/^\d+[\s._-]*/, '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');

    const getDefaultExpedienteDate = () => {
        if (selectedExpediente && selectedExpediente.opening_date) {
            const od = selectedExpediente.opening_date;
            if (od.includes('T')) return od.slice(0, 16);
            const datePart = od.split(' ')[0].split('T')[0];
            return `${datePart}T12:00`;
        }
        return new Date().toISOString().slice(0, 16);
    };

    const addFilesForTypology = (rawFileList, typ) => {
        if (!typ) return;
        const allowedTypes = [
            'application/pdf',
            'image/jpeg', 'image/png', 'image/jpg',
            'image/tiff', 'image/x-tiff'
        ];
        const validFiles = Array.from(rawFileList || []).filter(f => {
            const ext = (f.name.split('.').pop() || '').toLowerCase();
            return allowedTypes.includes(f.type) || ['pdf', 'jpg', 'jpeg', 'png', 'tif', 'tiff'].includes(ext);
        });

        if (validFiles.length === 0) {
            alert('Por favor seleccione archivos PDF o imágenes (JPG, PNG, TIFF).');
            return;
        }

        if (hybridStatus === null) {
            const isPhysicalStorage = /fisic|hibrid/i.test(String(selectedExpediente?.storage_type || ''));
            setHybridStatus(isPhysicalStorage ? 'yes' : 'no');
        }

        const defaultDate = getDefaultExpedienteDate();
        const typKey = normalizeTypKey(typ.name);

        // Count how many files in current queue already use this typology
        const alreadyStagedCount = files.reduce((acc, f) => {
            if (!f.isSplit) {
                return acc + ((f.typologyId == typ.id || normalizeTypKey(f.typologyName) === typKey) ? 1 : 0);
            }
            return acc + (f.ranges || []).filter(r => r.typologyId == typ.id || normalizeTypKey(r.typologyName) === typKey).length;
        }, 0);

        const newEntries = validFiles.map((f, idxInBatch) => {
            const assigned = buildStandardDocName(typ, alreadyStagedCount + idxInBatch);
            return {
                id: Date.now() + Math.random() + idxInBatch,
                file: f,
                typologyId: typ.id,
                typologyName: typ.name,
                typologyStage: typ.stage || '',
                trdOrder: typ.trd_order || null,
                assignedName: assigned,
                creationDate: defaultDate,
                origen: 'ELECTRONICO',
                addTextOption: 'no',
                documentText: '',
                isSplit: false,
                selectedForMerge: true,
                ranges: [{
                    start: 1,
                    end: 1,
                    typologyId: typ.id,
                    typologyName: typ.name,
                    typologyStage: typ.stage || '',
                    trdOrder: typ.trd_order || null,
                    assignedName: assigned,
                    creationDate: defaultDate,
                    origen: 'ELECTRONICO',
                    addTextOption: 'no',
                    documentText: ''
                }],
                url: URL.createObjectURL(f),
                aiAnalysisStatus: 'idle',
                aiSuggestedTypology: '',
                aiConfidence: null,
                aiReason: ''
            };
        });

        const queueWasEmpty = files.length === 0;
        setFiles(prev => {
            const firstNewIdx = prev.length;
            const updated = [...prev, ...newEntries];
            setPreviewIdx(firstNewIdx);
            return updated;
        });

        // If queue was empty and user selected 2+ files for 1 specific typology, pre-enable merge into 1 PDF
        if (queueWasEmpty && newEntries.length >= 2) {
            setMergeMode(true);
            setMergedTypologyId(String(typ.id));
            setMergedTypologyName(typ.name);
            setMergedStage(typ.stage || '');
            setMergedAssignedName(buildStandardDocName(typ, 0));
            setMergedDate(defaultDate);
        }
    };

    const triggerAssistedUpload = (typ) => {
        assistedTargetTypRef.current = typ;
        if (assistedInputRef.current) {
            assistedInputRef.current.value = null;
            assistedInputRef.current.click();
        }
    };

    const handleAssistedInputChange = (e) => {
        const typ = assistedTargetTypRef.current;
        if (typ && e.target.files && e.target.files.length > 0) {
            addFilesForTypology(e.target.files, typ);
        }
        e.target.value = null;
    };

    const assignTypologyFromChecklist = (typ) => {
        if (!typ || files.length === 0) return;

        if (mergeMode) {
            setMergedTypologyId(String(typ.id));
            setMergedTypologyName(typ.name);
            setMergedStage(typ.stage || '');
            setMergedAssignedName(buildStandardDocName(typ, 0));
            return;
        }

        const targetIdx = (previewIdx !== null && files[previewIdx]) ? previewIdx : 0;
        const targetEntry = files[targetIdx];
        if (!targetEntry) return;

        if (targetEntry.isSplit) {
            const emptyRangeIdx = (targetEntry.ranges || []).findIndex(r => !r.typologyId && !r.typologyName);
            const rIdx = emptyRangeIdx !== -1 ? emptyRangeIdx : Math.max(0, (targetEntry.ranges || []).length - 1);
            updateRange(targetIdx, rIdx, 'typologyId', String(typ.id));
            return;
        }

        updateFileTypology(targetIdx, String(typ.id));

        // Auto-advance previewIdx to the next unclassified file in queue (if any)
        const nextUnclassified = files.findIndex((f, i) => i !== targetIdx && !f.isSplit && !f.typologyId && !f.typologyName);
        if (nextUnclassified !== -1) {
            setPreviewIdx(nextUnclassified);
        }
    };

    const renderPendingDocsChecklistPanel = () => {
        const filteredTyps = getFilteredTypologies();
        const enriched = filteredTyps.map((typ, idx) => {
            const tKey = normalizeTypKey(typ.name);
            const savedMatches = (existingDocs || []).filter(d => {
                const dKey = normalizeTypKey(d.typology_name);
                return (dKey && dKey === tKey) || (d.typology_name || '').trim().toUpperCase() === (typ.name || '').trim().toUpperCase();
            });

            let stagedMatches = 0;
            if (mergeMode && files.length >= 2) {
                if (String(mergedTypologyId) === String(typ.id) || (mergedTypologyName && normalizeTypKey(mergedTypologyName) === tKey)) {
                    stagedMatches = 1;
                }
            } else {
                stagedMatches = files.reduce((acc, f) => {
                    if (!f.isSplit) {
                        return acc + ((String(f.typologyId) === String(typ.id) || (f.typologyName && normalizeTypKey(f.typologyName) === tKey)) ? 1 : 0);
                    }
                    return acc + (f.ranges || []).filter(
                        r => String(r.typologyId) === String(typ.id) || (r.typologyName && normalizeTypKey(r.typologyName) === tKey)
                    ).length;
                }, 0);
            }

            const statusKind = savedMatches.length > 0 ? 'loaded' : (stagedMatches > 0 ? 'staged' : 'pending');
            return {
                ...typ,
                displayOrder: typ.trd_order || (idx + 1),
                savedMatches,
                stagedMatches,
                statusKind
            };
        });

        const totalCount = enriched.length;
        const loadedCount = enriched.filter(x => x.statusKind === 'loaded').length;
        const stagedCount = enriched.filter(x => x.statusKind === 'staged').length;
        const pendingOnlyCount = enriched.filter(x => x.statusKind === 'pending').length;
        const pendingTabCount = pendingOnlyCount + stagedCount;
        const pctLoaded = totalCount > 0 ? Math.round((loadedCount / totalCount) * 100) : 0;
        const pctWithStaged = totalCount > 0 ? Math.round(((loadedCount + stagedCount) / totalCount) * 100) : 0;

        const searchClean = normalizeTypKey(checklistSearch);
        const visibleRows = enriched.filter(item => {
            if (checklistTab === 'pendientes' && item.statusKind === 'loaded') return false;
            if (checklistTab === 'cargados' && item.statusKind !== 'loaded') return false;
            if (searchClean && !normalizeTypKey(item.name).includes(searchClean)) return false;
            return true;
        });

        const canAssignToActiveQueue = files.length > 0 && (mergeMode || (previewIdx !== null && Boolean(files[previewIdx])) || files.length > 0);
        const activeQueueLabel = mergeMode
            ? 'PDF Unido'
            : (previewIdx !== null && files[previewIdx] ? `#${previewIdx + 1}` : '#1');

        return (
            <div className="bg-white border-2 border-emerald-200 rounded-xl shadow-md overflow-hidden flex flex-col max-h-[820px]">
                <input
                    ref={assistedInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff"
                    multiple
                    className="hidden"
                    onChange={handleAssistedInputChange}
                />

                {/* Header */}
                <div className="bg-gradient-to-r from-[#00324D] to-[#0b4a6f] text-white p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <h3 className="text-sm font-extrabold flex items-center gap-1.5">
                                📋 Guía de Documentos del Expediente
                            </h3>
                            <p className="text-[11px] text-emerald-200 mt-0.5">
                                Asistente TRD: clic en <strong>⬆️ Cargar</strong> o arrastre el PDF sobre el pendiente
                            </p>
                        </div>
                        <span className="bg-white/15 border border-white/20 text-white text-[11px] font-black px-2 py-0.5 rounded-lg shrink-0">
                            {pctLoaded}%
                        </span>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1">
                        <div className="w-full h-2.5 bg-white/15 rounded-full overflow-hidden flex">
                            <div
                                className="h-full bg-[#39A900] transition-all duration-300"
                                style={{ width: `${pctLoaded}%` }}
                                title={`Guardados: ${loadedCount}`}
                            />
                            {stagedCount > 0 && (
                                <div
                                    className="h-full bg-sky-400 transition-all duration-300"
                                    style={{ width: `${Math.max(0, pctWithStaged - pctLoaded)}%` }}
                                    title={`En cola listos para guardar: ${stagedCount}`}
                                />
                            )}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-200 font-semibold">
                            <span>✅ {loadedCount} de {totalCount} tipologías guardadas</span>
                            {stagedCount > 0 ? (
                                <span className="text-sky-300 font-bold">+{stagedCount} en cola</span>
                            ) : (
                                <span>⏳ {pendingOnlyCount} faltantes</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stage filter chips inside panel when subserie has stages */}
                {availableStages.length > 0 && (
                    <div className="px-3 py-2 bg-indigo-50/70 border-b border-indigo-100 flex flex-wrap items-center gap-1">
                        <span className="text-[10px] font-bold text-indigo-900 mr-1">Etapa:</span>
                        {(!userAllowedStages || userAllowedStages.length === 0 || userAllowedStages.length > 1) && (
                            <button
                                type="button"
                                onClick={() => setSelectedStageFilter('ALL')}
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${
                                    selectedStageFilter === 'ALL'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-indigo-50'
                                }`}
                            >
                                Todas
                            </button>
                        )}
                        {availableStages.map(st => (
                            <button
                                key={st}
                                type="button"
                                onClick={() => setSelectedStageFilter(st)}
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${
                                    selectedStageFilter === st
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-indigo-50'
                                }`}
                            >
                                {st}
                            </button>
                        ))}
                    </div>
                )}

                {/* Tabs: Pendientes / Cargados / Todas */}
                <div className="grid grid-cols-3 gap-1 p-2 bg-gray-50 border-b border-gray-200 text-[11px] font-bold">
                    <button
                        type="button"
                        onClick={() => setChecklistTab('pendientes')}
                        className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
                            checklistTab === 'pendientes'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                    >
                        ⏳ Pendientes ({pendingTabCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setChecklistTab('cargados')}
                        className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
                            checklistTab === 'cargados'
                                ? 'bg-green-600 text-white shadow-sm'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                    >
                        ✅ Cargados ({loadedCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setChecklistTab('todas')}
                        className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
                            checklistTab === 'todas'
                                ? 'bg-[#00324D] text-white shadow-sm'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                    >
                        📋 Todas ({totalCount})
                    </button>
                </div>

                {/* Quick search when many typologies */}
                {totalCount > 5 && (
                    <div className="px-2.5 py-2 border-b border-gray-100 bg-white">
                        <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={checklistSearch}
                                onChange={(e) => setChecklistSearch(e.target.value)}
                                placeholder="Filtrar documento pendiente..."
                                className="w-full border border-gray-200 rounded-lg pl-7 pr-6 py-1 text-xs bg-gray-50 focus:bg-white focus:ring-1 focus:ring-green-500 outline-none"
                            />
                            {checklistSearch && (
                                <button
                                    type="button"
                                    onClick={() => setChecklistSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Active queue hint banner */}
                {canAssignToActiveQueue && (
                    <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-200 text-[10px] text-blue-900 font-semibold flex items-center justify-between gap-2">
                        <span>
                            💡 Archivo activo en cola (<strong>{activeQueueLabel}</strong>): use <strong>📌 Asignar</strong> para clasificarlo en 1 clic.
                        </span>
                    </div>
                )}

                {/* List of TRD Typologies */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                    {loadingExisting ? (
                        <div className="py-8 text-center text-xs text-gray-400">Verificando documentos del expediente...</div>
                    ) : totalCount === 0 ? (
                        <div className="py-8 text-center text-xs text-gray-400 px-3">
                            Esta subserie no tiene tipologías configuradas en la TRD.
                        </div>
                    ) : visibleRows.length === 0 ? (
                        <div className="py-8 px-3 text-center space-y-2">
                            {checklistTab === 'pendientes' && pendingTabCount === 0 ? (
                                <>
                                    <div className="text-2xl">🎉</div>
                                    <p className="text-xs font-bold text-green-800">
                                        ¡Excelente! Todas las tipologías de esta vista ya están cargadas en el expediente.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setChecklistTab('cargados')}
                                        className="text-[11px] font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-lg hover:bg-green-100"
                                    >
                                        Ver {loadedCount} documento(s) cargados
                                    </button>
                                </>
                            ) : (
                                <p className="text-xs text-gray-400 italic">No hay tipologías que coincidan con este filtro.</p>
                            )}
                        </div>
                    ) : (
                        visibleRows.map(item => {
                            const isDragTarget = dragOverTypId === item.id;
                            const paddedNum = String(item.displayOrder).padStart(2, '0');
                            return (
                                <div
                                    key={item.id}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        if (dragOverTypId !== item.id) setDragOverTypId(item.id);
                                    }}
                                    onDragLeave={() => setDragOverTypId(null)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setDragOverTypId(null);
                                        if (e.dataTransfer?.files?.length) {
                                            addFilesForTypology(e.dataTransfer.files, item);
                                        }
                                    }}
                                    className={`rounded-xl border p-2.5 transition-all ${
                                        isDragTarget
                                            ? 'border-2 border-dashed border-green-600 bg-green-50 ring-2 ring-green-200'
                                            : item.statusKind === 'loaded'
                                                ? 'border-green-200 bg-green-50/40 hover:bg-green-50/80'
                                                : item.statusKind === 'staged'
                                                    ? 'border-sky-300 bg-sky-50/70 shadow-sm'
                                                    : 'border-amber-200/90 bg-amber-50/30 hover:border-amber-300 hover:bg-amber-50/60'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                                    item.statusKind === 'loaded'
                                                        ? 'bg-green-600 text-white'
                                                        : item.statusKind === 'staged'
                                                            ? 'bg-sky-600 text-white'
                                                            : 'bg-amber-500 text-white'
                                                }`}>
                                                    #{paddedNum}
                                                </span>
                                                {item.stage && (
                                                    <span className="text-[9px] font-bold bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded-full">
                                                        {item.stage}
                                                    </span>
                                                )}
                                                {item.statusKind === 'loaded' && (
                                                    <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                                                        ✅ Cargado ({item.savedMatches.length})
                                                    </span>
                                                )}
                                                {item.statusKind === 'staged' && (
                                                    <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-1.5 py-0.5 rounded-full">
                                                        🟦 En cola ({item.stagedMatches}) · Falta Guardar
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs font-bold text-gray-800 mt-1 leading-snug">
                                                {item.name}
                                            </p>
                                            {isDragTarget && (
                                                <p className="text-[10px] font-extrabold text-green-700 mt-1">
                                                    📥 Suelte aquí el archivo para clasificarlo automáticamente
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Assisted Actions Row */}
                                    <div className="mt-2 pt-1.5 border-t border-black/5 flex flex-wrap items-center justify-between gap-1.5">
                                        <div className="flex flex-wrap items-center gap-1">
                                            {item.statusKind !== 'loaded' ? (
                                                <button
                                                    type="button"
                                                    onClick={() => triggerAssistedUpload(item)}
                                                    className="bg-[#39A900] hover:bg-green-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm transition-colors"
                                                    title={`Seleccionar PDF o imagen desde su PC para "${item.name}"`}
                                                >
                                                    <Upload size={12} /> Cargar
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => window.open(`/api/documents/file/${item.savedMatches[0].id}`, '_blank')}
                                                        className="bg-white hover:bg-green-100 text-green-800 border border-green-300 text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                                                        title={`Ver ${item.savedMatches[0].filename}`}
                                                    >
                                                        <Eye size={12} /> Ver
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => triggerAssistedUpload(item)}
                                                        className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                                                        title="Subir un anexo o segundo soporte de esta misma tipología"
                                                    >
                                                        <Plus size={11} /> Anexo
                                                    </button>
                                                </>
                                            )}

                                            {canAssignToActiveQueue && (
                                                <button
                                                    type="button"
                                                    onClick={() => assignTypologyFromChecklist(item)}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm transition-colors"
                                                    title={`Asignar "${item.name}" al archivo activo (${activeQueueLabel})`}
                                                >
                                                    📌 Asignar a {activeQueueLabel}
                                                </button>
                                            )}
                                        </div>

                                        {item.statusKind === 'loaded' && item.savedMatches[0]?.filename && (
                                            <span className="text-[10px] text-gray-500 truncate max-w-[130px]" title={item.savedMatches[0].filename}>
                                                {item.savedMatches[0].filename}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    };

    const updateFileTypology = (index, typologyId) => {
        const typ = typologies.find(t => t.id == typologyId);
        setFiles(prev => {
            // Count how many previous files in the current upload batch already selected this typology
            const sameTypBefore = typ
                ? prev.filter((f, idx) => idx !== index && !f.isSplit && f.typologyId == typologyId).length
                : 0;
            const autoName = typ ? buildStandardDocName(typ, sameTypBefore) : '';
            return prev.map((entry, i) =>
                i === index
                    ? {
                        ...entry,
                        typologyId,
                        typologyName: typ ? typ.name : '',
                        typologyStage: typ ? (typ.stage || '') : '',
                        trdOrder: typ ? typ.trd_order : null,
                        assignedName: autoName
                    }
                    : entry
            );
        });
    };

    const updateFileAssignedName = (index, newName) => {
        setFiles(prev => prev.map((entry, i) =>
            i === index ? { ...entry, assignedName: newName } : entry
        ));
    };

    const updateFileDate = (index, creationDate) => {
        setFiles(prev => prev.map((entry, i) => {
            if (i !== index) return entry;
            const oldDate = entry.creationDate;
            const updatedRanges = (entry.ranges || []).map(r => ({
                ...r,
                creationDate: (!r.creationDate || r.creationDate === oldDate) ? creationDate : r.creationDate
            }));
            return { ...entry, creationDate, ranges: updatedRanges };
        }));
    };

    const toggleSplit = (index) => {
        setFiles(prev => prev.map((entry, i) => {
            if (i !== index) return entry;
            const newIsSplit = !entry.isSplit;
            let ranges = entry.ranges;
            if (newIsSplit) {
                if (!ranges || ranges.length === 0) {
                    ranges = [{
                        start: 1,
                        end: 1,
                        typologyId: entry.typologyId || '',
                        typologyName: entry.typologyName || '',
                        typologyStage: entry.typologyStage || '',
                        trdOrder: entry.trdOrder || null,
                        assignedName: entry.assignedName || '',
                        creationDate: entry.creationDate || defaultDate,
                        origen: entry.origen || 'ELECTRONICO',
                        addTextOption: 'no',
                        documentText: ''
                    }];
                } else {
                    ranges = ranges.map((r, ri) => ({
                        ...r,
                        typologyId: r.typologyId || (ri === 0 ? (entry.typologyId || '') : ''),
                        typologyName: r.typologyName || (ri === 0 ? (entry.typologyName || '') : ''),
                        typologyStage: r.typologyStage || (ri === 0 ? (entry.typologyStage || '') : ''),
                        trdOrder: r.trdOrder || (ri === 0 ? (entry.trdOrder || null) : null),
                        assignedName: r.assignedName || (ri === 0 ? (entry.assignedName || '') : ''),
                        creationDate: r.creationDate || entry.creationDate || defaultDate,
                        origen: r.origen || entry.origen || 'ELECTRONICO'
                    }));
                }
            }
            return { ...entry, isSplit: newIsSplit, ranges };
        }));
    };

    const addRange = (fileIdx) => {
        setFiles(prev => prev.map((entry, i) => {
            if (i !== fileIdx) return entry;
            const lastRange = entry.ranges[entry.ranges.length - 1];
            const nextStart = lastRange ? (Number(lastRange.end) + 1 || 1) : 1;
            return {
                ...entry,
                ranges: [
                    ...entry.ranges,
                    {
                        start: nextStart,
                        end: nextStart,
                        typologyId: '',
                        typologyName: '',
                        typologyStage: '',
                        trdOrder: null,
                        assignedName: '',
                        creationDate: entry.creationDate || defaultDate,
                        origen: entry.origen || 'ELECTRONICO',
                        addTextOption: 'no',
                        documentText: ''
                    }
                ]
            };
        }));
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
                    updated.typologyStage = typ ? (typ.stage || '') : '';
                    updated.trdOrder = typ ? typ.trd_order : null;
                    const sameInRanges = typ
                        ? entry.ranges.filter((otherR, ori) => ori !== rangeIdx && otherR.typologyId == value).length
                        : 0;
                    updated.assignedName = typ ? buildStandardDocName(typ, sameInRanges) : '';
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

    // Submit / Save - sends each file individually or merges them
    const handleSave = async () => {
        if (files.length === 0 || !selectedExpediente) return;

        if (mergeMode) {
            const filesToMerge = files.filter(f => f.selectedForMerge !== false);
            if (filesToMerge.length < 2) {
                alert("Por favor seleccione al menos 2 archivos para unir.");
                return;
            }
            if (!mergedTypologyName) {
                alert("Por favor asigne una tipología para el documento unido.");
                return;
            }
            if (mergedAddText === 'si' && !mergedText?.trim()) {
                alert("Por favor escriba el texto del documento para el PDF unido.");
                return;
            }

            setLoading(true);
            setStatus("Uniendo y guardando archivos en un solo PDF...");

            const formData = new FormData();
            filesToMerge.forEach(f => {
                formData.append('files', f.file);
            });
            formData.append('expediente', JSON.stringify(selectedExpediente));
            formData.append('typology_name', mergedTypologyName);
            formData.append('custom_filename', mergedAssignedName || '');
            formData.append('document_date', mergedDate);
            formData.append('origen', hybridStatus === 'no' ? 'ELECTRONICO' : mergedOrigen);
            formData.append('description', mergedText);

            try {
                const token = localStorage.getItem('token');
                const res = await axios.post('/api/documents/merge-upload', formData, {
                    headers: { 
                        'Content-Type': 'multipart/form-data',
                        'Authorization': `Bearer ${token}`
                    }
                });
                setLoading(false);
                const pathMsg = res.data.storage_path ? `\nGuardado en: ${res.data.storage_path}` : '';
                setStatus(`¡Documentos unidos y guardados en OneDrive exitosamente!${pathMsg}`);
                setFiles([]);
                setPreviewIdx(null);
                setMergeMode(false);
                setMergedTypologyId('');
                setMergedTypologyName('');
                setMergedAssignedName('');
                setMergedStage('');
                setMergedAddText('no');
                setMergedText('');
                fetchSavedDocs();
                if (selectedExpediente) fetchExistingDocs(selectedExpediente.id);
            } catch (err) {
                setLoading(false);
                console.error(err);
                setStatus('Error al unir y guardar: ' + (err.response?.data?.error || err.message));
            }
            return;
        }

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
                    custom_filename: r.assignedName || '',
                    range: `${r.start}-${r.end}`,
                    description: r.addTextOption === 'si' ? r.documentText : '',
                    document_date: r.creationDate || entry.creationDate,
                    origen: hybridStatus === 'no' ? 'ELECTRONICO' : (r.origen || entry.origen || 'ELECTRONICO')
                }));
                formData.append('typology', JSON.stringify(typs));
            } else {
                formData.append('split', 'false');
                formData.append('typology', JSON.stringify([{
                    name: entry.typologyName,
                    custom_filename: entry.assignedName || '',
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
            fetchSavedDocs(savedQuickFilter, scopeFilter, savedSearchTerm);
            executeExpedienteSearch(searchTerm, docFilter, scopeFilter, targetUserFilter);
            if (selectedExpediente) fetchExistingDocs(selectedExpediente.id);
        } else {
            setStatus(`${successCount} guardados. Errores: ${errors.join(' | ')}`);
        }
    };

    return (
        <div className={`p-6 ${viewMode === 'upload' ? 'max-w-[1620px]' : 'max-w-7xl'} mx-auto space-y-6`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-green-800 flex items-center gap-2">
                    <Folder /> Gestión Documental
                </h1>
                <button
                    type="button"
                    onClick={() => setShowInventoryPdfModal(true)}
                    className="bg-[#00324D] hover:bg-[#00456b] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                >
                    <FileDown size={15} />
                    {isAdmin ? '📄 Descargar Inventario PDF por Usuario' : '📄 Descargar Mi Inventario PDF'}
                </button>
            </div>

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
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-3">
                        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                <input 
                                    type="text" 
                                    value={searchTerm}
                                    onChange={(e) => handleSearchInputChange(e.target.value)}
                                    placeholder="Escriba Cédula/TI, Nombre del Aprendiz, Ficha, Código de Expediente o Programa (búsqueda rápida)..." 
                                    className="w-full border border-gray-300 rounded-lg pl-10 pr-9 py-2.5 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchTerm('');
                                            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                                            executeExpedienteSearch('', docFilter, scopeFilter, targetUserFilter);
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                                        title="Limpiar búsqueda"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                            <button type="submit" disabled={loading} className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-bold shadow-sm transition-colors">
                                <Search size={18} /> {loading ? 'Buscando...' : 'Buscar'}
                            </button>
                        </form>

                        {/* Barra de Filtros Rápidos por Estado Documental */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">Filtrar expedientes:</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDocFilter('todos');
                                        executeExpedienteSearch(searchTerm, 'todos', scopeFilter, targetUserFilter);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                        docFilter === 'todos'
                                            ? 'bg-green-600 text-white border-green-600 shadow-sm'
                                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                    }`}
                                >
                                    📋 Todos los Expedientes
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDocFilter('sin_documentos');
                                        executeExpedienteSearch(searchTerm, 'sin_documentos', scopeFilter, targetUserFilter);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                        docFilter === 'sin_documentos'
                                            ? 'bg-orange-600 text-white border-orange-600 shadow-sm ring-2 ring-orange-200'
                                            : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
                                    }`}
                                >
                                    ⚠️ Sin Documentos (Pendientes por cargar)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDocFilter('con_documentos');
                                        executeExpedienteSearch(searchTerm, 'con_documentos', scopeFilter, targetUserFilter);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                        docFilter === 'con_documentos'
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                            : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                    }`}
                                >
                                    ✅ Con Documentos Cargados
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                {targetUserFilter && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                        👤 Filtrado por Funcionario (ID #{targetUserFilter})
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTargetUserFilter('');
                                                executeExpedienteSearch(searchTerm, docFilter, scopeFilter, '');
                                            }}
                                            className="ml-1 text-amber-900 hover:text-red-600 font-black"
                                            title="Quitar filtro de funcionario"
                                        >
                                            ✕
                                        </button>
                                    </span>
                                )}
                                <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setScopeFilter('assigned');
                                            executeExpedienteSearch(searchTerm, docFilter, 'assigned', targetUserFilter);
                                        }}
                                        className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                                            scopeFilter === 'assigned'
                                                ? 'bg-white text-green-700 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-800'
                                        }`}
                                    >
                                        👤 Asignados a mí
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setScopeFilter('global');
                                            executeExpedienteSearch(searchTerm, docFilter, 'global', targetUserFilter);
                                        }}
                                        className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                                            scopeFilter === 'global'
                                                ? 'bg-white text-green-700 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-800'
                                        }`}
                                    >
                                        🌐 Todos
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {docFilter === 'sin_documentos' && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3.5 flex items-center justify-between gap-3 text-orange-900 text-sm shadow-sm">
                            <div className="flex items-center gap-2.5">
                                <span className="text-lg">⚠️</span>
                                <div>
                                    <span className="font-bold">Expedientes pendientes por cargar documentos ({searchResults.length}):</span>{' '}
                                    Haga clic en el botón fijo <span className="font-bold text-orange-700">"⬆️ Cargar Docs"</span> a la izquierda de cada fila.
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b flex flex-wrap justify-between items-center gap-2 bg-gray-50">
                            <h3 className="font-bold text-gray-700">
                                Registros Encontrados ({searchResults.length})
                                {docFilter === 'sin_documentos' && <span className="ml-2 text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">Sin documentos</span>}
                                {docFilter === 'con_documentos' && <span className="ml-2 text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Con documentos</span>}
                            </h3>
                            <span className="text-xs text-gray-400">💡 El botón <strong>Gestionar</strong> está fijo al inicio de la fila (o haga doble clic en el expediente)</span>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-600">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 text-center sticky left-0 z-10 bg-gray-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">Acción</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Estado Docs</th>
                                        <th className="px-4 py-3 min-w-[320px]">Expediente y Metadatos Clave</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Cód. Exp.</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Subserie</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Apertura</th>
                                        <th className="px-4 py-3 whitespace-nowrap">ID Caja</th>
                                        {[1,2,3,4,5,6,7,8].map(i => (
                                            <th key={i} className="px-4 py-3 whitespace-nowrap">Valor {i}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {searchResults.length === 0 ? (
                                        <tr>
                                            <td colSpan="15" className="px-6 py-10 text-center text-gray-400">
                                                {loading
                                                    ? 'Buscando expedientes...'
                                                    : docFilter === 'sin_documentos'
                                                    ? '🎉 ¡Excelente! No hay expedientes pendientes por cargar documentos en esta vista.'
                                                    : 'No hay registros. Escriba arriba cualquier metadato (Cédula, Nombre, Ficha o Código) para buscar.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        searchResults.map((exp) => {
                                            const dCount = Number(exp.doc_count || 0);
                                            const metaBadges = [1,2,3,4,5,6,7,8]
                                                .map(i => exp.metadata_values?.[`valor${i}`])
                                                .filter(v => v && String(v).trim() !== '' && String(v).trim() !== '-');
                                            return (
                                            <tr
                                                key={exp.id}
                                                onDoubleClick={() => handleManage(exp)}
                                                className={`border-b transition-colors hover:bg-green-50/50 cursor-pointer ${dCount === 0 ? 'bg-orange-50/20' : 'bg-white'}`}
                                                title="Doble clic o clic en Gestionar para abrir este expediente"
                                            >
                                                <td className="px-3 py-3 text-center whitespace-nowrap sticky left-0 z-10 bg-white/95 backdrop-blur-sm shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]" onClick={(e) => e.stopPropagation()}>
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleManage(exp)}
                                                        className={`${dCount === 0 ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 mx-auto shadow-sm transition-all active:scale-95`}
                                                    >
                                                       <Upload size={14} /> {dCount === 0 ? 'Cargar Docs' : 'Gestionar'}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {dCount === 0 ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300">
                                                            ⚠️ 0 docs
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-300">
                                                            ✅ {dCount} doc(s)
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-gray-900 text-sm leading-snug">
                                                        {exp.title || exp.subseries_name || exp.series_name || '-'}
                                                    </div>
                                                    {metaBadges.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {metaBadges.slice(0, 5).map((val, idx) => (
                                                                <span key={idx} className="inline-block bg-gray-100 text-gray-700 border border-gray-200 rounded px-1.5 py-0.5 text-[11px] font-medium max-w-[220px] truncate" title={String(val)}>
                                                                    {String(val)}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{exp.expediente_code || `ID-${exp.id}`}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-xs">{exp.subserie || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-xs">{exp.opening_date?.split('T')[0] || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-xs">{exp.box_id || '-'}</td>
                                                {[1,2,3,4,5,6,7,8].map(i => (
                                                    <td key={i} className="px-4 py-3 text-xs whitespace-nowrap">
                                                        {exp.metadata_values?.[`valor${i}`] || '-'}
                                                    </td>
                                                ))}
                                            </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* DOCUMENTOS GUARDADOS */}
            {viewMode === 'search' && activeTab === 'guardados' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b space-y-3 bg-gray-50">
                        <div className="flex flex-wrap justify-between items-center gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-bold text-gray-700 mr-2">Documentos Guardados ({savedDocs.length})</h3>
                                {[
                                    { id: 'todos', label: '🗂️ Todos' },
                                    { id: 'hoy', label: '📅 Cargados Hoy' },
                                    { id: 'Pendiente', label: '⏳ Pendientes AES' },
                                    { id: 'Cargado', label: '✅ Cargados en AES' }
                                ].map(f => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => {
                                            setSavedQuickFilter(f.id);
                                            fetchSavedDocs(f.id, scopeFilter, savedSearchTerm);
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                                            savedQuickFilter === f.id
                                                ? 'bg-green-600 text-white border-green-600 shadow-sm'
                                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowInventoryPdfModal(true)}
                                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-[#00324D] hover:bg-[#00456b] text-white rounded shadow-sm transition-colors"
                                >
                                    <FileDown size={13} />
                                    {isAdmin ? '📄 Inventario PDF por Usuario' : '📄 Mi Inventario PDF'}
                                </button>
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
                                <button onClick={() => fetchSavedDocs(savedQuickFilter, scopeFilter, savedSearchTerm)} className="text-xs text-green-700 font-medium px-3 py-1.5 border border-green-200 rounded hover:bg-green-50">↻ Actualizar</button>
                            </div>
                        </div>

                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={savedSearchTerm}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSavedSearchTerm(val);
                                    if (savedSearchDebounceRef.current) clearTimeout(savedSearchDebounceRef.current);
                                    savedSearchDebounceRef.current = setTimeout(() => {
                                        fetchSavedDocs(savedQuickFilter, scopeFilter, val);
                                    }, 350);
                                }}
                                placeholder="Filtrar documentos guardados por archivo, aprendiz, cédula, ficha, tipología o código de expediente..."
                                className="w-full border border-gray-300 rounded-lg pl-9 pr-8 py-2 text-xs bg-white focus:ring-2 focus:ring-green-500 outline-none"
                            />
                            {savedSearchTerm && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSavedSearchTerm('');
                                        fetchSavedDocs(savedQuickFilter, scopeFilter, '');
                                    }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                    {loadingSaved ? (
                        <div className="p-8 text-center text-gray-400">Cargando...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-600">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                                    <tr>
                                        <th className="px-4 py-3 text-center sticky left-0 z-10 bg-gray-100">Acciones</th>
                                        <th className="px-4 py-3">Archivo</th>
                                        <th className="px-4 py-3">Tipología</th>
                                        <th className="px-4 py-3">Expediente</th>
                                        <th className="px-4 py-3">Código</th>
                                        <th className="px-4 py-3">Fecha Doc.</th>
                                        <th className="px-4 py-3">Guardado</th>
                                        <th className="px-4 py-3">Ruta OneDrive</th>
                                        <th className="px-4 py-3">Soporte</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {savedDocs.length === 0 ? (
                                        <tr><td colSpan="9" className="px-6 py-8 text-center text-gray-400">No hay documentos encontrados con este filtro.</td></tr>
                                    ) : (
                                        savedDocs.map(doc => (
                                            <tr key={doc.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-center sticky left-0 z-10 bg-white/95">
                                                    <div className="flex justify-center gap-1.5">
                                                        <button 
                                                            onClick={() => handleView(doc)}
                                                            className="text-green-600 hover:text-green-800 p-1.5 bg-green-50 rounded-lg border border-green-100 transition-colors"
                                                            title="Visualizar documento"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleEditDoc(doc)}
                                                            className="text-blue-600 hover:text-blue-800 px-2 py-1.5 bg-blue-50 rounded-lg border border-blue-200 transition-colors flex items-center gap-1 text-xs font-bold"
                                                            title="Editar datos o reemplazar archivo"
                                                        >
                                                            <Pencil size={13} /> Editar
                                                        </button>
                                                        <button 
                                                            onClick={() => openShareModal(doc)}
                                                            className="text-purple-700 hover:text-purple-900 px-2 py-1.5 bg-purple-50 rounded-lg border border-purple-200 transition-colors flex items-center gap-1 text-xs font-bold"
                                                            title="Compartir / relacionar este documento en otros expedientes"
                                                        >
                                                            <Share2 size={13} /> Compartir
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteDoc(doc)}
                                                            className="text-red-600 hover:text-red-800 p-1.5 bg-red-50 rounded-lg border border-red-100 transition-colors"
                                                            title="Eliminar permanentemente"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-medium text-gray-800">
                                                    <div><FileText size={13} className="inline text-red-500 mr-1" />{doc.filename}</div>
                                                    {Number(doc.shared_count || 1) > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openSharedInfoModal(doc)}
                                                            className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 hover:bg-purple-200 transition-colors"
                                                            title="Ver expedientes donde está relacionado este documento"
                                                        >
                                                            🔗 Relacionado en {doc.shared_count} expedientes
                                                        </button>
                                                    )}
                                                </td>
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

                    <div className="p-5 lg:p-6">
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                            {/* COLUMNA PRINCIPAL DE CARGUE (IZQUIERDA) */}
                            <div className="xl:col-span-8 space-y-6 min-w-0">
                        {hybridStatus === null ? (
                            <div className="flex flex-col items-center justify-center p-12 bg-white border-2 border-gray-200 rounded-xl shadow-sm">
                                <h3 className="text-xl font-bold mb-2 text-gray-800 text-center">¿Este expediente es Híbrido?</h3>
                                <p className="text-xs text-gray-500 mb-6 text-center max-w-md">
                                    Seleccione una opción o haga clic directamente en <strong>"⬆️ Cargar"</strong> sobre cualquiera de los documentos pendientes en el panel derecho.
                                </p>
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
                                        <label className="font-semibold text-gray-700">Archivos PDF / Imágenes <span className="text-green-700 font-bold">({files.length} seleccionado{files.length !== 1 ? 's' : ''})</span></label>
                                        <button onClick={() => setHybridStatus(null)} className="text-sm text-gray-500 hover:text-gray-800 underline">Cambiar estado híbrido</button>
                                    </div>
                            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-green-300 border-dashed rounded-lg cursor-pointer bg-green-50 hover:bg-green-100 transition-colors">
                                <div className="flex flex-col items-center justify-center py-4">
                                    <Upload className="w-10 h-10 text-green-500 mb-2" />
                                    <p className="text-base text-gray-700 font-medium">Click para agregar PDFs o Imágenes</p>
                                    <p className="text-sm text-gray-500">También puede usar el panel lateral de Documentos Pendientes para cargar y clasificar en 1 paso</p>
                                </div>
                                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff" multiple onChange={onFileChange} />
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

                            {/* Guía visual interactiva de operaciones con PDFs */}
                            <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl shadow-sm space-y-3">
                                <h4 className="text-sm font-bold text-green-900 flex items-center gap-1.5">
                                    💡 Guía Rápida de Operaciones:
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                    <div className="bg-white p-3.5 rounded-lg border border-green-100 shadow-sm">
                                        <span className="font-bold text-green-800 uppercase block mb-1.5">✂️ ¿Cómo Dividir un PDF?</span>
                                        <p className="text-gray-600 leading-relaxed">
                                            1. Sube tu archivo PDF.<br />
                                            2. En la lista de archivos, marca la casilla <strong className="text-green-700">"Dividir"</strong>.<br />
                                            3. Define los rangos de páginas (ej. de 1 a 1, de 2 a 5) y asígnales su tipología individual.
                                        </p>
                                    </div>
                                    <div className="bg-white p-3.5 rounded-lg border border-green-100 shadow-sm">
                                        <span className="font-bold text-emerald-800 uppercase block mb-1.5">🔗 ¿Cómo Unir varios PDFs?</span>
                                        <p className="text-gray-600 leading-relaxed">
                                            1. Selecciona y sube <strong className="text-green-700">2 o más archivos</strong>.<br />
                                            2. Marca la casilla verde <strong className="text-green-700">"Unir en 1 solo PDF"</strong> que aparecerá arriba de la lista.<br />
                                            3. Ordena los archivos con las flechas (▲/▼) y configura la tipología unificada para el nuevo documento.
                                        </p>
                                    </div>
                                </div>
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

                                    {/* Stage Filter Bar (Etapas de Historia Académica / TRD) */}
                                    {availableStages.length > 0 && (
                                        <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg p-2.5 space-y-1.5 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wide">
                                                    📌 Filtrar Tipologías por Etapa:
                                                </span>
                                                {userAllowedStages && userAllowedStages.length > 0 && (
                                                    <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-semibold">
                                                        Asignadas a su usuario
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {(!userAllowedStages || userAllowedStages.length === 0 || userAllowedStages.length > 1) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedStageFilter('ALL')}
                                                        className={`text-[10px] px-2 py-1 rounded-md font-bold border transition-all ${
                                                            selectedStageFilter === 'ALL'
                                                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-indigo-50'
                                                        }`}
                                                    >
                                                        Todas ({getFilteredTypologies().length})
                                                    </button>
                                                )}
                                                {availableStages.map(st => {
                                                    const count = typologies.filter(t => t.stage === st).length;
                                                    const isSelected = selectedStageFilter === st;
                                                    return (
                                                        <button
                                                            key={st}
                                                            type="button"
                                                            onClick={() => setSelectedStageFilter(st)}
                                                            className={`text-[10px] px-2 py-1 rounded-md font-bold border transition-all ${
                                                                isSelected
                                                                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-indigo-50'
                                                            }`}
                                                        >
                                                            {st} ({count})
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Toggle merge mode */}
                                    {files.length >= 2 && (
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 flex items-center justify-between shadow-sm">
                                            <label className="flex items-center gap-2 cursor-pointer select-none w-full">
                                                <input 
                                                    type="checkbox" 
                                                    checked={mergeMode} 
                                                    onChange={(e) => setMergeMode(e.target.checked)}
                                                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500 focus:ring-opacity-25"
                                                />
                                                <span className="text-xs font-bold text-green-800 uppercase">Unir en 1 solo PDF</span>
                                            </label>
                                        </div>
                                    )}

                                    {/* Merge mode configuration card */}
                                    {mergeMode && (
                                        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 space-y-3 shadow-sm">
                                            <h4 className="text-xs font-bold text-green-800 uppercase tracking-wide">Configuración PDF Unido</h4>
                                            <div>
                                                <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Fecha de Creación Documento</label>
                                                <input 
                                                    type="datetime-local" 
                                                    className="w-full p-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-green-500 outline-none bg-white"
                                                    value={mergedDate}
                                                    onChange={(e) => setMergedDate(e.target.value)}
                                                />
                                            </div>
                                            {hybridStatus === 'yes' && (
                                                <div>
                                                    <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Soporte Documento</label>
                                                    <select 
                                                        className="w-full p-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-green-500 outline-none bg-white font-bold"
                                                        value={mergedOrigen}
                                                        onChange={(e) => setMergedOrigen(e.target.value)}
                                                    >
                                                        <option value="ELECTRONICO">ELECTRÓNICO</option>
                                                        <option value="FISICO">FÍSICO</option>
                                                    </select>
                                                </div>
                                            )}
                                            <div>
                                                <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Tipología</label>
                                                <select
                                                    className={`w-full p-1.5 border rounded text-xs focus:ring-2 focus:ring-green-500 outline-none bg-white ${
                                                        !mergedTypologyId ? 'border-orange-300 bg-orange-50/50' : 'border-gray-300'
                                                    }`}
                                                    value={mergedTypologyId}
                                                    onChange={(e) => {
                                                        const id = e.target.value;
                                                        const typ = typologies.find(t => t.id == id);
                                                        setMergedTypologyId(id);
                                                        setMergedTypologyName(typ ? typ.name : '');
                                                        setMergedStage(typ ? (typ.stage || '') : '');
                                                        setMergedAssignedName(typ ? buildStandardDocName(typ, 0) : '');
                                                    }}
                                                >
                                                    <option value="">-- Seleccione Tipología --</option>
                                                    {renderTypologyOptions()}
                                                </select>
                                                {mergedTypologyName && (
                                                    <div className="mt-2 p-2 bg-white border border-green-300 rounded-md space-y-1.5">
                                                        <div className="flex items-center justify-between text-[10px]">
                                                            <span className="font-bold text-green-800">🏷️ Identificación y Nombre Asignado:</span>
                                                            {mergedStage && (
                                                                <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded-full font-bold text-[9px]">
                                                                    {mergedStage}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="text"
                                                                value={mergedAssignedName}
                                                                onChange={(e) => setMergedAssignedName(e.target.value)}
                                                                className="flex-1 p-1 border border-gray-300 rounded text-[11px] font-semibold text-gray-800 focus:ring-1 focus:ring-green-500 outline-none"
                                                                title="Nombre con el que se guardará el archivo PDF"
                                                            />
                                                            <span className="text-[10px] font-bold text-gray-500">.pdf</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">¿Se agregará un texto para el documento unido?</label>
                                                <select
                                                    className="w-full p-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-green-500 outline-none bg-white"
                                                    value={mergedAddText || 'no'}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setMergedAddText(val);
                                                        if (val !== 'si') setMergedText('');
                                                    }}
                                                >
                                                    <option value="no">No</option>
                                                    <option value="si">Sí</option>
                                                </select>
                                                {mergedAddText === 'si' && (
                                                    <div className="mt-1.5 relative">
                                                        <textarea
                                                            className={`w-full p-1.5 border rounded text-xs focus:ring-2 focus:ring-green-500 outline-none bg-white transition-all ${
                                                                activeTextTarget && activeTextTarget.type === 'merged'
                                                                    ? 'border-green-600 ring-2 ring-green-200'
                                                                    : 'border-green-300'
                                                            }`}
                                                            rows="3"
                                                            placeholder="Escriba o extraiga el texto del documento unido aquí..."
                                                            value={mergedText || ''}
                                                            onFocus={() => setActiveTextTarget({ type: 'merged' })}
                                                            onChange={(e) => setMergedText(e.target.value)}
                                                        />
                                                        {activeTextTarget && activeTextTarget.type === 'merged' && (
                                                            <div className="absolute top-1 right-2 bg-green-600 text-white text-[9px] font-bold px-1 py-0.5 rounded shadow-sm">
                                                                Captura activa
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                                        {files.map((entry, idx) => (
                                            <div
                                                key={entry.id || idx}
                                                className={`bg-white border-2 rounded-lg p-3 transition-all ${
                                                    previewIdx === idx
                                                        ? 'border-green-500 shadow-md bg-green-50'
                                                        : 'border-gray-200 hover:border-gray-300 shadow-sm'
                                                } ${mergeMode && entry.selectedForMerge === false ? 'opacity-40 bg-gray-50 border-dashed border-gray-300' : ''}`}
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
                                                            {!mergeMode && (
                                                                <label className="flex items-center gap-1 cursor-pointer select-none">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={entry.isSplit} 
                                                                        onChange={() => toggleSplit(idx)}
                                                                        className="w-3 h-3 text-green-600 rounded"
                                                                    />
                                                                    <span className="text-[10px] font-bold text-green-700 uppercase">Dividir</span>
                                                                </label>
                                                            )}
                                                            {mergeMode && (
                                                                <label className="flex items-center gap-1.5 cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={entry.selectedForMerge !== false} 
                                                                        onChange={(e) => {
                                                                            const checked = e.target.checked;
                                                                            setFiles(prev => prev.map((f, i) => i === idx ? { ...f, selectedForMerge: checked } : f));
                                                                        }}
                                                                        className="w-3.5 h-3.5 text-green-600 rounded focus:ring-green-500"
                                                                    />
                                                                    <span className="text-[10px] font-bold text-green-700 uppercase">Incluir</span>
                                                                </label>
                                                            )}
                                                        </div>

                                                        {!mergeMode && (
                                                            <div className="mt-2 text-xs">
                                                                <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">
                                                                    {entry.isSplit ? "Fecha de Creación Base (para los rangos)" : "Fecha de Creación Documento"}
                                                                </label>
                                                                <input 
                                                                    type="datetime-local" 
                                                                    className="w-full p-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-green-500 outline-none mb-2"
                                                                    value={entry.creationDate}
                                                                    onChange={(e) => updateFileDate(idx, e.target.value)}
                                                                />
                                                                {hybridStatus === 'yes' && !entry.isSplit && (
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
                                                        )}
                                                            
                                                        {/* Single Mode */}
                                                        {!mergeMode && !entry.isSplit && (
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
                                                                        <option value="">-- Seleccione Tipología --</option>
                                                                        {renderTypologyOptions()}
                                                                    </select>

                                                                    {/* Document Identification & Assigned Filename Box */}
                                                                    {entry.typologyName && (
                                                                        <div className="mt-2 p-2 bg-emerald-50/80 border border-emerald-200 rounded-md space-y-1.5">
                                                                            <div className="flex items-center justify-between text-[10px]">
                                                                                <span className="font-bold text-emerald-900">
                                                                                    🏷️ Nombre Asignado {entry.trdOrder ? `(TRD #${String(entry.trdOrder).padStart(2, '0')})` : ''}:
                                                                                </span>
                                                                                {entry.typologyStage && (
                                                                                    <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded-full font-bold text-[9px]">
                                                                                        {entry.typologyStage}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                                                <input
                                                                                    type="text"
                                                                                    value={entry.assignedName || ''}
                                                                                    onChange={(e) => updateFileAssignedName(idx, e.target.value)}
                                                                                    className="flex-1 p-1 border border-emerald-300 rounded text-[11px] font-semibold text-gray-800 bg-white focus:ring-1 focus:ring-green-500 outline-none"
                                                                                    title="Nombre con el que se identificará y guardará el documento"
                                                                                />
                                                                                <span className="text-[10px] font-bold text-gray-500">.pdf</span>
                                                                            </div>
                                                                        </div>
                                                                    )}

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
                                                        {!mergeMode && entry.isSplit && (
                                                            <div className="mt-3 space-y-2 border-l-2 border-green-200 pl-2">
                                                                {entry.ranges.map((range, ridx) => (
                                                                    <div key={ridx} className="bg-white border rounded p-2 text-[10px] space-y-2 relative group shadow-sm">
                                                                        <div className="flex items-center gap-1">
                                                                            <input 
                                                                                type="number" 
                                                                                className="w-10 border rounded px-1 text-center font-bold" 
                                                                                value={range.start} 
                                                                                onChange={e => updateRange(idx, ridx, 'start', e.target.value)}
                                                                                placeholder="D"
                                                                                title="Página inicial"
                                                                            />
                                                                            <span className="text-gray-500 font-medium">a</span>
                                                                            <input 
                                                                                type="number" 
                                                                                className="w-10 border rounded px-1 text-center font-bold" 
                                                                                value={range.end} 
                                                                                onChange={e => updateRange(idx, ridx, 'end', e.target.value)}
                                                                                placeholder="H"
                                                                                title="Página final"
                                                                            />
                                                                            <select
                                                                                className="flex-1 border rounded px-1 min-w-0"
                                                                                value={range.typologyId}
                                                                                onChange={e => updateRange(idx, ridx, 'typologyId', e.target.value)}
                                                                            >
                                                                                <option value="">Tipología...</option>
                                                                                {renderTypologyOptions()}
                                                                            </select>
                                                                            {entry.ranges.length > 1 && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => removeRange(idx, ridx)}
                                                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded flex-shrink-0 transition-colors"
                                                                                    title="Eliminar rango"
                                                                                >
                                                                                    <X size={12} />
                                                                                </button>
                                                                            )}
                                                                        </div>

                                                                        {range.typologyName && (
                                                                            <div className="p-1.5 bg-emerald-50/80 border border-emerald-200 rounded space-y-1">
                                                                                <div className="flex items-center justify-between text-[9px]">
                                                                                    <span className="font-bold text-emerald-900">
                                                                                        🏷️ Nombre {range.trdOrder ? `(#${String(range.trdOrder).padStart(2, '0')})` : ''}:
                                                                                    </span>
                                                                                    {range.typologyStage && (
                                                                                        <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded-full font-bold text-[8px]">
                                                                                            {range.typologyStage}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                                                    <input
                                                                                        type="text"
                                                                                        value={range.assignedName || ''}
                                                                                        onChange={e => updateRange(idx, ridx, 'assignedName', e.target.value)}
                                                                                        className="flex-1 p-1 border border-emerald-300 rounded text-[10px] font-semibold text-gray-800 bg-white outline-none"
                                                                                    />
                                                                                    <span className="text-[9px] font-bold text-gray-500">.pdf</span>
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        <div>
                                                                            <label className="text-[9px] text-gray-500 font-bold uppercase block mb-0.5">
                                                                                📅 Fecha Creación Documento
                                                                            </label>
                                                                            <input 
                                                                                type="datetime-local" 
                                                                                className="w-full p-1 border border-gray-300 rounded text-[10px] outline-none bg-white focus:ring-1 focus:ring-green-500"
                                                                                value={range.creationDate || entry.creationDate || defaultDate}
                                                                                onChange={e => updateRange(idx, ridx, 'creationDate', e.target.value)}
                                                                            />
                                                                        </div>

                                                                        {hybridStatus === 'yes' && (
                                                                            <div>
                                                                                <label className="text-[9px] text-gray-500 font-bold uppercase block mb-0.5">
                                                                                    Soporte
                                                                                </label>
                                                                                <select 
                                                                                    className="w-full p-1 border border-gray-300 rounded text-[9px] outline-none bg-gray-50 font-medium"
                                                                                    value={range.origen || entry.origen || 'ELECTRONICO'}
                                                                                    onChange={e => updateRange(idx, ridx, 'origen', e.target.value)}
                                                                                >
                                                                                    <option value="ELECTRONICO">ELECTRÓNICO</option>
                                                                                    <option value="FISICO">FÍSICO</option>
                                                                                </select>
                                                                            </div>
                                                                        )}

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
                                                                    type="button"
                                                                    onClick={() => addRange(idx)}
                                                                    className="w-full py-1 text-[10px] bg-green-50 text-green-700 border border-green-200 border-dashed rounded hover:bg-green-100 font-bold transition-colors"
                                                                >
                                                                    + Agregar rango
                                                                </button>
                                                            </div>
                                                        )}

                                                        {/* Reordering Controls in Merge Mode */}
                                                        {mergeMode && (
                                                            <div className="flex items-center gap-1.5 mt-2 bg-gray-50 border border-gray-200 rounded p-1">
                                                                <span className="text-[10px] font-bold text-gray-500 uppercase flex-1">Orden:</span>
                                                                <button
                                                                    type="button"
                                                                    disabled={idx === 0}
                                                                    onClick={(e) => { e.stopPropagation(); moveFile(idx, -1); }}
                                                                    className="px-2 py-0.5 text-xs bg-white hover:bg-gray-100 border rounded font-bold disabled:opacity-50"
                                                                    title="Subir orden"
                                                                >
                                                                    ▲
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={idx === files.length - 1}
                                                                    onClick={(e) => { e.stopPropagation(); moveFile(idx, 1); }}
                                                                    className="px-2 py-0.5 text-xs bg-white hover:bg-gray-100 border rounded font-bold disabled:opacity-50"
                                                                    title="Bajar orden"
                                                                >
                                                                    ▼
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
                                            {loading ? 'Procesando...' : <><Save size={18} /> Guardar {mergeMode ? files.filter(f => f.selectedForMerge !== false).length : files.length} Archivo{(mergeMode ? files.filter(f => f.selectedForMerge !== false).length : files.length) !== 1 ? 's' : ''}</>}
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

                            {/* Documentos Existentes en el Expediente */}
                                <div className="mt-8 pt-6 border-t border-gray-200">
                                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-1.5">
                                        📁 Documentos ya guardados en este expediente ({existingDocs.length})
                                    </h3>
                                    {loadingExisting ? (
                                        <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                                            <div className="w-3.5 h-3.5 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span>Cargando documentos guardados...</span>
                                        </div>
                                    ) : existingDocs.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic py-2">No hay documentos guardados en este expediente aún.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[300px] overflow-y-auto pr-1">
                                            {existingDocs.map((doc) => (
                                                <div 
                                                    key={doc.id} 
                                                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 hover:shadow-sm transition-all"
                                                >
                                                    <div className="flex-1 min-w-0 pr-3">
                                                        <p className="text-xs font-bold text-gray-800 truncate" title={doc.filename}>
                                                            📄 {doc.filename}
                                                        </p>
                                                        <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                                                            <span className="bg-green-100 text-green-800 px-1.5 py-0.2 rounded-full font-semibold mr-1.5">
                                                                {doc.typology_name || 'Sin tipología'}
                                                            </span>
                                                            {doc.origen}
                                                        </p>
                                                        {Number(doc.shared_count || 1) > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openSharedInfoModal(doc)}
                                                                className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 hover:bg-purple-200 transition-colors"
                                                                title="Ver expedientes vinculados a este documento"
                                                            >
                                                                🔗 {doc.shared_count} exps
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => window.open(`/api/documents/file/${doc.id}`, '_blank')}
                                                            className="p-1.5 text-green-700 hover:bg-green-50 border border-transparent hover:border-green-200 rounded-lg transition-colors"
                                                            title="Ver PDF"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEditDoc(doc)}
                                                            className="px-2 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-1"
                                                            title="Editar datos o reemplazar archivo"
                                                        >
                                                            <Pencil size={12} /> Editar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => openShareModal(doc)}
                                                            className="px-2 py-1 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center gap-1"
                                                            title="Compartir / relacionar en otros expedientes"
                                                        >
                                                            <Share2 size={12} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteExistingDoc(doc)}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg transition-colors"
                                                            title="Eliminar permanentemente"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                            </div>

                            {/* PANEL LATERAL DERECHO: DOCUMENTOS PENDIENTES POR CARGAR (ASISTENTE TRD) */}
                            <div className="xl:col-span-4 xl:sticky xl:top-4">
                                {renderPendingDocsChecklistPanel()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* MODAL EDICIÓN DOCUMENTO COMPLETO */}
            {editingDoc && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
                        <div className="bg-blue-600 p-4 text-white flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-bold flex items-center gap-2"><Edit size={18} /> Editar Datos o Reemplazar Archivo</h3>
                                <p className="text-[11px] text-blue-100 mt-0.5 truncate max-w-[380px]">
                                    Actual: {editingDoc.filename}
                                </p>
                            </div>
                            <button onClick={() => setEditingDoc(null)} className="hover:rotate-90 transition-transform"><X size={20} /></button>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto">
                            {/* 1. Tipología Documental TRD */}
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Tipología Documental (TRD)</label>
                                {editTypologies.length > 0 ? (
                                    <select
                                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
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
                                                {String(t.trd_order || idx + 1).padStart(2, '0')} - {t.name}{t.stage ? ` [${t.stage}]` : ''}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input 
                                        type="text" 
                                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={editingDoc.newTypology}
                                        onChange={(e) => setEditingDoc({...editingDoc, newTypology: e.target.value})}
                                    />
                                )}
                            </div>

                            {/* 2. Reemplazar archivo físico si cargaron el archivo equivocado */}
                            <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-amber-900 uppercase flex items-center gap-1.5">
                                        <Upload size={14} /> ¿Cargó el archivo equivocado? Reemplazar PDF/Imagen
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => window.open(`/api/documents/file/${editingDoc.id}`, '_blank')}
                                        className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                        <Eye size={12} /> Ver actual
                                    </button>
                                </div>
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0] || null;
                                        setEditingDoc({ ...editingDoc, replacementFile: f });
                                    }}
                                    className="block w-full text-xs text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-amber-600 file:text-white hover:file:bg-amber-700 cursor-pointer"
                                />
                                {editingDoc.replacementFile && (
                                    <p className="text-[11px] text-green-700 font-semibold">
                                        ✅ Nuevo archivo listo para reemplazar: {editingDoc.replacementFile.name}
                                    </p>
                                )}
                            </div>

                            {/* 3. Reasignar de Expediente si se subió al expediente equivocado */}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-xs">
                                        <span className="font-bold text-gray-600 uppercase block">Expediente Asociado</span>
                                        <span className="font-semibold text-gray-900">
                                            {editingDoc.newExpedienteLabel || `ID #${editingDoc.newExpedienteId}`}
                                            {editingDoc.newExpedienteCode ? ` (${editingDoc.newExpedienteCode})` : ''}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEditingDoc({ ...editingDoc, showReassignExp: !editingDoc.showReassignExp })}
                                        className="text-xs font-bold text-blue-600 hover:text-blue-800 px-2.5 py-1 bg-white border border-blue-200 rounded-md shadow-sm"
                                    >
                                        {editingDoc.showReassignExp ? 'Ocultar buscador' : '🔄 Cambiar expediente'}
                                    </button>
                                </div>
                                {editingDoc.showReassignExp && (
                                    <div className="space-y-2 pt-1 border-t border-gray-200">
                                        <input
                                            type="text"
                                            value={editExpSearch}
                                            onChange={(e) => searchTargetExpedientesForEdit(e.target.value)}
                                            placeholder="Buscar expediente correcto por Cédula, Nombre, Ficha o Código..."
                                            className="w-full border border-blue-300 rounded-lg p-2 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        {searchingEditExp && <p className="text-[11px] text-gray-400">Buscando expedientes...</p>}
                                        {editExpResults.length > 0 && (
                                            <div className="max-h-36 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white">
                                                {editExpResults.map(exp => (
                                                    <button
                                                        key={exp.id}
                                                        type="button"
                                                        onClick={async () => {
                                                            setEditingDoc(prev => ({
                                                                ...prev,
                                                                newExpedienteId: exp.id,
                                                                newExpedienteLabel: exp.title || exp.subseries_name || `ID #${exp.id}`,
                                                                newExpedienteCode: exp.expediente_code || '',
                                                                showReassignExp: false
                                                            }));
                                                            if (exp.subserie) {
                                                                try {
                                                                    const r = await axios.get(`/api/trd/typologies-for-expediente?subserie=${encodeURIComponent(exp.subserie)}`);
                                                                    if (r.data?.data?.length) {
                                                                        setEditTypologies(r.data.data.map((t, i) => ({ ...t, trd_order: t.trd_order || i + 1 })));
                                                                    }
                                                                } catch (_) {}
                                                            }
                                                        }}
                                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs transition-colors"
                                                    >
                                                        <div className="font-bold text-gray-800">{exp.title}</div>
                                                        <div className="text-[10px] text-gray-500">
                                                            {exp.expediente_code || `ID-${exp.id}`} · {exp.subserie || ''}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha del Documento</label>
                                    <input 
                                        type="datetime-local" 
                                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={editingDoc.newDate}
                                        onChange={(e) => setEditingDoc({...editingDoc, newDate: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Soporte</label>
                                    <select 
                                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold text-gray-700"
                                        value={editingDoc.newOrigen}
                                        onChange={(e) => setEditingDoc({...editingDoc, newOrigen: e.target.value})}
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
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={editingDoc.newFilename}
                                    onChange={(e) => setEditingDoc({...editingDoc, newFilename: e.target.value, customFilenameEdited: true})}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Texto / Descripción del Documento</label>
                                <div className="relative">
                                    <textarea 
                                        className={`w-full border rounded-lg p-2.5 text-sm focus:ring-2 outline-none transition-all ${
                                            activeTextTarget && activeTextTarget.type === 'edit'
                                                ? 'border-green-600 ring-2 ring-green-200 focus:ring-green-500'
                                                : 'border-gray-300 focus:ring-blue-500'
                                        }`}
                                        rows="2"
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

                            {editingDoc.status === 'Cargado' && (
                                <label className="flex items-center gap-2 text-xs text-blue-900 bg-blue-50 border border-blue-200 rounded-lg p-2.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(editingDoc.resetStatus)}
                                        onChange={(e) => setEditingDoc({ ...editingDoc, resetStatus: e.target.checked })}
                                        className="rounded text-blue-600"
                                    />
                                    <span>Dejar en estado <strong>Pendiente</strong> para actualizar en OnBase / AES</span>
                                </label>
                            )}

                            {Number(editingDoc.shared_count || 1) > 1 && (
                                <label className="flex items-center gap-2 text-xs text-purple-900 bg-purple-50 border border-purple-200 rounded-lg p-2.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(editingDoc.syncShared)}
                                        onChange={(e) => setEditingDoc({ ...editingDoc, syncShared: e.target.checked })}
                                        className="rounded text-purple-600"
                                    />
                                    <span>🔗 Sincronizar cambios también en los <strong>{editingDoc.shared_count} expedientes</strong> donde está relacionado este documento</span>
                                </label>
                            )}

                            <div className="pt-2 flex gap-3">
                                <button 
                                    onClick={saveDocChanges}
                                    disabled={loading}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg"
                                >
                                    {loading ? 'Guardando...' : <><Save size={18} /> Guardar Cambios</>}
                                </button>
                                <button 
                                    onClick={() => setEditingDoc(null)}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL COMPARTIR / VINCULAR DOCUMENTO EN OTROS EXPEDIENTES */}
            {sharingDoc && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[105] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="bg-purple-700 p-4 text-white flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-bold flex items-center gap-2"><Share2 size={18} /> Compartir y Relacionar en Otros Expedientes</h3>
                                <p className="text-xs text-purple-200 mt-0.5 truncate max-w-[450px]">
                                    Documento: {sharingDoc.filename} ({sharingDoc.typology_name || 'Sin tipología'})
                                </p>
                            </div>
                            <button onClick={() => setSharingDoc(null)} className="hover:rotate-90 transition-transform"><X size={20} /></button>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto">
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-900">
                                Este documento quedará <strong>relacionado</strong> en los expedientes que seleccione sin duplicar espacio en disco, manteniendo su numeración TRD oficial e independencia de cargue en OnBase/AES por cada expediente.
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                                    Buscar Expedientes Destino (por Cédula/TI, Nombre, Ficha o Código)
                                </label>
                                <div className="relative">
                                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={shareSearchTerm}
                                        onChange={(e) => handleShareSearchChange(e.target.value)}
                                        placeholder="Ej: número de Ficha para compartir a todo un grupo, o cédula/nombre..."
                                        className="w-full border border-purple-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                            </div>

                            {searchingShareExp && <p className="text-xs text-gray-400">Buscando expedientes...</p>}

                            {shareSearchResults.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-gray-600">{shareSearchResults.length} resultado(s) encontrados</span>
                                        {shareSearchResults.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={addAllShareResults}
                                                className="text-xs font-bold text-purple-700 bg-purple-100 hover:bg-purple-200 px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors"
                                            >
                                                <Plus size={13} /> Agregar los {shareSearchResults.length} expedientes encontrados
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-44 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg bg-gray-50/50">
                                        {shareSearchResults.map(exp => {
                                            const isSource = Number(exp.id) === Number(sharingDoc.expediente_id);
                                            const isAdded = shareSelectedExps.some(x => Number(x.id) === Number(exp.id));
                                            return (
                                                <div key={exp.id} className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-white text-xs">
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-gray-800 truncate">{exp.title}</div>
                                                        <div className="text-[10px] text-gray-500 truncate">
                                                            {exp.expediente_code || `ID-${exp.id}`} · {exp.subserie || ''}
                                                        </div>
                                                    </div>
                                                    {isSource ? (
                                                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Origen</span>
                                                    ) : isAdded ? (
                                                        <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded flex items-center gap-1"><Check size={11} /> Seleccionado</span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => addShareTargetExp(exp)}
                                                            className="bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1 rounded font-bold text-[11px] shrink-0"
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

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold text-gray-700 uppercase">
                                        Expedientes Seleccionados para Vincular ({shareSelectedExps.length})
                                    </label>
                                    {shareSelectedExps.length > 0 && (
                                        <button type="button" onClick={() => setShareSelectedExps([])} className="text-[11px] text-red-600 hover:underline font-semibold">
                                            Limpiar lista
                                        </button>
                                    )}
                                </div>
                                {shareSelectedExps.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic border border-dashed border-gray-200 rounded-lg p-3 text-center">
                                        Busque y agregue uno o varios expedientes arriba.
                                    </p>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-purple-50/40 border border-purple-200 rounded-lg">
                                        {shareSelectedExps.map(exp => (
                                            <span key={exp.id} className="inline-flex items-center gap-1 bg-white border border-purple-300 text-purple-900 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm">
                                                <span className="max-w-[210px] truncate">{exp.title || exp.expediente_code}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setShareSelectedExps(prev => prev.filter(x => Number(x.id) !== Number(exp.id)))}
                                                    className="text-purple-500 hover:text-red-600"
                                                >
                                                    <X size={13} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={submitShareDocument}
                                    disabled={shareLoading || shareSelectedExps.length === 0}
                                    className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-lg transition-colors"
                                >
                                    {shareLoading ? 'Vinculando...' : <><Share2 size={16} /> Vincular en {shareSelectedExps.length} Expediente(s)</>}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSharingDoc(null)}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL VER EXPEDIENTES RELACIONADOS A UN DOCUMENTO COMPARTIDO */}
            {sharedInfoDoc && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[105] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
                        <div className="bg-purple-800 p-4 text-white flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-bold text-sm flex items-center gap-2">🔗 Expedientes Relacionados con este Documento</h3>
                                <p className="text-[11px] text-purple-200 mt-0.5 truncate max-w-[400px]">{sharedInfoDoc.filename}</p>
                            </div>
                            <button onClick={() => setSharedInfoDoc(null)}><X size={20} /></button>
                        </div>
                        <div className="p-4 overflow-y-auto space-y-2">
                            {loadingSharedInfo ? (
                                <p className="text-center text-xs text-gray-400 py-6">Consultando expedientes vinculados...</p>
                            ) : sharedInfoList.length === 0 ? (
                                <p className="text-center text-xs text-gray-400 py-6">No se encontraron expedientes vinculados.</p>
                            ) : (
                                sharedInfoList.map(item => (
                                    <div key={item.id} className="p-3 border border-gray-200 rounded-lg flex items-center justify-between gap-2 bg-gray-50">
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-gray-900 truncate">{item.title || `Expediente #${item.expediente_id}`}</div>
                                            <div className="text-[11px] text-gray-500">
                                                {item.expediente_code || `ID-${item.expediente_id}`} · Archivo: <strong>{item.filename}</strong>
                                            </div>
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

            {/* MODAL DESCARGA INVENTARIO DOCUMENTAL PDF */}
            <InventoryPdfModal
                isOpen={showInventoryPdfModal}
                onClose={() => setShowInventoryPdfModal(false)}
                initialUserId={targetUserFilter || null}
            />
        </div>
    );
}

export default DocumentManagement;

