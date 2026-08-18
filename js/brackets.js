// ==========================================
// BRACKETS.JS - GESTIÓN DE LLAVES ELIMINATORIAS
// ==========================================
// Este archivo contiene todas las funciones relacionadas con:
// - Generación automática de llaves desde resultados de grupos
// - Creación manual de llaves
// - Generación de rondas de brackets
// - Verificación de disponibilidad de datos
// ==========================================

// ==========================================
// GENERACIÓN AUTOMÁTICA DE LLAVES
// ==========================================

/**
 * Genera llaves eliminatorias automáticamente a partir de los ganadores de grupos
 * Lee los resultados de todos los fixtures guardados y crea llaves eliminatorias
 * ordenando a los clasificados por puntos totales
 */
window.generateBrackets = function() {
    // Leer ganadores de los grupos guardados
    const fixtures = tournamentData.fixtures;

    if (!fixtures || fixtures.length === 0) {
        showToast('No hay fixtures para generar llaves', 'error');
        return;
    }

    // Agrupar fixtures por categoría
    const categoriesMap = {};

    fixtures.forEach(fixture => {
        if (!categoriesMap[fixture.categoria]) {
            categoriesMap[fixture.categoria] = [];
        }

        // Obtener ganadores del grupo (primer y segundo lugar) que hayan
        // jugado al menos un partido (puntos ITTF > 0).
        const sortedPlayers = [...fixture.players].sort((a, b) => comparePlayersWithTiebreak(fixture, a, b));
        const winners = sortedPlayers.filter(p => p.name !== '-' && p.club !== '-' && (p.points || 0) > 0).slice(0, 2);

        categoriesMap[fixture.categoria].push({
            grupo: fixture.grupo,
            winners: winners,
            fixtureId: fixture.id
        });
    });

    // Verificar que hay categorías con datos
    if (Object.keys(categoriesMap).length === 0) {
        showToast('No hay categorías con resultados para generar llaves', 'warning');
        return;
    }

    // Mostrar modal para seleccionar categoría
    let categoriesHTML = '<select id="bracket-category" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color); margin-bottom: 15px;">';
    Object.keys(categoriesMap).sort().forEach(cat => {
        const totalWinners = categoriesMap[cat].reduce((sum, g) => sum + g.winners.length, 0);
        categoriesHTML += `<option value="${escAttr(cat)}">${escHtml(cat)} (${categoriesMap[cat].length} grupos, ${totalWinners} clasificados)</option>`;
    });
    categoriesHTML += '</select>';

    showModal(
        '🏆 Generar Llaves Eliminatorias Automáticas',
        `<div style="color: var(--text-color);">
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 64px;">🏆</div>
            </div>

            <p style="margin-bottom: 15px;"><strong>Selecciona la categoría para generar las llaves:</strong></p>

            ${categoriesHTML}

            <div class="info-box" style="margin: 15px 0;">
                <strong>ℹ️ Sistema automático:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>Se toman los 1° y 2° de cada grupo</li>
                    <li>Se ordenan por puntos totales</li>
                    <li>Se asignan seeds automáticamente</li>
                    <li>Se crean las llaves según el número de clasificados:</li>
                </ul>
                <div style="margin-left: 40px; font-size: 13px;">
                    • 2-4 clasificados → Semifinales + Final + Tercer Puesto<br>
                    • 5-8 clasificados → Cuartos + Semifinales + Final + Tercer Puesto<br>
                    • 9-16 clasificados → Octavos + Cuartos + Semifinales + Final + Tercer Puesto
                </div>
            </div>

            <div class="warn-box" style="margin: 15px 0;">
                <strong>💡 Nota:</strong> Los jugadores con más puntos en fase de grupos tendrán mejores seeds (1, 2, 3...). El partido por el tercer puesto se juega entre los dos perdedores de las semifinales.
            </div>
        </div>`,
        () => {
            const selectedCategory = document.getElementById('bracket-category').value;
            executeGenerateBrackets(categoriesMap[selectedCategory], selectedCategory);
        }
    );
};

/**
 * Ejecuta la generación de llaves para una categoría específica
 * @param {Array} groupsData - Array de grupos con sus ganadores
 * @param {string} categoria - Nombre de la categoría
 */
