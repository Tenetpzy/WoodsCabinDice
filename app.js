// ==================== 配置常量 ====================
const CONFIG = {
    // 摇晃检测阈值
    SHAKE_START_THRESHOLD: 18,      // 开始摇晃的加速度阈值 (m/s²)
    SHAKE_END_THRESHOLD: 4,         // 停止摇晃的加速度阈值
    SETTLING_DURATION: 400,         // 静止持续时间 (ms)

    // 物理参数
    FRICTION: 0.92,                 // 摩擦系数
    RESTITUTION: 0.75,              // 弹性系数
    PADDING: 10,                    // 边界内边距
    MAX_VELOCITY: 25,               // 最大速度限制（像素/帧）
    RANDOM_IMPULSE_INTERVAL: 80,    // 随机冲量间隔 (ms)
    RANDOM_IMPULSE_STRENGTH: 8,     // 随机冲量强度

    // 音效参数
    COLLISION_COOLDOWN: 50,         // 碰撞音效冷却时间 (ms)

    // 震动参数
    COLLISION_VIBRATION_BASE: 15,   // 基础碰撞震动时长 (ms)
    COLLISION_VIBRATION_DECAY: 100, // 碰撞震动衰减时间 (ms)

    // 重力滤波
    GRAVITY_FILTER_ALPHA: 0.8
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
    dicePhysics: [],
    diceResults: [],
    audioContext: null,
    isDemoMode: false,

    // 传感器状态
    gravityEstimate: { x: 0, y: 0, z: 0 },
    stillnessStartTime: 0,

    // 动画状态
    animationFrame: null,
    lastCollisionTime: 0,
    lastRandomImpulseTime: 0,

    // 震动状态
    vibrationInterval: null,
    collisionCount: 0,              // 当前帧碰撞计数
    lastCollisionVibrationTime: 0   // 上次碰撞震动时间
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
    await initAudio();

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
    generateDice();
    state.gameState = GameState.READY;
    startMotionDetection();
}

function startDemoMode() {
    state.isDemoMode = true;
    initAudio();
    showScreen('initial');
    bindEvents();
}

async function startGameDemo() {
    await initAudio();
    showScreen('shake');
    generateDice();
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

// ==================== 骰子生成 ====================
function generateDice() {
    elements.diceArea.innerHTML = '';
    state.dicePhysics = [];
    state.diceResults = [];

    // 先创建骰子DOM元素以获取实际尺寸
    const tempDice = document.createElement('div');
    tempDice.className = 'dice';
    tempDice.style.visibility = 'hidden';
    elements.diceArea.appendChild(tempDice);

    // 获取实际渲染尺寸
    const diceSize = tempDice.offsetWidth || 70;

    elements.diceArea.innerHTML = '';

    const areaWidth = elements.diceArea.clientWidth || 300;
    const areaHeight = elements.diceArea.clientHeight || 300;
    const maxX = areaWidth - diceSize - CONFIG.PADDING;
    const maxY = areaHeight - diceSize - CONFIG.PADDING;

    for (let i = 0; i < state.diceCount; i++) {
        const dice = document.createElement('div');
        dice.className = 'dice';
        // 初始随机显示 0, 1, 2
        dice.dataset.value = Math.floor(Math.random() * 3).toString();
        dice.id = `dice-${i}`;

        // 创建点数容器 (3x3网格)
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'dots-container';
        for (let j = 0; j < 9; j++) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            dotsContainer.appendChild(dot);
        }
        dice.appendChild(dotsContainer);
        elements.diceArea.appendChild(dice);

        // 初始化物理状态
        state.dicePhysics.push({
            id: i,
            element: dice,
            x: CONFIG.PADDING + Math.random() * Math.max(0, maxX - CONFIG.PADDING),
            y: CONFIG.PADDING + Math.random() * Math.max(0, maxY - CONFIG.PADDING),
            vx: 0,
            vy: 0,
            rotation: Math.random() * 360,
            rotationSpeed: 0,
            size: diceSize
        });
    }

    // 初始渲染位置
    state.dicePhysics.forEach(dice => {
        dice.element.style.transform = `translate(${dice.x}px, ${dice.y}px) rotate(${dice.rotation}deg)`;
    });
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
            // 检测静止 - 不再应用传感器加速度到物理系统
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

    // 如果设备提供的是不含重力的加速度，直接使用
    if (event.acceleration) {
        return { x: acc.x || 0, y: acc.y || 0, z: acc.z || 0 };
    }

    // 否则使用高通滤波器去除重力
    const g = state.gravityEstimate;
    g.x = CONFIG.GRAVITY_FILTER_ALPHA * g.x + (1 - CONFIG.GRAVITY_FILTER_ALPHA) * (acc.x || 0);
    g.y = CONFIG.GRAVITY_FILTER_ALPHA * g.y + (1 - CONFIG.GRAVITY_FILTER_ALPHA) * (acc.y || 0);
    g.z = CONFIG.GRAVITY_FILTER_ALPHA * g.z + (1 - CONFIG.GRAVITY_FILTER_ALPHA) * (acc.z || 0);

    return {
        x: (acc.x || 0) - g.x,
        y: (acc.y || 0) - g.y,
        z: (acc.z || 0) - g.z
    };
}

