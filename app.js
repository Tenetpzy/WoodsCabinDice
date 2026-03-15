// ==================== 配置常量 ====================
const CONFIG = {
    // 摇晃检测阈值
    SHAKE_START_THRESHOLD: 18,      // 开始摇晃的加速度阈值 (m/s²)
    SHAKE_END_THRESHOLD: 4,         // 停止摇晃的加速度阈值
    SETTLING_DURATION: 400,         // 静止持续时间 (ms)

    // 物理参数
    FRICTION: 0.96,                 // 摩擦系数
    RESTITUTION: 0.7,               // 弹性系数
    DICE_MARGIN: 8,                 // 骰子边距
    MAX_VELOCITY: 20,               // 最大速度限制（像素/帧）
    RANDOM_IMPULSE_INTERVAL: 100,   // 随机冲量间隔 (ms)
    RANDOM_IMPULSE_STRENGTH: 6,     // 随机冲量强度

    // 振动参数
    VIBRATION_BASE_DURATION: 100,   // 基础振动时长 (ms)
    VIBRATION_PER_DICE: 30          // 每个骰子增加的振动时长 (ms)
};

// 游戏状态枚举
const GameState = {
    IDLE: 'idle',           // 初始界面
    READY: 'ready',         // 骰子已生成，等待摇晃
    SHAKING: 'shaking',     // 正在摇晃
    RESULT: 'result'        // 显示结果
};

// ==================== 状态管理 ====================
const state = {
    gameState: GameState.IDLE,
    diceCount: 0,
    diceElements: [],               // 骰子DOM元素数组
    dicePhysics: [],                // 骰子物理状态
    diceResults: [],
    isDemoMode: false,

    // 音频状态
    rollingAudio: null,             // 摇晃音效Audio元素
    vibrationInterval: null,        // 振动定时器

    // 传感器状态
    gravityEstimate: { x: 0, y: 0, z: 0 },
    stillnessStartTime: 0,

    // 动画状态
    animationFrame: null,
    lastRandomImpulseTime: 0
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
    totalResult: document.getElementById('total-result'),
    shakeHint: document.getElementById('shake-hint'),
    restartBtn: document.getElementById('restart-btn'),
    errorIcon: document.getElementById('error-icon'),
    errorTitle: document.getElementById('error-title'),
    errorMessage: document.getElementById('error-message'),
    errorSuggestions: document.getElementById('error-suggestions'),
    demoBtn: document.getElementById('demo-btn'),
    demoHint: document.getElementById('demo-hint')
};

// ==================== 初始化 ====================
function init() {
    const supportResult = checkDeviceSupport();
    if (!supportResult.supported) {
        showNotSupportedScreen(supportResult);
        return;
    }
    bindEvents();
}

function checkDeviceSupport() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const hasDeviceMotion = 'DeviceMotionEvent' in window;
    return {
        supported: isMobile && hasDeviceMotion,
        isMobile: isMobile,
        hasDeviceMotion: hasDeviceMotion
    };
}

