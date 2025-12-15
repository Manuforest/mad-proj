import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { AdvancedBloomFilter, RGBSplitFilter, AdjustmentFilter } from 'pixi-filters';

export class Scene01 {
    constructor(app) {
        this.app = app;
        this.container = new PIXI.Container();
        this.container.sortableChildren = true;
        this.isActive = false;

        this.onCharClick = null;

        this.mouse = { x: app.screen.width / 2, y: app.screen.height / 2 };

        this.params = {
            bgX: -267, bgY: 500, bgScale: 2.13,
            charX: -9, charY: 151, charScale: 0.52,

            parallaxStrength: 0.05,
            shakeIntensity: 0.1,

            // 光效
            lightAlpha: 0.3,
            lightAngle: 0.5,
            lightMoveSpeed: 0.5,

            // 后期
            bloomStrength: 0.1, noiseStrength: 0.08, rgbSplit: 3.0,

            // 粒子
            particleSpeed: 0.2,
            windSpeedX: 1.5,
            windSpeedY: -0.2,

            // 调色
            gamma: 1.02, contrast: 1, saturation: 1.0, brightness: 1.0,
            red: 1.0, green: 1.0, blue: 1.01,
        };
        this.timer = 0;
    }

    async init() {
        const bgTexture = PIXI.Assets.get('/bg.jpg');
        const charTexture = PIXI.Assets.get('/char.png');

        this.setupVisuals(bgTexture, charTexture);
        this.setupInput();
        this.isActive = true;
    }

    setupInput() {
        this.onMouseMove = (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        };
        window.addEventListener('mousemove', this.onMouseMove);
    }

    setupVisuals(bgTexture, charTexture) {
        const { width: w, height: h } = this.app.screen;
        const cx = w / 2;
        const cy = h / 2;

        // ✨✨✨ 1. 世界容器 (World Container) ✨✨✨
        // 包含所有受摄像机抖动、色调、噪点影响的元素
        this.worldContainer = new PIXI.Container();
        this.worldContainer.pivot.set(cx, cy);
        this.worldContainer.position.set(cx, cy);
        this.container.addChild(this.worldContainer);

        // 全局滤镜 (色调 + 色散 + 噪点) -> 应用于整个世界
        this.adjustmentFilter = new AdjustmentFilter({
            gamma: this.params.gamma, contrast: this.params.contrast, saturation: this.params.saturation, brightness: this.params.brightness,
            red: this.params.red, green: this.params.green, blue: this.params.blue,
        });
        this.rgbSplitFilter = new RGBSplitFilter([0, 0], [0, 0], [0, 0]);
        const noiseFilter = new PIXI.NoiseFilter(this.params.noiseStrength);

        this.worldContainer.filters = [this.adjustmentFilter, this.rgbSplitFilter, noiseFilter];

        // --- 层级 A: 背景 (不发光) ---
        this.bg = new PIXI.Sprite(bgTexture);
        this.bg.anchor.set(0.5);
        this.bg.x = cx + this.params.bgX;
        this.bg.y = cy + this.params.bgY;
        this.bg.scale.set(this.params.bgScale);
        this.worldContainer.addChild(this.bg);

        // --- 层级 B: 后景雾气 (不发光) ---
        // 使用普通混合模式，看起来更像灰尘/水汽
        this.fogRear = this.createFogLayer(w, h, 1);
        this.worldContainer.addChild(this.fogRear);

        // --- 层级 C: 主光效层 (Main Layer) ---
        // ✨ 这里面的东西会发光 (Bloom)
        this.mainLayer = new PIXI.Container();
        // 仅对这一层应用 Bloom，避免背景和雾气过曝
        this.bloomFilter = new AdvancedBloomFilter({ bloomScale: this.params.bloomStrength, blur: 8, threshold: 0.4 });
        this.mainLayer.filters = [this.bloomFilter];
        this.worldContainer.addChild(this.mainLayer);

        // C-1. 氛围光
        this.atmosphere = this.createGradientSprite(w, h);
        this.atmosphere.x = cx; this.atmosphere.y = cy;
        this.mainLayer.addChild(this.atmosphere);

        // C-2. 光束 & 光斑
        this.setupLightBeams(w, h); // 会加到 mainLayer
        this.setupLensEffects(w, h); // 会加到 mainLayer

        // C-3. 角色
        this.charSprite = new PIXI.Sprite(charTexture);
        this.charSprite.anchor.set(0.5);
        this.charSprite.x = cx + this.params.charX;
        this.charSprite.y = cy + this.params.charY + 150;
        this.charSprite.scale.set(this.params.charScale);
        this.charSprite.alpha = 0;
        this.charSprite.eventMode = 'static';
        this.charSprite.cursor = 'none';
        this.charSprite.on('pointertap', () => { if (this.onCharClick) this.onCharClick(); });
        this.charSprite.on('pointerover', () => {
            gsap.to(this.tooltip, { alpha: 1, duration: 0.3, ease: "power2.out" });
            gsap.fromTo(this.tooltip.scale, { x: 0.5, y: 0.5 }, { x: 1, y: 1, duration: 0.3 });
        });
        this.charSprite.on('pointerout', () => {
            gsap.to(this.tooltip, { alpha: 0, duration: 0.3 });
        });
        this.mainLayer.addChild(this.charSprite);

        // C-4. 粒子
        this.setupParticles(); // 会加到 mainLayer

        // --- 层级 D: 前景雾气 (不发光) ---
        this.fogFront = this.createFogLayer(w, h, 0.2);
        this.worldContainer.addChild(this.fogFront);

        // --- Tooltip (最顶层) ---
        const tooltipStyle = new PIXI.TextStyle({
            fontFamily: ['"Times New Roman"', 'serif'],
            fontSize: 16, fill: 0xFFFFFF, letterSpacing: 3, fontStyle: 'italic',
            dropShadow: true, dropShadowColor: 0xFFFFFF, dropShadowBlur: 8, padding: 10
        });
        this.tooltip = new PIXI.Text('DIVE IN', tooltipStyle);
        this.tooltip.anchor.set(0.5, 0.5);
        this.tooltip.alpha = 0;
        this.tooltip.zIndex = 999;
        this.container.addChild(this.tooltip);
    }

