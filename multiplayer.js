import { updateFirebaseStats } from './stats.js';
import { rtdb } from './firebase.js';
import { ref, set, onValue, update, remove, get, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

export class MultiplayerManager {
    constructor(app) {
        this.app = app;
        this.isHost = false;
        this.gameCode = null;
        this.myScore = 0;
        this.opponentScore = 0;
        this.myName = '';
        this.opponentName = '';
        this.currentQuestion = null;
        this.questionStartTime = null;
        this.gameActive = false;
        this.operations = ['*'];
        this.rematchRequested = false;
        this.opponentRematchRequested = false;
        this.gameRef = null;
        this.listeners = [];
        this.myPlayerId = null;
        this.opponentPlayerId = null;
        this.publicGamesListener = null;
    }

    generateShortId() {
    return (Math.floor(Math.random() * 90) + 10).toString();
}

    async createGame(playerName, operations, isPrivate = false) {
        this.isHost = true;
        this.myName = playerName;
        this.operations = operations || ['*'];
        this.myPlayerId = 'host';
        this.opponentPlayerId = 'guest';
        
        this.gameCode = this.generateShortId();
        
        if (!this.gameCode) {
            throw new Error('Failed to generate game code');
        }
        
        this.gameRef = ref(rtdb, `games/${this.gameCode}`);
        
        await set(this.gameRef, {
            gameCode: this.gameCode,
            hostName: this.myName,
            guestName: null,
            hostConnected: true,
            guestConnected: false,
            operations: this.operations,
            status: 'waiting',
            isPrivate: isPrivate,
            createdAt: Date.now(),
            currentQuestion: null,
            hostScore: 0,
            guestScore: 0,
            hostAnswer: null,
            guestAnswer: null,
            gameOver: false,
            winner: null
        });

        const hostConnectedRef = ref(rtdb, `games/${this.gameCode}/hostConnected`);
        const disconnectHandler = await import("https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js");
        disconnectHandler.onDisconnect(hostConnectedRef).set(false);
        
        this.setupGameListener();
        
        return this.gameCode;
    }

    // Real-time listener pro veřejné hry
  startPublicGamesListener(callback) {
    this.stopPublicGamesListener();
    
    const gamesRef = ref(rtdb, 'games');
    
    this.publicGamesListener = onValue(gamesRef, (snapshot) => {
        const games = [];
        
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const game = childSnapshot.val();
                // Zobraz jen hry kde je host připojený a status je waiting
                if (game.status === 'waiting' && 
                    game.hostConnected === true) {
                    games.push(game);
                }
            });
        }
        
        // Seřadit podle času vytvoření (nejnovější první)
        games.sort((a, b) => b.createdAt - a.createdAt);
        
        callback(games);
    });
}

    stopPublicGamesListener() {
        if (this.publicGamesListener && typeof this.publicGamesListener === 'function') {
            this.publicGamesListener();
            this.publicGamesListener = null;
        }
    }

    async joinGame(gameCode, playerName) {
        if (!gameCode) {
            throw new Error('Game code is required');
        }
        
        this.isHost = false;
        this.myName = playerName;
        this.gameCode = gameCode;
        this.myPlayerId = 'guest';
        this.opponentPlayerId = 'host';
        
        this.gameRef = ref(rtdb, `games/${gameCode}`);
        const snapshot = await get(this.gameRef);
        
        if (!snapshot.exists()) {
            throw new Error('Hra s tímto kódem neexistuje');
        }
        
        const gameData = snapshot.val();

        if (gameData.status !== 'waiting') {
            throw new Error('Hra již začala nebo je plná');
        }
        
        this.opponentName = gameData.hostName;
        this.operations = gameData.operations || ['*'];
        
        await update(this.gameRef, {
            guestName: this.myName,
            guestConnected: true,
            status: 'ready'
        });

        const guestConnectedRef = ref(rtdb, `games/${this.gameCode}/guestConnected`);
        const disconnectHandler = await import("https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js");
        disconnectHandler.onDisconnect(guestConnectedRef).set(false);
        
        this.setupGameListener();
    }

    setupGameListener() {
        if (!this.gameRef) {
            console.error('Cannot setup listener: gameRef is null');
            return;
        }
        
        const listener = onValue(this.gameRef, (snapshot) => {
            if (!snapshot.exists()) {
                if (this.gameActive) {
                    alert('Hra byla ukončena');
                    this.app.router.navigate('/');
                }
                return;
            }
            
            const data = snapshot.val();
            console.log('Game data updated:', data);
            
            if (this.isHost) {
                if (data.status === 'ready' && !this.gameActive) {
                    this.opponentName = data.guestName;
                    console.log('Guest joined, starting game...');
                    setTimeout(() => this.startGame(), 100);
                }
                
                if (!data.guestConnected && this.gameActive) {
                    alert('Soupeř se odpojil!');
                    this.disconnect();
                }
            } else {
                if (data.status === 'playing' && !this.gameActive) {
                    console.log('Game started by host');
                    this.gameActive = true;
                    this.showGameScreen();
                }
                
                if (!data.hostConnected && this.gameActive) {
                    alert('Soupeř se odpojil!');
                    this.disconnect();
                }
            }
            
            if (data.currentQuestion) {
                console.log('New question received:', data.currentQuestion);
                this.handleNewQuestion(data.currentQuestion);
            }
            
            if (this.isHost) {
                this.opponentScore = data.guestScore || 0;
                if (data.guestAnswer !== null && data.guestAnswer !== this.lastGuestAnswer) {
                    this.lastGuestAnswer = data.guestAnswer;
                    this.handleOpponentAnswer(data.guestAnswer);
                }
            } else {
                this.opponentScore = data.hostScore || 0;
                if (data.hostAnswer !== null && data.hostAnswer !== this.lastHostAnswer) {
                    this.lastHostAnswer = data.hostAnswer;
                    this.handleOpponentAnswer(data.hostAnswer);
                }
            }
            
            this.updateScoreDisplay();
            
            if (data.gameOver && this.gameActive) {
                this.endGame(data.winner);
            }
            
            if (data.rematchHost && !this.isHost) {
                this.handleRematchRequest();
            }
            if (data.rematchGuest && this.isHost) {
                this.handleRematchRequest();
            }
            
            if (data.rematchHost && data.rematchGuest && !this.gameActive) {
                this.startRematch();
            }
        });
        
        this.listeners.push(listener);
    }

    async startGame() {
        this.gameActive = true;
        this.myScore = 0;
        this.opponentScore = 0;
        this.lastGuestAnswer = null;
        this.lastHostAnswer = null;

        await update(this.gameRef, {
            status: 'playing',
            hostScore: 0,
            guestScore: 0,
            hostAnswer: null,
            guestAnswer: null,
            gameOver: false,
            winner: null
        });

        this.showGameScreen();

        if (this.isHost) {
            setTimeout(() => {
                this.generateNewQuestion();
            }, 500);
        }
    }

    async generateNewQuestion() {
        if (!this.isHost || !this.gameActive) return;

        if (!this.operations || this.operations.length === 0) {
            this.operations = ['*'];
        }

        const op = this.operations[Math.floor(Math.random() * this.operations.length)];
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
            a = Math.floor(Math.random() * 7) + 3;
            b = Math.floor(Math.random() * 7) + 3;
            
            if (Math.random() < 0.33) {
                a = Math.floor(Math.random() * 10) + 1;
                b = Math.floor(Math.random() * 10) + 1;
            }
        }

        const question = {a, b, op, timestamp: Date.now()};
        
        await update(this.gameRef, {
            currentQuestion: question,
            hostAnswer: null,
            guestAnswer: null
        });
    }

    handleNewQuestion(question) {
        if (!question) {
            console.log('No question received');
            return;
        }
        
        console.log('Processing question:', question, 'Last timestamp:', this.lastQuestionTimestamp);
        
        if (question.timestamp === this.lastQuestionTimestamp) {
            console.log('Question already processed, skipping');
            return;
        }
        
        this.lastQuestionTimestamp = question.timestamp;
        this.currentQuestion = question;
        this.questionStartTime = Date.now();
        
        console.log('Displaying new question immediately');
        this.displayQuestion();
    }

    displayQuestion() {
    const questionElement = document.getElementById('mp-question');
    const answerElement = document.getElementById('mp-answer');
    
    console.log('displayQuestion called', {
        questionElement: !!questionElement,
        answerElement: !!answerElement,
        currentQuestion: this.currentQuestion
    });
    
    if (!questionElement || !answerElement || !this.currentQuestion) {
        console.log('Cannot display question - missing elements or question');
        return;
    }

    const symbols = {'*': 'x', '+': '+', '-': '-', '/': ':'};
    const display = symbols[this.currentQuestion.op];
    
    questionElement.textContent = `${this.currentQuestion.a} ${display} ${this.currentQuestion.b}`;
    answerElement.value = '';
    answerElement.disabled = false;
    answerElement.style.background = '#334155';
    
    setTimeout(() => {
        const input = document.getElementById('mp-answer');
        if (input) {
            input.focus();
        }
    }, 200);
    
    console.log('Question displayed:', questionElement.textContent);
    
    this.setupAnswerListener();
}

    async handleOpponentAnswer(answerData) {
        if (!answerData || !answerData.correct) return;
        
        this.opponentScore++;
        this.updateScoreDisplay();
        this.checkWinCondition();

        const answerInput = document.getElementById('mp-answer');
        if (answerInput) {
            answerInput.disabled = true;
            answerInput.style.background = '#64748b';
        }

        if (this.isHost) {
            setTimeout(() => {
                this.generateNewQuestion();
            }, 1500);
        }
    }

    updateScoreDisplay() {
        const myScoreEl = document.getElementById('my-score');
        const opponentScoreEl = document.getElementById('opponent-score');
        const scoreDiffEl = document.getElementById('score-diff');
        
        if (myScoreEl) myScoreEl.textContent = this.myScore;
        if (opponentScoreEl) opponentScoreEl.textContent = this.opponentScore;
        
        if (scoreDiffEl) {
            const scoreDiff = this.myScore - this.opponentScore;
            scoreDiffEl.textContent = scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff;
        }

        this.updateProgressBar();
    }

    async checkWinCondition() {
        const diff = Math.abs(this.myScore - this.opponentScore);
        
        if (diff >= 10) {
            const winner = this.myScore > this.opponentScore ? this.myPlayerId : this.opponentPlayerId;
            
            await update(this.gameRef, {
                gameOver: true,
                winner: winner
            });
        }
    }

    endGame(winner) {
        if (this.motivationInterval) {
            clearInterval(this.motivationInterval);
        }
        this.gameActive = false;

        if (typeof updateFirebaseStats === 'function') {
            updateFirebaseStats(this.myScore, 0).catch(err => {
                console.error('Chyba při ukládání statistik:', err);
            });
        }
        
        const iWon = winner === this.myPlayerId;
        
        const winnerName = iWon ? this.myName : this.opponentName;
        const resultText = iWon ? '🎉 VYHRÁL JSI!' : '😢 PROHRÁL JSI';
        const resultEmoji = iWon ? '🏆' : '😔';
        
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px;">
                <div class="result-emoji" style="font-size: 64px; margin-bottom: 20px;">
                    ${resultEmoji}
                </div>
                <div class="result-title" style="font-size: 32px; margin-bottom: 10px;">
                    ${resultText}
                </div>
                <div style="font-size: 18px; color: #94a3b8; margin-bottom: 30px;">
                    Vítěz: ${winnerName}
                </div>
                
                <div class="result-stats">
                    <div class="result-box" style="border-color: ${iWon ? '#10b981' : '#ef4444'};">
                        <div class="result-label">Ty</div>
                        <div class="result-number" style="color: ${iWon ? '#10b981' : '#ef4444'};">
                            ${this.myScore}
                        </div>
                    </div>
                    <div class="result-box" style="border-color: ${!iWon ? '#10b981' : '#ef4444'};">
                        <div class="result-label">Soupeř</div>
                        <div class="result-number" style="color: ${!iWon ? '#10b981' : '#ef4444'};">
                            ${this.opponentScore}
                        </div>
                    </div>
                </div>

                <button class="btn btn-green" id="rematch-btn" style="width: auto; padding: 12px 30px; margin-top: 30px;" 
                        onclick="app.multiplayerManager.requestRematch()">
                    🔄 Odveta
                </button>

                <button class="btn btn-blue" style="width: auto; padding: 12px 30px; margin-top: 10px;" 
                        onclick="app.multiplayerManager.disconnect()">
                    🏠 Zpět na hlavní obrazovku
                </button>
            </div>
        `;
    }

    showGameScreen() {
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="stats-bar" style="justify-content: space-between;">
                <div class="stat-item" style="color: #3b82f6;">
                    👤 ${this.myName}: <span id="my-score">0</span>
                </div>
                <div class="stat-item" style="color: #fbbf24; font-size: 20px; font-weight: bold;">
                    <span id="score-diff">0</span>
                </div>
                <div class="stat-item" style="color: #ef4444;">
                    👤 ${this.opponentName}: <span id="opponent-score">0</span>
                </div>
            </div>

            <div class="card example-area">
                <div style="font-size: 14px; color: #94a3b8; margin-bottom: 20px;">
                    První na +10 bodů vyhrává!
                </div>
                <div class="example-text" id="mp-question">Čekání...</div>
                <input type="text" 
                       inputmode="numeric" 
                       pattern="[0-9]*" 
                       class="answer-input" 
                       id="mp-answer" 
                       autocomplete="off"
                       autocorrect="off"
                       autocapitalize="off"
                       spellcheck="false">
                <div id="mp-motivation-text" style="font-size: 16px; color: #fbbf24; font-weight: 600; margin-top: 20px; min-height: 24px;"></div>
            </div>

            <div class="progress-section" style="margin-top: 20px;">
                <div style="width: 100%; max-width: 600px; margin: 0 auto; position: relative; height: 30px; background: #334155; border-radius: 2px; overflow: hidden;">
                    <div style="position: absolute; right: 50%; height: 100%; background: #ef4444; transition: width 0.3s;" id="mp-progress-opponent"></div>
                    <div style="position: absolute; left: 50%; height: 100%; background: #3b82f6; transition: width 0.3s;" id="mp-progress-me"></div>
                    <div style="position: absolute; left: 50%; top: 0; width: 2px; height: 100%; background: #fbbf24; z-index: 10;"></div>
                </div>
            </div>

            <div style="text-align: center; margin-top: 20px;">
                <button class="btn btn-red" style="width: auto; padding: 12px 30px;" 
                        onclick="app.multiplayerManager.disconnect()">
                    🛑 Ukončit hru
                </button>
            </div>
        `;

        this.setupAnswerListener();
        this.startMotivationMessages();
    }

    setupAnswerListener() {
        const answerInput = document.getElementById('mp-answer');
        if (!answerInput) {
            return;
        }

        const newInput = answerInput.cloneNode(true);
        answerInput.parentNode.replaceChild(newInput, answerInput);

        const finalInput = document.getElementById('mp-answer');
        finalInput.addEventListener('input', (e) => {
            this.handleAnswerInput(e);
        });
    }

    async handleAnswerInput(e) {
        if (!this.gameActive || !this.currentQuestion) {
            return;
        }
        
        const text = e.target.value;
        
        if (!/^\d+$/.test(text) && text !== '') {
            return;
        }
        
        if (text === '') return;

        const {a, b, op} = this.currentQuestion;
        let correct;
        
        if (op === '*') correct = a * b;
        else if (op === '+') correct = a + b;
        else if (op === '-') correct = a - b;
        else if (op === '/') correct = Math.floor(a / b);

        if (text.length >= correct.toString().length) {
            const userAnswer = parseInt(text);
            
            if (userAnswer === correct) {
                const responseTime = Date.now() - this.questionStartTime;
                
                e.target.style.background = '#10b981';
                e.target.disabled = true;
                
                this.myScore++;
                
                const updateData = {};
                if (this.isHost) {
                    updateData.hostScore = this.myScore;
                    updateData.hostAnswer = {
                        correct: true,
                        time: responseTime,
                        timestamp: Date.now()
                    };
                } else {
                    updateData.guestScore = this.myScore;
                    updateData.guestAnswer = {
                        correct: true,
                        time: responseTime,
                        timestamp: Date.now()
                    };
                }
                
                await update(this.gameRef, updateData);
                
                this.updateScoreDisplay();
                this.checkWinCondition();
                
                if (this.isHost) {
                    setTimeout(() => {
                        this.generateNewQuestion();
                    }, 1500);
                }
            } else {
                e.target.style.background = '#ef4444';
                setTimeout(() => {
                    e.target.value = '';
                    e.target.style.background = '#334155';
                    e.target.focus();
                }, 800);
            }
        }
    }

    async disconnect() {
        if (this.motivationInterval) {
            clearInterval(this.motivationInterval);
        }
        this.gameActive = false;
        
        this.stopPublicGamesListener();
        
        this.listeners.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.listeners = [];
        
        if (this.gameRef) {
            try {
                if (this.isHost) {
                    await remove(this.gameRef);
                } else {
                    await update(this.gameRef, {
                        guestConnected: false
                    });
                }
            } catch (err) {
                console.error('Error disconnecting:', err);
            }
        }
        
        this.app.router.navigate('/');
    }
    
    startMotivationMessages() {
        import('./messages.js').then(module => {
            const showMessage = () => {
                if (!this.gameActive) return;
                
                const message = module.getDuringTestMessage();
                const motivationElement = document.getElementById('mp-motivation-text');
                
                if (motivationElement) {
                    motivationElement.textContent = `💬 ${message}`;
                    motivationElement.style.opacity = '0';
                    motivationElement.style.transition = 'opacity 0.5s';
                    
                    setTimeout(() => {
                        if (motivationElement && this.gameActive) {
                            motivationElement.style.opacity = '1';
                        }
                    }, 100);
                    
                    setTimeout(() => {
                        if (motivationElement && this.gameActive) {
                            motivationElement.style.opacity = '0';
                            setTimeout(() => {
                                if (motivationElement && this.gameActive) {
                                    motivationElement.textContent = '';
                                }
                            }, 500);
                        }
                    }, 5000);
                }
            };
            
            setTimeout(() => {
                if (this.gameActive) {
                    showMessage();
                    this.motivationInterval = setInterval(() => {
                        if (this.gameActive) {
                            showMessage();
                        } else {
                            clearInterval(this.motivationInterval);
                        }
                    }, (Math.floor(Math.random() * 6) + 10) * 1000);
                }
            }, 8000);
        });
    }

    updateProgressBar() {
        const myProgress = document.getElementById('mp-progress-me');
        const opponentProgress = document.getElementById('mp-progress-opponent');
        
        if (!myProgress || !opponentProgress) return;
        
        const diff = this.myScore - this.opponentScore;
        const maxDiff = 10;
        
        if (diff > 0) {
            const myWidth = (diff / maxDiff) * 50;
            myProgress.style.width = `${myWidth}%`;
            opponentProgress.style.width = '0%';
            
            if (diff > 5) {
                myProgress.style.background = '#10b981';
            } else {
                myProgress.style.background = '#3b82f6';
            }
        } else if (diff < 0) {
            const opponentWidth = (Math.abs(diff) / maxDiff) * 50;
            opponentProgress.style.width = `${opponentWidth}%`;
            myProgress.style.width = '0%';
            
            if (Math.abs(diff) > 5) {
                opponentProgress.style.background = '#dc2626';
            } else {
                opponentProgress.style.background = '#ef4444';
            }
        } else {
            myProgress.style.width = '0%';
            opponentProgress.style.width = '0%';
        }
    }

    async requestRematch() {
        this.rematchRequested = true;
        
        const updateData = {};
        if (this.isHost) {
            updateData.rematchHost = true;
        } else {
            updateData.rematchGuest = true;
        }
        
        await update(this.gameRef, updateData);
        
        const rematchBtn = document.getElementById('rematch-btn');
        if (rematchBtn) {
            rematchBtn.textContent = '⏳ Čekání na soupeře...';
            rematchBtn.disabled = true;
            rematchBtn.style.opacity = '0.6';
        }
    }

    handleRematchRequest() {
        this.opponentRematchRequested = true;
        
        const rematchBtn = document.getElementById('rematch-btn');
        if (rematchBtn && !this.rematchRequested) {
            rematchBtn.textContent = '✅ Soupeř chce odvetu!';
            rematchBtn.style.animation = 'pulse 1s infinite';
        }
    }

    async startRematch() {
        this.rematchRequested = false;
        this.opponentRematchRequested = false;
        this.myScore = 0;
        this.opponentScore = 0;
        this.currentQuestion = null;
        this.questionStartTime = null;
        
        await update(this.gameRef, {
            rematchHost: false,
            rematchGuest: false,
            status: 'playing',
            hostScore: 0,
            guestScore: 0,
            hostAnswer: null,
            guestAnswer: null,
            gameOver: false,
            winner: null,
            currentQuestion: null
        });
        
        this.startGame();
    }
}