function showNotSupportedScreen(supportResult) {
    const { isMobile, hasDeviceMotion } = supportResult;

    if (!isMobile && !hasDeviceMotion) {
        elements.errorIcon.textContent = '💻';
        elements.errorTitle.textContent = '请在手机上使用';
        elements.errorMessage.textContent = '这是一个需要手机传感器的摇骰子应用，您当前使用的是桌面设备。';
        elements.errorSuggestions.innerHTML = `
            <div class="suggestion-item">
                <span class="suggestion-icon">📱</span>
                <span>用手机扫描二维码访问此页面</span>
            </div>
            <div class="suggestion-item">
                <span class="suggestion-icon">🔍</span>
                <span>在手机浏览器中输入当前网址</span>
            </div>
            <div class="suggestion-item">
                <span class="suggestion-icon">🎮</span>
                <span>或者点击下方按钮试用演示模式</span>
            </div>
        `;
    } else if (!isMobile) {
        elements.errorIcon.textContent = '🖥️';
        elements.errorTitle.textContent = '建议使用手机';
        elements.errorMessage.textContent = '您似乎在使用非手机设备，摇骰子功能需要手机的加速度传感器。';
        elements.errorSuggestions.innerHTML = `
            <div class="suggestion-item">
                <span class="suggestion-icon">📱</span>
                <span>用手机访问此页面获得最佳体验</span>
            </div>
            <div class="suggestion-item">
                <span class="suggestion-icon">🎮</span>
                <span>或试用演示模式体验功能</span>
            </div>
        `;
    } else if (!hasDeviceMotion) {
        elements.errorIcon.textContent = '⚠️';
        elements.errorTitle.textContent = '传感器不可用';
        elements.errorMessage.textContent = '您的设备或浏览器不支持运动传感器功能。';
        elements.errorSuggestions.innerHTML = `
            <div class="suggestion-item">
                <span class="suggestion-icon">🔄</span>
                <span>请尝试使用其他浏览器（如 Chrome、Safari）</span>
            </div>
            <div class="suggestion-item">
                <span class="suggestion-icon">⚙️</span>
                <span>检查浏览器设置是否禁用了传感器权限</span>
            </div>
        `;
    }

    elements.demoBtn.classList.remove('hidden');
    elements.demoHint.classList.remove('hidden');
    showScreen('not-supported');
}

// ==================== 事件绑定 ====================
function bindEvents() {
    // 骰子选择按钮
    elements.diceButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.diceButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.diceCount = parseInt(btn.dataset.count);
            elements.startBtn.disabled = false;
        });
    });

    // 开始按钮
    elements.startBtn.addEventListener('click', () => {
        if (state.diceCount > 0) {
            if (state.isDemoMode) {
                startGameDemo();
            } else {
                startGame();
            }
        }
    });

    // 重新开始按钮
    elements.restartBtn.addEventListener('click', resetGame);

    // 演示模式按钮
    elements.demoBtn.addEventListener('click', startDemoMode);
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
}

// ==================== 游戏流程 ====================
async function startGame() {
    // iOS 13+ 权限请求
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

    showScreen('shake');
    initShakeMode();
    state.gameState = GameState.READY;
    startMotionDetection();
}

function startDemoMode() {
    state.isDemoMode = true;
    showScreen('initial');
    bindEvents();
}

async function startGameDemo() {
    showScreen('shake');
    initShakeMode();
    state.gameState = GameState.READY;
    elements.shakeHint.textContent = '点击屏幕模拟摇骰子';
    elements.diceArea.addEventListener('click', handleDemoShake);
}

function handleDemoShake() {
    if (state.gameState !== GameState.READY) return;

    onShakeStart();

    // 1.5秒后自动结束
    setTimeout(() => {
        if (state.gameState === GameState.SHAKING) {
            onShakeEnd();
        }
    }, 1500);
}

// ==================== 摇骰子模式 - 开始界面 ====================
function initShakeMode() {
    // 清理之前的状态
    elements.diceArea.innerHTML = '';
    state.diceElements = [];
    state.dicePhysics = [];
    state.diceResults = [];

    // 显示提示，隐藏结果区域
    elements.shakeHint.textContent = '晃动手机摇骰子';
    elements.shakeHint.classList.remove('hidden');
    elements.resultArea.classList.add('hidden');
    elements.restartBtn.classList.add('hidden');

    // 移除状态类
    elements.shakeScreen.classList.remove('shaking');
    elements.shakeScreen.classList.remove('showing-result');

    // 创建骰子 - 整齐放置
    createDiceNeatly();
}

