// ==========================================
// FIXTURES.JS - GESTIÓN DE FIXTURES
// ==========================================
// Este archivo contiene todas las funciones relacionadas con:
// - Generación de fixtures
// - Gestión de jugadores en fixtures
// - Validación y cálculo de puntajes
// - Visualización e impresión de fixtures
// - Categorías y grupos
// ==========================================

// ==========================================
// GENERACIÓN DE FIXTURES
// ==========================================

/**
 * Genera un fixture completo all-vs-all
 */
window.generateFixture = function() {
    const categoria = document.getElementById('categoria').value;
    const grupo = document.getElementById('grupo').value;
    const torneoNombre = document.getElementById('torneoNombre').value;
    const subtitulo = document.getElementById('subtitulo').value;
    const totalPlayers = parseInt(document.getElementById('numJugadores').value);

    let players = [];
    const playerInputs = document.querySelectorAll('.player-name');
    const clubInputs = document.querySelectorAll('.club-input');

    for (let i = 0; i < totalPlayers; i++) {
        const name = formatPlayerName(playerInputs[i]?.value || "");
        const club = formatPlayerClub(clubInputs[i]?.value || "");
        if (!name || !club) {
            showToast('Por favor completa todos los campos de jugadores', 'error');
            return;
        }
        players.push({ name, club, index: i, points: 0 });
    }

    // Validación de conflictos: una persona no puede estar en dos participantes del grupo
    const groupConflicts = typeof window.findDuplicatePersonInParticipants === 'function'
        ? window.findDuplicatePersonInParticipants(players) : [];
    if (groupConflicts.length > 0) {
        const c = groupConflicts[0];
        const personName = c.person.split('|')[0];
        const names = c.participants.map(p => p.name + ' (' + p.club + ')').join(' y ');
        showToast('⚠️ Conflicto: ' + personName + ' está en dos participantes del mismo grupo: ' + names + '. Corregí antes de continuar.', 'error');
        return;
    }

    // Adjuntar los integrantes reales de parejas/equipos a las entradas del fixture
    players = typeof window.attachMembersToFixturePlayers === 'function' ? window.attachMembersToFixturePlayers(players) : players;

    currentPlayers = [...players];
    const realPlayers = players.filter(p => p.name !== "-" && p.club !== "-").length;

    const outputDiv = document.getElementById('fixture-output');
    outputDiv.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.style.textAlign = 'center';
    header.style.marginBottom = '20px';
    header.style.padding = '15px';
    header.style.background = 'var(--header-bg)';
    header.style.borderRadius = '8px';
    header.innerHTML = `
        <h2 style="margin: 0 0 10px 0; color: var(--text-color);">${torneoNombre}</h2>
        <p style="margin: 5px 0; color: var(--text-color);">${subtitulo}</p>
        <p style="margin: 5px 0; font-weight: bold; color: var(--text-color);">
            CATEGORÍA: ${categoria} | GRUPO: ${grupo} | JUGADORES: ${realPlayers}
        </p>
    `;
    outputDiv.appendChild(header);

    // Toolbar con el sorteo de desempates (ITTF 3.7.5.4)
    window.__currentSorteo = null;
    const toolbar = document.createElement('div');
    toolbar.style.display = 'flex';
    toolbar.style.gap = '10px';
    toolbar.style.margin = '0 0 12px 0';
    toolbar.style.flexWrap = 'wrap';
    toolbar.innerHTML = `
        <button class="btn btn-warning" onclick="drawLotsForGroup()" title="Regla ITTF 3.7.5.4: si tras el mini-torneo quedan igualados, la posición se decide por sorteo">
            🎲 Sorteo de desempates
        </button>
        <button class="btn btn-primary" onclick="exportMatchSheetsPackPDF()" title="Exporta un PDF con las planillas oficiales en blanco de todos los partidos del grupo, para entregar al árbitro">
            📄 Planillas PDF
        </button>
        <button class="btn btn-success" onclick="shareMatchSheetsPackPDF()" title="Comparte el PDF de planillas en blanco por WhatsApp, correo, redes, etc.">
            📤 Compartir planillas
        </button>
    `;
    outputDiv.appendChild(toolbar);

    // Tabla resumen
    const summaryTable = document.createElement('table');
    summaryTable.className = `summary-table ${totalPlayers === 4 ? 'compact' : ''}`;

    let headerRow = '<tr><th>JUGADOR</th><th>CLUB</th>';
    for (let i = 0; i < Math.min(totalPlayers, 8); i++) {
        headerRow += `<th>${String.fromCharCode(65 + i)}</th>`;
    }
    headerRow += '<th>Pts.</th><th>Pos.</th></tr>';
    summaryTable.innerHTML = headerRow;

    players.forEach((p, idx) => {
        const row = document.createElement('tr');
        row.className = `player-${p.index + 1}`;
        let cells = `<td>${escHtml(p.name)}</td><td>${escHtml(p.club)}</td>`;

        for (let col = 0; col < totalPlayers && col < 8; col++) {
            if (col === idx) {
                cells += `<td class="free-cell"></td>`;
            } else {
                cells += `<td id="summary-${p.index}-${col}"></td>`;
            }
        }

        cells += `<td id="pts-${p.index}"></td>`;
        cells += `<td id="pos-${p.index}"></td>`;
        row.innerHTML = cells;
        summaryTable.appendChild(row);
    });
    outputDiv.appendChild(summaryTable);

    // Tablas de enfrentamiento con tabulación vertical y botón W.O.
    let matchNumber = 1;
    let tabIndexCounter = 100;

    for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
            const p1 = players[i];
            const p2 = players[j];
            if ((p1.name === "-") || (p2.name === "-")) continue;

            const built = buildMatchTableHTML(p1, p2, matchNumber, tabIndexCounter);
            tabIndexCounter = built.counter;
            outputDiv.insertAdjacentHTML('beforeend', built.html);
            matchNumber++;
        }
    }

    showToast('Fixture generado correctamente');
    addLog('GENERAR FIXTURE', `${categoria} - Grupo ${grupo} - ${realPlayers} jugadores`);
    saveLastFixtureSelection();
    updateFixtureNavigator();
};

// ==========================================
// VALIDACIÓN Y CÁLCULO DE PUNTOS
// ==========================================

/**
 * Valida y calcula puntos cuando se modifica una celda
 */
/**
 * Describe por qué un par de puntajes no es un set válido según ITTF.
 */
function ittfSetErrorReason(p1, p2) {
    if (p1 === p2) {
        return 'Set inválido (' + p1 + '-' + p2 + '): un set no puede terminar en empate.';
    }
    if (Math.max(p1, p2) < 11) {
        return 'Set inválido (' + p1 + '-' + p2 + '): se gana llegando primero a 11 puntos.';
    }
    if (Math.abs(p1 - p2) < 2) {
        return 'Set inválido (' + p1 + '-' + p2 + '): en el deuce se gana con 2 puntos de ventaja.';
    }
    return 'Set inválido (' + p1 + '-' + p2 + ').';
}

window.validateAndCalculate = function(cell) {
    const raw = cell.textContent.trim();
    const value = parseInt(raw);

    // Celda vacía: se limpia y se recalcula el partido
    if (raw === '') {
        cell.classList.remove('invalid-score', 'valid-score', 'winner-score');
        highlightSetWinner(cell);
        calculateMatchPoints(cell);
        return;
    }

    if (isNaN(value) || value < 0) {
        cell.classList.add('invalid-score');
        cell.classList.remove('valid-score', 'winner-score');
        showToast('Puntuación inválida. Debe ser un número positivo.', 'error');
        return;
    }

    cell.classList.remove('invalid-score', 'winner-score');
    cell.classList.add('valid-score');

    highlightSetWinner(cell);

    // Validación del par de celdas del mismo set (reglamento ITTF)
    const setNumber = cell.getAttribute('data-set');
    const table = cell.closest('.match-table');
    if (table) {
        const pr = matchPlayerRows(table);
        const isP1 = cell.parentNode === pr[0];
        const partnerRow = isP1 ? pr[1] : pr[0];
        if (partnerRow) {
            const partner = partnerRow.querySelector(`[data-set="${setNumber}"]`);
            const raw1 = isP1 ? raw : (partner ? partner.textContent.trim() : '');
            const raw2 = isP1 ? (partner ? partner.textContent.trim() : '') : raw;
            if (raw1 !== '' && raw2 !== '') {
                const v1 = parseInt(raw1) || 0;
                const v2 = parseInt(raw2) || 0;
                if ((v1 > 0 || v2 > 0) && !window.ITTFRULES.isValidSetScore(v1, v2)) {
                    showToast('⚠️ ' + ittfSetErrorReason(v1, v2), 'warning');
                }
            }
        }
    }

    calculateMatchPoints(cell);
};

/**
 * Devuelve las dos filas de jugadores de una tabla de partido (P1 y P2),
 * buscándolas por su atributo data-player-index. Esto hace que el resto del
 * código sea inmune a filas extras (por ejemplo, la fila de horario/mesa del
 * Multiplex que se inserta como primera fila de datos).
 */
function matchPlayerRows(table) {
    const rows = table.querySelectorAll('tr[data-player-index]');
    return [rows[0], rows[1]];
}

/**
 * Resalta el ganador de un set (regla ITTF: 11 puntos con 2 de diferencia,
 * deuce ilimitado). Si ambas celdas del set están cargadas pero no forman un
 * set válido, se marcan como inválidas.
 */
window.highlightSetWinner = function(cell) {
    const table = cell.closest('.match-table');
    if (!table) return;

    const [p1Row, p2Row] = matchPlayerRows(table);
    if (!p1Row || !p2Row) return;

    const setNumber = cell.getAttribute('data-set');
    const p1Sets = p1Row.querySelectorAll(`[data-set="${setNumber}"]`);
    const p2Sets = p2Row.querySelectorAll(`[data-set="${setNumber}"]`);

    if (p1Sets.length === 0 || p2Sets.length === 0) return;

    const p1Raw = p1Sets[0].textContent.trim();
    const p2Raw = p2Sets[0].textContent.trim();

    p1Sets[0].classList.remove('winner-score', 'invalid-score');
    p2Sets[0].classList.remove('winner-score', 'invalid-score');

    // Set en progreso (falta el rival): sin marca de ganador
    if (p1Raw === '' || p2Raw === '') return;

    const p1Val = parseInt(p1Raw) || 0;
    const p2Val = parseInt(p2Raw) || 0;

    // Ambos en 0 = set sin jugar
    if (p1Val === 0 && p2Val === 0) return;

    if (window.ITTFRULES.isValidSetScore(p1Val, p2Val)) {
        const w = window.ITTFRULES.getSetWinner(p1Val, p2Val);
        if (w === 1) {
            p1Sets[0].classList.add('winner-score');
        } else if (w === -1) {
            p2Sets[0].classList.add('winner-score');
        }
    } else {
        p1Sets[0].classList.add('invalid-score');
        p2Sets[0].classList.add('invalid-score');
        p1Sets[0].classList.remove('valid-score', 'winner-score');
        p2Sets[0].classList.remove('valid-score', 'winner-score');
    }
};

/**
 * Calcula los puntos de un partido (solo cuenta sets válidos según ITTF)
 */
window.calculateMatchPoints = function(cell) {
    let table = cell.closest('.match-table');
    if (!table) return;

    const [p1Row, p2Row] = matchPlayerRows(table);
    if (!p1Row || !p2Row) return;

    // Se conservan los valores en crudo ('' = celda vacía) para que
    // countSetWins distinga un set a medias de un set jugado.
    const p1Sets = Array.from(p1Row.querySelectorAll('.set-col[contenteditable]')).map(c => c.textContent.trim());
    const p2Sets = Array.from(p2Row.querySelectorAll('.set-col[contenteditable]')).map(c => c.textContent.trim());

    const format = window.ITTFRULES.groupFormat();
    const p1Wins = window.ITTFRULES.countSetWins(p1Sets, p2Sets);
    const p2Wins = window.ITTFRULES.countSetWins(p2Sets, p1Sets);

    const matchNumber = Array.from(document.querySelectorAll('.match-table')).indexOf(table) + 1;

    const ptsP1 = document.getElementById(`pts-p1-${matchNumber}`);
    const ptsP2 = document.getElementById(`pts-p2-${matchNumber}`);

    if (ptsP1) ptsP1.textContent = p1Wins > 0 ? p1Wins : '';
    if (ptsP2) ptsP2.textContent = p2Wins > 0 ? p2Wins : '';

    // Marcador visual: partido con datos pero sin ganador definido
    const undecided = window.ITTFRULES.matchUndecided(p1Sets, p2Sets, format);
    table.classList.toggle('undecided-match', undecided);

    // Detectar empate/partido sin ganador cuando todas las columnas del
    // formato están cargadas pero nadie alcanzó la mayoría de sets
    if (undecided) {
        const cols = window.ITTFRULES.setColumns(format);
        const p1Cols = p1Row.querySelectorAll('.set-col[contenteditable]');
        const p2Cols = p2Row.querySelectorAll('.set-col[contenteditable]');
        if (p1Cols.length >= cols) {
            let allFilled = true;
            for (let i = 0; i < cols; i++) {
                if (p1Cols[i].textContent.trim() === '' || p2Cols[i].textContent.trim() === '') {
                    allFilled = false;
                    break;
                }
            }
            if (allFilled) {
                showToast('⚠️ Empate detectado: el partido no tiene ganador. Verificá los sets.', 'warning');
            }
        }
    }

    const p1Index = parseInt(ptsP1.getAttribute('data-p1-index'));
    const p2Index = parseInt(ptsP2.getAttribute('data-p2-index'));

    const summaryP1P2 = document.getElementById(`summary-${p1Index}-${p2Index}`);
    const summaryP2P1 = document.getElementById(`summary-${p2Index}-${p1Index}`);

    if (summaryP1P2) summaryP1P2.textContent = p1Wins > 0 ? p1Wins : '';
    if (summaryP2P1) summaryP2P1.textContent = p2Wins > 0 ? p2Wins : '';

    setTimeout(recalculatePoints, 100);
};

/**
 * Recalcula los puntos totales y posiciones de la tabla resumen del grupo.
 * Usa la clasificación ITTF (3.7.5): 2 puntos por victoria, 1 por derrota
 * jugada y 0 por W.O.; los empates se resuelven por mini-torneo entre los
 * empatados (cociente de sets, luego cociente de puntos).
 */
