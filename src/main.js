import './assets/main.css'

import { createApp } from 'vue'

import App from './App.vue'
import router from './router'

function installWatermarkGuard() {
  if (window.__SITE_WATERMARK_GUARD_INSTALLED__) return
  Object.defineProperty(window, '__SITE_WATERMARK_GUARD_INSTALLED__', {
    value: true,
    configurable: false,
    writable: false,
  })

  const watermarkId = 'site-watermark-overlay'
  const watermarkBackground = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='120' viewBox='0 0 200 120'%3E%3Ctext x='24' y='70' fill='%2371717a' fill-opacity='.09' font-family='Arial,sans-serif' font-size='16' font-weight='600' letter-spacing='1' transform='rotate(-18 100 60)'%3Enet.2t.hk%3C/text%3E%3C/svg%3E\")"
  const lockedStyles = {
    all: 'initial',
    position: 'fixed',
    top: '0px',
    right: '0px',
    bottom: '0px',
    left: '0px',
    zIndex: '2147483647',
    display: 'block',
    visibility: 'visible',
    opacity: '1',
    width: 'auto',
    height: 'auto',
    margin: '0px',
    padding: '0px',
    pointerEvents: 'none',
    userSelect: 'none',
    transform: 'none',
    filter: 'none',
    clip: 'auto',
    clipPath: 'none',
    mask: 'none',
    overflow: 'hidden',
    transition: 'none',
    backgroundImage: watermarkBackground,
    backgroundPosition: 'center',
    backgroundRepeat: 'repeat',
    backgroundSize: 'auto',
  }
  const styleProbe = document.createElement('div')
  Object.entries(lockedStyles).forEach(([property, value]) => {
    const cssProperty = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
    styleProbe.style.setProperty(cssProperty, value, 'important')
  })
  const lockedStyleText = styleProbe.style.cssText

  let watermark = null
  let repairQueued = false

  function lockWatermarkStyles(element) {
    if (element.style.cssText !== lockedStyleText) element.style.cssText = lockedStyleText
  }

  function ensureWatermark() {
    if (!document.body) return

    let element = document.getElementById(watermarkId)
    if (!(element instanceof HTMLDivElement) && watermark instanceof HTMLDivElement && watermark.isConnected) {
      element = watermark
    }
    if (!(element instanceof HTMLDivElement)) {
      element?.remove()
      element = document.createElement('div')
    }

    if (element.id !== watermarkId) element.id = watermarkId
    if (element.className !== 'screen-watermark') element.className = 'screen-watermark'
    if (element.getAttribute('aria-hidden') !== 'true') element.setAttribute('aria-hidden', 'true')
    if (element.hidden) element.hidden = false
    lockWatermarkStyles(element)

    if (element.parentElement !== document.body || document.body.lastElementChild !== element) {
      document.body.appendChild(element)
    }
    watermark = element
  }

  function scheduleWatermarkRepair() {
    if (repairQueued) return
    repairQueued = true
    queueMicrotask(() => {
      repairQueued = false
      ensureWatermark()
    })
  }

  ensureWatermark()
  const observer = new MutationObserver((mutations) => {
    if (!watermark?.isConnected || mutations.some((mutation) => mutation.target === watermark || mutation.type === 'childList')) {
      scheduleWatermarkRepair()
    }
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'hidden', 'id', 'style'],
    childList: true,
    subtree: true,
  })

  window.setInterval(ensureWatermark, 500)
  window.addEventListener('focus', ensureWatermark)
  document.addEventListener('visibilitychange', ensureWatermark)
}

const app = createApp(App)

app.use(router)

app.mount('#app')
installWatermarkGuard()
