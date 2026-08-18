// ==========================================
// CHARTS.JS - GRÁFICOS SVG (sin dependencias externas)
// ==========================================
// Renderiza gráficos con SVG puro sobre los datos del torneo:
// - Participación por categoría (barras)
// - % de victorias por club (barras)
// - Evolución de puntos de los top 5 jugadores (líneas)
// Reutiliza helpers de stats.js (statsEsc, statsValidPlayers,
// statsCompletedMatches, statsPlayerKey, countSetWins).
// ==========================================

const CHART_COLORS = ['#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261', '#06d6a0', '#7b2cbf', '#118ab2', '#ef476f', '#a8dadc'];

function chartsClipLabel(label, max) {
    const s = String(label);
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/**
 * Genera un gráfico de barras horizontales en SVG.
 * @param {Array} data - [{ label, value }]
 * @param {Object} opts - { color, suffix }
 */
function chartsBarChartSVG(data, opts) {
    opts = opts || {};
    const W = 720;
    const rowH = 28;
    const labW = 200;
    const max = Math.max(1, ...data.map(d => d.value));
    const H = 24 + data.length * rowH;
    const barW = W - labW - 100;

    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;background:var(--table-bg);border-radius:8px;">';
    data.forEach((d, i) => {
        const yy = 14 + i * rowH;
        const bw = Math.max(2, Math.round(barW * (d.value / max)));
        svg += '<text x="' + (labW - 8) + '" y="' + (yy + 13) + '" text-anchor="end" font-size="12" fill="var(--text-color)">' + statsEsc(chartsClipLabel(d.label, 26)) + '</text>';
        svg += '<rect x="' + labW + '" y="' + (yy + 2) + '" width="' + bw + '" height="18" fill="' + (opts.color || '#457b9d') + '" rx="4"/>';
        svg += '<text x="' + (labW + bw + 8) + '" y="' + (yy + 15) + '" font-size="12" font-weight="bold" fill="var(--text-color)">' + d.value + (opts.suffix || '') + '</text>';
    });
    svg += '</svg>';
    return svg;
}

/**
 * Genera un gráfico de líneas en SVG (evolución).
 * @param {Array} labels - Etiquetas del eje X
 * @param {Array} series - [{ name, values }]
 */
function chartsLineChartSVG(labels, series) {
    const W = 720;
    const H = 300;
    const PL = 60;
    const PR = 20;
    const PT = 20;
    const PB = 42;
    const iw = W - PL - PR;
    const ih = H - PT - PB;
    const all = [];
    series.forEach(s => s.values.forEach(v => all.push(v)));
    const maxVal = Math.max(5, ...all);

    const x = i => PL + (labels.length > 1 ? iw * i / (labels.length - 1) : iw / 2);
    const y = v => PT + ih - ih * (v / maxVal);

    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;background:var(--table-bg);border-radius:8px;">';

    for (let g = 0; g <= 5; g++) {
        const v = Math.round(maxVal * g / 5);
        const yy = y(v);
        svg += '<line x1="' + PL + '" y1="' + yy + '" x2="' + (W - PR) + '" y2="' + yy + '" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4 4"/>';
        svg += '<text x="' + (PL - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="11" fill="var(--text-muted)">' + v + '</text>';
    }

    labels.forEach((lb, i) => {
        svg += '<text x="' + x(i) + '" y="' + (H - PB + 16) + '" text-anchor="middle" font-size="11" fill="var(--text-muted)">' + statsEsc(lb) + '</text>';
    });

    series.forEach((s, si) => {
        const color = CHART_COLORS[si % CHART_COLORS.length];
        const pts = s.values.map((v, i) => x(i) + ',' + y(v)).join(' ');
        svg += '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
        s.values.forEach((v, i) => {
            svg += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3.2" fill="' + color + '"/>';
        });
    });

    let lx = PL;
    series.forEach((s, si) => {
        const color = CHART_COLORS[si % CHART_COLORS.length];
        const label = chartsClipLabel(s.name.split('|')[0], 15);
        svg += '<rect x="' + lx + '" y="' + (H - 14) + '" width="10" height="10" fill="' + color + '" rx="2"/>';
        svg += '<text x="' + (lx + 14) + '" y="' + (H - 5) + '" font-size="11" fill="var(--text-color)">' + statsEsc(label) + '</text>';
        lx += 14 + label.length * 6.5 + 16;
    });

    svg += '</svg>';
    return svg;
}

/**
 * Renderiza la participación por categoría (cantidad de jugadores por categoría).
 */
window.renderCategoryChart = function(container) {
    const counts = {};
    statsValidPlayers().forEach(p => (p.categories || []).forEach(c => counts[c] = (counts[c] || 0) + 1));
    const data = Object.keys(counts).map(c => ({ label: c, value: counts[c] })).sort((a, b) => b.value - a.value);

    let inner = '';
    if (data.length === 0) {
        inner = '<p style="color: var(--text-muted); font-style: italic;">Sin categorías asignadas a los jugadores.</p>';
    } else {
        inner = chartsBarChartSVG(data, { color: '#2a9d8f' });
    }
    container.innerHTML = '<h4 style="margin: 0 0 10px 0;">👥 Participación por categoría</h4>' + inner;
};

/**
 * Renderiza el porcentaje de victorias por club (partidos completados).
 */
window.renderClubWinRateChart = function(container) {
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
    const data = Object.keys(clubPlayed)
        .map(c => ({ label: c, value: Math.round(100 * (clubWins[c] || 0) / clubPlayed[c]) }))
        .sort((a, b) => b.value - a.value);

    let inner = '';
    if (data.length === 0) {
        inner = '<p style="color: var(--text-muted); font-style: italic;">Sin partidos completados.</p>';
    } else {
        inner = chartsBarChartSVG(data, { color: '#e63946', suffix: '%' });
    }
    container.innerHTML = '<h4 style="margin: 0 0 10px 0;">🏅 % Victorias por club</h4>' + inner;
};

/**
 * Renderiza la evolución de puntos acumulados de los top 5 jugadores
 * a lo largo de los fixtures del torneo actual.
 */
window.renderPointsEvolutionChart = function(container) {
    const fixtures = tournamentData.fixtures || [];
    if (fixtures.length < 2) {
        container.innerHTML = '<h4 style="margin: 0 0 10px 0;">📈 Evolución de puntos (top 5)</h4><p style="color: var(--text-muted); font-style: italic;">Se necesitan al menos 2 fixtures para ver la evolución.</p>';
        return;
    }

    const personsOf = p => {
        const keys = [statsPlayerKey(p)];
        if (Array.isArray(p && p.members) && p.members.length >= 2) {
            p.members.forEach(m => keys.push(statsPlayerKey(m)));
        }
        return keys;
    };

    const perFixture = fixtures.map(f => {
        const pts = {};
        (f.matches || []).forEach(m => {
            if (!m || !m.completed || !m.player1 || !m.player2) return;
            // Puntos de partido ITTF 2-1-0 (0 en derrota por W.O.).
            // En dobles/equipos se atribuyen a cada integrante, no al equipo.
            personsOf(m.player1).forEach(k => pts[k] = (pts[k] || 0) + window.ITTFRULES.matchPointsFor(m, m.player1.name, m.player1.club));
            personsOf(m.player2).forEach(k => pts[k] = (pts[k] || 0) + window.ITTFRULES.matchPointsFor(m, m.player2.name, m.player2.club));
        });
        return pts;
    });

    const totals = {};
    perFixture.forEach(pf => Object.keys(pf).forEach(k => totals[k] = (totals[k] || 0) + pf[k]));
    const topKeys = Object.keys(totals).sort((a, b) => totals[b] - totals[a]).slice(0, 5);

    if (topKeys.length === 0) {
        container.innerHTML = '<h4 style="margin: 0 0 10px 0;">📈 Evolución de puntos (top 5)</h4><p style="color: var(--text-muted); font-style: italic;">Sin puntos registrados.</p>';
        return;
    }

    const series = topKeys.map(key => {
        const values = [];
        let c = 0;
        perFixture.forEach(pf => { c += (pf[key] || 0); values.push(c); });
        return { name: key, values };
    });
    const labels = fixtures.map((f, i) => 'G' + (i + 1));

    container.innerHTML = '<h4 style="margin: 0 0 10px 0;">📈 Evolución de puntos (top 5)</h4>' + chartsLineChartSVG(labels, series);
};

