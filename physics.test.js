import test from 'node:test';
import assert from 'node:assert/strict';
import { vineAt, vineEndpoint, swingLaunchVelocity, pointSegmentDistance } from './physics.js';

function lands(source, target, time) {
  const gravity = 1050, dt = 1 / 120;
  const start = vineEndpoint(source, time);
  const velocity = swingLaunchVelocity(source, time);
  let x = start.x, y = start.y, vy = velocity.vy;
  for (let step = 1; step <= 1.65 / dt; step++) {
    const oldX = x, oldY = y;
    vy += gravity * dt;
    x += velocity.vx * dt;
    y += vy * dt;
    const elapsed = step * dt;
    if (elapsed > .38) {
      const catchPoint = vineEndpoint(target, time + elapsed);
      if (pointSegmentDistance(catchPoint.x, catchPoint.y, oldX, oldY, x, y) < 55) return true;
    }
  }
  return false;
}

test('every tested vine has attainable and missable release windows', () => {
  for (let index = 0; index < 60; index++) {
    const source = vineAt(index), target = vineAt(index + 1);
    assert.ok(target.x > source.x);
    let hits = 0, tries = 0;
    for (let time = 0; time < 7; time += .06) { tries++; if (lands(source, target, time)) hits++; }
    assert.ok(hits >= 5, `vine ${index} needs a reachable release window`);
    assert.ok(hits <= tries * .55, `vine ${index} should reward timing`);
  }
});

test('the swept catch check sees a vine crossed between frames', () => {
  assert.equal(pointSegmentDistance(10, 0, 0, 0, 20, 0), 0);
  assert.equal(pointSegmentDistance(10, 5, 0, 0, 20, 0), 5);
  assert.equal(pointSegmentDistance(30, 0, 0, 0, 20, 0), 10);
});
