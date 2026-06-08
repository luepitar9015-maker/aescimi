import { useState, useEffect, useRef } from 'react';
import { 
  Zap, Brain, Keyboard, Smartphone, Play, CheckCircle, 
  Calculator, Clock, ArrowRight, ChevronRight, 
  ChevronLeft, FileText, Maximize2, Minimize2, Check, Info, ShieldAlert,
  Folder, Network, Database, FolderPlus, Server, Eye, FileCheck
} from 'lucide-react';

// --- MOCK DOCUMENTS FOR THE SIMULATOR ---
const MOCK_DOCUMENTS = [
  {
    id: 'peticion',
    title: '01_DERECHO_DE_PETICION.pdf',
    type: 'DERECHO DE PETICIÓN',
    confidence: '99.2%',
    reasoning: 'El documento contiene la fórmula explícita "DERECHO DE PETICIÓN" e invoca el Artículo 23 de la Constitución Política. Solicita la entrega urgente de registros de salud.',
    metadata: {
      solicitante: 'Carlos Mario Mendoza',
      cedula: '1.082.944.221',
      fecha: '2026-05-15',
      expediente: '2026EX-035914',
      asunto: 'Solicitud Copia de Historia Clínica'
    },
    textPreview: 'DERECHO DE PETICIÓN\n\nSeñor Director:\n\nYo, CARLOS MARIO MENDOZA, identificado con la cédula 1.082.944.221, de manera respetuosa me dirijo a ustedes para interponer DERECHO DE PETICIÓN fundamentado en el Art. 23 de la Constitución...'
  },
  {
    id: 'contrato',
    title: 'CONTRATO_PRESTACION_SERVICIOS_180.pdf',
    type: 'CONTRATO',
    confidence: '98.5%',
    reasoning: 'Identificado por la presencia de cláusulas mutuas de prestación de servicios, objeto contractual, valor, firmas de representante legal y contratista.',
    metadata: {
      solicitante: 'Estrategia 180 S.A.S.',
      cedula: 'NIT 901.422.180-2',
      fecha: '2026-04-01',
      expediente: '2026EX-012903',
      asunto: 'Soporte y Consultoría Tecnológica V V'
    },
    textPreview: 'CONTRATO DE PRESTACIÓN DE SERVICIOS N. 180\n\nEntre los suscritos a saber, la ORGANIZACIÓN, por una parte, y por la otra la sociedad ESTRATEGIA 180 S.A.S. con NIT 901.422.180-2, acuerdan el siguiente contrato...'
  },
  {
    id: 'resolucion',
    title: 'RESOLUCION_NOMBRAMIENTO_342.pdf',
    type: 'RESOLUCIÓN',
    confidence: '97.9%',
    reasoning: 'El documento inicia con la fórmula solemne "RESUELVE" y contiene secciones de considerandos que refieren a la incorporación oficial de personal.',
    metadata: {
      solicitante: 'Laura Sofía Gómez',
      cedula: '1.018.399.402',
      fecha: '2026-05-10',
      expediente: '2026EX-008922',
      asunto: 'Nombramiento en Cargo de Profesional Universitario'
    },
    textPreview: 'RESOLUCIÓN NÚMERO 342 DE 2026\n\n"Por la cual se efectúa un nombramiento ordinario en el cargo de Profesional Universitario..."\n\nEL DIRECTOR DE LA ORGANIZACIÓN, en uso de sus facultades legales, y\n\nCONSIDERANDO...\n\nRESUELVE...'
  }
];

