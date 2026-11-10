# v11 large-package import investigation

## Observations (2026-10-18, Europe/Sofia)
- Studio rejects MYSTERY with `ERR_INVALID_FORMAT` and `books_MYSTERY.jsonl.zst:4294961558:0`.
- Other modes were not confirmed checked: import stopped at MYSTERY.
- Source: `math-sdk/games/0_0_the_gates_v11/library-v11-500k-20261018-013106`.
- Original MYSTERY: 4,212,700,840 compressed bytes; 49,413,119,339 decoded JSONL bytes; 500,000 books.
- Full local structural scan: all 500,000 records parse, sequential IDs, complete Zstd frame.
- At decoded offset 4,294,961,558, book 62,738 parses locally (record spans bytes 4,294,930,467–4,294,998,803).
- Lossless recompression reduced the file to 2,685,288,474 bytes; identical import error reported.
- Original/recompressed decoded SHA256: `8b10536d06f485661c1f6cd8d5832e7d5041fdb81e2fdf02e62246ec9fa390d7`.
- A 1k/mode diagnostic sample imported. Its differing RTP/tail results were expected: sampled weights were not refitted. It is NOT release math.

## Interpretation
A decoded-data/scale-dependent importer issue is plausible: the offset is 5,738 bytes below 2^32, and stronger compression did not change the error. This is **not a confirmed backend diagnosis**. Small samples change record coverage and IDs as well as size; they cannot exclude every rare-content/schema issue.

## Approved workaround candidate
Build 10k/mode from retained independent v11 candidate prefixes, without regenerating outcomes. Refit weights with unchanged 96.1% RTP/reward/tail/experience contracts. Preserve all 500k originals. Reject any decoded mode file >=2 GiB. Full local event replay, hashes, lookup coverage and risk checks required before upload.

Candidate: `math-sdk/games/0_0_the_gates_v11/library-v11-balanced-10k-20261018`.
Consult its `configs/local_validation_report.json` for actual validation status; generation alone is not validation.
Upload its whole `publish_files` directory (all six event files, six lookup files and index); never mix with diagnostic/500k lookups.

## Studio escalation, if retaining 500k is required
Ask Studio to clarify:
1. Meaning of `:4294961558:0` (decoded byte offset, line, or another index).
2. Compressed/decoded file size and record-count limits; any 32-bit buffer/offset boundary.
3. Supported book sharding format, if any. Current supplied index uses one event filename per mode; do not invent arrays/shards without confirmation.
4. Whether they can reproduce with the exact file hashes and the valid record at the reported decoded offset.

RGS acceptance and Studio risk review remain separate from local validation.

## Accepted workaround / cleanup
User confirmed the balanced 10k package imports and shows no compliance issues. This is user-reported Studio acceptance, not an independently observed platform audit. On 2026-10-18 the user authorized deleting obsolete generated libraries, including both 500k archives and diagnostic samples, while retaining all source code and the accepted balanced 10k package. Small metadata/config archives and retained-file hashes are under `math-sdk/games/0_0_the_gates_v11/cleanup-audit-20261018-110614`. Historical paths above are evidence references, not current upload locations.
