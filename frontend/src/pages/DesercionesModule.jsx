import { useState, useEffect, useRef, memo } from 'react';
import axios from 'axios';
import { 
  FileSpreadsheet, 
  Upload, 
  UserCheck, 
  Mail, 
  Paperclip, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff,
  RefreshCw, 
  Play, 
  Plus, 
  Trash2, 
  FileText, 
  Send,
  Calendar,
  Clock,
  MapPin,
  HelpCircle,
  Download,
  Monitor,
  Maximize2,
  CheckCircle,
  X,
  ShieldCheck,
  Activity,
  Terminal,
  Square
} from 'lucide-react';

const OnBaseLiveFrame = memo(function OnBaseLiveFrame({ liveFrame, onExpand, selectedUser, automationLoading }) {
  if (liveFrame) {
    return (
      <div style={{ border: '2px solid #00324d', borderRadius: '10px', overflow: 'hidden', background: '#000', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <img 
          src={liveFrame} 
          alt="Live Console OnBase Web" 
          onClick={onExpand}
          style={{ width: '100%', display: 'block', maxHeight: '340px', objectFit: 'contain', cursor: 'pointer' }}
          title="Haz clic para ampliar pantalla"
        />
        <div style={{ background: '#00324d', color: '#fff', fontSize: '11px', padding: '6px 12px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', display: 'inline-block' }}></span>
            🔴 TRANSMISIÓN EN VIVO — OnBase Web
          </div>
          <span style={{ opacity: 0.8 }}>Usuario: {selectedUser}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '310px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', borderRadius: '10px', color: '#94a3b8', border: '2px dashed #334155' }}>
      <Monitor size={48} style={{ marginBottom: '12px', opacity: 0.5, color: '#38bdf8' }} />
      <p style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: '#f8fafc' }}>
        {automationLoading ? 'Conectando a la consola OnBase Web...' : 'Consola OnBase Web Lista (En espera)'}
      </p>
      <p style={{ fontSize: '12px', opacity: 0.7, margin: '4px 0 0 0' }}>
        Presione uno de los botones inferiores para iniciar el proceso.
      </p>
    </div>
  );
});

