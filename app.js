// ==================== 状态管理 ====================
const state = {
    selectedDiceCount: 0,
    currentScreen: 'initial', // 'initial', 'shake', 'result', 'not-supported'
    isShaking: false,
    isWaitingForStillness: false,
    lastMovementTime: 0,
    diceResults: [],
    audioContext: null,
    shakeOscillator: null,
    shakeGain: null,
    // 骰子物理状态
    dicePhysics: [],
    animationFrame: null,
    lastCollisionTime: 0,
    // 震动状态
    vibrationInterval: null,
    // 演示模式
    isDemoMode: false
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
    restartBtn: document.getElementById('restart-btn'),
    // 错误提示相关元素
    errorIcon: document.getElementById('error-icon'),
    errorTitle: document.getElementById('error-title'),
    errorMessage: document.getElementById('error-message'),
    errorSuggestions: document.getElementById('error-suggestions'),
    demoBtn: document.getElementById('demo-btn'),
    demoHint: document.getElementById('demo-hint')
};

// ==================== 初始化 ====================
function init() {
    // 检查是否支持传感器
    const supportResult = checkDeviceSupport();
    if (!supportResult.supported) {
        showNotSupportedScreen(supportResult);
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

    // 返回详细的检测结果
    return {
        supported: isMobile && hasDeviceMotion,
        isMobile: isMobile,
        hasDeviceMotion: hasDeviceMotion
    };
}

// 显示不支持界面
function showNotSupportedScreen(supportResult) {
    const { isMobile, hasDeviceMotion } = supportResult;

    // 根据不同情况显示不同提示
    if (!isMobile && !hasDeviceMotion) {
        // 桌面浏览器，没有传感器
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
        // 可能是平板或桌面
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
        // 移动设备但没有传感器
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

    // 显示演示模式按钮
    elements.demoBtn.classList.remove('hidden');
    elements.demoHint.classList.remove('hidden');

    showScreen('not-supported');
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
            if (state.isDemoMode) {
                startGameDemo();
            } else {
                startGame();
            }
        }
    });

    // 重新开始按钮
    elements.restartBtn.addEventListener('click', () => {
        resetGame();
    });

    // 演示模式按钮
    elements.demoBtn.addEventListener('click', () => {
        startDemoMode();
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

// 启动演示模式
function startDemoMode() {
    state.isDemoMode = true;

    // 初始化音频
    initAudio();

    // 切换到初始界面选择骰子
    showScreen('initial');

    // 绑定事件（如果还没有绑定）
    bindEvents();
}

// 开始游戏（演示模式）
async function startGameDemo() {
    // 初始化音频
    await initAudio();

    // 切换到摇骰子界面
    showScreen('shake');

    // 生成骰子
    generateDice();

    // 更新提示文字
    elements.shakeHint.textContent = '点击屏幕模拟摇骰子';

    // 添加点击事件监听
    elements.diceArea.addEventListener('click', handleDemoShake);
}

// 处理演示模式点击
function handleDemoShake() {
    if (state.currentScreen !== 'shake') return;
    if (state.isShaking) return;

    // 模拟摇骰子
    onShakeStart();

    // 1.5秒后自动结束
    setTimeout(() => {
        if (state.isShaking) {
            onShakeEnd();
        }
    }, 1500);
}

// 生成骰子
function generateDice() {
    elements.diceArea.innerHTML = '';
    state.diceResults = [];
    state.dicePhysics = [];

    const areaWidth = elements.diceArea.clientWidth || 300;
    const areaHeight = elements.diceArea.clientHeight || 300;
    const diceSize = 70;
    const padding = 10;

    for (let i = 0; i < state.selectedDiceCount; i++) {
        const dice = document.createElement('div');
        dice.className = 'dice';
        dice.dataset.value = '0';
        dice.id = `dice-${i}`;

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

        // 初始化物理属性
        const maxX = areaWidth - diceSize - padding;
        const maxY = areaHeight - diceSize - padding;

        state.dicePhysics.push({
            id: i,
            element: dice,
            x: padding + Math.random() * Math.max(0, maxX - padding),
            y: padding + Math.random() * Math.max(0, maxY - padding),
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            size: diceSize,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 20
        });
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
    state.isWaitingForStillness = true;
    state.lastMovementTime = Date.now();

    // 隐藏提示
    elements.shakeHint.classList.add('hidden');

    // 启动物理动画
    startPhysicsAnimation();

    // 开始震动（震动强度与骰子数量正相关）
    startVibration();
}

// 结束晃动
function onShakeEnd() {
    state.isShaking = false;
    state.isWaitingForStillness = false;

    // 停止物理动画
    stopPhysicsAnimation();

    // 停止震动
    stopVibration();

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

    // 更新骰子显示值（保持当前位置）
    state.dicePhysics.forEach((dice, index) => {
        dice.element.dataset.value = state.diceResults[index];
        // 重置旋转角度
        dice.rotation = 0;
        dice.element.style.transform = `translate(${dice.x}px, ${dice.y}px) rotate(0deg)`;
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
    // 停止物理动画
    stopPhysicsAnimation();

    // 停止震动
    stopVibration();

    // 移除演示模式点击监听
    if (state.isDemoMode) {
        elements.diceArea.removeEventListener('click', handleDemoShake);
    }

    // 重置状态
    state.selectedDiceCount = 0;
    state.isShaking = false;
    state.isWaitingForStillness = false;
    state.diceResults = [];
    state.dicePhysics = [];

    // 重置UI
    elements.diceButtons.forEach(btn => btn.classList.remove('selected'));
    elements.startBtn.disabled = true;
    elements.diceArea.innerHTML = '';
    elements.resultArea.classList.add('hidden');
    elements.restartBtn.classList.add('hidden');
    elements.shakeHint.classList.remove('hidden');
    elements.shakeHint.textContent = '晃动手机开始摇骰子';

    // 返回初始界面
    showScreen('initial');
}

// ==================== 物理动画系统 ====================
function startPhysicsAnimation() {
    if (state.animationFrame) return;

    // 给骰子随机初始速度
    state.dicePhysics.forEach(dice => {
        dice.vx = (Math.random() - 0.5) * 15;
        dice.vy = (Math.random() - 0.5) * 15;
        dice.rotationSpeed = (Math.random() - 0.5) * 30;
    });

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
    const padding = 5;
    const restitution = 0.85; // 弹性系数
    const friction = 0.98; // 摩擦系数

    // 添加随机外力模拟摇晃
    if (state.isShaking) {
        state.dicePhysics.forEach(dice => {
            dice.vx += (Math.random() - 0.5) * 3;
            dice.vy += (Math.random() - 0.5) * 3;
            dice.rotationSpeed += (Math.random() - 0.5) * 10;
        });
    }

    // 更新位置和检测边界碰撞
    state.dicePhysics.forEach(dice => {
        // 更新位置
        dice.x += dice.vx;
        dice.y += dice.vy;
        dice.rotation += dice.rotationSpeed;

        // 边界碰撞检测
        const maxX = areaWidth - dice.size - padding;
        const maxY = areaHeight - dice.size - padding;

        // 左边界
        if (dice.x < padding) {
            dice.x = padding;
            dice.vx = -dice.vx * restitution;
            dice.rotationSpeed = -dice.rotationSpeed * 0.8;
            playCollisionSound(0.3);
        }
        // 右边界
        if (dice.x > maxX) {
            dice.x = maxX;
            dice.vx = -dice.vx * restitution;
            dice.rotationSpeed = -dice.rotationSpeed * 0.8;
            playCollisionSound(0.3);
        }
        // 上边界
        if (dice.y < padding) {
            dice.y = padding;
            dice.vy = -dice.vy * restitution;
            dice.rotationSpeed = -dice.rotationSpeed * 0.8;
            playCollisionSound(0.3);
        }
        // 下边界
        if (dice.y > maxY) {
            dice.y = maxY;
            dice.vy = -dice.vy * restitution;
            dice.rotationSpeed = -dice.rotationSpeed * 0.8;
            playCollisionSound(0.3);
        }

        // 应用摩擦力
        dice.vx *= friction;
        dice.vy *= friction;
        dice.rotationSpeed *= friction;

        // 更新 DOM 元素位置
        dice.element.style.transform = `translate(${dice.x}px, ${dice.y}px) rotate(${dice.rotation}deg)`;
    });

    // 检测骰子之间的碰撞
    for (let i = 0; i < state.dicePhysics.length; i++) {
        for (let j = i + 1; j < state.dicePhysics.length; j++) {
            checkDiceCollision(state.dicePhysics[i], state.dicePhysics[j], restitution);
        }
    }
}

function checkDiceCollision(dice1, dice2, restitution) {
    // 计算两个骰子中心点的距离
    const dx = (dice1.x + dice1.size / 2) - (dice2.x + dice2.size / 2);
    const dy = (dice1.y + dice1.size / 2) - (dice2.y + dice2.size / 2);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = dice1.size;

    // 如果距离小于两个骰子的半径之和，发生碰撞
    if (distance < minDistance && distance > 0) {
        // 防止短时间内多次播放碰撞音
        const now = Date.now();
        if (now - state.lastCollisionTime > 50) {
            // 根据相对速度计算音量
            const relVel = Math.sqrt(
                Math.pow(dice1.vx - dice2.vx, 2) +
                Math.pow(dice1.vy - dice2.vy, 2)
            );
            const volume = Math.min(0.8, relVel / 20);
            playCollisionSound(volume);
            state.lastCollisionTime = now;
        }

        // 计算碰撞法线
        const nx = dx / distance;
        const ny = dy / distance;

        // 计算相对速度
        const dvx = dice1.vx - dice2.vx;
        const dvy = dice1.vy - dice2.vy;

        // 计算相对速度在法线方向的分量
        const dvn = dvx * nx + dvy * ny;

        // 只有当物体相向运动时才处理碰撞
        if (dvn > 0) return;

        // 更新速度（假设质量相等）
        dice1.vx -= dvn * nx * restitution;
        dice1.vy -= dvn * ny * restitution;
        dice2.vx += dvn * nx * restitution;
        dice2.vy += dvn * ny * restitution;

        // 碰撞时改变旋转速度
        dice1.rotationSpeed += (Math.random() - 0.5) * 15;
        dice2.rotationSpeed += (Math.random() - 0.5) * 15;

        // 分离两个骰子，防止重叠
        const overlap = minDistance - distance;
        const separationX = (overlap / 2 + 1) * nx;
        const separationY = (overlap / 2 + 1) * ny;

        dice1.x += separationX;
        dice1.y += separationY;
        dice2.x -= separationX;
        dice2.y -= separationY;
    }
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

// 播放碰撞音效（清脆的咔哒声）
function playCollisionSound(volume = 0.5) {
    if (!state.audioContext) return;

    const now = state.audioContext.currentTime;

    // 创建多个振荡器模拟碰撞的复杂音色
    const frequencies = [800, 1200, 2000]; // 多个频率叠加
    const duration = 0.05; // 非常短的持续时间

    frequencies.forEach((freq, index) => {
        const oscillator = state.audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, now);
        oscillator.frequency.exponentialRampToValueAtTime(freq * 0.5, now + duration);

        // 创建增益节点
        const gainNode = state.audioContext.createGain();
        const vol = volume * (1 - index * 0.2); // 每个频率音量递减
        gainNode.gain.setValueAtTime(vol, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        // 连接节点
        oscillator.connect(gainNode);
        gainNode.connect(state.audioContext.destination);

        // 播放
        oscillator.start(now);
        oscillator.stop(now + duration);
    });

    // 添加一个短的噪声脉冲模拟撞击感
    const noiseBuffer = state.audioContext.createBuffer(1, state.audioContext.sampleRate * 0.02, state.audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseData.length * 0.1));
    }

    const noiseSource = state.audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseGain = state.audioContext.createGain();
    noiseGain.gain.value = volume * 0.3;

    noiseSource.connect(noiseGain);
    noiseGain.connect(state.audioContext.destination);
    noiseSource.start(now);
}

// 播放晃动音效（保留但不再使用持续的噪声）
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

// ==================== 震动功能 ====================
// 开始震动（震动强度与骰子数量正相关）
function startVibration() {
    // 检查是否支持震动 API
    if (!navigator.vibrate) return;

    // 基于骰子数量计算震动强度
    // 骰子数量 1-8，震动时长从 80ms 到 220ms
    const baseDuration = 60;
    const durationPerDice = 20;
    const vibrationDuration = baseDuration + state.selectedDiceCount * durationPerDice;

    // 使用震动模式：[震动时长, 暂停时长, 震动时长, ...]
    // 暂停时长较短，营造持续震动的效果
    const pattern = [vibrationDuration, 50, vibrationDuration, 50, vibrationDuration, 50];

    navigator.vibrate(pattern);

    // 保存震动状态以便持续震动
    state.vibrationInterval = setInterval(() => {
        if (state.isShaking) {
            navigator.vibrate(pattern);
        }
    }, (vibrationDuration + 50) * 3 + 50);
}

// 停止震动
function stopVibration() {
    if (!navigator.vibrate) return;

    // 停止所有震动
    navigator.vibrate(0);

    // 清除震动循环
    if (state.vibrationInterval) {
        clearInterval(state.vibrationInterval);
        state.vibrationInterval = null;
    }
}

// ==================== 启动应用 ====================
document.addEventListener('DOMContentLoaded', init);