window.recalculatePoints = function() {
    const players = [...currentPlayers];
    const standings = window.ITTFRULES.groupStandings(players, extractMatchesData(), window.__currentSorteo || null);

    standings.forEach(s => {
        const ptsCell = document.getElementById(`pts-${s.player.index}`);
        const posCell = document.getElementById(`pos-${s.player.index}`);
        if (ptsCell && posCell) {
            ptsCell.textContent = s.played > 0 ? s.matchPoints : '';
            posCell.textContent = s.played > 0 ? s.rank : '';
        }

        // Persistir el resultado en el jugador (puntos ITTF + conteo de partidos)
        // para que las llaves, podios y seeds por puntos lo lean al guardar.
        const target = currentPlayers.find(p => p.index === s.player.index);
        if (target) {
            target.points = s.matchPoints;
            target.matchesPlayed = s.played;
            target.matchesWon = s.matchesWon;
            target.matchesLost = s.matchesLost;
            target.rank = s.played > 0 ? s.rank : undefined;
        }
    });

    if (typeof updateDashboard === 'function') {
        updateDashboard();
    }
};

/**
 * Sorteo de desempates irresolubles (ITTF 3.7.5.4): cuando tras aplicar el
 * mini-torneo (3.7.5.2/3) siguen igualados, la posición se decide por sorteo.
 * Baraja a los empatados que comparten rango y guarda el orden en
 * window.__currentSorteo para que el recálculo y el guardado lo respeten.
 */
window.drawLotsForGroup = function() {
    if (!currentPlayers || currentPlayers.length < 2) {
        showToast('No hay jugadores para sortear', 'info');
        return;
    }

    const matches = extractMatchesData();
    const standings = window.ITTFRULES.groupStandings(currentPlayers, matches, null);

    const bands = {};
    standings.forEach(s => {
        if (s.played === 0) return;
        (bands[s.rank] = bands[s.rank] || []).push(s);
    });

    const tiedRanks = Object.keys(bands)
        .map(Number)
        .filter(rk => bands[rk].length > 1)
        .sort((a, b) => a - b);

    if (tiedRanks.length === 0) {
        showToast('No hay empates irresolubles para sortear (ITTF 3.7.5.4)', 'info');
        return;
    }

    const sorteo = [];
    tiedRanks.forEach(rk => {
        const members = bands[rk].slice();
        // Fisher-Yates
        for (let i = members.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = members[i];
            members[i] = members[j];
            members[j] = tmp;
        }
        members.forEach(m => sorteo.push({ name: m.name, club: m.club }));
    });

    window.__currentSorteo = sorteo;
    recalculatePoints();

    const sortedNames = sorteo.map(s => s.name).join(' → ');
    showToast('🎲 Sorteo realizado (ITTF 3.7.5.4): ' + sortedNames, 'success');
    addLog('SORTEO', 'Empates irresolubles sorteados por el reglamento ITTF 3.7.5.4: ' + sortedNames);
};

// ==========================================
// DESEMPATES POR ENFRENTAMIENTO DIRECTO
// ==========================================

/**
 * Cuenta los sets ganados por cada jugador en su enfrentamiento directo.
 * @param {Object} playerA - Jugador A
 * @param {Object} playerB - Jugador B
 * @param {Array} matches - Partidos del fixture (estructura de extractMatchesData)
 * @returns {Object} { played, aSets, bSets }
 */
function headToHeadInfo(playerA, playerB, matches) {
    const result = { played: false, aSets: 0, bSets: 0 };
    if (!matches || !playerA || !playerB) return result;

    for (const m of matches) {
        if (!m.player1 || !m.player2) continue;
        if (m.wo) continue; // los sets de un W.O. no son sets jugados (3.7.5)

        const isA = m.player1.name === playerA.name && m.player1.club === playerA.club &&
            m.player2.name === playerB.name && m.player2.club === playerB.club;
        const isB = m.player1.name === playerB.name && m.player1.club === playerB.club &&
            m.player2.name === playerA.name && m.player2.club === playerA.club;

        if (!isA && !isB) continue;

        result.played = true;
        const sA = (m.sets && m.sets.player1) || [];
        const sB = (m.sets && m.sets.player2) || [];

        for (let i = 0; i < Math.max(sA.length, sB.length); i++) {
            const vA = parseInt(sA[i]) || 0;
            const vB = parseInt(sB[i]) || 0;
            if (vA === 0 && vB === 0) continue;

            if (vA > vB) {
                if (isA) result.aSets++; else result.bSets++;
            } else if (vB > vA) {
                if (isA) result.bSets++; else result.aSets++;
            }
        }
        // No cortar en el primer encuentro: en torneos a doble ronda se suman
        // los sets de todos los partidos entre ambos.
    }

    return result;
}

/**
 * Acumula estadísticas de sets y puntos de un jugador dentro de sus partidos.
 * @param {Object} player - Jugador
 * @param {Array} matches - Partidos del fixture
 * @returns {Object} { setsWon, setsLost, pointsFor, pointsAgainst }
 */
function getMatchAggregates(player, matches) {
    const agg = { setsWon: 0, setsLost: 0, pointsFor: 0, pointsAgainst: 0 };
    if (!matches || !player) return agg;

    for (const m of matches) {
        if (!m.player1 || !m.player2) continue;
        if (m.wo) continue; // los sets de un W.O. no son sets jugados (3.7.5)

        const isP1 = m.player1.name === player.name && m.player1.club === player.club;
        const isP2 = m.player2.name === player.name && m.player2.club === player.club;
        if (!isP1 && !isP2) continue;

        const s1 = (m.sets && m.sets.player1) || [];
        const s2 = (m.sets && m.sets.player2) || [];

        for (let i = 0; i < Math.max(s1.length, s2.length); i++) {
            const v1 = parseInt(s1[i]) || 0;
            const v2 = parseInt(s2[i]) || 0;
            if (v1 === 0 && v2 === 0) continue;

            if (isP1) {
                agg.setsWon += v1 > v2 ? 1 : 0;
                agg.setsLost += v2 > v1 ? 1 : 0;
                agg.pointsFor += v1;
                agg.pointsAgainst += v2;
            } else {
                agg.setsWon += v2 > v1 ? 1 : 0;
                agg.setsLost += v1 > v2 ? 1 : 0;
                agg.pointsFor += v2;
                agg.pointsAgainst += v1;
            }
        }
    }

    return agg;
}

/**
 * Compara dos jugadores de un fixture para ordenarlos (siembra, llaves, etc.).
 * Delega en la clasificación ITTF (3.7.5): puntos 2-1-0 y mini-torneo entre
 * los empatados por cociente de sets y de puntos. Los empates irresolubles
 * quedan igualados y se ordenan alfabéticamente de forma estable.
 * @param {Object} fixture - Fixture con players y matches
 * @param {Object} a - Jugador A
 * @param {Object} b - Jugador B
 * @returns {number} Negativo si A va antes que B
 */
function comparePlayersWithTiebreak(fixture, a, b) {
    if (!fixture || !fixture.matches || typeof window.ITTFRULES.groupStandings !== 'function') {
        return (b.points || 0) - (a.points || 0) || (a.name || '').localeCompare(b.name || '');
    }
    const standings = window.ITTFRULES.groupStandings(fixture.players || [], fixture.matches || [], fixture.sorteo || null);
    const ra = standings.find(s => s.name === a.name && s.club === a.club);
    const rb = standings.find(s => s.name === b.name && s.club === b.club);
    if (ra && rb) {
        if (ra.rank !== rb.rank) return ra.rank - rb.rank;
        return (a.name || '').localeCompare(b.name || '');
    }
    return (b.points || 0) - (a.points || 0) || (a.name || '').localeCompare(b.name || '');
}

// ==========================================
// GUARDAR Y CARGAR FIXTURES
// ==========================================

/**
 * Guarda un fixture evitando duplicados: si ya existe un grupo con la
 * misma categoría+grupo, lo reemplaza conservando su id original.
 */
function saveFixtureRecord(fixtureData) {
    const idx = tournamentData.fixtures.findIndex(f =>
        f.categoria === fixtureData.categoria && f.grupo === fixtureData.grupo
    );
    if (idx >= 0) {
        fixtureData.id = tournamentData.fixtures[idx].id;
        tournamentData.fixtures[idx] = fixtureData;
    } else {
        tournamentData.fixtures.push(fixtureData);
    }
}

/**
 * Guarda los datos del fixture
 */
window.saveFixtureData = function() {
    // Operación atómica de historial: fixture + jugadores + ELO + log se
    // deshacen en un solo Ctrl+Z (antes el primer Ctrl+Z solo revertía el log).
    if (typeof window.beginHistoryOp === 'function') window.beginHistoryOp();
    try {
        const categoria = document.getElementById('categoria').value;
        const grupo = document.getElementById('grupo').value;

        const matches = extractMatchesData();

        // Validación reglamento ITTF: bloquear el guardado si hay sets
        // cargados pero inválidos (ej: 1-0, 11-10, empate).
        const formato = window.ITTFRULES.groupFormat();
        const invalidSetList = [];
        const undecidedList = [];
        matches.forEach(m => {
            const bad = window.ITTFRULES.invalidSetIndexes(m.sets.player1, m.sets.player2);
            if (bad.length > 0) {
                invalidSetList.push('Partido ' + m.match + ' (set ' + bad.join(', ') + ')');
            } else if (window.ITTFRULES.matchUndecided(m.sets.player1, m.sets.player2, formato)) {
                undecidedList.push(m.match);
            }
        });

        if (invalidSetList.length > 0) {
            showToast('⚠️ No se puede guardar: ' + invalidSetList.join('; ') + '. Corregí los sets inválidos.', 'error');
            return;
        }
        if (undecidedList.length > 0) {
            showToast('⚠️ Aviso: los partidos ' + undecidedList.join(', ') + ' no tienen ganador definido y se guardarán como pendientes.', 'warning');
        }

        // Validación de conflictos al guardar: ningún jugador puede estar en dos
        // participantes del mismo grupo (ej: individual y en una pareja a la vez)
        const groupConflicts = typeof window.findDuplicatePersonInParticipants === 'function'
            ? window.findDuplicatePersonInParticipants(currentPlayers) : [];
        if (groupConflicts.length > 0) {
            const c = groupConflicts[0];
            const personName = c.person.split('|')[0];
            const names = c.participants.map(p => p.name + ' (' + p.club + ')').join(' y ');
            showToast('⚠️ Conflicto al guardar: ' + personName + ' está en dos participantes del grupo: ' + names + '. Corregí antes de guardar.', 'error');
            return;
        }

        // Preservar la línea base ELO del grupo (rating previo de cada jugador)
        // para que el recálculo al re-guardar no duplique deltas.
        const prevFixture = tournamentData.fixtures.slice().reverse().find(f =>
            f.categoria === categoria && f.grupo === grupo && f.matches
        );
        const eloBaseline = prevFixture && prevFixture.eloBaseline ? prevFixture.eloBaseline : undefined;

        // Aviso sonoro cuando un partido pasa de pendiente a completado en este
        // guardado (una sola vez por transición).
        let completedNow = 0;
        if (prevFixture && Array.isArray(prevFixture.matches)) {
            matches.forEach((m, i) => {
                const prev = prevFixture.matches[i];
                if (!prev) return;
                if (m.completed && !(prev.completed === true)) completedNow++;
            });
        }
        if (completedNow > 0 && typeof window.playMatchEndSound === 'function') {
            window.playMatchEndSound();
        }

        const fixtureData = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            categoria,
            grupo,
            players: currentPlayers,
            matches,
            html: document.getElementById('fixture-output').innerHTML
        };
        // Persistir el sorteo de desempates (3.7.5.4) para que la posición
        // sorteada sobreviva al recargar el fixture y a la siembra de llaves.
        if (window.__currentSorteo && window.__currentSorteo.length > 0) {
            fixtureData.sorteo = window.__currentSorteo;
        }
        if (eloBaseline) fixtureData.eloBaseline = eloBaseline;
        // Preservar el tipo de fixture (todos/suizo) y rondas al re-guardar
        if (prevFixture && prevFixture.formato) fixtureData.formato = prevFixture.formato;
        if (prevFixture && prevFixture.numRounds) fixtureData.numRounds = prevFixture.numRounds;
        // Preservar la programación Multiplex (mesas/horarios) al re-guardar:
        // si el fixture se guardó programado, no debe perder su planificación.
        if (prevFixture && prevFixture.schedule) {
            fixtureData.schedule = prevFixture.schedule;
            fixtureData.scheduleNumMesas = prevFixture.scheduleNumMesas;
            fixtureData.scheduleInicio = prevFixture.scheduleInicio;
            fixtureData.scheduleDuracion = prevFixture.scheduleDuracion;
        }

        saveFixtureRecord(fixtureData);

        // No persistir jugadores fantasma (lugares LIBRES / padding con "-")
        currentPlayers.forEach(p => {
            const ghost = !p || !p.name || p.name === '-' || p.name === '- -' || p.club === '-' || p.club === '- -';
            if (ghost) return;
            if (!tournamentData.players.find(tp => tp.name === p.name && tp.club === p.club)) {
                tournamentData.players.push({
                    name: formatPlayerName(p.name),
                    club: formatPlayerClub(p.club),
                    categories: [categoria],
                    checkin: false,
                    elo: window.DEFAULT_ELO || 1200,
                    history: []
                });
            }
        });

        saveTournamentData();

        // Actualizar el rating ELO según los resultados de este fixture
        if (typeof syncEloForFixture === 'function') syncEloForFixture(fixtureData);

        showToast('Fixture guardado correctamente');
        updateDashboard();
        updateFixtureNavigator();
        saveLastFixtureSelection();
        addLog('GUARDAR FIXTURE', `${categoria} - Grupo ${grupo}`);

        // Auto-avance al siguiente grupo si está activado
        const autoAdvance = document.getElementById('auto-advance');
        if (autoAdvance && autoAdvance.checked) {
            setTimeout(() => {
                const nextGroupBtn = document.getElementById('btn-next-group');
                if (nextGroupBtn && !nextGroupBtn.disabled) {
                    goToNextGroup();
                } else {
                    showToast('No hay más grupos guardados en esta categoría');
                }
            }, 300);
        }
    } catch (error) {
        console.error('Error al guardar fixture:', error);
        showToast('Error al guardar fixture', 'error');
    } finally {
        if (typeof window.commitHistoryOp === 'function') window.commitHistoryOp();
    }
};

/**
 * Extrae los datos de los partidos.
 * Un partido se considera completado solo cuando tiene un ganador válido
 * según el reglamento ITTF y el formato configurado (BO3/BO5). Los partidos
 * W.O. se guardan con su flag y se consideran completados.
 */
