import { collection, query, limit, getDocs, doc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { db } from './firebase.js';

export async function loadTotalStats() {
    try {
        const statsRef = collection(db, 'stats');
        const q = query(statsRef, limit(1));
        const querySnapshot = await getDocs(q);

        let totalCorrect = 0;
        let totalWrong = 0;

        if (!querySnapshot.empty) {
            const firstDoc = querySnapshot.docs[0];
            const data = firstDoc.data();
            totalCorrect = data.totalCorrect || 0;
            totalWrong = data.totalWrong || 0;
        }

        const total = totalCorrect + totalWrong;
        const statsContainer = document.getElementById('total-stats');
        const isMobile = window.innerWidth <= 768;

        if (statsContainer) {
            if (isMobile) {
                statsContainer.innerHTML = `
                    <span class="stats-item stats-total" title="Celkem spočítáno ${total.toLocaleString('cs-CZ')} příkladů">📊 ${total.toLocaleString('cs-CZ')}</span>
                    <span class="stats-item stats-correct" title="${totalCorrect.toLocaleString('cs-CZ')} správně">✅ ${totalCorrect.toLocaleString('cs-CZ')}</span>
                    <span class="stats-item stats-wrong" title="${totalWrong.toLocaleString('cs-CZ')} špatně">❌ ${totalWrong.toLocaleString('cs-CZ')}</span>
                `;
            } else {
                statsContainer.innerHTML = `
                    <span class="stats-item stats-total">📊 Celkem spočítáno ${total.toLocaleString('cs-CZ')} příkladů</span>
                    <span class="stats-item stats-correct">✅ ${totalCorrect.toLocaleString('cs-CZ')} správně</span>
                    <span class="stats-item stats-wrong">❌ ${totalWrong.toLocaleString('cs-CZ')} špatně</span>
                `;
            }
        }
    } catch (error) {
        console.error('Chyba při načítání celkových statistik:', error);
        const statsContainer = document.getElementById('total-stats');
        if (statsContainer) {
            statsContainer.innerHTML = '';
        }
    }
}

export async function updateFirebaseStats(correctCount, wrongCount) {
    try {
        const statsRef = collection(db, 'stats');
        const q = query(statsRef, limit(1));
        const querySnapshot = await getDocs(q);

        let currentCorrect = 0;
        let currentWrong = 0;
        let docId = null;

        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            docId = docSnap.id;
            const data = docSnap.data();
            currentCorrect = data.totalCorrect || 0;
            currentWrong = data.totalWrong || 0;
        }

        const newCorrect = currentCorrect + correctCount;
        const newWrong = currentWrong + wrongCount;

        if (docId) {
            const statsDocRef = doc(db, 'stats', docId);
            await updateDoc(statsDocRef, {
                totalCorrect: newCorrect,
                totalWrong: newWrong,
                lastUpdated: new Date().toISOString()
            });
        } else {
            await addDoc(statsRef, {
                totalCorrect: newCorrect,
                totalWrong: newWrong,
                lastUpdated: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('Chyba při aktualizaci stats:', error);
    }

    window.testStats = updateFirebaseStats;
}
