// ==========================================
// PLAYERS.JS - Gestión de jugadores
// ==========================================

// Las funciones de formulario de jugadores (updatePlayerFields, clearPlayerFields,
// setLastPlayerAsFree, loadFakeData, showPlayerSuggestions, showClubSuggestions,
// selectPlayer y selectClub) viven en fixtures.js

// ==========================================
// EDAD, SUB-CATEGORÍAS POR EDAD Y LICENCIA
// ==========================================

/**
 * Convierte 'YYYY-MM-DD' a Date en hora LOCAL (evita el corrimiento UTC que
 * en zonas como Argentina desplaza la fecha al día/año anterior).
 */
function parseLocalDate(fechaNac) {
    if (!fechaNac) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fechaNac));
    if (!m) {
        const d = new Date(fechaNac);
        return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Edad exacta en años a la fecha actual. null si no hay fecha válida.
 */
window.getPlayerAge = function(fechaNac) {
    const d = parseLocalDate(fechaNac);
    if (!d) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
};

/**
 * Edad por año calendario (año actual - año de nacimiento). Es la referencia
 * habitual para sub-categorías: la edad que se cumple durante el año.
 */
window.getCalendarAge = function(fechaNac) {
    const d = parseLocalDate(fechaNac);
    if (!d) return null;
    return new Date().getFullYear() - d.getFullYear();
};

/**
 * Sub-categoría sugerida según el año de nacimiento.
 * SUB 9 → 11 → 13 → 15 → 19 → 23 → MAYORES.
 */
window.getSuggestedSubcategory = function(fechaNac) {
    const age = window.getCalendarAge(fechaNac);
    if (age === null) return null;
    if (age <= 9) return 'SUB 9';
    if (age <= 11) return 'SUB 11';
    if (age <= 13) return 'SUB 13';
    if (age <= 15) return 'SUB 15';
    if (age <= 19) return 'SUB 19';
    if (age <= 23) return 'SUB 23';
    return 'MAYORES';
};

/**
 * Categoría MAXI sugerida (opcional) para mayores de 40/50/60.
 */
window.getSuggestedMaxi = function(fechaNac) {
    const age = window.getPlayerAge(fechaNac);
    if (age === null) return null;
    if (age >= 60) return 'MAXI 60';
    if (age >= 50) return 'MAXI 50';
    if (age >= 40) return 'MAXI 40';
    return null;
};

/**
 * Valida el formato de un número de licencia (opcional).
 * Devuelve true si está vacío o cumple: letras/números, 4-15 caracteres.
 */
window.isValidLicense = function(licencia) {
    if (!licencia || String(licencia).trim() === '') return true;
    return /^[A-Za-z0-9]{4,15}$/.test(String(licencia).trim());
};

/**
 * Al cambiar la fecha de nacimiento: muestra la edad, la sub-categoría sugerida
 * y preselecciona SUB/MAXI correspondiente en el selector de categorías.
 */
window.onPlayerBirthdateChange = function() {
    const input = document.getElementById('new-player-birthdate');
    const ageEl = document.getElementById('new-player-age');
    const hintEl = document.getElementById('new-player-subcat-hint');
    const fechaNac = input && input.value ? input.value : '';

    const age = window.getPlayerAge(fechaNac);
    if (ageEl) ageEl.textContent = t('Edad:') + ' ' + (age === null ? '—' : age + ' ' + t('años'));

    if (!hintEl) return;
    if (!fechaNac) { hintEl.innerHTML = ''; return; }

    const sub = window.getSuggestedSubcategory(fechaNac);
    const maxi = window.getSuggestedMaxi(fechaNac);
    let hint = '';
    if (sub) hint = t('Según su año de nacimiento le corresponde:') + ' <strong>' + sub + '</strong>';
    if (maxi) hint += (hint ? t(' (también puede jugar') + ' <strong>' : t('Opcional por edad:') + ' <strong>') + maxi + '</strong>';
    hintEl.innerHTML = hint;

    const sel = document.getElementById('new-player-categories');
    if (!sel) return;
    [sub, maxi].forEach(cat => {
        if (!cat) return;
        const opt = Array.from(sel.options).find(o => o.value === cat);
        if (opt) opt.selected = true;
    });
};

// ==========================================
// PAREJAS (DOBLES) Y EQUIPOS
// ==========================================

/**
 * Clave de identidad de una PERSONA (nombre|club en minúsculas).
 * Un participante puede ser individual o una pareja/equipo con varios miembros.
 */
window.getPersonKey = function(person) {
    return String((person && person.name) || '').trim().toLowerCase() + '|' +
           String((person && person.club) || '').trim().toLowerCase();
};

/**
 * Devuelve la lista de personas reales que componen un participante.
 * - Individual: [{ name, club }]
 * - Pareja/Equipo: p.members
 * - Participante inválido (LIBRE/TBD): []
 */
window.getParticipantMembers = function(participant) {
    if (!participant) return [];
    if (Array.isArray(participant.members) && participant.members.length >= 2) {
        return participant.members.filter(m => m && m.name && m.name !== '-' && m.club && m.club !== '-');
    }
    if (participant.name && participant.name !== '-' && participant.name !== 'TBD' &&
        participant.club && participant.club !== '-') {
        return [{ name: participant.name, club: participant.club }];
    }
    return [];
};

/**
 * Claves de identidad de todas las personas de un participante.
 */
window.getParticipantPersonKeys = function(participant) {
    return window.getParticipantMembers(participant).map(m => window.getPersonKey(m));
};

/**
 * Detecta si un participante ya fue inscripto como integrante de otra pareja/equipo.
 * @returns {Array} Parejas/equipos que ya contienen a esa persona
 */
window.findPersonInOtherTeams = function(personKey) {
    const found = [];
    (tournamentData.players || []).forEach(p => {
        if (Array.isArray(p.members) && p.members.length >= 2) {
            p.members.forEach(m => {
                if (window.getPersonKey(m) === personKey) found.push(p);
            });
        }
    });
    return found;
};

/**
 * Muestra/oculta los campos de integrantes según el tipo de inscripción.
 */
window.onPlayerTypeChange = function() {
    const typeSelect = document.getElementById('new-player-type');
    const container = document.getElementById('pair-members');
    if (!typeSelect || !container) return;
    const tipo = typeSelect.value;
    container.style.display = tipo === 'individual' ? 'none' : 'block';
    const nameGroup = document.getElementById('new-player-name-group');
    if (nameGroup) {
        nameGroup.style.display = tipo === 'individual' ? 'block' : 'none';
    }
    const birthGroup = document.getElementById('new-player-birth-group');
    if (birthGroup) {
        birthGroup.style.display = tipo === 'individual' ? 'block' : 'none';
    }
    const licGroup = document.getElementById('new-player-license-group');
    if (licGroup) {
        licGroup.style.display = tipo === 'individual' ? 'block' : 'none';
    }
    const clubLabel = document.getElementById('new-player-club-label');
    if (clubLabel) {
        clubLabel.textContent = tipo === 'individual' ? t('Club o Localidad:') : t('Club o Localidad (de la pareja/equipo):');
    }
};

/**
 * Limpia los inputs de integrantes de la pareja/equipo.
 */
window.clearPairMembers = function() {
    document.querySelectorAll('.pair-member-name').forEach(i => i.value = '');
    document.querySelectorAll('.pair-member-club').forEach(i => i.value = '');
};

/**
 * Copia los miembros de un participante registrado (pareja/equipo) a las
 * entradas del fixture, para que los partidos conserven los integrantes reales.
 * @param {Array} players - Entradas de participantes de un fixture
 * @returns {Array} Entradas con `members` resuelto cuando aplica
 */
window.attachMembersToFixturePlayers = function(players) {
    return (players || []).map(p => {
        if (!p || p.name === '-' || p.club === '-' || (Array.isArray(p.members) && p.members.length >= 2)) return p;
        const db = (tournamentData.players || []).find(x => x.name === p.name && x.club === p.club);
        if (db && Array.isArray(db.members) && db.members.length >= 2) {
            return Object.assign({}, p, { members: db.members });
        }
        return p;
    });
};

/**
 * Detecta personas repetidas entre los participantes de un grupo.
 * Un jugador no puede aparecer en dos participantes del mismo grupo
 * (ej: individual y dentro de una pareja a la vez).
 * @param {Array} participants - Participantes del grupo
 * @returns {Array} [{ person, participants }]
 */
window.findDuplicatePersonInParticipants = function(participants) {
    const seen = {};
    const conflicts = [];
    (participants || []).forEach(p => {
        window.getParticipantPersonKeys(p).forEach(key => {
            if (seen[key]) {
                conflicts.push({ person: key, participants: [seen[key], p] });
            } else {
                seen[key] = p;
            }
        });
    });
    return conflicts;
};

// Payloads pendientes para las acciones de alta (evitan inyección de HTML
// por nombres/clubs con caracteres especiales en los onclick).
window.__pendingWaitlistPlayer = null;
window.__pendingForcePlayer = null;
window.__pendingMergePlayer = null;

/**
 * Ejecuta una acción de alta diferida con los datos guardados en los
 * payloads pendientes, sin construir onclick con cadenas del usuario.
 */
window.executePendingPlayerAction = function(action) {
    closeModal();
    if (action === 'waitlist' && window.__pendingWaitlistPlayer) {
        const p = window.__pendingWaitlistPlayer;
        window.__pendingWaitlistPlayer = null;
        addPlayerToWaitlist(p.name, p.club, p.categories, p.ranking, p.members, p.fechaNac, p.licencia);
    } else if (action === 'force' && window.__pendingForcePlayer) {
        const p = window.__pendingForcePlayer;
        window.__pendingForcePlayer = null;
        forceAddNewPlayer(p.name, p.club, p.categories, p.ranking, p.members, p.fechaNac, p.licencia);
    } else if (action === 'merge' && window.__pendingMergePlayer) {
        const m = window.__pendingMergePlayer;
        window.__pendingMergePlayer = null;
        addCategoriesToExisting(m.index, m.categories);
    }
};

// Agregar nuevo jugador a la base de datos
window.addNewPlayer = function() {
    const typeSelect = document.getElementById('new-player-type');
    const tipo = typeSelect ? typeSelect.value : 'individual';
    let name, club, members;

    if (tipo === 'individual') {
        name = formatPlayerName(document.getElementById('new-player-name').value);
        club = formatPlayerClub(document.getElementById('new-player-club').value);
    } else {
        const mems = [];
        document.querySelectorAll('#pair-members .pair-member').forEach(row => {
            const mName = formatPlayerName(row.querySelector('.pair-member-name').value);
            const mClub = formatPlayerClub(row.querySelector('.pair-member-club').value);
            if (mName && mClub) mems.push({ name: mName, club: mClub });
        });
        if (mems.length < 2) {
            showToast(tipo === 'equipo' ? t('Ingresá al menos 2 integrantes para el equipo') : t('Ingresá los 2 integrantes de la pareja'), 'error');
            return;
        }
        // Evitar que una misma persona juegue en dos parejas/equipos distintos
        for (let i = 0; i < mems.length; i++) {
            const dup = window.findPersonInOtherTeams(window.getPersonKey(mems[i]));
            if (dup.length > 0) {
                showToast('⚠️ ' + mems[i].name + ' ' + t('ya integra') + ' ' + dup[0].name + ' (' + dup[0].club + '). ' + t('Un jugador no puede estar en dos parejas/equipos.'), 'error');
                return;
            }
        }
        members = mems;
        name = formatPlayerName(mems.map(m => m.name).join(' - '));
        club = formatPlayerClub(document.getElementById('new-player-club').value);
        if (!club) {
            showToast(t('Completá el club/localidad de la pareja o equipo'), 'error');
            return;
        }
    }

    const rankingInput = document.getElementById('new-player-ranking');
    const ranking = rankingInput && rankingInput.value !== '' ? parseInt(rankingInput.value) : null;
    const categoriesSelect = document.getElementById('new-player-categories');
    const categories = Array.from(categoriesSelect.selectedOptions).map(opt => opt.value);
    const birthInput = document.getElementById('new-player-birthdate');
    const fechaNac = birthInput && birthInput.value ? birthInput.value : '';
    const licInput = document.getElementById('new-player-license');
    const licencia = licInput ? licInput.value.trim() : '';

    if (!window.isValidLicense(licencia)) {
        showToast(t('Número de licencia inválido. Usá solo letras y números (4 a 15 caracteres) o dejalo vacío.'), 'error');
        return;
    }

    if (!name || !club) {
        showToast(t('Por favor completa el nombre y club del jugador'), 'error');
        return;
    }

    if (categories.length === 0) {
        showToast(t('Por favor selecciona al menos una categoría'), 'warning');
        return;
    }

    // Verificar límites de inscripción
    const fullCategories = typeof checkCategoryLimits === 'function' ? checkCategoryLimits(categories) : [];
    if (fullCategories.length > 0) {
        const availableCategories = categories.filter(c => !fullCategories.includes(c));
        window.__pendingWaitlistPlayer = { name, club, categories, ranking, members, fechaNac, licencia };
        window.__pendingForcePlayer = { name, club, categories: availableCategories, ranking, members, fechaNac, licencia };
        showModal(
            t('🔒 Categorías con Cupo Completo'),
            `<div style="color: var(--text-color);">
                <div class="warn-box" style="margin: 15px 0;">
                    <strong>${t('Las siguientes categorías alcanzaron su límite de inscripción:')}</strong><br>
                    ${fullCategories.map(c => `• ${c}`).join('<br>')}
                </div>
                <p>${t('¿Qué deseas hacer?')}</p>
                <div class="button-grid" style="margin-top: 15px;">
                    <button class="btn btn-warning" onclick="executePendingPlayerAction('waitlist')">
                        📋 ${t('Agregar a lista de espera')}
                    </button>
                    ${availableCategories.length > 0 ? `<button class="btn btn-success" onclick="executePendingPlayerAction('force')">
                        ✅ ${t('Inscribir solo en:')} ${availableCategories.join(', ')}
                    </button>` : ''}
                    <button class="btn btn-dark" onclick="closeModal();">
                        ❌ ${t('Cancelar')}
                    </button>
                </div>
            </div>`,
            null
        );
        return;
    }

    // Verificar duplicados antes de agregar
    const duplicates = checkBeforeAddingPlayer(name, club);

    if (duplicates.length > 0) {
        const dup = duplicates[0];
        window.__pendingForcePlayer = { name, club, categories, ranking, members, fechaNac, licencia };
        window.__pendingMergePlayer = { index: dup.index, categories };

        showModal(
            t('⚠️ Posible Jugador Duplicado'),
            `<div style="color: var(--text-color);">
                <p><strong>${t('¡ATENCIÓN!')}</strong> ${t('Se detectó un jugador similar en la base de datos:')}</p>

                <div class="warn-box" style="margin: 15px 0;">
                    <div style="margin-bottom: 10px;">
                        <strong>${t('Jugador existente:')}</strong><br>
                        ${escHtml(dup.player.name)} - ${escHtml(dup.player.club)}<br>
                        <span style="font-size: 12px; color: var(--text-muted);">${t('Categorías:')} ${dup.player.categories.map(escHtml).join(', ')}</span>
                    </div>
                    <div>
                        <strong>${t('Jugador a agregar:')}</strong><br>
                        ${escHtml(name)} - ${escHtml(club)}<br>
                        <span style="font-size: 12px; color: var(--text-muted);">${t('Categorías:')} ${categories.map(escHtml).join(', ')}</span>
                    </div>
                    <div style="margin-top: 10px; padding: 8px; background: var(--surface-alt); border-radius: 4px; text-align: center;">
                        <strong style="color: var(--warning);">${t('Similitud:')} ${dup.confidence}%</strong>
                    </div>
                </div>

                <p><strong>${t('¿Qué deseas hacer?')}</strong></p>
            </div>
            <div class="button-grid" style="margin-top: 15px;">
                <button class="btn btn-success" onclick="executePendingPlayerAction('force')">
                    ➕ ${t('Agregar de todas formas')}
                </button>
                <button class="btn btn-info" onclick="executePendingPlayerAction('merge')">
                    🔗 ${t('Actualizar categorías del existente')}
                </button>
                <button class="btn btn-dark" onclick="closeModal();">
                    ❌ ${t('Cancelar')}
                </button>
            </div>`,
            null
        );

        return;
    }

    forceAddNewPlayer(name, club, categories, ranking, members, fechaNac, licencia);
};

// Forzar agregar jugador (sin verificación de duplicados)
window.forceAddNewPlayer = function(name, club, categories, ranking, members, fechaNac, licencia) {
    name = formatPlayerName(name);
    club = formatPlayerClub(club);
    if (Array.isArray(members) && members.length > 0) {
        members = members.map(m => ({ name: formatPlayerName(m.name), club: formatPlayerClub(m.club) }));
    } else {
        members = undefined;
    }

    const exists = tournamentData.players.find(p =>
        p.name.toLowerCase() === name.toLowerCase() &&
        p.club.toLowerCase() === club.toLowerCase()
    );

    if (exists) {
        categories.forEach(cat => {
            if (!exists.categories.includes(cat)) {
                exists.categories.push(cat);
            }
        });
        if (fechaNac && !exists.fechaNac) exists.fechaNac = fechaNac;
        if (licencia && !exists.licencia) exists.licencia = licencia;
        showToast(t('Jugador actualizado con nuevas categorías'));
        addLog('ACTUALIZAR JUGADOR', `${name} - ${t('Categorías añadidas:')} ${categories.join(', ')}`);
    } else {
        tournamentData.players.push({
            name,
            club,
            categories,
            members,
            ranking: ranking && !isNaN(ranking) ? ranking : null,
            fechaNac: fechaNac || undefined,
            licencia: licencia || undefined,
            checkin: false,
            elo: window.DEFAULT_ELO || 1200,
            history: []
        });
        showToast(t('Jugador agregado correctamente'));
        addLog('AGREGAR JUGADOR', `${name} (${club}) - ${t('Categorías:')} ${categories.join(', ')}`);
    }

    saveTournamentData();

    document.getElementById('new-player-name').value = '';
    document.getElementById('new-player-club').value = '';
    document.getElementById('new-player-categories').selectedIndex = -1;
    const rankingInput = document.getElementById('new-player-ranking');
    if (rankingInput) rankingInput.value = '';
    const birthInput = document.getElementById('new-player-birthdate');
    if (birthInput) birthInput.value = '';
    const licInput = document.getElementById('new-player-license');
    if (licInput) licInput.value = '';
    const ageEl = document.getElementById('new-player-age');
    if (ageEl) ageEl.textContent = t('Edad:') + ' —';
    const hintEl = document.getElementById('new-player-subcat-hint');
    if (hintEl) hintEl.innerHTML = '';

    showAllPlayers();
};

// Agregar categorías a jugador existente
window.addCategoriesToExisting = function(playerIndex, newCategories) {
    const player = tournamentData.players[playerIndex];

    newCategories.forEach(cat => {
        if (!player.categories.includes(cat)) {
            player.categories.push(cat);
        }
    });

    saveTournamentData();
    showToast(t('Categorías agregadas a') + ` ${player.name}`);
    addLog('ACTUALIZAR JUGADOR', `${player.name} - ${t('Categorías añadidas:')} ${newCategories.join(', ')}`);
    showAllPlayers();
};

// ==========================================
// ORDEN Y FILTRO DE LA LISTA DE JUGADORES
// ==========================================

// Estado del orden/filtro (persiste entre re-renderizados de la tabla).
let playerSortField = 'name';
let playerSortDir = 'asc';

// Campos que se ordenan de mayor a menor por defecto.
// (ranking NO está: 1° es el mejor puesto, por lo que arranca ascendente.)
const PLAYER_SORT_NUMERIC = { age: 1, elo: 1, checkin: 1 };

/**
 * Cambia el campo de orden de la lista.
 * Al cambiar de campo se restaura la dirección por defecto del nuevo campo.
 */
window.changePlayerSort = function(field) {
    if (playerSortField !== field) {
        playerSortField = field;
        playerSortDir = PLAYER_SORT_NUMERIC[field] ? 'desc' : 'asc';
    }
    updateSortDirButton();
    showAllPlayers();
};

/**
 * Alterna la dirección del orden (A-Z / Z-A).
 */
window.toggleSortDirection = function() {
    playerSortDir = playerSortDir === 'asc' ? 'desc' : 'asc';
    updateSortDirButton();
    showAllPlayers();
};

/**
 * Refleja la dirección actual en el botón.
 */
function updateSortDirButton() {
    const btn = document.getElementById('btn-sort-dir');
    if (!btn) return;
    const numeric = !!PLAYER_SORT_NUMERIC[playerSortField];
    const dir = playerSortDir;
    if (numeric) {
        btn.textContent = dir === 'desc' ? t('⬇️ Mayor a menor') : t('⬆️ Menor a mayor');
    } else {
        btn.textContent = dir === 'asc' ? t('⬆️ A-Z') : t('⬇️ Z-A');
    }
}

/**
 * Valor de comparación de un jugador según el campo de orden activo.
 */
function playerSortValue(player) {
    switch (playerSortField) {
        case 'club': return (player.club || '').toLowerCase();
        case 'age': {
            const age = window.getPlayerAge(player.fechaNac);
            return age === null ? Infinity : age;
        }
        case 'elo': return typeof player.elo === 'number' ? player.elo : (window.DEFAULT_ELO || 1200);
        case 'ranking': return (typeof player.ranking === 'number') ? player.ranking : Infinity;
        case 'checkin': return player.checkin ? 1 : 0;
        case 'categories': return (player.categories || []).join(', ').toLowerCase();
        default: return (player.name || '').toLowerCase();
    }
}

/**
 * Jugadores válidos visibles según el buscador activo.
 */
function filteredValidPlayers() {
    const valid = tournamentData.players.filter(p =>
        p.name !== '-' && p.club !== '-' && p.name !== '- -' && p.club !== '- -'
    );
    const searchEl = document.getElementById('players-search');
    const query = searchEl ? searchEl.value.trim().toLowerCase() : '';
    if (!query) return valid;
    return valid.filter(p =>
        (p.name || '').toLowerCase().indexOf(query) >= 0 ||
        (p.club || '').toLowerCase().indexOf(query) >= 0
    );
}

// Mostrar todos los jugadores
window.showAllPlayers = function() {
    const output = document.getElementById('players-output');
    updateSortDirButton();

    const allValid = tournamentData.players.filter(p =>
        p.name !== '-' && p.club !== '-' && p.name !== '- -' && p.club !== '- -'
    );

    const validPlayers = filteredValidPlayers();

    if (validPlayers.length === 0) {
        output.innerHTML = allValid.length > 0
            ? '<div class="alert alert-info">' + t('Ningún jugador coincide con la búsqueda.') + '</div>'
            : '<div class="alert alert-info">' + t('No hay jugadores registrados aún. Agrega jugadores usando el formulario de arriba.') + '</div>';
        return;
    }

    const sorted = validPlayers.slice().sort((a, b) => {
        const va = playerSortValue(a);
        const vb = playerSortValue(b);
        let cmp;
        if (typeof va === 'number' && typeof vb === 'number') {
            cmp = va - vb;
        } else {
            cmp = String(va).localeCompare(String(vb), 'es');
        }
        return playerSortDir === 'asc' ? cmp : -cmp;
    });

    let html = '<div class="form-section"><h3>' + t('👥 Lista de Jugadores') + '</h3>';
    html += '<p style="font-size: 12px; color: var(--text-muted); margin: 0 0 10px 0;">' + t('Mostrando') + ' ' + sorted.length + ' ' + t('de') + ' ' + allValid.length + ' ' + t('jugador(es).') + '</p>';
    html += '<table class="data-table">';
    html += '<tr><th>#</th><th>' + t('Nombre') + '</th><th>' + t('Club') + '</th><th>' + t('Edad') + '</th><th>ELO</th><th>' + t('Ranking') + '</th><th>' + t('Check-in') + '</th><th>' + t('Categorías') + '</th><th>' + t('Acciones') + '</th></tr>';

    sorted.forEach((player, idx) => {
        const realIndex = tournamentData.players.indexOf(player);
        const elo = typeof player.elo === 'number' ? player.elo : (window.DEFAULT_ELO || 1200);
        const isGroup = Array.isArray(player.members) && player.members.length >= 2;
        const membersLabel = isGroup
            ? `<div style="font-size: 11px; color: var(--text-muted);">👥 ${player.members.map(m => escHtml(m.name)).join(', ')}</div>`
            : '';
        const licLabel = player.licencia
            ? `<div style="font-size: 11px; color: var(--text-muted);" title="${t('Número de licencia')}">🎫 ${escHtml(player.licencia)}</div>`
            : '';
        const age = window.getPlayerAge(player.fechaNac);
        html += `
            <tr>
                <td>${idx + 1}</td>
                <td style="display: flex; align-items: center; gap: 8px;">${avatarHTML(player, 32)}<span>${escHtml(player.name)}${isGroup ? ' <span style="font-size: 11px; background: var(--btn-info); color: #fff; border-radius: 4px; padding: 1px 6px;">👥 ' + t('DOBLES/EQUIPO') + '</span>' : ''}${membersLabel}${licLabel}</span></td>
                <td>${escHtml(player.club)}</td>
                <td>${age === null ? '-' : age}</td>
                <td style="font-weight: bold;">${elo}</td>
                <td>${escHtml(player.ranking) || '-'}</td>
                <td><button class="btn ${player.checkin ? 'btn-success' : 'btn-dark'}" style="padding: 4px 10px; font-size: 11px;" onclick="toggleCheckin(${realIndex})">${player.checkin ? t('✅ Presente') : t('⬜ Ausente')}</button></td>
                <td>${player.categories ? player.categories.map(escHtml).join(', ') : '-'}</td>
                <td>
                    <button class="btn btn-info" style="padding: 5px 10px; font-size: 12px;" onclick="showPlayerProfile(${realIndex})">👤 ${t('Perfil')}</button>
                    <button class="btn btn-info" style="padding: 5px 10px; font-size: 12px;" onclick="editPlayer(${realIndex})">✏️ ${t('Editar')}</button>
                    <button class="btn btn-danger" style="padding: 5px 10px; font-size: 12px;" onclick="deletePlayer(${realIndex})">🗑️ ${t('Eliminar')}</button>
                </td>
            </tr>
        `;
    });

    html += '</table></div>';
    output.innerHTML = html;
};

// ==========================================
// PERFIL DE JUGADOR, CHECK-IN E HISTORIAL
// ==========================================

/**
 * Gráfico de evolución por fecha (puntos por torneo) en SVG.
 */
function buildEvolutionChart(history) {
    if (!history || history.length === 0) {
        return '<p style="color: var(--text-muted); font-style: italic;">' + t('Sin historial todavía. Al finalizar un torneo se registra automáticamente la actuación de cada jugador.') + '</p>';
    }

    const data = history.slice().sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
    const max = Math.max(1, ...data.map(h => h.pts || 0));
    const w = 620, h = 170, pad = 34;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;

    let svg = `<svg width="100%" viewBox="0 0 ${w} ${h}" style="max-width:100%; background: var(--surface-alt); border-radius: 8px; display: block; margin-top: 10px;">`;
    svg += `<line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h - pad}" stroke="var(--border-color)" stroke-width="1"/>`;
    svg += `<line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="var(--border-color)" stroke-width="1"/>`;

    const xFor = i => data.length > 1 ? pad + (i * innerW / (data.length - 1)) : pad + innerW / 2;
    const yFor = v => pad + innerH - (v / max) * innerH;

    const points = data.map((d, i) => `${xFor(i)},${yFor(d.pts || 0)}`).join(' ');
    svg += `<polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;

    data.forEach((d, i) => {
        const x = xFor(i);
        const y = yFor(d.pts || 0);
        svg += `<circle cx="${x}" cy="${y}" r="4" fill="var(--accent)"/>`;
        svg += `<text x="${x}" y="${y - 9}" text-anchor="middle" font-size="11" fill="var(--text-color)">${d.pts || 0}</text>`;
        svg += `<text x="${x}" y="${h - pad + 15}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${(d.fecha || '').slice(5)}</text>`;
    });

    svg += '</svg>';
    return svg;
}

