# Struktur Project Tracker

Aplikasi **Project Tracker** — semacam Jira atau Trello, tapi buatan sendiri.

Dibangun dengan **Next.js** (framework website), **Tailwind CSS** (styling), dan **PocketBase** (database + backend).

---

## Struktur Folder Utama

```
project-tracker/
│
├── app/              ← HALAMAN-HALAMAN website
├── components/       ← KOMPONEN UI yang bisa dipakai ulang
├── contexts/         ← DATA GLOBAL yang dishare seluruh app
├── lib/              ← FUNGSI-FUNGSI HELPER & koneksi database
├── scripts/          ← Script untuk setup/migrasi database
├── tasks/            ← Dokumentasi task development (bukan fitur)
└── tests/            ← Pengujian otomatis
```

---

## Penjelasan Per Folder

### `app/` — Halaman Website

Setiap subfolder = satu halaman yang bisa dikunjungi:

| Folder | URL | Fungsi |
|---|---|---|
| `login/` | `/login` | Halaman masuk |
| `register/` | `/register` | Daftar akun baru |
| `dashboard/` | `/dashboard` | Halaman utama setelah login |
| `board/` | `/board` | Kanban board (seperti Trello) |
| `epics/` | `/epics` | Daftar epic (kumpulan proyek besar) |
| `epic/[epicId]/` | `/epic/123` | Detail satu epic |
| `task/[taskId]/` | `/task/456` | Detail satu task |
| `goals/` | `/goals` | Daftar tujuan/KPI |
| `my-work/` | `/my-work` | Task yang ditugaskan ke kamu |
| `workspace/` | `/workspace` | Manajemen anggota tim |
| `utilization/` | `/utilization` | Laporan beban kerja tim |
| `profile/` | `/profile` | Profil pengguna |

---

### `components/` — Komponen UI

Potongan-potongan UI yang dipakai di banyak tempat, dikelompokkan per fitur:

```
components/
├── layout/     ← Sidebar, navbar, notifikasi
├── dashboard/  ← Widget-widget di halaman dashboard
├── epic/       ← Form & card untuk epic
├── task/       ← Kartu/form task
├── board/      ← Kolom-kolom Kanban
├── goal/       ← Komponen untuk goals/KPI
├── search/     ← Command Palette (Cmd+K)
├── shared/     ← Komponen umum (tombol, modal, dll)
└── ai/         ← Fitur AI/chatbot
```

---

### `contexts/` — Data Global

Bayangkan ini seperti "gudang data" yang bisa diakses dari semua halaman:

| File | Fungsi |
|---|---|
| `AuthContext.tsx` | Menyimpan info user yang sedang login |
| `DataStore.tsx` | Semua data (epics, tasks, goals) + fungsi CRUD |
| `NotificationContext.tsx` | Notifikasi (overdue, assignment) |
| `ToastContext.tsx` | Pesan popup kecil (sukses/error) |

---

### `lib/` — Fungsi Helper

| File | Fungsi |
|---|---|
| `types.ts` | Definisi bentuk data (apa itu Epic, Task, User) |
| `pb-types.ts` | Tipe data dari PocketBase (database) |
| `pb-mappers.ts` | Konverter data dari database ke format app |
| `permissions.ts` | Aturan siapa boleh akses apa |
| `pocketbase.ts` | Koneksi ke database |
| `utils.ts` | Fungsi-fungsi kecil serba guna |

---

## Alur Sederhana

```
User buka halaman
       ↓
app/[halaman]/page.tsx   ← render halaman
       ↓
components/...           ← tampilkan UI
       ↓
contexts/DataStore.tsx   ← ambil/kirim data
       ↓
lib/pocketbase.ts        ← hubungi database (PocketBase)
       ↓
Database di server (http://43.156.27.136:8090)
```
