import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import gsap from 'gsap'
import type { Tokens } from '../lib/tokens'
import { drawCard, paperGrain, sealBump, softShadow } from './textures'

// Dimensions de l'enveloppe (unités de scène)
const W = 3.2
const H = 1.9
const TIP = H / 2 + 0.15 // le rabat descend un peu sous le centre
const SEAL_R = 0.3
const FOV = 35
const FLY_DIST = 3.2 // distance caméra → lettre une fois en grand

type Phase = 'intro' | 'closed' | 'opening' | 'open' | 'closing'

export interface SceneCallbacks {
  /** Clic sur l'enveloppe ; `onSeal` indique si le sceau lui-même a été touché. */
  onEnvelopeClick: (x: number, y: number, onSeal: boolean) => void
  onHover: (on: boolean) => void
  onContextLost: () => void
  getCard: () => HTMLElement | null
}

// Contour irrégulier d'une goutte de cire
const waxRadius = (a: number) =>
  SEAL_R * (1 + 0.05 * Math.sin(5 * a + 0.3) + 0.035 * Math.sin(11 * a + 1.7))

// Ligne de fissure, de haut en bas, qui sépare le sceau en deux moitiés
function crackLine() {
  const top = waxRadius(Math.PI / 2)
  const bottom = waxRadius(-Math.PI / 2)
  const jitter = [0, 0.09, -0.06, 0.1, -0.04, 0.07, -0.05, 0]
  return jitter.map((j, i) => {
    const t = i / (jitter.length - 1)
    return new THREE.Vector2(j * SEAL_R, top - t * (top + bottom))
  })
}

function sealHalf(side: 'left' | 'right') {
  const shape = new THREE.Shape()
  const crack = crackLine()
  const steps = 40
  if (side === 'left') {
    for (let i = 0; i <= steps; i++) {
      const a = Math.PI / 2 + (i / steps) * Math.PI
      const r = waxRadius(a)
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      if (i === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    }
    for (let i = crack.length - 2; i >= 0; i--) shape.lineTo(crack[i].x, crack[i].y)
  } else {
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + (i / steps) * Math.PI
      const r = waxRadius(a)
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      if (i === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    }
    for (let i = 1; i < crack.length; i++) shape.lineTo(crack[i].x, crack[i].y)
  }
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 4,
    curveSegments: 8,
  })
}

function triangle(points: [number, number][]) {
  const s = new THREE.Shape()
  s.moveTo(...points[0])
  for (const p of points.slice(1)) s.lineTo(...p)
  s.closePath()
  return new THREE.ShapeGeometry(s)
}

function topFlapGeometry() {
  const s = new THREE.Shape()
  s.moveTo(-W / 2, 0)
  s.lineTo(W / 2, 0)
  s.lineTo(0.16, -TIP + 0.08)
  s.quadraticCurveTo(0, -TIP - 0.02, -0.16, -TIP + 0.08)
  s.closePath()
  return new THREE.ShapeGeometry(s, 16)
}

