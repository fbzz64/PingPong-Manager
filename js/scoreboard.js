// ==========================================
// SCOREBOARD.JS - Panel de partido en vivo (pantalla completa)
// ==========================================
// Muestra un fixture en pantalla completa con actualización automática:
// cada 3 segundos relee las tablas del fixture si están visibles en la
// pestaña Fixture (carga de resultados en vivo) o el último guardado.
// ==========================================

let scoreboardState = null; // { fixture, timer, clockTimer }

/**
 * Abre el selector de fixture para el scoreboard en vivo.
 */
window.openScoreboard = function() {
    const fixtures = (tournamentData.fixtures || []).filter(f =>
        Array.isArray(f.matches) && f.matches.length > 0
    );
    if (fixtures.length === 0) {
        showToast(t('No hay fixtures guardados para mostrar en vivo'), 'warning');
        return;
    }

    const opts = fixtures.map(f => {
        const done = (f.matches || []).filter(m => m.completed).length;
        return '<option value="' + f.id + '">' + escHtml(f.categoria) + ' · ' + t('Grupo') + ' ' + escHtml(f.grupo) + ' (' + f.matches.length + ' ' + t('partidos') + ', ' + done + ' ' + t('finalizados') + ')</option>';
    }).join('');

    showModal(
        t('📺 Scoreboard en vivo'),
        '<div style="color: var(--text-color);">' +
            '<p style="font-size: 13px; color: var(--text-muted); margin: 0 0 10px 0;">' + t('Elegí el grupo a proyectar. El panel se actualiza automáticamente cada 3 segundos con la carga de resultados en vivo.') + '</p>' +
            '<select id="scoreboard-fixture" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">' + opts + '</select>' +
            '<button class="btn btn-primary" style="width: 100%; margin-top: 12px;" onclick="startScoreboard(parseInt(document.getElementById(\'scoreboard-fixture\').value))">🎬 ' + t('Abrir pantalla completa') + '</button>' +
        '</div>',
        null,
        t('Cerrar')
    );
};

/**
 * Abre el scoreboard en pantalla completa para un fixture.
 * @param {number|string} fixtureId
 */
window.startScoreboard = function(fixtureId) {
    const fixture = (tournamentData.fixtures || []).find(f => String(f.id) === String(fixtureId));
    if (!fixture) {
        showToast(t('Fixture no encontrado'), 'error');
        return;
    }

    const overlay = document.getElementById('scoreboard-overlay');
    if (!overlay) return;
    closeScoreboard();

    scoreboardState = { fixture, timerStart: Date.now(), timerAlerted: false };
    overlay.style.display = 'flex';

    scoreboardTick();
    scoreboardState.timer = setInterval(scoreboardTick, 3000);
    scoreboardState.clockTimer = setInterval(scoreboardRenderClock, 1000);

    document.getElementById('scoreboard-category').textContent =
        (fixture.categoria || '-') + ' · ' + t('Grupo') + ' ' + (fixture.grupo || '-');
    scoreboardRenderClock();
    if (typeof window.requestScreenWakeLock === 'function') window.requestScreenWakeLock();
    showToast(t('📺 Scoreboard en vivo activado'));
    addLog('SCOREBOARD', t('Scoreboard en vivo abierto:') + ' ' + fixture.categoria + ' - ' + t('Grupo') + ' ' + fixture.grupo);
};

/**
 * Cierra el scoreboard y detiene la actualización automática.
 */
window.closeScoreboard = function() {
    if (scoreboardState) {
        if (scoreboardState.timer) clearInterval(scoreboardState.timer);
        if (scoreboardState.clockTimer) clearInterval(scoreboardState.clockTimer);
        scoreboardState = null;
    }
    const overlay = document.getElementById('scoreboard-overlay');
    if (overlay) overlay.style.display = 'none';
    if (typeof window.releaseScreenWakeLock === 'function') window.releaseScreenWakeLock();
};

/**
 * Actualiza el reloj del header del scoreboard.
 */
function scoreboardRenderClock() {
    const el = document.getElementById('scoreboard-clock');
    if (el) el.textContent = new Date().toLocaleTimeString(window.i18nLocale());
    scoreboardRenderTimer();
}

/**
 * Formatea segundos como mm:ss (compartido con la vista de mesas).
 */
window.formatTimerTime = function(totalSec) {
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
};

/**
 * Cronómetro del partido: cuenta el tiempo desde que se abrió el scoreboard
 * y avisa con sonido cuando se supera la duración configurada (una sola vez).
 */
