// ==========================================
// TESTS/E2E.TEST.JS - Flujo completo (todos los módulos juntos)
// ==========================================
// Carga TODOS los módulos de js/ en el MISMO orden que index.html dentro de un
// solo contexto vm (como el navegador: scripts clásicos compartiendo el scope
// léxico global) y recorre el ciclo de vida real de un torneo:
// alta de jugadores → fixture → resultados → estadísticas → llaves → podios
// → export/import.
//
// Valida los CONTRATOS entre módulos (la forma de datos que un módulo escribe
// y el siguiente lee) que las suites unitarias no alcanzan a ver: por ejemplo,
// un `const style` duplicado a nivel de módulo mata TODO el archivo que carga
// segundo en el navegador.
// ==========================================

const vm = require('vm');
const { suite, test, assert, assertEqual } = require('./runner');
const { createEnv, loadInto } = require('./env');

// Mismo orden que los <script src> de index.html (sin las libs de terceros)
const MODULE_ORDER = [
    'js/firebase-config.js', 'js/firebase.js', 'js/i18n.js', 'js/main.js', 'js/storage.js', 'js/ui.js', 'js/auth.js', 'js/navigation.js', 'js/logs.js',
    'js/sponsors.js', 'js/players.js', 'js/elo.js', 'js/reglamento.js', 'js/fixtures.js',
    'js/brackets.js', 'js/stats.js', 'js/charts.js', 'js/ranking.js', 'js/tournaments.js',
    'js/certificates.js', 'js/planning.js', 'js/scoreboard.js', 'js/sounds.js', 'js/qr.js', 'js/tables.js', 'js/tvboard.js', 'js/sync.js',
    'js/changelog.js', 'js/share.js'
];

