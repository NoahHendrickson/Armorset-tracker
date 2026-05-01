/**
 * Build an SVG path for the outline of the union of two axis-aligned
 * rectangles (same size), with rounded convex and concave corners — used for
 * the merge drag preview so inner "notch" corners read as merging rather than
 * a sharp stair-step.
 */

type Point = readonly [number, number];

type Segment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

const EPS = 1e-4;

function normKey(x: number, y: number): string {
  return `${Math.round(x / EPS) * EPS},${Math.round(y / EPS) * EPS}`;
}

function insideRect(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  return cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh;
}

/**
 * Union of two equal W×H rectangles at (ax,ay) and (bx,by).
 * Padded grid marks exterior; returns closed CCW outline in SVG coords (y-down).
 */
function rectUnionOutlinePoints(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  w: number,
  h: number,
): Point[] {
  const padL = Math.min(ax, bx) - 1;
  const padR = Math.max(ax + w, bx + w) + 1;
  const padT = Math.min(ay, by) - 1;
  const padB = Math.max(ay + h, by + h) + 1;

  const xs = [...new Set([padL, ax, ax + w, bx, bx + w, padR])].sort(
    (a, b) => a - b,
  );
  const ys = [...new Set([padT, ay, ay + h, by, by + h, padB])].sort(
    (a, b) => a - b,
  );

  const ni = xs.length - 1;
  const nj = ys.length - 1;

  const inside = (i: number, j: number): boolean => {
    const cx = (xs[i] + xs[i + 1]) / 2;
    const cy = (ys[j] + ys[j + 1]) / 2;
    return insideRect(cx, cy, ax, ay, w, h) || insideRect(cx, cy, bx, by, w, h);
  };

  const segs: Segment[] = [];

  for (let i = 0; i < ni - 1; i++) {
    const x = xs[i + 1];
    for (let j = 0; j < nj; j++) {
      if (inside(i, j) !== inside(i + 1, j)) {
        segs.push({ x1: x, y1: ys[j], x2: x, y2: ys[j + 1] });
      }
    }
  }
  for (let j = 0; j < nj - 1; j++) {
    const y = ys[j + 1];
    for (let i = 0; i < ni; i++) {
      if (inside(i, j) !== inside(i, j + 1)) {
        segs.push({ x1: xs[i], y1: y, x2: xs[i + 1], y2: y });
      }
    }
  }

  if (segs.length === 0) return [];

  const adj = new Map<string, Point[]>();
  const addUndirected = (p: Point, q: Point) => {
    const pk = normKey(p[0], p[1]);
    const qk = normKey(q[0], q[1]);
    if (!adj.has(pk)) adj.set(pk, []);
    if (!adj.has(qk)) adj.set(qk, []);
    adj.get(pk)!.push(q);
    adj.get(qk)!.push(p);
  };

  for (const s of segs) {
    addUndirected([s.x1, s.y1], [s.x2, s.y2]);
  }

  let start = "";
  for (const k of adj.keys()) {
    if (!start || k < start) start = k;
  }

  const [sx, sy] = start.split(",").map(Number) as [number, number];
  const path: Point[] = [[sx, sy]];
  const nbrs0 = adj.get(start)!;
  let prevKey = start;
  let currentPt = nbrs0[0];
  let currentKey = normKey(currentPt[0], currentPt[1]);

  for (let guard = 0; guard < segs.length * 8 + 20; guard++) {
    path.push([currentPt[0], currentPt[1]]);
    if (currentKey === start && path.length > 1) break;
    const nbrs = adj.get(currentKey)!;
    let nextPt: Point | null = null;
    for (const n of nbrs) {
      const nk = normKey(n[0], n[1]);
      if (nk === prevKey) continue;
      nextPt = n;
      break;
    }
    if (!nextPt) break;
    prevKey = currentKey;
    currentKey = normKey(nextPt[0], nextPt[1]);
    currentPt = nextPt;
  }

  return simplifyCollinear(path);
}

