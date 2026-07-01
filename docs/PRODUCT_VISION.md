# Orbit Looper — Product Vision & Roadmap

このファイルは **「なぜ・何を・どの順で作るか」** の統合ソース。
役割分担: 設計原則と日々の開発運用は [CLAUDE.md](../CLAUDE.md) / 実装の申し送りは [docs/SESSION_LOG.md](SESSION_LOG.md) / プロダクトの方向性と最終目標は本ファイル。

> 出典: 旧 `.cursorrules`（Architecture v1.0）と ChatGPT との設計対話履歴を 2026-07-01 に統合し、**実コードと突き合わせて**再構成したもの。以後、方向性・ロードマップの変更はこのファイルに反映する。

---

## 1. プロダクトコンセプト（最終目標）

Orbit Looper は「AIスケジュールアプリ」ではない。
**「毎日ユーザーを理解し、最適な1日を生成し続ける Life OS / AI秘書」** である。

| | やること | 立ち位置 |
|---|---|---|
| Google Calendar | 予定を**記録する** | 受け身の台帳 |
| Todoist | タスクを**管理する** | やること台帳 |
| **Orbit Looper** | 今日**どう動くべきか**をAIが決め、実績から学び、翌日さらに賢くなる | 能動的な意思決定支援 |

**コア価値:** 昨日より賢く、来週よりさらに賢く。
スケジューリングの精度そのものではなく、**学習ループが回り続けること自体**が価値。それ以外の全機能は、この体験を支える手段である（優先順位を見失わないための拠り所）。

---

## 2. 中核ループ（毎日回るもの）

```
朝  DayType判定 → Capacity算出 → Placement配置 → 今日のDayPlan完成
        ↓
昼  実行（タイマー） / 遅れたら「昼の再計画」＝最大の差別化
        ↓
夜  Reflection入力 → LearningPipeline（Outcome＋Reflection→DailyFeatures）
        ↓
     UserModel 更新（学習）
        ↓
翌朝  昨日より少し賢いAIが、新しいDayPlanを生成
```

この輪が毎日回り、`UserModel` に少しずつユーザーの特性が溜まっていく。

---

## 3. 不変の設計原則（要約）

実装判断で迷ったらここに戻る。全文と背景は [CLAUDE.md](../CLAUDE.md) の「設計原則」を正とする。

1. **Task（不変）と Session（毎日変わる）を分離する。**
2. **AI は Session を変える。Task は勝手に変えない。**
3. **すべての学習は UserModel に集約する。** Planner は UserModel だけを見る。
4. **Explainable AI。** すべての AI 判断に理由（reasonTags）を持たせる。
5. **ローカルファースト。** 意思決定はローカル完結、Gemini は文章化・要約・抽出のみ。
6. **Session は削除せず「変形」して残す。** 昼の再計画で未実行 Session を消さず `status: 'rescheduled'` にして履歴として保持し、新しい Session を別IDで追加する。Session は「スケジュール枠」ではなく「行動ログ」。削除すると Outcome → 学習の鎖が切れ、UserModel がブレる。

> 原則6は ChatGPT との設計レビューで指摘され、実装済み。`src/types/session.ts` の `isActivePlacementSession()`（= `status !== 'rescheduled'`）と `replanDiff.ts` がこの不変条件を担保している。**「delete session」は禁止。**

---

## 4. ドメインモデル（v1・実装済み / 実コードに準拠）

MVP は 6 ドメインのみ: `Task / Session / CalendarBlock / Reflection / UserModel / DecisionLog`。
以下は**実際の型定義**に基づく（旧 `.cursorrules` の記述には実装とズレがあったため、こちらを正とする）。

### Session（`src/types/session.ts`）
- `status`: `planned | active | completed | skipped | cancelled | rescheduled`（6状態）
- `outcome`: 別オブジェクト `{ estimatedMinutes, actualMinutes, completed, estimationRatio, startedLate, interrupted, focusScore }`
  - ⚠️ 旧 `.cursorrules` は SessionOutcome を `SUCCESS/OVERRUN/PARTIAL/…` の分類 enum と記述していたが、実装は **status（状態）＋ outcome（実測メトリクス）に分離**している。
- 履歴保持フラグ: `rescheduledAt`, `archived`

### UserModel（`src/types/userModel.ts`）
| フィールド | 実装 | 旧 `.cursorrules` の記述（訂正） |
|---|---|---|
| `procrastinationIndex` | 0〜1（既定 0.3） | 一致 |
| `energyCurve` | **6スロットの配列**（既定 `[0.5,0.85,0.55,0.7,0.6,0.35]`） | ×「24時間配列」→ 実際は時間帯バケット6個 |
| `focusLength` | 分（既定 **45**） | 「42分」は例示。既定は45 |
| `estimationFactor` | カテゴリ別 `Record<string,number>`（既定 1.0） | 一致 |
| `bufferNeed` | **比率 0.05〜0.5**（既定 0.2） | ×「5〜15分」→ 実際は絶対分でなく比率 |

