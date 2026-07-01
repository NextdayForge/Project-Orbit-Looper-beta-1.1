# Orbit Looper — TestFlight 配布ガイド（開発者向け）

Orbit Looper を iOS ベータ（TestFlight、約 5 名）として配布する手順です。

## 前提

| 項目 | 内容 |
|------|------|
| Apple Developer Program | 有効なメンバーシップ（年 $99） |
| Expo / EAS アカウント | [expo.dev](https://expo.dev) で無料登録 |
| ローカル環境 | Node.js 18+、このリポジトリを clone 済み |
| Bundle ID | `com.orbitlooper.app` |
| マーケティングバージョン | `1.0.0`（`app.json` の `expo.version`） |
| iOS ビルド番号 | EAS `production` プロファイルで `autoIncrement`（初回は `1`） |

## 1. 初回セットアップ

```powershell
cd D:\ayosh\Project-Orbit
npm install
npx eas login
npx eas init
```

`eas init` で Expo プロジェクトがリンクされ、`app.json` に `extra.eas.projectId` が追加されます（git にコミットして問題ありません）。

### フィードバック URL の設定

配布前に `src/config/betaConfig.ts` の `BETA_FEEDBACK_URL` を実際の連絡先に変更してください。

```typescript
export const BETA_FEEDBACK_URL =
  'mailto:you@example.com?subject=Orbit%20Looper%20ベータ%20フィードバック';
// または GitHub Issues:
// 'https://github.com/your-org/orbit-looper/issues/new'
```

## 2. App Store Connect でアプリを登録

1. [App Store Connect](https://appstoreconnect.apple.com) → **マイ App** → **＋** → **新規 App**
2. プラットフォーム: iOS
3. 名前: **Orbit Looper**
4. サブタイトル（任意）: **AI Personal OS**
5. Bundle ID: **com.orbitlooper.app**（Developer ポータルで事前登録が必要な場合あり）
6. SKU: 任意（例: `orbit-looper-ios-001`）

## 3. iOS ビルド（EAS）

```powershell
npm run build:ios
# 同等: eas build --platform ios --profile production
```

初回ビルド時、EAS が Apple 証明書・プロビジョニングプロファイルの作成を案内します。対話形式で進めてください（リポジトリに秘密情報は保存されません）。

内部テスト用の ad-hoc ビルドが必要な場合:

```powershell
npm run build:ios:preview
```

ビルド完了後、Expo ダッシュボードまたは CLI から `.ipa` を確認できます。

## 4. TestFlight へ提出

```powershell
npm run submit:ios
# 同等: eas submit --platform ios --profile production
```

初回は Apple ID、App-specific password（2FA 有効時）、App Store Connect の App ID などを入力します。対話で保存するか、`eas credentials` / `eas submit` のドキュメントに従い CI 用に設定してください。

提出後、App Store Connect → **TestFlight** で「処理中」→「テスト準備完了」になるまで数分〜数十分待ちます。

## 5. テスター 5 名の招待

### 内部テスト（最大 100 名、審査不要・即日）

1. App Store Connect → TestFlight → **内部テスト**
2. グループを作成（例: `Orbit Looper Core 5`）
3. Apple Developer チームの **App Store Connect ユーザー**として 5 名を追加
4. ビルドをグループに割り当て

### 外部テスト（審査 1 回必要、メール招待）

1. TestFlight → **外部テスト** → グループ作成
2. テスターのメールアドレスを追加（Apple ID 不要、招待メール経由）
3. ビルドを選択し **Beta App Review** を提出

5 名だけなら **内部テスト**が最も早いです（全員がチームメンバーである必要あり）。外部の知人には **外部テスト**を使います。

## 6. テスター向け資料

日本語の簡易ガイド: [BETA_TESTER_GUIDE.md](./BETA_TESTER_GUIDE.md)

## 7. テスターに確認してほしい項目

| 領域 | 確認内容 |
|------|----------|
| **Today** | 朝の DayType 表示、タスク一覧、セッション開始 |
| **Focus** | フォーカスモード、カウントダウン、モーション検知 |
| **Reflection** | 夜のふりかえり入力・抽出 |
| **Calendar** | 予定の追加・編集・ドラッグ |
| **Coach** | AI コーチ相談（有料プラン / 開発ビルド時） |
| **Settings** | Orbit Looper AI プラン表示、データエクスポート / リセット |
| **ベータ** | 設定 → ベータ → バージョン表示、フィードバックリンク |

## 8. 再ビルド・バージョン更新

- **パッチリリース**: `app.json` の `expo.version` を上げる（例: `1.0.1`）
- **ビルド番号**: `production` プロファイルの `autoIncrement: true` により EAS が自動加算
- 手動で上げる場合: `expo.ios.buildNumber` を更新

```powershell
npm run build:ios
npm run submit:ios
```

TestFlight で新ビルドをテストグループに割り当て直します。

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| `eas: command not found` | `npm install` 後 `npx eas` を使う |
| 証明書エラー | `npx eas credentials` で iOS 資格情報を再生成 |
| TestFlight にビルドが出ない | App Store Connect の契約・税務・銀行が完了しているか確認 |
| 通知が来ない | 実機で通知許可を確認（Expo Go ではなく TestFlight ビルド） |

## 参考

- [EAS Build — iOS](https://docs.expo.dev/build/introduction/)
- [EAS Submit — iOS](https://docs.expo.dev/submit/ios/)
- [TestFlight ベータテスト](https://developer.apple.com/testflight/)
