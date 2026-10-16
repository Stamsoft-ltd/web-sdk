# Latest Gates bonus payout and reward audit — v7.2

Package: `/Users/simeonhristov/Documents/GitHub/math-sdk/games/0_0_the_gates/library-v7-2-50pct-10k-20261015`

Exact enumeration of all 60,000 published candidate books using their integer lookup weights; not an unweighted sample or a fresh-spin simulation. This is the latest local package found, not a claim of verified deployment on RGS. All payouts below use selected base-bet multiples. Purchase cost is not subtracted. Natural versus bought is determined by mode, NOT the event `source` field (shared books mark that field natural).

## Critical finding

Published reward probabilities differ sharply from proposal configuration (40% additive / 15% multiplier boost / 25% Wild / 15% extra spin / 5% retrigger). Direct Super is 99.926334% additive, and Mystery Hidden 99.999866% additive. SpreadBonusSource supplies additive-only paths; lookup optimization gives these paths nearly all delivered probability. Config constants are proposal odds, not final weighted-book odds. No math modified by this audit.

## Payouts conditional on bonus entry

| Route / tier | Candidate books | Entry probability per paid round | Entire round × | Entry spin × | Free spins only × |
|---|---:|---:|---:|---:|---:|
| BASE/normal | 2000 | 0.212500000% | 96.100000 | 2.000204 | 94.099796 |
| BASE/super | 2000 | 0.035000000% | 288.300000 | 10.000158 | 278.299842 |
| BASE/hidden | 2000 | 0.002500000% | 4708.900000 | 50.000097 | 4658.899903 |
| CHANCE/normal | 2000 | 0.637500000% | 96.100000 | 2.001546 | 94.098454 |
| CHANCE/super | 2000 | 0.105000000% | 288.300000 | 10.032135 | 278.267865 |
| CHANCE/hidden | 2000 | 0.007500000% | 4708.900000 | 50.000085 | 4658.899915 |
| FEATURE/normal | 80 | 0.000000002% | 8307.830000 | 500.276250 | 7807.553750 |
| FEATURE/super | 16 | 0.000000000% | 22227.812500 | 531.050000 | 21696.762500 |
| FEATURE/hidden | 9 | 0.000000000% | 25000.000000 | 260.216667 | 24739.783333 |
| BONUS/normal | 10000 | 100.000000000% | 96.100000 | 2.000931 | 94.099069 |
| SUPER/super | 10000 | 100.000000000% | 288.300000 | 10.001660 | 278.298340 |
| MYSTERY/normal | 3334 | 65.000000000% | 96.100000 | 2.000274 | 94.099726 |
| MYSTERY/super | 3333 | 30.000000000% | 288.300000 | 10.000263 | 278.299737 |
| MYSTERY/hidden | 3333 | 5.000000000% | 4708.900000 | 50.000012 | 4658.899988 |

Entire-round Normal/Super/Hidden conditional means are 96.1× / 288.3× / 4,708.9× in Base, Chance and corresponding purchase pools. These include the 2×/10×/50× scatter awards and any entry-spin cascade payout. Free-spin-only values exclude the full entry spin. FEATURE uses a different conditional distribution: its rare bonus-triggering rounds are much higher paying; do not apply the ordinary natural conditional average to Feature Spin.

Direct Normal cost 100×; direct Super 300×; Mystery cost 400×. Mystery pays 384.4× on average (96.1% of cost), mixing 65% Normal / 30% Super / 5% Hidden. Hidden has no direct buy. Normal/Super conditional results within Mystery are not their standalone purchase prices.

## Average gates and actual spins played inside bonus

