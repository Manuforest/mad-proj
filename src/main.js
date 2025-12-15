import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { Scene01 } from './scenes/Scene01';
import { Scene02 } from './scenes/Scene02';
import { Scene03 } from './scenes/Scene03';

// 1. 初始化
const app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    backgroundColor: 0x000000,
});
document.body.appendChild(app.view);

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

const assets = {
    bg01: '/bg.jpg',
    bg02: '/bg2.jpg',
    char01: '/char.png',
    char02: '/char02.png',
};

// 音乐 (流式播放，不需要预加载)
const bgm = new Audio('/bgm.mp3');
bgm.loop = true;
bgm.volume = 0;

let currentScene = null;
let currentSceneIndex = 1;
let isTransitioning = false;
let isStarted = false;
// ✨ 新增：资源加载状态标记
let isResourcesLoaded = false;

const startBtn = document.getElementById('start-btn');
const btnText = document.querySelector('.btn-text'); // 获取文字元素
const introLayer = document.getElementById('intro-layer');

// ✨✨✨ 1. 初始化时先显示 Loading ✨✨✨
btnText.innerText = "LOADING...";
startBtn.style.opacity = "0.5";
startBtn.style.cursor = "wait";

// --- 交互入口 ---
startBtn.addEventListener('click', () => {
    // ✨ 只有资源加载完了才允许点击
    if (isStarted || !isResourcesLoaded) return;

    isStarted = true;

    // 播放音乐
    bgm.play().then(() => {
        gsap.to(bgm, { volume: 0.6, duration: 3.0 });
    }).catch(e => console.error("BGM Autoplay prevented", e));

    // UI 消失
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
    if (e.deltaY > 50 && currentSceneIndex === 2) {
        transitionToScene3();
    }
});

async function start() {
    try {
        // ✨✨✨ 2. 等待资源加载 ✨✨✨
        await PIXI.Assets.load(Object.values(assets));
        console.log("所有资源加载完毕！");

        // 加载完成后，更新 UI 状态
        isResourcesLoaded = true;
        btnText.innerText = "CLICK START";
        startBtn.style.opacity = "1";
        startBtn.style.cursor = "pointer";

    } catch (e) {
        console.error("资源加载失败:", e);
        btnText.innerText = "ERROR loading files";
    }

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
    isTransitioning = true;
    const screenH = app.screen.height;
    const oldScene = currentScene;
    const nextScene = new Scene03(app);
    await nextScene.init();
    nextScene.container.y = screenH;
    app.stage.addChild(nextScene.container);

    nextScene.onRestartClick = () => { if (!isTransitioning) transitionBackToStart(); };

    const tl = gsap.timeline({
        onComplete: () => {
            oldScene.destroy();
            currentScene = nextScene;
            currentSceneIndex = 3;
            isTransitioning = false;
            currentScene.container.y = 0;
        }
    });
    tl.to(oldScene.container, { y: -screenH, duration: 1.5, ease: "power3.inOut" }, 0);
    tl.to(nextScene.container, {
        y: 0, duration: 1.5, ease: "power3.inOut",
        onStart: () => { if (nextScene.playIntro) nextScene.playIntro(); }
    }, 0);
}

// 3 -> 1
function transitionBackToStart() {
    isTransitioning = true;
    gsap.to(bgm, {
        volume: 0, duration: 1.0,
        onComplete: () => { bgm.currentTime = 0; bgm.play(); gsap.to(bgm, { volume: 0.6, duration: 3.0 }); }
    });
    const tl = gsap.timeline({
        onComplete: () => {
            loadScene(Scene01);
            currentSceneIndex = 1;
            currentScene.container.alpha = 0;
            gsap.to(currentScene.container, { alpha: 1, duration: 1.5, onComplete: () => { isTransitioning = false; } });
        }
    });
    tl.to(currentScene.container, { alpha: 0, duration: 1.0 });
}

start().catch(e => console.error(e));
window.addEventListener('resize', () => { app.renderer.resize(window.innerWidth, window.innerHeight); });