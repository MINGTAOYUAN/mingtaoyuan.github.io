'use strict';
const $=id=>document.getElementById(id);let laps=[], selected=[],result=null,comparisonVersion=0,askController=null;const endpoint='https://mingtao-ai-backend.vercel.app';
function track(name,params={}){try{if(typeof window.gtag==='function')window.gtag('event',name,params);}catch(_){/* Analytics must never interrupt the lab. */}}
function csv(line){return (line.match(/("(?:[^"]|"")*"|[^,]+)(,|$)/g)||[]).map(s=>s.replace(/,$/,'').replace(/^"|"$/g,'').replace(/""/g,'"'));}
function parse(text,name){const rows=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(csv);const h=rows.findIndex(r=>r[0]==='Time'&&r.includes('GPS Speed'));if(h<0)throw Error('Expected an AiM CSV with Time and GPS Speed.');const meta=Object.fromEntries(rows.slice(0,h).filter(r=>r.length).map(r=>[r[0],r.slice(1)]));const channels=['Time','Distance on GPS Speed','GPS Speed','RPM','GPS LatAcc','GPS LonAcc','Calculated Gear'];const ix=channels.map(x=>rows[h].indexOf(x));if(ix.some(i=>i<0))throw Error('Required channels: '+channels.join(', '));if(rows[h+1][ix[2]]!=='km/h'||rows[h+1][ix[1]]!=='m')throw Error('Export speed in km/h and distance in meters.');if(!meta['Beacon Markers']||!meta['Segment Times'])throw Error('Export a full session with beacon markers.');const markers=meta['Beacon Markers'].map(Number);const durations=meta['Segment Times'].map(s=>s.split(':').reduce((a,v)=>a*60+Number(v),0));const data=rows.slice(h+2).filter(r=>r.length===rows[h].length).map(r=>ix.map(i=>Number(r[i])));return durations.slice(1,-1).map((duration,k)=>{const start=markers[k],end=start+duration;let samples=data.filter(r=>r[0]>=start&&r[0]<=end);if(samples.length<20)throw Error('Insufficient samples in lap.');const d=samples[0][1];samples=samples.map(r=>[r[0]-start,r[1]-d,...r.slice(2)]);return {label:name+' · Lap '+(k+2),duration,samples};});}
function clearAnswer(){if(askController)askController.abort();askController=null;comparisonVersion++;$('answer').replaceChildren();$('next-test').hidden=true;$('next-test-body').replaceChildren();$('ask-button').disabled=false;}
function invalidateComparison(){clearAnswer();selected=[];result=null;$('results').hidden=true;$('comparison-empty').hidden=false;}
function choose(){invalidateComparison();const host=$('lap-options');host.replaceChildren();laps.forEach((lap,i)=>{const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=i<3;input.value=i;label.append(input,document.createTextNode(' '+lap.label+' — '+fmt(lap.duration)));host.append(label);});$('analyze').disabled=!laps.length;}
function fmt(s){return Math.floor(s/60)+':'+(s%60).toFixed(3).padStart(6,'0');}
function calculate(items){const output=items.map(lap=>{const s=lap.samples;if(s.some(r=>r.length!==7||r.some(v=>!Number.isFinite(v)))||s.some((r,i)=>i&&(r[0]<=s[i-1][0]||r[1]<s[i-1][1])))throw Error('Invalid or nonmonotonic samples.');let j=0;const trace=Array.from({length:201},(_,i)=>{const d=s.at(-1)[1]*i/200;while(j<s.length-2&&s[j+1][1]<d)j++;const a=s[j],b=s[j+1],f=b[1]>a[1]?(d-a[1])/(b[1]-a[1]):0;return a.map((v,k)=>v+f*(b[k]-v));});trace[0][0]=0;trace.at(-1)[0]=lap.duration;return {...lap,trace,distance:s.at(-1)[1]};});output.forEach(l=>l.delta=l.trace.map((r,i)=>r[0]-output[0].trace[i][0]));return output;}
function plot(canvas,channel,delta=false){const ctx=canvas.getContext('2d');canvas.width=1000;canvas.height=300;ctx.clearRect(0,0,1000,300);const values=result.flatMap(l=>delta?l.delta:l.trace.map(r=>r[channel]));let lo=Math.min(...values),hi=Math.max(...values);if(hi===lo)hi=lo+1;ctx.strokeStyle='#394141';ctx.fillStyle='#a7afad';ctx.font='14px Arial';for(let k=0;k<5;k++){let y=25+k*58;ctx.beginPath();ctx.moveTo(60,y);ctx.lineTo(980,y);ctx.stroke();ctx.fillText((hi-(hi-lo)*k/4).toFixed(1),5,y+5);}result.forEach((lap,n)=>{ctx.strokeStyle=['#c7ee4b','#6ac9ee','#ff9d76','#d7a6ff','#fff','#ffdb69'][n];ctx.lineWidth=2;ctx.beginPath();lap.trace.forEach((r,i)=>{let x=60+i/200*920,y=25+(hi-(delta?lap.delta[i]:r[channel]))/(hi-lo)*232;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();});ctx.fillStyle='#a7afad';ctx.fillText('0%                          Normalized lap distance                          100%',260,290);}
function render(){result=calculate(selected);$('results').hidden=false;$('comparison-empty').hidden=true;const table=$('lap-table');table.replaceChildren();result.forEach((l,i)=>{const row=document.createElement('tr');[l.label,fmt(l.duration),(l.duration-result[0].duration).toFixed(3)+' s',l.distance.toFixed(1)+' m',Math.max(...l.samples.map(r=>r[2])).toFixed(1)+' km/h'].forEach(v=>{const td=document.createElement('td');td.textContent=v;row.append(td);});table.append(row);});[['speed',2],['delta',0,true]].forEach(([id,c,d])=>plot($(id),c,d));const best=result.reduce((a,b)=>a.duration<b.duration?a:b);$('insight').textContent='Measured: '+best.label+' is '+(result[0].duration-best.duration).toFixed(3)+' s quicker than the reference. This does not establish why. Use the speed and delta traces as evidence for your question below. No throttle or brake-pressure channel was recorded.';$('results').scrollIntoView({behavior:'smooth'});}

function renderAnswer(text){
 const host=$('answer'),next=$('next-test-body');host.replaceChildren();next.replaceChildren();host.style.whiteSpace='normal';let list=null,target=host,hasNext=false;
 function inline(node,value){value.split(/(\*\*[^*]+\*\*)/g).forEach(part=>{if(part.startsWith('**')&&part.endsWith('**')){const strong=document.createElement('strong');strong.textContent=part.slice(2,-2);node.append(strong);}else node.append(document.createTextNode(part));});}
 for(const raw of String(text).split(/\r?\n/)){
  let line=raw;
  const heading=line.trim().replace(/^#{1,6}\s*/,'').replace(/\*\*/g,'');
  const test=heading.match(/^(?:Next Test|下一次测试|下次测试|下一步测试)\s*[:：—-]?\s*(.*)$/i);
  if(test){hasNext=true;target=next;list=null;line=test[1];}
  if(!line.trim()){list=null;continue;}
  const match=line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
  if(match){if(!list){list=document.createElement('ul');target.append(list);}const item=document.createElement('li');inline(item,match[1]);list.append(item);}
  else{list=null;const p=document.createElement('p');p.style.margin='16px 0';inline(p,line.replace(/^#{1,6}\s+/,''));target.append(p);}
 }
 if(!hasNext||!next.textContent.trim()){const p=document.createElement('p');p.textContent='Review the highlighted region with your instructor and synchronized video. Agree on one controlled change, then compare repeat laps under similar conditions. Confirm the hypothesis before changing your driving.';next.append(p);}
 $('next-test').hidden=false;
}

$('files').addEventListener('change',async e=>{try{invalidateComparison();laps=[];$('lap-options').replaceChildren();$('analyze').disabled=true;for(const file of e.target.files){if(file.size>20000000)throw Error('Each file must be under 20 MB.');laps.push(...parse(await file.text(),file.name));}choose();track('lab_csv_loaded',{file_count:e.target.files.length,lap_count:laps.length});$('status').textContent='Select up to six laps. First and last session segments excluded.';}catch(e){$('status').textContent=e.message;}});
$('demo').onclick=async()=>{try{invalidateComparison();const response=await fetch('assets/data/ai-demo.json');if(!response.ok)throw Error('Could not load demo.');laps=(await response.json()).laps;choose();track('lab_demo_loaded');$('status').textContent='Real Buttonwillow telemetry · April 20, 2026';}catch(e){$('status').textContent=e.message;}};
$('lap-options').addEventListener('change',()=>{invalidateComparison();$('status').textContent='Selection changed. Click Compare Selected Laps to update the evidence.';});
$('analyze').onclick=async()=>{try{invalidateComparison();selected=[...$('lap-options').querySelectorAll('input:checked')].map(x=>laps[Number(x.value)]);if(!selected.length||selected.length>6)throw Error('Select one to six laps.');render();track('lab_analysis_completed',{lap_count:selected.length});$('status').textContent='Computed locally. Speed and delta comparison ready. Choose a question below and enter your pilot access token.';}catch(e){$('status').textContent=e.message;}};
$('ask-form').onsubmit=async e=>{
 e.preventDefault();let sent=false,version=comparisonVersion;
 try{
  if(!result||!selected.length)throw Error('Compare selected laps first.');
  if(!$('pilot-token').value.trim())throw Error('Enter your private pilot access token.');
  const question=$('question').value.trim();if(!question||question.length>1000)throw Error('Question must be 1–1000 characters.');
  const guidance='Answer this as a focused diagnostic, not a full report. Use only computed evidence, distinguish possible causes from measurements, and do not invent named corners or pedal inputs. Finish with a heading exactly "Next Test" and one controlled experiment to review with an instructor. Question: ';
  const payload=JSON.stringify({laps:selected,question:guidance+question});
  if(new TextEncoder().encode(payload).length>3500000)throw Error('Select fewer laps.');
  clearAnswer();version=comparisonVersion;const controller=new AbortController();askController=controller;
  $('ask-button').disabled=true;$('answer').textContent='Reviewing lap evidence…';track('lab_ai_requested',{lap_count:selected.length});sent=true;
  const r=await fetch(endpoint+'/api/ask',{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(75000)]),method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+$('pilot-token').value},body:payload});
  const d=await r.json();if(version!==comparisonVersion)return;
  if(!r.ok)throw Error(r.status===403?'Access token was not accepted. Check your private pilot token.':d.detail||'Request failed.');
  if(typeof d.answer!=='string'||!d.answer.trim())throw Error('No answer was returned. Please try again.');
  renderAnswer(d.answer);track('lab_ai_succeeded');
 }catch(e){if(version!==comparisonVersion)return;if(sent)track('lab_ai_failed');$('answer').textContent=e.message;}
 finally{if(version===comparisonVersion){askController=null;$('ask-button').disabled=false;}}
};

$('question-choice').addEventListener('change',event=>{if(event.target.name==='analysis-question'){track('lab_question_selected',{question_index:[...$('question-choice').querySelectorAll('input')].indexOf(event.target)+1});$('question').value=event.target.value;$('question').focus();}});
$('question').addEventListener('input',()=>{const chosen=$('question-choice').querySelector('input:checked');if(chosen&&$('question').value!==chosen.value)$('question-choice').querySelector('input[value=""]').checked=true;});
