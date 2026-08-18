// ==========================================
// TVBOARD.JS - Cartelera TV (pantalla completa)
// ==========================================
// Proyecta TODOS los grupos del torneo con sus resultados en una sola
// pantalla, organizados por categoría y grupo. Se actualiza automáticamente
// cada 3 segundos, leyendo los resultados en vivo si el grupo visible en la
// pestaña Fixture coincide, o el último guardado de cada fixture.
// ==========================================

let tvboardState = null; // { timer, clockTimer }

/**
 * Abre la cartelera TV en pantalla completa.
 */
window.openTVBoard = function() {
    const fixtures = (tournamentData.fixtures || []).filter(f =>
        Array.isArray(f.matches) && f.matches.length > 0
    );
    if (fixtures.length === 0) {
        showToast(t('No hay fixtures guardados para mostrar en la cartelera'), 'warning');
        return;
    }

    const overlay = document.getElementById('tvboard-overlay');
    if (!overlay) return;
    closeTVBoard();

    tvboardState = { timerStart: Date.now() };
    overlay.style.display = 'flex';

    tvboardTick();
    tvboardState.timer = setInterval(tvboardTick, 3000);
    tvboardState.clockTimer = setInterval(tvboardRenderClock, 1000);

    document.getElementById('tvboard-category').textContent =
        (tournamentData.settings && tournamentData.settings.torneoNombre) || t('Torneo');
    tvboardRenderClock();
    if (typeof window.requestScreenWakeLock === 'function') window.requestScreenWakeLock();
    showToast(t('🖥️ Cartelera TV activada'));
    addLog('SCOREBOARD', t('Cartelera TV abierta: todos los grupos'));
};

/**
 * Cierra la cartelera TV y detiene la actualización automática.
 */
window.closeTVBoard = function() {
    if (tvboardState) {
        if (tvboardState.timer) clearInterval(tvboardState.timer);
        if (tvboardState.clockTimer) clearInterval(tvboardState.clockTimer);
        tvboardState = null;
    }
    const overlay = document.getElementById('tvboard-overlay');
    if (overlay) overlay.style.display = 'none';
    if (typeof window.releaseScreenWakeLock === 'function') window.releaseScreenWakeLock();
};

/**
 * Actualiza el reloj del header de la cartelera.
 */
function tvboardRenderClock() {
    const el = document.getElementById('tvboard-clock');
    if (el) el.textContent = new Date().toLocaleTimeString(window.i18nLocale());
}

/**
 * Lee los partidos "en vivo": si las tablas del fixture están visibles en la
 * pestaña Fixture se leen del DOM (carga en tiempo real); si no, se usa el
 * último guardado. Mismo criterio que el scoreboard.
 */
function tvboardReadMatches(fixture) {
    const visible = (function() {
        try {
            const output = document.getElementById('fixture-output');
            if (!output || typeof output.querySelectorAll !== 'function') return false;
            if (output.querySelectorAll('.match-table').length === 0) return false;
            const cat = document.getElementById('categoria');
            const grp = document.getElementById('grupo');
            return cat && grp && cat.value === fixture.categoria && grp.value === fixture.grupo;
        } catch (e) {
            return false;
        }
    })();

    if (visible && typeof extractMatchesData === 'function') {
        try {
            const live = extractMatchesData();
            if (live && live.length > 0) return live;
        } catch (e) { /* fallback al guardado */ }
    }
    return fixture.matches || [];
}

/**
 * Cuenta sets ganados de una lista de resultados (mismo criterio ITTF).
 */
function tvboardSetWins(s1, s2) {
    let w = 0;
    for (let i = 0; i < Math.max(s1.length, s2.length); i++) {
        const a = parseInt(s1[i], 10) || 0;
        const b = parseInt(s2[i], 10) || 0;
        if (a > b) w++;
    }
    return w;
}

/**
 * Renderiza el bloque de un fixture (grupo) en la cartelera.
 */
