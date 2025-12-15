import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';

export class Scene02 {
    constructor(app) {
        this.app = app;
        this.container = new PIXI.Container();
        this.container.sortableChildren = true;
        this.container.alpha = 1;
        this.isActive = false;

        this.mouse = { x: app.screen.width / 2, y: app.screen.height / 2 };
        this.startTime = Date.now();

        // 交互状态
        this.isMouseDown = false;
        this.saveProgress = 0;
        this.hasRescued = false;

        this.params = {
            bgColor: 0xE0E0E0,
            cliffColor: 0x546E7A,
            accentColor: 0x3498DB,
            successColor: 0x2ECC71,
            textColor: 0x546E7A,

            charScale: 0.6,
            parallaxStrength: 0.05,

            fallSpeed: 0.02,

            b1X: -144, b1Y: 477, b1Rot: -0.2, b1Alpha: 0.05,
            b2X: -190, b2Y: 920, b2Rot: -0.15, b2Alpha: 0.1,

            formulaX: 365,
            formulaY: -340
        };
    }

    async init() {
        let charTexture;
        if (PIXI.Assets.cache.has('/char02.png')) {
            charTexture = PIXI.Assets.get('/char02.png');
        } else {
            console.warn("⚠️ 已使用 /char.png 代替");
            charTexture = PIXI.Assets.get('/char.png');
        }

        this.setupVisuals(charTexture);
        this.setupInput();
        this.isActive = true;
    }

    setupInput() {
        this.onMouseMove = (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        };
        this.onMouseDown = () => { this.isMouseDown = true; };
        this.onMouseUp = () => { this.isMouseDown = false; };

        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mouseup', this.onMouseUp);
    }

    setupVisuals(charTexture) {
        const w = this.app.screen.width;
        const h = this.app.screen.height;
        const cx = w / 2;
        const cy = h / 2;

        // 1. 背景
        this.bgLayer = new PIXI.Container();
        this.container.addChild(this.bgLayer);
        const bg = new PIXI.Graphics();
        bg.beginFill(this.params.bgColor);
        bg.drawRect(0, 0, w, h);
        bg.endFill();
        this.bgLayer.addChild(bg);
        this.bgLayer.filters = [new PIXI.NoiseFilter(0.1)];

        // 2. 装饰
        this.decorLayer = new PIXI.Container();
        this.decorLayer.alpha = 0;
        this.container.addChild(this.decorLayer);
        this.drawConnectedGrid(w, h);
        this.rippleGraphics = new PIXI.Graphics();
        this.decorLayer.addChild(this.rippleGraphics);
        this.setupRipples(w, h);

        // 3. 悬崖
        this.cliffLayer = new PIXI.Container();
        this.cliffLayer.alpha = 0;
        this.container.addChild(this.cliffLayer);
        this.drawWireframeCliff(w, h);

        // 4. 阴影块
        this.shadowLayer = new PIXI.Container();
        this.shadowLayer.alpha = 0;
        this.container.addChild(this.shadowLayer);
        this.block1 = new PIXI.Graphics(); this.block1.beginFill(0x000000, 1); this.block1.drawRect(-w, -h, w * 3, h);
        this.shadowLayer.addChild(this.block1);
        this.block2 = new PIXI.Graphics(); this.block2.beginFill(0x000000, 1); this.block2.drawRect(-w, 0, w * 3, h);
        this.shadowLayer.addChild(this.block2);

        // 5. UI
        this.uiLayer = new PIXI.Container();
        this.uiLayer.position.set(cx, cy);
        this.uiLayer.alpha = 0;
        this.container.addChild(this.uiLayer);
        this.rulerGraphics = new PIXI.Graphics();
        this.uiLayer.addChild(this.rulerGraphics);
        this.rulerTexts = [];
        this.drawRightRuler(w, h);
        this.setupFormulas(w, h);

        // 6. 角色
        this.charContainer = new PIXI.Container();
        this.charContainer.position.set(cx, cy + 50);
        this.charContainer.alpha = 0;
        this.container.addChild(this.charContainer);

        this.charSprite = new PIXI.Sprite(charTexture);
        this.charSprite.anchor.set(0.5);
        this.charSprite.scale.set(this.params.charScale);
        this.charSprite.rotation = 0.1;
        this.charContainer.addChild(this.charSprite);

        this.targetBox = new PIXI.Graphics();
        this.drawTargetBox();
        this.charContainer.addChild(this.targetBox);

        // 7. 顶层 (连线/文字/锁定UI)
        this.overlayLayer = new PIXI.Container();
        this.overlayLayer.position.set(cx, cy);
        this.overlayLayer.alpha = 0;
        this.container.addChild(this.overlayLayer);

        this.lineGraphics = new PIXI.Graphics();
        this.overlayLayer.addChild(this.lineGraphics);

        this.lockUI = new PIXI.Graphics();
        this.overlayLayer.addChild(this.lockUI);

        this.labels = [];
        this.createLinkedLabel('ALTITUDE', -200, -150);
        this.createLinkedLabel('VELOCITY_Y', -250, 150);
        this.createLinkedLabel('G-FORCE', 220, -120);
        this.createLinkedLabel('TARGET_LOCK', 210, 150);

        this.setupMouseTracker();

        // 8. 泛光
        this.glowLayer = new PIXI.Container();
        this.container.addChild(this.glowLayer);
        this.setupRightGlow(w, h);
    }