| Route / tier | Gates per bonus | Reward draws per bonus | Spins played |
|---|---:|---:|---:|
| BASE/normal | 1.603729 | 1.603729 | 15.000000 |
| BASE/super | 1.950883 | 1.950883 | 14.999963 |
| BASE/hidden | 3.766722 | 7.533444 | 14.999927 |
| CHANCE/normal | 1.650488 | 1.650488 | 14.999999 |
| CHANCE/super | 1.956950 | 1.956950 | 14.999949 |
| CHANCE/hidden | 3.789381 | 7.578763 | 14.999928 |
| FEATURE/normal | 13.075000 | 13.075000 | 14.987500 |
| FEATURE/super | 14.000000 | 14.000000 | 7.062500 |
| FEATURE/hidden | 8.222222 | 16.444444 | 4.000000 |
| BONUS/normal | 1.607190 | 1.607190 | 14.999999 |
| SUPER/super | 1.963693 | 1.963693 | 14.999966 |
| MYSTERY/normal | 1.591327 | 1.591327 | 15.000000 |
| MYSTERY/super | 1.968715 | 1.968715 | 15.000329 |
| MYSTERY/hidden | 3.852858 | 7.705717 | 14.999988 |

Counts exclude entry-spin gates. All bonuses start with 15 spins; extensions may increase this, while reaching the maximum payout can end the bonus early. Hidden draws twice per gate, others once.

## Actual reward-type odds

Percent of reward draws, conditional on an opened bonus gate. NOT probability of seeing at least one such reward during the complete bonus. Hidden has two sequential draws per gate; results are not independent because state/caps change.

| Route / tier | Add multiplier | Multiply multiplier | Sticky Wild | Extra spins | Retrigger |
|---|---:|---:|---:|---:|---:|
| BASE/normal | 100.000000000% | 0.000000000% | 0.000000000% | 0.000000000% | 0.000000000% |
| BASE/super | 99.996291423% | 0.001402442% | 0.000763757% | 0.001258917% | 0.000283461% |
| BASE/hidden | 99.999186428% | 0.000259642% | 0.000200838% | 0.000262430% | 0.000090662% |
| CHANCE/normal | 100.000000000% | 0.000000000% | 0.000000000% | 0.000000000% | 0.000000000% |
| CHANCE/super | 99.890569508% | 0.092946678% | 0.015364215% | 0.000845704% | 0.000273896% |
| CHANCE/hidden | 99.999189182% | 0.000253867% | 0.000204255% | 0.000263763% | 0.000088933% |
| FEATURE/normal | 100.000000000% | 0.000000000% | 0.000000000% | 0.000000000% | 0.000000000% |
| FEATURE/super | 48.214285714% | 16.964285714% | 14.732142857% | 14.732142857% | 5.357142857% |
| FEATURE/hidden | 43.918918919% | 22.972972973% | 14.864864865% | 14.189189189% | 4.054054054% |
| BONUS/normal | 100.000000000% | 0.000000000% | 0.000000000% | 0.000000000% | 0.000000000% |
| SUPER/super | 99.926334196% | 0.044895008% | 0.014355097% | 0.013009164% | 0.001406534% |
| MYSTERY/normal | 100.000000000% | 0.000000000% | 0.000000000% | 0.000000000% | 0.000000000% |
| MYSTERY/super | 99.970806750% | 0.020042359% | 0.001741694% | 0.007364092% | 0.000045106% |
| MYSTERY/hidden | 99.999866268% | 0.000043111% | 0.000032690% | 0.000043448% | 0.000014483% |

## Actual inner reward odds by route

Each table is conditional on receiving that reward type. Sticky Wild counts are the delivered count, after maximum-three-sticky state limits, not the initially proposed count. Zero means absent from the published weighted library for this route. Extremely small nonzero probabilities remain possible.

### BASE/normal

| Reward | Value / count | Conditional chance |
|---|---:|---:|
| Add multiplier | +2× | 21.990235049% |
| Add multiplier | +3× | 26.556505194% |
| Add multiplier | +4× | 16.150487651% |
| Add multiplier | +5× | 20.068363525% |
| Add multiplier | +8× | 3.762178168% |
| Add multiplier | +10× | 5.005357294% |
| Add multiplier | +12× | 4.274888083% |
| Add multiplier | +15× | 0.724678334% |
| Add multiplier | +20× | 0.581681647% |
| Add multiplier | +25× | 0.677974696% |
| Add multiplier | +50× | 0.204691007% |
| Add multiplier | +100× | 0.002957481% |
| Add multiplier | +200× | 0.000001247% |
| Add multiplier | +1000× | 0.000000624% |

### BASE/super

| Reward | Value / count | Conditional chance |
|---|---:|---:|
| Add multiplier | +2× | 12.964494036% |
| Add multiplier | +3× | 19.746939858% |
| Add multiplier | +4× | 12.690931339% |
| Add multiplier | +5× | 18.583521925% |
| Add multiplier | +8× | 6.750468345% |
| Add multiplier | +10× | 9.853049956% |
| Add multiplier | +12× | 7.475052793% |
| Add multiplier | +15× | 2.807353048% |
| Add multiplier | +20× | 2.741863860% |
| Add multiplier | +25× | 3.566194026% |
| Add multiplier | +50× | 2.666042557% |
| Add multiplier | +100× | 0.154086719% |
| Add multiplier | +200× | 0.000001025% |
| Add multiplier | +1000× | 0.000000513% |
| Multiply multiplier | ×2 | 87.902046784% |
| Multiply multiplier | ×3 | 10.855263158% |
| Multiply multiplier | ×5 | 1.242690058% |
| Sticky Wild | 1 Wild(s) | 87.382550336% |
| Sticky Wild | 2 Wild(s) | 12.617449664% |
| Extra spins | +1 spins | 51.465798046% |
| Extra spins | +2 spins | 19.462540717% |
| Extra spins | +3 spins | 24.429967427% |
| Extra spins | +5 spins | 4.641693811% |
| Retrigger | +15 spins | 100.000000000% |

### BASE/hidden

| Reward | Value / count | Conditional chance |
|---|---:|---:|
| Add multiplier | +2× | 0.000213981% |
| Add multiplier | +3× | 1.573000455% |
| Add multiplier | +4× | 0.000107123% |
| Add multiplier | +5× | 1.530255118% |
| Add multiplier | +8× | 9.031445549% |
| Add multiplier | +10× | 8.989343084% |
| Add multiplier | +12× | 0.000019911% |
| Add multiplier | +15× | 7.271388763% |
| Add multiplier | +20× | 21.145242120% |
| Add multiplier | +25× | 21.406502962% |
| Add multiplier | +50× | 14.609274608% |
| Add multiplier | +100× | 13.152708163% |
| Add multiplier | +200× | 1.290497896% |
| Add multiplier | +1000× | 0.000000265% |
| Multiply multiplier | ×2 | 79.601226994% |
| Multiply multiplier | ×3 | 18.047034765% |
| Multiply multiplier | ×5 | 2.351738241% |
| Sticky Wild | 1 Wild(s) | 86.186384666% |
| Sticky Wild | 2 Wild(s) | 13.813615334% |
| Extra spins | +1 spins | 45.118866970% |
| Extra spins | +2 spins | 30.804248862% |
| Extra spins | +3 spins | 17.450682853% |
| Extra spins | +5 spins | 6.626201315% |
| Retrigger | +15 spins | 100.000000000% |

### CHANCE/normal

| Reward | Value / count | Conditional chance |
|---|---:|---:|
| Add multiplier | +2× | 19.805125263% |
| Add multiplier | +3× | 28.082304898% |
| Add multiplier | +4× | 17.622296805% |
| Add multiplier | +5× | 20.276585847% |
| Add multiplier | +8× | 4.239985592% |
| Add multiplier | +10× | 4.960896048% |
| Add multiplier | +12× | 3.252183754% |
| Add multiplier | +15× | 0.460417790% |
| Add multiplier | +20× | 0.713616856% |
| Add multiplier | +25× | 0.346679302% |
| Add multiplier | +50× | 0.226440918% |
| Add multiplier | +100× | 0.013465715% |
| Add multiplier | +200× | 0.000000606% |
| Add multiplier | +1000× | 0.000000606% |

### CHANCE/super