export default function InteractivePresentation() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [allowNotes, setAllowNotes] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const containerRef = useRef(null);

  // Sync fullscreen state when exiting with Escape and check URL for presenter notes option
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    // Check url param
    const urlParams = new URLSearchParams(window.location.search);
    const hasNotes = urlParams.get('notes') === 'true';
    setAllowNotes(hasNotes);
    setShowNotes(hasNotes);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // --- CALCULATOR STATE (Slide 4) ---
  const [dailyDocs, setDailyDocs] = useState(300);
  const [manualTime, setManualTime] = useState(4); // minutes per doc
  const [autoTime, setAutoTime] = useState(15); // seconds per doc

  // --- SIMULATOR STATE (Slide 7) ---
  const [selectedDocId, setSelectedDocId] = useState('peticion');
  const [simStep, setSimStep] = useState(0); // 0: Idle, 1: IA scanning, 2: SSO credentials, 3: MFA Phone, 4: RPA Typing ECM, 5: Done
  const [typedEmail, setTypedEmail] = useState('');
  const [typedPass, setTypedPass] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [simLogs, setSimLogs] = useState([]);
  const [mfaApproved, setMfaApproved] = useState(false);

  const selectedDoc = MOCK_DOCUMENTS.find(d => d.id === selectedDocId) || MOCK_DOCUMENTS[0];

  // --- KEYBOARD CONTROLS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        prevSlide();
      } else if (e.key.toLowerCase() === 'n') {
        if (allowNotes) {
          setShowNotes(n => !n);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, allowNotes]);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(c => c + 1);
      resetSimulatorState();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(c => c - 1);
      resetSimulatorState();
    }
  };

  const resetSimulatorState = () => {
    setSimStep(0);
    setMfaApproved(false);
    setTypedEmail('');
    setTypedPass('');
    setUploadProgress(0);
    setSimLogs([]);
  };

  // --- CALCULATOR MATHS ---
  const dailyManualHours = (dailyDocs * manualTime) / 60;
  const dailyAutoHours = (dailyDocs * autoTime) / 3600;
  const timeSavedHours = dailyManualHours - dailyAutoHours;
  const monthlySavedDays = (timeSavedHours * 20) / 8; // 20 working days, 8hr/day
  const relativeSpeed = Math.round((manualTime * 60) / autoTime);

  // --- SIMULATOR CONTROLLER ---
  const startSimulation = () => {
    setSimStep(1);
    setMfaApproved(false);
    setTypedEmail('');
    setTypedPass('');
    setUploadProgress(0);
    setSimLogs(['[IA] Iniciando lectura de archivo: ' + selectedDoc.title, '[IA] Leyendo contenido y estructura del PDF...']);

    // Step 1: Scanning (2s)
    setTimeout(() => {
      setSimStep(2);
      setSimLogs(prev => [
        ...prev,
        `[IA] Clasificación propuesta: ${selectedDoc.type} (Confianza: ${selectedDoc.confidence})`,
        `[IA] Metadatos sugeridos: Solicitante="${selectedDoc.metadata.solicitante}", Id="${selectedDoc.metadata.cedula}"`,
        `[RPA] Iniciando ejecución del robot...`,
        `[RPA] Abriendo navegador seguro a la dirección del ECM...`,
        `[RPA] Detectado portal de inicio de sesión único (SSO).`
      ]);
      
      // Step 2: Typing credentials (SSO)
      typeCredentials();
    }, 2000);
  };

  const typeCredentials = () => {
    const email = 'orador.sena@sena.edu.co';
    const pass = 'HiperAutomatizacion2026*';
    
    // Simulate typing email
    let i = 0;
    const emailInterval = setInterval(() => {
      if (i < email.length) {
        setTypedEmail(email.substring(0, i + 1));
        i++;
      } else {
        clearInterval(emailInterval);
        
        // Wait, click Next, then type password
        setTimeout(() => {
          setSimLogs(prev => [...prev, '[RPA] Digitando contraseña corporativa...']);
          
          let j = 0;
          const passInterval = setInterval(() => {
            if (j < pass.length) {
              setTypedPass(pass.substring(0, j + 1));
              j++;
            } else {
              clearInterval(passInterval);
              
              // Proceed to MFA prompt
              setTimeout(() => {
                setSimStep(3);
                setSimLogs(prev => [
                  ...prev, 
                  '[SEGURIDAD] Bloqueado por MFA corporativo.', 
                  '[SEGURIDAD] Esperando aprobación en dispositivo móvil del expositor...'
                ]);
              }, 600);
            }
          }, 30);
        }, 500);
      }
    }, 30);
  };

  const approveMfa = () => {
    setMfaApproved(true);
    setSimLogs(prev => [...prev, '[SEGURIDAD] Autenticación aprobada en celular.', '[RPA] Login exitoso. Redirigiendo a bandeja de radicación...']);
    
    // Proceed to Step 4: RPA Typing into Form
    setTimeout(() => {
      setSimStep(4);
      setSimLogs(prev => [
        ...prev, 
        '[RPA] Navegando hacia el Expediente: ' + selectedDoc.metadata.expediente,
        '[RPA] Creando nueva plantilla de radicación...',
        '[RPA] Digitando campo: "Nombre del Solicitante" -> ' + selectedDoc.metadata.solicitante,
        '[RPA] Digitando campo: "Cédula/NIT" -> ' + selectedDoc.metadata.cedula,
        '[RPA] Seleccionando tipología documental: ' + selectedDoc.type,
        '[RPA] Cargando archivo adjunto...'
      ]);

      // Progress bar upload
      let progress = 0;
      const progressInterval = setInterval(() => {
        if (progress < 100) {
          progress += 10;
          setUploadProgress(progress);
        } else {
          clearInterval(progressInterval);
          
          // Complete simulation
          setTimeout(() => {
            setSimStep(5);
            setSimLogs(prev => [
              ...prev,
              '[RPA] Carga del documento completada.',
              '[RPA] Radicación ejecutada de forma exitosa en el Repositorio Central.',
              `[IA] Resumen automático: "${selectedDoc.metadata.asunto} correspondiente a ${selectedDoc.solicitante} con fecha ${selectedDoc.metadata.fecha}."`,
              '[SISTEMA] Flujo de automatización terminado en 12.8 segundos.'
            ]);
          }, 600);
        }
      }, 100);
    }, 1200);
  };

  // --- PRESENTATION SLIDES DEFINITION (12 slides) ---
  const slides = [
    {
      // Diapositiva 1
      title: 'SENA V2',
      subtitle: 'La Revolución Documental con Inteligencia Artificial',
      speakerNotes: 'Comenzar dando la bienvenida al público. Aclarar que la gestión documental es el corazón de la administración pública y privada, pero suele consumir miles de horas humanas en tareas de copiar y pegar. Introducir el concepto de "Trabajador Digital" como una combinación de Inteligencia Artificial (cerebro/ojos) y Robots (brazos/manos) para librar a los funcionarios de la rutina repetitiva.',
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-6 animate-[fadeIn_0.5s_ease-out]">
          <div className="relative">
            <div className="absolute inset-0 bg-[#39A900] blur-3xl opacity-20 rounded-full w-48 h-48 mx-auto -top-4"></div>
            <div className="relative bg-slate-900 border border-slate-700/60 p-6 rounded-3xl inline-flex items-center justify-center shadow-2xl">
              <Zap size={64} className="text-[#39A900] animate-pulse" />
            </div>
          </div>
          <div className="space-y-3">
            <span className="text-xs font-bold tracking-[0.2em] text-[#39A900] uppercase">Proyecto de Innovación Digital</span>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight font-outfit">
              SENA V2
            </h2>
            <p className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 font-bold text-xl md:text-2xl max-w-xl mx-auto font-outfit">
              Gestión Documental con IA e Hiperautomatización
            </p>
            <p className="text-slate-400 text-sm max-w-lg mx-auto font-medium">
              De horas de transcripción manual a segundos de clasificación estructurada y sincronización automatizada.
            </p>
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <span className="bg-slate-900/80 border border-slate-800 text-slate-350 text-[10px] px-3.5 py-1.5 rounded-full font-bold">✨ Gemini 1.5 Flash</span>
            <span className="bg-slate-900/80 border border-slate-800 text-slate-350 text-[10px] px-3.5 py-1.5 rounded-full font-bold">🤖 Robots Puppeteer</span>
            <span className="bg-slate-900/80 border border-slate-800 text-[#39A900] border-[#39A900]/30 text-[10px] px-3.5 py-1.5 rounded-full font-bold">📂 Cumplimiento TRD</span>
          </div>
        </div>
      )
    },
    {
      // Diapositiva 2
      title: 'El Desafío de la Gestión Documental Pública',
      subtitle: 'El impacto invisible del trabajo manual y repetitivo',
      speakerNotes: 'Explicar que un empleado dedica horas a abrir archivos PDF, interpretarlos uno por uno, adivinar su tipo de trámite, abrir un portal corporativo, pasar por el login, escribir la misma información e indexar el archivo. Esto genera cansancio y alta tasa de errores en tipologías e indexación. Mencionar la directriz del Archivo General de la Nación (AGN).',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full max-w-5xl p-2 text-left animate-[fadeIn_0.5s_ease-out]">
          {/* Left: cards (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl flex gap-3 items-start hover:border-red-500/20 transition-all">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center font-bold text-xs flex-shrink-0">01</div>
              <div>
                <h4 className="text-xs font-black text-white font-outfit">Fatiga Cognitiva</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Leer individualmente cientos de archivos de múltiples páginas para deducir qué tipología representa según la norma.</p>
              </div>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl flex gap-3 items-start hover:border-red-500/20 transition-all">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center font-bold text-xs flex-shrink-0">02</div>
              <div>
                <h4 className="text-xs font-black text-white font-outfit">Ineficiencia Manual</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Copiar, transcribir y pegar nombres completos, identificaciones, fechas y asuntos del PDF al formulario del sistema.</p>
              </div>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl flex gap-3 items-start hover:border-red-500/20 transition-all">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center font-bold text-xs flex-shrink-0">03</div>
              <div>
                <h4 className="text-xs font-black text-white font-outfit">Inconsistencia Crítica</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Equivocaciones en nombres o cédulas que imposibilitan búsquedas futuras, rompiendo la integridad del expediente.</p>
              </div>
            </div>
          </div>
          
          {/* Right: SVG Bottleneck (7 cols) */}
          <div className="lg:col-span-7 bg-slate-950 border border-slate-900 rounded-3xl p-6 h-[320px] flex flex-col justify-between shadow-2xl relative overflow-hidden">
            <h4 className="text-xs font-black text-red-400 uppercase tracking-widest mb-2 font-outfit">Embudo de Fricción Manual de Indexación</h4>
            <svg viewBox="0 0 400 200" className="w-full h-full text-white font-sans">
              <defs>
                <marker id="arrow-red" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
                </marker>
                <linearGradient id="grad-red-react" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#f43f5e" />
                </linearGradient>
              </defs>

              {/* Step 1: Ingest */}
              <rect x="10" y="70" width="70" height="50" rx="6" fill="url(#grad-red-react)" opacity="0.85" />
              <text x="45" y="90" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#fff">1. Ingesta</text>
              <text x="45" y="103" textAnchor="middle" fontSize="6" fill="#fff" opacity="0.8">PDF Descargado</text>
              
              {/* Arrow 1 */}
              <path d="M 80 95 L 110 95" fill="none" stroke="#ef4444" strokeWidth="1.5" markerEnd="url(#arrow-red)" />

              {/* Step 2: Reading */}
              <rect x="120" y="60" width="75" height="70" rx="6" fill="#1e293b" stroke="#ef4444" strokeWidth="1" />
              <text x="157" y="80" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#fff">2. Lectura</text>
              <text x="157" y="93" textAnchor="middle" fontSize="6" fill="#ef4444" fontWeight="bold">FATIGA COGNITIVA</text>
              <text x="157" y="103" textAnchor="middle" fontSize="5.5" fill="#94a3b8">Búsqueda de Datos</text>
              <text x="157" y="113" textAnchor="middle" fontSize="5.5" fill="#94a3b8">150-300 segs / doc</text>

              {/* Arrow 2 */}
              <path d="M 195 95 L 225 95" fill="none" stroke="#ef4444" strokeWidth="1.5" markerEnd="url(#arrow-red)" />

              {/* Step 3: Digitation */}
              <rect x="235" y="60" width="75" height="70" rx="6" fill="#1e293b" stroke="#ef4444" strokeWidth="1" />
              <text x="272" y="80" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#fff">3. Digitación</text>
              <text x="272" y="93" textAnchor="middle" fontSize="6" fill="#ef4444" fontWeight="bold">ERROR DE DATO</text>
              <text x="272" y="103" textAnchor="middle" fontSize="5.5" fill="#94a3b8">Nombres y Cédulas</text>
              <text x="272" y="113" textAnchor="middle" fontSize="5.5" fill="#94a3b8">Digitado manual</text>

              {/* Arrow 3 */}
              <path d="M 310 95 L 335 95" fill="none" stroke="#ef4444" strokeWidth="1.5" markerEnd="url(#arrow-red)" />

              {/* Step 4: Storage */}
              <rect x="345" y="70" width="45" height="50" rx="6" fill="#1e293b" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <text x="367" y="90" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#94a3b8">4. OneDrive</text>
              <text x="367" y="103" textAnchor="middle" fontSize="5.5" fill="#f43f5e">Desorden</text>
            </svg>
          </div>
        </div>
      )
    },
    {
      // Diapositiva 3
      title: 'La Fricción Operativa - Anatomía del Trabajo Repetitivo',
      subtitle: 'El calvario diario del funcionario de archivo',
      speakerNotes: 'Detallar los cinco pasos de la indexación manual. Hacer mímica de transcribir texto al aire al hablar de digitación. Señalar los riesgos asociados a cada paso (sesión caída, equivocaciones en cédulas, nomenclatura desordenada).',
      content: (
        <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/25 p-2 animate-[fadeIn_0.5s_ease-out]">
          <div className="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-900 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th class="p-3">Paso</th>
                  <th class="p-3">Operación Manual</th>
                  <th class="p-3 text-red-400">Riesgos y Limitantes</th>
                  <th class="p-3 text-[#39A900]">Solución Automática</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60 text-left">
                <tr>
                  <td class="p-3 font-bold text-slate-350">1. Descarga</td>
                  <td class="p-3 text-slate-400">Descargar archivos PDF desde correos o OneDrive locales.</td>
                  <td class="p-3 text-slate-400">Desorden, archivos duplicados.</td>
                  <td class="p-3 text-[#39A900] font-bold">API Ingesta Directa</td>
                </tr>
                <tr>
                  <td class="p-3 font-bold text-slate-350">2. Lectura</td>
                  <td class="p-3 text-slate-400">Leer y deducir la tipología según la TRD.</td>
                  <td class="p-3 text-slate-400">Clasificación subjetiva/errónea.</td>
                  <td class="p-3 text-[#39A900] font-bold">Modelado Cognitivo IA</td>
                </tr>
                <tr>
                  <td class="p-3 font-bold text-slate-350">3. Login</td>
                  <td class="p-3 text-slate-400">Superar Microsoft SSO y alertas de MFA corporativas.</td>
                  <td class="p-3 text-slate-400">Pérdida por sesiones caídas.</td>
                  <td class="p-3 text-[#39A900] font-bold">Automáta Puppeteer</td>
                </tr>
                <tr>
                  <td class="p-3 font-bold text-slate-350">4. Digitación</td>
                  <td class="p-3 text-slate-400">Digitar nombres, cédulas y fechas del expediente.</td>
                  <td class="p-3 text-slate-400">Errores tipográficos humanos.</td>
                  <td class="p-3 text-[#39A900] font-bold">OCR por Recorte Dinámico</td>
                </tr>
                <tr>
                  <td class="p-3 font-bold text-slate-350">5. OneDrive</td>
                  <td class="p-3 text-slate-400">Crear carpetas y renombrar PDFs a mano.</td>
                  <td class="p-3 text-slate-400">Inconsistencia en la nomenclatura.</td>
                  <td class="p-3 text-[#39A900] font-bold">Estructura Simétrica</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )
    },
    {
      // Diapositiva 4: Calculadora interactiva
      title: 'Cuantificación del Dolor - Calculadora de Tiempos',
      subtitle: 'Ajuste los valores para estimar el ahorro neto mensual de su equipo',
      speakerNotes: 'Invitar al público a participar en pantalla. Modificar las variables (documentos diarios por procesar, tiempo manual, etc.) para ver cómo se traduce en horas de labor humana liberada y días laborales ahorrados al mes.',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center w-full max-w-4xl text-left animate-[fadeIn_0.5s_ease-out]">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-400 mb-1.5">
                <span>Documentos diarios a procesar:</span>
                <span className="text-[#39A900] font-black text-sm bg-slate-950 px-2.5 py-0.5 rounded">{dailyDocs}</span>
              </div>
              <input 
                type="range" min="10" max="1000" step="10"
                value={dailyDocs} onChange={(e) => setDailyDocs(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#39A900] outline-none"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Minutos Manuales / doc:</label>
                <input 
                  type="number" min="1" max="15" 
                  value={manualTime} onChange={(e) => setManualTime(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-850 text-xs text-slate-200 p-2 rounded-xl focus:border-[#39A900] outline-none font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Segundos Robot / doc:</label>
                <input 
                  type="number" min="5" max="60" 
                  value={autoTime} onChange={(e) => setAutoTime(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-850 text-xs text-slate-200 p-2 rounded-xl focus:border-[#39A900] outline-none font-bold"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-850 rounded-3xl p-5 space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#39A900] animate-ping"></span>
              Retorno Operativo Estimado
            </h4>
            
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-slate-850 text-center">
                <span className="block text-[9px] font-bold text-slate-500 uppercase">Tiempo Manual</span>
                <span className="text-base font-black text-red-400 block mt-1">{dailyManualHours.toFixed(1)} hrs</span>
              </div>
              <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-slate-850 text-center">
                <span className="block text-[9px] font-bold text-slate-500 uppercase">Tiempo Robot</span>
                <span className="text-base font-black text-green-400 block mt-1">{(dailyAutoHours * 60).toFixed(1)} mins</span>
              </div>
              <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-slate-850 text-center">
                <span className="block text-[9px] font-bold text-slate-500 uppercase">Aumento Vel.</span>
                <span className="text-base font-black text-[#39A900] block mt-1">{relativeSpeed}x</span>
              </div>
            </div>

            {/* Comparative Bar Chart */}
            <div className="space-y-3 border-t border-slate-900/60 pt-3">
              <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider font-outfit">Comparativa de Velocidad</span>
              
              <div className="space-y-1">
                <div className="flex justify-between text-[8px] font-bold text-red-400 font-mono">
                  <span>Procesamiento Manual</span>
                  <span>{manualTime} mins</span>
                </div>
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div className="bg-gradient-to-r from-red-500 to-rose-450 h-full rounded-full transition-all duration-300" style={{ width: '100%' }}></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[8px] font-bold text-sena-green font-mono">
                  <span>Procesamiento SENA V2</span>
                  <span>{autoTime} secs</span>
                </div>
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div className="bg-gradient-to-r from-sena-green to-emerald-400 h-full rounded-full transition-all duration-300" style={{ width: `${Math.min((autoTime / (manualTime * 60)) * 100, 100)}%` }}></div>
                </div>
              </div>
            </div>

            <div className="bg-[#39A900]/5 border border-[#39A900]/20 p-3.5 rounded-2xl text-center">
              <p className="text-xs text-slate-350">
                Liberas <strong className="text-[#39A900] text-sm">{timeSavedHours.toFixed(1)} horas/día</strong> del personal. 
                <span className="block text-[10px] text-slate-455 mt-1">Ahorras <strong className="text-[#39A900]">{monthlySavedDays.toFixed(1)} días laborales</strong> al mes.</span>
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      // Diapositiva 5
      title: 'Hiperautomatización: RPA + Inteligencia Artificial',
      subtitle: 'La sinergia de cerebro y manos trabajando en conjunto',
      speakerNotes: 'Explicar que la IA de Gemini actúa como el cerebro cognitivo (extrae, lee, razona semánticamente), y el robot RPA actúa como los brazos (ejecuta el inicio de sesión y teclea los metadatos en el ECM institucional). Esto permite tolerar formatos variables de documentos.',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center w-full max-w-5xl p-2 text-left animate-[fadeIn_0.5s_ease-out]">
          
          {/* Left: IA */}
          <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between hover:border-[#39A900]/25 transition-all h-[300px]">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧠</span>
                <h4 className="text-sm font-black text-white font-outfit">Cerebro (IA)</h4>
              </div>
              <span className="inline-block text-[8px] font-bold text-[#39A900] bg-[#39A900]/10 px-2 py-0.5 rounded uppercase font-outfit">Gemini 1.5 Flash</span>
              <ul className="text-[10px] text-slate-400 space-y-1.5 list-disc list-inside pt-1 font-medium leading-normal">
                <li>Lectura cognitiva de PDFs.</li>
                <li>Deducción de tipología TRD.</li>
                <li>Extracción lógica de campos.</li>
                <li>Resúmenes automáticos.</li>
              </ul>
            </div>
          </div>

          {/* Center Image */}
          <div className="relative rounded-3xl overflow-hidden border border-slate-800 shadow-2xl h-[300px] flex items-center justify-center bg-slate-950">
            <img src="/assets/images/digital_worker_concept.png" className="w-full h-full object-cover opacity-85 hover:scale-105 transition-transform duration-500" alt="Trabajador Digital Concept" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-3 text-center">
              <span className="text-[9px] font-bold text-white uppercase tracking-widest bg-slate-900/80 px-2.5 py-1 rounded-full border border-slate-800 font-outfit">SENA V2: RPA + IA</span>
            </div>
          </div>

          {/* Right: RPA */}
          <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between hover:border-cyan-500/25 transition-all h-[300px]">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🦾</span>
                <h4 className="text-sm font-black text-white font-outfit">Brazos (RPA)</h4>
              </div>
              <span className="inline-block text-[8px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded uppercase font-outfit">Puppeteer Engine</span>
              <ul className="text-[10px] text-slate-400 space-y-1.5 list-disc list-inside font-medium pt-1 leading-normal">
                <li>Navegación web autónoma.</li>
                <li>Ingreso seguro SSO Microsoft.</li>
                <li>Digitación en formulario ECM.</li>
                <li>Orden secuencial en OneDrive.</li>
              </ul>
            </div>
          </div>

        </div>
      )
    },
    {
      // Diapositiva 6
      title: 'Arquitectura Técnica de la Solución',
      subtitle: 'Componentes del ecosistema de hiperautomatización',
      speakerNotes: 'Explicar las capas de la arquitectura. El cliente React dibuja y captura, el backend Express procesa la TRD de PostgreSQL, orquesta el RPA mediante Puppeteer y consulta la API corporativa de Gemini 1.5 Flash.',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full max-w-5xl text-left animate-[fadeIn_0.5s_ease-out]">
          {/* SVG Diagram */}
          <div className="lg:col-span-7 bg-slate-950 border border-slate-900 rounded-3xl p-4 h-[300px] flex items-center justify-center shadow-2xl relative overflow-hidden">
            <svg viewBox="0 0 500 240" className="w-full h-full text-white font-sans">
              <defs>
                <marker id="arrow-react" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#39A900" />
                </marker>
                <marker id="arrow-blue-react" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
                </marker>
                <linearGradient id="grad-dark-react" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>
              </defs>

              {/* Node 1: React UI */}
              <rect x="20" y="80" width="100" height="65" rx="8" fill="url(#grad-dark-react)" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
              <text x="70" y="105" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#fff">INTERFAZ (React)</text>
              <text x="70" y="120" textAnchor="middle" fontSize="8" fill="#94a3b8">Frontend & Visor</text>
              <text x="70" y="132" textAnchor="middle" fontSize="7" fill="#39A900" fontWeight="bold">Control de Recorte</text>

              {/* Arrows from UI to Node Backend */}
              <path d="M 120 112 L 170 112" fill="none" stroke="#39A900" strokeWidth="2" markerEnd="url(#arrow-react)" />
              
              {/* Node 2: Node.js Backend */}
              <rect x="180" y="80" width="110" height="65" rx="8" fill="url(#grad-dark-react)" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
              <text x="235" y="105" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#fff">BACKEND (Node/Express)</text>
              <text x="235" y="120" textAnchor="middle" fontSize="8" fill="#94a3b8">Orquestador de Flujo</text>
              <text x="235" y="132" textAnchor="middle" fontSize="7" fill="#06b6d4" fontWeight="bold">PostgreSQL DB</text>

              {/* Paths from Backend to IA & RPA */}
              <path d="M 290 100 L 350 50" fill="none" stroke="#39A900" strokeWidth="1.5" markerEnd="url(#arrow-react)" />
              <path d="M 290 125 L 350 175" fill="none" stroke="#06b6d4" strokeWidth="1.5" markerEnd="url(#arrow-blue-react)" />

              {/* Node 3: Gemini IA */}
              <rect x="360" y="20" width="110" height="55" rx="8" fill="url(#grad-dark-react)" stroke="rgba(57,169,0,0.3)" strokeWidth="1" />
              <text x="415" y="42" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#39A900">✨ Google Gemini</text>
              <text x="415" y="56" textAnchor="middle" fontSize="8" fill="#94a3b8">Clasificación & OCR</text>

              {/* Node 4: Puppeteer RPA */}
              <rect x="360" y="150" width="110" height="55" rx="8" fill="url(#grad-dark-react)" stroke="rgba(6,182,212,0.3)" strokeWidth="1" />
              <text x="415" y="172" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#06b6d4">🤖 Puppeteer RPA</text>
              <text x="415" y="186" textAnchor="middle" fontSize="8" fill="#94a3b8">Ingreso a ECM / Cloud</text>

              {/* Return path to Backend */}
              <path d="M 360 45 L 250 45 L 250 80" fill="none" stroke="#39A900" strokeWidth="1" strokeDasharray="3,3" />
              <path d="M 360 180 L 220 180 L 220 145" fill="none" stroke="#06b6d4" strokeWidth="1" strokeDasharray="3,3" />
            </svg>
          </div>

          {/* Right points */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl hover:border-sena-green/10 transition-all">
              <h4 className="text-xs font-bold text-white font-outfit mb-0.5">Seguridad Extrema</h4>
              <p className="text-[10px] text-slate-400 leading-relaxed font-medium">La comunicación con la API de Gemini es empresarial, lo que garantiza que los folios no se usan para re-entrenar modelos públicos.</p>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl hover:border-sena-green/10 transition-all">
              <h4 className="text-xs font-bold text-white font-outfit mb-0.5">Orquestación Desacoplada</h4>
              <p className="text-[10px] text-slate-400 leading-relaxed font-medium">El backend Node/Express recibe el recorte, delega la lógica a la IA, y luego dispara el robot de Puppeteer en hilos independientes.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      // Diapositiva 7: Live Simulator Widget
      title: 'Demostración en Vivo: Simulador del Trabajador Digital',
      subtitle: 'Observe la cooperación en tiempo real de la IA y el Robot',
      speakerNotes: 'Esta es la demo más impactante. Explicar las fases en la pantalla. Seleccionar un documento, correr la simulación, simular la digitación de contraseñas, detenerse en la pantalla de MFA para dar clic en Aprobar, y ver la digitación automática en el ECM.',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full max-w-5xl text-left animate-[fadeIn_0.5s_ease-out]">
          
          {/* Menu Selector */}
          <div className="lg:col-span-3 space-y-2">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">1. Documento</h4>
            <div className="space-y-1.5">
              {MOCK_DOCUMENTS.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => {
                    if (simStep === 0 || simStep === 5) {
                      setSelectedDocId(doc.id);
                      setSimStep(0);
                    }
                  }}
                  disabled={simStep > 0 && simStep < 5}
                  className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all ${
                    selectedDocId === doc.id 
                      ? 'bg-slate-900 border-[#39A900] text-white shadow-md' 
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800'
                  }`}
                >
                  <span className="font-bold truncate block">{doc.title}</span>
                  <span className="block text-[9px] text-slate-500 font-semibold uppercase mt-0.5">TIPO: {doc.type}</span>
                </button>
              ))}
            </div>
            
            <div className="pt-2">
              {simStep === 0 || simStep === 5 ? (
                <button
                  onClick={startSimulation}
                  className="w-full bg-[#39A900] text-white hover:bg-[#329600] font-black text-xs p-2.5 rounded-xl shadow-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <Play size={12} /> Correr Simulación
                </button>
              ) : (
                <button
                  onClick={resetSimulatorState}
                  className="w-full bg-slate-800 text-slate-350 hover:bg-slate-700 font-bold text-xs p-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all"
                >
                  Reiniciar
                </button>
              )}
            </div>
          </div>

          {/* Canvas View */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-850 rounded-2xl p-4 flex flex-col h-[320px] relative overflow-hidden justify-center items-center">
            {simStep === 0 && (
              <div className="text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-lg text-sena-green mx-auto">🤖</div>
                <h5 className="text-xs font-bold text-slate-350">Simulador Listo</h5>
                <p className="text-[10px] text-slate-500 max-w-xs mx-auto">Selecciona un archivo a la izquierda y presiona el botón verde.</p>
              </div>
            )}

            {simStep === 1 && (
              <div className="w-full h-full flex flex-col justify-center items-center space-y-3 p-2 relative">
                <div className="w-32 h-40 bg-slate-900 border border-slate-750 rounded-lg p-3 relative overflow-hidden shadow-2xl flex flex-col justify-between">
                  <div className="absolute left-0 right-0 h-0.5 bg-green-400 shadow-[0_0_8px_#4ade80] animate-[laser-move_2s_ease-in-out_infinite] top-0"></div>
                  <div className="space-y-1.5">
                    <div className="h-1.5 w-1/3 bg-slate-700 rounded"></div>
                    <div className="h-1 w-full bg-slate-800 rounded"></div>
                    <div className="h-1 w-5/6 bg-slate-850 rounded"></div>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2.5 w-full bg-[#39A900]/15 border border-[#39A900]/30 rounded p-0.5 text-[6px] text-[#39A900] font-black truncate flex items-center gap-0.5">✓ {selectedDoc.metadata.solicitante}</div>
                    <div className="h-2.5 w-5/6 bg-blue-500/15 border border-blue-500/30 rounded p-0.5 text-[6px] text-blue-400 font-black truncate flex items-center gap-0.5">✓ {selectedDoc.metadata.cedula}</div>
                  </div>
                </div>
                <span className="text-[9px] font-black text-[#39A900] bg-[#39A900]/10 px-2 py-0.5 rounded-full uppercase tracking-wider">IA Leyendo PDF</span>
              </div>
            )}

            {simStep === 2 && (
              <div className="w-full h-full flex flex-col justify-center items-center p-2">
                <div className="w-full max-w-xs bg-white text-slate-800 rounded-xl p-3 shadow-xl border border-slate-200 text-[9px] space-y-1.5">
                  <div className="flex items-center gap-1 border-b border-slate-100 pb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                    <span className="text-[7px] text-slate-400 font-mono truncate">login.microsoftonline.com/auth</span>
                  </div>
                  <div className="text-center font-bold text-slate-700">Inicio de Sesión Corporativo</div>
                  <div className="space-y-1 text-left">
                    <div>
                      <span className="text-[7px] text-slate-500 font-bold block">Usuario:</span>
                      <div className="bg-slate-50 border border-slate-200 p-1 rounded font-mono min-h-[18px] text-slate-700 font-semibold">{typedEmail}<span className="animate-pulse">|</span></div>
                    </div>
                    <div>
                      <span className="text-[7px] text-slate-500 font-bold block">Contraseña:</span>
                      <div className="bg-slate-50 border border-slate-200 p-1 rounded font-mono min-h-[18px] text-slate-700 font-semibold">{'•'.repeat(typedPass.length)}{typedEmail.length >= 20 && <span className="animate-pulse">|</span>}</div>
                    </div>
                  </div>
                </div>
                <span class="block text-[8px] text-slate-500 mt-2 font-bold uppercase">Robot RPA digitando credenciales...</span>
              </div>
            )}

            {simStep === 3 && (
              <div className="w-full h-full flex flex-col justify-center items-center p-2">
                <div className="flex gap-4 items-center">
                  <div className="w-28 h-20 bg-slate-900 border border-slate-750 rounded p-1.5 flex flex-col justify-between opacity-50 text-[5px]">
                    <div className="h-0.5 bg-red-400/40 rounded w-1/3"></div>
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-0.5 text-center text-yellow-400 font-black">MFA Bloqueado</div>
                  </div>
                  <ArrowRight size={14} className="text-slate-600 animate-pulse" />
                  
                  <div className={`w-28 h-44 bg-slate-900 border border-slate-750 rounded-xl p-2 relative flex flex-col justify-between ${!mfaApproved ? 'animate-[vibrate_0.5s_linear_infinite]' : ''}`}>
                    <div className="w-6 h-1.5 bg-slate-950 rounded-full mx-auto mb-1"></div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 flex-grow flex flex-col justify-between text-center space-y-1 text-[7px]">
                      <div className="space-y-0.5">
                        <span className="block text-[5px] bg-yellow-500/15 text-yellow-400 px-1 py-0.2 rounded-full w-fit mx-auto font-bold uppercase">MFA Alerta</span>
                        <span className="block font-black text-slate-350">¿Aprobar inicio de sesión?</span>
                      </div>
                      {!mfaApproved ? (
                        <button onClick={approveMfa} className="bg-green-600 hover:bg-green-700 text-white font-black text-[7px] py-1 px-1.5 rounded cursor-pointer transition-all active:scale-90">✓ APROBAR</button>
                      ) : (
                        <div className="bg-green-950/40 border border-green-900 text-green-400 font-black py-0.5 rounded">✓ APROBADO</div>
                      )}
                    </div>
                  </div>
                </div>
                <span className="block text-[8px] text-yellow-400 mt-3 font-bold animate-pulse text-center">
                  {!mfaApproved ? 'Haga clic en "APROBAR" en el celular virtual para continuar' : 'Login aprobado. El robot continúa.'}
                </span>
              </div>
            )}

            {simStep === 4 && (
              <div className="w-full h-full flex flex-col justify-center items-center p-2">
                <div className="w-full bg-slate-900 border border-slate-750 rounded-xl p-3 shadow-2xl text-[8px] space-y-1.5">
                  <div className="bg-slate-950 border-b border-slate-850 p-1 flex justify-between items-center text-[6px]">
                    <span className="font-bold text-slate-450">GESTOR DOCUMENTAL CORPORATIVO (ECM)</span>
                    <span className="text-[#39A900] font-black uppercase text-[5px] bg-[#39A900]/10 px-1 rounded animate-pulse">Robot Digitalizando...</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-left font-mono">
                    <div>
                      <span className="block text-[6px] text-slate-500 font-bold">EXPEDIENTE:</span>
                      <div className="bg-slate-950 border border-slate-800 p-0.5 rounded text-slate-350">{selectedDoc.metadata.expediente}</div>
                    </div>
                    <div>
                      <span className="block text-[6px] text-slate-500 font-bold">TIPOLOGÍA:</span>
                      <div className="bg-slate-950 border border-[#39A900]/30 p-0.5 rounded text-[#39A900]">{selectedDoc.type}</div>
                    </div>
                    <div>
                      <span className="block text-[6px] text-slate-500 font-bold">SOLICITANTE:</span>
                      <div className="bg-slate-950 border border-slate-800 p-0.5 rounded text-slate-350 truncate">{selectedDoc.metadata.solicitante}</div>
                    </div>
                    <div>
                      <span className="block text-[6px] text-slate-500 font-bold">IDENTIFICACIÓN:</span>
                      <div className="bg-slate-950 border border-slate-800 p-0.5 rounded text-slate-350">{selectedDoc.metadata.cedula}</div>
                    </div>
                  </div>
                  <div className="space-y-0.5 border-t border-slate-800 pt-1.5 text-left">
                    <div className="flex justify-between text-[6px] text-slate-400 font-bold">
                      <span>Subiendo: {selectedDoc.title}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                      <div className="bg-[#39A900] h-full transition-all duration-100" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {simStep === 5 && (
              <div className="w-full h-full flex flex-col justify-center items-center space-y-2 p-2">
                <div className="bg-green-500/10 p-2.5 rounded-full border border-green-500/20 text-green-400"><CheckCircle size={28} /></div>
                <span className="text-[10px] font-black text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Radicado con Éxito</span>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-left w-full text-[8px] space-y-0.5 font-mono">
                  <span className="text-[#39A900] font-bold block uppercase tracking-wide">Resumen IA (Gemini):</span>
                  <p className="text-slate-400">"{selectedDoc.metadata.asunto} de {selectedDoc.metadata.solicitante}. Indexación y orden TRD completados al 100%."</p>
                </div>
              </div>
            )}
          </div>

          {/* Logs View */}
          <div className="lg:col-span-4 bg-slate-900/60 border border-slate-800 backdrop-blur-md rounded-2xl p-4 flex flex-col h-[320px]">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">3. Logs de Consola</h4>
            <div className="flex-grow bg-slate-950 rounded-xl p-3 font-mono text-[9px] text-slate-400 overflow-y-auto space-y-1 border border-slate-850 leading-relaxed text-left custom-scroll">
              {simLogs.length === 0 ? (
                <span className="text-slate-600 italic block text-center pt-24">Consola inactiva.</span>
              ) : (
                simLogs.map((log, index) => {
                  let colorClass = 'text-slate-400';
                  if (log.includes('[IA]')) colorClass = 'text-green-400';
                  else if (log.includes('[RPA]')) colorClass = 'text-cyan-400';
                  else if (log.includes('[SEGURIDAD]')) colorClass = 'text-yellow-400';
                  else if (log.includes('[SISTEMA]')) colorClass = 'text-emerald-400 font-bold';

                  return (
                    <div key={index} className={`${colorClass} whitespace-pre-wrap`}>
                      <span className="text-slate-655 mr-1.5">&gt;</span>
                      {log}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )
    },
    {
      // Diapositiva 8
      title: 'Innovación en Usabilidad: OCR por Recorte Dinámico',
      subtitle: 'Control y extracción visual interactiva del texto',
      speakerNotes: 'Explicar cómo funciona el recorte de texto para archivos sin capa digital (escaneos o fotocopias). Detallar que el backend corrige el canal alfa inyectando un fondo blanco sólido para garantizar que el texto no se vuelva ilegible sobre fondos transparentes.',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl text-left items-center animate-[fadeIn_0.5s_ease-out]">
          <div className="space-y-4">
            <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-white font-outfit mb-1">OCR por Selección de Ventana</h4>
              <p className="text-[11px] text-slate-400 leading-normal">Permite arrastrar el puntero del mouse sobre el PDF renderizado en el navegador para extraer cualquier metadato sin digitar.</p>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-white font-outfit mb-1">Corrección de Fondo de Canvas</h4>
              <p className="text-[11px] text-slate-400 leading-normal">Los navegadores web suelen procesar los recortes de imagen con fondo transparente. Inyectamos un color blanco sólido sólido antes del OCR para garantizar la legibilidad.</p>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-white font-outfit mb-1">Enfoque Automático y Flujo Ágil</h4>
              <p className="text-[11px] text-slate-400 leading-normal">Al terminar un recorte, el sistema ubica el cursor en el siguiente campo vacío del formulario, ahorrando clics.</p>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-850 rounded-2xl p-5 h-[280px] flex flex-col justify-between relative overflow-hidden shadow-2xl">
            <div className="bg-slate-950 border border-slate-850 p-2 rounded-lg flex justify-between items-center text-[8px] font-bold text-slate-400 font-mono">
              <span>VISOR DE PDF INTEGRADO</span>
              <span className="text-[#39A900] animate-pulse">● OCR CANAL ALFA</span>
            </div>
            
            <div className="relative w-full h-32 bg-white text-slate-800 rounded-lg p-3 flex flex-col justify-between font-mono text-[8px] border border-slate-200">
              <div className="absolute left-4 top-6 w-24 h-5 border border-dashed border-[#39A900] bg-[#39A900]/10 flex items-center justify-center font-bold text-[7px] text-[#39A900]">
                RECORTE ACTIVO
                <div className="absolute top-0 left-0 w-full h-0.5 bg-[#39A900] animate-[laser-move_2.5s_ease-in-out_infinite]"></div>
              </div>
              <div>
                <div className="h-1.5 w-12 bg-slate-350 rounded mb-1"></div>
                <div className="font-sans text-xs font-bold text-slate-900">CARLOS MARIO MENDOZA</div>
                <div className="text-slate-400 text-[7px] mt-0.5">Identificación: C.C. 1.082.944.221</div>
              </div>
              <div className="space-y-1">
                <div className="h-0.5 bg-slate-200 rounded w-full"></div>
                <div className="h-0.5 bg-slate-200 rounded w-5/6"></div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-[9px] text-left">
              <span className="text-slate-400 font-bold block mb-0.5">Resultado OCR en formulario:</span>
              <div className="bg-slate-950 border border-[#39A900]/30 p-1.5 rounded text-[#39A900] font-bold">
                Nombre: CARLOS MARIO MENDOZA <span className="animate-pulse font-normal">|</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      // Diapositiva 9
      title: 'Estructura y Organización Simétrica en OneDrive',
      subtitle: 'Sincronización directa y jerárquica con la nube institucional',
      speakerNotes: 'Explicar que el sistema organiza dinámicamente los expedientes en carpetas de OneDrive estructuradas por series y subseries según la TRD. Aplica nomenclatura legal numerada (01_Petición, 02_Cédula) e implementa hashes SHA-256 para evitar archivos duplicados.',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl text-left items-center animate-[fadeIn_0.5s_ease-out]">
          <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 font-mono text-[11px] text-slate-300 space-y-1.5 shadow-2xl h-[260px] overflow-y-auto custom-scroll">
            <div className="flex items-center gap-1.5 text-[#39A900] font-bold">
              📂 OneDrive Institucional
            </div>
            <div className="pl-3 border-l border-slate-800 ml-1 space-y-1.5 py-0.5">
              <div className="text-slate-400 flex items-center gap-1.5">📁 Regional Distrito Capital</div>
              <div className="pl-3 border-l border-slate-800 ml-1 space-y-1.5">
                <div className="text-slate-400 flex items-center gap-1.5">📁 Centro de Formación C.E.E.</div>
                <div className="pl-3 border-l border-slate-800 ml-1 space-y-1.5">
                  <div className="text-emerald-400 flex items-center gap-1.5">📁 Serie: 11-02 Comunicaciones</div>
                  <div className="pl-3 border-l border-slate-800 ml-1 space-y-1.5">
                    <div className="text-cyan-400 flex items-center gap-1.5">📁 Subserie: 11-02-05 Derechos Petición</div>
                    <div className="pl-3 border-l border-slate-800 ml-1 space-y-1.5">
                      <div className="text-yellow-400 flex items-center gap-1.5">📁 Expediente: Carlos Mendoza C.C. 1082</div>
                      <div className="pl-3 border-l border-slate-800 ml-1 text-[10px] text-slate-450 space-y-1">
                        <div>📄 01_DERECHO_DE_PETICION.pdf</div>
                        <div>📄 02_ANEXO_CEDULA.pdf</div>
                        <div className="text-[#39A900]">📄 Hoja_de_Control_Digital.json</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-white font-outfit mb-0.5">Estructura Jerárquica</h4>
              <p className="text-[11px] text-slate-400 leading-normal">Creación de carpetas automatizadas respetando la codificación exacta de las Tablas de Retención Documental.</p>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-white font-outfit mb-0.5">Nomenclatura Homologada</h4>
              <p className="text-[11px] text-slate-400 leading-normal">Ordenación de archivos numerada de acuerdo con el orden de radicación exigido por las normas de archivo vigentes.</p>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-white font-outfit mb-0.5">Validación Criptográfica</h4>
              <p className="text-[11px] text-slate-400 leading-normal">Comparación de hashes criptográficos para prevenir cargas accidentales de documentos duplicados en el mismo expediente.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      // Diapositiva 10
      title: 'Retorno de la Inversión (ROI) y Beneficios Tangibles',
      subtitle: 'Resultados operacionales medibles tras la adopción de SENA V2',
      speakerNotes: 'Concluir mostrando las métricas del sistema. Destacar los 3 grandes beneficios: Tiempo (de 10 minutos a 15 segundos), Precisión (99.8% seguro contra clasificaciones subjetivas erróneas) y cero errores de digitación de metadatos.',
      content: (
        <div className="w-full max-w-4xl text-left space-y-4 animate-[fadeIn_0.5s_ease-out]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            
            {/* Radial Circle 1: 95% */}
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl text-center flex flex-col items-center justify-between hover:border-[#39A900]/30 relative overflow-hidden group">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.03)" strokeWidth="8" fill="transparent" />
                  <circle cx="50" cy="50" r="40" stroke="#39A900" strokeWidth="8" fill="transparent" 
                    strokeDasharray="251.2" strokeDashoffset="12.56" className="transition-all duration-1000 ease-out" />
                </svg>
                <span className="absolute text-2xl font-black font-outfit text-white">95%</span>
              </div>
              <div className="space-y-1 mt-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-outfit">Reducción de Tiempo</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">De 10 minutos por indexación manual a solo 15 segundos mediante la clasificación automática.</p>
              </div>
            </div>
            
            {/* Radial Circle 2: 99.8% */}
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl text-center flex flex-col items-center justify-between hover:border-[#39A900]/30 relative overflow-hidden group">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.03)" strokeWidth="8" fill="transparent" />
                  <circle cx="50" cy="50" r="40" stroke="#06b6d4" stroke-width="8" fill="transparent" 
                    strokeDasharray="251.2" strokeDashoffset="0.5" className="transition-all duration-1000 ease-out" />
                </svg>
                <span className="absolute text-2xl font-black font-outfit text-white">99.8%</span>
              </div>
              <div className="space-y-1 mt-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-outfit">Precisión de Indexación</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">La IA identifica la tipología TRD de forma semántica basada en el contexto completo del folio.</p>
              </div>
            </div>
            
            {/* Radial Circle 3: 0% */}
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl text-center flex flex-col items-center justify-between hover:border-[#39A900]/30 relative overflow-hidden group">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-95" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.03)" strokeWidth="8" fill="transparent" />
                  <circle cx="50" cy="50" r="40" stroke="#10b981" stroke-width="8" fill="transparent" 
                    strokeDasharray="251.2" strokeDashoffset="251.2" className="transition-all duration-1000 ease-out" />
                </svg>
                <span className="absolute text-2xl font-black font-outfit text-white">0%</span>
              </div>
              <div className="space-y-1 mt-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-outfit">Errores de Digitación</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Inyección directa de metadatos del PDF al ECM mediante Puppeteer sin error tipográfico humano.</p>
              </div>
            </div>
            
          </div>
        </div>
      )
    },
    {
      // Diapositiva 11
      title: 'Hoja de Ruta de Implementación Organizacional',
      subtitle: 'Fases y tiempos estimados para el despliegue del sistema',
      speakerNotes: 'Describir la línea de tiempo de 7 semanas para la adopción en la organización. Fase 1: Diagnóstico/TRD, Fase 2: Configuración del backend y llaves de Gemini, Fase 3: Capacitación a funcionarios de archivo, y Fase 4: Escalado total.',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full max-w-4xl text-left pt-4 animate-[fadeIn_0.5s_ease-out]">
          <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl border-l-4 border-l-[#39A900]">
            <span className="text-[8px] font-bold text-[#39A900] bg-[#39A900]/10 px-2 py-0.5 rounded uppercase font-mono">Fase 1</span>
            <h4 className="text-xs font-bold text-white font-outfit mt-2 mb-1">Mapeo & TRD</h4>
            <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Diagnóstico de tipologías más comunes y configuración en base de datos. (Semana 1-2)</p>
          </div>
          <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl border-l-4 border-l-cyan-400">
            <span className="text-[8px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded uppercase font-mono">Fase 2</span>
            <h4 className="text-xs font-bold text-white font-outfit mt-2 mb-1">Servidor & Llaves</h4>
            <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Configuración de Express y credenciales de la API segura de Gemini. (Semana 3-4)</p>
          </div>
          <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl border-l-4 border-l-indigo-400">
            <span className="text-[8px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded uppercase font-mono">Fase 3</span>
            <h4 className="text-xs font-bold text-white font-outfit mt-2 mb-1">Capacitación Piloto</h4>
            <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Entrenamiento a personal de archivo y puesta en marcha piloto controlada. (Semana 5-6)</p>
          </div>
          <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl border-l-4 border-l-emerald-400">
            <span className="text-[8px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded uppercase font-mono">Fase 4</span>
            <h4 className="text-xs font-bold text-white font-outfit mt-2 mb-1">Escalabilidad</h4>
            <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Habilitación de robots desatendidos para cargas masivas paralelas. (Semana 7+)</p>
          </div>
        </div>
      )
    },
    {
      // Diapositiva 12
      title: 'El Futuro de la Gestión Pública Inteligente',
      subtitle: 'SENA V2',
      speakerNotes: 'Concluir la ponencia con el mensaje inspirador: la IA no reemplaza al talento humano, sino que lo libera del trabajo repetitivo e intelectualmente vacío. Agradecer formalmente y abrir ronda de preguntas.',
      content: (
        <div className="text-center space-y-6 max-w-2xl mx-auto animate-[fadeIn_0.5s_ease-out]">
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl shadow-xl relative overflow-hidden">
            <p className="text-sm text-slate-200 leading-relaxed font-light italic relative z-10">
              "La Inteligencia Artificial no viene a reemplazar al talento humano administrativo; viene a deponer el trabajo mecánico para permitirle enfocarse en el análisis, la toma de decisiones y el servicio empático al ciudadano."
            </p>
          </div>
          
          <div className="pt-2 flex justify-center">
            <span className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#39A900] to-emerald-500 text-white font-bold font-outfit text-xs tracking-wider shadow-lg uppercase">
              Muchísimas Gracias
            </span>
          </div>
        </div>
      )
    }
  ];

  // Render slides helper
  const slidesCount = slides.length;
  const slide = slides[currentSlide];

  return (
    <div ref={containerRef} className="min-h-[calc(100vh-80px)] bg-slate-950 text-slate-200 p-4 md:p-6 flex flex-col font-sans select-none rounded-2xl border border-slate-900 relative overflow-hidden">
      
      {/* Background drift animations */}
      <div className="absolute w-[400px] h-[400px] rounded-full bg-[#39A900]/10 filter blur-[90px] -top-20 -left-20 pointer-events-none animate-pulse"></div>
      <div className="absolute w-[300px] h-[300px] rounded-full bg-cyan-600/10 filter blur-[90px] -bottom-20 -right-20 pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>

      {/* HEADER CONTROLS */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-900 pb-4 mb-4 gap-4 z-10">
        <div>
          <h1 className="text-base md:text-lg font-black text-white flex items-center gap-2 uppercase tracking-wide font-outfit">
            <Zap size={16} className="text-[#39A900]" />
            Ponencia e Inteligencia Artificial
          </h1>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
            Material dinámico y simulador visual interactivo de hiperautomatización (RPA + IA)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Notes Toggle */}
          {allowNotes && (
            <button
              onClick={() => setShowNotes(!showNotes)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                showNotes 
                  ? 'bg-slate-900 border border-slate-700 text-white' 
                  : 'bg-slate-950 border border-slate-900 text-slate-500 hover:border-slate-800'
              }`}
              title="Mostrar/Ocultar Notas del Expositor"
            >
              <Info size={13} /> {showNotes ? 'Ocultar Notas' : 'Ver Notas'}
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                containerRef.current.requestFullscreen().catch(err => {
                  console.error("Error al entrar a pantalla completa:", err);
                });
              } else {
                document.exitFullscreen();
              }
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              isFullscreen 
                ? 'bg-[#39A900] text-white' 
                : 'bg-slate-950 border border-slate-900 text-slate-450 hover:border-slate-800'
            }`}
            title="Modo Proyector"
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {isFullscreen ? 'Vista Normal' : 'Modo Proyector'}
          </button>
        </div>
      </div>

      {/* CORE DISPLAY (GRID) */}
      <div className={`flex-grow grid gap-5 z-10 ${isFullscreen || !showNotes ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'}`}>
        
        {/* LEFT COMPONENT: THE SLIDE VIEW */}
        <div className={`bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-850 rounded-3xl p-5 md:p-6 flex flex-col justify-between shadow-2xl relative min-h-[460px] overflow-hidden ${
          isFullscreen || !showNotes ? '' : 'lg:col-span-8'
        }`}>
          {/* Top Info of Slide */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="text-[9px] font-black tracking-widest text-[#39A900] uppercase bg-[#39A900]/10 px-2.5 py-1 rounded-full">
                Diapositiva {currentSlide + 1} de {slidesCount}
              </span>
              <h2 className="text-xl md:text-2xl font-black text-white mt-2.5 tracking-tight font-outfit">{slide.title}</h2>
              <p className="text-xs text-slate-450 mt-0.5 font-medium">{slide.subtitle}</p>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button 
                onClick={prevSlide} 
                disabled={currentSlide === 0}
                className="p-1.5 bg-slate-900 border border-slate-850 hover:border-slate-700 disabled:opacity-30 rounded-lg cursor-pointer text-slate-300 transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              <button 
                onClick={nextSlide} 
                disabled={currentSlide === slidesCount - 1}
                className="p-1.5 bg-slate-900 border border-slate-850 hover:border-slate-700 disabled:opacity-30 rounded-lg cursor-pointer text-slate-300 transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Slide Interactive Content Container */}
          <div className="flex-grow flex flex-col justify-center py-2 h-full items-center">
            {slide.content}
          </div>

          {/* Bottom navigation helper */}
          <div className="flex items-center justify-between border-t border-slate-900/60 pt-4 mt-6 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            <span>Hiperautomatización con IA</span>
            <div className="flex gap-1">
              {Array.from({ length: slidesCount }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentSlide(idx);
                    resetSimulatorState();
                  }}
                  className={`w-2.5 h-1.5 rounded-full transition-all cursor-pointer ${idx === currentSlide ? 'bg-[#39A900] w-6' : 'bg-slate-850'}`}
                ></button>
              ))}
            </div>
            <span>Estrategia 180</span>
          </div>
        </div>

        {/* RIGHT COMPONENT: SPEAKER NOTES (visible if not fullscreen) */}
        {!isFullscreen && showNotes && (
          <div className="lg:col-span-4 bg-slate-900/60 border border-slate-850 rounded-3xl p-5 flex flex-col justify-between shadow-lg text-left">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Brain size={16} className="text-[#39A900]" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider font-outfit">Notas de Apoyo al Expositor</h3>
              </div>
              
              <div className="text-xs text-slate-350 leading-relaxed font-medium bg-slate-950/40 p-4 rounded-2xl border border-slate-850 max-h-[300px] overflow-y-auto custom-scroll">
                <p className="whitespace-pre-line">{slide.speakerNotes}</p>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 mt-4 space-y-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-mono">Consejo de Ponencia:</span>
              <div className="bg-[#39A900]/5 border border-[#39A900]/25 rounded-xl p-3 flex gap-2 text-[10px] text-slate-400 font-medium">
                <Info size={14} className="text-[#39A900] flex-shrink-0 mt-0.5" />
                <p className="leading-snug">
                  Use las flechas del teclado <kbd className="bg-slate-950 px-1 py-0.5 rounded font-mono">←</kbd> y <kbd className="bg-slate-950 px-1 py-0.5 rounded font-mono">→</kbd> para navegar de manera elegante mientras sostiene un pasador de diapositivas.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
