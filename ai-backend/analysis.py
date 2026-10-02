"""Numerical analysis; no AI-generated measurements. Samples: s,m,km/h,rpm,g,g,gear."""
import math

def analyze(payload):
    laps = payload.get('laps', [])
    if not 1 <= len(laps) <= 6:
        raise ValueError('Select one to six laps.')
    result=[]
    for lap in laps:
        samples=lap['samples']; duration=float(lap['duration'])
        if not 20 <= len(samples) <= 12000 or not 10 <= duration <= 1800:
            raise ValueError('Invalid lap size or duration.')
        if any(len(r)!=7 or any(not isinstance(v,(int,float)) or not math.isfinite(v) for v in r) for r in samples):
            raise ValueError('Invalid numeric samples.')
        if any(b[0]<=a[0] or b[1]<a[1] for a,b in zip(samples,samples[1:])):
            raise ValueError('Time must increase and distance must not decrease.')
        if samples[-1][1] <= 0 or abs(samples[-1][0]-duration) > .2 or samples[0][0] > .2:
            raise ValueError('Lap must cover its full beacon interval.')
        trace=[]
        # Equal normalized distance; flags different driven distances explicitly.
        j=0
        for i in range(201):
            d=samples[-1][1]*i/200
            while j<len(samples)-2 and samples[j+1][1]<d: j+=1
            a,b=samples[j:j+2]; f=(d-a[1])/(b[1]-a[1]) if b[1]>a[1] else 0
            trace.append([round(a[k]+f*(b[k]-a[k]),4) for k in range(7)])
        trace[0][0]=0; trace[-1][0]=duration
        result.append({'label':str(lap['label'])[:80],'duration':duration,'distance':round(samples[-1][1],1),'trace':trace,'max_speed':max(r[2] for r in samples),'max_deceleration_g':min(r[5] for r in samples)})
    reference=result[0]
    for lap in result:
        lap['delta']=[round(r[0]-b[0],4) for r,b in zip(lap['trace'],reference['trace'])]
        lap['sectors']=[{'sector':i+1,'delta':round(lap['delta'][(i+1)*20]-lap['delta'][i*20],4)} for i in range(10)]
    return {'laps':result,'notes':['Delta uses normalized GPS distance, not surveyed corner boundaries. Different racing lines introduce alignment uncertainty.','GPS longitudinal deceleration is not brake pressure. Throttle is unavailable. Calculated gear is logger-derived.','First and last session segments are excluded by default; verify lap selections and track layout before comparison.']}

def summary(result):
    laps=[]
    for lap in result['laps']:
        item={k:v for k,v in lap.items() if k not in ('trace','delta','sectors')}
        item['sectors']=[]
        for i,sector in enumerate(lap['sectors']):
            window=lap['trace'][i*20:(i+1)*20+1]
            item['sectors'].append({**sector,
                'normalized_distance_pct':[i*10,(i+1)*10],
                'time_s':round(window[-1][0]-window[0][0],4),
                'entry_speed_kmh':round(window[0][2],1),
                'minimum_speed_kmh':round(min(r[2] for r in window),1),
                'exit_speed_kmh':round(window[-1][2],1),
                'peak_deceleration_g':round(min(r[5] for r in window),3),
                'peak_acceleration_g':round(max(r[5] for r in window),3)})
        laps.append(item)
    return {'laps':laps,'notes':result['notes']+[
        'Sector entry and exit refer to equal-distance bin boundaries, not corner entry or exit. Speed minima and acceleration peaks use the 201-point resampled trace, so brief events may be missed.']}
