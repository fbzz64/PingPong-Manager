// ==========================================
// STORAGE.JS - Gestión de localStorage, datos y deshacer/rehacer
// ==========================================

// ---- Historial de Deshacer / Rehacer ----
const MAX_UNDO_STEPS = 50;
let undoStack = [];
let redoStack = [];
let lastSavedState = null;
let isRestoringHistory = false;
let historyOpBefore = null;

// Inicia una operación atómica de historial: los sucesivos saveTournamentData
// (y addLog) dentro de la misma acción se compactan en UN solo checkpoint.
// Ej: guardar un fixture hace varios saves (fixture, jugadores, ELO, log) y
// sin esto el primer Ctrl+Z solo revertía el log (deshacer desincronizado).
window.beginHistoryOp = function() {
    if (historyOpBefore === null) historyOpBefore = JSON.stringify(tournamentData);
};

// Cierra la operación atómica empujando el estado INICIAL como un único
// checkpoint (si hubo cambios). Siempre limpia la bandera.
window.commitHistoryOp = function() {
    if (historyOpBefore !== null) {
        const current = JSON.stringify(tournamentData);
        if (current !== historyOpBefore) {
            if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== historyOpBefore) {
                undoStack.push(historyOpBefore);
                if (undoStack.length > MAX_UNDO_STEPS) undoStack.shift();
            }
            redoStack = [];
            updateUndoRedoButtons();
        }
        lastSavedState = current;
        historyOpBefore = null;
    }
};

// Actualiza el estado de los botones de deshacer/rehacer
function updateUndoRedoButtons() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.disabled = undoStack.length === 0;
    if (btnRedo) btnRedo.disabled = redoStack.length === 0;
}

// Recarga los inputs de configuración desde los datos guardados
window.reloadSettingsInputs = function() {
    const mapping = [
        ['torneoNombre', 'torneoNombre'],
        ['subtitulo', 'subtitulo'],
        ['torneoLugar', 'lugar'],
        ['torneoOrganizadores', 'organizadores'],
        ['torneoFechaInicio', 'fechaInicio'],
        ['torneoFechaFin', 'fechaFin'],
        ['torneoMesas', 'mesas'],
        ['torneoFormato', 'formato'],
        ['torneoFormatoGrupos', 'formatoPartidoGrupos'],
        ['torneoFormatoLlaves', 'formatoPartidoLlaves'],
        ['torneoDuracion', 'duracionPartido']
    ];
    mapping.forEach(([inputId, key]) => {
        const el = document.getElementById(inputId);
        if (el && tournamentData.settings) {
            el.value = tournamentData.settings[key] || '';
        }
    });
    if (typeof window.syncSoundsEnabled === 'function') window.syncSoundsEnabled();
};

// Refresca la vista de la pestaña activa tras deshacer/rehacer
function refreshActiveView() {
    const activeTabBtn = document.querySelector('.tab.active');
    const tabName = activeTabBtn ? activeTabBtn.getAttribute('data-tab') : 'dashboard';

    if (tabName === 'dashboard' && typeof updateDashboard === 'function') updateDashboard();
    else if (tabName === 'players' && typeof showAllPlayers === 'function') showAllPlayers();
    else if (tabName === 'stats' && typeof calculateStats === 'function') calculateStats();
    else if (tabName === 'logs' && typeof showLogs === 'function') showLogs();
    else if (tabName === 'fixture' && typeof updateFixtureNavigator === 'function') updateFixtureNavigator();
    else if (tabName === 'brackets' && typeof renderBracketsForTab === 'function') renderBracketsForTab();
    else if (tabName === 'settings') reloadSettingsInputs();
}

window.getUndoRedoState = function() {
    return { canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 };
};

// Limpia el historial (tras importar/cargar datos)
window.resetUndoHistory = function() {
    undoStack = [];
    redoStack = [];
    lastSavedState = JSON.stringify(tournamentData);
    isRestoringHistory = false;
    updateUndoRedoButtons();
};