function scoreboardRenderTimer() {
    if (!scoreboardState || !scoreboardState.timerStart) return;
    const el = document.getElementById('scoreboard-timer');
    if (!el) return;

    const durMin = (tournamentData.settings && tournamentData.settings.duracionPartido) || 15;
    const durSec = durMin * 60;
    const elapsed = Math.floor((Date.now() - scoreboardState.timerStart) / 1000);
    const remaining = durSec - elapsed;

    if (remaining >= 0) {
        el.textContent = '⏱️ ' + window.formatTimerTime(remaining);
        el.style.color = remaining <= 60 ? '#f0a500' : 'var(--accent)';
    } else {
        el.textContent = '⏱️ +' + window.formatTimerTime(-remaining);
        el.style.color = '#e74c3c';
        if (!scoreboardState.timerAlerted) {
            scoreboardState.timerAlerted = true;
            if (typeof window.playMatchEndSound === 'function') window.playMatchEndSound();
            showToast(t('⏱️ Tiempo límite del partido alcanzado'));
        }
    }
}

/**
 * Reinicia el cronómetro del partido (llamado al cargar un nuevo partido).
 */
window.resetScoreboardTimer = function() {
    if (!scoreboardState) return;
    scoreboardState.timerStart = Date.now();
    scoreboardState.timerAlerted = false;
    scoreboardRenderTimer();
};

/**
 * Lee los partidos "en vivo": si las tablas del fixture están visibles en la
 * pestaña Fixture se leen del DOM (carga en tiempo real); si no, se usa el
 * último guardado del fixture.
 */
function scoreboardReadMatches(fixture) {
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
function scoreboardSetWins(s1, s2) {
    let w = 0;
    for (let i = 0; i < Math.max(s1.length, s2.length); i++) {
        const a = parseInt(s1[i], 10) || 0;
        const b = parseInt(s2[i], 10) || 0;
        if (a > b) w++;
    }
    return w;
}

/**
 * Renderiza un partido del scoreboard.
 */
function scoreboardMatchCard(m) {
    const p1 = m.player1 || {};
    const p2 = m.player2 || {};
    const s1 = (m.sets && m.sets.player1) || [];
    const s2 = (m.sets && m.sets.player2) || [];
    const w1 = scoreboardSetWins(s1, s2);
    const w2 = scoreboardSetWins(s2, s1);

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

    const schedule = scoreboardScheduleFor(m.match);
    const scheduleHTML = schedule ? '<div class="sc-schedule">🕐 ' + escHtml(schedule.hora) + ' · ' + t('Mesa') + ' ' + escHtml(schedule.mesa) + '</div>' : '';
    const incHTML = m.incidencias ? '<div class="sc-schedule" style="color: #f0a500;">📝 ' + t('Incidencias:') + ' ' + escHtml(m.incidencias) + '</div>' : '';

    return `
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
            ${m.referee ? '<div class="sc-ref">' + t('Árbitro:') + ' ' + escHtml(m.referee) + '</div>' : ''}
        </div>`;
}

/**
 * Busca la programación (mesa/hora) del partido en el fixture activo.
 */
function scoreboardScheduleFor(matchNum) {
    if (!scoreboardState || !scoreboardState.fixture) return null;
    return (scoreboardState.fixture.schedule || []).find(s => s.match === matchNum && s.mesa !== '-' && s.hora !== '-') || null;
}

/**
 * Actualiza el contenido del scoreboard.
 */
function scoreboardTick() {
    if (!scoreboardState || !scoreboardState.fixture) return;
    const matches = scoreboardReadMatches(scoreboardState.fixture);
    const body = document.getElementById('scoreboard-body');
    if (!body) return;

    const total = matches.length;
    const done = matches.filter(m => m.completed).length;

    const statusEl = document.getElementById('scoreboard-status');
    if (statusEl) {
        statusEl.textContent = done + ' / ' + total + ' ' + t('partidos finalizados');
    }

    body.innerHTML = matches.map(scoreboardMatchCard).join('');
}

// Al cambiar idioma, re-renderiza el scoreboard abierto para traducir los
// textos dinámicos (FINALIZADO, EN CURSO, etc.) de inmediato.
window.onLangChange(function() {
    const overlay = document.getElementById('scoreboard-overlay');
    if (overlay && overlay.style.display === 'flex' && scoreboardState) {
        const head = document.getElementById('scoreboard-category');
        if (head) head.textContent = (scoreboardState.fixture.categoria || '-') + ' · ' + t('Grupo') + ' ' + (scoreboardState.fixture.grupo || '-');
        scoreboardTick();
        scoreboardRenderClock();
    }
});