学習の中間層 `DailyFeaturesSnapshot` が実測を集約: `completionRate, skipRate, rescheduleRate, overrunRate, slotCompletion[], estimationRatio, focusDurationP75, mood, energy, wins[], blockers[], aiConfidence`。

### DayType（`src/types/dayPlan.ts`）
`REST | LIGHT | NORMAL | PUSH` の4種のみ。**SPRINT は実装しない。**

### DecisionLog
AI の意思決定理由を保存（`taskId, sessionId, score, reasonTags[], candidateSlots[], chosenSlot`）。Explainability・デバッグ・学習の土台。

### Reflection
自由記述から Gemini が `Mood / Energy / Wins / Blockers` を抽出。複雑な心理分析はしない。

---

## 5. ロードマップ（Now / Next / Later / Someday）

過去に複数の枠組み（.cursorrules の Sprint 1–5 / ChatGPT の Priority 0–6・Phase 1–8・Version MVP–3.0）で語られてきたものを、**時間軸で一本化**した。上ほど「今」に近い。

### ✅ Now — MVP コア（ほぼ実装済み。これが無いとこのアプリではない）
- AIによる1日のDayPlan自動生成（DayTypeClassifier → CapacityPlanner → PlacementEngine）
- 昼の自動リスケジュール（`rescheduled` で履歴保持しつつ再配置）★最大の差別化
- LearningPipeline（Outcome＋Reflection → DailyFeatures → UserModel）
- UserModel（ユーザー特性の蓄積）
- ドメイン基盤: Task / Session / CalendarBlock 管理
- Reflection 抽出（Gemini＋ローカル） / AIコーチ（Gemini＋ローカル）

### 🔨 Next — v1.0（今のスプリントで作るもの）
- **Task Proposal Engine（現在の作業）** — 「今日やること」をローカルで選び Gemini で文章化。前半（Context→Pool→Scoring→Selector）実装済み、Service層＋UIが残り。詳細は [CLAUDE.md](../CLAUDE.md) の「現在の作業」。
- Today 画面（次の行動・残り時間・今日の目標）の仕上げ
- セッション実行（開始/一時停止/再開/完了 → Outcome生成、タイマー）
- Reflection 入力 UI（バックエンドはあるので画面接続）
- 理由表示 UI（reasonTags の文章化 = Explainability をユーザーに見せる）
- 通知（セッション開始・休憩）

> ⚠️ 各機能の正確な実装状況は古い対話履歴ではなく**コードと [SESSION_LOG.md](SESSION_LOG.md) を正**とすること（本ファイルは方向性を示すもので、進捗%は持たない）。

### 🌤 Later — v2.0（コアが安定してから）
- Gemini チャット / 相談（「今日は疲れてる」→軽い一日に、「締切間に合う？」→必要時間を算出）の高度化
- 統計・分析（集中時間・完了率・見積り精度・曜日別）/ ヒートマップ / 週次成長レポート
- 外部カレンダー同期（Google / Apple）で固定予定を取得
- クラウド同期・複数デバイス対応

### 🌙 Someday — v3.0（夢。今は設計だけ意識する）
- AI がタスク優先度を自動決定
- 締切リスク予測 / バーンアウト予測 / 習慣形成の提案
- 音声入力、外部統合（Notion / GitHub / Gmail の締切抽出）
- Apple Health / Google Fit（睡眠・心拍から疲労推定 → REST DAY 判定）

---

## 6. 意図的に「今は作らない」もの（MVP規律）

旧 `.cursorrules` の禁止リストを維持する。**これらは上記 Later / Someday に位置づけ、MVP段階では実装しない**（スコープを絞り、学習ループの完成を最優先するため）:

Sleep Model / Exercise Model / HealthKit / Google Fit / Global Priors（ユーザー横断の事前分布）/ Cloud Batch / Weekly・Monthly Review / Goal Tree / Milestone / Project AI / Habit AI / 100万人スケール設計 / Federated Learning。

---

## 7. 将来 UserModel が学習しうる項目（v2+ の展望・今は実装しない）

最終形では UserModel に数十項目が蓄積されうる。あくまで到達点のイメージであり、MVP は §4 の最小セットに限定する:

集中時間 / 朝型・夜型 / 曜日別効率 / カテゴリ別速度 / 見積り癖 / 締切耐性 / 疲労回復速度 / 休憩頻度 / 集中切れ時間 / 遅延傾向 / 会議後の集中力 / 昼食後の眠気 / モチベーション / ストレス / 達成率 / 中断率 / 先延ばし率 …

---

## 8. 近期の重点（検証フェーズ・2026-07-02時点）

コードの実装量は既に多い（約22,660行、型チェック0エラー、テスト132件、TestFlight/Android APKでベータ稼働中）。**したがって現フェーズは「作る」ではなく「検証して尖らせる」。** 新機能を追加する前に、まず中核ループが実際に価値を生んでいるかを確かめる。

### 北極星（3ヶ月・検証可能な形に具体化）

> 2週間アプリに従って動いたベータユーザーが、
> (a) アプリが自分について学んだ"具体的で正しい事実"を一つ指させて、かつ
> (b) 自動再計画に少なくとも一度「実際に助かった」と言える。
>
> これが10人の本気のベータユーザーで成り立てば、コンセプトは検証済みでスケールする価値がある。成り立たないなら、新機能をいくら足しても直らない。

### 検証済みの構造的リスク（コードで裏取り済み）

学習ループ自体（`completeSession`/`saveReflection` → `LearningPipeline` 発火 → EMA更新）は本物で、イベント駆動で実際に一周している。しかし価値が漏れる穴が2つ、コードで確認されている:

1. **実行フィデリティの穴（最大リスク）** — [`OutcomeDeriver.ts`](../src/intelligence/outcome/OutcomeDeriver.ts) の `resolveActualMinutes()` は `actualStart`/`actualEnd` が無いと見積時間へフォールバックする。つまり**タイマーを回さずに完了操作だけした場合、`estimationRatio≈1.0`・`focusScore=1.0`＝「完璧な一日」として無信号のまま学習される。** ユーザーがアプリ内で開始→実行→完了を通さない限り、UserModel はデフォルトから動かない。
2. **欠測日の誤学習** — [`DailyFeatureExtractor.ts`](../src/intelligence/learning/DailyFeatureExtractor.ts) の `procrastinationScore` はアウトカムが無い日は `0`（＝先延ばしゼロ）になり、`UserModelUpdater.ts` の EMA でそのまま `procrastinationIndex` に反映される。**何もしなかった日を「良い日」として学習してしまう。**

### コールドスタート（"2週間の谷"）

EMA学習率0.2では、デフォルトから意味のある差になるまで概ね1〜2週間の忠実なログが必要。多くのユーザーはその前に離脱しうる。対策は、**初日はデフォルト値＋再計画（学習ゼロでも機能する体験）で価値を出し、2週間かけて学習が実る**というアークをオンボーディングで先に言語化すること（「2週間使うと、あなた専用になります」）。

### 優先順位（作るより検証。上ほど先）

1. **実行フィデリティの穴を塞ぐ** — 開始→集中→完了をアプリ内で必ず通す動線を磨き、`OutcomeDeriver`/`DailyFeatureExtractor` に欠測日の学習ガードを入れる。★差別化そのものを守る最優先事項。申し送りの「90分分割バグ」調査はこの入口（プランがおかしいとタイマーを回してもらえない）。
2. **学習の可視化** — 毎日「今日の学び＋それで予定がどう変わったか」を1行見せる面を作る（`reasonLabels`/`learningNotes` の土台は既存）。学習は不可視なので、見せなければ体感されず離脱する。
3. **Task Proposal Engine を仕上げて、いったん新機能追加を止める。**
4. **計測を入れる** — `actualStart` の発生率、2週間リテンションなど、北極星を判定するための最小計測。
5. **少数ベータ＋自分で2週間ドッグフーディング** し、北極星にYes/Noを出す。
6. **課金設計の見直し** — 現状 `aiEntitlement` はGemini機能（コーチ等）に寄せているが、設計原則上コアはローカルで無料。差別化が薄いGeminiラッパーではなく、**差別化コア（学習インサイトの深さ・履歴・複数端末同期・高度な再計画）に課金を寄せる**方が筋が良い（データが端末ローカルのAsyncStorage＝機種変更で消える点も、同期を有料コアにする根拠）。

> 出典: ChatGPT（旧・楽観的評価）→ Claude Code（実コード確認）→ claude.ai（実コードを精査し上記2つの穴をコードで特定）という3段階の分析を突き合わせ、収束させたもの。

---

## 9. 一言でいうと

> 競合は「予定を作る」。Orbit Looper は「ユーザーを理解する」。
> 毎日少しずつ学習し、昨日より賢く、来週よりさらに賢くなる — これが Orbit のコア価値である。
