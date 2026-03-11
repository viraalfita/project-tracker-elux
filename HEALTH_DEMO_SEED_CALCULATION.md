# Health Demo Seed — Detail Perhitungan

> **Tanggal referensi:** 2026-03-11 (hari ini ketika seed dirancang)  
> **Script:** `scripts/seed-health-demo.ts`  
> **Data ini sudah ada di PocketBase** — jalankan script lagi aman (idempotent).

---

## Formula Algoritma

Implementasi di `lib/utils.ts` — `getTaskHealth()` dan `getEpicHealth()`.

### Level 1 — Task Health

```
totalDays   = dueDate − startDate  (dalam hari)
elapsedDays = today   − startDate  (dalam hari, min 0)
expectedPct = clamp(elapsedDays / totalDays, 0, 1) × 100
actualPct   = (doneSubs / totalSubs) × 100
gap         = expectedPct − actualPct
```

| Kondisi (diperiksa berurutan)                                         | Hasil                              |
| --------------------------------------------------------------------- | ---------------------------------- |
| `dueDate < today` **dan** `status ≠ Done`                             | 🔴 **Delayed** (hard overdue)      |
| `status == Done`                                                      | ✅ **On Track**                    |
| `gap > 40`                                                            | 🔴 **Delayed** (sangat tertinggal) |
| `gap > 20`                                                            | ⚠️ **At Risk**                     |
| `gap ≤ 20`                                                            | ✅ **On Track**                    |
| _Fallback (tidak ada startDate):_ `daysLeft ≤ 3` dan `actualPct < 50` | ⚠️ **At Risk**                     |

### Level 2 — Epic Health

| Kondisi (diperiksa berurutan)                  | Hasil           |
| ---------------------------------------------- | --------------- |
| `epic.endDate < today` **dan** `status ≠ Done` | 🔴 **Delayed**  |
| `(delayedTasks / total) × 100 ≥ 20`            | 🔴 **Delayed**  |
| `(atRiskTasks / total) × 100 ≥ 30`             | ⚠️ **At Risk**  |
| Semua lainnya                                  | ✅ **On Track** |

---

## Notasi Kolom

| Kolom        | Keterangan                                                             |
| ------------ | ---------------------------------------------------------------------- |
| `startDate`  | Date task dibuat = `task.startDate` (di-map dari PocketBase `created`) |
| `dueDate`    | Deadline task                                                          |
| `done/total` | Jumlah sub-task selesai / total                                        |
| `elapsed`    | `today (2026-03-11) − startDate` dalam hari                            |
| `total`      | `dueDate − startDate` dalam hari                                       |
| `expected%`  | `(elapsed / total) × 100` — progress yang seharusnya                   |
| `actual%`    | `(done / total) × 100` — progress nyata                                |
| `gap`        | `expected% − actual%` — selisih (positif = tertinggal)                 |

---

## Epic A — "Health Demo: On Track"

```
endDate  : 2026-05-31  (jauh di depan → bukan trigger Delayed)
Status   : In Progress
```

### Kalkulasi per Task

#### A1 — [A1] Setup CI/CD Pipeline

```
startDate = 2026-03-01
dueDate   = 2026-03-25
today     = 2026-03-11

elapsed   = 2026-03-11 − 2026-03-01 = 10 hari
total     = 2026-03-25 − 2026-03-01 = 24 hari
expected% = (10 / 24) × 100 = 41.67%

done/total = 7/10
actual%    = (7 / 10) × 100 = 70.00%

gap = 41.67% − 70.00% = −28.33%  ← negatif = AHEAD OF SCHEDULE
```

> `gap ≤ 20%` → ✅ **ON TRACK**

---

#### A2 — [A2] Write API Documentation

```
startDate = 2026-03-05
dueDate   = 2026-03-30
today     = 2026-03-11

elapsed   = 2026-03-11 − 2026-03-05 = 6 hari
total     = 2026-03-30 − 2026-03-05 = 25 hari
expected% = (6 / 25) × 100 = 24.00%

done/total = 5/10
actual%    = (5 / 10) × 100 = 50.00%

gap = 24.00% − 50.00% = −26.00%  ← negatif = AHEAD OF SCHEDULE
```

> `gap ≤ 20%` → ✅ **ON TRACK**

---

#### A3 — [A3] Design System Tokens

```
startDate = 2026-02-25
dueDate   = 2026-04-10
today     = 2026-03-11

elapsed   = 2026-03-11 − 2026-02-25 = 14 hari
total     = 2026-04-10 − 2026-02-25 = 44 hari
expected% = (14 / 44) × 100 = 31.82%

done/total = 6/10
actual%    = (6 / 10) × 100 = 60.00%

gap = 31.82% − 60.00% = −28.18%  ← negatif = AHEAD OF SCHEDULE
```