    // ✨✨✨ 标尺绘制 (装饰移到 1300) ✨✨✨
    drawRightRuler(w, h) {
        const g = this.rulerGraphics;
        const cellSize = 60; const rows = 15; const gridH = rows * cellSize; const startY = -gridH / 2;
        const rulerX = (w * 0.35);
        const textStyle = new PIXI.TextStyle({ fontFamily: 'Consolas', fontSize: 12, fill: this.params.textColor, align: 'left' });

        g.lineStyle(2, this.params.textColor, 0.5);
        g.moveTo(rulerX, startY); g.lineTo(rulerX, startY + gridH);

        for (let j = 0; j <= rows; j++) {
            const y = startY + j * cellSize;
            const val = (rows - j) * 100; // 计算当前刻度值

            g.lineStyle(2, this.params.textColor, 0.8);
            g.moveTo(rulerX, y); g.lineTo(rulerX + 15, y);

            const numText = new PIXI.Text(val.toString().padStart(4, '0'), textStyle);
            numText.anchor.set(0, 0.5);
            numText.position.set(rulerX + 25, y);
            numText.userData = { initialY: y, rulerX: rulerX };

            this.rulerTexts.push(numText);
            this.rulerGraphics.addChild(numText);

            //
            if (val === 1300) {
                const headerText = new PIXI.Text('ABS_HEIGHT // METER', {
                    fontFamily: 'Consolas', fontSize: 10, fill: this.params.textColor, fontWeight: 'bold'
                });
                // 放在数字右侧 (rulerX + 60)
                headerText.anchor.set(0, 0.5);
                headerText.position.set(rulerX + 100, y);
                this.rulerGraphics.addChild(headerText);

                // 装饰方块 (在文字左边一点)
                g.beginFill(this.params.accentColor, 0.8);
                g.drawRect(rulerX + 90, y - 5, 2, 10);
                g.endFill();
            }

            if (val === 200) {
                const headerText = new PIXI.Text('LOW_HEIGHT // METER', {
                    fontFamily: 'Consolas', fontSize: 10, fill: this.params.textColor, fontWeight: 'bold'
                });
                // 放在数字右侧 (rulerX + 100)
                headerText.anchor.set(0, 0.5);
                headerText.position.set(rulerX + 100, y);
                this.rulerGraphics.addChild(headerText);
            }

            if (j < rows) {
                g.lineStyle(1, this.params.textColor, 0.3);
                for(let k=1; k<4; k++) {
                    const subY = y + k * (cellSize / 4);
                    g.moveTo(rulerX, subY); g.lineTo(rulerX + 8, subY);
                }
            }
        }
    }

