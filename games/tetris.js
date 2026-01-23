// Tetris Game
const canvas = document.getElementById('tetris-canvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-piece-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const linesElement = document.getElementById('lines');
const statusElement = document.getElementById('tetris-status');
const resetBtn = document.getElementById('tetris-reset-btn');

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

// Tetromino shapes
const SHAPES = {
    I: [[1, 1, 1, 1]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    Z: [[1, 1, 0], [0, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]]
};

const COLORS = {
    I: '#00f0f0',
    O: '#f0f000',
    T: '#a000f0',
    S: '#00f000',
    Z: '#f00000',
    J: '#0000f0',
    L: '#f0a000'
};

let board = [];
let score = 0;
let lines = 0;
let level = 1;
let currentPiece = null;
let nextPiece = null;
let gameActive = false;
let paused = false;
let dropInterval = 1000;
let lastDropTime = 0;

// Initialize game
function initGame() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score = 0;
    lines = 0;
    level = 1;
    gameActive = true;
    paused = false;
    dropInterval = 1000;

    updateScore();
    currentPiece = createPiece();
    nextPiece = createPiece();
    statusElement.textContent = 'Playing...';
    statusElement.style.color = 'green';

    drawBoard();
    drawNextPiece();
    gameLoop();
}

// Create a new piece
function createPiece() {
    const shapes = Object.keys(SHAPES);
    const type = shapes[Math.floor(Math.random() * shapes.length)];
    return {
        type: type,
        shape: SHAPES[type],
        color: COLORS[type],
        x: Math.floor(COLS / 2) - Math.floor(SHAPES[type][0].length / 2),
        y: 0
    };
}

// Draw the board
function drawBoard() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let r = 0; r <= ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * BLOCK_SIZE);
        ctx.lineTo(COLS * BLOCK_SIZE, r * BLOCK_SIZE);
        ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * BLOCK_SIZE, 0);
        ctx.lineTo(c * BLOCK_SIZE, ROWS * BLOCK_SIZE);
        ctx.stroke();
    }

    // Draw placed pieces
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c]) {
                drawBlock(ctx, c, r, board[r][c]);
            }
        }
    }

    // Draw current piece
    if (currentPiece) {
        drawPiece(ctx, currentPiece);
    }
}

// Draw a single block
function drawBlock(context, x, y, color) {
    context.fillStyle = color;
    context.fillRect(x * BLOCK_SIZE + 1, y * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

    // Add 3D effect
    context.fillStyle = 'rgba(255, 255, 255, 0.3)';
    context.fillRect(x * BLOCK_SIZE + 1, y * BLOCK_SIZE + 1, BLOCK_SIZE - 2, 5);
    context.fillRect(x * BLOCK_SIZE + 1, y * BLOCK_SIZE + 1, 5, BLOCK_SIZE - 2);
}

// Draw a piece
function drawPiece(context, piece) {
    for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
            if (piece.shape[r][c]) {
                drawBlock(context, piece.x + c, piece.y + r, piece.color);
            }
        }
    }
}

// Draw next piece
function drawNextPiece() {
    nextCtx.fillStyle = '#000';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    if (nextPiece) {
        const offsetX = (4 - nextPiece.shape[0].length) / 2;
        const offsetY = (4 - nextPiece.shape.length) / 2;

        for (let r = 0; r < nextPiece.shape.length; r++) {
            for (let c = 0; c < nextPiece.shape[r].length; c++) {
                if (nextPiece.shape[r][c]) {
                    drawBlock(nextCtx, offsetX + c, offsetY + r, nextPiece.color);
                }
            }
        }
    }
}

