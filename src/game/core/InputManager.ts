/**
 * InputManager — keyboard + mouse + pointer-lock state.
 * Exposes a polled snapshot plus event-driven callbacks for discrete actions.
 */
export class InputManager {
  private keys: Record<string, boolean> = {};
  private mouseButtons: Record<number, boolean> = {};
  public mouseDX = 0;
  public mouseDY = 0;
  public wheelDelta = 0;
  public locked = false;

  private element: HTMLElement;
  private onLockChange?: (locked: boolean) => void;

  // Edge-triggered action queue (consumed each frame)
  private pressedThisFrame = new Set<string>();
  private mousePressedThisFrame = new Set<number>();

  constructor(element: HTMLElement) {
    this.element = element;
    this.bind();
  }

  private bind(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('wheel', this.handleWheel, { passive: true });
    document.addEventListener('pointerlockchange', this.handleLockChange);
    document.addEventListener('pointerlockerror', this.handleLockError);
    window.addEventListener('blur', this.handleBlur);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('wheel', this.handleWheel);
    document.removeEventListener('pointerlockchange', this.handleLockChange);
    document.removeEventListener('pointerlockerror', this.handleLockError);
    window.removeEventListener('blur', this.handleBlur);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (!this.keys[code]) this.pressedThisFrame.add(code);
    this.keys[code] = true;
    // Prevent space scroll, etc.
    if (
      code === 'Space' ||
      code === 'Tab' ||
      (code.startsWith('Arrow') && this.locked)
    ) {
      e.preventDefault();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.code] = false;
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (!this.mouseButtons[e.button]) this.mousePressedThisFrame.add(e.button);
    this.mouseButtons[e.button] = true;
  };

  private handleMouseUp = (e: MouseEvent): void => {
    this.mouseButtons[e.button] = false;
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (this.locked) {
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    }
  };

  private handleWheel = (e: WheelEvent): void => {
    this.wheelDelta += e.deltaY;
  };

  private handleLockChange = (): void => {
    this.locked = document.pointerLockElement === this.element;
    this.onLockChange?.(this.locked);
  };

  private handleLockError = (): void => {
    console.warn('Pointer lock failed');
  };

  private handleBlur = (): void => {
    this.keys = {};
    this.mouseButtons = {};
  };

  setLockChangeHandler(cb: (locked: boolean) => void): void {
    this.onLockChange = cb;
  }

  requestLock(): void {
    if (!this.locked && this.element.requestPointerLock) {
      this.element.requestPointerLock();
    }
  }

  exitLock(): void {
    if (this.locked && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  isDown(code: string): boolean {
    return !!this.keys[code];
  }

  /** True only on the frame the key transitioned from up to down. */
  wasPressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  isMouseDown(button = 0): boolean {
    return !!this.mouseButtons[button];
  }

  wasMousePressed(button = 0): boolean {
    return this.mousePressedThisFrame.has(button);
  }

  /** Call at end of each frame to clear edge-triggered state. */
  endFrame(): void {
    this.pressedThisFrame.clear();
    this.mousePressedThisFrame.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheelDelta = 0;
  }

  isSprinting(): boolean {
    return this.isDown('ShiftLeft') || this.isDown('ShiftRight');
  }

  isCrouching(): boolean {
    return this.isDown('KeyC') || this.isDown('ControlLeft');
  }
}
