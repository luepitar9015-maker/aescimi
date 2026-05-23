import { useState, useEffect } from 'react';
import { 
  Zap, Brain, Keyboard, Smartphone, Play, CheckCircle, 
  AlertCircle, Calculator, Clock, ArrowRight, ChevronRight, 
  ChevronLeft, FileText, Maximize2, Minimize2, Check, Info, ShieldAlert
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
  const [showNotes, setShowNotes] = useState(true);

  // Calculator State
  const [dailyDocs, setDailyDocs] = useState(200);
  const [manualTime, setManualTime] = useState(4); // minutes per doc
  const [autoTime, setAutoTime] = useState(15); // seconds per doc

  // Simulator State
  const [selectedDocId, setSelectedDocId] = useState('peticion');
  const [simStep, setSimStep] = useState(0); // 0: Idle, 1: IA scanning, 2: SSO credentials, 3: MFA Phone, 4: RPA Typing ECM, 5: Done
  const [typedEmail, setTypedEmail] = useState('');
  const [typedPass, setTypedPass] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [simLogs, setSimLogs] = useState([]);
  const [mfaApproved, setMfaApproved] = useState(false);

  const selectedDoc = MOCK_DOCUMENTS.find(d => d.id === selectedDocId) || MOCK_DOCUMENTS[0];

  // --- KEYBOARD CONTROLS FOR SLIDES ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        prevSlide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide]);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(c => c + 1);
      // Reset simulator if moving slides
      setSimStep(0);
      setMfaApproved(false);
      setTypedEmail('');
      setTypedPass('');
      setUploadProgress(0);
      setSimLogs([]);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(c => c - 1);
      // Reset simulator
      setSimStep(0);
      setMfaApproved(false);
      setTypedEmail('');
      setTypedPass('');
      setUploadProgress(0);
      setSimLogs([]);
    }
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

    // Step 1: Scanning (2.5s)
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
    }, 2800);
  };

  const typeCredentials = () => {
    const email = 'exposicion.ia@organizacion.gov.co';
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
              }, 800);
            }
          }, 40);
        }, 600);
      }
    }, 45);
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
              `[IA] Resumen automático: "${selectedDoc.metadata.asunto} correspondiente a ${selectedDoc.metadata.solicitante} con fecha ${selectedDoc.metadata.fecha}."`,
              '[SISTEMA] Flujo de automatización terminado en 12.4 segundos.'
            ]);
          }, 800);
        }
      }, 150);
    }, 1500);
  };


  // --- PRESENTATION SLIDES DEFINITION ---
  const slides = [
    {
      title: 'El Trabajador Digital e Hiperautomatización',
      subtitle: 'El Futuro de la Gestión Documental Corporativa',
      speakerNotes: 'Comenzar dando la bienvenida al público. Aclarar que la gestión documental es el corazón de la administración pública y privada, pero suele consumir miles de horas humanas en tareas de copiar y pegar. Introducir el concepto de "Trabajador Digital" como una combinación de Inteligencia Artificial (cerebro/ojos) y Robots (brazos/manos) para librar a los funcionarios de la rutina repetitiva.',
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-[#39A900] blur-3xl opacity-20 rounded-full w-48 h-48 mx-auto -top-4"></div>
            <div className="relative bg-slate-900 border border-slate-700/60 p-6 rounded-3xl inline-flex items-center justify-center shadow-2xl">
              <Zap size={64} className="text-[#39A900] animate-pulse" />
            </div>
          </div>
          <div className="space-y-3">
            <span className="text-xs font-bold tracking-[0.2em] text-[#39A900] uppercase">Ponencia de 40 Minutos</span>
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
              EL TRABAJADOR DIGITAL
            </h2>
            <p className="text-slate-400 text-base md:text-lg max-w-xl mx-auto font-medium">
              Cómo la sinergia de Inteligencia Artificial y RPA elimina el trabajo aburrido y transforma la eficiencia de la organización.
            </p>
          </div>
          <div className="flex gap-3 justify-center pt-4">
            <span className="bg-slate-800 text-slate-300 border border-slate-700 text-xs px-4 py-2 rounded-full font-bold">📂 100% Sin Papel</span>
            <span className="bg-slate-800 text-slate-300 border border-slate-700 text-xs px-4 py-2 rounded-full font-bold">🤖 Robots de Software</span>
            <span className="bg-slate-800 text-[#39A900] border border-[#39A900]/30 text-xs px-4 py-2 rounded-full font-bold">✨ Gemini 1.5 Flash</span>
          </div>
        </div>
      )
    },
    {
      title: 'El Desafío: La Pesadilla Administrativa',
      subtitle: 'El impacto invisible del trabajo manual y repetitivo',
      speakerNotes: 'Aquí contamos la historia de "María". Explicar que un empleado dedica el 100% de su tiempo a abrir archivos PDF en la nube, leerlos uno por uno, deducir su tipo de trámite, abrir un portal corporativo, pasar por el login, escribir la misma información e indexar el archivo. Esto toma de 3 a 5 minutos por archivo. Invitar al público a participar usando la calculadora interactiva en pantalla para cuantificar el costo real.',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center h-full p-2">
          <div className="space-y-5 text-left">
            <div className="inline-flex items-center gap-2 bg-red-950/40 border border-red-900/50 text-red-400 px-3 py-1.5 rounded-xl text-xs font-bold">
              <ShieldAlert size={14} /> Fricción Operativa y Cansancio Humano
            </div>
            <h3 className="text-2xl md:text-3xl font-black text-white leading-tight">
              La historia de la indexación manual
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Diligenciar metadatos de documentos, clasificarlos de forma subjetiva y cargarlos a los repositorios centrales uno a uno es la mayor fuente de ineficiencia y errores tipográficos en los archivos corporativos.
            </p>
            
            {/* Steps card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">El Calvario del Usuario (3-5 minutos por archivo):</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex gap-2 text-slate-400"><span className="text-red-500 font-bold">1.</span> Leer e interpretar el PDF.</div>
                <div className="flex gap-2 text-slate-400"><span className="text-red-500 font-bold">2.</span> Ingresar al ECM con Microsoft SSO.</div>
                <div className="flex gap-2 text-slate-400"><span className="text-red-500 font-bold">3.</span> Digitar metadatos uno por uno.</div>
                <div className="flex gap-2 text-slate-400"><span className="text-red-500 font-bold">4.</span> Arrastrar, subir y archivar.</div>
              </div>
            </div>
          </div>

          {/* Interactive Calculator */}
          <div className="bg-slate-900/60 border border-slate-800 backdrop-blur-md rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#39A900]">
              <Calculator size={18} />
              <span className="text-sm font-bold uppercase tracking-wider text-slate-200">Calculadora de Ahorro Real</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Documentos diarios por procesar:</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" min="10" max="1000" step="10"
                    value={dailyDocs} onChange={(e) => setDailyDocs(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#39A900]"
                  />
                  <span className="text-sm font-black text-[#39A900] bg-slate-950 px-2 py-1 rounded w-16 text-center">{dailyDocs}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Minutos manuales / doc:</label>
                  <input 
                    type="number" min="1" max="15" 
                    value={manualTime} onChange={(e) => setManualTime(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 text-sm text-slate-200 p-2 rounded-xl focus:border-[#39A900] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Segundos robot / doc:</label>
                  <input 
                    type="number" min="5" max="60" 
                    value={autoTime} onChange={(e) => setAutoTime(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 text-sm text-slate-200 p-2 rounded-xl focus:border-[#39A900] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-3 rounded-2xl border border-slate-850">
              <div className="text-center p-2">
                <span className="block text-xs font-bold text-slate-400">T. Manual</span>
                <span className="text-sm font-black text-red-500">{dailyManualHours.toFixed(1)} hrs</span>
              </div>
              <div className="text-center p-2 border-x border-slate-850">
                <span className="block text-xs font-bold text-slate-400">T. Robot</span>
                <span className="text-sm font-black text-green-500">{(dailyAutoHours * 60).toFixed(1)} mins</span>
              </div>
              <div className="text-center p-2">
                <span className="block text-xs font-bold text-slate-400">Velocidad</span>
                <span className="text-sm font-black text-[#39A900]">{relativeSpeed}x</span>
              </div>
            </div>

            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 text-center">
              <p className="text-xs text-slate-300">
                Liberas <strong className="text-[#39A900]">{timeSavedHours.toFixed(1)} horas/día</strong> del personal. Ahorras <strong className="text-[#39A900]">{monthlySavedDays.toFixed(1)} días laborales</strong> al mes.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Hiperautomatización: RPA + Inteligencia Artificial',
      subtitle: 'La conjunción de manos y cerebro en un solo sistema',
      speakerNotes: 'Explicar la diferencia entre Automatización Tradicional (RPA) e Hiperautomatización. La automatización tradicional es ciega: pulsa botones mecánicamente. Si hay un documento en un formato nuevo, no sabe qué hacer. Con la Hiperautomatización, unimos RPA con Inteligencia Artificial. La IA lee y comprende, y le pasa los datos estructurados al robot de software. Así el robot actúa como los brazos (clics y escritura) y la IA actúa como el cerebro y ojos (clasificación e indexación).',
      content: (
        <div className="flex flex-col justify-center h-full space-y-6 p-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Brain Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 hover:border-[#39A900]/30 transition-all flex gap-4 text-left">
              <div className="bg-[#39A900]/10 p-3 rounded-2xl h-fit">
                <Brain size={28} className="text-[#39A900]" />
              </div>
              <div className="space-y-2">
                <h4 className="text-base font-black text-white">El Cerebro (Inteligencia Artificial)</h4>
                <span className="inline-block text-[10px] uppercase font-bold text-[#39A900] bg-[#39A900]/15 px-2 py-0.5 rounded">Gemini 1.5 Flash</span>
                <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                  <li>Lee y extrae texto de PDFs escaneados y digitales.</li>
                  <li>Clasifica la tipología documental con razonamiento cognitivo.</li>
                  <li>Deduce metadatos implícitos (cédulas, nombres, fechas).</li>
                  <li>Resume expedientes completos al instante.</li>
                </ul>
              </div>
            </div>

            {/* Arms Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 hover:border-[#39A900]/30 transition-all flex gap-4 text-left">
              <div className="bg-blue-500/10 p-3 rounded-2xl h-fit">
                <Zap size={28} className="text-blue-400" />
              </div>
              <div className="space-y-2">
                <h4 className="text-base font-black text-white">Los Brazos (Robot RPA)</h4>
                <span className="inline-block text-[10px] uppercase font-bold text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded">Puppeteer Browser Engine</span>
                <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                  <li>Controla el navegador web de forma autónoma.</li>
                  <li>Resuelve el inicio de sesión corporativo (Microsoft SSO).</li>
                  <li>Inserta datos, navega y selecciona opciones en el ECM.</li>
                  <li>Sube archivos directamente desde repositorios en la nube.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Workflow Flowchart in text form */}
          <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-3">Flujo del Proceso Automatizado</h4>
            <div className="flex flex-wrap md:flex-nowrap justify-between items-center gap-2 text-xs">
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl w-full text-center">
                <FileText size={14} className="mx-auto mb-1 text-slate-400" />
                <span className="font-bold text-slate-300">1. Documento PDF</span>
              </div>
              <ChevronRight size={14} className="text-slate-600 hidden md:block" />
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl w-full text-center">
                <Brain size={14} className="mx-auto mb-1 text-[#39A900]" />
                <span className="font-bold text-[#39A900]">2. Clasificación IA</span>
              </div>
              <ChevronRight size={14} className="text-slate-600 hidden md:block" />
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl w-full text-center">
                <Smartphone size={14} className="mx-auto mb-1 text-yellow-400" />
                <span className="font-bold text-yellow-400">3. Login + MFA</span>
              </div>
              <ChevronRight size={14} className="text-slate-600 hidden md:block" />
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl w-full text-center">
                <Keyboard size={14} className="mx-auto mb-1 text-blue-400" />
                <span className="font-bold text-blue-400">4. Digitación RPA</span>
              </div>
              <ChevronRight size={14} className="text-slate-600 hidden md:block" />
              <div className="bg-slate-900 border border-[#39A900]/30 p-2.5 rounded-xl w-full text-center">
                <CheckCircle size={14} className="mx-auto mb-1 text-[#39A900]" />
                <span className="font-bold text-slate-300">5. Éxito Radicado</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Simulador del Trabajador Digital',
      subtitle: 'Vea el procesamiento inteligente en tiempo real',
      speakerNotes: 'Esta es la demostración en vivo más importante. Explicarle a la audiencia lo que pasará: Primero, seleccionaremos uno de los tres archivos de ejemplo. El simulador representará cada una de las fases en vivo. En el paso 1, la IA escaneará el documento e identificará los datos. En el paso 2, el robot emulará el inicio de sesión institucional escribiendo en pantalla. En el paso 3, simulará el sistema de MFA requiriendo que hagamos clic en el celular para aprobar. En el paso 4, veremos al robot digitar a toda velocidad los campos del Gestor Documental y finalmente veremos el resultado. Iniciar la simulación en pantalla.',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full p-1 text-left">
          
          {/* Doc selector and preview (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">1. Seleccione Documento</h4>
            <div className="space-y-2">
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
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText size={14} className={selectedDocId === doc.id ? 'text-[#39A900]' : 'text-slate-500'} />
                    <span className="font-bold truncate">{doc.title}</span>
                  </div>
                  <span className="block text-[10px] text-slate-500 mt-1 uppercase font-semibold">TIPO: {doc.type}</span>
                </button>
              ))}
            </div>

            {/* Quick Action */}
            <div className="pt-2">
              {simStep === 0 || simStep === 5 ? (
                <button
                  onClick={startSimulation}
                  className="w-full bg-[#39A900] text-white hover:bg-[#329600] font-black text-xs p-3 rounded-xl shadow-lg shadow-[#39A900]/20 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <Play size={14} /> Iniciar Simulación
                </button>
              ) : (
                <button
                  onClick={() => setSimStep(0)}
                  className="w-full bg-slate-800 text-slate-300 hover:bg-slate-750 font-bold text-xs p-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  Reiniciar
                </button>
              )}
            </div>

            {/* Document Content Preview */}
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 h-32 overflow-y-auto font-mono text-[9px] text-slate-500 leading-normal relative">
              <span className="absolute top-1 right-2 bg-slate-900 px-1.5 py-0.5 rounded text-[8px] uppercase font-bold text-slate-400">PDF original</span>
              {selectedDoc.textPreview}
            </div>
          </div>

          {/* Active Phase Canvas (5 cols) */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-850 rounded-3xl p-4 flex flex-col h-[360px] relative overflow-hidden">
            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#39A900] animate-ping"></span>
              2. Visualizador del Proceso
            </h4>

            {/* Simulation Canvas states */}
            <div className="flex-grow flex flex-col justify-center items-center relative">
              
              {/* STATE 0: Idle */}
              {simStep === 0 && (
                <div className="text-center space-y-3">
                  <div className="bg-slate-900 p-4 rounded-full inline-block border border-slate-800">
                    <Zap size={32} className="text-[#39A900]" />
                  </div>
                  <h5 className="text-sm font-bold text-slate-300">Esperando Inicio de Simulación</h5>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">Seleccione uno de los archivos del menú de la izquierda y presione el botón verde para correr la demo.</p>
                </div>
              )}

              {/* STATE 1: IA Scanning */}
              {simStep === 1 && (
                <div className="w-full h-full flex flex-col justify-center items-center space-y-4 p-2 relative">
                  {/* Mock PDF Container with laser line */}
                  <div className="w-48 h-56 bg-slate-900 border border-slate-750 rounded-lg p-3 relative overflow-hidden shadow-2xl flex flex-col justify-between">
                    {/* LASER LINE */}
                    <div className="absolute left-0 right-0 h-0.5 bg-green-400 shadow-[0_0_8px_#4ade80] animate-laser"></div>
                    
                    <div className="space-y-2">
                      <div className="h-2 w-1/3 bg-slate-700 rounded"></div>
                      <div className="h-1.5 w-full bg-slate-800 rounded"></div>
                      <div className="h-1.5 w-5/6 bg-slate-850 rounded"></div>
                      <div className="h-1.5 w-full bg-slate-850 rounded"></div>
                    </div>

                    <div className="space-y-1.5">
                      {/* Highlight marks matching extracted metadata */}
                      <div className="h-3 w-1/2 bg-[#39A900]/20 border border-[#39A900]/40 rounded p-1 text-[7px] text-[#39A900] font-black truncate flex items-center gap-1">
                        <Check size={8} /> {selectedDoc.metadata.solicitante}
                      </div>
                      <div className="h-3 w-2/3 bg-blue-500/20 border border-blue-500/40 rounded p-1 text-[7px] text-blue-400 font-black truncate flex items-center gap-1">
                        <Check size={8} /> {selectedDoc.metadata.cedula}
                      </div>
                    </div>
                  </div>
                  <div className="text-center space-y-1 z-15">
                    <span className="text-xs font-black text-[#39A900] bg-[#39A900]/10 px-2.5 py-1 rounded-full uppercase tracking-widest">IA Escaneando PDF</span>
                    <span className="block text-[10px] text-slate-500">Ejecutando visión por computadora y análisis semántico...</span>
                  </div>
                </div>
              )}

              {/* STATE 2: RPA SSO login typing */}
              {simStep === 2 && (
                <div className="w-full h-full flex flex-col justify-center items-center p-3">
                  {/* Mock SSO browser card */}
                  <div className="w-full max-w-sm bg-white text-slate-800 rounded-2xl p-4 shadow-2xl border border-slate-200 text-xs space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                      <span className="text-[10px] font-bold text-slate-400 font-mono tracking-tight truncate">login.microsoftonline.com/auth</span>
                    </div>
                    
                    <div className="text-center space-y-1 pt-1">
                      <span className="text-[14px] font-black tracking-tight text-slate-700">Inicio de Sesión Corporativo</span>
                      <span className="block text-[9px] text-slate-400">Redirección automática por Single Sign-On (SSO)</span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Correo Institucional:</label>
                        <div className="bg-slate-50 border border-slate-200 p-1.5 rounded-lg text-[10px] font-semibold text-slate-700 font-mono min-h-[26px]">
                          {typedEmail}
                          <span className="animate-blink">|</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Contraseña:</label>
                        <div className="bg-slate-50 border border-slate-200 p-1.5 rounded-lg text-[10px] font-semibold text-slate-700 font-mono min-h-[26px]">
                          {'•'.repeat(typedPass.length)}
                          {typedEmail.length >= 30 && <span className="animate-blink">|</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <span className="block text-[10px] text-slate-400 mt-3 font-semibold">Robot digitando credenciales del usuario expositor...</span>
                </div>
              )}

              {/* STATE 3: MFA Phone screen */}
              {simStep === 3 && (
                <div className="w-full h-full flex flex-col justify-center items-center p-2">
                  <div className="flex gap-6 items-center">
                    
                    {/* Visual laptop mock */}
                    <div className="w-36 h-28 bg-slate-900 border border-slate-700 rounded-lg p-2 flex flex-col justify-between opacity-60">
                      <div className="h-1 bg-red-400/40 rounded w-1/2"></div>
                      <div className="space-y-1">
                        <div className="h-1 bg-slate-800 rounded"></div>
                        <div className="h-1 bg-slate-800 rounded"></div>
                      </div>
                      <div className="h-3 bg-yellow-500/20 border border-yellow-500/40 rounded text-[6px] text-center text-yellow-400 font-black">
                        Bloqueado por MFA
                      </div>
                    </div>

                    {/* Arrow */}
                    <ArrowRight size={20} className="text-slate-600 animate-pulse" />

                    {/* Visual Cell Phone Mock */}
                    <div className={`w-36 h-56 bg-slate-900 border border-slate-750 rounded-2xl p-2 relative shadow-2xl flex flex-col justify-between ${!mfaApproved ? 'animate-vibrate' : ''}`}>
                      <div className="w-10 h-3 bg-slate-950 rounded-full mx-auto mb-1"></div>
                      
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2 flex-grow flex flex-col justify-between text-center space-y-2">
                        <div className="space-y-1 pt-2">
                          <span className="text-[8px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded-full font-bold uppercase">MFA Alerta</span>
                          <span className="block text-[8px] font-black text-slate-300">¿Desea aprobar inicio de sesión?</span>
                          <span className="block text-[6px] text-slate-500">Ubicación: Bogotá, Colombia</span>
                        </div>

                        {!mfaApproved ? (
                          <button
                            onClick={approveMfa}
                            className="bg-green-600 hover:bg-green-700 text-white font-black text-[9px] py-1.5 px-2 rounded-lg cursor-pointer transition-all active:scale-90"
                          >
                            ✓ APROBAR LOGIN
                          </button>
                        ) : (
                          <div className="bg-green-950/40 border border-green-900 text-green-400 font-black text-[9px] py-1 rounded-lg">
                            ✓ APROBADO
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                  <span className="block text-[10px] text-yellow-400 mt-4 font-bold animate-pulse text-center">
                    {!mfaApproved ? 'HAGA CLIC en "APROBAR" en el celular virtual para continuar' : 'Autenticación completada. El robot continúa.'}
                  </span>
                </div>
              )}

              {/* STATE 4: RPA typing into ECM */}
              {simStep === 4 && (
                <div className="w-full h-full flex flex-col justify-center items-center p-3">
                  
                  {/* Mock ECM Portal */}
                  <div className="w-full bg-slate-900 border border-slate-700/60 rounded-xl p-3 shadow-2xl text-[9px] space-y-2">
                    <div className="bg-slate-950 p-1.5 border-b border-slate-800 flex justify-between items-center">
                      <span className="font-bold text-slate-400">GESTOR DOCUMENTAL CORPORATIVO (ECM)</span>
                      <span className="text-[#39A900] font-black uppercase text-[7px] bg-[#39A900]/10 px-1.5 py-0.5 rounded">Robot Procesando...</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-left">
                      <div>
                        <span className="block text-[8px] text-slate-500 font-bold">EXPEDIENTE:</span>
                        <div className="bg-slate-950 border border-slate-800 p-1 rounded font-semibold text-slate-300 font-mono">
                          {selectedDoc.metadata.expediente}
                        </div>
                      </div>
                      <div>
                        <span className="block text-[8px] text-slate-500 font-bold">TIPOLOGÍA DOCUMENTAL:</span>
                        <div className="bg-slate-950 border border-[#39A900]/40 p-1 rounded font-semibold text-[#39A900] font-mono">
                          {selectedDoc.type}
                        </div>
                      </div>
                      <div>
                        <span className="block text-[8px] text-slate-500 font-bold">SOLICITANTE / TITULAR:</span>
                        <div className="bg-slate-950 border border-slate-800 p-1 rounded font-semibold text-slate-300 font-mono truncate">
                          {selectedDoc.metadata.solicitante}
                        </div>
                      </div>
                      <div>
                        <span className="block text-[8px] text-slate-500 font-bold">IDENTIFICACIÓN / NIT:</span>
                        <div className="bg-slate-950 border border-slate-800 p-1 rounded font-semibold text-slate-300 font-mono">
                          {selectedDoc.metadata.cedula}
                        </div>
                      </div>
                    </div>

                    {/* Progress upload visual */}
                    <div className="space-y-1 border-t border-slate-800 pt-2 text-left">
                      <div className="flex justify-between text-[8px] font-bold text-slate-400">
                        <span>Adjuntando archivo: {selectedDoc.title}</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#39A900] h-full transition-all duration-150" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    </div>
                  </div>
                  
                  <span className="block text-[9px] text-slate-500 mt-3 font-semibold">Robot Puppeteer digitando metadatos y subiendo PDF al Gestor Documental.</span>
                </div>
              )}

              {/* STATE 5: Done */}
              {simStep === 5 && (
                <div className="w-full h-full flex flex-col justify-center items-center space-y-3 p-2">
                  <div className="bg-green-500/10 p-3 rounded-full border border-green-500/20 text-green-400">
                    <CheckCircle size={36} />
                  </div>
                  <div className="text-center space-y-1">
                    <span className="text-xs font-black text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">Radicado con Éxito</span>
                    <span className="block text-[10px] text-slate-500">Documento indexado y archivado de manera automática</span>
                  </div>

                  {/* IA summary box */}
                  <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3 text-left w-full text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-[#39A900] font-bold">
                      <Brain size={12} />
                      <span className="text-[10px] uppercase font-black">Resumen Cognitivo de Gemini:</span>
                    </div>
                    <p className="text-slate-400 leading-normal text-[10px]">
                      "{selectedDoc.metadata.asunto} correspondiente al ciudadano/entidad {selectedDoc.metadata.solicitante} con número de identificación {selectedDoc.metadata.cedula}. El documento ha sido clasificado e indexado en el expediente {selectedDoc.metadata.expediente} con un 0% de errores de digitación."
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Execution logs / Terminal (4 cols) */}
          <div className="lg:col-span-4 bg-slate-900/60 border border-slate-800 backdrop-blur-md rounded-3xl p-4 flex flex-col h-[360px]">
            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              3. Consola de Ejecución en Vivo
            </h4>
            
            <div className="flex-grow bg-slate-950 rounded-2xl p-3 font-mono text-[9px] text-slate-400 overflow-y-auto space-y-1.5 border border-slate-850 leading-relaxed">
              {simLogs.length === 0 ? (
                <span className="text-slate-600 italic block text-center pt-20">Ninguna simulación activa. Presione "Iniciar Simulación" para ver la consola.</span>
              ) : (
                simLogs.map((log, index) => {
                  let colorClass = 'text-slate-400';
                  if (log.includes('[IA]')) colorClass = 'text-green-400';
                  else if (log.includes('[RPA]')) colorClass = 'text-blue-400';
                  else if (log.includes('[SEGURIDAD]')) colorClass = 'text-yellow-400';
                  else if (log.includes('[SISTEMA]')) colorClass = 'text-emerald-400 font-bold';

                  return (
                    <div key={index} className={`${colorClass} whitespace-pre-wrap`}>
                      <span className="text-slate-600 select-none mr-1.5">&gt;</span>
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
      title: 'Métricas de Impacto Operativo',
      subtitle: 'Beneficios tangibles de la hiperautomatización con IA',
      speakerNotes: 'Concluir mostrando las métricas del sistema. Destacar los 4 grandes beneficios: 1. Tiempo: Reducción de minutos a segundos por archivo. 2. Precisión: Eliminación de equivocaciones al tipear cédulas o nombres (que en archivos físicos/digitales causa pérdidas). 3. Disponibilidad: Procesamiento nocturno continuado sin cansancio. 4. Satisfacción: El personal ya no hace labores de copiar y pegar, permitiéndoles dedicarse al verdadero análisis documental y atención al usuario.',
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 h-full items-center p-2">
          {/* Card 1 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 hover:scale-[1.02] hover:border-[#39A900]/30 transition-all text-left space-y-3">
            <div className="bg-[#39A900]/10 p-2.5 rounded-xl h-fit w-fit text-[#39A900]">
              <Clock size={20} />
            </div>
            <div className="space-y-1">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">TIEMPO PROMEDIO</span>
              <h4 className="text-xl font-black text-white">4 Minutos a 15s</h4>
              <p className="text-[11px] text-slate-400 leading-normal">El robot radique y sube el archivo un 1600% más rápido que la digitación manual tradicional del operador.</p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 hover:scale-[1.02] hover:border-[#39A900]/30 transition-all text-left space-y-3">
            <div className="bg-[#39A900]/10 p-2.5 rounded-xl h-fit w-fit text-[#39A900]">
              <CheckCircle size={20} />
            </div>
            <div className="space-y-1">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">PRECISIÓN DE DATOS</span>
              <h4 className="text-xl font-black text-white">0% Errores de Indexación</h4>
              <p className="text-[11px] text-slate-400 leading-normal">Los metadatos son extraídos por la IA y validados lógicamente contra la base de datos central antes de subir.</p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 hover:scale-[1.02] hover:border-[#39A900]/30 transition-all text-left space-y-3">
            <div className="bg-[#39A900]/10 p-2.5 rounded-xl h-fit w-fit text-[#39A900]">
              <Zap size={20} />
            </div>
            <div className="space-y-1">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">DISPONIBILIDAD</span>
              <h4 className="text-xl font-black text-white">Operación 24/7</h4>
              <p className="text-[11px] text-slate-400 leading-normal">El sistema puede programarse para ejecutarse en lotes nocturnos, amaneciendo con los repositorios al día.</p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 hover:scale-[1.02] hover:border-[#39A900]/30 transition-all text-left space-y-3">
            <div className="bg-[#39A900]/10 p-2.5 rounded-xl h-fit w-fit text-[#39A900]">
              <Brain size={20} />
            </div>
            <div className="space-y-1">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">VALOR HUMANO</span>
              <h4 className="text-xl font-black text-white">Felicidad y Análisis</h4>
              <p className="text-[11px] text-slate-400 leading-normal">Libera a los empleados del copy-paste repetitivo, permitiéndoles enfocar su talento en el análisis de peticiones y contratos.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Espacio de Preguntas y Cierre',
      subtitle: 'Diálogo interactivo con la audiencia',
      speakerNotes: 'Dar espacio a las preguntas. En pantalla se exponen las tres dudas más comunes de la junta directiva o del público para que sirvan de disparador visual. Concluir la ponencia con un mensaje fuerte: La tecnología no viene a reemplazar al humano, sino a devolverle el tiempo de ser humano. Agradecer y cerrar.',
      content: (
        <div className="flex flex-col justify-center h-full max-w-3xl mx-auto space-y-6 p-2 text-left">
          <div className="bg-slate-900 border border-[#39A900]/20 p-5 rounded-3xl text-center space-y-2">
            <h4 className="text-lg font-black text-white">"La automatización no reemplaza el talento humano..."</h4>
            <p className="text-sm text-slate-400">"...le devuelve el tiempo de analizar, tomar decisiones y crear valor real."</p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest text-center">Preguntas Frecuentes del Público</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl space-y-1.5">
                <span className="font-bold text-[#39A900] flex items-center gap-1.5">
                  <Info size={12} /> ¿Qué pasa si el formulario del ECM cambia?
                </span>
                <p className="text-slate-400 leading-relaxed">
                  El robot cuenta con selectores lógicos flexibles. Si el diseño web tiene cambios menores, el motor se auto-cura buscando patrones semánticos alternos.
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl space-y-1.5">
                <span className="font-bold text-[#39A900] flex items-center gap-1.5">
                  <Info size={12} /> ¿Es segura la información enviada a la IA?
                </span>
                <p className="text-slate-400 leading-relaxed">
                  La comunicación es privada. Los datos son procesados temporalmente bajo políticas de privacidad y protección empresarial estrictas, sin entrenamiento público.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  // Render slides helper
  const slidesCount = slides.length;
  const slide = slides[currentSlide];

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-950 text-slate-200 p-4 md:p-6 flex flex-col font-sans select-none rounded-2xl border border-slate-900">
      
      {/* HEADER CONTROLS */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-900 pb-4 mb-4 gap-4">
        <div>
          <h1 className="text-lg md:text-xl font-black text-white flex items-center gap-2 uppercase tracking-wide">
            <Zap size={18} className="text-[#39A900]" />
            Ponencia e Inteligencia Artificial
          </h1>
          <p className="text-xs text-slate-500">
            Material dinámico y simulador visual interactivo de hiperautomatización (RPA + IA).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Notes Toggle */}
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              showNotes 
                ? 'bg-slate-900 border border-slate-700 text-white' 
                : 'bg-slate-950 border border-slate-900 text-slate-500 hover:border-slate-800'
            }`}
            title="Mostrar/Ocultar Notas del Expositor"
          >
            <Info size={14} /> {showNotes ? 'Ocultar Notas' : 'Ver Notas'}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              isFullscreen 
                ? 'bg-[#39A900] text-white' 
                : 'bg-slate-950 border border-slate-900 text-slate-400 hover:border-slate-800'
            }`}
            title="Modo Proyector"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {isFullscreen ? 'Vista Normal' : 'Modo Proyector'}
          </button>
        </div>
      </div>

      {/* CORE DISPLAY (GRID) */}
      <div className={`flex-grow grid gap-5 ${isFullscreen || !showNotes ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'}`}>
        
        {/* LEFT COMPONENT: THE SLIDE VIEW */}
        <div className={`bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-850 rounded-3xl p-5 md:p-8 flex flex-col justify-between shadow-2xl relative min-h-[460px] overflow-hidden ${
          isFullscreen || !showNotes ? '' : 'lg:col-span-8'
        }`}>
          {/* Top Info of Slide */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="text-[10px] font-black tracking-widest text-[#39A900] uppercase bg-[#39A900]/10 px-2.5 py-1 rounded-full">
                Diapositiva {currentSlide + 1} de {slidesCount}
              </span>
              <h2 className="text-xl md:text-2xl font-black text-white mt-2.5 tracking-tight">{slide.title}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{slide.subtitle}</p>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button 
                onClick={prevSlide} 
                disabled={currentSlide === 0}
                className="p-1.5 bg-slate-900 border border-slate-850 hover:border-slate-700 disabled:opacity-30 rounded-lg cursor-pointer text-slate-300 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={nextSlide} 
                disabled={currentSlide === slidesCount - 1}
                className="p-1.5 bg-slate-900 border border-slate-850 hover:border-slate-700 disabled:opacity-30 rounded-lg cursor-pointer text-slate-300 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Slide Interactive Content Container */}
          <div className="flex-grow flex flex-col justify-center py-2 h-full">
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
                    setSimStep(0);
                  }}
                  className={`w-2.5 h-1.5 rounded-full transition-all cursor-pointer ${idx === currentSlide ? 'bg-[#39A900] w-6' : 'bg-slate-800'}`}
                ></button>
              ))}
            </div>
            <span>Estrategia 180</span>
          </div>
        </div>

        {/* RIGHT COMPONENT: SPEAKER NOTES (visible if not fullscreen) */}
        {!isFullscreen && showNotes && (
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800/80 rounded-3xl p-5 flex flex-col justify-between shadow-lg text-left">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Brain size={18} className="text-[#39A900]" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Notas de Apoyo al Expositor</h3>
              </div>
              
              <div className="text-xs text-slate-300 leading-relaxed font-medium bg-slate-950/40 p-4 rounded-2xl border border-slate-850 max-h-[300px] overflow-y-auto">
                <p className="whitespace-pre-line">{slide.speakerNotes}</p>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 mt-4 space-y-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Consejo de Ponencia:</span>
              <div className="bg-[#39A900]/5 border border-[#39A900]/25 rounded-2xl p-3 flex gap-2.5 text-[10px] text-slate-400">
                <Info size={16} className="text-[#39A900] flex-shrink-0" />
                <p className="leading-snug">
                  Use las flechas del teclado <kbd className="bg-slate-950 px-1 py-0.5 rounded font-mono">←</kbd> y <kbd className="bg-slate-950 px-1 py-0.5 rounded font-mono">→</kbd> para navegar de manera elegante mientras sostiene un pasador de diapositivas o interactúa con el público.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
