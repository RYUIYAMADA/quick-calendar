/**
 * welcome.js — オンボーディングウィザード
 *
 * ステップ管理・入力収集・接続テスト・chrome.storage.local 保存
 * chrome.* が使えない環境（スタンドアロン表示）でもクラッシュしない
 *
 * v3.0.0: GAS 撤廃。Step2 を「Googleでログイン」ボタンに変更。
 *   必須設定は geminiApiKey のみ（+ Googleログイン済み）。
 */

'use strict';

// ── ユーティリティ ──────────────────────────────────────────────────────────

function storageGet(keys) {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return chrome.storage.local.get(keys);
  }
  return Promise.resolve({});
}

function storageSet(obj) {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return chrome.storage.local.set(obj);
  }
  return Promise.resolve();
}

function identityGetAuthToken(interactive) {
  if (typeof chrome === 'undefined' || !chrome.identity) {
    return Promise.reject(new Error('chrome.identity が利用できません'));
  }
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(token);
    });
  });
}

// ── DOM 参照 ────────────────────────────────────────────────────────────────

const panels = {
  1: document.getElementById('step-1'),
  2: document.getElementById('step-2'),
  3: document.getElementById('step-3'),
  done: document.getElementById('step-done'),
};

const dots = {
  1: document.getElementById('dot-1'),
  2: document.getElementById('dot-2'),
  3: document.getElementById('dot-3'),
};

const labels = {
  1: document.getElementById('label-1'),
  2: document.getElementById('label-2'),
  3: document.getElementById('label-3'),
};

const inputGemini         = document.getElementById('geminiApiKey');
const btnNext1            = document.getElementById('btn-next-1');
const btnBack2            = document.getElementById('btn-back-2');
const btnNext2            = document.getElementById('btn-next-2');
const btnBack3            = document.getElementById('btn-back-3');
const btnTest             = document.getElementById('btn-test');
const btnSave             = document.getElementById('btn-save');
const btnClose            = document.getElementById('btn-close');
const btnGoogleLogin      = document.getElementById('btn-google-login');
const loginStatusEl       = document.getElementById('login-status');
const calendarSelectArea  = document.getElementById('calendar-select-area');
const defaultCalendarEl   = document.getElementById('defaultCalendar');
const step2ErrorEl        = document.getElementById('step2-error');
const testGemini          = document.getElementById('test-gemini');
const testCalendar        = document.getElementById('test-calendar');

// ── ステップ切り替え ─────────────────────────────────────────────────────────

let currentStep   = 1;
let googleLoggedIn = false;  // ログイン成功フラグ

function showStep(step) {
  Object.values(panels).forEach(el => el && el.classList.remove('active'));
  const target = panels[step];
  if (target) target.classList.add('active');

  for (let i = 1; i <= 3; i++) {
    const dot = dots[i];
    const lbl = labels[i];
    if (!dot || !lbl) continue;

    dot.classList.remove('active', 'done');
    lbl.classList.remove('active', 'done');

    if (step === 'done') {
      dot.classList.add('done');
      lbl.classList.add('done');
    } else if (i < step) {
      dot.classList.add('done');
      lbl.classList.add('done');
    } else if (i === step) {
      dot.classList.add('active');
      lbl.classList.add('active');
    }
  }

  currentStep = step;
}

// ── バリデーション ───────────────────────────────────────────────────────────

function validateStep1() {
  return inputGemini.value.trim().length > 0;
}

// ── テスト結果表示 ───────────────────────────────────────────────────────────

function showTestResult(el, state, msg) {
  el.className = 'test-result show ' + state;
  el.textContent = msg;
}

function clearTestResults() {
  testGemini.className = 'test-result';
  testGemini.textContent = '';
  testCalendar.className = 'test-result';
  testCalendar.textContent = '';
  btnSave.disabled = true;
}

// ── Gemini 疎通テスト ─────────────────────────────────────────────────────────

