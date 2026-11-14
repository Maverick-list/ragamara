import re
from pathlib import Path

app_path = Path("/home/firza-ilmi/.gemini/antigravity/scratch/ragamara/app.html")
html = app_path.read_text(encoding="utf-8")

# 1. Update Header HUD with Leaderboard, Daily Missions, and Settings buttons
old_hud_target = """        <!-- Player Level Badge & Profile Link -->
        <button onclick="switchView('profil')" class="relative flex items-center gap-1 pl-1 text-decoration-none group" title="Profil Pemain">
          <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-[#6338D4] to-[#8B5CF6] flex items-center justify-center border-2 border-[#FFCA55] shadow-[0_2px_0_#0F0818] overflow-hidden">
            <img src="assets/images/mascot_raga_avatar.png" alt="Raga Avatar" class="w-full h-full object-cover">
          </div>
          <span class="absolute -bottom-1 -right-1 px-1.5 py-0.2 bg-[#FFCA55] text-[#382400] text-[10px] font-extrabold rounded-full shadow" id="hud-level-badge">Lv.8</span>
        </button>"""

new_hud_replacement = """        <!-- Papan Peringkat / Leaderboard Quick Button -->
        <button onclick="openLeaderboardModal()" class="w-9 h-9 rounded-full bg-[#2D2445] border border-[#FFCA55]/40 text-[#FFCA55] hover:border-[#FFCA55] hover:scale-105 transition-all flex items-center justify-center shadow-[0_2px_0_#0F0818]" title="Papan Peringkat Nusantara">
          <span class="material-symbols-outlined text-[19px]">leaderboard</span>
        </button>

        <!-- Misi Harian Quick Button -->
        <button onclick="openDailyMissionsModal()" class="w-9 h-9 rounded-full bg-[#2D2445] border border-[#24CBA2]/40 text-[#24CBA2] hover:border-[#24CBA2] hover:scale-105 transition-all flex items-center justify-center shadow-[0_2px_0_#0F0818]" title="Pusat Misi Harian">
          <span class="material-symbols-outlined text-[19px]">flag</span>
        </button>

        <!-- Pengaturan Quick Button -->
        <button onclick="RagamaraEcosystem.Settings.openModal()" class="w-9 h-9 rounded-full bg-[#2D2445] border border-[#8B5CF6]/40 text-[#CCC3DF] hover:text-white hover:border-[#8B5CF6] hover:scale-105 transition-all flex items-center justify-center shadow-[0_2px_0_#0F0818]" title="Pengaturan & Aksesibilitas">
          <span class="material-symbols-outlined text-[19px]">settings</span>
        </button>

        <!-- Player Level Badge & Profile Link -->
        <button onclick="switchView('profil')" class="relative flex items-center gap-1 pl-1 text-decoration-none group" title="Profil Pemain">
          <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-[#6338D4] to-[#8B5CF6] flex items-center justify-center border-2 border-[#FFCA55] shadow-[0_2px_0_#0F0818] overflow-hidden">
            <img src="assets/images/mascot_raga_avatar.png" alt="Raga Avatar" class="w-full h-full object-cover">
          </div>
          <span class="absolute -bottom-1 -right-1 px-1.5 py-0.2 bg-[#FFCA55] text-[#382400] text-[10px] font-extrabold rounded-full shadow" id="hud-level-badge">Lv.8</span>
        </button>"""

if old_hud_target in html:
    html = html.replace(old_hud_target, new_hud_replacement)
    print("Updated Header HUD!")
else:
    print("Warning: old_hud_target not found!")

# 2. Replace view-koleksi and view-profil
old_views_pattern = re.compile(
    r'<!-- ================= VIEW 4: KOLEKSI.*?<!-- ================= VIEW 5: PROFIL.*?</div>\s*</div>\s*</div>\s*</main>',
    re.DOTALL
)