function makeEl(id) {
    const el = {
        id: id || '',
        value: '',
        textContent: '',
        innerHTML: '',
        style: {},
        selectedIndex: -1,
        disabled: false,
        title: '',
        href: '',
        download: '',
        files: [],
        children: [],
        attrs: {},
        parentNode: null,
        clicked: 0,
        classList: {
            add() {},
            remove() {},
            contains() { return false; },
            toggle() {}
        },
        setAttribute(k, v) { el.attrs[k] = v; },
        getAttribute(k) { return el.attrs[k]; },
        appendChild(c) { c.parentNode = el; el.children.push(c); },
        removeChild(c) { el.children = el.children.filter(x => x !== c); },
        click() { el.clicked++; },
        closest() { return null; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        focus() {}
    };
    return el;
}

suite('E2E (flujo completo, todos los módulos)', () => {
    const els = {};
    const doc = {
        getElementById: (id) => { if (!els[id]) els[id] = makeEl(id); return els[id]; },
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => makeEl(''),
        head: makeEl('head'),
        body: makeEl('body'),
        addEventListener: () => {}
    };
    const blobs = [];
    const env = createEnv({
        document: doc,
        addEventListener: () => {},
        removeEventListener: () => {},
        setInterval: () => 1,
        matchMedia: () => ({ matches: false }),
        URL: { createObjectURL: (b) => { blobs.push(b); return 'blob:e2e'; }, revokeObjectURL: () => {} }
    });
    const S = env.sandbox;
    const ctx = env.ctx;

    // Carga real: todos los módulos conviven en el scope global compartido
    MODULE_ORDER.forEach(rel => loadInto(env, rel));

    // Side-effects de UI fuera del contrato de datos: se capturan, no se testean.
    // Se asignan DESPUÉS de cargar los módulos (los módulos sobreescriben window.X).
    const toasts = [];
    const logs = [];
    S.showToast = (m, t) => toasts.push({ m, t });
    S.addLog = (a, d) => logs.push({ a, d });
    S.showAllPlayers = () => {};
    S.updateFixtureNavigator = () => {};

    const TD = () => vm.runInContext('tournamentData', ctx);
    const run = (expr) => vm.runInContext(expr, ctx);

    test('carga completa: todos los módulos conviven en un solo contexto', () => {
        assertEqual(typeof S.forceAddNewPlayer, 'function', 'players.js');
        assertEqual(typeof S.generateFixture, 'function', 'fixtures.js');
        assertEqual(typeof S.ITTFRULES, 'object', 'reglamento.js');
        assertEqual(typeof S.loadPatrocinadoresList, 'function', 'sponsors.js');
        assertEqual(typeof S.exportMatchSheetPDF, 'function', 'fixtures.js PDF');
        assertEqual(typeof S.calculatePodiums, 'function', 'tournaments.js');
        assertEqual(typeof S.calculateGeneralStats, 'function', 'tournaments.js');
        assertEqual(typeof S.createRestorePoint, 'function', 'tournaments.js restauración');
        assertEqual(typeof S.resetCompleteSystem, 'function', 'tournaments.js reset');
        assertEqual(typeof S.exportMonolithicHTML, 'function', 'planning.js');
        assertEqual(typeof run('generateAutoFixture'), 'function', 'generador interno de fixtures');
        assertEqual(typeof run('recomputeFixturePoints'), 'function', 'recompute interno de stats');
        assertEqual(typeof run('buildAutoBracketRounds'), 'function', 'llaves automáticas');
        assertEqual(typeof run('calculateTournamentRecords'), 'function', 'récords');
        assertEqual(typeof run('calculateCategoryMVP'), 'function', 'MVP');
        assertEqual(TD().fixtures.length, 0, 'estado inicial vacío');
        assert(TD().settings && TD().settings.torneoNombre, 'settings de main.js presentes');
    });

    test('alta de jugadores: normaliza, evita duplicados y persiste', () => {
        const adds = [
            ['ana gomez', 'club verde', 1500],
            ['beto rios', 'club azul', 1300],
            ['carla diaz', 'club verde', 1400],
            ['damian soto', 'club rojo', 1200],
            ['esteban lima', 'club azul', 1100],
            ['fatima cruz', 'club verde', 1000]
        ];
        adds.forEach(([n, c, r]) => S.forceAddNewPlayer(n, c, ['Libres'], r));
        assertEqual(TD().players.length, 6, 'seis jugadores');

        const ana = TD().players[0];
        assertEqual(ana.name, 'Ana Gomez', 'nombre capitalizado y sin tildes');
        assertEqual(ana.club, 'CLUB VERDE', 'club en mayúsculas');
        assertEqual(ana.ranking, 1500, 'ranking');
        assertEqual(ana.elo, 1200, 'elo default');
        assertEqual(ana.checkin, false, 'checkin inicial');
        assert(ana.categories.includes('Libres'), 'categoría');

        // Duplicado (mismo nombre+club) fusiona categorías sin repetir
        S.forceAddNewPlayer('ana gomez', 'club verde', ['Sub-19'], 1500);
        assertEqual(TD().players.length, 6, 'no duplica jugadores');
        assert(TD().players[0].categories.includes('Sub-19'), 'fusiona categorías');

        // saveTournamentData real persistió todo en localStorage
        const persisted = JSON.parse(S.localStorage.getItem('tournamentData'));
        assertEqual(persisted.players.length, 6, 'persistido');
        assertEqual(persisted.players[0].name, 'Ana Gomez', 'persistido normalizado');
    });

    test('generación de fixture: todos contra todos con 15 partidos', () => {
        doc.getElementById('torneoNombre').value = 'Torneo E2E';
        doc.getElementById('subtitulo').value = 'Prueba integral';
        run('generateAutoFixture("Libres", "Grupo A", tournamentData.players, "todos", undefined)');

        const fx = TD().fixtures[0];
        assert(fx, 'fixture creado');
        assertEqual(fx.categoria, 'Libres', 'categoría');
        assertEqual(fx.grupo, 'Grupo A', 'grupo');
        assertEqual(fx.formato, 'todos', 'formato');
        assertEqual(fx.players.length, 6, 'jugadores del fixture');
        assertEqual(fx.matches.length, 15, 'todos contra todos: C(6,2)');

        const numSets = run('window.ITTFRULES.setColumns(window.ITTFRULES.groupFormat())');
        assertEqual(numSets, 5, 'bo5 → 5 columnas');
        fx.matches.forEach(m => {
            assertEqual(m.sets.player1.length, numSets, 'columnas de sets');
            assertEqual(m.completed, false, 'partidos en blanco');
            assert(m.player1 && m.player2, 'dos jugadores por partido');
        });

        // Orden: cada jugador i juega contra los j > i, como p1
        assertEqual(fx.matches[0].player1.name, 'Ana Gomez', 'p1 es el de menor índice');
    });

    test('carga de resultados: recompute de puntos ITTF y persistencia', () => {
        const fx = TD().fixtures[0];
        fx.matches.forEach(m => {
            m.sets = {
                player1: ['11', '11', '11', '', ''],
                player2: ['9', '8', '7', '', '']
            };
            m.completed = true;
        });
        run('recomputeFixturePoints(tournamentData.fixtures[0]); saveTournamentData();');

        fx.players.forEach((p, i) => {
            const wins = 5 - i;
            const losses = i;
            assertEqual(p.matchesPlayed, 5, p.name + ' juega 5');
            assertEqual(p.matchesWon, wins, p.name + ' victorias');
            assertEqual(p.matchesLost, losses, p.name + ' derrotas');
            assertEqual(p.points, wins * 2 + losses, p.name + ' puntos ITTF (2/1/0)');
        });
        const total = fx.players.reduce((s, p) => s + p.points, 0);
        assertEqual(total, 45, '3 puntos por partido × 15');

        const persisted = JSON.parse(S.localStorage.getItem('tournamentData'));
        assertEqual(persisted.fixtures[0].matches.length, 15, 'fixture con resultados persistido');
        assertEqual(persisted.fixtures[0].matches[0].completed, true, 'resultado persistido');
    });

    test('estadísticas y cierre de torneo: stats, podios, records y MVP', () => {
        const stats = run('computePlayerStats()');
        assertEqual(stats.length, 6, 'stats de los 6 jugadores');

        const ana = stats.find(s => s.name === 'Ana Gomez');
        assertEqual(ana.matchesWon, 5, 'Ana gana todo');
        assertEqual(ana.matchesLost, 0, 'Ana no pierde');
        assertEqual(ana.setsPlayed, 15, '3 sets × 5 partidos');
        assertEqual(ana.setsWon, 15, 'gana todos los sets');
        assertEqual(ana.setsLost, 0, 'no pierde sets');
        assertEqual(ana.totalPoints, 165, '11 por set × 3 × 5');

        // Invariantes globales
        stats.forEach(s => assertEqual(s.setsPlayed, 15, 'todos juegan 15 sets'));
        const totalMatches = stats.reduce((s, x) => s + x.matchesWon, 0);
        assertEqual(totalMatches, 15, 'una victoria por partido');

        const podiums = run('calculatePodiums()');
        assert(podiums['Libres'], 'categoría en podios');
        assertEqual(podiums['Libres'].length, 6, 'los 6 en el podio');
        assertEqual(podiums['Libres'][0].name, 'Ana Gomez', 'ganadora por puntos');
        assertEqual(podiums['Libres'][0].points, 10, '10 puntos (5 victorias)');
        const pts = podiums['Libres'].map(p => p.points);
        assert(pts.every((v, i) => i === 0 || v <= pts[i - 1]), 'ordenado por puntos desc');

        const gs = run('calculateGeneralStats()');
        assertEqual(gs.totalPlayers, 6, 'jugadores válidos');
        assertEqual(gs.totalGroups, 1, 'un grupo');
        assertEqual(gs.totalCategories, 1, 'una categoría');
        assertEqual(gs.totalMatches, 15, '15 partidos');
        assertEqual(gs.completedMatches, 15, 'todos completados');
        assertEqual(gs.totalSets, 45, '15 partidos × 3 sets');
        assertEqual(gs.completionPercentage, 100, '100% completado');

        const records = run('calculateTournamentRecords()');
        assert(records.longestMatch, 'partido más largo');
        assertEqual(records.longestMatch.categoria, 'Libres');
        assertEqual(records.longestMatch.total, 57, '20+19+18 por partido');
        assert(records.longestMatch.players.includes(' vs '), 'jugadores del récord');
        assertEqual(records.closestSet.margin, 2, 'set más cerrado (11-9)');
        assertEqual(records.closestSet.score, '11-9', 'score del set cerrado');

        const mvp = run('calculateCategoryMVP()');
        assertEqual(mvp['Libres'].name, 'Ana Gomez', 'MVP por victorias');
    });

    test('llaves automáticas: 6 jugadores en llave de 8 con byes', () => {
        const rounds = run('buildAutoBracketRounds(tournamentData.players, 6)');
        assertEqual(rounds.length, 4, 'cuartos, semis, final y tercer puesto');
        assertEqual(rounds[0].title, 'Cuartos de Final');
        assertEqual(rounds[0].matches.length, 4, '4 partidos en cuartos');

        const byes = rounds[0].matches.filter(m => m.bye);
        assertEqual(byes.length, 2, '2 byes para 6 jugadores en llave de 8');

        const names = [];
        rounds[0].matches.forEach(m => {
            [m.p1, m.p2].forEach(p => { if (p && p.name && p.name !== 'TBD') names.push(p.name); });
        });
        assertEqual(new Set(names).size, 6, 'los 6 jugadores repartidos una vez');
        assert(names.includes('Ana Gomez'), 'Ana en la llave');

        assert(rounds.some(r => /tercer/i.test(r.title)), 'playoff de bronce presente');
        assert(rounds[1].matches.some(m =>
            (m.p1 && m.p1.name !== 'TBD') || (m.p2 && m.p2.name !== 'TBD')
        ), 'los byes avanzan directo a la siguiente ronda');
    });

    test('export → import: round-trip completo de los datos', () => {
        blobs.length = 0;
        run('exportAllData()');
        assertEqual(blobs.length, 1, 'genera el blob de descarga');

        const dataStr = blobs[0].parts[0];
        const parsed = JSON.parse(dataStr);
        assertEqual(parsed.players.length, 6, 'exporta jugadores');
        assertEqual(parsed.fixtures.length, 1, 'exporta fixture');
        assertEqual(parsed.fixtures[0].matches.length, 15, 'exporta partidos');
        assertEqual(parsed.fixtures[0].matches[0].completed, true, 'con resultados cargados');
        assertEqual(parsed.settings.torneoNombre, '4° Torneo TENIS DE MESA 🏓', 'settings completos');

        // Import real: pasa por normalizeTournamentData como importAllData
        const restored = S.normalizeTournamentData(JSON.parse(dataStr));
        assertEqual(restored.players.length, 6, 'restaura jugadores');
        assertEqual(restored.players[0].name, 'Ana Gomez', 'restaura nombres normalizados');
        assertEqual(restored.fixtures.length, 1, 'restaura fixture');
        assertEqual(restored.fixtures[0].matches.length, 15, 'restaura partidos');
        assertEqual(restored.fixtures[0].players.length, 6, 'restaura tabla de posiciones');
        const rp = restored.fixtures[0].players.find(p => p.name === 'Ana Gomez');
        assertEqual(rp.points, 10, 'restaura puntos recomputados');
        assertEqual(rp.matchesWon, 5, 'restaura récord');
    });

    test('formato configurado: bo3 respetado por reglas y fixture (regresión de window.tournamentData)', () => {
        // `tournamentData` es `let` en main.js: NO crea window.tournamentData.
        // Configurar el formato en el global desnudo y verificar que ITTFRULES lo
        // lea. El bug anterior leía window.tournamentData (objeto separado, siempre
        // con el default bo5) e ignoraba la configuración del usuario.
        run('tournamentData.settings.formatoPartidoGrupos = "bo3"');
        run('tournamentData.settings.formatoPartidoLlaves = "bo3"');
        assertEqual(run('window.ITTFRULES.groupFormat()'), 'bo3', 'grupos leen bo3');
        assertEqual(run('window.ITTFRULES.bracketFormat()'), 'bo3', 'llaves leen bo3');
        assertEqual(run('window.ITTFRULES.setColumns(window.ITTFRULES.groupFormat())'), 3, 'bo3 → 3 columnas');

        // El fixture generado con bo3 debe crear partidos bo3
        run('generateAutoFixture("Libres", "Grupo B", tournamentData.players, "todos", undefined)');
        const fxb = TD().fixtures[1];
        assert(fxb, 'fixture bo3 creado');
        assertEqual(fxb.formato, 'todos', 'formato de fixture');
        assertEqual(fxb.matches[0].formato, 'bo3', 'formato en el partido');
        fxb.matches.forEach(m => assertEqual(m.sets.player1.length, 3, '3 columnas de sets'));
    });
});
