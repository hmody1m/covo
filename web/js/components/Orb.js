import { html } from '../../vendor/preact-htm.js';
import { useStore } from '../store.js';

// The animated Covo orb.
// Mark: a coral blob with an ink orbit ring and a small "partner" dot.
// States: idle (ring sways) · thinking (ring draws itself) · writing (blob wobbles)
//         working (the dot orbits = using tools) · waiting (needs you, pulses) · listening (voice)

// Organic blob path with 4 cubic segments (same structure → SMIL can morph between them).
function blob(r, [a, b, c, d], cx = 32.5, cy = 32.5) {
  const k = 0.5523;
  const R = [r * a, r * b, r * c, r * d]; // right, bottom, left, top
  const pts = [[cx + R[0], cy], [cx, cy + R[1]], [cx - R[2], cy], [cx, cy - R[3]]];
  const seg = (p, q, rp, rq, dirP, dirQ) => `C${(p[0] + dirP[0] * rp * k).toFixed(2)} ${(p[1] + dirP[1] * rp * k).toFixed(2)} ${(q[0] + dirQ[0] * rq * k).toFixed(2)} ${(q[1] + dirQ[1] * rq * k).toFixed(2)} ${q[0].toFixed(2)} ${q[1].toFixed(2)}`;
  return `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`
    + seg(pts[0], pts[1], R[1], R[0], [0, 1], [1, 0])
    + seg(pts[1], pts[2], R[2], R[1], [-1, 0], [0, 1])
    + seg(pts[2], pts[3], R[3], R[2], [0, -1], [-1, 0])
    + seg(pts[3], pts[0], R[0], R[3], [1, 0], [0, -1]) + 'Z';
}
const B = [blob(11.6, [1, 1.04, 0.97, 1.02]), blob(11.6, [1.05, 0.96, 1.03, 0.98]), blob(11.6, [0.97, 1.02, 1.04, 0.95]), blob(11.6, [1, 1.04, 0.97, 1.02])].join(';');

// Orbit ring: back half is drawn behind the blob, front half in front of it,
// and a small ink "partner" dot sits on the ring (it travels around it while working).
const BACK = 'M12 32 A20 7.5 0 0 1 52 32';
const FRONT = 'M52 32 A20 7.5 0 0 1 12 32';
const ORBIT = 'M52 32 A20 7.5 0 1 1 12 32 A20 7.5 0 1 1 52 32';

export function Orb({ size, onClick, state: forced, label }) {
  const state = useStore((s) => forced || s.agentState || 'idle');
  const motion = useStore((s) => (s.settings?.appearance?.orbAnimation === false || s.settings?.appearance?.reduceMotion ? 'off' : 'on'));
  const st = ['thinking', 'writing', 'working', 'waiting', 'listening'].includes(state) ? state : 'idle';
  const dur = st === 'writing' ? '1.1s' : st === 'thinking' ? '1.8s' : '4.5s';
  return html`<button class="orb" data-state=${st} data-motion=${motion} style=${size ? `--orb-size:${size}px` : ''} onClick=${onClick} aria-label=${label || `Agent: ${st}`} title=${label || st}>
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <g class="ring"><path class="ink" d=${BACK} pathLength="40" /></g>
      <path class="blob" d=${blob(11.6, [1, 1.04, 0.97, 1.02])}>
        ${motion === 'on' && html`<animate attributeName="d" dur=${dur} repeatCount="indefinite" values=${B} calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" />`}
      </path>
      <g class="ring">
        <path class="ink" d=${FRONT} pathLength="40" />
        ${st === 'working' && motion === 'on'
          ? html`<circle class="moon" cx="0" cy="0" r="2.6"><animateMotion dur="1.6s" repeatCount="indefinite" path=${ORBIT} /></circle>`
          : html`<circle class="moon" cx="52" cy="32" r="2.6" />`}
      </g>
    </svg>
  </button>`;
}
