'use strict';
(async function(){
 const $=id=>document.getElementById(id),endpoint='https://mingtao-ai-backend.vercel.app';
 let data,hits=[],currentQuestion='',controller=null,version=0,available=true,availabilityMessage='Checking AI availability…';
 function clearGenerated(){version++;if(controller)controller.abort();controller=null;$('generated-answer').hidden=true;$('generate-button').disabled=true;}
 function paragraph(host,text,cls){const p=document.createElement('p');p.textContent=text;if(cls)p.className=cls;host.append(p);return p;}
 function showSources(host,entry){
  const list=document.createElement('ul');list.className='source-list';
  for(const id of entry.source_ids){const source=data.sources[id],li=document.createElement('li'),a=document.createElement('a');a.href=source.url;a.textContent=source.title;a.target='_blank';a.rel='noopener noreferrer';li.append(a);if(source.scope)paragraph(li,source.scope);list.append(li);}host.append(list);
 }
 function runSearch(){
  clearGenerated();const question=$('engineering-question').value.trim();currentQuestion=question;
  if(!question||question.length>1000){$('search-status').textContent='Enter a question of 1–1000 characters.';return;}
  hits=KnowledgeSearch.search(data,question);const host=$('knowledge-results');host.replaceChildren();
  $('evidence-section').hidden=!hits.length;$('generation-section').hidden=!hits.length;
  $('search-status').textContent=hits.length?`${hits.length} related notes found. Matching keywords suggest relevance, not certainty.`:'No supporting entry found. Try another engineering question; this library cannot verify that topic.';
  hits.forEach(({entry,matched})=>{
   const card=document.createElement('article');card.className='knowledge-card';card.id='note-'+entry.id;
   const names={public_reference:'Public reference · original summary',original_method:'Original method note · project-authored',simplified_model:'Simplified model · assumptions apply'};
   paragraph(card,names[entry.basis],'basis');const title=document.createElement('h3');title.textContent=entry.question;card.append(title);
   paragraph(card,entry.answer);if(entry.source_section)paragraph(card,'Relevant section: '+entry.source_section,'small');paragraph(card,'Limits: '+entry.limits,'limit');showSources(card,entry);
   paragraph(card,'Matched: '+[...new Set(matched)].join(', ')+' · '+entry.id+' · reviewed '+entry.reviewed_on,'match');host.append(card);
  });
  $('generate-button').disabled=!available||!hits.length;
 }
 $('engineering-question').addEventListener('input',()=>{clearGenerated();$('ai-status').textContent='Search again to update the evidence for your edited question.';});
 $('knowledge-form').addEventListener('submit',e=>{e.preventDefault();if(data){runSearch();$('ai-status').textContent=availabilityMessage;}});
 for(const b of document.querySelectorAll('[data-question]'))b.addEventListener('click',()=>{$('engineering-question').value=b.dataset.question;$('knowledge-form').requestSubmit();});
 $('generate-button').addEventListener('click',async()=>{
  if(controller||!available||!hits.length||currentQuestion!==$('engineering-question').value.trim())return;
  clearGenerated();const v=version;controller=new AbortController();$('ai-status').textContent='Connecting the retrieved principles…';
  try{
   const response=await fetch(endpoint+'/api/knowledge/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:currentQuestion}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)])});
   if(v!==version)return;
   if(!response.ok)throw Error(response.status===429?'AI allowance reached. The notes and sources above remain available.':response.status===403?'Public AI is disabled by the server. The notes and sources remain available.':response.status===503?'AI service or shared quota controls are temporarily unavailable. The notes and sources remain available.':response.status===404?'AI endpoint was not found. Please try again later.':'AI could not return a verified explanation. Please use the source-linked notes.');
   const value=await response.json();if(v!==version)return;
   const g=value.generated,allowed=new Set(hits.map(h=>h.entry.id));
   if(value.version!==data.version||value.mode!=='generated'||!g||!Array.isArray(g.explanation)||!g.explanation.length||g.explanation.length>4||typeof g.reasoning!=='string'||typeof g.unknowns!=='string')throw Error('AI response could not be verified. Please use the source-linked notes.');
   if(g.explanation.some(p=>typeof p.text!=='string'||!Array.isArray(p.evidence_ids)||!p.evidence_ids.length||p.evidence_ids.some(id=>!allowed.has(id))))throw Error('AI citations could not be verified. Please use the source-linked notes.');
   const host=$('generated-explanation');host.replaceChildren();
   for(const p of g.explanation){paragraph(host,p.text);const refs=paragraph(host,'Based on: ','small');for(const id of [...new Set(p.evidence_ids)]){const a=document.createElement('a');a.href='#note-'+id;a.textContent=id;refs.append(a,document.createTextNode(' '));}}
   $('generated-reasoning').textContent=g.reasoning;$('generated-unknowns').textContent=g.unknowns;$('generated-answer').hidden=false;
   $('ai-status').textContent='AI explanation ready. Citation IDs were checked; accuracy still needs your judgment.';
  }catch(error){if(v!==version)return;$('ai-status').textContent=error.name==='TimeoutError'?'AI request timed out. Please try again later.':error.name==='TypeError'?'Could not reach the AI server from this browser or network. Try another connection or browser.':error.message;}
  finally{if(v===version){controller=null;$('generate-button').disabled=!available;}}
 });
 try{
  const response=await fetch('assets/data/engineering-knowledge.json',{cache:'no-store'});if(!response.ok)throw Error();data=await response.json();
  $('library-count').textContent=data.entries.filter(e=>e.status==='included').length+' searchable learning notes';$('search-button').disabled=false;
  $('search-status').textContent='Ask a question or choose an example. No AI request is made by searching.';
 }catch{ $('search-status').textContent='The knowledge library could not load. Reload this page to try again.';return; }
 // A failed health check is not proof that public AI is disabled.
 // The actual POST request enforces the public mode and shared Redis quotas.
 try{
  const r=await fetch(endpoint+'/api/health',{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!r.ok){
   availabilityMessage='AI availability check returned HTTP '+r.status+'. You may still try generating an explanation.';
  }else{
   const h=await r.json();
   if(h.knowledge_version!==data.version){
    availabilityMessage='Knowledge library version mismatch. Refresh this page before generating an explanation.';
    available=false;
   }else if(h.ai_enabled===true){
    availabilityMessage='AI is available within the shared request allowance.';
   }else{
    availabilityMessage='AI is currently disabled by the server. You can still read all notes and sources.';
    available=false;
   }
  }
 }catch(error){
  availabilityMessage=error.name==='TimeoutError'?'AI availability check timed out. You may still try generating an explanation.':'Could not check AI availability from this browser or network. You may still try generating an explanation.';
 }
 $('ai-status').textContent=availabilityMessage;
 $('generate-button').disabled=!available||!hits.length;
})();
