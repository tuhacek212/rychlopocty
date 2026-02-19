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
        this.router.addRoute('/timer', () => {
            this.showMainScreen();
            this.setActiveTab('timer');
            setTimeout(() => this.showTimerScreen(), 100);
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
        return '<div style="background: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #3b82f6;"><div style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">📝 <strong style="color: #f1f5f9;">Jak to funguje:</strong> Vyber si obtížnost a operace, které chceš trénovat. Tvým úkolem je správně vyřešit 10 příkladů za daný čas. Čím rychleji odpovídáš, tím lepší je tvůj výsledek!</div></div><div class="two-column"><div class="card"><div class="section-title">🎯 Vyber obtížnost</div><button class="btn btn-green" onclick="app.startTest(\'Lehká\', 30)">Lehká</button><div class="time-desc">30 sekund</div><button class="btn btn-yellow" onclick="app.startTest(\'Střední\', 22)">Střední</button><div class="time-desc">22 sekund</div><button class="btn btn-orange" onclick="app.startTest(\'Obtížná\', 15)">Obtížná</button><div class="time-desc">15 sekund</div><button class="btn btn-red" onclick="app.startTest(\'Expert\', 10)">Expert</button><div class="time-desc">10 sekund</div></div><div class="card" style="display: flex; flex-direction: column;"><div class="section-title">🔢 Vyber operace</div><div class="operations-grid"><button class="operation-btn ' + (this.savedMultiply ? 'active' : '') + '" id="op-multiply" onclick="app.toggleOperation(\'multiply\')">✖️ Násobení</button><br><button class="operation-btn ' + (this.savedAdd ? 'active' : '') + '" id="op-add" onclick="app.toggleOperation(\'add\')">➕ Sčítání</button><br><button class="operation-btn ' + (this.savedSubtract ? 'active' : '') + '" id="op-subtract" onclick="app.toggleOperation(\'subtract\')">➖ Odčítání</button><br><button class="operation-btn ' + (this.savedDivide ? 'active' : '') + '" id="op-divide" onclick="app.toggleOperation(\'divide\')">➗ Dělení</button></div></div></div>';
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');

        const routes = {
            'training': '/',
            'timer': '/timer',
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

    showTimerScreen() {
        const tabContent = document.getElementById('tab-content');
        if (!tabContent) {
            this.showMainScreen();
            setTimeout(() => this.showTimerScreen(), 100);
            return;
        }
        this.renderTimerContent();
    }

    renderTimerContent() {
        const tabContent = document.getElementById('tab-content');
        if (!tabContent) return;

        tabContent.innerHTML = `
            <div style="background: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #8b5cf6;">
                <div style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
                    ⏰ <strong style="color: #f1f5f9;">Časovač:</strong> Nastav si čas a zkus vyřešit co nejvíce příkladů, než vyprší čas. Minutník odpočítává vteřiny a na konci ti ukáže, kolik příkladů jsi stihl!
                </div>
            </div>
            <div class="two-column">
                <div class="card">
                    <div class="section-title">⏱️ Nastav čas</div>
                    <div style="margin: 20px 0;">
                        <label style="display: block; font-size: 14px; color: #94a3b8; margin-bottom: 8px;">Minuty:</label>
                        <input type="number" id="timer-minutes" placeholder="0" min="0" max="60" value="2" 
                               style="width: 100%; padding: 15px; font-size: 24px; background: #1e293b; color: #f1f5f9; border: 2px solid #334155; border-radius: 4px; text-align: center;">
                    </div>
                    <div style="margin: 20px 0;">
                        <label style="display: block; font-size: 14px; color: #94a3b8; margin-bottom: 8px;">Vteřiny:</label>
                        <input type="number" id="timer-seconds" placeholder="0" min="0" max="59" value="0"
                               style="width: 100%; padding: 15px; font-size: 24px; background: #1e293b; color: #f1f5f9; border: 2px solid #334155; border-radius: 4px; text-align: center;">
                    </div>
                    <button class="btn btn-purple" onclick="app.startTimerTest()" style="width: 100%; padding: 15px; font-size: 18px; margin-top: 10px;">
                        🚀 Spustit časovač
                    </button>
                </div>
                <div class="card" style="display: flex; flex-direction: column;">
                    <div class="section-title">🔢 Vyber operace</div>
                    <div class="operations-grid">
                        <button class="operation-btn ${this.savedMultiply ? 'active' : ''}" id="timer-op-multiply" onclick="app.toggleTimerOperation('multiply')">✖️ Násobení</button><br>
                        <button class="operation-btn ${this.savedAdd ? 'active' : ''}" id="timer-op-add" onclick="app.toggleTimerOperation('add')">➕ Sčítání</button><br>
                        <button class="operation-btn ${this.savedSubtract ? 'active' : ''}" id="timer-op-subtract" onclick="app.toggleTimerOperation('subtract')">➖ Odčítání</button><br>
                        <button class="operation-btn ${this.savedDivide ? 'active' : ''}" id="timer-op-divide" onclick="app.toggleTimerOperation('divide')">➗ Dělení</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderMultiplayerContent() {
        const tabContent = document.getElementById('tab-content');
        if (!tabContent) return;

        tabContent.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
                <label style="font-size: 16px; color: #cbd5e1; font-weight: 500; white-space: nowrap;">Tvoje jméno:</label>
                <input type="text" id="mp-name" class="name-input" placeholder="Zadej jméno" value="${this.userName}" maxlength="20"
                       style="width: 300px; padding: 12px 15px; font-size: 16px; background: #1e293b; color: #f1f5f9; border: 2px solid #334155; border-radius: 4px;">
                <button class="btn btn-green" style="padding: 12px 20px; font-size: 16px; white-space: nowrap; display: flex; align-items: center; justify-content: space-between; gap: 15px; min-width: 250px; margin: 0; line-height: 1;" onclick="app.createMultiplayerGame()">
                    <span style="margin: 0;">🚀 Vytvořit místnost</span>
                    <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; margin: 0;" onclick="event.stopPropagation();">
                        <input type="checkbox" id="private-game" style="width: 18px; height: 18px; cursor: pointer; margin: 0; vertical-align: middle;" onclick="event.stopPropagation();">
                        <span style="font-size: 16px; margin: 0; vertical-align: middle;">🔒</span>
                    </label>
                </button>
            </div>

            <div class="card" style="margin-top: 0;">
                <div class="section-title">🌐 Aktivní místnosti</div>
                <div id="public-games-list" style="min-height: 150px;">
                    <div style="text-align: center; color: #94a3b8; padding: 40px 20px;">⏳ Načítání místností...</div>
                </div>
            </div>
        `;

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
            container.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 40px 20px;">😔 Žádné aktivní místnosti<br><span style="font-size: 12px;">Buď první a vytvoř novou!</span></div>';
            return;
        }

        const opIcons = { '*': '✖️', '+': '➕', '-': '➖', '/': '➗' };

        const gamesListHTML = games.map(game => {
            const opsDisplay = game.operations.map(op => opIcons[op] || op).join(' ');
            const timeAgo = this.getTimeAgo(game.createdAt);
            const isPrivate = game.isPrivate || false;
            const isPlaying = game.status === 'playing';
            const isFull = game.playerCount >= 2;
            
            let statusIcon = '';
            let statusText = '';
            let statusColor = '';
            let borderColor = '#334155';
            let clickable = false;
            let opacity = '1';
            
            if (isPlaying) {
                statusIcon = '🎮';
                statusText = 'Probíhá';
                statusColor = '#8b5cf6';
                opacity = '0.7';
            } else if (isPrivate) {
                statusIcon = '🔒';
                statusText = 'Soukromá';
                statusColor = '#f59e0b';
                clickable = false;
            } else if (isFull) {
                statusIcon = '⏳';
                statusText = 'Čeká';
                statusColor = '#3b82f6';
                opacity = '0.8';
            } else {
                statusIcon = '✅';
                statusText = 'Volná';
                statusColor = '#10b981';
                borderColor = '#10b981';
                clickable = true;
            }
            
            const cursorStyle = clickable ? 'cursor: pointer;' : 'cursor: default;';
            const hoverEvents = clickable ? 
                `onmouseover="this.style.background='#334155'; this.style.borderColor='#3b82f6'" onmouseout="this.style.background='#1e293b'; this.style.borderColor='${borderColor}'"` : 
                '';
            const clickEvent = clickable ? `onclick="app.joinPublicGame('${game.gameCode}')"` : '';
            
            // Pro soukromé hry zobrazíme input pro kód
            let actionSection = '';
            let codeDisplay = '';
            
            if (isPrivate) {
                // U soukromých her NESKRÝVÁME kód - je to heslo!
                codeDisplay = '';
                actionSection = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="text" id="code-input-${game.gameCode}" placeholder="Kód" maxlength="2"
                               style="width: 60px; padding: 10px 8px; font-size: 14px; background: #0f172a; color: #f1f5f9; border: 2px solid #334155; border-radius: 4px; text-align: center; box-sizing: border-box; margin: 0; vertical-align: middle;"
                               onclick="event.stopPropagation();">
                        <button class="btn btn-blue" style="padding: 10px 16px; font-size: 14px; line-height: 1; margin: 0; vertical-align: middle;" onclick="event.stopPropagation(); app.joinPrivateGameWithCode('${game.gameCode}')">
                            🔑 Připojit
                        </button>
                    </div>
                `;
            } else {
                codeDisplay = `<div style="font-size: 18px; color: #94a3b8; font-family: monospace; font-weight: bold;">#${game.gameCode}</div>`;
                if (clickable) {
                    actionSection = '<div style="font-size: 24px; color: #10b981;">▶️</div>';
                }
            }
            
            return `
                <div style="background: #1e293b; padding: 12px 20px; border-radius: 4px; margin-bottom: 8px; border: 2px solid ${borderColor}; opacity: ${opacity}; transition: all 0.2s; ${cursorStyle}; display: flex; justify-content: space-between; align-items: center;" ${hoverEvents} ${clickEvent}>
                    <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
                        <div style="font-size: 16px; font-weight: bold; color: #f1f5f9; min-width: 120px;">
                            👤 ${game.hostName}
                        </div>
                        <div style="font-size: 14px; color: #94a3b8;">
                            ${opsDisplay}
                        </div>
                        <div style="font-size: 12px; color: ${statusColor}; font-weight: 600;">
                            ${statusIcon} ${statusText}
                        </div>
                        <div style="font-size: 12px; color: #64748b;">
                            ${timeAgo}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        ${codeDisplay}
                        ${actionSection}
                    </div>
                </div>
            `;
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
    
    // WhatsApp sdílecí odkaz
    const shareText = encodeURIComponent(`Pojď hrát Rychlopočty! 🎮\nKód hry: ${gameCode}\nhttps://rychlopocty.cz/multiplayer`);
    const whatsappUrl = `https://wa.me/?text=${shareText}`;
    
    const myGameHTML = `
        <div style="background: #1e293b; padding: 20px; border-radius: 4px; margin-bottom: 15px; border: 2px solid #10b981;">
            <div style="text-align: center;">
                <div style="font-size: 18px; font-weight: bold; color: #10b981; margin-bottom: 10px;">✅ Tvoje hra vytvořena!</div>
                <div style="font-size: 14px; color: #94a3b8; margin-bottom: 15px;">Kód hry:</div>
                <div style="font-size: 48px; font-weight: bold; color: #10b981; letter-spacing: 10px; font-family: monospace;">${gameCode}</div>
                <div style="font-size: 14px; color: #fbbf24; margin-top: 15px;">⏳ Čekání na soupeře...</div>
                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 15px;">
                    <a href="${whatsappUrl}" target="_blank" class="btn btn-green" style="width: auto; padding: 10px 20px; font-size: 14px; text-decoration: none; display: inline-block;">
                        💬 Sdílet přes WhatsApp
                    </a>
                    <button class="btn btn-red" style="width: auto; padding: 10px 20px; font-size: 14px;" onclick="app.cancelMyGame()">
                        🛑 Zrušit
                    </button>
                </div>
            </div>
        </div>
    `;
    
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
            if (nameInput) {
                nameInput.focus();
                nameInput.style.borderColor = '#ef4444';
                setTimeout(() => nameInput.style.borderColor = '#334155', 1000);
            }
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

    async joinPrivateGameWithCode(gameCode) {
        const nameInput = document.getElementById('mp-name');
        const codeInput = document.getElementById(`code-input-${gameCode}`);
        const playerName = nameInput ? nameInput.value.trim() : '';
        const enteredCode = codeInput ? codeInput.value.trim() : '';

        if (!playerName) {
            alert('Nejdřív zadej své jméno nahoře!');
            if (nameInput) {
                nameInput.focus();
                nameInput.style.borderColor = '#ef4444';
                setTimeout(() => nameInput.style.borderColor = '#334155', 1000);
            }
            return;
        }

        if (!enteredCode) {
            alert('Zadej kód hry!');
            if (codeInput) {
                codeInput.focus();
                codeInput.style.borderColor = '#ef4444';
                setTimeout(() => codeInput.style.borderColor = '#334155', 1000);
            }
            return;
        }

        if (!/^\d{2}$/.test(enteredCode)) {
            alert('Kód musí být 2místné číslo!');
            if (codeInput) {
                codeInput.focus();
                codeInput.style.borderColor = '#ef4444';
                setTimeout(() => codeInput.style.borderColor = '#334155', 1000);
            }
            return;
        }

        if (enteredCode !== gameCode) {
            alert('Nesprávný kód!');
            if (codeInput) {
                codeInput.value = '';
                codeInput.focus();
                codeInput.style.borderColor = '#ef4444';
                setTimeout(() => codeInput.style.borderColor = '#334155', 1000);
            }
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

    toggleTimerOperation(operation) {
        const btn = document.getElementById('timer-op-' + operation);
        
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

    startTimerTest() {
        const minutesInput = document.getElementById('timer-minutes');
        const secondsInput = document.getElementById('timer-seconds');
        
        const minutes = parseInt(minutesInput.value) || 0;
        const seconds = parseInt(secondsInput.value) || 0;
        const totalSeconds = (minutes * 60) + seconds;
        
        if (totalSeconds <= 0) {
            minutesInput.style.borderColor = '#ef4444';
            secondsInput.style.borderColor = '#ef4444';
            setTimeout(() => {
                minutesInput.style.borderColor = '#334155';
                secondsInput.style.borderColor = '#334155';
            }, 1000);
            return;
        }
        
        // Uložíme stav operací
        const opMultiply = document.getElementById('timer-op-multiply');
        const opAdd = document.getElementById('timer-op-add');
        const opSubtract = document.getElementById('timer-op-subtract');
        const opDivide = document.getElementById('timer-op-divide');
        
        this.savedMultiply = opMultiply ? opMultiply.classList.contains('active') : true;
        this.savedAdd = opAdd ? opAdd.classList.contains('active') : false;
        this.savedSubtract = opSubtract ? opSubtract.classList.contains('active') : false;
        this.savedDivide = opDivide ? opDivide.classList.contains('active') : false;
        
        // Startujeme test v režimu časovač
        this.startTest('⏰ Časovač', totalSeconds);
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
        updateFirebaseStats(this.correctCount, this.wrongCount)
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
        } else if (this.mode === '⏰ Časovač') {
            const totalTime = ((this.testEndTime - this.testStartTime) / 1000).toFixed(2);
            let avgTime = '';
            if (this.correctCount > 0) {
                const avg = (totalTime / this.correctCount).toFixed(2);
                avgTime = '<div class="time-stat-row"><span class="time-stat-label">⏱️ Průměrný čas na příklad</span><span class="time-stat-value">' + avg + 's</span></div>';
            }
            timeStatsHTML = '<div class="time-stats"><div class="time-stat-row"><span class="time-stat-label">⏱️ Celkový čas</span><span class="time-stat-value">' + totalTime + 's</span></div>' + avgTime + '</div>';
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