function executeGenerateBrackets(groupsData, categoria) {
    // Recopilar todos los ganadores y ordenarlos por puntos
    let allWinners = [];

    groupsData.forEach(group => {
        group.winners.forEach((winner, idx) => {
            allWinners.push({
                ...winner,
                grupo: group.grupo,
                posicionGrupo: idx + 1, // 1 = primero, 2 = segundo
                fixtureId: group.fixtureId
            });
        });
    });

    // Verificar que hay ganadores
    if (allWinners.length === 0) {
        showToast('No hay clasificados en esta categoría', 'warning');
        return;
    }

    if (allWinners.length < 2) {
        showToast('Se necesitan al menos 2 clasificados para generar llaves', 'warning');
        return;
    }

    // Ordenar por puntos (mayor a menor)
    allWinners.sort((a, b) => {
        // Primero por puntos
        if (b.points !== a.points) {
            return b.points - a.points;
        }
        // Si tienen los mismos puntos, priorizar primeros de grupo
        if (a.posicionGrupo !== b.posicionGrupo) {
            return a.posicionGrupo - b.posicionGrupo;
        }
        // Si son del mismo grupo, desempatar por enfrentamiento directo
        if (a.fixtureId === b.fixtureId) {
            const fixture = tournamentData.fixtures.find(f => f.id === a.fixtureId);
            if (fixture) {
                const pa = fixture.players.find(p => p.name === a.name && p.club === a.club);
                const pb = fixture.players.find(p => p.name === b.name && p.club === b.club);
                if (pa && pb) {
                    const h2h = headToHeadInfo(pa, pb, fixture.matches);
                    if (h2h.played && h2h.aSets !== h2h.bSets) {
                        // El ganador del enfrentamiento directo va primero
                        return h2h.bSets - h2h.aSets;
                    }
                }
            }
        }
        // Si todo igual, por orden alfabético de grupo
        return a.grupo.localeCompare(b.grupo);
    });

    // Si ya existe una llave de esta categoría con resultados cargados,
    // pedir confirmación antes de regenerar (los resultados se perderían).
    const existing = (tournamentData.brackets || []).find(b => b.categoria === categoria);
    const hasResults = existing && existing.rounds &&
        existing.rounds.some(r => r.matches.some(m => m.completed));

    if (hasResults) {
        showModal(
            '⚠️ ¿Regenerar llaves?',
            `<div style="color: var(--text-color);">
                <p>Ya existe una llave de <strong>${escHtml(categoria)}</strong> con resultados cargados.</p>
                <p>Si la regenerás, se perderán los resultados actuales y se crearán llaves nuevas según la clasificación vigente.</p>
            </div>`,
            () => doRegenerateBrackets(groupsData, categoria, allWinners)
        );
        return;
    }

    doRegenerateBrackets(groupsData, categoria, allWinners);
}

/**
 * Ejecuta la regeneración de la llave de una categoría (sin confirmación).
 * @param {Array} groupsData - Grupos con sus ganadores
 * @param {string} categoria - Nombre de la categoría
 * @param {Array} allWinners - Clasificados ordenados y con seed asignado
 */
function doRegenerateBrackets(groupsData, categoria, allWinners) {
    // Asignar seeds finales
    allWinners = allWinners.map((player, idx) => ({
        ...player,
        seed: idx + 1
    }));

    const numPlayers = allWinners.length;

    // Construir las rondas de la llave (interactivas, con playoff de bronce)
    const rounds = buildAutoBracketRounds(allWinners, numPlayers);

    // Guardar/actualizar la llave en tournamentData
    if (!tournamentData.brackets) {
        tournamentData.brackets = [];
    }
    tournamentData.brackets = tournamentData.brackets.filter(b => b.categoria !== categoria);

    const bracketEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        categoria: categoria,
        numClasificados: numPlayers,
        clasificados: allWinners,
        gruposOriginales: groupsData.length,
        rounds: rounds
    };
    tournamentData.brackets.push(bracketEntry);

    saveTournamentData();

    renderBracketInteractive(bracketEntry, categoria);

    showToast(`✅ Llaves generadas para ${categoria} con ${numPlayers} clasificados`);
    addLog('LLAVES AUTO', `Llaves de ${categoria}: ${numPlayers} clasificados de ${groupsData.length} grupos`);
}

// ==========================================
// LLAVES INTERACTIVAS (CON PLAYOFF DE BRONCE)
// ==========================================

function makeRound(title, count) {
    return { title: title, count: count, matches: [] };
}

// Slots vacíos de sets de una llave según el formato (BO3→3, BO5→5, BO7→7).
function emptyBracketSets() {
    const n = window.ITTFRULES ? window.ITTFRULES.setColumns(window.ITTFRULES.bracketFormat()) : 5;
    return { p1: Array(n).fill(''), p2: Array(n).fill('') };
}

function newBracketMatch(p1, p2) {
    return {
        p1: p1 || { name: 'TBD', club: '-', seed: '-' },
        p2: p2 || { name: 'TBD', club: '-', seed: '-' },
        sets: emptyBracketSets(),
        completed: false,
        winner: null,
        winnerSide: -1
    };
}

/**
 * Construye las rondas de la llave automática a partir de los clasificados.
 * Usa la estructura estándar de eliminación simple con byes: el tamaño de
 * la llave es la potencia de 2 inmediatamente superior (mínimo 4); los
 * mejores seeds reciben bye y avanzan directo a la ronda siguiente. Así,
 * cualquier cantidad de clasificados (2, 3, 5, 6, 7, 9-15...) genera una
 * llave completable sin partidos TBD imposibles.
 */
