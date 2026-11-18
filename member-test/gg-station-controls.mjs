export function mountStationControls(container, { request, language = 'zh' }) {
  const tr = (zh, en) => language === 'zh' ? zh : en;
  const currency = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' });
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit' });
  const labels = {
    free: tr('空闲','Available'), reserved: tr('已预约','Reserved'), starting: tr('正在开台','Starting'),
    active: tr('使用中','In use'), stopping: tr('正在结束','Ending'), attention: tr('需处理','Needs attention')
  };
  let snapshot;
  let busy = false;
  let refreshing = false;
  let revision = 0;
  let timer;
  let disposed = false;
  let selected;
  let lastError = '';

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  const notice = node('p', '', 'floor-notice');
  notice.setAttribute('role', 'status');
  const grid = node('div', '', 'floor-layout');
  const dialog = node('dialog', '', 'floor-dialog');
  const question = node('h2');
  const confirm = node('button', tr('确认','Confirm'), 'primary');
  const cancel = node('button', tr('取消','Cancel'));
  cancel.autofocus = true;
  cancel.onclick = () => dialog.close();
  dialog.append(question, confirm, cancel);
  container.replaceChildren(notice, grid, dialog);

  function choose(text, action) {
    selected = action;
    question.textContent = text;
    dialog.showModal();
  }

  confirm.onclick = async () => {
    if (busy || !selected) return;
    const action = selected;
    revision += 1;
    selected = undefined;
    dialog.close();
    busy = true;
    lastError = '';
    render();
    try {
      snapshot = await request(action.action, action);
    } catch (error) {
      lastError = error.message || tr('操作未完成，请刷新核对。','Operation not completed. Refresh to verify.');
    } finally {
      busy = false;
      render();
    }
  };

  function actionButton(parent, title, hint, action, primary = false) {
    const button = node('button', title, primary ? 'primary' : '');
    button.disabled = busy || !snapshot.connected;
    button.onclick = () => choose(hint, action);
    parent.append(button);
  }

  function render() {
    if (disposed || !container.isConnected) return;
    notice.textContent = lastError || (snapshot?.connected ? '' : tr('店内电脑未连接，暂不能开台。','Store computer is offline.'));
    if (!snapshot) return;
    grid.replaceChildren(...snapshot.stations.map(station => {
      const card = node('article', '', 'floor-station');
      const title = node('div', '', 'floor-title');
      title.append(node('h3', station.name), node('span', labels[station.status], 'floor-chip ' + station.status));
      card.append(title);
      const actions = node('div', '', 'floor-actions');

      if (station.status === 'free') {
        station.packages.forEach(plan => {
          const duration = plan.test ? tr('试点测试 · 5 分钟','Pilot test · 5 min') : tr(plan.minutes / 60 + ' 小时', plan.minutes / 60 + ' hr');
          actionButton(actions, plan.test ? duration : duration + ' · ' + currency.format(plan.amount / 100),
            tr('开台：','Start ') + station.name + ' · ' + duration,
            {action:'start', station:station.id, minutes:plan.minutes}, true);
        });
      }
      if (station.status === 'active') {
        const countdown = node('p', '', 'floor-countdown');
        countdown.dataset.end = station.endAt;
        card.append(countdown, node('small', tr('预计结束 ','Ends ') + clock.format(new Date(station.endAt))));
        for (const minutes of [15, 30, 60]) {
          actionButton(actions, '+' + minutes + tr(' 分钟',' min'),
            station.name + tr(' 加时 ',' · Extend by ') + minutes + tr(' 分钟',' min'),
            {action:'extend', station:station.id, minutes, expectedEnd:station.endAt});
        }
        actionButton(actions, tr('结束','End'), tr('结束并关闭电视：','End and turn off ') + station.name,
          {action:'end', station:station.id});
      }
      if (station.status === 'reserved' && station.nextStart) {
        card.append(node('p', tr('预约开始 ','Booking starts ') + clock.format(new Date(station.nextStart))));
      }
      if (station.status === 'attention') {
        card.append(node('p', tr('请核对电视状态。','Check the TV at this station.')));
      }
      card.append(actions);
      return card;
    }));
    updateCountdowns();
  }

  function updateCountdowns() {
    for (const countdown of grid.querySelectorAll('[data-end]')) {
      const seconds = Math.max(0, Math.ceil((Date.parse(countdown.dataset.end) - Date.now()) / 1000));
      countdown.textContent = seconds
        ? [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':')
        : tr('已到时，等待关闭电视','Time up, waiting for TV to turn off');
    }
  }

  async function refresh() {
    if (disposed || busy || refreshing || dialog.open || grid.contains(document.activeElement)) return;
    refreshing = true;
    const before = revision;
    try {
      const incoming = await request('state');
      if (before !== revision || busy) return;
      if (JSON.stringify(incoming) !== JSON.stringify(snapshot)) {
        snapshot = incoming;
        render();
      }
    } catch {
      if (before !== revision || busy) return;
      if (snapshot?.connected) {
        snapshot = {...snapshot, connected:false};
        render();
      } else if (!snapshot) render();
    } finally { refreshing = false; }
  }

  void refresh();
  timer = setInterval(() => {
    if (!container.isConnected) { clearInterval(timer); return; }
    updateCountdowns();
    void refresh();
  }, 1000);

  return () => { disposed = true; clearInterval(timer); };
}


