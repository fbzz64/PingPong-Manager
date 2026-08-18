// ==========================================
// TESTS/RUNNER.JS - Framework mínimo de tests (sin dependencias)
// ==========================================
// Uso: los archivos tests/*.test.js declaran suites con suite()/test() y
// assert()/assertEqual(). run-tests.js los carga y llama run().
// ==========================================

let suites = [];
let current = null;

function suite(name, fn) {
    current = { name, tests: [] };
    fn();
    suites.push(current);
    current = null;
}

function test(name, fn) {
    if (!current) throw new Error('test() debe usarse dentro de suite()');
    current.tests.push({ name, fn });
}

function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) {
        throw new Error((msg || 'assertEqual falló') + '\n    actual:   ' + a + '\n    expected: ' + b);
    }
}

function assertClose(actual, expected, epsilon, msg) {
    if (typeof epsilon === 'string') { msg = epsilon; epsilon = 1e-9; }
    if (typeof epsilon !== 'number') epsilon = 1e-9;
    if (Math.abs(actual - expected) > epsilon) {
        throw new Error((msg || 'assertClose falló') + '\n    actual:   ' + actual + '\n    expected: ' + expected + ' (±' + epsilon + ')');
    }
}

async function run() {
    let passed = 0;
    let failed = 0;
    for (const s of suites) {
        console.log('\n== ' + s.name + ' ==');
        for (const t of s.tests) {
            try {
                await t.fn();
                passed++;
                console.log('  OK  ' + t.name);
            } catch (e) {
                failed++;
                console.log('  FALLO  ' + t.name);
                console.log('        ' + String(e.message || e).split('\n').join('\n        '));
            }
        }
    }
    console.log('\nTotal: ' + passed + ' pasaron, ' + failed + ' fallaron');
    if (typeof process !== 'undefined') process.exitCode = failed ? 1 : 0;
    return failed === 0;
}

module.exports = { suite, test, assert, assertEqual, assertClose, run };
