# Quick-calendar — テキスト選択でGoogleカレンダーに即登録

選択したテキストをワンクリックで Google カレンダーに登録。Chrome拡張＋全Macアプリ対応。

**ランディングページ**: https://ryuiyamada.github.io/quick-calendar/

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

<img src="assets/onboarding.png" width="600" alt="初期設定3ステップ">

---

### STEP 2 — テキストを選択してボタンを押す

予定の情報が含まれたテキストを選択すると「カレンダーに追加」ボタンが表示される。

<img src="assets/select-button.png" width="600" alt="テキスト選択→予定を追加するボタン">

---

### STEP 3 — 内容を確認・編集

AIが解析した日時・タイトル・場所を確認。必要なら修正してから登録する。

<img src="assets/confirm.png" width="600" alt="確認ポップアップ">

---

### STEP 4 — Googleカレンダーに登録完了

ワンクリックで予定が登録される。

<img src="assets/result.png" width="600" alt="カレンダー登録完了">

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

1. `mac-quick-action/` 内のスクリプトをダウンロード
2. Automator でクイックアクションとして登録
3. Gemini API Key を設定

詳細: [mac-quick-action/README.md](mac-quick-action/README.md)

> **注意**: Gemini API Key と使用するカレンダーはそれぞれ自分のものを設定する必要があります。

---

## 技術スタック

- Gemini API（自然言語解析）
- Google Calendar API
- Chrome Extensions Manifest V3
- macOS Automator / Quick Actions

## ライセンス

MIT
