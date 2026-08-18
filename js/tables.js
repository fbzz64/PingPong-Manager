// ==========================================
// TABLES.JS - Mesas en vivo (pantalla de proyección)
// ==========================================
// Proyecta en pantalla completa la programación Multiplex de un grupo
// organizada por mesa. Resalta el partido en curso (o el próximo pendiente)
// de cada mesa y se actualiza automáticamente cada 3 segundos, leyendo los
// resultados en vivo si el grupo está visible en la pestaña Fixture.
// ==========================================

let tablesLiveState = null; // { fixture, timer, clockTimer }

/**
 * Abre el selector de fixture para la vista de mesas en vivo.
 */
window.openTablesLive = function() {
    const fixtures = (tournamentData.fixtures || []).filter(f =>
        Array.isArray(f.schedule) && f.schedule.some(s => s.mesa !== '-' && s.slot >= 0)
    );
    if (fixtures.length === 0) {
        showToast(t('No hay grupos con programación Multiplex'), 'warning');
        return;
    }

    const opts = fixtures.map(f => {
        const scheduled = (f.schedule || []).filter(s => s.mesa !== '-' && s.slot >= 0).length;
        const mesas = new Set((f.schedule || []).filter(s => s.mesa !== '-').map(s => s.mesa)).size;
        return '<option value="' + f.id + '">' + escHtml(f.categoria) + ' · ' + t('Grupo') + ' ' + escHtml(f.grupo) + ' (' + mesas + ' ' + t('mesas') + ' · ' + scheduled + ' ' + t('partidos') + ')</option>';
    }).join('');

    showModal(
        t('🪑 Mesas en vivo'),
        '<div style="color: var(--text-color);">' +
            '<p style="font-size: 13px; color: var(--text-muted); margin: 0 0 10px 0;">' + t('Elegí el grupo a proyectar: cada mesa se muestra como una columna con su partido en curso o próximo resaltado. Se actualiza sola cada 3 segundos.') + '</p>' +
            '<select id="tables-live-fixture" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">' + opts + '</select>' +
            '<button class="btn btn-primary" style="width: 100%; margin-top: 12px;" onclick="startTablesLive(parseInt(document.getElementById(\'tables-live-fixture\').value))">🎬 ' + t('Abrir pantalla completa') + '</button>' +
        '</div>',
        null,
        t('Cerrar')
    );
};

/**
 * Abre la vista de mesas en vivo a pantalla completa para un fixture.
 * @param {number|string} fixtureId
 */
window.startTablesLive = function(fixtureId) {
    const fixture = (tournamentData.fixtures || []).find(f => String(f.id) === String(fixtureId));
    if (!fixture) {
        showToast(t('Fixture no encontrado'), 'error');
        return;
    }

    const overlay = document.getElementById('tables-overlay');
    if (!overlay) return;
    closeTablesLive();

    tablesLiveState = { fixture, timerStart: Date.now(), timerAlerted: false };
    overlay.style.display = 'flex';

    tablesLiveTick();
    tablesLiveState.timer = setInterval(tablesLiveTick, 3000);
    tablesLiveState.clockTimer = setInterval(tablesLiveRenderClock, 1000);

    const head = document.getElementById('tables-live-category');
    if (head) head.textContent = (fixture.categoria || '-') + ' · ' + t('Grupo') + ' ' + (fixture.grupo || '-');
    tablesLiveRenderClock();
    if (typeof window.requestScreenWakeLock === 'function') window.requestScreenWakeLock();
    showToast(t('🪑 Mesas en vivo activadas'));
    addLog('SCOREBOARD', t('Mesas en vivo abiertas:') + ' ' + fixture.categoria + ' - ' + t('Grupo') + ' ' + fixture.grupo);
};

/**
 * Cierra la vista de mesas en vivo y detiene la actualización automática.
 */
window.closeTablesLive = function() {
    if (tablesLiveState) {
        if (tablesLiveState.timer) clearInterval(tablesLiveState.timer);
        if (tablesLiveState.clockTimer) clearInterval(tablesLiveState.clockTimer);
        tablesLiveState = null;
    }
    const overlay = document.getElementById('tables-overlay');
    if (overlay) overlay.style.display = 'none';
    if (typeof window.releaseScreenWakeLock === 'function') window.releaseScreenWakeLock();
};