function buildAutoBracketRounds(players, numPlayers) {
    // Capacidad T = potencia de 2 >= numPlayers (mínimo 4)
    let T = 4;
    while (T < numPlayers) T *= 2;

    // Orden estándar de seeds por slot de llave
    // (para T=8 → [1,8,5,4,3,6,7,2]; para T=16 → [1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11])
    let slots = [1];
    while (slots.length < T) {
        const len = slots.length;
        const next = [];
        for (const x of slots) { next.push(x); next.push(2 * len + 1 - x); }
        slots = next;
    }

    // Títulos de las rondas según el tamaño de la llave
    let firstTitle;
    const roundTitles = [];
    if (T === 4) {
        firstTitle = 'Semifinales';
        roundTitles.push('Final');
    } else if (T === 8) {
        firstTitle = 'Cuartos de Final';
        roundTitles.push('Semifinales', 'Final');
    } else if (T === 16) {
        firstTitle = 'Octavos de Final';
        roundTitles.push('Cuartos de Final', 'Semifinales', 'Final');
    } else {
        firstTitle = 'Primera Ronda';
        roundTitles.push('Octavos de Final', 'Cuartos de Final', 'Semifinales', 'Final');
    }

    const rounds = [];
    const first = makeRound(firstTitle, T / 2);
    first.matches = [];
    for (let i = 0; i < T / 2; i++) {
        const s1 = slots[i * 2];
        const s2 = slots[i * 2 + 1];
        const p1 = s1 <= numPlayers ? players[s1 - 1] : null;
        const p2 = s2 <= numPlayers ? players[s2 - 1] : null;
        const m = newBracketMatch(p1, p2);
        m.bye = !p1 || !p2;
        if (m.bye) {
            // Bye: el jugador real avanza directo sin jugar
            const realSide = p1 ? 0 : 1;
            m.completed = true;
            m.winnerSide = realSide;
            m.winner = realSide === 0 ? m.p1 : m.p2;
        }
        first.matches.push(m);
    }
    rounds.push(first);

    roundTitles.forEach(title => {
        const count = title === 'Octavos de Final' ? 8
            : title === 'Cuartos de Final' ? 4
            : title === 'Semifinales' ? 2
            : 1;
        const r = makeRound(title, count);
        r.matches = [];
        for (let i = 0; i < count; i++) r.matches.push(newBracketMatch(null, null));
        rounds.push(r);
    });

    // Playoff de bronce: los perdedores de semifinales juegan el 3° puesto.
    if (numPlayers >= 4) {
        const pred = getThirdPlacePlayers(players);
        const bronze = makeRound('Tercer Puesto', 1);
        bronze.matches = [newBracketMatch(pred[0] || null, pred[1] || null)];
        rounds.push(bronze);
    }

    // Avanzar los byes directos de la primera ronda a sus posiciones
    first.matches.forEach((m, mIdx) => {
        if (m.bye && m.completed) {
            advanceBracketWinner({ rounds }, 0, mIdx, m.winnerSide);
        }
    });

    return rounds;
}

/**
 * Renderiza la llave interactiva (con ingreso de sets) en brackets-output.
 */
function renderBracketInteractive(bracket, categoria) {
    const output = document.getElementById('brackets-output');
    if (!output) return;
    output.innerHTML = renderBracketInteractiveHTML(bracket);
}

function renderBracketMatchHTML(bracket, rIdx, mIdx) {
    const m = bracket.rounds[rIdx].matches[mIdx];
    const isTBD = !m.p1 || !m.p2 || /^tbd$/i.test(m.p1.name) || /^tbd$/i.test(m.p2.name);
    const woButton = isTBD || m.bye ? ''
        : `<div class="bracket-wo" style="text-align: center; margin-top: 2px;">
            <button type="button" class="btn btn-danger" style="padding: 2px 8px; font-size: 11px;" onclick="bracketDeclareWO(this)">🚫 W.O.</button>
            ${m.wo ? '<span style="font-size: 11px; color: var(--danger); margin-left: 6px;">W.O. registrado</span>' : ''}
        </div>`;
    const byeNote = m.bye
        ? '<div style="text-align: center; font-size: 11px; color: var(--text-muted); margin-top: 2px;">Bye: avanza directo a la próxima ronda</div>'
        : '';
    return `
        <div class="bracket-match" data-round="${rIdx}" data-match="${mIdx}" data-bracket="${bracket.id || ''}">
            ${renderBracketPlayerHTML(m, 0)}
            ${renderBracketPlayerHTML(m, 1)}
            ${woButton}
            ${byeNote}
        </div>
    `;
}

function renderBracketPlayerHTML(m, side) {
    const p = side === 0 ? m.p1 : m.p2;
    const sets = m.sets[side === 0 ? 'p1' : 'p2'];
    const won = m.completed && m.winnerSide === side;
    const isTBD = /^tbd$/i.test(p.name);
    const setInputs = isTBD || m.bye ? ''
        : sets.map((v, i) =>
            `<input class="bracket-set" data-side="${side}" data-set="${i}" value="${v}" maxlength="2" placeholder="-" ${m.wo ? 'readonly' : ''} onchange="bracketSetInput(this)">`
        ).join('');

    return `
        <div class="bracket-player ${won ? 'winner' : ''}">
            <div class="bp-info">
                <span><strong>${isTBD ? '·' : '#' + p.seed}</strong> ${escHtml(p.name)}${won ? ' 🏆' : ''}</span>
                <span style="font-size: 12px; color: var(--text-muted);">${escHtml(p.club)}</span>
            </div>
            <div class="bp-sets">${setInputs}</div>
        </div>
    `;
}

/**
 * Ubica la llave que contiene el partido [rIdx][mIdx]. Si el elemento
 * expone data-bracket (id), se usa para no confundir llaves de distinta
 * categoría que tengan la misma forma.
 */