function extractMatchesData() {
    const matches = [];
    const matchTables = document.querySelectorAll('.match-table');
    const formato = window.ITTFRULES.groupFormat();

    matchTables.forEach((table, idx) => {
        const [p1Row, p2Row] = matchPlayerRows(table);
        if (!p1Row || !p2Row) return;

        const p1Sets = Array.from(p1Row.querySelectorAll('.set-col[contenteditable]')).map(c => c.textContent.trim());
        const p2Sets = Array.from(p2Row.querySelectorAll('.set-col[contenteditable]')).map(c => c.textContent.trim());

        const p1Index = parseInt(p1Row.getAttribute('data-player-index'));
        const p2Index = parseInt(p2Row.getAttribute('data-player-index'));

        const refInput = table.querySelector('.ref-input');
        const incInput = table.querySelector('.inc-input');

        if (!isNaN(p1Index) && !isNaN(p2Index)) {
            const getAttr = (el, name) => (el && typeof el.getAttribute === 'function') ? el.getAttribute(name) : null;
            const wo = getAttr(table, 'data-wo') === 'true';
            const woWinnerIdx = wo ? parseInt(getAttr(table, 'data-wo-winner')) : -1;
            const winnerSide = wo
                ? (woWinnerIdx === p1Index ? 1 : -1)
                : window.ITTFRULES.matchWinnerBySets(p1Sets, p2Sets, formato);

            matches.push({
                match: idx + 1,
                player1: currentPlayers[p1Index],
                player2: currentPlayers[p2Index],
                sets: { player1: p1Sets, player2: p2Sets },
                referee: refInput ? refInput.value.trim() : '',
                incidencias: incInput ? incInput.value.trim() : '',
                formato,
                wo: wo || undefined,
                woWinnerSide: wo ? (woWinnerIdx === p1Index ? 1 : 2) : undefined,
                winnerSide,
                completed: wo ? true : window.ITTFRULES.matchCompleted(p1Sets, p2Sets, formato)
            });
        }
    });

    return matches;
}

/**
 * Vuelca los sets guardados de un fixture sobre las tablas de partido visibles.
 * @param {Object} fixture - Fixture guardado
 */
window.applyMatchesToFixtureHTML = function(fixture) {
    const output = document.getElementById('fixture-output');
    if (!output) return;
    if (typeof output.querySelectorAll !== 'function') return;

    const tables = output.querySelectorAll('.match-table');
    (fixture.matches || []).forEach((m, idx) => {
        const table = tables[idx];
        if (!table) return;
        const [p1Row, p2Row] = matchPlayerRows(table);
        if (!p1Row || !p2Row) return;

        const p1Sets = p1Row.querySelectorAll('.set-col[contenteditable]');
        const p2Sets = p2Row.querySelectorAll('.set-col[contenteditable]');

        (m.sets.player1 || []).forEach((v, i) => {
            if (p1Sets[i]) p1Sets[i].textContent = v || '';
        });
        (m.sets.player2 || []).forEach((v, i) => {
            if (p2Sets[i]) p2Sets[i].textContent = v || '';
        });

        const refInput = table.querySelector('.ref-input');
        if (refInput && m.referee) refInput.value = m.referee;

        const incInput = table.querySelector('.inc-input');
        if (incInput && m.incidencias) incInput.value = m.incidencias;
    });
};

/**
 * Ver un fixture guardado
 */
window.viewFixture = function(id) {
    const fixture = tournamentData.fixtures.find(f => f.id === id);
    if (fixture) {
        // Cargar el HTML del fixture. Fixtures guardados por versiones viejas
        // pueden no tener .html: nunca asignar "undefined" a innerHTML.
        document.getElementById('fixture-output').innerHTML = fixture.html || '';

        // Usar el roster guardado del fixture: evita que extractMatchesData
        // y saveFixtureData operen sobre una lista obsoleta de jugadores.
        currentPlayers = (fixture.players || []).map(p => ({ ...p }));

        // Restaurar el sorteo de desempates (3.7.5.4) guardado con el fixture
        window.__currentSorteo = fixture.sorteo || null;

        // Actualizar los campos de configuración
        document.getElementById('categoria').value = fixture.categoria;
        document.getElementById('grupo').value = fixture.grupo;
        document.getElementById('numJugadores').value = fixture.players.length;

        // Actualizar campos de jugadores
        updatePlayerFields();

        // Cargar nombres y clubs de los jugadores
        setTimeout(() => {
            const playerInputs = document.querySelectorAll('.player-name');
            const clubInputs = document.querySelectorAll('.club-input');

            fixture.players.forEach((player, idx) => {
                if (playerInputs[idx]) playerInputs[idx].value = player.name;
                if (clubInputs[idx]) clubInputs[idx].value = player.club;
            });

            // Refrescar los sets guardados y las posiciones en pantalla
            applyMatchesToFixtureHTML(fixture);
            if (typeof recalculatePoints === 'function') recalculatePoints();
        }, 100);

        // Cambiar a la pestaña Fixture
        showTab('fixture');
        updateFixtureNavigator();
        saveLastFixtureSelection();

        // Aplicar programación de mesas si el fixture la tiene
        if (fixture.schedule && typeof applyScheduleToFixtureHTML === 'function') {
            setTimeout(() => applyScheduleToFixtureHTML(fixture), 150);
        }

        showToast('Fixture cargado - Configuración actualizada');
        addLog('CARGAR FIXTURE', `${fixture.categoria} - Grupo ${fixture.grupo} cargado desde Dashboard`);
    }
};

/**
 * Elimina un fixture
 */
window.deleteFixture = function(id) {
    showModal(
        '¿Eliminar Fixture?',
        '<p style="color: var(--text-color);">¿Estás seguro de que deseas eliminar este fixture? Esta acción no se puede deshacer.</p>',
        () => {
            const victim = tournamentData.fixtures.find(f => f.id === id);
            // Revertir los deltas ELO que este fixture aplicó (los partidos
            // guardan el delta en m.eloDeltaA/m.eloDeltaB).
            if (victim && victim.matches && typeof window.revertEloForFixture === 'function') {
                window.revertEloForFixture(victim);
            }
            tournamentData.fixtures = tournamentData.fixtures.filter(f => f.id !== id);
            saveTournamentData();
            updateDashboard();
            updateFixtureNavigator();
            showToast('Fixture eliminado');
            addLog('ELIMINAR FIXTURE', `Fixture ID: ${id}`);
        }
    );
};

// ==========================================
// NAVEGACIÓN DE GRUPOS
// ==========================================

/**
 * Guarda la última selección de categoría/grupo del fixture
 */
function saveLastFixtureSelection() {
    try {
        const cat = document.getElementById('categoria');
        const grupo = document.getElementById('grupo');
        if (cat) localStorage.setItem('ttmLastCategoria', cat.value);
        if (grupo) localStorage.setItem('ttmLastGrupo', grupo.value);
    } catch (e) { /* localStorage no disponible */ }
}

/**
 * Restaura la última selección de categoría/grupo del fixture
 */
window.restoreLastFixtureSelection = function() {
    try {
        const cat = document.getElementById('categoria');
        const grupo = document.getElementById('grupo');
        const lastCat = localStorage.getItem('ttmLastCategoria');
        const lastGrupo = localStorage.getItem('ttmLastGrupo');

        if (cat && lastCat && Array.from(cat.options).some(o => o.value === lastCat)) {
            cat.value = lastCat;
        }
        if (grupo && lastGrupo && Array.from(grupo.options).some(o => o.value === lastGrupo)) {
            grupo.value = lastGrupo;
        }
    } catch (e) { /* localStorage no disponible */ }
};

/**
 * Actualiza la barra de navegación de grupos de la pestaña Fixture
 */
window.updateFixtureNavigator = function() {
    try {
        const catSel = document.getElementById('categoria');
        const grupoSel = document.getElementById('grupo');
        const btnPrev = document.getElementById('btn-prev-group');
        const btnNext = document.getElementById('btn-next-group');
        const status = document.getElementById('fixture-nav-status');

        if (!catSel || !grupoSel || !btnPrev || !btnNext || !status) return;

        const cat = catSel.value;
        const grupo = grupoSel.value;

        const groups = tournamentData.fixtures
            .filter(f => f.categoria === cat && f.grupo)
            .sort((a, b) => a.grupo.localeCompare(b.grupo));

        const uniqueLetters = [...new Set(groups.map(g => g.grupo))];
        const idx = uniqueLetters.indexOf(grupo);

        btnPrev.disabled = idx <= 0;
        btnNext.disabled = idx === -1 || idx >= uniqueLetters.length - 1;

        if (uniqueLetters.length === 0) {
            status.textContent = `${cat}: sin fixtures guardados`;
        } else {
            const pos = idx === -1 ? '—' : `${idx + 1}/${uniqueLetters.length}`;
            status.textContent = `${cat} · ${uniqueLetters.length} grupo(s) · actual: ${grupo} (${pos})`;
        }
    } catch (e) {
        console.error('Error al actualizar navegador de grupos:', e);
    }
};

/**
 * Navega entre los grupos guardados de la categoría actual
 * @param {number} dir - -1 para anterior, 1 para siguiente
 */
window.navFixtureGroup = function(dir) {
    const catSel = document.getElementById('categoria');
    const grupoSel = document.getElementById('grupo');
    if (!catSel || !grupoSel) return;

    const cat = catSel.value;
    const grupo = grupoSel.value;

    const groups = tournamentData.fixtures
        .filter(f => f.categoria === cat && f.grupo)
        .sort((a, b) => a.grupo.localeCompare(b.grupo));

    const uniqueLetters = [...new Set(groups.map(g => g.grupo))];
    if (uniqueLetters.length === 0) return;

    let idx = uniqueLetters.indexOf(grupo);
    if (idx === -1) idx = dir > 0 ? -1 : uniqueLetters.length;

    const targetLetter = uniqueLetters[idx + dir];
    if (!targetLetter) {
        showToast(dir > 0 ? 'Ya estás en el último grupo' : 'Ya estás en el primer grupo', 'warning');
        return;
    }

    const target = groups.find(f => f.grupo === targetLetter);
    if (target) {
        viewFixture(target.id);
    } else {
        grupoSel.value = targetLetter;
        updateFixtureNavigator();
    }
};

/**
 * Avanza al siguiente grupo de la categoría actual (auto-avance al guardar)
 */
window.goToNextGroup = function() {
    navFixtureGroup(1);
};

/**
 * Acción rápida del Dashboard: lleva a la siguiente etapa del flujo del torneo
 */
window.goToNextStep = function() {
    const fixtures = tournamentData.fixtures;

    if (fixtures.length === 0) {
        showTab('fixture');
        showToast('Crea el primer fixture para comenzar');
        return;
    }

    let totalMatches = 0;
    let completedMatches = 0;
    fixtures.forEach(f => {
        if (f.matches) {
            totalMatches += f.matches.length;
            completedMatches += f.matches.filter(m => m.completed).length;
        }
    });

    const pending = totalMatches - completedMatches;

    if (pending > 0) {
        showTab('fixture');
        showToast(`${pending} partido(s) pendiente(s). Continuá cargando resultados.`);
    } else if (typeof checkBracketsAvailability === 'function') {
        showTab('brackets');
        checkBracketsAvailability();
    } else {
        showTab('brackets');
    }
};

// ==========================================
// GESTIÓN DE JUGADORES EN FIXTURE
// ==========================================

/**
 * Registra una única vez el cierre de sugerencias al hacer clic fuera.
 */
if (!window.__autocompleteCloseBound) {
    window.__autocompleteCloseBound = true;
    document.addEventListener('click', function(e) {
        if (!e.target.classList.contains('player-name') && !e.target.classList.contains('club-input')) {
            document.querySelectorAll('.autocomplete-suggestions').forEach(s => s.style.display = 'none');
        }
    });
}

/**
 * Actualiza dinámicamente los campos de jugadores
 */
window.updatePlayerFields = function() {
    const num = parseInt(document.getElementById('numJugadores').value);
    const container = document.getElementById('players-list');
    container.innerHTML = '';

    for (let i = 1; i <= num; i++) {
        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '1fr 1fr';
        row.style.gap = '10px';
        row.style.marginBottom = '10px';

        row.innerHTML = `
            <div class="autocomplete-container">
                <input type="text"
                       placeholder="Jugador ${i}"
                       class="player-name"
                       data-index="${i}"
                       oninput="showPlayerSuggestions(this)"
                       onfocus="showPlayerSuggestions(this)"
                       style="padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color); width: 100%;">
                <div class="autocomplete-suggestions" id="suggestions-name-${i}" style="display: none;"></div>
            </div>
            <div class="autocomplete-container">
                <input type="text"
                       placeholder="Club ${i}"
                       class="club-input"
                       data-index="${i}"
                       oninput="showClubSuggestions(this)"
                       onfocus="showClubSuggestions(this)"
                       style="padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color); width: 100%;">
                <div class="autocomplete-suggestions" id="suggestions-club-${i}" style="display: none;"></div>
            </div>
        `;
        container.appendChild(row);
    }
};

/**
 * Limpia los campos de jugadores
 */
window.clearPlayerFields = function() {
    const playerInputs = document.querySelectorAll('.player-name');
    const clubInputs = document.querySelectorAll('.club-input');

    playerInputs.forEach(input => input.value = '');
    clubInputs.forEach(input => input.value = '');

    showToast('Campos limpiados correctamente');
    addLog('LIMPIAR CAMPOS', 'Campos de jugadores limpiados');
};

/**
 * Marca el último jugador como LIBRE
 */
window.setLastPlayerAsFree = function() {
    const num = parseInt(document.getElementById('numJugadores').value);
    const playerInputs = document.querySelectorAll('.player-name');
    const clubInputs = document.querySelectorAll('.club-input');
    if (num > 0) {
        playerInputs[num - 1].value = "-";
        clubInputs[num - 1].value = "-";
        showToast('Último jugador marcado como LIBRE');
    }
};

/**
 * Carga datos de prueba
 */
window.loadFakeData = function() {
    const players = [
        { name: "AQUINO AGUSTIN", club: "CEDEMU" },
        { name: "WURIAN ANTONIO", club: "OBERÁ" },
        { name: "DELACOURT FELIPE", club: "C PY" },
        { name: "GOMEZ LUCAS", club: "SAN MARTÍN" },
        { name: "RODRIGUEZ MARÍA", club: "LA RIOJA" },
        { name: "FERNÁNDEZ JUAN", club: "POSADAS" },
        { name: "LÓPEZ CARLA", club: "CORRIENTES" },
        { name: "MARTÍNEZ DIEGO", club: "RESISTENCIA" }
    ];

    const num = parseInt(document.getElementById('numJugadores').value);
    const playerInputs = document.querySelectorAll('.player-name');
    const clubInputs = document.querySelectorAll('.club-input');

    for (let i = 0; i < num && i < players.length; i++) {
        playerInputs[i].value = players[i].name;
        clubInputs[i].value = players[i].club;
    }
    showToast('Datos de prueba cargados');
    addLog('DATOS PRUEBA', `${Math.min(num, players.length)} jugadores cargados`);
};

