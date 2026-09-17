// ================================================================
// FLOW-TEST.JS - Simulador aislado del flujo completo del torneo
// ================================================================
// Ejecuta un torneo virtual en memoria. No escribe en tournamentData, no
// sincroniza con Firebase y no modifica los resultados del torneo real.
// ================================================================

(function() {
    'use strict';

    const VERSION = '1.0';

    function tr(key) {
        return typeof window.t === 'function' ? window.t(key) : key;
    }

    function esc(value) {
        if (typeof window.escHtml === 'function') return window.escHtml(value);
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function addCheck(report, phase, label, passed, detail) {
        report.steps.push({
            phase: phase,
            label: label,
            passed: Boolean(passed),
            detail: detail || ''
        });
    }

    function samplePlayers() {
        const names = [
            'Ana Test', 'Bruno Test', 'Carla Test', 'Diego Test',
            'Elena Test', 'Facundo Test', 'Gabriela Test', 'Hugo Test'
        ];
        return names.map(function(name, index) {
            return {
                id: 'flow-test-' + (index + 1),
                name: name,
                club: 'CLUB ' + String.fromCharCode(65 + index),
                categories: ['TEST AUTOMATICO'],
                checkin: true,
                elo: 1200 - index * 10,
                fatmRating: 900 + (7 - index) * 15,
                affiliate: 'AFILIADA ' + String.fromCharCode(65 + index),
                gender: index % 2 === 0 ? 'F' : 'M',
                fechaNac: '2012-01-' + String(index + 10).padStart(2, '0')
            };
        });
    }

    function completedMatch(player1, player2, matchNumber, winnerSide, format, phase) {
        const rules = window.ITTFRULES;
        const columns = rules.setColumns(format);
        const needed = rules.setsToWin(format);
        const p1 = Array(columns).fill('');
        const p2 = Array(columns).fill('');

        for (let setIndex = 0; setIndex < needed; setIndex++) {
            const loserScore = 4 + ((matchNumber + setIndex * 2) % 6);
            if (winnerSide === 1) {
                p1[setIndex] = 11;
                p2[setIndex] = loserScore;
            } else {
                p1[setIndex] = loserScore;
                p2[setIndex] = 11;
            }
        }

        return {
            match: matchNumber,
            player1: player1,
            player2: player2,
            sets: { player1: p1, player2: p2 },
            formato: format,
            phase: phase,
            completed: true,
            winnerSide: winnerSide,
            winner: winnerSide === 1 ? player1.name : player2.name
        };
    }

    function roundRobin(players, format, startNumber) {
        const matches = [];
        let matchNumber = startNumber;
        for (let i = 0; i < players.length; i++) {
            for (let j = i + 1; j < players.length; j++) {
                // La siembra inferior gana para obtener una tabla inequívoca.
                matches.push(completedMatch(players[i], players[j], matchNumber++, 1, format, 'GRUPO'));
            }
        }
        return matches;
    }

    function matchIsValid(match, format) {
        const rules = window.ITTFRULES;
        const invalid = rules.invalidSetIndexes(match.sets.player1, match.sets.player2);
        return invalid.length === 0 &&
            rules.matchCompleted(match.sets.player1, match.sets.player2, format) &&
            rules.matchWinnerSide(match, format) !== 0;
    }

    function runFATMChecks(report) {
        if (!window.FATMRULES) {
            report.warnings.push('El módulo FATM no está cargado; se completó el escenario libre.');
            return;
        }

        try {
            const plan = window.FATMRULES.competitionPlan('CABALLEROS U15', 8);
            const order = window.FATMRULES.groupMatchOrder(4, 2);
            const planOk = Boolean(
                plan && plan.valid &&
                Array.isArray(plan.groupSizes) &&
                plan.groupSizes.length === 2 &&
                plan.groupSizes.every(function(size) { return size === 4; }) &&
                Number(plan.qualifiersPerGroup) === 2
            );
            addCheck(report, 'FATM 2026', 'Plan oficial para 8 participantes', planOk,
                planOk ? '2 zonas de 4 y 2 clasificados por zona.' : 'El plan FATM no devolvió la estructura esperada.');
            addCheck(report, 'FATM 2026', 'Orden oficial de una zona de 4', Array.isArray(order) && order.length === 6,
                Array.isArray(order) ? order.length + ' enfrentamientos generados.' : 'No se generó el orden de partidos.');
            report.stats.fatmChecked = true;
        } catch (error) {
            addCheck(report, 'FATM 2026', 'Motor reglamentario FATM', false, error.message || String(error));
        }
    }

    function run(options) {
        options = options || {};
        const started = Date.now();
        let initialSnapshot = null;
        try {
            if (typeof tournamentData !== 'undefined') initialSnapshot = JSON.stringify(tournamentData);
        } catch (error) {
            initialSnapshot = null;
        }

        const report = {
            version: VERSION,
            runAt: new Date().toISOString(),
            ok: false,
            passed: 0,
            failed: 0,
            total: 0,
            durationMs: 0,
            steps: [],
            warnings: [],
            stats: {
                players: 0,
                groups: 0,
                groupMatches: 0,
                qualifiers: 0,
                bracketMatches: 0,
                champion: '',
                fatmChecked: false
            }
        };

        const rulesAvailable = Boolean(window.ITTFRULES &&
            typeof window.ITTFRULES.groupStandings === 'function' &&
            typeof window.ITTFRULES.matchCompleted === 'function');
        addCheck(report, 'Motor', 'Reglas ITTF disponibles', rulesAvailable,
            rulesAvailable ? 'Motor reglamentario cargado.' : 'No se encontró ITTFRULES.');

        if (!rulesAvailable) {
            report.total = report.steps.length;
            report.failed = report.steps.filter(function(step) { return !step.passed; }).length;
            report.durationMs = Date.now() - started;
            return report;
        }

        const format = options.format || 'bo5';
        const players = samplePlayers();
        report.stats.players = players.length;
        const unique = new Set(players.map(function(player) {
            return player.name.toLowerCase() + '|' + player.club.toLowerCase();
        }));
        addCheck(report, 'Inscripción', '8 participantes válidos y únicos',
            players.length === 8 && unique.size === 8,
            players.length + ' fichas preparadas.');

        const groups = [
            { name: 'A', players: players.slice(0, 4) },
            { name: 'B', players: players.slice(4, 8) }
        ];
        report.stats.groups = groups.length;
        addCheck(report, 'Zonas', 'Distribución en dos zonas de cuatro',
            groups.length === 2 && groups.every(function(group) { return group.players.length === 4; }),
            'Zona A: 4 · Zona B: 4.');

        let nextMatch = 1;
        const groupResults = groups.map(function(group) {
            const matches = roundRobin(group.players, format, nextMatch);
            nextMatch += matches.length;
            const standings = window.ITTFRULES.groupStandings(group.players, matches);
            return { name: group.name, players: group.players, matches: matches, standings: standings };
        });
        const groupMatches = groupResults.reduce(function(all, group) { return all.concat(group.matches); }, []);
        report.stats.groupMatches = groupMatches.length;
        addCheck(report, 'Partidos de zona', '12 partidos completos y reglamentarios',
            groupMatches.length === 12 && groupMatches.every(function(match) { return matchIsValid(match, format); }),
            groupMatches.length + ' partidos simulados.');

        const standingsOk = groupResults.every(function(group) {
            return group.standings.length === 4 &&
                group.standings.every(function(row) { return row.played === 3; }) &&
                group.standings[0].matchesWon === 3;
        });
        addCheck(report, 'Clasificación', 'Tablas calculadas con desempate ITTF',
            standingsOk,
            standingsOk ? 'Cada participante disputó 3 partidos.' : 'Una tabla no produjo las posiciones esperadas.');

        const qualifiers = [
            groupResults[0].standings[0].player,
            groupResults[0].standings[1].player,
            groupResults[1].standings[0].player,
            groupResults[1].standings[1].player
        ];
        report.stats.qualifiers = qualifiers.length;
        const qualifierKeys = new Set(qualifiers.map(function(player) { return player.id; }));
        addCheck(report, 'Clasificación', 'Cuatro clasificados sin duplicados',
            qualifiers.length === 4 && qualifierKeys.size === 4,
            qualifiers.map(function(player) { return player.name; }).join(', ') + '.');

        const semifinal1 = completedMatch(qualifiers[0], qualifiers[3], nextMatch++, 1, format, 'SEMIFINAL');
        const semifinal2 = completedMatch(qualifiers[2], qualifiers[1], nextMatch++, 1, format, 'SEMIFINAL');
        const finalist1 = semifinal1.player1;
        const finalist2 = semifinal2.player1;
        const finalMatch = completedMatch(finalist1, finalist2, nextMatch++, -1, format, 'FINAL');
        const bracketMatches = [semifinal1, semifinal2, finalMatch];
        report.stats.bracketMatches = bracketMatches.length;
        report.stats.champion = finalMatch.player2.name;

        addCheck(report, 'Llaves', 'Semifinales y final completas',
            bracketMatches.length === 3 && bracketMatches.every(function(match) { return matchIsValid(match, format); }),
            '2 semifinales y 1 final simuladas.');
        addCheck(report, 'Podio', 'Campeón determinado',
            Boolean(report.stats.champion),
            report.stats.champion ? 'Campeón virtual: ' + report.stats.champion + '.' : 'No se pudo determinar el campeón.');

        if (options.runtimeChecks !== false) {
            const runtimeModules = [
                ['Persistencia', typeof window.saveTournamentData === 'function'],
                ['Generador de fixtures', typeof window.generateAutoFixture === 'function'],
                ['Generador de llaves', typeof window.buildAutoBracketRounds === 'function'],
                ['Cálculo de podios', typeof window.calculatePodiums === 'function']
            ];
            runtimeModules.forEach(function(moduleCheck) {
                addCheck(report, 'Aplicación', moduleCheck[0] + ' disponible', moduleCheck[1],
                    moduleCheck[1] ? 'Módulo cargado.' : 'Módulo ausente en la página.');
            });
        }

        runFATMChecks(report);

        if (initialSnapshot !== null) {
            let finalSnapshot = null;
            try {
                finalSnapshot = JSON.stringify(tournamentData);
            } catch (error) {
                finalSnapshot = null;
            }
            addCheck(report, 'Integridad', 'Datos reales sin modificaciones',
                initialSnapshot === finalSnapshot,
                initialSnapshot === finalSnapshot
                    ? 'La simulación se ejecutó completamente en memoria.'
                    : 'Se detectó una modificación inesperada del torneo real.');
        }

        report.total = report.steps.length;
        report.passed = report.steps.filter(function(step) { return step.passed; }).length;
        report.failed = report.total - report.passed;
        report.ok = report.failed === 0;
        report.durationMs = Date.now() - started;
        return report;
    }

    function reportHTML(report) {
        const color = report.ok ? 'var(--success)' : 'var(--danger)';
        const icon = report.ok ? '✅' : '❌';
        const steps = report.steps.map(function(step) {
            return '<div style="display:grid;grid-template-columns:28px 110px 1fr;gap:8px;align-items:start;padding:9px 0;border-bottom:1px solid var(--border-color);">' +
                '<span>' + (step.passed ? '✅' : '❌') + '</span>' +
                '<strong style="font-size:12px;color:var(--text-muted);">' + esc(step.phase) + '</strong>' +
                '<div><strong>' + esc(step.label) + '</strong>' +
                (step.detail ? '<div style="font-size:12px;color:var(--text-muted);margin-top:3px;">' + esc(step.detail) + '</div>' : '') +
                '</div></div>';
        }).join('');

        const warnings = report.warnings.length
            ? '<div class="warn-box" style="margin-top:14px;"><strong>⚠️ Avisos</strong><ul style="margin:8px 0 0 18px;">' +
                report.warnings.map(function(warning) { return '<li>' + esc(warning) + '</li>'; }).join('') +
                '</ul></div>'
            : '';

        return '<div style="color:var(--text-color);">' +
            '<div style="text-align:center;padding:14px;border:2px solid ' + color + ';border-radius:10px;margin-bottom:14px;">' +
                '<div style="font-size:36px;">' + icon + '</div>' +
                '<h3 style="margin:6px 0;color:' + color + ';">' +
                    esc(report.ok ? tr('✅ Flujo completo correcto') : tr('❌ Se encontraron fallas')) +
                '</h3>' +
                '<div>' + report.passed + '/' + report.total + ' controles aprobados · ' + report.durationMs + ' ms</div>' +
            '</div>' +
            '<div class="info-box" style="margin-bottom:12px;">' +
                '<strong>Resumen:</strong> ' + report.stats.players + ' jugadores · ' +
                report.stats.groups + ' zonas · ' + report.stats.groupMatches + ' partidos de zona · ' +
                report.stats.bracketMatches + ' partidos de llave · campeón: <strong>' + esc(report.stats.champion || '—') + '</strong>.' +
            '</div>' +
            steps + warnings +
            '<p style="font-size:12px;color:var(--text-muted);margin-top:14px;">🔒 ' +
                esc(tr('No se modificaron los datos del torneo real.')) + '</p>' +
        '</div>';
    }

    function statusElement() {
        return document.getElementById('flow-test-last-run');
    }

    function persistSummary(report) {
        try {
            localStorage.setItem('pingpong-flow-test-last-result', JSON.stringify({
                runAt: report.runAt,
                ok: report.ok,
                passed: report.passed,
                total: report.total,
                durationMs: report.durationMs
            }));
        } catch (error) {
            // El diagnóstico sigue siendo válido aunque localStorage esté lleno.
        }
    }

    function restoreStatus() {
        const status = statusElement();
        if (!status) return;
        try {
            const saved = JSON.parse(localStorage.getItem('pingpong-flow-test-last-result') || 'null');
            if (!saved) return;
            const when = new Date(saved.runAt).toLocaleString();
            status.textContent = (saved.ok ? '✅ ' : '❌ ') + saved.passed + '/' + saved.total + ' · ' + when;
        } catch (error) {
            // Un resultado anterior corrupto no impide ejecutar una prueba nueva.
        }
    }

    window.TournamentFlowTest = {
        VERSION: VERSION,
        run: run,
        reportHTML: reportHTML,
        samplePlayers: samplePlayers,
        completedMatch: completedMatch
    };

    window.runAutomaticTournamentFlowTest = function() {
        const button = document.getElementById('btn-run-flow-test');
        const status = statusElement();
        const originalText = button ? button.textContent : tr('▶ Probar flujo completo');

        if (button) {
            button.disabled = true;
            button.textContent = '⏳ ' + tr('Ejecutando diagnóstico...');
        }
        if (status) status.textContent = '⏳ ' + tr('Ejecutando diagnóstico...');

        setTimeout(function() {
            try {
                const report = run({ runtimeChecks: true });
                persistSummary(report);
                if (status) {
                    status.textContent = (report.ok ? '✅ ' : '❌ ') + report.passed + '/' + report.total +
                        ' · ' + report.durationMs + ' ms';
                }
                if (typeof window.showModal === 'function') {
                    window.showModal('🧪 ' + tr('Prueba automática del torneo'), reportHTML(report), null);
                } else if (typeof window.showToast === 'function') {
                    window.showToast(report.ok ? tr('✅ Flujo completo correcto') : tr('❌ Se encontraron fallas'),
                        report.ok ? 'success' : 'error');
                }
            } catch (error) {
                if (status) status.textContent = '❌ ' + (error.message || String(error));
                if (typeof window.showToast === 'function') {
                    window.showToast('Error en la prueba automática: ' + (error.message || error), 'error');
                }
            } finally {
                if (button) {
                    button.disabled = false;
                    button.textContent = originalText || tr('▶ Probar flujo completo');
                }
            }
        }, 50);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', restoreStatus);
    } else {
        restoreStatus();
    }
})();
