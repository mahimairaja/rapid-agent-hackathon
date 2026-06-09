# Data Sources and Provenance

All data in this project is **fully synthetic**. No real patient information is
present. This file records the origin and license of every data source for the
repository and the demo disclaimer.

## Synthetic patients (structured records)

`data/synthea/{patients,medications,appointments}.csv` are hand-authored,
Synthea-shaped sample records for four demo patients. They mimic the column
layout of [Synthea](https://github.com/synthetichealth/synthea) (Apache 2.0) so
a real pre-generated Synthea CSV export can be dropped into `data/synthea/` and
seeded by the same `scripts/seed_patients.py`.

| patient_id (suffix) | Name | Scenario | Red-flag for F5 |
| --- | --- | --- | --- |
| ...3301 | Margaret Chen | Chronic heart failure exacerbation | yes |
| ...3302 | James Okafor | Post-op total knee replacement | no |
| ...3303 | Aisha Patel | Newly diagnosed type 2 diabetes | no |
| ...3304 | Robert Sullivan | COPD exacerbation | no |

The discharge narratives in `data/patients/*.md` are authored by the project.
Margaret Chen's narrative deliberately carries the red-flag scenario (heart
failure warning signs) used to exercise F5 symptom triage and escalation.

## Guidelines corpus (trusted knowledge)

Public-domain U.S. federal patient-education sources only. See the table below;
populated by `scripts/ingest_guidelines.py`. MedlinePlus A.D.A.M. content is
deliberately NOT ingested because it is licensed/copyrighted.

<!-- guidelines-table: populated in Phase 4 -->
