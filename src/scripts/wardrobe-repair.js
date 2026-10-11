import * as THREE from 'three';

const boundaries = [0, 6500, 12000, 17500, 24000, 28500, 37000];
const duration = boundaries.at(-1);
const smooth = (v) => { const x = Math.max(0, Math.min(1, v)); return x * x * (3 - 2 * x); };
const palette = ['#82a5a4', '#b3a07c', '#92a99d', '#939cab', '#a296a3'];

class WardrobeRepairAnimation extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready) return;
    this.dataset.ready = 'true';
    this.elapsed = 0; this.previous = 0; this.visible = false;
    this.playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.querySelector('[data-play]').addEventListener('click', () => { this.playing = !this.playing; this.syncButton(); });
    this.querySelectorAll('[data-phase-button]').forEach((button, i) => button.addEventListener('click', () => {
      // Each stop is a readable representative frame; Play continues from it.
      this.elapsed = [4500, 10000, 15700, 21800, 27900, 33700][i];
      this.playing = false; this.syncButton(); if (this.renderer) this.draw();
    }));
    this.observer = new IntersectionObserver((entries) => {
      this.visible = entries[0].isIntersecting;
      if (this.visible && !this.started) { this.started = true; this.initialize(); }
    }, { rootMargin: '100px', threshold: 0 });
    this.observer.observe(this); this.syncButton();
  }
  async initialize() {
    try {
      const response = await fetch(this.dataset.scene);
      if (!response.ok) throw new Error('Geometry unavailable');
      const data = await response.json(); if (!this.isConnected) return;
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color('#f2f6f7');
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.querySelector('[data-canvas]').append(this.renderer.domElement);
      this.camera = new THREE.OrthographicCamera(-1, 1, .72, -.72, .001, 20);
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x84949e, 2.3));
      const light = new THREE.DirectionalLight(0xffffff, 2.2); light.position.set(2, 3, 4); this.scene.add(light);
      this.before = this.makeGroup(data.before); this.after = this.makeGroup(data.after);
      this.source = this.makeGroup([data.source]); this.pieces = this.makeGroup(data.pieces);
      this.after.children.filter(mesh => mesh.userData.role === 'frame').forEach(mesh => {
        mesh.geometry.computeBoundingBox(); const center = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
        mesh.userData.original.set(center.x > .2 ? '#38998c' : center.x < -.2 ? '#4c95a6' : '#c09a59');
      });
      this.pieces.children.forEach((mesh, i) => { mesh.userData.side = data.pieces[i].side; mesh.userData.original.set(['#38998c', '#c09a59', '#4c95a6'][i]); });
      this.cuts = new THREE.Group();
      for (const x of [-.2898018956, .2898018956]) {
        const geometry = new THREE.PlaneGeometry(.34, 1.06);
        const plane = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#c48c38', transparent: true, opacity: .21, side: THREE.DoubleSide, depthWrite: false }));
        plane.rotation.y = Math.PI / 2; plane.position.set(x, 0, -.015);
        const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({color:'#b07c29',transparent:true,opacity:.85})); plane.add(edge); this.cuts.add(plane);
      }
      this.scene.add(this.before, this.after, this.source, this.pieces, this.cuts);
      this.focus = new THREE.Vector3(...data.focus); this.target = new THREE.Vector3();
      this.direction = new THREE.Vector3(.465, .442, .767).normalize();
      this.ring = new THREE.Mesh(new THREE.RingGeometry(.018, .022, 48), new THREE.MeshBasicMaterial({color:'#ca493f',side:THREE.DoubleSide,depthTest:false,transparent:true}));
      this.ring.position.copy(this.focus); this.ring.renderOrder = 10; this.scene.add(this.ring);
      this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(this.querySelector('.replay-stage'));
      this.resize(); this.querySelector('[data-loading]').hidden = true; this.dataset.loaded = 'true'; this.draw();
      this.frame = requestAnimationFrame(this.tick);
    } catch (error) {
      this.querySelector('[data-loading]').textContent = 'The 3D animation could not load. Refresh to try again.';
      this.playing = false; this.syncButton(); console.error(error);
    }
  }
  makeGroup(entries) {
    const group = new THREE.Group();
    entries.forEach((entry, i) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(entry.vertices, 3)); geometry.setIndex(entry.faces); geometry.computeVertexNormals();
      const color = new THREE.Color(palette[i % palette.length]);
      const material = new THREE.MeshStandardMaterial({color, roughness:.75, metalness:.05, side:THREE.DoubleSide, transparent:true});
      const mesh = new THREE.Mesh(geometry, material); mesh.userData = {role:entry.role, original:color.clone()};
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), new THREE.LineBasicMaterial({color:'#516975',transparent:true,opacity:.2})); mesh.add(edges); group.add(mesh);
    }); return group;
  }
  paint(group, opacity, highlight = 0, context = 1) {
    group.visible = opacity > .001;
    if (!group.visible) return;
    group.children.forEach(mesh => {
      const selected = mesh.userData.role === 'frame' || mesh.userData.role === 'door';
      mesh.material.color.copy(mesh.userData.original);
      if (selected) mesh.material.color.lerp(new THREE.Color('#cd4b43'), highlight);
      mesh.material.opacity = opacity * (selected ? 1 : context);
      mesh.material.depthWrite = mesh.material.opacity > .5;
      mesh.children[0].material.opacity = Math.min(.24, mesh.material.opacity * .3);
    });
  }
  resize() {
    const bounds = this.querySelector('.replay-stage').getBoundingClientRect();
    this.renderer.setSize(bounds.width, bounds.height, false);
    const aspect = bounds.width / bounds.height;
    const half = Math.max(bounds.width < 640 ? .86 : .74, .56 / aspect);
    this.camera.left = -half * aspect; this.camera.right = half * aspect;
    this.camera.top = half; this.camera.bottom = -half; this.camera.updateProjectionMatrix();
    this.draw();
  }
  syncButton() {
    const button = this.querySelector('[data-play]'); button.textContent = this.playing ? 'Pause' : 'Play'; button.setAttribute('aria-label', `${this.playing ? 'Pause' : 'Play'} repair animation`);
  }
  tick = (now) => {
    const delta = this.previous ? Math.min(now - this.previous, 100) : 0; this.previous = now;
    if (this.playing && this.visible && !document.hidden) { this.elapsed = (this.elapsed + delta) % duration; this.draw(); }
    this.frame = requestAnimationFrame(this.tick);
  };
  draw() {
    if (!this.renderer) return;
    const t = this.elapsed;
    let phase = 0; while (phase < 5 && t >= boundaries[phase + 1]) phase++;
    const p = (t - boundaries[phase]) / (boundaries[phase + 1] - boundaries[phase]);
    let before = 1, after = 0, source = 0, pieces = 0, context = 1, highlight = 0, cuts = 0, split = 0, zoom = 1, focus = 0, detail = 0;
    if (phase === 0) highlight = smooth((p - .25) / .4);
    if (phase === 1) { highlight = 1; zoom = 1 + 3 * smooth(p / .45); focus = smooth(p / .45); detail = smooth((p - .42) / .23); }
    if (phase === 2) {
      const back = smooth(p / .32); zoom = 4 - 3 * back; focus = 1 - back; detail = 1 - back;
      context = 1 - .96 * smooth((p - .2) / .35); highlight = 1 - back;
      source = smooth((p - .32) / .2); cuts = smooth((p - .55) / .25);
    }
    if (phase === 3) {
      zoom = 1 - .08 * smooth(p / .15); context = .04;
      source = p < .12 ? 1 : 0; pieces = p >= .12 ? 1 : 0;
      cuts = 1 - smooth((p - .13) / .15);
      split = smooth((p - .15) / .45);
    }
    if (phase === 4) {
      zoom = .92 + .08 * smooth(p / .75); context = .04;
      split = 1 - smooth(p / .45);
      after = smooth((p - .45) / .5); before = 1 - after;
      // Keep the rebuilt frame in place while the complete repaired proxy returns.
      pieces = p < .95 ? 1 : 0;
    }
    if (phase === 5) {
      before = 0; after = 1;
      const into = smooth((p - .16) / .16), out = smooth((p - .69) / .16);
      zoom = 1 + 3 * into * (1-out); focus = into * (1-out);
      detail = smooth((p - .31) / .1) * (1-smooth((p - .65) / .12));
    }
    this.paint(this.before, before, highlight, context); this.paint(this.after, after);
    // During planning/splitting, fade both the old frame proxy and door with the rest of the object.
    if (phase === 2 || phase === 3 || phase === 4) {
      this.before.children.forEach(mesh => {
        if (mesh.userData.role !== 'context') { const alpha = before * (phase === 2 ? 1 - source * .96 : .04); mesh.material.opacity = alpha; mesh.material.depthWrite = false; mesh.children[0].material.opacity = alpha * .2; }
      });
    }
    this.paint(this.source, source); this.paint(this.pieces, pieces);
    if (phase === 4 && pieces) this.after.children.filter(mesh => mesh.userData.role === 'frame').forEach(mesh => {mesh.material.opacity = 0; mesh.material.depthWrite = false; mesh.children[0].material.opacity = 0;});
    this.source.children.forEach(mesh => mesh.material.color.set('#6f999f'));
    this.pieces.children.forEach(mesh => { mesh.position.set(mesh.userData.side === 'left' ? -.12*split : mesh.userData.side === 'right' ? .12*split : 0, mesh.userData.side === 'base' ? -.1*split : 0, 0); });
    this.cuts.visible = cuts > .001; this.cuts.children.forEach(plane => { plane.scale.y = Math.max(.001, cuts); plane.material.opacity = .21*cuts; plane.children[0].material.opacity = .85*cuts; });
    this.target.copy(this.focus).multiplyScalar(focus); this.camera.position.copy(this.target).addScaledVector(this.direction, 3); this.camera.lookAt(this.target); this.camera.zoom = zoom; this.camera.updateProjectionMatrix();
    this.ring.visible = (phase === 0 && p > .6) || phase === 1 || phase === 5;
    this.ring.material.color.set(phase === 5 ? '#298d83' : '#ca493f'); this.ring.quaternion.copy(this.camera.quaternion);
    // One opaque scene at a time. Fade through the shared background instead of
    // alpha-blending SVG and WebGL, which exposes the hidden geometry underneath.
    const showDetail = detail >= .5;
    this.querySelector('[data-detail]').style.visibility = showDetail ? 'visible' : 'hidden';
    this.querySelector('[data-detail]').setAttribute('aria-hidden', String(!showDetail));
    this.querySelector('[data-canvas]').style.visibility = showDetail ? 'hidden' : 'visible';
    this.querySelector('[data-canvas]').setAttribute('aria-hidden', String(showDetail));
    this.querySelector('[data-scene-cover]').style.opacity = String(1 - Math.abs(2*detail - 1));
    this.dataset.sceneMode = showDetail ? 'section' : '3d';
    this.querySelector('[data-before-section]').setAttribute('opacity', phase === 5 ? '0' : '1');
    this.querySelector('[data-after-section]').setAttribute('opacity', phase === 5 ? '1' : '0');
    this.querySelector('[data-collision-label]').setAttribute('opacity', phase === 5 ? '0' : '1');
    this.querySelector('[data-progress]').style.width = `${t / duration * 100}%`;
    const notes = [
      'The cabinet frame and right-door collision proxies intersect.',
      'Red overlap · the proxy intrudes into the door clearance.',
      'Keep the source material. Separate the U-shaped frame.',
      'Keep the source material. Separate the U-shaped frame.',
      'New frame hulls → complete repaired collision proxy.',
      'Clearance restored at the diagnosed region.',
    ];
    this.querySelector('[data-note-text]').textContent = phase === 0 && p < .25
      ? 'Full wardrobe · before the local frame repair' : notes[phase];
    this.dataset.phase = String(phase);
    this.querySelectorAll('[data-phase-button]').forEach((button, i) => button.setAttribute('aria-pressed', String(i === phase)));
    this.renderer.render(this.scene, this.camera);
  }
  disconnectedCallback() {
    cancelAnimationFrame(this.frame); this.observer?.disconnect(); this.resizeObserver?.disconnect();
    this.scene?.traverse(object => { object.geometry?.dispose(); if (object.material) object.material.dispose(); });
    this.renderer?.dispose();
  }
}
if (!customElements.get('wardrobe-repair-animation')) customElements.define('wardrobe-repair-animation', WardrobeRepairAnimation);
