# Quick-calendar — テキスト選択でGoogleカレンダーに即登録

選択したテキストをワンクリックで Google カレンダーに登録。Chrome拡張＋全Macアプリ対応。

**ランディングページ**: https://ryuiyamada.github.io/yotei-tsuika-lp/

---

## これは何ができる?

- **どのアプリでも使える** — Chrome・Slack・LINE・メール・メモ帳など、テキストが表示されているアプリ全てに対応
- **AIが日時・場所・タイトルを自動解析** — 「来週月曜14時 渋谷で打合せ」のような自然な文章から予定を作成
- **ワンクリック登録** — テキストを選択 → ボタンを押す → 確認 → 完了の4ステップ
- **無料枠で1日1,500回** — Gemini API の無料枠で十分に運用可能

---

## 使い方（4ステップ）

### STEP 1 — 初期設定

拡張機能またはクイックアクションをインストールし、API キーとカレンダーを設定する。

<img src="landing-page/assets/onboarding.png" width="600" alt="初期設定3ステップ">

---

### STEP 2 — テキストを選択してボタンを押す

予定の情報が含まれたテキストを選択すると「カレンダーに追加」ボタンが表示される。

<img src="landing-page/assets/select-button.png" width="600" alt="テキスト選択→予定を追加するボタン">

---

### STEP 3 — 内容を確認・編集

AIが解析した日時・タイトル・場所を確認。必要なら修正してから登録する。

<img src="landing-page/assets/confirm.png" width="600" alt="確認ポップアップ">

---

### STEP 4 — Googleカレンダーに登録完了

ワンクリックで予定が登録される。

<img src="landing-page/assets/result.png" width="600" alt="カレンダー登録完了">

---

## 対応環境

| 方法 | 対応範囲 |
|---|---|
| Chrome拡張 | Chrome上のWebページ（Gmail・Notion・Slackウェブ版など） |
| macOSクイックアクション | Chrome以外のデスクトップアプリ全般（Slack・メモ・メール等） |

---

## セットアップ

### Chrome拡張

1. このリポジトリをダウンロード（またはクローン）
2. Chrome → `設定` → `拡張機能` → `デベロッパーモード ON` → `パッケージ化されていない拡張機能を読み込む`
3. `chrome-extension/` フォルダを選択
4. 拡張機能のオプションで Gemini API Key と使用するカレンダーを設定

詳細: [chrome-extension/README.md](chrome-extension/README.md)

### macOSクイックアクション

1. `desktop-quickaction/` 内のスクリプトをダウンロード
2. Automator でクイックアクションとして登録
3. Gemini API Key を設定

詳細: [desktop-quickaction/README.md](desktop-quickaction/README.md)

> **注意**: Gemini API Key と使用するカレンダーはそれぞれ自分のものを設定する必要があります。

---

<a id="gas-setup"></a>
### GAS ウェブアプリ（カレンダー書込ブリッジ）

Chrome 拡張・macOS クイックアクションから Google カレンダーへ書き込むために、Google Apps Script (GAS) を一度だけセットアップする必要がある。

1. **GASプロジェクトを新規作成**  
   https://script.google.com を開き、「新しいプロジェクト」をクリック。

2. **コードを貼り付け**  
   エディタ内の既存コードをすべて削除し、`gas/Code.gs` の内容をコピー＆ペースト。  
   任意で `gas/appsscript.json` のタイムゾーン設定も反映できる。

3. **スクリプトプロパティを設定**  
   「プロジェクトの設定」→「スクリプトプロパティ」で以下を追加。

   | プロパティ | 必須 | 説明 |
   |---|---|---|
   | `API_TOKEN` | **必須** | クライアントの「GASトークン」と同じ値。生成例: `openssl rand -hex 32` |
   | `CAL_PERSONAL` | 任意 | `personal` キー用カレンダーID。未設定なら主カレンダーに登録 |
   | `CAL_WORK` | 任意 | `work` キー用カレンダーID。未設定なら主カレンダーに登録 |
   | `CAL_<KEY>` | 任意 | 任意キー用カレンダーID（例: `CAL_FAMILY`）。未設定なら主カレンダー |

   > カレンダーIDの取得: Google カレンダー → 設定 → カレンダーの統合 → 「カレンダーID」  
   > **カレンダーIDの差し替えはコード編集不要。** Script Properties を更新するだけで反映される。

4. **デプロイ**  
   「デプロイ」→「新しいデプロイ」→ 種類 = **ウェブアプリ** / 実行ユーザー = **自分** / アクセス = **全員（匿名）** → 「デプロイ」。  
   発行された **ウェブアプリURL** をコピー。

5. **クライアントに入力**  
   Chrome 拡張のオプション（または macOS クイックアクションの config）に「GASウェブアプリURL」と「GASトークン（= `API_TOKEN` と同値）」を入力して保存。

詳細: [gas/README.md](gas/README.md)

---

## 技術スタック

- Gemini API（自然言語解析）
- Google Calendar API
- Chrome Extensions Manifest V3
- macOS Automator / Quick Actions

## ライセンス

MIT