function createDiceNeatly() {
    const diceSize = getDiceSize();
    const areaWidth = elements.diceArea.clientWidth || 300;
    const areaHeight = elements.diceArea.clientHeight || 300;

    // 计算网格布局
    const cols = Math.ceil(Math.sqrt(state.diceCount));
    const rows = Math.ceil(state.diceCount / cols);

    const gridWidth = cols * diceSize + (cols - 1) * CONFIG.DICE_MARGIN;
    const gridHeight = rows * diceSize + (rows - 1) * CONFIG.DICE_MARGIN;

    // 居中偏移
    const startX = (areaWidth - gridWidth) / 2;
    const startY = (areaHeight - gridHeight) / 2;

    for (let i = 0; i < state.diceCount; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;

        const x = startX + col * (diceSize + CONFIG.DICE_MARGIN);
        const y = startY + row * (diceSize + CONFIG.DICE_MARGIN);

        // 随机初始值 (0, 1, 2)
        const initialValue = Math.floor(Math.random() * 3);

        const dice = createDiceElement(initialValue);
        dice.style.transform = `translate(${x}px, ${y}px)`;
        elements.diceArea.appendChild(dice);

        state.diceElements.push(dice);
        state.dicePhysics.push({
            x: x,
            y: y,
            vx: 0,
            vy: 0,
            rotation: 0,
            rotationSpeed: 0,
            size: diceSize,
            initialX: x,
            initialY: y
        });
    }
}

function createDiceElement(value) {
    const dice = document.createElement('div');
    dice.className = 'dice';
    dice.dataset.value = value.toString();

    // 创建点数容器 (3x3网格)
    const dotsContainer = document.createElement('div');
    dotsContainer.className = 'dots-container';
    for (let j = 0; j < 9; j++) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        dotsContainer.appendChild(dot);
    }
    dice.appendChild(dotsContainer);

    return dice;
}

function getDiceSize() {
    // 获取CSS定义的骰子尺寸
    const tempDice = document.createElement('div');
    tempDice.className = 'dice';
    tempDice.style.visibility = 'hidden';
    elements.diceArea.appendChild(tempDice);
    const size = tempDice.offsetWidth || 70;
    elements.diceArea.removeChild(tempDice);
    return size;
}

// ==================== 传感器检测模块 ====================
function startMotionDetection() {
    window.addEventListener('devicemotion', handleMotion);
    state.gravityEstimate = { x: 0, y: 0, z: 0 };
    state.stillnessStartTime = 0;
}

function stopMotionDetection() {
    window.removeEventListener('devicemotion', handleMotion);
}

function handleMotion(event) {
    if (state.gameState !== GameState.READY && state.gameState !== GameState.SHAKING) return;

    const acc = getFilteredAcceleration(event);
    const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);

    switch (state.gameState) {
        case GameState.READY:
            if (magnitude > CONFIG.SHAKE_START_THRESHOLD) {
                onShakeStart();
            }
            break;

        case GameState.SHAKING:
            if (magnitude < CONFIG.SHAKE_END_THRESHOLD) {
                if (state.stillnessStartTime === 0) {
                    state.stillnessStartTime = Date.now();
                } else if (Date.now() - state.stillnessStartTime > CONFIG.SETTLING_DURATION) {
                    onShakeEnd();
                }
            } else {
                state.stillnessStartTime = 0;
            }
            break;
    }
}

function getFilteredAcceleration(event) {
    const acc = event.acceleration || event.accelerationIncludingGravity;
    if (!acc) return { x: 0, y: 0, z: 0 };

    if (event.acceleration) {
        return { x: acc.x || 0, y: acc.y || 0, z: acc.z || 0 };
    }

    const g = state.gravityEstimate;
    const alpha = 0.8;
    g.x = alpha * g.x + (1 - alpha) * (acc.x || 0);
    g.y = alpha * g.y + (1 - alpha) * (acc.y || 0);
    g.z = alpha * g.z + (1 - alpha) * (acc.z || 0);

    return {
        x: (acc.x || 0) - g.x,
        y: (acc.y || 0) - g.y,
        z: (acc.z || 0) - g.z
    };
}

