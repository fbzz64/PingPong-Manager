// ==========================================
// SYNC.JS - Sincronización multi-dispositivo
// ==========================================
// Permite que un dispositivo "host" comparta el torneo en tiempo real
// y que otros dispositivos "clientes" lo vean actualizarse.
//
// Requiere Firebase RTDB. Configurá FBASE_CONFIG con tu proyecto.
// Firestore NO se usa — solo Realtime Database por su sync nativo.
//
// Modelo: Host = fuente de verdad (lee/escribe todo).
//         Clientes = solo lectura, reciben cambios vía onValue().
// ==========================================

// ==========================================
// CONFIGURACIÓN FIREBASE
// ==========================================
// Reemplazá estos valores con los de tu proyecto Firebase.
// 1. Andá a https://console.firebase.google.com
// 2. Creá un proyecto (o usá uno existente)
// 3. Habilitá Realtime Database (Build > Realtime Database)
// 4. Reglas de DB: { "rules": { ".read": true, ".write": true } }
//    (para producción, usá reglas con autenticación)
// 5. Copiá la config de tu proyecto: Settings > General > Tu app > Config
const FBASE_CONFIG = {
    apiKey:            'TU_API_KEY',
    authDomain:        'TU_PROYECTO.firebaseapp.com',
    databaseURL:       'https://TU_PROYECTO-default-rtdb.firebaseio.com',
    projectId:         'TU_PROYECTO',
    storageBucket:     'TU_PROYECTO.appspot.com',
    messagingSenderId: '000000000000',
    appId:             '1:000000000000:web:xxxxxxxxxx'
};

let _fbApp = null;
let _fbDB = null;
let _roomRef = null;
let _dataUnsub = null;
let _metaUnsub = null;

// Estado de la sincronización
let syncState = {
    active: false,     // sync está corriendo
    role: null,        // 'host' | 'client'
    roomId: null,      // código de sala (ej: 'A3K9PX')
    connected: false,  // conexión a Firebase activa
    lastPush: 0,       // timestamp del último push
    viewers: 0         // cantidad de clientes conectados
};

// Clave de localStorage para el último room used
const SYNC_ROOM_KEY = 'ttmSyncRoom';

/**
 * Genera un código de sala de 6 caracteres (A-Z, 0-9).
 */
function generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 6; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
    return id;
}

/**
 * Inicializa Firebase (solo una vez).
 */
function initFirebase() {
    if (_fbApp) return true;
    try {
        if (typeof firebase === 'undefined') {
            console.warn('[Sync] Firebase SDK no cargado. Agregá los <script> de Firebase en index.html.');
            return false;
        }
        // Evitar re-inicializar
        if (firebase.apps && firebase.apps.length > 0) {
            _fbApp = firebase.apps[0];
        } else {
            _fbApp = firebase.initializeApp(FBASE_CONFIG);
        }
        _fbDB = firebase.database();
        return true;
    } catch (e) {
        console.error('[Sync] Error al inicializar Firebase:', e);
        return false;
    }
}

/**
 * Verifica si Firebase está configurado (no placeholders).
 */
function isConfigured() {
    return FBASE_CONFIG.apiKey &&
           FBASE_CONFIG.apiKey !== 'TU_API_KEY' &&
           FBASE_CONFIG.databaseURL &&
           FBASE_CONFIG.databaseURL.indexOf('TU_PROYECTO') === -1;
}

// ==========================================
// HOST — Crear sala y sincronizar
// ==========================================

/**
 * Crea una sala y empieza a sincronizar como host.
 * @returns {string} Código de la sala (6 chars)
 */
