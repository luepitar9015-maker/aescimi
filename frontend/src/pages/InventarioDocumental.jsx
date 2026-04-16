import React, { useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import { Download, Plus, Trash2, FileText } from 'lucide-react';

// Logo SENA en base64 (SVG)
const SENA_LOGO_B64 = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3NSA3My41Ij48cGF0aCBmaWxsPSIjMzlBOTAwIiBkPSJNMzcuNzMgMC43N2E3Ljk3IDcuOTcgMCAxIDAgLjAxIDE1Ljk0IDcuOTcgNy45NyAwIDAgMC0uMDEtMTUuOTR6TTExLjQ1IDE5LjE3Yy0xLjQgMC0yLjgyLjA5LTQuMTYuNDItLjg4LjIyLTEuNzMuNTktMi4yOCAxLjE2LS42OS43MS0uNzggMS42OC0uNDQgMi41MS4zLjczIDEuMTIgMS4yOCAyLjAyIDEuNTkgMS45NS42NyA0LjEyLjgxIDYuMTcgMS4yMy4zOC4wOS43OC4xOSAxLjAzLjQ1LjI0LjMxLjEuNzMtLjMuOTItLjY3LjM0LTEuNTIuMzQtMi4yOS4zM0M4LjgzIDI2LjggOC4wNSAyNi43NCA3LjQ5IDI2LjRjLS40MS0uMjYtLjQ5LS44Ny0uMzktMS4wNmwtNC41NyAuMDFjLS4wMS43LjEyIDEuNDIuNjMgMi4wMi40My41MSAxLjExLjg3IDEuODUgMS4wOSAxLjE4LjM1IDIuNDYuNDUgMy43Mi40OCA1LjEuMDUgNi41Ni0uMzcgNy42Ny0xLjY2LjgzLS45OC44Ny0yLjY1LS4yLTMuNTMtLjc0LS40My0xLjYyLS43LTIuNTItLjg3LTEuMzItLjI3LTIuNjYtLjQ3LTMuOTktLjY5LS40Ny0uMDktLjk2LS4xNy0xLjM2LS4zOS0uNDEtLjIyLS40NS0uNzQtLjAzLS45Ny41NC0uMzEgMS4yNy0uMzEgMS45Mi0uMzEuNjkuMDEgMS40My4wNSAxLjk5LjM4LjMyLjE4LjQ0LjQ3LjQ1Ljc2bDQuMzUtLjAxYy0uMDItLjU1LS4xMi0xLjEyLS41Mi0xLjYtLjQ3LS41OS0xLjI5LS45NS0yLjEzLTEuMTctMS4zMy0uMzQtMi43NC0uNDEtNC4xMy0uNDF6bTkuNDMuMzNsLS4wMSAxMC4zOCAxMi42Ny4wMS0uMDEtMi4yNmgtNy41MnYtMS44M2g3LjE2di0yLjIxaC03LjE2di0xLjY1bDcuNzMtLjAwNC0uMDA0LTIuMjR6bTIwLjg3LjAwNHMtMy45MS4wMDEtNS44Ny4wMDFsLS4wMDEgMTAuMzggNC40NS4wMDEtLjAwMy02Ljk5IDYuMDkgNi45OCA2LjEuMDA2LS4wMDItMTAuMzgtNC40NS4wMDEuMDA1IDYuOTN6bTE4LjcuMDJzLTQuOCA2LjkzLTcuMjEgMTAuMzh6bTIuMzMgMi40OGwyLjIxIDMuNzYtNC41OC4wMDd6TTAgMzMuMjJsLjA0IDUuNjUgMjEuMTItLjA4YzEuMDguMjMgMS43LjkzIDEuNDggMi41M2wtMTIuOTkgMjIuNzQgNC4yMyAzLjk2IDIwLjEyLTM0Ljh6bTQwLjMgLjA1bDE5Ljc4IDM0LjY1IDQuMzctMy45My0xMy4xNC0yMi42OGMtLjIyLTEuNi40MDUtMi4zMSAxLjQ4LTIuNTRsMjEuMTIuMDgtLjAwNi01LjU2em0tMy4zNCA1LjczbC0xOC41NiAzMS44NSA0LjkzIDIuNCAxMi4zOC0yMC45MmMuNDMtLjM1Ljg2LS41MyAxLjI5LS41NS40Ni0uMDIuOTIuMTUgMS4zOC41MWwxMi4zNSAyMC45OSA1LjA4LTIuNjV6Ii8+PC9zdmc+`;

const camposVaciosItem = () => ({
    id: Date.now() + Math.random(),
    codigo: '',
    nombre: '',
    fIni: '',
    fFin: '',
    caja: '',
    carp: '',
    tomo: '',
    otro: '',
    fDel: '',
    fAl: '',
    soporte: 'F',
    frec: 'A',
    notas: '',
});

function InventarioDocumental() {
    // Encabezado
    const [sede, setSede] = useState('');
    const [nut, setNut] = useState('');
    const [unidad, setUnidad] = useState('');
    const [oficina, setOficina] = useState('');
    const [objeto, setObjeto] = useState('');
    const [anio, setAnio] = useState('');
    const [mes, setMes] = useState('');
    const [dia, setDia] = useState('');

    // Filas
    const [items, setItems] = useState(() => Array.from({ length: 5 }, camposVaciosItem));

    // Firmas
    const [nomElab, setNomElab] = useState('');
    const [carElab, setCarElab] = useState('');
    const [fecElab, setFecElab] = useState('');
    const [nomEntr, setNomEntr] = useState('');
    const [carEntr, setCarEntr] = useState('');
    const [fecEntr, setFecEntr] = useState('');
    const [nomReci, setNomReci] = useState('');
    const [carReci, setCarReci] = useState('');
    const [fecReci, setFecReci] = useState('');

    const [generando, setGenerando] = useState(false);
    const pdfRef = useRef(null);

    const agregarFila = () => {
        setItems(prev => [...prev, camposVaciosItem()]);
    };

    const eliminarFila = (id) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const actualizarItem = (id, campo, valor) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, [campo]: valor } : i));
    };

    const exportarPDF = async () => {
        setGenerando(true);
        if (pdfRef.current) pdfRef.current.style.display = 'block';
        try {
            const opt = {
                margin: 5,
                filename: `Inventario_GD_F_004_${nut || 'Sin_NUT'}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'legal', orientation: 'landscape' }
            };
            await html2pdf().set(opt).from(pdfRef.current).save();
        } catch (err) {
            console.error('Error al generar PDF:', err);
            alert('Hubo un error al generar el PDF.');
        } finally {
            if (pdfRef.current) pdfRef.current.style.display = 'none';
            setGenerando(false);
        }
    };

    const inputCls = "w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#39A900]";
    const tblInputCls = "w-full bg-transparent p-1 text-xs border-none outline-none focus:ring-1 focus:ring-blue-400 rounded";

    return (
        <div className="space-y-6">
            <style>{`
                .pdf-tbl { width:100%; border-collapse:collapse; font-family:Arial,sans-serif; font-size:8pt; color:black; }
                .pdf-tbl th, .pdf-tbl td { border:0.5pt solid black; padding:2pt 3pt; vertical-align:middle; }
                .pdf-bg { background-color:#e5e7eb !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
                .pdf-center { text-align:center; }
                .pdf-bold { font-weight:bold; }
                .inv-row:hover { background-color: #eff6ff; }
            `}</style>

            {/* ---- ENCABEZADO UI ---- */}
            <div className="bg-[#39A900] p-5 rounded-2xl shadow-lg text-white flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-white p-2 rounded-lg">
                        <FileText size={28} className="text-[#39A900]" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase italic tracking-tight">Inventario Documental</h2>
                        <p className="text-green-100 text-xs font-semibold uppercase tracking-widest">Formato Oficial GD-F-004 (V. 06)</p>
                    </div>
                </div>
                <button
                    onClick={exportarPDF}
                    disabled={generando}
                    className="bg-yellow-400 hover:bg-yellow-500 disabled:opacity-60 text-blue-900 font-black py-2.5 px-6 rounded-xl shadow transition-all flex items-center gap-2 uppercase text-xs italic"
                >
                    <Download size={18} />
                    {generando ? 'Generando PDF...' : 'Descargar Formato PDF'}
                </button>
            </div>

            {/* ---- FORMULARIO UI ---- */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 space-y-8">

                {/* BLOQUE 1: ENCABEZADO */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sede / Regional</label>
                            <input type="text" value={sede} onChange={e => setSede(e.target.value)} className={inputCls} placeholder="Regional / Centro" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">NUT (Número Único Transferencia)</label>
                            <input type="text" value={nut} onChange={e => setNut(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Unidad Administrativa</label>
                            <input type="text" value={unidad} onChange={e => setUnidad(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Oficina Productora</label>
                            <input type="text" value={oficina} onChange={e => setOficina(e.target.value)} className={inputCls} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Objeto</label>
                            <input type="text" value={objeto} onChange={e => setObjeto(e.target.value)} className={inputCls} />
                        </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <h3 className="text-[10px] font-bold text-blue-800 uppercase mb-3 text-center border-b pb-1">Registro de Entrada</h3>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="block text-[9px] text-gray-400 text-center uppercase">Año</label>
                                <input type="text" value={anio} onChange={e => setAnio(e.target.value)} className={inputCls + " text-center"} maxLength={4} placeholder="AAAA" />
                            </div>
                            <div>
                                <label className="block text-[9px] text-gray-400 text-center uppercase">Mes</label>
                                <input type="text" value={mes} onChange={e => setMes(e.target.value)} className={inputCls + " text-center"} maxLength={2} placeholder="MM" />
                            </div>
                            <div>
                                <label className="block text-[9px] text-gray-400 text-center uppercase">Día</label>
                                <input type="text" value={dia} onChange={e => setDia(e.target.value)} className={inputCls + " text-center"} maxLength={2} placeholder="DD" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* BLOQUE 2: TABLA */}
                <div className="border-t pt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base font-bold text-gray-800 italic">Relación de Documentos</h3>
                        <button
                            type="button"
                            onClick={agregarFila}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold py-2 px-4 rounded-lg flex items-center gap-1 uppercase tracking-wider shadow-sm transition-colors"
                        >
                            <Plus size={14} /> Añadir Ítem
                        </button>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="w-full text-left border-collapse min-w-[1100px]">
                            <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-600">
                                <tr>
                                    <th className="p-2 border" rowSpan={2}>Ítem</th>
                                    <th className="p-2 border" rowSpan={2}>Código</th>
                                    <th className="p-2 border" rowSpan={2}>Series / Subseries / Asuntos</th>
                                    <th className="p-2 border text-center" colSpan={2}>Fechas Extremas</th>
                                    <th className="p-2 border text-center" colSpan={4}>Unid. Conservación</th>
                                    <th className="p-2 border text-center" colSpan={2}>Folios</th>
                                    <th className="p-2 border" rowSpan={2}>Soporte</th>
                                    <th className="p-2 border" rowSpan={2}>Frec.</th>
                                    <th className="p-2 border" rowSpan={2}>Notas</th>
                                    <th className="p-2 border w-10" rowSpan={2}></th>
                                </tr>
                                <tr className="bg-gray-100 text-[9px]">
                                    <th className="p-1 border text-center">Ini</th>
                                    <th className="p-1 border text-center">Fin</th>
                                    <th className="p-1 border text-center w-12">Cajas</th>
                                    <th className="p-1 border text-center w-12">Carp</th>
                                    <th className="p-1 border text-center w-12">Tomo</th>
                                    <th className="p-1 border text-center w-12">Otro</th>
                                    <th className="p-1 border text-center w-12">Del</th>
                                    <th className="p-1 border text-center w-12">Al</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {items.map((item, idx) => (
                                    <tr key={item.id} className="inv-row transition-colors">
                                        <td className="p-2 border text-center text-xs font-bold text-gray-400">{idx + 1}</td>
                                        <td className="p-1 border"><input type="text" value={item.codigo} onChange={e => actualizarItem(item.id, 'codigo', e.target.value)} className={tblInputCls} /></td>
                                        <td className="p-1 border"><input type="text" value={item.nombre} onChange={e => actualizarItem(item.id, 'nombre', e.target.value)} className={tblInputCls} placeholder="Nombre serie..." /></td>
                                        <td className="p-1 border"><input type="text" value={item.fIni} onChange={e => actualizarItem(item.id, 'fIni', e.target.value)} className={tblInputCls + " text-center"} placeholder="AAAA" maxLength={4} /></td>
                                        <td className="p-1 border"><input type="text" value={item.fFin} onChange={e => actualizarItem(item.id, 'fFin', e.target.value)} className={tblInputCls + " text-center"} placeholder="AAAA" maxLength={4} /></td>
                                        <td className="p-1 border"><input type="text" value={item.caja} onChange={e => actualizarItem(item.id, 'caja', e.target.value)} className={tblInputCls + " text-center"} /></td>
                                        <td className="p-1 border"><input type="text" value={item.carp} onChange={e => actualizarItem(item.id, 'carp', e.target.value)} className={tblInputCls + " text-center"} /></td>
                                        <td className="p-1 border"><input type="text" value={item.tomo} onChange={e => actualizarItem(item.id, 'tomo', e.target.value)} className={tblInputCls + " text-center"} /></td>
                                        <td className="p-1 border"><input type="text" value={item.otro} onChange={e => actualizarItem(item.id, 'otro', e.target.value)} className={tblInputCls + " text-center"} /></td>
                                        <td className="p-1 border"><input type="text" value={item.fDel} onChange={e => actualizarItem(item.id, 'fDel', e.target.value)} className={tblInputCls + " text-center"} /></td>
                                        <td className="p-1 border"><input type="text" value={item.fAl} onChange={e => actualizarItem(item.id, 'fAl', e.target.value)} className={tblInputCls + " text-center"} /></td>
                                        <td className="p-1 border">
                                            <select value={item.soporte} onChange={e => actualizarItem(item.id, 'soporte', e.target.value)} className={tblInputCls}>
                                                <option value="F">Físico (F)</option>
                                                <option value="E">Electrónico (E)</option>
                                                <option value="H">Híbrido (H)</option>
                                            </select>
                                        </td>
                                        <td className="p-1 border">
                                            <select value={item.frec} onChange={e => actualizarItem(item.id, 'frec', e.target.value)} className={tblInputCls}>
                                                <option value="A">Alta (A)</option>
                                                <option value="M">Media (M)</option>
                                                <option value="B">Baja (B)</option>
                                            </select>
                                        </td>
                                        <td className="p-1 border"><input type="text" value={item.notas} onChange={e => actualizarItem(item.id, 'notas', e.target.value)} className={tblInputCls} /></td>
                                        <td className="p-2 border text-center">
                                            <button type="button" onClick={() => eliminarFila(item.id)} className="text-red-400 hover:text-red-600 transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* BLOQUE 3: FIRMAS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t pt-8">
                    {[
                        { titulo: 'Elaborado por', nom: nomElab, setNom: setNomElab, car: carElab, setCar: setCarElab, fec: fecElab, setFec: setFecElab },
                        { titulo: 'Entregado por', nom: nomEntr, setNom: setNomEntr, car: carEntr, setCar: setCarEntr, fec: fecEntr, setFec: setFecEntr },
                        { titulo: 'Recibido por', nom: nomReci, setNom: setNomReci, car: carReci, setCar: setCarReci, fec: fecReci, setFec: setFecReci },
                    ].map(({ titulo, nom, setNom, car, setCar, fec, setFec }) => (
                        <div key={titulo} className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <h4 className="text-[11px] font-black text-blue-700 uppercase tracking-widest text-center border-b pb-2">{titulo}</h4>
                            <input type="text" value={nom} onChange={e => setNom(e.target.value)} className={inputCls} placeholder="Nombre completo" />
                            <input type="text" value={car} onChange={e => setCar(e.target.value)} className={inputCls} placeholder="Cargo" />
                            <input type="date" value={fec} onChange={e => setFec(e.target.value)} className={inputCls} />
                        </div>
                    ))}
                </div>
            </div>

            {/* ==========================================
                PLANTILLA PDF OCULTA (FORMATO GD-F-004)
                ========================================== */}
            <div ref={pdfRef} style={{ display: 'none', backgroundColor: 'white', padding: '8mm', color: 'black' }}>
                <table className="pdf-tbl">
                    <colgroup>
                        <col style={{ width: '4%' }} />
                        <col style={{ width: '7%' }} />
                        <col style={{ width: '22%' }} />
                        <col style={{ width: '5%' }} />
                        <col style={{ width: '5%' }} />
                        <col style={{ width: '4%' }} />
                        <col style={{ width: '4%' }} />
                        <col style={{ width: '4%' }} />
                        <col style={{ width: '4%' }} />
                        <col style={{ width: '4%' }} />
                        <col style={{ width: '4%' }} />
                        <col style={{ width: '5%' }} />
                        <col style={{ width: '5%' }} />
                        <col style={{ width: '23%' }} />
                    </colgroup>
                    <tbody>
                        {/* ENCABEZADO INSTITUCIONAL */}
                        <tr>
                            <td rowSpan={4} colSpan={2} className="pdf-center pdf-bold" style={{ fontSize: '14pt', color: '#39A900', padding: '4pt' }}>
                                <img src={SENA_LOGO_B64} alt="SENA" style={{ height: '40pt', display: 'block', margin: '0 auto' }} />
                            </td>
                            <td rowSpan={4} colSpan={10} className="pdf-center pdf-bold" style={{ fontSize: '11pt' }}>
                                Proceso Gestión Documental<br />
                                <span style={{ fontSize: '10pt' }}>Formato Único de Inventario Documental</span>
                            </td>
                            <td colSpan={2} className="pdf-bg">Versión: 06</td>
                        </tr>
                        <tr>
                            <td colSpan={2} className="pdf-bg pdf-bold">Código: GD-F-004</td>
                        </tr>
                        <tr><td colSpan={2} style={{ border: 'none' }}></td></tr>
                        <tr><td colSpan={2} style={{ border: 'none' }}></td></tr>

                        {/* METADATOS SUPERIORES */}
                        <tr>
                            <td colSpan={2} className="pdf-bold pdf-bg">SEDE</td>
                            <td colSpan={4}>{sede}</td>
                            <td colSpan={5} className="pdf-bold pdf-bg pdf-center">REGISTRO DE ENTRADA</td>
                            <td colSpan={2} className="pdf-bold pdf-bg">NUT</td>
                        </tr>
                        <tr>
                            <td colSpan={2} className="pdf-bold pdf-bg">UNIDAD ADM.</td>
                            <td colSpan={4}>{unidad}</td>
                            <td className="pdf-bg pdf-bold pdf-center">AÑO</td>
                            <td className="pdf-center">{anio}</td>
                            <td className="pdf-bg pdf-bold pdf-center">MES</td>
                            <td className="pdf-center">{mes}</td>
                            <td className="pdf-bg pdf-bold pdf-center">DÍA</td>
                            <td className="pdf-center">{dia}</td>
                            <td colSpan={2} className="pdf-center">{nut}</td>
                        </tr>
                        <tr>
                            <td colSpan={2} className="pdf-bold pdf-bg">OFICINA PROD.</td>
                            <td colSpan={12}>{oficina}</td>
                        </tr>
                        <tr>
                            <td colSpan={2} className="pdf-bold pdf-bg">OBJETO</td>
                            <td colSpan={10}>{objeto}</td>
                            <td colSpan={2} className="pdf-bg pdf-bold pdf-center">Hoja ___ de ___</td>
                        </tr>

                        {/* ENCABEZADO TABLA */}
                        <tr className="pdf-bg pdf-center pdf-bold">
                            <td rowSpan={2}>No.<br />ÍTEM</td>
                            <td rowSpan={2}>CÓDIGO</td>
                            <td rowSpan={2}>NOMBRE DE LAS SERIES, SUBSERIES O ASUNTOS</td>
                            <td colSpan={2}>FECHAS EXTREMAS</td>
                            <td colSpan={4}>UNIDAD DE CONSERVACIÓN</td>
                            <td colSpan={2}>FOLIOS</td>
                            <td rowSpan={2}>SOPORTE</td>
                            <td rowSpan={2}>FREC.<br />CONS.</td>
                            <td rowSpan={2}>NOTAS</td>
                        </tr>
                        <tr className="pdf-bg pdf-center pdf-bold">
                            <td>INICIAL</td>
                            <td>FINAL</td>
                            <td>CAJA</td>
                            <td>CARPETA</td>
                            <td>TOMO</td>
                            <td>OTRO</td>
                            <td>DEL</td>
                            <td>AL</td>
                        </tr>

                        {/* FILAS DE DATOS */}
                        {Array.from({ length: Math.max(15, items.length) }).map((_, i) => {
                            const it = items[i];
                            if (it) {
                                return (
                                    <tr key={it.id}>
                                        <td className="pdf-center" style={{ height: '16pt' }}>{i + 1}</td>
                                        <td className="pdf-center">{it.codigo}</td>
                                        <td>{it.nombre}</td>
                                        <td className="pdf-center">{it.fIni}</td>
                                        <td className="pdf-center">{it.fFin}</td>
                                        <td className="pdf-center">{it.caja}</td>
                                        <td className="pdf-center">{it.carp}</td>
                                        <td className="pdf-center">{it.tomo}</td>
                                        <td className="pdf-center">{it.otro}</td>
                                        <td className="pdf-center">{it.fDel}</td>
                                        <td className="pdf-center">{it.fAl}</td>
                                        <td className="pdf-center">{it.soporte}</td>
                                        <td className="pdf-center">{it.frec}</td>
                                        <td>{it.notas}</td>
                                    </tr>
                                );
                            }
                            return (
                                <tr key={`empty-${i}`}>
                                    <td style={{ height: '16pt' }}></td><td></td><td></td><td></td><td></td>
                                    <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                                </tr>
                            );
                        })}

                        {/* PIE: FIRMAS */}
                        <tr className="pdf-bg pdf-bold">
                            <td colSpan={3} className="pdf-bold">NOMBRES Y APELLIDOS</td>
                            <td colSpan={4} className="pdf-center">ELABORADO POR</td>
                            <td colSpan={3} className="pdf-center">ENTREGADO POR</td>
                            <td colSpan={4} className="pdf-center">RECIBIDO POR</td>
                        </tr>
                        <tr>
                            <td colSpan={3} className="pdf-bg pdf-bold">NOMBRE</td>
                            <td colSpan={4}>{nomElab}</td>
                            <td colSpan={3}>{nomEntr}</td>
                            <td colSpan={4}>{nomReci}</td>
                        </tr>
                        <tr>
                            <td colSpan={3} className="pdf-bg pdf-bold">CARGO</td>
                            <td colSpan={4}>{carElab}</td>
                            <td colSpan={3}>{carEntr}</td>
                            <td colSpan={4}>{carReci}</td>
                        </tr>
                        <tr style={{ height: '28pt' }}>
                            <td colSpan={3} className="pdf-bg pdf-bold">FIRMA</td>
                            <td colSpan={4}></td>
                            <td colSpan={3}></td>
                            <td colSpan={4}></td>
                        </tr>
                        <tr>
                            <td colSpan={3} className="pdf-bg pdf-bold">FECHA</td>
                            <td colSpan={4}>{fecElab}</td>
                            <td colSpan={3}>{fecEntr}</td>
                            <td colSpan={4}>{fecReci}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default InventarioDocumental;
