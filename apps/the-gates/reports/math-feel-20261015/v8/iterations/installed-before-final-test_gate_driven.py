import unittest,random
from fractions import Fraction
from collections import Counter
from gates_math import generate_candidate,GateDrivenSource,BonusState
from artifacts import summarize_book
from validate_gates_artifacts import validate_book
from reward_contract import check_reward_contract,reward_metrics,constraints
from gate_weights import fit_gate_weights

class GateDrivenTests(unittest.TestCase):
 def test_legal_deterministic_small_clusters(self):
  for tier in ('normal','super','hidden','feature'):
   for i in (5,11,12,13,27):
    b=generate_candidate(tier,i,20261015);validate_book(b)
    self.assertEqual(b,generate_candidate(tier,i,20261015))
    m=reward_metrics(b['events'])
    if m: self.assertGreater(m['small']/m['clusters'],.80)
 def test_full_reward_pool_and_extensions_not_silenced(self):
  seen=Counter();extended_gate=False
  for i in range(5,65):
   b=generate_candidate('hidden',i,20261015);validate_book(b)
   spin=0
   for e in b['events']:
    if e['type']=='spinStart':spin=e['freeSpin']
    if e['type']=='gateReward' and spin: seen[e['reward']['kind']]+=1
    if e['type']=='gateOpen' and spin>15:extended_gate=True
  self.assertEqual(set(seen),{'addMultiplier','multiplyMultiplier','stickyWild','extraSpin','retrigger'})
  self.assertTrue(extended_gate)
 def test_metrics_exclude_entry_and_track_eligibility(self):
  events=[{'type':'gateOpen'},{'type':'freeSpinTrigger','tier':'hidden'}, {'type':'spinStart','stickyPositions':[{},{}]}, {'type':'gateOpen'},
   {'type':'gateReward','reward':{'kind':'stickyWild','positions':[{}]},'stickyPositions':[{}, {}, {}]},
   {'type':'gateReward','reward':{'kind':'extraSpin','spinsAdded':2},'stickyPositions':[{}, {}, {}]}, {'type':'freeSpinEnd','amount':1234}]
  m=reward_metrics(events);self.assertEqual(m['gates'],1);self.assertEqual(m['eligible'],1);self.assertEqual(m['full'],1);self.assertEqual(m.get('wildSpaceTwo',0),0)
 def test_rejects_old_additive_only_super_and_wrong_gate_count(self):
  for tier,gates in [('super',6),('normal',1)]:
   m={'tier':tier,'bonuses':1,'gates':gates,'raw':10,'payout':1000,'clusters':12,'small':12,'eligible':gates,'eligible/addMultiplier':gates}
   with self.assertRaisesRegex(RuntimeError,'V8 reward contract'):check_reward_contract([({'rewardMetrics':m},1000)])
 def test_impossible_weight_support_fails_closed(self):
  b=generate_candidate('super',5,20261015);r=summarize_book(b)
  with self.assertRaisesRegex(RuntimeError,'infeasible'):fit_gate_weights([r],100000000,Fraction(2883,10))
if __name__=='__main__':unittest.main(verbosity=2)
