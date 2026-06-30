# gas/ — Quick-calendar カレンダー書込ブリッジ

`Code.gs` を Google Apps Script にデプロイして、Chrome 拡張・macOS クイックアクションから Google カレンダーへ書き込めるようにする。

## デプロイ手順（概要）

詳細手順は [README.md#gas-setup](../README.md#gas-setup) を参照。

1. https://script.google.com で新規プロジェクトを作成
2. `Code.gs` の内容をエディタに全部コピー＆ペースト
3. スクリプトプロパティを設定（下表）
4. 「デプロイ」→「新しいデプロイ」→ 種類=ウェブアプリ / 実行ユーザー=自分 / アクセス=全員（匿名）→ デプロイ
5. 発行されたウェブアプリURLをクライアント（Chrome拡張 or クイックアクション）に設定

## Script Properties 一覧

| プロパティ | 必須 | 説明 |
|---|---|---|
| `API_TOKEN` | **必須** | クライアントの「GASトークン」と同じ値。生成例: `openssl rand -hex 32` |
| `CAL_PERSONAL` | 任意 | `personal` キー用カレンダーID。未設定なら主カレンダーに登録 |
| `CAL_WORK` | 任意 | `work` キー用カレンダーID。未設定なら主カレンダーに登録 |
| `CAL_<KEY>` | 任意 | 任意のキーに対応するカレンダーID（例: `CAL_FAMILY`）。未設定なら主カレンダー |

カレンダーIDの取得: Google カレンダー → 設定 → カレンダーの統合 → 「カレンダーID」

カレンダーIDの変更はコード編集不要。Script Properties を更新するだけで反映される。

## エンドポイント仕様

### POST — カレンダー書込

**リクエスト本文（JSON）**

```json
{
  "action": "createEvent",
  "token": "<API_TOKEN の値>",
  "title": "予定タイトル",
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "endTime": "HH:MM",
  "allDay": "false",
  "calendarKey": "personal",
  "location": "場所（任意）",
  "description": "メモ（任意）"
}
```

| フィールド | 必須 | 説明 |
|---|---|---|
| `action` | 必須 | `createEvent` 固定 |
| `token` | 必須 | Script Properties の `API_TOKEN` と一致する必要がある（fail-closed）|
| `title` | 必須 | 最大 500 文字 |
| `date` | 必須 | `YYYY-MM-DD` 形式 |
| `startTime` | 時刻指定時 | `HH:MM` 形式 |
| `endTime` | 任意 | 省略時は `startTime` の 1 時間後 |
| `allDay` | 任意 | `"true"` で終日予定。省略時は `false` |
| `calendarKey` | 任意 | `CAL_<KEY>` に対応するキー。未指定なら主カレンダー |
| `location` | 任意 | 最大 1000 文字 |
| `description` | 任意 | 最大 10000 文字 |

**レスポンス（成功）**

```json
{ "success": true, "calendar": "カレンダー名" }
```

**レスポンス（失敗）**

```json
{ "success": false, "error": "エラーメッセージ" }
```

### GET — 疎通確認のみ

状態を変えない。ヘルスチェック用。

**レスポンス**

```json
{ "status": "ok", "service": "quick-calendar-bridge" }
```
