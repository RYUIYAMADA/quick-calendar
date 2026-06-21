/**
 * confirm.js — 確認ポップアップのロジック
 *
 * セキュリティ: innerHTML に外部テキストを入れない。value / textContent のみ使用。
 * CSP: インラインstyle禁止。スタイルは全て confirm.css のクラスで管理。
 *
 * フロー:
 *   1. 開いた直後: カレンダー一覧を取得しドロップダウンを動的生成 + 「解析中...」を表示
 *   2. background に { type: 'parse-text' } を送信 → Gemini 解析
 *   3. 成功: フォームに値をセット
 *   4. 失敗: エラー表示 + 選択テキストを本文欄に入れ手動編集できる状態にする
 */

(async () => {
  const titleEl       = document.getElementById('title');
  const dateEl        = document.getElementById('date');
  const calendarEl    = document.getElementById('calendar');
  const startTimeEl   = document.getElementById('startTime');
  const endTimeEl     = document.getElementById('endTime');
  const locationEl    = document.getElementById('location');
  const descriptionEl = document.getElementById('description');
  const statusEl      = document.getElementById('status');
  const btnRegister   = document.getElementById('btn-register');
  const btnCancel     = document.getElementById('btn-cancel');

  // ── 解析中表示（ポップアップは即座に表示済み）──
  statusEl.className   = '';
  statusEl.textContent = '解析中...';
  btnRegister.disabled = true;

  // ── カレンダー一覧を取得してドロップダウンを動的生成 ──
  async function loadCalendars() {
    let savedCalendarId = null;
    try {
      const s = await chrome.storage.local.get(['calendarId']);
      savedCalendarId = s.calendarId || null;
    } catch (_) {}

    let calendars = [];
    try {
      const res = await chrome.runtime.sendMessage({ type: 'list-calendars' });
      if (res && res.success && Array.isArray(res.calendars)) {
        calendars = res.calendars;
      }
    } catch (e) {
      console.debug('[tasks-manager] カレンダー一覧取得失敗（フォールバック: primary）:', e.message);
    }

    // ドロップダウンを生成
    calendarEl.textContent = '';
    if (calendars.length === 0) {
      // フォールバック
      const opt = document.createElement('option');
      opt.value = 'primary';
      opt.textContent = 'マイカレンダー（デフォルト）';
      calendarEl.appendChild(opt);
    } else {
      calendars.forEach(cal => {
        const opt = document.createElement('option');
        opt.value = cal.id;
        opt.textContent = cal.primary ? `${cal.summary}（メイン）` : cal.summary;
        calendarEl.appendChild(opt);
      });
    }

    // 保存済み calendarId があれば選択
    if (savedCalendarId) {
      calendarEl.value = savedCalendarId;
    }
    // 保存済み選択肢が存在しない場合は primary を優先
    if (!calendarEl.value) {
      const primaryOpt = Array.from(calendarEl.options).find(o => o.textContent.includes('メイン'));
      if (primaryOpt) calendarEl.value = primaryOpt.value;
    }
  }

  // カレンダー一覧ロードと Gemini 解析を並列で実行
  const [, response] = await Promise.all([
    loadCalendars().catch(e => console.error('[tasks-manager] loadCalendars 失敗:', e.message)),
    chrome.runtime.sendMessage({ type: 'parse-text' }).catch(e => {
      console.error('[tasks-manager] parse-text sendMessage 例外:', e.message);
      return { success: false, error: `通信エラー: ${e.message}` };
    })
  ]);

  console.debug('[tasks-manager] parse-text レスポンス:', response?.success, response?.error);

  if (response && response.success && response.parsed) {
    const p = response.parsed;
    titleEl.value       = p.title       || '';
    dateEl.value        = p.date        || '';
    startTimeEl.value   = p.startTime   || '';
    endTimeEl.value     = p.endTime     || '';
    locationEl.value    = p.location    || '';
    descriptionEl.value = p.description || '';

    statusEl.textContent = '';
    btnRegister.disabled = false;

    // meetUrl は登録時に使うため data 属性で保持
    btnRegister.dataset.meetUrl = p.meetUrl || '';
  } else {
    const errMsg = (response && response.error) ? response.error : '解析に失敗しました';
    statusEl.textContent = `解析エラー: ${errMsg.substring(0, 120)}。手動で入力してください。`;
    statusEl.className   = 'error';

    if (response && response.originalText) {
      descriptionEl.value = response.originalText;
    }

    btnRegister.disabled = false;
    console.error('[tasks-manager] 解析失敗, 手動入力モードへ:', errMsg);
  }

  // ── 登録処理 ──
  async function submitRegistration() {
    if (btnRegister.disabled) return;

    btnRegister.disabled = true;
    statusEl.className   = '';
    statusEl.textContent = '登録中...';

    // カレンダー選択を保存
    const selectedCalendarId = calendarEl.value || 'primary';
    try {
      await chrome.storage.local.set({ calendarId: selectedCalendarId });
    } catch (_) {}

    const eventData = {
      title:       titleEl.value.trim(),
      date:        dateEl.value,
      calendarId:  selectedCalendarId,
      startTime:   startTimeEl.value || null,
      endTime:     endTimeEl.value   || null,
      allDay:      !startTimeEl.value,
      location:    locationEl.value.trim(),
      description: descriptionEl.value.trim(),
      meetUrl:     btnRegister.dataset.meetUrl || null
    };

    if (!eventData.title) {
      statusEl.textContent = 'タイトルを入力してください';
      statusEl.className   = 'error';
      btnRegister.disabled = false;
      return;
    }

    if (!eventData.date) {
      statusEl.textContent = '日付を入力してください';
      statusEl.className   = 'error';
      btnRegister.disabled = false;
      return;
    }

    console.debug('[tasks-manager] register-event 送信:', eventData.title, eventData.date);

    try {
      const res = await chrome.runtime.sendMessage({
        type:      'register-event',
        eventData: eventData
      });

      if (res && res.success) {
        statusEl.textContent = '登録しました！';
        setTimeout(() => window.close(), 1000);
      } else {
        const errMsg = (res && res.error) ? res.error : '登録に失敗しました';
        statusEl.textContent = errMsg.substring(0, 150);
        statusEl.className   = 'error';
        btnRegister.disabled = false;
      }
    } catch (e) {
      console.error('[tasks-manager] register-event 例外:', e.message);
      statusEl.textContent = e.message.substring(0, 150);
      statusEl.className   = 'error';
      btnRegister.disabled = false;
    }
  }

  btnRegister.addEventListener('click', submitRegistration);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.isComposing) return;

    const isTextarea = e.target.tagName === 'TEXTAREA';
    const isModified = e.metaKey || e.ctrlKey;

    if (isTextarea && !isModified) return;

    e.preventDefault();
    submitRegistration();
  });

  btnCancel.addEventListener('click', () => {
    window.close();
  });
})();