function tvboardGroupCard(fixture) {
    const matches = tvboardReadMatches(fixture);
    const done = matches.filter(m => m.completed).length;

    let cards = '';
    matches.forEach(m => {
        const p1 = m.player1 || {};
        const p2 = m.player2 || {};
        const s1 = (m.sets && m.sets.player1) || [];
        const s2 = (m.sets && m.sets.player2) || [];
        const w1 = tvboardSetWins(s1, s2);
        const w2 = tvboardSetWins(s2, s1);

        const nSets = Math.max(s1.length, s2.length);
        let setCells = '';
        for (let i = 0; i < nSets; i++) {
            setCells += '<td class="sc-set">' + escHtml(s1[i] || '') + '</td><td class="sc-set">' + escHtml(s2[i] || '') + '</td>';
        }

        let status = '';
        let winnerClass = '';
        if (m.wo) {
            status = '<span class="sc-badge sc-wo">W.O.</span>';
            winnerClass = m.woWinnerSide === 2 ? 'sc-b' : 'sc-a';
        } else if (m.completed && w1 !== w2) {
            status = '<span class="sc-badge sc-done">' + t('FINALIZADO') + '</span>';
            winnerClass = w1 > w2 ? 'sc-a' : 'sc-b';
        } else if (w1 !== 0 || w2 !== 0 || s1.some(Boolean) || s2.some(Boolean)) {
            status = '<span class="sc-badge sc-live">● ' + t('EN CURSO') + '</span>';
        } else {
            status = '<span class="sc-badge sc-pend">' + t('PENDIENTE') + '</span>';
        }

        const schedule = (fixture.schedule || []).find(s => s.match === m.match && s.mesa !== '-' && s.hora !== '-');
        const scheduleHTML = schedule ? '<div class="sc-schedule">🕐 ' + escHtml(schedule.hora) + ' · ' + t('Mesa') + ' ' + escHtml(schedule.mesa) + '</div>' : '';
        const incHTML = m.incidencias ? '<div class="sc-schedule" style="color: #f0a500;">📝 ' + t('Incidencias:') + ' ' + escHtml(m.incidencias) + '</div>' : '';

        cards += `
            <div class="sc-match">
                <div class="sc-match-head">${t('Partido')} ${m.match} ${status}</div>
                <div class="sc-rows">
                    <div class="sc-row ${winnerClass === 'sc-a' ? 'sc-winner' : ''}">
                        <div class="sc-player"><div class="sc-name">${escHtml(p1.name)}</div><div class="sc-club">${escHtml(p1.club || '')}</div></div>
                        <div class="sc-score">${w1} <small>${t('sets')}</small></div>
                    </div>
                    <div class="sc-row ${winnerClass === 'sc-b' ? 'sc-winner' : ''}">
                        <div class="sc-player"><div class="sc-name">${escHtml(p2.name)}</div><div class="sc-club">${escHtml(p2.club || '')}</div></div>
                        <div class="sc-score">${w2} <small>${t('sets')}</small></div>
                    </div>
                </div>
                <table class="sc-sets"><tr><th></th>${Array.from({ length: nSets }, (_, i) => '<th>S' + (i + 1) + '</th>').join('')}</tr>
                    <tr><td class="sc-side">A</td>${Array.from({ length: nSets }, (_, i) => '<td class="sc-set">' + escHtml(s1[i] || '') + '</td>').join('')}</tr>
                    <tr><td class="sc-side">B</td>${Array.from({ length: nSets }, (_, i) => '<td class="sc-set">' + escHtml(s2[i] || '') + '</td>').join('')}</tr>
                </table>
                ${scheduleHTML}
                ${incHTML}
            </div>`;
    });

    return `<div class="tvboard-group">
        <div class="tvboard-group-head">${escHtml(fixture.categoria)} · ${t('Grupo')} ${escHtml(fixture.grupo)} <span style="margin-left: auto; font-size: 12px; color: rgba(255,255,255,0.55);">${done}/${matches.length} ${t('finalizados')}</span></div>
        <div class="tvboard-group-matches">${cards}</div>
    </div>`;
}

/**
 * Actualiza el contenido de la cartelera TV.
 */
function tvboardTick() {
    if (!tvboardState) return;
    const body = document.getElementById('tvboard-body');
    if (!body) return;

    const fixtures = (tournamentData.fixtures || []).filter(f =>
        Array.isArray(f.matches) && f.matches.length > 0
    );

    let total = 0;
    let done = 0;
    fixtures.forEach(f => {
        const matches = tvboardReadMatches(f);
        total += matches.length;
        done += matches.filter(m => m.completed).length;
    });

    const statusEl = document.getElementById('tvboard-status');
    if (statusEl) {
        statusEl.textContent = done + ' / ' + total + ' ' + t('partidos finalizados');
    }

    body.innerHTML = fixtures.map(tvboardGroupCard).join('');
}

// Al cambiar idioma, re-renderiza la cartelera abierta de inmediato.
window.onLangChange(function() {
    const overlay = document.getElementById('tvboard-overlay');
    if (overlay && overlay.style.display === 'flex' && tvboardState) {
        tvboardTick();
        tvboardRenderClock();
    }
});
