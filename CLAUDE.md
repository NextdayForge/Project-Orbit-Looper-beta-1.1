# CLAUDE.md — Project Orbit Looper

Claude Code 用のプロジェクト指示書。設計思想を引き継ぎ、日々の開発運用の情報を追加したもの。**このファイルは毎セッション読み込まれるので、簡潔・高信号を保つこと。** プロダクトの最終目標・全体ロードマップは [docs/PRODUCT_VISION.md](docs/PRODUCT_VISION.md) に分離。

---

## プロジェクト概要

Orbit Looper は「AIスケジュールアプリ」ではなく、**"毎日ユーザーを理解し、最適な1日を生成し続ける Life OS"**。
Expo / React Native (SDK 54, React 19) 製。AI は Gemini（Cloudflare Worker プロキシ経由）+ ローカルフォールバック。

競合は「予定を作る」。Orbit は「ユーザーを学習する」。昨日より賢くなることがコア価値。

---

## 設計原則（不変。実装判断で迷ったらここに戻る）

1. **Task と Session は分離する。** Task =「やること」（不変）。Session =「いつやるか」（毎日変わる）。
2. **AI は Session を変える。Task は勝手に変えない。** ユーザーの意図を失わないため。
3. **すべての学習は UserModel に集約する。** Planner は UserModel だけを見る。Raw データを直接読まない。
   `Session → Outcome → Reflection → DailyFeatures → UserModel → 翌日のPlan`
4. **Explainable AI。** すべての AI 判断に理由（reasonTags）を持たせる。ユーザーは「なぜこの予定か」を常に確認できる。
5. **ローカルファースト。** 重要度・選択・配置の意思決定はローカルで完結。Gemini は「文章化・要約・抽出」に限定。オフライン/無課金でも動く。
6. **Session は削除せず「変形」して残す。** 昼の再計画で未実行 Session を消さず `status: 'rescheduled'` にして履歴保持し、新しい Session を別IDで追加する。Session は「スケジュール枠」ではなく「行動ログ」。削除すると Outcome → 学習の鎖が切れる。担保は [`session.ts`](src/types/session.ts) の `isActivePlacementSession()`。**`delete session` は禁止。**

MVP ドメインは 6 つのみ: `Task / Session / CalendarBlock / Reflection / UserModel / DecisionLog`。
DayType は 4 種のみ: `REST / LIGHT / NORMAL / PUSH`（SPRINT は未実装）。
プロダクトの最終目標・全体ロードマップ・ドメインモデルの詳細（実コードに準拠）は [docs/PRODUCT_VISION.md](docs/PRODUCT_VISION.md) を参照。

---

## コマンド

依存は導入済み（`npm install` 実施済み）。クローン直後などで `node_modules` が無ければ再実行。

| 目的 | コマンド |
|---|---|
| 開発起動 (LAN) | `npm start` |
| 開発起動 (トンネル) | `npm run start:tunnel` |
| キャッシュクリア起動 | `npm run start:clear` |
| Lint | `npm run lint`（`eslint.config.js`, flat config。ESLint 9 系のため旧 `.eslintrc.js` は廃止済み） |
| テスト | `npm test` （= jest、`intelligence/` と `utils/` の純粋ロジックのみ対象） |
| 単体テスト | `npx jest src/__tests__/scoringEngine.test.ts` |
| 型チェック | `npx tsc --noEmit`（`workers/` は対象外） |
| Worker型チェック | `cd workers/looper-gemini-proxy && npx tsc --noEmit`（要 `npm install`） |
| Android プレビュービルド | `npm run build:android:preview` |

現状のベースライン（2026-09-07 実測）: 型チェック0エラー / テスト**36スイート・235件**全て成功 / lint 0エラー・**11警告**（`no-unused-vars` 9件・`no-empty-object-type` 1件・`CalendarView.tsx` の `exhaustive-deps` 誤検知1件、いずれも未対応。`array-type`/`no-duplicates` 由来の警告はこの日の自動修正で解消済み）。

---

## アーキテクチャ（レイヤーと責務）

```
src/
├─ types/            ドメイン型（task, session, calendarBlock, reflection, userModel, dayPlan …）
├─ storage/          AsyncStorage アダプタ + LooperDataStore（永続化の最下層）
├─ repositories/     interfaces/ (I*Repository) + implementations/  ← データアクセスは必ずここ経由
├─ intelligence/     ★ アプリの「脳」。純粋ロジック中心（RN 非依存 = jest でテスト可能）
│  ├─ planner/       DayType判定・Capacity・配置(Placement)・カレンダー配置
│  ├─ learning/      DailyFeatureExtractor → UserModelUpdater（学習ループ）
│  ├─ reflection/    ふりかえり抽出（Gemini + local）
│  ├─ coach/         AIコーチ（Gemini + local）★ Gemini連携の実装パターンの手本
│  ├─ taskProposal/  ★ 現在開発中（下記「現在の作業」参照）
│  ├─ outcome/       SessionOutcome 導出
│  └─ taskEstimate/  タスク所要時間見積り
├─ infrastructure/   gemini/ GeminiClient（generateStructuredJson など）
├─ presentation/     calendar/ explain/ learning/  UI とドメインの変換アダプタ
├─ components/       React Native UI（today/, focus/, coach/, reflection/, calendar/ …）
├─ hooks/            useDayOrchestrator, useDayPlan, useLearning, useCoach …
└─ config/           AI課金・ベータ・ブランド・プロキシ設定
```

