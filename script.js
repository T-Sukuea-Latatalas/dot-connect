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
const DOT_RADIUS = 12;
const HIT_RADIUS = 32; // 当たり判定を少し広げて快適に

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
    
    if (level >= 6) gridCount = 4;
    else gridCount = 3;
    
    calculateDots();
    generatePattern(level + 2);
    animatePattern();
}

function generatePattern(length) {
    pattern = [];
    let available = [...Array(dots.length).keys()];
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * available.length);
        pattern.push(available.splice(randomIndex, 1)[0]);
    }
}

async function animatePattern() {
    for (let i = 0; i < pattern.length; i++) {
        userInput = pattern.slice(0, i + 1); // 描画のために一時的にuserInputを使う
        await new Promise(r => setTimeout(r, 600 - Math.min(level * 30, 400)));
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
    const duration = Math.max(2000, 7000 - (level * 500)); 
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
 * 途中の点を自動取得する重要ロジック
 */
function addIntermediateDots(startIdx, endIdx) {
    const start = dots[startIdx];
    const end = dots[endIdx];
    
    // 行と列の差分
    const dRow = end.row - start.row;
    const dCol = end.col - start.col;
    
    // 直線上（垂直・水平・45度斜め）かチェック
    const isStraight = dRow === 0 || dCol === 0 || Math.abs(dRow) === Math.abs(dCol);
    
    if (isStraight) {
        const stepRow = Math.sign(dRow);
        const stepCol = Math.sign(dCol);
        
        let currRow = start.row + stepRow;
        let currCol = start.col + stepCol;
        
        // 終点に到達するまでループ
        while (currRow !== end.row || currCol !== end.col) {
            const midIndex = currRow * gridCount + currCol;
            if (!userInput.includes(midIndex)) {
                userInput.push(midIndex);
            }
            currRow += stepRow;
            currCol += stepCol;
        }
    }
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
                // 既に点を通っている場合、その間の点も自動取得
                if (userInput.length > 0) {
                    const prevIdx = userInput[userInput.length - 1];
                    addIntermediateDots(prevIdx, dot.index);
                }
                userInput.push(dot.index);
                lastDotIndex = dot.index;
                if (navigator.vibrate) navigator.vibrate(15);
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
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#ffffff";
        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(255, 255, 255, 0.5)";

        userInput.forEach((idx, i) => {
            const dot = dots[idx];
            if (i === 0) ctx.moveTo(dot.x, dot.y);
            else ctx.lineTo(dot.x, dot.y);
        });

        // 最後の点から指先/マウスまで伸ばす（フリック感）
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
            ctx.fillStyle = "#ffffff"; // 不透明白
            ctx.shadowBlur = 20;
            ctx.shadowColor = "#ffffff";
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = "rgba(255, 255, 255, 0.2)"; // 半透明白
            ctx.fill();
        }
    });

    requestAnimationFrame(render);
}

// 起動
init();