| Reward | Value / count | Conditional chance |
|---|---:|---:|
| Add multiplier | +2× | 13.744993506% |
| Add multiplier | +3× | 19.194093023% |
| Add multiplier | +4× | 13.452888677% |
| Add multiplier | +5× | 18.506652792% |
| Add multiplier | +8× | 7.556986823% |
| Add multiplier | +10× | 10.004077177% |
| Add multiplier | +12× | 6.284286703% |
| Add multiplier | +15× | 2.763884047% |
| Add multiplier | +20× | 2.488811577% |
| Add multiplier | +25× | 2.838269339% |
| Add multiplier | +50× | 2.867480384% |
| Add multiplier | +100× | 0.297572884% |
| Add multiplier | +200× | 0.000002046% |
| Add multiplier | +1000× | 0.000001023% |
| Multiply multiplier | ×2 | 99.811976338% |
| Multiply multiplier | ×3 | 0.177577903% |
| Multiply multiplier | ×5 | 0.010445759% |
| Sticky Wild | 1 Wild(s) | 99.368077959% |
| Sticky Wild | 2 Wild(s) | 0.631922041% |
| Extra spins | +1 spins | 44.229607251% |
| Extra spins | +2 spins | 30.332326284% |
| Extra spins | +3 spins | 18.006042296% |
| Extra spins | +5 spins | 7.432024169% |
| Retrigger | +15 spins | 100.000000000% |

### CHANCE/hidden

| Reward | Value / count | Conditional chance |
|---|---:|---:|
| Add multiplier | +2× | 0.000214153% |
| Add multiplier | +3× | 1.519929557% |
| Add multiplier | +4× | 0.000100413% |
| Add multiplier | +5× | 1.679048509% |
| Add multiplier | +8× | 7.689855983% |
| Add multiplier | +10× | 7.828378663% |
| Add multiplier | +12× | 0.000021772% |
| Add multiplier | +15× | 6.073713372% |
| Add multiplier | +20× | 21.854567554% |
| Add multiplier | +25× | 22.780352432% |
| Add multiplier | +50× | 15.826561618% |
| Add multiplier | +100× | 13.722895103% |
| Add multiplier | +200× | 1.024360608% |
| Add multiplier | +1000× | 0.000000264% |
| Multiply multiplier | ×2 | 79.833679834% |
| Multiply multiplier | ×3 | 17.983367983% |
| Multiply multiplier | ×5 | 2.182952183% |
| Sticky Wild | 1 Wild(s) | 87.338501292% |
| Sticky Wild | 2 Wild(s) | 12.661498708% |
| Extra spins | +1 spins | 46.073036518% |
| Extra spins | +2 spins | 30.415207604% |
| Extra spins | +3 spins | 16.508254127% |
| Extra spins | +5 spins | 7.003501751% |
| Retrigger | +15 spins | 100.000000000% |

### FEATURE/normal

| Reward | Value / count | Conditional chance |
|---|---:|---:|
| Add multiplier | +2× | 30.305927342% |
| Add multiplier | +3× | 20.841300191% |
| Add multiplier | +4× | 16.921606119% |
| Add multiplier | +5× | 12.045889101% |
| Add multiplier | +8× | 8.795411090% |
| Add multiplier | +10× | 4.493307839% |
| Add multiplier | +12× | 3.154875717% |
| Add multiplier | +15× | 2.007648184% |
| Add multiplier | +20× | 0.764818356% |
| Add multiplier | +25× | 0.573613767% |
| Add multiplier | +100× | 0.095602294% |

### FEATURE/super

| Reward | Value / count | Conditional chance |
|---|---:|---:|
| Add multiplier | +2× | 28.703703704% |
| Add multiplier | +3× | 21.296296296% |
| Add multiplier | +4× | 20.370370370% |
| Add multiplier | +5× | 10.185185185% |
| Add multiplier | +8× | 8.333333333% |
| Add multiplier | +10× | 5.555555556% |
| Add multiplier | +12× | 2.777777778% |
| Add multiplier | +15× | 0.925925926% |
| Add multiplier | +20× | 0.925925926% |
| Add multiplier | +25× | 0.925925926% |
| Multiply multiplier | ×2 | 81.578947368% |
| Multiply multiplier | ×3 | 15.789473684% |
| Multiply multiplier | ×5 | 2.631578947% |
| Sticky Wild | 1 Wild(s) | 84.848484848% |
| Sticky Wild | 2 Wild(s) | 15.151515152% |
| Extra spins | +1 spins | 42.424242424% |
| Extra spins | +2 spins | 27.272727273% |
| Extra spins | +3 spins | 18.181818182% |
| Extra spins | +5 spins | 12.121212121% |
| Retrigger | +15 spins | 100.000000000% |

