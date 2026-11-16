const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const EventEmitter = require('events');
const db = require('../database');
const { pool } = require('../database_pg');

const automationEmitter = new EventEmitter();
automationEmitter.setMaxListeners(20);

const wait = (ms) => new Promise(r => setTimeout(r, ms));

let activeBrowser = null;
let activePage = null;

// ─────────────────────────────────────────────────────────────────
// CATÁLOGO OFICIAL TIPOLOGÍAS SEGÚN AES (HISTORIAS ACADÉMICAS)
// ─────────────────────────────────────────────────────────────────
const HISTORIAS_ACADEMICAS_MAP = {
    'DOCUMENTO DE IDENTIDAD VIGENTE': 'DOCUMENTO DE IDENTIDAD VIGENTE',
    'REGISTRO DEL SISTEMA DE MATRICULA ESTUDIANTIL DE EDUCACION BASICA Y MEDIA- SIMAT, ARTICULACION CON LA MEDIA': 'REGISTRO DEL SISTEMA DE MATRICULA ESTUDIANTIL DE EDUCACION BASICA',
    'REGISTRO DEL SISTEMA DE MATRICULA ESTUDIANTIL DE EDUCACION BASICA': 'REGISTRO DEL SISTEMA DE MATRICULA ESTUDIANTIL DE EDUCACION BASICA',
    'ACTA DE COMPROMISO DEL APRENDIZ': 'ACTA DE COMPROMISO DEL APRENDIZ',
    'AUTORIZACION DE DATOS DE MENOR DE EDAD': 'AUTORIZACION DE DATOS DE MENOR DE EDAD',
    'DOCUMENTO DE IDENTIFICACION DEL PADRE, TUTOR O ACUDIENTE': 'DOCUMENTO DE IDENTIFICACION DEL PADRE, TUTOR O ACUDIENTE',
    'CERTIFICADOS ACADEMICOS PARA EL PROCESO DE MATRICULA SALVO REGULACION ESPECIAL': 'CERTIFICADOS ACADEMICOS PARA EL PROCESO DE MATRICULA (SALVO REGULA',
    'CERTIFICADOS ACADEMICOS PARA EL PROCESO DE MATRICULA (SALVO REGULA': 'CERTIFICADOS ACADEMICOS PARA EL PROCESO DE MATRICULA (SALVO REGULA',
    'DOCUMENTO DE CONVALIDACION DE CERTIFICADOS ACADEMICOS U OTROS': 'DOCUMENTO DE CONVALIDACION DE CERTIFICADOS ACADEMICOS U OTROS',
    'CERTIFICADO DE AFILIACION EPS': 'CERTIFICADO DE AFILIACION EPS',
    '8. CERTIFICADO DE AFILIACION EPS': 'CERTIFICADO DE AFILIACION EPS',
    '08. CERTIFICADO DE AFILIACION EPS': 'CERTIFICADO DE AFILIACION EPS',
    'CERTIFICADO DE AFILIACION A EPS': 'CERTIFICADO DE AFILIACION EPS',
    'CERTIFICADO DE AFILIACION A LA EPS': 'CERTIFICADO DE AFILIACION EPS',
    'CERTIFICADO AFILIACION EPS': 'CERTIFICADO DE AFILIACION EPS',
    'RESULTADO PRUEBA ICFES, SABER 11': 'RESULTADO PRUEBA ICFES, SABER 11',
    'REGISTRO DE ASISTENCIA PARA FORMALIZAR MATRICULA': 'REGISTRO DE ASISTENCIA PARA FORMALIZAR MATRICULA',
    'CONSTANCIA DE RECONOCIMIENTO PARA PENSION DE SOBREVIVIENTES': 'CONSTANCIA DE RECONOCIMIENTO PARA PENSION DE SOBREVIVIENTES',
    'LLAMADO DE ATENCION ESCRITO ACADEMICO O DISCIPLINARIO': 'LLAMADO DE ATENCION ESCRITO ACADEMICO O DISCIPLINARIO',
    'SOLICITUD DE NOVEDADES REINGRESO, APLAZAMIENTO, RETIRO VOLUNTARIO, TRASLADO Y CONDICIONAMIENTO': 'SOLICITUD DE NOVEDADES (REINGRESO, APLAZAMIENTO, RETIRO VOLUNTARIO',
    'SOLICITUD DE NOVEDADES (REINGRESO, APLAZAMIENTO, RETIRO VOLUNTARIO': 'SOLICITUD DE NOVEDADES (REINGRESO, APLAZAMIENTO, RETIRO VOLUNTARIO',
    'RESPUESTA A SOLICITUD DE NOVEDAD': 'RESPUESTA A SOLICITUD DE NOVEDAD',
    'ACTAS DE REUNION DEL COMITE DE SEGUIMIENTO Y EVALUACION DE ETAPA LECTIVA Y/O PRODUCTIVA': 'ACTAS DE REUNION DEL COMITE DE SEGUIMIENTO Y EVALUACION DE ETAPA L',
    'ACTAS DE REUNION DEL COMITE DE SEGUIMIENTO Y EVALUACION DE ETAPA L': 'ACTAS DE REUNION DEL COMITE DE SEGUIMIENTO Y EVALUACION DE ETAPA L',
    'RESOLUCION DE REINGRESO, SANCIONATORIA O CANCELACION MATRICULA, PLAN DE MEJORAMIENTO ACADEMICO O DISCIPLINARIO': 'RESOLUCION DE REINGRESO, SANCIONATORIA O CANCELACION MATRICULA, PL',
    'RESOLUCION DE REINGRESO, SANCIONATORIA O CANCELACION MATRICULA, PL': 'RESOLUCION DE REINGRESO, SANCIONATORIA O CANCELACION MATRICULA, PL',
    'SOLICITUD DE RECURSO DE REPOSICION': 'SOLICITUD DE RECURSO DE REPOSICION',
    'ACTO ADMINISTRATIVO RECURSO REPOSICION': 'ACTO ADMINISTRATIVO RECURSO REPOSICION',
    'COMUNICACION DE PRESENTACION ETAPA PRACTICA LECTIVA': 'COMUNICACION DE PRESENTACION ETAPA PRACTICA LECTIVA',
    'ACTA DE CIERRE ETAPA LECTIVA': 'ACTA DE CIERRE ETAPA LECTIVA',
    'COMUNICACION SELECCION DE ETAPA PRODUCTIVA': 'COMUNICACION SELECCION DE ETAPA PRODUCTIVA',
    'AFILIACION AL SISTEMA GENERAL DE RIESGOS LABORALES DE APRENDICES - ARL': 'AFILIACION AL SISTEMA GENERAL DE RIESGOS LABORALES DE APRENDICES',
    'AFILIACION AL SISTEMA GENERAL DE RIESGOS LABORALES DE APRENDICES': 'AFILIACION AL SISTEMA GENERAL DE RIESGOS LABORALES DE APRENDICES',
    'REGISTRO PLANEACION, SEGUIMIENTO Y EVALUACION DE LA ETAPA PRODUCTIVA': 'REGISTRO PLANEACION, SEGUIMIENTO Y EVALUACION DE LA ETAPA PRODUCTI',
    'REGISTRO PLANEACION, SEGUIMIENTO Y EVALUACION DE LA ETAPA PRODUCTI': 'REGISTRO PLANEACION, SEGUIMIENTO Y EVALUACION DE LA ETAPA PRODUCTI',
    'BITACORA DE SEGUIMIENTO ETAPA PRODUCTIVA': 'BITACORA DE SEGUIMIENTO ETAPA PRODUCTIVA',
    'SOLICITUD DE CAMBIO DE ETAPA PRODUCTIVA': 'SOLICITUD DE CAMBIO DE ETAPA PRODUCTIVA',
    'QUEJA O RECLAMACION POR EL APRENDIZ DEL PROCESO DE FORMACION': 'QUEJA O RECLAMACION POR EL APRENDIZ DEL PROCESO DE FORMACION',
    'CERTIFICADO DE APROBACION EMPRESA TERMINACION ETAPA PRODUCTIVA': 'CERTIFICADO DE APROBACION EMPRESA TERMINACION ETAPA PRODUCTIVA',
    'INFORME DE BIENESTAR DEL APRENDIZ RUTA DE ATENCION PARA LA PREVENCION DE LA DESERCION': 'INFORME DE BIENESTAR DEL APRENDIZ RUTA DE ATENCION PARA LA PREVENC',
    'INFORME DE BIENESTAR DEL APRENDIZ RUTA DE ATENCION PARA LA PREVENC': 'INFORME DE BIENESTAR DEL APRENDIZ RUTA DE ATENCION PARA LA PREVENC',
    'DOCUMENTO DE IDENTIDAD EN CASO DE CAMBIO DEL MISMO': 'DOCUMENTO DE IDENTIDAD EN CASO DE CAMBIO DEL MISMO',
    'PAZ Y SALVO ACADEMICO ADMINISTRATIVO O COMUNICACION DE INSTITUCION EDUCATIVA': 'PAZ Y SALVO ACADEMICO ADMINISTRATIVO O COMUNICACION INSTITUCION',
    'PAZ Y SALVO ACADEMICO ADMINISTRATIVO O COMUNICACION INSTITUCION': 'PAZ Y SALVO ACADEMICO ADMINISTRATIVO O COMUNICACION INSTITUCION',
    'CERTIFICADO DE INSCRIPCION EN EL APLICATIVO DE LA APE': 'CERTIFICADO DE INSCRIPCION EN EL APLICATIVO DE LA APE',
    'RESULTADOS DE LA PRUEBA SABER TYT ANTE EL ICFES PARA APRENDICES DEL NIVEL TECNOLOGICO': 'RESULTADOS DE LA PRUEBA SABER TYT ANTE EL ICFES PARA APRENDICES DE',
    'RESULTADOS DE LA PRUEBA SABER TYT ANTE EL ICFES PARA APRENDICES DE': 'RESULTADOS DE LA PRUEBA SABER TYT ANTE EL ICFES PARA APRENDICES DE',
    'CONSTANCIA DE BUENA CONDUCTA': 'CONSTANCIA DE BUENA CONDUCTA',
    'CONTROL Y EXPEDICION Y ENTREGA DE DUPLICADOS ANOS ANTERIORES AL ANO 2000': 'CONTROL Y EXPEDICION Y ENTREGA DE DUPLICADOS (AÑOS ANTERIORES AL A',
    'CONTROL Y EXPEDICION Y ENTREGA DE DUPLICADOS (AÑOS ANTERIORES AL A': 'CONTROL Y EXPEDICION Y ENTREGA DE DUPLICADOS (AÑOS ANTERIORES AL A',
    'SOLICITUD MODIFICACION DE DOCUMENTOS ACADEMICOS CON SU RESPECTIVO SOPORTE': 'SOLICITUD MODIFICACION DE DOCUMENTOS ACADEMICOS CON SU RESPECTIVO',
    'SOLICITUD MODIFICACION DE DOCUMENTOS ACADEMICOS CON SU RESPECTIVO': 'SOLICITUD MODIFICACION DE DOCUMENTOS ACADEMICOS CON SU RESPECTIVO',
    'CONSTANCIA DE VALIDACION ACADEMICA PARA APOSTILLAR': 'CONSTANCIA DE VALIDACION ACADEMICA PARA APOSTILLAR',
    // ─────────────────────────────────────────────────────────────────
    // CATÁLOGO OFICIAL TIPOLOGÍAS SEGÚN AES (CONTRATO DE PRESTACIÓN DE SERVICIOS PERSONALES)
    // ─────────────────────────────────────────────────────────────────
    'PUBLICACION EN EL SECOP DE LA NECESIDAD DE CONTRATACION DENTRO DEL PLAN ANUAL DE ADQUISICION': 'PUBLICACION EN EL SECOP II DE LA NECESIDAD DE CONTRATACION DENTRO',
    'PUBLICACION EN EL SECOP II DE LA NECESIDAD DE CONTRATACION DENTRO': 'PUBLICACION EN EL SECOP II DE LA NECESIDAD DE CONTRATACION DENTRO',
    'CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL - CDP': 'CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL',
    'CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL': 'CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL',
    'ESTUDIO PREVIO': 'ESTUDIOS PREVIOS',
    'ESTUDIOS PREVIOS': 'ESTUDIOS PREVIOS',
    'MINUTA CONTRATO': 'MINUTA DE CONTRATO',
    'MINUTA DE CONTRATO': 'MINUTA DE CONTRATO',
    'CERTIFICADO DE INEXISTENCIA DE PERSONAL DE PLANTA': 'CERTIFICADO DE INEXISTENCIA DE PERSONAL DE PLANTA',
    'CERTIFICADO DE INEXISTENCIA DE PERSONAL DE PLANTA': 'CERTIFICADO DE INEXISTENCIA DE PERSONAL DE PLANTA',
    'CERTIFICADO DE UNICO OFERENTE DEL MERCADO': 'CERTIFICADO DE UNICO OFERENTE DEL MERCADO',
    'CERTIFICADO DE UNICO OFERENTE DEL MERCADO': 'CERTIFICADO DE UNICO OFERENTE DEL MERCADO',
    'AUTORIZACION PARA CONTRATOS CON OBJETOS IGUALES (SI APLICA)': 'AUTORIZACION PARA CONTRATOS CON OBJETOS IGUALES',
    'AUTORIZACION PARA CONTRATOS CON OBJETOS IGUALES': 'AUTORIZACION PARA CONTRATOS CON OBJETOS IGUALES',
    'AUTORIZACION CONTRATACION DE SERVICIOS PERSONALES': 'AUTORIZACION CONTRATACION DE SERVICIOS PERSONALES',
    'AUTORIZACION CONTRATACION DE SERVICIOS PERSONALES': 'AUTORIZACION CONTRATACION DE SERVICIOS PERSONALES',
    'OFERTA DE SERVICIOS PERSONALES RADICADA': 'OFERTA DE SERVICIOS PERSONALES RADICADA',
    'OFERTA DE SERVICIOS PERSONALES RADICADA': 'OFERTA DE SERVICIOS PERSONALES RADICADA',
    'HOJA DE VIDA SIGEP': 'HOJA DE VIDA SIGEP',
    'HOJA DE VIDA SIGEP': 'HOJA DE VIDA SIGEP',
    'COPIA DOCUMENTO DE IDENTIDAD': 'COPIA DOCUMENTO DE IDENTIDAD',
    'COPIA DOCUMENTO DE IDENTIDAD': 'COPIA DOCUMENTO DE IDENTIDAD',
    'ACREDITACION DE SITUACION MILITAR (SI APLICA)': 'ACREDITACION DE SITUACION MILITAR',
    'ACREDITACION DE SITUACION MILITAR': 'ACREDITACION DE SITUACION MILITAR',
    'DECLARACION DE BIENES Y RENTAS Y CONFLICTO DE INTERES': 'DECLARACION DE BIENES Y RENTAS Y CONFLICTO DE INTERES',
    'DECLARACION DE BIENES Y RENTAS Y CONFLICTO DE INTERES': 'DECLARACION DE BIENES Y RENTAS Y CONFLICTO DE INTERES',
    'CERTIFICADOS ACADEMICOS': 'CERTIFICADOS ACADEMICOS',
    'CERTIFICADOS ACADEMICOS': 'CERTIFICADOS ACADEMICOS',
    'CERTIFICADOS DE EXPERIENCIA LABORAL': 'CERTIFICADOS DE EXPERIENCIA LABORAL',
    'CERTIFICADOS DE EXPERIENCIA LABORAL': 'CERTIFICADOS DE EXPERIENCIA LABORAL',
    'COPIA DEL REGISTRO DE UNICO TRIBUTARIO': 'COPIA DEL REGISTRO DE UNICO TRIBUTARIO',
    'COPIA DEL REGISTRO DE UNICO TRIBUTARIO': 'COPIA DEL REGISTRO DE UNICO TRIBUTARIO',
    'COPIA DEL REGISTRO DE INFORMACION TRIBUTARIA': 'REGISTRO DE INFORMACION TRIBUTARIA O EL QUE HAGA SUS VECES',
    'REGISTRO DE INFORMACION TRIBUTARIA O EL QUE HAGA SUS VECES': 'REGISTRO DE INFORMACION TRIBUTARIA O EL QUE HAGA SUS VECES',
    'CERTIFICADO DE INEXISTENCIA DE ANTECEDENTES DEL SISTEMA REGISTRO NACIONAL DE MEDIDAS CORRECTIVAS RNMC': 'CERTIFICADO INEXISTENCIA ANTECEDENTES SISTEMA RNMC',
    'CERTIFICADO INEXISTENCIA ANTECEDENTES SISTEMA RNMC': 'CERTIFICADO INEXISTENCIA ANTECEDENTES SISTEMA RNMC',
    'REGISTRO DE DEUDORES ALIMENTARIOS MOROSOS REDAM': 'REGISTRO DE DEUDORES ALIMENTARIOS MOROSOS REDAM',
    'REGISTRO DE DEUDORES ALIMENTARIOS MOROSOS REDAM': 'REGISTRO DE DEUDORES ALIMENTARIOS MOROSOS REDAM',
    'CONSULTA DE INHABILIDADES POR DELITOS SEXUALES CONTRA MENORES DE EDAD': 'CONSULTA DE INHABILIDADES POR DELITOS SEXUALES CONTRA MENORES DE E',
    'CONSULTA DE INHABILIDADES POR DELITOS SEXUALES CONTRA MENORES DE E': 'CONSULTA DE INHABILIDADES POR DELITOS SEXUALES CONTRA MENORES DE E',
    'CERTIFICADOS SEGURIDAD SOCIAL Y PARAFISCALES': 'CERTIFICADOS SEGURIDAD SOCIAL Y PARAFISCALES',
    'CERTIFICADOS SEGURIDAD SOCIAL Y PARAFISCALES': 'CERTIFICADOS SEGURIDAD SOCIAL Y PARAFISCALES',
    'TARJETA PROFESIONAL O CERTIFICADO DE REGISTRO O MATRICULA PARA PROFESIONES REGULADAS (SI APLICA)': 'TARJETA PROFESIONAL O CERTIFICADO DE REGISTRO O MATRICULA PARA PRO',
    'TARJETA PROFESIONAL O CERTIFICADO DE REGISTRO O MATRICULA PARA PRO': 'TARJETA PROFESIONAL O CERTIFICADO DE REGISTRO O MATRICULA PARA PRO',
    'CERTIFICADO DE ANTECEDENTES DISCIPLINARIOS DE LA PROFESION': 'CERTIFICADO DE ANTECEDENTES DISCIPLINARIOS DE LA PROFESION',
    'CERTIFICADO DE ANTECEDENTES DISCIPLINARIOS DE LA PROFESION': 'CERTIFICADO DE ANTECEDENTES DISCIPLINARIOS DE LA PROFESION',
    'CERTIFICADO DE ANTECEDENTES DISCIPLINARIOS (PROCURADURIA)': 'CERTIFICADO DE ANTECEDENTES DISCIPLINARIOS PROCURADURIA',
    'CERTIFICADO DE ANTECEDENTES DISCIPLINARIOS PROCURADURIA': 'CERTIFICADO DE ANTECEDENTES DISCIPLINARIOS PROCURADURIA',
    'CERTIFICADO DE ANTECEDENTES FISCALES': 'CERTIFICADO DE ANTECEDENTES FISCALES',
    'CERTIFICADO DE ANTECEDENTES FISCALES': 'CERTIFICADO DE ANTECEDENTES FISCALES',
    'CERTIFICADO DE ANTECEDENTES JUDICIALES': 'CERTIFICADO DE ANTECEDENTES JUDICIALES',
    'CERTIFICADO DE ANTECEDENTES JUDICIALES': 'CERTIFICADO DE ANTECEDENTES JUDICIALES',
    'REGISTRO NACIONAL DE MEDIDAS CORRECTIVAS': 'REGISTRO NACIONAL DE MEDIDAS CORRECTIVAS',
    'REGISTRO NACIONAL DE MEDIDAS CORRECTIVAS': 'REGISTRO NACIONAL DE MEDIDAS CORRECTIVAS',
    'AUTORIZACION DE CONSULTA EN BASES DE DATOS SENSIBLES': 'CERTIFICADO INEXISTENCIA DE ANTECEDENTES JUDICIALES DEL REPRESENTA',
    'CERTIFICADO INEXISTENCIA DE ANTECEDENTES JUDICIALES DEL REPRESENTA': 'CERTIFICADO INEXISTENCIA DE ANTECEDENTES JUDICIALES DEL REPRESENTA',
    'CERTIFICADO DE INHABILIDADES POR DELITOS SEXUALES': 'CERTIFICADO DE INHABILIDADES POR DELITOS SEXUALES',
    'CERTIFICADO DE INHABILIDADES POR DELITOS SEXUALES': 'CERTIFICADO DE INHABILIDADES POR DELITOS SEXUALES',
    'CERTIFICADO REGISTRO DEUDORES ALIMENTARIOS MOROSOS': 'CERTIFICADO REGISTRO DEUDORES ALIMENTARIOS MOROSOS',
    'CERTIFICADO REGISTRO DEUDORES ALIMENTARIOS MOROSOS': 'CERTIFICADO REGISTRO DEUDORES ALIMENTARIOS MOROSOS',
    'CERTIFICACION BANCARIA': 'CERTIFICACION BANCARIA',
    'CERTIFICACION BANCARIA': 'CERTIFICACION BANCARIA',
    'CERTIFICACION DE INSCRIPCION A LA AGENCIA PUBLICA DE EMPLEO': 'CERTIFICACION DE INSCRIPCION A LA AGENCIA PUBLICA DE EMPLEO',
    'CERTIFICACION DE INSCRIPCION A LA AGENCIA PUBLICA DE EMPLEO': 'CERTIFICACION DE INSCRIPCION A LA AGENCIA PUBLICA DE EMPLEO',
    'REGISTRO PRESUPUESTAL': 'REGISTRO PRESUPUESTAL',
    'REGISTRO PRESUPUESTAL': 'REGISTRO PRESUPUESTAL',
    'POLIZAS DE GARANTIAS': 'POLIZA DE GARANTIA',
    'POLIZA DE GARANTIA': 'POLIZA DE GARANTIA',
    'GESTION CONTRACTUAL PERIODICA DE PRESTACION DE SERVICIOS PERSONALES Y APOYO A LA GESTION': 'GESTION CONTRACTUAL PERIODICA DE PRESTACION DE SERVICIOS PERSONALE',
    'GESTION CONTRACTUAL PERIODICA DE PRESTACION DE SERVICIOS PERSONALE': 'GESTION CONTRACTUAL PERIODICA DE PRESTACION DE SERVICIOS PERSONALE',
    'GESTION FINANCIERA PERIODICA DE PRESTACION DE SERVICIOS PERSONALES Y APOYO A LA GESTION FINANCIERA': 'GESTION FINANCIERA PERIODICA DE PRESTACION DE SERVICIOS PERSONALES',
    'GESTION FINANCIERA PERIODICA DE PRESTACION DE SERVICIOS PERSONALES': 'GESTION FINANCIERA PERIODICA DE PRESTACION DE SERVICIOS PERSONALES',
    'CERTIFICADO DE PAGO PLANILLA SEGURIDAD SOCIAL Y PARAFISCALES': 'CERTIFICADO DE PAGO PLANILLA SEGURIDAD SOCIAL Y PARAFISCALES',
    'CERTIFICADO DE PAGO PLANILLA SEGURIDAD SOCIAL Y PARAFISCALES': 'CERTIFICADO DE PAGO PLANILLA SEGURIDAD SOCIAL Y PARAFISCALES',
    'FACTURA ELECTRONICA': 'FACTURA ELECTRONICA',
    'FACTURA ELECTRONICA': 'FACTURA ELECTRONICA',
    'REPORTE REGIMEN TRIBUTARIO': 'REPORTE REGIMEN TRIBUTARIO',
    'REPORTE REGIMEN TRIBUTARIO': 'REPORTE REGIMEN TRIBUTARIO',
    'MODIFICACIONES U OTROSI CESION, SUSPENSION, ADICION, PRORROGA, TERMINACION ANTICIPADA, MODIFICACION Y ACLARACION': 'MODIFICACIONES U OTROSI CESION SUSPENSION ADICION PRORROGA TERMIN',
    'MODIFICACIONES U OTROSI CESION SUSPENSION ADICION PRORROGA TERMIN': 'MODIFICACIONES U OTROSI CESION SUSPENSION ADICION PRORROGA TERMIN',
    'AL CONTRATO': 'MODIFICACIONES U OTROSI CESION SUSPENSION ADICION PRORROGA TERMIN',
    'MODIFICACIONES U OTROSI CESION SUSPENSION ADICION PRORROGA TERMIN': 'MODIFICACIONES U OTROSI CESION SUSPENSION ADICION PRORROGA TERMIN',
    'INFORME FINAL DE SUPERVISION CONTRATACION DE SERVICIOS': 'INFORME FINAL DE SUPERVISION CONTRATACION DE SERVICIOS PERSONALES',
    'INFORME FINAL DE SUPERVISION CONTRATACION DE SERVICIOS PERSONALES': 'INFORME FINAL DE SUPERVISION CONTRATACION DE SERVICIOS PERSONALES',
    'PERSONALES Y APOYO A LA GESTION': 'INFORME FINAL DE SUPERVISION CONTRATACION DE SERVICIOS PERSONALES',
    'INFORME FINAL DE SUPERVISION CONTRATACION DE SERVICIOS PERSONALES': 'INFORME FINAL DE SUPERVISION CONTRATACION DE SERVICIOS PERSONALES',
    'RELACION DE PAGOS - SIIF': 'RELACION DE PAGOS SIIF',
    'RELACION DE PAGOS SIIF': 'RELACION DE PAGOS SIIF',
    'RELACION DE ENTREGA DE BIENES A CONTRATISTA': 'RELACION DE ENTREGA DE BIENES A CONTRATISTA',
    'RELACION DE ENTREGA DE BIENES A CONTRATISTA': 'RELACION DE ENTREGA DE BIENES A CONTRATISTA',
    'ACTA DE LIQUIDACION': 'ACTA DE LIQUIDACION',
    'ACTA DE LIQUIDACION': 'ACTA DE LIQUIDACION'
};

function stripTypologyDecorators(rawName) {
    if (!rawName) return '';
    return String(rawName)
        .trim()
        .replace(/^\d+\s*[._\-)]\s*/, '')
        .replace(/_\d+$/, '')
        .trim();
}

function findCatalogOnBaseTypology(rawName) {
    if (!rawName) return null;
    const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const stripped = stripTypologyDecorators(rawName);
    const candidates = [norm(stripped), norm(rawName)].filter(Boolean);
    for (const cand of candidates) {
        for (const [trdKey, aesVal] of Object.entries(HISTORIAS_ACADEMICAS_MAP)) {
            if (norm(trdKey) === cand) return aesVal;
        }
    }
    for (const cand of candidates) {
        if (cand.length < 6) continue;
        for (const [trdKey, aesVal] of Object.entries(HISTORIAS_ACADEMICAS_MAP)) {
            const normKey = norm(trdKey);
            if (cand.includes(normKey) || normKey.includes(cand)) return aesVal;
        }
    }
    return null;
}

function resolveOnBaseTypologyName(rawName) {
    if (!rawName) return '';
    return findCatalogOnBaseTypology(rawName) || stripTypologyDecorators(rawName);
}

// ─────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────

/** Ejecuta fn en frameOrPage sin lanzar error (retorna null si falla) */
const safeEval = async (frameOrPage, fn, ...args) => {
    try { return await frameOrPage.evaluate(fn, ...args); } catch { return null; }
};

/** Busca un frame por URL parcial dentro de una página */
const getFrame = (page, urlPart) =>
    page.frames().find(f => f.url().includes(urlPart)) || null;

/** Escribe texto en un selector con soporte para reintentos si el elemento se desprende del DOM */
const safeType = async (page, selector, text, delay = 50) => {
    for (let i = 0; i < 5; i++) {
        try {
            const element = await page.waitForSelector(selector, { timeout: 8000 });
            if (element) {
                const isAttached = await page.evaluate(el => el.isConnected, element).catch(() => false);
                if (isAttached) {
                    await element.click({ clickCount: 3 }).catch(() => {});
                    await wait(200);
                    await page.keyboard.down('Control');
                    await page.keyboard.press('A');
                    await page.keyboard.up('Control');
                    await page.keyboard.press('Delete');
                    await wait(200);
                    await element.type(text, { delay });
                    return true;
                }
            }
        } catch (e) {
            // Silencioso, reintenta
        }
        await wait(800);
    }
    return false;
};

/** Clic en un selector con soporte para reintentos si el elemento se desprende del DOM */
const safeClick = async (page, selector) => {
    for (let i = 0; i < 5; i++) {
        try {
            const element = await page.waitForSelector(selector, { timeout: 8000 });
            if (element) {
                const isAttached = await page.evaluate(el => el.isConnected, element).catch(() => false);
                if (isAttached) {
                    await element.click();
                    return true;
                }
            }
        } catch (e) {
            // Silencioso, reintenta
        }
        await wait(800);
    }
    return false;
};

// Helper para detectar y quitar bloqueos de objetos (Locked Objects)
let lastLockCheckTime = 0;
async function checkAndClearLocks(browser, logs) {
    const now = Date.now();
    if (now - lastLockCheckTime < 1500) return;
    lastLockCheckTime = now;
    try {
        const allPages = await browser.pages().catch(() => []);
        for (const pg of allPages) {
            for (const frame of pg.frames()) {
                try {
                    // 1. Detectar modal "Attention" / "One or more forms have unsaved data" y pulsar "Continue"
                    const dismissedAttention = await frame.evaluate(() => {
                        const bodyText = (document.body ? document.body.innerText || '' : '').toLowerCase();
                        const isAttention = bodyText.includes('unsaved') || bodyText.includes('require your attention') || bodyText.includes('unfinished work') || bodyText.includes('unsaved data');
                        
                        if (isAttention) {
                            const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a, [role="button"]'));
                            const contBtn = buttons.find(b => {
                                const t = (b.innerText || b.value || b.textContent || '').trim().toLowerCase();
                                const isVisible = b.offsetParent !== null && b.getBoundingClientRect().width > 0;
                                return (t === 'continue' || t === 'continuar' || t === 'discard' || t === 'yes' || t === 'sí') && isVisible;
                            });
                            if (contBtn) {
                                contBtn.scrollIntoView({ block: 'center' });
                                contBtn.click();
                                return true;
                            }
                        }
                        return false;
                    });

                    if (dismissedAttention) {
                        logs.push('[ATTENTION] ⚠️ Modal de OnBase detectado ("unsaved data"). Clic en "Continue" ejecutado.');
                        await wait(1000);
                        return;
                    }

                    const hasLocksPopup = await frame.evaluate(() => {
                        const modal = document.querySelector('.LockedObjects, [id*="Lock" i], [class*="Lock" i], .ui-dialog');
                        if (!modal) return false;
                        const txt = (modal.innerText || '').toLowerCase();
                        return (txt.includes('locked objects') || txt.includes('manage locks') || txt.includes('objetos bloqueados')) && txt.includes('lock type');
                    });
                    
                    if (hasLocksPopup) {
                        logs.push('[LOCKS] ⚠️ Detectada advertencia de objetos bloqueados (Locked Objects)');
                        
                        const action = await frame.evaluate(() => {
                            const buttons = Array.from(document.querySelectorAll('button, input[type="button"], a, span, div'));
                            
                            // 1. Intentar hacer clic en "Select All" o "Seleccionar todo"
                            const selectAllBtn = buttons.find(b => {
                                const t = (b.innerText || b.value || '').trim().toLowerCase();
                                return t.includes('select all') || t.includes('seleccionar todo');
                            });
                            if (selectAllBtn) {
                                selectAllBtn.click();
                                return 'select_all';
                            }
                            
                            // 2. Si no hay select all, buscar Remove Lock / Eliminar bloqueo directamente
                            const removeBtn = buttons.find(b => {
                                const t = (b.innerText || b.value || '').trim().toLowerCase();
                                return t.includes('remove lock') || t.includes('eliminar bloqueo') || t.includes('quitar bloqueo');
                            });
                            if (removeBtn) {
                                removeBtn.click();
                                return 'remove_lock';
                            }
                            
                            return null;
                        });
                        
                        if (action) {
                            logs.push(`[LOCKS] Acción ejecutada: ${action}`);
                            await wait(1500);
                            
                            if (action === 'select_all') {
                                // Clic en Remove Lock ahora
                                await frame.evaluate(() => {
                                    const buttons = Array.from(document.querySelectorAll('button, input[type="button"], a, span, div'));
                                    const removeBtn = buttons.find(b => {
                                        const t = (b.innerText || b.value || '').trim().toLowerCase();
                                        return t.includes('remove lock') || t.includes('eliminar bloqueo') || t.includes('quitar bloqueo');
                                    });
                                    if (removeBtn) removeBtn.click();
                                });
                                logs.push('[LOCKS] Clic en Remove Lock ejecutado');
                                await wait(2000);
                            }
                            
                            // Cerrar el popup haciendo clic en el botón de cerrar
                            await frame.evaluate(() => {
                                const buttons = Array.from(document.querySelectorAll('button, input[type="button"], a, span, div, img'));
                                const closeBtn = buttons.find(b => {
                                    const t = (b.innerText || b.value || '').trim().toLowerCase();
                                    return t === 'x' || t === 'close' || t === 'cerrar' || t === 'cancel' || t === 'cancelar' || b.className?.includes('close') || b.id?.includes('close');
                                });
                                if (closeBtn) closeBtn.click();
                            });
                            logs.push('[LOCKS] Popup de bloqueo cerrado');
                            await wait(1000);
                        }
                    }
                } catch (e) {}
            }
        }
    } catch (err) {}
}

