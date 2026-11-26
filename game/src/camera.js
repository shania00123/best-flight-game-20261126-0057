// Chase and cockpit cameras plus the 3D-to-2D projection every renderer
// shares. The chase camera rolls only part-way with the aircraft, so the
// horizon stays readable in a bank and the camera never fights the pilot.
import { CAMERA } from './config.js';
import { forwardVector } from './flight.js';

export const VIEW_CHASE = 'chase';
export const VIEW_COCKPIT = 'cockpit';

export function aircraftBasis(state, rollScale) {
  const forward = forwardVector(state);
  const right0 = { x: Math.cos(state.heading), y: 0, z: -Math.sin(state.heading) };
  const up0 = {
    x: -Math.sin(state.heading) * Math.sin(state.pitch),
    y: Math.cos(state.pitch),
    z: -Math.cos(state.heading) * Math.sin(state.pitch),
  };
  const roll = state.roll * rollScale;
  const cosR = Math.cos(roll);
  const sinR = Math.sin(roll);
  return {
    forward,
    right: {
      x: right0.x * cosR - up0.x * sinR,
      y: right0.y * cosR - up0.y * sinR,
      z: right0.z * cosR - up0.z * sinR,
    },
    up: {
      x: up0.x * cosR + right0.x * sinR,
      y: up0.y * cosR + right0.y * sinR,
      z: up0.z * cosR + right0.z * sinR,
    },
  };
}

export function createCamera(view) {
  return {
    view,
    position: { x: 0, y: 0, z: 0 },
    basis: null,
    focal: 600,
    width: 1280,
    height: 720,
    update(state, width, height) {
      this.width = width;
      this.height = height;
      this.focal = height / 2 / Math.tan(CAMERA.fieldOfView / 2);
      if (this.view === VIEW_COCKPIT) {
        this.basis = aircraftBasis(state, 1);
        this.position = {
          x: state.x + this.basis.up.x * CAMERA.cockpitUp,
          y: state.y + this.basis.up.y * CAMERA.cockpitUp,
          z: state.z + this.basis.up.z * CAMERA.cockpitUp,
        };
      } else {
        this.basis = aircraftBasis(state, 0.52);
        const back = aircraftBasis(state, 1);
        this.position = {
          x: state.x - back.forward.x * CAMERA.chaseBack + back.up.x * CAMERA.chaseUp,
          y: state.y - back.forward.y * CAMERA.chaseBack + back.up.y * CAMERA.chaseUp,
          z: state.z - back.forward.z * CAMERA.chaseBack + back.up.z * CAMERA.chaseUp,
        };
      }
    },
    project(point) {
      const dx = point.x - this.position.x;
      const dy = point.y - this.position.y;
      const dz = point.z - this.position.z;
      const cx = dx * this.basis.right.x + dy * this.basis.right.y + dz * this.basis.right.z;
      const cy = dx * this.basis.up.x + dy * this.basis.up.y + dz * this.basis.up.z;
      const cz = dx * this.basis.forward.x + dy * this.basis.forward.y + dz * this.basis.forward.z;
      if (cz < CAMERA.nearPlane) return null;
      return {
        x: this.width / 2 + (cx / cz) * this.focal,
        y: this.height / 2 - (cy / cz) * this.focal,
        depth: cz,
        scale: this.focal / cz,
      };
    },
    projectClamped(point) {
      const projected = this.project(point);
      if (projected) return projected;
      const dx = point.x - this.position.x;
      const dz = point.z - this.position.z;
      const behind = dx * this.basis.forward.x + dz * this.basis.forward.z < 0;
      const side = dx * this.basis.right.x + dz * this.basis.right.z >= 0 ? 1 : -1;
      return {
        x: this.width / 2 + side * this.width * 0.48,
        y: behind ? this.height * 0.82 : this.height * 0.3,
        depth: CAMERA.farPlane,
        scale: 0,
        offscreen: true,
      };
    },
  };
}

export function toggleView(camera) {
  camera.view = camera.view === VIEW_CHASE ? VIEW_COCKPIT : VIEW_CHASE;
  return camera.view;
}