// Check collision
function collides(piece, offsetX = 0, offsetY = 0) {
    for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
            if (piece.shape[r][c]) {
                const newX = piece.x + c + offsetX;
                const newY = piece.y + r + offsetY;

                if (newX < 0 || newX >= COLS || newY >= ROWS) {
                    return true;
                }

                if (newY >= 0 && board[newY][newX]) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Move piece
function move(direction) {
    if (!gameActive || paused) return;

    if (direction === 'left' && !collides(currentPiece, -1, 0)) {
        currentPiece.x--;
    } else if (direction === 'right' && !collides(currentPiece, 1, 0)) {
        currentPiece.x++;
    } else if (direction === 'down') {
        if (!collides(currentPiece, 0, 1)) {
            currentPiece.y++;
            score += 1;
            updateScore();
        } else {
            lockPiece();
        }
    }

    drawBoard();
}

// Rotate piece
function rotate() {
    if (!gameActive || paused) return;

    const rotated = currentPiece.shape[0].map((_, i) =>
        currentPiece.shape.map(row => row[i]).reverse()
    );

    const originalShape = currentPiece.shape;
    currentPiece.shape = rotated;

    if (collides(currentPiece, 0, 0)) {
        currentPiece.shape = originalShape;
    }

    drawBoard();
}

// Hard drop
function hardDrop() {
    if (!gameActive || paused) return;

    while (!collides(currentPiece, 0, 1)) {
        currentPiece.y++;
        score += 2;
    }

    updateScore();
    lockPiece();
    drawBoard();
}

// Lock piece in place
function lockPiece() {
    for (let r = 0; r < currentPiece.shape.length; r++) {
        for (let c = 0; c < currentPiece.shape[r].length; c++) {
            if (currentPiece.shape[r][c]) {
                const y = currentPiece.y + r;
                const x = currentPiece.x + c;

                if (y < 0) {
                    gameOver();
                    return;
                }

                board[y][x] = currentPiece.color;
            }
        }
    }

    clearLines();
    currentPiece = nextPiece;
    nextPiece = createPiece();
    drawNextPiece();

    if (collides(currentPiece, 0, 0)) {
        gameOver();
    }
}

// Clear completed lines
function clearLines() {
    let linesCleared = 0;

    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r].every(cell => cell !== 0)) {
            board.splice(r, 1);
            board.unshift(Array(COLS).fill(0));
            linesCleared++;
            r++; // Check this row again
        }
    }

    if (linesCleared > 0) {
        lines += linesCleared;

        // Scoring: 1 line = 100, 2 = 300, 3 = 500, 4 = 800
        const points = [0, 100, 300, 500, 800][linesCleared] * level;
        score += points;

        // Level up every 10 lines
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (level - 1) * 100);

        updateScore();
    }
}

// Update score display
function updateScore() {
    scoreElement.textContent = score;
    levelElement.textContent = level;
    linesElement.textContent = lines;
}

// Game loop
function gameLoop(timestamp = 0) {
    if (!gameActive) return;

    if (!paused) {
        if (timestamp - lastDropTime > dropInterval) {
            move('down');
            lastDropTime = timestamp;
        }
    }

    requestAnimationFrame(gameLoop);
}

// Game over
function gameOver() {
    gameActive = false;
    statusElement.textContent = 'Game Over! Final Score: ' + score;
    statusElement.style.color = 'red';
}

// Pause/unpause
function togglePause() {
    if (!gameActive) return;

    paused = !paused;
    statusElement.textContent = paused ? 'Paused' : 'Playing...';
    statusElement.style.color = paused ? 'orange' : 'green';
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (!gameActive && e.key !== 'Escape') {
        initGame();
        return;
    }

    switch (e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            move('left');
            break;
        case 'ArrowRight':
            e.preventDefault();
            move('right');
            break;
        case 'ArrowDown':
            e.preventDefault();
            move('down');
            break;
        case 'ArrowUp':
            e.preventDefault();
            rotate();
            break;
        case ' ':
            e.preventDefault();
            hardDrop();
            break;
        case 'p':
        case 'P':
            togglePause();
            break;
    }
});

resetBtn.addEventListener('click', initGame);

// Draw initial empty board
drawBoard();
