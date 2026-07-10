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
let dots = []; // 各ドットの情報 {x, y, index, row, col}
let lastDotIndex = null;
let isDragging = false;
let currentMousePos = { x: 0, y: 0 };

// タイマー関連
let timeLeft = 100;
let timerInterval = null;

// 定数
const PADDING = 40;
const DOT_RADIUS = 10;
const HIT_RADIUS = 38; // 当たり判定を広くして操作性を向上

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
 * ドットの座標とグリッド情報の計算
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
 * 【機能要件】中間の点を取得するロジック
 * 2点間に存在する未登録のドットを配列で返す
 */
function getIntermediateDots(startIdx, endIdx, currentList) {
    const start = dots[startIdx];
    const end = dots[endIdx];
    const intermediates = [];

    const dRow = end.row - start.row;
    const dCol = end.col - start.col;

    // 水平、垂直、または45度斜めか判定
    if (dRow === 0 || dCol === 0 || Math.abs(dRow) === Math.abs(dCol)) {
        const stepRow = Math.sign(dRow);
        const stepCol = Math.sign(dCol);
        
        let currRow = start.row + stepRow;
        let currCol = start.col + stepCol;

        // 終点に到達するまで直進
        while (currRow !== end.row || currCol !== end.col) {
            const midIdx = currRow * gridCount + currCol;
            // まだリストに含まれていない場合のみ追加
            if (!currentList.includes(midIdx)) {
                intermediates.push(midIdx);
            }
            currRow += stepRow;
            currCol += stepCol;
        }
    }
    return intermediates;
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
    lastDotIndex = null;
    gameState = 'MEMORIZING';
    statusMsg.innerText = "パターンを覚えてください";
    statusMsg.style.color = "#ffffff";
    
    // レベル6以上で4x4に拡張
    gridCount = (level >= 6) ? 4 : 3;
    
    calculateDots();
    generatePattern(level + 2);
    animatePattern();
}

/**
 * パターンの生成
 */
function generatePattern(targetLength) {
    pattern = [];
    let available = [...Array(dots.length).keys()];
    
    // 最初の点
    let lastIdx = available.splice(Math.floor(Math.random() * available.length), 1)[0];
    pattern.push(lastIdx);

    while (pattern.length < targetLength && available.length > 0) {
        let nextIdx = available[Math.floor(Math.random() * available.length)];
        
        // 【機能要件】中間の点があれば先に追加
        const intermediates = getIntermediateDots(lastIdx, nextIdx, pattern);
        intermediates.forEach(mid => {
            pattern.push(mid);
            available = available.filter(idx => idx !== mid);
        });

        // 本来の点を選択
        if (!pattern.includes(nextIdx)) {
            pattern.push(nextIdx);
            available = available.filter(idx => idx !== nextIdx);
            lastIdx = nextIdx;
        }
    }
    // ターゲットの長さを超えすぎた場合は切り捨て（物理的に可能な範囲にする）
    if (pattern.length > targetLength + 2) pattern = pattern.slice(0, targetLength + 2);
}

/**
 * 暗記アニメーション
 */
async function animatePattern() {
    const displayList = [];
    for (let i = 0; i < pattern.length; i++) {
        displayList.push(pattern[i]);
        userInput = [...displayList]; // render()に描画させる
        await new Promise(r => setTimeout(r, 600 - Math.min(level * 40, 450)));
    }
    
    setTimeout(() => {
        userInput = [];
        gameState = 'INPUTTING';
        statusMsg.innerText = "なぞってください！";
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
    const duration = Math.max(2000, 8000 - (level * 600)); 
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
 * 入力ハンドリング
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

/**
 * 衝突判定（ドットを通過したか）
 */
function checkCollision() {
    dots.forEach(dot => {
        const dist = Math.hypot(dot.x - currentMousePos.x, dot.y - currentMousePos.y);
        if (dist < HIT_RADIUS) {
            if (!userInput.includes(dot.index)) {
                // 【機能要件】中間の点があれば自動取得
                if (userInput.length > 0) {
                    const prevIdx = userInput[userInput.length - 1];
                    const intermediates = getIntermediateDots(prevIdx, dot.index, userInput);
                    intermediates.forEach(mid => userInput.push(mid));
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
    clearInterval(timerInterval);
    const isCorrect = JSON.stringify(pattern) === JSON.stringify(userInput);
    if (isCorrect) {
        level++;
        score += level * 100;
        levelText.innerText = level;
        scoreText.innerText = score;
        statusMsg.innerText = "正解！";
        statusMsg.style.color = "#22c55e";
        setTimeout(startRound, 1000);
    } else {
        gameOver("間違いです！");
    }
}

function gameOver(msg) {
    gameState = 'GAMEOVER';
    statusMsg.innerText = msg;
    statusMsg.style.color = "#ef4444";
    startBtn.disabled = false;
    startBtn.innerText = "もう一度プレイ";
}

/**
 * 【視覚要件】描画システム
 */
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 線の描画
    if (userInput.length > 0) {
        ctx.beginPath();
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#ffffff";
        
        // 選択中の点と線にグロー効果
        ctx.shadowBlur = 12;
        ctx.shadowColor = "rgba(255, 255, 255, 0.8)";

        userInput.forEach((idx, i) => {
            const dot = dots[idx];
            if (i === 0) ctx.moveTo(dot.x, dot.y);
            else ctx.lineTo(dot.x, dot.y);
        });

        // 最後の点から現在のポインタ位置までの動的な線
        if (isDragging && lastDotIndex !== null) {
            const lastDot = dots[lastDotIndex];
            ctx.lineTo(currentMousePos.x, currentMousePos.y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // 他の描画に影響させないようリセット
    }

    // 2. ドットの描画
    dots.forEach(dot => {
        const isSelected = userInput.includes(dot.index);
        
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
        
        if (isSelected) {
            ctx.fillStyle = "#ffffff"; // 純白
            ctx.shadowBlur = 15;
            ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = "rgba(255, 255, 255, 0.2)"; // 半透明の白
            ctx.fill();
        }
    });

    requestAnimationFrame(render);
}

// 起動
init();