// ==================== 摇骰子模式 - 摇动过程 ====================
function onShakeStart() {
    state.gameState = GameState.SHAKING;
    state.stillnessStartTime = 0;
    state.lastRandomImpulseTime = 0;

    // 添加shaking状态类 - 隐藏提示
    elements.shakeScreen.classList.add('shaking');
    elements.shakeScreen.classList.remove('showing-result');

    // 给骰子随机初始速度
    state.dicePhysics.forEach(dice => {
        dice.vx = (Math.random() - 0.5) * 20;
        dice.vy = (Math.random() - 0.5) * 20;
        dice.rotationSpeed = (Math.random() - 0.5) * 30;
    });

    // 启动振动和摇晃音效
    startShakeFeedback();

    startPhysicsAnimation();
}

function onShakeEnd() {
    state.gameState = GameState.RESULT;

    stopMotionDetection();
    stopPhysicsAnimation();

    // 停止振动和摇晃音效
    stopShakeFeedback();

    // 播放落地音效
    playDropDiceSound();

    generateResults();
    showResults();
}

// ==================== 物理动画模块 ====================
function startPhysicsAnimation() {
    if (state.animationFrame) return;
    animate();
}

function stopPhysicsAnimation() {
    if (state.animationFrame) {
        cancelAnimationFrame(state.animationFrame);
        state.animationFrame = null;
    }
}

function animate() {
    updatePhysics();
    state.animationFrame = requestAnimationFrame(animate);
}

function updatePhysics() {
    const areaWidth = elements.diceArea.clientWidth || 300;
    const areaHeight = elements.diceArea.clientHeight || 300;
    const now = Date.now();

    // 定期给骰子施加随机冲量
    if (now - state.lastRandomImpulseTime > CONFIG.RANDOM_IMPULSE_INTERVAL) {
        state.lastRandomImpulseTime = now;
        state.dicePhysics.forEach(dice => {
            const angle = Math.random() * Math.PI * 2;
            const strength = CONFIG.RANDOM_IMPULSE_STRENGTH * (0.5 + Math.random());
            dice.vx += Math.cos(angle) * strength;
            dice.vy += Math.sin(angle) * strength;
            dice.rotationSpeed += (Math.random() - 0.5) * 15;
        });
    }

    let collisionCount = 0;

    state.dicePhysics.forEach(dice => {
        // 更新位置
        dice.x += dice.vx;
        dice.y += dice.vy;
        dice.rotation += dice.rotationSpeed;

        // 应用摩擦力
        dice.vx *= CONFIG.FRICTION;
        dice.vy *= CONFIG.FRICTION;
        dice.rotationSpeed *= CONFIG.FRICTION;

        // 限制最大速度
        const speed = Math.sqrt(dice.vx * dice.vx + dice.vy * dice.vy);
        if (speed > CONFIG.MAX_VELOCITY) {
            const ratio = CONFIG.MAX_VELOCITY / speed;
            dice.vx *= ratio;
            dice.vy *= ratio;
        }

        // 边界碰撞
        const maxX = areaWidth - dice.size - CONFIG.DICE_MARGIN;
        const maxY = areaHeight - dice.size - CONFIG.DICE_MARGIN;

        if (dice.x < CONFIG.DICE_MARGIN) {
            dice.x = CONFIG.DICE_MARGIN;
            dice.vx = Math.abs(dice.vx) * CONFIG.RESTITUTION;
            dice.rotationSpeed += (Math.random() - 0.5) * 10;
            collisionCount++;
        }
        if (dice.x > maxX) {
            dice.x = maxX;
            dice.vx = -Math.abs(dice.vx) * CONFIG.RESTITUTION;
            dice.rotationSpeed += (Math.random() - 0.5) * 10;
            collisionCount++;
        }
        if (dice.y < CONFIG.DICE_MARGIN) {
            dice.y = CONFIG.DICE_MARGIN;
            dice.vy = Math.abs(dice.vy) * CONFIG.RESTITUTION;
            dice.rotationSpeed += (Math.random() - 0.5) * 10;
            collisionCount++;
        }
        if (dice.y > maxY) {
            dice.y = maxY;
            dice.vy = -Math.abs(dice.vy) * CONFIG.RESTITUTION;
            dice.rotationSpeed += (Math.random() - 0.5) * 10;
            collisionCount++;
        }
    });

    // 骰子之间的碰撞
    for (let i = 0; i < state.dicePhysics.length; i++) {
        for (let j = i + 1; j < state.dicePhysics.length; j++) {
            if (checkDiceCollision(state.dicePhysics[i], state.dicePhysics[j])) {
                collisionCount++;
            }
        }
    }

    // 更新DOM
    state.dicePhysics.forEach((dice, index) => {
        state.diceElements[index].style.transform =
            `translate(${dice.x}px, ${dice.y}px) rotate(${dice.rotation}deg)`;
    });
}

