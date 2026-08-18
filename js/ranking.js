// ==========================================
// RANKING.JS - Ranking global por club, categoría y torneo
// ==========================================
// Permite ver el ranking de jugadores ordenado por puntos acumulados o ELO,
// filtrando por club, categoría y torneo (actual o históricos).
// ==========================================

/**
 * Puntos que sumó un jugador en el torneo actual (todas sus fixtures).
 * En dobles/equipos, los puntos del participante se atribuyen también a
 * cada integrante: ambos reciben el mismo puntaje.
 */
window.sumCurrentTournamentPoints = function(name, club, categoria) {
    let total = 0;
    (tournamentData.fixtures || []).forEach(f => {
        if (categoria && f.categoria !== categoria) return;
        (f.players || []).forEach(p => {
            if (!p || p.name === '-' || p.club === '-') return;
            if (p.name === name && p.club === club) {
                total += (p.points || 0);
                return;
            }
            if (Array.isArray(p.members) && p.members.some(m => m && m.name === name && m.club === club)) {
                total += (p.points || 0);
            }
        });
    });
    return total;
};

/**
 * Mejor posición (menor número) de un jugador en su historial, opcionalmente por categoría.
 */
function bestHistoryPosition(history, categoria) {
    let best = null;
    (history || []).forEach(h => {
        if (categoria && h.categoria !== categoria) return;
        if (h.posicion && (best === null || h.posicion < best)) best = h.posicion;
    });
    return best;
}

/**
 * Lista de valores distintos y ordenados.
 */
function rankingDistinct(values) {
    return [...new Set(values.filter(v => v !== '' && v !== undefined && v !== null))].sort((a, b) => a.localeCompare(b));
}

/**
 * Puebla los selectores de filtro del ranking (sin perder la selección actual).
 */
function populateRankingFilters(selectedTorneo, selectedCategoria, selectedClub) {
    const torneoSelect = document.getElementById('ranking-torneo');
    const categoriaSelect = document.getElementById('ranking-categoria');
    const clubSelect = document.getElementById('ranking-club');
    if (!torneoSelect || !categoriaSelect || !clubSelect) return;

    const torneos = rankingDistinct((tournamentData.players || []).flatMap(p => (p.history || []).map(h => h.torneo)));
    const categorias = rankingDistinct((tournamentData.players || []).flatMap(p => (p.categories || [])));
    const clubs = rankingDistinct((tournamentData.players || []).map(p => p.club).filter(c => c !== '-'));

    torneoSelect.innerHTML = '<option value="actual">🏆 Torneo actual</option>' +
        torneos.map(t => `<option value="${t.replace(/"/g, '&quot;')}">📅 ${t}</option>`).join('');
    if (selectedTorneo && torneos.includes(selectedTorneo)) torneoSelect.value = selectedTorneo;

    categoriaSelect.innerHTML = '<option value="">Todas las categorías</option>' +
        categorias.map(c => `<option value="${c}">${c}</option>`).join('');
    if (selectedCategoria && categorias.includes(selectedCategoria)) categoriaSelect.value = selectedCategoria;

    clubSelect.innerHTML = '<option value="">Todos los clubs</option>' +
        clubs.map(c => `<option value="${c.replace(/"/g, '&quot;')}">${c}</option>`).join('');
    if (selectedClub && clubs.includes(selectedClub)) clubSelect.value = selectedClub;
}

/**
 * Renderiza el ranking global con los filtros seleccionados.
 */
