// ==========================================
// TOURNAMENTS.JS - GESTIÓN DE TORNEOS
// ==========================================
// Este archivo contiene todas las funciones relacionadas con:
// - Inicio de nuevo torneo
// - Finalización de torneo
// - Generación de reportes finales
// - Cálculo de podios
// - Impresión de reportes
// - Reset del sistema
// - Puntos de restauración
// ==========================================

// ==========================================
// INICIO DE NUEVO TORNEO
// ==========================================

/**
 * Inicia un nuevo torneo limpiando los datos actuales
 */
window.startNewTournament = function() {
    // Verificar si hay datos existentes
    const hasData = tournamentData.fixtures.length > 0 ||
                    tournamentData.players.length > 0;

    if (!hasData) {
        showToast(t('No hay datos para limpiar. ¡Comienza tu primer torneo!'), 'info');
        return;
    }

    showModal(
        t('🆕 ¿Iniciar Nuevo Torneo?'),
        `<div style="color: var(--text-color);">
            <p><strong>⚠️ ${t('ATENCIÓN:')}</strong> ${t('Estás a punto de iniciar un nuevo torneo.')}</p>

            <div class="warn-box" style="margin: 15px 0;">
                <strong>${t('Se eliminarán:')}</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>✗ ${t('Todos los fixtures generados')} (${tournamentData.fixtures.length})</li>
                    <li>✗ ${t('Todos los resultados de partidos')}</li>
                    <li>✗ ${t('Todas las llaves eliminatorias')}</li>
                    <li>✗ ${t('Todo el historial de logs')}</li>
                </ul>

                <strong style="color: var(--success);">${t('Se mantendrán:')}</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>✓ ${t('Base de datos de jugadores')} (${tournamentData.players.length})</li>
                    <li>✓ ${t('Configuración del torneo')}</li>
                </ul>
            </div>

            <div class="success-box" style="margin: 15px 0;">
                <strong>💡 ${t('Recomendación:')}</strong> ${t('Antes de continuar, crea un backup completo desde el menú de Configuración.')}
            </div>

            <p style="font-weight: bold; color: var(--danger);">${t('Esta acción es grave pero reversible.')}</p>
            <p style="color: var(--success); font-size: 13px;">💡 ${t('Consejo: puedes deshacerla con Ctrl+Z o el botón Deshacer.')}</p>
        </div>
        <div class="button-grid" style="margin-top: 20px;">
            <button class="btn btn-success" onclick="closeModal(); createBackupBeforeNew();">
                💾 ${t('Crear Backup y Continuar')}
            </button>
            <button class="btn btn-danger" onclick="closeModal(); confirmStartNewTournament();">
                🆕 ${t('Continuar sin Backup')}
            </button>
            <button class="btn btn-dark" onclick="closeModal();">
                ❌ ${t('Cancelar')}
            </button>
        </div>`,
        null
    );
};

/**
 * Crea un backup antes de iniciar nuevo torneo
 */
