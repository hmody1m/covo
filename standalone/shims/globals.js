// Injected into the browser bundle: minimal `process` and `Buffer` globals.
import { Buffer } from 'buffer';
export const process = globalThis.process || { env: {}, platform: 'browser', version: 'v22.0.0', versions: {}, pid: 1, argv: [], cwd: () => '/', on() {}, once() {}, off() {}, exit() {}, nextTick: (fn, ...a) => queueMicrotask(() => fn(...a)) };
globalThis.process = process;
globalThis.Buffer = globalThis.Buffer || Buffer;
export { Buffer };
