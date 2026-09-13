const NOISE_SIZE = 128;
const NOISE_SCALE = 9;
const WORDMARK_COLUMNS = 110;
const NOISE_SEED = 10407530;
const TWINKLE_SEED = 663316;

const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36,
  14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55,
  23, 61, 29, 53, 21,
];

const ROW_STOPS = [
  "crest", "crest", "crest", "crest", "crest",
  "hover", "hover",
  "lit", "lit", "lit", "lit",
  "mid", "mid", "mid",
  "dim", "dim", "dim", "dim", "dim",
];

const STAMP = [
  "000000010000000",
  "000000111000000",
  "000001111100000",
  "000011111110000",
  "000111111111000",
  "001111111111100",
  "011111111111110",
  "111111111111111",
  "011111111111110",
  "001111111111100",
  "000111111111000",
  "000011111110000",
  "000001111100000",
  "000000111000000",
  "000000010000000",
];

const QUIET_SELECTOR = [
  ".hero .kicker",
  ".hero .lede",
  ".hero .hero-actions a",
  ".site-nav a",
  ".header-actions a",
  ".header-actions button",
].join(", ");

function readColors() {
  const styles = getComputedStyle(document.documentElement);
  const pick = (name, fallback) =>
    styles.getPropertyValue(name).trim() || fallback;

  return {
    bg: pick("--t-field-bg", "#0e0e14"),
    dim: pick("--t-field-dim", "#39482e"),
    mid: pick("--t-field-mid", "#678549"),
    lit: pick("--t-field-lit", "#9ece6a"),
    hover: pick("--t-field-hover", "#bbdd97"),
    crest: pick("--t-field-crest", "#daecc6"),
  };
}

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function buildValueNoise(seed) {
  const random = createRandom(seed);
  let grid = new Float32Array(NOISE_SIZE * NOISE_SIZE);
  for (let i = 0; i < grid.length; i++) grid[i] = random();

  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(NOISE_SIZE * NOISE_SIZE);
    for (let y = 0; y < NOISE_SIZE; y++) {
      for (let x = 0; x < NOISE_SIZE; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const sx = (x + dx + NOISE_SIZE) % NOISE_SIZE;
            const sy = (y + dy + NOISE_SIZE) % NOISE_SIZE;
            sum += grid[sy * NOISE_SIZE + sx];
          }
        }
        next[y * NOISE_SIZE + x] = sum / 9;
      }
    }
    grid = next;
  }

  let min = Infinity;
  let max = -Infinity;
  for (const value of grid) {
    if (value < min) min = value;
    if (value > max) max = value;
  }

  const range = max - min || 1;
  for (let i = 0; i < grid.length; i++) {
    grid[i] = (grid[i] - min) / range;
  }
  return grid;
}

function buildRandomField(seed) {
  const random = createRandom(seed);
  const values = new Float32Array(4096);
  for (let i = 0; i < values.length; i++) values[i] = random();
  return values;
}

function sampleNoise(grid, x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const x0 = ((xi % NOISE_SIZE) + NOISE_SIZE) % NOISE_SIZE;
  const y0 = ((yi % NOISE_SIZE) + NOISE_SIZE) % NOISE_SIZE;
  const x1 = (x0 + 1) % NOISE_SIZE;
  const y1 = (y0 + 1) % NOISE_SIZE;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const a = grid[y0 * NOISE_SIZE + x0];
  const b = grid[y0 * NOISE_SIZE + x1];
  const c = grid[y1 * NOISE_SIZE + x0];
  const d = grid[y1 * NOISE_SIZE + x1];
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

function buildBitmap(word) {
  const offscreen = document.createElement("canvas");
  const context = offscreen.getContext("2d");
  const family = '"Geist Mono", ui-monospace, monospace';

  context.font = `800 100px ${family}`;
  const measured = context.measureText(word).width || 1;
  const fontPx = Math.max(6, (100 * WORDMARK_COLUMNS) / measured);
  const width = Math.ceil(fontPx * (measured / 100)) + 2;
  const height = Math.ceil(fontPx * 1.6);

  offscreen.width = width;
  offscreen.height = height;
  context.font = `800 ${fontPx}px ${family}`;
  context.textBaseline = "top";
  context.fillStyle = "#fff";
  context.fillText(word, 1, Math.round(fontPx * 0.25));

  const pixels = context.getImageData(0, 0, width, height).data;
  const rows = [];
  for (let y = 0; y < height; y++) {
    let row = "";
    for (let x = 0; x < width; x++) {
      row += pixels[(y * width + x) * 4 + 3] > 110 ? "1" : "0";
    }
    rows.push(row);
  }

  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== "1") continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  });

  const trimmed = rows
    .slice(minY, maxY + 1)
    .map((row) => row.slice(minX, maxX + 1));
  return trimmed.length && trimmed[0].length ? trimmed : null;
}

