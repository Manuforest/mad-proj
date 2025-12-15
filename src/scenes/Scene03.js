import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';

export class Scene03 {
    constructor(app) {
        this.app = app;
        this.container = new PIXI.Container();
        this.container.sortableChildren = true;
        this.container.alpha = 1;
        this.isActive = false;

        this.onRestartClick = null;

        this.mouse = { x: app.screen.width / 2, y: app.screen.height / 2 };
        this.params = {
            bgColor: 0x1a1a2e,
            accentColor: 0x3498DB
        };

        // 交互状态
        this.restoreProgress = 0;
        this.isComplete = false;
        this.timer = 0;
    }

    async init() {
        this.setupVisuals();
        this.setupInput();
        this.isActive = true;
    }

    setupInput() {
        // 视差用的鼠标追踪
        this.onMouseMove = (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        };
        window.addEventListener('mousemove', this.onMouseMove);

        // ✨✨✨ 修复：点击监听 ✨✨✨
        // 接收事件对象 e，直接获取点击位置
        this.onMouseDown = (e) => {
            if (this.isComplete || !this.isActive) return;

            // 1. 生成波纹 (传入当前点击的绝对坐标)
            this.createClickRipple(e.clientX, e.clientY);

            // 2. 增加进度 (30%)
            this.restoreProgress += 0.30;
            if (this.restoreProgress > 1.0) this.restoreProgress = 1.0;

            // 3. 视觉反馈
            gsap.to(this.letterContainer.scale, { x: 0.95, y: 0.95, duration: 0.05, yoyo: true, repeat: 1 });
            this.progressBar.alpha = 1;
        };
        window.addEventListener('mousedown', this.onMouseDown);
    }

    // ✨✨✨ 修复：创建点击波纹 ✨✨✨
    createClickRipple(globalX, globalY) {
        const ripple = new PIXI.Graphics();

        // 样式：细白圈
        ripple.lineStyle(2, 0xFFFFFF, 0.8);
        ripple.drawCircle(0, 0, 20); // 初始半径
        ripple.endFill();

        // ✨ 关键：将全局屏幕坐标转换为容器内的局部坐标
        // 这样即使 container 被移动了，波纹也能出现在鼠标点对的位置
        const localPos = this.container.toLocal(new PIXI.Point(globalX, globalY));
        ripple.x = localPos.x;
        ripple.y = localPos.y;

        this.container.addChild(ripple);

        // 动画：放大 + 变淡
        gsap.to(ripple.scale, { x: 2.5, y: 2.5, duration: 0.4, ease: "power2.out" });
        gsap.to(ripple, {
            alpha: 0,
            duration: 0.4,
            ease: "power2.out",
            onComplete: () => {
                this.container.removeChild(ripple);
                ripple.destroy();
            }
        });
    }

    setupVisuals() {
        const w = this.app.screen.width;
        const h = this.app.screen.height;
        const cx = w / 2;
        const cy = h / 2;

        // 1. 背景
        const bg = new PIXI.Graphics();
        bg.beginFill(this.params.bgColor);
        bg.drawRect(0, 0, w, h);
        bg.endFill();
        this.container.addChild(bg);

        // 2. 文字容器
        this.letterContainer = new PIXI.Container();
        this.letterContainer.position.set(cx, cy);
        this.container.addChild(this.letterContainer);

        this.setupScatteredText(w, h);

        // 3. 进度条
        this.progressContainer = new PIXI.Container();
        this.progressContainer.position.set(cx, cy + 120);
        this.container.addChild(this.progressContainer);

        const track = new PIXI.Graphics();
        track.beginFill(0xFFFFFF, 0.2);
        track.drawRect(-150, -2, 300, 4);
        track.endFill();
        this.progressContainer.addChild(track);

        this.progressBar = new PIXI.Graphics();
        this.progressContainer.addChild(this.progressBar);

        // 4. 提示文字
        const hintStyle = new PIXI.TextStyle({
            fontFamily: 'Consolas', fontSize: 14, fill: 0x888888, letterSpacing: 2, align: 'center'
        });
        this.hintText = new PIXI.Text(">>> CLICK TO RESTORE <<<", hintStyle);
        this.hintText.anchor.set(0.5);
        this.hintText.y = 30;
        this.progressContainer.addChild(this.hintText);

        this.progressContainer.alpha = 0;
    }

