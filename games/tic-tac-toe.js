// Tic-Tac-Toe with AI
const boardElement = document.getElementById('tic-tac-toe-board');
const statusElement = document.getElementById('game-status');
const resetBtn = document.getElementById('reset-btn');
const easyBtn = document.getElementById('easy-btn');
const mediumBtn = document.getElementById('medium-btn');
const hardBtn = document.getElementById('hard-btn');

let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X'; // Player is X, AI is O
let gameActive = true;
let difficulty = 'easy'; // easy, medium, hard

const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
];

// Create the board
function createBoard() {
    boardElement.innerHTML = '';
    boardElement.className = 'tic-tac-toe-grid';

    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.classList.add('tic-tac-toe-cell');
        cell.dataset.index = i;
        cell.addEventListener('click', handleCellClick);
        if (board[i]) {
            cell.textContent = board[i];
            cell.classList.add('filled');
        }
        boardElement.appendChild(cell);
    }
}

// Handle cell click
function handleCellClick(event) {
    const index = parseInt(event.target.dataset.index);

    if (board[index] !== '' || !gameActive || currentPlayer !== 'X') {
        return;
    }

    makeMove(index, 'X');

    if (gameActive) {
        currentPlayer = 'O';
        statusElement.textContent = 'AI is thinking...';
        setTimeout(makeAIMove, 500);
    }
}

// Make a move
function makeMove(index, player) {
    board[index] = player;
    createBoard();
    checkResult();
}

// Check game result
function checkResult() {
    let roundWon = false;

    for (let condition of winningConditions) {
        const [a, b, c] = condition;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            roundWon = true;
            highlightWinningCells(condition);
            break;
        }
    }

    if (roundWon) {
        statusElement.textContent = currentPlayer === 'X' ? 'You win!' : 'AI wins!';
        statusElement.style.color = currentPlayer === 'X' ? 'green' : 'red';
        gameActive = false;
        return;
    }

    if (!board.includes('')) {
        statusElement.textContent = "It's a draw!";
        statusElement.style.color = 'orange';
        gameActive = false;
        return;
    }
}

// Highlight winning cells
function highlightWinningCells(condition) {
    const cells = document.querySelectorAll('.tic-tac-toe-cell');
    condition.forEach(index => {
        cells[index].classList.add('winning-cell');
    });
}

// AI Move
function makeAIMove() {
    let move;

    if (difficulty === 'easy') {
        move = getRandomMove();
    } else if (difficulty === 'medium') {
        move = Math.random() < 0.5 ? getRandomMove() : getBestMove();
    } else {
        move = getBestMove();
    }

    if (move !== -1) {
        makeMove(move, 'O');
        if (gameActive) {
            currentPlayer = 'X';
            statusElement.textContent = 'Your turn';
            statusElement.style.color = 'black';
        }
    }
}

// Get random available move
function getRandomMove() {
    const availableMoves = board.map((cell, index) => cell === '' ? index : null).filter(val => val !== null);
    return availableMoves.length > 0 ? availableMoves[Math.floor(Math.random() * availableMoves.length)] : -1;
}

// Get best move using minimax
function getBestMove() {
    let bestScore = -Infinity;
    let bestMove = -1;

    for (let i = 0; i < 9; i++) {
        if (board[i] === '') {
            board[i] = 'O';
            let score = minimax(board, 0, false);
            board[i] = '';
            if (score > bestScore) {
                bestScore = score;
                bestMove = i;
            }
        }
    }

    return bestMove;
}

// Minimax algorithm
function minimax(board, depth, isMaximizing) {
    const result = checkWinner();

    if (result !== null) {
        if (result === 'O') return 10 - depth;
        if (result === 'X') return depth - 10;
        return 0;
    }

    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === '') {
                board[i] = 'O';
                let score = minimax(board, depth + 1, false);
                board[i] = '';
                bestScore = Math.max(score, bestScore);
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === '') {
                board[i] = 'X';
                let score = minimax(board, depth + 1, true);
                board[i] = '';
                bestScore = Math.min(score, bestScore);
            }
        }
        return bestScore;
    }
}

// Check winner for minimax
function checkWinner() {
    for (let condition of winningConditions) {
        const [a, b, c] = condition;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }

    if (!board.includes('')) {
        return 'draw';
    }

    return null;
}

// Reset game
function resetGame() {
    board = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = 'X';
    gameActive = true;
    statusElement.textContent = 'Your turn';
    statusElement.style.color = 'black';
    createBoard();
}

// Difficulty selection
easyBtn.addEventListener('click', () => {
    difficulty = 'easy';
    updateDifficultyButtons();
    resetGame();
});

mediumBtn.addEventListener('click', () => {
    difficulty = 'medium';
    updateDifficultyButtons();
    resetGame();
});

hardBtn.addEventListener('click', () => {
    difficulty = 'hard';
    updateDifficultyButtons();
    resetGame();
});

function updateDifficultyButtons() {
    [easyBtn, mediumBtn, hardBtn].forEach(btn => btn.classList.remove('active'));
    if (difficulty === 'easy') easyBtn.classList.add('active');
    if (difficulty === 'medium') mediumBtn.classList.add('active');
    if (difficulty === 'hard') hardBtn.classList.add('active');
}

resetBtn.addEventListener('click', resetGame);

// Initialize
createBoard();