window.syncCreateRoom = function() {
    if (!isConfigured()) {
        showToast(t('⚠️ Sincronización no configurada: editá la config de Firebase en sync.js'), 'warning');
        return null;
    }
    if (!initFirebase()) return null;
    if (syncState.active && syncState.role === 'host') {
        return syncState.roomId;
    }

    const roomId = generateRoomId();
    _roomRef = _fbDB.ref('torneos/' + roomId);

    // Escribir meta + data iniciales
    const meta = {
        nombre: (tournamentData.settings && tournamentData.settings.torneoNombre) || 'Torneo',
        creado: new Date().toISOString(),
        host: 'host-' + Math.random().toString(36).slice(2, 8),
        activo: true
    };

    _roomRef.set({ meta: meta, data: tournamentData }).then(function() {
        syncState.active = true;
        syncState.role = 'host';
        syncState.roomId = roomId;
        syncState.connected = true;

        try { localStorage.setItem(SYNC_ROOM_KEY, roomId); } catch (e) {}

        // Listener de presencia (contar viewers)
        _roomRef.child('viewers').on('value', function(snap) {
            syncState.viewers = snap.numChildren();
            updateSyncUI();
        });

        updateSyncUI();
        addLog('SYNC', t('Sala creada:') + ' ' + roomId);
        showToast(t('🟢 Sala creada:') + ' ' + roomId);
    }).catch(function(e) {
        console.error('[Sync] Error al crear sala:', e);
        showToast(t('❌ Error al crear sala'), 'error');
    });

    return roomId;
};

/**
 * Push de datos al servidor (host). Llamado tras cada saveTournamentData.
 */
window.syncPush = function() {
    if (!syncState.active || syncState.role !== 'host' || !_roomRef) return;
    const now = Date.now();
    // Throttle: máximo cada 2 segundos
    if (now - syncState.lastPush < 2000) return;
    syncState.lastPush = now;

    // Serializar solo lo que Firebase permite (sin functions, sin circular refs)
    try {
        _roomRef.child('data').set(tournamentData);
    } catch (e) {
        console.warn('[Sync] Error en push:', e);
    }
};

/**
 * Detiene la sincronización (host).
 */
window.syncStopHost = function() {
    if (_roomRef && syncState.role === 'host') {
        // Marcar sala como inactiva
        _roomRef.child('meta/activo').set(false).catch(function() {});
    }
    disconnect();
    showToast(t('🔴 Sincronización detenida'));
};

// ==========================================
// CLIENT — Unirse a una sala
// ==========================================

/**
 * Se une a una sala existente como cliente (solo lectura).
 * @param {string} roomId - Código de 6 caracteres
 */
window.syncJoinRoom = function(roomId) {
    roomId = (roomId || '').toUpperCase().trim();
    if (roomId.length !== 6) {
        showToast(t('❌ Código de sala inválido (6 caracteres)'), 'error');
        return false;
    }
    if (!isConfigured()) {
        showToast(t('⚠️ Sincronización no configurada: editá la config de Firebase en sync.js'), 'warning');
        return false;
    }
    if (!initFirebase()) return false;
    if (syncState.active) disconnect();

    _roomRef = _fbDB.ref('torneos/' + roomId);

    // Verificar que la sala existe
    _roomRef.child('meta').once('value').then(function(snap) {
        if (!snap.exists()) {
            showToast(t('❌ Sala no encontrada: ') + roomId, 'error');
            return;
        }

        const meta = snap.val();
        if (meta.activo === false) {
            showToast(t('⚠️ Esta sala fue cerrada por el host'), 'warning');
            return;
        }

        // Registrar viewer
        const viewerId = 'viewer-' + Math.random().toString(36).slice(2, 8);
        const viewerRef = _roomRef.child('viewers/' + viewerId);
        viewerRef.set(true);
        viewerRef.onDisconnect().remove();

        // Suscribirse a cambios de data
        _dataUnsub = _roomRef.child('data').on('value', function(dataSnap) {
            if (!dataSnap.exists()) return;
            const incoming = dataSnap.val();
            // Merge profundo simple: reemplazar tournamentData
            if (typeof window.normalizeTournamentData === 'function') {
                tournamentData = window.normalizeTournamentData(incoming);
            } else {
                tournamentData = incoming;
            }
            // Persistir localmente también
            try {
                localStorage.setItem('tournamentData', JSON.stringify(tournamentData));
            } catch (e) {}
            // Re-renderizar la pestaña activa
            try {
                if (typeof updateDashboard === 'function') updateDashboard();
                if (typeof updateFixtureNavigator === 'function') updateFixtureNavigator();
            } catch (e) {}
        });

        syncState.active = true;
        syncState.role = 'client';
        syncState.roomId = roomId;
        syncState.connected = true;

        try { localStorage.setItem(SYNC_ROOM_KEY, roomId); } catch (e) {}

        updateSyncUI();
        addLog('SYNC', t('Conectado a sala:') + ' ' + roomId);
        showToast(t('🟢 Conectado a sala:') + ' ' + roomId);
    }).catch(function(e) {
        console.error('[Sync] Error al unirse:', e);
        showToast(t('❌ Error al conectar. Verificá tu conexión.'), 'error');
    });

    return true;
};

