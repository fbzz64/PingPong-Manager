// ==========================================
// TESTS/TVBOARD.TEST.JS - Cartelera TV y cronómetro
// (js/tvboard.js + js/scoreboard.js + js/tables.js)
// ==========================================

const { suite, test, assert, assertEqual } = require('./runner');
const { createEnv, loadInto } = require('./env');

suite('TVBOARD (cartelera TV y cronómetro)', () => {
    const env = createEnv();
    const S = env.sandbox;

    const stubs = {
        showToast: () => {},
        addLog: () => {},
        escHtml: (s) => String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
        escAttr: (s) => String(s == null ? '' : s).replace(/"/g, '&quot;'),
        formatPlayerName: (n) => String(n == null ? '' : n),
        formatPlayerClub: (c) => String(c == null ? '' : c)
    };
    for (const [k, v] of Object.entries(stubs)) { S[k] = v; S.window[k] = v; }

    loadInto(env, 'js/i18n.js');
    loadInto(env, 'js/reglamento.js');
    loadInto(env, 'js/storage.js');
    loadInto(env, 'js/brackets.js');
    loadInto(env, 'js/scoreboard.js');
    loadInto(env, 'js/tables.js');
    loadInto(env, 'js/tvboard.js');

    test('formatTimerTime formatea segundos a mm:ss', () => {
        assertEqual(S.formatTimerTime(0), '00:00');
        assertEqual(S.formatTimerTime(59), '00:59');
        assertEqual(S.formatTimerTime(60), '01:00');
        assertEqual(S.formatTimerTime(900), '15:00');
        assertEqual(S.formatTimerTime(65), '01:05');
    });

    test('tvboard: sin fixtures → openTVBoard no rompe y avisa', () => {
        env.tournamentData.fixtures = [];
        let toastMsg = null;
        S.showToast = (m) => { toastMsg = m; };
        S.openTVBoard();
        assert(toastMsg && /no hay fixtures/i.test(toastMsg), 'avisa que no hay fixtures');
    });

    test('tvboard: renderiza tarjetas por grupo con estados de partido', () => {
        env.tournamentData.fixtures = [
            {
                categoria: 'Libres', grupo: 'A',
                matches: [
                    {
                        match: 1,
                        player1: { name: 'Ana', club: 'X' },
                        player2: { name: 'Beto', club: 'Y' },
                        sets: { player1: ['11', '8'], player2: ['9', '11'] },
                        completed: false, wo: false, incidencias: 'Protesta'
                    },
                    {
                        match: 2,
                        player1: { name: 'Carla', club: 'Z' },
                        player2: { name: 'Damian', club: 'W' },
                        sets: { player1: ['11', '11'], player2: ['5', '7'] },
                        completed: true, wo: false
                    }
                ]
            }
        ];

        // Overlay y body con innerHTML capturable
        const overlays = {};
        S.document.getElementById = (id) => {
            if (!overlays[id]) overlays[id] = { id, style: {}, textContent: '', innerHTML: '' };
            return overlays[id];
        };
        S.setInterval = () => 1;
        S.clearInterval = () => {};

        S.openTVBoard();
        const body = overlays['tvboard-body'].innerHTML;
        assert(body.includes('Libres'), 'muestra la categoría');
        assert(body.includes('EN CURSO'), 'partido en curso marcado');
        assert(body.includes('FINALIZADO'), 'partido finalizado marcado');
        assert(body.includes('Protesta'), 'muestra las incidencias');
        assert(/1 \/ 2/.test(overlays['tvboard-status'].textContent), 'contador 1/2 en el status');

        // Cerrar no rompe
        S.closeTVBoard();
        assertEqual(overlays['tvboard-overlay'].style.display, 'none', 'overlay oculto');
    });

    test('tvboard: el reloj del header se actualiza sin romper', () => {
        const overlays = {};
        S.document.getElementById = (id) => {
            if (!overlays[id]) overlays[id] = { id, style: {}, textContent: '', innerHTML: '' };
            return overlays[id];
        };
        S.openTVBoard();
        const clock = overlays['tvboard-clock'].textContent;
        assert(/^\d{2}:\d{2}/.test(clock), 'reloj con hora local: ' + clock);
        S.closeTVBoard();
    });
});
