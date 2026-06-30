/**
 * Code.gs — Quick-calendar カレンダー書込ブリッジ（公開版）
 *
 * 役割: Chrome 拡張 / macOS クイックアクションから送られてくる
 *       createEvent POST を受け取り、Google カレンダーに予定を登録するだけ。
 *
 * ★ セキュリティ設計
 *   1. createEvent は POST のみ。fail-closed（API_TOKEN 未設定 or 不一致は必ず拒否）
 *   2. doGet は状態を変えない。ヘルスチェック JSON を返すだけ
 *   3. 入力は型・形式・サイズを GAS 側でも検証（クライアントを信用しない）
 *
 * ★ セットアップ（GASエディタ → プロジェクトの設定 → スクリプトプロパティ）
 *   - API_TOKEN     : 必須。クライアントの「GASトークン」と同じ値（生成例: openssl rand -hex 32）
 *   - CAL_PERSONAL  : 任意。personal 用カレンダーID。未設定ならデフォルト（主）カレンダー
 *   - CAL_WORK      : 任意。work 用カレンダーID。未設定ならデフォルト（主）カレンダー
 *   - CAL_<KEY>     : 任意。任意の calendarKey に対応するカレンダーID
 *   カレンダーIDは Google カレンダー → 設定 → 「カレンダーの統合」→ カレンダーID で取得
 */

// 入力サイズ上限（クライアントの 10000 字制限と整合・GAS側でも担保）
var MAX_TITLE = 500;
var MAX_LOCATION = 1000;
var MAX_DESCRIPTION = 10000;
// リクエスト本文全体の上限（description上限 + 他フィールド + JSONオーバーヘッド）。
// 認証・パース前にこのサイズで足切りし、未認証の巨大POSTを拒否する。
var MAX_BODY_BYTES = 20000;
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
var TIME_RE = /^\d{1,2}:\d{2}$/;

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST: createEvent のみ受け付ける（fail-closed 認証）
 */
function doPost(e) {
  try {
    // 1) 本文の存在とサイズを認証・パース前に検証（未認証の巨大POSTで資源を消費させない）
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ success: false, error: 'empty request body' });
    }
    var contents = e.postData.contents;
    if (contents.length > MAX_BODY_BYTES) {
      return jsonOut({ success: false, error: 'request body too large' });
    }

    // 2) パース（token 取り出しに必要・ロックはまだ取らない）
    var body;
    try {
      body = JSON.parse(contents);
    } catch (parseErr) {
      return jsonOut({ success: false, error: 'invalid JSON body' });
    }

    // 3) 認証を最優先（fail-closed）。API_TOKEN 未設定 or 不一致なら、action 判定にもロックにも到達させない
    var apiToken = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
    if (!apiToken || !body || body.token !== apiToken) {
      return jsonOut({ success: false, error: 'unauthorized: createEvent requires a valid API token' });
    }

    // 4) 認証後にアクション判定
    if (body.action !== 'createEvent') {
      return jsonOut({ success: false, error: 'unsupported action' });
    }

    // 5) 認証済みのリクエストにだけロックを取る（二重登録防止）
    var lock = LockService.getScriptLock();
    try { lock.waitLock(5000); } catch (lockErr) {
      return jsonOut({ success: false, error: 'busy: could not acquire lock' });
    }
    try {
      return createCalendarEvent(body);
    } finally {
      lock.releaseLock();
    }
  } catch (outerErr) {
    console.error('[doPost] ' + outerErr);
    return jsonOut({ success: false, error: 'internal error' });
  }
}

/**
 * GET: 状態を変えない。疎通確認のみ。
 */
function doGet() {
  return jsonOut({ status: 'ok', service: 'quick-calendar-bridge' });
}

/**
 * calendarKey → Calendar を解決。
 * スクリプトプロパティ CAL_<KEY> があればそのカレンダー、無ければデフォルト（主）カレンダー。
 */
