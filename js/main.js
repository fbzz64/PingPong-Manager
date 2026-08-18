// ==========================================
// MAIN.JS - ARCHIVO PRINCIPAL DEL SISTEMA
// ==========================================
// Este archivo contiene:
// - Variables globales
// - Funciones de inicialización
// - Auto-guardado
// - Event listeners principales
// ==========================================
// Las funciones de datos viven en storage.js,
// las de notificaciones/modales en ui.js,
// las de navegación en navigation.js y
// las de logs en logs.js (una sola fuente por función).
// ==========================================

// VARIABLES GLOBALES
let tournamentData = {
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

let currentPlayers = [];
let darkMode = false;

// ==========================================
// FUNCIONES DE INICIALIZACIÓN
// ==========================================

/**
 * Inicializa el sistema completo
 * Se ejecuta cuando el DOM está listo
 */
function initializeSystem() {
    console.log('Iniciando PingPong Manager...');

    // Cargar datos guardados
    loadTournamentData();

    // Aplicar tema guardado
    applyTheme();

    // Actualizar dashboard
    updateDashboard();

    // Cargar categorías personalizadas
    loadCustomCategories();

    // Planificación: categorías, plantillas, límites y lista de espera
    if (typeof renderCategoriesManager === 'function') renderCategoriesManager();
    if (typeof renderTemplateList === 'function') renderTemplateList();
    if (typeof renderWaitlistSection === 'function') renderWaitlistSection();

    // Bitácora de cambios (pestaña)
    if (typeof renderChangelogPage === 'function') renderChangelogPage();

    // Restaurar última categoría/grupo del fixture
    restoreLastFixtureSelection();

    // Configurar atajos de teclado
    setupKeyboardShortcuts();

    // Cargar patrocinadores
    if (typeof loadPatrocinadoresList === 'function') {
        loadPatrocinadoresList();
    }

    // Limpiar historial inicial para que deshacer empiece vacío
    if (typeof resetUndoHistory === 'function') {
        resetUndoHistory();
    }

    // Restaurar la última pestaña activa (o abrir en Dashboard)
    const savedTab = localStorage.getItem('ttmActiveTab');
    const validTab = savedTab && document.querySelector('.tab[data-tab="' + savedTab + '"]');
    showTab(validTab ? savedTab : 'dashboard');

    console.log('Sistema iniciado correctamente');
    showToast(t('Sistema listo para usar'));
}

// ==========================================
// AUTO-GUARDADO DE CONFIGURACIÓN
// ==========================================

// Auto-guardar configuración cada 30 segundos.
// SOLO mientras la pestaña Configuración está activa: los inputs recién se
// cargan con la config guardada al abrirla (reloadSettingsInputs), así que
// sincronizar en cualquier otra pestaña pisaría la config con valores
// defaults crudos del DOM (p. ej. "4° Torneo"/BO3 sobre un "5° Torneo"/BO5).
setInterval(() => {
    const activeTab = document.querySelector('.tab.active');
    if (!activeTab || activeTab.getAttribute('data-tab') !== 'settings') return;

    const torneoNombre = document.getElementById('torneoNombre');
    const subtitulo = document.getElementById('subtitulo');
    const torneoLugar = document.getElementById('torneoLugar');
    const torneoFechaInicio = document.getElementById('torneoFechaInicio');
    const torneoFechaFin = document.getElementById('torneoFechaFin');
    const torneoOrganizadores = document.getElementById('torneoOrganizadores');
    const torneoMesas = document.getElementById('torneoMesas');
    const torneoFormato = document.getElementById('torneoFormato');
    const torneoFormatoGrupos = document.getElementById('torneoFormatoGrupos');
    const torneoFormatoLlaves = document.getElementById('torneoFormatoLlaves');
    const torneoDuracion = document.getElementById('torneoDuracion');

    let changed = false;

    const syncText = (elId, key) => {
        const el = document.getElementById(elId);
        if (el && tournamentData.settings[key] !== el.value) {
            tournamentData.settings[key] = el.value;
            changed = true;
        }
    };
    const syncInt = (elId, key) => {
        const el = document.getElementById(elId);
        if (el && parseInt(el.value)) {
            const v = parseInt(el.value);
            if (tournamentData.settings[key] !== v) {
                tournamentData.settings[key] = v;
                changed = true;
            }
        }
    };

    syncText('torneoNombre', 'torneoNombre');
    syncText('subtitulo', 'subtitulo');
    syncText('torneoLugar', 'lugar');
    syncText('torneoFechaInicio', 'fechaInicio');
    syncText('torneoFechaFin', 'fechaFin');
    syncText('torneoOrganizadores', 'organizadores');
    syncInt('torneoMesas', 'mesas');
    syncText('torneoFormato', 'formato');
    syncText('torneoFormatoGrupos', 'formatoPartidoGrupos');
    syncText('torneoFormatoLlaves', 'formatoPartidoLlaves');
    syncInt('torneoDuracion', 'duracionPartido');

    const soundEl = document.getElementById('soundEnabled');
    if (soundEl && tournamentData.settings) {
        const current = tournamentData.settings.soundEnabled !== false;
        if (current !== soundEl.checked) {
            tournamentData.settings.soundEnabled = soundEl.checked;
            changed = true;
        }
    }

    if (changed) {
        saveTournamentData();
        if (typeof refreshDashboardHeader === 'function') refreshDashboardHeader();
    }
}, 30000); // 30 segundos

// ==========================================
// AUTO-GUARDADO DE DATOS DEL TORNEO (corte de luz)
// ==========================================

// Guarda los datos del torneo cada 10 segundos. saveTournamentData() ya
// descarta escrituras cuando no hubo cambios (lastSavedState), así que el
// intervalo es barato y solo persiste lo nuevo: un corte de luz o cierre
// brusco pierde como mucho los últimos 10 segundos de trabajo.
setInterval(() => {
    if (typeof saveTournamentData === 'function') saveTournamentData();
    if (typeof saveSessionRecovery === 'function') saveSessionRecovery();
    if (typeof saveAutoBackup === 'function') saveAutoBackup();
}, 10000); // 10 segundos

// Al cerrar/ocultar la app, forzar el checkpoint de recuperación para que la
// última sesión quede disponible aunque se corte la energía de golpe.
window.addEventListener('pagehide', () => {
    if (typeof saveSessionRecovery === 'function') saveSessionRecovery(true);
    if (typeof saveTournamentData === 'function') saveTournamentData();
});
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && typeof saveSessionRecovery === 'function') {
        saveSessionRecovery(true);
    }
});

