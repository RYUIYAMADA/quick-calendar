/**
 * lib/calendar-client.js — Google Calendar API 直接クライアント
 *
 * GAS を介さず chrome.identity.getAuthToken で OAuth トークンを取得し
 * Calendar REST API v3 を直接呼ぶ。
 *
 * meetUrl・description 先頭配置ロジックは旧 gas-client.js と同一仕様を維持。
 */

const MAX_DESC = 10000;

/**
 * OAuth トークンを取得する
 * @param {boolean} interactive - true: ログインダイアログを表示 / false: サイレント試行
 * @returns {Promise<string>} アクセストークン
 */
export function getToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!token) {
        reject(new Error('トークンの取得に失敗しました。Googleでログインしてください。'));
        return;
      }
      resolve(token);
    });
  });
}

/**
 * キャッシュされた不正トークンを削除して再取得を促す
 * @param {string} token
 */
export function removeCachedToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, resolve);
  });
}

/**
 * ユーザーのカレンダー一覧を取得する
 * @returns {Promise<Array<{id:string, summary:string, primary:boolean}>>}
 */
export async function listCalendars() {
  const token = await getToken(false);
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50',
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (res.status === 401 || res.status === 403) {
    await removeCachedToken(token);
    throw new Error(`カレンダー一覧取得失敗 (${res.status}): 再ログインが必要です`);
  }

  if (!res.ok) {
    throw new Error(`カレンダー一覧取得失敗 (${res.status})`);
  }

  const data = await res.json();
  return (data.items || []).map(item => ({
    id:      item.id,
    summary: item.summary,
    primary: item.primary === true
  }));
}

/**
 * Google Calendar にイベントを作成する
 * @param {object} parsed   - confirm ポップアップで編集済みの予定データ
 *   {title, date, startTime, endTime, allDay, calendarId, location, description, meetUrl}
 * @returns {Promise<{ok:boolean, error?:string, htmlLink?:string}>}
 */
export async function createEvent(parsed) {
  // ── description: meetUrl を先頭に配置（URL保全・末尾切捨て禁止）──
  const descBody  = parsed.description || '';
  const meetUrl   = parsed.meetUrl || '';
  const urlPrefix = (meetUrl && !descBody.includes(meetUrl)) ? meetUrl + '\n' : '';
  const bodyLimit = Math.max(0, MAX_DESC - urlPrefix.length);
  const description = urlPrefix + descBody.slice(0, bodyLimit);

  // ── 日時フィールド組み立て ──
  let start, end;
  if (parsed.allDay || !parsed.startTime) {
    start = { date: parsed.date };
    if (parsed.endTime && /^\d{4}-\d{2}-\d{2}$/.test(parsed.endTime)) {
      // 複数日終日: 明示終了日をそのまま使う
      end = { date: parsed.endTime };
    } else {
      // 1日終日: 翌日をローカル日付で生成（toISOString は UTC → 日付ズレの恐れがあるため使わない）
      const d = new Date(parsed.date + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      const y  = d.getFullYear();
      const m  = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      end = { date: `${y}-${m}-${dd}` };
    }
  } else {
    const tz = 'Asia/Tokyo';
    start = { dateTime: `${parsed.date}T${parsed.startTime}:00`, timeZone: tz };
    if (parsed.endTime) {
      end = { dateTime: `${parsed.date}T${parsed.endTime}:00`, timeZone: tz };
    } else {
      // endTime 未指定 → 開始 +1 時間でフォールバック
      const [hh, mm] = parsed.startTime.split(':').map(Number);
      const startMs  = new Date(`${parsed.date}T${parsed.startTime}:00`).getTime();
      const endMs    = startMs + 60 * 60 * 1000;
      const ed       = new Date(endMs);
      const eh       = String(ed.getHours()).padStart(2, '0');
      const emin     = String(ed.getMinutes()).padStart(2, '0');
      const edate    = `${ed.getFullYear()}-${String(ed.getMonth()+1).padStart(2,'0')}-${String(ed.getDate()).padStart(2,'0')}`;
      end = { dateTime: `${edate}T${eh}:${emin}:00`, timeZone: tz };
    }
  }

  const body = {
    summary:     parsed.title       || '',
    location:    parsed.location    || undefined,
    description: description        || undefined,
    start,
    end
  };

  // undefined フィールドを除去
  Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);

  const calendarId = encodeURIComponent(parsed.calendarId || 'primary');
  const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;

  // ── トークン取得（サイレント優先・なければインタラクティブ）──
  let token;
  try {
    token = await getToken(false);
  } catch (_) {
    token = await getToken(true);
  }

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (res.status === 401 || res.status === 403) {
    await removeCachedToken(token);
    const errText = await res.text().catch(() => '');
    return { ok: false, error: `認証エラー (${res.status}): 再ログインが必要です。${errText.slice(0, 100)}` };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { ok: false, error: `登録失敗 (${res.status}): ${errText.slice(0, 200)}` };
  }

  const data = await res.json();
  return { ok: true, htmlLink: data.htmlLink };
}
