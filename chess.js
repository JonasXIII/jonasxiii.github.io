// Initial chess board setup
const boardElement = document.getElementById('chessboard');

// Piece setup (simplified for demonstration)
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

// Piece notation (for simplicity)
const pieceSymbols = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

let selectedPiece = null;
let legalMoves = [];

// Function to create the chessboard
function createBoard() {
    boardElement.innerHTML = '';  // Clear previous board
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((row + col) % 2 === 0 ? 'white' : 'black');
            square.dataset.row = row;
            square.dataset.col = col;
            square.addEventListener('click', handleSquareClick);
            if (initialBoard[row][col]) {
                square.textContent = pieceSymbols[initialBoard[row][col]];
            }
            boardElement.appendChild(square);
        }
    }
}

// Function to handle square clicks
function handleSquareClick(event) {
    const square = event.target;
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);

    if (selectedPiece) {
        // If a piece is selected, check if the square is a legal move
        if (legalMoves.some(move => move.row === row && move.col === col)) {
            movePiece(row, col);
            deselectPiece();
        } else {
            deselectPiece();
        }
    } else {
        // Select the piece
        const piece = initialBoard[row][col];
        if (piece) {
            selectedPiece = { row, col, piece };
            legalMoves = getLegalMoves(row, col, piece);
            highlightLegalMoves();
        }
    }
}

// Function to highlight legal moves
function highlightLegalMoves() {
    const squares = document.querySelectorAll('.square');
    squares.forEach(square => square.classList.remove('legal-move'));

    legalMoves.forEach(move => {
        const square = document.querySelector(`[data-row="${move.row}"][data-col="${move.col}"]`);
        square.classList.add('legal-move');
    });
}

// Function to calculate legal moves (simplified)
function getLegalMoves(row, col, piece) {
    // For simplicity, only allow basic moves (you can expand this later with real logic)
    const moves = [];
    if (piece.toLowerCase() === 'p') {
        // Pawn movement (simplified, one square forward)
        const direction = piece === 'p' ? 1 : -1; // White moves down, black moves up
        if (row + direction >= 0 && row + direction < 8) {
            moves.push({ row: row + direction, col });
        }
    } else if (piece.toLowerCase() === 'r') {
        // Rook movement (straight lines)
        for (let i = 1; i < 8; i++) {
            moves.push({ row, col: col + i }); // Horizontal right
            moves.push({ row, col: col - i }); // Horizontal left
            moves.push({ row: row + i, col }); // Vertical down
            moves.push({ row: row - i, col }); // Vertical up
        }
    }
    return moves;
}

// Function to move the piece
function movePiece(row, col) {
    initialBoard[row][col] = selectedPiece.piece;
    initialBoard[selectedPiece.row][selectedPiece.col] = '';
    createBoard(); // Recreate the board after the move
}

// Function to deselect the piece
function deselectPiece() {
    selectedPiece = null;
    legalMoves = [];
    highlightLegalMoves();
}

// Initialize the game
createBoard();
