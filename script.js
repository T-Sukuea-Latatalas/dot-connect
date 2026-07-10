/**
 * PATTERN MEMORY GAME - script.js
 */

// DOM要素
let canvas;
let ctx;
let startBtn;
let levelText;
let scoreText;
let statusMsg;
let lifeContainer;
let muteBtn; // 追加: ミュートボタン

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

// サウンドシステム設定
let audioCtx = null;
let isMuted = false;
let bgmInterval = null;
let currentBgmNoteIndex = 0;

// BGM用：アンビエントなアルペジオパターン (周波数リスト)
// 構成コード: Am7 -> G -> F -> Em
const bgmNotes = [
    220.00, 261.63, 329.63, 392.00, // Am7 (A3, C4, E4, G4)
    196.00, 246.94, 293.66, 392.00, // G (G3, B3, D4, G4)
    174.61, 220.00, 261.63, 349.23, // F (F3, A3, C4, F4)
    164.81, 196.00, 246.94, 329.63  // Em (E3, G3, B3, E4)
];

/**
 * 初期化（DOMContentLoaded イベントの発生後に安全に実行されます）
 */
function init() {
    // DOM要素の安全な取得
    canvas = document.getElementById('game-canvas');
    if (canvas) {
        ctx = canvas.getContext('2d');
    }
    startBtn = document.getElementById('start-btn');
    levelText = document.getElementById('level-value');
    scoreText = document.getElementById('score-value');
    statusMsg = document.getElementById('status-message');
    muteBtn = document.getElementById('mute-btn'); // 取得

    // ライフ表示コンテナの多重化取得（フォールバック）
    lifeContainer = document.getElementById('life-display') || 
                    document.querySelector('.timer-container') || 
                    document.querySelector('.life-container');

    // 必要となるコア要素が存在する場合のみイベントを登録
    if (canvas && startBtn) {
        setupCanvas();
        startBtn.addEventListener('click', startGame);
        if (muteBtn) {
            muteBtn.addEventListener('click', toggleMute);
        }

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

        // 描画ループの開始
        render();
    }
}

/**
 * サウンドシステム（Web Audio API）の初期化
 */
function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

/**
 * BGMのループ制御
 */
function startBGM() {
    if (bgmInterval) return;
    currentBgmNoteIndex = 0;
    // 0.45秒ごとに1拍を刻む（穏やかなLo-Fiテンポ）
    bgmInterval = setInterval(playBGMStep, 450);
}

function playBGMStep() {
    if (isMuted || !audioCtx || audioCtx.state === 'suspended') return;

    const noteHz = bgmNotes[currentBgmNoteIndex];
    
    // サイン波や三角波などの柔らかい音でBGMを演奏する
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = 'triangle'; // トゲのない暖かい音
    osc.frequency.setValueAtTime(noteHz, audioCtx.currentTime);

    // BGMがうるさくならないよう、極めて小さめの音量に設定
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.03, audioCtx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, audioCtx.currentTime); // 高域をカットして耳に優しく

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);

    currentBgmNoteIndex = (currentBgmNoteIndex + 1) % bgmNotes.length;
}

/**
 * ミュート機能のトグル
 */
function toggleMute() {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    isMuted = !isMuted;
    if (muteBtn) {
        muteBtn.innerText = isMuted ? '🔇' : '🔊';
    }
}

/**
 * 点通過時（SE）の演奏：結んだ順序に応じてピッチが少しずつ高くなります
 */
function playDotSFX(indexInSequence) {
    if (isMuted || !audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine'; // ピュアな電子音
    const baseFreq = 261.63; // C4
    // 順序が進むにつれて半音（約1.059倍）ずつ上昇させる
    const freq = baseFreq * Math.pow(1.059, indexInSequence * 2);
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}

/**
 * 正解ファンファーレ（SE）
 */
function playSuccessSFX() {
    if (isMuted || !audioCtx) return;

    const now = audioCtx.currentTime;
    // C5 -> E5 -> G5 -> C6 の明るいアルペジオ
    const chordNotes = [523.25, 659.25, 783.99, 1046.50];

    chordNotes.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + index * 0.08);

        gain.gain.setValueAtTime(0, now + index * 0.08);
        gain.gain.linearRampToValueAtTime(0.06, now + index * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.4);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + index * 0.08);
        osc.stop(now + index * 0.08 + 0.4);
    });
}