function createBackupBeforeNew() {
    try {
        // Crear backup automático
        const backup = {
            timestamp: new Date().toISOString(),
            version: '2.5',
            type: 'pre-new-tournament-backup',
            data: tournamentData
        };

        const dataStr = JSON.stringify(backup, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Backup_PreNuevoTorneo_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(t('Backup creado correctamente'));
        addLog('BACKUP', t('Backup automático antes de nuevo torneo'));

        // Continuar con la limpieza
        setTimeout(() => {
            confirmStartNewTournament();
        }, 500);
    } catch (error) {
        console.error('Error al crear backup:', error);
        showToast(t('Error al crear backup'), 'error');
    }
}

/**
 * Confirma y ejecuta el inicio de nuevo torneo
 */
function confirmStartNewTournament() {
    try {
        // Guardar jugadores y configuración
        const savedPlayers = [...tournamentData.players];
        const savedSettings = { ...tournamentData.settings };

        // El check-in de presencia es por torneo: se resetea al iniciar uno nuevo
        savedPlayers.forEach(p => { if (p) p.checkin = false; });

        // Limpiar todo excepto jugadores
        tournamentData = {
            fixtures: [],
            players: savedPlayers,
            brackets: [],
            settings: savedSettings,
            logs: [],
            waitlist: []
        };

        // Agregar log del nuevo torneo
        addLog('NUEVO TORNEO', t('Torneo anterior finalizado. Nuevo torneo iniciado.'));

        saveTournamentData();
        updateDashboard();

        // Limpiar output del fixture
        document.getElementById('fixture-output').innerHTML = '';

        // Mostrar mensaje de éxito
        showToast(t('🎉 ¡Nuevo torneo iniciado exitosamente!'));

        showModal(
            t('✅ Nuevo Torneo Iniciado'),
            `<div style="text-align: center; color: var(--text-color);">
                <div style="font-size: 64px; margin: 20px 0;">🏓</div>
                <h2 style="color: var(--btn-success); margin: 10px 0;">${t('¡Nuevo Torneo Iniciado!')}</h2>
                <p style="margin: 20px 0;">${t('El sistema está listo para comenzar.')}</p>

                <div class="success-box" style="margin: 20px 0; text-align: left;">
                    <strong>✓ ${t('Datos mantenidos:')}</strong><br>
                    ${savedPlayers.length} ${t('jugadores en la base de datos')}<br>
                    ${t('Configuración del torneo')}
                </div>

                <p style="margin: 20px 0; font-size: 14px;">${t('Puedes comenzar a generar fixtures desde la pestaña')} <strong>${t('Generar Fixture')}</strong>.</p>
            </div>`,
            () => {
                showTab('fixture');
            }
        );
    } catch (error) {
        console.error('Error al iniciar nuevo torneo:', error);
        showToast(t('Error al iniciar nuevo torneo'), 'error');
    }
}

// ==========================================
// FINALIZACIÓN DE TORNEO Y REPORTES
// ==========================================

/**
 * Evalúa el estado de cada fase del torneo para el asistente de cierre.
 * @returns {Array<{key: string, icon: string, name: string, done: boolean, critical: boolean, tab: string, detail: string}>}
 */
window.buildFinishChecklist = function() {
    const sett = tournamentData.settings || {};
    const fixtures = tournamentData.fixtures || [];
    const players = tournamentData.players || [];

    const validPlayers = players.filter(p =>
        p.name && p.club && p.name !== '-' && p.club !== '-' && p.name !== '- -' && p.club !== '- -'
    );
    const checkedIn = validPlayers.filter(p => p.checkin === true).length;

    let totalMatches = 0;
    let completedMatches = 0;
    fixtures.forEach(f => {
        if (f.matches) {
            totalMatches += f.matches.length;
            completedMatches += f.matches.filter(m => m.completed).length;
        }
    });
    const pendingMatches = totalMatches - completedMatches;
    const hasBrackets = (tournamentData.brackets || []).some(b => b.rounds && b.rounds.length);
    const bracketsDone = (tournamentData.brackets || []).every(b => {
        if (!b.rounds || b.rounds.length === 0) return true;
        return b.rounds.every(r => (r.matches || []).every(m => m.winner || m.completed));
    });

    return [
        {
            key: 'settings',
            icon: '⚙️',
            name: t('Configurar el torneo'),
            done: !!sett.torneoNombre,
            critical: false,
            tab: 'settings',
            detail: t('Nombre del torneo definido en Configuración.')
        },
        {
            key: 'players',
            icon: '👥',
            name: t('Registrar jugadores'),
            done: validPlayers.length > 0,
            critical: false,
            tab: 'players',
            detail: t('Al menos un jugador registrado.') + ` (${validPlayers.length})`
        },
        {
            key: 'checkin',
            icon: '✅',
            name: t('Check-in de jugadores'),
            done: validPlayers.length > 0 && checkedIn > 0,
            critical: false,
            tab: 'players',
            detail: t('Jugadores presentes el día del torneo.') + ` (${checkedIn}/${validPlayers.length})`
        },
        {
            key: 'fixture',
            icon: '⚡',
            name: t('Generar fixtures'),
            done: fixtures.length > 0,
            critical: true,
            tab: 'fixture',
            detail: t('Al menos un fixture guardado.') + ` (${fixtures.length})`
        },
        {
            key: 'matches',
            icon: '🎾',
            name: t('Completar todos los partidos'),
            done: fixtures.length > 0 && pendingMatches === 0,
            critical: false,
            tab: 'fixture',
            detail: t('Partidos jugados.') + ` (${completedMatches}/${totalMatches})`
        },
        {
            key: 'brackets',
            icon: '🏆',
            name: t('Definir llaves eliminatorias'),
            done: !hasBrackets || bracketsDone,
            critical: false,
            tab: 'brackets',
            detail: hasBrackets
                ? t('Llaves con ganadores definidos.')
                : t('Sin llaves (opcional si no se usan).')
        },
        {
            key: 'stats',
            icon: '📊',
            name: t('Estadísticas y podios calculables'),
            done: fixtures.length > 0 && totalMatches > 0,
            critical: false,
            tab: 'stats',
            detail: t('Con partidos cargados se generan podios y récords.')
        }
    ];
};

/**
 * Asistente de fin de torneo: muestra un checklist interactivo de las fases
 * previas al cierre y recién habilita "Finalizar" cuando el torneo está listo.
 */
window.finishTournamentAssistant = function() {
    const checklist = window.buildFinishChecklist();
    const doneCount = checklist.filter(c => c.done).length;
    const allDone = doneCount === checklist.length;
    const criticalPending = checklist.some(c => c.critical && !c.done);

    let items = '';
    checklist.forEach(item => {
        const statusIcon = item.done ? '✅' : '⚠️';
        const statusText = item.done ? t('Listo') : t('Pendiente');
        items += `
            <div style="display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 8px; background: var(--surface-alt);">
                <span style="font-size: 20px;">${item.icon}</span>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: bold; font-size: 14px; color: var(--text-color);">${item.name}</div>
                    <div style="font-size: 12px; color: var(--text-muted);">${item.detail}</div>
                </div>
                <span style="font-size: 12px; white-space: nowrap; color: ${item.done ? 'var(--btn-success)' : 'var(--btn-warning)'};">${statusIcon} ${statusText}</span>
                <button class="btn btn-info" style="padding: 5px 10px; font-size: 12px;" onclick="closeModal(); showTab('${item.tab}');">${t('Ir')}</button>
            </div>`;
    });

    const header = allDone
        ? `<div class="alert alert-success" style="margin-bottom: 15px;">🎉 ${t('¡Todo listo! Podés finalizar el torneo.')}</div>`
        : `<div class="alert alert-warning" style="margin-bottom: 15px;">${t('Faltan pasos antes de finalizar. Podés ir a cada pestaña para completarlos.')}</div>`;

    const footer = criticalPending
        ? `<p style="font-size: 13px; color: var(--btn-danger); margin: 15px 0 5px 0;">⚠️ ${t('No se puede finalizar sin fixtures guardados.')}</p>`
        : `<button class="btn btn-success" style="width: 100%; margin-top: 15px;" onclick="closeModal(); generateFinalReport();">🏆 ${t('Generar Reporte Final')}</button>`;

    showModal(
        t('🏁 Asistente de fin de torneo'),
        `<div style="color: var(--text-color);">
            ${header}
            <p style="font-size: 13px; color: var(--text-muted); margin: 0 0 10px 0;">${t('Pasos completados:')} ${doneCount}/${checklist.length}</p>
            ${items}
            ${footer}
        </div>`,
        null,
        t('Cerrar')
    );
};

/**
 * Finaliza el torneo y genera el reporte final
 */
window.finishTournament = function() {
    if (tournamentData.fixtures.length === 0) {
        showToast(t('No hay fixtures para finalizar. Genera al menos un fixture primero.'), 'warning');
        return;
    }

    showModal(
        t('🏆 ¿Finalizar Torneo?'),
        `<div style="color: var(--text-color);">
            <p>${t('¿Estás seguro de que deseas')} <strong>${t('finalizar')}</strong> ${t('este torneo?')}</p>

            <div class="info-box" style="margin: 15px 0;">
                <strong>${t('Se generará:')}</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>🏆 ${t('Podios por cada categoría')}</li>
                    <li>📊 ${t('Estadísticas finales completas')}</li>
                    <li>📋 ${t('Reporte final del torneo')}</li>
                    <li>💾 ${t('Backup automático del torneo')}</li>
                </ul>
            </div>

            <p style="font-size: 14px; color: var(--text-muted);">${t('El reporte se mostrará en pantalla y podrás exportarlo o imprimirlo.')}</p>
        </div>`,
        () => {
            generateFinalReport();
        }
    );
};

/**
 * Genera el reporte final del torneo
 */
window.generateFinalReport = function() {
    try {
        // Backup automático forzado antes de cerrar el torneo
        if (typeof window.saveAutoBackup === 'function') window.saveAutoBackup(true);

        // Crear backup final automático
        const finalBackup = {
            timestamp: new Date().toISOString(),
            version: '2.0',
            type: 'tournament-final-backup',
            data: tournamentData,
            finalReport: true
        };

        const dataStr = JSON.stringify(finalBackup, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Torneo_Final_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        addLog('FINALIZAR TORNEO', t('Torneo finalizado - Backup automático creado'));

        // Calcular podios por categoría
        const podiumsByCategory = calculatePodiums();

        // Registrar la actuación de cada jugador en su historial (evolución por fecha)
        if (typeof snapshotTournamentResults === 'function') {
            snapshotTournamentResults(podiumsByCategory);
        }

        // Calcular estadísticas generales
        const generalStats = calculateGeneralStats();

        // Mostrar reporte final
        displayFinalReport(podiumsByCategory, generalStats);
    } catch (error) {
        console.error('Error al generar reporte final:', error);
        showToast(t('Error al generar reporte final'), 'error');
    }
};

/**
 * Calcula los podios por categoría
 * @returns {Object} Objeto con podios por categoría
 */
window.calculatePodiums = function() {
    const podiums = {};

    // Agrupar fixtures por categoría
    tournamentData.fixtures.forEach(fixture => {
        const categoria = fixture.categoria;

        if (!podiums[categoria]) {
            podiums[categoria] = [];
        }

        // Obtener jugadores con puntos
        fixture.players.forEach(player => {
            if (player.name !== '-' && player.club !== '-') {
                const existing = podiums[categoria].find(p =>
                    p.name === player.name && p.club === player.club
                );

                if (existing) {
                    existing.points += (player.points || 0);
                    existing.groups.push(fixture.grupo);
                    if (!existing.members && player.members) existing.members = player.members;
                } else {
                    podiums[categoria].push({
                        name: player.name,
                        club: player.club,
                        members: player.members,
                        points: player.points || 0,
                        groups: [fixture.grupo]
                    });
                }
            }
        });
    });

    // Ordenar cada categoría por puntos con cadena de desempate completa:
    // enfrentamiento directo → diferencia de sets → puntos a favor
    Object.keys(podiums).forEach(cat => {
        podiums[cat].sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;

            // 1) Enfrentamiento directo
            let h2hRes = 0;
            for (const fixture of tournamentData.fixtures) {
                if (fixture.categoria !== cat) continue;
                const pa = fixture.players.find(p => p.name === a.name && p.club === a.club);
                const pb = fixture.players.find(p => p.name === b.name && p.club === b.club);
                if (pa && pb) {
                    const h2h = headToHeadInfo(pa, pb, fixture.matches);
                    if (h2h.played && h2h.aSets !== h2h.bSets) {
                        h2hRes = h2h.bSets - h2h.aSets;
                        break;
                    }
                }
            }
            if (h2hRes !== 0) return h2hRes;

            // 2) Diferencia de sets (agregada en todas sus fixtures)
            const aggA = getCategoryAggregates(a.name, a.club, cat);
            const aggB = getCategoryAggregates(b.name, b.club, cat);
            const diffA = aggA.setsWon - aggA.setsLost;
            const diffB = aggB.setsWon - aggB.setsLost;
            if (diffA !== diffB) return diffB - diffA;

            // 3) Puntos a favor
            if (aggA.pointsFor !== aggB.pointsFor) return aggB.pointsFor - aggA.pointsFor;

            return (a.name || '').localeCompare(b.name || '');
        });
    });

    // Si existe una llave eliminatoria finalizada para la categoría,
    // el podio se define por los resultados de la llave (incluye el playoff de bronce)
    Object.keys(podiums).forEach(cat => {
        const bracketRes = typeof getBracketResults === 'function' ? getBracketResults(cat) : null;
        if (!bracketRes || !bracketRes.champion) return;

        // Conservar los integrantes de dobles/equipos desde el podio de grupos
        const membersOf = (player) => {
            if (!player) return undefined;
            const entry = (podiums[cat] || []).find(p => p.name === player.name && p.club === player.club);
            return entry ? entry.members : undefined;
        };

        const championPoints = sumPlayerPoints(bracketRes.champion, cat);
        const runnerUpPoints = sumPlayerPoints(bracketRes.runnerUp, cat);
        const third = bracketRes.third || null;
        const thirdPoints = third ? sumPlayerPoints(third, cat) : 0;

        const brPodium = [
            {
                name: bracketRes.champion.name,
                club: bracketRes.champion.club,
                members: membersOf(bracketRes.champion),
                points: championPoints,
                groups: groupsOfPlayer(bracketRes.champion, cat),
                viaBracket: true,
                medal: '🥇'
            },
            {
                name: bracketRes.runnerUp.name,
                club: bracketRes.runnerUp.club,
                members: membersOf(bracketRes.runnerUp),
                points: runnerUpPoints,
                groups: groupsOfPlayer(bracketRes.runnerUp, cat),
                viaBracket: true,
                medal: '🥈'
            }
        ];

        if (third && third.name !== 'TBD') {
            brPodium.push({
                name: third.name,
                club: third.club,
                members: membersOf(third),
                points: thirdPoints,
                groups: groupsOfPlayer(third, cat),
                viaBracket: true,
                medal: '🥉'
            });
        } else {
            // Bronce no jugado: 3° por puntos entre los no finalistas
            const noFinalists = podiums[cat].filter(p =>
                !(p.name === bracketRes.champion.name && p.club === bracketRes.champion.club) &&
                !(p.name === bracketRes.runnerUp.name && p.club === bracketRes.runnerUp.club)
            );
            if (noFinalists.length > 0) {
                brPodium.push(Object.assign({}, noFinalists[0], { viaBracket: true, medal: '🥉' }));
            }
        }

        // Conservar la clasificación completa: top 3 por llave y el resto por grupos
        const finalists = brPodium.map(p => p.name + '|' + p.club);
        const rest = podiums[cat].filter(p => !finalists.includes(p.name + '|' + p.club));
        podiums[cat] = brPodium.concat(rest);
    });

    return podiums;
};

/**
 * Suma los puntos acumulados de un jugador en sus fixtures.
 * @param {object} player - Jugador (name + club)
 * @param {string} [categoria] - Si se indica, solo suma puntos de esa categoría
 */
function sumPlayerPoints(player, categoria) {
    let total = 0;
    tournamentData.fixtures.forEach(f => {
        if (categoria && f.categoria !== categoria) return;
        const p = (f.players || []).find(x => x.name === player.name && x.club === player.club);
        if (p) total += (p.points || 0);
    });
    return total;
}

/**
 * Grupos en los que participó un jugador en una categoría.
 */
