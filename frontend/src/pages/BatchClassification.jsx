import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Upload, Search, FileText, Save, Eye, X, Check, Folder,
    Share2, Plus, Sparkles, Layers, Trash2, CheckCircle2, AlertCircle, FileDown
} from 'lucide-react';
import InventoryPdfModal from '../components/InventoryPdfModal';

function BatchDocumentViewer({ fileObj, fileUrl, onSearchExpedienteText, onAppendDescriptionText }) {
    const [pdf, setPdf] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [numPages, setNumPages] = useState(1);
    const [scale, setScale] = useState(1.1);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [selection, setSelection] = useState(null);

    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const renderTaskRef = useRef(null);
    const isSelectingRef = useRef(false);
    const startCoordsRef = useRef({ x: 0, y: 0 });

    const isImage = Boolean(fileObj && fileObj.type && fileObj.type.startsWith('image/'));

    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (isSelectingRef.current) {
                isSelectingRef.current = false;
                setSelection(prev => (prev && (prev.width < 10 || prev.height < 10)) ? null : prev);
            }
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    useEffect(() => {
        if (!fileUrl) return;
        setPageNumber(1);
        setSelection(null);

        if (isImage) {
            setPdf(null);
            setNumPages(1);
            const img = new Image();
            img.onload = () => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const w = Math.round(img.width * scale * 0.65);
                const h = Math.round(img.height * scale * 0.65);
                canvas.width = Math.max(200, w);
                canvas.height = Math.max(200, h);
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = fileUrl;
            return;
        }

        let cancelled = false;
        const loadPdf = () => {
            if (cancelled) return;
            if (!window.pdfjsLib) {
                setTimeout(loadPdf, 120);
                return;
            }
            const task = window.pdfjsLib.getDocument(fileUrl);
            task.promise.then(
                (loaded) => {
                    if (cancelled) return;
                    setPdf(loaded);
                    setNumPages(loaded.numPages || 1);
                },
                (err) => console.error('Error cargando PDF en visor masivo:', err)
            );
        };
        loadPdf();
        return () => { cancelled = true; };
    }, [fileUrl, isImage]);

    useEffect(() => {
        if (isImage && fileUrl) {
            const img = new Image();
            img.onload = () => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                canvas.width = Math.max(200, Math.round(img.width * scale * 0.65));
                canvas.height = Math.max(200, Math.round(img.height * scale * 0.65));
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = fileUrl;
            return;
        }
        if (!pdf) return;
        pdf.getPage(pageNumber).then((page) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const viewport = page.getViewport({ scale });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }
            const rt = page.render({ canvasContext: ctx, viewport });
            renderTaskRef.current = rt;
            rt.promise.then(
                () => { renderTaskRef.current = null; },
                (err) => {
                    if (err?.name !== 'RenderingCancelledException') console.error(err);
                }
            );
        });
    }, [pdf, pageNumber, scale, isImage, fileUrl]);

    const handleMouseDown = (e) => {
        if (isOcrLoading || !containerRef.current) return;
        e.preventDefault();
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
        setSelection({
            x: Math.min(startX, currentX),
            y: Math.min(startY, currentY),
            width: Math.abs(startX - currentX),
            height: Math.abs(startY - currentY)
        });
    };

    const runCropOcr = async (mode) => {
        if (!selection || !canvasRef.current) return;
        setIsOcrLoading(true);
        try {
            const canvas = canvasRef.current;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = Math.max(1, selection.width * scaleX);
            cropCanvas.height = Math.max(1, selection.height * scaleY);
            const cropCtx = cropCanvas.getContext('2d');
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
            const res = await axios.post('/api/ai/ocr-image', { image: base64Image });
            const extracted = (res.data?.text || '').trim();
            if (!extracted) {
                alert('No se detectó texto claro en el recorte seleccionado.');
                return;
            }
            if (mode === 'search') {
                onSearchExpedienteText(extracted.replace(/\s+/g, ' ').trim());
            } else {
                onAppendDescriptionText(extracted);
            }
            setSelection(null);
        } catch (err) {
            alert('Error extrayendo texto con OCR: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsOcrLoading(false);
        }
    };

    return (
        <div className="flex flex-col bg-gray-100 rounded-xl overflow-hidden border border-gray-200 h-[660px]">
            <div className="bg-gray-800 text-white px-3 py-2 flex items-center justify-between text-xs select-none">
                <div className="flex items-center gap-1.5">
                    {!isImage && (
                        <>
                            <button
                                type="button"
                                disabled={pageNumber <= 1}
                                onClick={() => { setPageNumber(p => p - 1); setSelection(null); }}
                                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 px-2 py-1 rounded font-bold"
                            >
                                ◀
                            </button>
                            <span>Pág {pageNumber}/{numPages}</span>
                            <button
                                type="button"
                                disabled={pageNumber >= numPages}
                                onClick={() => { setPageNumber(p => p + 1); setSelection(null); }}
                                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 px-2 py-1 rounded font-bold"
                            >
                                ▶
                            </button>
                        </>
                    )}
                    {isImage && <span className="font-semibold text-emerald-300">🖼️ Vista Imagen (se convertirá a PDF)</span>}
                </div>
                <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => setScale(s => Math.max(0.5, s - 0.15))} className="bg-gray-700 px-2 py-0.5 rounded font-bold">-</button>
                    <span>{Math.round(scale * 100)}%</span>
                    <button type="button" onClick={() => setScale(s => Math.min(3.0, s + 0.15))} className="bg-gray-700 px-2 py-0.5 rounded font-bold">+</button>
                </div>
            </div>

            <div className="bg-emerald-50 border-b border-emerald-200 px-3 py-1.5 text-[11px] text-emerald-900 flex items-center justify-between gap-2">
                <span>💡 Arrastre un recuadro sobre Cédula o Nombre en el documento para buscar el expediente con OCR.</span>
                {selection && (
                    <button type="button" onClick={() => setSelection(null)} className="text-red-600 font-bold underline shrink-0">
                        Limpiar
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-auto p-3 flex justify-center relative bg-gray-600">
                <div
                    ref={containerRef}
                    className="relative shadow-xl select-none h-fit w-fit cursor-crosshair"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                >
                    <canvas ref={canvasRef} className="block select-none pointer-events-none bg-white" />
                    {selection && (
                        <>
                            <div
                                style={{
                                    position: 'absolute',
                                    left: `${selection.x}px`,
                                    top: `${selection.y}px`,
                                    width: `${selection.width}px`,
                                    height: `${selection.height}px`,
                                    border: '2px dashed #10b981',
                                    backgroundColor: 'rgba(16, 185, 129, 0.18)',
                                    pointerEvents: 'none'
                                }}
                            />
                            <div
                                style={{
                                    position: 'absolute',
                                    left: `${Math.max(0, selection.x)}px`,
                                    top: `${selection.y + selection.height + 6}px`,
                                    zIndex: 50
                                }}
                                className="flex items-center gap-1.5 bg-gray-900/95 p-1.5 rounded-lg shadow-xl"
                            >
                                <button
                                    type="button"
                                    disabled={isOcrLoading}
                                    onClick={() => runCropOcr('search')}
                                    className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded flex items-center gap-1 whitespace-nowrap"
                                >
                                    {isOcrLoading ? 'Leyendo...' : '🔍 Buscar Expediente'}
                                </button>
                                <button
                                    type="button"
                                    disabled={isOcrLoading}
                                    onClick={() => runCropOcr('desc')}
                                    className="px-2.5 py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-1 whitespace-nowrap"
                                >
                                    📝 Copiar a Texto
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

const normalizeStr = (s) =>
    String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

const extractCandidateTokensFromFilename = (rawName) => {
    const base = String(rawName || '').replace(/\.[^.]+$/, '');
    const tokens = new Set();

    // 1. Official SENA expediente codes (e.g. 2026EX...)
    const expCodes = base.match(/20\d{2}EX[A-Z0-9_-]+/gi) || [];
    expCodes.forEach(c => tokens.add(c.trim()));

    // 2. Document numbers / Fichas (6 to 12 digits)
    const numMatches = base.match(/\d{6,12}/g) || [];
    numMatches.forEach(n => tokens.add(n.trim()));

    // 3. Alphabetic learner names (2+ words of >=3 letters)
    const cleanedWords = base
        .replace(/[_-]+/g, ' ')
        .replace(/\b(pdf|scan|doc|documento|cedula|ti|cc|acta|certificado|diploma|ficha|aprendiz|copia)\b/gi, ' ')
        .replace(/\d+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (cleanedWords.length >= 6 && cleanedWords.split(' ').length >= 2) {
        tokens.add(cleanedWords);
    }

    return Array.from(tokens);
};

const guessTypologyFromFilename = (rawName, typologyList) => {
    if (!Array.isArray(typologyList) || typologyList.length === 0) return null;
    const normFile = normalizeStr(String(rawName || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
    if (!normFile || normFile.length < 3) return null;

    let bestMatch = null;
    let bestScore = 0;

    for (const t of typologyList) {
        const normT = normalizeStr(t.name);
        if (!normT) continue;
        if (normFile.includes(normT)) {
            return t;
        }
        const words = normT.split(/\s+/).filter(w => w.length >= 4 && !['documento', 'formato', 'soporte', 'para', 'aprendiz'].includes(w));
        if (words.length === 0) continue;
        let hits = 0;
        for (const w of words) {
            if (normFile.includes(w)) hits++;
        }
        const score = hits / words.length;
        if (hits >= 1 && score > bestScore && score >= 0.5) {
            bestScore = score;
            bestMatch = t;
        }
    }
    return bestMatch;
};

const buildPreviewFilename = (typObj, typologyName) => {
    const nameToUse = typObj?.name || typologyName || '';
    if (!nameToUse) return '';
    const safeName = nameToUse.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
    const orderNum = typObj?.trd_order || 99;
    return `${String(orderNum).padStart(2, '0')}_${safeName}`;
};

function BatchClassification() {
    const [items, setItems] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [activeSubFileIdx, setActiveSubFileIdx] = useState(0);
    const [trayFilter, setTrayFilter] = useState('todos'); // todos | pendientes | listos | guardados
    const [isDragging, setIsDragging] = useState(false);

    // Expediente search state
    const [expSearchTerm, setExpSearchTerm] = useState('');
    const [expResults, setExpResults] = useState([]);
    const [searchingExp, setSearchingExp] = useState(false);
    const expDebounceRef = useRef(null);

    // Typologies cache & active list
    const typologiesCacheRef = useRef({});
    const [allFallbackTypologies, setAllFallbackTypologies] = useState([]);
    const [activeTypologies, setActiveTypologies] = useState([]);
    const [allowedStages, setAllowedStages] = useState(null);
    const [stageFilter, setStageFilter] = useState('ALL');
    const [typologyFilterText, setTypologyFilterText] = useState('');

    // Saving & AI progress
    const [savingBatch, setSavingBatch] = useState(false);
    const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
    const [aiBatchRunning, setAiBatchRunning] = useState(false);
    const [showInventoryPdfModal, setShowInventoryPdfModal] = useState(false);

    // Existing docs cache for single-expediente pending checklist
    const expDocsCacheRef = useRef({});
    const [activeExpDocs, setActiveExpDocs] = useState([]);
    const [loadingExpDocs, setLoadingExpDocs] = useState(false);

    const fileInputRef = useRef(null);

    // Preload fallback all-typologies once
    useEffect(() => {
        axios.get('/api/trd/all-typologies')
            .then(res => {
                const list = (res.data?.data || []).map((t, idx) => ({ ...t, trd_order: t.trd_order || idx + 1 }));
                setAllFallbackTypologies(list);
                setActiveTypologies(list);
            })
            .catch(() => {});
    }, []);

    const activeItem = items.find(x => x.id === activeId) || null;

    const loadTypologiesForSubserie = async (subserieCode) => {
        const key = String(subserieCode || '__ALL__').trim() || '__ALL__';
        if (typologiesCacheRef.current[key]) {
            const cached = typologiesCacheRef.current[key];
            setActiveTypologies(cached.list);
            setAllowedStages(cached.allowedStages);
            return cached.list;
        }
        try {
            if (key !== '__ALL__') {
                const res = await axios.get(`/api/trd/typologies-for-expediente?subserie=${encodeURIComponent(key)}`);
                const rawList = res.data?.data || [];
                if (rawList.length > 0) {
                    const formatted = rawList.map((t, idx) => ({ ...t, trd_order: t.trd_order || idx + 1 }));
                    const allowed = res.data?.allowed_stages || null;
                    typologiesCacheRef.current[key] = { list: formatted, allowedStages: allowed };
                    setActiveTypologies(formatted);
                    setAllowedStages(allowed);
                    return formatted;
                }
            }
        } catch (_) {}

        setActiveTypologies(allFallbackTypologies);
        setAllowedStages(null);
        return allFallbackTypologies;
    };

    // Refresh typology dropdown whenever active item's primary expediente changes
    useEffect(() => {
        setActiveSubFileIdx(0);
        const primarySubserie = activeItem?.targetExpedientes?.[0]?.subserie || '';
        loadTypologiesForSubserie(primarySubserie);
    }, [activeId, activeItem?.targetExpedientes?.[0]?.subserie, allFallbackTypologies.length]);

    // Load existing documents when 1 target expediente is selected so we can show missing TRD typologies
    const singleTargetExpId = activeItem?.targetExpedientes?.length === 1 ? activeItem.targetExpedientes[0].id : null;
    useEffect(() => {
        if (!singleTargetExpId) {
            setActiveExpDocs([]);
            setLoadingExpDocs(false);
            return;
        }
        if (expDocsCacheRef.current[singleTargetExpId]) {
            setActiveExpDocs(expDocsCacheRef.current[singleTargetExpId]);
            return;
        }
        let cancelled = false;
        setLoadingExpDocs(true);
        axios.get(`/api/documents/expediente/${singleTargetExpId}`)
            .then(res => {
                const list = res.data?.data || [];
                expDocsCacheRef.current[singleTargetExpId] = list;
                if (!cancelled) setActiveExpDocs(list);
            })
            .catch(() => {
                if (!cancelled) setActiveExpDocs([]);
            })
            .finally(() => {
                if (!cancelled) setLoadingExpDocs(false);
            });
        return () => { cancelled = true; };
    }, [singleTargetExpId]);

    // Trigger expediente search
    const runExpedienteSearch = async (termVal) => {
        setSearchingExp(true);
        try {
            const res = await axios.get(`/api/expedientes/search?term=${encodeURIComponent((termVal || '').trim())}`);
            setExpResults((res.data?.data || []).slice(0, 80));
        } catch (err) {
            console.error('Error buscando expedientes:', err);
        } finally {
            setSearchingExp(false);
        }
    };

    const handleExpSearchInput = (val) => {
        setExpSearchTerm(val);
        if (expDebounceRef.current) clearTimeout(expDebounceRef.current);
        if (!val || val.trim().length < 2) {
            if (!val) setExpResults([]);
            return;
        }
        expDebounceRef.current = setTimeout(() => {
            runExpedienteSearch(val);
        }, 300);
    };

    // Add multiple files to tray + run automatic pre-matching
    const addFilesToTray = async (fileList) => {
        const allowedMime = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/x-tiff'];
        const validFiles = Array.from(fileList || []).filter(f => {
            const ext = (f.name.split('.').pop() || '').toLowerCase();
            return allowedMime.includes(f.type) || ['pdf', 'jpg', 'jpeg', 'png', 'tif', 'tiff'].includes(ext);
        });

        if (validFiles.length === 0) {
            alert('Seleccione archivos PDF o imágenes (JPG, PNG, TIFF).');
            return;
        }

        const nowIso = new Date().toISOString().slice(0, 16);
        const newEntries = validFiles.map(f => {
            const guessedTyp = guessTypologyFromFilename(f.name, allFallbackTypologies);
            return {
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                files: [f],
                urls: [URL.createObjectURL(f)],
                displayName: f.name,
                checked: false,
                targetExpedientes: [],
                autoMatched: false,
                typologyName: guessedTyp ? guessedTyp.name : '',
                customFilename: guessedTyp ? buildPreviewFilename(guessedTyp, guessedTyp.name) : '',
                customFilenameEdited: false,
                documentDate: nowIso,
                origen: 'ELECTRONICO',
                description: '',
                aiStatus: 'idle', // idle | loading | done | error
                aiReason: '',
                saveState: 'pending', // pending | saving | saved | error
                saveError: '',
                savedDocs: []
            };
        });

        setItems(prev => {
            const merged = [...prev, ...newEntries];
            if (!activeId && newEntries.length > 0) {
                setActiveId(newEntries[0].id);
            }
            return merged;
        });

        // Pre-match expedientes by tokens extracted from filenames!
        const tokenToEntryIds = {};
        const allTokens = [];
        for (const entry of newEntries) {
            const toks = extractCandidateTokensFromFilename(entry.displayName);
            for (const tk of toks) {
                if (!tokenToEntryIds[tk]) {
                    tokenToEntryIds[tk] = [];
                    allTokens.push(tk);
                }
                tokenToEntryIds[tk].push(entry.id);
            }
        }

        if (allTokens.length > 0) {
            try {
                const matchRes = await axios.post('/api/expedientes/batch-match', { tokens: allTokens });
                const matches = matchRes.data?.matches || {};
                if (Object.keys(matches).length > 0) {
                    setItems(prev => prev.map(item => {
                        if (item.targetExpedientes.length > 0) return item;
                        const toks = extractCandidateTokensFromFilename(item.displayName);
                        for (const tk of toks) {
                            const candidates = matches[tk];
                            if (Array.isArray(candidates) && candidates.length === 1) {
                                const matchedExp = candidates[0];
                                const defaultDate = matchedExp.opening_date
                                    ? `${String(matchedExp.opening_date).split('T')[0].split(' ')[0]}T12:00`
                                    : item.documentDate;
                                return {
                                    ...item,
                                    targetExpedientes: [matchedExp],
                                    autoMatched: true,
                                    documentDate: defaultDate
                                };
                            }
                        }
                        return item;
                    }));
                }
            } catch (err) {
                console.warn('Pre-match automático omitido:', err.message);
            }
        }
    };

    const updateActiveItem = (patch) => {
        if (!activeId) return;
        setItems(prev => prev.map(it => (it.id === activeId ? { ...it, ...patch } : it)));
    };

    const assignSingleExpedienteToActive = (exp) => {
        if (!activeItem || !exp) return;
        const defaultDate = exp.opening_date
            ? `${String(exp.opening_date).split('T')[0].split(' ')[0]}T12:00`
            : activeItem.documentDate;
        updateActiveItem({
            targetExpedientes: [exp],
            documentDate: defaultDate,
            saveState: activeItem.saveState === 'saved' ? 'saved' : 'pending'
        });
    };

    const addRelatedExpedienteToActive = (exp) => {
        if (!activeItem || !exp) return;
        const exists = activeItem.targetExpedientes.some(e => Number(e.id) === Number(exp.id));
        if (exists) return;
        updateActiveItem({
            targetExpedientes: [...activeItem.targetExpedientes, exp]
        });
    };

    const addAllResultsToActive = () => {
        if (!activeItem || expResults.length === 0) return;
        const existingIds = new Set(activeItem.targetExpedientes.map(e => Number(e.id)));
        const additions = expResults.filter(e => !existingIds.has(Number(e.id)));
        updateActiveItem({
            targetExpedientes: [...activeItem.targetExpedientes, ...additions]
        });
    };

    const applyExpedientesToChecked = () => {
        if (!activeItem || activeItem.targetExpedientes.length === 0) return;
        const targetCopy = [...activeItem.targetExpedientes];
        setItems(prev => prev.map(it => {
            if (!it.checked || it.saveState === 'saved') return it;
            return { ...it, targetExpedientes: targetCopy };
        }));
    };

    const applyTypologyToChecked = () => {
        if (!activeItem || !activeItem.typologyName) return;
        const matchedTyp = activeTypologies.find(t => t.name === activeItem.typologyName);
        setItems(prev => prev.map(it => {
            if (!it.checked || it.saveState === 'saved') return it;
            return {
                ...it,
                typologyName: activeItem.typologyName,
                customFilename: it.customFilenameEdited ? it.customFilename : buildPreviewFilename(matchedTyp, activeItem.typologyName)
            };
        }));
    };

    // Merge 2+ checked tray items into 1 multi-page PDF item
    const mergeCheckedItemsIntoOne = () => {
        const checkedItems = items.filter(it => it.checked && it.saveState !== 'saved');
        if (checkedItems.length < 2) {
            alert('Marque al menos 2 archivos pendientes en la bandeja izquierda para unirlos en un solo PDF.');
            return;
        }
        const first = checkedItems[0];
        const combinedFiles = checkedItems.flatMap(it => it.files);
        const combinedUrls = checkedItems.flatMap(it => it.urls);
        const mergedEntry = {
            ...first,
            id: `merged_${Date.now()}`,
            files: combinedFiles,
            urls: combinedUrls,
            displayName: `Unido (${combinedFiles.length} archivos): ${first.files[0]?.name || 'Documento.pdf'}`,
            checked: false
        };
        const checkedIds = new Set(checkedItems.map(it => it.id));
        setItems(prev => {
            const remaining = prev.filter(it => !checkedIds.has(it.id));
            return [mergedEntry, ...remaining];
        });
        setActiveId(mergedEntry.id);
    };

    // AI classification for 1 item
    const classifySingleItemWithAI = async (item) => {
        const firstPdf = item.files.find(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
        if (!firstPdf) return;

        setItems(prev => prev.map(x => x.id === item.id ? { ...x, aiStatus: 'loading' } : x));
        try {
            const subCode = item.targetExpedientes?.[0]?.subserie || '';
            const typList = await loadTypologiesForSubserie(subCode);
            const fd = new FormData();
            fd.append('file', firstPdf);
            const qs = subCode ? `?subserie=${encodeURIComponent(subCode)}` : '';
            const res = await axios.post(`/api/ai/classify-document${qs}`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const sug = res.data?.tipologia_sugerida;
            const razon = res.data?.razon || '';
            if (sug && sug !== 'Desconocida') {
                const cleanSug = normalizeStr(sug).replace(/[^a-z0-9]/g, '');
                const matched = typList.find(t => {
                    const cleanT = normalizeStr(t.name).replace(/[^a-z0-9]/g, '');
                    return cleanT === cleanSug || cleanSug.includes(cleanT) || cleanT.includes(cleanSug);
                });
                const chosenName = matched ? matched.name : sug;
                setItems(prev => prev.map(x => x.id === item.id ? {
                    ...x,
                    aiStatus: 'done',
                    aiReason: razon,
                    typologyName: chosenName,
                    customFilename: x.customFilenameEdited ? x.customFilename : buildPreviewFilename(matched, chosenName)
                } : x));
            } else {
                setItems(prev => prev.map(x => x.id === item.id ? { ...x, aiStatus: 'done', aiReason: razon || 'Sin coincidencia exacta.' } : x));
            }
        } catch (err) {
            setItems(prev => prev.map(x => x.id === item.id ? { ...x, aiStatus: 'error', aiReason: err.message } : x));
        }
    };

    const runBatchAIClassification = async () => {
        const targets = items.filter(it => it.saveState !== 'saved' && !it.typologyName);
        if (targets.length === 0) {
            alert('Todos los archivos pendientes ya tienen una tipología asignada.');
            return;
        }
        setAiBatchRunning(true);
        for (const it of targets) {
            await classifySingleItemWithAI(it);
        }
        setAiBatchRunning(false);
    };

    // Save 1 item via POST /api/documents/classify-multi-expediente
    const saveSingleItem = async (item) => {
        if (!item || item.targetExpedientes.length === 0 || !item.typologyName) return false;
        setItems(prev => prev.map(x => x.id === item.id ? { ...x, saveState: 'saving', saveError: '' } : x));
        try {
            const fd = new FormData();
            item.files.forEach(f => fd.append('files', f));
            fd.append('expediente_ids', JSON.stringify(item.targetExpedientes.map(e => e.id)));
            fd.append('typology_name', item.typologyName);
            fd.append('document_date', item.documentDate || new Date().toISOString());
            fd.append('origen', item.origen || 'ELECTRONICO');
            fd.append('description', item.description || '');
            if (item.targetExpedientes.length === 1 && item.customFilenameEdited && item.customFilename) {
                fd.append('custom_filename', item.customFilename);
            }

            const res = await axios.post('/api/documents/classify-multi-expediente', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            // Invalidate & refresh cached expediente docs for affected expedientes
            item.targetExpedientes.forEach(e => {
                delete expDocsCacheRef.current[e.id];
            });
            if (item.targetExpedientes.length === 1 && Number(item.targetExpedientes[0].id) === Number(singleTargetExpId)) {
                axios.get(`/api/documents/expediente/${singleTargetExpId}`)
                    .then(r => {
                        const rows = r.data?.data || [];
                        expDocsCacheRef.current[singleTargetExpId] = rows;
                        setActiveExpDocs(rows);
                    })
                    .catch(() => {});
            }
            setItems(prev => prev.map(x => x.id === item.id ? {
                ...x,
                saveState: 'saved',
                saveError: '',
                checked: false,
                savedDocs: res.data?.documents || []
            } : x));
            return true;
        } catch (err) {
            const msg = err.response?.data?.error || err.message || 'Error al guardar';
            setItems(prev => prev.map(x => x.id === item.id ? { ...x, saveState: 'error', saveError: msg } : x));
            return false;
        }
    };

    const isItemReady = (it) => it.saveState !== 'saved' && it.targetExpedientes.length > 0 && Boolean(it.typologyName);

    const saveAllReadyItems = async () => {
        const readyList = items.filter(isItemReady);
        if (readyList.length === 0) {
            alert('No hay documentos listos. Asigne al menos un expediente y una tipología TRD.');
            return;
        }
        setSavingBatch(true);
        setSaveProgress({ current: 0, total: readyList.length });
        let okCount = 0;
        for (let i = 0; i < readyList.length; i++) {
            setSaveProgress({ current: i + 1, total: readyList.length });
            const ok = await saveSingleItem(readyList[i]);
            if (ok) okCount++;
        }
        setSavingBatch(false);
        const nextPending = items.find(it => it.saveState !== 'saved' && !readyList.some(r => r.id === it.id));
        if (nextPending) setActiveId(nextPending.id);
        alert(`✅ Proceso completado: ${okCount} de ${readyList.length} documento(s) guardados y organizados en sus expedientes.`);
    };

    const removeItem = (id) => {
        setItems(prev => {
            const next = prev.filter(x => x.id !== id);
            if (activeId === id) {
                setActiveId(next[0]?.id || null);
            }
            return next;
        });
    };

    // Derived counts & filtered lists
    const totalCount = items.length;
    const readyCount = items.filter(isItemReady).length;
    const savedCount = items.filter(it => it.saveState === 'saved').length;
    const unassignedCount = items.filter(it => it.saveState !== 'saved' && (!it.typologyName || it.targetExpedientes.length === 0)).length;
    const checkedCount = items.filter(it => it.checked && it.saveState !== 'saved').length;

    const visibleTrayItems = items.filter(it => {
        if (trayFilter === 'pendientes') return it.saveState !== 'saved' && !isItemReady(it);
        if (trayFilter === 'listos') return isItemReady(it);
        if (trayFilter === 'guardados') return it.saveState === 'saved';
        return true;
    });

    const stagesInDropdown = (() => {
        const st = [];
        activeTypologies.forEach(t => {
            if (t.stage && !st.includes(t.stage)) {
                if (!allowedStages || allowedStages.length === 0 || allowedStages.includes(t.stage)) {
                    st.push(t.stage);
                }
            }
        });
        return st;
    })();

    const filteredDropdownTypologies = activeTypologies.filter(t => {
        if (allowedStages && allowedStages.length > 0 && t.stage && !allowedStages.includes(t.stage)) return false;
        if (stageFilter !== 'ALL' && t.stage && t.stage !== stageFilter) return false;
        if (typologyFilterText.trim()) {
            return normalizeStr(t.name).includes(normalizeStr(typologyFilterText));
        }
        return true;
    });

    return (
        <div className="p-4 lg:p-6 max-w-[1650px] mx-auto space-y-4">
            {/* TOP HEADER BAR */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2.5">
                        <span className="bg-emerald-100 text-emerald-700 p-2 rounded-xl"><Layers size={22} /></span>
                        Clasificación y Cargue Múltiple de Documentos
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Suba varios PDFs o imágenes a la vez, asigne su tipología TRD y vincúlelos a <strong>uno o múltiples expedientes relacionados</strong> buscando por cualquier metadato.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff"
                        className="hidden"
                        onChange={(e) => {
                            addFilesToTray(e.target.files);
                            e.target.value = null;
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => setShowInventoryPdfModal(true)}
                        className="bg-[#00324D] hover:bg-[#00456b] text-white px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                    >
                        <FileDown size={15} /> Inventario PDF
                    </button>

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                    >
                        <Upload size={15} /> Agregar Archivos
                    </button>

                    <button
                        type="button"
                        disabled={aiBatchRunning || items.length === 0}
                        onClick={runBatchAIClassification}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-all"
                    >
                        <Sparkles size={15} /> {aiBatchRunning ? 'Analizando con IA...' : 'Sugerir Tipologías (IA)'}
                    </button>

                    <button
                        type="button"
                        disabled={savingBatch || readyCount === 0}
                        onClick={saveAllReadyItems}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md transition-all"
                    >
                        <Save size={16} />
                        {savingBatch
                            ? `Guardando (${saveProgress.current}/${saveProgress.total})...`
                            : `Guardar Documentos Listos (${readyCount})`}
                    </button>
                </div>
            </div>

            {/* KPI STRIP */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500">En Bandeja</span>
                    <span className="text-lg font-extrabold text-gray-800">{totalCount}</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800">Por Clasificar</span>
                    <span className="text-lg font-extrabold text-amber-700">{unassignedCount}</span>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-800">Listos para Guardar</span>
                    <span className="text-lg font-extrabold text-blue-700">{readyCount}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800">Guardados</span>
                    <span className="text-lg font-extrabold text-emerald-700">{savedCount}</span>
                </div>
            </div>

            {/* 3-COLUMN WORKSPACE */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* LEFT COLUMN: LOTE DE ARCHIVOS */}
                <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col max-h-[760px]">
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            if (e.dataTransfer?.files?.length) addFilesToTray(e.dataTransfer.files);
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        className={`m-3 p-3.5 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all ${
                            isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 bg-gray-50 hover:border-emerald-400 hover:bg-emerald-50/40'
                        }`}
                    >
                        <Upload size={22} className="mx-auto text-emerald-600 mb-1" />
                        <p className="text-xs font-bold text-gray-700">Arrastre aquí múltiples PDFs o Imágenes</p>
                        <p className="text-[10px] text-gray-400">Pre-detección automática si el nombre incluye Cédula o Código</p>
                    </div>

                    {/* Filter Tabs */}
                    <div className="px-3 pb-2 flex flex-wrap gap-1 border-b border-gray-100">
                        {[
                            { id: 'todos', label: `Todos (${totalCount})` },
                            { id: 'pendientes', label: `Sin asignar (${unassignedCount})` },
                            { id: 'listos', label: `Listos (${readyCount})` },
                            { id: 'guardados', label: `Guardados (${savedCount})` }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setTrayFilter(tab.id)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                                    trayFilter === tab.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Bulk Selection Actions */}
                    {items.length > 0 && (
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                            <label className="flex items-center gap-1.5 font-semibold text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={checkedCount > 0 && checkedCount === items.filter(x => x.saveState !== 'saved').length}
                                    onChange={(e) => {
                                        const chk = e.target.checked;
                                        setItems(prev => prev.map(x => x.saveState === 'saved' ? x : { ...x, checked: chk }));
                                    }}
                                />
                                <span>Marcar ({checkedCount})</span>
                            </label>
                            <div className="flex items-center gap-1">
                                {checkedCount >= 2 && (
                                    <button
                                        type="button"
                                        onClick={mergeCheckedItemsIntoOne}
                                        className="bg-amber-100 hover:bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold text-[10px]"
                                        title="Unir los archivos marcados en un único PDF multipágina"
                                    >
                                        🔗 Unir en 1 PDF
                                    </button>
                                )}
                                {savedCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setItems(prev => prev.filter(x => x.saveState !== 'saved'))}
                                        className="text-gray-500 hover:text-red-600 font-semibold text-[10px]"
                                    >
                                        Limpiar guardados
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* File List */}
                    <div className="flex-1 overflow-y-auto divide-y divide-gray-100 p-2 space-y-1.5">
                        {visibleTrayItems.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-10 italic">No hay archivos en esta vista.</p>
                        ) : (
                            visibleTrayItems.map((it) => {
                                const selected = it.id === activeId;
                                const ready = isItemReady(it);
                                return (
                                    <div
                                        key={it.id}
                                        onClick={() => setActiveId(it.id)}
                                        className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                                            selected
                                                ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-100'
                                                : it.saveState === 'saved'
                                                    ? 'border-green-200 bg-green-50/30'
                                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                        }`}
                                    >
                                        <div className="flex items-start gap-2">
                                            {it.saveState !== 'saved' && (
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(it.checked)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => {
                                                        const chk = e.target.checked;
                                                        setItems(prev => prev.map(x => x.id === it.id ? { ...x, checked: chk } : x));
                                                    }}
                                                    className="mt-0.5"
                                                />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-gray-800 truncate" title={it.displayName}>
                                                    {it.files.length > 1 ? '📚 ' : '📄 '}{it.displayName}
                                                </p>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {it.saveState === 'saved' ? (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-green-600 text-white flex items-center gap-0.5">
                                                            <CheckCircle2 size={10} /> Guardado
                                                        </span>
                                                    ) : ready ? (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                                                            ✓ Listo
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                                                            Pendiente
                                                        </span>
                                                    )}

                                                    {it.targetExpedientes.length === 1 && (
                                                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 truncate max-w-[150px]">
                                                            📁 {it.targetExpedientes[0].title || it.targetExpedientes[0].expediente_code}
                                                        </span>
                                                    )}
                                                    {it.targetExpedientes.length > 1 && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-900">
                                                            🔗 {it.targetExpedientes.length} expedientes
                                                        </span>
                                                    )}
                                                    {it.typologyName && (
                                                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-700 truncate max-w-[160px]">
                                                            🏷️ {it.typologyName}
                                                        </span>
                                                    )}
                                                </div>
                                                {it.saveError && (
                                                    <p className="text-[10px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                                                        <AlertCircle size={11} /> {it.saveError}
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); removeItem(it.id); }}
                                                className="text-gray-400 hover:text-red-600 p-0.5"
                                                title="Quitar de la bandeja"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* CENTER COLUMN: ASIGNADOR UNIVERSAL MULTI-EXPEDIENTE + TIPOLOGÍA */}
                <div className="lg:col-span-5 space-y-4">
                    {!activeItem ? (
                        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">
                            <Upload size={42} className="mx-auto mb-3 opacity-40" />
                            <h3 className="text-base font-bold text-gray-600">Suba o seleccione un archivo en la bandeja izquierda</h3>
                            <p className="text-xs mt-1">Aquí podrá asignarle el expediente (o varios expedientes relacionados) y su tipología TRD.</p>
                        </div>
                    ) : (
                        <>
                            {/* STEP 1: ASSIGN 1 OR MULTIPLE EXPEDIENTES */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <h2 className="text-sm font-extrabold text-gray-800 flex items-center gap-1.5">
                                        <Folder size={17} className="text-emerald-600" />
                                        1. Asignar Expediente(s) — Búsqueda por Cualquier Metadato
                                    </h2>
                                    {checkedCount > 0 && activeItem.targetExpedientes.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={applyExpedientesToChecked}
                                            className="text-[11px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 px-2.5 py-1 rounded-lg transition-colors"
                                        >
                                            📌 Aplicar a los {checkedCount} marcados
                                        </button>
                                    )}
                                </div>

                                {/* Currently Linked Expedientes Chips */}
                                <div className={`p-3 rounded-xl border ${activeItem.targetExpedientes.length > 1 ? 'bg-purple-50/60 border-purple-200' : 'bg-gray-50 border-gray-200'}`}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[11px] font-bold uppercase text-gray-600">
                                            {activeItem.targetExpedientes.length === 0
                                                ? '⚠️ Sin expediente asignado aún'
                                                : activeItem.targetExpedientes.length === 1
                                                    ? '✅ Expediente Asignado (1)'
                                                    : `🔗 Documento Compartido y Relacionado en ${activeItem.targetExpedientes.length} Expedientes`}
                                        </span>
                                        {activeItem.targetExpedientes.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => updateActiveItem({ targetExpedientes: [] })}
                                                className="text-[11px] text-red-600 hover:underline font-semibold"
                                            >
                                                Quitar todos
                                            </button>
                                        )}
                                    </div>

                                    {activeItem.targetExpedientes.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                                            {activeItem.targetExpedientes.map(exp => (
                                                <span
                                                    key={exp.id}
                                                    className="inline-flex items-center gap-1.5 bg-white border border-emerald-300 text-gray-800 rounded-lg px-2.5 py-1 text-xs font-bold shadow-sm"
                                                >
                                                    <span className="truncate max-w-[240px]">
                                                        {exp.title || exp.subseries_name || `ID-${exp.id}`}
                                                    </span>
                                                    {exp.expediente_code && (
                                                        <span className="text-[10px] text-emerald-700 font-semibold">({exp.expediente_code})</span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => updateActiveItem({
                                                            targetExpedientes: activeItem.targetExpedientes.filter(x => Number(x.id) !== Number(exp.id))
                                                        })}
                                                        className="text-gray-400 hover:text-red-600"
                                                    >
                                                        <X size={13} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400 italic">
                                            Busque abajo por Cédula/TI, Nombre del Aprendiz, Ficha, Código 2026EX..., Programa o Caja.
                                        </p>
                                    )}
                                </div>

                                {/* Search Input */}
                                <form
                                    onSubmit={(e) => { e.preventDefault(); runExpedienteSearch(expSearchTerm); }}
                                    className="flex gap-2"
                                >
                                    <div className="relative flex-1">
                                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            value={expSearchTerm}
                                            onChange={(e) => handleExpSearchInput(e.target.value)}
                                            placeholder="Escriba Cédula, Nombre, Número de Ficha, Código 2026EX o Programa..."
                                            className="w-full border border-gray-300 rounded-xl pl-9 pr-8 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                        {expSearchTerm && (
                                            <button
                                                type="button"
                                                onClick={() => { setExpSearchTerm(''); setExpResults([]); }}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={searchingExp}
                                        className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-bold shrink-0"
                                    >
                                        {searchingExp ? '...' : 'Buscar'}
                                    </button>
                                </form>

                                {/* Search Results */}
                                {expResults.length > 0 && (
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between px-1">
                                            <span className="text-[11px] font-bold text-gray-500">{expResults.length} expediente(s) encontrados</span>
                                            {expResults.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={addAllResultsToActive}
                                                    className="text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-0.5 rounded-lg flex items-center gap-1 transition-colors"
                                                    title="Relacionar este documento en todos los expedientes encontrados (ej: toda una Ficha)"
                                                >
                                                    <Share2 size={12} /> Relacionar en los {expResults.length} encontrados
                                                </button>
                                            )}
                                        </div>
                                        <div className="max-h-52 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl bg-white">
                                            {expResults.map(exp => {
                                                const isLinked = activeItem.targetExpedientes.some(e => Number(e.id) === Number(exp.id));
                                                const metaPills = [1, 2, 3, 4, 5, 6, 7, 8]
                                                    .map(i => exp.metadata_values?.[`valor${i}`])
                                                    .filter(v => v && String(v).trim() !== '' && String(v).trim() !== '-');
                                                return (
                                                    <div key={exp.id} className="p-2.5 hover:bg-emerald-50/40 flex items-center justify-between gap-2">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-xs font-bold text-gray-900 truncate">
                                                                {exp.title || exp.subseries_name || `ID-${exp.id}`}
                                                            </div>
                                                            <div className="text-[10px] text-gray-500">
                                                                <strong className="text-gray-700">{exp.expediente_code || `ID-${exp.id}`}</strong>
                                                                {exp.subserie ? ` · Subserie ${exp.subserie}` : ''}
                                                            </div>
                                                            {metaPills.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {metaPills.slice(0, 4).map((m, idx) => (
                                                                        <span key={idx} className="bg-gray-100 text-gray-700 border border-gray-200 rounded px-1.5 py-0.2 text-[10px] truncate max-w-[160px]">
                                                                            {String(m)}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {isLinked ? (
                                                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg flex items-center gap-1">
                                                                    <Check size={11} /> Vinculado
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => assignSingleExpedienteToActive(exp)}
                                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold"
                                                                        title="Asignar como único expediente de este archivo"
                                                                    >
                                                                        Asignar
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => addRelatedExpedienteToActive(exp)}
                                                                        className="bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-200 px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-0.5"
                                                                        title="Agregar como expediente adicional compartido"
                                                                    >
                                                                        <Plus size={12} /> Relacionar
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* STEP 2: TRD TYPOLOGY & METADATA */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <h2 className="text-sm font-extrabold text-gray-800 flex items-center gap-1.5">
                                        <FileText size={17} className="text-blue-600" />
                                        2. Tipología Documental TRD y Datos del Archivo
                                    </h2>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            disabled={activeItem.aiStatus === 'loading'}
                                            onClick={() => classifySingleItemWithAI(activeItem)}
                                            className="text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded-lg flex items-center gap-1"
                                        >
                                            <Sparkles size={12} /> {activeItem.aiStatus === 'loading' ? 'Analizando...' : 'IA'}
                                        </button>
                                        {checkedCount > 0 && activeItem.typologyName && (
                                            <button
                                                type="button"
                                                onClick={applyTypologyToChecked}
                                                className="text-[11px] font-bold bg-blue-100 hover:bg-blue-200 text-blue-900 px-2.5 py-1 rounded-lg"
                                            >
                                                📌 Aplicar tipología a {checkedCount}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {stagesInDropdown.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setStageFilter('ALL')}
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${stageFilter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                                        >
                                            Todas las etapas
                                        </button>
                                        {stagesInDropdown.map(st => (
                                            <button
                                                key={st}
                                                type="button"
                                                onClick={() => setStageFilter(st)}
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${stageFilter === st ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                                            >
                                                {st}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Interactive Pending TRD Typologies Helper when 1 expediente is selected */}
                                {singleTargetExpId && filteredDropdownTypologies.length > 0 && (() => {
                                    const normKey = (s) => normalizeStr(s).replace(/^\d+[\s._-]*/, '').replace(/[^a-z0-9]/g, '');
                                    const savedSet = new Set((activeExpDocs || []).map(d => normKey(d.typology_name)).filter(Boolean));
                                    const stagedSet = new Set(
                                        items
                                            .filter(it => it.id !== activeItem.id && it.saveState !== 'saved' && it.typologyName && it.targetExpedientes.some(e => Number(e.id) === Number(singleTargetExpId)))
                                            .map(it => normKey(it.typologyName))
                                    );
                                    const missingTyps = filteredDropdownTypologies.filter(t => {
                                        const k = normKey(t.name);
                                        return !savedSet.has(k) && !stagedSet.has(k);
                                    });
                                    const loadedCount = filteredDropdownTypologies.filter(t => savedSet.has(normKey(t.name))).length;
                                    return (
                                        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 space-y-2">
                                            <div className="flex items-center justify-between gap-2 text-[11px]">
                                                <span className="font-extrabold text-amber-900">
                                                    📋 Pendientes en este Expediente ({missingTyps.length} faltantes de {filteredDropdownTypologies.length})
                                                </span>
                                                <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]">
                                                    ✅ {loadedCount}/{filteredDropdownTypologies.length} guardadas
                                                </span>
                                            </div>
                                            {loadingExpDocs ? (
                                                <p className="text-[11px] text-gray-400">Consultando documentos del expediente...</p>
                                            ) : missingTyps.length === 0 ? (
                                                <p className="text-[11px] font-bold text-green-700">
                                                    🎉 Todas las tipologías de este filtro ya están cargadas o asignadas en bandeja.
                                                </p>
                                            ) : (
                                                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                                                    {missingTyps.map((t, idx) => {
                                                        const isSelected = activeItem.typologyName === t.name;
                                                        return (
                                                            <button
                                                                key={t.id || idx}
                                                                type="button"
                                                                onClick={() => {
                                                                    updateActiveItem({
                                                                        typologyName: t.name,
                                                                        customFilename: activeItem.customFilenameEdited
                                                                            ? activeItem.customFilename
                                                                            : buildPreviewFilename(t, t.name)
                                                                    });
                                                                }}
                                                                className={`text-left text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                                                                    isSelected
                                                                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                                                                        : 'bg-white hover:bg-amber-100 text-gray-800 border-amber-300'
                                                                }`}
                                                                title={`Clic para asignar "${t.name}"`}
                                                            >
                                                                #{String(t.trd_order || idx + 1).padStart(2, '0')} {t.name}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                <div className="space-y-1.5">
                                    <input
                                        type="text"
                                        value={typologyFilterText}
                                        onChange={(e) => setTypologyFilterText(e.target.value)}
                                        placeholder="Filtrar tipologías por palabra clave (ej: identidad, diploma, acta, certificado)..."
                                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-gray-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                    />
                                    <select
                                        value={activeItem.typologyName || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const matched = activeTypologies.find(t => t.name === val);
                                            updateActiveItem({
                                                typologyName: val,
                                                customFilename: activeItem.customFilenameEdited
                                                    ? activeItem.customFilename
                                                    : buildPreviewFilename(matched, val)
                                            });
                                        }}
                                        className="w-full border border-gray-300 rounded-xl p-2.5 text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">-- Seleccione la Tipología Oficial TRD ({filteredDropdownTypologies.length}) --</option>
                                        {activeItem.typologyName && !filteredDropdownTypologies.some(t => t.name === activeItem.typologyName) && (
                                            <option value={activeItem.typologyName}>{activeItem.typologyName}</option>
                                        )}
                                        {filteredDropdownTypologies.map((t, idx) => {
                                            const alreadyLoaded = singleTargetExpId && (activeExpDocs || []).some(
                                                d => normalizeStr(d.typology_name).replace(/^\d+[\s._-]*/, '').replace(/[^a-z0-9]/g, '') ===
                                                     normalizeStr(t.name).replace(/^\d+[\s._-]*/, '').replace(/[^a-z0-9]/g, '')
                                            );
                                            return (
                                                <option key={t.id || idx} value={t.name}>
                                                    {String(t.trd_order || idx + 1).padStart(2, '0')} - {t.name}{t.stage ? ` [${t.stage}]` : ''}{alreadyLoaded ? ' ✅ [Ya cargado]' : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>

                                {activeItem.aiReason && (
                                    <p className="text-[11px] text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-lg p-2">
                                        ✨ <strong>IA:</strong> {activeItem.aiReason}
                                    </p>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fecha Creación Documento</label>
                                        <input
                                            type="datetime-local"
                                            value={activeItem.documentDate}
                                            onChange={(e) => updateActiveItem({ documentDate: e.target.value })}
                                            className="w-full border border-gray-300 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Soporte / Origen</label>
                                        <select
                                            value={activeItem.origen}
                                            onChange={(e) => updateActiveItem({ origen: e.target.value })}
                                            className="w-full border border-gray-300 rounded-lg p-2 text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="ELECTRONICO">ELECTRÓNICO</option>
                                            <option value="FISICO">FÍSICO / DIGITALIZADO</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                                        {activeItem.targetExpedientes.length > 1
                                            ? 'Nombre TRD Automático (se secuencia individualmente en cada expediente)'
                                            : 'Nombre del Archivo Destino (Sin .pdf)'}
                                    </label>
                                    <input
                                        type="text"
                                        disabled={activeItem.targetExpedientes.length > 1}
                                        value={activeItem.customFilename}
                                        onChange={(e) => updateActiveItem({ customFilename: e.target.value, customFilenameEdited: true })}
                                        placeholder="Se generará con consecutivo TRD (ej: 01_Documento_Identidad)"
                                        className="w-full border border-gray-300 rounded-lg p-2 text-xs disabled:bg-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Descripción / Texto OCR (Opcional)</label>
                                    <textarea
                                        rows="2"
                                        value={activeItem.description}
                                        onChange={(e) => updateActiveItem({ description: e.target.value })}
                                        placeholder="Observaciones o texto extraído desde el visor derecho..."
                                        className="w-full border border-gray-300 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                {activeItem.saveState === 'saved' ? (
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-900 space-y-1">
                                        <div className="font-extrabold flex items-center gap-1.5">
                                            <CheckCircle2 size={16} className="text-green-600" />
                                            Guardado en {activeItem.savedDocs.length} expediente(s)
                                        </div>
                                        {activeItem.savedDocs.slice(0, 4).map(sd => (
                                            <div key={sd.id} className="text-[11px] text-green-800 truncate">
                                                • {sd.expediente_title || sd.expediente_code}: <strong>{sd.filename}</strong>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={!isItemReady(activeItem) || activeItem.saveState === 'saving'}
                                        onClick={() => saveSingleItem(activeItem)}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow transition-all"
                                    >
                                        <Save size={16} />
                                        {activeItem.saveState === 'saving'
                                            ? 'Guardando...'
                                            : activeItem.targetExpedientes.length > 1
                                                ? `Guardar y Relacionar en ${activeItem.targetExpedientes.length} Expedientes`
                                                : 'Guardar este Documento Ahora'}
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* RIGHT COLUMN: VISOR EN VIVO + OCR */}
                <div className="lg:col-span-4 sticky top-4">
                    {activeItem ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-gray-800 truncate flex items-center gap-1.5">
                                    <Eye size={14} className="text-emerald-600 shrink-0" />
                                    {activeItem.files[activeSubFileIdx]?.name || activeItem.displayName}
                                </span>
                                {activeItem.files.length > 1 && (
                                    <div className="flex items-center gap-1 shrink-0 text-[11px]">
                                        {activeItem.files.map((_, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setActiveSubFileIdx(idx)}
                                                className={`px-2 py-0.5 rounded font-bold ${activeSubFileIdx === idx ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                                            >
                                                #{idx + 1}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <BatchDocumentViewer
                                fileObj={activeItem.files[activeSubFileIdx]}
                                fileUrl={activeItem.urls[activeSubFileIdx]}
                                onSearchExpedienteText={(txt) => {
                                    setExpSearchTerm(txt);
                                    runExpedienteSearch(txt);
                                }}
                                onAppendDescriptionText={(txt) => {
                                    const cur = activeItem.description || '';
                                    updateActiveItem({ description: cur ? `${cur}\n${txt}` : txt });
                                }}
                            />
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 h-[420px] flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                            <Eye size={40} className="mb-2 opacity-30" />
                            <p className="text-sm font-semibold">Visor de Documentos e Imágenes con OCR</p>
                            <p className="text-xs mt-1 max-w-xs">
                                Seleccione cualquier archivo del lote para previsualizarlo y extraer Cédula o Nombre arrastrando el mouse.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <InventoryPdfModal
                isOpen={showInventoryPdfModal}
                onClose={() => setShowInventoryPdfModal(false)}
            />
        </div>
    );
}

export default BatchClassification;
