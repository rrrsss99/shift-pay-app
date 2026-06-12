const TEMP_PASSWORD = 'Shift2026';

const STORAGE_KEYS = {
  auth: 'shiftPay.tempAuth.v1',
  staff: 'shiftPay.staff.v1',
  works: 'shiftPay.works.v1',
  settings: 'shiftPay.settings.v1',
};

const LATE_NIGHT_START = 22;
const LATE_NIGHT_END = 24;
const DAY_START_MIN = 11;
const DAY_END_MAX = 15;
const NIGHT_START_MIN = 17;
const NIGHT_END_MAX = 24;

let staffList = load(STORAGE_KEYS.staff, []);
let workList = load(STORAGE_KEYS.works, []);
let settings = load(STORAGE_KEYS.settings, { bonusAmount: 1000 });
let latestCalculation = null;
let editingWorkId = null;

const $ = (id) => document.getElementById(id);

function isLoggedIn() {
  return localStorage.getItem(STORAGE_KEYS.auth) === 'true';
}

function showLogin() {
  $('loginView').classList.remove('hidden');
  $('appShell').classList.add('hidden');
}

function showApp() {
  $('loginView').classList.add('hidden');
  $('appShell').classList.remove('hidden');
}

function handleLogin() {
  const input = $('passwordInput').value;
  if (input === TEMP_PASSWORD) {
    localStorage.setItem(STORAGE_KEYS.auth, 'true');
    $('passwordInput').value = '';
    $('loginError').textContent = '';
    showApp();
    return;
  }

  $('loginError').textContent = 'パスワードが違います。';
}

function logout() {
  localStorage.removeItem(STORAGE_KEYS.auth);
  showLogin();
}

function bindAuthEvents() {
  $('loginBtn').addEventListener('click', handleLogin);
  $('passwordInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  $('logoutBtn').addEventListener('click', logout);
}

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function yen(value) {
  return `${Math.round(value).toLocaleString()}円`;
}

function hoursText(value) {
  return `${Number(value || 0).toFixed(1)}h`;
}

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentMonthString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeTimeInput(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '空欄') return '';

  let h;
  let m;
  if (/^\d{1,2}$/.test(raw)) {
    h = Number(raw);
    m = 0;
  } else if (/^\d{3,4}$/.test(raw)) {
    const padded = raw.padStart(4, '0');
    h = Number(padded.slice(0, 2));
    m = Number(padded.slice(2));
  } else {
    const match = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) throw new Error(`時間は「17:00」または「1730」の形式で入力してください。入力値：${raw}`);
    h = Number(match[1]);
    m = Number(match[2]);
  }

  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 24 || m < 0 || m >= 60) {
    throw new Error(`時間の入力が正しくありません。入力値：${raw}`);
  }
  if (h === 24 && m !== 0) {
    throw new Error('24時台は24:00のみ入力できます。');
  }

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToHours(value) {
  if (!value) return null;
  const normalized = normalizeTimeInput(value);
  if (!normalized) return null;
  const [h, m] = normalized.split(':').map(Number);
  return h + m / 60;
}

