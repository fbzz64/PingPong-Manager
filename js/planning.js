// ==========================================
// PLANNING.JS - PLANIFICACIÓN DEL TORNEO
// ==========================================
// Este archivo contiene:
// - Plantillas de formato (guardar/cargar configuraciones tipo)
// - Límites de inscripción por categoría
// - Lista de espera
// - Programación de partidos por mesas (multiplex)
// ==========================================

// ==========================================
// CATEGORÍAS (agregar / modificar / eliminar) Y LÍMITES DE INSCRIPCIÓN
// ==========================================

// Categorías estándar con las que arranca el sistema.
const DEFAULT_CATEGORIES = [
    'PRIMERA', 'SEGUNDA', 'TERCERA', 'CUARTA', 'DAMAS',
    'SUB 9', 'SUB 11', 'SUB 13', 'SUB 15', 'SUB 19', 'SUB 23',
    'MAXI 40', 'MAXI 50', 'MAXI 60'
];

// Devuelve la lista canónica de categorías (localStorage).
function getCustomCategories() {
    try {
        const raw = localStorage.getItem('customCategories');
        // Primer uso: siembra con las categorías estándar para que los selects
        // (fixture y jugadores) nunca queden vacíos en un navegador limpio.
        if (raw === null) {
            localStorage.setItem('customCategories', JSON.stringify(DEFAULT_CATEGORIES.slice()));
            return DEFAULT_CATEGORIES.slice();
        }
        const list = JSON.parse(raw);
        return Array.isArray(list) ? list : DEFAULT_CATEGORIES.slice();
    } catch (e) {
        return DEFAULT_CATEGORIES.slice();
    }
}

// Si la lista aún no se inicializó, la siembra con las categorías estándar.
function ensureCustomCategories() {
    try {
        if (localStorage.getItem('customCategories') === null) {
            localStorage.setItem('customCategories', JSON.stringify(DEFAULT_CATEGORIES.slice()));
        }
    } catch (e) { /* ignorar */ }
    return getCustomCategories();
}

function getCategoryLimits() {
    try {
        return JSON.parse(localStorage.getItem('categoryLimits') || '{}');
    } catch (e) {
        return {};
    }
}

function getRegisteredCategories() {
    return ensureCustomCategories();
}

// Reconstruye los selects de categoría (fixture y jugadores) desde la lista canónica.
window.syncCategorySelects = function(selected) {
    const cats = getCustomCategories();
    const fixtureSelect = document.getElementById('categoria');
    if (fixtureSelect) {
        const prev = fixtureSelect.value;
        fixtureSelect.innerHTML = cats.map(c => `<option value="${escAttr(c)}">${escHtml(c)}</option>`).join('');
        if (selected && cats.indexOf(selected) !== -1) fixtureSelect.value = selected;
        else if (cats.indexOf(prev) !== -1) fixtureSelect.value = prev;
    }
    const playerSelect = document.getElementById('new-player-categories');
    if (playerSelect) {
        playerSelect.innerHTML = cats.map(c => `<option value="${escAttr(c)}">${escHtml(c)}</option>`).join('');
    }
};

// Muestra el administrador de categorías en Configuración (con límites por categoría).
window.renderCategoriesManager = function() {
    const container = document.getElementById('categories-manager-container');
    if (!container) return;
    const cats = ensureCustomCategories();
    const limits = getCategoryLimits();
    if (cats.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">No hay categorías. Usá "➕ Agregar Categoría" para crear la primera.</p>';
        return;
    }
    container.innerHTML = cats.map((cat, idx) => {
        const count = (tournamentData.players || []).filter(p => p.categories && p.categories.includes(cat)).length;
        return `
        <div style="display: flex; align-items: center; gap: 10px; background: var(--header-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px 12px; margin-bottom: 8px;">
            <div style="flex: 1; min-width: 0;">
                <strong style="color: var(--text-color); font-size: 14px;">${escHtml(cat)}</strong>
                <div style="font-size: 12px; color: var(--text-muted);">${count} inscripto${count === 1 ? '' : 's'}</div>
            </div>
            <input type="number" data-cat="${escAttr(cat)}" value="${limits[cat] || ''}" min="1" placeholder="Sin límite" title="Cupo máximo de inscriptos (opcional)" style="width: 90px; padding: 6px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
            <button class="btn btn-info" style="padding: 6px 10px; font-size: 12px;" onclick="editCategory(${idx})" title="Modificar categoría">✏️</button>
            <button class="btn btn-danger" style="padding: 6px 10px; font-size: 12px;" onclick="deleteCategory(${idx})" title="Eliminar categoría">🗑️</button>
        </div>`;
    }).join('');
};

// Agrega una categoría nueva (con cupo máximo opcional).
window.addCategory = function() {
    showModal(
        '➕ Agregar Categoría',
        '<div style="display: flex; flex-direction: column; gap: 12px;">' +
            '<input type="text" id="modal-new-category" placeholder="Ej: SUB 25" maxlength="40" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">' +
            '<div><label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 4px;">Cupo máximo de inscriptos (opcional):</label>' +
            '<input type="number" id="modal-new-category-limit" min="1" placeholder="Sin límite" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);"></div>' +
        '</div>',
        () => {
            const name = (document.getElementById('modal-new-category').value || '').trim().toUpperCase();
            if (!name) {
                showToast('Por favor ingresa un nombre de categoría', 'error');
                return;
            }
            const cats = getCustomCategories();
            if (cats.some(c => c.toUpperCase() === name)) {
                showToast('Esta categoría ya existe', 'warning');
                return;
            }
            const limit = parseInt(document.getElementById('modal-new-category-limit').value);
            cats.push(name);
            localStorage.setItem('customCategories', JSON.stringify(cats));
            if (limit && limit > 0) {
                const limits = getCategoryLimits();
                limits[name] = limit;
                localStorage.setItem('categoryLimits', JSON.stringify(limits));
            }
            syncCategorySelects(name);
            renderCategoriesManager();
            showToast(`Categoría "${name}" agregada correctamente`);
            addLog('AGREGAR CATEGORÍA', `Nueva categoría: ${name}${limit ? ' (cupo ' + limit + ')' : ''}`);
        }
    );
};