function resolveCalendar(calendarKey) {
  var props = PropertiesService.getScriptProperties();
  var key = (calendarKey || '').toString().toUpperCase().replace(/[^A-Z0-9_]/g, '');
  var calId = key ? props.getProperty('CAL_' + key) : '';
  if (calId) {
    var cal = CalendarApp.getCalendarById(calId);
    if (cal) return cal;
  }
  return CalendarApp.getDefaultCalendar();
}

/**
 * 予定を作成。入力は型・形式・サイズを検証する。
 * body: { title, date(YYYY-MM-DD), startTime(HH:MM), endTime(HH:MM),
 *         allDay('true'|'false'), calendarKey, location, description }
 */
function createCalendarEvent(body) {
  try {
    var title       = (body.title       || '').toString();
    var dateStr     = (body.date        || '').toString();
    var startTime   = (body.startTime   || '').toString();
    var endTime     = (body.endTime     || '').toString();
    var allDay      = String(body.allDay) === 'true';
    var calendarKey = (body.calendarKey || '').toString();
    var location    = (body.location    || '').toString();
    var description = (body.description  || '').toString();

    // 必須・サイズ検証
    if (!title)                          return jsonOut({ success: false, error: 'title is required' });
    if (title.length > MAX_TITLE)        return jsonOut({ success: false, error: 'title too long' });
    if (location.length > MAX_LOCATION)  return jsonOut({ success: false, error: 'location too long' });
    if (description.length > MAX_DESCRIPTION) return jsonOut({ success: false, error: 'description too long' });
    if (!dateStr)                        return jsonOut({ success: false, error: 'date is required' });

    // 日付検証（厳密に YYYY-MM-DD のみ。'2026-07-01xxx' 等を弾く）
    if (!DATE_RE.test(dateStr)) return jsonOut({ success: false, error: 'invalid date format' });
    var parts = dateStr.split('-');
    var year  = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    var day   = parseInt(parts[2], 10);
    var date  = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return jsonOut({ success: false, error: 'invalid date: ' + dateStr });
    }

    var cal  = resolveCalendar(calendarKey);
    var opts = { location: location, description: description };

    if (allDay) {
      cal.createAllDayEvent(title, date, opts);
    } else {
      if (!startTime || !TIME_RE.test(startTime)) {
        return jsonOut({ success: false, error: 'invalid startTime: ' + startTime });
      }
      var sp = startTime.split(':');
      var sh = parseInt(sp[0], 10);
      var sm = parseInt(sp[1], 10);
      if (isNaN(sh) || isNaN(sm) || sh < 0 || sh > 23 || sm < 0 || sm > 59) {
        return jsonOut({ success: false, error: 'invalid startTime: ' + startTime });
      }
      var start = new Date(year, month - 1, day, sh, sm, 0, 0);

      var end;
      if (endTime) {
        if (!TIME_RE.test(endTime)) {
          return jsonOut({ success: false, error: 'invalid endTime: ' + endTime });
        }
        var ep = endTime.split(':');
        var eh = parseInt(ep[0], 10);
        var em = parseInt(ep[1], 10);
        if (isNaN(eh) || isNaN(em) || eh < 0 || eh > 23 || em < 0 || em > 59) {
          return jsonOut({ success: false, error: 'invalid endTime: ' + endTime });
        }
        end = new Date(year, month - 1, day, eh, em, 0, 0);
        if (end < start) {
          // 日跨ぎ（例: 23:30開始 + 00:30終了）→ 終了を翌日扱い
          end.setDate(end.getDate() + 1);
        } else if (end.getTime() === start.getTime()) {
          // 開始＝終了（ゼロ長）→ 24時間化を避けデフォルト1時間
          end = new Date(start.getTime() + 60 * 60 * 1000);
        }
      } else {
        end = new Date(start.getTime() + 60 * 60 * 1000); // デフォルト1時間
      }
      cal.createEvent(title, start, end, opts);
    }

    return jsonOut({ success: true, calendar: cal.getName() });
  } catch (err) {
    // 内部例外の詳細（権限・設定不備等）は外部に返さずログのみ
    console.error('[createCalendarEvent] ' + err);
    return jsonOut({ success: false, error: 'failed to create event' });
  }
}
