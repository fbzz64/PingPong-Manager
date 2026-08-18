// ==========================================
// SMOKE TEST EN NAVEGADOR REAL (Edge + playwright-core)
// ==========================================
// Requisito: `npm install playwright-core` (dependencia opcional).
// Uso: node tests/smoke/smoke-edge.js
//
// Levanta un servidor estático temporal sobre la raíz del proyecto,
// abre el sistema en un Edge headless y recorre el flujo completo:
// jugadores → check-in → fixture → resultados → multiplex → estadísticas →
// H2H → ranking → llaves → podios → certificados → exportaciones →
// persistencia → patrocinadores → plantillas → tema → logs → undo/redo.
// Falla con exit code 1 ante cualquier error de consola, page error,
// request fallido o respuesta HTTP >= 400.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8899;

const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = path.resolve(path.join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
    fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end('not found'); }
        const ext = path.extname(file).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
});

const errors = [];
const log = (msg) => console.log('  · ' + msg);

const EDGE_CANDIDATES = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/EdgeCore/*/msedge.exe',
    'C:/Program Files/Microsoft/EdgeCore/*/msedge.exe'
];
function findEdge() {
    for (const c of EDGE_CANDIDATES) {
        if (c.includes('*')) {
            const base = c.slice(0, c.indexOf('*'));
            try {
                const vers = fs.readdirSync(base).sort();
                for (let i = vers.length - 1; i >= 0; i--) {
                    const p = path.join(base, vers[i], 'msedge.exe');
                    if (fs.existsSync(p)) return p;
                }
            } catch (e) { /* siguiente */ }
        } else if (fs.existsSync(c)) {
            return c;
        }
    }
    return null;
}

