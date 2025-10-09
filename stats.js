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
            const docSnap = querySnapshot.docs[0];
            const data = docSnap.data();
            totalCorrect = data.totalCorrect || 0;
            totalWrong = data.totalWrong || 0;
        }
        
        const total = totalCorrect + totalWrong;
        
        const statsContainer = document.getElementById('total-stats');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div style="font-size: 16px; font-weight: bold; color: #3b82f6; margin-bottom: 5px;">
                    📊 Celkem spočítáno ${total.toLocaleString('cs-CZ')} příkladů
                </div>
                <div style="font-size: 14px;">
                    <span style="color: #10b981;">✅ ${totalCorrect.toLocaleString('cs-CZ')} správně</span> · 
                    <span style="color: #ef4444;">❌ ${totalWrong.toLocaleString('cs-CZ')} špatně</span>
                </div>
            `;
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
    console.log('📊 updateFirebaseStats called with:', correctCount, 'correct,', wrongCount, 'wrong');
    
    // DŮLEŽITÉ: Odstranili jsme try-catch, aby se chyby propagovaly do volající funkce
    const statsRef = collection(db, 'stats');
    const q = query(statsRef, limit(1));
    
    console.log('🔍 Načítám existující stats...');
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
        console.log('📖 Existující data:', currentCorrect, 'správně,', currentWrong, 'špatně');
    } else {
        console.log('📝 Žádná existující data, vytvářím nový dokument');
    }
    
    const newCorrect = currentCorrect + correctCount;
    const newWrong = currentWrong + wrongCount;
    
    console.log('💾 Ukládám nové hodnoty:', newCorrect, 'správně,', newWrong, 'špatně');
    
    if (docId) {
        const statsDocRef = doc(db, 'stats', docId);
        await updateDoc(statsDocRef, {
            totalCorrect: newCorrect,
            totalWrong: newWrong,
            lastUpdated: new Date().toISOString()
        });
        console.log('✅ Dokument aktualizován!');
    } else {
        await addDoc(statsRef, {
            totalCorrect: newCorrect,
            totalWrong: newWrong,
            lastUpdated: new Date().toISOString()
        });
        console.log('✅ Nový dokument vytvořen!');
    }
    
    console.log('🎉 updateFirebaseStats dokončena úspěšně');
}