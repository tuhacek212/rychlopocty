import { getDuringTestMessage } from './messages.js';

export class TestManager {
    constructor(app) {
        this.app = app;
        this.currentExample = null;
        this.lastProcessedAnswer = null;
        this.motivationInterval = null;
        this.nextMotivationDelay = 8000; // První po 8 sekundách
        this.motivationTimeout = null;
    }

    startTest(mode, limit, operations) {
        const opNames = [];
        if (operations.includes('*')) opNames.push('Násobení');
        if (operations.includes('+')) opNames.push('Sčítání');
        if (operations.includes('-')) opNames.push('Odčítání');
        if (operations.includes('/')) opNames.push('Dělení');

        // Reset pro nový test
        this.nextMotivationDelay = 8000; // První po 8 sekundách
        this.clearMotivationTimers();

        const appElement = document.getElementById('app');
        appElement.innerHTML = `
            <div class="stats-bar">
                <div class="stat-item">🎮 ${mode}</div>
                <div class="stat-item" style="color: #10b981;">✅ <span id="correct-count">0</span></div>
                <div class="stat-item" style="color: #ef4444;">❌ <span id="wrong-count">0</span></div>
                <div class="stat-item" style="color: #94a3b8; font-size: 12px;">🔢 ${opNames.join(', ')}</div>
            </div>

            <div class="card example-area">
                <div class="history-text" id="history"></div>
                <div class="example-text" id="example">Načítání...</div>
                <input type="text" 
                       inputmode="numeric" 
                       pattern="[0-9]*" 
                       class="answer-input" 
                       id="answer" 
                       autocomplete="off"
                       autocorrect="off"
                       autocapitalize="off"
                       spellcheck="false">
                <div id="motivation-text" style="font-size: 16px; color: #fbbf24; font-weight: 600; margin-top: 20px; min-height: 24px;"></div>
            </div>

            ${mode === '⏱️ Na čas' ? `
                <div style="text-align: center;">
                    <div class="countdown">
                        <div class="countdown-text" id="countdown">⏱️ ${limit}s</div>
                    </div>
                </div>
            ` : `
                <div style="text-align: center; margin: 20px 0;">
                    <div class="countdown">
                        <div class="countdown-text" id="elapsed-timer" style="color: #3b82f6;">⏱️ 0.0s</div>
                    </div>
                </div>
                <div class="progress-section">
                    <div class="progress-label" id="progress-label">0/10</div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
                    </div>
                </div>
            `}

            <div style="text-align: center; margin-top: 20px;">
                <button class="btn btn-red" style="width: auto; padding: 12px 30px;" onclick="app.endTest()">🛑 Ukončit test</button>
            </div>
        `;

        document.getElementById('answer').focus();
        document.getElementById('answer').addEventListener('input', (e) => this.checkAnswer(e));

        if (mode === '⏱️ Na čas') {
            this.app.remainingTime = limit;
            this.app.countdownInterval = setInterval(() => this.updateCountdown(), 1000);
        } else {
            this.app.progressInterval = setInterval(() => this.updateProgress(), 100);
            this.app.timerInterval = setInterval(() => this.updateElapsedTimer(), 100);
        }

        // Spustit motivační věty
        this.scheduleNextMotivation();

        this.newExample();
    }

    newExample() {
        if (!this.app.running) return;

        const op = this.app.operations[Math.floor(Math.random() * this.app.operations.length)];
        let a, b, result;

        if (op === '/') {
            b = Math.floor(Math.random() * 10) + 1;
            result = Math.floor(Math.random() * 10) + 1;
            a = b * result;
        } else if (op === '-') {
            a = Math.floor(Math.random() * 90) + 10;
            b = Math.floor(Math.random() * (a - 9)) + 10;
        } else if (op === '+') {
            a = Math.floor(Math.random() * 99) + 1;
            b = Math.floor(Math.random() * (100 - a)) + 1;
        } else {
            // Násobení
            // Generujeme čísla 3-9 (vynecháváme 1, 2, 10)
            a = Math.floor(Math.random() * 7) + 3; // 3-9
            b = Math.floor(Math.random() * 7) + 3; // 3-9
            
            // S 33% šancí povolíme i jednoduchá čísla (1, 2, 10)
            if (Math.random() < 0.33) {
                a = Math.floor(Math.random() * 10) + 1; // 1-10
                b = Math.floor(Math.random() * 10) + 1; // 1-10
            }
        }

        const symbols = {'*': 'x', '+': '+', '-': '-', '/': ':'};
        const display = symbols[op];

        this.currentExample = {a, b, op, display};
        this.lastProcessedAnswer = null;

        document.getElementById('example').textContent = `${a} ${display} ${b}`;
        document.getElementById('example').style.color = '#f1f5f9';
        const input = document.getElementById('answer');
        input.value = '';
        input.style.background = '#334155';
        input.focus();
    }

