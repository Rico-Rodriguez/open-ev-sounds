import { Engine } from '../audio/engine'
import { exportWav } from '../audio/exportWav'
import { PATCHES, patchById } from '../domain/patches'
import type { DriveInput, Studio } from '../domain/types'
import { startGps, type GpsHandle } from '../drive/gps'

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

function motorRpm(drive: DriveInput): number {
  return Math.round(800 + drive.speedMph * 40 + drive.throttle * 4200)
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
  let gps: GpsHandle | null = null
  let gpsOn = false

  const deck = el('div', 'deck')

  const brandBlock = el('header', 'brand-block')
  const brand = el('h1', 'brand', 'HUM')
  const tagline = el(
    'p',
    'tagline',
    'Open EV engine sounds. Free forever. Fork the synth.',
  )
  const oss = el('p', 'oss', 'MIT · browser · Web Audio')
  brandBlock.append(brand, tagline, oss)

  const stage = el('main', 'stage')
  const sheet = el('div', 'sheet')

  const patchSection = el('section', 'section')
  const patchLabel = el('h2', 'section-title', 'Sound')
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
  patchSection.append(patchLabel, patches, blurb)

  const driveSection = el('section', 'section')
  const driveTitle = el('h2', 'section-title', 'Drive')
  const driveControls = el('div', 'controls')

  const throttle = makeSlider('Throttle', 0, 1, 0.01, drive.throttle, (v) => {
    drive.throttle = v
    engine.setDrive({ ...drive })
    rpmOut.textContent = `${motorRpm(drive)}`
  })
  throttle.row.classList.add('row-hero')

  const speed = makeSlider('Speed mph', 0, 120, 1, drive.speedMph, (v) => {
    if (gpsOn) return
    drive.speedMph = v
    engine.setDrive({ ...drive })
    speedOut.textContent = `${Math.round(v)}`
    rpmOut.textContent = `${motorRpm(drive)}`
  })

  driveControls.append(throttle.row, speed.row)
  driveSection.append(driveTitle, driveControls)

  const studioSection = el('section', 'section')
  const studioTitle = el('h2', 'section-title', 'Tone')
  const studioControls = el('div', 'controls')

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

  studioControls.append(pitch.row, brightness.row, noise.row, volume.row)
  studioSection.append(studioTitle, studioControls)

  const actions = el('div', 'actions')
  const startBtn = el('button', 'primary', 'Start')
  startBtn.type = 'button'
  const gpsBtn = el('button', 'ghost', 'GPS speed')
  gpsBtn.type = 'button'
  gpsBtn.setAttribute('aria-pressed', 'false')
  const exportBtn = el('button', 'ghost', 'Export WAV')
  exportBtn.type = 'button'

  function setSpeedDisplay(mph: number): void {
    const clamped = Math.min(120, Math.max(0, mph))
    drive.speedMph = clamped
    engine.setDrive({ ...drive })
    speedOut.textContent = `${Math.round(clamped)}`
    rpmOut.textContent = `${motorRpm(drive)}`
    speed.input.value = String(Math.round(clamped))
    speed.output.textContent = format(Math.round(clamped))
  }

  function stopGps(): void {
    gps?.stop()
    gps = null
    gpsOn = false
    gpsBtn.setAttribute('aria-pressed', 'false')
    gpsBtn.textContent = 'GPS speed'
    speed.input.disabled = false
    modeLabel.textContent = 'Manual'
  }

  gpsBtn.addEventListener('click', () => {
    if (gpsOn) {
      stopGps()
      return
    }
    const handle = startGps((mph) => {
      if (!gpsOn) return
      setSpeedDisplay(mph)
    })
    if (!handle) {
      modeLabel.textContent = 'Unavailable'
      return
    }
    gps = handle
    gpsOn = true
    gpsBtn.setAttribute('aria-pressed', 'true')
    gpsBtn.textContent = 'GPS on'
    speed.input.disabled = true
    modeLabel.textContent = 'GPS'
  })

  startBtn.addEventListener('click', async () => {
    if (engine.phase === 'running') {
      engine.stop()
      startBtn.textContent = 'Start'
      startBtn.dataset.on = 'false'
      phaseDot.classList.remove('on')
      phaseLabel.textContent = 'Stopped'
      return
    }
    await engine.start()
    engine.setDrive({ ...drive })
    engine.setStudio({ ...studio })
    startBtn.textContent = 'Stop'
    startBtn.dataset.on = 'true'
    phaseDot.classList.add('on')
    phaseLabel.textContent = 'Running'
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

  actions.append(startBtn, gpsBtn, exportBtn)

  const status = el('div', 'status')
  const phaseWrap = el('span', 'status-pill')
  const phaseDot = el('span', 'pulse-dot')
  const phaseLabel = document.createElement('strong')
  phaseLabel.textContent = 'Stopped'
  phaseWrap.append(phaseDot, phaseLabel)

  const speedOut = document.createElement('strong')
  speedOut.textContent = `${Math.round(drive.speedMph)}`
  const speedWrap = el('span', 'status-pill')
  speedWrap.append(speedOut, document.createTextNode(' mph'))

  const rpmOut = document.createElement('strong')
  rpmOut.textContent = `${motorRpm(drive)}`
  const rpmWrap = el('span', 'status-pill')
  rpmWrap.append(rpmOut, document.createTextNode(' rpm*'))

  const modeLabel = document.createElement('strong')
  modeLabel.textContent = 'Manual'
  const modeWrap = el('span', 'status-pill')
  modeWrap.append(modeLabel)

  status.append(phaseWrap, speedWrap, rpmWrap, modeWrap)

  sheet.append(patchSection, driveSection, studioSection, actions, status)
  stage.append(sheet)

  const foot = el(
    'footer',
    'foot',
    '*rpm is a display mapping for feel, not a real motor tach. GPS uses location for speed only. Bluetooth to a car stereo or exterior speaker. Stay legal outdoors.',
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
): { row: HTMLElement; input: HTMLInputElement; output: HTMLOutputElement } {
  const row = el('div', 'row')
  const head = el('div', 'row-head')
  const lab = el('label', undefined, label)
  const out = document.createElement('output')
  out.textContent = format(value)
  head.append(lab, out)

  const input = document.createElement('input')
  input.type = 'range'
  input.min = String(min)
  input.max = String(max)
  input.step = String(step)
  input.value = String(value)
  input.addEventListener('input', () => {
    const v = Number(input.value)
    out.textContent = format(v)
    onChange(v)
  })
  row.append(head, input)
  return { row, input, output: out }
}

function format(v: number): string {
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(2)
}
