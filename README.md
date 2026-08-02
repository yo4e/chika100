# 地下百階まで、配達です。

深夜の古い建物を10階ずつ降り、荷物を壊さずB100の受取人へ届ける、短編ターン制ブラウザゲームです。

アカウント、データベース、外部素材は不要です。同じ日本日付には全員が同じデイリーシードで遊び、スコアと自己ベストはブラウザ内だけで計算・保存します。

## 遊べる内容

- タイトル → B10〜B100の10区画 → 成功または途中失敗 → スコア → 再挑戦
- 決定的に生成され、必ず出口まで到達できる15×11マップ
- ターン制の移動と戦闘、4種類の敵、3種類の用品、段差の罠
- 各区画後に選ぶ8種類の配達スキル
- 矢印キー／WASD、タッチ十字キー、マップ上のスワイプ操作
- PC・スマートフォン向けレスポンシブUI
- API障害時も同じ日付からローカルシードを作ってプレイ続行
- 到達階、配達成否、荷物状態、体力、ターン数によるスコアと端末内ベスト

## ローカル起動

必要環境は Node.js 22 と npm です。外部npmパッケージは使用していません。

```bash
npm ci
npm test
npm run build
npm start
```

[http://localhost:3000](http://localhost:3000) を開きます。開発中は `npm run dev` でソースを直接配信できます。

任意のポートで起動する場合:

```bash
PORT=4173 npm start
```

## API

すべて読み取り専用で、ユーザー情報やスコアは受け取りません。

| パス | 内容 |
|---|---|
| `GET /api/health` | RenderのHTTP health check用。外部依存なし |
| `GET /api/daily` | 日本時間の日付、決定的シード、便名、方式バージョン |
| `GET /api/config` | 公開可能なバージョン、ビルドID、日付、機能フラグ |

## Renderへデプロイ

リポジトリ直下の `render.yaml` は、次の構成を宣言しています。

- Node.js Web Service / Free instance
- シンガポールリージョン
- `main` の各commitで自動デプロイ
- build時にテストと本番ビルドを実行
- `/api/health` によるHTTP health check
- `NODE_ENV=production`

Render Dashboardで **New → Blueprint** を選び、このGitHubリポジトリを接続してください。GitHub Appのアクセス許可で `yo4e/chika100` を対象に含める必要があります。Blueprintを適用するとbuild、test、startが走り、成功後に `https://chika100.onrender.com` 形式のURLが発行されます（同名が使用中の場合、実際のサブドメインは変わります）。

デプロイ後は次を確認します。

1. 発行URLからタイトル画面が開く
2. `/api/health` が `200` と `{"status":"ok", ...}` を返す
3. PCとスマートフォンの双方で配達を開始できる
4. DashboardのLogsに `server_started` とJSON形式のアクセスログが出る
5. 次の `main` pushで自動デプロイされる

確認結果は [docs/render-notes.md](docs/render-notes.md) に記録できます。

## 構成

```text
src/server.js             Node.js HTTPサーバー、静的配信、API
src/public/app.js         画面遷移、入力、描画、localStorage
src/public/game/logic.js  マップ生成、敵、戦闘、進行、スコア
src/public/game/rng.js    シード付き疑似乱数
test/                     ゲームロジックとHTTP APIのテスト
scripts/build.mjs         dist/への再現可能な本番ビルド
render.yaml               Render Blueprint
```

サーバーは `process.env.PORT` を使って `0.0.0.0` にbindします。ゲーム進行は完全にブラウザ内にあり、サーバー再起動やFree instanceのスピンダウンの影響を受けません。

## 既知の制約

- ランキング、複数端末間の記録共有、アカウント、Postgresは初版に含みません。
- 自己ベストはブラウザの `localStorage` にだけ保存され、データ消去や別ブラウザでは引き継がれません。
- Free Web Serviceは一定時間アクセスがないと休止し、次のアクセス時に起動待ちが発生します。
- 音声、外部画像、PWAのオフラインキャッシュは初版に含みません。

詳細な仕様と今後の候補は [DESIGN.md](DESIGN.md) を参照してください。
