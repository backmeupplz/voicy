#!/usr/bin/env node

import fs from 'node:fs/promises'
import http from 'node:http'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const DEFAULT_BROWSER_URL = 'http://127.0.0.1:9222'
const DEFAULT_CHAT = '@okamikron_bot'
const DEFAULT_TIMEOUT_MS = 45_000
const DEFAULT_SAMPLE_URL =
  'https://raw.githubusercontent.com/Jakobovski/free-spoken-digit-dataset/master/recordings/0_jackson_0.wav'

function usage() {
  return `Usage: node scripts/telegram-web-upload-qa.mjs [options]

Options:
  --browser-url <url>       Chrome DevTools HTTP URL (default: ${DEFAULT_BROWSER_URL})
  --chat <handle-or-url>    Telegram chat handle or web.telegram.org URL (default: ${DEFAULT_CHAT})
  --file <path>             Audio/file fixture to upload
  --sample                  Download the default public WAV speech sample and upload it
  --sample-url <url>        Public sample URL to use with --sample (default: free-spoken-digit WAV)
  --caption <text>          Optional caption to send with the fixture
  --expected-text <text>    Text to wait for after sending; repeat for status/final transcript checks
  --timeout-ms <ms>         Wait timeout for Telegram Web UI (default: ${DEFAULT_TIMEOUT_MS})
  --send                    Actually click Telegram's send button after attaching the file
  --evidence-file <path>    Write JSON evidence to this path
  --screenshot-file <path>  Capture a Telegram Web screenshot after verification
  --json                    Print compact JSON only
  --help                    Show this help

Examples:
  node scripts/telegram-web-upload-qa.mjs --sample --send --json
  node scripts/telegram-web-upload-qa.mjs --file ./qa/voice.wav --caption "VOI-KANEO-18 $(date -u +%Y-%m-%dT%H:%M:%SZ)" --send --evidence-file ./tmp/telegram-upload-evidence.json
`
}

function parseArgs(argv) {
  const opts = {
    browserUrl: DEFAULT_BROWSER_URL,
    chat: DEFAULT_CHAT,
    expectedTexts: [],
    sampleUrl: DEFAULT_SAMPLE_URL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    send: false,
    json: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    switch (arg) {
      case '--browser-url':
        opts.browserUrl = requireValue(argv, ++index, arg)
        break
      case '--chat':
        opts.chat = requireValue(argv, ++index, arg)
        break
      case '--file':
        opts.file = requireValue(argv, ++index, arg)
        break
      case '--sample':
        opts.sample = true
        break
      case '--sample-url':
        opts.sampleUrl = requireValue(argv, ++index, arg)
        break
      case '--caption':
        opts.caption = requireValue(argv, ++index, arg)
        break
      case '--expected-text':
        opts.expectedTexts.push(requireValue(argv, ++index, arg))
        break
      case '--timeout-ms':
        opts.timeoutMs = Number.parseInt(requireValue(argv, ++index, arg), 10)
        break
      case '--send':
        opts.send = true
        break
      case '--evidence-file':
        opts.evidenceFile = requireValue(argv, ++index, arg)
        break
      case '--screenshot-file':
        opts.screenshotFile = requireValue(argv, ++index, arg)
        break
      case '--json':
        opts.json = true
        break
      case '--help':
        opts.help = true
        break
      default:
        throw new Error(`unknown option: ${arg}`)
    }
  }

  if (opts.help) {
    return opts
  }

  if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive integer')
  }

  if (opts.file && opts.sample) {
    throw new Error('provide either --file or --sample, not both')
  }

  if (!opts.file && !opts.sample) {
    throw new Error('provide --file <path> or --sample')
  }

  if (!opts.send) {
    throw new Error('--send is required so the helper does not leave an unsent upload preview open')
  }

  return opts
}

