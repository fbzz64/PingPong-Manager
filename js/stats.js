// ==========================================
// STATS.JS - GESTIÓN DE ESTADÍSTICAS
// ==========================================
// Este archivo contiene todas las funciones relacionadas con:
// - Cálculo de estadísticas generales y avanzadas
// - Exportación de estadísticas a Excel
// - Actualización del dashboard
// - Visualización de estadísticas
// ==========================================

// ==========================================
// CÁLCULO DE ESTADÍSTICAS
// ==========================================

/**
 * Calcula las estadísticas individuales de todos los jugadores
 * a partir de los partidos completados.
 * @returns {Array} [{ name, club, setsPlayed, setsWon, setsLost, matchesWon, matchesLost, totalPoints }]
 */
function computePlayerStats() {
    const playerStats = {};

    // Personas reales de un lado del partido: en dobles/equipos, cada integrante;
    // en individual, el propio jugador. La puntuación se atribuye a cada uno.
    const sidePersons = p => {
        if (p && Array.isArray(p.members) && p.members.length >= 2) {
            return p.members.filter(m => m && m.name && m.name !== '-' && m.club && m.club !== '-');
        }
        return [{ name: p.name, club: p.club }];
    };

    const ensureStats = person => {
        const key = statsPlayerKey(person);
        if (!playerStats[key]) {
            playerStats[key] = {
                name: person.name,
                club: person.club,
                setsPlayed: 0,
                setsWon: 0,
                setsLost: 0,
                matchesWon: 0,
                matchesLost: 0,
                totalPoints: 0
            };
        }
        return playerStats[key];
    };

    tournamentData.fixtures.forEach(f => {
        (f.matches || []).forEach(match => {
            if (!match.completed) return;
            // Los partidos W.O. no son partidos jugados (reglamento 3.7.5):
            // no suman sets, puntos, partidos ganados ni rachas.
            if (match.wo) return;

            const p1 = match.player1;
            const p2 = match.player2;
            if (!p1 || !p2) return;

            const persons1 = sidePersons(p1);
            const persons2 = sidePersons(p2);

            const s1arr = (match.sets && match.sets.player1) || [];
            const s2arr = (match.sets && match.sets.player2) || [];

            // Solo cuentan sets válidos según el reglamento ITTF
            const p1SetsWon = window.ITTFRULES.countSetWins(s1arr, s2arr);
            const p2SetsWon = window.ITTFRULES.countSetWins(s2arr, s1arr);

            // Los sets de un partido W.O. no son sets jugados (reglamento 3.7.5):
            // no ingresan a cocientes ni a las estadísticas de sets/puntos.
            if (!match.wo) {
                for (let i = 0; i < Math.max(s1arr.length, s2arr.length, 5); i++) {
                    // Los sets persisten como STRINGS (inputs de la UI): parsear a
                    // número o getSetWinner/isValidSetScore los rechaza (setsWon/
                    // setsLost siempre 0) y totalPoints concatena ("0119...").
                    if (!window.ITTFRULES.setEntered(s1arr[i], s2arr[i])) continue;
                    const s1 = parseInt(s1arr[i], 10) || 0;
                    const s2 = parseInt(s2arr[i], 10) || 0;

                    if (s1 > 0 || s2 > 0) {
                        persons1.forEach(per => {
                            const st = ensureStats(per);
                            st.setsPlayed++;
                            st.totalPoints += s1;
                        });
                        persons2.forEach(per => {
                            const st = ensureStats(per);
                            st.setsPlayed++;
                            st.totalPoints += s2;
                        });

                        const win = window.ITTFRULES.getSetWinner(s1, s2);
                        if (win === 1) {
                            persons1.forEach(per => ensureStats(per).setsWon++);
                            persons2.forEach(per => ensureStats(per).setsLost++);
                        } else if (win === -1) {
                            persons2.forEach(per => ensureStats(per).setsWon++);
                            persons1.forEach(per => ensureStats(per).setsLost++);
                        }
                    }
                }
            }

            if (p1SetsWon > p2SetsWon) {
                persons1.forEach(per => ensureStats(per).matchesWon++);
                persons2.forEach(per => ensureStats(per).matchesLost++);
            } else if (p2SetsWon > p1SetsWon) {
                persons2.forEach(per => ensureStats(per).matchesWon++);
                persons1.forEach(per => ensureStats(per).matchesLost++);
            }
        });
    });

    return Object.values(playerStats);
}

/**
 * Calcula las rachas ganadoras/perdedoras y la forma reciente de cada jugador.
 * @returns {Array} [{ name, club, curType, curCount, longestW, longestL, form, currentLabel }]
 */
function computeStreakRows() {
    const map = {};
    const rows = [];
    const get = (key, name, club) => {
        if (!map[key]) {
            map[key] = { name, club, results: [] };
            rows.push(map[key]);
        }
        return map[key];
    };

    statsCompletedMatches().forEach(({ match: m }) => {
        const s1 = (m.sets && m.sets.player1) || [];
        const s2 = (m.sets && m.sets.player2) || [];
        const w1 = countSetWins(s1, s2);
        const w2 = countSetWins(s2, s1);
        if (w1 === w2) return;

        const r1 = get(statsPlayerKey(m.player1), m.player1.name, m.player1.club);
        const r2 = get(statsPlayerKey(m.player2), m.player2.name, m.player2.club);
        r1.results.push(w1 > w2);
        r2.results.push(w2 > w1);
    });

    return rows.map(r => {
        const res = r.results;
        let curType = null;
        let curCount = 0;
        if (res.length) {
            curType = res[res.length - 1] ? 'W' : 'L';
            curCount = 1;
            for (let i = res.length - 2; i >= 0 && res[i] === (curType === 'W'); i--) curCount++;
        }

        let longestW = 0, longestL = 0, cw = 0, cl = 0;
        res.forEach(w => {
            if (w) { cw++; cl = 0; }
            else { cl++; cw = 0; }
            longestW = Math.max(longestW, cw);
            longestL = Math.max(longestL, cl);
        });

        const form = res.slice(-5).map(w => w
            ? '<span style="color: var(--success); font-weight: bold;">W</span>'
            : '<span style="color: var(--danger); font-weight: bold;">L</span>').join(' ');

        const currentLabel = curType
            ? (curType === 'W' ? '🔥 ' + curCount + ' G' : '💔 ' + curCount + ' P')
            : '—';

        return { name: r.name, club: r.club, curType, curCount, longestW, longestL, form, currentLabel };
    }).sort((a, b) => b.curCount - a.curCount || b.longestW - a.longestW);
}

/**
 * Genera el HTML de la tabla de rachas y forma reciente.
 */
function renderStreaksHTML() {
    const rows = computeStreakRows();
    if (rows.length === 0) return '';

    let html = '<div class="form-section"><h3>🔥 Rachas y Forma Reciente</h3>';
    html += '<table class="data-table"><tr><th>Jugador</th><th>Club</th><th>Racha actual</th><th>Mejor racha (G)</th><th>Mejor racha (P)</th><th>Forma reciente</th></tr>';
    rows.forEach(r => {
        html += '<tr><td>' + statsEsc(r.name) + '</td><td>' + statsEsc(r.club) + '</td><td>' + r.currentLabel + '</td><td>' + r.longestW + '</td><td>' + r.longestL + '</td><td>' + r.form + '</td></tr>';
    });
    html += '</table></div>';
    return html;
}

/**
 * Calcula todas las estadísticas del torneo
 */
