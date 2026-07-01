# Calendar App（Expo）

## スマホで起動（Expo Go SDK 54）

### 1. 依存関係インストール（初回のみ）

```powershell
cd C:\Users\naoki\my-calendar-app
npm install
```

### 2. 開発サーバー起動

**重要: Cursor 内のターミナルではなく、Windows の PowerShell（スタートメニューから）で実行してください。**
Cursor 内だと `10.233.x.x` というスマホから届かない IP になることがあります。

**同じ Wi-Fi の場合:**
```powershell
cd C:\Users\naoki\my-calendar-app
npm run start:clear
```

表示が `exp://192.168.x.x:8080` になっていることを確認してから QR スキャン。

**Wi-Fi 接続がうまくいかない場合（Tunnel）:**
```powershell
npm run start:tunnel
```

### 3. Expo Go で QR コードをスキャン

- Android: Expo Go アプリ内でスキャン
- Expo Go は **SDK 54** 対応版であること

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| Something went wrong | `npm run start:clear` で再起動 |
| 接続できない | `npm run start:tunnel` を試す |
| パスをコマンドとして実行してしまった | `cd C:\Users\naoki\my-calendar-app` のみ実行（末尾の `>` は不要） |
