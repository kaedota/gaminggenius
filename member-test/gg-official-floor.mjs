import { mountStationControls } from './gg-station-controls.mjs?v=20261118-short';

const packages = { PS5:[2800,5200,7200], Switch:[1800,3400,4800] };

function controlsState(data, language) {
  if (!Array.isArray(data?.stations) || !Array.isArray(data?.desk_sessions)) {
    throw new Error(language === 'zh' ? '无法读取大厅状态。' : 'Floor status unavailable.');
  }
  return {
    connected: data.connected === true,
    stations: data.stations.filter(row => data.active_stations?.includes(row.id) || data.desk_sessions.some(session => session.station === row.id)).map(row => {
      const platform = row.id.split('-')[0];
      const number = row.id.split('-')[1];
      const managed = data.desk_sessions.find(session => session.station === row.id);
      let status = row.state === 'free' ? 'free' : 'reserved';
      if (row.state === 'in_use' || row.overdue) status = 'attention';
      if (managed) {
        if (managed.pending && managed.action === 'start') status = 'starting';
        else if (managed.pending && managed.action === 'end') status = 'stopping';
        else status = managed.result === 'rejected' ? 'attention' : 'active';
      }
      return {
        id: row.id,
        session: managed?.id,
        name: platform + ' ' + number + (language === 'zh' ? ' 号' : ''),
        status,
        nextStart: row.next_start,
        endAt: managed?.end_at,
        packages: [...(row.id === 'PS5-1' && data.active_stations?.length === 1 ? [{ minutes:5, test:true }] : []), ...(packages[platform] || []).map((amount, index) => ({ amount, minutes:60 * (index + 1) }))]
      };
    })
  };
}

export function mountOfficialFloor(container, { rpc, language = 'zh' }) {
  let view;
  const messages = {
    SLOT_TAKEN: ['时段已有预约，请换机位或缩短时间。','This time overlaps a booking.'],
    STORE_COMPUTER_OFFLINE: ['店内电脑未连接。','The store computer is offline.'],
    OUTSIDE_OPENING_HOURS: ['超出营业时间。','Outside opening hours.'],
    FLOOR_COMMAND_PENDING: ['上一条指令还在处理中。','The previous command is still pending.'],
    FLOOR_SESSION_EXPIRED: ['这场已到期或即将结束。','This session is ending or has expired.']
  };
  async function read() {
    view = controlsState(await rpc('gg_desk_state'), language);
    return view;
  }
  return mountStationControls(container, {
    language,
    async request(action, input) {
      if (action === 'state') return read();
      const station = view?.stations.find(row => row.id === input.station);
      if (!station) throw Error('Station not found');
      try {
        await rpc('gg_desk_command', {
          p_request: crypto.randomUUID(), p_station: station.id, p_action: action,
          p_minutes: input.minutes ?? null, p_session: station.session ?? null,
          p_expected_end: input.expectedEnd ?? null
        });
      } catch (error) {
        const match = Object.keys(messages).find(code => String(error.message).includes(code));
        if (match) throw Error(messages[match][language === 'zh' ? 0 : 1]);
        throw Error(language === 'zh' ? '未确认提交结果，正在刷新机位状态。' : 'Request result unknown. Refreshing floor state.');
      }
      return read();
    }
  });
}

export async function enableOfficialFloor(container, {rpc, t}) {
  if (!container?.isConnected) return;
  let initial;
  try { initial = await rpc('gg_desk_state'); } catch { return; }
  if ((!initial.connected && !initial.desk_sessions?.length) || !initial.active_stations?.length || !container.isConnected) return;

  const section = document.createElement('section');
  section.className = 'panel gg-hardware-panel';
  const title = document.createElement('h2');
  title.textContent = t('网页开台试点','Website station controls');
  const description = document.createElement('p');
  description.textContent = t('这里会操作实体电视，并自动更新官网占用。','These controls operate the TV and update website availability.');
  const body = document.createElement('div');
  section.append(title, description, body);
  container.replaceChildren(section);
  mountOfficialFloor(body, {rpc, language:t('zh','en')});
}
