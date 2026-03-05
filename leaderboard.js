import { collection, query, limit, getDocs, addDoc, orderBy, doc, getDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { db } from './firebase.js';

export function getOperationsSymbols(operations) {
    const symbols = [];
    if (operations.includes('*')) symbols.push('×');
    if (operations.includes('+')) symbols.push('+');
    if (operations.includes('-')) symbols.push('−');
    if (operations.includes('/')) symbols.push('÷');
    return symbols.join('');
}

// Globální proměnné pro filtr
let allLeaderboardResults = [];
let currentFilters = {
    multiply: true,
    add: true,
    subtract: true,
    divide: true
};

export async function showLeaderboards() {
    const tabContent = document.getElementById('tab-content');
    const target = tabContent || document.getElementById('app');
    
    target.innerHTML = `
            <div class="card" style="padding: 20px; margin-bottom: 20px;">
            <div style="text-align: center; font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #fbbf24;">🔢 Filtrovat podle operací</div>
            <div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap;">
                <div class="checkbox-item">
                    <input type="checkbox" id="filter-multiply" checked onchange="window.filterLeaderboard()">
                    <label for="filter-multiply">✖️ Násobení</label>
                </div>
                <div class="checkbox-item">
                    <input type="checkbox" id="filter-add" checked onchange="window.filterLeaderboard()">
                    <label for="filter-add">➕ Sčítání</label>
                </div>
                <div class="checkbox-item">
                    <input type="checkbox" id="filter-subtract" checked onchange="window.filterLeaderboard()">
                    <label for="filter-subtract">➖ Odčítání</label>
                </div>
                <div class="checkbox-item">
                    <input type="checkbox" id="filter-divide" checked onchange="window.filterLeaderboard()">
                    <label for="filter-divide">➗ Dělení</label>
                </div>
            </div>
        </div>

        <div id="leaderboards-container">
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 24px;">⏳ Načítání...</div>
            </div>
        </div>
        ${!tabContent ? '<div style="text-align: center; margin-top: 20px;"><button class="btn btn-blue" style="width: auto; padding: 12px 30px;" onclick="app.router.navigate(\'/\')">◀ Zpět</button></div>' : ''}
    `;

    try {
        const q = query(
            collection(db, 'leaderboard'),
            limit(200)
        );
        
        const querySnapshot = await getDocs(q);
        allLeaderboardResults = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            allLeaderboardResults.push(data);
        });

        // Seřadit podle času
        allLeaderboardResults.sort((a, b) => a.time - b.time);

        // Zobrazit žebříček
        renderLeaderboard();

    } catch (error) {
        console.error('Chyba při načítání žebříčku:', error);
        document.getElementById('leaderboards-container').innerHTML = '<div style="text-align: center; padding: 40px;">Nepodařilo se načíst žebříček</div>';
    }
}

