import os,sys,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi import HTTPException
import quota

class QuotaConfigTest(unittest.TestCase):
 def config(self,extra):
  return patch.dict(os.environ,{'LAB_QUOTA_SALT':'x'*32,**extra},clear=True)
 def test_marketplace_names(self):
  with self.config({'KV_REST_API_URL':'https://market.example.test','KV_REST_API_TOKEN':'fake-write-token'}):
   self.assertEqual(quota.settings()[:2],('https://market.example.test','fake-write-token'))
 def test_explicit_upstash_pair_takes_precedence(self):
  with self.config({'UPSTASH_REDIS_REST_URL':'https://direct.example.test','UPSTASH_REDIS_REST_TOKEN':'fake-direct','KV_REST_API_URL':'https://market.example.test','KV_REST_API_TOKEN':'fake-market'}):
   self.assertEqual(quota.settings()[:2],('https://direct.example.test','fake-direct'))
 def test_partial_direct_pair_does_not_mix_or_fall_back(self):
  for direct in [{'UPSTASH_REDIS_REST_URL':'https://direct.example.test'},{'UPSTASH_REDIS_REST_TOKEN':'fake-direct'}]:
   with self.subTest(direct=list(direct)),self.config({**direct,'KV_REST_API_URL':'https://market.example.test','KV_REST_API_TOKEN':'fake-market'}):
    with self.assertRaises(HTTPException):quota.settings()
 def test_read_only_token_cannot_authorize_reservations(self):
  with self.config({'KV_REST_API_URL':'https://market.example.test','KV_REST_API_READ_ONLY_TOKEN':'fake-read-only'}):
   with self.assertRaises(HTTPException):quota.settings()
 def test_insecure_marketplace_url_fails_closed(self):
  with self.config({'KV_REST_API_URL':'http://market.example.test','KV_REST_API_TOKEN':'fake-token'}):
   with self.assertRaises(HTTPException):quota.settings()

if __name__=='__main__':unittest.main()