function findBracketByRoundMatch(rIdx, mIdx, bracketId) {
    const list = tournamentData.brackets || [];
    if (bracketId) {
        const b = list.find(x => String(x.id) === String(bracketId));
        if (b && b.rounds && b.rounds[rIdx] && b.rounds[rIdx].matches[mIdx]) return b;
    }
    return list.find(b => b.rounds && b.rounds[rIdx] && b.rounds[rIdx].matches[mIdx]);
}

/**
 * Handler de los inputs de set dentro de la llave.
 */
window.bracketSetInput = function(input) {
    const matchEl = input.closest('.bracket-match');
    if (!matchEl) return;
    const rIdx = parseInt(matchEl.getAttribute('data-round'));
    const mIdx = parseInt(matchEl.getAttribute('data-match'));
    const bracketId = matchEl.getAttribute('data-bracket');
    const bracket = findBracketByRoundMatch(rIdx, mIdx, bracketId);
    if (!bracket) return;
    const m = bracket.rounds[rIdx].matches[mIdx];
    if (m.wo) return;

    const side = parseInt(input.getAttribute('data-side'));
    const setIdx = parseInt(input.getAttribute('data-set'));
    const raw = input.value.trim();
    const val = raw === '' ? '' : Math.max(0, parseInt(raw) || 0);
    m.sets[side === 0 ? 'p1' : 'p2'][setIdx] = val === '' ? '' : String(val);

    const wasCompleted = m.completed;
    const winnerSide = computeBracketMatch(bracket, rIdx, mIdx);
    // Re-derivar la cola de la llave: editar el resultado de un partido ya
    // completado (o vaciarlo) debe actualizar las rondas siguientes, no
    // quedarse con el ganador anterior en el slot de la ronda posterior.
    if (wasCompleted || m.completed) {
        repropagateBracketFrom(bracket, rIdx, mIdx);
    }

    saveTournamentData();
    renderBracketInteractive(bracket, bracket.categoria);
    if (typeof updateDashboard === 'function') updateDashboard();
};

/**
 * Re-deriva la llave desde la ronda rIdx hacia abajo tras editar, declarar o
 * quitar un resultado: limpia a TBD los slots de rondas posteriores que aún
 * no se jugaron y vuelve a avanzar los ganadores de TODOS los partidos
 * completados (incluyendo byes de primera ronda), en orden de ronda.
 * Esto corrige el caso en que editar una llave completada dejaba el ganador
 * anterior en la ronda siguiente (setBracketPlayer con force=false lo
 * rechazaba) y duplicaba jugadores en Final/Bronce.
 */
function repropagateBracketFrom(bracket, rIdx, mIdx) {
    const rounds = bracket.rounds;
    if (!rounds) return;
    const tbd = () => ({ name: 'TBD', club: 'TBD', seed: '-' });

    // 1) Limpiar a TBD los slots de rondas posteriores que aún no se jugaron
    //    (incluido el Tercer Puesto).
    for (let r = rIdx + 1; r < rounds.length; r++) {
        rounds[r].matches.forEach(mm => {
            if (mm.completed) return; // partidos ya jugados más abajo no se tocan
            if (!mm.p1 || !/^tbd$/i.test(mm.p1.name)) mm.p1 = tbd();
            if (!mm.p2 || !/^tbd$/i.test(mm.p2.name)) mm.p2 = tbd();
        });
    }

    // 2) Re-avanzar en orden de ronda los partidos completados con ganador.
    for (let r = 0; r < rounds.length; r++) {
        rounds[r].matches.forEach((mm, i) => {
            if (mm.completed && mm.winner && mm.winnerSide >= 0) {
                advanceBracketWinner(bracket, r, i, mm.winnerSide);
            }
        });
    }
}

function computeBracketMatch(bracket, rIdx, mIdx) {
    const m = bracket.rounds[rIdx].matches[mIdx];
    const s1 = m.sets.p1 || [], s2 = m.sets.p2 || [];

    // Un partido declarado W.O. tiene ganador directo por incomparecencia
    if (m.wo) {
        m.completed = true;
        m.winnerSide = m.woWinnerSide === 1 ? 1 : 0;
        m.winner = m.winnerSide === 0 ? m.p1 : m.p2;
        return m.winnerSide;
    }

    const formato = window.ITTFRULES.bracketFormat();
    const w = window.ITTFRULES.matchWinnerBySets(s1, s2, formato);
    const winnerSide = w === 1 ? 0 : w === -1 ? 1 : -1;
    m.completed = winnerSide >= 0;
    m.winnerSide = winnerSide;
    m.winner = winnerSide >= 0 ? (winnerSide === 0 ? m.p1 : m.p2) : null;
    return winnerSide;
}

/**
 * Avanza ganadores a la ronda siguiente y perdedores de semifinal al bronce.
 */
