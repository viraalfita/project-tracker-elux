# Health Status Algorithm — Dokumentasi Implementasi

> **Status:** ✅ Fully implemented — Ideal algorithm aktif di production code.  
> **Lokasi utama:** `lib/utils.ts` — `getTaskHealth()`, `getEpicHealth()`  
> **Terakhir diperbarui:** Maret 2026

---

## Daftar Isi

1. [Struktur Hierarki](#struktur-hierarki)
2. [Tipe Data & Helper](#tipe-data--helper)
3. [Level 1 — Task Health](#level-1--task-health)
4. [Level 2 — Epic Health](#level-2--epic-health)
5. [Perbandingan Simple vs Ideal](#perbandingan-simple-vs-ideal)
6. [Contoh Kasus Lengkap](#contoh-kasus-lengkap)
7. [Integrasi ke UI](#integrasi-ke-ui)
8. [Catatan Implementasi](#catatan-implementasi)

---

## Struktur Hierarki & 2 Level Health

```
EPIC
 └── Task          ← Level 1: health dihitung dari progress sub-task & due date task
      └── Sub-task ← Input data: done/not done (boolean)
```

Health status dihitung **bottom-up**:

```
Sub-task (done/not done)
    ↓ dihitung jadi progress %
Task Health  →  On Track / At Risk / Delayed
    ↓ diagregasi
Epic Health  →  On Track / At Risk / Delayed
```

| Level    | Input Data                                              | Output         |
| -------- | ------------------------------------------------------- | -------------- |
| **Task** | Sub-task done/total, `startDate`, `dueDate`, `status`   | `HealthStatus` |
| **Epic** | Kumpulan `Task.health` + `epic.endDate` + `epic.status` | `HealthStatus` |

---

## Tipe Data & Helper

### `HealthStatus` — `lib/utils.ts`

```ts
export type HealthStatus = "On Track" | "At Risk" | "Delayed";
```

Semua nilai yang mungkin: tiga state ini konsisten dipakai di task dan epic.

### `Task.startDate` — `lib/types.ts`

```ts
export interface Task {
  startDate?: string; // "YYYY-MM-DD" — opsional, di-derive dari created timestamp
  dueDate: string;
  // ...
}
```

`startDate` di-map dari field `created` PocketBase di `lib/pb-mappers.ts`:

```ts
// lib/pb-mappers.ts
startDate: r.created ? r.created.split(" ")[0] : undefined,
dueDate:   r.due_date ? r.due_date.split(" ")[0] : "",
```

### `getTodayStr()` & `isTaskOverdue()` — `lib/utils.ts`

```ts
// Mengembalikan "YYYY-MM-DD" dalam local timezone (bukan UTC)
// Aman dari timezone bug: "2026-03-10" < "2026-03-11" adalah perbandingan string
export function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isTaskOverdue(
  dueDate: string | undefined,
  status: string,
): boolean {
  if (!dueDate) return false;
  return dueDate < getTodayStr() && status !== "Done";
}
```

> ⚠️ **Mengapa string comparison?**  
> `new Date("2026-03-10")` di-parse sebagai **UTC midnight**, bukan local time.
> Kalau dibandingkan dengan `new Date()` (local), task due hari ini bisa salah dianggap overdue.
> Solusi: bandingkan dua string `"YYYY-MM-DD"` langsung — hasilnya selalu benar tanpa timezone ambiguity.

---

## Level 1 — Task Health

### Implementasi aktual — `getTaskHealth(task: Task): HealthStatus`

Algoritma ini **hybrid**: Ideal dulu, fallback ke Simple kalau `startDate` tidak tersedia.

```ts
export function getTaskHealth(task: Task): HealthStatus {
  const today = getTodayStr();
  const progress = getTaskProgress(task); // 0–100 berdasarkan sub-task selesai

  // 1. Sudah overdue → langsung Delayed
  if (task.dueDate && task.dueDate < today && task.status !== "Done")
    return "Delayed";

  // 2. Done → selalu On Track
  if (task.status === "Done") return "On Track";

  // 3. IDEAL: bandingkan progress aktual vs expected
  if (task.startDate && task.dueDate) {
    const totalDays = diffDays(task.dueDate, task.startDate);
    if (totalDays > 0) {
      const elapsedDays = Math.max(diffDays(today, task.startDate), 0);
      const expectedProgress = Math.min((elapsedDays / totalDays) * 100, 100);
      const gap = expectedProgress - progress;

      if (gap > 40) return "Delayed"; // sangat tertinggal
      if (gap > 20) return "At Risk"; // mulai tertinggal
      return "On Track";
    }
  }

  // 4. FALLBACK Simple: proximity to due date
  if (task.dueDate) {
    const daysLeft = diffDays(task.dueDate, today);
    if (daysLeft <= 3 && progress < 50) return "At Risk";
  }

  return "On Track";
}
```

### Decision tree

```
task.dueDate < today && status != Done?
    YES → Delayed
    NO  ↓
status == Done?
    YES → On Track
    NO  ↓
startDate tersedia && totalDays > 0?
    YES →  gap = expectedProgress - actualProgress
           gap > 40% → Delayed
           gap > 20% → At Risk
           gap ≤ 20% → On Track
    NO  ↓ (fallback)
daysLeft ≤ 3 && progress < 50%?
    YES → At Risk
    NO  → On Track
```

### Tabel aturan

| Kondisi                                          | Status       |
| ------------------------------------------------ | ------------ |
| `dueDate < today` dan belum Done                 | **Delayed**  |
| `status === "Done"`                              | **On Track** |
| Gap expected vs actual > 40%                     | **Delayed**  |
| Gap expected vs actual > 20%                     | **At Risk**  |
| ≤ 3 hari tersisa dan progress < 50% _(fallback)_ | **At Risk**  |
| Semua lainnya                                    | **On Track** |

---

## Level 2 — Epic Health

### Implementasi aktual — `getEpicHealth(epic, tasks): HealthStatus`

```ts
export function getEpicHealth(
  epic: { endDate?: string; status: string },
  tasks: Task[],
): HealthStatus {
  const today = getTodayStr();

  // 1. Epic itu sendiri sudah overdue
  if (epic.endDate && epic.endDate < today && epic.status !== "Done")
    return "Delayed";

  if (tasks.length === 0) return "On Track";

  // 2. Hitung proporsi task bermasalah
  const delayed = tasks.filter((t) => getTaskHealth(t) === "Delayed").length;
  const atRisk = tasks.filter((t) => getTaskHealth(t) === "At Risk").length;
  const delayedPct = (delayed / tasks.length) * 100;
  const atRiskPct = (atRisk / tasks.length) * 100;

  if (delayedPct >= 20) return "Delayed"; // ≥20% task delayed
  if (atRiskPct >= 30) return "At Risk"; // ≥30% task at risk
  return "On Track";
}
```

> **Catatan:** Parameter `tasks` harus sudah difilter ke task milik epic tersebut sebelum dipassing ke fungsi ini.
>
> ```ts
> // Cara pemakaian yang benar:
> const health = getEpicHealth(
>   epic,
>   tasks.filter((t) => t.epicId === epic.id),
> );
> ```

### Decision tree

```
epic.endDate < today && status != Done?
    YES → Delayed
    NO  ↓
tasks.length === 0?
    YES → On Track
    NO  ↓
(delayed / total) * 100 ≥ 20?
    YES → Delayed
    NO  ↓
(atRisk / total) * 100 ≥ 30?
    YES → At Risk
    NO  → On Track
```

### Threshold yang dipakai

| Kondisi                               | Status       |
| ------------------------------------- | ------------ |
| `epic.endDate < today` dan belum Done | **Delayed**  |
| ≥ 20% task berstatus Delayed          | **Delayed**  |
| ≥ 30% task berstatus At Risk          | **At Risk**  |
| `tasks.length === 0`                  | **On Track** |
| Semua lainnya                         | **On Track** |

---

## Perbandingan Simple vs Ideal

### Level 1 — Task Health

| Aspek               | Simple                                    | Ideal (implementasi saat ini)                    |
| ------------------- | ----------------------------------------- | ------------------------------------------------ |
| Input               | `dueDate`, progress                       | `startDate`, `dueDate`, progress                 |
| Logika              | Cek proximity (≤ 3 hari + progress < 50%) | Expected progress vs actual (time-based)         |
| Presisi             | Kasar — baru alert ketika hampir deadline | Lebih dini — bisa detect masalah sejak awal      |
| Fallback            | —                                         | Ya — kalau `startDate` tidak ada, pakai Simple   |
| Contoh "terdeteksi" | 2 hari sebelum deadline                   | Saat midsprint jika progress < 40% dari expected |

### Level 2 — Epic Health

| Aspek           | Simple (Majority)                      | Ideal (implementasi saat ini)                   |
| --------------- | -------------------------------------- | ----------------------------------------------- |
| Trigger Delayed | 1 task saja Delayed                    | ≥ 20% task Delayed                              |
| Trigger At Risk | 1 task saja At Risk                    | ≥ 30% task At Risk                              |
| False positives | Tinggi — 1 task kecil bikin Epic merah | Rendah — butuh proporsi signifikan              |
| False negatives | Rendah                                 | Bisa miss kalau task kritis hanya 1 dari banyak |
| Cocok untuk     | Epic dengan sedikit task (< 5)         | Epic dengan banyak task (> 5)                   |

---

## Contoh Kasus Lengkap

### Contoh 1 — Task Health (Ideal, ada startDate)

```
Task: "Build Payment API"
startDate : 2026-03-01
dueDate   : 2026-03-20
Hari ini  : 2026-03-13
Sub-task  : 4/10 selesai

totalDays      = diffDays("2026-03-20", "2026-03-01") = 19 hari
elapsedDays    = diffDays("2026-03-13", "2026-03-01") = 12 hari
expectedProgress = (12 / 19) × 100 = 63%
actualProgress   = 4/10 × 100 = 40%
gap              = 63 - 40 = 23%

→  gap > 20% → AT RISK ⚠️
```

### Contoh 2 — Task Health (Ideal, ahead of schedule)

```
Task: "Write Unit Tests"
startDate : 2026-03-01
dueDate   : 2026-03-20
Hari ini  : 2026-03-13
Sub-task  : 8/10 selesai

expectedProgress = 63%
actualProgress   = 80%
gap              = 63 - 80 = -17% (ahead of schedule)

→  gap ≤ 20% → ON TRACK ✅
```

### Contoh 3 — Task Health (Fallback Simple, tidak ada startDate)

```
Task: "Deploy to Staging"
startDate : undefined
dueDate   : 2026-03-14   (besok)
Hari ini  : 2026-03-13
Sub-task  : 2/10 selesai

daysLeft  = 1 hari (≤ 3)
progress  = 20% (< 50%)

→  Fallback Simple: daysLeft ≤ 3 && progress < 50% → AT RISK ⚠️
```

### Contoh 4 — Epic Health

```
Epic: "E-Commerce Platform"
endDate : 2026-04-30   (masih > 1 bulan)
Status  : In Progress
Tasks   : 10 task

  Task 1  → On Track
  Task 2  → On Track
  Task 3  → On Track
  Task 4  → On Track
  Task 5  → On Track
  Task 6  → On Track
  Task 7  → At Risk
  Task 8  → At Risk
  Task 9  → At Risk
  Task 10 → Delayed

Delayed% = 1/10 × 100 = 10%  (< 20%  → tidak trigger Delayed)
AtRisk%  = 3/10 × 100 = 30%  (≥ 30%  → trigger At Risk)

→ EPIC: AT RISK ⚠️

Jika ada 3 task Delayed (30% ≥ 20%):
→ EPIC: DELAYED 🔴
```

---

## Integrasi ke UI

| File                                   | Fungsi yang dipakai              | Keterangan                                        |
| -------------------------------------- | -------------------------------- | ------------------------------------------------- |
| `app/goal/[goalId]/page.tsx`           | `getEpicHealth(epic, tasks)`     | Badge per epic di halaman detail goal             |
| `app/goals/page.tsx`                   | `getEpicHealth(epic, tasks)`     | Derive `GoalStatus` dari health epic yang di-link |
| `app/dashboard/page.tsx`               | `getEpicHealth(epic, epicTasks)` | EWS — daftar epic At Risk / Delayed               |
| `components/board/TaskCard.tsx`        | `getTaskHealth(task)`            | Badge health di setiap task card di board         |
| `contexts/NotificationContext.tsx`     | `isTaskOverdue()`                | Notifikasi push untuk task overdue                |
| `components/shared/TaskFilterSort.tsx` | `isTaskOverdue()`                | Filter "Overdue" di daftar task                   |

### Warna badge yang konsisten

| Health Status | Warna                                    |
| ------------- | ---------------------------------------- |
| **On Track**  | Hijau — `bg-green-100 text-green-700`    |
| **At Risk**   | Oranye — `bg-orange-100 text-orange-700` |
| **Delayed**   | Merah — `bg-red-100 text-red-700`        |

---

## Catatan Implementasi

### Timezone safety

Semua perbandingan tanggal menggunakan **string `"YYYY-MM-DD"`**, bukan `Date` object. Ini menghindari bug UTC di mana `new Date("2026-03-10")` di-parse sebagai `2026-03-09T17:00:00` di timezone UTC+7.

```ts
// ✅ Benar — string comparison, timezone-safe
dueDate < getTodayStr();

// ❌ Salah — UTC parsing bug
new Date(dueDate) < new Date();
```

### `startDate` dari PocketBase `created`

Task tidak memiliki field `start_date` di database. Sebagai gantinya, `startDate` di-derive dari field `created` (timestamp saat task dibuat):

```ts
// lib/pb-mappers.ts
startDate: r.created ? r.created.split(" ")[0] : undefined,
```

Asumsinya: task mulai dikerjakan sejak hari dibuat. Ini adalah approximation yang reasonable untuk kebanyakan kasus.

### Threshold yang bisa dikonfigurasi

Threshold 20% (Delayed) dan 30% (At Risk) di `getEpicHealth()` di-hardcode saat ini. Jika di masa depan butuh konfigurasi per-workspace, nilai ini bisa dipindah ke settings.
