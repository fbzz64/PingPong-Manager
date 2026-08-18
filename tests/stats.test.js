// ==========================================
// TESTS/STATS.TEST.JS - Estadísticas (js/stats.js)
// ==========================================

const { suite, test, assert, assertEqual } = require('./runner');
const { loadApp } = require('./env');

suite('STATS (stats.js)', () => {
    const env = loadApp(['js/stats.js']);
    const S = env.sandbox;

    // Los sets del app se persisten como STRINGS (inputs de la UI)
    const match = (p1, p2, s1, s2, opts = {}) => ({
        player1: p1,
        player2: p2,
        sets: { player1: s1, player2: s2 },
        completed: opts.completed !== undefined ? opts.completed : true,
        wo: opts.wo || undefined,
        woWinnerSide: opts.woSide
    });
    const p = (name, club) => ({ name, club });
    const findStat = (stats, name) => stats.find(s => s.name === name);

    test('statsPlayerKey y statsEsc', () => {
        assertEqual(S.statsPlayerKey({ name: 'A', club: 'X' }), 'A|X');
        assertEqual(S.statsPlayerKey(null), '|');
        assertEqual(S.statsEsc('<A&B>'), '&lt;A&amp;B&gt;');
    });

    test('statsValidPlayers filtra placeholders', () => {
        env.tournamentData.players = [
            { name: 'A', club: 'X' },
            { name: '-', club: '-' },
            { name: '- -', club: '- -' },
            { name: '  ', club: '' },
            { name: 'B', club: 'Y' }
        ];
        assertEqual(S.statsValidPlayers().map(x => x.name), ['A', 'B']);
    });

    test('statsCompletedMatches: solo completados, sin W.O. ni TBD', () => {
        const A = p('A', 'X'), B = p('B', 'X');
        env.tournamentData.fixtures = [{
            matches: [
                match(A, B, ['11', '11', '11'], ['8', '8', '8']),
                match(A, B, ['11', '11', '11'], ['0', '0', '0'], { completed: false }),
                match(A, B, ['11', '11', '11'], ['0', '0', '0'], { wo: true, woSide: 1 }),
                match(p('TBD', '-'), B, ['11'], ['8']),
                match(p('-', '-'), B, ['11'], ['8'])
            ]
        }];
        assertEqual(S.statsCompletedMatches().length, 1, 'solo el primer partido');
    });

    test('recomputeFixturePoints: ITTF 2/1/0, W.O. y reinicio', () => {
        env.tournamentData.settings.formatoPartidoGrupos = 'bo3';
        const A = p('A', 'X'), B = p('B', 'X'), C = p('C', 'X');
        const fixture = {
            players: [A, B, C].map(x => ({ ...x })),
            matches: [
                match(A, B, ['11', '11'], ['8', '9']),                        // A 2-0
                match(B, C, ['11', '9', '11'], ['8', '11', '8']),             // B 2-1
                match(A, C, ['11', '11'], ['8', '7']),                        // A 2-0
                match(B, A, ['11', '11'], ['0', '0'], { wo: true, woSide: 1 }), // B gana W.O. (A ausente)
                match(A, C, ['11'], ['8'], { completed: false })              // pendiente, no cuenta
            ]
        };
        fixture.players[0].points = 99; // valores sucios previos deben resetearse
        S.recomputeFixturePoints(fixture);

        const byName = {};
        fixture.players.forEach(x => { byName[x.name] = x; });

        assertEqual(byName['A'].points, 4, 'A: 2+2+0(W.O.)');
        assertEqual(byName['A'].matchesPlayed, 3, 'A jugó 3');
        assertEqual(byName['A'].matchesWon, 2, 'A ganó 2');
        assertEqual(byName['A'].matchesLost, 1, 'A perdió 1');

        assertEqual(byName['B'].points, 5, 'B: 1+2+2(W.O.)');
        assertEqual(byName['B'].matchesWon, 2, 'B ganó 2 (incluye W.O.)');

        assertEqual(byName['C'].points, 2, 'C: 1+1');
        assertEqual(byName['C'].matchesPlayed, 2, 'C jugó 2');
        assertEqual(byName['C'].matchesWon, 0, 'C no ganó');
    });

    test('computePlayerStats: atribuye sets/puntos/partidos', () => {
        const A = p('A', 'X'), B = p('B', 'X');
        env.tournamentData.fixtures = [{
            matches: [
                match(A, B, ['11', '8', '11', '9'], ['9', '11', '6', '7']) // set 4 (9-7) inválido
            ]
        }];
        const stats = S.computePlayerStats();
        const a = findStat(stats, 'A');
        const b = findStat(stats, 'B');
        assert(a && b, 'ambos jugadores presentes');

        // Un set con puntos cargados cuenta como "jugado" (setsPlayed/puntos),
        // aunque sea inválido no suma setsWon/setsLost (reglamento ITTF).
        assertEqual(a.setsPlayed, 4, 'A juega 4 sets (el 4to, 9-7, cuenta como jugado)');
        assertEqual(a.setsWon, 2, 'A gana 2 sets válidos');
        assertEqual(a.setsLost, 1, 'A pierde 1 set válido');
        assertEqual(a.totalPoints, 39, 'A anota 11+8+11+9');
        assertEqual(a.matchesWon, 1, 'A gana el partido');
        assertEqual(b.matchesLost, 1, 'B pierde');
    });

    test('computePlayerStats: W.O. y partidos incompletos se ignoran', () => {
        const A = p('A', 'X'), B = p('B', 'X');
        env.tournamentData.fixtures = [{
            matches: [
                match(A, B, ['11', '11', '11'], ['0', '0', '0'], { wo: true, woSide: 1 }),
                match(A, B, ['11'], ['8'], { completed: false })
            ]
        }];
        assertEqual(S.computePlayerStats().length, 0, 'sin estadísticas');
    });

    test('computePlayerStats: dobles atribuye a cada integrante', () => {
        const pareja = { name: 'Pareja', club: 'X', members: [{ name: 'M1', club: 'X' }, { name: 'M2', club: 'X' }] };
        const B = p('B', 'Y');
        env.tournamentData.fixtures = [{
            matches: [match(pareja, B, ['11', '11', '11'], ['8', '8', '8'])]
        }];
        const stats = S.computePlayerStats();
        assert(!findStat(stats, 'Pareja'), 'la pareja en sí no aparece');
        ['M1', 'M2'].forEach(member => {
            const st = findStat(stats, member);
            assert(st, member + ' presente');
            assertEqual(st.setsWon, 3, member + ' gana 3 sets');
            assertEqual(st.totalPoints, 33, member + ' anota 33');
            assertEqual(st.matchesWon, 1, member + ' gana el partido');
        });
        const b = findStat(stats, 'B');
        assertEqual(b.setsLost, 3, 'B pierde 3 sets');
        assertEqual(b.matchesLost, 1, 'B pierde el partido');
    });

    test('computeStreakRows: racha actual, mejor racha y forma', () => {
        const A = p('A', 'X'), B = p('B', 'X'), C = p('C', 'X');
        env.tournamentData.fixtures = [{
            matches: [
                match(A, B, ['11', '11', '11'], ['8', '8', '8']),   // A gana
                match(A, C, ['11', '9', '11'], ['8', '11', '8']),   // A gana 3-1
                match(B, A, ['11', '11', '11'], ['8', '8', '8'])    // B gana, A pierde
            ]
        }];
        const rows = S.computeStreakRows();
        const a = rows.find(r => r.name === 'A');
        const b = rows.find(r => r.name === 'B');
        const c = rows.find(r => r.name === 'C');

        assertEqual(a.curType, 'L', 'A viene de perder');
        assertEqual(a.curCount, 1, 'racha actual de 1');
        assertEqual(a.longestW, 2, 'mejor racha ganadora 2');
        assertEqual(b.curType, 'W', 'B viene de ganar');
        assertEqual(b.longestW, 1, 'B mejor racha 1');
        assertEqual(c.longestL, 1, 'C perdió su único partido');

        // Orden: racha actual desc, luego mejor racha ganadora desc
        const order = rows.map(r => r.name);
        assertEqual(order[0], 'A', 'A primero por mejor racha G');
        assertEqual(order.indexOf('A') < order.indexOf('B'), true);
    });

    test('computeStreakRows: sin partidos → lista vacía', () => {
        env.tournamentData.fixtures = [];
        assertEqual(S.computeStreakRows().length, 0);
    });

    test('computeH2H: historial entre dos jugadores', () => {
        const A = p('A', 'X'), B = p('B', 'X');
        env.tournamentData.fixtures = [
            { timestamp: '2026-01-01T00:00:00Z', categoria: 'C1', grupo: 'A', matches: [match(A, B, ['11', '11', '11'], ['8', '8', '8'])] },
            { timestamp: '2026-01-02T00:00:00Z', categoria: 'C1', grupo: 'A', matches: [match(B, A, ['11', '11', '11'], ['8', '8', '8'])] },
            { timestamp: '2026-01-03T00:00:00Z', categoria: 'C1', grupo: 'A', matches: [match(A, B, ['11', '11', '11'], ['0', '0', '0'], { wo: true, woSide: 1 })] }
        ];
        const h = S.computeH2H('A|X', 'B|X');
        assertEqual(h.matches.length, 2, 'el W.O. no cuenta');
        assertEqual(h.aWins, 1, 'A ganó 1');
        assertEqual(h.bWins, 1, 'B ganó 1');
        assertEqual(h.aSetsWon, 3, 'A ganó 3 sets');
        assertEqual(h.bSetsWon, 3, 'B ganó 3 sets');
        assertEqual(h.matches[0].winner, 'A', 'primer match ganado por A');
        assertEqual(h.matches[1].winner, 'B', 'segundo ganado por B');
        assertEqual(h.matches[1].sets1, ['8', '8', '8'], 'sets1 orientado a A aunque fuera P2');
    });

    test('computeH2H: sin enfrentamientos', () => {
        const A = p('A', 'X'), C = p('C', 'X');
        env.tournamentData.fixtures = [{ matches: [match(A, p('D', 'X'), ['11'], ['8'])] }];
        const h = S.computeH2H('A|X', 'C|X');
        assertEqual(h.matches.length, 0);
        assertEqual(h.aWins, 0);
        assertEqual(h.bWins, 0);
    });

    test('getCategoryLeaderboard: podios por categoría con sets strings', () => {
        const A = p('A', 'X'), B = p('B', 'X'), C = p('C', 'X');
        env.tournamentData.fixtures = [
            { categoria: 'C1', matches: [
                match(A, B, ['11', '11', '11'], ['8', '8', '8']),
                match(A, C, ['11', '11', '11'], ['8', '8', '8'])
            ]},
            { categoria: 'C2', matches: [match(B, C, ['11', '11', '11'], ['8', '8', '8'])] }
        ];
        const lb = S.getCategoryLeaderboard();

        assertEqual(Object.keys(lb).sort(), ['C1', 'C2'], 'categorías');

        const c1 = lb['C1'];
        assertEqual(c1[0].name, 'A', 'A primero (2G)');
        assertEqual(c1[0].wins, 2);
        assertEqual(c1[0].setsDiff, 6, 'diferencia de sets 3+3');
        assertEqual(c1[0].pointsFor, 66, 'puntos a favor 33+33 (numérico)');
        assertEqual(c1[0].losses, 0);
        assertEqual(c1[1].name, 'B', 'B antes que C (empate por nombre)');
        assertEqual(c1[1].losses, 1, 'B perdió su único partido en C1');
        assertEqual(c1[1].pointsFor, 24, 'B anotó 8+8+8 en su único partido');

        const c2 = lb['C2'];
        assertEqual(c2[0].name, 'B', 'B lidera C2');
        assertEqual(c2[0].wins, 1);
        assertEqual(c2[0].pointsFor, 33);
        assertEqual(c2[1].pointsFor, 24, 'C anotó 24 en C2');
    });
});
