// ==========================================
// TESTS/ELO.TEST.JS - Rating ELO dinámico (js/elo.js)
// ==========================================

const { suite, test, assert, assertEqual, assertClose } = require('./runner');
const { loadApp } = require('./env');

suite('ELO (elo.js)', () => {
    const env = loadApp(['js/elo.js']);
    const E = env.sandbox;

    const eloPlayers = (entries) => {
        env.tournamentData.players = entries.map(e => ({ ...e }));
    };
    const match3_0 = (p1, p2) => ({
        player1: p1, player2: p2,
        sets: { player1: ['11', '11', '11'], player2: ['8', '8', '8'] },
        formato: 'bo5',
        completed: true
    });

    test('playerElo usa default o el valor cargado', () => {
        assertEqual(E.playerElo({}), 1200, 'default 1200');
        assertEqual(E.playerElo({ elo: 1350 }), 1350, 'elo propio');
        assertEqual(E.playerElo(null), 1200, 'nulo → default');
    });

    test('expectedScore: simetría y favoritismo', () => {
        assertClose(E.expectedScore(1200, 1200), 0.5, 'iguales → 0.5');
        assertClose(E.expectedScore(1400, 1200) + E.expectedScore(1200, 1400), 1, 'suma 1');
        assert(E.expectedScore(1200, 1400) < 0.5, 'menor rating → menor expectativa');
        assert(E.expectedScore(1400, 1200) > 0.5, 'mayor rating → mayor expectativa');
    });

    test('computeEloDelta: mismo rating → ±16', () => {
        assertEqual(E.computeEloDelta(1200, 1200, 1), { deltaA: 16, deltaB: -16 }, 'gana A');
        assertEqual(E.computeEloDelta(1200, 1200, 0), { deltaA: -16, deltaB: 16 }, 'gana B');
        assertEqual(E.computeEloDelta(1200, 1200, 0.5), { deltaA: 0, deltaB: 0 }, 'empate');
    });

    test('computeEloDelta: la sorpresa mueve más puntos', () => {
        assertEqual(E.computeEloDelta(1400, 1200, 1), { deltaA: 8, deltaB: -8 }, 'favorito gana');
        assertEqual(E.computeEloDelta(1200, 1400, 1), { deltaA: 24, deltaB: -24 }, 'sorpresa');
    });

    test('matchWinner: decide por sets, empate y W.O.', () => {
        const p1 = { name: 'A', club: 'X' }, p2 = { name: 'B', club: 'X' };
        assertEqual(E.matchWinner(match3_0(p1, p2)), 1, 'A gana → 1');
        assertEqual(E.matchWinner({ ...match3_0(p1, p2), sets: { player1: ['8', '8', '8'], player2: ['11', '11', '11'] } }), 0, 'B gana → 0');
        assertEqual(E.matchWinner({ player1: p1, player2: p2, sets: { player1: ['11'], player2: ['8'] }, formato: 'bo5' }), 0.5, 'incompleto → 0.5');
        assertEqual(E.matchWinner({ player1: p1, player2: p2, sets: { player1: [], player2: [] }, wo: true }), 0.5, 'W.O. → 0.5');
        assertEqual(E.matchWinner(null), 0.5, 'sin partido → 0.5');
    });

    test('getPlayerElo delega', () => {
        assertEqual(E.getPlayerElo({ elo: 1100 }), 1100);
    });

    test('syncEloForFixture aplica deltas al fixture', () => {
        eloPlayers([{ name: 'A', club: 'X', elo: 1200 }, { name: 'B', club: 'X', elo: 1200 }]);
        const match = match3_0({ name: 'A', club: 'X' }, { name: 'B', club: 'X' });
        const fixture = { players: [{ name: 'A', club: 'X' }, { name: 'B', club: 'X' }], matches: [match] };
        assertEqual(E.syncEloForFixture(fixture), true, 'hubo cambios');
        assertEqual(env.tournamentData.players[0].elo, 1216, 'A sube a 1216');
        assertEqual(env.tournamentData.players[1].elo, 1184, 'B baja a 1184');
        assertEqual(match.eloDeltaA, 16);
        assertEqual(match.eloDeltaB, -16);
        assert(match.eloFingerprint, 'guarda huella del resultado');
        assert(match.eloApplied, 'marca aplicado');
    });

    test('syncEloForFixture es idempotente (no duplica)', () => {
        eloPlayers([{ name: 'A', club: 'X', elo: 1200 }, { name: 'B', club: 'X', elo: 1200 }]);
        const match = match3_0({ name: 'A', club: 'X' }, { name: 'B', club: 'X' });
        const fixture = { matches: [match] };
        E.syncEloForFixture(fixture);
        const a = env.tournamentData.players[0].elo;
        assertEqual(E.syncEloForFixture(fixture), false, 'sin cambios → false');
        assertEqual(env.tournamentData.players[0].elo, a, 'elo intacto');
    });

    test('syncEloForFixture revierte y recalcula al cambiar el resultado', () => {
        eloPlayers([{ name: 'A', club: 'X', elo: 1200 }, { name: 'B', club: 'X', elo: 1200 }]);
        const match = match3_0({ name: 'A', club: 'X' }, { name: 'B', club: 'X' });
        const fixture = { matches: [match] };
        E.syncEloForFixture(fixture);
        assertEqual(env.tournamentData.players[0].elo, 1216);

        // Editan los sets: ahora gana B
        match.sets = { player1: ['8', '8', '8'], player2: ['11', '11', '11'] };
        E.syncEloForFixture(fixture);
        assertEqual(env.tournamentData.players[0].elo, 1184, 'A revirtió su delta y ahora baja');
        assertEqual(env.tournamentData.players[1].elo, 1216, 'B sube');
        assertEqual(match.eloDeltaA, -16, 'delta recalculado');
    });

    test('syncEloForFixture: quitar el resultado revierte el delta', () => {
        eloPlayers([{ name: 'A', club: 'X', elo: 1200 }, { name: 'B', club: 'X', elo: 1200 }]);
        const match = match3_0({ name: 'A', club: 'X' }, { name: 'B', club: 'X' });
        const fixture = { matches: [match] };
        E.syncEloForFixture(fixture);
        assertEqual(env.tournamentData.players[0].elo, 1216);

        match.sets = { player1: ['', '', ''], player2: ['', '', ''] };
        E.syncEloForFixture(fixture);
        assertEqual(env.tournamentData.players[0].elo, 1200, 'vuelve al rating base');
        assertEqual(env.tournamentData.players[1].elo, 1200);
        assert(match.eloDeltaA === undefined, 'delta A eliminado');
        assert(match.eloApplied === false, 'ya no está aplicado');
    });

    test('syncEloForFixture: W.O. no computa rating', () => {
        eloPlayers([{ name: 'A', club: 'X', elo: 1200 }, { name: 'B', club: 'X', elo: 1200 }]);
        const match = { player1: { name: 'A', club: 'X' }, player2: { name: 'B', club: 'X' }, sets: { player1: ['11'], player2: ['0'] }, wo: true };
        const fixture = { matches: [match] };
        E.syncEloForFixture(fixture);
        assertEqual(env.tournamentData.players[0].elo, 1200, 'A sin cambio');
        assertEqual(env.tournamentData.players[1].elo, 1200, 'B sin cambio');
        assert(match.eloDeltaA === undefined, 'sin delta');
    });

    test('syncEloForFixture: dobles/equipos mueven el rating de sus integrantes', () => {
        eloPlayers([
            { name: 'Pareja 1', club: 'X', elo: 1200 },
            { name: 'M1', club: 'X', elo: 1200 },
            { name: 'M2', club: 'X', elo: 1200 },
            { name: 'Pareja 2', club: 'X', elo: 1200 },
            { name: 'M3', club: 'X', elo: 1200 },
            { name: 'M4', club: 'X', elo: 1200 }
        ]);
        const p1 = { name: 'Pareja 1', club: 'X', members: [{ name: 'M1', club: 'X' }, { name: 'M2', club: 'X' }] };
        const p2 = { name: 'Pareja 2', club: 'X', members: [{ name: 'M3', club: 'X' }, { name: 'M4', club: 'X' }] };
        const fixture = { matches: [match3_0(p1, p2)] };
        E.syncEloForFixture(fixture);
        const elo = env.tournamentData.players.map(p => p.name + ':' + p.elo).join(', ');
        assertEqual(env.tournamentData.players[0].elo, 1216, 'pareja ganadora sube');
        assertEqual(env.tournamentData.players[1].elo, 1216, 'integrante M1 sube');
        assertEqual(env.tournamentData.players[2].elo, 1216, 'integrante M2 sube');
        assertEqual(env.tournamentData.players[3].elo, 1184, 'pareja perdedora baja');
        assertEqual(env.tournamentData.players[4].elo, 1184, 'integrante M3 baja');
        assertEqual(env.tournamentData.players[5].elo, 1184, 'integrante M4 baja');
    });

    test('revertEloForFixture revierte y limpia los deltas', () => {
        eloPlayers([{ name: 'A', club: 'X', elo: 1200 }, { name: 'B', club: 'X', elo: 1200 }]);
        const match = match3_0({ name: 'A', club: 'X' }, { name: 'B', club: 'X' });
        const fixture = { matches: [match] };
        E.syncEloForFixture(fixture);
        assertEqual(env.tournamentData.players[0].elo, 1216);

        E.revertEloForFixture(fixture);
        assertEqual(env.tournamentData.players[0].elo, 1200, 'A vuelve a 1200');
        assertEqual(env.tournamentData.players[1].elo, 1200, 'B vuelve a 1200');
        assert(match.eloDeltaA === undefined && match.eloDeltaB === undefined, 'deltas eliminados');
        assertEqual(match.eloApplied, false, 'ya no aplicado');
    });
});
