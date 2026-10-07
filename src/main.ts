import './ui/styles.css'
import { mountDeck } from './ui/deck'

const app = document.querySelector<HTMLElement>('#app')
if (!app) throw new Error('#app missing')
mountDeck(app)
