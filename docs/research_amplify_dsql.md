# 別エージェントの調査

## 質問
目標管理のダッシュボードみたいなページを今作ろうと思っていて、そこで目標の内容や期限などをDSQLに格納しておき、ログインユーザーごとにページを表示しようとしています。 なのでページを開くとそこに目標一覧が出てくる、みたいな感じにしたいんですができますか？

## 回答
できます。やり方は **「ログイン（Cognito）→ 認証付きREST API → LambdaでDSQL検索 → 目標一覧を返す → ダッシュボード表示」** です。

ポイントは、**ブラウザ（フロント）からDSQLへ直接つなぐのはやらない**ことです（IAM一時トークン＋TLS必須などが絡むので、サーバ側に寄せるのが安全＆現実的）。Aurora DSQL は **接続に一時的な認証トークン（パスワード代わり）**を使い ([AWS ドキュメント][1])、**すべての接続でTLSが必須**です ([AWS ドキュメント][2])。

---

## 全体構成（最短で動く）

1. **Amplify Gen2 Auth（Cognito User Pool）**でログイン
2. **Amplify Gen2 で API Gateway + Lambda のREST API**を作る（CDKで定義できる） ([docs.amplify.aws][3])
3. APIは **Cognito User Pool Authorizer** を付けて保護（Authorization: Bearer JWT）
4. Lambda は **Aurora DSQL公式コネクタ**でDSQLに接続して、ログインユーザーの `sub` で絞り込み ([AWS ドキュメント][4])
5. 返ってきた一覧をダッシュボードに表示

---

## DB設計（例：ユーザーごとに一覧を出す最小テーブル）

Cognito の **`sub`（ユーザー固有ID）** を `owner_sub` に保存して、それで検索します。

```sql
create table goals (
  id uuid primary key default gen_random_uuid(),
  owner_sub text not null,
  title text not null,
  description text,
  due_date date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_owner_due on goals(owner_sub, due_date);
```

---

## 認可（超重要）

Aurora DSQL は **IAMロールとPostgreSQLロールを関連付けて認可**します ([AWS ドキュメント][5])。
つまり Lambda 実行ロールに `dsql:DbConnect` を付けるだけでなく、**DSQL側で「このIAMロールはこのDBロールとして接続OK」**を設定する必要があります ([AWS ドキュメント][5])。

---

## Lambda（GET /goals）の実装イメージ

Cognito Authorizer を使うと、イベント内にJWTクレームが入るので、そこから `sub` を取り出して **必ずサーバ側で owner_sub を決め打ち**して検索します（クライアントに userId を送らせない）。

```ts
import type { APIGatewayProxyHandler } from "aws-lambda";
import { AuroraDSQLPool } from "@aws/aurora-dsql-node-postgres-connector";

const pool = new AuroraDSQLPool({
  host: process.env.DSQL_HOST!,   // xxxx.dsql.ap-northeast-1.on.aws
  user: process.env.DSQL_USER!,   // 例: app_user（adminは避けるの推奨）
  database: "postgres",
  max: 3,
});

export const handler: APIGatewayProxyHandler = async (event) => {
  const claims =
    (event.requestContext as any)?.authorizer?.jwt?.claims ??
    (event.requestContext as any)?.authorizer?.claims ??
    {};
  const sub = claims.sub;
  if (!sub) return { statusCode: 401, body: "Unauthorized" };

  const { rows } = await pool.query(
    `select id, title, description, due_date, status, created_at, updated_at
     from goals
     where owner_sub = $1
     order by due_date nulls last, created_at desc`,
    [sub]
  );

  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(rows),
  };
};
```

Aurora DSQL への接続は、Node.js向けに **IAM認証を透過化する公式コネクタ**が提供されています ([AWS ドキュメント][4])。

---

## フロント（ダッシュボード）で「ページを開いたら一覧」

ログイン後に、`fetchAuthSession()` で **IDトークン（JWT）**を取り、`Authorization` ヘッダーで REST API を叩けばOKです ([docs.amplify.aws][6])。Amplify の API カテゴリは、API Gateway の Cognito User Pools 認証にも対応しています ([docs.amplify.aws][7])。

```ts
import { fetchAuthSession } from "aws-amplify/auth";

export async function loadGoals() {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();

  const res = await fetch(process.env.NEXT_PUBLIC_GOALS_API_URL!, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}
```

---

## ここまでで「ユーザーごとの目標一覧」は実現できます

あとは同じ要領で、`POST /goals`（作成）、`PUT /goals/{id}`（更新）、`DELETE /goals/{id}` を追加すれば目標管理として一通り揃います。

もしよければ、あなたの前提に合わせて「最短で動く雛形」を具体化します。

* フロントは **Next.js（SSRあり）**？ **SPA（CSR）**？
* API は **REST（API Gateway）**でOK？（GraphQLは不要？）
  この2点だけ分かれば、Amplify Gen2 の `backend.ts`（Cognito Authorizer付きREST API定義）＋ functions 一式の形に落として提示できます。

[1]: https://docs.aws.amazon.com/ja_jp/aurora-dsql/latest/userguide/SECTION_authentication-token.html?utm_source=chatgpt.com "Amazon Aurora DSQL での認証トークンの生成"
[2]: https://docs.aws.amazon.com/aurora-dsql/latest/userguide/configure-root-certificates.html?utm_source=chatgpt.com "Configuring SSL/TLS certificates for Aurora DSQL ..."
[3]: https://docs.amplify.aws/react/build-a-backend/add-aws-services/rest-api/set-up-rest-api/ "Set up Amplify REST API - React - AWS Amplify Gen 2 Documentation"
[4]: https://docs.aws.amazon.com/aurora-dsql/latest/userguide/SECTION_program-with-dsql-connector-for-node-postgres.html?utm_source=chatgpt.com "Aurora DSQL Connector for node-postgres"
[5]: https://docs.aws.amazon.com/ja_jp/aurora-dsql/latest/userguide/authentication-authorization.html?utm_source=chatgpt.com "Aurora DSQL の認証および認可"
[6]: https://docs.amplify.aws/react/build-a-backend/add-aws-services/rest-api/customize-authz/?utm_source=chatgpt.com "Define authorization rules - React - AWS Amplify Gen 2 ..."
[7]: https://docs.amplify.aws/react/build-a-backend/add-aws-services/rest-api/?utm_source=chatgpt.com "API (REST) - React - AWS Amplify Gen 2 Documentation"