// Helper para detectar cuando OnBase queda trabado en "It is safe to close this window" / EmbeddedPage/Close.aspx o página muerta
async function isPageStuckOrCloseWindow(page, browser = null) {
    try {
        if (!page || (typeof page.isClosed === 'function' && page.isClosed())) {
            return { stuck: true, reason: 'Pestaña cerrada o desconectada' };
        }
        const currentUrl = String(page.url() || '').toLowerCase();
        if (
            currentUrl.includes('embeddedpage/close.aspx') ||
            currentUrl.includes('/close.aspx') ||
            currentUrl.includes('closewindow') ||
            currentUrl.includes('logout=true')
        ) {
            return { stuck: true, reason: `URL de cierre detectada (${page.url()})` };
        }

        const bodyCheck = await page.evaluate(() => {
            const txt = (document.body ? document.body.innerText || '' : '').trim().toLowerCase();
            if (
                txt.includes('it is safe to close this window') ||
                txt.includes('safe to close this window') ||
                txt.includes('does not close automatically') ||
                txt.includes('es seguro cerrar esta ventana') ||
                txt.includes('no se cierra automáticamente')
            ) {
                return 'Texto "It is safe to close this window" detectado en pantalla';
            }
            return null;
        }).catch(() => null);

        if (bodyCheck) {
            return { stuck: true, reason: bodyCheck };
        }

        if (browser) {
            const allPages = await browser.pages().catch(() => []);
            for (const pg of allPages) {
                const u = String(pg.url() || '').toLowerCase();
                if (u.includes('embeddedpage/close.aspx') || u.includes('/close.aspx')) {
                    return { stuck: true, reason: `Pestaña en Close.aspx (${pg.url()})` };
                }
                const pgTxt = await pg.evaluate(() => (document.body ? document.body.innerText || '' : '').toLowerCase()).catch(() => '');
                if (pgTxt.includes('it is safe to close this window') || pgTxt.includes('safe to close this window')) {
                    return { stuck: true, reason: 'Pestaña trabada en "It is safe to close this window"' };
                }
            }
        }
        return { stuck: false, reason: null };
    } catch (e) {
        return { stuck: true, reason: `Error evaluando estado del navegador: ${e.message}` };
    }
}

// ─────────────────────────────────────────────────────────────────
// PASO 1: LOGIN
// ─────────────────────────────────────────────────────────────────
async function paso1_login(page, url, username, password, logs) {
    // Normalizar URL de login eliminando parámetros residuales (?logout=true, ?ReturnUrl=Close.aspx, etc.)
    const cleanLoginUrl = String(url || 'https://onbase.sena.edu.co/AppNet/Login.aspx').split('?')[0];

    // Limpiar cookies/caché previas de la sesión para evitar que OnBase redirija a EmbeddedPage/Close.aspx por defecto
    try {
        const cdp = await page.target().createCDPSession();
        await cdp.send('Network.clearBrowserCookies').catch(() => {});
        await cdp.send('Network.clearBrowserCache').catch(() => {});
        await cdp.detach().catch(() => {});
    } catch {}

    logs.push(`[PASO 1] Navegando a OnBase (${cleanLoginUrl})...`);
    await page.goto(cleanLoginUrl, { waitUntil: 'networkidle2', timeout: 30000 })
        .catch(e => logs.push(`[PASO 1][WARN] goto: ${e.message}`));
    await wait(2500);

    // Si por algún motivo cayó en Close.aspx antes de loguear, forzar ir a Login.aspx limpio
    const preCheck = await isPageStuckOrCloseWindow(page);
    if (preCheck.stuck) {
        logs.push(`[PASO 1][WARN] Pantalla inicial en estado de cierre (${preCheck.reason}). Redirigiendo a Login.aspx limpio...`);
        await page.goto(cleanLoginUrl, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
        await wait(2500);
    }

    // Detectar si estamos en Microsoft SSO
    let isMicrosoftSSO = false;
    for (let i = 0; i < 5; i++) {
        try {
            isMicrosoftSSO = page.url().includes('microsoftonline.com') || await page.evaluate(() => {
                return window.location.href.includes('microsoftonline.com') || 
                       document.title.includes('Iniciar sesión') || 
                       document.title.includes('Sign in') || 
                       !!document.querySelector('input[name="loginfmt"]');
            });
            break;
        } catch (e) {
            logs.push(`[PASO 1][WARN] Esperando estabilidad de la página para SSO (intento ${i+1}): ${e.message}`);
            await wait(2000);
        }
    }

    if (isMicrosoftSSO) {
        logs.push('[PASO 1] Detectado inicio de sesión de Microsoft (SSO)');
        
        let effectiveUsername = username;
        if (!username.includes('@')) {
            effectiveUsername = `${username}@sena.edu.co`;
            logs.push(`[PASO 1] Nombre de usuario sin dominio en SSO. Auto-ajustado a: ${effectiveUsername}`);
        }

        // 1. Escribir usuario/correo
        logs.push('[PASO 1] Buscando campo de correo de Microsoft...');
        const emailOk = await safeType(page, 'input[type="email"], input[name="loginfmt"], #i0116', effectiveUsername, 60);
        if (!emailOk) {
            logs.push('[PASO 1][ERROR] Campo de correo de Microsoft no encontrado o no interactuable');
            return false;
        }
        logs.push('[PASO 1] Correo escrito');
        
        // Clic en Siguiente
        logs.push('[PASO 1] Clic en "Siguiente" de Microsoft...');
        const nextOk = await safeClick(page, 'input[type="submit"], #idSIButton9');
        if (!nextOk) {
            logs.push('[PASO 1][ERROR] Botón "Siguiente" de Microsoft no encontrado');
            return false;
        }
        await wait(2000); // esperar animación de transición
        
        // 2. Esperar y escribir contraseña
        logs.push('[PASO 1] Buscando campo de contraseña de Microsoft...');
        const passOk = await safeType(page, 'input[type="password"], input[name="passwd"], #i0118', password, 60);
        if (!passOk) {
            const errMsg = await page.evaluate(() => {
                const el = document.querySelector('#usernameError, #error, .error');
                return el ? el.innerText.trim() : null;
            }).catch(() => null);
            logs.push(`[PASO 1][ERROR] Campo de contraseña de Microsoft no encontrado. Error en página: ${errMsg || 'Ninguno'}`);
            return false;
        }
        logs.push('[PASO 1] Contraseña escrita');
        
        // Clic en Iniciar sesión
        logs.push('[PASO 1] Clic en "Iniciar Sesión" (Microsoft)...');
        const submitOk = await safeClick(page, 'input[type="submit"], #idSIButton9');
        if (!submitOk) {
            logs.push('[PASO 1][ERROR] Botón de envío de Microsoft no encontrado');
            return false;
        }
        
        // Esperar respuesta de Microsoft
        await wait(5000);
        
        // 3. Comprobar si hay pantalla "¿Quiere mantener la sesión iniciada?"
        let staySignedIn = false;
        for (let i = 0; i < 5; i++) {
            try {
                staySignedIn = await page.evaluate(() => {
                    const hasStayText = document.body ? (document.body.innerText.includes('mantener la sesión') || 
                                        document.body.innerText.includes('Stay signed in')) : false;
                    const hasNoBtn = !!document.querySelector('#idBtn_Back');
                    return hasStayText && hasNoBtn;
                });
                break;
            } catch (e) {
                logs.push(`[PASO 1][WARN] Esperando estabilidad de la página para mantener sesión (intento ${i+1}): ${e.message}`);
                await wait(2000);
            }
        }
        
        if (staySignedIn) {
            logs.push('[PASO 1] Detectada pantalla "Mantener sesión iniciada". Clic en "No"...');
            const noBtn = await page.$('#idBtn_Back');
            if (noBtn) {
                await noBtn.click();
            } else {
                const yesBtn = await page.$('#idSIButton9');
                if (yesBtn) await yesBtn.click();
            }
            await wait(5000);
        }

    } else {
        logs.push('[PASO 1] Detectado formulario de login OnBase estándar');
        
        // Esperar campo de usuario
        const userOk = await safeType(page, '#username, input[type="text"], input[name="username"]', username, 60);
        if (!userOk) {
            logs.push('[PASO 1][ERROR] Campo de usuario no encontrado');
            return false;
        }
        logs.push('[PASO 1] Usuario escrito');

        // Campo contraseña
        const passOk = await safeType(page, '#password, input[type="password"]', password, 60);
        if (!passOk) {
            logs.push('[PASO 1][ERROR] Campo de contraseña no encontrado');
            return false;
        }
        logs.push('[PASO 1] Contraseña escrita');

        // Botón login
        const loginBtn = await page.$('#loginButton, button[type="submit"], input[type="submit"]');
        if (loginBtn) {
            await loginBtn.click();
        } else {
            await page.keyboard.press('Enter');
        }
        logs.push('[PASO 1] Botón login presionado. Esperando navegación...');
    }

    // Esperar 4 segundos y revisar si hay pantalla de "Sesión ya iniciada/Takeover"
    await wait(4000);
    let sessionTakeover = false;
    const takeoverButtonSelector = await page.evaluate(() => {
        const txt = document.body ? document.body.innerText.toLowerCase() : '';
        const hasSessionText = txt.includes('iniciada') || txt.includes('already logged in') || txt.includes('sesión activa') || txt.includes('active session') || txt.includes('already has an active') || txt.includes('user is logged in');
        
        if (hasSessionText) {
            const elements = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button, a[role="button"]'));
            const acceptBtn = elements.find(el => {
                const val = (el.value || el.innerText || el.textContent || '').trim().toLowerCase();
                return val === 'yes' || val === 'si' || val === 'sí' || val === 'aceptar' || val === 'continue' || val === 'continuar' || val.includes('take') || val.includes('login anyway');
            });
            if (acceptBtn) {
                acceptBtn.id = acceptBtn.id || 'temp_takeover_btn';
                return '#' + acceptBtn.id;
            }
        }
        return null;
    }).catch(() => null);

    if (takeoverButtonSelector) {
        sessionTakeover = true;
        logs.push('[PASO 1] ⚠️ Detectada advertencia de sesión activa. Tomando control de la sesión (Session Takeover)...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'load', timeout: 25000 }).catch(() => {}),
            page.click(takeoverButtonSelector)
        ]);
        await wait(6000); // Tiempo adicional para inicialización de JS post-takeover
    } else {
        // Esperar navegación normal
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { });
        await wait(3000);
    }

    const postUrl = page.url();
    logs.push(`[PASO 1] URL post-login: ${postUrl}`);

    const stuckAfterLogin = await isPageStuckOrCloseWindow(page);
    if (stuckAfterLogin.stuck) {
        logs.push(`[PASO 1][WARN] ⚠️ OnBase se trabó en ventana de cierre tras el login (${stuckAfterLogin.reason}). Se requiere cerrar y reabrir el explorador.`);
        return false;
    }

    if (postUrl.includes('NavPanel') || postUrl.includes('Dashboard') || postUrl.includes('Home') || postUrl.toLowerCase().includes('document/query')) {
        logs.push('[PASO 1] ✅ Login exitoso');
        await checkAndClearLocks(page.browser(), logs).catch(() => {});
        return true;
    }

    // Revisar si hay mensaje de error en la página actual
    const errMsg = await safeEval(page, () => {
        const el = document.querySelector('#ErrorMessage, .error-message, [class*="error"], #error-information, .error');
        return el ? el.innerText.trim() : null;
    });
    logs.push(`[PASO 1][ERROR] Login falló. Error: ${errMsg || 'Usuario/Contraseña incorrectos o requiere verificación manual (MFA)'}`);
    return false;
}

// ─────────────────────────────────────────────────────────────────
// PASO 2: ABRIR FORMULARIO SGDEA
// Navegación real confirmada en video:
//   sidebar izq → "Nuevo formulario" → seleccionar SGDEA de la lista
// ─────────────────────────────────────────────────────────────────
async function paso2_abrirFormulario(page, browser, logs, forceNew = false) {
    // 0. Verificar si el formulario SGDEA ya está abierto (ej. tras "Guardar -> Sí")
    if (!forceNew) {
        let alreadyOpen = false;
        try {
            const allPagesCheck = await browser.pages().catch(() => [page]);
            for (const pg of allPagesCheck) {
                for (const frame of pg.frames()) {
                    try {
                        const found = await frame.evaluate(() => {
                            const html = document.body ? document.body.innerHTML.toLowerCase() : '';
                            return (html.includes('código expediente') || html.includes('codigo expediente')) && html.includes('nombre documento');
                        });
                        if (found) { alreadyOpen = true; break; }
                    } catch { }
                }
                if (alreadyOpen) break;
            }
        } catch { }

        if (alreadyOpen) {
            logs.push('[PASO 2] ✅ Formulario SGDEA ya se encuentra abierto en pantalla');
            return true;
        }
    }

    logs.push('[PASO 2] Buscando "Nuevo formulario" en el sidebar de OnBase...');

    // Esperar que el NavPanel cargue
    await wait(3000);

    // Estrategia 1: clic directo en el link "Nuevo formulario" del sidebar
    const clickedNewForm = await page.evaluate(() => {
        // Buscar en todos los links del sidebar
        const allLinks = Array.from(document.querySelectorAll('a, li, span, div'));
        const link = allLinks.find(el => {
            const t = (el.innerText || el.textContent || '').trim().toLowerCase();
            return t === 'nuevo formulario' || t === 'new form';
        });
        if (link) {
            link.scrollIntoView({ block: 'center' });
            link.click();
            return link.innerText || link.textContent || 'clicked';
        }
        return null;
    }).catch(() => null);

    if (clickedNewForm) {
        logs.push(`[PASO 2] ✅ "Nuevo formulario" clickeado: "${clickedNewForm.trim()}"`);
    } else {
        logs.push('[PASO 2][WARN] Link "Nuevo formulario" no encontrado en sidebar. Intentando en frames...');
        // Buscar en todos los frames de la página
        for (const frame of page.frames()) {
            try {
                const ok = await frame.evaluate(() => {
                    const allLinks = Array.from(document.querySelectorAll('a, li'));
                    const link = allLinks.find(el => {
                        const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                        return t === 'nuevo formulario' || t === 'new form';
                    });
                    if (link) { link.click(); return true; }
                    return false;
                });
                if (ok) { logs.push('[PASO 2] ✅ "Nuevo formulario" clickeado en frame.'); break; }
            } catch { }
        }
    }

    // Esperar que OnBase cargue la lista de tipos de formulario de forma reactiva
    logs.push('[PASO 2] Buscando "SGDEA - Ingreso a Expediente" en la lista...');
    let sgdeaClicked = false;

    for (let intento = 0; intento < 20 && !sgdeaClicked; intento++) {
        await wait(intento === 0 ? 800 : 400);
        const allPages = await browser.pages();

        for (const pg of allPages) {
            for (const frame of pg.frames()) {
                try {
                    const result = await frame.evaluate(() => {
                        // Buscar en listas de items, links, spans con texto SGDEA
                        const candidates = Array.from(document.querySelectorAll(
                            'li, a, span, td, div, [role="treeitem"], [role="listitem"], [role="option"]'
                        ));
                        const matches = candidates.filter(el => {
                            const t = (el.innerText || el.textContent || '').trim().toUpperCase();
                            return (t.includes('SGDEA - INGRESO A EXPEDIENTE') || t === 'SGDEA - INGRESO A EXPEDIENTE') && t.length < 150;
                        });
                        if (matches.length === 0) return null;
                        
                        // Coger el más largo en este caso o el exacto, para evitar la carpeta
                        const target = matches.find(m => (m.innerText || '').trim().toUpperCase() === 'SGDEA - INGRESO A EXPEDIENTE') || matches[0];
                        const text = (target.innerText || target.textContent || '').trim();
                        target.scrollIntoView({ block: 'center' });
                        return text.substring(0, 120);
                    });

                    if (result) {
                        logs.push(`[PASO 2] SGDEA encontrado en intento ${intento + 1}: "${result}"`);

                        // Obtener coordenadas y usar Puppeteer nativo
                        const actionCmd = await frame.evaluate(() => {
                            const candidates = Array.from(document.querySelectorAll('a, span, div, li, [role="treeitem"]'));
                            
                            // Primero buscamos el enlace específico
                            const specific = candidates.filter(el => {
                                const t = (el.innerText || el.textContent || '').trim().toUpperCase();
                                return t === 'SGDEA - INGRESO A EXPEDIENTE' && el.offsetParent !== null;
                            })[0];
                            
                            if (specific) {
                                specific.scrollIntoView({ block: 'center' });
                                const rect = specific.getBoundingClientRect();
                                let nodeForCoords = specific;
                                if (rect.width === 0 && specific.children.length > 0) nodeForCoords = specific.children[0];
                                const finalRect = nodeForCoords.getBoundingClientRect();
                                return { action: 'doubleClickForm', x: finalRect.left + finalRect.width / 2, y: finalRect.top + finalRect.height / 2, html: specific.outerHTML.substring(0, 100) };
                            }
                            
                            // Si no encontramos el específico, buscamos la carpeta para abrirla
                            const folder = candidates
                                .filter(el => (el.innerText || el.textContent || '').trim().toUpperCase() === 'SGDEA' && el.offsetParent !== null)
                                .sort((a,b) => (a.innerText||'').length - (b.innerText||'').length)[0];
                                
                            if (folder) {
                                folder.scrollIntoView({ block: 'center' });
                                const rect = folder.getBoundingClientRect();
                                return { action: 'clickFolder', x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, html: folder.outerHTML.substring(0, 100) };
                            }
                            
                            return null;
                        });
                        
                        if (actionCmd) {
                            let fOffsetX = 0, fOffsetY = 0;
                            try {
                                const fEl = await frame.frameElement();
                                const fBox = await fEl.boundingBox();
                                if (fBox) { fOffsetX = fBox.x; fOffsetY = fBox.y; }
                            } catch(e) {}
                            
                            if (actionCmd.action === 'clickFolder') {
                                logs.push(`[PASO 2] Abriendo carpeta SGDEA...`);
                                await pg.mouse.click(fOffsetX + actionCmd.x, fOffsetY + actionCmd.y, { clickCount: 1 });
                                await wait(1500); // Esperar animación
                                continue; // Repetir el loop para que en el próximo intento encuentre el formulario
                            } else if (actionCmd.action === 'doubleClickForm') {
                                logs.push(`[PASO 2] Formulario objetivo detectado: ${actionCmd.html}`);
                                await pg.mouse.click(fOffsetX + actionCmd.x, fOffsetY + actionCmd.y, { clickCount: 2 });
                                logs.push('[PASO 2] ✅ "SGDEA - Ingreso a Expediente" seleccionado con doble clic nativo');
                                sgdeaClicked = true;
                                break;
                            }
                        }
                        
                    }
                } catch { }
            }
            if (sgdeaClicked) break;
        }
    }

    if (!sgdeaClicked) {
        logs.push('[PASO 2][WARN] SGDEA no se pudo seleccionar. Verifique que el tipo de formulario exista.');
    }

    // Esperar que el formulario abra (OnBase puede abrir en nueva pestaña o en iframe)
    logs.push('[PASO 2] Esperando que el formulario SGDEA cargue (max 90s)...');
    
    let formLoaded = false;
    for (let t = 0; t < 180 && !formLoaded; t++) {
        await wait(500);
        await checkAndClearLocks(browser, logs);
        const allPages = await browser.pages();
        for (const pg of allPages) {
            for (const frame of pg.frames()) {
                try {
                    const found = await frame.evaluate(() => {
                        if (document.querySelector('#sgdeaexpediente8_input, input[id*="expediente" i], input[title*="expediente" i]')) return true;
                        const html = document.body ? document.body.innerHTML.toLowerCase() : '';
                        return html.includes('código expediente') || html.includes('codigo expediente') || html.includes('nombre documento');
                    });
                    if (found) { formLoaded = true; break; }
                } catch { }
            }
            if (formLoaded) break;
        }
    }
    
    if (formLoaded) {
        logs.push('[PASO 2] ✅ Formulario cargado (frame detectado)');
        await wait(800); // Espera breve para terminar de pintar inputs
    } else {
        logs.push('[PASO 2][WARN] TIMEOUT esperando que el formulario aparezca en el DOM.');
    }
    
    return true;
}