window.calculateStats = function() {
    const output = document.getElementById('stats-output');
    if (!output) return;

    if (typeof populateH2HSelects === 'function') populateH2HSelects();

    if (tournamentData.fixtures.length === 0) {
        output.innerHTML = '<div class="alert alert-info">No hay datos suficientes para generar estadísticas.</div>';
        return;
    }

    const statsArray = computePlayerStats();

    let html = '<div class="form-section"><h3>📊 Estadísticas Generales</h3>';
    html += '<table class="data-table">';
    html += '<tr><th>Jugador</th><th>Club</th><th>Partidos Ganados</th><th>Sets Ganados</th><th>Sets Perdidos</th><th>Diferencia</th><th>Sets Jugados</th><th>Puntos Totales</th></tr>';

    statsArray.sort((a, b) => b.setsWon - a.setsWon).forEach(stat => {
        html += `
            <tr>
                <td>${escHtml(stat.name)}</td>
                <td>${escHtml(stat.club)}</td>
                <td>${stat.matchesWon}</td>
                <td>${stat.setsWon}</td>
                <td>${stat.setsLost}</td>
                <td style="font-weight: bold; color: ${stat.setsWon - stat.setsLost >= 0 ? 'var(--success)' : 'var(--danger)'}">${stat.setsWon - stat.setsLost > 0 ? '+' : ''}${stat.setsWon - stat.setsLost}</td>
                <td>${stat.setsPlayed}</td>
                <td>${stat.totalPoints}</td>
            </tr>
        `;
    });
    html += '</table></div>';

    html += '<div class="form-section"><h3>🏆 Mejores Performances</h3>';
    html += '<div class="dashboard-grid">';

    const mostSetsPlayed = statsArray.sort((a, b) => b.setsPlayed - a.setsPlayed)[0];
    const mostSetsWon = statsArray.sort((a, b) => b.setsWon - a.setsWon)[0];
    const bestDiff = statsArray.sort((a, b) => (b.setsWon - b.setsLost) - (a.setsWon - a.setsLost))[0];

    html += `
        <div class="stat-card">
            <h4>🎾 Más Sets Jugados</h4>
            <div class="stat-value">${mostSetsPlayed ? mostSetsPlayed.setsPlayed : 0}</div>
            <div class="stat-label">${mostSetsPlayed ? mostSetsPlayed.name : '-'}</div>
        </div>
        <div class="stat-card">
            <h4>🏅 Más Sets Ganados</h4>
            <div class="stat-value">${mostSetsWon ? mostSetsWon.setsWon : 0}</div>
            <div class="stat-label">${mostSetsWon ? mostSetsWon.name : '-'}</div>
        </div>
        <div class="stat-card">
            <h4>⭐ Mejor Diferencia</h4>
            <div class="stat-value">${bestDiff ? (bestDiff.setsWon - bestDiff.setsLost > 0 ? '+' : '') + (bestDiff.setsWon - bestDiff.setsLost) : 0}</div>
            <div class="stat-label">${bestDiff ? bestDiff.name : '-'}</div>
        </div>
    `;
    html += '</div></div>';

    html += renderStreaksHTML();
    output.innerHTML = html;

    // Gráficos (charts.js)
    const chartsBox = document.createElement('div');
    chartsBox.className = 'form-section';
    chartsBox.innerHTML = '<h3>📊 Gráficos</h3>';
    output.appendChild(chartsBox);

    const chartsGrid = document.createElement('div');
    chartsGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 15px;';
    ['renderCategoryChart', 'renderClubWinRateChart', 'renderPointsEvolutionChart'].forEach(fn => {
        const box = document.createElement('div');
        if (typeof window[fn] === 'function') window[fn](box);
        chartsGrid.appendChild(box);
    });
    chartsBox.appendChild(chartsGrid);

    addLog('ESTADÍSTICAS', 'Estadísticas calculadas y mostradas');
};

// ==========================================
// EXPORTACIÓN A EXCEL
// ==========================================

/**
 * Exporta las estadísticas a Excel
 */
