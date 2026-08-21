// ==========================================
// UI.JS - Componentes de interfaz de usuario
// ==========================================

// Sistema de notificaciones Toast
window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
};

// Sistema de Modal
window.showModal = function(title, content, onConfirm, confirmLabel = t('Confirmar'), options = {}) {
    const overlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const confirmBtn = document.getElementById('modal-confirm');

    // Modo pantalla completa (p. ej. el perfil de jugador): options.full = true
    const modalEl = document.querySelector('.modal');
    if (modalEl) {
        if (options.full) modalEl.classList.add('modal--full');
        else modalEl.classList.remove('modal--full');
    }

    modalTitle.textContent = title;
    modalTitle.setAttribute('data-i18n', title);
    modalContent.innerHTML = content;
    confirmBtn.textContent = confirmLabel;

    // Restaurar el botón cancelar por defecto (puede haberse reconectado para
    // edición inline en el perfil de jugador).
    const cancelBtn = document.getElementById('modal-cancel');
    if (cancelBtn) cancelBtn.onclick = closeModal;

    if (onConfirm) {
        // Asegurarse de que el botón confirmar sea visible
        confirmBtn.style.display = 'inline-flex';
        confirmBtn.onclick = function() {
            closeModal();
            onConfirm();
        };
    } else {
        confirmBtn.style.display = 'none';
    }

    overlay.style.display = 'flex';
    // Trigger reflow then add visible class for transition
    void overlay.offsetHeight;
    overlay.classList.add('visible');
};

window.closeModal = function() {
    const modal = document.getElementById('modal-overlay');
    const confirmBtn = document.getElementById('modal-confirm');
    modal.classList.remove('visible');
    // Wait for transition then hide
    setTimeout(function() {
        modal.style.display = 'none';
    }, 250);
    // Restaurar visibilidad del botón confirmar
    confirmBtn.style.display = 'inline-flex';
    // Quitar el modo pantalla completa si estaba activo
    const modalEl = document.querySelector('.modal');
    if (modalEl) modalEl.classList.remove('modal--full');
    // Hook de limpieza (p. ej. detener la cámara del escáner QR)
    if (typeof window.__qrOnModalClose === 'function') {
        window.__qrOnModalClose();
        window.__qrOnModalClose = null;
    }
};

// Al cambiar idioma, re-traduce el título y los elementos data-i18n del modal
// abierto (los textos dinámicos ya re-renderizan al cambiar de pestaña).
window.onLangChange(function() {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay || overlay.style.display !== 'flex') return;
    if (typeof window.applyI18n === 'function') window.applyI18n();
});

// Tema oscuro — tri-state: 'auto' (seguir SO), 'light', 'dark'
const THEME_KEY = 'themeMode';
const prefersDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function resolveDark(mode) {
    if (mode === 'auto') return prefersDark ? prefersDark.matches : false;
    return mode === 'dark';
}

function updateThemeButton() {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    const resolved = darkMode;
    const labels = { auto: '🖥️', light: '☀️', dark: '🌙' };
    const tooltips = { auto: t('Tema: Automático'), light: t('Tema: Claro'), dark: t('Tema: Oscuro') };
    btn.textContent = labels[themeMode] || labels.auto;
    btn.title = tooltips[themeMode] || tooltips.auto;
}

window.toggleTheme = function() {
    const order = ['auto', 'light', 'dark'];
    const idx = order.indexOf(themeMode);
    themeMode = order[(idx + 1) % order.length];
    applyThemeMode();
    const resolved = darkMode ? t('oscuro') : t('claro');
    const modeLabel = themeMode === 'auto' ? t('automático') : resolved;
    showToast(t('🎨 Tema') + ': ' + modeLabel);
};

window.setThemeMode = function(mode) {
    if (['auto', 'light', 'dark'].indexOf(mode) === -1) return;
    themeMode = mode;
    applyThemeMode();
    updateThemeSettingsBtns();
};

function updateThemeSettingsBtns() {
    const ids = { light: 'theme-light-btn', dark: 'theme-dark-btn', auto: 'theme-auto-btn' };
    Object.keys(ids).forEach(function(k) {
        var btn = document.getElementById(ids[k]);
        if (!btn) return;
        if (k === themeMode) {
            btn.classList.add('btn-active-theme');
            btn.style.outline = '3px solid var(--accent)';
            btn.style.outlineOffset = '2px';
        } else {
            btn.classList.remove('btn-active-theme');
            btn.style.outline = 'none';
        }
    });
}

function applyThemeMode() {
    darkMode = resolveDark(themeMode);
    if (darkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    try { localStorage.setItem(THEME_KEY, themeMode); } catch (e) {}
    updateThemeButton();
    updateThemeSettingsBtns();
}

window.applyTheme = function() {
    try {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved && ['auto', 'light', 'dark'].indexOf(saved) !== -1) {
            themeMode = saved;
        } else {
            // Migración: convertir darkMode=true/false legacy
            const legacy = localStorage.getItem('darkMode');
            if (legacy !== null) {
                themeMode = legacy === 'true' ? 'dark' : 'light';
                localStorage.setItem(THEME_KEY, themeMode);
                localStorage.removeItem('darkMode');
            } else {
                themeMode = 'auto';
            }
        }
    } catch (e) {}
    applyThemeMode();

    // Listener: si el SO cambia y estamos en auto, re-aplicar
    if (prefersDark && prefersDark.addEventListener) {
        prefersDark.addEventListener('change', function() {
            if (themeMode === 'auto') applyThemeMode();
        });
    }
};

window.getThemeMode = function() { return themeMode; };
window.isDarkResolved = function() { return darkMode; };

// Panel de atajos de teclado
window.toggleShortcuts = function() {
    const panel = document.getElementById('shortcuts-panel');
    panel.classList.toggle('show');
};

// ==========================================
// CHIP PICKER (reemplaza <select multiple>)
// ==========================================
/**
 * Inicializa un chip picker sobre un <select multiple> existente.
 * El select se oculta y se renderizan chips clickeables.
 * El select se mantiene sincronizado (selectedOptions) para
 * que el código existente que lee el select no necesite cambios.
 */
window.initChipPicker = function(selectId, containerId) {
    const sel = document.getElementById(selectId);
    const container = document.getElementById(containerId || selectId + '-chips');
    if (!sel || !container) return;

    // Ocultar el select real
    sel.style.display = 'none';

    function render() {
        container.innerHTML = '';
        Array.from(sel.options).forEach(function(opt) {
            var chip = document.createElement('span');
            chip.className = 'chip' + (opt.selected ? ' selected' : '');
            chip.textContent = opt.value;
            chip.setAttribute('role', 'checkbox');
            chip.setAttribute('aria-checked', opt.selected ? 'true' : 'false');
            chip.setAttribute('tabindex', '0');
            chip.addEventListener('click', function() {
                opt.selected = !opt.selected;
                render();
            });
            chip.addEventListener('keydown', function(e) {
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    opt.selected = !opt.selected;
                    render();
                }
            });
            container.appendChild(chip);
        });
    }

    render();

    // Exponer función para re-renderizar cuando cambian las opciones
    // (p.ej. al cargar categorías personalizadas)
    sel._chipRender = render;
    sel._chipContainer = container;
};

// resetCompleteSystem, confirmResetSystem y executeCompleteReset viven en tournaments.js

// Añadir estilos de animación para shake
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);