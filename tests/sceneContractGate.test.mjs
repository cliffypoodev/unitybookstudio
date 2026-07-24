import assert from 'node:assert/strict';
import {
  auditSceneAgainstLedger,
  buildSceneContractRepairInstruction,
} from '../src/lib/sceneContractGate.js';

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run('accepts a distinct chronological scene', () => {
  const result = auditSceneAgainstLedger({
    accumulatedProse: 'Marcus lost his left hand when the archive door crushed it.',
    prose: 'Lena bandaged Marcus while Vale monitored the failing reactor.',
    spec: {
      required_events: ['Lena treats Marcus injury'],
      prior_completed_events: ['Marcus opens the archive door'],
      future_reserved_events: ['Vale dies while stabilizing the reactor'],
    },
  });

  assert.equal(result.ok, true);
});

run('rejects a replayed prior event', () => {
  const result = auditSceneAgainstLedger({
    prose:
      'Marcus inserted the brass key into the archive lock and opened the heavy archive door.',
    spec: {
      required_events: ['Lena searches the archive records'],
      prior_completed_events: ['Marcus uses the brass key to open the archive door'],
    },
  });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'PRIOR_EVENT_REPLAY'));
});

run('rejects a future event performed too early', () => {
  const result = auditSceneAgainstLedger({
    prose:
      'Vale died while Lena and Marcus forced the reactor coolant lever into place.',
    spec: {
      required_events: ['Lena confronts Marcus about the override'],
      future_reserved_events: ['Vale dies while stabilizing the reactor coolant system'],
    },
  });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'FUTURE_EVENT_STOLEN'));
});

run('rejects left-right injury reversal', () => {
  const result = auditSceneAgainstLedger({
    accumulatedProse:
      'Marcus screamed when the steel door crushed his left hand, leaving a bloody stump.',
    prose:
      'Marcus kept his right stump tucked against his body while he crossed the chamber.',
    spec: {},
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.code === 'LIMB_STATE_CONTRADICTION')
  );
});

run('rejects an immediate unexplained prosthetic', () => {
  const result = auditSceneAgainstLedger({
    accumulatedProse:
      'Marcus lost his left hand when the hinge severed it inside the archive.',
    prose:
      'Marcus planted his prosthetic left hand against the reactor grating.',
    spec: {},
  });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'IMPOSSIBLE_PROSTHETIC'));
});

run('builds targeted repair feedback', () => {
  const instruction = buildSceneContractRepairInstruction({
    issues: [{ message: 'Replayed completed event: archive opened' }],
  });

  assert.match(instruction, /archive opened/);
  assert.match(instruction, /Rewrite ONLY the current contracted scene/);
});

console.log('\nSCENE CONTRACT GATE: 6 passed, 0 failed');

run('allows recurring sensory atmosphere', () => {
  const result = auditSceneAgainstLedger({
    prose:
      'Cold pressed through Lena’s gloves, and the corridor carried the metallic smell of rust.',
    spec: {
      required_events: ['Lena and Marcus continue down the corridor'],
      prior_completed_events: [
        'Lena notices the cold and the metallic tang of rust',
      ],
    },
  });

  assert.equal(result.ok, true);
});

run('still rejects a hidden future object transfer', () => {
  const result = auditSceneAgainstLedger({
    prose:
      'Lena placed the brass key into Marcus’s waiting hand before they reached the archive.',
    spec: {
      required_events: ['Lena searches the first chamber'],
      future_reserved_events: ['Lena gives the key to Marcus'],
    },
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.code === 'FUTURE_EVENT_STOLEN')
  );
});

run('still rejects a hidden future separation', () => {
  const result = auditSceneAgainstLedger({
    prose:
      'A collapsing bulkhead divided Lena and Marcus from Dr. Vale, leaving him alone behind the sealed door.',
    spec: {
      required_events: ['The group enters the station together'],
      future_reserved_events: [
        'Lena and Marcus are separated from Dr. Vale',
      ],
    },
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.code === 'FUTURE_EVENT_STOLEN')
  );
});

run('allows a past-perfect reference to arrival', () => {
  const result = auditSceneAgainstLedger({
    prose:
      'Since they had arrived at the station, Lena had felt the ice shifting beneath them.',
    spec: {
      required_events: ['Lena examines the archive corridor'],
      prior_completed_events: [
        'Lena, Marcus, and Dr. Vale arrive at the station',
      ],
    },
  });

  assert.equal(result.ok, true);
});

