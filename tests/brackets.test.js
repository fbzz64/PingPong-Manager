// ==========================================
// TESTS/BRACKETS.TEST.JS - Llaves eliminatorias (js/brackets.js)
// ==========================================

const { suite, test, assert, assertEqual } = require('./runner');
const { loadApp } = require('./env');

suite('LLAVES (brackets)', () => {
    const env = loadApp();
    const B = env.sandbox;

    test('newBracketMatch crea slots de sets según formato', () => {
        env.tournamentData.settings.formatoPartidoLlaves = 'bo3';
        assertEqual(B.newBracketMatch(null, null).sets.p1.length, 3, 'bo3 → 3');
        env.tournamentData.settings.formatoPartidoLlaves = 'bo5';
        assertEqual(B.newBracketMatch(null, null).sets.p1.length, 5, 'bo5 → 5');
        env.tournamentData.settings.formatoPartidoLlaves = 'bo7';
        const m = B.newBracketMatch(null, null);
        assertEqual(m.sets.p1.length, 7, 'bo7 → 7');
        assertEqual(m.sets.p2.length, 7, 'bo7 → 7 por lado');
        assertEqual(m.completed, false, 'arranca sin completar');
        assertEqual(m.winnerSide, -1, 'sin ganador');
    });

    test('buildAutoBracketRounds: estructura con 8 jugadores', () => {
        const players = [1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ name: 'P' + i, club: 'X', seed: i }));
        const rounds = B.buildAutoBracketRounds(players, 8);
        assertEqual(rounds[0].title, 'Cuartos de Final');
        assertEqual(rounds[0].matches.length, 4);
        assertEqual(rounds.length, 4, 'cuartos + semis + final + tercer puesto');
        assertEqual(rounds[3].title, 'Tercer Puesto');
        rounds[0].matches.forEach(m => assert(!m.bye, 'sin byes con 8 jugadores'));
    });

    test('buildAutoBracketRounds: byes con jugadores impares', () => {
        const players = [1, 2, 3, 4, 5].map(i => ({ name: 'P' + i, club: 'X', seed: i }));
        const rounds = B.buildAutoBracketRounds(players, 5);
        assertEqual(rounds[0].title, 'Cuartos de Final', 'T=8 → cuartos');
        assertEqual(rounds[0].matches.length, 4);
        const byes = rounds[0].matches.filter(m => m.bye);
        assert(byes.length > 0, 'debe haber byes');
        byes.forEach(m => {
            assert(m.completed, 'bye resuelto directo');
            assert(m.winnerSide >= 0, 'bye tiene ganador');
        });
        const semis = rounds.find(r => /^semifinales$/i.test(r.title)).matches;
        const advanced = semis.filter(m => m.p1 && !/^tbd$/i.test(m.p1.name));
        assert(advanced.length > 0, 'ganadores de byes avanzaron a semis');
    });

    test('computeBracketMatch: ganador por sets', () => {
        env.tournamentData.settings.formatoPartidoLlaves = 'bo5';
        const bracket = {
            rounds: [{ title: 'Semifinales', matches: [B.newBracketMatch({ name: 'A', club: 'X' }, { name: 'B', club: 'Y' })] }]
        };
        const m = bracket.rounds[0].matches[0];
        m.sets.p1 = ['11', '9', '11', '11'];
        m.sets.p2 = ['8', '11', '8', '9'];
        const w = B.computeBracketMatch(bracket, 0, 0);
        assertEqual(w, 0, 'winnerSide 0 = p1');
        assertEqual(m.winner.name, 'A');
        assert(m.completed, 'partido completado');
    });

    test('computeBracketMatch: W.O. tiene ganador directo', () => {
        env.tournamentData.settings.formatoPartidoLlaves = 'bo5';
        const bracket = {
            rounds: [{ title: 'Semifinales', matches: [B.newBracketMatch({ name: 'C', club: 'X' }, { name: 'D', club: 'Y' })] }]
        };
        const m = bracket.rounds[0].matches[0];
        m.wo = true;
        m.woWinnerSide = 0; // P2 (D) no se presentó → avanza P1 (C)
        const w = B.computeBracketMatch(bracket, 0, 0);
        assertEqual(w, 0, 'winnerSide 0 = p1');
        assertEqual(m.winner.name, 'C');
        assertEqual(m.winnerSide, 0);
        assert(m.completed, 'W.O. completa el partido');
    });

    test('W.O. bo7: llena 11-0 en 4 sets, avanza ganador y undo restaura slots', () => {
        env.tournamentData.settings.formatoPartidoLlaves = 'bo7';
        const bracket = {
            categoria: 'C1',
            rounds: [
                { title: 'Semifinales', matches: [] },
                { title: 'Final', matches: [B.newBracketMatch(null, null)] },
                { title: 'Tercer Puesto', matches: [B.newBracketMatch(null, null)] }
            ]
        };
        bracket.rounds[0].matches = [
            B.newBracketMatch({ name: 'A', club: 'X' }, { name: 'B', club: 'Y' }),
            B.newBracketMatch({ name: 'C', club: 'X' }, { name: 'D', club: 'Y' })
        ];
        const m = bracket.rounds[0].matches[0];
        B.applyBracketWO(bracket, 0, 0, 0); // B no se presentó → avanza A

        assert(m.wo, 'marcado W.O.');
        assertEqual(m.sets.p1.length, 7, 'mantiene 7 slots bo7');
        assertEqual(m.sets.p1[0], '11', 'A gana primer set 11-0');
        assertEqual(m.sets.p2[0], '0');
        assertEqual(m.sets.p1[3], '11', '4to set (need=4 en bo7)');
        assertEqual(m.sets.p1[4], '', '5to set no jugado queda vacío');
        assertEqual(m.completed, true);
        assertEqual(m.winner.name, 'A');

        const final = bracket.rounds[1].matches[0];
        assertEqual(final.p1.name, 'A', 'ganador del W.O. avanzó a la final');

        B.undoBracketWO(bracket, 0, 0);
        assertEqual(m.wo, false, 'W.O. quitado');
        assertEqual(m.sets.p1.length, 7, 'slots restaurados bo7');
        assert(m.sets.p1.every(s => s === ''), 'slots vacíos tras undo');
        assertEqual(m.completed, false);
    });

    test('repropagateBracketFrom: quitar un resultado vuelve a TBD la siguiente ronda', () => {
        env.tournamentData.settings.formatoPartidoLlaves = 'bo5';
        const bracket = {
            rounds: [
                { title: 'Semifinales', matches: [B.newBracketMatch({ name: 'A', club: 'X' }, { name: 'B', club: 'Y' })] },
                { title: 'Final', matches: [B.newBracketMatch({ name: 'A', club: 'X' }, null)] }
            ]
        };
        const m = bracket.rounds[0].matches[0];
        m.sets.p1 = ['11', '11', '11'];
        m.sets.p2 = ['8', '8', '8'];
        B.computeBracketMatch(bracket, 0, 0);
        assert(m.completed, '3-0 decide el partido');
        B.repropagateBracketFrom(bracket, 0, 0);
        assertEqual(bracket.rounds[1].matches[0].p1.name, 'A', 'A avanzó a la final');

        // Quitar el resultado: la final vuelve a TBD
        m.completed = false;
        m.winnerSide = -1;
        m.winner = null;
        m.sets.p1 = ['', '', ''];
        m.sets.p2 = ['', '', ''];
        B.repropagateBracketFrom(bracket, 0, 0);
        assert(/^tbd$/i.test(bracket.rounds[1].matches[0].p1.name), 'final vuelve a TBD');
    });
});
