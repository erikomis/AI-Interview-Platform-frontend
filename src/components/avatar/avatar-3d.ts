import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import type { Viseme, VisemeKey } from '@/utils/lipsync'

export type AvatarMode = 'idle' | 'listening' | 'thinking' | 'speaking'

export interface AvatarModel {
  url: string
  /** FBX exports reference .tga textures; they are served next to the model as .jpg (+ .png for alpha maps) */
  textureDir?: string
  /** Unit conversion to metres (FBX from 3ds Max is in centimetres) */
  scale?: number
  bones: { head: string; neck?: string; spine?: string }
  /**
   * World-space rotations (radians, XYZ) that bring the arms down from the
   * rig's T/A-pose. World axes keep this independent of each rig's bone rolls.
   */
  pose: Record<string, [x: number, y: number, z: number]>
  /** Blend-shape values that are always on (e.g. a hint of a smile) */
  baseline?: Record<string, number>
  /** Camera distance from the face, in metres */
  distance?: number
}

/** Speech currently playing: its clock (seconds) and an optional viseme timeline. */
export interface SpeechSource {
  time: number
  track: VisemeKey[] | null
}

const VISEMES: Viseme[] = ['aa', 'E', 'I', 'O', 'U', 'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR']

/** How far each viseme is driven — wide shapes (E, I) look exaggerated at full strength. */
const VISEME_GAIN: Record<Viseme, number> = {
  aa: 0.7, O: 0.65, U: 0.6, E: 0.5, I: 0.45,
  PP: 0.85, FF: 0.6, TH: 0.45, DD: 0.45, kk: 0.45, CH: 0.55, SS: 0.45, nn: 0.4, RR: 0.45,
}
const VISEME_JAW: Partial<Record<Viseme, number>> = { aa: 0.22, O: 0.16, E: 0.1, U: 0.08, I: 0.06 }

const MANAGED_SHAPES = [
  ...VISEMES.map((v) => `viseme_${v}`),
  'jawOpen', 'mouthClose',
  'eyeBlinkLeft', 'eyeBlinkRight', 'eyeSquintLeft', 'eyeSquintRight',
  'eyeLookUpLeft', 'eyeLookUpRight', 'eyeLookDownLeft', 'eyeLookDownRight',
  'eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight',
  'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'browDownLeft', 'browDownRight',
  'mouthSmile', 'mouthSmileLeft', 'mouthSmileRight',
]

/**
 * Maps a rig's blend-shape name to the ARKit / Oculus name used above:
 * "blendShape1.AK_25_JawOpen" → "jawOpen", "blendShape1.AA_VI_10_aa" → "viseme_aa".
 */
function canonicalShapeName(raw: string): string {
  const name = raw.replace(/^.*\./, '')
  const vi = name.match(/^AA_VI_\d+_(.+)$/)
  if (vi) {
    const v = vi[1]
    return `viseme_${v === 'Sil' ? 'sil' : v === 'KK' ? 'kk' : v}`
  }
  const ak = name.match(/^AK_\d+_(.+)$/)
  if (ak) return ak[1].charAt(0).toLowerCase() + ak[1].slice(1)
  return name
}

interface Morph {
  mesh: THREE.Mesh
  index: number
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Smooth value noise in [-1, 1] — cheap organic motion for head and body. */
function noise(t: number, seed: number) {
  return Math.sin(t * 0.9 + seed) * 0.5 + Math.sin(t * 2.3 + seed * 1.7) * 0.3 + Math.sin(t * 5.1 + seed * 3.1) * 0.2
}

/**
 * Renders a rigged avatar (ARKit + Oculus viseme blend shapes) framed like a
 * video-call participant and animates it like a person on a call:
 *  - lip-sync from the TTS word timings (viseme timeline), scaled by the real
 *    audio loudness; falls back to loudness-only mouth movement
 *  - eye saccades, blinks (also on gaze shifts), brow raises on emphasis
 *  - idle head/body motion, breathing, nods while listening, looking away to think
 */
export class Avatar3D {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(20, 4 / 3, 0.05, 50)
  private readonly clock = new THREE.Clock()
  private readonly morphs = new Map<string, Morph[]>()
  private readonly weights = new Map<string, number>()
  private readonly baseline = new Map<string, number>()
  private wave = new Uint8Array(512)
  private head?: THREE.Object3D
  private neck?: THREE.Object3D
  private spine?: THREE.Object3D
  private readonly rest = new Map<THREE.Object3D, THREE.Quaternion>()
  private frame = 0
  private disposed = false

