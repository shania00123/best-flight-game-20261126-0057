// The sortie state machine: mission progress, ring and photo checks, scoring
// and the end-of-flight verdict. It owns one flight state and steps it with
// the same fixed timestep in the browser loop and in screenshot staging.
import { SCORE, STEP, WORLD, fuelLoadById } from './config.js';
import {
  EVENT_CRASHED,
  EVENT_ENGINE_OUT,
  EVENT_LANDED,
  EVENT_NONE,
  EVENT_PHOTO,
  EVENT_RING,
  createFlightState,
  distanceTo,
  stepFlight,
} from './flight.js';
import {
  MISSION_CROSSWIND,
  MISSION_DEADSTICK,
  MISSION_DUSK,
  MISSION_FREE,
  MISSION_RINGS,
  MISSION_STORM,
  MISSION_SURVEY,
  RING_COURSE,
  ROUTE_GATES,
  SURVEY_POINTS,
  deadstickStartPose,
  missionById,
  nextObjectiveLabel,
  runwayStartPose,
} from './missions.js';
import { buildCityBlocks, buildClouds } from './terrain.js';
import { buildParGhost, createGhostRecorder, ghostDeltaSeconds, ghostPoseAt } from './ghost.js';
import { weatherProfileFor } from './weather.js';

export const PHASE_FLYING = 'flying';
export const PHASE_COMPLETE = 'complete';
export const PHASE_FAILED = 'failed';

