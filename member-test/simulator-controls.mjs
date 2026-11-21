// Read-only until the SmartThings integration has been authorised and tested.
// Never infer physical power from a browser timer or locally stored state.
export function mountSimulators(host,{rpc,t}){
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const section=el('section');section.className='panel gg-hardware-panel';
 section.append(el('h2',t('Simulator · 设备与计时','Simulator · Devices & timers')),el('p',t('两台 Simulator 使用 SmartThings 独立连接，与大厅电视控制分开。完成设备授权及联动验收后，才开放计时开关。','The two simulators use a separate SmartThings connection. Timed controls become available after device authorisation and verification.')));
 const status=el('p'),grid=el('div');status.setAttribute('role','status');grid.className='floor-layout';section.append(status,grid);host.replaceChildren(section);
 let disposed=false;
 const draw=devices=>{grid.replaceChildren();for(const d of devices){const card=el('article');card.className='floor-station';card.append(el('h3',d.name),el('p',t('尚未连接 SmartThings','SmartThings not connected')),el('small',t('实际电源状态未读取；目前请继续使用 SmartThings。','Physical power status has not been read. Continue using SmartThings for now.')));grid.append(card);}};
 draw([{name:'Simulator 01'},{name:'Simulator 02'}]);
 status.textContent=t('正在核对接入状态…','Checking integration status…');
 void rpc('gg_simulator_state').then(data=>{if(disposed||!host.isConnected)return;if(!Array.isArray(data?.devices)||data.devices.length!==2||data.connected!==false)throw Error('INVALID_STATE');draw(data.devices);status.textContent=t('等待 SmartThings 商用接口授权；计时开关尚未开放。','Awaiting SmartThings business API authorisation. Timed controls are not enabled.');}).catch(()=>{if(!disposed&&host.isConnected)status.textContent=t('暂时无法核对接入状态；不会发送任何开关指令。','Integration status is unavailable. No power command will be sent.');});
 return()=>{disposed=true;};
}