**依存の向き:** `components/hooks → presentation → intelligence → repositories → storage`。逆流させない。

---

## コーディング規約 / ガードレール

- **`legacy/` から import しない。** v1 の Event ベース旧コード。現行 `src/` は Task/Session モデル。
- **意思決定ロジックは `intelligence/` か `utils/` の純粋関数として書く**（RN import を持ち込まない）。これが jest 対象。UI 副作用はフックへ。
- **データアクセスは repository 経由のみ。** `storage/` を直接叩かない。
- **Gemini 呼び出しは必ずローカルフォールバックとペア。** 手本は [`CoachService.ts`](src/intelligence/coach/CoachService.ts):
  `client.isConfigured()` を確認 → `generateStructuredJson()` → DTO を schema でパース → 失敗/未設定なら local 実装へ。`source: 'gemini' | 'local'` を返す。
- **TypeScript strict。** 新規ロジックには `src/__tests__/*.test.ts` を追加（既存の命名・fixtures.ts に合わせる）。
- **リリース前チェック:** `src/config/cloudAiProxy.ts` の `BETA_FORCE_PRO_PLAN` を **`false`** に戻す（現在ベータで全員 Pro）。
- 秘密情報（Gemini APIキー / BETA_TOKEN）はコミットしない。`.env` はローカルのみ。

---

## 現在の作業: Task Proposal Engine（`intelligence/taskProposal/`）

「今日やること」をローカルで選び、Gemini で文章化してユーザーに提案する機能。パイプライン:

```
buildProposalContext()          ✅ 完成（proposalContext.ts）
  → buildCandidatePool()        ✅ 完成（candidatePoolBuilder.ts）
  → scoreCandidatePool()        ✅ 完成（scoringEngine.ts / ルールベース）
  → selectProposalCandidates()  ✅ 完成（proposalSelector.ts / capacity内で上位5件）
  ───────────────── ここまで実装済み ─────────────────
  → TaskProposalService         ⏳ 次。coach/ を手本に Gemini+local Facade
  → proposalPrompts.ts          ⏳ Gemini へ渡す文脈の文章化
  → proposalResponseSchema.ts   ⏳ Gemini 返却 JSON のパース
  → localProposal.ts            ⏳ Gemini なし版（スコア上位＋理由テンプレ）
  → useTaskProposal (hook)      ⏳ UI 接続
  → TaskProposalModal           ⏳ 提案 UI
  → TodayView 接続 → Planner    ⏳ 既存 runAiDayPlan へ流す
```

**実装方針:** 上記はすべて `intelligence/coach/`（CoachService / coachPrompts / coachResponseSchema / localCoach）と `intelligence/reflection/` に既存の手本がある。**新規発明せず既存パターンを踏襲すること。**

既知の小課題（**このパイプラインを UI に繋ぐ前に必ず処理すること**。2026-09-07 に実コードで再確認）:
- `candidatePoolBuilder.ts:88` の `remainingMinutes` は `task.estimatedMinutes` そのまま（部分完了タスクの残り時間を反映していない）。DTO 名と実挙動に差がある。
- `scoringEngine.ts:53-59` で今日締切は `deadline_today (40)` と `deadline_within_24h (25)` が独立した if で両方付き 65 点になる。意図的だが、繋ぐ前に妥当性を一度決めること。

> **現時点で `intelligence/taskProposal/` は UI からまったく到達できない**（自ディレクトリと `__tests__` 以外どこからも import されていない）。上の2件は実ユーザーに影響しないが、繋いだ瞬間に顕在化する。
>
> かつてここに記載していた「Inbox の未配置タスクが候補プールに入らない」は **2026-07-06 の修正で解決済み**のため削除した。`resolveMorningReplanTaskIds()` は `placable` を常に含む常時ユニオン方式になっており（`morningTaskSelector.ts` の docstring 参照）、`proposalContext.ts:198` がそれを経由している。

---

## 役割分担: claude.ai（Chat）と Claude Code

このプロジェクトは2つの面から触る。**得意なことが違うので、工程で分ける。**

| | claude.ai（Chat・クラウド実行＋マシンへのリンク） | Claude Code（このマシン上） |
|---|---|---|
| できること | リポジトリ・GitHub・配布中のWeb版・Expo/Vercel を横断して突き合わせる。ブラウザで実物を確認する。長い議論と設計判断 | シェル・テスト・lint・git・EASビルド・ADB。実装の反復 |
| できないこと | **ユーザーのマシンでシェルを直接叩けない**（バッチを置いてダブルクリック実行になる） | 会話履歴はマシンローカル。他マシン・他セッションの文脈は持たない |
| 担当する工程 | **現状把握・棚卸し・優先順位づけ・設計判断・方針のドキュメント化** | **実装・テスト・コミット・push・ビルド・実機確認** |