// ─────────────────────────────────────────────────────────────────
// PASO 3: UForm Comunicación Electrónica (Ultra Rápido)
// ─────────────────────────────────────────────────────────────────
async function paso3_uformComunicacionElectronica(page, browser, logs) {
    logs.push('[PASO 3] Buscando "Nuevo formulario" y seleccionando "UForm Comunicación Electrónica"...');
    await wait(200);

    // 0. Redirección relámpago si la interfaz está en "Document Retrieval"
    for (let attempt = 0; attempt < 5; attempt++) {
        const switched = await page.evaluate(() => {
            const txt = document.body ? document.body.innerText.toLowerCase() : '';
            const isDocRetrieval = txt.includes('document retrieval') || txt.includes('document types');
            const isFormOpen = txt.includes('comunicación electrónica') || txt.includes('destinatario externo');

            if (isDocRetrieval && !isFormOpen) {
                // Hacer clic en cualquier icono de Grid / Nuevo Formulario
                const gridBtn = document.querySelector(
                    '#newform, [id*="NewForm" i], [id*="newform" i], [onclick*="NewForm" i], ' +
                    '[title*="Form" i], [title*="formulario" i], [aria-label*="Form" i], ' +
                    'a.navMenu, span.icon-grid, i.fa-th, i.icon-grid, .icon-apps, span.app-icon, ' +
                    'button[title*="New" i], a[title*="New" i]'
                );
                if (gridBtn) {
                    gridBtn.click();
                    return 'Boton Nuevo Formulario (Grid) cliqueado';
                }

                // Buscar por enlaces o botones con texto "Nuevo formulario" o "New Form"
                const allClickables = Array.from(document.querySelectorAll('a, button, span, div, i'));
                const newFormBtn = allClickables.find(el => {
                    const t = (el.title || el.getAttribute('aria-label') || el.innerText || '').toLowerCase();
                    const cls = (el.className || '').toString().toLowerCase();
                    return t.includes('new form') || t.includes('nuevo formulario') || cls.includes('grid') || cls.includes('th');
                });
                if (newFormBtn) {
                    newFormBtn.click();
                    return 'Enlace Nuevo Formulario cliqueado';
                }
            }
            return null;
        }).catch(() => null);

        if (switched) {
            logs.push(`[PASO 3] ✅ Redirección desde Document Retrieval: ${switched}`);
            await wait(500);
            break;
        }
        await wait(200);
    }

    // 1. Doble clic en "UForm Comunicacion Electronica"
    logs.push('[PASO 3] Buscando item "UForm Comunicacion Electronica" en el catálogo de formularios...');
    let itemClicked = false;
    let clickCoords = null;
    let targetPg = page;

    for (let attempt = 0; attempt < 20 && !itemClicked; attempt++) {
        await wait(300);
        const allPages = await browser.pages().catch(() => [page]);
        for (const pg of allPages) {
            for (const frame of pg.frames()) {
                try {
                    // Abrir carpeta si está colapsada
                    await frame.evaluate(() => {
                        const headers = Array.from(document.querySelectorAll('a, li, span, td, div, label'));
                        const header = headers.find(el => (el.innerText || el.textContent || '').trim().toUpperCase() === 'COMUNICACIONES PRODUCIDAS');
                        if (header) {
                            header.click();
                        }
                    }).catch(() => {});

                    const actionRes = await frame.evaluate(() => {
                        // Buscar primero por ID conocido o selector específico
                        const exact = document.querySelector('#itemLabelunity118, #liunity118, [id*="unity118"]');
                        let el = exact;
                        if (!el) {
                            const candidates = Array.from(document.querySelectorAll('a, li, span, td, div, label, [role="treeitem"]'));
                            el = candidates.find(c => {
                                const t = (c.innerText || c.textContent || '').trim().toLowerCase();
                                return (t.includes('uform comunicacion electronica') || 
                                       t.includes('uform comunicación electrónica') ||
                                       t.includes('01-ufrm comunicacion electronica'));
                            });
                        }
                        if (el) {
                            el.scrollIntoView({ block: 'center' });
                            const r = el.getBoundingClientRect();
                            // Disparar eventos nativos de doble clic en JS
                            el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
                            el.click();
                            return {
                                x: r.left + r.width / 2,
                                y: r.top + r.height / 2,
                                text: el.innerText || el.textContent
                            };
                        }
                        return null;
                    });

                    if (actionRes) {
                        let fOffsetX = 0, fOffsetY = 0;
                        try {
                            const fEl = await frame.frameElement();
                            const fBox = await fEl.boundingBox();
                            if (fBox) { fOffsetX = fBox.x; fOffsetY = fBox.y; }
                        } catch(e) {}

                        // Doble clic nativo con Puppeteer mouse
                        await pg.mouse.click(fOffsetX + actionRes.x, fOffsetY + actionRes.y, { clickCount: 2 });
                        logs.push(`[PASO 3] ✅ Doble clic nativo ejecutado en: "${actionRes.text.trim()}"`);
                        itemClicked = true;
                        clickCoords = { x: fOffsetX + actionRes.x, y: fOffsetY + actionRes.y, pg };
                        targetPg = pg;
                        break;
                    }
                } catch (e) {}
            }
            if (itemClicked) break;
        }
    }

    // 2. Esperar apertura real del formulario (desaparece "Nothing to display" y aparecen inputs)
    logs.push('[PASO 3] Esperando que el formulario "UForm Comunicación Electrónica" cargue en pantalla (max 30s)...');
    let formLoadedFrame = null;

    for (let attempt = 0; attempt < 60 && !formLoadedFrame; attempt++) {
        await wait(500);
        const allPages = await browser.pages().catch(() => [page]);
        for (const pg of allPages) {
            for (const frame of pg.frames()) {
                try {
                    const ready = await frame.evaluate(() => {
                        const txt = document.body ? document.body.innerText.toLowerCase() : '';
                        const href = (window.location && window.location.href) || '';
                        const hasInputs = document.querySelectorAll('input, select, textarea').length > 3;
                        const isNotNothing = !txt.includes('nothing to display');
                        const isTarget = href.includes('UnityFormHandler.ashx') ||
                                         document.getElementById('destinatarioexterno24_input') ||
                                         document.getElementById('mailto_input') ||
                                         document.getElementById('asunto27_input') ||
                                         txt.includes('comunicacion electronica') ||
                                         txt.includes('comunicación electrónica') ||
                                         txt.includes('tipo de destinatario') ||
                                         txt.includes('destinatario externo');
                        return isTarget && hasInputs && isNotNothing;
                    });
                    if (ready) {
                        formLoadedFrame = frame;
                        break;
                    }
                } catch (e) {}
            }
            if (formLoadedFrame) break;
        }

        // Reintentar doble clic a los 4s y 8s si aún sigue en "Nothing to display"
        if ((attempt === 8 || attempt === 16) && !formLoadedFrame && clickCoords) {
            logs.push('[PASO 3] Reintentando doble clic sobre "UForm Comunicación Electrónica"...');
            await clickCoords.pg.mouse.click(clickCoords.x, clickCoords.y, { clickCount: 2 }).catch(() => {});
        }
    }

    if (formLoadedFrame) {
        logs.push('[PASO 3] ✅ Formulario "SENA Comunicación Electrónica" cargado en pantalla con inputs listos.');
    } else {
        logs.push('[PASO 3] Procediendo al diligenciamiento con marcos detectados.');
    }

    // 3. Seleccionar opción "Externo" inmediatamente
    logs.push('[PASO 3] Seleccionando tipo de destinatario: "Externo"...');
    let selectedExterno = false;

    for (let attempt = 0; attempt < 15 && !selectedExterno; attempt++) {
        await wait(150);
        const allPages = await browser.pages().catch(() => [page]);
        for (const pg of allPages) {
            for (const frame of pg.frames()) {
                try {
                    const res = await frame.evaluate(() => {
                        // 1. Radio "Externo"
                        const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
                        const radioExterno = radios.find(r => {
                            const val = (r.value || r.id || r.name || r.title || '').toLowerCase();
                            const nextText = (r.nextSibling?.textContent || r.parentElement?.textContent || '').toLowerCase();
                            return val.includes('externo') || nextText.includes('externo');
                        });

                        if (radioExterno) {
                            radioExterno.scrollIntoView({ block: 'center' });
                            radioExterno.click();
                            radioExterno.checked = true;
                            radioExterno.dispatchEvent(new Event('change', { bubbles: true }));
                            radioExterno.dispatchEvent(new Event('click', { bubbles: true }));
                            return 'Radio "Externo" marcado activamente.';
                        }

                        // 2. Label "Externo"
                        const labels = Array.from(document.querySelectorAll('label, span, font, td, b, strong, div'));
                        const labelExterno = labels.find(el => {
                            const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
                            return txt === 'externo' || txt === 'externo:';
                        });

                        if (labelExterno) {
                            labelExterno.scrollIntoView({ block: 'center' });
                            labelExterno.click();
                            
                            const parent = labelExterno.closest('td, tr, div, p, fieldset') || labelExterno.parentElement;
                            if (parent) {
                                const inputInParent = parent.querySelector('input[type="radio"]');
                                if (inputInParent) {
                                    inputInParent.click();
                                    inputInParent.checked = true;
                                    inputInParent.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            }
                            return 'Label "Externo" cliqueado correctamente.';
                        }

                        return null;
                    });

                    if (res) {
                        selectedExterno = true;
                        logs.push(`[PASO 3] ✅ "Por favor seleccione tipo de destinatario: Externo" seleccionado (${res}).`);
                        break;
                    }
                } catch (e) {}
            }
            if (selectedExterno) break;
        }
    }

    return true;
}


// Helper para resolver rutas locales de anexos PDF sin importar si vienen de Linux o Windows
function resolverRutaLocalPDF(ruta) {
    if (!ruta || typeof ruta !== 'string') return null;
    if (fs.existsSync(ruta)) return ruta;
    
    const filename = path.basename(ruta);
    if (!filename) return null;

    const candidates = [
        path.join(__dirname, '..', 'uploads', 'deserciones', filename),
        path.join(__dirname, '..', 'uploads', 'deserciones_pdf', filename),
        path.join(__dirname, '..', 'uploads', filename),
        path.join(process.cwd(), 'uploads', 'deserciones', filename),
        path.join(process.cwd(), 'uploads', 'deserciones_pdf', filename),
        path.join(process.cwd(), 'uploads', filename)
    ];

    for (const cand of candidates) {
        if (fs.existsSync(cand)) return cand;
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────
// PASO 4 (DESERCIONES): Diligenciamiento de Formulario "Comunicación Electrónica" en OnBase Web
// 1. Destinatario Externo: Selección de Radio "Externo"
// 2. Nombre Destinatario: Aprendiz (destinatarioexterno24_input)
// 3. Email Destinatario: Correo Registrado en Sofía (mailto_input)
// 4. Asunto: 'NOVEDADES DE ALUMNOS' (asunto27_input + Clic en dropdown de autocompletado)
// 5. Descripción del Asunto: 'Notificación' (descripcionasunto28_input)
// 6. Campo de Texto: Texto completo de la carta combinada (ctxt_cuerpo_input)
// 7. Adjuntar anexo: Resolución / Documento PDF / Anexo explícito
// 8. Copias Externas: Clic en 'Add' e ingresar Nombre y Correo en Copias Externas
// 9. Enviar: Clic en el botón "Enviar"
// ─────────────────────────────────────────────────────────────────
async function paso4_diligenciarComunicacionElectronica(page, browser, casoData, logs, opts = {}) {
    logs.push(`[PASO 4] Iniciando diligenciamiento fluido de formulario para Aprendiz: "${casoData.aprendiz_nombre || 'N/A'}"...`);
    await wait(200);

    // 0. Localizar el frame EXACTO donde está el formulario Unity Form de OnBase
    let formFrame = null;
    const allPages = await browser.pages().catch(() => [page]);
    for (const pg of allPages) {
        for (const frame of pg.frames()) {
            try {
                const isTarget = await frame.evaluate(() => {
                    const byId = document.getElementById('destinatarioexterno24_input') ||
                                 document.getElementById('mailto_input') ||
                                 document.getElementById('asunto27_input') ||
                                 document.getElementById('radiobuttongroupTipoDestinatario_radiobutton4');
                    if (byId) return true;
                    const href = (window.location && window.location.href) || '';
                    if (href.includes('UnityFormHandler.ashx')) return true;
                    const txt = document.body ? document.body.innerText.toLowerCase() : '';
                    return (txt.includes('destinatario externo') || txt.includes('uform comunicacion electronica')) &&
                           document.querySelectorAll('input').length > 5;
                });
                if (isTarget) {
                    formFrame = frame;
                    break;
                }
            } catch (e) {}
        }
        if (formFrame) break;
    }

    if (!formFrame) {
        logs.push('[PASO 4] ⚠️ Usando marco principal como fallback.');
        formFrame = page.mainFrame ? page.mainFrame() : page;
    }

    // Helper universal inyectado en el contexto del navegador para manipulación nativa del DOM
    const locatorScript = `
        function getDeepestLabel(searchText, excludeText) {
            const candidates = Array.from(document.querySelectorAll('label, td, th, span, div, b, strong')).filter(el => {
                const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
                const hasSearch = txt.includes(searchText.toLowerCase());
                const hasExclude = excludeText ? txt.includes(excludeText.toLowerCase()) : false;
                const isTipoHeader = txt.includes('tipo de destinatario') || txt.includes('seleccione tipo');
                if (searchText.toLowerCase().includes('nombre') && isTipoHeader) return false;
                return hasSearch && !hasExclude;
            });
            if (candidates.length === 0) return null;
            candidates.sort((a, b) => ((a.innerText || a.textContent || '').trim().length - (b.innerText || b.textContent || '').trim().length));
            return candidates[0];
        }

        function getAssociatedInput(labelEl) {
            if (!labelEl) return null;
            let inp = labelEl.querySelector('input:not([type="hidden"]), select, textarea');
            if (inp) return inp;
            
            if (labelEl.parentElement) {
                inp = labelEl.parentElement.querySelector('input:not([type="hidden"]), select, textarea');
                if (inp) return inp;
            }
            
            if (labelEl.nextElementSibling) {
                inp = labelEl.nextElementSibling.querySelector('input:not([type="hidden"]), select, textarea') ||
                      (labelEl.nextElementSibling.tagName.match(/INPUT|SELECT|TEXTAREA/i) ? labelEl.nextElementSibling : null);
                if (inp) return inp;
            }
            
            const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'));
            return allInputs.find(i => (labelEl.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_FOLLOWING));
        }

        function setNativeValue(input, val) {
            if (!input) return false;
            input.focus();
            try { input.click(); } catch(e){}

            const isSelect = input.tagName.toLowerCase() === 'select';
            if (isSelect) {
                const opts = Array.from(input.options);
                const matchOpt = opts.find(o => (o.text || '').toLowerCase().includes(val.toLowerCase()) || (o.value || '').toLowerCase().includes(val.toLowerCase()));
                if (matchOpt) {
                    input.value = matchOpt.value;
                } else if (opts.length > 1) {
                    input.selectedIndex = 1;
                }
            } else if (input.tagName.toLowerCase() === 'textarea') {
                input.value = val;
                input.innerText = val;
            } else {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                if (nativeSetter) {
                    nativeSetter.call(input, val);
                } else {
                    input.value = val;
                }
                input.setAttribute('value', val);
            }

            const events = ['compositionstart', 'input', 'keydown', 'keypress', 'keyup', 'compositionend', 'change', 'blur'];
            for (const evtName of events) {
                try {
                    input.dispatchEvent(new Event(evtName, { bubbles: true, cancelable: true }));
                } catch(e){}
            }
            if (typeof input.oninput === 'function') try { input.oninput(); } catch(e){}
            if (typeof input.onchange === 'function') try { input.onchange(); } catch(e){}
            if (typeof input.onblur === 'function') try { input.onblur(); } catch(e){}
            return true;
        }
    `;

    // 0. Enforzar selección de "Externo"
    logs.push('[PASO 4] 1/8 Marcando tipo de destinatario: "Externo"...');
    await formFrame.evaluate(() => {
        // ID directo del radio Externo en Unity Form
        const rExterno = document.getElementById('radiobuttongroupTipoDestinatario_radiobutton4');
        if (rExterno) {
            rExterno.scrollIntoView({ block: 'center' });
            rExterno.click();
            rExterno.checked = true;
            rExterno.dispatchEvent(new Event('change', { bubbles: true }));
            rExterno.dispatchEvent(new Event('click', { bubbles: true }));
            return;
        }
        // Fallback
        const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
        const r = radios.find(rad => {
            const txt = (rad.value || rad.id || rad.name || rad.parentElement?.innerText || '').toLowerCase();
            return txt.includes('externo') && !txt.includes('copia');
        });
        if (r) {
            r.click();
            r.checked = true;
            r.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }).catch(() => {});
    await wait(200);

    // 1 y 2. Destinatario Externo: Nombre y Email del Aprendiz
    const nombreAprendiz = (
        casoData.aprendiz_nombre || 
        `${casoData.aprendiz_nombres || ''} ${casoData.aprendiz_apellidos || ''}`.trim() ||
        casoData.raw_row?.['NOMBRE'] ||
        casoData.raw_row?.['NOMBRES'] ||
        casoData.raw_row?.['APRENDIZ'] ||
        'APRENDIZ'
    ).trim();

    const emailAprendiz = (
        casoData.aprendiz_correo || 
        casoData.correo ||
        casoData.email ||
        casoData.aprendiz_email ||
        casoData.raw_row?.['CORREO REGISTRADO EN SOFÍA'] || 
        casoData.raw_row?.['CORREO REGISTRADO EN SOFIA'] || 
        casoData.raw_row?.['CORREO'] || 
        casoData.raw_row?.['EMAIL'] || 
        casoData.raw_row?.['MAIL'] ||
        casoData.raw_row?.['CORREO_ELECTRONICO'] ||
        casoData.raw_row?.['Correo'] ||
        casoData.raw_row?.['Correo Electrónico'] ||
        ''
    ).trim();

    logs.push(`[PASO 4] 1/8 Llenando "Nombre Destinatario": "${nombreAprendiz}"...`);
    logs.push(`[PASO 4] 2/8 Llenando "Email Destinatario": "${emailAprendiz}"...`);

    // Inyección DOM precisa por ID
    await formFrame.evaluate((nombre, email, helperStr) => {
        eval(helperStr);

        // Nombre Destinatario Externo: #destinatarioexterno24_input
        let nameInp = document.getElementById('destinatarioexterno24_input') ||
                      document.querySelector('input[id*="destinatarioexterno"]:not([id*="copia"])');
        if (!nameInp) {
            const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
            nameInp = inputs.find(i => {
                const p = (i.parentElement?.innerText || i.closest('tr, div, td')?.innerText || '').toLowerCase();
                return p.includes('nombre destinatario') && !p.includes('copia');
            });
        }
        if (nameInp) {
            setNativeValue(nameInp, nombre);
        }

        // Email Destinatario Externo: #mailto_input
        // NOTA CRÍTICA: #mailto_input es el campo visible de destinatario externo.
        let emailInp = document.getElementById('mailto_input');
        if (!emailInp) {
            const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="email"], input:not([type])'));
            emailInp = inputs.find(i => {
                const id = (i.id || '').toLowerCase();
                const p = (i.parentElement?.innerText || i.closest('tr, div, td')?.innerText || '').toLowerCase();
                return (id === 'mailto_input' || (p.includes('email destinatario') && !p.includes('copia') && !id.includes('emailusuario')));
            });
        }
        if (emailInp) {
            setNativeValue(emailInp, email);
        }
    }, nombreAprendiz, emailAprendiz, locatorScript).catch(() => {});

    // Puppeteer keyboard typing para confirmar foco y eventos
    try {
        const nameHandle = await formFrame.$('#destinatarioexterno24_input, input[id*="destinatarioexterno"]:not([id*="copia"])').catch(() => null);
        if (nameHandle) {
            await nameHandle.click({ clickCount: 3 }).catch(() => {});
            await nameHandle.press('Backspace').catch(() => {});
            await nameHandle.type(nombreAprendiz, { delay: 5 }).catch(() => {});
        }
    } catch(e) {}

    try {
        const emailHandle = await formFrame.$('#mailto_input, input#mailto_input, input[id*="mailto"]').catch(() => null);
        if (emailHandle) {
            await emailHandle.click({ clickCount: 3 }).catch(() => {});
            await emailHandle.press('Backspace').catch(() => {});
            await emailHandle.type(emailAprendiz, { delay: 5 }).catch(() => {});
        }
    } catch(e) {}

    // Verificación final para asegurar que mailto_input conserve la dirección de correo
    await formFrame.evaluate((email, helperStr) => {
        eval(helperStr);
        let emailInp = document.getElementById('mailto_input') || document.querySelector('input[id*="mailto"]');
        if (emailInp && emailInp.value !== email) {
            setNativeValue(emailInp, email);
        }
    }, emailAprendiz, locatorScript).catch(() => {});

    logs.push(`[PASO 4] ✅ "Nombre Destinatario" (${nombreAprendiz}) y "Email Destinatario" (${emailAprendiz}) establecidos.`);
    await wait(200);

    // 3. Asunto ('NOVEDADES DE ALUMNOS')
    const asuntoVal = (casoData.asunto || 'NOVEDADES DE ALUMNOS').trim();
    logs.push(`[PASO 4] 3/8 Seleccionando "Asunto": "${asuntoVal}"...`);

    // A. Inyección directa y disparo de autocompletado nativo + jQuery UI
    await formFrame.evaluate((asunto, helperStr) => {
        eval(helperStr);
        let asuntoInp = document.getElementById('asunto27_input') ||
                        document.querySelector('input[id*="asunto"]:not([id*="desc"])');
        if (asuntoInp) {
            setNativeValue(asuntoInp, asunto);
            try {
                if (window.$ && $(asuntoInp).autocomplete) {
                    $(asuntoInp).val(asunto);
                    $(asuntoInp).autocomplete('search', asunto);
                }
            } catch(e) {}
        }
    }, asuntoVal, locatorScript).catch(() => {});

    // B. Teclear el texto completo en el input de Asunto
    try {
        const asuntoHandle = await formFrame.$('#asunto27_input, input[id*="asunto"]:not([id*="desc"])').catch(() => null);
        if (asuntoHandle) {
            await asuntoHandle.click({ clickCount: 3 }).catch(() => {});
            await asuntoHandle.press('Backspace').catch(() => {});
            await asuntoHandle.type(asuntoVal, { delay: 15 }).catch(() => {});
            await wait(300);

            // C. HACER CLICK DIRECTO EN LA OPCIÓN DEL DROPDOWN QUE COINCIDA CON 'NOVEDADES DE ALUMNOS'
            let clickedOption = await formFrame.evaluate((targetAsunto) => {
                const items = Array.from(document.querySelectorAll('.ui-menu-item, .ui-menu-item-wrapper, li.ui-menu-item a, ul.ui-autocomplete li, div.ui-menu-item-wrapper'));
                const match = items.find(el => {
                    const t = (el.innerText || el.textContent || '').trim().toUpperCase();
                    return t === targetAsunto.toUpperCase() || t.startsWith(targetAsunto.toUpperCase()) || t.includes(targetAsunto.toUpperCase());
                });
                if (match) {
                    match.scrollIntoView({ block: 'nearest' });
                    match.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
                    match.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                    match.click();
                    match.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                    return true;
                }
                return false;
            }, asuntoVal).catch(() => false);

            if (!clickedOption) {
                // Probar en el documento superior por si el menú se renderiza fuera del iframe
                clickedOption = await page.evaluate((targetAsunto) => {
                    const items = Array.from(document.querySelectorAll('.ui-menu-item, .ui-menu-item-wrapper, li.ui-menu-item a, ul.ui-autocomplete li'));
                    const match = items.find(el => {
                        const t = (el.innerText || el.textContent || '').trim().toUpperCase();
                        return t === targetAsunto.toUpperCase() || t.startsWith(targetAsunto.toUpperCase()) || t.includes(targetAsunto.toUpperCase());
                    });
                    if (match) {
                        match.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
                        match.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                        match.click();
                        return true;
                    }
                    return false;
                }, asuntoVal).catch(() => false);
            }

            if (!clickedOption) {
                // Fallback de teclado: ArrowDown + Enter
                await page.keyboard.press('ArrowDown').catch(() => {});
                await wait(150);
                await page.keyboard.press('Enter').catch(() => {});
                await wait(150);
            }

            // Asegurar que el input mantenga la cadena exacta "NOVEDADES DE ALUMNOS"
            await formFrame.evaluate((asunto, helperStr) => {
                eval(helperStr);
                const asuntoInp = document.getElementById('asunto27_input') ||
                                  document.querySelector('input[id*="asunto"]:not([id*="desc"])');
                if (asuntoInp) {
                    setNativeValue(asuntoInp, asunto);
                    asuntoInp.value = asunto;
                    asuntoInp.dispatchEvent(new Event('change', { bubbles: true }));
                    asuntoInp.dispatchEvent(new Event('blur', { bubbles: true }));
                }
            }, asuntoVal, locatorScript).catch(() => {});

            await page.keyboard.press('Tab').catch(() => {});
        }
    } catch(e) {}

    logs.push(`[PASO 4] ✅ "Asunto" confirmado y seleccionado: "${asuntoVal}".`);
    await wait(200);

    // 4. Descripción del Asunto ('Notificación')
    const descAsuntoVal = casoData.descripcion_asunto || 'Notificación';
    logs.push(`[PASO 4] 4/8 Llenando "Descripción del Asunto": "${descAsuntoVal}"...`);

    await formFrame.evaluate((desc, helperStr) => {
        eval(helperStr);
        const descInp = document.getElementById('descripcionasunto28_input') ||
                        document.querySelector('input[id*="descripcionasunto"]');
        if (descInp) setNativeValue(descInp, desc);
    }, descAsuntoVal, locatorScript).catch(() => {});

    try {
        const descHandle = await formFrame.$('#descripcionasunto28_input, input[id*="descripcionasunto"]').catch(() => null);
        if (descHandle) {
            await descHandle.click({ clickCount: 3 }).catch(() => {});
            await descHandle.type(descAsuntoVal, { delay: 5 }).catch(() => {});
        }
    } catch(e) {}

    logs.push(`[PASO 4] ✅ "Descripción del Asunto" completada: "${descAsuntoVal}".`);
    await wait(200);

    // 5. Campo de Texto: Carta Combinada
    const textoCombinado = casoData.texto_combinado || casoData.texto_inicial || '';
    logs.push(`[PASO 4] 5/8 Llenando "Texto" (Carta Combinada)...`);

    await formFrame.evaluate((texto, helperStr) => {
        eval(helperStr);
        const textoInp = document.getElementById('ctxt_cuerpo_input') ||
                         document.querySelector('textarea.check_visibility') ||
                         document.querySelector('textarea');
        if (textoInp) setNativeValue(textoInp, texto);
    }, textoCombinado, locatorScript).catch(() => {});

    logs.push(`[PASO 4] ✅ "Texto" (Carta Combinada) insertado en el formulario.`);
    await wait(200);

    // 6. Adjuntar Anexo (Resolución / Documento PDF)
    const filesToAttach = [];
    const localAnexo = resolverRutaLocalPDF(casoData.anexo_path);
    if (localAnexo) {
        filesToAttach.push(localAnexo);
    }
    const localPdfCom = resolverRutaLocalPDF(casoData.comunicacion_pdf_path);
    if (localPdfCom && !filesToAttach.includes(localPdfCom)) {
        filesToAttach.push(localPdfCom);
    }

    if (filesToAttach.length > 0) {
        for (let fIdx = 0; fIdx < filesToAttach.length; fIdx++) {
            const pdfFile = filesToAttach[fIdx];
            logs.push(`[PASO 4] 6/8 Adjuntando resolución/anexo PDF (${fIdx + 1}/${filesToAttach.length}): "${path.basename(pdfFile)}"...`);

            let attachedSuccess = false;
            await formFrame.evaluate(() => {
                const selects = Array.from(document.querySelectorAll('select'));
                const attSelect = selects.find(s => {
                    const txt = (s.parentElement?.innerText || s.closest('tr, div, td')?.innerText || '').toLowerCase();
                    return txt.includes('anexo') || txt.includes('attachment');
                });
                if (attSelect && attSelect.options.length > 1) {
                    if (attSelect.selectedIndex <= 0) attSelect.selectedIndex = 1;
                    attSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }).catch(() => {});

            const attachBtnHandle = await formFrame.$('#attachment68_container_button, .file_input_button, input[value*="Adjuntar"]').catch(() => null);

            if (attachBtnHandle) {
                try {
                    const fcPromise = page.waitForFileChooser({ timeout: 4000 }).catch(() => null);
                    await attachBtnHandle.click().catch(() => {});
                    const fileChooser = await fcPromise;
                    if (fileChooser) {
                        await fileChooser.accept([pdfFile]);
                        attachedSuccess = true;
                        logs.push(`[PASO 4] ✅ Archivo PDF (${path.basename(pdfFile)}) adjuntado mediante selector de archivos.`);
                    }
                } catch (e) {}
            }

            if (!attachedSuccess) {
                try {
                    const fileInputs = await formFrame.$$('input[type="file"]');
                    if (fileInputs && fileInputs.length > 0) {
                        for (const fInput of fileInputs) {
                            await fInput.uploadFile(pdfFile);
                            attachedSuccess = true;
                            logs.push(`[PASO 4] ✅ Archivo PDF (${path.basename(pdfFile)}) cargado en input file.`);
                            break;
                        }
                    }
                } catch (e) {}
            }

            if (!attachedSuccess) {
                logs.push(`[PASO 4] ⚠️ Advertencia: No se pudo verificar la adjunción de "${path.basename(pdfFile)}".`);
            }
            await wait(200);
        }
    } else {
        logs.push(`[PASO 4] ⚠️ Archivo PDF no encontrado o sin ruta registrada.`);
    }
    await wait(200);

    // 7. Copias Externas (CC)
    let copyEmailsList = [];
    if (casoData.copy_emails) {
        try {
            copyEmailsList = typeof casoData.copy_emails === 'string' ? JSON.parse(casoData.copy_emails) : casoData.copy_emails;
        } catch (e) {}
    }

    if (Array.isArray(copyEmailsList) && copyEmailsList.length > 0) {
        logs.push(`[PASO 4] 7/8 Agregando ${copyEmailsList.length} correos EXCLUSIVAMENTE en Copias Externas (CC)...`);

        try {
            for (let i = 0; i < copyEmailsList.length; i++) {
                const currentCount = await formFrame.evaluate(() => {
                    const inputs = Array.from(document.querySelectorAll('input[id*="destinatarioexternocopia"], input[id*="mailcc"]'));
                    return Math.floor(inputs.length / 2);
                }).catch(() => 0);

                if (i >= currentCount) {
                    await formFrame.evaluate(() => {
                        const ccHeader = Array.from(document.querySelectorAll('label, div, span, td, fieldset')).find(el => {
                            const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                            return t.includes('copias externas') && !t.includes('interna');
                        });
                        if (ccHeader) {
                            const container = ccHeader.closest('tr, table, div, fieldset') || ccHeader.parentElement;
                            const addBtn = container ? container.querySelector('input.addItem, button.addItem, .addItem, input[type="button"]') : null;
                            if (addBtn) {
                                addBtn.scrollIntoView({ block: 'center' });
                                addBtn.click();
                                return true;
                            }
                        }
                        const addBtns = Array.from(document.querySelectorAll('input.addItem, button.addItem, .addItem'));
                        if (addBtns.length >= 2) {
                            addBtns[1].click();
                            return true;
                        } else if (addBtns.length === 1) {
                            addBtns[0].click();
                            return true;
                        }
                        return false;
                    }).catch(() => {});
                    await wait(350);
                }
            }

            await formFrame.evaluate((ccList, helperStr) => {
                eval(helperStr);
                const ccHeader = Array.from(document.querySelectorAll('label, div, span, td, fieldset')).find(el => {
                    const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                    return t.includes('copias externas') && !t.includes('interna');
                });
                const nextHeader = Array.from(document.querySelectorAll('label, div, span, td, fieldset')).find(el => {
                    const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                    return t.includes('asociar a otras') || t.includes('enviar');
                });

                const allInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="email"], input:not([type])'));
                const ccInputs = allInputs.filter(inp => {
                    const id = (inp.id || '').toLowerCase();
                    if (id.includes('destinatarioexternocopia') || id.includes('mailcc')) return true;
                    if (ccHeader) {
                        const afterCC = (ccHeader.compareDocumentPosition(inp) & Node.DOCUMENT_POSITION_FOLLOWING);
                        const beforeNext = nextHeader ? (inp.compareDocumentPosition(nextHeader) & Node.DOCUMENT_POSITION_FOLLOWING) : true;
                        return afterCC && beforeNext;
                    }
                    return false;
                });

                for (let i = 0; i < ccList.length; i++) {
                    const ccItem = ccList[i];
                    const nameVal = ccItem.name || (ccItem.email ? ccItem.email.split('@')[0] : 'Destinatario CC');
                    const emailVal = ccItem.email || '';

                    const nameInp = ccInputs[i * 2];
                    const emailInp = ccInputs[i * 2 + 1];

                    if (nameInp) setNativeValue(nameInp, nameVal);
                    if (emailInp) setNativeValue(emailInp, emailVal);
                }
            }, copyEmailsList, locatorScript).catch(() => {});
        } catch(e){}

        logs.push(`[PASO 4] ✅ ${copyEmailsList.length} Copias Externas (CC) registradas con Nombre Destinatario y Email Destinatario.`);
    }

    // 8. Dar clic en el botón "Enviar" (salvo que sea solo_diligenciar)
    if (!opts.solo_diligenciar) {
        logs.push(`[PASO 4] 8/8 Clic en botón "Enviar" para radicar la Comunicación Electrónica...`);
        await wait(400);

        let sent = false;

        // A. Búsqueda en el marco del formulario
        let sendHandle = await formFrame.$('input[type="submit"], input[value="Enviar"], input[value*="Enviar"], button[value*="Enviar"], input.ui-button-label-wrap').catch(() => null);

        // B. Búsqueda en la página principal si no está en el iframe
        if (!sendHandle) {
            sendHandle = await page.$('input[type="submit"], input[value="Enviar"], input[value*="Enviar"], button[value*="Enviar"]').catch(() => null);
        }

        // C. Búsqueda exhaustiva en todos los marcos abiertos
        if (!sendHandle) {
            const allPages = await browser.pages().catch(() => [page]);
            for (const pg of allPages) {
                for (const fr of pg.frames()) {
                    const h = await fr.$('input[type="submit"], input[value="Enviar"], input[value*="Enviar"]').catch(() => null);
                    if (h) {
                        sendHandle = h;
                        break;
                    }
                }
                if (sendHandle) break;
            }
        }

        if (sendHandle) {
            await sendHandle.scrollIntoView({ block: 'center' }).catch(() => {});
            await sendHandle.click().catch(() => {});
            sent = true;
        }

        // Fallback DOM dispatch
        if (!sent) {
            sent = await formFrame.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('input[type="submit"], input[type="button"], button, a, div[role="button"]'));
                const sendBtn = btns.find(b => {
                    const txt = (b.value || b.innerText || b.textContent || '').trim().toLowerCase();
                    return txt === 'enviar' || txt === 'enviar comunicación' || (txt.includes('enviar') && !txt.includes('asociar'));
                });

                if (sendBtn) {
                    sendBtn.scrollIntoView({ block: 'center' });
                    sendBtn.focus();
                    sendBtn.click();
                    if (sendBtn.form) {
                        try { sendBtn.form.submit(); } catch(e){}
                    }
                    return true;
                }
                return false;
            }).catch(() => false);
        }

        if (sent) {
            logs.push(`[PASO 4] ✅ Clic en el botón "Enviar" completado exitosamente. Comunicación enviada.`);
        } else {
            logs.push(`[PASO 4] ⚠️ Botón "Enviar" no localizado automáticamente en la pantalla.`);
        }
    } else {
        logs.push(`[PASO 4] ✅ Formulario completamente diligenciado. Listo en pantalla para inspección antes de enviar.`);
    }

    return true;
}



// ─────────────────────────────────────────────────────────────────
// PASO 3: CÓDIGO DE EXPEDIENTE
// ─────────────────────────────────────────────────────────────────
async function paso3_codigoExpediente(page, browser, code, logs) {
    if (!code) {
        logs.push('[PASO 3] Sin código de expediente, saltando...');
        return null; // retorna formPage para los siguientes pasos
    }
    logs.push(`[PASO 3] Buscando campo "Código Expediente" para código: "${code}"`);

    let formPage = null;
    let formFrame = null;
    let comboInput = null; // ElementHandle del input

    // Esperar hasta 20s que aparezca el formulario con el campo
    for (let t = 0; t < 40 && !comboInput; t++) {
        await wait(500);
        await checkAndClearLocks(browser, logs);
        const allPages = await browser.pages();

        for (const pg of allPages) {
            for (const frame of pg.frames()) {
                try {
                    const handle = await frame.evaluateHandle(() => {
                        // Estrategia 1: por ID exacto de OnBase (#sgdeaexpediente8_input) o atributos
                        const byAttr = document.querySelector(
                            '#sgdeaexpediente8_input, input[title*="xpediente" i], input[name*="xpediente" i], input[id*="xpediente" i]'
                        );
                        if (byAttr && !byAttr.readOnly) return byAttr;

                        // Estrategia 2: buscar el label "Código Expediente" en la página
                        const tds = Array.from(document.querySelectorAll('td, th, label, span, div'));
                        const labelEl = tds.find(el => {
                            const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                            return t === 'código expediente' || t === 'codigo expediente'
                                || t.startsWith('código exp') || t.startsWith('codigo exp');
                        });
                        if (labelEl) {
                            const row = labelEl.closest('tr');
                            if (row) {
                                const inp = row.querySelector('input:not([type="hidden"]):not([readonly])');
                                if (inp) return inp;
                                const nextRow = row.nextElementSibling;
                                if (nextRow) {
                                    const inp2 = nextRow.querySelector('input:not([type="hidden"]):not([readonly])');
                                    if (inp2) return inp2;
                                }
                            }
                            let parent = labelEl.parentElement;
                            for (let i = 0; i < 4 && parent; i++) {
                                const inp = parent.querySelector('input:not([type="hidden"]):not([readonly])');
                                if (inp) return inp;
                                parent = parent.parentElement;
                            }
                        }
                        return null;
                    });

                    const el = handle.asElement();
                    if (el) {
                        comboInput = el;
                        formPage = pg;
                        formFrame = frame;
                        logs.push(`[PASO 3] ✅ Campo encontrado en t=${(t * 0.5).toFixed(1)}s — URL: ${pg.url().substring(0, 60)}`);
                        break;
                    }
                } catch { }
            }
            if (comboInput) break;
        }
    }

    if (!comboInput) {
        logs.push('[PASO 3][WARN] Campo "Código Expediente" no encontrado. Usando fallback.');
        formPage = page;
        formFrame = page.mainFrame();
    } else {
        // Enfocar la página correcta
        await formPage.bringToFront();
        await wait(300);

        // Diagnóstico: qué inputs hay en el frame
        const inputInfo = await formFrame.evaluate(() => {
            return Array.from(document.querySelectorAll('input:not([type="hidden"])'))
                .slice(0, 6)
                .map(el => ({ type: el.type, title: el.title, name: el.name, id: el.id, ro: el.readOnly }));
        }).catch(() => []);
        // Verificar si ya está cargado y vinculado de un documento anterior en el mismo lote
        const alreadyBound = await formFrame.evaluate((c) => {
            const inp = document.querySelector('#sgdeaexpediente8_input');
            const serie = document.querySelector('#sgdeacodigoserie10_input, input[id*="serie" i]');
            return inp && inp.value && inp.value.trim() === c && serie && serie.value && serie.value.trim().length > 0;
        }, code).catch(() => false);

        if (alreadyBound) {
            logs.push(`[PASO 3] ⚡ Expediente "${code}" ya vinculado de documento anterior. Continuando sin reescribir.`);
            return { formPage, formFrame, success: true };
        }

        // Escribir el código asegurando limpieza absoluta previa (evita duplicación de texto)
        try {
            await formFrame.evaluate(el => {
                el.value = '';
                el.focus();
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, comboInput);

            await comboInput.click();
            await wait(100);
            await formPage.keyboard.down('Control');
            await formPage.keyboard.press('KeyA');
            await formPage.keyboard.up('Control');
            await formPage.keyboard.press('Backspace');
            await wait(100);

            // Escribir ágil (delay 35ms)
            logs.push(`[PASO 3] Escribiendo "${code}" (${code.length} chars, delay 35ms)...`);
            for (const char of code) {
                await formPage.keyboard.type(char, { delay: 35 });
            }
            await wait(200);

            // Disparar eventos
            await formFrame.evaluate(el => {
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, comboInput);

            // Verificar valor escrito
            const valEscrito = await formFrame.evaluate(el => el.value, comboInput).catch(() => '?');
            logs.push(`[PASO 3] Valor en campo tras escritura: "${valEscrito}"`);

            if (valEscrito === code) {
                logs.push('[PASO 3] ✅ Código escrito correctamente');
            } else {
                logs.push(`[PASO 3][WARN] Valor esperado "${code}", en campo "${valEscrito}". Corrigiendo vía evaluate...`);
                await formFrame.evaluate((el, c) => {
                    el.value = c;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }, comboInput, code);
            }
        } catch (e) {
            logs.push(`[PASO 3][ERROR] Al escribir código: ${e.message}`);
        }
    }

    // Esperar dropdown de sugerencias de OnBase (hasta 8s)
    logs.push('[PASO 3] Esperando dropdown de OnBase...');
    const DROPDOWN_SELS = [
        'ul.CodeEntry_DropdownList_ItemRowList li',
        '.CodeEntry_DropdownList li',
        'table.AutoCompleteList td',
        '.ac_results li',
        '.ui-autocomplete li.ui-menu-item',
        '[role="listbox"] [role="option"]',
        '[role="option"]',
        'div[class*="dropdown" i] div[class*="item" i]',
        'li[class*="suggestion" i]',
        'div[class*="CodeEntry" i] li',
    ];

    let dropdownHandled = false;

    for (let t = 0; t < 10 && !dropdownHandled; t++) {
        await wait(500);
        // Priorizar formFrame
        const framesToCheck = [];
        if (formFrame) framesToCheck.push(formFrame);
        const allPages = await browser.pages();
        for (const pg of allPages) {
            for (const fr of pg.frames()) {
                if (fr !== formFrame) framesToCheck.push(fr);
            }
        }

        for (const fr of framesToCheck) {
            try {
                const clickedText = await fr.evaluate((sels, sc) => {
                    for (const sel of sels) {
                        const items = Array.from(document.querySelectorAll(sel)).filter(el => {
                            const r = el.getBoundingClientRect();
                            return r.width > 0 && r.height > 0;
                        });
                        if (items.length > 0) {
                            const exact = items.find(i => (i.innerText || i.textContent || '').includes(sc));
                            const target = exact || items[0];
                            const text = (target.innerText || target.textContent || '').trim().substring(0, 80);
                            target.scrollIntoView({ block: 'nearest' });
                            target.click();
                            target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                            target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                            target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                            return text;
                        }
                    }
                    return null;
                }, DROPDOWN_SELS, code);

                if (clickedText) {
                    logs.push(`[PASO 3] ✅ Dropdown detectado t=${(t * 0.5).toFixed(1)}s → "${clickedText}" (clic directo aplicado)`);
                    logs.push('[PASO 3] Esperando autorrelleno (2.5s)...');
                    await wait(2500);
                    dropdownHandled = true;
                    break;
                }
            } catch { }
        }
        if (dropdownHandled) break;
    }

    if (!dropdownHandled) {
        logs.push('[PASO 3][WARN] Dropdown no detectado. Fallback: ArrowDown + Enter');
        if (formPage) {
            await formPage.keyboard.press('ArrowDown');
            await wait(400);
            await formPage.keyboard.press('ArrowDown');
            await wait(200);
            await formPage.keyboard.press('Enter');
            await wait(2500);
        }
    }

    // Leer campos autorrellenos
    if (formFrame) {
        const autoFilled = await formFrame.evaluate(() => {
            return Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="button"])'))
                .filter(el => el.value && el.value.trim())
                .map(el => ({
                    title: el.title || el.name || el.id || '?',
                    value: el.value.trim().substring(0, 60),
                    ro: el.readOnly
                }));
        }).catch(() => []);
        logs.push(`[PASO 3] Campos con valor tras selección: ${autoFilled.length}`);
        autoFilled.forEach(f => logs.push(`[PASO 3]   [${f.ro ? 'RO' : 'RW'}] ${f.title}: "${f.value}"`));
    }

    logs.push('[PASO 3] ✅ Código Expediente completado');
    return { formPage, formFrame, success: !!comboInput };
}

// ─────────────────────────────────────────────────────────────────
// PASO 4: LLENAR CAMPOS DEL FORMULARIO
// ─────────────────────────────────────────────────────────────────

async function llenarCampoTexto(frame, pg, labelKeyword, value, logs) {
    if (!value || !frame) return false;
    try {
        const success = await frame.evaluate((kw, val) => {
            const inputs = Array.from(document.querySelectorAll(
                'input[type="text"]:not([readonly]):not([disabled]), ' +
                'input:not([type]):not([readonly]):not([disabled]), ' +
                'textarea:not([readonly]):not([disabled])'
            ));
            for (const inp of inputs) {
                const candidateTexts = [];
                const tr = inp.closest('tr');
                if (tr) candidateTexts.push((tr.innerText || tr.textContent || '').toLowerCase());
                const td = inp.closest('td');
                if (td && td.previousElementSibling) candidateTexts.push((td.previousElementSibling.innerText || td.previousElementSibling.textContent || '').toLowerCase());
                candidateTexts.push((inp.title || '').toLowerCase());
                candidateTexts.push((inp.name || '').toLowerCase());
                candidateTexts.push((inp.id || '').toLowerCase());
                candidateTexts.push((inp.placeholder || '').toLowerCase());
                if (inp.id) {
                    const lbl = document.querySelector(`label[for="${inp.id}"]`);
                    if (lbl) candidateTexts.push((lbl.innerText || '').toLowerCase());
                }

                const kwLower = kw.toLowerCase();
                if (candidateTexts.some(t => t.includes(kwLower))) {
                    inp.scrollIntoView({ block: 'center' });
                    inp.focus();
                    inp.value = val;
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                    inp.blur();
                    return true;
                }
            }
            return false;
        }, labelKeyword, value);

        if (success) {
            logs.push(`[PASO 4] ✅ "${labelKeyword}" → "${value}"`);
            await wait(200);
            return true;
        } else {
            logs.push(`[PASO 4][WARN] Campo "${labelKeyword}" no encontrado`);
            return false;
        }
    } catch (e) {
        logs.push(`[PASO 4][WARN] "${labelKeyword}": ${e.message?.substring(0, 80)}`);
        return false;
    }
}


/**
 * Cambia un <select> por valor de opción (texto).
 */
async function llenarSelect(frame, labelKeyword, value, logs) {
    if (!value || !frame) return false;
    try {
        const filled = await frame.evaluate((kw, val) => {
            const selects = Array.from(document.querySelectorAll('select:not([disabled])'));
            for (const sel of selects) {
                const texts = [];
                const tr = sel.closest('tr');
                if (tr) texts.push((tr.innerText || '').toLowerCase());
                const td = sel.closest('td');
                if (td && td.previousElementSibling)
                    texts.push((td.previousElementSibling.innerText || '').toLowerCase());
                texts.push((sel.title || '').toLowerCase());
                texts.push((sel.name || '').toLowerCase());
                texts.push((sel.id || '').toLowerCase());

                if (texts.some(t => t.includes(kw.toLowerCase()))) {
                    const opts = Array.from(sel.options);
                    const opt = opts.find(o =>
                        o.text.trim().toLowerCase() === val.toLowerCase() ||
                        o.text.trim().toLowerCase().includes(val.toLowerCase())
                    );
                    if (opt) sel.value = opt.value;
                    else {
                        // Intentar por value directo
                        const byVal = opts.find(o => o.value.toLowerCase().includes(val.toLowerCase()));
                        if (byVal) sel.value = byVal.value;
                        else sel.value = val;
                    }
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                    sel.dispatchEvent(new Event('input', { bubbles: true }));
                    return { found: true, selected: sel.options[sel.selectedIndex]?.text || sel.value };
                }
            }
            return { found: false };
        }, labelKeyword, value);

        if (filled?.found) {
            logs.push(`[PASO 4] ✅ Select "${labelKeyword}" → "${filled.selected}"`);
            return true;
        } else {
            logs.push(`[PASO 4][WARN] Select "${labelKeyword}" no encontrado`);
            return false;
        }
    } catch (e) {
        logs.push(`[PASO 4][WARN] Select "${labelKeyword}": ${e.message?.substring(0, 80)}`);
        return false;
    }
}