    drawLockUI() {
        const g = this.lockUI;
        g.clear();
        if (!this.isMouseDown && !this.hasRescued) return;
        const color = this.saveProgress >= 1 ? this.params.successColor : this.params.accentColor;
        const relX = this.mouse.x - this.overlayLayer.x;
        const relY = this.mouse.y - this.overlayLayer.y;
        const radius = 40;
        g.lineStyle(2, color, 0.3); g.drawCircle(relX, relY, radius);
        if (this.saveProgress > 0) {
            g.lineStyle(4, color, 1);
            g.arc(relX, relY, radius, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * this.saveProgress));
        }
        g.lineStyle(1, color, 0.8); const s = 10;
        g.moveTo(relX - s, relY); g.lineTo(relX + s, relY);
        g.moveTo(relX, relY - s); g.lineTo(relX, relY + s);
    }

    // ✨✨✨ 成功救援：原地固定 ✨✨✨
    triggerRescue() {
        this.hasRescued = true;

        // 1. UI 变色
        this.labels.forEach(l => l.textObj.style.fill = this.params.successColor);
        this.targetBox.tint = 0x2ECC71;
        if(this.recText) {
            this.recText.text = "LOCK ACQUIRED";
            this.recText.style.fill = this.params.successColor;
        }

        // 2. 动力暂停 (原地悬停)
        gsap.to(this.params, {
            fallSpeed: 0, // 速度归零
            duration: 1.0,
            ease: "power2.out"
        });

        // 3. 位置修正 (吸附到屏幕中心 + 50)
        const cy = this.app.screen.height / 2;
        gsap.to(this.charContainer, {
            y: cy + 50,
            duration: 1.5,
            ease: "elastic.out(1, 0.5)",// 弹性吸附感
            onComplete: () => {
                if (this.hintText) {
                    this.hintText.text = "> SCROLL TO CONTINUE <";
                    this.hintText.style.fill = 0x000000;
                    gsap.to(this.hintText, { alpha: 0.5, yoyo: true, repeat: -1, duration: 0.8 });
                }
            }
        });

        // 4. 姿态修正 & 震动
        gsap.to(this.charSprite, { rotation: 0, duration: 1.0 });
        gsap.to(this.container, { x: "+=5", y: "+=5", duration: 0.1, yoyo: true, repeat: 5 });
    }

    // ... (Helpers 保持不变) ...
    setupRipples(w, h) { this.ripples = []; for(let i=0; i<3; i++) { this.ripples.push({ x: w * 0.2 + Math.random() * w * 0.6, y: h * 0.2 + Math.random() * h * 0.6, progress: i * 0.33, baseRadius: 150 + Math.random() * 50, active: true }); } }
    drawRipples() { const g = this.rippleGraphics; g.clear(); const speed = 0.002; this.ripples.forEach(r => { r.progress += speed; if (r.progress >= 1) { r.progress = 0; r.x = this.app.screen.width * 0.2 + Math.random() * this.app.screen.width * 0.6; r.y = this.app.screen.height * 0.2 + Math.random() * this.app.screen.height * 0.6; } const currentRadius = r.baseRadius + r.progress * 30; const alpha = (1 - r.progress) * 0.1; g.lineStyle(1, this.params.textColor, alpha); g.drawCircle(r.x, r.y, currentRadius); }); }
    setupRightGlow(w, h) { const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = h; const ctx = canvas.getContext('2d'); const grd = ctx.createLinearGradient(0, 0, 200, 0); grd.addColorStop(0, "rgba(52, 152, 219, 0)"); grd.addColorStop(1, "rgba(52, 152, 219, 0.4)"); ctx.fillStyle = grd; ctx.fillRect(0, 0, 200, h); const glow = new PIXI.Sprite(PIXI.Texture.from(canvas)); glow.anchor.set(1, 0); glow.x = w; glow.y = 0; glow.blendMode = PIXI.BLEND_MODES.ADD; glow.alpha = 0; this.rightGlow = glow; this.glowLayer.addChild(glow); }
    drawConnectedGrid(w, h) { const g = new PIXI.Graphics(); const step = 100; g.lineStyle(1, this.params.textColor, 0.1); for(let x=0;x<w;x+=step){g.moveTo(x,0);g.lineTo(x,h);} for(let y=0;y<h;y+=step){g.moveTo(0,y);g.lineTo(w,y);} g.lineStyle(2,this.params.textColor,0.2); const crossSize=6; for(let x=0;x<w;x+=step){for(let y=0;y<h;y+=step){if((x+y)%(step*2)===0){g.moveTo(x-crossSize,y);g.lineTo(x+crossSize,y);g.moveTo(x,y-crossSize);g.lineTo(x,y+crossSize);}}} this.decorLayer.addChild(g); }
    drawWireframeCliff(w, h) { const g = new PIXI.Graphics(); g.lineStyle(2, this.params.cliffColor, 0.8); const maxWidth = w * 0.25; const points = []; points.push({x: -100, y: 0}); points.push({x: maxWidth, y: 0}); let currentX = maxWidth; const segments = 15; const stepY = h / segments; for (let i = 1; i <= segments; i++) { const y = i * stepY; const trend = (i / segments) * (maxWidth * 0.5); const noise = (Math.sin(i * 0.8) + Math.cos(i * 1.5)) * 15; points.push({x: currentX - trend + noise, y: y}); g.lineTo(currentX - trend + noise, y); } g.lineTo(-100, h); g.lineStyle(1, this.params.cliffColor, 0.3); points.forEach((pt, i) => { if (i % 2 === 0 && i > 0 && i < points.length - 1) { g.moveTo(-100, pt.y); g.lineTo(pt.x, pt.y); } }); g.moveTo(maxWidth * 0.2, 0); points.forEach((pt, i) => { if (i > 1) g.lineTo(pt.x * 0.5, pt.y); }); this.cliffLayer.addChild(g); }
    setupFormulas(w, h) { const container = new PIXI.Container(); container.x = this.params.formulaX; container.y = this.params.formulaY; this.uiLayer.addChild(container); const bg = new PIXI.Graphics(); bg.beginFill(0xFFFFFF, 0.4); bg.drawRect(-10, -10, 180, 420); bg.endFill(); container.addChild(bg); const header = new PIXI.Text("[ PHYSICS_KERNEL ]", { fontFamily: 'Consolas', fontSize: 12, fill: this.params.accentColor, fontWeight: 'bold' }); container.addChild(header); const style = new PIXI.TextStyle({ fontFamily: 'Consolas', fontSize: 13, fill: this.params.textColor }); const lines = [ "----------------", "v_0 = 0.00 m/s", "g   = 9.81 m/s^2", "----------------", "CALC_TRAJECTORY:", "  v = v0 + gt", "  h = v0t + 0.5gt^2", "  E = mgh + 0.5mv^2", "----------------", "STATUS: FREE_FALL", "WIND_RES: NULL", "TERMINAL_VEL: N/A" ]; lines.forEach((str, i) => { const text = new PIXI.Text(str, style); text.y = 25 + i * 25; text.x = 5; if (str.includes("=")) text.style.fill = 0x333333; if (str.includes(":")) text.style.fill = this.params.accentColor; container.addChild(text); }); }
    drawTargetBox() { const g = this.targetBox; g.clear(); const size = 180; const corner = 20; g.lineStyle(1, this.params.accentColor, 0.3); g.drawRect(-size/2, -size/2, size, size); g.lineStyle(2, this.params.accentColor, 0.8); const half = size / 2; g.moveTo(-half, -half + corner); g.lineTo(-half, -half); g.lineTo(-half + corner, -half); g.moveTo(half - corner, -half); g.lineTo(half, -half); g.lineTo(half, -half + corner); g.moveTo(half, half - corner); g.lineTo(half, half); g.lineTo(half - corner, half); g.moveTo(-half + corner, half); g.lineTo(-half, half); g.lineTo(-half, half - corner); g.lineStyle(1, this.params.accentColor, 0.5); const crossSize = 10; g.moveTo(0, -10); g.lineTo(0, 10); g.moveTo(-10, 0); g.lineTo(10, 0); if (!this.recText) { this.recText = new PIXI.Text("REC [00:00:00]", { fontFamily: 'Consolas', fontSize: 10, fill: this.params.accentColor, fontWeight: 'bold' }); this.recText.anchor.set(0.5); g.addChild(this.recText); } this.recText.position.set(0, -half - 15);
        if (!this.hintText) {
            this.hintText = new PIXI.Text("[ HOLD TRACK ]", {
                fontFamily: 'Consolas',
                fontSize: 12,
                fill: this.params.accentColor,
                align: 'center',
                letterSpacing: 2
            });
            this.hintText.anchor.set(0.5);
            this.targetBox.addChild(this.hintText);

            // 闪烁动画
            gsap.to(this.hintText, { alpha: 0.3, duration: 0.5, yoyo: true, repeat: -1 });
        }
        // 放在框的底部下方
        this.hintText.position.set(0, 180/2 + 20);
    }
    createLinkedLabel(str, offsetX, offsetY) { const container = new PIXI.Container(); container.position.set(0, 0); const bg = new PIXI.Graphics(); bg.beginFill(0x000000, 0.6); bg.drawRoundedRect(0, -10, 100, 20, 4); bg.endFill(); container.addChild(bg); const style = new PIXI.TextStyle({ fontFamily: 'Consolas', fontSize: 12, fill: 0xFFFFFF, fontWeight: 'bold' }); const text = new PIXI.Text(str, style); text.x = 5; text.y = -7; container.addChild(text); this.overlayLayer.addChild(container); this.labels.push({ obj: container, offsetX: offsetX, offsetY: offsetY, textObj: text }); }
    // GUI removed
    setupGUI() {}

    playIntro() { const tl = gsap.timeline(); tl.to([this.decorLayer, this.rightGlow], { alpha: 1, duration: 2.0 }); tl.to(this.cliffLayer, { alpha: 1, x: 0, duration: 1.5, ease: "power2.out" }, "-=1.5"); this.cliffLayer.x = -100; tl.to(this.uiLayer, { alpha: 1, x: this.app.screen.width / 2, duration: 1.5, ease: "power2.out" }, "-=1.2"); this.uiLayer.x += 100; tl.to(this.charContainer, { alpha: 1, y: this.app.screen.height / 2 + 50, duration: 2.0, ease: "power2.out" }, "-=1.0"); this.charContainer.y -= 200; tl.to(this.overlayLayer, { alpha: 1, duration: 1.0 }, "-=0.5"); tl.to(this.shadowLayer, { alpha: 1, duration: 2.0 }, "-=1.5"); }
    setupMouseTracker() { const style = new PIXI.TextStyle({ fontFamily: 'Consolas', fontSize: 10, fill: this.params.accentColor, dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1 }); this.mouseText = new PIXI.Text('[X: 0000, Y: 0000]', style); this.overlayLayer.addChild(this.mouseText); }

    update(delta) {
        if (!this.isActive) return;
        this.timer += 0.02;

        const cx = this.app.screen.width / 2;
        const cy = this.app.screen.height / 2;
        const mouseX = (this.mouse.x - cx);
        const mouseY = (this.mouse.y - cy);

        // 视差
        this.shadowLayer.x = -mouseX * 0.02; this.shadowLayer.y = -mouseY * 0.02;
        this.cliffLayer.x = -mouseX * 0.03;
        this.uiLayer.x = cx - mouseX * 0.05; this.uiLayer.y = cy - mouseY * 0.05;
        this.decorLayer.x = -mouseX * 0.01; this.decorLayer.y = -mouseY * 0.01;
        this.glowLayer.x = -mouseX * 0.01;
        this.overlayLayer.x = cx - mouseX * 0.1;
        this.overlayLayer.y = cy - mouseY * 0.1;

        this.drawRipples();
        this.drawLockUI();

        // 状态机
        if (!this.hasRescued) {
            this.charContainer.y += this.params.fallSpeed;
            if (this.charContainer.y > this.app.screen.height + 300) this.charContainer.y = -300;
            this.charContainer.x = cx - mouseX * 0.04;

            // 距离判定
            const charGlobalX = this.charContainer.x;
            const charGlobalY = this.charContainer.y;
            const dist = Math.hypot(this.mouse.x - charGlobalX, this.mouse.y - charGlobalY);
            const isHovering = dist < 120;

            if (this.hintText) {
                if (this.isMouseDown && isHovering) {
                    this.hintText.text = ">>> SYNCING <<<";
                    this.hintText.style.fill = 0xFFFFFF;
                } else if (isHovering) {
                    this.hintText.text = "[ HOLD LMB ]";
                    this.hintText.style.fill = this.params.accentColor;
                } else {
                    this.hintText.text = "! TARGET LOST !";
                    this.hintText.style.fill = 0xFF5555;
                }
            }

            if (this.isMouseDown && isHovering) {
                this.saveProgress += 0.015;
                this.targetBox.x = (Math.random()-0.5) * 5;
                this.targetBox.y = (Math.random()-0.5) * 5;
            } else {
                this.saveProgress -= 0.03;
                this.targetBox.x = 0;
                this.targetBox.y = 0;
            }
            this.saveProgress = Math.max(0, Math.min(1, this.saveProgress));

            if (this.saveProgress >= 1) this.triggerRescue();

        } else {
            // 救援成功：无下坠，仅视差
            this.charContainer.x = cx - mouseX * 0.04;
        }

        this.block1.x = this.params.b1X; this.block1.y = this.params.b1Y; this.block1.rotation = this.params.b1Rot; this.block1.alpha = this.params.b1Alpha;
        this.block2.x = this.params.b2X; this.block2.y = this.params.b2Y; this.block2.rotation = this.params.b2Rot; this.block2.alpha = this.params.b2Alpha;
        if (this.formulaContainer) { this.formulaContainer.x = this.params.formulaX; this.formulaContainer.y = this.params.formulaY; }

        const now = Date.now() - this.startTime;
        const ms = Math.floor((now % 1000) / 10).toString().padStart(2, '0');
        const ss = Math.floor((now / 1000) % 60).toString().padStart(2, '0');
        const mm = Math.floor((now / 60000) % 60).toString().padStart(2, '0');
        if (this.recText) this.recText.text = this.hasRescued ? "SAFE MODE" : `REC [${mm}:${ss}:${ms}]`;

        const relativeMouseX = this.mouse.x - this.overlayLayer.x;
        const relativeMouseY = this.mouse.y - this.overlayLayer.y;
        this.mouseText.text = `[X:${Math.floor(this.mouse.x).toString().padStart(4, '0')} Y:${Math.floor(this.mouse.y).toString().padStart(4, '0')}]`;
        this.mouseText.position.set(relativeMouseX + 15, relativeMouseY + 15);

        const g = this.lineGraphics;
        g.clear();
        g.lineStyle(1, this.params.accentColor, 0.6);
        const targetX = this.charContainer.x - this.overlayLayer.x;
        const targetY = this.charContainer.y - this.overlayLayer.y;
        const boxSize = 180;
        const half = boxSize / 2;
        const corners = [ { x: targetX - half, y: targetY - half }, { x: targetX + half, y: targetY - half }, { x: targetX + half, y: targetY + half }, { x: targetX - half, y: targetY + half } ];

        this.labels.forEach(label => {
            label.obj.x = targetX + label.offsetX; label.obj.y = targetY + label.offsetY;
            const startX = label.obj.x + (label.offsetX > 0 ? 0 : 100); const startY = label.obj.y + 10;
            let closest = corners[0]; let minDist = 999999;
            corners.forEach(c => { const d = (startX-c.x)**2 + (startY-c.y)**2; if(d < minDist) { minDist = d; closest = c; } });
            g.moveTo(startX, startY); g.lineTo(closest.x, closest.y);
            g.beginFill(this.params.accentColor); g.drawCircle(closest.x, closest.y, 2); g.endFill();
        });

        g.lineStyle(1, this.params.accentColor, 0.5);
        this.rulerTexts.forEach(text => {
            const textAbsY = this.uiLayer.y + text.userData.initialY;
            const charAbsY = this.charContainer.y;
            if (Math.abs(textAbsY - charAbsY) < 30) {
                text.scale.set(1.5); text.style.fill = this.params.accentColor;
                const startX = (this.uiLayer.x + text.userData.baseX) - this.overlayLayer.x;
                const startY = (this.uiLayer.y + text.userData.initialY) - this.overlayLayer.y;
                g.moveTo(startX, startY); g.lineTo(targetX + half, targetY);
            } else {
                text.scale.set(1.0); text.style.fill = this.params.textColor;
            }
        });
    }

    destroy() {
        this.isActive = false;
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mouseup', this.onMouseUp);
        if (this.gui) this.gui.destroy();
        this.app.stage.removeChild(this.container);
        this.container.destroy({ children: true });
    }
}