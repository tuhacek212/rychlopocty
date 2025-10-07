import { TestManager } from './test.js';
import { loadTotalStats, updateFirebaseStats } from './stats.js';
import { showLeaderboards, saveToLeaderboard } from './leaderboard.js';
import { getMotivationalMessage } from './messages.js';

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
        
        this.showMainScreen();
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
                    <div class="checkbox-container">
                        <div class="checkbox-item">
                            <input type="checkbox" id="op-multiply" ${this.savedMultiply ? 'checked' : ''}>
                            <label for="op-multiply">✖️ Násobení</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="op-add" ${this.savedAdd ? 'checked' : ''}>
                            <label for="op-add">➕ Sčítání</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="op-subtract" ${this.savedSubtract ? 'checked' : ''}>
                            <label for="op-subtract">➖ Odčítání</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="op-divide" ${this.savedDivide ? 'checked' : ''}>
                            <label for="op-divide">➗ Dělení</label>
                        </div>
                    </div>

                    <div style="margin-top: auto;">
                        <button class="btn btn-blue" onclick="app.showLeaderboards()">🏆 Žebříčky</button>
                    </div>
                </div>
            </div>
            
            <div style="text-align: center; padding: 20px 0; margin-top: 30px;">
                <div style="font-size: 11px; color: #475569;">Made by JT</div>
            </div>
        `;

        loadTotalStats();
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
        this.savedMultiply = document.getElementById('op-multiply').checked;
        this.savedAdd = document.getElementById('op-add').checked;
        this.savedSubtract = document.getElementById('op-subtract').checked;
        this.savedDivide = document.getElementById('op-divide').checked;
        
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