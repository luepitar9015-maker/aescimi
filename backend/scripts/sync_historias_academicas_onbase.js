const path = require('path');
const xlsx = require('xlsx');
const db = require('../database');

async function syncHistoriasAcademicas() {
    console.log('[SYNC] Iniciando sincronización de Tipologías de Historias Académicas desde Excel...');
    const excelPath = 'C:/Users/Usuario/Downloads/HISTORIAS ACADEMICAS.xlsx';
    
    let rows = [];
    try {
        const wb = xlsx.readFile(excelPath);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`[SYNC] Leídas ${rows.length} filas desde el Excel.`);
    } catch (e) {
        console.warn(`[SYNC] No se pudo leer directamente de Downloads (${e.message}), usando catálogo embebido...`);
    }

    // Catálogo completo de las 36 tipologías con su mapeo exacto TRD -> AES
    const fallbackCatalog = [
        { trd: 'DOCUMENTO DE IDENTIDAD VIGENTE', aes: 'DOCUMENTO DE IDENTIDAD VIGENTE' },
        { trd: 'REGISTRO DEL SISTEMA DE MATRICULA ESTUDIANTIL DE EDUCACION BASICA Y MEDIA- SIMAT, ARTICULACION CON LA MEDIA', aes: 'REGISTRO DEL SISTEMA DE MATRICULA ESTUDIANTIL DE EDUCACION BASICA' },
        { trd: 'ACTA DE COMPROMISO DEL APRENDIZ', aes: 'ACTA DE COMPROMISO DEL APRENDIZ' },
        { trd: 'AUTORIZACION DE DATOS DE MENOR DE EDAD', aes: 'AUTORIZACION DE DATOS DE MENOR DE EDAD' },
        { trd: 'DOCUMENTO DE IDENTIFICACION DEL PADRE, TUTOR O ACUDIENTE', aes: 'DOCUMENTO DE IDENTIFICACION DEL PADRE, TUTOR O ACUDIENTE' },
        { trd: 'CERTIFICADOS ACADEMICOS PARA EL PROCESO DE MATRICULA SALVO REGULACION ESPECIAL', aes: 'CERTIFICADOS ACADEMICOS PARA EL PROCESO DE MATRICULA (SALVO REGULA' },
        { trd: 'DOCUMENTO DE CONVALIDACION DE CERTIFICADOS ACADEMICOS U OTROS', aes: 'DOCUMENTO DE CONVALIDACION DE CERTIFICADOS ACADEMICOS U OTROS' },
        { trd: 'CERTIFICADO DE AFILIACION EPS', aes: 'CERTIFICADO DE AFILIACION EPS' },
        { trd: 'RESULTADO PRUEBA ICFES, SABER 11', aes: 'RESULTADO PRUEBA ICFES, SABER 11' },
        { trd: 'REGISTRO DE ASISTENCIA PARA FORMALIZAR MATRICULA', aes: 'REGISTRO DE ASISTENCIA PARA FORMALIZAR MATRICULA' },
        { trd: 'CONSTANCIA DE RECONOCIMIENTO PARA PENSION DE SOBREVIVIENTES', aes: 'CONSTANCIA DE RECONOCIMIENTO PARA PENSION DE SOBREVIVIENTES' },
        { trd: 'LLAMADO DE ATENCION ESCRITO ACADEMICO O DISCIPLINARIO', aes: 'LLAMADO DE ATENCION ESCRITO ACADEMICO O DISCIPLINARIO' },
        { trd: 'SOLICITUD DE NOVEDADES REINGRESO, APLAZAMIENTO, RETIRO VOLUNTARIO, TRASLADO Y CONDICIONAMIENTO', aes: 'SOLICITUD DE NOVEDADES (REINGRESO, APLAZAMIENTO, RETIRO VOLUNTARIO' },
        { trd: 'RESPUESTA A SOLICITUD DE NOVEDAD', aes: 'RESPUESTA A SOLICITUD DE NOVEDAD' },
        { trd: 'ACTAS DE REUNION DEL COMITE DE SEGUIMIENTO Y EVALUACION DE ETAPA LECTIVA Y/O PRODUCTIVA', aes: 'ACTAS DE REUNION DEL COMITE DE SEGUIMIENTO Y EVALUACION DE ETAPA L' },
        { trd: 'RESOLUCION DE REINGRESO, SANCIONATORIA O CANCELACION MATRICULA, PLAN DE MEJORAMIENTO ACADEMICO O DISCIPLINARIO', aes: 'RESOLUCION DE REINGRESO, SANCIONATORIA O CANCELACION MATRICULA, PL' },
        { trd: 'SOLICITUD DE RECURSO DE REPOSICION', aes: 'SOLICITUD DE RECURSO DE REPOSICION' },
        { trd: 'ACTO ADMINISTRATIVO RECURSO REPOSICION', aes: 'ACTO ADMINISTRATIVO RECURSO REPOSICION' },
        { trd: 'COMUNICACION DE PRESENTACION ETAPA PRACTICA LECTIVA', aes: 'COMUNICACION DE PRESENTACION ETAPA PRACTICA LECTIVA' },
        { trd: 'ACTA DE CIERRE ETAPA LECTIVA', aes: 'ACTA DE CIERRE ETAPA LECTIVA' },
        { trd: 'COMUNICACION SELECCION DE ETAPA PRODUCTIVA', aes: 'COMUNICACION SELECCION DE ETAPA PRODUCTIVA' },
        { trd: 'AFILIACION AL SISTEMA GENERAL DE RIESGOS LABORALES DE APRENDICES - ARL', aes: 'AFILIACION AL SISTEMA GENERAL DE RIESGOS LABORALES DE APRENDICES' },
        { trd: 'REGISTRO PLANEACION, SEGUIMIENTO Y EVALUACION DE LA ETAPA PRODUCTIVA', aes: 'REGISTRO PLANEACION, SEGUIMIENTO Y EVALUACION DE LA ETAPA PRODUCTI' },
        { trd: 'BITACORA DE SEGUIMIENTO ETAPA PRODUCTIVA', aes: 'BITACORA DE SEGUIMIENTO ETAPA PRODUCTIVA' },
        { trd: 'SOLICITUD DE CAMBIO DE ETAPA PRODUCTIVA', aes: 'SOLICITUD DE CAMBIO DE ETAPA PRODUCTIVA' },
        { trd: 'QUEJA O RECLAMACION POR EL APRENDIZ DEL PROCESO DE FORMACION', aes: 'QUEJA O RECLAMACION POR EL APRENDIZ DEL PROCESO DE FORMACION' },
        { trd: 'CERTIFICADO DE APROBACION EMPRESA TERMINACION ETAPA PRODUCTIVA', aes: 'CERTIFICADO DE APROBACION EMPRESA TERMINACION ETAPA PRODUCTIVA' },
        { trd: 'INFORME DE BIENESTAR DEL APRENDIZ RUTA DE ATENCION PARA LA PREVENCION DE LA DESERCION', aes: 'INFORME DE BIENESTAR DEL APRENDIZ RUTA DE ATENCION PARA LA PREVENC' },
        { trd: 'DOCUMENTO DE IDENTIDAD EN CASO DE CAMBIO DEL MISMO', aes: 'DOCUMENTO DE IDENTIDAD EN CASO DE CAMBIO DEL MISMO' },
        { trd: 'PAZ Y SALVO ACADEMICO ADMINISTRATIVO O COMUNICACION DE INSTITUCION EDUCATIVA', aes: 'PAZ Y SALVO ACADEMICO ADMINISTRATIVO O COMUNICACION INSTITUCION' },
        { trd: 'CERTIFICADO DE INSCRIPCION EN EL APLICATIVO DE LA APE', aes: 'CERTIFICADO DE INSCRIPCION EN EL APLICATIVO DE LA APE' },
        { trd: 'RESULTADOS DE LA PRUEBA SABER TYT ANTE EL ICFES PARA APRENDICES DEL NIVEL TECNOLOGICO', aes: 'RESULTADOS DE LA PRUEBA SABER TYT ANTE EL ICFES PARA APRENDICES DE' },
        { trd: 'CONSTANCIA DE BUENA CONDUCTA', aes: 'CONSTANCIA DE BUENA CONDUCTA' },
        { trd: 'CONTROL Y EXPEDICION Y ENTREGA DE DUPLICADOS ANOS ANTERIORES AL ANO 2000', aes: 'CONTROL Y EXPEDICION Y ENTREGA DE DUPLICADOS (AÑOS ANTERIORES AL A' },
        { trd: 'SOLICITUD MODIFICACION DE DOCUMENTOS ACADEMICOS CON SU RESPECTIVO SOPORTE', aes: 'SOLICITUD MODIFICACION DE DOCUMENTOS ACADEMICOS CON SU RESPECTIVO' },
        { trd: 'CONSTANCIA DE VALIDACION ACADEMICA PARA APOSTILLAR', aes: 'CONSTANCIA DE VALIDACION ACADEMICA PARA APOSTILLAR' }
    ];

    let mappingList = [];
    if (rows && rows.length > 1) {
        for (let r = 1; r < rows.length; r++) {
            const trd = (rows[r][1] || '').trim();
            const aes = (rows[r][2] || '').trim();
            if (trd) {
                mappingList.push({ trd, aes: aes || trd });
            }
        }
    } else {
        mappingList = fallbackCatalog;
    }

    console.log(`[SYNC] Procesando ${mappingList.length} tipologías...`);

    let totalUpdated = 0;
    for (const item of mappingList) {
        await new Promise((resolve) => {
            const query = `
                UPDATE trd_typologies 
                SET onbase_name = ? 
                WHERE (series_id = 97 OR series_id IN (SELECT id FROM trd_series WHERE series_code LIKE '%9224.4-37%'))
                  AND (
                      LOWER(TRIM(typology_name)) = LOWER(TRIM(?))
                      OR typology_name ILIKE ?
                  )
            `;
            db.run(query, [item.aes, item.trd, `%${item.trd.substring(0, 30)}%`], function (err) {
                if (err) {
                    console.error(`[SYNC][ERROR] ${item.trd}:`, err.message);
                } else if (this && this.changes > 0) {
                    totalUpdated += this.changes;
                    console.log(`[SYNC] ✅ "${item.trd.substring(0, 40)}..." ➔ "${item.aes}"`);
                } else {
                    console.log(`[SYNC] ℹ️ Sin filas afectadas para: "${item.trd.substring(0, 40)}..."`);
                }
                resolve();
            });
        });
    }

    console.log(`[SYNC] Finalizado. Total registros actualizados: ${totalUpdated}`);
    return totalUpdated;
}

if (require.main === module) {
    syncHistoriasAcademicas()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = { syncHistoriasAcademicas };
