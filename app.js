// ==================== 状态管理 ====================
const state = {
    selectedDiceCount: 0,
    currentScreen: 'initial', // 'initial', 'shake', 'result'
    isShaking: false,
    isWaitingForStillness: false,
    lastMovementTime: 0,
    diceResults: [],
    audioContext: null,
    shakeOscillator: null,
    shakeGain: null
};

// ==================== DOM 元素 ====================
const elements = {
    initialScreen: document.getElementById('initial-screen'),
    shakeScreen: document.getElementById('shake-screen'),
    notSupported: document.getElementById('not-supported'),
    diceButtons: document.querySelectorAll('.dice-btn'),
    startBtn: document.getElementById('start-btn'),
    diceArea: document.getElementById('dice-area'),
    resultArea: document.getElementById('result-area'),
    diceResults: document.getElementById('dice-results'),
    totalResult: document.getElementById('total-result'),
    shakeHint: document.getElementById('shake-hint'),
    restartBtn: document.getElementById('restart-btn')
};

// ==================== 初始化 ====================
function init() {
    // 检查是否支持传感器
    if (!checkDeviceSupport()) {
        showScreen('not-supported');
        return;
    }

    // 绑定事件
    bindEvents();

    // 初始化音频上下文（延迟到用户交互后）
}

// 检查设备支持
function checkDeviceSupport() {
    // 检查是否为移动设备
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // 检查是否支持 DeviceMotion
    const hasDeviceMotion = 'DeviceMotionEvent' in window;

    // 对于iOS 13+，需要检查是否可以请求权限
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (!isMobile || !hasDeviceMotion) {
        return false;
    }

    return true;
}

// 绑定事件
function bindEvents() {
    // 骰子选择按钮
    elements.diceButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // 移除其他选中状态
            elements.diceButtons.forEach(b => b.classList.remove('selected'));
            // 添加选中状态
            btn.classList.add('selected');
            // 更新状态
            state.selectedDiceCount = parseInt(btn.dataset.count);
            // 启用开始按钮
            elements.startBtn.disabled = false;
        });
    });

    // 开始按钮
    elements.startBtn.addEventListener('click', () => {
        if (state.selectedDiceCount > 0) {
            startGame();
        }
    });

    // 重新开始按钮
    elements.restartBtn.addEventListener('click', () => {
        resetGame();
    });
}

// ==================== 界面切换 ====================
function showScreen(screenName) {
    elements.initialScreen.classList.add('hidden');
    elements.shakeScreen.classList.add('hidden');
    elements.notSupported.classList.add('hidden');

    switch (screenName) {
        case 'initial':
            elements.initialScreen.classList.remove('hidden');
            break;
        case 'shake':
            elements.shakeScreen.classList.remove('hidden');
            break;
        case 'not-supported':
            elements.notSupported.classList.remove('hidden');
            break;
    }

    state.currentScreen = screenName;
}

// ==================== 游戏逻辑 ====================
// 开始游戏
async function startGame() {
    // 初始化音频
    await initAudio();

    // 请求传感器权限（iOS 13+）
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
        try {
            const permission = await DeviceMotionEvent.requestPermission();
            if (permission !== 'granted') {
                alert('需要传感器权限才能使用此应用');
                return;
            }
        } catch (error) {
            console.error('请求传感器权限失败:', error);
            alert('请求传感器权限失败');
            return;
        }
    }

    // 切换到摇骰子界面
    showScreen('shake');

    // 生成骰子
    generateDice();

    // 开始监听传感器
    startMotionDetection();
}

// 生成骰子
function generateDice() {
    elements.diceArea.innerHTML = '';
    state.diceResults = [];

    for (let i = 0; i < state.selectedDiceCount; i++) {
        const dice = document.createElement('div');
        dice.className = 'dice';
        dice.dataset.value = '0';

        // 创建点数容器
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'dots-container';

        // 创建9个点位（3x3网格）
        for (let j = 0; j < 9; j++) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            dotsContainer.appendChild(dot);
        }

        dice.appendChild(dotsContainer);
        elements.diceArea.appendChild(dice);

        // 随机初始位置偏移
        const offsetX = (Math.random() - 0.5) * 30;
        const offsetY = (Math.random() - 0.5) * 30;
        dice.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }
}

// ==================== 传感器检测 ====================
function startMotionDetection() {
    window.addEventListener('devicemotion', handleMotion);
    state.isShaking = false;
    state.isWaitingForStillness = false;
    state.lastMovementTime = 0;
}

function stopMotionDetection() {
    window.removeEventListener('devicemotion', handleMotion);
}

function handleMotion(event) {
    // 如果已经在显示结果，不再响应
    if (state.currentScreen !== 'shake') return;

    const acceleration = event.accelerationIncludingGravity;
    if (!acceleration) return;

    // 计算加速度大小
    const magnitude = Math.sqrt(
        acceleration.x * acceleration.x +
        acceleration.y * acceleration.y +
        acceleration.z * acceleration.z
    );

    const SHAKE_THRESHOLD = 15; // 开始晃动阈值
    const STILLNESS_THRESHOLD = 5; // 静止阈值
    const STILLNESS_DURATION = 500; // 静止持续时间（毫秒）

    if (!state.isShaking) {
        // 检测开始晃动
        if (magnitude > SHAKE_THRESHOLD) {
            onShakeStart();
        }
    } else {
        // 检测晃动中的移动
        if (magnitude > STILLNESS_THRESHOLD) {
            state.lastMovementTime = Date.now();
            state.isWaitingForStillness = true;
        } else if (state.isWaitingForStillness) {
            // 检测静止
            if (Date.now() - state.lastMovementTime > STILLNESS_DURATION) {
                onShakeEnd();
            }
        }
    }
}

