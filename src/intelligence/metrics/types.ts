/**
 * 北極星（3ヶ月）の判定に必要な最小計測。
 *
 * 設計方針: **新しいイベント基盤を作らない。** すべて既存の永続化データ
 * （Session / DailyFeatures）からの純粋な導出として計算する。
 * - 設計原則5（ローカルファースト）を一切壊さない。端末外に何も送らない。
 * - 既に手元にあるベータユーザーのデータへ**遡って**効く（計測開始日を待たなくてよい）。
 * - 収集漏れが原理的に起きない（記録し忘れたイベント、という失敗モードが無い）。
 */

/** タイマー動線の通過率。北極星(a)の前提＝学習信号が入っているか。 */
export interface ExecutionFidelityMetrics {
  /** 分母: 実行対象になりえたセッション数（進捗カウント対象） */
  plannedSessionCount: number;
  /** actualStart が記録されたセッション数 */
  startedSessionCount: number;
  /** ★最重要: actualStart 発生率（0..1）。分母0なら null */
  actualStartRate: number | null;
  /** 完了したセッション数（手動完了を含む） */
  completedSessionCount: number;
  /** 完了のうちタイマーを通したもの */
  timedCompletedSessionCount: number;
  /**
   * 完了操作のうちタイマー信号を伴う割合（0..1）。
   * 低いほど「完了だけ押されて学習信号が入っていない」＝実行フィデリティの穴。
   */
  timedCompletionRate: number | null;
}

/** UserModel が実際に更新された日がどれだけあるか。 */
export interface LearningSignalMetrics {
  /** 何らかの活動があった日数 */
  activeDayCount: number;
  /** timedOutcomeCount > 0 だった日数＝学習が成立した日 */
  learningDayCount: number;
  /** 学習成立日の割合（0..1）。分母0なら null */
  learningDayRate: number | null;
}

/** 最大の差別化（昼の再計画）が実際に使われているか。北極星(b)の代理指標。 */
export interface ReplanMetrics {
  /** rescheduled に変形されたセッション数＝再計画が適用された量 */
  rescheduledSessionCount: number;
  /** 再計画が1回でも適用された日数 */
  replanDayCount: number;
  /** 活動日のうち再計画が適用された日の割合（0..1）。分母0なら null */
  replanDayRate: number | null;
}

/** コールドスタートの谷（EMA学習率0.2で意味ある差まで1〜2週間）を越えられているか。 */
export interface RetentionMetrics {
  /** 最初に活動した日（YYYY-MM-DD）。活動が無ければ null */
  firstActiveDate: string | null;
  /** 最後に活動した日（YYYY-MM-DD）。活動が無ければ null */
  lastActiveDate: string | null;
  /** 初日から最終日までの暦日数（両端含む） */
  spanDays: number;
  /** 実際に活動した日数 */
  activeDayCount: number;
  /** 直近の連続活動日数（lastActiveDate から遡る） */
  currentStreakDays: number;
  /** 最長の連続活動日数 */
  longestStreakDays: number;
  /** 初日から14日以内に何日活動したか。2週間の谷を越えたかの判定材料 */
  activeDaysInFirst14: number;
  /** 初日から14日目以降にも活動があったか＝谷を越えた */
  survivedTwoWeeks: boolean;
}

/** 北極星の判定材料一式。 */
export interface NorthStarMetrics {
  /** 集計対象の期間（両端含む・活動ベース） */
  fromDate: string | null;
  toDate: string | null;
  execution: ExecutionFidelityMetrics;
  learning: LearningSignalMetrics;
  replan: ReplanMetrics;
  retention: RetentionMetrics;
}
