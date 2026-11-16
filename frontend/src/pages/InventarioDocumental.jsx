import { useState, useEffect } from 'react';
import axios from 'axios';

const SENA_SVG = `data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIgogICB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgd2lkdGg9IjEwMCIKICAgaGVpZ2h0PSI5OCIKICAgdmlld0JveD0iMCAwIDc0Ljk5OTk5NyA3My41IgogICB2ZXJzaW9uPSIxLjEiCiAgIGlkPSJzdmcxMiIKICAgc29kaXBvZGk6ZG9jbmFtZT0iU0VOQSBsb2dvLnN2ZyIKICAgaW5rc2NhcGU6dmVyc2lvbj0iMC45Mi40ICg1ZGE2ODljMzEzLCAyMDE5LTAxLTE0KSI+CiAgPHRpdGxlCiAgICAgaWQ9InRpdGxlMjIyIj5TRU5BIENvbG9tYmlhIGxvZ288L3RpdGxlPgogIDxtZXRhZGF0YQogICAgIGlkPSJtZXRhZGF0YTE4Ij4KICAgIDxyZGY6UkRGPgogICAgICA8Y2M6V29yawogICAgICAgICByZGY6YWJvdXQ9IiI+CiAgICAgICAgPGRjOmZvcm1hdD5pbWFnZS9zdmcreG1sPC9kYzpmb3JtYXQ+CiAgICAgICAgPGRjOnR5cGUKICAgICAgICAgICByZGY6cmVzb3VyY2U9Imh0dHA6Ly9wdXJsLm9yZy9kYy9kY21pdHlwZS9TdGlsbEltYWdlIiAvPgogICAgICAgIDxkYzp0aXRsZT5TRU5BIENvbG9tYmlhIGxvZ288L2RjOnRpdGxlPgogICAgICA8L2NjOldvcms+CiAgICA8L3JkZjpSREY+CiAgPC9tZXRhZGF0YT4KICA8ZGVmcwogICAgIGlkPSJkZWZzMTYiPgogICAgPHBhdHRlcm4KICAgICAgIHk9IjAiCiAgICAgICB4PSIwIgogICAgICAgaGVpZ2h0PSI2IgogICAgICAgd2lkdGg9IjYiCiAgICAgICBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9IkVNRmhiYXNlcGF0dGVybiIgLz4KICAgIDxwYXR0ZXJuCiAgICAgICB5PSIwIgogICAgICAgeD0iMCIKICAgICAgIGhlaWdodD0iNiIKICAgICAgIHdpZHRoPSI2IgogICAgICAgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJFTUZoYmFzZXBhdHRlcm4tMCIgLz4KICA8L2RlZnM+CiAgPHNvZGlwb2RpOm5hbWVkdmlldwogICAgIHBhZ2Vjb2xvcj0iI2ZmZmZmZiIKICAgICBib3JkZXJjb2xvcj0iIzY2NjY2NiIKICAgICBib3JkZXJvcGFjaXR5PSIxIgogICAgIG9iamVjdHRvbGVyYW5jZT0iMSIKICAgICBncmlkdG9sZXJhbmNlPSIxIgogICAgIGd1aWRldG9sZXJhbmNlPSIxIgogICAgIGlua3NjYXBlOnBhZ2VvcGFjaXR5PSIwIgogICAgIGlua3NjYXBlOnBhZ2VzaGFkb3c9IjIiCiAgICAgaW5rc2NhcGU6d2luZG93LXdpZHRoPSIxMzY2IgogICAgIGlua3NjYXBlOndpbmRvdy1oZWlnaHQ9IjcwNSIKICAgICBpZD0ibmFtZWR2aWV3MTQiCiAgICAgc2hvd2dyaWQ9ImZhbHNlIgogICAgIHVuaXRzPSJweCIKICAgICBpbmtzY2FwZTpzaG93cGFnZXNoYWRvdz0iZmFsc2UiCiAgICAgaW5rc2NhcGU6em9vbT0iMSIKICAgICBpbmtzY2FwZTpjeD0iOTYuMjY1MTA0IgogICAgIGlua3NjYXBlOmN5PSI1Ni43NDcyOTQiCiAgICAgaW5rc2NhcGU6d2luZG93LXg9Ii04IgogICAgIGlua3NjYXBlOndpbmRvdy15PSItOCIKICAgICBpbmtzY2FwZTp3aW5kb3ctbWF4aW1pemVkPSIxIgogICAgIGlua3NjYXBlOmN1cnJlbnQtbGF5ZXI9InN2ZzEyIj4KICAgIDxpbmtzY2FwZTpncmlkCiAgICAgICB0eXBlPSJ4eWdyaWQiCiAgICAgICBpZD0iZ3JpZDU4IiAvPgogIDwvc29kaXBvZGk6bmFtZWR2aWV3PgogIDxnCiAgICAgaWQ9IiNmZmZmZmZmZiIKICAgICB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwLC0xMzAuNSkiIC8+CiAgPHBhdGgKICAgICBzdHlsZT0iZmlsbDojMzlBOTAwO2ZpbGwtb3BhY2l0eToxO3N0cm9rZTpub25lO3N0cm9rZS13aWR0aDowLjE1MzU2Njk0cHg7c3Ryb2tlLWxpbmVjYXA6YnV0dDtzdHJva2UtbGluZWpvaW46bWl0ZXI7c3Ryb2tlLW1pdGVybGltaXQ6NDtzdHJva2UtZGFzaGFycmF5Om5vbmU7c3Ryb2tlLW9wYWNpdHk6MSIKICAgICBkPSJNIDM3LjcyOTMxMiwwLjc2NzA5MjExIEEgNy45NjcxMjI1LDcuOTY3MTIyNSAwIDAgMCAyOS43NzMzNzEsOC43NDE1NDUgNy45NjcxMjI1LDcuOTY3MTIyNSAwIDAgMCAzNy43NDQ2MDUsMTYuNzAxMTA3IDcuOTY3MTIyNSw3Ljk2NzEyMjUgMCAwIDAgNDUuNzA3Nzg4LDguNzMzODk4IFYgOC43MTg2MDggQSA3Ljk2NzEyMjUsNy45NjcxMjI1IDAgMCAwIDM3LjcyOTMxMiwwLjc2NzA5MjExIFogTSAxMS40NDY5ODIsMTkuMTY5NTUzIGMgLTEuNDAwMDYyLDAuMDA4NCAtMi44MjM0ODYyLDAuMDg1OTkgLTQuMTU4NDg1NywwLjQyMjYxIC0wLjg3OTU5MDUsMC4yMjI2OTQgLTEuNzMxNTQ0OSwwLjU4OTIzNCAtMi4yODQxMDg2LDEuMTU5NTYyIC0wLjY5Mzk1NzMsMC43MTQ2OSAtMC43ODMwNTE2LDEuNjgzMzc1IC0wLjQ0NDc0NjMsMi41MTA3MDggMC4zMDI3Mzc4LDAuNzI4OTMyIDEuMTE2NDEyLDEuMjc1OTM0IDIuMDIyODkzNiwxLjU4ODYxMiAxLjk1MDAxNzUsMC42NjgwNzkgNC4xMTc0NTUsMC44MDk2MTIgNi4xNjgwOTYsMS4yMzAzOTkgMC4zNzgyMDcsMC4wOTI1NyAwLjc5NjU1NiwwLjE5NDQ5OCAxLjAzMDc2NiwwLjQ1Mjc5NiAwLjI0Mjg4NSwwLjMwNjg1MiAwLjA5ODcxLDAuNzI5OTg2IC0wLjI5OTQ0NiwwLjkyMjkwMSAtMC42NjYyMDQsMC4zMzg1NzIgLTEuNTE3MDY3LDAuMzQxMjg5IC0yLjI5MjU2LDAuMzI5NjM2IC0wLjcwODcwOSwtMC4wMjkxMyAtMS40ODYwMjQ3LC0wLjA4ODc4IC0yLjA0OTg2MzQsLTAuNDQzNTQgLTAuNDE0NjM4MiwtMC4yNTUwNjEgLTAuNDg3MjUzLC0wLjg2OTI3OCAtMC4zOTQ0MzQzLC0xLjA2MjE2MSBsIC00LjU3MTQzNzQsNC4xM2UtNCBjIC0wLjAxMjE0NCwwLjY5NTkxNyAwLjEyMzA1MjgsMS40MjIxNTcgMC42MzMxMTA4LDIuMDE5Njc0IDAuNDI1OTE2OCwwLjUxMDEyNCAxLjExMzg1NjEsMC44Njk0NDMgMS44NTQ2NTUyLDEuMDg2MzEgMS4xODIzMjc0LDAuMzQ3NjM1IDIuNDYzMzM5NywwLjQ1MjQ3IDMuNzI0NjA2MSwwLjQ4NDE5MSAxLjcxMTQ2OCwwLjAyOTEzIDMuNDU2MDg2LC0wLjAyMTcyIDUuMDk5ODk1LC0wLjQxMDEzMyAwLjk3OTM0OSwtMC4yMzgyMzEgMS45NDIzMTEsLTAuNjI0Mjc4IDIuNTY5NDczLC0xLjI1MDkyNyAxLjExMzc5OCwtMS4xMTc5OTggMC44NTE2NDMsLTIuODg4NTk5IC0wLjYyOTA4NiwtMy43NTgwMTEgLTAuNzM3MzI5LC0wLjQyOTIwMyAtMS42MjAzNjIsLTAuNjk1ODA1IC0yLjUyMDc3LC0wLjg2NzM1NyAtMS4zMTY3ODEsLTAuMjczMTg4IC0yLjY1NzcyNCwtMC40NzI5NzcgLTMuOTkxODU1LC0wLjY5MzA4MSAtMC40Njg0MjEsLTAuMDkxMjcgLTAuOTYzNzY0MSwtMC4xNzE4MyAtMS4zNTc1ODY3LC0wLjM5MzIyOSAtMC40MTIwMzQ3LC0wLjIyMTM5OSAtMC40NDUxOTg4LC0wLjc0MjUyMSAtMC4wMjUzNTUsLTAuOTcwMzkzIDAuNTQzMDIwNywtMC4zMDYyMDMgMS4yNjY1MTQ3LC0wLjMwNDAzNSAxLjkxNjIzNzcsLTAuMzA0NjgxIDAuNjg1MjgsMC4wMTE2NSAxLjQzMDQ3NiwwLjA1NDgzIDEuOTk0MzE1LDAuMzc1OTIxIDAuMzE1NzUsMC4xNzY3MyAwLjQ0MjQ4NSwwLjQ3MzQ0MyAwLjQ0NTk1NSwwLjc1ODI4MyBsIDQuMzQ0ODM3LC0wLjAxMDA0IGMgLTAuMDE3MzQsLTAuNTUwOTI1IC0wLjExODczMSwtMS4xMjMxMjMgLTAuNTIxMjI3LC0xLjU5ODI4OSAtMC40NjY2ODYsLTAuNTg1MjE4IC0xLjI4NzQ3NywtMC45NTQwNTIgLTIuMTMyMzcsLTEuMTY5NjI1IC0xLjMyNTQ1NywtMC4zMzUzMzQgLTIuNzQxMDAyLC0wLjQwNDA2MSAtNC4xMzE1MTUsLTAuNDEwNTM1IHogbSA5LjQyNTgxNywwLjMyODgzMSAtMC4wMDE5LDEwLjM4MTMyIDEyLjY3MDI1Niw0LjEyZS00IC0wLjAwMTEsLTIuMjYzMTc4IEggMjUuNTE4MTU3IFYgMjUuNjAxNjkgaCA3LjE1NDU5MiB2IC0yLjIxMjQ2NSBoIC03LjE1NDU5MiBsIC0wLjAwMTYsLTEuNjUyNjA3IDcuNzM0MTY3LC0wLjAwMiAtMC4wMDQ0LC0yLjIzNjIxMyB6IG0gMjAuODc0OTMyLDAuMDAzNiBjIDAsMCAtMy45MTQ5MSwwLjAwMTIgLTUuODcxODY4LDAuMDAxMiBsIC04LjI1ZS00LDEwLjM4MjEyNSA0LjQ0ODI3NCw0LjEyZS00IC0wLjAwMjgsLTYuOTg2MzUxIDYuMDkzMjM1LDYuOTgwNzE2IDYuMTA0OTA1LDAuMDA1NiAtMC4wMDE2LC0xMC4zODI1MjcgLTQuNDUxODk3LDcuOTdlLTQgMC4wMDUyLDYuOTM2NDQzIHogbSAxOC43MDI3MTMsMC4wMTczMSBjIDAsMCAtNC43OTUxMzUsNi45MjU3NTcgLTcuMjA0ODk5LDEwLjM4MzMzMiBsIDQuNjY5MjM5LDQuMTJlLTQgMS4xMjAxMTgsLTEuODczMTY5IGggNy4yMTQ1NiBsIDEuMDQ1MjU2LDEuODczOTc0IDUuMTg2NDM0LC03Ljk2ZS00IC02Ljg3Mjg0OCwtMTAuMzgyMTI1IHogbSAyLjMzMzIxNCwyLjQ3ODEwNSAyLjIxNDA3NCwzLjc2MDgzIC00LjU3NjY2OSwwLjAwNjUgeiBtIC02Mi4yNjgxOTQ4OSwxMC44MTg4MSAwLjA0MDI0NTksNS42NTE3MDcgMjEuMTE4ODM3OTksLTAuMDc1MjcgYyAxLjA3NzA2LDAuMjMxODQxIDEuNzAyNCwwLjkzMjk2NCAxLjQ4MjM1NSwyLjUyNjgwNyBsIC0xMi45ODk0MjcsMjIuNzM4MDcgNC4yMzEzMzUsMy45NTU2MzEgMjAuMTE4NjYyLC0zNC43OTY5MTggeiBtIDQwLjI5OTMwMjg5LDAuMDQ4MyAxOS43ODQxOTYsMzQuNjQ5MjA4IDQuMzcyMjA1LC0zLjkzMDI3NSAtMTMuMTQwMzYsLTIyLjY3ODQ3MiBjIC0wLjIyMDExLC0xLjU5ODc2MyAwLjQwNTQ0NCwtMi4zMDc5NjMgMS40ODI3NTksLTIuNTQwNDkxIGwgMjEuMTIzMjY0LDAuMDc1MjcgLTAuMDA1NiwtNS41NTc5MjggeiBtIC0zLjMzNzgxNCw1LjczMzgxNCAtMTguNTUyOTkyLDMxLjg0NTQ5MSA0LjkyODAzOCwyLjQwMTYzNSAxMi4zODAwNjUsLTIwLjkyNDAzNSBjIDAuNDI2NTIyLC0wLjM0ODkyMyAwLjg1ODQ5NywtMC41MzQ4NDcgMS4yOTA3NzIsLTAuNTUyMjEyIDAuNDU1MzI1LC0wLjAxNzQ0IDAuOTE2NjU1LDAuMTUxMDA0IDEuMzc3NzA5LDAuNTExNTU4IGwgMTIuMzUxNDg3LDIwLjk4ODAzMyA1LjA4MzM5OCwtMi42NTE1OCB6IgogICAgIGlkPSJwYXRoNDctNSIKICAgICBpbmtzY2FwZTpjb25uZWN0b3ItY3VydmF0dXJlPSIwIiAvPgogIDxnCiAgICAgaWQ9IiMwMDAwMDBmZi0yIgogICAgIHRyYW5zZm9ybT0ibWF0cml4KDAuMzE1NzA2MTEsMCwwLDAuMjM1NjA3NzQsLTM5MS40OTY5OCwtMTAuNjAxMTI2KSIKICAgICBzdHlsZT0iZmlsbDojMzlBOTAwO2ZpbGwtb3BhY2l0eToxIiAvPgo8L3N2Zz4K`;