async function paso4_llenarCampos(formPage, formFrame, docInfo, logs) {
    if (!formPage || !formFrame) {
        logs.push('[PASO 4][WARN] No hay formFrame, saltando llenado de campos');
        return;
    }
    logs.push('[PASO 4] Llenando campos del formulario SGDEA - Ingreso a Expediente...');

    // Datos del documento
    const tipologia = stripTypologyDecorators(docInfo.typology_name || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
    const nombreDoc = (docInfo.joinedName || docInfo.nombreDocumento || docInfo.filename || '').trim();
    let docDate = '';
    if (docInfo.document_date) {
        // Formato exacto que acepta OnBase: DD/MM/YYYY HH:MM:SS
        const d = new Date(docInfo.document_date);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        docDate = `${dd}/${mm}/${yyyy} 0:00:00`;
    }

    // Diagnóstico inicial: mostrar todos los campos del formulario
    await wait(1000);
    const diagnostico = await formFrame.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll(
            'input:not([type="hidden"]), select, textarea'
        )).map(el => {
            const tr = el.closest('tr, .field-row, .form-group');
            const rowTxt = (tr ? tr.innerText || tr.textContent : '').trim().substring(0, 80);
            return `[${el.tagName}][${el.type||''}] title="${el.title}" name="${el.name}" id="${el.id}" rowTxt="${rowTxt}"`;
        });
        return inputs;
    }).catch(() => []);
    diagnostico.forEach(d => logs.push(`[PASO 4][DIAG] ${d}`));

    // Función que diligencia el campo basándose en selectores CSS exactos para los IDs de OnBase
    const typeFieldNativeById = async (selector, valueToType, fieldName, isDropdown=false) => {
        if (!valueToType) return false;
        logs.push(`[PASO 4] Buscando "${fieldName}" (Selector: ${selector})...`);
        let comboInput = null;
        
        try {
            const handle = await formFrame.evaluateHandle((sel) => {
                const els = Array.from(document.querySelectorAll(sel));
                // Preferir inputs visibles de OnBase (#sgdea..._input), evitando campos ocultos customaction_hidden
                const visible = els.filter(e => {
                    if (e.readOnly || e.disabled) return false;
                    const r = e.getBoundingClientRect();
                    return r.width > 0 && r.height > 0;
                });
                return visible.find(e => (e.id || '').toLowerCase().startsWith('sgdea'))
                    || visible[0]
                    || els.find(e => !e.readOnly && !e.disabled)
                    || els[0]
                    || null;
            }, selector);

            comboInput = handle.asElement();
        } catch(e) { }
        
        if (!comboInput) {
            logs.push(`[PASO 4][WARN] Campo "${fieldName}" no encontrado.`);
            return false;
        }

        try {
            await comboInput.click({ clickCount: 3 });
            await wait(100);
            await formPage.keyboard.down('Control');
            await formPage.keyboard.press('KeyA');
            await formPage.keyboard.up('Control');
            await formPage.keyboard.press('Backspace');
            await formFrame.evaluate(el => {
                if (el) {
                    el.value = '';
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, comboInput).catch(() => {});
            await wait(150);
            await comboInput.focus();
            await wait(100);

            // Si es Tipo Documental o campo con dropdown, aplicar mecanografía inteligente y búsqueda semántica
            let searchKey = valueToType;
            let typingText = valueToType;
            let savedAlias = null;

            if (fieldName.toLowerCase().includes('tipo documental')) {
                // Si la tipología tiene un alias guardado previamente en BD o en el catálogo AES, usarlo directamente
                const catalogAlias = findCatalogOnBaseTypology(docInfo?.typology_name || valueToType) || findCatalogOnBaseTypology(valueToType);
                const isHistorias = docInfo?.trd_series_id === 97 || String(docInfo?.subserie || docInfo?.series_code || '').includes('9224.4-37');
                savedAlias = catalogAlias || docInfo?.onbase_name || null;
                if (!savedAlias) {
                    try {
                        const aliasRes = await pool.query(
                            `SELECT onbase_name FROM trd_typologies 
                             WHERE (id = $1 OR LOWER(TRIM(typology_name)) = LOWER(TRIM($2)) OR LOWER(TRIM(onbase_name)) = LOWER(TRIM($2))) 
                               AND onbase_name IS NOT NULL AND TRIM(onbase_name) != '' 
                             ORDER BY CASE WHEN series_id = $3 OR subseries_id = $4 THEN 0 ELSE 1 END, id ASC
                             LIMIT 1`,
                            [docInfo?.trd_typology_id || docInfo?.typology_id || 0, valueToType.trim(), docInfo?.trd_series_id || 0, docInfo?.trd_subseries_id || 0]
                        );
                        if (aliasRes && aliasRes.rows && aliasRes.rows[0]?.onbase_name) {
                            savedAlias = aliasRes.rows[0].onbase_name.trim();
                        }
                    } catch (dbErr) { }
                }

                if (savedAlias) {
                    typingText = savedAlias;
                    searchKey = savedAlias;
                    logs.push(`[PASO 4] 💡 Tipología según AES identificada: "${typingText}" (TRD original: "${(docInfo?.typology_name || valueToType).substring(0,45)}")`);
                } else {
                    // Para buscar en el combobox de OnBase, usar la primera palabra o prefijo exacto
                    const cleanWords = valueToType
                        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                        .toUpperCase()
                        .trim()
                        .split(/\s+/);
                    
                    if (cleanWords.length > 0) {
                        // Tipear la primera palabra (ej. "PUBLICACION", "ESTUDIO", "MINUTA", "CDP", "RP", "RUT")
                        typingText = cleanWords[0].length <= 3 && cleanWords.length > 1 
                            ? `${cleanWords[0]} ${cleanWords[1]}` 
                            : cleanWords[0];
                        logs.push(`[PASO 4] 🔍 Prefijo de búsqueda para dropdown OnBase: "${typingText}" (TRD completa: "${valueToType.substring(0,40)}...")`);
                    }
                }
            }

            logs.push(`[PASO 4] Escribiendo en ${fieldName}: "${typingText.substring(0,40)}"`);
            for (const char of typingText) {
                await formPage.keyboard.type(char, { delay: 0 });
                await wait(20); // ms por letra para simular mecanografía rápida
            }

            const valEscrito = await formFrame.evaluate(el => el.value, comboInput).catch(() => '?');
            logs.push(`[PASO 4] Valor en campo tras escritura: "${valEscrito}"`);

            if (isDropdown) {
                logs.push(`[PASO 4] Esperando dropdown de OnBase para ${fieldName}...`);
                const DROPDOWN_SELS = [
                    'ul.CodeEntry_DropdownList_ItemRowList li',
                    '.CodeEntry_DropdownList li',
                    'table.AutoCompleteList td',
                    '.ac_results li',
                    '.ui-autocomplete li.ui-menu-item',
                    '[role="listbox"] [role="option"]',
                    '[role="option"]',
                    'div[class*="dropdown" i] div[class*="item" i]',
                    'li[class*="suggestion" i]',
                    'div[class*="CodeEntry" i] li',
                ];

                let dropdownHandled = false;
                for (let t = 0; t < 12 && !dropdownHandled; t++) {
                    await wait(350);
                    // Si tras ~1.05s no se ha abierto aún el popup ui-autocomplete de hsiCombobox, pulsar su botón desplegable
                    if (t === 3 || t === 7) {
                        await formFrame.evaluate(el => {
                            if (!el) return;
                            const anyOpen = Array.from(document.querySelectorAll('.ui-autocomplete li.ui-menu-item'))
                                .some(li => li.getBoundingClientRect().height > 0);
                            if (!anyOpen) {
                                const btn = el.parentElement?.querySelector('button.comboboxbutton');
                                if (btn) btn.click();
                            }
                        }, comboInput).catch(() => {});
                        await wait(450);
                    }

                    const framesToCheck = [];
                    if (formFrame) framesToCheck.push(formFrame);
                    const allPages = await formPage.browser().pages();
                    for (const pg of allPages) {
                        for (const fr of pg.frames()) {
                            if (fr !== formFrame) framesToCheck.push(fr);
                        }
                    }

                    for (const frame of framesToCheck) {
                        try {
                            const result = await frame.evaluate((sels, originalText, typedVal, targetAlias) => {
                                const cleanText = (t) => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
                                const targetClean = cleanText(originalText);
                                const aliasClean = cleanText(targetAlias || '');
                                const typedClean = cleanText(typedVal);
                                const stopW = new Set(['DE','DEL','LA','EL','LOS','LAS','EN','Y','O','A','AL','PARA','POR','CON','SIN','SOBRE']);
                                const targetTokens = targetClean.split(' ').filter(w => w.length > 1 && !stopW.has(w));
                                const acronym = targetClean.split(' ').filter(w => !stopW.has(w)).map(w => w[0]).join('');

                                for (const sel of sels) {
                                    const items = Array.from(document.querySelectorAll(sel)).filter(el => {
                                        const r = el.getBoundingClientRect();
                                        return r.width > 0 && r.height > 0;
                                    });

                                    if (items.length > 0) {
                                        let bestItem = null;
                                        let bestScore = -1;

                                        for (const item of items) {
                                            const itemText = cleanText(item.innerText || item.textContent);
                                            if (!itemText) continue;

                                            let score = 0;
                                            if (aliasClean && itemText === aliasClean) {
                                                score = 3000;
                                            } else if (itemText === targetClean || itemText === typedClean) {
                                                score = 2500;
                                            } else if (acronym.length >= 2 && (itemText === acronym || itemText.startsWith(acronym + ' '))) {
                                                score = 1500;
                                            } else if (aliasClean && (targetClean.includes(aliasClean) || aliasClean.includes(itemText))) {
                                                score = 1400;
                                            } else {
                                                const itemTokens = itemText.split(' ').filter(w => w.length > 1 && !stopW.has(w));
                                                let matchingTokens = 0;
                                                for (const it of itemTokens) {
                                                    if (targetTokens.includes(it)) matchingTokens++;
                                                }
                                                if (itemTokens.length > 0) {
                                                    const matchRatio = matchingTokens / itemTokens.length;
                                                    if (matchRatio >= 0.5) {
                                                        score = Math.max(score, 1000 + (matchingTokens * 50) + Math.round(matchRatio * 200));
                                                    } else if (matchingTokens >= 2) {
                                                        score = Math.max(score, 500 + (matchingTokens * 40));
                                                    }
                                                }
                                                if (targetClean.includes(itemText) && itemText.length > 5) {
                                                    score = Math.max(score, 800 + itemText.length);
                                                } else if (itemText.includes(targetClean) && targetClean.length > 5) {
                                                    score = Math.max(score, 700 + targetClean.length);
                                                } else if (itemText.includes(typedClean) || typedClean.includes(itemText)) {
                                                    score = Math.max(score, 400);
                                                }
                                            }

                                            if (score > bestScore) {
                                                bestScore = score;
                                                bestItem = item;
                                            }
                                        }

                                        if (bestItem && bestScore >= 400) {
                                            const text = (bestItem.innerText || bestItem.textContent || '').trim().substring(0, 100);
                                            const clickTarget = bestItem.querySelector('.ui-menu-item-wrapper, a, div') || bestItem;
                                            bestItem.scrollIntoView({ block: 'nearest' });
                                            clickTarget.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
                                            clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                                            clickTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                                            clickTarget.click();
                                            return { text, score: bestScore };
                                        }
                                    }
                                }
                                return null;
                            }, DROPDOWN_SELS, valueToType, typingText, savedAlias);

                            if (result) {
                                logs.push(`[PASO 4] ✅ Dropdown detectado para ${fieldName} → "${result.text}" (Score: ${result.score}, Clic directo)`);
                                await wait(600);

                                if (fieldName.toLowerCase().includes('tipo documental') && result.text) {
                                    try {
                                        const recognized = result.text.trim().toUpperCase();
                                        await pool.query(
                                            'UPDATE trd_typologies SET onbase_name = $1 WHERE (typology_name ILIKE $2 OR id = $3) AND (onbase_name IS NULL OR onbase_name = \'\')',
                                            [recognized, `%${valueToType.trim()}%`, docInfo?.typology_id || 0]
                                        );
                                        logs.push(`[PASO 4] 💾 Equivalencia guardada en BD: "${valueToType.substring(0,35)}..." ➔ "${recognized}"`);
                                    } catch (dbSaveErr) { }
                                }

                                dropdownHandled = true;
                                break;
                            }
                        } catch { }
                    }
                    if (dropdownHandled) break;
                }

                if (!dropdownHandled) {
                    logs.push(`[PASO 4][WARN] Dropdown no detectado o sin coincidencia por clic para ${fieldName} ("${valueToType.substring(0,35)}..."). Forzando confirmación de selección con teclado...`);
                    await formPage.keyboard.press('ArrowDown');
                    await wait(150);
                    await formPage.keyboard.press('Enter');
                    await wait(200);
                    await formPage.keyboard.press('Tab');
                }

                // Verificación adicional en OnBase para Tipo Documental (asegurar sincronización con campo interno #tipodocumental25_input)
                if (fieldName.toLowerCase().includes('tipo documental')) {
                    const checkTipo = await formFrame.evaluate(() => ({
                        visible: document.getElementById('sgdeatipodocumental25_input')?.value || '',
                        backingExists: !!document.getElementById('tipodocumental25_input'),
                        backing: document.getElementById('tipodocumental25_input')?.value || ''
                    })).catch(() => null);
                    if (checkTipo) {
                        logs.push(`[PASO 4] 🔍 Estado Tipo Documental OnBase: visible="${checkTipo.visible}" | interno="${checkTipo.backing}"`);
                        if (savedAlias && checkTipo.backingExists && !checkTipo.backing) {
                            logs.push(`[PASO 4] 🔄 Re-confirmando selección exacta en lista OnBase para "${savedAlias}"...`);
                            await formFrame.evaluate(() => {
                                const btn = document.querySelector('#sgdeatipodocumental25 button.comboboxbutton');
                                if (btn) btn.click();
                            }).catch(() => {});
                            for (let rt = 0; rt < 10; rt++) {
                                await wait(350);
                                const picked = await formFrame.evaluate((targetAlias) => {
                                    const clean = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
                                    const want = clean(targetAlias);
                                    const items = Array.from(document.querySelectorAll('.ui-autocomplete li.ui-menu-item, ul.ui-menu li'))
                                        .filter(el => el.getBoundingClientRect().height > 0);
                                    const exact = items.find(el => clean(el.innerText || el.textContent) === want);
                                    if (exact) {
                                        const inner = exact.querySelector('.ui-menu-item-wrapper, a, div') || exact;
                                        exact.scrollIntoView({ block: 'nearest' });
                                        inner.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
                                        inner.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                                        inner.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                                        inner.click();
                                        return (exact.innerText || exact.textContent || '').trim();
                                    }
                                    return null;
                                }, savedAlias).catch(() => null);
                                if (picked) {
                                    await wait(500);
                                    logs.push(`[PASO 4] ✅ Tipo Documental confirmado desde catálogo OnBase: "${picked}"`);
                                    break;
                                }
                            }
                        }
                    }
                }
            } else {
                await formPage.keyboard.press('Tab');
            }
            
            logs.push(`[PASO 4] ✅ ${fieldName} completado`);
            await wait(400);
            return true;

        } catch(e) {
            logs.push(`[PASO 4][ERROR] Al escribir en ${fieldName}: ${e.message}`);
            return false;
        }
    };

    // ── ORDEN ESTRICTO DEL FORMULARIO ──

    // 1. Grupo Documental (id*="grupodocumental")
    await typeFieldNativeById('input[id*="grupodocumental" i]', 'TRD', 'Grupo Documental', true);
    await wait(500); // Dar margen a la cascada Grupo Documental -> Tipo Documental en OnBase

    // 2. Tipo Documental (id*="tipodocumental")
    if (tipologia) {
        await typeFieldNativeById('input[id*="tipodocumental" i], input[id*="tipodoc" i]', tipologia, 'Tipo Documental', true);
    }

    // 3. Nombre Documento (id*="nombredocumento")
    if (nombreDoc) {
        await typeFieldNativeById('input[id*="nombredocumento" i], input[name*="nombredocumento" i]', nombreDoc, 'Nombre Documento', false);
    }

    // 4. Origen (id*="origen")
    await typeFieldNativeById('input[id*="origen" i]', 'ELECTRONICO', 'Origen', true);

    // ─── CAMPO 5: Fecha Creacion Documento ───
    if (docDate) {
        logs.push(`[PASO 4] Llenando "Fecha Creacion Documento" con "${docDate}"...`);
        try {
            // Find the robust CSS selector by looking at surrounding text
            const dateSelector = await formFrame.evaluate(() => {
                const dateKeywords = ['fecha creacion', 'fecha creación', 'fecha de creacion', 'fecha de creación'];
                const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([disabled]):not([readonly])'));
                
                let foundInp = null;
                // 1. Check if ID contains 'fechacreacion'
                foundInp = inputs.find(e => e.id && e.id.toLowerCase().includes('fechacreacion'));
                
                // 2. Check surrounding labels
                if (!foundInp) {
                    for (const cand of inputs) {
                        const trText = (cand.closest('tr')?.innerText || '').toLowerCase();
                        const tdText = (cand.closest('td')?.previousElementSibling?.innerText || '').toLowerCase();
                        const titleText = (cand.title || '').toLowerCase();
                        if (dateKeywords.some(kw => trText.includes(kw) || tdText.includes(kw) || titleText.includes(kw))) {
                            foundInp = cand;
                            break;
                        }
                    }
                }
                
                if (foundInp) {
                    // Try to generate a unique selector
                    if (foundInp.id) return `input#${foundInp.id}`;
                    if (foundInp.name) return `input[name="${foundInp.name}"]`;
                    return null;
                }
                return null;
            }).catch(() => null);

            logs.push(`[PASO 4] Selector dinámico encontrado para fecha: ${dateSelector || 'Nulo'}`);

            if (dateSelector) {
                logs.push(`[PASO 4] Diligenciando "Fecha Creacion Documento" con fecha base: "${docInfo.document_date}"`);
                const comboInput = await formFrame.$(dateSelector);
                if (comboInput) {
                    await formFrame.evaluate((el, dateStr) => {
                        const d = new Date(dateStr);
                        const yyyy = d.getFullYear();
                        const mm = d.getMonth() + 1;
                        const dd = d.getDate();
                        const dateObj = new Date(yyyy, mm - 1, dd, 0, 0, 0);
                        
                        let success = false;
                        if (typeof window.jQuery !== 'undefined') {
                            const $el = window.jQuery(el);
                            if (typeof $el.datetimepicker === 'function') {
                                try {
                                    $el.datetimepicker('setDate', dateObj);
                                    $el.trigger('change');
                                    success = true;
                                } catch (e) {}
                            }
                            if (!success && typeof $el.datepicker === 'function') {
                                try {
                                    $el.datepicker('setDate', dateObj);
                                    $el.trigger('change');
                                    success = true;
                                } catch (e) {}
                            }
                        }
                        
                        if (!success) {
                            el.focus();
                            el.value = `${mm}/${dd}/${yyyy} 12:00:00 AM`;
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            el.dispatchEvent(new Event('blur', { bubbles: true }));
                        }
                    }, comboInput, docInfo.document_date);
                    logs.push(`[PASO 4] ✅ Fecha Creacion Documento asignada exitosamente`);
                } else {
                    logs.push(`[PASO 4][ERROR] No se encontró el elemento input para la fecha`);
                }
                await wait(500);
            } else {
                logs.push(`[PASO 4][ERROR] No se pudo localizar el campo "Fecha Creacion Documento". Revisa el diseñador de OnBase.`);
            }

        } catch(e) {
            logs.push(`[PASO 4][ERROR] Error procesando campo fecha: ${e.message?.substring(0, 150)}`);
        }
    }

    // Solo si hay notas en la info del documento
    if (docInfo.notes || docInfo.observaciones) {
        const notasVal = docInfo.notes || docInfo.observaciones || '';
        logs.push(`[PASO 4] Llenando "Notas"...`);
        const notasEl = await formFrame.evaluateHandle(() => {
            return document.querySelector('textarea:not([readonly]):not([disabled])');
        }).catch(() => null);
        const notasHandle = notasEl?.asElement ? notasEl.asElement() : null;
        if (notasHandle) {
            await notasHandle.click({ clickCount: 3 });
            await notasHandle.type(notasVal, { delay: 40 });
            logs.push(`[PASO 4] ✅ Notas → "${notasVal.substring(0,40)}"`);
        }
        await wait(300);
    }



    logs.push('[PASO 4] ✅ Todos los campos del formulario diligenciados');
}


// ─────────────────────────────────────────────────────────────────
// PASO 5: ADJUNTAR PDF
// ─────────────────────────────────────────────────────────────────
async function paso5_adjuntarPDF(page, allFramesFn, docInfo, logs) {
    // VIDEO CONFIRMADO: el archivo viene de la ruta OneDrive (storage_path).
    // Prioridad: LOCAL_STORAGE_PATH → storage_path (OneDrive) → path (uploads/ del servidor)
    let filePath = null;
    let primaryPath = docInfo?.storage_path || docInfo?.path;

    // Si tenemos local storage path, intentar mapear el path de la BD a local
    if (primaryPath && process.env.LOCAL_STORAGE_PATH) {
        try {
            const dbStoragePath = await new Promise((resolve) => {
                db.get("SELECT value FROM system_settings WHERE key = 'storage_path'", [], (err, row) => {
                    resolve(row?.value || null);
                });
            });
            if (dbStoragePath) {
                const normDbPath = primaryPath.replace(/\\/g, '/');
                const normDbStorage = dbStoragePath.replace(/\\/g, '/');
                if (normDbPath.startsWith(normDbStorage)) {
                    const relative = normDbPath.substring(normDbStorage.length);
                    const resolved = path.join(process.env.LOCAL_STORAGE_PATH, relative);
                    if (fs.existsSync(resolved)) {
                        filePath = resolved;
                        logs.push(`[PASO 5] Mapeado de BD a local: ${filePath}`);
                    }
                }
            }
        } catch (e) {
            logs.push(`[PASO 5][WARN] Error al mapear path local: ${e.message}`);
        }
    }

    if (!filePath) {
        if (docInfo?.storage_path && fs.existsSync(docInfo.storage_path)) {
            filePath = docInfo.storage_path;
            logs.push(`[PASO 5] Usando ruta OneDrive: ${filePath}`);
        } else if (docInfo?.path && fs.existsSync(docInfo.path)) {
            filePath = docInfo.path;
            logs.push(`[PASO 5] Usando ruta servidor (fallback): ${filePath}`);
        } else {
            logs.push(`[PASO 5][ERROR] Archivo no encontrado.`);
            logs.push(`[PASO 5][ERROR]   storage_path: ${docInfo?.storage_path || 'N/A'}`);
            logs.push(`[PASO 5][ERROR]   path: ${docInfo?.path || 'N/A'}`);
            return false;
        }
    }
    logs.push(`[PASO 5] Adjuntando: ${filePath}`);
    // Sobrescribir docInfo.path con la ruta efectiva para el fileChooser
    docInfo = { ...docInfo, path: filePath };

    try {
        // 1. Desplegar sección "Documento Electrónico" si es un acordeón colapsado
        logs.push('[PASO 5] Desplegando pestaña "Documento Electrónico"...');
        for (const frame of allFramesFn()) {
            try {
                await frame.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('button, a, div, span, [role="tab"], [role="button"], td, th, h3, h4'));
                    const docElec = elements.find(el => {
                        const t = (el.innerText || el.textContent || el.title || '').trim().toLowerCase();
                        return t.includes('documento electronico') || t.includes('documento electrónico');
                    });
                    if (docElec) {
                        docElec.scrollIntoView({ block: 'center' });
                        docElec.click();
                        docElec.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    }
                });
            } catch (e) {}
        }
        await wait(800);

        // 1.1 Limpiar cualquier archivo adjunto previo si existiera en la sección de Documento Electrónico
        for (const frame of allFramesFn()) {
            try {
                await frame.evaluate(() => {
                    const delBtns = Array.from(document.querySelectorAll('button, a, input[type="button"], span, [role="button"]'));
                    const delBtn = delBtns.find(b => {
                        const t = (b.innerText || b.value || b.title || b.textContent || '').trim().toLowerCase();
                        return (t === 'eliminar' || t === 'quitar' || t === 'borrar' || t === 'remove' || t === 'delete') && !t.includes('expediente');
                    });
                    if (delBtn) {
                        delBtn.click();
                    }
                });
            } catch (e) {}
        }
        await wait(400);

        // 2. Verificar si existe directamente un input[type="file"] en el formulario
        for (const frame of allFramesFn()) {
            try {
                const fileInp = await frame.$('input[type="file"]');
                if (fileInp) {
                    await fileInp.uploadFile(filePath);
                    logs.push(`[PASO 5] ✅ Archivo adjuntado directamente por input[type="file"]: ${path.basename(filePath)}`);
                    await wait(2000);
                    return true;
                }
            } catch (e) {}
        }

        // 3. Preparar detector de FileChooser ANTES del clic en "Importar"
        const fileChooserPromise = page.waitForFileChooser({ timeout: 12000 });

        // Buscar y clic en botón "Importar"
        let importClicked = false;
        for (const frame of allFramesFn()) {
            try {
                const clicked = await frame.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll(
                        'button, a, input[type="button"], input[type="submit"], [role="button"]'
                    ));
                    const btn = btns.find(b => {
                        const t = (b.innerText || b.value || b.title || b.name || b.id || b.textContent || '').trim().toLowerCase();
                        return (t === 'importar' || t.includes('importar') || t.includes('examinar')) && !t.includes('expediente');
                    });
                    if (btn) {
                        btn.scrollIntoView({ block: 'center' });
                        btn.focus();
                        btn.click();
                        btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                        return true;
                    }
                    return false;
                });
                if (clicked) { importClicked = true; break; }
            } catch { }
        }

        if (!importClicked) {
            logs.push('[PASO 5][WARN] Botón "Importar" no encontrado tras desplegar Documento Electrónico');
            fileChooserPromise.catch(() => { });
            return false;
        }

        logs.push('[PASO 5] Clic en "Importar". Esperando diálogo de archivo...');
        const chooser = await fileChooserPromise;
        await chooser.accept([filePath]);
        logs.push(`[PASO 5] ✅ Archivo seleccionado: ${path.basename(filePath)}`);
        await wait(2000); // Esperar que OnBase procese el archivo y lo refleje como (1)
        return true;
    } catch (e) {
        logs.push(`[PASO 5][ERROR] ${e.message}`);
        return false;
    }
}

// ─────────────────────────────────────────────────────────────────
// PASO 6: GUARDAR
async function paso6_guardar(page, allFramesFn, logs, hasMoreDocs = false) {
    logs.push('[PASO 6] Buscando botón "Guardar"...');
    try {
        const frames = allFramesFn();
        logs.push(`[PASO 6] Total frames disponibles para buscar: ${frames.length}`);
        for (let i=0; i<frames.length; i++) {
            const btnTexts = await frames[i].evaluate(() => {
                return Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'))
                    .map(b => {
                        const t = (b.innerText || b.value || b.title || b.name || b.id || '').trim();
                        return t ? `[${b.tagName}] ${t}` : null;
                    })
                    .filter(t => t !== null);
            });
            if (btnTexts.length > 0) {
                logs.push(`[PASO 6] Frame ${i} botones (${btnTexts.length}): ${btnTexts.join(' | ')}`);
            }
        }
    } catch(e) { logs.push(`[PASO 6][ERR_DIAG] ${e.message}`); }
    
    let saved = false;

    for (const frame of allFramesFn()) {
        try {
            saved = await frame.evaluate(() => {
                const btns = Array.from(document.querySelectorAll(
                    'button, a, input[type="button"], input[type="submit"], [role="button"]'
                ));
                const btn = btns.find(b => {
                    const t = (b.innerText || b.value || b.title || b.name || b.id || b.textContent || '').trim().toLowerCase();
                    const rect = b.getBoundingClientRect();
                    return (t === 'guardar' || t === 'save') && rect.width > 0;
                });
                if (btn) { btn.scrollIntoView({ block: 'center' }); btn.focus(); btn.click(); return true; }
                return false;
            });
            if (saved) { logs.push('[PASO 6] ✅ Botón "Guardar" presionado'); break; }
        } catch { }
    }

    if (!saved) {
        logs.push('[PASO 6][WARN] Botón "Guardar" no encontrado. Botones visibles:');
        for (const frame of allFramesFn()) {
            const btns = await safeEval(frame, () =>
                Array.from(document.querySelectorAll('button, input[type="button"]'))
                    .filter(b => b.offsetParent !== null)
                    .map(b => `"${(b.innerText || b.value || '').trim()}"`)
                    .slice(0, 15).join(', ')
            );
            if (btns) { logs.push(`[PASO 6]   ${btns}`); break; }
        }
        return false;
    }

    // Esperar y manejar diálogo post-guardado
    logs.push(`[PASO 6] Esperando diálogo post-guardado (siguiente doc en lote: ${hasMoreDocs ? 'SÍ' : 'NO'})...`);
    let dialogHandled = false;
    for (let t = 0; t < 25 && !dialogHandled; t++) {
        await wait(500);
        for (const frame of allFramesFn()) {
            try {
                dialogHandled = await frame.evaluate((wantAnother) => {
                    const candidates = Array.from(document.querySelectorAll('button, a, input, div, span, td, [role="button"]'));
                    if (wantAnother) {
                        const yesBtn = candidates.find(b => {
                            const txt = (b.innerText || b.value || b.textContent || '').trim().toLowerCase();
                            const isMatch = (txt === 'sí' || txt === 'si' || txt === 'yes');
                            const isVisible = b.offsetParent !== null && b.getBoundingClientRect().width > 0;
                            return isMatch && isVisible;
                        });
                        if (yesBtn) {
                            yesBtn.scrollIntoView({ block: 'center' });
                            yesBtn.click();
                            return true;
                        }
                    } else {
                        const noBtn = candidates.find(b => {
                            const txt = (b.innerText || b.value || b.textContent || '').trim().toLowerCase();
                            const isMatch = (txt === 'no' || txt === 'cancel' || txt === 'cancelar');
                            const isVisible = b.offsetParent !== null && b.getBoundingClientRect().width > 0;
                            return isMatch && isVisible;
                        });
                        if (noBtn) {
                            noBtn.scrollIntoView({ block: 'center' });
                            noBtn.click();
                            return true;
                        }
                    }
                    return false;
                }, hasMoreDocs);
                if (dialogHandled) {
                    logs.push(`[PASO 6] ✅ Diálogo post-guardado procesado (${hasMoreDocs ? 'Sí' : 'No'}) en t=${(t * 0.5).toFixed(1)}s`);
                    break;
                }
            } catch (e) { }
        }
    }

    if (!dialogHandled) {
        logs.push('[PASO 6][WARN] Diálogo post-guardado no detectado. Continuando...');
    }

    await wait(3000);
    logs.push('[PASO 6] ✅ Proceso de guardado finalizado');
    return true;
}

// ─────────────────────────────────────────────────────────────────
// PASO 7: CERRAR SESIÓN ONBASE
// ─────────────────────────────────────────────────────────────────
async function paso7_logout(page, allFramesFn, logs) {
    logs.push('[PASO 7] Iniciando cierre de sesión en OnBase...');
    let logoutClicked = false;
    
    for (let attempt = 0; attempt < 8 && !logoutClicked; attempt++) {
        await wait(1000);
        
        // 1. Verificar si el botón "Logout" o "Cerrar sesión" ya es visible
        for (const frame of allFramesFn()) {
            try {
                logoutClicked = await frame.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('a, button, span, div, li, td, [role="button"], [role="menuitem"]'));
                    const logoutWords = ['cerrar sesión', 'cerrar sesion', 'log out', 'logout', 'salir', 'exit'];
                    const logoutBtn = elements.find(el => {
                        const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                        const isMatch = logoutWords.some(word => t === word || t.includes(word));
                        const isVisible = el.offsetParent !== null && el.getBoundingClientRect().width > 0;
                        return isMatch && isVisible;
                    });
                    
                    if (logoutBtn) {
                        logoutBtn.scrollIntoView({ block: 'center' });
                        // Simular secuencia completa de mouse click
                        logoutBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        logoutBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                        logoutBtn.click();
                        return true;
                    }
                    return false;
                });
                
                if (logoutClicked) {
                    logs.push(`[PASO 7] ✅ Botón de cierre de sesión presionado`);
                    break;
                }
            } catch (e) {}
        }
        
        if (logoutClicked) break;
        
        // 2. Si no es visible, intentar hacer clic en el menú del usuario para abrirlo
        logs.push(`[PASO 7] Menú de logout no visible, intentando abrir menú de usuario (intento ${attempt + 1})...`);
        for (const frame of allFramesFn()) {
            try {
                await frame.evaluate(() => {
                    const userElements = Array.from(document.querySelectorAll('a, div, span, button, [class*="user" i]'));
                    const userMenu = userElements.find(el => {
                        const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                        // Buscar el menú del usuario
                        const isUserMenu = t.includes('jorge') || t.includes('cimi') || t.includes('regional') || el.id?.toLowerCase().includes('user') || el.className?.toLowerCase().includes('user') || el.className?.toLowerCase().includes('profile');
                        return isUserMenu && el.offsetParent !== null && el.getBoundingClientRect().width > 0;
                    });
                    if (userMenu) {
                        userMenu.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        userMenu.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                        userMenu.click();
                    }
                });
            } catch (e) {}
        }
    }
    
    if (!logoutClicked) {
        logs.push('[PASO 7] No se pudo hacer clic en el botón de logout. Forzando navegación a la URL de salida...');
        try {
            const currentUrl = page.url();
            const baseUrl = currentUrl.split('/AppNet/')[0];
            if (baseUrl) {
                const logoutUrl = `${baseUrl}/AppNet/Login.aspx?logout=true`;
                logs.push(`[PASO 7] Navegando a: ${logoutUrl}`);
                await page.goto(logoutUrl, { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => {});
                logoutClicked = true;
            }
        } catch (e) {
            logs.push(`[PASO 7][WARN] Error al forzar navegación de logout: ${e.message}`);
        }
    }

    // Limpiar cookies tras logout para que no quede ReturnUrl=EmbeddedPage/Close.aspx en el perfil
    try {
        const cdp = await page.target().createCDPSession();
        await cdp.send('Network.clearBrowserCookies').catch(() => {});
        await cdp.send('Network.clearBrowserCache').catch(() => {});
        await cdp.detach().catch(() => {});
    } catch {}
    
    await wait(2000);
    logs.push('[PASO 7] ✅ Cierre de sesión finalizado');
}

