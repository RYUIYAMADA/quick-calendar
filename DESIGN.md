---
project: quick-calendar
version: 0.1.0
inherits: ryuiyamada-design-system（グローバルDS）
updated: 2026-06-18
---

# DESIGN.md — quick-calendar

> このファイルは Claude Code / Codex が UI を作るとき**毎回最初に読む**設計契約。
> グローバルDS（`~/Desktop/ryui-workspace/projects/tools/ryuiyamada-design-system/`）を継承し、
> **このプロジェクト固有の差分だけ**ここに書く。global と矛盾する時はこのファイルが優先。

## 1. このプロダクトは何か
- 何をするものか: 選択テキストから AI が日時・場所・タイトルを解析し、ワンクリックで Google カレンダーに予定登録する。
- 主な利用者: 龍偉（秋田ノーザンハピネッツ マーケ/フォト/データ分析＋ボートコーチ）。メール・Slack・LINE・告知文から素早く予定を拾う人。
- 利用デバイス/環境: **PC（Chrome 拡張のポップアップ / macOS デスクトップアプリ）**が主。ランディングページのみ PC・スマホ両対応。
- トーン: 落ち着いた業務用。**速い・迷わない・最小手数**。装飾より機能性。

## 2. デザイン原則（守るべき判断軸）
1. **手数を増やさない** — 確認ポップアップは「見て→直して→登録」で完結。入力欄やステップを増やさない。
2. **解析失敗してもユーザーは止まらない** — AI が失敗しても確認画面は必ず開き、手動編集→登録できる導線を残す（background.js の既存方針）。
3. **ページに干渉しない** — content script のボタンは Shadow DOM（closed）で完全隔離し、表示サイトの CSS・レイアウトを一切壊さない。
4. **2つの UI 面を意識する** — ①拡張UI（confirm/options/welcome）= 実用ツール、②ランディングページ = 訴求。トーンは共通だがトークンが異なる（§3 参照）。

## 3. トークン（機械可読・必ず正確な値で）
このプロジェクトには**2系統のトークンが現存する**。新規実装では下記の「正」に揃える。global と同じものは「global準拠」と記す。

### ⚠️ 現状の不整合（要確認・将来統一すべき）
- **拡張UI（confirm.css / welcome.css / options.css）の accent = `#1a56db`（青）**
- **ランディングページ（style.css）の accent = `#073365`（ネイビー）**
- LP は「まとめサイトと配色統一」のためネイビーへ寄せた経緯（git: 8d125cd）。拡張UIは旧来の青のまま。
- 方針（未確定・要確認）: 最終的にどちらかへ統一すべき。**既存ファイルを直す時はそのファイル内の既存変数に従い、勝手に色を混ぜない**。統一作業は別途 PM 判断で行う。

### 拡張UI トークン（confirm.css / welcome.css / options.css）
```css
--color-bg:        #ffffff;
--color-surface:   #f5f5f5;
--color-border:    #e0e0e0;
--color-text:      #1a1a1a;
--color-text-sub:  #555555;
--color-accent:    #1a56db;   /* 主要アクション・CTA */
--color-accent-hv: #1344b8;
--color-danger:    #c0392b;   --color-danger-hv: #a93226;
--color-success:   #1e8e3e;
--radius:          6px;
--font:            'Noto Sans JP', system-ui, sans-serif;   /* body 13px */
```

### ランディングページ トークン（style.css）
```css
--color-bg:        #ffffff;   --color-surface: #f2f2f2;  --color-surface2: #ede8e4;
--color-border:    #e2ddd7;   --color-text: #333333;     --color-text-sub: #858585;
--color-accent:    #073365;   --color-accent-hv: #052748;   /* ネイビー */
--color-orange:    #f7581d;   /* 差し色・最低限のみ */
--color-success:   #1e8e3e;
--radius: 8px;  --radius-lg: 14px;
--font:  'Noto Sans JP', system-ui, -apple-system, sans-serif;   /* body 15px */
--max-width: 880px;
```