### FEATURE/hidden

| Reward | Value / count | Conditional chance |
|---|---:|---:|
| Add multiplier | +2× | 29.230769231% |
| Add multiplier | +3× | 13.846153846% |
| Add multiplier | +4× | 21.538461538% |
| Add multiplier | +5× | 7.692307692% |
| Add multiplier | +8× | 12.307692308% |
| Add multiplier | +10× | 7.692307692% |
| Add multiplier | +12× | 3.076923077% |
| Add multiplier | +15× | 4.615384615% |
| Multiply multiplier | ×2 | 79.411764706% |
| Multiply multiplier | ×3 | 17.647058824% |
| Multiply multiplier | ×5 | 2.941176471% |
| Sticky Wild | 1 Wild(s) | 86.363636364% |
| Sticky Wild | 2 Wild(s) | 13.636363636% |
| Extra spins | +1 spins | 57.142857143% |
| Extra spins | +2 spins | 23.809523810% |
| Extra spins | +3 spins | 9.523809524% |
| Extra spins | +5 spins | 9.523809524% |
| Retrigger | +15 spins | 100.000000000% |

### BONUS/normal

| Reward | Value / count | Conditional chance |
|---|---:|---:|
| Add multiplier | +2× | 21.304785198% |
| Add multiplier | +3× | 25.952276609% |
| Add multiplier | +4× | 15.358307405% |
| Add multiplier | +5× | 21.080837197% |
| Add multiplier | +8× | 5.104986152% |
| Add multiplier | +10× | 5.407061191% |
| Add multiplier | +12× | 3.644543446% |
| Add multiplier | +15× | 0.851720051% |
| Add multiplier | +20× | 0.495312297% |
| Add multiplier | +25× | 0.647610401% |
| Add multiplier | +50× | 0.141731215% |
| Add multiplier | +100× | 0.010824482% |
| Add multiplier | +200× | 0.000003111% |
| Add multiplier | +500× | 0.000000622% |
| Add multiplier | +1000× | 0.000000622% |

### SUPER/super

| Reward | Value / count | Conditional chance |
|---|---:|---:|
| Add multiplier | +2× | 12.927972562% |
| Add multiplier | +3× | 20.399867576% |
| Add multiplier | +4× | 11.964973589% |
| Add multiplier | +5× | 19.297210790% |
| Add multiplier | +8× | 6.673808075% |
| Add multiplier | +10× | 9.975778166% |
| Add multiplier | +12× | 7.122342533% |
| Add multiplier | +15× | 2.903310111% |
| Add multiplier | +20× | 2.875386498% |
| Add multiplier | +25× | 3.072095767% |
| Add multiplier | +50× | 2.541012032% |
| Add multiplier | +100× | 0.246239243% |
| Add multiplier | +200× | 0.000001529% |
| Add multiplier | +500× | 0.000001019% |
| Add multiplier | +1000× | 0.000000510% |
| Multiply multiplier | ×2 | 80.264292196% |
| Multiply multiplier | ×3 | 19.549682396% |
| Multiply multiplier | ×5 | 0.186025408% |
| Sticky Wild | 1 Wild(s) | 96.477349321% |
| Sticky Wild | 2 Wild(s) | 3.522650679% |
| Extra spins | +1 spins | 67.619196743% |
| Extra spins | +2 spins | 22.195255617% |
| Extra spins | +3 spins | 7.844672356% |
| Extra spins | +5 spins | 2.340875284% |
| Retrigger | +15 spins | 100.000000000% |

### MYSTERY/normal

| Reward | Value / count | Conditional chance |
|---|---:|---:|
| Add multiplier | +2× | 19.867301138% |
| Add multiplier | +3× | 27.354179191% |
| Add multiplier | +4× | 15.077432065% |
| Add multiplier | +5× | 21.140526087% |
| Add multiplier | +8× | 5.528321116% |
| Add multiplier | +10× | 5.735480492% |
| Add multiplier | +12× | 3.164263348% |
| Add multiplier | +15× | 0.791492603% |
| Add multiplier | +20× | 0.764178363% |
| Add multiplier | +25× | 0.422755356% |
| Add multiplier | +50× | 0.150118004% |
| Add multiplier | +100× | 0.003951858% |
| Add multiplier | +200× | 0.000000189% |
| Add multiplier | +500× | 0.000000063% |
| Add multiplier | +1000× | 0.000000126% |

