// ==========================================
// ELO.JS - Rating ELO dinámico
// ==========================================
// Puntaje dinámico por jugador que sube/baja según los resultados.
// Persiste en tournamentData.players[].elo y es útil entre torneos.
// Se actualiza automáticamente al cargar los sets de cada partido.
// ==========================================

// Rating inicial para jugadores nuevos
window.DEFAULT_ELO = 1200;

// Factor K estándar para tenis de mesa
const ELO_K_FACTOR = 32;

/**
 * Rating ELO actual de un jugador (o el inicial si no tiene).
 */
function playerElo(player) {
    return (player && typeof player.elo === 'number') ? player.elo : window.DEFAULT_ELO;
}

/**
 * Probabilidad esperada de victoria de A frente a B (fórmula ELO estándar).
 */
function expectedScore(ra, rb) {
    return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

/**
 * Resultado de un partido por sets: 1 = gana el jugador 1, 0 = gana el jugador 2, 0.5 = empate.
 * Usa el reglamento ITTF compartido (reglamento.js): solo cuentan sets válidos
 * (11 puntos con 2 de diferencia, deuce ilimitado) y el ganador debe alcanzar
 * la mayoría según el formato (BO3/BO5/BO7). Los partidos W.O. devuelven 0.5
 * (no se computa rating: no hubo partido jugado).
 */
function matchWinner(match) {
    if (!match || !match.sets) return 0.5;
    const s1 = match.sets.player1 || [];
    const s2 = match.sets.player2 || [];
    if (match.wo) return 0.5;
    const formato = match.formato || (window.ITTFRULES ? window.ITTFRULES.groupFormat() : 'bo5');
    const w = window.ITTFRULES ? window.ITTFRULES.matchWinnerBySets(s1, s2, formato) : 0;
    return w === 1 ? 1 : w === -1 ? 0 : 0.5;
}

/**
 * Calcula los deltas ELO de ambos jugadores según su rating y el resultado.
 * @param {number} ra - Rating del jugador A
 * @param {number} rb - Rating del jugador B
 * @param {number} scoreA - Resultado para A: 1 = gana, 0 = pierde, 0.5 = empate
 * @returns {{deltaA: number, deltaB: number}}
 */
window.computeEloDelta = function(ra, rb, scoreA) {
    const expectedA = expectedScore(ra, rb);
    const expectedB = expectedScore(rb, ra);
    const deltaA = Math.round(ELO_K_FACTOR * (scoreA - expectedA));
    const deltaB = Math.round(ELO_K_FACTOR * ((1 - scoreA) - expectedB));
    return { deltaA, deltaB };
};

/**
 * Rating ELO actual de un jugador de la base de datos.
 */
window.getPlayerElo = function(player) {
    return playerElo(player);
};

/**
 * Sincroniza el ELO de los jugadores de un fixture según sus partidos.
 * Cada partido decidido guarda el delta aplicado (m.eloDeltaA/m.eloDeltaB) y
 * una huella de su resultado (m.eloFingerprint). Al re-sincronizar:
 *  - Si el resultado NO cambió: se conserva el delta ya aplicado (no se
 *    recalcula), aunque el rating del jugador haya cambiado por otros fixtures.
 *  - Si el resultado cambió (o no había delta): se revierte el delta previo y
 *    se recalcula contra el rating actual.
 * Así editar sets o re-guardar un grupo nunca duplica deltas NI pisa los de
 * otros grupos con jugadores en común (idempotente).
 * @param {Object} fixture - Fixture con .players y .matches
 */
window.syncEloForFixture = function(fixture) {
    if (!fixture || !fixture.matches) return false;
    const matches = (fixture.matches || []).filter(m => m && m.player1 && m.player2);

    const idKey = p => p.name + '|' + p.club;
    const findPlayer = id => {
        const idx = id.indexOf('|');
        const name = id.slice(0, idx);
        const club = id.slice(idx + 1);
        return (tournamentData.players || []).find(x => x.name === name && x.club === club);
    };

    // Integrantes reales de un participante (vacío si es individual).
    const memberList = p => {
        if (Array.isArray(p && p.members) && p.members.length >= 2) return p.members;
        return [];
    };

    // IDs de rating que se ven afectados por un participante: su propio
    // registro y, en dobles/equipos, el de cada integrante.
    const participantIds = p => {
        const ids = [idKey(p)];
        memberList(p).forEach(m => ids.push(idKey(m)));
        return ids;
    };

    // Aplica un delta al registro del participante y a cada integrante.
    const applyDelta = (participant, delta) => {
        const db = findPlayer(idKey(participant));
        if (db) db.elo += delta;
        memberList(participant).forEach(m => {
            const mdb = findPlayer(idKey(m));
            if (mdb) mdb.elo += delta;
        });
    };

    // Revierte los deltas previos que un partido aplicó (si los tenía).
    const revertMatchDeltas = m => {
        if (typeof m.eloDeltaA === 'number') {
            participantIds(m.player1).forEach(id => {
                const db = findPlayer(id);
                if (db) db.elo -= m.eloDeltaA;
            });
            delete m.eloDeltaA;
        }
        if (typeof m.eloDeltaB === 'number') {
            participantIds(m.player2).forEach(id => {
                const db = findPlayer(id);
                if (db) db.elo -= m.eloDeltaB;
            });
            delete m.eloDeltaB;
        }
        delete m.eloFingerprint;
    };

    // 1) Línea base por registro de rating (participante + integrantes).
    // Registro informativo: otros módulos (p. ej. renombrar jugadores) la
    // remapean. No se usa para revertir: cada partido revierte su propio delta.
    const ids = new Set();
    matches.forEach(m => {
        participantIds(m.player1).forEach(id => ids.add(id));
        participantIds(m.player2).forEach(id => ids.add(id));
    });
    const baseKeys = fixture.eloBaseline ? Object.keys(fixture.eloBaseline) : [];
    const samePlayers = baseKeys.length === ids.size && [...ids].every(k => fixture.eloBaseline[k] !== undefined);
    if (!fixture.eloBaseline || !samePlayers) {
        fixture.eloBaseline = {};
        ids.forEach(id => {
            const db = findPlayer(id);
            if (db) fixture.eloBaseline[id] = playerElo(db);
        });
    }

    // Snapshot de los ratings antes de tocar nada (para detectar cambios reales)
    const before = {};
    ids.forEach(id => {
        const db = findPlayer(id);
        if (db) before[id] = db.elo;
    });

    // 2) Aplicar/reconciliar cada partido.
    matches.forEach(m => {
        const winner = matchWinner(m);
        m.eloApplied = winner !== 0.5;
        const resultFingerprint = JSON.stringify([m.sets && m.sets.player1, m.sets && m.sets.player2, m.wo ? 1 : 0, m.woWinnerSide]);

        if (winner === 0.5) {
            // Sin resultado (W.O. o sets incompletos): si antes aplicó delta,
            // revertirlo (el resultado cambió y dejó de computar).
            if (typeof m.eloDeltaA === 'number' || typeof m.eloDeltaB === 'number') {
                revertMatchDeltas(m);
            }
            return;
        }

        const unchanged = typeof m.eloDeltaA === 'number' && typeof m.eloDeltaB === 'number' && m.eloFingerprint === resultFingerprint;
        if (unchanged) return;

        // Resultado nuevo o modificado: revertir lo previo y recalcular.
        revertMatchDeltas(m);
        const p1 = findPlayer(idKey(m.player1));
        const p2 = findPlayer(idKey(m.player2));
        if (!p1 || !p2) return;
        const ra = playerElo(p1);
        const rb = playerElo(p2);
        const { deltaA, deltaB } = window.computeEloDelta(ra, rb, winner === 1 ? 1 : 0);
        applyDelta(m.player1, deltaA);
        applyDelta(m.player2, deltaB);
        m.eloDeltaA = deltaA;
        m.eloDeltaB = deltaB;
        m.eloFingerprint = resultFingerprint;
    });

    // 3) Guardar solo si hubo cambios efectivos en los ratings (idempotente:
    // re-sincronizar un fixture sin cambios no debe guardar ni duplicar).
    const changed = [...ids].some(id => {
        const db = findPlayer(id);
        return db && before[id] !== undefined && db.elo !== before[id];
    });
    if (changed) saveTournamentData();
    return changed;
};

/**
 * Revierte los deltas ELO que aplicó un fixture (para eliminar el fixture):
 * resta los m.eloDeltaA/m.eloDeltaB de cada partido decidido.
 * @param {Object} fixture - Fixture con .matches
 */
window.revertEloForFixture = function(fixture) {
    if (!fixture || !fixture.matches) return;
    const idKey = p => p.name + '|' + p.club;
    const findPlayer = id => {
        const idx = id.indexOf('|');
        const name = id.slice(0, idx);
        const club = id.slice(idx + 1);
        return (tournamentData.players || []).find(x => x.name === name && x.club === club);
    };
    const memberList = p => {
        if (Array.isArray(p && p.members) && p.members.length >= 2) return p.members;
        return [];
    };
    const participantIds = p => {
        const ids = [idKey(p)];
        memberList(p).forEach(m => ids.push(idKey(m)));
        return ids;
    };

    fixture.matches.forEach(m => {
        if (!m || !m.player1 || !m.player2) return;
        if (typeof m.eloDeltaA === 'number') {
            participantIds(m.player1).forEach(id => {
                const db = findPlayer(id);
                if (db) db.elo -= m.eloDeltaA;
            });
        }
        if (typeof m.eloDeltaB === 'number') {
            participantIds(m.player2).forEach(id => {
                const db = findPlayer(id);
                if (db) db.elo -= m.eloDeltaB;
            });
        }
        delete m.eloDeltaA;
        delete m.eloDeltaB;
        delete m.eloFingerprint;
        m.eloApplied = false;
    });
    saveTournamentData();
};

