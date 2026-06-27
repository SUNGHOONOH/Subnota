import { useMemo } from 'react';

import { seededRandom } from '../model/seededRandom';
import { TreeParams, TreeStage } from '../model/treeTypes';

// Pixel tree built like 4b3c's generator: a seeded binary tree of nodes, each
// connected to its parent by a tapered branch (width falls with depth), with
// leaf clusters only on the top nodes. The whole node tree is pre-decided from
// the seed, so growth only reveals deeper nodes — positions never shift.
const VIEW = 128;
const CELL = 2;
const COLS = VIEW / CELL;
const GROUND_PX = 118;
const MAX_DEPTH = 9;
const DECAY = 0.74;

const STAGE_DEPTH: Record<TreeStage, number> = {
  seed: 0,
  sprout: 2,
  seedling: 4,
  young_tree: 6,
  mature_tree: MAX_DEPTH,
};

const PALETTE = {
  trunk: '#7a5230',
  trunkDark: '#5b3c22',
  leafLight: '#86c44d',
  leaf: '#5d9a3f',
  leafDark: '#3f6e30',
  leafEdge: '#2c4d22',
};

interface TreeNode {
  depth: number;
  parent: number;
  x: number;
  y: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

interface PixelTreeProps {
  params: TreeParams;
  seed: string;
  size?: number;
}

const PixelTree = ({ params, seed, size = 128 }: PixelTreeProps) => {
  const rows = useMemo(() => {
    const rngBuild = seededRandom(`${seed}:build`);
    const rngShade = seededRandom(`${seed}:shade`);
    const revealDepth = STAGE_DEPTH[params.stage];

    // 1) Build the full node tree once (stable positions).
    const nodes: TreeNode[] = [];
    const rootLen = 16 + (params.height / 112) * 14;
    const grow = (x: number, y: number, angle: number, depth: number, len: number, parent: number) => {
      const index = nodes.length;
      nodes.push({ depth, parent, x, y });
      if (depth >= MAX_DEPTH) {
        return;
      }
      const spread = (16 + rngBuild() * 14) * params.branchSpread;
      const count = depth === 0 ? 1 : rngBuild() < 0.2 ? 1 : 2;
      for (let i = 0; i < count; i += 1) {
        const side = count === 1 ? 0 : i === 0 ? -1 : 1;
        const next = angle + side * spread + (rngBuild() - 0.5) * 10;
        grow(x + Math.cos(rad(next)) * len, y + Math.sin(rad(next)) * len, next, depth + 1, len * DECAY, index);
      }
    };
    grow(VIEW / 2, GROUND_PX, -90, 0, rootLen, -1);

    const grid = new Map<number, string>();
    const key = (col: number, row: number) => row * COLS + col;
    const set = (px: number, py: number, color: string, over = false) => {
      const col = Math.round(px / CELL);
      const row = Math.round(py / CELL);
      if (col < 0 || col >= COLS || row < 0 || row >= COLS) {
        return;
      }
      const id = key(col, row);
      if (over || !grid.has(id)) {
        grid.set(id, color);
      }
    };

    // 2) Branches: tapered brown lines, width from depth.
    const drawn = nodes.filter(node => node.depth <= revealDepth);
    for (const node of drawn) {
      if (node.parent < 0) {
        continue;
      }
      const parent = nodes[node.parent];
      const widthCells = Math.max(1, Math.round((params.trunkThickness * (1 - node.depth / (MAX_DEPTH + 1))) / CELL));
      const steps = Math.ceil(Math.hypot(node.x - parent.x, node.y - parent.y) / CELL);
      for (let s = 0; s <= steps; s += 1) {
        const t = steps === 0 ? 0 : s / steps;
        const px = parent.x + (node.x - parent.x) * t;
        const py = parent.y + (node.y - parent.y) * t;
        for (let w = -widthCells; w <= widthCells; w += 1) {
          set(px + w * CELL, py, w >= widthCells ? PALETTE.trunkDark : PALETTE.trunk, true);
        }
      }
    }

    // 3) Canopy: leaf discs on the top two revealed layers (overlap into a mass).
    const leafCells = new Set<number>();
    const radiusBase = 5 + params.leafDensity * 7;
    for (const node of drawn) {
      if (node.depth < revealDepth - 1) {
        continue;
      }
      const radius = node.depth >= revealDepth ? radiusBase : radiusBase * 0.7;
      const rCells = Math.round(radius / CELL);
      const ccol = Math.round(node.x / CELL);
      const crow = Math.round(node.y / CELL);
      for (let dc = -rCells; dc <= rCells; dc += 1) {
        for (let dr = -rCells; dr <= rCells; dr += 1) {
          if (dc * dc + dr * dr > rCells * rCells) {
            continue;
          }
          const col = ccol + dc;
          const row = crow + dr;
          if (col >= 0 && col < COLS && row >= 0 && row < COLS) {
            leafCells.add(key(col, row));
          }
        }
      }
    }

    // 4) Shade the canopy: lit top rim, dark underside, seeded speckle.
    const sorted = [...leafCells].sort((a, b) => a - b);
    for (const id of sorted) {
      const above = id - COLS;
      const below = id + COLS;
      let color: string;
      if (!leafCells.has(above)) {
        color = PALETTE.leafLight;
      } else if (!leafCells.has(below)) {
        color = PALETTE.leafEdge;
      } else {
        const roll = rngShade();
        color = roll < 0.16 ? PALETTE.leafLight : roll < 0.34 ? PALETTE.leafDark : PALETTE.leaf;
      }
      grid.set(id, color);
    }

    // 5) Emit one rect per horizontal run of same-color cells.
    const out: { color: string; row: number; start: number; len: number }[] = [];
    for (let row = 0; row < COLS; row += 1) {
      let start = -1;
      let color = '';
      for (let col = 0; col <= COLS; col += 1) {
        const cellColor = col < COLS ? grid.get(key(col, row)) ?? '' : '';
        if (cellColor !== color) {
          if (color && start >= 0) {
            out.push({ color, len: col - start, row, start });
          }
          start = cellColor ? col : -1;
          color = cellColor;
        }
      }
    }
    return out;
  }, [params, seed]);

  return (
    <svg height={size} shapeRendering="crispEdges" viewBox={`0 0 ${VIEW} ${VIEW}`} width={size}>
      {rows.map((run, index) => (
        <rect
          fill={run.color}
          height={CELL}
          key={index}
          width={run.len * CELL}
          x={run.start * CELL}
          y={run.row * CELL}
        />
      ))}
    </svg>
  );
};

export default PixelTree;
