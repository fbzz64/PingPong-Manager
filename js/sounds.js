// ==========================================
// NOTIFICACIONES SONORAS
// ==========================================
// Suenan al completarse un partido y cuando llega la hora de un partido
// programado (Multiplex). Se pueden desactivar desde Configuración.
// Genera los tonos con Web Audio API: sin archivos externos (PWA offline).

let soundsAudioCtx = null;

// Retorna el contexto de audio creándolo a demanda (evita bloquear la carga).
function soundsGetCtx() {
    try {
        if (!soundsAudioCtx) {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) return null;
            soundsAudioCtx = new Ctor();
        }
        if (soundsAudioCtx.state === 'suspended' && typeof soundsAudioCtx.resume === 'function') {
            try { soundsAudioCtx.resume(); } catch (e) {}
        }
        return soundsAudioCtx;
    } catch (e) {
        return null;
    }
}

// Envía un tono simple al contexto de audio.
function soundsBeep(freq, delaySec, durSec, type, gainVal) {
    const ctx = soundsGetCtx();
    if (!ctx) return;
    try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + (delaySec || 0);
        osc.type = type || 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(gainVal || 0.2, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + (durSec || 0.3));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + (durSec || 0.3) + 0.05);
    } catch (e) {}
}

// ¿Están habilitados los sonidos? (settings.soundEnabled, por defecto sí)
window.areSoundsEnabled = function() {
    if (!tournamentData || !tournamentData.settings) return true;
    return tournamentData.settings.soundEnabled !== false;
};

// Sincroniza el checkbox de Configuración con la preferencia guardada.
window.syncSoundsEnabled = function() {
    const el = document.getElementById('soundEnabled');
    if (!el || !tournamentData || !tournamentData.settings) return;
    el.checked = tournamentData.settings.soundEnabled !== false;
};

// Sonido de fin de partido: dos tonos ascendentes y alegres.
window.playMatchEndSound = function() {
    if (!window.areSoundsEnabled()) return;
    soundsBeep(660, 0, 0.18, 'sine', 0.18);
    soundsBeep(880, 0.18, 0.25, 'sine', 0.18);
};

// Sonido de inicio de partido programado: dos tonos cortos repetidos.
window.playMatchStartSound = function() {
    if (!window.areSoundsEnabled()) return;
    soundsBeep(523, 0, 0.12, 'triangle', 0.16);
    soundsBeep(523, 0.15, 0.12, 'triangle', 0.16);
    soundsBeep(784, 0.30, 0.25, 'triangle', 0.16);
};

// ==========================================
// CHECKER DE HORARIOS PROGRAMADOS (MULTIPLEX)
// ==========================================
// Cada 30 s compara la hora actual con la de cada partido pendiente. Cuando un
// partido programado alcanza su hora, suena una vez (no se repite hasta que el
// partido se completa, lo que habilita el siguiente aviso al re-programarlo).

let soundsNotified = {};

// Limpia el historial de avisos de un partido para poder re-notificar.
window.resetScheduledMatchNotification = function(fixtureId, match) {
    delete soundsNotified[fixtureId + '-' + match];
};

// Verifica los horarios de todos los fixtures con programación Multiplex.
// Agrupa por horario: suena UNA sola vez y muestra un toast consolidado.
window.checkScheduledMatchTimes = function() {
    if (!window.areSoundsEnabled()) return;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const due = []; // [{p1, p2, time, fixtureId, match}]

    (tournamentData.fixtures || []).forEach(fixture => {
        const schedule = fixture.schedule;
        if (!schedule || !Array.isArray(schedule)) return;
        const matches = fixture.matches || [];

        schedule.forEach(s => {
            if (!s || s.slot < 0) return;
            const m = matches[s.match - 1];
            if (!m) return;
            if (m.completed) return;

            const hhmm = String(s.hora || '').split(':').map(Number);
            if (hhmm.length < 2 || isNaN(hhmm[0]) || isNaN(hhmm[1])) return;
            const matchMin = hhmm[0] * 60 + hhmm[1];

            const key = fixture.id + '-' + s.match;
            if (nowMin >= matchMin && !soundsNotified[key]) {
                soundsNotified[key] = true;
                const p1 = (s.player1 || m.player1 || {}).name || '?';
                const p2 = (s.player2 || m.player2 || {}).name || '?';
                due.push({ p1, p2, time: s.hora, fixtureId: fixture.id, match: s.match });
            }
        });
    });

    if (due.length === 0) return;

    // Un solo sonido para todos los partidos simultáneos
    window.playMatchStartSound();

    if (typeof showToast === 'function') {
        if (due.length === 1) {
            showToast(t('🔔 Hora de partido:') + ' ' + due[0].p1 + ' vs ' + due[0].p2);
        } else {
            showToast(t('🔔 Hora de partido:') + ' ' + due.length + ' ' + t('partidos simultáneos') + ' (' + due[0].time + ')');
        }
    }
    if (typeof addLog === 'function') {
        due.forEach(d => {
            addLog('SONIDO', t('Aviso sonoro de horario:') + ' ' + d.p1 + ' vs ' + d.p2);
        });
    }
};

// ==========================================
// WAKE LOCK (EVITAR APAGADO DE PANTALLA)
// ==========================================
// Mantiene encendida la pantalla mientras se proyecta el Scoreboard o las
// Mesas en vivo. Solo aplica donde el dispositivo lo soporta y no está en
// modo de ahorro de energía; se libera automáticamente al perder visibilidad.

let screenWakeLockRequest = null;

window.requestScreenWakeLock = function() {
    try {
        if (!('wakeLock' in navigator)) return false;
        if (screenWakeLockRequest) return true; // ya activo
        const promise = navigator.wakeLock.request('screen');
        screenWakeLockRequest = promise; // marca como activo de inmediato
        promise.then(wl => {
            screenWakeLockRequest = wl;
            wl.addEventListener('release', () => {
                screenWakeLockRequest = null;
            });
        }).catch(() => {
            screenWakeLockRequest = null;
        });
        return true;
    } catch (e) {
        return false;
    }
};

window.releaseScreenWakeLock = function() {
    try {
        const req = screenWakeLockRequest;
        screenWakeLockRequest = null;
        if (req && typeof req.release === 'function') {
            req.release().catch(() => {});
        }
        return true;
    } catch (e) {
        return false;
    }
};

// Si la pestaña se oculta, el wake lock se libera solo; al volver a estar
// visible se re-solicita para que la proyección no se apague a mitad de ronda.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && typeof window.requestScreenWakeLock === 'function') {
        window.requestScreenWakeLock();
    }
});

// ==========================================
// INICIALIZACIÓN
// ==========================================

// La detección de fin de partido vive en stats.js (liveScoreBlur) y
// fixtures.js (saveFixtureData): allí se comparan los estados previos y se
// llama a playMatchEndSound() solo cuando un partido pasa a completado.
setInterval(() => {
    if (typeof window.checkScheduledMatchTimes === 'function') window.checkScheduledMatchTimes();
}, 30000); // 30 segundos