// Restaura un estado sin registrarlo en el historial
function restoreState(stateJSON) {
    isRestoringHistory = true;
    tournamentData = JSON.parse(stateJSON);
    lastSavedState = stateJSON;
    saveTournamentData();
    isRestoringHistory = false;
    updateUndoRedoButtons();
}

// Agrega una entrada al log sin afectar el historial
function appendLogWithoutHistory(action, description) {
    isRestoringHistory = true;
    tournamentData.logs.push({
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleString(window.i18nLocale()),
        action,
        description
    });
    lastSavedState = JSON.stringify(tournamentData);
    saveTournamentData();
    isRestoringHistory = false;
}

// Deshacer la última acción
window.undoAction = function() {
    if (undoStack.length === 0) {
        showToast(t('No hay acciones para deshacer'), 'info');
        return;
    }
    const current = JSON.stringify(tournamentData);
    redoStack.push(current);
    const previous = undoStack.pop();
    restoreState(previous);
    refreshActiveView();
    appendLogWithoutHistory('DESHACER', t('Última acción revertida'));
    showToast(t('↩️ Acción deshecha'));
};

// Rehacer la última acción deshecha
window.redoAction = function() {
    if (redoStack.length === 0) {
        showToast(t('No hay acciones para rehacer'), 'info');
        return;
    }
    const current = JSON.stringify(tournamentData);
    undoStack.push(current);
    const next = redoStack.pop();
    restoreState(next);
    refreshActiveView();
    appendLogWithoutHistory('REHACER', t('Acción restablecida'));
    showToast(t('↪️ Acción rehecha'));
};

// Guardar datos del torneo en localStorage con manejo de errores
window.saveTournamentData = function() {
    try {
        // Registrar el historial de deshacer/rehacer
        if (!isRestoringHistory) {
            const current = JSON.stringify(tournamentData);
            if (historyOpBefore === null) {
                if (lastSavedState !== null && current !== lastSavedState) {
                    undoStack.push(lastSavedState);
                    if (undoStack.length > MAX_UNDO_STEPS) {
                        undoStack.shift();
                    }
                    redoStack = [];
                    updateUndoRedoButtons();
                }
                lastSavedState = current;
            } else {
                // Dentro de una operación atómica: sin checkpoints intermedios;
                // commitHistoryOp empuja el estado inicial una sola vez.
                lastSavedState = current;
            }
        }
        localStorage.setItem('tournamentData', JSON.stringify(tournamentData));
        localStorage.setItem('ttmLastSavedAt', new Date().toISOString());
        // Sync multi-dispositivo: subir a Firebase si el host está activo
        if (typeof window.syncPush === 'function') window.syncPush();
    } catch (error) {
        console.error('Error al guardar datos:', error);
        showToast(t('Error al guardar datos. Espacio de almacenamiento lleno.'), 'error');
    }
};

// ==========================================
// CHECKPOINT DE RECUPERACIÓN DE SESIÓN
// ==========================================

const SESSION_RECOVERY_KEY = 'ttmSessionRecovery';
let lastSessionRecoveryAt = 0;

// ---- Backups automáticos periódicos (rotativos) ----
const AUTO_BACKUP_KEY = 'ttmAutoBackups';
const AUTO_BACKUP_MAX = 6;
const AUTO_BACKUP_INTERVAL_MS = 5 * 60 * 1000; // cada 5 minutos
let lastAutoBackupAt = 0;

/**
 * Guarda un checkpoint completo de la sesión bajo una clave propia.
 * Se escribe con throttle (máximo cada 60 s) salvo con force=true, así el
 * autoguardado de 10 s no satura localStorage: un corte de luz o cierre
 * brusco solo pierde los últimos segundos como mucho.
 * @param {boolean} force - Fuerza la escritura (al cerrar/ocultar la app).
 */
window.saveSessionRecovery = function(force) {
    const now = Date.now();
    if (!force && now - lastSessionRecoveryAt < 60000) return;
    lastSessionRecoveryAt = now;
    try {
        localStorage.setItem(SESSION_RECOVERY_KEY, JSON.stringify({
            savedAt: new Date().toISOString(),
            data: tournamentData
        }));
    } catch (e) {
        console.error('Error al guardar checkpoint de recuperación:', e);
    }
};