function groupsOfPlayer(player, categoria) {
    const groups = [];
    tournamentData.fixtures.forEach(f => {
        if (f.categoria !== categoria) return;
        const p = (f.players || []).find(x => x.name === player.name && x.club === player.club);
        if (p && f.grupo && !groups.includes(f.grupo)) groups.push(f.grupo);
    });
    return groups;
}

/**
 * Acumula sets ganados/perdidos y puntos a favor de un jugador en una categoría.
 */
function getCategoryAggregates(name, club, categoria) {
    const agg = { setsWon: 0, setsLost: 0, pointsFor: 0 };
    tournamentData.fixtures.forEach(f => {
        if (f.categoria !== categoria) return;
        const p = (f.players || []).find(x => x.name === name && x.club === club);
        if (!p) return;
        const a = typeof getMatchAggregates === 'function' ? getMatchAggregates(p, f.matches || []) : { setsWon: 0, setsLost: 0, pointsFor: 0 };
        agg.setsWon += a.setsWon;
        agg.setsLost += a.setsLost;
        agg.pointsFor += a.pointsFor;
    });
    return agg;
}

/**
 * Calcula las estadísticas generales del torneo
 * @returns {Object} Objeto con estadísticas generales
 */
window.calculateGeneralStats = function() {
    let totalMatches = 0;
    let completedMatches = 0;
    let totalSets = 0;

    tournamentData.fixtures.forEach(f => {
        if (f.matches) {
            totalMatches += f.matches.length;
            f.matches.forEach(m => {
                if (m.completed) {
                    completedMatches++;
                    // Contar sets jugados
                    for (let i = 0; i < 5; i++) {
                        if ((m.sets.player1[i] || 0) > 0 || (m.sets.player2[i] || 0) > 0) {
                            totalSets++;
                        }
                    }
                }
            });
        }
    });

    const validPlayers = tournamentData.players.filter(p =>
        p.name !== '-' && p.club !== '-'
    ).length;

    return {
        totalCategories: Object.keys(calculatePodiums()).length,
        totalGroups: tournamentData.fixtures.length,
        totalPlayers: validPlayers,
        totalMatches,
        completedMatches,
        totalSets,
        completionPercentage: totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0
    };
};

// ==========================================
// RÉCORDS, MVP Y DIFUSIÓN (Comunicación y cierre)
// ==========================================

/**
 * Calcula los récords del torneo: partido más largo y set más cerrado.
 * @returns {Object} { longestMatch, closestSet }
 */
function calculateTournamentRecords() {
    let longestMatch = null;
    let closestSet = null;

    tournamentData.fixtures.forEach(f => {
        (f.matches || []).forEach(m => {
            if (!m.completed || !m.player1 || !m.player2) return;
            if (m.player1.name === '-' || m.player2.name === '-' || m.player1.name === 'TBD' || m.player2.name === 'TBD') return;

            const s1 = (m.sets && m.sets.player1) || [];
            const s2 = (m.sets && m.sets.player2) || [];
            let total = 0;

            for (let i = 0; i < 5; i++) {
                const a = parseInt(s1[i], 10) || 0;
                const b = parseInt(s2[i], 10) || 0;
                if (a === 0 && b === 0) continue;
                total += a + b;

                const margin = Math.abs(a - b);
                if (margin > 0 && (!closestSet || margin < closestSet.margin)) {
                    closestSet = {
                        margin,
                        score: a + '-' + b,
                        players: m.player1.name + ' vs ' + m.player2.name,
                        categoria: f.categoria
                    };
                }
            }

            if (total > 0 && (!longestMatch || total > longestMatch.total)) {
                longestMatch = {
                    total,
                    players: m.player1.name + ' vs ' + m.player2.name,
                    sets: s1.map((v, i) => v + '-' + (s2[i] || 0)).join(', '),
                    categoria: f.categoria
                };
            }
        });
    });

    return { longestMatch, closestSet };
}

/**
 * Calcula el MVP por categoría: el jugador con más partidos ganados
 * (desempate: diferencia de sets y luego puntos a favor).
 * @returns {Object} { [categoria]: { name, club, wins, losses } }
 */
function calculateCategoryMVP() {
    const leaderboard = getCategoryLeaderboard();
    const mvp = {};
    Object.keys(leaderboard).forEach(cat => {
        if (leaderboard[cat].length > 0) mvp[cat] = leaderboard[cat][0];
    });
    return mvp;
}

/**
 * Arma el mensaje de difusión para WhatsApp con los podios del día.
 * @param {Object} podiums - Podios por categoría
 */
function buildPodioDiffusionMessage(podiums) {
    const torneoNombre = (tournamentData.settings && tournamentData.settings.torneoNombre) || 'Torneo';
    const fecha = new Date().toLocaleDateString(window.i18nLocale(), { day: 'numeric', month: 'long', year: 'numeric' });

    let msg = '🏓 ' + torneoNombre + '\n';
    msg += '📅 ' + fecha + '\n\n';
    msg += '🏆 PODIOS DEL DÍA\n';

    const categories = Object.keys(podiums || {}).sort();
    if (categories.length === 0) {
        msg += t('Sin podios registrados.') + '\n';
    } else {
        const medallas = ['🥇', '🥈', '🥉'];
        categories.forEach(cat => {
            const top3 = podiums[cat].slice(0, 3);
            if (top3.length === 0) return;
            msg += '\n⭐ ' + cat + '\n';
            top3.forEach((p, i) => {
                msg += medallas[i] + ' ' + p.name + ' (' + p.club + ') — ' + p.points + ' pts\n';
            });
        });
    }

    msg += '\n' + t('¡Felicitaciones a todos los participantes! 🎉');
    return msg;
}

/**
 * Copia un texto al portapapeles (clipboard API con respaldo).
 */
function copyTextToClipboard(text, label) {
    if (typeof window.copyText !== 'function') return;
    window.copyText(text).then(function(ok) {
        if (ok) {
            showToast('📋 ' + (label || t('Texto')) + ' ' + t('copiado al portapapeles'));
            addLog('DIFUSIÓN', (label || t('Texto')) + ' ' + t('copiado al portapapeles'));
        } else {
            showToast(t('No se pudo copiar el texto'), 'error');
        }
    });
}

/**
 * Fecha formateada (p. ej. "sábado, 15 de agosto").
 */
function formatShortDate() {
    return new Date().toLocaleDateString(window.i18nLocale(), {
        weekday: 'long', day: 'numeric', month: 'long'
    });
}

/**
 * Arma un mensaje de difusión a partir de una plantilla.
 * @param {string} tipo - 'inscripcion' | 'dia-torneo' | 'resultados' | 'podios'
 * @returns {string} Mensaje listo para pegar en WhatsApp/Instagram
 */
window.buildDiffusionTemplate = function(tipo) {
    const s = tournamentData.settings || {};
    const nombre = s.torneoNombre || 'Torneo';
    const subtitulo = s.subtitulo || '';
    const lugar = s.lugar || '';
    const fecha = s.fechaInicio ? new Date(s.fechaInicio + 'T12:00:00').toLocaleDateString(window.i18nLocale(), { weekday: 'long', day: 'numeric', month: 'long' }) : '';
    const hoy = formatShortDate();

    if (tipo === 'inscripcion') {
        let msg = '🏓 ' + nombre + '\n';
        if (subtitulo) msg += '📍 ' + subtitulo + '\n';
        if (lugar) msg += '🏟️ ' + lugar + '\n';
        msg += '\n📢 ' + t('¡INSCRIPCIONES ABIERTAS!') + '\n';
        msg += t('Ya podés registrar tu participación en el torneo.') + '\n';
        if (fecha) msg += '📅 ' + t('Fecha:') + ' ' + fecha + '\n';
        msg += '\n⚙️ ' + t('Modalidad:') + ' ' + (s.formato || t('Todos contra todos + llaves')) + '\n';
        msg += '🎾 ' + t('Formato de partidos:') + ' ' + (s.formatoPartidoGrupos ? s.formatoPartidoGrupos.toUpperCase() : 'BO') + '\n';
        msg += '\n✅ ' + t('¡Te esperamos!');
        return msg;
    }

    if (tipo === 'dia-torneo') {
        let msg = '🏓 ' + nombre + '\n';
        if (subtitulo) msg += '📍 ' + subtitulo + '\n';
        if (lugar) msg += '🏟️ ' + lugar + '\n';
        msg += '\n🎉 ' + t('¡HOY SE JUEGA!') + '\n';
        if (fecha) msg += '📅 ' + fecha + '\n';
        msg += '\n⏰ ' + t('Llegá con anticipación para el check-in.') + '\n';
        msg += '🍀 ' + t('¡Buena suerte a todos los participantes!');
        return msg;
    }

    if (tipo === 'resultados') {
        const stats = (typeof calculateGeneralStats === 'function') ? calculateGeneralStats() : {};
        const podiums = calculatePodiums();
        let msg = '🏓 ' + nombre + '\n';
        msg += '📅 ' + hoy + '\n\n';
        msg += '📊 ' + t('RESULTADOS PARCIALES') + '\n';
        msg += '✅ ' + t('Partidos jugados:') + ' ' + (stats.completedMatches || 0) + ' ' + t('de') + ' ' + (stats.totalMatches || 0) + '\n';
        if (stats.totalMatches > 0) msg += '📈 ' + t('Progreso:') + ' ' + (stats.completionPercentage || 0) + '%\n';
        msg += '\n🏆 ' + t('LÍDERES POR CATEGORÍA') + '\n';
        const cats = Object.keys(podiums || {}).sort();
        if (cats.length === 0) {
            msg += t('Sin resultados aún.') + '\n';
        } else {
            cats.forEach(cat => {
                if (podiums[cat].length > 0) {
                    msg += '\n⭐ ' + cat + '\n';
                    podiums[cat].slice(0, 3).forEach((p, i) => {
                        msg += (['🥇', '🥈', '🥉'][i] || '▫️') + ' ' + p.name + (p.club ? ' (' + p.club + ')' : '') + '\n';
                    });
                }
            });
        }
        msg += '\n' + t('¡La competencia sigue! 🔥');
        return msg;
    }

    // 'podios' (default)
    return buildPodioDiffusionMessage(calculatePodiums());
};

