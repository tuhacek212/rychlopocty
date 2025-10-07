import { collection, query, limit, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { db } from './firebase.js';

export function getOperationsSymbols(operations) {
    const symbols = [];
    if (operations.includes('*')) symbols.push('×');
    if (operations.includes('+')) symbols.push('+');
    if (operations.includes('-')) symbols.push('−');
    if (operations.includes('/')) symbols.push('÷');
    return symbols.join('');
}

export async function loadMiniLeaderboards() {
    const modes = ['🟢 Lehká', '🟡 Střední', '🟠 Obtížná', '🔴 Expert'];
    let leaderboardsHTML = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px;">';

    for (const mode of modes) {
        try {
            const q = query(
                collection(db, 'leaderboard'),
                limit(100)
            );
            
            const querySnapshot = await getDocs(q);
            const results = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.mode === mode) {
                    results.push(data);
                }
            });

            results.sort((a, b) => {
                const opsA = (a.operations || []).length;
                const opsB = (b.operations || []).length;
                if (opsB !== opsA) return opsB - opsA;
                return a.time - b.time;
            });
            
            const top3 = results.slice(0, 3);

            leaderboardsHTML += `
                <div class="card" style="padding: 12px;">
                    <div style="text-align: center; font-size: 13px; font-weight: bold; margin-bottom: 8px; color: #fbbf24;">${mode}</div>
                    ${top3.length > 0 ? top3.map((entry, index) => {
                        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
                        const opsSymbols = getOperationsSymbols(entry.operations || []);
                        return `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 11px;">
                                <span style="display: flex; align-items: center; gap: 4px; min-width: 0; overflow: hidden;">
                                    <span style="flex-shrink: 0;">${medal}</span>
                                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 85px;">${entry.username}</span>
                                    <span style="color: #94a3b8; font-size: 9px; flex-shrink: 0;">${opsSymbols}</span>
                                </span>
                                <span style="color: #10b981; font-weight: bold; flex-shrink: 0; margin-left: 4px;">${entry.time.toFixed(2)}s</span>
                            </div>
                        `;
                    }).join('') : '<div style="text-align: center; padding: 10px; color: #64748b; font-size: 10px;">Zatím žádné výsledky</div>'}
                </div>
            `;
        } catch (error) {
            console.error('Chyba při načítání mini žebříčku:', error);
            leaderboardsHTML += `
                <div class="card" style="padding: 12px;">
                    <div style="text-align: center; font-size: 13px; font-weight: bold; margin-bottom: 8px; color: #fbbf24;">${mode}</div>
                    <div style="text-align: center; padding: 10px; color: #ef4444; font-size: 10px;">Chyba načítání</div>
                </div>
            `;
        }
    }

    leaderboardsHTML += '</div>';
    
    const container = document.getElementById('mini-leaderboards');
    if (container) {
        container.innerHTML = leaderboardsHTML;
    }
}

export async function showLeaderboards() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="title-section">
            <div class="main-title">🏆 Žebříčky</div>
            <div class="subtitle">Top 10 nejlepších časů</div>
        </div>
        <div id="leaderboards-container">
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 24px;">⏳ Načítání...</div>
            </div>
        </div>
        <div style="text-align: center; margin-top: 20px;">
            <button class="btn btn-blue" style="width: auto; padding: 12px 30px;" onclick="app.showMainScreen()">◀ Zpět</button>
        </div>
    `;

    const modes = ['🟢 Lehká', '🟡 Střední', '🟠 Obtížná', '🔴 Expert'];
    let leaderboardsHTML = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 15px; max-width: 1400px; margin: 0 auto;">';

    for (const mode of modes) {
        try {
            const q = query(
                collection(db, 'leaderboard'),
                limit(100)
            );
            
            const querySnapshot = await getDocs(q);
            const results = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.mode === mode) {
                    results.push(data);
                }
            });

            results.sort((a, b) => {
                const opsA = (a.operations || []).length;
                const opsB = (b.operations || []).length;
                if (opsB !== opsA) return opsB - opsA;
                return a.time - b.time;
            });
            
            const top10 = results.slice(0, 10);

            leaderboardsHTML += `
                <div class="card" style="padding: 12px;">
                    <div style="text-align: center; font-size: 15px; font-weight: 600; color: #fbbf24; margin-bottom: 10px;">${mode}</div>
                    ${top10.length > 0 ? top10.map((entry, index) => {
                        const date = new Date(entry.date).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' });
                        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                        const opsSymbols = getOperationsSymbols(entry.operations || []);
                        return `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 6px; margin: 2px 0; background: #1e293b; border-radius: 2px; font-size: 12px;">
                                <div style="display: flex; align-items: center; gap: 4px; min-width: 0; flex: 1; overflow: hidden;">
                                    <span style="font-size: 13px; min-width: 20px; flex-shrink: 0;">${medal}</span>
                                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 90px;">${entry.username}</span>
                                    <span style="font-size: 9px; color: #64748b; flex-shrink: 0;">${opsSymbols}</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                                    <span style="color: #10b981; font-weight: 600; font-size: 13px;">${entry.time.toFixed(2)}s</span>
                                    <span style="font-size: 8px; color: #475569;">${date}</span>
                                </div>
                            </div>
                        `;
                    }).join('') : '<div style="text-align: center; padding: 12px; color: #64748b; font-size: 11px;">Zatím žádné výsledky</div>'}
                </div>
            `;
        } catch (error) {
            console.error('Chyba při načítání žebříčku:', error);
        }
    }

    leaderboardsHTML += '</div>';

    document.getElementById('leaderboards-container').innerHTML = leaderboardsHTML || '<div style="text-align: center; padding: 40px;">Nepodařilo se načíst žebříčky</div>';
}

export async function saveToLeaderboard(mode, time, userName, correctCount, wrongCount, operations) {
    const username = document.getElementById('username').value.trim();
    if (!username) {
        alert('Zadej své jméno!');
        return null;
    }

    localStorage.setItem('rychlopocty_username', username);

    try {
        await addDoc(collection(db, 'leaderboard'), {
            mode: mode,
            time: parseFloat(time),
            username: username,
            date: new Date().toISOString(),
            correctCount: correctCount,
            wrongCount: wrongCount,
            operations: operations
        });

        alert('✅ Výsledek uložen do žebříčku!');
        return username;
    } catch (error) {
        console.error('Chyba při ukládání:', error);
        alert('❌ Nepodařilo se uložit do žebříčku. Zkus to znovu.');
        return null;
    }
}