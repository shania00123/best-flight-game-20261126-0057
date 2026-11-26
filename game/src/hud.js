// The heads-up display and screen panels: compass, speed and altitude tapes,
// the minimap, mission readouts, warnings, and the title, pause and debrief
// screens. Numbers are drawn large and high-contrast so they stay readable
// at a glance in flight and in a shrunken screenshot.
import { WORLD, clamp, feetFromMetres, headingDegrees, knotsFromMetresPerSecond } from './config.js';
import { bearingTo, distanceTo, shortestAngle } from './flight.js';
import { MISSIONS, RING_COURSE, SURVEY_POINTS } from './missions.js';
import { coastXAt, ridgeXAt } from './terrain.js';
import { PHASE_COMPLETE, PHASE_FAILED, formatClock } from './world.js';

function panel(ctx, x, y, width, height, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#0e1622';
  ctx.fillRect(x, y, width, height);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#5ec8e6';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
}

function text(ctx, value, x, y, size, colour, align, bold) {
  ctx.fillStyle = colour;
  ctx.font = `${bold ? 'bold ' : ''}${size}px Arial`;
  ctx.textAlign = align || 'left';
  ctx.fillText(value, x, y);
}

export function drawHud(ctx, world, camera, width, height) {
  const state = world.flight;
  drawCompassTape(ctx, state, width);
  drawSpeedTape(ctx, state, height);
  drawAltitudeTape(ctx, state, width, height);
  drawPitchLadder(ctx, state, width, height);
  drawMissionPanel(ctx, world, width);
  drawMinimap(ctx, world, height, camera.view);
  drawTargetArrow(ctx, world, camera, width, height);
  drawWarnings(ctx, world, width, height);
  drawMessageBanner(ctx, world, width, height, camera.view);
  drawControlsHint(ctx, width, height);
}

function drawCompassTape(ctx, state, width) {
  const tapeWidth = Math.min(520, width * 0.44);
  const x = width / 2 - tapeWidth / 2;
  panel(ctx, x, 12, tapeWidth, 54, 0.72);
  const heading = headingDegrees(state.heading);
  const pxPerDegree = tapeWidth / 90;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 3, 15, tapeWidth - 6, 48);
  ctx.clip();
  const firstTick = Math.floor((heading - 50) / 5) * 5;
  for (let value = firstTick; value <= heading + 50; value += 5) {
    const wrapped = ((value % 360) + 360) % 360;
    const tickX = width / 2 + (value - heading) * pxPerDegree;
    const major = wrapped % 30 === 0;
    ctx.strokeStyle = major ? '#eaf6ff' : '#7fa8c4';
    ctx.lineWidth = major ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(tickX, 48);
    ctx.lineTo(tickX, major ? 34 : 40);
    ctx.stroke();
    if (major) {
      const label = wrapped === 0 ? 'N' : wrapped === 90 ? 'E' : wrapped === 180 ? 'S' : wrapped === 270 ? 'W' : String(wrapped);
      text(ctx, label, tickX, 30, 17, wrapped === 0 ? '#ff9a8a' : '#eaf6ff', 'center', true);
    }
  }
  ctx.restore();
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.moveTo(width / 2, 62);
  ctx.lineTo(width / 2 - 8, 50);
  ctx.lineTo(width / 2 + 8, 50);
  ctx.closePath();
  ctx.fill();
  text(ctx, `HDG ${String(Math.round(heading)).padStart(3, '0')}`, width / 2, 86, 19, '#ffe9a3', 'center', true);
}