function advanceBracketWinner(bracket, rIdx, mIdx, winnerSide) {
    const rounds = bracket.rounds;
    const m = rounds[rIdx].matches[mIdx];
    const winner = winnerSide === 0 ? m.p1 : m.p2;
    const loser = winnerSide === 0 ? m.p2 : m.p1;
    const isSemi = /semifinal/i.test(rounds[rIdx].title);

    if (isSemi) {
        // Buscar la ronda EXACTA de la Final (no "Cuartos de Final"/
        // "Octavos de Final" que también contienen "final").
        const final = rounds.find(r => /^final$/i.test(String(r.title).trim()));
        if (final && final.matches[0] && !/^tbd$/i.test(winner.name)) {
            setBracketPlayer(final.matches[0], mIdx % 2, winner, false);
        }
        const bronze = rounds.find(r => /tercer/i.test(r.title));
        if (bronze && bronze.matches[0] && !/^tbd$/i.test(loser.name)) {
            setBracketPlayer(bronze.matches[0], mIdx % 2, loser, true);
        }
        return;
    }

    const next = rounds[rIdx + 1];
    if (!next || /tercer/i.test(next.title)) return;
    const nextMatch = next.matches[Math.floor(mIdx / 2)];
    if (!nextMatch) return;
    if (!/^tbd$/i.test(winner.name)) {
        setBracketPlayer(nextMatch, mIdx % 2, winner, false);
    }
}

function setBracketPlayer(match, side, player, force) {
    if (!match || !player) return;
    const current = side === 0 ? match.p1 : match.p2;
    if (!force && !/^tbd$/i.test(current.name)) return;
    const p = { name: player.name, club: player.club, seed: player.seed || '-' };
    if (side === 0) match.p1 = p;
    else match.p2 = p;
}

// ==========================================
// W.O. EN LLAVES (INCOMPARECENCIA)
// ==========================================

/**
 * Declara (o quita) un W.O. en un partido de llave. El rival del ausente
 * avanza a la ronda siguiente con 11-0 en todos los sets del formato.
 */
window.bracketDeclareWO = function(btn) {
    const matchEl = btn.closest('.bracket-match');
    if (!matchEl) return;
    const rIdx = parseInt(matchEl.getAttribute('data-round'));
    const mIdx = parseInt(matchEl.getAttribute('data-match'));
    const bracketId = matchEl.getAttribute('data-bracket');
    if (isNaN(rIdx) || isNaN(mIdx)) return;

    const bracket = findBracketByRoundMatch(rIdx, mIdx, bracketId);
    if (!bracket) return;
    const m = bracket.rounds[rIdx].matches[mIdx];
    if (!m.p1 || !m.p2 || /^tbd$/i.test(m.p1.name) || /^tbd$/i.test(m.p2.name)) return;

    // Si ya hay un W.O. declarado, ofrecer quitarlo
    if (m.wo) {
        showModal(
            'Quitar W.O.',
            '<p style="color: var(--text-color);">Este partido está marcado como W.O. ¿Querés quitarlo y volver a editarlo normalmente?</p>',
            () => undoBracketWO(bracket, rIdx, mIdx)
        );
        return;
    }

    showModal(
        'Declarar W.O. (incomparecencia)',
        '<p style="color: var(--text-color);">Indicá quién <strong>NO se presentó</strong>. El rival avanza por incomparecencia con 11-0 en todos los sets.</p>' +
        '<select id="bracket-wo-select" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">' +
            `<option value="0">${escHtml(m.p2.name)} no se presentó → avanza ${escHtml(m.p1.name)}</option>` +
            `<option value="1">${escHtml(m.p1.name)} no se presentó → avanza ${escHtml(m.p2.name)}</option>` +
        '</select>',
        () => {
            const ws = parseInt(document.getElementById('bracket-wo-select').value);
            applyBracketWO(bracket, rIdx, mIdx, ws);
        }
    );
};

function applyBracketWO(bracket, rIdx, mIdx, winnerSide) {
    const m = bracket.rounds[rIdx].matches[mIdx];
    const need = window.ITTFRULES.setsToWin(window.ITTFRULES.bracketFormat());
    m.sets.p1 = m.sets.p1 || [];
    m.sets.p2 = m.sets.p2 || [];
    for (let i = 0; i < need; i++) {
        m.sets.p1[i] = winnerSide === 0 ? '11' : '0';
        m.sets.p2[i] = winnerSide === 0 ? '0' : '11';
    }
    m.wo = true;
    m.woWinnerSide = winnerSide;

    const computed = computeBracketMatch(bracket, rIdx, mIdx);
    repropagateBracketFrom(bracket, rIdx, mIdx);

    saveTournamentData();
    renderBracketInteractive(bracket, bracket.categoria);
    if (typeof updateDashboard === 'function') updateDashboard();
    showToast('W.O. registrado: avanza ' + (computed === 0 ? m.p1.name : m.p2.name) + '.');
}

function undoBracketWO(bracket, rIdx, mIdx) {
    const m = bracket.rounds[rIdx].matches[mIdx];
    // Restaurar los inputs de sets (slots según el formato del torneo)
    const empty = emptyBracketSets();
    m.sets.p1 = empty.p1;
    m.sets.p2 = empty.p2;
    m.wo = false;
    delete m.woWinnerSide;
    m.completed = false;
    m.winnerSide = -1;
    m.winner = null;

    // Quitar el W.O. debe DES-avanzar al ganador que había quedado en la
    // ronda siguiente: re-derivar la cola vuelve a calcular quién corresponde.
    repropagateBracketFrom(bracket, rIdx, mIdx);

    saveTournamentData();
    renderBracketInteractive(bracket, bracket.categoria);
    if (typeof updateDashboard === 'function') updateDashboard();
    showToast('W.O. quitado.');
}

