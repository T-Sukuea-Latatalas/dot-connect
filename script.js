/**
 * PATTERN MEMORY GAME - script.js
 */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const levelText = document.getElementById('level-value');
const scoreText = document.getElementById('score-value');
const statusMsg = document.getElementById('status-message');
const lifeContainer = document.querySelector('.timer-container'); // タイマーの場所をライフ表示に流用

// ゲーム設定と状態管理
let gameState = 'IDLE'; // IDLE, MEMORIZING, INPUTTING, GAMEOVER
let level = 1;
let score = 0;
let gridCount = 3; 
let pattern = [];
let userInput = [];
let dots = []; 
let lastDotIndex = null;
let isDragging = false;
let currentMousePos = { x: 0, y: 0 };

// ライフ制の追加
let lives = 3;
const MAX_LIVES = 3;

/**
 * 初期化
 */
function init() {
    setupCanvas();
    startBtn.addEventListener('click', startGame);

    // マウスイベント
    canvas.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);

    // タッチイベント
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleStart(e.touches[0]);
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
        handleMove(e.touches[0]);
    }, { passive: false });
    window.addEventListener('touchend', handleEnd);

    // 描画ループの開始
    render();
}

/**
 * キャンバスのセットアップ
 */
function setupCanvas() {
    const size = 320;
    canvas.width = size;
    canvas.height = size;
    calculateDots();
}

/**
 * ドットの計算
 */
function calculateDots() {
    dots = [];
    const spacing = (canvas.width - 40 * 2) / (gridCount - 1);
    for (let y = 0; y < gridCount; y++) {
        for (let x = 0; x < gridCount; x++) {
            dots.push({
                x: 40 + x * spacing,
                y: 40 + y * spacing,
                index: y * gridCount + x,
                row: y,
                col: x
            });
        }
    }
}

/**
 * 中間の点を取得するロジック
 */
function getIntermediatePoints(idx1, idx2) {
    const p1 = dots[idx1];
    const p2 = dots[idx2];
    const rowDiff = p2.row - p1.row;
    const colDiff = p2.col - p1.col;
    const isStraight = (rowDiff === 0 || colDiff === 0 || Math.abs(rowDiff) === Math.abs(colDiff));
    if (!isStraight) return null;

    const stepR = Math.sign(rowDiff);
    const stepC = Math.sign(colDiff);
    const points = [];
    let r = p1.row + stepR;
    let c = p1.col + stepC;

    while (r !== p2.row || c !== p2.col) {
        points.push(r * gridCount + c);
        r += stepR;
        c += stepC;
    }
    return points;
}

/**
 * ライフ表示の更新
 */
function updateLifeDisplay() {
    lifeContainer.innerHTML = ''; // 中身をクリア
    lifeContainer.style.display = 'flex';
    lifeContainer.style.justifyContent = 'center';
    lifeContainer.style.alignItems = 'center';
    lifeContainer.style.gap = '8px';
    lifeContainer.style.background = 'none'; // 背景バーを消す

    for (let i = 0; i < MAX_LIVES; i++) {
        const heart = document.createElement('span');
        heart.innerText = i < lives ? '❤️' : '🖤';
        heart.style.fontSize = '1.2rem';
        heart.style.textShadow = i < lives ? '0 0 10px rgba(255, 255, 255, 0.5)' : 'none';
        lifeContainer.appendChild(heart);
    }
}

/**
 * ゲーム開始
 */
function startGame() {
    level = 1;
    score = 0;
    lives = MAX_LIVES;
    gridCount = 3;
    levelText.innerText = level;
    scoreText.innerText = score;
    startBtn.disabled = true;
    updateLifeDisplay();
    startRound(true);
}

/**
 * ラウンド開始
 * @param {boolean} isNewPattern - 新しい問題を作成するかどうか
 */
function startRound(isNewPattern) {
    userInput = [];
    lastDotIndex = null;
    gameState = 'MEMORIZING';
    
    if (isNewPattern) {
        statusMsg.innerText = "パターンを覚えてください";
        statusMsg.style.color = "#ffffff";
        gridCount = (level >= 6) ? 4 : 3;
        calculateDots();
        generatePattern(level + 2);
    }

    animatePattern();
}

/**
 * 問題パターンの生成（飛び越し防止）
 */
