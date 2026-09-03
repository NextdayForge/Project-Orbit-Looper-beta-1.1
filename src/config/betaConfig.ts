/**
 * Beta feedback destination — change before TestFlight distribution.
 * Examples:
 *   mailto:you@example.com?subject=Orbit%20Looper%20ベータ%20フィードバック
 *   https://github.com/your-org/orbit-looper/issues/new
 */
export const BETA_FEEDBACK_URL =
  'mailto:nextdayforge@gmail.com?subject=Orbit%20Looper%20ベータ%20フィードバック';

/**
 * 計測レポートを本文に載せたフィードバック用 URL。
 * `BETA_FEEDBACK_URL` は既に `?subject=` を持つので `&body=` で足す。
 * 送信するかどうかはユーザーが自分でメーラー上で決める（自動送信はしない）。
 */
export function betaFeedbackUrlWithReport(report: string): string {
  return `${BETA_FEEDBACK_URL}&body=${encodeURIComponent(report)}`;
}
