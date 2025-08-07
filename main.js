'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENT REFERENCES ---
    const screens = { mainMenu: document.getElementById('mainMenuScreen'), game: document.getElementById('gameScreen'), shop: document.getElementById('shopScreen') };
    const gameArea = document.getElementById('gameArea');
    const hero = document.getElementById('hero');
    const enemiesContainer = document.getElementById('enemies');
    const projectilesContainer = document.getElementById('projectiles');
    const ui = {
        score: document.getElementById('score'), health: document.getElementById('health'), coins: document.getElementById('coins'),
        diamonds: document.getElementById('diamonds'), highScore: document.getElementById('highScoreDisplay'),
        shopCoins: document.getElementById('shopCoins'), shopDiamonds: document.getElementById('shopDiamonds'),
        mainMenuCoins: document.getElementById('mainMenuCoins'), mainMenuDiamonds: document.getElementById('mainMenuDiamonds'),
    };
    const buttons = {
        play: document.getElementById('playBtn'), shop: document.getElementById('shopBtn'), backToMenu: document.getElementById('backToMenuBtn'),
        restart: document.getElementById('restartBtn'), mainMenu: document.getElementById('mainMenuBtn'), continueYes: document.getElementById('continueYesBtn'),
        continueNo: document.getElementById('continueNoBtn'), closeBonus: document.getElementById('closeBonusBtn'),
        pause: document.getElementById('pauseBtn'), resume: document.getElementById('resumeBtn'), exitToMenu: document.getElementById('exitToMenuBtn'),
    };
    const modals = {
        message: document.getElementById('messageContainer'), messageTitle: document.getElementById('messageTitle'), messageText: document.getElementById('messageText'),
        continue: document.getElementById('continueContainer'), continueText: document.getElementById('continueText'),
        bonus: document.getElementById('bonusContainer'), bonusDetails: document.getElementById('bonusDetails'),
        pause: document.getElementById('pauseMenuScreen'),
    };

    // --- SOUND ENGINE (Web Audio API) ---
    let audioCtx;
    const sounds = {
        play: (type) => {
            if (!audioCtx) {
                try {
                    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                } catch (e) { console.error("Web Audio API not supported"); return; }
            }
            if (audioCtx.state === 'suspended') { audioCtx.resume(); }

            const now = audioCtx.currentTime;
            const gainNode = audioCtx.createGain();
            gainNode.connect(audioCtx.destination);
            const oscillator = audioCtx.createOscillator();
            oscillator.connect(gainNode);

            switch(type) {
                case 'shoot': oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(880, now); gainNode.gain.setValueAtTime(0.2, now); gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.2); oscillator.start(now); oscillator.stop(now + 0.2); break;
                case 'hit': oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(440, now); oscillator.frequency.exponentialRampToValueAtTime(110, now + 0.1); gainNode.gain.setValueAtTime(0.4, now); gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.15); oscillator.start(now); oscillator.stop(now + 0.15); break;
                case 'enemyReached': oscillator.type = 'sawtooth'; oscillator.frequency.setValueAtTime(220, now); oscillator.frequency.exponentialRampToValueAtTime(55, now + 0.4); gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.5); oscillator.start(now); oscillator.stop(now + 0.5); break;
                case 'uiClick': oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(1200, now); gainNode.gain.setValueAtTime(0.1, now); gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.1); oscillator.start(now); oscillator.stop(now + 0.1); break;
            }
        }
    };

    // --- CONFIG & DATA ---
    const shopItemConfigs = {
        theme: [ { id: 'day-bg.png', name: 'Day', cost: 0 }, { id: 'sunset-bg.png', name: 'Sunset', cost: 150 }, { id: 'night-bg.png', name: 'Night', cost: 300 } ],
        upgrade: [ { id: 'healthUpgrade', name: 'Health Upgrade' } ],
        castle: [ { id: 'hero-full.png', cost: 0 }, { id: 'castle-stone.png', cost: 250 }, { id: 'castle-knight.png', cost: 500 } ],
        projectile: [
            { id: 'arrow.png', cost: 0, className: 'arrow' },
            { id: 'bullet.png', cost: 300, className: 'bullet' },
            { id: 'fireball.png', cost: 600, className: 'fireball' }
        ],
        enemy: [ { id: 'enemy.png', cost: 0 }, { id: 'enemy-goblin.png', cost: 200 }, { id: 'enemy-bat.png', cost: 400 } ]
    };
    const defaultGameData = {
        highScore: 0, coins: 250, diamonds: 40, castleHealthLevel: 1, lastBonusTime: null,
        selectedTheme: 'day-bg.png', unlockedThemes: ['day-bg.png'],
        unlockedCastleSkins: ['hero-full.png'], selectedCastleSkin: 'hero-full.png',
        unlockedProjectileSkins: ['arrow.png'], selectedProjectileSkin: 'arrow.png',
        unlockedEnemySkins: ['enemy.png'], selectedEnemySkin: 'enemy.png',
    };
    
    let score, health, maxHealth, isGameOver, isPaused, enemies, spawnInterval, enemySpeed, continueCost;
    let nextSpawnTime, lastTime, animationFrameId;
   let pauseStartTime;
    let isSwiping, swipeStartX, swipeStartY;
    let gameData = {};

    // --- CORE GAME ENGINE ---
    function gameLoop(timestamp) {
        if (isGameOver) return;
        if (isPaused) { animationFrameId = requestAnimationFrame(gameLoop); return; }
        if (!lastTime) lastTime = timestamp;
        
        lastTime = timestamp;
        if (timestamp > nextSpawnTime) {
            spawnEnemy();
            spawnInterval = Math.max(400, spawnInterval - 15);
            enemySpeed = Math.max(3000, enemySpeed - 50);
            nextSpawnTime = timestamp + spawnInterval;
        }
        
        enemies.forEach(enemy => {
            const progress = (timestamp - enemy.spawnTime) / enemy.totalTravelTime;
            if (progress >= 1) { handleEnemyReached(enemy.id); return; }
            const currentX = enemy.startX * (1 - progress);
            const currentY = enemy.startY * (1 - progress);
            enemy.element.style.transform = `translate(-50%, -50%) translate(${currentX}px, ${currentY}px) rotate(${enemy.rotation}deg)`;
        });
        enemies = enemies.filter(e => !e.isDestroyed);
        animationFrameId = requestAnimationFrame(gameLoop);
    }
    
  // Find this function...
