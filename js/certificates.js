// ==========================================
// CERTIFICATES.JS - GENERACIÓN DE CERTIFICADOS
// ==========================================
// Este archivo contiene todas las funciones relacionadas con:
// - Generación de certificados de reconocimiento
// - Modal de selección de categorías
// - Diseño y estilos de certificados
// - Impresión de certificados
// ==========================================

// ==========================================
// MODAL DE CERTIFICADOS
// ==========================================

/**
 * Muestra el modal para generar certificados
 */
window.generateCertificatesModal = function() {
    const playersInscritos = tournamentData.players || [];
    if (tournamentData.fixtures.length === 0 && playersInscritos.length === 0) {
        showToast('No hay datos suficientes para generar certificados', 'warning');
        return;
    }

    // Calcular podios para certificados
    const podiums = calculatePodiums();
    let categories = Object.keys(podiums).sort();

    // Sin resultados: permitir certificados de participación con las categorías de los inscritos
    if (categories.length === 0) {
        categories = [...new Set((tournamentData.players || []).flatMap(p => p.categories || []))].sort();
    }

    if (categories.length === 0) {
        showToast('No hay jugadores inscritos para generar certificados', 'warning');
        return;
    }

    let categoriesHTML = '<select id="cert-category" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color); margin-bottom: 15px;">';
    categoriesHTML += '<option value="all">📋 Todas las Categorías</option>';
    categories.forEach(cat => {
        const winners = podiums[cat] ? podiums[cat].slice(0, 3) : [];
        categoriesHTML += `<option value="${escAttr(cat)}">${escHtml(cat)} (${winners.length} ganadores)</option>`;
    });
    categoriesHTML += '</select>';

    let certTypeHTML = '<select id="cert-type" onchange="toggleBlankCertControls()" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color); margin-bottom: 15px;">';
    certTypeHTML += '<option value="both">🏆 Podios + Participación</option>';
    certTypeHTML += '<option value="podium">🥇 Solo Podios (1°, 2° y 3°)</option>';
    certTypeHTML += '<option value="participation">📜 Solo Participación (todos los inscritos)</option>';
    certTypeHTML += '<option value="blank">🖨️ Plantilla en blanco (para completar a mano)</option>';
    certTypeHTML += '</select>';

    let blankSectionHTML = `
        <div id="cert-blank-section" style="display: none; padding: 12px; border: 1px dashed var(--btn-primary); border-radius: 6px; margin-bottom: 15px;">
            <p style="margin: 0 0 10px 0; font-size: 13px;"><strong>🖨️ Plantilla en blanco:</strong> solo con los datos del torneo. Elegí el puesto y (opcional) escribí el nombre del jugador.</p>
            <p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Puesto:</strong></p>
            <select id="cert-position" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color); margin-bottom: 10px;">
                <option value="1">🥇 1° Lugar</option>
                <option value="2">🥈 2° Lugar</option>
                <option value="3">🥉 3° Lugar</option>
                <option value="4">🎖️ 4° Lugar</option>
                <option value="participation">📜 Participación</option>
            </select>
            <p style="margin: 0 0 6px 0; font-size: 13px;"><strong>Nombre del jugador</strong> <span style="color: var(--muted-color);">(opcional — si lo dejás vacío queda una línea para completar a mano):</span></p>
            <input id="cert-player-name" type="text" maxlength="60" placeholder="Escribí el nombre del jugador…"
                style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--table-bg); color: var(--text-color);">
        </div>
    `;

    showModal(
        '🎓 Generar Certificados',
        `<div style="color: var(--text-color);">
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 64px;">🎓</div>
            </div>

            <p style="margin-bottom: 15px;"><strong>Selecciona la categoría para generar certificados:</strong></p>

            ${categoriesHTML}

            <p style="margin-bottom: 10px;"><strong>Selecciona el tipo de certificado:</strong></p>

            ${certTypeHTML}

            ${blankSectionHTML}

            <div class="info-box" style="margin: 15px 0;">
                <strong>📋 Tipos de certificados:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>🥇 Certificado de 1° Lugar (Oro)</li>
                    <li>🥈 Certificado de 2° Lugar (Plata)</li>
                    <li>🥉 Certificado de 3° Lugar (Bronce)</li>
                    <li>🎖️ Certificado de 4° Lugar</li>
                    <li>📜 Certificado de Participación (todos los jugadores inscritos)</li>
                    <li>🖨️ Plantilla en blanco (una por categoría, sin nombre — para completar a mano)</li>
                </ul>
            </div>

            <div class="warn-box" style="margin: 15px 0;">
                <p style="margin: 0; font-size: 13px;">
                    <strong>💡 Consejo:</strong> Los certificados se generarán en formato A4 horizontal, listos para imprimir.
                </p>
            </div>

            <div style="text-align: center; margin-top: 5px;">
                <button type="button" class="btn btn-success" onclick="shareCertificatesSummary(); return false;">📤 Compartir resultados</button>
            </div>
        </div>`,
        () => {
            const selectedCategory = document.getElementById('cert-category').value;
            const certType = document.getElementById('cert-type').value;
            const opts = {};
            if (certType === 'blank') {
                opts.position = document.getElementById('cert-position').value;
                opts.playerName = document.getElementById('cert-player-name').value.trim();
            }
            generateCertificates(selectedCategory, podiums, certType, opts);
        }
    );
};

