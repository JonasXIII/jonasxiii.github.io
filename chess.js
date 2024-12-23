// Chessboard DOM element
const boardElement = document.getElementById('chessboard');

// Initial chessboard setup
const initialBoard = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

// Piece symbols for rendering
const pieceSymbols = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

// Game state
let selectedPiece = null;
let legalMoves = [];
let turn = 'w'; // 'w' for white, 'b' for black

// Create the chessboard
function createBoard() {
    boardElement.innerHTML = ''; // Clear the board
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((row + col) % 2 === 0 ? 'white' : 'black');
            square.dataset.row = row;
            square.dataset.col = col;
            square.addEventListener('click', handleSquareClick);
            const piece = initialBoard[row][col];
            if (piece) {
                square.textContent = pieceSymbols[piece];
            }
            boardElement.appendChild(square);
        }
    }
}

// Handle square clicks
function handleSquareClick(event) {
    const square = event.target;
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);

    if (selectedPiece) {
        // Attempt to move the piece
        if (legalMoves.some(move => move.row === row && move.col === col)) {
            movePiece(row, col);
            deselectPiece();
            turn = turn === 'w' ? 'b' : 'w'; // Switch turn
        } else {
            deselectPiece();
        }
    } else {
        // Select the piece
        const piece = initialBoard[row][col];
        if (piece && isPieceTurn(piece)) {
            selectedPiece = { row, col, piece };
            legalMoves = getLegalMoves(row, col, piece);
            highlightLegalMoves();
        }
    }
}

// Highlight legal moves
function highlightLegalMoves() {
    const squares = document.querySelectorAll('.square');
    squares.forEach(square => square.classList.remove('legal-move'));

    legalMoves.forEach(move => {
        const square = document.querySelector(`[data-row="${move.row}"][data-col="${move.col}"]`);
        square.classList.add('legal-move');
    });
}

// Get legal moves for a piece
function getLegalMoves(row, col, piece) {
    const moves = [];
    const directions = {
        'p': [[1, 0], [1, 1], [1, -1]],
        'P': [[-1, 0], [-1, 1], [-1, -1]],
        'r': [[0, 1], [0, -1], [1, 0], [-1, 0]],
        'b': [[1, 1], [1, -1], [-1, 1], [-1, -1]],
        'q': [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]],
        'k': [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]],
        'n': [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]
    };

    directions[piece.toLowerCase()]?.forEach(([dx, dy]) => {
        const newRow = row + dx;
        const newCol = col + dy;
        if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
            const target = initialBoard[newRow][newCol];
            if (piece.toLowerCase() === 'p') {
                // Pawn specific logic
                const direction = piece === 'p' ? 1 : -1;
                if (dy === 0 && !target) moves.push({ row: newRow, col: newCol });
                if (dy !== 0 && target && isEnemyPiece(piece, target)) moves.push({ row: newRow, col: newCol });
            } else {
                // General move logic
                if (!target || isEnemyPiece(piece, target)) moves.push({ row: newRow, col: newCol });
            }
        }
    });

    return moves;
}

// Move the piece
function movePiece(row, col) {
    initialBoard[row][col] = selectedPiece.piece;
    initialBoard[selectedPiece.row][selectedPiece.col] = '';
    createBoard();
}

// Deselect the piece
function deselectPiece() {
    selectedPiece = null;
    legalMoves = [];
    highlightLegalMoves();
}

// Check if the piece belongs to the current turn
function isPieceTurn(piece) {
    return (turn === 'w' && piece === piece.toUpperCase()) || (turn === 'b' && piece === piece.toLowerCase());
}

// Check if the target piece is an enemy
function isEnemyPiece(piece, target) {
    return (piece === piece.toUpperCase() && target === target.toLowerCase()) ||
           (piece === piece.toLowerCase() && target === target.toUpperCase());
}

// Initialize the game
createBoard();
