// ================================================================
// TESTS/SECURITY.TEST.JS - Contratos de configuracion y reglas Firebase
// ================================================================

const fs = require('fs');
const path = require('path');
const { suite, test, assert, assertEqual } = require('./runner');
const { createEnv, loadInto } = require('./env');

const ROOT = path.resolve(__dirname, '..');
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8')).rules;
const authSource = fs.readFileSync(path.join(ROOT, 'js/auth.js'), 'utf8');
const syncSource = fs.readFileSync(path.join(ROOT, 'js/sync.js'), 'utf8');
const swSource = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

suite('SEGURIDAD FIREBASE', () => {
    test('la raiz niega lectura y escritura por defecto', () => {
        assertEqual(rules['.read'], false, 'lectura global cerrada');
        assertEqual(rules['.write'], false, 'escritura global cerrada');
    });

    test('los datos del torneo exigen cuenta verificada y rol de edicion', () => {
        const writeRule = rules.torneos.$roomId.data['.write'];
        assert(/email_verified/.test(writeRule), 'exige correo verificado');
        assert(/owner/.test(writeRule), 'acepta anfitrion');
        assert(/operator/.test(writeRule), 'acepta operador');
        assert(!/viewer/.test(writeRule), 'espectador no escribe');
    });

    test('las invitaciones se atan al correo autenticado y vencen', () => {
        const invite = rules.torneos.$roomId.invites.$token;
        const memberWrite = rules.torneos.$roomId.members.$uid['.write'];
        assert(/auth\.token\.email/.test(invite['.read']), 'lectura por mismo correo');
        assert(/expiresAt/.test(invite['.write']), 'reclamo comprueba vencimiento');
        assert(/inviteToken/.test(memberWrite), 'membresia exige token');
        assert(/status.*pending/.test(memberWrite), 'token pendiente');
    });

    test('la configuracion de ejemplo no inicializa Firebase', () => {
        const env = createEnv();
        loadInto(env, 'js/firebase-config.js');
        loadInto(env, 'js/firebase.js');
        assertEqual(env.sandbox.PingPongFirebase.isConfigured(), false, 'marcadores detectados');
    });

    test('Firebase exige authDomain y una configuracion completa', () => {
        const env = createEnv({
            PINGPONG_FIREBASE_CONFIG: {
                apiKey: 'publica',
                projectId: 'pingpong-test',
                appId: '1:123:web:abc',
                databaseURL: 'https://pingpong-test.firebaseio.com'
            }
        });
        loadInto(env, 'js/firebase.js');
        assertEqual(env.sandbox.PingPongFirebase.isConfigured(), false, 'sin authDomain no inicia');
    });

    test('al verificar el correo se renueva el token usado por las Rules', () => {
        assert(/getIdToken\(true\)/.test(authSource), 'fuerza la renovacion del ID token');
        assert(/trim\(\)\.toLowerCase\(\)/.test(authSource), 'normaliza correos para invitaciones');
    });

    test('un reclamo de invitacion fallido no se ejecuta dos veces', () => {
        const memberFlow = syncSource.slice(
            syncSource.indexOf('function findOrClaimMember'),
            syncSource.indexOf('function joinRoomAsync')
        );
        assert(/PERMISSION_DENIED/.test(memberFlow), 'solo reclama ante lectura denegada del miembro');
        assert(!/\.catch\s*\(/.test(memberFlow), 'no captura y reintenta errores del propio reclamo');
    });

    test('la PWA actualiza firebase-config con prioridad de red', () => {
        assert(/firebase-config\.js/.test(swSource), 'config incluida en el service worker');
        assert(/pathname\.endsWith\('\/js\/firebase-config\.js'\)[\s\S]*fetch\(request\)[\s\S]*caches\.match\(request\)/.test(swSource), 'network-first con fallback local');
    });
});
