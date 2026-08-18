// ==========================================
// TESTS/SOUNDS.TEST.JS - Notificaciones sonoras y Wake Lock (js/sounds.js)
// ==========================================

const vm = require('vm');
const { suite, test, assert, assertEqual } = require('./runner');
const { createEnv, loadInto } = require('./env');

suite('SOUNDS (sounds.js)', () => {
    const intervals = [];
    const toasts = [];
    const logs = [];
    const wakeLocks = [];

    const docListeners = {};
    const env = createEnv({
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        document: {
            getElementById: () => ({ value: '', checked: false, textContent: '' }),
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: (ev, fn) => { (docListeners[ev] = docListeners[ev] || []).push(fn); },
            createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {} }),
            head: { appendChild() {} },
            body: { appendChild() {} }
        },
        navigator: {
            wakeLock: {
                request: () => {
                    const wl = {
                        released: false,
                        addEventListener: () => {},
                        release: () => {
                            wl.released = true;
                            return Promise.resolve();
                        }
                    };
                    wakeLocks.push(wl);
                    return Promise.resolve(wl);
                }
            }
        }
    });

    const S = env.sandbox;
    S.showToast = (msg) => toasts.push(msg);
    S.addLog = (a, d) => logs.push([a, d]);
    loadInto(env, 'js/i18n.js');
    loadInto(env, 'js/sounds.js');

    const TD = () => vm.runInContext('tournamentData', env.ctx);

    test('areSoundsEnabled: por defecto true y false si se desactiva', () => {
        TD().settings.soundEnabled = undefined;
        assertEqual(S.areSoundsEnabled(), true, 'sin valor → true');
        TD().settings.soundEnabled = false;
        assertEqual(S.areSoundsEnabled(), false, 'false → false');
        TD().settings.soundEnabled = true;
        assertEqual(S.areSoundsEnabled(), true, 'true → true');
    });

    test('playMatchEndSound / playMatchStartSound no rompen sin audio', () => {
        S.playMatchEndSound();
        S.playMatchStartSound();
        assert(true, 'no lanza con AudioContext ausente');
    });

    test('checkScheduledMatchTimes: avisa una sola vez cuando llega la hora', () => {
        const fixture = {
            id: 111,
            matches: [
                { player1: { name: 'A' }, player2: { name: 'B' }, completed: false }
            ],
            schedule: [
                { match: 1, player1: 'A', player2: 'B', mesa: 1, hora: '00:00', slot: 0 }
            ]
        };
        TD().fixtures = [fixture];
        TD().settings.soundEnabled = true;

        const before = toasts.length;
        S.checkScheduledMatchTimes();
        const after = toasts.length;
        assertEqual(after - before, 1, 'suena una vez al llegar la hora');
        assert(toasts[toasts.length - 1].includes('🔔'), 'toast de aviso de horario');

        // Segunda llamada en la misma hora: no se repite
        S.checkScheduledMatchTimes();
        assertEqual(toasts.length - after, 0, 'no se repite en la misma hora');
    });

    test('checkScheduledMatchTimes: no avisa partidos completados ni sin cupo', () => {
        TD().fixtures = [
            {
                id: 222,
                matches: [{ player1: {}, player2: {}, completed: true }],
                schedule: [{ match: 1, player1: 'A', player2: 'B', mesa: 1, hora: '00:00', slot: 0 }]
            },
            {
                id: 333,
                matches: [{ player1: {}, player2: {}, completed: false }],
                schedule: [{ match: 1, player1: 'A', player2: 'B', mesa: '-', hora: '00:00', slot: -1 }]
            }
        ];
        const before = toasts.length;
        S.checkScheduledMatchTimes();
        assertEqual(toasts.length - before, 0, 'ni completado ni sin cupo suenan');
    });

    test('resetScheduledMatchNotification habilita re-notificar', () => {
        const fixture = {
            id: 444,
            matches: [{ player1: { name: 'A' }, player2: { name: 'B' }, completed: false }],
            schedule: [{ match: 1, player1: 'A', player2: 'B', mesa: 1, hora: '00:00', slot: 0 }]
        };
        TD().fixtures = [fixture];
        const before = toasts.length;
        S.checkScheduledMatchTimes();
        const first = toasts.length - before;
        assertEqual(first, 1, 'primera vez suena');

        S.checkScheduledMatchTimes();
        assertEqual(toasts.length - before, 1, 'no repite hasta resetear');

        S.resetScheduledMatchNotification(444, 1);
        S.checkScheduledMatchTimes();
        assertEqual(toasts.length - before, 2, 'tras reset vuelve a sonar');
    });

    test('requestScreenWakeLock / releaseScreenWakeLock', async () => {
        const requested = S.requestScreenWakeLock();
        assertEqual(requested, true, 'solicita el wake lock');
        await Promise.resolve(); // dejar resolver navigator.wakeLock.request
        assertEqual(wakeLocks.length, 1, 'navigator.wakeLock.request llamado');
        assertEqual(wakeLocks[0].released, false, 'aún no liberado');

        // Ya activo: no vuelve a pedir
        S.requestScreenWakeLock();
        await Promise.resolve();
        assertEqual(wakeLocks.length, 1, 'no re-solicita si ya está activo');

        S.releaseScreenWakeLock();
        assertEqual(wakeLocks[0].released, true, 'release() invocado al cerrar');
    });

    test('registra el intervalo de verificación de horarios (30 s)', () => {
        const checker = intervals.find(i => i.ms === 30000);
        assert(checker, 'intervalo de 30 s registrado');
        assertEqual(typeof checker.fn, 'function', 'el callback es invocable');
    });
});
