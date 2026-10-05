const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/race/ai-lab.js'),'utf8');
function lab(){
 const events=[],nodes={},requests=[];
 const choices=Array.from({length:7},(_,i)=>({checked:i===6,value:i===6?'':'Preset '+(i+1)}));
 function node(id){return nodes[id] ||= {value:id==='pilot-token'?'SECRET_TOKEN':id==='question'?'PRIVATE_QUESTION':'',hidden:false,disabled:false,textContent:'',style:{},replaceChildren(){},addEventListener(type,fn){this[type]=fn;},querySelectorAll(){return choices;},querySelector(){return choices.find(x=>x.checked);},focus(){}};}
 const context=vm.createContext({document:{getElementById:node},window:{gtag:(...args)=>events.push(args)},AbortController,AbortSignal,TextEncoder,fetch:(url,options)=>new Promise((resolve,reject)=>{requests.push({resolve,reject,options});options.signal.addEventListener('abort',()=>reject(Error('Aborted')),{once:true});})});
 vm.runInContext(source,context);
 vm.runInContext("selected=[{label:'PRIVATE_FILENAME',duration:1,samples:[[0,0,0,0,0,0,0]]}];result=[{}];renderAnswer=()=>{};",context);
 return {context,events,nodes,choices,requests,node,submit:()=>node('ask-form').onsubmit({preventDefault(){}}),names:()=>events.map(e=>e[1])};
}
async function check(){
 for(const page of ['index','motorsport','racecraft','rwth','photography','corner-comparison','ai-lab']){
  const html=fs.readFileSync(path.join(root,page+'.html'),'utf8');
  assert.equal((html.match(/googletagmanager.com\/gtag\/js/g)||[]).length,1);
  const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
  new vm.Script(inline);
  for(const referrer of ['https://example.org/page?token=SECRET#fragment','','invalid','https://mingtaoyuan.github.io/ai-lab.html?question=PRIVATE#x']){
   const c={window:{},dataLayer:[],document:{referrer},location:{origin:'https://mingtaoyuan.github.io',pathname:'/ai-lab.html'},URL};
   c.window.dataLayer=c.dataLayer;vm.runInNewContext(inline,c);
   const configs=c.dataLayer.filter(x=>x[0]==='config');assert.equal(configs.length,1);
   assert.equal(configs[0][2].page_location,'https://mingtaoyuan.github.io/ai-lab.html');
   assert.ok(!/[?#]/.test(configs[0][2].page_referrer));
  }
 }
 let l=lab(),p=l.submit();await l.submit();assert.equal(l.requests.length,1);
 l.requests[0].resolve({ok:true,json:async()=>({answer:'Answer'})});await p;
 assert.deepEqual(l.names(),['lab_ai_requested','lab_ai_succeeded']);
 assert.equal(l.events[0][2].question_type,'custom');
 assert.ok(!/SECRET_TOKEN|PRIVATE_QUESTION|PRIVATE_FILENAME|samples/.test(JSON.stringify(l.events)));
 l=lab();l.choices[6].checked=false;l.choices[1].checked=true;l.node('question').value='Preset 2';
 p=l.submit();assert.equal(l.events[0][2].question_type,'preset_2');l.requests[0].reject(Error('Network'));await p;
 assert.deepEqual(l.names(),['lab_ai_requested','lab_ai_failed']);
 l=lab();l.choices[6].checked=false;l.choices[1].checked=true;l.node('question').value='Edited preset';
 p=l.submit();assert.equal(l.events[0][2].question_type,'custom');vm.runInContext('invalidateComparison();invalidateComparison();',l.context);await p;
 assert.deepEqual(l.names(),['lab_ai_requested','lab_ai_cancelled']);
 for(const response of [{ok:false,json:async()=>({detail:'Rejected'})},{ok:true,json:async()=>({answer:''})},{ok:true,json:async()=>{throw Error('Bad JSON');}}]){
  l=lab();p=l.submit();l.requests[0].resolve(response);await p;assert.deepEqual(l.names(),['lab_ai_requested','lab_ai_failed']);
 }
 l=lab();l.node('pilot-token').value='';await l.submit();assert.equal(l.requests.length,0);assert.equal(l.events.length,0);
 // Old response/catch must not complete or clear a replacement request.
 l=lab();p=l.submit();vm.runInContext('clearAnswer();',l.context);const next=l.submit();await p;
 assert.equal(l.node('ask-button').disabled,true);
 l.requests[1].resolve({ok:true,json:async()=>({answer:'Answer'})});await next;
 assert.deepEqual(l.names(),['lab_ai_requested','lab_ai_cancelled','lab_ai_requested','lab_ai_succeeded']);
 console.log('PASS: seven GA4 snippets; URL sanitization; success/failure/cancellation; stale responses; duplicate submit guard; question categories; sensitive payload exclusion.');
}
check().catch(error=>{console.error(error);process.exitCode=1;});
