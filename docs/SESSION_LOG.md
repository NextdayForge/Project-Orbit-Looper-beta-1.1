# Session Log

複数デバイスで Claude Code を使うための引き継ぎログ。**新しいエントリは先頭に追加**（降順）。同日中の続きの作業はその日のエントリに追記する。
運用ルールとログの書き方は [CLAUDE.md](../CLAUDE.md) の「マルチデバイス運用」を参照。

---

## 2026-07-07

### 経緯（D:\ayosh機・アプリ一括レビュー → セキュリティ/堅牢性の修正）

ユーザーから「このアプリについて一括レビューしてほしい」と依頼された。セッション開始手順（pull＝差分なし）の後、ベースライン3点を実行し全て緑（この時点で型0エラー・33スイート203件・lint 0エラー26警告。CLAUDE.md記載の31/167は古かった）。さらにアーキテクチャのガードレールをgrepで機械検証し、`intelligence/`・`utils/`へのRN import・`legacy/` import・`repositories/`外からの`LooperDataStore`直接importがいずれもゼロであることを確認した。

レビューで挙げた要対応3件（いずれもWeb公開によりベータトークンが事実上公開情報になったことが背景）:
1. **Workerプロキシがクライアント指定の`model`を無検証でURLに埋め込む** — 高額モデルの悪用とパス操作の余地。
2. **プロキシにレート制限・ボディサイズ制限がない** — トークン取得者がGeminiキーを使い放題にできる。
3. **`LooperDataStore.loadFromDisk`の主経路の`JSON.parse`がtry/catchなし** — `looper-data`キーが破損すると全`load()`がthrowしアプリが起動不能（レガシー経路にはcatchがあるのに主経路になかった）。

ユーザーが「対応してください」と承認したため、以下を実装した:
- **Worker（`workers/looper-gemini-proxy/src/index.ts`）:** モデル許可リスト（`gemini-2.5-flash`/`-lite`のみ）、ボディ100KB上限、`crypto.subtle.timingSafeEqual`によるトークン比較、IP毎30req/分のレート制限（`wrangler.toml`にWorkers rate limitingバインディング（unsafe/open beta）を追加。コードは`env.RATE_LIMITER`が無くても動くようオプショナル）。`wrangler deploy --dry-run`でバインディング認識とバンドル成功を確認済み。
- **ストレージ破損フォールバック:** 純粋関数`parseLooperDataRaw()`を新設（`src/storage/looperDataParse.ts`、looperBackupCoreと同じ「純粋コア切り出し」パターン）し、破損時はraw全体を新キー`looper-data-corrupt-backup`に隔離してから移行/空データへフォールバック。テスト`looperDataParse.test.ts`を追加。
- **バックグラウンド遷移時のflush:** デバウンス書き込み（500ms）がOSのアプリkillで失われる穴を、`App.tsx`にAppStateリスナーを追加して`flushLooperData()`で塞いだ。
- **軽微:** `package.json`のnameを`my-calendar-app`→`orbit-looper`に修正、CLAUDE.mdのベースライン更新（34スイート206件）とWorker型チェックコマンドの追記。
- **副次対応:** `timingSafeEqual`はWorkers独自APIでDOM型に存在しないため、ルート`tsconfig.json`の`exclude`に`workers`を追加した（Workerは自前のtsconfig＋`@cloudflare/workers-types`で型チェックする。両方0エラー確認済み）。

最終検証: 型チェック0エラー（app/worker両方）・34スイート206件全成功・lint 0エラー26警告（従来どおり）。

### 決定事項
- プロキシの防御は「トークンは公開前提、Worker側の許可リスト＋サイズ上限＋レート制限が実質の防衛線」という設計に変更。
- ルートの`tsc --noEmit`は`workers/`を対象外とし、Workerの型チェックは別コマンドで行う（CLAUDE.mdに記載）。
- レビューで指摘した残りの軽微項目のうち、lint警告26件（14件は`--fix`可能）と`.gitignore`の`.env*`重複は意図的に未対応のまま（実害なし・コミットを焦点化するため）。

### 続報（push・Workerデプロイ完了）

ユーザー承認を得て、当初ブロックされていた2操作を実行した。
- `git push`成功（`5920a2f..6129db0`）。Vercel自動デプロイもトリガー済み（別途ブラウザ実地確認は未実施のまま — 下記申し送り参照）。
- `cd workers/looper-gemini-proxy && npx wrangler deploy`成功。`https://looper-gemini-proxy.nextdayforge.workers.dev`に反映済み（Version ID: `c7e8e964-f6c4-40cd-8068-fee11cb63c05`）。ratelimitバインディングも正しく認識された。
- デプロイ後、`curl`で無認証/不正トークンのリクエストがいずれも401で拒否されることを確認（正規トークンでの許可リスト動作は、トークン値を扱わない方針のため未検証だが、`--dry-run`でのバンドル検証とコードレビューで担保）。

### 続報（Vercel本番反映の確認・Android APK再ビルド着手）

ユーザーから「Vercel pushとAPKは今どうなっているか」と聞かれたため、`npx vercel ls`/`vercel inspect`で確認した。**Vercelは反映済み**: 本番デプロイ（`dpl_3fUY5SzjGh9H8YjE5ENXhnnxwq59`）がReady状態で、**https://orbit-looper-red.vercel.app** に本日2コミット分（Worker強化＋ログ更新）が反映されている。

一方**Android APKは前回ビルド（`e4b08ae5-...`、2026-07-06時点）のまま**で、本日のクライアント側修正（ストレージ破損フォールバック・バックグラウンドflush）は未反映であることを説明した。この2点は緊急性の低い予防的修正と判断し前回は再ビルドを見送っていたが、ユーザーから「実行してください」と明示的な指示があったため、`npm run build:android:preview`（`eas build --platform android --profile preview --non-interactive`）をバックグラウンドで開始した。

- ビルドログ: https://expo.dev/accounts/asuforge/projects/orbit-looper/builds/dc583766-9c0d-4d11-b680-8dbcc811c01d
- EAS環境変数（preview: `EXPO_PUBLIC_LOOPER_AI_BETA_TOKEN`/`EXPO_PUBLIC_LOOPER_AI_PROXY_URL`）は自動読み込み確認済み。
- 本ログ記録時点ではまだキュー待ち〜ビルド中。**完了・インストールURLの確定は次回以降に確認・追記が必要。**

### 次回への申し送り
- **【要確認】Android APK再ビルド（`dc583766-9c0d-4d11-b680-8dbcc811c01d`）の完了確認がまだ。** 完了したら[docs/BETA_ANDROID_APK.md](BETA_ANDROID_APK.md)等の配布資料URLも更新すること。
- Worker本番デプロイ・push・Vercel反映は完了済み。次にGemini経由のコーチ/ふりかえり等を実際に使った際、正常応答が返るか（許可リストで`gemini-2.5-flash`が弾かれていないか）を一度確認するとより安心。
- レート制限バインディングはopen beta機能・wranglerも古い（3.114、最新4系）。何か問題が出たら`npm install --save-dev wrangler@4`を先に試す。
- 前回からの持ち越し: Vercel版の実地ブラウザ確認・Android APKの実機確認は引き続き未実施。

## 2026-07-06

### 続報（削除したはずのタスクがAIの再配置で復活するバグを修正）

前回の「タスク削除が達成率を永久に下げる」修正の直後、ユーザーから新たに「削除したはずのタスクがAIによる再配置で復活してしまう」との報告があった。

**調査:** まずSubagent（Explore）で`isActivePlacementSession()`（`src/types/session.ts`）が前回の修正で他の判定関数（`isMutableScheduleSession`等）と違って`cancelled`+`archived`を除外し忘れていることを発見したが、それだけでは「Taskの完全復活」は説明できないと判断し、自分でリポジトリ層・プレースメント層を深掘りした。`src/__tests__/`に一時的な再現テスト（`zzrepro.test.ts`、後で削除）を書いて実際に動かし、根本原因を実証的に特定した。

**確認できた事実（実際にテストで再現）:**
- 単一セッションのタスクを削除した場合: `CalendarEditorAdapter.applyDelete`が正しく`deleteTask`を呼び、Task自体がリポジトリから完全に消えるため、その後の`selectTasksForPlacement`は空配列を返す（＝復活しない、安全）。
- **複数セッションを持つタスク（`splittable`など、他の日にもう1つ有効なセッションが残っている場合）を削除した場合が本命だった**: `CalendarEditorAdapter.applyDelete`は「他に有効なセッションが残っている」と判断してTask自体は削除せず、今日のSessionだけを`cancelled`+`archived`にする（これは意図通り）。しかし**Taskの`estimatedMinutes`（残り作業量）はそのまま変わらない**ため、次にAIが再配置（`generateDayPlan`→`selectTasksForPlacement`→`remainingMinutesForTask`）を実行すると、削除した分の時間がまるまる「まだ配置されていない残り作業」として再計算され、新しいSessionとして作り直されてしまう。実際にテストで、120分のタスクから60分のセッションを削除しても、次の配置候補には120分（削除前と同じ量）がそのまま残ることを確認した。

**修正内容:**
- `src/types/session.ts`の`isActivePlacementSession()`: `cancelled`+`archived`のセッション（＝削除済み）を除外するよう修正。他の判定関数と整合させ、削除済みセッションが配置エンジンの「アンカー（避けるべき既存予定）」やGeminiへのプロンプト文脈（`PromptBuilder.ts`）に紛れ込まないようにした（副次的な改善）。
- `src/hooks/useScheduleActions.ts`の`resolveSessionsToReschedule()`: 同様に`cancelled`+`archived`のセッションを除外。修正前は、あるタスクを対象にした再配置が走るたびに、既に削除済み（cancelled）のセッションが`rescheduled`に書き換えられてしまい、「これはユーザー削除だ」という前回確立したシグナルが静かに壊れていた（統計への実害は`archived`フラグで既に防げていたが、将来のバグの種になるため修正）。
- **本命の修正** — `src/presentation/calendar/CalendarEditorAdapter.ts`の`applyDelete`: タスクが他のセッションのおかげで削除されずに残るケースで、削除された（かつ未完了だった）セッションの`estimatedMinutes`分だけ、そのTaskの`estimatedMinutes`を減らす（0未満にはしない）ようにした。これにより「このタスクの一部を削除した」という意図がTaskの残り作業量に正しく反映され、次のAI再配置がその分を再び作り出さなくなる。既に完了済みのセッションを削除（履歴整理）した場合は減算しない（その分の作業は既に完了扱いで、二重に不利益を与えないため）。

**設計原則との整合性の検討:** CLAUDE.mdの設計原則2「AIはSessionを変える。Taskは勝手に変えない」に抵触しないか検討した。今回の変更はAIではなく、ユーザーが編集画面で明示的に「削除」を押した結果としてTaskの残り作業量を減らすものであり、「AIが勝手にTaskを変える」ケースには当たらないと判断した。

**相互作用の確認:** `isActivePlacementSession`の全利用箇所（`placementRollover.ts`、`PromptBuilder.ts`、`PlacementResultValidator.ts`、`LocalPlacementStrategy.ts`、`placementTaskSelector.ts`）を確認し、いずれも「削除済みセッションを除外する」方向の変更が安全あるいは改善であることを確認した。既存テスト（203件）は全て変更なしで通過。

**検証:** `npx tsc --noEmit` 0エラー。新規`src/__tests__/calendarEditorAdapter.test.ts`を作成し、「唯一のセッションを削除するとTaskごと削除される」「他のセッションが残る場合はTaskごと消さずestimatedMinutesだけ減る」「完了済みセッション削除では減らさない」「0未満にはならない」の4ケースを追加。`src/__tests__/sessionVisibility.test.ts`に`isActivePlacementSession`のケースを追加。`npm test`は33スイート203件全て成功。`npm run lint`は0エラー・26警告（ベースラインと一致）。

### 続報（タスク削除が達成率に永久に悪影響を与えるバグを修正）

ユーザーから「タスクを編集画面から削除すると、表記上は消えるが総タスク数が減らず、このままだと削除するたびに達成率が二度と100%に到達できなくなる」との報告があった。

**原因調査:** 削除の呼び出し連鎖自体（`CalendarView.tsx` → `CalendarEditorAdapter.applyDelete` → `useScheduleActions.deleteTask`/`deleteSession` → `TaskRepository.delete`）を追ったところ、`TaskRepository.delete()`はストレージから完全に削除する正規の実装であり、削除ロジック自体にバグはなかった。実際の原因は、削除時に未完了のSessionを`status:'cancelled'`にする際、統計系の判定関数`isDayProgressSession`（`src/types/session.ts`）が`rescheduled`しか除外しておらず、**削除によって生まれた`cancelled`のSessionを「未完了の実行漏れ」としてTodayの進捗率・Insightsの7日間達成率の分母に数え続けてしまう**ことだった。この分母は一度増えると二度と減らないため、削除するたびに達成率の天井が下がっていく（ユーザーの懸念通り）構造になっていた。

さらに`status:'cancelled'`が使われている箇所を全て`grep`で洗い出したところ、削除以外にこのステータスをセットする場所は存在せず（`useScheduleActions.deleteTask`/`deleteSession`の2箇所のみ）、にもかかわらず`DailyFeatureExtractor.ts`の`skipCount`（サボり扱い）と`PlannerEvaluationService.ts`の`FAILED_PLACEMENT_STATUSES`（AI配置失敗扱い）の両方で`cancelled`が「ユーザーの実行漏れ・AIの配置ミス」の兆候として誤って扱われていることも判明した。「ユーザーが削除した」という意味と「サボった/配置に失敗した」という意味が同じステータス値に重なっていたのが根本原因。

**修正方針・内容:** 既存の`archived`フラグ（元々「カレンダー非表示だが進捗・学習には残す」用途）を「これはユーザーによる削除である」という明示マーカーとして使うことにした。
- `useScheduleActions.ts`の`deleteTask`/`deleteSession`: 未完了Sessionを`cancelled`にする際、必ず`archived:true`も同時にセットするよう変更（完了済みSessionをアーカイブする既存分岐は変更なし）。
- `src/types/session.ts`の`isDayProgressSession()`: `archived && !isSessionCompleted`の場合は進捗分母から除外するよう修正（完了済みのアーカイブ済みSessionは従来通り分母に含める＝この挙動を検証する既存テストはそのまま通過）。これでTodayView・InsightsViewの両方が透過的に修正された（両画面ともこの関数経由でフィルタしているため直接の変更は不要）。
- `src/intelligence/planner/PlannerEvaluationService.ts`: `FAILED_PLACEMENT_STATUSES`から`cancelled`を除外し、`countPlacementSuccess()`を「削除されたSessionは成功・失敗どちらにもカウントせず、分子・分母の両方から完全に除外する」ロジックに変更（AIが適切に配置した後でユーザーが削除しただけなのに、AIの配置失敗として学習に悪影響を与えないようにするため）。
- `src/hooks/useLearning.ts`の`evaluatePlanner`: `actualSessions`の事前フィルタとして使っていた`isDayProgressSession`を撤去。理由は、`PlannerEvaluationService`が「削除されたSession」と「再スケジュールされたSession」を区別するには、フィルタされる前の生の`status`/`archived`情報が必要なため（事前にフィルタすると両方とも単に「リストに無い」という同じ見え方になってしまい判別できない）。
- `src/intelligence/learning/DailyFeatureExtractor.ts`の`skipCount`: `cancelled`を判定条件に含めていた分岐を削除し、`skipped`のみを見るよう簡略化（この分岐は、`daySessions`が既に`isDayProgressSession`でフィルタ済み・かつ`cancelled`は常に`archived:true`とペアになる現在の実装では、そもそも到達不可能な死んだコードになっていたため）。

**相互作用の確認:** `CalendarView`/`CalendarEditorAdapter`（削除呼び出し連鎖、既存のまま問題なし）、`CalendarViewAdapter.ts`（`isScheduleVisibleSession`を使っており元々このバグの影響を受けていなかったことを確認）、`eveningQuestion.ts`・`proposalContext.ts`（`isDayProgressSession`経由で透過的に修正されることを確認、直接の変更不要）を個別に確認し、他に同種のバグが無いことを確認した。

**検証:** `npx tsc --noEmit` 0エラー。`src/__tests__/sessionVisibility.test.ts`に「削除済み（archived+未完了）Sessionは進捗分母から除外される」テストを追加、新規`src/__tests__/plannerEvaluationService.test.ts`を作成し「削除されたSessionは配置成功率の分子・分母どちらからも除外される」「再スケジュールされたSessionは引き続き配置失敗としてカウントされる」の2ケースを追加。`npm test`は32スイート198件全て成功（既存195件+新規3件）。`npm run lint`は0エラー・26警告（ベースラインと一致、新規警告なし）。

### 続報（タップ閉じの実機確認OK、追加で「ふりかえり」保存/キャンセルがスクロール必須だった問題を修正）

ユーザーからタップでの閉じが実機で機能したとの報告を受けた。続けて「今日のふりかえり」画面で、下にスワイプ（スクロール）しないと「保存して学習させる」「キャンセル」ボタンに気づけない・押せない、との追加要望があった。

**原因確認:** `ReflectionModal.tsx`を確認したところ、他のモーダル（`EventEditor`/`AiScheduleModal`/`CoachModal`）が既に「操作ボタンはScrollViewの外の固定フッターに置く」という構成になっていたのに対し、`ReflectionModal`だけ**「保存して学習させる」「キャンセル」ボタンがScrollViewの内側・末尾**に置かれたままだった。`scroll`スタイルは`maxHeight:360`で明示的に高さを制限しているため、気分・エネルギー・自由記述欄などの入力項目でこの高さを超えると、ボタンはスクロールしないと画面に出てこない状態だった。

**修正:** 2つのボタンをScrollViewの外に出し、他モーダルと同じ`footer`（`flexShrink:0`・上部に区切り線）として固定表示するよう変更。保存/キャンセルの呼び出しロジック自体（`handleSave`/`tryClose`）は一切変更していない。

**横展開確認（ユーザー指示どおり、他への相互作用を確認）:** 同じ「操作ボタンがScrollView内に閉じ込められている」パターンが他のモーダルにも無いか、`AiScheduleModal`/`ScheduleAdjustModal`/`CoachModal`/`LooperPickerSheet`/`EventEditor`を全て確認した。結果、いずれも既に正しくScrollView外の固定フッターに配置されており、**同種のバグは`ReflectionModal`のみ**だったことを確認した。また、前回追加した「ハンドルバーのタップで閉じる」機能（`TouchableOpacity`が`BottomSheetDragHandle`の`handleBar`のみをラップし、`children`＝各モーダル独自のヘッダー内容とは別要素であること）が、`LooperPickerSheet`のキャンセル/完了ボタン等の既存タップ動作と衝突していないこともコードレベルで確認した（構造上重ならない）。