/**
 * Muestra sugerencias de jugadores (autocompletado)
 */
window.showPlayerSuggestions = function(input) {
    const value = input.value.toLowerCase();
    const index = input.getAttribute('data-index');
    const suggestionsDiv = document.getElementById(`suggestions-name-${index}`);

    if (!value) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    const matches = tournamentData.players.filter(p =>
        p.name.toLowerCase().includes(value)
    );

    if (matches.length === 0) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    let html = '';
    matches.forEach(player => {
        html += `
            <div class="autocomplete-suggestion" onclick="selectPlayer(${index}, '${escAttr(player.name)}', '${escAttr(player.club)}')">
                <div class="suggestion-name">${escHtml(player.name)}</div>
                <div class="suggestion-club">${escHtml(player.club)} - ${player.categories.map(escHtml).join(', ')}</div>
            </div>
        `;
    });

    suggestionsDiv.innerHTML = html;
    suggestionsDiv.style.display = 'block';
};

/**
 * Muestra sugerencias de clubs (autocompletado)
 */
window.showClubSuggestions = function(input) {
    const value = input.value.toLowerCase();
    const index = input.getAttribute('data-index');
    const suggestionsDiv = document.getElementById(`suggestions-club-${index}`);

    if (!value) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    const clubs = [...new Set(tournamentData.players.map(p => p.club))];
    const matches = clubs.filter(club => club.toLowerCase().includes(value));

    if (matches.length === 0) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    let html = '';
    matches.forEach(club => {
        html += `
            <div class="autocomplete-suggestion" onclick="selectClub(${index}, '${escAttr(club)}')">
                <div class="suggestion-name">${club}</div>
            </div>
        `;
    });

    suggestionsDiv.innerHTML = html;
    suggestionsDiv.style.display = 'block';
};

/**
 * Selecciona un jugador del autocompletado
 */
window.selectPlayer = function(index, name, club) {
    const playerInputs = document.querySelectorAll('.player-name');
    const clubInputs = document.querySelectorAll('.club-input');

    playerInputs[index - 1].value = name;
    clubInputs[index - 1].value = club;

    document.getElementById(`suggestions-name-${index}`).style.display = 'none';
};

/**
 * Selecciona un club del autocompletado
 */
window.selectClub = function(index, club) {
    const clubInputs = document.querySelectorAll('.club-input');
    clubInputs[index - 1].value = club;
    document.getElementById(`suggestions-club-${index}`).style.display = 'none';
};

// ==========================================
// CATEGORÍAS Y GRUPOS
// ==========================================

/**
 * Carga las categorías personalizadas
 */
window.loadCustomCategories = function() {
    try {
        if (typeof window.syncCategorySelects === 'function') {
            window.syncCategorySelects();
            return;
        }
        // Fallback: agregar a select de fixture
        const savedCategories = JSON.parse(localStorage.getItem('customCategories') || '[]');
        const fixtureSelect = document.getElementById('categoria');
        if (fixtureSelect) {
            savedCategories.forEach(cat => {
                if (!Array.from(fixtureSelect.options).some(opt => opt.value === cat)) {
                    const option = document.createElement('option');
                    option.value = cat;
                    option.textContent = cat;
                    fixtureSelect.appendChild(option);
                }
            });
        }

        // Agregar a select de jugadores
        const playerSelect = document.getElementById('new-player-categories');
        if (playerSelect) {
            savedCategories.forEach(cat => {
                if (!Array.from(playerSelect.options).some(opt => opt.value === cat)) {
                    const option = document.createElement('option');
                    option.value = cat;
                    option.textContent = cat;
                    playerSelect.appendChild(option);
                }
            });
        }
    } catch (error) {
        console.error('Error al cargar categorías:', error);
    }
};

/**
 * Agrega una nueva categoría (delega al administrador de categorías de Configuración).
 */
window.addNewCategory = function() {
    if (typeof window.addCategory === 'function') {
        window.addCategory();
        return;
    }
    showModal(
        '➕ Agregar Nueva Categoría',
        '<input type="text" id="modal-new-category" placeholder="Ej: SUB 25" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">',
        () => {
            try {
                const newCat = document.getElementById('modal-new-category').value.trim().toUpperCase();
                if (!newCat) {
                    showToast('Por favor ingresa un nombre de categoría', 'error');
                    return;
                }

                // Agregar a select de categorías del fixture
                const select = document.getElementById('categoria');
                const exists = Array.from(select.options).some(opt => opt.value === newCat);

                if (exists) {
                    showToast('Esta categoría ya existe', 'warning');
                    return;
                }

                const option = document.createElement('option');
                option.value = newCat;
                option.textContent = newCat;
                option.selected = true;
                select.appendChild(option);

                // Agregar también al select de categorías de jugadores
                const playerCategoriesSelect = document.getElementById('new-player-categories');
                if (playerCategoriesSelect) {
                    const playerOption = document.createElement('option');
                    playerOption.value = newCat;
                    playerOption.textContent = newCat;
                    playerCategoriesSelect.appendChild(playerOption);
                }

                // Guardar en localStorage para persistencia
                const savedCategories = JSON.parse(localStorage.getItem('customCategories') || '[]');
                if (!savedCategories.includes(newCat)) {
                    savedCategories.push(newCat);
                    localStorage.setItem('customCategories', JSON.stringify(savedCategories));
                }

                showToast(`Categoría "${newCat}" agregada correctamente`);
                addLog('AGREGAR CATEGORÍA', `Nueva categoría: ${newCat}`);
                if (typeof renderCategoriesManager === 'function') renderCategoriesManager();
            } catch (error) {
                console.error('Error al agregar categoría:', error);
                showToast('Error al agregar categoría', 'error');
            }
        }
    );
};

/**
 * Agrega un nuevo grupo
 */
window.addNewGroup = function() {
    showModal(
        '➕ Agregar Nuevo Grupo',
        '<input type="text" id="modal-new-group" placeholder="Ej: I" maxlength="2" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">',
        () => {
            const newGroup = document.getElementById('modal-new-group').value.trim().toUpperCase();
            if (!newGroup) {
                showToast('Por favor ingresa un nombre de grupo', 'error');
                return;
            }

            const select = document.getElementById('grupo');
            const exists = Array.from(select.options).some(opt => opt.value === newGroup);

            if (exists) {
                showToast('Este grupo ya existe', 'warning');
                return;
            }

            const option = document.createElement('option');
            option.value = newGroup;
            option.textContent = newGroup;
            option.selected = true;
            select.appendChild(option);

            showToast(`Grupo "${newGroup}" agregado correctamente`);
            addLog('AGREGAR GRUPO', `Nuevo grupo: ${newGroup}`);
        }
    );
};

// ==========================================
// GENERACIÓN AUTOMÁTICA DE GRUPOS
// ==========================================

/**
 * Genera grupos automáticamente
 */
window.autoGenerateGroups = function() {
    const categoria = document.getElementById('categoria').value;

    const playersInCategory = tournamentData.players.filter(p =>
        p.categories && p.categories.includes(categoria) &&
        p.name !== '-' && p.club !== '-' && p.name !== '- -' && p.club !== '- -'
    );

    if (playersInCategory.length === 0) {
        showToast(`No hay jugadores registrados en la categoría ${categoria}`, 'error');
        return;
    }

    // Guardar contexto para los flujos de check-in posteriores
    window._autoGenPlayers = playersInCategory;
    window._autoGenCategory = categoria;

    // Detectar ausentes (sin check-in) antes de armar el fixture
    const absent = playersInCategory.filter(p => !p.checkin);
    if (absent.length > 0) {
        showModal(
            '⚠️ Check-in de Jugadores',
            `<div style="color: var(--text-color);">
                <p>Se detectaron <strong>${absent.length}</strong> jugadores que <strong>no hicieron check-in</strong> en la categoría <strong>${categoria}</strong>:</p>
                <div class="warn-box" style="margin: 15px 0; max-height: 200px; overflow-y: auto;">
                    ${absent.map(p => `• ${escHtml(p.name)} (${escHtml(p.club)})`).join('<br>')}
                </div>
                <p>Los ausentes no se incluirán en los grupos a menos que los marques presentes.</p>
            </div>
            <div class="button-grid" style="margin-top: 20px;">
                <button class="btn btn-success" onclick="closeModal(); proceedAutoGenerate(true);">✅ Excluir ausentes (${playersInCategory.length - absent.length} presentes)</button>
                <button class="btn btn-info" onclick="closeModal(); checkinAllFromModal();">🙋 Check-in de todos y continuar</button>
                <button class="btn btn-warning" onclick="closeModal(); proceedAutoGenerate(false);">📦 Incluir a todos igual</button>
                <button class="btn btn-dark" onclick="closeModal();">❌ Cancelar</button>
            </div>`,
            null
        );
        return;
    }

    showAutoGenerateModal(playersInCategory, categoria);
};

/**
 * Continúa con la generación automática según la decisión de check-in.
 * @param {boolean} excludeAbsent - true para excluir a los jugadores sin check-in
 */
window.proceedAutoGenerate = function(excludeAbsent) {
    const players = excludeAbsent
        ? window._autoGenPlayers.filter(p => p.checkin)
        : window._autoGenPlayers;
    showAutoGenerateModal(players, window._autoGenCategory);
};

/**
 * Marca a todos presentes desde el flujo de check-in y continúa con la generación.
 */
window.checkinAllFromModal = function() {
    (tournamentData.players || []).forEach(p => { p.checkin = true; });
    saveTournamentData();
    showToast('Check-in completado para todos los jugadores');
    addLog('CHECK-IN', 'Check-in masivo desde generación de fixture');
    showAutoGenerateModal(window._autoGenPlayers, window._autoGenCategory);
};

/**
 * Muestra el modal de configuración de la generación automática de grupos.
 * @param {Array} playersInCategory - Jugadores a distribuir
 * @param {string} categoria - Categoría seleccionada
 */
function showAutoGenerateModal(playersInCategory, categoria) {
    showModal(
        '🤖 Generación Automática de Grupos',
        `<div style="color: var(--text-color);">
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 64px;">🤖</div>
            </div>

            <p><strong>Se encontraron ${playersInCategory.length} jugadores en la categoría ${categoria}</strong></p>

            <div style="margin: 20px 0;">
                <label style="font-weight: bold; display: block; margin-bottom: 10px;">Jugadores por grupo:</label>
                <select id="auto-group-size" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
                    <option value="4">4 jugadores por grupo</option>
                    <option value="6">6 jugadores por grupo</option>
                    <option value="8">8 jugadores por grupo</option>
                </select>
            </div>

            <div style="margin: 20px 0;">
                <label style="font-weight: bold; display: block; margin-bottom: 10px;">Método de distribución (siembra):</label>
                <select id="auto-seed-method" onchange="toggleSeedMethod(this)" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
                    <option value="random">🎲 Aleatoria (sin siembra)</option>
                    <option value="points">📊 Balanceo por puntos del torneo</option>
                    <option value="rank">🏅 Siembra por ranking previo (seed)</option>
                    <option value="manual">✏️ Ranking manual (por jugador)</option>
                </select>
            </div>

            <div style="margin: 20px 0;">
                <label style="font-weight: bold; display: block; margin-bottom: 10px;">Formato de competencia:</label>
                <select id="auto-format" onchange="toggleAutoFormat(this)" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
                    <option value="todos">🔄 Todos contra todos</option>
                    <option value="suizo">🎯 Sistema Suizo (menos partidos)</option>
                </select>
            </div>

            <div id="auto-rounds-container" style="display: none; margin: 15px 0; padding: 12px; background: var(--table-bg); border: 1px solid var(--border-color); border-radius: 6px;">
                <label style="font-weight: bold; display: block; margin-bottom: 8px;">Número de rondas suizas:</label>
                <input type="number" id="auto-rounds" min="3" max="15" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--header-bg); color: var(--text-color);">
                <p style="font-size: 12px; color: var(--text-muted); margin: 8px 0 0 0;">Sugerido para ${playersInCategory.length} jugadores: ${Math.max(3, Math.min(Math.ceil(Math.log2(playersInCategory.length)), playersInCategory.length - 1))} rondas (${Math.ceil(Math.log2(playersInCategory.length)) >= 3 ? '' : ''})</p>
            </div>

            <div id="manual-ranking-container" style="display: none; max-height: 260px; overflow-y: auto; margin: 15px 0; padding: 12px; background: var(--table-bg); border: 1px solid var(--border-color); border-radius: 6px;">
                <p style="font-size: 13px; margin-bottom: 10px;"><strong>✏️ Ingresa la siembra para cada participante (1 = mejor jugador):</strong></p>
                ${playersInCategory.map((p, idx) => `
                    <div style="display: grid; grid-template-columns: 40px 1fr 90px; gap: 10px; align-items: center; margin-bottom: 6px;">
                        <span style="font-size: 12px; color: var(--text-muted);">#${idx + 1}</span>
                        <span style="font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escHtml(p.name)}</span>
                        <input type="number" id="manual-seed-${idx}" value="${idx + 1}" min="1" max="${playersInCategory.length}" style="width: 90px; padding: 6px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
                    </div>
                `).join('')}
            </div>

            <div class="info-box" style="margin: 15px 0;">
                <strong>ℹ️ Información:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li><strong>Aleatoria:</strong> los jugadores se reparten al azar</li>
                    <li><strong>Balanceo por puntos:</strong> los que más puntos sumaron en el torneo se reparten en distintos grupos (distribución en serpentina)</li>
                    <li><strong>Ranking previo:</strong> usa el campo "Ranking (seed)" cargado en cada jugador para armar grupos balanceados</li>
                    <li><strong>Ranking manual:</strong> asignás la siembra de cada jugador y se reparten balanceados</li>
                    <li><strong>Sistema Suizo:</strong> ideal para categorías numerosas. Cada jugador juega 1 partido por ronda contra rivales de similar desempeño y sin repetir rivales: muchas menos partidas que el todos contra todos.</li>
                    <li>Los grupos se nombrarán: A, B, C, D...</li>
                    <li>Si sobran jugadores, se distribuirán equitativamente</li>
                </ul>
            </div>

            <p style="font-weight: bold; margin-top: 20px;">¿Deseas continuar?</p>
        </div>`,
        () => {
            const seedMethod = document.getElementById('auto-seed-method').value;
            executeAutoGenerateGroups(playersInCategory, categoria, seedMethod);
        }
    );
}

/**
 * Muestra u oculta los inputs de ranking manual según el método elegido
 * @param {HTMLSelectElement} select - Select del método de siembra
 */
window.toggleSeedMethod = function(select) {
    const container = document.getElementById('manual-ranking-container');
    if (container) {
        container.style.display = select.value === 'manual' ? 'block' : 'none';
    }
};