/**
 * Abre WhatsApp con el texto actual del modal de difusión.
 * @param {string} taId - id del textarea
 */
window.diffusionOpenWhatsApp = function(taId) {
    const ta = document.getElementById(taId);
    const texto = ta ? ta.value : '';
    if (typeof window.shareToWhatsApp === 'function') {
        window.shareToWhatsApp(texto);
    } else {
        showToast(t('No se pudo abrir WhatsApp'), 'error');
    }
};

/**
 * Modal de plantillas de difusión: elegí el tipo, editá el texto y
 * copialo o abrí WhatsApp con el mensaje listo.
 */
window.showDiffusionTemplates = function() {
    const taId = 'diffusion-template-text';
    const selId = 'diffusion-template-type';

    const tipos = [
        ['inscripcion', '📢 ' + t('Convocatoria a inscripción')],
        ['dia-torneo', '🎉 ' + t('Día del torneo')],
        ['resultados', '📊 ' + t('Resultados parciales')],
        ['podios', '🏆 ' + t('Podios finales')]
    ];
    const opts = tipos.map(t => '<option value="' + t[0] + '">' + t[1] + '</option>').join('');

    const content =
        '<div style="color: var(--text-color);">' +
            '<div style="text-align: center; margin-bottom: 15px;"><div style="font-size: 48px;">📣</div></div>' +
            '<label style="font-weight: bold; font-size: 13px;">' + t('TIPO DE MENSAJE:') + '</label>' +
            '<select id="' + selId + '" onchange="refreshDiffusionTemplate()" style="width: 100%; padding: 10px; margin: 6px 0 12px 0; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">' + opts + '</select>' +
            '<textarea id="' + taId + '" style="width: 100%; min-height: 240px; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color); font-family: monospace; font-size: 13px; resize: vertical;">' + statsEsc(buildDiffusionTemplate('inscripcion')) + '</textarea>' +
            '<p style="font-size: 12px; color: var(--text-muted); margin: 8px 0 0 0;">💡 ' + t('Editá el mensaje y copialo o abrí WhatsApp directo con él.') + '</p>' +
            '<div class="button-grid" style="margin-top: 15px;">' +
                '<button class="btn btn-success" onclick="copyDiffusionTemplate()">📋 ' + t('Copiar') + '</button>' +
                '<button class="btn btn-info" onclick="diffusionOpenWhatsApp(\'' + taId + '\')">📲 ' + t('Abrir WhatsApp') + '</button>' +
            '</div>' +
        '</div>';

    showModal(t('📣 Difusión por Plantillas'), content, null);
};

/**
 * Regenera el texto del modal de plantillas según el tipo elegido.
 */
window.refreshDiffusionTemplate = function() {
    const sel = document.getElementById('diffusion-template-type');
    const ta = document.getElementById('diffusion-template-text');
    if (!sel || !ta) return;
    ta.value = buildDiffusionTemplate(sel.value);
};

/**
 * Copia el texto editado de la plantilla al portapapeles.
 */
window.copyDiffusionTemplate = function() {
    const ta = document.getElementById('diffusion-template-text');
    copyTextToClipboard(ta ? ta.value : '', 'Mensaje');
};


/**
 * Muestra el mensaje de difusión para copiar al portapapeles.
 */
window.showWhatsAppDiffusion = function() {
    const podiums = calculatePodiums();
    const msg = buildPodioDiffusionMessage(podiums);
    const taId = 'diffusion-whatsapp-text';

    showModal(
        t('📲 Difusión WhatsApp'),
        '<div style="color: var(--text-color);">' +
            '<div style="text-align: center; margin-bottom: 15px;"><div style="font-size: 48px;">📲</div></div>' +
            '<p style="margin: 0 0 10px 0;"><strong>' + t('Mensaje con el podio del día:') + '</strong></p>' +
            '<textarea id="' + taId + '" style="width: 100%; min-height: 260px; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color); font-family: monospace; font-size: 13px; resize: vertical;">' + statsEsc(msg) + '</textarea>' +
            '<p style="font-size: 12px; color: var(--text-muted); margin: 8px 0 0 0;">💡 ' + t('Editá el mensaje y copialo o abrí WhatsApp directo con él.') + '</p>' +
            '<div class="button-grid" style="margin-top: 15px;">' +
                '<button class="btn btn-success" onclick="copyDiffusionWhatsApp()">📋 ' + t('Copiar') + '</button>' +
                '<button class="btn btn-info" onclick="diffusionOpenWhatsApp(\'' + taId + '\')">📲 ' + t('Abrir WhatsApp') + '</button>' +
            '</div>' +
        '</div>',
        function() {
            const ta = document.getElementById(taId);
            copyTextToClipboard(ta ? ta.value : msg, t('Difusión WhatsApp'));
        },
        '📋 ' + t('Copiar')
    );
};

/**
 * Copia el texto editado de la difusión de WhatsApp al portapapeles.
 */
window.copyDiffusionWhatsApp = function() {
    const ta = document.getElementById('diffusion-whatsapp-text');
    copyTextToClipboard(ta ? ta.value : '', 'Difusión WhatsApp');
};

/**
 * Hub de difusión en redes sociales: plantillas, podios, programación
 * Multiplex e imagen para post.
 */
window.showSocialHub = function() {
    const content =
        '<div style="color: var(--text-color);">' +
            '<div style="text-align: center; margin-bottom: 15px;"><div style="font-size: 48px;">📣</div></div>' +
            '<p style="margin: 0 0 15px 0; text-align: center;">' + t('Compartí novedades del torneo en tus redes sociales.') + '</p>' +
            '<div class="button-grid" style="grid-template-columns: 1fr 1fr; gap: 10px;">' +
                '<button class="btn btn-primary" onclick="closeModal(); showDiffusionTemplates()" style="padding: 18px 10px;">📝 ' + t('Plantillas') + '<br><small style="font-weight: normal;">' + t('Mensajes listos') + '</small></button>' +
                '<button class="btn btn-info" onclick="closeModal(); showWhatsAppDiffusion()" style="padding: 18px 10px;">🏆 ' + t('Podios del Día') + '<br><small style="font-weight: normal;">WhatsApp</small></button>' +
                '<button class="btn btn-success" onclick="closeModal(); shareScheduleMultiplex()" style="padding: 18px 10px;">🕒 ' + t('Multiplex') + '<br><small style="font-weight: normal;">' + t('Mesas y horarios') + '</small></button>' +
                '<button class="btn btn-warning" onclick="closeModal(); exportPodiumsImage()" style="padding: 18px 10px;">🖼️ ' + t('Imagen de Podios') + '<br><small style="font-weight: normal;">' + t('Para publicar') + '</small></button>' +
            '</div>' +
        '</div>';

    showModal(t('📣 Difundir en Redes'), content, null);
};

/**
 * Genera una imagen PNG (1080x1080) con los podios y el logo de
 * patrocinadores, lista para publicar en Instagram/Facebook.
 */
window.exportPodiumsImage = function() {
    if (typeof document.createElement('canvas').getContext !== 'function') {
        showToast(t('Tu navegador no soporta la generación de imágenes'), 'error');
        return;
    }
    const podiums = calculatePodiums();
    const cats = Object.keys(podiums || {}).sort();
    if (cats.length === 0) {
        showToast(t('No hay podios para generar la imagen'), 'error');
        return;
    }

    const W = 1080, H = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Fondo degradado
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#1e3a8a');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Título
    const nombre = (tournamentData.settings && tournamentData.settings.torneoNombre) || 'Torneo';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText('🏓 ' + nombre + ' 🏓', W / 2, 100);
    ctx.font = '28px sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(t('PODIOS DEL TORNEO'), W / 2, 160);

    // Podios por categoría
    let y = 220;
    const medallas = ['🥇', '🥈', '🥉'];
    cats.forEach(cat => {
        const top3 = (podiums[cat] || []).slice(0, 3);
        if (top3.length === 0) return;

        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 34px sans-serif';
        ctx.fillText('⭐ ' + cat, W / 2, y);
        y += 12;

        top3.forEach((p, i) => {
            ctx.fillStyle = '#ffffff';
            ctx.font = '28px sans-serif';
            ctx.fillText(medallas[i] + ' ' + p.name, W / 2, y + 45);
            ctx.fillStyle = '#94a3b8';
            ctx.font = '24px sans-serif';
            const club = p.club ? p.club : '';
            ctx.fillText(club + (p.points != null ? ' — ' + p.points + ' pts' : ''), W / 2, y + 78);
            y += 100;
        });
        y += 28;
    });

    // Patrocinadores (nombres)
    const pats = (tournamentData.settings && tournamentData.settings.patrocinadores) || [];
    const footerY = H - 70;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px sans-serif';
    ctx.fillText(t('Auspician:'), W / 2, footerY - 20);
    ctx.font = '26px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    const patNames = pats.map(p => p.nombre || p.name).filter(Boolean);
    ctx.fillText(patNames.length ? patNames.join('  ·  ') : '—', W / 2, footerY + 20);

    // Descargar / compartir
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'podios.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    addLog('DIFUSIÓN', t('Imagen de podios generada (podios.png)'));
    showToast(t('🖼️ Imagen de podios generada — publicala en tus redes'));
};

/**
 * Muestra el reporte final en pantalla
 * @param {Object} podiums - Podios por categoría
 * @param {Object} stats - Estadísticas generales
 */
