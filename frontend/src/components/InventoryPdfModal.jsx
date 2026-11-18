import { useState, useEffect } from 'react';
import axios from 'axios';
import { FileDown, X, User, FileText, Layers, Search } from 'lucide-react';

const SENA_SVG = `data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIgogICB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgd2lkdGg9IjEwMCIKICAgaGVpZ2h0PSI5OCIKICAgdmlld0JveD0iMCAwIDc0Ljk5OTk5NyA3My41IgogICB2ZXJzaW9uPSIxLjEiCiAgIGlkPSJzdmcxMiIKICAgc29kaXBvZGk6ZG9jbmFtZT0iU0VOQSBsb2dvLnN2ZyIKICAgaW5rc2NhcGU6dmVyc2lvbj0iMC45Mi40ICg1ZGE2ODljMzEzLCAyMDE5LTAxLTE0KSI+CiAgPHRpdGxlCiAgICAgaWQ9InRpdGxlMjIyIj5TRU5BIENvbG9tYmlhIGxvZ288L3RpdGxlPgogIDxtZXRhZGF0YQogICAgIGlkPSJtZXRhZGF0YTE4Ij4KICAgIDxyZGY6UkRGPgogICAgICA8Y2M6V29yawogICAgICAgICByZGY6YWJvdXQ9IiI+CiAgICAgICAgPGRjOmZvcm1hdD5pbWFnZS9zdmcreG1sPC9kYzpmb3JtYXQ+CiAgICAgICAgPGRjOnR5cGUKICAgICAgICAgICByZGY6cmVzb3VyY2U9Imh0dHA6Ly9wdXJsLm9yZy9kYy9kY21pdHlwZS9TdGlsbEltYWdlIiAvPgogICAgICAgIDxkYzp0aXRsZT5TRU5BIENvbG9tYmlhIGxvZ288L2RjOnRpdGxlPgogICAgICA8L2NjOldvcms+CiAgICA8L3JkZjpSREY+CiAgPC9tZXRhZGF0YT4KICA8ZGVmcwogICAgIGlkPSJkZWZzMTYiPgogICAgPHBhdHRlcm4KICAgICAgIHk9IjAiCiAgICAgICB4PSIwIgogICAgICAgaGVpZ2h0PSI2IgogICAgICAgd2lkdGg9IjYiCiAgICAgICBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9IkVNRmhiYXNlcGF0dGVybiIgLz4KICAgIDxwYXR0ZXJuCiAgICAgICB5PSIwIgogICAgICAgeD0iMCIKICAgICAgIGhlaWdodD0iNiIKICAgICAgIHdpZHRoPSI2IgogICAgICAgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJFTUZoYmFzZXBhdHRlcm4tMCIgLz4KICA8L2RlZnM+CiAgPHNvZGlwb2RpOm5hbWVkdmlldwogICAgIHBhZ2Vjb2xvcj0iI2ZmZmZmZiIKICAgICBib3JkZXJjb2xvcj0iIzY2NjY2NiIKICAgICBib3JkZXJvcGFjaXR5PSIxIgogICAgIG9iamVjdHRvbGVyYW5jZT0iMSIKICAgICBncmlkdG9sZXJhbmNlPSIxIgogICAgIGd1aWRldG9sZXJhbmNlPSIxIgogICAgIGlua3NjYXBlOnBhZ2VvcGFjaXR5PSIwIgogICAgIGlua3NjYXBlOnBhZ2VzaGFkb3c9IjIiCiAgICAgaW5rc2NhcGU6d2luZG93LXdpZHRoPSIxMzY2IgogICAgIGlua3NjYXBlOndpbmRvdy1oZWlnaHQ9IjcwNSIKICAgICBpZD0ibmFtZWR2aWV3MTQiCiAgICAgc2hvd2dyaWQ9ImZhbHNlIgogICAgIHVuaXRzPSJweCIKICAgICBpbmtzY2FwZTpzaG93cGFnZXNoYWRvdz0iZmFsc2UiCiAgICAgaW5rc2NhcGU6em9vbT0iMSIKICAgICBpbmtzY2FwZTpjeD0iOTYuMjY1MTA0IgogICAgIGlua3NjYXBlOmN5PSI1Ni43NDcyOTQiCiAgICAgaW5rc2NhcGU6d2luZG93LXg9Ii04IgogICAgIGlua3NjYXBlOndpbmRvdy15PSItOCIKICAgICBpbmtzY2FwZTp3aW5kb3ctbWF4aW1pemVkPSIxIgogICAgIGlua3NjYXBlOmN1cnJlbnQtbGF5ZXI9InN2ZzEyIj4KICAgIDxpbmtzY2FwZTpncmlkCiAgICAgICB0eXBlPSJ4eWdyaWQiCiAgICAgICBpZD0iZ3JpZDU4IiAvPgogIDwvc29kaXBvZGk6bmFtZWR2aWV3PgogIDxnCiAgICAgaWQ9IiNmZmZmZmZmZiIKICAgICB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwLC0xMzAuNSkiIC8+CiAgPHBhdGgKICAgICBzdHlsZT0iZmlsbDojMzlBOTAwO2ZpbGwtb3BhY2l0eToxO3N0cm9rZTpub25lO3N0cm9rZS13aWR0aDowLjE1MzU2Njk0cHg7c3Ryb2tlLWxpbmVjYXA6YnV0dDtzdHJva2UtbGluZWpvaW46bWl0ZXI7c3Ryb2tlLW1pdGVybGltaXQ6NDtzdHJva2UtZGFzaGFycmF5Om5vbmU7c3Ryb2tlLW9wYWNpdHk6MSIKICAgICBkPSJNIDM3LjcyOTMxMiwwLjc2NzA5MjExIEEgNy45NjcxMjI1LDcuOTY3MTIyNSAwIDAgMCAyOS43NzMzNzEsOC43NDE1NDUgNy45NjcxMjI1LDcuOTY3MTIyNSAwIDAgMCAzNy43NDQ2MDUsMTYuNzAxMTA3IDcuOTY3MTIyNSw3Ljk2NzEyMjUgMCAwIDAgNDUuNzA3Nzg4LDguNzMzODk4IFYgOC43MTg2MDggQSA3Ljk2NzEyMjUsNy45NjcxMjI1IDAgMCAwIDM3LjcyOTMxMiwwLjc2NzA5MjExIFogTSAxMS40NDY5ODIsMTkuMTY5NTUzIGMgLTEuNDAwMDYyLDAuMDA4NCAtMi44MjM0ODYyLDAuMDg1OTkgLTQuMTU4NDg1NywwLjQyMjYxIC0wLjg3OTU5MDUsMC4yMjI2OTQgLTEuNzMxNTQ0OSwwLjU4OTIzNCAtMi4yODQxMDg2LDEuMTU5NTYyIC0wLjY5Mzk1NzMsMC43MTQ2OSAtMC43ODMwNTE2LDEuNjgzMzc1IC0wLjQ0NDc0NjMsMi41MTA3MDggMC4zMDI3Mzc4LDAuNzI4OTMyIDEuMTE2NDEyLDEuMjc1OTM0IDIuMDIyODkzNiwxLjU4ODYxMiAxLjk1MDAxNzUsMC42NjgwNzkgNC4xMTc0NTUsMC44MDk2MTIgNi4xNjgwOTYsMS4yMzAzOTkgMC4zNzgyMDcsMC4wOTI1NyAwLjc5NjU1NiwwLjE5NDQ5OCAxLjAzMDc2NiwwLjQ1Mjc5NiAwLjI0Mjg4NSwwLjMwNjg1MiAwLjA5ODcxLDAuNzI5OTg2IC0wLjI5OTQ0NiwwLjkyMjkwMSAtMC42NjYyMDQsMC4zMzg1NzIgLTEuNTE3MDY3LDAuMzQxMjg5IC0yLjI5MjU2LDAuMzI5NjM2IC0wLjcwODcwOSwtMC4wMjkxMyAtMS40ODYwMjQ3LC0wLjA4ODc4IC0yLjA0OTg2MzQsLTAuNDQzNTQgLTAuNDE0NjM4MiwtMC4yNTUwNjEgLTAuNDg3MjUzLC0wLjg2OTI3OCAtMC4zOTQ0MzQzLC0xLjA2MjE2MSBsIC00LjU3MTQzNzQsNC4xM2UtNCBjIC0wLjAxMjE0NCwwLjY5NTkxNyAwLjEyMzA1MjgsMS40MjIxNTcgMC42MzMxMTA4LDIuMDE5Njc0IDAuNDI1OTE2OCwwLjUxMDEyNCAxLjExMzg1NjEsMC44Njk0NDMgMS44NTQ2NTUyLDEuMDg2MzEgMS4xODIzMjc0LDAuMzQ3NjM1IDIuNDYzMzM5NywwLjQ1MjQ3IDMuNzI0NjA2MSwwLjQ4NDE5MSAxLjcxMTQ2OCwwLjAyOTEzIDMuNDU2MDg2LC0wLjAyMTcyIDUuMDk5ODk1LC0wLjQxMDEzMyAwLjk3OTM0OSwtMC4yMzgyMzEgMS45NDIzMTEsLTAuNjI0Mjc4IDIuNTY5NDczLC0xLjI1MDkyNyAxLjExMzc5OCwtMS4xMTc5OTggMC44NTE2NDMsLTIuODg4NTk5IC0wLjYyOTA4NiwtMy43NTgwMTEgLTAuNzM3MzI5LC0wLjQyOTIwMyAtMS42MjAzNjIsLTAuNjk1ODA1IC0yLjUyMDc3LC0wLjg2NzM1NyAtMS4zMTY3ODEsLTAuMjczMTg4IC0yLjY1NzcyNCwtMC40NzI5NzcgLTMuOTkxODU1LC0wLjY5MzA4MSAtMC40Njg0MjEsLTAuMDkxMjcgLTAuOTYzNzY0MSwtMC4xNzE4MyAtMS4zNTc1ODY3LC0wLjM5MzIyOSAtMC40MTIwMzQ3LC0wLjIyMTM5OSAtMC40NDUxOTg4LC0wLjc0MjUyMSAtMC4wMjUzNTUsLTAuOTcwMzkzIDAuNTQzMDIwNywtMC4zMDYyMDMgMS4yNjY1MTQ3LC0wLjMwNDAzNSAxLjkxNjIzNzcsLTAuMzA0NjgxIDAuNjg1MjgsMC4wMTE2NSAxLjQzMDQ3NiwwLjA1NDgzIDEuOTk0MzE1LDAuMzc1OTIxIDAuMzE1NzUsMC4xNzY3MyAwLjQ0MjQ4NSwwLjQ3MzQ0MyAwLjQ0NTk1NSwwLjc1ODI4MyBsIDQuMzQ0ODM3LC0wLjAxMDA0IGMgLTAuMDE3MzQsLTAuNTUwOTI1IC0wLjExODczMSwtMS4xMjMxMjMgLTAuNTIxMjI3LC0xLjU5ODI4OSAtMC40NjY2ODYsLTAuNTg1MjE4IC0xLjI4NzQ3NywtMC45NTQwNTIgLTIuMTMyMzcsLTEuMTY5NjI1IC0xLjMyNTQ1NywtMC4zMzUzMzQgLTIuNzQxMDAyLC0wLjQwNDA2MSAtNC4xMzE1MTUsLTAuNDEwNTM1IHogbSA5LjQyNTgxNywwLjMyODgzMSAtMC4wMDE5LDEwLjM4MTMyIDEyLjY3MDI1Niw0LjEyZS00IC0wLjAwMTEsLTIuMjYzMTc4IEggMjUuNTE4MTU3IFYgMjUuNjAxNjkgaCA3LjE1NDU5MiB2IC0yLjIxMjQ2NSBoIC03LjE1NDU5MiBsIC0wLjAwMTYsLTEuNjUyNjA3IDcuNzM0MTY3LC0wLjAwMiAtMC4wMDQ0LC0yLjIzNjIxMyB6IG0gMjAuODc0OTMyLDAuMDAzNiBjIDAsMCAtMy45MTQ5MSwwLjAwMTIgLTUuODcxODY4LDAuMDAxMiBsIC04LjI1ZS00LDEwLjM4MjEyNSA0LjQ0ODI3NCw0LjEyZS00IC0wLjAwMjgsLTYuOTg2MzUxIDYuMDkzMjM1LDYuOTgwNzE2IDYuMTA0OTA1LDAuMDA1NiAtMC4wMDE2LC0xMC4zODI1MjcgLTQuNDUxODk3LDcuOTdlLTQgMC4wMDUyLDYuOTM2NDQzIHogbSAxOC43MDI3MTMsMC4wMTczMSBjIDAsMCAtNC43OTUxMzUsNi45MjU3NTcgLTcuMjA0ODk5LDEwLjM4MzMzMiBsIDQuNjY5MjM5LDQuMTJlLTQgMS4xMjAxMTgsLTEuODczMTY5IGggNy4yMTQ1NiBsIDEuMDQ1MjU2LDEuODczOTc0IDUuMTg2NDM0LC03Ljk2ZS00IC02Ljg3Mjg0OCwtMTAuMzgyMTI1IHogbSAyLjMzMzIxNCwyLjQ3ODEwNSAyLjIxNDA3NCwzLjc2MDgzIC00LjU3NjY2OSwwLjAwNjUgeiBtIC02Mi4yNjgxOTQ4OSwxMC44MTg4MSAwLjA0MDI0NTksNS42NTE3MDcgMjEuMTE4ODM3OTksLTAuMDc1MjcgYyAxLjA3NzA2LDAuMjMxODQxIDEuNzAyNCwwLjkzMjk2NCAxLjQ4MjM1NSwyLjUyNjgwNyBsIC0xMi45ODk0MjcsMjIuNzM4MDcgNC4yMzEzMzUsMy45NTU2MzEgMjAuMTE4NjYyLC0zNC43OTY5MTggeiBtIDQwLjI5OTMwMjg5LDAuMDQ4MyAxOS43ODQxOTYsMzQuNjQ5MjA4IDQuMzcyMjA1LC0zLjkzMDI3NSAtMTMuMTQwMzYsLTIyLjY3ODQ3MiBjIC0wLjIyMDExLC0xLjU5ODc2MyAwLjQwNTQ0NCwtMi4zMDc5NjMgMS40ODI3NTksLTIuNTQwNDkxIGwgMjEuMTIzMjY0LDAuMDc1MjcgLTAuMDA1NiwtNS41NTc5MjggeiBtIC0zLjMzNzgxNCw1LjczMzgxNCAtMTguNTUyOTkyLDMxLjg0NTQ5MSA0LjkyODAzOCwyLjQwMTYzNSAxMi4zODAwNjUsLTIwLjkyNDAzNSBjIDAuNDI2NTIyLC0wLjM0ODkyMyAwLjg1ODQ5NywtMC41MzQ4NDcgMS4yOTA3NzIsLTAuNTUyMjEyIDAuNDU1MzI1LC0wLjAxNzQ0IDAuOTE2NjU1LDAuMTUxMDA0IDEuMzc3NzA5LDAuNTExNTU4IGwgMTIuMzUxNDg3LDIwLjk4ODAzMyA1LjA4MzM5OCwtMi42NTE1OCB6IgogICAgIGlkPSJwYXRoNDctNSIKICAgICBpbmtzY2FwZTpjb25uZWN0b3ItY3VydmF0dXJlPSIwIiAvPgogIDxnCiAgICAgaWQ9IiMwMDAwMDBmZi0yIgogICAgIHRyYW5zZm9ybT0ibWF0cml4KDAuMzE1NzA2MTEsMCwwLDAuMjM1NjA3NzQsLTM5MS40OTY5OCwtMTAuNjAxMTI2KSIKICAgICBzdHlsZT0iZmlsbDojMzlBOTAwO2ZpbGwtb3BhY2l0eToxIiAvPgo8L3N2Zz4K`;

