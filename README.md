# IronLog

IronLogは、スマートフォンで日々のウエイトトレーニングを手早く記録するための個人用アプリです。データはブラウザのLocalStorageに保存され、アカウント登録なしで利用できます。

## 機能

- 日付ごとのトレーニング記録とセットの追加・編集・削除
- 重量・回数・体重のホイール入力
- 前回の体重や種目別セット内容を使った記録入力
- 初期種目に加えた種目の登録、検索、最近使った種目の表示
- 片手重量を扱うダンベル種目
- 懸垂・ディップスの体重比を反映した実効負荷と推定1RMの計算
- 履歴画面での体重推移・最新トレーニングの種目別グラフ表示
- グラフから選択した日のトレーニング内容確認と日付間移動
- 種目ごとの最大重量・推定1RMグラフと期間切替
- JSONバックアップのエクスポート・インポート
- PWAマニフェスト、アプリアイコン、Service Workerによるキャッシュ

## ローカルで起動する

### 必要環境

- Node.js（LTS推奨）
- npm

### 開発サーバー

```bash
npm install
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

### lintと本番ビルド

```bash
npm run lint
npm run build
npm run start
```

本番サーバーは `http://localhost:3000` で起動します。

## 技術スタック

- Next.js App Router
- React、TypeScript
- Tailwind CSS v4
- Recharts
- Repositoryパターンを介したLocalStorage永続化
- PWA（Web App Manifest、Service Worker）

## スクリーンショット

画面のスクリーンショットは `docs/screenshots/` に配置してください。READMEに掲載する場合は、たとえば次のように参照できます。

```md
![記録画面](docs/screenshots/recording.png)
```

## ライセンス

現在、ライセンスは設定されていません。公開・再利用の条件を決めたうえで、適切なライセンスファイルを追加してください。ライセンスが明示されるまでは、第三者による再利用許可を示すものではありません。
