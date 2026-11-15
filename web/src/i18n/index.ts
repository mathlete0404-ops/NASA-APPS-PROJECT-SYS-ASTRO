// Optional Korean (한국어). English is the default and the source of truth: when Korean is on, the
// visible text and labels are swapped for their Korean entries in ./ko, and swapped back when it is
// off. Text React renders later is translated as it appears. Nothing here changes app logic.
import { KO, KO_PATTERNS } from './ko'

export type Lang = 'en' | 'ko'
const KEY = 'crew-mirror:lang'
let lang: Lang = (() => { try { return localStorage.getItem(KEY) === 'ko' ? 'ko' : 'en' } catch { return 'en' } })()
export const getLang = () => lang

const enText = new WeakMap<Text, string>()
const wrote = new WeakMap<Text, string>()
const ATTRS = ['placeholder', 'title', 'aria-label'] as const
const enAttr = new WeakMap<Element, Record<string, string>>()
const wroteAttr = new WeakMap<Element, Record<string, string>>()

function translate(s: string): string | null {
  const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/)!
  const core = m[2].replace(/\s+/g, ' ')
  if (!core || !/[A-Za-z]/.test(core)) return null
  let out: string | undefined = KO[core]
  if (out == null) for (const [re, f] of KO_PATTERNS) { const mm = core.match(re); if (mm) { out = f(mm); break } }
  return out == null ? null : m[1] + out + m[3]
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'CODE', 'PRE'])
function doText(n: Text) {
  const p = n.parentElement
  if (!p || SKIP.has(p.tagName) || p.closest('[data-no-i18n]')) return
  const cur = n.nodeValue ?? ''
  if (wrote.get(n) !== cur) enText.set(n, cur) // new or changed by the app: this is the English
  const en = enText.get(n) ?? cur
  const v = lang === 'ko' ? (translate(en) ?? en) : en
  if (cur !== v) n.nodeValue = v
  wrote.set(n, v)
}
function doAttrs(el: Element) {
  for (const a of ATTRS) {
    const cur = el.getAttribute(a)
    if (cur == null) continue
    const w = wroteAttr.get(el) ?? {}, e = enAttr.get(el) ?? {}
    if (w[a] !== cur) e[a] = cur
    const v = lang === 'ko' ? (translate(e[a]) ?? e[a]) : e[a]
    if (cur !== v) el.setAttribute(a, v)
    w[a] = v; enAttr.set(el, e); wroteAttr.set(el, w)
  }
}
function walk(root: Node) {
  if (root.nodeType === 3) return doText(root as Text)
  if (root.nodeType !== 1) return
  const el = root as Element
  if (SKIP.has(el.tagName)) return
  doAttrs(el)
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let n: Node | null
  while ((n = tw.nextNode())) n.nodeType === 3 ? doText(n as Text) : doAttrs(n as Element)
}

let started = false
export function initI18n() {
  if (started) return
  started = true
  document.documentElement.lang = lang
  walk(document.body)
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'characterData') doText(m.target as Text)
      else if (m.type === 'attributes') doAttrs(m.target as Element)
      else m.addedNodes.forEach(walk)
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] })
}

export function setLang(l: Lang) {
  lang = l
  try { localStorage.setItem(KEY, l) } catch { /* ignore */ }
  document.documentElement.lang = l
  walk(document.body)
  dispatchEvent(new Event('crew-mirror:lang'))
}
