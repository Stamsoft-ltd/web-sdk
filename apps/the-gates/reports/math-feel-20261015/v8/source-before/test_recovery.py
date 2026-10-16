"""Regressions for the 500k rare-weight floor and staging recovery."""
from contextlib import redirect_stdout
from fractions import Fraction
import hashlib
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from gates_math import seed_for, generate_candidate
from math_targets import MODE_GROUP_WEIGHTS, MAX_WIN_AMOUNT, TAIL_LIMITS
from run import independent_tier_scale, build_mode_weights, generate_pool, publish_mode
from recover_build import scan_completed, check_sample


class RecoveryTests(unittest.TestCase):
    def test_scale_grows_with_candidate_count_and_divides_groups(self):
        for mode,counts in {'BASE':{'normal':100000,'super':100000,'hidden':100000},
                            'CHANCE':{'normal':100000,'super':100000,'hidden':100000},
                            'BONUS':{'normal':500000},'SUPER':{'super':500000},
                            'MYSTERY':{'normal':166667,'super':166667,'hidden':166666}}.items():
            pools={group:[None]*n for group,n in counts.items()}
            scale=independent_tier_scale(mode,pools)
            self.assertEqual(scale,100000000 if mode in ('BASE','CHANCE') else 200000000 if mode=='MYSTERY' else 500000000)
            for group in pools:self.assertEqual(MODE_GROUP_WEIGHTS[mode][group]%scale,0)
        self.assertEqual(independent_tier_scale('SUPER',{'super':[None]*30000}),100000000)

    def test_actual_500k_cap_floor_regression(self):
        capped_records=241507
        self.assertGreater(Fraction(capped_records,100000000),TAIL_LIMITS[MAX_WIN_AMOUNT])
        scale=independent_tier_scale('SUPER',{'super':[None]*500000})
        self.assertEqual(Fraction(capped_records,scale),Fraction(241507,500000000))
        self.assertLess(Fraction(capped_records,scale),TAIL_LIMITS[MAX_WIN_AMOUNT])

    def test_small_fit_preserves_exact_ev_and_positive_weights(self):
        from artifacts import summarize_book
        records=[summarize_book(generate_candidate('super',i,20261015)) for i in range(500)]
        weights,fits=build_mode_weights('SUPER',{'super':records})
        values=weights['SUPER']['super'];total=MODE_GROUP_WEIGHTS['SUPER']['super']
        self.assertEqual(sum(values),total)
        self.assertEqual(sum(r['payoutMultiplier']*w for r,w in zip(records,values)),28830*total)
        self.assertTrue(all(w>0 for w in values))
        self.assertEqual(fits['tierFittingScale'],100000000)

    def test_recovery_scan_keeps_books_and_weights_and_rejects_wrong_seed(self):
        with tempfile.TemporaryDirectory() as directory,redirect_stdout(io.StringIO()):
            stage=Path(directory)
            for name in ('publish_files','lookup_tables'):(stage/name).mkdir()
            pools={'feature':generate_pool(stage,'feature',3,seed_for(123,'mode','FEATURE'),None,3)}
            def report(mode,rows):return {'books':len(rows),'weightedRtp':.961,'nonTenthPayoutRate':0}
            with patch('run.mode_report',side_effect=report):
                publish_mode(stage,'FEATURE',pools,{'FEATURE':{'feature':[5,6,7]}})
            files=list((stage/'publish_files').iterdir())+list((stage/'lookup_tables').iterdir())
            before={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
            with patch('recover_build.mode_pool_counts',return_value={'feature':3}), \
                 patch('recover_build.MODE_GROUP_WEIGHTS',{'FEATURE':{'feature':18}}), \
                 patch('recover_build.mode_report',side_effect=report):
                actual=scan_completed(stage,'FEATURE',3,123)
                self.assertEqual(actual['books'],3)
                self.assertEqual(len(actual['uncompressedSha256']),64)
                with self.assertRaisesRegex(ValueError,'seed/source sample mismatch'):
                    scan_completed(stage,'FEATURE',3,124)
            self.assertEqual(before,{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in files})

    def test_sample_provenance_matches_mode_seed(self):
        book=generate_candidate('normal',12,seed_for(123,'mode','BONUS'))
        check_sample(book,'BONUS',123)
        with self.assertRaisesRegex(ValueError,'mismatch'):check_sample(book,'BONUS',124)

if __name__=='__main__':unittest.main(verbosity=2)
