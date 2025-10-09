import { TestManager } from './test.js';
import { loadTotalStats, updateFirebaseStats } from './stats.js';
import { showLeaderboards, saveToLeaderboard } from './leaderboard.js';
import { getMotivationalMessage } from './messages.js';
import { MultiplayerManager } from './multiplayer.js';

export class RychlopoctyApp {
    constructor() {
        this.limit = null;
        this.mode = null;
        this.correctTimes = [];
        this.allAnswerTimes = [];
        this.correctCount = 0;
        this.wrongCount = 0;
        this.wrongAnswers = [];
        this.running = false;
        this.operations = ['*'];
        this.remainingTime = 0;
        this.countdownInterval = null;
        this.progressInterval = null;
        this.timerInterval = null;
        this.testStartTime = null;
        this.testEndTime = null;
        this.userName = localStorage.getItem('rychlopocty_username') || '';
        this.wasQuit = false;
        
        this.savedMultiply = true;
        this.savedAdd = false;
        this.savedSubtract = false;
        this.savedDivide = false;

        this.testManager = new TestManager(this);
        this.multiplayerManager = new MultiplayerManager(this);
        
        // Zkontroluj, jestli URL obsahuje pozvánku
        this.checkForInvite();
    }

    checkForInvite() {
        const urlParams = new URLSearchParams(window.location.search);
        const joinCode = urlParams.get('join');
        
        if (joinCode) {
            // Odstranit parametr z URL bez reloadu
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Zobrazit obrazovku pro připojení s předvyplněným kódem
            this.showJoinGameScreenWithCode(joinCode);
        } else {
            this.showMainScreen();
        }
    }

    showJoinGameScreenWithCode(gameCode) {
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px;">
                <div style="font-size: 32px; margin-bottom: 20px;">🔗 Připojit se ke hře</div>
                
                <div style="font-size: 16px; color: #10b981; margin-bottom: 20px;">
                    ✅ Kód hry byl automaticky vyplněn!
                </div>
                
                <div style="margin: 30px 0;">
                    <input type="text" 
                           id="guest-name" 
                           class="name-input" 
                           placeholder="Tvoje jméno" 
                           value="${this.userName}"
                           style="font-size: 18px; padding: 15px; margin-bottom: 15px;">
                    
                    <input type="text" 
                           id="game-code" 
                           class="name-input" 
                           placeholder="Kód hry" 
                           value="${gameCode}"
                           style="font-size: 24px; padding: 15px; text-transform: uppercase; letter-spacing: 3px;">
                </div>

                <button class="btn btn-blue" 
                        style="width: auto; padding: 15px 40px; font-size: 18px;" 
                        onclick="app.joinMultiplayerGame()">
                    🎮 Připojit se
                </button>

                <button class="btn btn-blue" 
                        style="width: auto; padding: 12px 30px; margin-top: 20px;" 
                        onclick="app.showMainScreen()">
                    ◀ Zpět
                </button>
            </div>
        `;

        document.getElementById('guest-name').focus();
    }

    async showMainScreen() {
        const app = document.getElementById('app');
        app.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; flex-wrap: wrap; gap: 20px;">
                <div style="text-align: left;">
                    <div style="font-size: 32px; font-weight: bold; margin-bottom: 5px;">⚡ Rychlopočty</div>
                    <div style="font-size: 14px; color: #94a3b8;">Trénuj a sdílej své matematické dovednosti</div>
                </div>
                <div id="total-stats" style="text-align: right;">
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 3px;">⏳ Načítání statistik...</div>
                </div>
            </div>

            <div class="two-column">
                <div class="card">
                    <div class="section-title">🎯 Vyber obtížnost</div>
                    
                    <button class="btn btn-green" onclick="app.startTest('Lehká', 30)">Lehká</button>
                    <div class="time-desc">30 sekund</div>
                    
                    <button class="btn btn-yellow" onclick="app.startTest('Střední', 22)">Střední</button>
                    <div class="time-desc">22 sekund</div>
                    
                    <button class="btn btn-orange" onclick="app.startTest('Obtížná', 15)">Obtížná</button>
                    <div class="time-desc">15 sekund</div>
                    
                    <button class="btn btn-red" onclick="app.startTest('Expert', 10)">Expert</button>
                    <div class="time-desc">10 sekund</div>

                    <div class="section-title" style="margin-top: 20px;">⏱️ Vlastní čas</div>
                    <div class="custom-time">
                        <input type="number" id="customTime" placeholder="0" min="0" value="0">
                        <span style="color: #94a3b8; font-size: 10px;">sekund (0 = nekonečný trénink)</span>
                    </div>
                    <button class="btn btn-purple" onclick="app.startCustomTime()">🚀 Start na čas</button>
                </div>

                <div class="card" style="display: flex; flex-direction: column;">
                    <div class="section-title">🔢 Vyber operace</div>
                    <div class="operations-grid">
                        <button class="operation-btn ${this.savedMultiply ? 'active' : ''}" 
                                id="op-multiply" 
                                onclick="app.toggleOperation('multiply')">
                            ✖️ Násobení
                        </button>
                        <br>
                        <button class="operation-btn ${this.savedAdd ? 'active' : ''}" 
                                id="op-add" 
                                onclick="app.toggleOperation('add')">
                            ➕ Sčítání
                        </button><br>
                        <button class="operation-btn ${this.savedSubtract ? 'active' : ''}" 
                                id="op-subtract" 
                                onclick="app.toggleOperation('subtract')">
                            ➖ Odčítání
                        </button><br>
                        <button class="operation-btn ${this.savedDivide ? 'active' : ''}" 
                                id="op-divide" 
                                onclick="app.toggleOperation('divide')">
                            ➗ Dělení
                        </button>
                    </div>

                    <div style="margin-top: auto;">
                        <button class="btn btn-blue" onclick="app.showLeaderboards()">🏆 Žebříčky</button>
                    </div>
                </div>
            </div>

            <div class="card" style="margin-top: 20px;">
                <div class="section-title">🎮 Multiplayer 1v1</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
                    <button class="btn btn-green" onclick="app.showCreateGameScreen()">
                        🎯 Založit hru
                    </button>
                    <button class="btn btn-blue" onclick="app.showJoinGameScreen()">
                        🔗 Připojit se
                    </button>
                </div>
                <div style="text-align: center; font-size: 11px; color: #64748b; margin-top: 10px;">
                    Soupeř proti kamarádovi v reálném čase!
                </div>
            </div>
            
            <div style="text-align: center; padding: 20px 0; margin-top: 30px;">
                <div style="font-size: 11px; color: #475569;">Made by JT</div>
            </div>
        `;

        loadTotalStats();
    }

    toggleOperation(operation) {
        const btn = document.getElementById(`op-${operation}`);
        
        switch(operation) {
            case 'multiply':
                this.savedMultiply = !this.savedMultiply;
                break;
            case 'add':
                this.savedAdd = !this.savedAdd;
                break;
            case 'subtract':
                this.savedSubtract = !this.savedSubtract;
                break;
            case 'divide':
                this.savedDivide = !this.savedDivide;
                break;
        }
        
        btn.classList.toggle('active');
    }

    showCreateGameScreen() {
        this.savedMultiply = document.getElementById('op-multiply')?.classList.contains('active') ?? true;
        this.savedAdd = document.getElementById('op-add')?.classList.contains('active') ?? false;
        this.savedSubtract = document.getElementById('op-subtract')?.classList.contains('active') ?? false;
        this.savedDivide = document.getElementById('op-divide')?.classList.contains('active') ?? false;
        
        const app = document.getElementById('app');
        
        app.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px;">
                <div style="font-size: 32px; margin-bottom: 20px;">🎯 Založit hru</div>
                
                <div style="margin: 30px 0;">
                    <input type="text" 
                           id="host-name" 
                           class="name-input" 
                           placeholder="Tvoje jméno" 
                           value="${this.userName}"
                           style="font-size: 18px; padding: 15px;">
                </div>

                <button class="btn btn-green" 
                        style="width: auto; padding: 15px 40px; font-size: 18px;" 
                        onclick="app.createMultiplayerGame()">
                    🚀 Vytvořit místnost
                </button>

                <button class="btn btn-blue" 
                        style="width: auto; padding: 12px 30px; margin-top: 20px;" 
                        onclick="app.showMainScreen()">
                    ◀ Zpět
                </button>
            </div>
        `;

        document.getElementById('host-name').focus();
    }

    showJoinGameScreen() {
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px;">
                <div style="font-size: 32px; margin-bottom: 20px;">🔗 Připojit se ke hře</div>
                
                <div style="margin: 30px 0;">
                    <input type="text" 
                           id="guest-name" 
                           class="name-input" 
                           placeholder="Tvoje jméno" 
                           value="${this.userName}"
                           style="font-size: 18px; padding: 15px; margin-bottom: 15px;">
                    
                    <input type="text" 
                           id="game-code" 
                           class="name-input" 
                           placeholder="Kód hry (např. 42)" 
                           style="font-size: 24px; padding: 15px; text-transform: uppercase; letter-spacing: 3px;">
                </div>

                <button class="btn btn-blue" 
                        style="width: auto; padding: 15px 40px; font-size: 18px;" 
                        onclick="app.joinMultiplayerGame()">
                    🎮 Připojit se
                </button>

                <button class="btn btn-blue" 
                        style="width: auto; padding: 12px 30px; margin-top: 20px;" 
                        onclick="app.showMainScreen()">
                    ◀ Zpět
                </button>
            </div>
        `;

        document.getElementById('guest-name').focus();
    }