/**
 * Muestra/oculta el campo de rondas según el formato elegido (suizo).
 */
window.toggleAutoFormat = function(select) {
    const container = document.getElementById('auto-rounds-container');
    const roundsInput = document.getElementById('auto-rounds');
    if (!container || !roundsInput) return;
    if (select.value === 'suizo') {
        container.style.display = 'block';
        const total = tournamentData.players.filter(p =>
            p.categories && p.categories.includes(document.getElementById('categoria').value) &&
            p.name !== '-' && p.club !== '-'
        ).length;
        if (!roundsInput.value) {
            roundsInput.value = defaultSwissRounds(Math.max(total, 4));
        }
    } else {
        container.style.display = 'none';
    }
};

/**
 * Cantidad de rondas sugeridas para un sistema suizo.
 */
function defaultSwissRounds(numPlayers) {
    if (!numPlayers || numPlayers < 2) return 3;
    return Math.max(3, Math.min(Math.ceil(Math.log2(numPlayers)), numPlayers - 1));
}

/**
 * Ejecuta la generación automática de grupos
 * @param {Array} players - Jugadores de la categoría
 * @param {string} categoria - Categoría seleccionada
 * @param {string} seedMethod - Método de siembra: 'random', 'points' o 'manual'
 */
function executeAutoGenerateGroups(players, categoria, seedMethod) {
    const groupSize = parseInt(document.getElementById('auto-group-size').value);
    const formato = (document.getElementById('auto-format') || { value: 'todos' }).value;
    let numRounds = parseInt((document.getElementById('auto-rounds') || { value: '' }).value) || 0;
    if (formato === 'suizo' && !numRounds) {
        numRounds = defaultSwissRounds(groupSize);
    }

    let ordered = [...players];

    // Validación de conflictos a nivel categoría: una persona no puede estar en
    // dos participantes (individual + pareja, o dos parejas) de la misma categoría.
    const catConflicts = typeof window.findDuplicatePersonInParticipants === 'function'
        ? window.findDuplicatePersonInParticipants(players) : [];
    if (catConflicts.length > 0) {
        const c = catConflicts[0];
        const personName = c.person.split('|')[0];
        const names = c.participants.map(p => p.name + ' (' + p.club + ')').join(' y ');
        showToast('⚠️ Conflicto de inscripción: ' + personName + ' está en dos participantes de la categoría ' + categoria + ': ' + names + '. Editala antes de generar los grupos.', 'error');
        return;
    }

    if (seedMethod === 'points') {
        // Sumar los puntos acumulados del torneo actual por jugador
        const pointsMap = {};
        tournamentData.fixtures.forEach(fixture => {
            (fixture.players || []).forEach(p => {
                if (p.name === '-' || p.club === '-') return;
                const key = p.name + '|' + p.club;
                pointsMap[key] = (pointsMap[key] || 0) + (p.points || 0);
            });
        });

        ordered.sort((a, b) => {
            const pa = pointsMap[a.name + '|' + a.club] || 0;
            const pb = pointsMap[b.name + '|' + b.club] || 0;
            if (pb !== pa) return pb - pa;
            return (a.name || '').localeCompare(b.name || '');
        });
    } else if (seedMethod === 'rank') {
        // Ordenar por ranking previo cargado en el jugador (menor = mejor)
        ordered.sort((a, b) => {
            const ra = a.ranking && !isNaN(a.ranking) ? a.ranking : 999999;
            const rb = b.ranking && !isNaN(b.ranking) ? b.ranking : 999999;
            if (ra !== rb) return ra - rb;
            return (a.name || '').localeCompare(b.name || '');
        });
    } else if (seedMethod === 'manual') {
        // Leer la siembra ingresada (1 = mejor jugador)
        const seedValues = players.map((p, idx) => {
            const input = document.getElementById(`manual-seed-${idx}`);
            const value = input ? parseInt(input.value) : idx + 1;
            return { player: p, seed: isNaN(value) ? idx + 1 : value };
        });

        const seeds = seedValues.map(s => s.seed);
        if (new Set(seeds).size !== seeds.length) {
            showToast('La siembra manual tiene números repetidos. Revisa e intenta de nuevo.', 'error');
            return;
        }

        ordered = seedValues.sort((a, b) => a.seed - b.seed).map(s => s.player);
    }

    let distribution;
    if (seedMethod === 'random') {
        distribution = [...ordered].sort(() => Math.random() - 0.5);
    } else {
        distribution = ordered;
    }

    const numGroups = Math.ceil(distribution.length / groupSize);

    const groups = [];
    for (let i = 0; i < numGroups; i++) {
        groups.push({
            letter: String.fromCharCode(65 + i),
            players: []
        });
    }

    distribution.forEach((player, idx) => {
        let groupIdx;
        if (seedMethod === 'random') {
            groupIdx = idx % numGroups;
        } else {
            // Distribución en serpentina: los mejores seeds van a grupos distintos
            const round = Math.floor(idx / numGroups);
            const pos = idx % numGroups;
            groupIdx = round % 2 === 0 ? pos : (numGroups - 1 - pos);
        }
        groups[groupIdx].players.push(player);
    });

    groups.forEach(group => {
        while (group.players.length < groupSize) {
            group.players.push({ name: '-', club: '-' });
        }
    });

    let successCount = 0;
    groups.forEach((group, idx) => {
        setTimeout(() => {
            generateAutoFixture(categoria, group.letter, group.players, formato, numRounds);
            successCount++;

            if (successCount === groups.length) {
                showModal(
                    '✅ Grupos Generados',
                    `<div style="text-align: center; color: var(--text-color);">
                        <div style="font-size: 64px; margin: 20px 0;">✅</div>
                        <h2 style="color: var(--btn-success);">¡Grupos Generados Exitosamente!</h2>
                        <p style="margin: 20px 0;">Se crearon ${groups.length} grupos para la categoría ${categoria}</p>

                        <div class="success-box" style="margin: 20px 0; text-align: left;">
                            <strong>📊 Resumen:</strong><br>
                            Total de jugadores: ${distribution.length}<br>
                            Grupos generados: ${groups.length}<br>
                            Jugadores por grupo: ${groupSize}<br>
                            Formato: ${formato === 'suizo' ? '🎯 Sistema Suizo (' + numRounds + ' rondas)' : '🔄 Todos contra todos'}<br>
                            Siembra: ${seedMethod === 'points' ? 'Balanceo por puntos del torneo' : seedMethod === 'rank' ? 'Ranking previo (seed)' : seedMethod === 'manual' ? 'Ranking manual' : 'Aleatoria'}
                        </div>

                        <p>Puedes ver los fixtures en el Dashboard.</p>
                    </div>`,
                    () => {
                        showTab('dashboard');
                        updateDashboard();
                    }
                );
            }
        }, idx * 500);
    });

    const methodName = { random: 'aleatoria', points: 'por puntos del torneo', rank: 'por ranking previo (seed)', manual: 'por ranking manual' }[seedMethod] || 'aleatoria';
    addLog('GENERACIÓN AUTOMÁTICA', `${groups.length} grupos generados para ${categoria} - ${distribution.length} jugadores (siembra ${methodName})`);
}

/**
 * Genera un fixture automático.
 * @param {string} categoria - Categoría
 * @param {string} grupo - Letra del grupo
 * @param {Array} players - Jugadores
 * @param {string} [formato] - 'todos' (round robin) o 'suizo'
 * @param {number} [numRounds] - Rondas suizas (solo formato suizo)
 */
function generateAutoFixture(categoria, grupo, players, formato, numRounds) {
    const torneoNombre = document.getElementById('torneoNombre').value;
    const subtitulo = document.getElementById('subtitulo').value;
    const totalPlayers = players.length;

    // Validación de conflictos: una persona no puede estar en dos participantes del grupo
    const groupConflicts = typeof window.findDuplicatePersonInParticipants === 'function'
        ? window.findDuplicatePersonInParticipants(players) : [];
    if (groupConflicts.length > 0) {
        const c = groupConflicts[0];
        const personName = c.person.split('|')[0];
        const names = c.participants.map(p => p.name + ' (' + p.club + ')').join(' y ');
        showToast('⚠️ Conflicto: ' + personName + ' está en dos participantes del grupo ' + grupo + ': ' + names + '. Corregí la inscripción antes de continuar.', 'error');
        return;
    }

    currentPlayers = [...players].map((p, idx) => ({
        ...p,
        index: idx,
        points: 0
    }));

    // Limpiar el sorteo de desempates de un fixture anterior: un sorteo cargado
    // con viewFixture no debe filtrarse al nuevo fixture que se está generando.
    window.__currentSorteo = null;

    const realPlayers = players.filter(p => p.name !== "-" && p.club !== "-").length;
    const isSwiss = formato === 'suizo';

    let html = '';
    // Estructura de partidos del grupo (sets vacíos): evita que goToNextStep
    // considere completos los auto-fixtures sin resultados cargados.
    const matches = [];
    const numSets = window.ITTFRULES.setColumns(window.ITTFRULES.groupFormat());
    const emptySets = () => ({ player1: Array(numSets).fill(''), player2: Array(numSets).fill('') });
    const addEmptyMatch = (p1Idx, p2Idx) => {
        matches.push({
            match: matchNumber,
            player1: currentPlayers[p1Idx],
            player2: currentPlayers[p2Idx],
            sets: emptySets(),
            referee: '',
            formato: window.ITTFRULES.groupFormat(),
            completed: false
        });
    };

    html += `
        <div style="text-align: center; margin-bottom: 20px; padding: 15px; background: var(--header-bg); border-radius: 8px;">
            <h2 style="margin: 0 0 10px 0; color: var(--text-color);">${torneoNombre}</h2>
            <p style="margin: 5px 0; color: var(--text-color);">${subtitulo}</p>
            <p style="margin: 5px 0; font-weight: bold; color: var(--text-color);">
                CATEGORÍA: ${categoria} | GRUPO: ${grupo} | JUGADORES: ${realPlayers}${isSwiss ? ' | 🎯 SISTEMA SUIZO' : ''}
            </p>
            ${isSwiss ? '<div style="margin-top: 8px;"><button type="button" class="btn" style="padding: 6px 14px; font-size: 12px;" onclick="regenerateSwissRounds()">🔀 Re-parear rondas pendientes</button></div>' : ''}
        </div>
    `;

    let matchNumber = 1;
    let tabIndexCounter = 100;

    if (isSwiss) {
        // Tabla de posiciones del grupo suizo
        html += '<table class="summary-table compact">';
        html += '<tr><th>JUGADOR</th><th>CLUB</th><th>Pts.</th><th>Pos.</th></tr>';
        currentPlayers.forEach((p, idx) => {
            html += `<tr class="player-${idx + 1}">`;
            html += `<td>${escHtml(p.name)}</td><td>${escHtml(p.club)}</td>`;
            html += `<td id="pts-${idx}"></td>`;
            html += `<td id="pos-${idx}"></td>`;
            html += '</tr>';
        });
        html += '</table>';

        // Rondas suizas con tablas de partido
        const rounds = generateSwissRounds(currentPlayers, numRounds || defaultSwissRounds(realPlayers));
        rounds.forEach((pairs, rIdx) => {
            html += `<h4 style="text-align: center; color: var(--btn-primary); margin: 20px 0 10px 0;">🎯 RONDA ${rIdx + 1}</h4>`;
            pairs.forEach(pair => {
                if (!pair.p2 || pair.p2.name === '-') return;
                const t = buildMatchTableHTML(pair.p1, pair.p2, matchNumber, tabIndexCounter);
                html += t.html;
                tabIndexCounter = t.counter;
                addEmptyMatch(pair.p1.index, pair.p2.index);
                matchNumber++;
            });
        });
    } else {
        // Tabla resumen todos contra todos
        html += '<table class="summary-table compact">';
        let headerRow = '<tr><th>JUGADOR</th><th>CLUB</th>';
        for (let i = 0; i < Math.min(totalPlayers, 8); i++) {
            headerRow += `<th>${String.fromCharCode(65 + i)}</th>`;
        }
        headerRow += '<th>Pts.</th><th>Pos.</th></tr>';
        html += headerRow;

        currentPlayers.forEach((p, idx) => {
            html += `<tr class="player-${idx + 1}">`;
            html += `<td>${escHtml(p.name)}</td><td>${escHtml(p.club)}</td>`;

            for (let col = 0; col < totalPlayers && col < 8; col++) {
                if (col === idx) {
                    html += `<td class="free-cell"></td>`;
                } else {
                    html += `<td id="summary-${idx}-${col}"></td>`;
                }
            }

            html += `<td id="pts-${idx}"></td>`;
            html += `<td id="pos-${idx}"></td>`;
            html += '</tr>';
        });
        html += '</table>';

        // Tablas de enfrentamiento todos contra todos
        for (let i = 0; i < currentPlayers.length; i++) {
            for (let j = i + 1; j < currentPlayers.length; j++) {
                const p1 = currentPlayers[i];
                const p2 = currentPlayers[j];
                if ((p1.name === "-") || (p2.name === "-")) continue;
                const t = buildMatchTableHTML(p1, p2, matchNumber, tabIndexCounter);
                html += t.html;
                tabIndexCounter = t.counter;
                addEmptyMatch(i, j);
                matchNumber++;
            }
        }
    }

    const fixtureData = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        categoria,
        grupo,
        players: currentPlayers,
        matches,
        formato: isSwiss ? 'suizo' : 'todos',
        numRounds: isSwiss ? (numRounds || defaultSwissRounds(realPlayers)) : undefined,
        html
    };

    saveFixtureRecord(fixtureData);
    saveTournamentData();
    updateFixtureNavigator();
}

/**
 * Genera las tablas HTML de un partido (estructura compatible con el
 * cálculo de puntos y la extracción de datos del fixture).
 * La cantidad de columnas de sets depende del formato configurado
 * (BO3 → 3 sets, BO5 → 5 sets, BO7 → 7 sets). Incluye un botón para declarar W.O.
 */