**Chat 側で実装しないこと。** シェルが無いため1ファイル直すのにバッチ配置とダブルクリックが要り、Code の何倍も時間がかかる。Chat が出すのは「何を、なぜ、どの順でやるか」まで。

### 引き継ぎの規約

**Chat → Code の受け渡しは、SESSION_LOG 経由ではなく貼り付け用プロンプト。**

- Chat は調査・判断が終わったら、それをそのまま Code に貼り付けて実行できる**プロンプトを生成して渡す**（コマンド・対象ファイル・順序・期待結果・やらないことまで書き切る）。SESSION_LOG の「次回への申し送り」に書くのではなく、プロンプトそのものが引き継ぎの実体になる
- claude.ai 側のプロジェクトドキュメント（棚卸し・ロードマップ・バグ一覧）には**判断の理由**を置く。**Code からは読めない**ので、プロンプトは単体で完結している前提で書く（「詳細はドキュメント参照」は不可）
- **Code は実装が終わったら、結果を [`docs/SESSION_LOG.md`](docs/SESSION_LOG.md) に追記する責任を持つ。** 受け取ったプロンプトの内容・実施結果・差分があれば理由を、日付付きエントリとして書く。Chat は次に棚卸しするときこれを読んで現状を把握する

つまり **Chat→Code は都度生成するプロンプト、Code→Chat（および次回の Code 自身）は SESSION_LOG** と、往路と復路で経路が異なる。SESSION_LOG は常に「Code が実際に何をしたか」の記録として一貫させる。

---

## マルチデバイス運用（複数端末で Claude Code を使う）

このプロジェクトは複数デバイスから作業する。会話メモリはマシンローカルで同期されないため、**コードは git、文脈は `docs/SESSION_LOG.md`** で引き継ぐ。

- **セッション開始時（2回目以降・ユーザーから何も指示がなくても必ず行う）:**
  1. `git pull` を実行する。
  2. pull で `package-lock.json` が変化していたら（＝他デバイスで依存関係が追加/更新された）、`npm install` を実行する。
  3. [`docs/SESSION_LOG.md`](docs/SESSION_LOG.md) の最新エントリを読み、前回の状態・次にやることを把握する。
  4. ユーザーへの最初の応答で、pull した差分の有無と SESSION_LOG の「次回への申し送り」を簡潔に共有する。ユーザーは特別なプロンプトを毎回入力する必要はない。
- **セッション終了時（意味のある変更・意思決定・議論があった後）:** `docs/SESSION_LOG.md` に日付付きで新しいエントリを追記し、コミットして **確認なしで `git push` してよい**（2026-07-01 にユーザーが承認済み）。同日中の続きの作業は新しいエントリを増やさず、その日のエントリに追記・加筆する。
  - 別デバイスでは会話の生ログを読めない（Claude Code は claude.ai のようなアカウント同期型チャットではなく、会話履歴はマシンローカルにしか残らない）。**このログが唯一の引き継ぎ手段**なので、単なる変更点の箇条書きではなく、「同僚に対面で引き継ぐ」つもりで書く:
    - 何を聞かれ、何を調べ、何が分かったか（経緯を物語的に）
    - なぜその判断をしたか（検討して却下した案があれば触れる）
    - ユーザーが下した決定・承認したこと（後から「なぜこうなったか」を辿れるように）
    - 今のところ未解決の論点・保留事項
    - 次にやるべきこと
  - コード変更を伴わない議論（方針確認・仕様の相談など）でも、後で参照する価値がある内容ならログに残す。他愛のない一往復のやり取りまで残す必要はない。

### 初回セットアップ用プロンプト（新しいデバイスで最初に貼るもの）

```
このプロジェクト（Orbit Looper）を初めてこのデバイスで扱います。次を実行してください。

1. ユーザーのホームディレクトリ直下（Windowsなら C:\Users\<name>\、Mac/Linuxなら ~/）に
   Project-Orbit-Looper-beta-1.1 がまだクローンされていなければ、ホームディレクトリに
   移動してから https://github.com/NextdayForge/Project-Orbit-Looper-beta-1.1.git を
   クローンし、そのディレクトリに移動する。他の場所（Desktop等）に置かない。
   既にホームディレクトリ直下にクローン済みでその中で起動している場合はそのまま使う。
2. npm install を実行する。
3. npx tsc --noEmit / npm test / npm run lint を実行し、CLAUDE.md に記載のベースライン
  （型チェック0エラー・テスト全件成功・lint 0エラー）と一致するか確認する。差分があれば報告する。
4. CLAUDE.md と docs/SESSION_LOG.md の最新エントリを読み、前回の変更内容・意思決定・
   次回への申し送りを把握する。
5. Gemini連携を試す予定があれば、.env.example を参照して .env 設定を案内してほしいと
   伝える。今回それが不要なら省略してよい。
6. 以上が終わったら、現状（ベースラインが一致したか）と SESSION_LOG の「次回への申し送り」を
   要約し、何から着手するか聞いて。
```