    async createMultiplayerGame() {
        const nameInput = document.getElementById('host-name');
        const playerName = nameInput.value.trim();

        if (!playerName) {
            alert('Zadej své jméno!');
            nameInput.focus();
            return;
        }

        this.userName = playerName;
        localStorage.setItem('rychlopocty_username', playerName);
       
        const operations = [];
        if (this.savedMultiply) operations.push('*');
        if (this.savedAdd) operations.push('+');
        if (this.savedSubtract) operations.push('-');
        if (this.savedDivide) operations.push('/');
        if (operations.length === 0) operations.push('*');

        console.log('Creating game with operations:', operations);

        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px;">
                <div style="font-size: 24px; margin-bottom: 20px;">⏳ Vytváření hry...</div>
            </div>
        `;

        try {
            const gameCode = await this.multiplayerManager.createGame(playerName, operations);
            
            app.innerHTML = `
                <div class="card" style="text-align: center; padding: 40px;">
                    <div style="font-size: 32px; margin-bottom: 20px;">✅ Hra vytvořena!</div>
                    
                    <div style="font-size: 18px; color: #94a3b8; margin-bottom: 20px;">
                        Sdílej tento kód se soupeřem:
                    </div>
                    
                    <div style="font-size: 48px; font-weight: bold; color: #10b981; 
                                letter-spacing: 5px; padding: 20px; background: #1e293b; 
                                border-radius: 4px; margin: 20px 0;">
                        ${gameCode}
                    </div>

                    <div style="font-size: 16px; font-weight: 600; color: #3b82f6; margin: 20px 0;">
                        📤 Nebo pošli pozvánku:
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; max-width: 600px; margin-left: auto; margin-right: auto;">
                        <button class="btn btn-green" style="padding: 12px; font-size: 13px;" 
                                onclick="app.multiplayerManager.shareViaWhatsApp('${gameCode}')">
                            💬 WhatsApp
                        </button>
                        <button class="btn btn-blue" style="padding: 12px; font-size: 13px;" 
                                onclick="app.multiplayerManager.shareViaMessenger('${gameCode}')">
                            💬 Messenger
                        </button>
                        <button class="btn btn-purple" style="padding: 12px; font-size: 13px;" 
                                onclick="app.multiplayerManager.copyInviteLink('${gameCode}')">
                            🔗 Kopírovat odkaz
                        </button>
                        <button class="btn btn-orange" style="padding: 12px; font-size: 13px;" 
                                onclick="app.multiplayerManager.shareNative('${gameCode}')">
                            📱 Sdílet
                        </button>
                    </div>

                    <div style="font-size: 16px; color: #fbbf24; margin: 30px 0;">
                        ⏳ Čekání na soupeře...
                    </div>

                    <button class="btn btn-red" 
                            style="width: auto; padding: 12px 30px;" 
                            onclick="app.multiplayerManager.disconnect()">
                        🛑 Zrušit hru
                    </button>
                </div>
            `;
        } catch (error) {
            alert('Chyba při vytváření hry: ' + error.message);
            this.showMainScreen();
        }
    }

    async joinMultiplayerGame() {
        const nameInput = document.getElementById('guest-name');
        const codeInput = document.getElementById('game-code');
        const playerName = nameInput.value.trim();
        const gameCode = codeInput.value.trim().toUpperCase();

        if (!playerName) {
            alert('Zadej své jméno!');
            nameInput.focus();
            return;
        }

        if (!gameCode) {
            alert('Zadej kód hry!');
            codeInput.focus();
            return;
        }

        this.userName = playerName;
        localStorage.setItem('rychlopocty_username', playerName);

        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px;">
                <div style="font-size: 24px; margin-bottom: 20px;">⏳ Připojování ke hře...</div>
            </div>
        `;

        try {
            await this.multiplayerManager.joinGame(gameCode, playerName);
        } catch (error) {
            alert('Nepodařilo se připojit ke hře. Zkontroluj kód a zkus to znovu.');
            this.showJoinGameScreen();
        }
    }