function buildMatchTableHTML(p1, p2, matchNumber, tabIndexCounter) {
    const formato = window.ITTFRULES.groupFormat();
    const numSets = window.ITTFRULES.setColumns(formato);
    let tabIndexes = [];
    for (let setNum = 0; setNum < numSets; setNum++) {
        tabIndexes.push({ p1: tabIndexCounter++, p2: tabIndexCounter++ });
    }

    const setHeaders = tabIndexes.map((t, i) => `<th class="set-col">S${i + 1}</th>`).join('');

    const p1SetCols = tabIndexes.map((t, i) =>
        `<td class="set-col" contenteditable="true" onblur="validateAndCalculate(this)" data-set="${i + 1}" tabindex="${t.p1}"></td>`
    ).join('');
    const p2SetCols = tabIndexes.map((t, i) =>
        `<td class="set-col" contenteditable="true" onblur="validateAndCalculate(this)" data-set="${i + 1}" tabindex="${t.p2}"></td>`
    ).join('');

    const woColspan = numSets + 4;

    return {
        counter: tabIndexCounter,
        html: `
            <table class="match-table" data-formato="${formato}">
                <tr>
                    <th colspan="2">PARTIDO ${matchNumber}</th>
                    ${setHeaders}
                    <th>Pts.</th>
                    <th>RÉFERI</th>
                </tr>
                <tr class="player-${p1.index + 1}" data-player-index="${p1.index}">
                    <td colspan="2">${escHtml(p1.name)} - ${escHtml(p1.club)}</td>
                    ${p1SetCols}
                    <td id="pts-p1-${matchNumber}" data-p1-index="${p1.index}" data-p2-index="${p2.index}"></td>
                    <td class="ref-cell" rowspan="2"><input class="ref-input" id="ref-${matchNumber}" placeholder="Árbitro" maxlength="40"></td>
                </tr>
                <tr class="player-${p2.index + 1}" data-player-index="${p2.index}">
                    <td colspan="2">${escHtml(p2.name)} - ${escHtml(p2.club)}</td>
                    ${p2SetCols}
                    <td id="pts-p2-${matchNumber}" data-p1-index="${p1.index}" data-p2-index="${p2.index}"></td>
                </tr>
                <tr class="wo-row">
                    <td colspan="${woColspan}" style="text-align: left;">
                        <button type="button" class="btn btn-danger" style="padding: 3px 10px; font-size: 11px;" onclick="declareWO(this)">🚫 W.O.</button>
                        <button type="button" class="btn btn-primary" style="padding: 3px 10px; font-size: 11px;" onclick="exportMatchSheetPDF(${p1.index}, ${p2.index}, ${matchNumber})" title="Planilla oficial de partido (PDF) con saque, tiempo muerto, expedite y tarjetas">📄 Planilla</button>
                        <button type="button" class="btn btn-success" style="padding: 3px 10px; font-size: 11px;" onclick="shareMatchSheetPDF(${p1.index}, ${p2.index}, ${matchNumber})" title="Compartir la planilla de este partido por WhatsApp, correo, redes, etc.">📤 Compartir</button>
                        <span class="wo-status" style="font-size: 11px; color: var(--danger); margin-left: 8px;"></span>
                    </td>
                </tr>
                <tr class="inc-row">
                    <td colspan="${woColspan}" style="text-align: left; padding: 4px 6px;">
                        <input class="inc-input" style="width: 100%; padding: 5px 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color); font-size: 11px;" placeholder="📝 Incidencias del partido (retiro, lesión, protesta, tiempo muerto, tarjetas…)">
                    </td>
                </tr>
            </table>
        `
    };
}

// ==========================================
// W.O. (INCOMPARECENCIA)
// ==========================================

/**
 * Declara (o quita) un resultado W.O. en un partido de la planilla.
 * El rival del ausente gana el partido por forfeit con 11-0 en todos los
 * sets del formato. Se guarda el flag data-wo sobre la tabla para que
 * extractMatchesData lo persista y el ELO no lo compute como partido jugado.
 */
window.declareWO = function(btn) {
    const table = btn.closest('.match-table');
    if (!table) return;
    const [p1Row, p2Row] = matchPlayerRows(table);
    if (!p1Row || !p2Row) return;

    const p1Index = parseInt(p1Row.getAttribute('data-player-index'));
    const p2Index = parseInt(p2Row.getAttribute('data-player-index'));
    if (isNaN(p1Index) || isNaN(p2Index)) return;

    const p1 = currentPlayers[p1Index];
    const p2 = currentPlayers[p2Index];
    const p1Name = p1 ? p1.name : 'Jugador 1';
    const p2Name = p2 ? p2.name : 'Jugador 2';

    // Si ya hay un W.O. declarado, ofrecer quitarlo
    if (table.getAttribute('data-wo') === 'true') {
        showModal(
            'Quitar W.O.',
            '<p style="color: var(--text-color);">Este partido está marcado como W.O. ¿Querés quitarlo y volver a editarlo normalmente?</p>',
            () => undoWO(table)
        );
        return;
    }

    showModal(
        'Declarar W.O. (incomparecencia)',
        '<p style="color: var(--text-color);">Indicá quién <strong>NO se presentó</strong>. El rival gana el partido por incomparecencia con 11-0 en todos los sets.</p>' +
        '<select id="wo-select" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">' +
            `<option value="${p1Index}">${p2Name} no se presentó → gana ${p1Name}</option>` +
            `<option value="${p2Index}">${p1Name} no se presentó → gana ${p2Name}</option>` +
        '</select>',
        () => {
            const winnerIdx = parseInt(document.getElementById('wo-select').value);
            applyWO(table, winnerIdx, p1Index, p2Index);
        }
    );
};

function applyWO(table, winnerIdx, p1Index, p2Index) {
    const [p1Row, p2Row] = matchPlayerRows(table);
    if (!p1Row || !p2Row) return;
    const need = window.ITTFRULES.setsToWin(window.ITTFRULES.groupFormat());
    const winnerName = winnerIdx === p1Index
        ? (currentPlayers[p1Index] ? currentPlayers[p1Index].name : 'Jugador 1')
        : (currentPlayers[p2Index] ? currentPlayers[p2Index].name : 'Jugador 2');

    const p1Cols = p1Row.querySelectorAll('.set-col');
    const p2Cols = p2Row.querySelectorAll('.set-col');

    for (let i = 0; i < need; i++) {
        if (winnerIdx === p1Index) {
            p1Cols[i].textContent = '11';
            p2Cols[i].textContent = '0';
        } else {
            p1Cols[i].textContent = '0';
            p2Cols[i].textContent = '11';
        }
        p1Cols[i].classList.remove('invalid-score', 'valid-score', 'winner-score');
        p2Cols[i].classList.remove('invalid-score', 'valid-score', 'winner-score');
        p1Cols[i].contentEditable = 'false';
        p2Cols[i].contentEditable = 'false';
    }

    table.setAttribute('data-wo', 'true');
    table.setAttribute('data-wo-winner', String(winnerIdx));

    const status = table.querySelector('.wo-status');
    if (status) status.textContent = 'W.O. → gana ' + winnerName;

    // Refrescar marcas de ganador y puntos del partido
    for (let i = 0; i < need; i++) {
        if (window.highlightSetWinner) window.highlightSetWinner(p1Cols[i]);
    }
    if (window.calculateMatchPoints) window.calculateMatchPoints(p1Cols[0]);

    showToast('W.O. registrado: gana ' + winnerName + ' por incomparecencia.');
}

function undoWO(table) {
    const [p1Row, p2Row] = matchPlayerRows(table);
    if (!p1Row || !p2Row) return;

    const p1Cols = p1Row.querySelectorAll('.set-col');
    const p2Cols = p2Row.querySelectorAll('.set-col');

    p1Cols.forEach(c => {
        c.textContent = '';
        c.classList.remove('invalid-score', 'valid-score', 'winner-score');
        c.contentEditable = 'true';
    });
    p2Cols.forEach(c => {
        c.textContent = '';
        c.classList.remove('invalid-score', 'valid-score', 'winner-score');
        c.contentEditable = 'true';
    });

    table.removeAttribute('data-wo');
    table.removeAttribute('data-wo-winner');

    const status = table.querySelector('.wo-status');
    if (status) status.textContent = '';

    if (window.calculateMatchPoints && p1Cols[0]) window.calculateMatchPoints(p1Cols[0]);
    showToast('W.O. quitado. El partido se puede cargar normalmente.');
}

/**
 * Genera el pareo de un sistema suizo: por cada ronda se ordenan los
 * jugadores por desempeño y se emparejan con rivales del mismo nivel
 * que todavía no enfrentaron (sin repetir rivales).
 */
function generateSwissRounds(players, numRounds, playedSet) {
    const list = (players || []).map((pl, i) => ({
        ...pl,
        pts: (typeof pl.pts === 'number' ? pl.pts : (typeof pl.points === 'number' ? pl.points : 0)) || 0,
        elo: pl.elo || 1200,
        index: typeof pl.index === 'number' ? pl.index : i
    }));
    const real = list.filter(x => x.name !== '-' && x.club !== '-');
    const played = playedSet || new Set();
    const rounds = [];
    const numR = Math.max(1, Math.min(numRounds, Math.max(1, real.length - 1)));

    for (let r = 0; r < numR; r++) {
        // Ronda 1: siembra por ELO. Siguientes: por puntos, luego ELO (determinístico).
        const sorted = [...real].sort((a, b) =>
            b.pts - a.pts || (b.elo || 1200) - (a.elo || 1200) || a.index - b.index
        );
        const used = new Set();
        const pairs = [];

        for (let i = 0; i < sorted.length; i++) {
            if (used.has(i)) continue;
            let partner = -1;
            for (let j = i + 1; j < sorted.length; j++) {
                if (used.has(j)) continue;
                if (!played.has(swissPairKey(sorted[i], sorted[j]))) {
                    partner = j;
                    break;
                }
            }
            if (partner === -1) {
                pairs.push({ p1: sorted[i], p2: null });
                used.add(i);
                continue;
            }
            used.add(i);
            used.add(partner);
            played.add(swissPairKey(sorted[i], sorted[partner]));
            pairs.push({ p1: sorted[i], p2: sorted[partner] });
        }
        rounds.push(pairs);
    }
    return rounds;
}

/**
 * Re-parea las rondas pendientes de un fixture suizo usando el desempeño real:
 * los puntos de cada jugador se calculan desde los partidos completados y las
 * rondas aún vacías se regeneran emparejando por puntaje (sin repetir rivales).
 * Las rondas que ya tienen algún resultado cargado no se tocan.
 */
window.regenerateSwissRounds = function() {
    const out = document.getElementById('fixture-output');
    if (!out) return;

    const headers = Array.from(out.querySelectorAll('h4'));
    if (headers.length === 0) {
        showToast('Este fixture no usa sistema suizo', 'warning');
        return;
    }

    // Asignar cada tabla de partido a su ronda según los encabezados <h4>
    const sizes = [];
    let round = -1;
    Array.from(out.querySelectorAll('h4, .match-table')).forEach(n => {
        if (n.tagName === 'H4') { round++; sizes.push(0); }
        else if (round >= 0) sizes[round]++;
    });
    if (sizes.length === 0) return;

    const matches = extractMatchesData();
    let start = 0;
    const roundMatches = sizes.map(sz => { const sl = matches.slice(start, start + sz); start += sz; return sl; });

    const hasPlayed = m => !!(m && (m.completed || ((m.sets && m.sets.player1 || []).some(x => x !== '' && x != null))));

    // Primera ronda totalmente vacía → desde ahí se regenera
    let firstRegen = roundMatches.length;
    for (let i = 0; i < roundMatches.length; i++) {
        if (!roundMatches[i].some(hasPlayed)) { firstRegen = i; break; }
    }
    if (firstRegen === roundMatches.length) {
        showToast('No hay rondas vacías para re-parear', 'warning');
        return;
    }

    // Puntos reales de cada jugador desde las rondas ya jugadas
    const players = currentPlayers.map(p => ({ ...p, pts: 0 }));
    const byKey = {};
    players.forEach(p => { byKey[swissPairKey(p, p)] = p; });
    const locked = roundMatches.slice(0, firstRegen).flat();
    const played = new Set();
    locked.forEach(m => {
        if (!m || !m.completed || !m.player1 || !m.player2) return;
        const a = byKey[swissPairKey(m.player1, m.player1)];
        const b = byKey[swissPairKey(m.player2, m.player2)];
        if (a) a.pts += window.ITTFRULES.matchPointsFor(m, a.name, a.club);
        if (b) b.pts += window.ITTFRULES.matchPointsFor(m, b.name, b.club);
        played.add(swissPairKey(m.player1, m.player2));
    });

    const numRegen = roundMatches.length - firstRegen;
    const pairsByRound = generateSwissRounds(players, numRegen, played);

    // Continuar numeración de partidos y tabindex desde lo existente
    let tabIndexCounter = 100;
    out.querySelectorAll('.match-table .set-col').forEach(c => {
        const t = parseInt(c.getAttribute('tabindex'));
        if (!isNaN(t) && t >= tabIndexCounter) tabIndexCounter = t + 1;
    });
    let matchNumber = matches.length + 1;

    let html = '';
    pairsByRound.forEach((pairs, rIdx) => {
        html += `<h4 style="text-align: center; color: var(--btn-primary); margin: 20px 0 10px 0;">🎯 RONDA ${rIdx + 1 + firstRegen}</h4>`;
        pairs.forEach(pair => {
            if (!pair.p2 || pair.p2.name === '-') return;
            const t = buildMatchTableHTML(pair.p1, pair.p2, matchNumber, tabIndexCounter);
            html += t.html;
            tabIndexCounter = t.counter;
            matchNumber++;
        });
    });

    // Reemplazar desde el primer encabezado de ronda a regenerar
    const firstHeader = headers[firstRegen];
    if (!firstHeader) return;
    let node = firstHeader;
    while (node) {
        const next = node.nextSibling;
        node.parentNode.removeChild(node);
        node = next;
    }
    out.insertAdjacentHTML('beforeend', html);

    // Persistir con el mecanismo estándar para que fixture-output y el registro queden iguales
    if (typeof saveFixtureData === 'function') saveFixtureData();

    showToast('Rondas pendientes re-pareadas por desempeño real');
};

function swissPairKey(a, b) {
    const na = a.name + '|' + a.club;
    const nb = b.name + '|' + b.club;
    return na < nb ? na + '#' + nb : nb + '#' + na;
}

// ==========================================
// IMPRESIÓN Y EXPORTACIÓN
// ==========================================

/**
 * Imprime el fixture actual
 */
