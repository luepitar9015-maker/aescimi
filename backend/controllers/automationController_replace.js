// ─────────────────────────────────────────────────────────────────
async function paso6_guardar(page, allFramesFn, logs) {
    logs.push('[PASO 6] Buscando botón "Guardar"...');
    try {
        await page.screenshot({ path: require('path').join(__dirname, '..', 'onbase_screenshot.png'), fullPage: true });
        logs.push('[PASO 6] Screenshot del formulario guardado en onbase_screenshot.png');
    } catch(e) { logs.push(`[PASO 6][ERR_DIAG] ${e.message}`); }
    
    let saved = false;
