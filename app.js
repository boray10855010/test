const KEY="action-piggy-v1";
const defaultState={tasks:[],sessions:{},settings:{settlementTime:"03:00"}};
let state=load();
const $=id=>document.getElementById(id);

const COMPANION={
  lazy:"companions/companion-lazy.png",
  work:"companions/companion-work.png",
  tired:"companions/companion-tired.png",
  night:"companions/companion-night.png"
};
const DEFEAT_VARIANTS=[
  "companions/defeat-ko.png",
  "companions/defeat-shock.jpg",
  "companions/defeat-tentacle.jpg",
  "companions/defeat-rope-arms.png",
  "companions/defeat-rope-hang.jpg"
];
const COMPANION_LINE={
  idle:"?ˆè¨­å®šä?å¤©ç?é«”å???,
  lazy:"?å??‹å?ï¼Ÿâ€¦å—¯??,
  work:"?„è?ï¼Œåˆ¥å¤ªè²ª??,
  tired:"ä½ é?è¦å?ï¼Ÿå¥¹?ˆè?ä¸€ç­†ã€?,
  defeat:"ç«™ä?å¤ªèµ·ä¾†ä??¦ä?å¤©å·®ä¸å?äº†ã€?,
  night:"ä»Šæ?æ­¸ä?äº†ã€?
};

