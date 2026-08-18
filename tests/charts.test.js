// ==========================================
// TESTS/CHARTS.TEST.JS - Gráficos SVG (js/charts.js)
// ==========================================

const vm = require('vm');
const { suite, test, assert, assertEqual } = require('./runner');
const { loadApp } = require('./env');

suite('CHARTS (charts.js)', () => {
    const env = loadApp(['js/stats.js', 'js/charts.js']);
    const S = env.sandbox;

    function ctxFn(name, ...args) {
        return vm.runInContext(name, env.ctx)(...args);
    }

    function reset() {
        env.tournamentData.players = [];
        env.tournamentData.fixtures = [];
    }

    test('chartsClipLabel: trunca con elipsis y convierte números', () => {
        assertEqual(ctxFn('chartsClipLabel', 'abcdefgh', 5), 'abcd…', 'trunca');
        assertEqual(ctxFn('chartsClipLabel', 'abc', 10), 'abc', 'corto intacto');
        assertEqual(ctxFn('chartsClipLabel', 'exacto', 6), 'exacto', 'largo exacto');
        assertEqual(ctxFn('chartsClipLabel', 12345, 4), '123…', 'número');
    });

    test('chartsBarChartSVG: estructura base y viewBox según filas', () => {
        assertEqual(ctxFn('chartsBarChartSVG', [], {}), '<svg viewBox="0 0 720 24" style="width:100%;height:auto;background:var(--table-bg);border-radius:8px;"></svg>', 'vacío');
        const html = ctxFn('chartsBarChartSVG', [{ label: 'A', value: 1 }, { label: 'B', value: 2 }], {});
        assert(html.startsWith('<svg viewBox="0 0 720 80"'), 'alto = 24 + 2*28');
        assert(html.endsWith('</svg>'), 'cierra svg');
    });

    test('chartsBarChartSVG: barras proporcionales al máximo, color y suffix', () => {
        const html = ctxFn('chartsBarChartSVG', [{ label: 'A', value: 2 }, { label: 'B', value: 4 }], { color: '#ff0000', suffix: '%' });
        assert(html.includes('width="210"'), 'b1 = 420*2/4');
        assert(html.includes('width="420"'), 'b2 = máximo');
        assert(html.includes('fill="#ff0000"'), 'color propio');
        assert(html.includes('>2%<') && html.includes('>4%<'), 'suffix aplicado');
    });

    test('chartsBarChartSVG: color por defecto y escape de etiquetas', () => {
        const def = ctxFn('chartsBarChartSVG', [{ label: 'X', value: 1 }], {});
        assert(def.includes('fill="#457b9d"'), 'color default');
        const esc = ctxFn('chartsBarChartSVG', [{ label: 'A<B>', value: 1 }], {});
        assert(esc.includes('A&lt;B&gt;'), 'statsEsc en la etiqueta');
    });

    test('chartsLineChartSVG: grilla, polylines, puntos y leyenda', () => {
        const html = ctxFn('chartsLineChartSVG', ['G1', 'G2'], [
            { name: 'Ana|Club A', values: [2, 4] }
        ]);
        assert(html.startsWith('<svg viewBox="0 0 720 300"'), 'viewBox');
        assertEqual((html.match(/<line /g) || []).length, 6, '6 líneas de grilla');
        assertEqual((html.match(/<polyline /g) || []).length, 1, '1 polyline por serie');
        assertEqual((html.match(/<circle /g) || []).length, 2, 'un punto por valor');
        assert(html.includes('points="60,162.8 700,67.6"'), 'coordenadas mapeadas');
        assert(html.includes('>Ana<'), 'leyenda con nombre');
        assert(!html.includes('Club A'), 'la leyenda omite el club');
    });

    test('chartsLineChartSVG: serie de un punto centrada y escala mínima de 5', () => {
        const html = ctxFn('chartsLineChartSVG', ['G1'], [{ name: 'Solo', values: [0] }]);
        assert(html.includes('points="380,258"'), 'x centrado con 1 label, y=0');
        assert(html.includes('>5<'), 'escala mínima 5 en la grilla');
    });

    test('renderCategoryChart: agrupa por categoría, ordena e ignora placeholders', () => {
        reset();
        env.tournamentData.players = [
            { name: 'Ana', club: 'A', categories: ['Sub-15'] },
            { name: 'Beto', club: 'B', categories: ['Sub-15', 'Sub-19'] },
            { name: '-', club: '-', categories: ['Sub-15'] }
        ];
        const c = { innerHTML: '' };
        S.renderCategoryChart(c);
        assert(c.innerHTML.includes('Participación por categoría'), 'título');
        const svg = c.innerHTML.slice(c.innerHTML.indexOf('<svg'));
        assert(svg.includes('>Sub-15<') && svg.includes('>Sub-19<'), 'categorías');
        assert(svg.indexOf('Sub-15') < svg.indexOf('Sub-19'), 'ordenado por valor desc');
        assert(svg.includes('width="420"'), 'la mayor ocupa todo el ancho');
    });

    test('renderCategoryChart: sin categorías muestra mensaje', () => {
        reset();
        const c = { innerHTML: '' };
        S.renderCategoryChart(c);
        assert(c.innerHTML.includes('Sin categorías asignadas'), 'mensaje');
        assert(!c.innerHTML.includes('<svg'), 'sin gráfico');
    });

    test('renderClubWinRateChart: % de victorias por club', () => {
        reset();
        env.tournamentData.fixtures = [{
            matches: [{
                completed: true,
                player1: { name: 'Ana', club: 'A' },
                player2: { name: 'Beto', club: 'B' },
                sets: { player1: [11, 11], player2: [5, 3] }
            }]
        }];
        const c = { innerHTML: '' };
        S.renderClubWinRateChart(c);
        assert(c.innerHTML.includes('% Victorias por club'), 'título');
        const svg = c.innerHTML.slice(c.innerHTML.indexOf('<svg'));
        assert(svg.includes('>100%<'), 'ganador 100%');
        assert(svg.includes('>0%<'), 'perdedor 0%');
    });

    test('renderClubWinRateChart: empate en sets no cuenta el partido', () => {
        reset();
        env.tournamentData.fixtures = [{
            matches: [{
                completed: true,
                player1: { name: 'Ana', club: 'A' },
                player2: { name: 'Beto', club: 'B' },
                sets: { player1: [11, 5], player2: [8, 11] }
            }]
        }];
        const c = { innerHTML: '' };
        S.renderClubWinRateChart(c);
        assert(c.innerHTML.includes('Sin partidos completados'), '1 set c/u no cuenta');
    });

    test('renderClubWinRateChart: sin partidos completados muestra mensaje', () => {
        reset();
        const c = { innerHTML: '' };
        S.renderClubWinRateChart(c);
        assert(c.innerHTML.includes('Sin partidos completados'), 'mensaje');
        assert(!c.innerHTML.includes('<svg'), 'sin gráfico');
    });

    test('renderPointsEvolutionChart: menos de 2 fixtures muestra aviso', () => {
        reset();
        env.tournamentData.fixtures = [{ matches: [] }];
        const c = { innerHTML: '' };
        S.renderPointsEvolutionChart(c);
        assert(c.innerHTML.includes('Se necesitan al menos 2 fixtures'), 'aviso');
    });

    test('renderPointsEvolutionChart: acumula puntos por fixture y muestra top 5', () => {
        reset();
        env.tournamentData.fixtures = [
            { matches: [
                { completed: true, player1: { name: 'Ana', club: 'A' }, player2: { name: 'Beto', club: 'B' }, winnerSide: 1 },
                { completed: true, player1: { name: 'Carlos', club: 'C' }, player2: { name: 'Dana', club: 'D' }, winnerSide: 1 },
                { completed: true, player1: { name: 'Ernesto', club: 'E' }, player2: { name: 'Flavia', club: 'F' }, winnerSide: 1 }
            ]},
            { matches: [
                { completed: true, player1: { name: 'Beto', club: 'B' }, player2: { name: 'Ana', club: 'A' }, winnerSide: -1 },
                { completed: true, player1: { name: 'Dana', club: 'D' }, player2: { name: 'Carlos', club: 'C' }, winnerSide: -1 },
                { completed: true, player1: { name: 'Flavia', club: 'F' }, player2: { name: 'Ernesto', club: 'E' }, winnerSide: -1 }
            ]}
        ];
        const c = { innerHTML: '' };
        S.renderPointsEvolutionChart(c);
        const svg = c.innerHTML.slice(c.innerHTML.indexOf('<svg'));
        assertEqual((svg.match(/<polyline /g) || []).length, 5, 'solo los top 5');
        assert(svg.includes('>Ana<'), 'jugador en la leyenda');
        assert(c.innerHTML.includes('Evolución de puntos'), 'título');
    });

    test('renderPointsEvolutionChart: sin puntos registrados muestra mensaje', () => {
        reset();
        env.tournamentData.fixtures = [{ matches: [] }, { matches: [] }];
        const c = { innerHTML: '' };
        S.renderPointsEvolutionChart(c);
        assert(c.innerHTML.includes('Sin puntos registrados'), 'mensaje');
        assert(!c.innerHTML.includes('<svg'), 'sin gráfico');
    });
});
