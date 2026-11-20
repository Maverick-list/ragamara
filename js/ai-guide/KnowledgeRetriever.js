/**
 * NULAR AI House Tour Guide — KnowledgeRetriever (js/ai-guide/KnowledgeRetriever.js)
 * Strictly grounds every AI Tour Guide prompt and local fallback answer in verified
 * NULAR cultural datasets (data/houses.json). Blocks hallucination and prevents
 * cross-house bleed unless the visitor explicitly requests a comparison.
 */

export class KnowledgeRetriever {
  constructor(houses) {
    this.houses = houses;
  }

  buildGroundedSystemInstruction(ctx, language = 'id') {
    const langRule = language === 'en'
      ? 'Respond in warm, natural, museum-grade English (you may cite original Indonesian architectural terms with brief translations).'
      : 'Berbicaralah dalam Bahasa Indonesia yang hangat, sopan, berwawasan museum arsitektur, mudah dipahami, dan menghormati budaya lokal.';

    const persona = [
      'Anda adalah Pemandu Tur Arsitektur Resmi NULAR (Nusa Learn) — The Living Archipelago.',
      langRule,
      'ATURAN AKURASI KETAT:',
      '1. Jawab HANYA berdasarkan fakta terverifikasi pada konteks rumah adat di bawah ini.',
      '2. JANGAN mengarang tanggal sejarah, nama upacara, atau klaim arsitektur yang tidak ada pada sumber.',
      '3. Jika pengunjung menanyakan hal yang tidak terdapat dalam arsip konteks, akui secara jujur bahwa data tersebut belum terdokumentasi di arsip NULAR saat ini.',
      '4. Fokus pada rumah adat yang sedang dikunjungi pengunjung sekarang. Jangan melompat membahas rumah adat lain kecuali pengunjung secara eksplisit meminta perbandingan.',
      '5. Jawab ringkas dan komunikatif (2–4 kalimat per giliran suara) agar nyaman didengar secara real-time, lalu tawarkan sudut penjelasan lanjutan.'
    ].join('\n');

    if (!ctx.house) {
      return `${persona}\n\nKONTEKS LOKASI SAAT INI:\nPengunjung berada di Alun-Alun Utama Nusantara (Hub 38 Provinsi Indonesia). Ajak pengunjung memilih gerbang pulau atau membuka Peta 38 Provinsi untuk memasuki rumah adat pilihan mereka.`;
    }

    const h = ctx.house;
    const compList = (h.hotspots || []).map((c) => `- ${c.title} (${c.localName}): ${c.practicalFunction} Bahan: ${c.constructionAndMaterial}. Makna: ${c.culturalMeaning}`).join('\n');
    const sources = (h.sources || []).map((s) => `${s.title} (${s.author || 'Arsip'})`).join('; ');
    const activeComp = ctx.inspectedComponent
      ? `\nKOMPONEN YANG SEDANG DIINSPEKSI PENGUNJUNG: ${ctx.inspectedComponent.title} (${ctx.inspectedComponent.localName}) — ${ctx.inspectedComponent.practicalFunction}`
      : '';

    return `${persona}

KONTEKS LOKASI PENGUNJUNG SAAT INI:
- Rumah Adat: ${h.houseName} (Nama Lokal: ${h.localName}; Nama Alternatif: ${(h.alternativeNames || []).join(', ') || '-'})
- Provinsi / Wilayah: ${h.province} (${h.districtOrRegion}) · Pulau: ${h.island}
- Komunitas Budaya: ${h.culturalCommunity}
- Zona Ruang Saat Ini: ${ctx.roomName}${activeComp}

DATA ARSITEKTUR TERVERIFIKASI:
- Ringkasan: ${h.introduction}
- Konteks Sejarah: ${h.historicalContext}
- Tipologi & Atap: ${h.architecturalType} — ${h.architecturalFeatures?.roofForm || ''}
- Sistem Struktur: ${h.structuralSystem}
- Pondasi: ${h.architecturalFeatures?.foundation || ''}
- Material Utama: ${(h.constructionMaterials || []).join(', ')}
- Tata Ruang & Interior: ${h.interiorArrangement || h.architecturalFeatures?.spatialLayout || ''}
- Adaptasi Iklim: ${h.architecturalFeatures?.climateAdaptation || ''}
- Makna Budaya: ${h.culturalSignificance?.symbolism || ''}
- Catatan Rekonstruksi: ${h.reconstructionNote || h.modelCapabilities?.limitationsNote || ''}
- Daftar Komponen:
${compList || '- Komponen dasar struktur vernakular'}
- Sumber Rujukan Resmi: ${sources}`;
  }