window.printFixture = function() {
    const fixtureContent = document.getElementById('fixture-output').innerHTML;
    if (!fixtureContent) {
        showToast('No hay fixture para imprimir', 'error');
        return;
    }

    const categoria = document.getElementById('categoria').value;
    const grupo = document.getElementById('grupo').value;
    const torneoNombre = document.getElementById('torneoNombre').value;
    const subtitulo = document.getElementById('subtitulo').value;

    const now = new Date();
    const fechaImpresion = now.toLocaleDateString(window.i18nLocale(), {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    let printWindow;
    try {
        printWindow = window.open('', '_blank');
    } catch (e) {
        printWindow = null;
    }
    if (!printWindow) {
        showToast('El navegador bloqueó la ventana de impresión. Permití los popups para este sitio.', 'error');
        return;
    }
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Fixture ${categoria} - Grupo ${grupo}</title>
            <style>
                * {
                    -webkit-print-color-adjust: exact;
                    color-adjust: exact;
                    box-sizing: border-box;
                }

                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    margin: 0;
                    padding: 0;
                }

                .print-header {
                    text-align: center;
                    padding: 10px 15px;
                    background: white;
                    border: 2px solid #007BFF;
                    border-radius: 8px;
                    margin: 0 0 15px 0;
                    page-break-after: avoid;
                }

                .print-header h1 {
                    margin: 0 0 3px 0;
                    font-size: 20px;
                    color: #333;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }

                .print-header .ping-pong {
                    font-size: 24px;
                }

                .print-header .subtitulo {
                    margin: 2px 0;
                    font-size: 12px;
                    color: #666;
                }

                .print-header .categoria-badge {
                    background: linear-gradient(135deg, #007BFF, #0056b3);
                    color: white;
                    padding: 6px 12px;
                    border-radius: 6px;
                    display: inline-block;
                    font-size: 12px;
                    font-weight: bold;
                    margin: 5px 0 3px 0;
                    text-transform: uppercase;
                }

                .print-header .fecha {
                    font-size: 9px;
                    color: #999;
                    margin: 3px 0 0 0;
                }

                .content-wrapper {
                    padding: 0;
                }

                .content-wrapper > div:first-child {
                    display: none !important;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 15px;
                    page-break-inside: avoid;
                }
                th, td {
                    padding: 6px;
                    border: 1px solid #333;
                    text-align: center;
                    font-size: 11px;
                }
                th {
                    background-color: #FFD700 !important;
                    font-weight: bold;
                    color: #333 !important;
                }

                .player-1 { background-color: #e6f2ff !important; }
                .player-2 { background-color: #ffe6e6 !important; }
                .player-3 { background-color: #e6ffe6 !important; }
                .player-4 { background-color: #f2f2ff !important; }
                .player-5 { background-color: #fff2e6 !important; }
                .player-6 { background-color: #f2e6ff !important; }
                .player-7 { background-color: #ffffe6 !important; }
                .player-8 { background-color: #e6fff2 !important; }
                .free-cell { background-color: #cccccc !important; }
                .winner-score {
                    background-color: #d4edda !important;
                    font-weight: bold;
                    color: #155724 !important;
                }

                .compact { font-size: 10px; }
                .match-table { font-size: 11px; }
                .ref-input {
                    border: none;
                    background: transparent;
                    font-family: inherit;
                    font-size: 11px;
                    text-align: center;
                    width: 100%;
                    min-width: 90px;
                }

                /* Higiene de impresión: ocultar botones interactivos y
                   mostrar solo el contenido del fixture */
                .match-table button,
                .wo-row button,
                .btn {
                    display: none !important;
                }

                .schedule-row {
                    font-weight: bold;
                }

                @page {
                    size: A4;
                    margin: 15mm 10mm;
                }

                @media print {
                    body {
                        margin: 0;
                        padding: 0;
                    }

                    table {
                        page-break-inside: avoid;
                    }
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <h1>
                    <span class="ping-pong">🏓</span>
                    ${torneoNombre}
                    <span class="ping-pong">🏓</span>
                </h1>
                <div class="subtitulo">${subtitulo}</div>
                <div class="categoria-badge">
                    CATEGORÍA: ${categoria} | GRUPO: ${grupo}
                </div>
                <div class="fecha">🖨️ Impreso el ${fechaImpresion}</div>
            </div>

            <div class="content-wrapper">
                ${fixtureContent}
            </div>

            <script>
                window.onload = function() {
                    const divs = document.querySelectorAll('.content-wrapper > div');
                    if (divs.length > 0) {
                        const firstDiv = divs[0];
                        const text = firstDiv.textContent.toLowerCase();
                        if (text.includes('torneo') || text.includes('categoría')) {
                            firstDiv.remove();
                        }
                    }

                    setTimeout(() => {
                        window.print();
                        setTimeout(() => window.close(), 500);
                    }, 100);
                };
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();

    addLog('IMPRIMIR', `Fixture impreso: ${categoria} - Grupo ${grupo}`);
    showToast('Fixture enviado a impresora');
};

/**
 * Exporta resumen de fixtures a PDF
 */
window.exportFixturesSummaryPDF = function() {
    console.log('Función exportFixturesSummaryPDF ejecutada');

    if (!tournamentData.fixtures || tournamentData.fixtures.length === 0) {
        showToast('No hay fixtures generados para exportar', 'error');
        return;
    }

    const torneoNombre = document.getElementById('torneoNombre').value || 'Torneo sin nombre';
    const fechaHoraImpresion = new Date().toLocaleString(window.i18nLocale(), {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    let allFixturesHTML = '';

    tournamentData.fixtures.forEach((fixture, index) => {
        const categoria = fixture.categoria;
        const grupo = fixture.grupo;
        const jugadores = fixture.players;

        // Validar que existan jugadores
        if (!jugadores || jugadores.length === 0) {
            console.log('Fixture sin jugadores, saltando...');
            return;
        }

        // Posiciones y puntos reales (reglamento ITTF) desde los partidos guardados
        const fixtureMatches = fixture.matches || [];
        const standings = window.ITTFRULES.groupStandings(jugadores, fixtureMatches);
        const mkey = p => (p.name || '') + '|' + (p.club || '');
        const rankOf = {};
        const ptsOf = {};
        standings.forEach(s => { rankOf[mkey(s.player)] = s.rank; ptsOf[mkey(s.player)] = s.matchPoints; });

        // Resultados entre pares: clave ordenada -> match
        const pairMap = {};
        fixtureMatches.forEach(m => {
            if (!m || !m.player1 || !m.player2) return;
            const a = mkey(m.player1), b = mkey(m.player2);
            pairMap[a < b ? a + '#' + b : b + '#' + a] = m;
        });

        // Texto de celda: sets ganados por cada lado, con marca de W.O.
        const cellFor = (m, ik, jk) => {
            if (!m) return '';
            const iIsP1 = mkey(m.player1) === ik;
            if (!iIsP1 && mkey(m.player2) !== ik) return '';
            const s1 = m.sets && m.sets.player1 || [];
            const s2 = m.sets && m.sets.player2 || [];
            const played = s1.some(x => x !== '' && x != null) || s2.some(x => x !== '' && x != null);
            if (!played) return '';
            const w1 = window.ITTFRULES.countSetWins(s1, s2);
            const w2 = window.ITTFRULES.countSetWins(s2, s1);
            const wi = iIsP1 ? w1 : w2;
            const wj = iIsP1 ? w2 : w1;
            return wi + '-' + wj + (m.wo ? ' (W.O.)' : '');
        };

        // Generar tabla resumen
        let tablaHTML = `
            <div class="fixture-container">
                <div class="fixture-header">
                    <div class="fixture-title">
                        <h1>🏓 ${torneoNombre} 🏓</h1>
                        <h2>${categoria} - Grupo ${grupo}</h2>
                        <p class="fecha-impresion">Generado: ${fechaHoraImpresion}</p>
                    </div>
                </div>

                <table class="fixture-table">
                    <thead>
                        <tr>
                            <th>Jugador</th>
                            <th>Club</th>`;

        // Agregar columnas de adversarios
        jugadores.forEach((_, i) => {
            tablaHTML += `<th>${String.fromCharCode(65 + i)}</th>`;
        });

        tablaHTML += `
                            <th>Pts.</th>
                            <th>Pos.</th>
                        </tr>
                    </thead>
                    <tbody>`;

        // Agregar filas de jugadores
        jugadores.forEach((jugador, i) => {
            const playerClass = `player-${i + 1}`;
            const ik = mkey(jugador);
            tablaHTML += `
                        <tr class="${playerClass}">
                            <td><strong>${escHtml(jugador.name) || 'Jugador ' + (i + 1)}</strong></td>
                            <td>${escHtml(jugador.club) || '-'}</td>`;

            // Agregar celdas de resultados reales
            jugadores.forEach((_, j) => {
                if (i === j) {
                    tablaHTML += `<td class="free-cell"></td>`;
                } else {
                    const jk = mkey(jugadores[j]);
                    const pair = ik < jk ? ik + '#' + jk : jk + '#' + ik;
                    tablaHTML += `<td>${cellFor(pairMap[pair], ik, jk)}</td>`;
                }
            });

            tablaHTML += `
                            <td>${ptsOf[ik] !== undefined ? ptsOf[ik] : ''}</td>
                            <td>${rankOf[ik] !== undefined ? rankOf[ik] : ''}</td>
                        </tr>`;
        });

        tablaHTML += `
                    </tbody>
                </table>
            </div>`;

        allFixturesHTML += tablaHTML;
    });

    // Crear ventana de impresión
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Fixtures - ${torneoNombre}</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    color-adjust: exact !important;
                }

                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    font-size: 10pt;
                }

                .fixture-container {
                    page-break-inside: avoid;
                    margin-bottom: 20px;
                    padding: 10px;
                    border: 2px solid #007BFF;
                    border-radius: 8px;
                    background: white;
                }

                .fixture-header {
                    text-align: center;
                    margin-bottom: 10px;
                    border-bottom: 3px solid #FFD700;
                    padding-bottom: 8px;
                }

                .fixture-title h1 {
                    color: #2c3e50;
                    font-size: 16pt;
                    margin-bottom: 4px;
                }

                .fixture-title h2 {
                    color: #007BFF;
                    font-size: 13pt;
                    margin-bottom: 4px;
                }

                .fecha-impresion {
                    color: #7f8c8d;
                    font-size: 8pt;
                    font-style: italic;
                }

                .fixture-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 8px;
                }

                .fixture-table th,
                .fixture-table td {
                    border: 1px solid #333;
                    padding: 6px 8px;
                    text-align: center;
                }

                .fixture-table th {
                    background-color: #FFD700 !important;
                    color: #333 !important;
                    font-weight: bold;
                    font-size: 9pt;
                }

                .fixture-table td {
                    font-size: 9pt;
                }

                .fixture-table td:first-child {
                    text-align: left;
                    font-weight: bold;
                }

                .fixture-table td:nth-child(2) {
                    text-align: left;
                    font-size: 8pt;
                }

                /* Colores de jugadores */
                .player-1 { background-color: #e6f2ff !important; }
                .player-2 { background-color: #ffe6e6 !important; }
                .player-3 { background-color: #e6ffe6 !important; }
                .player-4 { background-color: #f2f2ff !important; }
                .player-5 { background-color: #fff2e6 !important; }
                .player-6 { background-color: #f2e6ff !important; }
                .player-7 { background-color: #ffffe6 !important; }
                .player-8 { background-color: #e6fff2 !important; }
                .free-cell {
                    background-color: #cccccc !important;
                    color: #cccccc !important;
                }

                @page {
                    size: A4;
                    margin: 15mm;
                }

                @media print {
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }

                    body {
                        margin: 0;
                        padding: 0;
                    }

                    .fixture-container {
                        page-break-inside: avoid;
                        margin-bottom: 15px;
                        border: 2px solid #007BFF;
                    }

                    /* Forzar colores en impresión */
                    .player-1 { background-color: #e6f2ff !important; }
                    .player-2 { background-color: #ffe6e6 !important; }
                    .player-3 { background-color: #e6ffe6 !important; }
                    .player-4 { background-color: #f2f2ff !important; }
                    .player-5 { background-color: #fff2e6 !important; }
                    .player-6 { background-color: #f2e6ff !important; }
                    .player-7 { background-color: #ffffe6 !important; }
                    .player-8 { background-color: #e6fff2 !important; }
                    .free-cell { background-color: #cccccc !important; }
                }

                @media screen {
                    body {
                        background: #f5f5f5;
                        padding: 20px;
                    }
                }
            </style>
        </head>
        <body>
            ${allFixturesHTML}

            <script>
                window.onload = function() {
                    setTimeout(() => {
                        window.print();
                    }, 500);
                };
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();

    addLog('EXPORTAR RESUMEN', `${tournamentData.fixtures.length} fixtures exportados`);
    showToast('Fixtures completos enviados a impresora / PDF');
};


// ==========================================
// PLANILLA OFICIAL DE PARTIDO (PDF)
// ==========================================

/**
 * Limpia emojis y caracteres no soportados por la fuente estándar de jsPDF.
 */
function planillaClean(s) {
    return String(s == null ? '' : s).replace(/[\u{1F000}-\u{1FFFF}\u2600-\u27BF\uFE0F]/gu, '').trim();
}

/**
 * Dibuja una casilla de verificación (cuadradito vacío) en el PDF.
 */
function planillaCheck(doc, x, y, size) {
    doc.setLineWidth(0.4);
    doc.rect(x, y, size, size);
    doc.setLineWidth(0.2);
}

/**
 * Dibuja una planilla oficial de partido en la página actual del PDF.
 * @param {Object} doc - Instancia de jsPDF
 * @param {Object} info - Datos: { matchNumber, p1, p2, p1Sets, p2Sets, referee, isWO, blank }
 */
function drawMatchSheetPage(doc, info) {
    const pageW = doc.internal.pageSize.getWidth();
    const formato = window.ITTFRULES.groupFormat();
    const numSets = window.ITTFRULES.setColumns(formato);
    const blank = !!info.blank;

    const p1 = info.p1 || { name: 'Jugador 1', club: '' };
    const p2 = info.p2 || { name: 'Jugador 2', club: '' };
    const p1Sets = blank ? [] : (info.p1Sets || []);
    const p2Sets = blank ? [] : (info.p2Sets || []);
    const referee = blank ? '' : (info.referee || '');
    const isWO = blank ? false : !!info.isWO;

    const catInput = document.getElementById('categoria');
    const grupoInput = document.getElementById('grupo');
    const nombreInput = document.getElementById('torneoNombre');
    const torneo = planillaClean((nombreInput && nombreInput.value) || (tournamentData.settings && tournamentData.settings.torneoNombre) || 'Torneo');
    const categoria = catInput ? planillaClean(catInput.value) : '';
    const grupo = grupoInput ? planillaClean(grupoInput.value) : '';
    const fechaStr = new Date().toLocaleDateString(window.i18nLocale());
    const horaStr = new Date().toLocaleTimeString(window.i18nLocale(), { hour: '2-digit', minute: '2-digit' });

    const name1 = planillaClean(p1.name);
    const name2 = planillaClean(p2.name);
    const club1 = planillaClean(p1.club);
    const club2 = planillaClean(p2.club);

    // ---- Encabezado ----
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('PLANILLA OFICIAL DE PARTIDO', pageW / 2, 18, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Tenis de mesa · Reglamento ITTF vigente', pageW / 2, 24, { align: 'center' });
    doc.setLineWidth(0.6);
    doc.line(14, 27, pageW - 14, 27);

    doc.setFontSize(10);
    doc.text('Torneo: ' + torneo, 14, 34);
    doc.text('Fecha: ' + fechaStr + '  ·  Hora: ' + horaStr, pageW / 2, 34);
    doc.text('Categoría: ' + (categoria || '—'), 14, 40);
    doc.text('Grupo: ' + (grupo || '—'), pageW / 2, 40);
    doc.text('Partido Nº: ' + info.matchNumber, pageW - 20, 40, { align: 'right' });
    doc.text('Formato: ' + (formato === 'bo3' ? 'BO3 (2 sets)' : formato === 'bo7' ? 'BO7 (4 sets)' : 'BO5 (3 sets)'), 14, 46);

    // ---- Jugadores ----
    let y = 52;
    const boxW = (pageW - 28 - 8) / 2;
    const boxH = 24;
    [['JUGADOR 1', name1, club1], ['JUGADOR 2', name2, club2]].forEach((pair, i) => {
        const bx = 14 + i * (boxW + 8);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.rect(bx, y, boxW, boxH);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(pair[0], bx + 3, y + 6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(pair[1] || '—', bx + 3, y + 13);
        doc.setFontSize(9);
        doc.text('Club: ' + (pair[2] || '—'), bx + 3, y + 20);
    });

    // ---- Elección inicial (2.13.1) ----
    y = y + boxH + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Sorteo inicial (2.13.1) — quien gana el sorteo elige entre sacar o recibir y lado de la mesa', 14, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text('Saca primero:', 14, y);
    planillaCheck(doc, 48, y - 4, 4);
    doc.text('J1', 54, y);
    planillaCheck(doc, 62, y - 4, 4);
    doc.text('J2', 68, y);
    doc.text('Elige lado:', 84, y);
    planillaCheck(doc, 96, y - 4, 4);
    doc.text('J1', 102, y);
    planillaCheck(doc, 110, y - 4, 4);
    doc.text('J2', 116, y);

    // ---- Tabla de sets ----
    y += 8;
    const servicePattern = (() => {
        const blocks = [];
        for (let k = 0; k < 7; k++) blocks.push((k % 2 === 0 ? 'J1' : 'J2'));
        const seq = [];
        blocks.forEach(b => { seq.push(b); seq.push(b); });
        return seq.join('  ');
    })();

    const setBody = [];
    for (let i = 0; i < numSets; i++) {
        const sa = parseInt(p1Sets[i]) || 0;
        const sb = parseInt(p2Sets[i]) || 0;
        const aTxt = blank || p1Sets[i] === '' || p1Sets[i] == null ? '' : (parseInt(p1Sets[i]) || 0);
        const bTxt = blank || p2Sets[i] === '' || p2Sets[i] == null ? '' : (parseInt(p2Sets[i]) || 0);
        const setWinner = window.ITTFRULES.setPlayed(sa, sb) ? window.ITTFRULES.getSetWinner(sa, sb) : 0;
        const winTxt = isWO ? 'W.O.' : (setWinner === 1 ? 'J1' : setWinner === -1 ? 'J2' : '');
        setBody.push([String(i + 1), String(aTxt), String(bTxt), winTxt, i === 0 ? servicePattern : '']);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Resultado por set — orden de saque (2.13.3): alterna cada 2 puntos; a partir de 10-10, cada punto', 14, y);
    doc.autoTable({
        startY: y + 3,
        margin: { left: 14, right: 14 },
        head: [['Set', 'Jugador 1', 'Jugador 2', 'Ganador', 'Orden de saque (J1 J1 J2 J2 · …)']],
        body: setBody,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [38, 74, 132] },
        columnStyles: {
            0: { cellWidth: 12 },
            1: { cellWidth: 24 },
            2: { cellWidth: 24 },
            3: { cellWidth: 24 },
            4: { cellWidth: 'auto' }
        },
        theme: 'grid'
    });
    y = doc.lastAutoTable.finalY + 8;

    // ---- Ganador / W.O. ----
    if (!blank) {
        const totalW1 = window.ITTFRULES.countSetWins(p1Sets, p2Sets);
        const totalW2 = window.ITTFRULES.countSetWins(p2Sets, p1Sets);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        if (isWO) {
            doc.text('Resultado: W.O. (incomparecencia). El rival presente gana el partido.', 14, y);
            y += 6;
        } else if (totalW1 > 0 || totalW2 > 0) {
            const g = totalW1 + '-' + totalW2;
            const ganador = totalW1 > totalW2 ? name1 : totalW2 > totalW1 ? name2 : '—';
            doc.text('Resultado: ' + g + ' sets. Ganador: ' + ganador, 14, y);
            y += 6;
        }
    }

    // ---- Tiempo muerto (3.5.2) ----
    doc.setFont('helvetica', 'bold');
    doc.text('Tiempo muerto (3.5.2) — 1 por jugador, máx. 1 minuto', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text('J1:', 14, y);
    planillaCheck(doc, 22, y - 4, 4);
    doc.text('Juego Nº:', 30, y);
    doc.text('J2:', 66, y);
    planillaCheck(doc, 74, y - 4, 4);
    doc.text('Juego Nº:', 82, y);
    doc.text('Minuto de inicio: ________', 122, y);

    // ---- Sistema de aceleración / expedite (2.15) ----
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('Sistema de aceleración (2.15) — se aplica a los 10 minutos o cuando quedan 18 puntos sin jugar', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text('No aplicado:', 14, y);
    planillaCheck(doc, 34, y - 4, 4);
    doc.text('Aplicado en el juego Nº:', 44, y);

    // ---- Tarjetas de conducta (3.5.3) ----
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('Tarjetas de conducta (3.5.3)', 14, y);
    doc.autoTable({
        startY: y + 3,
        margin: { left: 14, right: 14 },
        head: [['Jugador', 'Amarilla (advertencia)', 'Roja (+1 pt.)', 'Roja (+2 pts.)', 'Roja (pérdida del partido)']],
        body: [
            ['J1 — ' + name1, '', '', '', ''],
            ['J2 — ' + name2, '', '', '', '']
        ],
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [230, 57, 70] },
        theme: 'grid'
    });
    y = doc.lastAutoTable.finalY + 10;

    // ---- Firmas ----
    doc.setLineWidth(0.3);
    doc.line(14, y + 14, 70, y + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Firma del árbitro: ' + (referee ? referee : '______________'), 14, y + 18);

    doc.line(pageW - 70, y + 14, pageW - 14, y + 14);
    doc.text('Firma del jugador 1', pageW - 42, y + 18, { align: 'center' });

    y += 28;
    doc.line(14, y + 14, 70, y + 14);
    doc.text('Firma del jugador 2', 42, y + 18, { align: 'center' });

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text('Generado por SGTM · v' + (window.APP_VERSION || '2.3'), 14, 290);
    doc.setTextColor(0);
}

/**
 * Reúne el contexto (jugadores, sets cargados, árbitro y W.O.) de una
 * planilla de partido a partir del DOM, para usarlo tanto en la exportación
 * como en la compartición del PDF.
 */
function gatherMatchSheetContext(p1Index, p2Index, matchNumber) {
    const refEl = document.getElementById('ref-' + matchNumber);
    const table = refEl && typeof refEl.closest === 'function' ? refEl.closest('.match-table') : null;
    const [p1Row, p2Row] = table ? matchPlayerRows(table) : [];

    const p1 = currentPlayers[p1Index] || { name: 'Jugador 1', club: '' };
    const p2 = currentPlayers[p2Index] || { name: 'Jugador 2', club: '' };

    return {
        p1,
        p2,
        p1Sets: p1Row ? Array.from(p1Row.querySelectorAll('.set-col[contenteditable]')).map(c => c.textContent.trim()) : [],
        p2Sets: p2Row ? Array.from(p2Row.querySelectorAll('.set-col[contenteditable]')).map(c => c.textContent.trim()) : [],
        referee: refEl ? refEl.value.trim() : '',
        isWO: table ? table.getAttribute('data-wo') === 'true' : false
    };
}

/**
 * Construye el documento PDF de una planilla oficial de partido.
 * @returns {Object} { doc, fname, ctx }
 */
function buildMatchSheetDoc(p1Index, p2Index, matchNumber) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const ctx = gatherMatchSheetContext(p1Index, p2Index, matchNumber);
    drawMatchSheetPage(doc, {
        matchNumber,
        p1: ctx.p1,
        p2: ctx.p2,
        p1Sets: ctx.p1Sets,
        p2Sets: ctx.p2Sets,
        referee: ctx.referee,
        isWO: ctx.isWO,
        blank: false
    });
    const name1 = planillaClean(ctx.p1.name);
    const name2 = planillaClean(ctx.p2.name);
    const fname = 'Planilla_Partido_' + matchNumber + '_' + new Date().toISOString().split('T')[0] + '.pdf';
    return { doc, fname, ctx, name1, name2 };
}

/**
 * Exporta la planilla oficial de un partido a PDF con los datos cargados
 * en pantalla (resultados, árbitro y estado W.O. incluidos).
 * @param {number} p1Index - Índice del jugador 1 en currentPlayers
 * @param {number} p2Index - Índice del jugador 2 en currentPlayers
 * @param {number} matchNumber - Número de partido (para localizar la planilla)
 */
window.exportMatchSheetPDF = function(p1Index, p2Index, matchNumber) {
    if (typeof window.jspdf === 'undefined') {
        showToast('Librería PDF no disponible (se necesita conexión la primera vez)', 'error');
        return;
    }

    try {
        const { doc, fname, name1, name2 } = buildMatchSheetDoc(p1Index, p2Index, matchNumber);
        doc.save(fname);
        showToast('Planilla generada: ' + fname);
        addLog('PLANILLA PDF', 'Planilla oficial del partido ' + matchNumber + ' (' + name1 + ' vs ' + name2 + ') exportada');
    } catch (error) {
        console.error('Error al generar la planilla:', error);
        showToast('Error al generar la planilla', 'error');
    }
};

/**
 * Comparte la planilla oficial de un partido (PDF) por redes/mensajería.
 * Móvil: Web Share API con el archivo. Escritorio: descarga + mensaje copiado.
 */
window.shareMatchSheetPDF = function(p1Index, p2Index, matchNumber) {
    if (typeof window.jspdf === 'undefined') {
        showToast('Librería PDF no disponible (se necesita conexión la primera vez)', 'error');
        return;
    }

    try {
        const { doc, fname, ctx, name1, name2 } = buildMatchSheetDoc(p1Index, p2Index, matchNumber);
        const blob = doc.output('blob');
        const torneo = planillaClean((tournamentData.settings && tournamentData.settings.torneoNombre) || 'Torneo');
        const msg = '🏓 ' + torneo + ' — Planilla del partido ' + matchNumber + ': ' + name1 + ' vs ' + name2 + ' 📄';
        window.shareFileBlob(blob, fname, msg);
        addLog('PLANILLA PDF', 'Planilla del partido ' + matchNumber + ' (' + name1 + ' vs ' + name2 + ') compartida');
    } catch (error) {
        console.error('Error al compartir la planilla:', error);
        showToast('Error al compartir la planilla', 'error');
    }
};

/**
 * Construye el documento PDF del paquete de planillas EN BLANCO.
 * @returns {Object} { doc, fname, any }
 */
function buildMatchSheetsPackDoc() {
    const tables = document.querySelectorAll('.match-table');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let any = 0;
    tables.forEach((table, idx) => {
        const [p1Row, p2Row] = matchPlayerRows(table);
        if (!p1Row || !p2Row) return;
        const p1Index = parseInt(p1Row.getAttribute('data-player-index'));
        const p2Index = parseInt(p2Row.getAttribute('data-player-index'));
        if (isNaN(p1Index) || isNaN(p2Index)) return;

        if (idx > 0) doc.addPage();
        drawMatchSheetPage(doc, {
            matchNumber: idx + 1,
            p1: currentPlayers[p1Index] || {},
            p2: currentPlayers[p2Index] || {},
            blank: true
        });
        any++;
    });

    const catInput = document.getElementById('categoria');
    const grupoInput = document.getElementById('grupo');
    const cat = catInput ? planillaClean(catInput.value) : '';
    const grupo = grupoInput ? planillaClean(grupoInput.value) : '';
    const fname = 'Planillas_' + (cat ? cat + '_' : '') + (grupo ? 'Grupo_' + grupo + '_' : '') + new Date().toISOString().split('T')[0] + '.pdf';
    return { doc, fname, any };
}

/**
 * Exporta un paquete con las planillas oficiales EN BLANCO de todos los
 * partidos del fixture actual (una por página), para entregar al árbitro.
 */
window.exportMatchSheetsPackPDF = function() {
    if (typeof window.jspdf === 'undefined') {
        showToast('Librería PDF no disponible (se necesita conexión la primera vez)', 'error');
        return;
    }

    try {
        const tables = document.querySelectorAll('.match-table');
        if (!tables || tables.length === 0) {
            showToast('No hay partidos para generar planillas', 'error');
            return;
        }

        const { doc, fname, any } = buildMatchSheetsPackDoc();
        if (any === 0) {
            showToast('No se encontraron partidos válidos', 'error');
            return;
        }

        doc.save(fname);
        showToast('Paquete de ' + any + ' planillas generado: ' + fname);
        addLog('PLANILLAS PACK', any + ' planillas en blanco exportadas');
    } catch (error) {
        console.error('Error al generar el paquete de planillas:', error);
        showToast('Error al generar el paquete de planillas', 'error');
    }
};

/**
 * Comparte el paquete de planillas EN BLANCO (PDF) por redes/mensajería.
 */
window.shareMatchSheetsPackPDF = function() {
    if (typeof window.jspdf === 'undefined') {
        showToast('Librería PDF no disponible (se necesita conexión la primera vez)', 'error');
        return;
    }

    try {
        const tables = document.querySelectorAll('.match-table');
        if (!tables || tables.length === 0) {
            showToast('No hay partidos para generar planillas', 'error');
            return;
        }

        const { doc, fname, any } = buildMatchSheetsPackDoc();
        if (any === 0) {
            showToast('No se encontraron partidos válidos', 'error');
            return;
        }

        const blob = doc.output('blob');
        const catInput = document.getElementById('categoria');
        const grupoInput = document.getElementById('grupo');
        const cat = catInput ? planillaClean(catInput.value) : '';
        const grupo = grupoInput ? planillaClean(grupoInput.value) : '';
        const msg = '📄 ' + (cat ? cat + ' · ' : '') + (grupo ? 'Grupo ' + grupo + ' · ' : '') + any + ' planillas oficiales en blanco (SGTM)';
        window.shareFileBlob(blob, fname, msg);
        addLog('PLANILLAS PACK', any + ' planillas en blanco compartidas');
    } catch (error) {
        console.error('Error al compartir el paquete de planillas:', error);
        showToast('Error al compartir el paquete de planillas', 'error');
    }
};