// Renombra una categoría en todos los datos del torneo.
function renameCategoryEverywhere(oldName, newName) {
    (tournamentData.players || []).forEach(p => {
        if (p.categories && p.categories.indexOf(oldName) !== -1) {
            p.categories = p.categories.map(c => c === oldName ? newName : c);
        }
    });
    (tournamentData.waitlist || []).forEach(w => {
        if (w.categories && w.categories.indexOf(oldName) !== -1) {
            w.categories = w.categories.map(c => c === oldName ? newName : c);
        }
    });
    (tournamentData.fixtures || []).forEach(f => {
        if (f.categoria === oldName) f.categoria = newName;
    });
    (tournamentData.brackets || []).forEach(b => {
        if (b.categoria === oldName) b.categoria = newName;
    });
}

// Modifica el nombre y/o el cupo de una categoría.
window.editCategory = function(idx) {
    const cats = getCustomCategories();
    const cat = cats[idx];
    if (!cat) return;
    const limits = getCategoryLimits();
    showModal(
        '✏️ Modificar Categoría',
        '<div style="display: flex; flex-direction: column; gap: 12px;">' +
            '<input type="text" id="modal-edit-category" value="' + escAttr(cat) + '" maxlength="40" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">' +
            '<div><label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 4px;">Cupo máximo de inscriptos (opcional):</label>' +
            '<input type="number" id="modal-edit-category-limit" min="1" value="' + (limits[cat] || '') + '" placeholder="Sin límite" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);"></div>' +
        '</div>',
        () => {
            const newName = (document.getElementById('modal-edit-category').value || '').trim().toUpperCase();
            if (!newName) {
                showToast('Por favor ingresa un nombre de categoría', 'error');
                return;
            }
            if (cats.some((c, i) => i !== idx && c.toUpperCase() === newName)) {
                showToast('Ya existe otra categoría con ese nombre', 'warning');
                return;
            }
            const limitVal = (document.getElementById('modal-edit-category-limit').value || '').trim();
            const limit = parseInt(limitVal);
            if (limitVal !== '' && (!limit || limit <= 0)) {
                showToast('El límite debe ser un número mayor a 0', 'error');
                return;
            }
            const newLimits = Object.assign({}, limits);
            if (newName !== cat) {
                if (newLimits[cat]) {
                    newLimits[newName] = newLimits[cat];
                    delete newLimits[cat];
                }
                cats[idx] = newName;
            }
            if (limitVal === '') delete newLimits[newName];
            else newLimits[newName] = limit;
            localStorage.setItem('customCategories', JSON.stringify(cats));
            localStorage.setItem('categoryLimits', JSON.stringify(newLimits));
            if (newName !== cat) {
                renameCategoryEverywhere(cat, newName);
                saveTournamentData();
            }
            syncCategorySelects(newName);
            renderCategoriesManager();
            showToast(`Categoría "${cat}" → "${newName}"`);
            addLog('MODIFICAR CATEGORÍA', `${cat} → ${newName}`);
        }
    );
};

// Elimina una categoría (bloqueada si tiene fixtures o llaves).
window.deleteCategory = function(idx) {
    const cats = getCustomCategories();
    const cat = cats[idx];
    if (!cat) return;
    const fixturesCount = (tournamentData.fixtures || []).filter(f => f.categoria === cat).length;
    const bracketsCount = (tournamentData.brackets || []).filter(b => b.categoria === cat).length;
    if (fixturesCount > 0 || bracketsCount > 0) {
        showToast(`No se puede eliminar "${cat}": tiene ${fixturesCount} fixture(s) y ${bracketsCount} llave(s) generadas`, 'error');
        return;
    }
    const playersCount = (tournamentData.players || []).filter(p => p.categories && p.categories.includes(cat)).length;
    const waitlistCount = (tournamentData.waitlist || []).filter(w => w.categories && w.categories.includes(cat)).length;
    showModal(
        '🗑️ Eliminar Categoría',
        `<div style="color: var(--text-color);">
            <p>¿Eliminar la categoría <strong>${escHtml(cat)}</strong>?</p>
            <p style="font-size: 13px; color: var(--text-muted); margin: 10px 0;">Se quitará de ${playersCount} jugador(es)${waitlistCount ? ' y ' + waitlistCount + ' de la lista de espera' : ''}.</p>
        </div>`,
        () => {
            cats.splice(idx, 1);
            localStorage.setItem('customCategories', JSON.stringify(cats));
            const limits = getCategoryLimits();
            if (limits[cat]) {
                delete limits[cat];
                localStorage.setItem('categoryLimits', JSON.stringify(limits));
            }
            (tournamentData.players || []).forEach(p => {
                if (p.categories) p.categories = p.categories.filter(c => c !== cat);
            });
            (tournamentData.waitlist || []).forEach(w => {
                if (w.categories) w.categories = w.categories.filter(c => c !== cat);
            });
            saveTournamentData();
            syncCategorySelects();
            renderCategoriesManager();
            showToast(`Categoría "${cat}" eliminada`);
            addLog('ELIMINAR CATEGORÍA', `Categoría eliminada: ${cat}`);
        }
    );
};