    // ✨✨✨ 修复版：完美无缝雾气生成 ✨✨✨
    createSeamlessCloudTexture() {
        const texW = 2048; // 纹理足够宽
        const texH = 512;

        const gr = new PIXI.Graphics();

        // 数量增加，单体变淡
        for(let i=0; i<60; i++) {
            const x = Math.random() * texW;
            const y = Math.random() * texH;
            const r = 60 + Math.random() * 100;

            // ✨ 核心算法：边缘消隐
            // 计算 x 在 0~1 之间的位置
            const normalizedX = x / texW;
            // 使用正弦波：在 0 和 1 (两端) 时为 0，在 0.5 (中间) 时为 1
            const fade = Math.sin(normalizedX * Math.PI);

            // 将透明度乘以 fade 系数
            // 基础透明度 0.05 (很淡)
            gr.beginFill(0xFFFFFF, 0.05 * fade);
            gr.drawCircle(x, y, r);
            gr.endFill();
        }

        const blur = new PIXI.BlurFilter(60); // 强力羽化
        gr.filters = [blur];

        return this.app.renderer.generateTexture(gr);
    }

    createFogLayer(w, h, alpha) {
        const cloudTex = this.createSeamlessCloudTexture();
        const tilingSprite = new PIXI.TilingSprite(cloudTex, w, h);

        tilingSprite.alpha = alpha;
        // ✨ 改为 NORMAL 混合模式 (看起来像烟雾，而不是光)
        tilingSprite.blendMode = PIXI.BLEND_MODES.NORMAL;
        tilingSprite.tileScale.set(1.5);

        tilingSprite.userData = { speed: 0.2 + Math.random() * 0.3 };
        return tilingSprite;
    }