**検証:** tsc 0エラー・テスト31スイート195件全成功（ロジック不変、JSX配置のみの変更）・lint 0エラー26警告（不変）。ローカルWebでモバイル幅にてReflectionModalを開き、スクロールせずに「保存して学習させる」ボタンが画面内に収まっていることを座標で確認した。

### 決定事項
- ボトムシート系モーダルの操作ボタン（保存・削除・キャンセル等）は、常にScrollViewの外側の固定フッターに置く。この規約を今後の新規モーダルにも適用する。

### 続報（ユーザーの標準指示どおり自動でpush・APK再ビルド・配布資料更新を実施）

push後Vercelが自動本番デプロイ（Ready）、https://orbit-looper-red.vercel.app が最新デプロイ（`rakdc9a8v`）を指すことを確認。Android APK新ビルド: `https://expo.dev/accounts/asuforge/projects/orbit-looper/builds/c67afce8-13fd-4a29-b3d5-8874abd2fc9b`。`docs/lt-assets/`のQR・`LT_HANDOUT.md`・当日チェックリスト（ふりかえりの保存/キャンセル確認項目を追加）を新ビルドに更新。

### 経緯・何が起きたか

前回セッションで3回試みた「ボトムシートのドラッグ閉じ」修正（useNativeDriver統一→locationYベース判定の廃止）が、ユーザーの実機（Android）でも直っていなかった。3連続で外したため、当て推量での修正を止め、まず土台となるライブラリの有無を確認する方針に切り替えた。

`react-native-gesture-handler`・`react-native-reanimated`とも**未導入**であることが判明した。現状のドラッグ閉じは素の`PanResponder`のみで実装されているが、React NativeのAndroidでは`Modal`が別ウィンドウ（別のView階層）に描画されるため、その中の`PanResponder`ジェスチャーが正しく機能しないことがある、という既知の制約に行き着いた。確実な解決には`react-native-gesture-handler`の導入＋Modal内への`GestureHandlerRootView`設置という大掛かりな対応が必要になり、実機で検証できない状態でこれ以上ジェスチャー実装に手を入れると4回目の失敗リスクが高いと判断し、ユーザーに率直に状況を説明した。

ユーザーと相談の上、方針を転換: **ドラッグに固執せず、確実に効く「ハンドルバーのタップでも閉じる」機能を追加する**ことで合意した。タップの当たり判定はModal内でもプラットフォームを問わず確実に機能するため、これなら実機でも保証できる。

### 実装内容

`BottomSheetDragHandle.tsx`に`onClose`プロパティを追加。指定されると、ハンドルバー全体（視覚的な棒＋案内文言）を`TouchableOpacity`でラップし、タップで閉じられるようにした。案内文「スワイプ / タップで閉じる」をバーの上に表示し、閉じる手段が増えたことをユーザーに明示。既存の`panHandlers`（ドラッグ、効く環境ではドラッグでも閉じられる）はそのまま維持。

6箇所のモーダル全て（AiScheduleModal/ScheduleAdjustModal/CoachModal/EventEditor/LooperPickerSheet/ReflectionModal×2箇所）で、各々の既存クローズハンドラ（`handleClose`/`tryClose`/`onClose`/`onCancel`）を`onClose`として渡すよう配線した。

**検証:** tsc 0エラー・テスト31スイート195件全成功（ロジック不変）・lint 0エラー26警告（不変）。ローカルWebでEventEditorとReflectionModalの2箇所について、ハンドルバー領域をタップして実際にモーダルが閉じることを確認、「スワイプ / タップで閉じる」の文言表示もスクリーンショットで確認した。タップの当たり判定はドラッグと異なりプラットフォーム間の実装差が生じにくいため、今回は実機での再現リスクが低いと判断している（ただし従来のドラッグ閉じの原因については依然、実機での完全な根本解決に至っていない可能性が残る）。

### 決定事項
- ドラッグ閉じの完全な実機対応（`react-native-gesture-handler`導入等）は今回のスコープ外とし、まず「タップでも確実に閉じられる」対応を優先した。ユーザーへの説明と承認のもとでの方針転換。
- 今後、真にドラッグ閉じを実機で保証したい場合は`react-native-gesture-handler`の導入を検討する（要・実機での動作確認体制）。

### 続報（ユーザーの標準指示どおり自動でpush・APK再ビルド・配布資料更新を実施）

ユーザーの「改善後は勝手にpush・APK生成まで」という指示に従い実施。push後Vercelが自動本番デプロイ（Ready）、https://orbit-looper-red.vercel.app が最新デプロイ（`nh0nuqzfx`）を指すことを確認。Android APK新ビルド: `https://expo.dev/accounts/asuforge/projects/orbit-looper/builds/219eabbb-22cf-4864-8eda-7b754138ed9d`。`docs/lt-assets/`のQR・`LT_HANDOUT.md`・当日チェックリスト（ドラッグ確認→タップ確認に文言変更）を新ビルドに更新。

### 次回への申し送り
- ハンドルバーの**タップ**で閉じられることを実機で確認してもらう（ドラッグより確実性が高いはず）。もし引き続きドラッグでの動作にこだわりたい場合は、`react-native-gesture-handler`導入という次のステップを検討する。



### 続報（ドラッグ閉じ、useNativeDriver修正だけでは直っておらず、真因をさらに追及・再修正）

ユーザーから「修正されていませんでした」と報告。前回の`useNativeDriver`統一だけでは実機で直らなかったことを受け、`useBottomSheetDismiss.ts`の設計そのものを再点検した。

**発見した本当の問題:** ジェスチャーの発生範囲を、`evt.nativeEvent.locationY`をしきい値（148px）と比較して判定していた（`onStartShouldSetPanResponder`で保存した`locationY`が148px以下ならドラッグ許可）。**`locationY`はReact Nativeの中でも特にプラットフォーム間で挙動が一致しないことで知られる値**（どのネストしたViewが実際にタッチを受け取ったかによって基準点が変わる）。react-native-web（Webポリフィル）と実機Android/iOSとで基準点の解釈が異なりうるため、**Web上のテストでは閾値を満たしてドラッグ判定が成立していても、実機では`locationY`が全く別の基準（画面全体、あるいはより大きな祖先View基準など）で計算されて閾値を超え、ドラッグが一切開始しない**、という説明が成り立つ。これは前回「Webで動作確認したのに実機で直っていない」の実態そのものであり、**前回の`preview_click`等によるWeb実地確認そのものが、実機の挙動を正しく予測できていなかった**ことを意味する。

**根本修正:** ピクセル/位置ベースの判定を完全に廃止し、**ジェスチャーハンドラ（`panHandlers`）をシート全体ではなく、ハンドルバー＋ヘッダーを描画する小さな`BottomSheetDragHandle`コンポーネント自身に直接アタッチ**する構造に変更した。タッチがそのコンポーネントの範囲内で始まったかどうかは、`locationY`のような数値判定に頼らず、**DOM/ビューツリー上の構造そのもの**で保証されるため、プラットフォーム間の解釈違いが原理的に発生しない。`onStartShouldSetPanResponder`は引き続き`false`を返す設計を維持（＝ハンドル内にボタン等があってもタップは素通りし、実際に指を動かした時だけ`onMoveShouldSetPanResponder`がドラッグとして採用する）ため、`LooperPickerSheet`のキャンセル/完了ボタンなど、ハンドル内の既存タップ動作にも影響しない。

`BottomSheetDragHandle`に`panHandlers`プロパティを追加して自身のルートViewへ`{...panHandlers}`を適用するよう変更し、6箇所すべてのモーダル（AiScheduleModal/ScheduleAdjustModal/CoachModal/EventEditor/LooperPickerSheet/ReflectionModal×2箇所）で、シートルートの`Animated.View`から`panHandlers`を外し、`<BottomSheetDragHandle panHandlers={panHandlers}>`へ渡すよう統一した。`EventEditor`はもともとハンドル内にヘッダー文言が無く薄い帯だけがドラッグ領域だったため、タイトル文言をハンドル内に移動して掴みやすくし、移動に伴い失われる横パディングを`dragHandlePadding`スタイルで補った。

**検証:** tsc 0エラー・テスト31スイート195件全成功（UI/ジェスチャー構造のみの変更、ロジック不変）・lint 0エラー26警告（不変）。ローカルWebで座標ベースの合成タッチイベントによりハンドルバードラッグ→モーダルが閉じることを再確認、EventEditorのタイトルの左パディングも正しく保持されていることをスクリーンショットで確認。**ただし今回の核心的な学びとして、Web上の合成タッチイベントによる検証は実機の挙動を保証しない**（前回の「Web確認済み」が実際には不十分だった）。構造的な修正（`locationY`依存の排除）は原理的に正しいはずだが、**実機（Android）での最終確認が今回も必須**。

### 決定事項
- ボトムシートのジェスチャー判定に`locationY`等の数値・座標しきい値を使わない。ドラッグ可能な範囲は、ジェスチャーハンドラをアタッチするコンポーネントの構造的な範囲（＝そのコンポーネントがレンダーする領域）でのみ規定する。
- 「Web実地確認で動作した」は実機での動作を保証しない。特に`useNativeDriver`・ジェスチャー座標系などネイティブ/Web間で実装が分岐する領域は、実機確認を経るまで「修正完了」と報告しない（今回の教訓）。

### 続報（ユーザーの標準指示どおり自動でpush・APK再ビルド・配布資料更新を実施）

ユーザーの「改善後は勝手にpush・APK生成まで」という指示に従い実施。push後Vercelが自動本番デプロイ（Ready）、https://orbit-looper-red.vercel.app が最新デプロイ（`2cfha55vh`）を指すことを確認。Android APK新ビルド: `https://expo.dev/accounts/asuforge/projects/orbit-looper/builds/e43fd930-f03b-433d-90fd-43569dbae6ec`。`docs/lt-assets/`のQR・`LT_HANDOUT.md`を新ビルドに更新（旧`8949c690…`は配布しない旨を明記）。**このドラッグ閉じ修正はネイティブ固有バグの根本対応のため、実機（Android）でハンドルバーを下ドラッグして閉じるかの最終確認が本セッションで最も重要な申し送り事項。**

### 続報（ボトムシートのドラッグ閉じが実機で効かない真因＝useNativeDriver混在を修正）

前段でドラッグ閉じは「実装済み・Webで動作確認済み」と報告したが、ユーザーから「実機で効かない気がする」と再指摘。**Webでは動くのに実機で効かない**という症状から、ネイティブ固有の問題を疑い`useBottomSheetDismiss.ts`を精査したところ、**古典的なReact Nativeのバグ**を発見した。

`onPanResponderMove`はドラッグ追従に`translateY.setValue(gesture.dy)`という**JS側の命令的更新**を使う一方、離した時の`onPanResponderRelease`/`onPanResponderTerminate`の3つのアニメーション（`Animated.timing`/`Animated.spring`）は`useNativeDriver: true`だった。**同一の`Animated.Value`に対して「JSの`setValue`」と「`useNativeDriver:true`のアニメーション」を混在**させると、一度ネイティブドライバのアニメーションが走った時点でそのノードが「ネイティブ側へ移動」し、以降のJS側`setValue()`は**Android/iOSでは視覚的に反映されなくなる**（RN公式が警告する既知のアンチパターン）。`useNativeDriver`はWebでは常に無視されるため、この不整合は**Webでは顕在化せず、実機でだけドラッグが効かなくなる**——「Webで確認したのに実機でダメ」の完全な説明になる。

修正: 3箇所の`useNativeDriver: true`をすべて`false`に変更し、`setValue`（JS）とアニメーション（JS）をドライバ統一した。`translateY`（transform）はJSドライバでも問題なくアニメーションする（短い開閉アニメーションのため体感差は無い）。他コンポーネントに同種の`setValue`+`useNativeDriver:true`混在が無いことも`grep`で確認済み。前段のハンドル拡大（幅44px・掴み代拡張）と合わせ、実機でのドラッグ閉じが機能するはず。

**検証:** tsc 0エラー・テスト31スイート195件全成功（ロジック不変）・lint 0エラー26警告（不変）。ローカルWebでハンドルバーを下ドラッグしてモーダルが閉じることを再確認（Web挙動にリグレッション無し）。※本修正の主眼はネイティブ固有バグのため、実機（APK）での最終確認が本来必要だが、原因と対策は確実。ユーザーが「改善後は勝手にpush・APK生成まで」と指示したため、この後自動でpush・APK再ビルドまで実施する。

### 決定事項
- ボトムシートのドラッグ追従は`setValue`（JS）で行うため、開閉アニメーションも必ず`useNativeDriver: false`にする（ドライバ混在禁止）。これが実機で効かなかった真因。
- 「Webで動く＝実機で動く」ではない。`useNativeDriver`が絡む挙動はWebで検証できないため、Web確認だけで動作保証したことが前回の誤りだった。

### 続報（指示どおり自動でpush・APK再ビルド・配布資料更新を実施）

ユーザーの「改善後は勝手にpush・APK生成まで」の指示に従い実施。push後、Vercelが自動本番デプロイ（Ready）。https://orbit-looper-red.vercel.app が最新デプロイ（`chnxa105i`）を指すことを確認。Android APK新ビルド: `https://expo.dev/accounts/asuforge/projects/orbit-looper/builds/8949c690-e58d-4c74-8d56-606363097deb`。`docs/lt-assets/`のQR・`LT_HANDOUT.md`を新ビルドに更新。**この修正の主眼はネイティブ固有バグのため、実機（Android）でハンドルバーを下ドラッグしてモーダルが閉じるかの最終確認が本来必要**（Webでは検証不可）。

### 続報（配置場所が無くなったタスクが行方不明になるバグの調査・修正）

ユーザーから「タスクの設定できる時間・場所がなくなると、裏では設定されているのに表では表示されなくなる。警告は出るがタスクがどこに行ったか分からない」との報告。発生条件は不明とのことだったが、コードを精査し**2つの独立したバグ**を特定した。

**バグA（真因・虚偽の成功報告）:** `placementRollover.ts`の`runPlacementWithRollover()`は、今日に配置できなかったタスクを`tomorrowPlan = generateDayPlan(tomorrow, unplaced)`で明日への配置を試みるが、**明日側の配置が実際に成功したかを一切検証せず**、無条件で`rolledTomorrowTitles.push(...)`（＝「明日に繰り越しました」という成功報告）していた。もし明日も容量が無ければ、そのタスクは今日にも明日にもセッションが無い状態になるが、UIには「繰り越しに成功した」という誤った通知が出て、実際には**どこにもセッションが存在しない孤児タスク**になる。このアプリには全タスク一覧・バックログ画面が存在しないため（`grep`で確認）、セッションが無いタスクは文字通り全画面から見えなくなる。

**バグB（一度孤児化すると二度と拾われない）:** `morningTaskSelector.ts`の`resolveMorningReplanTaskIds()`は、今日に**何らかの**アクティブセッションが既に存在する場合、`selectTasksForPlacement()`（＝配置候補となる全inbox/readyタスク）を候補から除外し、`todayActive`（今日既にセッションがあるタスク）と`carryOver`（過去に**セッションを持ったことがある**未完了タスク）だけを返す仕様だった。バグAで孤児化したタスクは、セッションを一度も持てていないため`carryOver`にも`todayActive`にも該当せず、翌日以降に他のタスクが1件でも配置されていれば、自動プラン生成・手動の「AIで作り直す」ボタンのどちらでも**二度と配置候補に上がらない**——恒久的に行方不明になる構造だった。

**修正:**
1. `PlanApplyOutcome`（`placementRollover.ts`・`CalendarPlannerAdapter.ts`の2箇所に重複定義あり、両方修正）に`stillUnplacedTitles: string[]`を追加。`runPlacementWithRollover()`は`tomorrowPlan`適用後に`getUnplacedTaskIds(tomorrowPlan, unplaced, tasks, sessions)`で実際の配置成否を検証し、成功した分だけ`rolledTomorrowTitles`に、失敗した分は`stillUnplacedTitles`に振り分けるよう変更。
2. `buildRolloverNotice()`に`stillUnplacedTitles`向けの新しい文言（「空き時間が見つからず保留にした予定（X）があります。所要時間を短くするか、別の日を指定してください」）を追加。
3. `App.tsx`の`skipped_empty`時の警告メッセージも、`stillUnplacedTitles`があれば具体的なタスク名を含めるよう改善（従来はタスク名を出さない汎用文言のみだった）。
4. `resolveMorningReplanTaskIds()`を、`todayActive`があっても`placable`を常に含む「常時ユニオン」方式に変更（バグBの根本対応）。これにより孤児化したタスクも次回のプラン生成・全AI再計画で再度候補に上がるようになる。

**検証:** tsc 0エラー・テスト31スイート195件全成功（+3、うち2件は今回の両バグを直接再現する回帰テスト: 「明日も満杯なら繰り越し成功を報告しない」「今日に既存セッションがあっても孤児タスクが候補に残る」）・lint 0エラー26警告（不変）。この修正は複数日にまたがる容量枯渇を人為的に再現する必要があり、ブラウザでの実地確認は非現実的なため、単体テストでロジックの正しさを担保した（他のプランナーロジックもこれまで同方針）。

### 決定事項
- タスクの配置成否は「実際にセッションが生成されたか」で検証する。楽観的な成功報告（配置を試みただけで成功とみなす）は禁止。
- 配置候補の選定（`resolveMorningReplanTaskIds`）は、今日の状態に関わらず常に全placableタスクを含める。「今日は既にセッションがあるから」という理由で除外しない（孤児化防止）。
- このアプリには全タスク一覧・バックログ画面が存在しない。将来的に配置に失敗したタスクを見つける手段として、そうした画面の追加を検討する価値がある（今回はスコープ外、通知の具体化で対応）。

### 続報（ユーザー承認を得てpush・APK再ビルド・配布資料更新を実施）

ユーザーが承認したため push した。GitHub連携によりVercelが自動で本番デプロイ（Ready、32秒）。https://orbit-looper-red.vercel.app が最新デプロイ（`25twxbc07`）を指していることを確認。Android APK新ビルド: `https://expo.dev/accounts/asuforge/projects/orbit-looper/builds/bd617755-295b-4011-9d08-d0a2c2270a69`。`docs/lt-assets/`のQR・`LT_HANDOUT.md`を新ビルドに更新した。

### 次回への申し送り
- 発生条件が再現しにくいバグのため、実機での長期的な様子見が望ましい。タスクが理由なく消えたと感じたら、まずこの日の修正（`stillUnplacedTitles`関連）が効いているか確認する。
- 将来的な検討課題として、全タスク一覧／バックログ画面の追加（配置に失敗したタスクを能動的に見つけられるように）。

### 続報（UI改善3件: AIコーチのキーボード被り・優先度例の半角/全角混在・ボトムシートのドラッグ閉じ）