run('allows reference to an already discovered key', () => {
  const result = auditSceneAgainstLedger({
    prose:
      'Lena touched the brass key she had discovered earlier and studied its engraved coordinates.',
    spec: {
      required_events: ['Lena studies the coordinates on the key'],
      prior_completed_events: ['Lena discovers the brass key'],
    },
  });

  assert.equal(result.ok, true);
});

run('still rejects reenacted arrival', () => {
  const result = auditSceneAgainstLedger({
    prose:
      'Lena, Marcus, and Dr. Vale arrived at the station and crossed the snow toward its entrance.',
    spec: {
      required_events: ['Lena examines the archive corridor'],
      prior_completed_events: [
        'Lena, Marcus, and Dr. Vale arrive at the station',
      ],
    },
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.code === 'PRIOR_EVENT_REPLAY')
  );
});

run('still rejects reenacted key discovery', () => {
  const result = auditSceneAgainstLedger({
    prose:
      'Lena pulled open the drawer and discovered a brass key hidden beneath the files.',
    spec: {
      required_events: ['Lena studies the archive console'],
      prior_completed_events: ['Lena discovers the brass key'],
    },
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.code === 'PRIOR_EVENT_REPLAY')
  );
});

run('allows a hypothetical future event', () => {
  const result = auditSceneAgainstLedger({
    prose:
      'Lena feared the key might activate some dormant security mechanism.',
    spec: {
      required_events: ['Lena examines the key'],
      future_reserved_events: ['Key activates security mechanism'],
    },
  });

  assert.equal(result.ok, true);
});

run('still rejects an enacted future mechanism', () => {
  const result = auditSceneAgainstLedger({
    prose:
      'The key activated the dormant security mechanism, and steel shutters sealed the corridor.',
    spec: {
      required_events: ['Lena examines the key'],
      future_reserved_events: ['Key activates security mechanism'],
    },
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.code === 'FUTURE_EVENT_STOLEN')
  );
});

run('allows a past-perfect reference to arrival', () => {
  const result = auditSceneAgainstLedger({
    prose:
      'Since they had arrived at the station, Lena had felt the ice shifting beneath them.',
    spec: {
      required_events: ['Lena examines the archive corridor'],
      prior_completed_events: [
        'Lena, Marcus, and Dr. Vale arrive at the station',
      ],
    },
  });

  assert.equal(result.ok, true);
});

run('allows reference to an already discovered key', () => {
  const result = auditSceneAgainstLedger({
    prose:
      'Lena touched the brass key she had discovered earlier and studied its engraved coordinates.',
    spec: {
      required_events: ['Lena studies the coordinates on the key'],
      prior_completed_events: ['Lena discovers the brass key'],
    },
  });

  assert.equal(result.ok, true);
});

run('still rejects reenacted arrival', () => {
  const result = auditSceneAgainstLedger({
    prose:
      'Lena, Marcus, and Dr. Vale arrived at the station and crossed the snow toward its entrance.',
    spec: {
      required_events: ['Lena examines the archive corridor'],
      prior_completed_events: [
        'Lena, Marcus, and Dr. Vale arrive at the station',
      ],
    },
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.code === 'PRIOR_EVENT_REPLAY')
  );
});

run('still rejects reenacted key discovery', () => {
  const result = auditSceneAgainstLedger({
    prose:
      'Lena pulled open the drawer and discovered a brass key hidden beneath the files.',
    spec: {
      required_events: ['Lena studies the archive console'],
      prior_completed_events: ['Lena discovers the brass key'],
    },
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.code === 'PRIOR_EVENT_REPLAY')
  );
});

run('allows a hypothetical future event', () => {
  const result = auditSceneAgainstLedger({
    prose:
      'Lena feared the key might activate some dormant security mechanism.',
    spec: {
      required_events: ['Lena examines the key'],
      future_reserved_events: ['Key activates security mechanism'],
    },
  });

  assert.equal(result.ok, true);
});

run('still rejects an enacted future mechanism', () => {
  const result = auditSceneAgainstLedger({
    prose:
      'The key activated the dormant security mechanism, and steel shutters sealed the corridor.',
    spec: {
      required_events: ['Lena examines the key'],
      future_reserved_events: ['Key activates security mechanism'],
    },
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.code === 'FUTURE_EVENT_STOLEN')
  );
});