/**
 * Backup automático periódico y rotativo: guarda un snapshot completo del
 * torneo bajo una clave propia, manteniendo hasta AUTO_BACKUP_MAX versiones.
 * Con throttle (máximo cada 5 min) para no saturar localStorage; al recargar
 * la app se pueden listar y restaurar desde la Configuración.
 * @param {boolean} force - Fuerza la escritura (p. ej. antes de finalizar).
 */
window.saveAutoBackup = function(force) {
    const now = Date.now();
    if (!force && now - lastAutoBackupAt < AUTO_BACKUP_INTERVAL_MS) return;
    lastAutoBackupAt = now;
    try {
        let list = [];
        const raw = localStorage.getItem(AUTO_BACKUP_KEY);
        if (raw) {
            try { list = JSON.parse(raw); } catch (e) { list = []; }
            if (!Array.isArray(list)) list = [];
        }
        list.push({
            savedAt: new Date().toISOString(),
            data: tournamentData
        });
        // Rotación: conservar solo las últimas N versiones
        if (list.length > AUTO_BACKUP_MAX) list = list.slice(list.length - AUTO_BACKUP_MAX);
        localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(list));
    } catch (e) {
        console.error('Error al guardar backup automático:', e);
    }
};

/**
 * Lista los backups automáticos disponibles (metadatos).
 * @returns {Array<{savedAt: string}>}
 */
window.listAutoBackups = function() {
    try {
        const raw = localStorage.getItem(AUTO_BACKUP_KEY);
        if (!raw) return [];
        const list = JSON.parse(raw);
        return Array.isArray(list) ? list.map(b => ({ savedAt: b.savedAt || '' })) : [];
    } catch (e) {
        return [];
    }
};

/**
 * Muestra el modal con los backups automáticos disponibles para restaurar.
 */
window.showAutoBackups = function() {
    const backups = window.listAutoBackups();
    if (backups.length === 0) {
        showToast(t('Aún no hay backups automáticos. Se crea el primero a los 5 minutos de usar la app.'), 'info');
        return;
    }

    const items = backups.slice().reverse().map((b, i) => {
        const realIndex = backups.length - 1 - i;
        const fecha = new Date(b.savedAt).toLocaleString(window.i18nLocale(), {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });
        return `<div style="display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 8px; background: var(--surface-alt);">
            <span style="font-size: 20px;">🗂️</span>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: bold; font-size: 14px; color: var(--text-color);">${escHtml(fecha)}</div>
            </div>
            <button class="btn btn-success" style="padding: 5px 12px; font-size: 12px;" onclick="restoreAutoBackup(${realIndex})">${t('Restaurar')}</button>
        </div>`;
    }).join('');

    showModal(
        t('🗂️ Backups Automáticos'),
        `<div style="color: var(--text-color);">
            <p style="font-size: 13px; color: var(--text-muted); margin: 0 0 10px 0;">${t('Elegí un backup para restaurar. El estado actual se reemplazará por el del backup seleccionado.')}</p>
            ${items}
        </div>`,
        null,
        t('Cerrar')
    );
};

/**
 * Restaura un backup automático guardado previamente.
 * @param {number} index - Índice en la lista de backups.
 * @returns {boolean} true si se restauró correctamente.
 */
window.restoreAutoBackup = function(index) {
    try {
        const raw = localStorage.getItem(AUTO_BACKUP_KEY);
        if (!raw) return false;
        const list = JSON.parse(raw);
        if (!Array.isArray(list) || !list[index] || !list[index].data) return false;
        tournamentData = normalizeTournamentData(list[index].data);
        saveTournamentData();
        resetUndoHistory();
        showToast(t('✅ Backup restaurado correctamente'));
        if (typeof window.updateDashboard === 'function') window.updateDashboard();
        if (typeof window.showAllPlayers === 'function') window.showAllPlayers();
        if (typeof window.renderCategoriesManager === 'function') window.renderCategoriesManager();
        if (typeof window.closeModal === 'function') closeModal();
        return true;
    } catch (e) {
        console.error('Error al restaurar backup automático:', e);
        showToast(t('Error al restaurar el backup'), 'error');
        return false;
    }
};

