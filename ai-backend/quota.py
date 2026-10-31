"""Atomic shared request reservations. No in-memory quota fallback, no raw IP storage."""
import os,time,hmac,hashlib,ipaddress
from urllib.parse import urlsplit
import httpx
from fastapi import HTTPException
# All four limits are checked before *any* counter is incremented. Errors count
# conservatively; no refunds or retries can turn one reservation into many calls.
RESERVE_LUA='''
for i=1,4 do
 if tonumber(redis.call('GET',KEYS[i]) or '0') >= tonumber(ARGV[i]) then return 0 end
end
for i=1,4 do
 local count=redis.call('INCR',KEYS[i])
 if count==1 and tonumber(ARGV[i+4])>0 then redis.call('EXPIRE',KEYS[i],ARGV[i+4]) end
end
return 1
'''
def settings():
    url=os.getenv('UPSTASH_REDIS_REST_URL',''); token=os.getenv('UPSTASH_REDIS_REST_TOKEN','');salt=os.getenv('LAB_QUOTA_SALT','')
    parsed=urlsplit(url)
    if parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password or len(salt)<32 or not token:
        raise HTTPException(503,'AI is paused until shared quota controls are configured. Knowledge search remains available.')
    try:
        limits=[int(os.getenv(k,str(d))) for k,d in [('LAB_AI_TOTAL_LIMIT',300),('LAB_AI_DAILY_LIMIT',100),('LAB_AI_IP_DAILY_LIMIT',10),('LAB_AI_IP_MINUTE_LIMIT',2)]]
        # Deployment-level safety ceilings, independent of browser input.
        if any(n<1 or n>cap for n,cap in zip(limits,[1000,1000,50,5])): raise ValueError()
    except ValueError: raise HTTPException(503,'AI quota configuration is invalid.')
    return url.rstrip('/'),token,salt,limits

def public_enabled():
    if os.getenv('LAB_PUBLIC_AI')!='true' or not os.getenv('OPENAI_API_KEY'): return False
    if os.getenv('OPENAI_MODEL','gpt-5.4-mini')!='gpt-5.4-mini': return False
    try: settings();return True
    except HTTPException: return False

def reservation(request,now=None):
    _,_,salt,limits=settings(); now=int(time.time() if now is None else now)
    # Only trust Vercel's overwritten edge header in a Vercel deployment.
    # Never use the client-supplied x-forwarded-for header as an identity.
    address=request.headers.get('x-vercel-forwarded-for','') if os.getenv('VERCEL')=='1' else (request.client.host if request.client else '')
    try: address=str(ipaddress.ip_address(address.strip()))
    except ValueError: raise HTTPException(503,'Client quota identity is unavailable.')
    day=now//86400;minute=now//60
    digest=hmac.new(salt.encode(),f'{day}:{address}'.encode(),hashlib.sha256).hexdigest()[:32]
    prefix=os.getenv('LAB_QUOTA_NAMESPACE','engineering-v1')
    # A single hash tag permits atomic EVAL in a Redis Cluster.
    base=f'lab:{{{prefix}}}:'
    keys=[base+'total',base+f'day:{day}',base+f'ip:{day}:{digest}',base+f'min:{minute}:{digest}']
    return keys,limits+[0,86400-(now%86400)+60,86400-(now%86400)+60,120]

async def reserve(request):
    url,token,_,_=settings();keys,args=reservation(request)
    try:
        async with httpx.AsyncClient(timeout=5,follow_redirects=False) as client:
            response=await client.post(url,json=['EVAL',RESERVE_LUA,4,*keys,*args],headers={'Authorization':'Bearer '+token})
            response.raise_for_status();result=response.json()
        if result.get('result')==0: raise HTTPException(429,'AI request allowance reached. Knowledge search remains available.',headers={'Retry-After':'60'})
        if result.get('result')!=1 or result.get('error'): raise ValueError('Invalid quota response')
    except HTTPException: raise
    except Exception: raise HTTPException(503,'AI quota service is unavailable. Knowledge search remains available.')

async def authorize(request):
    # Public mode has no visitor token, but always reserves a shared quota.
    if os.getenv('LAB_PUBLIC_AI')=='true':
        if not public_enabled(): raise HTTPException(503,'AI is paused until shared quota controls are configured.')
        await reserve(request);return
    # Preserve the established private-pilot route during staged rollout.
    token=os.getenv('LAB_ACCESS_TOKEN','')
    if not token or not hmac.compare_digest(request.headers.get('authorization',''),'Bearer '+token):
        raise HTTPException(403,'AI public access is not enabled yet. Knowledge search remains available.')
    if not os.getenv('OPENAI_API_KEY'): raise HTTPException(503,'AI is not configured.')
