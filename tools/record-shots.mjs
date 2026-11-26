// Records the staged screenshot scenes as drawing commands. It runs the
// game's own modules (world, flight model, renderer, HUD) with a canvas
// stand-in that writes down every path, fill and text run, so the Python
// rasteriser in render-shots.py paints exactly what the browser paints.
// Run: node tools/record-shots.mjs > tools/shots-data.json
import { createRandom } from '../game/src/random.js';
import { createWorld } from '../game/src/world.js';
import { createCamera, VIEW_CHASE } from '../game/src/camera.js';
import { drawScene } from '../game/src/render.js';
import { drawAircraftShadow, drawChaseAircraft, drawCockpit } from '../game/src/aircraft.js';
import { drawDebriefPanel, drawHud } from '../game/src/hud.js';
import { stageShot } from '../game/src/shots.js';

function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function apply(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function createRecorder(commands) {
  const stack = [];
  let matrix = [1, 0, 0, 1, 0, 0];
  let clip = null;
  let path = [];
  const ctx = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1,
    font: '10px Arial',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    save() {
      stack.push({
        matrix: [...matrix],
        clip,
        fillStyle: ctx.fillStyle,
        strokeStyle: ctx.strokeStyle,
        lineWidth: ctx.lineWidth,
        globalAlpha: ctx.globalAlpha,
        font: ctx.font,
        textAlign: ctx.textAlign,
      });
    },
    restore() {
      const saved = stack.pop();
      if (!saved) return;
      matrix = saved.matrix;
      clip = saved.clip;
      ctx.fillStyle = saved.fillStyle;
      ctx.strokeStyle = saved.strokeStyle;
      ctx.lineWidth = saved.lineWidth;
      ctx.globalAlpha = saved.globalAlpha;
      ctx.font = saved.font;
      ctx.textAlign = saved.textAlign;
    },
    translate(x, y) {
      matrix = multiply(matrix, [1, 0, 0, 1, x, y]);
    },
    rotate(angle) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      matrix = multiply(matrix, [cos, sin, -sin, cos, 0, 0]);
    },
    scale(x, y) {
      matrix = multiply(matrix, [x, 0, 0, y, 0, 0]);
    },
    beginPath() {
      path = [];
    },
    moveTo(x, y) {
      path.push({ points: [apply(matrix, x, y)], closed: false });
    },
    lineTo(x, y) {
      if (path.length === 0) path.push({ points: [], closed: false });
      path[path.length - 1].points.push(apply(matrix, x, y));
    },
    closePath() {
      if (path.length > 0) path[path.length - 1].closed = true;
    },
    rect(x, y, width, height) {
      path.push({
        points: [apply(matrix, x, y), apply(matrix, x + width, y), apply(matrix, x + width, y + height), apply(matrix, x, y + height)],
        closed: true,
      });
    },
    arc(x, y, radius, start, end) {
      const points = [];
      const segments = 48;
      for (let i = 0; i <= segments; i += 1) {
        const angle = start + ((end - start) * i) / segments;
        points.push(apply(matrix, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius));
      }
      path.push({ points, closed: Math.abs(end - start) >= Math.PI * 2 - 0.01 });
    },
    clip() {
      clip = path.map((sub) => sub.points);
    },
    fill() {
      for (const sub of path) {
        if (sub.points.length < 3) continue;
        commands.push({ type: 'poly', points: sub.points, fill: styleValue(ctx.fillStyle), alpha: ctx.globalAlpha, clip });
      }
    },
    stroke() {
      const scale = Math.sqrt(matrix[0] * matrix[0] + matrix[1] * matrix[1]) || 1;
      for (const sub of path) {
        if (sub.points.length < 2) continue;
        commands.push({ type: 'lines', points: sub.points, stroke: styleValue(ctx.strokeStyle), width: ctx.lineWidth * scale, closed: sub.closed, alpha: ctx.globalAlpha, clip });
      }
    },
    fillRect(x, y, width, height) {
      const points = [apply(matrix, x, y), apply(matrix, x + width, y), apply(matrix, x + width, y + height), apply(matrix, x, y + height)];
      if (typeof ctx.fillStyle === 'object') {
        commands.push({ type: 'gradient', points, stops: ctx.fillStyle.stops, x0: ctx.fillStyle.x0, y0: ctx.fillStyle.y0, x1: ctx.fillStyle.x1, y1: ctx.fillStyle.y1, alpha: ctx.globalAlpha, clip });
      } else {
        commands.push({ type: 'poly', points, fill: ctx.fillStyle, alpha: ctx.globalAlpha, clip });
      }
    },
    strokeRect(x, y, width, height) {
      const points = [apply(matrix, x, y), apply(matrix, x + width, y), apply(matrix, x + width, y + height), apply(matrix, x, y + height)];
      const scale = Math.sqrt(matrix[0] * matrix[0] + matrix[1] * matrix[1]) || 1;
      commands.push({ type: 'lines', points, stroke: styleValue(ctx.strokeStyle), width: ctx.lineWidth * scale, closed: true, alpha: ctx.globalAlpha, clip });
    },
    fillText(value, x, y) {
      const point = apply(matrix, x, y);
      const sizeMatch = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
      const scale = Math.sqrt(matrix[0] * matrix[0] + matrix[1] * matrix[1]) || 1;
      commands.push({
        type: 'text',
        text: String(value),
        x: point[0],
        y: point[1],
        size: (sizeMatch ? Number(sizeMatch[1]) : 10) * scale,
        bold: ctx.font.includes('bold'),
        colour: styleValue(ctx.fillStyle),
        align: ctx.textAlign,
        angle: Math.atan2(matrix[1], matrix[0]),
        alpha: ctx.globalAlpha,
        clip,
      });
    },
    createLinearGradient(x0, y0, x1, y1) {
      const start = apply(matrix, x0, y0);
      const end = apply(matrix, x1, y1);
      return {
        stops: [],
        x0: start[0],
        y0: start[1],
        x1: end[0],
        y1: end[1],
        addColorStop(offset, colour) {
          this.stops.push([offset, colour]);
        },
      };
    },
  };
  function styleValue(style) {
    return typeof style === 'string' ? style : '#000000';
  }
  return ctx;
}

function recordShot(name) {
  const world = createWorld(createRandom(20261126));
  const scene = stageShot(name, world);
  const camera = createCamera(scene.view);
  camera.update(world.flight, 1280, 720);
  const commands = [];
  const ctx = createRecorder(commands);
  drawScene(ctx, camera, world, 1280, 720);
  if (camera.view === VIEW_CHASE) {
    drawAircraftShadow(ctx, camera, world.flight);
    drawChaseAircraft(ctx, camera, world.flight, world.elapsed);
  } else {
    drawCockpit(ctx, world.flight, 1280, 720);
  }
  drawHud(ctx, world, camera, 1280, 720);
  if (scene.screen === 'debrief') drawDebriefPanel(ctx, world, 1280, 720, 0);
  return commands;
}

const shots = {
  '1-cover.jpg': recordShot('cover'),
  '2-cockpit.jpg': recordShot('cockpit'),
  '3-survey.jpg': recordShot('survey'),
  '4-debrief.jpg': recordShot('debrief'),
};
process.stdout.write(JSON.stringify(shots));