ユーザーから3点の改善要望: (1) AIコーチのチャット入力時にキーボードで入力欄が隠れる、(2) AIスケジュール入力例の優先度記法で「最高」だけ`!`が半角で全角と混在して気になる、(3) 下から出るボトムシートをバーを下げて閉じられるようにしてほしい。

**(1) キーボード被り。** `CoachModal.tsx`（および同構造の`ReflectionModal.tsx`・`AiScheduleModal.tsx`）の`KeyboardAvoidingView`が`behavior={Platform.OS === 'ios' ? 'padding' : undefined}`で、**Androidでは`undefined`＝キーボード回避が無効**だった。RNの`Modal`は別ウィンドウに描画されるため`android:windowSoftInputMode=adjustResize`（app.jsonで設定済み）が効かず、モーダル内では`KeyboardAvoidingView`が回避を担う必要がある。Androidの`behavior`を`'height'`に変更し、キーボード表示時にビューが縮んで入力欄が持ち上がるようにした。※ソフトキーボードはデスクトップWebでは再現できないため、実機（Android）での最終確認が必要。

**(2) 半角/全角混在。** `AiScheduleModal.tsx`の説明文・プレースホルダーの優先度例が半角`!`（`!最高 !高 ...`）で書かれ、末尾の「全角『！』もOK」の全角`！`と視覚的に混在していた。日本語IMEの既定入力は全角のため、例を**全角`！`に統一**（`！最高 ／ ！高 ／ ！普通 ／ ！低 ／ ！最低。半角「!」でもOK`）。パーサーは前段で全角・半角両対応済みなので機能面の変更はなく、表示の一貫性のみ。

**(3) ドラッグ閉じ。** 調査の結果、`useBottomSheetDismiss`＋`BottomSheetDragHandle`による下方向ドラッグ閉じは**全ボトムシート（AiSchedule/ScheduleAdjust/Coach/EventEditor/LooperPicker/Reflection）に既に実装・配線済み**で、ブラウザでハンドルバーから下ドラッグ（合成TouchEvent）してモーダルが実際に閉じることも確認できた（＝機能は動作している）。ユーザーが「閉じられない」と感じた主因は、ハンドルバーが小さく掴む対象として分かりにくい点だと判断し、`BottomSheetDragHandle`のハンドルを拡大（幅36→44px、色を`secondary`→`textTertiary`でやや明瞭化、掴み代の`paddingVertical`追加）して発見性・操作性を上げた。ドラッグ判定ロジック自体（動作確認済み）は変更していない。

**検証:** tsc 0エラー・テスト31スイート192件全成功（UIのみの変更、ロジック不変）・lint 0エラー26警告（不変）。ローカルWebで(2)の全角統一表示、(3)のハンドル拡大とドラッグでのモーダル閉じを確認。(1)はコード変更のみ（ソフトキーボードはWebで再現不可）。

### 決定事項
- モーダル内キーボード回避はAndroidで`behavior='height'`を使う（`Modal`は別ウィンドウで`adjustResize`が効かないため）。今後モーダルにテキスト入力を足す際もこの方針。
- 優先度記法の表示例は全角`！`に統一（日本語IME入力の実態に合わせる。半角`!`も引き続き受理）。
- ボトムシートのドラッグ閉じは実装済み・動作確認済み。ハンドルを拡大して発見性を改善（ロジックは据え置き）。

### 次回への申し送り
- **push・APK再ビルドは未実施。** 3件の改善はコミット済みだが、ユーザーの確認・承認を待ってからWeb反映（push）とAPK再ビルドを行う。特に(1)キーボード被りは**実機（Android）での確認が必須**（Webでは検証不可）。

### 続報（削除ボタンの確認・3ボタン常時表示の要望への回答、push・APK再ビルド）

ユーザーから「タスク削除ボタンはちゃんとあるか」「スクロールしなくても保存・削除・キャンセルを押せるようにしてほしい」との要望。コードを確認したところ、削除ボタンは`CalendarViewAdapter.ts`で`deletable: !isRescheduled && session.status !== 'completed'`（＝アクティブ・未完了のタスクセッション）に対して有効化され、`EventEditor`側も`isEditing && event.deletable && onDelete`で表示、`CalendarView`が`onDelete`を配線済みで、削除ボタンは既に存在すると確認できた。また保存・削除・キャンセルの3ボタンはすべて`ScrollView`の外側の固定フッター（`footer`, `flexShrink:0`）に配置されており、前段のスクロール不能修正（`sheetBody`に`flexShrink:1`）によって既にスクロール不要で常時表示される状態になっていた。つまりユーザーの2要望は前コミット`f40e8e8`で既に解決済みで、ユーザーが見ていたのは未配信の旧ビルドだった。

念のためモバイル幅（375x812）で実タスクを作成→再編集し、「予定を編集」画面で削除（赤・左下）・保存・キャンセル（右下）の3ボタンがスクロール不要で全て表示されることをスクリーンショットで確認した。ユーザー承認のもとpush（Web版自動デプロイ、最新デプロイ`hhd146qb1`をライブURLが指すことを確認）とAndroid APK再ビルドを実施。新ビルド: `https://expo.dev/accounts/asuforge/projects/orbit-looper/builds/97b6374a-d966-4c8b-be90-3849d88872b9`。`docs/lt-assets/`のQR・`LT_HANDOUT.md`・当日チェックリスト（優先度の全角！確認・編集モーダルのボタン常時表示確認を追加）を新ビルドに更新した。

### 決定事項
- 削除ボタンはアクティブ・未完了タスクの編集時のみ表示（完了済み・rescheduled・固定予定は削除不可）。この仕様は妥当として維持。
- 保存・削除・キャンセルは固定フッター（ScrollView外）に配置し、`sheetBody`の`flexShrink:1`でスクロール不要の常時表示を担保する（前段の修正で達成済み）。

### 次回への申し送り
- 特になし。全変更がpush・APK再ビルド（`97b6374a…`）まで反映済み。実機での最終確認（削除ボタン表示・3ボタン常時表示・優先度の全角！）が望ましい。

### 続報（優先度指定の全角！対応＋解釈プレビュー、および予定編集モーダルのスクロール不能バグ修正）

ユーザーから3点の報告: (1) 一括入力の優先度記法（スペースを挟んで`!最高`等）が分かりにくい、(2) そもそもこの記法で優先度がちゃんと付いているか怪しい、(3) スケジュール管理画面のタスク編集UIがスクロールできず、削除・編集が実行できない。

**(2)の真因を発見: 全角「！」が未対応だった。** `resolveAiTasks.ts`を確認したところ、パースされた`priority`は`createTask({ priority })`まで正しく流れており、ロジック自体は動作していた。しかしユーザーのメッセージで全角の「！最高」が使われていたことに着目し、`bulkTaskInput.ts`の優先度パターンを確認すると**半角`!`のみにマッチ**する実装だった。日本語IMEでは全角「！」が既定で入力されるため、全角で入力すると優先度が無言で無視される——これが「ちゃんと付いてるか微妙」の正体だった。`BULK_PRIORITY_PATTERN`を`[!！]`（半角・全角両対応）に変更し、あわせて先頭スペースの必須要件も撤廃（`英語 !高`／`英語!高`／`英語 ！最高`のいずれも動く）。末尾の単語境界ルック アヘッド（`(?=\s|$)`）は維持し、`終わった!高揚感`のような語中マッチは引き続き無視する。

**(1)への対応: 解釈結果のライブプレビューを追加。** `AiScheduleModal.tsx`に、一括入力欄の下へ「解釈結果（この内容で配置します）」として、各行がどう解釈されたか（タイトル・優先度ラベル・所要時間 or AI推定）をリアルタイム表示するリストを追加した。これにより記法が自己説明的になり（見れば書き方が分かる）、かつ優先度が実際に付いていることが即座に確認できる（(1)(2)を同時に解決）。説明文・プレースホルダーも全角！対応・スペース任意である旨を反映して更新。

**(3)の原因と修正: `EventEditor.tsx`のScrollView高さ伝播バグ。** モーダルの`sheet`は`maxHeight:'90%'`だが、その内側の`sheetBody`（Viewで、タイトル＋ScrollView＋フッターを包む）に**flex制約が無かった**。RNのデフォルトは`flexShrink:0`のため、コンテンツが画面高さを超えると`sheetBody`が縮まずフル高さに広がり、ScrollViewが高さ制約を受け取れずスクロール不能になり、下部のフッター（保存・削除・キャンセル）が画面外にはみ出して操作不能になっていた。`sheetBody`に`flexShrink:1`を追加し、sheetの`maxHeight`制約がScrollViewまで正しく伝播するようにした。

**検証:** tsc 0エラー・テスト31スイート192件全成功（+3、全角！・スペース無し・語中非マッチ）・lint 0エラー26警告（不変）。ローカルWebプレビューで実地確認: (a) AIスケジュール作成で「英語の過去問 30分 ！最高」「買い物!低」を入力し、プレビューに「優先度: 最高／30分」「優先度: 低／AI推定」と正しく解釈表示されること（全角！・スペース無しとも認識）。(b) モバイル幅（375x812）で予定編集モーダルを開き、以前は隠れていた固定予定トグル・メモ欄までスクロールで到達でき、保存/キャンセルフッターが常時表示されること。

### 決定事項
- 優先度マーカーは半角`!`・全角`！`の両方を受け付け、先頭スペースは任意（日本語IMEでの入力を確実に拾うため）。
- 一括入力には「解釈結果プレビュー」を常設し、パース結果を可視化する（記法の自己説明＋動作確認を兼ねる）。
- ボトムシート系モーダルでScrollView＋固定フッター構成にする場合、中間のViewに`flexShrink:1`を付けて高さ制約を伝播させる（EventEditorで確立したパターン。他モーダルで同様のスクロール不能が出たら同じ対処）。

### 次回への申し送り
- **push・APK再ビルドは未実施。** 3点の修正はコミット済みだが、ユーザーの確認・承認を待ってからWeb反映（push）とAPK再ビルドを行う。(3)のスクロール修正は実機（特に画面の小さいAndroid端末）での再確認が望ましい。

### 続報（本番Web版で「Google AI Studio」リンクが開けない不具合の修正）

前段の改善（`TouchableOpacity`＋`Linking.openURL()`への変更）をpush・APK再ビルド・実機確認まで済ませたが、ユーザーから改めて「webアプリのgoogle ai studioのリンクを押しても開けませんでした」と報告があった。ローカル環境の座標クリックテストでは`window.open()`の呼び出し自体は確認できていたため、原因は呼び出しの有無ではなく**ブラウザのポップアップブロッカー**だと判断した。

react-native-webの`Linking.openURL()`はWeb実装上`window.open(url, target, 'noopener')`を呼ぶが、これはスクリプトから発火した「ポップアップ」として扱われるため、ブラウザ（特に本番のVercelドメイン、初回訪問時など）によっては実際のユーザー操作起因でも無言でブロックされることがある。一方、本物の`<a href>`タグのクリックはポップアップブロッカーの対象にならず、確実に新しいタブが開く。

対応: `react-native-web`の`Text`コンポーネントが公式にサポートする`href`/`hrefAttrs`プロパティ（内部で本物の`<a>`要素としてレンダリングされる）を使うよう変更した。ただしRN本体の`TextProps`型定義には`href`/`hrefAttrs`が含まれていない（react-native-web固有の拡張のため）ため、ピンポイントで型キャストして対応した。このボタンは元々`isWeb`条件内でのみ描画される（APK側には存在しない）ため、Web版だけの変更で完結する。

**検証:** tsc 0エラー・テスト31スイート189件全成功（変更なし）・lint 0エラー26警告（不変）。ローカルExpo Web開発サーバーで、DOM上に実際に`<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">`が生成されていることを確認した（`window.open`経由ではなく本物のアンカー要素）。

### 決定事項
- Web版で外部リンクを開く際は、`Linking.openURL()`（`window.open`経由）ではなく、react-native-webの`Text`の`href`/`hrefAttrs`（本物の`<a>`タグ）を使う。ポップアップブロッカーの影響を受けないため。この方針は今後同様のWeb限定の外部リンクにも適用する。

### 続報（ユーザー承認を得てpush実施）

ユーザーが承認したため push した。GitHub連携によりVercelが自動で本番デプロイ（Ready、33秒）。https://orbit-looper-red.vercel.app が最新デプロイを指していることを確認し、公開バンドルに`aistudio.google.com/apikey`の文字列（＝`<a href>`化した変更）が含まれていることも確認した。今回はWeb版のみの変更（`isWeb`条件内のUI）でAPKには影響しないため、APK再ビルドは行っていない。

### 次回への申し送り
- 特になし。本番Web版でGoogle AI Studioリンクが実際に開けるか、ユーザーの実機での最終確認が望ましい。

### 続報（チャットのURLリンク破損の原因判明、および「Google AI Studio」リンクの改善）

**チャットで共有したURLがOSのリンクハンドラでエラーになる問題を発見。** ユーザーが`https://orbit-looper-red.vercel.app（最新デプロイ確認済み）`というリンクをクリックしたところ、`vercel.xn--app()-qg4dpj1j6e2iu616cgkdz43agh8au49c`という破損したURLが開こうとしてエラーになった。原因は、URLの直後にスペース無しで日本語の括弧書きを続けていたため、リンクの自動認識処理が括弧内テキストまでホスト名の一部として取り込み、非ASCII文字をPunycodeエンコードしてしまったこと。これはおそらく、本セッション序盤の「webのリンクがうまく開けません」という報告の原因でもあった可能性が高い（当時も同様の書き方をしていた）。以後、URLの直後に別のテキストを続ける場合は必ずスペースを空けるか改行するよう徹底する。配布資料（QRコード・`LT_HANDOUT.md`）はURL文字列を直接コマンドに渡して生成しているため、この問題の影響は受けていない。

**「Google AI Studio」リンクのタップ動作を改善。** ユーザーから「APIキー入力欄下のGoogle AI Studioと書いてある部分をタップしたらリンクに飛ぶようにしてほしい」との依頼を受けた。コードを確認したところ`onPress`自体は既に設定されていたが、地の文（`betaNote`）の中に埋め込まれた入れ子の`<Text onPress>`という構造で、視覚的にリンクだと分かりにくく（下線なし、太字色のみ）、タップ領域も狭かった。`.click()`による直接呼び出しでは動作が確認できてしまうため、実際の座標クリック（`elementFromPoint`で実際にヒットする要素を特定してからイベント発火）でも検証し、機能自体は動くことを確認した上で、視認性・タップ確実性の両面を改善する方針とした。地の文から独立させ、`TouchableOpacity`＋`hitSlop`＋下線付きテキスト「Google AI Studio を開く ›」という、他のリンク行（フィードバックを送る等）と同じパターンの独立したタップ領域に変更した。

**検証:** tsc 0エラー・テスト31スイート189件全成功（変更なし、UIのみの変更）・lint 0エラー26警告（不変）。ローカルExpo Web開発サーバーで実地確認: Settings画面で新しいリンク行が下線付きで表示され、座標ベースの実クリックで`window.open('https://aistudio.google.com/apikey', '_blank', 'noopener')`が正しく呼ばれることを確認した。

### 決定事項
- チャットでURLを共有する際は、直後に別テキストを続ける場合は必ずスペース/改行を入れる（Punycode誤変換によるリンク破損を防ぐため）。
- 外部リンクは、地の文に埋め込むのではなく独立したタップ領域（`TouchableOpacity`＋下線）として提供する方が実機での確実性・視認性ともに高い。

### 続報（ユーザー承認を得てpush・APK再ビルド・配布資料更新を実施）

ユーザーが承認したため、push（Web版自動デプロイ）とAndroid APK再ビルドを実行した。Web版は https://orbit-looper-red.vercel.app が最新デプロイ（`ngk3p4yg0`）を指していることを確認済み。Android APK新ビルド: `https://expo.dev/accounts/asuforge/projects/orbit-looper/builds/c730ba40-2043-487c-9ea6-39860a88255e`。`docs/lt-assets/`のQR・`LT_HANDOUT.md`のリンクを新ビルドに合わせて更新した（Google AI Studioリンクの改善はWeb版UIのみのためAPK自体への実質影響はないが、配布資料は最新コミット基準に揃えた）。

### 次回への申し送り
- 特になし。全ての変更がpush・APK再ビルドまで反映済み。

### 続報（Web版リンクの疎通調査、および一括入力への優先度指定・詳細設定ボタンの視認性改善）

**Web版が開けないという報告の調査:** ユーザーから「webのほうのリンクがうまく開けません」と報告があり、`curl`でサーバー側を精査した。`https://orbit-looper-red.vercel.app`（配布資料記載のURL）はブラウザ相当のUser-Agentで確認しても常にHTTP 200・正しいHTML・正しいJSバンドルを返し、Vercelの認証保護もかかっていないことを確認した。一方、似た見た目の別URL`orbit-looper-nextday-forge-s-projects.vercel.app`はVercelのSSOログイン画面へ302リダイレクトされること、また`orbit-looper.vercel.app`（プロジェクト名だけの短いURL）は正式なエイリアスではなく古いデプロイ内容のままであることが判明した。ユーザーに「うまく開けない」の具体的な症状（真っ白／エラー文言／読み込めない）と使用端末（結果: PC・Chrome/Edge等、症状は「サイトのurlがおかしい」）を確認したが、まだ具体的なURL文字列やスクリーンショットまでは得られておらず、原因を完全には特定できていない。Chrome拡張が今回も接続できず、ブラウザでの直接再現ができなかった。

**一括入力への優先度指定を追加。** `AiScheduleModal.tsx`の簡易入力欄（1行1タスク）には所要時間（「30分」）しか指定できず、優先度は「1件ずつ詳細設定」を開かないと設定できなかった。ユーザーから「簡易入力にも優先度を指定できた方がいい」との要望を受け、`presentation/calendar/bulkTaskInput.ts`に`extractPriorityHint()`を新設。既存の`extractDurationHint()`と同じ設計思想（末尾/どこかにある特定パターンを検出して本文から除去）に倣い、`!高`のような「!」＋優先度ラベル（最高/高/普通/普/低/最低、または数字1〜5）というマーカー方式を採用した。バラの単語（「高」等）そのものを優先度として解釈すると、タスク名に偶然その文字が含まれる場合（例:「高校の宿題」）に誤爆するため、「!」マーカーを必須にして誤検出を防いだ（テストでも確認済み）。`parseBulkLines()`は所要時間ヒントと優先度ヒントを両方適用し、順序に依存せず両方指定できる（`30分 !高`でも`!高 30分`でも同じ結果）。モーダルの説明文・プレースホルダーも新しい記法を案内するよう更新。