## 4. コンポーネント規約
- **Button**: primary = accent 背景 + 白文字（confirm の「登録」/ LP の CTA）。hover で `-hv` に。**1画面に primary は1つ**（登録 or 主要CTA）。キャンセル/破壊系は danger 系または地色。disabled は明示的に薄く。
- **Input（options/confirm）**: ラベルは入力欄の上。focus リング必須（focus-visible）。エラーは赤系テキストで欄直下に短文。APIキー等の秘密値はマスク表示を検討。
- **Card（LP value-card / env-card）**: 白背景 + `--shadow-sm/md`。border は最小限（過剰な枠線禁止）。角丸は `--radius`/`--radius-lg`。
- **フローティングボタン（content.js）**: 固定ラベル「予定を追加する」のみ。選択テキストを描画しない。Shadow DOM 内に閉じる。

## 5. レイアウト規約
- **拡張ポップアップ**: confirm は固定サイズ想定（windows.create で width 420 / height 560）。狭い領域なので情報密度は中、縦スクロール最小。
- **options / welcome**: `max-width: 520px` 中央寄せ。3項目設定を一覧で見せる。
- **ランディングページ**: `max-width: 880px`、`section { padding: 80px 0 }`。STEP は左右交互（reverse）レイアウト。スマホで1カラムに落とす。
- 情報密度: 拡張UI=実務的に中密度 / LP=ゆったり（訴求のため余白広め）。

## 6. 禁止ルール（anti-pattern・最重要）
- 色・余白・フォントサイズを変数でなく**素の値でハードコードする** → 禁止（CSS変数のみ）。
- **グラデーション / glassmorphism / 円グラフ / border 過剰 / font-weight 300以下** → 禁止（style.css 冒頭に明記済みの方針）。
- **拡張UIとLPのトークンを混在させる**（青とネイビーを1ファイルで混ぜる）→ 禁止。そのファイルの既存変数に従う。
- **content script で選択テキストを画面に描画する / innerHTML を使う** → 禁止（セキュリティ）。
- **絵文字をUIの構造ラベルに使う** → 禁止。ただし**カレンダー予定タイトル先頭のカテゴリ絵文字（🏀📊📸🚣🤝📝🏥✉️📦）は仕様**であり、これは parser.js のデータ仕様として保持する（UI装飾とは別物）。
- アイコンは itshover.com モノクロ線（`fill:none; stroke:currentColor`）。塗りつぶし・多色・3D・絵文字調アイコン禁止。

## 7. アクセシビリティ（必須ライン）
- コントラスト比 WCAG AA（本文 4.5:1・大文字 3:1）。accent と白文字の組み合わせは AA を満たすこと。
- フォーカス可視（focus-visible リング必須）。確認ポップアップはキーボードのみで登録/キャンセルまで到達できること。
- タップ/クリックターゲット最小 44×44px（フローティングボタン含む）。
- 日本語は文節改行・禁則処理（global準拠）。

## 8. Do / Don't
| ✅ Do | ❌ Don't |
|---|---|
| confirm を「確認→編集→登録」3要素に絞る | 確認画面に詳細フォームを増やしてステップを増やす |
| そのファイルの既存 `--color-accent` を使う | LP に拡張UIの青を持ち込む（逆も同様） |
| content のボタンは Shadow DOM 内に閉じる | ページ DOM に直接 `<style>`/`<button>` を差し込む |
| 解析失敗でも編集可能な確認画面を出す | 解析できないと何も表示せず終了する |
| アイコンは線アイコン（stroke）で統一 | 塗り/多色/絵文字アイコンを混ぜる |

## 9. AI（Claude/Codex）への指示
- UI 実装前に必ずこのファイルと global DS を読む。**触る対象が拡張UIか LP かを先に判定**し、対応するトークン群（§3）だけを使う。
- トークンは変数参照（素の値禁止）。§6 の禁止ルールに違反したら自己修正。
- 「読む負担を感じさせない、みてわかるレイアウト」を全画面のデフォルト前提にする。
- accent の青/ネイビー不整合（§3）に気づいても、**指示なく統一しない**。統一が必要なら実装を止めて PM に確認する。
- 迷ったら §2 デザイン原則で判断。それでも決まらなければ実装を止めて PM に質問。

## 📜 更新履歴
- 2026-06-18 — 初版。実態（拡張UI=青 / LP=ネイビーの2系統トークン、Shadow DOM 隔離、確認3要素方針）を反映。
