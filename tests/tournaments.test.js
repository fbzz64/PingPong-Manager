// ==========================================
// TESTS/TOURNAMENTS.TEST.JS - Torneos y ranking
// (js/tournaments.js + js/ranking.js)
// ==========================================

const { suite, test, assert, assertEqual } = require('./runner');
const { loadApp } = require('./env');

suite('TORNEOS (tournaments.js + ranking.js)', () => {
    const env = loadApp(['js/fixtures.js', 'js/stats.js', 'js/tournaments.js', 'js/ranking.js']);
    const P = env.sandbox;

    const A = () => ({ name: 'Ana', club: 'X', index: 0, points: 4 });
    const B = () => ({ name: 'Beto', club: 'Y', index: 1, points: 4 });
    const match = (p1, p2, s1, s2, extra) => ({
        player1: p1, player2: p2,
        sets: { player1: s1, player2: s2 },
        completed: !extra || extra.completed !== false,
        wo: extra && extra.wo,
        match: (extra && extra.match) || 1
    });

    function reset() {
        env.tournamentData.fixtures = [];
        env.tournamentData.players = [];
    }

    test('sumCurrentTournamentPoints: suma fixtures, filtra por categoría y atribuye a integrantes', () => {
        reset();
        env.tournamentData.fixtures = [
            { categoria: 'C1', players: [{ name: 'Ana', club: 'X', points: 5 }, { name: 'Beto', club: 'Y', points: 3 }], matches: [] },
            { categoria: 'C2', players: [{ name: 'Ana', club: 'X', points: 2 }], matches: [] },
            { categoria: 'C1', players: [{ name: 'Pareja', club: 'Z', points: 4, members: [{ name: 'M1', club: 'W' }, { name: 'M2', club: 'W' }] }], matches: [] }
        ];
        assertEqual(P.sumCurrentTournamentPoints('Ana', 'X'), 7, 'suma todas sus fixtures');
        assertEqual(P.sumCurrentTournamentPoints('Ana', 'X', 'C1'), 5, 'filtra por categoría');
        assertEqual(P.sumCurrentTournamentPoints('M1', 'W'), 4, 'integrante recibe puntos de la pareja');
        assertEqual(P.sumCurrentTournamentPoints('-', '-'), 0, 'placeholders ignorados');
    });

    test('bestHistoryPosition / rankingDistinct', () => {
        const history = [{ posicion: 3 }, { posicion: 1, categoria: 'C1' }, { posicion: 2 }];
        assertEqual(P.bestHistoryPosition(history), 1, 'mejor puesto global');
        assertEqual(P.bestHistoryPosition(history, 'C1'), 1, 'filtra por categoría');
        assertEqual(P.bestHistoryPosition([], 'C1'), null, 'sin historial');
        assertEqual(P.rankingDistinct(['x', 'x', 'y', '']), ['x', 'y'], 'dedupe y filtra vacíos');
    });

    test('calculatePodiums: agrupa por categoría y suma puntos entre fixtures', () => {
        reset();
        // Entradas independientes por fixture (como guarda la app): G1 → Ana 2, Beto 1.
        // G2 → Ana 1, Beto 2. Totales: Ana 3, Beto 3, Carla 1. Empate Ana/Beto se
        // resuelve por el enfrentamiento directo del G1 (Ana 2-1).
        const a1 = { name: 'Ana', club: 'X', index: 0, points: 2 };
        const b1 = { name: 'Beto', club: 'Y', index: 1, points: 1 };
        const a2 = { name: 'Ana', club: 'X', index: 0, points: 1 };
        const b2 = { name: 'Beto', club: 'Y', index: 1, points: 2 };
        const carla = { name: 'Carla', club: 'Z', index: 2, points: 1 };
        env.tournamentData.fixtures = [
            { categoria: 'C1', grupo: 'G1', players: [a1, b1, { name: '-', club: '-' }], matches: [match(a1, b1, ['11', '9', '11'], ['8', '11', '6'])] },
            { categoria: 'C1', grupo: 'G2', players: [a2, b2, carla], matches: [] },
            { categoria: 'C2', grupo: 'G1', players: [{ name: 'Beto', club: 'Y' }], matches: [] }
        ];
        const podiums = P.calculatePodiums();
        const c1 = podiums['C1'];
        assertEqual(c1.length, 3, 'C1: Ana, Beto y Carla');
        assertEqual(c1[0].name, 'Ana', 'Ana gana el empate a 3 pts por enfrentamiento directo (2-1 en sets)');
        assertEqual(c1[0].points, 3, 'Ana suma 2 (G1) + 1 (G2)');
        assertEqual(c1[0].groups.join(','), 'G1,G2', 'acumula grupos');
        assertEqual(c1[1].name, 'Beto', 'segundo');
        assert(!c1.some(p => p.name === '-'), 'placeholders excluidos');
        assertEqual(podiums['C2'][0].name, 'Beto', 'categoría separada');
    });

    test('calculatePodiums: desempate por diferencia de sets cuando no se enfrentaron', () => {
        reset();
        const x = { name: 'X', club: 'A', index: 0, points: 2 };
        const y = { name: 'Y', club: 'B', index: 1, points: 2 };
        const z = { name: 'Z', club: 'C', index: 2, points: 2 };
        env.tournamentData.fixtures = [
            {
                categoria: 'C1', grupo: 'G1',
                players: [x, y, z],
                matches: [
                    match(x, z, ['11', '11', '11'], ['8', '6', '7']),
                    match(y, z, ['11', '11'], ['9', '10'])
                ]
            }
        ];
        // X y Y no se cruzan: X diff sets +3, Y +2 → X primero
        const podiums = P.calculatePodiums();
        assertEqual(podiums['C1'][0].name, 'X', 'más diferencia de sets');
        assertEqual(podiums['C1'][1].name, 'Y', 'segundo por diff');
        assertEqual(podiums['C1'][2].name, 'Z', 'último');
    });

    test('calculateGeneralStats: totales y porcentaje de completado', () => {
        reset();
        const a = A(), b = B();
        env.tournamentData.players = [a, b, { name: '-', club: '-' }];
        env.tournamentData.fixtures = [
            { categoria: 'C1', grupo: 'G1', players: [a, b], matches: [match(a, b, ['11', '9', '11'], ['8', '11', '6'])] },
            { categoria: 'C1', grupo: 'G2', players: [a, b], matches: [match(a, b, ['11', '11'], ['9', '7'], { completed: false })] }
        ];
        const s = P.calculateGeneralStats();
        assertEqual(s.totalMatches, 2, '2 partidos en total');
        assertEqual(s.completedMatches, 1, '1 completado');
        assertEqual(s.totalSets, 3, '3 sets jugados en el completado');
        assertEqual(s.totalPlayers, 2, 'jugadores válidos');
        assertEqual(s.totalCategories, 1, 'una categoría');
        assertEqual(s.completionPercentage, 50);
    });

    test('calculateTournamentRecords: partido más largo y set más cerrado', () => {
        reset();
        const a = A(), b = B();
        const c = { name: 'Carla', club: 'Z', index: 2, points: 0 };
        env.tournamentData.fixtures = [
            {
                categoria: 'C1', grupo: 'G1',
                players: [a, b, c],
                matches: [
                    match(a, b, ['11', '11', '11', '9', '12'], ['8', '6', '4', '11', '10']),
                    match(c, a, ['11', '11'], ['10', '13']),
                    { player1: { name: 'TBD', club: '-' }, player2: { name: 'TBD', club: '-' }, sets: { player1: [], player2: [] }, completed: true, match: 3 }
                ]
            }
        ];
        const rec = P.calculateTournamentRecords();
        assertEqual(rec.longestMatch.total, 93, '11+8+11+6+11+4+9+11+12+10');
        assertEqual(rec.longestMatch.sets, '11-8, 11-6, 11-4, 9-11, 12-10');
        assertEqual(rec.longestMatch.players, 'Ana vs Beto');
        assertEqual(rec.closestSet.margin, 1, 'set más cerrado: 11-10');
        assertEqual(rec.closestSet.score, '11-10');
    });

    test('calculateCategoryMVP: líder por victorias de cada categoría', () => {
        reset();
        const a = A(), b = B();
        env.tournamentData.fixtures = [
            { categoria: 'C1', grupo: 'G1', players: [a, b], matches: [match(a, b, ['11', '9', '11'], ['8', '11', '6'])] }
        ];
        const mvp = P.calculateCategoryMVP();
        assertEqual(mvp['C1'].name, 'Ana', 'MVP con más victorias');
        assertEqual(mvp['C1'].wins, 1);
    });

    test('buildPodioDiffusionMessage: arma mensaje con podios', () => {
        const podiums = {
            'C1': [{ name: 'Ana', club: 'X', points: 5 }, { name: 'Beto', club: 'Y', points: 3 }]
        };
        const msg = P.buildPodioDiffusionMessage(podiums);
        assert(msg.includes('Torneo Test'), 'nombre del torneo');
        assert(msg.includes('Ana (X) — 5 pts'), 'podio 1°');
        assert(msg.includes('Beto (Y) — 3 pts'), 'podio 2°');
        assert(msg.includes('C1'), 'categoría');
        const vacio = P.buildPodioDiffusionMessage({});
        assert(vacio.includes('Sin podios registrados'), 'sin podios');
    });

    test('buildDiffusionTemplate: plantilla de inscripción', () => {
        env.tournamentData.settings = Object.assign(env.tournamentData.settings, {
            torneoNombre: 'Torneo Test',
            subtitulo: 'Circuito',
            lugar: 'Gimnasio',
            fechaInicio: '2026-08-15',
            formato: 'Todos contra todos + llaves',
            formatoPartidoGrupos: 'bo5'
        });
        const msg = P.buildDiffusionTemplate('inscripcion');
        assert(msg.includes('Torneo Test'), 'nombre');
        assert(msg.includes('INSCRIPCIONES ABIERTAS'), 'título');
        assert(msg.includes('Gimnasio'), 'lugar');
        assert(msg.includes('BO5'), 'formato');
    });

    test('buildDiffusionTemplate: plantilla día del torneo', () => {
        const msg = P.buildDiffusionTemplate('dia-torneo');
        assert(msg.includes('¡HOY SE JUEGA!'), 'título');
        assert(msg.includes('check-in'), 'menciona check-in');
    });

    test('buildDiffusionTemplate: plantilla de resultados parciales', () => {
        env.tournamentData.fixtures = [
            { categoria: 'C1', players: [{ name: 'Ana', club: 'X', points: 5 }, { name: 'Beto', club: 'Y', points: 3 }], matches: [{ completed: true, player1: {}, player2: {}, sets: { player1: ['11', '11'], player2: ['9', '8'] } }] }
        ];
        const msg = P.buildDiffusionTemplate('resultados');
        assert(msg.includes('RESULTADOS PARCIALES'), 'título');
        assert(msg.includes('Ana'), 'líder de la categoría');
        assert(msg.includes('de 1'), 'partidos jugados');
    });

    test('buildDiffusionTemplate: plantilla de podios finales = buildPodioDiffusionMessage', () => {
        const podios = P.buildDiffusionTemplate('podios');
        assert(podios.includes('PODIOS DEL DÍA'), 'usa el mensaje de podios');
        assertEqual(podios, P.buildPodioDiffusionMessage(P.calculatePodiums()), 'misma salida');
    });

    test('renderRanking: ordena por puntos desc con filtros', () => {
        reset();
        const els = {};
        env.sandbox.document.getElementById = (id) => {
            if (!els[id]) els[id] = { id, value: '', innerHTML: '', textContent: '' };
            return els[id];
        };
        env.sandbox.document.getElementById('ranking-torneo').value = 'actual';

        env.tournamentData.players = [
            { name: 'Ana', club: 'X', categories: ['C1'], elo: 1300, history: [], checkin: false },
            { name: 'Beto', club: 'Y', categories: ['C1'], elo: 1400, history: [], checkin: false },
            { name: '-', club: '-' }
        ];
        env.tournamentData.fixtures = [
            { categoria: 'C1', players: [{ name: 'Ana', club: 'X', points: 7 }], matches: [] }
        ];
        P.renderRanking();
        let html = els['ranking-output'].innerHTML;
        const posAna = html.indexOf('>Ana<');
        const posBeto = html.indexOf('>Beto<');
        assert(posAna > 0 && posBeto > 0 && posAna < posBeto, 'Ana (7 pts) va antes que Beto');
        assertEqual((html.match(/<tr>/g) || []).length, 3, 'solo header + 2 jugadores (placeholder fuera)');

        // Histórico: filtrar por torneo del historial
        env.tournamentData.players[0].history = [{ torneo: 'Verano', categoria: 'C1', pts: 10, posicion: 2 }];
        els['ranking-torneo'].value = 'Verano';
        P.renderRanking();
        html = els['ranking-output'].innerHTML;
        assert(html.includes('10'), 'puntos del torneo hist��rico');
        assert(html.includes('#2'), 'mejor puesto hist��rico');
    });

    test('buildFinishChecklist: refleja cada fase del torneo', () => {
        reset();
        env.tournamentData.settings.torneoNombre = '';
        env.tournamentData.players = [];
        env.tournamentData.fixtures = [];

        let checklist = P.buildFinishChecklist();
        assertEqual(checklist.length, 7, '7 pasos en el checklist');
        assert(!checklist[0].done, 'sin nombre: configurar pendiente');
        assert(!checklist[1].done, 'sin jugadores: registrar pendiente');
        assert(!checklist[2].done, 'sin check-in: check-in pendiente');
        assert(!checklist[3].done && checklist[3].critical, 'sin fixtures: crítico y pendiente');
        assert(!checklist[4].done, 'sin partidos: completar pendiente');
        assert(checklist[5].done, 'sin llaves: opcional listo');
        assert(!checklist[6].done, 'sin partidos: stats pendiente');

        // Todo listo
        env.tournamentData.settings.torneoNombre = 'Torneo Test';
        env.tournamentData.players = [{ name: 'Ana', club: 'X', checkin: true }];
        env.tournamentData.fixtures = [
            { categoria: 'C1', grupo: 'G1', players: [{ name: 'Ana', club: 'X' }], matches: [{ player1: 'Ana', player2: 'Beto', sets: { player1: [1], player2: [0] }, completed: true }] }
        ];
        checklist = P.buildFinishChecklist();
        checklist.forEach((c, i) => {
            if (i === 5) return;
            assert(c.done, 'paso listo: ' + c.key);
        });
    });

    test('buildFinishChecklist: brackets pendientes marcan la fase de llaves', () => {
        reset();
        env.tournamentData.settings.torneoNombre = 'Torneo Test';
        env.tournamentData.players = [{ name: 'Ana', club: 'X', checkin: true }];
        env.tournamentData.fixtures = [
            { categoria: 'C1', grupo: 'G1', players: [{ name: 'Ana', club: 'X' }], matches: [{ player1: 'Ana', player2: 'Beto', sets: { player1: [1], player2: [0] }, completed: true }] }
        ];
        env.tournamentData.brackets = [
            { categoria: 'C1', rounds: [{ matches: [{ player1: 'Ana', player2: 'Beto', winner: '' }] }] }
        ];
        const checklist = P.buildFinishChecklist();
        assert(!checklist[5].done, 'llave sin ganador: pendiente');
        assert(checklist[3].done && checklist[4].done, 'resto completado');
    });
});
