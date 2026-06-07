# Render 本番デプロイ ガイド

このドキュメントは、ローカルで構築したLINE順番待ちシステムを **Render (render.com)** へデプロイするための手順書です。

## 1. 準備事項

1. **GitHubリポジトリの作成**
   現在のプロジェクトフォルダ（`POKECA_SHOP`）をGitHubのリポジトリにPushしてください。
2. **Renderアカウントの作成**
   [Render](https://render.com/) にGitHubアカウントでログインします。

## 2. Renderへのデプロイ（Blueprintの利用）

このプロジェクトには `render.yaml` が含まれており、Infrastructure as Code（IaC）として自動でサーバーとデータベースをプロビジョニングできます。

1. Renderのダッシュボードにアクセスし、**「Blueprints」** メニューをクリックします。
2. **「New Blueprint Instance」** をクリックします。
3. デプロイしたいGitHubリポジトリを選択します。
4. 設定をそのまま進めると、`line-queue-system` (Web Service) と `line-queue-db` (PostgreSQL) の2つが自動的に作成されます。
5. Web Serviceが作成されたら、ダッシュボードで `line-queue-system` を開きます。

## 3. 環境変数の設定

デプロイ中にビルドが進みますが、以下の環境変数が設定されていないためエラーになる場合があります。
Web Serviceの **「Environment」** タブを開き、以下の環境変数を設定してください。

> [!IMPORTANT]
> `DATABASE_URL` と `NODE_ENV` は `render.yaml` によって自動的に設定・連携されています。以下のLINE関連のキーのみ手動で追加してください。

| Key | Value (設定値) | 取得元 |
| :--- | :--- | :--- |
| `LINE_CHANNEL_SECRET` | （例: `e524d9cc51...`） | LINE Developers: Messaging APIチャネルの「チャネル基本設定」 |
| `LINE_CHANNEL_ACCESS_TOKEN` | （例: `CyKRRP...`） | LINE Developers: Messaging APIチャネルの「Messaging API設定」 |
| `VITE_LIFF_ID` | （例: `2010316224-EHzt...`） | LINE Developers: LIFFアプリの「LIFF ID」 |

環境変数を設定して保存すると、自動的に再デプロイが行われます。

## 4. データベースのセットアップ（マイグレーション）

初回デプロイ時、データベースのテーブルがまだ作成されていないためエラーになることがあります。
Web Serviceの **「Shell」** タブを開き、以下のコマンドを実行してデータベースを構築してください。

```bash
npx prisma db push
```

成功すると、PostgreSQL上に `Queue` テーブルが作成されます。

## 5. LINE Developersの設定更新

Renderから割り当てられたURL（例: `https://line-queue-system.onrender.com`）をコピーし、LINE Developersのコンソールを更新します。

1. **LIFFエンドポイントURLの更新**
   * LINE Developers > LIFFアプリ > 「エンドポイントURL」を `https://line-queue-system.onrender.com/` に変更します。
2. **Webhook URLの更新**
   * LINE Developers > Messaging APIチャネル > 「Webhook URL」を `https://line-queue-system.onrender.com/api/webhook` に変更します。
   * 「検証」ボタンを押して成功することを確認します。

---

> [!TIP]
> **ローカル開発時の注意点**
> 今後ローカルで開発（`npm run dev`）を行う場合は、PostgreSQLデータベースが必要になります。
> 最も簡単な方法は、[Supabase](https://supabase.com/) または [Neon](https://neon.tech/) で無料のPostgreSQLデータベースを作成し、取得した接続文字列をローカルの `.env` ファイルに `DATABASE_URL="postgres://..."` として設定することです。
