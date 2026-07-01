import {
  BUFFER_NEED_RATIO_MAX,
  BUFFER_NEED_RATIO_MIN,
  UserModel,
} from '../../types/userModel';

const LEGACY_BUFFER_NEED_DIVISOR = 25;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Converts legacy absolute bufferNeed values (> 1) to ratio scale (0.05–0.5).
 * Examples: 5 → 0.2, 10 → 0.4, 12.5 → 0.5, 30 → 0.5 (clamped).
 */
export function migrateUserModelBufferNeed(userModel: UserModel): UserModel {
  const ratio =
    userModel.bufferNeed > 1
      ? userModel.bufferNeed / LEGACY_BUFFER_NEED_DIVISOR
      : userModel.bufferNeed;

  const bufferNeed = clamp(ratio, BUFFER_NEED_RATIO_MIN, BUFFER_NEED_RATIO_MAX);

  if (bufferNeed === userModel.bufferNeed) {
    return userModel;
  }

  return {
    ...userModel,
    bufferNeed,
  };
}
