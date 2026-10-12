# News Monitor Otomatis (Versi HTML Statis - Opsi C)

Web app pemantau berita otomatis berbasis daftar kata kunci (*keywords*) yang mengelompokkan berita berdasarkan kejadian yang sama (kombinasi topik + lokasi) ke dalam satu daftar kronologis dari berbagai media nasional.

Sistem ini berjalan **100% tanpa server dan tanpa database** menggunakan:
- **GitHub Pages**: Menyajikan antarmuka web statis (`index.html`).
- **GitHub Actions**: Menjalankan scraper otomatis berkala (`scripts/scrape.mjs`) setiap 30 menit atau saat ada perubahan kata kunci.
- **Data JSON**: Disimpan langsung di dalam repositori (`data/keywords.json` dan `data/berita.json`).

---

## 📁 Struktur Repositori

```text
NewsMonitoring/
├── index.html                  # Antarmuka web statis utama (didukung Tailwind CSS & Lucide Icons)
├── data/
│   ├── keywords.json           # Sumber kebenaran daftar kata kunci & pengaturan
│   ├── wilayah.json            # Kamus 38 provinsi & wilayah kabupaten/kota di Indonesia
│   └── berita.json             # Hasil scraping, deduplikasi, dan pengelompokan berita
├── scripts/
│   └── scrape.mjs              # Engine scraper Google News RSS, ekstraksi lokasi, auto-expansion, Jaccard grouping
├── .github/
│   └── workflows/
│       └── scrape.yml          # Otomasi GitHub Actions (cron tiap 30m, push, & workflow_dispatch)
├── package.json                # Dependensi scraper (Node.js 20 & fast-xml-parser)
└── README.md                   # Dokumentasi panduan instalasi dan penggunaan
```

---

## 🚀 Fitur Utama

1. **Pengelompokan Berita Cerdas (Event Grouping)**:
   - Mengekstrak lokasi kejadian dari judul berita (misal: *"Kebakaran hutan di Papua Barat"* vs *"Kebakaran hutan di Kalimalang"*).
   - Melakukan *Auto-Expansion* (Pencarian Level 2) khusus untuk tiap entitas kejadian unik untuk melengkapi liputan dari berbagai media.
   - Mengelompokkan berita tanpa lokasi ke kejadian yang relevan menggunakan algoritma kemiripan token **Jaccard Similarity** (ambang batas $\ge 0.5$).
   - Berita umum yang tidak merujuk ke kejadian spesifik dikelompokkan ke kategori **Umum & Terkait**.

2. **Deduplikasi Otomatis**:
   - Berita dengan tautan sama atau kemiripan judul di atas 0.85 digabung menjadi satu entri.
   - Nama media peliput digabungkan sehingga terlihat media mana saja yang memberitakan kejadian serupa.

3. **Manajemen Kata Kunci (CRUD)**:
   - Tambah kata kunci baru beserta kata sinonimnya (misal: *"kebakaran hutan"* dengan sinonim *"karhutla"*, *"hutan terbakar"*).
   - Validasi: maksimal 60 karakter, tidak duplikat, maksimal 20 kata kunci aktif.
   - Toggle aktif/nonaktif dan hapus kata kunci.
   - **Mode Admin di UI**: Kelola kata kunci langsung dari browser menggunakan GitHub Personal Access Token (PAT) tanpa perlu edit file manual.
   - **Ekspor & Impor**: Salin dan backup konfigurasi kata kunci dalam format file `.json`.

4. **Tampilan Modern & Responsif**:
   - Glassmorphism UI dengan dukungan **Mode Gelap (Dark Mode)** dan **Mode Terang (Light Mode)**.
   - Penanda **"BARU"** (lampu indikator hijau berkedip) untuk berita yang belum pernah dibuka oleh pengguna di browser.
   - Pengurutan grup berdasarkan waktu berita terbaru atau jumlah berita terbanyak.
   - Toggle urutan berita di dalam grup: **Terbaru Dulu** vs **Kronologis (Terlama Dulu)**.
   - Filter instan per kata kunci, jendela waktu (1 hari, 3 hari, 7 hari), dan pencarian judul teks secara *real-time*.
   - Pembaruan otomatis (*polling ringan*) setiap 5 menit saat tab browser terbuka.

---

## 🛠️ Menjalankan di Komputer Lokal

1. **Instal dependensi:**
   ```bash
   npm install
   ```

2. **Jalankan scraping berita:**
   ```bash
   node scripts/scrape.mjs
   ```
   Scraper akan mengambil Google News RSS, memproses pengelompokan kejadian, dan menyimpan hasilnya ke `data/berita.json`.

3. **Buka antarmuka web:**
   - Anda cukup membuka file `index.html` langsung di browser, atau menggunakan live server lokal (misalnya ekstensi *Live Server* di VS Code atau `npx serve .`).

---

## 🌐 Panduan Deployment ke GitHub Pages

1. **Push repositori ini ke akun GitHub Anda**:
   ```bash
   git init
   git add .
   git commit -m "Inisialisasi News Monitor Otomatis"
   git remote add origin https://github.com/<USERNAME>/<REPO_NAME>.git
   git branch -M main
   git push -u origin main
   ```

2. **Aktifkan GitHub Pages**:
   - Buka repositori di GitHub.
   - Masuk ke tab **Settings** -> **Pages**.
   - Pada bagian **Build and deployment**, pilih:
     - **Source**: `Deploy from a branch`
     - **Branch**: `main` / `(root)`
   - Klik **Save**. Halaman web Anda akan aktif di: `https://<USERNAME>.github.io/<REPO_NAME>/`.

3. **Pastikan Izin GitHub Actions Aktif**:
   - Masuk ke tab **Settings** -> **Actions** -> **General**.
   - Di bagian **Workflow permissions**, pilih **Read and write permissions** agar workflow dapat melakukan commit hasil scraping ke `data/berita.json`.
   - Klik **Save**.

---

## 🔐 Cara Menggunakan Mode Admin di Web

Untuk menambah atau mengedit kata kunci langsung dari tampilan web:
1. Buat **Personal Access Token (Fine-grained)** di GitHub (`Settings` -> `Developer Settings` -> `Personal access tokens`).
2. Berikan izin spesifik untuk repositori ini:
   - **Repository permissions**:
     - `Contents`: Read and write (untuk memperbarui `data/keywords.json`)
     - `Actions`: Read and write (untuk memicu workflow scraping seketika)
3. Di web app, klik tombol **Mode Admin**.
4. Masukkan nama repositori (`username/repo`) dan token GitHub Anda.
5. Token hanya disimpan di memori browser Anda (`localStorage`) dan tidak pernah dikirim ke pihak luar atau disimpan di repositori publik.
