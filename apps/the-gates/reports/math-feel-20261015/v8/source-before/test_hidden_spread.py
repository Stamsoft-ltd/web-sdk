"""Deterministic legal-path and aggregate-concentration regressions."""
import random
import unittest
from fractions import Fraction
from audit_hidden_spread import spin_metrics
from gates_math import generate_candidate, Round, WitnessSource, seed_for
from math_targets import MAX_WIN_AMOUNT, HIDDEN_MAX_EXACT_PAYOUT_PROBABILITY
from validate_gates_artifacts import validate_book
from weight_lookups import check_payout_diversity

class HiddenSpreadTest(unittest.TestCase):
    def test_diverse_pays_multiple_real_gates_and_determinism(self):
        for seed in (71, 20260921, 999):
            payouts = set()
            for index in range(10, 1001, 10):
                with self.subTest(seed=seed, index=index):
                    book = generate_candidate('hidden', index, seed)
                    validate_book(book)
                    payouts.add(book['payoutMultiplier'])
                    self.assertEqual(book, generate_candidate('hidden', index, seed))
                    if book['payoutMultiplier'] == MAX_WIN_AMOUNT:
                        continue  # Real cap ends playback immediately; never manufacture more gates.
                    wins, streak = spin_metrics(book)
                    self.assertEqual(len(wins), 15)
                    self.assertTrue(5 <= sum(w > 0 for w in wins) <= 8)
                    self.assertLessEqual(streak, 4)
                    gates = [e for e in book['events'] if e['type'] == 'gateOpen']
                    self.assertTrue(3 <= len(gates) <= 5)
                    self.assertEqual(len(gates), len({e['spinId'] for e in gates}))
                    self.assertTrue(all(e['rewardCount'] == 2 for e in gates))
                    self.assertEqual(sum(e['type'] == 'gateReward' for e in book['events']), 2*len(gates))
            self.assertGreater(len(payouts), 90)

    def test_rare_anchors_stay_unchanged(self):
        for group in ('normal', 'super', 'hidden'):
            indices = range(5)
            for index in indices:
                witness = ('zero', 'minimum', 'quarter', 'max', 'rare1000')[index] if index < 5 else 'tail'
                rng = random.Random(seed_for(20260921, group, index, 0))
                old = Round(WitnessSource(rng, group, witness)).play(group, rng)
                new = generate_candidate(group, index)
                self.assertEqual(new['events'], old['events'])
                self.assertEqual(new['payoutMultiplier'], old['payoutMultiplier'])

    def test_guard_aggregates_duplicate_payouts_not_book_ids(self):
        records = [{'payoutMultiplier': i*100} for i in range(200)]
        report = check_payout_diversity(records, [1]*200, HIDDEN_MAX_EXACT_PAYOUT_PROBABILITY)
        self.assertEqual(report['maxExactPayoutProbability'], .005)
        for i in range(100): records[i]['payoutMultiplier'] = 375000
        with self.assertRaisesRegex(RuntimeError, '3750x carries 50.0000%'):
            check_payout_diversity(records, [1]*200, HIDDEN_MAX_EXACT_PAYOUT_PROBABILITY)

    def test_guard_never_changes_records_or_weights(self):
        records = [{'payoutMultiplier': 375000}, {'payoutMultiplier': 400000}]
        weights = [99, 1]
        with self.assertRaises(RuntimeError): check_payout_diversity(records, weights, Fraction(1, 100))
        self.assertEqual(weights, [99, 1])
        self.assertEqual(records[0]['payoutMultiplier'], 375000)

if __name__ == '__main__': unittest.main(verbosity=2)
