import { TestManager } from './test.js';
import { loadTotalStats, updateFirebaseStats } from './stats.js';
import { showLeaderboards, saveToLeaderboard } from './leaderboard.js';
import { getMotivationalMessage } from './messages.js';
import { MultiplayerManager } from './multiplayer.js';
import { Router } from './router.js';

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
        this.router = new Router();
        
        this.setupRoutes();
        this.router.start();
    }

    setupRoutes() {
        this.router.addRoute('/', () => {
            this.showMainScreen();
            this.setActiveTab('training');
        });
        this.router.addRoute('/test', () => {
            if (!this.running) {
                this.router.navigate('/', true);
            }
        });
        this.router.addRoute('/leaderboard', () => {
            this.showMainScreen();
            this.setActiveTab('leaderboard');
            setTimeout(() => this.showLeaderboardScreen(), 100);
        });
        this.router.addRoute('/multiplayer', () => {
            this.showMainScreen();
            this.setActiveTab('multiplayer');
            setTimeout(() => this.showMultiplayerScreen(), 100);
        });
        this.router.addRoute('/multiplayer/lobby/:gameCode', (params) => this.showLobbyScreen(params.gameCode));
    }

    setActiveTab(tabName) {
        setTimeout(() => {
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            const activeBtn = document.querySelector('[data-tab="' + tabName + '"]');
            if (activeBtn) {
                activeBtn.classList.add('active');
            }
        }, 50);
    }

    async showMainScreen() {
        const app = document.getElementById('app');
        const header = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 20px;"><div style="text-align: left;"><div style="font-size: 32px; font-weight: bold; margin-bottom: 5px;">⚡ Rychlopočty</div><div style="font-size: 14px; color: #94a3b8;">Trénuj a sdílej své matematické dovednosti</div></div><div id="total-stats" style="text-align: right;"><div style="font-size: 11px; color: #64748b; margin-bottom: 3px;">⏳ Načítání statistik...</div></div></div>';
        
        const tabs = '<div class="tab-menu"><button class="tab-btn active" data-tab="training" onclick="app.switchTab(\'training\')">🏠 Trénink</button><button class="tab-btn" data-tab="leaderboard" onclick="app.switchTab(\'leaderboard\')">🏆 Žebříčky</button><button class="tab-btn" data-tab="multiplayer" onclick="app.switchTab(\'multiplayer\')">🎮 Multiplayer</button></div>';
        
        const content = '<div id="tab-content" class="tab-content">' + this.getTrainingContent() + '</div>';
        
        const footer = '<div style="text-align: center; padding: 20px 0; margin-top: 30px;"><div style="font-size: 11px; color: #475569;">Made by JT</div></div>';
        
        app.innerHTML = header + tabs + content + footer;

        loadTotalStats();
    }

    getTrainingContent() {
        return '<div class="two-column"><div class="card"><div class="section-title">🎯 Vyber obtížnost</div><button class="btn btn-green" onclick="app.startTest(\'Lehká\', 30)">Lehká</button><div class="time-desc">30 sekund</div><button class="btn btn-yellow" onclick="app.startTest(\'Střední\', 22)">Střední</button><div class="time-desc">22 sekund</div><button class="btn btn-orange" onclick="app.startTest(\'Obtížná\', 15)">Obtížná</button><div class="time-desc">15 sekund</div><button class="btn btn-red" onclick="app.startTest(\'Expert\', 10)">Expert</button><div class="time-desc">10 sekund</div><div class="section-title" style="margin-top: 20px;">⏱️ Vlastní čas</div><div class="custom-time"><input type="number" id="customTime" placeholder="0" min="0" value="0"><span style="color: #94a3b8; font-size: 10px;">sekund (0 = nekonečný trénink)</span></div><button class="btn btn-purple" onclick="app.startCustomTime()">🚀 Start na čas</button></div><div class="card" style="display: flex; flex-direction: column;"><div class="section-title">🔢 Vyber operace</div><div class="operations-grid"><button class="operation-btn ' + (this.savedMultiply ? 'active' : '') + '" id="op-multiply" onclick="app.toggleOperation(\'multiply\')">✖️ Násobení</button><br><button class="operation-btn ' + (this.savedAdd ? 'active' : '') + '" id="op-add" onclick="app.toggleOperation(\'add\')">➕ Sčítání</button><br><button class="operation-btn ' + (this.savedSubtract ? 'active' : '') + '" id="op-subtract" onclick="app.toggleOperation(\'subtract\')">➖ Odčítání</button><br><button class="operation-btn ' + (this.savedDivide ? 'active' : '') + '" id="op-divide" onclick="app.toggleOperation(\'divide\')">➗ Dělení</button></div></div></div>';
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');

        const routes = {
            'training': '/',
            'leaderboard': '/leaderboard',
            'multiplayer': '/multiplayer'
        };
        
        this.router.navigate(routes[tabName]);
    }

    showLeaderboardScreen() {
        const tabContent = document.getElementById('tab-content');
        if (!tabContent) {
            this.showMainScreen();
            setTimeout(() => this.showLeaderboardScreen(), 100);
            return;
        }
        showLeaderboards();
    }

    showMultiplayerScreen() {
        const tabContent = document.getElementById('tab-content');
        if (!tabContent) {
            this.showMainScreen();
            setTimeout(() => this.showMultiplayerScreen(), 100);
            return;
        }
        this.renderMultiplayerContent();
        
        // Focus po renderu - stejně jako v displayQuestion
        setTimeout(() => {
            const nameInput = document.getElementById('mp-name');
            if (nameInput) {
                nameInput.focus();
            }
        }, 200);
    }

    renderMultiplayerContent() {
        const tabContent = document.getElementById('tab-content');
        if (!tabContent) return;

        tabContent.innerHTML = '<div class="two-column" style="margin-top: 20px;"><div class="card"><div class="section-title">✏️ Zadej jméno</div><div style="margin: 20px 0;"><input type="text" id="mp-name" class="name-input" placeholder="Tvoje jméno" value="' + this.userName + '" style="font-size: 18px; padding: 15px;"></div><button class="btn btn-green" id="create-game-btn" style="width: 100%; padding: 15px; font-size: 18px; position: relative;" onclick="app.createMultiplayerGame()">🚀 Vytvořit místnost</button><label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 12px 15px; margin-top: 10px; background: #1e293b; border-radius: 4px; justify-content: center;"><input type="checkbox" id="private-game" style="width: 18px; height: 18px; cursor: pointer;"><span style="font-size: 14px; color: #94a3b8;">🔒 Pouze s kódem (soukromá)</span></label></div><div class="card"><div class="section-title">🌐 Všechny hry</div><div id="public-games-list" style="min-height: 150px; margin-bottom: 20px;"><div style="text-align: center; color: #94a3b8; padding: 40px 20px;">⏳ Načítání her...</div></div><div style="border-top: 1px solid #334155; padding-top: 20px;"><div style="font-size: 14px; color: #94a3b8; margin-bottom: 10px; text-align: center;">Zadej kód hry:</div><input type="text" id="game-code" class="name-input" placeholder="např. 42" maxlength="2" style="font-size: 32px; padding: 15px; text-align: center; letter-spacing: 8px;" oninput="app.handleGameCodeInput(this)"></div></div></div>';

        // Focus na jméno po krátké prodlevě (aby DOM byl ready)
        setTimeout(() => {
            const nameInput = document.getElementById('mp-name');
            if (nameInput) {
                nameInput.focus();
                nameInput.select();
            }
        }, 100);
        
        this.startPublicGamesListener();
    }

    startPublicGamesListener() {
        this.multiplayerManager.startPublicGamesListener((games) => {
            this.renderPublicGames(games);
        });
    }

    renderPublicGames(games) {
        const container = document.getElementById('public-games-list');
        if (!container) return;

        if (games.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 40px 20px;">😔 Žádné hry<br><span style="font-size: 12px;">Založte novou hru</span></div>';
            return;
        }

        const opIcons = { '*': '✖️', '+': '➕', '-': '➖', '/': '➗' };

        const gamesListHTML = games.map(game => {
            const opsDisplay = game.operations.map(op => opIcons[op] || op).join(' ');
            const timeAgo = this.getTimeAgo(game.createdAt);
            const isPrivate = game.isPrivate || false;
            
            // Soukromé hry jsou neklikatelné a mají zámek
            if (isPrivate) {
                return '<div style="background: #1e293b; padding: 15px; border-radius: 4px; margin-bottom: 10px; border: 1px solid #334155; opacity: 0.7;"><div style="display: flex; justify-content: space-between; align-items: center;"><div style="text-align: left; flex: 1;"><div style="font-size: 18px; font-weight: bold; color: #94a3b8; margin-bottom: 3px;">🔒 ' + game.hostName + '</div><div style="font-size: 13px; color: #64748b;">' + opsDisplay + ' • ' + timeAgo + '</div></div><div style="display: flex; align-items: center; gap: 10px;"><div style="font-size: 14px; color: #64748b;">Zadej kód</div></div></div></div>';
            }
            
            // Veřejné hry jsou klikatelné
            return '<div style="background: #1e293b; padding: 15px; border-radius: 4px; margin-bottom: 10px; cursor: pointer; transition: background 0.2s; border: 1px solid #334155;" onmouseover="this.style.background=\'#334155\'; this.style.borderColor=\'#3b82f6\'" onmouseout="this.style.background=\'#1e293b\'; this.style.borderColor=\'#334155\'" onclick="app.joinPublicGame(\'' + game.gameCode + '\')"><div style="display: flex; justify-content: space-between; align-items: center;"><div style="text-align: left; flex: 1;"><div style="font-size: 18px; font-weight: bold; color: #10b981; margin-bottom: 3px;">👤 ' + game.hostName + '</div><div style="font-size: 13px; color: #94a3b8;">' + opsDisplay + ' • ' + timeAgo + '</div></div><div style="display: flex; align-items: center; gap: 10px;"><div style="font-size: 16px; color: #64748b; font-family: monospace;">#' + game.gameCode + '</div><div style="font-size: 24px; color: #3b82f6;">▶️</div></div></div></div>';
        }).join('');

        container.innerHTML = gamesListHTML;
    }

    getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'právě teď';
        const minutes = Math.floor(seconds / 60);
        if (minutes === 1) return 'před minutou';
        if (minutes < 5) return 'před ' + minutes + ' minutami';
        return 'před ' + minutes + ' min';
    }

    async createMultiplayerGame() {
        const nameInput = document.getElementById('mp-name');
        const playerName = nameInput ? nameInput.value.trim() : '';
        const privateCheckbox = document.getElementById('private-game');
        const isPrivate = privateCheckbox ? privateCheckbox.checked : false;

        if (!playerName) {
            alert('Zadej své jméno!');
            if (nameInput) nameInput.focus();
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

        try {
            const gameCode = await this.multiplayerManager.createGame(playerName, operations, isPrivate);
            
            // Zobraz vytvořenou hru v pravém sloupci
            this.showCreatedGameInList(gameCode);
        } catch (error) {
            alert('Chyba při vytváření hry: ' + error.message);
        }
    }

    showCreatedGameInList(gameCode) {
        const gamesContainer = document.getElementById('public-games-list');
        if (!gamesContainer) return;
        
        const myGameHTML = '<div style="background: #1e293b; padding: 20px; border-radius: 4px; margin-bottom: 15px; border: 2px solid #10b981;"><div style="text-align: center;"><div style="font-size: 18px; font-weight: bold; color: #10b981; margin-bottom: 10px;">✅ Tvoje hra vytvořena!</div><div style="font-size: 14px; color: #94a3b8; margin-bottom: 15px;">Kód hry:</div><div style="font-size: 48px; font-weight: bold; color: #10b981; letter-spacing: 10px; font-family: monospace;">' + gameCode + '</div><div style="font-size: 14px; color: #fbbf24; margin-top: 15px;">⏳ Čekání na soupeře...</div><button class="btn btn-red" style="width: auto; padding: 10px 20px; margin-top: 15px; font-size: 14px;" onclick="app.cancelMyGame()">🛑 Zrušit</button></div></div>';
        
        // Vlož na začátek seznamu
        const currentContent = gamesContainer.innerHTML;
        if (currentContent.includes('Načítání') || currentContent.includes('Žádné')) {
            gamesContainer.innerHTML = myGameHTML;
        } else {
            gamesContainer.innerHTML = myGameHTML + currentContent;
        }
    }

    async cancelMyGame() {
        await this.multiplayerManager.disconnect();
        // Znovu načti multiplayer screen
        this.renderMultiplayerContent();
    }

    handleGameCodeInput(input) {
        const code = input.value.trim();
        
        // Jakmile je zadáno 2místné číslo, automaticky připoj
        if (code.length === 2 && /^\d{2}$/.test(code)) {
            this.joinGameByCode(code);
        }
    }

    async joinGameByCode(gameCode) {
        const nameInput = document.getElementById('mp-name');
        const playerName = nameInput ? nameInput.value.trim() : '';

        if (!playerName) {
            alert('Nejdřív zadej své jméno nahoře!');
            if (nameInput) nameInput.focus();
            // Vyčisti kód
            const codeInput = document.getElementById('game-code');
            if (codeInput) codeInput.value = '';
            return;
        }

        this.userName = playerName;
        localStorage.setItem('rychlopocty_username', playerName);

        const tabContent = document.getElementById('tab-content');
        if (tabContent) {
            tabContent.innerHTML = '<div class="card" style="text-align: center; padding: 40px;"><div style="font-size: 24px; margin-bottom: 20px;">⏳ Připojování ke hře...</div></div>';
        }

        try {
            await this.multiplayerManager.joinGame(gameCode, playerName);
        } catch (error) {
            alert('Nepodařilo se připojit ke hře. Zkontroluj kód a zkus to znovu.');
            this.router.navigate('/multiplayer');
        }
    }

    async joinPublicGame(gameCode) {
        const nameInput = document.getElementById('mp-name');
        const playerName = nameInput ? nameInput.value.trim() : '';

        if (!playerName) {
            alert('Nejdřív zadej své jméno nahoře!');
            if (nameInput) nameInput.focus();
            return;
        }

        this.userName = playerName;
        localStorage.setItem('rychlopocty_username', playerName);

        const tabContent = document.getElementById('tab-content');
        if (tabContent) {
            tabContent.innerHTML = '<div class="card" style="text-align: center; padding: 40px;"><div style="font-size: 24px; margin-bottom: 20px;">⏳ Připojování ke hře...</div></div>';
        }

        try {
            await this.multiplayerManager.joinGame(gameCode, playerName);
        } catch (error) {
            alert('Nepodařilo se připojit ke hře. Zkus to znovu.');
            this.router.navigate('/multiplayer');
        }
    }

    showLobbyScreen(gameCode) {
        const tabContent = document.getElementById('tab-content');
        if (!tabContent) {
            // Fallback - pokud není tab-content, zobraz na celé stránce
            const app = document.getElementById('app');
            const codeDisplay = '<div style="font-size: 18px; color: #94a3b8; margin-bottom: 20px;">🌐 Sdílej kód se soupeřem:</div><div style="font-size: 56px; font-weight: bold; color: #10b981; letter-spacing: 10px; padding: 30px; background: #1e293b; border-radius: 4px; margin: 30px 0; font-family: monospace;">' + gameCode + '</div>';
            app.innerHTML = '<div class="card" style="text-align: center; padding: 40px;"><div style="font-size: 32px; margin-bottom: 20px;">✅ Hra vytvořena!</div>' + codeDisplay + '<div style="font-size: 16px; color: #fbbf24; margin: 30px 0;">⏳ Čekání na soupeře...</div><button class="btn btn-red" style="width: auto; padding: 12px 30px;" onclick="app.multiplayerManager.disconnect()">🛑 Zrušit hru</button></div>';
            return;
        }
        
        // Zobraz čekárnu v tab-content
        const codeDisplay = '<div style="font-size: 56px; font-weight: bold; color: #10b981; letter-spacing: 15px; padding: 40px; background: #1e293b; border-radius: 4px; margin: 30px 0; font-family: monospace; text-align: center;">' + gameCode + '</div>';
        
        tabContent.innerHTML = '<div class="card" style="text-align: center; padding: 40px;"><div style="font-size: 32px; margin-bottom: 20px;">✅ Hra vytvořena!</div><div style="font-size: 16px; color: #94a3b8; margin-bottom: 20px;">Sdílej tento kód se soupeřem:</div>' + codeDisplay + '<div style="font-size: 16px; color: #fbbf24; margin: 30px 0;">⏳ Čekání na soupeře...</div><button class="btn btn-red" style="width: auto; padding: 12px 30px;" onclick="app.multiplayerManager.disconnect()">🛑 Zrušit hru</button></div>';
    }

    toggleOperation(operation) {
        const btn = document.getElementById('op-' + operation);
        
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
        
        if (btn) {
            btn.classList.toggle('active');
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
        const opMultiply = document.getElementById('op-multiply');
        const opAdd = document.getElementById('op-add');
        const opSubtract = document.getElementById('op-subtract');
        const opDivide = document.getElementById('op-divide');
        
        this.savedMultiply = opMultiply ? opMultiply.classList.contains('active') : true;
        this.savedAdd = opAdd ? opAdd.classList.contains('active') : false;
        this.savedSubtract = opSubtract ? opSubtract.classList.contains('active') : false;
        this.savedDivide = opDivide ? opDivide.classList.contains('active') : false;
        
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

        this.router.navigate('/test');
        
        this.testManager.startTest(mode, limit, this.operations);
    }

    endTest() {
        this.running = false;
        this.wasQuit = true;
        if (this.testManager) {
            this.testManager.clearMotivationTimers();
        }
        this.router.navigate('/');
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
                timeStatsHTML = '<div class="time-stats"><div class="time-stat-row"><span class="time-stat-label">⏱️ Průměrný čas na příklad</span><span class="time-stat-value">' + avgTime + 's</span></div></div>';
            }
            motivationalText = getMotivationalMessage('general', true);
        } else if (this.mode === '∞ Trénink') {
            const totalTime = ((this.testEndTime - this.testStartTime) / 1000).toFixed(2);
            timeStatsHTML = '<div class="time-stats"><div class="time-stat-row"><span class="time-stat-label">⏱️ Celkový čas tréninku</span><span class="time-stat-value">' + totalTime + 's</span></div></div>';
            motivationalText = getMotivationalMessage('general', true);
        } else {
            const totalTime = ((this.testEndTime - this.testStartTime) / 1000).toFixed(2);
            
            let last10TimeHTML = '';
            let last10Time = null;
            if (this.allAnswerTimes.length >= 10) {
                const last10Start = this.allAnswerTimes[this.allAnswerTimes.length - 10];
                const last10End = this.allAnswerTimes[this.allAnswerTimes.length - 1];
                last10Time = ((last10End - last10Start) / 1000).toFixed(2);
                last10TimeHTML = '<div class="time-stat-row"><span class="time-stat-label">🎯 Čas posledních 10 příkladů</span><span class="time-stat-value">' + last10Time + 's</span></div>';
                
                wasSuccessful = parseFloat(last10Time) <= this.limit;
                
                if (wasSuccessful) {
                    saveButtonHTML = '<div style="text-align: center; margin: 20px 0;"><input type="text" id="username" class="name-input" placeholder="Zadej své jméno" value="' + this.userName + '"><button class="btn btn-green" style="width: auto; padding: 12px 30px; margin-top: 10px;" onclick="app.saveToLeaderboard(' + last10Time + ')">🏆 Uložit do žebříčku</button></div>';
                }
            }
            
            timeStatsHTML = '<div class="time-stats"><div class="time-stat-row"><span class="time-stat-label">⏱️ Celkový čas</span><span class="time-stat-value">' + totalTime + 's</span></div>' + last10TimeHTML + '</div>';
            
            motivationalText = getMotivationalMessage(this.mode, wasSuccessful, this.wasQuit);
        }

        await updateFirebaseStats(this.correctCount, this.wrongCount);
        
        const app = document.getElementById('app');
        const errorListHTML = this.wrongAnswers.map(err => '<div class="error-item"><div class="error-problem">' + err.problem + '</div><div class="error-answers"><span class="error-your">Tvoje: <strong>' + err.user + '</strong></span><span class="error-correct">Správně: <strong>' + err.correct + '</strong></span></div></div>').join('');
        
        app.innerHTML = '<div class="card" style="text-align: center; padding: 40px;"><div class="result-emoji">' + (this.correctCount > this.wrongCount ? '🎉' : '💪') + '</div><div class="result-title">' + (this.wasQuit ? 'Test ukončen!' : 'Test dokončen!') + '</div><div class="result-mode">Režim: ' + this.mode + '</div><div class="result-mode">Operace: ' + opNames.join(', ') + '</div>' + timeStatsHTML + '<div style="font-size: 18px; font-weight: 600; color: #fbbf24; margin: 25px 0; padding: 15px; background: #1e293b; border-radius: 4px;">💬 ' + motivationalText + '</div><div class="result-stats"><div class="result-box correct"><div class="result-icon">✅</div><div class="result-number correct">' + this.correctCount + '</div><div class="result-label">Správně</div></div><div class="result-box wrong" onclick="app.showErrors()"><div class="result-icon">❌</div><div class="result-number wrong">' + this.wrongCount + '</div><div class="result-label">Chybně</div></div></div>' + (total > 0 ? '<div class="success-rate">Úspěšnost: ' + successRate + '%</div>' : '') + saveButtonHTML + '<button class="btn btn-blue" style="width: auto; padding: 12px 30px; margin-top: 10px;" onclick="app.router.navigate(\'/\')">🔄 Zkusit znovu</button></div>';
    }

    async saveToLeaderboard(time) {
        const username = await saveToLeaderboard(this.mode, time, this.userName, this.correctCount, this.wrongCount, this.operations, false);
        if (username) {
            this.userName = username;
            this.router.navigate('/leaderboard');
        }
    }

    showErrors() {
        if (this.wrongAnswers.length === 0) return;

        const app = document.getElementById('app');
        const errorListHTML = this.wrongAnswers.map(err => '<div class="error-item"><div class="error-problem">' + err.problem + '</div><div class="error-answers"><span class="error-your">Tvoje: <strong>' + err.user + '</strong></span><span class="error-correct">Správně: <strong>' + err.correct + '</strong></span></div></div>').join('');
        
        app.innerHTML = '<div class="card" style="padding: 40px;"><div style="text-align: center; margin-bottom: 30px;"><div class="result-title" style="color: #ef4444;">❌ Chybné odpovědi</div><div class="result-mode">Celkem chyb: ' + this.wrongAnswers.length + '</div></div><div class="error-list">' + errorListHTML + '</div><div style="text-align: center; margin-top: 30px;"><button class="btn btn-blue" style="width: auto; padding: 12px 30px;" onclick="app.finishTest()">◀ Zpět na výsledky</button></div></div>';
    }
}