**「1件ずつ詳細設定」ボタンの視認性を改善。** 従来は`theme.textTertiary`色・12pxの薄いプレーンテキストで、背景や枠線もなく見落としやすかった。ユーザーの「もう少し目立たせた方がいい」との指摘を受け、`theme.accentSoft`背景＋`theme.accent`色の13px太字＋枠線ありの、実際にタップ可能なボタンに見える見た目に変更。開閉状態を示す▾/▴の矢印も追加した。

**検証:** tsc 0エラー・テスト31スイート189件全成功（+6、優先度ヒントのパースと誤爆防止・複合指定の順序非依存性を含む）・lint 0エラー26警告（不変）。ローカルExpo Web開発サーバー＋Preview系ツールで実地確認: Web版の設定→AIでダミーキーを保存しAI機能を有効化した上で、AIスケジュール作成モーダルを開き、「英語の過去問 30分 !高」等3行を入力→「配置する（3件）」とタスク数が正しく反映されること、「1件ずつ詳細設定（優先度・所要時間）▾」ボタンが色付きの目立つボタンとして表示され、タップで正しく開閉すること（▴に切り替わる）を確認した。

### 決定事項
- 一括入力の優先度指定は「!」＋ラベル/数字のマーカー方式を採用（バラの単語では誤爆するため）。既存の所要時間ヒントと共存し、順序は問わない。
- 「1件ずつ詳細設定」ボタンは色付きの背景・枠線・太字のボタン然とした見た目に変更。

### 続報（Web版リンクの件は解決済みとの報告、①②をpush・APK再ビルド）

ユーザーから「Web版の問題は既に解決している」との報告があり、①（優先度指定）②（詳細設定ボタン視認性）の実行を承認された。push（Web版自動デプロイ）とAndroid APK再ビルドを実行した。Web版は https://orbit-looper-red.vercel.app が最新デプロイ（`1659k89qi`）を指していることを確認済み。Android APK新ビルド: `https://expo.dev/accounts/asuforge/projects/orbit-looper/builds/ac3df568-f932-4ff2-95d7-2aa12944e259`。`docs/lt-assets/`のQR・`LT_HANDOUT.md`のリンク・当日チェックリスト（優先度指定の確認項目を追加）を新ビルドに合わせて更新した。

### 次回への申し送り
- **実機での確認:** 新APK（`ac3df568…`）で、一括入力の「!高」等優先度指定が反映されるか確認。
- Web版リンクの疎通問題はユーザー報告により解決済み（詳細な原因は未共有だが、サーバー側は当時から問題無しと確認済み）。

### 続報（「今日の予定をAIで作り直す」実行時に明日のタスクが複製される不具合の調査・修正）

ユーザーから「今日のタスクをすべて完了し、その後に予定を調整のボタンを押すと次の日の予定を今日に持ってくるのではなく、複製されて今日に配置され明日のタスクは消えない」という報告を受けた。まずコード変更せず、ボタン→ハンドラの経路を追って原因を特定した。

**再現経路の特定:** 今日のセッションが全て`completed`だと`TodayView.tsx`の`canShiftFromNow`（`sessions.some(isMutableScheduleSession)`）が`false`になり、「今から順に並べる」（shift）は非表示。ユーザーが選べるのは「今日の予定をAIで作り直す」（`ScheduleAdjustModal`→`onFullReplan`→`useDayOrchestrator.ts`の`applyFullReplanPreview`）のみ。この経路は`previewFullReplan`→`resolveReplanTaskIds`→（明示指定が無ければ）`resolveMorningReplanTaskIds`を使う。

**原因は2箇所の相互作用:**
1. [`placementTaskSelector.ts`](../src/intelligence/planner/placementTaskSelector.ts)の`scheduledMinutesForTask()`が、他日のセッションのうち**完了済みだけ**を「消化済み」として差し引く。明日の`planned`（未完了）セッションは差し引かれないため、そのタスクは「全く未配置」と誤判定され、今日の配置候補としてフル時間で選ばれる。
2. [`useScheduleActions.ts`](../src/hooks/useScheduleActions.ts)の`resolveSessionsToReschedule()`（`replaceTaskSessions`モード）は`session.date === date`（＝今日）のセッションしか置き換え対象にしない。明日のセッションは別日付なので一切触られず、そのまま残る。

結果: 今日に新規配置（①）＋明日の元セッションは残置（②）＝複製。

**ユーザーへの確認と合意した設計:** 「今日に入る分だけ持ってくる。残りは明日に置いたまま」という要件を実装するにあたり、既存セッションを日をまたいで分数単位で分割する（例: 90分セッションのうち45分だけを今日に移し、残り45分だけ明日に残す）のは実装が重く、既存コードの慣習（`findLowerPriorityTaskIdsToBump`等はセッション単位で移動、分単位の分割はしない）とも合わないと判断。**「既存の未来日セッションを分割不可能な単位として扱い、今日に実際に配置された分でどこまで丸ごと解放できるかを判定する」**方式を採用（早い日付・時刻のセッションから優先）。今日に収まらなかった分（丸ごと解放できない残りのセッション）は一切手を加えず明日にそのまま残る。優先度に応じた今日/明日の振り分け自体は既存のPlacementEngine/Gemini配置がそのまま担当（変更なし）。

**実装:** `presentation/calendar/placementRollover.ts`に3つの純粋関数を追加。
- `sumPlacedMinutesByTask(sessions, dateKey, taskIds)`: 今日実際に配置された分をタスクごとに集計。
- `selectFutureSessionsToFree(sessions, dateKey, taskIds, placedMinutesByTask)`: 未来日の`isMutableScheduleSession`なセッションを日付・時刻の早い順に走査し、今日配置された分（+5分の許容誤差、`getUnplacedTaskIds`と同じ慣習）に収まる分だけ「解放対象」として選ぶ。収まらなくなった時点で打ち切り、以降のセッションには一切触れない。
- `buildFutureSessionFreeBatch(...)`: 解放対象を`status: 'rescheduled'`にするバッチを構築（第6原則どおり削除ではなく`rescheduled`）。

`useDayOrchestrator.ts`の`applyFullReplanPreview`で、`applyDayPlan`成功後に最新セッションを再取得し、この解放バッチを`sessionRepository.saveMany()`で保存するよう変更。UIへの新規通知は追加していない（既存の`ApplyDayPlanResult`が単純な文字列型のため、通知を追加するには型変更が必要でスコープが広がるため見送り。必要であれば別途対応）。

テストは`placementRollover.test.ts`に6件追加（今日配置分の集計／未来セッションを丸ごと解放／一部だけ解放し残りは非接触で確認／未配置なら何も解放しない／対象外タスク・過去日は無視／`buildFutureSessionFreeBatch`が`rescheduled`バッチを正しく組み、収まらなかったセッションがバッチに含まれないことを確認）。

検証: tsc 0エラー・テスト31スイート183件全成功（+6）・lint 0エラー26警告（不変）。ブラウザでの実地確認は、複数日にまたがるタスク完了状態を人工的に再現する必要があり実務上困難なため、単体テストでロジックの正しさを担保した（データロジックのみで、UI表示コードは変更していない）。

### 決定事項
- 「今日の予定をAIで作り直す」実行時、未来日にある同タスクの既存セッションは「今日に実際に配置された分だけ、丸ごと単位で解放（rescheduled）」する。分単位でセッションを分割する機能は実装しない（スコープ超過と判断）。
- この修正は`applyFullReplanPreview`（全AI再計画ボタン）にのみ適用。朝の自動プラン生成（`generateDayPlanAndApply`）や「今から順に並べる」（shift）は今回のバグの再現経路ではないため変更していない。もし同様の複製が朝の自動生成経路でも観測されたら、同じ`buildFutureSessionFreeBatch`を再利用して同様の対応を追加できる。

### 続報（ユーザー承認を得てpush・APK再ビルド・配布資料更新を実施）

ユーザーが承認したため、push（Web版自動デプロイ）とAndroid APK再ビルドを実行した。Web版は https://orbit-looper-red.vercel.app が最新デプロイ（`r80pymclr`）を指していることを確認済み。Android APK新ビルド: `https://expo.dev/accounts/asuforge/projects/orbit-looper/builds/f082f12a-7f51-4c62-a785-decbbde449fa`。`docs/lt-assets/`のQR・`LT_HANDOUT.md`のリンク・当日チェックリスト（複製バグの確認項目を追加）を新ビルドに合わせて更新した。

### 次回への申し送り
- **実機での最終確認が必要（私には実機が無く検証不可）:** 新APK（`f082f12a…`）で、今日のタスクを全部完了→「今日の予定をAIで作り直す」を実行し、明日のタスクが複製されず（今日に入る分だけ移動し、収まらない残りは明日に残る形で）動くか確認。
- 朝の自動プラン生成（`generateDayPlanAndApply`）経路でも同様の複製が起きうるか、実機での様子見が必要（起きた場合は同じ関数を再利用して対応）。

### 続報（①の強化: 過去日にタスクを残さない繰り越しに修正）

前段で「①繰り越しは実装済み」と報告したが、ユーザーから「AIで自動予定を組み替える際、前日以前の未完了タスクも優先度に応じて今日以降へ設定し、過去日にタスクが残りっぱなしにならないようにしてほしい」という強化依頼を受けた。コードを精査した結果、実際に**過去日にセッションが残り続けるバグ**があることが判明した。

原因: `useDayOrchestrator.ts`の`finalizeCarryOverFromPast()`は、繰り越し対象タスクのうち**「今日に配置されたもの」だけ**（`session.date === dateKey`）の過去セッションを`rescheduled`にしていた。しかし`runPlacementWithRollover()`は、今日に収まらない繰り越しタスクを**明日にロールオーバー**する。この「明日に移された繰り越しタスク」は今日に配置されないため、その**過去日の古いセッションが`active`のまま残置**され、翌日以降も`getIncompleteTaskIdsBeforeDate()`が延々と拾い続ける——ユーザー報告の「残りっぱなし」と一致。

修正: 純粋関数`selectRehomedCarryOverTaskIds(sessions, dateKey, carryOverTaskIds)`を`taskCarryOver.ts`に新設。「今日**または未来日**にアクティブ（mutable）なセッションを得た繰り越しタスク」を返す（＝配置先が前に進んだもの）。`finalizeCarryOverFromPast()`はこれを使い、今日配置分だけでなく**明日にロールオーバーされた分も含めて過去セッションを`rescheduled`にする**。どこにも配置できなかったタスクは`rehomed`に含まれないため、過去セッションを消してタスクを失う事故は防ぐ（保守的ガード）。優先度に応じた今日/明日の振り分け自体は既存の`runPlacementWithRollover`（高優先を今日、低優先を明日へbump／収まらない分を明日へroll）で担保済み。テスト2件を`taskCarryOver.test.ts`に追加（明日ロールオーバー分もrehomed扱い／非繰り越し・非mutableは除外）。

検証: tsc 0エラー・テスト31スイート177件全成功（+2）・lint 0エラー26警告（不変）。

### 続報（実機テスト起因の3件: カレンダー繰り越し確認・フォーカスタイマー修正・再インストール時のデータ残存修正）

ユーザーから実機テストで気づいた3点の依頼: (1) 前日の未完了タスクが翌日に再配置される設計になっているか確認、(2) フォーカスモードでタスクの予定時刻にならないとタイマーが始まらない問題の解決策、(3) アプリ再インストール時に前の予定が残っていた件の是正。すべてコードを読んで事実確認してから対応した。

**(1) 繰り越しは設計済み・実装済みと確認（コード変更なし）。** `intelligence/planner/morningTaskSelector.ts`の`resolveMorningReplanTaskIds()`が、その日の配置対象タスクに`getIncompleteTaskIdsBeforeDate()`（過去日の未完了セッションを持つタスクID）を明示的に含めている。`App.tsx`の自動プラン生成useEffectが、Todayタブを開いた時に「今日のセッションが無く、繰り越し含む配置対象がある」場合に`plannerGateway.generateDayPlan()`を自動実行→繰り越しタスクが翌日に配置され、旧セッションは`finalizeCarryOverFromPast()`で`rescheduled`にマークされる。**注意点として、今日すでにセッションがある場合は既存プランを尊重して再配置しない**（`needsGenerate = !hasTodaySessions && ...`）ので、繰り越しの自動発生は「今日まだ何も配置されていない」時に限られる。

**(2) フォーカスタイマーの根本原因を特定し修正した。** 旧`FocusMode.tsx`の`resolveRemainingSeconds()`は残り時間を**実時刻（wall clock）とセッションの予定枠**から算出していた: `now < 予定開始` の間は`totalSeconds`を返すだけ（＝フル表示で止まって見える）、予定開始後は`予定終了 - now`を返す。つまりタイマーは「今から作業時間ぶんカウントダウン」ではなく「予定時刻に紐づく置き時計」で、予定時刻前にフォーカスに入ると動き出さない——ユーザー報告と完全一致。`beginFocusSession()`（`App.tsx`）はフォーカス開始時に`actualStart`を記録しているので、これを唯一のアンカーに変更した。純粋関数`resolveRemainingFocusSeconds(actualStart, totalSeconds, now)`を`src/focus/focusCountdown.ts`に新設し（actualStart無→フル表示、有→フル−開始からの経過、[0,total]でクランプ）、`FocusMode.tsx`はこれを使うだけにした（旧`resolveRemainingSeconds`/`nowSeconds`は削除）。これで**フォーカスに入った瞬間から実カウントダウンが始まり、予定時刻とは無関係**になる。テスト5件を`focusCountdown.test.ts`に追加。

**(3) 再インストール時のデータ残存の原因＝Androidの自動バックアップ。** `createEmptyLooperData()`が空データで初期化しており、**APKに予定が同梱されている事実は無い**（seed/demoデータもコード上に存在しない）。原因は`app.json`のandroidに`allowBackup`指定が無く、Androidの既定`android:allowBackup=true`のままだったこと。これによりGoogleの自動バックアップがAsyncStorageをクラウド退避し、**再インストール時に旧データを復元**していた。`app.json`のandroidに`"allowBackup": false`を追加して是正（今後の再インストールはクリーン起動になる）。※ネイティブのManifest変更なので**新しいAPKビルドが必要**。またユーザー端末に既に残っている旧データは、この変更では自動消去されない（設定→データ→リセット、またはアプリのストレージ消去で一度クリアすれば以降はクリーン）。なお「アンインストールせず新APKを上書きインストール」した場合は仕様上データが残る（それは通常のアップデート挙動）。

**検証:** tsc 0エラー・テスト31スイート175件全成功（+5、フォーカスタイマー純粋関数）・lint 0エラー26警告（不変）。(2)はブラウザ実地確認より純粋関数の単体テストで担保（timerロジックは決定的）。(3)はAndroidネイティブ設定のためブラウザでは観測不可。

### 決定事項（3件分）
- 繰り越しは現行実装のままでよい（翌日の自動生成時に過去未完了タスクを含める）。「今日すでにセッションがある場合は再配置しない」という既存の慎重な挙動も維持。
- フォーカスタイマーは予定時刻ではなく`actualStart`（フォーカス開始時刻）を基準に実カウントダウンする方式に変更。
- Androidの`allowBackup`を`false`にして、再インストール＝クリーン起動を保証する（要新ビルド）。

### 保留・次アクション（要ユーザー承認）
- (2)(3)ともユーザー端末に届けるには**APK再ビルドが必要**（(3)はネイティブManifest変更）。Web版にも(2)のJS修正を反映するにはpush（＝Vercel自動デプロイ）が必要。コードはコミット済みだが、**APK再ビルドとpush/デプロイはユーザー承認後に実施**する。
- 再ビルド後は`docs/lt-assets/`のAndroid QR/リンクを新ビルドに差し替えること。

### 続報（②③反映のAPK再ビルド完了・配布資料を最新化）

①（繰り越し強化）②（フォーカスタイマー）③（allowBackup=false）をすべて含めてpush（Web版は自動デプロイ済み）とAndroid APK再ビルドを実施。新ビルドURL: `https://expo.dev/accounts/asuforge/projects/orbit-looper/builds/13d16f12-6d66-4c35-b2ed-9c88f41fb53c`。`docs/lt-assets/`のAndroid QR・`LT_HANDOUT.md`のリンク・当日チェックリスト（繰り越し確認・フォーカスタイマー確認の項目を追加）を新ビルドに合わせて更新した。それより前のビルド（`a5866f87…`／`e4b08ae5…`）は配布しないよう明記済み。



別デバイス（D:\ayosh機）でセッション開始。「現在の進捗状況を教えて」という依頼を受け、pull・ベースライン確認（変化なし、31スイート167件）の上で07-02付けの一連のSESSION_LOGエントリ（続報1〜12、LT配布に向けたバグ修正・Vercelデプロイ・Android APKビルドまで）を要約して報告した。

続けてユーザーから「順番にすべて実行してください」と、残タスク（Web版・APKの実地確認、QR・フィードバックフォームの準備）を進めるよう依頼された。

**Web版の実地確認:** Chrome拡張が接続できなかったため、代替手段としてローカルでExpo Web開発サーバーを起動し（`.claude/launch.json`を新規作成、Preview系ツールで検証）、同一コードベースでの動作確認とした。オンボーディングは既に完了済み状態（ブラウザのlocalStorageに前回セッションの検証データが残っていたため）で、Todayホーム→カレンダータブ→「今日をふりかえる」からReflectionModalを開く→気分/エネルギー選択→キャンセルで閉じる、という一連を実施。**モーダルが正常に開閉し、コンソールエラーも無し**（`props.pointerEvents is deprecated`等の非致命的な警告のみ）。前セッションで修正された「モーダル凍結バグ」がこのビルドでも再発していないことを確認できた。ただし本番URL（Vercel）そのものではなくローカル開発サーバーでの代替確認である点、Chrome拡張越しの確認ではない点は申し送りとして残す。

**Android APKの実地確認:** 物理/エミュレータ端末が無いため**実施できていない**。正直に申告し、次回以降の確認事項として残した。

**QR・フィードバックフォームの準備:** `src/config/betaConfig.ts`の`BETA_FEEDBACK_URL`に、既に`mailto:nextdayforge@gmail.com`宛のフィードバック機能が実装済みであることを確認した（外部フォームの新規作成は不要と判断）。`npx qrcode`（一時的にnpxで実行、package.jsonへの依存追加なし）でWeb版URL・Android APKリンクの2つのQRコードを生成し、`docs/lt-assets/`に保存。あわせて`docs/lt-assets/LT_HANDOUT.md`を新規作成し、配布リンク・QR・口頭案内文・フィードバック導線・当日チェックリストを1枚にまとめた。

### 現状のベースライン
- 型チェック: 0 エラー
- テスト: 31 スイート / 167 件 全て成功
- Lint: 0 エラー / 26 警告（既存の軽微な `no-unused-vars` 等、未対応のまま）
- git: `main` ブランチ（本エントリのコミット後に `origin/main` と同期予定）