function hoursToTime(value) {
  if (value === null || value === undefined || value === '') return '';
  const h = Math.floor(value);
  const m = Math.round((value - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isHalfHourTime(value) {
  const normalized = normalizeTimeInput(value);
  if (!normalized) return true;
  const [, m] = normalized.split(':').map(Number);
  return m === 0 || m === 30;
}

function formatTimeRange(start, end) {
  if (!start || !end) return '-';
  return `${start}〜${end}`;
}

function formatHireMonth(value) {
  if (!value) return '';
  const [year, month] = value.split('-');
  if (!year || !month) return '';
  return `${year}/${month}入店`;
}

function createTimeOptions(list, { allowBlank = true, start = 11, end = 15, min = null, max = null } = {}) {
  list.innerHTML = '';
  if (allowBlank) {
    const blank = document.createElement('option');
    blank.value = '';
    blank.label = '空欄';
    list.append(blank);
  }

  for (let h = start; h <= end; h++) {
    for (const m of [0, 30]) {
      if (h === end && m > 0) continue;
      const value = h + m / 60;
      if (min !== null && value < min) continue;
      if (max !== null && value > max) continue;
      const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const option = document.createElement('option');
      option.value = label;
      list.append(option);
    }
  }
}

function createBreakOptions(select) {
  select.innerHTML = '';
  for (let minutes = 0; minutes <= 180; minutes += 30) {
    select.append(new Option(`${minutes}分`, String(minutes)));
  }
}

function safeTimeToHours(value) {
  try {
    return timeToHours(value);
  } catch {
    return null;
  }
}

function updateTimeDatalists() {
  const dayStartH = safeTimeToHours($('dayStart').value);
  const dayEndH = safeTimeToHours($('dayEnd').value);
  const nightStartH = safeTimeToHours($('nightStart').value);
  const nightEndH = safeTimeToHours($('nightEnd').value);

  createTimeOptions($('dayStartOptions'), {
    start: DAY_START_MIN,
    end: DAY_END_MAX,
    max: dayEndH ?? DAY_END_MAX,
  });
  createTimeOptions($('dayEndOptions'), {
    start: DAY_START_MIN,
    end: DAY_END_MAX,
    min: dayStartH ?? DAY_START_MIN,
  });
  createTimeOptions($('nightStartOptions'), {
    start: NIGHT_START_MIN,
    end: NIGHT_END_MAX,
    max: nightEndH ?? NIGHT_END_MAX,
  });
  createTimeOptions($('nightEndOptions'), {
    start: NIGHT_START_MIN,
    end: NIGHT_END_MAX,
    min: nightStartH ?? NIGHT_START_MIN,
  });
}

function setupInputs() {
  updateTimeDatalists();
  createBreakOptions($('nightBreak'));
  $('workDate').value = todayString();
  $('summaryDate').value = todayString();
  $('summaryMonth').value = currentMonthString();
  $('bonusAmount').value = settings.bonusAmount ?? 1000;
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.view;
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
      button.classList.add('active');
      $(`view-${view}`).classList.add('active');
      renderAll();
    });
  });
}

function migrateStaffList() {
  let changed = false;
  staffList = staffList.map((staff, index) => {
    const next = { ...staff };
    if (next.displayOrder === undefined) {
      next.displayOrder = index + 1;
      changed = true;
    }
    if (next.hireMonth === undefined) {
      next.hireMonth = '';
      changed = true;
    }
    return next;
  });
  if (changed) save(STORAGE_KEYS.staff, staffList);
}

function getSortedStaffList() {
  const sortFn = (a, b) => {
    const orderA = Number(a.displayOrder ?? 9999);
    const orderB = Number(b.displayOrder ?? 9999);
    if (orderA !== orderB) return orderA - orderB;
    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  };
  const employed = staffList.filter((s) => s.isEmployed).sort(sortFn);
  const notEmployed = staffList.filter((s) => !s.isEmployed).sort(sortFn);
  return [...employed, ...notEmployed];
}

function normalizeDisplayOrders() {
  const sorted = getSortedStaffList();
  sorted.forEach((staff, index) => {
    const target = staffList.find((s) => s.staffId === staff.staffId);
    if (target) target.displayOrder = index + 1;
  });
  save(STORAGE_KEYS.staff, staffList);
}

function getSelectedStaff() {
  return staffList.find((s) => s.staffId === $('staffSelect').value) || null;
}

function validateTimePair(start, end, label, minHour, maxHour) {
  const normalizedStart = normalizeTimeInput(start);
  const normalizedEnd = normalizeTimeInput(end);
  if (!normalizedStart && !normalizedEnd) return null;
  if (!normalizedStart || !normalizedEnd) throw new Error(`${label}の出勤・退勤を入力してください。`);

  const startH = timeToHours(normalizedStart);
  const endH = timeToHours(normalizedEnd);

  if (normalizedStart === '00:00' || normalizedEnd === '00:00') {
    throw new Error('00:00は使わず、24:00を使用してください。');
  }
  if (startH < minHour || startH > maxHour || endH < minHour || endH > maxHour) {
    throw new Error(`${label}は${hoursToTime(minHour)}〜${hoursToTime(maxHour)}の範囲で入力してください。`);
  }
  if (endH <= startH) throw new Error(`${label}の退勤時間は出勤時間より後にしてください。`);

  return {
    start: normalizedStart,
    end: normalizedEnd,
    startH,
    endH,
    hasNonHalfHour: !isHalfHourTime(normalizedStart) || !isHalfHourTime(normalizedEnd),
  };
}