### MYSTERY/super

| Reward | Value / count | Conditional chance |
|---|---:|---:|
| Add multiplier | +2× | 11.898495190% |
| Add multiplier | +3× | 20.659115811% |
| Add multiplier | +4× | 11.790603712% |
| Add multiplier | +5× | 20.689825710% |
| Add multiplier | +8× | 7.035973171% |
| Add multiplier | +10× | 9.422959829% |
| Add multiplier | +12× | 6.932238815% |
| Add multiplier | +15× | 2.961847005% |
| Add multiplier | +20× | 2.864039969% |
| Add multiplier | +25× | 2.930601879% |
| Add multiplier | +50× | 2.460582415% |
| Add multiplier | +100× | 0.353716392% |
| Add multiplier | +200× | 0.000000051% |
| Add multiplier | +1000× | 0.000000051% |
| Multiply multiplier | ×2 | 92.674180198% |
| Multiply multiplier | ×3 | 7.312641132% |
| Multiply multiplier | ×5 | 0.013178670% |
| Sticky Wild | 1 Wild(s) | 99.011344746% |
| Sticky Wild | 2 Wild(s) | 0.988655254% |
| Extra spins | +1 spins | 31.257846018% |
| Extra spins | +2 spins | 1.266399040% |
| Extra spins | +3 spins | 67.354357213% |
| Extra spins | +5 spins | 0.121397729% |
| Retrigger | +15 spins | 100.000000000% |

### MYSTERY/hidden

| Reward | Value / count | Conditional chance |
|---|---:|---:|
| Add multiplier | +2× | 0.000035182% |
| Add multiplier | +3× | 1.626469283% |
| Add multiplier | +4× | 0.000018506% |
| Add multiplier | +5× | 1.802618338% |
| Add multiplier | +8× | 7.400225523% |
| Add multiplier | +10× | 8.270040240% |
| Add multiplier | +12× | 0.000003348% |
| Add multiplier | +15× | 6.362728670% |
| Add multiplier | +20× | 22.672036342% |
| Add multiplier | +25× | 22.413160451% |
| Add multiplier | +50× | 15.463321957% |
| Add multiplier | +100× | 13.042430929% |
| Add multiplier | +200× | 0.946911205% |
| Add multiplier | +1000× | 0.000000026% |
| Multiply multiplier | ×2 | 80.614087899% |
| Multiply multiplier | ×3 | 17.369054786% |
| Multiply multiplier | ×5 | 2.016857315% |
| Sticky Wild | 1 Wild(s) | 86.661373561% |
| Sticky Wild | 2 Wild(s) | 13.338626439% |
| Extra spins | +1 spins | 43.548387097% |
| Extra spins | +2 spins | 30.436081243% |
| Extra spins | +3 spins | 18.189964158% |
| Extra spins | +5 spins | 7.825567503% |
| Retrigger | +15 spins | 100.000000000% |

## Proposal odds — not published odds

RandomSource disables Wild awards once three sticky Wilds are active, then renormalizes other types. Additive values 2/3/4/5/8/10/12/15/20/25/50/100/200/500/1000 carry weights 30000/22000/16000/12000/8000/5000/3000/2000/1000/500/150/40/10/2/1. Boost 2×/3×/5×: 80/18/2%. Extra spins +1/+2/+3/+5: 45/30/18/7%. Sticky count 1/2: 80/20%, clipped by state. Retrigger +15: 100%. SpreadBonusSource and witness proposal sources have different laws, and final lookup weighting changes them again.

## Verification

Source and published book/lookup SHA-256 hashes stored in `bonus-gate-breakdown.json`. Integer sums used for weighted counts and event-unit payouts. Mode costs and 96.1% target checked against current math_targets.py and v7.2 validation reports. Complete JSON contains all route-specific odds. Finite-library exactness does not establish fresh-generator convergence or production acceptance.