    setupScatteredText(w, h) {
        const str = "MEMORY RESTORED";
        const style = new PIXI.TextStyle({
            fontFamily: 'Consolas',
            fontSize: 60,
            fill: 0x555555,
            fontWeight: 'bold',
            letterSpacing: 0,
            dropShadow: false
        });

        this.letters = [];
        const charSpacing = 45;
        const totalWidth = (str.length - 1) * charSpacing;
        const startX = -totalWidth / 2;

        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (char === " ") continue;

            const textObj = new PIXI.Text(char, style);
            textObj.anchor.set(0.5);

            const targetX = startX + i * charSpacing;
            const targetY = 0;

            const randomAngle = Math.random() * Math.PI * 2;
            const randomDist = 300 + Math.random() * 500;
            const scatterX = Math.cos(randomAngle) * randomDist;
            const scatterY = Math.sin(randomAngle) * randomDist;

            textObj.x = scatterX;
            textObj.y = scatterY;
            textObj.rotation = (Math.random() - 0.5) * Math.PI * 2;
            textObj.alpha = 0;

            textObj.userData = {
                targetX: targetX,
                targetY: targetY,
                scatterX: scatterX,
                scatterY: scatterY,
                scatterRot: textObj.rotation,
                floatPhase: Math.random() * 100
            };

            this.letterContainer.addChild(textObj);
            this.letters.push(textObj);
        }
    }

    playIntro() {
        this.letters.forEach(l => {
            gsap.to(l, { alpha: 0.6, duration: 2.0, ease: "power1.inOut", delay: Math.random() * 0.5 });
        });
        gsap.to(this.progressContainer, { alpha: 1, duration: 1.0, delay: 1.0 });
        gsap.to(this.hintText, { alpha: 0.5, yoyo: true, repeat: -1, duration: 0.8 });
    }

    update(delta) {
        if (!this.isActive) return;
        this.timer += 0.05;

        const cx = this.app.screen.width / 2;
        const cy = this.app.screen.height / 2;

        // 1. 视差
        const mouseX = (this.mouse.x - cx) * 0.03;
        const mouseY = (this.mouse.y - cy) * 0.03;
        this.letterContainer.x = cx - mouseX;
        this.letterContainer.y = cy - mouseY;
        this.progressContainer.x = cx - mouseX * 0.5;
        this.progressContainer.y = cy + 120 - mouseY * 0.5;

        // 2. 进度逻辑
        if (!this.isComplete) {
            const dt = this.app.ticker.deltaMS / 1000;
            const decayAmount = 0.05 * dt;

            if (this.restoreProgress > 0) {
                this.restoreProgress -= decayAmount;
            }
            if (this.restoreProgress < 0) this.restoreProgress = 0;

            if (this.restoreProgress >= 0.99) {
                this.triggerCompletion();
            }
        }

        // 3. 缓动
        let easeProgress = this.restoreProgress;
        easeProgress = Math.pow(easeProgress, 2);
        if (this.isComplete) easeProgress = 1;

        // 4. 更新 UI
        const barW = 300 * easeProgress;
        this.progressBar.clear();
        const color = this.isComplete ? 0xFFFFFF : this.params.accentColor;
        this.progressBar.beginFill(color);
        this.progressBar.drawRect(-150, -2, barW, 4);
        this.progressBar.endFill();

        // 5. 更新字母
        this.letters.forEach(char => {
            const d = char.userData;

            const currX = d.scatterX + (d.targetX - d.scatterX) * easeProgress;
            const currY = d.scatterY + (d.targetY - d.scatterY) * easeProgress;

            const floatAmp = (1 - easeProgress) * 20;
            const floatX = Math.cos(this.timer * 0.05 + d.floatPhase) * floatAmp;
            const floatY = Math.sin(this.timer * 0.05 + d.floatPhase) * floatAmp;

            char.x = currX + floatX;
            char.y = currY + floatY;

            char.rotation = d.scatterRot * (1 - easeProgress);

            if (this.isComplete) {
                char.style.fill = 0xFFFFFF;
                char.alpha = 1;
                char.style.dropShadow = false;
            } else {
                const val = Math.floor(85 + 100 * easeProgress);
                char.style.fill = `rgb(${val},${val},${val})`;
                char.alpha = 0.5 + 0.5 * easeProgress;
                char.style.dropShadow = false;
            }
        });
    }

    triggerCompletion() {
        this.isComplete = true;
        this.restoreProgress = 1;

        gsap.to(this.progressContainer, { alpha: 0, duration: 0.5 });

        gsap.to(this.letterContainer, { x: "+=5", duration: 0.05, yoyo: true, repeat: 5 });
        gsap.to(this.letterContainer.scale, { x: 1.1, y: 1.1, duration: 0.2, yoyo: true, repeat: 1 });

        setTimeout(() => {
            if (this.onRestartClick) this.onRestartClick();
        }, 2000);
    }

    destroy() {
        this.isActive = false;
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mousedown', this.onMouseDown);
        this.app.stage.removeChild(this.container);
        this.container.destroy({ children: true });
    }
}