// ==========================================
// NAVIGATION.JS - Navegación de pestañas y atajos de teclado
// ==========================================

// ---- Menús desplegables del menú principal ----
function closeAllDropdowns() {
    document.querySelectorAll('.tab-group.dropdown.open').forEach(function(group) {
        group.classList.remove('open');
        const toggle = group.querySelector('.dropdown-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
}

window.toggleDropdown = function(toggle) {
    const group = toggle.closest('.tab-group.dropdown');
    if (!group) return;
    const isOpen = group.classList.contains('open');
    closeAllDropdowns();
    if (!isOpen) {
        group.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
    }
};

// Refleja en cada toggle del menú principal la pestaña activa de su grupo
function updateDropdownCurrent() {
    document.querySelectorAll('.tab-group.dropdown').forEach(function(group) {
        const current = group.querySelector('.tab.active');
        const curSpan = group.querySelector('.dd-active');
        if (curSpan) {
            curSpan.textContent = current ? ' · ' + current.textContent.trim() : '';
        }
    });
}

// Cerrar cualquier menú desplegable al hacer clic fuera
document.addEventListener('click', function(e) {
    if (!e.target.closest('.tab-group.dropdown')) {
        closeAllDropdowns();
    }
});

// Cambiar entre pestañas
window.showTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    const contentEl = document.getElementById(tabName);
    if (contentEl) {
        contentEl.classList.add('active');
    }

    const tabBtn = document.querySelector('.tab[data-tab="' + tabName + '"]');
    if (tabBtn) {
        tabBtn.classList.add('active');
    }

    closeAllDropdowns();
    updateDropdownCurrent();

    if (tabName === 'dashboard' && typeof updateDashboard === 'function') updateDashboard();
    if (tabName === 'stats' && typeof calculateStats === 'function') calculateStats();
    if (tabName === 'players' && typeof showAllPlayers === 'function') showAllPlayers();
    if (tabName === 'players' && typeof renderCheckinQuickActions === 'function') renderCheckinQuickActions();
    if (tabName === 'settings' && typeof reloadSettingsInputs === 'function') reloadSettingsInputs();
    if (tabName === 'settings' && typeof renderCategoriesManager === 'function') renderCategoriesManager();
    if (tabName === 'settings' && typeof renderTournamentArchives === 'function') renderTournamentArchives();
    if (tabName === 'fixture' && typeof updateFixtureNavigator === 'function') updateFixtureNavigator();
    if (tabName === 'ranking' && typeof renderRanking === 'function') renderRanking();
    if (tabName === 'brackets' && typeof renderBracketsForTab === 'function') renderBracketsForTab();
    if (tabName === 'logs' && typeof showLogs === 'function') showLogs();

    try {
        localStorage.setItem('ttmActiveTab', tabName);
    } catch (e) { /* localStorage no disponible */ }
};

// Configurar atajos de teclado
window.setupKeyboardShortcuts = function() {
    document.addEventListener('keydown', function(e) {
        // F1 - Cargar datos de prueba
        if (e.key === 'F1') {
            e.preventDefault();
            loadFakeData();
        }
        // F2 - Exportar JSON
        else if (e.key === 'F2') {
            e.preventDefault();
            exportAllData();
        }
        // F3 - Importar JSON
        else if (e.key === 'F3') {
            e.preventDefault();
            importAllData();
        }
        // F5 - Actualizar Dashboard
        else if (e.key === 'F5') {
            e.preventDefault();
            updateDashboard();
            showToast(t('Dashboard actualizado'));
        }
        // F11 - Generar Fixture
        else if (e.key === 'F11') {
            e.preventDefault();
            generateFixture();
        }
        // F12 - Imprimir Fixture
        else if (e.key === 'F12') {
            e.preventDefault();
            printFixture();
        }
        // Ctrl + S - Guardar Fixture
        else if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveFixtureData();
        }
        // Ctrl + P - Imprimir
        else if (e.ctrlKey && e.key === 'p') {
            e.preventDefault();
            printFixture();
        }
        // Ctrl + E - Exportar estadísticas
        else if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            exportStatsExcel();
        }
        // Ctrl + Shift + P - Agregar jugador
        else if (e.ctrlKey && e.shiftKey && e.key === 'P') {
            e.preventDefault();
            showTab('players');
            document.getElementById('new-player-name').focus();
        }
        // Ctrl + Shift + F - Ir a Fixture
        else if (e.ctrlKey && e.shiftKey && e.key === 'F') {
            e.preventDefault();
            showTab('fixture');
        }
        // Ctrl + Shift + D - Ir a Dashboard
        else if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            showTab('dashboard');
        }
        // Ctrl + Shift + S - Ir a Estadísticas
        else if (e.ctrlKey && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            showTab('stats');
            calculateStats();
        }
        // Ctrl + Shift + B - Ir a Brackets
        else if (e.ctrlKey && e.shiftKey && e.key === 'B') {
            e.preventDefault();
            showTab('brackets');
        }
        // Ctrl + Shift + L - Ir a Logs
        else if (e.ctrlKey && e.shiftKey && e.key === 'L') {
            e.preventDefault();
            showTab('logs');
            showLogs();
        }
        // Ctrl + Shift + R - Ir a Ranking
        else if (e.ctrlKey && e.shiftKey && e.key === 'R') {
            e.preventDefault();
            showTab('ranking');
        }
        // Ctrl + Shift + C - Ir a Configuración
        else if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            showTab('settings');
        }
        // Ctrl + Shift + H - Ir a Changelog
        else if (e.ctrlKey && e.shiftKey && e.key === 'H') {
            e.preventDefault();
            showTab('changelog');
        }
        // F9 - Scoreboard en vivo
        else if (e.key === 'F9') {
            e.preventDefault();
            if (typeof openScoreboard === 'function') openScoreboard();
        }
        // F8 - Mesas en vivo
        else if (e.key === 'F8') {
            e.preventDefault();
            if (typeof openTablesLive === 'function') openTablesLive();
        }
        // F7 - Escanear QR
        else if (e.key === 'F7') {
            e.preventDefault();
            if (typeof scanPlayerQR === 'function') scanPlayerQR();
        }
        // Ctrl + Shift + Q - Check-in rápido
        else if (e.ctrlKey && e.shiftKey && e.key === 'Q') {
            e.preventDefault();
            showTab('players');
            if (typeof showCheckinModal === 'function') showCheckinModal();
        }
        // Ctrl + Shift + W - Difundir en redes
        else if (e.ctrlKey && e.shiftKey && e.key === 'W') {
            e.preventDefault();
            if (typeof showSocialHub === 'function') showSocialHub();
        }
        // F4 - Guía del sistema
        else if (e.key === 'F4') {
            e.preventDefault();
            if (typeof showSystemGuide === 'function') showSystemGuide();
        }
        // Ctrl + Shift + K - Toggle panel de atajos
        else if (e.ctrlKey && e.shiftKey && e.key === 'K') {
            e.preventDefault();
            toggleShortcuts();
        }
        // Alt + L - Marcar último jugador como LIBRE
        else if (e.altKey && e.key === 'l') {
            e.preventDefault();
            setLastPlayerAsFree();
        }
        // Ctrl + B - Crear Backup
        else if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            createBackup();
        }
        // Ctrl + Z - Deshacer
        else if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
            e.preventDefault();
            undoAction();
        }
        // Ctrl + Y o Ctrl + Shift + Z - Rehacer
        else if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
            e.preventDefault();
            redoAction();
        }
        // ESC - Cerrar modal
        else if (e.key === 'Escape') {
            const modal = document.getElementById('modal-overlay');
            if (modal.style.display === 'flex') {
                closeModal();
            }
            // Cerrar scoreboard en vivo si está abierto
            if (typeof closeScoreboard === 'function') {
                const sb = document.getElementById('scoreboard-overlay');
                if (sb && sb.style.display === 'flex') closeScoreboard();
            }
            // Cerrar mesas en vivo si está abierta
            if (typeof closeTablesLive === 'function') {
                const tb = document.getElementById('tables-overlay');
                if (tb && tb.style.display === 'flex') closeTablesLive();
            }
            // Cerrar panel de atajos si está abierto
            const shortcuts = document.getElementById('shortcuts-panel');
            if (shortcuts && shortcuts.classList.contains('show')) {
                shortcuts.classList.remove('show');
            }
            // Cerrar menús desplegables abiertos
            closeAllDropdowns();
        }
    });

    addLog('SISTEMA', t('Atajos de teclado inicializados'));
};