export class EnvelopeScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60)
  private rig = new THREE.Group() // parallaxe, flottement, entrée
  private env = new THREE.Group() // l'enveloppe
  private flapPivot = new THREE.Group()
  private sealAnchor = new THREE.Object3D()
  private seal = new THREE.Group()
  private halves: THREE.Mesh[] = []
  // Lettre pliée en deux : panneau haut + panneau bas articulé sur le pli.
  private letter = new THREE.Group()
  private foldPivot = new THREE.Group()
  private letterParts: THREE.Mesh[] = []
  private paperTop!: THREE.MeshBasicMaterial
  private paperBottom!: THREE.MeshBasicMaterial
  private paperBack!: THREE.MeshBasicMaterial
  private cardTex!: THREE.CanvasTexture
  private sheet = { aspect: 0.85, rect: new DOMRect(0, 0, 500, 590), s0: 1, foldY: 0, slideMax: 1 }
  private dim!: THREE.Mesh
  private hideTimer: gsap.core.Tween | null = null
  private shadow!: THREE.Mesh
  private hitTargets: THREE.Object3D[] = []

  private phase: Phase = 'intro'
  private raf = 0
  private t0 = performance.now()
  private pointer = new THREE.Vector2()
  private pointerSmooth = new THREE.Vector2()
  private raycaster = new THREE.Raycaster()
  private hovered = false
  private peek = 0
  private timeline: gsap.core.Timeline | null = null
  private disposables: { dispose: () => void }[] = []
  private resizeTimer = 0

  // Tout ce que les timelines animent : la boucle de rendu lit ces valeurs à chaque image.
  private st = {
    intro: 0,
    flap: 0,
    flapZ: 0.022,
    crack: 0,
    sealOpacity: 1,
    slide: 0,
    fly: 0,
    unfold: 0,
    letterOpacity: 1,
  }

  private canvas: HTMLCanvasElement
  private tokens: Tokens
  private reducedMotion: boolean
  private cb: SceneCallbacks

  constructor(canvas: HTMLCanvasElement, tokens: Tokens, reducedMotion: boolean, cb: SceneCallbacks) {
    this.canvas = canvas
    this.tokens = tokens
    this.reducedMotion = reducedMotion
    this.cb = cb
    const lowPower =
      (navigator.hardwareConcurrency ?? 8) <= 4 || Math.min(window.innerWidth, window.innerHeight) < 600

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = !lowPower
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
  }

  async init() {
    const t = this.tokens
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environment = envTex
    this.scene.environmentIntensity = 0.32
    pmrem.dispose()
    this.disposables.push(envTex)

    // Lumières : clé chaude en haut à gauche, contour rosé derrière, remplissage faible.
    this.scene.add(new THREE.HemisphereLight(0xfff1e2, 0x140b0d, 0.45))
    const key = new THREE.DirectionalLight(0xffe4c8, 2.6)
    key.position.set(-2.6, 3.4, 5)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.left = -3
    key.shadow.camera.right = 3
    key.shadow.camera.top = 3
    key.shadow.camera.bottom = -3
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.01
    key.shadow.radius = 6
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0xe8a0ae, 1.8)
    rim.position.set(3, 2.5, -3)
    this.scene.add(rim)
    const fill = new THREE.PointLight(0xc0707e, 0.6, 12)
    fill.position.set(2.5, -1.5, 3)
    this.scene.add(fill)

    const grain = paperGrain()
    this.disposables.push(grain)
    const paper = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0, bumpMap: grain, bumpScale: 0.6, ...extra })
      this.disposables.push(m)
      return m
    }

    // Dos de l'enveloppe : la face avant de la boîte est l'intérieur, doublé de rose sombre.
    const side = paper(t.envelopeShade)
    const inside = paper('#4a1d27', { roughness: 0.7 })
    const backGeo = new THREE.BoxGeometry(W, H, 0.025)
    backGeo.translate(0, 0, -0.0125)
    const back = new THREE.Mesh(backGeo, [side, side, side, side, inside, side])
    back.receiveShadow = true

    // Lettre (dans la scène, pas dans l'enveloppe : sa pose est interpolée entre l'enveloppe et la carte HTML).
    // Matériaux non éclairés et sans tone mapping : une fois en grand, ses pixels sont ceux de la carte.
    this.cardTex = new THREE.CanvasTexture(document.createElement('canvas'))
    this.cardTex.colorSpace = THREE.SRGBColorSpace
    this.cardTex.anisotropy = 4
    const sheetMat = (side: THREE.Side, map: THREE.Texture | null) =>
      new THREE.MeshBasicMaterial({ map, side, toneMapped: false, transparent: true, color: map ? 0xffffff : t.paper })
    this.paperTop = sheetMat(THREE.FrontSide, this.cardTex)
    this.paperBottom = sheetMat(THREE.FrontSide, this.cardTex)
    this.paperBack = sheetMat(THREE.BackSide, null)
    this.disposables.push(this.cardTex, this.paperTop, this.paperBottom, this.paperBack)
    this.letter.add(this.foldPivot)
    try {
      await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2000))])
    } catch {
      /* polices de repli */
    }
    this.prepareLetter()

    // Voile sombre entre l'enveloppe et la lettre quand elle vient en grand
    const dimMat = new THREE.MeshBasicMaterial({ color: t.night, transparent: true, opacity: 0, depthTest: false, depthWrite: false })
    this.dim = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), dimMat)
    this.dim.position.z = -0.5
    this.dim.renderOrder = 10
    this.camera.add(this.dim)
    this.disposables.push(dimMat, this.dim.geometry)

    // Rabats de la poche
    const left = new THREE.Mesh(triangle([[-W / 2, H / 2], [-W / 2, -H / 2], [0.02, -0.04]]), paper(t.envelopeShade))
    left.position.z = 0.01
    const right = new THREE.Mesh(triangle([[W / 2, H / 2], [0.02 * -1, -0.04], [W / 2, -H / 2]]), paper(t.envelope))
    right.position.z = 0.012
    const bottom = new THREE.Mesh(triangle([[-W / 2, -H / 2], [W / 2, -H / 2], [0, 0.12]]), paper('#242021'))
    bottom.position.z = 0.016
    for (const m of [left, right, bottom]) {
      m.castShadow = true
      m.receiveShadow = true
    }

    // Rabat supérieur : extérieur anthracite, doublure rose visible une fois ouvert.
    const flapGeo = topFlapGeometry()
    const flapOut = new THREE.Mesh(flapGeo, paper('#302a2b'))
    flapOut.castShadow = true
    flapOut.receiveShadow = true
    const flapIn = new THREE.Mesh(flapGeo, paper(t.lining, { side: THREE.BackSide, roughness: 0.65 }))
    this.flapPivot.position.set(0, H / 2, this.st.flapZ)
    this.flapPivot.add(flapOut, flapIn)
    this.sealAnchor.position.set(0, -TIP + SEAL_R + 0.02, 0.004)
    this.flapPivot.add(this.sealAnchor)

    // Sceau de cire en deux moitiés jointes, avec l'empreinte d'un cœur.
    const bump = sealBump(SEAL_R)
    const wax = new THREE.MeshPhysicalMaterial({
      color: t.wax,
      roughness: 0.42,
      clearcoat: 0.35,
      clearcoatRoughness: 0.35,
      envMapIntensity: 0.6,
      bumpMap: bump,
      bumpScale: 2.5,
      transparent: true,
    })
    this.disposables.push(bump, wax)
    for (const s of ['left', 'right'] as const) {
      const g = sealHalf(s)
      this.disposables.push(g)
      const half = new THREE.Mesh(g, wax)
      half.castShadow = true
      this.halves.push(half)
      this.seal.add(half)
    }
    this.seal.scale.z = 0.55

    this.env.add(back, left, right, bottom, this.flapPivot, this.seal)
    this.env.rotation.x = -0.08
    this.hitTargets = [back, left, right, bottom, flapOut, ...this.halves]

    // Ombre douce sur le "mur" derrière
    const shadowTex = softShadow()
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.85 })
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.9, H * 2.2), shadowMat)
    this.shadow.position.set(0.25, -0.35, -0.9)
    this.disposables.push(shadowTex, shadowMat, this.shadow.geometry)

    this.rig.add(this.env, this.shadow)
    this.scene.add(this.rig, this.letter, this.camera)

    this.resize()
    this.bind()
    this.renderer.compile(this.scene, this.camera)
    this.start()
  }

  // Entrée : le chargement se transforme en arrivée de l'enveloppe.
  playIntro() {
    if (this.reducedMotion) {
      this.st.intro = 1
      this.phase = 'closed'
      return
    }
    gsap.to(this.st, {
      intro: 1,
      duration: 1.8,
      ease: 'expo.out',
      onComplete: () => {
        this.phase = 'closed'
      },
    })
  }

  // Mesure la carte HTML et reconstruit la lettre 3D à son image (proportions, texture).
  private prepareLetter() {
    const card = this.cb.getCard()
    if (!card) return
    const { aspect, rect } = drawCard(card, this.tokens, this.cardTex.image as HTMLCanvasElement)
    this.cardTex.needsUpdate = true
    const L = 1 / aspect
    const s0 = Math.min(W * 0.88, (H * 0.84) / (L / 2))
    const foldY = -0.02 - (s0 * L) / 4
    this.sheet = { aspect, rect, s0, foldY, slideMax: 0.32 - foldY }

    for (const m of this.letterParts) {
      m.removeFromParent()
      m.geometry.dispose()
    }
    const panel = (top: boolean) => {
      const g = new THREE.PlaneGeometry(1, L / 2)
      g.translate(0, top ? L / 4 : -L / 4, 0)
      const uv = g.attributes.uv
      for (let i = 0; i < uv.count; i++) uv.setY(i, top ? 0.5 + uv.getY(i) / 2 : uv.getY(i) / 2)
      return g
    }
    const topGeo = panel(true)
    const bottomGeo = panel(false)
    const parts = [
      new THREE.Mesh(topGeo, this.paperTop),
      new THREE.Mesh(topGeo, this.paperBack),
      new THREE.Mesh(bottomGeo, this.paperBottom),
      new THREE.Mesh(bottomGeo, this.paperBack),
    ]
    parts[0].renderOrder = parts[1].renderOrder = 12
    parts[2].renderOrder = parts[3].renderOrder = 11
    this.letter.add(parts[0], parts[1])
    this.foldPivot.add(parts[2], parts[3])
    this.letterParts = parts
  }

  open(onReveal: () => void) {
    return new Promise<void>((resolve) => {
      if (this.phase !== 'closed') return resolve()
      this.phase = 'opening'
      this.hover(false)
      this.prepareLetter()
      const st = this.st
      st.flap = -this.peek
      st.letterOpacity = 1

      const reveal = () => {
        onReveal()
        // La carte HTML (identique) recouvre la lettre 3D : on masque celle-ci une fois le fondu fini.
        this.hideTimer = gsap.delayedCall(0.35, () => {
          st.letterOpacity = 0
        })
      }

      if (this.reducedMotion) {
        Object.assign(st, { flap: -Math.PI, flapZ: -0.03, crack: 1, sealOpacity: 0, slide: 1, fly: 1, unfold: 1 })
        this.phase = 'open'
        reveal()
        return resolve()
      }

      const tl = gsap.timeline({
        onComplete: () => {
          this.phase = 'open'
          resolve()
        },
      })
      this.timeline = tl
      tl.to(st, { crack: 0.04, duration: 0.12, ease: 'power2.in' })
        .to(st, { crack: 1, duration: 1.0, ease: 'power2.in' })
        .to(st, { sealOpacity: 0, duration: 0.35, ease: 'power1.in' }, '-=0.35')
        .to(st, { flap: -Math.PI, duration: 1.1, ease: 'power3.inOut' }, 0.3)
        .to(st, { flapZ: -0.03, duration: 0.2, ease: 'none' }, 1.1)
        .to(st, { slide: 1, duration: 0.95, ease: 'power2.inOut' }, 1.15)
        .to(st, { fly: 1, duration: 1.35, ease: 'power3.inOut' }, 1.95)
        .to(st, { unfold: 1, duration: 0.95, ease: 'power2.inOut' }, 2.25)
        // Les callbacks GSAP se déclenchent aussi en lecture inverse : ne révéler qu'à l'aller.
        .call(() => void (tl.reversed() || reveal()), [], 3.3)
    })
  }

  // Fermeture : la lettre 3D reprend la place de la carte, puis tout le film se rejoue à l'envers.
  close(hideCard: () => void) {
    return new Promise<void>((resolve) => {
      if (this.phase !== 'open') return resolve()
      this.phase = 'closing'
      this.hideTimer?.kill()
      this.prepareLetter()
      this.st.letterOpacity = 1
      hideCard()
      const done = () => {
        this.phase = 'closed'
        resolve()
      }
      if (this.reducedMotion || !this.timeline) {
        Object.assign(this.st, { flap: 0, flapZ: 0.022, crack: 0, sealOpacity: 1, slide: 0, fly: 0, unfold: 0 })
        this.timeline = null
        return done()
      }
      const tl = this.timeline
      tl.eventCallback('onReverseComplete', done)
      gsap.delayedCall(0.3, () => void tl.timeScale(1.2).reverse())
    })
  }

  private bind() {
    window.addEventListener('resize', this.onResize)
    window.addEventListener('pointermove', this.onPointerMove, { passive: true })
    this.canvas.addEventListener('click', this.onClick)
    this.canvas.addEventListener('webglcontextlost', this.onContextLost)
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  private onResize = () => {
    clearTimeout(this.resizeTimer)
    this.resizeTimer = window.setTimeout(() => this.resize(), 100)
  }

  private resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    const aspect = w / h
    this.renderer.setSize(w, h, false)
    this.camera.aspect = aspect
    // Cadrage : l'enveloppe occupe ~48 % de la largeur sur bureau, ~84 % en portrait.
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    const fracW = aspect < 1 ? 0.84 : 0.48
    const dW = W / fracW / aspect / (2 * tan)
    const dH = H / 0.5 / (2 * tan)
    const d = Math.max(dW, dH)
    this.camera.position.set(0, d * 0.11, d)
    this.camera.lookAt(0, -0.05, 0)
    this.camera.updateProjectionMatrix()
    if (this.letterParts.length && this.phase !== 'open') this.prepareLetter()
  }

  private onPointerMove = (e: PointerEvent) => {
    this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
    if (this.phase !== 'closed' || e.pointerType === 'touch') return
    this.hover(this.hitTest())
  }

  private hitTest() {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    return this.raycaster.intersectObjects(this.hitTargets, false).length > 0
  }

  private hitSeal() {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    return this.raycaster.intersectObjects(this.halves, false).length > 0
  }

  private hover(on: boolean) {
    if (on !== this.hovered) this.cb.onHover(on)
    this.hovered = on
    this.canvas.style.cursor = on ? 'pointer' : ''
  }

  /** Centre du sceau en pixels écran (pour y amener le marteau). */
  sealScreenPosition() {
    this.seal.getWorldPosition(this.tmpV)
    this.tmpV.z += 0.04
    this.tmpV.project(this.camera)
    return {
      x: ((this.tmpV.x + 1) / 2) * window.innerWidth,
      y: ((1 - this.tmpV.y) / 2) * window.innerHeight,
    }
  }

  /** Petit tressaillement de l'enveloppe au coup de marteau. */
  impact() {
    if (this.reducedMotion) return
    gsap.fromTo(this.env.position, { z: -0.06 }, { z: 0, duration: 0.45, ease: 'elastic.out(1, 0.4)' })
  }

  private onClick = (e: MouseEvent) => {
    if (this.phase !== 'closed') return
    this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
    if (this.hitTest()) this.cb.onEnvelopeClick(e.clientX, e.clientY, this.hitSeal())
  }

  private onContextLost = (e: Event) => {
    e.preventDefault()
    this.stop()
    this.cb.onContextLost()
  }

  private onVisibility = () => {
    if (document.hidden) this.stop()
    else this.start()
  }

  private start() {
    if (this.raf) return
    const loop = () => {
      this.raf = requestAnimationFrame(loop)
      this.update()
      this.renderer.render(this.scene, this.camera)
    }
    this.raf = requestAnimationFrame(loop)
  }

  private stop() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  private tmpV = new THREE.Vector3()
  private tmpQ = new THREE.Quaternion()
  private camQ = new THREE.Quaternion()
  private camP = new THREE.Vector3()

  private update() {
    const st = this.st
    const time = (performance.now() - this.t0) / 1000
    const motion = this.reducedMotion ? 0 : 1

    // Parallaxe lissée (inertie) ; elle s'efface pendant que la lettre vient vers le lecteur.
    this.pointerSmooth.lerp(this.pointer, 0.06)
    const calm = 1 - st.fly
    const intro = st.intro
    this.rig.rotation.y = this.pointerSmooth.x * 0.16 * motion * calm
    this.rig.rotation.x = (-this.pointerSmooth.y * 0.08 * calm + (1 - intro) * 0.6) * motion
    this.rig.rotation.z = Math.sin(time * 0.6) * 0.012 * motion * calm
    this.rig.position.y = (Math.sin(time * 0.9) * 0.04 * calm - (1 - intro) * 0.9 - st.fly * 0.35) * motion
    this.rig.scale.setScalar(0.85 + 0.15 * intro)

    // Rabat : il se soulève un peu au survol tant que l'enveloppe est fermée.
    const peekTarget = this.hovered && this.phase === 'closed' ? 0.3 : 0
    this.peek += (peekTarget - this.peek) * 0.12
    const flapAngle = this.phase === 'closed' || this.phase === 'intro' ? -this.peek : st.flap
    this.flapPivot.rotation.x = flapAngle
    this.flapPivot.position.z = st.flapZ

    // Le sceau suit le rabat tant qu'il est intact, puis ses moitiés tombent.
    if (this.phase === 'closed' || this.phase === 'intro') {
      this.env.updateMatrixWorld(true)
      this.sealAnchor.getWorldPosition(this.tmpV)
      this.seal.position.copy(this.env.worldToLocal(this.tmpV))
      this.seal.rotation.x = flapAngle
    }
    const c = st.crack
    this.halves.forEach((h, i) => {
      const s = i === 0 ? -1 : 1
      h.position.set(s * c * 0.55, -1.4 * c * c, 0.7 * c / this.seal.scale.z)
      h.rotation.set(c * 0.5, s * c * 0.7, s * c * 0.9)
      h.castShadow = c < 0.05 // pas de taches d'ombre pendant la chute
    })
    ;(this.halves[0].material as THREE.MeshPhysicalMaterial).opacity = st.sealOpacity
    this.seal.visible = st.sealOpacity > 0.01

    // Lettre : pose interpolée entre "dans l'enveloppe" et "à la place exacte de la carte HTML".
    const sh = this.sheet
    const L = 1 / sh.aspect
    this.rig.updateMatrixWorld(true)
    this.tmpV.set(0, sh.foldY + st.slide * sh.slideMax, 0.004)
    this.env.localToWorld(this.tmpV)
    this.env.getWorldQuaternion(this.tmpQ)

    const vw = window.innerWidth
    const vh = window.innerHeight
    const pxPerUnit = vh / (2 * FLY_DIST * Math.tan(THREE.MathUtils.degToRad(FOV / 2)))
    const s1 = sh.rect.height / pxPerUnit / L
    const cx = sh.rect.left + sh.rect.width / 2
    const cy = sh.rect.top + sh.rect.height / 2
    this.camera.updateMatrixWorld()
    this.camP.set((cx - vw / 2) / pxPerUnit, -(cy - vh / 2) / pxPerUnit, -FLY_DIST)
    this.camera.localToWorld(this.camP)
    this.camQ.copy(this.camera.quaternion)

    const f = st.fly
    const arc = Math.sin(f * Math.PI)
    this.letter.position.lerpVectors(this.tmpV, this.camP, f)
    this.letter.position.y += arc * 0.35
    this.letter.quaternion.slerpQuaternions(this.tmpQ, this.camQ, f)
    this.letter.rotateZ(arc * -0.1)
    this.letter.rotateX(arc * 0.18)
    this.letter.scale.setScalar(THREE.MathUtils.lerp(sh.s0, s1, f))

    // Dépliage : le panneau bas pivote depuis l'arrière du panneau haut.
    const u = st.unfold
    const theta = Math.PI * (1 - u)
    this.foldPivot.rotation.x = theta
    this.foldPivot.position.z = -0.004 * (1 - u)

    // Lumière simulée : papier dans l'ombre de l'enveloppe, pleine lumière une fois en grand.
    const light = THREE.MathUtils.lerp(0.62, 1, Math.min(1, f * 1.15))
    this.paperTop.color.setScalar(light)
    this.paperBottom.color.setScalar(light * (0.62 + 0.38 * Math.max(0, Math.cos(theta))))
    this.paperBack.color.set(this.tokens.paper).multiplyScalar(light * 0.8)
    const outside = f > 0.001
    for (const m of [this.paperTop, this.paperBottom, this.paperBack]) {
      m.opacity = st.letterOpacity
      m.depthTest = !outside
    }
    this.letter.visible = st.letterOpacity > 0.01
    ;(this.dim.material as THREE.MeshBasicMaterial).opacity = 0.62 * f

    ;(this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.85 * intro * (1 - f * 0.7)
  }

  dispose() {
    this.stop()
    this.timeline?.kill()
    this.hideTimer?.kill()
    gsap.killTweensOf(this.st)
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('click', this.onClick)
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose()
    })
    this.disposables.forEach((d) => d.dispose())
    this.renderer.dispose()
  }
}
