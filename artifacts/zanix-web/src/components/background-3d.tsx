import { useEffect, useRef } from "react";

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  baseOpacity: number;
  hex: boolean;
  phase: number;
  color: [number, number, number];
  rotSpeed: number;
  rot: number;
  depth: number;
}

interface Streak {
  x: number; y: number;
  vx: number; vy: number;
  len: number;
  life: number;
  maxLife: number;
  color: [number, number, number];
}

const VIOLET: [number, number, number] = [139, 92, 246];
const CYAN: [number, number, number]   = [6, 182, 212];
const INDIGO: [number, number, number] = [99, 102, 241];

function drawHex(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * Math.PI) / 3;
    const px = x + r * Math.cos(a);
    const py = y + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function hexGrid(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const R = 48;
  const cols = Math.ceil(w / (R * 1.5)) + 2;
  const rows = Math.ceil(h / (R * Math.sqrt(3))) + 2;
  ctx.lineWidth = 0.4;
  for (let col = -1; col < cols; col++) {
    for (let row = -1; row < rows; row++) {
      const offset = col % 2 === 0 ? 0 : R * Math.sqrt(3) * 0.5;
      const cx = col * R * 1.5;
      const cy = row * R * Math.sqrt(3) + offset;
      const dist = Math.hypot(cx - w * 0.5, cy - h * 0.5);
      const maxD = Math.hypot(w, h) * 0.55;
      const alpha = Math.max(0, (1 - dist / maxD)) * 0.035 * (Math.sin(t * 0.4 + col * 0.3 + row * 0.2) * 0.3 + 0.7);
      ctx.strokeStyle = `rgba(139,92,246,${alpha})`;
      drawHex(ctx, cx, cy, R - 1, Math.PI / 6);
      ctx.stroke();
    }
  }
}

