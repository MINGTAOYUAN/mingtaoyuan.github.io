/* Deterministic, no-network lexical retrieval. Kept in parity with ai-backend/knowledge.py. */
(function(root){
 'use strict';
 const stop=new Set('a an the is are was were why how what which does do can could should would will of to in on for and or as at by from with my me i it its this that these those not always more most than when into about much very have has be am using use'.split(' '));
 function words(text){return [...new Set((text.toLowerCase().match(/[a-z0-9]+/g)||[]).filter(w=>w.length>2&&!stop.has(w)))];}
 function search(data,question){
  const q=question.toLowerCase().trim(),tokens=words(q);
  return data.entries.filter(e=>e.status==='included').map(e=>{
   const title=words(e.question),body=words(e.answer+' '+e.limits);
   const aliases=e.aliases.filter(a=>/[\u3400-\u9fff]/.test(a)?q.includes(a):(' '+q.replace(/[^a-z0-9]+/g,' ')+' ').includes(' '+a+' '));
   const matched=tokens.filter(w=>title.includes(w)||body.includes(w));
   const score=aliases.length*12+tokens.reduce((s,w)=>s+(title.includes(w)?6:body.includes(w)?1:0),0);
   return {entry:e,score,matched:[...aliases,...matched]};
  }).filter(r=>r.score>=6).sort((a,b)=>b.score-a.score||a.entry.id.localeCompare(b.entry.id)).slice(0,4);
 }
 const api={search,words};if(typeof module!=='undefined')module.exports=api;else root.KnowledgeSearch=api;
})(typeof window==='undefined'?globalThis:window);