function renderLeaderboard() {
    // Získat aktuální filtry
    currentFilters.multiply = document.getElementById('filter-multiply')?.checked ?? true;
    currentFilters.add = document.getElementById('filter-add')?.checked ?? true;
    currentFilters.subtract = document.getElementById('filter-subtract')?.checked ?? true;
    currentFilters.divide = document.getElementById('filter-divide')?.checked ?? true;

    // Filtrovat výsledky - zobrazit pouze záznamy, které mají alespoň jednu ze zaškrtnutých operací
    const filteredResults = allLeaderboardResults.filter(entry => {
        const ops = entry.operations || [];
        
        // Pokud žádná operace není zaškrtnutá, nezobrazovat nic
        if (!currentFilters.multiply && !currentFilters.add && !currentFilters.subtract && !currentFilters.divide) {
            return false;
        }

        // Zobrazit pouze pokud má alespoň jednu ze zaškrtnutých operací
        const hasValidOperation = 
            (ops.includes('*') && currentFilters.multiply) ||
            (ops.includes('+') && currentFilters.add) ||
            (ops.includes('-') && currentFilters.subtract) ||
            (ops.includes('/') && currentFilters.divide);

        return hasValidOperation;
    });

    // Vzít top 50
    const top50 = filteredResults.slice(0, 50);

    let leaderboardHTML = '<div class="card" style="padding: 20px; max-width: 800px; margin: 0 auto;">';

    if (top50.length > 0) {
        leaderboardHTML += top50.map((entry, index) => {
            const date = new Date(entry.date).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            const opsSymbols = getOperationsSymbols(entry.operations || []);
            const opsCount = (entry.operations || []).length;
            
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; margin: 2px 0; background: #1e293b; border-radius: 3px; font-size: 13px; border-left: 2px solid ${index < 3 ? '#fbbf24' : '#334155'};">
                    <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                        <span style="font-size: 14px; min-width: 30px; font-weight: 600; flex-shrink: 0;">${medal}</span>
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; max-width: 150px;">${entry.username}</span>
                        <span style="font-size: 11px; color: #94a3b8; flex-shrink: 0; background: #334155; padding: 1px 6px; border-radius: 2px;">${entry.mode}</span>
                        <span style="font-size: 15px; color: #fbbf24; flex-shrink: 0; font-weight: 600;">${opsSymbols}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                        <span style="color: #10b981; font-weight: 700; font-size: 16px;">${entry.time.toFixed(2)}s</span>
                        <span style="font-size: 9px; color: #64748b; min-width: 65px; text-align: right;">${date}</span>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        leaderboardHTML += '<div style="text-align: center; padding: 40px; color: #64748b;">Žádné výsledky pro vybrané operace</div>';
    }

    leaderboardHTML += '</div>';

    document.getElementById('leaderboards-container').innerHTML = leaderboardHTML;
}

// Přidat globální funkci pro filtrování
window.filterLeaderboard = renderLeaderboard;

export async function getProjectedRank(timeValue) {
    const time = parseFloat(timeValue);
    if (!Number.isFinite(time) || time <= 0) return null;

    try {
        const q = query(
            collection(db, 'leaderboard'),
            orderBy('time', 'asc'),
            limit(50)
        );
        const snapshot = await getDocs(q);
        const top = [];
        snapshot.forEach((d) => top.push(d.data()));

        let rank = top.findIndex((entry) => time <= Number(entry.time));
        if (rank === -1) rank = top.length;

        const position = rank + 1;
        return {
            position: position,
            inTop50: position <= 50
        };
    } catch (error) {
        console.error('Chyba při výpočtu projekce umístění:', error);
        return null;
    }
}

export async function createTestSession(mode, limit, operations) {
    try {
        const sessionRef = await addDoc(collection(db, 'test_sessions'), {
            mode: mode,
            limit: Number(limit),
            operations: operations || ['*'],
            used: false,
            startedAt: serverTimestamp(),
            createdAtClient: new Date().toISOString()
        });
        return sessionRef.id;
    } catch (error) {
        console.error('Chyba při vytvoření test session:', error);
        return null;
    }
}

export async function createPendingResult(mode, time, correctCount, wrongCount, operations, sessionId) {
    if (!sessionId) return null;
    try {
        const pendingRef = await addDoc(collection(db, 'pending_results'), {
            mode: mode,
            time: parseFloat(time),
            correctCount: correctCount,
            wrongCount: wrongCount,
            operations: operations || [],
            sessionId: sessionId,
            createdAt: serverTimestamp(),
            createdAtClient: new Date().toISOString()
        });
        return { pendingResultId: pendingRef.id };
    } catch (error) {
        console.error('Chyba při vytvoření dočasného výsledku:', error);
        return null;
    }
}

export async function saveToLeaderboard(pendingResultId) {
    if (!pendingResultId) {
        alert('Chybí dočasný výsledek testu. Spusť test znovu.');
        return null;
    }

    const username = document.getElementById('username').value.trim();
    if (!username) {
        alert('Zadej své jméno!');
        return null;
    }

    localStorage.setItem('rychlopocty_username', username);

    try {
        const pendingRef = doc(db, 'pending_results', pendingResultId);
        const pendingSnap = await getDoc(pendingRef);
        if (!pendingSnap.exists()) {
            alert('Dočasný výsledek neexistuje. Dokonči test znovu.');
            return null;
        }

        const pending = pendingSnap.data();
        if (!pending.sessionId) {
            alert('Dočasný výsledek je neplatný.');
            return null;
        }

        const sessionRef = doc(db, 'test_sessions', pending.sessionId);
        const batch = writeBatch(db);
        batch.set(doc(collection(db, 'leaderboard')), {
            mode: pending.mode,
            time: parseFloat(pending.time),
            username: username,
            date: new Date().toISOString(),
            correctCount: pending.correctCount,
            wrongCount: pending.wrongCount,
            operations: pending.operations || [],
            sessionId: pending.sessionId,
            pendingResultId: pendingResultId
        });
        batch.update(sessionRef, {
            used: true,
            usedBy: username,
            usedAtClient: new Date().toISOString()
        });
        batch.delete(pendingRef);
        await batch.commit();

        alert('✅ Výsledek uložen do žebříčku!');
        return username;
    } catch (error) {
        console.error('Chyba při ukládání:', error);
        alert('❌ Nepodařilo se uložit do žebříčku. Zkus to znovu.');
        return null;
    }

}
