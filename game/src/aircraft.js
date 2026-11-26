// The Kestrel K-7 itself: the chase-view airframe with its shadow, and the
// lit cockpit with dial gauges. Both views are drawn from the live flight
// state, so needles, gear legs and warning lamps always tell the truth.
import { clamp, feetFromMetres, headingDegrees, knotsFromMetresPerSecond } from './config.js';
import { terrainHeightAt } from './terrain.js';

function poly(ctx, points, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

export function drawAircraftShadow(ctx, camera, state) {
  const ground = terrainHeightAt(state.x, state.z);
  const clearance = state.y - ground;
  if (clearance > 420) return;
  const projected = camera.project({ x: state.x + 14, y: Math.max(ground, 0) + 0.6, z: state.z - 8 });
  if (!projected) return;
  const size = clamp(projected.scale * 9, 4, 60);
  ctx.globalAlpha = clamp(0.42 - clearance * 0.0007, 0.06, 0.42);
  ctx.fillStyle = '#10240f';
  ctx.beginPath();
  ctx.arc(projected.x, projected.y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawChaseAircraft(ctx, camera, state, elapsed) {
  const centre = camera.project({ x: state.x, y: state.y, z: state.z });
  if (!centre) return;
  const unit = clamp(centre.scale, 2.2, 9);
  const bank = -state.roll * 0.62;
  const pitchTilt = clamp(-state.pitch * 0.5, -0.3, 0.3);
  ctx.save();
  ctx.translate(centre.x, centre.y + pitchTilt * unit * 4);
  ctx.rotate(bank);
  ctx.scale(unit, unit);
  drawAirframe(ctx, state, elapsed);
  ctx.restore();
}

function drawAirframe(ctx, state, elapsed) {
  const gearOut = state.gearTransit < 0.6;
  poly(ctx, [[-16, 1.2], [-3.4, -0.6], [-3.4, 1.8], [-16, 3.1]], '#c33d2e');
  poly(ctx, [[16, 1.2], [3.4, -0.6], [3.4, 1.8], [16, 3.1]], '#a93226');
  poly(ctx, [[-16, 1.2], [-11, 0.2], [-11, 2.6], [-16, 3.1]], '#e8e4da');
  poly(ctx, [[16, 1.2], [11, 0.2], [11, 2.6], [16, 3.1]], '#ddd8cc');
  poly(ctx, [[-3.2, -5.4], [3.2, -5.4], [2.5, 4.6], [-2.5, 4.6]], '#d8d2c4');
  poly(ctx, [[-3.2, -5.4], [0, -5.4], [0, 4.6], [-2.5, 4.6]], '#efe9dc');
  poly(ctx, [[-2.2, -4.2], [2.2, -4.2], [1.7, -0.8], [-1.7, -0.8]], '#274b63');
  poly(ctx, [[-1.5, -4.0], [0.4, -4.0], [0.2, -1.6], [-1.2, -1.6]], '#7fc4e8');
  poly(ctx, [[-0.7, 3.4], [0.7, 3.4], [0.55, 7.6], [-0.55, 7.6]], '#c33d2e');
  poly(ctx, [[-5.6, 6.2], [5.6, 6.2], [5.0, 7.8], [-5.0, 7.8]], '#b9b2a2');
  poly(ctx, [[-0.55, 7.6], [0.55, 7.6], [0.4, 9.4], [-0.4, 9.4]], '#8f8878');
  ctx.fillStyle = '#2b2f36';
  ctx.fillRect(-3.4, -6.4, 6.8, 1.4);
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#e9f2f7';
  ctx.beginPath();
  ctx.arc(0, -6.9, 3.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#d7e6ee';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.arc(0, -6.9, 3.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (gearOut) {
    ctx.strokeStyle = '#3a3f46';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-4.4, 2.2);
    ctx.lineTo(-4.8, 5.2);
    ctx.moveTo(4.4, 2.2);
    ctx.lineTo(4.8, 5.2);
    ctx.moveTo(0, 4.4);
    ctx.lineTo(0, 6.4);
    ctx.stroke();
    ctx.fillStyle = '#22262c';
    ctx.beginPath();
    ctx.arc(-4.8, 5.6, 1.0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4.8, 5.6, 1.0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 6.8, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  const blink = Math.sin(elapsed * 6) > 0.2;
  ctx.fillStyle = '#ff4b3e';
  ctx.beginPath();
  ctx.arc(-16.2, 2.2, 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#43e06b';
  ctx.beginPath();
  ctx.arc(16.2, 2.2, 0.75, 0, Math.PI * 2);
  ctx.fill();
  if (blink) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 9.6, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f5c542';
  ctx.font = 'bold 1.7px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('K7', 0, 6.9);
}

export function drawCockpit(ctx, state, width, height) {
  drawWindshieldFrame(ctx, width, height);
  drawInstrumentPanel(ctx, state, width, height);
  drawYoke(ctx, state, width, height);
  drawFlightPathMarker(ctx, state, width, height);
}

function drawWindshieldFrame(ctx, width, height) {
  ctx.fillStyle = '#1c2129';
  poly(ctx, [[0, 0], [width * 0.09, 0], [width * 0.16, height * 0.62], [0, height * 0.62]], '#1c2129');
  poly(ctx, [[width, 0], [width * 0.91, 0], [width * 0.84, height * 0.62], [width, height * 0.62]], '#1c2129');
  ctx.fillRect(0, 0, width, height * 0.045);
  poly(ctx, [[width * 0.494, 0], [width * 0.506, 0], [width * 0.502, height * 0.16], [width * 0.498, height * 0.16]], '#232a34');
  ctx.fillStyle = '#39424f';
  ctx.fillRect(width * 0.16, height * 0.6, width * 0.68, 5);
}

function drawInstrumentPanel(ctx, state, width, height) {
  const top = height * 0.62;
  ctx.fillStyle = '#232a34';
  ctx.fillRect(0, top, width, height - top);
  ctx.fillStyle = '#2e3744';
  ctx.fillRect(0, top, width, 8);
  ctx.fillStyle = '#171c23';
  ctx.fillRect(width * 0.06, top + 18, width * 0.88, height - top - 30);
  const cy = top + (height - top) * 0.52;
  const radius = Math.min(64, width * 0.052);
  drawDialGauge(ctx, width * 0.17, cy, radius, 'KNOTS', knotsFromMetresPerSecond(state.speed), 0, 190, '#7fe3ff');
  drawArtificialHorizon(ctx, width * 0.32, cy, radius, state);
  drawDialGauge(ctx, width * 0.47, cy, radius, 'ALT FT', feetFromMetres(Math.max(state.y, 0)) / 10, 0, 320, '#ffe08a');
  drawCompassDial(ctx, width * 0.62, cy, radius, state);
  drawDialGauge(ctx, width * 0.77, cy, radius, 'V/S', clamp(state.verticalSpeed * 2, -20, 20) + 20, 0, 40, '#9dff9d');
  drawThrottleAndFuel(ctx, state, width * 0.9, cy, radius);
  drawWarningLamps(ctx, state, width, top);
}

function drawDialGauge(ctx, cx, cy, radius, label, value, min, max, colour) {
  ctx.fillStyle = '#0d1117';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8b98a8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  for (let tick = 0; tick <= 10; tick += 1) {
    const angle = Math.PI * 0.75 + (tick / 10) * Math.PI * 1.5;
    const x1 = cx + Math.cos(angle) * radius * 0.78;
    const y1 = cy + Math.sin(angle) * radius * 0.78;
    const x2 = cx + Math.cos(angle) * radius * 0.92;
    const y2 = cy + Math.sin(angle) * radius * 0.92;
    ctx.strokeStyle = '#d7e2ec';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  const fraction = clamp((value - min) / (max - min), 0, 1);
  const needle = Math.PI * 0.75 + fraction * Math.PI * 1.5;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(needle) * radius * 0.74, cy + Math.sin(needle) * radius * 0.74);
  ctx.stroke();
  ctx.fillStyle = '#e8eef4';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#cfe0ee';
  ctx.font = `bold ${Math.max(11, radius * 0.24)}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + radius * 0.52);
  ctx.fillStyle = colour;
  ctx.font = `bold ${Math.max(13, radius * 0.3)}px Arial`;
  const shown = label === 'ALT FT' ? String(Math.round(value * 10)) : label === 'V/S' ? (stateSign(value - 20)) : String(Math.round(value));
  ctx.fillText(shown, cx, cy - radius * 0.34);
}

function stateSign(value) {
  const rounded = Math.round(value / 2);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function drawArtificialHorizon(ctx, cx, cy, radius, state) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-state.roll);
  const pitchPx = clamp(state.pitch * radius * 1.5, -radius, radius);
  ctx.fillStyle = '#3f7fbf';
  ctx.fillRect(-radius * 1.4, -radius * 1.4 + pitchPx, radius * 2.8, radius * 1.4);
  ctx.fillStyle = '#7a5a33';
  ctx.fillRect(-radius * 1.4, pitchPx, radius * 2.8, radius * 1.4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-radius * 1.4, pitchPx - 1.5, radius * 2.8, 3);
  ctx.restore();
  ctx.strokeStyle = '#8b98a8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - radius * 0.55, cy);
  ctx.lineTo(cx - radius * 0.18, cy);
  ctx.moveTo(cx + radius * 0.18, cy);
  ctx.lineTo(cx + radius * 0.55, cy);
  ctx.stroke();
  ctx.fillStyle = '#cfe0ee';
  ctx.font = `bold ${Math.max(11, radius * 0.24)}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText('HORIZON', cx, cy + radius * 0.78);
}

function drawCompassDial(ctx, cx, cy, radius, state) {
  ctx.fillStyle = '#0d1117';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8b98a8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  const heading = headingDegrees(state.heading);
  const labels = ['N', 'E', 'S', 'W'];
  ctx.font = `bold ${Math.max(13, radius * 0.3)}px Arial`;
  ctx.textAlign = 'center';
  for (let i = 0; i < 4; i += 1) {
    const angle = ((i * 90 - heading) * Math.PI) / 180 - Math.PI / 2;
    ctx.fillStyle = i === 0 ? '#ff8a7a' : '#d7e2ec';
    ctx.fillText(labels[i], cx + Math.cos(angle) * radius * 0.66, cy + Math.sin(angle) * radius * 0.66 + 5);
  }
  ctx.fillStyle = '#ffd76a';
  poly(ctx, [[cx, cy - radius * 0.92], [cx - 6, cy - radius * 0.72], [cx + 6, cy - radius * 0.72]], '#ffd76a');
  ctx.fillStyle = '#ffe08a';
  ctx.font = `bold ${Math.max(14, radius * 0.32)}px Arial`;
  ctx.fillText(String(Math.round(heading)).padStart(3, '0'), cx, cy + 6);
  ctx.fillStyle = '#cfe0ee';
  ctx.font = `bold ${Math.max(11, radius * 0.24)}px Arial`;
  ctx.fillText('HEADING', cx, cy + radius * 0.52);
}

function drawThrottleAndFuel(ctx, state, cx, cy, radius) {
  const trackH = radius * 1.5;
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(cx - 16, cy - trackH / 2, 32, trackH);
  ctx.strokeStyle = '#8b98a8';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - 16, cy - trackH / 2, 32, trackH);
  const leverY = cy + trackH / 2 - state.throttle * trackH;
  ctx.fillStyle = '#e8eef4';
  ctx.fillRect(cx - 22, leverY - 5, 44, 10);
  ctx.fillStyle = '#cfe0ee';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('THR', cx, cy + trackH / 2 + 18);
  const fuelY = cy + trackH / 2 + 34;
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(cx - 30, fuelY, 60, 10);
  ctx.fillStyle = state.fuel < 18 ? '#ff5a4e' : '#7fe3ff';
  ctx.fillRect(cx - 30, fuelY, 60 * clamp(state.fuel / 100, 0, 1), 10);
  ctx.fillStyle = '#cfe0ee';
  ctx.fillText('FUEL', cx, fuelY + 24);
}

function drawWarningLamps(ctx, state, width, top) {
  const lamps = [
    { label: 'STALL', on: state.stalled, colour: '#ff3b30' },
    { label: 'GEAR', on: state.gearDown && state.gearTransit < 0.1, colour: '#43e06b' },
    { label: 'FLAPS', on: state.flaps, colour: '#ffd76a' },
    { label: 'ENGINE', on: state.engineOut, colour: '#ff3b30' },
    { label: 'LOW FUEL', on: state.fuel < 18, colour: '#ff9f2e' },
  ];
  const startX = width * 0.32;
  lamps.forEach((lamp, index) => {
    const x = startX + index * width * 0.09;
    ctx.fillStyle = lamp.on ? lamp.colour : '#39424f';
    ctx.fillRect(x, top + 22, width * 0.07, 20);
    ctx.fillStyle = lamp.on ? '#14181f' : '#9fb0c2';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(lamp.label, x + width * 0.035, top + 36);
  });
}

function drawYoke(ctx, state, width, height) {
  const cx = width / 2;
  const cy = height * 0.94;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(state.roll * 0.7);
  ctx.strokeStyle = '#14181f';
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(-72, 18);
  ctx.lineTo(-30, -8);
  ctx.lineTo(30, -8);
  ctx.lineTo(72, 18);
  ctx.stroke();
  ctx.strokeStyle = '#39424f';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-72, 18);
  ctx.lineTo(-30, -8);
  ctx.lineTo(30, -8);
  ctx.lineTo(72, 18);
  ctx.stroke();
  ctx.fillStyle = '#232a34';
  ctx.fillRect(-16, -18, 32, 24);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('K7', 0, -2);
  ctx.restore();
}

function drawFlightPathMarker(ctx, state, width, height) {
  const cx = width / 2;
  const cy = height * 0.36 - clamp(state.pitch, -0.5, 0.5) * height * 0.08;
  ctx.strokeStyle = '#7dff8a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 30, cy);
  ctx.lineTo(cx - 13, cy);
  ctx.moveTo(cx + 13, cy);
  ctx.lineTo(cx + 30, cy);
  ctx.moveTo(cx, cy - 13);
  ctx.lineTo(cx, cy - 24);
  ctx.stroke();
}
