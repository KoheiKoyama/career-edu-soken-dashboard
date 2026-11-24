# 営業管理ダッシュボード

学校ごとの営業活動とパイプラインを一元管理し、収益見込みを全員が同じ数字で確認するための社内ダッシュボードです。

- 技術構成：Next.js（App Router）／Vercel／Neon（Postgres）／Auth.js（Googleログイン）
- データモデル：Google スプレッドシート「営業管理ダッシュボード データモデル」に準拠

## 画面

| 画面 | 内容 |
|---|---|
| トップ | 経営指標（目標契約人数・受注済み・Binary Backlog・All Backlog・手堅い見通し・現在の契約人数など、年度切り替え可）、警告、アカウント一覧 |
| パイプライン | Opportunity のカンバン／一覧。カードのプルダウンでステージを変更 |
| ネクストアクション | 未完了の全件を期日順で表示。担当者で絞り込み・並べ替え。未設定のアカウントも表示 |
| アカウント詳細 | ネクストアクション、Opportunity、Engagement、アクティビティ、Focus、コンタクト、基本情報、変更履歴 |
| 設定 | 年度目標（契約人数）、ユーザー（権限：編集／閲覧） |

## 自動処理

- Opportunity を「受注」にすると Engagement（Onboarding）を自動作成
- 契約終了日の6か月前に、更新 Opportunity（リード・確度30%）とネクストアクション「更新提案の準備」を自動作成
- 契約終了日を過ぎた Engagement を「契約終了」に変更
- ネクストアクションを完了にすると、アクティビティとして記録
- ステージ・確度・金額・ステータスの変更履歴を記録

日次の処理は Vercel Cron で毎朝6時（日本時間）に動き、トップ画面を開いたときにも実行されます。

---

## 初回セットアップ（Vercel）

所要時間は30分ほどです。

### 1. Vercel にプロジェクトを作る

1. https://vercel.com にログインし、「Add New → Project」から GitHub の `career-edu-soken-dashboard` を Import します。
2. この時点ではまだ Deploy しなくて大丈夫です（失敗しても問題ありません）。

### 2. データベース（Neon）をつなぐ

1. Vercel のプロジェクト画面 →「Storage」→「Create Database」→「Neon」を選びます。
2. リージョンは `Sydney` を選び（Tokyo は選べないため）、プランは Free のままで作成します。アプリの実行リージョンも `vercel.json` で Sydney（syd1）に合わせてあります。
3. プロジェクトに接続すると、環境変数 `DATABASE_URL` と `DATABASE_URL_UNPOOLED` が自動で入ります。

テーブルはデプロイ（ビルド）のたびに自動で作成・更新されます。

### 3. Google ログインの設定

1. https://console.cloud.google.com で新しいプロジェクトを作ります。
2. 「APIとサービス → OAuth 同意画面」で、ユーザーの種類を選びます。
   - 社員全員が会社の Google Workspace アカウントなら「内部」
   - 個人の Gmail も使うなら「外部」（テストユーザーに4名のメールを追加）
3. 「認証情報 → 認証情報を作成 → OAuth クライアント ID」で、種類は「ウェブアプリケーション」を選びます。
4. 「承認済みのリダイレクト URI」に次を追加します（Vercel のドメインに置き換え）。
   `https://<あなたのドメイン>.vercel.app/api/auth/callback/google`
5. 表示されたクライアント ID とクライアントシークレットを控えます。

### 4. 環境変数を入れる

Vercel のプロジェクト →「Settings → Environment Variables」で、次を追加します。

| 名前 | 値 |
|---|---|
| `AUTH_SECRET` | ランダムな文字列。https://generate-secret.vercel.app/32 で作れます |
| `AUTH_GOOGLE_ID` | 手順3のクライアント ID |
| `AUTH_GOOGLE_SECRET` | 手順3のクライアントシークレット |
| `ADMIN_EMAILS` | 最初にログインする人のメール（カンマ区切り）。初回ログイン時に「編集」権限で自動登録されます |
| `CRON_SECRET` | ランダムな文字列（日次処理の認証用） |

### 5. デプロイしてログイン

1. 「Deployments」から Redeploy します。
2. 発行された URL を開き、`ADMIN_EMAILS` に入れたアカウントでログインします。
3. 「設定」画面で残りのメンバーを追加します（CTO は権限「閲覧」）。登録されていないアカウントはログインできません。
4. 「設定」画面で今年度の目標契約人数を入力します。

> 社内の業務で使う場合、Vercel の規約上 Pro プラン（月20ドル）が必要です。Hobby プランは非商用の個人利用に限られています。

---

## 開発メモ

```bash
npm install
cp .env.example .env.local   # 値を入れる
npm run db:migrate           # テーブル作成
npm run dev
```

- ローカルでは `DEV_LOGIN_EMAIL` を設定すると、Google ログインなしでそのユーザーとして動きます（本番では無効）。
- `npm run db:seed-demo` で動作確認用のサンプルデータが入ります（本番DBでは実行しないこと）。
- テーブル定義は `src/db/schema.ts`、選択肢は `src/lib/options.ts`、業務ルールは `src/lib/domain.ts`、指標の計算は `src/lib/queries.ts` にあります。
- テーブル定義を変えたら `npm run db:generate` でマイグレーションを作り、コミットします。
