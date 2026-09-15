// ================================================================
// SYNC.JS - Sincronizacion segura multi-dispositivo
// ================================================================
// Roles por torneo:
//   owner    = anfitrion; administra datos, permisos e invitaciones.
//   operator = opera el torneo y puede modificar resultados/datos.
//   viewer   = espectador autenticado de solo lectura.
//
// Firebase Realtime Database aplica la autorizacion real mediante
// database.rules.json. Las restricciones visuales son solo una segunda capa.

(function() {
    'use strict';

    const SYNC_ROOM_KEY = 'ttmSyncRoom';
    const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
    const EDIT_ROLES = ['owner', 'operator'];
    const ROLE_LABELS = {
        owner: 'Anfitrion',
        operator: 'Operador',
        viewer: 'Espectador'
    };

    let firebaseServices = null;
    let roomRef = null;
    let presenceRef = null;
    let listeners = [];
    let lastRemoteData = null;
    let inviteTokenInUse = null;
    let pushTimer = null;
    let pushInFlight = false;
    let pushQueued = false;
    let rejectingMutation = false;

    let syncState = {
        active: false,
        role: null,
        roomId: null,
        connected: false,
        lastPush: 0,
        viewers: 0,
        userEmail: null
    };

    function isConfigured() {
        return Boolean(window.PingPongFirebase && window.PingPongFirebase.isConfigured());
    }

    function getAuthState() {
        return typeof window.authGetState === 'function'
            ? window.authGetState()
            : { user: null, verified: false, uid: null, email: null };
    }

    function randomBytes(length) {
        const bytes = new Uint8Array(length);
        if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
            window.crypto.getRandomValues(bytes);
        } else {
            // Solo para navegadores antiguos; Firebase Rules siguen evitando
            // que un codigo adivinado otorgue acceso sin usuario autorizado.
            for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
        }
        return bytes;
    }

    function generateRoomId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const bytes = randomBytes(6);
        let id = '';
        for (let i = 0; i < bytes.length; i++) id += chars.charAt(bytes[i] % chars.length);
        return id;
    }

    function generateInviteToken() {
        return Array.from(randomBytes(18), function(value) {
            return value.toString(16).padStart(2, '0');
        }).join('');
    }

    function serverTimestamp() {
        return window.firebase && window.firebase.database
            ? window.firebase.database.ServerValue.TIMESTAMP
            : Date.now();
    }

    function firebaseReady() {
        if (!isConfigured()) return Promise.reject(new Error('FIREBASE_NOT_CONFIGURED'));
        return window.PingPongFirebase.ready().then(function(services) {
            firebaseServices = services;
            return services;
        });
    }

    function addListener(ref, eventName, callback, onError) {
        ref.on(eventName, callback, onError);
        listeners.push({ ref: ref, eventName: eventName, callback: callback });
    }

    function removeListeners() {
        listeners.forEach(function(item) {
            try { item.ref.off(item.eventName, item.callback); } catch (e) {}
        });
        listeners = [];
    }

    function cloneData(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function refreshTournamentViews() {
        try {
            if (typeof updateDashboard === 'function') updateDashboard();
            if (typeof updateFixtureNavigator === 'function') updateFixtureNavigator();
            if (typeof renderBracketsForTab === 'function') renderBracketsForTab();
            if (typeof renderLiveScores === 'function') renderLiveScores();
            if (typeof renderTablesLive === 'function') renderTablesLive();
            if (typeof renderTVBoard === 'function') renderTVBoard();
        } catch (error) {
            console.warn('[Sync] Una vista no pudo actualizarse:', error);
        }
    }

    function applyRemoteData(incoming) {
        if (!incoming || typeof incoming !== 'object') return;
        lastRemoteData = cloneData(incoming);
        if (typeof window.normalizeTournamentData === 'function') {
            tournamentData = window.normalizeTournamentData(cloneData(incoming));
        } else {
            tournamentData = cloneData(incoming);
        }
        try {
            localStorage.setItem('tournamentData', JSON.stringify(tournamentData));
            localStorage.setItem('ttmLastSavedAt', new Date().toISOString());
        } catch (error) {
            console.warn('[Sync] No se pudo guardar la copia local:', error);
        }
        refreshTournamentViews();
    }

    function saveReconnectInfo() {
        if (!syncState.roomId) return;
        try {
            localStorage.setItem(SYNC_ROOM_KEY, JSON.stringify({
                roomId: syncState.roomId,
                inviteToken: inviteTokenInUse || null
            }));
        } catch (e) {}
    }

    function readReconnectInfo() {
        try {
            const raw = localStorage.getItem(SYNC_ROOM_KEY);
            if (!raw) return null;
            if (ROOM_CODE_RE.test(raw)) return { roomId: raw, inviteToken: null };
            const parsed = JSON.parse(raw);
            if (!parsed || !ROOM_CODE_RE.test(String(parsed.roomId || ''))) return null;
            return {
                roomId: String(parsed.roomId),
                inviteToken: parsed.inviteToken ? String(parsed.inviteToken) : null
            };
        } catch (e) {
            return null;
        }
    }

    function roleLabel(role) {
        return ROLE_LABELS[role] || role || 'Sin rol';
    }

    function setRoleUI() {
        const readOnly = syncState.active && syncState.role === 'viewer';
        if (document.body && document.body.classList && typeof document.body.classList.toggle === 'function') {
            document.body.classList.toggle('sync-readonly', readOnly);
        }
        const badge = document.getElementById('sync-role-badge');
        if (!badge) return;
        if (!syncState.active) {
            badge.hidden = true;
            badge.textContent = '';
            badge.className = 'sync-role-badge';
            return;
        }
        badge.hidden = false;
        badge.className = 'sync-role-badge sync-role-badge--' + syncState.role;
        badge.textContent = (syncState.connected ? '● ' : '○ ') + roleLabel(syncState.role) + ' · ' + syncState.roomId;
    }

    function updateSyncUI() {
        setRoleUI();
        const el = document.getElementById('sync-status');
        if (!el) return;

        if (!syncState.active) {
            el.innerHTML = '<span style="color: var(--text-muted);">Desconectado</span>';
            return;
        }

        const connectionText = syncState.connected ? 'Conectado' : 'Reconectando…';
        const connectionClass = syncState.connected ? 'sync-online' : 'sync-offline';
        el.innerHTML =
            '<div class="sync-status-line">' +
                '<span class="' + connectionClass + '">● ' + connectionText + '</span>' +
                '<strong>' + escHtml(roleLabel(syncState.role)) + '</strong>' +
                '<code>' + escHtml(syncState.roomId) + '</code>' +
                '<span>' + syncState.viewers + ' conectados</span>' +
                '<button class="btn btn-sm btn-info" onclick="syncCopyCode()">📋 Copiar codigo</button>' +
                (syncState.role === 'owner' ? '<button class="btn btn-sm btn-primary" onclick="syncShowPermissions()">👤 Permisos</button>' : '') +
                '<button class="btn btn-sm btn-danger" onclick="syncDisconnectClient()">⏹ Desconectar</button>' +
            '</div>';
    }

    function resetState() {
        syncState.active = false;
        syncState.role = null;
        syncState.roomId = null;
        syncState.connected = false;
        syncState.lastPush = 0;
        syncState.viewers = 0;
        syncState.userEmail = null;
        roomRef = null;
        presenceRef = null;
        inviteTokenInUse = null;
        lastRemoteData = null;
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = null;
        pushQueued = false;
        pushInFlight = false;
        updateSyncUI();
    }

    function disconnect(options) {
        options = options || {};
        removeListeners();
        if (presenceRef) {
            try {
                presenceRef.onDisconnect().cancel();
                presenceRef.remove().catch(function() {});
            } catch (e) {}
        }
        if (options.forget) {
            try { localStorage.removeItem(SYNC_ROOM_KEY); } catch (e) {}
        }
        resetState();
    }

    function onPermissionError(error) {
        console.warn('[Sync] Permiso o conexion:', error && (error.message || error));
        if (error && error.code === 'PERMISSION_DENIED') {
            showToast('Tu cuenta ya no tiene permiso para acceder a este torneo.', 'error');
            disconnect({ forget: true });
        }
    }

    function connectListeners(roomId, member) {
        const auth = getAuthState();
        roomRef = firebaseServices.db.ref('torneos/' + roomId);
        syncState.active = true;
        syncState.roomId = roomId;
        syncState.role = member.role;
        syncState.userEmail = auth.email;
        saveReconnectInfo();
        updateSyncUI();

        const dataRef = roomRef.child('data');
        addListener(dataRef, 'value', function(snapshot) {
            if (snapshot.exists()) applyRemoteData(snapshot.val());
        }, onPermissionError);

        const metaRef = roomRef.child('meta');
        addListener(metaRef, 'value', function(snapshot) {
            if (!snapshot.exists() || snapshot.child('active').val() === false) {
                showToast('El anfitrion cerro esta sala.', 'warning');
                disconnect({ forget: true });
            }
        }, onPermissionError);

        const ownMemberRef = roomRef.child('members/' + auth.uid);
        addListener(ownMemberRef, 'value', function(snapshot) {
            if (!snapshot.exists()) {
                showToast('El anfitrion retiro tu acceso al torneo.', 'warning');
                disconnect({ forget: true });
                return;
            }
            const updatedRole = snapshot.child('role').val();
            if (updatedRole && updatedRole !== syncState.role) {
                syncState.role = updatedRole;
                updateSyncUI();
                showToast('Tu permiso cambio a ' + roleLabel(updatedRole) + '.');
            }
        }, onPermissionError);

        const presenceListRef = roomRef.child('presence');
        addListener(presenceListRef, 'value', function(snapshot) {
            syncState.viewers = snapshot.numChildren();
            updateSyncUI();
        }, onPermissionError);

        const connectedRef = firebaseServices.db.ref('.info/connected');
        addListener(connectedRef, 'value', function(snapshot) {
            syncState.connected = snapshot.val() === true;
            updateSyncUI();
            if (!syncState.connected) return;

            presenceRef = roomRef.child('presence/' + auth.uid);
            presenceRef.onDisconnect().remove();
            presenceRef.set({
                email: auth.email,
                role: syncState.role,
                connectedAt: serverTimestamp()
            }).catch(onPermissionError);
        });
    }

    function claimInvitation(roomId, token, user) {
        if (!token || !/^[a-f0-9]{36}$/i.test(token)) {
            return Promise.reject(new Error('INVITE_REQUIRED'));
        }
        const inviteRef = firebaseServices.db.ref('torneos/' + roomId + '/invites/' + token);
        return inviteRef.once('value').then(function(snapshot) {
            if (!snapshot.exists()) throw new Error('INVITE_INVALID');
            const invite = snapshot.val();
            if (invite.email !== user.email) throw new Error('INVITE_EMAIL_MISMATCH');
            if (invite.status !== 'pending') throw new Error('INVITE_INVALID');
            if (invite.expiresAt && invite.expiresAt < Date.now()) throw new Error('INVITE_EXPIRED');
            if (['operator', 'viewer'].indexOf(invite.role) === -1) throw new Error('INVITE_INVALID');

            const updates = {};
            updates['torneos/' + roomId + '/members/' + user.uid] = {
                email: user.email,
                role: invite.role,
                inviteToken: token,
                joinedAt: serverTimestamp()
            };
            updates['torneos/' + roomId + '/invites/' + token + '/status'] = 'claimed';
            updates['torneos/' + roomId + '/invites/' + token + '/claimedBy'] = user.uid;
            updates['torneos/' + roomId + '/invites/' + token + '/claimedAt'] = serverTimestamp();

            return firebaseServices.db.ref().update(updates).then(function() {
                inviteTokenInUse = token;
                return { email: user.email, role: invite.role, inviteToken: token };
            });
        });
    }

    function findOrClaimMember(roomId, token, user) {
        const memberRef = firebaseServices.db.ref('torneos/' + roomId + '/members/' + user.uid);
        return memberRef.once('value').then(function(snapshot) {
            if (snapshot.exists()) return snapshot.val();
            return claimInvitation(roomId, token, user);
        }).catch(function(error) {
            if (token) return claimInvitation(roomId, token, user);
            throw error;
        });
    }

    function joinRoomAsync(roomId, token, silent) {
        const auth = getAuthState();
        if (!auth.user || !auth.verified) return Promise.reject(new Error('AUTH_REQUIRED'));
        if (syncState.active) disconnect();

        return firebaseReady().then(function() {
            return findOrClaimMember(roomId, token, auth.user);
        }).then(function(member) {
            return firebaseServices.db.ref('torneos/' + roomId + '/meta').once('value').then(function(snapshot) {
                if (!snapshot.exists()) throw new Error('ROOM_NOT_FOUND');
                if (snapshot.child('active').val() === false) throw new Error('ROOM_CLOSED');
                connectListeners(roomId, member);
                if (!silent) {
                    addLog('SYNC', 'Conectado a sala ' + roomId + ' como ' + roleLabel(member.role));
                    showToast('🟢 Conectado como ' + roleLabel(member.role) + '.');
                }
                return true;
            });
        }).catch(function(error) {
            console.warn('[Sync] No se pudo unir:', error && (error.message || error));
            const messages = {
                AUTH_REQUIRED: 'Inicia sesion y verifica tu correo para entrar.',
                INVITE_REQUIRED: 'Tu cuenta no tiene acceso a esta sala.',
                INVITE_INVALID: 'La invitacion no existe o ya no es valida.',
                INVITE_EMAIL_MISMATCH: 'Esta invitacion pertenece a otro correo.',
                INVITE_EXPIRED: 'La invitacion vencio. Solicita una nueva al anfitrion.',
                ROOM_NOT_FOUND: 'Sala no encontrada.',
                ROOM_CLOSED: 'Esta sala fue cerrada por el anfitrion.'
            };
            const key = error && error.message;
            const permissionDenied = error && error.code === 'PERMISSION_DENIED';
            showToast(messages[key] || (permissionDenied ? 'Tu cuenta no tiene acceso a esta sala.' : 'No se pudo conectar con Firebase.'), 'error');
            return false;
        });
    }

    function createRoomAttempt(attempt) {
        const auth = getAuthState();
        const roomId = generateRoomId();
        const candidateRef = firebaseServices.db.ref('torneos/' + roomId);
        const initial = {
            meta: {
                name: tournamentData.settings && tournamentData.settings.torneoNombre || 'Torneo',
                createdAt: serverTimestamp(),
                ownerUid: auth.uid,
                active: true,
                schemaVersion: 1
            },
            members: {},
            data: tournamentData
        };
        initial.members[auth.uid] = {
            email: auth.email,
            role: 'owner',
            joinedAt: serverTimestamp()
        };

        return candidateRef.set(initial).then(function() {
            connectListeners(roomId, initial.members[auth.uid]);
            addLog('SYNC', 'Sala segura creada: ' + roomId);
            showToast('🟢 Sala segura creada: ' + roomId);
            return roomId;
        }).catch(function(error) {
            if (attempt < 4 && error && error.code === 'PERMISSION_DENIED') {
                return createRoomAttempt(attempt + 1);
            }
            throw error;
        });
    }

    function pushNow() {
        pushTimer = null;
        if (!roomRef || !syncState.active || EDIT_ROLES.indexOf(syncState.role) === -1) return;
        if (pushInFlight) {
            pushQueued = true;
            return;
        }

        pushInFlight = true;
        syncState.lastPush = Date.now();
        roomRef.child('data').set(tournamentData).then(function() {
            lastRemoteData = cloneData(tournamentData);
        }).catch(function(error) {
            console.error('[Sync] Error al guardar en Firebase:', error);
            showToast('No se pudo sincronizar el ultimo cambio.', 'error');
        }).finally(function() {
            pushInFlight = false;
            if (pushQueued) {
                pushQueued = false;
                window.syncPush();
            }
        });
    }

    window.syncGetStatus = function() {
        return Object.assign({}, syncState);
    };

    window.syncCanEdit = function() {
        return !syncState.active || EDIT_ROLES.indexOf(syncState.role) !== -1;
    };

    window.syncRejectLocalMutation = function() {
        if (rejectingMutation || window.syncCanEdit()) return false;
        rejectingMutation = true;
        if (lastRemoteData) applyRemoteData(lastRemoteData);
        showToast('Modo espectador: no tienes permiso para modificar el torneo.', 'warning');
        rejectingMutation = false;
        return true;
    };

    window.syncCreateRoom = function() {
        if (!isConfigured()) {
            showToast('Sincronizacion no configurada: completa js/firebase-config.js.', 'warning');
            return null;
        }
        if (typeof window.authRequireVerified === 'function' && !window.authRequireVerified()) return null;
        if (syncState.active && syncState.role === 'owner') return Promise.resolve(syncState.roomId);

        return firebaseReady().then(function() {
            return createRoomAttempt(0);
        }).catch(function(error) {
            console.error('[Sync] Error al crear sala:', error);
            showToast('No se pudo crear la sala. Verifica Authentication y las reglas de la base.', 'error');
            return null;
        });
    };

    window.syncJoinRoom = function(roomId, token) {
        roomId = String(roomId || '').toUpperCase().trim();
        if (!ROOM_CODE_RE.test(roomId)) {
            showToast('Código de sala inválido (6 caracteres).', 'error');
            return false;
        }
        if (!isConfigured()) {
            showToast('Sincronizacion no configurada: completa js/firebase-config.js.', 'warning');
            return false;
        }
        if (typeof window.authRequireVerified === 'function' && !window.authRequireVerified()) return false;
        joinRoomAsync(roomId, token || null, false);
        return true;
    };

    window.syncPush = function() {
        if (!syncState.active || EDIT_ROLES.indexOf(syncState.role) === -1 || !roomRef) return;
        const elapsed = Date.now() - syncState.lastPush;
        const delay = Math.max(0, 1200 - elapsed);
        if (pushTimer) {
            pushQueued = true;
            return;
        }
        pushTimer = setTimeout(pushNow, delay);
    };

    window.syncStopHost = function() {
        if (!roomRef || syncState.role !== 'owner') {
            showToast('Solo el anfitrion puede cerrar la sala.', 'warning');
            return;
        }
        roomRef.child('meta/active').set(false).then(function() {
            disconnect({ forget: true });
            showToast('🔴 Sala cerrada para todos los participantes.');
        }).catch(function(error) {
            console.error('[Sync] No se pudo cerrar:', error);
            showToast('No se pudo cerrar la sala.', 'error');
        });
    };

    window.syncDisconnectClient = function() {
        disconnect({ forget: true });
        showToast('🔴 Desconectado del torneo.');
    };

    window.syncReconnect = function() {
        const saved = readReconnectInfo();
        const auth = getAuthState();
        if (!saved || syncState.active || !auth.user || !auth.verified || !isConfigured()) return false;
        joinRoomAsync(saved.roomId, saved.inviteToken, true);
        return true;
    };

    window.syncAutoReconnect = function() {
        if (!isConfigured()) return false;
        const params = typeof URLSearchParams === 'function'
            ? new URLSearchParams(window.location.search || '')
            : null;
        const room = params && String(params.get('room') || '').toUpperCase();
        const invite = params && params.get('invite');
        if (ROOM_CODE_RE.test(room)) {
            try {
                localStorage.setItem(SYNC_ROOM_KEY, JSON.stringify({ roomId: room, inviteToken: invite || null }));
            } catch (e) {}
        }
        return window.syncReconnect();
    };

    window.syncCopyCode = function() {
        if (!syncState.roomId) return;
        const value = syncState.roomId;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(value).then(function() {
                showToast('📋 Codigo copiado: ' + value);
            }).catch(function() { showToast('Codigo: ' + value, 'info'); });
        } else {
            showToast('Codigo: ' + value, 'info');
        }
    };

    window.showSyncModal = function() {
        if (syncState.active) {
            const ownerActions = syncState.role === 'owner'
                ? '<button class="btn btn-primary" onclick="closeModal(); syncShowPermissions();">👤 Administrar permisos</button>' +
                  '<button class="btn btn-danger" onclick="closeModal(); syncStopHost();">⏹ Cerrar sala para todos</button>'
                : '';
            showModal(
                '🌐 Sincronizacion activa',
                '<div class="sync-room-summary">' +
                    '<span class="sync-room-code">' + escHtml(syncState.roomId) + '</span>' +
                    '<strong>' + escHtml(roleLabel(syncState.role)) + '</strong>' +
                    '<span>' + syncState.viewers + ' dispositivos conectados</span>' +
                '</div>' +
                '<div class="auth-modal-actions">' +
                    '<button class="btn btn-info" onclick="syncCopyCode()">📋 Copiar codigo</button>' +
                    ownerActions +
                    '<button class="btn btn-warning" onclick="closeModal(); syncDisconnectClient();">Desconectar este dispositivo</button>' +
                '</div>',
                null,
                'Cerrar'
            );
            return;
        }

        const auth = getAuthState();
        const accountNotice = !auth.user
            ? '<div class="alert alert-warning">Primero debes iniciar sesion.</div>'
            : (!auth.verified ? '<div class="alert alert-warning">Verifica tu correo antes de sincronizar.</div>' : '');
        showModal(
            '🌐 Sincronizar torneo',
            accountNotice +
            '<div class="sync-choice">' +
                '<section><h4>📤 Crear sala segura</h4><p>Seras el anfitrion y podras invitar operadores o espectadores por correo.</p>' +
                    '<button class="btn btn-success" onclick="closeModal(); syncCreateRoom();">Crear sala</button></section>' +
                '<section><h4>📥 Entrar a una sala</h4><p>Usa el codigo del anfitrion. Si es tu primer acceso, abre el enlace de invitacion recibido.</p>' +
                    '<div class="sync-join-row"><input id="sync-room-input" class="form-control" maxlength="6" placeholder="Ej: A3K9PX" autocomplete="off" oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9]/g,\'\')">' +
                    '<button class="btn btn-info" onclick="var input=document.getElementById(\'sync-room-input\'); if(syncJoinRoom(input.value)) closeModal();">Conectar</button></div></section>' +
            '</div>',
            null,
            'Cerrar'
        );
    };

    function invitationUrl(token) {
        const base = window.location.origin && window.location.origin !== 'null'
            ? window.location.origin + window.location.pathname
            : window.location.href.split('?')[0].split('#')[0];
        return base + '?room=' + encodeURIComponent(syncState.roomId) + '&invite=' + encodeURIComponent(token);
    }

    function showInvitationResult(email, role, token) {
        const url = invitationUrl(token);
        showModal(
            'Invitacion creada',
            '<div class="invite-result">' +
                '<div class="alert alert-success">Permiso de <strong>' + escHtml(roleLabel(role)) + '</strong> preparado para <strong>' + escHtml(email) + '</strong>.</div>' +
                '<label for="invite-link-output">Enlace personal</label>' +
                '<input id="invite-link-output" class="form-control" readonly value="' + escAttr(url) + '">' +
                '<p class="auth-help">El destinatario debera crear o usar una cuenta con exactamente ese correo y verificarla.</p>' +
                '<div class="auth-modal-actions">' +
                    '<button class="btn btn-primary" onclick="syncCopyInviteLink()">📋 Copiar enlace</button>' +
                    '<a class="btn btn-info" href="mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent('Invitacion a ' + (tournamentData.settings.torneoNombre || 'PingPong Manager')) + '&body=' + encodeURIComponent('Te invitaron como ' + roleLabel(role) + '. Abre este enlace e inicia sesion con ' + email + ':\n\n' + url) + '">✉️ Abrir correo</a>' +
                '</div>' +
            '</div>',
            null,
            'Cerrar'
        );
    }

    window.syncInviteMember = function() {
        if (!roomRef || syncState.role !== 'owner') {
            showToast('Solo el anfitrion puede otorgar permisos.', 'warning');
            return;
        }
        const emailEl = document.getElementById('permission-email');
        const roleEl = document.getElementById('permission-role');
        const email = String(emailEl && emailEl.value || '').trim().toLowerCase();
        const role = String(roleEl && roleEl.value || 'viewer');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showToast('Ingresa un correo electronico valido.', 'warning');
            return;
        }
        if (['operator', 'viewer'].indexOf(role) === -1) {
            showToast('Selecciona un permiso valido.', 'warning');
            return;
        }

        const auth = getAuthState();
        const token = generateInviteToken();
        roomRef.child('invites/' + token).set({
            email: email,
            role: role,
            status: 'pending',
            createdBy: auth.uid,
            createdAt: serverTimestamp(),
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
        }).then(function() {
            showInvitationResult(email, role, token);
        }).catch(function(error) {
            console.error('[Sync] No se pudo invitar:', error);
            showToast('No se pudo crear la invitacion.', 'error');
        });
    };

    window.syncCopyInviteLink = function() {
        const input = document.getElementById('invite-link-output');
        if (!input) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(input.value).then(function() {
                showToast('Enlace de invitacion copiado.');
            });
        } else {
            input.select();
            document.execCommand('copy');
            showToast('Enlace de invitacion copiado.');
        }
    };

    window.syncUpdateMemberRole = function(uid, role) {
        if (!roomRef || syncState.role !== 'owner') return;
        if (['operator', 'viewer'].indexOf(role) === -1) return;
        roomRef.child('members/' + uid + '/role').set(role).then(function() {
            showToast('Permiso actualizado a ' + roleLabel(role) + '.');
            window.syncShowPermissions();
        }).catch(function(error) {
            console.error('[Sync] No se pudo cambiar el rol:', error);
            showToast('No se pudo actualizar el permiso.', 'error');
        });
    };

    window.syncRemoveMember = function(uid, email) {
        if (!roomRef || syncState.role !== 'owner') return;
        showModal(
            'Retirar acceso',
            '<p>¿Quieres retirar el acceso de <strong>' + escHtml(email || '') + '</strong>?</p>',
            function() {
                const updates = {};
                updates['members/' + uid] = null;
                updates['presence/' + uid] = null;
                roomRef.update(updates).then(function() {
                    showToast('Acceso retirado.');
                    window.syncShowPermissions();
                }).catch(function() { showToast('No se pudo retirar el acceso.', 'error'); });
            },
            'Retirar'
        );
    };

    window.syncRevokeInvite = function(token) {
        if (!roomRef || syncState.role !== 'owner') return;
        roomRef.child('invites/' + token).remove().then(function() {
            showToast('Invitacion revocada.');
            window.syncShowPermissions();
        }).catch(function() { showToast('No se pudo revocar la invitacion.', 'error'); });
    };

    window.syncShowPermissions = function() {
        if (!roomRef || syncState.role !== 'owner') {
            showToast('Solo el anfitrion puede administrar permisos.', 'warning');
            return;
        }
        Promise.all([
            roomRef.child('members').once('value'),
            roomRef.child('invites').once('value')
        ]).then(function(results) {
            const auth = getAuthState();
            const members = results[0].val() || {};
            const invites = results[1].val() || {};
            const memberRows = Object.keys(members).map(function(uid) {
                const member = members[uid] || {};
                const isOwner = member.role === 'owner';
                const controls = isOwner
                    ? '<span class="permission-owner">Anfitrion</span>'
                    : '<select class="form-control permission-role-select" onchange="syncUpdateMemberRole(\'' + escAttr(uid) + '\', this.value)">' +
                        '<option value="operator"' + (member.role === 'operator' ? ' selected' : '') + '>Operador</option>' +
                        '<option value="viewer"' + (member.role === 'viewer' ? ' selected' : '') + '>Espectador</option>' +
                      '</select>' +
                      '<button class="btn btn-sm btn-danger" onclick="syncRemoveMember(\'' + escAttr(uid) + '\', \'' + escAttr(member.email || '') + '\')">Retirar</button>';
                return '<div class="permission-row"><div><strong>' + escHtml(member.email || uid) + '</strong><small>' + escHtml(roleLabel(member.role)) + (uid === auth.uid ? ' · Tu cuenta' : '') + '</small></div><div>' + controls + '</div></div>';
            }).join('');

            const now = Date.now();
            const inviteRows = Object.keys(invites).filter(function(token) {
                const invite = invites[token];
                return invite && invite.status === 'pending' && (!invite.expiresAt || invite.expiresAt > now);
            }).map(function(token) {
                const invite = invites[token];
                return '<div class="permission-row"><div><strong>' + escHtml(invite.email || '') + '</strong><small>Pendiente · ' + escHtml(roleLabel(invite.role)) + '</small></div><button class="btn btn-sm btn-danger" onclick="syncRevokeInvite(\'' + escAttr(token) + '\')">Revocar</button></div>';
            }).join('');

            showModal(
                '👤 Permisos de la sala ' + syncState.roomId,
                '<div class="permission-create">' +
                    '<label for="permission-email">Correo a invitar</label>' +
                    '<div class="permission-create-row"><input id="permission-email" class="form-control" type="email" placeholder="operador@ejemplo.com">' +
                    '<select id="permission-role" class="form-control"><option value="operator">Operador: puede editar</option><option value="viewer">Espectador: solo lectura</option></select>' +
                    '<button class="btn btn-primary" onclick="syncInviteMember()">Otorgar permiso</button></div>' +
                    '<p class="auth-help">La invitacion vence en 7 dias. El enlace puede enviarse desde tu programa de correo.</p>' +
                '</div>' +
                '<h4>Miembros</h4><div class="permission-list">' + (memberRows || '<p>Sin miembros.</p>') + '</div>' +
                '<h4>Invitaciones pendientes</h4><div class="permission-list">' + (inviteRows || '<p class="auth-help">No hay invitaciones pendientes.</p>') + '</div>',
                null,
                'Cerrar',
                { full: true }
            );
        }).catch(function(error) {
            console.error('[Sync] No se pudieron cargar permisos:', error);
            showToast('No se pudieron cargar los permisos.', 'error');
        });
    };

    document.addEventListener('pingpong-auth-changed', function(event) {
        const state = event.detail || getAuthState();
        if (!state.user) {
            if (syncState.active) disconnect();
            return;
        }
        if (state.verified && !syncState.active) window.syncAutoReconnect();
    });

    if (typeof window.addEventListener === 'function') {
        window.addEventListener('online', function() {
            if (!syncState.active) window.syncAutoReconnect();
        });
    }

    if (typeof window.onLangChange === 'function') {
        window.onLangChange(function() { updateSyncUI(); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            updateSyncUI();
            const auth = getAuthState();
            if (auth.user && auth.verified) window.syncAutoReconnect();
        });
    } else {
        updateSyncUI();
    }
})();
