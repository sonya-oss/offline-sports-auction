const $ = id => document.getElementById(id);
const ROLE_MAP = {
  Cricket: ['Batter','Bowler','All-rounder','Wicketkeeper'],
  Kabaddi: ['Raider','Defender','All-rounder'],
  Football: ['Goalkeeper','Defender','Midfielder','Forward'],
  Custom: ['Player','Attacker','Defender','All-rounder']
};
const state = {code:null, hostId:null, teamId:null, room:null, busy:false, lastStatus:null};
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const symbolFor = sport => ({Cricket:'🏏',Kabaddi:'🤼',Football:'⚽',Custom:'🏆'}[sport] || '🏆');
function showNotice(message, good=false) { const n=$('notice'); n.textContent=message; n.classList.remove('hidden','good'); if(good)n.classList.add('good'); window.scrollTo({top:0,behavior:'smooth'}); }
function hideNotice(){ $('notice').classList.add('hidden'); }
async function api(path, data={}, method='POST') {
  const opts = method==='GET' ? {} : {method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)};
  const response = await fetch(path + (method==='GET' ? (path.includes('?')?'&':'?') + new URLSearchParams(data) : ''), opts);
  const payload = await response.json(); if(!response.ok || !payload.ok) throw new Error(payload.error || 'Something went wrong.'); return payload;
}
function setRoles() {
  const sport=$('sport').value, select=$('playerRole'), current=select.value;
  select.innerHTML=(ROLE_MAP[sport] || ROLE_MAP.Custom).map(r=>`<option>${esc(r)}</option>`).join('');
  if([...select.options].some(o=>o.value===current))select.value=current;
}
$('sport').addEventListener('change', setRoles); setRoles();
function persist(){ localStorage.setItem('osa_session', JSON.stringify({code:state.code,hostId:state.hostId,teamId:state.teamId})); }
function restore(){ try { const s=JSON.parse(localStorage.getItem('osa_session')||'{}'); Object.assign(state,{code:s.code||null,hostId:s.hostId||null,teamId:s.teamId||null}); }catch{} }
function isHost(){return Boolean(state.hostId)}
function activeTeam(){return state.room?.teams?.find(t=>t.id===state.teamId)}
function goTo(id){['home','lobby','auction'].forEach(k=>$(k).classList.toggle('hidden',k!==id));}
$('createForm').addEventListener('submit', async e=>{
 e.preventDefault(); hideNotice(); try{
  const data=await api('/api/create',{host_name:$('hostName').value,sport:$('sport').value,budget:$('budget').value,min_increment:$('increment').value});
  state.code=data.code;state.hostId=data.host_id;state.teamId=null;persist();state.room=data.room;render();goTo('lobby');startPolling();showNotice('Room created. Add players, then share the invite link with friends.',true);
 }catch(err){showNotice(err.message)}
});
$('joinForm').addEventListener('submit', async e=>{
 e.preventDefault(); hideNotice(); try{
  const code=$('joinCode').value.trim().toUpperCase(); const data=await api('/api/join',{code,name:$('joinName').value,team_name:$('joinTeam').value});
  state.code=code;state.hostId=null;state.teamId=data.team_id;persist();state.room=data.room;render();goTo(state.room.status==='setup'?'lobby':'auction');startPolling();showNotice('You joined as '+$('joinTeam').value+'. Keep this tab open during the auction.',true);
 }catch(err){showNotice(err.message)}
});
$('joinCode').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6));
$('hostTeamForm').addEventListener('submit',async e=>{e.preventDefault();try{const d=await api('/api/host_team',{code:state.code,host_id:state.hostId,name:$('hostTeamName').value,team_name:$('hostTeamNameTeam').value});state.room=d.room;state.teamId=d.team_id;persist();render();$('hostTeamForm').classList.add('hidden');}catch(err){showNotice(err.message)}});
$('playerForm').addEventListener('submit',async e=>{e.preventDefault();try{const d=await api('/api/player',{code:state.code,host_id:state.hostId,name:$('playerName').value,role:$('playerRole').value,base_price:$('basePrice').value});state.room=d.room;$('playerName').value='';render();}catch(err){showNotice(err.message)}});
$('startAuction').addEventListener('click',async()=>{try{const d=await api('/api/start',{code:state.code,host_id:state.hostId});state.room=d.room;render();}catch(err){showNotice(err.message)}});
$('copyLink').addEventListener('click',async()=>{const url=location.origin;try{await navigator.clipboard.writeText(`Join my Offline Sports Auction! Room code: ${state.code}\nOpen: ${url}`);showNotice('Invite details copied. Send them to friends on the same Wi-Fi.',true)}catch{showNotice(`Share this address with friends: ${location.origin} — room code ${state.code}`,true)}});
$('bidButton').addEventListener('click',async()=>{if(!state.teamId)return showNotice('Join this room on your device first.');try{const d=await api('/api/bid',{code:state.code,team_id:state.teamId});state.room=d.room;render()}catch(err){showNotice(err.message)}});
$('closeBidding').addEventListener('click',async()=>{try{const d=await api('/api/close_player',{code:state.code,host_id:state.hostId});state.room=d.room;render()}catch(err){showNotice(err.message)}});
$('nextPlayer').addEventListener('click',async()=>{try{const d=await api('/api/next',{code:state.code,host_id:state.hostId});state.room=d.room;render()}catch(err){showNotice(err.message)}});
async function removePlayer(id){try{const d=await api('/api/remove_player',{code:state.code,host_id:state.hostId,player_id:id});state.room=d.room;render()}catch(err){showNotice(err.message)}}
function render(){const r=state.room;if(!r)return;
 $('roomTitle').textContent=r.sport+' Auction Room';$('roomSubtitle').textContent=`Budget ${money(r.budget)} per team · Minimum increment ${money(r.min_increment)}`;$('roomCode').textContent=r.code;$('auctionCode').textContent=r.code;$('auctionSport').textContent=r.sport.toUpperCase()+' AUCTION';
 $('playerCount').textContent=`${r.players.length} player${r.players.length===1?'':'s'}`;$('teamCount').textContent=`${r.teams.length} team${r.teams.length===1?'':'s'}`;
 $('setupPlayers').classList.toggle('empty',!r.players.length);$('setupPlayers').innerHTML=r.players.length?r.players.map(p=>`<div class="player-row"><div class="player-avatar">${esc(p.name.slice(0,1).toUpperCase())}</div><div class="player-info"><strong>${esc(p.name)}</strong><small>${esc(p.role)}</small></div><span class="price-tag">${money(p.base_price)}</span>${isHost()&&r.status==='setup'?`<button class="remove" title="Remove player" onclick="removePlayer('${esc(p.id)}')">×</button>`:''}</div>`).join(''):'Add your first player above.';
 $('teamsList').classList.toggle('empty',!r.teams.length);$('teamsList').innerHTML=r.teams.length?r.teams.map(t=>`<div class="team-row"><div class="player-avatar">${esc(t.team_name.slice(0,1).toUpperCase())}</div><div class="player-info"><strong>${esc(t.team_name)}</strong><small>${esc(t.name)}${state.teamId===t.id?' · YOU':''}</small></div><span class="team-budget">${money(t.budget)}<small> left</small></span></div>`).join(''):'Waiting for friends to join…';
 $('hostSetup').classList.toggle('hidden',!isHost());$('copyLink').classList.toggle('hidden',!isHost());$('hostTeamSetup').classList.toggle('hidden',!isHost()||r.teams.some(t=>t.name===( $('hostTeamName').value || $('hostName').value )));
 if(r.status==='setup'){goTo('lobby');return;}
 goTo('auction'); const p=r.current_player; const live=r.status==='live'&&p&&p.status==='live';
 $('auctionStatus').textContent=r.status==='finished'?'AUCTION COMPLETE':live?'AUCTION LIVE':'PLAYER CLOSED';$('playerSymbol').textContent=symbolFor(r.sport);$('playerProgress').textContent=`${Math.min(r.current_index+1,r.players.length)} / ${r.players.length}`;
 $('currentPlayer').textContent=p?p.name:'Auction complete';$('playerRoleBadge').textContent=p?p.role.toUpperCase():'RESULTS';$('currentPrice').textContent=money(p?(p.bid_team_id?p.current_bid:p.base_price):0);$('baseDisplay').textContent=money(p?p.base_price:0);$('incrementDisplay').textContent=money(r.min_increment);const bidder=p&&p.bid_team_id?r.teams.find(t=>t.id===p.bid_team_id):null;$('highestBidder').textContent=bidder?`Highest bid by ${bidder.team_name}`:(live?'No bids yet — base price is the opening bid.':'');
 $('bidActions').classList.toggle('hidden',!live||!state.teamId);$('hostActions').classList.toggle('hidden',!isHost()||r.status!=='live');$('closeBidding').disabled=!live;$('closeBidding').textContent=p&&p.bid_team_id?'Close bidding / Sell player':'Close bidding / Mark unsold';
 const own=activeTeam();$('bidButton').disabled=!own||!live||own.id===(p&&p.bid_team_id)||own.budget<(p?(p.bid_team_id?p.current_bid+r.min_increment:p.base_price):Infinity)||own.roster.length>=25;
 $('liveTeams').innerHTML=r.teams.map(t=>`<div class="team-row"><div class="player-avatar">${esc(t.team_name.slice(0,1).toUpperCase())}</div><div class="player-info"><strong>${esc(t.team_name)}</strong><small>${t.roster.length} player${t.roster.length===1?'':'s'} · spent ${money(t.spent)}</small></div><span class="team-budget">${money(t.budget)}<small> left</small></span></div>`).join('')||'<div class="empty">No teams yet.</div>';
 $('activity').textContent=r.last_message||'Auction ready.';
 $('resultCount').textContent=`${r.players.filter(x=>x.status==='sold').length} sold · ${r.players.filter(x=>x.status==='unsold').length} unsold`;
 $('resultsList').innerHTML=r.teams.map(t=>`<div class="result-team"><div class="result-head"><strong>${esc(t.team_name)}</strong><span>${money(t.budget)} left</span></div><p>${esc(t.name)} · ${t.roster.length} players · spent ${money(t.spent)}</p>${t.roster.length?t.roster.map(x=>`<span class="roster-chip">${esc(x.name)} · ${money(x.price)}</span>`).join(''):'<span class="muted small">No players purchased yet.</span>'}</div>`).join('');
 const unsold=r.players.filter(x=>x.status==='unsold');if(unsold.length)$('resultsList').insertAdjacentHTML('beforeend',`<div class="result-team"><div class="result-head"><strong>Unsold players</strong><span class="unsold-label">${unsold.length}</span></div>${unsold.map(x=>`<span class="roster-chip">${esc(x.name)} · ${esc(x.role)}</span>`).join('')}</div>`);
 if(r.status==='finished'){$('bidActions').classList.add('hidden');$('hostActions').classList.add('hidden');$('currentPlayer').textContent='Auction complete!';$('currentPrice').textContent='🏆';$('highestBidder').textContent='Final team results are below.';}
}
let pollTimer=null;
function startPolling(){if(pollTimer)clearInterval(pollTimer);pollTimer=setInterval(async()=>{if(!state.code||state.busy)return;state.busy=true;try{const d=await api('/api/state',{code:state.code},'GET');state.room=d.room;render()}catch(err){/* Brief network interruptions are retried on the next poll. */}finally{state.busy=false}},1000)}
restore();
if(state.code){api('/api/state',{code:state.code},'GET').then(d=>{state.room=d.room;render();startPolling()}).catch(()=>{localStorage.removeItem('osa_session');Object.assign(state,{code:null,hostId:null,teamId:null,room:null});goTo('home')})}
