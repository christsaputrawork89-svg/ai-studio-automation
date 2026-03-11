(function () {
  if (window.__aiStudioAutoLoaded) return;
  window.__aiStudioAutoLoaded = true;

  let isRunning = false;
  let promptQueue = [];
  let currentIndex = 0;
  let config = { delay: 30 };

  function getInputField() {
    const selectors = [
      'textarea[placeholder*="Start typing a prompt"]',
      'textarea[placeholder*="Enter a prompt"]',
      'textarea[aria-label*="prompt"]',
      '.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function getRunButton() {
    const submitBtns = document.querySelectorAll('button[type="submit"]');
    for (const btn of submitBtns) {
      if (btn.textContent.includes('Run')) return btn;
    }
    const allBtns = document.querySelectorAll('button');
    for (const btn of allBtns) {
      if (btn.textContent.trim().startsWith('Run')) return btn;
    }
    return null;
  }

  function setPromptText(text) {
    const input = getInputField();
    if (!input) return false;
    input.focus();
    input.click();
    if (input.tagName === 'TEXTAREA') {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      ).set;
      nativeSetter.call(input, text);
    } else {
      input.innerText = text;
    }
    input.dispatchEvent(new Event('focus', { bubbles: true }));
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function clickRun() {
    const runBtn = getRunButton();
    if (runBtn && !runBtn.disabled) {
      runBtn.click();
      return true;
    }
    const input = getInputField();
    if (input) {
      input.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13,
        ctrlKey: true, bubbles: true, composed: true
      }));
      return true;
    }
    return false;
  }

  function waitForResponse(timeoutMs) {
    timeoutMs = timeoutMs || 300000;
    return new Promise(function(resolve) {
      var elapsed = 0;
      var interval = 1000;
      setTimeout(function() {
        var checker = setInterval(function() {
          elapsed += interval;
          var runBtn = getRunButton();
          var runReady = runBtn && !runBtn.disabled;
          if (runReady || elapsed >= timeoutMs) {
            clearInterval(checker);
            resolve(true);
          }
        }, interval);
      }, 3000);
    });
  }

  function sleep(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
  }

  function sendStatus(status, detail) {
    window.postMessage({
      source: 'AI_STUDIO_AUTO_CONTENT',
      type: 'STATUS_UPDATE',
      status: status,
      detail: detail || '',
      current: currentIndex,
      total: promptQueue.length
    }, '*');
  }

  async function processQueue() {
    if (!isRunning || currentIndex >= promptQueue.length) {
      isRunning = false;
      sendStatus('completed');
      return;
    }
    var prompt = promptQueue[currentIndex];
    sendStatus('processing', '[' + (currentIndex+1) + '/' + promptQueue.length + '] Processing...');
    var ok = setPromptText(prompt);
    if (!ok) {
      sendStatus('error', 'Input field not found');
      isRunning = false;
      return;
    }
    await sleep(1000);
    var submitted = clickRun();
    if (!submitted) {
      await sleep(1000);
      clickRun();
    }
    sendStatus('generating', '[' + (currentIndex+1) + '/' + promptQueue.length + '] Waiting for AI...');
    await waitForResponse();
    if (currentIndex < promptQueue.length - 1) {
      sendStatus('delay', 'Waiting ' + config.delay + 's...');
      await sleep(config.delay * 1000);
    }
    currentIndex++;
    processQueue();
  }

  window.addEventListener('message', function(event) {
    if (!event.data || event.data.source !== 'AI_STUDIO_AUTO_POPUP') return;
    if (event.data.type === 'START') {
      promptQueue = event.data.prompts || [];
      config.delay = event.data.delay || 30;
      currentIndex = 0;
      isRunning = true;
      processQueue();
    }
    if (event.data.type === 'STOP') {
      isRunning = false;
      sendStatus('stopped');
    }
    if (event.data.type === 'PING') {
      sendStatus('ready');
    }
  });

  sendStatus('ready');
  console.log('[AI Studio Auto] Content script loaded.');
})();
