# Project: quick-calendar

## 概要
選択したテキストをワンクリックで Google カレンダーに登録するツール。Gemini API が日時・場所・タイトルを自動解析し、GAS（Google Apps Script）Web アプリ経由でカレンダーに予定を作成する。Chrome 拡張（Manifest V3）と macOS クイックアクション（CLI）の2系統で、どのアプリのテキストにも対応する。配布物（拡張＋Macアクション＋ランディングページ）が同一リポジトリに同梱されている。

## 技術スタック（実態）
- **Chrome 拡張**: Manifest V3 / Service Worker（`background.js`, `type: module`）/ content script / Vanilla JS（ESM `import`）。ビルドツール・npm 依存なし（`package.json` なし）。
- **macOS クイックアクション**: Node.js ESM（`add-event.mjs`）。`osascript` でダイアログ・通知。拡張の `lib/parser.js`・`lib/gas-client.js` を動的 import で再利用。
- **AI 解析**: Gemini API（`gemini-2.5-flash`、`v1beta:generateContent`、`thinkingBudget: 0`、temperature 0.1）。
- **登録先**: GAS Web アプリへ JSON POST（`action: "createEvent"`、`token` 認証）→ Google Calendar。GAS 本体はこのリポジトリ外（別管理）。
- **ランディングページ**: 静的 HTML/CSS（`index.html` + `style.css`）。GitHub Pages 配信（https://ryuiyamada.github.io/quick-calendar/）。
- ライセンス: MIT。

## ディレクトリ構成
```
quick-calendar/
├── index.html, style.css       # ランディングページ（GitHub Pages）
├── README.md                   # プロダクト全体README
├── assets/                     # LP用スクショ画像（result/confirm/onboarding/select-button）
├── chrome-extension/
│   ├── manifest.json           # MV3 マニフェスト（version はここが正）
│   ├── background.js           # Service Worker: contextMenu / メッセージ受信 / GAS POST / 通知
│   ├── content.js              # 選択検知 → Shadow DOM フローティングボタン
│   ├── confirm.html/.js/.css   # 確認ポップアップ（解析結果の確認・編集・登録）
│   ├── options.html/.js/.css   # 設定ページ（APIキー・GAS URL・トークン）
│   ├── welcome.html/.js/.css   # 初回オンボーディング
│   ├── lib/parser.js           # Gemini プロンプト構築 + 呼び出し + 日付正規化
│   ├── lib/gas-client.js       # GAS createEvent POST クライアント
│   ├── icons/                  # icon16/48/128.png
│   ├── generate_icons.py       # アイコン再生成（Pillow）
│   └── config.defaults.example.json  # 設定テンプレ（*.local.json は .gitignore）
└── mac-quick-action/
    ├── add-event.mjs           # CLI 本体
    └── quick-action-bundle/    # Automator .workflow バンドル
```

## 命名・コーディング規則（実態）
- **言語**: コメント・ユーザー向け文字列・通知は日本語。変数・関数名は英語 camelCase。
- **モジュール**: ESM（`import`/`export`）。`lib/` の関数は named export（`parseWithGemini`, `createCalendarEvent`, `buildSystemPrompt`, `normalizeDate`）。
- **共有ロジックは一元化**: 解析（parser.js）と GAS 登録（gas-client.js）は拡張・Mac 両方から再利用する。**ロジックを二重実装しない**（Mac 側は拡張の lib を import する）。
- **ファイル冒頭にブロックコメントで役割・設計意図・移植元を明記**する既存スタイルを踏襲する。
- **設定キー名は固定**: `geminiApiKey` / `gasWebAppUrl` / `gasToken`（`chrome.storage.local` と `config.defaults.local.json` で同名）。変更時は background.js・options.js・add-event.mjs・README を同時更新。
- **ログ接頭辞**: `console.debug('[tasks-manager] ...')`（移植元アプリ名の名残。既存に合わせる）。
- **日付は常に `YYYY-MM-DD`（ローカル時刻）**。`date` フィールドに日本語相対表現（「明日」等）を入れない。年なし日付は過去ならロールオーバー（来年扱い）。

## 禁止事項（PJ固有）
- **秘密情報をコミットしない**: `config.defaults.local.json`（APIキー・GAS URL・トークン実値）は `.gitignore` 済み。README・コードに実値を書かない。example のみコミット。
- **content script で `innerHTML` を使わない**: 必ず `createElement` + `textContent`。選択テキストを DOM に描画しない。Shadow DOM（`mode: 'closed'`）でページ CSS と隔離する既存方針を崩さない。
- **`osascript` に可変値を文字列補間で渡さない**: add-event.mjs は静的 AppleScript を `-e` に置き、可変値は argv 経由（`item N of argv`）でのみ渡す。インジェクション防止のこの方式を維持する。
- **GAS レスポンスは `success === true` を厳密判定**してから成功扱いにする（HTML エラーページ・形式不正を成功と誤認しない）。
- **`registration_type` は常に `"event"` 固定**（このツールは予定登録専用。`"task"` を返させない）。
- **GAS 本体・別管理リソースを勝手に変更しない**（このリポジトリ外）。
- **Gemini モデル ID / プロンプトの絵文字カテゴリ・calendarKey 判定ルールを安易に変えない**（龍偉の業務分類に最適化済み。変更時は parser.js のルール全体と整合を取る）。
- **拡張バージョンの正本は `manifest.json` の `version`**。機能変更時はここを更新する。

## グローバル設定の継承
`~/.claude/CLAUDE.md` の全ルールを継承する（本ファイルは PJ 固有のみ記載）。特に:
- **plan 起点開発**（Explore → Plan → Code → Commit）。実装前に計画を外部化。
- **実装＝Claude Code（Sonnet / 難所 Opus）、レビュー＝Codex（全タスク必須・指摘ゼロまでループ・上限あり）**。自己レビュー禁止。
- **UI は itshover.com モノクロ線アイコン**・**CSS 値ハードコード禁止（CSS変数のみ）**・**認知負荷最小**（「読む負担を感じさせない、みてわかるレイアウト」）。
- **コードは綺麗・シンプル・高速**。YAGNI。サイズ判定・SPEC 要否・コミット作法はグローバル準拠。
- UI 実装時は本リポジトリの `DESIGN.md` を最優先で読む。
