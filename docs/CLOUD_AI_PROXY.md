# Orbit Looper — Cloud AI プロキシ（ベータ）

Gemini API キーを端末に載せず、Cloudflare Workers 経由で AI を提供します。

## 構成

```
[APK / アプリ]
  Authorization: Bearer <BETA_TOKEN>
  POST /v1/generate
       ↓
[Cloudflare Worker]  ← GEMINI_API_KEY（秘密）
       ↓
[Gemini API]
```

## 1. Worker をデプロイ

```powershell
cd workers\looper-gemini-proxy
npm install
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put BETA_TOKEN
npm run deploy
```

- `GEMINI_API_KEY` … [Google AI Studio](https://aistudio.google.com/apikey) のキー
- `BETA_TOKEN` … 長いランダム文字列（例: `openssl rand -hex 32` 相当）

デプロイ後に表示される URL（例: `https://looper-gemini-proxy.<account>.workers.dev`）を控える。

## 2. アプリ側の環境変数

ビルド時に Expo へ渡します（**リポジトリにコミットしない**）。

| 変数 | 内容 |
|------|------|
| `EXPO_PUBLIC_LOOPER_AI_PROXY_URL` | Worker の URL（末尾スラッシュなし） |
| `EXPO_PUBLIC_LOOPER_AI_BETA_TOKEN` | Worker の `BETA_TOKEN` と同じ値 |

### ローカル開発（expo start）

`.env` に追加:

```env
EXPO_PUBLIC_LOOPER_AI_PROXY_URL=https://looper-gemini-proxy.your-subdomain.workers.dev
EXPO_PUBLIC_LOOPER_AI_BETA_TOKEN=your-beta-token
```

### EAS APK ビルド

```powershell
npx eas env:create --scope project --name EXPO_PUBLIC_LOOPER_AI_PROXY_URL --value "https://..." --environment preview
npx eas env:create --scope project --name EXPO_PUBLIC_LOOPER_AI_BETA_TOKEN --value "your-beta-token" --environment preview --visibility secret
npm run build:android:preview
```

## 3. ベータ期間：全員 Pro

`src/config/cloudAiProxy.ts` の `BETA_FORCE_PRO_PLAN = true` により、全ユーザーが Orbit Looper AI 対象になります。

**公開前に必ず `false` に戻してください。**

## 4. 動作確認

1. Worker デプロイ + アプリ env 設定
2. 設定 → Orbit Looper AI が **有効**
3. 接続状態が **Orbit Looper AI（ベータ）** または **開発モード** 以外で有効
4. コーチ / ふりかえりで Gemini 応答

## 5. セキュリティメモ

- `BETA_TOKEN` は APK に含まれるため **完全秘密ではない**
- 漏洩時は `wrangler secret put BETA_TOKEN` でローテーション → **新 APK** が必要
- Gemini キー本体は Worker のみ（ローテーションは Worker 側だけで可）

## 6. 有料化への拡張

将来は `BETA_TOKEN` を **ログイン後の短命 JWT** に差し替え、Worker で Stripe / 課金状態を検証する想定です。
