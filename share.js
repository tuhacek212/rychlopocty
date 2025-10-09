// Funkce pro sdílení pozvánek do multiplayer her

export function getInviteUrl(gameCode) {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?join=${gameCode}`;
}

export function getInviteMessage(gameCode, playerName) {
    return `🎮 ${playerName} tě zve do hry Rychlopočty!\n\nKód hry: ${gameCode}\n\nPřipoj se zde: ${getInviteUrl(gameCode)}`;
}

export function shareViaWhatsApp(gameCode, playerName) {
    const message = getInviteMessage(gameCode, playerName);
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

export function shareViaMessenger(gameCode, playerName) {
    const url = getInviteUrl(gameCode);
    const messengerUrl = `fb-messenger://share/?link=${encodeURIComponent(url)}&app_id=123456789`;
    
    // Fallback na web verzi Messengeru
    try {
        window.location.href = messengerUrl;
        setTimeout(() => {
            // Pokud se aplikace neotevřela, otevři web verzi
            window.open(`https://www.facebook.com/dialog/send?link=${encodeURIComponent(url)}&app_id=123456789&redirect_uri=${encodeURIComponent(url)}`, '_blank');
        }, 1000);
    } catch (e) {
        window.open(`https://www.facebook.com/dialog/send?link=${encodeURIComponent(url)}&app_id=123456789&redirect_uri=${encodeURIComponent(url)}`, '_blank');
    }
}

export async function copyInviteLink(gameCode, playerName) {
    const url = getInviteUrl(gameCode);
    
    try {
        await navigator.clipboard.writeText(url);
        showCopyNotification('✅ Odkaz zkopírován do schránky!');
    } catch (err) {
        // Fallback pro starší prohlížeče
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            showCopyNotification('✅ Odkaz zkopírován do schránky!');
        } catch (err) {
            showCopyNotification('❌ Nepodařilo se zkopírovat odkaz');
        }
        
        document.body.removeChild(textArea);
    }
}

export async function shareNative(gameCode, playerName) {
    const message = getInviteMessage(gameCode, playerName);
    const url = getInviteUrl(gameCode);
    
    // Kontrola podpory Web Share API
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Rychlopočty - Pozvánka do hry',
                text: `🎮 ${playerName} tě zve do hry! Kód: ${gameCode}`,
                url: url
            });
        } catch (err) {
            // Uživatel zrušil sdílení nebo chyba
            if (err.name !== 'AbortError') {
                console.error('Chyba při sdílení:', err);
                showCopyNotification('❌ Nepodařilo se sdílet');
            }
        }
    } else {
        // Fallback - zkopíruj odkaz
        await copyInviteLink(gameCode, playerName);
    }
}

function showCopyNotification(message) {
    // Vytvoř dočasnou notifikaci
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #1e293b;
        color: #f1f5f9;
        padding: 15px 30px;
        border-radius: 4px;
        border: 1px solid #3b82f6;
        font-size: 14px;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        animation: slideDown 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 2500);
}

// Přidat CSS animace
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }
    
    @keyframes slideUp {
        from {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        to {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
    }
`;
document.head.appendChild(style);