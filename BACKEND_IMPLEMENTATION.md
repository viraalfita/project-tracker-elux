# Backend Implementation Documentation

> Tanggal: 4 Maret 2026  
> Stack: [Next.js](https://nextjs.org/) + [PocketBase](https://pocketbase.io/) (self-hosted)

---

## Daftar Isi

1. [Arsitektur Umum](#1-arsitektur-umum)
2. [PocketBase sebagai Backend](#2-pocketbase-sebagai-backend)
3. [Skema Database (Collections)](#3-skema-database-collections)
4. [Autentikasi](#4-autentikasi)
5. [Lapisan Data (Data Layer)](#5-lapisan-data-data-layer)
6. [API Routes (Next.js)](#6-api-routes-nextjs)
7. [Sistem Izin (RBAC & Permissions)](#7-sistem-izin-rbac--permissions)
8. [Middleware](#8-middleware)
9. [DataStore Context](#9-datastore-context)
10. [Script Setup & Seeding](#10-script-setup--seeding)
11. [Variabel Lingkungan](#11-variabel-lingkungan)

---

## 1. Arsitektur Umum

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Client)                      │
│                                                             │
│   React Components  →  DataStore Context  →  PocketBase SDK │
│   AuthContext       →  pb.authStore                         │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP / WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js App (App Router)                        │
│                                                             │
│   /api/admin/users  →  PocketBase (as superuser)            │
│   middleware.ts     →  Route guard (best-effort)            │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP
                             ▼
┌─────────────────────────────────────────────────────────────┐
│         PocketBase v0.36.5  (self-hosted)                    │
│         https://pb.eluxemang.top                           │
│                                                             │
│   Collections: users, epics, tasks, subtasks,               │
│                comments, epic_docs, goals, goal_kpis         │
└─────────────────────────────────────────────────────────────┘
```

Aplikasi ini menggunakan **PocketBase** sebagai _Backend-as-a-Service_ (BaaS). Semua operasi data (CRUD) dilakukan langsung dari klien melalui PocketBase JavaScript SDK, kecuali manajemen user yang membutuhkan akses superuser dan diproksikan melalui Next.js API Route.

---

## 2. PocketBase sebagai Backend

### Konfigurasi Klien

File: [lib/pocketbase.ts](lib/pocketbase.ts)

```typescript
import PocketBase from "pocketbase";

const PB_URL =
  process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "https://pb.eluxemang.top";

export const pb = new PocketBase(PB_URL);

// Mencegah React concurrent mode membatalkan request paralel yang sedang berjalan
pb.autoCancellation(false);
```

Instance `pb` ini digunakan di seluruh aplikasi — baik di `DataStore`, `AuthContext`, maupun API routes sisi server.

---

## 3. Skema Database (Collections)

### 3.1 `users` (Auth Collection)

Collection bawaan PocketBase yang diperluas dengan field kustom.

| Field            | Tipe     | Keterangan                                   |
| ---------------- | -------- | -------------------------------------------- |
| `email`          | email    | Wajib, unik (PB built-in)                    |
| `password`       | password | Hash (PB built-in)                           |
| `name`           | text     | Nama lengkap                                 |
| `initials`       | text     | Inisial untuk avatar (e.g. "AP")             |
| `avatarColor`    | text     | Hex color untuk avatar                       |
| `role`           | select   | `Admin` \| `Manager` \| `Member` \| `Viewer` |
| `weeklyCapacity` | number   | Kapasitas kerja per minggu (jam, default 40) |

**Access Rules:**

- `listRule` / `viewRule`: `@request.auth.id != ""` (user terautentikasi)
- `createRule` / `updateRule` / `deleteRule`: `null` (superuser only)

---

### 3.2 `epics`

| Field         | Tipe     | Keterangan                                            |
| ------------- | -------- | ----------------------------------------------------- |
| `title`       | text     | Judul epic                                            |
| `description` | text     | Deskripsi lengkap                                     |
| `status`      | select   | `Not Started` \| `In Progress` \| `Done` \| `On Hold` |
| `start_date`  | date     | Tanggal mulai (opsional)                              |
| `end_date`    | date     | Tanggal selesai (opsional)                            |
| `owner`       | relation | → `users` (maxSelect: 1)                              |
| `watchers`    | relation | → `users` (multi-select)                              |

---

### 3.3 `tasks`

| Field         | Tipe     | Keterangan                                     |
| ------------- | -------- | ---------------------------------------------- |
| `title`       | text     | Judul task                                     |
| `description` | text     | Deskripsi task                                 |
| `status`      | select   | `To Do` \| `In Progress` \| `Review` \| `Done` |
| `priority`    | select   | `Low` \| `Medium` \| `High`                    |
| `due_date`    | date     | Tanggal jatuh tempo                            |
| `estimate`    | number   | Estimasi jam kerja                             |
| `epic`        | relation | → `epics` (parent epic)                        |
| `owner`       | relation | → `users` (maxSelect: 1)                       |
| `assignee`    | relation | → `users` (maxSelect: 1)                       |
| `watchers`    | relation | → `users` (multi-select)                       |

---

### 3.4 `subtasks`

| Field      | Tipe     | Keterangan                         |
| ---------- | -------- | ---------------------------------- |
| `title`    | text     | Judul subtask                      |
| `done`     | bool     | Status selesai                     |
| `due_date` | date     | Tanggal jatuh tempo (opsional)     |
| `status`   | select   | Status opsional (TaskStatus)       |
| `task`     | relation | → `tasks` (parent task)            |
| `assignee` | relation | → `users` (maxSelect: 1, opsional) |

---

### 3.5 `comments`

| Field      | Tipe     | Keterangan                         |
| ---------- | -------- | ---------------------------------- |
| `text`     | text     | Isi komentar                       |
| `task`     | relation | → `tasks`                          |
| `author`   | relation | → `users`                          |
| `mentions` | relation | → `users` (multi-select, opsional) |

---

### 3.6 `epic_docs`

| Field        | Tipe     | Keterangan                       |
| ------------ | -------- | -------------------------------- |
| `title`      | text     | Judul dokumen                    |
| `content`    | text     | Konten (mendukung Markdown/rich) |
| `epic`       | relation | → `epics`                        |
| `created_by` | relation | → `users`                        |

---

### 3.7 `goals`

| Field          | Tipe     | Keterangan               |
| -------------- | -------- | ------------------------ |
| `title`        | text     | Judul goal               |
| `description`  | text     | Deskripsi goal           |
| `owner`        | relation | → `users`                |
| `linked_epics` | relation | → `epics` (multi-select) |

---

### 3.8 `goal_kpis`

| Field              | Tipe     | Keterangan                            |
| ------------------ | -------- | ------------------------------------- |
| `label`            | text     | Label KPI                             |
| `target`           | number   | Nilai target                          |
| `current`          | number   | Nilai saat ini                        |
| `unit`             | text     | Satuan (e.g. "tasks", "s", "reports") |
| `green_threshold`  | number   | Persen target → status "On Track"     |
| `yellow_threshold` | number   | Persen target → status "At Risk"      |
| `goal`             | relation | → `goals`                             |

---

## 4. Autentikasi

File: [contexts/AuthContext.tsx](contexts/AuthContext.tsx)

Autentikasi menggunakan sistem auth bawaan PocketBase.

### Flow Login

```
User input email + password
        ↓
pb.collection("users").authWithPassword(email, password)
        ↓
PocketBase → JWT token tersimpan di pb.authStore (localStorage)
        ↓
currentUser di-set ke state React
        ↓
DataStore trigger reload data (via authTrigger)
```

### Session Restoration

Saat halaman dimuat ulang, token dibaca dari `localStorage` secara otomatis oleh PocketBase SDK, lalu divalidasi ke server:

```typescript
// Restore dari localStorage
if (pb.authStore.isValid && pb.authStore.model) {
  setCurrentUser(mapUser(pb.authStore.model as PBUser));
}

// Validasi token ke server & refresh data user
pb.collection("users")
  .authRefresh()
  .then((data) => {
    setCurrentUser(mapUser(data.record as PBUser));
  })
  .catch(() => {
    pb.authStore.clear(); // Token expired — logout
    setCurrentUser(null);
  });
```

### Logout

```typescript
pb.authStore.clear(); // Hapus token dari localStorage
setCurrentUser(null);
```

---

## 5. Lapisan Data (Data Layer)

### 5.1 PB Types (`lib/pb-types.ts`)

Mendefinisikan interface TypeScript yang pemetaan 1:1 dengan response PocketBase. Setiap interface extends `RecordModel` dari PocketBase SDK.

```typescript
interface PBUser extends RecordModel {
  name: string;
  email: string;
  initials: string;
  avatarColor: string;
  role: "Admin" | "Manager" | "Member" | "Viewer";
  weeklyCapacity: number;
}

interface PBEpic extends RecordModel {
  title: string;
  status: string;
  owner: string; // ID relasi
  watchers: string | string[]; // PB dapat mengembalikan string atau string[]
  expand?: {
    owner?: PBUser;
    watchers?: PBUser | PBUser[];
  };
}
// dst...
```

**Perhatian:** PocketBase mengembalikan relation field dengan `maxSelect=1` sebagai `string`, dan `maxSelect>1` sebagai `string[]`. Semua mapper menangani kedua kasus ini.

---

### 5.2 Mappers (`lib/pb-mappers.ts`)

Mengonversi raw PocketBase records ke tipe domain aplikasi.

**Helper utama:**

```typescript
// Normalisasi string | string[] → string[]
function ensureArray<T>(val: T | T[] | null | undefined): T[] {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

// Normalisasi datetime PB ("YYYY-MM-DD HH:MM:SS.mmmZ") → ISO 8601
function pbDate(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(" ", "T");
}
```

**Tabel mapper:**

| Fungsi       | Input                          | Output    |
| ------------ | ------------------------------ | --------- |
| `mapUser`    | `PBUser`                       | `User`    |
| `mapEpic`    | `PBEpic`                       | `Epic`    |
| `mapTask`    | `PBTask` + subtasks + comments | `Task`    |
| `mapSubtask` | `PBSubtask`                    | `Subtask` |
| `mapComment` | `PBComment`                    | `Comment` |
| `mapEpicDoc` | `PBEpicDoc`                    | `EpicDoc` |
| `mapGoal`    | `PBGoal` + kpis                | `Goal`    |
| `mapGoalKpi` | `PBGoalKpi`                    | `GoalKpi` |

---

### 5.3 App Types (`lib/types.ts`)

Definisi tipe domain yang digunakan di seluruh aplikasi:

```typescript
type TaskStatus = "To Do" | "In Progress" | "Review" | "Done";
type Priority = "Low" | "Medium" | "High";
type EpicStatus = "Not Started" | "In Progress" | "Done" | "On Hold";
type Role = "Admin" | "Manager" | "Member" | "Viewer";

interface User {
  id;
  name;
  email;
  initials;
  avatarColor;
  role;
  weeklyCapacity;
}
interface Epic {
  id;
  title;
  description;
  owner;
  watchers;
  status;
  startDate?;
  endDate?;
}
interface Task {
  id;
  epicId;
  title;
  description;
  owner?;
  assignee;
  watchers;
  status;
  priority;
  dueDate;
  estimate?;
  subtasks;
  comments;
}
interface Subtask {
  id;
  taskId;
  title;
  done;
  assignee?;
  dueDate?;
  status?;
}
interface Comment {
  id;
  taskId;
  author;
  text;
  createdAt;
  mentions?;
}
interface EpicDoc {
  id;
  epicId;
  title;
  content;
  createdBy;
  createdAt;
  updatedAt;
}
interface Goal {
  id;
  title;
  description;
  owner;
  kpis;
  linkedEpicIds;
}
interface GoalKpi {
  id;
  label;
  target;
  current;
  unit;
  greenThreshold;
  yellowThreshold;
}
```

---

## 6. API Routes (Next.js)

### `POST /api/admin/users` — Buat User Baru

File: [app/api/admin/users/route.ts](app/api/admin/users/route.ts)

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "initials": "JD",
  "avatarColor": "#6366f1",
  "role": "Member",
  "weeklyCapacity": 40
}
```

**Response:** Record user yang baru dibuat (200) atau error (400/403).

---

### `PATCH /api/admin/users` — Update Role User

**Request Body:**

```json
{
  "userId": "abc123",
  "role": "Manager"
}
```

**Response:** Record user yang diperbarui (200) atau error (400/403).

---

### `DELETE /api/admin/users` — Hapus User

**Request Body:**

```json
{
  "userId": "abc123"
}
```

**Response:** `{ "success": true }` (200) atau error (400/403).

---

### Mekanisme Keamanan API Routes

Semua endpoint `/api/admin/users` memerlukan:

1. **Bearer token** pada header `Authorization`.
2. Token tersebut harus milik user dengan `role === "Admin"` (diverifikasi lewat `pb.collection("users").authRefresh()`).
3. Operasi dijalankan menggunakan klien PocketBase yang terotentikasi sebagai **superuser** (menggunakan `PB_ADMIN_EMAIL` dan `PB_ADMIN_PASSWORD` dari environment variable sisi server).

```
                   Admin User
                       │
          Authorization: Bearer <token>
                       ↓
           /api/admin/users (Next.js)
                       │
           verifyAdminToken(token) → PocketBase
                       │
             role === "Admin" ?
              Yes ↓          No → 403 Forbidden
                       │
           getSuperuserClient()
            PB_ADMIN_EMAIL + PB_ADMIN_PASSWORD
                       ↓
             PocketBase _superusers
```

---

## 7. Sistem Izin (RBAC & Permissions)

File: [lib/permissions.ts](lib/permissions.ts)

### Model Akses

Akses ke epic dan task **tidak didasarkan pada role** (Admin/Manager/Member/Viewer), melainkan pada **kepemilikan dan keanggotaan watcher**:

| Kondisi                     | Akses                            |
| --------------------------- | -------------------------------- |
| `user.role === "Admin"`     | Akses penuh ke semua epic & task |
| `user.id === epic.owner.id` | Akses penuh ke epic tersebut     |
| `user.id ∈ epic.watchers`   | Akses penuh ke epic tersebut     |
| Lainnya                     | Tidak ada akses                  |

### Helper Functions

```typescript
isAdmin(user); // Cek role Admin
isEpicMember(user, epic); // Cek apakah user adalah owner/watcher/Admin
canViewEpic(user, epic); // Dapat melihat epic
canManageEpics(user); // Dapat membuat epic baru (semua user terautentikasi)
canCreate(user, epic); // Dapat membuat task/subtask dalam epic
canEdit(user, epic); // Dapat mengedit task/subtask
canDelete(user, epic, resourceAuthorId); // Dapat menghapus (hanya own resource atau Admin)
canUpdateStatus(user, epic); // Dapat update status
canAssignTask(user, epic); // Dapat assign task ke user lain
canComment(user, epic); // Dapat post komentar
canManageWatchers(user, epic); // Dapat tambah/hapus watcher (hanya owner & Admin)
canManageGoalLinks(user); // Dapat link/unlink epic ke goal (semua user)
getAssignableUsers(user, epic, allUsers); // Daftar user yang dapat di-assign
getEpicAllowedUserIds(epic); // Set ID user yang boleh akses epic
isUserInvolvedInEpic(epic, userId); // Cek apakah user terlibat dalam epic
```

### Penggunaan di Komponen

Permission helpers digunakan untuk:

- **Menyembunyikan/menonaktifkan UI** (tombol tambah, edit, hapus)
- **Guard halaman** (misalnya Epic Detail page — jika tidak ada akses → `notFound()`)

```typescript
// Contoh di EpicPage
if (
  currentUser?.role !== "Admin" &&
  (!currentUser || !isUserInvolvedInEpic(epic, currentUser.id))
) {
  notFound(); // 404 untuk akses tidak sah
}
```

---

## 8. Middleware

File: [middleware.ts](middleware.ts)

```typescript
const PUBLIC_PATHS = ["/login", "/_next", "/favicon.ico", "/api"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Path publik — lewatkan tanpa pengecekan
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Pengecekan cookie pb_auth (best-effort — token ada di localStorage, bukan cookie)
  const pbAuth = req.cookies.get("pb_auth");
  if (!pbAuth?.value) {
    // Guard utama ada di AppShell (client-side)
    return NextResponse.next();
  }

  return NextResponse.next();
}
```

**Catatan:** Auth guard utama adalah **client-side** di `AppShell` (menggunakan `pb.authStore`). Middleware hanya berfungsi sebagai proteksi tambahan berbasis cookie.

---

## 9. DataStore Context

File: [contexts/DataStore.tsx](contexts/DataStore.tsx)

Satu-satunya sumber kebenaran (single source of truth) untuk semua data aplikasi. Melakukan:

1. **Fetch awal** dari PocketBase saat login.
2. **Optimistic update**: state React diperbarui dulu, lalu request ke PocketBase dilakukan di background (fire-and-forget).

### Data Flow Inisialisasi

```
authStore.onChange → authTrigger++
        ↓
useEffect (DataStore) → load()
        ↓
Promise.all([
  pb.collection("users").getFullList(),
  pb.collection("epics").getFullList({ expand: "owner,watchers" }),
  pb.collection("tasks").getFullList({ expand: "owner,assignee,watchers" }),
  pb.collection("goals").getFullList({ expand: "owner,linked_epics" }),
  pb.collection("goal_kpis").getFullList(),
  pb.collection("subtasks").getFullList({ expand: "assignee" }),
  pb.collection("comments").getFullList({ expand: "author,mentions" }),
  pb.collection("epic_docs").getFullList({ expand: "created_by" }),
])
        ↓
mappers (pb-mappers.ts) → domain types
        ↓
setState (goals, epics, tasks, users, epicDocs)
```

### Operasi CRUD yang Tersedia

| Kategori     | Operasi                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| **Goals**    | `addGoalKpi`, `updateGoalKpi`, `deleteGoalKpi`, `updateGoalLinkedEpics` |
| **Epics**    | `createEpic`, `updateEpic`, `updateEpicWatchers`, `deleteEpic`          |
| **Tasks**    | `createTask`, `updateTask`, `updateTaskWatchers`, `deleteTask`          |
| **Subtasks** | `createSubtask`, `deleteSubtask`, `toggleSubtask`                       |
| **Comments** | `addComment`, `deleteComment`                                           |
| **EpicDocs** | `createEpicDoc`, `updateEpicDoc`, `deleteEpicDoc`                       |
| **Users**    | `refreshUsers`                                                          |

### Contoh Pola Optimistic Update

```typescript
// createEpic — update state dulu, sinkron ke PB belakangan
const createEpic = useCallback((data) => {
  const tempEpic = { id: `epic-${Date.now()}`, ...data };
  setEpics((prev) => [...prev, tempEpic]); // Optimistic

  pb.collection("epics")
    .create({
      // Sync ke PocketBase
      title: data.title,
      status: data.status,
      // ...
    })
    .then((record) => {
      setEpics((prev) =>
        prev.map((e) => (e.id === tempEpic.id ? { ...e, id: record.id } : e)),
      );
    });
}, []);
```

---

## 10. Script Setup & Seeding

File: [scripts/setup-pocketbase.ts](scripts/setup-pocketbase.ts)

Script otomatis untuk inisialisasi PocketBase dari awal. Dijalankan **sekali** saat setup.

### Cara Menjalankan

```bash
PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=yourpassword npx tsx scripts/setup-pocketbase.ts
# atau via npm script:
npm run pb:setup
```

### Langkah-Langkah yang Dilakukan

| Step | Keterangan                                           |
| ---- | ---------------------------------------------------- |
| 1    | Autentikasi sebagai superuser PocketBase             |
| 2    | Extend `users` collection dengan field kustom        |
| 3    | Buat semua collection (epics, tasks, subtasks, dll.) |
| 3b   | Terapkan access rules pada setiap collection         |
| 3c   | Patch multi-relation `maxSelect` field               |
| 4    | Seed users (dari `lib/mock.ts`)                      |
| 5    | Seed epics                                           |
| 6    | Seed tasks + subtasks + comments                     |
| 7    | Seed goals + KPIs                                    |
| 8    | Seed epic docs                                       |

**Password default user seed:** `devPassword123!`

Script aman untuk dijalankan ulang — record yang sudah ada akan dilewati.

---

## 11. Environtment Variabel

Buat file `.env.local` di root project:

```env
# URL PocketBase (wajib — digunakan di client & server)
NEXT_PUBLIC_POCKETBASE_URL=https://pb.eluxemang.top

# Kredensial superuser PocketBase (hanya untuk server-side & setup script)
PB_ADMIN_EMAIL=admin@example.com
PB_ADMIN_PASSWORD=yourpassword
```

| Variable                     | Scope         | Keterangan                                                           |
| ---------------------------- | ------------- | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_POCKETBASE_URL` | Client+Server | URL PocketBase instance (prefix `NEXT_PUBLIC_` = exposed ke browser) |
| `PB_ADMIN_EMAIL`             | Server only   | Email superuser PocketBase (untuk API routes & setup script)         |
| `PB_ADMIN_PASSWORD`          | Server only   | Password superuser PocketBase                                        |

> **Keamanan:** `PB_ADMIN_EMAIL` dan `PB_ADMIN_PASSWORD` **tidak boleh** diberi prefix `NEXT_PUBLIC_` karena akan terekspos ke browser.

---

## Ringkasan Alur Data

```
PocketBase (Database)
    │
    │  SDK (pocketbase npm)
    ▼
lib/pb-types.ts     ← Tipe raw dari PocketBase (PBUser, PBEpic, dll.)
    │
    │  Transformasi via mappers
    ▼
lib/pb-mappers.ts   ← Konversi ke tipe domain (User, Epic, dll.)
    │
    ▼
lib/types.ts        ← Tipe domain aplikasi
    │
    ▼
contexts/DataStore.tsx  ← State management & CRUD operations
    │
    ▼
React Components    ← UI berdasarkan data dari DataStore & AuthContext
```