export default function DesercionesModule() {
  const [activeTab, setActiveTab] = useState('citacion'); // 'citacion' | 'resolucion' | 'historico'
  const textareaRef = useRef(null);
  const descInputRef = useRef(null);
  const [activeInputTarget, setActiveInputTarget] = useState('body'); // 'body' | 'descripcion_asunto'

  // Excel & File States
  const [excelFile, setExcelFile] = useState(null);
  const [excelData, setExcelData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [uploadingExcel, setUploadingExcel] = useState(false);

  // Selector de variante de plantilla: 'mayor' (CC / CE / PPT) vs 'menor_ti' (Tarjeta de Identidad TI - Menor de Edad)
  const [plantillaVariante, setPlantillaVariante] = useState('mayor'); // 'mayor' | 'menor_ti'
  const [autoTiTemplate, setAutoTiTemplate] = useState(true);
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [showLiveSplitPreview, setShowLiveSplitPreview] = useState(true);
  const [livePreviewRowIdx, setLivePreviewRowIdx] = useState(0);

  // Plantillas Oficiales SENA CIMI por defecto (100% combinadas y listas para usar)
  const OFFICIAL_CITACION_MAYOR = `68-9224

Girón, {{FECHA_ACTUAL}}

Señor(a)
{{NOMBRE}} {{APELLIDOS}}
{{TIPO}} No. {{DOCUMENTO}}
Programa: {{NIVEL}} - {{PROGRAMA}} ({{TIPO FORMACION}})
Ficha: {{FICHA}}
Correo electrónico registrado en SOFIA Plus: {{CORREO REGISTRADO EN SOFÍA}}

Asunto: Citación a Comité de Evaluación y Seguimiento – Presunta deserción por inasistencias

Cordial saludo.

De conformidad con lo dispuesto en los artículos 50, 51 y 52 del Acuerdo 009 de 2024 – Reglamento del Aprendiz SENA, y en el marco de las competencias del Comité de Evaluación y Seguimiento previstas en el artículo 48 ibídem, modificado por el Acuerdo 002 de 2025, me permito informarle que esta Coordinación Académica recibió un reporte relacionado con su proceso de formación, cuyos hechos podrían configurar una situación de deserción.

En consecuencia, y con el propósito de garantizar sus derechos al debido proceso, defensa y contradicción, se le cita a sesión del Comité de Evaluación y Seguimiento, instancia encargada de revisar las circunstancias del caso y determinar, con fundamento en las pruebas y los descargos que se presenten, si se configura o no la situación de deserción reportada.

RELACIÓN SUCINTA DEL INFORME O DE LA QUEJA PRESENTADA

De acuerdo con el informe presentado por el(la) Instructor(a) {{INSTRUCTOR}} en fecha {{FECHA REPORTE}}, se reporta una situación relacionada con la Deserción POR INASISTENCIAS, que podría configurar una de las causales de deserción previstas en el artículo 30 del Acuerdo 009 de 2024. Los hechos, fechas, actuaciones y demás circunstancias que sustentan el reporte se encuentran detallados en el informe y los soportes presentados por el(la) Instructor(a) {{INSTRUCTOR}}, fechas de inasistencias reportadas: {{FECHAS_INASISTENCIA}}.

IDENTIFICACIÓN DEL(LOS) PROBABLE(S) AUTOR(ES) DE LOS HECHOS

Aprendiz: {{NOMBRE}} {{APELLIDOS}}
Identificación: {{TIPO}} No. {{DOCUMENTO}}
Nivel y Programa de Formación: {{NIVEL}} - {{PROGRAMA}} ({{TIPO FORMACION}})
Ficha de Caracterización: {{FICHA}}
Estado en SOFIA Plus: {{ESTADO}}

NORMAS DEL REGLAMENTO DEL APRENDIZ SENA PRESUNTAMENTE INFRINGIDAS

Acuerdo 009 de 2024 – Reglamento del Aprendiz SENA (modificado por el Acuerdo 002 de 2025): Artículo 30 (Causales de Deserción) y deberes académicos del aprendiz previstos en el Capítulo III.

CITACIÓN Y DERECHO DE DEFENSA Y CONTRADICCIÓN

Para ejercer su derecho a la defensa, controvertir las pruebas y presentar los descargos o soportes de justificación correspondientes, se le cita a sesión del Comité de Evaluación y Seguimiento programada así:

Fecha: {{FECHA_COMITE}}
Hora: {{HORA_COMITE}}
Lugar / Canal de Atención: {{LUGAR_COMITE}}

Contra el presente acto de trámite no procede recurso alguno, de conformidad con el artículo 75 de la Ley 1437 de 2011.

Atentamente,



Manuel Enrique Valencia Moreno
Coordinador Académico - CIMI

Elaboró: Mónica Gómez Rey, Contratista Coordinación Académica`;

  const OFFICIAL_CITACION_MENOR_TI = `68-9224

Girón, {{FECHA_ACTUAL}}

Señor(a) Aprendiz (Menor de Edad)
{{NOMBRE}} {{APELLIDOS}}
y a su Representante Legal / Padre de Familia o Acudiente
{{TIPO}} No. {{DOCUMENTO}} (Tarjeta de Identidad)
Programa: {{NIVEL}} - {{PROGRAMA}} ({{TIPO FORMACION}})
Ficha: {{FICHA}}
Correo electrónico registrado en SOFIA Plus: {{CORREO REGISTRADO EN SOFÍA}}

Asunto: Citación a Comité de Evaluación y Seguimiento (Aprendiz Menor de Edad - TI) – Presunta deserción por inasistencias

Cordial saludo.

De conformidad con lo dispuesto en los artículos 50, 51 y 52 del Acuerdo 009 de 2024 – Reglamento del Aprendiz SENA, en el marco de las competencias del Comité de Evaluación y Seguimiento previstas en el artículo 48 ibídem (modificado por el Acuerdo 002 de 2025), y en observancia de la protección reforzada del debido proceso para adolescentes y menores de edad prevista en la Ley 1098 de 2006 (Código de la Infancia y la Adolescencia), me permito informarles que esta Coordinación Académica recibió un reporte relacionado con el proceso de formación del(la) aprendiz identificado(a) con Tarjeta de Identidad ({{TIPO}} No. {{DOCUMENTO}}), cuyos hechos podrían configurar una situación de deserción.

En consecuencia, y con el propósito de garantizar de manera integral sus derechos al debido proceso, defensa y contradicción, se cita al(la) aprendiz junto con su Representante Legal, Padre de Familia o Acudiente a sesión del Comité de Evaluación y Seguimiento, instancia encargada de revisar las circunstancias del caso y determinar, con fundamento en las pruebas y los descargos que se presenten, si se configura o no la situación de deserción reportada.

RELACIÓN SUCINTA DEL INFORME O DE LA QUEJA PRESENTADA

De acuerdo con el informe presentado por el(la) Instructor(a) {{INSTRUCTOR}} en fecha {{FECHA REPORTE}}, se reporta una situación relacionada con la Deserción POR INASISTENCIAS, que podría configurar una de las causales de deserción previstas en el artículo 30 del Acuerdo 009 de 2024. Los hechos, fechas, actuaciones y demás circunstancias que sustentan el reporte se encuentran detallados en el informe y los soportes presentados por el(la) Instructor(a) {{INSTRUCTOR}}, fechas de inasistencias reportadas: {{FECHAS_INASISTENCIA}}.

IDENTIFICACIÓN DEL(LOS) PROBABLE(S) AUTOR(ES) DE LOS HECHOS

Aprendiz Menor de Edad: {{NOMBRE}} {{APELLIDOS}}
Documento de Identidad: {{TIPO}} No. {{DOCUMENTO}} (Tarjeta de Identidad)
Nivel y Programa de Formación: {{NIVEL}} - {{PROGRAMA}} ({{TIPO FORMACION}})
Ficha de Caracterización: {{FICHA}}
Estado en SOFIA Plus: {{ESTADO}}

NORMAS DEL REGLAMENTO DEL APRENDIZ SENA PRESUNTAMENTE INFRINGIDAS

Acuerdo 009 de 2024 – Reglamento del Aprendiz SENA (modificado por el Acuerdo 002 de 2025): Artículo 30 (Causales de Deserción) y deberes académicos del aprendiz previstos en el Capítulo III.

CITACIÓN CON ACOMPAÑAMIENTO DE REPRESENTANTE LEGAL / ACUDIENTE

Por tratarse de un(a) aprendiz menor de edad con Tarjeta de Identidad ({{TIPO}}), deberá comparecer acompañado(a) de su Representante Legal, Padre de Familia o Acudiente para presentar sus descargos y soportes de justificación en la sesión del Comité de Evaluación y Seguimiento programada así:

Fecha: {{FECHA_COMITE}}
Hora: {{HORA_COMITE}}
Lugar / Canal de Atención: {{LUGAR_COMITE}}

Contra el presente acto de trámite no procede recurso alguno, de conformidad con el artículo 75 de la Ley 1437 de 2011.

Atentamente,



Manuel Enrique Valencia Moreno
Coordinador Académico - CIMI

Elaboró: Mónica Gómez Rey, Contratista Coordinación Académica`;

  const OFFICIAL_RESOLUCION_MAYOR = `68-9224


Girón, {{FECHA_ACTUAL}}

Señor(a)
{{NOMBRE}} {{APELLIDOS}}
{{TIPO}} No. {{DOCUMENTO}}
Programa: {{PROGRAMA}}
Ficha: {{FICHA}}
Correo electrónico registrado en SOFIA Plus: {{CORREO REGISTRADO EN SOFÍA}}

Asunto: Notificación personal electrónica – Resolución No. 68 - {{RESOLUCION}} del {{FECHA RESOLUCIÓN}}

Cordial saludo.

De conformidad con lo dispuesto en el artículo 51 del Acuerdo 009 de 2024 – Reglamento del Aprendiz SENA y el artículo 56 de la Ley 1437 de 2011, y teniendo en cuenta la autorización expresa otorgada por usted mediante la suscripción del formato GFPI-F-015 “Mi compromiso como Aprendiz SENA”, para recibir a través del correo electrónico registrado en SOFIA Plus las notificaciones de los actos académicos y administrativos que profiera la Entidad, por medio de la presente comunicación se efectúa la notificación personal electrónica de la Resolución No. 68 - {{RESOLUCION}} del {{FECHA RESOLUCIÓN}}, expedida por la Subdirección del Centro Industrial de Mantenimiento Integral, mediante la cual se declara la deserción y se ordena la cancelación de su matrícula en el programa de formación {{PROGRAMA}}, ficha {{FICHA}}.

Para su conocimiento, se transcribe la parte resolutiva del citado acto administrativo:

“RESUELVE:

Artículo 1º. DECLARAR LA DESERCION en el proceso de formación del aprendiz mencionado.

Artículo 2º. ORDENAR LA CANCELACION DEL REGISTRO DE MATRICULA al aprendiz referido en el Artículo 1 de la Resolución, quien no podrá participar en procesos de ingreso a la institución en programas de formación titulada dentro de los seis (06) meses siguientes contados a partir del momento en que el acto administrativo suscrito por el Subdirector quede en firme, ni a programas de formación complementaria hasta por tres (03) meses siguientes, contados a partir del registro de la novedad en el Sistema de Gestión Académica, artículo 47 Acuerdo 009 de 2024.”

Para efectos de la presente notificación, se adjunta copia íntegra, auténtica y gratuita del citado acto administrativo.

Recursos: Contra la referida resolución procede el recurso de reposición ante la Subdirección del Centro Industrial de Mantenimiento Integral y, en subsidio, el recurso de apelación ante la Dirección Regional Santander, los cuales deberán interponerse por escrito dentro de los diez (10) días siguientes a la notificación, de conformidad con el artículo 51 del Acuerdo 009 de 2024 y los artículos 74 y siguientes de la Ley 1437 de 2011.

El recurso podrá presentarse mediante comunicación radicada dirigida a la Subdirección del Centro Industrial de Mantenimiento Integral, a través del correo electrónico deserciones9224@sena.edu.co o por los demás canales institucionales habilitados para la radicación de comunicaciones.

De conformidad con el artículo 56 de la Ley 1437 de 2011, la presente notificación se entenderá surtida a partir de la fecha y hora en que usted acceda a la notificación del acto administrativo, circunstancia que deberá quedar certificada por la Administración e incorporada al respectivo expediente.

Atentamente,



TATIANA ANDREA VILLAMIZAR JAIMES
Subdirectora (E)
Centro Industrial de Mantenimiento Integral



Vo. Bo. Manuel Enrique Valencia Moreno, Coordinador Académico
Elaboró. Mónica Gómez Rey, Contratista Coordinación Académica`;

  const OFFICIAL_RESOLUCION_MENOR_TI = `68-9224


Girón, {{FECHA_ACTUAL}}

Señor(a) Aprendiz (Menor de Edad)
{{NOMBRE}} {{APELLIDOS}}
y a su Representante Legal / Padre de Familia o Acudiente
{{TIPO}} No. {{DOCUMENTO}} (Tarjeta de Identidad)
Programa: {{PROGRAMA}}
Ficha: {{FICHA}}
Correo electrónico registrado en SOFIA Plus: {{CORREO REGISTRADO EN SOFÍA}}

Asunto: Notificación personal electrónica (Menor de Edad - TI) – Resolución No. 68 - {{RESOLUCION}} del {{FECHA RESOLUCIÓN}}

Cordial saludo.

De conformidad con lo dispuesto en el artículo 51 del Acuerdo 009 de 2024 – Reglamento del Aprendiz SENA, el artículo 56 de la Ley 1437 de 2011 y la Ley 1098 de 2006, y teniendo en cuenta la autorización expresa otorgada mediante la suscripción del formato GFPI-F-015 “Mi compromiso como Aprendiz SENA”, por medio de la presente comunicación se efectúa la notificación personal electrónica al(la) aprendiz identificado(a) con Tarjeta de Identidad ({{TIPO}} No. {{DOCUMENTO}}) y a su Representante Legal / Acudiente, respecto de la Resolución No. 68 - {{RESOLUCION}} del {{FECHA RESOLUCIÓN}}, expedida por la Subdirección del Centro Industrial de Mantenimiento Integral, mediante la cual se declara la deserción y se ordena la cancelación de su matrícula en el programa de formación {{PROGRAMA}}, ficha {{FICHA}}.

Para su conocimiento, se transcribe la parte resolutiva del citado acto administrativo:

“RESUELVE:

Artículo 1º. DECLARAR LA DESERCION en el proceso de formación del aprendiz mencionado.

Artículo 2º. ORDENAR LA CANCELACION DEL REGISTRO DE MATRICULA al aprendiz referido en el Artículo 1 de la Resolución, quien no podrá participar en procesos de ingreso a la institución en programas de formación titulada dentro de los seis (06) meses siguientes contados a partir del momento en que el acto administrativo suscrito por el Subdirector quede en firme, ni a programas de formación complementaria hasta por tres (03) meses siguientes, contados a partir del registro de la novedad en el Sistema de Gestión Académica, artículo 47 Acuerdo 009 de 2024.”

Para efectos de la presente notificación, se adjunta copia íntegra, auténtica y gratuita del citado acto administrativo.

Recursos: Contra la referida resolución procede el recurso de reposición ante la Subdirección del Centro Industrial de Mantenimiento Integral y, en subsidio, el recurso de apelación ante la Dirección Regional Santander, los cuales podrán ser interpuestos por el(la) aprendiz y/o su Representante Legal o Acudiente dentro de los diez (10) días siguientes a la notificación, a través del correo electrónico deserciones9224@sena.edu.co o por los canales institucionales habilitados.

Atentamente,



TATIANA ANDREA VILLAMIZAR JAIMES
Subdirectora (E)
Centro Industrial de Mantenimiento Integral



Vo. Bo. Manuel Enrique Valencia Moreno, Coordinador Académico
Elaboró. Mónica Gómez Rey, Contratista Coordinación Académica`;

  const OFFICIAL_NOTIFICACION_APRENDIZ_MAYOR = `68-9224

Girón, {{FECHA_ACTUAL}}

Señor(a)
{{NOMBRE}} {{APELLIDOS}}
{{TIPO}} No. {{DOCUMENTO}}
Programa: {{NIVEL}} - {{PROGRAMA}} ({{TIPO FORMACION}})
Ficha: {{FICHA}}
Correo electrónico registrado en SOFIA Plus: {{CORREO REGISTRADO EN SOFÍA}}

Asunto: Notificación al Aprendiz – Proceso de Deserción – Ficha {{FICHA}}

Cordial saludo.

De conformidad con lo dispuesto en el Acuerdo 009 de 2024 – Reglamento del Aprendiz SENA (modificado por el Acuerdo 002 de 2025), me permito notificarle la novedad académica reportada en su proceso de formación por el(la) Instructor(a) {{INSTRUCTOR}} en fecha {{FECHA REPORTE}}, relacionada con las fechas de inasistencia: {{FECHAS_INASISTENCIA}}.

Aprendiz: {{NOMBRE}} {{APELLIDOS}}
Identificación: {{TIPO}} No. {{DOCUMENTO}}
Programa de Formación: {{NIVEL}} - {{PROGRAMA}} ({{TIPO FORMACION}})
Ficha de Caracterización: {{FICHA}}

Atentamente,



Manuel Enrique Valencia Moreno
Coordinador Académico - CIMI

Elaboró: Mónica Gómez Rey, Contratista Coordinación Académica`;

  const OFFICIAL_NOTIFICACION_APRENDIZ_MENOR_TI = `68-9224

Girón, {{FECHA_ACTUAL}}

Señor(a) Aprendiz (Menor de Edad)
{{NOMBRE}} {{APELLIDOS}}
y a su Representante Legal / Padre de Familia o Acudiente: {{NOMBRE_ACUDIENTE}}
{{TIPO}} No. {{DOCUMENTO}} (Tarjeta de Identidad)
Programa: {{NIVEL}} - {{PROGRAMA}} ({{TIPO FORMACION}})
Ficha: {{FICHA}}
Correo electrónico registrado en SOFIA Plus: {{CORREO REGISTRADO EN SOFÍA}}

Asunto: Notificación al Aprendiz (Menor de Edad - TI) – Proceso de Deserción – Ficha {{FICHA}}

Cordial saludo.

De conformidad con lo dispuesto en el Acuerdo 009 de 2024 – Reglamento del Aprendiz SENA (modificado por el Acuerdo 002 de 2025) y la Ley 1098 de 2006 (Código de la Infancia y la Adolescencia), me permito notificarles la novedad académica reportada en el proceso de formación por el(la) Instructor(a) {{INSTRUCTOR}} en fecha {{FECHA REPORTE}}, relacionada con las fechas de inasistencia: {{FECHAS_INASISTENCIA}}.

Aprendiz Menor de Edad: {{NOMBRE}} {{APELLIDOS}}
Identificación: {{TIPO}} No. {{DOCUMENTO}} (Tarjeta de Identidad)
Programa de Formación: {{NIVEL}} - {{PROGRAMA}} ({{TIPO FORMACION}})
Ficha de Caracterización: {{FICHA}}

Atentamente,



Manuel Enrique Valencia Moreno
Coordinador Académico - CIMI

Elaboró: Mónica Gómez Rey, Contratista Coordinación Académica`;

  // Estados de Plantillas (Mayor de Edad CC y Menor de Edad TI) sincronizados con PostgreSQL y localStorage v2
  const [textoInicialCitacion, setTextoInicialCitacion] = useState(() => {
    return localStorage.getItem('sena_deserciones_citacion_mayor_v2') || OFFICIAL_CITACION_MAYOR;
  });
  const [textoInicialCitacionTi, setTextoInicialCitacionTi] = useState(() => {
    return localStorage.getItem('sena_deserciones_citacion_ti_v2') || OFFICIAL_CITACION_MENOR_TI;
  });

  const [textoInicialResolucion, setTextoInicialResolucion] = useState(() => {
    return localStorage.getItem('sena_deserciones_resolucion_mayor_v2') || OFFICIAL_RESOLUCION_MAYOR;
  });
  const [textoInicialResolucionTi, setTextoInicialResolucionTi] = useState(() => {
    return localStorage.getItem('sena_deserciones_resolucion_ti_v2') || OFFICIAL_RESOLUCION_MENOR_TI;
  });

  // Estados de la nueva pestaña "Notificación Aprendiz" (guardado predeterminado automático al pegar/editar)
  const [textoInicialNotifAprendiz, setTextoInicialNotifAprendiz] = useState(() => {
    return localStorage.getItem('sena_deserciones_notif_aprendiz_mayor_v2') || OFFICIAL_NOTIFICACION_APRENDIZ_MAYOR;
  });
  const [textoInicialNotifAprendizTi, setTextoInicialNotifAprendizTi] = useState(() => {
    return localStorage.getItem('sena_deserciones_notif_aprendiz_ti_v2') || OFFICIAL_NOTIFICACION_APRENDIZ_MENOR_TI;
  });
  const [syncNotifAprendizUnicaCarta, setSyncNotifAprendizUnicaCarta] = useState(() => {
    const saved = localStorage.getItem('sena_deserciones_notif_aprendiz_sync_unica');
    return saved !== null ? saved === 'true' : true;
  });
  const [autoSaveBadge, setAutoSaveBadge] = useState('');
  const templatesLoadedFromServerRef = useRef(false);

  // Estados de Asunto y Descripción del Asunto (Mayor CC y Menor TI)
  const [asuntoCitacion, setAsuntoCitacion] = useState(() => {
    return localStorage.getItem('sena_deserciones_citacion_asunto_v2') || 'NOVEDADES DE ALUMNOS';
  });
  const [descripcionAsuntoCitacion, setDescripcionAsuntoCitacion] = useState(() => {
    return localStorage.getItem('sena_deserciones_citacion_desc_mayor_v2') || 'Citación a Comité de Evaluación y Seguimiento – Presunta deserción por inasistencias – Ficha {{FICHA}}';
  });
  const [descripcionAsuntoCitacionTi, setDescripcionAsuntoCitacionTi] = useState(() => {
    return localStorage.getItem('sena_deserciones_citacion_desc_ti_v2') || 'Citación a Comité de Evaluación y Seguimiento (Menor de Edad TI) – Presunta deserción – Ficha {{FICHA}}';
  });

  const [asuntoResolucion, setAsuntoResolucion] = useState(() => {
    return localStorage.getItem('sena_deserciones_resolucion_asunto_v2') || 'NOVEDADES DE ALUMNOS';
  });
  const [descripcionAsuntoResolucion, setDescripcionAsuntoResolucion] = useState(() => {
    return localStorage.getItem('sena_deserciones_resolucion_desc_mayor_v2') || 'Notificación personal electrónica – Resolución No. 68 - {{RESOLUCION}} del {{FECHA RESOLUCIÓN}}';
  });
  const [descripcionAsuntoResolucionTi, setDescripcionAsuntoResolucionTi] = useState(() => {
    return localStorage.getItem('sena_deserciones_resolucion_desc_ti_v2') || 'Notificación personal electrónica (Menor de Edad TI) – Resolución No. 68 - {{RESOLUCION}} del {{FECHA RESOLUCIÓN}}';
  });

  const [asuntoNotifAprendiz, setAsuntoNotifAprendiz] = useState(() => {
    return localStorage.getItem('sena_deserciones_notif_aprendiz_asunto_v2') || 'NOVEDADES DE ALUMNOS';
  });
  const [descripcionAsuntoNotifAprendiz, setDescripcionAsuntoNotifAprendiz] = useState(() => {
    return localStorage.getItem('sena_deserciones_notif_aprendiz_desc_mayor_v2') || 'Notificación al Aprendiz – Proceso de Deserción – Ficha {{FICHA}}';
  });
  const [descripcionAsuntoNotifAprendizTi, setDescripcionAsuntoNotifAprendizTi] = useState(() => {
    return localStorage.getItem('sena_deserciones_notif_aprendiz_desc_ti_v2') || 'Notificación al Aprendiz (Menor de Edad TI) – Proceso de Deserción – Ficha {{FICHA}}';
  });

  // Parámetros rápidos del Comité (se inyectan automáticamente en {{FECHA_COMITE}}, {{HORA_COMITE}}, {{LUGAR_COMITE}})
  const [comiteDefaults, setComiteDefaults] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('sena_deserciones_comite_defaults_v2') || 'null');
      if (saved && saved.fecha_comite) return saved;
    } catch (e) {}
    return {
      fecha_comite: 'Dentro de los cinco (5) días hábiles siguientes al envío de la presente citación',
      hora_comite: '8:00 a.m. a 12:00 m. / 2:00 p.m. a 4:00 p.m.',
      lugar_comite: 'Coordinación Académica - Edificio D, Centro Industrial de Mantenimiento Integral CIMI (Km 7 vía Palenque - Rincón de Girón) o al correo deserciones9224@sena.edu.co',
      causal_desercion: 'POR INASISTENCIAS'
    };
  });

  // Persistir plantillas v2 en localStorage automáticamente
  useEffect(() => { localStorage.setItem('sena_deserciones_citacion_mayor_v2', textoInicialCitacion); }, [textoInicialCitacion]);
  useEffect(() => { localStorage.setItem('sena_deserciones_citacion_ti_v2', textoInicialCitacionTi); }, [textoInicialCitacionTi]);
  useEffect(() => { localStorage.setItem('sena_deserciones_resolucion_mayor_v2', textoInicialResolucion); }, [textoInicialResolucion]);
  useEffect(() => { localStorage.setItem('sena_deserciones_resolucion_ti_v2', textoInicialResolucionTi); }, [textoInicialResolucionTi]);
  useEffect(() => { localStorage.setItem('sena_deserciones_notif_aprendiz_mayor_v2', textoInicialNotifAprendiz); }, [textoInicialNotifAprendiz]);
  useEffect(() => { localStorage.setItem('sena_deserciones_notif_aprendiz_ti_v2', textoInicialNotifAprendizTi); }, [textoInicialNotifAprendizTi]);
  useEffect(() => { localStorage.setItem('sena_deserciones_notif_aprendiz_sync_unica', String(syncNotifAprendizUnicaCarta)); }, [syncNotifAprendizUnicaCarta]);
  useEffect(() => { localStorage.setItem('sena_deserciones_citacion_asunto_v2', asuntoCitacion); }, [asuntoCitacion]);
  useEffect(() => { localStorage.setItem('sena_deserciones_citacion_desc_mayor_v2', descripcionAsuntoCitacion); }, [descripcionAsuntoCitacion]);
  useEffect(() => { localStorage.setItem('sena_deserciones_citacion_desc_ti_v2', descripcionAsuntoCitacionTi); }, [descripcionAsuntoCitacionTi]);
  useEffect(() => { localStorage.setItem('sena_deserciones_resolucion_asunto_v2', asuntoResolucion); }, [asuntoResolucion]);
  useEffect(() => { localStorage.setItem('sena_deserciones_resolucion_desc_mayor_v2', descripcionAsuntoResolucion); }, [descripcionAsuntoResolucion]);
  useEffect(() => { localStorage.setItem('sena_deserciones_resolucion_desc_ti_v2', descripcionAsuntoResolucionTi); }, [descripcionAsuntoResolucionTi]);
  useEffect(() => { localStorage.setItem('sena_deserciones_notif_aprendiz_asunto_v2', asuntoNotifAprendiz); }, [asuntoNotifAprendiz]);
  useEffect(() => { localStorage.setItem('sena_deserciones_notif_aprendiz_desc_mayor_v2', descripcionAsuntoNotifAprendiz); }, [descripcionAsuntoNotifAprendiz]);
  useEffect(() => { localStorage.setItem('sena_deserciones_notif_aprendiz_desc_ti_v2', descripcionAsuntoNotifAprendizTi); }, [descripcionAsuntoNotifAprendizTi]);
  useEffect(() => { localStorage.setItem('sena_deserciones_comite_defaults_v2', JSON.stringify(comiteDefaults)); }, [comiteDefaults]);

  // OnBase User & Password Credential States con Persistencia en localStorage & system_settings
  const [onbaseUserCredential, setOnbaseUserCredential] = useState(() => {
    return localStorage.getItem('sena_deserciones_onbase_user') || 'luepitar';
  });
  const [onbasePasswordCredential, setOnbasePasswordCredential] = useState(() => {
    return localStorage.getItem('sena_deserciones_onbase_pass') || 'Automatizador2026*';
  });
  const [showOnbasePassword, setShowOnbasePassword] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);

  const [onbaseUsers, setOnbaseUsers] = useState([]);
  const [selectedOnbaseUser, setSelectedOnbaseUser] = useState(() => {
    return localStorage.getItem('sena_deserciones_default_onbase_user') || 'luepitar';
  });
  const frequentCimiContacts = [
    { name: 'Manuel Valencia', email: 'mevalencia@sena.edu.co', roleLabel: 'Coordinador Académico' },
    { name: 'Monica Gomez', email: 'mlgomez@sena.edu.co', roleLabel: 'Contratista Deserciones' },
    { name: 'Luis Ernesto Parada Moreno', email: 'leparadam@sena.edu.co', roleLabel: 'Apoyo Gestión Documental' },
    { name: 'Buzón Deserciones CIMI', email: 'deserciones9224@sena.edu.co', roleLabel: 'Canal Oficial Recursos' }
  ];

  const [ccEmails, setCcEmails] = useState(() => {
    const saved = localStorage.getItem('sena_deserciones_cc_emails');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && !parsed.some(p => p.email === 'subdireccion_centro@sena.edu.co')) {
          return parsed;
        }
      } catch (e) {
        console.error('Error parseando correos CC de localStorage:', e);
      }
    }
    return [
      { name: 'Manuel Valencia', email: 'mevalencia@sena.edu.co' },
      { name: 'Monica Gomez', email: 'mlgomez@sena.edu.co' },
      { name: 'Luis Ernesto Parada Moreno', email: 'leparadam@sena.edu.co' }
    ];
  });
  const [newCcName, setNewCcName] = useState('');
  const [newCcEmail, setNewCcEmail] = useState('');

  // Estados de Consola en Vivo y Robot Independiente de Deserciones (aislado de Cargue AES)
  const [liveFrame, setLiveFrame] = useState(null);
  const [automationLoading, setAutomationLoading] = useState(false);
  const [botHasBrowserOpen, setBotHasBrowserOpen] = useState(false);
  const [botProgress, setBotProgress] = useState({ total: 0, processed: 0, success: 0, errors: 0 });
  const [useCustomPassword, setUseCustomPassword] = useState(false);
  const [historicoSearch, setHistoricoSearch] = useState('');
  const [linkingHistorias, setLinkingHistorias] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [automationError, setAutomationError] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isMonitorExpanded, setIsMonitorExpanded] = useState(false);

  // Pasos de Automatización programados hasta el Paso 4 (Diligenciamiento Completo)
  const automationSteps = [
    {
      id: 1,
      label: 'Paso 1: Conexión y Autenticación en OnBase Web',
      desc: 'Apertura de navegador web, navegación a OnBase e inicio de sesión con el usuario por defecto.'
    },
    {
      id: 2,
      label: 'Paso 2: Apertura del Menú / NavPanel Principal',
      desc: 'Navegación al menú de módulos y barras de herramientas de OnBase Web.'
    },
    {
      id: 3,
      label: 'Paso 3: Selección de Formulario "UForm Comunicación Electrónica"',
      desc: 'Clic en cuadrícula (::: / Nuevo formulario) -> Desplegar "COMUNICACIONES PRODUCIDAS" -> Clic en "UForm Comunicacion Electronica".'
    },
    {
      id: 4,
      label: 'Paso 4: Diligenciamiento y Envío de Formulario',
      desc: 'Destinatario (Aprendiz y Correo Sofía), Asunto, Desc. Asunto, Carta Combinada, Adjuntar Anexo/Resolución, Copias Externas (CC) y Clic en Enviar.'
    }
  ];

  // Polling del Robot Independiente de Deserciones (/api/deserciones/bot/status — 100% separado de Cargue AES)
  useEffect(() => {
    let interval = null;
    if (automationLoading || botHasBrowserOpen) {
      interval = setInterval(async () => {
        try {
          const token = localStorage.getItem('token');
          const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
          const statusRes = await axios.get('/api/deserciones/bot/status', { headers: authHeaders });
          const st = statusRes.data;

          setBotHasBrowserOpen(Boolean(st.hasBrowserOpen));
          setBotProgress({
            total: st.totalCasos || 0,
            processed: st.processedCasos || 0,
            success: st.successCasos || 0,
            errors: st.errorCasos || 0
          });

          if (st.logs && st.logs.length > 0) {
            setLogs(st.logs);

            const logsTxt = st.logs.join(' ');
            if (logsTxt.includes('[PASO 4]')) {
              setCurrentStepIndex(3);
            } else if (logsTxt.includes('[PASO 3]')) {
              setCurrentStepIndex(2);
            } else if (logsTxt.includes('[PASO 2]')) {
              setCurrentStepIndex(1);
            } else if (logsTxt.includes('[PASO 1]')) {
              setCurrentStepIndex(0);
            }
          }

          if (st.hasFrame) {
            const nextSrc = `/api/deserciones/bot/frame?t=${Date.now()}&token=${token}`;
            const preloadImg = new Image();
            preloadImg.onload = () => {
              setLiveFrame(nextSrc);
            };
            preloadImg.src = nextSrc;
          } else if (!st.running && !st.hasBrowserOpen) {
            setLiveFrame(null);
          }

          if (automationLoading && (st.completed || st.running === false)) {
            setAutomationLoading(false);
            fetchHistorico();
          }

          if (st.error) {
            setAutomationLoading(false);
            setAutomationError(true);
          }
        } catch (e) {
          console.error('Error en sondeo del Robot de Deserciones:', e);
        }
      }, 800);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [automationLoading, botHasBrowserOpen]);

  // Row Selection & Explicit Attachments per Row
  const [selectedRows, setSelectedRows] = useState({});
  const [rowAttachments, setRowAttachments] = useState({}); // { [rowId]: { name, path } }
  const [uploadingAttachmentId, setUploadingAttachmentId] = useState(null);
  const [uploadingBatchAttachments, setUploadingBatchAttachments] = useState(false);

  // Preview & Detail Modal States
  const [previewItem, setPreviewItem] = useState(null);
  const [previewText, setPreviewText] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [detailCaso, setDetailCaso] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingAcudienteCasoId, setEditingAcudienteCasoId] = useState(null);
  const [editAcudienteNombre, setEditAcudienteNombre] = useState('');
  const [editAcudienteCorreo, setEditAcudienteCorreo] = useState('');
  const [editAcudienteDocTipo, setEditAcudienteDocTipo] = useState('TI');
  const [savingAcudienteId, setSavingAcudienteId] = useState(null);

  // Historico, Lotes Masivos & Sincronización de Radicados por Correo State
  const [historico, setHistorico] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [selectedLoteId, setSelectedLoteId] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Pendiente'); // 'Pendiente' | 'Cargado' | 'Todos'
  const [historicoDocTypeFilter, setHistoricoDocTypeFilter] = useState('Todos'); // 'Todos' | 'TI' | 'MAYORES' | 'TI_SIN_ACUDIENTE'
  const [excelDocTypeFilter, setExcelDocTypeFilter] = useState('Todos'); // 'Todos' | 'TI' | 'MAYORES' | 'TI_SIN_ACUDIENTE'
  const [excelSearch, setExcelSearch] = useState('');
  const [selectedHistoricoRows, setSelectedHistoricoRows] = useState({}); // { [casoId]: boolean }
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [processingSave, setProcessingSave] = useState(false);
  const [processingOnBase, setProcessingOnBase] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  // Estados del Sincronizador de Radicados desde Correo (leparadam@sena.edu.co -> Producidas)
  const [showEmailSyncModal, setShowEmailSyncModal] = useState(false);
  const [emailSyncTab, setEmailSyncTab] = useState('robot'); // 'robot' | 'manual'
  const [emailSyncUser, setEmailSyncUser] = useState('leparadam@sena.edu.co');
  const [emailSyncPass, setEmailSyncPass] = useState('');
  const [emailSyncFolder, setEmailSyncFolder] = useState('Producidas');
  const [emailSyncRunning, setEmailSyncRunning] = useState(false);
  const [emailSyncStateData, setEmailSyncStateData] = useState({
    status: 'idle',
    mfaNumber: null,
    authPrompt: null,
    logs: [],
    stats: { emailsScanned: 0, cpeFound: 0, matchedUpdated: 0, alreadyUpdated: 0, unmatchedCount: 0 },
    updatedRecords: []
  });
  const [emailSyncFrame, setEmailSyncFrame] = useState(null);
  const [emailSyncBrowserInput, setEmailSyncBrowserInput] = useState('');
  const [manualEmailText, setManualEmailText] = useState('');
  const [importingManualEmail, setImportingManualEmail] = useState(false);

  // Variables estándar SENA CIMI listas para insertar con 1 clic
  const standardChips = [
    '{{NOMBRE}}',
    '{{APELLIDOS}}',
    '{{TIPO}}',
    '{{DOCUMENTO}}',
    '{{CORREO REGISTRADO EN SOFÍA}}',
    '{{NOMBRE_ACUDIENTE}}',
    '{{CORREO_ACUDIENTE}}',
    '{{FICHA}}',
    '{{NIVEL}}',
    '{{PROGRAMA}}',
    '{{TIPO FORMACION}}',
    '{{INSTRUCTOR}}',
    '{{FECHA REPORTE}}',
    '{{FECHAS_INASISTENCIA}}',
    '{{INASISTENCIA DESDE}}',
    '{{HASTA}}',
    '{{ESTADO}}',
    '{{FECHA_COMITE}}',
    '{{HORA_COMITE}}',
    '{{LUGAR_COMITE}}',
    '{{RESOLUCION}}',
    '{{FECHA RESOLUCIÓN}}'
  ];

  // Variables disponibles para combinar: dinámicas desde el Excel cargado (filtrando columnas vacías __EMPTY)
  const cleanExcelChips = (columns || [])
    .map(c => String(c || '').trim())
    .filter(c => c && !/^__EMPTY/i.test(c))
    .map(c => `{{${c}}}`);

  const availableChips = cleanExcelChips.length > 0
    ? Array.from(new Set([...cleanExcelChips, ...standardChips]))
    : standardChips;

  // Cuentas oficiales OnBase Web (se sincronizan dinámicamente desde organization_structure en el servidor)
  const defaultOnbaseUserOptions = [
    {
      id: 'EDHERNANDEZM',
      username: 'EDHERNANDEZM',
      full_name: 'EDHERNANDEZM — Formación Profesional Integral (9224.4)'
    },
    {
      id: 'luepitar',
      username: 'luepitar',
      full_name: 'luepitar — Administración Educativa (9224.2)'
    },
    {
      id: 'TVILLAMIZARJ',
      username: 'TVILLAMIZARJ',
      full_name: 'TVILLAMIZARJ — Subdirección de Centro (9224)'
    }
  ];

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchSavedTemplates = async () => {
    try {
      const res = await axios.get('/api/deserciones/templates', { headers: getAuthHeaders() });
      const tpl = res.data?.templates;
      if (tpl) {
        if (tpl.citacion_mayor) setTextoInicialCitacion(tpl.citacion_mayor);
        if (tpl.citacion_menor_ti) setTextoInicialCitacionTi(tpl.citacion_menor_ti);
        if (tpl.resolucion_mayor) setTextoInicialResolucion(tpl.resolucion_mayor);
        if (tpl.resolucion_menor_ti) setTextoInicialResolucionTi(tpl.resolucion_menor_ti);
        if (tpl.notificacion_aprendiz_mayor) setTextoInicialNotifAprendiz(tpl.notificacion_aprendiz_mayor);
        if (tpl.notificacion_aprendiz_menor_ti) setTextoInicialNotifAprendizTi(tpl.notificacion_aprendiz_menor_ti);
        if (tpl.asunto_citacion) setAsuntoCitacion(tpl.asunto_citacion);
        if (tpl.descripcion_asunto_citacion_mayor) setDescripcionAsuntoCitacion(tpl.descripcion_asunto_citacion_mayor);
        if (tpl.descripcion_asunto_citacion_ti) setDescripcionAsuntoCitacionTi(tpl.descripcion_asunto_citacion_ti);
        if (tpl.asunto_resolucion) setAsuntoResolucion(tpl.asunto_resolucion);
        if (tpl.descripcion_asunto_resolucion_mayor) setDescripcionAsuntoResolucion(tpl.descripcion_asunto_resolucion_mayor);
        if (tpl.descripcion_asunto_resolucion_ti) setDescripcionAsuntoResolucionTi(tpl.descripcion_asunto_resolucion_ti);
        if (tpl.asunto_notificacion_aprendiz) setAsuntoNotifAprendiz(tpl.asunto_notificacion_aprendiz);
        if (tpl.descripcion_asunto_notificacion_aprendiz_mayor) setDescripcionAsuntoNotifAprendiz(tpl.descripcion_asunto_notificacion_aprendiz_mayor);
        if (tpl.descripcion_asunto_notificacion_aprendiz_ti) setDescripcionAsuntoNotifAprendizTi(tpl.descripcion_asunto_notificacion_aprendiz_ti);
        if (tpl.comite_defaults) setComiteDefaults(prev => ({ ...prev, ...tpl.comite_defaults }));
      }
    } catch (e) {
      console.warn('[DESERCIONES] Usando plantillas locales por defecto:', e.message);
    } finally {
      setTimeout(() => { templatesLoadedFromServerRef.current = true; }, 350);
    }
  };

  const handleSaveTemplatesToServer = async (silent = false) => {
    if (!silent) setSavingTemplates(true);
    try {
      const payload = {
        asunto_citacion: asuntoCitacion,
        descripcion_asunto_citacion_mayor: descripcionAsuntoCitacion,
        descripcion_asunto_citacion_ti: descripcionAsuntoCitacionTi,
        citacion_mayor: textoInicialCitacion,
        citacion_menor_ti: textoInicialCitacionTi,
        asunto_resolucion: asuntoResolucion,
        descripcion_asunto_resolucion_mayor: descripcionAsuntoResolucion,
        descripcion_asunto_resolucion_ti: descripcionAsuntoResolucionTi,
        resolucion_mayor: textoInicialResolucion,
        resolucion_menor_ti: textoInicialResolucionTi,
        asunto_notificacion_aprendiz: asuntoNotifAprendiz,
        descripcion_asunto_notificacion_aprendiz_mayor: descripcionAsuntoNotifAprendiz,
        descripcion_asunto_notificacion_aprendiz_ti: descripcionAsuntoNotifAprendizTi,
        notificacion_aprendiz_mayor: textoInicialNotifAprendiz,
        notificacion_aprendiz_menor_ti: syncNotifAprendizUnicaCarta ? textoInicialNotifAprendiz : textoInicialNotifAprendizTi,
        comite_defaults: comiteDefaults
      };
      await axios.post('/api/deserciones/templates', { templates: payload }, { headers: getAuthHeaders() });
      setAutoSaveBadge('✓ Guardada predeterminadamente en el servidor');
      if (!silent) {
        setStatusMessage({
          type: 'success',
          text: '✅ Plantillas de Citación, Notificación Aprendiz y Resolución guardadas permanentemente como predeterminadas en el servidor.'
        });
      }
    } catch (e) {
      if (!silent) {
        setStatusMessage({
          type: 'error',
          text: e.response?.data?.error || 'Error al guardar las plantillas en el servidor.'
        });
      }
    } finally {
      if (!silent) setSavingTemplates(false);
    }
  };

  // Auto-guardado automático en servidor cada vez que el usuario pega o edita la carta en "Notificación Aprendiz" (o cualquier plantilla)
  useEffect(() => {
    if (!templatesLoadedFromServerRef.current) return;
    setAutoSaveBadge('⏳ Guardando carta predeterminada...');
    const timer = setTimeout(() => {
      handleSaveTemplatesToServer(true);
    }, 650);
    return () => clearTimeout(timer);
  }, [
    textoInicialNotifAprendiz,
    textoInicialNotifAprendizTi,
    asuntoNotifAprendiz,
    descripcionAsuntoNotifAprendiz,
    descripcionAsuntoNotifAprendizTi,
    syncNotifAprendizUnicaCarta,
    textoInicialCitacion,
    textoInicialCitacionTi,
    textoInicialResolucion,
    textoInicialResolucionTi
  ]);

  const handleLoadLatestExcel = async (silent = false) => {
    if (!silent) setUploadingExcel(true);
    try {
      const res = await axios.get('/api/deserciones/latest-excel', { headers: getAuthHeaders() });
      const rows = res.data?.rows || [];
      if (rows.length > 0) {
        setExcelData(rows);
        setColumns(res.data?.columns || []);
        setExcelFile({
          name: res.data?.filename || '45 aprendices.xlsx',
          filepath: res.data?.filepath || ''
        });
        const selMap = {};
        rows.forEach(r => { selMap[r.id_temp] = true; });
        setSelectedRows(selMap);
        if (!silent) {
          setStatusMessage({
            type: 'success',
            text: `✅ Excel recargado automáticamente (${rows.length} aprendices: ${res.data.total_mayores || 0} Mayores CC/PPT y ${res.data.total_ti || 0} Menores con Tarjeta de Identidad TI).`
          });
        }
      }
    } catch (e) {
      if (!silent) {
        setStatusMessage({
          type: 'warning',
          text: e.response?.data?.error || 'No se encontró un Excel previo en el servidor.'
        });
      }
    } finally {
      if (!silent) setUploadingExcel(false);
    }
  };

  //Combinación en vivo lado a lado en el navegador (instantánea mientras el usuario edita)
  const computeClientLiveMerge = (tpl, row) => {
    if (!tpl) return '';
    if (!row) return tpl;
    let out = tpl;
    const rawInasDesde = row.inasistencia_desde || row.raw_row?.['INASISTENCIA DESDE'] || '';
    const rawInasHasta = row.hasta || row.raw_row?.['HASTA'] || '';
    const fechasInas = row.fechas_inasistencia || (rawInasDesde && rawInasHasta ? `${rawInasDesde} — ${rawInasHasta}` : (rawInasDesde || rawInasHasta || 'Según reporte adjunto del instructor'));

    const map = {
      'NOMBRE': row.aprendiz_nombres || row.raw_row?.['NOMBRE'] || row.aprendiz_nombre || '',
      'NOMBRES': row.aprendiz_nombres || row.raw_row?.['NOMBRE'] || row.aprendiz_nombre || '',
      'APELLIDOS': row.aprendiz_apellidos || row.raw_row?.['APELLIDOS'] || '',
      'APRENDIZ_NOMBRE': row.aprendiz_nombre || '',
      'TIPO': row.aprendiz_doc_tipo || row.raw_row?.['TIPO'] || 'CC',
      'APRENDIZ_DOC_TIPO': row.aprendiz_doc_tipo || row.raw_row?.['TIPO'] || 'CC',
      'DOCUMENTO': row.aprendiz_doc_numero || row.raw_row?.['DOCUMENTO'] || '',
      'APRENDIZ_DOC_NUMERO': row.aprendiz_doc_numero || row.raw_row?.['DOCUMENTO'] || '',
      'FICHA': row.ficha || row.raw_row?.['FICHA'] || '',
      'NIVEL': row.nivel || row.raw_row?.['NIVEL'] || 'FORMACIÓN TITULADA',
      'PROGRAMA': row.programa || row.raw_row?.['PROGRAMA'] || '',
      'TIPO FORMACION': row.tipo_formacion || row.raw_row?.['TIPO FORMACION'] || 'PRESENCIAL',
      'CORREO REGISTRADO EN SOFÍA': row.aprendiz_correo || row.raw_row?.['CORREO REGISTRADO EN SOFÍA'] || row.raw_row?.['CORREO REGISTRADO EN SOFIA'] || '',
      'CORREO REGISTRADO EN SOFIA': row.aprendiz_correo || row.raw_row?.['CORREO REGISTRADO EN SOFÍA'] || row.raw_row?.['CORREO REGISTRADO EN SOFIA'] || '',
      'APRENDIZ_CORREO': row.aprendiz_correo || '',
      'ACUDIENTE': row.acudiente_nombre || row.raw_row?.['NOMBRE ACUDIENTE'] || row.raw_row?.['ACUDIENTE'] || 'Representante Legal / Padre de Familia o Acudiente',
      'NOMBRE_ACUDIENTE': row.acudiente_nombre || row.raw_row?.['NOMBRE ACUDIENTE'] || row.raw_row?.['ACUDIENTE'] || 'Representante Legal / Padre de Familia o Acudiente',
      'NOMBRE ACUDIENTE': row.acudiente_nombre || row.raw_row?.['NOMBRE ACUDIENTE'] || row.raw_row?.['ACUDIENTE'] || 'Representante Legal / Padre de Familia o Acudiente',
      'CORREO_ACUDIENTE': row.acudiente_correo || row.raw_row?.['CORREO ACUDIENTE'] || row.raw_row?.['EMAIL ACUDIENTE'] || '',
      'CORREO ACUDIENTE': row.acudiente_correo || row.raw_row?.['CORREO ACUDIENTE'] || row.raw_row?.['EMAIL ACUDIENTE'] || '',
      'INSTRUCTOR': row.instructor || row.raw_row?.['INSTRUCTOR'] || 'Instructor de la Ficha',
      'FECHA REPORTE': row.fecha_reporte || row.raw_row?.['FECHA REPORTE'] || new Date().toLocaleDateString('es-CO'),
      'ESTADO': row.estado || row.raw_row?.['ESTADO'] || 'MATRICULADO',
      'INASISTENCIA DESDE': rawInasDesde,
      'HASTA': rawInasHasta,
      'FECHAS_INASISTENCIA': fechasInas,
      'CAUSAL_DESERCION': row.causal_desercion || comiteDefaults.causal_desercion || 'POR INASISTENCIAS',
      'FECHA_COMITE': row.fecha_comite || comiteDefaults.fecha_comite || '',
      'HORA_COMITE': row.hora_comite || comiteDefaults.hora_comite || '',
      'LUGAR_COMITE': row.lugar_comite || comiteDefaults.lugar_comite || '',
      'RESOLUCION': row.resolucion || row.raw_row?.['RESOLUCION'] || row.raw_row?.['RESOLUCIÓN'] || '',
      'RESOLUCIÓN': row.resolucion || row.raw_row?.['RESOLUCION'] || row.raw_row?.['RESOLUCIÓN'] || '',
      'FECHA_ACTUAL': new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
    };
    if (row.raw_row && typeof row.raw_row === 'object') {
      Object.keys(row.raw_row).forEach(k => {
        if (map[k.toUpperCase()] === undefined) {
          map[k.toUpperCase()] = String(row.raw_row[k] ?? '');
        }
      });
    }
    const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
    const normMap = {};
    Object.keys(map).forEach(k => { normMap[norm(k)] = map[k]; });

    out = out.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (full, tok) => {
      const nk = norm(tok);
      return Object.prototype.hasOwnProperty.call(normMap, nk) ? normMap[nk] : full;
    });
    return out;
  };

  // Fetch active users for OnBase assignment, Historico, CC Emails, Saved Templates & Latest Excel on mount
  useEffect(() => {
    fetchUsers();
    fetchHistorico();
    fetchCcEmails();
    fetchSavedTemplates();
    handleLoadLatestExcel(true);
    // Reconectar automáticamente si el Robot de Deserciones ya estaba ejecutando en segundo plano
    axios.get('/api/deserciones/bot/status', { headers: getAuthHeaders() })
      .then(res => {
        const st = res.data || {};
        if (st.running) setAutomationLoading(true);
        if (st.hasBrowserOpen) setBotHasBrowserOpen(true);
        if (Array.isArray(st.logs) && st.logs.length > 0) setLogs(st.logs);
      })
      .catch(() => {});
  }, []);

  const fetchCcEmails = async () => {
    try {
      const res = await axios.get('/api/deserciones/cc-emails', { headers: getAuthHeaders() });
      if (res.data && Array.isArray(res.data.cc_emails) && res.data.cc_emails.length > 0) {
        setCcEmails(res.data.cc_emails);
        localStorage.setItem('sena_deserciones_cc_emails', JSON.stringify(res.data.cc_emails));
      }
    } catch (err) {
      console.warn('[DESERCIONES] Usando correos CC en localStorage o por defecto:', err.message);
    }
  };

  const persistCcEmails = async (updatedCcList) => {
    setCcEmails(updatedCcList);
    localStorage.setItem('sena_deserciones_cc_emails', JSON.stringify(updatedCcList));
    try {
      await axios.post('/api/deserciones/cc-emails', { cc_emails: updatedCcList }, { headers: getAuthHeaders() });
    } catch (err) {
      console.error('[DESERCIONES] Error persistiendo correos CC en la base de datos:', err.message);
    }
  };

  const fetchUsers = async () => {
    let baseOptions = defaultOnbaseUserOptions;
    try {
      const res = await axios.get('/api/deserciones/onbase-accounts', { headers: getAuthHeaders() });
      if (res.data?.accounts?.length > 0) {
        baseOptions = res.data.accounts;
      }
    } catch (e) {}

    setOnbaseUsers(baseOptions);

    let savedUser = localStorage.getItem('sena_deserciones_default_onbase_user') || 'EDHERNANDEZM';
    if (savedUser.toUpperCase() === 'JRROZO') {
      const subAcc = baseOptions.find(a => a.depCode === '9224');
      if (subAcc) savedUser = subAcc.username;
    }

    setSelectedOnbaseUser(savedUser);
    setOnbaseUserCredential(savedUser);
    setUseCustomPassword(false);
    setOnbasePasswordCredential('••••••••••••');
  };

  // Guardado de usuario OnBase por defecto (usa la credencial oficial de Configuración AES salvo que el usuario guarde una clave personalizada)
  const handleSelectOnbaseUser = (userValue) => {
    setSelectedOnbaseUser(userValue);
    setOnbaseUserCredential(userValue);
    setUseCustomPassword(false);
    setOnbasePasswordCredential('••••••••••••');

    localStorage.setItem('sena_deserciones_default_onbase_user', userValue);
    localStorage.setItem('sena_deserciones_onbase_user', userValue);
    setStatusMessage({
      type: 'success',
      text: `Cuenta oficial de OnBase '${userValue}' seleccionada (credenciales sincronizadas con Configuración AES).`
    });
  };

  // Guardar y Persistir Credenciales de OnBase (Usuario y Contraseña)
  const handleSaveOnbaseCredentials = async () => {
    if (!onbaseUserCredential.trim() || !onbasePasswordCredential.trim()) {
      alert('Por favor ingrese tanto el Usuario como la Contraseña de OnBase.');
      return;
    }

    setSavingCredentials(true);
    try {
      const u = onbaseUserCredential.trim();
      const p = onbasePasswordCredential.trim();

      localStorage.setItem(`sena_deserciones_onbase_pass_${u}`, p);
      localStorage.setItem('sena_deserciones_onbase_user', u);
      localStorage.setItem('sena_deserciones_onbase_pass', p);
      localStorage.setItem('sena_deserciones_default_onbase_user', u);

      setOnbaseUsers(prev => prev.map(opt => (opt.username === u || opt.id === u) ? { ...opt, pass: p } : opt));

      const authHeaders = getAuthHeaders();

      await Promise.all([
        axios.post('/api/settings', { key: 'ades_username', value: u }, { headers: authHeaders }),
        axios.post('/api/settings', { key: 'ades_password', value: p }, { headers: authHeaders })
      ]).catch(e => console.warn('Advertencia guardando en BD settings:', e));

      setSelectedOnbaseUser(u);
      setUseCustomPassword(p !== '••••••••••••');
      setStatusMessage({
        type: 'success',
        text: `Credenciales de OnBase Web para '${u}' guardadas exitosamente para los cargues.`
      });
    } catch (err) {
      console.error('Error guardando credenciales:', err);
      alert('Error al guardar las credenciales de OnBase.');
    } finally {
      setSavingCredentials(false);
    }
  };

  // Detener de verdad el Robot Independiente de Deserciones en el servidor (sin tocar Cargue AES)
  const handleStopDesercionesBot = async () => {
    try {
      await axios.post('/api/deserciones/bot/kill', {}, { headers: getAuthHeaders() });
      setAutomationLoading(false);
      setBotHasBrowserOpen(false);
      setLiveFrame(null);
      setLogs(prev => [...prev, '[DETENIDO] 🛑 Robot de Deserciones detenido y sesión cerrada limpiamente.']);
      setStatusMessage({
        type: 'info',
        text: 'Robot de Deserciones detenido y sesión de OnBase cerrada correctamente.'
      });
      fetchHistorico();
    } catch (err) {
      setAutomationLoading(false);
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.error || 'Error al detener el Robot de Deserciones.'
      });
    }
  };

  // Exportar Acta / Reporte Excel de Evidencia de Notificaciones
  const handleExportarReporteExcel = async () => {
    try {
      const res = await axios.get(`/api/deserciones/exportar-reporte?status=${encodeURIComponent(statusFilter)}`, {
        headers: getAuthHeaders(),
        responseType: 'blob'
      });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `Acta_Evidencia_Deserciones_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al descargar el reporte Excel de evidencias.');
    }
  };

  // Vincular casos cargados con el Expediente de Historia Académica (68.9224.4-37) para Cargue AES
  const handleVincularHistorias = async (customIds = null) => {
    setLinkingHistorias(true);
    try {
      const ids = customIds || Object.keys(selectedHistoricoRows).filter(id => selectedHistoricoRows[id]).map(id => parseInt(id, 10));
      const res = await axios.post('/api/deserciones/vincular-historias', {
        caso_ids: ids.length > 0 ? ids : undefined
      }, { headers: getAuthHeaders() });
      setStatusMessage({
        type: 'success',
        text: res.data.message
      });
      fetchHistorico();
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.error || 'Error al vincular con Historias Académicas.'
      });
    } finally {
      setLinkingHistorias(false);
    }
  };

  // Iniciar sesión en Vivo en el Robot Independiente de Deserciones (/api/deserciones/bot/execute)
  const handleStartOnBaseLiveSession = async (casoIds = null, opts = null) => {
    setAutomationLoading(true);
    setAutomationError(false);
    setLiveFrame(null);
    setCurrentStepIndex(0);
    const activeUser = onbaseUserCredential.trim() || selectedOnbaseUser || 'EDHERNANDEZM';
    setLogs([
      `[BOT DESERCIONES] 🚀 Conectando al motor independiente de Deserciones (aislado de Cargue AES)...`,
      `[CONFIG] Cuenta OnBase seleccionada: ${activeUser}`,
      `[PASO 1] Iniciando navegador dedicado y autenticación en OnBase Web...`
    ]);

    try {
      const authHeaders = getAuthHeaders();
      const rawPass = onbasePasswordCredential.trim();
      const isCustomPass = useCustomPassword && rawPass && rawPass !== '••••••••••••';

      const payload = {
        url: 'https://onbase.sena.edu.co/AppNet/NavPanel.aspx',
        username: activeUser,
        password: isCustomPass ? rawPass : undefined,
        use_custom_password: Boolean(isCustomPass),
        target_user: activeUser,
        caso_ids: Array.isArray(casoIds) && casoIds.length > 0 ? casoIds : undefined,
        force_restart: false
      };

      if (typeof opts === 'number') {
        payload.stop_at_step = opts;
      } else if (opts && typeof opts === 'object') {
        if (opts.stop_at_step) payload.stop_at_step = opts.stop_at_step;
        if (opts.solo_diligenciar) payload.solo_diligenciar = true;
        if (opts.retry_errors) payload.retry_errors = true;
        if (opts.force_restart) payload.force_restart = true;
      }

      await axios.post('/api/deserciones/bot/execute', payload, { headers: authHeaders });

      setStatusMessage({
        type: 'info',
        text: payload.solo_diligenciar
          ? 'Robot de Deserciones conectado. Diligenciando formulario en OnBase SIN enviar para inspección...'
          : payload.stop_at_step === 3
          ? 'Robot de Deserciones abriendo formulario en blanco hasta el Paso 3...'
          : 'Robot independiente de Deserciones iniciado. Ejecutando cargue automático completo (Pasos 1 a 4)...'
      });
    } catch (err) {
      setAutomationLoading(false);
      setAutomationError(true);
      const errMsg = err.response?.data?.error || err.message || 'Error al iniciar el Robot de Deserciones.';

      // Si el robot ya estaba ocupado (HTTP 409), ofrecer reiniciarlo explícitamente
      if (err.response?.status === 409) {
        if (window.confirm(`${errMsg}\n\n¿Desea detener la sesión actual de Deserciones e iniciar este nuevo cargue?`)) {
          return handleStartOnBaseLiveSession(casoIds, {
            ...(typeof opts === 'object' && opts ? opts : typeof opts === 'number' ? { stop_at_step: opts } : {}),
            force_restart: true
          });
        }
      }

      setLogs(prev => [...prev, `[ERROR] ❌ ${errMsg}`]);
      setStatusMessage({
        type: 'error',
        text: errMsg
      });
    }
  };

  // Sondeo en vivo del Sincronizador de Correo (leparadam@sena.edu.co -> Producidas)
  useEffect(() => {
    let timer = null;
    if (showEmailSyncModal || emailSyncRunning) {
      const pollEmailSync = async () => {
        try {
          const authHeaders = getAuthHeaders();
          const stRes = await axios.get('/api/deserciones/email-sync/status', { headers: authHeaders });
          const st = stRes.data || {};
          setEmailSyncRunning(Boolean(st.isRunning));
          setEmailSyncStateData({
            status: st.status || 'idle',
            hasBrowserOpen: Boolean(st.hasBrowserOpen),
            hasSavedPassword: Boolean(st.hasSavedPassword),
            currentUrl: st.currentUrl || '',
            mfaNumber: st.mfaNumber || null,
            authPrompt: st.authPrompt || null,
            logs: Array.isArray(st.logs) ? st.logs : [],
            stats: st.stats || { emailsScanned: 0, cpeFound: 0, matchedUpdated: 0, alreadyUpdated: 0, unmatchedCount: 0 },
            updatedRecords: Array.isArray(st.updatedRecords) ? st.updatedRecords : []
          });

          if (st.isRunning || st.status === 'waiting_auth' || st.hasBrowserOpen) {
            const frRes = await axios.get('/api/deserciones/email-sync/frame', { headers: authHeaders });
            if (frRes.data?.frame) setEmailSyncFrame(frRes.data.frame);
          }

          if (emailSyncRunning && !st.isRunning && (st.status === 'completed' || st.status === 'error')) {
            setEmailSyncRunning(false);
            fetchHistorico();
          }
        } catch (_) {}
      };
      pollEmailSync();
      timer = setInterval(pollEmailSync, 1200);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showEmailSyncModal, emailSyncRunning]);

  // Iniciar robot de extracción de Radicados y Fechas desde Outlook 365 (Carpeta Producidas)
  const handleStartEmailSync = async () => {
    try {
      setEmailSyncRunning(true);
      await axios.post('/api/deserciones/email-sync/execute', {
        email_user: emailSyncUser.trim() || 'leparadam@sena.edu.co',
        email_password: emailSyncPass.trim(),
        folder_name: emailSyncFolder.trim() || 'Producidas',
        max_emails: 80,
        force_restart: true
      }, { headers: getAuthHeaders() });
    } catch (err) {
      setEmailSyncRunning(false);
      alert(err.response?.data?.error || 'Error iniciando sincronización con el correo.');
    }
  };

  const handleStopEmailSync = async (closeBrowser = false) => {
    try {
      await axios.post('/api/deserciones/email-sync/kill', { close_browser: closeBrowser }, { headers: getAuthHeaders() });
      setEmailSyncRunning(false);
      if (closeBrowser) setEmailSyncFrame(null);
      fetchHistorico();
    } catch (_) {}
  };

  const handleSwitchEmailAuthMethod = async (actionType) => {
    try {
      const res = await axios.post('/api/deserciones/email-sync/click', { action: actionType }, { headers: getAuthHeaders() });
      if (res.data?.frame) setEmailSyncFrame(res.data.frame);
    } catch (_) {}
  };

  const handleSendTextToEmailBrowser = async () => {
    if (!emailSyncBrowserInput.trim()) return;
    try {
      const res = await axios.post('/api/deserciones/email-sync/send-text', {
        text: emailSyncBrowserInput.trim(),
        submit: true,
        saveAsPassword: true
      }, { headers: getAuthHeaders() });
      if (res.data?.frame) setEmailSyncFrame(res.data.frame);
      setEmailSyncBrowserInput('');
    } catch (err) {
      alert(err.response?.data?.error || 'Error enviando texto al navegador de correo.');
    }
  };

  const handleEmailBrowserClick = async (e) => {
    if (!emailSyncRunning && !emailSyncStateData.hasBrowserOpen) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = 1366 / rect.width;
    const scaleY = 860 / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    try {
      const res = await axios.post('/api/deserciones/email-sync/click', { x, y }, { headers: getAuthHeaders() });
      if (res.data?.frame) setEmailSyncFrame(res.data.frame);
    } catch (_) {}
  };

  const handleImportManualEmailText = async () => {
    if (!manualEmailText.trim()) {
      alert('Pegue el contenido o tabla de uno o varios correos CPE para extraer los radicados.');
      return;
    }
    setImportingManualEmail(true);
    try {
      const res = await axios.post('/api/deserciones/email-sync/import-manual', {
        raw_text: manualEmailText,
        overwrite_existing: true
      }, { headers: getAuthHeaders() });
      setStatusMessage({ type: 'success', text: res.data.message });
      setManualEmailText('');
      fetchHistorico();
    } catch (err) {
      alert(err.response?.data?.error || 'Error procesando el texto de los correos.');
    } finally {
      setImportingManualEmail(false);
    }
  };

  // Exportar Excel IDÉNTICO al archivo subido por cada carga masiva (con Radicado, N.I.S. y Fecha de Notificación)
  const handleExportarExcelLote = async (loteIdParam = null, modoParam = 'original_completo') => {
    try {
      const targetLote = loteIdParam || (selectedLoteId !== 'Todos' ? selectedLoteId : 'ULTIMO');
      const res = await axios.get(
        `/api/deserciones/exportar-excel-lote?lote_id=${encodeURIComponent(targetLote)}&modo=${encodeURIComponent(modoParam)}`,
        {
          headers: getAuthHeaders(),
          responseType: 'blob'
        }
      );
      const matchedLote = lotes.find(l => l.lote_id === targetLote) || lotes[0];
      const baseFileName = matchedLote?.archivo_excel || '45_aprendices.xlsx';
      const downloadName = `RADICADOS_${baseFileName.replace(/\s+/g, '_')}`;

      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', downloadName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      setStatusMessage({
        type: 'success',
        text: `✅ Archivo Excel "${downloadName}" descargado con la misma estructura del Excel cargado + Radicado, N.I.S. y Fecha.`
      });
    } catch (err) {
      alert(err.response?.data?.error || 'Error al descargar el Excel de la carga masiva.');
    }
  };

  const fetchHistorico = async () => {
    setLoadingHistorico(true);
    try {
      const [res, lotesRes] = await Promise.all([
        axios.get('/api/deserciones/casos', { headers: getAuthHeaders() }),
        axios.get('/api/deserciones/lotes', { headers: getAuthHeaders() }).catch(() => ({ data: { lotes: [] } }))
      ]);
      const data = res.data?.data || [];
      setHistorico(data);
      const fetchedLotes = lotesRes.data?.lotes || [];
      setLotes(fetchedLotes);
      
      // Pre-seleccionar por defecto los casos que están en estado 'Pendiente'
      const initialSel = {};
      data.forEach(item => {
        if (item.status === 'Pendiente') {
          initialSel[item.id] = true;
        }
      });
      setSelectedHistoricoRows(initialSel);
    } catch (e) {
      console.error('Error al cargar histórico:', e);
    } finally {
      setLoadingHistorico(false);
    }
  };

  // 1. Manejo de Carga de Excel
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setExcelFile(file);

    const formData = new FormData();
    formData.append('excel', file);

    setUploadingExcel(true);
    setStatusMessage({ type: 'info', text: 'Parseando archivo Excel...' });

    try {
      const res = await axios.post('/api/deserciones/upload-excel', formData, {
        headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' }
      });

      setExcelData(res.data.rows || []);
      setColumns(res.data.columns || []);
      setExcelFile({
        name: res.data.filename || file.name,
        filepath: res.data.filepath || ''
      });

      // Seleccionar todas las filas por defecto
      const selMap = {};
      (res.data.rows || []).forEach(r => { selMap[r.id_temp] = true; });
      setSelectedRows(selMap);

      setStatusMessage({ 
        type: 'success', 
        text: `Excel cargado con éxito. Se extrajeron ${res.data.total} registros de aprendices.` 
      });
    } catch (err) {
      console.error('Error subiendo Excel:', err);
      setStatusMessage({ 
        type: 'error', 
        text: err.response?.data?.error || 'Error al procesar el archivo Excel.' 
      });
    } finally {
      setUploadingExcel(false);
    }
  };

  // 2. Manejo de Subida de Anexo Explícito por Fila
  const handleRowAttachmentUpload = async (rowId, file) => {
    if (!file) return;
    setUploadingAttachmentId(rowId);

    const formData = new FormData();
    formData.append('anexo', file);

    try {
      const res = await axios.post('/api/deserciones/upload-anexo', formData, {
        headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' }
      });

      setRowAttachments(prev => ({
        ...prev,
        [rowId]: {
          name: res.data.originalName,
          path: res.data.path
        }
      }));

      setStatusMessage({ type: 'success', text: `Anexo explícito asignado a la comunicación (${res.data.originalName}).` });
    } catch (err) {
      console.error('Error subiendo anexo:', err);
      alert('Error al subir el anexo explícito.');
    } finally {
      setUploadingAttachmentId(null);
    }
  };

  // 2.1 Manejo de Carga Masiva de Paquete de Anexos con Auto-reconocimiento por documento/aprendiz
  const handleBatchAttachmentsUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (excelData.length === 0) {
      alert('Por favor cargue primero el archivo Excel con los datos de los aprendices para realizar el emparejamiento automático.');
      return;
    }

    setUploadingBatchAttachments(true);
    setStatusMessage({ type: 'info', text: `Subiendo paquete masivo de ${files.length} anexos...` });

    const formData = new FormData();
    files.forEach(f => formData.append('anexos', f));

    try {
      const res = await axios.post('/api/deserciones/upload-masivo-anexos', formData, {
        headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' }
      });

      const uploadedFiles = res.data.files || [];
      const newAttachments = { ...rowAttachments };
      let matchedCount = 0;
      const unmatchedFiles = [];
      const ambiguousFiles = [];

      // Emparejamiento estricto con delimitadores exactos para evitar cruzar resoluciones entre aprendices
      const hasExactToken = (fileBase, token) => {
        const cleanTok = String(token || '').trim();
        if (!cleanTok) return false;
        const escaped = cleanTok.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        // Si es numérico (documento o número de resolución), exigir bordes no numéricos (que '387' NO coincida con '3875' ni '2026' con otro)
        if (/^\d+$/.test(cleanTok)) {
          const withoutLeadingZeros = cleanTok.replace(/^0+/, '');
          const rx = new RegExp(`(?:^|\\D)0*${withoutLeadingZeros || cleanTok}(?:\\D|$)`, 'i');
          return rx.test(fileBase);
        }
        return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i').test(fileBase);
      };

      uploadedFiles.forEach(file => {
        const originalFileName = (file.originalName || '').trim();
        const lastDot = originalFileName.lastIndexOf('.');
        const baseFileName = lastDot > 0 ? originalFileName.substring(0, lastDot) : originalFileName;

        // Prioridad 1: Coincidencia exacta por Número de Documento del Aprendiz (>= 5 dígitos)
        const docMatches = excelData.filter(row => {
          const doc = String(row.aprendiz_doc_numero || '').replace(/\D/g, '');
          return doc.length >= 5 && hasExactToken(baseFileName, doc);
        });

        if (docMatches.length === 1) {
          newAttachments[docMatches[0].id_temp] = { name: file.originalName, path: file.path };
          matchedCount++;
          return;
        }
        if (docMatches.length > 1) {
          docMatches.forEach(r => {
            newAttachments[r.id_temp] = { name: file.originalName, path: file.path };
          });
          matchedCount++;
          return;
        }

        // Prioridad 2: Coincidencia única y exacta por Número de Resolución explícito (>= 3 caracteres, excluyendo años solos como 2025/2026)
        const resMatches = excelData.filter(row => {
          const resVal = String(row.resolucion || '').trim();
          if (!resVal || resVal.length < 3 || /^20\d{2}$/.test(resVal)) return false;
          return hasExactToken(baseFileName, resVal);
        });

        if (resMatches.length === 1) {
          newAttachments[resMatches[0].id_temp] = { name: file.originalName, path: file.path };
          matchedCount++;
          return;
        }
        if (resMatches.length > 1) {
          ambiguousFiles.push(originalFileName);
          return;
        }

        unmatchedFiles.push(originalFileName);
      });

      setRowAttachments(newAttachments);
      const extraWarn = [
        unmatchedFiles.length > 0 ? `Sin coincidencia (${unmatchedFiles.length}): ${unmatchedFiles.slice(0, 5).join(', ')}${unmatchedFiles.length > 5 ? '...' : ''}` : '',
        ambiguousFiles.length > 0 ? `Ambiguos por resolución repetida (${ambiguousFiles.length}): ${ambiguousFiles.slice(0, 4).join(', ')}` : ''
      ].filter(Boolean).join(' | ');

      setStatusMessage({
        type: unmatchedFiles.length > 0 || ambiguousFiles.length > 0 ? 'warning' : 'success',
        text: `Carga masiva completada: ${matchedCount} de ${uploadedFiles.length} PDF(s) emparejados exactamente por Documento/Resolución.${extraWarn ? ' ⚠️ ' + extraWarn : ''}`
      });
    } catch (err) {
      console.error('Error en carga masiva de anexos:', err);
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.error || 'Error al procesar el paquete masivo de anexos.'
      });
    } finally {
      setUploadingBatchAttachments(false);
    }
  };

  // Helpers para leer/escribir la plantilla activa según pestaña ('citacion'|'resolucion'|'notificacion_aprendiz') y variante ('mayor'|'menor_ti')
  const getActiveBodyText = () => {
    if (activeTab === 'citacion') {
      return plantillaVariante === 'menor_ti' ? textoInicialCitacionTi : textoInicialCitacion;
    }
    if (activeTab === 'notificacion_aprendiz') {
      if (syncNotifAprendizUnicaCarta) return textoInicialNotifAprendiz;
      return plantillaVariante === 'menor_ti' ? textoInicialNotifAprendizTi : textoInicialNotifAprendiz;
    }
    return plantillaVariante === 'menor_ti' ? textoInicialResolucionTi : textoInicialResolucion;
  };

  const setActiveBodyText = (val) => {
    if (activeTab === 'citacion') {
      if (plantillaVariante === 'menor_ti') setTextoInicialCitacionTi(val);
      else setTextoInicialCitacion(val);
    } else if (activeTab === 'notificacion_aprendiz') {
      if (syncNotifAprendizUnicaCarta) {
        setTextoInicialNotifAprendiz(val);
        setTextoInicialNotifAprendizTi(val);
      } else if (plantillaVariante === 'menor_ti') {
        setTextoInicialNotifAprendizTi(val);
      } else {
        setTextoInicialNotifAprendiz(val);
      }
    } else {
      if (plantillaVariante === 'menor_ti') setTextoInicialResolucionTi(val);
      else setTextoInicialResolucion(val);
    }
  };

  const getActiveAsunto = () => {
    if (activeTab === 'citacion') return asuntoCitacion;
    if (activeTab === 'notificacion_aprendiz') return asuntoNotifAprendiz;
    return asuntoResolucion;
  };

  const setActiveAsunto = (val) => {
    if (activeTab === 'citacion') setAsuntoCitacion(val);
    else if (activeTab === 'notificacion_aprendiz') setAsuntoNotifAprendiz(val);
    else setAsuntoResolucion(val);
  };

  const getActiveDescAsunto = () => {
    if (activeTab === 'citacion') {
      return plantillaVariante === 'menor_ti' ? descripcionAsuntoCitacionTi : descripcionAsuntoCitacion;
    }
    if (activeTab === 'notificacion_aprendiz') {
      if (syncNotifAprendizUnicaCarta) return descripcionAsuntoNotifAprendiz;
      return plantillaVariante === 'menor_ti' ? descripcionAsuntoNotifAprendizTi : descripcionAsuntoNotifAprendiz;
    }
    return plantillaVariante === 'menor_ti' ? descripcionAsuntoResolucionTi : descripcionAsuntoResolucion;
  };

  const setActiveDescAsunto = (val) => {
    if (activeTab === 'citacion') {
      if (plantillaVariante === 'menor_ti') setDescripcionAsuntoCitacionTi(val);
      else setDescripcionAsuntoCitacion(val);
    } else if (activeTab === 'notificacion_aprendiz') {
      if (syncNotifAprendizUnicaCarta) {
        setDescripcionAsuntoNotifAprendiz(val);
        setDescripcionAsuntoNotifAprendizTi(val);
      } else if (plantillaVariante === 'menor_ti') {
        setDescripcionAsuntoNotifAprendizTi(val);
      } else {
        setDescripcionAsuntoNotifAprendiz(val);
      }
    } else {
      if (plantillaVariante === 'menor_ti') setDescripcionAsuntoResolucionTi(val);
      else setDescripcionAsuntoResolucion(val);
    }
  };

  // 3. Insertar Chip de Variable SIN SALTO DE SCROLL (preserva scrollTop exacto y foco en Textarea o Descripción del Asunto)
  const insertChip = (chipText) => {
    const isDescTarget = activeInputTarget === 'descripcion_asunto' && descInputRef.current;
    const targetEl = isDescTarget ? descInputRef.current : textareaRef.current;
    const currentText = isDescTarget ? getActiveDescAsunto() : getActiveBodyText();

    if (!targetEl) {
      if (isDescTarget) setActiveDescAsunto(`${currentText} ${chipText}`);
      else setActiveBodyText(`${currentText} ${chipText}`);
      return;
    }

    const savedScrollTop = targetEl.scrollTop;
    const savedScrollLeft = targetEl.scrollLeft;
    const savedWinX = window.scrollX;
    const savedWinY = window.scrollY;

    const start = typeof targetEl.selectionStart === 'number' ? targetEl.selectionStart : currentText.length;
    const end = typeof targetEl.selectionEnd === 'number' ? targetEl.selectionEnd : currentText.length;

    const newText = currentText.substring(0, start) + chipText + currentText.substring(end);
    const nextPos = start + chipText.length;

    if (isDescTarget) {
      setActiveDescAsunto(newText);
    } else {
      setActiveBodyText(newText);
    }

    requestAnimationFrame(() => {
      try {
        targetEl.focus({ preventScroll: true });
        targetEl.setSelectionRange(nextPos, nextPos);
        targetEl.scrollTop = savedScrollTop;
        targetEl.scrollLeft = savedScrollLeft;
        window.scrollTo(savedWinX, savedWinY);
      } catch (e) {}
    });
  };

  // 4. Selección rápida de Correos CC con 1 Clic (sin tener que llenar formulario) + Agregar / Eliminar / Restablecer
  const handleToggleQuickCc = async (contact) => {
    const cleanEmail = contact.email.toLowerCase();
    const exists = ccEmails.some(item => item.email.toLowerCase() === cleanEmail);
    const updated = exists
      ? ccEmails.filter(item => item.email.toLowerCase() !== cleanEmail)
      : [...ccEmails, { name: contact.name, email: contact.email }];
    await persistCcEmails(updated);
  };

  const handleAddCcEmail = async () => {
    if (!newCcEmail.trim()) {
      setStatusMessage({ type: 'warning', text: 'Por favor ingrese un correo electrónico para la copia CC.' });
      return;
    }
    const rawParts = newCcEmail.split(/[;,]+/).map(s => s.trim()).filter(Boolean);
    let updated = [...ccEmails];
    let addedCount = 0;

    for (const part of rawParts) {
      const cleanEmail = part.toLowerCase();
      if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) continue;
      if (updated.some(item => item.email.toLowerCase() === cleanEmail)) continue;
      const known = frequentCimiContacts.find(c => c.email.toLowerCase() === cleanEmail);
      const cleanName = newCcName.trim() || known?.name || cleanEmail.split('@')[0].replace(/[._-]+/g, ' ');
      updated.push({ name: cleanName, email: cleanEmail });
      addedCount++;
    }

    if (addedCount === 0) {
      setStatusMessage({ type: 'warning', text: 'El correo ingresado no es válido o ya está activo en la lista de copias CC.' });
      return;
    }

    await persistCcEmails(updated);
    setNewCcName('');
    setNewCcEmail('');
    setStatusMessage({ type: 'success', text: `✅ ${addedCount} correo(s) en copia (CC) guardado(s) en el sistema.` });
  };

  const handleRemoveCcEmail = async (idx) => {
    const updated = ccEmails.filter((_, i) => i !== idx);
    await persistCcEmails(updated);
    setStatusMessage({ type: 'info', text: 'Correo en copia eliminado de la configuración guardada.' });
  };

  const handleResetCcEmails = async () => {
    const defaultCc = [
      { name: 'Manuel Valencia', email: 'mevalencia@sena.edu.co' },
      { name: 'Monica Gomez', email: 'mlgomez@sena.edu.co' },
      { name: 'Luis Ernesto Parada Moreno', email: 'leparadam@sena.edu.co' }
    ];
    await persistCcEmails(defaultCc);
    setStatusMessage({ type: 'success', text: '✅ Correos CC restablecidos a los destinatarios oficiales de Deserciones CIMI.' });
  };

  // 5. Vista Previa de Correspondencia Combinada (aplica automáticamente plantilla Mayor CC o Menor TI según documento del aprendiz)
  const handleOpenPreview = async (item) => {
    setPreviewItem(item);
    const templateMayor = activeTab === 'citacion'
      ? textoInicialCitacion
      : activeTab === 'notificacion_aprendiz'
        ? textoInicialNotifAprendiz
        : textoInicialResolucion;
    const templateTi = activeTab === 'citacion'
      ? textoInicialCitacionTi
      : activeTab === 'notificacion_aprendiz'
        ? (syncNotifAprendizUnicaCarta ? textoInicialNotifAprendiz : textoInicialNotifAprendizTi)
        : textoInicialResolucionTi;
    const asuntoTpl = activeTab === 'citacion'
      ? asuntoCitacion
      : activeTab === 'notificacion_aprendiz'
        ? asuntoNotifAprendiz
        : asuntoResolucion;
    const descMayor = activeTab === 'citacion'
      ? descripcionAsuntoCitacion
      : activeTab === 'notificacion_aprendiz'
        ? descripcionAsuntoNotifAprendiz
        : descripcionAsuntoResolucion;
    const descTi = activeTab === 'citacion'
      ? descripcionAsuntoCitacionTi
      : activeTab === 'notificacion_aprendiz'
        ? (syncNotifAprendizUnicaCarta ? descripcionAsuntoNotifAprendiz : descripcionAsuntoNotifAprendizTi)
        : descripcionAsuntoResolucionTi;
    try {
      const res = await axios.post('/api/deserciones/preview-merge', {
        template: templateMayor,
        template_ti: templateTi,
        asunto: asuntoTpl,
        descripcion_asunto: descMayor,
        descripcion_asunto_ti: descTi,
        auto_ti_template: autoTiTemplate,
        comite_defaults: comiteDefaults,
        row: item
      }, { headers: getAuthHeaders() });
      const tplLabel = res.data.appliedTemplateType === 'MENOR_TI'
        ? '👦 PLANTILLA MENOR DE EDAD / TARJETA DE IDENTIDAD (TI)'
        : '🧑 PLANTILLA MAYOR DE EDAD (CC / CE / PPT)';
      const headerPreview = `Plantilla Aplicada: ${tplLabel}\nAsunto OnBase: ${res.data.mergedAsunto || asuntoTpl}\nDescripción del Asunto: ${res.data.mergedDescripcionAsunto || descMayor}\n${'─'.repeat(65)}\n\n`;
      setPreviewText(headerPreview + (res.data.mergedText || ''));
      setShowPreviewModal(true);
    } catch (e) {
      console.error('Error obteniendo vista previa:', e);
    }
  };

  // Actualizar en línea datos de Acudiente o Tipo Doc (CC/TI) en la tabla previa del Excel
  const handleUpdateExcelRowField = (rowIdTemp, field, value) => {
    setExcelData(prev => prev.map(r => {
      if (r.id_temp !== rowIdTemp) return r;
      const updatedRaw = { ...(r.raw_row || {}) };
      if (field === 'acudiente_nombre') updatedRaw['NOMBRE ACUDIENTE'] = value;
      if (field === 'acudiente_correo') updatedRaw['CORREO ACUDIENTE'] = value;
      if (field === 'aprendiz_doc_tipo') updatedRaw['TIPO'] = value;
      return {
        ...r,
        [field]: value,
        es_menor_ti: field === 'aprendiz_doc_tipo' ? String(value).toUpperCase() === 'TI' : r.es_menor_ti,
        raw_row: updatedRaw
      };
    }));
  };

  // Guardar Acudiente (y copia independiente en OnBase) en un caso ya existente del Histórico
  const handleSaveCasoAcudiente = async (casoId) => {
    setSavingAcudienteId(casoId);
    try {
      const res = await axios.put(`/api/deserciones/casos/${casoId}/acudiente`, {
        acudiente_nombre: editAcudienteNombre,
        acudiente_correo: editAcudienteCorreo,
        aprendiz_doc_tipo: editAcudienteDocTipo
      }, { headers: getAuthHeaders() });
      if (res.data?.caso) {
        setHistorico(prev => prev.map(c => c.id === casoId ? res.data.caso : c));
      }
      setStatusMessage({
        type: 'success',
        text: res.data?.message || 'Acudiente actualizado correctamente para este aprendiz.'
      });
      setEditingAcudienteCasoId(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar los datos del acudiente.');
    } finally {
      setSavingAcudienteId(null);
    }
  };

  // 6. Guardar casos (con opción de generar PDF o directo para Robot OnBase)
  const handleGuardarYGenerar = async (opts = { generatePdf: true }) => {
    const rowsToProcess = excelData.filter(r => selectedRows[r.id_temp]);

    if (rowsToProcess.length === 0) {
      setStatusMessage({ type: 'warning', text: 'Debe seleccionar al menos un aprendiz/fila de la tabla.' });
      return;
    }

    const etapaCheck = activeTab === 'citacion'
      ? 'CITACION_COMITE'
      : activeTab === 'notificacion_aprendiz'
        ? 'NOTIFICACION_APRENDIZ'
        : 'NOTIFICACION_RESOLUCION';

    // Validación Pre-Vuelo 1: Correos inválidos o vacíos
    const rowsInvalidEmail = rowsToProcess.filter(r => !r.aprendiz_correo || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(r.aprendiz_correo).trim()));
    if (rowsInvalidEmail.length > 0) {
      const sampleNames = rowsInvalidEmail.slice(0, 4).map(r => `${r.aprendiz_nombre} (${r.aprendiz_correo || 'SIN CORREO'})`).join(', ');
      if (!window.confirm(`⚠️ Se detectaron ${rowsInvalidEmail.length} aprendiz(ces) sin correo válido en Sofía Plus:\n${sampleNames}${rowsInvalidEmail.length > 4 ? '...' : ''}\n\n¿Desea guardarlos de todas formas (quedarán retenidos en validación antes de enviar a OnBase)?`)) {
        return;
      }
    }

    // Validación Pre-Vuelo 2: En Notificación de Resolución es obligatorio el PDF adjunto de la resolución
    if (etapaCheck === 'NOTIFICACION_RESOLUCION') {
      const missingPdfRows = rowsToProcess.filter(r => !rowAttachments[r.id_temp]?.path);
      if (missingPdfRows.length > 0) {
        const sampleMissing = missingPdfRows.slice(0, 4).map(r => `${r.aprendiz_nombre} (${r.aprendiz_doc_numero})`).join(', ');
        if (!window.confirm(`⚠️ Atención: ${missingPdfRows.length} de ${rowsToProcess.length} aprendiz(ces) en Notificación de Resolución NO tienen PDF de Resolución adjunto:\n${sampleMissing}${missingPdfRows.length > 4 ? '...' : ''}\n\nEl Robot de Deserciones bloqueará el envío de notificaciones sin PDF adjunto. ¿Desea continuar?`)) {
          return;
        }
      }
    }

    // Validación Pre-Vuelo 3: Alerta de duplicados ya cargados en Histórico (mismo documento + ficha + etapa)
    const alreadyLoaded = rowsToProcess.filter(r =>
      historico.some(h =>
        h.status === 'Cargado' &&
        h.etapa === etapaCheck &&
        String(h.aprendiz_doc_numero || '').trim() === String(r.aprendiz_doc_numero || '').trim() &&
        String(h.ficha || '').trim() === String(r.ficha || '').trim()
      )
    );
    if (alreadyLoaded.length > 0) {
      const dupList = alreadyLoaded.slice(0, 4).map(r => `${r.aprendiz_nombre} (${r.aprendiz_doc_numero} - Ficha ${r.ficha})`).join('\n');
      if (!window.confirm(`⚠️ Posible duplicado: ${alreadyLoaded.length} aprendiz(ces) seleccionados YA aparecen como "Cargado" en esta misma etapa y ficha:\n\n${dupList}${alreadyLoaded.length > 4 ? '\n...' : ''}\n\n¿Confirma que desea registrar una nueva comunicación para ellos?`)) {
        return;
      }
    }

    setProcessingSave(true);
    setStatusMessage({ 
      type: 'info', 
      text: opts.generatePdf ? 'Generando correspondencias combinadas en PDF...' : 'Guardando campos de formulario y anexos para el Robot OnBase...' 
    });

    // Si el usuario escribió un correo en la casilla de CC pero no oprimió '+ Guardar', incluirlo y guardarlo automáticamente
    let finalCcEmails = [...ccEmails];
    if (newCcEmail.trim() && newCcEmail.includes('@')) {
      const pendingParts = newCcEmail.split(/[;,]+/).map(s => s.trim()).filter(Boolean);
      for (const p of pendingParts) {
        const cleanE = p.toLowerCase();
        if (cleanE.includes('@') && !finalCcEmails.some(item => item.email.toLowerCase() === cleanE)) {
          const cleanN = newCcName.trim() || cleanE.split('@')[0].replace(/[._-]+/g, ' ');
          finalCcEmails.push({ name: cleanN, email: cleanE });
        }
      }
      setNewCcName('');
      setNewCcEmail('');
      await persistCcEmails(finalCcEmails);
    }

    // Guardar automáticamente las plantillas (Mayor CC y Menor TI) en el servidor PostgreSQL para que nunca se pierdan
    await handleSaveTemplatesToServer(true);

    const etapa = activeTab === 'citacion'
      ? 'CITACION_COMITE'
      : activeTab === 'notificacion_aprendiz'
        ? 'NOTIFICACION_APRENDIZ'
        : 'NOTIFICACION_RESOLUCION';
    const textoInicialMayor = activeTab === 'citacion'
      ? textoInicialCitacion
      : activeTab === 'notificacion_aprendiz'
        ? textoInicialNotifAprendiz
        : textoInicialResolucion;
    const textoInicialMenorTi = activeTab === 'citacion'
      ? textoInicialCitacionTi
      : activeTab === 'notificacion_aprendiz'
        ? (syncNotifAprendizUnicaCarta ? textoInicialNotifAprendiz : textoInicialNotifAprendizTi)
        : textoInicialResolucionTi;
    const asuntoForSave = activeTab === 'citacion'
      ? asuntoCitacion
      : activeTab === 'notificacion_aprendiz'
        ? asuntoNotifAprendiz
        : asuntoResolucion;
    const descMayor = activeTab === 'citacion'
      ? descripcionAsuntoCitacion
      : activeTab === 'notificacion_aprendiz'
        ? descripcionAsuntoNotifAprendiz
        : descripcionAsuntoResolucion;
    const descMenorTi = activeTab === 'citacion'
      ? descripcionAsuntoCitacionTi
      : activeTab === 'notificacion_aprendiz'
        ? (syncNotifAprendizUnicaCarta ? descripcionAsuntoNotifAprendiz : descripcionAsuntoNotifAprendizTi)
        : descripcionAsuntoResolucionTi;

    // Adjuntar las rutas de los anexos explícitos asignados por fila
    const casosConAnexos = rowsToProcess.map(row => ({
      ...row,
      anexo_path: rowAttachments[row.id_temp]?.path || ''
    }));

    try {
      const res = await axios.post('/api/deserciones/guardar-casos', {
        etapa: etapa,
        texto_inicial: textoInicialMayor,
        texto_inicial_ti: textoInicialMenorTi,
        asunto: asuntoForSave,
        descripcion_asunto: descMayor,
        descripcion_asunto_ti: descMenorTi,
        auto_ti_template: autoTiTemplate,
        comite_defaults: comiteDefaults,
        casos: casosConAnexos,
        onbase_target_user: selectedOnbaseUser,
        copy_emails: finalCcEmails,
        generate_pdf: opts.generatePdf,
        archivo_excel: excelFile?.name || 'Carga_Masiva.xlsx',
        archivo_excel_path: excelFile?.filepath || '',
        excel_columns: columns
      }, { headers: getAuthHeaders() });

      setStatusMessage({
        type: 'success',
        text: res.data.message
      });

      fetchHistorico();
      setActiveTab('historico');
    } catch (err) {
      console.error('Error guardando casos:', err);
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.error || 'Error al guardar los casos de deserción.'
      });
    } finally {
      setProcessingSave(false);
    }
  };

  // 7. Cargar casos a OnBase Web
  const handleCargueOnBaseBatch = async (casoIds) => {
    if (!casoIds || casoIds.length === 0) {
      alert('Seleccione casos del histórico para realizar el cargue a OnBase.');
      return;
    }

    setProcessingOnBase(true);
    try {
      const res = await axios.post('/api/deserciones/cargue-onbase', {
        caso_ids: casoIds
      }, { headers: getAuthHeaders() });

      alert(res.data.message);
      fetchHistorico();
    } catch (err) {
      console.error('Error cargando a OnBase:', err);
      alert(err.response?.data?.error || 'Error ejecutando cargue a OnBase Web.');
    } finally {
      setProcessingOnBase(false);
    }
  };

  // 8. Limpiar / vaciar histórico de casos de prueba
  const handleLimpiarCasos = async () => {
    if (!window.confirm('¿Está seguro de que desea eliminar todos los datos de prueba del histórico de OnBase?')) {
      return;
    }
    try {
      const res = await axios.post('/api/deserciones/limpiar-casos', {}, { headers: getAuthHeaders() });
      setStatusMessage({ type: 'success', text: res.data.message });
      fetchHistorico();
    } catch (err) {
      console.error('Error al vaciar histórico:', err);
      alert('Error al vaciar el histórico de casos.');
    }
  };

  // 9. Marcar casos seleccionados o individuales como Cargados (para sacarlos de pendientes)
  const handleMarcarCargados = async (casoIds = null) => {
    const ids = casoIds || Object.keys(selectedHistoricoRows).filter(id => selectedHistoricoRows[id]).map(id => parseInt(id, 10));
    if (ids.length === 0) {
      alert('Por favor seleccione al menos un caso para marcar como Cargado.');
      return;
    }
    if (!window.confirm(`¿Desea marcar ${ids.length} caso(s) como 'Cargado'? Saldrán de la lista de Pendientes.`)) {
      return;
    }
    try {
      const res = await axios.post('/api/deserciones/marcar-cargado', { caso_ids: ids }, { headers: getAuthHeaders() });
      setStatusMessage({ type: 'success', text: res.data.message || 'Casos marcados como cargados exitosamente.' });
      fetchHistorico();
    } catch (err) {
      console.error('Error al marcar casos:', err);
      alert('Error al actualizar el estado de los casos.');
    }
  };

  // 10. Eliminar casos seleccionados
  const handleEliminarCasos = async () => {
    const ids = Object.keys(selectedHistoricoRows).filter(id => selectedHistoricoRows[id]).map(id => parseInt(id, 10));
    if (ids.length === 0) {
      alert('Por favor seleccione al menos un caso para eliminar.');
      return;
    }
    if (!window.confirm(`¿Está seguro de que desea eliminar permanentemente ${ids.length} caso(s) seleccionado(s)?`)) {
      return;
    }
    try {
      const res = await axios.post('/api/deserciones/eliminar-casos', { caso_ids: ids }, { headers: getAuthHeaders() });
      setStatusMessage({ type: 'success', text: res.data.message || 'Casos eliminados exitosamente.' });
      fetchHistorico();
    } catch (err) {
      console.error('Error al eliminar casos:', err);
      alert('Error al eliminar los casos seleccionados.');
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Header del Módulo */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        background: 'linear-gradient(135deg, #00324d 0%, #39a900 100%)', 
        color: 'white', 
        padding: '24px 32px', 
        borderRadius: '16px', 
        marginBottom: '24px',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileSpreadsheet size={32} color="#fff" />
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '700', letterSpacing: '-0.5px' }}>
              Módulo de Deserciones y Comunicaciones (OnBase Web)
            </h1>
          </div>
          <p style={{ margin: '8px 0 0 44px', opacity: 0.9, fontSize: '14px' }}>
            Gestión masiva de Citaciones a Comité y Notificación de Resoluciones con correspondencia combinada y envío de anexos a OnBase.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowEmailSyncModal(true)}
            style={{
              background: '#fff',
              border: '2px solid #86efac',
              color: '#00324d',
              padding: '10px 18px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '800',
              fontSize: '13.5px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.18)'
            }}
          >
            <Mail size={17} color="#39a900" />
            Abrir Correo SENA / Extraer Radicados (Producidas)
          </button>
          <button 
            onClick={fetchHistorico}
            style={{ 
              background: 'rgba(255,255,255,0.2)', 
              border: '1px solid rgba(255,255,255,0.4)', 
              color: 'white', 
              padding: '10px 16px', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              fontWeight: '600',
              backdropFilter: 'blur(4px)'
            }}
          >
            <RefreshCw size={16} /> Actualizar Datos
          </button>
        </div>
      </div>

      {/* Alerta de Estado / Mensajes */}
      {statusMessage.text && (
        <div style={{ 
          padding: '14px 20px', 
          borderRadius: '10px', 
          marginBottom: '20px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          fontWeight: '500',
          background: statusMessage.type === 'success' ? '#dcfce7' : statusMessage.type === 'error' ? '#fee2e2' : '#e0f2fe',
          color: statusMessage.type === 'success' ? '#166534' : statusMessage.type === 'error' ? '#991b1b' : '#075985',
          border: `1px solid ${statusMessage.type === 'success' ? '#86efac' : statusMessage.type === 'error' ? '#fca5a5' : '#7dd3fc'}`
        }}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Tabs Switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid #e2e8f0', paddingBottom: '2px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveTab('citacion')}
          style={{
            padding: '12px 24px',
            borderRadius: '10px 10px 0 0',
            border: 'none',
            fontWeight: '600',
            fontSize: '15px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: activeTab === 'citacion' ? '#39a900' : '#f1f5f9',
            color: activeTab === 'citacion' ? '#fff' : '#64748b',
            transition: 'all 0.2s'
          }}
        >
          <Calendar size={18} /> 1. Citación a Comité
        </button>
        <button 
          onClick={() => setActiveTab('resolucion')}
          style={{
            padding: '12px 24px',
            borderRadius: '10px 10px 0 0',
            border: 'none',
            fontWeight: '600',
            fontSize: '15px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: activeTab === 'resolucion' ? '#39a900' : '#f1f5f9',
            color: activeTab === 'resolucion' ? '#fff' : '#64748b',
            transition: 'all 0.2s'
          }}
        >
          <FileText size={18} /> 2. Notificación de Resoluciones
        </button>
        <button 
          onClick={() => setActiveTab('notificacion_aprendiz')}
          style={{
            padding: '12px 24px',
            borderRadius: '10px 10px 0 0',
            border: 'none',
            fontWeight: '700',
            fontSize: '15px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: activeTab === 'notificacion_aprendiz' ? '#39a900' : '#f0fdf4',
            color: activeTab === 'notificacion_aprendiz' ? '#fff' : '#15803d',
            borderTop: activeTab === 'notificacion_aprendiz' ? 'none' : '2px solid #86efac',
            transition: 'all 0.2s'
          }}
        >
          <Mail size={18} /> 3. Notificación Aprendiz
        </button>
        <button 
          onClick={() => setActiveTab('historico')}
          style={{
            padding: '12px 24px',
            borderRadius: '10px 10px 0 0',
            border: 'none',
            fontWeight: '600',
            fontSize: '15px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: activeTab === 'historico' ? '#00324d' : '#f1f5f9',
            color: activeTab === 'historico' ? '#fff' : '#64748b',
            transition: 'all 0.2s'
          }}
        >
          <Send size={18} /> 4. Histórico y Cargue OnBase ({historico.length})
        </button>
      </div>

      {/* PESTAÑA 1, 2 Y 3: VISTA PRINCIPAL DE TRÁMITE */}
      {(activeTab === 'citacion' || activeTab === 'resolucion' || activeTab === 'notificacion_aprendiz') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>
          
          {/* Panel Izquierdo: Excel, Editor y Tabla */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Box 1: Carga de Excel con Detección Automática CC vs TI */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Upload size={20} color="#39a900" />
                  1. Cargar Base de Datos desde Excel (.xlsx / .xls)
                </h3>
                <button
                  type="button"
                  onClick={() => handleLoadLatestExcel(false)}
                  style={{
                    background: '#f0fdf4',
                    color: '#15803d',
                    border: '1px solid #86efac',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Recarga automáticamente el último archivo Excel subido al servidor sin tener que buscarlo de nuevo"
                >
                  <RefreshCw size={14} /> Recargar último Excel subido
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <input 
                  type="file" 
                  accept=".xlsx, .xls"
                  onChange={handleExcelUpload}
                  style={{ display: 'none' }}
                  id="excel-file-input"
                />
                <label 
                  htmlFor="excel-file-input"
                  style={{
                    background: '#f8fafc',
                    border: '2px dashed #cbd5e1',
                    borderRadius: '10px',
                    padding: '14px 20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flex: 1,
                    minWidth: '260px',
                    justifyContent: 'center',
                    color: '#475569',
                    fontWeight: '600'
                  }}
                >
                  <FileSpreadsheet size={24} color="#00324d" />
                  {excelFile ? excelFile.name : 'Haz clic aquí para examinar y cargar tu archivo Excel'}
                </label>
                {excelData.length > 0 && (() => {
                  const tiCount = excelData.filter(r => String(r.aprendiz_doc_tipo || r.raw_row?.['TIPO'] || 'CC').trim().toUpperCase() === 'TI').length;
                  const mayorCount = excelData.length - tiCount;
                  return (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ background: '#ecfdf5', color: '#047857', padding: '10px 14px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', border: '1px solid #a7f3d0' }}>
                        ✓ {excelData.length} Aprendices
                      </div>
                      <div style={{ background: '#eff6ff', color: '#1d4ed8', padding: '10px 12px', borderRadius: '8px', fontWeight: '700', fontSize: '12px', border: '1px solid #bfdbfe' }}>
                        🧑 {mayorCount} Mayores (CC/PPT)
                      </div>
                      <div style={{ background: '#f5f3ff', color: '#6d28d9', padding: '10px 12px', borderRadius: '8px', fontWeight: '700', fontSize: '12px', border: '1px solid #ddd6fe' }}>
                        👦 {tiCount} Menores T.I. (TI)
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Box 2: Editor Inteligente de Plantillas (Mayor de Edad CC vs Menor de Edad / Tarjeta de Identidad TI) */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={20} color="#39a900" />
                  2. Plantillas Oficiales Pre-Combinadas (Mayor de Edad CC y Menor de Edad / Tarjeta de Identidad TI)
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setShowLiveSplitPreview(prev => !prev)}
                    style={{
                      background: showLiveSplitPreview ? '#0284c7' : '#f1f5f9',
                      color: showLiveSplitPreview ? '#fff' : '#334155',
                      border: '1px solid #bae6fd',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Eye size={14} /> {showLiveSplitPreview ? 'Ocultar Vista Previa en Vivo' : 'Ver Carta Combinada en Vivo'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveTemplatesToServer(false)}
                    disabled={savingTemplates}
                    style={{
                      background: '#39a900',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 2px 6px rgba(57,169,0,0.25)'
                    }}
                  >
                    <CheckCircle2 size={14} /> {savingTemplates ? 'Guardando...' : '💾 Guardar Plantillas en el Sistema'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm('¿Desea restaurar la plantilla actual al texto oficial SENA CIMI pre-combinado por defecto?')) return;
                      if (activeTab === 'citacion') {
                        if (plantillaVariante === 'menor_ti') {
                          setTextoInicialCitacionTi(OFFICIAL_CITACION_MENOR_TI);
                          setDescripcionAsuntoCitacionTi('Citación a Comité de Evaluación y Seguimiento (Menor de Edad TI) – Presunta deserción – Ficha {{FICHA}}');
                        } else {
                          setTextoInicialCitacion(OFFICIAL_CITACION_MAYOR);
                          setDescripcionAsuntoCitacion('Citación a Comité de Evaluación y Seguimiento – Presunta deserción por inasistencias – Ficha {{FICHA}}');
                        }
                      } else if (activeTab === 'notificacion_aprendiz') {
                        if (syncNotifAprendizUnicaCarta) {
                          setTextoInicialNotifAprendiz(OFFICIAL_NOTIFICACION_APRENDIZ_MAYOR);
                          setTextoInicialNotifAprendizTi(OFFICIAL_NOTIFICACION_APRENDIZ_MAYOR);
                          setDescripcionAsuntoNotifAprendiz('Notificación al Aprendiz – Proceso de Deserción – Ficha {{FICHA}}');
                          setDescripcionAsuntoNotifAprendizTi('Notificación al Aprendiz – Proceso de Deserción – Ficha {{FICHA}}');
                        } else if (plantillaVariante === 'menor_ti') {
                          setTextoInicialNotifAprendizTi(OFFICIAL_NOTIFICACION_APRENDIZ_MENOR_TI);
                          setDescripcionAsuntoNotifAprendizTi('Notificación al Aprendiz (Menor de Edad TI) – Proceso de Deserción – Ficha {{FICHA}}');
                        } else {
                          setTextoInicialNotifAprendiz(OFFICIAL_NOTIFICACION_APRENDIZ_MAYOR);
                          setDescripcionAsuntoNotifAprendiz('Notificación al Aprendiz – Proceso de Deserción – Ficha {{FICHA}}');
                        }
                      } else {
                        if (plantillaVariante === 'menor_ti') {
                          setTextoInicialResolucionTi(OFFICIAL_RESOLUCION_MENOR_TI);
                        } else {
                          setTextoInicialResolucion(OFFICIAL_RESOLUCION_MAYOR);
                        }
                      }
                    }}
                    style={{
                      background: '#f8fafc',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                    title="Restaura el texto oficial SENA con todas las etiquetas ya combinadas"
                  >
                    ↺ Restaurar Oficial
                  </button>
                </div>
              </div>

              {activeTab === 'notificacion_aprendiz' && (
                <div style={{
                  background: '#ecfdf5',
                  border: '1px solid #86efac',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#166534', fontWeight: '700' }}>
                    <CheckCircle2 size={16} color="#15803d" />
                    <span>
                      <strong>Notificación Aprendiz (Envíos de Deserción):</strong> Cualquier carta que pegue o edite aquí se guarda <strong>automáticamente como predeterminada</strong> en el servidor.
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#0f172a', cursor: 'pointer', background: '#fff', padding: '5px 10px', borderRadius: '6px', border: '1px solid #86efac' }}>
                      <input
                        type="checkbox"
                        checked={syncNotifAprendizUnicaCarta}
                        onChange={(e) => setSyncNotifAprendizUnicaCarta(e.target.checked)}
                        style={{ accentColor: '#39a900', width: '15px', height: '15px' }}
                      />
                      <span>Usar la misma carta pegada para todos (CC y TI)</span>
                    </label>
                    {autoSaveBadge && (
                      <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#15803d', background: '#dcfce7', padding: '4px 10px', borderRadius: '999px', border: '1px solid #86efac' }}>
                        {autoSaveBadge}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Selector de Variante: Mayor de Edad (CC) vs Menor de Edad / Tarjeta de Identidad (TI) + Switch Automático */}
              <div style={{
                background: 'linear-gradient(90deg, #f0fdf4 0%, #f5f3ff 100%)',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPlantillaVariante('mayor');
                      const firstMayorIdx = excelData.findIndex(r => String(r.aprendiz_doc_tipo || r.raw_row?.['TIPO'] || 'CC').trim().toUpperCase() !== 'TI');
                      if (firstMayorIdx >= 0) setLivePreviewRowIdx(firstMayorIdx);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: plantillaVariante === 'mayor' ? '2px solid #00324d' : '1px solid #cbd5e1',
                      background: plantillaVariante === 'mayor' ? '#00324d' : '#fff',
                      color: plantillaVariante === 'mayor' ? '#fff' : '#334155',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    🧑 Texto Mayor de Edad (CC / CE / PPT)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPlantillaVariante('menor_ti');
                      const firstTiIdx = excelData.findIndex(r => String(r.aprendiz_doc_tipo || r.raw_row?.['TIPO'] || 'CC').trim().toUpperCase() === 'TI');
                      if (firstTiIdx >= 0) setLivePreviewRowIdx(firstTiIdx);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: plantillaVariante === 'menor_ti' ? '2px solid #6d28d9' : '1px solid #cbd5e1',
                      background: plantillaVariante === 'menor_ti' ? '#6d28d9' : '#fff',
                      color: plantillaVariante === 'menor_ti' ? '#fff' : '#334155',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    👦 Texto Menor de Edad / Tarjeta de Identidad (TI)
                  </button>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '700', color: '#0f172a', cursor: 'pointer', background: '#fff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={autoTiTemplate}
                    onChange={(e) => setAutoTiTemplate(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#39a900' }}
                  />
                  <span>⚡ Aplicar automáticamente según <strong>TIPO</strong> del Excel (<strong>CC</strong> → Mayor | <strong>TI</strong> → Menor de Edad)</span>
                </label>
              </div>

              {/* Parámetros Rápidos de Citación a Comité / Notificación Aprendiz (Sin tener que buscar dentro del texto largo) */}
              {(activeTab === 'citacion' || activeTab === 'notificacion_aprendiz') && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#00324d', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} color="#39a900" />
                    Datos Rápidos de la Citación a Comité (Se combinan solos en todas las cartas si el Excel no trae estas columnas):
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                        Fecha de Comité / Plazo ({'{{FECHA_COMITE}}'}):
                      </label>
                      <input
                        type="text"
                        value={comiteDefaults.fecha_comite}
                        onChange={(e) => setComiteDefaults(prev => ({ ...prev, fecha_comite: e.target.value }))}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                        Hora de Atención / Comité ({'{{HORA_COMITE}}'}):
                      </label>
                      <input
                        type="text"
                        value={comiteDefaults.hora_comite}
                        onChange={(e) => setComiteDefaults(prev => ({ ...prev, hora_comite: e.target.value }))}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                        Lugar / Canal de Descargos ({'{{LUGAR_COMITE}}'}):
                      </label>
                      <input
                        type="text"
                        value={comiteDefaults.lugar_comite}
                        onChange={(e) => setComiteDefaults(prev => ({ ...prev, lugar_comite: e.target.value }))}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Casillas de Asunto y Descripción del Asunto (Campos de OnBase Web) */}
              <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '14px', marginBottom: '12px', background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                    Asunto OnBase: <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input 
                    type="text" 
                    value={getActiveAsunto()}
                    onChange={(e) => setActiveAsunto(e.target.value)}
                    placeholder="NOVEDADES DE ALUMNOS"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600', color: '#00324d', background: '#fff', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                    Descripción del Asunto ({plantillaVariante === 'menor_ti' ? 'Menor T.I.' : 'Mayor CC'}): <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input 
                    ref={descInputRef}
                    type="text" 
                    value={getActiveDescAsunto()}
                    onFocus={() => setActiveInputTarget('descripcion_asunto')}
                    onChange={(e) => setActiveDescAsunto(e.target.value)}
                    placeholder="Citación a Comité de Evaluación y Seguimiento"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600', color: '#00324d', background: '#fff', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Barra Fija (Sticky) de Chips de Variables — con onMouseDown preventDefault para que NUNCA salte el scroll */}
              <div style={{
                position: 'sticky',
                top: '6px',
                zIndex: 15,
                background: '#ffffff',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid #bae6fd',
                boxShadow: '0 2px 8px rgba(2,132,199,0.08)',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#0369a1' }}>
                    📌 Insertar Variable en {activeInputTarget === 'descripcion_asunto' ? '"Descripción del Asunto"' : 'el Cuerpo de la Carta'} (No mueve la pantalla):
                  </span>
                  <span style={{ fontSize: '11px', color: '#047857', fontWeight: '600' }}>
                    ✓ Las variables ya vienen combinadas en la plantilla oficial
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '86px', overflowY: 'auto' }}>
                  {availableChips.map(chip => (
                    <button 
                      key={chip}
                      type="button"
                      onMouseDown={(e) => {
                        // CRÍTICO: Evita que el textarea pierda el foco y evita que el navegador salte hacia arriba al insertar
                        e.preventDefault();
                      }}
                      onClick={() => insertChip(chip)}
                      style={{
                        background: '#e0f2fe',
                        color: '#0369a1',
                        border: '1px solid #bae6fd',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                      title={`Insertar ${chip} exactamente donde está el cursor sin mover el texto`}
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Área Principal: Editor de Plantilla (Izquierda) + Vista Previa Combinada en Vivo (Derecha) */}
              <div style={{ display: 'grid', gridTemplateColumns: showLiveSplitPreview ? '1fr 1fr' : '1fr', gap: '14px', alignItems: ' stretch' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: plantillaVariante === 'menor_ti' ? '#6d28d9' : '#00324d', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      ✏️ Editando Plantilla: {plantillaVariante === 'menor_ti' ? '👦 MENOR DE EDAD / TARJETA DE IDENTIDAD (TI)' : '🧑 MAYOR DE EDAD (CC / CE / PPT)'}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Scroll fijo garantizado</span>
                  </div>
                  <textarea 
                    ref={textareaRef}
                    rows={18}
                    value={getActiveBodyText()}
                    onFocus={() => setActiveInputTarget('body')}
                    onChange={(e) => setActiveBodyText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '8px',
                      border: plantillaVariante === 'menor_ti' ? '2px solid #c4b5fd' : '2px solid #cbd5e1',
                      fontSize: '13px',
                      lineHeight: '1.55',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                      minHeight: '390px'
                    }}
                    placeholder="Escriba aquí el texto inicial de la comunicación..."
                  />
                </div>

                {showLiveSplitPreview && (
                  <div style={{ display: 'flex', flexDirection: 'column', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#15803d' }}>
                        👁️ Vista Previa Combinada en Vivo:
                      </span>
                      {excelData.length > 0 && (
                        <select
                          value={livePreviewRowIdx}
                          onChange={(e) => {
                            const idx = Number(e.target.value);
                            setLivePreviewRowIdx(idx);
                            const r = excelData[idx];
                            if (r && autoTiTemplate) {
                              const isTi = String(r.aprendiz_doc_tipo || r.raw_row?.['TIPO'] || 'CC').trim().toUpperCase() === 'TI';
                              setPlantillaVariante(isTi ? 'menor_ti' : 'mayor');
                            }
                          }}
                          style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', fontWeight: '700', maxWidth: '240px', background: '#fff' }}
                        >
                          {excelData.map((r, idx) => {
                            const td = String(r.aprendiz_doc_tipo || r.raw_row?.['TIPO'] || 'CC').trim().toUpperCase();
                            return (
                              <option key={r.id_temp || idx} value={idx}>
                                #{idx + 1} [{td}] {r.aprendiz_nombre}
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>
                    <div style={{
                      flex: 1,
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '12px',
                      fontSize: '12.5px',
                      lineHeight: '1.55',
                      color: '#1e293b',
                      whiteSpace: 'pre-wrap',
                      overflowY: 'auto',
                      maxHeight: '390px'
                    }}>
                      {(() => {
                        const sampleRow = excelData[livePreviewRowIdx] || excelData[0] || {
                          aprendiz_nombres: 'ROBINSON SANTIAGO',
                          aprendiz_apellidos: 'BAEZ ARDILA',
                          aprendiz_nombre: 'ROBINSON SANTIAGO BAEZ ARDILA',
                          aprendiz_doc_tipo: plantillaVariante === 'menor_ti' ? 'TI' : 'CC',
                          aprendiz_doc_numero: '1095792219',
                          ficha: '3491175',
                          nivel: 'TÉCNICO',
                          programa: 'MANTENIMIENTO DE LOS MOTORES DIESEL',
                          tipo_formacion: 'PRESENCIAL',
                          aprendiz_correo: 'santiagobaez797@gmail.com',
                          instructor: 'Orlando Santos Serrano',
                          fecha_reporte: '06/10/2026',
                          fechas_inasistencia: '22/07/2026 al 29 de julio — 3 al 31 de agosto',
                          estado: 'MATRICULADO',
                          resolucion: '03875'
                        };
                        const mergedDesc = computeClientLiveMerge(getActiveDescAsunto(), sampleRow);
                        const mergedBody = computeClientLiveMerge(getActiveBodyText(), sampleRow);
                        return `📌 Descripción Asunto OnBase:\n${mergedDesc}\n${'─'.repeat(48)}\n\n${mergedBody}`;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Box 3: Tabla de Aprendices y Anexos Explícitos / Masivos */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Paperclip size={20} color="#39a900" />
                  3. Tabla Combinada y Anexo Explícito por Aprendiz ({activeTab === 'citacion' ? 'Anexo del Comité' : activeTab === 'notificacion_aprendiz' ? 'Notificación Aprendiz' : 'Anexo de Resolución'})
                </h3>

                {/* Botón de Cargue Masivo de Paquete de Anexos */}
                {excelData.length > 0 && (
                  <label style={{
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#00324d',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    boxShadow: '0 2px 6px rgba(0,50,77,0.2)'
                  }}>
                    <Upload size={16} />
                    {uploadingBatchAttachments ? 'Cargando Paquete Masivo...' : 'Cargar Paquete Masivo de Adjuntos'}
                    <input 
                      type="file" 
                      multiple 
                      accept=".pdf,.doc,.docx"
                      onChange={handleBatchAttachmentsUpload}
                      style={{ display: 'none' }}
                      disabled={uploadingBatchAttachments}
                    />
                  </label>
                )}
              </div>

              {excelData.length === 0 ? (
                <div style={{ padding: '40px', textIndent: 'center', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '8px' }}>
                  Carga un archivo Excel arriba para visualizar las filas combinadas y adjuntar los archivos de anexo.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  {(() => {
                    const isRowTi = (r) => ['TI', 'T.I.', 'TARJETA DE IDENTIDAD'].includes(String(r.aprendiz_doc_tipo || r.raw_row?.['TIPO'] || r.raw_row?.['TIPO_DOC'] || '').trim().toUpperCase());
                    const countExcelTi = excelData.filter(isRowTi).length;
                    const countExcelMayores = excelData.length - countExcelTi;
                    const countExcelTiSinAcudiente = excelData.filter(r => isRowTi(r) && !String(r.acudiente_correo || '').trim()).length;

                    const filteredExcelRows = excelData.filter(r => {
                      if (excelDocTypeFilter === 'TI' && !isRowTi(r)) return false;
                      if (excelDocTypeFilter === 'MAYORES' && isRowTi(r)) return false;
                      if (excelDocTypeFilter === 'TI_SIN_ACUDIENTE' && (!isRowTi(r) || String(r.acudiente_correo || '').trim())) return false;
                      if (excelSearch.trim()) {
                        const q = excelSearch.trim().toLowerCase();
                        const hay = `${r.aprendiz_nombre || ''} ${r.aprendiz_doc_tipo || ''} ${r.aprendiz_doc_numero || ''} ${r.ficha || ''} ${r.aprendiz_correo || ''} ${r.acudiente_nombre || ''} ${r.acudiente_correo || ''} ${r.programa || ''}`.toLowerCase();
                        if (!hay.includes(q)) return false;
                      }
                      return true;
                    });

                    const incompleteCount = excelData.filter(r => {
                      const fn = (r.aprendiz_nombre || '').trim();
                      const doc = (r.aprendiz_doc_numero || '').trim();
                      const mail = (r.aprendiz_correo || '').trim();
                      return !fn || fn === 'N/A' || !doc || !mail || mail === 'Sin correo';
                    }).length;

                    return (
                      <>
                        {/* Barra de Filtro por Tipo de Documento (T.I. Menores de Edad vs Mayores CC) */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '10px',
                          marginBottom: '14px',
                          background: '#f8fafc',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', fontWeight: '800', color: '#334155', marginRight: '4px' }}>
                              🔎 Filtrar por Documento:
                            </span>
                            <button
                              type="button"
                              onClick={() => setExcelDocTypeFilter('Todos')}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: excelDocTypeFilter === 'Todos' ? '1.5px solid #00324d' : '1px solid #cbd5e1',
                                background: excelDocTypeFilter === 'Todos' ? '#00324d' : '#fff',
                                color: excelDocTypeFilter === 'Todos' ? '#fff' : '#475569',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              Todos ({excelData.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setExcelDocTypeFilter('TI')}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: excelDocTypeFilter === 'TI' ? '1.5px solid #6d28d9' : '1px solid #d8b4fe',
                                background: excelDocTypeFilter === 'TI' ? '#6d28d9' : '#f5f3ff',
                                color: excelDocTypeFilter === 'TI' ? '#fff' : '#5b21b6',
                                fontSize: '12px',
                                fontWeight: '800',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              👦 Solo T.I. Menores ({countExcelTi})
                            </button>
                            <button
                              type="button"
                              onClick={() => setExcelDocTypeFilter('MAYORES')}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: excelDocTypeFilter === 'MAYORES' ? '1.5px solid #0369a1' : '1px solid #bae6fd',
                                background: excelDocTypeFilter === 'MAYORES' ? '#0369a1' : '#f0f9ff',
                                color: excelDocTypeFilter === 'MAYORES' ? '#fff' : '#0369a1',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              🧑 Mayores CC / PPT ({countExcelMayores})
                            </button>
                            {countExcelTiSinAcudiente > 0 && (
                              <button
                                type="button"
                                onClick={() => setExcelDocTypeFilter('TI_SIN_ACUDIENTE')}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  border: excelDocTypeFilter === 'TI_SIN_ACUDIENTE' ? '1.5px solid #b45309' : '1px solid #fcd34d',
                                  background: excelDocTypeFilter === 'TI_SIN_ACUDIENTE' ? '#d97706' : '#fffbeb',
                                  color: excelDocTypeFilter === 'TI_SIN_ACUDIENTE' ? '#fff' : '#b45309',
                                  fontSize: '12px',
                                  fontWeight: '800',
                                  cursor: 'pointer'
                                }}
                              >
                                ⚠️ T.I. sin Correo Acudiente ({countExcelTiSinAcudiente})
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {countExcelTi > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const onlyTiSel = {};
                                  excelData.forEach(r => {
                                    if (isRowTi(r)) onlyTiSel[r.id_temp] = true;
                                  });
                                  setSelectedRows(onlyTiSel);
                                  setExcelDocTypeFilter('TI');
                                }}
                                style={{
                                  background: '#ede9fe',
                                  color: '#5b21b6',
                                  border: '1px solid #c4b5fd',
                                  padding: '6px 10px',
                                  borderRadius: '7px',
                                  fontSize: '11.5px',
                                  fontWeight: '700',
                                  cursor: 'pointer'
                                }}
                                title="Marca únicamente los aprendices con Tarjeta de Identidad (TI) para procesarlos por separado"
                              >
                                ☑️ Seleccionar solo los T.I. ({countExcelTi})
                              </button>
                            )}
                            <input
                              type="text"
                              value={excelSearch}
                              onChange={(e) => setExcelSearch(e.target.value)}
                              placeholder="Buscar aprendiz, doc, ficha, acudiente..."
                              style={{
                                padding: '6px 10px',
                                borderRadius: '7px',
                                border: '1px solid #cbd5e1',
                                fontSize: '12px',
                                minWidth: '220px',
                                background: '#fff'
                              }}
                            />
                          </div>
                        </div>

                        {incompleteCount > 0 && (
                          <div style={{
                            background: '#fffbeb',
                            border: '1px solid #fde68a',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            marginBottom: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '10px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e', fontSize: '13px', fontWeight: '600' }}>
                              <span style={{ fontSize: '16px' }}>⚠️</span>
                              <span>Atención: Se identificaron <strong>{incompleteCount}</strong> registro(s) con datos indispensables vacíos (Documento, Nombre o Correo).</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRows(prev => {
                                  const next = { ...prev };
                                  excelData.forEach(r => {
                                    const fn = (r.aprendiz_nombre || '').trim();
                                    const doc = (r.aprendiz_doc_numero || '').trim();
                                    const mail = (r.aprendiz_correo || '').trim();
                                    if (!fn || fn === 'N/A' || !doc || !mail || mail === 'Sin correo') {
                                      delete next[r.id_temp];
                                    }
                                  });
                                  return next;
                                });
                              }}
                              style={{
                                background: '#fef3c7',
                                color: '#78350f',
                                border: '1px solid #fcd34d',
                                padding: '5px 12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              Deseleccionar registros incompletos
                            </button>
                          </div>
                        )}

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: '#f1f5f9', textTransform: 'uppercase', fontSize: '11px', color: '#475569' }}>
                              <th style={{ padding: '10px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={filteredExcelRows.length > 0 && filteredExcelRows.every(r => !!selectedRows[r.id_temp])}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setSelectedRows(prev => {
                                      const next = { ...prev };
                                      filteredExcelRows.forEach(r => {
                                        next[r.id_temp] = checked;
                                      });
                                      return next;
                                    });
                                  }}
                                  title="Seleccionar / deseleccionar filas visibles"
                                  style={{ cursor: 'pointer' }}
                                />
                              </th>
                              <th style={{ padding: '10px', textAlign: 'left' }}>Aprendiz (Nombres y Apellidos)</th>
                              <th style={{ padding: '10px', textAlign: 'left' }}>Tipo Doc</th>
                              <th style={{ padding: '10px', textAlign: 'left' }}>Documento</th>
                              <th style={{ padding: '10px', textAlign: 'left' }}>Ficha</th>
                              <th style={{ padding: '10px', textAlign: 'left' }}>Correo Registrado en Sofía</th>
                              <th style={{ padding: '10px', textAlign: 'left', minWidth: '240px', background: '#f5f3ff', color: '#5b21b6' }}>👨‍👩‍👦 Acudiente (Copia Independiente)</th>
                              <th style={{ padding: '10px', textAlign: 'left' }}>Programa / Causal</th>
                              <th style={{ padding: '10px', textAlign: 'center' }}>Anexo Explícito / Masivo</th>
                              <th style={{ padding: '10px', textAlign: 'center' }}>Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredExcelRows.map((row, idx) => {
                        const nombres = row.aprendiz_nombres || row.raw_row?.['NOMBRE'] || row.raw_row?.['NOMBRES'] || '';
                        const apellidos = row.aprendiz_apellidos || row.raw_row?.['APELLIDOS'] || row.raw_row?.['APELLIDO'] || '';
                        const fullName = row.aprendiz_nombre || [nombres, apellidos].filter(Boolean).join(' ') || 'N/A';
                        const tipoDoc = row.aprendiz_doc_tipo || row.raw_row?.['TIPO'] || row.raw_row?.['TIPO_DOC'] || 'CC';
                        const numDoc = row.aprendiz_doc_numero || row.raw_row?.['DOCUMENTO'] || row.raw_row?.['NUM_DOCUMENTO'] || '';
                        const correoSofia = row.aprendiz_correo || row.raw_row?.['CORREO REGISTRADO EN SOFÍA'] || row.raw_row?.['CORREO REGISTRADO EN SOFIA'] || row.raw_row?.['CORREO'] || row.raw_row?.['EMAIL'] || 'Sin correo';

                        const hasMissingDoc = !numDoc || String(numDoc).trim() === '';
                        const hasMissingName = !fullName || fullName === 'N/A' || String(fullName).trim() === '';
                        const hasMissingEmail = !correoSofia || correoSofia === 'Sin correo' || String(correoSofia).trim() === '';
                        const isRowIncomplete = hasMissingDoc || hasMissingName || hasMissingEmail;

                        return (
                          <tr key={row.id_temp || idx} style={{
                            borderBottom: '1px solid #e2e8f0',
                            background: isRowIncomplete ? '#fffdf5' : (selectedRows[row.id_temp] ? '#f8fafc' : 'transparent'),
                            borderLeft: isRowIncomplete ? '4px solid #f59e0b' : '4px solid transparent'
                          }}>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <input 
                                type="checkbox"
                                checked={!!selectedRows[row.id_temp]}
                                onChange={(e) => setSelectedRows(prev => ({ ...prev, [row.id_temp]: e.target.checked }))}
                              />
                            </td>
                            <td style={{ padding: '10px', color: '#0f172a' }}>
                              <strong style={{ display: 'block', fontSize: '13px', color: hasMissingName ? '#dc2626' : '#00324d' }}>
                                {hasMissingName ? '⚠️ Nombre faltante' : fullName}
                              </strong>
                              {(nombres && apellidos && fullName !== `${nombres} ${apellidos}`) && (
                                <span style={{ fontSize: '11px', color: '#64748b' }}>Nombres: {nombres} | Apellidos: {apellidos}</span>
                              )}
                            </td>
                            <td style={{ padding: '10px' }}>
                              <select
                                value={String(tipoDoc).trim().toUpperCase()}
                                onChange={(e) => handleUpdateExcelRowField(row.id_temp, 'aprendiz_doc_tipo', e.target.value)}
                                style={{
                                  background: String(tipoDoc).trim().toUpperCase() === 'TI' ? '#f3e8ff' : '#e0f2fe',
                                  color: String(tipoDoc).trim().toUpperCase() === 'TI' ? '#6d28d9' : '#0369a1',
                                  border: `1px solid ${String(tipoDoc).trim().toUpperCase() === 'TI' ? '#d8b4fe' : '#bae6fd'}`,
                                  padding: '4px 6px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  cursor: 'pointer'
                                }}
                                title="Puede cambiar entre TI (Menor de Edad) y CC/PPT (Mayor de Edad)"
                              >
                                <option value="CC">🧑 CC (Mayor)</option>
                                <option value="TI">👦 TI (Menor)</option>
                                <option value="PPT">🧑 PPT</option>
                                <option value="CE">🧑 CE</option>
                              </select>
                            </td>
                            <td style={{ padding: '10px', fontWeight: '600' }}>
                              {hasMissingDoc ? (
                                <span style={{ color: '#dc2626', fontSize: '11px', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>
                                  ⚠️ Falta Doc
                                </span>
                              ) : numDoc}
                            </td>
                            <td style={{ padding: '10px' }}>{row.ficha}</td>
                            <td style={{ padding: '10px' }}>
                              {hasMissingEmail ? (
                                <span style={{ color: '#b45309', fontSize: '11px', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                                  ⚠️ Sin correo Sofía
                                </span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f8fafc', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', color: '#0369a1', fontWeight: '600' }}>
                                  📧 {correoSofia}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', background: String(tipoDoc).trim().toUpperCase() === 'TI' ? '#faf5ff' : 'transparent', borderLeft: '1px dashed #e9d5ff', borderRight: '1px dashed #e9d5ff' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '220px' }}>
                                <input
                                  type="text"
                                  value={row.acudiente_nombre || ''}
                                  onChange={(e) => handleUpdateExcelRowField(row.id_temp, 'acudiente_nombre', e.target.value)}
                                  placeholder="👤 Nombre del Acudiente / Padre..."
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    borderRadius: '5px',
                                    border: '1px solid #cbd5e1',
                                    background: '#fff',
                                    boxSizing: 'border-box'
                                  }}
                                />
                                <input
                                  type="email"
                                  value={row.acudiente_correo || ''}
                                  onChange={(e) => handleUpdateExcelRowField(row.id_temp, 'acudiente_correo', e.target.value)}
                                  placeholder="📧 Correo Acudiente (Copia CC OnBase)..."
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    borderRadius: '5px',
                                    border: row.acudiente_correo ? '1.5px solid #7c3aed' : (String(tipoDoc).trim().toUpperCase() === 'TI' ? '1.5px solid #f59e0b' : '1px solid #cbd5e1'),
                                    background: row.acudiente_correo ? '#f5f3ff' : '#fff',
                                    color: '#4c1d95',
                                    fontWeight: row.acudiente_correo ? '700' : '400',
                                    boxSizing: 'border-box'
                                  }}
                                />
                                {String(tipoDoc).trim().toUpperCase() === 'TI' && !row.acudiente_correo && (
                                  <span style={{ fontSize: '10px', color: '#b45309', fontWeight: '700' }}>
                                    👦 Menor T.I.: ingrese correo del acudiente para copia independiente
                                  </span>
                                )}
                                {row.acudiente_correo && (
                                  <span style={{ fontSize: '10px', color: '#6d28d9', fontWeight: '700' }}>
                                    ✓ Se enviará copia CC independiente a este acudiente
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '10px', maxWidth: '190px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                              <div style={{ fontSize: '11.5px', fontWeight: '600', color: '#1e293b' }}>{row.programa}</div>
                              <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>{row.causal_desercion || 'DESERCIÓN'}</div>
                            </td>
                            
                            {/* Adjunto Explícito por comunicación */}
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <input 
                                  type="file" 
                                  onChange={(e) => handleRowAttachmentUpload(row.id_temp, e.target.files[0])}
                                  style={{ display: 'none' }}
                                />
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  background: rowAttachments[row.id_temp] ? '#dcfce7' : '#f1f5f9',
                                  color: rowAttachments[row.id_temp] ? '#15803d' : '#64748b',
                                  border: `1px solid ${rowAttachments[row.id_temp] ? '#86efac' : '#cbd5e1'}`
                                }}>
                                  {uploadingAttachmentId === row.id_temp ? 'Subiendo...' : rowAttachments[row.id_temp] ? `✓ ${rowAttachments[row.id_temp].name}` : '+ Adjuntar Anexo'}
                                </span>
                              </label>
                            </td>

                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <button 
                                onClick={() => handleOpenPreview(row)}
                                style={{
                                  background: '#e0f2fe',
                                  color: '#0284c7',
                                  border: 'none',
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '12px',
                                  fontWeight: '600'
                                }}
                              >
                                <Eye size={14} /> Ver Carta
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredExcelRows.length === 0 && (
                        <tr>
                          <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontWeight: '600' }}>
                            No hay aprendices que coincidan con el filtro seleccionado ({excelDocTypeFilter}).
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

          </div>

          {/* Panel Derecho: Configuración OnBase & Envíos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* OnBase Destination User */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <h3 style={{ margin: '0 0 14px 0', color: '#0f172a', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck size={18} color="#00324d" />
                Usuario OnBase Destino
              </h3>
              <label style={{ display: 'block', fontSize: '13px', color: '#475569', marginBottom: '6px' }}>
                Selecciona el usuario de OnBase para el cargue:
              </label>
              <select 
                value={selectedOnbaseUser}
                onChange={(e) => handleSelectOnbaseUser(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#00324d',
                  background: '#f8fafc'
                }}
              >
                {onbaseUsers.map((u, i) => (
                  <option key={u.id || u.username || i} value={u.username || u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Correos en Copia (CC) con Selección Rápida de 1 Clic (Sin tener que llenar formulario) */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={18} color="#00324d" />
                  Correos en Copia (CC en OnBase)
                </h3>
                <span style={{ fontSize: '11px', color: '#15803d', fontWeight: '700', background: '#dcfce7', padding: '3px 8px', borderRadius: '10px' }}>
                  ✓ {ccEmails.length} Activo(s)
                </span>
              </div>

              {/* Selección Rápida 1 Clic de Funcionarios CIMI */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#00324d', marginBottom: '6px' }}>
                  ⚡ Activar / Desactivar con 1 Clic (Se diligencian solos en OnBase):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {frequentCimiContacts.map((c) => {
                    const isChecked = ccEmails.some(item => item.email.toLowerCase() === c.email.toLowerCase());
                    return (
                      <label
                        key={c.email}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          background: isChecked ? '#ecfdf5' : '#fff',
                          border: `1px solid ${isChecked ? '#86efac' : '#e2e8f0'}`,
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleQuickCc(c)}
                          style={{ accentColor: '#39a900', width: '15px', height: '15px' }}
                        />
                        <div style={{ flex: 1, lineHeight: '1.25' }}>
                          <strong style={{ color: '#0f172a', display: 'block' }}>{c.name}</strong>
                          <span style={{ fontSize: '11px', color: '#0369a1' }}>{c.email}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Lista de correos adicionales personalizados */}
              {ccEmails.filter(cc => !frequentCimiContacts.some(f => f.email.toLowerCase() === cc.email.toLowerCase())).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                  {ccEmails.map((cc, idx) => {
                    if (frequentCimiContacts.some(f => f.email.toLowerCase() === cc.email.toLowerCase())) return null;
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', borderLeft: '3px solid #00324d' }}>
                        <div>
                          <strong style={{ color: '#0f172a' }}>{cc.name}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{cc.email}</div>
                        </div>
                        <button 
                          onClick={() => handleRemoveCcEmail(idx)}
                          title="Eliminar correo"
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Campo rápido opcional para agregar otro correo (no requiere llenar nombre) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input 
                    type="text" 
                    placeholder="Agregar otro correo (ej. instructor@sena.edu.co)"
                    value={newCcEmail}
                    onChange={(e) => setNewCcEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCcEmail(); } }}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                  <button 
                    type="button"
                    onClick={handleAddCcEmail}
                    title="Agregar correo en copia"
                    style={{ background: '#00324d', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={15} /> Agregar
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                  <span style={{ fontSize: '10.5px', color: '#64748b' }}>El robot diligencia estos correos en OnBase</span>
                  <button 
                    type="button"
                    onClick={handleResetCcEmails}
                    style={{ background: 'none', border: 'none', color: '#0369a1', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline', fontWeight: '600' }}
                  >
                    Restablecer oficiales CIMI
                  </button>
                </div>
              </div>
            </div>

            {/* Acciones Finales (Citación a Comité NUNCA lleva anexo PDF; Notificación de Resolución sí lleva PDF) */}
            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={() => handleGuardarYGenerar({ generatePdf: false })}
                disabled={processingSave || excelData.length === 0}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #00324d 0%, #00507a 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '14px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: (processingSave || excelData.length === 0) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(0,50,77,0.25)',
                  opacity: excelData.length === 0 ? 0.6 : 1
                }}
              >
                <Play size={18} color="#39a900" />
                {processingSave
                  ? 'Procesando...'
                  : activeTab === 'citacion'
                    ? 'Guardar Citaciones para Robot OnBase (Sin Anexo PDF)'
                    : activeTab === 'notificacion_aprendiz'
                      ? 'Guardar Notificación Aprendiz para Robot OnBase (Sin Anexo PDF)'
                      : 'Guardar Notificaciones para Robot OnBase'}
              </button>

              {(activeTab === 'citacion' || activeTab === 'notificacion_aprendiz') ? (
                <div style={{ fontSize: '11.5px', color: '#475569', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '8px 10px', lineHeight: '1.35' }}>
                  ℹ️ <strong>Regla OnBase SENA:</strong> {activeTab === 'notificacion_aprendiz' ? 'Las cartas de Notificación Aprendiz van directamente en el cuerpo del formulario OnBase y se guardan predeterminadamente.' : 'Las Citaciones a Comité van directamente en el cuerpo del formulario OnBase y no llevan PDF adjunto.'}
                </div>
              ) : (
                <button 
                  onClick={() => handleGuardarYGenerar({ generatePdf: true })}
                  disabled={processingSave || excelData.length === 0}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #39a900 0%, #2e8b00 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: (processingSave || excelData.length === 0) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: excelData.length === 0 ? 0.6 : 1
                  }}
                >
                  <FileText size={16} />
                  Generar Oficios PDF y Guardar Resoluciones
                </button>
              )}
            </div>

          </div>

        </div>
      )}

      {/* PESTAÑA 3: HISTÓRICO Y CARGUE A ONBASE (CON CONSOLA EN VIVO) */}
      {activeTab === 'historico' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Tarjeta de Gestión de Credenciales de OnBase Web */}
          <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '18px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ShieldCheck size={28} color="#00324d" />
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '16px', fontWeight: '700' }}>
                  Credenciales de Autenticación OnBase Web
                </h3>
                <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '13px' }}>
                  Ingrese el Usuario y la Contraseña para iniciar sesión automáticamente en el cliente web.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                  Usuario OnBase:
                </label>
                <input 
                  type="text" 
                  value={onbaseUserCredential} 
                  onChange={(e) => setOnbaseUserCredential(e.target.value)}
                  placeholder="Ej. luepitar o JRROZO"
                  style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: '600', width: '180px', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                  Contraseña OnBase:
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type={showOnbasePassword ? "text" : "password"} 
                    value={onbasePasswordCredential} 
                    onChange={(e) => setOnbasePasswordCredential(e.target.value)}
                    placeholder="••••••••••••"
                    style={{ padding: '8px 36px 8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: '600', width: '180px', outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOnbasePassword(!showOnbasePassword)}
                    style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', padding: '4px' }}
                    title={showOnbasePassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showOnbasePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleSaveOnbaseCredentials}
                disabled={savingCredentials}
                style={{
                  background: '#00324d',
                  color: '#fff',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  marginTop: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <CheckCircle2 size={16} /> {savingCredentials ? 'Guardando...' : 'Guardar Credenciales'}
              </button>
            </div>
          </div>
          
          {/* Box Superior: Consola en Vivo OnBase Web y Flujo de Automatización */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#0f172a', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Monitor size={24} color="#00324d" />
                  Consola OnBase Web (En Vivo y en Directo)
                </h2>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
                  Visualización en tiempo real del navegador y ejecución de automatización programada.
                </p>
              </div>

              {/* Selector de Usuario OnBase por Defecto */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '8px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                    Usuario OnBase Sesión (Por Defecto)
                  </div>
                  <select 
                    value={selectedOnbaseUser}
                    onChange={(e) => handleSelectOnbaseUser(e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: '13px',
                      fontWeight: '700',
                      color: '#00324d',
                      cursor: 'pointer',
                      outline: 'none',
                      maxWidth: '320px'
                    }}
                  >
                    {onbaseUsers.map((u, i) => (
                      <option key={u.id || u.username || i} value={u.username || u.full_name}>
                        {u.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '6px', fontWeight: '600' }}>
                  ✓ Guardado por defecto
                </span>
              </div>
            </div>

            {/* Grid 2 Columnas: Monitor Vivo vs Flujo de Pasos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
              
              {/* Columna Izquierda: Monitor Consola OnBase Web */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={16} color="#39a900" /> Pantalla en Vivo de OnBase Web
                  </h3>
                  {liveFrame && (
                    <button 
                      onClick={() => setIsMonitorExpanded(true)}
                      style={{ background: '#e0f2fe', color: '#0284c7', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Maximize2 size={14} /> Ampliar Pantalla
                    </button>
                  )}
                </div>

                {/* Frame de Pantalla Live Stream Optimizado */}
                <OnBaseLiveFrame 
                  liveFrame={liveFrame} 
                  onExpand={() => setIsMonitorExpanded(true)} 
                  selectedUser={selectedOnbaseUser} 
                  automationLoading={automationLoading} 
                />

                {/* Controles de Ejecución */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button 
                    onClick={() => handleStartOnBaseLiveSession(null, null)}
                    disabled={automationLoading}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #00324d 0%, #39a900 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: automationLoading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 10px rgba(0,50,77,0.2)'
                    }}
                    title="Ejecuta la automatización completa: abre OnBase, diligencia destinatario, asuntos, texto, adjunta resolución, copias CC y presiona Enviar"
                  >
                    <Play size={18} />
                    {automationLoading ? 'Ejecutando en OnBase Web...' : `Ejecutar Cargue Automático Completo (Pasos 1 a 4)`}
                  </button>

                  <button 
                    onClick={() => handleStartOnBaseLiveSession(null, 3)}
                    disabled={automationLoading}
                    style={{
                      background: '#f8fafc',
                      color: '#00324d',
                      border: '1px solid #cbd5e1',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: automationLoading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Abre OnBase Web hasta el Paso 3 para dejar el formulario en blanco listo para revisión"
                  >
                    Abrir hasta Paso 3
                  </button>

                  {(automationLoading || botHasBrowserOpen) && (
                    <button 
                      onClick={handleStopDesercionesBot}
                      style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '12px 16px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      title="Detiene inmediatamente el Robot de Deserciones en el servidor y cierra su sesión OnBase (sin afectar Cargue AES)"
                    >
                      <Square size={16} /> Detener Robot
                    </button>
                  )}
                </div>
              </div>

              {/* Columna Derecha: Flujo de Pasos Programados hasta el Paso 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                  <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#0f172a', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={18} color="#00324d" />
                    Flujo de Automatización (Programado hasta Paso 3)
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {automationSteps.map((step, idx) => {
                      const isDone = currentStepIndex > idx || (!automationLoading && currentStepIndex === 3);
                      const isCurrent = currentStepIndex === idx && automationLoading;

                      return (
                        <div key={step.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: isDone ? '#39a900' : isCurrent ? '#00324d' : '#cbd5e1',
                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, fontWeight: '700', fontSize: '12px'
                          }}>
                            {isDone ? <CheckCircle size={16} /> : isCurrent ? <RefreshCw size={14} className="spin" /> : step.id}
                          </div>
                          <div>
                            <strong style={{ fontSize: '13px', color: isDone ? '#15803d' : isCurrent ? '#00324d' : '#475569', display: 'block' }}>
                              {step.label}
                            </strong>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>{step.desc}</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Placeholder para los siguientes pasos */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', opacity: 0.6, paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: '700', fontSize: '12px' }}>
                        4+
                      </div>
                      <div>
                        <strong style={{ fontSize: '13px', color: '#64748b', display: 'block' }}>
                          Pasos Siguientes (Diligenciamiento de campos de comunicación)
                        </strong>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>El robot abre "UForm Comunicación Electrónica" en el Paso 3 listo para diligenciar campos.</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Consola de Logs en Tiempo Real */}
                <div style={{ background: '#0f172a', borderRadius: '10px', padding: '12px', color: '#22c55e', fontFamily: 'monospace', fontSize: '11px', height: '170px', overflowY: 'auto' }}>
                  <div style={{ color: '#94a3b8', borderBottom: '1px solid #334155', paddingBottom: '4px', marginBottom: '8px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Terminal size={14} /> Registro Robot Independiente Deserciones
                    </span>
                    {botProgress.total > 0 && (
                      <span style={{ color: '#38bdf8', fontSize: '10px' }}>
                        Progreso: {botProgress.processed}/{botProgress.total} (✓ {botProgress.success} | ✕ {botProgress.errors})
                      </span>
                    )}
                  </div>
                  {logs.length > 0 ? (
                    logs.map((lg, i) => <div key={i} style={{ marginBottom: '3px' }}>&gt; {lg}</div>)
                  ) : (
                    <div style={{ color: '#64748b' }}>Consola lista. Esperando inicio de sesión...</div>
                  )}
                  {automationLoading && <div style={{ color: '#38bdf8' }}>&gt; Ejecutando en OnBase Web... _</div>}
                </div>
              </div>

            </div>

          </div>

          {/* Panel de Extracción de Radicados desde Correo (leparadam@sena.edu.co -> Producidas) y Exportación Excel por Carga Masiva */}
          <div style={{
            background: 'linear-gradient(135deg, #00324d 0%, #0f172a 100%)',
            borderRadius: '14px',
            padding: '20px 24px',
            marginBottom: '22px',
            color: '#fff',
            boxShadow: '0 8px 20px rgba(0,50,77,0.18)',
            border: '1px solid #1e3a8a'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ flex: '1 1 380px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <Mail size={22} color="#4ade80" />
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#fff' }}>
                    Descarga de Radicados y Fechas de Notificación (Buzón leparadam@sena.edu.co — Carpeta "Producidas")
                  </h3>
                </div>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.45' }}>
                  Extrae automáticamente el <strong>Radicado OnBase (CPE No. 68-9-2026-...)</strong>, <strong>N.I.S.</strong> y <strong>Fecha/Hora de Radicación</strong> de la carpeta <strong>Producidas</strong>, actualiza la base de datos y exporta el <strong>mismo Excel original de cada carga masiva</strong> con sus radicados.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Selector de Lote de Carga Masiva */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>
                    📦 Carga Masiva de Excel (Lote):
                  </label>
                  <select
                    value={selectedLoteId}
                    onChange={(e) => setSelectedLoteId(e.target.value)}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #38bdf8',
                      background: '#0f172a',
                      color: '#f8fafc',
                      fontSize: '12px',
                      fontWeight: '700',
                      minWidth: '280px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="Todos">📋 Todos los Lotes ({historico.length} registros)</option>
                    {lotes.map(l => (
                      <option key={`${l.lote_id}_${l.etapa}`} value={l.lote_id}>
                        📄 {l.archivo_excel} ({l.etapa === 'CITACION_COMITE' ? 'Citación' : l.etapa === 'NOTIFICACION_APRENDIZ' ? 'Notif. Aprendiz' : 'Resolución'}) — {l.con_radicado}/{l.total_casos} con Radicado
                      </option>
                    ))}
                  </select>
                </div>

                {/* Botón 1: Sincronizar Radicados desde Correo Producidas */}
                <button
                  onClick={() => setShowEmailSyncModal(true)}
                  style={{
                    background: 'linear-gradient(135deg, #39a900 0%, #15803d 100%)',
                    color: '#fff',
                    border: '1px solid #86efac',
                    padding: '11px 18px',
                    borderRadius: '10px',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(57,169,0,0.35)',
                    marginTop: '16px'
                  }}
                >
                  <Mail size={16} />
                  {emailSyncRunning ? '🔄 Sincronizando Correo Producidas...' : '📩 1. Extraer Radicados y Fechas del Correo'}
                </button>

                {/* Botón 2: Exportar el mismo Excel subido con los Radicados y Fechas */}
                <button
                  onClick={() => handleExportarExcelLote(selectedLoteId !== 'Todos' ? selectedLoteId : 'ULTIMO', 'original_completo')}
                  style={{
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#fff',
                    border: '1px solid #7dd3fc',
                    padding: '11px 18px',
                    borderRadius: '10px',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(2,132,199,0.35)',
                    marginTop: '16px'
                  }}
                  title="Descarga el mismo archivo Excel que se subió en la carga masiva pero con las columnas RADICADO, N.I.S. y FECHA RADICADO diligenciadas"
                >
                  <FileSpreadsheet size={16} />
                  📥 2. Descargar Excel de la Carga Masiva (con Radicados)
                </button>
              </div>
            </div>
          </div>

          {/* Tabla de Histórico de Comunicaciones */}
          {(() => {
            const isCasoTi = (c) => ['TI', 'T.I.', 'TARJETA DE IDENTIDAD'].includes(String(c.aprendiz_doc_tipo || c.raw_row?.['TIPO'] || c.raw_row?.['TIPO_DOC'] || '').trim().toUpperCase());
            const hasCasoAcudiente = (c) => {
              if (String(c.acudiente_correo || '').trim()) return true;
              try {
                const ccList = typeof c.copy_emails === 'string' ? JSON.parse(c.copy_emails) : c.copy_emails;
                return Array.isArray(ccList) && ccList.some(item => item && item.is_acudiente && item.email);
              } catch (e) {
                return false;
              }
            };

            const loteBase = selectedLoteId === 'Todos'
              ? historico
              : historico.filter(c => c.lote_id === selectedLoteId);
            const countPendientes = loteBase.filter(c => c.status === 'Pendiente').length;
            const countCargados = loteBase.filter(c => c.status === 'Cargado').length;
            const countErrores = loteBase.filter(c => c.status === 'Error').length;
            const countTodos = loteBase.length;
            const qTerm = historicoSearch.trim().toLowerCase();

            const statusFilteredBase = loteBase.filter(caso => {
              if (statusFilter === 'Pendiente' && caso.status !== 'Pendiente') return false;
              if (statusFilter === 'Cargado' && caso.status !== 'Cargado') return false;
              if (statusFilter === 'Error' && caso.status !== 'Error') return false;
              return true;
            });

            const countHistTi = statusFilteredBase.filter(isCasoTi).length;
            const countHistMayores = statusFilteredBase.length - countHistTi;
            const countHistTiSinAcudiente = statusFilteredBase.filter(c => isCasoTi(c) && !hasCasoAcudiente(c)).length;

            const filteredHistorico = statusFilteredBase.filter(caso => {
              if (historicoDocTypeFilter === 'TI' && !isCasoTi(caso)) return false;
              if (historicoDocTypeFilter === 'MAYORES' && isCasoTi(caso)) return false;
              if (historicoDocTypeFilter === 'TI_SIN_ACUDIENTE' && (!isCasoTi(caso) || hasCasoAcudiente(caso))) return false;
              if (qTerm) {
                const hay = `${caso.aprendiz_nombre || ''} ${caso.aprendiz_doc_tipo || ''} ${caso.aprendiz_doc_numero || ''} ${caso.ficha || ''} ${caso.aprendiz_correo || ''} ${caso.acudiente_nombre || ''} ${caso.acudiente_correo || ''} ${caso.resolucion || ''} ${caso.radicado || ''} ${caso.nis || ''} ${caso.fecha_radicado || ''} ${caso.descripcion_asunto || ''}`.toLowerCase();
                if (!hay.includes(qTerm)) return false;
              }
              return true;
            });

            const selectedCount = Object.keys(selectedHistoricoRows).filter(id => selectedHistoricoRows[id]).length;

            return (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px' }}>Histórico de Comunicaciones Registradas</h3>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
                  Gestione y cargue las comunicaciones procesadas. Por defecto se muestran los casos pendientes.
                </p>
              </div>

              {/* Selector de Pestañas / Filtro por Estado */}
              <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', gap: '4px' }}>
                <button
                  onClick={() => setStatusFilter('Pendiente')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: statusFilter === 'Pendiente' ? '#00324d' : 'transparent',
                    color: statusFilter === 'Pendiente' ? '#ffffff' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  <Clock size={14} /> Pendientes ({countPendientes})
                </button>

                <button
                  onClick={() => setStatusFilter('Cargado')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: statusFilter === 'Cargado' ? '#15803d' : 'transparent',
                    color: statusFilter === 'Cargado' ? '#ffffff' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  <CheckCircle2 size={14} /> Ya Cargados ({countCargados})
                </button>

                <button
                  onClick={() => setStatusFilter('Error')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: statusFilter === 'Error' ? '#dc2626' : 'transparent',
                    color: statusFilter === 'Error' ? '#ffffff' : (countErrores > 0 ? '#dc2626' : '#475569'),
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  <AlertCircle size={14} /> Con Error ({countErrores})
                </button>

                <button
                  onClick={() => setStatusFilter('Todos')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: statusFilter === 'Todos' ? '#475569' : 'transparent',
                    color: statusFilter === 'Todos' ? '#ffffff' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  <FileText size={14} /> Todos ({countTodos})
                </button>
              </div>

              {/* Buscador rápido en Histórico */}
              <input
                type="text"
                value={historicoSearch}
                onChange={(e) => setHistoricoSearch(e.target.value)}
                placeholder="Buscar cédula, T.I., aprendiz, ficha, acudiente..."
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  minWidth: '240px'
                }}
              />
            </div>

            {/* Barra de Filtro Rápido por Tipo de Documento (T.I. Menor de Edad vs Mayores CC/PPT) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              marginBottom: '18px',
              background: '#f8fafc',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#334155', marginRight: '4px' }}>
                  🔎 Filtrar Tipo Doc:
                </span>
                <button
                  type="button"
                  onClick={() => setHistoricoDocTypeFilter('Todos')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: historicoDocTypeFilter === 'Todos' ? '1.5px solid #00324d' : '1px solid #cbd5e1',
                    background: historicoDocTypeFilter === 'Todos' ? '#00324d' : '#fff',
                    color: historicoDocTypeFilter === 'Todos' ? '#fff' : '#475569',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Todos ({statusFilteredBase.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoricoDocTypeFilter('TI')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: historicoDocTypeFilter === 'TI' ? '1.5px solid #6d28d9' : '1px solid #d8b4fe',
                    background: historicoDocTypeFilter === 'TI' ? '#6d28d9' : '#f5f3ff',
                    color: historicoDocTypeFilter === 'TI' ? '#fff' : '#5b21b6',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  👦 Solo T.I. Menores ({countHistTi})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoricoDocTypeFilter('MAYORES')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: historicoDocTypeFilter === 'MAYORES' ? '1.5px solid #0369a1' : '1px solid #bae6fd',
                    background: historicoDocTypeFilter === 'MAYORES' ? '#0369a1' : '#f0f9ff',
                    color: historicoDocTypeFilter === 'MAYORES' ? '#fff' : '#0369a1',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  🧑 Mayores CC / PPT ({countHistMayores})
                </button>
                {countHistTiSinAcudiente > 0 && (
                  <button
                    type="button"
                    onClick={() => setHistoricoDocTypeFilter('TI_SIN_ACUDIENTE')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: historicoDocTypeFilter === 'TI_SIN_ACUDIENTE' ? '1.5px solid #b45309' : '1px solid #fcd34d',
                      background: historicoDocTypeFilter === 'TI_SIN_ACUDIENTE' ? '#d97706' : '#fffbeb',
                      color: historicoDocTypeFilter === 'TI_SIN_ACUDIENTE' ? '#fff' : '#b45309',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    ⚠️ T.I. sin Correo Acudiente ({countHistTiSinAcudiente})
                  </button>
                )}
                {countHistTi > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const onlyTiMap = {};
                      statusFilteredBase.forEach(c => {
                        if (isCasoTi(c)) onlyTiMap[c.id] = true;
                      });
                      setSelectedHistoricoRows(onlyTiMap);
                      setHistoricoDocTypeFilter('TI');
                    }}
                    style={{
                      background: '#ede9fe',
                      color: '#5b21b6',
                      border: '1px solid #c4b5fd',
                      padding: '6px 10px',
                      borderRadius: '7px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      marginLeft: '4px'
                    }}
                    title="Selecciona únicamente los aprendices con Tarjeta de Identidad (TI) para enviarlos o gestionarlos"
                  >
                    ☑️ Seleccionar solo los T.I. ({countHistTi})
                  </button>
                )}
              </div>

              {/* Botones de Acción Global */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {selectedCount > 0 && (
                  <>
                    <button 
                      onClick={() => {
                        const selectedIds = Object.keys(selectedHistoricoRows).filter(id => selectedHistoricoRows[id]).map(id => parseInt(id, 10));
                        handleStartOnBaseLiveSession(selectedIds, null);
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #00324d 0%, #39a900 100%)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '9px 14px',
                        borderRadius: '8px',
                        fontWeight: '700',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 6px rgba(0,50,77,0.2)'
                      }}
                      title="Cargar los casos seleccionados automáticamente en OnBase Web"
                    >
                      <Play size={14} /> Cargar ({selectedCount}) a OnBase
                    </button>

                    <button 
                      onClick={() => handleMarcarCargados()}
                      style={{
                        background: '#dcfce7',
                        color: '#15803d',
                        border: '1px solid #86efac',
                        padding: '9px 14px',
                        borderRadius: '8px',
                        fontWeight: '700',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      title="Marcar los casos seleccionados como Ya Cargados (sacándolos de Pendientes)"
                    >
                      <CheckCircle2 size={14} /> Marcar ({selectedCount}) como Cargados
                    </button>

                    <button 
                      onClick={handleEliminarCasos}
                      style={{
                        background: '#fee2e2',
                        color: '#b91c1c',
                        border: '1px solid #fca5a5',
                        padding: '9px 14px',
                        borderRadius: '8px',
                        fontWeight: '700',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      title="Eliminar casos seleccionados de la base de datos"
                    >
                      <Trash2 size={14} /> Eliminar ({selectedCount})
                    </button>
                  </>
                )}

                {countErrores > 0 && (
                  <button
                    onClick={() => handleStartOnBaseLiveSession(null, { retry_errors: true })}
                    disabled={automationLoading}
                    style={{
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fca5a5',
                      padding: '9px 14px',
                      borderRadius: '8px',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: automationLoading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Reintentar automáticamente en OnBase todos los casos que quedaron con estado Error"
                  >
                    <RefreshCw size={14} /> Reintentar Fallidos ({countErrores})
                  </button>
                )}

                {historico.length > 0 && (
                  <button
                    onClick={handleExportarReporteExcel}
                    style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      padding: '9px 14px',
                      borderRadius: '8px',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Descargar Acta Excel de Evidencia de Notificaciones (con estado, fecha de envío, Radicado/NIS y anexos)"
                  >
                    <Download size={14} /> Exportar Acta Excel
                  </button>
                )}

                {countCargados > 0 && (
                  <button
                    onClick={() => handleVincularHistorias()}
                    disabled={linkingHistorias}
                    style={{
                      background: '#f0fdf4',
                      color: '#166534',
                      border: '1px solid #86efac',
                      padding: '9px 14px',
                      borderRadius: '8px',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: linkingHistorias ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Indexar automáticamente los PDFs de casos cargados dentro del expediente de Historia Académica (68.9224.4-37) del aprendiz para Cargue AES"
                  >
                    <UserCheck size={14} /> {linkingHistorias ? 'Vinculando...' : 'Vincular a Historias Acad.'}
                  </button>
                )}

                {historico.length > 0 && (
                  <button 
                    onClick={handleLimpiarCasos}
                    style={{
                      background: '#f8fafc',
                      color: '#64748b',
                      border: '1px solid #cbd5e1',
                      padding: '9px 14px',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Vaciar todo el histórico de casos"
                  >
                    <Trash2 size={14} /> Limpiar Histórico
                  </button>
                )}
              </div>
            </div>

            {loadingHistorico ? (
              <div style={{ padding: '40px', textIndent: 'center', textAlign: 'center', color: '#64748b' }}>
                Cargando historial de correspondencia...
              </div>
            ) : filteredHistorico.length === 0 ? (
              <div style={{ padding: '50px 20px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                <CheckCircle2 size={36} color="#22c55e" style={{ margin: '0 auto 10px', display: 'block' }} />
                <p style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>
                  {statusFilter === 'Pendiente' 
                    ? '¡No hay casos pendientes en este momento!' 
                    : statusFilter === 'Cargado' 
                    ? 'No hay casos marcados como cargados.' 
                    : 'No hay casos registrados en el módulo.'}
                </p>
                <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  {statusFilter === 'Pendiente' 
                    ? 'Todas las comunicaciones preparadas ya fueron cargadas y procesadas.' 
                    : 'Puede generar nuevas comunicaciones o cambiar de filtro arriba.'}
                </p>
                {statusFilter === 'Pendiente' && countCargados > 0 && (
                  <button
                    onClick={() => setStatusFilter('Cargado')}
                    style={{
                      marginTop: '14px',
                      background: '#e0f2fe',
                      color: '#0369a1',
                      border: '1px solid #bae6fd',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Ver los {countCargados} casos ya cargados
                  </button>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', textTransform: 'uppercase', fontSize: '11px', color: '#475569' }}>
                      <th style={{ padding: '12px', textAlign: 'center', width: '40px' }}>
                        <input 
                          type="checkbox"
                          checked={filteredHistorico.length > 0 && filteredHistorico.every(c => selectedHistoricoRows[c.id])}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            const newSel = { ...selectedHistoricoRows };
                            filteredHistorico.forEach(c => { newSel[c.id] = isChecked; });
                            setSelectedHistoricoRows(newSel);
                          }}
                          style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                          title="Seleccionar / deseleccionar todos los casos visibles"
                        />
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>ID / Fecha</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Etapa</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Aprendiz</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Ficha</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Usuario OnBase</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Correos CC</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Carta PDF</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Anexo Explícito</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Estado</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Acciones Cargue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistorico.map(caso => {
                      const emailSofia = caso.aprendiz_correo || caso.raw_row?.['CORREO REGISTRADO EN SOFÍA'] || caso.raw_row?.['CORREO REGISTRADO EN SOFIA'] || caso.raw_row?.['CORREO'] || 'correo@sena.edu.co';
                      
                      let parsedCc = [];
                      if (caso.copy_emails) {
                        try {
                          parsedCc = typeof caso.copy_emails === 'string' ? JSON.parse(caso.copy_emails) : caso.copy_emails;
                        } catch (e) {}
                      }

                      return (
                        <tr key={caso.id} style={{ borderBottom: '1px solid #e2e8f0', background: selectedHistoricoRows[caso.id] ? '#f0fdf4' : 'transparent' }}>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <input 
                              type="checkbox"
                              checked={!!selectedHistoricoRows[caso.id]}
                              onChange={(e) => {
                                setSelectedHistoricoRows(prev => ({
                                  ...prev,
                                  [caso.id]: e.target.checked
                                }));
                              }}
                              style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                            />
                          </td>
                          <td style={{ padding: '12px', fontWeight: '600' }}>
                            #{caso.id}<br/>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>{new Date(caso.created_at).toLocaleDateString('es-CO')}</span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: caso.etapa === 'CITACION_COMITE' ? '#e0f2fe' : caso.etapa === 'NOTIFICACION_APRENDIZ' ? '#dcfce7' : '#fef3c7',
                              color: caso.etapa === 'CITACION_COMITE' ? '#0369a1' : caso.etapa === 'NOTIFICACION_APRENDIZ' ? '#15803d' : '#b45309'
                            }}>
                              {caso.etapa === 'CITACION_COMITE' ? 'Citación Comité' : caso.etapa === 'NOTIFICACION_APRENDIZ' ? 'Notificación Aprendiz' : 'Notif. Resolución'}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <strong style={{ color: '#0f172a' }}>{caso.aprendiz_nombre}</strong><br/>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              color: String(caso.aprendiz_doc_tipo || '').toUpperCase() === 'TI' ? '#6d28d9' : '#64748b',
                              background: String(caso.aprendiz_doc_tipo || '').toUpperCase() === 'TI' ? '#f3e8ff' : 'transparent',
                              padding: String(caso.aprendiz_doc_tipo || '').toUpperCase() === 'TI' ? '1px 6px' : '0',
                              borderRadius: '4px'
                            }}>
                              {String(caso.aprendiz_doc_tipo || '').toUpperCase() === 'TI' ? '👦 TI (Menor)' : caso.aprendiz_doc_tipo} {caso.aprendiz_doc_numero}
                            </span><br/>
                            <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: '600' }}>📧 {emailSofia}</span>
                          </td>
                          <td style={{ padding: '12px', fontWeight: '600' }}>{caso.ficha}</td>
                          <td style={{ padding: '12px' }}>{caso.onbase_target_user || selectedOnbaseUser}</td>
                          <td style={{ padding: '12px', minWidth: '230px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              {/* Botón y Editor Rápido de Acudiente Independiente por Aprendiz */}
                              {editingAcudienteCasoId === caso.id ? (
                                <div style={{ background: '#f5f3ff', border: '1.5px solid #8b5cf6', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#5b21b6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>👨‍👩‍👦 Acudiente de este Aprendiz</span>
                                    <select
                                      value={editAcudienteDocTipo}
                                      onChange={(e) => setEditAcudienteDocTipo(e.target.value)}
                                      style={{ fontSize: '10px', padding: '2px 4px', borderRadius: '4px', border: '1px solid #c4b5fd', fontWeight: '700', color: '#5b21b6' }}
                                    >
                                      <option value="TI">👦 TI (Menor)</option>
                                      <option value="CC">🧑 CC (Mayor)</option>
                                      <option value="PPT">🧑 PPT</option>
                                    </select>
                                  </div>
                                  <input
                                    type="text"
                                    value={editAcudienteNombre}
                                    onChange={(e) => setEditAcudienteNombre(e.target.value)}
                                    placeholder="Nombre del Acudiente / Padre..."
                                    style={{ width: '100%', padding: '4px 7px', fontSize: '11px', borderRadius: '5px', border: '1px solid #c4b5fd', boxSizing: 'border-box' }}
                                  />
                                  <input
                                    type="email"
                                    value={editAcudienteCorreo}
                                    onChange={(e) => setEditAcudienteCorreo(e.target.value)}
                                    placeholder="Correo del Acudiente (ej. acudiente@gmail.com)"
                                    style={{ width: '100%', padding: '4px 7px', fontSize: '11px', borderRadius: '5px', border: '1px solid #c4b5fd', boxSizing: 'border-box' }}
                                  />
                                  <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end', marginTop: '2px' }}>
                                    <button
                                      type="button"
                                      onClick={() => setEditingAcudienteCasoId(null)}
                                      style={{ background: '#fff', color: '#64748b', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      disabled={savingAcudienteId === caso.id}
                                      onClick={() => handleSaveCasoAcudiente(caso.id)}
                                      style={{ background: '#6d28d9', color: '#fff', border: 'none', padding: '3px 10px', borderRadius: '5px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                      {savingAcudienteId === caso.id ? 'Guardando...' : '💾 Guardar Acudiente'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const existingAcCc = Array.isArray(parsedCc) ? parsedCc.find(c => c && c.is_acudiente) : null;
                                    setEditingAcudienteCasoId(caso.id);
                                    setEditAcudienteNombre(caso.acudiente_nombre || existingAcCc?.name || '');
                                    setEditAcudienteCorreo(caso.acudiente_correo || existingAcCc?.email || '');
                                    setEditAcudienteDocTipo(caso.aprendiz_doc_tipo || 'TI');
                                  }}
                                  style={{
                                    background: (caso.acudiente_correo || (Array.isArray(parsedCc) && parsedCc.some(c => c?.is_acudiente))) ? '#f3e8ff' : '#f8fafc',
                                    color: '#6d28d9',
                                    border: '1px dashed #c4b5fd',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '10.5px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                  }}
                                  title="Agregar o editar el correo del Acudiente exclusivamente para este aprendiz"
                                >
                                  <span>
                                    👨‍👩‍👦 {(caso.acudiente_correo || (Array.isArray(parsedCc) && parsedCc.some(c => c?.is_acudiente))) ? 'Editar Acudiente (Copia activa)' : '+ Agregar Correo Acudiente'}
                                  </span>
                                  <span>✏️</span>
                                </button>
                              )}

                              {!Array.isArray(parsedCc) || parsedCc.length === 0 ? (
                                <span style={{ color: '#94a3b8', fontSize: '11px' }}>Sin CC</span>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {parsedCc.map((cc, i) => (
                                    <div key={i} style={{
                                      fontSize: '11px',
                                      background: cc.is_acudiente ? '#f5f3ff' : '#f8fafc',
                                      border: `1px solid ${cc.is_acudiente ? '#c4b5fd' : '#e2e8f0'}`,
                                      padding: '4px 8px',
                                      borderRadius: '6px'
                                    }}>
                                      <div style={{ fontWeight: '700', color: cc.is_acudiente ? '#5b21b6' : '#0f172a' }}>
                                        {cc.is_acudiente ? '👨‍👩‍👦 ' : '👤 '}{cc.name || 'Destinatario CC'}
                                      </div>
                                      <div style={{ color: cc.is_acudiente ? '#6d28d9' : '#0284c7', fontSize: '10px', fontWeight: cc.is_acudiente ? '700' : '400' }}>
                                        📧 {cc.email}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                              <button
                                onClick={() => {
                                  setPreviewItem(caso);
                                  setPreviewText(caso.texto_combinado || caso.texto_inicial || '');
                                  setShowPreviewModal(true);
                                }}
                                style={{
                                  background: '#e0f2fe',
                                  color: '#0369a1',
                                  border: '1px solid #bae6fd',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                title="Ver texto completo de la Carta / Oficio"
                              >
                                <Eye size={12} /> Ver Carta
                              </button>
                              {caso.etapa !== 'CITACION_COMITE' && caso.comunicacion_pdf_path && (
                                <a
                                  href={`/${caso.comunicacion_pdf_path.replace(/\\/g, '/')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: '#39a900',
                                    fontWeight: '700',
                                    fontSize: '11px',
                                    textDecoration: 'none'
                                  }}
                                >
                                  📄 Abrir PDF
                                </a>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            {caso.etapa === 'CITACION_COMITE' ? (
                              <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '600' }}>No aplica (Citación)</span>
                            ) : caso.anexo_path ? (
                              <a
                                href={`/${caso.anexo_path.replace(/\\/g, '/')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  background: '#f0fdf4',
                                  color: '#166534',
                                  border: '1px solid #bbf7d0',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Paperclip size={12} /> Ver Resol. PDF
                              </a>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '11px' }}>Sin anexo</span>
                            )}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '700',
                                background: caso.status === 'Cargado' ? '#dcfce7' : caso.status === 'Error' ? '#fee2e2' : '#f3f4f6',
                                color: caso.status === 'Cargado' ? '#15803d' : caso.status === 'Error' ? '#dc2626' : '#4b5563'
                              }}>
                                {caso.status}
                              </span>
                              {(caso.radicado || caso.nis || caso.fecha_radicado) && (
                                <div style={{
                                  background: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: '8px',
                                  padding: '5px 8px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                  textAlign: 'left',
                                  width: '100%'
                                }}>
                                  {caso.radicado && (
                                    <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: '800' }}>
                                      📌 Rad: {caso.radicado}
                                    </div>
                                  )}
                                  {caso.nis && (
                                    <div style={{ fontSize: '10px', color: '#334155', fontWeight: '600' }}>
                                      🔢 NIS: {caso.nis}
                                    </div>
                                  )}
                                  {caso.fecha_radicado && (
                                    <div style={{ fontSize: '10px', color: '#15803d', fontWeight: '700' }}>
                                      📅 {caso.fecha_radicado}
                                    </div>
                                  )}
                                </div>
                              )}
                              {caso.enviado_at && (
                                <span style={{ fontSize: '10px', color: '#64748b' }}>
                                  {new Date(caso.enviado_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              )}
                              {caso.historia_doc_id && (
                                <span style={{ fontSize: '10px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '1px 6px', fontWeight: '700' }}>
                                  ✓ En Historia Acad.
                                </span>
                              )}
                              {caso.status === 'Error' && caso.error_message && (
                                <div style={{ fontSize: '10px', color: '#b91c1c', maxWidth: '170px', lineHeight: '1.25' }} title={caso.error_message}>
                                  {caso.error_message.length > 65 ? caso.error_message.substring(0, 65) + '...' : caso.error_message}
                                </div>
                              )}
                              {caso.error_screenshot && (
                                <a
                                  href={caso.error_screenshot}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontSize: '10px', color: '#dc2626', fontWeight: '700', textDecoration: 'underline' }}
                                >
                                  📸 Ver Captura Error
                                </a>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                              <button 
                                onClick={() => handleStartOnBaseLiveSession([caso.id], null)}
                                style={{
                                  background: '#39a900',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  width: '100%',
                                  justifyContent: 'center',
                                  boxShadow: '0 2px 4px rgba(57,169,0,0.2)'
                                }}
                                title="Ejecutar cargue automático en OnBase Web para este caso especifico"
                              >
                                <Play size={12} /> Cargar OnBase
                              </button>

                              <button 
                                onClick={() => handleStartOnBaseLiveSession([caso.id], { solo_diligenciar: true })}
                                style={{
                                  background: '#0284c7',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  width: '100%',
                                  justifyContent: 'center'
                                }}
                                title="Llenar todo el formulario en OnBase Web y detenerse en pantalla para inspeccionar sin dar clic en Enviar"
                              >
                                <Eye size={11} /> Diligenciar (Sin Enviar)
                              </button>

                              <button 
                                onClick={() => {
                                  setDetailCaso(caso);
                                  setShowDetailModal(true);
                                }}
                                style={{
                                  background: '#f1f5f9',
                                  color: '#475569',
                                  border: '1px solid #cbd5e1',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '10px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  width: '100%',
                                  justifyContent: 'center'
                                }}
                                title="Ver todos los campos del formulario OnBase Web mapeados para este registro"
                              >
                                <FileText size={11} /> Detalle Formulario
                              </button>

                              {(caso.status === 'Pendiente' || caso.status === 'Error') ? (
                                <button
                                  onClick={() => handleMarcarCargados([caso.id])}
                                  style={{
                                    background: '#f0fdf4',
                                    color: '#15803d',
                                    border: '1px solid #bbf7d0',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    width: '100%',
                                    justifyContent: 'center'
                                  }}
                                  title="Marcar este caso como Ya Cargado para sacarlo de la bandeja de pendientes"
                                >
                                  <CheckCircle2 size={11} /> Marcar Cargado
                                </button>
                              ) : (
                                <span style={{ fontSize: '10px', color: '#15803d', fontWeight: '600' }}>
                                  ✓ Procesado
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          );
        })()}

        </div>
      )}

      {/* Modal Pantalla Ampliada Consola OnBase Web */}
      {isMonitorExpanded && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '24px'
        }}>
          <div style={{ width: '90%', maxWidth: '1200px', background: '#0f172a', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            <div style={{ background: '#00324d', color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Monitor size={18} color="#39a900" />
                Consola OnBase Web (Transmisión Ampliada en Vivo)
              </h3>
              <button 
                onClick={() => setIsMonitorExpanded(false)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>
            <div style={{ padding: '20px', textAlign: 'center' }}>
              {liveFrame ? (
                <img src={liveFrame} alt="Fullscreen OnBase Web" style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', border: '1px solid #334155' }} />
              ) : (
                <div style={{ padding: '60px', color: '#94a3b8' }}>Sin transmisión en vivo en este momento.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Vista Previa de Carta */}
      {showPreviewModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            maxWidth: '750px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '32px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#00324d', borderBottom: '2px solid #39a900', paddingBottom: '10px' }}>
              Vista Previa de Comunicación Combinada
            </h3>
            
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '14px', marginBottom: '24px' }}>
              {previewText}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {previewItem && previewItem.comunicacion_pdf_path ? (
                <a
                  href={`/${previewItem.comunicacion_pdf_path.replace(/\\/g, '/')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: '#39a900',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    textDecoration: 'none',
                    fontSize: '13px'
                  }}
                >
                  📄 Abrir / Descargar Carta PDF
                </a>
              ) : <div></div>}

              <button 
                onClick={() => setShowPreviewModal(false)}
                style={{
                  background: '#00324d',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cerrar Vista Previa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle Mapeo Formulario OnBase Web */}
      {showDetailModal && detailCaso && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            maxWidth: '850px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #39a900', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#00324d', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="#39a900" />
                Mapeo de Campos para Formulario OnBase Web (Caso #{detailCaso.id})
              </h3>
              <button 
                onClick={() => setShowDetailModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
              {/* Bloque Destinatario Externo */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#166534', fontSize: '14px' }}>🟢 Destinatario Externo</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <strong>Nombre Destinatario *:</strong>
                    <div style={{ background: '#fff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px' }}>
                      {detailCaso.aprendiz_nombre}
                    </div>
                  </div>
                  <div>
                    <strong>Email Destinatario *:</strong>
                    <div style={{ background: '#fff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px', color: '#0284c7', fontWeight: '600' }}>
                      {detailCaso.aprendiz_correo || detailCaso.raw_row?.['CORREO REGISTRADO EN SOFÍA'] || 'correo@sena.edu.co'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bloque Asunto */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#0f172a', fontSize: '14px' }}>🟢 Asunto y Descripción</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <strong>Asunto *:</strong>
                    <div style={{ background: '#fff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px' }}>
                      {detailCaso.asunto || 'NOVEDADES DE ALUMNOS'}
                    </div>
                  </div>
                  <div>
                    <strong>Descripción del Asunto *:</strong>
                    <div style={{ background: '#fff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px' }}>
                      {detailCaso.descripcion_asunto || 'Notificación'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bloque Anexo y Copias Externas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#0f172a', fontSize: '14px' }}>📎 Anexo Adjunto</h4>
                  <div>{detailCaso.anexo_path ? detailCaso.anexo_path : 'Sin anexo'}</div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#0f172a', fontSize: '14px' }}>📧 Copias Externas (CC)</h4>
                  {(() => {
                    let parsedCc = [];
                    if (detailCaso.copy_emails) {
                      try {
                        parsedCc = typeof detailCaso.copy_emails === 'string' ? JSON.parse(detailCaso.copy_emails) : detailCaso.copy_emails;
                      } catch (e) {}
                    }
                    if (!Array.isArray(parsedCc) || parsedCc.length === 0) return <div style={{ color: '#94a3b8' }}>Sin copias</div>;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {parsedCc.map((cc, i) => (
                          <div key={i} style={{ fontSize: '11px', background: '#fff', padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                            <strong>{cc.name}</strong> ({cc.email})
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Bloque Texto Combinado */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '14px' }}>📄 Cuerpo del Formulario (Texto Combinado)</h4>
                <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto' }}>
                  {detailCaso.texto_combinado || detailCaso.texto_inicial}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <button 
                onClick={() => {
                  setShowDetailModal(false);
                  handleStartOnBaseLiveSession([detailCaso.id], { solo_diligenciar: true });
                }}
                style={{
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Eye size={16} /> Previsualizar en OnBase Web (Sin Enviar)
              </button>

              <button 
                onClick={() => setShowDetailModal(false)}
                style={{
                  background: '#00324d',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Extracción de Radicados y Fechas desde Correo (leparadam@sena.edu.co -> Carpeta Producidas) */}
      {showEmailSyncModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.72)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2100,
          padding: '18px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            maxWidth: '1120px',
            width: '100%',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '24px 28px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #39a900', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#00324d', fontSize: '19px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Mail size={22} color="#39a900" />
                  Sincronizar Radicados y Fechas de Notificación desde Correo SENA (Carpeta "Producidas")
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#475569' }}>
                  Extrae de los correos de <strong>grupoadmondocumentos@sena.edu.co</strong> en <strong>leparadam@sena.edu.co</strong> la tabla oficial (<strong>Radicado | N.I.S. | Fecha</strong>), actualiza la base de datos y habilita la descarga del Excel idéntico al cargado.
                </p>
              </div>
              <button
                onClick={() => setShowEmailSyncModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Selector de Modo: Robot Outlook 365 vs Pegado Rápido */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                onClick={() => setEmailSyncTab('robot')}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer',
                  background: emailSyncTab === 'robot' ? '#00324d' : '#f1f5f9',
                  color: emailSyncTab === 'robot' ? '#fff' : '#475569'
                }}
              >
                🤖 1. Robot Automático Outlook 365 (leparadam@sena.edu.co → Carpeta Producidas)
              </button>
              <button
                onClick={() => setEmailSyncTab('manual')}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer',
                  background: emailSyncTab === 'manual' ? '#00324d' : '#f1f5f9',
                  color: emailSyncTab === 'manual' ? '#fff' : '#475569'
                }}
              >
                📋 2. Pegar Texto / Subir Correos (.eml / .htm)
              </button>
            </div>

            {emailSyncTab === 'robot' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Barra de configuración y botón de inicio */}
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                      Correo Institucional SENA:
                    </label>
                    <input
                      type="text"
                      value={emailSyncUser}
                      onChange={(e) => setEmailSyncUser(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600' }}
                    />
                  </div>
                  <div style={{ flex: '1 1 140px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                      Carpeta del Correo:
                    </label>
                    <input
                      type="text"
                      value={emailSyncFolder}
                      onChange={(e) => setEmailSyncFolder(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600' }}
                    />
                  </div>
                  <div style={{ flex: '1 1 190px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                      Contraseña Correo (Guardada en Servidor):
                    </label>
                    <input
                      type="password"
                      value={emailSyncPass}
                      onChange={(e) => setEmailSyncPass(e.target.value)}
                      placeholder="Ya guardada (opcional cambiar)"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {!emailSyncRunning ? (
                      <button
                        onClick={handleStartEmailSync}
                        style={{
                          background: '#39a900',
                          color: '#fff',
                          border: 'none',
                          padding: '10px 18px',
                          borderRadius: '8px',
                          fontWeight: '800',
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Play size={15} /> {emailSyncStateData.hasBrowserOpen ? '🔄 Escanear Carpeta Producidas Ahora' : '🚀 Abrir Mi Correo en Servidor y Descargar Radicados'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStopEmailSync(false)}
                        style={{
                          background: '#d97706',
                          color: '#fff',
                          border: 'none',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          fontWeight: '800',
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Square size={15} /> Pausar Escaneo (Dejar Correo Abierto)
                      </button>
                    )}

                    <button
                      onClick={() => handleExportarExcelLote(selectedLoteId !== 'Todos' ? selectedLoteId : 'ULTIMO', 'original_completo')}
                      style={{
                        background: '#0284c7',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        fontWeight: '800',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Download size={15} /> Exportar Excel con Radicados
                    </button>

                    {emailSyncStateData.hasBrowserOpen && (
                      <button
                        onClick={() => handleStopEmailSync(true)}
                        title="Reiniciar el navegador del correo en el servidor"
                        style={{
                          background: '#f1f5f9',
                          color: '#64748b',
                          border: '1px solid #cbd5e1',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          fontWeight: '700',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Reiniciar Navegador
                      </button>
                    )}
                  </div>
                </div>

                {/* Alerta de Autenticación / Número de Microsoft Authenticator (Sale de inmediato al omitir el PIN) */}
                {(emailSyncStateData.status === 'waiting_auth' || emailSyncStateData.mfaNumber || emailSyncStateData.authPrompt) && (
                  <div style={{
                    background: '#fffbeb',
                    border: '2px solid #f59e0b',
                    borderRadius: '10px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px'
                  }}>
                    <div style={{ flex: '1 1 340px' }}>
                      <div style={{ fontWeight: '800', color: '#b45309', fontSize: '14px', marginBottom: '4px' }}>
                        📲 Código de Autorización Microsoft 365 (Para dejar abierto su correo en el servidor)
                      </div>
                      <div style={{ fontSize: '13px', color: '#78350f', marginBottom: '8px' }}>
                        {emailSyncStateData.authPrompt || 'Apruebe el ingreso una sola vez para que su correo quede abierto permanentemente en el servidor.'}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleSwitchEmailAuthMethod('switch_mfa_push')}
                          style={{ background: '#00324d', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          📲 Ver Número en Authenticator
                        </button>
                        <button
                          onClick={() => handleSwitchEmailAuthMethod('switch_mfa_sms')}
                          style={{ background: '#0369a1', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          📱 Enviar Código por SMS (...16)
                        </button>
                        <button
                          onClick={() => handleSwitchEmailAuthMethod('switch_mfa_otp')}
                          style={{ background: '#475569', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          🔢 Usar Código de 6 Dígitos
                        </button>
                      </div>
                    </div>

                    {emailSyncStateData.mfaNumber && (
                      <div style={{
                        background: '#00324d',
                        color: '#4ade80',
                        fontSize: '34px',
                        fontWeight: '900',
                        padding: '10px 26px',
                        borderRadius: '12px',
                        letterSpacing: '3px',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.28)',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '10px', color: '#e2e8f0', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '2px' }}>
                          MARQUE EN SU CELULAR:
                        </div>
                        #{emailSyncStateData.mfaNumber}
                      </div>
                    )}
                  </div>
                )}

                {/* Resumen de Contadores en Tiempo Real */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>CORREOS ESCANEADOS</div>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>{emailSyncStateData.stats?.emailsScanned || 0}</div>
                  </div>
                  <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: '700' }}>CPE ENCONTRADOS</div>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: '#0284c7' }}>{emailSyncStateData.stats?.cpeFound || 0}</div>
                  </div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#166534', fontWeight: '700' }}>NUEVOS ACTUALIZADOS EN BD</div>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: '#15803d' }}>{emailSyncStateData.stats?.matchedUpdated || 0}</div>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#475569', fontWeight: '700' }}>YA TENÍAN RADICADO</div>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: '#334155' }}>{emailSyncStateData.stats?.alreadyUpdated || 0}</div>
                  </div>
                </div>

                {/* Vista en Vivo del Buzón Outlook 365 + Consola de Logs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: '16px' }}>
                  <div style={{ background: '#0f172a', borderRadius: '10px', overflow: 'hidden', border: '2px solid #00324d', minHeight: '340px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center' }}>
                    {emailSyncFrame ? (
                      <>
                        <div style={{ width: '100%', background: '#00324d', color: '#fff', fontSize: '11.5px', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>🟢 <strong>Correo Abierto en Servidor</strong> — {emailSyncUser} (Carpeta: {emailSyncFolder})</span>
                          <span style={{ color: '#86efac', fontWeight: '700' }}>🖱️ Puede hacer clic directo en la pantalla</span>
                        </div>
                        <img
                          src={emailSyncFrame}
                          alt="Vista en vivo Outlook 365"
                          onClick={handleEmailBrowserClick}
                          style={{ width: '100%', maxHeight: '360px', objectFit: 'contain', cursor: 'pointer', background: '#fff' }}
                          title="Haga clic directamente sobre cualquier botón o carpeta de su correo"
                        />
                        {/* Barra permanente para escribir código SMS / OTP / Contraseña al navegador */}
                        <div style={{ width: '100%', background: '#1e293b', padding: '8px 10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={emailSyncBrowserInput}
                            onChange={(e) => setEmailSyncBrowserInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSendTextToEmailBrowser(); }}
                            placeholder="Escribir código SMS / código 6 dígitos / contraseña en pantalla y Enter..."
                            style={{ flex: 1, padding: '7px 10px', borderRadius: '6px', border: '1px solid #475569', fontSize: '12.5px', background: '#fff', color: '#0f172a' }}
                          />
                          <button
                            onClick={handleSendTextToEmailBrowser}
                            style={{
                              background: '#39a900',
                              color: '#fff',
                              border: 'none',
                              padding: '7px 14px',
                              borderRadius: '6px',
                              fontWeight: '800',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            Enviar a Pantalla ↵
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', margin: 'auto' }}>
                        <Monitor size={40} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.5, color: '#38bdf8' }} />
                        Presione <strong>"Abrir Mi Correo en Servidor y Descargar Radicados"</strong> para abrir el buzón <strong>{emailSyncUser}</strong> (el sistema saltará el PIN automáticamente y mostrará el código en pantalla).
                      </div>
                    )}
                  </div>

                  <div style={{ background: '#0f172a', borderRadius: '10px', padding: '12px', color: '#4ade80', fontFamily: 'monospace', fontSize: '11.5px', height: '420px', overflowY: 'auto' }}>
                    <div style={{ color: '#94a3b8', borderBottom: '1px solid #334155', paddingBottom: '6px', marginBottom: '8px', fontWeight: '700' }}>
                      Registro en Vivo del Correo en Servidor ({emailSyncUser})
                    </div>
                    {emailSyncStateData.logs && emailSyncStateData.logs.length > 0 ? (
                      emailSyncStateData.logs.map((lg, idx) => (
                        <div key={idx} style={{ marginBottom: '4px', lineHeight: '1.35' }}>&gt; {lg}</div>
                      ))
                    ) : (
                      <div style={{ color: '#64748b' }}>Esperando inicio de lectura del buzón {emailSyncUser}...</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Pestaña Manual: Pegar Texto o Tabla de Correos CPE */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '13px', color: '#334155' }}>
                  También puede copiar y pegar aquí el texto de uno o varios correos de la carpeta <strong>Producidas</strong> (incluyendo el asunto <code>CPE No. 68-9-2026-...</code>, destinatario <code>Para:</code> y la tabla <code>Radicado | N.I.S. | Fecha</code>):
                </div>
                <textarea
                  value={manualEmailText}
                  onChange={(e) => setManualEmailText(e.target.value)}
                  rows={10}
                  placeholder={`Ejemplo:\nCPE No. 68-9-2026-057099 - CITACIÓN A COMITÉ DE EVALUACIÓN Y SEGUIMIENTO ¿ PRESUNTA DESERCIÓN POR INASISTENCIAS ¿ FICHA 3491179\nPara: ANDRESSPEREZ1687@GMAIL.COM\nRadicado\tN.I.S.\tFecha\n68-9-2026-057099\t2026-02-499770\t11/4/2026 8:53:03 AM`}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: '12px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    onClick={handleImportManualEmailText}
                    disabled={importingManualEmail}
                    style={{
                      background: '#39a900',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      fontWeight: '800',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    {importingManualEmail ? 'Procesando...' : '✅ Extraer y Actualizar Base de Datos'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