async function testGeminiKey(apiKey) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + encodeURIComponent(apiKey);
  const body = {
    contents: [{ parts: [{ text: 'テスト' }] }],
    generationConfig: { maxOutputTokens: 16 },
    thinkingConfig: { thinkingBudget: 0 },
  };
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, networkError: true };
  }
  if (res.status !== 200) {
    return { ok: false, status: res.status };
  }
  try {
    const json = await res.json();
    if (json.candidates && json.candidates.length > 0) {
      return { ok: true };
    }
    return { ok: false, reason: 'no_candidates' };
  } catch (_) {
    return { ok: false, reason: 'parse_error' };
  }
}

// ── Google カレンダー連携テスト ───────────────────────────────────────────────

async function testCalendarAccess() {
  if (!googleLoggedIn) {
    return { ok: false, reason: 'not_logged_in' };
  }
  try {
    const token = await identityGetAuthToken(false);
    if (!token) return { ok: false, reason: 'no_token' };

    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json();
    if (data.items) return { ok: true };
    return { ok: false, reason: 'unexpected_format' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── 接続テスト実行 ────────────────────────────────────────────────────────────

async function runTests() {
  const apiKey = inputGemini.value.trim();

  clearTestResults();
  btnTest.disabled = true;

  showTestResult(testGemini,   'pending', '① Gemini API を確認中…');
  showTestResult(testCalendar, 'pending', '② Google カレンダー連携を確認中…');

  // ── Gemini テスト ──
  let geminiOk = false;
  const rGemini = await testGeminiKey(apiKey);
  if (rGemini.ok) {
    geminiOk = true;
    showTestResult(testGemini, 'ok', '① Gemini API: 接続成功');
  } else if (rGemini.networkError) {
    showTestResult(testGemini, 'fail', '① Gemini API: 通信エラー。ネットワーク接続を確認してください。');
  } else if (rGemini.status === 401 || rGemini.status === 403) {
    showTestResult(testGemini, 'fail', '① Gemini API: キーが無効です。正しい API キーを入力してください。');
  } else {
    showTestResult(testGemini, 'fail', '① Gemini API: 接続に失敗しました。API キーを確認してください。');
  }

  // ── カレンダーテスト ──
  let calendarOk = false;
  const rCal = await testCalendarAccess();
  if (rCal.ok) {
    calendarOk = true;
    showTestResult(testCalendar, 'ok', '② Google カレンダー: 連携成功');
  } else if (rCal.reason === 'not_logged_in') {
    showTestResult(testCalendar, 'fail', '② Google カレンダー: ログインしていません。ステップ2で「Googleでログイン」を押してください。');
  } else if (rCal.status === 401 || rCal.status === 403) {
    showTestResult(testCalendar, 'fail', '② Google カレンダー: 権限エラー。再度ログインしてください。');
  } else {
    showTestResult(testCalendar, 'fail', '② Google カレンダー: 接続に失敗しました。ステップ2をやり直してください。');
  }

  btnTest.disabled = false;

  if (geminiOk && calendarOk) {
    btnSave.disabled = false;
  }
}

// ── 保存 ─────────────────────────────────────────────────────────────────────

async function saveSettings() {
  const apiKey    = inputGemini.value.trim();
  const calId     = defaultCalendarEl ? defaultCalendarEl.value : 'primary';

  await storageSet({
    geminiApiKey: apiKey,
    calendarId:   calId || 'primary',
  });

  showStep('done');
}

// ── Googleログインボタン ──────────────────────────────────────────────────────

async function handleGoogleLogin() {
  loginStatusEl.className   = 'login-status';
  loginStatusEl.textContent = 'ログイン中...';
  btnGoogleLogin.disabled   = true;

  try {
    const token = await identityGetAuthToken(true);
    if (!token) throw new Error('トークンの取得に失敗しました');

    // カレンダー一覧を取得してドロップダウンを構築
    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50',
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      throw new Error(`カレンダー一覧取得失敗 (${res.status})`);
    }

    const data = await res.json();
    const calendars = data.items || [];

    // ドロップダウンを更新
    if (defaultCalendarEl) {
      defaultCalendarEl.textContent = '';
      calendars.forEach(cal => {
        const opt = document.createElement('option');
        opt.value = cal.id;
        opt.textContent = cal.primary ? `${cal.summary}（メイン）` : cal.summary;
        defaultCalendarEl.appendChild(opt);
      });
    }

    // 連携済み表示
    loginStatusEl.textContent = '連携済み ✓ Googleアカウントと接続しました';
    loginStatusEl.className   = 'login-status ok';
    googleLoggedIn = true;
    btnNext2.disabled = false;

    // カレンダー選択を表示
    if (calendarSelectArea) {
      calendarSelectArea.classList.remove('hidden');
    }

    // エラー表示クリア
    if (step2ErrorEl) {
      step2ErrorEl.textContent = '';
      step2ErrorEl.classList.add('hidden');
    }

  } catch (e) {
    loginStatusEl.textContent = `ログインに失敗しました: ${e.message.substring(0, 80)}`;
    loginStatusEl.className   = 'login-status fail';
    googleLoggedIn = false;
    btnNext2.disabled = true;
    console.error('[tasks-manager] Google ログイン失敗:', e.message);
  } finally {
    btnGoogleLogin.disabled = false;
  }
}

// ── イベントリスナー ──────────────────────────────────────────────────────────

btnNext1.addEventListener('click', () => {
  if (!validateStep1()) {
    inputGemini.focus();
    return;
  }
  showStep(2);
});

btnBack2.addEventListener('click', () => showStep(1));

btnNext2.addEventListener('click', () => {
  if (!googleLoggedIn) {
    if (step2ErrorEl) {
      step2ErrorEl.textContent = '「Googleでログイン」ボタンを押してカレンダー連携を完了してください。';
      step2ErrorEl.classList.remove('hidden');
    }
    return;
  }
  if (step2ErrorEl) {
    step2ErrorEl.textContent = '';
    step2ErrorEl.classList.add('hidden');
  }
  clearTestResults();
  showStep(3);
});

btnBack3.addEventListener('click', () => showStep(2));

btnTest.addEventListener('click', runTests);

btnSave.addEventListener('click', saveSettings);

if (btnGoogleLogin) {
  btnGoogleLogin.addEventListener('click', handleGoogleLogin);
}

btnClose.addEventListener('click', () => {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.getCurrent(t => {
      if (t) {
        chrome.tabs.remove(t.id);
      } else if (typeof window !== 'undefined') {
        window.close();
      }
    });
  } else if (typeof window !== 'undefined') {
    window.close();
  }
});

// ── 初期化: 既存の storage 値を入力欄に事前入力 ────────────────────────────

(async () => {
  const cur = await storageGet(['geminiApiKey', 'calendarId']);
  if (cur.geminiApiKey) inputGemini.value = cur.geminiApiKey;

  // ログイン済みかサイレントで確認
  try {
    const token = await identityGetAuthToken(false);
    if (token) {
      googleLoggedIn = true;
      loginStatusEl.textContent = '連携済み ✓ ログイン済みです';
      loginStatusEl.className   = 'login-status ok';
      btnNext2.disabled = false;

      // カレンダー一覧を取得
      const res = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        const calendars = data.items || [];
        if (defaultCalendarEl && calendars.length > 0) {
          defaultCalendarEl.textContent = '';
          calendars.forEach(cal => {
            const opt = document.createElement('option');
            opt.value = cal.id;
            opt.textContent = cal.primary ? `${cal.summary}（メイン）` : cal.summary;
            defaultCalendarEl.appendChild(opt);
          });
          if (cur.calendarId) defaultCalendarEl.value = cur.calendarId;
        }
        if (calendarSelectArea) calendarSelectArea.classList.remove('hidden');
      }
    }
  } catch (_) {
    // サイレント失敗は無視
  }
})();