window.saveCategoryLimits = function() {
    const limits = {};
    document.querySelectorAll('#categories-manager-container input[data-cat]').forEach(inp => {
        const v = parseInt(inp.value);
        if (v && v > 0) limits[inp.getAttribute('data-cat')] = v;
    });
    localStorage.setItem('categoryLimits', JSON.stringify(limits));
    renderCategoriesManager();
    showToast('Límites de inscripción guardados');
    addLog('LÍMITES', 'Límites de inscripción actualizados');
};

// Devuelve las categorías de la lista que ya alcanzaron su cupo máximo
window.checkCategoryLimits = function(categories) {
    const limits = getCategoryLimits();
    const full = [];
    (categories || []).forEach(cat => {
        const max = limits[cat];
        if (!max) return;
        const count = tournamentData.players.filter(p => p.categories && p.categories.includes(cat)).length;
        if (count >= max) full.push(cat);
    });
    return full;
};

// ==========================================
// LISTA DE ESPERA
// ==========================================

window.addPlayerToWaitlist = function(name, club, categories, ranking, members, fechaNac, licencia) {
    name = formatPlayerName(name);
    club = formatPlayerClub(club);
    tournamentData.waitlist.push({
        name,
        club,
        categories,
        members: Array.isArray(members) && members.length > 0 ? members : undefined,
        ranking: ranking && !isNaN(ranking) ? ranking : null,
        fechaNac: fechaNac || undefined,
        licencia: licencia || undefined,
        addedAt: new Date().toISOString()
    });
    saveTournamentData();
    renderWaitlistSection();
    showToast('Jugador agregado a la lista de espera');
    addLog('LISTA DE ESPERA', `${name} agregado a la espera (${categories.join(', ')})`);
};

