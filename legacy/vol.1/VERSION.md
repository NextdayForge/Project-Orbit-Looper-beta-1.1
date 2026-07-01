# vol.1

`NextdayForge/project-calendar` 向けスナップショット（2026-06-27 時点・最新機能込み）。

## 含まれる機能

- AI スケジュール生成（Gemini）
- 日次タスク一覧 / タイムライン
- 優先度・固定予定・再配置（↻ 再配置）
- **▶ 今から** — 未完了タスクを現在時刻から順に配置（過去日の未完了も今日へ集約）
- タスク所要時間変更（編集画面）・後続スケジュール連動
- 編集画面を上バースワイプで閉じる
- タスク一覧は時間・優先度の表示のみ（変更は編集画面）

## 除外

- `node_modules` / `.expo` / `.git` / `.env`

## セットアップ

```powershell
cd vol.1
npm install
copy .env.example .env
npm run start:clear:tunnel
```