/**
 * Actualiza el reloj del header de la vista de mesas.
 */
function tablesLiveRenderClock() {
    const el = document.getElementById('tables-live-clock');
    if (el) el.textContent = new Date().toLocaleTimeString(window.i18nLocale());
    tablesLiveRenderTimer();
}

/**
 * Cronómetro del partido (mismo criterio que el scoreboard): cuenta desde
 * que se abrió la vista y avisa con sonido al superar la duración configurada.
 */
function tablesLiveRenderTimer() {
    if (!tablesLiveState || !tablesLiveState.timerStart) return;
    const el = document.getElementById('tables-live-timer');
    if (!el) return;

    const durMin = (tournamentData.settings && tournamentData.settings.duracionPartido) || 15;
    const durSec = durMin * 60;
    const elapsed = Math.floor((Date.now() - tablesLiveState.timerStart) / 1000);
    const remaining = durSec - elapsed;

    if (remaining >= 0) {
        el.textContent = '⏱️ ' + (typeof window.formatTimerTime === 'function' ? window.formatTimerTime(remaining) : '--:--');
        el.style.color = remaining <= 60 ? '#f0a500' : 'var(--accent)';
    } else {
        el.textContent = '⏱️ +' + (typeof window.formatTimerTime === 'function' ? window.formatTimerTime(-remaining) : '--:--');
        el.style.color = '#e74c3c';
        if (!tablesLiveState.timerAlerted) {
            tablesLiveState.timerAlerted = true;
            if (typeof window.playMatchEndSound === 'function') window.playMatchEndSound();
            showToast(t('⏱️ Tiempo límite del partido alcanzado'));
        }
    }
}

/**
 * Reinicia el cronómetro del partido en la vista de mesas.
 */
window.resetTablesLiveTimer = function() {
    if (!tablesLiveState) return;
    tablesLiveState.timerStart = Date.now();
    tablesLiveState.timerAlerted = false;
    tablesLiveRenderTimer();
};

/**
 * Lee los partidos "en vivo": si las tablas del fixture están visibles en la
 * pestaña Fixture se leen del DOM (carga en tiempo real); si no, se usa el
 * último guardado del fixture. Mismo criterio que el scoreboard.
 */
