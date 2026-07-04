# Orbit Looper — Android APK 配布ガイド（友達・講義向け）

Play ストアなしで、APK を直接配る手順です。**Android のみ**（iPhone 向けは TestFlight 別途）。

## 前提

| 項目 | 内容 |
|------|------|
| 費用 | EAS 無料枠内なら **0 円**（月あたりビルド回数に上限あり） |
| アカウント | [expo.dev](https://expo.dev) 無料登録 |
| 端末 | 友達は Android |

## 1. 初回セットアップ（開発者・1回だけ）

プロジェクトフォルダ（`Project-Orbit-Looper-beta-1.1`）で:

```powershell
npm install
npx eas login
npx eas init
```

- `eas login` → Expo アカウントでログイン（ブラウザが開く）
- `eas init` → プロジェクト名確認 → **Y** → `app.json` に `projectId` が追加される

## 2. APK をビルド

```powershell
npm run build:android:preview
```

または:

```powershell
npx eas build --platform android --profile preview
```

- 初回は Android キーストアを EAS が自動作成するか聞かれる → **Let EAS handle it（おすすめ）**
- クラウドビルドなので **10〜20 分** ほどかかる
- 完了すると **APK の URL** がターミナルと [expo.dev](https://expo.dev) ダッシュボードに表示される

## 3. 友達に配る

### 方法 A: リンクを共有（いちばん簡単）

1. ビルド完了後の **Install link / APK URL** をコピー
2. LINE・講義スライド・Google Drive に貼る
3. 友達は Android ブラウザで開いて **ダウンロード → インストール**

### 方法 B: APK ファイルを直接渡す

1. expo.dev のビルド詳細から `.apk` をダウンロード
2. Google Drive 等にアップロードして共有

## 4. 友達側のインストール手順（説明用コピペ）

> 1. リンクから APK をダウンロード  
> 2. 「提供元不明のアプリ」がブロックされたら、設定 → セキュリティ → **このアプリのインストールを許可**  
> 3. インストール後、Orbit Looper を開く  
> 4. 困ったら **設定 → ベータ → フィードバック**

**注意:** Gemini API キーは不要（無料プランはローカルモード）。通知は実機 APK なら Expo Go より動きやすいです。

## 5. 講義で使うとき

| やりたいこと | 方法 |
|--------------|------|
| その場で5分デモ | `npx expo start` + Expo Go + QR（APK 不要） |
| 1週間使ってもらう | **この APK 手順** |

宣伝例:

> Orbit Looper（AI Personal OS）ベータ。Android の方はこのリンクから APK を入れてください。iPhone は今回非対応です。

## 6. 更新版を配るとき

1. `app.json` の `version` または `android.versionCode` を上げる  
2. もう一度 `npm run build:android:preview`  
3. 新しい APK リンクを共有（上書きインストール可）

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| `Not logged in` | `npx eas login` |
| `projectId` エラー | `npx eas init` |
| ビルドがキューで待つ | 無料枠混雑時あり。expo.dev で進捗確認 |
| 友達がインストールできない | 「不明なアプリを許可」の説明を再度 |

## 参考

- [EAS Build — Android APK](https://docs.expo.dev/build-reference/apk/)
