export class MultiplayerManager {
    constructor(app) {
        this.app = app;
        this.peer = null;
        this.connection = null;
        this.isHost = false;
        this.gameCode = null;
        this.myScore = 0;
        this.opponentScore = 0;
        this.myName = '';
        this.opponentName = '';
        this.currentQuestion = null;
        this.questionStartTime = null;
        this.gameActive = false;
    }

    initializePeer() {
        return new Promise((resolve, reject) => {
            // Vygeneruj krátké custom ID místo náhodného
            const customId = this.generateShortId();
            this.peer = new Peer(customId);
            
            this.peer.on('open', (id) => {
                console.log('Peer ID:', id);
                this.gameCode = id.toUpperCase();
                resolve(this.gameCode);
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                reject(err);
            });

            this.peer.on('connection', (conn) => {
                this.connection = conn;
                this.setupConnection();
            });
        });
    }

    generateShortId() {
    // Vygeneruj krátké 2-číselné ID (10-99)
    return (Math.floor(Math.random() * 90) + 10).toString();
    }

    setupConnection() {
        this.connection.on('open', () => {
            console.log('Connection established');
        });

        this.connection.on('data', (data) => {
            this.handleIncomingData(data);
        });

        this.connection.on('close', () => {
            this.handleDisconnect();
        });

        this.connection.on('error', (err) => {
            console.error('Connection error:', err);
        });
    }

    async createGame(playerName) {
        this.isHost = true;
        this.myName = playerName;
        await this.initializePeer();
        return this.gameCode;
    }

    async joinGame(gameCode, playerName) {
        this.isHost = false;
        this.myName = playerName;
        this.gameCode = gameCode;

        return new Promise((resolve, reject) => {
            this.peer = new Peer();

            this.peer.on('open', (myId) => {
                console.log('My peer ID:', myId);
                console.log('Connecting to game code:', gameCode);
                
                // Připoj se k host peer ID (což je v podstatě ten gameCode, ale lowercase)
                // PeerJS automaticky generuje ID, takže hledáme ID které obsahuje gameCode
                let hostPeerId = null;
                
                // Zkusíme různé formáty peer ID
                const attempts = [
                    gameCode.toLowerCase(),
                    gameCode,
                ];
                
                let attemptIndex = 0;
                const tryConnect = () => {
                    if (attemptIndex >= attempts.length) {
                        reject(new Error('Nepodařilo se připojit ke hře'));
                        return;
                    }
                    
                    hostPeerId = attempts[attemptIndex];
                    console.log('Attempting connection to:', hostPeerId);
                    
                    this.connection = this.peer.connect(hostPeerId);
                    
                    const connectionTimeout = setTimeout(() => {
                        if (this.connection && this.connection.open === false) {
                            console.log('Connection timeout, trying next...');
                            attemptIndex++;
                            tryConnect();
                        }
                    }, 3000);
                    
                    this.connection.on('open', () => {
                        clearTimeout(connectionTimeout);
                        console.log('Connection established!');
                        this.setupConnection();
                        // Pošli své jméno hostovi
                        this.sendData({
                            type: 'player_joined',
                            name: this.myName
                        });
                        resolve();
                    });

                    this.connection.on('error', (err) => {
                        clearTimeout(connectionTimeout);
                        console.error('Connection error:', err);
                        attemptIndex++;
                        if (attemptIndex < attempts.length) {
                            tryConnect();
                        } else {
                            reject(new Error('Nepodařilo se připojit ke hře'));
                        }
                    });
                };
                
                tryConnect();
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                reject(err);
            });
        });
    }

    handleIncomingData(data) {
        console.log('Received data:', data);

        switch(data.type) {
            case 'player_joined':
                console.log('Player joined:', data.name);
                this.opponentName = data.name;
                // Host pošle zpět své jméno a oba začnou hru
                if (this.isHost) {
                    this.sendData({
                        type: 'game_start',
                        hostName: this.myName
                    });
                    // Host musí začít hru až PO odeslání zprávy
                    setTimeout(() => {
                        this.startGame();
                    }, 100);
                }
                break;

            case 'game_start':
                console.log('Game starting, host name:', data.hostName);
                this.opponentName = data.hostName;
                // Guest čeká na první otázku od hosta
                this.showGameScreen();
                break;

            case 'new_question':
                console.log('Received new question:', data.question);
                this.currentQuestion = data.question;
                this.questionStartTime = Date.now();
                this.gameActive = true;
                setTimeout(() => {
                    this.displayQuestion();
                }, 100);
                break;

            case 'answer':
                this.handleOpponentAnswer(data);
                break;

            case 'game_over':
                this.endGame(data.winner);
                break;
        }
    }

