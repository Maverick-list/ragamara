/**
 * NULAR Living Archipelago — InputManager (js/world/InputManager.js)
 * Unified Desktop (WASD/Arrows, Shift, Space, E, R, Esc, Mouse Orbit/Zoom),
 * Mobile (Virtual Joystick, Touch Camera Drag, Action Buttons), and Gamepad input.
 */
export class InputManager {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.keys = new Set();
    this.joyVec = { x: 0, y: 0 };
    this.dpadVec = { x: 0, y: 0 };
    this.sprintToggle = false;
    this.lookDelta = { x: 0, y: 0 };
    this.zoomDelta = 0;
    this.actions = { jump: false, interact: false, roofToggle: false, cameraCycle: false, menu: false };
    this.dragging = false;
    this.lastPointer = { x: 0, y: 0 };
    this.activePointers = new Map();
    this.lastPinchDist = null;
    this.enabled = true;

    this._bindKeyboard();
    this._bindPointer();
    if (options.joystickBase && options.joystickKnob) {
      this._bindJoystick(options.joystickBase, options.joystickKnob);
    }
    if (options.dpadContainer) {
      this._bindDpad(options.dpadContainer);
    }
  }

  _bindKeyboard() {
    this._onKeyDown = (e) => {
      if (!this.enabled) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      const code = e.code;
      this.keys.add(code);
      if (code === 'Space') { this.actions.jump = true; e.preventDefault(); }
      if (code === 'KeyE') this.actions.interact = true;
      if (code === 'KeyR') this.actions.roofToggle = true;
      if (code === 'KeyC') this.actions.cameraCycle = true;
      if (code === 'Escape') this.actions.menu = true;
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  _bindPointer() {
    this._onPointerDown = (e) => {
      if (e.target !== this.canvas) return;
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.activePointers.size === 1) {
        this.dragging = true;
        this.lastPointer = { x: e.clientX, y: e.clientY };
      } else if (this.activePointers.size === 2) {
        const [p1, p2] = Array.from(this.activePointers.values());
        this.lastPinchDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      }
    };

    this._onPointerMove = (e) => {
      if (!this.activePointers.has(e.pointerId)) return;
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.activePointers.size === 1 && this.dragging) {
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        this.lookDelta.x += dx;
        this.lookDelta.y += dy;
        this.lastPointer = { x: e.clientX, y: e.clientY };
      } else if (this.activePointers.size === 2 && this.lastPinchDist !== null) {
        const [p1, p2] = Array.from(this.activePointers.values());
        const curDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const delta = curDist - this.lastPinchDist;
        this.zoomDelta -= delta * 0.04;
        this.lastPinchDist = curDist;
      }
    };

    this._onPointerUp = (e) => {
      this.activePointers.delete(e.pointerId);
      if (this.activePointers.size < 2) {
        this.lastPinchDist = null;
      }
      if (this.activePointers.size === 0) {
        this.dragging = false;
      }
    };

    this._onWheel = (e) => {
      if (e.target !== this.canvas) return;
      this.zoomDelta += Math.sign(e.deltaY) * 0.65;
    };

    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: true });
  }

  _bindDpad(dpadContainer) {
    if (!dpadContainer) return;
    this.dpadState = { up: false, down: false, left: false, right: false };
    const updateDpad = () => {
      let dx = 0, dz = 0;
      if (this.dpadState.up) dz -= 1;
      if (this.dpadState.down) dz += 1;
      if (this.dpadState.left) dx -= 1;
      if (this.dpadState.right) dx += 1;
      this.dpadVec.x = dx;
      this.dpadVec.y = dz;
    };
    const setupBtn = (sel, dir) => {
      const btn = dpadContainer.querySelector(sel);
      if (!btn) return;
      const press = (e) => { e.preventDefault(); this.dpadState[dir] = true; updateDpad(); };
      const release = (e) => { e.preventDefault(); this.dpadState[dir] = false; updateDpad(); };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
    };
    setupBtn('[data-dpad="up"]', 'up');
    setupBtn('[data-dpad="down"]', 'down');
    setupBtn('[data-dpad="left"]', 'left');
    setupBtn('[data-dpad="right"]', 'right');
  }

  _bindJoystick(base, knob) {
    let activeId = null;
    const maxR = 38;
    const updateStick = (clientX, clientY) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxR) { dx = (dx / dist) * maxR; dy = (dy / dist) * maxR; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joyVec.x = dx / maxR;
      this.joyVec.y = dy / maxR;
    };
    base.addEventListener('pointerdown', (e) => {
      activeId = e.pointerId;
      base.setPointerCapture?.(e.pointerId);
      updateStick(e.clientX, e.clientY);
    });
    base.addEventListener('pointermove', (e) => {
      if (e.pointerId !== activeId) return;
      updateStick(e.clientX, e.clientY);
    });
    const reset = (e) => {
      if (e.pointerId !== activeId) return;
      activeId = null;
      knob.style.transform = 'translate(0px, 0px)';
      this.joyVec.x = 0;
      this.joyVec.y = 0;
    };
    base.addEventListener('pointerup', reset);
    base.addEventListener('pointercancel', reset);
  }

  triggerAction(name) {
    if (name in this.actions) this.actions[name] = true;
  }

  getMovementInput() {
    let x = this.joyVec.x + this.dpadVec.x;
    let z = this.joyVec.y + this.dpadVec.y;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;

    // Gamepad support (Standard mapping)
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads?.[0];
    if (gp) {
      if (Math.abs(gp.axes[0]) > 0.18) x += gp.axes[0];
      if (Math.abs(gp.axes[1]) > 0.18) z += gp.axes[1];
      if (Math.abs(gp.axes[2]) > 0.18) this.lookDelta.x += gp.axes[2] * 4;
      if (Math.abs(gp.axes[3]) > 0.18) this.lookDelta.y += gp.axes[3] * 3;
      if (gp.buttons[0]?.pressed) this.actions.jump = true;
      if (gp.buttons[2]?.pressed) this.actions.interact = true;
    }

    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    const sprinting = this.sprintToggle || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    return { x, z, magnitude: Math.min(len, 1), sprinting };
  }

  consumeLookDelta() {
    const out = { x: this.lookDelta.x, y: this.lookDelta.y, zoom: this.zoomDelta };
    this.lookDelta.x = 0;
    this.lookDelta.y = 0;
    this.zoomDelta = 0;
    return out;
  }

  consumeAction(name) {
    const val = Boolean(this.actions[name]);
    this.actions[name] = false;
    return val;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('wheel', this._onWheel);
  }
}
