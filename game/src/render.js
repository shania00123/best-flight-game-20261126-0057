// The scene renderer: sky, sun and clouds, the projected terrain mesh, the
// runway, city blocks, the lighthouse and the ring course. Everything is
// drawn with plain canvas paths so the same code paints the browser game
// and the staged screenshot scenes.
import { TERRAIN, WORLD, clamp } from './config.js';
import { LAND, landTypeAt, terrainHeightAt } from './terrain.js';
import { MISSION_CROSSWIND, MISSION_DUSK, MISSION_RINGS, MISSION_STORM, RING_COURSE, ROUTE_GATES } from './missions.js';
import { THERMALS } from './weather.js';

const LAND_COLOURS = {
  [LAND.WATER]: ['#22749f', '#277dab', '#1e6a93'],
  [LAND.SAND]: ['#d9c48f', '#d2ba84', '#e4d09c'],
  [LAND.GRASS]: ['#5d9b4a', '#64a350', '#4e8a3e'],
  [LAND.FIELD]: ['#b7a24e', '#bda856', '#a89242'],
  [LAND.FOREST]: ['#2f6b35', '#386f3a', '#27592c'],
  [LAND.ROCK]: ['#8a7f72', '#978a7c', '#776c60'],
  [LAND.SNOW]: ['#eef2f2', '#e2e9ea', '#f7fafa'],
  [LAND.CITY]: ['#9aa0a3', '#a8adb0', '#8b9195'],
  [LAND.RUNWAY]: ['#3c4147', '#43484f', '#353a40'],
};

function shadeColour(hex, factor) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((value >> 16) & 255) * factor), 0, 255);
  const g = clamp(Math.round(((value >> 8) & 255) * factor), 0, 255);
  const b = clamp(Math.round((value & 255) * factor), 0, 255);
  return `rgb(${r},${g},${b})`;
}

function polygon(ctx, points, fill) {
  if (points.length < 3) return;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fill();
}

export function drawSky(ctx, camera, width, height, elapsed, dusk = 0) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  if (dusk > 0.6) {
    gradient.addColorStop(0, '#2b2a55');
    gradient.addColorStop(0.45, '#7a4a6b');
    gradient.addColorStop(0.72, '#e08a5a');
    gradient.addColorStop(1, '#f2c98a');
  } else if (dusk > 0.1) {
    gradient.addColorStop(0, '#3a5f9e');
    gradient.addColorStop(0.45, '#7d9fc4');
    gradient.addColorStop(0.72, '#d9b48a');
    gradient.addColorStop(1, '#e8d9b0');
  } else {
    gradient.addColorStop(0, '#2e6fc2');
    gradient.addColorStop(0.45, '#6db3e8');
    gradient.addColorStop(0.72, '#bfe0f2');
    gradient.addColorStop(1, '#e8f2e4');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  const sun = camera.project({ x: camera.position.x - 2600, y: camera.position.y + 1500, z: camera.position.z + 5200 });
  if (sun) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff8c9';
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 34, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.16 + 0.05 * Math.sin(elapsed * 0.4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, height * 0.52, width, height * 0.1);
  ctx.globalAlpha = 1;
}

