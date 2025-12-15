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
            parallaxStrength: 0.05, shakeIntensity: 0.1,
            lightAlpha: 0.2, lightAngle: 0.5, lightMoveSpeed: 0.5,
            bloomStrength: 0.1, noiseStrength: 0.08, rgbSplit: 3.0,
            particleSpeed: 0.2,
            gamma: 1.0, contrast: 1.0, saturation: 1.0, brightness: 1.0, red: 1.0, green: 1.0, blue: 1.0,
        };
        this.timer = 0;
    }

    async init() {
        const bgTexture = PIXI.Assets.get('/bg.jpg');
        const charTexture = PIXI.Assets.get('/char.png');

        this.setupVisuals(bgTexture, charTexture);
        this.setupInput();
        this.setupGUI();

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

        this.effectLayer = new PIXI.Container();
        this.effectLayer.pivot.set(cx, cy);
        this.effectLayer.position.set(cx, cy);
        this.effectLayer.zIndex = 10;
        this.container.addChild(this.effectLayer);

        this.adjustmentFilter = new AdjustmentFilter({
            gamma: this.params.gamma, contrast: this.params.contrast, saturation: this.params.saturation, brightness: this.params.brightness,
            red: this.params.red, green: this.params.green, blue: this.params.blue,
        });
        this.bloomFilter = new AdvancedBloomFilter({ bloomScale: this.params.bloomStrength, blur: 8, threshold: 0.4 });
        this.rgbSplitFilter = new RGBSplitFilter([0, 0], [0, 0], [0, 0]);
        const noiseFilter = new PIXI.NoiseFilter(this.params.noiseStrength);

        this.effectLayer.filters = [this.adjustmentFilter, this.bloomFilter, this.rgbSplitFilter, noiseFilter];

        // 1. 背景
        this.bg = new PIXI.Sprite(bgTexture);
        this.bg.anchor.set(0.5);
        this.bg.x = cx + this.params.bgX;
        this.bg.y = cy + this.params.bgY;
        this.bg.scale.set(this.params.bgScale);
        this.effectLayer.addChild(this.bg);

        // 2. 氛围
        this.atmosphere = this.createGradientSprite(w, h);
        this.atmosphere.x = cx; this.atmosphere.y = cy;
        this.effectLayer.addChild(this.atmosphere);

        // 3. 光束
        this.setupLightBeams(w, h);

        // 4. 光斑
        this.setupLensEffects(w, h);

        // 5. 角色 (交互)
        this.charSprite = new PIXI.Sprite(charTexture);
        this.charSprite.anchor.set(0.5);
        this.charSprite.x = cx + this.params.charX;
        this.charSprite.y = cy + this.params.charY + 150;
        this.charSprite.scale.set(this.params.charScale);
        this.charSprite.alpha = 0;

        this.charSprite.eventMode = 'static';
        this.charSprite.cursor = 'none'; // 隐藏默认鼠标

        // 交互逻辑
        this.charSprite.on('pointertap', () => {
            if (this.onCharClick) this.onCharClick();
        });

        this.charSprite.on('pointerover', () => {
            // ✨ 修改：移除了发光滤镜代码

            // 显示 "DIVE IN" 文字
            gsap.to(this.tooltip, { alpha: 1, duration: 0.3, ease: "power2.out" });
            gsap.fromTo(this.tooltip.scale, { x: 0.5, y: 0.5 }, { x: 1, y: 1, duration: 0.3 });
        });

        this.charSprite.on('pointerout', () => {
            // 隐藏文字
            gsap.to(this.tooltip, { alpha: 0, duration: 0.3 });
        });

        this.effectLayer.addChild(this.charSprite);

        // 6. 粒子
        this.setupParticles();

        // ✨✨✨ 7. 鼠标跟随提示文字 (Tooltip) ✨✨✨
        const tooltipStyle = new PIXI.TextStyle({
            fontFamily: ['"Times New Roman"', 'serif'],
            fontSize: 16, // 稍微加大一点
            fill: 0xFFFFFF,
            letterSpacing: 3,
            dropShadow: true,
            dropShadowColor: 0x000000,
            dropShadowBlur: 8,
        });
        this.tooltip = new PIXI.Text('DIVE IN', tooltipStyle);
        this.tooltip.anchor.set(0.5, 0.5); // ✨ 中心对齐，直接替代鼠标中心
        this.tooltip.alpha = 0;
        this.tooltip.zIndex = 999;
        this.container.addChild(this.tooltip);
    }

    setupLightBeams(w, h) {
        this.beams = [];
        this.lightContainer = new PIXI.Container();
        this.lightContainer.blendMode = PIXI.BLEND_MODES.ADD;
        this.lightContainer.filters = [new PIXI.filters.BlurFilter(20, 4)];
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
        this.effectLayer.addChild(this.lightContainer);
    }

    setupLensEffects(w, h) {
        this.bokehContainer = new PIXI.Container();
        this.bokehContainer.blendMode = PIXI.BLEND_MODES.ADD; this.bokehContainer.alpha = 0;
        const circleTex = this.createCircleTexture();
        this.bokehs = [];
        for(let i=0; i<10; i++) {
            const b = new PIXI.Sprite(circleTex);
            b.anchor.set(0.5); b.x = (Math.random() - 0.5) * w; b.y = (Math.random() - 0.5) * h;
            b.scale.set(0.5 + Math.random()); b.alpha = 0.05 + Math.random() * 0.1; b.tint = Math.random() > 0.5 ? 0xFFF0DD : 0xDDFFFF;
            b.userData = { parallax: 0.02 + Math.random() * 0.05 };
            this.bokehs.push(b); this.bokehContainer.addChild(b);
        }
        this.effectLayer.addChild(this.bokehContainer);
    }

    setupParticles() {
        this.petals = [];
        this.particlesContainer = new PIXI.Container();
        this.particlesContainer.alpha = 0;
        this.effectLayer.addChild(this.particlesContainer);
        const petalTex = this.createPetalTexture();
        for(let i=0; i<50; i++) {
            const p = new PIXI.Sprite(petalTex);
            this.resetPetal(p, true);
            this.petals.push(p);
            this.particlesContainer.addChild(p);
        }
    }

    playIntro() {
        const tl = gsap.timeline();
        const cy = this.app.screen.height / 2;

        tl.to([this.bg, this.atmosphere, this.lightContainer, this.bokehContainer], { alpha: 1, duration: 1.5 })
            .to(this.charSprite, {
                alpha: 1, y: cy + this.params.charY, duration: 2.0, ease: "power3.out"
            }, "-=1.0")
            .to(this.particlesContainer, { alpha: 1, duration: 2.0 }, "-=1.5");

        tl.fromTo(this.params, { rgbSplit: 15.0 }, { rgbSplit: 3.0, duration: 3.0, ease: "power4.out" }, "-=2.0");
    }

    update(delta) {
        if (!this.isActive) return;
        this.timer += 0.02;
        const cx = this.app.screen.width / 2;
        const cy = this.app.screen.height / 2;
        const parallaxX = (cx - this.mouse.x) * this.params.parallaxStrength;
        const parallaxY = (cy - this.mouse.y) * this.params.parallaxStrength;

        // 背景
        this.bg.x += (cx + this.params.bgX + parallaxX - this.bg.x) * 0.1;
        this.bg.y += (cy + this.params.bgY + parallaxY - this.bg.y) * 0.1;
        this.bg.scale.set(this.params.bgScale);

        // 角色
        if (this.charSprite.alpha > 0.9) {
            const targetCharX = cx + this.params.charX + (parallaxX * 0.5);
            const targetCharY = cy + this.params.charY + (parallaxY * 0.5);
            this.charSprite.x += (targetCharX - this.charSprite.x) * 0.1;
            this.charSprite.y += (targetCharY - this.charSprite.y) * 0.1;
            this.charSprite.scale.set(this.params.charScale);
        }

        // ✨✨✨ 提示文字跟随鼠标 (硬跟随，无延迟) ✨✨✨
        if (this.tooltip.alpha > 0.01) {
            this.tooltip.x = this.mouse.x;
            this.tooltip.y = this.mouse.y;
        }

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
        this.effectLayer.pivot.set(cx + shakeX, cy + shakeY);

        const distX = (this.mouse.x - cx) / cx; const distY = (this.mouse.y - cy) / cy;
        const splitAmount = this.params.rgbSplit;
        this.rgbSplitFilter.red = [-distX * splitAmount, -distY * splitAmount];
        this.rgbSplitFilter.blue = [distX * splitAmount, distY * splitAmount];

        this.petals.forEach(p => {
            p.x += p.vx * this.params.particleSpeed; p.y += p.vy * this.params.particleSpeed; p.rotation += p.vr;
            if (p.x > this.app.screen.width + 50 || p.y < -50) this.resetPetal(p, false);
        });
    }

    destroy() {
        this.isActive = false;
        window.removeEventListener('mousemove', this.onMouseMove);
        if(this.gui) this.gui.destroy();
        this.app.stage.removeChild(this.container);
        this.container.destroy({ children: true });
    }

    // 辅助函数保持不变
    createPetalTexture() { const gr = new PIXI.Graphics(); gr.beginFill(0xFFFFFF); gr.drawEllipse(0,0,8,4); gr.endFill(); return this.app.renderer.generateTexture(gr); }
    createCircleTexture() { const gr = new PIXI.Graphics(); gr.beginFill(0xFFFFFF); gr.drawCircle(0,0,50); gr.endFill(); return this.app.renderer.generateTexture(gr); }
    createLightBeam(w, h) { const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); const grd = ctx.createLinearGradient(w/2, 0, w/2, h); grd.addColorStop(0, "rgba(255, 255, 255, 0.8)"); grd.addColorStop(1, "rgba(255, 255, 255, 0)"); ctx.fillStyle = grd; ctx.beginPath(); ctx.moveTo(w*0.2, 0); ctx.lineTo(w*0.8, 0); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill(); return new PIXI.Sprite(PIXI.Texture.from(canvas)); }
    createGradientSprite(w, h) { const c = document.createElement('canvas'); c.width=w; c.height=h; const ctx = c.getContext('2d'); const g = ctx.createLinearGradient(0,0,0,h); g.addColorStop(0, 'rgba(255,230,200,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle=g; ctx.fillRect(0,0,w,h); const s = new PIXI.Sprite(PIXI.Texture.from(c)); s.blendMode = PIXI.BLEND_MODES.ADD; s.anchor.set(0.5); return s; }
    resetPetal(p, randomize) { const w = this.app.screen.width; const h = this.app.screen.height; if (randomize) { p.x = Math.random() * w; p.y = Math.random() * h; } else { p.x = Math.random() * (w * 0.5) - 100; p.y = h + Math.random() * 100; } p.scale.set(0.5 + Math.random()); p.rotation = Math.random() * Math.PI * 2; p.alpha = 0.6 + Math.random() * 0.4; p.tint = 0xFFEEEE; p.vx = 1 + Math.random() * 2; p.vy = -1 - Math.random() * 2; p.vr = (Math.random() - 0.5) * 0.05; }
}