function requireValue(argv, index, option) {
  const value = argv[index]

  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value`)
  }

  return value
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  if (opts.help) {
    process.stdout.write(usage())
    return
  }

  if (typeof WebSocket !== 'function') {
    throw new Error('this helper requires a Node.js runtime with global WebSocket support')
  }

  const fixture = await resolveFixture(opts)
  const client = new CdpClient(opts.browserUrl)
  const target = await client.telegramTarget(opts.chat)
  const session = await CdpSession.connect(target.webSocketDebuggerUrl)

  try {
    await session.call('Runtime.enable')
    await session.call('Page.enable')
    await session.call('DOM.enable')

    await session.call('Page.setInterceptFileChooserDialog', { enabled: true })

    try {
      const fileChooser = session.waitForEvent('Page.fileChooserOpened', opts.timeoutMs)

      await session.evaluate(openUploadFileChooserSource(), {
        chat: opts.chat,
        timeoutMs: opts.timeoutMs,
      })

      const chooser = await fileChooser

      await session.call('DOM.setFileInputFiles', {
        backendNodeId: chooser.backendNodeId,
        files: [fixture.path],
      })
    } finally {
      await session
        .call('Page.setInterceptFileChooserDialog', { enabled: false })
        .catch(() => undefined)
    }

    const automation = await session.evaluate(uploadAndVerifySource(), {
      caption: opts.caption || '',
      expectedTexts: opts.expectedTexts,
      fileName: fixture.name,
      send: opts.send,
      timeoutMs: opts.timeoutMs,
    })

    const output = {
      ok: true,
      browserUrl: opts.browserUrl,
      targetId: target.id,
      chat: opts.chat,
      sent: automation.sent,
      verified: automation.verified,
      expectedTexts: opts.expectedTexts,
      caption: opts.caption || null,
      fixture,
      url: automation.url,
      title: automation.title,
      visibleMessages: automation.visibleMessages,
      uploadDiagnostics: automation.diagnostics,
    }

    if (opts.screenshotFile) {
      output.screenshotFile = await writeScreenshot(session, opts.screenshotFile)
    }

    if (opts.evidenceFile) {
      await writeJson(opts.evidenceFile, output)
    }

    printOutput(output, opts.json)
  } finally {
    session.close()

    if (fixture.temporary) {
      await fs.rm(fixture.path, { force: true }).catch(() => undefined)
    }
  }
}

async function resolveFixture(opts) {
  if (opts.file) {
    const absolute = path.resolve(opts.file)
    const stat = await fs.stat(absolute)

    if (!stat.isFile()) {
      throw new Error(`fixture is not a file: ${absolute}`)
    }

    return {
      path: absolute,
      name: path.basename(absolute),
      bytes: stat.size,
      source: 'file',
      temporary: false,
    }
  }

  const sample = await fetchBuffer(opts.sampleUrl)
  const extension = extensionFromUrl(opts.sampleUrl) || '.wav'
  const samplePath = path.join(
    os.tmpdir(),
    `voicy-telegram-upload-${process.pid}-${Date.now()}${extension}`
  )
  await fs.writeFile(samplePath, sample)

  return {
    path: samplePath,
    name: path.basename(samplePath),
    bytes: sample.length,
    source: 'sample',
    sampleUrl: opts.sampleUrl,
    temporary: true,
  }
}

function extensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname
    const extension = path.extname(pathname)
    return extension || null
  } catch {
    return null
  }
}

function fetchBuffer(url) {
  const client = url.startsWith('https:') ? https : http

  return new Promise((resolve, reject) => {
    client
      .get(url, (response) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume()
          fetchBuffer(new URL(response.headers.location, url).toString())
            .then(resolve)
            .catch(reject)
          return
        }

        if (response.statusCode !== 200) {
          response.resume()
          reject(new Error(`sample download failed with HTTP ${response.statusCode}`))
          return
        }

        const chunks = []
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        response.on('end', () => resolve(Buffer.concat(chunks)))
      })
      .on('error', reject)
  })
}

async function writeScreenshot(session, screenshotFile) {
  const response = await session.call('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  })
  const absolute = path.resolve(screenshotFile)
  await fs.mkdir(path.dirname(absolute), { recursive: true })
  await fs.writeFile(absolute, Buffer.from(response.data, 'base64'))
  return absolute
}

async function writeJson(file, output) {
  const absolute = path.resolve(file)
  await fs.mkdir(path.dirname(absolute), { recursive: true })
  await fs.writeFile(absolute, `${JSON.stringify(output, null, 2)}\n`)
}

function printOutput(output, jsonOnly) {
  if (jsonOnly) {
    process.stdout.write(`${JSON.stringify(output)}\n`)
    return
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
}

class CdpClient {
  constructor(browserUrl) {
    this.browserUrl = browserUrl.replace(/\/+$/, '')
  }

  async telegramTarget(chat) {
    const existing = await this.findTelegramTarget()

    if (existing) {
      return existing
    }

    await this.openTelegramTarget(chat)

    const deadline = Date.now() + 10_000

    while (Date.now() < deadline) {
      const target = await this.findTelegramTarget()

      if (target) {
        return target
      }

      await delay(250)
    }

    throw new Error('Chrome DevTools did not expose a Telegram Web target')
  }

  async findTelegramTarget() {
    const targets = await this.getJson('/json/list')

    return targets.find((target) => {
      return target.type === 'page' && target.url && target.url.includes('web.telegram.org')
    })
  }

  async openTelegramTarget(chat) {
    const url = telegramUrl(chat)
    const encodedUrl = encodeURIComponent(url)
    const response = await fetch(`${this.browserUrl}/json/new?${encodedUrl}`, {
      method: 'PUT',
    })

    if (!response.ok) {
      throw new Error(`failed to open Telegram Web tab: HTTP ${response.status}`)
    }
  }

  async getJson(pathname) {
    const response = await fetch(`${this.browserUrl}${pathname}`)

    if (!response.ok) {
      throw new Error(`Chrome DevTools request failed for ${pathname}: HTTP ${response.status}`)
    }

    return response.json()
  }
}

class CdpSession {
  static connect(webSocketUrl) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(webSocketUrl)
      const session = new CdpSession(socket)

      socket.addEventListener('open', () => resolve(session), { once: true })
      socket.addEventListener(
        'error',
        () => reject(new Error('failed to connect to Chrome DevTools WebSocket')),
        { once: true }
      )
    })
  }

  constructor(socket) {
    this.socket = socket
    this.nextId = 1
    this.pending = new Map()
    this.eventWaiters = new Map()

    socket.addEventListener('message', (event) => this.onMessage(event))
    socket.addEventListener('close', () => {
      this.rejectPending(new Error('Chrome DevTools WebSocket closed'))
    })
  }

  call(method, params = {}) {
    const id = this.nextId++
    const payload = { id, method, params }

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.socket.send(JSON.stringify(payload))
    })
  }

  async evaluate(source, arg) {
    const response = await this.call('Runtime.evaluate', {
      expression: `(${source})(${JSON.stringify(arg)})`,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    })

    if (response.exceptionDetails) {
      const detail =
        response.exceptionDetails.exception?.description || response.exceptionDetails.text
      throw new Error(`Telegram Web automation failed: ${detail}`)
    }

    return response.result.value
  }

  async evaluateHandle(source, arg) {
    const response = await this.call('Runtime.evaluate', {
      expression: `(${source})(${JSON.stringify(arg)})`,
      awaitPromise: true,
      objectGroup: 'telegram-upload-qa',
      userGesture: true,
    })

    if (response.exceptionDetails) {
      const detail =
        response.exceptionDetails.exception?.description || response.exceptionDetails.text
      throw new Error(`Telegram Web automation failed: ${detail}`)
    }

    if (!response.result.objectId) {
      throw new Error('Telegram Web automation did not return a DOM object')
    }

    return response.result
  }

  close() {
    this.socket.close()
  }

  waitForEvent(method, timeoutMs) {
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, timeout: null }
      waiter.timeout = setTimeout(() => {
        this.removeEventWaiter(method, waiter)
        reject(new Error(`Timed out waiting for Chrome DevTools event: ${method}`))
      }, timeoutMs)

      if (!this.eventWaiters.has(method)) {
        this.eventWaiters.set(method, [])
      }

      this.eventWaiters.get(method).push(waiter)
    })
  }

  removeEventWaiter(method, waiter) {
    const waiters = this.eventWaiters.get(method)

    if (!waiters) {
      return
    }

    const index = waiters.indexOf(waiter)

    if (index !== -1) {
      waiters.splice(index, 1)
    }

    if (waiters.length === 0) {
      this.eventWaiters.delete(method)
    }
  }

  onMessage(event) {
    const message = JSON.parse(event.data)

    if (message.method) {
      const waiters = this.eventWaiters.get(message.method)

      if (waiters) {
        this.eventWaiters.delete(message.method)

        for (const waiter of waiters) {
          clearTimeout(waiter.timeout)
          waiter.resolve(message.params || {})
        }
      }
    }

    if (!message.id) {
      return
    }

    const pending = this.pending.get(message.id)

    if (!pending) {
      return
    }

    this.pending.delete(message.id)

    if (message.error) {
      pending.reject(new Error(`${message.error.message}: ${message.error.data || ''}`.trim()))
    } else {
      pending.resolve(message.result || {})
    }
  }

  rejectPending(error) {
    for (const pending of this.pending.values()) {
      pending.reject(error)
    }

    this.pending.clear()

    for (const [method, waiters] of this.eventWaiters.entries()) {
      for (const waiter of waiters) {
        clearTimeout(waiter.timeout)
        waiter.reject(
          new Error(`${method} was interrupted by Chrome DevTools WebSocket close`)
        )
      }
    }

    this.eventWaiters.clear()
  }
}

function telegramUrl(chat) {
  if (/^https:\/\/web\.telegram\.org\//.test(chat)) {
    return chat
  }

  const normalized = chat.startsWith('@') ? chat : `@${chat}`
  return `https://web.telegram.org/k/#${encodeURIComponent(normalized)}`
}