// ─────────────────────────────────────────────────────────────────
// EXPORTACIÓN PRINCIPAL — ARQUITECTURA 3 BOTS CARGADORES + BOT 4 VERIFICADOR INDEPENDIENTE + WATCHDOG ANTI-BLOQUEO
// ─────────────────────────────────────────────────────────────────
const os = require('os');
const https = require('https');
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch {}

const BOT_KEYS = ['9224', '9224.4', '9224.2', 'VERIFICADOR'];

// Directorio seguro para perfiles y caché temporal de Chromium/Puppeteer:
// En el servidor Linux usa /mnt/almacen/.puppeteer_tmp (173 GB libres) en vez de /tmp en / (8.4 GB total)
function resolvePuppeteerBaseTmpDir() {
    if (process.platform === 'linux') {
        try {
            if (fs.existsSync('/mnt/almacen')) {
                const dir = '/mnt/almacen/.puppeteer_tmp';
                fs.mkdirSync(dir, { recursive: true });
                return dir;
            }
        } catch {}
    }
    return os.tmpdir();
}

function buildPuppeteerLaunchOptions(profileDir = null) {
    const baseTmp = resolvePuppeteerBaseTmpDir();
    const opts = {
        headless: process.platform === 'linux' ? true : false,
        env: {
            ...process.env,
            TMPDIR: baseTmp,
            TMP: baseTmp,
            TEMP: baseTmp
        },
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--disable-background-networking',
            '--disk-cache-size=33554432',
            '--media-cache-size=8388608',
            '--js-flags=--max-old-space-size=384',
            '--window-size=1366,900'
        ]
    };
    if (profileDir) {
        opts.userDataDir = profileDir;
    }
    return opts;
}

// Cierre forzoso garantizado (evita procesos Chromium huérfanos / fugas de RAM y /tmp cuando browser.close() se cuelga)
async function safeForceCloseBrowser(browserInstance, profileDir = null) {
    if (!browserInstance) return;
    let pid = null;
    try {
        const proc = typeof browserInstance.process === 'function' ? browserInstance.process() : null;
        if (proc && proc.pid) pid = proc.pid;
    } catch {}

    try {
        await Promise.race([
            browserInstance.close().catch(() => {}),
            wait(4000)
        ]);
    } catch {}

    if (pid) {
        try { process.kill(pid, 'SIGKILL'); } catch {}
    }
    if (process.platform === 'linux' && profileDir && profileDir.includes('puppeteer_aes_bot_')) {
        await new Promise(resolve => {
            exec(`pkill -9 -f "${profileDir}" 2>/dev/null || true`, () => resolve());
        });
    }
    if (profileDir && profileDir.includes('puppeteer_aes_bot_')) {
        try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
    }
}

// Inicializar columnas de verificación OnBase en PostgreSQL de forma segura
(async () => {
    try {
        await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS onbase_verified INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS onbase_verify_stage VARCHAR(50) DEFAULT NULL`);
        await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS onbase_verified_at TIMESTAMP DEFAULT NULL`);
        await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS onbase_found_count INTEGER DEFAULT NULL`);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS onbase_verification_logs (
                id SERIAL PRIMARY KEY,
                expediente_id INTEGER,
                expediente_code VARCHAR(120),
                stage VARCHAR(40),
                expected_count INTEGER DEFAULT 0,
                found_count INTEGER DEFAULT 0,
                status VARCHAR(40),
                details TEXT,
                verified_by_user VARCHAR(80),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    } catch (e) {
        console.warn('[VERIFICADOR-DB] Aviso preparando columnas de verificación:', e.message);
    }
})();

function createBotSession(botKey, label, shortName, defaultUser) {
    return {
        botKey,
        label,
        shortName,
        onbaseUser: defaultUser,
        running: false,
        standby: botKey === 'VERIFICADOR',
        waitingForVerifier: false,
        jobId: null,
        currentStep: botKey === 'VERIFICADOR' ? '⏸️ En espera (Listo para verificar 50% / 100% o ciclo 5m)' : '',
        logs: botKey === 'VERIFICADOR' ? ['[VERIFICADOR] 🤖 Bot Verificador Independiente en espera (Standby). Se activará al 50% y 100% de cada expediente y cada 5 minutos.'] : [],
        error: null,
        completed: false,
        screenshot: null,
        liveFrame: null,
        liveBuffer: null,
        startTime: null,
        lastStepChangeAt: Date.now(),
        stepStuckSeconds: 0,
        unlockCount: 0,
        documentIds: [],
        totalDocs: 0,
        processedDocs: 0,
        currentDocId: null,
        currentDocName: '',
        currentExpedienteCode: '',
        browser: null,
        page: null
    };
}

const botSessions = {
    '9224': createBotSession('9224', 'Bot 1 · Subdirección de Centro (9224)', 'Subdirección (9224)', 'TVILLAMIZARJ'),
    '9224.4': createBotSession('9224.4', 'Bot 2 · Formación Profesional (9224.4)', 'Formación (9224.4)', 'EDHERNANDEZM'),
    '9224.2': createBotSession('9224.2', 'Bot 3 · Administración Educativa (9224.2)', 'Adm. Educativa (9224.2)', 'luepitar'),
    'VERIFICADOR': createBotSession('VERIFICADOR', 'Bot 4 · Verificador OnBase (SGDEA Expediente)', 'Verificador OnBase', 'AUDITOR-SGDEA')
};

// Candado en memoria para evitar que dos bots procesen el mismo document.id simultáneamente
const activeDocLocks = new Set();

// Historial en memoria de alertas y verificaciones para el sistema / móvil / PC
const systemAlerts = [];
const verificationHistory = [];

// Configuración de Alertas a Móvil y Equipo (Verificación automática deshabilitada: se realiza manualmente en la pestaña Verificador)
let alertSettings = {
    autoVerifyEvery5Min: false,
    verifyIntervalMinutes: 5,
    nextAutoVerifyAt: null,
    desktopNotifications: true,
    soundAlerts: true,
    ntfyEnabled: true,
    ntfyTopic: 'sena-cimi-onbase-alertas',
    telegramEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
    emailEnabled: false,
    alertEmail: ''
};

// Cargar configuración persistida desde system_settings si existe y limpiar falsos negativos previos
(async () => {
    try {
        // Limpiar banderas de falso negativo (-1) dejadas por el verificador automático anterior
        await pool.query(`UPDATE documents SET onbase_verified = 0, onbase_verify_stage = NULL WHERE onbase_verified = -1`).catch(() => {});
        const res = await pool.query(`SELECT value FROM system_settings WHERE key = 'onbase_alert_settings' LIMIT 1`);
        if (res.rows && res.rows[0]?.value) {
            const parsed = JSON.parse(res.rows[0].value);
            alertSettings = { ...alertSettings, ...parsed, autoVerifyEvery5Min: false };
        }
    } catch {}
})();

function pushSystemAlert({ type = 'info', title, message, expedienteCode = '', botKey = '', sendMobile = false, screenshotB64 = null }) {
    const alertObj = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        type, // 'success' | 'warning' | 'error' | 'info'
        title,
        message,
        expedienteCode,
        botKey
    };
    systemAlerts.unshift(alertObj);
    if (systemAlerts.length > 80) systemAlerts.length = 80;

    if (sendMobile) {
        sendExternalMobileAndEmailAlert(alertObj, screenshotB64).catch(e => {
            console.warn('[ALERT-EXT] Error enviando alerta externa:', e.message);
        });
    }
    return alertObj;
}

async function sendExternalMobileAndEmailAlert(alertObj, screenshotB64 = null) {
    const textMsg = `${alertObj.title}
${alertObj.message}${alertObj.expedienteCode ? `
Expediente: ${alertObj.expedienteCode}` : ''}
Hora: ${new Date().toLocaleTimeString('es-CO')}`;

    // 1. Ntfy.sh Push al Celular (sin registro, canal directo)
    if (alertSettings.ntfyEnabled && alertSettings.ntfyTopic) {
        try {
            const topic = String(alertSettings.ntfyTopic).trim().replace(/[^a-zA-Z0-9_-]/g, '');
            if (topic) {
                await new Promise((resolve) => {
                    const req = https.request({
                        hostname: 'ntfy.sh',
                        path: `/${topic}`,
                        method: 'POST',
                        headers: {
                            'Title': alertObj.title.replace(/[^ -~]/g, ''),
                            'Priority': alertObj.type === 'error' ? '5' : (alertObj.type === 'warning' ? '4' : '3'),
                            'Tags': alertObj.type === 'error' ? 'rotating_light,warning' : (alertObj.type === 'success' ? 'white_check_mark' : 'robot')
                        },
                        timeout: 6000
                    }, () => resolve());
                    req.on('error', () => resolve());
                    req.write(textMsg);
                    req.end();
                });
            }
        } catch {}
    }

    // 2. Telegram Bot Push al Celular
    if (alertSettings.telegramEnabled && alertSettings.telegramBotToken && alertSettings.telegramChatId) {
        try {
            const payload = JSON.stringify({
                chat_id: alertSettings.telegramChatId,
                text: `🤖 *SENA CIMI - OnBase Bot*
*${alertObj.title}*
${alertObj.message}`
            });
            await new Promise((resolve) => {
                const req = https.request({
                    hostname: 'api.telegram.org',
                    path: `/bot${alertSettings.telegramBotToken}/sendMessage`,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(payload)
                    },
                    timeout: 6000
                }, () => resolve());
                req.on('error', () => resolve());
                req.write(payload);
                req.end();
            });
        } catch {}
    }

    // 3. Correo Electrónico de Alerta con Captura
    if (alertSettings.emailEnabled && alertSettings.alertEmail) {
        try {
            const sRes = await pool.query(`SELECT key, value FROM system_settings WHERE key LIKE 'smtp_%'`);
            const smtpMap = {};
            (sRes.rows || []).forEach(r => { smtpMap[r.key] = r.value; });
            if (nodemailer && smtpMap.smtp_user && smtpMap.smtp_pass) {
                const transporter = nodemailer.createTransport({
                    host: smtpMap.smtp_host || 'smtp.office365.com',
                    port: parseInt(smtpMap.smtp_port || '587', 10),
                    secure: false,
                    auth: { user: smtpMap.smtp_user, pass: smtpMap.smtp_pass }
                });
                const attachments = [];
                if (screenshotB64) {
                    const cleanB64 = screenshotB64.replace(/^data:image\/\w+;base64,/, '');
                    attachments.push({
                        filename: `evidencia_onbase_${Date.now()}.png`,
                        content: Buffer.from(cleanB64, 'base64')
                    });
                }
                await transporter.sendMail({
                    from: smtpMap.smtp_user,
                    to: alertSettings.alertEmail,
                    subject: `[ALERTA ONBASE SENA] ${alertObj.title}`,
                    text: textMsg,
                    attachments
                }).catch(() => {});
            }
        } catch {}
    }
}

function resolveBotKey(input) {
    if (!input) return '9224';
    const s = String(input).trim().toLowerCase();
    if (s === 'verificador' || s.includes('verificador') || s.includes('auditor')) return 'VERIFICADOR';
    if (s === '9224.4' || s.includes('9224.4') || s.includes('edhernandez') || s.includes('formacion')) return '9224.4';
    if (s === '9224.2' || s.includes('9224.2') || s.includes('luepitar') || s.includes('administracion')) return '9224.2';
    if (s === '9224' || s.includes('9224') || s.includes('tvillamizar') || s.includes('jrrozo') || s.includes('subdireccion')) return '9224';
    return botSessions[input] ? input : '9224';
}

function getActiveOrRequestedBot(botParam) {
    if (botParam && botParam !== 'auto' && botParam !== 'all') {
        const key = resolveBotKey(botParam);
        if (botSessions[key]) return botSessions[key];
    }
    for (const k of ['VERIFICADOR', '9224.4', '9224.2', '9224']) {
        if (botSessions[k].running) return botSessions[k];
    }
    let latest = botSessions['9224.4'];
    let latestTime = 0;
    for (const k of BOT_KEYS) {
        const t = botSessions[k].startTime ? new Date(botSessions[k].startTime).getTime() : 0;
        if (t > latestTime) {
            latestTime = t;
            latest = botSessions[k];
        }
    }
    return latest;
}

let currentJob = botSessions['9224.4'];

function setBotStep(session, newStep) {
    if (!session) return;
    if (session.currentStep !== newStep) {
        session.currentStep = newStep;
        session.lastStepChangeAt = Date.now();
        session.stepStuckSeconds = 0;
    }
}

function buildBotsStatusMap() {
    const out = {};
    const now = Date.now();
    for (const k of BOT_KEYS) {
        const s = botSessions[k];
        const stuckSecs = (s.running && !s.waitingForVerifier && s.lastStepChangeAt)
            ? Math.max(0, Math.round((now - s.lastStepChangeAt) / 1000))
            : 0;
        s.stepStuckSeconds = stuckSecs;
        out[k] = {
            botKey: s.botKey,
            label: s.label,
            shortName: s.shortName,
            onbaseUser: s.onbaseUser,
            running: s.running,
            standby: !!s.standby,
            waitingForVerifier: !!s.waitingForVerifier,
            jobId: s.jobId,
            currentStep: s.currentStep,
            logs: (s.logs || []).slice(-100),
            error: s.error,
            completed: s.completed,
            totalDocs: s.totalDocs,
            processedDocs: s.processedDocs,
            currentDocId: s.currentDocId,
            currentDocName: s.currentDocName,
            currentExpedienteCode: s.currentExpedienteCode,
            stepStuckSeconds: stuckSecs,
            unlockCount: s.unlockCount || 0,
            startTime: s.startTime,
            hasFrame: !!(s.liveBuffer || s.liveFrame || s.screenshot),
            liveVerification: s.liveVerification || null,
            recentVerifications: Array.isArray(s.recentVerifications) ? s.recentVerifications.slice(0, 15) : []
        };
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────
// MOTOR DE CONSULTA EN ONBASE: CONSULTAS PERSONALIZADAS -> SGDEA EXPEDIENTE (PASOS 1 AL 7 EN TIEMPO REAL)
// ─────────────────────────────────────────────────────────────────
async function ejecutarConsultaPersonalizadaSGDEAExpediente(page, browser, expedienteCode, expectedDocs, logs, mirrorToVerifier = true) {
    const vSession = botSessions['VERIFICADOR'];
    const addLog = (msg) => {
        logs.push(msg);
        if (mirrorToVerifier && vSession && logs !== vSession.logs) {
            vSession.logs.push(msg);
        }
    };

    const cleanExpCode = String(expedienteCode || '').trim();
    if (!cleanExpCode) {
        addLog('[VERIFICADOR][WARN] Código de expediente vacío, omitiendo consulta.');
        return { success: false, foundCount: 0, foundRows: [], verifiedDocs: [], missingDocs: [] };
    }

    // Inicializar estado de verificación en tiempo real documento por documento
    const liveDocs = (expectedDocs || []).map((d, idx) => {
        const catalogAlias = findCatalogOnBaseTypology(d.typology_name) || d.onbase_name || stripTypologyDecorators(d.typology_name || '');
        return {
            id: d.id,
            index: idx + 1,
            filename: d.filename || `Documento #${d.id}`,
            typology_name: d.typology_name || 'Sin Tipología',
            onbase_name: catalogAlias,
            dbStatus: d.status || 'Pendiente',
            verifyState: 'verificando', // 'verificando' | 'cargado' | 'no_cargado'
            matchedRow: 'Consultando carpeta en OnBase...',
            updatedAt: new Date().toISOString()
        };
    });

    if (vSession) {
        vSession.liveVerification = {
            expedienteId: expectedDocs?.[0]?.expediente_id || null,
            expedienteCode: cleanExpCode,
            status: 'VERIFICANDO',
            step: `Iniciando verificación de carpeta "${cleanExpCode}" en OnBase...`,
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            foundInOnBaseCount: 0,
            verifiedCount: 0,
            missingCount: 0,
            onbaseRows: [],
            documents: liveDocs
        };
    }

    const updateLiveStep = async (stepMsg) => {
        if (vSession) {
            setBotStep(vSession, stepMsg);
            if (vSession.liveVerification) {
                vSession.liveVerification.step = stepMsg;
                vSession.liveVerification.updatedAt = new Date().toISOString();
            }
        }
        try {
            const ssBuf = await page.screenshot({ type: 'jpeg', quality: 45 }).catch(() => null);
            if (ssBuf && vSession) {
                vSession.liveBuffer = ssBuf;
                vSession.liveFrame = 'data:image/jpeg;base64,' + ssBuf.toString('base64');
                automationEmitter.emit('frame', vSession.liveFrame);
            }
        } catch {}
    };

    addLog(`
🔎 [VERIFICADOR ONBASE] Iniciando verificación en tiempo real de Carpeta/Expediente "${cleanExpCode}" (${expectedDocs.length} documento(s) esperados)...`);

    await checkAndClearLocks(browser, logs).catch(() => {});

    // ── PASO 2 y 3: DAR EN EL CUADRO DE PUNTOS (⋮⋮⋮) Y SELECCIONAR "CONSULTAS PERSONALIZADAS" (CustomQuery.aspx) ──
    await updateLiveStep(`Paso 2-3: Abriendo Cuadro de Puntos (⋮⋮⋮) -> Consultas personalizadas (${cleanExpCode})`);
    addLog(`[VERIFICADOR][PASO 2-3] Abriendo menú Cuadro de Puntos (⋮⋮⋮) -> "Consultas personalizadas"...`);

    let customQueryFrame = page.frames().find(fr => fr.url().toLowerCase().includes('customquery.aspx'));

    for (let attempt = 0; attempt < 6 && !customQueryFrame; attempt++) {
        try {
            // Verificar en el frame principal (NavPanel.aspx)
            const navAction = await page.evaluate((att) => {
                const navBtn = document.querySelector('.js-navMenuButton, .navMenuButton, a.navMenu, #navMenu, [title*="Menú principal" i], [aria-label*="Menú principal" i]');
                const navMenu = document.querySelector('nav.js-navMenu, nav.navMenu');
                const cqItem = document.querySelector('li#customquery, [data-path*="CustomQuery.aspx" i], li[data-name*="Consultas personalizadas" i]');

                // Si a partir del intento 2 aún no cargó CustomQuery.aspx en el iframe, redirigir #NavPanelIFrame conservando OBToken
                if (att >= 2) {
                    const navIframe = document.querySelector('#NavPanelIFrame, iframe.main_iframe-sideOne');
                    if (navIframe && navIframe.src && !navIframe.src.toLowerCase().includes('customquery.aspx')) {
                        const tokenMatch = navIframe.src.match(/[?&]OBToken=([^&]+)/i);
                        const baseUrl = navIframe.src.split('/Onbase/')[0] + '/Onbase/CustomQuery.aspx';
                        navIframe.src = tokenMatch ? `${baseUrl}?OBToken=${tokenMatch[1]}` : baseUrl;
                        return 'FORCED_IFRAME_CUSTOMQUERY';
                    }
                }

                // Si el menú principal está cerrado (isClosed), abrirlo primero con clic en el botón de 9 puntos
                if (navMenu && navMenu.classList.contains('isClosed') && navBtn) {
                    navBtn.click();
                    return 'OPENED_WAFFLE_MENU';
                }

                if (cqItem) {
                    cqItem.click();
                    cqItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    cqItem.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                    cqItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    return 'CLICKED_CUSTOMQUERY_ITEM';
                }

                if (navBtn) {
                    navBtn.click();
                    return 'CLICKED_NAVBTN_FALLBACK';
                }
                return null;
            }, attempt).catch(() => null);

            if (navAction === 'OPENED_WAFFLE_MENU') {
                addLog(`[VERIFICADOR][PASO 2] ✅ Menú Cuadro de Puntos (⋮⋮⋮) desplegado.`);
                await wait(550);
                await page.evaluate(() => {
                    const cqItem = document.querySelector('li#customquery, [data-path*="CustomQuery.aspx" i], li[data-name*="Consultas personalizadas" i]');
                    if (cqItem) {
                        cqItem.click();
                        cqItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        cqItem.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                        cqItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    }
                }).catch(() => {});
                addLog(`[VERIFICADOR][PASO 3] ✅ Clic en "Consultas personalizadas" ejecutado.`);
            } else if (navAction === 'CLICKED_CUSTOMQUERY_ITEM' || navAction === 'FORCED_IFRAME_CUSTOMQUERY') {
                addLog(`[VERIFICADOR][PASO 3] ✅ Cargando panel "Consultas personalizadas" (${navAction})...`);
            }
        } catch {}

        // Esperar hasta 2 segundos a que aparezca el frame CustomQuery.aspx
        for (let w = 0; w < 5; w++) {
            await wait(400);
            customQueryFrame = page.frames().find(fr => fr.url().toLowerCase().includes('customquery.aspx'));
            if (customQueryFrame) break;
        }
    }

    if (customQueryFrame) {
        addLog(`[VERIFICADOR][PASO 2-3] ✅ Panel "Consultas personalizadas" activo (${customQueryFrame.url().split('?')[0]}).`);
    } else {
        addLog(`[VERIFICADOR][WARN] No se detectó URL CustomQuery.aspx explícita; buscando en todos los frames activos...`);
    }
    await updateLiveStep(`Paso 4-5: Seleccionando "SGDEA Expediente" (${cleanExpCode})`);

    // ── PASO 4 y 5: BUSCADOR DAR "sgdea" Y SELECCIONAR "SGDEA Expediente" ──
    addLog(`[VERIFICADOR][PASO 4-5] Filtrando "sgdea" en Tipos de consulta y seleccionando "SGDEA Expediente"...`);

    let sgdeaExpedienteSelected = false;
    const candidateFramesForQuery = () => {
        const cq = page.frames().find(fr => fr.url().toLowerCase().includes('customquery.aspx'));
        return cq ? [cq, ...page.frames().filter(f => f !== cq)] : page.frames();
    };

    for (let attempt = 0; attempt < 10 && !sgdeaExpedienteSelected; attempt++) {
        for (const fr of candidateFramesForQuery()) {
            try {
                const step45Res = await fr.evaluate(() => {
                    // Buscar en la lista de Tipos de consulta (li.CSListBlock_listOption o similar)
                    const allItems = Array.from(document.querySelectorAll('li.CSListBlock_listOption, li.js-listOption, li, a, div[role="option"], [role="listitem"]'));
                    const sgdeaExpItem = allItems.find(el => {
                        const rawTxt = (el.innerText || el.textContent || '').replace(/✓/g, '').trim().toLowerCase();
                        const r = el.getBoundingClientRect();
                        return (rawTxt === 'sgdea expediente' || rawTxt === 'sgdea - expediente') && r.height > 0 && r.height < 65;
                    });

                    // Si aún no aparece "SGDEA Expediente", escribir "sgdea" en el buscador de Tipos de consulta
                    if (!sgdeaExpItem) {
                        const filterInp = document.querySelector('input.js-filterInput, input[type="search"], .CSListBlock input[type="text"], input[type="text"]');
                        if (filterInp && !filterInp.readOnly && !filterInp.disabled) {
                            filterInp.focus();
                            filterInp.value = 'sgdea';
                            filterInp.dispatchEvent(new Event('input', { bubbles: true }));
                            filterInp.dispatchEvent(new Event('change', { bubbles: true }));
                            filterInp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
                            return { status: 'TYPED_SGDEA_FILTER' };
                        }
                        return null;
                    }

                    sgdeaExpItem.scrollIntoView({ block: 'nearest' });
                    const r = sgdeaExpItem.getBoundingClientRect();
                    const isAlreadyActive = sgdeaExpItem.classList.contains('selected') ||
                                            sgdeaExpItem.classList.contains('active') ||
                                            sgdeaExpItem.getAttribute('aria-selected') === 'true' ||
                                            (sgdeaExpItem.innerText || '').includes('✓');

                    sgdeaExpItem.click();
                    sgdeaExpItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                    sgdeaExpItem.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                    sgdeaExpItem.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

                    return {
                        status: 'SELECTED_SGDEA_EXPEDIENTE',
                        alreadyActive: isAlreadyActive,
                        text: (sgdeaExpItem.innerText || '').trim(),
                        x: r.left + r.width / 2,
                        y: r.top + r.height / 2
                    };
                });

                if (step45Res?.status === 'TYPED_SGDEA_FILTER') {
                    addLog(`[VERIFICADOR][PASO 4] ✅ Filtro "sgdea" aplicado en Tipos de consulta.`);
                    await wait(450);
                } else if (step45Res?.status === 'SELECTED_SGDEA_EXPEDIENTE') {
                    // También hacer clic físico con Puppeteer mouse usando el offset del iframe para activar eventos nativos de OnBase
                    if (!step45Res.alreadyActive && step45Res.x > 0 && step45Res.y > 0) {
                        try {
                            const fEl = await fr.frameElement();
                            const fBox = fEl ? await fEl.boundingBox() : { x: 0, y: 0 };
                            if (fBox) {
                                await page.mouse.click(fBox.x + step45Res.x, fBox.y + step45Res.y);
                            }
                        } catch {}
                    }
                    addLog(`[VERIFICADOR][PASO 5] ✅ Consulta seleccionada: "${step45Res.text}".`);
                    sgdeaExpedienteSelected = true;
                    await wait(900);
                    break;
                }
            } catch {}
        }
        if (!sgdeaExpedienteSelected) await wait(450);
    }

    // ── PASO 6: CAMPO "SGDEA - Expediente", COLOCAR EL NÚMERO DE EXPEDIENTE Y DAR "Buscar" ──
    await updateLiveStep(`Paso 6: Digitando "${cleanExpCode}" en SGDEA - Expediente y buscando...`);
    addLog(`[VERIFICADOR][PASO 6] Escribiendo "${cleanExpCode}" en campo "SGDEA - Expediente" y presionando "Buscar"...`);

    let targetFrame = null;
    let expKeywordInput = null;

    for (let attempt = 0; attempt < 12 && !expKeywordInput; attempt++) {
        for (const fr of candidateFramesForQuery()) {
            try {
                const handle = await fr.evaluateHandle(() => {
                    // 1. Buscar label/celda que diga "SGDEA - Expediente" (sin restricción de r.top que fallaba dentro de iframes)
                    const labels = Array.from(document.querySelectorAll('label, span, div, td, th'));
                    const expLabel = labels.find(el => {
                        const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                        return t === 'sgdea - expediente' || t === 'sgdea-expediente' || (t.startsWith('sgdea - expediente') && t.length < 30);
                    });

                    if (expLabel) {
                        let container = expLabel.parentElement;
                        for (let i = 0; i < 5 && container; i++) {
                            const inp = container.querySelector('input:not([type="hidden"]):not([disabled]):not([readonly])');
                            if (inp && inp.getBoundingClientRect().width > 30) return inp;
                            container = container.parentElement;
                        }
                    }

                    // 2. Fallback: tomar los inputs visibles del panel de Palabras clave (excluyendo el buscador superior de Tipos de consulta)
                    const allVisibleInputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])')).filter(inp => {
                        if (inp.readOnly || inp.disabled) return false;
                        const r = inp.getBoundingClientRect();
                        if (r.width < 45 || r.height < 10) return false;
                        const cls = (inp.className || '').toLowerCase();
                        const val = (inp.value || '').trim().toLowerCase();
                        if (cls.includes('filter') || val === 'sgdea') return false;
                        return true;
                    });

                    return allVisibleInputs[0] || null;
                });

                const el = handle.asElement();
                if (el) {
                    expKeywordInput = el;
                    targetFrame = fr;
                    break;
                }
            } catch {}
        }
        if (!expKeywordInput) await wait(450);
    }

    if (expKeywordInput && targetFrame) {
        try {
            // Limpiar todos los inputs de Palabras clave (excepto el filtro 'sgdea') para no arrastrar valores anteriores
            await targetFrame.evaluate(() => {
                const kwInputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])')).filter(inp => {
                    if (inp.readOnly || inp.disabled) return false;
                    const cls = (inp.className || '').toLowerCase();
                    const val = (inp.value || '').trim().toLowerCase();
                    return !cls.includes('filter') && val !== 'sgdea' && inp.getBoundingClientRect().width > 45;
                });
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                kwInputs.forEach(inp => {
                    if (nativeSetter) nativeSetter.call(inp, '');
                    else inp.value = '';
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                });
            }).catch(() => {});

            await expKeywordInput.click({ clickCount: 3 }).catch(() => {});
            await wait(80);
            await page.keyboard.down('Control').catch(() => {});
            await page.keyboard.press('KeyA').catch(() => {});
            await page.keyboard.up('Control').catch(() => {});
            await page.keyboard.press('Backspace').catch(() => {});
            await wait(80);

            for (const ch of cleanExpCode) {
                await page.keyboard.type(ch, { delay: 20 });
            }
            await wait(250);

            // Asegurar valor exacto con nativeSetter y disparar eventos
            await targetFrame.evaluate((el, val) => {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                if (el.value !== val) {
                    if (nativeSetter) nativeSetter.call(el, val);
                    else el.value = val;
                }
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
            }, expKeywordInput, cleanExpCode).catch(() => {});

            // Cerrar cualquier dropdown flotante de autocompletado con Escape para despejar el botón Buscar
            await page.keyboard.press('Escape').catch(() => {});
            await wait(150);

            addLog(`[VERIFICADOR][PASO 6] ✅ Código "${cleanExpCode}" escrito en campo "SGDEA - Expediente".`);
        } catch (e) {
            addLog(`[VERIFICADOR][WARN] Error escribiendo en SGDEA - Expediente: ${e.message}`);
        }
    } else {
        addLog(`[VERIFICADOR][WARN] No se localizó el campo "SGDEA - Expediente" en el DOM.`);
    }

    // Hacer clic en el botón "Buscar" (button.js-searchButton)
    let searchClicked = false;
    for (const fr of candidateFramesForQuery()) {
        try {
            const btnInfo = await fr.evaluate(() => {
                const searchBtn = document.querySelector('button.js-searchButton, .js-searchButton, button.btn-primary') ||
                    Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a, div[role="button"]')).find(b => {
                        const t = (b.innerText || b.value || b.textContent || b.title || '').trim().toLowerCase();
                        const r = b.getBoundingClientRect();
                        return (t === 'buscar' || t === 'search') && r.width > 25 && r.height > 12;
                    });
                if (searchBtn) {
                    searchBtn.scrollIntoView({ block: 'nearest' });
                    const r = searchBtn.getBoundingClientRect();
                    searchBtn.click();
                    searchBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    searchBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                    searchBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    return { clicked: true, x: r.left + r.width / 2, y: r.top + r.height / 2 };
                }
                return null;
            });
            if (btnInfo?.clicked) {
                try {
                    const fEl = await fr.frameElement();
                    const fBox = fEl ? await fEl.boundingBox() : { x: 0, y: 0 };
                    if (fBox && btnInfo.x > 0 && btnInfo.y > 0) {
                        await page.mouse.click(fBox.x + btnInfo.x, fBox.y + btnInfo.y);
                    }
                } catch {}
                searchClicked = true;
                addLog(`[VERIFICADOR][PASO 6] ✅ Clic en botón "Buscar" ejecutado. Esperando tabla de resultados de OnBase...`);
                break;
            }
        } catch {}
    }

    if (!searchClicked) {
        await page.keyboard.press('Enter').catch(() => {});
        addLog(`[VERIFICADOR][PASO 6] Tecla Enter enviada para ejecutar la búsqueda.`);
    }

    // ── PASO 7: LEER RESULTADOS EN EL PANEL DERECHO (DocumentSelectList.aspx / DocumentSelectContainer.aspx / frmViewer) ──
    await updateLiveStep(`Paso 7: Leyendo documentos cargados en OnBase para ${cleanExpCode}...`);

    let foundRows = [];
    let isNothingToShow = false;

    // Sondear hasta 4.5s para dar tiempo a que DocumentSelectList.aspx renderice las filas de resultados
    for (let pollIdx = 0; pollIdx < 7; pollIdx++) {
        await wait(650);
        foundRows = [];
        isNothingToShow = false;

        for (const fr of page.frames()) {
            const fUrl = (fr.url() || '').toLowerCase();
            // No leer como resultados el panel izquierdo de consulta ni el frame de descarga
            if (fUrl.includes('customquery.aspx') || fUrl.includes('unloadhandler')) continue;

            try {
                const isMainNavFrame = fUrl.includes('navpanel.aspx');
                const resData = await fr.evaluate((expCode, isMainNav) => {
                    const bodyText = (document.body?.innerText || '');
                    const lowerBody = bodyText.toLowerCase();
                    const nothing = lowerBody.includes('nada para mostrar') ||
                                    lowerBody.includes('nothing to display') ||
                                    lowerBody.includes('0 documentos') ||
                                    lowerBody.includes('no se encontraron documentos');

                    // Si estamos en el frame contenedor principal (NavPanel.aspx), solo mirar a la derecha (left > 250).
                    // PERO si estamos dentro del iframe de resultados (DocumentSelectList.aspx / DocumentSelectContainer.aspx), left empieza en 0!
                    const minLeft = isMainNav ? 250 : -5;

                    const rowSelectors = [
                        'table tbody tr',
                        'tr[id*="row" i]',
                        'tr[class*="row" i]',
                        'tr[class*=" item" i]',
                        'tr[class*="doc" i]',
                        '[role="row"]',
                        '.ag-center-cols-container .ag-row',
                        '.ui-grid-row',
                        '.k-grid-content tr',
                        'div[class*="result" i] div[class*="row" i]',
                        'li[class*="result" i]',
                        'div[class*="document-row" i]',
                        'div[class*="listRow" i]',
                        'div[class*="gridRow" i]'
                    ];

                    const collected = [];
                    const seenTexts = new Set();

                    for (const sel of rowSelectors) {
                        const els = Array.from(document.querySelectorAll(sel));
                        for (const el of els) {
                            const r = el.getBoundingClientRect();
                            if (r.left < minLeft || r.height < 12 || r.height > 180 || r.width < 120) continue;
                            const txt = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
                            if (!txt || txt.length < 5) continue;
                            const low = txt.toLowerCase();
                            if (
                                low.startsWith('nombre documento') ||
                                low.startsWith('tipo documental') ||
                                low === 'fecha' ||
                                low.includes('tipos de consulta') ||
                                low.includes('palabras clave') ||
                                low === 'recuperación de documentos' ||
                                low === 'consultas personalizadas'
                            ) continue;
                            if (!seenTexts.has(txt)) {
                                seenTexts.add(txt);
                                collected.push(txt);
                            }
                        }
                    }

                    // Fallback: si DocumentSelectList.aspx usa divs/spans/tds o lista plana sin <tr> estándar
                    if (collected.length === 0 && !nothing && !isMainNav) {
                        const candidateLines = Array.from(document.querySelectorAll('tr, li, div, a, span')).filter(el => {
                            const r = el.getBoundingClientRect();
                            return r.height >= 14 && r.height <= 55 && r.width >= 150 && el.children.length <= 8;
                        });
                        for (const el of candidateLines) {
                            const txt = (el.innerText || '').replace(/\s+/g, ' ').trim();
                            const low = txt.toLowerCase();
                            if (
                                txt.length >= 8 &&
                                !low.includes('nada para mostrar') &&
                                !low.startsWith('nombre documento') &&
                                (txt.toUpperCase().includes(expCode.toUpperCase()) || txt.includes('TRD') || /\d{1,2}\/\d{1,2}\/\d{4}/.test(txt))
                            ) {
                                if (!seenTexts.has(txt)) {
                                    seenTexts.add(txt);
                                    collected.push(txt);
                                }
                            }
                        }
                    }

                    return { nothing, rows: collected };
                }, cleanExpCode, isMainNavFrame);

                if (resData) {
                    if (resData.rows && resData.rows.length > 0) {
                        foundRows.push(...resData.rows);
                    }
                    if (resData.nothing && foundRows.length === 0) {
                        isNothingToShow = true;
                    }
                }
            } catch {}
        }

        foundRows = [...new Set(foundRows)];
        if (foundRows.length > 0 || (isNothingToShow && pollIdx >= 2)) {
            break;
        }
    }

    await updateLiveStep(`Paso 7: Comparando ${expectedDocs.length} documento(s) de "${cleanExpCode}" contra ${foundRows.length} en OnBase...`);

    const foundCount = foundRows.length;
    if (vSession && vSession.liveVerification) {
        vSession.liveVerification.foundInOnBaseCount = foundCount;
        vSession.liveVerification.onbaseRows = foundRows.slice(0, 30);
    }

    // ── CRUCE EN TIEMPO REAL DOCUMENTO POR DOCUMENTO CONTRA LOS RESULTADOS DE ONBASE ──
    const normalizeStr = (s) => String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const STOPWORDS = new Set([
        'DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'EN', 'PARA', 'POR', 'CON', 'SIN', 'SOBRE',
        'PROCESO', 'VIGENTE', 'ESPECIAL', 'REGULACION', 'SALVO', 'FORMATO', 'DOCUMENTO', 'TRD'
    ]);

    const normalizedFoundRows = foundRows.map((raw, idx) => ({
        index: idx,
        raw,
        norm: normalizeStr(raw),
        used: false
    }));

    const missingDocs = [];
    const verifiedDocs = [];

    for (let i = 0; i < expectedDocs.length; i++) {
        const doc = expectedDocs[i];
        const liveDocItem = liveDocs[i];

        const catalogAlias = findCatalogOnBaseTypology(doc.typology_name) || doc.onbase_name || '';
        const cleanTyp = stripTypologyDecorators(doc.typology_name || '');
        const aliasNorm = normalizeStr(catalogAlias);
        const typNorm = normalizeStr(cleanTyp);
        const fileBaseNorm = normalizeStr(String(doc.filename || '').replace(/\.pdf$/i, '').replace(/^\d+[\s._-]*/, ''));
        const joinedNorm = normalizeStr(doc.joinedName || '');

        const aliasTokens = aliasNorm.split(' ').filter(w => w.length >= 3 && !STOPWORDS.has(w));
        const typTokens = typNorm.split(' ').filter(w => w.length >= 3 && !STOPWORDS.has(w));

        let bestMatch = null;
        let bestScore = 0;

        for (const rowObj of normalizedFoundRows) {
            let score = 0;
            const rNorm = rowObj.norm;

            if (aliasNorm.length >= 3 && rNorm.includes(aliasNorm)) {
                score += 120;
            }
            if (typNorm.length >= 4 && rNorm.includes(typNorm)) {
                score += 110;
            }
            if (aliasTokens.length > 0) {
                const hits = aliasTokens.filter(t => rNorm.includes(t)).length;
                if (hits === aliasTokens.length) score += 95;
                else if (hits / aliasTokens.length >= 0.5) score += 65 * (hits / aliasTokens.length);
            }
            if (typTokens.length > 0) {
                const hits = typTokens.filter(t => rNorm.includes(t)).length;
                if (hits === typTokens.length) score += 90;
                else if (hits >= 2 || (hits / typTokens.length >= 0.5)) score += 60 * (hits / typTokens.length);
            }
            if (fileBaseNorm.length >= 5 && rNorm.includes(fileBaseNorm.substring(0, Math.min(22, fileBaseNorm.length)))) {
                score += 50;
            }
            if (joinedNorm.length >= 6 && rNorm.includes(joinedNorm.substring(0, Math.min(22, joinedNorm.length)))) {
                score += 35;
            }
            // Preferir filas aún no asignadas a otro documento
            if (score > 0 && !rowObj.used) {
                score += 15;
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = rowObj;
            }
        }

        // Si no hubo match textual directo pero OnBase tiene al menos tantos documentos como los esperados, emparejar fila libre
        if (!bestMatch && foundCount >= expectedDocs.length && !isNothingToShow) {
            bestMatch = normalizedFoundRows.find(r => !r.used) || normalizedFoundRows[0] || null;
        }

        if (bestMatch) {
            bestMatch.used = true;
            verifiedDocs.push(doc);
            if (liveDocItem) {
                liveDocItem.verifyState = 'cargado';
                liveDocItem.dbStatus = 'Cargado';
                liveDocItem.matchedRow = bestMatch.raw;
                liveDocItem.updatedAt = new Date().toISOString();
            }
            // Actualizar inmediatamente este documento en PostgreSQL para que la tabla refleje en tiempo real que SÍ está cargado
            if (doc.id) {
                await pool.query(
                    `UPDATE documents
                     SET status = 'Cargado',
                         load_date = COALESCE(load_date, CURRENT_TIMESTAMP),
                         onbase_verified = 2,
                         onbase_verify_stage = 'Verificado en OnBase ✅',
                         onbase_verified_at = CURRENT_TIMESTAMP,
                         onbase_found_count = $1
                     WHERE id = $2`,
                    [foundCount, doc.id]
                ).catch(() => {});
            }
            addLog(`✅ [TIEMPO REAL · ${cleanExpCode}] (${i + 1}/${expectedDocs.length}) SÍ CARGADO EN AES: "${doc.typology_name || doc.filename}" → Confirmado en OnBase: "${bestMatch.raw.substring(0, 85)}"`);
        } else {
            missingDocs.push(doc);
            if (liveDocItem) {
                liveDocItem.verifyState = 'no_cargado';
                liveDocItem.matchedRow = isNothingToShow
                    ? 'Carpeta sin documentos en OnBase ("Nada para mostrar")'
                    : 'No aparece esta tipología en la consulta SGDEA Expediente';
                liveDocItem.updatedAt = new Date().toISOString();
            }
            if (doc.id) {
                await pool.query(
                    `UPDATE documents
                     SET onbase_verified = -1,
                         onbase_verify_stage = 'No encontrado en OnBase ❌',
                         onbase_verified_at = CURRENT_TIMESTAMP,
                         onbase_found_count = $1
                     WHERE id = $2`,
                    [foundCount, doc.id]
                ).catch(() => {});
            }
            addLog(`❌ [TIEMPO REAL · ${cleanExpCode}] (${i + 1}/${expectedDocs.length}) NO CARGADO EN AES: "${doc.typology_name || doc.filename}" → Faltante en OnBase`);
        }

        if (vSession && vSession.liveVerification) {
            vSession.liveVerification.verifiedCount = verifiedDocs.length;
            vSession.liveVerification.missingCount = missingDocs.length;
            vSession.liveVerification.updatedAt = new Date().toISOString();
            vSession.processedDocs = verifiedDocs.length;
        }
        await wait(120);
    }

    if (vSession && vSession.liveVerification) {
        vSession.liveVerification.status = missingDocs.length === 0 ? 'VERIFICADO_OK' : 'INCOMPLETO';
        vSession.liveVerification.step = `Resultado "${cleanExpCode}": ${verifiedDocs.length}/${expectedDocs.length} cargados en OnBase (${missingDocs.length} faltantes)`;
        vSession.liveVerification.updatedAt = new Date().toISOString();

        if (!Array.isArray(vSession.recentVerifications)) {
            vSession.recentVerifications = [];
        }
        vSession.recentVerifications = [
            JSON.parse(JSON.stringify(vSession.liveVerification)),
            ...vSession.recentVerifications.filter(r => r.expedienteCode !== cleanExpCode)
        ].slice(0, 20);
    }

    addLog(`[VERIFICADOR] 📊 Resumen Carpeta "${cleanExpCode}": ${foundCount} registro(s) en OnBase | ✅ Cargados: ${verifiedDocs.length}/${expectedDocs.length} | ❌ No cargados: ${missingDocs.length}`);

    return {
        success: missingDocs.length === 0 && (foundCount > 0 || expectedDocs.length === 0),
        foundCount,
        foundRows: foundRows.slice(0, 30),
        verifiedDocs,
        missingDocs,
        isNothingToShow
    };
}