const estilos = `
  body.inv-export { padding:0!important; margin:0!important; background:#fff!important; }
  body.inv-export .inv-acciones, body.inv-export #inv-toast { display:none!important; }
  .inv-hoja { background:#fff; width:1056px; padding:24px 32px; box-sizing:border-box; margin:0 auto 24px; }
  .inv-box { width:100%; border:1.5px solid #000; background:#fff; box-sizing:border-box; }
  .inv-tbl { width:100%; border-collapse:collapse; table-layout:fixed; }
  .inv-tbl td { border:1px solid #000; padding:3px 4px; vertical-align:middle; font-size:10px; font-family:Arial,sans-serif; line-height:1.2; word-wrap:break-word; color:#000; }
  .inv-tbl:not(:first-child) tr:first-child td { border-top:none; }
  .inv-tbl tr td:first-child { border-left:none; }
  .inv-tbl tr td:last-child { border-right:none; }
  .inv-tbl:last-child tr:last-child td { border-bottom:none; }
  .inv-tbl:first-child tr:first-child td { border-top:none; }
  .inv-inp { width:100%; border:none; outline:none; background:transparent; font-size:10px; font-family:Arial,sans-serif; color:#000; padding:1px 2px; box-sizing:border-box; }
  .inv-area { resize:none; overflow:hidden; line-height:1.25; display:block; white-space:pre-wrap; word-break:break-word; }
  .inv-inp:hover { background:#f0f8ff; }
  .inv-inp:focus { background:#fffbdd; }
  .inv-inp-center { text-align:center; }
  .ed-inline-inp { width:28px; border:none; border-bottom:1px solid #000; text-align:center; outline:none; margin:0 2px; font-weight:bold; font-size:10px; font-family:Arial,sans-serif; background:transparent; }
  .inv-select { width:100%; border:none; outline:none; background:transparent; font-size:10px; font-family:Arial,sans-serif; cursor:pointer; padding:2px; color:#000; }
  #tablaInv thead td { padding:5px 2px; font-size:8.5px; }
  @media print {
    body { background:#fff; padding:0; }
    .inv-hoja { box-shadow:none; padding:0; margin:0; width:100%; }
    .inv-acciones, #inv-toast { display:none!important; }
    .inv-select { appearance:none; -webkit-appearance:none; -moz-appearance:none; }
  }
`;

