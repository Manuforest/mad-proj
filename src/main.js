import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { Scene01 } from './scenes/Scene01';
import { Scene02 } from './scenes/Scene02';
import { Scene03 } from './scenes/Scene03';

// 1. 初始化 Pixi
const app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    backgroundColor: 0x000000,
});
document.body.appendChild(app.view);

// 全局黑边
const bars = new PIXI.Graphics();
bars.zIndex = 999;
app.stage.addChild(bars);
app.stage.sortableChildren = true;

function drawBars(height = 100) {
    bars.clear();
    bars.beginFill(0x000000);
    bars.drawRect(0, 0, app.screen.width, height);
    bars.drawRect(0, app.screen.height - height, app.screen.width, height);
    bars.endFill();
}

// 2. 资源管理
const assets = {
    bg01: '/bg.jpg',
    char01: '/char.png',
    char02: '/char02.png',
};

// 3. 背景音乐设置
// 创建音频对象 (HTML5 Audio)
const bgm = new Audio('/bgm.mp3');
bgm.loop = true;   // 循环播放
bgm.volume = 0;    // 初始音量为0 (用于淡入)

let currentScene = null;
let currentSceneIndex = 1;
let isTransitioning = false;
let isStarted = false;

const startBtn = document.getElementById('start-btn');
const introLayer = document.getElementById('intro-layer');

// --- 交互入口 ---
startBtn.addEventListener('click', () => {
    if (isStarted) return;
    isStarted = true;

    // ✨✨✨ 播放音乐 (Fade In) ✨✨✨
    bgm.play().then(() => {
        // 使用 GSAP 让音量在 3秒内从 0 升到 0.6 (不刺耳)
        gsap.to(bgm, { volume: 0.6, duration: 3.0 });
    }).catch(e => {
        console.error("BGM播放失败 (可能由于浏览器限制或文件缺失)", e);
    });

    // UI 消失动画
    gsap.to(startBtn, { scale: 1.5, opacity: 0, duration: 0.3 });
    gsap.to(introLayer, {
        opacity: 0, duration: 1.0, delay: 0.2,
        onComplete: () => { introLayer.style.display = 'none'; }
    });

    setTimeout(() => { loadScene(Scene01); }, 500);
});

// 滚轮监听
window.addEventListener('wheel', (e) => {
    if (!isStarted || isTransitioning) return;
    if (e.deltaY > 50) {
        if (currentSceneIndex === 2) {
            transitionToScene3();
        }
    }
});

async function start() {
    try { await PIXI.Assets.load(Object.values(assets)); } catch (e) { console.error(e); }
    app.ticker.add((delta) => {
        if (currentScene && currentScene.update) { currentScene.update(delta); }
        const barH = (currentScene && currentScene.params) ? currentScene.params.barHeight : 100;
        drawBars(barH);
    });
}

function loadScene(SceneClass) {
    if (currentScene) currentScene.destroy();
    currentScene = new SceneClass(app);
    currentScene.init();
    app.stage.addChild(currentScene.container);

    currentScene.container.y = 0;
    currentScene.container.alpha = 1;

    if (currentScene.playIntro) currentScene.playIntro();

    if (SceneClass === Scene01) {
        currentScene.onCharClick = () => { if (!isTransitioning) transitionToScene2(); };
        currentSceneIndex = 1;
    }
}

// 1 -> 2
async function transitionToScene2() {
    console.log("Go to Scene 2");
    isTransitioning = true;
    const oldScene = currentScene;
    const nextScene = new Scene02(app);
    await nextScene.init();

    nextScene.container.alpha = 0;
    app.stage.addChild(nextScene.container);

    const tl = gsap.timeline({
        onComplete: () => {
            oldScene.destroy();
            currentScene = nextScene;
            currentSceneIndex = 2;
            isTransitioning = false;
        }
    });

    tl.to(oldScene.container, { alpha: 0.5, duration: 1.2 }, 0);
    tl.to(nextScene.container, {
        alpha: 1, duration: 1.2, ease: "power2.inOut",
        onComplete: () => { if (nextScene.playIntro) nextScene.playIntro(); }
    }, 0);
}

// 2 -> 3
async function transitionToScene3() {
    console.log("Go to Scene 3");
    isTransitioning = true;
    const screenH = app.screen.height;
    const oldScene = currentScene;
    const nextScene = new Scene03(app);
    await nextScene.init();

    nextScene.container.y = screenH;
    app.stage.addChild(nextScene.container);

    nextScene.onRestartClick = () => {
        if (!isTransitioning) transitionBackToStart();
    };

    const tl = gsap.timeline({
        onComplete: () => {
            oldScene.destroy();
            currentScene = nextScene;
            currentSceneIndex = 3;
            isTransitioning = false;
            currentScene.container.y = 0;
        }
    });

    const duration = 1.5;
    const ease = "power3.inOut";

    tl.to(oldScene.container, { y: -screenH, duration: duration, ease: ease }, 0);
    tl.to(nextScene.container, {
        y: 0, duration: duration, ease: ease,
        onStart: () => { if (nextScene.playIntro) nextScene.playIntro(); }
    }, 0);
}

// ✨✨✨ 3 -> 1 (轮回重启) ✨✨✨
function transitionBackToStart() {
    console.log("Restarting...");
    isTransitioning = true;

    // 音乐处理：淡出 -> 切歌(重置进度) -> 淡入
    gsap.to(bgm, {
        volume: 0,
        duration: 1.0,
        onComplete: () => {
            bgm.currentTime = 0; // 进度归零
            bgm.play();
            gsap.to(bgm, { volume: 0.6, duration: 3.0 }); // 重新淡入
        }
    });

    const tl = gsap.timeline({
        onComplete: () => {
            loadScene(Scene01);
            currentSceneIndex = 1;

            currentScene.container.alpha = 0;
            gsap.to(currentScene.container, {
                alpha: 1,
                duration: 1.5,
                onComplete: () => { isTransitioning = false; }
            });
        }
    });

    tl.to(currentScene.container, { alpha: 0, duration: 1.0 });
}

start().catch(e => console.error(e));
window.addEventListener('resize', () => { app.renderer.resize(window.innerWidth, window.innerHeight); });