function checkDiceCollision(dice1, dice2) {
    const size = dice1.size;

    // AABB碰撞检测
    const overlapX = Math.min(dice1.x + size, dice2.x + size) - Math.max(dice1.x, dice2.x);
    const overlapY = Math.min(dice1.y + size, dice2.y + size) - Math.max(dice1.y, dice2.y);

    if (overlapX > 0 && overlapY > 0) {
        // 分离骰子
        if (overlapX < overlapY) {
            const sign = dice1.x < dice2.x ? -1 : 1;
            dice1.x += sign * overlapX / 2;
            dice2.x -= sign * overlapX / 2;

            const tempVx = dice1.vx;
            dice1.vx = dice2.vx * CONFIG.RESTITUTION;
            dice2.vx = tempVx * CONFIG.RESTITUTION;
        } else {
            const sign = dice1.y < dice2.y ? -1 : 1;
            dice1.y += sign * overlapY / 2;
            dice2.y -= sign * overlapY / 2;

            const tempVy = dice1.vy;
            dice1.vy = dice2.vy * CONFIG.RESTITUTION;
            dice2.vy = tempVy * CONFIG.RESTITUTION;
        }

        // 碰撞时改变旋转
        dice1.rotationSpeed += (Math.random() - 0.5) * 20;
        dice2.rotationSpeed += (Math.random() - 0.5) * 20;

        return true;
    }
    return false;
}

// ==================== 摇骰子模式 - 结束界面 ====================
function generateResults() {
    state.diceResults = [];
    for (let i = 0; i < state.diceCount; i++) {
        state.diceResults.push(Math.floor(Math.random() * 3));
    }
}

function showResults() {
    elements.shakeScreen.classList.remove('shaking');
    elements.shakeScreen.classList.add('showing-result');

    // 骰子规则排列
    arrangeDiceNeatly();

    // 计算总和并显示
    const total = state.diceResults.reduce((sum, val) => sum + val, 0);
    elements.totalResult.textContent = `${total}`;

    // 显示结果区域和重新开始按钮
    elements.resultArea.classList.remove('hidden');
    elements.restartBtn.classList.remove('hidden');
    elements.shakeHint.classList.add('hidden');
}

function arrangeDiceNeatly() {
    const diceSize = getDiceSize();
    const areaWidth = elements.diceArea.clientWidth || 300;
    const areaHeight = elements.diceArea.clientHeight || 300;

    // 计算网格布局
    const cols = Math.ceil(Math.sqrt(state.diceCount));
    const rows = Math.ceil(state.diceCount / cols);

    const gridWidth = cols * diceSize + (cols - 1) * CONFIG.DICE_MARGIN;
    const gridHeight = rows * diceSize + (rows - 1) * CONFIG.DICE_MARGIN;

    // 居中偏移
    const startX = (areaWidth - gridWidth) / 2;
    const startY = (areaHeight - gridHeight) / 2;

    state.diceElements.forEach((dice, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;

        const x = startX + col * (diceSize + CONFIG.DICE_MARGIN);
        const y = startY + row * (diceSize + CONFIG.DICE_MARGIN);

        // 更新骰子值
        dice.dataset.value = state.diceResults[index];

        // 重置位置和旋转
        dice.style.transform = `translate(${x}px, ${y}px) rotate(0deg)`;
    });
}