/**
 * Escapa un texto para usarlo dentro de un atributo onclick construido
 * con cadenas en JS (previene inyección de HTML y ruptura de comillas).
 */
window.escAttr = function(str) {
    return String(str == null ? '' : str)
        .replace(/\\/g, '\\\\')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, "\\'");
};

/**
 * Escapa un texto para insertarlo de forma segura como contenido HTML
 * (previene XSS por nombres de jugadores, categorías, patrocinadores, etc.).
 */
window.escHtml = function(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

/**
 * Normaliza una estructura de datos de torneo: garantiza la estructura
 * completa, detecta backups envueltos {timestamp, version, data} y
 * normaliza nombres/clubs y campos de perfil. Compatible con la carga
 * desde localStorage y con la importación de archivos JSON.
 */
window.normalizeTournamentData = function(data) {
    if (!data || typeof data !== 'object') {
        data = { fixtures: [], players: [], brackets: [], settings: {}, logs: [] };
    }

    // Detectar formato de backup envuelto (Backup_Completo_*.json)
    if (data.data && typeof data.data === 'object' &&
        data.fixtures === undefined && data.players === undefined) {
        data = data.data;
    }

    // Garantizar estructura completa
    if (!data.fixtures) data.fixtures = [];
    if (!data.players) data.players = [];
    if (!data.brackets) data.brackets = [];
    if (!data.logs) data.logs = [];
    if (!data.waitlist) data.waitlist = [];
    if (!data.settings) data.settings = {};

    // Asegurar campos del settings
    data.settings.torneoNombre = data.settings.torneoNombre || '4° Torneo TENIS DE MESA 🏓';
    data.settings.subtitulo = data.settings.subtitulo || 'Circuito Misionero 2025';
    data.settings.patrocinadores = data.settings.patrocinadores || [];
    data.settings.lugar = data.settings.lugar || '';
    data.settings.fechaInicio = data.settings.fechaInicio || '';
    data.settings.fechaFin = data.settings.fechaFin || '';
    data.settings.organizadores = data.settings.organizadores || '';
    data.settings.mesas = data.settings.mesas || 4;
    data.settings.formato = data.settings.formato || 'Todos contra todos + llaves eliminatorias';
    data.settings.duracionPartido = data.settings.duracionPartido || 15;
    // Formato de partido por fase (reglamento ITTF): bo3 | bo5 | bo7
    const normFormat = f => (f === 'bo3' || f === 'bo7') ? f : 'bo5';
    data.settings.formatoPartidoGrupos = normFormat(data.settings.formatoPartidoGrupos);
    data.settings.formatoPartidoLlaves = normFormat(data.settings.formatoPartidoLlaves);

    // Normalizar formato de jugadores y lista de espera al cargar:
    // nombres capitalizados y sin tildes, clubs en mayúsculas.
    if (typeof formatPlayerName === 'function' && typeof formatPlayerClub === 'function') {
        (data.players || []).forEach(p => {
            if (p.name) p.name = formatPlayerName(p.name);
            if (p.club) p.club = formatPlayerClub(p.club);
        });
        (data.waitlist || []).forEach(w => {
            if (w.name) w.name = formatPlayerName(w.name);
            if (w.club) w.club = formatPlayerClub(w.club);
        });
    }

    // Garantizar campos de perfil/ELO/check-in en jugadores existentes
    (data.players || []).forEach(p => {
        p.checkin = p.checkin === undefined ? false : !!p.checkin;
        p.elo = typeof p.elo === 'number' ? p.elo : (window.DEFAULT_ELO || 1200);
        p.history = p.history || [];
    });

    return data;
};

// Cargar datos del torneo desde localStorage con manejo de errores
window.loadTournamentData = function() {
    let restoredFromRecovery = false;
    try {
        const data = localStorage.getItem('tournamentData');
        if (data) {
            tournamentData = normalizeTournamentData(JSON.parse(data));
        } else {
            tournamentData = { fixtures: [], players: [], brackets: [], settings: {}, logs: [], waitlist: [] };
        }
    } catch (error) {
        console.error('Error al cargar datos:', error);
        // Si el guardado principal está corrupto, intentar recuperar la última
        // sesión desde el checkpoint automático antes de empezar vacío.
        try {
            const rec = localStorage.getItem(SESSION_RECOVERY_KEY);
            if (rec) {
                const parsed = JSON.parse(rec);
                if (parsed && parsed.data) {
                    tournamentData = normalizeTournamentData(parsed.data);
                    restoredFromRecovery = true;
                    addLog('SESIÓN', t('Datos recuperados del último guardado automático'));
                    showToast(t('🔄 Sesión recuperada del último guardado automático'));
                }
            }
        } catch (e) {
            console.error('Error al recuperar la última sesión:', e);
        }
        if (!restoredFromRecovery) {
            showToast(t('Error al cargar datos guardados'), 'error');
            tournamentData = { fixtures: [], players: [], brackets: [], settings: {}, logs: [], waitlist: [] };
        }
    }

    // Resetear historial al cargar
    resetUndoHistory();
};

// Exportar todos los datos a JSON
window.exportAllData = function() {
    try {
        const dataStr = JSON.stringify(tournamentData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Torneo_Backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addLog('BACKUP', t('Datos exportados:') + ` ${tournamentData.fixtures.length} fixtures, ${tournamentData.players.length} ` + t('jugadores'));
        showToast(t('Datos exportados correctamente'));
    } catch (error) {
        console.error('Error al exportar datos:', error);
        showToast(t('Error al exportar datos'), 'error');
    }
};

// Importar datos desde JSON
window.importAllData = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const parsed = JSON.parse(event.target.result);
                tournamentData = normalizeTournamentData(parsed);
                resetUndoHistory();
                saveTournamentData();
                updateDashboard();
                if (typeof updateFixtureNavigator === 'function') updateFixtureNavigator();
                if (typeof reloadSettingsInputs === 'function') reloadSettingsInputs();
                if (typeof loadCustomCategories === 'function') loadCustomCategories();
                addLog('BACKUP', t('Datos importados:') + ` ${tournamentData.fixtures.length} fixtures, ${tournamentData.players.length} ` + t('jugadores'));
                showToast(t('Datos importados correctamente'));
            } catch (err) {
                showToast(t('Error al importar archivo:') + ' ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

// Crear backup completo
window.createBackup = function() {
    try {
        const backup = {
            timestamp: new Date().toISOString(),
            version: '2.4',
            data: tournamentData
        };

        const dataStr = JSON.stringify(backup, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Backup_Completo_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addLog('BACKUP', t('Backup completo creado:') + ` ${tournamentData.fixtures.length} fixtures, ${tournamentData.players.length} ` + t('jugadores'));
        showToast(t('Backup creado correctamente'));
    } catch (error) {
        console.error('Error al crear backup:', error);
        showToast(t('Error al crear backup'), 'error');
    }
};

// Limpiar todos los datos
window.clearAllData = function() {
    showModal(
        t('⚠️ ¿Limpiar Todos los Datos?'),
        '<p style="color: var(--text-color);">' + t('Esta acción eliminará todos los fixtures, jugadores y configuraciones del torneo.') + '</p><p style="color: var(--danger); font-weight: bold;">' + t('Esta acción es grave pero reversible.') + '</p><p style="color: var(--success); font-size: 13px;">💡 ' + t('Consejo: puedes deshacerla con Ctrl+Z o el botón Deshacer.') + '</p>',
        () => {
            try {
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
                        duracionPartido: 15
                    },
                    logs: [],
                    waitlist: []
                };
                saveTournamentData();
                updateDashboard();
                document.getElementById('fixture-output').innerHTML = '';
                addLog('LIMPIAR', t('Todos los datos del torneo fueron eliminados'));
                showToast(t('Todos los datos han sido eliminados'));
            } catch (error) {
                console.error('Error al limpiar datos:', error);
                showToast(t('Error al limpiar datos'), 'error');
            }
        }
    );
};

// createRestorePoint y executeCreateRestorePoint viven en tournaments.js

// ==========================================
// ARCHIVO DE TORNEOS (varios torneos guardados en localStorage)
// ==========================================

const TOURNAMENT_ARCHIVES_KEY = 'tournamentArchives';

/**
 * Lista los torneos archivados (metadatos + snapshot de datos).
 * @returns {Array} [{ id, name, savedAt, snapshot }]
 */
function getTournamentArchives() {
    try {
        const raw = localStorage.getItem(TOURNAMENT_ARCHIVES_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
    } catch (e) {
        return [];
    }
}

function saveTournamentArchives(list) {
    try {
        localStorage.setItem(TOURNAMENT_ARCHIVES_KEY, JSON.stringify(list));
    } catch (error) {
        console.error('Error al guardar archivo de torneos:', error);
        showToast(t('Error al guardar archivo. Espacio de almacenamiento lleno.'), 'error');
    }
}

/**
 * Resumen de un torneo archivado para mostrar en la lista.
 */
function archiveSummary(arch) {
    const s = arch.snapshot || {};
    const players = (s.players || []).filter(p => p.name && p.name !== '-' && p.club !== '-');
    const fixtures = s.fixtures || [];
    const nombre = (s.settings && s.settings.torneoNombre) || 'Torneo';
    return {
        nombre,
        jugadores: players.length,
        fixtures: fixtures.length,
        fecha: arch.savedAt ? new Date(arch.savedAt).toLocaleString(window.i18nLocale()) : ''
    };
}

/**
 * Guarda una copia (snapshot) del torneo actual en el archivo.
 * @param {string} name - Nombre identificador (torneo + fecha sugeridos)
 */
window.saveTournamentArchive = function(name) {
    const label = String(name || '').trim();
    if (!label) {
        showToast(t('Ingresa un nombre para el torneo archivado'), 'error');
        return;
    }
    const list = getTournamentArchives();
    const existing = list.findIndex(a => String(a.name || '').toLowerCase() === label.toLowerCase());
    const snapshot = JSON.parse(JSON.stringify(tournamentData));
    if (existing >= 0) {
        list[existing] = { id: list[existing].id, name: label, savedAt: new Date().toISOString(), snapshot };
        showToast(t('Torneo') + ` "${label}" ` + t('actualizado en el archivo'));
    } else {
        list.unshift({ id: Date.now(), name: label, savedAt: new Date().toISOString(), snapshot });
        showToast(t('Torneo') + ` "${label}" ` + t('guardado en el archivo'));
    }
    saveTournamentArchives(list);
    addLog('ARCHIVO', t('Torneo guardado en archivo:') + ` ${label} (${list.length} ` + t('archivados') + ')');
    renderTournamentArchives();
};

/**
 * Renderiza la sección "Archivo de Torneos" de Configuración.
 */
window.renderTournamentArchives = function() {
    const container = document.getElementById('archives-list');
    if (!container) return;
    const list = getTournamentArchives();

    if (list.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">' + t('No hay torneos archivados aún. Guardá una copia del torneo actual para conservarlo y poder volver a abrirlo después.') + '</p>';
        return;
    }

    container.innerHTML = list.map(a => {
        const s = archiveSummary(a);
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; background: var(--header-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 12px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 200px;">
                    <strong style="color: var(--text-color);">🏆 ${escHtml(s.nombre)}</strong>
                    <div style="font-size: 11px; color: var(--text-muted);">${s.jugadores} ${t('jugadores')} · ${s.fixtures} ${t('fixtures')} · ${t('guardado el')} ${escHtml(s.fecha)}</div>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="openTournamentArchive(${a.id})">📂 ${t('Abrir')}</button>
                    <button class="btn btn-info" style="padding: 6px 12px; font-size: 12px;" onclick="exportTournamentArchive(${a.id})">📤 ${t('Exportar')}</button>
                    <button class="btn btn-danger" style="padding: 6px 12px; font-size: 12px;" onclick="deleteTournamentArchive(${a.id})">🗑️</button>
                </div>
            </div>`;
    }).join('');
};

/**
 * Abre un torneo archivado reemplazando los datos actuales (con confirmación).
 * @param {number|string} id
 */
window.openTournamentArchive = function(id) {
    const arch = getTournamentArchives().find(a => String(a.id) === String(id));
    if (!arch) {
        showToast(t('Torneo archivado no encontrado'), 'error');
        return;
    }
    const s = archiveSummary(arch);
    showModal(
        t('📂 Abrir torneo archivado'),
        '<div style="color: var(--text-color);">' +
            `<p><strong>${t('¿Abrir')} "${escHtml(s.nombre)}"?</strong></p>` +
            `<p style="font-size: 13px; color: var(--text-muted);">${t('Se reemplazarán los datos actuales')} (${s.jugadores} ${t('jugadores')}, ${s.fixtures} ${t('fixtures')}) ${t('por los de este torneo. Se conserva el archivo tal cual está.')}</p>` +
            `<div class="warn-box" style="margin: 10px 0;"><strong>⚠️ ${t('Aviso:')}</strong> ${t('esta acción es reversible: podés deshacerla con Ctrl+Z o volver a abrir otro archivo.')}</div>` +
        '</div>',
        () => {
            tournamentData = window.normalizeTournamentData(JSON.parse(JSON.stringify(arch.snapshot)));
            window.resetUndoHistory();
            saveTournamentData();
            if (typeof updateDashboard === 'function') updateDashboard();
            if (typeof updateFixtureNavigator === 'function') updateFixtureNavigator();
            if (typeof reloadSettingsInputs === 'function') reloadSettingsInputs();
            if (typeof loadCustomCategories === 'function') loadCustomCategories();
            addLog('ARCHIVO', t('Torneo abierto desde el archivo:') + ` "${s.nombre}"`);
            showToast(t('Torneo') + ` "${s.nombre}" ` + t('abierto'));
        }
    );
};

/**
 * Exporta un torneo archivado a un archivo JSON.
 * @param {number|string} id
 */
window.exportTournamentArchive = function(id) {
    const arch = getTournamentArchives().find(a => String(a.id) === String(id));
    if (!arch) {
        showToast(t('Torneo archivado no encontrado'), 'error');
        return;
    }
    try {
        const dataStr = JSON.stringify(arch, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Torneo_Archivo_${(arch.name || 'torneo').replace(/[\\/:*?"<>|]+/g, '_')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(t('Torneo archivado exportado'));
        addLog('ARCHIVO', t('Torneo exportado a JSON:') + ` "${arch.name}"`);
    } catch (error) {
        console.error('Error al exportar torneo archivado:', error);
        showToast(t('Error al exportar torneo archivado'), 'error');
    }
};

/**
 * Elimina un torneo del archivo (con confirmación).
 * @param {number|string} id
 */
window.deleteTournamentArchive = function(id) {
    const arch = getTournamentArchives().find(a => String(a.id) === String(id));
    if (!arch) return;
    const s = archiveSummary(arch);
    showModal(
        t('🗑️ Eliminar torneo del archivo'),
        `<p style="color: var(--text-color);">${t('¿Eliminar')} "<strong>${escHtml(s.nombre)}</strong>" ${t('del archivo?')}<br><small style="color: var(--text-muted);">${t('Solo se borra la copia archivada. Los datos actuales del torneo no se modifican.')}</small></p>`,
        () => {
            const list = getTournamentArchives().filter(a => String(a.id) !== String(id));
            saveTournamentArchives(list);
            renderTournamentArchives();
            addLog('ARCHIVO', t('Torneo eliminado del archivo:') + ` "${s.nombre}"`);
            showToast(t('Torneo eliminado del archivo'));
        }
    );
};