    sendData(data) {
        if (this.connection && this.connection.open) {
            this.connection.send(data);
        }
    }

    startGame() {
        console.log('Starting game, isHost:', this.isHost);
        this.gameActive = true;
        this.myScore = 0;
        this.opponentScore = 0;

        this.showGameScreen();

        // Pouze host generuje otázky
        if (this.isHost) {
            setTimeout(() => {
                this.generateNewQuestion();
            }, 500);
        }
    }

    generateNewQuestion() {
        if (!this.isHost) return;

        const operations = ['*', '+', '-', '/'];
        const op = operations[Math.floor(Math.random() * operations.length)];
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

        this.currentQuestion = {a, b, op};
        this.questionStartTime = Date.now();

        console.log('Generated new question:', this.currentQuestion);

        // Pošli otázku soupeři
        this.sendData({
            type: 'new_question',
            question: this.currentQuestion
        });

        // Zobraz otázku (s checknutím že elementy existují)
        setTimeout(() => {
            this.displayQuestion();
        }, 100);
    }

    displayQuestion() {
        const questionElement = document.getElementById('mp-question');
        const answerElement = document.getElementById('mp-answer');
        
        if (!questionElement || !answerElement) {
            console.log('Question elements not ready yet');
            return;
        }

        const symbols = {'*': 'x', '+': '+', '-': '-', '/': ':'};
        const display = symbols[this.currentQuestion.op];
        
        questionElement.textContent = `${this.currentQuestion.a} ${display} ${this.currentQuestion.b}`;
        answerElement.value = '';
        answerElement.disabled = false;
        answerElement.style.background = '#334155';
        
        // Znovu nastav listener pro nový příklad
        this.setupAnswerListener();

// Focus s malým zpožděním aby to fungovalo spolehlivě
setTimeout(() => {
    const input = document.getElementById('mp-answer');
    if (input) {
        input.focus();
    }
}, 200);    
    }

    handleOpponentAnswer(data) {
        if (data.correct) {
            console.log('Opponent answered correctly');
            
            // Soupeř odpověděl správně, přidej mu bod
            this.opponentScore++;
            this.updateScoreDisplay();
            this.checkWinCondition();

            // Zakázat input do dalšího příkladu
            const answerInput = document.getElementById('mp-answer');
            if (answerInput) {
                answerInput.disabled = true;
                answerInput.style.background = '#ef4444';
            }

            // Generuj novou otázku (pouze host)
            if (this.isHost) {
                setTimeout(() => {
                    this.generateNewQuestion();
                }, 1500);
            }
        }
    }

    updateScoreDisplay() {
        const scoreDiff = this.myScore - this.opponentScore;
        document.getElementById('my-score').textContent = this.myScore;
        document.getElementById('opponent-score').textContent = this.opponentScore;
        document.getElementById('score-diff').textContent = 
            scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff;
    }

    checkWinCondition() {
        const diff = Math.abs(this.myScore - this.opponentScore);
        
        if (diff >= 10) {
            const winner = this.myScore > this.opponentScore ? 'me' : 'opponent';
            
            if (this.isHost) {
                this.sendData({
                    type: 'game_over',
                    winner: winner === 'me' ? 'host' : 'guest'
                });
            }
            
            this.endGame(winner);
        }
    }