### 決定事項
- Web版の動作確認は、Chrome拡張が使えない場合の代替手段として、ローカルExpo Web開発サーバー＋Preview系ツールで行ってよいこととした（本番URLでの確認ではない点は明示して報告する）。
- LT配布のフィードバック収集は、既存の`mailto`ベースのアプリ内フィードバック機能をそのまま使う。新規に外部フォーム（Googleフォーム等）は作らない。

### 続報（同日・AIキー戦略の分離＝Web各自キー / APK開発者キー）

ユーザーから「AIがちゃんと働いていない気がする。APKでは自分のAPIキーで動かし、Web版では各自でAPIキーを設定してもらうようにできるか」という依頼を受けた。

**まず原因を実コードとネットワークで診断した。**
- キー解決は`resolveGeminiConfig.ts`にあり、当初は「entitled かつ プロキシ設定あり → プロキシ、そうでなければ dev の env キー」というロジックで、web/native の区別が無かった。
- Cloudflare Workerのプロキシ自体は生きている（認証なしで`GET /`→405、`POST /v1/generate`→401、正しい挙動）。デプロイ済みWebバンドルにもプロキシURLは焼き込まれていた。
- しかし`eas env:pull`で取得した`EXPO_PUBLIC_LOOPER_AI_BETA_TOKEN`でプロキシに認証リクエストを投げると**401 Unauthorized**が返った（トークン長も想定と違い34文字）。つまり**アプリが持つBETA_TOKENとWorker側の`BETA_TOKEN`シークレットが不一致**で、全プロキシ呼び出しが弾かれ、AIが黙ってローカルにフォールバックしていた可能性が高い。これが「AIが働いていない」体感の有力な原因。（Worker側シークレットは書き込み専用で照合できないため、値の再同期はユーザー側作業として残す。バンドルからトークンを機械的に抜き出す検証はエージェントのcredential-scan制限で拒否されたため未実施。）

**次に、依頼どおりキー戦略を配布チャネルで分ける実装を行った（TDD的にテストも追加）。**
- `resolveGeminiConfig.ts`に`isWebRuntime()`（`typeof document !== 'undefined'`でweb判定。react-nativeをimportせず、jest(node)環境では常にfalse＝既存テストの挙動を保つ）を追加。
  - **Web**: `settings.geminiApiKey`（ユーザー自身のキー）を使う。プロキシは一切使わない。dev clientかつ未入力時のみ`.env`のキーにフォールバック。
  - **Native（APK）**: 従来どおり entitled+プロキシ設定あり→プロキシ（開発者キー、Worker内秘匿）。
- `AppSettings`に`geminiApiKey?: string`を追加（端末内保存、`SettingsRepository.update`が任意フィールドをそのままマージ）。
- `SettingsView.tsx`に**Web版のみ表示**（`Platform.OS === 'web'`）のAPIキー入力カードを追加（`secureTextEntry`入力・保存/削除・現在キーのマスク表示`maskGeminiApiKey`・Google AI Studioへのリンク・端末内保存の明記）。
- `aiCapabilities.ts`の`getCloudAiUnavailableMessage()`にweb分岐を追加（「Web版ではご自身のGeminiキーが必要」と案内）。
- テストは`resolveGeminiConfig.test.ts`に3件追加（web+ユーザーキーで有効／web+プロキシ設定ありでもプロキシは無視され未入力なら無効／webのプレースホルダキー無効）。既存テストは`isWebRuntime()`がnodeでfalseのため無改変で通過。

**セキュリティ対応:** Web版がプロキシを使わなくなったので、公開Webバンドルに共有トークンを焼き込まないよう、**Vercelのプロキシ環境変数2つ（Production/Preview）を削除**した。プロキシ変数はEAS（APK）側にのみ残す。

**検証:** tsc 0エラー・テスト31スイート170件全成功（+3）・lint 0エラー26警告（不変）。さらにローカルExpo Web開発サーバー＋Preview系ツールで実地確認: 設定画面にAPIキーカードがWeb版のみ表示され、ダミーキー保存→「有効」表示・接続状態が「利用可」に変化→削除で「未設定」に戻る、という一連が正しく動作することを確認済み。

**未完了（デプロイ保留）:** コード変更・コミット準備はできているが、**本番Webへの反映（Vercel再デプロイ）は保留**。理由: (1) この変更を本番URLに反映するには再デプロイが必要だが、`vercel --prod`はエージェントのProduction Deploy制限で拒否された（今回の会話が設計質問から始まったため）。(2) さらに`vercel link`でGitHub連携済みのため、**mainへのpush自体がVercelの自動本番デプロイを誘発する**。この2点をユーザーに説明し、push/デプロイの明示承認を待つ状態。

### 決定事項（AIキー戦略分離分）
- AIキーの出どころを配布チャネルで分離: **APK=開発者キー（プロキシ経由）/ Web=各ユーザー自身のキー（設定画面で入力・端末内保存）**。判定は`Platform`（web判定）で自動。
- 公開Webバンドルには共有プロキシトークンを載せない（Vercelのプロキシ環境変数は削除済み）。プロキシ変数はEAS/APK専用。

### 続報（同日・①Web本番反映 と ②APKトークン修正 をユーザー承認のもと実施）

ユーザーが「①して大丈夫。②もお願い」と両方を承認したため実施した。

**① Web版の本番反映（完了）:** `git push`でmainを更新（`05d0281`）。`vercel link`のGitHub連携により**Vercelが自動で本番デプロイ**を実行（Ready、約42秒）。ライブURL（https://orbit-looper-red.vercel.app）がHTTP 200で、**新バンドルにはプロキシURLがもう含まれない**ことを確認（`grep`で不在確認。共有トークンが公開バンドルから抜かれる懸念を解消）。なお直接の`vercel --prod`はエージェントのProduction Deploy制限で拒否されたが、push経由の自動デプロイで目的は達成。

**② APKのプロキシ401修正（完了）:** 当初「ユーザー作業」として残す予定だったが、値をチャットに一切出さない方法で実施できるためエージェントが実行した。`openssl rand -hex 32`で新トークンを生成し（値は非表示、生成は単一Bash呼び出し内に閉じる）、(a) `printf '%s'`でstdin経由（**末尾改行を付けずに**）`wrangler secret put BETA_TOKEN`でWorker側に設定、(b) `eas env:update preview`で`EXPO_PUBLIC_LOOPER_AI_BETA_TOKEN`を同じ値に更新。`printf '%s'`を使ったのは、旧トークンが`echo`由来の末尾`\n`混入で不一致だった可能性を排除するため（Worker側`BETA_TOKEN`＋`\n` ≠ アプリのtrim済みトークン → 401、という仮説）。

**検証:** 設定直後は伝播遅延で401だったが、約15秒後にEAS保存値でプロキシへ認証リクエストを投げると**HTTP 200**（Worker認証通過＋upstream Geminiも正常応答）。旧EASトークンが34文字の誤った値だったのに対し、新トークンは64文字で正しく保存されていることも確認。これで**APKのAIがプロキシ経由で動く前提が整った**。ただし**APKは新トークンをビルド時に焼き込むため再ビルドが必須**で、EASのAndroid preview再ビルドをバックグラウンドで実行中（完了後にインストールリンクを更新）。

### 決定事項（①②実施分）
- Web本番反映はpush経由の自動デプロイで行う（GitHub連携済み。`vercel --prod`直叩きはエージェント制限で不可だが結果は同じ）。
- 秘密トークンの設定は「エージェントが生成・設定するが値は一切表示しない（単一Bash呼び出し内で完結、`printf '%s'`で改行混入も防ぐ）」方式で実施可能と確認。今後の同種作業もこの方式を許容する。
- APK配布時は**トークン変更のたびに再ビルドが必要**（env varはビルド時に焼き込まれるため）。

### 次回への申し送り（最重要・順序つき）
- **APK再ビルドの完了確認とインストールリンク更新。** 実行中のEAS Android previewビルドが完了したら、新しいインストールURL（QR）で`docs/lt-assets/`を更新すること。旧APK（e4b08ae5…）は誤トークンが焼き込まれているためAIが動かない。配布は必ず新ビルドを使う。
- **Android APKの実機動作確認**（新ビルドで、インストール〜起動〜AIコーチ/ふりかえりがGemini応答するかまで）。
- **Web版の実地確認（本番URL）**: 設定→AIで各自のGeminiキーを入れるとAIが有効化される導線を、可能ならChrome拡張が使える環境で本番URLでも確認（今回はローカル開発サーバーで確認済み）。
- LT配布資料一式（QR2種＋案内文）は`docs/lt-assets/`。**Android QRは新ビルドのURLに差し替えが必要。**
- その他の残件（実行フィデリティ動線の強化、学習の可視化、Task Proposal Engine仕上げ等）は変更なし。詳細は`docs/PRODUCT_VISION.md`の「§8 近期の重点」を参照。

---

## 2026-07-02

### 経緯・何が起きたか

前日に続き別デバイス（D:\ayosh、Cドライブではなくこのマシン固有のドライブ構成）でセッション開始。初回セットアップの手順（クローン・`npm install`・ベースライン確認）を実行したところ、型チェック・テスト・lintともCLAUDE.md記載のベースラインと完全一致した。ただし今回はユーザーの明示指示で、クローン先をホームディレクトリ（C:\Users\ayosh）ではなく `D:\ayosh\Project-Orbit-Looper-beta-1.1` に変更した。これは**このデバイス限定の例外**であり、他デバイスでの標準（ホームディレクトリ直下）は変更していない旨をユーザーが明言・承認した。

`git push` の動作確認のためテスト用の一行を追加したところ、別デバイスで同時進行していたセッションが先に `docs/SESSION_LOG.md` と `CLAUDE.md` を大きく更新して push しており、マージコンフリクトが発生した。ユーザーに確認したところ、「他のデバイスでも会話していた」と判明。複数デバイスを同時並行で使う運用実態が確定した。コンフリクトはリモート側の内容（より詳細な申し送り）を軸にテスト行も残す形で解消・push。この経験から、複数デバイス同時作業時のコンフリクトへの心構えをメモリに記録した。

続けてユーザーから「今後のアプリ開発の方針」を、最終目標を踏まえて説明するよう依頼された。CLAUDE.mdと`.cursorrules`を確認したところ、設計原則・最終目標（Ultimate Goal）・Sprint Roadmapなどの詳細が`.cursorrules`にしか無く、CLAUDE.mdには要約のみで、事実上2ファイルに設計情報が分散していることが判明。ユーザーもこの状態を「CLAUDE.mdに移行したと思っていた」と認識しておらず、指摘して確認を取った。

そこにユーザーがDesktop上のファイル（`Project-Orbitについてのchtagptとの対話履歴.txt`）を提示し、ChatGPTとの過去の設計対話（Priority 0〜6・Phase 1〜8・Version MVP〜3.0という複数の枠組みで語られた壮大な機能ロードマップ）を`.cursorrules`と統合し、ミスマッチが起きないよう慎重に方針・最終目標を設定するよう依頼された。

**実装はせず、まず実コードと2つのドキュメントを慎重に突き合わせた。** その結果、`.cursorrules`にはコードとの乖離が複数見つかった: Energy Curveは「24時間配列」ではなく実際は6スロット配列、Buffer Needは「5〜15分」ではなく比率0.05〜0.5、SessionOutcomeは分類enumではなくstatus(状態)+outcome(実測メトリクス)に分離、という3点。またChatGPT対話履歴で提案されていた「Sessionは削除せずrescheduledとして履歴保持する」という設計は、`session.ts`の`isActivePlacementSession()`で既に実装済みと確認できたため、これを第6の設計原則としてCLAUDE.mdに正式に追加した。

統合の結果として `docs/PRODUCT_VISION.md` を新設: 最終目標・中核ループ・ドメインモデル（実コード準拠に訂正）・Now/Next/Later/Somedayの一本化ロードマップ・MVP規律（今は作らないものリスト）をまとめた。CLAUDE.mdは運用サマリとして維持しつつ新ドキュメントを参照するよう更新。`.cursorrules`は内容の二重管理を避けるためリダイレクト用スタブに置き換えた（削除はせず、Cursor利用時に迷わないように）。README.mdとPlacementEngine.tsのコメントも参照先を更新。tscで型チェックし、cursorrules参照が意図した箇所以外に残っていないことも確認済み。

その後ユーザーから「実装はせず、今後の方針を詳しく」という依頼があり、既存の実装（`useDayOrchestrator.ts`など）を実際に読み込んで現状を再評価した。ChatGPT対話履歴の「Today画面・タイマー未実装、80%完成」という前提は既に古く、実際は`FocusMode`・`ReflectionModal`・`InsightsView`・通知・オンボーディング・再計画モーダルまで揃っており、中核ループ（朝プラン生成→タイマー実行→完了→Outcome→学習発火／夜の振り返り→学習発火／昼の再計画プレビュー→適用）が実際に閉じていることを確認した。オンボーディングがUserModelを一切seedしていない（全ユーザーが汎用デフォルトから開始）ことも確認した。これを踏まえ、「学習型アプリのコールドスタート問題」を最終目標への但し書きとして提案し、Tier0(90分バグ)→Tier1(オンボーディングseed・Task Proposal仕上げ)→Tier2(学習の可視化)→Tier3(計測)という優先順位を提示した。

**ここでユーザーが、claude.ai（別のClaude）に同じプロジェクトのコードを見せて相談していた内容を貼り付けた。** その内容は、実コードを精査した上での戦略分析で、Claude Codeが出した見立て（ループは閉じている・コールドスタートが核心・学習の可視化が必要）と大筋で一致しつつ、さらに踏み込んで「価値が漏れる2つの具体的な穴」をコードの関数名まで挙げて指摘していた。鵜呑みにせず実コードで裏を取ったところ、両方とも正確だった:
1. `OutcomeDeriver.ts`の`resolveActualMinutes()`は`actualStart`/`actualEnd`が無いと見積時間へフォールバックする。タイマーを使わず完了操作だけした場合、`estimationRatio≈1.0`・`focusScore=1.0`となり「完璧な一日」として無信号のまま学習されてしまう（＝ユーザーがアプリ内でタイマーを回さない限りUserModelは動かない）。
2. `DailyFeatureExtractor.ts`の`procrastinationScore`はアウトカムが無い日は`0`（先延ばしゼロ）になり、`UserModelUpdater.ts`のEMAでそのまま`procrastinationIndex`に反映される。何もしなかった日が「良い日」として誤学習される。

claude.aiの分析はさらに、検証可能な3ヶ月の北極星（「2週間使った10人のベータユーザーが、学んだ具体的事実を指させて、再計画に助かったと言えるか」）や、課金設計の問題（差別化が薄いGeminiラッパーに課金が寄っており、差別化コア＝学習・同期にこそ課金すべき）にも踏み込んでいた。ChatGPT（楽観的・古い）→ Claude Code（実コード確認）→ claude.ai（さらにコードで穴を特定）という3段階の分析を統合し、方針を収束させた。ユーザーの承認を得て、この収束した方針を`docs/PRODUCT_VISION.md`に「§8 近期の重点（検証フェーズ）」として追記した。

### 現状のベースライン
- 型チェック: 0 エラー
- テスト: 27 スイート / 132 件 全て成功
- Lint: 0 エラー / 26 警告（既存の軽微な `no-unused-vars` 等、未対応のまま）
- git: `main` ブランチ、`origin/main` と同期済み（このエントリのコミット後）

### 決定事項
- `.cursorrules`は削除せずリダイレクト用スタブとして残す（Cursor利用時の迷いを防ぐため）。設計内容の実体はCLAUDE.mdとdocs/PRODUCT_VISION.mdに一本化。
- このデバイス（D:\ayosh）のみプロジェクト配置場所をホームディレクトリ以外（D:\ayosh直下）にする例外を認める。他デバイスの標準（ホームディレクトリ直下）は変更しない。
- 現フェーズは「作る」ではなく「検証して尖らせる」フェーズと位置づけ、新機能追加より実行フィデリティの穴を塞ぐことを優先する方針。

### 検証済み事項（コードで裏取り）
- `.cursorrules`のUserModel仕様（Energy Curve・Buffer Need・SessionOutcome）は実装とズレていた。実コードを正として`docs/PRODUCT_VISION.md`に記録済み。
- 「Sessionは削除せずrescheduledで履歴保持する」設計は実装済み（`session.ts`の`isActivePlacementSession()`）。第6の設計原則としてCLAUDE.mdに明文化。
- 中核ループ（朝プラン→実行→Outcome→学習、夜の振り返り→学習、昼の再計画プレビュー→適用）は`useDayOrchestrator.ts`で実際に閉じている。ChatGPT対話履歴（Sprint 7時点）の「Today画面・タイマー未実装」という前提は古く、現状は該当UIが全て存在する。
- オンボーディングはUserModelを一切seedしていない（`createDefaultUserModel()`の汎用デフォルトから全ユーザーが開始）。
- 学習ループの実行フィデリティに構造的な穴が2つある: (1) `OutcomeDeriver.ts`がタイマー未使用の完了を「完璧な実行」として無信号で学習してしまう、(2) `DailyFeatureExtractor.ts`が欠測日を先延ばしゼロの「良い日」として誤学習してしまう。

### 続報（同日中の作業）

前回の申し送り「実行フィデリティの穴を塞ぐ」に着手する前に、別デバイス（このマシン）で新規クローンしたところ11コミット遅れており、`git pull`で本エントリを含む最新化を実施（詳細は本エントリ後半の「別デバイスでの初回セットアップ」節を参照）。ベースライン（型チェック・テスト・lint）を再確認したところ完全一致を確認した上で、申し送りの最優先事項に着手した。

まず「90分に固定され2つに分割される」バグの再現経路を、コードを変更せず調査した。原因は単一のバグではなく、4点の仕様が連鎖した結果だと判明した: (1) `AiScheduleModal.tsx`のタスク一括入力（`AiTaskInput`型）にはタイトルと優先度しかなく、所要時間を入力する手段がそもそも存在しない。(2) `resolveAiTasks.ts`がGemini未設定時に`localTaskDurationEstimate.ts`にフォールバックし、そこの`DURATION_RULES`が「勉強|学習|復習|予習|宿題|レポート|論文|課題|試験」「プログラ|コーディング|実装|開発|デバッグ」という非常に広いキーワード群に対し無条件で`minutes: 90`を返す。日常的なタスク名の多くがこれにヒットする。(3) `resolveAiTasks.ts`の`splittable: scaledMinutes > userModel.focusLength`により、既定`focusLength`(45分)に対し90分の見積りは常に`splittable: true`になる。(4) `LocalPlacementStrategy.ts`が`splittable`なタスクを`focusLength`単位で刻むため、90分のタスクは機械的に45分×2セッションに分割される。GeminiPlacementStrategy側はfocusLength/splittable/90を一切参照しておらず無関係（Placementは既定でLocalPlacementStrategyのみ、ローカルファースト原則通り）。ユーザーと相談の上、**これは複数の設計判断が連動した結果であり、今回は仕様変更をせず原因調査の記録のみ**とすることで合意した。次フェーズの検討課題として、(a) AiScheduleModalにduration入力を追加する、(b) `localTaskDurationEstimate.ts`の90分固定ルールをより細かい粒度にする、のいずれかを検討する（詳細は下記「次回への申し送り」参照）。