  /**
   * Deterministic strictly-grounded answer engine for zero-API-key / offline / fallback sessions.
   * Zero hallucinations: returns verified facts from the visitor's active house or explicit admission.
   */
  answerLocally(question, ctx, language = 'id') {
    const q = (question || '').toLowerCase();
    const isEn = language === 'en';

    // Check if visitor explicitly asked to compare with another house
    const compareTarget = /(banding|compare|beda|versus|\bvs\b)/.test(q)
      ? this.houses.find((other) => other.id !== ctx.houseId && (q.includes(other.houseName.toLowerCase()) || q.includes(other.id.replace(/-/g, ' '))))
      : null;

    if (!ctx.house) {
      return {
        text: isEn
          ? 'Welcome to the Nusantara Main Plaza! Walk toward any of the 7 Island Gateways or open the 38-Province Teleport Atlas to step inside traditional houses from Aceh to South Papua.'
          : 'Selamat datang di Alun-Alun Utama Nusantara! Berjalanlah menuju salah satu dari 7 Gerbang Kepulauan atau buka menu "38 Provinsi" untuk langsung memasuki eksterior dan interior rumah adat dari Aceh hingga Papua Selatan.',
        groundedIn: 'NULAR Hub Plaza (38 Provinsi)'
      };
    }

    const h = ctx.house;
    const cite = (h.sources || []).map((s) => s.title).slice(0, 2).join('; ');

    if (compareTarget) {
      return {
        text: isEn
          ? `Comparing ${h.houseName} (${h.province}) with ${compareTarget.houseName} (${compareTarget.province}): ${h.houseName} uses ${h.structuralSystem}, whereas ${compareTarget.houseName} features ${compareTarget.structuralSystem}.`
          : `Perbandingan ${h.houseName} (${h.province}) dengan ${compareTarget.houseName} (${compareTarget.province}): ${h.houseName} memakai ${h.structuralSystem}, sedangkan ${compareTarget.houseName} dikenal dengan ${compareTarget.structuralSystem}.`,
        groundedIn: `${h.houseName} vs ${compareTarget.houseName}`
      };
    }

    // Component-specific query match
    const matchedComp = (h.hotspots || []).find((c) =>
      q.includes(c.title.toLowerCase().split(' ')[0]) ||
      q.includes((c.localName || '').toLowerCase().split(' ')[0])
    ) || (/(komponen|bagian|ini|tiang|pillar|soko|tumpang|atap|roof|pintu|gebyok|perapian)/.test(q) ? ctx.inspectedComponent : null);

    if (matchedComp && /(komponen|bagian|fungsi|soko|tumpang|gonjong|umpak|gebyok|perapian|tangga|atap|tiang|ini|pillar|roof)/.test(q)) {
      return {
        text: isEn
          ? `On ${h.houseName}, "${matchedComp.title}" (${matchedComp.localName}) is built with ${matchedComp.constructionAndMaterial}. Its primary structural role: ${matchedComp.practicalFunction} Cultural meaning: ${matchedComp.culturalMeaning}`
          : `Pada ${h.houseName}, bagian "${matchedComp.title}" (${matchedComp.localName}) dibuat dari ${matchedComp.constructionAndMaterial}. Fungsi utamanya: ${matchedComp.practicalFunction} Makna budayanya: ${matchedComp.culturalMeaning}`,
        groundedIn: `${h.houseName} → ${matchedComp.title}`
      };
    }

    if (/(bahan|material|kayu|bambu|wood|konstruksi)/.test(q)) {
      return {
        text: isEn
          ? `${h.houseName} is traditionally constructed using ${(h.constructionMaterials || []).join(', ')}. Structural method: ${h.architecturalFeatures?.constructionTechniques || h.structuralSystem}`
          : `${h.houseName} dibangun menggunakan material utama: ${(h.constructionMaterials || []).join(', ')}. Teknik konstruksinya: ${h.architecturalFeatures?.constructionTechniques || h.structuralSystem}`,
        groundedIn: `${h.houseName} · Material & Konstruksi (${cite})`
      };
    }

    if (/(ruang|interior|dalam|kamar|lantai|room|layout|tata ruang)/.test(q)) {
      return {
        text: isEn
          ? `You are currently in "${ctx.roomName}" of ${h.houseName}. Traditional spatial organization: ${h.interiorArrangement || h.architecturalFeatures?.spatialLayout || h.spatialFunctions}`
          : `Saat ini Anda berada di zona "${ctx.roomName}" pada ${h.houseName}. Tata ruang tradisionalnya: ${h.interiorArrangement || h.architecturalFeatures?.spatialLayout || h.spatialFunctions}`,
        groundedIn: `${h.houseName} · Tata Ruang Interior`
      };
    }

    if (/(iklim|panas|hujan|gempa|udara|climate|weather|earthquake)/.test(q)) {
      return {
        text: isEn
          ? `Climate adaptation of ${h.houseName}: ${h.architecturalFeatures?.climateAdaptation}`
          : `Adaptasi iklim dan lingkungan pada ${h.houseName}: ${h.architecturalFeatures?.climateAdaptation}`,
        groundedIn: `${h.houseName} · Adaptasi Iklim`
      };
    }

    if (/(sejarah|asal|makna|budaya|filosofi|history|meaning|culture|siapa|suku)/.test(q)) {
      return {
        text: isEn
          ? `${h.houseName} is the vernacular architectural heritage of ${h.culturalCommunity} in ${h.districtOrRegion}, ${h.province}. ${h.historicalContext} Symbolism: ${h.culturalSignificance?.symbolism}`
          : `${h.houseName} merupakan warisan arsitektur fisik ${h.culturalCommunity} di ${h.districtOrRegion}, ${h.province}. ${h.historicalContext} Makna simbolisnya: ${h.culturalSignificance?.symbolism}`,
        groundedIn: `${h.houseName} · Sejarah & Budaya (${cite})`
      };
    }

    if (/(sumber|referensi|source|rekonstruksi|asli)/.test(q)) {
      return {
        text: isEn
          ? `Documented sources for ${h.houseName}: ${cite}. Note on 3D representation: ${h.reconstructionNote || h.modelCapabilities?.limitationsNote}`
          : `Rujukan terverifikasi untuk ${h.houseName}: ${cite}. Catatan keterbukaan model 3D: ${h.reconstructionNote || h.modelCapabilities?.limitationsNote}`,
        groundedIn: cite || h.houseName
      };
    }

    // Strict anti-hallucination check for out-of-domain / unsupported queries
    if (/(bitcoin|saham|resep|cuaca besok|presiden|politik|harga tiket|tahun pasti dibangunnya)/.test(q)) {
      return {
        text: isEn
          ? `I apologize, that specific information is not documented in NULAR's verified architectural archive for ${h.houseName}. I can help explain its roof structure, materials, interior rooms, climate adaptation, or cultural meaning instead.`
          : `Maaf, informasi spesifik tersebut belum terdokumentasi dalam arsip arsitektur terverifikasi NULAR untuk ${h.houseName}. Saya dapat membantu menjelaskan struktur atap, material, tata ruang interior, adaptasi iklim, atau makna budayanya.`,
        groundedIn: 'Anti-Halusinasi NULAR (Fakta Tidak Tersedia)'
      };
    }

    // Default contextual welcome/overview for the active house & room
    return {
      text: isEn
        ? `Welcome to ${h.houseName} (${h.province}) — you are currently at "${ctx.roomName}". ${h.introduction} Ask me about its materials, structural system, interior layout, climate adaptation, or cultural symbolism.`
        : `Selamat datang di ${h.houseName} (${h.province}) — posisi Anda saat ini di "${ctx.roomName}". ${h.introduction} Anda dapat menanyakan tentang material, sistem struktur, tata ruang interior, adaptasi iklim, atau makna budayanya.`,
      groundedIn: `${h.houseName} · ${ctx.roomName}`
    };
  }
}
