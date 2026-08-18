// ==========================================
// TESTS/DASHBOARD.TEST.JS - Renderers del dashboard (js/stats.js)
// ==========================================

const { suite, test, assert, assertEqual } = require('./runner');
const { loadApp } = require('./env');

suite('DASHBOARD (renderers de stats.js)', () => {
    const env = loadApp(['js/stats.js']);
    const S = env.sandbox;

    // Captura los elementos del DOM: cada getElementById devuelve un objeto
    // reutilizable por id, para poder inspeccionar el HTML renderizado.
    const els = {};
    function capture() {
        env.sandbox.document.getElementById = (id) => {
            if (!els[id]) els[id] = { id, value: '', innerHTML: '', textContent: '' };
            return els[id];
        };
    }

    const match = (p1, p2, s1, s2, opts = {}) => ({
        player1: p1, player2: p2,
        sets: { player1: s1, player2: s2 },
        completed: opts.completed !== undefined ? opts.completed : true,
        wo: opts.wo || undefined
    });
    const p = (name, club) => ({ name, club });

    function reset() {
        env.tournamentData.fixtures = [];
        env.tournamentData.players = [];
        env.tournamentData.brackets = [];
        env.tournamentData.logs = [];
        env.tournamentData.settings.torneoNombre = '';
        env.tournamentData.settings.subtitulo = '';
    }

    test('refreshDashboardHeader: nombre, subtítulo y defaults', () => {
        capture();
        env.tournamentData.settings.torneoNombre = 'Mi Torneo';
        env.tournamentData.settings.subtitulo = 'Edición 2026';
        S.refreshDashboardHeader();
        assertEqual(els['main-header-title'].textContent, '🏓 Mi Torneo 🏓');
        assertEqual(els['main-header-subtitle'].textContent, 'Edición 2026');

        reset();
        S.refreshDashboardHeader();
        assert(els['main-header-title'].textContent.includes('PingPong Manager'), 'default sin nombre');
        assert(els['main-header-subtitle'].textContent.includes('Gestión completa'), 'default sin subtítulo');
    });

    test('renderDashboardPodiums: podios por categoría con medallas', () => {
        reset();
        capture();
        env.tournamentData.fixtures = [
            { categoria: 'C1', grupo: 'G1', players: [p('Ana', 'X'), p('Beto', 'Y')], matches: [match(p('Ana', 'X'), p('Beto', 'Y'), ['11', '9', '11'], ['8', '11', '6'])] }
        ];
        S.renderDashboardPodiums();
        let html = els['dashboard-podiums'].innerHTML;
        assert(html.includes('🥇'), 'medalla de oro');
        assert(html.includes('Ana'), '1° Ana');
        assert(html.includes('🥈'), 'medalla de plata');
        assert(html.includes('Beto'), '2° Beto');
        assert(html.includes('1G'), 'victorias de Ana');

        env.tournamentData.fixtures = [];
        S.renderDashboardPodiums();
        assert(els['dashboard-podiums'].innerHTML.includes('Sin partidos completados aún'), 'mensaje vacío');
    });

    test('renderDashboardProgress: barras por categoría + TOTAL', () => {
        reset();
        capture();
        env.tournamentData.fixtures = [
            {
                categoria: 'C1', grupo: 'G1',
                players: [p('Ana', 'X'), p('Beto', 'Y')],
                matches: [
                    match(p('Ana', 'X'), p('Beto', 'Y'), ['11', '9', '11'], ['8', '11', '6']),
                    match(p('Ana', 'X'), p('Beto', 'Y'), ['11', '11'], ['9', '7'], { completed: false })
                ]
            },
            { categoria: 'C2', grupo: 'A', players: [p('Ana', 'X'), p('Beto', 'Y')], matches: [match(p('Ana', 'X'), p('Beto', 'Y'), ['11'], ['9'], { completed: false })] }
        ];
        S.renderDashboardProgress();
        const html = els['dashboard-progress'].innerHTML;
        assert(html.includes('>C1<'), 'categoría C1');
        assert(html.includes('1/2 · 50%'), 'C1: 1 de 2 al 50%');
        assert(html.includes('0/1 · 0%'), 'C2: 0 de 1');
        assert(html.includes('1/3 · 33%'), 'TOTAL: 1 de 3 al 33%');

        env.tournamentData.fixtures = [];
        S.renderDashboardProgress();
        assert(els['dashboard-progress'].innerHTML.includes('Sin fixtures generados'), 'mensaje vacío');
    });

    test('renderDashboardNextMatches: próximos partidos por mesa ordenados por slot', () => {
        reset();
        capture();
        const a = p('Ana', 'X'), b = p('Beto', 'Y');
        env.tournamentData.fixtures = [
            {
                categoria: 'C1', grupo: 'G1',
                players: [a, b],
                matches: [
                    { player1: a, player2: b, sets: { player1: ['11', '11'], player2: ['9', '7'] }, completed: true, match: 1 },
                    { player1: a, player2: b, sets: { player1: [], player2: [] }, completed: false, match: 2 },
                    { player1: a, player2: b, sets: { player1: [], player2: [] }, completed: false, match: 3 },
                    { player1: a, player2: b, sets: { player1: [], player2: [] }, completed: false, match: 4 }
                ],
                schedule: [
                    { match: 1, mesa: 1, hora: '09:00', slot: 0 },
                    { match: 2, mesa: 1, hora: '09:15', slot: 1 },
                    { match: 3, mesa: '-', hora: '-', slot: -1 }
                ]
            },
            {
                categoria: 'C2', grupo: 'A',
                players: [a, b],
                matches: [{ player1: a, player2: b, sets: { player1: [], player2: [] }, completed: false, match: 1 }],
                schedule: [{ match: 1, mesa: 2, hora: '09:00', slot: 0 }]
            }
        ];
        S.renderDashboardNextMatches();
        const html = els['dashboard-next-matches'].innerHTML;
        assert(html.includes('Mesa 2 · 09:00'), 'C2 m1 slot 0 primero');
        assert(html.includes('Mesa 1 · 09:15'), 'C1 m2 slot 1 segundo');
        const posC2 = html.indexOf('Mesa 2 · 09:00');
        const posC1 = html.indexOf('Mesa 1 · 09:15');
        assert(posC2 >= 0 && posC1 > posC2, 'ordenado por slot');
        assert(!html.includes('Mesa 1 · 09:00'), 'completados excluidos');
        assert(!html.includes('Mesa -'), 'LIBRE excluido');

        // Todos completados → mensaje
        env.tournamentData.fixtures[0].matches.forEach(m => { m.completed = true; });
        env.tournamentData.fixtures[1].matches[0].completed = true;
        S.renderDashboardNextMatches();
        assert(els['dashboard-next-matches'].innerHTML.includes('programados están completados'), 'todo completado');

        // Sin programación → mensaje de Multiplex
        env.tournamentData.fixtures[0].schedule = [];
        env.tournamentData.fixtures[1].schedule = [];
        S.renderDashboardNextMatches();
        assert(els['dashboard-next-matches'].innerHTML.includes('Programá el Multiplex'), 'sin schedule');
    });

    test('renderDashboardCategoryChips: conteo por categoría', () => {
        reset();
        capture();
        env.tournamentData.players = [
            { name: 'Ana', club: 'X', categories: ['C1', 'SUB 11'] },
            { name: 'Beto', club: 'Y', categories: ['C1'] },
            { name: '-', club: '-' }
        ];
        S.renderDashboardCategoryChips();
        const html = els['dashboard-category-chips'].innerHTML;
        assert(html.includes('jumpToCategory(\'C1\')'), 'chip C1');
        assert(html.includes('chip-count">2</span>'), 'C1 con 2 jugadores');
        assert(html.includes('SUB 11'), 'chip SUB 11');
        assert(html.includes('chip-count">1</span>'), 'SUB 11 con 1');

        env.tournamentData.players = [];
        S.renderDashboardCategoryChips();
        assert(els['dashboard-category-chips'].innerHTML.includes('Sin jugadores registrados'), 'sin jugadores');
    });

    test('renderDashboardRecentLogs: últimos 5 en orden inverso', () => {
        reset();
        capture();
        env.tournamentData.logs = [1, 2, 3, 4, 5, 6, 7].map(n => ({ date: 'd' + n, action: 'A' + n, description: 'D' + n }));
        S.renderDashboardRecentLogs();
        const html = els['dashboard-recent-logs'].innerHTML;
        assert(html.includes('Ver todos (7)'), 'total de logs');
        const posA7 = html.indexOf('>A7<');
        const posA3 = html.indexOf('>A3<');
        assert(posA7 >= 0 && posA3 >= 0, 'muestra del 3 al 7');
        assert(html.indexOf('>A2<') === -1, 'no muestra los más viejos');
        assert(posA7 < posA3, 'inverso (7 primero)');

        env.tournamentData.logs = [];
        S.renderDashboardRecentLogs();
        assert(els['dashboard-recent-logs'].innerHTML.includes('Sin actividad registrada'), 'sin logs');
    });

    test('renderDashboardFlow: paso actual del flujo guiado', () => {
        reset();
        capture();
        // Sin nada → el paso actual es Configurar torneo
        S.renderDashboardFlow();
        let html = els['dashboard-flow'].innerHTML;
        assert(html.includes('flow-current'), 'hay paso actual');
        assert(html.includes('Configurar torneo'), 'primer paso');
        assert(html.includes('Siguiente paso'), 'primer paso marcado');

        // Con nombre, jugadores y fixtures con partidos pendientes → Completar partidos
        env.tournamentData.settings.torneoNombre = 'T';
        env.tournamentData.players = [p('Ana', 'X')];
        env.tournamentData.fixtures = [
            { categoria: 'C1', grupo: 'G1', players: [p('Ana', 'X')], matches: [match(p('Ana', 'X'), p('Beto', 'Y'), [], [], { completed: false })] }
        ];
        S.renderDashboardFlow();
        html = els['dashboard-flow'].innerHTML;
        const idxCompletar = html.indexOf('Completar partidos');
        const idxFlowCurrent = html.indexOf('flow-current');
        assert(idxCompletar > 0 && idxFlowCurrent > 0 && idxFlowCurrent < idxCompletar, 'el actual es Completar partidos');
        assert(!html.includes('Generar fixture') === false, 'pasos renderizados');
        assert(html.includes('Llaves eliminatorias'), 'paso final presente');

        // Todo completado incluyendo llaves → todos los pasos en verde
        env.tournamentData.fixtures[0].matches[0].completed = true;
        env.tournamentData.brackets = [{ categoria: 'C1', rounds: [{ matches: [] }] }];
        S.renderDashboardFlow();
        html = els['dashboard-flow'].innerHTML;
        assert(!html.includes('Siguiente paso'), 'no hay siguiente paso');
        assert(!html.includes('flow-current'), 'sin paso pendiente');
        assertEqual((html.match(/Completado/g) || []).length, 5, 'los 5 pasos completados');
        assert(html.includes('Llaves eliminatorias'), 'paso final presente');
    });

    test('jumpToCategory: preselecciona y navega a fixture', () => {
        reset();
        capture();
        let tab = null;
        env.sandbox.showTab = (t) => { tab = t; };
        const sel = { value: '', options: [{ value: 'PRIMERA' }, { value: 'DAMAS' }] };
        els['categoria'] = sel;
        S.jumpToCategory('PRIMERA');
        assertEqual(sel.value, 'PRIMERA', 'preselecciona la categoría');
        assertEqual(tab, 'fixture', 'navega a la pestaña fixture');
    });

    test('updateDashboard: contadores y alertas de un vistazo', () => {
        reset();
        capture();
        env.tournamentData.players = [p('Ana', 'X'), p('Beto', 'Y'), p('-', '-')];
        env.tournamentData.fixtures = [
            {
                categoria: 'C1', grupo: 'G1',
                players: [p('Ana', 'X'), p('Beto', 'Y')],
                matches: [
                    match(p('Ana', 'X'), p('Beto', 'Y'), ['11', '9', '11'], ['8', '11', '6']),
                    match(p('Ana', 'X'), p('Beto', 'Y'), ['11', '11'], ['9', '7'], { completed: false })
                ],
                timestamp: '2026-01-01T10:00:00Z'
            }
        ];
        S.updateDashboard();
        assertEqual(String(els['stat-groups'].textContent), '1', '1 fixture');
        assertEqual(String(els['stat-players'].textContent), '2', '2 jugadores válidos');
        assertEqual(String(els['stat-matches'].textContent), '1', '1 completado');
        assertEqual(String(els['stat-pending'].textContent), '1', '1 pendiente');
        const alerts = els['alerts-container'].innerHTML;
        assert(alerts.includes('partido(s) pendiente(s)'), 'alerta de pendientes');
        assert(els['tournament-summary'].innerHTML.includes('C1'), 'resumen con categoría');
    });
});