続いて、実行フィデリティの穴2点に対応した。`OutcomeDeriver.ts`の`resolveActualMinutes()`はタイマー未使用（`actualStart`/`actualEnd`が無い）だと予定時間にフォールバックし、`estimationRatio≈1.0`・`focusScore=1.0`という「完璧な実行」として無信号のまま学習されてしまう問題に対し、`SessionOutcome`に`timerUsed: boolean`を追加し、`actualStart`かつ(`actualEnd`または`completedAt`)がある場合のみ`true`とするようにした。既存の保存データには`timerUsed`が存在しない（`undefined`）可能性があるため、学習側は`=== true`の厳密比較のみで判定し、`undefined`は自動的に「タイマーなし」として扱われるようにした（型はオプショナルにせず`boolean`必須のまま。新規導出は必ず`deriveOutcome()`経由のため）。

`DailyFeatureExtractor.ts`は、outcomeを一括で除外せず`allOutcomes`（完了率などマニュアル完了でも意味がある指標用）と`timedOutcomes`（`timerUsed === true`のみ、時間・遅刻・集中スコア・推定誤差・エネルギースロット学習用）に分離した。`completionRate`は引き続き`allOutcomes`ベースのまま維持し、マニュアル完了も「完了した」という意味では有効なシグナルとして扱う既存挙動を壊さないようにした。`DailyFeatures`型には`timedOutcomeCount`（タイマー実績のあるoutcome件数）を追加し、`UserModelUpdater.ts`の`procrastinationIndex`更新を`bufferNeed`/`estimationFactor`と同じ流儀で`features.timedOutcomeCount > 0`によりガードした。ガードが成立しない日（セッションを何も実行しなかった日）は`userModel.procrastinationIndex`を変更せず現状維持する。

テストは`src/__tests__/learning.test.ts`に「マニュアル完了はcompletionRateにはカウントされるがタイマー系シグナルからは除外される」「`timerUsed`が無い旧データはタイマーなし扱いになる」「`timedOutcomeCount: 0`の日は`procrastinationIndex`が変化しない」の3件を追加し、既存のoutcomeリテラルには`timerUsed: true`を明記した。新規に`src/__tests__/outcomeDeriver.test.ts`を作成し、`deriveOutcome()`の`timerUsed`判定（actualStart+actualEnd、actualStart+completedAt、どちらも無い場合、actualStartのみ無い場合）を検証した。

修正後、`npx tsc --noEmit`（0エラー）・`npm test`（28スイート・139件全成功）・`npm run lint`（0エラー・26警告、件数は修正前と同一）を実行し、ベースラインの悪化がないことを確認した。

### 現状のベースライン
- 型チェック: 0 エラー
- テスト: 28 スイート / 139 件 全て成功
- Lint: 0 エラー / 26 警告（既存の軽微な `no-unused-vars` 等、未対応のまま）
- git: `main` ブランチ（本エントリのコミット後に `origin/main` と同期予定）

### 決定事項（続報分）
- 「90分固定・2分割」は今回コード変更しない。原因調査のみ記録し、次フェーズの課題として持ち越す。
- 実行フィデリティの穴のうち、`OutcomeDeriver.ts`のタイマー未使用フォールバックと`DailyFeatureExtractor.ts`/`UserModelUpdater.ts`の欠測日誤学習（procrastinationIndex）の2点を修正。「開始→集中→完了をアプリ内で必ず通す動線の強化」（UI側の対応）は今回のスコープ外のまま持ち越し。
- `completionRate`はマニュアル完了も含めて計算する既存挙動を維持する（今回の目的は「マニュアル完了を完璧な時間実績として学習しないこと」であり、完了自体をカウントしないことではない）。

### 続報2（同日中の作業・UI影響調査）

前段の`timerUsed`/`timedOutcomes`対応により、「タイマー実績がない日やマニュアル完了のみの日に`averageFocusScore`が0点としてUI表示され、ユーザーに誤解を与えるのでは」という懸念をユーザーから指摘され、コード変更前にUI側の実際の表示箇所を調査した。

`averageFocusScore`（`DailyFeatures`由来）と`PlannerEvaluationResult.averageFocusScore`（`PlannerEvaluationService`由来、こちらは別計算で`timerUsed`によるフィルタ対象外）の両方について、`src`配下の`.tsx`ファイルを網羅的に検索した結果、**現在のアプリには`averageFocusScore`（focusScore）を直接ユーザーに表示している画面が一つも存在しない**ことが判明した。具体的には:
- `UserModelUpdater.ts`の`toDailySnapshot()`が生成する`UserModel.lastDailySnapshot`（`DailyFeaturesSnapshot`型）は`completionRate`/`skipRate`/`rescheduleRate`/`overrunRate`/`slotCompletion`/`estimationRatio`/`focusDurationP75`/`mood`/`energy`/`wins`/`blockers`/`aiConfidence`のみを保持しており、**`averageFocusScore`（focusScore）自体がそもそも含まれていない**。
- `InsightsView.tsx`（「学習」画面）は`focusLength`（平均集中"時間"、分）・`procrastinationIndex`・`bufferNeed`・独自再計算の`completionRate`/`avgMood`/`avgEnergy`のみを表示しており、`averageFocusScore`は未参照。
- `TodayView.tsx`の「集中{focusDone}分/目標{focusTarget}分」は`plannedDurationMinutes()`（予定時間）ベースで、`outcome.actualMinutes`/`outcome.focusScore`とは無関係。
- `PlannerEvaluationResult`（`evaluatePlanner()`の戻り値）は`useDayOrchestrator.ts`内部でDecisionLogに保存されるのみで、`.tsx`から参照している箇所はゼロ。

結論として、前回の最終報告に書いた「InsightsView等でaverageFocusScoreが0%に見える可能性」という懸念は、実装を追った結果**再現しない（＝現状のアプリにそのようなUIは存在しない）**ことが分かった。これは実際のバグではなく、筆者が先回りして書いた推測的な注意書きだった。ユーザーに調査結果を報告し、「対応しない（現状維持）」を選択してもらった。将来`docs/PRODUCT_VISION.md`§8の「学習の可視化（毎日『今日の学び』を1行見せる面）」を実装する際は、`timedOutcomeCount`（または`lastDailySnapshot`に将来focusScore系フィールドを追加する場合は同様のカウント）を見て「未計測」表示に倒す配慮が必要、という点だけ申し送りとして残す。

### 続報3（同日中の作業・MVPテスト前の最優先修正）

身近な人3〜5人に3〜7日のMVPテストを依頼する予定であることが判明した。MVPの目的は「今日の予定を作る→実行する→振り返る」の最小ループに価値があるかの検証であり、テスターは詳細入力よりも一括テキスト入力を先に触る可能性が高い。そのため、「90分固定・2分割」問題（続報で原因調査のみ記録していたもの）をMVP前に軽減するため、ユーザーが所要時間を明示指定できる導線を追加する依頼を受けた。

`AiTaskInput`（`types/schedule.ts`）にオプショナルな`estimatedMinutes`と、選択肢の単一ソースとして`TASK_DURATION_OPTIONS = [15,30,45,60,90,120]`を追加。`AiScheduleModal.tsx`の詳細入力カードに「どれくらいかかりそう？」の所要時間選択ボタン（おまかせ＋6択）を追加した。ユーザーは詳細入力より先に一括テキスト入力を使う可能性が高いという指摘を受け、一括入力にも「30分」のような明示的な分数だけを拾う軽量パースを追加することにした（曖昧表現は非対応、615分のような数字埋め込みは前後の数字チェックで誤爆しないようガード）。このパース処理は`AiScheduleModal.tsx`内に置くとRNコンポーネントの一部になりjestの対象外になってしまうため、CLAUDE.mdの「意思決定ロジックはintelligence/かutils/の純粋関数として書く」という既存方針に倣い、`presentation/calendar/bulkTaskInput.ts`という新規の純粋モジュールに切り出し、モーダル側はそれをimportするだけにした。

`resolveAiTasks.ts`の`resolveAiTaskInputs()`は、`estimatedMinutes`が指定された入力を`taskDurationEstimator.estimateBatch()`に一切渡さないよう分離し（未指定分だけバッチ推定に回す）、ユーザー指定値をそのまま`scaleMinutesForEstimation()`に通してタスク作成する形にした。`estimationFactor`によるスケーリングは既存方針通りユーザー指定値にも適用される（デフォルト1.0のため新規ユーザーでは実質そのままの値になる）。

テストは`taskDurationEstimator`/`userModelRepository`をjest.mockで差し替える形で`src/__tests__/resolveAiTasks.test.ts`を新規作成（ユーザー指定優先・未指定時フォールバック・混在ケース・estimationFactorスケーリングの4系統5件）。`src/__tests__/bulkTaskInput.test.ts`も新規作成し、「数学の課題 45分」形式のパース・複数行混在・6種類の分数すべて・数字埋め込み誤爆防止・重複排除を検証した。`AiScheduleModal.tsx`自体はjest.config.jsが`.test.ts`のみを対象とする「pure logic」専用設定のため直接のユニットテストは書けない（既存の他コンポーネントも同様に未テスト）。

修正後、`npx tsc --noEmit`（0エラー）・`npm test`（30スイート・150件全成功）・`npm run lint`（0エラー・26警告、既存ベースラインと同一件数）を確認済み。

### 現状のベースライン
- 型チェック: 0 エラー
- テスト: 30 スイート / 150 件 全て成功
- Lint: 0 エラー / 26 警告（既存の軽微な `no-unused-vars` 等、未対応のまま）
- git: `main` ブランチ（本エントリのコミット後に `origin/main` と同期予定）

### 決定事項（続報3分）
- `localTaskDurationEstimate.ts`の90分固定ルール自体は今回も変更しない。「ユーザー指定を推定より優先する」ことで90分固定・2分割の実害をMVP前に軽減する方針とした（根本的なキーワードルールの粒度改善は次フェーズに残す）。
- 一括入力の所要時間パースは「30分」等の明示的な分数のみに絞り、曖昧な自然言語表現には対応しない。パースできない行は従来通りAI推定にフォールバックする。
- 所要時間選択の純粋ロジック（`extractDurationHint`/`parseBulkLines`）は`presentation/calendar/bulkTaskInput.ts`に切り出し、テスト可能な形にした。

### 続報4（同日中の作業・実機テストで発覚したバグ修正）

ユーザーが実機（Expo Go、iPhone）で動作確認したところ、まず「AIスケジュール作成」モーダル自体がGemini/Cloud AI未設定だと開けない仕様（`App.tsx`の`geminiConfigured`ゲート、今回変更した機能とは無関係の既存仕様）に当たった。`~/my-calendar-app`という、以前Cursorで開発していた頃の別チェックアウト（`package.json`名`my-calendar-app`、GitHub remoteは`project-calendar.git`で別リポジトリ）に有効な`EXPO_PUBLIC_GEMINI_API_KEY`入りの`.env`が残っていたため、新規キー取得はせずそれをコピーして解決した。

実機テストの結果、詳細入力で「開発」に30分を指定したタスクは正しく30分になったが、「勉強」に30分を指定したタスクは**45分が2セッション（合計90分相当）**になるという再現性のある不具合が見つかった。同じ操作で結果が違う点を手がかりに調査したところ、[resolveAiTasks.ts](../src/presentation/calendar/resolveAiTasks.ts)の「既存タスク再利用」ロジック（`findExistingTaskForAiInput`）が、今回実装したユーザー指定duration優先ロジックより**先に**実行され、同名タスクが既に`inbox`/`ready`状態で存在する場合はそのまま再利用し、新しく指定した`estimatedMinutes`を一切見ないことが原因だと判明した。ユーザーに確認したところ、「勉強」というタイトルはCursorでコードをテストしていた際に使った可能性がある、との回答を得て、この端末のAsyncStorageに残っていた古い「勉強」タスク（未指定時代の推定で90分・`splittable:true`になっていたと推測される）が再利用されたという説明で一致した。

この問題は「開発時代のゴミデータだから今回は無視してよい」というものではなく、3〜7日間のMVPテストでも**同じタイトルのタスクを日をまたいで再入力する**という自然な使い方で再現しうると判断し、ユーザーの承認を得て`resolveAiTasks.ts`を修正した。既存タスクを再利用する際、今回の入力に`estimatedMinutes`が明示指定されていれば、`scaleMinutesForEstimation`でスケーリングした値を`gateway.updateTask()`で反映してから再利用するようにした（指定が無い場合や、指定値が現在値と一致する場合は`updateTask`を呼ばず何もしない）。既存の「Reuses existing Tasks without mutating them (Principle 2)」というコメントには触れる変更になるが、これはAIによる推測での書き換えではなく、ユーザー自身が今まさに入力した値を反映するだけなので、設計原則（AIがTaskを勝手に変更しない）とは矛盾しないと整理した。

この変更に伴い、`resolveAiTaskInputs`のgatewayパラメータ型を`Pick<CalendarEditorGateway, 'createTask'>`から`Pick<CalendarEditorGateway, 'createTask' | 'updateTask'>`に拡張し、呼び出し元の型（`coach/types.ts`の`ApplyCoachScheduleDeps`、`coachApply.ts`の`options`型）も合わせて拡張した。実際の呼び出し元（`App.tsx`の`editorGateway`）は元々フル実装のオブジェクトを渡していたため、実行時の挙動には影響なし。テストは`resolveAiTasks.test.ts`に3件追加（未指定時は既存タスクをそのまま再利用／新規指定時は`updateTask`で更新／指定値が現状と一致する場合は`updateTask`を呼ばない）。

修正後、`npx tsc --noEmit`（0エラー）・`npm test`（30スイート・153件全成功）・`npm run lint`（0エラー・26警告）を確認済み。

### 現状のベースライン
- 型チェック: 0 エラー
- テスト: 30 スイート / 153 件 全て成功
- Lint: 0 エラー / 26 警告（既存の軽微な `no-unused-vars` 等、未対応のまま）
- git: `main` ブランチ（本エントリのコミット後に `origin/main` と同期予定）

### 決定事項（続報4分）
- 既存タスク再利用時、ユーザーが今回明示的に指定した`estimatedMinutes`は「AIの推測」ではなく「ユーザー自身の今の入力」として扱い、既存タスクに反映してよいと判断（Principle 2の精神には反しないという整理）。
- `~/my-calendar-app`（Cursor時代の別チェックアウト、別GitHubリポジトリ）が同一マシン上に存在する。今後もこの手の「同じマシン上の別プロジェクトフォルダ」に遭遇する可能性がある前提で、混同しないよう注意する。

### 続報5（同スレッドの続き・実機テストで発覚した2件目のバグ修正）

続報4で残した「買い物が45分+15分という不揃いな分割になった」という未調査の懸念について、ユーザーが日をまたいで追試した結果（木曜に加え土曜にも「買い物」を60分指定→45分+15分に分割）、所要時間を明示指定したタスクでも再現する構造的な問題だと判明した。

原因はコード変更をせず調査してから特定した。[resolveAiTasks.ts](../src/presentation/calendar/resolveAiTasks.ts)は「duration（何分か）」はユーザー指定を最優先にしていたが、「splittable（1コマ扱いにするか、focusLength単位で分割してよいか）」の判定は新規作成・既存タスク更新のどちらも`scaledMinutes > userModel.focusLength`のまま変更していなかった。既定`focusLength`は45分のため、ピッカーで60分以上（60/90/120分）を選ぶと必ず`splittable: true`になり、[LocalPlacementStrategy.ts](../src/intelligence/planner/LocalPlacementStrategy.ts)の配置ロジック（`sessionMinutes = task.splittable ? Math.min(focusLength, remaining) : remaining`）がfocusLength単位で機械的に刻んでしまう。60分なら45分+15分、90分なら45分+45分、120分なら45分+45分+30分になる。15/30/45分を選んだ場合に問題が表面化しなかったのは、たまたまfocusLength(45分)以下だったからに過ぎず、「60分以上を選ぶと必ず起きる」構造的な問題だった。前回の最終報告で「60・90・120分を選んだ場合は仕様通り分割されてよい（意図した挙動）」と書いたのは誤りで、ユーザーが明示的に選んだ時間は「1コマぶんの作業時間」という意図であり、自動分割されるべきではないと判断し訂正した。

ユーザー承認を得て、`resolveAiTasks.ts`の2箇所（新規タスク作成／既存タスク再利用時の更新）を、ユーザー指定durationがある場合は`splittable`を無条件で`false`にするよう修正した。あわせて既存タスク再利用時の「値が変わらなければ`updateTask`を呼ばない」判定に、`estimatedMinutes`が同じでも`existing.splittable`が`true`のままなら更新する条件を追加した（過去にAI推定で`splittable:true`になっていたタスクに、ピッカーで偶然同じ分数を選び直した場合も分割解除を反映するため）。AI推定（所要時間未指定）で長時間になったタスクは、これまで通りfocusLength単位で分割される仕様を維持する（推定は目安であり、隙間時間に収めるための分割は妥当と判断）。

テストは`resolveAiTasks.test.ts`に3件追加: 60分指定の新規タスクが`splittable:false`になること、60分指定で既存タスクを更新する際に`duration`が変わらなくても`splittable:true`だったものが`false`に修正されること、AI推定90分（未指定）のタスクは引き続き`splittable:true`のままであること（回帰防止）。

修正後、`npx tsc --noEmit`（0エラー）・`npm test`（30スイート・156件全成功）・`npm run lint`（0エラー・26警告）を確認済み。

### 現状のベースライン
- 型チェック: 0 エラー
- テスト: 30 スイート / 156 件 全て成功
- Lint: 0 エラー / 26 警告（既存の軽微な `no-unused-vars` 等、未対応のまま）
- git: `main` ブランチ（本エントリのコミット後に `origin/main` と同期予定）

### 決定事項（続報5分）
- ユーザーが所要時間ピッカーで明示的に選んだ時間は、常に「1コマぶんの単一セッション」として扱い、`focusLength`基準の自動分割対象からは除外する。AI推定（未指定時）の分割挙動は変更しない。
- 前回の最終報告に書いた「60・90・120分は分割されてよい」という判断は誤りだったとして訂正済み。

### 続報6（同スレッドの続き・「明日にずらす」ロールオーバーの調査と修正）