// ==================== 摇晃处理 ====================
function onShakeStart() {
    state.gameState = GameState.SHAKING;
    state.stillnessStartTime = 0;
    state.lastRandomImpulseTime = 0;

    // 添加shaking状态类
    elements.shakeScreen.classList.add('shaking');
    elements.shakeScreen.classList.remove('showing-result');

    // 给骰子随机初始速度
    state.dicePhysics.forEach(dice => {
        dice.vx = (Math.random() - 0.5) * 15;
        dice.vy = (Math.random() - 0.5) * 15;
        dice.rotationSpeed = (Math.random() - 0.5) * 30;
    });

    startPhysicsAnimation();
    startVibration();
}

function onShakeEnd() {
    state.gameState = GameState.RESULT;

    stopMotionDetection();
    stopPhysicsAnimation();
    stopVibration();

    generateResults();
    playLandingSounds();
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

    // 重置碰撞计数
    state.collisionCount = 0;

    const now = Date.now();

    // 定期给骰子施加随机冲量，实现随机运动
    if (now - state.lastRandomImpulseTime > CONFIG.RANDOM_IMPULSE_INTERVAL) {
        state.lastRandomImpulseTime = now;
        state.dicePhysics.forEach(dice => {
            // 随机方向冲量
            const angle = Math.random() * Math.PI * 2;
            const strength = CONFIG.RANDOM_IMPULSE_STRENGTH * (0.5 + Math.random());
            dice.vx += Math.cos(angle) * strength;
            dice.vy += Math.sin(angle) * strength;
            dice.rotationSpeed += (Math.random() - 0.5) * 15;
        });
    }

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

        // 边界碰撞 - 使用骰子实际尺寸
        const maxX = areaWidth - dice.size - CONFIG.PADDING;
        const maxY = areaHeight - dice.size - CONFIG.PADDING;

        if (dice.x < CONFIG.PADDING) {
            dice.x = CONFIG.PADDING;
            dice.vx = Math.abs(dice.vx) * CONFIG.RESTITUTION;
            dice.rotationSpeed += (Math.random() - 0.5) * 10;
            playCollisionSoundThrottled(0.3);
            state.collisionCount++;
        }
        if (dice.x > maxX) {
            dice.x = maxX;
            dice.vx = -Math.abs(dice.vx) * CONFIG.RESTITUTION;
            dice.rotationSpeed += (Math.random() - 0.5) * 10;
            playCollisionSoundThrottled(0.3);
            state.collisionCount++;
        }
        if (dice.y < CONFIG.PADDING) {
            dice.y = CONFIG.PADDING;
            dice.vy = Math.abs(dice.vy) * CONFIG.RESTITUTION;
            dice.rotationSpeed += (Math.random() - 0.5) * 10;
            playCollisionSoundThrottled(0.3);
            state.collisionCount++;
        }
        if (dice.y > maxY) {
            dice.y = maxY;
            dice.vy = -Math.abs(dice.vy) * CONFIG.RESTITUTION;
            dice.rotationSpeed += (Math.random() - 0.5) * 10;
            playCollisionSoundThrottled(0.3);
            state.collisionCount++;
        }
    });

    // 骰子之间的碰撞
    for (let i = 0; i < state.dicePhysics.length; i++) {
        for (let j = i + 1; j < state.dicePhysics.length; j++) {
            checkDiceCollision(state.dicePhysics[i], state.dicePhysics[j]);
        }
    }

    // 处理碰撞震动 - 多个骰子一起碰撞时增加震动强度
    if (state.collisionCount > 0) {
        triggerCollisionVibration(state.collisionCount);
    }

    // 更新DOM - 确保所有骰子在边界内
    state.dicePhysics.forEach(dice => {
        const maxX = areaWidth - dice.size - CONFIG.PADDING;
        const maxY = areaHeight - dice.size - CONFIG.PADDING;
        dice.x = Math.max(CONFIG.PADDING, Math.min(dice.x, maxX));
        dice.y = Math.max(CONFIG.PADDING, Math.min(dice.y, maxY));

        dice.element.style.transform = `translate(${dice.x}px, ${dice.y}px) rotate(${dice.rotation}deg)`;
    });
}

function checkDiceCollision(dice1, dice2) {
    // 使用实际骰子尺寸进行碰撞检测
    const size1 = dice1.size;
    const size2 = dice2.size;

    // AABB碰撞检测
    const overlapX = Math.min(dice1.x + size1, dice2.x + size2) -
                     Math.max(dice1.x, dice2.x);
    const overlapY = Math.min(dice1.y + size1, dice2.y + size2) -
                     Math.max(dice1.y, dice2.y);

    if (overlapX > 0 && overlapY > 0) {
        // 计算相对速度
        const relVel = Math.sqrt(
            Math.pow(dice1.vx - dice2.vx, 2) +
            Math.pow(dice1.vy - dice2.vy, 2)
        );

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

        // 播放碰撞音效
        playCollisionSoundThrottled(Math.min(0.7, relVel / 12));

        // 增加碰撞计数
        state.collisionCount++;
    }
}