// ==================== 重置游戏 ====================
function resetGame() {
    stopPhysicsAnimation();
    stopShakeFeedback();

    if (state.isDemoMode) {
        elements.diceArea.removeEventListener('click', handleDemoShake);
    }

    state.gameState = GameState.IDLE;
    state.diceCount = 0;
    state.diceElements = [];
    state.dicePhysics = [];
    state.diceResults = [];
    state.stillnessStartTime = 0;

    elements.shakeScreen.classList.remove('showing-result');
    elements.shakeScreen.classList.remove('shaking');
    elements.diceButtons.forEach(btn => btn.classList.remove('selected'));
    elements.startBtn.disabled = true;
    elements.diceArea.innerHTML = '';
    elements.resultArea.classList.add('hidden');
    elements.restartBtn.classList.add('hidden');
    elements.shakeHint.classList.remove('hidden');
    elements.shakeHint.textContent = '晃动手机摇骰子';

    showScreen('initial');
}

// ==================== 振动模块 ====================
function startShakeVibration() {
    if (!navigator.vibrate) return;

    // 根据骰子个数计算振动强度
    const duration = CONFIG.VIBRATION_BASE_DURATION + state.diceCount * CONFIG.VIBRATION_PER_DICE;

    // 立即触发一次振动
    try {
        navigator.vibrate(duration);
    } catch (e) {
        console.debug('振动失败:', e.message);
    }

    // 持续振动（使用定时器循环触发）
    state.vibrationInterval = setInterval(() => {
        if (state.gameState === GameState.SHAKING) {
            try {
                navigator.vibrate(duration);
            } catch (e) {
                console.debug('振动失败:', e.message);
            }
        }
    }, duration + 50);
}

function stopShakeVibration() {
    if (state.vibrationInterval) {
        clearInterval(state.vibrationInterval);
        state.vibrationInterval = null;
    }

    if (navigator.vibrate) {
        try {
            navigator.vibrate(0);
        } catch (e) {
            // 忽略
        }
    }
}

// ==================== 音效模块 ====================
function initRollingAudio() {
    // 创建摇晃音效Audio元素
    state.rollingAudio = new Audio('rollingdice.mp3');
    state.rollingAudio.loop = true;
    state.rollingAudio.volume = 0.6;
}

function startRollingSound() {
    if (!state.rollingAudio) {
        initRollingAudio();
    }

    // 确保从头开始播放，不重叠
    if (state.rollingAudio.paused) {
        state.rollingAudio.currentTime = 0;
        state.rollingAudio.play().catch(e => {
            console.debug('播放摇晃音效失败:', e.message);
        });
    }
}

function stopRollingSound() {
    if (state.rollingAudio) {
        state.rollingAudio.pause();
        state.rollingAudio.currentTime = 0;
    }
}

function playDropDiceSound() {
    // 根据骰子个数，播放多次落地音效，模拟叠加效果
    const baseDelay = 80; // 每个骰子之间的基础延迟
    const randomDelayRange = 40; // 随机延迟范围

    for (let i = 0; i < state.diceCount; i++) {
        const delay = i * baseDelay + Math.random() * randomDelayRange;
        setTimeout(() => {
            playSingleDropSound();
        }, delay);
    }
}

function playSingleDropSound() {
    const audio = new Audio('dropdice.mp3');
    audio.volume = 0.5 + Math.random() * 0.2; // 稍微随机化音量
    audio.play().catch(e => {
        console.debug('播放落地音效失败:', e.message);
    });
}

// ==================== 综合反馈控制 ====================
function startShakeFeedback() {
    // 启动振动
    startShakeVibration();
    // 启动摇晃音效
    startRollingSound();
}

function stopShakeFeedback() {
    // 停止振动
    stopShakeVibration();
    // 停止摇晃音效
    stopRollingSound();
}

// ==================== 启动应用 ====================
document.addEventListener('DOMContentLoaded', init);