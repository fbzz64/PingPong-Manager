// ==========================================
// TESTS/REGLAMENTO.TEST.JS - Reglas ITTF (js/reglamento.js)
// ==========================================

const { suite, test, assert, assertEqual } = require('./runner');
const { loadApp } = require('./env');

suite('REGLAMENTO (ITTFRULES)', () => {
    const env = loadApp();
    const R = env.window.ITTFRULES;

    test('setsToWin por formato', () => {
        assertEqual(R.setsToWin('bo3'), 2, 'bo3');
        assertEqual(R.setsToWin('bo5'), 3, 'bo5');
        assertEqual(R.setsToWin('bo7'), 4, 'bo7');
        assertEqual(R.setsToWin('BO7'), 4, 'mayúsculas');
        assertEqual(R.setsToWin(undefined), 3, 'sin formato');
        assertEqual(R.setsToWin('bo9'), 3, 'formato desconocido');
    });

    test('setColumns por formato', () => {
        assertEqual(R.setColumns('bo3'), 3);
        assertEqual(R.setColumns('bo5'), 5);
        assertEqual(R.setColumns('bo7'), 7);
    });

    test('groupFormat/bracketFormat leen settings y normalizan', () => {
        env.tournamentData.settings.formatoPartidoGrupos = 'bo7';
        env.tournamentData.settings.formatoPartidoLlaves = 'bo3';
        assertEqual(R.groupFormat(), 'bo7');
        assertEqual(R.bracketFormat(), 'bo3');
        env.tournamentData.settings.formatoPartidoGrupos = 'boX';
        env.tournamentData.settings.formatoPartidoLlaves = undefined;
        assertEqual(R.groupFormat(), 'bo5', 'grupos fallback bo5');
        assertEqual(R.bracketFormat(), 'bo5', 'llaves fallback bo5');
    });

    test('isValidSetScore reglas ITTF', () => {
        assert(R.isValidSetScore(11, 9), '11-9 válido');
        assert(!R.isValidSetScore(11, 10), '11-10 inválido (diferencia 1)');
        assert(R.isValidSetScore(12, 10), '12-10 deuce válido');
        assert(R.isValidSetScore(15, 13), 'deuce ilimitado');
        assert(!R.isValidSetScore(10, 10), '10-10 inválido');
        assert(!R.isValidSetScore(0, 0), '0-0 inválido');
        assert(!R.isValidSetScore(-1, 11), 'negativo inválido');
        assert(!R.isValidSetScore('11', 9), 'strings inválidos');
    });

    test('getSetWinner', () => {
        assertEqual(R.getSetWinner(11, 9), 1);
        assertEqual(R.getSetWinner(9, 11), -1);
        assertEqual(R.getSetWinner(11, 10), 0);
    });

    test('setEntered / setPlayed', () => {
        assert(R.setEntered(11, 9), 'ambos cargados');
        assert(!R.setEntered('', 9), 'falta el rival');
        assert(!R.setEntered(null, undefined), 'ambos vacíos');
        assert(R.setPlayed(11, 0), 'al menos uno > 0');
        assert(!R.setPlayed(0, 0), '0-0 no jugado');
    });

    test('countSetWins ignora sets a medias', () => {
        assertEqual(R.countSetWins([11, 9], [8, '']), 1, 'segundo set a medias no cuenta');
        assertEqual(R.countSetWins(['', '', ''], ['', '', '']), 0, 'vacíos');
        assertEqual(R.countSetWins([11, 9, 11], [8, 11, 9]), 2);
    });

    test('matchWinnerBySets bo3/bo5/bo7', () => {
        assertEqual(R.matchWinnerBySets([11, 9], [8, 11], 'bo3'), 0, '1-1 sin decidir bo3');
        assertEqual(R.matchWinnerBySets([11, 9, 11], [8, 11, 9], 'bo3'), 1, '2-1 bo3');
        assertEqual(R.matchWinnerBySets([11, 9], [8, 11], 'bo5'), 0, '2 sets no deciden bo5');
        assertEqual(R.matchWinnerBySets([11, 9, 11], [8, 11, 9], 'bo5'), 0, '2-1 no decide bo5');
        assertEqual(R.matchWinnerBySets([11, 9, 11, 11], [8, 11, 9, 9], 'bo5'), 1, '3-1 bo5');
        assertEqual(R.matchWinnerBySets([11, 9, 11, 9, 11, 11], [8, 11, 8, 11, 8, 9], 'bo7'), 1, '4-2 bo7');
        assertEqual(R.matchWinnerBySets([11, 9, 11, 9, 11, 9, 11], [8, 11, 8, 11, 8, 11, 8], 'bo7'), 1, '4-3 bo7');
        assertEqual(R.matchWinnerBySets([11, 9, 11], [8, 11, 8], 'bo7'), 0, '3-0 no decide bo7');
    });

    test('matchWinnerBySets corta apenas se alcanza la mayoría', () => {
        assertEqual(R.matchWinnerBySets([11, 11, 11, 9, 9], [8, 8, 8, 11, 11], 'bo5'), 1, '3-0 decide bo5 aunque el array siga');
        assertEqual(R.matchWinnerBySets([11, 9, 11, 11, 9], [8, 11, 8, 9, 11], 'bo5'), 1, '3-1 decide bo5');
    });

    test('sets a medias no deciden partido', () => {
        assertEqual(R.matchWinnerBySets([11, '', ''], [8, '', ''], 'bo3'), 0);
    });

    test('matchCompleted / matchUndecided', () => {
        assert(R.matchCompleted([11, 11], [8, 8], 'bo3'), '2-0 completa bo3');
        assert(!R.matchCompleted([11], [8], 'bo3'), 'un set no decide');
        assert(!R.matchUndecided(['', ''], ['', ''], 'bo3'), 'sin datos no está indeciso');
        assert(R.matchUndecided([11], [8], 'bo3'), 'con datos y sin ganador → indeciso');
        assert(R.matchCompleted([11, 9, 11, 9, 11, 9, 11], [8, 11, 8, 11, 8, 11, 8], 'bo7'), '4-3 completa bo7');
    });

    test('invalidSetIndexes', () => {
        assertEqual(R.invalidSetIndexes([11, 11], [10, 9]), [1], '11-10 inválido');
        assertEqual(R.invalidSetIndexes([11, 9], [8, 11]), [], 'válidos');
        assertEqual(R.invalidSetIndexes([11, ''], [8, '']), [], 'en progreso no es inválido');
    });

    test('matchWinnerSide (sets, legado y W.O.)', () => {
        const mk = (s1, s2, extra) => ({
            player1: { name: 'A', club: 'X' },
            player2: { name: 'B', club: 'Y' },
            sets: { player1: s1, player2: s2 },
            ...extra
        });
        assertEqual(R.matchWinnerSide(mk([11, 11, 11], [8, 8, 8])), 1, 'por sets gana P1');
        assertEqual(R.matchWinnerSide(mk([8, 8, 8], [11, 11, 11])), -1, 'por sets gana P2');
        assertEqual(R.matchWinnerSide(mk([11], [8])), 0, 'sin decidir');
        assertEqual(R.matchWinnerSide(mk([], [], { wo: true, woWinnerSide: 1 })), 1, 'W.O. gana P1');
        assertEqual(R.matchWinnerSide(mk([], [], { wo: true, woWinnerSide: 2 })), -1, 'W.O. gana P2');
        assertEqual(R.matchWinnerSide(mk(['11', '11', '11'], ['0', '0', '0'], { wo: true })), 1, 'W.O. por sets 11-0');
        assertEqual(R.matchWinnerSide(mk([11, 9, 11], [8, 11, 9], { winnerSide: 1, completed: true })), 1, 'usa winnerSide explícito');
    });

    test('matchPointsFor ITTF (2/1/0)', () => {
        const mk = (s1, s2, extra) => ({
            player1: { name: 'A', club: 'X' },
            player2: { name: 'B', club: 'Y' },
            sets: { player1: s1, player2: s2 },
            completed: true,
            ...extra
        });
        assertEqual(R.matchPointsFor(mk([11, 11, 11], [8, 8, 8]), 'A', 'X'), 2, 'victoria = 2');
        assertEqual(R.matchPointsFor(mk([11, 11, 11], [8, 8, 8]), 'B', 'Y'), 1, 'derrota jugada = 1');
        assertEqual(R.matchPointsFor(mk([11, 11, 11], [8, 8, 8], { wo: true, woWinnerSide: 1 }), 'B', 'Y'), 0, 'derrota W.O. = 0');
        const incomplete = { player1: { name: 'A', club: 'X' }, player2: { name: 'B', club: 'Y' }, sets: { player1: [11], player2: [8] }, completed: false };
        assertEqual(R.matchPointsFor(incomplete, 'A', 'X'), 0, 'no completado = 0');
        assertEqual(R.matchPointsFor(mk([11, 11], [8, 8]), 'Z', 'Q'), 0, 'jugador ajeno = 0');
    });

    test('groupStandings: empate a puntos se resuelve por cociente de sets', () => {
        env.tournamentData.settings.formatoPartidoGrupos = 'bo3';
        const players = [{ name: 'A', club: 'X' }, { name: 'B', club: 'X' }, { name: 'C', club: 'X' }];
        const m = (n1, n2, s1, s2) => ({
            player1: { name: n1, club: 'X' }, player2: { name: n2, club: 'X' },
            sets: { player1: s1, player2: s2 }, completed: true
        });
        const matches = [
            m('A', 'B', [11, 11], [8, 9]),          // A gana 2-0 (sets 2-0)
            m('A', 'C', [11, 9, 8], [8, 11, 11]),   // C gana 2-1 (A 1-2)
            m('B', 'C', [11, 11], [8, 7])           // B gana 2-0 (B 2-0)
        ];
        const st = R.groupStandings(players, matches);
        // Todos empatan a 3 puntos → desempata el cociente de sets:
        // A (3-2 = 1.5), B (2-2 = 1.0), C (2-3 ≈ 0.667)
        assertEqual(st.map(s => s.name), ['A', 'B', 'C'], 'orden por cociente de sets');
        assertEqual(st.map(s => s.rank), [1, 2, 3], 'rangos');
        assertEqual(st.map(s => s.matchPoints), [3, 3, 3], 'todos 3 puntos');
        assertEqual(st.map(s => s.setsWon), [3, 2, 2], 'sets ganados');
        assertEqual(st.map(s => s.setsLost), [2, 2, 3], 'sets perdidos');
        assertEqual(st[0].matchesWon, 1, 'A ganó 1 partido');
    });

    test('groupStandings: W.O. no suma sets y da 0 puntos al ausente', () => {
        const players = [{ name: 'A', club: 'X' }, { name: 'B', club: 'X' }];
        const wo = {
            player1: { name: 'A', club: 'X' }, player2: { name: 'B', club: 'X' },
            sets: { player1: ['11', '11', '11'], player2: ['0', '0', '0'] },
            completed: true, wo: true, woWinnerSide: 1
        };
        const st = R.groupStandings(players, [wo]);
        const a = st.find(s => s.name === 'A');
        const b = st.find(s => s.name === 'B');
        assertEqual(a.matchPoints, 2, 'A gana por W.O. = 2 puntos');
        assertEqual(b.matchPoints, 0, 'B ausente = 0 puntos');
        assertEqual(a.setsWon, 0, 'sets de W.O. no cuentan');
        assertEqual(b.setsWon, 0, 'sets de W.O. no cuentan');
        assertEqual(a.matchesWon, 1, 'A 1 victoria');
        assertEqual(b.matchesLost, 1, 'B 1 derrota');
        assertEqual(st[0].name, 'A', 'A primero');
    });

    test('groupStandings: gana más puntos aunque pierda en sets', () => {
        env.tournamentData.settings.formatoPartidoGrupos = 'bo3';
        const players = [{ name: 'A', club: 'X' }, { name: 'B', club: 'X' }];
        const m = (n1, n2, s1, s2) => ({
            player1: { name: n1, club: 'X' }, player2: { name: n2, club: 'X' },
            sets: { player1: s1, player2: s2 }, completed: true
        });
        // B gana 2-1 en BO3: B 2 puntos, A 1, aunque A ganó el primer set
        const matches = [m('A', 'B', [11, 9, 8], [8, 11, 11])];
        const st = R.groupStandings(players, matches);
        assertEqual(st[0].name, 'B', 'B ganó el partido');
        assertEqual(st[0].matchPoints, 2, 'B 2 puntos');
        assertEqual(st[1].matchPoints, 1, 'A 1 punto');
        assertEqual(st[0].setsWon, 2, 'B ganó 2 sets');
        assertEqual(st[1].setsWon, 1, 'A ganó 1 set');
    });
});
