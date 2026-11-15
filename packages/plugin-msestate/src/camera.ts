/* Camera maths for framing a view. The editor's camera stands at a position and looks at a target,
   the world's up kept upright; a stored view keeps a quaternion instead. three.js cameras look
   down their local −Z. Angles in the moves are degrees, lengths metres. */

export type Vec3 = [number, number, number]
export type Quat = [number, number, number, number]
export type Aim = { position: Vec3; target: Vec3 }

const DEG = Math.PI / 180
const MAX_TILT = 85 * DEG // short of straight up or down, where the heading is lost

/** A point `distance` ahead of a camera at `position` turned by `quaternion`. */
export function targetOf([x, y, z]: Vec3, [qx, qy, qz, qw]: Quat, distance = 1): Vec3 {
  // −Z rotated by the quaternion
  const fx = -2 * (qx * qz + qw * qy)
  const fy = -2 * (qy * qz - qw * qx)
  const fz = -(1 - 2 * (qx * qx + qy * qy))
  return [x + fx * distance, y + fy * distance, z + fz * distance]
}

/** Where the aim looks: heading about +Y (0 looks down +Z), tilt above the horizon, and its length. */
function anglesOf({ position, target }: Aim) {
  const dx = target[0] - position[0]
  const dy = target[1] - position[1]
  const dz = target[2] - position[2]
  const length = Math.hypot(dx, dy, dz)
  return { heading: Math.atan2(dx, dz), tilt: Math.asin(dy / length), length }
}

function aimAlong(position: Vec3, heading: number, tilt: number, length: number): Aim {
  const flat = length * Math.cos(tilt)
  return {
    position,
    target: [
      position[0] + flat * Math.sin(heading),
      position[1] + length * Math.sin(tilt),
      position[2] + flat * Math.cos(heading),
    ],
  }
}

/** The quaternion of an upright camera with this aim: a turn about Y, then a tilt about X. */
export function quaternionOf(aim: Aim): Quat {
  const { heading, tilt } = anglesOf(aim)
  const turn = (heading - Math.PI) / 2 // at no turn the camera looks down −Z, heading π
  const lift = tilt / 2
  const [st, ct, sl, cl] = [Math.sin(turn), Math.cos(turn), Math.sin(lift), Math.cos(lift)]
  return [ct * sl, st * cl, -st * sl, ct * cl]
}

/**
 * A small step of the camera, as a photographer moves it: forward and right along the floor,
 * up, turn left, tilt up. Negative values go the other way.
 */
export type Move = {
  forward?: number
  right?: number
  up?: number
  turnLeft?: number
  tiltUp?: number
}

/** The aim after `move`; the distance to the target is kept, the tilt stays short of vertical. */
export function moved(aim: Aim, move: Move): Aim {
  const { heading, tilt, length } = anglesOf(aim)
  const { forward = 0, right = 0, up = 0, turnLeft = 0, tiltUp = 0 } = move
  const [fx, fz] = [Math.sin(heading), Math.cos(heading)] // ahead on the floor; right is (−fz, fx)
  const [x, y, z] = aim.position
  const position: Vec3 = [x + fx * forward - fz * right, y + up, z + fz * forward + fx * right]
  const nextTilt = Math.min(MAX_TILT, Math.max(-MAX_TILT, tilt + tiltUp * DEG))
  return aimAlong(position, heading + turnLeft * DEG, nextTilt, length)
}

type Size = { width: number; height: number }
const FRAME_MARGIN = 0.9 // the shot's frame fills this much of the viewport, the rest shows around it
const halfTan = (fov: number) => Math.tan((fov * DEG) / 2)

/**
 * The viewport's vertical field of view, in degrees, that shows a shot of `fov` and `aspect`
 * as a frame centred in a viewport of `size`, with a margin of the model around it.
 */
export function fitFov(fov: number, aspect: number, size: Size): number {
  const frameHeight = FRAME_MARGIN * Math.min(size.height, size.width / aspect)
  return (2 / DEG) * Math.atan((halfTan(fov) * size.height) / frameHeight)
}

/** Where, in a viewport of `size` with vertical field `viewFov`, a shot of `fov` and `aspect` falls. */
export function frameIn(fov: number, aspect: number, viewFov: number, size: Size) {
  const height = (size.height * halfTan(fov)) / halfTan(viewFov)
  const width = height * aspect
  return { left: (size.width - width) / 2, top: (size.height - height) / 2, width, height }
}