    startCustomTime() {
        const input = document.getElementById('customTime');
        const time = parseInt(input.value);
        if (!isNaN(time) && time >= 0) {
            if (time === 0) {
                this.startTest('∞ Trénink', 0);
            } else {
                this.startTest('⏱️ Na čas', time);
            }
        } else {
            input.style.background = '#ef4444';
            setTimeout(() => input.style.background = '#334155', 1000);
        }
    }

    startTest(mode, limit) {
        this.savedMultiply = document.getElementById('op-multiply')?.classList.contains('active') ?? true;
        this.savedAdd = document.getElementById('op-add')?.classList.contains('active') ?? false;
        this.savedSubtract = document.getElementById('op-subtract')?.classList.contains('active') ?? false;
        this.savedDivide = document.getElementById('op-divide')?.classList.contains('active') ?? false;
        
        this.mode = mode;
        this.limit = limit;
        this.correctTimes = [];
        this.allAnswerTimes = [];
        this.correctCount = 0;
        this.wrongCount = 0;
        this.wrongAnswers = [];
        this.running = true;
        this.testStartTime = Date.now();
        this.testEndTime = null;
        this.wasQuit = false;

        this.operations = [];
        if (this.savedMultiply) this.operations.push('*');
        if (this.savedAdd) this.operations.push('+');
        if (this.savedSubtract) this.operations.push('-');
        if (this.savedDivide) this.operations.push('/');
        if (this.operations.length === 0) this.operations = ['*'];

        this.testManager.startTest(mode, limit, this.operations);
    }

    endTest() {
        this.running = false;
        this.wasQuit = true;
        if (this.testManager) {
            this.testManager.clearMotivationTimers();
        }
        this.finishTest();
    }

