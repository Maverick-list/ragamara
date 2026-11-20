/**
 * NULAR AI House Tour Guide — ContextResolver (js/ai-guide/ContextResolver.js)
 * Resolves the visitor's exact real-time spatial & architectural context:
 * house ID, province, current interior/exterior room, last inspected component, and verified references.
 */

export class ContextResolver {
  constructor(world, houses) {
    this.world = world;
    this.houses = houses;
    this.lastInspectedComponent = null;

    window.addEventListener('nular:component-inspected', (e) => {
      this.lastInspectedComponent = e.detail?.component || null;
    });
    window.addEventListener('nular:world-context', (e) => {
      if (!e.detail?.houseId) this.lastInspectedComponent = null;
    });
  }

  resolve() {
    const snap = this.world?.getContextSnapshot?.() || {
      mode: 'hub',
      houseId: null,
      houseName: 'Alun-Alun Nusantara',
      province: 'Nusantara',
      roomName: 'Alun-Alun Utama Nusantara'
    };

    const house = snap.houseId ? this.houses.find((h) => h.id === snap.houseId) || null : null;
    return {
      mode: snap.mode,
      houseId: house?.id || null,
      house,
      houseName: house?.houseName || 'Alun-Alun Utama Nusantara',
      province: house?.province || '38 Provinsi Indonesia',
      island: house?.island || 'Nusantara',
      roomName: snap.roomName || 'Halaman Eksterior',
      inspectedComponent: this.lastInspectedComponent,
      avatarId: snap.avatarId || 'batik-parang-solo'
    };
  }
}