function tablesLiveReadMatches(fixture) {
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
function tablesSetWins(s1, s2) {
    let w = 0;
    for (let i = 0; i < Math.max(s1.length, s2.length); i++) {
        const a = parseInt(s1[i], 10) || 0;
        const b = parseInt(s2[i], 10) || 0;
        if (a > b) w++;
    }
    return w;
}

/**
 * Estado de un partido para la vista de mesas.
 * @returns {{ status: string, winner: number|null, s1: Array, s2: Array, w1: number, w2: number }}
 */
function tablesMatchStatus(m) {
    const s1 = (m.sets && m.sets.player1) || [];
    const s2 = (m.sets && m.sets.player2) || [];
    const w1 = tablesSetWins(s1, s2);
    const w2 = tablesSetWins(s2, s1);
    let status;
    let winner = null;
    if (m.wo) {
        status = 'wo';
        winner = m.woWinnerSide === 2 ? 2 : 1;
    } else if (m.completed && w1 !== w2) {
        status = 'done';
        winner = w1 > w2 ? 1 : 2;
    } else if (w1 !== 0 || w2 !== 0 || s1.some(Boolean) || s2.some(Boolean)) {
        status = 'live';
    } else {
        status = 'pend';
    }
    return { status, winner, s1, s2, w1, w2 };
}

/**
 * Renderiza una fila de partido dentro de una mesa.
 * @param {Object} m - partido (puede no existir en el guardado)
 * @param {Object} s - entrada del schedule
 * @param {boolean} isCurrent - partido en curso / próximo de la mesa
 */
function tablesMatchRow(m, s, isCurrent) {
    const st = tablesMatchStatus(m || {});
    const badges = {
        live: '<span class="tl-badge tl-b-live">● ' + t('EN CURSO') + '</span>',
        done: '<span class="tl-badge tl-b-done">✔ ' + t('FINALIZADO') + '</span>',
        pend: '<span class="tl-badge tl-b-pend">' + t('PENDIENTE') + '</span>',
        wo: '<span class="tl-badge tl-b-wo">W.O.</span>'
    };

    let body = '';
    if (m && m.player1 && m.player2) {
        const p1 = m.player1, p2 = m.player2;
        const setDetail = (st.s1.length || st.s2.length)
            ? '<div class="tl-setdetail">' +
              Array.from({ length: Math.max(st.s1.length, st.s2.length) }, (_, i) =>
                  '<span class="tl-setpair"><b>' + (st.s1[i] || '') + '</b> - <b>' + (st.s2[i] || '') + '</b></span>'
              ).join('') +
              '</div>'
            : '';
        body =
            '<div class="tl-players">' +
                '<div class="tl-player' + (st.winner === 1 ? ' tl-winner' : '') + '"><span class="tl-name">' + escHtml(p1.name) + '</span><span class="tl-club">' + escHtml(p1.club || '') + '</span><span class="tl-sets">' + (st.w1 || '') + '</span></div>' +
                '<div class="tl-player' + (st.winner === 2 ? ' tl-winner' : '') + '"><span class="tl-name">' + escHtml(p2.name) + '</span><span class="tl-club">' + escHtml(p2.club || '') + '</span><span class="tl-sets">' + (st.w2 || '') + '</span></div>' +
            '</div>' + setDetail;
    } else {
        body = '<div class="tl-players"><div class="tl-player"><span class="tl-name">' + escHtml(s.player1 || '—') + '</span></div></div>';
    }

    return '<div class="tl-row' + (isCurrent ? ' tl-current' : '') + (st.status === 'done' ? ' tl-row-done' : '') + '">' +
        '<div class="tl-row-head"><span class="tl-time">' + escHtml(s.hora) + '</span><span class="tl-part">' + t('Partido') + ' ' + s.match + '</span>' + badges[st.status] + '</div>' +
        body +
        (m && m.incidencias ? '<div class="tl-incidencias" style="font-size: 11px; color: #f0a500; padding: 2px 8px 6px 8px;">📝 ' + t('Incidencias:') + ' ' + escHtml(m.incidencias) + '</div>' : '') +
    '</div>';
}

/**
 * Actualiza el contenido de la vista de mesas en vivo.
 */
function tablesLiveTick() {
    if (!tablesLiveState || !tablesLiveState.fixture) return;
    const fixture = tablesLiveState.fixture;
    const matches = tablesLiveReadMatches(fixture);
    const schedule = (fixture.schedule || []).filter(s => s.mesa !== '-' && s.slot >= 0);
    const body = document.getElementById('tables-live-body');
    if (!body) return;

    const byMatch = {};
    matches.forEach((m, i) => { byMatch[m.match || i + 1] = m; });

    const mesas = [...new Set(schedule.map(s => s.mesa))].sort((a, b) => a - b);
    const completed = schedule.filter(s => { const m = byMatch[s.match]; return m && m.completed; }).length;

    const statusEl = document.getElementById('tables-live-status');
    if (statusEl) {
        statusEl.textContent = mesas.length + ' ' + t('mesas') + ' · ' + completed + ' / ' + schedule.length + ' ' + t('partidos finalizados');
    }

    body.innerHTML = mesas.map(mesa => {
        const entries = schedule
            .filter(s => s.mesa === mesa)
            .sort((a, b) => a.slot - b.slot);
        const currentMatch = entries.find(s => { const m = byMatch[s.match]; return m && !m.completed; });
        const rows = entries.map(s => tablesMatchRow(byMatch[s.match], s, currentMatch === s)).join('');
        return '<div class="tl-mesa">' +
            '<div class="tl-mesa-head">🪑 ' + t('Mesa') + ' ' + mesa + '</div>' +
            rows +
        '</div>';
    }).join('');
}

// Al cambiar idioma, re-renderiza las mesas en vivo abiertas de inmediato.
window.onLangChange(function() {
    const overlay = document.getElementById('tables-overlay');
    if (overlay && overlay.style.display === 'flex' && tablesLiveState) {
        const head = document.getElementById('tables-live-category');
        if (head) head.textContent = (tablesLiveState.fixture.categoria || '-') + ' · ' + t('Grupo') + ' ' + (tablesLiveState.fixture.grupo || '-');
        tablesLiveTick();
        tablesLiveRenderClock();
    }
});

