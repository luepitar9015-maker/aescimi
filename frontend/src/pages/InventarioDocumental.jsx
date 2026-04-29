import { useRef, useState, useEffect } from 'react';
import axios from 'axios';

const SENA_SVG = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3NSA3My41Ij48cGF0aCBmaWxsPSIjMzlBOTAwIiBkPSJNMzcuNzMgMC43N2E3Ljk3IDcuOTcgMCAxIDAgLjAxIDE1Ljk0IDcuOTcgNy45NyAwIDAgMC0uMDEtMTUuOTR6TTExLjQ1IDE5LjE3Yy0xLjQgMC0yLjgyLjA5LTQuMTYuNDItLjg4LjIyLTEuNzMuNTktMi4yOCAxLjE2LS42OS43MS0uNzggMS42OC0uNDQgMi41MS4zLjczIDEuMTIgMS4yOCAyLjAyIDEuNTkgMS45NS42NyA0LjEyLjgxIDYuMTcgMS4yMy4zOC4wOS43OC4xOSAxLjAzLjQ1LjI0LjMxLjEuNzMtLjMuOTItLjY3LjM0LTEuNTIuMzQtMi4yOS4zM0M4LjgzIDI2LjggOC4wNSAyNi43NCA3LjQ5IDI2LjRjLS40MS0uMjYtLjQ5LS44Ny0uMzktMS4wNmwtNC41NyAuMDFjLS4wMS43LjEyIDEuNDIuNjMgMi4wMi40My41MSAxLjExLjg3IDEuODUgMS4wOSAxLjE4LjM1IDIuNDYuNDUgMy43Mi40OCA1LjEuMDUgNi41Ni0uMzcgNy42Ny0xLjY2LjgzLS45OC44Ny0yLjY1LS4yLTMuNTMtLjc0LS40My0xLjYyLS43LTIuNTItLjg3LTEuMzItLjI3LTIuNjYtLjQ3LTMuOTktLjY5LS40Ny0uMDktLjk2LS4xNy0xLjM2LS4zOS0uNDEtLjIyLS40NS0uNzQtLjAzLS45Ny41NC0uMzEgMS4yNy0uMzEgMS45Mi0uMzEuNjkuMDEgMS40My4wNSAxLjk5LjM4LjMyLjE4LjQ0LjQ3LjQ1Ljc2bDQuMzUtLjAxYy0uMDItLjU1LS4xMi0xLjEyLS41Mi0xLjYtLjQ3LS41OS0xLjI5LS45NS0yLjEzLTEuMTctMS4zMy0uMzQtMi43NC0uNDEtNC4xMy0uNDF6bTkuNDMuMzNsLS4wMSAxMC4zOCAxMi42Ny4wMS0uMDEtMi4yNmgtNy41MnYtMS44M2g3LjE2di0yLjIxaC03LjE2di0xLjY1bDcuNzMtLjAwNC0uMDA0LTIuMjR6bTIwLjg3LjAwNHMtMy45MS4wMDEtNS44Ny4wMDFsLS4wMDEgMTAuMzggNC40NS4wMDEtLjAwMy02Ljk5IDYuMDkgNi45OCA2LjEuMDA2LS4wMDItMTAuMzgtNC40NS4wMDEuMDA1IDYuOTN6bTE4LjcuMDJzLTQuOCA2LjkzLTcuMjEgMTAuMzh6bTIuMzMgMi40OGwyLjIxIDMuNzYtNC41OC4wMDd6TTAgMzMuMjJsLjA0IDUuNjUgMjEuMTItLjA4YzEuMDguMjMgMS43LjkzIDEuNDggMi41M2wtMTIuOTkgMjIuNzQgNC4yMyAzLjk2IDIwLjEyLTM0Ljh6bTQwLjMgLjA1bDE5Ljc4IDM0LjY1IDQuMzctMy45My0xMy4xNC0yMi42OGMtLjIyLTEuNi40MDUtMi4zMSAxLjQ4LTIuNTRsMjEuMTIuMDgtLjAwNi01LjU2em0tMy4zNCA1LjczbC0xOC41NiAzMS44NSA0LjkzIDIuNCAxMi4zOC0yMC45MmMuNDMtLjM1Ljg2LS41MyAxLjI5LS41NS40Ni0uMDIuOTIuMTUgMS4zOC41MWwxMi4zNSAyMC45OSA1LjA4LTIuNjV6Ii8+PC9zdmc+`;

const estilos = `
  body.inv-export { padding:0!important; margin:0!important; background:#fff!important; }
  body.inv-export .inv-acciones, body.inv-export #inv-toast { display:none!important; }
  .inv-hoja { background:#fff; width:1056px; padding:28px 36px; box-sizing:border-box; margin:0 auto 24px; }
  .inv-box { width:100%; border:1.5px solid #000; background:#fff; box-sizing:border-box; }
  .inv-tbl { width:100%; border-collapse:collapse; table-layout:fixed; }
  .inv-tbl td { border:1px solid #000; padding:3px 4px; vertical-align:middle; font-size:10px; font-family:Arial,sans-serif; line-height:1.2; word-wrap:break-word; }
  .inv-tbl:not(:first-child) tr:first-child td { border-top:none; }
  .inv-tbl tr td:first-child { border-left:none; }
  .inv-tbl tr td:last-child { border-right:none; }
  .inv-tbl:last-child tr:last-child td { border-bottom:none; }
  .inv-tbl:first-child tr:first-child td { border-top:none; }
  .ed { width:100%; min-height:14px; outline:none; cursor:text; }
  .ed:hover { background:#f0f8ff; }
  .ed:focus { background:#fffbdd; }
  .ed-inline { display:inline-block; min-width:18px; border-bottom:1px solid #000; text-align:center; outline:none; margin:0 2px; }
  #tablaInv thead td { padding:5px 2px; font-size:8.5px; }
  @media print {
    body { background:#fff; padding:0; }
    .inv-hoja { box-shadow:none; padding:0; margin:0; width:100%; }
    .inv-acciones, #inv-toast { display:none!important; }
  }
`;

function fila(n) {
    return { n, cod:'', nombre:'', ini:'', fin:'', caja:'', carp:'', tomo:'', otro:'', del:'', al:'', sop:'', frec:'', notas:'' };
}

export default function InventarioDocumental() {
    const docRef = useRef(null);
    const [generando, setGenerando] = useState(false);
    const [toast, setToast] = useState(null);
    const [filas, setFilas] = useState(() => Array.from({length:8}, (_,i) => fila(i+1)));
    const [sedeName, setSedeName] = useState('');
    const [centroName, setCentroName] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get('/api/organization');
                if (res.data && res.data.data && res.data.data.length > 0) {
                    // Tomamos el nombre de la regional del primer registro
                    setSedeName(res.data.data[0].regional_name || '');
                    setCentroName(res.data.data[0].center_name || '');
                }
            } catch (err) {
                console.error("Error fetching organization data:", err);
            }
        };
        fetchData();
    }, []);

    // Campos encabezado (refs para leer al exportar sin re-renders)
    const mostrarToast = (msg, tipo='info') => {
        setToast({ msg, tipo });
        setTimeout(() => setToast(null), 4000);
    };

    const agregarFila = () => setFilas(p => [...p, fila(p.length + 1)]);

    const upd = (idx, campo, val) => setFilas(p => p.map((f,i) => i===idx ? {...f,[campo]:val} : f));

    const exportarPDF = async () => {
        if (!window.html2pdf) {
            mostrarToast('❌ Librería html2pdf no cargada', 'error');
            return;
        }
        setGenerando(true);
        mostrarToast('⏳ Generando PDF...', 'info');
        document.body.classList.add('inv-export');
        window.scrollTo(0,0);
        try {
            await window.html2pdf().set({
                margin: 0,
                filename: 'FUID_GD_F_004_SENA.pdf',
                image: { type:'jpeg', quality:1.0 },
                html2canvas: { scale:2, useCORS:true, width:1056, windowWidth:1056, x:0, y:0, scrollX:0, scrollY:0 },
                jsPDF: { unit:'in', format:'letter', orientation:'landscape' }
            }).from(docRef.current).save();
            mostrarToast('✅ PDF descargado correctamente', 'exito');
        } catch(e) {
            mostrarToast('❌ Error al generar PDF', 'error');
        } finally {
            document.body.classList.remove('inv-export');
            setGenerando(false);
        }
    };

    const toastColor = toast?.tipo === 'exito' ? '#4CAF50' : toast?.tipo === 'error' ? '#f44336' : '#2196F3';

    const tdCls = 'inv-tbl';
    const C = ({children, cls='', ...p}) => <td className={cls} {...p}>{children}</td>;

    const EdDiv = ({cls='', ...p}) => (
        <div className={`ed ${cls}`} contentEditable suppressContentEditableWarning {...p} />
    );

    return (
        <>
            <style>{estilos}</style>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" />

            {/* TOAST */}
            {toast && (
                <div id="inv-toast" style={{
                    position:'fixed', top:20, left:'50%', transform:'translateX(-50%)',
                    padding:'12px 28px', color:'#fff', fontWeight:'bold', fontSize:14,
                    borderRadius:8, zIndex:9999, backgroundColor:toastColor, fontFamily:'Arial'
                }}>{toast.msg}</div>
            )}

            {/* BARRA DE ACCIONES */}
            <div className="inv-acciones" style={{marginBottom:16, display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap'}}>
                <button
                    onClick={exportarPDF}
                    disabled={generando}
                    style={{padding:'10px 22px', fontWeight:'bold', fontSize:13, cursor:'pointer',
                        background:'#39A900', color:'#fff', border:'none', borderRadius:6, boxShadow:'0 2px 6px rgba(0,0,0,.2)'}}
                >
                    {generando ? '⏳ Generando...' : '⬇️ Descargar PDF (Tamaño Carta)'}
                </button>
                <button
                    onClick={agregarFila}
                    style={{padding:'10px 22px', fontWeight:'bold', fontSize:13, cursor:'pointer',
                        background:'#0078D7', color:'#fff', border:'none', borderRadius:6}}
                >
                    ➕ Añadir fila
                </button>
            </div>

            {/* DOCUMENTO PDF */}
            <div ref={docRef} className="inv-hoja">
                <div className="inv-box">

                    {/* ── TABLA 1: ENCABEZADO INSTITUCIONAL ── */}
                    <table className={tdCls}>
                        <colgroup><col style={{width:'85%'}}/><col style={{width:'15%'}}/></colgroup>
                        <tbody>
                            <tr>
                                <td rowSpan={2} style={{textAlign:'center', padding:8}}>
                                    <img src={SENA_SVG} alt="SENA" style={{width:70, height:'auto'}} />
                                </td>
                                <td style={{fontSize:11, paddingLeft:5}}>Versión: 06</td>
                            </tr>
                            <tr>
                                <td style={{fontSize:11, paddingLeft:5}}>Código:<br/>GD-F-004</td>
                            </tr>
                            <tr>
                                <td colSpan={2} style={{textAlign:'center', fontWeight:'bold', fontSize:12}}>Proceso Gestión Documental</td>
                            </tr>
                            <tr>
                                <td colSpan={2} style={{textAlign:'center', fontWeight:'bold', fontSize:12}}>Formato Único de Inventario Documental</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* ── TABLA 2: DATOS DE CABECERA ── */}
                    <table className={tdCls}>
                        <colgroup>
                            <col style={{width:'16%'}}/><col style={{width:'37%'}}/>
                            <col style={{width:'8%'}}/><col style={{width:'10%'}}/><col style={{width:'10%'}}/>
                            <col style={{width:'19%'}}/>
                        </colgroup>
                        <tbody>
                            <tr>
                                <td style={{fontWeight:'bold'}}>SEDE</td>
                                <td><div style={{width:'100%', minHeight:'14px', padding:'0 2px'}}>{sedeName}</div></td>
                                <td colSpan={3} style={{textAlign:'center', fontWeight:'bold', fontSize:9}}>REGISTRO DE ENTRADA</td>
                                <td style={{textAlign:'center', fontWeight:'bold', fontSize:9}}>NUT - NÚMERO ÚNICO DE<br/>TRANSFERENCIA</td>
                            </tr>
                            <tr>
                                <td style={{fontWeight:'bold'}}>UNIDAD ADMINISTRATIVA</td>
                                <td><div style={{width:'100%', minHeight:'14px', padding:'0 2px'}}>{centroName}</div></td>
                                <td style={{textAlign:'center', fontSize:10}}>AÑO</td>
                                <td style={{textAlign:'center', fontSize:10}}>MES</td>
                                <td style={{textAlign:'center', fontSize:10}}>DIA</td>
                                <td rowSpan={2}><EdDiv cls="text-center" style={{height:'100%'}} /></td>
                            </tr>
                            <tr>
                                <td style={{fontWeight:'bold'}}>OFICINA PRODUCTORA</td>
                                <td><EdDiv /></td>
                                <td><EdDiv cls="text-center" /></td>
                                <td><EdDiv cls="text-center" /></td>
                                <td><EdDiv cls="text-center" /></td>
                            </tr>
                            <tr>
                                <td style={{fontWeight:'bold'}}>OBJETO:</td>
                                <td colSpan={4}><EdDiv /></td>
                                <td style={{textAlign:'right', fontWeight:'bold', fontSize:11, paddingRight:16}}>
                                    Hoja{' '}
                                    <span className="ed-inline" contentEditable suppressContentEditableWarning />
                                    {' '}de{' '}
                                    <span className="ed-inline" contentEditable suppressContentEditableWarning />
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* ── TABLA 3: INVENTARIO ── */}
                    <table className={tdCls} id="tablaInv">
                        <colgroup>
                            <col style={{width:'5%'}}/><col style={{width:'6%'}}/><col style={{width:'25%'}}/>
                            <col style={{width:'5%'}}/><col style={{width:'5%'}}/>
                            <col style={{width:'4%'}}/><col style={{width:'5%'}}/><col style={{width:'4%'}}/><col style={{width:'4%'}}/>
                            <col style={{width:'4%'}}/><col style={{width:'4%'}}/>
                            <col style={{width:'9%'}}/><col style={{width:'11%'}}/><col style={{width:'9%'}}/>
                        </colgroup>
                        <thead>
                            <tr style={{textAlign:'center', fontWeight:'bold'}}>
                                <td rowSpan={2}>No.<br/>ITEM</td>
                                <td rowSpan={2}>CÓDIGO</td>
                                <td rowSpan={2}>NOMBRE DE LAS SERIES, SUBSERIES O ASUNTOS</td>
                                <td colSpan={2}>FECHAS EXTREMAS</td>
                                <td colSpan={4}>UNIDAD DE CONSERVACIÓN</td>
                                <td colSpan={2}>FOLIOS</td>
                                <td rowSpan={2}>SOPORTE</td>
                                <td rowSpan={2}>FRECUENCIA<br/>DE CONSULTA</td>
                                <td rowSpan={2}>NOTAS</td>
                            </tr>
                            <tr style={{textAlign:'center', fontWeight:'bold'}}>
                                <td>INICIAL</td><td>FINAL</td>
                                <td>CAJA</td><td>CARPETA</td><td>TOMO</td><td>OTRO</td>
                                <td>DEL</td><td>AL</td>
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map((f,i) => (
                                <tr key={i}>
                                    <td><EdDiv cls="text-center">{f.n}</EdDiv></td>
                                    <td><EdDiv cls="text-center">{f.cod}</EdDiv></td>
                                    <td><EdDiv>{f.nombre}</EdDiv></td>
                                    <td><EdDiv cls="text-center">{f.ini}</EdDiv></td>
                                    <td><EdDiv cls="text-center">{f.fin}</EdDiv></td>
                                    <td><EdDiv cls="text-center">{f.caja}</EdDiv></td>
                                    <td><EdDiv cls="text-center">{f.carp}</EdDiv></td>
                                    <td><EdDiv cls="text-center">{f.tomo}</EdDiv></td>
                                    <td><EdDiv cls="text-center">{f.otro}</EdDiv></td>
                                    <td><EdDiv cls="text-center">{f.del}</EdDiv></td>
                                    <td><EdDiv cls="text-center">{f.al}</EdDiv></td>
                                    <td><EdDiv cls="text-center">{f.sop}</EdDiv></td>
                                    <td><EdDiv cls="text-center">{f.frec}</EdDiv></td>
                                    <td><EdDiv>{f.notas}</EdDiv></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* ── TABLA 4: FIRMAS ── */}
                    <table className={tdCls}>
                        <colgroup>
                            <col style={{width:'19%'}}/><col style={{width:'27%'}}/>
                            <col style={{width:'27%'}}/><col style={{width:'27%'}}/>
                        </colgroup>
                        <tbody>
                            <tr style={{textAlign:'center', fontWeight:'bold'}}>
                                <td></td>
                                <td>ELABORADO POR</td>
                                <td>ENTREGADO POR</td>
                                <td>RECIBIDO POR</td>
                            </tr>
                            <tr style={{fontWeight:'bold'}}>
                                <td style={{textAlign:'center'}}>NOMBRES Y APELLIDOS</td>
                                <td><EdDiv cls="text-center" /></td>
                                <td><EdDiv cls="text-center" /></td>
                                <td><EdDiv cls="text-center" /></td>
                            </tr>
                            <tr style={{fontWeight:'bold'}}>
                                <td style={{textAlign:'center'}}>CARGO</td>
                                <td><EdDiv cls="text-center" /></td>
                                <td><EdDiv cls="text-center" /></td>
                                <td><EdDiv cls="text-center" /></td>
                            </tr>
                            <tr style={{fontWeight:'bold'}}>
                                <td style={{textAlign:'center', height:42, verticalAlign:'top', paddingTop:5}}>FIRMA</td>
                                <td></td><td></td><td></td>
                            </tr>
                            <tr style={{fontWeight:'bold'}}>
                                <td style={{textAlign:'center'}}>FECHA</td>
                                <td><EdDiv cls="text-center" /></td>
                                <td><EdDiv cls="text-center" /></td>
                                <td><EdDiv cls="text-center" /></td>
                            </tr>
                        </tbody>
                    </table>

                </div>
            </div>
        </>
    );
}
