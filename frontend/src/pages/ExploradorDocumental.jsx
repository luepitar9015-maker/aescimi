import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Folder, FolderOpen, FileText, Download, Archive,
    ChevronRight, ChevronDown, RefreshCw, HardDrive,
    CheckSquare, Square, Search, X, Home, AlertCircle, File
} from 'lucide-react';

// ── Utilidades ────────────────────────────────────────────────────────────────
const fmtSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
};
const fmtDate = (d) => d ? new Date(d).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const EXT_COLORS = {
    pdf:  'text-red-500',
    docx: 'text-blue-500', doc: 'text-blue-500',
    xlsx: 'text-green-600', xls: 'text-green-600',
    png:  'text-purple-500', jpg: 'text-purple-500', jpeg: 'text-purple-500', tif: 'text-purple-500',
    zip:  'text-amber-500', rar: 'text-amber-500',
    txt:  'text-gray-400',
};

// ── Nodo del árbol ─────────────────────────────────────────────────────────────
function TreeNode({ node, selected, onToggleSelect, onNavigate, depth = 0 }) {
    const [open, setOpen] = useState(depth < 1);
    const isFolder  = node.type === 'folder';
    const isSelected = selected.has(node.path);
    const extColor  = EXT_COLORS[node.ext] || 'text-gray-500';
    const hasChildren = isFolder && node.children?.length > 0;

    return (
        <div>
            <div
                className={`flex items-center gap-1.5 py-1 px-2 rounded-lg cursor-pointer select-none group transition-colors
                    ${isSelected ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100 text-gray-700'}`}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
                {/* Checkbox */}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleSelect(node); }}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Seleccionar"
                >
                    {isSelected
                        ? <CheckSquare size={14} className="text-blue-600" />
                        : <Square size={14} className="text-gray-400" />}
                </button>

                {/* Chevron o espacio */}
                {isFolder ? (
                    <button onClick={() => setOpen(o => !o)} className="flex-shrink-0">
                        {hasChildren
                            ? (open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />)
                            : <span className="w-3.5" />}
                    </button>
                ) : <span className="w-3.5 flex-shrink-0" />}

                {/* Ícono */}
                {isFolder
                    ? (open ? <FolderOpen size={15} className="text-amber-500 flex-shrink-0" /> : <Folder size={15} className="text-amber-500 flex-shrink-0" />)
                    : <FileText size={15} className={`${extColor} flex-shrink-0`} />}

                {/* Nombre */}
                <span
                    className="text-xs font-medium truncate flex-1"
                    onClick={() => isFolder ? setOpen(o => !o) : null}
                    title={node.name}
                >
                    {node.name}
                </span>

                {/* Tamaño (solo archivos) */}
                {!isFolder && (
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtSize(node.size)}</span>
                )}

                {/* Botón descargar archivo */}
                {!isFolder && (
                    <a
                        href={`/api/superuser/files/download?path=${encodeURIComponent(node.path)}`}
                        download
                        onClick={e => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1"
                        title="Descargar"
                    >
                        <Download size={13} className="text-blue-600 hover:text-blue-800" />
                    </a>
                )}
            </div>

            {/* Hijos */}
            {isFolder && open && hasChildren && (
                <div>
                    {node.children.map(child => (
                        <TreeNode
                            key={child.path}
                            node={child}
                            selected={selected}
                            onToggleSelect={onToggleSelect}
                            onNavigate={onNavigate}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Vista de lista (panel derecho) ────────────────────────────────────────────
function FileListView({ items, selected, onToggleSelect, onEnterFolder }) {
    if (!items.length) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16">
                <Folder size={48} className="mb-3 opacity-30" />
                <p className="font-medium">Carpeta vacía</p>
            </div>
        );
    }

    const folders = items.filter(i => i.type === 'folder').sort((a, b) => a.name.localeCompare(b.name));
    const files   = items.filter(i => i.type === 'file').sort((a, b) => a.name.localeCompare(b.name));

    return (
        <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="text-gray-500 uppercase text-[10px] font-bold border-b border-gray-200">
                    <th className="px-3 py-2 w-8">
                        <Square size={13} className="text-gray-400" />
                    </th>
                    <th className="px-2 py-2">Nombre</th>
                    <th className="px-2 py-2 w-24 text-right">Tamaño</th>
                    <th className="px-2 py-2 w-32">Modificado</th>
                    <th className="px-2 py-2 w-16 text-center">Acción</th>
                </tr>
            </thead>
            <tbody>
                {[...folders, ...files].map(item => {
                    const isSelected = selected.has(item.path);
                    const extColor   = EXT_COLORS[item.ext] || 'text-gray-500';
                    return (
                        <tr
                            key={item.path}
                            onDoubleClick={() => item.type === 'folder' && onEnterFolder(item)}
                            className={`border-b border-gray-50 group transition-colors cursor-default
                                ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                        >
                            <td className="px-3 py-1.5">
                                <button onClick={() => onToggleSelect(item)}>
                                    {isSelected
                                        ? <CheckSquare size={14} className="text-blue-600" />
                                        : <Square size={14} className="text-gray-300 group-hover:text-gray-500" />}
                                </button>
                            </td>
                            <td className="px-2 py-1.5">
                                <div className="flex items-center gap-2">
                                    {item.type === 'folder'
                                        ? <Folder size={15} className="text-amber-500 flex-shrink-0" />
                                        : <FileText size={15} className={`${extColor} flex-shrink-0`} />}
                                    <span className="font-medium text-gray-700 truncate max-w-[280px]" title={item.name}>
                                        {item.name}
                                    </span>
                                    {item.type === 'file' && (
                                        <span className="text-[9px] text-gray-400 uppercase bg-gray-100 px-1 rounded">
                                            {item.ext || '?'}
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="px-2 py-1.5 text-right text-gray-400">
                                {item.type === 'file' ? fmtSize(item.size) : (
                                    <span className="text-[10px] text-amber-600">{item.children?.length || 0} items</span>
                                )}
                            </td>
                            <td className="px-2 py-1.5 text-gray-400">{fmtDate(item.modified)}</td>
                            <td className="px-2 py-1.5 text-center">
                                {item.type === 'file' ? (
                                    <a
                                        href={`/api/superuser/files/download?path=${encodeURIComponent(item.path)}`}
                                        download
                                        className="text-blue-500 hover:text-blue-700 transition-colors"
                                        title="Descargar archivo"
                                    >
                                        <Download size={14} />
                                    </a>
                                ) : (
                                    <button
                                        onClick={() => onEnterFolder(item)}
                                        className="text-amber-500 hover:text-amber-700 transition-colors"
                                        title="Abrir carpeta"
                                    >
                                        <ChevronRight size={14} />
                                    </button>
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ExploradorDocumental() {
    const [tree,       setTree]       = useState([]);
    const [currentItems, setCurrentItems] = useState([]);
    const [breadcrumb, setBreadcrumb] = useState([]);           // [{name, path}]
    const [selected,   setSelected]   = useState(new Set());
    const [loading,    setLoading]    = useState(true);
    const [search,     setSearch]     = useState('');
    const [zipping,    setZipping]    = useState(false);
    const [rootPath,   setRootPath]   = useState('');
    const [error,      setError]      = useState('');

    const fetchFiles = useCallback(async (subPath = '') => {
        setLoading(true);
        setError('');
        try {
            const url = subPath ? `/api/superuser/files?path=${encodeURIComponent(subPath)}` : '/api/superuser/files';
            const res = await axios.get(url);
            setTree(res.data.items || []);
            setCurrentItems(res.data.items || []);
            setRootPath(res.data.storageRoot || '');
        } catch (err) {
            setError('Error al cargar el explorador. Verifique la ruta de almacenamiento.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchFiles(); }, [fetchFiles]);

    // Navegar a subcarpeta
    const enterFolder = (folder) => {
        setBreadcrumb(prev => [...prev, { name: folder.name, path: folder.path }]);
        const items = folder.children || [];
        setCurrentItems(items);
        setSelected(new Set());
        setSearch('');
    };

    // Ir a raíz o breadcrumb anterior
    const navigateTo = (idx) => {
        if (idx === -1) {
            setBreadcrumb([]);
            setCurrentItems(tree);
            setSelected(new Set());
            setSearch('');
        } else {
            const crumb = breadcrumb[idx];
            // Rebuild items by traversing tree
            let items = tree;
            for (let i = 0; i <= idx; i++) {
                const found = items.find(n => n.path === breadcrumb[i].path);
                if (found) items = found.children || [];
            }
            setBreadcrumb(prev => prev.slice(0, idx + 1));
            setCurrentItems(items);
            setSelected(new Set());
            setSearch('');
        }
    };

    // Selección en árbol o lista
    const toggleSelect = (node) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(node.path)) next.delete(node.path);
            else next.add(node.path);
            return next;
        });
    };

    // Seleccionar/deseleccionar todo lo visible
    const toggleAll = () => {
        const visible = filtered.map(i => i.path);
        const allSelected = visible.every(p => selected.has(p));
        setSelected(prev => {
            const next = new Set(prev);
            if (allSelected) visible.forEach(p => next.delete(p));
            else visible.forEach(p => next.add(p));
            return next;
        });
    };

    // Descargar selección como ZIP
    const descargarZip = async () => {
        if (selected.size === 0) return alert('Seleccione al menos un archivo o carpeta.');
        setZipping(true);
        try {
            const res = await axios.post('/api/superuser/files/zip', {
                paths: Array.from(selected),
                zipName: `Documentos_SENA_${new Date().toISOString().split('T')[0]}`
            }, { responseType: 'blob' });

            const blobUrl = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `Documentos_SENA_${new Date().toISOString().split('T')[0]}.zip`;
            a.click();
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            alert('Error al generar el ZIP. Intente nuevamente.');
        } finally {
            setZipping(false);
        }
    };

    const filtered = currentItems.filter(i =>
        !search || i.name.toLowerCase().includes(search.toLowerCase())
    );

    const totalFiles   = filtered.filter(i => i.type === 'file').length;
    const totalFolders = filtered.filter(i => i.type === 'folder').length;

    return (
        <div className="flex flex-col h-full bg-gray-50 min-h-screen">
            {/* ─── CABECERA ─── */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-2 rounded-xl text-white shadow">
                        <HardDrive size={22} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-gray-800">Explorador Documental</h1>
                        <p className="text-xs text-gray-400 truncate max-w-xs" title={rootPath}>
                            {rootPath || 'Cargando ruta...'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {selected.size > 0 && (
                        <span className="text-xs bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-full">
                            {selected.size} seleccionado{selected.size !== 1 ? 's' : ''}
                        </span>
                    )}
                    <button
                        onClick={descargarZip}
                        disabled={selected.size === 0 || zipping}
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md transition-all"
                    >
                        <Archive size={15} />
                        {zipping ? 'Comprimiendo...' : `Descargar ZIP${selected.size > 0 ? ` (${selected.size})` : ''}`}
                    </button>
                    <button
                        onClick={() => { fetchFiles(); setBreadcrumb([]); setSelected(new Set()); }}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Recargar"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* ─── BARRA DE RUTA + BÚSQUEDA ─── */}
            <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-3">
                {/* Breadcrumb */}
                <div className="flex items-center gap-1 text-xs flex-1 min-w-0 overflow-x-auto">
                    <button
                        onClick={() => navigateTo(-1)}
                        className="flex items-center gap-1 hover:text-purple-700 text-gray-500 font-semibold flex-shrink-0"
                    >
                        <Home size={13} /> Raíz
                    </button>
                    {breadcrumb.map((crumb, idx) => (
                        <React.Fragment key={crumb.path}>
                            <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
                            <button
                                onClick={() => navigateTo(idx)}
                                className={`hover:text-purple-700 font-semibold truncate max-w-[120px] flex-shrink-0
                                    ${idx === breadcrumb.length - 1 ? 'text-purple-700' : 'text-gray-500'}`}
                                title={crumb.name}
                            >
                                {crumb.name}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                {/* Búsqueda */}
                <div className="relative flex-shrink-0">
                    <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar en carpeta..."
                        className="pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 w-48"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                            <X size={12} className="text-gray-400 hover:text-gray-600" />
                        </button>
                    )}
                </div>
            </div>

            {/* ─── CUERPO ─── */}
            {error ? (
                <div className="flex flex-col items-center justify-center flex-1 py-20 text-red-500">
                    <AlertCircle size={40} className="mb-3" />
                    <p className="font-bold">{error}</p>
                </div>
            ) : loading ? (
                <div className="flex flex-col items-center justify-center flex-1 py-20 text-gray-400">
                    <div className="w-8 h-8 border-4 border-purple-300 border-t-purple-700 rounded-full animate-spin mb-3" />
                    <p className="text-sm">Cargando estructura de archivos...</p>
                </div>
            ) : (
                <div className="flex flex-1 overflow-hidden">
                    {/* Panel izquierdo — árbol */}
                    <div className="w-72 flex-shrink-0 bg-white border-r border-gray-100 overflow-y-auto p-2">
                        <div className="text-[10px] font-bold text-gray-400 uppercase px-2 py-1.5 mb-1">
                            Estructura de carpetas
                        </div>
                        {tree.length === 0 ? (
                            <div className="text-xs text-gray-400 px-3 py-6 text-center">
                                <File size={24} className="mx-auto mb-2 opacity-30" />
                                Sin archivos en la ruta configurada
                            </div>
                        ) : tree.map(node => (
                            <TreeNode
                                key={node.path}
                                node={node}
                                selected={selected}
                                onToggleSelect={toggleSelect}
                                onNavigate={enterFolder}
                                depth={0}
                            />
                        ))}
                    </div>

                    {/* Panel derecho — lista de contenido */}
                    <div className="flex-1 overflow-y-auto flex flex-col">
                        {/* Barra de info + acciones */}
                        <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-100 px-4 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-4 text-[11px] text-gray-500">
                                <span><strong className="text-gray-700">{totalFolders}</strong> carpetas</span>
                                <span><strong className="text-gray-700">{totalFiles}</strong> archivos</span>
                                {search && <span className="text-purple-600 font-semibold">Filtrando: "{search}"</span>}
                            </div>
                            <button
                                onClick={toggleAll}
                                className="text-[11px] text-blue-600 hover:underline font-semibold"
                            >
                                {filtered.every(i => selected.has(i.path)) ? 'Deseleccionar todo' : 'Seleccionar todo'}
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <FileListView
                                items={filtered}
                                selected={selected}
                                onToggleSelect={toggleSelect}
                                onEnterFolder={enterFolder}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