function drawSpeedTape(ctx, state, height) {
  const x = 14;
  const y = height * 0.3;
  const tapeHeight = height * 0.36;
  panel(ctx, x, y, 92, tapeHeight, 0.72);
  const knots = knotsFromMetresPerSecond(state.speed);
  const centreY = y + tapeHeight / 2;
  for (let offset = -40; offset <= 40; offset += 10) {
    const value = Math.round(knots + offset);
    if (value < 0) continue;
    const tickY = centreY - offset * 2.1;
    ctx.strokeStyle = '#7fa8c4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 58, tickY);
    ctx.lineTo(x + 78, tickY);
    ctx.stroke();
    text(ctx, String(value), x + 50, tickY + 5, 14, '#cfe9f7', 'right', false);
  }
  ctx.fillStyle = state.stalled ? '#ff3b30' : '#ffd76a';
  ctx.fillRect(x + 4, centreY - 17, 84, 34);
  text(ctx, `${Math.round(knots)}`, x + 46, centreY + 8, 24, '#14181f', 'center', true);
  text(ctx, 'KNOTS', x + 46, y + 20, 14, '#eaf6ff', 'center', true);
  text(ctx, `THR ${Math.round(state.throttle * 100)}%`, x + 46, y + tapeHeight + 24, 15, '#ffe9a3', 'center', true);
}

function drawAltitudeTape(ctx, state, width, height) {
  const tapeWidth = 104;
  const x = width - tapeWidth - 14;
  const y = height * 0.3;
  const tapeHeight = height * 0.36;
  panel(ctx, x, y, tapeWidth, tapeHeight, 0.72);
  const feet = feetFromMetres(Math.max(state.y, 0));
  const centreY = y + tapeHeight / 2;
  for (let offset = -400; offset <= 400; offset += 100) {
    const value = Math.round(feet + offset);
    if (value < 0) continue;
    const tickY = centreY - offset * 0.22;
    ctx.strokeStyle = '#7fa8c4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 12, tickY);
    ctx.lineTo(x + 32, tickY);
    ctx.stroke();
    text(ctx, String(value), x + 38, tickY + 5, 13, '#cfe9f7', 'left', false);
  }
  ctx.fillStyle = '#ffd76a';
  ctx.fillRect(x + 4, centreY - 17, tapeWidth - 8, 34);
  text(ctx, `${Math.round(feet)}`, x + tapeWidth / 2, centreY + 8, 23, '#14181f', 'center', true);
  text(ctx, 'ALT FT', x + tapeWidth / 2, y + 20, 14, '#eaf6ff', 'center', true);
  const vs = Math.round(state.verticalSpeed * 196.85);
  text(ctx, `V/S ${vs > 0 ? '+' : ''}${vs}`, x + tapeWidth / 2, y + tapeHeight + 24, 15, vs < -600 ? '#ff9a8a' : '#9dff9d', 'center', true);
}

function drawPitchLadder(ctx, state, width, height) {
  const cx = width / 2;
  const cy = height * 0.42;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-state.roll * 0.55);
  const pitchPx = clamp(state.pitch * 160, -70, 70);
  for (const mark of [-20, -10, 0, 10, 20]) {
    const y = pitchPx - mark * 2.2;
    const half = mark === 0 ? 110 : 62;
    ctx.strokeStyle = mark === 0 ? '#7dff8a' : '#bfe9ff';
    ctx.lineWidth = mark === 0 ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(-half, y);
    ctx.lineTo(-26, y);
    ctx.moveTo(26, y);
    ctx.lineTo(half, y);
    ctx.stroke();
    if (mark !== 0) text(ctx, String(Math.abs(mark)), half + 16, y + 5, 13, '#bfe9ff', 'left', false);
  }
  ctx.restore();
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy);
  ctx.lineTo(cx - 10, cy);
  ctx.moveTo(cx + 10, cy);
  ctx.lineTo(cx + 24, cy);
  ctx.stroke();
}

