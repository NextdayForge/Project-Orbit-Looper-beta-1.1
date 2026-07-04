# Orbit Looper — ライトニングトーク配布資料（2026-07-10頃）

配布チャネルは **Web版（全OS・ブラウザ）** と **Android APK** の二本立て。TestFlight（iOS）は今回のLTでは見送り。

## 配布リンク・QR

| チャネル | 対象 | リンク | QR |
|---|---|---|---|
| **Web版** | 全員（iPhoneでもブラウザで使える） | https://orbit-looper-red.vercel.app | ![](qr-web.png) |
| **Android APK** | Androidのみ（通知など実機機能が使える） | [インストールページ](https://expo.dev/accounts/asuforge/projects/orbit-looper/builds/e4b08ae5-b5ac-448d-8d28-d28a52dfeca7) | ![](qr-android.png) |

## 口頭で伝える案内（コピペ用）

> Orbit Looper（AI Personal OS）のベータです。
> まずはこのQR（Web版）を開けば、iPhoneでもAndroidでもすぐ試せます。
> Androidの方でアプリとして入れたい場合は、もう一つのQRからAPKをどうぞ。
> 「不明なアプリのインストールを許可」を求められたら許可してください。

## フィードバックの送り方

アプリ内の **設定 → ベータ → フィードバックを送る** をタップすると、メールアプリで
`nextdayforge@gmail.com` 宛の下書きが開きます（`src/config/betaConfig.ts` の `BETA_FEEDBACK_URL` で設定済み）。
メールが開かない環境（Web版でメールクライアント未設定など）では、口頭・LINE等での報告を案内する。

## 配布前チェック（当日）

- [ ] Web版が実際に開けるか、当日会場のWi-Fiで再確認（`https://orbit-looper-red.vercel.app`）
- [ ] Android実機でAPKインストール〜起動までの一連を1回通しておく（今回のセッションでは未実施）
- [ ] `BETA_FORCE_PRO_PLAN=true` のままであること（ベータ中は全員AI機能を使える設定）
