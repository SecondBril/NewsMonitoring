import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const KEYWORDS_FILE = path.join(DATA_DIR, 'keywords.json');
const WILAYAH_FILE = path.join(DATA_DIR, 'wilayah.json');
const BERITA_FILE = path.join(DATA_DIR, 'berita.json');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

// Common Indonesian stopwords
const STOPWORDS = new Set([
  'yang', 'untuk', 'pada', 'ke', 'para', 'namun', 'menurut', 'antara', 'dia', 'dua',
  'ia', 'seperti', 'jika', 'sehingga', 'kembali', 'dan', 'ini', 'karena', 'oleh',
  'saat', 'harus', 'itu', 'keadaan', 'secara', 'pun', 'ada', 'adalah', 'adanya',
  'agar', 'akan', 'aku', 'anda', 'antara', 'apa', 'apabila', 'apakah', 'apalagi',
  'atas', 'atau', 'bahkan', 'bahwa', 'banyak', 'bapak', 'beberapa', 'belum', 'berada',
  'berikut', 'bisa', 'boleh', 'buat', 'bukan', 'cukup', 'dalam', 'dapat', 'dari',
  'dekat', 'dengan', 'depan', 'di', 'diri', 'dulu', 'empat', 'hingga', 'ia', 'ingin',
  'jadi', 'jangan', 'jauh', 'jika', 'juga', 'kalau', 'kami', 'kamu', 'kapan', 'kata',
  'katanya', 'ke', 'keduanya', 'keluar', 'kembali', 'kemudian', 'kenapa', 'kini',
  'kira', 'kita', 'kurang', 'lagi', 'lain', 'lalu', 'lama', 'langsung', 'lebih',
  'lewat', 'luar', 'macam', 'maka', 'malah', 'mampu', 'mana', 'masih', 'masing',
  'mata', 'mau', 'maupun', 'melalui', 'memang', 'mengapa', 'mereka', 'merupakan',
  'meski', 'meskipun', 'mulai', 'naik', 'namun', 'nanti', 'nyata', 'oleh', 'orang',
  'pada', 'padahal', 'paling', 'pasti', 'per', 'pernah', 'pula', 'pun', 'rasa',
  'saat', 'saja', 'sama', 'sampai', 'sana', 'sangat', 'saya', 'sebab', 'sebagai',
  'sebagian', 'sebaik', 'sebaliknya', 'sebanyak', 'sebelum', 'sebenarnya', 'sebuah',
  'secara', 'sedang', 'sedangkan', 'sedikit', 'segala', 'segera', 'sehingga', 'sejak',
  'sekali', 'sekalian', 'sekalipun', 'sekarang', 'sekitar', 'selain', 'selalu',
  'selama', 'seluruh', 'semacam', 'semakin', 'sementara', 'sempat', 'semua', 'semula',
  'sendiri', 'seolah', 'seorang', 'sepanjang', 'seperti', 'sering', 'serta', 'serupa',
  'sesaat', 'sesuatu', 'sesudah', 'setelah', 'setiap', 'siapa', 'sini', 'situ',
  'suatu', 'sudah', 'supaya', 'tahu', 'tahun', 'tak', 'tanpa', 'tapi', 'telah',
  'tentang', 'tentu', 'tempat', 'tengah', 'terhadap', 'termasuk', 'tersebut', 'terus',
  'tetap', 'tetapi', 'tiap', 'tidak', 'tindakan', 'turun', 'ulang', 'untuk', 'usai',
  'waduh', 'wah', 'wahai', 'yaitu', 'yakni', 'yang'
]);

/**
 * Tokenize string into lowercase set of clean words without stopwords
 */
function tokenize(text) {
  if (!text) return new Set();
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
  return new Set(words);
}

/**
 * Calculate Jaccard Similarity between two texts: |A ∩ B| / |A ∪ B|
 */