// ─────────────────────────────────────────────────────────────────
// RELEVO DEL BOT VERIFICADOR (POR OLEADA DE TIPOLOGÍA Y AL 100%)
// ─────────────────────────────────────────────────────────────────
async function runVerifierRelayCheckpoint({ loaderSession, page, browser, expedienteCode, expedienteId, stageLabel, expectedDocs }) {
    const vSession = botSessions['VERIFICADOR'];
    const prevStep = loaderSession.currentStep;

    try {
        // 1. Poner al Bot Cargador en espera mientras el Bot Verificador audita OnBase en la misma sesión activa
        loaderSession.waitingForVerifier = true;
        setBotStep(loaderSession, `⏸️ Verificando en OnBase (${stageLabel} de ${expedienteCode})...`);
        loaderSession.logs.push(`
⏸️ [RELEVO ${stageLabel}] Validando carpeta "${expedienteCode}" en OnBase (Consultas personalizadas -> SGDEA Expediente)...`);

        // 2. Activar el Bot Verificador Independiente
        vSession.running = true;
        vSession.standby = false;
        vSession.onbaseUser = loaderSession.onbaseUser;
        vSession.currentExpedienteCode = expedienteCode;
        vSession.totalDocs = expectedDocs.length;
        vSession.processedDocs = 0;
        vSession.startTime = new Date().toISOString();
        vSession.page = page;
        setBotStep(vSession, `🔍 Verificando ${stageLabel} de Expediente ${expedienteCode}`);
        vSession.logs.push(`
==================================================`);
        vSession.logs.push(`🔍 [BOT VERIFICADOR · ${stageLabel}] Activado para auditar Expediente "${expedienteCode}" (${expectedDocs.length} doc(s))`);
        vSession.logs.push(`==================================================`);

        // Ejecutar la consulta directamente sobre la sesión principal autenticada (evita abrir segunda pestaña que rompe el frameset de OnBase)
        const checkResult = await ejecutarConsultaPersonalizadaSGDEAExpediente(
            page,
            browser,
            expedienteCode,
            expectedDocs,
            loaderSession.logs,
            true
        );

        vSession.processedDocs = checkResult.verifiedDocs.length;

        // Registrar en historial de auditoría
        const histItem = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            expedienteId,
            expedienteCode,
            stage: stageLabel,
            expectedCount: expectedDocs.length,
            foundCount: checkResult.foundCount,
            verifiedCount: checkResult.verifiedDocs.length,
            missingCount: checkResult.missingDocs.length,
            missingNames: checkResult.missingDocs.map(d => d.filename),
            status: checkResult.missingDocs.length === 0 ? 'VERIFICADO_OK' : 'INCOMPLETO',
            onbaseUser: loaderSession.onbaseUser
        };
        verificationHistory.unshift(histItem);
        if (verificationHistory.length > 100) verificationHistory.length = 100;

        await pool.query(
            `INSERT INTO onbase_verification_logs (expediente_id, expediente_code, stage, expected_count, found_count, status, details, verified_by_user)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                expedienteId || null,
                expedienteCode,
                stageLabel,
                expectedDocs.length,
                checkResult.foundCount,
                histItem.status,
                JSON.stringify({ missing: histItem.missingNames, sampleRows: checkResult.foundRows.slice(0, 5) }),
                loaderSession.onbaseUser
            ]
        ).catch(() => {});

        if (checkResult.missingDocs.length === 0) {
            pushSystemAlert({
                type: 'success',
                title: `✅ Expediente ${expedienteCode} Verificado (${stageLabel})`,
                message: `El Bot Verificador confirmó en OnBase (${stageLabel}): ${checkResult.verifiedDocs.length}/${expectedDocs.length} documento(s) cargados correctamente (${checkResult.foundCount} en consulta SGDEA Expediente).`,
                expedienteCode,
                botKey: loaderSession.botKey,
                sendMobile: stageLabel.includes('100')
            });
        } else {
            pushSystemAlert({
                type: 'warning',
                title: `⚠️ Atención en Expediente ${expedienteCode} (${stageLabel})`,
                message: `El Bot Verificador detectó ${checkResult.missingDocs.length} documento(s) que no reflejaron en OnBase (${checkResult.missingDocs.map(d => d.filename).join(', ')}). Se reintentarán automáticamente.`,
                expedienteCode,
                botKey: loaderSession.botKey,
                sendMobile: true
            });
        }

        return checkResult;
    } catch (err) {
        vSession.logs.push(`[VERIFICADOR][ERROR] Error en verificación ${stageLabel} de ${expedienteCode}: ${err.message}`);
        return { success: false, foundCount: 0, verifiedDocs: [], missingDocs: [] };
    } finally {
        vSession.running = false;
        vSession.standby = true;
        vSession.completed = true;
        vSession.page = null;
        setBotStep(vSession, `⏸️ En espera (Último verificado: ${expedienteCode} al ${stageLabel})`);
        vSession.logs.push(`⏸️ [BOT VERIFICADOR] Verificación ${stageLabel} de "${expedienteCode}" finalizada.`);

        loaderSession.waitingForVerifier = false;
        setBotStep(loaderSession, prevStep);
    }
}

// ─────────────────────────────────────────────────────────────────
// WATCHDOG ANTI-BLOQUEO ONBASE (60s / 90s / 120s) + AUTO-DESBLOQUEO
// ─────────────────────────────────────────────────────────────────
async function performBotUnlockProcedure(session, reason = 'Solicitud manual de desbloqueo', forceRestartBrowser = false) {
    if (!session) return { success: false, message: 'Sesión de Bot no encontrada' };
    session.unlockCount = (session.unlockCount || 0) + 1;
    session.lastStepChangeAt = Date.now();
    session.stepStuckSeconds = 0;

    const tag = `[DESBLOQUEO #${session.unlockCount}]`;
    session.logs.push(`
🔓 ${tag} Iniciando trámite de desbloqueo en OnBase (${reason})...`);

    if (!session.browser || !session.page) {
        session.logs.push(`🔓 ${tag} El navegador no estaba activo; listo para nueva ejecución.`);
        return { success: true, message: 'Estado del Bot reiniciado.' };
    }

    try {
        // 0. Verificar si el explorador está trabado en "It is safe to close this window" / Close.aspx o si se solicitó reinicio completo
        const stuckState = await isPageStuckOrCloseWindow(session.page, session.browser);
        if ((stuckState.stuck || forceRestartBrowser) && typeof session.restartBrowserFn === 'function') {
            const restartReason = stuckState.reason || reason;
            session.logs.push(`🔄 ${tag} Explorador trabado detectado (${restartReason}). Cerrando navegador y abriendo uno nuevo desde cero...`);
            const restarted = await session.restartBrowserFn(restartReason);
            return {
                success: !!restarted,
                message: restarted
                    ? `Explorador de ${session.label} (${session.onbaseUser}) cerrado, reiniciado y reconectado a OnBase.`
                    : `No fue posible reconectar ${session.label} tras reiniciar el explorador.`
            };
        }

        // 1. Limpiar modales de bloqueo User Locks / Document Locks en todas las pestañas
        await checkAndClearLocks(session.browser, session.logs).catch(() => {});

        // 2. Cerrar alertas/popups bloqueantes o spinners trabados dentro de los frames de OnBase
        const allPages = await session.browser.pages().catch(() => [session.page]);
        for (const pg of allPages) {
            for (const fr of pg.frames()) {
                try {
                    await fr.evaluate(() => {
                        // Aceptar o cerrar botones de diálogo modal trabados
                        const modalBtns = Array.from(document.querySelectorAll('button, input[type="button"], a, span[role="button"]'));
                        const closeOrOk = modalBtns.find(b => {
                            const t = (b.innerText || b.value || '').trim().toLowerCase();
                            return t === 'ok' || t === 'aceptar' || t === 'yes' || t === 'sí' || t === 'si' || t === 'remove lock' || t === 'unlock' || t === 'continuar';
                        });
                        if (closeOrOk && closeOrOk.offsetParent !== null) {
                            closeOrOk.click();
                        }
                        // Remover overlays de espera infinitos (wait masks de OnBase si quedaron congelados)
                        const masks = document.querySelectorAll('.wait-mask, .loading-overlay, .blockUI, [class*="WaitMask" i], [id*="waitDiv" i]');
                        masks.forEach(m => {
                            if (m && m.style) m.style.display = 'none';
                        });
                    });
                } catch {}
            }
            // Enviar tecla Escape por si hay un dropdown o modal bloqueando foco
            await pg.keyboard.press('Escape').catch(() => {});
        }

        session.logs.push(`🔓 ${tag} ✅ Candados y máscaras de bloqueo liberados exitosamente en ${session.label}.`);
        return {
            success: true,
            message: `Trámite de desbloqueo aplicado en ${session.label} (${session.onbaseUser}).`
        };
    } catch (err) {
        session.logs.push(`🔓 ${tag} [WARN] Error parcial durante desbloqueo: ${err.message}`);
        return { success: false, message: err.message };
    }
}

// Intervalo Watchdog cada 15 segundos para vigilar si algún Bot se queda "pensando" o trabado en "It is safe to close this window"
let watchdogBusy = false;
setInterval(async () => {
    if (watchdogBusy) return;
    watchdogBusy = true;
    try {
        const now = Date.now();
        for (const k of ['9224', '9224.4', '9224.2', 'VERIFICADOR']) {
            const s = botSessions[k];
            if (!s || !s.running || s.waitingForVerifier || s.isRestartingBrowser) continue;

            // Chequeo inmediato de ventana trabada ("It is safe to close this window" / EmbeddedPage/Close.aspx)
            if (s.page && typeof s.restartBrowserFn === 'function') {
                const stuckCheck = await isPageStuckOrCloseWindow(s.page, s.browser);
                if (stuckCheck.stuck) {
                    s.lastStepChangeAt = Date.now();
                    s.logs.push(`🔄 [WATCHDOG AUTO-REINICIO] Explorador trabado en "${stuckCheck.reason}". Cerrando y abriendo explorador nuevamente...`);
                    await performBotUnlockProcedure(s, `Auto-reinicio por ${stuckCheck.reason}`, true);
                    continue;
                }
            }

            if (!s.lastStepChangeAt) continue;
            const elapsedSecs = Math.round((now - s.lastStepChangeAt) / 1000);
            s.stepStuckSeconds = elapsedSecs;

            if (elapsedSecs >= 60 && elapsedSecs < 75) {
                s.logs.push(`⚠️ [WATCHDOG 60s] OnBase lleva ${elapsedSecs}s pensando en "${s.currentStep}". Ejecutando limpieza preventiva de candados...`);
                await performBotUnlockProcedure(s, 'Watchdog preventivo 60s (OnBase pensando)', false);
            } else if (elapsedSecs >= 90 && elapsedSecs < 105) {
                s.lastStepChangeAt = Date.now();
                const ssB64 = s.liveFrame || s.screenshot || null;
                pushSystemAlert({
                    type: 'warning',
                    title: `⏳ OnBase pensando (>90s) en ${s.shortName}`,
                    message: `El ${s.label} (${s.onbaseUser}) lleva ${elapsedSecs}s en "${s.currentStep}" (Expediente: ${s.currentExpedienteCode || 'Actual'}). Se aplicó reinicio automático del explorador.`,
                    expedienteCode: s.currentExpedienteCode,
                    botKey: s.botKey,
                    sendMobile: true,
                    screenshotB64: ssB64
                });
                await performBotUnlockProcedure(s, 'Watchdog 90s: cerrando y abriendo explorador nuevamente', true);
            } else if (elapsedSecs >= 135) {
                s.lastStepChangeAt = Date.now();
                const ssB64 = s.liveFrame || s.screenshot || null;
                pushSystemAlert({
                    type: 'error',
                    title: `🚨 Bloqueo OnBase detectado en ${s.shortName} (${s.onbaseUser})`,
                    message: `OnBase no respondió tras ${elapsedSecs}s en "${s.currentStep}". Reiniciando explorador para continuar con el lote.`,
                    expedienteCode: s.currentExpedienteCode,
                    botKey: s.botKey,
                    sendMobile: true,
                    screenshotB64: ssB64
                });
                await performBotUnlockProcedure(s, 'Watchdog 135s: reinicio forzado del explorador', true);
            }
        }
    } catch {} finally {
        watchdogBusy = false;
    }
}, 15000);

// ─────────────────────────────────────────────────────────────────
// CICLO AUTOMÁTICO DE VERIFICACIÓN CADA 5 MINUTOS (BOT VERIFICADOR INDEPENDIENTE)
// ─────────────────────────────────────────────────────────────────
setInterval(async () => {
    if (!alertSettings.autoVerifyEvery5Min) return;
    alertSettings.nextAutoVerifyAt = new Date(Date.now() + (alertSettings.verifyIntervalMinutes || 5) * 60 * 1000).toISOString();

    const anyLoaderRunning = ['9224', '9224.4', '9224.2'].some(k => botSessions[k].running);
    if (anyLoaderRunning || botSessions['VERIFICADOR'].running) {
        return; // Si hay un cargue activo, el Bot Verificador ya está verificando en modo relevo al 50% y 100%
    }

    try {
        // Buscar si hay expedientes con documentos en estado 'Cargado' que aún no estén '100% Verificado' (onbase_verified < 2)
        const pendingVerifyRes = await pool.query(`
            SELECT DISTINCT e.id as expediente_id, e.expediente_code
            FROM documents d
            INNER JOIN expedientes e ON d.expediente_id = e.id
            WHERE d.status = 'Cargado'
              AND COALESCE(d.onbase_verified, 0) = 1
              AND d.load_date::timestamp >= NOW() - INTERVAL '30 minutes'
              AND e.expediente_code IS NOT NULL
              AND TRIM(e.expediente_code) != ''
            LIMIT 3
        `);
        const exps = pendingVerifyRes.rows || [];
        if (exps.length > 0) {
            const expCodes = exps.map(x => x.expediente_code);
            console.log(`[AUTO-VERIFY 5M] Iniciando verificación automática programada para ${expCodes.length} expediente(s): ${expCodes.join(', ')}`);
            await runStandaloneVerifierBot({ expedienteCodes: expCodes, triggerSource: 'Ciclo Automático 5 Minutos' });
        }
    } catch (e) {
        console.warn('[AUTO-VERIFY 5M] Error en ciclo automático:', e.message);
    }
}, 5 * 60 * 1000);

// Ejecución autónoma del Bot 4 Verificador (cuando se invoca por el ciclo de 5 min o por el botón "Verificar Ahora")
async function runStandaloneVerifierBot({ expedienteCodes = [], url = null, targetUser = null, triggerSource = 'Manual' }) {
    const vSession = botSessions['VERIFICADOR'];
    if (vSession.running) {
        return { success: false, message: 'El Bot Verificador ya se encuentra ejecutando una verificación en este momento.' };
    }

    // Obtener URL de OnBase y credenciales desde BD si no se pasaron
    if (!url) {
        const sRes = await pool.query(`SELECT value FROM system_settings WHERE key = 'ades_url' LIMIT 1`).catch(() => ({ rows: [] }));
        url = sRes.rows?.[0]?.value;
    }
    if (!url) {
        return { success: false, message: 'URL de OnBase (ades_url) no configurada en el sistema.' };
    }

    const orgRes = await pool.query(`SELECT * FROM organization_structure ORDER BY id ASC`).catch(() => ({ rows: [] }));
    const orgRows = orgRes.rows || [];
    const orgForm = orgRows.find(o => o.subsection_code === '9224.4') || { onbase_user: 'EDHERNANDEZM', onbase_pass: 'Sena2026**onbase' };
    const orgAdmin = orgRows.find(o => o.subsection_code === '9224.2') || { onbase_user: 'luepitar', onbase_pass: 'Automatizador2026*' };
    const orgSub = orgRows.find(o => !o.subsection_code || o.subsection_code === '') || { onbase_user: 'TVILLAMIZARJ', onbase_pass: 'Sena2026**onbase' };

    const getU = (o, fb) => String(o?.onbase_user || o?.onbase_username || fb).trim();
    const getP = (o, fb) => String(o?.onbase_pass || o?.onbase_password || fb).trim();

    let browser = null;
    let page = null;
    vSession.running = true;
    vSession.standby = false;
    vSession.completed = false;
    vSession.error = null;
    vSession.startTime = new Date().toISOString();
    vSession.totalDocs = expedienteCodes.length;
    vSession.processedDocs = 0;
    vSession.logs = [
        `==================================================`,
        `🔍 [BOT VERIFICADOR INDEPENDIENTE] Iniciado (${triggerSource})`,
        `📋 Expedientes a auditar en OnBase: ${expedienteCodes.join(', ')}`,
        `==================================================`
    ];

    const profileDir = path.join(resolvePuppeteerBaseTmpDir(), 'puppeteer_aes_bot_VERIFICADOR');
    try {

        // Determinar credenciales según el primer expediente
        const firstDocsRes = await pool.query(`
            SELECT d.*, e.expediente_code, e.subserie
            FROM documents d
            INNER JOIN expedientes e ON d.expediente_id = e.id
            WHERE e.expediente_code = $1
        `, [expedienteCodes[0]]).catch(() => ({ rows: [] }));

        const sampleSub = String(firstDocsRes.rows?.[0]?.subserie || '').toUpperCase();
        let loginUser = getU(orgForm, 'EDHERNANDEZM');
        let loginPass = getP(orgForm, 'Sena2026**onbase');
        if (sampleSub.includes('9224.2')) {
            loginUser = getU(orgAdmin, 'luepitar');
            loginPass = getP(orgAdmin, 'Automatizador2026*');
        } else if (sampleSub.includes('9224-')) {
            loginUser = getU(orgSub, 'TVILLAMIZARJ');
            loginPass = getP(orgSub, 'Sena2026**onbase');
        }
        if (targetUser && targetUser !== 'auto') {
            if (targetUser.toLowerCase().includes('luepitar')) { loginUser = getU(orgAdmin, 'luepitar'); loginPass = getP(orgAdmin, 'Automatizador2026*'); }
            else if (targetUser.toLowerCase().includes('tvillamizar')) { loginUser = getU(orgSub, 'TVILLAMIZARJ'); loginPass = getP(orgSub, 'Sena2026**onbase'); }
        }

        vSession.onbaseUser = loginUser;

        const launchAndLoginVerifierBrowser = async (reason = null) => {
            vSession.isRestartingBrowser = true;
            try {
                for (let attempt = 1; attempt <= 3; attempt++) {
                    if (reason || attempt > 1) {
                        vSession.logs.push(`🔄 [VERIFICADOR] Reiniciando explorador (cerrar y abrir nuevamente - intento ${attempt}/3)${reason ? `: ${reason}` : ''}...`);
                    }
                    if (browser) {
                        await safeForceCloseBrowser(browser, profileDir);
                        browser = null;
                    }
                    try {
                        fs.rmSync(profileDir, { recursive: true, force: true });
                        fs.mkdirSync(profileDir, { recursive: true });
                    } catch {}

                    browser = await puppeteer.launch(buildPuppeteerLaunchOptions(profileDir));
                    vSession.browser = browser;
                    page = await browser.newPage();
                    vSession.page = page;
                    await page.setViewport({ width: 1366, height: 900 });

                    try {
                        const cdp = await page.target().createCDPSession();
                        await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 38, maxWidth: 800, maxHeight: 500, everyNthFrame: 6 });
                        cdp.on('Page.screencastFrame', ev => {
                            vSession.liveBuffer = Buffer.from(ev.data, 'base64');
                            vSession.liveFrame = 'data:image/jpeg;base64,' + ev.data;
                            cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
                        });
                    } catch {}

                    setBotStep(vSession, `Paso 1: Ingresando a OnBase (${loginUser})...`);
                    const ok = await paso1_login(page, url, loginUser, loginPass, vSession.logs);
                    if (ok) return true;
                    await wait(1500);
                }
                return false;
            } finally {
                vSession.isRestartingBrowser = false;
            }
        };

        vSession.restartBrowserFn = launchAndLoginVerifierBrowser;

        const loginOk = await launchAndLoginVerifierBrowser();
        if (!loginOk) {
            throw new Error(`No fue posible iniciar sesión con ${loginUser} para verificar expedientes.`);
        }

        const results = [];
        for (let i = 0; i < expedienteCodes.length; i++) {
            if (!vSession.running) break;
            const expCode = expedienteCodes[i];
            vSession.currentExpedienteCode = expCode;

            const docsRes = await pool.query(`
                SELECT d.*, e.expediente_code, e.title as exp_title, e.metadata_values as exp_meta
                FROM documents d
                INNER JOIN expedientes e ON d.expediente_id = e.id
                WHERE e.expediente_code = $1
                ORDER BY d.id ASC
            `, [expCode]).catch(() => ({ rows: [] }));

            const expDocs = (docsRes.rows || []).map(r => {
                let meta = {};
                try { meta = typeof r.exp_meta === 'string' ? JSON.parse(r.exp_meta) : (r.exp_meta || {}); } catch {}
                const joinedName = [1, 2, 3, 4, 5, 6, 7, 8]
                    .map(idx => meta[`valor${idx}`] || meta[`Metadato ${idx}`] || '')
                    .map(v => String(v).trim())
                    .filter(Boolean)
                    .join(' ')
                    .trim() || r.exp_title || r.filename;
                return {
                    ...r,
                    joinedName,
                    onbase_name: findCatalogOnBaseTypology(r.typology_name) || r.onbase_name || null
                };
            });
            const expId = expDocs[0]?.expediente_id || null;

            const checkRes = await ejecutarConsultaPersonalizadaSGDEAExpediente(
                page,
                browser,
                expCode,
                expDocs,
                vSession.logs,
                false
            );

            vSession.processedDocs = i + 1;

            const histItem = {
                id: Date.now() + i,
                timestamp: new Date().toISOString(),
                expedienteId: expId,
                expedienteCode: expCode,
                stage: 'Auditoría Completa',
                expectedCount: expDocs.length,
                foundCount: checkRes.foundCount,
                verifiedCount: checkRes.verifiedDocs.length,
                missingCount: checkRes.missingDocs.length,
                missingNames: checkRes.missingDocs.map(d => d.filename),
                status: (checkRes.missingDocs.length === 0 && expDocs.length > 0) ? 'VERIFICADO_OK' : 'INCOMPLETO',
                onbaseUser: loginUser
            };
            verificationHistory.unshift(histItem);
            results.push(histItem);

            await pool.query(
                `INSERT INTO onbase_verification_logs (expediente_id, expediente_code, stage, expected_count, found_count, status, details, verified_by_user)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    expId,
                    expCode,
                    'Auditoría Completa',
                    expDocs.length,
                    checkRes.foundCount,
                    histItem.status,
                    JSON.stringify({ missing: histItem.missingNames, sampleRows: (checkRes.foundRows || []).slice(0, 5) }),
                    loginUser
                ]
            ).catch(() => {});

            if (histItem.status === 'VERIFICADO_OK') {
                pushSystemAlert({
                    type: 'success',
                    title: `✅ Expediente ${expCode} Verificado 100% en OnBase`,
                    message: `Confirmados ${checkRes.verifiedDocs.length}/${expDocs.length} documento(s) cargados en OnBase (${checkRes.foundCount} registro(s) en SGDEA Expediente).`,
                    expedienteCode: expCode,
                    botKey: 'VERIFICADOR',
                    sendMobile: true
                });
            } else {
                pushSystemAlert({
                    type: 'warning',
                    title: `⚠️ Expediente ${expCode} Incompleto en OnBase`,
                    message: `Cargados en OnBase: ${checkRes.verifiedDocs.length}/${expDocs.length}. Faltantes (${checkRes.missingDocs.length}): ${checkRes.missingDocs.map(d => d.filename).join(', ') || 'Ningún documento en OnBase'}.`,
                    expedienteCode: expCode,
                    botKey: 'VERIFICADOR',
                    sendMobile: true
                });
            }
        }

        await paso7_logout(page, () => page.frames(), vSession.logs).catch(() => {});
        return { success: true, results };
    } catch (err) {
        vSession.error = err.message;
        vSession.logs.push(`[VERIFICADOR][ERROR] ${err.message}`);
        return { success: false, error: err.message };
    } finally {
        if (browser) await safeForceCloseBrowser(browser, profileDir);
        vSession.browser = null;
        vSession.page = null;
        vSession.running = false;
        vSession.standby = true;
        vSession.completed = true;
        setBotStep(vSession, '⏸️ En espera (Listo para siguiente verificación en tiempo real)');
    }
}

// ─────────────────────────────────────────────────────────────────
// ENDPOINTS HTTP DE ESTADO, FRAMES Y CONTROL
// ─────────────────────────────────────────────────────────────────
exports.getAutomationStatus = async (req, res) => {
    try {
        const requestedBot = req.query?.bot;
        const targetSession = getActiveOrRequestedBot(requestedBot);
        const anyRunning = BOT_KEYS.some(k => botSessions[k].running);
        const anyCompleted = BOT_KEYS.some(k => botSessions[k].completed);
        const botsMap = buildBotsStatusMap();

        const isSpecificBot = requestedBot && requestedBot !== 'all' && requestedBot !== 'auto';
        const vSession = botSessions['VERIFICADOR'];

        return res.json({
            success: true,
            activeBotKey: targetSession.botKey,
            running: isSpecificBot ? targetSession.running : anyRunning,
            anyRunning,
            jobId: targetSession.jobId,
            currentStep: targetSession.currentStep,
            logs: (targetSession.logs || []).slice(-100),
            error: targetSession.error,
            completed: isSpecificBot ? targetSession.completed : (!anyRunning && anyCompleted),
            totalDocs: targetSession.totalDocs,
            processedDocs: targetSession.processedDocs,
            currentDocName: targetSession.currentDocName,
            hasFrame: !!(targetSession.liveBuffer || targetSession.liveFrame || targetSession.screenshot),
            bots: botsMap,
            liveVerification: vSession?.liveVerification || null,
            recentVerifications: Array.isArray(vSession?.recentVerifications) ? vSession.recentVerifications.slice(0, 15) : [],
            alerts: systemAlerts.slice(0, 15),
            verificationHistory: verificationHistory.slice(0, 20),
            alertSettings: {
                autoVerifyEvery5Min: alertSettings.autoVerifyEvery5Min,
                nextAutoVerifyAt: alertSettings.nextAutoVerifyAt,
                ntfyTopic: alertSettings.ntfyTopic
            }
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.getAutomationFrame = async (req, res) => {
    try {
        const session = getActiveOrRequestedBot(req.query?.bot);
        if (session.liveBuffer) {
            res.writeHead(200, {
                'Content-Type': 'image/jpeg',
                'Content-Length': session.liveBuffer.length,
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            return res.end(session.liveBuffer);
        }
        const rawB64 = session.liveFrame || session.screenshot;
        if (!rawB64) {
            return res.status(404).send('No frame');
        }
        const b64Data = rawB64.replace(/^data:image\/\w+;base64,/, '');
        const imgBuffer = Buffer.from(b64Data, 'base64');
        res.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Content-Length': imgBuffer.length,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        return res.end(imgBuffer);
    } catch (err) {
        return res.status(500).send(err.message);
    }
};

async function stopSingleBotSession(session, reasonMsg = 'Detenido por el usuario') {
    if (!session) return;
    const stopProfileDir = path.join(
        resolvePuppeteerBaseTmpDir(),
        `puppeteer_aes_bot_${String(session.botKey || '').replace(/[^a-zA-Z0-9]/g, '_')}`
    );
    if (session.browser) {
        await safeForceCloseBrowser(session.browser, stopProfileDir);
        session.browser = null;
        session.page = null;
    }
    if (Array.isArray(session.documentIds)) {
        session.documentIds.forEach(id => activeDocLocks.delete(id));
    }
    session.running = false;
    session.waitingForVerifier = false;
    session.standby = session.botKey === 'VERIFICADOR';
    session.completed = true;
    setBotStep(session, reasonMsg);
    session.liveFrame = null;
    session.liveBuffer = null;
    session.screenshot = null;
    session.logs.push(`[DETENIDO] 🛑 ${session.label} (${session.onbaseUser}) cancelado por el usuario.`);
    automationEmitter.emit('done', session);
}

exports.killActiveAutomation = async (req, res) => {
    try {
        const botParam = req.body?.bot || req.query?.bot;
        if (botParam && botParam !== 'all') {
            const key = resolveBotKey(botParam);
            const session = botSessions[key];
            await stopSingleBotSession(session, 'Detenido individualmente por el usuario');
            return res.json({
                success: true,
                botKey: key,
                message: `${session.label} (${session.onbaseUser}) detenido correctamente.`,
                bots: buildBotsStatusMap()
            });
        }

        for (const k of BOT_KEYS) {
            if (botSessions[k].running || botSessions[k].browser) {
                await stopSingleBotSession(botSessions[k], 'Detenido por el usuario');
            }
        }
        if (activeBrowser) {
            await safeForceCloseBrowser(activeBrowser);
            activeBrowser = null;
            activePage = null;
        }
        return res.json({
            success: true,
            message: 'Todas las sesiones de automatización han sido detenidas.',
            bots: buildBotsStatusMap()
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────
// WORKER INDEPENDIENTE DE CADA BOT CARGADOR (CON RELEVO AL 50% Y 100% POR EXPEDIENTE)
// ─────────────────────────────────────────────────────────────────
async function runIndependentBotWorker(session, currentBatch, options = {}) {
    const {
        url,
        action,
        stop_at_step,
        caso_ids,
        casos_data,
        solo_diligenciar
    } = options;

    const botTag = `[BOT ${session.botKey} · ${currentBatch.username}]`;
    const batchDocs = currentBatch.docs || [];
    let browser = null;
    let page = null;
    let formPage = null;
    let formFrame = null;

    const profileDir = path.join(resolvePuppeteerBaseTmpDir(), `puppeteer_aes_bot_${session.botKey.replace(/[^a-zA-Z0-9]/g, '_')}`);
    try {

        const attachScreencastToPage = async (targetPage) => {
            try {
                const cdp = await targetPage.target().createCDPSession();
                await cdp.send('Page.startScreencast', {
                    format: 'jpeg',
                    quality: 35,
                    maxWidth: 800,
                    maxHeight: 500,
                    everyNthFrame: 8
                });
                let lastFrameTime = 0;
                cdp.on('Page.screencastFrame', ev => {
                    const now = Date.now();
                    if (now - lastFrameTime >= 850) {
                        lastFrameTime = now;
                        session.liveBuffer = Buffer.from(ev.data, 'base64');
                        session.liveFrame = 'data:image/jpeg;base64,' + ev.data;
                        automationEmitter.emit('frame', ev.data);
                    }
                    cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
                });
            } catch {}
        };

        const allFrames = () => (session.page || page).frames();

        // Función maestra para iniciar o reiniciar (cerrar y abrir nuevamente) el explorador de este Bot y autenticar en OnBase
        const launchOrRestartBotBrowser = async (reason = null) => {
            session.isRestartingBrowser = true;
            try {
                for (let attempt = 1; attempt <= 3; attempt++) {
                    if (reason || attempt > 1) {
                        session.logs.push(`${botTag} 🔄 [REINICIO EXPLORADOR] Cerrando explorador actual y abriendo uno nuevo (intento ${attempt}/3)${reason ? ` — Motivo: ${reason}` : ''}...`);
                    }
                    if (browser) {
                        await safeForceCloseBrowser(browser, profileDir);
                        browser = null;
                    }
                    // Limpiar completamente el directorio de perfil para eliminar cookies de Close.aspx / sesiones bloqueadas
                    try {
                        fs.rmSync(profileDir, { recursive: true, force: true });
                        fs.mkdirSync(profileDir, { recursive: true });
                    } catch {}

                    browser = await puppeteer.launch(buildPuppeteerLaunchOptions(profileDir));

                    session.browser = browser;
                    activeBrowser = browser;

                    browser.on('targetcreated', async target => {
                        if (target.type() === 'page') {
                            const newPage = await target.page().catch(() => null);
                            if (newPage) {
                                newPage.on('dialog', async dialog => {
                                    const msg = dialog.message();
                                    session.logs.push(`${botTag} [DIALOG] 💬 Diálogo nativo en pestaña: "${msg}". Aceptando...`);
                                    await dialog.accept().catch(() => {});
                                });
                            }
                        }
                    });

                    page = await browser.newPage();
                    session.page = page;
                    activePage = page;
                    formPage = page;
                    formFrame = page.mainFrame();
                    await page.setViewport({ width: 1366, height: 900 });

                    page.on('dialog', async dialog => {
                        const msg = dialog.message();
                        session.logs.push(`${botTag} [DIALOG] 💬 Diálogo nativo: "${msg}". Aceptando...`);
                        await dialog.accept().catch(() => {});
                    });

                    await attachScreencastToPage(page);

                    setBotStep(session, `PASO 1: Login (${currentBatch.username})${attempt > 1 ? ` [Reintento ${attempt}/3]` : ''}`);
                    const ok = await paso1_login(page, url, currentBatch.username, currentBatch.password, session.logs);
                    if (ok) {
                        if (reason || attempt > 1) {
                            session.logs.push(`${botTag} ✅ Explorador reiniciado y reconectado exitosamente a OnBase.`);
                        }
                        return true;
                    }
                    await wait(1500);
                }
                return false;
            } finally {
                session.isRestartingBrowser = false;
            }
        };

        session.restartBrowserFn = launchOrRestartBotBrowser;

        session.logs.push(`==================================================`);
        session.logs.push(`${botTag} 🚀 Iniciando sesión paralela con Verificación Relevo (50% y 100%)`);
        session.logs.push(`${botTag} 🏢 Dependencia TRD: ${currentBatch.depName} (${currentBatch.depCode})`);
        session.logs.push(`${botTag} 🔑 Usuario OnBase: "${currentBatch.username}" | Criterio: ${currentBatch.rule}`);
        session.logs.push(`${botTag} 📄 Documentos asignados a este Bot: ${batchDocs.length}`);
        session.logs.push(`==================================================`);

        // ── PASO 1: LOGIN POR DEPENDENCIA (CON AUTO-REINICIO DE EXPLORADOR SI SALE CLOSE.ASPX) ──
        const loginOk = await launchOrRestartBotBrowser();
        if (!loginOk) {
            session.logs.push(`${botTag} [ERROR] ❌ Login fallido con el usuario "${currentBatch.username}" tras 3 intentos de reinicio.`);
            const ss = page ? await page.screenshot().catch(() => null) : null;
            session.error = `Login fallido con usuario ${currentBatch.username}. Verifique credenciales en Configuración AES.`;
            session.screenshot = ss ? `data:image/png;base64,${ss.toString('base64')}` : null;
            pushSystemAlert({
                type: 'error',
                title: `❌ Login Fallido en ${session.shortName}`,
                message: `No se pudo iniciar sesión en OnBase con el usuario ${currentBatch.username}.`,
                botKey: session.botKey,
                sendMobile: true,
                screenshotB64: session.screenshot
            });
            return;
        }

        // ── SI ES MÓDULO DE DESERCIONES ──
        if (action === 'deserciones_onbase_cargue' || stop_at_step === 3) {
            setBotStep(session, 'PASO 3: Selección de UForm Comunicación Electrónica');
            session.logs.push(`${botTag} [DESERCIONES] Abriendo "COMUNICACIONES PRODUCIDAS" -> "UForm Comunicacion Electronica"...`);

            await paso3_uformComunicacionElectronica(page, browser, session.logs);

            if (stop_at_step === 3) {
                session.logs.push(`${botTag} [INFO] ✅ Formulario "UForm Comunicación Electrónica" cargado en pantalla.`);
                return;
            }

            setBotStep(session, 'PASO 4: Diligenciamiento de Formulario de Comunicación');
            let casosToLoad = [];

            if (casos_data && Array.isArray(casos_data) && casos_data.length > 0) {
                casosToLoad = casos_data;
            } else if (caso_ids && Array.isArray(caso_ids) && caso_ids.length > 0) {
                const validNumIds = caso_ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
                if (validNumIds.length > 0) {
                    const placeholders = validNumIds.map((_, i) => `$${i + 1}`).join(',');
                    const qRes = await pool.query(`SELECT * FROM deserciones_casos WHERE id IN (${placeholders})`, validNumIds).catch(() => ({ rows: [] }));
                    casosToLoad = qRes.rows || [];
                }
            }

            if (casosToLoad.length === 0) {
                const qRes = await pool.query(`SELECT * FROM deserciones_casos WHERE status = 'Pendiente' ORDER BY id ASC LIMIT 50`).catch(() => ({ rows: [] }));
                casosToLoad = qRes.rows || [];
            }

            session.totalDocs = casosToLoad.length;
            for (let cIdx = 0; cIdx < casosToLoad.length; cIdx++) {
                if (!session.running) break;
                const casoItem = casosToLoad[cIdx];
                session.currentDocName = casoItem.aprendiz_nombre || `Caso #${casoItem.id}`;
                const maxAttempts = 2;
                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    try {
                        if (cIdx > 0 || attempt > 1) {
                            await paso3_uformComunicacionElectronica(page, browser, session.logs);
                            await wait(1000);
                        }
                        await paso4_diligenciarComunicacionElectronica(page, browser, casoItem, session.logs, { solo_diligenciar: !!solo_diligenciar });
                        await pool.query(`UPDATE deserciones_casos SET status = 'Cargado', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [casoItem.id]).catch(() => {});
                        session.processedDocs = cIdx + 1;
                        break;
                    } catch (caseErr) {
                        await checkAndClearLocks(browser, session.logs).catch(() => {});
                        if (attempt < maxAttempts) await wait(3000);
                    }
                }
            }
            return;
        }

        // ── AGRUPAR POR SUBCATEGORÍA (SUBSERIE DOCUMENTAL TRD) Y EJECUTAR POR OLEADAS DE TIPOLOGÍA + ESPERA 3 MIN + VERIFICACIÓN ONBASE ──
        const normTypKey = (t, filename = '') => {
            const base = String(t || '')
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/^[0-9]+\s*[._)-]\s*/, '')
                .replace(/_[0-9]+$/, '')
                .toUpperCase()
                .replace(/[^A-Z0-9\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            const suffixMatch = String(filename || '').match(/_([2-9]|[1-9][0-9]+)(?=\.[^.]+$|$)/);
            return suffixMatch ? `${base}__ANEXO_${suffixMatch[1]}` : base;
        };

        // 1. Pre-filtro Anti-Duplicados contra BD (verificar qué tipologías/archivos ya están Cargados en cada expediente)
        const expIdsInBatch = [...new Set(batchDocs.map(d => d.expediente_id).filter(Boolean))];
        const alreadyLoadedTypByExp = new Map();
        if (expIdsInBatch.length > 0) {
            try {
                const loadedRes = await pool.query(
                    `SELECT expediente_id, typology_name, filename FROM documents WHERE expediente_id = ANY($1::int[]) AND status = 'Cargado'`,
                    [expIdsInBatch]
                );
                for (const r of (loadedRes.rows || [])) {
                    if (!alreadyLoadedTypByExp.has(r.expediente_id)) {
                        alreadyLoadedTypByExp.set(r.expediente_id, new Set());
                    }
                    const tk = normTypKey(r.typology_name || r.filename, r.filename);
                    if (tk) alreadyLoadedTypByExp.get(r.expediente_id).add(tk);
                }
            } catch {}
        }

        // Filtrar documentos duplicados dentro del mismo lote o cuya tipología/archivo ya figure Cargada en el expediente
        const seenInBatchByExp = new Map();
        const deduplicatedDocs = [];
        for (const d of batchDocs) {
            const expKey = d.expediente_id || d.expediente_code || `DOC_${d.id}`;
            const tk = normTypKey(d.typology_name || d.filename, d.filename);
            if (!seenInBatchByExp.has(expKey)) seenInBatchByExp.set(expKey, new Set());
            const batchSet = seenInBatchByExp.get(expKey);
            const loadedSet = d.expediente_id ? alreadyLoadedTypByExp.get(d.expediente_id) : null;

            if (tk && loadedSet && loadedSet.has(tk)) {
                session.logs.push(`${botTag} 🛡️ [ANTI-DUPLICADO] Omitiendo "${d.filename}" (${d.typology_name || 'Sin tipología'}) en expediente "${d.expediente_code || expKey}": esta tipología ya figura como Cargada en AES.`);
                activeDocLocks.delete(d.id);
                continue;
            }
            if (tk && batchSet.has(tk)) {
                session.logs.push(`${botTag} 🛡️ [ANTI-DUPLICADO] Omitiendo documento repetido "${d.filename}" en el mismo lote para expediente "${d.expediente_code || expKey}".`);
                activeDocLocks.delete(d.id);
                continue;
            }
            if (tk) batchSet.add(tk);
            deduplicatedDocs.push(d);
        }

        session.totalDocs = deduplicatedDocs.length;
        session.processedDocs = 0;

        // 2. Ordenar y agrupar por Subcategoría de Subserie Documental TRD -> luego por Expediente -> luego por Orden de Tipología TRD
        const subserieGroupsMap = new Map();
        const sortedDocs = [...deduplicatedDocs].sort((a, b) => {
            const subA = String(a.subserie || a.subseries_code || a.series_code || 'ZZZZ').trim();
            const subB = String(b.subserie || b.subseries_code || b.series_code || 'ZZZZ').trim();
            if (subA !== subB) return subA.localeCompare(subB, undefined, { numeric: true });
            const ordA = Number(a.typology_order ?? 9999);
            const ordB = Number(b.typology_order ?? 9999);
            if (ordA !== ordB) return ordA - ordB;
            const expA = String(a.expediente_code || a.expediente_id || '').trim();
            const expB = String(b.expediente_code || b.expediente_id || '').trim();
            if (expA !== expB) return expA.localeCompare(expB, undefined, { numeric: true });
            return (a.id || 0) - (b.id || 0);
        });

        for (const d of sortedDocs) {
            const subCode = String(d.subserie || d.subseries_code || d.series_code || 'SIN-SUBSERIE').trim();
            const subName = String(d.subseries_name || d.series_name || '').trim();
            if (!subserieGroupsMap.has(subCode)) {
                subserieGroupsMap.set(subCode, {
                    subserieCode: subCode,
                    subserieName: subName,
                    expedientesMap: new Map()
                });
            }
            const subGrp = subserieGroupsMap.get(subCode);
            const expKey = (d.expediente_code && String(d.expediente_code).trim()) || `EXP_ID_${d.expediente_id || d.id}`;
            if (!subGrp.expedientesMap.has(expKey)) {
                subGrp.expedientesMap.set(expKey, {
                    expedienteCode: d.expediente_code ? String(d.expediente_code).trim() : '',
                    expedienteId: d.expediente_id || null,
                    subserieCode: subCode,
                    docs: [],
                    uploadedDocs: []
                });
            }
            subGrp.expedientesMap.get(expKey).docs.push(d);
        }

        // Asegurar que dentro de cada expediente sus documentos estén estrictamente ordenados de la 1ra a la última tipología TRD
        const subserieGroups = Array.from(subserieGroupsMap.values()).map(sg => {
            const exps = Array.from(sg.expedientesMap.values());
            exps.forEach(exp => {
                exp.docs.sort((a, b) => {
                    const ordA = Number(a.typology_order ?? 9999);
                    const ordB = Number(b.typology_order ?? 9999);
                    if (ordA !== ordB) return ordA - ordB;
                    return (a.id || 0) - (b.id || 0);
                });
            });
            return {
                subserieCode: sg.subserieCode,
                subserieName: sg.subserieName,
                expedientes: exps
            };
        });

        session.logs.push(`${botTag} 🗂️ Lote organizado en ${subserieGroups.length} Subserie(s) Documental(es) TRD (${deduplicatedDocs.length} documento(s) únicos).`);
        session.logs.push(`${botTag} 🔄 Modo activo: Cargue Horizontal por Oleadas de Tipología -> Espera 3 min de indexación OnBase -> Verificación SGDEA Expediente.`);

        formPage = page;
        formFrame = page.mainFrame();

        // Función auxiliar que sube 1 documento a OnBase con hasta 2 intentos y control anti-duplicado
        const uploadSingleDocToOnBase = async (docInfo, docLabel, hasMoreInBatch) => {
            // Doble chequeo en BD justo antes de subir para garantizar 0 duplicados
            if (docInfo?.id) {
                try {
                    const stCheck = await pool.query(`SELECT status FROM documents WHERE id = $1 LIMIT 1`, [docInfo.id]);
                    if (stCheck.rows?.[0]?.status === 'Cargado') {
                        session.logs.push(`${botTag} 🛡️ [ANTI-DUPLICADO] El documento #${docInfo.id} ("${docInfo.filename}") ya está marcado como Cargado. Saltando...`);
                        activeDocLocks.delete(docInfo.id);
                        return true;
                    }
                } catch {}
            }

            const maxDocAttempts = 2;
            for (let attempt = 1; attempt <= maxDocAttempts; attempt++) {
                try {
                    const stuckState = await isPageStuckOrCloseWindow(session.page || page, browser);
                    if (stuckState.stuck) {
                        session.logs.push(`${botTag} [${docLabel}] 🔄 Explorador trabado detectado (${stuckState.reason}). Cerrando y abriendo explorador nuevamente...`);
                        await launchOrRestartBotBrowser(stuckState.reason);
                    } else if (attempt > 1) {
                        session.logs.push(`${botTag} [${docLabel}] 🔄 Reintentando documento (intento ${attempt}/${maxDocAttempts}) — Reiniciando explorador para limpiar sesión...`);
                        await launchOrRestartBotBrowser(`Reintento ${attempt}/${maxDocAttempts} en ${docInfo?.expediente_code || 'expediente'}`);
                    }

                    // PASO 2: FORMULARIO SGDEA
                    setBotStep(session, `[${docLabel}] PASO 2: Formulario SGDEA (${docInfo.expediente_code || ''})`);
                    await paso2_abrirFormulario(page, browser, session.logs, true);
                    await wait(1000);

                    // PASO 3: CÓDIGO DE EXPEDIENTE
                    setBotStep(session, `[${docLabel}] PASO 3: Código de Expediente (${docInfo.expediente_code || ''})`);
                    if (docInfo?.expediente_code) {
                        let result = await paso3_codigoExpediente(page, browser, docInfo.expediente_code, session.logs);
                        if (!result || !result.success) {
                            const midStuck = await isPageStuckOrCloseWindow(session.page || page, browser);
                            if (midStuck.stuck) {
                                await launchOrRestartBotBrowser(midStuck.reason);
                            }
                            await paso2_abrirFormulario(page, browser, session.logs, true);
                            await wait(1500);
                            result = await paso3_codigoExpediente(page, browser, docInfo.expediente_code, session.logs);
                        }
                        if (!result || !result.success) {
                            throw new Error("No se pudo escribir el Código de Expediente o no se encontró el campo.");
                        }
                        if (result?.formPage) {
                            if (result.formPage !== formPage) {
                                attachScreencastToPage(result.formPage).catch(() => {});
                            }
                            formPage = result.formPage;
                            session.page = formPage;
                        }
                        if (result?.formFrame) formFrame = result.formFrame;
                    }

                    // PASO 4: LLENAR CAMPOS
                    setBotStep(session, `[${docLabel}] PASO 4: Llenar Campos (${docInfo.filename?.substring(0, 28)})`);
                    if (docInfo) {
                        await paso4_llenarCampos(formPage, formFrame, docInfo, session.logs);
                    }
                    await wait(500);

                    // PASO 5: ADJUNTAR PDF
                    setBotStep(session, `[${docLabel}] PASO 5: Adjuntar PDF`);
                    if (docInfo?.path || docInfo?.storage_path) {
                        const attachOk = await paso5_adjuntarPDF(formPage || page, allFrames, docInfo, session.logs);
                        if (!attachOk) {
                            throw new Error("Fallo al adjuntar el archivo PDF.");
                        }
                    }

                    // PASO 6: GUARDAR
                    setBotStep(session, `[${docLabel}] PASO 6: Guardar en OnBase`);
                    const saveOk = await paso6_guardar(formPage || page, allFrames, session.logs, hasMoreInBatch);
                    if (!saveOk) {
                        throw new Error("El guardado falló o el botón Guardar no estuvo disponible.");
                    }

                    if (docInfo?.id) {
                        await new Promise(resolve => {
                            db.run(
                                'UPDATE documents SET status = ?, load_date = ? WHERE id = ?',
                                ['Cargado', new Date().toISOString(), docInfo.id],
                                () => resolve()
                            );
                        });
                        activeDocLocks.delete(docInfo.id);
                    }
                    return true;
                } catch (docErr) {
                    session.logs.push(`${botTag} [ERROR ${docLabel}] (Intento ${attempt}/${maxDocAttempts}) "${docInfo?.filename || 'doc'}": ${docErr.message}`);
                    await checkAndClearLocks(browser, session.logs).catch(() => {});
                    if (attempt === maxDocAttempts) {
                        if (docInfo?.id) activeDocLocks.delete(docInfo.id);
                        return false;
                    }
                    await wait(2500);
                }
            }
            return false;
        };

        // ── RECORRER SUBCATEGORÍA POR SUBSERIE DOCUMENTAL -> OLEADA DE TIPOLOGÍA #1, #2, #3... ──
        let docsRemainingOverall = deduplicatedDocs.length;
        let docsSinceBrowserRecycle = 0;
        const BROWSER_RECYCLE_EVERY_DOCS = 60; // Reciclaje preventivo de Chromium para lotes masivos (4000+ expedientes)

        for (let sIdx = 0; sIdx < subserieGroups.length; sIdx++) {
            if (!session.running) break;
            const subGrp = subserieGroups[sIdx];
            const expsInSub = subGrp.expedientes || [];
            const maxWaves = expsInSub.reduce((max, e) => Math.max(max, e.docs.length), 0);

            session.logs.push(`
╔══════════════════════════════════════════════════════════════════╗`);
            session.logs.push(`${botTag} 🗂️ SUBCATEGORÍA SUBSERIE TRD (${sIdx + 1}/${subserieGroups.length}): "${subGrp.subserieCode}" ${subGrp.subserieName ? `· ${subGrp.subserieName}` : ''}`);
            session.logs.push(`${botTag} 📁 Expedientes en esta Subserie: ${expsInSub.length} | Oleadas de Tipología a ejecutar: ${maxWaves}`);
            session.logs.push(`╚══════════════════════════════════════════════════════════════════╝`);

            for (let waveIdx = 0; waveIdx < maxWaves; waveIdx++) {
                if (!session.running) break;

                // Seleccionar el documento de la Tipología #(waveIdx + 1) de cada expediente de esta subserie
                const waveItems = [];
                for (const expObj of expsInSub) {
                    if (waveIdx < expObj.docs.length) {
                        waveItems.push({
                            expObj,
                            docInfo: expObj.docs[waveIdx]
                        });
                    }
                }

                if (waveItems.length === 0) continue;

                const waveNumber = waveIdx + 1;
                const sampleTypName = waveItems[0]?.docInfo?.typology_name || `Tipología #${waveNumber}`;
                session.logs.push(`
🌊 ════════════════════════════════════════════════════════════════`);
                session.logs.push(`${botTag} 🌊 INICIANDO OLEADA DE TIPOLOGÍA #${waveNumber}/${maxWaves} [Subserie ${subGrp.subserieCode}]`);
                session.logs.push(`${botTag} 📌 Tipología principal de la oleada: "${sampleTypName}" en ${waveItems.length} expediente(s)`);
                session.logs.push(`🌊 ════════════════════════════════════════════════════════════════`);

                const expedientesTouchedInWave = [];

                for (let wIdx = 0; wIdx < waveItems.length; wIdx++) {
                    if (!session.running) break;
                    const { expObj, docInfo } = waveItems[wIdx];
                    docsRemainingOverall = Math.max(0, docsRemainingOverall - 1);
                    const hasMoreOverall = docsRemainingOverall > 0;

                    session.currentExpedienteCode = expObj.expedienteCode || `Exp #${expObj.expedienteId}`;
                    session.currentDocId = docInfo.id;
                    session.currentDocName = docInfo.filename || `Doc #${docInfo.id}`;

                    const docLabel = `Subserie ${subGrp.subserieCode} · Oleada Tipología #${waveNumber}/${maxWaves} · Exp ${wIdx + 1}/${waveItems.length} (${session.currentExpedienteCode})`;

                    session.logs.push(`--------------------------------------------------`);
                    session.logs.push(`${botTag} [${docLabel}] Cargando "${docInfo.typology_name || 'Doc'}" -> Archivo: "${docInfo.filename}"`);
                    session.logs.push(`--------------------------------------------------`);

                    // Tope de seguridad en memoria para logs de lotes masivos (4000+ expedientes / 26000+ docs)
                    if (session.logs.length > 600) {
                        session.logs.splice(0, session.logs.length - 450);
                    }

                    // Reciclaje preventivo de Chromium cada 60 documentos para liberar RAM y caché temporal
                    if (docsSinceBrowserRecycle >= BROWSER_RECYCLE_EVERY_DOCS && session.running) {
                        docsSinceBrowserRecycle = 0;
                        session.logs.push(`${botTag} ♻️ [MANTENIMIENTO RAM] Reciclando explorador preventivamente tras ${BROWSER_RECYCLE_EVERY_DOCS} documentos para mantener memoria óptima...`);
                        await launchOrRestartBotBrowser(`Mantenimiento preventivo de RAM (${BROWSER_RECYCLE_EVERY_DOCS} docs)`);
                    }

                    const uploadedOk = await uploadSingleDocToOnBase(docInfo, docLabel, hasMoreOverall);
                    docsSinceBrowserRecycle += 1;
                    if (uploadedOk) {
                        session.processedDocs += 1;
                        expObj.uploadedDocs.push(docInfo);
                        if (expObj.expedienteCode && !expedientesTouchedInWave.includes(expObj)) {
                            expedientesTouchedInWave.push(expObj);
                        }
                        session.logs.push(`${botTag} ✅ [${docLabel}] Radicado en OnBase (${session.processedDocs}/${session.totalDocs} del lote total)`);
                    }

                    if (wIdx < waveItems.length - 1 && session.running) {
                        await wait(1500);
                    }
                }

                // ── AVANCE CONTINUO SIN PAUSA DE VERIFICADOR AUTOMÁTICO (Revisión manual en pestaña "Verificador") ──
                if (expedientesTouchedInWave.length > 0 && session.running) {
                    session.waitingForVerifier = false;
                    session.skipVerifierWait = false;
                    if (waveNumber < maxWaves) {
                        session.logs.push(`${botTag} ✅ Oleada de Tipología #${waveNumber}/${maxWaves} completada (${expedientesTouchedInWave.length} expediente(s)). Avanzando de inmediato a la Oleada #${waveNumber + 1}/${maxWaves} sin interrupciones...`);
                    } else {
                        session.logs.push(`${botTag} 🎉 Subcategoría Subserie "${subGrp.subserieCode}" completada en todas sus tipologías. Lista para revisión y OK en la pestaña "Verificador".`);
                    }
                }
            }
        }

        // ── PASO 7: CERRAR SESIÓN FINAL DE ESTE BOT ──
        setBotStep(session, 'PASO 7: Cerrar Sesión final');
        await paso7_logout(page, allFrames, session.logs);

        const screenshotBuffer = await page.screenshot({ fullPage: false }).catch(() => null);
        session.screenshot = screenshotBuffer ? `data:image/png;base64,${screenshotBuffer.toString('base64')}` : null;
        session.logs.push(`${botTag} 🎉 Proceso de cargue y verificación completado (${session.processedDocs}/${session.totalDocs} documentos).`);

    } catch (err) {
        session.error = err.message;
        session.logs.push(`${botTag} [ERROR CRÍTICO] ${err.message}`);
    } finally {
        if (Array.isArray(session.documentIds)) {
            session.documentIds.forEach(id => activeDocLocks.delete(id));
        }
        if (browser) {
            await safeForceCloseBrowser(browser, profileDir);
        }
        session.browser = null;
        session.page = null;
        session.running = false;
        session.waitingForVerifier = false;
        session.completed = true;
        session.currentDocId = null;
        automationEmitter.emit('done', session);
    }
}