window.exportStatsExcel = function() {
    if (typeof XLSX === 'undefined') {
        showToast('Librería Excel no disponible', 'error');
        return;
    }

    try {
        const wb = XLSX.utils.book_new();

        // Hoja 1: Fixtures
        const fixturesData = [['ID', 'Categoría', 'Grupo', 'Jugadores', 'Fecha']];
        tournamentData.fixtures.forEach(f => {
            fixturesData.push([
                f.id,
                f.categoria,
                f.grupo,
                f.players.length,
                new Date(f.timestamp).toLocaleString(window.i18nLocale())
            ]);
        });
        const ws1 = XLSX.utils.aoa_to_sheet(fixturesData);
        XLSX.utils.book_append_sheet(wb, ws1, 'Fixtures');

        // Hoja 2: Jugadores
        const playersData = [['Nombre', 'Club', 'Categorías']];
        tournamentData.players.forEach(p => {
            playersData.push([
                p.name,
                p.club,
                p.categories ? p.categories.join(', ') : '-'
            ]);
        });
        const ws2 = XLSX.utils.aoa_to_sheet(playersData);
        XLSX.utils.book_append_sheet(wb, ws2, 'Jugadores');

        // Hoja 3: Participación por categoría
        const catCounts = {};
        statsValidPlayers().forEach(p => (p.categories || []).forEach(c => catCounts[c] = (catCounts[c] || 0) + 1));
        const catData = [['Categoría', 'Jugadores']].concat(Object.keys(catCounts).map(c => [c, catCounts[c]]));
        const ws3 = XLSX.utils.aoa_to_sheet(catData);
        XLSX.utils.book_append_sheet(wb, ws3, 'Categorías');

        // Hoja 4: Rachas y forma reciente
        const streakRows = computeStreakRows();
        const streakData = [['Jugador', 'Club', 'Racha actual', 'Mejor racha (G)', 'Mejor racha (P)']];
        streakRows.forEach(r => {
            streakData.push([r.name, r.club, r.curType === 'W' ? r.curCount + ' G' : (r.curType === 'L' ? r.curCount + ' P' : '-'), r.longestW, r.longestL]);
        });
        const ws4 = XLSX.utils.aoa_to_sheet(streakData);
        XLSX.utils.book_append_sheet(wb, ws4, 'Rachas');

        const filename = `Estadisticas_Torneo_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
        showToast(`Archivo Excel generado: ${filename}`);
        addLog('EXPORTAR EXCEL', 'Estadísticas exportadas a Excel');
    } catch (error) {
        console.error('Error al exportar Excel:', error);
        showToast('Error al exportar a Excel', 'error');
    }
};

// ==========================================
// EXPORTACIÓN DE RESULTADOS A CSV (por categoría)
// ==========================================

/**
 * Escapa un valor para una celda CSV (comilla doble y separadores).
 * @param {*} v
 * @returns {string}
 */
function csvCell(v) {
    const s = String(v == null ? '' : v).replace(/\r?\n/g, ' ');
    return '"' + s.replace(/"/g, '""') + '"';
}

/**
 * Número de columnas de sets para un formato de partido (BO3/BO5/BO7).
 */
function csvSetColumns(formato) {
    const f = formato || 'bo5';
    if (f === 'bo3') return 3;
    if (f === 'bo7') return 7;
    return 5;
}

/**
 * Arma las filas CSV de resultados de un fixture (un renglón por partido).
 * @param {Object} fixture
 * @param {number} numSets - columnas de sets a emitir
 * @returns {Array<string>}
 */
function fixtureResultsCSVRows(fixture, numSets) {
    const rows = [];
    (fixture.matches || []).forEach(m => {
        if (!m || !m.player1 || !m.player2) return;
        const p1 = m.player1;
        const p2 = m.player2;
        const s1 = (m.sets && m.sets.player1) || [];
        const s2 = (m.sets && m.sets.player2) || [];

        const setCells = [];
        for (let i = 0; i < numSets; i++) {
            setCells.push(csvCell(s1[i] || ''));
            setCells.push(csvCell(s2[i] || ''));
        }

        const w1 = countSetWins(s1, s2);
        const w2 = countSetWins(s2, s1);
        let estado, ganador;
        if (m.wo) {
            estado = 'W.O.';
            ganador = m.woWinnerSide === 2 ? p2.name : p1.name;
        } else if (m.completed && w1 !== w2) {
            estado = 'Finalizado';
            ganador = w1 > w2 ? p1.name : p2.name;
        } else {
            estado = 'Pendiente';
            ganador = '';
        }

        rows.push([
            csvCell(fixture.grupo || ''),
            csvCell(m.match || ''),
            csvCell(p1.name),
            csvCell(p1.club),
            csvCell(p2.name),
            csvCell(p2.club),
            ...setCells,
            csvCell(m.referee || ''),
            csvCell(ganador),
            csvCell(estado)
        ].join(';'));
    });
    return rows;
}

/**
 * Exporta los resultados de todos los fixtures a CSV, agrupados por categoría.
 * Compatible con Excel (separador ';' + BOM UTF-8).
 */
window.exportResultsCSV = function() {
    const fixtures = tournamentData.fixtures || [];
    if (fixtures.length === 0) {
        showToast('No hay fixtures guardados para exportar', 'warning');
        return;
    }

    try {
        const lines = [];

        // Agrupar por categoría preservando el orden de aparición
        const byCategory = {};
        fixtures.forEach(f => {
            const cat = f.categoria || 'GENERAL';
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(f);
        });

        Object.keys(byCategory).forEach(cat => {
            const catFixtures = byCategory[cat];
            const numSets = Math.max(3, ...catFixtures.map(f =>
                csvSetColumns((f.matches || [])[0] && (f.matches[0].formato || f.matches[0].sets && f.matches[0].sets.player1.length)))
            );

            lines.push(csvCell('CATEGORÍA: ' + cat));
            const header = ['Grupo', 'Partido', 'Jugador A', 'Club A', 'Jugador B', 'Club B'];
            for (let i = 1; i <= numSets; i++) {
                header.push('Set ' + i + ' A', 'Set ' + i + ' B');
            }
            header.push('Árbitro', 'Ganador', 'Estado');
            lines.push(header.map(csvCell).join(';'));

            catFixtures.forEach(f => {
                fixtureResultsCSVRows(f, numSets).forEach(r => lines.push(r));
            });

            lines.push('');
        });

        const csv = '\uFEFF' + lines.join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Resultados_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addLog('EXPORTAR CSV', `Resultados exportados a CSV (${fixtures.length} fixtures)`);
        showToast('Resultados exportados a CSV');
    } catch (error) {
        console.error('Error al exportar CSV:', error);
        showToast('Error al exportar CSV', 'error');
    }
};

// ==========================================
// HISTORIAL CARA A CARA (H2H)
// ==========================================

/**
 * Devuelve el historial completo entre dos jugadores a lo largo de todos los fixtures.
 * @param {String} aKey - Clave "nombre|club" del jugador A
 * @param {String} bKey - Clave "nombre|club" del jugador B
 */
function computeH2H(aKey, bKey) {
    const partsA = aKey.split('|');
    const partsB = bKey.split('|');
    const an = partsA[0], ac = partsA[1] || '';
    const bn = partsB[0], bc = partsB[1] || '';

    const result = { matches: [], aWins: 0, bWins: 0, aSetsWon: 0, bSetsWon: 0 };

    statsCompletedMatches().forEach(({ fixture: f, match: m }) => {
        if (m.wo) return; // los sets de un W.O. no son sets jugados (3.7.5)
        const isA1 = m.player1.name === an && m.player1.club === ac && m.player2.name === bn && m.player2.club === bc;
        const isB1 = m.player1.name === bn && m.player1.club === bc && m.player2.name === an && m.player2.club === ac;
        if (!isA1 && !isB1) return;

        const s1 = (m.sets && m.sets.player1) || [];
        const s2 = (m.sets && m.sets.player2) || [];
        const aSets = isA1 ? countSetWins(s1, s2) : countSetWins(s2, s1);
        const bSets = isB1 ? countSetWins(s1, s2) : countSetWins(s2, s1);

        result.aSetsWon += aSets;
        result.bSetsWon += bSets;

        let winner = 'D';
        if (aSets > bSets) { winner = 'A'; result.aWins++; }
        else if (bSets > aSets) { winner = 'B'; result.bWins++; }

        result.matches.push({
            date: new Date(f.timestamp).toLocaleDateString(window.i18nLocale()),
            categoria: f.categoria,
            grupo: f.grupo,
            sets1: isA1 ? s1 : s2,
            sets2: isA1 ? s2 : s1,
            winner
        });
    });

    return result;
}

/**
 * Busca un jugador a partir de su clave "nombre|club".
 */
function h2hFindPlayer(key) {
    const parts = key.split('|');
    return (tournamentData.players || []).find(p => p.name === parts[0] && p.club === (parts[1] || ''));
}

/**
 * Llena los selectores de jugadores de la sección H2H.
 */
window.populateH2HSelects = function() {
    const a = document.getElementById('h2h-player-a');
    const b = document.getElementById('h2h-player-b');
    if (!a || !b) return;

    const prevA = a.value;
    const prevB = b.value;
    const players = statsValidPlayers().sort((x, y) => x.name.localeCompare(y.name));
    const opts = players.map(p =>
        '<option value="' + statsEsc(p.name + '|' + p.club) + '">' + statsEsc(p.name) + ' (' + statsEsc(p.club) + ')</option>'
    ).join('');

    a.innerHTML = opts;
    b.innerHTML = opts;
    if (prevA) a.value = prevA;
    if (prevB) b.value = prevB;
    if (!a.value && players.length) a.selectedIndex = 0;
    if (!b.value && players.length > 1) b.selectedIndex = 1;
};

/**
 * Muestra el historial cara a cara entre los dos jugadores seleccionados.
 */
window.showH2HResult = function() {
    const a = document.getElementById('h2h-player-a');
    const b = document.getElementById('h2h-player-b');
    const out = document.getElementById('h2h-output');
    if (!a || !b || !out) return;

    const aKey = a.value;
    const bKey = b.value;
    if (!aKey || !bKey) {
        out.innerHTML = '<p style="color: var(--text-muted);">Seleccioná dos jugadores.</p>';
        return;
    }
    if (aKey === bKey) {
        showToast('Seleccioná dos jugadores distintos', 'error');
        return;
    }

    const playerA = h2hFindPlayer(aKey);
    const playerB = h2hFindPlayer(bKey);
    if (!playerA || !playerB) {
        out.innerHTML = '<p style="color: var(--danger);">Jugadores no encontrados.</p>';
        return;
    }

    const h = computeH2H(aKey, bKey);
    if (h.matches.length === 0) {
        out.innerHTML = '<p style="color: var(--text-muted);">No hay partidos entre ' + statsEsc(playerA.name) + ' y ' + statsEsc(playerB.name) + '.</p>';
        return;
    }

    const shortA = statsEsc(playerA.name.split(' ')[0]);
    const shortB = statsEsc(playerB.name.split(' ')[0]);

    let html = '<h4 style="margin-top: 10px;">🤝 ' + statsEsc(playerA.name) + ' vs ' + statsEsc(playerB.name) + '</h4>';
    html += '<div class="dashboard-grid" style="margin: 10px 0;">';
    html += '<div class="stat-card"><h4>Partidos</h4><div class="stat-value">' + h.matches.length + '</div><div class="stat-label">total jugados</div></div>';
    html += '<div class="stat-card"><h4>Gana ' + shortA + '</h4><div class="stat-value">' + h.aWins + '</div><div class="stat-label">' + h.aSetsWon + ' sets a favor</div></div>';
    html += '<div class="stat-card"><h4>Gana ' + shortB + '</h4><div class="stat-value">' + h.bWins + '</div><div class="stat-label">' + h.bSetsWon + ' sets a favor</div></div>';
    html += '</div>';

    html += '<table class="data-table"><tr><th>Fecha</th><th>Categoría</th><th>Grupo</th><th>Resultado (sets)</th><th>Ganador</th></tr>';
    h.matches.forEach(entry => {
        const res = entry.sets1.map((v, i) => v + '-' + (entry.sets2[i] || 0)).join(', ');
        let winner = 'Empate';
        if (entry.winner === 'A') winner = '<span style="font-weight: bold; color: var(--success);">' + statsEsc(playerA.name) + '</span>';
        else if (entry.winner === 'B') winner = '<span style="font-weight: bold; color: var(--success);">' + statsEsc(playerB.name) + '</span>';
        html += '<tr><td>' + statsEsc(entry.date) + '</td><td>' + statsEsc(entry.categoria) + '</td><td>' + statsEsc(entry.grupo) + '</td><td>' + res + '</td><td>' + winner + '</td></tr>';
    });
    html += '</table>';

    out.innerHTML = html;
    addLog('H2H', 'Historial entre ' + playerA.name + ' y ' + playerB.name);
};

// ==========================================
// COMPARADOR DE JUGADORES
// ==========================================

/**
 * Arma un resumen comparable de un jugador a partir de su registro y de las
 * estadísticas agregadas del torneo.
 * @param {Object} player
 * @param {Object|null} agg - entrada de computePlayerStats() o null
 */
function comparatorProfile(player, agg) {
    const history = (player.history || []);
    const mejor = history.reduce((best, h) => (h.posicion && (!best || h.posicion < best)) ? h.posicion : best, null);
    return {
        name: player.name,
        club: player.club,
        categories: (player.categories || []).slice(),
        elo: typeof player.elo === 'number' ? player.elo : (window.DEFAULT_ELO || 1200),
        edad: window.getPlayerAge && player.fechaNac ? window.getPlayerAge(player.fechaNac) : null,
        checkin: !!player.checkin,
        pj: agg ? agg.matchesWon + agg.matchesLost : 0,
        g: agg ? agg.matchesWon : 0,
        p: agg ? agg.matchesLost : 0,
        setsG: agg ? agg.setsWon : 0,
        setsP: agg ? agg.setsLost : 0,
        pts: agg ? agg.totalPoints : 0,
        torneos: history.length,
        mejor
    };
}

/**
 * Abre el comparador de dos jugadores (perfil + historial H2H previo).
 */
window.openPlayerComparator = function() {
    const players = statsValidPlayers().sort((x, y) => x.name.localeCompare(y.name));
    if (players.length < 2) {
        showToast('Se necesitan al menos 2 jugadores para comparar', 'warning');
        return;
    }
    const opts = players.map(p =>
        '<option value="' + statsEsc(p.name + '|' + p.club) + '">' + statsEsc(p.name) + ' (' + statsEsc(p.club) + ')</option>'
    ).join('');

    showModal(
        '⚖️ Comparador de Jugadores',
        '<div style="color: var(--text-color);">' +
            '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">' +
                '<div><label style="font-weight: bold; font-size: 13px;">Jugador A:</label>' +
                '<select id="cmp-player-a" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color); margin-top: 4px;">' + opts + '</select></div>' +
                '<div><label style="font-weight: bold; font-size: 13px;">Jugador B:</label>' +
                '<select id="cmp-player-b" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color); margin-top: 4px;">' + opts + '</select></div>' +
            '</div>' +
            '<button class="btn btn-primary" style="width: 100%; margin-top: 12px;" onclick="renderPlayerComparator()">⚖️ Comparar</button>' +
            '<div id="cmp-output" style="margin-top: 12px;"></div>' +
        '</div>',
        null,
        'Cerrar'
    );

    const selA = document.getElementById('cmp-player-a');
    const selB = document.getElementById('cmp-player-b');
    if (selA && selB) {
        if (players.length >= 1) selA.selectedIndex = 0;
        if (players.length >= 2) selB.selectedIndex = 1;
    }
};

/**
 * Renderiza la comparación entre los dos jugadores seleccionados.
 */
window.renderPlayerComparator = function() {
    const selA = document.getElementById('cmp-player-a');
    const selB = document.getElementById('cmp-player-b');
    const out = document.getElementById('cmp-output');
    if (!selA || !selB || !out) return;

    const aKey = selA.value;
    const bKey = selB.value;
    if (!aKey || !bKey || aKey === bKey) {
        out.innerHTML = '<p style="color: var(--text-muted);">Seleccioná dos jugadores distintos.</p>';
        return;
    }

    const aggMap = {};
    computePlayerStats().forEach(s => { aggMap[statsPlayerKey(s)] = s; });

    const pa = h2hFindPlayer(aKey);
    const pb = h2hFindPlayer(bKey);
    if (!pa || !pb) {
        out.innerHTML = '<p style="color: var(--danger);">Jugadores no encontrados.</p>';
        return;
    }

    const A = comparatorProfile(pa, aggMap[aKey] || null);
    const B = comparatorProfile(pb, aggMap[bKey] || null);
    const h = computeH2H(aKey, bKey);

    const esc = statsEsc;
    const win = (av, bv) => {
        if (typeof av === 'number' && typeof bv === 'number' && av !== bv) {
            return av > bv ? 'a' : 'b';
        }
        return null;
    };

    const rows = [];
    const push = (label, av, bv, w) => {
        const mark = (side) => w === side ? '<span style="color: var(--success); font-weight: bold;"> ✓</span>' : '';
        rows.push(`<tr><td style="font-weight: bold;">${label}</td>` +
            `<td style="text-align: center;${w === 'a' ? ' background: var(--surface-alt);' : ''}">${av}${mark('a')}</td>` +
            `<td style="text-align: center;${w === 'b' ? ' background: var(--surface-alt);' : ''}">${bv}${mark('b')}</td></tr>`);
    };

    push('Club', esc(A.club), esc(B.club), null);
    push('Categorías', esc(A.categories.join(', ') || '-'), esc(B.categories.join(', ') || '-'), null);
    push('Rating ELO', A.elo, B.elo, win(A.elo, B.elo));
    push('Edad', A.edad === null ? '—' : A.edad + ' años', B.edad === null ? '—' : B.edad + ' años', win(A.edad, B.edad));
    push('Check-in', A.checkin ? '✅ Presente' : '⬜ Ausente', B.checkin ? '✅ Presente' : '⬜ Ausente', null);
    push('Partidos jugados', A.pj, B.pj, win(A.pj, B.pj));
    push('Ganados', A.g, B.g, win(A.g, B.g));
    push('Perdidos', A.p, B.p, win(A.p, B.p));
    push('Efectividad', A.pj ? Math.round(A.g / A.pj * 100) + '%' : '—', B.pj ? Math.round(B.g / B.pj * 100) + '%' : '—', A.pj && B.pj ? win(Math.round(A.g / A.pj * 100), Math.round(B.g / B.pj * 100)) : null);
    push('Sets ganados', A.setsG, B.setsG, win(A.setsG, B.setsG));
    push('Sets perdidos', A.setsP, B.setsP, win(A.setsP, B.setsP));
    push('Diferencia de sets', (A.setsG - A.setsP) >= 0 ? '+' + (A.setsG - A.setsP) : (A.setsG - A.setsP), (B.setsG - B.setsP) >= 0 ? '+' + (B.setsG - B.setsP) : (B.setsG - B.setsP), win(A.setsG - A.setsP, B.setsG - B.setsP));
    push('Puntos a favor', A.pts, B.pts, win(A.pts, B.pts));
    push('Torneos jugados', A.torneos, B.torneos, win(A.torneos, B.torneos));
    push('Mejor puesto', A.mejor ? '#' + A.mejor : '—', B.mejor ? '#' + B.mejor : '—', A.mejor && B.mejor ? win(B.mejor, A.mejor) : null);

    let html = '<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">';
    html += '<h3 style="margin: 0; flex: 1;">⚖️ ' + esc(A.name) + ' <span style="color: var(--text-muted); font-size: 13px;">vs</span> ' + esc(B.name) + '</h3></div>';

    html += '<table class="data-table"><tr><th style="text-align: left;">Métrica</th><th style="text-align: center;">' + esc(A.name.split(' ')[0]) + '</th><th style="text-align: center;">' + esc(B.name.split(' ')[0]) + '</th></tr>';
    html += rows.join('');
    html += '</table>';

    html += '<h4 style="margin: 16px 0 8px 0;">🤝 Historial entre ellos</h4>';
    if (h.matches.length > 0) {
        html += '<div class="dashboard-grid" style="margin: 10px 0;">';
        html += '<div class="stat-card"><h4>Partidos</h4><div class="stat-value">' + h.matches.length + '</div><div class="stat-label">total jugados</div></div>';
        html += '<div class="stat-card"><h4>Gana ' + esc(A.name.split(' ')[0]) + '</h4><div class="stat-value">' + h.aWins + '</div><div class="stat-label">' + h.aSetsWon + ' sets a favor</div></div>';
        html += '<div class="stat-card"><h4>Gana ' + esc(B.name.split(' ')[0]) + '</h4><div class="stat-value">' + h.bWins + '</div><div class="stat-label">' + h.bSetsWon + ' sets a favor</div></div>';
        html += '</div>';
    } else {
        html += '<p style="color: var(--text-muted); font-style: italic; font-size: 13px;">Aún no se enfrentaron en este torneo.</p>';
    }

    out.innerHTML = html;
    addLog('COMPARADOR', 'Comparación entre ' + A.name + ' y ' + B.name);
};

// ==========================================
// EXPORTACIÓN A PDF (jsPDF)
// ==========================================

/**
 * Limpia emojis y caracteres no soportados por la fuente estándar de jsPDF.
 */
function pdfClean(s) {
    return String(s).replace(/[\u{1F000}-\u{1FFFF}\u2600-\u27BF\uFE0F]/gu, '').trim();
}

/**
 * Exporta las estadísticas a PDF usando jsPDF + autotable.
 */
window.exportStatsPDF = function() {
    if (typeof window.jspdf === 'undefined') {
        showToast('Librería PDF no disponible (se necesita conexión la primera vez)', 'error');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const torneo = (tournamentData.settings && tournamentData.settings.torneoNombre) || 'Torneo';
        const fecha = new Date().toISOString().split('T')[0];

        doc.setFontSize(18);
        doc.text('Estadísticas del Torneo', 14, 20);
        doc.setFontSize(11);
        doc.text(pdfClean('🏓 ' + torneo) || torneo, 14, 28);
        doc.text('Generado: ' + new Date().toLocaleString(window.i18nLocale()), 14, 34);
        doc.line(14, 38, 196, 38);

        let startY = 44;

        // 1) Estadísticas generales
        const stats = computePlayerStats();
        doc.setFontSize(13);
        doc.text('Estadísticas Generales', 14, startY);
        doc.autoTable({
            startY: startY + 2,
            head: [['Jugador', 'Club', 'PG', 'SG', 'SP', 'Dif', 'SJ', 'Pts']],
            body: stats.map(s => [s.name, s.club, s.matchesWon, s.setsWon, s.setsLost, s.setsWon - s.setsLost, s.setsPlayed, s.totalPoints]),
            styles: { fontSize: 9 },
            headStyles: { fillColor: [38, 74, 132] }
        });
        startY = doc.lastAutoTable.finalY + 10;

        // 2) Participación por categoría
        const catCounts = {};
        statsValidPlayers().forEach(p => (p.categories || []).forEach(c => catCounts[c] = (catCounts[c] || 0) + 1));
        const catRows = Object.keys(catCounts).map(c => [c, catCounts[c]]);
        doc.text('Participación por categoría', 14, startY);
        doc.autoTable({
            startY: startY + 2,
            head: [['Categoría', 'Jugadores']],
            body: catRows,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [42, 157, 143] }
        });
        startY = doc.lastAutoTable.finalY + 10;

        // 3) % Victorias por club
        const clubWins = {};
        const clubPlayed = {};
        statsCompletedMatches().forEach(({ match: m }) => {
            const s1 = (m.sets && m.sets.player1) || [];
            const s2 = (m.sets && m.sets.player2) || [];
            const w1 = countSetWins(s1, s2);
            const w2 = countSetWins(s2, s1);
            if (w1 === w2) return;
            const c1 = (m.player1.club || '?').toUpperCase();
            const c2 = (m.player2.club || '?').toUpperCase();
            clubPlayed[c1] = (clubPlayed[c1] || 0) + 1;
            clubPlayed[c2] = (clubPlayed[c2] || 0) + 1;
            if (w1 > w2) clubWins[c1] = (clubWins[c1] || 0) + 1;
            else clubWins[c2] = (clubWins[c2] || 0) + 1;
        });
        const clubRows = Object.keys(clubPlayed)
            .map(c => [c, Math.round(100 * (clubWins[c] || 0) / clubPlayed[c]) + '%'])
            .sort((x, y) => parseInt(y[1]) - parseInt(x[1]));
        doc.text('% Victorias por club', 14, startY);
        doc.autoTable({
            startY: startY + 2,
            head: [['Club', 'Victorias']],
            body: clubRows,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [230, 57, 70] }
        });
        startY = doc.lastAutoTable.finalY + 10;

        // 4) Rachas y forma reciente
        const streakRows = computeStreakRows();
        doc.text('Rachas y forma reciente', 14, startY);
        doc.autoTable({
            startY: startY + 2,
            head: [['Jugador', 'Club', 'Racha actual', 'Mejor (G)', 'Mejor (P)']],
            body: streakRows.map(r => [
                r.name, r.club,
                r.curType === 'W' ? r.curCount + ' G' : (r.curType === 'L' ? r.curCount + ' P' : '-'),
                r.longestW, r.longestL
            ]),
            styles: { fontSize: 9 },
            headStyles: { fillColor: [120, 90, 40] }
        });

        doc.save('Estadisticas_Torneo_' + fecha + '.pdf');
        showToast('PDF generado: Estadisticas_Torneo_' + fecha + '.pdf');
        addLog('EXPORTAR PDF', 'Estadísticas exportadas a PDF (jsPDF)');
    } catch (error) {
        console.error('Error al exportar PDF:', error);
        showToast('Error al generar el PDF', 'error');
    }
};

// ==========================================
// ACTUALIZACIÓN DEL DASHBOARD
// ==========================================

/**
 * Recalcula los puntos de todos los jugadores de un fixture según sus partidos.
 * Puntos ITTF (3.7.5.1): 2 por victoria, 1 por derrota jugada, 0 por W.O.
 * Solo cuentan partidos completados con ganador válido.
 * @param {Object} fixture - Fixture guardado
 */
function recomputeFixturePoints(fixture) {
    const players = fixture.players || [];
    players.forEach(p => {
        p.points = 0;
        p.matchesPlayed = 0;
        p.matchesWon = 0;
        p.matchesLost = 0;
    });

    (fixture.matches || []).forEach(m => {
        if (!m || !m.completed || !m.player1 || !m.player2) return;
        const p1 = players.find(p => p.name === m.player1.name && p.club === m.player1.club);
        const p2 = players.find(p => p.name === m.player2.name && p.club === m.player2.club);
        const ws = window.ITTFRULES.matchWinnerSide(m);
        if (ws === 0) return;

        if (p1) {
            p1.matchesPlayed++;
            if (ws === 1) p1.matchesWon++;
            else p1.matchesLost++;
            p1.points += window.ITTFRULES.matchPointsFor(m, p1.name, p1.club);
        }
        if (p2) {
            p2.matchesPlayed++;
            if (ws === -1) p2.matchesWon++;
            else p2.matchesLost++;
            p2.points += window.ITTFRULES.matchPointsFor(m, p2.name, p2.club);
        }
    });
}

/**
 * Cuenta los sets ganados por un jugador en un partido (solo sets válidos ITTF).
 */
function countSetWins(mySets, oppSets) {
    return window.ITTFRULES.countSetWins(mySets, oppSets);
}

// ==========================================
// HELPERS COMPARTIDOS (usados por charts.js y estadísticas)
// ==========================================

/**
 * Escapa texto para insertar de forma segura en HTML.
 */
function statsEsc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Clave única de un jugador (nombre|club).
 */
function statsPlayerKey(p) {
    return (p && p.name && p.club) ? p.name + '|' + p.club : '|';
}

/**
 * Devuelve los jugadores válidos del torneo (sin placeholders).
 */
function statsValidPlayers() {
    return (tournamentData.players || []).filter(p =>
        p && p.name && p.club &&
        p.name !== '-' && p.club !== '-' &&
        p.name !== '- -' && p.club !== '- -' &&
        p.name.trim() !== '' && p.club.trim() !== ''
    );
}

/**
 * Devuelve todos los partidos completados de todos los fixtures.
 * @returns {Array} [{ fixture, match }]
 */
function statsCompletedMatches() {
    const out = [];
    (tournamentData.fixtures || []).forEach(f => {
        (f.matches || []).forEach(m => {
            if (!m || !m.completed || !m.player1 || !m.player2) return;
            if (m.wo) return;
            if (m.player1.name === '-' || m.player2.name === '-' ||
                m.player1.name === 'TBD' || m.player2.name === 'TBD') return;
            out.push({ fixture: f, match: m });
        });
    });
    return out;
}

/**
 * Renderiza la sección "Partidos en Vivo" del Dashboard.
 * Permite cargar sets directamente y resalta el partido en curso.
 */
window.renderLiveScores = function() {
    const container = document.getElementById('live-scores-container');
    if (!container) return;

    const fixtures = tournamentData.fixtures || [];
    const liveMatches = [];

    fixtures.forEach((f, fIdx) => {
        (f.matches || []).forEach((m, mIdx) => {
            if (!m || m.completed) return;
            if (!m.player1 || !m.player2) return;
            if (m.player1.name === '-' || m.player2.name === '-') return;
            if (m.player1.name === 'TBD' || m.player2.name === 'TBD') return;
            liveMatches.push({ f, fIdx, m, mIdx });
        });
    });

    if (liveMatches.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">Sin partidos en curso. Generá un fixture y cargá los resultados aquí o desde la pestaña Fixture.</p>';
        return;
    }

    liveMatches.sort((a, b) => a.fIdx - b.fIdx || a.mIdx - b.mIdx);

    let html = '<div class="live-scores-list">';
    liveMatches.forEach((lm, pos) => {
        html += renderLiveMatchTable(lm, pos === 0);
    });
    html += '</div>';

    container.innerHTML = html;
};

function renderLiveMatchTable(lm, isCurrent) {
    const m = lm.m;
    const p1Sets = (m.sets && m.sets.player1) || [];
    const p2Sets = (m.sets && m.sets.player2) || [];
    const w1 = countSetWins(p1Sets, p2Sets);
    const w2 = countSetWins(p2Sets, p1Sets);

    const formato = (m.formato) || window.ITTFRULES.groupFormat();
    const numSets = window.ITTFRULES.setColumns(formato);
    const setCols = [];
    for (let i = 0; i < numSets; i++) setCols.push(i);
    const setHeaders = setCols.map(i => `<th>S${i + 1}</th>`).join('');

    const s1Cells = setCols.map(i =>
        `<td class="live-set" contenteditable="true" data-fixture="${lm.fIdx}" data-match="${lm.mIdx}" data-side="1" data-set="${i}" onblur="liveScoreBlur(this)">${p1Sets[i] || ''}</td>`
    ).join('');
    const s2Cells = setCols.map(i =>
        `<td class="live-set" contenteditable="true" data-fixture="${lm.fIdx}" data-match="${lm.mIdx}" data-side="2" data-set="${i}" onblur="liveScoreBlur(this)">${p2Sets[i] || ''}</td>`
    ).join('');

    return `
        <table class="live-match ${isCurrent ? 'live-current' : ''}">
            <tr>
                <th colspan="2" style="text-align: left;">
                    ${escHtml(lm.f.categoria)} · Grupo ${escHtml(lm.f.grupo)} · Partido ${m.match}
                    ${isCurrent ? ' <span class="live-badge">🔴 EN CURSO</span>' : ''}
                </th>
                ${setHeaders}<th>Pts</th>
            </tr>
            <tr>
                <td style="text-align: left; font-weight: bold;">${escHtml(m.player1.name)}</td>
                <td style="text-align: left; font-size: 11px; color: var(--text-muted);">${escHtml(m.player1.club)}</td>
                ${s1Cells}
                <td><strong>${w1}</strong></td>
            </tr>
            <tr>
                <td style="text-align: left; font-weight: bold;">${escHtml(m.player2.name)}</td>
                <td style="text-align: left; font-size: 11px; color: var(--text-muted);">${escHtml(m.player2.club)}</td>
                ${s2Cells}
                <td><strong>${w2}</strong></td>
            </tr>
        </table>
    `;
}

/**
 * Handler de los inputs de set en la sección "Partidos en Vivo".
 */
window.liveScoreBlur = function(input) {
    const fIdx = parseInt(input.getAttribute('data-fixture'));
    const mIdx = parseInt(input.getAttribute('data-match'));
    const side = parseInt(input.getAttribute('data-side'));
    const setIdx = parseInt(input.getAttribute('data-set'));

    const fixture = tournamentData.fixtures[fIdx];
    if (!fixture || !fixture.matches[mIdx]) return;
    const m = fixture.matches[mIdx];

    if (!m.sets) m.sets = { player1: [], player2: [] };
    const key = side === 1 ? 'player1' : 'player2';
    if (!m.sets[key]) m.sets[key] = [];

    const raw = input.textContent.trim();
    const val = raw === '' ? 0 : Math.max(0, parseInt(raw) || 0);
    m.sets[key][setIdx] = val;

    // El partido se completa solo cuando hay un ganador válido según ITTF
    const s1 = m.sets.player1 || [];
    const s2 = m.sets.player2 || [];
    const formato = m.formato || window.ITTFRULES.groupFormat();
    const wasCompleted = m.completed === true;
    m.completed = window.ITTFRULES.matchCompleted(s1, s2, formato);

    // Aviso sonoro al finalizar un partido (una sola vez por transición)
    if (m.completed && !wasCompleted && typeof window.playMatchEndSound === 'function') {
        window.playMatchEndSound();
        if (typeof window.resetScheduledMatchNotification === 'function') {
            window.resetScheduledMatchNotification(fixture.id, mIdx + 1);
        }
    }

    recomputeFixturePoints(fixture);
    saveTournamentData();

    // Actualizar el rating ELO según el resultado de este partido
    if (typeof syncEloForFixture === 'function') syncEloForFixture(fixture);

    // Diferir el re-render para no interrumpir el clic hacia otra celda
    requestAnimationFrame(() => {
        renderLiveScores();
        updateDashboard();
    });
};

/**
 * Actualiza el dashboard principal
 */
window.updateDashboard = function() {
    try {
        const validPlayers = tournamentData.players.filter(p =>
            p.name && p.club &&
            p.name !== '-' && p.club !== '-' &&
            p.name !== '- -' && p.club !== '- -' &&
            p.name.trim() !== '' && p.club.trim() !== ''
        );

        document.getElementById('stat-groups').textContent = tournamentData.fixtures.length;
        document.getElementById('stat-players').textContent = validPlayers.length;

        let totalMatches = 0;
        let completedMatches = 0;

        tournamentData.fixtures.forEach(f => {
            if (f.matches) {
                totalMatches += f.matches.length;
                completedMatches += f.matches.filter(m => m.completed).length;
            }
        });

        document.getElementById('stat-matches').textContent = completedMatches;
        document.getElementById('stat-pending').textContent = totalMatches - completedMatches;

        const summaryDiv = document.getElementById('tournament-summary');
        if (tournamentData.fixtures.length === 0) {
            summaryDiv.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">No hay fixtures generados aún.</p>';
        } else {
            let html = '<table class="data-table"><tr><th>Categoría</th><th>Grupo</th><th>Jugadores</th><th>Fecha</th><th>Acciones</th></tr>';
            tournamentData.fixtures.forEach(f => {
                html += `
                    <tr>
                        <td>${escHtml(f.categoria)}</td>
                        <td>${escHtml(f.grupo)}</td>
                        <td>${f.players.length}</td>
                        <td>${new Date(f.timestamp).toLocaleString(window.i18nLocale())}</td>
                        <td>
                            <button class="btn btn-info" style="padding: 5px 10px; font-size: 12px;" onclick="viewFixture(${f.id})">Ver</button>
                            <button class="btn btn-danger" style="padding: 5px 10px; font-size: 12px;" onclick="deleteFixture(${f.id})">Eliminar</button>
                        </td>
                    </tr>
                `;
            });
            html += '</table>';
            summaryDiv.innerHTML = html;
        }

        const alertsDiv = document.getElementById('alerts-container');
        const alerts = [];

        const pendingMatches = totalMatches - completedMatches;
        if (pendingMatches > 0) {
            alerts.push(`<div class="alert alert-warning">⚠️ Hay ${pendingMatches} partido(s) pendiente(s) de completar.</div>`);
        } else if (totalMatches > 0) {
            alerts.push(`<div class="alert alert-success">✅ Todos los partidos han sido completados.</div>`);
        } else {
            alerts.push(`<div class="alert alert-info">ℹ️ Genera tu primer fixture para comenzar el torneo.</div>`);
        }

        const absentCount = validPlayers.filter(p => !p.checkin).length;
        if (validPlayers.length > 0 && absentCount > 0) {
            alerts.push(`<div class="alert alert-warning">⚠️ ${absentCount} jugador(es) sin check-in de presencia. <button class="btn btn-info" style="padding: 3px 10px; font-size: 11px;" onclick="showTab('players'); showCheckinModal();">🙋 Check-in</button></div>`);
        }

        const completedCats = [];
        const fixturesByCat = {};
        tournamentData.fixtures.forEach(f => {
            if (!fixturesByCat[f.categoria]) fixturesByCat[f.categoria] = [];
            fixturesByCat[f.categoria].push(f);
        });
        Object.keys(fixturesByCat).forEach(cat => {
            const catFixtures = fixturesByCat[cat];
            const allDone = catFixtures.every(f => (f.matches || []).length > 0 && (f.matches || []).every(m => m.completed));
            if (allDone) completedCats.push(cat);
        });
        const bracketCats = (tournamentData.brackets || []).filter(b => b.rounds && b.rounds.length).map(b => b.categoria);
        const missingBrackets = completedCats.filter(cat => bracketCats.indexOf(cat) === -1);
        if (missingBrackets.length > 0) {
            alerts.push(`<div class="alert alert-info">🎯 Grupos completados sin llaves generadas: ${missingBrackets.map(c => escHtml(c)).join(', ')}. <button class="btn btn-primary" style="padding: 3px 10px; font-size: 11px;" onclick="showTab('brackets'); renderBracketsForTab();">🏆 Generar</button></div>`);
        }

        alertsDiv.innerHTML = alerts.join('');

        // Refrescar partidos en vivo
        if (typeof renderLiveScores === 'function') {
            renderLiveScores();
        }

        // Encabezado y nuevas secciones del dashboard
        refreshDashboardHeader();
        renderDashboardFlow();
        renderDashboardPodiums();
        renderDashboardProgress();
        renderDashboardNextMatches();
        renderDashboardCategoryChips();
        renderDashboardRecentLogs();
    } catch (error) {
        console.error('Error al actualizar dashboard:', error);
    }
};

/**
 * Tabla de posiciones por categoría (todas las posiciones, no solo el MVP).
 * Orden: victorias desc, diferencia de sets desc, puntos a favor desc, nombre asc.
 * @returns {Object} { [categoria]: Array<{ name, club, wins, losses, setsDiff, pointsFor }> }
 */
function getCategoryLeaderboard() {
    const cats = {};

    statsCompletedMatches().forEach(({ fixture: f, match: m }) => {
        const s1 = (m.sets && m.sets.player1) || [];
        const s2 = (m.sets && m.sets.player2) || [];
        const w1 = countSetWins(s1, s2);
        const w2 = countSetWins(s2, s1);
        if (w1 === w2) return;

        const cat = f.categoria;
        if (!cats[cat]) cats[cat] = {};

        const p1Key = statsPlayerKey(m.player1);
        const p2Key = statsPlayerKey(m.player2);
        if (!cats[cat][p1Key]) cats[cat][p1Key] = { name: m.player1.name, club: m.player1.club, wins: 0, losses: 0, setsDiff: 0, pointsFor: 0 };
        if (!cats[cat][p2Key]) cats[cat][p2Key] = { name: m.player2.name, club: m.player2.club, wins: 0, losses: 0, setsDiff: 0, pointsFor: 0 };

        const a = cats[cat][p1Key];
        const b = cats[cat][p2Key];
        a.setsDiff += w1 - w2;
        b.setsDiff += w2 - w1;
        // Los sets se persisten como strings: parsear a número antes de sumar
        a.pointsFor += s1.reduce((x, y) => x + (parseInt(y, 10) || 0), 0);
        b.pointsFor += s2.reduce((x, y) => x + (parseInt(y, 10) || 0), 0);

        if (w1 > w2) { a.wins++; b.losses++; }
        else { b.wins++; a.losses++; }
    });

    const leaderboard = {};
    Object.keys(cats).forEach(cat => {
        leaderboard[cat] = Object.values(cats[cat]).sort((x, y) =>
            y.wins - x.wins || y.setsDiff - x.setsDiff || y.pointsFor - x.pointsFor || x.name.localeCompare(y.name)
        );
    });
    return leaderboard;
}

/**
 * Actualiza el encabezado con el nombre real del torneo.
 */
window.refreshDashboardHeader = function() {
    const titleEl = document.getElementById('main-header-title');
    const subEl = document.getElementById('main-header-subtitle');
    if (!titleEl && !subEl) return;

    const sett = tournamentData.settings || {};
    const name = sett.torneoNombre || '';
    const DEFAULT_TITLE = '🏓 PingPong Manager 🏓';
    const DEFAULT_SUB = 'Gestión completa de fixtures, estadísticas y llaves eliminatorias';

    if (titleEl) {
        titleEl.textContent = name ? '🏓 ' + name.replace(/🏓/g, '').trim() + ' 🏓' : DEFAULT_TITLE;
    }
    if (subEl) {
        subEl.textContent = (name && sett.subtitulo) ? sett.subtitulo : DEFAULT_SUB;
    }
};

/**
 * Podios provisionales por categoría (top 3).
 */
window.renderDashboardPodiums = function() {
    const container = document.getElementById('dashboard-podiums');
    if (!container) return;

    const lb = getCategoryLeaderboard();
    const cats = Object.keys(lb);
    if (cats.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">Sin partidos completados aún.</p>';
        return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    let html = '<table class="data-table"><tr><th>Categoría</th><th>1°</th><th>2°</th><th>3°</th></tr>';
    cats.sort().forEach(cat => {
        const players = lb[cat];
        html += `<tr><td><strong>${escHtml(cat)}</strong></td>`;
        for (let i = 0; i < 3; i++) {
            const p = players[i];
            html += `<td>${p ? medals[i] + ' ' + escHtml(p.name) + (p.club ? ' <small style="color: var(--text-muted);">(' + escHtml(p.club) + ')</small>' : '') + ' <small style="color: var(--text-muted);">' + p.wins + 'G</small>' : '—'}</td>`;
        }
        html += '</tr>';
    });
    html += '</table>';
    container.innerHTML = html;
};

/**
 * Progreso del torneo: partidos completados por categoría con barra de avance.
 */
window.renderDashboardProgress = function() {
    const container = document.getElementById('dashboard-progress');
    if (!container) return;

    const fixtures = tournamentData.fixtures || [];
    if (fixtures.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">Sin fixtures generados aún.</p>';
        return;
    }

    const byCat = {};
    let totalMatches = 0;
    let totalCompleted = 0;

    fixtures.forEach(f => {
        const key = f.categoria;
        if (!byCat[key]) byCat[key] = { total: 0, completed: 0 };
        const matches = f.matches || [];
        const completed = matches.filter(m => m.completed).length;
        byCat[key].total += matches.length;
        byCat[key].completed += completed;
        totalMatches += matches.length;
        totalCompleted += completed;
    });

    let html = '';
    Object.keys(byCat).sort().forEach(cat => {
        const c = byCat[cat];
        const pct = c.total ? Math.round((c.completed / c.total) * 100) : 0;
        html += `<div class="progress-row">
            <span class="cat-name">${escHtml(cat)}</span>
            <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
            <span class="cat-pct">${c.completed}/${c.total} · ${pct}%</span>
        </div>`;
    });

    const totalPct = totalMatches ? Math.round((totalCompleted / totalMatches) * 100) : 0;
    html += `<div class="progress-row">
        <span class="cat-name">TOTAL</span>
        <div class="progress-track"><div class="progress-fill" style="width:${totalPct}%"></div></div>
        <span class="cat-pct">${totalCompleted}/${totalMatches} · ${totalPct}%</span>
    </div>`;

    container.innerHTML = html;
};

/**
 * Próximos partidos en mesa según la programación Multiplex.
 */
window.renderDashboardNextMatches = function() {
    const container = document.getElementById('dashboard-next-matches');
    if (!container) return;

    const fixtures = tournamentData.fixtures || [];
    const upcoming = [];
    let hasSchedule = false;

    fixtures.forEach(f => {
        const schedule = f.schedule || [];
        (f.matches || []).forEach((m, i) => {
            if (!m || !m.player1 || !m.player2) return;
            const sch = schedule.find(s => s.match === (m.match || i + 1));
            if (!sch) return;
            hasSchedule = true;
            if (m.completed) return;
            if (sch.mesa === '-' || sch.slot < 0) return;
            upcoming.push({
                categoria: f.categoria,
                grupo: f.grupo,
                match: m.match || i + 1,
                p1: m.player1.name,
                p2: m.player2.name,
                mesa: sch.mesa,
                hora: sch.hora,
                slot: sch.slot
            });
        });
    });

    if (upcoming.length === 0) {
        container.innerHTML = hasSchedule
            ? '<p style="color: var(--text-muted); font-style: italic;">Todos los partidos programados están completados.</p>'
            : '<p style="color: var(--text-muted); font-style: italic;">Programá el Multiplex desde Fixture para ver los partidos por mesa.</p>';
        return;
    }

    upcoming.sort((a, b) => a.slot - b.slot || a.mesa - b.mesa);
    const shown = upcoming.slice(0, 12);

    let html = '<div class="dashboard-chips">';
    shown.forEach(u => {
        html += `<div class="cat-chip" style="cursor: default; flex-direction: column; align-items: flex-start; gap: 2px; border-radius: 8px;">
            <div style="font-weight: 700; font-size: 12px;">Mesa ${u.mesa} · ${escHtml(u.hora)}</div>
            <div style="font-size: 12px;">P${u.match} · ${escHtml(u.categoria)} ${escHtml(u.grupo)}</div>
            <div style="font-size: 12px;">${escHtml(u.p1)} vs ${escHtml(u.p2)}</div>
        </div>`;
    });
    html += '</div>';
    if (upcoming.length > shown.length) {
        html += `<p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">+ ${upcoming.length - shown.length} partido(s) programado(s) más.</p>`;
    }
    container.innerHTML = html;
};

