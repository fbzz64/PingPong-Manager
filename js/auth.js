// ================================================================
// AUTH.JS - Acceso con correo y contrasena mediante Firebase Auth
// ================================================================

(function() {
    'use strict';

    let authService = null;
    let authInitPromise = null;
    let authState = {
        ready: false,
        configured: false,
        online: navigator.onLine !== false,
        user: null,
        verified: false
    };

    const ERROR_MESSAGES = {
        'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Inicia sesion.',
        'auth/invalid-email': 'El correo electronico no es valido.',
        'auth/invalid-credential': 'Correo o contrasena incorrectos.',
        'auth/user-disabled': 'Esta cuenta fue deshabilitada.',
        'auth/user-not-found': 'No existe una cuenta con ese correo.',
        'auth/wrong-password': 'Correo o contrasena incorrectos.',
        'auth/weak-password': 'La contrasena debe tener al menos 6 caracteres.',
        'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
        'auth/network-request-failed': 'No hay conexion con Firebase. La gestion local sigue disponible.',
        'auth/requires-recent-login': 'Por seguridad, cierra sesion y vuelve a ingresar.'
    };

    function authMessage(error) {
        if (!error) return 'No se pudo completar la operacion.';
        return ERROR_MESSAGES[error.code] || error.message || 'No se pudo completar la operacion.';
    }

    function emitAuthChange() {
        updateAuthUI();
        if (typeof window.CustomEvent === 'function') {
            document.dispatchEvent(new CustomEvent('pingpong-auth-changed', {
                detail: window.authGetState()
            }));
        }
    }

    function initAuth() {
        if (authInitPromise) return authInitPromise;

        authState.configured = Boolean(window.PingPongFirebase && window.PingPongFirebase.isConfigured());
        if (!authState.configured) {
            authState.ready = true;
            updateAuthUI();
            return Promise.resolve(null);
        }

        authInitPromise = window.PingPongFirebase.ready().then(function(services) {
            authService = services.auth;
            authService.useDeviceLanguage();
            authService.onAuthStateChanged(function(user) {
                authState.ready = true;
                authState.user = user || null;
                authState.verified = Boolean(user && user.emailVerified);
                emitAuthChange();
            });
            return authService;
        }).catch(function(error) {
            authState.ready = true;
            authState.online = false;
            authInitPromise = null;
            updateAuthUI();
            console.warn('[Auth] Firebase no disponible:', error.message || error);
            return null;
        });

        return authInitPromise;
    }

    function updateAuthUI() {
        const container = document.getElementById('auth-controls');
        if (!container) return;

        if (!authState.configured) {
            container.innerHTML = '<button class="auth-button auth-button--setup" onclick="showAuthModal()" title="Firebase pendiente de configurar">⚙️ Configurar acceso</button>';
            return;
        }

        if (!authState.ready) {
            container.innerHTML = '<span class="auth-status">⏳ Conectando…</span>';
            return;
        }

        if (!authState.user) {
            container.innerHTML = '<button class="auth-button" onclick="showAuthModal()">🔐 Ingresar</button>';
            return;
        }

        const verifiedMark = authState.verified ? '✅' : '⚠️';
        container.innerHTML =
            '<button class="auth-button auth-button--user" onclick="showAccountModal()" title="Administrar cuenta">' +
                verifiedMark + ' <span>' + escHtml(authState.user.email || 'Cuenta') + '</span>' +
            '</button>';
    }

    function requireFields(email, password) {
        const normalizedEmail = String(email || '').trim();
        if (!normalizedEmail || normalizedEmail.indexOf('@') < 1) {
            showToast('Ingresa un correo electronico valido.', 'warning');
            return null;
        }
        if (!password || String(password).length < 6) {
            showToast('La contrasena debe tener al menos 6 caracteres.', 'warning');
            return null;
        }
        return { email: normalizedEmail, password: String(password) };
    }

    window.authGetState = function() {
        return {
            ready: authState.ready,
            configured: authState.configured,
            online: authState.online,
            user: authState.user,
            verified: authState.verified,
            uid: authState.user ? authState.user.uid : null,
            email: authState.user ? authState.user.email : null
        };
    };

    window.authEnsureReady = function() {
        return initAuth().then(function() {
            if (!authState.configured) throw new Error('FIREBASE_NOT_CONFIGURED');
            if (!authService) throw new Error('FIREBASE_UNAVAILABLE');
            return authService;
        });
    };

    window.authRequireVerified = function() {
        if (!authState.configured) {
            showToast('Firebase aun no esta configurado.', 'warning');
            showAuthModal();
            return false;
        }
        if (!authState.user) {
            showToast('Inicia sesion para sincronizar el torneo.', 'warning');
            showAuthModal();
            return false;
        }
        if (!authState.verified) {
            showToast('Verifica tu correo antes de usar la sincronizacion.', 'warning');
            showAccountModal();
            return false;
        }
        return true;
    };

    window.showAuthModal = function(mode) {
        mode = mode === 'register' ? 'register' : 'login';

        if (!window.PingPongFirebase || !window.PingPongFirebase.isConfigured()) {
            showModal(
                '🔥 Configurar Firebase',
                '<div class="auth-modal-copy">' +
                    '<p>El acceso seguro todavia no esta conectado. Completa la configuracion del proyecto Firebase y pega el objeto web en <code>js/firebase-config.js</code>.</p>' +
                    '<p class="auth-help">La app local puede seguir usandose sin cuenta, pero la sincronizacion y los permisos permaneceran desactivados.</p>' +
                '</div>',
                null,
                'Cerrar'
            );
            return;
        }

        const registering = mode === 'register';
        showModal(
            registering ? 'Crear cuenta' : 'Ingresar',
            '<form class="auth-form" onsubmit="event.preventDefault(); ' + (registering ? 'authRegisterFromModal()' : 'authSignInFromModal()') + ';">' +
                '<label for="auth-email">Correo electronico</label>' +
                '<input class="form-control" id="auth-email" type="email" autocomplete="email" required>' +
                '<label for="auth-password">Contrasena</label>' +
                '<input class="form-control" id="auth-password" type="password" autocomplete="' + (registering ? 'new-password' : 'current-password') + '" minlength="6" required>' +
                '<button class="btn btn-primary" id="auth-submit" type="submit">' + (registering ? 'Crear cuenta' : 'Ingresar') + '</button>' +
            '</form>' +
            '<div class="auth-modal-actions">' +
                (registering
                    ? '<button class="btn btn-info" onclick="showAuthModal(\'login\')">Ya tengo cuenta</button>'
                    : '<button class="btn btn-info" onclick="showAuthModal(\'register\')">Crear cuenta</button>' +
                      '<button class="btn btn-link" onclick="authResetFromModal()">Olvide mi contrasena</button>') +
            '</div>' +
            '<p class="auth-help">Para recibir permisos de un torneo debes usar el mismo correo que invito el organizador.</p>',
            null,
            'Cerrar'
        );
        setTimeout(function() {
            const email = document.getElementById('auth-email');
            if (email) email.focus();
        }, 0);
    };

    window.authSignInFromModal = function() {
        const emailEl = document.getElementById('auth-email');
        const passwordEl = document.getElementById('auth-password');
        const values = requireFields(emailEl && emailEl.value, passwordEl && passwordEl.value);
        if (!values) return;

        const submit = document.getElementById('auth-submit');
        if (submit) submit.disabled = true;
        window.authEnsureReady()
            .then(function(auth) { return auth.signInWithEmailAndPassword(values.email, values.password); })
            .then(function() {
                closeModal();
                showToast('Sesion iniciada correctamente.');
            })
            .catch(function(error) { showToast(authMessage(error), 'error'); })
            .finally(function() { if (submit) submit.disabled = false; });
    };

    window.authRegisterFromModal = function() {
        const emailEl = document.getElementById('auth-email');
        const passwordEl = document.getElementById('auth-password');
        const values = requireFields(emailEl && emailEl.value, passwordEl && passwordEl.value);
        if (!values) return;

        const submit = document.getElementById('auth-submit');
        if (submit) submit.disabled = true;
        window.authEnsureReady()
            .then(function(auth) { return auth.createUserWithEmailAndPassword(values.email, values.password); })
            .then(function(credential) { return credential.user.sendEmailVerification(); })
            .then(function() {
                closeModal();
                showToast('Cuenta creada. Revisa tu correo para verificarla.', 'success');
                showAccountModal();
            })
            .catch(function(error) { showToast(authMessage(error), 'error'); })
            .finally(function() { if (submit) submit.disabled = false; });
    };

    window.authResetFromModal = function() {
        const emailEl = document.getElementById('auth-email');
        const email = String(emailEl && emailEl.value || '').trim();
        if (!email) {
            showToast('Escribe primero el correo de la cuenta.', 'warning');
            if (emailEl) emailEl.focus();
            return;
        }
        window.authEnsureReady()
            .then(function(auth) { return auth.sendPasswordResetEmail(email); })
            .then(function() { showToast('Te enviamos el enlace para restablecer la contrasena.'); })
            .catch(function(error) { showToast(authMessage(error), 'error'); });
    };

    window.showAccountModal = function() {
        if (!authState.user) {
            showAuthModal();
            return;
        }
        const verification = authState.verified
            ? '<div class="alert alert-success">✅ Correo verificado</div>'
            : '<div class="alert alert-warning">⚠️ Debes verificar el correo para sincronizar y aceptar permisos.</div>' +
              '<button class="btn btn-warning" onclick="authResendVerification()">Reenviar verificacion</button>';
        showModal(
            'Mi cuenta',
            '<div class="account-summary"><strong>' + escHtml(authState.user.email || '') + '</strong>' + verification + '</div>' +
            '<div class="auth-modal-actions">' +
                '<button class="btn btn-info" onclick="authReloadUser()">Actualizar estado</button>' +
                '<button class="btn btn-danger" onclick="authSignOut()">Cerrar sesion</button>' +
            '</div>',
            null,
            'Cerrar'
        );
    };

    window.authResendVerification = function() {
        if (!authState.user) return;
        authState.user.sendEmailVerification()
            .then(function() { showToast('Correo de verificacion enviado.'); })
            .catch(function(error) { showToast(authMessage(error), 'error'); });
    };

    window.authReloadUser = function() {
        if (!authState.user) return;
        authState.user.reload().then(function() {
            authState.user = authService.currentUser;
            authState.verified = Boolean(authState.user && authState.user.emailVerified);
            emitAuthChange();
            closeModal();
            showToast(authState.verified ? 'Correo verificado correctamente.' : 'El correo aun no figura como verificado.', authState.verified ? 'success' : 'warning');
        }).catch(function(error) { showToast(authMessage(error), 'error'); });
    };

    window.authSignOut = function() {
        if (!authService) return;
        authService.signOut().then(function() {
            closeModal();
            showToast('Sesion cerrada.');
        }).catch(function(error) { showToast(authMessage(error), 'error'); });
    };

    window.addEventListener('online', function() {
        authState.online = true;
        if (authState.configured && !authService) initAuth();
    });
    window.addEventListener('offline', function() {
        authState.online = false;
        updateAuthUI();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            updateAuthUI();
            initAuth();
        });
    } else {
        updateAuthUI();
        initAuth();
    }
})();