export function Background3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;

    let w = 0, h = 0, rafId = 0;
    let mx = -9999, my = -9999;

    const resize = () => {
      w = canvas.width  = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const onMouse = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) { mx = e.touches[0].clientX; my = e.touches[0].clientY; }
    };
    window.addEventListener("mousemove", onMouse);
    window.addEventListener("touchmove", onTouch, { passive: true });

    const N = 70;
    const particles: Particle[] = Array.from({ length: N }, () => {
      const depth = Math.random();
      return {
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25 * (0.3 + depth * 0.7),
        vy: (Math.random() - 0.5) * 0.25 * (0.3 + depth * 0.7),
        size: 1 + depth * 3.5,
        baseOpacity: 0.15 + depth * 0.55,
        hex: Math.random() < 0.28 && depth > 0.4,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() < 0.6 ? VIOLET : (Math.random() < 0.6 ? CYAN : INDIGO),
        rotSpeed: (Math.random() - 0.5) * 0.012,
        rot: Math.random() * Math.PI,
        depth,
      };
    });

    const nebulae = [
      { x: 0.18, y: 0.25, rx: 0.38, ry: 0.28, color: "139,92,246", phase: 0,         speed: 0.18 },
      { x: 0.82, y: 0.72, rx: 0.32, ry: 0.22, color: "6,182,212",  phase: Math.PI*0.7, speed: 0.14 },
      { x: 0.52, y: 0.52, rx: 0.22, ry: 0.18, color: "99,102,241", phase: Math.PI*1.4, speed: 0.22 },
      { x: 0.75, y: 0.22, rx: 0.20, ry: 0.16, color: "167,139,250", phase: Math.PI*2.1, speed: 0.19 },
    ];

    const streaks: Streak[] = [];
    let nextStreak = 0;

    function spawnStreak() {
      const side = Math.floor(Math.random() * 2);
      const spd = 2.5 + Math.random() * 4;
      const angle = (Math.random() * 0.6 - 0.3) + (side === 0 ? Math.PI * 0.25 : Math.PI * 0.75);
      streaks.push({
        x: side === 0 ? Math.random() * w : Math.random() * w,
        y: side === 0 ? -20 : h + 20,
        vx: Math.cos(angle) * spd,
        vy: side === 0 ? Math.sin(angle) * spd : -Math.sin(angle) * spd,
        len: 80 + Math.random() * 80,
        life: 0, maxLife: 1,
        color: Math.random() < 0.6 ? VIOLET : CYAN,
      });
    }

    let t = 0;

    function draw() {
      t += 0.007;
      ctx.clearRect(0, 0, w, h);

      // ── Hex grid ──────────────────────────────────────────────
      hexGrid(ctx, w, h, t);

      // ── Nebula clouds ─────────────────────────────────────────
      for (const n of nebulae) {
        const pulse = 1 + Math.sin(t * n.speed * 6 + n.phase) * 0.07;
        const nx = (n.x + Math.sin(t * n.speed + n.phase) * 0.035) * w;
        const ny = (n.y + Math.cos(t * n.speed * 0.8 + n.phase) * 0.03) * h;
        const rx = n.rx * Math.min(w, h) * pulse;
        const ry = n.ry * Math.min(w, h) * pulse;
        const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, rx);
        g.addColorStop(0,   `rgba(${n.color},0.055)`);
        g.addColorStop(0.45, `rgba(${n.color},0.022)`);
        g.addColorStop(1,   `rgba(${n.color},0)`);
        ctx.save();
        ctx.scale(1, ry / rx);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(nx, ny * (rx / ry), rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ── Connection lines ───────────────────────────────────────
      for (let i = 0; i < particles.length; i++) {
        const pi = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const pj = particles[j];
          const dx = pi.x - pj.x, dy = pi.y - pj.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          const maxD = 120 + pi.depth * 50;
          if (d < maxD) {
            const alpha = (1 - d / maxD) * 0.22 * ((pi.depth + pj.depth) * 0.5);
            const [r1, g1, b1] = pi.color;
            const [r2, g2, b2] = pj.color;
            const grad = ctx.createLinearGradient(pi.x, pi.y, pj.x, pj.y);
            grad.addColorStop(0, `rgba(${r1},${g1},${b1},${alpha})`);
            grad.addColorStop(1, `rgba(${r2},${g2},${b2},${alpha})`);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 0.5 + pi.depth * 0.4;
            ctx.beginPath(); ctx.moveTo(pi.x, pi.y); ctx.lineTo(pj.x, pj.y); ctx.stroke();
          }
        }
      }

      // ── Particles ──────────────────────────────────────────────
      for (const p of particles) {
        p.rot += p.rotSpeed;
        const pulse = 1 + Math.sin(t * 1.4 + p.phase) * 0.18;
        const alpha = p.baseOpacity * (Math.sin(t * 0.9 + p.phase) * 0.18 + 0.82);
        const [r, g, b] = p.color;

        // Mouse repel
        const mdx = p.x - mx, mdy = p.y - my;
        const md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md < 100) { p.vx += (mdx / md) * 0.04; p.vy += (mdy / md) * 0.04; }

        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const maxSpd = 0.6;
        if (spd > maxSpd) { p.vx = (p.vx / spd) * maxSpd; p.vy = (p.vy / spd) * maxSpd; }

        ctx.save();
        ctx.shadowBlur = p.size * 5 * p.depth;
        ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
        ctx.fillStyle   = `rgba(${r},${g},${b},${alpha})`;

        if (p.hex) {
          const hr = p.size * pulse * 1.6;
          drawHex(ctx, p.x, p.y, hr, p.rot);
          ctx.fill();
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.45})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
          // Inner hex
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.3})`;
          drawHex(ctx, p.x, p.y, hr * 0.55, p.rot + Math.PI / 6);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * pulse, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        p.x += p.vx; p.y += p.vy;
        if (p.x < -20) p.x = w + 20; else if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20; else if (p.y > h + 20) p.y = -20;
      }

      // ── Shooting streaks ───────────────────────────────────────
      if (t > nextStreak) { spawnStreak(); nextStreak = t + 3 + Math.random() * 8; }
      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i];
        s.life += 0.016;
        const progress = s.life / s.maxLife;
        if (progress > 1 || s.x < -200 || s.x > w + 200 || s.y < -200 || s.y > h + 200) {
          streaks.splice(i, 1); continue;
        }
        const fade = Math.min(progress * 6, 1) * Math.min((1 - progress) * 3, 1);
        const [r, g, b] = s.color;
        const grad = ctx.createLinearGradient(
          s.x, s.y, s.x - s.vx * s.len / 4, s.y - s.vy * s.len / 4
        );
        grad.addColorStop(0, `rgba(${r},${g},${b},${fade * 0.7})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 6;
        ctx.shadowColor = `rgba(${r},${g},${b},0.5)`;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * s.len / 4, s.y - s.vy * s.len / 4);
        ctx.stroke();
        ctx.shadowBlur = 0;
        s.x += s.vx; s.y += s.vy;
        s.life += 0.01;
      }

      rafId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("touchmove", onTouch);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 0.85 }}
    />
  );
}