function calculateJaccardSimilarity(textA, textB) {
  const setA = tokenize(textA);
  const setB = tokenize(textB);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Fetch Google News RSS with timeout
 */
async function fetchGoogleNewsRss(query, windowDays = 7) {
  const fullQuery = `${query} when:${windowDays}d`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(fullQuery)}&hl=id&gl=ID&ceid=ID:id`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });

    if (!res.ok) {
      console.warn(`[Scraper] RSS returned status ${res.status} for query: ${query}`);
      return [];
    }

    const xmlText = await res.text();
    const parsed = xmlParser.parse(xmlText);
    const items = parsed?.rss?.channel?.item;
    if (!items) return [];
    return Array.isArray(items) ? items : [items];
  } catch (err) {
    console.warn(`[Scraper] Fetch error for query "${query}":`, err.message);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Clean RSS item
 */
function cleanItem(raw) {
  let title = (raw.title || '').trim();
  let source = '';

  if (typeof raw.source === 'string') {
    source = raw.source.trim();
  } else if (raw.source && typeof raw.source === 'object' && raw.source['#text']) {
    source = raw.source['#text'].trim();
  }

  // Strip trailing " - Media Name" from Google News title
  const hyphenIdx = title.lastIndexOf(' - ');
  if (hyphenIdx > 0) {
    const trailingSource = title.slice(hyphenIdx + 3).trim();
    if (!source) source = trailingSource;
    title = title.slice(0, hyphenIdx).trim();
  }

  if (!source) source = 'Media Nasional';

  const link = (raw.link || (typeof raw.guid === 'string' ? raw.guid : '')).trim();

  let publishedAt = new Date().toISOString();
  if (raw.pubDate) {
    const parsedDate = new Date(raw.pubDate);
    if (!isNaN(parsedDate.getTime())) {
      publishedAt = parsedDate.toISOString();
    }
  }

  return { title, source, link, publishedAt };
}

/**
 * Normalize location string to clean group key
 * e.g. "Papua Barat" -> "papua-barat"
 */
function normalizeLocationKey(location) {
  if (!location) return 'umum';
  return location
    .toLowerCase()
    .replace(/^(di|ke|dari|kawasan|wilayah|area|seputar|kota|kabupaten|kab\.|kecamatan|provinsi)\s+/gi, '')
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Location Extractor Engine using data/wilayah.json + Regex
 */
function buildLocationExtractor(wilayahData) {
  const allLocationsMap = new Map();

  if (wilayahData?.provinces) {
    for (const [k, v] of Object.entries(wilayahData.provinces)) {
      allLocationsMap.set(k.toLowerCase(), v);
    }
  }
  if (wilayahData?.regions) {
    for (const [k, v] of Object.entries(wilayahData.regions)) {
      allLocationsMap.set(k.toLowerCase(), v);
    }
  }

  const sortedKeys = Array.from(allLocationsMap.keys()).sort((a, b) => b.length - a.length);

  return function extractLocation(title) {
    if (!title) return null;
    const lowerTitle = title.toLowerCase();

    // 1. Direct dictionary match against wilayah list
    for (const locKey of sortedKeys) {
      if (['batu', 'karo', 'asahan', 'bone'].includes(locKey)) {
        const strictReg = new RegExp(`\\b(?:di|ke|dari|kota|kabupaten|kab\\.)\\s+${locKey}\\b`, 'i');
        if (strictReg.test(title)) return allLocationsMap.get(locKey) || locKey;
        continue;
      }

      const reg = new RegExp(`\\b${locKey}\\b`, 'i');
      if (reg.test(lowerTitle)) {
        return allLocationsMap.get(locKey) || locKey;
      }
    }

    // 2. Preposition Regex: "di / kawasan / wilayah <Nama Lokasi>"
    const prepRegex = /\b(?:di|kawasan|wilayah|area|seputar)\s+([A-Z][a-zA-Z0-9\s'-]+?)(?:,|\.|\s+-|\s+--|\s+–|\s+\||:|\?|!|\b(?:yang|saat|akibat|usai|karena|hingga|dan|dengan|pada|belum|sudah|kembali|mulai|ludes|hangus)\b|$)/;
    const match = title.match(prepRegex);
    if (match && match[1]) {
      let cand = match[1].trim().replace(/[,;:.!?\-–|]+$/g, '').trim();
      cand = cand.replace(/^(di|ke|dari|kawasan|wilayah|area|seputar|daerah)\s+/gi, '').trim();
      const candLower = cand.toLowerCase();

      const isGeneric = /^(lahan|hutan|gedung|rumah|pabrik|kantor|pasar|jalan|gang|ruang|toko|gudang|ruko|posko|titik|tempat|area|lokasi|kawasan rawan|lahan rawan|kebun)\b/i.test(candLower);
      if (
        cand.length >= 3 &&
        cand.length <= 40 &&
        !isGeneric &&
        !['hari ini', 'pagi ini', 'siang ini', 'malam ini', 'sore ini', 'tadi pagi', 'pekan ini', 'bulan ini', 'tahun ini', 'saat ini', 'indonesia', 'dunia'].includes(candLower)
      ) {
        if (allLocationsMap.has(candLower)) return allLocationsMap.get(candLower);
        return cand.charAt(0).toUpperCase() + cand.slice(1);
      }
    }

    // 3. Administrative Prefix Pattern: "Kabupaten X", "Kota Y"
    const adminRegex = /\b(?:Kabupaten|Kota|Kecamatan|Kec\.|Kab\.)\s+([A-Z][a-zA-Z\s]+?)(?:,|\.|\s+-|\s+–|\s+\||:|\?|!|\b(?:yang|saat|akibat|usai|karena|dan)\b|$)/;
    const adminMatch = title.match(adminRegex);
    if (adminMatch && adminMatch[1]) {
      const cand = adminMatch[1].trim().replace(/[,;:.!?\-–|]+$/g, '').trim();
      if (cand.length >= 3 && cand.length <= 35) {
        const candLower = cand.toLowerCase();
        if (allLocationsMap.has(candLower)) return allLocationsMap.get(candLower);
        return cand;
      }
    }

    return null;
  };
}

/**
 * Main Scrape Function
 */
async function main() {
  console.log('[Scraper] Starting News Monitor scraping cycle...');
  const startTime = Date.now();

  // 1. Read keywords.json
  let config;
  try {
    const raw = await fs.readFile(KEYWORDS_FILE, 'utf-8');
    config = JSON.parse(raw);
  } catch (err) {
    console.error('[Scraper] Failed to read keywords.json:', err.message);
    process.exit(1);
  }

  const windowDays = config.settings?.windowDays || 7;
  const maxDerived = config.settings?.maxDerivedPerKeyword || 8;
  const keywords = (config.keywords || []).filter(k => k.active && k.text?.trim());

  console.log(`[Scraper] Found ${keywords.length} active keywords. Window: ${windowDays} days. Max derived: ${maxDerived}.`);

  // 2. Read wilayah.json
  let wilayahData = { provinces: {}, regions: {} };
  try {
    const rawWilayah = await fs.readFile(WILAYAH_FILE, 'utf-8');
    wilayahData = JSON.parse(rawWilayah);
  } catch (err) {
    console.warn('[Scraper] Could not read wilayah.json, continuing with fallback regex:', err.message);
  }
  const extractLocation = buildLocationExtractor(wilayahData);

  // 3. Read existing berita.json (history)
  let existingBerita = { generatedAt: null, windowDays, errors: [], groups: [] };
  try {
    const rawBerita = await fs.readFile(BERITA_FILE, 'utf-8');
    existingBerita = JSON.parse(rawBerita);
  } catch {
    console.log('[Scraper] No existing berita.json found; starting fresh.');
  }

  const errors = [];
  const keywordArticlesMap = new Map();

  // 4. LEVEL 1: Fetch Google News RSS for each active keyword + synonyms
  for (const kw of keywords) {
    console.log(`[Scraper] Level 1 search for keyword: "${kw.text}" (ID: ${kw.id})`);
    const queries = [kw.text, ...(kw.synonyms || [])].filter(q => q.trim().length > 0);
    const kwArticles = [];
    const seenLinks = new Set();

    for (const q of queries) {
      try {
        const items = await fetchGoogleNewsRss(q, windowDays);
        for (const raw of items) {
          const cleaned = cleanItem(raw);
          if (!cleaned.title || !cleaned.link) continue;
          if (seenLinks.has(cleaned.link)) continue;
          seenLinks.add(cleaned.link);

          const loc = extractLocation(cleaned.title);
          kwArticles.push({
            title: cleaned.title,
            link: cleaned.link,
            source: cleaned.source,
            publishedAt: cleaned.publishedAt,
            alsoIn: [],
            location: loc,
            keywordId: kw.id,
          });
        }
      } catch (err) {
        errors.push({ keyword: kw.text, query: q, error: err.message });
      }
    }

    keywordArticlesMap.set(kw.id, kwArticles);
    console.log(`[Scraper]   -> Found ${kwArticles.length} raw articles in Level 1.`);
  }

  // 5. LEVEL 2: Auto-Expansion (Derived Events)
  // PRD: "Dari tiap berita yang cocok, sistem menemukan kejadian spesifik (topik + lokasi) dan mencari berita terkait kejadian itu."
  for (const kw of keywords) {
    const articles = keywordArticlesMap.get(kw.id) || [];
    const uniqueLocations = new Set();

    for (const a of articles) {
      if (a.location) {
        uniqueLocations.add(a.location);
      }
    }

    const locationsToSearch = Array.from(uniqueLocations).slice(0, maxDerived);
    if (locationsToSearch.length > 0) {
      console.log(`[Scraper] Level 2 derived event searches for "${kw.text}": ${locationsToSearch.join(', ')}`);
    }

    for (const loc of locationsToSearch) {
      const derivedQuery = `"${kw.text}" "${loc}"`;
      try {
        const items = await fetchGoogleNewsRss(derivedQuery, windowDays);
        for (const raw of items) {
          const cleaned = cleanItem(raw);
          if (!cleaned.title || !cleaned.link) continue;

          // Check if article already in list
          const exists = articles.some(a => a.link === cleaned.link);
          if (!exists) {
            articles.push({
              title: cleaned.title,
              link: cleaned.link,
              source: cleaned.source,
              publishedAt: cleaned.publishedAt,
              alsoIn: [],
              location: loc,
              keywordId: kw.id,
            });
          }
        }
      } catch (err) {
        console.warn(`[Scraper] Error in Level 2 search "${derivedQuery}":`, err.message);
      }
    }
  }

  // 6. MERGE WITH PREVIOUS HISTORY & DEDUPLICATE
  // PRD: "Gabungkan dengan berita.json sebelumnya (riwayat), buang yang lebih tua dari masa simpan (default 7 hari)."
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - windowDays);
  const cutoffTime = cutoffDate.getTime();

  // Map existing groups by group ID
  const existingGroupsMap = new Map();
  if (Array.isArray(existingBerita.groups)) {
    for (const grp of existingBerita.groups) {
      existingGroupsMap.set(grp.id, grp);
    }
  }

  const finalGroups = [];

  for (const kw of keywords) {
    const freshArticles = keywordArticlesMap.get(kw.id) || [];

    // Gather old articles from existing groups belonging to this keyword
    const historicalArticles = [];
    for (const grp of existingGroupsMap.values()) {
      if (grp.keywordId === kw.id && Array.isArray(grp.items)) {
        for (const item of grp.items) {
          const pubTime = new Date(item.publishedAt).getTime();
          if (pubTime >= cutoffTime) {
            historicalArticles.push({
              title: item.title,
              link: item.link,
              source: item.source,
              publishedAt: item.publishedAt,
              alsoIn: item.alsoIn || [],
              location: grp.location || extractLocation(item.title),
              keywordId: kw.id,
            });
          }
        }
      }
    }

    // Combine fresh and historical articles
    const combinedPool = [...freshArticles, ...historicalArticles];

    // Deduplicate: merge identical links or titles with Jaccard > 0.85
    const dedupedPool = [];
    for (const art of combinedPool) {
      let isDuplicate = false;
      for (const existing of dedupedPool) {
        const isSameLink = existing.link && art.link && existing.link === art.link;
        const sim = calculateJaccardSimilarity(existing.title, art.title);

        if (isSameLink || sim >= 0.85) {
          isDuplicate = true;
          // Merge source into alsoIn
          const allSources = new Set([existing.source, ...(existing.alsoIn || [])]);
          if (art.source && art.source !== existing.source) {
            allSources.add(art.source);
          }
          if (Array.isArray(art.alsoIn)) {
            art.alsoIn.forEach(s => allSources.add(s));
          }
          allSources.delete(existing.source);
          existing.alsoIn = Array.from(allSources);

          if (art.location && !existing.location) {
            existing.location = art.location;
          }
          break;
        }
      }

      if (!isDuplicate) {
        dedupedPool.push({ ...art, alsoIn: [...(art.alsoIn || [])] });
      }
    }

    // 7. GROUPING
    // PRD 7.3:
    // 1. Jika lokasi terekstrak, berita masuk grup keyword + lokasi tersebut.
    // 2. Jika tidak ada lokasi, cocokkan ke grup yang ada lewat kemiripan judul (Jaccard >= 0.5).
    // 3. Jika tidak cocok, berita masuk grup "Umum" milik keyword tersebut.
    const groupsMap = new Map();
    const unassignedArticles = [];

    // Phase 1: Location groups
    for (const art of dedupedPool) {
      if (art.location) {
        const normLoc = normalizeLocationKey(art.location);
        const groupId = `${kw.id}|${normLoc}`;

        if (!groupsMap.has(groupId)) {
          const capitalizedKw = kw.text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          groupsMap.set(groupId, {
            id: groupId,
            keywordId: kw.id,
            title: `${capitalizedKw} di ${art.location}`,
            location: art.location,
            items: [],
          });
        }
        groupsMap.get(groupId).items.push(art);
      } else {
        unassignedArticles.push(art);
      }
    }

    // Phase 2: Title similarity matching for unassigned articles
    const umumArticles = [];
    for (const art of unassignedArticles) {
      let bestMatch = null;
      let highestSim = 0;

      for (const grp of groupsMap.values()) {
        for (const grpItem of grp.items) {
          const sim = calculateJaccardSimilarity(art.title, grpItem.title);
          if (sim > highestSim && sim >= 0.5) {
            highestSim = sim;
            bestMatch = grp;
          }
        }
      }

      if (bestMatch) {
        bestMatch.items.push(art);
      } else {
        umumArticles.push(art);
      }
    }

    // Phase 3: "Umum" Group
    if (umumArticles.length > 0) {
      const capitalizedKw = kw.text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const umumId = `${kw.id}|umum`;
      groupsMap.set(umumId, {
        id: umumId,
        keywordId: kw.id,
        title: `${capitalizedKw} (Umum & Terkait)`,
        location: null,
        items: umumArticles,
      });
    }

    // Format Groups as per PRD Section 8
    for (const grp of groupsMap.values()) {
      if (grp.items.length === 0) continue;

      // Sort items descending by publishedAt
      grp.items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

      // Distinct sources count
      const distinctSources = new Set();
      for (const item of grp.items) {
        if (item.source) distinctSources.add(item.source);
        if (Array.isArray(item.alsoIn)) {
          item.alsoIn.forEach(s => distinctSources.add(s));
        }
      }

      // First seen and latest timestamps
      let firstSeen = grp.items[grp.items.length - 1].publishedAt;
      let latest = grp.items[0].publishedAt;

      // Check if this group had a previous firstSeen
      const prevGrp = existingGroupsMap.get(grp.id);
      if (prevGrp?.firstSeen) {
        if (new Date(prevGrp.firstSeen).getTime() < new Date(firstSeen).getTime()) {
          firstSeen = prevGrp.firstSeen;
        }
      }

      finalGroups.push({
        id: grp.id,
        keywordId: grp.keywordId,
        title: grp.title,
        location: grp.location,
        count: grp.items.length,
        sources: distinctSources.size,
        firstSeen,
        latest,
        items: grp.items.map(item => ({
          title: item.title,
          link: item.link,
          source: item.source,
          publishedAt: item.publishedAt,
          alsoIn: item.alsoIn || [],
        })),
      });
    }
  }

  // Sort groups by latest published date descending
  finalGroups.sort((a, b) => new Date(b.latest).getTime() - new Date(a.latest).getTime());

  // 8. WRITE data/berita.json
  const outputData = {
    generatedAt: new Date().toISOString(),
    windowDays,
    errors,
    groups: finalGroups,
  };

  await fs.writeFile(BERITA_FILE, JSON.stringify(outputData, null, 2), 'utf-8');

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalArticles = finalGroups.reduce((acc, g) => acc + g.count, 0);
  console.log(`[Scraper] Finished in ${durationSec}s. Generated ${finalGroups.length} groups with ${totalArticles} total articles.`);
  console.log(`[Scraper] Output written to ${BERITA_FILE}`);
}

main().catch(err => {
  console.error('[Scraper] Fatal error:', err);
  process.exit(1);
});