    checkAnswer(e) {
        const text = e.target.value;
        if (!/^\d+$/.test(text)) return;

        const {a, b, op, display} = this.currentExample;
        let correct;
        if (op === '*') correct = a * b;
        else if (op === '+') correct = a + b;
        else if (op === '-') correct = a - b;
        else if (op === '/') correct = Math.floor(a / b);

        if (text.length < correct.toString().length) return;

        const answerKey = `${a}-${b}-${op}-${text}`;
        if (this.lastProcessedAnswer === answerKey) return;
        this.lastProcessedAnswer = answerKey;

        const userAnswer = parseInt(text);
        const currentTime = Date.now();

        if (userAnswer === correct) {
            this.app.correctCount++;
            e.target.style.background = '#10b981';
            this.app.correctTimes.push(currentTime);
            this.app.allAnswerTimes.push(currentTime);
            if (this.app.correctTimes.length > 10) {
                this.app.correctTimes = this.app.correctTimes.slice(-10);
            }

            this.updateStats();

            const symbols = {'*': '×', '+': '+', '-': '−', '/': '÷'};
            document.getElementById('history').textContent = `Předchozí: ${a} ${symbols[op]} ${b} = ${userAnswer} ✓`;
            document.getElementById('history').style.color = '#10b981';

            setTimeout(() => this.newExample(), 200);

            if (this.app.mode !== '⏱️ Na čas' && this.app.mode !== '∞ Trénink' && this.app.correctTimes.length === 10) {
                const totalTime = (this.app.correctTimes[9] - this.app.correctTimes[0]) / 1000;
                if (totalTime <= this.app.limit) {
                    this.app.finishTest();
                }
            }
        } else {
            this.app.wrongCount++;
            e.target.style.background = '#ef4444';
            this.app.correctTimes = [];
            
            // Reset časomíry při chybě
            this.app.testStartTime = Date.now();

            const symbols = {'*': '×', '+': '+', '-': '−', '/': '÷'};
            this.app.wrongAnswers.push({
                problem: `${a} ${symbols[op]} ${b}`,
                correct: correct,
                user: userAnswer
            });

            document.getElementById('history').textContent = `Předchozí: ${a} ${symbols[op]} ${b} = ${userAnswer} ✗ (správně: ${correct})`;
            document.getElementById('history').style.color = '#ef4444';

            document.getElementById('example').textContent = `${a} ${display} ${b} = ${correct}`;
            document.getElementById('example').style.color = '#ef4444';

            this.updateStats();

            setTimeout(() => this.newExample(), 1500);
        }
    }

    clearMotivationTimers() {
        if (this.motivationInterval) {
            clearTimeout(this.motivationInterval);
            this.motivationInterval = null;
        }
        if (this.motivationTimeout) {
            clearTimeout(this.motivationTimeout);
            this.motivationTimeout = null;
        }
    }

    scheduleNextMotivation() {
        if (!this.app.running) {
            this.clearMotivationTimers();
            return;
        }
        
        this.motivationInterval = setTimeout(() => {
            if (this.app.running) {
                this.showMotivation();
                // Naplánovat další po náhodné pauze 10-15 sekund
                this.nextMotivationDelay = (Math.floor(Math.random() * 6) + 10) * 1000;
                this.scheduleNextMotivation();
            } else {
                this.clearMotivationTimers();
            }
        }, this.nextMotivationDelay);
    }

    showMotivation() {
        if (!this.app.running) {
            this.clearMotivationTimers();
            return;
        }
        
        const motivationElement = document.getElementById('motivation-text');
        if (motivationElement) {
            const message = getDuringTestMessage();
            motivationElement.textContent = `💬 ${message}`;
            motivationElement.style.opacity = '0';
            motivationElement.style.transition = 'opacity 0.5s';
            
            // Fade in efekt
            setTimeout(() => {
                if (motivationElement && this.app.running) {
                    motivationElement.style.opacity = '1';
                }
            }, 100);
            
            // Fade out po PŘESNĚ 5 sekundách
            this.motivationTimeout = setTimeout(() => {
                if (motivationElement && this.app.running) {
                    motivationElement.style.opacity = '0';
                    setTimeout(() => {
                        if (motivationElement && this.app.running) {
                            motivationElement.textContent = '';
                        }
                    }, 500);
                }
            }, 5000);
        }
    }

    updateStats() {
        document.getElementById('correct-count').textContent = this.app.correctCount;
        document.getElementById('wrong-count').textContent = this.app.wrongCount;
    }

    updateProgress() {
        if (!this.app.running || this.app.mode === '⏱️ Na čas' || this.app.mode === '∞ Trénink') return;

        const now = Date.now();
        const count = this.app.correctTimes.filter(t => (now - t) / 1000 <= this.app.limit).length;

        document.getElementById('progress-label').textContent = `${count}/10`;
        
        const fill = document.getElementById('progress-fill');
        fill.style.width = `${(count / 10) * 100}%`;

        if (count >= 7) fill.style.background = '#10b981';
        else if (count >= 4) fill.style.background = '#f59e0b';
        else fill.style.background = '#3b82f6';
    }

    updateElapsedTimer() {
        if (!this.app.running || this.app.mode === '⏱️ Na čas') return;
        
        const elapsed = (Date.now() - this.app.testStartTime) / 1000;
        const timer = document.getElementById('elapsed-timer');
        if (timer) {
            timer.textContent = `⏱️ ${elapsed.toFixed(1)}s`;
            
            if (this.app.mode === '∞ Trénink') {
                timer.style.color = '#8b5cf6';
            } else if (elapsed > this.app.limit * 1.5) {
                timer.style.color = '#ef4444';
            } else if (elapsed > this.app.limit) {
                timer.style.color = '#f59e0b';
            } else {
                timer.style.color = '#3b82f6';
            }
        }
    }

    updateCountdown() {
        if (!this.app.running || this.app.mode !== '⏱️ Na čas') return;

        this.app.remainingTime--;
        const countdown = document.getElementById('countdown');
        countdown.textContent = `⏱️ ${this.app.remainingTime}s`;

        if (this.app.remainingTime <= 5) countdown.style.color = '#ef4444';
        else if (this.app.remainingTime <= 10) countdown.style.color = '#f59e0b';

        if (this.app.remainingTime <= 0) {
            this.clearMotivationTimers();
            this.app.finishTest();
        }
    }
}