// ==========================================
// QR.JS - Códigos QR de jugadores para acreditación
// ==========================================
// Genera un QR por jugador (código acreditación) y permite escanearlo con la
// cámara para marcarlo presente automáticamente. La generación usa la librería
// local lib/qrcode.min.js (MIT); el escaneo usa BarcodeDetector si el
// navegador lo soporta, con búsqueda manual como respaldo.
// ==========================================

const QR_PREFIX = 'TTM-PLAYER|';

let qrScanStream = null;
let qrScanning = false;

/**
 * Arma el payload del QR de un jugador.
 * Formato: TTM-PLAYER|Nombre|Club|Licencia
 * @param {Object} player
 * @returns {string}
 */
window.buildPlayerQRPayload = function(player) {
    const name = String((player && player.name) || '').trim();
    const club = String((player && player.club) || '').trim();
    return QR_PREFIX + [name, club, (player && player.licencia) || ''].join('|');
};

/**
 * Busca un jugador en la base a partir del texto escaneado.
 * @param {string} text
 * @returns {{ index: number, player: Object }|null}
 */
window.findPlayerByQR = function(text) {
    const s = String(text || '').trim();
    if (s.indexOf(QR_PREFIX) !== 0) return null;
    const parts = s.slice(QR_PREFIX.length).split('|');
    const name = parts[0] || '';
    const club = parts[1] || '';

    const idx = (tournamentData.players || []).findIndex(p =>
        p.name === name && p.club === club
    );
    if (idx < 0) return null;
    return { index: idx, player: tournamentData.players[idx] };
};

/**
 * Marca a un jugador como presente (check-in) si aún no lo estaba.
 * @param {number} index
 */
window.markPlayerCheckedIn = function(index) {
    const player = tournamentData.players[index];
    if (!player) return;
    const wasPresent = player.checkin;
    player.checkin = true;
    saveTournamentData();
    if (!wasPresent) {
        addLog('CHECK-IN QR', `${player.name} (${player.club}) acreditado por QR`);
        showToast(`✅ ${player.name} acreditado por QR`);
    }
    if (typeof showAllPlayers === 'function') showAllPlayers();
};

/**
 * Genera una imagen DataURL del QR de un jugador.
 * @param {string} payload
 * @param {number} cellSize
 * @returns {string|null}
 */
window.qrDataURL = function(payload, cellSize) {
    if (typeof qrcode !== 'function') return null;
    try {
        // Asegurar codificación UTF-8 para que los acentos/ñ se lean bien al escanear
        if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
            qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
        }
        const qr = qrcode(0, 'M');
        qr.addData(String(payload));
        qr.make();
        return qr.createDataURL(cellSize || 8, 4);
    } catch (e) {
        console.error('Error generando QR:', e);
        return null;
    }
};

/**
 * Genera una planilla imprimible de acreditación: todos los QR de los
 * jugadores en una cuadrícula, lista para el día del torneo.
 */