/** Drop collinear vertices; keep closed ring (first === last). */
function simplifyCollinear(pts: Point[]): Point[] {
  if (pts.length <= 3) return pts;
  const closed =
    pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
  const ring: Point[] = closed ? pts.slice(0, -1) : [...pts];
  const n = ring.length;
  if (n < 3) return pts;

  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = ring[(i - 1 + n) % n];
    const p1 = ring[i];
    const p2 = ring[(i + 1) % n];
    const dx1 = p1[0] - p0[0];
    const dy1 = p1[1] - p0[1];
    const dx2 = p2[0] - p1[0];
    const dy2 = p2[1] - p1[1];
    const cross = Math.abs(dx1 * dy2 - dy1 * dx2);
    if (cross < 1e-6) continue;
    out.push(p1);
  }
  if (out.length < 3) return pts;
  if (closed) out.push(out[0]);
  return out;
}

/**
 * Orthogonal polygon → path with quadratic fillets. `cornerRadius` is the
 * nominal radius; clamped per edge so short segments stay valid.
 */
function roundedOrthogonalPath(ringClosed: Point[], cornerRadius: number): string {
  if (ringClosed.length < 2) return "";

  const closed =
    ringClosed[0][0] === ringClosed[ringClosed.length - 1][0] &&
    ringClosed[0][1] === ringClosed[ringClosed.length - 1][1];
  const ring: Point[] = closed ? ringClosed.slice(0, -1) : [...ringClosed];
  const m = ring.length;
  if (m < 2) return "";

  const parts: string[] = [];
  const dist = (a: Point, b: Point) =>
    Math.hypot(b[0] - a[0], b[1] - a[1]);

  for (let i = 0; i < m; i++) {
    const p0 = ring[(i - 1 + m) % m];
    const p1 = ring[i];
    const p2 = ring[(i + 1) % m];

    const lenIn = dist(p0, p1);
    const lenOut = dist(p1, p2);
    const r = Math.max(
      0,
      Math.min(cornerRadius, lenIn / 2 - EPS, lenOut / 2 - EPS),
    );

    if (r < 0.5) {
      if (i === 0) parts.push(`M ${p1[0]} ${p1[1]}`);
      else parts.push(`L ${p1[0]} ${p1[1]}`);
      continue;
    }

    const uIn: Point = [
      (p1[0] - p0[0]) / lenIn,
      (p1[1] - p0[1]) / lenIn,
    ];
    const uOut: Point = [
      (p2[0] - p1[0]) / lenOut,
      (p2[1] - p1[1]) / lenOut,
    ];

    const cutIn: Point = [p1[0] - uIn[0] * r, p1[1] - uIn[1] * r];
    const cutOut: Point = [p1[0] + uOut[0] * r, p1[1] + uOut[1] * r];

    if (i === 0) {
      parts.push(`M ${cutIn[0]} ${cutIn[1]}`);
    } else {
      parts.push(`L ${cutIn[0]} ${cutIn[1]}`);
    }

    parts.push(`Q ${p1[0]} ${p1[1]} ${cutOut[0]} ${cutOut[1]}`);
  }

  parts.push("Z");
  return parts.join(" ");
}

/** Public: SVG `d` for merge preview stroke. */
export function mergePreviewUnionPathD(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  w: number,
  h: number,
  cornerRadius = 14,
): string {
  const pts = rectUnionOutlinePoints(ax, ay, bx, by, w, h);
  if (pts.length === 0) return "";

  if (pts.length === 2) {
    const x = Math.min(ax, bx);
    const y = Math.min(ay, by);
    const rw = Math.max(ax + w, bx + w) - x;
    const rh = Math.max(ay + h, by + h) - y;
    const rr = Math.min(cornerRadius, rw / 2, rh / 2);
    if (rr < 1) {
      return `M ${x} ${y} h ${rw} v ${rh} h ${-rw} Z`;
    }
    return [
      `M ${x + rr} ${y}`,
      `h ${rw - 2 * rr}`,
      `q ${rr} 0 ${rr} ${rr}`,
      `v ${rh - 2 * rr}`,
      `q 0 ${rr} ${-rr} ${rr}`,
      `h ${-(rw - 2 * rr)}`,
      `q ${-rr} 0 ${-rr} ${-rr}`,
      `v ${-(rh - 2 * rr)}`,
      `q 0 ${-rr} ${rr} ${-rr}`,
      "Z",
    ].join(" ");
  }

  return roundedOrthogonalPath(pts as Point[], cornerRadius);
}
