document.addEventListener('DOMContentLoaded', () => {
    const moles = document.querySelectorAll('.mole');
    const holes = document.querySelectorAll('.hole');
    const scoreElement = document.getElementById('score');
    const timerElement = document.getElementById('timer');
    const hammer = document.getElementById('hammer');
    const gameBoard = document.querySelector('.game-board');
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    const bossHealthElement = document.getElementById('boss-health');
    const bossHealthRow = document.getElementById('boss-health-row');
    let score = 0;
    let timer = 30;
    let timerInterval = null;
    let gameActive = false;
    let gameStarted = false;
    let hammerTimeout = null;
    let gameStartTime = 0;
    
    // Multiple active moles system
    let activeMoles = new Map(); // Map of mole index to mole data
    let spawnInterval = null;
    let maxActiveMoles = 1;
    let baseSpawnRate = 2000; // Base time between spawns in ms
    let currentSpawnRate = 2000;

    // Boss mechanics
    let isBossActive = false;
    let bossIndex = 4; // middle hole
    let bossHP = 0;
    let bossMaxHP = 10;
    let bossShieldActive = false;
    let bossCount = 0;
    let bossInterval = null;
    let quizInProgress = false;
    let questionsAskedThisBoss = 0; // Track questions asked in current boss fight

    const quizPool = [
        { q: 'Which is the safest password practice?', choices: ['Use one strong password everywhere', 'Enable multi-factor authentication', 'Write passwords on a sticky note'], answer: 1 },
        { q: 'What is phishing?', choices: ['A type of firewall', 'Tricking users to reveal info', 'Encrypting data with keys'], answer: 1 },
        { q: 'Best way to handle software updates?', choices: ['Delay updates', 'Install from unknown sites', 'Apply updates promptly'], answer: 2 },
        { q: 'Which email attachment is safest?', choices: ['.exe from unknown sender', 'Zipped file from unverified source', 'Verified doc from known colleague'], answer: 2 },
        { q: 'Strong password trait?', choices: ['Short and simple', 'Includes letters, numbers, symbols', 'Based on your name'], answer: 1 },
    ];

    // Mobile detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

    // Sound effects - Improved desktop/mobile handling
    class ThrottledAudioPool {
        constructor(src, poolSize = 3) {
            this.pool = [];
            this.currentIndex = 0;
            this.poolSize = poolSize;
            this.lastPlayTime = 0;
            // Different settings for desktop vs mobile - reduced throttling for better mobile response
            this.minInterval = isMobile ? 30 : 25; // Much faster response on mobile
            this.playingCount = 0;
            this.maxSimultaneous = isMobile ? Math.min(poolSize, 12) : Math.min(poolSize, 16);
            
            // Create audio pool with improved mobile preloading
            for (let i = 0; i < poolSize; i++) {
                const audio = new Audio(src);
                audio.preload = 'auto';
                audio.volume = isMobile ? 0.7 : 0.8; // Slightly lower volume on mobile to prevent distortion
                
                // Aggressive preloading for mobile
                if (isMobile) {
                    audio.load(); // Force loading on mobile
                }
                
                // Track when audio finishes
                audio.addEventListener('ended', () => {
                    this.playingCount = Math.max(0, this.playingCount - 1);
                });
                
                // Add error handling
                audio.addEventListener('error', (e) => {
                    console.log('Audio error:', e);
                });
                
                // Additional mobile-specific optimizations
                if (isMobile) {
                    audio.addEventListener('canplaythrough', () => {
                        // Audio is ready to play
                    });
                }
                
                this.pool.push(audio);
            }
        }
        
        play() {
            const now = Date.now();
            
            // Less aggressive throttling for desktop
            if (now - this.lastPlayTime < this.minInterval) {
                return;
            }
            
            // Limit simultaneous sounds
            if (this.playingCount >= this.maxSimultaneous) {
                return;
            }
            
            try {
                const audio = this.pool[this.currentIndex];
                
                // Only reset if audio is not currently playing to avoid interruption lag on mobile
                if (!audio.paused) {
                    // Skip to next audio instance instead of stopping current one
                    this.currentIndex = (this.currentIndex + 1) % this.poolSize;
                    const nextAudio = this.pool[this.currentIndex];
                    if (!nextAudio.paused) {
                        // If next is also playing, find the first available one
                        for (let i = 0; i < this.poolSize; i++) {
                            const testIndex = (this.currentIndex + i) % this.poolSize;
                            if (this.pool[testIndex].paused || this.pool[testIndex].ended) {
                                this.currentIndex = testIndex;
                                break;
                            }
                        }
                    }
                }
                
                const finalAudio = this.pool[this.currentIndex];
                finalAudio.currentTime = 0;
                
                // Play with promise handling
                const playPromise = finalAudio.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        this.playingCount++;
                    }).catch((error) => {
                        // Silently fail on mobile to prevent console spam
                        if (!isMobile) {
                            console.log('Audio play failed:', error);
                        }
                    });
                } else {
                    this.playingCount++;
                }
                
                this.lastPlayTime = now;
                this.currentIndex = (this.currentIndex + 1) % this.poolSize;
                
            } catch (error) {
                if (!isMobile) {
                    console.log('Audio error:', error);
                }
            }
        }
    }
    
    // Create audio pools - increased instances for better mobile performance
    const soundHitPool = new ThrottledAudioPool('assets/sound_hit1.ogg', isMobile ? 20 : 24);
    const soundScorePool = new ThrottledAudioPool('assets/sound_score.ogg', isMobile ? 6 : 8);
    const soundWrongPool = new ThrottledAudioPool('assets/sound_wrong.mp3', isMobile ? 6 : 8);

    // Audio enabling - optimized for mobile and desktop
    let audioEnabled = false;
    function enableAudio() {
        if (!audioEnabled) {
            // Different strategies for mobile vs desktop
            if (isMobile) {
                // Mobile: Try to unlock multiple audio instances
                const unlockPromises = [];
                for (let i = 0; i < Math.min(3, soundHitPool.pool.length); i++) {
                    const testAudio = soundHitPool.pool[i];
                    const originalVolume = testAudio.volume;
                    testAudio.volume = 0.01;
                    
                    const playPromise = testAudio.play();
                    if (playPromise !== undefined) {
                        unlockPromises.push(
                            playPromise.then(() => {
                                testAudio.pause();
                                testAudio.currentTime = 0;
                                testAudio.volume = originalVolume;
                            }).catch(() => {
                                testAudio.volume = originalVolume;
                            })
                        );
                    } else {
                        testAudio.volume = originalVolume;
                    }
                }
                
                Promise.all(unlockPromises).then(() => {
                    audioEnabled = true;
                    console.log('Mobile audio enabled successfully');
                }).catch(() => {
                    console.log('Mobile audio unlock failed, will retry on next interaction');
                });
            } else {
                // Desktop: Single audio unlock
                const testAudio = soundHitPool.pool[0];
                const originalVolume = testAudio.volume;
                
                testAudio.volume = 0.01;
                const playPromise = testAudio.play();
                
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        testAudio.pause();
                        testAudio.currentTime = 0;
                        testAudio.volume = originalVolume;
                        audioEnabled = true;
                        console.log('Desktop audio enabled successfully');
                    }).catch((error) => {
                        console.log('Audio unlock failed:', error);
                        testAudio.volume = originalVolume;
                    });
                } else {
                    testAudio.volume = originalVolume;
                    audioEnabled = true;
                }
            }
        }
    }

    // Sound functions with better mobile and desktop support
    function playSoundHit() {
        if (!audioEnabled) {
            enableAudio(); // Try to enable audio if not already enabled
        }
        soundHitPool.play();
    }

    function playSoundScore() {
        if (!audioEnabled) {
            enableAudio();
        }
        // Play on both mobile and desktop, but with different volume
        if (isMobile) {
            // Lower volume on mobile
            soundScorePool.pool.forEach(audio => audio.volume = 0.4);
        }
        soundScorePool.play();
        }

    function playSoundWrong() {
        if (!audioEnabled) {
            enableAudio();
        }
        // Play on both mobile and desktop
        if (isMobile) {
            // Lower volume on mobile
            soundWrongPool.pool.forEach(audio => audio.volume = 0.4);
        }
        soundWrongPool.play();
    }

    // Calculate difficulty progression
    function updateDifficulty() {
        const elapsedTime = Date.now() - gameStartTime;
        const seconds = elapsedTime / 1000;
        
        // Increase max moles every 5 seconds (max 4 moles)
        maxActiveMoles = Math.min(4, Math.floor(seconds / 5) + 1);
        
        // Decrease spawn rate over time (faster spawning)
        const speedMultiplier = Math.max(0.3, 1 - (seconds / 60)); // Gets 70% faster over 60 seconds
        currentSpawnRate = baseSpawnRate * speedMultiplier;
    }

    // Start the game
    function startGame() {
        console.log('Game started!');
        score = 0;
        timer = 30;
        gameActive = true;
        gameStarted = true;
        gameStartTime = Date.now();
        maxActiveMoles = 1;
        currentSpawnRate = baseSpawnRate;
        activeMoles.clear();
        isBossActive = false;
        bossHP = 0;
        bossMaxHP = 10;
        bossShieldActive = false;
        bossCount = 0;
        quizInProgress = false;
        questionsAskedThisBoss = 0;
        
        // Reset all mole images to stage 1 assets
        moles.forEach(mole => {
            const img = mole.querySelector('.mole-img');
            if (img) {
                img.src = getMoleAsset(1, false); // Stage 1, not whacked
            }
            mole.classList.remove('show');
        });
        
        scoreElement.textContent = 'SCORE 0';
        timerElement.textContent = '30s';
        hammer.style.display = 'none';
        
        // Hide boss health display
        if (bossHealthRow) {
            bossHealthRow.style.display = 'none';
        }
        
        startTimer();
        startSpawning();
    }

    // Function to get the appropriate asset based on stage
    function getMoleAsset(stage, isWhacked = false) {
        if (stage === 1) {
            return isWhacked ? 'assets/virus_minion_1_whacked.png' : 'assets/virus_minion_1.png';
        } else if (stage === 2) {
            return isWhacked ? 'assets/virus_minion_2_whacked.png' : 'assets/virus_minion_2.png';
        } else {
            return isWhacked ? 'assets/sloth got whacked.png' : 'assets/sloth gets ready.png';
        }
    }

    function getBossAsset(stage) {
        if (stage === 1) {
            return 'assets/virus_boss_1.png';
        } else if (stage === 2) {
            return 'assets/virus_boss_2.png';
        } else {
            return 'assets/sloth gets ready.png'; // Default for later stages
        }
    }

    function updateBossHealthDisplay() {
        if (bossHealthElement && bossHealthRow) {
            bossHealthElement.textContent = `BOSS HEALTH: ${bossHP}/${bossMaxHP}`;
            bossHealthRow.style.display = isBossActive ? 'flex' : 'none';
        }
    }

    // Assign initial image to each mole (no label)
    moles.forEach((mole, i) => {
        mole.className = 'mole';
        mole.innerHTML = `
            <img src="assets/virus_minion_1.png" class="mole-img" alt="Virus Minion" draggable="false">
        `;
    });

    function getAvailableHoles() {
        const available = [];
        for (let i = 0; i < moles.length; i++) {
            if (!activeMoles.has(i)) {
                available.push(i);
            }
        }
        return available;
    }

    function spawnMole() {
        if (!gameActive || isBossActive) return;
        
        updateDifficulty();
        
        // Only spawn if we haven't reached max active moles and have available holes
        const availableHoles = getAvailableHoles();
        if (activeMoles.size >= maxActiveMoles || availableHoles.length === 0) {
            return;
        }
        
        const idx = availableHoles[Math.floor(Math.random() * availableHoles.length)];
        const moleData = {
            index: idx,
            isThreat: true,
            timeout: null
        };
        
        // Update mole image based on current stage (stage 1 = bossCount 0)
        const currentStage = bossCount + 1;
        const moleImg = moles[idx].querySelector('.mole-img');
        if (moleImg) {
            moleImg.src = getMoleAsset(currentStage, false);
        }
        
        // Show the mole
        moles[idx].classList.add('show');
        activeMoles.set(idx, moleData);
        
        // Set timeout for this mole to disappear
        const upTime = 1500 + Math.random() * 1500; // 1.5-3 seconds
        moleData.timeout = setTimeout(() => {
            if (activeMoles.has(idx)) {
                moles[idx].classList.remove('show');
                activeMoles.delete(idx);
            }
        }, upTime);
    }

    function startSpawning() {
        if (spawnInterval) clearInterval(spawnInterval);
        
        // Spawn first mole immediately
        spawnMole();
        
        spawnInterval = setInterval(() => {
            if (gameActive) {
                spawnMole();
                // Update spawn rate dynamically
                clearInterval(spawnInterval);
                startSpawning();
            }
        }, currentSpawnRate);
    }

    function startBossSchedule() {
        if (bossInterval) clearInterval(bossInterval);
        // First boss after 30s, then every 30s
        bossInterval = setInterval(() => {
            if (gameActive) {
                spawnBoss();
            }
        }, 30000);
    }

    function spawnBoss() {
        if (!gameActive || isBossActive) return;
        // Clear current moles
        activeMoles.forEach((moleData, idx) => {
            clearTimeout(moleData.timeout);
            moles[idx].classList.remove('show');
        });
        activeMoles.clear();

        isBossActive = true;
        bossShieldActive = false;
        quizInProgress = false;
        questionsAskedThisBoss = 0; // Reset questions counter for new boss
        bossHP = bossMaxHP;
        
        // Update boss image based on stage
        const currentStage = bossCount + 1;
        const bossImg = moles[bossIndex].querySelector('.mole-img');
        if (bossImg) {
            bossImg.src = getBossAsset(currentStage);
        }
        
        // Show boss at middle hole
        moles[bossIndex].classList.add('show', 'boss');
        showPointPopup(moles[bossIndex], 'BOSS THREAT!', 'wrong');
        
        // Show boss health display
        updateBossHealthDisplay();
    }

    function handleBossTap() {
        if (!isBossActive) return;
        // If shield is active, require quiz
        if (bossShieldActive) {
            if (!quizInProgress) triggerBossQuiz();
            playSoundWrong();
            return;
        }
        // Damage boss
        bossHP = Math.max(0, bossHP - 1);
        playSoundHit();
        showPointPopup(moles[bossIndex], '-1', 'wrong');
        updateBossHealthDisplay();

        // Trigger quiz at specific HP values (6 and 2) for stages 1 and 2
        const stage = bossCount + 1;
        if (stage <= 2 && questionsAskedThisBoss < 2) {
            if ((bossHP === 6 && questionsAskedThisBoss === 0) || (bossHP === 2 && questionsAskedThisBoss === 1)) {
                bossShieldActive = true;
                triggerBossQuiz();
                return;
            }
        }

        // Defeat
        if (bossHP <= 0) {
            defeatBoss();
        }
    }

    function triggerBossQuiz() {
        if (quizInProgress) return;
        quizInProgress = true;
        questionsAskedThisBoss++; // Increment questions counter

        const modal = document.getElementById('quiz-modal');
        const qEl = document.getElementById('quiz-question');
        const optsEl = document.getElementById('quiz-options');
        const cancelBtn = document.getElementById('quiz-cancel');

        if (!modal || !qEl || !optsEl || !cancelBtn) {
            quizInProgress = false;
            return;
        }

        // Prepare a shuffled copy to avoid repeats within this quiz
        const shuffled = [...quizPool].sort(() => Math.random() - 0.5);
        const q = shuffled[0]; // Only ask one question per trigger

        function showQuestion() {
            qEl.textContent = q.q;
            optsEl.innerHTML = '';
            q.choices.forEach((choice, i) => {
                const btn = document.createElement('button');
                btn.className = 'quiz-btn';
                btn.textContent = `${i + 1}) ${choice}`;
                btn.addEventListener('click', () => resolveAnswer(i === q.answer));
                optsEl.appendChild(btn);
            });
        }

        function closeModal() {
            modal.classList.remove('show');
            modal.style.display = 'none';
            cancelBtn.onclick = null;
        }

        function resolveAnswer(correct) {
            if (!correct) {
                // Any wrong answer regenerates and ends quiz
                closeModal();
                bossHP = bossMaxHP;
                showPointPopup(moles[bossIndex], 'Regenerated!', 'wrong');
                playSoundWrong();
                quizInProgress = false;
                return;
            }

            // Correct answer -> break shield
            closeModal();
            bossShieldActive = false;
            showPointPopup(moles[bossIndex], 'Shield Broken!', 'correct');
            playSoundScore();
            quizInProgress = false;
        }

        cancelBtn.onclick = () => resolveAnswer(false);
        modal.style.display = 'block';
        modal.classList.add('show');
        showQuestion();
    }

    function defeatBoss() {
        // Reward
        score += 500;
        scoreElement.textContent = `SCORE ${score}`;
        showPointPopup(moles[bossIndex], '+500 System Upgrade', 'correct');
        playSoundScore();

        // Despawn boss
        moles[bossIndex].classList.remove('show', 'boss');
        isBossActive = false;
        bossShieldActive = false;
        quizInProgress = false;
        bossCount++;

        // Hide boss health display
        updateBossHealthDisplay();

        // Check if this was stage 2 (final stage)
        if (bossCount >= 2) {
            // End the game after stage 2
            endGame();
        } else {
            // Escalate difficulty: more HP next time
            bossMaxHP = 10 + Math.min(10, bossCount * 2);
            // Resume spawning immediately
            startSpawning();
        }
    }

    holes.forEach((hole, idx) => {
        hole.addEventListener('click', (e) => {
            if (!gameActive) return;
            
            // Boss handling
            if (isBossActive && idx === bossIndex) {
                handleBossTap();
                return;
            }

            if (activeMoles.has(idx) && moles[idx].classList.contains('show')) {
                const moleData = activeMoles.get(idx);
                
                // Clear the timeout and remove from active moles
                clearTimeout(moleData.timeout);
                activeMoles.delete(idx);
                
                const img = moles[idx].querySelector('.mole-img');
                
                // Normal threat neutralized - use appropriate whacked asset based on stage
                const currentStage = bossCount + 1;
                if (img) img.src = getMoleAsset(currentStage, true);
                showPointPopup(moles[idx], '+10', 'correct');
                score += 10;
                playSoundScore();
                
                // Hide mole after showing feedback - reset to ready state
                setTimeout(() => { 
                    if (img) img.src = getMoleAsset(currentStage, false); 
                    moles[idx].classList.remove('show');
                }, 500);
                
                scoreElement.textContent = `SCORE ${score}`;
            }
        });
    });

    function showPointPopup(moleElem, text, type) {
        const popup = document.createElement('span');
        popup.className = `point-popup ${type}`;
        popup.textContent = text;
        const moleRect = moleElem.getBoundingClientRect();
        const boardRect = gameBoard.getBoundingClientRect();
        const left = moleRect.left - boardRect.left + moleRect.width / 2;
        const top = moleRect.top - boardRect.top;
        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
        popup.style.position = 'absolute';
        gameBoard.appendChild(popup);
        setTimeout(() => { popup.remove(); }, 700);
    }

    gameBoard.addEventListener('click', (e) => {
        if (!gameActive) return;
        
        // Enable audio on first interaction and ensure hit sound plays
        if (!audioEnabled) {
        enableAudio();
        }
        
        clearTimeout(hammerTimeout);
        
        // Get position relative to game board
        const boardRect = gameBoard.getBoundingClientRect();
        const left = e.clientX - boardRect.left;
        const top = e.clientY - boardRect.top;
        
        hammer.style.left = left + 'px';
        hammer.style.top = top + 'px';
        hammer.style.display = 'block';
        hammer.classList.add('click');
        
        // Play hit sound with improved reliability
        playSoundHit();
        
        hammerTimeout = setTimeout(() => {
            hammer.classList.remove('click');
            hammer.style.display = 'none';
        }, 350);
    });

    function startTimer() {
        timerElement.textContent = timer + 's';
        timerInterval = setInterval(() => {
            // Pause countdown during boss stage
            if (isBossActive) {
                timerElement.textContent = timer + 's';
                return;
            }
            
            timer--;
            if (timer <= 0) {
                // Trigger boss instead of ending game
                spawnBoss();
                timer = 30; // Reset for next boss cycle
            }
            timerElement.textContent = timer + 's';
        }, 1000);
    }

    let highScore = parseInt(localStorage.getItem('whack_high_score') || '0', 10);
    const highScoreElement = document.getElementById('high-score');
    function updateHighScoreDisplay() {
        highScoreElement.textContent = `HIGH SCORE ${highScore}`;
    }
    updateHighScoreDisplay();

    function endGame() {
        gameActive = false;
        clearInterval(timerInterval);
        clearInterval(spawnInterval);
        clearInterval(bossInterval);
        
        // Clear all active moles
        activeMoles.forEach((moleData, idx) => {
            clearTimeout(moleData.timeout);
            moles[idx].classList.remove('show');
        });
        activeMoles.clear();
        isBossActive = false;
        bossShieldActive = false;
        
        // Hide boss health display
        if (bossHealthRow) {
            bossHealthRow.style.display = 'none';
        }
        
        hammer.style.display = 'none';
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('whack_high_score', highScore);
            updateHighScoreDisplay();
        }
        if (restartBtn) restartBtn.style.display = 'inline-block';
    }

    // Ensure the Start Game button is visible and clickable
    if (startBtn) {
        startBtn.style.display = 'inline-block';
        startBtn.style.pointerEvents = 'auto';
        startBtn.style.zIndex = '100';
        startBtn.addEventListener('click', () => {
            console.log('Start Game button clicked');
            
            // Enable audio immediately when starting game
            enableAudio();
            
            // Small delay to ensure audio context is ready
            setTimeout(() => {
            if (startBtn) startBtn.style.display = 'none';
            if (restartBtn) restartBtn.style.display = 'none';
            if (hammer) hammer.style.display = 'none';
            startGame();
            }, 100);
        });
    }

    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            // Enable audio on interaction
            enableAudio();
            
            // Small delay to ensure audio context is ready
            setTimeout(() => {
            if (restartBtn) restartBtn.style.display = 'none';
            if (startBtn) startBtn.style.display = 'none';
            if (hammer) hammer.style.display = 'none';
            startGame();
            }, 100);
        });
    }

    if (hammer) hammer.style.display = 'none';
    if (startBtn) startBtn.style.display = 'inline-block';
    if (restartBtn) restartBtn.style.display = 'none';
});

// Add some fun keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        const startBtn = document.getElementById('start-btn');
        if (startBtn && startBtn.style.display !== 'none') {
            startBtn.click();
        }
    }
    
    if (e.code === 'KeyR') {
        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn && restartBtn.style.display !== 'none') {
            restartBtn.click();
        }
    }
}); 