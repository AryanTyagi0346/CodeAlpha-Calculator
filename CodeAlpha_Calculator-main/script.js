document.addEventListener('DOMContentLoaded', () => {

  const mainDisplay = document.getElementById('mainDisplay');
  const expressionDisplay = document.getElementById('expressionDisplay');
  const previewDisplay = document.getElementById('previewDisplay');
  const historyPanel = document.getElementById('historyPanel');
  const historyList = document.getElementById('historyList');
  const memoryIndicator = document.getElementById('memoryIndicator');
  
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundIcon = document.getElementById('soundIcon');
  const historyToggleBtn = document.getElementById('historyToggleBtn');
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  let currentInput = '0';
  let fullExpression = '';
  let memoryValue = 0;
  let history = JSON.parse(localStorage.getItem('auracalc_history') || '[]');
  let soundEnabled = localStorage.getItem('auracalc_sound') !== 'false';

  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
  }

  function playClickSound(freq = 600, type = 'sine', duration = 0.04) {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Audio playback error', e);
    }
  }

  soundToggleBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('auracalc_sound', soundEnabled);
    updateSoundIcon();
    if (soundEnabled) playClickSound(700);
  });

  function updateSoundIcon() {
    if (soundEnabled) {
      soundIcon.setAttribute('data-lucide', 'volume-2');
      soundToggleBtn.classList.remove('active');
    } else {
      soundIcon.setAttribute('data-lucide', 'volume-x');
      soundToggleBtn.classList.add('active');
    }
    lucide.createIcons();
  }

  historyToggleBtn.addEventListener('click', () => {
    playClickSound(500);
    historyPanel.classList.toggle('collapsed');
  });

  closeHistoryBtn.addEventListener('click', () => {
    playClickSound(400);
    historyPanel.classList.add('collapsed');
  });

  clearHistoryBtn.addEventListener('click', () => {
    playClickSound(300, 'sawtooth');
    history = [];
    localStorage.removeItem('auracalc_history');
    renderHistory();
  });

  function saveHistory(expr, result) {
    if (!expr || result === 'Error') return;
    history.unshift({ expr, result, timestamp: Date.now() });
    if (history.length > 50) history.pop();
    localStorage.setItem('auracalc_history', JSON.stringify(history));
    renderHistory();
  }

  function renderHistory() {
    if (history.length === 0) {
      historyList.innerHTML = `
        <div class="empty-history">
          <i data-lucide="history" class="empty-icon"></i>
          <p>No calculations yet</p>
          <span>Your calculations will appear here</span>
        </div>`;
      lucide.createIcons();
      return;
    }

    historyList.innerHTML = history.map((item, index) => `
      <div class="history-item" data-index="${index}">
        <div class="history-expr">${escapeHtml(item.expr)} =</div>
        <div class="history-val">${escapeHtml(item.result)}</div>
      </div>
    `).join('');

    document.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.getAttribute('data-index'));
        const target = history[idx];
        if (target) {
          playClickSound(650);
          currentInput = target.result;
          fullExpression = '';
          updateDisplay();
        }
      });
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  updateSoundIcon();
  renderHistory();

  function updateDisplay() {
    if (currentInput.length > 12) {
      mainDisplay.style.fontSize = '1.6rem';
    } else if (currentInput.length > 8) {
      mainDisplay.style.fontSize = '2rem';
    } else {
      mainDisplay.style.fontSize = '2.5rem';
    }

    mainDisplay.textContent = formatNumberForDisplay(currentInput);
    expressionDisplay.textContent = formatExpressionForDisplay(fullExpression);

    updateRealtimePreview();
  }

  function formatNumberForDisplay(str) {
    if (str === 'Error' || str === 'Infinity' || str === '-Infinity' || str === 'NaN') return str;
    if (str.endsWith('.') || str.includes('e')) return str;
    
    const parts = str.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1] !== undefined ? '.' + parts[1] : '';
    
    if (!isNaN(integerPart) && Math.abs(parseFloat(integerPart)) < 1e15) {
      const formattedInt = Number(integerPart).toLocaleString('en-US');
      return formattedInt + decimalPart;
    }
    return str;
  }

  function formatExpressionForDisplay(expr) {
    return expr
      .replace(/\*/g, ' × ')
      .replace(/\//g, ' ÷ ')
      .replace(/\+/g, ' + ')
      .replace(/\-/g, ' − ')
      .replace(/\^/g, ' ^ ');
  }

  function updateRealtimePreview() {
    if (!fullExpression || fullExpression.trim() === '') {
      previewDisplay.textContent = '';
      return;
    }

    let exprToTest = fullExpression + currentInput;
    try {
      const res = evaluateMathExpression(exprToTest);
      if (res !== null && !isNaN(res) && isFinite(res) && String(res) !== currentInput) {
        previewDisplay.textContent = `= ${formatNumberForDisplay(cleanFloat(res).toString())}`;
      } else {
        previewDisplay.textContent = '';
      }
    } catch (e) {
      previewDisplay.textContent = '';
    }
  }

  function evaluateMathExpression(expr) {
    if (!expr) return null;
    
    let sanitized = expr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/\^/g, '**');

    if (!/^[0-9+\-*/().%\s*]+$/.test(sanitized.replace(/\*\*/g, '*'))) {
      return null;
    }

    sanitized = sanitized.trim();
    if (/[+\-*/]$/.test(sanitized)) {
      sanitized = sanitized.slice(0, -1);
    }

    try {
      const result = new Function(`'use strict'; return (${sanitized})`)();
      return result;
    } catch (e) {
      return null;
    }
  }

  function cleanFloat(num) {
    if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) return num;
    return parseFloat(num.toPrecision(12));
  }

  function handleDigit(digit) {
    playClickSound(550);
    if (currentInput === '0' || currentInput === 'Error') {
      currentInput = digit;
    } else {
      if (currentInput.replace('-', '').length < 16) {
        currentInput += digit;
      }
    }
    updateDisplay();
  }

  function handleDecimal() {
    playClickSound(580);
    if (currentInput === 'Error') currentInput = '0';
    if (!currentInput.includes('.')) {
      currentInput += '.';
    }
    updateDisplay();
  }

  function handleOperator(op) {
    playClickSound(620);
    if (currentInput === 'Error') return;

    if (currentInput !== '') {
      fullExpression += currentInput + ' ' + op + ' ';
      currentInput = '0';
    } else if (fullExpression !== '') {
      fullExpression = fullExpression.replace(/[+\-*/^]\s*$/, op + ' ');
    }
    updateDisplay();
  }

  function handleEquals() {
    playClickSound(750, 'sine', 0.08);
    if (currentInput === 'Error') return;

    const exprToSolve = fullExpression + currentInput;
    if (!exprToSolve || exprToSolve.trim() === '') return;

    try {
      const rawResult = evaluateMathExpression(exprToSolve);
      if (rawResult === null || isNaN(rawResult) || !isFinite(rawResult)) {
        currentInput = 'Error';
      } else {
        const cleaned = cleanFloat(rawResult).toString();
        saveHistory(exprToSolve, cleaned);
        currentInput = cleaned;
        fullExpression = '';
      }
    } catch (e) {
      currentInput = 'Error';
    }

    updateDisplay();
  }

  function handleClearAll() {
    playClickSound(450, 'sawtooth');
    currentInput = '0';
    fullExpression = '';
    previewDisplay.textContent = '';
    updateDisplay();
  }

  function handleDelete() {
    playClickSound(480);
    if (currentInput === 'Error') {
      currentInput = '0';
    } else if (currentInput.length > 1) {
      currentInput = currentInput.slice(0, -1);
      if (currentInput === '-' || currentInput === '') currentInput = '0';
    } else {
      currentInput = '0';
    }
    updateDisplay();
  }

  function handlePercent() {
    playClickSound(600);
    if (currentInput === 'Error') return;
    const val = parseFloat(currentInput);
    if (!isNaN(val)) {
      currentInput = cleanFloat(val / 100).toString();
      updateDisplay();
    }
  }

  function handleSqrt() {
    playClickSound(640);
    if (currentInput === 'Error') return;
    const val = parseFloat(currentInput);
    if (!isNaN(val)) {
      if (val < 0) {
        currentInput = 'Error';
      } else {
        currentInput = cleanFloat(Math.sqrt(val)).toString();
      }
      updateDisplay();
    }
  }

  function handleNegate() {
    playClickSound(580);
    if (currentInput === 'Error' || currentInput === '0') return;
    if (currentInput.startsWith('-')) {
      currentInput = currentInput.slice(1);
    } else {
      currentInput = '-' + currentInput;
    }
    updateDisplay();
  }

  function handleParenthesis() {
    playClickSound(600);
    const openCount = (fullExpression.match(/\(/g) || []).length;
    const closeCount = (fullExpression.match(/\)/g) || []).length;

    if (openCount > closeCount && currentInput !== '0' && currentInput !== '') {
      fullExpression += currentInput + ' ) ';
      currentInput = '0';
    } else {
      if (currentInput === '0') {
        fullExpression += ' ( ';
      } else {
        fullExpression += currentInput + ' * ( ';
        currentInput = '0';
      }
    }
    updateDisplay();
  }

  function handleMemory(action) {
    playClickSound(680);
    const curr = parseFloat(currentInput) || 0;

    switch (action) {
      case 'mc':
        memoryValue = 0;
        memoryIndicator.style.display = 'none';
        break;
      case 'mr':
        currentInput = cleanFloat(memoryValue).toString();
        updateDisplay();
        break;
      case 'm-plus':
        memoryValue += curr;
        memoryIndicator.style.display = 'inline-block';
        break;
      case 'm-minus':
        memoryValue -= curr;
        memoryIndicator.style.display = 'inline-block';
        break;
    }
  }

  document.querySelectorAll('.key').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.getAttribute('data-action');
      const val = button.getAttribute('data-value');

      if (val && !action) {
        handleDigit(val);
      } else if (action === 'operator') {
        handleOperator(val);
      } else if (action === 'equals') {
        handleEquals();
      } else if (action === 'clear-all') {
        handleClearAll();
      } else if (action === 'delete') {
        handleDelete();
      } else if (action === 'percent') {
        handlePercent();
      } else if (action === 'sqrt') {
        handleSqrt();
      } else if (action === 'power') {
        handleOperator('^');
      } else if (action === 'negate') {
        handleNegate();
      } else if (action === 'paren') {
        handleParenthesis();
      }
    });
  });

  document.querySelectorAll('.mem-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      handleMemory(action);
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    let key = e.key;
    let targetButton = null;

    if (key >= '0' && key <= '9') {
      handleDigit(key);
      targetButton = document.querySelector(`.key[data-value="${key}"]`);
    } else if (key === '.') {
      handleDecimal();
      targetButton = document.querySelector(`.key[data-value="."]`);
    } else if (key === '+' || key === '-' || key === '*' || key === '/') {
      handleOperator(key);
      targetButton = document.querySelector(`.key[data-value="${key}"]`);
    } else if (key === 'Enter' || key === '=') {
      e.preventDefault();
      handleEquals();
      targetButton = document.querySelector('.equals-key');
    } else if (key === 'Backspace') {
      e.preventDefault();
      handleDelete();
      targetButton = document.querySelector('.key[data-action="delete"]');
    } else if (key === 'Escape' || key.toLowerCase() === 'c') {
      e.preventDefault();
      handleClearAll();
      targetButton = document.querySelector('.clear-key');
    } else if (key === '%') {
      handlePercent();
      targetButton = document.querySelector('.key[data-action="percent"]');
    } else if (key === '^') {
      handleOperator('^');
      targetButton = document.querySelector('.key[data-action="power"]');
    } else if (key.toLowerCase() === 's') {
      handleSqrt();
      targetButton = document.querySelector('.key[data-action="sqrt"]');
    } else if (key.toLowerCase() === 'n') {
      handleNegate();
      targetButton = document.querySelector('.key[data-action="negate"]');
    } else if (key === '(' || key === ')') {
      handleParenthesis();
      targetButton = document.querySelector('.key[data-action="paren"]');
    }

    if (targetButton) {
      targetButton.classList.add('pressed');
      setTimeout(() => targetButton.classList.remove('pressed'), 150);
    }
  });

  updateDisplay();
});