export function initPixelField(canvas, placeholder) {
  const context = canvas.getContext("2d", { alpha: false });
  const word = canvas.dataset.word || "MODELVERSE";
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const valueNoise = buildValueNoise(NOISE_SEED);
  const twinkle = buildRandomField(TWINKLE_SEED);

  let colors = readColors();
  let rowColors = [];
  let bitmap = null;
  let bitmapCols = WORDMARK_COLUMNS;
  let bitmapRows = 19;
  let field = null;
  let quietField = null;
  let layout = null;
  let animationFrame = 0;
  let lastFrame = 0;
  let startTime = 0;
  let reveal = 1;
  let stamps = [];
  const cursor = { x: -1e4, y: -1e4, strength: 0 };

  function buildRowColors() {
    rowColors = [];
    for (let row = 0; row < bitmapRows; row++) {
      const stop = Math.floor((row / bitmapRows) * ROW_STOPS.length);
      rowColors.push(colors[ROW_STOPS[Math.min(stop, ROW_STOPS.length - 1)]]);
    }
  }

  function measureQuietRects(heroRect, dpr) {
    return [...document.querySelectorAll(QUIET_SELECTOR)]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          l: (rect.left - heroRect.left) * dpr,
          t: (rect.top - heroRect.top) * dpr,
          r: (rect.right - heroRect.left) * dpr,
          b: (rect.bottom - heroRect.top) * dpr,
        };
      })
      .filter((rect) => rect.r > rect.l && rect.b > rect.t);
  }

  function resize() {
    if (!bitmap) return;
    const hero = canvas.parentElement.parentElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const heroRect = hero.getBoundingClientRect();
    const w = Math.max(1, Math.round(heroRect.width * dpr));
    const h = Math.max(1, Math.round(heroRect.height * dpr));

    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${heroRect.width}px`;
    canvas.style.height = `${heroRect.height}px`;

    const mark = placeholder.getBoundingClientRect();
    const markWidth = (mark.width || Math.min(0.88 * (heroRect.width - 48), 896)) * dpr;
    const cellW = markWidth / bitmapCols;
    const cellH = cellW;

    const offsetX = (mark.left - heroRect.left) * dpr;
    const offsetY = (mark.top - heroRect.top) * dpr;

    const gridStartX = -Math.ceil(offsetX / cellW) - 1;
    const gridStartY = -Math.ceil(offsetY / cellH) - 1;
    const gridCols = Math.ceil((w - offsetX) / cellW) - gridStartX + 1;
    const gridRows = Math.ceil((h - offsetY) / cellH) - gridStartY + 1;

    field = new Float32Array(gridCols * gridRows);
    quietField = new Float32Array(gridCols * gridRows);

    const quietRects = measureQuietRects(heroRect, dpr);
    const quietRadius = 150 * dpr;

    for (let row = 0; row < gridRows; row++) {
      const y = offsetY + (gridStartY + row + 0.5) * cellH;
      const ny = (y / h) * 2 - 1;
      const vertical = Math.min(1, Math.max(0.16, (y / dpr - 24) / 130));

      for (let col = 0; col < gridCols; col++) {
        const x = offsetX + (gridStartX + col + 0.5) * cellW;
        const nx = (x / w) * 2 - 1;
        const distance = Math.sqrt(nx * nx + ny * ny * 0.82);
        const edge = Math.min(1, Math.max(0, (distance - 0.42) / 0.85));

        let quiet = 1;
        if (quietRects.length) {
          let nearest = Infinity;
          for (const rect of quietRects) {
            const dx = Math.max(rect.l - x, 0, x - rect.r);
            const dy = Math.max(rect.t - y, 0, y - rect.b);
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < nearest) nearest = d;
          }
          quiet =
            nearest >= quietRadius
              ? 1
              : Math.pow(nearest / quietRadius, 3);
        }

        const index = row * gridCols + col;
        quietField[index] = quiet;
        field[index] = edge * edge * vertical * quiet;
      }
    }

    layout = {
      w,
      h,
      dpr,
      offsetX,
      offsetY,
      cellW,
      cellH,
      gridStartX,
      gridStartY,
      gridCols,
      gridRows,
    };
  }

  function stampStrength(x, y) {
    let best = 0;
    for (const stamp of stamps) {
      const col = Math.floor((x - stamp.x) / stamp.cellPx + 7.5);
      const row = Math.floor((y - stamp.y) / stamp.cellPx + 7.5);
      if (col < 0 || row < 0 || col >= 15 || row >= 15) continue;
      if (STAMP[row][col] === "1" && stamp.amp > best) best = stamp.amp;
    }
    return best;
  }

  function cursorGlowAt(x, y, reach) {
    if (cursor.strength <= 0.01) return 0;
    const dx = x - cursor.x;
    const dy = y - cursor.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance >= reach) return 0;
    const falloff = 1 - distance / reach;
    return falloff * falloff * cursor.strength;
  }

  function drawField(time) {
    const t = time / 1000;
    const {
      offsetX,
      offsetY,
      cellW,
      cellH,
      gridStartX,
      gridStartY,
      gridCols,
      gridRows,
    } = layout;

    const cursorReach =
      12 * cellW * (0.45 + 0.55 * Math.min(1, cursor.strength));

    for (let row = 0; row < gridRows; row++) {
      const gridY = gridStartY + row;
      const y = offsetY + gridY * cellH;
      const yc = y + cellH / 2;

      for (let col = 0; col < gridCols; col++) {
        const gridX = gridStartX + col;
        if (
          gridX >= 0 &&
          gridX < bitmapCols &&
          gridY >= 0 &&
          gridY < bitmapRows &&
          bitmap[gridY][gridX] === "1"
        ) {
          continue;
        }

        const index = row * gridCols + col;
        const base = field[index];
        let intensity = 0;

        if (base > 0.002) {
          const nx = gridX / NOISE_SCALE;
          const ny = gridY / NOISE_SCALE;
          const noise =
            0.6 * sampleNoise(valueNoise, nx + t * 0.14, ny - t * 0.055) +
            0.4 *
              sampleNoise(valueNoise, nx * 0.55 - t * 0.08, ny * 0.55 + t * 0.06);
          const twinkleValue =
            0.5 +
            0.5 *
              Math.sin(
                t * 1.1 + twinkle[(gridY * 37 + gridX * 11) & 4095] * 6.283
              );
          intensity = base * (0.3 + 0.52 * noise * noise + 0.18 * twinkleValue) * 0.62;
        }

        const xc = offsetX + (gridX + 0.5) * cellW;
        const quiet = quietField[index];
        const glow = cursorGlowAt(xc, yc, cursorReach);
        if (glow > 0) intensity += glow * 0.6 * quiet;

        const stamp = stampStrength(xc, yc);
        if (stamp > 0) intensity += stamp * 1.15;

        const threshold =
          0.78 * ((BAYER[(gridY & 7) * 8 + (gridX & 7)] + 0.5) / 64) +
          0.22 * twinkle[((gridY & 63) * 64 + (gridX & 63))];
        if (intensity <= threshold) continue;

        const x = offsetX + gridX * cellW;
        context.fillStyle =
          intensity > 0.34
            ? colors.lit
            : intensity > 0.1
              ? colors.mid
              : colors.dim;

        const rx = Math.round(x);
        const ry = Math.round(y);
        context.fillRect(
          rx,
          ry,
          Math.round(x + cellW) - rx,
          Math.round(y + cellH) - ry
        );
      }
    }
  }

  function drawWordmark() {
    const visibleCols = Math.floor(bitmapCols * reveal);
    const {
      offsetX,
      offsetY,
      cellW,
      cellH,
    } = layout;
    const markReach =
      12 * cellW * (0.45 + 0.55 * Math.min(1, cursor.strength));

    for (let row = 0; row < bitmapRows; row++) {
      const bits = bitmap[row];
      const y = offsetY + row * cellH;
      const ry = Math.round(y);
      const rh = Math.round(y + cellH) - ry;
      const yc = y + cellH / 2;

      for (let col = 0; col < bitmapCols; col++) {
        if (col >= visibleCols || bits[col] !== "1") continue;
        const x = offsetX + col * cellW;
        const xc = x + cellW / 2;

        let glow = stampStrength(xc, yc);
        const cursorGlow = cursorGlowAt(xc, yc, markReach);
        if (cursorGlow > glow) glow = cursorGlow;

        context.fillStyle =
          glow > 0.45
            ? colors.crest
            : glow > 0.12
              ? colors.hover
              : rowColors[row];

        const rx = Math.round(x);
        context.fillRect(rx, ry, Math.round(x + cellW) - rx, rh);
      }
    }
  }

  function draw(time) {
    const { w, h } = layout;
    context.fillStyle = colors.bg;
    context.fillRect(0, 0, w, h);

    stamps = stamps.filter((stamp) => (time - stamp.born) / 1000 < stamp.life);

    drawField(time);
    drawWordmark();
  }

  function loop(now) {
    animationFrame = requestAnimationFrame(loop);
    if (now - lastFrame < 33) return;
    lastFrame = now;
    reveal = Math.min(1, (now - startTime) / 1100);
    draw(now);
  }

  function start() {
    cancelAnimationFrame(animationFrame);
    if (!bitmap) return;
    buildRowColors();
    resize();
    startTime = performance.now();
    lastFrame = 0;

    if (reduceMotion) {
      reveal = 1;
      draw(startTime);
      return;
    }
    animationFrame = requestAnimationFrame(loop);
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    const dpr = layout?.dpr ?? 1;
    return {
      x: (event.clientX - rect.left) * dpr,
      y: (event.clientY - rect.top) * dpr,
    };
  }

  function insideCanvas(point) {
    return (
      layout &&
      point.x >= 0 &&
      point.x <= layout.w &&
      point.y >= 0 &&
      point.y <= layout.h
    );
  }

  window.addEventListener(
    "pointermove",
    (event) => {
      if (!layout) return;
      const point = pointFromEvent(event);
      if (!insideCanvas(point)) {
        cursor.strength = 0;
        return;
      }
      cursor.x = point.x;
      cursor.y = point.y;
      cursor.strength = 1;
    },
    { passive: true }
  );

  window.addEventListener("pointerleave", () => {
    cursor.strength = 0;
  });

  window.addEventListener(
    "pointerdown",
    (event) => {
      if (!layout || reduceMotion) return;
      if (event.target?.closest?.("a, button, input, select, textarea")) return;
      const point = pointFromEvent(event);
      if (!insideCanvas(point)) return;

      stamps.push({
        x: point.x,
        y: point.y,
        born: performance.now(),
        from: 0.45,
        to: 0.45 + 1 + 3.2 * 0.5,
        life: 0.65 + 0.55 * 0.5,
        amp: 1,
        cellPx: layout.cellW,
      });
    },
    { passive: true }
  );

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(start, 200);
  });

  new MutationObserver(() => {
    colors = readColors();
    start();
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  document.fonts.ready.then(() => {
    bitmap = buildBitmap(word);
    if (!bitmap) return;
    bitmapRows = bitmap.length;
    bitmapCols = bitmap[0].length;
    placeholder.style.aspectRatio = `${bitmapCols} / ${bitmapRows}`;
    start();
  });
}