> `gap ≤ 20%` → ✅ **ON TRACK**

---

### Agregasi Epic A

```
Total tasks : 3
Delayed     : 0   →  (0/3) × 100 =  0.0%   < 20% ✓
At Risk     : 0   →  (0/3) × 100 =  0.0%   < 30% ✓
endDate     : 2026-05-31 > 2026-03-11 ✓
```

> ### ✅ EPIC A: ON TRACK

---

## Epic B — "Health Demo: At Risk"

```
endDate  : 2026-04-30  (jauh di depan → bukan trigger Delayed)
Status   : In Progress
```

### Kalkulasi per Task

#### B1 — [B1] Build Authentication Service

```
startDate = 2026-02-20
dueDate   = 2026-03-25
today     = 2026-03-11

elapsed   = 2026-03-11 − 2026-02-20 = 19 hari
total     = 2026-03-25 − 2026-02-20 = 33 hari
expected% = (19 / 33) × 100 = 57.58%

done/total = 3/10
actual%    = (3 / 10) × 100 = 30.00%

gap = 57.58% − 30.00% = +27.58%  ← positif = TERTINGGAL
```

> `20 < gap ≤ 40` → ⚠️ **AT RISK**

---

#### B2 — [B2] Integrate Payment SDK

```
startDate = 2026-03-01
dueDate   = 2026-03-20
today     = 2026-03-11

elapsed   = 2026-03-11 − 2026-03-01 = 10 hari
total     = 2026-03-20 − 2026-03-01 = 19 hari
expected% = (10 / 19) × 100 = 52.63%

done/total = 3/10
actual%    = (3 / 10) × 100 = 30.00%

gap = 52.63% − 30.00% = +22.63%  ← positif = TERTINGGAL
```

> `20 < gap ≤ 40` → ⚠️ **AT RISK**

---

#### B3 — [B3] Database Schema Migration

```
startDate = 2026-03-01
dueDate   = 2026-03-30
today     = 2026-03-11

elapsed   = 2026-03-11 − 2026-03-01 = 10 hari
total     = 2026-03-30 − 2026-03-01 = 29 hari
expected% = (10 / 29) × 100 = 34.48%

done/total = 4/10
actual%    = (4 / 10) × 100 = 40.00%

gap = 34.48% − 40.00% = −5.52%  ← negatif = sedikit ahead
```

> `gap ≤ 20%` → ✅ **ON TRACK**

---

#### B4 — [B4] Load Testing Suite

```
startDate = 2026-03-05
dueDate   = 2026-04-15
today     = 2026-03-11

elapsed   = 2026-03-11 − 2026-03-05 = 6 hari
total     = 2026-04-15 − 2026-03-05 = 41 hari
expected% = (6 / 41) × 100 = 14.63%

done/total = 5/10
actual%    = (5 / 10) × 100 = 50.00%

gap = 14.63% − 50.00% = −35.37%  ← jauh ahead
```

> `gap ≤ 20%` → ✅ **ON TRACK**

---

#### B5 — [B5] Security Audit

```
startDate = 2026-03-08
dueDate   = 2026-04-20
today     = 2026-03-11

elapsed   = 2026-03-11 − 2026-03-08 = 3 hari
total     = 2026-04-20 − 2026-03-08 = 43 hari
expected% = (3 / 43) × 100 = 6.98%

done/total = 3/6
actual%    = (3 / 6) × 100 = 50.00%

gap = 6.98% − 50.00% = −43.02%  ← jauh ahead (baru mulai)
```

> `gap ≤ 20%` → ✅ **ON TRACK**

---

### Agregasi Epic B

```
Total tasks : 5
Delayed     : 0   →  (0/5) × 100 =  0.0%   < 20% ✓ (tidak trigger Delayed)
At Risk     : 2   →  (2/5) × 100 = 40.0%   ≥ 30% ✗ (trigger At Risk!)
endDate     : 2026-04-30 > 2026-03-11 ✓
```

> ### ⚠️ EPIC B: AT RISK
>
> Dua task (B1 & B2) lagging karena progress aktual jauh di bawah expected. Proporsi 40% melebihi threshold 30%.

---

## Epic C — "Health Demo: Delayed (EndDate Passed)"

```
endDate  : 2026-03-05  ← SUDAH LEWAT dari today (2026-03-11)
Status   : In Progress
```

### Kalkulasi per Task

#### C1 — [C1] Frontend Component Refactor

```
startDate = 2026-03-01
dueDate   = 2026-03-20
today     = 2026-03-11

elapsed   = 2026-03-11 − 2026-03-01 = 10 hari
total     = 2026-03-20 − 2026-03-01 = 19 hari
expected% = (10 / 19) × 100 = 52.63%

done/total = 2/5
actual%    = (2 / 5) × 100 = 40.00%

gap = 52.63% − 40.00% = +12.63%
```

