// ================================================================
// TESTS/FLOW-TEST.TEST.JS - Simulación automática del torneo
// ================================================================

const { suite, test, assert, assertEqual } = require('./runner');
const { createEnv, loadInto, loadApp } = require('./env');

suite('SIMULADOR DE FLUJO DEL TORNEO', () => {
    test('expone el runner y genera un escenario determinista', () => {
        const env = loadApp(['js/flow-test.js']);
        const S = env.sandbox;
        assertEqual(typeof S.TournamentFlowTest.run, 'function', 'runner disponible');
        assertEqual(S.TournamentFlowTest.samplePlayers().length, 8, '8 jugadores virtuales');
    });

    test('recorre inscripción, zonas, clasificación, llaves y podio sin tocar datos reales', () => {
        const env = loadApp(['js/flow-test.js']);
        const S = env.sandbox;
        const before = JSON.stringify(S.tournamentData);
        const report = S.TournamentFlowTest.run({ runtimeChecks: false });

        assert(report.ok, 'flujo completo aprobado');
        assertEqual(report.stats.players, 8, 'jugadores');
        assertEqual(report.stats.groups, 2, 'zonas');
        assertEqual(report.stats.groupMatches, 12, 'partidos de zona');
        assertEqual(report.stats.qualifiers, 4, 'clasificados');
        assertEqual(report.stats.bracketMatches, 3, 'semifinales + final');
        assert(Boolean(report.stats.champion), 'campeón definido');
        assert(report.steps.every(step => step.passed), 'todos los controles aprobados');
        assertEqual(JSON.stringify(S.tournamentData), before, 'datos reales intactos');
    });

    test('informa un fallo controlado si falta el motor reglamentario', () => {
        const env = createEnv();
        loadInto(env, 'js/flow-test.js');
        const report = env.sandbox.TournamentFlowTest.run({ runtimeChecks: false });

        assertEqual(report.ok, false, 'reporte fallido');
        assertEqual(report.failed, 1, 'un control fallido');
        assert(report.steps[0].label.includes('ITTF'), 'identifica el motor ausente');
    });
});
