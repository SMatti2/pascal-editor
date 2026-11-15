import { expect, test } from 'bun:test'
import { type Aim, fitFov, frameIn, moved, quaternionOf, targetOf, type Vec3 } from './camera'

const round = (values: number[]) => values.map((v) => Math.round(v * 1e6) / 1e6 + 0)

test('a camera looks down its own −Z', () => {
  expect(targetOf([1, 2, 3], [0, 0, 0, 1])).toEqual([1, 2, 2])
  // turned 90° left about Y: it looks down −X
  const half = Math.SQRT1_2
  expect(round(targetOf([0, 0, 0], [0, half, 0, half]))).toEqual([-1, 0, 0])
  expect(round(targetOf([0, 0, 0], [0, half, 0, half], 3))).toEqual([-3, 0, 0])
})

test('an upright camera keeps its aim through the quaternion', () => {
  const aims: [Vec3, Vec3][] = [
    [
      [0, 0, 0],
      [0, 0, -1],
    ], // no turn
    [
      [1, 1.6, 4],
      [3, 1.2, 1],
    ], // ahead right, a little down
    [
      [0, 1, 0],
      [-1, 1.5, 2],
    ], // behind left, up
  ]
  for (const [position, target] of aims) {
    const ahead = targetOf(position, quaternionOf({ position, target }))
    const length = Math.hypot(...target.map((t, i) => t - (position[i] as number)))
    const expected = target.map(
      (t, i) => (position[i] as number) + (t - (position[i] as number)) / length,
    )
    expect(round(ahead)).toEqual(round(expected))
  }
  expect(round(quaternionOf({ position: [0, 0, 0], target: [0, 0, -1] }))).toEqual([0, 0, 0, 1])
})

const AIM: Aim = { position: [0, 1.5, 0], target: [0, 1.5, -2] } // looking down −Z, level

test('forward, right and up move along the floor and the vertical; the aim goes along', () => {
  expect(round([...moved(AIM, { forward: 0.2 }).position])).toEqual([0, 1.5, -0.2])
  expect(round([...moved(AIM, { forward: 0.2 }).target])).toEqual([0, 1.5, -2.2])
  expect(round([...moved(AIM, { right: 0.2 }).position])).toEqual([0.2, 1.5, 0])
  expect(round([...moved(AIM, { up: -0.1 }).target])).toEqual([0, 1.4, -2])
  // looking down at 45°, forward still stays on the floor
  const down: Aim = { position: [0, 2, 0], target: [0, 1, -1] }
  expect(round([...moved(down, { forward: 1 }).position])).toEqual([0, 2, -1])
})

test('turn and tilt pivot on the camera and keep the distance to the target', () => {
  const left = moved(AIM, { turnLeft: 90 })
  expect(round([...left.position])).toEqual([0, 1.5, 0])
  expect(round([...left.target])).toEqual([-2, 1.5, 0])
  const up = moved(AIM, { tiltUp: 30 })
  expect(round([...up.target])).toEqual(
    round([0, 1.5 + 2 * Math.sin(Math.PI / 6), -2 * Math.cos(Math.PI / 6)]),
  )
  // never past straight up
  const top = moved(AIM, { tiltUp: 120 })
  expect(top.target[1] - 1.5).toBeCloseTo(2 * Math.sin((85 * Math.PI) / 180), 9)
})

test('the viewport field shows the shot as a frame centred inside it with a margin', () => {
  const shot = 40 // vertical degrees, 3:2
  for (const size of [
    { width: 1600, height: 800 }, // wider than the shot: the height limits
    { width: 900, height: 900 }, // narrower: the width limits
  ]) {
    const frame = frameIn(shot, 1.5, fitFov(shot, 1.5, size), size)
    expect(frame.width / frame.height).toBeCloseTo(1.5, 9)
    expect(Math.max(frame.width / size.width, frame.height / size.height)).toBeCloseTo(0.9, 9)
    expect(frame.left * 2 + frame.width).toBeCloseTo(size.width, 9)
    expect(frame.top * 2 + frame.height).toBeCloseTo(size.height, 9)
  }
  // the same field as the shot fills the viewport's height
  expect(frameIn(shot, 1.5, shot, { width: 1600, height: 800 }).height).toBeCloseTo(800, 9)
})