    async finishTest() {
        this.running = false;
        this.testEndTime = Date.now();
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        if (this.progressInterval) clearInterval(this.progressInterval);
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (this.testManager) {
            this.testManager.clearMotivationTimers();
        }

        const opNames = [];
        if (this.operations.includes('*')) opNames.push('Násobení');
        if (this.operations.includes('+')) opNames.push('Sčítání');
        if (this.operations.includes('-')) opNames.push('Odčítání');
        if (this.operations.includes('/')) opNames.push('Dělení');

        const total = this.correctCount + this.wrongCount;
        const successRate = total > 0 ? Math.round((this.correctCount / total) * 100) : 0;

        let timeStatsHTML = '';
        let saveButtonHTML = '';
        let motivationalText = '';
        let wasSuccessful = false;
        
        if (this.mode === '⏱️ Na čas') {
            if (this.correctCount > 0) {
                const totalTime = (this.testEndTime - this.testStartTime) / 1000;
                const avgTime = (totalTime / this.correctCount).toFixed(2);
                timeStatsHTML = `
                    <div class="time-stats">
                        <div class="time-stat-row">
                            <span class="time-stat-label">⏱️ Průměrný čas na příklad</span>
                            <span class="time-stat-value">${avgTime}s</span>
                        </div>
                    </div>
                `;
            }
            motivationalText = getMotivationalMessage('general', true);
        } else if (this.mode === '∞ Trénink') {
            const totalTime = ((this.testEndTime - this.testStartTime) / 1000).toFixed(2);
            timeStatsHTML = `
                <div class="time-stats">
                    <div class="time-stat-row">
                        <span class="time-stat-label">⏱️ Celkový čas tréninku</span>
                        <span class="time-stat-value">${totalTime}s</span>
                    </div>
                </div>
            `;
            motivationalText = getMotivationalMessage('general', true);
        } else {
            const totalTime = ((this.testEndTime - this.testStartTime) / 1000).toFixed(2);
            
            let last10TimeHTML = '';
            let last10Time = null;
            if (this.allAnswerTimes.length >= 10) {
                const last10Start = this.allAnswerTimes[this.allAnswerTimes.length - 10];
                const last10End = this.allAnswerTimes[this.allAnswerTimes.length - 1];
                last10Time = ((last10End - last10Start) / 1000).toFixed(2);
                last10TimeHTML = `
                    <div class="time-stat-row">
                        <span class="time-stat-label">🎯 Čas posledních 10 příkladů</span>
                        <span class="time-stat-value">${last10Time}s</span>
                    </div>
                `;
                
                wasSuccessful = parseFloat(last10Time) <= this.limit;
                
                if (wasSuccessful) {
                    saveButtonHTML = `
                        <div style="text-align: center; margin: 20px 0;">
                            <input type="text" id="username" class="name-input" placeholder="Zadej své jméno" value="${this.userName}">
                            <button class="btn btn-green" style="width: auto; padding: 12px 30px; margin-top: 10px;" onclick="app.saveToLeaderboard(${last10Time})">🏆 Uložit do žebříčku</button>
                        </div>
                    `;
                }
            }
            
            timeStatsHTML = `
                <div class="time-stats">
                    <div class="time-stat-row">
                        <span class="time-stat-label">⏱️ Celkový čas</span>
                        <span class="time-stat-value">${totalTime}s</span>
                    </div>
                    ${last10TimeHTML}
                </div>
            `;
            
            motivationalText = getMotivationalMessage(this.mode, wasSuccessful, this.wasQuit);
        }

        await updateFirebaseStats(this.correctCount, this.wrongCount);
        
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px;">
                <div class="result-emoji">${this.correctCount > this.wrongCount ? '🎉' : '💪'}</div>
                <div class="result-title">${this.wasQuit ? 'Test ukončen!' : 'Test dokončen!'}</div>
                <div class="result-mode">Režim: ${this.mode}</div>
                <div class="result-mode">Operace: ${opNames.join(', ')}</div>

                ${timeStatsHTML}

                <div style="font-size: 18px; font-weight: 600; color: #fbbf24; margin: 25px 0; padding: 15px; background: #1e293b; border-radius: 4px;">
                    💬 ${motivationalText}
                </div>

                <div class="result-stats">
                    <div class="result-box correct">
                        <div class="result-icon">✅</div>
                        <div class="result-number correct">${this.correctCount}</div>
                        <div class="result-label">Správně</div>
                    </div>
                    <div class="result-box wrong" onclick="app.showErrors()">
                        <div class="result-icon">❌</div>
                        <div class="result-number wrong">${this.wrongCount}</div>
                        <div class="result-label">Chybně</div>
                    </div>
                </div>

                ${total > 0 ? `<div class="success-rate">Úspěšnost: ${successRate}%</div>` : ''}

                ${saveButtonHTML}

                <button class="btn btn-blue" style="width: auto; padding: 12px 30px; margin-top: 10px;" onclick="app.showMainScreen()">🔄 Zkusit znovu</button>
            </div>
        `;
    }

    async saveToLeaderboard(time) {
        const username = await saveToLeaderboard(this.mode, time, this.userName, this.correctCount, this.wrongCount, this.operations, false);
        if (username) {
            this.userName = username;
            showLeaderboards();
        }
    }

    showLeaderboards() {
        showLeaderboards();
    }

    showErrors() {
        if (this.wrongAnswers.length === 0) return;

        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="card" style="padding: 40px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <div class="result-title" style="color: #ef4444;">❌ Chybné odpovědi</div>
                    <div class="result-mode">Celkem chyb: ${this.wrongAnswers.length}</div>
                </div>

                <div class="error-list">
                    ${this.wrongAnswers.map(err => `
                        <div class="error-item">
                            <div class="error-problem">${err.problem}</div>
                            <div class="error-answers">
                                <span class="error-your">Tvoje: <strong>${err.user}</strong></span>
                                <span class="error-correct">Správně: <strong>${err.correct}</strong></span>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div style="text-align: center; margin-top: 30px;">
                    <button class="btn btn-blue" style="width: auto; padding: 12px 30px;" onclick="app.finishTest()">◀ Zpět na výsledky</button>
                </div>
            </div>
        `;
    }
}