// 开始晃动
function onShakeStart() {
    state.isShaking = true;
    state.isWaitingForStillness = false;
    state.lastMovementTime = Date.now();

    // 隐藏提示
    elements.shakeHint.classList.add('hidden');

    // 添加晃动动画
    const diceElements = elements.diceArea.querySelectorAll('.dice');
    diceElements.forEach(dice => {
        dice.classList.add('shaking');
        // 随机化动画参数
        dice.style.animationDuration = `${0.1 + Math.random() * 0.1}s`;
    });

    // 播放晃动音效
    playShakeSound();
}

// 结束晃动
function onShakeEnd() {
    state.isShaking = false;
    state.isWaitingForStillness = false;

    // 移除晃动动画
    const diceElements = elements.diceArea.querySelectorAll('.dice');
    diceElements.forEach(dice => {
        dice.classList.remove('shaking');
    });

    // 停止晃动音效
    stopShakeSound();

    // 生成结果
    generateResults();

    // 播放落地音效
    playLandSound();

    // 显示结果
    showResults();
}

// ==================== 结果生成 ====================
function generateResults() {
    state.diceResults = [];
    for (let i = 0; i < state.selectedDiceCount; i++) {
        // 0, 1, 2 各 1/3 概率
        const value = Math.floor(Math.random() * 3);
        state.diceResults.push(value);
    }
}

function showResults() {
    // 停止传感器监听
    stopMotionDetection();

    // 更新骰子显示
    const diceElements = elements.diceArea.querySelectorAll('.dice');
    diceElements.forEach((dice, index) => {
        dice.dataset.value = state.diceResults[index];
        dice.style.transform = 'translate(0, 0)';
    });

    // 显示结果区域
    elements.diceResults.innerHTML = '';
    state.diceResults.forEach((value, index) => {
        const resultItem = document.createElement('span');
        resultItem.className = 'dice-result-item';
        resultItem.textContent = `骰子${index + 1}: ${value}`;
        elements.diceResults.appendChild(resultItem);
    });

    // 计算总和
    const total = state.diceResults.reduce((sum, val) => sum + val, 0);
    elements.totalResult.textContent = `总和: ${total}`;

    // 显示结果区域和重新开始按钮
    elements.resultArea.classList.remove('hidden');
    elements.restartBtn.classList.remove('hidden');
}

// 重置游戏
function resetGame() {
    // 重置状态
    state.selectedDiceCount = 0;
    state.isShaking = false;
    state.isWaitingForStillness = false;
    state.diceResults = [];

    // 重置UI
    elements.diceButtons.forEach(btn => btn.classList.remove('selected'));
    elements.startBtn.disabled = true;
    elements.diceArea.innerHTML = '';
    elements.resultArea.classList.add('hidden');
    elements.restartBtn.classList.add('hidden');
    elements.shakeHint.classList.remove('hidden');

    // 返回初始界面
    showScreen('initial');
}

// ==================== 音效生成 ====================
async function initAudio() {
    if (state.audioContext) return;

    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.error('无法初始化音频:', e);
    }
}

// 播放晃动音效
function playShakeSound() {
    if (!state.audioContext) return;

    // 创建噪声缓冲区
    const bufferSize = state.audioContext.sampleRate * 2;
    const buffer = state.audioContext.createBuffer(1, bufferSize, state.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    // 创建噪声源
    const noiseSource = state.audioContext.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    // 创建带通滤波器
    const bandpass = state.audioContext.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 2000;
    bandpass.Q.value = 0.5;

    // 创建增益节点
    const gainNode = state.audioContext.createGain();
    gainNode.gain.value = 0.3;

    // 连接节点
    noiseSource.connect(bandpass);
    bandpass.connect(gainNode);
    gainNode.connect(state.audioContext.destination);

    // 开始播放
    noiseSource.start();

    // 保存引用以便停止
    state.shakeOscillator = noiseSource;
    state.shakeGain = gainNode;
}

// 停止晃动音效
function stopShakeSound() {
    if (state.shakeOscillator) {
        try {
            state.shakeOscillator.stop();
        } catch (e) {
            // 忽略已停止的错误
        }
        state.shakeOscillator = null;
    }
}

// 播放落地音效
function playLandSound() {
    if (!state.audioContext) return;

    // 创建振荡器
    const oscillator = state.audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(150, state.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, state.audioContext.currentTime + 0.2);

    // 创建增益节点
    const gainNode = state.audioContext.createGain();
    gainNode.gain.setValueAtTime(0.5, state.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, state.audioContext.currentTime + 0.3);

    // 连接节点
    oscillator.connect(gainNode);
    gainNode.connect(state.audioContext.destination);

    // 播放
    oscillator.start();
    oscillator.stop(state.audioContext.currentTime + 0.3);
}

// ==================== 启动应用 ====================
document.addEventListener('DOMContentLoaded', init);