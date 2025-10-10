import { updateFirebaseStats } from './stats.js';
import { shareViaWhatsApp, shareViaMessenger, copyInviteLink, shareNative } from './share.js';

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
        this.operations = ['*'];
        this.isRematchInProgress = false;
    }

    initializePeer() {
        return new Promise((resolve, reject) => {
            const customId = this.generateShortId();
            
            // Použijeme lepší PeerJS server + TURN
            this.peer = new Peer(customId, {
                host: '0.peerjs.com',
                port: 443,
                path: '/',
                secure: true,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        {
                            urls: 'turn:openrelay.metered.ca:80',
                            username: 'openrelayproject',
                            credential: 'openrelayproject'
                        },
                        {
                            urls: 'turn:openrelay.metered.ca:443',
                            username: 'openrelayproject',
                            credential: 'openrelayproject'
                        },
                        {
                            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                            username: 'openrelayproject',
                            credential: 'openrelayproject'
                        }
                    ],
                    iceTransportPolicy: 'all'
                },
                debug: 2
            });
            
            this.peer.on('open', (id) => {
                console.log('✅ Peer connected! ID:', id);
                this.gameCode = id.toUpperCase();
                resolve(this.gameCode);
            });

            this.peer.on('error', (err) => {
                console.error('❌ Peer error:', err);
                reject(err);
            });

            this.peer.on('connection', (conn) => {
                console.log('📞 Incoming connection!');
                this.connection = conn;
                this.setupConnection();
            });
        });
    }

    generateShortId() {
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
            if (!this.isRematchInProgress) {
                this.handleDisconnect();
            }
        });

        this.connection.on('error', (err) => {
            console.error('Connection error:', err);
        });
    }

    async createGame(playerName, operations) {
        this.isHost = true;
        this.myName = playerName;
        this.operations = operations;
        await this.initializePeer();
        return this.gameCode;
    }

    async joinGame(gameCode, playerName) {
        this.isHost = false;
        this.myName = playerName;
        this.gameCode = gameCode;

        return new Promise((resolve, reject) => {
            // Stejná konfigurace jako u hosta
            this.peer = new Peer({
                host: '0.peerjs.com',
                port: 443,
                path: '/',
                secure: true,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        {
                            urls: 'turn:openrelay.metered.ca:80',
                            username: 'openrelayproject',
                            credential: 'openrelayproject'
                        },
                        {
                            urls: 'turn:openrelay.metered.ca:443',
                            username: 'openrelayproject',
                            credential: 'openrelayproject'
                        },
                        {
                            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                            username: 'openrelayproject',
                            credential: 'openrelayproject'
                        }
                    ],
                    iceTransportPolicy: 'all'
                },
                debug: 2
            });

            this.peer.on('open', (myId) => {
                console.log('✅ My peer ID:', myId);
                console.log('🔍 Connecting to game code:', gameCode);
                
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
                    
                    const hostPeerId = attempts[attemptIndex];
                    console.log('📞 Attempting connection to:', hostPeerId);
                    
                    this.connection = this.peer.connect(hostPeerId);
                    
                    const connectionTimeout = setTimeout(() => {
                        if (this.connection && this.connection.open === false) {
                            console.log('⏱️ Connection timeout, trying next...');
                            attemptIndex++;
                            tryConnect();
                        }
                    }, 5000); // Zvýšil jsem timeout na 5s
                    
                    this.connection.on('open', () => {
                        clearTimeout(connectionTimeout);
                        console.log('✅ Connection established!');
                        this.setupConnection();
                        this.sendData({
                            type: 'player_joined',
                            name: this.myName
                        });
                        resolve();
                    });

                    this.connection.on('error', (err) => {
                        clearTimeout(connectionTimeout);
                        console.error('❌ Connection error:', err);
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
                console.error('❌ Peer error:', err);
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
                if (this.isHost) {
                    this.sendData({
                        type: 'game_start',
                        hostName: this.myName,
                        operations: this.operations
                    });
                    setTimeout(() => {
                        this.startGame();
                    }, 100);
                }
                break;

            case 'game_start':
                console.log('Game starting, host name:', data.hostName);
                this.opponentName = data.hostName;
                this.operations = data.operations || ['*'];
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

            case 'rematch_request':
                console.log('Rematch request received with game code:', data.gameCode);
                this.handleRematchRequest(data.gameCode);
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

        if (this.isHost) {
            setTimeout(() => {
                this.generateNewQuestion();
            }, 500);
        }
    }

    generateNewQuestion() {
        if (!this.isHost) return;

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

        this.currentQuestion = {a, b, op};
        this.questionStartTime = Date.now();

        console.log('Generated new question:', this.currentQuestion);

        this.sendData({
            type: 'new_question',
            question: this.currentQuestion
        });

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
        
        this.setupAnswerListener();
        
        // Vylepšený focus pro mobil
        setTimeout(() => {
            const input = document.getElementById('mp-answer');
            if (input) {
                input.focus();
                // Pro iOS - zkus kliknout programově
                input.click();
                // Další pokus po malém delay
                setTimeout(() => {
                    input.focus();
                }, 100);
            }
        }, 150);
    }

    focusInput() {
        const input = document.getElementById('mp-answer');
        if (input) {
            input.focus();
        }
    }

    handleOpponentAnswer(data) {
        if (data.correct) {
            console.log('Opponent answered correctly first');
            
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
    }

    updateScoreDisplay() {
        const scoreDiff = this.myScore - this.opponentScore;
        document.getElementById('my-score').textContent = this.myScore;
        document.getElementById('opponent-score').textContent = this.opponentScore;
        document.getElementById('score-diff').textContent = 
            scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff;

        this.updateProgressBar();
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

    async endGame(winnerType) {
        if (this.motivationInterval) {
            clearInterval(this.motivationInterval);
        }
        this.gameActive = false;

        console.log('🎮 endGame zavolána, myScore:', this.myScore);
        console.log('🔍 typeof updateFirebaseStats:', typeof updateFirebaseStats);

        // Uložit statistiky do Firebase - pouze správné odpovědi
        try {
            console.log('📤 Pokouším se uložit do Firebase...');
            await updateFirebaseStats(this.myScore, 0);
            console.log('✅ Statistiky úspěšně uloženy:', this.myScore, 'správných');
        } catch (err) {
            console.error('❌ Chyba při ukládání statistik:', err);
            console.error('❌ Error stack:', err.stack);
        }
        
        let iWon = false;
        if (winnerType === 'me') {
            iWon = true;
        } else if (winnerType === 'host') {
            iWon = this.isHost;
        } else if (winnerType === 'guest') {
            iWon = !this.isHost;
        } else if (winnerType === 'opponent') {
            iWon = false;
        }
        
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

                <div style="display: flex; gap: 15px; justify-content: center; margin-top: 30px; flex-wrap: wrap;">
                    <button class="btn btn-green" style="width: auto; padding: 12px 30px;" 
                            onclick="app.multiplayerManager.rematch()">
                        🔄 Odveta!
                    </button>
                    <button class="btn btn-blue" style="width: auto; padding: 12px 30px;" 
                            onclick="app.showMainScreen()">
                        🏠 Hlavní menu
                    </button>
                </div>
            </div>
        `;
    }

    async rematch() {
        this.isRematchInProgress = true;

        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px;">
                <div style="font-size: 24px; margin-bottom: 20px;">⏳ Vytváření nové hry...</div>
                <div style="font-size: 16px; color: #94a3b8;">Čekání na připojení soupeře</div>
            </div>
        `;

        try {
            if (this.isHost) {
                const oldConnection = this.connection;
                const oldPeer = this.peer;

                const gameCode = await this.createGame(this.myName, this.operations);
                
                if (oldConnection && oldConnection.open) {
                    oldConnection.send({
                        type: 'rematch_request',
                        gameCode: gameCode
                    });
                }

                await new Promise(resolve => setTimeout(resolve, 500));

                if (oldConnection) {
                    oldConnection.close();
                }
                if (oldPeer) {
                    oldPeer.destroy();
                }

                this.myScore = 0;
                this.opponentScore = 0;
                this.gameActive = false;
                this.currentQuestion = null;
                this.questionStartTime = null;
                
                app.innerHTML = `
                    <div class="card" style="text-align: center; padding: 40px;">
                        <div style="font-size: 32px; margin-bottom: 20px;">✅ Hra vytvořena!</div>
                        
                        <div style="font-size: 18px; color: #94a3b8; margin-bottom: 20px;">
                            Kód hry byl automaticky odeslán soupeři
                        </div>
                        
                        <div style="font-size: 48px; font-weight: bold; color: #10b981; 
                                    letter-spacing: 5px; padding: 20px; background: #1e293b; 
                                    border-radius: 4px; margin: 20px 0;">
                            ${gameCode}
                        </div>

                        <div style="font-size: 16px; color: #fbbf24; margin: 30px 0;">
                            ⏳ Čekání na ${this.opponentName}...
                        </div>

                        <button class="btn btn-red" 
                                style="width: auto; padding: 12px 30px;" 
                                onclick="app.multiplayerManager.cancelRematch()">
                            🛑 Zrušit hru
                        </button>
                    </div>
                `;
                
                this.isRematchInProgress = false;
            } else {
                app.innerHTML = `
                    <div class="card" style="text-align: center; padding: 40px;">
                        <div style="font-size: 32px; margin-bottom: 20px;">⏳ Čekání na novou hru</div>
                        
                        <div style="font-size: 18px; color: #94a3b8; margin-bottom: 20px;">
                            ${this.opponentName} vytváří novou místnost...
                        </div>
                        
                        <div style="font-size: 16px; color: #fbbf24; margin: 30px 0;">
                            Automaticky se připojíš, jakmile bude hra připravena
                        </div>

                        <button class="btn btn-red" 
                                style="width: auto; padding: 12px 30px;" 
                                onclick="app.multiplayerManager.cancelRematch()">
                            🛑 Zrušit
                        </button>
                    </div>
                `;
            }
        } catch (error) {
            this.isRematchInProgress = false;
            alert('Chyba při vytváření nové hry: ' + error.message);
            this.app.showMainScreen();
        }
    }

    async handleRematchRequest(gameCode) {
        console.log('Handling rematch request, joining game:', gameCode);
        
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px;">
                <div style="font-size: 24px; margin-bottom: 20px;">⏳ Připojování ke hře...</div>
                <div style="font-size: 16px; color: #94a3b8;">Kód hry: ${gameCode}</div>
            </div>
        `;

        if (this.connection) {
            this.connection.close();
        }
        if (this.peer) {
            this.peer.destroy();
        }

        this.myScore = 0;
        this.opponentScore = 0;
        this.gameActive = false;
        this.currentQuestion = null;
        this.questionStartTime = null;

        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            await this.joinGame(gameCode, this.myName);
            this.isRematchInProgress = false;
        } catch (error) {
            this.isRematchInProgress = false;
            alert('Nepodařilo se připojit k odvetě: ' + error.message);
            this.app.showMainScreen();
        }
    }

    cancelRematch() {
        this.isRematchInProgress = false;
        this.disconnect();
    }

    async joinRematch() {
        const codeInput = document.getElementById('rematch-code');
        const gameCode = codeInput.value.trim().toUpperCase();

        if (!gameCode) {
            alert('Zadej kód hry!');
            codeInput.focus();
            return;
        }

        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="card" style="text-align: center; padding: 40px;">
                <div style="font-size: 24px; margin-bottom: 20px;">⏳ Připojování ke hře...</div>
            </div>
        `;

        try {
            await this.joinGame(gameCode, this.myName);
        } catch (error) {
            alert('Nepodařilo se připojit ke hře. Zkontroluj kód a zkus to znovu.');
            this.rematch();
        }
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

        // Vylepšený focus pro mobil - vícenásobné pokusy
        const tryFocus = () => {
            const input = document.getElementById('mp-answer');
            if (input) {
                input.focus();
                input.click();
            }
        };

        // První pokus okamžitě
        setTimeout(tryFocus, 100);
        // Druhý pokus po 300ms
        setTimeout(tryFocus, 300);
        // Třetí pokus po 500ms
        setTimeout(tryFocus, 500);

        document.getElementById('mp-answer').addEventListener('input', (e) => this.handleAnswerInput(e));

        this.startMotivationMessages();
    }

    setupAnswerListener() {
        const answerInput = document.getElementById('mp-answer');
        if (!answerInput) {
            console.log('Answer input not found!');
            return;
        }

        console.log('Setting up answer listener');

        const newInput = answerInput.cloneNode(true);
        answerInput.parentNode.replaceChild(newInput, answerInput);

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

        if (text.length >= correct.toString().length) {
            const userAnswer = parseInt(text);
            console.log('Checking complete answer:', userAnswer, 'vs', correct);
            
            if (userAnswer === correct) {
                console.log('Answer is CORRECT!');
                const responseTime = Date.now() - this.questionStartTime;
                
                e.target.style.background = '#10b981';
                e.target.disabled = true;
                
                this.sendData({
                    type: 'answer',
                    correct: true,
                    time: responseTime
                });

                this.myScore++;
                this.updateScoreDisplay();
                this.checkWinCondition();
                
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
                    // Vylepšený focus po chybě
                    setTimeout(() => {
                        e.target.focus();
                        e.target.click();
                    }, 100);
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
        if (this.motivationInterval) {
            clearInterval(this.motivationInterval);
        }
        this.gameActive = false;
        if (this.connection) {
            this.connection.close();
        }
        if (this.peer) {
            this.peer.destroy();
        }
        this.app.showMainScreen();
    }

    shareViaWhatsApp(gameCode) {
        shareViaWhatsApp(gameCode, this.myName);
    }

    shareViaMessenger(gameCode) {
        shareViaMessenger(gameCode, this.myName);
    }

    async copyInviteLink(gameCode) {
        await copyInviteLink(gameCode, this.myName);
    }

    async shareNative(gameCode) {
        await shareNative(gameCode, this.myName);
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
}