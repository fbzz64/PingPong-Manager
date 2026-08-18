// ==========================================
// TESTS/SHARE.TEST.JS - Compartir/copiar (js/share.js)
// ==========================================

const { suite, test, assert, assertEqual } = require('./runner');
const { loadApp } = require('./env');

suite('SHARE (share.js)', () => {
    const env = loadApp(['js/share.js']);
    const S = env.sandbox;

    // Stubs de DOM para el camino de respaldo (textarea + execCommand).
    function stubFallbackDom(execResult) {
        const doc = S.document;
        doc.createElement = (tag) => {
            const el = { tag, value: '', style: {} };
            el.focus = () => {};
            el.select = () => {};
            return el;
        };
        doc.body.appendChild = () => {};
        doc.body.removeChild = () => {};
        doc.execCommand = () => execResult;
        return doc;
    }

    // shareText/shareFileBlob llaman showToast dentro de un .then() de
    // copyText: drena las microtasks para que el toast ya esté seteado.
    async function flushPromises() {
        for (let i = 0; i < 5; i++) await Promise.resolve();
    }

    test('copyText: copia vía navigator.clipboard', async () => {
        let copied = null;
        S.navigator.clipboard = { writeText: (t) => { copied = t; return Promise.resolve(); } };
        const ok = await S.copyText('hola mundo');
        assertEqual(ok, true, 'resuelve true');
        assertEqual(copied, 'hola mundo', 'texto enviado al clipboard');
    });

    test('copyText: sin clipboard usa fallback execCommand', async () => {
        let execCalled = null, appended = null, removed = null, selected = null, focused = null;
        const doc = S.document;
        doc.createElement = (tag) => {
            const el = { tag, value: '', style: {} };
            el.focus = () => { focused = true; };
            el.select = () => { selected = el.value; };
            return el;
        };
        doc.body.appendChild = (el) => { appended = el; };
        doc.body.removeChild = (el) => { removed = el; };
        doc.execCommand = (cmd) => { execCalled = cmd; return true; };
        S.navigator.clipboard = undefined;

        const ok = await S.copyText('texto');
        assertEqual(ok, true, 'resuelve true');
        assertEqual(execCalled, 'copy', 'usa execCommand("copy")');
        assertEqual(appended.value, 'texto', 'textarea con el texto');
        assertEqual(selected, 'texto', 'selecciona el texto');
        assertEqual(focused, true, 'foca el textarea');
        assertEqual(appended, removed, 'remueve el textarea');
    });

    test('fallbackCopy: devuelve false si execCommand falla o lanza', () => {
        stubFallbackDom(false);
        assertEqual(S.fallbackCopy('x'), false, 'execCommand false');

        const doc = S.document;
        doc.execCommand = () => { throw new Error('boom'); };
        assertEqual(S.fallbackCopy('x'), false, 'excepción capturada');
    });

    test('shareText: usa Web Share API si está disponible', async () => {
        let shared = null;
        S.navigator.share = (data) => { shared = data; return Promise.resolve(); };
        await S.shareText('resumen', 'Título');
        assertEqual(shared.title, 'Título');
        assertEqual(shared.text, 'resumen');
    });

    test('shareText: sin Web Share API copia al portapapeles y avisa', async () => {
        let toast = null, copied = null;
        S.navigator.share = undefined;
        S.navigator.clipboard = { writeText: (t) => { copied = t; return Promise.resolve(); } };
        S.showToast = (m, type) => { toast = { m, type }; };
        await S.shareText('hola', 'T');
        await flushPromises();
        assertEqual(copied, 'hola', 'copia el texto');
        assert(toast && toast.m.includes('copiado'), 'toast de éxito: ' + (toast && toast.m));
    });

    test('shareText: avisa error si no se pudo copiar', async () => {
        let toast = null;
        S.navigator.share = undefined;
        S.navigator.clipboard = { writeText: () => Promise.reject(new Error('no')) };
        stubFallbackDom(false);
        S.showToast = (m, type) => { toast = { m, type }; };
        await S.shareText('x', 'T');
        await flushPromises();
        assertEqual(toast.m, 'No se pudo copiar el texto');
        assertEqual(toast.type, 'error');
    });

    test('shareFileBlob: usa Web Share API con archivo si está disponible', async () => {
        let shared = null;
        S.navigator.share = (data) => { shared = data; return Promise.resolve(); };
        S.navigator.canShare = () => true;
        await S.shareFileBlob({ parts: [] }, 'planilla.pdf', 'msg');
        assert(shared, 'comparte el archivo');
        assertEqual(shared.files.length, 1, 'un archivo');
        assertEqual(shared.files[0].name, 'planilla.pdf', 'nombre del archivo');
        assertEqual(shared.text, 'msg', 'mensaje adjunto');
    });

    test('shareFileBlob: sin Web Share descarga y copia el mensaje', async () => {
        let toast = null, copied = null, anchor = null, clicks = 0;
        S.navigator.share = undefined;
        S.navigator.clipboard = { writeText: (t) => { copied = t; return Promise.resolve(); } };
        S.showToast = (m) => { toast = m; };
        const doc = S.document;
        doc.createElement = (tag) => {
            if (tag === 'a') {
                anchor = { style: {}, href: '', download: '', click: () => { clicks++; } };
                return anchor;
            }
            return { tag, value: '', style: {}, focus: () => {}, select: () => {} };
        };
        doc.body.appendChild = () => {};
        doc.body.removeChild = () => {};

        await S.shareFileBlob({ parts: [] }, 'planilla.pdf', 'Resultados');
        await flushPromises();
        assertEqual(clicks, 1, 'se dispara el clic de descarga');
        assertEqual(anchor.download, 'planilla.pdf', 'nombre de archivo');
        assertEqual(anchor.href, 'blob:test', 'URL del blob');
        assertEqual(copied, 'Resultados', 'mensaje copiado');
        assert(toast && toast.includes('descargado'), 'toast de descarga: ' + toast);
    });

    test('shareToWhatsApp: abre wa.me con el texto codificado', () => {
        let openedUrl = null;
        S.window.open = (url) => { openedUrl = url; return {}; };
        let toast = null;
        S.showToast = (m) => { toast = m; };
        S.shareToWhatsApp('Hola ¿Cómo estás?');
        assert(openedUrl, 'abre una ventana');
        assertEqual(openedUrl, 'https://wa.me/?text=Hola%20%C2%BFC%C3%B3mo%20est%C3%A1s%3F', 'URL con texto codificado');
        assert(toast && toast.includes('WhatsApp'), 'toast informativo');
    });
});
