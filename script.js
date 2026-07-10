/**
 * PATTERN MEMORY GAME - script.js
 */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const levelText = document.getElementById('level-value');
const scoreText = document.getElementById('score-value');
const statusMsg = document.getElementById('status-message');
const lifeContainer = document.getElementById('life-display'); // 修正: IDで取得

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

// ライフ管理
let lives = 3;
const MAX_LIVES = 3;

// 定数
const PADDING = 40;
const DOT_RADIUS = 10;
const HIT_RADIUS = 35; // 当たり判定の広さ

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
        if (e.cancelable) e.preventDefault();
        handleStart(e.touches[0]);
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
        if (e.cancelable) e.preventDefault();
        handleMove(e.touches[0]);
    }, { passive: false });
    window.addEventListener('touchend', (e) => {
        handleEnd();
    }, { passive: false });

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
 * ドットの配置計算
 */
function calculateDots() {
    dots = [];
    const spacing = (canvas.width - PADDING * 2) / (gridCount - 1);
    for (let y = 0; y < gridCount; y++) {
        for (let x = 0; x < gridCount; x++) {
            dots.push({
                x: PADDING + x * spacing,
                y: PADDING + y * spacing,
                index: y * gridCount + x,
                row: y,
                col: x
            });
        }
    }
}

/**
 * 直線上の点（中間点）を取得する
 */
function getIntermediatePoints(idx1, idx2) {
    const p1 = dots[idx1];
    const p2 = dots[idx2];
    const rowDiff = p2.row - p1.row;
    const colDiff = p2.col - p1.col;

    // 水平、垂直、または45度斜め判定
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
    if (!lifeContainer) return;
    lifeContainer.innerHTML = '';
    for (let i = 0; i < MAX_LIVES; i++) {
        const heart = document.createElement('span');
        heart.innerText = i < lives ? '❤️' : '🖤';
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
 * パターンの生成（安定化版）
 */
function generatePattern(targetLength) {
    pattern = [];
    let currentIdx = Math.floor(Math.random() * dots.length);
    pattern.push(currentIdx);

    let attempts = 0;
    while (pattern.length < targetLength && attempts < 200) {
        attempts++;
        const nextIdx = Math.floor(Math.random() * dots.length);
        
        if (nextIdx === currentIdx || pattern.includes(nextIdx)) continue;

        const intermediates = getIntermediatePoints(currentIdx, nextIdx);
        
        // 直線上にない、または直線上に既に使用済みの点がある場合は無効
        if (intermediates === null) continue;
        if (intermediates.some(mid => pattern.includes(mid))) continue;

        // 中間点を追加
        intermediates.forEach(mid => pattern.push(mid));
        pattern.push(nextIdx);
        currentIdx = nextIdx;
    }
    
    // 目標の長さに届かない場合の保険（最低3点は確保）
    if (pattern.length < 3) generatePattern(targetLength);
}

/**
 * お手本アニメーション（排他制御）
 */
async function animatePattern() {
    const fullPattern = [...pattern];
    for (let i = 0; i < fullPattern.length; i++) {
        userInput = fullPattern.slice(0, i + 1);
        await new Promise(r => setTimeout(r, Math.max(200, 600 - level * 40)));
    }
    
    setTimeout(() => {
        userInput = [];
        gameState = 'INPUTTING'; // ここで入力を許可
        statusMsg.innerText = "なぞってください！";
    }, 400);
}

/**
 * イベント処理
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
    // スケール比率を考慮して座標を変換
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    currentMousePos.x = (e.clientX - rect.left) * scaleX;
    currentMousePos.y = (e.clientY - rect.top) * scaleY;
}

function checkCollision() {
    dots.forEach(dot => {
        const dist = Math.hypot(dot.x - currentMousePos.x, dot.y - currentMousePos.y);
        if (dist < HIT_RADIUS) {
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
 * 判定
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
            statusMsg.innerText = `ミス！ 残り ${lives} 回`;
            statusMsg.style.color = "#ffcc00";
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
 * 描画ループ
 */
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 線の描画
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

    // 2. ドットの描画
    dots.forEach(dot => {
        const isSelected = userInput.includes(dot.index);
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
        
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

// 起動
init();
