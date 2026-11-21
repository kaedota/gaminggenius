export function mountStationControls(container, { request, language = 'zh', onManageBooking }) {
  const tr = (zh, en) => language === 'zh' ? zh : en;
  const currency = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' });
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit' });
  const date = new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: 'short', day: 'numeric'
  });
  const bookingExpansion = new Map();
  const labels = {
    closed: tr('未营业','Closed'), paused: tr('暂停使用','Unavailable'),
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
  container.replaceChildren(notice, grid);

  function choose(text, action) {
    selected = {text, action};
    render();
    grid.querySelector('.floor-confirm button')?.focus();
  }

  async function submitSelected() {
    if (busy || !selected) return;
    const action = selected.action;
    revision += 1;
    selected = undefined;
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
  }

  function actionButton(parent, title, hint, action, primary = false) {
    const button = node('button', title, primary ? 'primary' : '');
    button.disabled = busy || !snapshot.connected;
    button.onclick = () => choose(hint, action);
    parent.append(button);
  }

  function bookingTime(booking) {
    const start = new Date(booking.start_at);
    const end = new Date(booking.end_at);
    const firstDay = date.format(start);
    const lastDay = date.format(end);
    return firstDay + ' · ' + clock.format(start) + '–' + (lastDay === firstDay ? '' : lastDay + ' ') + clock.format(end);
  }

  function bookingsPanel(station) {
    const details = node('details', '', 'floor-bookings');
    details.open = bookingExpansion.get(station.id) ?? station.bookings.length > 1;
    details.ontoggle = () => {
      if (!details.isConnected) return;
      bookingExpansion.set(station.id, details.open);
    };
    const summary = node('summary');
    summary.dataset.bookingStation = station.id;
    summary.append(
      node('strong', tr(station.bookingCount + ' 笔预约', station.bookingCount + (station.bookingCount === 1 ? ' booking' : ' bookings'))),
      node('small', bookingTime(station.bookings[0]))
    );
    const list = node('ul');
    for (const entry of station.bookings) {
      const item = node('li', bookingTime(entry));
      if (entry.status === 'checked_in') item.append(node('small', tr(' · 已签到',' · Checked in')));
      list.append(item);
    }
    details.append(summary, list);
    if (station.bookingCount > station.bookings.length) {
      details.append(node('small', tr('显示最近 10 笔。其他预约请按日期查看。','Showing the next 10. Browse the daily booking list for more.')));
    }
    return details;
  }

  function render() {
    if (disposed || !container.isConnected) return;
    notice.textContent = lastError || (snapshot?.connected ? '' : tr('店内电脑未连接，暂不能开台。','Store computer is offline.'));
    if (!snapshot) return;
    const focusedStation = document.activeElement?.dataset.bookingStation;
    grid.replaceChildren(...snapshot.stations.map(station => {
      const card = node('article', '', 'floor-station');
      const title = node('div', '', 'floor-title');
      title.append(node('h3', station.name), node('span', labels[station.status], 'floor-chip ' + station.status));
      card.append(title);
      if (station.bookings.length) {
        card.append(bookingsPanel(station));
        const manage = node('button', tr('管理／取消预约','Manage / cancel booking'));
        manage.type='button';
        manage.onclick=()=>onManageBooking?.(station.id,station.bookings[0].start_at);
        card.append(manage);
      }
      if (station.startedAt) {
        const elapsed = node('p');
        elapsed.dataset.started = station.startedAt;
        elapsed.textContent = tr('已玩 ','Played ') + formatDuration(Math.floor(Math.max(0, Date.now() - Date.parse(station.startedAt)) / 60000));
        card.append(elapsed);
      } else if (Number.isFinite(station.lastPlayedMinutes)) {
        card.append(node('small', tr('上次共玩 ','Last played ') + formatDuration(station.lastPlayedMinutes)));
      }
      if (selected?.action.station === station.id) {
        const box = node('div', '', 'floor-confirm');
        box.append(node('p', selected.text));
        const confirmButton = node('button', labels[station.status] === labels.free ? tr('确认开台','Start') : tr('确认','Confirm'), 'primary');
        confirmButton.type = 'button';
        confirmButton.onclick = submitSelected;
        const cancelButton = node('button', tr('取消','Cancel'));
        cancelButton.type = 'button';
        cancelButton.onclick = () => { selected = undefined; render(); };
        box.append(confirmButton, cancelButton);
        card.append(box);
        return card;
      }
      const actions = node('div', '', 'floor-actions');

      if (station.status === 'free' || station.status === 'closed') {
        station.packages.filter(plan=>station.status==='free'||plan.test).forEach(plan => {
          const duration = plan.test ? tr('测试5分钟','Test 5 minutes') : tr(plan.minutes / 60 + ' 小时', plan.minutes / 60 + ' hr');
          actionButton(actions, plan.test ? duration : duration + ' · ' + currency.format(plan.amount / 100),
            (plan.test?tr('员工设备测试，不计游玩收费；5分钟后关闭电视：','Staff equipment test, no gaming charge; TV switches off after 5 minutes: '):tr('开台：','Start ')) + station.name + ' · ' + duration,
            {action:'start', station:station.id, minutes:plan.minutes}, true);
        });
      }
      if (station.status === 'active') {
        if (station.manual && station.pending) {
          card.append(node('p', tr('正在开启手动结束…','Enabling manual end…')));
        } else if (station.manual) {
          card.append(node('small', tr('手动结束 · 不自动关电视','Manual end · TV stays on')));
        } else {
          const countdown = node('p', '', 'floor-countdown');
          countdown.dataset.end = station.endAt;
          card.append(countdown, node('small', tr('预计结束 ','Ends ') + clock.format(new Date(station.endAt))));
          if (station.extendRejected) {
            card.append(node('p', tr('加时未生效，请核对剩余时间。','Extension failed. Check the remaining time.')));
          }
          for (const minutes of [15, 30, 60]) {
            actionButton(actions, '+' + minutes + tr(' 分钟',' min'),
              station.name + tr(' 加时 ',' · Extend by ') + minutes + tr(' 分钟',' min'),
              {action:'extend', station:station.id, session:station.session, minutes, expectedEnd:station.endAt});
          }
          actionButton(actions, tr('继续玩 · 手动结束','Keep playing · Manual end'),
            station.name + tr(' 将继续计时，直到你按结束。',' will keep counting until you press End.'),
            {action:'extend', station:station.id, session:station.session, minutes:0, expectedEnd:station.endAt});
        }
        actionButton(actions, tr('结束','End'), tr('结束并关闭电视：','End and turn off ') + station.name,
          {action:'end', station:station.id, session:station.session});
      }
      if (station.status === 'reserved' && station.nextStart && !station.bookings.length) {
        card.append(node('p', tr('预约开始 ','Booking starts ') + clock.format(new Date(station.nextStart))));
      }
      if (station.status === 'attention') {
        card.append(node('p', tr('请核对电视状态。','Check the TV at this station.')));
      }
      card.append(actions);
      return card;
    }));
    if (focusedStation) {
      [...grid.querySelectorAll('[data-booking-station]')]
        .find(summary => summary.dataset.bookingStation === focusedStation)?.focus({preventScroll:true});
    }
    updateCountdowns();
  }

  function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return hours ? tr(hours + '小时' + remainder + '分钟', hours + ' hr ' + remainder + ' min')
      : tr(remainder + '分钟', remainder + ' min');
  }

  function updateCountdowns() {
    for (const elapsed of grid.querySelectorAll('[data-started]')) {
      const minutes = Math.floor(Math.max(0, Date.now() - Date.parse(elapsed.dataset.started)) / 60000);
      elapsed.textContent = tr('已玩 ','Played ') + formatDuration(minutes);
    }
    for (const countdown of grid.querySelectorAll('[data-end]')) {
      const seconds = Math.max(0, Math.ceil((Date.parse(countdown.dataset.end) - Date.now()) / 1000));
      countdown.textContent = seconds
        ? [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':')
        : tr('已到时，等待关闭电视','Time up, waiting for TV to turn off');
    }
  }

  async function refresh() {
    if (disposed || busy || refreshing || selected || (grid.contains(document.activeElement) && !document.activeElement.dataset.bookingStation)) return;
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



