/**
 * PATTERN MEMORY GAME - script.js
 */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const levelText = document.getElementById('level-value');
const scoreText = document.getElementById('score-value');
const statusMsg = document.getElementById('status-message');
const timerBar = document.getElementById('timer-bar');

// ゲーム設定と状態管理
let gameState = 'IDLE'; // IDLE, MEMORIZING, INPUTTING, GAMEOVER
let level = 1;
let score = 0;
let gridCount = 3; // 3x3から開始
let pattern = [];
let userInput = [];
let dots = []; // 各ドットの座標情報
let lastDot = null;
let isDragging = false;
let currentMousePos = { x: 0, y: 0 };

// タイマー関連
let timeLeft = 100;
let timerInterval = null;

// 定数
const PADDING = 40;
const DOT_RADIUS = 12;
const HIT_RADIUS = 25; // 当たり判定の広さ

/**
 * 初期化・イベントリスナー
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

    draw();
}

/**
 * キャンバスのサイズ設定とドット配置の計算
 */
function setupCanvas() {
    const size = 320;
    canvas.width = size;
    canvas.height = size;
    calculateDots();
}

function calculateDots() {
    dots = [];
    const spacing = (canvas.width - PADDING * 2) / (gridCount - 1);
    for (let y = 0; y < gridCount; y++) {
        for (let x = 0; x < gridCount; x++) {
            dots.push({
                x: PADDING + x * spacing,
                y: PADDING + y * spacing,
                index: y * gridCount + x
            });
        }
    }
}

/**
 * ゲーム開始
 */
function startGame() {
    level = 1;
    score = 0;
    gridCount = 3;
    levelText.innerText = level;
    scoreText.innerText = score;
    startBtn.disabled = true;
    startRound();
}

/**
 * ラウンド開始
 */
function startRound() {
    userInput = [];
    lastDot = null;
    gameState = 'MEMORIZING';
    statusMsg.innerText = "パターンを覚えてください";
    statusMsg.style.color = "var(--accent-color)";
    
    // レベルに応じてグリッド拡張 (例: Level 6から4x4)
    if (level >= 6) {
        gridCount = 4;
    } else {
        gridCount = 3;
    }
    calculateDots();

    // パターンの生成 (長さは level + 2)
    generatePattern(level + 2);

    // 再生アニメーション
    animatePattern();
}

/**
 * ランダムなパターンを生成（重複なし）
 */
function generatePattern(length) {
    pattern = [];
    let availableDots = [...Array(dots.length).keys()];
    
    for (let i = 0; i < length; i++) {
        if (availableDots.length === 0) break;
        const randomIndex = Math.floor(Math.random() * availableDots.length);
        const dotIndex = availableDots.splice(randomIndex, 1)[0];
        pattern.push(dotIndex);
    }
}

/**
 * お手本アニメーション
 */
async function animatePattern() {
    for (let i = 0; i < pattern.length; i++) {
        draw(i + 1); // i+1個目までの線を描画
        await new Promise(r => setTimeout(r, 600 - Math.min(level * 30, 300))); 
    }
    
    // 暗記終了、入力フェーズへ
    setTimeout(() => {
        gameState = 'INPUTTING';
        statusMsg.innerText = "なぞってください！";
        statusMsg.style.color = "var(--primary-color)";
        startTimer();
    }, 400);
}

/**
 * タイマー管理
 */
function startTimer() {
    timeLeft = 100;
    timerBar.style.width = "100%";
    timerBar.className = "timer-bar";
    
    // レベルが上がるほど早くなる
    const duration = Math.max(2000, 6000 - (level * 400)); 
    const step = 100 / (duration / 20);

    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        timeLeft -= step;
        timerBar.style.width = `${timeLeft}%`;

        if (timeLeft < 50) timerBar.classList.add('warning');
        if (timeLeft < 20) timerBar.classList.add('critical');

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            gameOver("時間切れ！");
        }
    }, 20);
}

/**
 * 描画処理
 * @param {number} showLimit - お手本表示時に何番目の点まで結ぶか
 */
function draw(showLimit = null) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 線の描画（共通ロジック）
    const activePattern = (gameState === 'MEMORIZING') 
        ? pattern.slice(0, showLimit) 
        : userInput;

    if (activePattern.length > 0) {
        ctx.beginPath();
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = (gameState === 'MEMORIZING') ? "var(--accent-color)" : "var(--primary-color)";
        
        for (let i = 0; i < activePattern.length; i++) {
            const dot = dots[activePattern[i]];
            if (i === 0) ctx.moveTo(dot.x, dot.y);
            else ctx.lineTo(dot.x, dot.y);
        }

        // 入力中なら、最後の点からマウス位置まで線を引く
        if (gameState === 'INPUTTING' && isDragging && lastDot !== null) {
            const lastDotPos = dots[lastDot];
            ctx.lineTo(currentMousePos.x, currentMousePos.y);
        }
        ctx.stroke();
    }

    // ドットの描画
    dots.forEach(dot => {
        const isTarget = activePattern.includes(dot.index);
        
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
        
        if (isTarget) {
            ctx.fillStyle = (gameState === 'MEMORIZING') ? "var(--accent-color)" : "var(--primary-color)";
            // 光るエフェクト
            ctx.shadowBlur = 10;
            ctx.shadowColor = ctx.fillStyle;
        } else {
            ctx.fillStyle = "var(--dot-normal)";
            ctx.shadowBlur = 0;
        }
        ctx.fill();
        ctx.shadowBlur = 0; // リセット
    });

    if (gameState === 'MEMORIZING' || (gameState === 'INPUTTING' && isDragging)) {
        requestAnimationFrame(() => draw(showLimit));
    }
}

/**
 * 入力イベントハンドラ
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
        if (dist < HIT_RADIUS) {
            if (!userInput.includes(dot.index)) {
                userInput.push(dot.index);
                lastDot = dot.index;
                // タッチ時のバイブレーション（対応デバイスのみ）
                if (navigator.vibrate) navigator.vibrate(10);
            }
        }
    });
}

/**
 * 判定
 */
function checkResult() {
    clearInterval(timerInterval);
    
    const isCorrect = JSON.stringify(pattern) === JSON.stringify(userInput);

    if (isCorrect) {
        level++;
        score += level * 100;
        levelText.innerText = level;
        scoreText.innerText = score;
        statusMsg.innerText = "正解！";
        statusMsg.style.color = "var(--success-color)";
        
        setTimeout(startRound, 1000);
    } else {
        gameOver("間違いです！");
    }
}

function gameOver(msg) {
    gameState = 'GAMEOVER';
    statusMsg.innerText = msg + " ゲームオーバー";
    statusMsg.style.color = "var(--danger-color)";
    startBtn.disabled = false;
    startBtn.innerText = "もう一度プレイ";
    
    if (timerInterval) clearInterval(timerInterval);
    draw(); // 最終状態を描画
}

// 起動
init();
