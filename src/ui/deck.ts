import { Engine } from '../audio/engine'
import { exportWav } from '../audio/exportWav'
import { PATCHES, patchById } from '../domain/patches'
import type { DriveInput, Studio } from '../domain/types'

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

export function mountDeck(root: HTMLElement): void {
  let patchId = PATCHES[0]?.id ?? 'soft-hum'
  const drive: DriveInput = { throttle: 0.35, speedMph: 25 }
  const studio: Studio = {
    pitch: 1,
    brightness: 1,
    noise: 1,
    volume: 0.7,
  }
  const engine = new Engine(patchById(patchId))

  const deck = el('div', 'deck')
  const brandBlock = el('header', 'brand-block')
  const brand = el('h1', 'brand', 'HUM')
  const tagline = el(
    'p',
    'tagline',
    'Open-source EV engine sounds. Free forever. No account. Fork the synth.',
  )
  const oss = el('div', 'oss')
  const badge = el('span', undefined, 'MIT · browser · Web Audio')
  badge.style.color = 'var(--electric)'
  oss.append(badge)
  brandBlock.append(brand, tagline, oss)

  const stage = el('main', 'stage')
  const patches = el('div', 'patches')
  const blurb = el('p', 'blurb', patchById(patchId).blurb)

  for (const patch of PATCHES) {
    const btn = el('button', 'patch', patch.name)
    btn.type = 'button'
    btn.setAttribute('aria-pressed', String(patch.id === patchId))
    btn.addEventListener('click', () => {
      patchId = patch.id
      engine.setPatch(patchById(patchId))
      blurb.textContent = patch.blurb
      for (const child of patches.children) {
        if (child instanceof HTMLButtonElement) {
          child.setAttribute(
            'aria-pressed',
            String(child.textContent === patch.name),
          )
        }
      }
    })
    patches.append(btn)
  }

  const controls = el('div', 'controls')

  const throttle = makeSlider('Throttle', 0, 1, 0.01, drive.throttle, (v) => {
    drive.throttle = v
    engine.setDrive({ ...drive })
    rpmOut.textContent = `${Math.round(800 + drive.speedMph * 40 + drive.throttle * 4200)}`
  })
  const speed = makeSlider('Speed mph', 0, 120, 1, drive.speedMph, (v) => {
    drive.speedMph = v
    engine.setDrive({ ...drive })
    speedOut.textContent = `${Math.round(v)}`
    rpmOut.textContent = `${Math.round(800 + drive.speedMph * 40 + drive.throttle * 4200)}`
  })
  const pitch = makeSlider('Pitch', 0.5, 1.8, 0.01, studio.pitch, (v) => {
    studio.pitch = v
    engine.setStudio({ ...studio })
  })
  const brightness = makeSlider(
    'Brightness',
    0.4,
    2,
    0.01,
    studio.brightness,
    (v) => {
      studio.brightness = v
      engine.setStudio({ ...studio })
    },
  )
  const noise = makeSlider('Noise', 0, 2, 0.01, studio.noise, (v) => {
    studio.noise = v
    engine.setStudio({ ...studio })
  })
  const volume = makeSlider('Volume', 0, 1, 0.01, studio.volume, (v) => {
    studio.volume = v
    engine.setStudio({ ...studio })
  })

  controls.append(
    throttle.row,
    speed.row,
    pitch.row,
    brightness.row,
    noise.row,
    volume.row,
  )

  const actions = el('div', 'actions')
  const startBtn = el('button', 'primary', 'Start')
  startBtn.type = 'button'
  const exportBtn = el('button', 'ghost', 'Export WAV')
  exportBtn.type = 'button'

  startBtn.addEventListener('click', async () => {
    if (engine.phase === 'running') {
      engine.stop()
      startBtn.textContent = 'Start'
      startBtn.dataset.on = 'false'
      phaseDot.classList.remove('on')
      phaseLabel.textContent = 'stopped'
      return
    }
    await engine.start()
    engine.setDrive({ ...drive })
    engine.setStudio({ ...studio })
    startBtn.textContent = 'Stop'
    startBtn.dataset.on = 'true'
    phaseDot.classList.add('on')
    phaseLabel.textContent = 'running'
  })

  exportBtn.addEventListener('click', async () => {
    exportBtn.disabled = true
    exportBtn.textContent = 'Rendering…'
    try {
      const blob = await exportWav(patchById(patchId), drive, studio)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hum-${patchId}.wav`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      exportBtn.disabled = false
      exportBtn.textContent = 'Export WAV'
    }
  })

  actions.append(startBtn, exportBtn)

  const status = el('div', 'status')
  const phaseWrap = el('span')
  const phaseDot = el('span', 'pulse-dot')
  const phaseLabel = document.createElement('strong')
  phaseLabel.textContent = 'stopped'
  phaseWrap.append(phaseDot, document.createTextNode(' engine '), phaseLabel)

  const speedOut = document.createElement('strong')
  speedOut.textContent = `${Math.round(drive.speedMph)}`
  const speedWrap = el('span')
  speedWrap.append(document.createTextNode('speed '), speedOut, document.createTextNode(' mph'))

  const rpmOut = document.createElement('strong')
  rpmOut.textContent = `${Math.round(800 + drive.speedMph * 40 + drive.throttle * 4200)}`
  const rpmWrap = el('span')
  rpmWrap.append(document.createTextNode('motor '), rpmOut, document.createTextNode(' rpm*'))

  status.append(phaseWrap, speedWrap, rpmWrap)

  stage.append(patches, blurb, controls, actions, status)

  const foot = el(
    'footer',
    'foot',
    '*rpm is a display mapping for feel, not a real motor tach. Connect phone Bluetooth to your car stereo or an exterior speaker. Stay legal with outdoor volume.',
  )

  deck.append(brandBlock, stage, foot)
  root.replaceChildren(deck)
}

function makeSlider(
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
  onChange: (v: number) => void,
): { row: HTMLElement } {
  const row = el('div', 'row')
  const lab = el('label', undefined, label)
  const input = document.createElement('input')
  input.type = 'range'
  input.min = String(min)
  input.max = String(max)
  input.step = String(step)
  input.value = String(value)
  const out = document.createElement('output')
  out.textContent = format(value)
  input.addEventListener('input', () => {
    const v = Number(input.value)
    out.textContent = format(v)
    onChange(v)
  })
  lab.htmlFor = ''
  row.append(lab, input, out)
  return { row }
}

function format(v: number): string {
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(2)
}