window.renderRanking = function() {
    const output = document.getElementById('ranking-output');
    if (!output) return;

    const torneoSelect = document.getElementById('ranking-torneo');
    const categoriaSelect = document.getElementById('ranking-categoria');
    const clubSelect = document.getElementById('ranking-club');
    const sortSelect = document.getElementById('ranking-sort');

    const selectedTorneo = torneoSelect ? torneoSelect.value : 'actual';
    const selectedCategoria = categoriaSelect ? categoriaSelect.value : '';
    const selectedClub = clubSelect ? clubSelect.value : '';
    const sortBy = sortSelect ? sortSelect.value : 'points';

    populateRankingFilters(selectedTorneo, selectedCategoria, selectedClub);

    const torneo = torneoSelect ? torneoSelect.value : 'actual';
    const categoria = categoriaSelect ? categoriaSelect.value : '';
    const club = clubSelect ? clubSelect.value : '';

    const entries = [];
    (tournamentData.players || []).forEach(p => {
        if (p.name === '-' || p.club === '-' || p.name === '- -' || p.club === '- -') return;
        if (categoria && !(p.categories || []).includes(categoria)) return;
        if (club && p.club !== club) return;

        const elo = typeof p.elo === 'number' ? p.elo : window.DEFAULT_ELO;
        let points = 0;
        let torneos = 0;
        let mejor = null;

        if (torneo === 'actual') {
            points = window.sumCurrentTournamentPoints(p.name, p.club, categoria);
            torneos = (p.history || []).length;
            mejor = bestHistoryPosition(p.history, categoria);
        } else {
            (p.history || []).forEach(h => {
                if (h.torneo !== torneo) return;
                if (categoria && h.categoria !== categoria) return;
                points += (h.pts || 0);
                torneos++;
                if (h.posicion && (mejor === null || h.posicion < mejor)) mejor = h.posicion;
            });
        }

        entries.push({
            name: p.name,
            club: p.club,
            categories: p.categories || [],
            elo,
            points,
            torneos,
            mejor,
            checkin: !!p.checkin
        });
    });

    if (sortBy === 'elo') {
        entries.sort((a, b) => b.elo - a.elo || a.name.localeCompare(b.name));
    } else {
        entries.sort((a, b) => b.points - a.points || b.elo - a.elo || a.name.localeCompare(b.name));
    }

    if (entries.length === 0) {
        output.innerHTML = '<div class="alert alert-info">No hay jugadores que coincidan con los filtros.</div>';
        return;
    }

    const contextLabel = torneo === 'actual'
        ? 'Puntos del torneo actual'
        : `Puntos en: ${torneo}`;

    let html = '<div class="form-section"><h3>🏆 Ranking Global</h3>';
    html += `<p style="font-size: 13px; color: var(--text-muted);">${contextLabel} · Ordenado por: <strong>${sortBy === 'elo' ? 'ELO' : 'Puntos'}</strong></p>`;
    html += '<table class="data-table">';
    html += '<tr><th>#</th><th>Jugador</th><th>Club</th><th>Categorías</th><th>ELO</th><th>Puntos</th><th>Torneos</th><th>Mejor puesto</th></tr>';

    entries.forEach((e, idx) => {
        const medal = idx === 0 ? ' 🥇' : idx === 1 ? ' 🥈' : idx === 2 ? ' 🥉' : '';
        html += `
            <tr>
                <td>${idx + 1}${medal}</td>
                <td>${escHtml(e.name)}</td>
                <td>${escHtml(e.club)}</td>
                <td style="font-size: 12px;">${e.categories.map(escHtml).join(', ')}</td>
                <td style="font-weight: bold;">${e.elo}</td>
                <td style="font-weight: bold;">${e.points}</td>
                <td>${e.torneos}</td>
                <td>${e.mejor ? '#' + e.mejor : '-'}</td>
            </tr>
        `;
    });

    html += '</table></div>';
    output.innerHTML = html;
    addLog('RANKING', 'Ranking global visualizado');
};

/**
 * Exporta el ranking actual a CSV.
 */
window.exportRankingCSV = function() {
    const rows = [['#', 'Jugador', 'Club', 'Categorias', 'ELO', 'Puntos', 'Torneos', 'Mejor puesto']];
    const output = document.getElementById('ranking-output');
    if (!output || !output.querySelector('table.data-table')) {
        showToast('Primero genera el ranking', 'error');
        return;
    }

    const table = output.querySelector('table.data-table');
    Array.from(table.querySelectorAll('tr')).forEach((tr, idx) => {
        if (idx === 0) return;
        const cells = Array.from(tr.querySelectorAll('td')).map(td => `"${td.textContent.trim().replace(/🥇|🥈|🥉/g, '').trim()}"`);
        rows.push(cells);
    });

    const csv = rows.map(r => r.join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ranking_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Ranking exportado a CSV');
};