/**
 * Devuelve el resultado de la llave de una categoría (si está definida).
 * @returns {Object|null} { champion, runnerUp, third } o null
 */
window.getBracketResults = function(categoria) {
    const b = (tournamentData.brackets || []).find(x => x.categoria === categoria && x.rounds && x.rounds.length);
    if (!b) return null;

    const final = b.rounds.find(r => /final/i.test(r.title) && !/tercer/i.test(r.title));
    if (!final || !final.matches[0] || !final.matches[0].completed) return null;

    const fm = final.matches[0];
    const res = {
        champion: fm.winnerSide === 0 ? fm.p1 : fm.p2,
        runnerUp: fm.winnerSide === 0 ? fm.p2 : fm.p1,
        third: null
    };

    const bronze = b.rounds.find(r => /tercer/i.test(r.title));
    if (bronze && bronze.matches[0] && bronze.matches[0].completed) {
        res.third = bronze.matches[0].winnerSide === 0 ? bronze.matches[0].p1 : bronze.matches[0].p2;
    }

    return res;
};

// ==========================================
// GENERACIÓN DE RONDAS DE BRACKET
// ==========================================

/**
 * Determina los jugadores que disputarían el partido por el tercer puesto
 * Asumiendo que los mejores seeds ganan sus respectivas semifinales.
 * @param {Array} players - Jugadores ordenados por seed en la primera ronda
 * @returns {Array} Los dos perdedores de semifinales, o vacío si no aplica
 */
function getThirdPlacePlayers(players) {
    if (!players || players.length < 3) return [];

    if (players.length === 3) {
        // Semis: (seed1 vs seed2) y (seed3 vs TBD) → 3er puesto: seed2 vs seed3
        return [players[1], players[2]];
    }

    // 4+ jugadores: los segundos de cada pareja de semifinales
    return [players[1], players[3]];
}

/**
 * Genera una ronda de bracket (HTML)
 * @param {string} title - Título de la ronda
 * @param {Array} players - Jugadores en esta ronda
 * @param {number} matchCount - Número de partidos en esta ronda
 */
window.generateBracketRound = function(title, players, matchCount) {
    let html = `<div class="bracket-round"><h4 style="text-align: center; color: var(--text-color);">${title}</h4>`;

    for (let i = 0; i < matchCount; i++) {
        const p1 = players[i * 2] || { name: 'TBD', club: '-', seed: '-' };
        const p2 = players[i * 2 + 1] || { name: 'TBD', club: '-', seed: '-' };

        html += `
            <div class="bracket-match">
                <div class="bracket-player">
                    <span><strong>#${p1.seed}</strong> ${escHtml(p1.name)}</span>
                    <span style="font-size: 12px; color: var(--text-muted);">${escHtml(p1.club)}</span>
                </div>
                <div class="bracket-player">
                    <span><strong>#${p2.seed}</strong> ${escHtml(p2.name)}</span>
                    <span style="font-size: 12px; color: var(--text-muted);">${escHtml(p2.club)}</span>
                </div>
            </div>
        `;
    }

    html += '</div>';
    return html;
};

// ==========================================
// LLAVES MANUALES
// ==========================================

/**
 * Crea una llave manual
 */
window.createManualBracket = function() {
    const numPlayers = parseInt(document.getElementById('manual-bracket-players').value);

    // Validación con mensaje claro
    if (!numPlayers || numPlayers < 2) {
        showModal(
            '⚠️ Error de Validación',
            `<div style="color: var(--text-color);">
                <p><strong>No se puede crear la llave manual.</strong></p>
                <div class="warn-box" style="margin: 15px 0;">
                    <strong>❌ Problema:</strong><br>
                    Debes seleccionar la cantidad de jugadores para la llave.
                </div>
                <div class="info-box" style="margin: 15px 0;">
                    <strong>✅ Solución:</strong><br>
                    Selecciona un número de jugadores del menú desplegable (2-16 jugadores)
                </div>
            </div>`,
            null
        );
        return;
    }

    // Crear modal para ingresar jugadores
    let playersInputHTML = '<div style="max-height: 400px; overflow-y: auto;">';

    for (let i = 0; i < numPlayers; i++) {
        playersInputHTML += `
            <div style="margin-bottom: 15px;">
                <label style="display: block; font-weight: bold; margin-bottom: 5px; color: var(--text-color);">
                    Jugador ${i + 1}:
                </label>
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px;">
                    <input type="text"
                           id="manual-player-name-${i}"
                           placeholder="Nombre y Apellido"
                           style="padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
                    <input type="text"
                           id="manual-player-club-${i}"
                           placeholder="Club"
                           style="padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
                </div>
            </div>
        `;
    }

    playersInputHTML += '</div>';

    showModal(
        '✏️ Crear Llave Manual',
        `<div style="color: var(--text-color);">
            <p style="margin-bottom: 20px;">Ingresa los nombres de los <strong>${numPlayers} jugadores</strong> que participarán en esta llave eliminatoria:</p>
            ${playersInputHTML}
            <div class="info-box" style="margin-top: 20px;">
                <strong>💡 Consejo:</strong> Puedes dejar algunos campos vacíos y completarlos después.
            </div>
        </div>`,
        () => {
            executeCreateManualBracket(numPlayers);
        }
    );
};