/**
 * Chips de jugadores por categoría (click → Fixture con esa categoría).
 */
window.renderDashboardCategoryChips = function() {
    const container = document.getElementById('dashboard-category-chips');
    if (!container) return;

    const validPlayers = statsValidPlayers();
    if (validPlayers.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">Sin jugadores registrados.</p>';
        return;
    }

    const counts = {};
    validPlayers.forEach(p => {
        (p.categories || []).forEach(c => {
            if (c && c.trim()) counts[c] = (counts[c] || 0) + 1;
        });
    });

    const cats = Object.keys(counts).sort();
    if (cats.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">Sin jugadores con categoría asignada.</p>';
        return;
    }

    let html = '<div class="dashboard-chips">';
    cats.forEach(c => {
        html += `<button class="cat-chip" onclick="jumpToCategory('${escAttr(c)}')">${escHtml(c)} <span class="chip-count">${counts[c]}</span></button>`;
    });
    html += '</div>';
    container.innerHTML = html;
};

/**
 * Navega a la pestaña Fixture con una categoría preseleccionada.
 */
window.jumpToCategory = function(cat) {
    const sel = document.getElementById('categoria');
    if (sel && Array.from(sel.options).some(o => o.value === cat)) {
        sel.value = cat;
    }
    showTab('fixture');
    if (typeof updateFixtureNavigator === 'function') updateFixtureNavigator();
    if (typeof updatePlayerFields === 'function') updatePlayerFields();
};

