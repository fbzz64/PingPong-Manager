// ==========================================
// REGLAMENTO.JS - Reglamento de juego (ITTF/FATM)
// ==========================================
// Validación de planillas según el reglamento de tenis de mesa:
//   - Un set se gana con 11 puntos y diferencia mínima de 2.
//   - Si ambos jugadores llegan a 10 o más (deuce), el set continúa
//     hasta que uno obtenga 2 puntos de ventaja (deuce ilimitado).
//   - Un partido se gana por mayoría de sets según el formato configurado
//     (BO3 = al mejor de 3, BO5 = al mejor de 5), independiente por fase:
//     grupos/fixtures y llaves eliminatorias.
//   - Resultado W.O. (incomparecencia): el rival que no se presenta pierde
//     el partido por forfeit, con 11-0 en todos los sets.
// El módulo es de solo lectura sobre los datos: todos los consumidores
// (fixtures, brackets, stats, elo) lo usan como fuente única de reglas.
// ==========================================

window.ITTFRULES = {
    /**
     * Sets necesarios para ganar un partido según el formato.
     * @param {string} format - 'bo3' | 'bo5' | 'bo7' | 'bo7' (cualquier otro valor = BO5)
     * @returns {number} 2 para BO3, 3 para BO5, 4 para BO7
     */
    setsToWin: function(format) {
        const f = String(format || '').toLowerCase();
        if (f === 'bo3') return 2;
        if (f === 'bo7') return 4;
        return 3;
    },

    /**
     * Formato configurado para los partidos de grupos/fixtures.
     * @returns {string} 'bo3' | 'bo5' | 'bo7'
     */
    groupFormat: function() {
        // `tournamentData` es un `let` en main.js: NO crea window.tournamentData
        // (los let/const globales no se reflejan en window). Leer el global
        // desnudo para ver el formato configurado por el usuario.
        const s = (typeof tournamentData !== 'undefined' && tournamentData && tournamentData.settings) || {};
        const f = s.formatoPartidoGrupos;
        return (f === 'bo3' || f === 'bo7') ? f : 'bo5';
    },

    /**
     * Formato configurado para los partidos de llaves eliminatorias.
     * @returns {string} 'bo3' | 'bo5' | 'bo7'
     */
    bracketFormat: function() {
        const s = (typeof tournamentData !== 'undefined' && tournamentData && tournamentData.settings) || {};
        const f = s.formatoPartidoLlaves;
        return (f === 'bo3' || f === 'bo7') ? f : 'bo5';
    },

    /**
     * Número de columnas de sets que muestra una planilla según el formato.
     * BO3 → 3 columnas, BO5 → 5 columnas, BO7 → 7 columnas.
     * @param {string} format - 'bo3' | 'bo5' | 'bo7' | 'bo7'
     * @returns {number}
     */
    setColumns: function(format) {
        return this.setsToWin(format) * 2 - 1;
    },

    /**
     * ¿Un par de puntajes es un set válido según ITTF?
     * Regla: el ganador debe llegar primero a 11; si ambos llegan a 10 o más
     * (deuce), gana quien obtenga 2 de ventaja. Nunca puede haber empate ni
     * diferencia de 1 en un set terminado.
     * @param {number} p1 - Puntos del jugador 1
     * @param {number} p2 - Puntos del jugador 2
     * @returns {boolean}
     */
    isValidSetScore: function(p1, p2) {
        if (typeof p1 !== 'number' || typeof p2 !== 'number') return false;
        if (p1 < 0 || p2 < 0) return false;
        if (p1 === 0 && p2 === 0) return false;
        return Math.max(p1, p2) >= 11 && Math.abs(p1 - p2) >= 2;
    },

    /**
     * Ganador de un set: 1 = gana P1, -1 = gana P2, 0 = sin ganador/inválido.
     * @param {number} p1 - Puntos del jugador 1
     * @param {number} p2 - Puntos del jugador 2
     * @returns {number}
     */
    getSetWinner: function(p1, p2) {
        if (!this.isValidSetScore(p1, p2)) return 0;
        return p1 > p2 ? 1 : -1;
    },

    /**
     * ¿Ambas celdas del set tienen un valor cargado? (set "ingresado").
     * Permite distinguir una celda vacía (partido en progreso) de un 0 real.
     * @param {*} v1 - Valor de la celda del jugador 1
     * @param {*} v2 - Valor de la celda del jugador 2
     * @returns {boolean}
     */
    setEntered: function(v1, v2) {
        const clean = v => v !== undefined && v !== null && String(v).trim() !== '';
        return clean(v1) && clean(v2);
    },

    /**
     * ¿El set tiene algún resultado cargado? (no ambos vacíos/0)
     * @param {number} p1 - Puntos del jugador 1
     * @param {number} p2 - Puntos del jugador 2
     * @returns {boolean}
     */
    setPlayed: function(p1, p2) {
        return (typeof p1 === 'number' && p1 > 0) || (typeof p2 === 'number' && p2 > 0);
    },

    /**
     * Cuenta los sets ganados válidos de un jugador.
     * @param {Array<number>} mySets - Puntos del jugador por set
     * @param {Array<number>} oppSets - Puntos del rival por set
     * @returns {number}
     */
    countSetWins: function(mySets, oppSets) {
        const a = mySets || [];
        const b = oppSets || [];
        let wins = 0;
        for (let i = 0; i < Math.max(a.length, b.length, 7); i++) {
            // Set a medias (solo una celda cargada) no es un set jugado:
            // no cuenta como 11-0 para el que tiene puntos.
            if (!this.setEntered(a[i], b[i])) continue;
            const sa = parseInt(a[i]) || 0;
            const sb = parseInt(b[i]) || 0;
            if (this.getSetWinner(sa, sb) === 1) wins++;
        }
        return wins;
    },

    /**
     * Ganador de un partido por sets, según el formato.
     * Los sets se evalúan en orden y el partido se declara decidido apenas un
     * jugador alcanza la mayoría requerida (no se exigen sets posteriores).
     * @param {Array<number>} p1Sets - Puntos del jugador 1 por set
     * @param {Array<number>} p2Sets - Puntos del jugador 2 por set
     * @param {string} format - 'bo3' | 'bo5' | 'bo7'
     * @returns {number} 1 = gana P1, -1 = gana P2, 0 = no decidido/sin ganador
     */
    matchWinnerBySets: function(p1Sets, p2Sets, format) {
        const need = this.setsToWin(format);
        const a = p1Sets || [];
        const b = p2Sets || [];
        let w1 = 0, w2 = 0;
        for (let i = 0; i < Math.max(a.length, b.length, 7); i++) {
            // Un set a medias (solo una celda cargada) no decide el partido:
            // el valor solo no cuenta como set ganado 11-0.
            if (!this.setEntered(a[i], b[i])) continue;
            const sa = parseInt(a[i]) || 0;
            const sb = parseInt(b[i]) || 0;
            const w = this.getSetWinner(sa, sb);
            if (w === 1) w1++;
            else if (w === -1) w2++;
            if (w1 >= need) return 1;
            if (w2 >= need) return -1;
        }
        return 0;
    },

    /**
     * ¿El partido está decidido (tiene un ganador válido según el formato)?
     * @param {Array<number>} p1Sets - Puntos del jugador 1 por set
     * @param {Array<number>} p2Sets - Puntos del jugador 2 por set
     * @param {string} format - 'bo3' | 'bo5' | 'bo7'
     * @returns {boolean}
     */
    matchCompleted: function(p1Sets, p2Sets, format) {
        return this.matchWinnerBySets(p1Sets, p2Sets, format) !== 0;
    },

    /**
     * Detecta sets cargados pero inválidos (ambas celdas llenas sin ganador ITTF).
     * Los sets en progreso (falta el rival) no se consideran inválidos.
     * @param {Array} p1Sets - Puntos del jugador 1 por set (valores o '' vacío)
     * @param {Array} p2Sets - Puntos del jugador 2 por set (valores o '' vacío)
     * @returns {Array<number>} Índices (1-based) de los sets inválidos
     */
    invalidSetIndexes: function(p1Sets, p2Sets) {
        const a = p1Sets || [];
        const b = p2Sets || [];
        const bad = [];
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const p1 = parseInt(a[i]) || 0;
            const p2 = parseInt(b[i]) || 0;
            if (p1 === 0 && p2 === 0) continue;
            if (!this.setEntered(a[i], b[i])) continue;
            if (!this.isValidSetScore(p1, p2)) bad.push(i + 1);
        }
        return bad;
    },

    /**
     * Detecta partidos con datos pero sin ganador definido (empate/sin decidir).
     * @param {Array} p1Sets - Puntos del jugador 1 por set (valores o '' vacío)
     * @param {Array} p2Sets - Puntos del jugador 2 por set (valores o '' vacío)
     * @param {string} format - 'bo3' | 'bo5' | 'bo7'
     * @returns {boolean}
     */
    matchUndecided: function(p1Sets, p2Sets, format) {
        const a = p1Sets || [];
        const b = p2Sets || [];
        let hasEnteredSet = false;
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            if (this.setEntered(a[i], b[i])) {
                hasEnteredSet = true;
                break;
            }
        }
        return hasEnteredSet && !this.matchCompleted(a, b, format);
    },

    // ==========================================
    // CLASIFICACIÓN DE GRUPOS (ITTF 3.7.5)
    // ==========================================
    // Puntos: 2 por victoria, 1 por derrota jugada, 0 por derrota sin jugar
    // (W.O.) o partido sin decidir. En caso de empate en puntos, las posiciones
    // se resuelven SOLO con los partidos entre los empatados (mini-torneo),
    // considerando sucesivamente puntos de partido, cociente de sets y cociente
    // de puntos (3.7.5.2). Si un paso resuelve algunos puestos, los resultados
    // de esos jugadores se excluyen de los cálculos siguientes (3.7.5.3).
    // Si el empate persiste sin datos, se deja igualado (en el torneo real se
    // decide por sorteo, 3.7.5.4).

    /**
     * Lado ganador de un partido: 1 = gana P1, -1 = gana P2, 0 = sin decidir.
     * Compatible con partidos guardados en versiones anteriores (sin winnerSide).
     * @param {Object} match - Partido con player1/player2, sets, winnerSide, wo
     * @param {string} [format] - Formato usado para recalcular si falta winnerSide
     * @returns {number}
     */
    matchWinnerSide: function(match, format) {
        if (!match) return 0;
        if (match.wo) {
            if (match.winnerSide === 1 || match.winnerSide === -1) return match.winnerSide;
            if (match.woWinnerSide === 1) return 1;
            if (match.woWinnerSide === 2) return -1;
            // Fallback: los sets 11-0 del ausente determinan el ganador
            const s1 = (match.sets && match.sets.player1) || [];
            const s2 = (match.sets && match.sets.player2) || [];
            const w = this.matchWinnerBySets(s1, s2, format || this.groupFormat());
            return w === 1 ? 1 : w === -1 ? -1 : 0;
        }
        if (match.winnerSide === 1 || match.winnerSide === -1) return match.winnerSide;
        const s1 = (match.sets && match.sets.player1) || [];
        const s2 = (match.sets && match.sets.player2) || [];
        const w = this.matchWinnerBySets(s1, s2, format || this.groupFormat());
        return w === 1 ? 1 : w === -1 ? -1 : 0;
    },

    /**
     * Puntos de partido ITTF (3.7.5.1) para un jugador: 2 = victoria,
     * 1 = derrota en partido jugado, 0 = derrota por W.O. o partido sin decidir.
     * @param {Object} match - Partido completado
     * @param {string} name - Nombre del jugador
     * @param {string} club - Club del jugador
     * @returns {number}
     */
    matchPointsFor: function(match, name, club) {
        if (!match || !match.completed) return 0;
        if (!match.player1 || !match.player2) return 0;
        const isP1 = match.player1.name === name && match.player1.club === club;
        const isP2 = match.player2.name === name && match.player2.club === club;
        if (!isP1 && !isP2) return 0;
        const ws = this.matchWinnerSide(match);
        if (ws === 0) return 0;
        const won = (isP1 && ws === 1) || (isP2 && ws === -1);
        if (won) return 2;
        return match.wo ? 0 : 1;
    },

    /**
     * Cociente de sets ganados/perdidos de una fila de standings.
     */
    _setsQuotient: function(r) {
        return r.setsLost === 0 ? (r.setsWon > 0 ? Infinity : 0) : r.setsWon / r.setsLost;
    },

    /**
     * Cociente de puntos a favor/en contra de una fila de standings.
     */
    _pointsQuotient: function(r) {
        return r.pointsAgainst === 0 ? (r.pointsFor > 0 ? Infinity : 0) : r.pointsFor / r.pointsAgainst;
    },

    /**
     * Mini-torneo entre un grupo de jugadores empatados (3.7.5.2): usa solo los
     * partidos entre ellos y ordena por puntos de partido → cociente de sets →
     * cociente de puntos. Devuelve lista de subgrupos ya resueltos (los que
     * siguen igualados quedan juntos en un mismo subgrupo).
     * @param {Array} group - Filas ({ name, club }) del grupo empatado
     * @param {Array} matches - Partidos del fixture
     * @returns {Array} Subgrupos ordenados (cada uno es una lista de filas)
     */
    _splitMini: function(group, matches) {
        const sub = (matches || []).filter(m => {
            if (!m || !m.completed || !m.player1 || !m.player2) return false;
            return group.some(r => r.name === m.player1.name && r.club === m.player1.club) &&
                   group.some(r => r.name === m.player2.name && r.club === m.player2.club) &&
                   (m.player1.name !== m.player2.name || m.player1.club !== m.player2.club);
        });

        const rows = group.map(row => {
            const st = { row, pts: 0, setsWon: 0, setsLost: 0, pointsFor: 0, pointsAgainst: 0 };
            sub.forEach(m => {
                const isP1 = m.player1.name === row.name && m.player1.club === row.club;
                const isP2 = m.player2.name === row.name && m.player2.club === row.club;
                if (!isP1 && !isP2) return;
                const ws = this.matchWinnerSide(m);
                if (ws === 0) return;
                const won = (isP1 && ws === 1) || (isP2 && ws === -1);
                st.pts += won ? 2 : (m.wo ? 0 : 1);
                if (m.wo) return; // los sets de un W.O. no son sets jugados
                const s1 = (m.sets && m.sets.player1) || [];
                const s2 = (m.sets && m.sets.player2) || [];
                for (let i = 0; i < Math.max(s1.length, s2.length, 5); i++) {
                    if (!this.setEntered(s1[i], s2[i])) continue;
                    const a = parseInt(s1[i]) || 0;
                    const b = parseInt(s2[i]) || 0;
                    if (a === 0 && b === 0) continue;
                    const w = this.getSetWinner(a, b);
                    if (w === 1) { if (isP1) st.setsWon++; else st.setsLost++; }
                    else if (w === -1) { if (isP1) st.setsLost++; else st.setsWon++; }
                    if (isP1) { st.pointsFor += a; st.pointsAgainst += b; }
                    else { st.pointsFor += b; st.pointsAgainst += a; }
                }
            });
            return st;
        });

        rows.sort((x, y) => {
            if (y.pts !== x.pts) return y.pts - x.pts;
            const qxs = this._setsQuotient(x), qys = this._setsQuotient(y);
            if (qys > qxs) return 1;
            if (qys < qxs) return -1;
            const qxp = this._pointsQuotient(x), qyp = this._pointsQuotient(y);
            if (qyp > qxp) return 1;
            if (qyp < qxp) return -1;
            return (x.row.name || '').localeCompare(y.row.name || '');
        });

        const result = [];
        let cur = [rows[0]];
        for (let k = 1; k < rows.length; k++) {
            const same = rows[k].pts === rows[k - 1].pts &&
                         this._setsQuotient(rows[k]) === this._setsQuotient(rows[k - 1]) &&
                         this._pointsQuotient(rows[k]) === this._pointsQuotient(rows[k - 1]);
            if (same) cur.push(rows[k]);
            else { result.push(cur); cur = [rows[k]]; }
        }
        result.push(cur);
        return result;
    },

    /**
     * Resuelve recursivamente un grupo de jugadores empatados (3.7.5.3).
     * @param {Array} group - Filas ({ name, club }) empatadas en todo lo anterior
     * @param {Array} matches - Partidos del fixture
     * @returns {Array} Grupos finales ordenados (subgrupos irresolubles quedan juntos)
     */
    _resolveGroup: function(group, matches) {
        if (group.length <= 1) return [group];
        const split = this._splitMini(group, matches);
        if (split.length === 1) return [group]; // sin datos entre ellos → sorteo
        const out = [];
        split.forEach(stGroup => {
            const rawGroup = stGroup.map(st => st.row);
            if (rawGroup.length <= 1) out.push(rawGroup);
            else out.push(...this._resolveGroup(rawGroup, matches));
        });
        return out;
    },

    /**
     * Índice de un jugador en el orden sorteado (3.7.5.4). Devuelve -1 si el
     * sorteo no lo cubre.
     * @param {Array} sorteo - Orden sorteado: [{ name, club }, ...]
     * @param {string} name - Nombre del jugador
     * @param {string} club - Club del jugador
     * @returns {number}
     */
    _sorteoIndexOf: function(sorteo, name, club) {
        if (!Array.isArray(sorteo)) return -1;
        for (let i = 0; i < sorteo.length; i++) {
            const s = sorteo[i];
            if (s && s.name === name && s.club === club) return i;
        }
        return -1;
    },

    /**
     * Clasificación ITTF completa de un grupo (3.7.5). Devuelve las posiciones
     * ordenadas con todos los agregados. Solo cuentan partidos completados con
     * ganador válido; los partidos W.O. aportan puntos (2/0) pero sus sets no
     * entran en los cocientes. Los empates irresolubles (3.7.5.4) se resuelven
     * por el orden del sorteo cuando este cubre a todos los empatados; en caso
     * contrario comparten rango.
     * @param {Array} players - Participantes del grupo ({ name, club })
     * @param {Array} matches - Partidos del fixture (estructura extractMatchesData)
     * @param {Array} [sorteo] - Orden sorteado para desempatar por sorteo (3.7.5.4)
     * @returns {Array} [{ player, name, club, played, matchesWon, matchesLost,
     *                     matchPoints, setsWon, setsLost, pointsFor, pointsAgainst, rank }]
     */
    groupStandings: function(players, matches, sorteo) {
        const rows = [];
        const rowOf = (name, club) => rows.find(r => r.name === name && r.club === club);

        (players || []).forEach(p => {
            rows.push({
                player: p,
                name: p.name,
                club: p.club,
                played: 0, matchesWon: 0, matchesLost: 0,
                matchPoints: 0, setsWon: 0, setsLost: 0,
                pointsFor: 0, pointsAgainst: 0
            });
        });

        (matches || []).forEach(m => {
            if (!m || !m.completed || !m.player1 || !m.player2) return;
            const r1 = rowOf(m.player1.name, m.player1.club);
            const r2 = rowOf(m.player2.name, m.player2.club);
            if (!r1 || !r2) return;
            const ws = this.matchWinnerSide(m);
            if (ws === 0) return;

            r1.played++;
            r2.played++;
            if (ws === 1) { r1.matchesWon++; r2.matchesLost++; }
            else { r2.matchesWon++; r1.matchesLost++; }
            r1.matchPoints += ws === 1 ? 2 : (m.wo ? 0 : 1);
            r2.matchPoints += ws === -1 ? 2 : (m.wo ? 0 : 1);

            if (m.wo) return; // sets de W.O. no cuentan para cocientes
            const s1 = (m.sets && m.sets.player1) || [];
            const s2 = (m.sets && m.sets.player2) || [];
            for (let i = 0; i < Math.max(s1.length, s2.length, 5); i++) {
                if (!this.setEntered(s1[i], s2[i])) continue;
                const a = parseInt(s1[i]) || 0;
                const b = parseInt(s2[i]) || 0;
                if (a === 0 && b === 0) continue;
                const w = this.getSetWinner(a, b);
                if (w === 1) { r1.setsWon++; r2.setsLost++; }
                else if (w === -1) { r2.setsWon++; r1.setsLost++; }
                r1.pointsFor += a; r1.pointsAgainst += b;
                r2.pointsFor += b; r2.pointsAgainst += a;
            }
        });

        // Orden primario por puntos de partido (3.7.5.1); estable por nombre
        rows.sort((a, b) => b.matchPoints - a.matchPoints || (a.name || '').localeCompare(b.name || ''));

        // Resolver bandas de iguales puntos con mini-torneo (3.7.5.2/3)
        const finalGroups = [];
        let i = 0;
        while (i < rows.length) {
            let j = i;
            while (j + 1 < rows.length && rows[j + 1].matchPoints === rows[i].matchPoints) j++;
            finalGroups.push(...this._resolveGroup(rows.slice(i, j + 1), matches));
            i = j + 1;
        }

        // Asignar rangos (1, 1, 3 si hay empate irresoluble; o posiciones
        // consecutivas si el sorteo 3.7.5.4 cubre a los empatados)
        const standings = [];
        let pos = 0;
        finalGroups.forEach(group => {
            pos += 1;
            const baseRank = pos;
            let ordered = group;
            let hasDraw = false;
            if (group.length > 1 && Array.isArray(sorteo) && sorteo.length > 0) {
                const indexed = group.map(r => ({ r, d: this._sorteoIndexOf(sorteo, r.name, r.club) }));
                if (indexed.every(x => x.d >= 0)) {
                    ordered = indexed.slice().sort((a, b) => a.d - b.d).map(x => x.r);
                    hasDraw = true;
                }
            }
            ordered.forEach(r => {
                standings.push({
                    player: r.player,
                    name: r.name,
                    club: r.club,
                    played: r.played,
                    matchesWon: r.matchesWon,
                    matchesLost: r.matchesLost,
                    matchPoints: r.matchPoints,
                    setsWon: r.setsWon,
                    setsLost: r.setsLost,
                    pointsFor: r.pointsFor,
                    pointsAgainst: r.pointsAgainst,
                    rank: hasDraw ? pos : baseRank
                });
                if (hasDraw) pos += 1;
            });
            if (hasDraw) pos -= 1;
            else pos += group.length - 1;
        });

        return standings;
    }
};