> `gap ≤ 20%` → ✅ **ON TRACK** (task sehat secara individual)

---

#### C2 — [C2] Database Index Optimization

```
startDate = 2026-03-01
dueDate   = 2026-03-25
today     = 2026-03-11

elapsed   = 2026-03-11 − 2026-03-01 = 10 hari
total     = 2026-03-25 − 2026-03-01 = 24 hari
expected% = (10 / 24) × 100 = 41.67%

done/total = 1/4
actual%    = (1 / 4) × 100 = 25.00%

gap = 41.67% − 25.00% = +16.67%
```

> `gap ≤ 20%` → ✅ **ON TRACK** (task sehat secara individual)

---

### Agregasi Epic C

```
Total tasks : 2
Delayed     : 0   →  0% < 20% ✓
At Risk     : 0   →  0% < 30% ✓

Cek endDate : epic.endDate (2026-03-05) < today (2026-03-11) ← TRIGGER!
```

> ### 🔴 EPIC C: DELAYED
>
> Semua task individual masih **ON TRACK**, tapi `getEpicHealth()` mengecek `endDate` lebih dulu — sebelum agregasi task. Epic deadline sudah terlewat 6 hari.
>
> **Pelajaran:** Epic bisa Delayed meski semua task-nya sehat, kalau epic deadline-nya sudah lewat.

---

## Epic D — "Health Demo: Delayed (Task Aggregation)"

```
endDate  : 2026-05-31  (jauh di depan → bukan trigger Delayed)
Status   : In Progress
```

Kasus ini mendemonstrasikan Delayed yang muncul **dari agregasi task**, bukan dari `endDate` epic.

### Kalkulasi per Task

#### D1 — [D1] Deploy Microservices

```
startDate = (tidak ada)
dueDate   = 2026-03-08
today     = 2026-03-11

CECK PERTAMA: dueDate (2026-03-08) < today (2026-03-11) → OVERDUE
Status: In Progress (bukan Done)
```

> 🔴 **DELAYED** — Hard overdue. Cek `startDate` tidak pernah dijalankan.

---

#### D2 — [D2] Kubernetes Cluster Setup

```
startDate = (tidak ada)
dueDate   = 2026-03-10
today     = 2026-03-11

CECK PERTAMA: dueDate (2026-03-10) < today (2026-03-11) → OVERDUE
Status: In Progress (bukan Done)
```

> 🔴 **DELAYED** — Hard overdue. Hanya 1 hari selisih, tapi lewat = lewat.

---

#### D3 — [D3] Monitoring Dashboard

```
startDate = 2026-02-20
dueDate   = 2026-03-25
today     = 2026-03-11

elapsed   = 2026-03-11 − 2026-02-20 = 19 hari
total     = 2026-03-25 − 2026-02-20 = 33 hari
expected% = (19 / 33) × 100 = 57.58%

done/total = 2/8
actual%    = (2 / 8) × 100 = 25.00%

gap = 57.58% − 25.00% = +32.58%  ← positif = TERTINGGAL
```

> `20 < gap ≤ 40` → ⚠️ **AT RISK**

---

#### D4 — [D4] Disaster Recovery Plan

```
startDate = 2026-03-05
dueDate   = 2026-04-30
today     = 2026-03-11

elapsed   = 2026-03-11 − 2026-03-05 = 6 hari
total     = 2026-04-30 − 2026-03-05 = 56 hari
expected% = (6 / 56) × 100 = 10.71%

done/total = 3/8
actual%    = (3 / 8) × 100 = 37.50%

gap = 10.71% − 37.50% = −26.79%  ← jauh ahead
```

> `gap ≤ 20%` → ✅ **ON TRACK**

---

#### D5 — [D5] Alerting & Notifications

```
startDate = 2026-03-01
dueDate   = 2026-04-15
today     = 2026-03-11

elapsed   = 2026-03-11 − 2026-03-01 = 10 hari
total     = 2026-04-15 − 2026-03-01 = 45 hari
expected% = (10 / 45) × 100 = 22.22%

done/total = 4/8
actual%    = (4 / 8) × 100 = 50.00%

gap = 22.22% − 50.00% = −27.78%  ← ahead of schedule
```

> `gap ≤ 20%` → ✅ **ON TRACK**

---

### Agregasi Epic D

```
Total tasks : 5
Delayed     : 2  (D1, D2)  →  (2/5) × 100 = 40.0%  ≥ 20% ← TRIGGER!
At Risk     : 1  (D3)      →  (1/5) × 100 = 20.0%  (tidak dihitung lagi)
endDate     : 2026-05-31 > 2026-03-11 ✓
```

