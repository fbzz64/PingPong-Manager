// ==========================================
// TESTS/FIXTURES.TEST.JS - Gestión de fixtures (js/fixtures.js)
// ==========================================

const { suite, test, assert, assertEqual } = require('./runner');
const { loadApp } = require('./env');

suite('FIXTURES (fixtures.js)', () => {
    const env = loadApp(['js/fixtures.js']);
    const F = env.sandbox;

    const mk = (name, club, index) => ({ name, club, index, points: 0 });
    const m = (p1, p2, s1, s2, wo) => ({
        player1: p1,
        player2: p2,
        sets: { player1: s1, player2: s2 },
        wo: wo || undefined,
        woWinnerSide: wo ? 1 : undefined,
        completed: true
    });

    test('ittfSetErrorReason describe errores ITTF', () => {
        assert(/empate/.test(F.ittfSetErrorReason(11, 11)), 'empate');
        assert(/11 puntos/.test(F.ittfSetErrorReason(5, 3)), 'menos de 11');
        assert(/2 puntos de ventaja/.test(F.ittfSetErrorReason(12, 11)), 'deuce');
    });

    test('defaultSwissRounds sugiere rondas', () => {
        assertEqual(F.defaultSwissRounds(8), 3, '8 jugadores → 3');
        assertEqual(F.defaultSwissRounds(16), 4, '16 → 4');
        assertEqual(F.defaultSwissRounds(4), 3, '4 → mínimo 3');
        assertEqual(F.defaultSwissRounds(2), 3, '2 → mínimo 3');
        assertEqual(F.defaultSwissRounds(0), 3, 'sin datos → 3');
    });

    test('swissPairKey es simétrico', () => {
        const a = { name: 'A', club: 'X' }, b = { name: 'B', club: 'Y' };
        assertEqual(F.swissPairKey(a, b), F.swissPairKey(b, a), 'A/B === B/A');
        assert(F.swissPairKey(a, b) !== F.swissPairKey(a, a), 'distinto para otro rival');
    });

    test('generateSwissRounds: 8 jugadores, 3 rondas sin repetir rivales', () => {
        const players = [1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ name: 'P' + i, club: 'X', index: i - 1, elo: 1200 + i }));
        const rounds = F.generateSwissRounds(players, 3);
        assertEqual(rounds.length, 3, '3 rondas');
        rounds.forEach((pairs, r) => {
            assertEqual(pairs.length, 4, 'ronda ' + (r + 1) + ' → 4 partidos');
            const seen = new Set();
            pairs.forEach(pair => {
                assert(pair.p1 && pair.p2, 'sin byes con 8 jugadores');
                assert(!seen.has(pair.p1.index) && !seen.has(pair.p2.index), 'sin repetidos en la ronda');
                seen.add(pair.p1.index);
                seen.add(pair.p2.index);
            });
        });
        const allPairs = rounds.flat().map(p => F.swissPairKey(p.p1, p.p2));
        assertEqual(new Set(allPairs).size, allPairs.length, 'ningún rival se repite');
    });

    test('generateSwissRounds: jugadores impares → bye por ronda', () => {
        const players = [1, 2, 3, 4, 5].map(i => ({ name: 'P' + i, club: 'X', index: i - 1, elo: 1200 }));
        const rounds = F.generateSwissRounds(players, 3);
        rounds.forEach((pairs) => {
            assertEqual(pairs.filter(p => !p.p2).length, 1, 'un bye por ronda');
        });
    });

    test('generateSwissRounds: respeta playedSet (no reparear)', () => {
        const players = [
            { name: 'A', club: 'X', index: 0, elo: 1500 },
            { name: 'B', club: 'X', index: 1, elo: 1400 },
            { name: 'C', club: 'X', index: 2, elo: 1300 },
            { name: 'D', club: 'X', index: 3, elo: 1200 }
        ];
        const played = new Set([F.swissPairKey(players[0], players[1])]);
        const rounds = F.generateSwissRounds(players, 2, played);
        const allPairs = rounds.flat().map(p => F.swissPairKey(p.p1, p.p2));
        assert(!allPairs.includes(F.swissPairKey(players[0], players[1])), 'A-B no se vuelve a cruzar');
    });

    test('headToHeadInfo: suma sets de doble ronda y saltea W.O.', () => {
        const A = mk('A', 'X', 0), B = mk('B', 'X', 1);
        const matches = [
            m(A, B, ['11', '9', '11'], ['8', '11', '8']),        // A gana 2-1 (A 2 sets)
            m(B, A, ['11', '11'], ['9', '7']),                    // B gana 2-0 (B 2 sets)
            m(A, B, ['11', '11', '11'], ['0', '0', '0'], true)   // W.O.: no cuenta
        ];
        const h = F.headToHeadInfo(A, B, matches);
        assertEqual(h.played, true, 'se enfrentaron');
        assertEqual(h.aSets, 2, 'A ganó 2 sets');
        assertEqual(h.bSets, 3, 'B ganó 3 sets');
    });

    test('headToHeadInfo: sin enfrentamiento previo', () => {
        const A = mk('A', 'X', 0), C = mk('C', 'X', 2);
        const h = F.headToHeadInfo(A, C, [m(A, mk('B', 'X', 1), ['11'], ['8'])]);
        assertEqual(h.played, false, 'no jugaron entre sí');
        assertEqual(h.aSets, 0);
    });

    test('getMatchAggregates: acumula sets y puntos por lado', () => {
        const A = mk('A', 'X', 0), B = mk('B', 'X', 1);
        const matches = [
            m(A, B, ['11', '8', '11'], ['9', '11', '6']),  // A 2-1; A 30-26
            m(B, A, ['11', '11'], ['5', '9'])              // A 0-2; A 14-22
        ];
        const agg = F.getMatchAggregates(A, matches);
        assertEqual(agg.setsWon, 2, 'A ganó 2 sets');
        assertEqual(agg.setsLost, 3, 'A perdió 3 sets');
        assertEqual(agg.pointsFor, 44, 'A anotó 30+14');
        assertEqual(agg.pointsAgainst, 48, 'recibió 26+22');
    });

    test('getMatchAggregates: ignora W.O.', () => {
        const A = mk('A', 'X', 0), B = mk('B', 'X', 1);
        const agg = F.getMatchAggregates(A, [m(A, B, ['11', '11'], ['0', '0'], true)]);
        assertEqual(agg.setsWon, 0, 'W.O. no suma sets');
        assertEqual(agg.pointsFor, 0, 'W.O. no suma puntos');
    });

    test('comparePlayersWithTiebreak: respeta clasificación ITTF', () => {
        env.tournamentData.settings.formatoPartidoGrupos = 'bo3';
        const A = mk('A', 'X', 0), B = mk('B', 'X', 1), C = mk('C', 'X', 2);
        const fixture = {
            players: [A, B, C],
            matches: [
                m(A, B, ['11', '11'], ['8', '9']),          // A gana 2-0
                m(A, C, ['11', '9', '8'], ['8', '11', '11']), // C gana 2-1
                m(B, C, ['11', '11'], ['8', '7'])           // B gana 2-0
            ]
        };
        // Todos empatan a 3 puntos → cociente de sets: A (3-2), B (2-2), C (2-3)
        const sorted = [B, C, A].sort((x, y) => F.comparePlayersWithTiebreak(fixture, x, y));
        assertEqual(sorted.map(p => p.name), ['A', 'B', 'C']);
    });

    test('comparePlayersWithTiebreak: fallback sin fixtures', () => {
        const a = { name: 'A', club: 'X', points: 5 };
        const b = { name: 'B', club: 'X', points: 3 };
        assert(F.comparePlayersWithTiebreak({}, a, b) < 0, 'más puntos primero');
    });

    test('saveFixtureRecord: reemplaza sin duplicar y conserva id', () => {
        env.tournamentData.fixtures = [];
        F.saveFixtureRecord({ categoria: 'C1', grupo: 'A', id: 1 });
        F.saveFixtureRecord({ categoria: 'C1', grupo: 'A', id: 999 });
        assertEqual(env.tournamentData.fixtures.length, 1, 'un solo fixture');
        assertEqual(env.tournamentData.fixtures[0].id, 1, 'conserva el id original');
        F.saveFixtureRecord({ categoria: 'C1', grupo: 'B', id: 2 });
        assertEqual(env.tournamentData.fixtures.length, 2, 'agrega grupo nuevo');
    });
});
