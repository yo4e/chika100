# Render観察ノート

初回デプロイ後に、Dashboardと実機で確認した内容を記録するための雛形です。

## デプロイ情報

- 実施日: 2026-08-02
- Service名: `chika100` (`srv-d9nar4bm8hqs73dv8cjg`)
- 公開URL: https://chika100.onrender.com
- Region: Singapore
- Instance type: Free
- 対象commit: `549c98f4de06209d280f55a4d7687271474fc325`
- 初回build・deploy所要時間: 約26秒（02:38:12開始、02:38:38 Live）
- cold start所要時間:

## 初回デプロイ

- [x] Renderへ登録し、CLIをアカウントへ接続した
- [x] GitHubリポジトリ `yo4e/chika100` から取得できた
- [x] 公式CLI v2.22.0で `render.yaml` のBlueprint検証が通った
- [x] `npm ci && npm test && npm run build` が成功した（13 tests passed）
- [x] `npm start` で `server_started` ログが出た（`0.0.0.0:10000`）
- [x] `/api/health` が2xxを返し、deployがLiveになった
- [x] 発行された `onrender.com` URLからタイトルHTMLが返った
- [x] `/api/daily` の日付が日本時間と一致した
- [x] runtime logsにAPIアクセスがJSONで表示された

メモ: Node.js 22.23.2が選択された。`/api/config` のbuild IDは `549c98f4de06`。CSP、COOP、Permissions-Policy、Referrer-Policy、X-Content-Type-Options、X-Frame-Optionsの本番レスポンスを確認済み。

## 実機試遊

| 端末・ブラウザ | タイトル | ゲーム開始 | 操作 | 結果 | 再挑戦 | 備考 |
|---|---|---|---|---|---|---|
| Mac / Safari |  |  |  |  |  |  |
| Mac / Chrome |  |  |  |  |  |  |
| iPhone / Safari |  |  |  |  |  |  |
| Android / Chrome |  |  |  |  |  |  |

## GitHub連携

- [ ] `main`への次のpushで自動デプロイが始まった
- [ ] 新しいcommitのbuild IDが `/api/config` に反映された
- [ ] build失敗時に直前の正常版が配信され続けた
- [ ] Manual Deployの導線を確認した
- [ ] 直前のdeployへのRollback導線を確認した

メモ:

## Free Web Serviceの休止と復帰

- [ ] アイドル後にserviceがspin downした
- [ ] 次のアクセスでRenderの読み込み画面が表示された
- [ ] 復帰後も同じ日のデイリー便で遊べた
- [ ] ブラウザ内の自己ベストが残っていた

復帰にかかった時間:

家族向けURLとして気になった点:

## RenderとCloudflareの比較メモ

- Node.jsプロセスのbuild/start/停止を意識した点:
- 静的ファイルとAPIを一つのServiceで配る分かりやすさ:
- health checkとruntime logsの便利さ:
- cold startの体感:
- Cloudflare Static Assets + Workersなら変わりそうな点:
- 次の小規模アプリで自然に選ぶ構成:
