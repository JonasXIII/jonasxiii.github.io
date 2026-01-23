// Scientific Calculator
const display = document.getElementById('calc-display');
const expressionDisplay = document.getElementById('calc-expression');
const memoryIndicator = document.getElementById('memory-indicator');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');

let currentValue = '0';
let expression = '';
let memory = 0;
let history = [];
let isNewNumber = true;
let angleMode = 'deg'; // deg or rad

// Initialize
function init() {
    updateDisplay();
    loadHistory();
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    // Number buttons
    document.querySelectorAll('.num-btn').forEach(btn => {
        btn.addEventListener('click', () => handleNumber(btn.dataset.value));
    });

    // Action buttons
    document.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => handleAction(btn.dataset.action));
    });

    // Clear history
    clearHistoryBtn.addEventListener('click', clearHistory);

    // Keyboard support
    document.addEventListener('keydown', handleKeyboard);
}

// Handle number input
function handleNumber(num) {
    if (isNewNumber) {
        currentValue = num;
        isNewNumber = false;
    } else {
        if (num === '.' && currentValue.includes('.')) return;
        currentValue = currentValue === '0' ? num : currentValue + num;
    }
    updateDisplay();
}

// Handle actions
function handleAction(action) {
    switch (action) {
        case 'clear':
            clear();
            break;
        case 'backspace':
            backspace();
            break;
        case '=':
            calculate();
            break;
        case '+':
        case '-':
        case '*':
        case '/':
            handleOperator(action);
            break;
        case '(':
        case ')':
            handleParenthesis(action);
            break;
        case '%':
            handlePercent();
            break;
        case '±':
            toggleSign();
            break;
        case 'sin':
        case 'cos':
        case 'tan':
            handleTrig(action);
            break;
        case 'sqrt':
            handleSqrt();
            break;
        case 'pow':
            handlePower();
            break;
        case 'log':
            handleLog();
            break;
        case 'ln':
            handleLn();
            break;
        case 'exp':
            handleExp();
            break;
        case 'pi':
            insertConstant(Math.PI);
            break;
        case 'e':
            insertConstant(Math.E);
            break;
        case '1/x':
            handleReciprocal();
            break;
        case 'mc':
            memoryСlear();
            break;
        case 'mr':
            memoryRecall();
            break;
        case 'ms':
            memoryStore();
            break;
        case 'm+':
            memoryAdd();
            break;
        case 'm-':
            memorySubtract();
            break;
    }
}

// Clear all
function clear() {
    currentValue = '0';
    expression = '';
    isNewNumber = true;
    updateDisplay();
}

// Backspace
function backspace() {
    if (currentValue.length > 1) {
        currentValue = currentValue.slice(0, -1);
    } else {
        currentValue = '0';
    }
    updateDisplay();
}

// Handle operators
function handleOperator(op) {
    if (!isNewNumber) {
        expression += currentValue;
        isNewNumber = true;
    }
    expression += ` ${op} `;
    updateDisplay();
}

// Handle parenthesis
function handleParenthesis(paren) {
    if (paren === '(' && !isNewNumber) {
        expression += currentValue + ' * ';
        isNewNumber = true;
    }
    expression += paren;
    updateDisplay();
}

// Handle percent
function handlePercent() {
    const num = parseFloat(currentValue);
    currentValue = (num / 100).toString();
    isNewNumber = true;
    updateDisplay();
}

// Toggle sign
function toggleSign() {
    const num = parseFloat(currentValue);
    currentValue = (-num).toString();
    updateDisplay();
}

// Trigonometric functions
function handleTrig(func) {
    const num = parseFloat(currentValue);
    let angle = angleMode === 'deg' ? num * Math.PI / 180 : num;
    let result;

    switch (func) {
        case 'sin':
            result = Math.sin(angle);
            break;
        case 'cos':
            result = Math.cos(angle);
            break;
        case 'tan':
            result = Math.tan(angle);
            break;
    }

    currentValue = result.toString();
    isNewNumber = true;
    updateDisplay();
}

// Square root
function handleSqrt() {
    const num = parseFloat(currentValue);
    currentValue = Math.sqrt(num).toString();
    isNewNumber = true;
    updateDisplay();
}

