// ================================================================
// TESTS/SECURITY.TEST.JS - Contratos de configuracion y reglas Firebase
// ================================================================

const fs = require('fs');
const path = require('path');
const { suite, test, assert, assertEqual } = require('./runner');
const { createEnv, loadInto } = require('./env');

const ROOT = path.resolve(__dirname, '..');
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8')).rules;

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
});