  private mode: AvatarMode = 'idle'
  private analyser: () => AnalyserNode | null = () => null
  private speech: () => SpeechSource | null = () => null
  private level = 0
  private levelAvg = 0
  private fallbackViseme: Viseme = 'aa'
  private fallbackHold = 0
  private blinkAt = 1.5
  private blinkT = -1
  private readonly gaze = new THREE.Vector2()
  private readonly gazeTarget = new THREE.Vector2()
  private nextSaccade = 0.8
  private brow = 0
  private thinkBlend = 0
  private nodT = -1
  private nextNodAt = 3

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0

    // Soft office lighting: window key light from the side, cool fill, rim
    this.scene.add(new THREE.HemisphereLight(0xe6eeff, 0x40362c, 0.9))
    const key = new THREE.DirectionalLight(0xfff4e6, 2.4)
    key.position.set(1.2, 1.8, 1.4)
    this.scene.add(key)
    const fill = new THREE.DirectionalLight(0xd6e4ff, 0.6)
    fill.position.set(-1.4, 1.2, 1.2)
    this.scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffffff, 1.4)
    rim.position.set(-0.6, 2.4, -1.6)
    this.scene.add(rim)
  }

  async load(model: AvatarModel): Promise<void> {
    const root = model.url.toLowerCase().endsWith('.fbx')
      ? await this.loadFbx(model)
      : (await new GLTFLoader().loadAsync(model.url)).scene
    if (this.disposed) return
    if (model.scale) root.scale.setScalar(model.scale)
    this.scene.add(root)

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.frustumCulled = false
      const dict = mesh.morphTargetDictionary
      if (!dict) return
      for (const [raw, index] of Object.entries(dict)) {
        const name = canonicalShapeName(raw)
        const list = this.morphs.get(name) ?? []
        list.push({ mesh, index })
        this.morphs.set(name, list)
      }
    })

    root.updateMatrixWorld(true)
    for (const [bone, [x, y, z]] of Object.entries(model.pose)) {
      const b = root.getObjectByName(bone)
      if (!b) continue
      const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'))
      const world = b.getWorldQuaternion(new THREE.Quaternion())
      const parentWorld = b.parent ? b.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion()
      b.quaternion.copy(parentWorld.invert().multiply(rot).multiply(world))
      b.updateMatrixWorld(true)
    }

    for (const [shape, v] of Object.entries(model.baseline ?? {})) this.baseline.set(shape, v)

    this.head = root.getObjectByName(model.bones.head)
    this.neck = model.bones.neck ? root.getObjectByName(model.bones.neck) : undefined
    this.spine = model.bones.spine ? root.getObjectByName(model.bones.spine) : undefined
    for (const b of [this.head, this.neck, this.spine]) if (b) this.rest.set(b, b.quaternion.clone())

    this.frameFace(model.distance ?? 1.35)
  }

  private async loadFbx(model: AvatarModel): Promise<THREE.Group> {
    const dir = model.textureDir ?? model.url.replace(/\/[^/]*$/, '')
    const manager = new THREE.LoadingManager()
    manager.setURLModifier((url) => {
      if (!/\.(tga|png|jpe?g)$/i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url
      const file = url.replace(/^.*[\\/]/, '')
      return `${dir}/${file.replace(/opacity_color\.tga$/i, 'opacity_color.png').replace(/\.tga$/i, '.jpg')}`
    })
    // FBXLoader picks a loader by the original extension; serve .tga through a
    // plain TextureLoader so the URL modifier above can swap in the .jpg/.png
    manager.addHandler(/\.tga$/i, new THREE.TextureLoader(manager))
    const root = await new FBXLoader(manager).loadAsync(model.url)

    // FBX gives Phong materials; physically based ones look far more natural
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const convert = (m: THREE.Material) => {
        const src = m as THREE.MeshPhongMaterial
        const alpha = /opacity/i.test(src.name)
        const std = new THREE.MeshStandardMaterial({
          name: src.name,
          map: src.map ?? null,
          normalMap: src.normalMap ?? null,
          color: src.map ? 0xffffff : src.color,
          roughness: /head/i.test(src.name) ? 0.6 : 0.82,
          metalness: 0,
          transparent: alpha,
          alphaTest: alpha ? 0.3 : 0,
          side: alpha ? THREE.DoubleSide : THREE.FrontSide,
        })
        if (std.map) std.map.colorSpace = THREE.SRGBColorSpace
        m.dispose()
        return std
      }
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material)
    })
    return root
  }

  /** Points the camera at the face like a webcam on top of a monitor. */
  private frameFace(distance: number) {
    this.scene.updateMatrixWorld(true)
    const headPos = new THREE.Vector3()
    this.head?.getWorldPosition(headPos)
    // The head bone sits around the base of the skull; the eyes are a bit higher
    const eyes = headPos.clone().add(new THREE.Vector3(0, 0.08, 0))
    this.camera.position.set(eyes.x, eyes.y + 0.02, eyes.z + distance)
    this.camera.lookAt(eyes.x, eyes.y - 0.1, eyes.z)
  }

  setMode(mode: AvatarMode) {
    if (mode !== this.mode && mode === 'speaking') this.brow = 0.6 // eyebrows lift as speech starts
    this.mode = mode
  }

  setAnalyserSource(source: () => AnalyserNode | null) {
    this.analyser = source
  }

  setSpeechSource(source: () => SpeechSource | null) {
    this.speech = source
  }

  start() {
    const loop = () => {
      if (this.disposed) return
      this.frame = requestAnimationFrame(loop)
      this.tick()
    }
    this.clock.start()
    loop()
  }

  /** Renders one frame immediately (used to capture still thumbnails). */
  renderNow() {
    this.renderer.render(this.scene, this.camera)
  }

  resize(width: number, height: number) {
    if (!width || !height) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.geometry?.dispose()
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        for (const v of Object.values(m)) if ((v as THREE.Texture | null)?.isTexture) (v as THREE.Texture).dispose()
        m.dispose()
      }
    })
    this.renderer.dispose()
  }

  // ── Animation ──────────────────────────────────────────────────────────────

  private tick() {
    const dt = Math.min(this.clock.getDelta(), 0.1)
    const t = this.clock.elapsedTime
    const target = new Map<string, number>()

    this.updateLevel()
    this.updateMouth(dt, t, target)
    this.updateEyes(dt, target)
    this.updateBrows(dt, target)
    this.updateBody(dt, t)

    // Friendly resting expression, softened while talking so visemes don't become a grin
    const baseScale = this.mode === 'speaking' ? 0.35 : 1
    for (const [shape, v] of this.baseline) target.set(shape, Math.max(target.get(shape) ?? 0, v * baseScale))

    for (const name of MANAGED_SHAPES) {
      const current = this.weights.get(name) ?? 0
      const goal = target.get(name) ?? 0
      const speed = name.startsWith('eyeBlink')
        ? 1
        : name.startsWith('viseme') || name === 'jawOpen' || name === 'mouthClose'
          ? 0.5
          : name.startsWith('eyeLook')
            ? 0.35
            : 0.12
      const next = lerp(current, goal, speed)
      this.weights.set(name, next)
      for (const { mesh, index } of this.morphs.get(name) ?? []) {
        if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = next
      }
    }

    this.renderer.render(this.scene, this.camera)
  }

  private updateLevel() {
    let level = 0
    const analyser = this.mode === 'speaking' ? this.analyser() : null
    if (analyser) {
      if (this.wave.length !== analyser.fftSize) this.wave = new Uint8Array(analyser.fftSize)
      analyser.getByteTimeDomainData(this.wave)
      let sum = 0
      for (let i = 0; i < this.wave.length; i++) {
        const v = (this.wave[i] - 128) / 128
        sum += v * v
      }
      level = Math.min(1, Math.sqrt(sum / this.wave.length) * 4.5)
    }
    this.level = lerp(this.level, level, level > this.level ? 0.6 : 0.25)
    this.levelAvg = lerp(this.levelAvg, this.level, 0.02)
  }

  private updateMouth(dt: number, t: number, target: Map<string, number>) {
    if (this.mode !== 'speaking') return
    const speech = this.speech()

    if (speech?.track?.length) {
      // Timeline lip-sync with co-articulation: neighbouring shapes overlap ~50ms
      const now = speech.time
      const loud = this.level > 0 ? 0.65 + Math.min(0.5, this.level) : 1
      const BLEND = 0.05
      let any = false
      for (const k of speech.track) {
        if (k.t1 + BLEND < now) continue
        if (k.t0 - BLEND > now) break
        const mid = (k.t0 + k.t1) / 2
        const half = (k.t1 - k.t0) / 2 + BLEND
        const w = Math.max(0, 1 - Math.abs(now - mid) / half)
        if (w <= 0) continue
        any = true
        const name = `viseme_${k.v}`
        target.set(name, Math.max(target.get(name) ?? 0, w * VISEME_GAIN[k.v] * loud))
        const jaw = (VISEME_JAW[k.v] ?? 0.03) * w * loud
        target.set('jawOpen', Math.max(target.get('jawOpen') ?? 0, jaw))
      }
      if (!any) target.set('mouthClose', 0.1)
      return
    }

    // No timeline (browser speech synthesis): drive the mouth from loudness
    const level = this.level > 0 ? this.level : Math.max(0, 0.45 + 0.55 * Math.sin(t * 11) * Math.sin(t * 3.7 + 1))
    const open = Math.max(0, (level - 0.04) * 1.6)
    this.fallbackHold -= dt
    if (this.fallbackHold <= 0 && open > 0.08) {
      this.fallbackHold = 0.09 + Math.random() * 0.08
      const options: Viseme[] = ['aa', 'aa', 'E', 'O', 'I', 'U']
      this.fallbackViseme = options[Math.floor(Math.random() * options.length)]
    }
    if (open > 0.02) {
      const v = this.fallbackViseme
      target.set(`viseme_${v}`, Math.min(VISEME_GAIN[v], open * VISEME_GAIN[v]))
      target.set('jawOpen', Math.min(0.22, open * 0.18))
    } else {
      target.set('viseme_PP', 0.25)
    }
  }

  private updateEyes(dt: number, target: Map<string, number>) {
    // Saccades: mostly at the camera with small drifts, occasionally a glance away
    this.nextSaccade -= dt
    if (this.nextSaccade <= 0) {
      const away = this.mode !== 'listening' && Math.random() < (this.mode === 'speaking' ? 0.25 : 0.12)
      this.gazeTarget.set((Math.random() - 0.5) * (away ? 0.9 : 0.25), (Math.random() - 0.5) * (away ? 0.5 : 0.15))
      this.nextSaccade = away ? 0.6 + Math.random() * 0.6 : 0.8 + Math.random() * 2.2
      if (away && this.blinkT < 0 && Math.random() < 0.5) this.blinkAt = 0 // people blink on big gaze shifts
    }
    const think = this.thinkBlend
    const gx = lerp(this.gazeTarget.x, -0.7, think)
    const gy = lerp(this.gazeTarget.y, 0.55, think)
    this.gaze.set(lerp(this.gaze.x, gx, 0.5), lerp(this.gaze.y, gy, 0.5))

    const { x, y } = this.gaze
    target.set('eyeLookOutLeft', Math.max(0, x))
    target.set('eyeLookInRight', Math.max(0, x))
    target.set('eyeLookInLeft', Math.max(0, -x))
    target.set('eyeLookOutRight', Math.max(0, -x))
    target.set('eyeLookUpLeft', Math.max(0, y))
    target.set('eyeLookUpRight', Math.max(0, y))
    target.set('eyeLookDownLeft', Math.max(0, -y))
    target.set('eyeLookDownRight', Math.max(0, -y))

    // Blinks: 2–6 s apart, ~170 ms, sometimes a double blink
    this.blinkAt -= dt
    if (this.blinkT < 0 && this.blinkAt <= 0) this.blinkT = 0
    if (this.blinkT >= 0) {
      this.blinkT += dt
      const v = this.blinkT < 0.07 ? this.blinkT / 0.07 : Math.max(0, 1 - (this.blinkT - 0.07) / 0.1)
      target.set('eyeBlinkLeft', v)
      target.set('eyeBlinkRight', v)
      if (this.blinkT > 0.17) {
        this.blinkT = -1
        this.blinkAt = Math.random() < 0.15 ? 0.2 : 2 + Math.random() * 4
      }
    }
  }

  private updateBrows(dt: number, target: Map<string, number>) {
    // Emphasis: eyebrows lift on loud syllables while speaking
    if (this.mode === 'speaking' && this.level > this.levelAvg * 1.7 && this.level > 0.25 && this.brow < 0.2) {
      this.brow = 0.35 + Math.random() * 0.3
    }
    this.brow = Math.max(0, this.brow - dt * 0.9)
    const think = this.thinkBlend
    target.set('browInnerUp', this.brow * 0.7 + (this.mode === 'listening' ? 0.08 : 0))
    target.set('browOuterUpLeft', this.brow * 0.5)
    target.set('browOuterUpRight', this.brow * 0.45)
    // Concentration while thinking
    target.set('browDownLeft', think * 0.25)
    target.set('browDownRight', think * 0.25)
    target.set('eyeSquintLeft', think * 0.2)
    target.set('eyeSquintRight', think * 0.2)
  }

  private updateBody(dt: number, t: number) {
    const speaking = this.mode === 'speaking'
    this.thinkBlend = lerp(this.thinkBlend, this.mode === 'thinking' ? 1 : 0, 0.04)

    // Nods: encouraging while the candidate talks, small emphasis nods while speaking
    this.nextNodAt -= dt
    if (this.nodT < 0 && this.nextNodAt <= 0 && (this.mode === 'listening' || speaking)) this.nodT = 0
    let nod = 0
    if (this.nodT >= 0) {
      this.nodT += dt
      nod = Math.sin(Math.min(1, this.nodT / 0.55) * Math.PI) * (speaking ? 0.03 : 0.055)
      if (this.nodT > 0.55) {
        this.nodT = -1
        this.nextNodAt = speaking ? 1.8 + Math.random() * 2.5 : 3 + Math.random() * 4
      }
    }

    const amp = speaking ? 1.5 : 1
    const yaw = noise(t * 0.33, 1) * 0.045 * amp + this.thinkBlend * 0.14 + this.gaze.x * 0.04
    const pitch = noise(t * 0.29, 7) * 0.025 * amp + nod - this.thinkBlend * 0.07 + this.level * 0.015
    const roll = noise(t * 0.23, 13) * 0.02 * amp + this.thinkBlend * 0.035

    // Applied in world-aligned axes on top of each bone's rest pose, so the
    // motion is the same on every rig regardless of bone orientation
    const apply = (bone: THREE.Object3D | undefined, p: number, y: number, r: number) => {
      const rest = bone && this.rest.get(bone)
      if (!bone || !rest || !bone.parent) return
      bone.quaternion.copy(rest)
      bone.updateMatrixWorld(true)
      const parentWorld = bone.parent.getWorldQuaternion(new THREE.Quaternion())
      const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(-p, y, -r, 'YXZ'))
      const local = parentWorld.clone().invert().multiply(delta).multiply(parentWorld)
      bone.quaternion.copy(local.multiply(rest))
    }
    apply(this.spine, Math.sin(t * 1.6) * 0.006, yaw * 0.15, 0)
    apply(this.neck, pitch * 0.4, yaw * 0.4, roll * 0.3)
    apply(this.head, pitch * 0.6, yaw * 0.6, roll * 0.7)
  }
}
