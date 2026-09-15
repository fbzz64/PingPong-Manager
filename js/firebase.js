// ================================================================
// FIREBASE.JS - Carga e inicializacion compartida de Firebase
// ================================================================
// Mantiene el funcionamiento offline: el SDK solo se descarga cuando existe
// una configuracion real y cualquier fallo de red se informa sin bloquear la
// gestion local del torneo.

(function() {
    'use strict';

    const SDK_VERSION = '12.19.0';
    const SDK_BASE = 'https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/';
    const SDK_FILES = [
        'firebase-app-compat.js',
        'firebase-auth-compat.js',
        'firebase-database-compat.js'
    ];

    let servicesPromise = null;

    function getConfig() {
        return window.PINGPONG_FIREBASE_CONFIG || {};
    }

    function isConfigured() {
        const config = getConfig();
        return Boolean(
            config.apiKey &&
            config.projectId &&
            config.appId &&
            config.databaseURL &&
            config.apiKey !== 'TU_API_KEY' &&
            config.projectId !== 'TU_PROYECTO' &&
            config.databaseURL.indexOf('TU_PROYECTO') === -1
        );
    }

    function loadScript(file) {
        return new Promise(function(resolve, reject) {
            const existing = document.querySelector('script[data-firebase-sdk="' + file + '"]');
            if (existing) {
                if (existing.dataset.loaded === 'true') resolve();
                else {
                    existing.addEventListener('load', resolve, { once: true });
                    existing.addEventListener('error', reject, { once: true });
                }
                return;
            }

            const script = document.createElement('script');
            script.src = SDK_BASE + file;
            script.async = true;
            script.dataset.firebaseSdk = file;
            script.onload = function() {
                script.dataset.loaded = 'true';
                resolve();
            };
            script.onerror = function() {
                reject(new Error('No se pudo cargar ' + file));
            };
            document.head.appendChild(script);
        });
    }

    function loadSdk() {
        if (typeof window.firebase !== 'undefined' &&
            typeof window.firebase.auth === 'function' &&
            typeof window.firebase.database === 'function') {
            return Promise.resolve();
        }

        return SDK_FILES.reduce(function(chain, file) {
            return chain.then(function() { return loadScript(file); });
        }, Promise.resolve());
    }

    function ready() {
        if (!isConfigured()) {
            return Promise.reject(new Error('FIREBASE_NOT_CONFIGURED'));
        }
        if (servicesPromise) return servicesPromise;

        servicesPromise = loadSdk().then(function() {
            const app = window.firebase.apps && window.firebase.apps.length
                ? window.firebase.apps[0]
                : window.firebase.initializeApp(getConfig());
            return {
                app: app,
                auth: window.firebase.auth(app),
                db: window.firebase.database(app)
            };
        }).catch(function(error) {
            // Permitir un nuevo intento si la carga fallo por estar offline.
            servicesPromise = null;
            throw error;
        });

        return servicesPromise;
    }

    window.PingPongFirebase = Object.freeze({
        sdkVersion: SDK_VERSION,
        getConfig: getConfig,
        isConfigured: isConfigured,
        ready: ready
    });
})();