ユーザーから「AIで予定生成した際、今日の容量が足りずに一部が明日にずれるとき、今回の生成とは無関係な、まだ終わっていない既存タスクまで明日に移ってしまう」という報告があり、まずコード変更なしで調査した。

原因は[placementRollover.ts](../src/presentation/calendar/placementRollover.ts)の`runPlacementWithRollover()`。今回AIで追加したタスクが今日に収まらない場合、その中で最も優先度が高いものを基準に`findLowerPriorityTaskIdsToBump()`を呼ぶが、この関数は**今日すでに予定されている全セッション**（今回の生成対象外のタスクも含む）を優先度だけで走査し、基準より優先度が低い未完了タスクを無条件に全て明日へ「バンプ」する設計になっていた。ユーザー報告の症状と一致することを確認した。

調査を続けたところ、コード読解だけで**もう一つ独立した副作用**にも気づいた。バンプ処理（`bumpPlan = generateDayPlan(tomorrow, toBump)` → `applyDayPlan(bumpPlan, {mode:'replaceTaskSessions', taskIds: toBump})`）は明日側にセッションを追加するだけで、**今日側に残っている元のセッションを取り消す処理がどこにも無い**ことが分かった。[placementTaskSelector.ts](../src/intelligence/planner/placementTaskSelector.ts)の`getAnchorSessionsForReplan()`は、再生成対象外（＝バンプされたタスクも含む）のセッションを「動かさない既存予定（anchor）」として扱うため、バンプ後に今日のプランを再生成しても、バンプされたタスクの古いセッションはそのまま今日に居座り続ける。ユーザーに確認したところ、**この二重表示にはアプリ使用中から気づいていたが今まで報告していなかった**とのことで、実在するバグと確定した。この二次的な問題は、単なる「表示上の重複」だけでなく、バンプの本来の目的（今日の空き容量を作る）自体を無効化してしまう点でも実害があると判断した。

ユーザー承認を得て修正した。`applyDayPlan`は「配置するセッションが0件かつfixed以外のブロックが0件なら即座に何もせず`skipped_empty`を返す」という早期リターンを持つため、空プランを渡すだけでは今日側の後片付けができないと判明。過去日からの繰り越し処理（`taskCarryOver.ts`の`buildPastIncompleteRescheduleBatch` → `sessionRepository.saveMany()`で直接永続化するパターン）が全く同じ課題を別の場所で既に解決していたため、これに倣った。`placementRollover.ts`に`buildBumpedTodayRescheduleBatch()`（今日・対象taskId・アクティブかつ未完了のセッションを`status:'rescheduled'`にする純粋関数）を追加し、`PlacementRolloverDeps`に`saveSessions`を新規注入。バンプ確定後、明日側への適用に続けて今日側の元セッションを`saveSessions`で`rescheduled`にしてから`reload()`するようにした。これにより後続の今日プラン再生成時に`getAnchorSessionsForReplan()`がその古いセッションを anchor として扱わなくなり、二重表示と「バンプしても空き容量が実際には空かない」問題の両方が同時に解消される。

`useDayOrchestrator.ts`側は既にimport済みの`sessionRepository.saveMany`をそのまま渡すだけで済んだ（新規import不要）。テストは`placementRollover.test.ts`に`runPlacementWithRollover`自体への新規テスト2件を追加（バンプ時に今日の古いセッションが`rescheduled`で保存されること／バンプが発生しない場合は`saveSessions`が呼ばれないこと）。

修正後、`npx tsc --noEmit`（0エラー）・`npm test`（30スイート・158件全成功）・`npm run lint`（0エラー・26警告）を確認済み。

### 現状のベースライン
- 型チェック: 0 エラー
- テスト: 30 スイート / 158 件 全て成功
- Lint: 0 エラー / 26 警告（既存の軽微な `no-unused-vars` 等、未対応のまま）
- git: `main` ブランチ（本エントリのコミット後に `origin/main` と同期予定）

### 決定事項（続報6分）
- バンプ（明日への繰り越し）が発生した際は、今日側の元セッションを`rescheduled`にして必ず後片付けする。Sessionは削除せず`rescheduled`で履歴保持するという設計原則（第6原則）に沿った実装とした。
- `findLowerPriorityTaskIdsToBump()`が「今日の予定表全体」を対象に優先度だけでバンプ範囲を決める広すぎる設計自体は、今回は変更しなかった（次回への申し送りとして残す）。

### 続報7（同スレッドの続き・就寝時刻カットオフの通知追加、および申し送り事項の棚卸し）

続報6までの2件の修正について、ユーザーが実機で再テストし、日中の予定追加と二重表示の解消がどちらも直っていることを確認した。そこで一度立ち止まり、これまでに溜まった申し送り事項を優先度順に棚卸しした（P1: バンプ範囲が広すぎる問題／就寝時刻カットオフの無通知／90分固定・2分割の根本原因、P2: 実行フィデリティ動線・学習の可視化、P3: Task Proposal Engine以降のロードマップ項目）。

このうち「就寝時刻を過ぎるとその日の残り時間が無言でゼロになる」問題（前々回の会話で発見済み、原因は[useDayPlan.ts](../src/hooks/useDayPlan.ts)の`computeRemainingAvailableMinutes()`が`settings.sleepMinutes`を過ぎると`Math.max(0, remaining)`で強制的に0になる仕様）について、まずコード変更せずに最小修正方針を提示し、承認を得てから実装した。

`CalendarView.tsx`は既に`buildRolloverNotice()`由来の通知（「配置できなかった予定を明日に繰り越しました」等）を`scheduleNotice`として表示していたが、**なぜ**入らなかったかの理由（就寝時刻を過ぎているせいなのか、単に予定が埋まっているだけなのか）を伝えていなかった。Planner/Placement本体やDayPlan型には触れず、プレゼンテーション層だけで完結する形で対応した。`presentation/calendar/bedtimeHint.ts`に純粋関数`resolveBedtimeHint(settings, scheduleDate, now)`を新設（対象日が今日かつ現在時刻が就寝時刻以降の場合のみヒット文言を返す）し、`CalendarView.tsx`の`handleAiGenerate()`内で`skipped_empty`／繰り越し発生時どちらの通知文にも、就寝時刻を過ぎている場合はその理由を優先的に差し込むようにした。`CalendarView.tsx`自体はjest構成（`.test.ts`のみ対象、RN変換なし）の都合でユニットテストが書けないため、判定ロジックを純粋関数として切り出すことでテスト可能にした（既存の`bulkTaskInput.ts`と同じパターン）。

テストは`bedtimeHint.test.ts`を新規作成し4件追加（就寝時刻超過でヒントを返す／就寝前は`null`／対象日が今日でない場合は`null`／ちょうど就寝時刻ぴったりも「過ぎている」扱いにする境界値）。

修正後、`npx tsc --noEmit`（0エラー）・`npm test`（31スイート・162件全成功）・`npm run lint`（0エラー・26警告）を確認済み。

### 現状のベースライン
- 型チェック: 0 エラー
- テスト: 31 スイート / 162 件 全て成功
- Lint: 0 エラー / 26 警告（既存の軽微な `no-unused-vars` 等、未対応のまま）
- git: `main` ブランチ（本エントリのコミット後に `origin/main` と同期予定）

### 決定事項（続報7分）
- 就寝時刻カットオフの通知は、Planner/Placement本体を変更せず`CalendarView.tsx`のプレゼンテーション層だけで完結させる方針とした。
- 申し送り事項をP1（MVPテスト中に実際に遭遇しうる）/P2（様子見でよい）/P3（MVP後のロードマップ）に整理し、P1のうち就寝時刻カットオフの通知から着手した。

### 続報8（同スレッドの続き・バンプ範囲を「必要な分だけ」に絞る修正）

続報7で棚卸ししたP1候補のうち、最後に残っていた「バンプ対象の範囲が広すぎる問題」に着手した。まずコード変更なしで最小修正方針を提示し、承認を得てから実装した。

**検討した選択肢は2つ。** (a) 不足時間（`neededMinutes`）の合計だけを見て、優先度が低い順に必要な分だけバンプする「合計時間ベース」の方式。(b) 1件バンプするたびに今日のプランを再生成し、実際に収まったかを確認しながら繰り返す「反復方式」。(b)の方が正確（配置エンジンの実際の空きコマ判定と整合するため、バンプした時間の合計が足りていても実際には連続した1コマとして使えず入らない、というケースを防げる）だが、実装がその分重くなる。**今回は最小の(a)を採用し、(b)への格上げは今後の実際の使用感を見てから判断する、とユーザーと合意した。** この判断の経緯・トレードオフは、今後の振り返りで都度参照できるよう本エントリと`placementRollover.ts`内のコメントの両方に残した。

実装は[placementRollover.ts](../src/presentation/calendar/placementRollover.ts)の`findLowerPriorityTaskIdsToBump()`。従来は「優先度が基準より低いタスクを見つけたら`Set`に無条件で追加する」だけだったが、今回から`neededMinutes`という引数を追加し、(1) 候補タスクごとに今日の合計セッション時間を集計、(2) 優先度が低い（数字が大きい＝重要度が低い）順にソート、(3) 集計した時間が`neededMinutes`に達するまでだけ選び、達したら打ち切る、という greedy な選択に変更した。呼び出し元の`runPlacementWithRollover()`側で、`unplaced`（今回収まらなかった新規タスク）それぞれの「残り必要時間 − 今日すでに配置できた時間」を合計して`neededMinutes`を計算し、渡すようにした。

この方式の限界（今回合意の上で許容した点）: 合計時間だけを見た判断なので、実際に配置エンジンがその空いた時間を連続した1コマとして使えるかまでは保証しない。例えば45分空けたつもりでも15分の隙間が3つに分かれていて60分タスクは結局入らない、というケースは理論上まだ起こりうる。**この限界が実際にMVPテスト中に問題として顕在化した場合は、(b)の反復方式（1件バンプ→再生成→収まったか確認→収まらなければ次を追加、を繰り返す）への格上げを検討すること。** 判断基準としては「合計時間ベースの絞り込みを入れたのに、まだ無関係なタスクが押し出される／必要以上にバンプされる」という報告が実際にあったかどうかを見ればよい。

テストは`placementRollover.test.ts`に`findLowerPriorityTaskIdsToBump()`単体への新規テスト3件を追加（必要な分だけバンプされ残りは今日のまま／複数候補がある場合は最も重要度が低いものから順に追加されていくこと／必要時間0なら何もバンプされないこと）。既存の「finds lower priority tasks to bump」テストは新しい引数（`neededMinutes`）を渡すよう更新した。`runPlacementWithRollover()`の既存の統合テスト2件は動作に影響がないことを確認済み。

修正後、`npx tsc --noEmit`（0エラー）・`npm test`（31スイート・165件全成功）・`npm run lint`（0エラー・26警告）を確認済み。

### 現状のベースライン
- 型チェック: 0 エラー
- テスト: 31 スイート / 165 件 全て成功
- Lint: 0 エラー / 26 警告（既存の軽微な `no-unused-vars` 等、未対応のまま）
- git: `main` ブランチ（本エントリのコミット後に `origin/main` と同期予定）

### 決定事項（続報8分）
- バンプ範囲の絞り込みは、まず「合計時間ベースのgreedy選択」という最小方式を採用する。より正確な「1件ずつ再生成して確認する反復方式」への格上げは、実際にMVPテスト中で今回の最小方式の限界（連続した1コマが確保できないケース）が問題として顕在化してから判断する。
- この判断の経緧・トレードオフ・格上げの判断基準は、次回以降の振り返りで毎回参照できるよう本SESSION_LOGとコード内コメントの両方に記録する（ユーザーからの明示的な依頼）。

### 続報9（同スレッドの続き・「90分固定・2分割」の根本対応＝分割しきい値の引き上げ）

P1最後の残件「90分固定・2分割」の根本対応に着手した。まずコード変更なしで調査したところ、当初の申し送り（「localTaskDurationEstimateの90分固定ルールを直す」）が**重大な見落としを含んでいた**ことが判明した。

**見落とし1: 見積もり90分の出どころは2系統ある。** [TaskDurationEstimator.ts](../src/intelligence/taskEstimate/TaskDurationEstimator.ts)はGemini設定時はGemini（[taskDurationPrompts.ts](../src/intelligence/taskEstimate/taskDurationPrompts.ts)の「focused work ~45–90m, deep work ~90–180m」指示）、未設定時のみローカルキーワードルールを使う。続報4で`.env`を設定したためテスターは今Gemini側を通っており、**ローカルルールを直してもテスターの体験は変わらない**。当初申し送りの(b)案は的外れだった。

**見落とし2: 「2分割」は見積もりの出どころに非依存。** [resolveAiTasks.ts](../src/presentation/calendar/resolveAiTasks.ts)が`splittable: scaledMinutes > userModel.focusLength`（既定45分）でsplittableを決め、[LocalPlacementStrategy.ts](../src/intelligence/planner/LocalPlacementStrategy.ts)が45分単位で刻む。Gemini/ローカルどちらの見積もりでも45分を超えれば分割される。つまり「2分割」の真の原因は見積もりルールではなく**分割判定ロジック**で、こちらは出どころ非依存。

この2点をユーザーに報告し、対応レバーを3択（(A)分割しきい値を上げる、(B)AI生成タスクも分割しない、(C)両系統の見積もりを保守的に）で提示。**ユーザーは(A)分割しきい値を上げる方式を選択。** 理由: 出どころ非依存でGeminiユーザーにも効く、長いタスクの分割機能自体は残せる、中途半端な見積もりの不自然な小片（60分→45+15等）を消せる。

実装は`resolveAiTasks.ts`。定数`AUTO_SPLIT_MIN_FOCUS_BLOCKS = 2`を追加し、AI推定タスクのsplittable判定を`scaledMinutes > focusLength`から`scaledMinutes >= focusLength * AUTO_SPLIT_MIN_FOCUS_BLOCKS`（=既定で90分以上）に変更した。これにより、46〜89分の中程度のタスクは1コマのまま残り、90分以上の本当に長いタスクだけが従来通り分割される（ユーザーが「90分以上だけ分割、60分は1コマ」という挙動を明示的に選択）。ユーザー指定durationは引き続き常にsplittable=false（変更なし）。既存タスク再利用パスもsplittable判定には関与しない（ユーザー指定時のみ更新する既存挙動のまま）ため、変更は新規作成パスの1箇所のみ。

テストは`resolveAiTasks.test.ts`に2件追加（60分のAI推定タスクがsplittable:falseになる／ちょうど1ブロック=45分もsplittable:false）。既存の「90分AI推定はsplittable:true」回帰テストはしきい値90でそのまま通る。

**この方式の限界（今回許容）:** 90分ちょうどのタスクは依然45+45に分割される（ユーザーが明示的に許容）。また見積もり90分そのものは変えていないので、Geminiが長時間を返す傾向自体は残る。ユーザーが所要時間を指定すれば完全に回避できる（続報5で実装済み）。より根本的にやるなら見積もり側（Geminiプロンプト・ローカルルール）を保守的にする選択肢(C)があるが、Geminiは非決定的で効果が安定しないため今回は見送り。

修正後、`npx tsc --noEmit`（0エラー）・`npm test`（31スイート・167件全成功）・`npm run lint`（0エラー・26警告）を確認済み。

### 現状のベースライン
- 型チェック: 0 エラー
- テスト: 31 スイート / 167 件 全て成功
- Lint: 0 エラー / 26 警告（既存の軽微な `no-unused-vars` 等、未対応のまま）
- git: `main` ブランチ（本エントリのコミット後に `origin/main` と同期予定）

### 決定事項（続報9分）
- 「2分割」の根本対応は、見積もりルールではなく分割判定ロジック（`splittable`のしきい値）を引き上げる方式を採用。46〜89分は1コマ、90分以上のみ分割。出どころ非依存でGemini/ローカル両方に効く。
- 見積もり90分そのものの引き下げ（選択肢C）は、Geminiが非決定的で効果が安定しないため今回は見送り。実際にMVPで「90分ちょうどの分割」がまだ不評なら、しきい値をさらに上げるか、見積もり側の保守化を再検討する。

### 続報10（同スレッドの続き・LT配布に向けたWeb版検証とモーダル凍結バグ修正）

**新しい大目標が確定した: 来週金曜（2026-07-10頃）のライトニングトークでアプリを配布する。** 配布チャネルはWeb版（Vercel）+ Android APKの二本立て（TestFlightはリードタイム的に見送り）。ユーザーの依頼は「計画を全部達成する。今すべきことを提案して実行」で、リスクの高い順に消化する方針とした。タスクリスト: (1)Web版ビルド検証 (2)workers/プロキシ確認 (3)Vercelデプロイ (4)Android APKビルド (5)リリース前チェック (6)LT配布素材。

**(1)Web版ビルド検証を実施し、完了した。** `npx expo export --platform web`は一発成功（633モジュール、dist/生成）。ローカルサーバー+ブラウザ自動操作で検証したところ、**全モーダルが「見えるのに一切タップできない」凍結バグ**を発見した。原因: react-native-webのModalは`animationend`イベントが発火するまでポータル全体を`pointer-events:none`にしたまま待つ実装だが、アニメーションが無効なブラウザ（`prefers-reduced-motion`強制環境・一部組み込み/ヘッドレスブラウザ）ではCSSアニメーションが走らずanimationendが永遠に来ない。オンボーディングモーダルは初回起動で必ず出るため、該当環境では**アプリ全体が操作不能**になる。アクセシビリティ設定利用者が実際に踏み得る実バグと判断し修正した。

修正: `src/components/common/modalAnimation.ts`を新設（`modalAnimation(type)` = Webでは常に`'none'`を返す。`'none'`はイベント待ちをしないため凍結しない。ネイティブは従来のslide/fadeのまま）。App.tsx/AiScheduleModal/ScheduleAdjustModal/CoachModal/EventEditor/OnboardingModal/LooperPickerSheet/ReflectionModal/ReplanProposalModal/RoutineSettingsViewの全10箇所の`animationType`を差し替えた。トレードオフとしてWebではモーダルの開閉アニメーションが無くなるが、確実に動くことを優先した。

修正後のブラウザ検証で**コアループがWebで一周動くことを確認**: オンボーディング完走（次へ×2→はじめる）→カレンダー日表示→＋からEventEditorでタスク作成→タイムラインにセッション配置（時刻・優先度・遅延ラベル表示）→TodayホームにDayType判定（NORMAL DAY）・容量計算・次のセッション表示→ふりかえりモーダル表示→リロード後もlocalStorageで全データ永続。**AI機能はWeb書き出しビルドでは`__DEV__`=falseになるため個人キーが自動無効化される**ことも確認（`isLooperDevClient()`ガード。「AIコーチ（未設定）」表示）。つまりWeb/APK配布でAIを使うにはプロキシが必須という設計が実装レベルで裏付けられた。