function generatePattern(targetLength) {
    pattern = [];
    let currentIdx = Math.floor(Math.random() * dots.length);
    pattern.push(currentIdx);

    let attempts = 0;
    while (pattern.length < targetLength && attempts < 100) {
        attempts++;
        const nextIdx = Math.floor(Math.random() * dots.length);
        if (nextIdx === currentIdx || pattern.includes(nextIdx)) continue;

        const intermediates = getIntermediatePoints(currentIdx, nextIdx);
        if (intermediates === null) continue;
        if (intermediates.some(mid => pattern.includes(mid))) continue;

        intermediates.forEach(mid => pattern.push(mid));
        pattern.push(nextIdx);
        currentIdx = nextIdx;
    }
}

/**
 * お手本アニメーション
 */
async function animatePattern() {
    const fullPattern = [...pattern];
    for (let i = 0; i < fullPattern.length; i++) {
        userInput = fullPattern.slice(0, i + 1);
        await new Promise(r => setTimeout(r, 600 - Math.min(level * 40, 450)));
    }
    
    setTimeout(() => {
        userInput = [];
        gameState = 'INPUTTING';
        statusMsg.innerText = "なぞってください！";
    }, 400);
}

/**
 * イベントハンドラ
 */
function handleStart(e) {
    if (gameState !== 'INPUTTING') return;
    isDragging = true;
    updateMousePos(e);
    checkCollision();
}

function handleMove(e) {
    if (!isDragging || gameState !== 'INPUTTING') return;
    updateMousePos(e);
    checkCollision();
}

function handleEnd() {
    if (!isDragging || gameState !== 'INPUTTING') return;
    isDragging = false;
    checkResult();
}

function updateMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    currentMousePos.x = e.clientX - rect.left;
    currentMousePos.y = e.clientY - rect.top;
}

function checkCollision() {
    dots.forEach(dot => {
        const dist = Math.hypot(dot.x - currentMousePos.x, dot.y - currentMousePos.y);
        if (dist < 35) {
            if (!userInput.includes(dot.index)) {
                if (userInput.length > 0) {
                    const prevIdx = userInput[userInput.length - 1];
                    const mids = getIntermediatePoints(prevIdx, dot.index);
                    if (mids) {
                        mids.forEach(m => {
                            if (!userInput.includes(m)) userInput.push(m);
                        });
                    }
                }
                userInput.push(dot.index);
                lastDotIndex = dot.index;
                if (navigator.vibrate) navigator.vibrate(10);
            }
        }
    });
}

/**
 * 判定ロジック
 */
function checkResult() {
    const isCorrect = JSON.stringify(pattern) === JSON.stringify(userInput);

    if (isCorrect) {
        level++;
        score += level * 100;
        levelText.innerText = level;
        scoreText.innerText = score;
        statusMsg.innerText = "正解！";
        statusMsg.style.color = "#ffffff";
        setTimeout(() => startRound(true), 1000);
    } else {
        lives--;
        updateLifeDisplay();
        
        if (lives > 0) {
            statusMsg.innerText = `ミス！ あと ${lives} 回間違えると終了です`;
            statusMsg.style.color = "#ffcc00";
            // ライフが残っている場合は同じ問題でお手本を再表示
            setTimeout(() => startRound(false), 1500);
        } else {
            gameOver("ゲームオーバー！");
        }
    }
}

function gameOver(msg) {
    gameState = 'GAMEOVER';
    statusMsg.innerText = msg;
    statusMsg.style.color = "#ff4444";
    startBtn.disabled = false;
    startBtn.innerText = "リトライ";
}

/**
 * 描画システム
 */
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 線の描画
    if (userInput.length > 0) {
        ctx.beginPath();
        ctx.lineWidth = 8;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#ffffff";
        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(255, 255, 255, 0.8)";

        userInput.forEach((idx, i) => {
            const dot = dots[idx];
            if (i === 0) ctx.moveTo(dot.x, dot.y);
            else ctx.lineTo(dot.x, dot.y);
        });

        if (isDragging && lastDotIndex !== null) {
            const lastDot = dots[lastDotIndex];
            ctx.lineTo(currentMousePos.x, currentMousePos.y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // ドットの描画
    dots.forEach(dot => {
        const isSelected = userInput.includes(dot.index);
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 10, 0, Math.PI * 2);
        if (isSelected) {
            ctx.fillStyle = "#ffffff";
            ctx.shadowBlur = 20;
            ctx.shadowColor = "rgba(255, 255, 255, 1)";
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
            ctx.fill();
        }
    });

    requestAnimationFrame(render);
}

init();