new_views_content = """<!-- ================= VIEW 4: KOLEKSI (CULTUREPEDIA & ECOSYSTEM HUB) ================= -->
    <div id="view-koleksi" class="view-pane hidden max-w-7xl mx-auto px-4 md:px-8 py-4 space-y-8">
      
      <!-- Top Title & Navigation Segmented Controls -->
      <div class="bg-gradient-to-r from-[#211B35] via-[#2D2445] to-[#211B35] p-6 sm:p-8 rounded-3xl border border-[#8B5CF6]/30 shadow-2xl relative overflow-hidden">
        <div class="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#6338D4]/20 blur-3xl pointer-events-none"></div>
        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6338D4]/50 border border-[#FFCA55]/40 text-[#FFCA55] text-xs font-black uppercase tracking-wider mb-2">
              <span class="material-symbols-outlined text-[16px]">verified</span>
              <span>DAPOBUD RI × Wikipedia Indonesia</span>
            </div>
            <h2 class="text-3xl sm:text-4xl font-black text-[#FFF8EB] drop-shadow-md">
              Culturepedia & Koleksi Pusaka
            </h2>
            <p class="text-xs sm:text-sm text-[#CCC3DF] mt-1.5 max-w-2xl leading-relaxed">
              Eksplorasi khazanah 10 Objek Pemajuan Kebudayaan (OPK) Indonesia, interaksi ekspresi bersama Raga si Badak Jawa, serta pantau lencana pencapaian luhurmu.
            </p>
          </div>

          <!-- Sub-Tab Switcher -->
          <div class="flex items-center gap-1.5 bg-[#150E22] p-1.5 rounded-2xl border border-[#8B5CF6]/30 self-start md:self-auto shrink-0 shadow-inner">
            <button onclick="switchKoleksiTab('culturepedia')" id="btn-tab-culturepedia" class="koleksi-subtab px-4 py-2.5 rounded-xl font-extrabold text-xs text-white bg-[#6338D4] shadow-[0_4px_0_#392071] transition-all flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px]">auto_stories</span>
              <span>Culturepedia</span>
            </button>
            <button onclick="switchKoleksiTab('maskot')" id="btn-tab-maskot" class="koleksi-subtab px-4 py-2.5 rounded-xl font-bold text-xs text-[#CCC3DF] hover:text-white transition-all flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px]">cruelty_free</span>
              <span>Galeri Maskot</span>
            </button>
            <button onclick="switchKoleksiTab('prestasi')" id="btn-tab-prestasi" class="koleksi-subtab px-4 py-2.5 rounded-xl font-bold text-xs text-[#CCC3DF] hover:text-white transition-all flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px]">military_tech</span>
              <span>Prestasi & Lencana</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ================= SUBVIEW A: CULTUREPEDIA ================= -->
      <div id="koleksi-subview-culturepedia" class="space-y-6">
        
        <!-- Search & Quick Filters Bar -->
        <div class="bg-[#211B35] p-5 rounded-3xl border border-[#8B5CF6]/25 space-y-4 shadow-xl">
          <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            
            <!-- Live Search Bar -->
            <div class="relative flex-1">
              <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#8B5CF6] text-xl">search</span>
              <input type="text" id="culturepedia-search" oninput="RagamaraEcosystem.Culturepedia.searchQuery = this.value; RagamaraEcosystem.Culturepedia.render();" placeholder="Cari pusaka, motif, tradisi lisan, senjata, atau provinsi..." class="w-full pl-12 pr-4 py-3 rounded-2xl bg-[#150E22] border border-[#8B5CF6]/30 text-white placeholder-[#CCC3DF]/50 text-xs sm:text-sm focus:outline-none focus:border-[#FFCA55] transition-all">
            </div>

            <!-- View Modes: Semua vs Tersimpan -->
            <div class="flex items-center gap-2 shrink-0">
              <button onclick="RagamaraEcosystem.Culturepedia.activeTab = 'all'; document.querySelectorAll('.culture-view-mode').forEach(b => b.classList.remove('btn-primary')); this.classList.add('btn-primary'); RagamaraEcosystem.Culturepedia.render();" class="culture-view-mode btn btn-primary text-xs py-2.5 px-4 flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">travel_explore</span>
                <span>Semua Artefak</span>
              </button>
              <button onclick="RagamaraEcosystem.Culturepedia.activeTab = 'saved'; document.querySelectorAll('.culture-view-mode').forEach(b => b.classList.remove('btn-primary')); this.classList.add('btn-primary'); RagamaraEcosystem.Culturepedia.render();" class="culture-view-mode btn btn-secondary text-xs py-2.5 px-4 flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px] text-[#FF786B]">favorite</span>
                <span>Tersimpan</span>
              </button>
            </div>
          </div>

          <!-- 10 Objek Pemajuan Kebudayaan (OPK) Filters -->
          <div class="space-y-2 pt-2 border-t border-[#8B5CF6]/15">
            <span class="text-[10px] font-black uppercase text-[#FFCA55] tracking-wider block">Kategori Objek Pemajuan Kebudayaan (OPK):</span>
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button onclick="selectOpkFilter('Semua', this)" class="opk-filter-btn active-filter px-3 py-1.5 rounded-full text-xs font-bold bg-[#150E22] border border-[#8B5CF6]/30 text-[#CCC3DF] hover:text-white shrink-0 transition-all" data-cat="Semua">Semua Kategori</button>
              <button onclick="selectOpkFilter('Tradisi Lisan', this)" class="opk-filter-btn px-3 py-1.5 rounded-full text-xs font-bold bg-[#150E22] border border-[#8B5CF6]/30 text-[#CCC3DF] hover:text-white shrink-0 transition-all" data-cat="Tradisi Lisan">Tradisi Lisan</button>
              <button onclick="selectOpkFilter('Manuskrip', this)" class="opk-filter-btn px-3 py-1.5 rounded-full text-xs font-bold bg-[#150E22] border border-[#8B5CF6]/30 text-[#CCC3DF] hover:text-white shrink-0 transition-all" data-cat="Manuskrip">Manuskrip</button>
              <button onclick="selectOpkFilter('Adat Istiadat', this)" class="opk-filter-btn px-3 py-1.5 rounded-full text-xs font-bold bg-[#150E22] border border-[#8B5CF6]/30 text-[#CCC3DF] hover:text-white shrink-0 transition-all" data-cat="Adat Istiadat">Adat Istiadat</button>
              <button onclick="selectOpkFilter('Ritus', this)" class="opk-filter-btn px-3 py-1.5 rounded-full text-xs font-bold bg-[#150E22] border border-[#8B5CF6]/30 text-[#CCC3DF] hover:text-white shrink-0 transition-all" data-cat="Ritus">Ritus</button>
              <button onclick="selectOpkFilter('Pengetahuan Tradisional', this)" class="opk-filter-btn px-3 py-1.5 rounded-full text-xs font-bold bg-[#150E22] border border-[#8B5CF6]/30 text-[#CCC3DF] hover:text-white shrink-0 transition-all" data-cat="Pengetahuan Tradisional">Pengetahuan Tradisional</button>
              <button onclick="selectOpkFilter('Teknologi Tradisional', this)" class="opk-filter-btn px-3 py-1.5 rounded-full text-xs font-bold bg-[#150E22] border border-[#8B5CF6]/30 text-[#CCC3DF] hover:text-white shrink-0 transition-all" data-cat="Teknologi Tradisional">Teknologi Tradisional</button>
              <button onclick="selectOpkFilter('Seni', this)" class="opk-filter-btn px-3 py-1.5 rounded-full text-xs font-bold bg-[#150E22] border border-[#8B5CF6]/30 text-[#CCC3DF] hover:text-white shrink-0 transition-all" data-cat="Seni">Seni Pertunjukan</button>
              <button onclick="selectOpkFilter('Bahasa', this)" class="opk-filter-btn px-3 py-1.5 rounded-full text-xs font-bold bg-[#150E22] border border-[#8B5CF6]/30 text-[#CCC3DF] hover:text-white shrink-0 transition-all" data-cat="Bahasa">Bahasa & Aksara</button>
              <button onclick="selectOpkFilter('Permainan Rakyat', this)" class="opk-filter-btn px-3 py-1.5 rounded-full text-xs font-bold bg-[#150E22] border border-[#8B5CF6]/30 text-[#CCC3DF] hover:text-white shrink-0 transition-all" data-cat="Permainan Rakyat">Permainan Rakyat</button>
              <button onclick="selectOpkFilter('Olahraga Tradisional', this)" class="opk-filter-btn px-3 py-1.5 rounded-full text-xs font-bold bg-[#150E22] border border-[#8B5CF6]/30 text-[#CCC3DF] hover:text-white shrink-0 transition-all" data-cat="Olahraga Tradisional">Olahraga Tradisional</button>
            </div>
          </div>

          <!-- Regional Geographic Filters -->
          <div class="space-y-2 pt-1 border-t border-[#8B5CF6]/15">
            <span class="text-[10px] font-black uppercase text-[#24CBA2] tracking-wider block">Gugusan Wilayah Geografis:</span>
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button onclick="selectRegionFilter('Semua', this)" class="region-filter-btn active-filter px-3 py-1 rounded-full text-xs font-bold bg-[#150E22] border border-[#8B5CF6]/30 text-[#CCC3DF] hover:text-white shrink-0 transition-all" data-reg="Semua">Semua Wilayah</button>
              <button onclick="selectRegionFilter('Sumatra', this)" class="region-filter-btn px-3 py-1 rounded-full text-xs font-bold bg-[#150E22] border border-[#8B5CF6]/30 text-[#CCC3DF] hover:text-white shrink-0 transition-all" data-reg="Sumatra">Sumatra</button>
              <button onclick="selectRegionFilter('Jawa', this)" class="region-filter-btn px-3 py-1 rounded-full text-xs font-bold bg-[#150E22] border border-[#8B5CF6]/30 text-[#CCC3DF] hover:text-white shrink-0 transition-all" data-reg="Jawa">Jawa</button>
              <button onclick="selectRegionFilter('Bali & Nusa Tenggara', this)" class="region-filter-btn px-3 py-1 rounded-full text-xs font-bold bg-[#150E22] border border-[#8B5CF6]/30 text-[#CCC3DF] hover:text-white shrink-0 transition-all" data-reg="Bali & Nusa Tenggara">Bali & NT</button>
              <button onclick="selectRegionFilter('Kalimantan', this)" class="region-filter-btn px-3 py-1 rounded-full text-xs font-bold bg-[#150E22] border border-[#8B5CF6]/30 text-[#CCC3DF] hover:text-white shrink-0 transition-all" data-reg="Kalimantan">Kalimantan</button>
              <button onclick="selectRegionFilter('Sulawesi', this)" class="region-filter-btn px-3 py-1 rounded-full text-xs font-bold bg-[#150E22] border border-[#8B5CF6]/30 text-[#CCC3DF] hover:text-white shrink-0 transition-all" data-reg="Sulawesi">Sulawesi</button>
              <button onclick="selectRegionFilter('Maluku', this)" class="region-filter-btn px-3 py-1 rounded-full text-xs font-bold bg-[#150E22] border border-[#8B5CF6]/30 text-[#CCC3DF] hover:text-white shrink-0 transition-all" data-reg="Maluku">Maluku</button>
              <button onclick="selectRegionFilter('Papua', this)" class="region-filter-btn px-3 py-1 rounded-full text-xs font-bold bg-[#150E22] border border-[#8B5CF6]/30 text-[#CCC3DF] hover:text-white shrink-0 transition-all" data-reg="Papua">Papua</button>
            </div>
          </div>
        </div>

        <!-- Counter & Results Status -->
        <div class="flex items-center justify-between px-2">
          <span id="culturepedia-count" class="text-xs font-bold text-[#CCC3DF]">Memuat data entri kebudayaan...</span>
          <span class="text-[11px] text-[#24CBA2] font-semibold flex items-center gap-1">
            <span class="material-symbols-outlined text-[15px]">verified_user</span> Terverifikasi Resmi Kemendikbud
          </span>
        </div>

        <!-- Dynamic Grid of Cultural Artifact Cards -->
        <div id="culturepedia-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <!-- Rendered by RagamaraEcosystem.Culturepedia.render() -->
        </div>
      </div>

      <!-- ================= SUBVIEW B: MASCOT GALLERY & EXPRESSION STUDIO ================= -->
      <div id="koleksi-subview-maskot" class="hidden space-y-8">
        
        <!-- Flagship Hero Showcase: Raga si Badak Jawa -->
        <div class="bg-gradient-to-br from-[#211B35] via-[#2D2445] to-[#150E22] p-6 sm:p-10 rounded-3xl border-2 border-[#FFCA55]/50 shadow-2xl relative overflow-hidden">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <!-- Left: Mascot 3D Expression Viewport -->
            <div class="lg:col-span-5 flex flex-col items-center justify-center text-center space-y-4">
              <div class="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl bg-gradient-to-tr from-[#6338D4]/40 via-[#8B5CF6]/20 to-transparent p-4 flex items-center justify-center border-2 border-[#8B5CF6]/30 shadow-2xl">
                <!-- Mascot Image Container -->
                <div id="raga-expression-viewer" class="relative z-10 w-full h-full flex items-center justify-center">
                  <img src="assets/images/mascot_raga_transparent.png" alt="Raga si Badak Jawa" class="w-48 h-48 sm:w-56 sm:h-56 object-contain drop-shadow-[0_12px_24px_rgba(99,56,212,0.4)] animate-float-gentle">
                </div>
                <!-- Ambient Glow Ring -->
                <div class="absolute inset-4 rounded-full border border-[#FFCA55]/30 pointer-events-none animate-pulse"></div>
              </div>

              <!-- Live Mascot Speech Bubble -->
              <div class="speech-bubble relative max-w-sm bg-[#150E22]/95 border-2 border-[#8B5CF6]/50 p-4 rounded-2xl shadow-xl text-left">
                <div class="flex items-center gap-1.5 text-[#FFCA55] text-[11px] font-black uppercase mb-1">
                  <span class="material-symbols-outlined text-[15px]">record_voice_over</span>
                  <span>Tutur Kata Raga</span>
                </div>
                <p id="raga-expression-speech" class="text-xs text-[#FFF8EB] leading-relaxed">
                  Aku Raga! Senang sekali bisa menemani petualangan budayamu hari ini!
                </p>
              </div>
            </div>

            <!-- Right: Mascot Lore, Status & Expression Switcher Studio -->
            <div class="lg:col-span-7 space-y-6">
              <div>
                <div class="flex items-center gap-2">
                  <span class="px-3 py-1 rounded-full bg-[#24CBA2] text-[#0A382C] font-black text-xs uppercase tracking-wider">
                    Rekan Aktif Pemain
                  </span>
                  <span class="px-3 py-1 rounded-full bg-[#6338D4] text-white font-extrabold text-xs">
                    Maskot Utama RAGAMARA
                  </span>
                </div>
                <h3 class="text-3xl sm:text-4xl font-black text-[#FFF8EB] mt-2">
                  Raga si Badak Jawa
                </h3>
                <p class="text-xs sm:text-sm text-[#FFCA55] font-bold mt-1">
                  Pusaka Hayati Ujung Kulon • Pelindung Falsafah Luhur Nusantara
                </p>
              </div>

              <div class="space-y-2 text-xs text-[#CCC3DF] leading-relaxed text-justify bg-[#150E22]/60 p-4 rounded-2xl border border-white/5">
                <p>
                  <strong>Raga</strong> adalah Badak Jawa bercula satu (*Rhinoceros sondaicus*) yang ceria, bijaksana, dan penuh rasa ingin tahu terhadap keragaman budaya Nusantara. Ia mengenakan selendang tenun merah bermotif bunga bintang tradisional yang melambangkan kebersamaan, persatuan, dan perlindungan warisan leluhur.
                </p>
                <p class="text-[#24CBA2] font-semibold">
                  🛡️ Efek Pendamping: Memberikan bonus +10% XP pada setiap sesi pembelajaran Culturepedia dan mini-game budaya!
                </p>
              </div>

              <!-- Interactive Expression Switcher -->
              <div class="space-y-2.5">
                <span class="text-xs font-black text-[#FFF8EB] uppercase tracking-wider block">
                  Studio Ekspresi Interaktif Raga:
                </span>
                <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <button onclick="RagamaraEcosystem.MascotCollection.setExpression('neutral')" class="expression-pill-btn active-expr p-2 rounded-xl bg-[#150E22] border border-[#8B5CF6]/30 text-xs font-bold text-center text-[#CCC3DF] hover:text-white transition-all" data-expr="neutral">
                    😊 Netral
                  </button>
                  <button onclick="RagamaraEcosystem.MascotCollection.setExpression('curious')" class="expression-pill-btn p-2 rounded-xl bg-[#150E22] border border-[#8B5CF6]/30 text-xs font-bold text-center text-[#CCC3DF] hover:text-white transition-all" data-expr="curious">
                    🧐 Penasaran
                  </button>
                  <button onclick="RagamaraEcosystem.MascotCollection.setExpression('happy')" class="expression-pill-btn p-2 rounded-xl bg-[#150E22] border border-[#8B5CF6]/30 text-xs font-bold text-center text-[#CCC3DF] hover:text-white transition-all" data-expr="happy">
                    😄 Bahagia
                  </button>
                  <button onclick="RagamaraEcosystem.MascotCollection.setExpression('celebrating')" class="expression-pill-btn p-2 rounded-xl bg-[#150E22] border border-[#8B5CF6]/30 text-xs font-bold text-center text-[#CCC3DF] hover:text-white transition-all" data-expr="celebrating">
                    🎉 Merayakan
                  </button>
                  <button onclick="RagamaraEcosystem.MascotCollection.setExpression('thinking')" class="expression-pill-btn p-2 rounded-xl bg-[#150E22] border border-[#8B5CF6]/30 text-xs font-bold text-center text-[#CCC3DF] hover:text-white transition-all" data-expr="thinking">
                    🤔 Berpikir
                  </button>
                  <button onclick="RagamaraEcosystem.MascotCollection.setExpression('encouraging')" class="expression-pill-btn p-2 rounded-xl bg-[#150E22] border border-[#8B5CF6]/30 text-xs font-bold text-center text-[#CCC3DF] hover:text-white transition-all" data-expr="encouraging">
                    💪 Semangat
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Regional Companion Mascots Collection -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="text-xl font-black text-white">Sahabat Maskot Regional Nusantara</h4>
              <p class="text-xs text-[#CCC3DF]">Koleksi rekan petualangan satwa khas daerah dari seluruh pulau Indonesia.</p>
            </div>
            <span class="px-3 py-1 rounded-full bg-[#2D2445] text-xs font-extrabold text-[#FFCA55] border border-[#FFCA55]/30">
              3 dari 6 Terbuka (50%)
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <!-- Cendro (Papua) -->
            <div class="bg-[#211B35] p-5 rounded-2xl border border-[#24CBA2]/40 hover:border-[#24CBA2] transition-all cursor-pointer flex items-center gap-4" onclick="RagamaraEcosystem.MascotCollection.openDetail('cendro_cenderawasih')">
              <div class="w-16 h-16 rounded-2xl bg-[#6338D4] p-1 border-2 border-[#24CBA2] shadow overflow-hidden shrink-0">
                <img src="assets/images/mascot_raga_avatar.png" alt="Cendro" class="w-full h-full object-cover">
              </div>
              <div class="space-y-1 flex-1">
                <span class="px-2 py-0.2 rounded-full bg-[#24CBA2]/20 text-[#24CBA2] text-[10px] font-black uppercase">Terbuka</span>
                <h5 class="font-extrabold text-sm text-white">Cendro si Cenderawasih</h5>
                <p class="text-[11px] text-[#CCC3DF]">Papua Pegunungan • Penyanyi Nada</p>
              </div>
            </div>

            <!-- Bekti (Kalimantan) -->
            <div class="bg-[#211B35] p-5 rounded-2xl border border-[#24CBA2]/40 hover:border-[#24CBA2] transition-all cursor-pointer flex items-center gap-4" onclick="RagamaraEcosystem.MascotCollection.openDetail('bekti_bekantan')">
              <div class="w-16 h-16 rounded-2xl bg-[#6338D4] p-1 border-2 border-[#24CBA2] shadow overflow-hidden shrink-0">
                <img src="assets/images/mascot_raga_avatar.png" alt="Bekti" class="w-full h-full object-cover">
              </div>
              <div class="space-y-1 flex-1">
                <span class="px-2 py-0.2 rounded-full bg-[#24CBA2]/20 text-[#24CBA2] text-[10px] font-black uppercase">Terbuka</span>
                <h5 class="font-extrabold text-sm text-white">Bekti si Bekantan</h5>
                <p class="text-[11px] text-[#CCC3DF]">Kalimantan Timur • Rimba Mahakam</p>
              </div>
            </div>

            <!-- Jalak (Bali) -->
            <div class="bg-[#211B35] p-5 rounded-2xl border border-[#FFCA55]/40 hover:border-[#FFCA55] transition-all cursor-pointer flex items-center gap-4" onclick="RagamaraEcosystem.MascotCollection.openDetail('jalak_curik')">
              <div class="w-16 h-16 rounded-2xl bg-[#2D2445] p-1 border-2 border-[#FFCA55] shadow overflow-hidden shrink-0">
                <img src="assets/images/mascot_raga_avatar.png" alt="Jalak" class="w-full h-full object-cover">
              </div>
              <div class="space-y-1 flex-1">
                <span class="px-2 py-0.2 rounded-full bg-[#FFCA55]/20 text-[#FFCA55] text-[10px] font-black uppercase">Berjalan (70%)</span>
                <h5 class="font-extrabold text-sm text-white">Jalak Curik Bali</h5>
                <p class="text-[11px] text-[#CCC3DF]">Bali Barat • Tirta Subak</p>
              </div>
            </div>

            <!-- Komo (NTT) -->
            <div class="bg-[#1A1228] p-5 rounded-2xl border border-white/5 opacity-60 hover:opacity-100 transition-all cursor-pointer flex items-center gap-4" onclick="RagamaraEcosystem.MascotCollection.openDetail('komo_komodo')">
              <div class="w-16 h-16 rounded-2xl bg-[#150E22] p-1 border border-white/10 shadow overflow-hidden shrink-0 flex items-center justify-center">
                <span class="material-symbols-outlined text-2xl text-[#CCC3DF]">lock</span>
              </div>
              <div class="space-y-1 flex-1">
                <span class="px-2 py-0.2 rounded-full bg-white/10 text-[#CCC3DF] text-[10px] font-black uppercase">Terkunci (Lv.12)</span>
                <h5 class="font-extrabold text-sm text-white">Komo si Naga Purba</h5>
                <p class="text-[11px] text-[#CCC3DF]">Nusa Tenggara Timur</p>
              </div>
            </div>

            <!-- Maleo (Sulawesi) -->
            <div class="bg-[#1A1228] p-5 rounded-2xl border border-white/5 opacity-60 hover:opacity-100 transition-all cursor-pointer flex items-center gap-4" onclick="RagamaraEcosystem.MascotCollection.openDetail('maleo_sulawesi')">
              <div class="w-16 h-16 rounded-2xl bg-[#150E22] p-1 border border-white/10 shadow overflow-hidden shrink-0 flex items-center justify-center">
                <span class="material-symbols-outlined text-2xl text-[#CCC3DF]">lock</span>
              </div>
              <div class="space-y-1 flex-1">
                <span class="px-2 py-0.2 rounded-full bg-white/10 text-[#CCC3DF] text-[10px] font-black uppercase">Terkunci (Lv.15)</span>
                <h5 class="font-extrabold text-sm text-white">Maleo si Burung Pasir</h5>
                <p class="text-[11px] text-[#CCC3DF]">Sulawesi Tengah</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- ================= SUBVIEW C: ACHIEVEMENTS & BADGES ================= -->
      <div id="koleksi-subview-prestasi" class="hidden space-y-6">
        
        <!-- Filter Tabs -->
        <div class="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-[#8B5CF6]/20">
          <div>
            <h4 class="text-xl font-black text-white">Lencana & Rekor Kehormatan</h4>
            <p class="text-xs text-[#CCC3DF]">Buktikan kecakapan dan dedikasimu dalam melestarikan budaya bangsa.</p>
          </div>
          <div class="flex items-center gap-1.5 bg-[#150E22] p-1 rounded-xl border border-[#8B5CF6]/20">
            <button onclick="RagamaraEcosystem.Achievements.setFilter('all')" class="ach-filter-btn active-filter px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all" data-filter="all">Semua</button>
            <button onclick="RagamaraEcosystem.Achievements.setFilter('unlocked')" class="ach-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold text-[#CCC3DF] hover:text-white transition-all" data-filter="unlocked">Terbuka (3)</button>
            <button onclick="RagamaraEcosystem.Achievements.setFilter('in_progress')" class="ach-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold text-[#CCC3DF] hover:text-white transition-all" data-filter="in_progress">Sedang Berjalan (2)</button>
            <button onclick="RagamaraEcosystem.Achievements.setFilter('locked')" class="ach-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold text-[#CCC3DF] hover:text-white transition-all" data-filter="locked">Terkunci (1)</button>
          </div>
        </div>

        <!-- Achievements Grid -->
        <div id="achievements-grid" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Rendered by RagamaraEcosystem.Achievements.render() -->
        </div>
      </div>

    </div>

    <!-- ================= VIEW 5: PROFIL (RPG PLAYER IDENTITY) ================= -->
    <div id="view-profil" class="view-pane hidden max-w-7xl mx-auto px-4 md:px-8 py-4 space-y-8">
      
      <!-- Player Profile Hero Card -->
      <div class="bg-gradient-to-r from-[#211B35] via-[#2D2445] to-[#211B35] p-6 sm:p-8 rounded-3xl border border-[#8B5CF6]/30 shadow-2xl relative overflow-hidden">
        <div class="flex flex-col md:flex-row items-center gap-6 pb-6 border-b border-[#8B5CF6]/20">
          
          <!-- Customizable Avatar with Equippable Frame -->
          <div class="relative shrink-0">
            <div id="profile-main-avatar" class="w-28 h-28 rounded-3xl bg-[#6338D4] p-1.5 border-4 border-[#FFCA55] overflow-hidden shadow-[0_0_20px_rgba(255,202,85,0.5)] transition-all">
              <img alt="Raga Avatar" class="w-full h-full object-cover" src="assets/images/mascot_raga_avatar.png"/>
            </div>
            <span class="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-[#FFCA55] text-[#382400] text-xs font-black shadow-lg">
              Lv. 8
            </span>
          </div>

          <!-- Identity Details & Title Customization -->
          <div class="text-center md:text-left space-y-2 flex-1">
            <div class="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span class="px-3 py-0.5 rounded-full bg-[#6338D4] text-white text-[11px] font-black uppercase tracking-wider">
                Gelar Kehormatan Nusantara
              </span>
              <span class="px-2.5 py-0.5 rounded-full bg-[#24CBA2]/20 text-[#24CBA2] text-[11px] font-bold">
                Status: Penjelajah Aktif
              </span>
            </div>
            <h2 class="text-2xl sm:text-3xl font-black text-white">
              Firza Penjelajah Nusantara
            </h2>
            <p id="profile-player-title" class="text-xs sm:text-sm text-[#FFCA55] font-bold">
              Gelar: Ahli Warisan Minang • Bergabung 2026
            </p>
          </div>

          <!-- Settings & Actions -->
          <div class="flex items-center gap-2 shrink-0">
            <button onclick="RagamaraEcosystem.Settings.openModal()" class="btn btn-secondary text-xs py-2 px-4 flex items-center gap-1.5 shadow">
              <span class="material-symbols-outlined text-[16px]">settings</span>
              <span>Pengaturan</span>
            </button>
            <button onclick="openDailyMissionsModal()" class="btn btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow">
              <span class="material-symbols-outlined text-[16px]">flag</span>
              <span>Misi Harian</span>
            </button>
          </div>
        </div>

        <!-- Frame & Title Customization Row -->
        <div class="mt-4 pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2">
            <span class="text-[#CCC3DF] font-bold">Pilih Bingkai Avatar:</span>
            <button onclick="RagamaraEcosystem.Profile.equipFrame('frame_gold_minang')" class="px-2.5 py-1 rounded-lg bg-[#150E22] border border-[#FFCA55] text-[#FFCA55] font-bold hover:scale-105 transition-all text-[11px]">
              Emas Minang
            </button>
            <button onclick="RagamaraEcosystem.Profile.equipFrame('frame_majapahit')" class="px-2.5 py-1 rounded-lg bg-[#150E22] border border-[#FF786B] text-[#FF786B] font-bold hover:scale-105 transition-all text-[11px]">
              Surya Majapahit
            </button>
            <button onclick="RagamaraEcosystem.Profile.equipFrame('frame_asmat')" class="px-2.5 py-1 rounded-lg bg-[#150E22] border border-[#24CBA2] text-[#24CBA2] font-bold hover:scale-105 transition-all text-[11px]">
              Ukir Asmat
            </button>
          </div>
          
          <div class="flex items-center gap-2">
            <span class="text-[#CCC3DF] font-bold">Gelar:</span>
            <select onchange="RagamaraEcosystem.Profile.setTitle(this.value)" class="bg-[#150E22] border border-[#8B5CF6]/30 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[#FFCA55]">
              <option value="Ahli Warisan Minang">Ahli Warisan Minang</option>
              <option value="Penjaga Adat Nusantara">Penjaga Adat Nusantara</option>
              <option value="Kurator Pusaka Bahari">Kurator Pusaka Bahari</option>
              <option value="Cendekiawan Budaya Luhur">Cendekiawan Budaya Luhur</option>
            </select>
          </div>
        </div>

        <!-- 4 Core Stats -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-center">
          <div class="bg-[#150E22] p-4 rounded-2xl border border-[#8B5CF6]/30 shadow">
            <span class="text-xs text-[#CCC3DF] font-bold">Total XP</span>
            <p class="text-2xl font-black text-[#FFCA55] mt-1" id="profile-xp-val">2.450</p>
          </div>
          <div class="bg-[#150E22] p-4 rounded-2xl border border-[#8B5CF6]/30 shadow">
            <span class="text-xs text-[#CCC3DF] font-bold">Permata Berlian</span>
            <p class="text-2xl font-black text-[#24CBA2] mt-1" id="profile-gem-val">480</p>
          </div>
          <div class="bg-[#150E22] p-4 rounded-2xl border border-[#8B5CF6]/30 shadow">
            <span class="text-xs text-[#CCC3DF] font-bold">Rentetan Nyala</span>
            <p class="text-2xl font-black text-[#FF786B] mt-1">7 Hari 🔥</p>
          </div>
          <div class="bg-[#150E22] p-4 rounded-2xl border border-[#8B5CF6]/30 shadow">
            <span class="text-xs text-[#CCC3DF] font-bold">Pusaka Ditemukan</span>
            <p class="text-2xl font-black text-[#FFF8EB] mt-1">18 Objek</p>
          </div>
        </div>
      </div>

      <!-- Dual Column: Learning Activity Chart & Discovery Timeline -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <!-- Left: Weekly Learning Activity Chart -->
        <div class="lg:col-span-7 bg-[#211B35] p-6 rounded-3xl border border-[#8B5CF6]/25 space-y-4 shadow-xl">
          <div class="flex items-center justify-between pb-3 border-b border-[#8B5CF6]/15">
            <div>
              <h4 class="font-extrabold text-base text-white">Aktivitas Belajar Pekan Ini</h4>
              <p class="text-xs text-[#CCC3DF]">Grafik perolehan XP harian menuju target mingguan.</p>
            </div>
            <span class="px-2.5 py-1 rounded-full bg-[#6338D4]/40 text-xs font-bold text-[#FFCA55]">
              Target: 400 XP (Tercapai!)
            </span>
          </div>

          <!-- Bar Chart Container -->
          <div class="h-44 flex items-end justify-between gap-3 pt-4 px-2">
            <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span class="text-[10px] text-[#CCC3DF] font-mono">40</span>
              <div class="w-full rounded-t-lg bg-[#6338D4]/60 hover:bg-[#6338D4] transition-all" style="height: 45%;"></div>
              <span class="text-[11px] font-bold text-[#CCC3DF]">Sen</span>
            </div>
            <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span class="text-[10px] text-[#CCC3DF] font-mono">60</span>
              <div class="w-full rounded-t-lg bg-[#6338D4]/60 hover:bg-[#6338D4] transition-all" style="height: 65%;"></div>
              <span class="text-[11px] font-bold text-[#CCC3DF]">Sel</span>
            </div>
            <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span class="text-[10px] text-[#CCC3DF] font-mono">50</span>
              <div class="w-full rounded-t-lg bg-[#6338D4]/60 hover:bg-[#6338D4] transition-all" style="height: 55%;"></div>
              <span class="text-[11px] font-bold text-[#CCC3DF]">Rab</span>
            </div>
            <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span class="text-[10px] text-[#CCC3DF] font-mono">75</span>
              <div class="w-full rounded-t-lg bg-[#6338D4]/60 hover:bg-[#6338D4] transition-all" style="height: 80%;"></div>
              <span class="text-[11px] font-bold text-[#CCC3DF]">Kam</span>
            </div>
            <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span class="text-[10px] text-[#CCC3DF] font-mono">55</span>
              <div class="w-full rounded-t-lg bg-[#6338D4]/60 hover:bg-[#6338D4] transition-all" style="height: 60%;"></div>
              <span class="text-[11px] font-bold text-[#CCC3DF]">Jum</span>
            </div>
            <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span class="text-[10px] text-[#CCC3DF] font-mono">90</span>
              <div class="w-full rounded-t-lg bg-[#6338D4]/60 hover:bg-[#6338D4] transition-all" style="height: 95%;"></div>
              <span class="text-[11px] font-bold text-[#CCC3DF]">Sab</span>
            </div>
            <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span class="text-[10px] text-[#FFCA55] font-black font-mono">50</span>
              <div class="w-full rounded-t-lg bg-gradient-to-t from-[#FFCA55] to-[#FF786B] shadow-[0_0_12px_rgba(255,202,85,0.6)]" style="height: 55%;"></div>
              <span class="text-[11px] font-black text-[#FFCA55]">Min</span>
            </div>
          </div>
        </div>

        <!-- Right: Verified Cultural Discovery Timeline -->
        <div class="lg:col-span-5 bg-[#211B35] p-6 rounded-3xl border border-[#8B5CF6]/25 space-y-4 shadow-xl">
          <div class="flex items-center justify-between pb-3 border-b border-[#8B5CF6]/15">
            <h4 class="font-extrabold text-base text-white">Riwayat Penemuan Budaya</h4>
            <span class="text-xs text-[#24CBA2] font-bold">Terverifikasi</span>
          </div>

          <div class="space-y-3">
            <div class="p-3 rounded-xl bg-[#150E22] border border-[#8B5CF6]/20 flex items-center justify-between">
              <div>
                <span class="text-[10px] font-mono text-[#24CBA2]">DAPOBUD: REK/WBTB/2013</span>
                <h5 class="text-xs font-bold text-white">Rencong Meucugek Aceh</h5>
                <p class="text-[10px] text-[#CCC3DF]">Simbol keberanian & kemandirian</p>
              </div>
              <span class="text-[10px] text-[#FFCA55] font-bold">Kemarin</span>
            </div>

            <div class="p-3 rounded-xl bg-[#150E22] border border-[#8B5CF6]/20 flex items-center justify-between">
              <div>
                <span class="text-[10px] font-mono text-[#24CBA2]">DAPOBUD: REK/WBTB/2014</span>
                <h5 class="text-xs font-bold text-white">Arsitektur Rumah Gadang Minang</h5>
                <p class="text-[10px] text-[#CCC3DF]">Gonjong, Rangkiang, & Singkok</p>
              </div>
              <span class="text-[10px] text-[#FFCA55] font-bold">2 Hari Lalu</span>
            </div>

            <div class="p-3 rounded-xl bg-[#150E22] border border-[#8B5CF6]/20 flex items-center justify-between">
              <div>
                <span class="text-[10px] font-mono text-[#24CBA2]">DAPOBUD: REK/WBTB/2015</span>
                <h5 class="text-xs font-bold text-white">Tenun Songket Pandai Sikek</h5>
                <p class="text-[10px] text-[#CCC3DF]">Motif Saik Kalamai & Itik Pulang</p>
              </div>
              <span class="text-[10px] text-[#FFCA55] font-bold">3 Hari Lalu</span>
            </div>
          </div>
        </div>

      </div>

    </div>

  </main>"""

