# Render観察ノート

初回デプロイ後に、Dashboardと実機で確認した内容を記録するための雛形です。

## デプロイ情報

- 実施日:
- Service名:
- 公開URL:
- Region: Singapore
- Instance type: Free
- 対象commit:
- 初回build所要時間:
- cold start所要時間:

## 初回デプロイ

- [ ] Renderへ登録し、GitHubアカウントを接続した
- [ ] GitHub Appに `yo4e/chika100` のアクセスを許可した
- [ ] `render.yaml` をBlueprintとして読み込めた
- [ ] `npm ci && npm test && npm run build` が成功した
- [ ] `npm start` で `server_started` ログが出た
- [ ] `/api/health` が2xxを返し、deployがLiveになった
- [ ] 発行された `onrender.com` URLからタイトル画面が開いた
- [ ] `/api/daily` の日付が日本時間と一致した
- [ ] runtime logsにAPIアクセスがJSONで表示された

メモ:

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