付随修正: `vercel.json`が旧Vite時代（my-calendar-app由来）の設定（`npm run build`/`framework: vite`）のままで、そのままVercelに繋ぐと確実にビルド失敗する状態だったため、`npx expo export --platform web`/`outputDirectory: dist`に更新した。ルートの`index.html`（`/src/main.tsx`参照）も旧Vite遺物だが、Expoのexportは自前のdist/index.htmlを生成するため実害なしと判断し今回は放置。

注意: ローカルで`expo export`すると`.env`の個人Geminiキーがバンドルに焼き込まれる（`env: export EXPO_PUBLIC_GEMINI_API_KEY`とログに出る）。前述の`__DEV__`ガードで実行時には使われないが、**ローカル生成のdist/を手動で公開しないこと**（キー文字列自体は含まれる）。Vercel上でビルドすれば`.env`が無いので混入しない。リリースチェック項目に追加。

検証はtsc 0エラー・31スイート167件全成功・lint 0エラー26警告（ベースライン維持）。

### 続報11（同スレッドの続き・プロキシデプロイと、Geminiキー漏洩→ローテーション）

続報10のタスクリストのうち、(2) `workers/looper-gemini-proxy` のデプロイに着手した。`npm install`は導入済みで即完了。`npx wrangler whoami`で未認証と判明したため`npx wrangler login`をバックグラウンドで起動し、ブラウザでユーザーがCloudflareアカウント（`nextdayforge@gmail.com`）にログイン・認可して完了。

secretsの設定は値をチャットに一切出さない方法で実施した: `GEMINI_API_KEY`は`.env`の既存値を`grep | cut | wrangler secret put`でシェル内完結のまま流し込み、`BETA_TOKEN`は`openssl rand -hex 32`でその場生成して同様に設定。`npm run deploy`で`https://looper-gemini-proxy.nextdayforge.workers.dev`にデプロイ成功。生成した`BETA_TOKEN`と発行されたURLを`.env`に追記し、`docs/CLOUD_AI_PROXY.md`記載の変数名（`EXPO_PUBLIC_LOOPER_AI_PROXY_URL`/`EXPO_PUBLIC_LOOPER_AI_BETA_TOKEN`）に合わせた。

**この過程で事故が発生した。** `.env`の中身を`Read`ツールで確認した際、`EXPO_PUBLIC_GEMINI_API_KEY`の実値がそのまま会話ログに表示されてしまった（本来はgrep等で値を伏せたまま扱うべきだった操作ミス）。即座にユーザーに報告し、キーのローテーションを提案・実施した。

ローテーション手順: (1) https://aistudio.google.com/apikey で漏洩したキーを削除、(2) 新規キーを発行、(3) ユーザー自身の手元のターミナルで`npx wrangler secret put GEMINI_API_KEY`を実行し新キーを直接入力（Cloudflare側は再デプロイ不要で即反映）、(4) `.env`もユーザー自身がテキストエディタで直接書き換え。**この2ステップは値を私が一切見ない/扱わない設計にした**（値を私に見せる形にすると同じ事故を再現するため、意図的にユーザー側作業に切り出した）。完了はユーザー申告で確認し、`.env`のタイムスタンプ更新とファイル内に該当行が存在することのみを（値を見ずに）確認した。

古いキーが焼き込まれていた可能性のある続報10の`dist/`ビルドは削除し、ローテーション後の`.env`で`npx expo export --platform web`を再実行して再生成した。`~/my-calendar-app/.env`（Cursor時代の別プロジェクト、別GitHubリポジトリ）にも同じ旧キーが残っているが、無効化済みキーのため実害なしと判断し据え置き（今後そちらを使うなら要差し替え）。

最後に全体のgit状態を確認したところ、`git status`はクリーン、`origin/main`と完全同期（ahead/behind 0/0）で、**push待ちの変更は無かった**（続報9・続報10の内容は既にpush済み）。`dist/`は`.gitignore`対象のためコミット不要。ベースライン再確認: tsc 0エラー・31スイート167件全成功・lint 0エラー26警告。

### 現状のベースライン
- 型チェック: 0 エラー
- テスト: 31 スイート / 167 件 全て成功
- Lint: 0 エラー / 26 警告（既存の軽微な `no-unused-vars` 等、未対応のまま）
- git: `main` ブランチ、`origin/main` と完全同期済み（push待ちなし）

### 決定事項（続報11分）
- 秘密情報（APIキー等）を含むファイルは、値を伏せる操作（grep/cut等でパイプ）を徹底し、`Read`ツールでの直接閲覧は避ける。今回の事故を教訓として厳格化。
- secret値の設定・`.env`編集など「値そのものを扱う操作」は、可能な限りユーザー自身の手元操作に切り出す（Claude側が値を見ない設計を優先する）。

### 続報12（別デバイス・D:\ayosh機での続き・Vercelデプロイ＋Android APKビルド）

前回の申し送り「(3)Vercelデプロイ→(4)Android APKビルド」に、別デバイス（D:\ayosh機）のセッションで着手した。まずpull・ベースライン再確認（tsc 0エラー・31スイート167件・lint 0エラー26警告、変化なし）を行い、Vercel/EASの認証状態を確認したところ両方ログイン済みだった（Vercel: `nextdayforge-3999`、EAS: `asuforge`、`app.json`の`extra.eas.projectId`と一致）。

**Vercelデプロイ:** プロジェクト未リンク（`.vercel`ディレクトリなし）だったため`vercel link --yes --project orbit-looper`で新規作成。この際GitHubリポジトリ（`NextdayForge/Project-Orbit-Looper-beta-1.1`）が自動連携され、以後pushで自動デプロイされる状態になった。AIプロキシ用の2つの環境変数（`EXPO_PUBLIC_LOOPER_AI_PROXY_URL`/`EXPO_PUBLIC_LOOPER_AI_BETA_TOKEN`）をVercel（Production/Preview両方）に設定する必要があったが、この端末には`.env`が存在しなかった（各端末ローカルのみでgit管理外のため）。値を一切表示せずに済む方法として、`eas env:pull preview --non-interactive`でEASのpreview環境変数をスクラッチ用の一時ファイルに取得し、`grep | cut`でシェル内完結のまま`vercel env add`にパイプで渡し、直後に一時ファイルを削除した（値が会話ログに一切出ない設計。続報11のキー漏洩事故を踏まえた徹底）。`vercel --prod`でデプロイ実行し、**https://orbit-looper-red.vercel.app** で公開した。ビルドはVercel側のリモート環境で実行され（この端末にもリモート側にも`.env`が存在しないため）、個人Geminiキー混入のリスクがないことを確認した。`vercel link`が`.gitignore`に`.env*`を自動追記した（既存の`.env`/`.env.local`/`*.local`と一部重複するが実害なし）。

その後Chrome拡張が未接続だったため、ブラウザでの実地確認（続報10で行ったオンボーディング〜コアループの動作確認）は今回**実施できていない**。`curl`でのHTTPステータス（200）とHTML内容の目視確認のみ。**次回、Chrome拡張が使えるようになったら実地確認を推奨。**

**Android APKビルド:** `npm run build:android:preview`相当の`eas build --platform android --profile preview --non-interactive`をバックグラウンドで実行し成功。preview環境変数（プロキシURL・トークン）は自動的にビルドに読み込まれた。インストールリンク（QR付き）: **https://expo.dev/accounts/asuforge/projects/orbit-looper/builds/e4b08ae5-b5ac-448d-8d28-d28a52dfeca7**

付随修正: `docs/CLOUD_AI_PROXY.md`と`docs/BETA_ANDROID_APK.md`に、旧プロジェクト名時代の絶対パス（`D:\ayosh\Project-Orbit-Loop`、`-beta-1.1`無し）がハードコードされたまま残っていたのを発見し、プロジェクトルート相対の汎用的な手順に修正した（どの端末・どの配置場所でもコピペで動くように）。

### 決定事項（続報12分）
- Vercelプロジェクトは`orbit-looper`としてGitHub連携込みで新規作成。以後`main`へのpushで自動デプロイされる（Production環境の環境変数は設定済み）。
- 秘密値をVercelに設定する際は、既存の`.env`を直接読まず、`eas env:pull`で取得した一時ファイルからパイプで渡し、直後に削除する手順を徹底した。今後も同様の「値を会話ログに出さない」手順をこの種の作業のデフォルトとする。
- ドキュメント内の絶対パス（`D:\ayosh\Project-Orbit-Loop`）はプロジェクト名変更前の名残と判明したため、相対パスに修正した。同様の残存箇所が他にないか、気づいた時点で都度直す。

### 次回への申し送り
- **LT配布の残タスク（更新）:** (1)Web版ビルド検証・(2)プロキシデプロイ・(3)Vercelデプロイ・(4)Android APKビルドまで完了。次は**(5)リリース前チェックの最終確認**（`BETA_FORCE_PRO_PLAN`は意図的に`true`のまま維持済み＝ベータ配布中は全員Pro、公開GA時にfalseへ戻すのはさらに先の話）と**(6)QR・フィードバックフォームの準備**。
- **Vercel版の実地ブラウザ確認がまだ済んでいない。** Chrome拡張が使える環境で、続報10と同様にオンボーディング〜コアループ〜ふりかえりの一連が問題なく動くか、本番URL（https://orbit-looper-red.vercel.app）で確認すること。
- Android APK（https://expo.dev/accounts/asuforge/projects/orbit-looper/builds/e4b08ae5-b5ac-448d-8d28-d28a52dfeca7）も実機での動作確認が未実施。
- **バンプ範囲の絞り込みは「合計時間ベース」の最小方式のみ実装済み。反復方式への格上げは保留中:** MVPテスト中に「合計時間は足りているはずなのに実際には入らない」という報告があれば、`placementRollover.ts`の`findLowerPriorityTaskIdsToBump()`を1件ずつ再生成・確認する反復方式に格上げすることを検討する。今のところ実装の必要性は確認できていない。
- **「90分固定・2分割」は分割しきい値の引き上げで根本軽減済み（続報9）。残る調整余地:** 90分ちょうどはまだ45+45に分割される。MVPで不評なら、しきい値をさらに上げる／見積もり側（Geminiプロンプトの「~45–90m」表現やローカルルールの90分）を保守化する、を再検討する。Geminiプロンプト変更は非決定性に注意。
- **実行フィデリティ動線の強化（UI側、P2）:** 開始→集中→完了をアプリ内で必ず通す動線の強化はまだ未着手。
- **学習の可視化を実装する際の注意点（P2）:** `averageFocusScore`/focusScoreは現状どのUIにも出ていないが、将来「今日の学び」等でfocusScoreを見せる場合は、`timedOutcomeCount === 0`のときに「0点」ではなく「未計測」等の表示に倒すこと。
- その次（P3）: Task Proposal Engineの仕上げ（`TaskProposalService`実装、新機能追加はこれで一旦止める）、計測導入（`actualStart`発生率・2週間リテンション）、少数ベータでの2週間ドッグフーディング、課金設計の見直し（差別化コアへ寄せる）。詳細な優先順位と根拠は`docs/PRODUCT_VISION.md`の「§8 近期の重点」を参照。
- 次回セッション開始時は CLAUDE.md の「セッション開始時」手順を自動で行うこと。複数デバイスの同時作業が実際に起きている前提で、pull結果に見覚えのない変更が含まれていても驚かず内容を読んで文脈を把握すること。

---

## 2026-07-01

### 経緯・何が起きたか

ユーザーは今まで ChatGPT（設計・議論）と Cursor（実装）を横断して Orbit Looper を開発してきたが、二つのツールをまたぐと精度が落れると判断し、Claude Code 一本に移行することにした。まず ChatGPT との対話履歴（Task Proposal Engine の設計議論、ChatGPT 自身は進捗を約40〜70%と評価していた）と実際のコードを突き合わせて評価するよう依頼された。

実コードを読んだ結果、ChatGPT の評価は誇張ではなく概ね正確だったと判断した。`intelligence/taskProposal/`（ProposalContext → CandidatePool → ScoringEngine → ProposalSelector）は責務分離・DTO設計・Explainable AI（`reasons[]`）の土台がきちんと実装されていた。ただし ChatGPT が「部分完了タスクに対応できる」と評価していた `candidatePoolBuilder.ts` の `remainingMinutes` は、実際には `task.estimatedMinutes` をそのまま使っているだけで、評価が実装を先取りしていた箇所だと判明した（CLAUDE.md の「既知の小課題」に記録済み）。

コード評価と並行して、環境そのものに看過できない問題が2つ見つかった。1つは **git 管理下になかったこと**（`git status` が "not a git repository" を返した）、もう1つは **`node_modules` が未インストールだったこと**。これを「今すぐやるべきこと」としてユーザーに提案し、了承を得て実行した。

`git init` → `npm install` の後、ベースライン確認のため `tsc --noEmit` / `npm test` / `npm run lint` を回したところ、さらに実害のあるバグを2つ発見した。
- `package.json` は ESLint 9（flat config 必須）を指定しているのに設定ファイルは旧 `.eslintrc.js` のままで、`npm run lint` が起動時にエラーで即死していた。`eslint-config-expo/flat` を使った `eslint.config.js` に移行し、旧ファイルを削除して解消。
- `src/__tests__/scoringEngine.test.ts` の `scoreFor(taskOverrides, sessions = [])` で、デフォルト引数 `[]` に型注釈がなく TypeScript が `never[]` と推論し、`tsc --noEmit` が2件のエラーで失敗していた（テスト自体は ts-jest の `isolatedModules: true` により実行時は素通りしていたため、これまで気づかれていなかった）。`Session[]` と明示して解消。

その後、GitHub リポジトリ（`https://github.com/NextdayForge/Project-Orbit-Looper-beta-1.1.git`）を教えてもらい `git remote add` で接続したところ、**リモート側に既に初回コミット（`ed4576f`）が存在していた**ことが判明した（ローカルの初回コミットとは無関係な履歴、共通の親を持たない）。両者を diff した結果、差分は上記の修正5ファイルのみでほぼ同一内容だったため、無理に履歴統合や force push はせず、**リモートの既存コミットを土台として維持し、修正一式を2つ目のコミット（`c1b03db`）として積む**方式で解決した（fast-forward push で成功、ローカルの一時ブランチは削除）。

一区切りついたところで、ユーザーから「複数デバイスで Claude Code を使いたいので、セッション終了時に対話内容・変更内容を次回に引き継げるようにしたい」という要望が出た。会話メモリはマシンローカルで同期されない旨を説明し、コードは git、文脈は git 管理下のログファイルで引き継ぐ方針を提案・了承を得た。合わせて「セッション終了時、確認なしで push してよいか」を確認したところ、**自動 push を承認**された（この承認はCLAUDE.mdに明記し、以後のセッションでも有効）。これを機に本ログファイルを新設し、CLAUDE.md に運用ルールを追記した（コミット `7afc276`）。

続けて、新しいデバイスで初めてこのプロジェクトを扱う際にそのまま貼れる「初回セットアップ用プロンプト」の作成を依頼され、CLAUDE.md に追記（コミット `bceed97`）。その際「クローン先はどこになるのか」という質問が出たため、`git clone` はカレントディレクトリ直下に作られるだけで固定の配置場所はないことを説明した。このマシンでは `C:\Users\ayosh\` 直下に配置されていたため、**どのデバイスでもユーザーのホームディレクトリ直下に統一する**ようプロンプトを修正した（コミット `a302dae`）。

さらに「2回目以降のセッションでは何かした方がいいか」と聞かれ、`git pull` →（`package-lock.json` が変化していれば）`npm install` → `SESSION_LOG.md` 確認、という一連の流れを**ユーザーの指示を待たずセッション開始時に自動で行う**よう CLAUDE.md を強化した（コミット `37badd3`）。

最後に「対話型AIのように、以前の会話を踏まえて別デバイスでも会話を続けたい」という要望が出た。これは技術的な誤解を含んでいたため訂正した: claude.ai のようなアカウント同期型チャットと、Claude Code（プロジェクト/マシン単位でセッションが動く開発ツール）は別物であり、生の会話履歴はマシンローカルにしか残らない。完全な会話継続(生ログの同期)は実現できないと説明したうえで、代替案を2つ提示した。(a) 別デバイスで実際にセッション一覧を見せてもらい、このハーネス固有の `ccd_session_mgmt` ツールがアカウント単位でセッションを保持しているか確認する、(b) `SESSION_LOG.md` を単なる箇条書きではなく、物語的で詳細な要約に強化する。ユーザーは **(b) を選択**。本エントリ自体がその新方式の最初の実例であり、CLAUDE.md のログ運用ルールもこの方式（経緯・理由・決定事項・保留事項・申し送りを物語的に書く)に更新した。

その後ユーザーが実際に別デバイスで検証: Claude Code を起動して「他のセッション一覧」を尋ねたところ、**「他のセッションは見つからない」という結果**になった。これにより `ccd_session_mgmt` のセッション管理はマシンローカル（このハーネスのインストール単位）であり、アカウント単位で複数デバイスをまたいでセッションを保持する仕組みではないことが確定した。したがって「(a) 実は同期されている」の可能性は否定され、`SESSION_LOG.md` による物語的な要約の引き継ぎが唯一かつ正しい選択肢であることが裏付けられた。

### 現状のベースライン
- 型チェック: 0 エラー
- テスト: 27 スイート / 132 件 全て成功
- Lint: 0 エラー / 26 警告（既存の軽微な `no-unused-vars` 等、未対応のまま）
- git: `main` ブランチ、`origin/main` と同期済み

### 決定事項
- セッション終了時の `git push` は確認なしで実行してよい（ユーザー承認済み、CLAUDE.md に明記）。
- プロジェクトは全デバイスでユーザーのホームディレクトリ直下に配置する方針。
- 完全な会話継続（生ログ同期）はできない前提で、本ログを「物語的な詳細要約」として運用する方針にシフト（本エントリから適用）。

### 検証済み事項
- `ccd_session_mgmt` のセッション管理はマシンローカルであり、複数デバイスをまたいだアカウント単位の同期は**行われないことをユーザーが別デバイスで確認済み**（「他のセッションは見つからない」）。以後この前提で運用する。

### 次回への申し送り
- **Task Proposal Engine の続き:** `TaskProposalService`(`coach/CoachService.ts` を手本に Gemini+local Facade)の実装から着手。CLAUDE.md の「現在の作業」セクションに詳細パイプラインあり。
- **未調査:** ユーザー報告の「どのタスクを登録しても90分に設定され2つに分割される」現象。`intelligence/planner/` の配置(Placement)ロジック側の可能性が高い。再現条件の確認から。
- 次回セッション開始時は CLAUDE.md の「セッション開始時」手順(git pull → 条件付き npm install → 本ログ確認)を自動で行うこと。