function filaVacia(n) {
    return { n, cod:'', nombre:'', ini:'', fin:'', caja:'', carp:'', tomo:'', otro:'', del:'', al:'', sop:'', frec:'', notas:'' };
}

export default function InventarioDocumental() {
    const storedUser = (() => {
        try { return JSON.parse(localStorage.getItem('user') || '{}'); }
        catch { return {}; }
    })();
    const isAdmin = storedUser.role === 'admin' || storedUser.role === 'superadmin';

    const [generando, setGenerando] = useState(false);
    const [cargandoDatos, setCargandoDatos] = useState(false);
    const [toast, setToast] = useState(null);

    // Filtros por usuario y fechas
    const [usersList, setUsersList] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(() => storedUser.id ? String(storedUser.id) : 'all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [includeAssigned, setIncludeAssigned] = useState(false);
    const [totalDbRows, setTotalDbRows] = useState(0);
    const [kpis, setKpis] = useState({ total_expedientes: 0, total_documents: 0, total_folios: 0 });

    // Campos institucionales GD-F-004 Versión: 06
    const [sedeName, setSedeName] = useState('REGIONAL SANTANDER');
    const [centroName, setCentroName] = useState('CENTRO INDUSTRIAL DE MANTENIMIENTO INTEGRAL');
    const [oficinaName, setOficinaName] = useState('');
    const [regAnio, setRegAnio] = useState('');
    const [regMes, setRegMes] = useState('');
    const [regDia, setRegDia] = useState('');
    const [nut, setNut] = useState('');
    const [objeto, setObjeto] = useState('ARCHIVO DE GESTIÓN');

    // Tabla 3 (14 columnas exactas GD-F-004)
    const [filas, setFilas] = useState(() => Array.from({ length: 8 }, (_, i) => filaVacia(i + 1)));

    // Tabla 4 (Firmas oficiales GD-F-004)
    const [elaboradoNombre, setElaboradoNombre] = useState('');
    const [elaboradoCargo, setElaboradoCargo] = useState('');
    const [elaboradoFecha, setElaboradoFecha] = useState('');
    const [entregadoNombre, setEntregadoNombre] = useState('');
    const [entregadoCargo, setEntregadoCargo] = useState('');
    const [entregadoFecha, setEntregadoFecha] = useState('');
    const [recibidoNombre, setRecibidoNombre] = useState('');
    const [recibidoCargo, setRecibidoCargo] = useState('');
    const [recibidoFecha, setRecibidoFecha] = useState('');

    const getAuthHeaders = () => {
        const token = localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const mostrarToast = (msg, tipo = 'info') => {
        setToast({ msg, tipo });
        setTimeout(() => setToast(null), 4000);
    };

    // Cargar lista de usuarios disponibles
    useEffect(() => {
        (async () => {
            try {
                const res = await axios.get('/api/documents/inventory-users', { headers: getAuthHeaders() });
                const list = res.data?.data || [];
                setUsersList(list);
                if (isAdmin && storedUser.id) {
                    const me = list.find(u => String(u.id) === String(storedUser.id));
                    if (me && Number(me.docs_uploaded) === 0) {
                        setSelectedUserId('all');
                    }
                }
            } catch (err) {
                console.error('Error cargando usuarios del inventario:', err);
            }
        })();
    }, []);

    // Cargar datos institucionales GD-F-004 según el usuario y filtros seleccionados
    const cargarInventarioUsuario = async () => {
        setCargandoDatos(true);
        try {
            const params = new URLSearchParams();
            params.set('user_id', selectedUserId || (storedUser.id ? String(storedUser.id) : 'all'));
            params.set('mode', 'fuid');
            params.set('limit', '500');
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);
            if (statusFilter !== 'all') params.set('status_filter', statusFilter);
            if (includeAssigned) params.set('include_assigned', '1');

            const res = await axios.get(`/api/documents/inventory-preview?${params.toString()}`, {
                headers: getAuthHeaders()
            });
            const d = res.data || {};
            if (d.headerDefaults) {
                setSedeName(d.headerDefaults.sede || 'REGIONAL SANTANDER');
                setCentroName(d.headerDefaults.unidad_administrativa || 'CENTRO INDUSTRIAL DE MANTENIMIENTO INTEGRAL');
                setOficinaName(d.headerDefaults.oficina_productora || '');
            }
            if (d.signatureDefaults) {
                setElaboradoNombre(d.signatureDefaults.elaborado_nombre || '');
                setElaboradoCargo(d.signatureDefaults.elaborado_cargo || '');
                setElaboradoFecha(d.signatureDefaults.elaborado_fecha || '');
                setEntregadoNombre(d.signatureDefaults.entregado_nombre || '');
                setEntregadoCargo(d.signatureDefaults.entregado_cargo || '');
                setEntregadoFecha(d.signatureDefaults.entregado_fecha || '');
            }
            setKpis(d.kpis || { total_expedientes: 0, total_documents: 0, total_folios: 0 });
            setTotalDbRows(Number(d.total_rows || 0));

            const mapped = (d.rows || []).map((r, idx) => ({
                n: r.n ?? (idx + 1),
                cod: r.cod || '',
                nombre: r.nombre || '',
                ini: r.ini || '',
                fin: r.fin || '',
                caja: r.caja || '',
                carp: r.carp || '',
                tomo: r.tomo || '',
                otro: r.otro || '',
                del: r.del || '',
                al: r.al || '',
                sop: r.sop || '',
                frec: r.frec || 'ALTA',
                notas: r.notas || ''
            }));
            while (mapped.length < 8) {
                mapped.push(filaVacia(mapped.length + 1));
            }
            setFilas(mapped);
        } catch (err) {
            console.error('Error cargando inventario GD-F-004:', err);
            mostrarToast('❌ Error al cargar datos del inventario', 'error');
        } finally {
            setCargandoDatos(false);
        }
    };

    useEffect(() => {
        cargarInventarioUsuario();
    }, [selectedUserId, dateFrom, dateTo, statusFilter, includeAssigned]);

    const agregarFila = () => setFilas(p => [...p, filaVacia(p.length + 1)]);

    const upd = (idx, campo, val) => {
        setFilas(p => p.map((f, i) => (i === idx ? { ...f, [campo]: val } : f)));
    };

    // Descarga en el formato institucional exacto GD-F-004 Versión: 06 (vectorial multipágina Tamaño Carta Horizontal)
    const exportarPDF = async (modoFormato = 'fuid') => {
        setGenerando(true);
        mostrarToast(
            modoFormato === 'hoja_control'
                ? '⏳ Generando Hojas de Control Oficiales GD-F-003...'
                : '⏳ Generando Formato Institucional Oficial GD-F-004...',
            'info'
        );
        try {
            const headerPayload = {
                sede: sedeName,
                unidad_administrativa: centroName,
                oficina_productora: oficinaName,
                reg_anio: regAnio,
                reg_mes: regMes,
                reg_dia: regDia,
                nut,
                objeto
            };
            const signaturesPayload = {
                elaborado_nombre: elaboradoNombre,
                elaborado_cargo: elaboradoCargo,
                elaborado_fecha: elaboradoFecha,
                entregado_nombre: entregadoNombre,
                entregado_cargo: entregadoCargo,
                entregado_fecha: entregadoFecha,
                recibido_nombre: recibidoNombre,
                recibido_cargo: recibidoCargo,
                recibido_fecha: recibidoFecha
            };

            let res;
            if (modoFormato === 'fuid' && totalDbRows <= 500) {
                const userSlug = (elaboradoNombre || 'SENA').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 30);
                res = await axios.post(
                    '/api/documents/inventory-pdf',
                    {
                        header: headerPayload,
                        signatures: signaturesPayload,
                        filas,
                        filename: `GD_F_004_FUID_${userSlug}_${new Date().toISOString().slice(0, 10)}.pdf`
                    },
                    { headers: getAuthHeaders(), responseType: 'blob' }
                );
            } else {
                const params = new URLSearchParams();
                params.set('user_id', selectedUserId || 'all');
                params.set('mode', modoFormato);
                if (dateFrom) params.set('date_from', dateFrom);
                if (dateTo) params.set('date_to', dateTo);
                if (statusFilter !== 'all') params.set('status_filter', statusFilter);
                if (includeAssigned) params.set('include_assigned', '1');
                Object.entries(headerPayload).forEach(([k, v]) => params.set(k, v || ''));
                Object.entries(signaturesPayload).forEach(([k, v]) => params.set(k, v || ''));

                res = await axios.get(`/api/documents/inventory-pdf?${params.toString()}`, {
                    headers: getAuthHeaders(),
                    responseType: 'blob'
                });
            }

            let filename = modoFormato === 'hoja_control'
                ? 'GD_F_003_Hoja_Control_SENA.pdf'
                : 'GD_F_004_FUID_SENA.pdf';
            const disp = res.headers?.['content-disposition'];
            if (disp) {
                const m = disp.match(/filename="?([^"]+)"?/i);
                if (m && m[1]) filename = m[1];
            }

            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            mostrarToast('✅ Formato institucional SENA descargado correctamente', 'exito');
        } catch (e) {
            console.error(e);
            mostrarToast('❌ Error al generar PDF institucional', 'error');
        } finally {
            setGenerando(false);
        }
    };

    const toastColor = toast?.tipo === 'exito' ? '#39A900' : toast?.tipo === 'error' ? '#d32f2f' : '#00324D';
    const estimatedPages = Math.max(1, Math.ceil((totalDbRows > 500 ? totalDbRows : filas.length) / 22));

    return (
        <>
            <style>{estilos}</style>

            {/* TOAST */}
            {toast && (
                <div id="inv-toast" style={{
                    position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
                    padding: '12px 28px', color: '#fff', fontWeight: 'bold', fontSize: 14,
                    borderRadius: 8, zIndex: 9999, backgroundColor: toastColor, fontFamily: 'Arial'
                }}>{toast.msg}</div>
            )}

            {/* PANEL DE FILTRO POR USUARIO Y ACCIONES (No se imprime en el PDF) */}
            <div className="inv-acciones" style={{
                marginBottom: 18,
                padding: '14px 18px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 12
            }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 }}>
                            👤 Inventario realizado por Usuario:
                        </label>
                        {isAdmin ? (
                            <select
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #94a3b8', fontSize: 12.5, fontWeight: 600, background: '#fff' }}
                            >
                                <option value="all">📋 Todos los Usuarios (Consolidado)</option>
                                {usersList.map(u => (
                                    <option key={u.id} value={String(u.id)}>
                                        {u.full_name} — {u.docs_uploaded || 0} docs ({u.expedientes_uploaded || 0} exp.)
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#e2e8f0', fontSize: 12.5, fontWeight: 700 }}>
                                {storedUser.full_name || storedUser.name || 'Mi Usuario'}
                            </div>
                        )}
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 }}>
                            📅 Fecha Cargue Desde:
                        </label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12.5, background: '#fff' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 }}>
                            📅 Fecha Cargue Hasta:
                        </label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12.5, background: '#fff' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 }}>
                            📌 Estado Documentos:
                        </label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12.5, background: '#fff' }}
                        >
                            <option value="all">Todos (Cargados + En Repositorio)</option>
                            <option value="Cargado">Solo Cargados en OnBase / AES</option>
                            <option value="Pendiente">Solo Pendientes de Cargue AES</option>
                        </select>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingTop: 6, borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 12, color: '#334155' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
                            <input
                                type="checkbox"
                                checked={includeAssigned}
                                onChange={(e) => setIncludeAssigned(e.target.checked)}
                            />
                            Incluir expedientes asignados (históricos)
                        </label>
                        <span>
                            <strong>{kpis.total_expedientes}</strong> Expedientes · <strong>{kpis.total_documents}</strong> Documentos PDF · <strong>{kpis.total_folios}</strong> Folios
                            {cargandoDatos ? ' (Actualizando...)' : ''}
                        </span>
                        {totalDbRows > 500 && (
                            <span style={{ color: '#0369a1', fontWeight: 700 }}>
                                (Mostrando primeras 500 filas en pantalla; el PDF descargará las {totalDbRows} filas completas en formato GD-F-004)
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => exportarPDF('fuid')}
                            disabled={generando}
                            style={{
                                padding: '9px 18px', fontWeight: 'bold', fontSize: 13, cursor: 'pointer',
                                background: '#39A900', color: '#fff', border: 'none', borderRadius: 6,
                                boxShadow: '0 2px 6px rgba(0,0,0,.18)'
                            }}
                        >
                            {generando ? '⏳ Generando...' : '⬇️ Descargar PDF GD-F-004 (Tamaño Carta)'}
                        </button>
                        <button
                            type="button"
                            onClick={() => exportarPDF('hoja_control')}
                            disabled={generando}
                            style={{
                                padding: '9px 16px', fontWeight: 'bold', fontSize: 12.5, cursor: 'pointer',
                                background: '#00324D', color: '#fff', border: 'none', borderRadius: 6
                            }}
                            title="Descargar Hojas de Control oficiales GD-F-003 de los expedientes del usuario"
                        >
                            📋 Descargar Hojas de Control GD-F-003
                        </button>
                        <button
                            type="button"
                            onClick={agregarFila}
                            style={{
                                padding: '9px 16px', fontWeight: 'bold', fontSize: 12.5, cursor: 'pointer',
                                background: '#0078D7', color: '#fff', border: 'none', borderRadius: 6
                            }}
                        >
                            ➕ Añadir fila
                        </button>
                    </div>
                </div>
            </div>

            {/* DOCUMENTO INSTITUCIONAL EXACTO SENA GD-F-004 VERSIÓN: 06 */}
            <div style={{ overflowX: 'auto' }}>
                <div className="inv-hoja">
                    <div className="inv-box">

                        {/* ── TABLA 1: ENCABEZADO INSTITUCIONAL ── */}
                        <table className="inv-tbl">
                            <colgroup><col style={{ width: '85%' }} /><col style={{ width: '15%' }} /></colgroup>
                            <tbody>
                                <tr>
                                    <td rowSpan={2} style={{ textAlign: 'center', padding: 8 }}>
                                        <img src={SENA_SVG} alt="SENA" style={{ width: 70, height: 'auto' }} />
                                    </td>
                                    <td style={{ fontSize: 11, paddingLeft: 5 }}>Versión: 06</td>
                                </tr>
                                <tr>
                                    <td style={{ fontSize: 11, paddingLeft: 5 }}>Código:<br />GD-F-004</td>
                                </tr>
                                <tr>
                                    <td colSpan={2} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 12 }}>Proceso Gestión Documental</td>
                                </tr>
                                <tr>
                                    <td colSpan={2} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 12 }}>Formato Único de Inventario Documental</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* ── TABLA 2: DATOS DE CABECERA ── */}
                        <table className="inv-tbl">
                            <colgroup>
                                <col style={{ width: '16%' }} /><col style={{ width: '37%' }} />
                                <col style={{ width: '8%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} />
                                <col style={{ width: '19%' }} />
                            </colgroup>
                            <tbody>
                                <tr>
                                    <td style={{ fontWeight: 'bold' }}>SEDE</td>
                                    <td><input className="inv-inp" value={sedeName} onChange={e => setSedeName(e.target.value)} /></td>
                                    <td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 9 }}>REGISTRO DE ENTRADA</td>
                                    <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 9 }}>NUT - NÚMERO ÚNICO DE<br />TRANSFERENCIA</td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: 'bold' }}>UNIDAD ADMINISTRATIVA</td>
                                    <td><input className="inv-inp" value={centroName} onChange={e => setCentroName(e.target.value)} /></td>
                                    <td style={{ textAlign: 'center', fontSize: 10 }}>AÑO</td>
                                    <td style={{ textAlign: 'center', fontSize: 10 }}>MES</td>
                                    <td style={{ textAlign: 'center', fontSize: 10 }}>DIA</td>
                                    <td rowSpan={2}><input className="inv-inp inv-inp-center" value={nut} onChange={e => setNut(e.target.value)} /></td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: 'bold' }}>OFICINA PRODUCTORA</td>
                                    <td><input className="inv-inp" value={oficinaName} onChange={e => setOficinaName(e.target.value)} /></td>
                                    <td><input className="inv-inp inv-inp-center" value={regAnio} onChange={e => setRegAnio(e.target.value)} /></td>
                                    <td><input className="inv-inp inv-inp-center" value={regMes} onChange={e => setRegMes(e.target.value)} /></td>
                                    <td><input className="inv-inp inv-inp-center" value={regDia} onChange={e => setRegDia(e.target.value)} /></td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: 'bold' }}>OBJETO:</td>
                                    <td colSpan={4}>
                                        <select className="inv-select" value={objeto} onChange={e => setObjeto(e.target.value)}>
                                            <option value="">Seleccione el objeto...</option>
                                            <option value="TRANSFERENCIA PRIMARIA">TRANSFERENCIA PRIMARIA</option>
                                            <option value="ENTREGA DE CARGO">ENTREGA DE CARGO</option>
                                            <option value="ENTREGA DE CONTRATO">ENTREGA DE CONTRATO</option>
                                            <option value="ARCHIVO DE GESTIÓN">ARCHIVO DE GESTIÓN</option>
                                        </select>
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: 11, paddingRight: 16 }}>
                                        Hoja{' '}
                                        <input className="ed-inline-inp" readOnly value="1" />
                                        {' '}de{' '}
                                        <input className="ed-inline-inp" readOnly value={String(estimatedPages)} />
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* ── TABLA 3: INVENTARIO (14 COLUMNAS EXACTAS GD-F-004) ── */}
                        <table className="inv-tbl" id="tablaInv">
                            <colgroup>
                                <col style={{ width: '4%' }} /><col style={{ width: '7%' }} /><col style={{ width: '25%' }} />
                                <col style={{ width: '6%' }} /><col style={{ width: '6%' }} />
                                <col style={{ width: '3.5%' }} /><col style={{ width: '4.5%' }} /><col style={{ width: '3.5%' }} /><col style={{ width: '3.5%' }} />
                                <col style={{ width: '3.5%' }} /><col style={{ width: '4%' }} />
                                <col style={{ width: '8.5%' }} /><col style={{ width: '9%' }} /><col style={{ width: '12%' }} />
                            </colgroup>
                            <thead>
                                <tr style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                    <td rowSpan={2}>No.<br />ITEM</td>
                                    <td rowSpan={2}>CÓDIGO</td>
                                    <td rowSpan={2}>NOMBRE DE LAS SERIES, SUBSERIES O ASUNTOS</td>
                                    <td colSpan={2}>FECHAS EXTREMAS</td>
                                    <td colSpan={4}>UNIDAD DE CONSERVACIÓN</td>
                                    <td colSpan={2}>FOLIOS</td>
                                    <td rowSpan={2}>SOPORTE</td>
                                    <td rowSpan={2}>FRECUENCIA<br />DE CONSULTA</td>
                                    <td rowSpan={2}>NOTAS</td>
                                </tr>
                                <tr style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                    <td>INICIAL</td><td>FINAL</td>
                                    <td>CAJA</td><td>CARPETA</td><td>TOMO</td><td>OTRO</td>
                                    <td>DEL</td><td>AL</td>
                                </tr>
                            </thead>
                            <tbody>
                                {filas.map((f, i) => (
                                    <tr key={i}>
                                        <td><input className="inv-inp inv-inp-center" value={f.n} onChange={e => upd(i, 'n', e.target.value)} /></td>
                                        <td><input className="inv-inp inv-inp-center" value={f.cod} onChange={e => upd(i, 'cod', e.target.value)} /></td>
                                        <td>
                                            <textarea
                                                className="inv-inp inv-area"
                                                rows={Math.max(1, Math.ceil(String(f.nombre || '').length / 36))}
                                                value={f.nombre}
                                                onChange={e => upd(i, 'nombre', e.target.value)}
                                            />
                                        </td>
                                        <td><input className="inv-inp inv-inp-center" value={f.ini} onChange={e => upd(i, 'ini', e.target.value)} /></td>
                                        <td><input className="inv-inp inv-inp-center" value={f.fin} onChange={e => upd(i, 'fin', e.target.value)} /></td>
                                        <td><input className="inv-inp inv-inp-center" value={f.caja} onChange={e => upd(i, 'caja', e.target.value)} /></td>
                                        <td><input className="inv-inp inv-inp-center" value={f.carp} onChange={e => upd(i, 'carp', e.target.value)} /></td>
                                        <td><input className="inv-inp inv-inp-center" value={f.tomo} onChange={e => upd(i, 'tomo', e.target.value)} /></td>
                                        <td><input className="inv-inp inv-inp-center" value={f.otro} onChange={e => upd(i, 'otro', e.target.value)} /></td>
                                        <td><input className="inv-inp inv-inp-center" value={f.del} onChange={e => upd(i, 'del', e.target.value)} /></td>
                                        <td><input className="inv-inp inv-inp-center" value={f.al} onChange={e => upd(i, 'al', e.target.value)} /></td>
                                        <td><input className="inv-inp inv-inp-center" value={f.sop} onChange={e => upd(i, 'sop', e.target.value)} /></td>
                                        <td><input className="inv-inp inv-inp-center" value={f.frec} onChange={e => upd(i, 'frec', e.target.value)} /></td>
                                        <td>
                                            <textarea
                                                className="inv-inp inv-area"
                                                rows={Math.max(1, Math.ceil(String(f.notas || '').length / 18))}
                                                value={f.notas}
                                                onChange={e => upd(i, 'notas', e.target.value)}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* ── TABLA 4: FIRMAS OFICIALES GD-F-004 ── */}
                        <table className="inv-tbl">
                            <colgroup>
                                <col style={{ width: '19%' }} /><col style={{ width: '27%' }} />
                                <col style={{ width: '27%' }} /><col style={{ width: '27%' }} />
                            </colgroup>
                            <tbody>
                                <tr style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                    <td></td>
                                    <td>ELABORADO POR</td>
                                    <td>ENTREGADO POR</td>
                                    <td>RECIBIDO POR</td>
                                </tr>
                                <tr style={{ fontWeight: 'bold' }}>
                                    <td style={{ textAlign: 'center' }}>NOMBRES Y APELLIDOS</td>
                                    <td><input className="inv-inp inv-inp-center" value={elaboradoNombre} onChange={e => setElaboradoNombre(e.target.value)} /></td>
                                    <td><input className="inv-inp inv-inp-center" value={entregadoNombre} onChange={e => setEntregadoNombre(e.target.value)} /></td>
                                    <td><input className="inv-inp inv-inp-center" value={recibidoNombre} onChange={e => setRecibidoNombre(e.target.value)} /></td>
                                </tr>
                                <tr style={{ fontWeight: 'bold' }}>
                                    <td style={{ textAlign: 'center' }}>CARGO</td>
                                    <td><input className="inv-inp inv-inp-center" value={elaboradoCargo} onChange={e => setElaboradoCargo(e.target.value)} /></td>
                                    <td><input className="inv-inp inv-inp-center" value={entregadoCargo} onChange={e => setEntregadoCargo(e.target.value)} /></td>
                                    <td><input className="inv-inp inv-inp-center" value={recibidoCargo} onChange={e => setRecibidoCargo(e.target.value)} /></td>
                                </tr>
                                <tr style={{ fontWeight: 'bold' }}>
                                    <td style={{ textAlign: 'center', height: 42, verticalAlign: 'top', paddingTop: 5 }}>FIRMA</td>
                                    <td></td><td></td><td></td>
                                </tr>
                                <tr style={{ fontWeight: 'bold' }}>
                                    <td style={{ textAlign: 'center' }}>FECHA</td>
                                    <td><input className="inv-inp inv-inp-center" value={elaboradoFecha} onChange={e => setElaboradoFecha(e.target.value)} /></td>
                                    <td><input className="inv-inp inv-inp-center" value={entregadoFecha} onChange={e => setEntregadoFecha(e.target.value)} /></td>
                                    <td><input className="inv-inp inv-inp-center" value={recibidoFecha} onChange={e => setRecibidoFecha(e.target.value)} /></td>
                                </tr>
                            </tbody>
                        </table>

                    </div>
                </div>
            </div>
        </>
    );
}