// ==========================================
// AVATAR / FOTO DE PERFIL
// ==========================================

/**
 * Genera el HTML de la foto/avatar de un jugador. Si no tiene foto cargada,
 * muestra un círculo con sus iniciales y un color derivado de su nombre.
 * @param {Object} player - Jugador
 * @param {number} size - Tamaño en px
 * @returns {string}
 */
function avatarHTML(player, size = 40) {
    if (!player) return '';
    if (player.avatar) {
        return `<img src="${player.avatar}" alt="${t('Foto de')} ${escHtml(player.name)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid var(--border-color);">`;
    }
    const words = (player.name || '?').trim().split(/\s+/).filter(Boolean);
    const initials = words.map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
    const hues = [210, 160, 330, 25, 250, 90, 15, 280];
    let hash = 0;
    const name = player.name || '';
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    const hue = hues[hash % hues.length];
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:hsl(${hue},55%,45%);color:#fff;font-weight:bold;font-size:${Math.round(size * 0.38)}px;flex-shrink:0;user-select:none;border:2px solid var(--border-color);">${escHtml(initials)}</div>`;
}

/**
 * Descarga una copia .jpg de la foto de perfil para guardarla en la carpeta
 * avatars/ del proyecto. El navegador la guarda en su carpeta de descargas;
 * desde ahí se puede mover/colocar dentro de avatars/.
 */