    endGame(winner) {
        this.gameActive = false;
        
        const winnerName = winner === 'me' ? this.myName : this.opponentName;
        const resultText = winner === 'me' ? '🎉 VYHRÁL JSI!' : '😢 PROHRÁL JSI';
        
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px;">
                <div class="result-emoji" style="font-size: 64px; margin-bottom: 20px;">
                    ${winner === 'me' ? '🏆' : '😔'}
                </div>
                <div class="result-title" style="font-size: 32px; margin-bottom: 10px;">
                    ${resultText}
                </div>
                <div style="font-size: 18px; color: #94a3b8; margin-bottom: 30px;">
                    Vítěz: ${winnerName}
                </div>
                
                <div class="result-stats">
                    <div class="result-box" style="border-color: ${winner === 'me' ? '#10b981' : '#ef4444'};">
                        <div class="result-label">Ty</div>
                        <div class="result-number" style="color: ${winner === 'me' ? '#10b981' : '#ef4444'};">
                            ${this.myScore}
                        </div>
                    </div>
                    <div class="result-box" style="border-color: ${winner === 'opponent' ? '#10b981' : '#ef4444'};">
                        <div class="result-label">Soupeř</div>
                        <div class="result-number" style="color: ${winner === 'opponent' ? '#10b981' : '#ef4444'};">
                            ${this.opponentScore}
                        </div>
                    </div>
                </div>

                <button class="btn btn-blue" style="width: auto; padding: 12px 30px; margin-top: 30px;" 
                        onclick="app.showMainScreen()">
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
            </div>

            <div style="text-align: center; margin-top: 20px;">
                <button class="btn btn-red" style="width: auto; padding: 12px 30px;" 
                        onclick="app.multiplayerManager.disconnect()">
                    🛑 Ukončit hru
                </button>
            </div>
        `;

        this.setupAnswerListener();
    }

    setupAnswerListener() {
        const answerInput = document.getElementById('mp-answer');
        if (!answerInput) {
            console.log('Answer input not found!');
            return;
        }

        console.log('Setting up answer listener');

        // Odstraň všechny listenery použitím replace
        const newInput = answerInput.cloneNode(true);
        answerInput.parentNode.replaceChild(newInput, answerInput);

        // Nastav nový listener
        const finalInput = document.getElementById('mp-answer');
        finalInput.addEventListener('input', (e) => {
            console.log('Input event triggered:', e.target.value);
            this.handleAnswerInput(e);
        });

        console.log('Listener set up successfully');
    }

    handleAnswerInput(e) {
        console.log('handleAnswerInput called, gameActive:', this.gameActive, 'hasQuestion:', !!this.currentQuestion);
        
        if (!this.gameActive || !this.currentQuestion) {
            console.log('Not ready for input');
            return;
        }
        
        const text = e.target.value;
        console.log('Input text:', text);
        
        if (!/^\d+$/.test(text) && text !== '') {
            console.log('Invalid input format');
            return;
        }
        
        if (text === '') return;

        const {a, b, op} = this.currentQuestion;
        let correct;
        
        if (op === '*') correct = a * b;
        else if (op === '+') correct = a + b;
        else if (op === '-') correct = a - b;
        else if (op === '/') correct = Math.floor(a / b);

        console.log('Current question:', this.currentQuestion, 'Correct answer:', correct);

        // Kontrola, jestli je odpověď kompletní
        if (text.length >= correct.toString().length) {
            const userAnswer = parseInt(text);
            console.log('Checking complete answer:', userAnswer, 'vs', correct);
            
            if (userAnswer === correct) {
                console.log('Answer is CORRECT!');
                const responseTime = Date.now() - this.questionStartTime;
                
                e.target.style.background = '#10b981';
                e.target.disabled = true;
                
                // Pošli odpověď soupeři
                this.sendData({
                    type: 'answer',
                    correct: true,
                    time: responseTime
                });

                // Přidej si bod
                this.myScore++;
                this.updateScoreDisplay();
                this.checkWinCondition();
                
                // Pokud jsem host, vygeneruj novou otázku
                if (this.isHost) {
                    setTimeout(() => {
                        this.generateNewQuestion();
                    }, 1500);
                }
            } else {
                console.log('Answer is WRONG');
                e.target.style.background = '#ef4444';
                setTimeout(() => {
                    e.target.value = '';
                    e.target.style.background = '#334155';
                    e.target.focus();
                }, 800);
            
            }
        } else {
            console.log('Answer not complete yet, length:', text.length, 'needed:', correct.toString().length);
        }
    }

    handleDisconnect() {
        if (this.gameActive) {
            alert('Soupeř se odpojil!');
            this.app.showMainScreen();
        }
    }

    disconnect() {
        this.gameActive = false;
        if (this.connection) {
            this.connection.close();
        }
        if (this.peer) {
            this.peer.destroy();
        }
        this.app.showMainScreen();
    }
}