.pragma library
// Pure logic for the Screen Search OSD: state machine, content detection,
// action lists, settings lookup. No Qt objects here so it is unit-testable
// with plain node.

var STATES = ["idle", "selecting", "processing", "result", "closed", "cancelled", "failed"]

// transition(state, event) -> next state or null when the event is illegal.
function transition(state, event) {
  var table = {
    idle:       { start: "selecting" },
    selecting:  { captured: "processing", cancel: "cancelled", fail: "failed", close: "closed" },
    processing: { done: "result", fail: "failed", close: "closed" },
    result:     { act: "processing", done: "result", close: "closed", fail: "failed" },
    failed:     { close: "closed", start: "selecting" },
    cancelled:  { close: "closed", start: "selecting" },
    closed:     { start: "selecting" }
  }
  var row = table[state]
  return row && row[event] ? row[event] : null
}

var URL_RE = /https?:\/\/[^\s<>"'()\[\]]+/g
var EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
var PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g

function detect(text) {
  var t = String(text || "")
  var urls = (t.match(URL_RE) || []).map(function(u) { return u.replace(/[.,;:!?'"\u2019]+$/, "") })
  var emails = t.match(EMAIL_RE) || []
  var phones = (t.match(PHONE_RE) || []).filter(function(p) { return p.replace(/\D/g, "").length >= 8 })
  return { urls: urls, emails: emails, phones: phones }
}

// Actions for a payload. `key` is the mnemonic; `def` marks the Enter default.
// Provider capability gates come from providers.json (passed in as `caps`).
function actionsFor(payload, providerName, caps) {
  var list = []
  var d = payload && payload.text ? detect(payload.text) : { urls: [], emails: [], phones: [] }
  if (payload.kind === "text") {
    list.push({ id: "copy", label: "Copy", key: "c", def: true })
    if (caps.text) list.push({ id: "search", label: "Search " + providerName, key: "s" })
    list.push({ id: "translate", label: "Translate", key: "t" })
    if (d.urls.length) list.push({ id: "open-url", label: "Open URL", key: "o", arg: d.urls[0] })
    list.push({ id: "copy-close", label: "Copy & close", key: "x" })
  } else if (payload.kind === "image") {
    if (caps.visual) list.push({ id: "visual", label: "Search " + providerName, key: "s", def: true })
    list.push({ id: "imgops", label: "ImgOps", key: "i" })
    list.push({ id: "ocr", label: "OCR", key: "o", def: !caps.visual })
    list.push({ id: "translate-image", label: "Translate", key: "t" })
    list.push({ id: "copy-image", label: "Copy", key: "c" })
    list.push({ id: "save", label: "Save", key: "v" })
    list.push({ id: "qr", label: "QR", key: "q" })
  }
  return list
}

var SECTIONS = ["left", "center", "right"]

// Every placement of one id in the layout, at any depth. Depth 0 is a section
// entry; deeper is a widget hosted inside another widget's `items[]`, which is
// how a drawer (t1nk33r.nook) carries the widgets it absorbed. A bare string
// entry carries no settings and so is not a placement that can hold any.
function collectPlacements(list, id, depth, out) {
  if (!list || typeof list.length !== "number") return out
  for (var i = 0; i < list.length; i++) {
    var entry = list[i]
    if (!entry || typeof entry !== "object") continue
    if (entry.id === id) out.push({ depth: depth, entry: entry })
    if (entry.items) collectPlacements(entry.items, id, depth + 1, out)
  }
  return out
}

function markerFor(config, id) {
  var plugins = config && config.plugins
  if (!plugins || typeof plugins.length !== "number") return null
  for (var i = 0; i < plugins.length; i++)
    if (plugins[i] && typeof plugins[i] === "object" && plugins[i].id === id) return plugins[i]
  return null
}

// The plugin's settings, merged in the precedence shell.qml updateEntryInline()
// writes in, so what is read back is what a settings change landed on:
//
//   items   a widget a drawer hosts (`bar.layout.<section>[].items[]`). The
//           host's writer never reaches into a drawer, so this is the weakest
//           layer and the only one that is not a write target.
//   plugins the plugins[] marker, the fallback target when no top-level
//           bar.layout entry matches the id.
//   layout  a top-level object entry in bar.layout.<section>: the preferred
//           write target, and the value that wins.
//
// Sibling placements at the same depth cannot normally exist (allowMultiple is
// false), so the first one found wins. `{}` means nothing resolved -- an unread
// document looks the same, which is why the caller keeps the last good one.
function findEntry(config, id) {
  var out = {}
  if (!config || typeof config !== "object" || !id) return out
  var layout = config.bar && config.bar.layout ? config.bar.layout : {}
  var placements = []
  for (var s = 0; s < SECTIONS.length; s++) collectPlacements(layout[SECTIONS[s]], id, 0, placements)

  var top = null
  var nested = []
  for (var p = 0; p < placements.length; p++) {
    if (placements[p].depth === 0) {
      if (top === null) top = placements[p].entry
      continue
    }
    nested.push(placements[p])
  }
  // Deepest first, so a shallower host's entry overrides the one it nests.
  nested.sort(function(left, right) { return right.depth - left.depth })

  var layers = nested.map(function(placement) { return placement.entry })
  var marker = markerFor(config, id)
  if (marker !== null) layers.push(marker)
  if (top !== null) layers.push(top)
  for (var l = 0; l < layers.length; l++)
    for (var key in layers[l]) out[key] = layers[l][key]
  return out
}

// The settings document, parsed where it can be tested instead of inside a QML
// binding: a malformed or half-written shell.json has to come back as null, not
// as a throw that takes the binding down. Null is "unreadable", never "no
// settings" -- an empty document is unreadable too.
function shellConfigIn(text) {
  var raw = String(text === undefined || text === null ? "" : text)
  if (raw.trim() === "") return null
  var parsed = null
  try { parsed = JSON.parse(raw) } catch (e) { return null }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null
  return parsed
}

// Layer-shell anchor booleans for the OSD window. An axis with no anchored
// edge is centered by the compositor, so "center" returns no anchors at all.
// Filesystem path of the plugin dir from a QML context URL ("file://…/").
function pluginDirFromUrl(u) {
  return String(u).replace(/^file:\/\//, "").replace(/\/$/, "")
}

function anchorsFor(position) {
  switch (String(position || "center")) {
    case "top-center": return { top: true }
    case "top-right": return { top: true, right: true }
    case "bottom-center": return { bottom: true }
    case "bottom-right": return { bottom: true, right: true }
    default: return {}
  }
}

function summarize(text, maxLines, maxChars) {
  var lines = String(text || "").split("\n")
  var out = lines.slice(0, maxLines).join("\n")
  if (out.length > maxChars) out = out.slice(0, maxChars) + "…"
  else if (lines.length > maxLines) out += "\n…"
  return { text: out, truncated: lines.length > maxLines || String(text || "").length > maxChars }
}

function messageForExit(code, action) {
  switch (code) {
    case 3: return "Browser could not be launched"
    case 4: return "Not supported by this provider"
    case 11: return action === "qr" ? "No QR code found" : "No text detected"
    case 12: return "OCR engine unavailable"
    case 13: return "QR decoder not installed"
    case 5: return "Upload failed — try Clipboard mode"
    default: return "Something went wrong"
  }
}
