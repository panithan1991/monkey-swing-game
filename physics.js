const fract = value => value - Math.floor(value);
const hash = number => fract(Math.sin(number * 127.1 + 73.7) * 43758.5453);

export function vineAt(index) {
  return {
    i: index,
    x: 190 + index * 310,
    y: 48 + Math.sin(index * 1.9) * 22,
    len: 320 + hash(index + 30) * 46,
    phase: index * .52 + hash(index + 3) * 1.3,
    speed: 1.7 + hash(index + 4) * .26,
    gold: index > 0 && index % 7 === 0
  };
}

export function vineEndpoint(vine, time) {
  const theta = Math.sin(time * vine.speed + vine.phase) * .4;
  return { x: vine.x + Math.sin(theta) * vine.len, y: vine.y + Math.cos(theta) * vine.len, theta };
}

// Launch energy comes from the current swing. The next vine is deliberately
// absent from this calculation so timing remains the player's responsibility.
export function swingLaunchVelocity(vine, time) {
  const phase = time * vine.speed + vine.phase;
  const angle = Math.sin(phase) * .4;
  const tangent = Math.cos(angle) * vine.len * .4 * vine.speed * Math.cos(phase);
  return {
    vx: 255 + tangent * .6,
    vy: -420 - Math.max(0, tangent) * .17 - Math.max(0, angle) * 80
  };
}

export function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
