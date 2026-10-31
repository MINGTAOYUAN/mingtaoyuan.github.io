"""Make a static QA preview. No secrets or backend code are copied. Never publish QA fixtures."""
from pathlib import Path
import shutil,json
root=Path(__file__).resolve().parents[1];dest=root/'preview-build';dest.mkdir(exist_ok=True)
for page in root.glob('*.html'):shutil.copy2(page,dest/page.name)
for name in ('race','data'):shutil.copytree(root/'assets'/name,dest/'assets'/name,dirs_exist_ok=True)
(root/'.openai').mkdir(exist_ok=True)
(root/'.openai/hosting.json').write_text(json.dumps({'static':{'directory':'preview-build'}}))
html=(root/'engineering-explorer.html').read_text()
fixture='''<script>
const realFetch=window.fetch.bind(window);let calls=0;
window.fetch=async(url,options)=>{
 if(url==='https://mingtao-ai-backend.vercel.app/api/health')return new Response(JSON.stringify({ai_enabled:true,knowledge_version:'2026-10-31.2'}));
 if(url==='https://mingtao-ai-backend.vercel.app/api/knowledge/ask'){
  calls++;const scenario=new URLSearchParams(location.search).get('scenario');
  if(scenario==='quota')return new Response('{}',{status:429});
  if(scenario==='slow')await new Promise(resolve=>setTimeout(resolve,2000));
  const id=scenario==='forged'?'not-in-retrieval':'ms-q2_0';
  return new Response(JSON.stringify({version:'2026-10-31.2',mode:'generated',generated:{explanation:[{text:'SIMULATED: braking and turning share a simplified force envelope. <img src=x onerror=alert(1)>',evidence_ids:[id]}],reasoning:'SIMULATED inference: combined demand may approach an illustrative limit.',unknowns:'SIMULATED: no measured tire envelope or vehicle data.'}}));
 }
 return realFetch(url,options);
};
</script>'''
html=html.replace('<script src="assets/race/knowledge-search.js"',fixture+'<script src="assets/race/knowledge-search.js"')
html=html.replace('<main class="wrap explorer">','<main class="wrap explorer"><p>QA ONLY — AI responses below are simulated. No OpenAI call is made.</p>')
(dest/'qa-explorer.html').write_text(html)
(dest/'qa-mobile.html').write_text('''<!doctype html><title>Responsive QA — 390px and 768px viewports</title><body style="background:#313636;color:white;font:16px Arial"><p>QA only: real browser frames at 390px and 768px widths, not physical-phone or touch emulation.</p><iframe title="Phone viewport" src="qa-explorer.html" style="width:390px;height:844px;border:0"></iframe><iframe title="Tablet viewport" src="engineering-explorer.html" style="width:768px;height:844px;border:0"></iframe></body>''')
print('Static preview and clearly labelled simulated-response fixtures prepared.')