exports.executeAutomation = async (req, res) => {
    try {
        let {
            url,
            username,
            password,
            documentIds,
            action,
            target_user,
            bot_key,
            stop_at_step,
            caso_ids,
            force_restart
        } = req.body || {};

        const orgRows = await new Promise(resolve => {
            db.all("SELECT id, section_name, subsection_name, section_code, subsection_code, onbase_user, onbase_pass, onbase_username, onbase_password FROM organization_structure", [], (err, rows) => {
                resolve(rows || []);
            });
        });

        const findOrg = (subCode) => {
            return orgRows.find(o => subCode ? o.subsection_code === subCode : (!o.subsection_code || o.subsection_code === '')) || null;
        };

        const orgSub = findOrg('') || { id: 6, section_name: 'Subdirección de Centro', subsection_code: '', onbase_user: 'TVILLAMIZARJ', onbase_pass: 'Sena2026**onbase' };
        const orgAdmin = findOrg('9224.2') || { id: 7, subsection_name: 'Grupo Administración Educativa', subsection_code: '9224.2', onbase_user: 'luepitar', onbase_pass: 'Automatizador2026*' };
        const orgForm = findOrg('9224.4') || { id: 8, subsection_name: 'Grupo de Formación Profesional Integral', subsection_code: '9224.4', onbase_user: 'EDHERNANDEZM', onbase_pass: 'Sena2026**onbase' };

        const getU = (org, fallbackU) => (org?.onbase_user || org?.onbase_username || fallbackU).trim();
        const getP = (org, fallbackP) => (org?.onbase_pass || org?.onbase_password || fallbackP).trim();

        botSessions['9224'].onbaseUser = getU(orgSub, 'TVILLAMIZARJ');
        botSessions['9224.4'].onbaseUser = getU(orgForm, 'EDHERNANDEZM');
        botSessions['9224.2'].onbaseUser = getU(orgAdmin, 'luepitar');

        const resolveDocCreds = (doc) => {
            const explicitTarget = bot_key || (target_user && target_user !== 'auto' ? target_user : null);
            if (explicitTarget) {
                const tu = String(explicitTarget).toLowerCase().trim();
                if (tu.includes('edhernandezm') || tu.includes('formacion') || tu.includes('9224.4')) {
                    return {
                        depKey: '9224.4',
                        depName: orgForm.subsection_name || 'Grupo de Formación Profesional Integral',
                        depCode: '9224.4',
                        username: getU(orgForm, 'EDHERNANDEZM'),
                        password: getP(orgForm, 'Sena2026**onbase'),
                        rule: 'Bot 2 · Formación Profesional (9224.4)'
                    };
                }
                if (tu.includes('luepitar') || tu.includes('administracion') || tu.includes('9224.2')) {
                    return {
                        depKey: '9224.2',
                        depName: orgAdmin.subsection_name || 'Grupo Administración Educativa',
                        depCode: '9224.2',
                        username: getU(orgAdmin, 'luepitar'),
                        password: getP(orgAdmin, 'Automatizador2026*'),
                        rule: 'Bot 3 · Administración Educativa (9224.2)'
                    };
                }
                if (tu.includes('tvillamizar') || tu.includes('jrrozo') || tu.includes('subdireccion') || tu.includes('9224')) {
                    return {
                        depKey: '9224',
                        depName: orgSub.section_name || 'Subdirección de Centro',
                        depCode: '9224',
                        username: getU(orgSub, 'TVILLAMIZARJ'),
                        password: getP(orgSub, 'Sena2026**onbase'),
                        rule: 'Bot 1 · Subdirección de Centro (9224)'
                    };
                }
            }

            if (!doc) {
                return {
                    depKey: '9224.4',
                    depName: orgForm.subsection_name || 'Grupo de Formación Profesional Integral',
                    depCode: '9224.4',
                    username: username || getU(orgForm, 'EDHERNANDEZM'),
                    password: password || getP(orgForm, 'Sena2026**onbase'),
                    rule: 'General / Sin documento'
                };
            }

            const text = `${doc.subserie || ''} ${doc.subseries_code || ''} ${doc.series_code || ''} ${doc.expediente_code || ''} ${doc.filename || ''}`.toUpperCase();

            if (text.includes('9224.4') || text.includes('68.9224.4') || doc.organization_id === 8 || doc.series_dep_id === 8) {
                return {
                    depKey: '9224.4',
                    depName: orgForm.subsection_name || 'Grupo de Formación Profesional Integral',
                    depCode: '9224.4',
                    username: getU(orgForm, 'EDHERNANDEZM'),
                    password: getP(orgForm, 'Sena2026**onbase'),
                    rule: 'TRD 9224.4 (Formación Profesional Integral)'
                };
            }

            if (text.includes('9224.2') || text.includes('68.9224.2') || doc.organization_id === 7 || doc.series_dep_id === 7) {
                return {
                    depKey: '9224.2',
                    depName: orgAdmin.subsection_name || 'Grupo Administración Educativa',
                    depCode: '9224.2',
                    username: getU(orgAdmin, 'luepitar'),
                    password: getP(orgAdmin, 'Automatizador2026*'),
                    rule: 'TRD 9224.2 (Administración Educativa)'
                };
            }

            if (text.includes('68.9224-') || text.includes('9224-') || text.includes('68.9224/') || doc.organization_id === 6 || doc.series_dep_id === 6) {
                return {
                    depKey: '9224',
                    depName: orgSub.section_name || 'Subdirección de Centro',
                    depCode: '9224',
                    username: getU(orgSub, 'TVILLAMIZARJ'),
                    password: getP(orgSub, 'Sena2026**onbase'),
                    rule: 'TRD 9224 (Subdirección de Centro)'
                };
            }

            if (req.user && req.user.organization_id === 8) {
                return {
                    depKey: '9224.4',
                    depName: orgForm.subsection_name || 'Grupo de Formación Profesional Integral',
                    depCode: '9224.4',
                    username: getU(orgForm, 'EDHERNANDEZM'),
                    password: getP(orgForm, 'Sena2026**onbase'),
                    rule: 'Dependencia del Usuario (Formación)'
                };
            }
            if (req.user && req.user.organization_id === 7) {
                return {
                    depKey: '9224.2',
                    depName: orgAdmin.subsection_name || 'Grupo Administración Educativa',
                    depCode: '9224.2',
                    username: getU(orgAdmin, 'luepitar'),
                    password: getP(orgAdmin, 'Automatizador2026*'),
                    rule: 'Dependencia del Usuario (Adm. Educativa)'
                };
            }

            return {
                depKey: '9224',
                depName: orgSub.section_name || 'Subdirección de Centro',
                depCode: '9224',
                username: username || getU(orgSub, 'TVILLAMIZARJ'),
                password: password || getP(orgSub, 'Sena2026**onbase'),
                rule: 'Fallback General (Subdirección)'
            };
        };

        let docsToProcess = [];
        if (Array.isArray(documentIds) && documentIds.length > 0) {
            try {
                const validDocIds = documentIds.map(x => parseInt(x, 10)).filter(x => Number.isInteger(x) && x > 0);
                const [typCatRes, serCatRes, subCatRes, docsQueryRes] = await Promise.all([
                    pool.query('SELECT id, series_id, subseries_id, typology_name, onbase_name FROM trd_typologies ORDER BY id ASC'),
                    pool.query('SELECT id, series_code, series_name, dependency_id FROM trd_series'),
                    pool.query('SELECT id, series_id, subseries_code, subseries_name FROM trd_subseries'),
                    pool.query(`
                        SELECT d.*, e.expediente_code, e.title as exp_title, e.opening_date, e.subserie, e.metadata_values as exp_meta
                        FROM documents d
                        LEFT JOIN expedientes e ON d.expediente_id = e.id
                        WHERE d.id = ANY($1::int[])
                    `, [validDocIds])
                ]);

                const serById = new Map();
                const serByCode = new Map();
                for (const s of (serCatRes.rows || [])) {
                    serById.set(s.id, s);
                    if (s.series_code) serByCode.set(String(s.series_code).trim(), s);
                }

                const subById = new Map();
                const subList = subCatRes.rows || [];
                for (const sb of subList) subById.set(sb.id, sb);

                const cleanTypStr = (s) => String(s || '').trim().replace(/^[0-9]+\s*[._)-]\s*/, '').replace(/_[0-9]+$/, '').trim().toLowerCase();
                const typMinIdByClean = new Map();
                const typRowsAll = (typCatRes.rows || []).map(t => {
                    const cl = cleanTypStr(t.typology_name);
                    if (cl && (!typMinIdByClean.has(cl) || t.id < typMinIdByClean.get(cl))) {
                        typMinIdByClean.set(cl, t.id);
                    }
                    return { ...t, _clean: cl };
                });

                const rawRows = (docsQueryRes.rows || []).map(r => {
                    const eSub = String(r.subserie || '').trim();
                    let subObj = r.trd_subseries_id ? subById.get(r.trd_subseries_id) : null;
                    if (!subObj && eSub) {
                        subObj = subList.find(sb => sb.subseries_code === eSub || eSub.toUpperCase().endsWith('-' + String(sb.subseries_code || '').toUpperCase())) || null;
                    }
                    let serObj = r.trd_series_id ? serById.get(r.trd_series_id) : (subObj ? serById.get(subObj.series_id) : null);
                    if (!serObj && eSub) {
                        serObj = serByCode.get(eSub) || null;
                    }

                    const dClean = cleanTypStr(r.typology_name);
                    const typOrder = (dClean && typMinIdByClean.has(dClean)) ? typMinIdByClean.get(dClean) : 9999;

                    let matchedOnbase = null;
                    if (dClean) {
                        const candidates = typRowsAll.filter(t =>
                            t.onbase_name && String(t.onbase_name).trim() !== '' &&
                            (t._clean === dClean || dClean.includes(t._clean) || (t._clean.length >= 4 && t._clean.includes(dClean)))
                        );
                        if (candidates.length > 0) {
                            candidates.sort((a, b) => {
                                const aSer = (a.series_id === r.trd_series_id || a.subseries_id === r.trd_subseries_id) ? 0 : 1;
                                const bSer = (b.series_id === r.trd_series_id || b.subseries_id === r.trd_subseries_id) ? 0 : 1;
                                if (aSer !== bSer) return aSer - bSer;
                                const aEx = a._clean === dClean ? 0 : 1;
                                const bEx = b._clean === dClean ? 0 : 1;
                                return aEx - bEx;
                            });
                            matchedOnbase = candidates[0].onbase_name;
                        }
                    }

                    return {
                        ...r,
                        series_code: serObj?.series_code || null,
                        series_name: serObj?.series_name || null,
                        series_dep_id: serObj?.dependency_id || null,
                        subseries_code: subObj?.subseries_code || null,
                        subseries_name: subObj?.subseries_name || null,
                        typology_order: typOrder,
                        typology_onbase_name: matchedOnbase
                    };
                });

                rawRows.sort((a, b) => {
                    const sa = String(a.subserie || '').trim() || 'ZZZZ';
                    const sb = String(b.subserie || '').trim() || 'ZZZZ';
                    if (sa !== sb) return sa.localeCompare(sb);
                    if (a.typology_order !== b.typology_order) return a.typology_order - b.typology_order;
                    const ea = String(a.expediente_code || '').trim() || 'ZZZZ';
                    const eb = String(b.expediente_code || '').trim() || 'ZZZZ';
                    if (ea !== eb) return ea.localeCompare(eb);
                    return (a.id || 0) - (b.id || 0);
                });

                const rows = rawRows;

                docsToProcess = rows.map(r => {
                    let meta = {};
                    try { meta = typeof r.exp_meta === 'string' ? JSON.parse(r.exp_meta) : (r.exp_meta || {}); } catch {}
                    let docMeta = {};
                    try { docMeta = typeof r.metadata_values === 'string' ? JSON.parse(r.metadata_values) : (r.metadata_values || {}); } catch {}
                    const combinedMeta = { ...meta, ...docMeta };

                    const metaString = [1, 2, 3, 4, 5, 6, 7, 8]
                        .map(i => combinedMeta[`valor${i}`] || combinedMeta[`Metadato ${i}`] || '')
                        .map(v => String(v).trim())
                        .filter(Boolean)
                        .join(' ')
                        .trim();

                    const joinedName = metaString || r.exp_title || r.filename;
                    const catalogTyp = findCatalogOnBaseTypology(r.typology_name);
                    const aesTypology = catalogTyp || r.typology_onbase_name || null;

                    return {
                        ...r,
                        joinedName,
                        parsedMeta: combinedMeta,
                        onbase_name: aesTypology || null
                    };
                });
            } catch (e) {
                console.error('[WARN] Error cargando lista de documentos:', e.message);
            }
        }

        const depBatches = [];
        const skippedLockedIds = [];

        if (docsToProcess.length > 0) {
            const groupMap = new Map();
            for (const doc of docsToProcess) {
                if (activeDocLocks.has(doc.id) && !force_restart) {
                    skippedLockedIds.push(doc.id);
                    continue;
                }
                const creds = resolveDocCreds(doc);
                const bKey = resolveBotKey(creds.depKey);
                if (!groupMap.has(bKey)) {
                    groupMap.set(bKey, {
                        ...creds,
                        depKey: bKey,
                        docs: []
                    });
                }
                groupMap.get(bKey).docs.push(doc);
            }
            for (const b of groupMap.values()) {
                depBatches.push(b);
            }
        } else {
            const defaultCreds = resolveDocCreds(null);
            const bKey = resolveBotKey(defaultCreds.depKey);
            depBatches.push({
                ...defaultCreds,
                depKey: bKey,
                docs: []
            });
        }

        const launchedBots = [];
        const busyBots = [];
        const combinedInitialLogs = [];

        for (const batch of depBatches) {
            const bKey = resolveBotKey(batch.depKey);
            const session = botSessions[bKey];

            if (session.running) {
                if (force_restart) {
                    await stopSingleBotSession(session, 'Reiniciado por nueva ejecución');
                } else {
                    busyBots.push({
                        botKey: bKey,
                        label: session.label,
                        onbaseUser: session.onbaseUser
                    });
                    session.logs.push(`[INFO] ⚠️ Solicitud adicional ignorada: este Bot (${session.onbaseUser}) ya está ejecutando un lote activo (${session.processedDocs}/${session.totalDocs}).`);
                    continue;
                }
            }

            const batchDocIds = (batch.docs || []).map(d => d.id);
            batchDocIds.forEach(id => activeDocLocks.add(id));

            const jobId = `${Date.now()}_${bKey}`;
            session.running = true;
            session.waitingForVerifier = false;
            session.jobId = jobId;
            session.onbaseUser = batch.username;
            setBotStep(session, `Iniciando ${session.shortName} (${batch.username})...`);
            session.logs = [
                `[INFO] 🤖 ${session.label} activado con usuario OnBase "${batch.username}".`,
                `[INFO] 📦 Lote asignado a este Bot: ${batchDocIds.length} documento(s) con Verificación Relevo al 50% y 100%.`
            ];
            if (skippedLockedIds.length > 0) {
                session.logs.push(`[INFO] 🔒 ${skippedLockedIds.length} documento(s) omitidos porque ya están siendo procesados por otro Bot.`);
            }
            session.error = null;
            session.completed = false;
            session.screenshot = null;
            session.liveFrame = null;
            session.liveBuffer = null;
            session.startTime = new Date().toISOString();
            session.lastStepChangeAt = Date.now();
            session.stepStuckSeconds = 0;
            session.documentIds = batchDocIds;
            session.totalDocs = batchDocIds.length;
            session.processedDocs = 0;
            session.currentDocId = null;
            session.currentDocName = '';

            currentJob = session;
            launchedBots.push({
                botKey: bKey,
                jobId,
                label: session.label,
                onbaseUser: batch.username,
                docsCount: batchDocIds.length
            });
            combinedInitialLogs.push(...session.logs);

            runIndependentBotWorker(session, batch, {
                url,
                action,
                stop_at_step,
                caso_ids,
                casos_data: req.body.casos_data,
                solo_diligenciar: req.body.solo_diligenciar
            }).catch(unhandledErr => {
                console.error(`[BOT ${bKey} UNHANDLED ERROR]`, unhandledErr);
                session.running = false;
                session.completed = true;
                session.error = unhandledErr.message;
                session.logs.push(`[ERROR CRÍTICO INESPERADO] ${unhandledErr.message}`);
            });
        }

        return res.json({
            success: true,
            launchedBots,
            busyBots,
            activeBotKey: launchedBots[0]?.botKey || busyBots[0]?.botKey || '9224.4',
            jobId: launchedBots[0]?.jobId || currentJob?.jobId,
            message: launchedBots.length > 1
                ? `¡${launchedBots.length} Bots iniciados simultáneamente con Verificador de Expedientes al 50% y 100%!`
                : launchedBots.length === 1
                    ? `${launchedBots[0].label} (${launchedBots[0].onbaseUser}) iniciado con Verificador al 50% y 100%.`
                    : `Los Bots solicitados ya se encuentran en ejecución.`,
            logs: combinedInitialLogs,
            bots: buildBotsStatusMap()
        });
    } catch (routeErr) {
        console.error('[EXECUTE AUTOMATION ROUTE ERROR]', routeErr);
        return res.status(500).json({
            success: false,
            error: routeErr.message || 'Error interno al iniciar la automatización'
        });
    }
};