/**
 * Desconecta un cliente.
 */
window.syncDisconnectClient = function() {
    disconnect();
    showToast(t('🔴 Desconectado del torneo'));
};

// ==========================================
// UTILIDADES COMUNES
// ==========================================

function disconnect() {
    if (_dataUnsub) { _dataUnsub(); _dataUnsub = null; }
    if (_metaUnsub) { _metaUnsub(); _metaUnsub = null; }
    if (_roomRef) {
        _roomRef.child('viewers').off();
        // Si era host, marcar inactivo
        if (syncState.role === 'host') {
            _roomRef.child('meta/activo').set(false).catch(function() {});
        }
        _roomRef = null;
    }
    syncState.active = false;
    syncState.role = null;
    syncState.roomId = null;
    syncState.connected = false;
    syncState.viewers = 0;
    updateSyncUI();
}

/**
 * Retorna el estado actual de la sincronización.
 */
window.syncGetStatus = function() {
    return Object.assign({}, syncState);
};

/**
 * Reintenta la conexión si había una sala guardada.
 */
window.syncReconnect = function() {
    const saved = localStorage.getItem(SYNC_ROOM_KEY);
    if (saved && !syncState.active) {
        syncJoinRoom(saved);
    }
};

// ==========================================
// UI — Actualizar la sección de sync en Settings
// ==========================================

function updateSyncUI() {
    const el = document.getElementById('sync-status');
    if (!el) return;

    if (!syncState.active) {
        el.innerHTML = '<span style="color: var(--text-muted);">' + t('Desconectado') + '</span>';
        return;
    }

    if (syncState.role === 'host') {
        el.innerHTML =
            '<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">' +
                '<span style="color:#4ade80; font-weight:700;">🟢 ' + t('Host activo') + '</span>' +
                '<span style="background:var(--surface-alt); padding:4px 10px; border-radius:6px; font-weight:700; letter-spacing:1px; font-size:15px;">' +
                    escHtml(syncState.roomId) +
                '</span>' +
                '<button class="btn" style="padding:3px 8px; font-size:11px;" onclick="syncCopyCode()">' + t('📋 Copiar') + '</button>' +
                '<span style="color:var(--text-muted); font-size:12px;">(' + syncState.viewers + ' ' + t('conectados') + ')</span>' +
                '<button class="btn btn-danger" style="padding:3px 8px; font-size:11px;" onclick="syncStopHost()">' + t('⏹ Detener') + '</button>' +
            '</div>';
    } else {
        el.innerHTML =
            '<div style="display:flex; align-items:center; gap:10px;">' +
                '<span style="color:#4ade80; font-weight:700;">🟢 ' + t('Sincronizado con') + ' ' + escHtml(syncState.roomId) + '</span>' +
                '<button class="btn btn-danger" style="padding:3px 8px; font-size:11px;" onclick="syncDisconnectClient()">' + t('⏹ Desconectar') + '</button>' +
            '</div>';
    }
}

/**
 * Copia el código de sala al portapapeles.
 */