window.renderWaitlistSection = function() {
    const container = document.getElementById('waitlist-container');
    if (!container) return;
    const list = tournamentData.waitlist || [];
    if (list.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">Sin jugadores en lista de espera.</p>';
        return;
    }
    container.innerHTML = list.map((w, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; background: var(--header-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px;">
            <div>
                <strong style="color: var(--text-color);">${escHtml(w.name)}</strong> <span style="color: var(--text-muted); font-size: 12px;">(${escHtml(w.club)})</span>
                <div style="font-size: 11px; color: var(--text-muted);">${(w.categories || []).map(escHtml).join(', ')}${w.ranking ? ' · Rank: ' + escHtml(w.ranking) : ''}</div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn btn-success" style="padding: 6px 12px; font-size: 12px;" onclick="moveFromWaitlist(${idx})">✅ Inscribir</button>
                <button class="btn btn-danger" style="padding: 6px 12px; font-size: 12px;" onclick="removeFromWaitlist(${idx})">✖</button>
            </div>
        </div>`).join('');
};

window.showWaitlist = function() {
    renderWaitlistSection();
    showToast('Lista de espera actualizada');
};

window.moveFromWaitlist = function(index) {
    const entry = tournamentData.waitlist[index];
    if (!entry) return;
    const fullCats = checkCategoryLimits(entry.categories);
    if (fullCats.length > 0) {
        showToast(`Aún sin cupo en: ${fullCats.join(', ')}`, 'warning');
        return;
    }
    if (typeof forceAddNewPlayer === 'function') {
        forceAddNewPlayer(entry.name, entry.club, entry.categories, entry.ranking, entry.members, entry.fechaNac, entry.licencia);
    }
    tournamentData.waitlist.splice(index, 1);
    saveTournamentData();
    renderWaitlistSection();
    showToast(`${entry.name} inscripto correctamente`);
    addLog('LISTA DE ESPERA', `${entry.name} pasó a inscripción`);
};

window.removeFromWaitlist = function(index) {
    const entry = tournamentData.waitlist[index];
    if (!entry) return;
    tournamentData.waitlist.splice(index, 1);
    saveTournamentData();
    renderWaitlistSection();
    showToast('Jugador eliminado de la lista de espera');
};

// ==========================================
// PLANTILLAS DE FORMATO
// ==========================================

function getTemplates() {
    try {
        return JSON.parse(localStorage.getItem('tournamentTemplates') || '[]');
    } catch (e) {
        return [];
    }
}

function setSettingsInput(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = (value === 0 || value) ? value : '';
}

function ensureCategory(cat) {
    if (!cat) return;
    const fixtureSelect = document.getElementById('categoria');
    if (fixtureSelect && !Array.from(fixtureSelect.options).some(o => o.value === cat)) {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        fixtureSelect.appendChild(opt);
    }
    const playerSelect = document.getElementById('new-player-categories');
    if (playerSelect && !Array.from(playerSelect.options).some(o => o.value === cat)) {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        playerSelect.appendChild(opt);
    }
    try {
        const saved = JSON.parse(localStorage.getItem('customCategories') || '[]');
        if (!saved.includes(cat)) {
            saved.push(cat);
            localStorage.setItem('customCategories', JSON.stringify(saved));
        }
    } catch (e) { /* ignorar */ }
}

window.renderTemplateList = function() {
    const container = document.getElementById('templates-list');
    if (!container) return;
    const templates = getTemplates();
    if (templates.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">No hay plantillas guardadas aún.</p>';
        return;
    }
    container.innerHTML = templates.map(t => `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; background: var(--header-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 12px;">
            <div style="flex: 1;">
                <strong style="color: var(--text-color);">📁 ${escHtml(t.name)}</strong>
                <div style="font-size: 11px; color: var(--text-muted);">${(t.categorias || []).length} categorías · ${t.settings.mesas || 4} mesas · ${escHtml(t.settings.formato || '')}</div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn btn-success" style="padding: 6px 12px; font-size: 12px;" onclick="loadTournamentTemplate('${escAttr(t.name)}')">📂 Cargar</button>
                <button class="btn btn-danger" style="padding: 6px 12px; font-size: 12px;" onclick="deleteTournamentTemplate('${escAttr(t.name)}')">🗑️</button>
            </div>
        </div>`).join('');
};

window.saveTournamentTemplate = function() {
    const name = (document.getElementById('template-name').value || '').trim();
    if (!name) {
        showToast('Ingresa un nombre para la plantilla', 'error');
        return;
    }
    const template = {
        id: Date.now(),
        name,
        savedAt: new Date().toISOString(),
        settings: Object.assign({}, tournamentData.settings),
        categorias: getRegisteredCategories(),
        limites: getCategoryLimits()
    };
    const templates = getTemplates();
    const existing = templates.findIndex(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing >= 0) templates[existing] = template;
    else templates.push(template);
    localStorage.setItem('tournamentTemplates', JSON.stringify(templates));
    document.getElementById('template-name').value = '';
    renderTemplateList();
    showToast(`Plantilla "${name}" guardada`);
    addLog('PLANTILLA', `Plantilla guardada: ${name}`);
};

window.loadTournamentTemplate = function(name) {
    const template = getTemplates().find(t => t.name === name);
    if (!template) {
        showToast('Plantilla no encontrada', 'error');
        return;
    }
    const s = template.settings || {};
    tournamentData.settings.torneoNombre = s.torneoNombre || '';
    tournamentData.settings.subtitulo = s.subtitulo || '';
    tournamentData.settings.lugar = s.lugar || '';
    tournamentData.settings.fechaInicio = s.fechaInicio || '';
    tournamentData.settings.fechaFin = s.fechaFin || '';
    tournamentData.settings.organizadores = s.organizadores || '';
    tournamentData.settings.mesas = s.mesas || 4;
    tournamentData.settings.formato = s.formato || 'Todos contra todos + llaves eliminatorias';
    tournamentData.settings.duracionPartido = s.duracionPartido || 15;

    setSettingsInput('torneoNombre', s.torneoNombre);
    setSettingsInput('subtitulo', s.subtitulo);
    setSettingsInput('torneoLugar', s.lugar);
    setSettingsInput('torneoFechaInicio', s.fechaInicio);
    setSettingsInput('torneoFechaFin', s.fechaFin);
    setSettingsInput('torneoOrganizadores', s.organizadores);
    setSettingsInput('torneoMesas', s.mesas);
    setSettingsInput('torneoFormato', s.formato);
    setSettingsInput('torneoFormatoGrupos', s.formatoPartidoGrupos);
    setSettingsInput('torneoFormatoLlaves', s.formatoPartidoLlaves);
    setSettingsInput('torneoDuracion', s.duracionPartido);

    (template.categorias || []).forEach(ensureCategory);
    if (template.limites) localStorage.setItem('categoryLimits', JSON.stringify(template.limites));

    saveTournamentData();
    if (typeof reloadSettingsInputs === 'function') reloadSettingsInputs();
    renderCategoriesManager();
    renderTemplateList();
    showToast(`Plantilla "${name}" cargada`);
    addLog('PLANTILLA', `Plantilla cargada: ${name}`);
};

window.deleteTournamentTemplate = function(name) {
    let templates = getTemplates();
    templates = templates.filter(t => t.name !== name);
    localStorage.setItem('tournamentTemplates', JSON.stringify(templates));
    renderTemplateList();
    showToast('Plantilla eliminada');
};

// ==========================================
// PROGRAMACIÓN MULTIPLEX (MESAS Y HORAS)
// ==========================================

let lastScheduledFixture = null;

function timeToMin(t) {
    if (!t) return 9 * 60;
    const parts = String(t).split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function minToTime(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// Asigna mesa y hora a cada partido evitando solapamientos por jugador y por mesa.
// En dobles/equipos se bloquea el horario para TODOS los integrantes de cada
// participante: ninguna persona puede estar en dos partidos simultáneos.
// @param {Array<string>} referees - Árbitro de cada mesa (índice = mesa - 1), opcional.
function assignMesasAndTimes(matches, numMesas, startTime, duration, referees) {
    const startMin = timeToMin(startTime);
    const playerBusy = {};
    const mesaBusy = [];
    for (let m = 0; m < numMesas; m++) mesaBusy.push(new Set());
    const schedule = [];

    // Claves de personas de un participante (él mismo + cada integrante en dobles/equipos).
    const busyKeys = p => {
        if (!p || p.name === '-') return [];
        const keys = [p.name + '|' + (p.club || '')];
        if (Array.isArray(p.members)) {
            p.members.forEach(m => {
                if (m && m.name && m.name !== '-' && m.club && m.club !== '-') {
                    keys.push(m.name + '|' + m.club);
                }
            });
        }
        return keys;
    };

    matches.forEach(match => {
        const k1s = busyKeys(match.player1);
        const k2s = busyKeys(match.player2);
        if (k1s.length === 0 || k2s.length === 0) {
            schedule.push({ match: match.match, player1: 'LIBRE', player2: '', mesa: '-', hora: '-', slot: -1 });
            return;
        }
        let assigned = false;
        for (let slot = 0; slot < 200 && !assigned; slot++) {
            const busy1 = k1s.some(k => playerBusy[k] && playerBusy[k].has(slot));
            const busy2 = k2s.some(k => playerBusy[k] && playerBusy[k].has(slot));
            if (busy1 || busy2) continue;
            for (let mi = 0; mi < numMesas; mi++) {
                if (mesaBusy[mi].has(slot)) continue;
                k1s.forEach(k => { playerBusy[k] = playerBusy[k] || new Set(); playerBusy[k].add(slot); });
                k2s.forEach(k => { playerBusy[k] = playerBusy[k] || new Set(); playerBusy[k].add(slot); });
                mesaBusy[mi].add(slot);
                schedule.push({
                    match: match.match,
                    player1: match.player1.name,
                    player2: match.player2.name,
                    mesa: mi + 1,
                    hora: minToTime(startMin + slot * duration),
                    slot,
                    referee: referees && referees[mi] ? referees[mi] : ''
                });
                assigned = true;
                break;
            }
        }
        if (!assigned) {
            schedule.push({
                match: match.match,
                player1: match.player1.name,
                player2: match.player2.name,
                mesa: '-',
                hora: 'Sin cupo',
                slot: -1
            });
        }
    });

    return schedule;
}

// Inyecta la mesa/hora en las tablas de partido del fixture visible
function applyScheduleToFixtureHTML(fixture) {
    const output = document.getElementById('fixture-output');
    if (!output) return;
    const tables = output.querySelectorAll('.match-table');
    tables.forEach((table, idx) => {
        const sch = (fixture.schedule || []).find(s => s.match === idx + 1);
        const headerRow = table.querySelector('tr');
        if (!sch || !headerRow) return;
        const existing = table.querySelector('tr.schedule-row');
        if (existing) existing.remove();
        const row = table.insertRow(1);
        row.className = 'schedule-row';
        const cell = document.createElement('th');
        cell.colSpan = headerRow.cells.length;
        cell.style.fontSize = '11px';
        cell.style.color = 'var(--accent)';
        cell.style.fontWeight = 'bold';
        cell.textContent = `🕒 ${sch.hora} · Mesa ${sch.mesa}`;
        row.appendChild(cell);
    });
}

function renderScheduledGrid(fixture, numMesas) {
    const schedule = fixture.schedule || [];
    const dur = fixture.scheduleDuracion || 15;
    const startMin = timeToMin(fixture.scheduleInicio || '09:00');
    const maxSlot = schedule.reduce((mx, s) => Math.max(mx, s.slot >= 0 ? s.slot : 0), 0);

    let grid = '<table class="data-table" style="font-size: 12px;"><tr><th>Hora</th>';
    for (let m = 1; m <= numMesas; m++) grid += `<th>Mesa ${m}</th>`;
    grid += '</tr>';
    for (let slot = 0; slot <= maxSlot; slot++) {
        grid += `<tr><td><strong>${minToTime(startMin + slot * dur)}</strong></td>`;
        for (let m = 1; m <= numMesas; m++) {
            const cell = schedule.find(s => s.slot === slot && s.mesa === m);
            grid += `<td style="text-align: left;">${cell ? `P${cell.match}: <strong>${cell.player1}</strong> vs <strong>${cell.player2}</strong>${cell.referee ? `<br><span style="color: #6c757d; font-size: 11px;">🧑‍⚖️ ${escHtml(cell.referee)}</span>` : ''}` : ''}</td>`;
        }
        grid += '</tr>';
    }
    grid += '</table>';

    const unscheduled = schedule.filter(s => s.slot < 0);
    const unschedHTML = unscheduled.length
        ? `<div class="warn-box" style="margin: 10px 0;">⚠️ ${unscheduled.length} partido(s) sin cupo: ${unscheduled.map(s => 'P' + s.match).join(', ')}. Aumenta las mesas o la ventana de tiempo.</div>`
        : '';

    let list = '<div style="margin-top: 15px;"><h4 style="color: var(--text-color); margin-bottom: 8px;">📅 Detalle por partido</h4>';
    schedule.forEach(s => {
        list += `<div style="font-size: 12px; padding: 3px 0; color: var(--text-color);">P${s.match}: ${s.player1} vs ${s.player2} → <strong>${s.hora}</strong> · Mesa ${s.mesa}${s.referee ? ' · 🧑‍⚖️ ' + escHtml(s.referee) : ''}</div>`;
    });
    list += '</div>';

    showModal(
        '🕒 Programación Multiplex',
        `<div style="color: var(--text-color);">
            ${unschedHTML}
            <div style="overflow-x: auto;">${grid}</div>
            ${list}
            <div class="button-grid" style="margin-top: 15px;">
                <button class="btn btn-primary" onclick="closeModal(); printSchedule();">🖨️ Imprimir Programación</button>
                <button class="btn btn-success" onclick="closeModal(); shareScheduleMultiplex();">📲 Difundir por WhatsApp</button>
                <button class="btn btn-info" onclick="closeModal(); showTab('fixture');">📋 Ver en Fixture</button>
            </div>
        </div>`,
        null
    );
}

/**
 * Arma un mensaje de texto con la programación Multiplex (mesas y horarios)
 * para difundir por WhatsApp.
 * @param {Object} fixture - Fixture programado
 * @returns {string}
 */
window.buildScheduleDiffusionMessage = function(fixture) {
    const nombre = (tournamentData.settings && tournamentData.settings.torneoNombre) || 'Torneo';
    const fecha = new Date().toLocaleDateString(window.i18nLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
    const schedule = (fixture && fixture.schedule) || [];

    let msg = '🏓 ' + nombre + '\n';
    msg += '📅 ' + fecha + '\n\n';
    msg += '🕒 PROGRAMACIÓN MULTIPLEX\n';
    msg += '⭐ ' + fixture.categoria + ' · Grupo ' + fixture.grupo + '\n\n';

    if (schedule.length === 0) {
        msg += 'Sin partidos programados.\n';
        return msg;
    }

    schedule.forEach(s => {
        if (s.slot < 0) {
            msg += '❌ P' + s.match + ': ' + s.player1 + ' vs ' + (s.player2 || '—') + ' (sin cupo)\n';
        } else {
            msg += '🕒 ' + s.hora + ' · Mesa ' + s.mesa + '\n';
            msg += '   P' + s.match + ': ' + s.player1 + ' vs ' + s.player2 + '\n';
            if (s.referee) msg += '   🧑‍⚖️ Árbitro: ' + s.referee + '\n';
        }
    });

    msg += '\n¡Nos vemos en la mesa! 🏓';
    return msg;
};

/**
 * Difunde la programación Multiplex del grupo seleccionado por WhatsApp.
 */
window.shareScheduleMultiplex = function() {
    const categoria = document.getElementById('categoria').value;
    const grupo = document.getElementById('grupo').value;
    const candidates = (tournamentData.fixtures || []).filter(f => f.categoria === categoria && f.grupo === grupo);
    const fixture = candidates[candidates.length - 1];
    if (!fixture || !(fixture.schedule || []).length) {
        showToast('Programá primero el Multiplex de este grupo.', 'error');
        return;
    }
    const msg = buildScheduleDiffusionMessage(fixture);
    const taId = 'multiplex-diffusion-text';

    showModal(
        '📲 Difundir Programación',
        '<div style="color: var(--text-color);">' +
            '<div style="text-align: center; margin-bottom: 15px;"><div style="font-size: 48px;">📲</div></div>' +
            '<p style="margin: 0 0 10px 0;"><strong>Programación de mesas y horarios:</strong></p>' +
            '<textarea id="' + taId + '" style="width: 100%; min-height: 220px; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color); font-family: monospace; font-size: 13px; resize: vertical;">' + statsEsc(msg) + '</textarea>' +
            '<p style="font-size: 12px; color: var(--text-muted); margin: 8px 0 0 0;">💡 Editá el mensaje y copialo o abrí WhatsApp directo.</p>' +
            '<div class="button-grid" style="margin-top: 15px;">' +
                '<button class="btn btn-success" onclick="copyMultiplexDiffusion()">📋 Copiar</button>' +
                '<button class="btn btn-info" onclick="diffusionOpenWhatsApp(\'' + taId + '\')">📲 Abrir WhatsApp</button>' +
            '</div>' +
        '</div>',
        function() {
            const ta = document.getElementById(taId);
            copyTextToClipboard(ta ? ta.value : msg, 'Programación Multiplex');
        },
        '📋 Copiar'
    );
};

/**
 * Arma la celda "Hora x Mesa" para la Timeline Multiplex.
 * @param {Array} fixtures - Fixtures con schedule
 * @returns {{ times: string[], mesas: number, cells: Object, entries: Array }}
 */
window.buildTimelineCells = function(fixtures) {
    const list = (fixtures || []).filter(f => Array.isArray(f.schedule) && f.schedule.length > 0);
    const times = new Set();
    let mesas = 0;
    const cells = {};
    const entries = [];

    list.forEach(f => {
        const numMesas = f.scheduleNumMesas || f.schedule.reduce((mx, s) => Math.max(mx, s.mesa), 0) || 0;
        mesas = Math.max(mesas, numMesas);
        (f.schedule || []).forEach(s => {
            if (s.slot < 0) return; // sin cupo: se reporta aparte
            const hora = s.hora || '-';
            times.add(hora);
            entries.push({
                hora,
                mesa: s.mesa,
                match: s.match,
                player1: s.player1,
                player2: s.player2,
                categoria: f.categoria,
                grupo: f.grupo,
                fixtureId: f.id
            });
            const key = hora + '|' + s.mesa;
            if (!cells[key]) cells[key] = [];
            cells[key].push(entries[entries.length - 1]);
        });
    });

    const timesSorted = Array.from(times).sort((a, b) => timeToMin(a) - timeToMin(b));

    const sinCupo = [];
    list.forEach(f => {
        (f.schedule || []).forEach(s => {
            if (s.slot < 0) {
                sinCupo.push({ categoria: f.categoria, grupo: f.grupo, match: s.match, player1: s.player1, player2: s.player2 });
            }
        });
    });

    return { times: timesSorted, mesas, cells, entries, sinCupo };
};

/**
 * Muestra la Timeline Multiplex: grilla de Horas x Mesas con los partidos de
 * TODOS los grupos programados del torneo.
 */
window.showScheduleTimeline = function() {
    const fixtures = (tournamentData.fixtures || []).filter(f => Array.isArray(f.schedule) && f.schedule.length > 0);
    if (fixtures.length === 0) {
        showToast('No hay grupos programados. Usá "Programar Partidos (Multiplex)" primero.', 'error');
        return;
    }

    const data = window.buildTimelineCells(fixtures);
    if (data.times.length === 0) {
        showToast('No hay partidos con horario asignado', 'warning');
        return;
    }

    let grid = '<table class="data-table" style="font-size: 12px;"><tr><th>Hora</th>';
    for (let m = 1; m <= data.mesas; m++) grid += `<th>Mesa ${m}</th>`;
    grid += '</tr>';

    data.times.forEach(hora => {
        grid += `<tr><td><strong>${escHtml(hora)}</strong></td>`;
        for (let m = 1; m <= data.mesas; m++) {
            const cell = data.cells[hora + '|' + m];
            let content = '';
            if (cell && cell.length) {
                content = cell.map(c =>
                    `<div>${escHtml(c.categoria)} ${escHtml(c.grupo)} · P${c.match}: <strong>${escHtml(c.player1)}</strong> vs <strong>${escHtml(c.player2)}</strong></div>`
                ).join('<hr style="border-top: 1px solid var(--border-color); margin: 4px 0;">');
            }
            grid += `<td style="text-align: left;">${content}</td>`;
        }
        grid += '</tr>';
    });
    grid += '</table>';

    const sinCupoHTML = data.sinCupo && data.sinCupo.length
        ? `<div class="warn-box" style="margin: 10px 0;">⚠️ Partidos sin cupo: ${data.sinCupo.map(s => `${escHtml(s.categoria)} ${escHtml(s.grupo)} P${s.match}`).join(', ')}. Aumentá las mesas o la ventana horaria.</div>`
        : '';

    const totalPartidos = data.entries.length;
    showModal(
        '🕒 Timeline Multiplex (Hora × Mesa)',
        `<div style="color: var(--text-color);">
            <p style="font-size: 13px; color: var(--text-muted);">${fixtures.length} grupo(s) programados · ${totalPartidos} partidos · ${data.mesas} mesa(s)</p>
            ${sinCupoHTML}
            <div style="overflow-x: auto;">${grid}</div>
        </div>`,
        null,
        'Cerrar'
    );
    addLog('TIMELINE', `Timeline Multiplex visualizado (${fixtures.length} grupos, ${totalPartidos} partidos)`);
};

/**
 * Copia el texto editado de la difusión Multiplex al portapapeles.
 */
window.copyMultiplexDiffusion = function() {
    const ta = document.getElementById('multiplex-diffusion-text');
    copyTextToClipboard(ta ? ta.value : '', 'Programación Multiplex');
};

window.scheduleFixtureMultiplex = function() {
    const categoria = document.getElementById('categoria').value;
    const grupo = document.getElementById('grupo').value;
    const candidates = (tournamentData.fixtures || []).filter(f => f.categoria === categoria && f.grupo === grupo);
    const fixture = candidates[candidates.length - 1];
    if (!fixture) {
        showToast('Guarda primero el fixture que querés programar.', 'error');
        return;
    }
    const matches = fixture.matches || [];
    if (matches.length === 0) {
        showToast('El fixture guardado no tiene partidos.', 'error');
        return;
    }
    const already = (fixture.schedule || []).length;

    showModal(
        '🕒 Programación Multiplex',
        `<div style="color: var(--text-color);">
            <p><strong>Fixture:</strong> ${fixture.categoria} - Grupo ${fixture.grupo} (${matches.length} partidos)</p>
            ${already > 0 ? `<div class="warn-box" style="margin: 10px 0;"><strong>Ya existe una programación</strong> (${already} partidos). Al guardar se recalculará.</div>` : ''}
            <div style="margin: 15px 0;">
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Cantidad de mesas:</label>
                <input type="number" id="sched-mesas" value="${tournamentData.settings.mesas || 4}" min="1" max="50" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
            </div>
            <div style="margin: 15px 0;">
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Hora de inicio:</label>
                <input type="time" id="sched-inicio" value="09:00" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
            </div>
            <div style="margin: 15px 0;">
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Duración por partido (min):</label>
                <input type="number" id="sched-duracion" value="${tournamentData.settings.duracionPartido || 15}" min="1" max="180" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
            </div>
            <div style="margin: 15px 0;">
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Árbitro por mesa (opcional, separado por comas):</label>
                <input type="text" id="sched-referees" value="" placeholder="Mesa 1, Mesa 2, Mesa 3…" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
            </div>
            <div class="info-box" style="margin: 15px 0;">
                <strong>ℹ️ Reglas:</strong> un jugador nunca juega 2 partidos a la misma hora y cada mesa tiene un solo partido por franja horaria.
            </div>
        </div>`,
        () => {
            const numMesas = parseInt(document.getElementById('sched-mesas').value);
            const startTime = document.getElementById('sched-inicio').value || '09:00';
            const dur = parseInt(document.getElementById('sched-duracion').value) || 15;
            if (!numMesas || numMesas < 1) {
                showToast('Ingresa una cantidad de mesas válida', 'error');
                return;
            }
            const refereesRaw = document.getElementById('sched-referees').value || '';
            const referees = refereesRaw.split(',').map(r => r.trim()).filter(Boolean);
            fixture.schedule = assignMesasAndTimes(matches, numMesas, startTime, dur, referees);
            fixture.scheduleNumMesas = numMesas;
            fixture.scheduleInicio = startTime;
            fixture.scheduleDuracion = dur;
            fixture.scheduleReferees = referees;
            lastScheduledFixture = fixture;
            saveTournamentData();
            applyScheduleToFixtureHTML(fixture);
            renderScheduledGrid(fixture, numMesas);
            addLog('PROGRAMAR MESAS', `${fixture.categoria} - Grupo ${fixture.grupo}: ${matches.length} partidos en ${numMesas} mesas`);
            showToast('Programación generada y guardada');
        }
    );
};

window.printSchedule = function() {
    const fixture = lastScheduledFixture;
    if (!fixture) {
        showToast('Primero generá una programación', 'error');
        return;
    }
    const schedule = fixture.schedule || [];
    const dur = fixture.scheduleDuracion || 15;
    const startMin = timeToMin(fixture.scheduleInicio || '09:00');
    const maxSlot = schedule.reduce((mx, s) => Math.max(mx, s.slot >= 0 ? s.slot : 0), 0);
    const numMesas = fixture.scheduleNumMesas || 4;

    let grid = '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 12px;"><tr style="background: #007BFF; color: #fff;"><th>Hora</th>';
    for (let m = 1; m <= numMesas; m++) grid += `<th>Mesa ${m}</th>`;
    grid += '</tr>';
    for (let slot = 0; slot <= maxSlot; slot++) {
        grid += `<tr><td><strong>${minToTime(startMin + slot * dur)}</strong></td>`;
        for (let m = 1; m <= numMesas; m++) {
            const cell = schedule.find(s => s.slot === slot && s.mesa === m);
            grid += `<td style="text-align: left;">${cell ? `P${cell.match}: ${cell.player1} vs ${cell.player2}${cell.referee ? '<br><span style="font-size: 10px; color: #555;">🧑‍⚖️ ' + escHtml(cell.referee) + '</span>' : ''}` : ''}</td>`;
        }
        grid += '</tr>';
    }
    grid += '</table>';

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
        showToast('Permite ventanas emergentes para imprimir', 'error');
        return;
    }
    win.document.write(`<html><head><title>Programación Multiplex - ${fixture.categoria} Grupo ${fixture.grupo}</title></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333;">
    <h1 style="text-align: center; color: #007BFF;">🕒 PROGRAMACIÓN MULTIPLEX</h1>
    <h2 style="text-align: center;">${fixture.categoria} - Grupo ${fixture.grupo}</h2>
    <p style="text-align: center; color: #666;">${schedule.length} partidos · ${numMesas} mesas · ${dur} min por partido · Inicio ${fixture.scheduleInicio || '09:00'}</p>
    ${grid}
</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 300);
};

// ==========================================
// BACKUP MONOLÍTICO
// ==========================================

/**
 * Exporta toda la aplicación como un único archivo HTML monolítico
 * (CSS y JavaScript incrustados) a modo de backup de seguridad.
 * Requiere servirlo por HTTP (fetch no funciona sobre file://).
 */
window.exportMonolithicHTML = async function() {
    showToast('Generando backup monolítico...');

    const cssUrl = 'css/styles.css';
    const jsFiles = ['main', 'storage', 'ui', 'navigation', 'logs', 'sponsors', 'players', 'elo', 'reglamento', 'fixtures', 'brackets', 'stats', 'charts', 'ranking', 'tournaments', 'certificates', 'planning', 'scoreboard', 'tables', 'qr', 'changelog'];

    try {
        const cssRes = await fetch(cssUrl, { cache: 'no-store' });
        if (!cssRes.ok) throw new Error('CSS no disponible');
        const css = await cssRes.text();

        const jsSources = [];
        for (const name of jsFiles) {
            const res = await fetch('js/' + name + '.js', { cache: 'no-store' });
            if (!res.ok) throw new Error('JS no disponible: ' + name);
            jsSources.push(await res.text());
        }

        // Clonar el DOM actual: conserva toda la estructura y el estado visible
        const clone = document.documentElement.cloneNode(true);

        // Quitar scripts externos y el registro del service worker
        clone.querySelectorAll('script').forEach(s => {
            if (s.getAttribute('src') || /serviceWorker|sw\.js/.test(s.textContent || '')) {
                s.remove();
            }
        });

        // Quitar hojas de estilo externas e incrustar el CSS
        clone.querySelectorAll('link[rel="stylesheet"]').forEach(l => l.remove());
        const head = clone.querySelector('head');
        const style = document.createElement('style');
        style.textContent = css;
        head.appendChild(style);

        // Incrustar todo el JavaScript antes de </body>
        const script = document.createElement('script');
        script.textContent = jsSources.join('\n;\n');
        clone.appendChild(script);

        const html = '<!DOCTYPE html>\n' + clone.outerHTML;

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        a.href = url;
        a.download = 'backup-monolitico-' + ts + '.html';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 3000);

        showToast('✅ Backup monolítico generado y descargado');
        addLog('RESPALDO', 'Backup monolítico exportado a archivo único');
    } catch (error) {
        console.error('Error al exportar backup:', error);
        showToast('No se pudo exportar: abrí la app por HTTP (ej: Live Server) para poder leer los archivos.', 'error');
    }
};