// ==================== 结果生成与展示 ====================
function generateResults() {
    state.diceResults = [];
    for (let i = 0; i < state.diceCount; i++) {
        // 0, 1, 2 各 1/3 概率
        state.diceResults.push(Math.floor(Math.random() * 3));
    }
}

function showResults() {
    // 移除shaking状态，添加结果显示状态类
    elements.shakeScreen.classList.remove('shaking');
    elements.shakeScreen.classList.add('showing-result');

    // 更新骰子显示值
    state.dicePhysics.forEach((dice, index) => {
        dice.element.dataset.value = state.diceResults[index];
        // 重置旋转，显示正面
        dice.element.style.transform = `translate(${dice.x}px, ${dice.y}px) rotate(0deg)`;
    });

    // 计算总和并显示
    const total = state.diceResults.reduce((sum, val) => sum + val, 0);
    elements.totalResult.textContent = `${total}`;

    elements.resultArea.classList.remove('hidden');
    elements.restartBtn.classList.remove('hidden');
    elements.shakeHint.classList.add('hidden');
}

// ==================== 重置游戏 ====================
function resetGame() {
    stopPhysicsAnimation();
    stopVibration();

    if (state.isDemoMode) {
        elements.diceArea.removeEventListener('click', handleDemoShake);
    }

    state.gameState = GameState.IDLE;
    state.diceCount = 0;
    state.dicePhysics = [];
    state.diceResults = [];
    state.stillnessStartTime = 0;
    state.collisionCount = 0;

    elements.shakeScreen.classList.remove('showing-result');
    elements.shakeScreen.classList.remove('shaking');
    elements.diceButtons.forEach(btn => btn.classList.remove('selected'));
    elements.startBtn.disabled = true;
    elements.diceArea.innerHTML = '';
    elements.resultArea.classList.add('hidden');
    elements.restartBtn.classList.add('hidden');
    elements.shakeHint.classList.remove('hidden');
    elements.shakeHint.textContent = '晃动手机开始摇骰子';

    showScreen('initial');
}

// ==================== 音效模块 ====================
async function initAudio() {
    if (state.audioContext) return;
    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.error('无法初始化音频:', e);
    }
}

function playCollisionSoundThrottled(volume = 0.5) {
    const now = Date.now();
    if (now - state.lastCollisionTime > CONFIG.COLLISION_COOLDOWN) {
        playCollisionSound(volume);
        state.lastCollisionTime = now;
    }
}

function playCollisionSound(volume = 0.5) {
    if (!state.audioContext) return;

    const ctx = state.audioContext;
    const now = ctx.currentTime;
    const duration = 0.05;

    // 主音调
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800 + volume * 400, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.min(0.6, volume), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);

    // 噪声脉冲
    addNoiseBurst(ctx, now, 0.02, volume * 0.3);
}

function addNoiseBurst(ctx, time, duration, volume) {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(time);
}

function playLandingSounds() {
    for (let i = 0; i < state.diceCount; i++) {
        setTimeout(() => {
            playSingleLandingSound();
        }, i * 80);
    }
}

function playSingleLandingSound() {
    if (!state.audioContext) return;

    const ctx = state.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
}

// ==================== 震动功能 ====================
function startVibration() {
    if (!navigator.vibrate) return;

    const baseDuration = 60;
    const durationPerDice = 20;
    const vibrationDuration = baseDuration + state.diceCount * durationPerDice;

    const pattern = [vibrationDuration, 50, vibrationDuration, 50, vibrationDuration, 50];
    navigator.vibrate(pattern);

    state.vibrationInterval = setInterval(() => {
        if (state.gameState === GameState.SHAKING) {
            navigator.vibrate(pattern);
        }
    }, (vibrationDuration + 50) * 3 + 50);
}

function stopVibration() {
    if (!navigator.vibrate) return;

    navigator.vibrate(0);

    if (state.vibrationInterval) {
        clearInterval(state.vibrationInterval);
        state.vibrationInterval = null;
    }
}

function triggerCollisionVibration(collisionCount) {
    if (!navigator.vibrate) return;

    const now = Date.now();
    // 防止震动过于频繁
    if (now - state.lastCollisionVibrationTime < CONFIG.COLLISION_VIBRATION_DECAY) {
        return;
    }
    state.lastCollisionVibrationTime = now;

    // 根据碰撞数量增加震动强度
    // 1次碰撞: 15ms, 2次: 25ms, 3次: 40ms, 4次: 60ms...
    const duration = Math.min(
        CONFIG.COLLISION_VIBRATION_BASE * Math.pow(1.5, collisionCount - 1),
        100 // 最大100ms
    );

    navigator.vibrate(duration);
}

// ==================== 启动应用 ====================
document.addEventListener('DOMContentLoaded', init);