(async () => {
    await new Promise(r => server.listen(PORT, r));

    const edgePath = findEdge();
    if (!edgePath) {
        console.error('No se encontró msedge.exe. Editá EDGE_CANDIDATES en tests/smoke/smoke-edge.js');
        server.close();
        process.exit(1);
    }

    const browser = await chromium.launch({ executablePath: edgePath, headless: true });
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    page.on('console', m => {
        if (m.type() === 'error') {
            const loc = m.location();
            errors.push('CONSOLE: ' + m.text() + (loc ? ' [' + loc.url + ':' + loc.lineNumber + ']' : ''));
        }
    });
    page.on('response', r => {
        if (r.status() >= 400) errors.push('HTTP ' + r.status() + ': ' + r.url());
    });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + (e.stack ? ' @ ' + e.stack.split('\n')[1] : '')));
    page.on('requestfailed', r => errors.push('REQFAIL: ' + r.url() + ' ' + (r.failure() || {}).errorText));

    const evalVal = (expr) => page.evaluate(expr);
    const click = async (sel, label) => { await page.waitForSelector(sel, { timeout: 5000 }); await page.click(sel); log(label); };
    const openTab = async (name, label) => {
        await page.evaluate((n) => {
            const el = document.querySelector('[data-tab="' + n + '"]');
            if (el) {
                const menu = el.closest('.dropdown-menu');
                if (menu && window.getComputedStyle(menu).display === 'none') {
                    el.closest('.tab-group').querySelector('.dropdown-toggle').click();
                }
            }
        }, name);
        await click('[data-tab="' + name + '"]', label);
    };

    console.log('== SMOKE TEST EDGE (http://localhost:' + PORT + ') ==');

    // Stub de window.open: evita abrir pestañas reales (wa.me, ventanas de impresión)
    await page.evaluate(() => {
        window.open = function() { return { document: { write: () => {}, close: () => {} } }; };
    });

    // 1) Carga inicial
    await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'networkidle' });
    log('1. página cargada, título: ' + await page.title());
    log('   version button: ' + (await page.textContent('.header-actions .btn')).trim());

    // 2) Dashboard inicial
    log('2. stat-groups=' + (await page.textContent('#stat-groups')).trim() +
        ' stat-players=' + (await page.textContent('#stat-players')).trim());

    // 3) Registrar jugadores reales desde el formulario
    await openTab('players', '3. tab Jugadores');
    const names = ['Juan Perez', 'Maria Gomez', 'Pedro Diaz', 'Ana Lopez', 'Luis Martinez', 'Sofia Alvarez'];
    for (let i = 0; i < names.length; i++) {
        await page.fill('#new-player-name', names[i]);
        await page.fill('#new-player-club', 'Club ' + (i % 3 + 1));
        await page.selectOption('#new-player-categories', ['SUB 13']);
        await evalVal('addNewPlayer()');
    }
    const playerCount = await evalVal('tournamentData.players.length');
    log('3. jugadores registrados: ' + playerCount);
    await click('text=Ver Todos los Jugadores', '   showAllPlayers()');
    const playersHtml = await page.textContent('#players-output');
    log('   players-output incluye Juan Perez: ' + playersHtml.includes('Juan Perez'));

    // 3b) Check-in: abrir modal, marcar a todos, confirmar
    await evalVal('showCheckinModal()');
    await page.waitForSelector('#checkin-toggle-all', { timeout: 5000, state: 'attached' });
    await evalVal('toggleCheckinAll(true)');
    await page.click('#modal-confirm');
    await page.waitForTimeout(200);
    const checkinOk = await evalVal('tournamentData.players.every(p => p.checkin === true)');
    log('3b. check-in: todos presentes = ' + checkinOk);

    // 3b2) QR de acreditación: payload, imagen y acreditación automática
    const qrOk = await evalVal(`(() => {
        const p = tournamentData.players[0];
        p.checkin = false;
        const payload = buildPlayerQRPayload(p);
        if (!payload || payload.indexOf('TTM-PLAYER|') !== 0) return 'payload inválido';
        const url = qrDataURL(payload, 4);
        if (!url || url.length < 100) return 'QR sin imagen';
        const found = findPlayerByQR(payload);
        if (!found || found.index !== 0) return 'findPlayerByQR falló';
        markPlayerCheckedIn(0);
        return tournamentData.players[0].checkin === true ? 'OK' : 'checkin no aplicado';
    })()`);
    log('3b2. QR payload+imagen+acreditación: ' + qrOk);
    await evalVal('showPlayerQR(0)');
    const qrImgSrc = await evalVal('document.querySelector("#modal-content img") ? document.querySelector("#modal-content img").getAttribute("src").slice(0, 30) : "sin-imagen"');
    log('   modal QR de ' + names[0] + ': ' + qrImgSrc + '…');
    await evalVal('closeModal()');

    // 3c) Listas por categoría
    await evalVal('generateCategoryLists()');
    const listsHtml = await page.textContent('#players-output');
    log('3c. listas por categoría incluyen SUB 13: ' + listsHtml.includes('SUB 13'));

    // 3d) Detección de duplicados (no debe haber → toast informativo, sin errores)
    await evalVal('checkDuplicatePlayers()');
    await page.waitForTimeout(150);
    log('3d. detección de duplicados: sin errores');

    // 3e) Export de jugadores (Excel, JSON)
    await evalVal('exportPlayersExcel()');
    await evalVal('exportPlayersJSON()');
    await page.waitForTimeout(300);
    log('3e. export jugadores: sin errores');

    // 4) Fixture
    await openTab('fixture', '4. tab Fixture');
    await evalVal('loadFakeData()');
    await evalVal('generateFixture()');
    await page.waitForTimeout(300);
    const matchCount = await evalVal("document.querySelectorAll('#fixture-output .match-table').length");
    log('   partidos renderizados: ' + matchCount);
    await evalVal('saveFixtureData()');

    // 4b) Programación Multiplex: modal → mesas → confirmar
    await evalVal('scheduleFixtureMultiplex()');
    await page.waitForSelector('#sched-mesas', { timeout: 5000 });
    await page.fill('#sched-mesas', '2');
    await page.click('#modal-confirm');
    await page.waitForTimeout(300);
    await evalVal('closeModal()');
    const schedLen = await evalVal('(() => { const f = tournamentData.fixtures[tournamentData.fixtures.length - 1]; return f && f.schedule ? f.schedule.length : 0; })()');
    log('4b. multiplex: partidos programados = ' + schedLen);

    // 4b2) Mesas en vivo: abrir pantalla de proyección, verificar y cerrar
    await evalVal('openTablesLive()');
    await page.waitForSelector('#tables-live-fixture', { timeout: 5000 });
    await evalVal('startTablesLive(parseInt(document.getElementById("tables-live-fixture").value))');
    await page.waitForSelector('#tables-overlay', { timeout: 5000, state: 'visible' });
    const tl = await page.evaluate(() => ({
        mesas: document.querySelectorAll('#tables-live-body .tl-mesa').length,
        filas: document.querySelectorAll('#tables-live-body .tl-row').length,
        status: document.getElementById('tables-live-status').textContent,
        categoria: document.getElementById('tables-live-category').textContent,
        clock: document.getElementById('tables-live-clock').textContent.length
    }));
    log('4b2. mesas en vivo: ' + JSON.stringify(tl));
    await evalVal('closeTablesLive()');
    const tlClosed = await evalVal('document.getElementById("tables-overlay").style.display');
    log('   overlay cerrado: display=' + tlClosed);

    // 4c) Difundir programación Multiplex por WhatsApp (wa.me)
    await evalVal('shareScheduleMultiplex()');
    await page.waitForSelector('#multiplex-diffusion-text', { timeout: 5000 });
    const muxMsgLen = await evalVal("document.getElementById('multiplex-diffusion-text').value.length");
    log('4c. difusión multiplex: mensaje de ' + muxMsgLen + ' caracteres');
    await evalVal('closeModal()');

    // 5) Cargar resultados via celdas contenteditable (filas por jugador)
    const filled = await evalVal(`(() => {
        const tables = document.querySelectorAll('#fixture-output .match-table');
        let n = 0;
        tables.forEach(t => {
            const rows = t.querySelectorAll('tr[data-player-index]');
            if (rows.length < 2) return;
            const c1 = rows[0].querySelectorAll('.set-col[contenteditable]');
            const c2 = rows[1].querySelectorAll('.set-col[contenteditable]');
            if (c1.length < 3) return;
            for (let s = 0; s < 3; s++) { c1[s].textContent = '11'; c2[s].textContent = String(9 - s); }
            c1.forEach(c => { if (window.validateAndCalculate) validateAndCalculate(c); });
            n++;
        });
        return n;
    })()`);
    log('5. resultados cargados en ' + filled + ' partidos');
    await evalVal('saveFixtureData()');
    await evalVal('updateDashboard ? updateDashboard() : null');

    // 6) Dashboard actualizado
    const d = await page.evaluate(() => ({
        matches: document.getElementById('stat-matches').textContent,
        pending: document.getElementById('stat-pending').textContent
    }));
    log('6. stat-matches=' + d.matches + ' stat-pending=' + d.pending);

    // 7) Estadísticas + H2H
    await openTab('stats', '7. tab Estadísticas');
    await click('text=Actualizar Estadísticas', '   calculateStats()');
    const statsOk = await page.evaluate(() => document.querySelectorAll('#stats-output .data-table tbody tr').length);
    log('   filas en tabla de estadísticas: ' + statsOk);

    // 7b) H2H: poblar selects y ver historial entre dos jugadores
    await evalVal('populateH2HSelects()');
    const h2hSet = await evalVal(`(() => {
        const a = document.getElementById('h2h-player-a');
        const b = document.getElementById('h2h-player-b');
        if (!a || !b || a.options.length < 2) return false;
        a.value = a.options[0].value;
        b.value = b.options[1].value;
        showH2HResult();
        return true;
    })()`);
    const h2hOut = await page.textContent('#h2h-output').catch(() => '');
    log('7b. H2H seleccionado=' + h2hSet + ' output len=' + h2hOut.length);

    // 8) Ranking
    await openTab('ranking', '8. tab Ranking');
    await evalVal('renderRanking()');
    const rankOk = await page.evaluate(() => document.querySelectorAll('#ranking-output tr').length);
    log('   filas de ranking: ' + rankOk);
    await evalVal('exportRankingCSV()');
    await page.waitForTimeout(250);
    log('   export ranking CSV: sin errores');

    // 9) Llaves (el modal de categoría se confirma)
    await openTab('brackets', '9. tab Llaves');
    await evalVal('generateBrackets()');
    await page.waitForSelector('#bracket-category', { timeout: 5000 });
    const catOpts = await evalVal("Array.from(document.querySelectorAll('#bracket-category option')).map(o => o.textContent)");
    log('   modal llaves, categorías: ' + catOpts.join(' | '));
    await page.click('#modal-confirm');
    await page.waitForTimeout(400);
    const brk = await evalVal("document.querySelectorAll('#brackets-output').length + ' | tablas: ' + document.querySelectorAll('#brackets-output table').length");
    log('   brackets-output: ' + brk);

    // 9b) Podios + difusión WhatsApp (modal)
    await evalVal('calculatePodiums()');
    await evalVal('showWhatsAppDiffusion()');
    await page.waitForSelector('#diffusion-whatsapp-text', { timeout: 5000 });
    const diffusion = await evalVal("document.getElementById('diffusion-whatsapp-text').value.length");
    log('9b. difusión WhatsApp: mensaje de ' + diffusion + ' caracteres');
    await evalVal('diffusionOpenWhatsApp("diffusion-whatsapp-text")');
    log('   Abrir WhatsApp (wa.me): sin errores');
    await evalVal('closeModal()');

    // 9c) Redes sociales: plantillas + hub + imagen de podios
    await evalVal('showDiffusionTemplates()');
    await page.waitForSelector('#diffusion-template-type', { timeout: 5000 });
    await page.selectOption('#diffusion-template-type', 'resultados');
    await evalVal('refreshDiffusionTemplate()');
    const tmplLen = await evalVal("document.getElementById('diffusion-template-text').value.length");
    log('9c. plantilla resultados: ' + tmplLen + ' caracteres');
    await evalVal('closeModal()');

    await evalVal('showSocialHub()');
    const hubOk = await evalVal('document.getElementById("modal-title").textContent.includes("Difundir")');
    log('   hub difusión: ' + hubOk);
    await evalVal('closeModal()');

    await evalVal('exportPodiumsImage()');
    await page.waitForTimeout(300);
    log('   imagen de podios PNG: sin errores');

    // 10) Certificados (modal)
    await evalVal('generateCertificatesModal()');
    const certModal = await evalVal('document.getElementById("modal-content").textContent.includes("Certificado") || document.getElementById("modal-title").textContent');
    log('10. modal certificados: ' + String(certModal).slice(0, 40));
    await evalVal('closeModal()');

    // 11) Exports (captura descargas)
    const downloads = [];
    page.on('download', dl => downloads.push(dl.suggestedFilename()));
    for (const [label, fn] of [['Excel', 'exportStatsExcel()'], ['PDF', 'exportStatsPDF()'], ['JSON', 'exportAllData()'], ['Backup', 'createBackup()']]) {
        await evalVal(fn);
        await page.waitForTimeout(400);
        log('11. export ' + label + ' → descargas: ' + downloads.length);
    }

    // 11b) Reporte final / PDF torneo (abre ventana de impresión, ya stubeada)
    await evalVal('exportTournamentPDF()');
    await evalVal('generateFinalReport()');
    await evalVal('exportFinalReportPDF()');
    await page.waitForTimeout(400);
    log('11b. export torneo/reporte final: sin errores');

    // 12) Persistencia tras recarga
    await page.reload({ waitUntil: 'networkidle' });
    const after = await evalVal('tournamentData.players.length');
    log('12. jugadores tras recargar: ' + after);
    await openTab('dashboard', '   dashboard tras recarga');

    // 13) Configuración: patrocinadores, plantillas y tema
    await openTab('settings', '13. tab Configuración');
    await evalVal('addPatrocinador()');
    await page.waitForSelector('#pat-nombre', { timeout: 5000 });
    await page.fill('#pat-nombre', 'Patrocinador Smoke');
    await page.click('#modal-confirm');
    await page.waitForTimeout(300);
    const pats = await evalVal('(tournamentData.settings.patrocinadores || []).map(p => p.nombre || p.name).join(", ")');
    log('   patrocinadores: ' + pats);
    await page.fill('#template-name', 'Plantilla Smoke');
    await evalVal('saveTournamentTemplate()');
    await page.waitForTimeout(200);
    const tmpls = await evalVal('document.getElementById("templates-list").textContent.includes("Plantilla Smoke")');
    log('   plantilla guardada: ' + tmpls);
    await evalVal('toggleTheme()');
    log('   tema alternado: sin errores');

    // 13b) Torneos: modal de nuevo torneo (no se confirma)
    await evalVal('startNewTournament()');
    await page.waitForSelector('#modal-overlay', { timeout: 5000, state: 'attached' });
    const newTournament = await evalVal('document.getElementById("modal-title").textContent');
    log('13b. modal nuevo torneo: ' + String(newTournament).slice(0, 30));
    await evalVal('closeModal()');

    // 14) Changelog / Logs
    await openTab('changelog', '14. tab Changelog');
    await openTab('logs', '   tab Logs');
    await evalVal('showLogs()');

    // 15) Undo/redo
    await evalVal('undoAction()');
    await evalVal('redoAction()');
    log('15. undo/redo sin errores');

    // 16) PWA OFFLINE: esperar SW activo, cache completo, navegar sin red
    log('16. PWA offline...');
    const swState = await evalVal(`(async () => {
        if (!('serviceWorker' in navigator)) return 'sin-soporte';
        const reg = await navigator.serviceWorker.ready;
        const cacheNames = await caches.keys();
        const shell = ['./index.html','./css/styles.css','./js/main.js','./js/storage.js'];
        const found = {};
        for (const c of shell) found[c] = !!(await caches.match(c));
        return JSON.stringify({ caches: cacheNames, found });
    })()`);
    const sw = JSON.parse(swState);
    log('   SW activo, caches: ' + (sw.caches || []).join(', '));
    const cacheOk = Object.values(sw.found || {}).every(v => v === true);
    log('   app shell cacheado (index, css, js): ' + cacheOk);

    await context.setOffline(true);
    try {
        await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'load', timeout: 15000 });
        log('   recarga OFFLINE OK, título: ' + await page.title());
        const off = await page.evaluate(() => ({
            players: tournamentData.players.length,
            title: document.querySelector('.header-actions .btn').textContent.trim()
        }));
        log('   offline: jugadores=' + off.players + ' version=' + off.title);
        await evalVal('showTab("players")');
        await page.waitForTimeout(150);
        const offTab = await evalVal('document.getElementById("players").classList.contains("active")');
        log('   offline: tab Jugadores accesible = ' + offTab);
    } catch (e) {
        errors.push('OFFLINE: recarga sin red falló → ' + e.message.split('\n')[0]);
    } finally {
        await context.setOffline(false);
    }

    await browser.close();
    server.close();

    console.log('\n== RESULTADO ==');
    if (errors.length) {
        console.log('ERRORES (' + errors.length + '):');
        errors.forEach(e => console.log('  ✗ ' + e));
        process.exitCode = 1;
    } else {
        console.log('SIN ERRORES: flujo completo OK');
    }
})().catch(e => { console.error('FATAL:', e); server.close(); process.exit(1); });