    // --- 光效设置 (修改为添加到 mainLayer) ---
    setupLightBeams(w, h) {
        this.beams = [];
        this.lightContainer = new PIXI.Container();
        this.lightContainer.blendMode = PIXI.BLEND_MODES.ADD;
        this.lightContainer.filters = [new PIXI.BlurFilter(20)];
        this.lightContainer.x = w / 2; this.lightContainer.y = -100;
        this.lightContainer.alpha = 0;
        const offsets = [-w * 0.3, 0, w * 0.3];
        for(let i=0; i<3; i++) {
            const beamW = 200 + Math.random() * 300;
            const beam = this.createLightBeam(beamW, h * 1.5);
            beam.x = offsets[i] + (Math.random() - 0.5) * 200; beam.pivot.y = 0;
            beam.userData = { speed: 0.005 + Math.random() * 0.005, phase: Math.random() * 10 };
            this.beams.push(beam); this.lightContainer.addChild(beam);
        }
        this.mainLayer.addChild(this.lightContainer); // Add to mainLayer
    }

    setupLensEffects(w, h) {
        this.bokehContainer = new PIXI.Container();
        this.bokehContainer.blendMode = PIXI.BLEND_MODES.ADD; this.bokehContainer.alpha = 0;
        const circleTex = this.createCircleTexture(); this.bokehs = [];
        for(let i=0; i<10; i++) {
            const b = new PIXI.Sprite(circleTex);
            b.anchor.set(0.5); b.x = (Math.random() - 0.5) * w; b.y = (Math.random() - 0.5) * h;
            b.scale.set(0.5 + Math.random()); b.alpha = 0.05 + Math.random() * 0.1; b.tint = Math.random() > 0.5 ? 0xFFF0DD : 0xDDFFFF;
            b.userData = { parallax: 0.02 + Math.random() * 0.05 };
            this.bokehs.push(b); this.bokehContainer.addChild(b);
        }
        this.mainLayer.addChild(this.bokehContainer); // Add to mainLayer
    }

    setupParticles() {
        this.petals = [];
        this.particlesContainer = new PIXI.Container();
        this.particlesContainer.alpha = 0;
        this.mainLayer.addChild(this.particlesContainer); // Add to mainLayer
        const petalTex = this.createPetalTexture();
        for(let i=0; i<80; i++) {
            const p = new PIXI.Sprite(petalTex);
            this.resetPetal(p, true);
            this.petals.push(p);
            this.particlesContainer.addChild(p);
        }
    }

    playIntro() {
        const tl = gsap.timeline();
        const cy = this.app.screen.height / 2;

        tl.to([this.bg, this.atmosphere, this.lightContainer, this.bokehContainer, this.fogRear, this.fogFront], { alpha: 1, duration: 1.5 })
            .to(this.charSprite, {
                alpha: 1, y: cy + this.params.charY, duration: 2.0, ease: "power3.out"
            }, "-=1.0")
            .to(this.particlesContainer, { alpha: 1, duration: 2.0 }, "-=1.5");

        tl.fromTo(this.params, { rgbSplit: 15.0 }, { rgbSplit: 3.0, duration: 3.0, ease: "power4.out" }, "-=2.0");
    }