export function drawClouds(ctx, camera, clouds) {
  const visible = [];
  for (const cloud of clouds) {
    const projected = camera.project(cloud);
    if (!projected || projected.depth > 8500 || projected.depth < 1100) continue;
    visible.push({ cloud, projected });
  }
  visible.sort((a, b) => b.projected.depth - a.projected.depth);
  for (const { cloud, projected } of visible) {
    const radius = Math.max(5, cloud.radius * projected.scale * 0.34);
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = '#ffffff';
    for (let puff = 0; puff < cloud.puffs; puff += 1) {
      const offsetX = (puff - (cloud.puffs - 1) / 2) * radius * 0.72;
      const offsetY = ((cloud.seed + puff * 37) % 17 - 8) * radius * 0.02;
      ctx.beginPath();
      ctx.arc(projected.x + offsetX, projected.y + offsetY, radius * (0.62 + ((cloud.seed + puff * 13) % 10) * 0.04), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#cfe4f2';
    ctx.beginPath();
    ctx.arc(projected.x, projected.y + radius * 0.32, radius * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export function drawTerrain(ctx, camera, state) {
  const step = TERRAIN.gridStep;
  const extent = TERRAIN.gridExtent;
  const originX = Math.floor(state.x / step) * step;
  const originZ = Math.floor(state.z / step) * step;
  const quads = [];
  for (let gx = -extent; gx < extent; gx += step) {
    for (let gz = -extent; gz < extent; gz += step) {
      const x0 = originX + gx;
      const z0 = originZ + gz;
      const corners = [
        { x: x0, z: z0 },
        { x: x0 + step, z: z0 },
        { x: x0 + step, z: z0 + step },
        { x: x0, z: z0 + step },
      ];
      const heights = corners.map((corner) => terrainHeightAt(corner.x, corner.z));
      const points = corners.map((corner, index) => camera.project({ x: corner.x, y: Math.max(heights[index], 0), z: corner.z }));
      if (points.some((point) => point === null)) continue;
      const depth = points.reduce((sum, point) => sum + point.depth, 0) / 4;
      if (depth > 8200) continue;
      const centreX = x0 + step / 2;
      const centreZ = z0 + step / 2;
      const centreH = heights.reduce((sum, h) => sum + h, 0) / 4;
      quads.push({ points, depth, centreX, centreZ, centreH, heights });
    }
  }
  quads.sort((a, b) => b.depth - a.depth);
  for (const quad of quads) {
    const type = landTypeAt(quad.centreX, quad.centreZ, quad.centreH);
    const palette = LAND_COLOURS[type];
    const checker = (Math.floor(quad.centreX / TERRAIN.gridStep) + Math.floor(quad.centreZ / TERRAIN.gridStep)) % 2 === 0;
    const base = palette[checker ? 0 : 1];
    const slope = Math.abs(quad.heights[2] - quad.heights[0]) + Math.abs(quad.heights[3] - quad.heights[1]);
    const light = clamp(1.08 - slope * 0.004 - quad.depth * 0.000012, 0.62, 1.12);
    polygon(ctx, quad.points, shadeColour(base, light));
    if (type === LAND.WATER && quad.depth < 2600 && (Math.floor(quad.centreX / 90) + Math.floor(quad.centreZ / 90)) % 5 === 0) {
      ctx.globalAlpha = 0.25;
      polygon(ctx, quad.points, '#bfe9ff');
      ctx.globalAlpha = 1;
    }
  }
}

export function drawRunway(ctx, camera) {
  const runway = WORLD.runway;
  const sin = Math.sin(runway.heading);
  const cos = Math.cos(runway.heading);
  function pointAt(along, across, lift) {
    return {
      x: runway.x + along * sin + across * cos,
      y: runway.elevation + lift,
      z: runway.z + along * cos - across * sin,
    };
  }
  const halfL = runway.length / 2;
  const halfW = runway.width / 2;
  const strip = [pointAt(-halfL, -halfW, 0.4), pointAt(halfL, -halfW, 0.4), pointAt(halfL, halfW, 0.4), pointAt(-halfL, halfW, 0.4)]
    .map((point) => camera.project(point));
  if (strip.every((point) => point !== null)) polygon(ctx, strip, '#33373d');
  for (let along = -halfL + 40; along < halfL - 20; along += 80) {
    const dash = [pointAt(along, -1.4, 0.7), pointAt(along + 38, -1.4, 0.7), pointAt(along + 38, 1.4, 0.7), pointAt(along, 1.4, 0.7)]
      .map((point) => camera.project(point));
    if (dash.every((point) => point !== null)) polygon(ctx, dash, '#f4f6f2');
  }
  for (const side of [-1, 1]) {
    const edge = [pointAt(-halfL, side * halfW, 0.7), pointAt(halfL, side * halfW, 0.7), pointAt(halfL, side * (halfW - 1.6), 0.7), pointAt(-halfL, side * (halfW - 1.6), 0.7)]
      .map((point) => camera.project(point));
    if (edge.every((point) => point !== null)) polygon(ctx, edge, '#e8ece7');
  }
  for (const end of [-1, 1]) {
    for (let bar = -3; bar <= 3; bar += 1) {
      const threshold = [pointAt(end * (halfL - 26), bar * 5 - 1.6, 0.7), pointAt(end * (halfL - 8), bar * 5 - 1.6, 0.7), pointAt(end * (halfL - 8), bar * 5 + 1.6, 0.7), pointAt(end * (halfL - 26), bar * 5 + 1.6, 0.7)]
        .map((point) => camera.project(point));
      if (threshold.every((point) => point !== null)) polygon(ctx, threshold, '#f4f6f2');
    }
  }
  for (const side of [-1, 1]) {
    const zoneBar = [pointAt(-halfL + 150, side * 13, 0.8), pointAt(-halfL + 330, side * 13, 0.8), pointAt(-halfL + 330, side * 16, 0.8), pointAt(-halfL + 150, side * 16, 0.8)]
      .map((point) => camera.project(point));
    if (zoneBar.every((point) => point !== null)) polygon(ctx, zoneBar, '#ffd76a');
  }
  drawRunwayLights(ctx, camera, pointAt, halfL, halfW);
}

function drawRunwayLights(ctx, camera, pointAt, halfL, halfW) {
  for (let along = -halfL; along <= halfL; along += 98) {
    for (const side of [-1, 1]) {
      const projected = camera.project(pointAt(along, side * (halfW + 4), 1.2));
      if (!projected) continue;
      const radius = clamp(projected.scale * 1.5, 1.2, 5);
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const papi = camera.project(pointAt(-halfL + 120, -(halfW + 16), 2));
  if (papi) {
    ctx.fillStyle = '#ff5a4e';
    ctx.beginPath();
    ctx.arc(papi.x - 8, papi.y, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7dff8a';
    ctx.beginPath();
    ctx.arc(papi.x + 8, papi.y, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawCity(ctx, camera, blocks) {
  const visible = [];
  for (const block of blocks) {
    const base = terrainHeightAt(block.x, block.z);
    const centre = camera.project({ x: block.x, y: base + block.height / 2, z: block.z });
    if (!centre || centre.depth > 6200) continue;
    visible.push({ block, base, depth: centre.depth });
  }
  visible.sort((a, b) => b.depth - a.depth);
  for (const { block, base } of visible) {
    drawBlock(ctx, camera, block, base);
  }
}

function drawBlock(ctx, camera, block, base) {
  const hw = block.width / 2;
  const hd = block.depth / 2;
  const top = base + block.height;
  const corners = {
    a: { x: block.x - hw, z: block.z - hd },
    b: { x: block.x + hw, z: block.z - hd },
    c: { x: block.x + hw, z: block.z + hd },
    d: { x: block.x - hw, z: block.z + hd },
  };
  function face(p1, p2, colour) {
    const points = [
      camera.project({ x: p1.x, y: base, z: p1.z }),
      camera.project({ x: p2.x, y: base, z: p2.z }),
      camera.project({ x: p2.x, y: top, z: p2.z }),
      camera.project({ x: p1.x, y: top, z: p1.z }),
    ];
    if (points.every((point) => point !== null)) polygon(ctx, points, colour);
  }
  face(corners.d, corners.c, '#7d858d');
  face(corners.b, corners.c, '#99a2a9');
  face(corners.a, corners.b, '#6d757d');
  const roof = [corners.a, corners.b, corners.c, corners.d].map((corner) => camera.project({ x: corner.x, y: top, z: corner.z }));
  if (roof.every((point) => point !== null)) polygon(ctx, roof, '#c8ced2');
  const window = camera.project({ x: block.x, y: base + block.height * 0.62, z: block.z + hd });
  if (window && window.depth < 2400) {
    ctx.fillStyle = '#ffe9a3';
    const size = clamp(window.scale * 3.2, 1, 5);
    ctx.fillRect(window.x - size, window.y - size * 0.6, size * 2, size * 1.2);
  }
}

export function drawLighthouse(ctx, camera, elapsed) {
  const { x, z } = WORLD.lighthouse;
  const base = Math.max(terrainHeightAt(x, z), 2);
  const segments = [
    { from: 0, to: 16, colour: '#f2f0e9' },
    { from: 16, to: 30, colour: '#d84a3a' },
    { from: 30, to: 44, colour: '#f2f0e9' },
    { from: 44, to: 56, colour: '#d84a3a' },
  ];
  for (const segment of segments) {
    const points = [
      camera.project({ x: x - 6, y: base + segment.from, z }),
      camera.project({ x: x + 6, y: base + segment.from, z }),
      camera.project({ x: x + 5, y: base + segment.to, z }),
      camera.project({ x: x - 5, y: base + segment.to, z }),
    ];
    if (points.every((point) => point !== null)) polygon(ctx, points, segment.colour);
  }
  const lamp = camera.project({ x, y: base + 60, z });
  if (lamp) {
    const pulse = 0.55 + 0.45 * Math.sin(elapsed * 2.4);
    ctx.globalAlpha = 0.3 + pulse * 0.4;
    ctx.fillStyle = '#fff2a8';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, clamp(lamp.scale * 14, 4, 26), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fffbe0';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, clamp(lamp.scale * 4, 2, 7), 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawThermals(ctx, camera, elapsed) {
  for (const thermal of THERMALS) {
    const base = camera.project({ x: thermal.x, y: Math.max(terrainHeightAt(thermal.x, thermal.z), 0), z: thermal.z });
    const top = camera.project({ x: thermal.x, y: thermal.top, z: thermal.z });
    if (!base || !top || base.depth > 7000) continue;
    ctx.globalAlpha = 0.16 + 0.05 * Math.sin(elapsed * 1.8 + thermal.x);
    ctx.strokeStyle = '#ffe9a3';
    ctx.lineWidth = clamp(base.scale * 3, 2, 7);
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(top.x, top.y);
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffe9a3';
    ctx.beginPath();
    ctx.arc(top.x, top.y, clamp(top.scale * 5, 3, 12), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export function drawRouteGates(ctx, camera, world, elapsed) {
  if (!world.mission.routeChoice || world.ringsDone !== 2 || world.routeTaken) return;
  for (const gate of ROUTE_GATES) {
    drawRing(ctx, camera, gate, gate.id === 'shortcut' ? '#ff7a59' : '#7dff8a', true, elapsed);
    const projected = camera.project(gate);
    if (projected) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${gate.label} +${gate.points}`, projected.x, projected.y - clamp(projected.scale * 16, 24, 70));
    }
  }
}

export function drawGhostAircraft(ctx, camera, ghost) {
  if (!ghost) return;
  const centre = camera.project(ghost);
  if (!centre || centre.depth > 6000) return;
  const unit = clamp(centre.scale * 1.35, 2, 9);
  ctx.save();
  ctx.translate(centre.x, centre.y);
  ctx.rotate(-(ghost.roll || 0) * 0.62);
  ctx.scale(unit, unit);
  ctx.globalAlpha = 0.62;
  ctx.fillStyle = '#37e0d9';
  ctx.beginPath();
  ctx.moveTo(-14, 1);
  ctx.lineTo(14, 1);
  ctx.lineTo(3, 3);
  ctx.lineTo(-3, 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b8fffa';
  ctx.fillRect(-2.6, -5, 5.2, 9);
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.fillStyle = '#37e0d9';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('GHOST', centre.x, centre.y - unit * 8);
}

export function drawRings(ctx, camera, world, elapsed) {
  if (![MISSION_RINGS, MISSION_STORM, MISSION_DUSK, MISSION_CROSSWIND].includes(world.mission.id)) return;
  if (world.mission.id === MISSION_CROSSWIND) {
    drawRing(ctx, camera, { x: -1150, y: 260, z: 400, heading: 0.4 }, '#ffb52e', world.ringsDone < 1, elapsed);
    return;
  }
  const ordered = RING_COURSE.map((ring, index) => {
    const projected = camera.project(ring);
    return { ring, index, depth: projected ? projected.depth : 99999 };
  }).sort((a, b) => b.depth - a.depth);
  for (const { ring, index } of ordered) {
    const isNext = index === world.ringsDone;
    const isDone = index < world.ringsDone;
    drawRing(ctx, camera, ring, isNext ? '#ffb52e' : isDone ? '#4ade80' : '#37c8d9', isNext, elapsed);
    if (isNext) drawRingBeacon(ctx, camera, ring, elapsed);
  }
}

function drawRing(ctx, camera, ring, colour, isNext, elapsed) {
  const radius = 58;
  const sin = Math.sin(ring.heading);
  const cos = Math.cos(ring.heading);
  const points = [];
  for (let i = 0; i < 28; i += 1) {
    const angle = (i / 28) * Math.PI * 2;
    const across = Math.cos(angle) * radius;
    const up = Math.sin(angle) * radius;
    const projected = camera.project({
      x: ring.x + across * cos,
      y: ring.y + up,
      z: ring.z - across * sin,
    });
    if (!projected) return;
    points.push(projected);
  }
  ctx.strokeStyle = colour;
  ctx.lineWidth = isNext ? 7 : 4;
  ctx.globalAlpha = isNext ? 0.95 : 0.75;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 0.14 + (isNext ? 0.08 * Math.sin(elapsed * 3) : 0);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawRingBeacon(ctx, camera, ring, elapsed) {
  const ground = terrainHeightAt(ring.x, ring.z);
  const top = camera.project({ x: ring.x, y: ring.y + 260, z: ring.z });
  const bottom = camera.project({ x: ring.x, y: Math.max(ground, 0), z: ring.z });
  if (!top || !bottom) return;
  ctx.globalAlpha = 0.2 + 0.08 * Math.sin(elapsed * 2.2);
  ctx.strokeStyle = '#ffb52e';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(bottom.x, bottom.y);
  ctx.lineTo(top.x, top.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function drawScene(ctx, camera, world, width, height) {
  const dusk = world.mission.weather ? world.mission.weather.dusk : 0;
  drawSky(ctx, camera, width, height, world.elapsed, dusk);
  drawTerrain(ctx, camera, world.flight);
  drawRunway(ctx, camera);
  drawCity(ctx, camera, world.cityBlocks);
  drawLighthouse(ctx, camera, world.elapsed);
  drawThermals(ctx, camera, world.elapsed);
  drawRings(ctx, camera, world, world.elapsed);
  drawRouteGates(ctx, camera, world, world.elapsed);
  drawGhostAircraft(ctx, camera, world.ghostNow ? world.ghostNow() : null);
  drawClouds(ctx, camera, world.clouds);
}