/**
 * Muestra/oculta la sección de plantilla en blanco según el tipo elegido.
 */
window.toggleBlankCertControls = function() {
    const typeEl = document.getElementById('cert-type');
    const section = document.getElementById('cert-blank-section');
    if (!typeEl || !section) return;
    section.style.display = typeEl.value === 'blank' ? 'block' : 'none';
};

// ==========================================
// GENERACIÓN DE CERTIFICADOS
// ==========================================

/**
 * Genera los certificados para una categoría
 * @param {string} categoryFilter - Categoría seleccionada o 'all'
 * @param {Object} podiums - Podios por categoría
 */
window.generateCertificates = function(categoryFilter, podiums, certType, opts) {
    const torneoNombre = tournamentData.settings.torneoNombre;
    const subtitulo = tournamentData.settings.subtitulo;
    const fechaActual = new Date().toLocaleDateString(window.i18nLocale(), {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    let certificatesHTML = '';
    let categories;
    if (categoryFilter === 'all') {
        categories = Object.keys(podiums).length > 0
            ? Object.keys(podiums).sort()
            : [...new Set((tournamentData.players || []).flatMap(p => p.categories || []))].sort();
    } else {
        categories = [categoryFilter];
    }

    let certificateCount = 0;

    categories.forEach(categoria => {
        // Plantilla en blanco: una por categoría, solo datos del torneo
        if (certType === 'blank') {
            certificateCount++;
            const cfg = blankPositionConfig(opts && opts.position);
            const playerName = (opts && opts.playerName) || '';
            certificatesHTML += buildCertificateHTML(
                { name: playerName || '____________________________', club: '' },
                categoria,
                {
                    medalla: cfg.medalla,
                    colorBorde: cfg.color,
                    titulo: cfg.titulo,
                    textoLugar: cfg.textoLugar,
                    cuerpoFrase: cfg.cuerpoFrase,
                    mostrarStats: false,
                    mostrarClub: false,
                    fechaActual,
                    torneoNombre,
                    subtitulo
                }
            );
            return;
        }

        // Podios (1°, 2° y 3°)
        if (certType === 'podium' || certType === 'both') {
            const top3 = (podiums[categoria] || []).slice(0, 3);

            top3.forEach((jugador, index) => {
                certificateCount++;
                const posicion = index + 1;
                let medalla = '';
                let colorBorde = '';
                let textoLugar = '';

                if (posicion === 1) {
                    medalla = '🥇';
                    colorBorde = '#FFD700';
                    textoLugar = 'PRIMER LUGAR';
                } else if (posicion === 2) {
                    medalla = '🥈';
                    colorBorde = '#C0C0C0';
                    textoLugar = 'SEGUNDO LUGAR';
                } else {
                    medalla = '🥉';
                    colorBorde = '#CD7F32';
                    textoLugar = 'TERCER LUGAR';
                }

                certificatesHTML += buildCertificateHTML(jugador, categoria, {
                    medalla,
                    colorBorde,
                    titulo: 'CERTIFICADO DE RECONOCIMIENTO',
                    textoLugar,
                    cuerpoFrase: `Por haber obtenido el <strong>${textoLugar}</strong> en la categoría`,
                    mostrarStats: true,
                    fechaActual,
                    torneoNombre,
                    subtitulo
                });
            });
        }

        // Participación (todos los inscritos)
        if (certType === 'participation' || certType === 'both') {
            const inscritos = tournamentData.players.filter(p =>
                p.categories && p.categories.includes(categoria) &&
                p.name !== '-' && p.club !== '-'
            );

            inscritos.forEach(jugador => {
                certificateCount++;
                certificatesHTML += buildCertificateHTML(jugador, categoria, {
                    medalla: '📜',
                    colorBorde: '#28a745',
                    titulo: 'CERTIFICADO DE PARTICIPACIÓN',
                    textoLugar: 'PARTICIPACIÓN',
                    cuerpoFrase: 'Por su destacada <strong>PARTICIPACIÓN</strong> en la categoría',
                    mostrarStats: false,
                    fechaActual,
                    torneoNombre,
                    subtitulo
                });
            });
        }
    });

    if (certificateCount === 0) {
        showToast('No hay certificados para generar con la selección actual', 'warning');
        return;
    }

    openCertificatePrintWindow(certificatesHTML, certificateCount, torneoNombre);
};

/**
 * Configuración de la plantilla en blanco según el puesto elegido.
 */
function blankPositionConfig(pos) {
    switch (String(pos)) {
        case '2':
            return { medalla: '🥈', color: '#C0C0C0', titulo: 'CERTIFICADO DE RECONOCIMIENTO', textoLugar: 'SEGUNDO LUGAR', cuerpoFrase: 'Por haber obtenido el <strong>SEGUNDO LUGAR</strong> en la categoría' };
        case '3':
            return { medalla: '🥉', color: '#CD7F32', titulo: 'CERTIFICADO DE RECONOCIMIENTO', textoLugar: 'TERCER LUGAR', cuerpoFrase: 'Por haber obtenido el <strong>TERCER LUGAR</strong> en la categoría' };
        case '4':
            return { medalla: '🎖️', color: '#9B59B6', titulo: 'CERTIFICADO DE RECONOCIMIENTO', textoLugar: 'CUARTO LUGAR', cuerpoFrase: 'Por haber obtenido el <strong>CUARTO LUGAR</strong> en la categoría' };
        case 'participation':
            return { medalla: '📜', color: '#28a745', titulo: 'CERTIFICADO DE PARTICIPACIÓN', textoLugar: 'PARTICIPACIÓN', cuerpoFrase: 'Por su destacada <strong>PARTICIPACIÓN</strong> en la categoría' };
        default:
            return { medalla: '🥇', color: '#FFD700', titulo: 'CERTIFICADO DE RECONOCIMIENTO', textoLugar: 'PRIMER LUGAR', cuerpoFrase: 'Por haber obtenido el <strong>PRIMER LUGAR</strong> en la categoría' };
    }
}

/**
 * Abre la ventana de impresión con los certificados (uno por hoja A4 horizontal).
 */
function openCertificatePrintWindow(certificatesHTML, certificateCount, torneoNombre) {
    // Crear ventana de impresión
    const printWindow = window.open('', '_blank');

    let htmlDoc = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
    htmlDoc += '<title>Certificados - ' + torneoNombre + '</title>';
    htmlDoc += '<style>';

    // Estilos base
    htmlDoc += '* { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }';
    htmlDoc += 'body { font-family: "Segoe UI", Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }';

    // Página de certificado - UNA POR HOJA
    htmlDoc += '.certificate-page { width: 297mm; height: 210mm; background: white; margin: 0; padding: 15mm; page-break-after: always; page-break-inside: avoid; position: relative; display: block; }';
    htmlDoc += '.certificate-page:last-child { page-break-after: auto; }';

    // Borde decorativo
    htmlDoc += '.certificate-border { border: 8px solid #007BFF; border-radius: 20px; height: 100%; padding: 15mm; position: relative; background: white; box-shadow: inset 0 0 0 4px #FFD700; display: flex; flex-direction: column; }';

    // Contenido del certificado
    htmlDoc += '.certificate-content { display: flex; flex-direction: column; height: 100%; }';

    // Encabezado
    htmlDoc += '.certificate-header { text-align: center; margin-bottom: 20px; }';
    htmlDoc += '.medal-large { font-size: 72px; margin-bottom: 8px; }';
    htmlDoc += '.certificate-title { font-size: 32pt; color: #2c3e50; margin: 8px 0; text-transform: uppercase; letter-spacing: 3px; font-weight: bold; }';
    htmlDoc += '.certificate-subtitle { font-size: 22pt; color: #007BFF; font-weight: bold; text-transform: uppercase; margin-top: 8px; }';

    // Cuerpo - con flex-grow para empujar el pie hacia abajo
    htmlDoc += '.certificate-body { text-align: center; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; padding: 20px 0; }';
    htmlDoc += '.certificate-text { font-size: 14pt; color: #555; margin: 12px 0; line-height: 1.5; }';

    // Nombre del ganador
    htmlDoc += '.certificate-name { font-size: 36pt; font-weight: bold; color: #2c3e50; margin: 25px 0; padding: 15px; border-top: 3px solid #ecf0f1; border-bottom: 3px solid #ecf0f1; text-transform: uppercase; letter-spacing: 2px; }';

    // Categoría
    htmlDoc += '.certificate-category { font-size: 24pt; font-weight: bold; color: #007BFF; margin: 15px 0; text-transform: uppercase; }';

    // PIE DE PÁGINA COMPLETO
    htmlDoc += '.certificate-footer-complete { border-top: 3px solid #007BFF; padding-top: 20px; margin-top: auto; }';

    // Información del torneo en el pie
    htmlDoc += '.footer-info { text-align: center; margin-bottom: 20px; }';
    htmlDoc += '.footer-tournament { font-size: 16pt; font-weight: bold; color: #2c3e50; margin-bottom: 5px; }';
    htmlDoc += '.footer-subtitle { font-size: 13pt; color: #7f8c8d; margin-bottom: 8px; font-style: italic; }';
    htmlDoc += '.footer-club { font-size: 14pt; color: #007BFF; font-weight: 600; margin-bottom: 8px; }';
    htmlDoc += '.footer-stats { font-size: 12pt; color: #555; margin-top: 8px; }';

    // Sección de firma
    htmlDoc += '.footer-signature-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 15px; padding-top: 15px; border-top: 1px solid #e9ecef; }';
    htmlDoc += '.footer-date { font-size: 11pt; color: #7f8c8d; font-weight: 600; }';
    htmlDoc += '.footer-signature-line { font-size: 11pt; color: #2c3e50; text-align: center; min-width: 250px; }';
    htmlDoc += '.footer-signature-text { font-size: 10pt; color: #7f8c8d; text-align: center; margin-top: 3px; }';

    // Configuración de página para impresión
    htmlDoc += '@page { size: A4 landscape; margin: 0; }';

    // Estilos de impresión
    htmlDoc += '@media print { ';
    htmlDoc += 'body { background: white; margin: 0; padding: 0; } ';
    htmlDoc += '.certificate-page { margin: 0; padding: 15mm; page-break-after: always; page-break-inside: avoid; } ';
    htmlDoc += '.certificate-page:last-child { page-break-after: auto; } ';
    htmlDoc += '}';

    // Estilos de pantalla
    htmlDoc += '@media screen { ';
    htmlDoc += 'body { padding: 20px; } ';
    htmlDoc += '.certificate-page { margin-bottom: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1); } ';
    htmlDoc += '}';

    htmlDoc += '</style>';
    htmlDoc += '</head>';
    htmlDoc += '<body>';
    htmlDoc += certificatesHTML;
    htmlDoc += '<scr';
    htmlDoc += 'ipt>';
    htmlDoc += 'window.onload = function() { setTimeout(function() { window.print(); }, 500); };';
    htmlDoc += '</scr';
    htmlDoc += 'ipt>';
    htmlDoc += '</body>';
    htmlDoc += '</html>';

    printWindow.document.write(htmlDoc);
    printWindow.document.close();

    addLog('CERTIFICADOS', `${certificateCount} certificados generados y enviados a impresora`);
    showToast(`✅ ${certificateCount} certificados generados correctamente`);
};

/**
 * Construye el HTML de una página de certificado
 * @param {Object} jugador - Jugador a premiar
 * @param {string} categoria - Categoría
 * @param {Object} opts - Opciones de diseño del certificado
 * @returns {string} HTML del certificado
 */
function buildCertificateHTML(jugador, categoria, opts) {
    const statsHTML = opts.mostrarStats ? `
        <div class="footer-stats">
            Puntos obtenidos: <strong>${jugador.points}</strong> • Grupo(s): <strong>${jugador.groups.map(escHtml).join(', ')}</strong>
        </div>` : '';
    const clubHTML = opts.mostrarClub === false ? '' : `
        <div class="footer-club">${escHtml(jugador.club)}</div>`;

    return `
        <div class="certificate-page">
            <div class="certificate-border" style="border-color: ${opts.colorBorde};">
                <div class="certificate-content">
                    <!-- ENCABEZADO -->
                    <div class="certificate-header">
                        <div class="medal-large">${opts.medalla}</div>
                        <h1 class="certificate-title">${opts.titulo}</h1>
                        <div class="certificate-subtitle">${opts.textoLugar}</div>
                    </div>

                    <!-- CUERPO PRINCIPAL -->
                    <div class="certificate-body">
                        <p class="certificate-text">Se otorga el presente certificado a:</p>

                        <div class="certificate-name">
                            ${escHtml(jugador.name)}
                        </div>

                        <p class="certificate-text">${opts.cuerpoFrase}</p>

                        <div class="certificate-category">
                            ${escHtml(categoria)}
                        </div>
                    </div>

                    <!-- PIE DE PÁGINA CON TODA LA INFORMACIÓN -->
                    <div class="certificate-footer-complete">
                        <div class="footer-info">
                            <div class="footer-tournament">🏓 ${opts.torneoNombre} 🏓</div>
                            <div class="footer-subtitle">${opts.subtitulo}</div>
                            ${clubHTML}
                            ${statsHTML}
                        </div>

                        <div class="footer-signature-section">
                            <div class="footer-date">🏓 ${opts.fechaActual}</div>
                            <div class="footer-signature-line">_______________________________</div>
                            <div class="footer-signature-text">Firma del Organizador</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Comparte un resumen de resultados (podios) listo para redes/mensajería.
 * Móvil: Web Share API. Escritorio: copia el texto al portapapeles.
 */
window.shareCertificatesSummary = function() {
    const torneoNombre = tournamentData.settings.torneoNombre || 'Torneo';
    const podiums = calculatePodiums();
    let lines = ['🏓 ' + torneoNombre.toUpperCase()];

    const cats = Object.keys(podiums).sort();
    if (cats.length === 0) {
        const total = (tournamentData.players || []).filter(p => p.name !== '-' && p.club !== '-').length;
        lines.push('📜 Se entregarán certificados de participación a ' + total + ' jugadores.');
    } else {
        cats.forEach(cat => {
            lines.push('');
            lines.push('🏆 ' + cat.toUpperCase());
            const medals = ['🥇 1°', '🥈 2°', '🥉 3°'];
            podiums[cat].slice(0, 3).forEach((p, i) => {
                lines.push(medals[i] + ' ' + p.name + (p.club && p.club !== '-' ? ' — ' + p.club : ''));
            });
        });
    }

    lines.push('');
    lines.push('Generado con SGTM 🏓');

    window.shareText(lines.join('\n'), 'Resultados — ' + torneoNombre);
    addLog('CERTIFICADOS', 'Resumen de resultados listo para compartir');
};

