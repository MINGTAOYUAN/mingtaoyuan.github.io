import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from analysis import analyze
class AnalysisTest(unittest.TestCase):
 def fixture(self,duration=100):
  return {'label':'test','duration':duration,'samples':[[duration*i/100,i*10,36,3000,.2,-.1,3] for i in range(101)]}
 def test_constant_speed_and_delta(self):
  r=analyze({'laps':[self.fixture(),self.fixture(90)]})
  self.assertEqual(r['laps'][1]['delta'][-1],-10)
  self.assertAlmostEqual(sum(x['delta'] for x in r['laps'][1]['sectors']),-10)
  self.assertEqual(r['laps'][0]['distance'],1000)
 def test_bad_samples(self):
  lap=self.fixture();lap['samples'][50][0]=0
  with self.assertRaises(ValueError):analyze({'laps':[lap]})
 def test_missing_finish(self):
  lap=self.fixture();lap['duration']=120
  with self.assertRaises(ValueError):analyze({'laps':[lap]})
if __name__=='__main__':unittest.main()