export function createWorld(random) {
  const world = {
    random,
    cityBlocks: buildCityBlocks(2026),
    clouds: buildClouds(random, 26),
    mission: missionById(MISSION_RINGS),
    flight: createFlightState(runwayStartPose()),
    phase: PHASE_FLYING,
    elapsed: 0,
    score: 0,
    ringsDone: 0,
    photosDone: 0,
    photoHold: 0,
    landings: 0,
    engineCutAt: Infinity,
    message: '',
    messageUntil: 0,
    breakdown: [],
    fuelLoadId: 'normal',
    routeTaken: null,
    thermalGain: 0,
    thermalAwarded: false,
    ghost: null,
    ghostRecorder: createGhostRecorder(),
    parGhost: null,
    reset(missionId, fuelLoadId) {
      this.mission = missionById(missionId || MISSION_RINGS);
      if (fuelLoadId) this.fuelLoadId = fuelLoadId;
      const load = fuelLoadById(this.fuelLoadId);
      const pose = this.mission.id === MISSION_DEADSTICK ? deadstickStartPose() : runwayStartPose();
      this.flight = createFlightState(pose);
      this.flight.fuel = this.mission.id === MISSION_DUSK ? Math.min(load.fuel, 62) : load.fuel;
      this.flight.mass = load.mass;
      this.flight.weatherProfile = weatherProfileFor(this.mission);
      this.routeTaken = null;
      this.thermalGain = 0;
      this.thermalAwarded = false;
      this.ghostRecorder = createGhostRecorder();
      this.ghost = this.mission.ghost ? (this.parGhost || (this.parGhost = buildParGhost())) : null;
      if (this.mission.id === MISSION_DEADSTICK) {
        this.flight.gearDown = false;
        this.flight.gearTransit = 1;
        this.engineCutAt = 4;
      } else {
        this.engineCutAt = Infinity;
      }
      this.phase = PHASE_FLYING;
      this.elapsed = 0;
      this.score = 0;
      this.ringsDone = 0;
      this.photosDone = 0;
      this.photoHold = 0;
      this.landings = 0;
      this.breakdown = [];
      this.message = this.mission.brief;
      this.messageUntil = 6;
    },
    step(controls) {
      if (this.phase !== PHASE_FLYING) return EVENT_NONE;
      this.elapsed += STEP;
      let events = stepFlight(this.flight, controls, STEP);
      this.ghostRecorder.record(this.flight, this.elapsed, this.ringsDone);
      if (this.flight.thermalLift > 0.8 && !this.flight.onGround) {
        this.thermalGain += this.flight.thermalLift * STEP;
        if (this.thermalGain > 25 && !this.thermalAwarded) {
          this.thermalAwarded = true;
          this.addScore(SCORE.thermalClimb, 'Thermal climb: free height');
          this.say(`Thermal climb banked (+${SCORE.thermalClimb})`);
        }
      }
      if (this.elapsed >= this.engineCutAt && !this.flight.engineOut) {
        this.flight.engineOut = true;
        this.flight.throttle = 0;
        this.say('Engine failure: throttle is dead, glide home');
        events |= EVENT_ENGINE_OUT;
      }
      events |= this.checkObjectives();
      if (events & EVENT_CRASHED) {
        this.phase = PHASE_FAILED;
        this.say(this.flight.lastLanding ? this.flight.lastLanding.label : 'The aircraft is down');
      } else if (events & EVENT_LANDED) {
        this.landings += 1;
        this.onTouchdown();
      }
      if (this.flight.fuel <= 0 && !this.flight.onGround && this.mission.id !== MISSION_DEADSTICK) {
        this.flight.engineOut = true;
      }
      return events;
    },
    checkObjectives() {
      let events = EVENT_NONE;
      if (this.flight.onGround) return events;
      const ringMission = [MISSION_RINGS, MISSION_STORM, MISSION_DUSK].includes(this.mission.id);
      if (ringMission && this.ringsDone === 2 && !this.routeTaken && this.mission.routeChoice) {
        for (const gate of ROUTE_GATES) {
          if (distanceTo(this.flight, gate) < 66) {
            this.routeTaken = gate.id;
            this.addScore(gate.points, `Route: ${gate.label} (${gate.note})`);
            this.say(`${gate.label} taken (+${gate.points}): ${gate.note}`);
            events |= EVENT_RING;
            break;
          }
        }
      }
      if (ringMission && this.ringsDone < RING_COURSE.length) {
        const ring = RING_COURSE[this.ringsDone];
        if (distanceTo(this.flight, ring) < 58) {
          this.ringsDone += 1;
          this.addScore(SCORE.ring, `Ring ${this.ringsDone}: ${ring.label}`);
          this.say(this.ringsDone === 2 ? 'Ring clear: choose Coast Shortcut or Ridge High Road' : `Ring clear: ${ring.label} (+${SCORE.ring})`);
          events |= EVENT_RING;
        }
      }
      if (this.mission.id === MISSION_CROSSWIND && this.ringsDone < 1) {
        const gate = { x: -1150, y: 260, z: 400 };
        if (distanceTo(this.flight, gate) < 90) {
          this.ringsDone = 1;
          this.addScore(700, 'Circuit gate: downwind leg');
          this.say('Circuit gate clear: crosswind final, aim for the zone');
          events |= EVENT_RING;
        }
      }
      if (this.mission.id === MISSION_SURVEY && this.photosDone < SURVEY_POINTS.length) {
        const point = SURVEY_POINTS[this.photosDone];
        const dx = point.x - this.flight.x;
        const dz = point.z - this.flight.z;
        const horizontal = Math.sqrt(dx * dx + dz * dz);
        const inBand = this.flight.y >= point.minAlt && this.flight.y <= point.maxAlt;
        if (horizontal < 300 && inBand) {
          this.photoHold += STEP;
          if (this.photoHold >= 1.4) {
            this.photosDone += 1;
            this.photoHold = 0;
            this.addScore(SCORE.waypoint, `Photo: ${point.label}`);
            this.say(`Photo captured: ${point.label} (+${SCORE.waypoint})`);
            events |= EVENT_PHOTO;
          }
        } else {
          this.photoHold = Math.max(0, this.photoHold - STEP * 2);
        }
      }
      return events;
    },
    onTouchdown() {
      const verdict = this.flight.lastLanding;
      if (!verdict) return;
      this.addScore(verdict.score, `Landing: ${verdict.label}`);
      this.say(verdict.label);
      const goalsMet =
        ([MISSION_RINGS, MISSION_STORM, MISSION_DUSK].includes(this.mission.id) && this.ringsDone >= RING_COURSE.length) ||
        (this.mission.id === MISSION_CROSSWIND && this.ringsDone >= 1) ||
        (this.mission.id === MISSION_SURVEY && this.photosDone >= SURVEY_POINTS.length) ||
        this.mission.id === MISSION_DEADSTICK ||
        this.mission.id === MISSION_FREE;
      const stopped = this.flight.speed < 4;
      if (goalsMet && verdict.grade !== 'field' && verdict.grade !== 'belly') {
        this.finishSortie(true);
      } else if (goalsMet && stopped) {
        this.finishSortie(verdict.grade !== 'belly');
      }
    },
    finishSortie(success) {
      if (this.phase !== PHASE_FLYING) return;
      if (success) {
        if (this.ghost && this.elapsed < this.ghost.totalTime) {
          this.addScore(SCORE.ghostBeaten, 'Beat the par ghost home');
        }
        const fuelBonus = Math.round(this.flight.fuel * SCORE.fuelPerUnit);
        if (fuelBonus > 0 && this.mission.id !== MISSION_DEADSTICK) this.addScore(fuelBonus, 'Fuel remaining');
        if (this.mission.parSeconds > 0) {
          const saved = Math.max(0, Math.round(this.mission.parSeconds - this.elapsed));
          if (saved > 0) this.addScore(saved * SCORE.secondSaved, `Under par by ${saved} s`);
        }
        this.phase = PHASE_COMPLETE;
        this.say('Sortie complete');
      } else {
        this.phase = PHASE_FAILED;
      }
    },
    addScore(points, label) {
      this.score += points;
      this.breakdown.push({ label, points });
    },
    say(text) {
      this.message = text;
      this.messageUntil = this.elapsed + 4.5;
    },
    objectiveLabel() {
      return nextObjectiveLabel(this.mission.id, { ringsDone: this.ringsDone, photosDone: this.photosDone, routeTaken: this.routeTaken });
    },
    currentTarget() {
      if ([MISSION_RINGS, MISSION_STORM, MISSION_DUSK].includes(this.mission.id) && this.ringsDone < RING_COURSE.length) return RING_COURSE[this.ringsDone];
      if (this.mission.id === MISSION_CROSSWIND && this.ringsDone < 1) return { x: -1150, y: 260, z: 400 };
      if (this.mission.id === MISSION_SURVEY && this.photosDone < SURVEY_POINTS.length) {
        const point = SURVEY_POINTS[this.photosDone];
        return { x: point.x, y: (point.minAlt + point.maxAlt) / 2, z: point.z };
      }
      if (!this.flight.onGround) return { x: WORLD.runway.x, y: WORLD.runway.elevation + 60, z: WORLD.runway.z };
      return null;
    },
    bingoFuel() {
      const dx = WORLD.runway.x - this.flight.x;
      const dz = WORLD.runway.z - this.flight.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const minutesHome = distance / Math.max(this.flight.speed, 28) / 60;
      return Math.round(minutesHome * 13.5 + 9);
    },
    ghostNow() {
      return this.ghost ? ghostPoseAt(this.ghost, this.elapsed) : null;
    },
    ghostDelta() {
      return this.ghost ? ghostDeltaSeconds(this.ghost, this.elapsed, this.ringsDone) : null;
    },
  };
  world.reset(MISSION_RINGS);
  return world;
}

export function formatClock(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