> ### 🔴 EPIC D: DELAYED
>
> `endDate` masih jauh, tapi 2 dari 5 task (40%) sudah Delayed (overdue). Proporsi 40% melebihi threshold 20%.
>
> **Pelajaran:** Epic bisa Delayed bahkan sebelum deadline-nya tiba, kalau cukup banyak task sudah melewati due date-nya masing-masing.

---

## Ringkasan Semua Hasil

| Epic                  | `endDate`      | Trigger Delayed   | Delayed Tasks | At Risk Tasks |    **Hasil**    |
| --------------------- | -------------- | ----------------- | :-----------: | :-----------: | :-------------: |
| A — On Track          | 2026-05-31     | —                 |   0/3 (0%)    |   0/3 (0%)    | ✅ **On Track** |
| B — At Risk           | 2026-04-30     | —                 |   0/5 (0%)    |   2/5 (40%)   | ⚠️ **At Risk**  |
| C — Delayed (EndDate) | **2026-03-05** | `endDate < today` |   0/2 (0%)    |   0/2 (0%)    | 🔴 **Delayed**  |
| D — Delayed (Tasks)   | 2026-05-31     | —                 | **2/5 (40%)** |   1/5 (20%)   | 🔴 **Delayed**  |

### Rekap Health Task per Epic

| Task | startDate  | dueDate        | done/total | expected% | actual% |     gap     |   Health    |
| ---- | ---------- | -------------- | :--------: | :-------: | :-----: | :---------: | :---------: |
| A1   | 2026-03-01 | 2026-03-25     |    7/10    |  41.67%   | 70.00%  |   −28.33%   | ✅ On Track |
| A2   | 2026-03-05 | 2026-03-30     |    5/10    |  24.00%   | 50.00%  |   −26.00%   | ✅ On Track |
| A3   | 2026-02-25 | 2026-04-10     |    6/10    |  31.82%   | 60.00%  |   −28.18%   | ✅ On Track |
| B1   | 2026-02-20 | 2026-03-25     |    3/10    |  57.58%   | 30.00%  | **+27.58%** | ⚠️ At Risk  |
| B2   | 2026-03-01 | 2026-03-20     |    3/10    |  52.63%   | 30.00%  | **+22.63%** | ⚠️ At Risk  |
| B3   | 2026-03-01 | 2026-03-30     |    4/10    |  34.48%   | 40.00%  |   −5.52%    | ✅ On Track |
| B4   | 2026-03-05 | 2026-04-15     |    5/10    |  14.63%   | 50.00%  |   −35.37%   | ✅ On Track |
| B5   | 2026-03-08 | 2026-04-20     |    3/6     |   6.98%   | 50.00%  |   −43.02%   | ✅ On Track |
| C1   | 2026-03-01 | 2026-03-20     |    2/5     |  52.63%   | 40.00%  |   +12.63%   | ✅ On Track |
| C2   | 2026-03-01 | 2026-03-25     |    1/4     |  41.67%   | 25.00%  |   +16.67%   | ✅ On Track |
| D1   | —          | **2026-03-08** |    1/8     |  OVERDUE  |    —    |      —      | 🔴 Delayed  |
| D2   | —          | **2026-03-10** |    1/8     |  OVERDUE  |    —    |      —      | 🔴 Delayed  |
| D3   | 2026-02-20 | 2026-03-25     |    2/8     |  57.58%   | 25.00%  | **+32.58%** | ⚠️ At Risk  |
| D4   | 2026-03-05 | 2026-04-30     |    3/8     |  10.71%   | 37.50%  |   −26.79%   | ✅ On Track |
| D5   | 2026-03-01 | 2026-04-15     |    4/8     |  22.22%   | 50.00%  |   −27.78%   | ✅ On Track |

---

## Cara Verifikasi di App

Setelah seed dijalankan, buka app dan cek:

| Halaman      | Yang diperiksa                                                          |
| ------------ | ----------------------------------------------------------------------- |
| `/epics`     | Badge di samping nama epic — harus sesuai tabel di atas                 |
| `/board`     | Filter ke salah satu demo epic → task card A1–D5 tampilkan badge health |
| `/dashboard` | EWS section — Epic B, C, D muncul di daftar "at risk/delayed"           |
| `/goal/[id]` | Kalau demo epics di-link ke goal, health badge per epic muncul          |

> **Catatan tanggal:** Perhitungan ini valid untuk **2026-03-11**. Karena `today` berubah setiap hari, gap akan bergeser dan hasil bisa berbeda jika dilihat di tanggal lain. Lihat kolom `expected%` — semakin lewat hari, semakin tinggi expected progress, sehingga gap bisa membesar.