// ─────────────────────────────────────────────────────────────────
// NUEVOS ENDPOINTS: BOT VERIFICADOR INDEPENDIENTE, DESBLOQUEO REMOTO Y ALERTAS MÓVIL/PC
// ─────────────────────────────────────────────────────────────────
exports.verifyExpedientesOnBase = async (req, res) => {
    try {
        const { expedienteCodes, expedienteIds, url, target_user } = req.body || {};
        let codesToVerify = Array.isArray(expedienteCodes) ? expedienteCodes.filter(Boolean) : [];

        if (codesToVerify.length === 0 && Array.isArray(expedienteIds) && expedienteIds.length > 0) {
            const validIds = expedienteIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
            if (validIds.length > 0) {
                const qRes = await pool.query(`SELECT DISTINCT expediente_code FROM expedientes WHERE id = ANY($1::int[]) AND expediente_code IS NOT NULL`, [validIds]);
                codesToVerify = (qRes.rows || []).map(r => r.expediente_code).filter(Boolean);
            }
        }

        if (codesToVerify.length === 0) {
            // Tomar los últimos 5 expedientes con documentos Cargados pendientes de verificar
            const qRes = await pool.query(`
                SELECT DISTINCT e.expediente_code
                FROM documents d
                INNER JOIN expedientes e ON d.expediente_id = e.id
                WHERE d.status = 'Cargado' AND COALESCE(d.onbase_verified, 0) < 2 AND e.expediente_code IS NOT NULL
                LIMIT 5
            `);
            codesToVerify = (qRes.rows || []).map(r => r.expediente_code).filter(Boolean);
        }

        if (codesToVerify.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Seleccione al menos un expediente con código válido para verificar en OnBase.'
            });
        }

        // Lanzar el Bot Verificador Independiente en segundo plano y responder de inmediato
        runStandaloneVerifierBot({
            expedienteCodes: codesToVerify,
            url,
            targetUser: target_user,
            triggerSource: 'Verificación Manual Solicitada'
        }).catch(err => console.error('[VERIFY-EXP-ERR]', err));

        return res.json({
            success: true,
            activeBotKey: 'VERIFICADOR',
            expedienteCodes: codesToVerify,
            message: `🔍 Bot Verificador Independiente iniciado para auditar ${codesToVerify.length} expediente(s) en OnBase (${codesToVerify.join(', ')}).`,
            bots: buildBotsStatusMap()
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};

exports.getVerificationReport = async (req, res) => {
    try {
        const dbLogsRes = await pool.query(`SELECT * FROM onbase_verification_logs ORDER BY id DESC LIMIT 40`).catch(() => ({ rows: [] }));
        return res.json({
            success: true,
            autoVerifyEvery5Min: alertSettings.autoVerifyEvery5Min,
            nextAutoVerifyAt: alertSettings.nextAutoVerifyAt,
            alerts: systemAlerts.slice(0, 30),
            history: verificationHistory.length > 0 ? verificationHistory : (dbLogsRes.rows || []),
            bots: buildBotsStatusMap()
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};

exports.toggleAutoVerify = async (req, res) => {
    try {
        const { enabled } = req.body || {};
        alertSettings.autoVerifyEvery5Min = enabled !== undefined ? !!enabled : !alertSettings.autoVerifyEvery5Min;
        alertSettings.nextAutoVerifyAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        await pool.query(
            `INSERT INTO system_settings (key, value) VALUES ('onbase_alert_settings', $1)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
            [JSON.stringify(alertSettings)]
        ).catch(() => {});
        return res.json({
            success: true,
            autoVerifyEvery5Min: alertSettings.autoVerifyEvery5Min,
            nextAutoVerifyAt: alertSettings.nextAutoVerifyAt,
            message: alertSettings.autoVerifyEvery5Min
                ? '✅ Verificación automática cada 5 minutos ACTIVADA.'
                : '⏸️ Verificación automática cada 5 minutos PAUSADA.'
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};

exports.unlockBotSession = async (req, res) => {
    try {
        const { bot } = req.body || {};
        const key = resolveBotKey(bot || '9224.4');
        const session = botSessions[key];
        const result = await performBotUnlockProcedure(session, 'Trámite de desbloqueo remoto solicitado por el Director');
        return res.json({
            ...result,
            botKey: key,
            bots: buildBotsStatusMap()
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};

exports.skipVerifierWait = async (req, res) => {
    try {
        const { bot } = req.body || {};
        let skippedAny = false;
        for (const k of ['9224', '9224.4', '9224.2']) {
            if (!bot || bot === 'all' || resolveBotKey(bot) === k) {
                if (botSessions[k].waitingForVerifier) {
                    botSessions[k].skipVerifierWait = true;
                    skippedAny = true;
                }
            }
        }
        return res.json({
            success: true,
            skipped: skippedAny,
            message: skippedAny
                ? '⚡ Espera de 3 minutos adelantada. El Verificador ingresará a OnBase de inmediato.'
                : 'No había espera activa en este momento.',
            bots: buildBotsStatusMap()
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};

exports.getAlertSettings = async (req, res) => {
    return res.json({
        success: true,
        settings: alertSettings
    });
};

exports.saveAlertSettings = async (req, res) => {
    try {
        const incoming = req.body || {};
        alertSettings = {
            ...alertSettings,
            ...incoming
        };
        await pool.query(
            `INSERT INTO system_settings (key, value) VALUES ('onbase_alert_settings', $1)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
            [JSON.stringify(alertSettings)]
        ).catch(() => {});
        return res.json({
            success: true,
            settings: alertSettings,
            message: '✅ Configuración de alertas a Móvil y Equipo guardada exitosamente.'
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};

exports.sendTestAlert = async (req, res) => {
    try {
        const alertObj = pushSystemAlert({
            type: 'info',
            title: '📲 Prueba de Alerta SENA CIMI (Móvil y Equipo)',
            message: 'Conexión de notificaciones activa: Recibirás avisos aquí cuando un expediente se verifique al 50%/100% o si OnBase requiere desbloqueo.',
            expedienteCode: 'TEST-EXP-2026',
            botKey: 'VERIFICADOR',
            sendMobile: true
        });
        return res.json({
            success: true,
            alert: alertObj,
            message: '✅ Alerta de prueba enviada al Sistema, Móvil (Ntfy/Telegram) y Correo.'
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};

exports.clearSystemAlerts = async (req, res) => {
    systemAlerts.length = 0;
    return res.json({ success: true });
};

// ─────────────────────────────────────────────────────────────────
// STREAMING DE FRAMES (pantalla en tiempo real en el frontend)
// ─────────────────────────────────────────────────────────────────
exports.streamAutomation = (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Content-Encoding': 'none'
    });
    if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
    }

    res.write(': sse connected\n\n');

    const heartbeat = setInterval(() => {
        try {
            res.write(': heartbeat\n\n');
        } catch (e) {
            clearInterval(heartbeat);
        }
    }, 4000);

    const sendFrame = data => {
        try {
            res.write(`data: ${data}\n\n`);
        } catch (e) { }
    };

    automationEmitter.on('frame', sendFrame);

    req.on('close', () => {
        clearInterval(heartbeat);
        automationEmitter.removeListener('frame', sendFrame);
    });
};

// ─────────────────────────────────────────────────────────────────
// UNITY AUTOMATION (sin cambios)
// ─────────────────────────────────────────────────────────────────
exports.executeUnityAutomation = async (req, res) => {
    const { action } = req.body;
    const logs = [`[UNITY] Iniciando: ${action}`];
    try {
        exec(`powershell -Command "Get-Process 'OnBase' -ErrorAction SilentlyContinue"`,
            (error, stdout) => {
                if (error) return res.status(500).json({ error: error.message, logs });
                logs.push(`[UNITY] ${stdout.trim()}`);
                res.json({ message: 'Comando enviado', logs });
            }
        );
    } catch (err) {
        res.status(500).json({ error: err.message, logs });
    }
};

// ─────────────────────────────────────────────────────────────────
// DIAGNÓSTICO: inspeccionar el formulario real de OnBase
// ─────────────────────────────────────────────────────────────────
exports.executeDiagnostic = async (req, res) => {
    const { url, username, password } = req.body;
    const logs = [];

    if (!url || !username || !password) {
        return res.status(400).json({ error: 'Faltan: url, username, password' });
    }

    let browser;
    const diagProfileDir = path.join(resolvePuppeteerBaseTmpDir(), 'puppeteer_aes_bot_DIAG');
    try {
        try {
            fs.rmSync(diagProfileDir, { recursive: true, force: true });
            fs.mkdirSync(diagProfileDir, { recursive: true });
        } catch {}
        browser = await puppeteer.launch(buildPuppeteerLaunchOptions(diagProfileDir));

        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 900 });

        const loginOk = await paso1_login(page, url, username, password, logs);
        if (!loginOk) {
            await safeForceCloseBrowser(browser, diagProfileDir);
            return res.status(500).json({ error: 'Login fallido', logs });
        }

        await paso2_abrirFormulario(page, browser, logs);
        await wait(5000);

        const diagnostico = {
            url_actual: page.url(),
            paginas: [],
            logs
        };

        const allPages = await browser.pages();
        for (const pg of allPages) {
            const pgData = { url: pg.url(), frames: [] };
            for (const frame of pg.frames()) {
                try {
                    const frameData = await frame.evaluate(() => {
                        const inputs = Array.from(document.querySelectorAll(
                            'input, textarea, select'
                        )).map(el => ({
                            tag: el.tagName.toLowerCase(),
                            type: el.type || '',
                            id: el.id || '',
                            name: el.name || '',
                            title: el.title || '',
                            placeholder: el.placeholder || '',
                            value: el.value ? el.value.substring(0, 50) : '',
                            readOnly: el.readOnly || el.disabled || false,
                            className: el.className ? el.className.substring(0, 60) : '',
                            rowText: ((el.closest('tr') || el.closest('td') || el.parentElement || {})
                                .innerText || '').trim().substring(0, 100),
                        }));

                        const btns = Array.from(document.querySelectorAll(
                            'button, input[type="button"], input[type="submit"], a[role="button"]'
                        )).filter(b => b.offsetParent !== null).map(b => ({
                            tag: b.tagName.toLowerCase(),
                            text: (b.innerText || b.value || '').trim().substring(0, 60),
                            id: b.id || '',
                            className: b.className ? b.className.substring(0, 60) : ''
                        }));

                        const labels = Array.from(document.querySelectorAll(
                            'label, td, th, span[class*="label" i], div[class*="label" i]'
                        )).filter(el => {
                            const t = (el.innerText || el.textContent || '').trim();
                            return t.length > 1 && t.length < 80 && el.offsetParent !== null;
                        }).map(el => (el.innerText || '').trim()).filter(Boolean).slice(0, 30);

                        return {
                            url: window.location.href,
                            title: document.title,
                            inputs: inputs.slice(0, 20),
                            buttons: btns.slice(0, 15),
                            labels: [...new Set(labels)].slice(0, 25),
                            totalInputs: inputs.length,
                            totalBtns: btns.length
                        };
                    }).catch(() => null);

                    if (frameData && (frameData.totalInputs > 0 || frameData.totalBtns > 0)) {
                        pgData.frames.push(frameData);
                        logs.push(`[DIAG] Frame: ${frameData.url.substring(0, 60)} → ${frameData.totalInputs} inputs, ${frameData.totalBtns} botones`);
                        logs.push(`[DIAG] Labels: ${frameData.labels.join(' | ')}`);
                        frameData.inputs.forEach(inp =>
                            logs.push(`[DIAG]   [${inp.tag}][${inp.type || 'select'}] id="${inp.id}" name="${inp.name}" title="${inp.title}" rowText="${inp.rowText.substring(0, 60)}"`)
                        );
                    }
                } catch { }
            }
            if (pgData.frames.length > 0) diagnostico.paginas.push(pgData);
        }

        const ss = await page.screenshot().catch(() => null);
        await safeForceCloseBrowser(browser, diagProfileDir);

        return res.json({
            ...diagnostico,
            screenshot: ss ? `data:image/png;base64,${ss.toString('base64')}` : null
        });

    } catch (err) {
        if (browser) await safeForceCloseBrowser(browser, diagProfileDir);
        return res.status(500).json({ error: err.message, logs });
    }
};

// ─────────────────────────────────────────────────────────────────
// UNITY ROBOT: Comunicaciones Producidas
// ─────────────────────────────────────────────────────────────────
exports.runUnityRobot = async (req, res) => {
    const params = req.body || {};
    const logs = [];

    if (!params.file_path) {
        return res.status(400).json({ success: false, error: 'file_path requerido', logs });
    }

    const scriptPath = path.join(__dirname, '..', 'scripts', 'unity_robot.py');
    const paramsJson = JSON.stringify(params).replace(/"/g, '\\"');
    const cmd = `python "${scriptPath}" "${paramsJson}"`;

    logs.push(`[UNITY-ROBOT] Ejecutando: ${cmd}`);

    return new Promise((resolve) => {
        exec(cmd, { cwd: path.join(__dirname, '..') }, (err, stdout, stderr) => {
            const output = (stdout || '') + (stderr || '');
            output.split('\n').forEach(line => { if (line.trim()) logs.push(line.trim()); });

            if (err) {
                logs.push(`[UNITY-ROBOT][ERROR] ${err.message}`);
                resolve(res.status(500).json({ success: false, error: err.message, logs }));
            } else {
                logs.push('[UNITY-ROBOT] ✅ Script completado exitosamente');
                resolve(res.json({ success: true, logs }));
            }
        });
    });
};

exports.getPM2Logs = async (req, res) => {
    if (req.query.secret !== 'Aut0m4t1z4d0r2026%*') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    try {
        const errorLogPath = '/home/cimi/.pm2/logs/sena-backend-error.log';
        const outLogPath = '/home/cimi/.pm2/logs/sena-backend-out.log';
        
        let errorLog = 'No error log found';
        let outLog = 'No out log found';
        
        if (fs.existsSync(errorLogPath)) {
            const stats = fs.statSync(errorLogPath);
            const fd = fs.openSync(errorLogPath, 'r');
            const bufferSize = Math.min(stats.size, 50000);
            const buffer = Buffer.alloc(bufferSize);
            fs.readSync(fd, buffer, 0, bufferSize, stats.size - bufferSize);
            fs.closeSync(fd);
            errorLog = buffer.toString('utf8');
        }
        
        if (fs.existsSync(outLogPath)) {
            const stats = fs.statSync(outLogPath);
            const fd = fs.openSync(outLogPath, 'r');
            const bufferSize = Math.min(stats.size, 50000);
            const buffer = Buffer.alloc(bufferSize);
            fs.readSync(fd, buffer, 0, bufferSize, stats.size - bufferSize);
            fs.closeSync(fd);
            outLog = buffer.toString('utf8');
        }
        
        return res.json({
            success: true,
            errorLog: errorLog.split('\n').slice(-150).join('\n'),
            outLog: outLog.split('\n').slice(-150).join('\n')
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────
// CONTROLES DE INTERACCIÓN MANUAL (SOPORTE MULTI-BOT POR PARÁMETRO bot)
// ─────────────────────────────────────────────────────────────────
exports.clickActivePage = async (req, res) => {
    const { x, y, clickCount = 1, button = 'left', bot } = req.body || {};
    const session = getActiveOrRequestedBot(bot || req.query?.bot);
    const targetPage = session?.page || activePage;
    if (!targetPage) {
        return res.status(400).json({ error: `No hay sesión activa en ${session?.label || 'el navegador'}` });
    }
    try {
        const nx = Number(x);
        const ny = Number(y);
        console.log(`[MANUAL-CLICK][Bot ${session?.botKey}] Clic (${clickCount}x ${button}) en x: ${nx}, y: ${ny}`);
        await targetPage.mouse.move(nx, ny);
        await wait(50);
        await targetPage.mouse.click(nx, ny, { clickCount: Number(clickCount), delay: 80, button });
        return res.json({ success: true, botKey: session?.botKey, message: `Clic ejecutado en x: ${nx}, y: ${ny}` });
    } catch (err) {
        console.error('[MANUAL-CLICK] Error:', err);
        return res.status(500).json({ error: err.message });
    }
};

exports.typeActivePage = async (req, res) => {
    const { text, bot } = req.body || {};
    const session = getActiveOrRequestedBot(bot || req.query?.bot);
    const targetPage = session?.page || activePage;
    if (!targetPage) {
        return res.status(400).json({ error: `No hay sesión activa en ${session?.label || 'el navegador'}` });
    }
    try {
        console.log(`[MANUAL-TYPE][Bot ${session?.botKey}] Escribiendo texto: "${text}"`);
        await targetPage.keyboard.type(text, { delay: 30 });
        return res.json({ success: true, botKey: session?.botKey, message: `Texto escrito correctamente` });
    } catch (err) {
        console.error('[MANUAL-TYPE] Error:', err);
        return res.status(500).json({ error: err.message });
    }
};

exports.pressKeyActivePage = async (req, res) => {
    const { key, bot } = req.body || {};
    const session = getActiveOrRequestedBot(bot || req.query?.bot);
    const targetPage = session?.page || activePage;
    if (!targetPage) {
        return res.status(400).json({ error: `No hay sesión activa en ${session?.label || 'el navegador'}` });
    }
    try {
        console.log(`[MANUAL-KEY][Bot ${session?.botKey}] Presionando tecla: ${key}`);
        await targetPage.keyboard.press(key);
        return res.json({ success: true, botKey: session?.botKey, message: `Tecla ${key} presionada` });
    } catch (err) {
        console.error('[MANUAL-KEY] Error:', err);
        return res.status(500).json({ error: err.message });
    }
};