function load(){try{const raw={...defaultState,...JSON.parse(localStorage.getItem(KEY)||"{}")};raw.settings={...defaultState.settings,...(raw.settings||{})};return raw}catch{return structuredClone(defaultState)}}
function persist(){localStorage.setItem(KEY,JSON.stringify(state))}
function save(){persist();render()}
function uid(){return crypto.randomUUID?.()||Date.now()+Math.random().toString(16).slice(2)}
function actionDate(now=new Date()){
  const [h,m]=state.settings.settlementTime.split(":").map(Number);
  const boundary=new Date(now);boundary.setHours(h,m,0,0);
  if(now<boundary)boundary.setDate(boundary.getDate()-1);
  return boundary.toLocaleDateString("en-CA");
}
function todaySession(){return state.sessions[actionDate()]}
function ensureRollover(){
  const today=actionDate();
  Object.values(state.sessions).filter(s=>!s.settledAt&&s.date!==today).forEach(s=>settleSession(s,"automatic"));
}
function settleSession(s,type){
  if(s.settledAt)return;
  s.settlementType=type;s.settledAt=new Date().toISOString();s.leisureEnergy=type==="manual"?s.remainingEnergy:0;
  state.tasks.forEach(t=>{if(t.status!=="pending")return;const result=s.results?.find(r=>r.taskId===t.id);if(!result)s.results.push({taskId:t.id,result:"untouched",energySpent:0,workScore:0});});
}
function startDay(energy){state.sessions[actionDate()]={date:actionDate(),initialEnergy:energy,remainingEnergy:energy,settledAt:null,leisureEnergy:0,results:[]};save()}
function multiplier(type){return {mandatory:1,deferrable:1.05,unlimited:1.2}[type]}
function remainingDays(t){if(!t.latestStartDate)return Infinity;return Math.ceil((new Date(t.latestStartDate+"T12:00:00")-new Date(actionDate()+"T12:00:00"))/86400000)}
function sortedTasks(){return state.tasks.filter(t=>t.status==="pending").sort((a,b)=>{const rank={mandatory:0,deferrable:1,unlimited:2};return rank[a.priority]-rank[b.priority]||remainingDays(a)-remainingDays(b)||a.createdAt.localeCompare(b.createdAt)})}
function plannedTasks(){const s=todaySession();if(!s||s.settledAt)return[];let budget=s.remainingEnergy;const done=new Set(s.results.map(r=>r.taskId));const output=[];for(const t of sortedTasks()){if(done.has(t.id))continue;if(t.priority==="mandatory"||t.energy<=budget){output.push(t);budget-=t.energy}}return output}
function resultTask(taskId,result){const s=todaySession();if(!s||s.settledAt)return;const t=state.tasks.find(x=>x.id===taskId);if(!t)return;const spent=result==="completed"?Math.min(t.energy,s.remainingEnergy):0;s.results.push({taskId,result,energySpent:spent,workScore:spent*multiplier(t.priority)});if(result==="completed"){s.remainingEnergy-=spent;t.status="completed";t.completedAt=new Date().toISOString()}toast(result==="completed"?`å®Œæ?äº†ï??•å…¥ ${spent} é»è??•å?`:`ä»Šå¤©?ˆæ”¾ä¸‹ã€?{t.title}?`);save()}
function weekStart(date=new Date()){const d=new Date(date);const day=(d.getDay()+6)%7;d.setHours(0,0,0,0);d.setDate(d.getDate()-day);return d}
function weekSessions(){const start=weekStart();return Object.values(state.sessions).filter(s=>new Date(s.date+"T12:00:00")>=start)}
function stats(){const ss=weekSessions();const results=ss.flatMap(s=>s.results||[]);const work=results.reduce((n,r)=>n+r.workScore,0);const leisure=ss.reduce((n,s)=>n+(s.leisureEnergy||0),0);const factor=leisure>=30?1:.8+.2*(leisure/30);return{work,leisure,factor,total:(work+.5*leisure)*factor,completed:results.filter(r=>r.result==="completed").length,abandoned:results.filter(r=>r.result==="abandoned").length,ss}}
function label(type){return{mandatory:"ä¸€å®šè?",deferrable:"?¯æ?å»?,unlimited:"?¡é??¨é²"}[type]}
function spentRatio(s){if(!s||!s.initialEnergy)return 0;return Math.max(0,Math.min(1,(s.initialEnergy-s.remainingEnergy)/s.initialEnergy))}
function companionMood(s){if(!s)return"idle";if(s.settledAt)return"night";const r=spentRatio(s);if(r>=.8)return"defeat";if(r>=.55)return"tired";if(r>=.25)return"work";return"lazy"}
function ensureDefeatPick(){const day=actionDate();const pick=state.settings.defeatPick;if(pick&&pick.date===day&&DEFEAT_VARIANTS.includes(pick.src))return pick.src;const src=DEFEAT_VARIANTS[Math.floor(Math.random()*DEFEAT_VARIANTS.length)];state.settings.defeatPick={date:day,src};persist();return src}
function companionSrc(mood){if(mood==="defeat")return ensureDefeatPick();if(mood==="idle")return COMPANION.lazy;return COMPANION[mood]||COMPANION.work}
function renderCompanion(s){
  const mood=companionMood(s);
  const root=$("companion");const img=$("companionImg");const line=$("companionLine");
  if(!root||!img||!line)return;
  root.dataset.mood=mood;
  document.body.classList.toggle("night",mood==="night");
  const src=companionSrc(mood);
  if(img.dataset.src!==src){img.src=src;img.dataset.src=src}
  img.alt={idle:"å¾…é?å§?,lazy:"?¶æ•£",work:"ä¸Šå·¥",tired:"?²æ?",defeat:"?°æ?",night:"å¤œæ?"}[mood]||"ä»Šæ—¥?€??;
  line.textContent=COMPANION_LINE[mood]||"";
}
function taskCard(t,library=false){const days=remainingDays(t);return `<article class="task-card"><div><div class="task-title">${escapeHtml(t.title)}</div><div class="task-meta"><span class="tag ${t.priority}">${label(t.priority)}</span><span>${t.energy} é«”å?</span>${t.priority==="deferrable"?`<span>${days<=0?"ä»Šå¤©?°æ?":`??${days} å¤©`}</span>`:""}</div></div><div class="task-actions">${library?`<button onclick="editTask('${t.id}')" aria-label="ç·¨è¼¯">??/button>`:`<button onclick="resultTask('${t.id}','abandoned')" aria-label="ä»Šå¤©?¾æ?">??/button><button onclick="resultTask('${t.id}','completed')" aria-label="å®Œæ?">??/button>`}</div></article>`}
function render(){
  const date=new Date(actionDate()+"T12:00:00");$("todayLabel").textContent=date.toLocaleDateString("zh-TW",{month:"long",day:"numeric",weekday:"short"});
  const s=todaySession(),st=stats();$("remainingEnergy").textContent=s?.remainingEnergy??"??;$("initialEnergy").textContent=s?.initialEnergy??"??;$("energyBar").style.width=s?`${Math.max(0,s.remainingEnergy/s.initialEnergy*100)||0}%`:"0%";
  $("todayWorkScore").textContent=(s?.results||[]).reduce((n,r)=>n+r.workScore,0).toFixed(1);$("weekLeisure").textContent=st.leisure;
  const planned=plannedTasks();$("todayTasks").innerHTML=planned.map(t=>taskCard(t)).join("");$("emptyToday").classList.toggle("hidden",planned.length>0);
  const settled=!!s?.settledAt;
  $("settleButton").disabled=!s||settled;$("settleButton").style.opacity=settled?.5:1;
  const settleTitle=$("settleButton").querySelector("span");const settleSub=$("settleButton").querySelector("small");
  if(settleTitle&&settleSub){if(settled){settleTitle.textContent="ä»Šæ?æ­¸ä?äº?;settleSub.textContent="ä»Šå¤©ä¸å?å®‰æ?å·¥ä?"}else{settleTitle.textContent="ä»Šå¤©å°±åˆ°?™è£¡";settleSub.textContent="?Šå‰©é¤˜é??›ç?çµ¦è‡ªå·?}}
  renderCompanion(s);
  $("taskLibrary").innerHTML=sortedTasks().map(t=>taskCard(t,true)).join("")||`<div class="empty-state"><div class="empty-icon">??/div><h3>ä»»å?åº«æ˜¯ç©ºç?</h3><p>?°å?ç¬¬ä?ä»¶æƒ³å®Œæ??„ä???/p></div>`;
  $("weekTotalScore").textContent=st.total.toFixed(1);$("weekMultiplier").textContent=`å¹³è¡¡?ç? ?${st.factor.toFixed(2)}`;$("reportWork").textContent=st.work.toFixed(1);$("reportLeisure").textContent=st.leisure;$("reportCompleted").textContent=st.completed;$("reportAbandoned").textContent=st.abandoned;
  $("dailyReports").innerHTML=[...st.ss].sort((a,b)=>b.date.localeCompare(a.date)).map(x=>{const w=(x.results||[]).reduce((n,r)=>n+r.workScore,0);return `<div class="report-day"><span>${new Date(x.date+"T12:00:00").toLocaleDateString("zh-TW",{month:"numeric",day:"numeric",weekday:"short"})}</span><span>å·¥ä? <b>${w.toFixed(1)}</b>?€äº«æ? <b>${x.leisureEnergy||0}</b></span></div>`}).join("")||`<p class="muted">?™é€±é?æ²’æ?çµç?ç´€?„ã€?/p>`;
}
function escapeHtml(s){return s.replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200)}
function openTask(){$("taskForm").reset();$("taskId").value="";$("taskEnergy").value=10;$("taskDelay").value=3;toggleDelay();$("taskDialog").showModal()}
function editTask(id){const t=state.tasks.find(x=>x.id===id);$("taskId").value=t.id;$("taskTitle").value=t.title;$("taskEnergy").value=t.energy;$("taskPriority").value=t.priority;$("taskDelay").value=Math.max(0,remainingDays(t));toggleDelay();$("taskDialog").showModal()}
function toggleDelay(){$("delayField").classList.toggle("hidden",$("taskPriority").value!=="deferrable")}

document.querySelectorAll(".bottom-nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".view,.bottom-nav button").forEach(x=>x.classList.remove("active"));$(b.dataset.view).classList.add("active");b.classList.add("active");render()});
$("energyInput").oninput=e=>$("energyOutput").value=e.target.value;$("adjustInput").oninput=e=>$("adjustOutput").value=e.target.value;$("taskPriority").onchange=toggleDelay;
$("quickAddButton").onclick=$("addTaskButton").onclick=openTask;
$("energyForm").onsubmit=e=>{if(e.submitter?.value==="confirm")startDay(Number($("energyInput").value))};
$("taskForm").onsubmit=e=>{if(e.submitter?.value!=="confirm")return;const id=$("taskId").value;let t=state.tasks.find(x=>x.id===id);const delay=Number($("taskDelay").value);const deadline=new Date(actionDate()+"T12:00:00");deadline.setDate(deadline.getDate()+delay);const data={title:$("taskTitle").value.trim(),energy:Number($("taskEnergy").value),priority:$("taskPriority").value,latestStartDate:$("taskPriority").value==="deferrable"?deadline.toLocaleDateString("en-CA"):null};if(t)Object.assign(t,data);else state.tasks.push({id:uid(),...data,status:"pending",createdAt:new Date().toISOString()});save()};
$("adjustEnergyButton").onclick=()=>{const s=todaySession();if(!s)return $("energyDialog").showModal();$("adjustInput").max=s.initialEnergy;$("adjustInput").value=s.remainingEnergy;$("adjustOutput").value=s.remainingEnergy;$("adjustDialog").showModal()};
$("adjustForm").onsubmit=e=>{if(e.submitter?.value==="confirm"){todaySession().remainingEnergy=Number($("adjustInput").value);save()}};
$("settleButton").onclick=()=>{const s=todaySession();if(!s)return $("energyDialog").showModal();$("settleWork").textContent=s.results.reduce((n,r)=>n+r.workScore,0).toFixed(1);$("settleLeisure").textContent=s.remainingEnergy;$("settleDialog").showModal()};
$("settleForm").onsubmit=e=>{if(e.submitter?.value==="confirm"){settleSession(todaySession(),"manual");save();toast("?¶å·¥?å?ï¼Œä??šæ­¸ä½ ä?")}};
$("settingsButton").onclick=()=>{$("settlementTime").value=state.settings.settlementTime;$("settingsDialog").showModal()};
$("settingsForm").onsubmit=e=>{if(e.submitter?.value==="confirm"){state.settings.settlementTime=$("settlementTime").value;save()}};
$("exportButton").onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`è¡Œå??²æ»¿-${actionDate()}.json`;a.click();URL.revokeObjectURL(a.href)};

ensureRollover();save();if(!todaySession())$("energyDialog").showModal();
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js");