    update(delta) {
        if (!this.isActive) return;
        this.timer += 0.02;
        const w = this.app.screen.width;
        const h = this.app.screen.height; // ✅ 确保 h 被定义
        const cx = w / 2;
        const cy = h / 2;

        const parallaxX = (cx - this.mouse.x) * this.params.parallaxStrength;
        const parallaxY = (cy - this.mouse.y) * this.params.parallaxStrength;

        // 背景视差
        this.bg.x += (cx + this.params.bgX + parallaxX - this.bg.x) * 0.1;
        this.bg.y += (cy + this.params.bgY + parallaxY - this.bg.y) * 0.1;
        this.bg.scale.set(this.params.bgScale);

        // 雾气滚动 (TilingSprite)
        this.fogRear.tilePosition.x -= this.fogRear.userData.speed;
        this.fogFront.tilePosition.x -= this.fogFront.userData.speed * 1.5;

        // 角色
        if (this.charSprite.alpha > 0.9) {
            const targetCharX = cx + this.params.charX + (parallaxX * 0.5);
            const targetCharY = cy + this.params.charY + (parallaxY * 0.5);
            this.charSprite.x += (targetCharX - this.charSprite.x) * 0.1;
            this.charSprite.y += (targetCharY - this.charSprite.y) * 0.1;
            this.charSprite.scale.set(this.params.charScale);
        }

        if (this.tooltip.alpha > 0.01) {
            this.tooltip.x = this.mouse.x;
            this.tooltip.y = this.mouse.y;
        }

        // 光效
        this.beams.forEach((beam) => {
            beam.alpha = this.params.lightAlpha;
            beam.rotation = this.params.lightAngle + Math.sin(this.timer * beam.userData.speed + beam.userData.phase) * 0.1 * this.params.lightMoveSpeed;
        });
        this.bokehs.forEach((b) => {
            const bx = (cx - this.mouse.x) * b.userData.parallax * 2.0; const by = (cy - this.mouse.y) * b.userData.parallax * 2.0;
            b.position.x += (bx - b.position.x) * 0.05; b.position.y += (by - b.position.y) * 0.05;
        });
        const shakeX = Math.sin(this.timer * 2) * this.params.shakeIntensity;
        const shakeY = Math.cos(this.timer * 1.5) * this.params.shakeIntensity;

        // 震动应用到 worldContainer
        this.worldContainer.pivot.set(cx + shakeX, cy + shakeY);

        const distX = (this.mouse.x - cx) / cx; const distY = (this.mouse.y - cy) / cy;
        const splitAmount = this.params.rgbSplit;
        this.rgbSplitFilter.red = [-distX * splitAmount, -distY * splitAmount];
        this.rgbSplitFilter.blue = [distX * splitAmount, distY * splitAmount];

        this.petals.forEach(p => {
            p.x += p.vx * 0.5 + this.params.windSpeedX;
            p.y += p.vy * 0.5 + this.params.windSpeedY;
            p.rotation += p.vr;
            if (p.x > w + 50) p.x = -50;
            if (p.y > h + 50) p.y = -50;
            if (p.y < -50) p.y = h + 50;
        });
    }

    destroy() {
        this.isActive = false;
        window.removeEventListener('mousemove', this.onMouseMove);
        this.app.stage.removeChild(this.container);
        this.container.destroy({ children: true });
    }

    // 绘图辅助函数
    createLightBeam(w, h) { const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); const grd = ctx.createLinearGradient(w/2, 0, w/2, h); grd.addColorStop(0, "rgba(255, 255, 255, 0.8)"); grd.addColorStop(1, "rgba(255, 255, 255, 0)"); ctx.fillStyle = grd; ctx.beginPath(); ctx.moveTo(w*0.2, 0); ctx.lineTo(w*0.8, 0); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill(); return new PIXI.Sprite(PIXI.Texture.from(canvas)); }
    createCircleTexture() { const gr = new PIXI.Graphics(); gr.beginFill(0xFFFFFF); gr.drawCircle(0,0,50); gr.endFill(); return this.app.renderer.generateTexture(gr); }
    createPetalTexture() { const gr = new PIXI.Graphics(); gr.beginFill(0xFFFFFF); gr.drawEllipse(0,0,8,4); gr.endFill(); return this.app.renderer.generateTexture(gr); }
    createGradientSprite(w, h) { const c = document.createElement('canvas'); c.width=w; c.height=h; const ctx = c.getContext('2d'); const g = ctx.createLinearGradient(0,0,0,h); g.addColorStop(0, 'rgba(255,230,200,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle=g; ctx.fillRect(0,0,w,h); const s = new PIXI.Sprite(PIXI.Texture.from(c)); s.blendMode = PIXI.BLEND_MODES.ADD; s.anchor.set(0.5); return s; }
    resetPetal(p, randomize) { const w = this.app.screen.width; const h = this.app.screen.height; if (randomize) { p.x = Math.random() * w; p.y = Math.random() * h; } else { p.x = -50; p.y = Math.random() * h; } p.scale.set(0.5 + Math.random()); p.rotation = Math.random() * Math.PI * 2; p.alpha = 0.6 + Math.random() * 0.4; p.tint = 0xFFEEEE; p.vx = 1 + Math.random() * 2; p.vy = (Math.random() - 0.5) * 1; p.vr = (Math.random() - 0.5) * 0.05; }
}