function pauseGame() { 
    if (isGameOver || isPaused) return;
    isPaused = true;
    pauseStartTime = performance.now(); // <-- ADD THIS LINE
    cancelAnimationFrame(animationFrameId);
    modals.pause.style.display = 'flex';
}
   // Replace your entire old resumeGame function with this one.
function resumeGame() {
    if (isGameOver || !isPaused) return;

    // Calculate how long the game was paused
    const timePaused = performance.now() - pauseStartTime;

    // Adjust the spawn time for all existing enemies to ignore the pause duration
    enemies.forEach(enemy => {
        enemy.spawnTime += timePaused;
    });

    // Also adjust the timer for the next enemy spawn
    nextSpawnTime += timePaused;

    isPaused = false;
    lastTime = performance.now(); // Reset the clock for the next frame
    animationFrameId = requestAnimationFrame(gameLoop);
    modals.pause.style.display = 'none';
}
    // --- DATA & SETUP ---
    function saveData() { localStorage.setItem('swipeNinjaDataFinal', JSON.stringify(gameData)); }
    function loadData() {
        const savedData = localStorage.getItem('swipeNinjaDataFinal');
        gameData = savedData ? { ...defaultGameData, ...JSON.parse(savedData) } : { ...defaultGameData };
    }
    function showScreen(screenName) { Object.values(screens).forEach(s => s.classList.remove('active')); screens[screenName].classList.add('active'); }
    function setTheme(themeImageFile) {
        const backgroundUrl = `url('assets/themes/${themeImageFile}')`;
        Object.values(screens).forEach(screen => {
            screen.style.backgroundImage = backgroundUrl;
            screen.style.backgroundSize = 'cover';
            screen.style.backgroundPosition = 'center';
        });
    }
    
    function setupEventListeners() {
        buttons.play.addEventListener('click', () => { sounds.play('uiClick'); startGame(); });
        buttons.shop.addEventListener('click', () => { sounds.play('uiClick'); updateUIMenus(); showScreen('shop'); });
        buttons.backToMenu.addEventListener('click', () => { sounds.play('uiClick'); showScreen('mainMenu'); });
        buttons.restart.addEventListener('click', () => { sounds.play('uiClick'); startGame(); });
        buttons.mainMenu.addEventListener('click', () => { sounds.play('uiClick'); modals.message.style.display = 'none'; showScreen('mainMenu'); });
        buttons.closeBonus.addEventListener('click', () => { sounds.play('uiClick'); modals.bonus.style.display = 'none'; });
        buttons.continueYes.addEventListener('click', () => { sounds.play('uiClick'); handleContinue(); });
        buttons.continueNo.addEventListener('click', () => { sounds.play('uiClick'); handleGameOver(); });
        buttons.pause.addEventListener('click', () => { sounds.play('uiClick'); pauseGame(); });
        buttons.resume.addEventListener('click', () => { sounds.play('uiClick'); resumeGame(); });
        buttons.exitToMenu.addEventListener('click', () => { sounds.play('uiClick'); exitToMainMenu(); });
        
        document.getElementById('themeSelection').addEventListener('click', handleShopAction);
        document.querySelectorAll('.shop-item-grid[data-section]').forEach(grid => { grid.addEventListener('click', handleShopAction); });
    }
    
    // --- UI & MENUS ---
    function updateUIMenus() { ui.highScore.textContent = `High Score: ${gameData.highScore}`; const coinCount = gameData.coins, diamondCount = gameData.diamonds; [ui.coins, ui.shopCoins, ui.mainMenuCoins].forEach(el => el.textContent = coinCount); [ui.diamonds, ui.shopDiamonds, ui.mainMenuDiamonds].forEach(el => el.textContent = diamondCount); updateShopUI(); }
    function checkWeeklyBonus() { const now = Date.now(), oneWeek = 7 * 24 * 60 * 60 * 1000; if (!gameData.lastBonusTime || (now - gameData.lastBonusTime > oneWeek)) { const bonusCoins = 100 + Math.floor(Math.random() * 151), bonusDiamonds = 5 + Math.floor(Math.random() * 6); gameData.coins += bonusCoins; gameData.diamonds += bonusDiamonds; gameData.lastBonusTime = now; saveData(); modals.bonusDetails.innerHTML = `+${bonusCoins} <img src="assets/icon-coin.png"> &nbsp;&nbsp; +${bonusDiamonds} <img src="assets/icon-diamond.png">`; modals.bonus.style.display = 'flex'; } }
    function updateInGameUI() { ui.score.textContent = `Score: ${score}`; ui.health.textContent = `${Math.round(health)}`; }

    // --- GAME LOGIC ---
    function startGame() { showScreen('game'); modals.message.style.display = 'none'; maxHealth = 100 + (gameData.castleHealthLevel - 1) * 20; health = maxHealth; score = 0; isGameOver = false; isPaused = false; continueCost = 1; enemies = []; hero.src = `assets/${gameData.selectedCastleSkin}`; enemiesContainer.innerHTML = ''; projectilesContainer.innerHTML = ''; updateInGameUI(); addInputListeners(); spawnInterval = 2000; enemySpeed = 5000; lastTime = performance.now(); nextSpawnTime = lastTime + spawnInterval; if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = requestAnimationFrame(gameLoop); }
   function exitToMainMenu() {
    isGameOver = true;
    isPaused = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    removeInputListeners();

    // Process score and award coins before exiting
    gameData.coins += Math.floor(score / 10);
    if (score > gameData.highScore) {
        gameData.highScore = score;
    }
    saveData();
    updateUIMenus();

    // Hide the correct modal (the pause menu)
    modals.pause.style.display = 'none'; 
    
    showScreen('mainMenu');
}
    function handleGameOver() { isGameOver = true; if(animationFrameId) cancelAnimationFrame(animationFrameId); removeInputListeners(); modals.continue.style.display = 'none'; modals.message.style.display = 'flex'; modals.messageTitle.textContent = 'Game Over!'; modals.messageText.textContent = `Your score: ${score}`; buttons.restart.textContent = 'Play Again'; buttons.mainMenu.textContent = 'Main Menu'; if (score > gameData.highScore) { gameData.highScore = score; modals.messageText.textContent += `\nNew High Score!`; } gameData.coins += Math.floor(score / 10); if (score >= 250) { gameData.diamonds += Math.floor(score / 250); } saveData(); updateUIMenus(); }
    function askToContinue() { isGameOver = true; if(animationFrameId) cancelAnimationFrame(animationFrameId); removeInputListeners(); if (gameData.diamonds >= continueCost) { modals.continueText.innerHTML = `Use ${continueCost} <img src="assets/icon-diamond.png"> to continue?`; modals.continue.style.display = 'flex'; } else { handleGameOver(); } }
    function handleContinue() { if (gameData.diamonds >= continueCost) { gameData.diamonds -= continueCost; continueCost *= 2; health = maxHealth; isGameOver = false; modals.continue.style.display = 'none'; updateInGameUI(); updateUIMenus(); saveData(); addInputListeners(); lastTime = performance.now(); nextSpawnTime = lastTime + 1000; animationFrameId = requestAnimationFrame(gameLoop); } }
    function updateHealth(change) { if (isGameOver || isPaused) return; health -= change; if (health <= 0) { health = 0; updateInGameUI(); askToContinue(); return; } const healthPercent = (health / maxHealth) * 100; hero.src = `assets/${healthPercent > 66 ? gameData.selectedCastleSkin : (healthPercent > 33 ? 'hero-damaged.png' : 'hero-critical.png')}`; updateInGameUI(); }
    function spawnEnemy() { const enemy = document.createElement('div'); enemy.classList.add('enemy'); enemy.style.backgroundImage = `url('assets/${gameData.selectedEnemySkin}')`; const angle = Math.random() * 360, radius = Math.max(window.innerWidth, window.innerHeight) * 0.7; const startX = Math.cos(angle * Math.PI / 180) * radius, startY = Math.sin(angle * Math.PI / 180) * radius; const rotation = angle + 180; enemy.style.transform = `translate(-50%, -50%) translate(${startX}px, ${startY}px) rotate(${rotation}deg)`; const enemyId = Date.now() + Math.random(); const enemyObj = { id: enemyId, element: enemy, angle: angle, isTargeted: false, isDestroyed: false, spawnTime: lastTime, totalTravelTime: enemySpeed, startX, startY, rotation }; enemies.push(enemyObj); enemiesContainer.appendChild(enemy); }
    function launchProjectileAt(enemyObj) {
        if (isGameOver || isPaused || enemyObj.isTargeted) return;
        enemyObj.isTargeted = true;
        sounds.play('shoot');
        const projectile = document.createElement('div');
        const skinInfo = shopItemConfigs.projectile.find(s => s.id === gameData.selectedProjectileSkin);
        projectile.className = `projectile ${skinInfo.className}`; // CORRECTED LINE
        projectile.style.backgroundImage = `url('assets/${gameData.selectedProjectileSkin}')`;
        const rect = enemyObj.element.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2, targetY = rect.top + rect.height / 2;
        projectilesContainer.appendChild(projectile);
        projectile.offsetHeight;
        projectile.style.left = `${targetX}px`;
        projectile.style.top = `${targetY}px`;
        projectile.addEventListener('transitionend', () => { if (isPaused) return; sounds.play('hit'); score++; updateInGameUI(); destroyEnemy(enemyObj.id); projectile.remove(); });
    }
    function handleEnemyReached(enemyId) { if (isGameOver || isPaused) return; const enemyObj = enemies.find(e => e.id === enemyId); if (!enemyObj || enemyObj.isDestroyed) return; const rect = enemyObj.element.getBoundingClientRect(); createExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2); sounds.play('enemyReached'); updateHealth(30); destroyEnemy(enemyId); }
    function destroyEnemy(enemyId) { const enemy = enemies.find(e => e.id === enemyId); if (enemy) { enemy.isDestroyed = true; enemy.element?.remove(); } }
    function createExplosion(x, y) { const explosion = document.createElement('div'); explosion.classList.add('explosion'); explosion.style.backgroundImage = `url('assets/explosion.gif')`; explosion.style.left = `${x}px`; explosion.style.top = `${y}px`; gameArea.appendChild(explosion); setTimeout(() => explosion.remove(), 800); }
    function addInputListeners() { gameArea.addEventListener('mousedown', handleSwipeStart); gameArea.addEventListener('mouseup', handleSwipeEnd); gameArea.addEventListener('touchstart', handleSwipeStart, { passive: true }); gameArea.addEventListener('touchend', handleSwipeEnd, { passive: true }); }
    function removeInputListeners() { gameArea.removeEventListener('mousedown', handleSwipeStart); gameArea.removeEventListener('mouseup', handleSwipeEnd); gameArea.removeEventListener('touchstart', handleSwipeStart); gameArea.removeEventListener('touchend', handleSwipeEnd); }
    function handleSwipeStart(e) { if (isGameOver || isPaused) return; isSwiping = true; swipeStartX = e.type.includes('mouse') ? e.clientX : e.changedTouches[0].clientX; swipeStartY = e.type.includes('mouse') ? e.clientY : e.changedTouches[0].clientY; }
    function handleSwipeEnd(e) { if (!isSwiping || isGameOver || isPaused) return; isSwiping = false; const swipeEndX = e.type.includes('mouse') ? e.clientX : e.changedTouches[0].clientX; const swipeEndY = e.type.includes('mouse') ? e.clientY : e.changedTouches[0].clientY; const diffX = swipeEndX - swipeStartX, diffY = swipeEndY - swipeStartY; if (Math.hypot(diffX, diffY) < 30) return; let swipeAngle = Math.atan2(diffY, diffX) * 180 / Math.PI; if (swipeAngle < 0) swipeAngle += 360; let bestTarget = null, minAngleDiff = 45; enemies.filter(en => !en.isTargeted).forEach(enemy => { const angleDifference = Math.min(Math.abs(swipeAngle - enemy.angle), 360 - Math.abs(swipeAngle - enemy.angle)); if (angleDifference < minAngleDiff) { minAngleDiff = angleDifference; bestTarget = enemy; } }); if (bestTarget) { launchProjectileAt(bestTarget); } }
    
    // --- SHOP LOGIC ---
    function populateShop() {
        // Themes
        const themeContainer = document.getElementById('themeSelection'); themeContainer.innerHTML = '';
        shopItemConfigs.theme.forEach(item => { const itemDiv = document.createElement('div'); itemDiv.className = 'shop-item theme-item'; itemDiv.dataset.theme = item.id; itemDiv.style.backgroundImage = `url('assets/themes/${item.id}')`; itemDiv.innerHTML = `<span>${item.name}</span><button data-cost="${item.cost}"></button>`; themeContainer.appendChild(itemDiv); });
        // Other items
        Object.keys(shopItemConfigs).forEach(sectionKey => {
            if (sectionKey === 'theme') return;
            const container = document.querySelector(`.shop-item-grid[data-section="${sectionKey}"]`);
            if (!container) return; container.innerHTML = '';
            shopItemConfigs[sectionKey].forEach(item => {
                const itemDiv = document.createElement('div'); itemDiv.className = 'shop-item';
                if(sectionKey === 'upgrade') { itemDiv.id = item.id; itemDiv.innerHTML = `<p>Health Level: <span id="healthLevel">1</span></p><p>Next: +20 Max HP</p><button class="buy-btn"></button>`; } else { itemDiv.dataset.skinId = item.id; itemDiv.dataset.type = sectionKey; itemDiv.innerHTML = `<img src="assets/${item.id}" alt="${item.id}"><button data-cost="${item.cost}"></button>`; }
                container.appendChild(itemDiv);
            });
        });
    }
    
    function handleShopAction(e) {
        sounds.play('uiClick');
        const itemDiv = e.target.closest('.shop-item');
        if (!itemDiv) return;

        const button = e.target.closest('button');

        // Handle Theme Clicks
        if (itemDiv.classList.contains('theme-item')) {
            const themeId = itemDiv.dataset.theme;
            const themeConfig = shopItemConfigs.theme.find(t => t.id === themeId);
            const isUnlocked = gameData.unlockedThemes.includes(themeId);
            
            if (button && button.classList.contains('buy-btn')) { // Clicked the BUY button
                 if (gameData.coins >= themeConfig.cost) {
                    gameData.coins -= themeConfig.cost;
                    gameData.unlockedThemes.push(themeId);
                }
            } else if (isUnlocked) { // Clicked the item to SELECT it
                gameData.selectedTheme = themeId;
                setTheme(gameData.selectedTheme);
            }
        } 
        // Handle Health Upgrade
        else if (itemDiv.id === 'healthUpgrade' && button) {
            const cost = parseInt(button.dataset.cost);
            if (gameData.coins >= cost) { gameData.coins -= cost; gameData.castleHealthLevel++; }
        } 
        // Handle other Skins
        else if (button) {
            const id = itemDiv.dataset.skinId, type = itemDiv.dataset.type, cost = parseInt(button.dataset.cost);
            const unlockedListKey = `unlocked${type.charAt(0).toUpperCase() + type.slice(1)}Skins`, selectedKey = `selected${type.charAt(0).toUpperCase() + type.slice(1)}Skin`;
            if (button.classList.contains('buy-btn')) {
                if (gameData.coins >= cost) { gameData.coins -= cost; gameData[unlockedListKey].push(id); }
            } else if (button.classList.contains('select-btn')) {
                gameData[selectedKey] = id;
            }
        }
        saveData();
        updateUIMenus();
    }
    
    function updateShopUI() { 
        document.querySelectorAll('.theme-item').forEach(item => {
            const themeId = item.dataset.theme;
            const themeConfig = shopItemConfigs.theme.find(t => t.id === themeId);
            const isUnlocked = gameData.unlockedThemes.includes(themeId);
            const isSelected = gameData.selectedTheme === themeId;
            item.classList.toggle('selected', isSelected);
            const btn = item.querySelector('button');
            if (isUnlocked) {
                btn.className = 'select-btn'; btn.textContent = isSelected ? 'Selected' : 'Select'; btn.disabled = isSelected;
            } else {
                btn.className = 'buy-btn'; btn.innerHTML = `Buy (${themeConfig.cost} <img src="assets/icon-coin.png">)`; btn.disabled = gameData.coins < themeConfig.cost;
            }
        });
        const healthLevel = gameData.castleHealthLevel, healthCost = 100 * Math.pow(2, healthLevel - 1); 
        const healthBtn = document.querySelector('#healthUpgrade button'); 
        document.querySelector('#healthLevel').textContent = healthLevel; 
        healthBtn.dataset.cost = healthCost; 
        healthBtn.innerHTML = `Upgrade (${healthCost} <img src="assets/icon-coin.png">)`; 
        healthBtn.disabled = gameData.coins < healthCost; 
        document.querySelectorAll('.shop-item[data-skin-id]').forEach(item => { 
            const id = item.dataset.skinId, type = item.dataset.type; 
            const unlockedListKey = `unlocked${type.charAt(0).toUpperCase() + type.slice(1)}Skins`, selectedKey = `selected${type.charAt(0).toUpperCase() + type.slice(1)}Skin`; 
            const isUnlocked = gameData[unlockedListKey].includes(id), isSelected = gameData[selectedKey] === id; 
            item.classList.toggle('selected', isSelected); 
            const btn = item.querySelector('button'); 
            if (isUnlocked) { 
                btn.className = 'select-btn'; btn.textContent = isSelected ? 'Selected' : 'Select'; btn.disabled = isSelected; 
            } else { 
                btn.className = 'buy-btn'; const cost = parseInt(btn.dataset.cost); 
                btn.innerHTML = `Buy (${cost} <img src="assets/icon-coin.png">)`; btn.disabled = gameData.coins < cost; 
            } 
        }); 
    }

    // --- INITIALIZE AND START THE APP ---
    function init() {
        loadData();
        populateShop();
        checkWeeklyBonus();
        setTheme(gameData.selectedTheme);
        updateUIMenus();
        setupEventListeners();
        showScreen('mainMenu');
    }

    init();
});