function downloadAvatarCopy(dataUrl, player) {
    try {
        const a = document.createElement('a');
        a.href = dataUrl;
        const name = (typeof formatPlayerName === 'function' ? formatPlayerName(player.name) : (player.name || 'jugador'))
            .replace(/[^a-zA-Z0-9_]+/g, '_')
            .replace(/^_+|_+$/g, '');
        a.download = 'avatar_' + (name || 'jugador') + '.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (error) {
        console.error('No se pudo descargar la copia de la foto:', error);
    }
}

/**
 * Cambia la foto de perfil de un jugador (redimensiona a 128px para no
 * inflar el localStorage), descarga una copia .jpg en la carpeta avatars/
 * del proyecto y recarga el perfil.
 */
window.changePlayerAvatar = function(index) {
    const player = tournamentData.players[index];
    if (!player) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const max = 128;
                const ratio = Math.min(max / img.width, max / img.height, 1);
                canvas.width = Math.max(1, Math.round(img.width * ratio));
                canvas.height = Math.max(1, Math.round(img.height * ratio));
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                player.avatar = canvas.toDataURL('image/jpeg', 0.85);
                downloadAvatarCopy(player.avatar, player);
                saveTournamentData();
                addLog('FOTO', t('Foto de perfil actualizada:') + ` ${player.name} (${player.club})`);
                showToast(t('Foto de perfil actualizada (copia en avatars/)'), 'success');
                closeModal();
                showPlayerProfile(index);
            };
            img.onerror = function() {
                showToast(t('No se pudo leer la imagen'), 'error');
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    };
    input.click();
};

/**
 * Elimina la foto de perfil de un jugador.
 */
window.removePlayerAvatar = function(index) {
    const player = tournamentData.players[index];
    if (!player) return;
    player.avatar = undefined;
    saveTournamentData();
    addLog('FOTO', t('Foto de perfil eliminada:') + ` ${player.name} (${player.club})`);
    showToast(t('Foto de perfil eliminada'), 'success');
    closeModal();
    showPlayerProfile(index);
};

// ==========================================
// ESTADÍSTICAS DEL TORNEO ACTUAL, H2H Y PARTIDOS
// ==========================================

/**
 * Clave de identidad de un participante (equipara dobles/equipos).
 */
function playerKey(p) {
    return (p.name || '') + '|' + (p.club || '');
}

/**
 * Indica si el jugador integra el participante (por nombre/club directo o
 * como miembro de una pareja/equipo). Devuelve 1, 2 o 0 según el lado.
 */
function isPlayerInMatch(player, p1, p2) {
    if (!player) return 0;
    if (p1 && (player.name === p1.name && player.club === p1.club)) return 1;
    if (p2 && (player.name === p2.name && player.club === p2.club)) return 2;
    if (Array.isArray(p1.members) && p1.members.some(m => m && m.name === player.name && m.club === player.club)) return 1;
    if (Array.isArray(p2.members) && p2.members.some(m => m && m.name === player.name && m.club === player.club)) return 2;
    return 0;
}

/**
 * Reúne todos los partidos de un jugador en los fixtures guardados, ordenados
 * por fecha de fixture y número de partido.
 */
function getPlayerFixtureMatches(index) {
    const player = tournamentData.players[index];
    if (!player) return [];
    const out = [];
    (tournamentData.fixtures || []).forEach(f => {
        (f.matches || []).forEach(m => {
            const side = isPlayerInMatch(player, m.player1, m.player2);
            if (!side) return;
            out.push({
                fixture: f,
                match: m,
                side,
                opponent: side === 1 ? m.player2 : m.player1,
                timestamp: f.timestamp || '',
                matchNum: m.match || 0
            });
        });
    });
    out.sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.matchNum - b.matchNum));
    return out;
}

/**
 * Resultado de un partido para el lado del jugador: { won, wo } o null si no completó.
 */
function matchResultFor(entry) {
    const m = entry.match;
    if (!m || !m.completed) return null;
    if (m.wo) {
        return { won: m.woWinnerSide === entry.side, wo: true };
    }
    return { won: m.winnerSide === entry.side, wo: false };
}

/**
 * Sets y puntos ganados/perdidos por un jugador en un partido.
 */