/**
 * Ejecuta la creación de llave manual
 * @param {number} numPlayers - Número de jugadores
 */
window.executeCreateManualBracket = function(numPlayers) {
    const players = [];
    let emptyCount = 0;

    for (let i = 0; i < numPlayers; i++) {
        const nameInput = document.getElementById(`manual-player-name-${i}`);
        const clubInput = document.getElementById(`manual-player-club-${i}`);

        const name = nameInput ? nameInput.value.trim() : '';
        const club = clubInput ? clubInput.value.trim() : '';

        if (!name && !club) {
            emptyCount++;
            players.push({
                name: 'TBD',
                club: '-',
                seed: i + 1
            });
        } else {
            players.push({
                name: name || 'TBD',
                club: club || '-',
                seed: i + 1
            });
        }
    }

    // Generar las llaves (interactivas, con playoff de bronce)
    const rounds = buildManualBracketRounds(players, numPlayers);

    if (!tournamentData.brackets) {
        tournamentData.brackets = [];
    }
    tournamentData.brackets = tournamentData.brackets.filter(b => b.categoria !== 'MANUAL');

    const bracketEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        categoria: 'MANUAL',
        numClasificados: numPlayers,
        clasificados: players,
        gruposOriginales: 0,
        rounds: rounds
    };
    tournamentData.brackets.push(bracketEntry);

    saveTournamentData();
    renderManualBracket(bracketEntry);

    showToast(`✅ Llave manual creada con ${numPlayers} jugadores`);
    addLog('LLAVE MANUAL', `Llave creada con ${numPlayers} jugadores (${emptyCount} por definir)`);
};

/**
 * Construye las rondas de una llave manual.
 * Usa la misma estructura de eliminación simple con byes que las llaves
 * automáticas: el tamaño de la llave es la potencia de 2 inmediatamente
 * superior (mínimo 2) y los byes se asignan a los primeros jugadores
 * (mejores seeds), por lo que cualquier cantidad de jugadores (3, 5, 6, 12,
 * ...) arma una llave completable sin partidos TBD imposibles.
 */
function buildManualBracketRounds(players, numPlayers) {
    let T = 2;
    while (T < numPlayers) T *= 2;

    let firstTitle, restTitles;
    if (T === 2) {
        firstTitle = 'Final';
        restTitles = [];
    } else if (T === 4) {
        firstTitle = 'Semifinales';
        restTitles = ['Final'];
    } else if (T === 8) {
        firstTitle = 'Cuartos de Final';
        restTitles = ['Semifinales', 'Final'];
    } else {
        firstTitle = 'Octavos de Final';
        restTitles = ['Cuartos de Final', 'Semifinales', 'Final'];
    }

    // Byes = T - numPlayers. Los primeros byes jugadores reciben bye
    // (avanzan directo); los restantes se parean en partidos reales.
    const byes = T - numPlayers;
    const realMatches = numPlayers - (T / 2);

    const rounds = [];
    const first = makeRound(firstTitle, T / 2);
    first.matches = [];
    let nextIdx = 0;
    // Partidos de bye: el jugador (byes) avanza sin jugar.
    for (let i = 0; i < byes; i++) {
        const p = players[i] || null;
        const m = newBracketMatch(p, null);
        m.bye = true;
        if (p) {
            m.completed = true;
            m.winnerSide = 0;
            m.winner = m.p1;
        }
        first.matches.push(m);
        nextIdx = i + 1;
    }
    // Partidos reales: parean a los jugadores restantes en orden.
    for (let r = 0; r < realMatches; r++) {
        const p1 = players[nextIdx] || null;
        const p2 = players[nextIdx + 1] || null;
        nextIdx += 2;
        first.matches.push(newBracketMatch(p1, p2));
    }
    rounds.push(first);

    restTitles.forEach(title => {
        const count = title === 'Octavos de Final' ? 8
            : title === 'Cuartos de Final' ? 4
            : title === 'Semifinales' ? 2
            : 1;
        const r = makeRound(title, count);
        r.matches = [];
        for (let i = 0; i < count; i++) r.matches.push(newBracketMatch(null, null));
        rounds.push(r);
    });

    // Avanzar los byes directos de la primera ronda a sus posiciones
    first.matches.forEach((m, mIdx) => {
        if (m.bye && m.completed) {
            advanceBracketWinner({ rounds }, 0, mIdx, m.winnerSide);
        }
    });

    // Playoff de bronce: los perdedores de semifinales juegan el 3° puesto.
    if (numPlayers >= 4) {
        const pred = getThirdPlacePlayers(players);
        const bronze = makeRound('Tercer Puesto', 1);
        bronze.matches = [newBracketMatch(pred[0] || null, pred[1] || null)];
        rounds.push(bronze);
    }

    return rounds;
}

/**
 * Renderiza una llave manual interactiva.
 */
function renderManualBracket(bracket) {
    const output = document.getElementById('brackets-output');
    if (!output) return;
    output.innerHTML = renderManualBracketHTML(bracket);
}

// ==========================================
// VERIFICACIÓN DE DISPONIBILIDAD
// ==========================================

