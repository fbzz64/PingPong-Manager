// ==========================================
// TESTS/I18N.TEST.JS - Consistencia del soporte de idiomas
// ==========================================
// Verifica que los diccionarios EN/PT no tengan claves duplicadas (el último
// valor gana silenciosamente) y que toda clave literal usada con t() en los
// módulos exista traducida en ambos diccionarios (si falta, cae al español).

const fs = require('fs');
const path = require('path');
const { suite, test, assert, assertEqual } = require('./runner');

const ROOT = path.resolve(__dirname, '..');
const I18N_PATH = path.join(ROOT, 'js', 'i18n.js');
const i18nCode = fs.readFileSync(I18N_PATH, 'utf8');

// Excluye el propio i18n.js y share.js (usa t() dinámico solo)
const MODULES = fs.readdirSync(path.join(ROOT, 'js'))
    .filter(f => f.endsWith('.js') && f !== 'i18n.js');

// Extrae las claves de un diccionario preservando el orden y las repeticiones
function dictKeys(name) {
    const m = i18nCode.match(new RegExp('const ' + name + ' = \\{([\\s\\S]*?)\\};'));
    assert(m, name + ' presente en i18n.js');
    const keys = [];
    for (const x of m[1].matchAll(/^\s*'([^']+)':\s*'/gm)) keys.push(x[1]);
    return keys;
}

function duplicatesIn(name) {
    const keys = dictKeys(name);
    const seen = new Set();
    const dups = [];
    for (const k of keys) {
        if (seen.has(k)) dups.push(k);
        seen.add(k);
    }
    return dups;
}

function literalTKeys() {
    const keys = [];
    for (const f of MODULES) {
        const code = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
        for (const m of code.matchAll(/\bt\(\s*'([^']+)'\s*\)/g)) keys.push(m[1]);
    }
    return keys;
}

suite('I18N / IDIOMAS', () => {
    test('I18N_EN sin claves duplicadas', () => {
        const dups = duplicatesIn('I18N_EN');
        assertEqual(dups, [], 'claves duplicadas en I18N_EN: ' + dups.join(', '));
    });

    test('I18N_PT sin claves duplicadas', () => {
        const dups = duplicatesIn('I18N_PT');
        assertEqual(dups, [], 'claves duplicadas en I18N_PT: ' + dups.join(', '));
    });

    test('toda clave literal t() usada en los módulos existe en EN', () => {
        const en = new Set(dictKeys('I18N_EN'));
        const missing = [...new Set(literalTKeys())].filter(k => !en.has(k));
        assertEqual(missing, [], 'claves usadas sin traducción EN: ' + missing.join(', '));
    });

    test('toda clave literal t() usada en los módulos existe en PT', () => {
        const pt = new Set(dictKeys('I18N_PT'));
        const missing = [...new Set(literalTKeys())].filter(k => !pt.has(k));
        assertEqual(missing, [], 'claves usadas sin traducción PT: ' + missing.join(', '));
    });
});