html = old_views_pattern.sub(new_views_content, html)
print("Replaced view-koleksi and view-profil!")

# 3. Add Modals and script tags before </body>
modals_and_scripts = """  <!-- ==========================================================================
       MODALS FOR PHASE 05: CULTUREPEDIA, REGIONS, MASCOTS, LEADERBOARD, MISSIONS, SETTINGS
       ========================================================================== -->

  <!-- 1. CULTUREPEDIA ARTICLE DETAIL MODAL -->
  <div id="culturepedia-detail-modal" class="modal-backdrop">
    <div class="modal-card max-w-4xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto" id="culturepedia-detail-body">
      <!-- Injected by RagamaraEcosystem.Culturepedia.openDetail -->
    </div>
  </div>

  <!-- 2. REGIONAL CULTURAL DOSSIER MODAL -->
  <div id="regional-dossier-modal" class="modal-backdrop">
    <div class="modal-card max-w-4xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto" id="regional-dossier-body">
      <!-- Injected by RagamaraEcosystem.RegionalDossier.open -->
    </div>
  </div>

  <!-- 3. MASCOT DETAIL MODAL -->
  <div id="mascot-detail-modal" class="modal-backdrop">
    <div class="modal-card max-w-lg p-6 sm:p-8" id="mascot-detail-body">
      <!-- Injected by RagamaraEcosystem.MascotCollection.openDetail -->
    </div>
  </div>

  <!-- 4. COMPETITIVE LEADERBOARD MODAL (Reference E inspired) -->
  <div id="leaderboard-modal" class="modal-backdrop">
    <div class="modal-card max-w-xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto space-y-6">
      
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-[#8B5CF6]/20">
        <div>
          <span class="text-[10px] font-black uppercase text-[#FFCA55] tracking-wider">Kompetisi Mingguan</span>
          <h3 class="text-2xl font-black text-white">🏆 Papan Peringkat Garuda</h3>
        </div>
        <button onclick="closeLeaderboardModal()" class="w-8 h-8 rounded-full bg-[#150E22] text-[#CCC3DF] hover:text-white flex items-center justify-center border border-white/10">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <!-- League Tier Notice -->
      <div class="bg-gradient-to-r from-[#6338D4]/30 to-[#2D2445] p-3.5 rounded-2xl border border-[#FFCA55]/30 flex items-center justify-between text-xs">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-2xl text-[#FFCA55]">military_tech</span>
          <div>
            <span class="font-extrabold text-white">Liga Garuda • Divisi I</span>
            <p class="text-[11px] text-[#CCC3DF]">Top 3 promosi ke Liga Kencana. 3 hari tersisa.</p>
          </div>
        </div>
        <span class="px-2.5 py-1 rounded-full bg-[#FFCA55] text-[#382400] text-[10px] font-black uppercase">
          Zona Promosi
        </span>
      </div>

      <!-- Timeframe Tabs -->
      <div class="flex items-center gap-1 bg-[#150E22] p-1 rounded-xl border border-[#8B5CF6]/30">
        <button onclick="RagamaraEcosystem.Leaderboard.switchTab('weekly')" class="leaderboard-tab-btn active-lead-tab flex-1 py-1.5 rounded-lg text-xs font-bold text-center text-white" data-tab="weekly">
          Mingguan
        </button>
        <button onclick="RagamaraEcosystem.Leaderboard.switchTab('monthly')" class="leaderboard-tab-btn flex-1 py-1.5 rounded-lg text-xs font-bold text-center text-[#CCC3DF]" data-tab="monthly">
          Bulanan
        </button>
        <button onclick="RagamaraEcosystem.Leaderboard.switchTab('friends')" class="leaderboard-tab-btn flex-1 py-1.5 rounded-lg text-xs font-bold text-center text-[#CCC3DF]" data-tab="friends">
          Teman
        </button>
      </div>

      <!-- 3-Tier Visual Podium (1st, 2nd, 3rd) -->
      <div class="grid grid-cols-3 gap-2 items-end pt-4 pb-2 text-center">
        <!-- 2nd Place -->
        <div class="flex flex-col items-center">
          <div class="w-14 h-14 rounded-2xl bg-[#94A3B8] p-1 border-2 border-white shadow-lg overflow-hidden relative">
            <img src="assets/images/mascot_raga_avatar.png" alt="2nd" class="w-full h-full object-cover">
            <span class="absolute bottom-0 right-0 px-1 bg-black/70 text-[9px] font-bold text-white rounded">🥈</span>
          </div>
          <p class="text-xs font-bold text-white mt-1.5 truncate max-w-[90px]">Gede Arya</p>
          <span class="text-[10px] text-[#24CBA2] font-extrabold">2.910 XP</span>
          <div class="w-full h-16 podium-pedestal-2 rounded-t-xl mt-2 flex items-center justify-center font-black text-xl text-[#0F172A]">2</div>
        </div>

        <!-- 1st Place (Highest Pedestal) -->
        <div class="flex flex-col items-center">
          <span class="text-2xl animate-bounce">👑</span>
          <div class="w-16 h-16 rounded-2xl bg-[#FFCA55] p-1 border-2 border-white shadow-xl overflow-hidden relative -mt-1">
            <img src="assets/images/mascot_raga_avatar.png" alt="1st" class="w-full h-full object-cover">
            <span class="absolute bottom-0 right-0 px-1 bg-black/70 text-[9px] font-bold text-white rounded">🥇</span>
          </div>
          <p class="text-xs font-bold text-[#FFCA55] mt-1.5 truncate max-w-[100px]">Dewi Gandawati</p>
          <span class="text-[10px] text-[#FFCA55] font-black">3.420 XP</span>
          <div class="w-full h-24 podium-pedestal-1 rounded-t-xl mt-2 flex items-center justify-center font-black text-2xl text-[#382400]">1</div>
        </div>

        <!-- 3rd Place -->
        <div class="flex flex-col items-center">
          <div class="w-14 h-14 rounded-2xl bg-[#F97316] p-1 border-2 border-white shadow-lg overflow-hidden relative">
            <img src="assets/images/mascot_raga_avatar.png" alt="3rd" class="w-full h-full object-cover">
            <span class="absolute bottom-0 right-0 px-1 bg-black/70 text-[9px] font-bold text-white rounded">🥉</span>
          </div>
          <p class="text-xs font-bold text-white mt-1.5 truncate max-w-[90px]">Cut Meutia</p>
          <span class="text-[10px] text-[#24CBA2] font-extrabold">2.740 XP</span>
          <div class="w-full h-12 podium-pedestal-3 rounded-t-xl mt-2 flex items-center justify-center font-black text-lg text-white">3</div>
        </div>
      </div>

      <!-- 4th-10th List -->
      <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
        <div class="p-3 rounded-xl bg-[#2D2445] border-2 border-[#FFCA55] flex items-center justify-between text-xs">
          <div class="flex items-center gap-3">
            <span class="font-black text-sm text-[#FFCA55] w-5 text-center">4</span>
            <div class="w-8 h-8 rounded-full bg-[#6338D4] p-0.5 border border-[#FFCA55] overflow-hidden">
              <img src="assets/images/mascot_raga_avatar.png" class="w-full h-full object-cover">
            </div>
            <div>
              <span class="font-bold text-white">Firza Penjelajah (Anda)</span>
              <span class="text-[10px] text-[#24CBA2] block font-mono">▲ Naik 2 Peringkat</span>
            </div>
          </div>
          <span class="font-black text-[#FFCA55]">2.450 XP</span>
        </div>

        <div class="p-2.5 rounded-xl bg-[#211B35] border border-white/5 flex items-center justify-between text-xs opacity-80">
          <div class="flex items-center gap-3">
            <span class="font-bold text-[#CCC3DF] w-5 text-center">5</span>
            <div class="w-8 h-8 rounded-full bg-[#2D2445] p-0.5 overflow-hidden">
              <img src="assets/images/mascot_raga_avatar.png" class="w-full h-full object-cover">
            </div>
            <div>
              <span class="font-bold text-white">Bagus Setyawan</span>
              <span class="text-[10px] text-[#FF786B] block font-mono">▼ Turun 1 Peringkat</span>
            </div>
          </div>
          <span class="font-bold text-[#CCC3DF]">2.280 XP</span>
        </div>

        <div class="p-2.5 rounded-xl bg-[#211B35] border border-white/5 flex items-center justify-between text-xs opacity-80">
          <div class="flex items-center gap-3">
            <span class="font-bold text-[#CCC3DF] w-5 text-center">6</span>
            <div class="w-8 h-8 rounded-full bg-[#2D2445] p-0.5 overflow-hidden">
              <img src="assets/images/mascot_raga_avatar.png" class="w-full h-full object-cover">
            </div>
            <div>
              <span class="font-bold text-white">Nyoman Triadi</span>
              <span class="text-[10px] text-[#CCC3DF] block font-mono">- Tetap</span>
            </div>
          </div>
          <span class="font-bold text-[#CCC3DF]">2.150 XP</span>
        </div>
      </div>

      <div class="pt-2">
        <button onclick="closeLeaderboardModal()" class="btn btn-secondary w-full text-xs py-2.5">
          Tutup Papan Peringkat
        </button>
      </div>
    </div>
  </div>

  <!-- 5. DAILY MISSIONS CENTER MODAL -->
  <div id="daily-missions-modal" class="modal-backdrop">
    <div class="modal-card max-w-xl p-6 sm:p-8 space-y-6">
      <div class="flex items-center justify-between pb-3 border-b border-[#8B5CF6]/20">
        <div>
          <span class="text-[10px] font-black uppercase text-[#24CBA2] tracking-wider">Tantangan Harian</span>
          <h3 class="text-2xl font-black text-white">🎯 Pusat Misi Penjelajah</h3>
        </div>
        <button onclick="closeDailyMissionsModal()" class="w-8 h-8 rounded-full bg-[#150E22] text-[#CCC3DF] hover:text-white flex items-center justify-center border border-white/10">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <!-- Real Countdown Timer to Midnight -->
      <div class="bg-[#150E22] p-3 rounded-2xl border border-[#8B5CF6]/30 flex items-center justify-between text-xs">
        <div class="flex items-center gap-2 text-[#CCC3DF]">
          <span class="material-symbols-outlined text-[#FF786B] text-[18px]">alarm</span>
          <span>Reset Misi Harian Berikutnya:</span>
        </div>
        <span id="daily-missions-timer" class="font-mono font-black text-[#FFCA55] text-sm">--:--:--</span>
      </div>

      <!-- Dynamic Mission List -->
      <div id="daily-missions-list" class="space-y-3">
        <!-- Rendered by RagamaraEcosystem.DailyMissions.render() -->
      </div>

      <div class="pt-2 flex justify-between items-center border-t border-[#8B5CF6]/20">
        <span class="text-xs text-[#24CBA2] font-semibold">Bonus Sempurna: Peti Emas Terbuka</span>
        <button onclick="closeDailyMissionsModal()" class="btn btn-secondary text-xs py-2 px-6">
          Tutup
        </button>
      </div>
    </div>
  </div>

  <!-- 6. SETTINGS & ACCESSIBILITY MODAL -->
  <div id="settings-modal" class="modal-backdrop">
    <div class="modal-card max-w-lg p-6 sm:p-8 space-y-6">
      <div class="flex items-center justify-between pb-3 border-b border-[#8B5CF6]/20">
        <div>
          <span class="text-[10px] font-black uppercase text-[#8B5CF6] tracking-wider">Preferensi Game</span>
          <h3 class="text-2xl font-black text-white">⚙️ Pengaturan & Aksesibilitas</h3>
        </div>
        <button onclick="RagamaraEcosystem.Settings.closeModal()" class="w-8 h-8 rounded-full bg-[#150E22] text-[#CCC3DF] hover:text-white flex items-center justify-center border border-white/10">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <div class="space-y-4 text-xs">
        <!-- SFX Web Audio Toggle -->
        <div class="flex items-center justify-between p-3.5 rounded-xl bg-[#211B35] border border-[#8B5CF6]/20">
          <div>
            <h5 class="font-bold text-white">Efek Suara Tradisional & SFX</h5>
            <p class="text-[11px] text-[#CCC3DF]">Gamelan, lonceng C-Major, dan nada Saluang</p>
          </div>
          <button id="setting-sfx-toggle" onclick="RagamaraEcosystem.Settings.toggleSfx()" class="btn btn-secondary text-xs py-1.5 px-4">
            Aktif
          </button>
        </div>

        <!-- High Contrast Accessibility Mode -->
        <div class="flex items-center justify-between p-3.5 rounded-xl bg-[#211B35] border border-[#8B5CF6]/20">
          <div>
            <h5 class="font-bold text-white">Mode Kontras Tinggi (A11y)</h5>
            <p class="text-[11px] text-[#CCC3DF]">Tingkatkan kontras warna teks dan kartu</p>
          </div>
          <button onclick="RagamaraEcosystem.Settings.toggleHighContrast()" class="btn btn-secondary text-xs py-1.5 px-4">
            Ubah
          </button>
        </div>

        <!-- Reduced Motion Mode -->
        <div class="flex items-center justify-between p-3.5 rounded-xl bg-[#211B35] border border-[#8B5CF6]/20">
          <div>
            <h5 class="font-bold text-white">Animasi Halus (Reduced Motion)</h5>
            <p class="text-[11px] text-[#CCC3DF]">Minimalkan efek goyangan dan partikel melayang</p>
          </div>
          <button onclick="RagamaraEcosystem.Settings.toggleReducedMotion()" class="btn btn-secondary text-xs py-1.5 px-4">
            Ubah
          </button>
        </div>

        <!-- Daily Target Learning -->
        <div class="p-3.5 rounded-xl bg-[#211B35] border border-[#8B5CF6]/20 space-y-2">
          <div class="flex justify-between">
            <h5 class="font-bold text-white">Target Belajar Harian</h5>
            <span class="text-[#FFCA55] font-bold">20 Menit / Hari</span>
          </div>
          <p class="text-[11px] text-[#CCC3DF]">Menyesuaikan jumlah pengingat dan misi petualangan.</p>
        </div>
      </div>

      <div class="pt-2 flex justify-between items-center border-t border-[#8B5CF6]/20">
        <button onclick="window.showToast('ℹ️ Akun Anda terhubung sebagai Penjelajah Mandiri');" class="text-xs text-[#FF786B] font-bold hover:underline">
          Keluar Sesi
        </button>
        <button onclick="RagamaraEcosystem.Settings.closeModal()" class="btn btn-primary text-xs py-2 px-6">
          Simpan & Tutup
        </button>
      </div>
    </div>
  </div>

  <!-- Cultural Database & Ecosystem Scripts -->
  <script src="js/culture_db_data.js"></script>
  <script src="js/ecosystem.js"></script>

  <script>
    // Sub-tab switcher inside view-koleksi
    function switchKoleksiTab(tab) {
      document.getElementById('koleksi-subview-culturepedia').classList.toggle('hidden', tab !== 'culturepedia');
      document.getElementById('koleksi-subview-maskot').classList.toggle('hidden', tab !== 'maskot');
      document.getElementById('koleksi-subview-prestasi').classList.toggle('hidden', tab !== 'prestasi');

      document.querySelectorAll('.koleksi-subtab').forEach(b => {
        b.classList.remove('bg-[#6338D4]', 'text-white', 'shadow-[0_4px_0_#392071]');
        b.classList.add('text-[#CCC3DF]');
      });

      const activeBtn = document.getElementById(`btn-tab-${tab}`);
      if (activeBtn) {
        activeBtn.classList.add('bg-[#6338D4]', 'text-white', 'shadow-[0_4px_0_#392071]');
        activeBtn.classList.remove('text-[#CCC3DF]');
      }

      if (tab === 'culturepedia') RagamaraEcosystem.Culturepedia.render();
      if (tab === 'prestasi') RagamaraEcosystem.Achievements.render();
    }

    function selectOpkFilter(cat, btn) {
      document.querySelectorAll('.opk-filter-btn').forEach(b => b.classList.remove('active-filter'));
      btn.classList.add('active-filter');
      RagamaraEcosystem.Culturepedia.selectedOpk = cat;
      RagamaraEcosystem.Culturepedia.render();
    }

    function selectRegionFilter(reg, btn) {
      document.querySelectorAll('.region-filter-btn').forEach(b => b.classList.remove('active-filter'));
      btn.classList.add('active-filter');
      RagamaraEcosystem.Culturepedia.selectedRegion = reg;
      RagamaraEcosystem.Culturepedia.render();
    }

    // Modal controllers for Leaderboard & Daily Missions
    function openLeaderboardModal() {
      document.getElementById('leaderboard-modal').classList.add('is-open');
    }
    function closeLeaderboardModal() {
      document.getElementById('leaderboard-modal').classList.remove('is-open');
    }
    function openDailyMissionsModal() {
      document.getElementById('daily-missions-modal').classList.add('is-open');
    }
    function closeDailyMissionsModal() {
      document.getElementById('daily-missions-modal').classList.remove('is-open');
    }

    // Hook DOMContentLoaded to init ecosystem
    window.addEventListener('DOMContentLoaded', () => {
      if (window.RagamaraEcosystem) {
        window.RagamaraEcosystem.init();
      }
    });
  </script>
</body>"""

html = html.replace('</body>', modals_and_scripts)
print("Added modals and scripts!")

app_path.write_text(html, encoding="utf-8")
print("app.html successfully updated for Phase 05!")