window.displayFinalReport = function(podiums, stats) {
    const torneoNombre = tournamentData.settings.torneoNombre;
    const subtitulo = tournamentData.settings.subtitulo;
    const fechaFinal = new Date().toLocaleString(window.i18nLocale(), {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    let html = `
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: var(--btn-primary); margin: 0;">🏆 ${t('REPORTE FINAL DEL TORNEO')}</h1>
            <h2 style="color: var(--text-color); margin: 10px 0;">${torneoNombre}</h2>
            <p style="color: var(--text-muted); margin: 5px 0;">${subtitulo}</p>
            <p style="color: var(--text-muted); font-size: 14px; margin: 10px 0;">${t('Finalizado el')} ${fechaFinal}</p>
        </div>

        <div style="background: linear-gradient(135deg, var(--btn-success), #218838); color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; text-align: center;">
            <h3 style="margin: 0 0 15px 0; font-size: 24px;">📊 ${t('ESTADÍSTICAS GENERALES')}</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-top: 20px;">
                <div>
                    <div style="font-size: 36px; font-weight: bold;">${stats.totalCategories}</div>
                    <div style="font-size: 14px; opacity: 0.9;">${t('Categorías')}</div>
                </div>
                <div>
                    <div style="font-size: 36px; font-weight: bold;">${stats.totalGroups}</div>
                    <div style="font-size: 14px; opacity: 0.9;">${t('Grupos')}</div>
                </div>
                <div>
                    <div style="font-size: 36px; font-weight: bold;">${stats.totalPlayers}</div>
                    <div style="font-size: 14px; opacity: 0.9;">${t('Jugadores')}</div>
                </div>
                <div>
                    <div style="font-size: 36px; font-weight: bold;">${stats.completedMatches}</div>
                    <div style="font-size: 14px; opacity: 0.9;">${t('Partidos Jugados')}</div>
                </div>
                <div>
                    <div style="font-size: 36px; font-weight: bold;">${stats.totalSets}</div>
                    <div style="font-size: 14px; opacity: 0.9;">${t('Sets Totales')}</div>
                </div>
                <div>
                    <div style="font-size: 36px; font-weight: bold;">${stats.completionPercentage}%</div>
                    <div style="font-size: 14px; opacity: 0.9;">${t('Completado')}</div>
                </div>
            </div>
        </div>
    `;

    // Récords del torneo
    const records = calculateTournamentRecords();
    html += '<div style="margin-bottom: 30px;">';
    html += '<h3 style="color: var(--btn-primary); border-bottom: 3px solid var(--btn-primary); padding-bottom: 10px; margin-bottom: 20px;">🏅 ' + t('RÉCORDS DEL TORNEO') + '</h3>';
    html += '<div class="dashboard-grid">';
    if (records.longestMatch) {
        html += '<div class="stat-card"><h4>⏱️ ' + t('Partido más largo') + '</h4><div class="stat-value" style="font-size: 20px;">' + records.longestMatch.total + ' pts</div><div class="stat-label">' + statsEsc(records.longestMatch.players) + '<br>' + statsEsc(records.longestMatch.sets) + '</div></div>';
    } else {
        html += '<div class="stat-card"><h4>⏱️ ' + t('Partido más largo') + '</h4><div class="stat-value">—</div><div class="stat-label">' + t('Sin datos') + '</div></div>';
    }
    if (records.closestSet) {
        html += '<div class="stat-card"><h4>🔥 ' + t('Set más cerrado') + '</h4><div class="stat-value" style="font-size: 20px;">' + statsEsc(records.closestSet.score) + '</div><div class="stat-label">' + statsEsc(records.closestSet.players) + '</div></div>';
    } else {
        html += '<div class="stat-card"><h4>🔥 ' + t('Set más cerrado') + '</h4><div class="stat-value">—</div><div class="stat-label">' + t('Sin datos') + '</div></div>';
    }
    html += '</div></div>';

    // MVP por categoría
    const mvp = calculateCategoryMVP();
    const mvpCats = Object.keys(mvp).sort();
    if (mvpCats.length > 0) {
        html += '<div style="margin-bottom: 30px;">';
        html += '<h3 style="color: var(--btn-primary); border-bottom: 3px solid var(--btn-primary); padding-bottom: 10px; margin-bottom: 20px;">⭐ ' + t('MVP POR CATEGORÍA') + '</h3>';
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px;">';
        mvpCats.forEach(cat => {
            const p = mvp[cat];
            html += '<div style="background: var(--header-bg); padding: 15px; border-radius: 8px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">';
            html += '<div style="font-size: 32px; margin-bottom: 5px;">⭐</div>';
            html += '<div style="font-size: 13px; font-weight: bold; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">' + statsEsc(cat) + '</div>';
            html += '<div style="font-size: 16px; font-weight: bold;">' + statsEsc(p.name) + '</div>';
            html += '<div style="font-size: 13px; color: var(--text-muted);">' + statsEsc(p.club) + '</div>';
            html += '<div style="font-size: 13px; margin-top: 6px;">' + p.wins + ' ' + t('G') + ' / ' + p.losses + ' ' + t('P') + '</div>';
            html += '</div>';
        });
        html += '</div></div>';
    }

    // Podios por categoría
    html += '<div style="margin-bottom: 30px;">';
    html += '<h3 style="color: var(--btn-primary); border-bottom: 3px solid var(--btn-primary); padding-bottom: 10px; margin-bottom: 20px;">🏆 ' + t('PODIOS POR CATEGORÍA') + '</h3>';

    const categories = Object.keys(podiums).sort();

    if (categories.length === 0) {
        html += '<div class="alert alert-info">' + t('No hay datos suficientes para generar podios.') + '</div>';
    } else {
        categories.forEach(categoria => {
            const top3 = podiums[categoria].slice(0, 3);

            if (top3.length > 0) {
                html += `
                    <div style="background: var(--header-bg); padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <h4 style="color: var(--text-color); margin: 0 0 20px 0; font-size: 20px; text-align: center; text-transform: uppercase;">
                            ${categoria}
                        </h4>

                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; align-items: end;">
                `;

                // Segundo lugar (si existe)
                if (top3.length >= 2) {
                    html += `
                        <div style="text-align: center; order: 1;">
                            <div style="font-size: 48px; margin-bottom: 10px;">🥈</div>
                            <div style="background: linear-gradient(135deg, #C0C0C0, #A8A8A8); color: white; padding: 20px; border-radius: 8px; min-height: 140px; display: flex; flex-direction: column; justify-content: center;">
                                <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">${t('2° LUGAR')}</div>
                                <div style="font-size: 16px; margin-bottom: 3px;">${top3[1].name}</div>
                                <div style="font-size: 14px; opacity: 0.9;">${top3[1].club}</div>
                                <div style="font-size: 24px; font-weight: bold; margin-top: 10px;">${top3[1].points} pts</div>
                                <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">${t('Grupo(s):')} ${top3[1].groups.join(', ')}</div>
                            </div>
                        </div>
                    `;
                }

                // Primer lugar
                html += `
                    <div style="text-align: center; order: ${top3.length >= 2 ? '0' : '1'};">
                        <div style="font-size: 64px; margin-bottom: 10px;">🥇</div>
                        <div style="background: linear-gradient(135deg, #FFD700, #FFA500); color: #333; padding: 25px; border-radius: 8px; min-height: 160px; display: flex; flex-direction: column; justify-content: center; box-shadow: 0 4px 12px rgba(255,215,0,0.4);">
                            <div style="font-size: 20px; font-weight: bold; margin-bottom: 5px;">🏆 ${t('CAMPEÓN')}</div>
                            <div style="font-size: 18px; font-weight: bold; margin-bottom: 3px;">${top3[0].name}</div>
                            <div style="font-size: 15px; font-weight: 600;">${top3[0].club}</div>
                            <div style="font-size: 28px; font-weight: bold; margin-top: 10px;">${top3[0].points} pts</div>
                            <div style="font-size: 13px; margin-top: 5px;">${t('Grupo(s):')} ${top3[0].groups.join(', ')}</div>
                        </div>
                    </div>
                `;

                // Tercer lugar (si existe)
                if (top3.length >= 3) {
                    html += `
                        <div style="text-align: center; order: 2;">
                            <div style="font-size: 48px; margin-bottom: 10px;">🥉</div>
                            <div style="background: linear-gradient(135deg, #CD7F32, #B8722C); color: white; padding: 20px; border-radius: 8px; min-height: 140px; display: flex; flex-direction: column; justify-content: center;">
                                <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">${t('3° LUGAR')}</div>
                                <div style="font-size: 16px; margin-bottom: 3px;">${top3[2].name}</div>
                                <div style="font-size: 14px; opacity: 0.9;">${top3[2].club}</div>
                                <div style="font-size: 24px; font-weight: bold; margin-top: 10px;">${top3[2].points} pts</div>
                                <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">${t('Grupo(s):')} ${top3[2].groups.join(', ')}</div>
                            </div>
                        </div>
                    `;
                }

                html += '</div></div>';
            }
        });
    }

    html += '</div>';

    // Botones de acción
    html += `
        <div class="button-grid" style="margin-top: 30px;">
            <button class="btn btn-primary" onclick="printFinalReport()">🖨️ ${t('Imprimir Reporte')}</button>
            <button class="btn btn-success" onclick="exportFinalReportPDF()">📄 ${t('Exportar PDF')}</button>
            <button class="btn btn-dark" onclick="generateCertificatesModal()">🎓 ${t('Generar Certificados')}</button>
            <button class="btn btn-info" onclick="showWhatsAppDiffusion()">📲 ${t('Difusión WhatsApp')}</button>
            <button class="btn btn-info" onclick="showTab('dashboard')">📊 ${t('Ir al Dashboard')}</button>
        </div>
    `;

    // Mostrar en un modal grande
    const modal = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    const modalTitle = document.getElementById('modal-title');

    modalTitle.innerHTML = '🏆 ' + t('REPORTE FINAL DEL TORNEO');
    modalContent.innerHTML = html;

    // Ocultar botón de confirmar
    document.getElementById('modal-confirm').style.display = 'none';

    modal.style.display = 'flex';

    showToast(t('✅ Torneo finalizado - Reporte generado'));
};

/**
 * Imprime el reporte final en una ventana A4 con estilos profesionales
 */
window.printFinalReport = function() {
    const torneoNombre = tournamentData.settings.torneoNombre;
    const subtitulo = tournamentData.settings.subtitulo;

    const now = new Date();
    const fechaFinal = now.toLocaleDateString(window.i18nLocale(), {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const horaFinal = now.toLocaleTimeString(window.i18nLocale(), {
        hour: '2-digit',
        minute: '2-digit'
    });

    // Recalcular podios y estadísticas
    const podiums = calculatePodiums();
    const stats = calculateGeneralStats();

    const categories = Object.keys(podiums).sort();

    // Construir HTML por páginas
    let pagesHTML = '';

    // Página 1: Estadísticas generales
    pagesHTML += `
        <div class="page page-stats">
            <div class="page-header">
                <h1>🏓 ${torneoNombre}</h1>
                <h2>${subtitulo}</h2>
                <p class="fecha">${t('Finalizado el')} ${fechaFinal} ${t('a las')} ${horaFinal}</p>
            </div>

            <h2 class="section-title">📊 ${t('ESTADÍSTICAS GENERALES DEL TORNEO')}</h2>

            <div class="stats-grid">
                <div class="stat-box">
                    <div class="stat-number">${stats.totalCategories}</div>
                    <div class="stat-label">${t('Categorías')}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${stats.totalGroups}</div>
                    <div class="stat-label">${t('Grupos')}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${stats.totalPlayers}</div>
                    <div class="stat-label">${t('Jugadores')}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${stats.completedMatches}</div>
                    <div class="stat-label">${t('Partidos Jugados')}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${stats.totalSets}</div>
                    <div class="stat-label">${t('Sets Totales')}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${stats.completionPercentage}%</div>
                    <div class="stat-label">${t('Completado')}</div>
                </div>
            </div>

            <div class="category-list">
                <h3>🏆 ${t('Categorías del Torneo')}</h3>
                <ul>
                    ${categories.map(cat => `<li>${escHtml(cat)}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;

    // Páginas 2+: Una página por cada categoría
    categories.forEach((categoria, index) => {
        const top3 = podiums[categoria].slice(0, 3);

        if (top3.length > 0) {
            pagesHTML += `
                <div class="page page-category">
                    <div class="page-header">
                        <h1>🏓 ${torneoNombre}</h1>
                        <p class="categoria-title">${t('CATEGORÍA:')} ${categoria}</p>
                    </div>

                    <h2 class="section-title">🏆 ${t('PODIO')} - ${categoria}</h2>

                    <div class="podium-container">
            `;

            // Segundo lugar (si existe)
            if (top3.length >= 2) {
                pagesHTML += `
                    <div class="podium-place second">
                        <div class="medal">🥈</div>
                        <div class="podium-box silver">
                            <div class="position">${t('2° LUGAR')}</div>
                            <div class="player-name">${top3[1].name}</div>
                            <div class="player-club">${top3[1].club}</div>
                            <div class="points">${top3[1].points} pts</div>
                            <div class="groups">${t('Grupo(s):')} ${top3[1].groups.join(', ')}</div>
                        </div>
                    </div>
                `;
            }

            // Primer lugar
            pagesHTML += `
                <div class="podium-place first">
                    <div class="medal">🥇</div>
                    <div class="podium-box gold">
                        <div class="position">${t('CAMPEÓN')}</div>
                        <div class="player-name">${top3[0].name}</div>
                        <div class="player-club">${top3[0].club}</div>
                        <div class="points">${top3[0].points} pts</div>
                        <div class="groups">${t('Grupo(s):')} ${top3[0].groups.join(', ')}</div>
                    </div>
                </div>
            `;

            // Tercer lugar (si existe)
            if (top3.length >= 3) {
                pagesHTML += `
                    <div class="podium-place third">
                        <div class="medal">🥉</div>
                        <div class="podium-box bronze">
                            <div class="position">${t('3° LUGAR')}</div>
                            <div class="player-name">${top3[2].name}</div>
                            <div class="player-club">${top3[2].club}</div>
                            <div class="points">${top3[2].points} pts</div>
                            <div class="groups">${t('Grupo(s):')} ${top3[2].groups.join(', ')}</div>
                        </div>
                    </div>
                `;
            }

            pagesHTML += `
                    </div>

                    ${podiums[categoria].length > 3 ? `
                        <div class="ranking-table">
                            <h3>📋 ${t('Clasificación Completa')}</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th>${t('Pos.')}</th>
                                        <th>${t('Jugador')}</th>
                                        <th>${t('Club')}</th>
                                        <th>${t('Puntos')}</th>
                                        <th>${t('Grupo(s)')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${podiums[categoria].slice(3).map((player, idx) => `
                                        <tr>
                                            <td>${idx + 4}°</td>
                                            <td>${escHtml(player.name)}</td>
                                            <td>${escHtml(player.club)}</td>
                                            <td>${player.points}</td>
                                            <td>${player.groups.map(escHtml).join(', ')}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}
                </div>
            `;
        }
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${t('Reporte Final')} - ${torneoNombre}</title>
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
                    background: white;
                }

                .page {
                    width: 210mm;
                    min-height: 297mm;
                    padding: 15mm;
                    page-break-after: always;
                    position: relative;
                }

                .page:last-child {
                    page-break-after: auto;
                }

                .page-header {
                    text-align: center;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 3px solid #FFD700;
                }

                .page-header h1 {
                    margin: 0 0 5px 0;
                    font-size: 24px;
                    color: #333;
                }

                .page-header h2 {
                    margin: 0 0 5px 0;
                    font-size: 18px;
                    color: #666;
                }

                .page-header .fecha {
                    font-size: 12px;
                    color: #999;
                    margin: 5px 0;
                }

                .page-header .categoria-title {
                    font-size: 20px;
                    font-weight: bold;
                    color: #007BFF;
                    margin: 10px 0;
                    text-transform: uppercase;
                }

                .section-title {
                    text-align: center;
                    font-size: 22px;
                    color: #007BFF;
                    margin: 20px 0;
                    text-transform: uppercase;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 15px;
                    margin: 30px 0;
                }

                .stat-box {
                    background: linear-gradient(135deg, #28a745, #218838);
                    color: white;
                    padding: 20px;
                    border-radius: 8px;
                    text-align: center;
                }

                .stat-number {
                    font-size: 36px;
                    font-weight: bold;
                    margin-bottom: 8px;
                }

                .stat-label {
                    font-size: 14px;
                    opacity: 0.9;
                }

                .category-list {
                    margin-top: 30px;
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                }

                .category-list h3 {
                    margin-top: 0;
                    color: #007BFF;
                }

                .category-list ul {
                    column-count: 2;
                    column-gap: 20px;
                }

                .category-list li {
                    margin-bottom: 8px;
                    font-weight: 600;
                }

                .podium-container {
                    display: flex;
                    justify-content: center;
                    align-items: flex-end;
                    margin: 40px 0;
                    gap: 20px;
                }

                .podium-place {
                    text-align: center;
                    flex: 1;
                }

                .podium-place.first {
                    order: 2;
                }

                .podium-place.second {
                    order: 1;
                }

                .podium-place.third {
                    order: 3;
                }

                .medal {
                    font-size: 48px;
                    margin-bottom: 10px;
                }

                .podium-place.first .medal {
                    font-size: 64px;
                }

                .podium-box {
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }

                .podium-box.gold {
                    background: linear-gradient(135deg, #FFD700, #FFA500);
                    color: #333;
                    padding: 30px 20px;
                    min-height: 180px;
                }

                .podium-box.silver {
                    background: linear-gradient(135deg, #C0C0C0, #A8A8A8);
                    color: white;
                    min-height: 160px;
                }

                .podium-box.bronze {
                    background: linear-gradient(135deg, #CD7F32, #B8722C);
                    color: white;
                    min-height: 160px;
                }

                .position {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 8px;
                }

                .podium-place.first .position {
                    font-size: 18px;
                }

                .player-name {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 5px;
                }

                .podium-place.first .player-name {
                    font-size: 20px;
                }

                .player-club {
                    font-size: 14px;
                    margin-bottom: 10px;
                    opacity: 0.9;
                }

                .points {
                    font-size: 24px;
                    font-weight: bold;
                    margin-top: 10px;
                }

                .podium-place.first .points {
                    font-size: 28px;
                }

                .groups {
                    font-size: 12px;
                    margin-top: 8px;
                    opacity: 0.8;
                }

                .ranking-table {
                    margin-top: 30px;
                }

                .ranking-table h3 {
                    color: #007BFF;
                    margin-bottom: 15px;
                }

                .ranking-table table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .ranking-table th,
                .ranking-table td {
                    padding: 10px;
                    text-align: left;
                    border: 1px solid #ddd;
                }

                .ranking-table th {
                    background-color: #FFD700;
                    color: #333;
                    font-weight: bold;
                }

                .ranking-table td:first-child,
                .ranking-table th:first-child {
                    text-align: center;
                    width: 60px;
                }

                .ranking-table td:nth-child(4),
                .ranking-table th:nth-child(4) {
                    text-align: center;
                    font-weight: bold;
                }

                @page {
                    size: A4;
                    margin: 0;
                }

                @media print {
                    body {
                        margin: 0;
                        padding: 0;
                    }

                    .page {
                        page-break-after: always;
                        page-break-inside: avoid;
                    }

                    .page:last-child {
                        page-break-after: auto;
                    }
                }
            </style>
        </head>
        <body>
            ${pagesHTML}

            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(() => window.close(), 500);
                };
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();

    addLog('IMPRIMIR', t('Reporte final impreso'));
};

/**
 * Exporta el reporte final a PDF
 */
window.exportFinalReportPDF = function() {
    printFinalReport();
    showToast(t('Reporte enviado a impresora / PDF'));
};

/**
 * Exporta un reporte completo del torneo a PDF (imprimir / guardar como PDF)
 * Disponible en cualquier momento: estadísticas, podios y posiciones de grupos.
 */
window.exportTournamentPDF = function() {
    if (!tournamentData.fixtures || tournamentData.fixtures.length === 0) {
        showToast(t('No hay datos para exportar. Genera al menos un fixture.'), 'error');
        return;
    }

    const torneoNombre = tournamentData.settings.torneoNombre;
    const subtitulo = tournamentData.settings.subtitulo;
    const podiums = calculatePodiums();
    const categories = Object.keys(podiums).sort();
    const fechaGeneracion = new Date().toLocaleString(window.i18nLocale(), {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    let bodyHTML = '';

    const stats = calculateGeneralStats();

    bodyHTML += `
        <div class="stats-row">
            <div class="stat-box"><div class="num">${stats.totalCategories}</div><div class="lbl">${t('Categorías')}</div></div>
            <div class="stat-box"><div class="num">${stats.totalGroups}</div><div class="lbl">${t('Grupos')}</div></div>
            <div class="stat-box"><div class="num">${stats.totalPlayers}</div><div class="lbl">${t('Jugadores')}</div></div>
            <div class="stat-box"><div class="num">${stats.completedMatches}</div><div class="lbl">${t('Partidos')}</div></div>
            <div class="stat-box"><div class="num">${stats.totalSets}</div><div class="lbl">${t('Sets')}</div></div>
            <div class="stat-box"><div class="num">${stats.completionPercentage}%</div><div class="lbl">${t('Completado')}</div></div>
        </div>`;

    categories.forEach(cat => {
        const podium = podiums[cat] || [];

        bodyHTML += `<div class="section">
            <h2>🏆 ${t('Categoría:')} ${escHtml(cat)}</h2>`;

        if (podium.length > 0) {
            bodyHTML += `
            <div class="podium">
                <div class="entry"><span class="med">🥇</span> <strong>${escHtml(podium[0].name)}</strong> <span class="club">(${escHtml(podium[0].club)})</span> — ${podium[0].points} pts</div>
                ${podium[1] ? `<div class="entry"><span class="med">🥈</span> <strong>${escHtml(podium[1].name)}</strong> <span class="club">(${escHtml(podium[1].club)})</span> — ${podium[1].points} pts</div>` : ''}
                ${podium[2] ? `<div class="entry"><span class="med">🥉</span> <strong>${escHtml(podium[2].name)}</strong> <span class="club">(${escHtml(podium[2].club)})</span> — ${podium[2].points} pts</div>` : ''}
            </div>`;

            if (podium.length > 3) {
                bodyHTML += `
                <h3>${t('Clasificación completa')}</h3>
                <table>
                    <tr><th>${t('Pos.')}</th><th>${t('Jugador')}</th><th>${t('Club')}</th><th>${t('Puntos')}</th><th>${t('Grupo(s)')}</th></tr>
                    ${podium.slice(3).map((p, i) => `
                        <tr><td>${i + 4}°</td><td>${escHtml(p.name)}</td><td>${escHtml(p.club)}</td><td>${p.points}</td><td>${p.groups.map(escHtml).join(', ')}</td></tr>
                    `).join('')}
                </table>`;
            }
        } else {
            bodyHTML += `<p>${t('Sin resultados registrados.')}</p>`;
        }

        const fixtures = tournamentData.fixtures.filter(f => f.categoria === cat);
        if (fixtures.length > 0) {
            bodyHTML += `<h3>${t('Grupos y posiciones')}</h3>`;
            fixtures.forEach(fixture => {
                const ranked = [...fixture.players].sort((a, b) => comparePlayersWithTiebreak(fixture, a, b));
                const reales = ranked.filter(p => p.name !== '-' && p.club !== '-');
                bodyHTML += `
                <div class="group">
                    <h4>${t('Grupo')} ${fixture.grupo}</h4>
                    <table>
                        <tr><th>${t('Pos.')}</th><th>${t('Jugador')}</th><th>${t('Club')}</th><th>${t('Puntos')}</th></tr>
                        ${reales.map((p, i) => `<tr><td>${i + 1}°</td><td>${escHtml(p.name)}</td><td>${escHtml(p.club)}</td><td>${p.points || 0}</td></tr>`).join('')}
                    </table>
                </div>`;
            });
        }

        bodyHTML += `</div>`;
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${t('Reporte del Torneo')} - ${escHtml(torneoNombre)}</title>
            <style>
                * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; margin: 0; padding: 0; }
                body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px; }
                .report { background: white; max-width: 210mm; margin: 0 auto; padding: 20mm; }
                h1 { color: #2c3e50; margin-bottom: 4px; font-size: 24px; }
                h2 { color: #007BFF; margin: 20px 0 10px 0; font-size: 18px; border-bottom: 2px solid #FFD700; padding-bottom: 5px; }
                h3 { color: #2c3e50; margin: 15px 0 8px 0; font-size: 14px; }
                h4 { color: #555; margin: 10px 0 5px 0; font-size: 13px; }
                .sub { color: #7f8c8d; font-style: italic; margin-bottom: 5px; }
                .fecha { color: #999; font-size: 11px; margin-bottom: 15px; }
                .podium { margin: 10px 0; }
                .entry { margin: 4px 0; font-size: 14px; }
                .med { font-size: 18px; }
                .club { color: #666; }
                table { width: 100%; border-collapse: collapse; margin: 8px 0 15px 0; }
                th, td { border: 1px solid #999; padding: 6px 8px; text-align: center; font-size: 12px; }
                th { background: #FFD700 !important; color: #333 !important; font-weight: bold; }
                td:first-child, td:nth-child(2) { text-align: left; }
                .group { page-break-inside: avoid; margin-bottom: 10px; }
                .stats-row { display: flex; flex-wrap: wrap; gap: 10px; margin: 15px 0; }
                .stat-box { flex: 1 1 90px; background: #f0f4f8; border: 1px solid #ddd; border-radius: 8px; padding: 10px; text-align: center; }
                .stat-box .num { font-size: 20px; font-weight: bold; color: #007BFF; }
                .stat-box .lbl { font-size: 11px; color: #666; margin-top: 2px; }
                @page { size: A4; margin: 15mm; }
                @media print {
                    body { background: white; padding: 0; }
                    .report { max-width: none; margin: 0; padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="report">
                <h1>🏓 ${torneoNombre}</h1>
                <div class="sub">${subtitulo}</div>
                <div class="fecha">${t('Generado el')} ${fechaGeneracion} | ${t('Categorías:')} ${categories.length}</div>
                ${bodyHTML}
            </div>
            <script>
                window.onload = function() {
                    setTimeout(function() { window.print(); }, 500);
                };
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();

    addLog('EXPORTAR PDF', t('Reporte completo del torneo generado') + ` (${categories.length} ${t('categorías')})`);
    showToast(t('📄 Reporte generado - listo para imprimir / guardar como PDF'));
};

// ==========================================
// RESET COMPLETO DEL SISTEMA
// ==========================================

/**
 * Resetea completamente el sistema (requiere contraseña)
 */
window.resetCompleteSystem = function() {
    showModal(
        t('🔥 Resetear Sistema Completo'),
        `<div style="color: var(--text-color);">
            <div class="danger-box" style="margin-bottom: 20px; text-align: center;">
                <strong style="font-size: 18px;">⚠️ ${t('ADVERTENCIA CRÍTICA')} ⚠️</strong>
            </div>

            <p style="font-weight: bold; color: var(--danger);">${t('Esta acción eliminará ABSOLUTAMENTE TODO:')}</p>

            <div class="danger-box" style="margin: 15px 0;">
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>✗ ${t('Todos los fixtures generados')}</li>
                    <li>✗ ${t('Todos los resultados de partidos')}</li>
                    <li>✗ ${t('Base de datos completa de jugadores')}</li>
                    <li>✗ ${t('Todas las configuraciones')}</li>
                    <li>✗ ${t('Todo el historial de logs')}</li>
                    <li>✗ ${t('Todas las llaves eliminatorias')}</li>
                </ul>
            </div>

            <p style="font-weight: bold; margin-top: 20px;">${t('Para continuar, ingresa la contraseña de seguridad:')}</p>

            <div style="margin: 15px 0;">
                <input type="password"
                       id="reset-password"
                       placeholder="${t('Contraseña de seguridad')}"
                       style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color); font-size: 16px; text-align: center;"
                       onkeypress="if(event.key === 'Enter') confirmResetSystem()">
            </div>

            <p style="font-size: 12px; color: var(--text-muted); text-align: center; margin-top: 10px;">
                ${t('Presiona Enter después de escribir la contraseña')}
            </p>
        </div>`,
        null
    );

    const confirmBtn = document.getElementById('modal-confirm');
    confirmBtn.textContent = t('🔥 Verificar y Resetear');
    confirmBtn.onclick = function() {
        confirmResetSystem();
    };
    confirmBtn.style.display = 'inline-flex';

    setTimeout(() => {
        const passwordInput = document.getElementById('reset-password');
        if (passwordInput) passwordInput.focus();
    }, 100);
};

/**
 * Confirma el reset del sistema verificando la contraseña
 */
function confirmResetSystem() {
    const passwordInput = document.getElementById('reset-password');
    const password = passwordInput ? passwordInput.value : '';

    if (password !== 'admin') {
        showToast(t('❌ Contraseña incorrecta'), 'error');
        passwordInput.value = '';
        passwordInput.focus();
        passwordInput.style.borderColor = 'var(--danger)';
        passwordInput.style.animation = 'shake 0.5s';
        return;
    }

    closeModal();

    showModal(
        t('⚠️ ÚLTIMA CONFIRMACIÓN'),
        `<div style="text-align: center; color: var(--text-color);">
            <div style="font-size: 64px; margin: 20px 0;">🔥</div>
            <p style="font-size: 18px; font-weight: bold; color: var(--danger);">
                ${t('¿Estás ABSOLUTAMENTE seguro?')}
            </p>
            <p>${t('Esta es tu última oportunidad para cancelar.')}</p>
            <p style="font-size: 14px; color: var(--text-muted);">
                ${t('Se eliminarán')} <strong>${tournamentData.fixtures.length}</strong> ${t('fixtures')},
                <strong>${tournamentData.players.length}</strong> ${t('jugadores')},
                ${t('y')} <strong>${tournamentData.logs ? tournamentData.logs.length : 0}</strong> ${t('registros')}.
            </p>
            <div class="danger-box" style="margin: 20px 0;">
                <strong>${t('Esta acción es grave pero reversible.')}</strong>
                <p style="color: var(--success); font-size: 13px; margin-top: 8px;">💡 ${t('Consejo: puedes deshacerla con Ctrl+Z o el botón Deshacer.')}</p>
            </div>
        </div>`,
        () => {
            executeCompleteReset();
        }
    );
}

/**
 * Ejecuta el reset completo del sistema
 */
function executeCompleteReset() {
    try {
        // Crear backup de emergencia
        const emergencyBackup = {
            timestamp: new Date().toISOString(),
            version: '2.0',
            type: 'emergency-backup-before-reset',
            data: tournamentData
        };

        const dataStr = JSON.stringify(emergencyBackup, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Backup_Emergencia_Antes_Reset_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(t('💾 Backup de emergencia creado'), 'success');
    } catch (error) {
        console.error('Error creando backup:', error);
    }

    // Resetear todo (misma estructura que la inicial: incluye waitlist y
    // todos los campos de settings para que el multiplex y las llaves
    // funcionen sin necesidad de recargar la página)
    tournamentData = {
        fixtures: [],
        players: [],
        brackets: [],
        settings: {
            torneoNombre: '4° Torneo TENIS DE MESA 🏓',
            subtitulo: 'Circuito Misionero 2025',
            lugar: '',
            fechaInicio: '',
            fechaFin: '',
            organizadores: '',
            patrocinadores: [],
            mesas: 4,
            formato: 'Todos contra todos + llaves eliminatorias',
            duracionPartido: 15,
            formatoPartidoGrupos: 'bo5',
            formatoPartidoLlaves: 'bo5',
            soundEnabled: true
        },
        logs: [],
        waitlist: []
    };

    saveTournamentData();

    // Limpiar outputs
    document.getElementById('fixture-output').innerHTML = '';
    document.getElementById('players-output').innerHTML = '';
    document.getElementById('stats-output').innerHTML = '';
    document.getElementById('brackets-output').innerHTML = '';
    document.getElementById('logs-output').innerHTML = '<p style="color: var(--text-muted); font-style: italic;">' + t('No hay registros aún.') + '</p>';

    updateDashboard();

    addLog('RESET COMPLETO', t('Sistema reseteado completamente - Todos los datos eliminados'));

    showTab('dashboard');

    showModal(
        t('✅ Sistema Reseteado'),
        `<div style="text-align: center; color: var(--text-color);">
            <div style="font-size: 64px; margin: 20px 0;">🔄</div>
            <h2 style="color: var(--btn-success); margin: 10px 0;">${t('¡Sistema Reseteado Completamente!')}</h2>
            <p style="margin: 20px 0;">${t('El sistema ha vuelto al estado inicial.')}</p>

            <div class="success-box" style="margin: 20px 0; text-align: left;">
                <strong>✓ ${t('Todo limpio:')}</strong><br>
                ${t('Base de datos vacía')}<br>
                ${t('Configuración restaurada')}<br>
                ${t('Logs reiniciados')}
            </div>

            <div class="info-box" style="margin: 20px 0; text-align: left;">
                <strong>💾 ${t('Backup guardado:')}</strong><br>
                ${t('Se creó un backup de emergencia antes del reset')}<br>
                <small style="color: var(--text-muted);">${t('Revisa tu carpeta de descargas')}</small>
            </div>

            <p style="margin: 20px 0; font-size: 14px;">
                ${t('Puedes comenzar a usar el sistema desde cero.')}
            </p>
        </div>`,
        null
    );

    showToast(t('🔄 Sistema reseteado completamente'), 'success');
}

// Agregar animación shake
// NOTA: el nombre difiere del de ui.js (const style) porque ambos scripts
// comparten el scope léxico global: redeclarar `const style` en el navegador
// tira "Identifier 'style' has already been declared" y mata TODO tournaments.js.
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(shakeStyle);

// ==========================================
// PUNTO DE RESTAURACIÓN
// ==========================================

/**
 * Crea un punto de restauración completo del sistema
 */
window.createRestorePoint = function() {
    showModal(
        t('💾 Crear Punto de Restauración'),
        `<div style="color: var(--text-color);">
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 64px;">💾</div>
            </div>

            <p><strong>${t('Se creará un punto de restauración completo')}</strong> ${t('que incluye:')}</p>

            <div class="info-box" style="margin: 15px 0;">
                <strong>📦 ${t('Contenido del backup:')}</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>✓ ${t('Código HTML completo de la aplicación')}</li>
                    <li>✓ ${t('Todo el JavaScript (funciones y lógica)')}</li>
                    <li>✓ ${t('Todos los estilos CSS')}</li>
                    <li>✓ ${t('Todos los datos del torneo actual')}</li>
                    <li>✓ ${t('Base de datos de jugadores')}</li>
                    <li>✓ ${t('Configuración del sistema')}</li>
                    <li>✓ ${t('Logs y registros')}</li>
                </ul>
            </div>

            <p style="text-align: center; font-weight: bold; margin-top: 20px;">
                ${t('¿Deseas crear el punto de restauración ahora?')}
            </p>
        </div>`,
        () => {
            executeCreateRestorePoint();
        }
    );
};

/**
 * Ejecuta la creación del punto de restauración
 */
function executeCreateRestorePoint() {
    showToast(t('💾 Creando punto de restauración...'), 'info');

    try {
        const fullHTML = document.documentElement.outerHTML;

        const now = new Date();
        const timestamp = now.toISOString();
        const dateStr = now.toLocaleDateString(window.i18nLocale(), {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).replace(/\//g, '-').replace(/,/g, '');

        const systemInfo = {
            version: '2.0',
            fecha: timestamp,
            torneoNombre: tournamentData.settings.torneoNombre,
            totalFixtures: tournamentData.fixtures.length,
            totalJugadores: tournamentData.players.length,
            totalLogs: tournamentData.logs ? tournamentData.logs.length : 0
        };

        const backupHeader = `
<!--
╔═══════════════════════════════════════════════════════════════════════╗
    PUNTO DE RESTAURACIÓN - SISTEMA DE GESTIÓN DE TORNEO
╚═══════════════════════════════════════════════════════════════════════╝

📅 Fecha de creación: ${timestamp}
🏓 Torneo: ${systemInfo.torneoNombre}
📊 Versión del sistema: ${systemInfo.version}

📈 Estadísticas del backup:
   • Fixtures guardados: ${systemInfo.totalFixtures}
   • Jugadores registrados: ${systemInfo.totalJugadores}
   • Registros de logs: ${systemInfo.totalLogs}

💾 Este archivo contiene:
   ✓ Código HTML completo
   ✓ Todo el JavaScript
   ✓ Todos los estilos CSS
   ✓ Datos del torneo
   ✓ Base de datos de jugadores
   ✓ Configuración completa

🔄 Para restaurar:
   1. Abre este archivo en tu navegador
   2. El sistema se cargará automáticamente
   3. Todos tus datos estarán disponibles

⚠️ IMPORTANTE: Guarda este archivo en un lugar seguro

╚═══════════════════════════════════════════════════════════════════════╝
-->

`;

        const finalHTML = fullHTML.replace('<!DOCTYPE html>', `<!DOCTYPE html>\n${backupHeader}`);

        const blob = new Blob([finalHTML], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RESTORE_POINT_TenisDeMesa_${dateStr}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // También crear JSON de datos
        const dataBackup = {
            timestamp,
            version: '2.0',
            systemInfo,
            data: tournamentData
        };

        const jsonStr = JSON.stringify(dataBackup, null, 2);
        const jsonBlob = new Blob([jsonStr], { type: 'application/json' });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        const jsonA = document.createElement('a');
        jsonA.href = jsonUrl;
        jsonA.download = `RESTORE_POINT_DATA_${dateStr}.json`;
        document.body.appendChild(jsonA);
        jsonA.click();
        document.body.removeChild(jsonA);
        URL.revokeObjectURL(jsonUrl);

        addLog('PUNTO DE RESTAURACIÓN', t('Backup completo creado') + ` - ${systemInfo.totalFixtures} ${t('fixtures')}, ${systemInfo.totalJugadores} ${t('jugadores')}`);

        showToast(t('✅ Punto de restauración creado exitosamente'), 'success');
    } catch (error) {
        console.error('Error creando punto de restauración:', error);
        showToast(t('❌ Error al crear punto de restauración'), 'error');
    }
}

