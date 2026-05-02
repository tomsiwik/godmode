// Pixel-shimmer web component. Source: https://github.com/hexagoncircle/pixel-canvas (MIT, Ryan Mulligan).
// Slight tweaks: register() guards against double-registration so HMR
// doesn't throw `customElements.define` "already defined" errors.

class Pixel {
  width: number;
  height: number;
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  color: string;
  speed: number;
  size = 0;
  sizeStep = Math.random() * 0.4;
  minSize = 0.5;
  maxSizeInteger = 2;
  maxSize: number;
  delay: number;
  counter = 0;
  counterStep: number;
  isIdle = false;
  isReverse = false;
  isShimmer = false;

  constructor(
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    speed: number,
    delay: number,
  ) {
    this.width = canvas.width;
    this.height = canvas.height;
    this.ctx = context;
    this.x = x;
    this.y = y;
    this.color = color;
    this.speed = this.getRandomValue(0.1, 0.9) * speed;
    this.maxSize = this.getRandomValue(this.minSize, this.maxSizeInteger);
    this.delay = delay;
    this.counterStep = Math.random() * 4 + (this.width + this.height) * 0.01;
  }

  getRandomValue(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  draw() {
    const centerOffset = this.maxSizeInteger * 0.5 - this.size * 0.5;
    this.ctx.fillStyle = this.color;
    this.ctx.fillRect(this.x + centerOffset, this.y + centerOffset, this.size, this.size);
  }

  appear() {
    this.isIdle = false;
    if (this.counter <= this.delay) {
      this.counter += this.counterStep;
      return;
    }
    if (this.size >= this.maxSize) this.isShimmer = true;
    if (this.isShimmer) this.shimmer();
    else this.size += this.sizeStep;
    this.draw();
  }

  disappear() {
    this.isShimmer = false;
    this.counter = 0;
    if (this.size <= 0) {
      this.isIdle = true;
      return;
    }
    this.size -= 0.1;
    this.draw();
  }

  shimmer() {
    if (this.size >= this.maxSize) this.isReverse = true;
    else if (this.size <= this.minSize) this.isReverse = false;
    if (this.isReverse) this.size -= this.speed;
    else this.size += this.speed;
  }
}

class PixelCanvas extends HTMLElement {
  static register(tag = 'pixel-canvas') {
    if (typeof window === 'undefined' || !('customElements' in window)) return;
    if (customElements.get(tag)) return; // idempotent for HMR
    customElements.define(tag, this);
  }

  static css = `
    :host {
      display: grid;
      inline-size: 100%;
      block-size: 100%;
      overflow: hidden;
    }
  `;

  private _parent!: ParentNode & EventTarget;
  private shadowroot!: ShadowRoot;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private timeInterval!: number;
  private timePrevious!: number;
  private reducedMotion!: boolean;
  private pixels: Pixel[] = [];
  private animation: number | undefined;
  private resizeObserver!: ResizeObserver;

  get colors(): string[] {
    return this.dataset.colors?.split(',') ?? ['#f8fafc', '#f1f5f9', '#cbd5e1'];
  }

  get gap(): number {
    const v = Number(this.dataset.gap ?? 5);
    return Math.min(50, Math.max(4, v));
  }

  get speed(): number {
    const raw = Number(this.dataset.speed ?? 35);
    const throttle = 0.001;
    if (raw <= 0 || this.reducedMotion) return 0;
    if (raw >= 100) return 100 * throttle;
    return raw * throttle;
  }

  get noFocus(): boolean {
    return this.hasAttribute('data-no-focus');
  }

  connectedCallback() {
    const canvas = document.createElement('canvas');
    const sheet = new CSSStyleSheet();

    this._parent = this.parentNode as ParentNode & EventTarget;
    this.shadowroot = this.attachShadow({ mode: 'open' });
    sheet.replaceSync(PixelCanvas.css);
    this.shadowroot.adoptedStyleSheets = [sheet];
    this.shadowroot.append(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    this.timeInterval = 1000 / 60;
    this.timePrevious = performance.now();
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.init();
    this.resizeObserver = new ResizeObserver(() => this.init());
    this.resizeObserver.observe(this);

    this._parent.addEventListener('mouseenter', this);
    this._parent.addEventListener('mouseleave', this);
    if (!this.noFocus) {
      this._parent.addEventListener('focusin', this);
      this._parent.addEventListener('focusout', this);
    }
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
    this._parent?.removeEventListener('mouseenter', this);
    this._parent?.removeEventListener('mouseleave', this);
    if (!this.noFocus) {
      this._parent?.removeEventListener('focusin', this);
      this._parent?.removeEventListener('focusout', this);
    }
  }

  handleEvent(event: Event) {
    // @ts-expect-error - dynamic dispatch keyed by event type
    this[`on${event.type}`](event);
  }

  onmouseenter() {
    this.handleAnimation('appear');
  }
  onmouseleave() {
    this.handleAnimation('disappear');
  }
  onfocusin(e: FocusEvent) {
    if ((e.currentTarget as Node)?.contains(e.relatedTarget as Node)) return;
    this.handleAnimation('appear');
  }
  onfocusout(e: FocusEvent) {
    if ((e.currentTarget as Node)?.contains(e.relatedTarget as Node)) return;
    this.handleAnimation('disappear');
  }

  handleAnimation(name: 'appear' | 'disappear') {
    if (this.animation) cancelAnimationFrame(this.animation);
    this.animate(name);
  }

  init() {
    const rect = this.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    this.pixels = [];
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.createPixels();
  }

  getDistanceToCanvasCenter(x: number, y: number) {
    const dx = x - this.canvas.width / 2;
    const dy = y - this.canvas.height / 2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  createPixels() {
    for (let x = 0; x < this.canvas.width; x += this.gap) {
      for (let y = 0; y < this.canvas.height; y += this.gap) {
        const color = this.colors[Math.floor(Math.random() * this.colors.length)];
        const delay = this.reducedMotion ? 0 : this.getDistanceToCanvasCenter(x, y);
        this.pixels.push(new Pixel(this.canvas, this.ctx, x, y, color, this.speed, delay));
      }
    }
  }

  animate(fnName: 'appear' | 'disappear') {
    this.animation = requestAnimationFrame(() => this.animate(fnName));
    const timeNow = performance.now();
    const timePassed = timeNow - this.timePrevious;
    if (timePassed < this.timeInterval) return;
    this.timePrevious = timeNow - (timePassed % this.timeInterval);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const pixel of this.pixels) pixel[fnName]();
    if (this.pixels.every((p) => p.isIdle) && this.animation) {
      cancelAnimationFrame(this.animation);
    }
  }
}

PixelCanvas.register();

export {};