/**
 * 間違い / ダメージ（SE）
 */
function playFailSFX() {
    if (isMuted || !audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = 'sawtooth'; // 鋸歯状波のざらざらした音
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    // 音高を下降させて不協和音にする
    osc.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.5);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

/**
 * キャンバスのセットアップ
 */
function setupCanvas() {
    if (!canvas) return;
    const size = 320;
    canvas.width = size;
    canvas.height = size;
    calculateDots();
}

/**
 * ドットの配置計算
 */
function calculateDots() {
    if (!canvas) return;
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
 * ライフ表示の更新（エラー防止用の安全ガードを実装）
 */
function updateLifeDisplay() {
    // 安全ガード：対象要素が存在しない場合は直ちに処理を終了する
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
    // 音響コンテキストの生成と再開
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    startBGM(); // BGMループの開始

    level = 1;
    score = 0;
    lives = MAX_LIVES;
    gridCount = 3;
    if (levelText) levelText.innerText = level;
    if (scoreText) scoreText.innerText = score;
    if (startBtn) startBtn.disabled = true;
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
        if (statusMsg) {
            statusMsg.innerText = "パターンを覚えてください";
            statusMsg.style.color = "#ffffff";
        }
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
        playDotSFX(i); // お手本中の点を結ぶタイミングにSEを鳴らす
        await new Promise(r => setTimeout(r, Math.max(200, 600 - level * 40)));
    }
    
    setTimeout(() => {
        userInput = [];
        gameState = 'INPUTTING'; // ここで入力を許可
        if (statusMsg) {
            statusMsg.innerText = "なぞってください！";
        }
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

/**
 * マウス/タッチ座標の正確な計算
 */
function updateMousePos(e) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    // スケール比率を考慮して座標を変換
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    currentMousePos.x = (e.clientX - rect.left) * scaleX;
    currentMousePos.y = (e.clientY - rect.top) * scaleY;
}

/**
 * 当たり判定と中間自動取得
 */
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
                            if (!userInput.includes(m)) {
                                userInput.push(m);
                                playDotSFX(userInput.length - 1); // 自動補完された際にも音を鳴らす
                            }
                        });
                    }
                }
                userInput.push(dot.index);
                lastDotIndex = dot.index;
                playDotSFX(userInput.length - 1); // ユーザーがなぞったタイミングでSEを鳴らす
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
        playSuccessSFX(); // 正解時のファンファーレ
        if (levelText) levelText.innerText = level;
        if (scoreText) scoreText.innerText = score;
        if (statusMsg) {
            statusMsg.innerText = "正解！";
            statusMsg.style.color = "#ffffff";
        }
        setTimeout(() => startRound(true), 1000);
    } else {
        lives--;
        updateLifeDisplay();
        playFailSFX(); // ミス時のSE
        
        if (lives > 0) {
            if (statusMsg) {
                statusMsg.innerText = `ミス！ 残り ${lives} 回`;
                statusMsg.style.color = "#ffcc00";
            }
            setTimeout(() => startRound(false), 1500);
        } else {
            gameOver("ゲームオーバー！");
        }
    }
}

/**
 * ゲームオーバー処理
 */
function gameOver(msg) {
    gameState = 'GAMEOVER';
    if (statusMsg) {
        statusMsg.innerText = msg;
        statusMsg.style.color = "#ff4444";
    }
    if (startBtn) {
        startBtn.disabled = false;
        startBtn.innerText = "リトライ";
    }
}

/**
 * 描画ループ
 */
function render() {
    if (!ctx || !canvas) return;
    
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

// 安全な読み込みタイミングの確保（イベントリスナー経由で初期化関数を起動）
window.addEventListener('DOMContentLoaded', init);
