// ==========================================
// SHARE.JS - COMPARTIR EN REDES / MENSAJERÍA
// ==========================================
// Utilidades para compartir planillas y certificados rápidamente:
// - shareFileBlob: comparte un archivo (PDF) vía Web Share API (móvil)
//   con respaldo a descarga + mensaje copiado (escritorio).
// - shareText: comparte texto vía Web Share API con respaldo a portapapeles.
// - copyText: copia texto al portapapeles (con respaldo execCommand).
// ==========================================

window.copyText = function(text) {
    return new Promise(function(resolve) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() {
                resolve(true);
            }).catch(function() {
                resolve(fallbackCopy(text));
            });
        } else {
            resolve(fallbackCopy(text));
        }
    });
};

function fallbackCopy(text) {
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch (e) {
        return false;
    }
}

/**
 * Abre WhatsApp con un mensaje ya cargado (enlace wa.me directo).
 * Funciona en PC (WhatsApp Web) y celular, sin pasar por el portapapeles.
 */
window.shareToWhatsApp = function(text) {
    const url = 'https://wa.me/?text=' + encodeURIComponent(text);
    window.open(url, '_blank');
    if (typeof showToast === 'function') {
        showToast('📲 Abriendo WhatsApp con el mensaje listo…');
    }
};

/**
 * Comparte un texto (resumen, resultados) por redes/mensajería.
 * Usa Web Share API cuando está disponible; si no, copia al portapapeles.
 */
window.shareText = function(text, titulo) {
    if (navigator.share) {
        navigator.share({ title: titulo || 'SGTM', text: text })
            .catch(function() { /* usuario canceló */ });
    } else {
        window.copyText(text).then(function(ok) {
            if (ok) {
                showToast('📋 Mensaje copiado al portapapeles — pegálo donde quieras compartirlo');
            } else {
                showToast('No se pudo copiar el texto', 'error');
            }
        });
    }
};

/**
 * Comparte un archivo (PDF de planilla/certificado) directamente a
 * WhatsApp, correo, Instagram, etc. (Web Share API con archivos, móvil).
 * En escritorio (sin soporte) descarga el archivo y copia un mensaje listo
 * para pegar en redes.
 */
window.shareFileBlob = function(blob, filename, message) {
    const canShareFile = navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: 'application/pdf' })] });
    if (canShareFile) {
        navigator.share({
            files: [new File([blob], filename, { type: 'application/pdf' })],
            text: message || ''
        }).catch(function() { /* usuario canceló */ });
        return;
    }

    // Fallback escritorio: descargar + copiar mensaje
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 4000);

    if (message) {
        window.copyText(message).then(function(ok) {
            showToast(ok
                ? '⬇️ ' + filename + ' descargado — mensaje copiado, pegálo en tu red social'
                : '⬇️ ' + filename + ' descargado');
        });
    } else {
        showToast('⬇️ ' + filename + ' descargado');
    }
};