// Power (square)
function handlePower() {
    const num = parseFloat(currentValue);
    currentValue = Math.pow(num, 2).toString();
    isNewNumber = true;
    updateDisplay();
}

// Logarithm base 10
function handleLog() {
    const num = parseFloat(currentValue);
    currentValue = Math.log10(num).toString();
    isNewNumber = true;
    updateDisplay();
}

// Natural logarithm
function handleLn() {
    const num = parseFloat(currentValue);
    currentValue = Math.log(num).toString();
    isNewNumber = true;
    updateDisplay();
}

// Exponential
function handleExp() {
    const num = parseFloat(currentValue);
    currentValue = Math.exp(num).toString();
    isNewNumber = true;
    updateDisplay();
}

// Reciprocal
function handleReciprocal() {
    const num = parseFloat(currentValue);
    if (num !== 0) {
        currentValue = (1 / num).toString();
    } else {
        currentValue = 'Error';
    }
    isNewNumber = true;
    updateDisplay();
}

// Insert constant
function insertConstant(value) {
    currentValue = value.toString();
    isNewNumber = true;
    updateDisplay();
}

// Calculate result
function calculate() {
    try {
        let fullExpression = expression + (isNewNumber ? '' : currentValue);

        // Replace visual operators with JavaScript operators
        fullExpression = fullExpression.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');

        const result = eval(fullExpression);

        // Add to history
        addToHistory(fullExpression, result);

        // Update display
        expression = '';
        currentValue = result.toString();
        isNewNumber = true;
        updateDisplay();
    } catch (error) {
        currentValue = 'Error';
        expression = '';
        isNewNumber = true;
        updateDisplay();
    }
}

// Memory functions
function memoryСlear() {
    memory = 0;
    updateMemoryIndicator();
}

function memoryRecall() {
    currentValue = memory.toString();
    isNewNumber = true;
    updateDisplay();
}

function memoryStore() {
    memory = parseFloat(currentValue);
    updateMemoryIndicator();
}

function memoryAdd() {
    memory += parseFloat(currentValue);
    updateMemoryIndicator();
}

function memorySubtract() {
    memory -= parseFloat(currentValue);
    updateMemoryIndicator();
}

function updateMemoryIndicator() {
    memoryIndicator.textContent = memory !== 0 ? 'M' : '';
}

// Update display
function updateDisplay() {
    display.textContent = currentValue;
    expressionDisplay.textContent = expression || ' ';
}

// History management
function addToHistory(expr, result) {
    const historyItem = {
        expression: expr,
        result: result,
        timestamp: new Date().toLocaleTimeString()
    };

    history.unshift(historyItem);
    if (history.length > 20) history.pop(); // Keep only last 20

    saveHistory();
    renderHistory();
}

function renderHistory() {
    historyList.innerHTML = '';

    if (history.length === 0) {
        historyList.innerHTML = '<div class="history-empty">No calculations yet</div>';
        return;
    }

    history.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <div class="history-expression">${item.expression}</div>
            <div class="history-result">= ${item.result}</div>
            <div class="history-time">${item.timestamp}</div>
        `;
        historyItem.addEventListener('click', () => {
            currentValue = item.result.toString();
            isNewNumber = true;
            updateDisplay();
        });
        historyList.appendChild(historyItem);
    });
}

function clearHistory() {
    history = [];
    saveHistory();
    renderHistory();
}

function saveHistory() {
    localStorage.setItem('calculatorHistory', JSON.stringify(history));
}

function loadHistory() {
    const saved = localStorage.getItem('calculatorHistory');
    if (saved) {
        history = JSON.parse(saved);
        renderHistory();
    }
}

// Keyboard support
function handleKeyboard(e) {
    const key = e.key;

    if (key >= '0' && key <= '9' || key === '.') {
        handleNumber(key);
    } else if (key === '+' || key === '-' || key === '*' || key === '/') {
        handleOperator(key);
    } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        calculate();
    } else if (key === 'Escape') {
        clear();
    } else if (key === 'Backspace') {
        e.preventDefault();
        backspace();
    } else if (key === '(' || key === ')') {
        handleParenthesis(key);
    } else if (key === '%') {
        handlePercent();
    }
}

// Initialize calculator
init();
