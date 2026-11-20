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
    this.sprintToggle = false;
    this.lookDelta = { x: 0, y: 0 };
    this.zoomDelta = 0;
    this.actions = { jump: false, interact: false, roofToggle: false, cameraCycle: false, menu: false };
    this.dragging = false;
    this.lastPointer = { x: 0, y: 0 };
    this.enabled = true;

    this._bindKeyboard();
    this._bindPointer();
    if (options.joystickBase && options.joystickKnob) {
      this._bindJoystick(options.joystickBase, options.joystickKnob);
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
      this.dragging = true;
      this.lastPointer = { x: e.clientX, y: e.clientY };
    };
    this._onPointerMove = (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.lookDelta.x += dx;
      this.lookDelta.y += dy;
      this.lastPointer = { x: e.clientX, y: e.clientY };
    };
    this._onPointerUp = () => { this.dragging = false; };
    this._onWheel = (e) => {
      if (e.target !== this.canvas) return;
      this.zoomDelta += Math.sign(e.deltaY) * 0.65;
    };

    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: true });
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
    let x = this.joyVec.x;
    let z = this.joyVec.y;
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