function openUploadFileChooserSource() {
  return String.raw`
async function openUploadFileChooser({chat, timeoutMs}) {
  const startedAt = Date.now();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const deadlineReached = () => Date.now() - startedAt > timeoutMs;
  const normalizedChat = chat.startsWith("@") ? chat : "@" + chat;
  const targetUrl = chat.startsWith("https://web.telegram.org/")
    ? chat
    : "https://web.telegram.org/k/#" + encodeURIComponent(normalizedChat);

  const visible = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };

  if (!location.href.includes("web.telegram.org")) {
    location.href = targetUrl;
  } else if (location.href !== targetUrl && normalizedChat.includes("@")) {
    location.href = targetUrl;
  }

  await waitForAuthenticatedUi();
  await openChatFromSearch(normalizedChat);
  await clickStartIfPresent();
  await closeStaleUploadPreview();
  await waitFor(() => Boolean(findComposer()), "Telegram Web message composer");

  const attachButton = await waitForValue(findAttachButton, "Telegram Web attach button");
  attachButton.click();

  const menuItem = await waitForValue(findDocumentMenuItem, "Telegram Web document attach menu item");
  menuItem.click();

  return true;

  async function waitFor(predicate, label) {
    while (!deadlineReached()) {
      if (predicate()) {
        return;
      }

      await sleep(250);
    }

    throw new Error("Timed out waiting for " + label);
  }

  async function waitForValue(finder, label) {
    let value = finder();

    while (!value && !deadlineReached()) {
      await sleep(250);
      value = finder();
    }

    if (!value) {
      throw new Error("Timed out waiting for " + label);
    }

    return value;
  }

  async function waitForAuthenticatedUi() {
    await waitFor(() => {
      const bodyText = document.body?.innerText || "";

      if (/Log in to Telegram|Scan QR code|Please choose your country|phone number/i.test(bodyText)) {
        throw new Error("Telegram Web profile is not logged in");
      }

      return Boolean(document.querySelector('input.input-search-input') || findComposer());
    }, "Telegram Web authenticated UI");
  }

  async function openChatFromSearch(targetHandle) {
    if (location.href.includes(encodeURIComponent(targetHandle)) || location.href.includes(targetHandle)) {
      return;
    }

    const searchInput = document.querySelector('input.input-search-input');

    if (!visible(searchInput)) {
      return;
    }

    searchInput.focus();
    searchInput.click();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

    if (setter) {
      setter.call(searchInput, targetHandle);
    } else {
      searchInput.value = targetHandle;
    }

    searchInput.dispatchEvent(new Event("input", {bubbles: true}));
    await sleep(750);

    const target = Array.from(document.querySelectorAll("a")).find((anchor) => {
      return visible(anchor) && (anchor.innerText || anchor.textContent || "").includes(targetHandle);
    });

    if (!target) {
      return;
    }

    for (const type of ["mouseover", "mousedown", "mouseup", "click"]) {
      target.dispatchEvent(new MouseEvent(type, {bubbles: true, cancelable: true, view: window, button: 0, buttons: 1}));
    }

    await sleep(1500);
  }

  async function clickStartIfPresent() {
    const startButton = Array.from(document.querySelectorAll("button")).find((button) => {
      return visible(button) && /^START$/i.test((button.innerText || button.textContent || "").trim());
    });

    if (!startButton) {
      return;
    }

    startButton.click();
    await sleep(1500);
  }

  async function closeStaleUploadPreview() {
    const preview = findUploadPreview();

    if (!preview) {
      return;
    }

    const closeButton = Array.from(preview.querySelectorAll("button, [role='button'], .btn-icon")).find((button) => {
      const text = [
        button.getAttribute("aria-label"),
        button.getAttribute("title"),
        button.textContent,
        button.className
      ].join(" ");

      return visible(button) && /close|cancel|\\uE956|\\uE858/i.test(text);
    });

    if (closeButton) {
      closeButton.click();
      await sleep(500);
    }
  }

  function findComposer() {
    const selectors = [".input-message-input", '[contenteditable="true"]', "textarea"];
    const candidates = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));

    return candidates.find((element) => {
      if (!visible(element)) return false;
      const label = [
        element.getAttribute("aria-label"),
        element.getAttribute("data-placeholder"),
        element.getAttribute("placeholder"),
        element.textContent,
        element.className
      ].join(" ");

      return /message|write|input|composer|editable/i.test(label) || candidates.length === 1;
    });
  }

  function findAttachButton() {
    const selectors = [
      'button[aria-label*="Attach" i]',
      'button[title*="Attach" i]',
      '[aria-label*="Attach" i]',
      '[title*="Attach" i]',
      '.btn-icon.attach',
      '.attach-file'
    ];

    for (const selector of selectors) {
      const button = Array.from(document.querySelectorAll(selector)).find(visible);

      if (button) {
        return button;
      }
    }

    return Array.from(document.querySelectorAll("button, .btn-icon, .c-ripple")).find((element) => {
      const text = [
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        element.textContent,
        element.className
      ].join(" ");
      return visible(element) && /attach|paperclip|clip/i.test(text);
    });
  }

  function findDocumentMenuItem() {
    const menuItems = Array.from(document.querySelectorAll(".btn-menu-item, [role='menuitem'], button"));

    return menuItems.find((item) => {
      const text = (item.innerText || item.textContent || "").replace(/\\s+/g, " ").trim();
      return visible(item) && /document|file/i.test(text);
    }) || menuItems.find((item) => visible(item) && /photo|video|media/i.test(item.innerText || item.textContent || ""));
  }

  function findUploadPreview() {
    const selectors = [
      ".popup-send-photo.active",
      ".popup-new-media.active",
      ".popup.active",
      ".modal.active",
      "[role='dialog']"
    ];

    for (const selector of selectors) {
      const preview = Array.from(document.querySelectorAll(selector)).find((element) => {
        if (!visible(element)) return false;
        const text = element.innerText || element.textContent || "";
        return /send file|add a caption|send/i.test(text);
      });

      if (preview) {
        return preview;
      }
    }

    return null;
  }
}
`
}