function drawMissionPanel(ctx, world, width) {
  const panelWidth = 330;
  const x = width - panelWidth - 14;
  panel(ctx, x, 12, panelWidth, 118, 0.78);
  text(ctx, world.mission.name.toUpperCase(), x + 14, 40, 20, '#ffd76a', 'left', true);
  text(ctx, world.objectiveLabel(), x + 14, 66, 16, '#eaf6ff', 'left', true);
  text(ctx, `SCORE ${world.score}`, x + 14, 92, 19, '#7dff8a', 'left', true);
  text(ctx, `TIME ${formatClock(world.elapsed)}`, x + 150, 92, 17, '#cfe9f7', 'left', true);
  const state = world.flight;
  text(ctx, `FUEL ${Math.round(state.fuel)}`, x + 14, 116, 15, state.fuel < 18 ? '#ff9a8a' : '#7fe3ff', 'left', true);
  text(ctx, `DMG ${Math.round(state.damage)}%`, x + 110, 116, 15, state.damage > 40 ? '#ff9a8a' : '#cfe9f7', 'left', true);
  text(ctx, state.gearDown ? 'GEAR DOWN' : 'GEAR UP', x + 205, 116, 15, state.gearDown ? '#9dff9d' : '#ffd76a', 'left', true);
  if (world.mission.id === 'ridge-rings') {
    for (let i = 0; i < RING_COURSE.length; i += 1) {
      ctx.fillStyle = i < world.ringsDone ? '#43e06b' : i === world.ringsDone ? '#ffb52e' : '#4a6b80';
      ctx.beginPath();
      ctx.arc(x + panelWidth - 26 - (RING_COURSE.length - 1 - i) * 22, 34, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (world.photoHold > 0) {
    ctx.fillStyle = '#0e1622';
    ctx.fillRect(x + 14, 122, panelWidth - 28, 0);
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(x + 14, 124, (panelWidth - 28) * clamp(world.photoHold / 1.4, 0, 1), 5);
  }
}

function drawMinimap(ctx, world, height, view) {
  const cockpit = view === 'cockpit';
  const size = cockpit ? 150 : 196;
  const x = 14;
  const y = cockpit ? 14 : height - size - 46;
  panel(ctx, x, y, size, size, 0.82);
  const scale = size / 7600;
  function mapX(worldX) {
    return x + size / 2 + worldX * scale;
  }
  function mapY(worldZ) {
    return y + size / 2 - worldZ * scale;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 2, y + 2, size - 4, size - 4);
  ctx.clip();
  ctx.fillStyle = '#2b84b8';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#5d9b4a';
  ctx.beginPath();
  ctx.moveTo(mapX(coastXAt(3800)), mapY(3800));
  for (let z = 3800; z >= -3800; z -= 380) ctx.lineTo(mapX(coastXAt(z)), mapY(z));
  ctx.lineTo(x + size, y + size);
  ctx.lineTo(x + size, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8a7f72';
  ctx.beginPath();
  ctx.moveTo(mapX(ridgeXAt(3800)), mapY(3800));
  for (let z = 3800; z >= -3800; z -= 380) ctx.lineTo(mapX(ridgeXAt(z)), mapY(z));
  ctx.lineTo(x + size, y + size);
  ctx.lineTo(x + size, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2b84b8';
  ctx.beginPath();
  ctx.arc(mapX(WORLD.lake.x), mapY(WORLD.lake.z), WORLD.lake.radius * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c8ced2';
  ctx.beginPath();
  ctx.arc(mapX(WORLD.city.x), mapY(WORLD.city.z), WORLD.city.radius * scale * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f4f6f2';
  ctx.fillRect(mapX(WORLD.runway.x) - 3, mapY(WORLD.runway.z) - 16, 6, 32);
  if (world.mission.id === 'ridge-rings') {
    RING_COURSE.forEach((ring, index) => {
      ctx.strokeStyle = index < world.ringsDone ? '#43e06b' : index === world.ringsDone ? '#ffb52e' : '#37c8d9';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(mapX(ring.x), mapY(ring.z), 6, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
  if (world.mission.id === 'coastal-survey') {
    SURVEY_POINTS.forEach((point, index) => {
      ctx.fillStyle = index < world.photosDone ? '#43e06b' : index === world.photosDone ? '#ffb52e' : '#eaf6ff';
      ctx.beginPath();
      ctx.arc(mapX(point.x), mapY(point.z), 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  const state = world.flight;
  const px = mapX(state.x);
  const py = mapY(state.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(state.heading);
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(-6, 7);
  ctx.lineTo(0, 3);
  ctx.lineTo(6, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  text(ctx, 'N', x + size - 16, y + 20, 15, '#ff9a8a', 'center', true);
  text(ctx, 'KESTREL RIDGE', x + size / 2, y + size + 20, 13, '#cfe9f7', 'center', true);
}

function drawTargetArrow(ctx, world, camera, width, height) {
  const target = world.currentTarget();
  if (!target) return;
  const projected = camera.project(target);
  const state = world.flight;
  const dist = Math.round(distanceTo(state, target));
  if (projected && projected.x > 90 && projected.x < width - 90 && projected.y > 90 && projected.y < height - 90) {
    ctx.strokeStyle = '#ffb52e';
    ctx.lineWidth = 3;
    const size = clamp(projected.scale * 8, 14, 42);
    ctx.beginPath();
    ctx.moveTo(projected.x, projected.y - size);
    ctx.lineTo(projected.x + size * 0.7, projected.y);
    ctx.lineTo(projected.x, projected.y + size);
    ctx.lineTo(projected.x - size * 0.7, projected.y);
    ctx.closePath();
    ctx.stroke();
    text(ctx, `${dist} m`, projected.x, projected.y + size + 22, 16, '#ffe9a3', 'center', true);
    return;
  }
  const relative = shortestAngle(bearingTo(state, target) - state.heading);
  const cx = width / 2 + clamp(relative, -1.2, 1.2) * width * 0.3;
  const cy = height * 0.2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(clamp(relative, -1.4, 1.4));
  ctx.fillStyle = '#ffb52e';
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(-11, 10);
  ctx.lineTo(0, 4);
  ctx.lineTo(11, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  text(ctx, `${dist} m`, cx, cy + 34, 16, '#ffe9a3', 'center', true);
}

function drawWarnings(ctx, world, width, height) {
  const state = world.flight;
  const warnings = [];
  if (state.stalled && !state.onGround) warnings.push({ label: 'STALL: NOSE DOWN, ADD POWER', colour: '#ff3b30' });
  if (state.engineOut && !state.onGround) warnings.push({ label: 'ENGINE OUT: GLIDE TO THE STRIP', colour: '#ff9f2e' });
  if (!state.gearDown && state.y - 0 < 260 && !state.onGround && state.verticalSpeed < -1) warnings.push({ label: 'GEAR UP: PRESS G', colour: '#ffd76a' });
  if (state.fuel < 15 && !state.engineOut) warnings.push({ label: 'LOW FUEL', colour: '#ff9f2e' });
  warnings.slice(0, 2).forEach((warning, index) => {
    const y = height * 0.24 + index * 44;
    const flash = Math.sin(world.elapsed * 7) > -0.4;
    if (!flash && index === 0) return;
    panel(ctx, width / 2 - 230, y - 26, 460, 38, 0.85);
    text(ctx, warning.label, width / 2, y, 20, warning.colour, 'center', true);
  });
}

function drawMessageBanner(ctx, world, width, height, view) {
  if (world.elapsed > world.messageUntil || !world.message) return;
  if (view === 'cockpit') {
    panel(ctx, width / 2 - 280, 104, 560, 40, 0.78);
    text(ctx, world.message, width / 2, 130, 17, '#eaf6ff', 'center', true);
    return;
  }
  panel(ctx, width / 2 - 320, height - 104, 640, 42, 0.78);
  text(ctx, world.message, width / 2, height - 77, 18, '#eaf6ff', 'center', true);
}

function drawControlsHint(ctx, width, height) {
  text(ctx, 'Arrows fly · W/S throttle · A/D rudder · F flaps · G gear · C camera · P pause', width / 2, height - 14, 14, '#dceef8', 'center', false);
}

export function drawTitleScreen(ctx, world, width, height, best) {
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#08111d';
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;
  text(ctx, 'KESTREL RIDGE', width / 2, height * 0.2, 64, '#ffd76a', 'center', true);
  text(ctx, 'Coastal flight trials in the Kestrel K-7', width / 2, height * 0.2 + 42, 22, '#eaf6ff', 'center', false);
  const panelWidth = Math.min(760, width * 0.72);
  const x = width / 2 - panelWidth / 2;
  panel(ctx, x, height * 0.3, panelWidth, height * 0.42, 0.88);
  MISSIONS.forEach((mission, index) => {
    const y = height * 0.3 + 52 + index * 62;
    text(ctx, `${index + 1}. ${mission.name}`, x + 30, y, 24, '#ffe9a3', 'left', true);
    text(ctx, mission.brief, x + 30, y + 26, 16, '#cfe9f7', 'left', false);
  });
  text(ctx, 'Press 1-4 or click a sortie to fly', width / 2, height * 0.78, 20, '#7dff8a', 'center', true);
  text(ctx, 'Arrows pitch and roll · W/S throttle · A/D rudder · mouse drag steers · wheel throttle', width / 2, height * 0.78 + 30, 15, '#dceef8', 'center', false);
  if (best > 0) text(ctx, `Best score: ${best}`, width / 2, height * 0.78 + 58, 16, '#ffe9a3', 'center', true);
}

export function drawPauseOverlay(ctx, width, height) {
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#08111d';
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;
  text(ctx, 'PAUSED', width / 2, height * 0.44, 52, '#ffd76a', 'center', true);
  text(ctx, 'P or Enter to resume · R to restart the sortie', width / 2, height * 0.44 + 42, 19, '#eaf6ff', 'center', false);
}

export function drawDebriefPanel(ctx, world, width, height, best) {
  const complete = world.phase === PHASE_COMPLETE;
  const failed = world.phase === PHASE_FAILED;
  if (!complete && !failed) return;
  const panelWidth = Math.min(640, width * 0.6);
  const panelHeight = 330;
  const x = width / 2 - panelWidth / 2;
  const y = height * 0.2;
  panel(ctx, x, y, panelWidth, panelHeight, 0.92);
  text(ctx, complete ? 'SORTIE COMPLETE' : 'SORTIE FAILED', width / 2, y + 52, 36, complete ? '#7dff8a' : '#ff9a8a', 'center', true);
  text(ctx, world.mission.name, width / 2, y + 84, 19, '#ffe9a3', 'center', true);
  if (world.flight.lastLanding) {
    text(ctx, world.flight.lastLanding.label, width / 2, y + 112, 16, '#cfe9f7', 'center', false);
  }
  let lineY = y + 146;
  world.breakdown.slice(-6).forEach((entry) => {
    text(ctx, entry.label, x + 34, lineY, 16, '#eaf6ff', 'left', false);
    text(ctx, `+${entry.points}`, x + panelWidth - 34, lineY, 16, '#7dff8a', 'right', true);
    lineY += 26;
  });
  text(ctx, `TOTAL ${world.score}`, width / 2, y + panelHeight - 62, 28, '#ffd76a', 'center', true);
  text(ctx, `Time ${formatClock(world.elapsed)} · Best ${Math.max(best, world.score)}`, width / 2, y + panelHeight - 34, 15, '#cfe9f7', 'center', false);
  text(ctx, 'Enter: fly again · Esc: choose sortie', width / 2, y + panelHeight + 34, 17, '#eaf6ff', 'center', true);
}

export function titleMissionAt(width, height, px, py) {
  const panelWidth = Math.min(760, width * 0.72);
  const x = width / 2 - panelWidth / 2;
  if (px < x || px > x + panelWidth) return null;
  for (let index = 0; index < MISSIONS.length; index += 1) {
    const y = height * 0.3 + 52 + index * 62;
    if (py >= y - 30 && py <= y + 32) return MISSIONS[index].id;
  }
  return null;
}
