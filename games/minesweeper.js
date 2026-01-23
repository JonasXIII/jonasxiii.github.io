// Minesweeper Game
const boardElement = document.getElementById('minesweeper-board');
const statusElement = document.getElementById('game-status-mine');
const minesCountElement = document.getElementById('mines-count');
const timeCountElement = document.getElementById('time-count');
const resetBtn = document.getElementById('reset-mine-btn');
const beginnerBtn = document.getElementById('beginner-btn');
const intermediateBtn = document.getElementById('intermediate-btn');

let rows = 8;
let cols = 8;
let mineCount = 10;
let board = [];
let revealed = [];
let flagged = [];
let gameActive = false;
let gameStarted = false;
let timer = null;
let timeElapsed = 0;

// Create the board
function createBoard() {
    boardElement.innerHTML = '';
    boardElement.style.gridTemplateColumns = `repeat(${cols}, 30px)`;
    boardElement.style.gridTemplateRows = `repeat(${rows}, 30px)`;
    boardElement.className = 'minesweeper-grid';

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement('div');
            cell.classList.add('mine-cell');
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener('click', handleCellClick);
            cell.addEventListener('contextmenu', handleRightClick);

            if (revealed[r][c]) {
                cell.classList.add('revealed');
                if (board[r][c] === 'M') {
                    cell.textContent = '💣';
                    cell.classList.add('mine');
                } else if (board[r][c] > 0) {
                    cell.textContent = board[r][c];
                    cell.classList.add(`num-${board[r][c]}`);
                }
            } else if (flagged[r][c]) {
                cell.textContent = '🚩';
                cell.classList.add('flagged');
            }

            boardElement.appendChild(cell);
        }
    }

    updateMinesCount();
}

// Initialize game
function initGame() {
    board = Array.from({ length: rows }, () => Array(cols).fill(0));
    revealed = Array.from({ length: rows }, () => Array(cols).fill(false));
    flagged = Array.from({ length: rows }, () => Array(cols).fill(false));
    gameActive = true;
    gameStarted = false;
    timeElapsed = 0;
    timeCountElement.textContent = '0';
    statusElement.textContent = 'Right-click to flag mines';
    statusElement.style.color = 'black';

    if (timer) clearInterval(timer);

    createBoard();
}

// Place mines (after first click)
function placeMines(firstRow, firstCol) {
    let minesPlaced = 0;

    while (minesPlaced < mineCount) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);

        // Don't place mine on first click or if already a mine
        if ((r === firstRow && c === firstCol) || board[r][c] === 'M') {
            continue;
        }

        board[r][c] = 'M';
        minesPlaced++;
    }

    // Calculate numbers
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c] !== 'M') {
                board[r][c] = countAdjacentMines(r, c);
            }
        }
    }
}

// Count adjacent mines
function countAdjacentMines(row, col) {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
                if (board[newRow][newCol] === 'M') count++;
            }
        }
    }
    return count;
}

// Handle cell click
function handleCellClick(event) {
    if (!gameActive) return;

    const row = parseInt(event.target.dataset.row);
    const col = parseInt(event.target.dataset.col);

    if (revealed[row][col] || flagged[row][col]) return;

    // First click - place mines
    if (!gameStarted) {
        placeMines(row, col);
        gameStarted = true;
        startTimer();
    }

    revealCell(row, col);
}

// Reveal cell
function revealCell(row, col) {
    if (row < 0 || row >= rows || col < 0 || col >= cols) return;
    if (revealed[row][col] || flagged[row][col]) return;

    revealed[row][col] = true;

    if (board[row][col] === 'M') {
        gameOver(false);
        return;
    }

    // Recursive reveal if empty cell
    if (board[row][col] === 0) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                revealCell(row + dr, col + dc);
            }
        }
    }

    createBoard();
    checkWin();
}

// Handle right click (flag)
function handleRightClick(event) {
    event.preventDefault();

    if (!gameActive) return;

    const row = parseInt(event.target.dataset.row);
    const col = parseInt(event.target.dataset.col);

    if (revealed[row][col]) return;

    flagged[row][col] = !flagged[row][col];
    createBoard();
}

// Update mines count
function updateMinesCount() {
    const flagCount = flagged.flat().filter(f => f).length;
    minesCountElement.textContent = mineCount - flagCount;
}

// Start timer
function startTimer() {
    timer = setInterval(() => {
        timeElapsed++;
        timeCountElement.textContent = timeElapsed;
    }, 1000);
}

// Check win
function checkWin() {
    let revealedCount = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (revealed[r][c]) revealedCount++;
        }
    }

    if (revealedCount === rows * cols - mineCount) {
        gameOver(true);
    }
}

// Game over
function gameOver(won) {
    gameActive = false;
    clearInterval(timer);

    // Reveal all mines
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c] === 'M') {
                revealed[r][c] = true;
            }
        }
    }

    createBoard();

    if (won) {
        statusElement.textContent = `You won in ${timeElapsed} seconds!`;
        statusElement.style.color = 'green';
    } else {
        statusElement.textContent = 'Game Over! You hit a mine!';
        statusElement.style.color = 'red';
    }
}

// Difficulty selection
beginnerBtn.addEventListener('click', () => {
    rows = 8;
    cols = 8;
    mineCount = 10;
    updateDifficultyButtons('beginner');
    initGame();
});

intermediateBtn.addEventListener('click', () => {
    rows = 16;
    cols = 16;
    mineCount = 40;
    updateDifficultyButtons('intermediate');
    initGame();
});

function updateDifficultyButtons(difficulty) {
    [beginnerBtn, intermediateBtn].forEach(btn => btn.classList.remove('active'));
    if (difficulty === 'beginner') beginnerBtn.classList.add('active');
    if (difficulty === 'intermediate') intermediateBtn.classList.add('active');
}

resetBtn.addEventListener('click', initGame);

// Initialize
initGame();