function calculateWorkFromForm() {
  const staff = getSelectedStaff();
  if (!staff) throw new Error('名前を選択してください。');

  const date = $('workDate').value;
  if (!date) throw new Error('日付を入力してください。');

  let dayStart = $('dayStart').value;
  let dayEnd = $('dayEnd').value;
  let nightStart = $('nightStart').value;
  let nightEnd = $('nightEnd').value;
  const nightBreakMinutes = Number($('nightBreak').value || 0);
  const bonusApplied = $('bonusApplied').checked;

  const day = validateTimePair(dayStart, dayEnd, '昼勤務', DAY_START_MIN, DAY_END_MAX);
  const night = validateTimePair(nightStart, nightEnd, '夜勤務', NIGHT_START_MIN, NIGHT_END_MAX);

  dayStart = day ? day.start : '';
  dayEnd = day ? day.end : '';
  nightStart = night ? night.start : '';
  nightEnd = night ? night.end : '';

  if (!day && !night) throw new Error('勤務時間を入力してください。');

  const dayHours = day ? day.endH - day.startH : 0;

  let nightNormalHours = 0;
  let nightLateHours = 0;
  let nightGrossHours = 0;

  if (night) {
    nightGrossHours = night.endH - night.startH;
    const breakHours = nightBreakMinutes / 60;
    if (breakHours > nightGrossHours) throw new Error('休憩時間が勤務時間を超えています。');

    const lateGross = Math.max(0, Math.min(night.endH, LATE_NIGHT_END) - Math.max(night.startH, LATE_NIGHT_START));
    const normalGross = nightGrossHours - lateGross;

    const lateBreak = Math.min(lateGross, breakHours);
    const remainingBreak = breakHours - lateBreak;
    const normalBreak = Math.min(normalGross, remainingBreak);

    nightLateHours = Math.max(0, lateGross - lateBreak);
    nightNormalHours = Math.max(0, normalGross - normalBreak);
  }

  const normalHours = dayHours + nightNormalHours;
  const lateNightHours = nightLateHours;
  const totalWorkHours = normalHours + lateNightHours;
  const hourlyWage = Number(staff.hourlyWage || 0);
  const transportationFee = Number(staff.transportationFee || 0);
  const bonusAmount = bonusApplied ? Number(settings.bonusAmount || 0) : 0;
  const basePay = normalHours * hourlyWage;
  const lateNightPay = lateNightHours * hourlyWage * 1.25;
  const totalPay = Math.round(basePay + lateNightPay + transportationFee + bonusAmount);

  return {
    workId: editingWorkId || uid('work'),
    date,
    staffId: staff.staffId,
    staffName: staff.name,
    dayStart,
    dayEnd,
    nightStart,
    nightEnd,
    nightBreakMinutes,
    normalHours,
    lateNightHours,
    totalWorkHours,
    hourlyWage,
    transportationFee,
    bonusApplied,
    bonusAmount,
    basePay: Math.round(basePay),
    lateNightPay: Math.round(lateNightPay),
    totalPay,
    hasNonHalfHour: Boolean((day && day.hasNonHalfHour) || (night && night.hasNonHalfHour)),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function renderCalculation(work) {
  $('calcResult').classList.remove('muted');
  $('calcResult').innerHTML = `
    <div><strong>${work.staffName}</strong></div>
    <div>昼勤務：${formatTimeRange(work.dayStart, work.dayEnd)}</div>
    <div>夜勤務：${formatTimeRange(work.nightStart, work.nightEnd)} / 休憩 ${work.nightBreakMinutes}分</div>
    <hr />
    <div>${workDurationLine(work)}</div>
    <hr />
    <div>通常給料：${yen(work.basePay)}</div>
    <div>深夜給料：${yen(work.lateNightPay)}</div>
    <div>交通費：${yen(work.transportationFee)}</div>
    <div>ボーナス：${yen(work.bonusAmount)}</div>
    <div><strong>支払額：${yen(work.totalPay)}</strong></div>
  `;
  $('saveWorkBtn').disabled = false;
}

function saveWork() {
  if (!latestCalculation) return;

  const existingIndex = workList.findIndex((w) => w.workId === latestCalculation.workId);
  if (existingIndex >= 0) {
    if (!confirm('この勤務記録を変更しますか？')) return;
  }

  if (latestCalculation.hasNonHalfHour) {
    const ok = confirm('30分単位以外の時間が入力されています。\nこのまま保存しますか？');
    if (!ok) return;
  }

  if (existingIndex >= 0) {
    latestCalculation.createdAt = workList[existingIndex].createdAt;
    latestCalculation.updatedAt = new Date().toISOString();
    workList[existingIndex] = latestCalculation;
  } else {
    workList.push(latestCalculation);
  }

  save(STORAGE_KEYS.works, workList);
  editingWorkId = null;
  latestCalculation = null;
  $('saveWorkBtn').disabled = true;
  $('calcResult').innerHTML = '保存しました。';
  $('calcResult').classList.add('muted');
  renderAll();
}

function renderStaffSelect() {
  const select = $('staffSelect');
  const current = select.value;
  select.innerHTML = '';
  const employed = getSortedStaffList().filter((s) => s.isEmployed);
  if (employed.length === 0) {
    select.append(new Option('在籍中の名前がありません', ''));
    return;
  }
  select.append(new Option('名前を選択してください', ''));
  employed.forEach((staff) => select.append(new Option(staff.name, staff.staffId)));
  if (employed.some((s) => s.staffId === current)) select.value = current;
}

function renderStaffList() {
  const root = $('staffList');
  if (staffList.length === 0) {
    root.innerHTML = '<div class="muted">まだ登録がありません。</div>';
    return;
  }

  const sorted = getSortedStaffList();
  const employed = sorted.filter((s) => s.isEmployed);
  const notEmployed = sorted.filter((s) => !s.isEmployed);

  const htmlParts = [];
  if (employed.length > 0) {
    htmlParts.push('<div class="list-section-title">在籍中</div>');
    employed.forEach((staff, index) => htmlParts.push(staffItemHtml(staff, index, employed.length)));
  }
  if (notEmployed.length > 0) {
    htmlParts.push('<div class="list-section-title">非在籍</div>');
    notEmployed.forEach((staff) => htmlParts.push(staffItemHtml(staff, null, notEmployed.length)));
  }
  root.innerHTML = htmlParts.join('');
}

function staffItemHtml(staff, employedIndex, employedCount) {
  const hireMonthText = formatHireMonth(staff.hireMonth);
  const moveButtons = staff.isEmployed
    ? `
      <button type="button" class="secondary compact" onclick="moveStaff('${staff.staffId}', -1)" ${employedIndex === 0 ? 'disabled' : ''}>↑</button>
      <button type="button" class="secondary compact" onclick="moveStaff('${staff.staffId}', 1)" ${employedIndex === employedCount - 1 ? 'disabled' : ''}>↓</button>
    `
    : '';

  return `
    <div class="list-item">
      <div class="list-title">
        <span>${staff.name}${hireMonthText ? ` <span class="inline-muted">${hireMonthText}</span>` : ''}</span>
        <span>${staff.isEmployed ? '在籍中' : '非在籍'}</span>
      </div>
      <div class="list-meta">時給 ${yen(staff.hourlyWage)} / 交通費 ${yen(staff.transportationFee)}</div>
      <div class="list-actions">
        ${moveButtons}
        <button type="button" class="secondary" onclick="editStaff('${staff.staffId}')">編集</button>
      </div>
    </div>
  `;
}

function moveStaff(staffId, direction) {
  const employed = getSortedStaffList().filter((s) => s.isEmployed);
  const currentIndex = employed.findIndex((s) => s.staffId === staffId);
  const targetIndex = currentIndex + direction;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= employed.length) return;

  const current = employed[currentIndex];
  const target = employed[targetIndex];
  const currentOrder = current.displayOrder;
  current.displayOrder = target.displayOrder;
  target.displayOrder = currentOrder;

  save(STORAGE_KEYS.staff, staffList);
  renderAll();
}

function editStaff(staffId) {
  const staff = staffList.find((s) => s.staffId === staffId);
  if (!staff) return;
  $('editingStaffId').value = staff.staffId;
  $('staffName').value = staff.name;
  $('hourlyWage').value = staff.hourlyWage;
  $('transportationFee').value = staff.transportationFee;
  $('hireMonth').value = staff.hireMonth || '';
  $('isEmployed').checked = staff.isEmployed;
}

function clearStaffForm() {
  $('editingStaffId').value = '';
  $('staffName').value = '';
  $('hourlyWage').value = '';
  $('transportationFee').value = '';
  $('hireMonth').value = '';
  $('isEmployed').checked = true;
}

function saveStaff() {
  const staffId = $('editingStaffId').value;
  const name = $('staffName').value.trim();
  const hourlyWage = Number($('hourlyWage').value || 0);
  const transportationFee = Number($('transportationFee').value || 0);
  const hireMonth = $('hireMonth').value || '';
  const isEmployed = $('isEmployed').checked;

  if (!name) return alert('名前を入力してください。');
  if (hourlyWage <= 0) return alert('時給を入力してください。');
  if (transportationFee < 0) return alert('交通費は0円以上で入力してください。');

  if (staffId) {
    const index = staffList.findIndex((s) => s.staffId === staffId);
    if (index >= 0) {
      staffList[index] = {
        ...staffList[index],
        name,
        hourlyWage,
        transportationFee,
        hireMonth,
        isEmployed,
        updatedAt: new Date().toISOString(),
      };
    }
  } else {
    const maxOrder = staffList.reduce((max, s) => Math.max(max, Number(s.displayOrder || 0)), 0);
    staffList.push({
      staffId: uid('staff'),
      name,
      hourlyWage,
      transportationFee,
      hireMonth,
      isEmployed,
      displayOrder: maxOrder + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  normalizeDisplayOrders();
  clearStaffForm();
  renderAll();
}

function saveSettings() {
  const bonusAmount = Number($('bonusAmount').value || 0);
  if (bonusAmount < 0) return alert('ボーナス金額は0円以上で入力してください。');

  const currentAmount = Number(settings.bonusAmount || 0);
  if (bonusAmount !== currentAmount) {
    const ok = confirm(`売上達成ボーナス金額を変更しますか？\n\n現在：${yen(currentAmount)}\n変更後：${yen(bonusAmount)}`);
    if (!ok) {
      $('bonusAmount').value = currentAmount;
      return;
    }
  }

  settings = { bonusAmount, updatedAt: new Date().toISOString() };
  save(STORAGE_KEYS.settings, settings);
  alert('店舗設定を保存しました。');
}

function workDurationLine(w) {
  const late = Number(w.lateNightHours || 0);
  return late > 0
    ? `勤務 ${hoursText(w.totalWorkHours)}（うち深夜時間${hoursText(late)}）`
    : `勤務 ${hoursText(w.totalWorkHours)}`;
}

function workTimeLine(w) {
  const lines = [];
  if (w.dayStart && w.dayEnd) lines.push(`昼 ${formatTimeRange(w.dayStart, w.dayEnd)}`);
  if (w.nightStart && w.nightEnd) lines.push(`夜 ${formatTimeRange(w.nightStart, w.nightEnd)}${Number(w.nightBreakMinutes || 0) > 0 ? ` / 休憩 ${w.nightBreakMinutes}分` : ''}`);
  return lines.join('<br />') || '-';
}

function payLine(w) {
  return `支払額 ${yen(w.totalPay)}（うち交通費：${yen(w.transportationFee)}）`;
}

function compareByStaffOrder(a, b) {
  const staffA = staffList.find((s) => s.staffId === a.staffId);
  const staffB = staffList.find((s) => s.staffId === b.staffId);
  const orderA = staffA ? Number(staffA.displayOrder ?? 9999) : 9999;
  const orderB = staffB ? Number(staffB.displayOrder ?? 9999) : 9999;
  if (orderA !== orderB) return orderA - orderB;
  return a.staffName.localeCompare(b.staffName, 'ja');
}

function renderTodayList() {
  const date = $('workDate').value || todayString();
  const records = workList.filter((w) => w.date === date).sort(compareByStaffOrder);
  const root = $('todayList');
  if (records.length === 0) {
    root.innerHTML = `<div class="muted">${date} の勤務記録はありません。</div>`;
    return;
  }

  const total = records.reduce((sum, w) => sum + w.totalPay, 0);
  root.innerHTML = records.map(workItemHtml).join('') + `<div class="total-box">本日合計 ${yen(total)}</div>`;
}

function workItemHtml(w) {
  return `
    <div class="list-item">
      <div class="list-title">
        <span>${w.staffName}</span>
        <span>${yen(w.totalPay)}</span>
      </div>
      <div class="list-meta">
        ${workTimeLine(w)}<br />
        ${workDurationLine(w)}<br />
        ${payLine(w)}${w.bonusApplied ? `<br />ボーナス：${yen(w.bonusAmount)}` : ''}
      </div>
      <div class="list-actions">
        <button type="button" class="secondary" onclick="editWork('${w.workId}')">編集</button>
        <button type="button" class="danger" onclick="deleteWork('${w.workId}')">削除</button>
      </div>
    </div>
  `;
}

function editWork(workId) {
  const w = workList.find((item) => item.workId === workId);
  if (!w) return;
  editingWorkId = w.workId;
  $('workDate').value = w.date;
  renderStaffSelect();
  $('staffSelect').value = w.staffId;
  $('dayStart').value = w.dayStart || '';
  $('dayEnd').value = w.dayEnd || '';
  $('nightStart').value = w.nightStart || '';
  $('nightEnd').value = w.nightEnd || '';
  $('nightBreak').value = String(w.nightBreakMinutes || 0);
  $('bonusApplied').checked = !!w.bonusApplied;
  updateTimeDatalists();

  document.querySelector('[data-view="calc"]').click();
  latestCalculation = { ...w };
  renderCalculation(latestCalculation);
}

function deleteWork(workId) {
  if (!confirm('この勤務記録を削除しますか？\n削除すると元に戻せません。')) return;
  workList = workList.filter((w) => w.workId !== workId);
  save(STORAGE_KEYS.works, workList);
  renderAll();
}

function resetDayWork() {
  $('dayStart').value = '';
  $('dayEnd').value = '';
  updateTimeDatalists();
}

function resetNightWork() {
  $('nightStart').value = '';
  $('nightEnd').value = '';
  $('nightBreak').value = '0';
  updateTimeDatalists();
}

function resetCalcForm() {
  $('staffSelect').value = '';
  resetDayWork();
  resetNightWork();
  $('bonusApplied').checked = false;
  editingWorkId = null;
  latestCalculation = null;
  $('saveWorkBtn').disabled = true;
  $('calcResult').innerHTML = '勤務時間を入力して「計算」を押してください。';
  $('calcResult').classList.add('muted');
}

function copyPreviousWork() {
  const staff = getSelectedStaff();
  if (!staff) return alert('名前を選択してください。');
  const records = workList
    .filter((w) => w.staffId === staff.staffId)
    .sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt));
  const previous = records[0];
  if (!previous) return alert('前回勤務がありません。');
  $('dayStart').value = previous.dayStart || '';
  $('dayEnd').value = previous.dayEnd || '';
  $('nightStart').value = previous.nightStart || '';
  $('nightEnd').value = previous.nightEnd || '';
  $('nightBreak').value = String(previous.nightBreakMinutes || 0);
  $('bonusApplied').checked = !!previous.bonusApplied;
  updateTimeDatalists();
}

function getMonthRecords(month) {
  return workList.filter((w) => w.date.startsWith(month));
}

function renderSummary() {
  const month = $('summaryMonth').value || currentMonthString();
  const date = $('summaryDate').value || todayString();
  const monthRecords = getMonthRecords(month);

  const monthTotalPay = monthRecords.reduce((sum, w) => sum + w.totalPay, 0);
  const monthTotalHours = monthRecords.reduce((sum, w) => sum + w.totalWorkHours, 0);

  $('monthlySummary').innerHTML = `
    <div class="result-box">
      <div>対象月：${month}</div>
      <div>人件費合計：<strong>${yen(monthTotalPay)}</strong></div>
      <div>勤務時間合計：<strong>${hoursText(monthTotalHours)}</strong></div>
      <div>出勤回数合計：<strong>${monthRecords.length}回</strong></div>
    </div>
  `;

  const byStaff = new Map();
  monthRecords.forEach((w) => {
    const current = byStaff.get(w.staffId) || { staffId: w.staffId, name: w.staffName, count: 0, hours: 0, pay: 0 };
    current.count += 1;
    current.hours += w.totalWorkHours;
    current.pay += w.totalPay;
    byStaff.set(w.staffId, current);
  });

  const staffRows = [...byStaff.values()].sort((a, b) => {
    const staffA = staffList.find((s) => s.staffId === a.staffId);
    const staffB = staffList.find((s) => s.staffId === b.staffId);
    const orderA = staffA ? Number(staffA.displayOrder ?? 9999) : 9999;
    const orderB = staffB ? Number(staffB.displayOrder ?? 9999) : 9999;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name, 'ja');
  });

  $('staffSummary').innerHTML = staffRows.length
    ? staffRows.map((s) => `
        <div class="list-item">
          <div class="list-title"><span>${s.name}</span><span>${yen(s.pay)}</span></div>
          <div class="list-meta">${s.count}回 / ${hoursText(s.hours)}</div>
        </div>
      `).join('')
    : '<div class="muted">対象月の勤務記録はありません。</div>';

  const dateRecords = workList.filter((w) => w.date === date).sort(compareByStaffOrder);
  const dayTotal = dateRecords.reduce((sum, w) => sum + w.totalPay, 0);
  $('dailyHistory').innerHTML = dateRecords.length
    ? `<div class="muted">${date}</div>${dateRecords.map(workItemHtml).join('')}<div class="total-box">日別合計 ${yen(dayTotal)}</div>`
    : `<div class="muted">${date} の勤務記録はありません。</div>`;
}

function renderAll() {
  renderStaffSelect();
  renderStaffList();
  renderTodayList();
  renderSummary();
}

function bindEvents() {
  $('calculateBtn').addEventListener('click', () => {
    try {
      latestCalculation = calculateWorkFromForm();
      renderCalculation(latestCalculation);
    } catch (e) {
      alert(e.message);
    }
  });

  $('saveWorkBtn').addEventListener('click', saveWork);
  $('saveStaffBtn').addEventListener('click', saveStaff);
  $('clearStaffBtn').addEventListener('click', clearStaffForm);
  $('saveSettingsBtn').addEventListener('click', saveSettings);
  $('copyPreviousBtn').addEventListener('click', copyPreviousWork);
  $('resetDayBtn').addEventListener('click', resetDayWork);
  $('resetNightBtn').addEventListener('click', resetNightWork);
  $('resetCalcBtn').addEventListener('click', resetCalcForm);
  $('workDate').addEventListener('change', renderTodayList);
  $('summaryMonth').addEventListener('change', renderSummary);
  $('summaryDate').addEventListener('change', renderSummary);

  ['dayStart', 'dayEnd', 'nightStart', 'nightEnd'].forEach((id) => {
    $(id).addEventListener('input', updateTimeDatalists);
    $(id).addEventListener('change', updateTimeDatalists);
  });
}

function seedIfEmpty() {
  if (staffList.length > 0) return;
  staffList = [
    {
      staffId: uid('staff'),
      name: 'Aさん',
      hourlyWage: 1200,
      transportationFee: 500,
      hireMonth: '',
      isEmployed: true,
      displayOrder: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      staffId: uid('staff'),
      name: 'Bさん',
      hourlyWage: 1100,
      transportationFee: 0,
      hireMonth: '',
      isEmployed: true,
      displayOrder: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  save(STORAGE_KEYS.staff, staffList);
}

function init() {
  bindAuthEvents();
  if (isLoggedIn()) {
    showApp();
  } else {
    showLogin();
  }

  setupInputs();
  setupTabs();
  bindEvents();
  seedIfEmpty();
  migrateStaffList();
  normalizeDisplayOrders();
  renderAll();
}

init();