window.printAccreditationSheet = function() {
    const players = (tournamentData.players || []).filter(p =>
        p.name && p.name !== '-' && p.club !== '-' && p.name !== '- -' && p.club !== '- -'
    );

    if (players.length === 0) {
        showToast(t('No hay jugadores para acreditar'), 'warning');
        return;
    }
    if (typeof qrcode !== 'function') {
        showToast(t('No se pudo generar la planilla (librería QR no disponible)'), 'error');
        return;
    }

    const torneoNombre = (tournamentData.settings && tournamentData.settings.torneoNombre) || '';
    const subtitulo = (tournamentData.settings && tournamentData.settings.subtitulo) || '';

    // Cada jugador: tarjeta con QR, nombre, club y categorías.
    const cards = players.map(p => {
        const payload = window.buildPlayerQRPayload(p);
        const dataUrl = window.qrDataURL(payload, 4);
        const cats = (p.categories || []).filter(Boolean).join(', ');
        return `
            <div class="qr-card">
                <div class="qr-img">${dataUrl ? '<img src="' + dataUrl + '" width="110" height="110" alt="QR">' : '<span style="color:#999;">QR no disponible</span>'}</div>
                <div class="qr-name">${escHtml(p.name)}</div>
                <div class="qr-club">${escHtml(p.club)}</div>
                ${cats ? '<div class="qr-cats">' + escHtml(cats) + '</div>' : ''}
            </div>`;
    }).join('');

    const now = new Date();
    const fecha = now.toLocaleDateString(window.i18nLocale(), { year: 'numeric', month: 'long', day: 'numeric' });

    let printWindow;
    try {
        printWindow = window.open('', '_blank');
    } catch (e) {
        printWindow = null;
    }
    if (!printWindow) {
        showToast(t('El navegador bloqueó la ventana de impresión. Permití los popups para este sitio.'), 'error');
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${t('Planilla de Acreditación')}</title>
            <style>
                * { -webkit-print-color-adjust: exact; color-adjust: exact; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 15px; background: #fff; color: #000; }
                .print-header { text-align: center; padding: 10px 15px; background: white; border: 2px solid #007BFF; border-radius: 8px; margin: 0 0 15px 0; }
                .print-header h1 { margin: 0 0 3px 0; font-size: 20px; color: #333; }
                .print-header p { margin: 0; font-size: 13px; color: #666; }
                .qr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
                .qr-card { border: 1px solid #ccc; border-radius: 8px; padding: 10px; text-align: center; page-break-inside: avoid; background: #fff; }
                .qr-img { background: #fff; display: inline-block; padding: 4px; }
                .qr-name { font-weight: bold; font-size: 12px; margin-top: 6px; word-wrap: break-word; }
                .qr-club { font-size: 10px; color: #555; }
                .qr-cats { font-size: 10px; color: #007BFF; margin-top: 2px; }
                @media print {
                    @page { size: A4; margin: 8mm; }
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <h1>${escHtml(torneoNombre)}</h1>
                <p>${escHtml(subtitulo)} · ${t('Planilla de Acreditación')} · ${escHtml(fecha)} · ${players.length} ${t('jugadores')}</p>
            </div>
            <div class="qr-grid">${cards}</div>
            <script>window.onload = function() { window.print(); }<\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
    addLog('QR', t('Planilla de acreditación generada:') + ` ${players.length} ` + t('jugadores'));
};
window.showPlayerQR = function(index) {
    const player = tournamentData.players[index];
    if (!player) return;

    const payload = window.buildPlayerQRPayload(player);
    const dataUrl = window.qrDataURL(payload, 8);

    if (!dataUrl) {
        showToast('No se pudo generar el QR (librería no disponible)', 'error');
        return;
    }

    showModal(
        '📱 Código QR de Acreditación',
        '<div style="color: var(--text-color); text-align: center;">' +
            '<div style="margin-bottom: 12px;">' +
                '<h2 style="margin: 0;">' + escHtml(player.name) + '</h2>' +
                '<span style="color: var(--text-muted);">' + escHtml(player.club) + '</span>' +
                (player.licencia ? '<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">🎫 Licencia: ' + escHtml(player.licencia) + '</div>' : '') +
            '</div>' +
            '<div style="display: inline-block; background: #fff; border-radius: 12px; padding: 10px;">' +
                '<img src="' + dataUrl + '" width="220" height="220" alt="QR de ' + escHtml(player.name) + '">' +
            '</div>' +
            '<p style="font-size: 12px; color: var(--text-muted); margin: 12px 0 0 0;">Escaneá este código en acreditación para marcar la presencia automáticamente.</p>' +
        '</div>',
        function() {
            closeModal();
            showPlayerProfile(index);
        },
        '👤 Ver perfil'
    );
    addLog('QR', `QR de acreditación generado para ${player.name} (${player.club})`);
};

// ==========================================
// ESCANEO DE QR (cámara)
// ==========================================

/**
 * Detiene la cámara y el bucle de escaneo.
 */
function qrStopScanning() {
    qrScanning = false;
    if (qrScanStream) {
        qrScanStream.getTracks().forEach(t => t.stop());
        qrScanStream = null;
    }
}

/**
 * Procesa un código escaneado: busca al jugador y lo acredita.
 * @param {string} text
 * @param {boolean} alreadyScanned - para no repetir toasts en el mismo escaneo
 */
function qrHandleScannedText(text, alreadyScanned) {
    const found = window.findPlayerByQR(text);
    const status = document.getElementById('qr-scan-status');
    if (!found) {
        if (status) status.innerHTML = '<div class="warn-box" style="margin: 10px 0;">❌ QR no reconocido: no hay ningún jugador con esos datos.</div>';
        return false;
    }
    window.markPlayerCheckedIn(found.index);
    if (status) {
        const p = found.player;
        status.innerHTML = '<div class="info-box" style="margin: 10px 0;">✅ <strong>' + escHtml(p.name) + '</strong> (' + escHtml(p.club) + ') acreditado.</div>';
    }
    qrStopScanning();
    const again = document.getElementById('qr-scan-again');
    if (again) again.style.display = 'inline-flex';
    return true;
}

/**
 * Bucle de detección con BarcodeDetector.
 */
async function qrScanLoop(detector, video) {
    while (qrScanning) {
        if (video.readyState >= 2 && video.videoWidth > 0) {
            try {
                const codes = await detector.detect(video);
                if (codes && codes.length > 0 && codes[0].rawValue) {
                    qrHandleScannedText(codes[0].rawValue, true);
                    break;
                }
            } catch (e) { /* frame sin lectura */ }
        }
        await new Promise(r => setTimeout(r, 400));
    }
}

/**
 * Abre el escáner QR con la cámara (o búsqueda manual si no está disponible).
 */
window.scanPlayerQR = function() {
    const players = (tournamentData.players || []).filter(p => p.name && p.name !== '-' && p.club !== '-');
    if (players.length === 0) {
        showToast('No hay jugadores para acreditar', 'warning');
        return;
    }

    const supportsCamera = typeof window.BarcodeDetector === 'function' &&
        typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';

    const content = '<div style="color: var(--text-color);">' +
        '<p style="font-size: 13px; color: var(--text-muted); margin: 0 0 10px 0;">Apuntá la cámara al QR del jugador para marcarlo presente automáticamente.</p>' +
        '<div id="qr-scan-status"></div>' +
        (supportsCamera
            ? '<video id="qr-video" playsinline muted style="width: 100%; max-height: 320px; border-radius: 10px; background: #000;"></video>' +
              '<div style="margin-top: 10px; text-align: center;">' +
                '<button class="btn btn-primary" id="qr-scan-again" style="display: none;" onclick="qrResumeScanning()">🔁 Escanear otro</button>' +
              '</div>' +
              '<p style="font-size: 12px; color: var(--text-muted); margin: 8px 0 0 0;">💡 El QR se detecta solo; no hace falta sacar una foto.</p>'
            : '<div class="warn-box" style="margin: 10px 0;">📷 Cámara no disponible en este navegador. Buscá al jugador manualmente:</div>' +
              '<input type="text" id="qr-manual-search" placeholder="Escribí el nombre del jugador..." oninput="qrManualSearch()" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">' +
              '<div id="qr-manual-results" style="margin-top: 8px;"></div>') +
    '</div>';

    window.__qrOnModalClose = qrStopScanning;

    showModal(
        '📷 Escanear QR de Jugador',
        content,
        qrStopScanning,
        'Cerrar'
    );

    if (!supportsCamera) {
        qrManualSearch();
        return;
    }

    qrStartCamera();
};

/**
 * Inicia la cámara y el bucle de detección.
 */
async function qrStartCamera() {
    const video = document.getElementById('qr-video');
    if (!video) return;
    try {
        qrScanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = qrScanStream;
        await video.play();
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        qrScanning = true;
        qrScanLoop(detector, video);
    } catch (e) {
        const status = document.getElementById('qr-scan-status');
        if (status) status.innerHTML = '<div class="warn-box" style="margin: 10px 0;">⚠️ No se pudo abrir la cámara (' + String(e && e.name || e) + '). Probá con el navegador Edge/Chrome o permití el acceso a la cámara.</div>';
        qrStopScanning();
    }
}

/**
 * Reanuda el escaneo tras una lectura exitosa.
 */
window.qrResumeScanning = function() {
    const again = document.getElementById('qr-scan-again');
    if (again) again.style.display = 'none';
    const status = document.getElementById('qr-scan-status');
    if (status) status.innerHTML = '';
    qrStartCamera();
};

/**
 * Búsqueda manual de jugador (respaldo sin cámara).
 */
window.qrManualSearch = function() {
    const input = document.getElementById('qr-manual-search');
    const results = document.getElementById('qr-manual-results');
    if (!input || !results) return;
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) {
        results.innerHTML = '';
        return;
    }
    const matches = (tournamentData.players || []).filter(p =>
        p.name && p.name !== '-' && p.club !== '-' &&
        (p.name.toLowerCase().includes(q) || (p.club || '').toLowerCase().includes(q))
    ).slice(0, 8);

    if (matches.length === 0) {
        results.innerHTML = '<p style="color: var(--text-muted); font-style: italic; font-size: 13px;">Sin coincidencias.</p>';
        return;
    }
    results.innerHTML = matches.map(p => {
        const idx = tournamentData.players.indexOf(p);
        return '<div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px; border-bottom: 1px solid var(--border-color);">' +
            '<div><strong>' + escHtml(p.name) + '</strong><br><small style="color: var(--text-muted);">' + escHtml(p.club) + (p.checkin ? ' · ✅ presente' : '') + '</small></div>' +
            '<button class="btn ' + (p.checkin ? 'btn-success' : 'btn-primary') + '" style="padding: 5px 12px; font-size: 12px;" onclick="qrManualCheckin(' + idx + ')">' + (p.checkin ? '✅ Ya presente' : '✅ Acreditar') + '</button>' +
        '</div>';
    }).join('');
};

/**
 * Acredita al jugador seleccionado desde la búsqueda manual.
 * @param {number} index
 */
window.qrManualCheckin = function(index) {
    window.markPlayerCheckedIn(index);
    const input = document.getElementById('qr-manual-search');
    if (input) input.value = '';
    qrManualSearch();
};