function uploadAndVerifySource() {
  return String.raw`
async function uploadAndVerify({caption, expectedTexts, fileName, send, timeoutMs}) {
  const startedAt = Date.now();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const deadlineReached = () => Date.now() - startedAt > timeoutMs;
  const visible = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };

  const preview = await waitForValue(findUploadPreview, "Telegram upload preview");
  await waitFor(() => previewLooksReady(preview) && Boolean(findPreviewSendButton(preview)), "Telegram upload preview ready");

  if (caption) {
    const captionInput = findCaptionInput(preview);

    if (captionInput) {
      captionInput.focus();

      if (captionInput.isContentEditable) {
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, caption);
      } else {
        captionInput.textContent = caption;
      }

      captionInput.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "insertText", data: caption}));
      await sleep(250);
    }
  }

  let sent = false;

  if (send) {
    const button = await waitForValue(() => findPreviewSendButton(preview), "Telegram upload send button");
    button.click();
    sent = true;
    await sleep(1500);
  }

  for (const text of expectedTexts || []) {
    await waitFor(() => (document.body?.innerText || "").includes(text), "expected text: " + text);
  }

  const bodyText = document.body?.innerText || "";
  const previewText = (preview.innerText || preview.textContent || "").replace(/\s+/g, " ").trim();

  return {
    sent,
    verified: (expectedTexts || []).length === 0 || (expectedTexts || []).every((text) => bodyText.includes(text)),
    url: location.href,
    title: document.title,
    visibleMessages: collectVisibleMessages(),
    diagnostics: {
      fileNameVisible: bodyText.includes(fileName) || previewContainsFileName(previewText, fileName),
      previewText: previewText.slice(0, 500),
      captionVisible: caption ? bodyText.includes(caption) : null,
      expectedTextsVisible: (expectedTexts || []).map((text) => ({
        text,
        visible: bodyText.includes(text)
      }))
    }
  };

  async function waitFor(predicate, label) {
    while (!deadlineReached()) {
      if (predicate()) {
        return;
      }

      await sleep(250);
    }

    throw new Error("Timed out waiting for " + label);
  }

  async function waitForValue(finder, label) {
    let value = finder();

    while (!value && !deadlineReached()) {
      await sleep(250);
      value = finder();
    }

    if (!value) {
      throw new Error("Timed out waiting for " + label);
    }

    return value;
  }

  function findCaptionInput(preview) {
    const selectors = [
      '[contenteditable="true"][data-placeholder*="caption" i]',
      '[contenteditable="true"][aria-label*="caption" i]',
      '.input-field-input[contenteditable="true"]',
      '.input-message-input[contenteditable="true"]',
      '[contenteditable="true"]',
      'textarea'
    ];

    for (const selector of selectors) {
      const input = Array.from(preview.querySelectorAll(selector)).find((element) => {
        if (!visible(element)) return false;
        const label = [
          element.getAttribute("aria-label"),
          element.getAttribute("data-placeholder"),
          element.getAttribute("placeholder"),
          element.className
        ].join(" ");
        return /caption|message|add/i.test(label) || selector === '[contenteditable="true"]';
      });

      if (input) {
        return input;
      }
    }

    return null;
  }

  function findPreviewSendButton(preview) {
    const selectors = [
      'button[aria-label*="Send" i]',
      'button[title*="Send" i]',
      'button.btn-primary',
      '.btn-primary',
      '.popup-send',
      '[role="button"]'
    ];

    for (const selector of selectors) {
      const button = Array.from(preview.querySelectorAll(selector)).find((element) => {
        if (!visible(element)) return false;
        const text = [
          element.getAttribute("aria-label"),
          element.getAttribute("title"),
          element.textContent,
          element.className
        ].join(" ");
        return /send/i.test(text);
      });

      if (button) {
        return button;
      }
    }

    return Array.from(preview.querySelectorAll("button")).find((button) => {
      return visible(button) && /send/i.test(button.getAttribute("aria-label") || button.title || button.textContent || "");
    });
  }

  function findUploadPreview() {
    const selectors = [
      ".popup-send-photo.active",
      ".popup-new-media.active",
      ".popup.active",
      ".modal.active",
      "[role='dialog']"
    ];

    for (const selector of selectors) {
      const preview = Array.from(document.querySelectorAll(selector)).find((element) => {
        if (!visible(element)) return false;
        const text = element.innerText || element.textContent || "";
        return text.includes(fileName) || /send file|add a caption/i.test(text);
      });

      if (preview) {
        return preview;
      }
    }

    return null;
  }

  function previewLooksReady(preview) {
    const text = (preview.innerText || preview.textContent || "").replace(/\s+/g, " ").trim();
    return previewContainsFileName(text, fileName) || /send file|add a caption|\d+\s*(kb|mb|gb)|0:00/i.test(text);
  }

  function previewContainsFileName(text, fileName) {
    if (!text || !fileName) {
      return false;
    }

    if (text.includes(fileName)) {
      return true;
    }

    const extension = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
    const prefix = fileName.slice(0, 16);
    const suffix = extension || fileName.slice(-12);

    return text.includes(prefix) && (!suffix || text.includes(suffix));
  }

  function collectVisibleMessages() {
    const selectors = [
      ".message",
      ".Message",
      '[class*="message"]',
      '[data-message-id]'
    ];
    const seen = new Set();
    const messages = [];

    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        if (!visible(element)) continue;

        const text = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();

        if (!text || seen.has(text)) continue;

        seen.add(text);
        messages.push(text.slice(0, 500));
      }
    }

    return messages.slice(-20);
  }
}
`
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