// ==========================================
// AUTO-REFRESCO DEL DASHBOARD (PARTIDOS EN VIVO)
// ==========================================

// Refresca los partidos en vivo y los próximos por mesa cada 15 s
// mientras la pestaña Dashboard esté activa.
setInterval(() => {
    const activeTab = document.querySelector('.tab.active');
    if (!activeTab || activeTab.getAttribute('data-tab') !== 'dashboard') return;
    if (typeof renderLiveScores === 'function') renderLiveScores();
    if (typeof renderDashboardNextMatches === 'function') renderDashboardNextMatches();
}, 15000); // 15 segundos

// ==========================================
// INSTALACIÓN COMO APLICACIÓN (PWA)
// ==========================================

let deferredInstallPrompt = null;
let isAppInstalled = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;

// Actualiza el estado del botón "Instalar la App (PWA)"
function updateInstallAppButton() {
    const btn = document.getElementById('btn-install-app');
    if (!btn) return;

    if (isAppInstalled) {
        btn.disabled = true;
        btn.textContent = t('✅ Aplicación instalada');
    } else if (location.protocol !== 'http:' && location.protocol !== 'https:') {
        btn.disabled = true;
        btn.textContent = t('⚠️ Abrí la app por HTTP para poder instalarla');
    } else if (!('serviceWorker' in navigator)) {
        btn.disabled = true;
        btn.textContent = t('⚠️ Navegador sin soporte para instalar apps');
    } else {
        btn.disabled = !deferredInstallPrompt;
        btn.textContent = deferredInstallPrompt ? t('📲 Instalar la App (PWA)') : t('⏳ Preparando instalación…');
    }
}

// Instala la aplicación cuando el navegador lo permite
window.installPWA = function() {
    if (!deferredInstallPrompt) {
        showToast(t('La app ya está instalada o aún no es instalable desde este navegador'), 'info');
        return;
    }
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(function(choice) {
        if (choice.outcome === 'accepted') {
            showToast(t('📲 Aplicación instalada correctamente'));
        } else {
            showToast(t('Instalación cancelada'), 'info');
        }
        deferredInstallPrompt = null;
        updateInstallAppButton();
    });
};

// El navegador dispara este evento cuando la app es instalable
window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    updateInstallAppButton();
});

window.addEventListener('appinstalled', function() {
    isAppInstalled = true;
    deferredInstallPrompt = null;
    updateInstallAppButton();
    showToast(t('📲 Aplicación instalada correctamente'));
});

// ==========================================
// INICIALIZACIÓN AL CARGAR LA PÁGINA
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    initializeSystem();
    updateInstallAppButton();
});