export default function InventoryPdfModal({ isOpen, onClose, initialUserId = null }) {
  const storedUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); }
    catch { return {}; }
  })();
  const isAdmin = storedUser.role === 'admin' || storedUser.role === 'superadmin';

  const [usersList, setUsersList] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(() => {
    if (initialUserId) return String(initialUserId);
    return storedUser.id ? String(storedUser.id) : 'all';
  });

  // 'fuid' -> GD-F-004 Versión: 06 | 'hoja_control' -> GD-F-003 Versión: 04
  const [mode, setMode] = useState('fuid');
  const [datePreset, setDatePreset] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [subserie, setSubserie] = useState('all');
  const [search, setSearch] = useState('');
  const [includeAssigned, setIncludeAssigned] = useState(true);
  const [showHeaderSignEditor, setShowHeaderSignEditor] = useState(false);

  // Campos institucionales exactos GD-F-004 Versión: 06
  const [sede, setSede] = useState('REGIONAL SANTANDER');
  const [unidadAdministrativa, setUnidadAdministrativa] = useState('CENTRO INDUSTRIAL DE MANTENIMIENTO INTEGRAL');
  const [oficinaProductora, setOficinaProductora] = useState('');
  const [objeto, setObjeto] = useState('ARCHIVO DE GESTIÓN');
  const [regAnio, setRegAnio] = useState('');
  const [regMes, setRegMes] = useState('');
  const [regDia, setRegDia] = useState('');
  const [nut, setNut] = useState('');

  // Firmas oficiales GD-F-004
  const [elaboradoNombre, setElaboradoNombre] = useState('');
  const [elaboradoCargo, setElaboradoCargo] = useState('');
  const [elaboradoFecha, setElaboradoFecha] = useState('');
  const [entregadoNombre, setEntregadoNombre] = useState('');
  const [entregadoCargo, setEntregadoCargo] = useState('');
  const [entregadoFecha, setEntregadoFecha] = useState('');
  const [recibidoNombre, setRecibidoNombre] = useState(() => localStorage.getItem('sena_gdf004_recibido_nombre') || '');
  const [recibidoCargo, setRecibidoCargo] = useState(() => localStorage.getItem('sena_gdf004_recibido_cargo') || '');
  const [recibidoFecha, setRecibidoFecha] = useState('');

  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    if (!isOpen) return;
    if (initialUserId) {
      setSelectedUserId(String(initialUserId));
    } else if (!selectedUserId && storedUser.id) {
      setSelectedUserId(String(storedUser.id));
    }
    (async () => {
      try {
        const res = await axios.get('/api/documents/inventory-users', { headers: getAuthHeaders() });
        const rows = res.data?.data || [];
        setUsersList(rows);
        if (!initialUserId && isAdmin && storedUser.id) {
          const me = rows.find(u => String(u.id) === String(storedUser.id));
          if (me && Number(me.docs_uploaded) === 0 && rows[0]?.id) {
            setSelectedUserId(String(rows[0].id));
          }
        }
      } catch (err) {
        console.error('Error cargando lista de usuarios para inventario:', err);
      }
    })();
  }, [isOpen, initialUserId]);

  const applyPreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    } else if (preset === 'today') {
      const s = fmt(now);
      setDateFrom(s);
      setDateTo(s);
    } else if (preset === '7d') {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      setDateFrom(fmt(start));
      setDateTo(fmt(now));
    } else if (preset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateFrom(fmt(start));
      setDateTo(fmt(now));
    } else if (preset === 'prev_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setDateFrom(fmt(start));
      setDateTo(fmt(end));
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setErrorMsg('');
      try {
        const params = new URLSearchParams();
        if (selectedUserId) params.set('user_id', selectedUserId);
        params.set('mode', mode);
        params.set('limit', '25');
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
        if (statusFilter !== 'all') params.set('status_filter', statusFilter);
        if (subserie && subserie !== 'all') params.set('subserie', subserie);
        if (search.trim()) params.set('search', search.trim());
        params.set('include_assigned', includeAssigned ? '1' : '0');

        const res = await axios.get(`/api/documents/inventory-preview?${params.toString()}`, {
          headers: getAuthHeaders()
        });
        const d = res.data || {};
        setPreviewData(d);

        if (d.headerDefaults) {
          setSede(d.headerDefaults.sede || 'REGIONAL SANTANDER');
          setUnidadAdministrativa(d.headerDefaults.unidad_administrativa || 'CENTRO INDUSTRIAL DE MANTENIMIENTO INTEGRAL');
          setOficinaProductora(d.headerDefaults.oficina_productora || '');
        }
        if (d.signatureDefaults) {
          setElaboradoNombre(d.signatureDefaults.elaborado_nombre || '');
          setElaboradoCargo(d.signatureDefaults.elaborado_cargo || '');
          setElaboradoFecha(d.signatureDefaults.elaborado_fecha || '');
          setEntregadoNombre(d.signatureDefaults.entregado_nombre || '');
          setEntregadoCargo(d.signatureDefaults.entregado_cargo || '');
          setEntregadoFecha(d.signatureDefaults.entregado_fecha || '');
        }
      } catch (err) {
        setErrorMsg(err.response?.data?.error || 'No se pudo cargar la vista previa del inventario institucional.');
      } finally {
        setPreviewLoading(false);
      }
    }, 240);
    return () => clearTimeout(timer);
  }, [isOpen, selectedUserId, mode, dateFrom, dateTo, statusFilter, subserie, search, includeAssigned]);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    setErrorMsg('');
    try {
      localStorage.setItem('sena_gdf004_recibido_nombre', recibidoNombre);
      localStorage.setItem('sena_gdf004_recibido_cargo', recibidoCargo);

      const params = new URLSearchParams();
      if (selectedUserId) params.set('user_id', selectedUserId);
      params.set('mode', mode);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (statusFilter !== 'all') params.set('status_filter', statusFilter);
      if (subserie && subserie !== 'all') params.set('subserie', subserie);
      if (search.trim()) params.set('search', search.trim());
      if (includeAssigned) params.set('include_assigned', '1');

      // Campos institucionales GD-F-004 / GD-F-003
      params.set('sede', sede);
      params.set('unidad_administrativa', unidadAdministrativa);
      params.set('oficina_productora', oficinaProductora);
      params.set('objeto', objeto);
      params.set('reg_anio', regAnio);
      params.set('reg_mes', regMes);
      params.set('reg_dia', regDia);
      params.set('nut', nut);

      params.set('elaborado_nombre', elaboradoNombre);
      params.set('elaborado_cargo', elaboradoCargo);
      params.set('elaborado_fecha', elaboradoFecha);
      params.set('entregado_nombre', entregadoNombre);
      params.set('entregado_cargo', entregadoCargo);
      params.set('entregado_fecha', entregadoFecha);
      params.set('recibido_nombre', recibidoNombre);
      params.set('recibido_cargo', recibidoCargo);
      params.set('recibido_fecha', recibidoFecha);

      const res = await axios.get(`/api/documents/inventory-pdf?${params.toString()}`, {
        headers: getAuthHeaders(),
        responseType: 'blob'
      });

      let filename = mode === 'hoja_control'
        ? `GD_F_003_Hoja_Control_${new Date().toISOString().slice(0, 10)}.pdf`
        : `GD_F_004_FUID_${new Date().toISOString().slice(0, 10)}.pdf`;
      const disp = res.headers?.['content-disposition'];
      if (disp) {
        const match = disp.match(/filename="?([^"]+)"?/i);
        if (match && match[1]) filename = match[1];
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
    } catch (err) {
      let msg = 'Error al generar el formato institucional en PDF.';
      if (err.response?.data instanceof Blob) {
        try {
          const txt = await err.response.data.text();
          const parsed = JSON.parse(txt);
          if (parsed.error) msg = parsed.error;
        } catch (_) {}
      } else if (err.response?.data?.error) {
        msg = err.response.data.error;
      }
      setErrorMsg(msg);
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  const kpis = previewData?.kpis || {
    total_expedientes: 0,
    total_documents: 0,
    total_folios: 0,
    cargados_aes: 0,
    pendientes_aes: 0
  };
  const fuidRows = previewData?.rows || [];
  const hcGroups = previewData?.hojaControlGroups || [];
  const subseriesOptions = previewData?.subseries || [];
  const totalPagesEst = Math.max(1, Math.ceil((previewData?.total_rows || 0) / 22));

  const cellStyle = {
    border: '1px solid #000',
    padding: '3px 4px',
    fontSize: '9.5px',
    fontFamily: 'Arial, sans-serif',
    color: '#000',
    verticalAlign: 'middle',
    lineHeight: 1.18
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3500,
        backgroundColor: 'rgba(15, 23, 42, 0.68)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px'
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1120px',
          maxHeight: '94vh',
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 24px 50px rgba(0,0,0,0.32)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #cbd5e1'
        }}
      >
        {/* Barra superior SENA */}
        <div
          style={{
            background: '#ffffff',
            color: '#0f172a',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '3px solid #39A900'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={SENA_SVG} alt="SENA" style={{ width: '38px', height: 'auto' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 800, color: '#111827' }}>
                Descarga de Formatos Institucionales Oficiales SENA por Usuario
              </h3>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                Proceso Gestión Documental — <strong>Código: GD-F-004 (Versión: 06)</strong> Inventario Documental y <strong>Código: GD-F-003 (Versión: 04)</strong> Hoja de Control
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#334155',
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido scrollable */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Selector de los 2 Formatos Institucionales Oficiales del SENA */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '10px' }}>
            <div
              onClick={() => setMode('fuid')}
              style={{
                padding: '11px 14px',
                borderRadius: '10px',
                cursor: 'pointer',
                border: mode === 'fuid' ? '2px solid #39A900' : '1px solid #cbd5e1',
                backgroundColor: mode === 'fuid' ? '#f0fdf4' : '#f8fafc'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 800, fontSize: '13px', color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={16} color="#39A900" /> Formato Único de Inventario Documental (GD-F-004 · Versión 06)
                </span>
                {mode === 'fuid' && (
                  <span style={{ fontSize: '10px', fontWeight: 800, background: '#39A900', color: '#fff', padding: '2px 8px', borderRadius: '99px' }}>
                    SELECCIONADO
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '4px' }}>
                Formato institucional horizontal Tamaño Carta con sus 14 columnas reglamentarias, Hoja X de Y y firmas oficiales (Elaborado, Entregado, Recibido).
              </div>
            </div>

            <div
              onClick={() => setMode('hoja_control')}
              style={{
                padding: '11px 14px',
                borderRadius: '10px',
                cursor: 'pointer',
                border: mode === 'hoja_control' ? '2px solid #39A900' : '1px solid #cbd5e1',
                backgroundColor: mode === 'hoja_control' ? '#f0fdf4' : '#f8fafc'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 800, fontSize: '13px', color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} color="#39A900" /> Hoja de Control por Expediente (GD-F-003 · Versión 04)
                </span>
                {mode === 'hoja_control' && (
                  <span style={{ fontSize: '10px', fontWeight: 800, background: '#39A900', color: '#fff', padding: '2px 8px', borderRadius: '99px' }}>
                    SELECCIONADO
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '4px' }}>
                Formato institucional vertical Tamaño Carta con el detalle documento por documento de cada expediente (Fecha AAAA/MM/DD, Tipo Documental y Folios Del-Al).
              </div>
            </div>
          </div>

          {/* Controles de Usuario, Fechas y Objeto */}
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                  <User size={13} /> Usuario Responsable del Cargue
                </label>
                {isAdmin ? (
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', border: '1px solid #94a3b8', fontSize: '12.5px', fontWeight: 600, backgroundColor: '#fff' }}
                  >
                    <option value="all">📋 Todos los Usuarios (Consolidado)</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={String(u.id)}>
                        {u.full_name} — {u.docs_uploaded || 0} docs ({u.expedientes_uploaded || 0} exp.)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ padding: '7px 10px', borderRadius: '7px', border: '1px solid #cbd5e1', backgroundColor: '#e2e8f0', fontSize: '12.5px', fontWeight: 700 }}>
                    {previewData?.user?.full_name || storedUser.full_name || storedUser.name || 'Mi Usuario'}
                  </div>
                )}
              </div>

              {mode === 'fuid' && (
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                    OBJETO (Casilla oficial GD-F-004)
                  </label>
                  <select
                    value={objeto}
                    onChange={(e) => setObjeto(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', border: '1px solid #94a3b8', fontSize: '12px', fontWeight: 600, backgroundColor: '#fff' }}
                  >
                    <option value="">(Dejar en blanco)</option>
                    <option value="TRANSFERENCIA PRIMARIA">TRANSFERENCIA PRIMARIA</option>
                    <option value="ENTREGA DE CARGO">ENTREGA DE CARGO</option>
                    <option value="ENTREGA DE CONTRATO">ENTREGA DE CONTRATO</option>
                    <option value="ARCHIVO DE GESTIÓN">ARCHIVO DE GESTIÓN</option>
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                  Subserie TRD
                </label>
                <select
                  value={subserie}
                  onChange={(e) => setSubserie(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12px', backgroundColor: '#fff' }}
                >
                  <option value="all">Todas las subseries</option>
                  {subseriesOptions.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                  Estado de Documentos
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12px', backgroundColor: '#fff' }}
                >
                  <option value="all">Todos (Cargados + En Repositorio)</option>
                  <option value="Cargado">Solo Cargados en OnBase / AES</option>
                  <option value="Pendiente">Solo Pendientes de Cargue AES</option>
                </select>
              </div>
            </div>

            {/* Rango de fechas y búsqueda */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                {[
                  { id: 'all', label: 'Todo el historial' },
                  { id: 'today', label: 'Hoy' },
                  { id: '7d', label: 'Últimos 7 días' },
                  { id: 'month', label: 'Este mes' },
                  { id: 'prev_month', label: 'Mes anterior' }
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '99px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: datePreset === p.id ? '1px solid #39A900' : '1px solid #cbd5e1',
                      backgroundColor: datePreset === p.id ? '#39A900' : '#fff',
                      color: datePreset === p.id ? '#fff' : '#334155'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDatePreset('custom'); setDateFrom(e.target.value); }}
                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11.5px', background: '#fff' }}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>a</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDatePreset('custom'); setDateTo(e.target.value); }}
                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11.5px', background: '#fff' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 8, top: 8, color: '#64748b' }} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filtrar expediente o aprendiz..."
                    style={{ padding: '5px 8px 5px 26px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11.5px', width: '190px', background: '#fff' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowHeaderSignEditor(!showHeaderSignEditor)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: '6px',
                    border: '1px solid #94a3b8',
                    background: showHeaderSignEditor ? '#e2e8f0' : '#fff',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: '#1e293b'
                  }}
                >
                  ✍️ {showHeaderSignEditor ? 'Ocultar Cabecera / Firmas' : 'Editar Cabecera / Firmas GD-F-004'}
                </button>
              </div>
            </div>

            {/* Editor desplegable de Cabecera y Firmas oficiales GD-F-004 */}
            {showHeaderSignEditor && (
              <div style={{ marginTop: 4, padding: '10px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10.5, fontWeight: 700 }}>SEDE</label>
                    <input value={sede} onChange={e => setSede(e.target.value)} style={{ width: '100%', padding: '5px 7px', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: 11.5 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10.5, fontWeight: 700 }}>UNIDAD ADMINISTRATIVA</label>
                    <input value={unidadAdministrativa} onChange={e => setUnidadAdministrativa(e.target.value)} style={{ width: '100%', padding: '5px 7px', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: 11.5 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10.5, fontWeight: 700 }}>OFICINA PRODUCTORA</label>
                    <input value={oficinaProductora} onChange={e => setOficinaProductora(e.target.value)} style={{ width: '100%', padding: '5px 7px', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: 11.5 }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.4fr', gap: 4 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700 }}>AÑO</label>
                      <input value={regAnio} onChange={e => setRegAnio(e.target.value)} placeholder="AAAA" style={{ width: '100%', padding: '5px 4px', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: 11, textAlign: 'center' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700 }}>MES</label>
                      <input value={regMes} onChange={e => setRegMes(e.target.value)} placeholder="MM" style={{ width: '100%', padding: '5px 4px', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: 11, textAlign: 'center' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700 }}>DIA</label>
                      <input value={regDia} onChange={e => setRegDia(e.target.value)} placeholder="DD" style={{ width: '100%', padding: '5px 4px', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: 11, textAlign: 'center' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700 }}>NUT</label>
                      <input value={nut} onChange={e => setNut(e.target.value)} style={{ width: '100%', padding: '5px 4px', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: 11, textAlign: 'center' }} />
                    </div>
                  </div>
                </div>

                {mode === 'fuid' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, paddingTop: 6, borderTop: '1px dashed #cbd5e1' }}>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 800, marginBottom: 3 }}>ELABORADO POR</div>
                      <input value={elaboradoNombre} onChange={e => setElaboradoNombre(e.target.value)} placeholder="Nombres y Apellidos" style={{ width: '100%', padding: '4px 7px', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: 11, marginBottom: 4 }} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 4 }}>
                        <input value={elaboradoCargo} onChange={e => setElaboradoCargo(e.target.value)} placeholder="Cargo" style={{ width: '100%', padding: '4px 7px', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: 11 }} />
                        <input value={elaboradoFecha} onChange={e => setElaboradoFecha(e.target.value)} placeholder="AAAA-MM-DD" style={{ width: '100%', padding: '4px 7px', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: 11 }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 800, marginBottom: 3 }}>ENTREGADO POR</div>
                      <input value={entregadoNombre} onChange={e => setEntregadoNombre(e.target.value)} placeholder="Nombres y Apellidos" style={{ width: '100%', padding: '4px 7px', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: 11, marginBottom: 4 }} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 4 }}>
                        <input value={entregadoCargo} onChange={e => setEntregadoCargo(e.target.value)} placeholder="Cargo" style={{ width: '100%', padding: '4px 7px', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: 11 }} />
                        <input value={entregadoFecha} onChange={e => setEntregadoFecha(e.target.value)} placeholder="AAAA-MM-DD" style={{ width: '100%', padding: '4px 7px', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: 11 }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 800, marginBottom: 3 }}>RECIBIDO POR</div>
                      <input value={recibidoNombre} onChange={e => setRecibidoNombre(e.target.value)} placeholder="Nombres y Apellidos (ej. Supervisor)" style={{ width: '100%', padding: '4px 7px', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: 11, marginBottom: 4 }} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 4 }}>
                        <input value={recibidoCargo} onChange={e => setRecibidoCargo(e.target.value)} placeholder="Cargo" style={{ width: '100%', padding: '4px 7px', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: 11 }} />
                        <input value={recibidoFecha} onChange={e => setRecibidoFecha(e.target.value)} placeholder="AAAA-MM-DD" style={{ width: '100%', padding: '4px 7px', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: 11 }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {errorMsg && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12.5px', fontWeight: 600 }}>
              {errorMsg}
            </div>
          )}

          {Number(kpis.assigned_sin_docs) > 0 && (
            <div style={{ padding: '8px 14px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: '12px', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                ⚠️ Novedad: Este funcionario registra <strong>{kpis.assigned_sin_docs}</strong> expediente(s) asignado(s) sin ningún documento cargado (0 PDFs).
              </span>
              {isAdmin && (
                <a href="/superuser" style={{ color: '#b45309', textDecoration: 'underline', fontWeight: 800 }}>
                  Ver detalle en Superusuario →
                </a>
              )}
            </div>
          )}

          {/* VISTA PREVIA FIEL AL FORMATO INSTITUCIONAL SENA (GD-F-004 v06 o GD-F-003 v04) */}
          <div style={{ background: '#e2e8f0', padding: '12px', borderRadius: '10px', overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '11.5px', color: '#1e293b', fontWeight: 700 }}>
              <span>
                Vista Previa del Formato Institucional SENA ({mode === 'fuid' ? 'Código: GD-F-004 · Versión: 06' : 'Código: GD-F-003 · Versión: 04'})
                {previewLoading ? ' — Cargando...' : ''}
              </span>
              <span>
                {kpis.total_expedientes} Expediente(s) · {kpis.total_documents} Documento(s) PDF · {kpis.total_folios} Folio(s)
              </span>
            </div>

            {mode === 'fuid' ? (
              /* ── VISTA PREVIA EXACTA GD-F-004 VERSIÓN: 06 ── */
              <div style={{ background: '#fff', border: '1.5px solid #000', minWidth: '920px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup><col style={{ width: '85%' }} /><col style={{ width: '15%' }} /></colgroup>
                  <tbody>
                    <tr>
                      <td rowSpan={2} style={{ ...cellStyle, textAlign: 'center', padding: '6px' }}>
                        <img src={SENA_SVG} alt="SENA" style={{ width: '48px', height: 'auto' }} />
                      </td>
                      <td style={{ ...cellStyle, fontSize: '10px' }}>Versión: 06</td>
                    </tr>
                    <tr>
                      <td style={{ ...cellStyle, fontSize: '10px' }}>Código:<br />GD-F-004</td>
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold', fontSize: '11px' }}>Proceso Gestión Documental</td>
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold', fontSize: '11px' }}>Formato Único de Inventario Documental</td>
                    </tr>
                  </tbody>
                </table>

                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '16%' }} /><col style={{ width: '37%' }} />
                    <col style={{ width: '8%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} />
                    <col style={{ width: '19%' }} />
                  </colgroup>
                  <tbody>
                    <tr>
                      <td style={{ ...cellStyle, fontWeight: 'bold' }}>SEDE</td>
                      <td style={cellStyle}>{sede}</td>
                      <td colSpan={3} style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold', fontSize: '8.5px' }}>REGISTRO DE ENTRADA</td>
                      <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold', fontSize: '8px' }}>NUT - NÚMERO ÚNICO DE<br />TRANSFERENCIA</td>
                    </tr>
                    <tr>
                      <td style={{ ...cellStyle, fontWeight: 'bold' }}>UNIDAD ADMINISTRATIVA</td>
                      <td style={cellStyle}>{unidadAdministrativa}</td>
                      <td style={{ ...cellStyle, textAlign: 'center' }}>AÑO</td>
                      <td style={{ ...cellStyle, textAlign: 'center' }}>MES</td>
                      <td style={{ ...cellStyle, textAlign: 'center' }}>DIA</td>
                      <td rowSpan={2} style={{ ...cellStyle, textAlign: 'center' }}>{nut}</td>
                    </tr>
                    <tr>
                      <td style={{ ...cellStyle, fontWeight: 'bold' }}>OFICINA PRODUCTORA</td>
                      <td style={{ ...cellStyle, fontSize: '8.5px' }}>{oficinaProductora}</td>
                      <td style={{ ...cellStyle, textAlign: 'center' }}>{regAnio}</td>
                      <td style={{ ...cellStyle, textAlign: 'center' }}>{regMes}</td>
                      <td style={{ ...cellStyle, textAlign: 'center' }}>{regDia}</td>
                    </tr>
                    <tr>
                      <td style={{ ...cellStyle, fontWeight: 'bold' }}>OBJETO:</td>
                      <td colSpan={4} style={cellStyle}>{objeto}</td>
                      <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold', paddingRight: '12px' }}>
                        Hoja <u>&nbsp;1&nbsp;</u> de <u>&nbsp;{totalPagesEst}&nbsp;</u>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '4%' }} /><col style={{ width: '7%' }} /><col style={{ width: '25%' }} />
                    <col style={{ width: '6%' }} /><col style={{ width: '6%' }} />
                    <col style={{ width: '3.5%' }} /><col style={{ width: '4.5%' }} /><col style={{ width: '3.5%' }} /><col style={{ width: '3.5%' }} />
                    <col style={{ width: '3.5%' }} /><col style={{ width: '4%' }} />
                    <col style={{ width: '8.5%' }} /><col style={{ width: '9%' }} /><col style={{ width: '12%' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      <td rowSpan={2} style={{ ...cellStyle, fontSize: '8px' }}>No.<br />ITEM</td>
                      <td rowSpan={2} style={{ ...cellStyle, fontSize: '8px' }}>CÓDIGO</td>
                      <td rowSpan={2} style={{ ...cellStyle, fontSize: '8px' }}>NOMBRE DE LAS SERIES, SUBSERIES O ASUNTOS</td>
                      <td colSpan={2} style={{ ...cellStyle, fontSize: '8px' }}>FECHAS EXTREMAS</td>
                      <td colSpan={4} style={{ ...cellStyle, fontSize: '8px' }}>UNIDAD DE CONSERVACIÓN</td>
                      <td colSpan={2} style={{ ...cellStyle, fontSize: '8px' }}>FOLIOS</td>
                      <td rowSpan={2} style={{ ...cellStyle, fontSize: '8px' }}>SOPORTE</td>
                      <td rowSpan={2} style={{ ...cellStyle, fontSize: '8px' }}>FRECUENCIA<br />DE CONSULTA</td>
                      <td rowSpan={2} style={{ ...cellStyle, fontSize: '8px' }}>NOTAS</td>
                    </tr>
                    <tr style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      <td style={{ ...cellStyle, fontSize: '7.5px' }}>INICIAL</td>
                      <td style={{ ...cellStyle, fontSize: '7.5px' }}>FINAL</td>
                      <td style={{ ...cellStyle, fontSize: '7.5px' }}>CAJA</td>
                      <td style={{ ...cellStyle, fontSize: '7.5px' }}>CARPETA</td>
                      <td style={{ ...cellStyle, fontSize: '7.5px' }}>TOMO</td>
                      <td style={{ ...cellStyle, fontSize: '7.5px' }}>OTRO</td>
                      <td style={{ ...cellStyle, fontSize: '7.5px' }}>DEL</td>
                      <td style={{ ...cellStyle, fontSize: '7.5px' }}>AL</td>
                    </tr>
                  </thead>
                  <tbody>
                    {(fuidRows.length > 0 ? fuidRows.slice(0, 10) : Array.from({ length: 5 }, (_, i) => ({ n: i + 1 }))).map((r, i) => (
                      <tr key={i}>
                        <td style={{ ...cellStyle, textAlign: 'center' }}>{r.n ?? (i + 1)}</td>
                        <td style={{ ...cellStyle, textAlign: 'center' }}>{r.cod || ''}</td>
                        <td style={cellStyle}>{r.nombre || ''}</td>
                        <td style={{ ...cellStyle, textAlign: 'center', fontSize: '8.5px' }}>{r.ini || ''}</td>
                        <td style={{ ...cellStyle, textAlign: 'center', fontSize: '8.5px' }}>{r.fin || ''}</td>
                        <td style={{ ...cellStyle, textAlign: 'center' }}>{r.caja || ''}</td>
                        <td style={{ ...cellStyle, textAlign: 'center' }}>{r.carp || ''}</td>
                        <td style={{ ...cellStyle, textAlign: 'center' }}>{r.tomo || ''}</td>
                        <td style={{ ...cellStyle, textAlign: 'center' }}>{r.otro || ''}</td>
                        <td style={{ ...cellStyle, textAlign: 'center' }}>{r.del || ''}</td>
                        <td style={{ ...cellStyle, textAlign: 'center' }}>{r.al || ''}</td>
                        <td style={{ ...cellStyle, textAlign: 'center', fontSize: '8.5px' }}>{r.sop || ''}</td>
                        <td style={{ ...cellStyle, textAlign: 'center', fontSize: '8.5px' }}>{r.frec || ''}</td>
                        <td style={{ ...cellStyle, fontSize: '8.5px' }}>{r.notas || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '19%' }} /><col style={{ width: '27%' }} />
                    <col style={{ width: '27%' }} /><col style={{ width: '27%' }} />
                  </colgroup>
                  <tbody>
                    <tr style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      <td style={cellStyle}></td>
                      <td style={cellStyle}>ELABORADO POR</td>
                      <td style={cellStyle}>ENTREGADO POR</td>
                      <td style={cellStyle}>RECIBIDO POR</td>
                    </tr>
                    <tr>
                      <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>NOMBRES Y APELLIDOS</td>
                      <td style={{ ...cellStyle, textAlign: 'center' }}>{elaboradoNombre}</td>
                      <td style={{ ...cellStyle, textAlign: 'center' }}>{entregadoNombre}</td>
                      <td style={{ ...cellStyle, textAlign: 'center' }}>{recibidoNombre}</td>
                    </tr>
                    <tr>
                      <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>CARGO</td>
                      <td style={{ ...cellStyle, textAlign: 'center' }}>{elaboradoCargo}</td>
                      <td style={{ ...cellStyle, textAlign: 'center' }}>{entregadoCargo}</td>
                      <td style={{ ...cellStyle, textAlign: 'center' }}>{recibidoCargo}</td>
                    </tr>
                    <tr>
                      <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold', height: '26px', verticalAlign: 'top' }}>FIRMA</td>
                      <td style={cellStyle}></td><td style={cellStyle}></td><td style={cellStyle}></td>
                    </tr>
                    <tr>
                      <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>FECHA</td>
                      <td style={{ ...cellStyle, textAlign: 'center' }}>{elaboradoFecha}</td>
                      <td style={{ ...cellStyle, textAlign: 'center' }}>{entregadoFecha}</td>
                      <td style={{ ...cellStyle, textAlign: 'center' }}>{recibidoFecha}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              /* ── VISTA PREVIA EXACTA GD-F-003 VERSIÓN: 04 ── */
              <div style={{ background: '#fff', border: '1.5px solid #000', maxWidth: '760px', margin: '0 auto' }}>
                {(() => {
                  const grp = hcGroups[0] || {
                    sede, cod_sede: '68', unidad_administrativa: unidadAdministrativa, cod_unidad: '68.9224',
                    oficina_productora: oficinaProductora, cod_oficina: '68.9224',
                    series_name: '', series_code: '', subseries_name: '', subseries_code: '',
                    identificacion_expediente: 'Sin expedientes para el filtro actual',
                    responsable: elaboradoNombre, documentos: []
                  };
                  return (
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '15%' }} /><col style={{ width: '35%' }} />
                        <col style={{ width: '8%' }} /><col style={{ width: '9%' }} />
                        <col style={{ width: '11%' }} /><col style={{ width: '22%' }} />
                      </colgroup>
                      <tbody>
                        <tr>
                          <td rowSpan={2} colSpan={4} style={{ ...cellStyle, textAlign: 'center', padding: '6px' }}>
                            <img src={SENA_SVG} alt="SENA" style={{ width: '44px', height: 'auto' }} />
                          </td>
                          <td colSpan={2} style={cellStyle}>Versión: 04</td>
                        </tr>
                        <tr>
                          <td colSpan={2} style={cellStyle}>Código:<br />GD-F-003</td>
                        </tr>
                        <tr>
                          <td colSpan={6} style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>PROCESO GESTIÓN DOCUMENTAL</td>
                        </tr>
                        <tr>
                          <td colSpan={6} style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>HOJA DE CONTROL</td>
                        </tr>
                        <tr>
                          <td style={{ ...cellStyle, fontWeight: 'bold' }}>SEDE</td>
                          <td style={cellStyle}>{grp.sede}</td>
                          <td colSpan={2} style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>CÓDIGO</td>
                          <td colSpan={2} style={{ ...cellStyle, textAlign: 'center' }}>{grp.cod_sede}</td>
                        </tr>
                        <tr>
                          <td style={{ ...cellStyle, fontWeight: 'bold' }}>UNIDAD ADMINISTRATIVA</td>
                          <td style={cellStyle}>{grp.unidad_administrativa}</td>
                          <td colSpan={2} style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>CÓDIGO</td>
                          <td colSpan={2} style={{ ...cellStyle, textAlign: 'center' }}>{grp.cod_unidad}</td>
                        </tr>
                        <tr>
                          <td style={{ ...cellStyle, fontWeight: 'bold' }}>OFICINA PRODUCTORA</td>
                          <td style={{ ...cellStyle, fontSize: '8.5px' }}>{grp.oficina_productora}</td>
                          <td colSpan={2} style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>CÓDIGO</td>
                          <td colSpan={2} style={{ ...cellStyle, textAlign: 'center' }}>{grp.cod_oficina}</td>
                        </tr>
                        <tr>
                          <td style={{ ...cellStyle, fontWeight: 'bold' }}>IDENTIFICACIÓN DEL EXPEDIENTE</td>
                          <td colSpan={5} style={{ ...cellStyle, fontWeight: 'bold' }}>{grp.identificacion_expediente}</td>
                        </tr>
                        <tr style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          <td rowSpan={2} style={{ ...cellStyle, fontSize: '8px' }}>FECHA DE INGRESO<br />AAAA/MM/DD</td>
                          <td rowSpan={2} style={{ ...cellStyle, fontSize: '8px' }}>IDENTIFICACIÓN DEL TIPO DOCUMENTAL</td>
                          <td colSpan={2} style={{ ...cellStyle, fontSize: '8px' }}>SOPORTE</td>
                          <td rowSpan={2} style={{ ...cellStyle, fontSize: '8px' }}>No. DE FOLIOS<br />DEL - AL</td>
                          <td rowSpan={2} style={{ ...cellStyle, fontSize: '8px' }}>OBSERVACIONES</td>
                        </tr>
                        <tr style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          <td style={{ ...cellStyle, fontSize: '7.5px' }}>FÍSICO</td>
                          <td style={{ ...cellStyle, fontSize: '7.5px' }}>ELECTRÓNICO</td>
                        </tr>
                        {(grp.documentos?.length > 0 ? grp.documentos.slice(0, 8) : Array.from({ length: 4 }, () => ({}))).map((doc, idx) => (
                          <tr key={idx}>
                            <td style={{ ...cellStyle, textAlign: 'center' }}>{doc.fecha || ''}</td>
                            <td style={cellStyle}>{doc.tipo || ''}</td>
                            <td style={{ ...cellStyle, textAlign: 'center' }}>{doc.fisico || ''}</td>
                            <td style={{ ...cellStyle, textAlign: 'center' }}>{doc.electronico || ''}</td>
                            <td style={{ ...cellStyle, textAlign: 'center' }}>{doc.folios || ''}</td>
                            <td style={cellStyle}>{doc.obs || ''}</td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={5} style={{ ...cellStyle, borderRight: 'none', padding: '6px' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '8.5px' }}>NOMBRES Y APELLIDOS DEL RESPONSABLE DE ARCHIVAR LA INFORMACIÓN:</div>
                            <div style={{ marginTop: '4px' }}>{grp.responsable || elaboradoNombre}</div>
                          </td>
                          <td style={{ ...cellStyle, borderLeft: 'none', textAlign: 'center', verticalAlign: 'bottom' }}>
                            PÁGINA 1 DE 1
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Pie de descarga */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div style={{ fontSize: '12px', color: '#475569' }}>
            {mode === 'fuid'
              ? `Se generará el Formato Institucional SENA GD-F-004 (Versión 06) con ${previewData?.total_rows || 0} fila(s) de expediente.`
              : `Se generará el Formato Institucional SENA GD-F-003 (Versión 04) para ${previewData?.total_rows || 0} expediente(s).`}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#fff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#39A900',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 800,
                cursor: downloading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(57, 169, 0, 0.28)'
              }}
            >
              <FileDown size={17} />
              {downloading
                ? 'Generando Formato SENA...'
                : mode === 'fuid'
                  ? 'Descargar Formato Oficial GD-F-004 (PDF)'
                  : 'Descargar Hojas de Control GD-F-003 (PDF)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