/**
 * Últimos 5 registros de la bitácora en el dashboard.
 */
window.renderDashboardRecentLogs = function() {
    const container = document.getElementById('dashboard-recent-logs');
    if (!container) return;

    const logs = tournamentData.logs || [];
    if (logs.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">Sin actividad registrada.</p>';
        return;
    }

    const recent = [...logs].reverse().slice(0, 5);
    let html = '<table class="data-table"><tr><th>Fecha</th><th>Acción</th><th>Descripción</th></tr>';
    recent.forEach(l => {
        html += `<tr><td>${escHtml(l.date || '')}</td><td><strong>${escHtml(l.action || '')}</strong></td><td>${escHtml(l.description || '')}</td></tr>`;
    });
    html += '</table>';
    html += `<p style="margin-top: 8px;"><button class="btn btn-info" style="padding: 4px 12px; font-size: 11px;" onclick="showTab('logs')">📋 Ver todos (${logs.length})</button></p>`;
    container.innerHTML = html;
};

/**
 * Flujo guiado del torneo: muestra el paso actual con acceso directo.
 */
window.renderDashboardFlow = function() {
    const container = document.getElementById('dashboard-flow');
    if (!container) return;

    const sett = tournamentData.settings || {};
    const validPlayers = statsValidPlayers();
    const fixtures = tournamentData.fixtures || [];

    let totalMatches = 0;
    let completedMatches = 0;
    fixtures.forEach(f => {
        if (f.matches) {
            totalMatches += f.matches.length;
            completedMatches += f.matches.filter(m => m.completed).length;
        }
    });
    const pending = totalMatches - completedMatches;
    const hasBrackets = (tournamentData.brackets || []).some(b => b.rounds && b.rounds.length);

    const steps = [
        { name: '⚙️ Configurar torneo', tab: 'settings', done: !!sett.torneoNombre },
        { name: '👥 Registrar jugadores', tab: 'players', done: validPlayers.length > 0 },
        { name: '⚡ Generar fixture', tab: 'fixture', done: fixtures.length > 0 },
        { name: '🎾 Completar partidos', tab: 'fixture', done: fixtures.length > 0 && pending === 0 },
        { name: '🏆 Llaves eliminatorias', tab: 'brackets', done: fixtures.length > 0 && pending === 0 && hasBrackets }
    ];

    let currentIdx = steps.findIndex(s => !s.done);
    if (currentIdx === -1) currentIdx = steps.length - 1;

    let html = '';
    steps.forEach((s, i) => {
        const isDone = s.done;
        const isCurrent = i === currentIdx && !isDone;
        const icon = isDone ? '✅' : (isCurrent ? '▶️' : '⏳');
        const status = isDone ? 'Completado' : (isCurrent ? 'Siguiente paso' : 'Pendiente');
        html += `<div class="flow-step ${isCurrent ? 'flow-current' : ''}">
            <span class="flow-icon">${icon}</span>
            <span class="flow-name">${s.name}</span>
            <span class="flow-status">${status}</span>
            <button class="btn ${isCurrent ? 'btn-primary' : 'btn-info'}" style="padding: 4px 12px; font-size: 12px;" onclick="showTab('${s.tab}')">${isDone ? 'Ver' : 'Ir'}</button>
        </div>`;
    });
    container.innerHTML = html;
};

