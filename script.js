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
const HIT_RADIUS = 35; // 当たり判定を広くして快適に

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

    // 描画ループ
    render();
}

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
                index: y * gridCount + x,
                row: y,
                col: x
            });
        }
    }
}

/**
 * 【最重要ロジック】2つの点の間にある点を取得する
 */
function getIntermediatePoints(idx1, idx2) {
    const p1 = dots[idx1];
    const p2 = dots[idx2];
    
    const rowDiff = p2.row - p1.row;
    const colDiff = p2.col - p1.col;
    
    // 直線上（水平、垂直、45度斜め）かチェック
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
 * ゲームロジック
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
 * 【ロジック修正】飛び越しを防ぎ、中間の点を含める生成
 */
function generatePattern(targetLength) {
    pattern = [];
    let available = [...Array(dots.length).keys()];
    
    // 最初の点
    let currentIdx = available[Math.floor(Math.random() * available.length)];
    pattern.push(currentIdx);

    let attempts = 0;
    while (pattern.length < targetLength && attempts < 100) {
        attempts++;
        const nextIdx = Math.floor(Math.random() * dots.length);
        
        // 自分自身、または既に使用済みの点はスキップ
        if (nextIdx === currentIdx || pattern.includes(nextIdx)) continue;

        const intermediates = getIntermediatePoints(currentIdx, nextIdx);
        
        // 直線上にない、または直線上に既に使用済みの点がある場合はやり直し
        if (intermediates === null) continue;
        if (intermediates.some(mid => pattern.includes(mid))) continue;

        // 中間の点があれば全て追加し、最後に目的の点を追加
        intermediates.forEach(mid => pattern.push(mid));
        pattern.push(nextIdx);
        currentIdx = nextIdx;
    }
}

/**
 * 暗記アニメーション
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
        startTimer();
    }, 400);
}

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
        if (dist < HIT_RADIUS) {
            if (!userInput.includes(dot.index)) {
                // 中間の点があれば自動取得
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
 * 描画システム
 */
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 線の描画
    if (userInput.length > 0) {
        ctx.beginPath();
        ctx.lineWidth = 8; // 太めの線
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#ffffff";
        
        // グロー効果
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
        ctx.shadowBlur = 0; // リセット
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

init();
