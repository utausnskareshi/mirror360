# Mirror360

オフライン動作するスマートフォン用ミラー PWA。フロントカメラを鏡として使い、最大3秒の録画で横顔や後頭部もスライダーで自由に確認できます。

## 特長

- 📷 フロントカメラを鏡として表示（左右反転）
- ⏺ 録画時間 3 / 5 / 10 秒を選択 → スライダーで任意位置を再生
- ◀▶ コマ送り（1/30 秒単位）で360°の細部もチェック
- ☀ 明るさ UP（顔まわりを白く照らす）
- 🔍 ピンチ・スライダーでズーム（1.0〜3.0×）
- ↔ 左右反転トグル（鏡像 / 他人視点）
- ⊞ グリッド表示で左右対称チェック
- ⏸ フリーズで一瞬を静止
- 📷 静止画を PNG 保存（Web Share API で写真アプリへ保存可）
- 🔁 ループ再生
- 🔋 画面ロック防止（Wake Lock API）
- 🔄 前後カメラ切替
- 📱 iOS / Android のホーム画面に追加してオフライン動作
- 🛡️ 全処理が端末内で完結し、外部送信なし

## インストール（ホーム画面に追加）

### iPhone (Safari)

1. Safari で公開 URL を開く
2. 下部の **共有** ボタンをタップ
3. **「ホーム画面に追加」** を選択
4. 右上の **「追加」** をタップ

### Android (Chrome)

1. Chrome で公開 URL を開く
2. 右上の **︙メニュー** をタップ
3. **「アプリをインストール」** または **「ホーム画面に追加」** を選択

ホーム画面のアイコンから起動するとオフラインでも動作します。

## ローカル動作確認

カメラ API は `https://` または `http://localhost` でのみ動作します。任意の HTTP サーバを使ってください。

```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server -p 8000

# PHP
php -S localhost:8000
```

ブラウザで `http://localhost:8000/` を開きます。スマホ実機でテストする場合は GitHub Pages にデプロイ後の URL を使うのが最も簡単です。

## ファイル構成

```
.
├── index.html              ウェルカム / ミラー / プレビュー画面
├── style.css               モバイル最適化のダークテーマ
├── app.js                  カメラ・録画・スクラブ・PWA ロジック
├── manifest.webmanifest    PWA マニフェスト
├── service-worker.js       オフラインキャッシュ
├── icons/
│   ├── icon.svg
│   └── icon-maskable.svg
├── LICENSE
├── README.md
└── .gitignore
```

## 動作環境

- **iOS 14.3 以降** の Safari（`MediaRecorder` 対応のため）
- **Android Chrome** 最新版
- HTTPS 配信（GitHub Pages は標準で HTTPS）

## プライバシー

- カメラ映像・録画動画・保存画像はすべて端末内で処理されます
- 外部サーバへの送信は一切行いません
- `localStorage` には「ウェルカム画面を次回表示しない」フラグのみ保存します
- マイク / 音声は録音しません（無音録画）

## カスタマイズ

- アイコンを差し替えたい場合は `icons/` 配下の SVG を編集してください
- iOS 旧バージョンで `apple-touch-icon` の見栄えを向上させたい場合は、PNG 版を生成して `index.html` の `<link rel="apple-touch-icon">` を差し替えてください
- 録画時間を変更する場合は `index.html` の `data-dur` 属性を編集

## ライセンス

MIT License — 詳細は [LICENSE](LICENSE) を参照してください。