function setsAggregateFor(entry) {
    const m = entry.match;
    const s1 = (m.sets && m.sets.player1) || [];
    const s2 = (m.sets && m.sets.player2) || [];
    const agg = { setsWon: 0, setsLost: 0, pointsFor: 0, pointsAgainst: 0 };
    for (let i = 0; i < Math.max(s1.length, s2.length); i++) {
        const v1 = parseInt(s1[i]) || 0;
        const v2 = parseInt(s2[i]) || 0;
        if (v1 === 0 && v2 === 0) continue;
        if (entry.side === 1) {
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
    return agg;
}

/**
 * Estadísticas del jugador en el torneo actual (todos los fixtures guardados):
 * partidos, victorias, derrotas, sets, puntos, racha y desglose por categoría.
 */
function getPlayerCurrentTournamentStats(index) {
    const entries = getPlayerFixtureMatches(index);
    const stats = {
        played: 0, won: 0, lost: 0,
        setsWon: 0, setsLost: 0,
        pointsFor: 0, pointsAgainst: 0,
        streak: 0, byCategory: {}
    };

    entries.forEach(e => {
        const r = matchResultFor(e);
        if (!r) return;
        stats.played++;
        if (r.won) stats.won++; else stats.lost++;
        const agg = setsAggregateFor(e);
        stats.setsWon += agg.setsWon;
        stats.setsLost += agg.setsLost;
        stats.pointsFor += agg.pointsFor;
        stats.pointsAgainst += agg.pointsAgainst;
        const cat = e.fixture.categoria || 'General';
        const b = stats.byCategory[cat] = stats.byCategory[cat] || { played: 0, won: 0 };
        b.played++;
        if (r.won) b.won++;
    });

    // Racha actual: desde el partido más reciente hacia atrás.
    const results = entries.map(matchResultFor).filter(Boolean);
    for (let i = results.length - 1; i >= 0; i--) {
        if (results[i].won && stats.streak >= 0) stats.streak++;
        else if (results[i].won) { stats.streak = 1; }
        else if (stats.streak <= 0) stats.streak--;
        else stats.streak = -1;
    }

    return stats;
}

/**
 * Enfrentamientos cabeza a cabeza (H2H) contra cada rival en el torneo actual.
 */
function getPlayerHeadToHead(index) {
    const map = {};
    getPlayerFixtureMatches(index).forEach(e => {
        const r = matchResultFor(e);
        if (!r) return;
        const op = e.opponent || {};
        const key = playerKey(op);
        const h = map[key] = map[key] || {
            name: op.name || '-', club: op.club || '',
            played: 0, won: 0, lost: 0, setsWon: 0, setsLost: 0
        };
        h.played++;
        if (r.won) h.won++; else h.lost++;
        const agg = setsAggregateFor(e);
        h.setsWon += agg.setsWon;
        h.setsLost += agg.setsLost;
    });
    return Object.values(map).sort((a, b) => b.played - a.played || (b.won / b.played) - (a.won / a.played));
}

/**
 * Últimos partidos completados del jugador (de más reciente a más antiguo).
 */
function getPlayerRecentMatches(index, limit = 5) {
    return getPlayerFixtureMatches(index)
        .filter(e => matchResultFor(e))
        .slice(-limit)
        .reverse();
}

/**
 * Próximos partidos pendientes del jugador (con su programación mesa/hora si existe).
 */
function getPlayerUpcomingMatches(index, limit = 5) {
    return getPlayerFixtureMatches(index)
        .filter(e => !e.match.completed)
        .slice(0, limit);
}

/**
 * Devuelve la programación (mesa/hora) de un partido del fixture, si existe.
 */
function scheduleEntryFor(fixture, matchNum) {
    return (fixture.schedule || []).find(s => s.match === matchNum) || null;
}

/**
 * Formatea la fecha de un fixture (timestamp ISO) a formato corto local.
 */
function fixtureDateShort(fixture) {
    const t = new Date(fixture.timestamp);
    return isNaN(t.getTime()) ? '' : t.toLocaleDateString(window.i18nLocale());
}

/**
 * Muestra el perfil de un jugador: foto, historial de torneos, puntos
 * acumulados, estadísticas del torneo actual, evolución, H2H y partidos.
 */
window.showPlayerProfile = function(index) {
    const player = tournamentData.players[index];
    if (!player) return;

    const history = (player.history || []).slice();
    const career = history.reduce((sum, h) => sum + (h.pts || 0), 0);
    const currentPts = window.sumCurrentTournamentPoints ? window.sumCurrentTournamentPoints(player.name, player.club) : 0;
    const torneosJugados = history.length;
    const mejor = history.reduce((best, h) => (h.posicion && (!best || h.posicion < best)) ? h.posicion : best, null);
    const elo = typeof player.elo === 'number' ? player.elo : (window.DEFAULT_ELO || 1200);

    const stats = getPlayerCurrentTournamentStats(index);
    const h2h = getPlayerHeadToHead(index);
    const recent = getPlayerRecentMatches(index, 5);
    const upcoming = getPlayerUpcomingMatches(index, 5);
    const winPct = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
    const diffSets = stats.setsWon - stats.setsLost;
    const streakLabel = stats.streak > 0 ? '🔥 ' + stats.streak + 'G' : stats.streak < 0 ? '📉 ' + Math.abs(stats.streak) + 'P' : '—';

    const historyRows = history.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map(h => `
        <tr>
            <td>${h.fecha || '-'}</td>
            <td>${h.torneo || '-'}</td>
            <td>${h.categoria || '-'}</td>
            <td>${h.posicion ? '#' + h.posicion : '-'}</td>
            <td>${h.pts || 0}</td>
        </tr>
    `).join('');

    const catBreakdown = Object.keys(stats.byCategory).length > 0
        ? '<div style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">' +
          Object.entries(stats.byCategory).map(([cat, b]) =>
              `${escHtml(cat)}: ${b.played} PJ · ${b.won}G/${b.played - b.won}P`
          ).join(' &nbsp;|&nbsp; ') + '</div>'
        : '';    const h2hRows = h2h.length > 0 ? h2h.map(h => {
        const pct = h.played > 0 ? Math.round((h.won / h.played) * 100) : 0;
        return `<tr>
            <td>${escHtml(h.name)} <small style="color: var(--text-muted);">${escHtml(h.club)}</small></td>
            <td>${h.played}</td>
            <td style="color: #2e7d32; font-weight: bold;">${h.won}</td>
            <td style="color: #c62828;">${h.lost}</td>
            <td>${h.setsWon}-${h.setsLost}</td>
            <td>${pct}%</td>
        </tr>`;
    }).join('') : '';

    const recentRows = recent.map(e => {
        const r = matchResultFor(e);
        const opp = e.opponent || {};
        const agg = setsAggregateFor(e);
        const sets = `${agg.setsWon}-${agg.setsLost}`;
        const badge = r.wo
            ? '<span style="color: var(--text-muted);">W.O.</span>'
            : `<span style="color: ${r.won ? '#2e7d32' : '#c62828'}; font-weight: bold;">${r.won ? 'V' : 'D'}</span>`;
        return `<tr>
            <td>${escHtml(e.fixture.categoria || '-')} · ${escHtml(e.fixture.grupo || '-')}</td>
            <td>${escHtml(opp.name || '-')} <small style="color: var(--text-muted);">${escHtml(opp.club || '')}</small></td>
            <td>${badge}</td>
            <td>${sets}</td>
            <td>${fixtureDateShort(e.fixture)}</td>
        </tr>`;
    }).join('');

    const upcomingRows = upcoming.map(e => {
        const opp = e.opponent || {};
        const sch = scheduleEntryFor(e.fixture, e.matchNum);
        return `<tr>
            <td>${escHtml(e.fixture.categoria || '-')} · ${escHtml(e.fixture.grupo || '-')}</td>
            <td>${escHtml(opp.name || '-')} <small style="color: var(--text-muted);">${escHtml(opp.club || '')}</small></td>
            <td>${sch && sch.mesa !== '-' ? t('🪑 Mesa') + ' ' + sch.mesa : '—'}</td>
            <td>${sch && sch.hora !== '-' && sch.hora !== 'Sin cupo' ? '🕐 ' + sch.hora : '—'}</td>
        </tr>`;
    }).join('');

    showModal(
        t('👤 Perfil de Jugador'),
        `<div style="color: var(--text-color);">
            <div style="display: flex; align-items: center; margin-bottom: 15px; gap: 15px; flex-wrap: wrap;">
                ${avatarHTML(player, 84)}
                <div style="min-width: 0; flex: 1;">
                    <h2 style="margin: 0;">${escHtml(player.name)}</h2>
                    <span style="color: var(--text-muted); font-size: 14px;">${escHtml(player.club)}</span>
                    <div style="margin-top: 6px; font-size: 12px;">${(player.categories || []).map(escHtml).join(', ') || '-'}</div>
                    <div style="margin-top: 4px; font-size: 12px; color: var(--text-muted);">
                        ${player.fechaNac ? `🎂 ${parseLocalDate(player.fechaNac).toLocaleDateString(window.i18nLocale())} · ${window.getPlayerAge(player.fechaNac)} ${t('años')}` : t('🎂 Edad: —')}
                        ${player.licencia ? ` · 🎫 ${t('Licencia:')} ${escHtml(player.licencia)}` : ''}
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <button class="btn btn-info" style="padding: 6px 12px; font-size: 12px;" onclick="changePlayerAvatar(${index})">📷 ${t('Cambiar foto')}</button>
                    <button class="btn btn-info" style="padding: 6px 12px; font-size: 12px;" onclick="editPlayerFromProfile(${index})">✏️ ${t('Editar datos')}</button>
                    <button class="btn btn-info" style="padding: 6px 12px; font-size: 12px;" onclick="showPlayerQR(${index})">📱 ${t('Ver QR')}</button>
                    <button class="btn ${player.checkin ? 'btn-success' : 'btn-dark'}" style="padding: 6px 12px; font-size: 12px;" onclick="toggleCheckin(${index}); closeModal(); showPlayerProfile(${index});">${player.checkin ? t('✅ Presente') : t('⬜ Marcar presente')}</button>
                    ${player.avatar ? `<button class="btn btn-danger" style="padding: 6px 12px; font-size: 12px;" onclick="removePlayerAvatar(${index})">🗑️ ${t('Quitar foto')}</button>` : ''}
                </div>
            </div>

            <div class="dashboard-grid" style="margin-bottom: 15px;">
                <div class="stat-card">
                    <h4>⭐ ${t('Rating ELO')}</h4>
                    <div class="stat-value">${elo}</div>
                    <div class="stat-label">${t('Dinámico por resultados')}</div>
                </div>
                <div class="stat-card">
                    <h4>🏅 ${t('Puntos acumulados')}</h4>
                    <div class="stat-value">${career + currentPts}</div>
                    <div class="stat-label">${career} ${t('de historial')} + ${currentPts} ${t('del torneo actual')}</div>
                </div>
                <div class="stat-card">
                    <h4>🏆 ${t('Torneos jugados')}</h4>
                    <div class="stat-value">${torneosJugados}</div>
                    <div class="stat-label">${mejor ? t('Mejor puesto: #') + mejor : t('Sin historial')}</div>
                </div>
            </div>

            <h4 style="margin: 0 0 4px 0;">🎾 ${t('Rendimiento en el torneo actual')}</h4>
            <div class="dashboard-grid" style="margin-bottom: 6px;">
                <div class="stat-card">
                    <h4>${t('Partidos')}</h4>
                    <div class="stat-value" style="font-size: 24px;">${stats.played}</div>
                    <div class="stat-label">${stats.won}G · ${stats.lost}P (${winPct}% ${t('efectividad')})</div>
                </div>
                <div class="stat-card">
                    <h4>${t('Sets a favor')}</h4>
                    <div class="stat-value" style="font-size: 24px; color: ${diffSets >= 0 ? '#2e7d32' : '#c62828'};">${stats.setsWon}-${stats.setsLost}</div>
                    <div class="stat-label">${diffSets >= 0 ? '+' : ''}${diffSets} ${t('de diferencia')}</div>
                </div>
                <div class="stat-card">
                    <h4>${t('Puntos totales')}</h4>
                    <div class="stat-value" style="font-size: 24px;">${stats.pointsFor}</div>
                    <div class="stat-label">${stats.pointsAgainst} ${t('en contra')}</div>
                </div>
                <div class="stat-card">
                    <h4>${t('Racha')}</h4>
                    <div class="stat-value" style="font-size: 24px;">${streakLabel}</div>
                    <div class="stat-label">${stats.streak === 0 ? t('Sin resultados aún') : t('Últimos resultados consecutivos')}</div>
                </div>
            </div>
            ${catBreakdown}

            <h4 style="margin: 18px 0 8px 0;">📊 ${t('Enfrentamientos directos (H2H)')}</h4>
            ${h2hRows ? `
                <div style="max-height: 180px; overflow-y: auto;">
                    <table class="data-table">
                        <tr><th>${t('Rival')}</th><th>PJ</th><th>G</th><th>P</th><th>${t('Sets')}</th><th>%</th></tr>
                        ${h2hRows}
                    </table>
                </div>` : '<p style="color: var(--text-muted); font-style: italic; font-size: 13px;">' + t('Sin partidos jugados todavía.') + '</p>'}

            <h4 style="margin: 18px 0 8px 0;">📅 ${t('Próximos partidos')}</h4>
            ${upcomingRows ? `
                <div style="max-height: 150px; overflow-y: auto;">
                    <table class="data-table">
                        <tr><th>${t('Fixture')}</th><th>${t('Rival')}</th><th>${t('Mesa')}</th><th>${t('Hora')}</th></tr>
                        ${upcomingRows}
                    </table>
                </div>` : '<p style="color: var(--text-muted); font-style: italic; font-size: 13px;">' + t('No hay partidos pendientes.') + '</p>'}

            <h4 style="margin: 18px 0 8px 0;">🕘 ${t('Últimos resultados')}</h4>
            ${recentRows ? `
                <div style="max-height: 150px; overflow-y: auto;">
                    <table class="data-table">
                        <tr><th>${t('Fixture')}</th><th>${t('Rival')}</th><th>${t('Resultado')}</th><th>${t('Sets')}</th><th>${t('Fecha')}</th></tr>
                        ${recentRows}
                    </table>
                </div>` : '<p style="color: var(--text-muted); font-style: italic; font-size: 13px;">' + t('Sin resultados cargados.') + '</p>'}

            <h4 style="margin: 18px 0 4px 0;">📈 ${t('Evolución por fecha (puntos por torneo)')}</h4>
            ${buildEvolutionChart(history)}

            <h4 style="margin: 18px 0 8px 0;">🏆 ${t('Historial de torneos')}</h4>
            <div style="max-height: 200px; overflow-y: auto;">
                <table class="data-table">
                    <tr><th>${t('Fecha')}</th><th>${t('Torneo')}</th><th>${t('Categoría')}</th><th>${t('Posición')}</th><th>${t('Puntos')}</th></tr>
                    ${historyRows || '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">' + t('Sin historial registrado') + '</td></tr>'}
                </table>
            </div>
        </div>`,
        null,
        null,
        { full: true }
    );
};

/**
 * Alterna el check-in de un jugador desde la tabla (reedita la tabla).
 */
window.toggleCheckin = function(index) {
    const player = tournamentData.players[index];
    if (!player) return;
    player.checkin = !player.checkin;
    saveTournamentData();
    addLog('CHECK-IN', `${player.name} (${player.club}) ${player.checkin ? t('presente') : t('ausente')}`);
    showAllPlayers();
    renderCheckinQuickActions();
    showToast(player.checkin ? `${player.name} ${t('marcado como presente')}` : `${player.name} ${t('marcado como ausente')}`, player.checkin ? 'success' : 'warning');
};

/**
 * Alterna el check-in de un jugador desde el modal de check-in.
 */
window.toggleCheckinModal = function(index) {
    const player = tournamentData.players[index];
    if (!player) return;
    player.checkin = !player.checkin;
    saveTournamentData();
    addLog('CHECK-IN', `${player.name} (${player.club}) ${player.checkin ? t('presente') : t('ausente')}`);
    showAllPlayers();
    renderCheckinQuickActions();
    showCheckinModal();
};

/**
 * Marca a un jugador como presente desde las acciones rápidas de check-in.
 * @param {number} index
 */
window.quickCheckin = function(index) {
    const player = tournamentData.players[index];
    if (!player) return;
    if (!player.checkin) {
        player.checkin = true;
        saveTournamentData();
        addLog('CHECK-IN', `${player.name} (${player.club}) ${t('presente (acceso rápido)')}`);
        showToast(`✅ ${player.name} ${t('marcado como presente')}`);
    }
    renderCheckinQuickActions();
    showAllPlayers();
};

/**
 * Muestra una barra de acciones rápidas de check-in en el tab Jugadores:
 * lista de jugadores aún ausentes con un botón para acreditarlos al instante.
 */
window.renderCheckinQuickActions = function() {
    const container = document.getElementById('checkin-quick-actions');
    if (!container) return;

    const valid = (tournamentData.players || []).filter(p =>
        p.name !== '-' && p.club !== '-' && p.name !== '- -' && p.club !== '- -'
    );
    const absent = valid.filter(p => !p.checkin);

    if (absent.length === 0) {
        container.innerHTML = '';
        return;
    }

    const pct = Math.round(((valid.length - absent.length) / valid.length) * 100);
    container.innerHTML = `
        <div class="form-section">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                <h3 style="margin: 0;">🔔 ${t('Check-in Rápido')}</h3>
                <span style="font-size: 12px; color: var(--text-muted);">${valid.length - absent.length}/${valid.length} ${t('presentes')} (${pct}%)</span>
            </div>
            <p style="font-size: 12px; color: var(--text-muted); margin: 0 0 10px 0;">${t('Jugadores que todavía no se acreditaron. Tocá el botón para marcarlos presentes al instante.')}</p>
            <table class="data-table">
                <tr><th>${t('Nombre')}</th><th>${t('Club')}</th><th>${t('Categorías')}</th><th>${t('Acción')}</th></tr>
                ${absent.map(p => {
                    const realIndex = tournamentData.players.indexOf(p);
                    return `<tr>
                        <td>${escHtml(p.name)}</td>
                        <td>${escHtml(p.club)}</td>
                        <td>${(p.categories || []).map(escHtml).join(', ') || '-'}</td>
                        <td><button class="btn btn-success" style="padding: 4px 10px; font-size: 11px;" onclick="quickCheckin(${realIndex})">✅ ${t('Acreditar')}</button></td>
                    </tr>`;
                }).join('')}
            </table>
        </div>`;
};

/**
 * Muestra el modal de check-in de todos los jugadores.
 */
window.showCheckinModal = function() {
    const players = (tournamentData.players || []).filter(p =>
        p.name !== '-' && p.club !== '-' && p.name !== '- -' && p.club !== '- -'
    );

    if (players.length === 0) {
        showToast(t('No hay jugadores para hacer check-in'), 'warning');
        return;
    }

    const presentes = players.filter(p => p.checkin).length;
    const allPresent = presentes === players.length;

    let html = `<p><strong>${t('Presentes:')} ${presentes} / ${players.length}</strong></p>`;
    html += `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; background: var(--surface-alt); border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 12px;">
            <div>
                <strong style="font-size: 14px;">${t('Marcar a todos')}</strong><br>
                <small style="color: var(--text-muted); font-size: 12px;">${t('Toggle: todos presentes / todos ausentes')}</small>
            </div>
            <label class="toggle-switch" title="${t('Marcar a todos presentes o ausentes')}">
                <input type="checkbox" id="checkin-toggle-all" ${allPresent ? 'checked' : ''} onchange="toggleCheckinAll(this.checked)">
                <span class="toggle-slider"></span>
            </label>
            <span style="font-size: 13px; font-weight: bold; min-width: 120px;">${allPresent ? t('✅ Todos presentes') : (presentes === 0 ? t('⬜ Todos ausentes') : t('⚖️ Mixto'))}</span>
        </div>`;
    html += '<div style="max-height: 420px; overflow-y: auto;">';

    players.forEach(p => {
        const realIndex = tournamentData.players.indexOf(p);
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid var(--border-color); gap: 10px;">
                <div style="min-width: 0;">
                    <strong style="display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escHtml(p.name)}</strong>
                    <small style="color: var(--text-muted);">${escHtml(p.club)} · ${(p.categories || []).map(escHtml).join(', ')}</small>
                </div>
                <button class="btn ${p.checkin ? 'btn-success' : 'btn-dark'}" style="padding: 5px 12px; font-size: 12px; flex-shrink: 0;" onclick="toggleCheckinModal(${realIndex})">${p.checkin ? t('✅ Presente') : t('⬜ Ausente')}</button>
            </div>`;
    });

    html += '</div>';
    showModal(t('✅ Check-in de Jugadores'), html, () => {
        showAllPlayers();
    }, t('✅ Aceptar'));
};

/**
 * Toggle masivo: marca a todos los jugadores presentes o ausentes de una vez.
 * @param {boolean} present - true = todos presentes, false = todos ausentes
 */
window.toggleCheckinAll = function(present) {
    (tournamentData.players || []).forEach(p => { p.checkin = !!present; });
    saveTournamentData();
    showToast(present ? t('Todos los jugadores marcados como presentes') : t('Todos los jugadores marcados como ausentes'), present ? 'success' : 'warning');
    addLog('CHECK-IN', present ? t('Toggle masivo: todos presentes') : t('Toggle masivo: todos ausentes'));
    showAllPlayers();
    renderCheckinQuickActions();
    showCheckinModal();
};

/**
 * Registra en el historial de cada jugador su actuación en el torneo finalizado.
 * @param {Object} podiumsByCategory - Resultado de calculatePodiums()
 */
window.snapshotTournamentResults = function(podiumsByCategory) {
    const torneo = (tournamentData.settings.torneoNombre || 'Torneo').replace(/🏓/g, '').trim() || 'Torneo';
    const fecha = new Date().toISOString().slice(0, 10);
    let added = 0;

    Object.keys(podiumsByCategory || {}).forEach(cat => {
        (podiumsByCategory[cat] || []).forEach((p, idx) => {
            const entry = {
                fecha,
                torneo,
                categoria: cat,
                posicion: idx + 1,
                pts: p.points || 0
            };
            const recordPlayer = (x) => {
                const db = (tournamentData.players || []).find(y => y.name === x.name && y.club === x.club);
                if (!db) return false;
                db.history = db.history || [];
                db.history.push(entry);
                added++;
                return true;
            };
            const ok = recordPlayer(p);
            if (ok && Array.isArray(p.members)) {
                p.members.forEach(m => recordPlayer(m));
            }
        });
    });

    if (added > 0) {
        saveTournamentData();
        addLog('HISTORIAL', t('Historial actualizado para') + ` ${added} ${t('jugadores')} (${torneo})`);
    }
    return added;
};

// ==========================================
// EDICIÓN DE JUGADOR (formulario compartido)
// ==========================================

/**
 * Genera el HTML del formulario de edición de un jugador. Se usa tanto en el
 * modal independiente (editPlayer) como en el modo edición inline del perfil
 * (editPlayerFromProfile), para no duplicar lógica ni ids.
 * @param {Object} player - Jugador a editar
 * @returns {string}
 */
function buildPlayerEditFormHTML(player) {
    // Usar las mismas categorías que el formulario de alta (incluye las
    // personalizadas cargadas por loadCustomCategories).
    const catSelect = document.getElementById('new-player-categories');
    let categoriesOptions;
    if (catSelect && catSelect.options && catSelect.options.length > 0) {
        categoriesOptions = Array.from(catSelect.options).map(o => o.value);
    } else {
        categoriesOptions = ['PRIMERA', 'SEGUNDA', 'TERCERA', 'CUARTA', 'DAMAS', 'SUB 9', 'SUB 11', 'SUB 13', 'SUB 15', 'SUB 19', 'SUB 23', 'MAXI 40', 'MAXI 50', 'MAXI 60'];
    }
    // Asegurar que las categorías actuales del jugador estén en la lista
    (player.categories || []).forEach(c => {
        if (!categoriesOptions.includes(c)) categoriesOptions.push(c);
    });

    let selectHTML = '<select id="modal-edit-categories" multiple style="width: 100%; height: 150px; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">';
    categoriesOptions.forEach(cat => {
        const selected = player.categories.includes(cat) ? 'selected' : '';
        selectHTML += `<option value="${escAttr(cat)}" ${selected}>${escHtml(cat)}</option>`;
    });
    selectHTML += '</select>';

    return `<div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold; color: var(--text-color);">${t('Nombre:')}</label>
            <input type="text" id="modal-edit-name" value="${escAttr(player.name)}" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
        </div>
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold; color: var(--text-color);">${t('Club:')}</label>
            <input type="text" id="modal-edit-club" value="${escAttr(player.club)}" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
        </div>
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold; color: var(--text-color);">${t('Ranking previo (seed):')}</label>
            <input type="number" id="modal-edit-ranking" min="1" value="${player.ranking || ''}" placeholder="${t('Opcional (1 = mejor)')}" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
        </div>
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold; color: var(--text-color);">${t('Fecha de nacimiento:')}</label>
            <input type="date" id="modal-edit-birthdate" value="${player.fechaNac || ''}" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
            <small style="color: var(--text-muted); font-size: 12px;">${player.fechaNac ? t('Edad:') + ' ' + (window.getPlayerAge(player.fechaNac) ?? '—') + ' ' + t('años') : t('Opcional. Usada para sub-categorías por edad.')}</small>
        </div>
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold; color: var(--text-color);">${t('Número de licencia:')}</label>
            <input type="text" id="modal-edit-license" maxlength="15" value="${player.licencia || ''}" placeholder="${t('Opcional (letras y números, 4-15)')}" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
        </div>
        <div>
            <label style="display: block; margin-bottom: 5px; font-weight: bold; color: var(--text-color);">${t('Categorías:')}</label>
            ${selectHTML}
            <small style="color: var(--text-muted); font-size: 12px;">${t('Mantén Ctrl para seleccionar múltiples')}</small>
        </div>`;
}

/**
 * Lee el formulario de edición abierto, valida y guarda los cambios.
 * @param {number} index - Índice del jugador en tournamentData.players
 * @returns {boolean} true si se guardó, false si hubo error de validación
 */
function applyPlayerEditForm(index) {
    const existingPlayer = tournamentData.players[index];
    if (!existingPlayer) return false;

    const newName = formatPlayerName(document.getElementById('modal-edit-name').value);
    const newClub = formatPlayerClub(document.getElementById('modal-edit-club').value);
    const rankingInput = document.getElementById('modal-edit-ranking');
    const newRanking = rankingInput && rankingInput.value !== '' ? parseInt(rankingInput.value) : null;
    const categoriesSelect = document.getElementById('modal-edit-categories');
    const newCategories = Array.from(categoriesSelect.selectedOptions).map(opt => opt.value);
    const birthInput = document.getElementById('modal-edit-birthdate');
    const newFechaNac = birthInput ? birthInput.value : '';
    const licInput = document.getElementById('modal-edit-license');
    const newLicencia = licInput ? licInput.value.trim() : '';

    if (!window.isValidLicense(newLicencia)) {
        showToast(t('Número de licencia inválido. Usá solo letras y números (4 a 15 caracteres) o dejalo vacío.'), 'error');
        return false;
    }

    if (!newName || !newClub || newCategories.length === 0) {
        showToast(t('Todos los campos son obligatorios'), 'error');
        return false;
    }

    tournamentData.players[index] = {
        name: newName,
        club: newClub,
        categories: newCategories,
        members: existingPlayer.members,
        ranking: newRanking && !isNaN(newRanking) ? newRanking : null,
        fechaNac: newFechaNac || undefined,
        licencia: newLicencia || undefined,
        checkin: !!existingPlayer.checkin,
        elo: typeof existingPlayer.elo === 'number' ? existingPlayer.elo : (window.DEFAULT_ELO || 1200),
        history: existingPlayer.history || [],
        avatar: existingPlayer.avatar
    };

    saveTournamentData();
    showAllPlayers();
    showToast(t('Jugador actualizado correctamente'));
    addLog('EDITAR JUGADOR', `${existingPlayer.name} → ${newName} (${newClub})`);
    return true;
}

/**
 * Edita un jugador en un modal independiente (usado desde la tabla de jugadores).
 */
window.editPlayer = function(index, reopenProfile) {
    const player = tournamentData.players[index];
    if (!player) return;
    showModal(
        t('✏️ Editar Jugador'),
        buildPlayerEditFormHTML(player),
        () => {
            if (applyPlayerEditForm(index) && reopenProfile) showPlayerProfile(index);
        },
        t('💾 Guardar cambios')
    );
};

/**
 * Entra en modo edición dentro del modal de perfil ya abierto: reemplaza el
 * contenido por el formulario y reconecta los botones Guardar/Cancelar para
 * volver al perfil en lugar de cerrar el modal.
 */
window.editPlayerFromProfile = function(index) {
    const player = tournamentData.players[index];
    if (!player) return;

    const content = document.getElementById('modal-content');
    if (!content) return;
    content.innerHTML = buildPlayerEditFormHTML(player);

    const title = document.getElementById('modal-title');
    if (title) title.textContent = t('✏️ Editando:') + ' ' + player.name;

    const confirmBtn = document.getElementById('modal-confirm');
    if (confirmBtn) {
        confirmBtn.style.display = 'inline-flex';
        confirmBtn.textContent = t('💾 Guardar cambios');
        confirmBtn.onclick = function() {
            if (applyPlayerEditForm(index)) showPlayerProfile(index);
        };
    }

    const cancelBtn = document.getElementById('modal-cancel');
    if (cancelBtn) {
        cancelBtn.onclick = function() { showPlayerProfile(index); };
    }
};

// Eliminar jugador
window.deletePlayer = function(index) {
    const player = tournamentData.players[index];
    showModal(
        t('⚠️ ¿Eliminar Jugador?'),
        `<p style="color: var(--text-color);">${t('¿Estás seguro de que deseas eliminar a')} <strong>${escHtml(player.name)}</strong> ${t('de')} <strong>${escHtml(player.club)}</strong>?</p>
        <p style="color: var(--danger); font-weight: bold;">${t('Esta acción NO se puede deshacer.')}</p>`,
        () => {
            tournamentData.players.splice(index, 1);
            saveTournamentData();
            showAllPlayers();
            showToast(t('Jugador eliminado correctamente'));
            addLog('ELIMINAR JUGADOR', `${player.name} (${player.club})`);
        }
    );
};

// Exportar jugadores
window.exportPlayersDialog = function() {
    showModal(
        t('📊 Exportar Jugadores'),
        `<p style="color: var(--text-color);">${t('¿En qué formato deseas exportar los jugadores?')}</p><div class="button-grid"><button class="btn btn-success" onclick="closeModal(); exportPlayersExcel();">📊 ${t('Excel')} (.xlsx)</button><button class="btn btn-info" onclick="closeModal(); exportPlayersJSON();">📄 ${t('JSON')} (.json)</button></div>`,
        null
    );
};

window.exportPlayersExcel = function() {
    if (typeof XLSX === 'undefined') {
        showToast(t('Librería Excel no disponible'), 'error');
        return;
    }

    const wb = XLSX.utils.book_new();
    const playersData = [['#', t('Nombre'), t('Club'), t('Categorías')]];

    tournamentData.players.forEach((p, idx) => {
        playersData.push([
            idx + 1,
            p.name,
            p.club,
            p.categories ? p.categories.join(', ') : '-'
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(playersData);
    XLSX.utils.book_append_sheet(wb, ws, t('Jugadores'));

    const filename = `Jugadores_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast(t('Archivo Excel generado:') + ` ${filename}`);
};

window.exportPlayersJSON = function() {
    const dataStr = JSON.stringify(tournamentData.players, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Jugadores_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t('Jugadores exportados a JSON'));
    addLog('EXPORTAR', t('Jugadores exportados a JSON') + ` (${tournamentData.players.length} ${t('jugadores')})`);
};

/**
 * Abre el diálogo de importación de jugadores (JSON o CSV/Excel).
 */
window.importPlayersDialog = function() {
    showModal(
        t('📥 Importar Jugadores'),
        `<p style="color: var(--text-color);">${t('¿En qué formato está el archivo de jugadores?')}</p>
         <div class="button-grid">
             <button class="btn btn-success" onclick="closeModal(); importPlayersFile();">📊 ${t('CSV / Excel')} (.csv, .xlsx)</button>
             <button class="btn btn-info" onclick="closeModal(); importPlayersJSON();">📄 ${t('JSON')} (.json)</button>
         </div>
         <p style="font-size: 12px; color: var(--text-muted); margin-top: 10px;">${t('💡 Tip: descargá la plantilla con el botón "📋 Plantilla de Importación" para ver las columnas esperadas (Nombre, Club, Categorías, Ranking, Fecha de Nacimiento, Licencia).')}</p>`,
        null
    );
};

window.importPlayersJSON = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const players = JSON.parse(event.target.result);
                if (Array.isArray(players)) {
                    players.forEach(p => {
                        if (p.name && p.club) {
                            p.name = formatPlayerName(p.name);
                            p.club = formatPlayerClub(p.club);
                            const exists = tournamentData.players.find(tp =>
                                tp.name === p.name && tp.club === p.club
                            );
                            if (!exists) {
                                tournamentData.players.push(p);
                            }
                        }
                    });
                    saveTournamentData();
                    showAllPlayers();
                    showToast(`${players.length} ${t('jugadores importados')}`);
                }
            } catch (err) {
                showToast(t('Error al importar jugadores:') + ' ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

/**
 * Descarga una plantilla editable (.xlsx) con el formato esperado por
 * importPlayersFile: una fila de encabezados + una fila de ejemplo.
 */
window.downloadPlayersTemplate = function() {
    if (typeof XLSX === 'undefined') {
        showToast(t('Librería Excel no disponible'), 'error');
        return;
    }

    const wb = XLSX.utils.book_new();
    const rows = [
        [t('Nombre'), t('Club'), t('Categorías'), t('Ranking'), t('Fecha de Nacimiento'), t('Licencia')],
        [t('Ejemplo: Juan Pérez'), t('Club Verde'), 'Sub-13, Sub-15', 1200, '2012-03-15', 'ABC123']
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 26 }, { wch: 10 }, { wch: 20 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, t('Jugadores'));
    XLSX.writeFile(wb, `Plantilla_Jugadores_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast(t('Plantilla de jugadores descargada'));
};

/**
 * Importa jugadores masivamente desde un archivo CSV o Excel (.xlsx).
 * Columnas esperadas: Nombre, Club, Categorías (separadas por coma),
 * Ranking, Fecha de Nacimiento (YYYY-MM-DD) y Licencia. Los duplicados por
 * nombre+club fusionan categorías y no se re-agregan.
 */
window.importPlayersFile = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const fname = (file.name || '').toLowerCase();
        const isCSV = fname.endsWith('.csv') || fname.endsWith('.txt');

        const onRows = (rows) => {
            try {
                const result = applyImportedPlayers(rows);
                if (result.rows === 0) {
                    showToast(t('El archivo no tiene filas de jugadores'), 'warning');
                    return;
                }
                saveTournamentData();
                showAllPlayers();
                showToast(
                    t('Importación completada:') + ' ' + result.added + ' ' + t('agregados') + ', ' +
                    result.updated + ' ' + t('actualizados') + ', ' + result.skipped + ' ' + t('omitidos')
                );
                addLog('IMPORTAR JUGADORES',
                    `${file.name} - ${result.added} ${t('agregados')}, ${result.updated} ${t('actualizados')}, ${result.skipped} ${t('omitidos')}`);
            } catch (err) {
                console.error('Error importando jugadores:', err);
                showToast(t('Error al importar jugadores:') + ' ' + err.message, 'error');
            }
        };

        if (isCSV) {
            const reader = new FileReader();
            reader.onload = (event) => onRows(parseCSVImport(String(event.target.result)));
            reader.readAsText(file);
        } else if (typeof XLSX !== 'undefined') {
            const reader = new FileReader();
            reader.onload = (event) => {
                const wb = XLSX.read(new Uint8Array(event.target.result), { type: 'array' });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                onRows(XLSX.utils.sheet_to_json(sheet, { header: 1 }));
            };
            reader.readAsArrayBuffer(file);
        } else {
            showToast(t('Librería Excel no disponible'), 'error');
        }
    };
    input.click();
};

/**
 * Convierte texto CSV a matriz de celdas, respetando comillas y saltos.
 * @param {string} text
 * @returns {Array<Array<string>>}
 */
function parseCSVImport(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    const chars = String(text).split('');
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        if (inQuotes) {
            if (c === '"') {
                if (chars[i + 1] === '"') { cell += '"'; i++; }
                else inQuotes = false;
            } else {
                cell += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ',' || c === ';') {
            row.push(cell.trim());
            cell = '';
        } else if (c === '\n' || c === '\r') {
            row.push(cell.trim());
            cell = '';
            if (row.some(x => x !== '')) rows.push(row);
            row = [];
            if (c === '\r' && chars[i + 1] === '\n') i++;
        } else {
            cell += c;
        }
    }
    row.push(cell.trim());
    if (row.some(x => x !== '')) rows.push(row);
    return rows;
}

/**
 * Aplica las filas importadas sobre tournamentData.players: agrega los
 * nuevos, fusiona categorías/campos en los duplicados y salta las filas sin
 * nombre o club. La primera fila se interpreta como encabezados si su primera
 * celda no parece un nombre de jugador.
 * @param {Array<Array<string>>} rows
 * @returns {{ added: number, updated: number, skipped: number, rows: number }}
 */
function applyImportedPlayers(rows) {
    const result = { added: 0, updated: 0, skipped: 0, rows: 0 };

    let start = 0;
    if (rows.length > 0) {
        const first = (rows[0] || []).map(c => String(c || '').trim().toLowerCase());
        const headerLike = first.some(c => c === 'nombre' || c === 'name') ||
                           first.some(c => c === 'club') ||
                           first.some(c => c.includes('categor')) ||
                           first.some(c => c.includes('fecha'));
        if (headerLike) start = 1;
    }

    for (let i = start; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.every(c => String(c || '').trim() === '')) continue;
        result.rows++;

        const name = formatPlayerName(String((r[0] || '').trim()));
        const club = formatPlayerClub(String((r[1] || '').trim()));
        if (!name || !club) {
            result.skipped++;
            continue;
        }

        const catsRaw = String((r[2] || '').trim());
        const cats = catsRaw ? catsRaw.split(',').map(c => c.trim()).filter(Boolean) : [];
        const rankingRaw = String((r[3] || '').trim());
        const ranking = rankingRaw && !isNaN(parseInt(rankingRaw, 10)) ? parseInt(rankingRaw, 10) : null;
        const fechaNac = String((r[4] || '').trim()) || undefined;
        const licencia = String((r[5] || '').trim()) || undefined;

        const exists = tournamentData.players.find(p =>
            p.name.toLowerCase() === name.toLowerCase() &&
            p.club.toLowerCase() === club.toLowerCase()
        );

        if (exists) {
            let changed = false;
            cats.forEach(cat => {
                if (!exists.categories.includes(cat)) {
                    exists.categories.push(cat);
                    changed = true;
                }
            });
            if (fechaNac && !exists.fechaNac) { exists.fechaNac = fechaNac; changed = true; }
            if (licencia && !exists.licencia) { exists.licencia = licencia; changed = true; }
            if (changed) result.updated++;
        } else {
            tournamentData.players.push({
                name,
                club,
                categories: cats,
                members: undefined,
                ranking: ranking,
                fechaNac: fechaNac,
                licencia: licencia,
                checkin: false,
                elo: window.DEFAULT_ELO || 1200,
                history: []
            });
            result.added++;
        }
    }

    return result;
}

// Generar listas por categoría
window.generateCategoryLists = function() {
    const output = document.getElementById('players-output');

    if (tournamentData.players.length === 0) {
        output.innerHTML = '<div class="alert alert-info">' + t('No hay jugadores registrados para generar listas.') + '</div>';
        return;
    }

    const categoriesMap = {};

    tournamentData.players.forEach(player => {
        if (player.categories) {
            player.categories.forEach(cat => {
                if (!categoriesMap[cat]) {
                    categoriesMap[cat] = [];
                }
                categoriesMap[cat].push(player);
            });
        }
    });

    let html = '<div class="button-grid" style="margin-bottom: 20px;"><button class="btn btn-success" onclick="exportCategoryListsPDF()">🖨️ ' + t('Imprimir / Exportar PDF') + '</button></div>';

    Object.keys(categoriesMap).sort().forEach(cat => {
        html += '<div class="form-section">';
        html += `<h3>📑 ${t('Categoría:')} ${cat}</h3>`;
        html += '<table class="data-table">';
        html += '<tr><th>#</th><th>' + t('Nombre') + '</th><th>' + t('Club') + '</th><th>' + t('Presente') + '</th></tr>';

        categoriesMap[cat].sort((a, b) => a.name.localeCompare(b.name)).forEach((player, idx) => {
            html += `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${escHtml(player.name)}</td>
                    <td>${escHtml(player.club)}</td>
                    <td></td>
                </tr>
            `;
        });

        html += '</table></div>';
    });

    output.innerHTML = html;
    showToast(t('Listas por categoría generadas'));
};

// Exportar listas de categoría a PDF/Impresión
window.exportCategoryListsPDF = function() {
    const outputElement = document.getElementById('players-output');

    if (!outputElement || !outputElement.innerHTML || outputElement.innerHTML.includes('No hay jugadores')) {
        showToast(t('Primero debes generar las listas por categoría'), 'error');
        return;
    }

    // Preferir la config guardada (settings): los inputs del DOM recién se
    // cargan al abrir la pestaña Configuración y pueden tener defaults crudos.
    const sett = tournamentData.settings || {};
    const torneoNombre = sett.torneoNombre
        || (document.getElementById('torneoNombre') ? document.getElementById('torneoNombre').value : '')
        || 'Torneo';
    const subtitulo = sett.subtitulo
        || (document.getElementById('subtitulo') ? document.getElementById('subtitulo').value : '')
        || '';

    const now = new Date();
    const fechaImpresion = now.toLocaleDateString(window.i18nLocale(), {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const horaImpresion = now.toLocaleTimeString(window.i18nLocale(), {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = outputElement.innerHTML;

    const categorySections = Array.from(tempDiv.querySelectorAll('.form-section')).filter(section => {
        return section.querySelector('table.data-table') !== null;
    });

    let cleanContent = '';
    categorySections.forEach(section => {
        cleanContent += section.outerHTML;
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${t('Listas por Categoría')} - ${torneoNombre}</title>
            <style>
                * {
                    -webkit-print-color-adjust: exact;
                    color-adjust: exact;
                }

                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    margin: 0;
                    padding: 0;
                    background: white;
                }

                .print-header {
                    text-align: center;
                    margin-bottom: 25px;
                    padding: 20px 15px 15px;
                    border-bottom: 3px solid #FFD700;
                    page-break-after: avoid;
                }
                .print-header h1 {
                    margin: 0 0 8px 0;
                    font-size: 26px;
                    color: #333;
                }
                .print-header .subtitulo {
                    margin: 0 0 12px 0;
                    font-size: 16px;
                    color: #666;
                }
                .print-header .titulo-listas {
                    background: linear-gradient(135deg, #007BFF, #0056b3);
                    color: white;
                    padding: 8px 15px;
                    border-radius: 6px;
                    display: inline-block;
                    font-size: 14px;
                    font-weight: bold;
                    margin: 10px 0;
                    text-transform: uppercase;
                }
                .print-header .fecha-impresion {
                    font-size: 11px;
                    color: #999;
                    font-style: italic;
                    margin-top: 8px;
                }

                .content-wrapper {
                    padding: 0 15mm;
                    margin-bottom: 20mm;
                }

                .form-section {
                    margin-bottom: 25px;
                    page-break-inside: avoid;
                    background: white;
                    padding: 0;
                }

                .form-section h3 {
                    background: linear-gradient(135deg, #007BFF, #0056b3);
                    color: white;
                    padding: 12px 15px;
                    border-radius: 6px;
                    margin: 0 0 15px 0;
                    font-size: 16px;
                    page-break-after: avoid;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                    page-break-inside: avoid;
                }
                th, td {
                    padding: 10px;
                    border: 1px solid #333;
                    text-align: left;
                }
                th {
                    background-color: #FFD700;
                    font-weight: bold;
                    color: #333;
                }
                td:first-child {
                    text-align: center;
                    font-weight: bold;
                }
                tr:nth-child(even) {
                    background-color: #f9f9f9;
                }

                .dashboard-grid,
                button {
                    display: none !important;
                }

                @media print {
                    @page {
                        size: A4;
                        margin: 15mm 15mm 20mm 15mm;
                    }

                    body {
                        margin: 0;
                        padding: 0;
                    }

                    .print-header {
                        page-break-inside: avoid;
                    }

                    .content-wrapper {
                        padding: 0;
                    }

                    .form-section {
                        page-break-inside: avoid;
                    }
                }

                @media screen {
                    body {
                        padding: 20px;
                        background: #f5f5f5;
                    }
                    .content-wrapper {
                        background: white;
                        padding: 20px;
                        box-shadow: 0 0 10px rgba(0,0,0,0.1);
                    }
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <h1>🏓 ${torneoNombre}</h1>
                <div class="subtitulo">${subtitulo}</div>
                <div class="titulo-listas">${t('LISTA DE INSCRIPCIÓN — MESA DE ENTRADA')}</div>
                <div class="fecha-impresion">
                    🖨️ ${t('Impreso el')} ${fechaImpresion} ${t('a las')} ${horaImpresion}
                </div>
                <div style="font-size: 11px; color: #999; margin-top: 6px;">☑ ${t('Marcá con una X cuando el jugador se acredite en la mesa de entrada.')}</div>
            </div>

            <div class="content-wrapper">
                ${cleanContent}
            </div>

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

    addLog('EXPORTAR LISTAS', t('Listas por categoría enviadas a impresora'));
    showToast(t('Listas enviadas a impresora / PDF'));
};

// SISTEMA DE DETECCIÓN DE DUPLICADOS

function normalizeText(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, ' ')
        .trim();
}

// ==========================================
// NORMALIZACIÓN DE DATOS DE JUGADORES
// ==========================================

/**
 * Formatea un nombre: capitaliza cada palabra y elimina tildes.
 * "marcos osorio" => "Marcos Osorio" | "MaRIELA GONZÁLEZ" => "Mariela Gonzales"
 */
window.formatPlayerName = function(name) {
    return String(name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

/**
 * Formatea un club: mayúsculas completas y sin tildes.
 * "cedeMU" => "CEDEMU" | "san martín" => "SAN MARTIN"
 */
window.formatPlayerClub = function(club) {
    return String(club || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
};

function getNameTokens(name) {
    return normalizeText(name).split(' ').filter(token => token.length > 0);
}

function calculateNameSimilarity(name1, name2) {
    const tokens1 = getNameTokens(name1);
    const tokens2 = getNameTokens(name2);

    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    let commonTokens = 0;
    tokens1.forEach(token1 => {
        if (tokens2.some(token2 => token2 === token1 ||
                                    token2.includes(token1) ||
                                    token1.includes(token2))) {
            commonTokens++;
        }
    });

    const maxTokens = Math.max(tokens1.length, tokens2.length);
    const similarity = (commonTokens / maxTokens) * 100;

    return Math.round(similarity);
}

function isPotentialDuplicate(player1, player2) {
    const nameSimilarity = calculateNameSimilarity(player1.name, player2.name);
    const clubSimilarity = calculateNameSimilarity(player1.club, player2.club);

    if (nameSimilarity === 100 && clubSimilarity === 100) {
        return { isDuplicate: true, confidence: 100, reason: 'Nombre y club idénticos' };
    }

    if (nameSimilarity >= 80) {
        if (clubSimilarity >= 70) {
            return { isDuplicate: true, confidence: nameSimilarity, reason: 'Nombre muy similar y mismo club' };
        } else if (clubSimilarity >= 50) {
            return { isDuplicate: true, confidence: Math.round((nameSimilarity + clubSimilarity) / 2), reason: 'Nombre muy similar y club parecido' };
        }
    }

    if (nameSimilarity >= 90) {
        return { isDuplicate: true, confidence: nameSimilarity, reason: 'Nombres casi idénticos' };
    }

    return { isDuplicate: false, confidence: nameSimilarity, reason: '' };
}

function checkBeforeAddingPlayer(name, club) {
    const validPlayers = tournamentData.players.filter(p =>
        p.name !== '-' && p.club !== '-'
    );

    const newPlayer = { name, club };
    const potentialDuplicates = [];

    validPlayers.forEach((existing, idx) => {
        const result = isPotentialDuplicate(newPlayer, existing);
        if (result.isDuplicate && result.confidence >= 70) {
            potentialDuplicates.push({
                player: existing,
                index: tournamentData.players.indexOf(existing),
                confidence: result.confidence
            });
        }
    });

    return potentialDuplicates;
}

window.checkDuplicatePlayers = function() {
    const validPlayers = tournamentData.players.filter(p =>
        p.name !== '-' && p.club !== '-' && p.name !== '- -' && p.club !== '- -'
    );

    if (validPlayers.length < 2) {
        showToast(t('Se necesitan al menos 2 jugadores para detectar duplicados'), 'info');
        return;
    }

    const duplicates = [];

    for (let i = 0; i < validPlayers.length; i++) {
        for (let j = i + 1; j < validPlayers.length; j++) {
            const result = isPotentialDuplicate(validPlayers[i], validPlayers[j]);

            if (result.isDuplicate) {
                duplicates.push({
                    player1: validPlayers[i],
                    player2: validPlayers[j],
                    index1: tournamentData.players.indexOf(validPlayers[i]),
                    index2: tournamentData.players.indexOf(validPlayers[j]),
                    confidence: result.confidence,
                    reason: result.reason
                });
            }
        }
    }

    displayDuplicatesReport(duplicates);
};

function displayDuplicatesReport(duplicates) {
    const output = document.getElementById('players-output');

    if (duplicates.length === 0) {
        output.innerHTML = `
            <div class="alert alert-success">
                ✅ <strong>${t('¡Excelente!')}</strong> ${t('No se detectaron jugadores duplicados o similares.')}
            </div>
        `;
        showToast(t('No se encontraron duplicados'), 'success');
        return;
    }

    duplicates.sort((a, b) => b.confidence - a.confidence);

    let html = '<div class="form-section">';
    html += `<h3 style="color: var(--danger);">⚠️ ${t('Posibles Jugadores Duplicados')} (${duplicates.length} ${t('coincidencia(s)')})</h3>`;
    html += '<p style="margin-bottom: 20px; color: var(--text-color);">' + t('Se detectaron los siguientes jugadores que podrían ser la misma persona. Revisa y resuelve los conflictos:') + '</p>';

    duplicates.forEach((dup, idx) => {
        const confidenceColor = dup.confidence >= 90 ? 'var(--danger)' : dup.confidence >= 70 ? 'var(--warning)' : 'var(--info)';

        html += `
            <div style="background: var(--header-bg); border-left: 4px solid ${confidenceColor}; padding: 15px; margin-bottom: 15px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h4 style="margin: 0; color: var(--text-color);">${t('Coincidencia')} #${idx + 1}</h4>
                    <span style="background: ${confidenceColor}; color: white; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 12px;">
                        ${dup.confidence}% ${t('similar')}
                    </span>
                </div>

                <div style="color: var(--text-muted); font-size: 12px; margin-bottom: 15px; font-style: italic;">
                    ${escHtml(dup.reason)}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    <div style="background: var(--info-bg); padding: 12px; border-radius: 6px; border: 2px solid var(--info);">
                        <div style="font-weight: bold; color: var(--info); margin-bottom: 5px;">${t('JUGADOR 1')}</div>
                        <div style="font-size: 15px; font-weight: 600; color: var(--text-color); margin-bottom: 3px;">${escHtml(dup.player1.name)}</div>
                        <div style="font-size: 13px; color: var(--text-muted);">🏢 ${escHtml(dup.player1.club)}</div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 5px;">📋 ${dup.player1.categories.map(escHtml).join(', ')}</div>
                    </div>

                    <div style="background: var(--danger-bg); padding: 12px; border-radius: 6px; border: 2px solid var(--danger);">
                        <div style="font-weight: bold; color: var(--danger); margin-bottom: 5px;">${t('JUGADOR 2')}</div>
                        <div style="font-size: 15px; font-weight: 600; color: var(--text-color); margin-bottom: 3px;">${escHtml(dup.player2.name)}</div>
                        <div style="font-size: 13px; color: var(--text-muted);">🏢 ${escHtml(dup.player2.club)}</div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 5px;">📋 ${dup.player2.categories.map(escHtml).join(', ')}</div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                    <button class="btn btn-success" style="padding: 8px 12px; font-size: 13px;" onclick="mergePlayers(${dup.index1}, ${dup.index2})">
                        🔗 ${t('Fusionar (mantener J1)')}
                    </button>
                    <button class="btn btn-danger" style="padding: 8px 12px; font-size: 13px;" onclick="deletePlayer(${dup.index2}); checkDuplicatePlayers();">
                        🗑️ ${t('Eliminar J2')}
                    </button>
                    <button class="btn btn-dark" style="padding: 8px 12px; font-size: 13px;" onclick="ignoreDuplicate()">
                        ✓ ${t('No son duplicados')}
                    </button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    output.innerHTML = html;

    showToast(`${t('Se encontraron')} ${duplicates.length} ${t('posible(s) duplicado(s)')}`, 'warning');
    addLog('DUPLICADOS', t('Detectados') + ` ${duplicates.length} ${t('posibles duplicados')}`);
}

window.mergePlayers = function(index1, index2) {
    const player1 = tournamentData.players[index1];
    const player2 = tournamentData.players[index2];

    showModal(
        t('🔗 Fusionar Jugadores'),
        `<p style="color: var(--text-color);">${t('¿Estás seguro de que deseas fusionar estos jugadores?')}</p>
        <div style="background: var(--surface-alt); padding: 15px; border-radius: 6px; margin: 10px 0;">
            <strong>${t('SE MANTENDRÁ:')}</strong><br>
            ${escHtml(player1.name)} - ${escHtml(player1.club)}<br>
            <strong>${t('SE ELIMINARÁ:')}</strong><br>
            ${escHtml(player2.name)} - ${escHtml(player2.club)}
        </div>
        <p style="color: var(--text-color);">${t('Las categorías, el rating y el check-in se combinarán, y todas las referencias a')} ${escHtml(player2.name)} ${t('en fixtures, llaves y lista de espera pasarán a')} ${escHtml(player1.name)}.</p>`,
        () => {
            // Combinar categorías
            const combinedCategories = [...new Set([...player1.categories, ...player2.categories])];
            tournamentData.players[index1].categories = combinedCategories;

            // Conservar los datos más ricos de player2 (rating real, check-in, etc.)
            const p1 = tournamentData.players[index1];
            const defaultElo = window.DEFAULT_ELO || 1200;
            if (typeof player2.elo === 'number' && player2.elo !== defaultElo && (typeof p1.elo !== 'number' || p1.elo === defaultElo)) {
                p1.elo = player2.elo;
            }
            if (player2.checkin) p1.checkin = true;

            // Reasignar todas las referencias a player2 → player1
            const fromName = player2.name, fromClub = player2.club;
            const toName = player1.name, toClub = player1.club;

            const rewritePlayer = (p) => {
                if (!p) return;
                if (p.name === fromName && p.club === fromClub) {
                    p.name = toName;
                    p.club = toClub;
                }
            };

            (tournamentData.fixtures || []).forEach(fixture => {
                (fixture.players || []).forEach(rewritePlayer);
                (fixture.matches || []).forEach(m => { rewritePlayer(m.player1); rewritePlayer(m.player2); });
                if (fixture.eloBaseline) {
                    const newBaseline = {};
                    Object.keys(fixture.eloBaseline).forEach(key => {
                        const parts = key.split('|');
                        if (parts.length === 2 && parts[0] === fromName && parts[1] === fromClub) {
                            newBaseline[toName + '|' + toClub] = fixture.eloBaseline[key];
                        } else {
                            newBaseline[key] = fixture.eloBaseline[key];
                        }
                    });
                    fixture.eloBaseline = newBaseline;
                }
            });

            (tournamentData.brackets || []).forEach(bracket => {
                (bracket.clasificados || []).forEach(rewritePlayer);
                (bracket.rounds || []).forEach(round => {
                    (round.matches || []).forEach(m => { rewritePlayer(m.p1); rewritePlayer(m.p2); });
                });
            });

            (tournamentData.waitlist || []).forEach(rewritePlayer);

            tournamentData.players.splice(index2, 1);

            saveTournamentData();
            showToast(t('Jugadores fusionados correctamente'));
            addLog('FUSIONAR JUGADORES', `${player1.name} + ${player2.name} → ${player1.name}`);

            checkDuplicatePlayers();
        }
    );
};

window.ignoreDuplicate = function() {
    showToast(t('Marcado como no duplicado'), 'info');
};

// addNewCategory, addNewGroup y loadCustomCategories viven en fixtures.js