/**
 * Re-renderiza todas las llaves guardadas en el contenedor de brackets.
 * Se invoca al abrir la pestaña de Brackets para que las llaves persistidas
 * (con sus resultados) vuelvan a mostrarse.
 */
window.renderBracketsForTab = function() {
    const output = document.getElementById('brackets-output');
    if (!output) return;
    const list = (tournamentData.brackets || []).filter(b => b && b.rounds && b.rounds.length);
    if (list.length === 0) {
        output.innerHTML = '';
        return;
    }
    let html = '';
    list.forEach(bracket => {
        if (bracket.categoria === 'MANUAL') {
            html += renderManualBracketHTML(bracket);
        } else {
            html += renderBracketInteractiveHTML(bracket);
        }
    });
    output.innerHTML = html;
};

/**
 * Genera el HTML de una llave interactiva (automática) completa.
 */
function renderBracketInteractiveHTML(bracket) {
    const categoria = bracket.categoria || '';
    let html = `<div class="form-section">
        <h3>🏆 Llaves Eliminatorias - ${escHtml(categoria)}</h3>
        <div class="success-box" style="margin-bottom: 15px;">
            <strong>✅ Llaves generadas automáticamente</strong><br>
            <span style="font-size: 13px;">Total de clasificados: ${bracket.numClasificados} | Grupos procesados: ${bracket.gruposOriginales}</span>
        </div>
        <div class="info-box" style="margin-bottom: 15px;">
            <strong>✏️ Cómo cargar resultados:</strong> ingresá el tanteador de cada set (se gana con 11 puntos y 2 de diferencia; en el deuce se sigue hasta sacar 2). El formato de partido es ${window.ITTFRULES.bracketFormat().toUpperCase()} según la configuración. El sistema avanza automáticamente a los ganadores y arma el <strong>playoff de bronce</strong> con los perdedores de semifinales.
        </div>
    `;

    html += '<div class="bracket-container"><div class="bracket">';

    bracket.rounds.forEach((round, rIdx) => {
        html += `<div class="bracket-round"><h4 style="text-align: center; color: var(--text-color);">${round.title}</h4>`;
        round.matches.forEach((m, mIdx) => {
            html += renderBracketMatchHTML(bracket, rIdx, mIdx);
        });
        html += '</div>';
    });

    html += '</div></div>';

    // Tabla de clasificados
    html += '<div class="form-section" style="margin-top: 20px;">';
    html += '<h4>📋 Clasificados y Seeds</h4>';
    html += '<table class="data-table">';
    html += '<tr><th>Seed</th><th>Jugador</th><th>Club</th><th>Grupo</th><th>Posición</th><th>Puntos</th></tr>';
    (bracket.clasificados || []).forEach(player => {
        html += `
            <tr>
                <td><strong>#${player.seed}</strong></td>
                <td>${escHtml(player.name)}</td>
                <td>${escHtml(player.club)}</td>
                <td>Grupo ${player.grupo}</td>
                <td>${player.posicionGrupo}°</td>
                <td><strong>${player.points}</strong></td>
            </tr>
        `;
    });
    html += '</table></div>';

    html += '</div>';
    return html;
}

/**
 * Genera el HTML de una llave manual completa.
 */
function renderManualBracketHTML(bracket) {
    let html = '<div class="form-section"><h3>🏆 Llave Manual Generada</h3>';
    html += `<div class="info-box" style="margin-bottom: 15px;">
        <strong>✏️ Cómo cargar resultados:</strong> ingresá el tanteador de cada set (mejor de 5, gana el set quien llega a 11). El sistema avanza automáticamente a los ganadores y arma el <strong>playoff de bronce</strong> con los perdedores de semifinales.
    </div>`;
    html += '<div class="bracket-container"><div class="bracket">';

    bracket.rounds.forEach((round, rIdx) => {
        html += `<div class="bracket-round"><h4 style="text-align: center; color: var(--text-color);">${round.title}</h4>`;
        round.matches.forEach((m, mIdx) => {
            html += renderBracketMatchHTML(bracket, rIdx, mIdx);
        });
        html += '</div>';
    });

    html += '</div></div></div>';
    return html;
}

/**
 * Verifica si hay datos suficientes para generar llaves
 * @returns {Object} Objeto con información de disponibilidad
 */
window.checkBracketsAvailability = function() {
    const fixtures = tournamentData.fixtures;

    if (!fixtures || fixtures.length === 0) {
        return {
            available: false,
            message: 'No hay fixtures guardados'
        };
    }

    let totalWinners = 0;
    let categoriesCount = 0;

    const categoriesMap = {};
    fixtures.forEach(fixture => {
        if (!categoriesMap[fixture.categoria]) {
            categoriesMap[fixture.categoria] = 0;
            categoriesCount++;
        }

        const sortedPlayers = [...fixture.players].sort((a, b) => comparePlayersWithTiebreak(fixture, a, b));
        const winners = sortedPlayers.filter(p => p.name !== '-' && p.club !== '-' && p.points > 0).slice(0, 2);
        categoriesMap[fixture.categoria] += winners.length;
        totalWinners += winners.length;
    });

    if (totalWinners === 0) {
        return {
            available: false,
            message: 'No hay ganadores registrados en los fixtures'
        };
    }

    return {
        available: true,
        totalWinners,
        categoriesCount,
        categoriesMap
    };
};

