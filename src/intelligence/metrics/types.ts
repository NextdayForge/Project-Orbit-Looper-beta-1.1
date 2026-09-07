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

/**
 * 集計対象期間の指定（両端を含む）。省略した側は無制限。
 * 施策の前後を切り分けて比べるために使う。
 */
export interface MetricsPeriod {
  /** YYYY-MM-DD。この日を含む */
  from?: string;
  /** YYYY-MM-DD。この日を含む */
  to?: string;
}

/**
 * 1日分の実行フィデリティ。
 *
 * **累積値だけでは施策の効果は測れない。** 施策前に100セッションを20%でこなしていた場合、
 * 施策後に80%へ改善しても新しい20セッションでは累積は20%→30%にしか動かず、
 * 4倍の改善が3割増しに見える。前後比較には日別の系列（＝折れ線の段差）を使うこと。
 */
export interface DailyMetrics {
  date: string;
  plannedSessionCount: number;
  startedSessionCount: number;
  /** その日のタイマー開始率（0..1）。分母0なら null */
  actualStartRate: number | null;
  completedSessionCount: number;
  timedCompletedSessionCount: number;
  timedCompletionRate: number | null;
  /** timerUsed の outcome が1件でもあるか＝学習が成立した日 */
  hasLearningSignal: boolean;
  rescheduledSessionCount: number;
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
  /** セッションが1件以上ある日のみ・日付昇順 */
  daily: DailyMetrics[];
}

/** 施策前後の1指標の変化。 */
export interface RateDelta {
  before: number | null;
  after: number | null;
  /** after - before。どちらかが null なら null */
  delta: number | null;
}

/**
 * 施策の前後比較。`splitDate` は施策を入れた日で、**その日を「後」に含む**。
 *
 * n=1（自分だけ）で得られるのは「効かなかった」の判定材料であって、
 * 「効いた」の証明ではない。学習ループ自体が時間とともにプランの質を上げるため、
 * 改善が動線由来か UserModel の成熟由来かはこの比較だけでは分離できない。
 */
export interface PeriodComparison {
  splitDate: string;
  before: NorthStarMetrics;
  after: NorthStarMetrics;
  actualStartRate: RateDelta;
  timedCompletionRate: RateDelta;
  learningDayRate: RateDelta;
  replanDayRate: RateDelta;
}
