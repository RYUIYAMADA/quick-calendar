/**
 * options.js — 設定ページのロジック
 *
 * 保存先: chrome.storage.local（APIキー等は chrome.storage で管理）
 * v3.0.0: GAS 項目削除。geminiApiKey + calendarId のみ。
 */

(async () => {
  const geminiApiKeyEl   = document.getElementById('geminiApiKey');
  const calendarIdEl     = document.getElementById('calendarId');
  const loginStatusEl    = document.getElementById('loginStatus');
  const btnGoogleLogin   = document.getElementById('btn-google-login');
  const btnSave          = document.getElementById('btn-save');
  const statusEl         = document.getElementById('status');

  // ── カレンダー一覧をロードしてドロップダウン更新 ──
  async function loadCalendars(token) {
    try {
      const res = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      const items = data.items || [];
      if (items.length === 0) return;

      const savedId = calendarIdEl.value;
      calendarIdEl.textContent = '';
      items.forEach(cal => {
        const opt = document.createElement('option');
        opt.value = cal.id;
        opt.textContent = cal.primary ? `${cal.summary}（メイン）` : cal.summary;
        calendarIdEl.appendChild(opt);
      });
      // 保存済み calendarId があれば選択
      if (savedId) calendarIdEl.value = savedId;
    } catch (e) {
      console.debug('[tasks-manager] options: カレンダー一覧取得失敗', e.message);
    }
  }

  // ── 保存済み値を読み込む ──
  const saved = await chrome.storage.local.get(['geminiApiKey', 'calendarId']);
  if (saved.geminiApiKey) geminiApiKeyEl.value = saved.geminiApiKey;
  if (saved.calendarId)   calendarIdEl.value   = saved.calendarId;

  // ── ログイン状態チェック ──
  async function checkLoginStatus() {
    try {
      await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(token);
        });
      }).then(async (token) => {
        loginStatusEl.textContent = 'ログイン済み ✓';
        loginStatusEl.className   = 'login-status-text ok';
        await loadCalendars(token);
      });
    } catch (_) {
      loginStatusEl.textContent = '未ログイン — 「Googleでログイン」を押してください';
      loginStatusEl.className   = 'login-status-text fail';
    }
  }

  await checkLoginStatus();

  // ── Googleログインボタン ──
  if (btnGoogleLogin) {
    btnGoogleLogin.addEventListener('click', async () => {
      loginStatusEl.textContent = 'ログイン中...';
      loginStatusEl.className   = 'login-status-text';
      btnGoogleLogin.disabled   = true;

      try {
        const token = await new Promise((resolve, reject) => {
          chrome.identity.getAuthToken({ interactive: true }, (t) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve(t);
          });
        });
        loginStatusEl.textContent = 'ログイン済み ✓';
        loginStatusEl.className   = 'login-status-text ok';
        await loadCalendars(token);
      } catch (e) {
        loginStatusEl.textContent = `ログイン失敗: ${e.message.substring(0, 80)}`;
        loginStatusEl.className   = 'login-status-text fail';
      } finally {
        btnGoogleLogin.disabled = false;
      }
    });
  }

  // ── 「初期設定をやり直す」リンク ──
  const btnWelcome = document.getElementById('btn-welcome');
  if (btnWelcome) {
    btnWelcome.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
    });
  }

  // ── 保存ボタン ──
  btnSave.addEventListener('click', async () => {
    statusEl.className   = '';
    statusEl.textContent = '';

    const geminiApiKey = geminiApiKeyEl.value.trim();
    const calendarId   = calendarIdEl.value || 'primary';

    if (!geminiApiKey) {
      statusEl.textContent = 'GEMINI_API_KEY を入力してください';
      statusEl.className   = 'error';
      return;
    }

    await chrome.storage.local.set({ geminiApiKey, calendarId });

    statusEl.textContent = '保存しました';
    statusEl.className   = 'ok';
    setTimeout(() => { statusEl.textContent = ''; statusEl.className = ''; }, 3000);
  });
})();