window.syncCopyCode = function() {
    if (!syncState.roomId) return;
    try {
        navigator.clipboard.writeText(syncState.roomId).then(function() {
            showToast(t('📋 Código copiado: ') + syncState.roomId);
        });
    } catch (e) {
        // Fallback: seleccionar texto
        showToast(t('📋 Código: ') + syncState.roomId);
    }
};

/**
 * Abre el modal de sincronización (creado desde Settings).
 */
window.showSyncModal = function() {
    if (syncState.active) {
        // Ya conectado: mostrar estado
        if (syncState.role === 'host') {
            showModal(
                t('🌐 Sincronización Activa'),
                '<div>' +
                    '<p style="text-align:center; font-size:14px;">' + t('Compartí este código con los dispositivos que quieras ver el torneo en vivo:') + '</p>' +
                    '<p style="text-align:center; font-size:32px; font-weight:700; letter-spacing:4px; color:var(--accent); margin:20px 0;">' + escHtml(syncState.roomId) + '</p>' +
                    '<p style="text-align:center; color:var(--text-muted); font-size:13px;">' + syncState.viewers + ' ' + t('dispositivos conectados') + '</p>' +
                '</div>',
                null, t('Cerrar')
            );
        } else {
            showModal(
                t('🌐 Sincronización Activa'),
                '<div>' +
                    '<p style="text-align:center;">' + t('Estás viendo el torneo en vivo desde la sala') + ' <strong>' + escHtml(syncState.roomId) + '</strong></p>' +
                    '<p style="text-align:center; color:var(--text-muted); font-size:13px; margin-top:10px;">' + t('Los cambios se actualizan automáticamente.') + '</p>' +
                '</div>',
                function() { syncDisconnectClient(); }, t('Desconectar')
            );
        }
        return;
    }

    showModal(
        t('🌐 Sincronizar Torneo'),
        '<div>' +
            '<div style="margin-bottom:20px;">' +
                '<h4 style="margin:0 0 8px 0;">' + t('📤 Crear sala (Host)') + '</h4>' +
                '<p style="font-size:13px; color:var(--text-muted); margin:0 0 10px 0;">' + t('Creá una sala para compartir el torneo en tiempo real. Vos editás, los demás solo ven.') + '</p>' +
                '<button class="btn btn-success" onclick="closeModal(); syncCreateRoom();">' + t('🌐 Crear Sala y Sincronizar') + '</button>' +
            '</div>' +
            '<hr style="border-color:var(--border-color); margin:16px 0;">' +
            '<div>' +
                '<h4 style="margin:0 0 8px 0;">' + t('📥 Unirse a una sala (Viewer)') + '</h4>' +
                '<p style="font-size:13px; color:var(--text-muted); margin:0 0 10px 0;">' + t('Ingresá el código de 6 caracteres que te dio el host.') + '</p>' +
                '<div style="display:flex; gap:8px;">' +
                    '<input id="sync-room-input" type="text" maxlength="6" placeholder="' + t('Ej: A3K9PX') + '" style="flex:1; padding:10px; border:1px solid var(--border-color); border-radius:8px; background:var(--table-bg); color:var(--text-color); font-size:16px; font-weight:700; letter-spacing:2px; text-transform:uppercase;" ' +
                        'oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9]/g,\'\')">' +
                    '<button class="btn btn-info" onclick="var inp=document.getElementById(\'sync-room-input\'); syncJoinRoom(inp.value); closeModal();">' + t('🔗 Conectar') + '</button>' +
                '</div>' +
            '</div>' +
        '</div>',
        null, t('Cerrar')
    );
};

// ==========================================
// INICIALIZACIÓN
// ==========================================

// Actualizar UI al cargar
if (typeof window.onLangChange === 'function') {
    window.onLangChange(function() { updateSyncUI(); });
}

// Auto-reconectar si había una sala guardada (solo si Firebase está configurado)
// Se llama desde main.js después de initializeSystem
window.syncAutoReconnect = function() {
    if (isConfigured()) {
        syncReconnect();
    }
};
