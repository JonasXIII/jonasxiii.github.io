// Chessboard DOM element
const boardElement = document.getElementById('chessboard');

// Initial chessboard setup
let board = [
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
let gameOver = false;

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
            const piece = board[row][col];
            if (piece) {
                square.textContent = pieceSymbols[piece];
            }
            boardElement.appendChild(square);
        }
    }

    // Display game status
    updateGameStatus();
}

// Update game status message
function updateGameStatus() {
    let statusDiv = document.getElementById('game-status');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'game-status';
        statusDiv.style.marginTop = '20px';
        statusDiv.style.fontSize = '18px';
        statusDiv.style.fontWeight = 'bold';
        boardElement.parentElement.appendChild(statusDiv);
    }

    if (gameOver) {
        statusDiv.textContent = `Game Over! ${turn === 'w' ? 'Black' : 'White'} wins!`;
        statusDiv.style.color = 'red';
    } else if (isInCheck(turn)) {
        statusDiv.textContent = `${turn === 'w' ? 'White' : 'Black'}'s turn - CHECK!`;
        statusDiv.style.color = 'red';
    } else {
        statusDiv.textContent = `${turn === 'w' ? 'White' : 'Black'}'s turn`;
        statusDiv.style.color = 'black';
    }
}

// Handle square clicks
function handleSquareClick(event) {
    if (gameOver) return;

    const square = event.target;
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);

    if (selectedPiece) {
        // Attempt to move the piece
        if (legalMoves.some(move => move.row === row && move.col === col)) {
            movePiece(row, col);
            deselectPiece();
            turn = turn === 'w' ? 'b' : 'w'; // Switch turn

            // Check for checkmate
            if (isCheckmate(turn)) {
                gameOver = true;
            }
            createBoard();
        } else {
            deselectPiece();
            // Try selecting a new piece
            const piece = board[row][col];
            if (piece && isPieceTurn(piece)) {
                selectedPiece = { row, col, piece };
                legalMoves = getLegalMoves(row, col, piece);
                highlightLegalMoves();
            }
        }
    } else {
        // Select the piece
        const piece = board[row][col];
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
    squares.forEach(square => square.classList.remove('legal-move', 'selected'));

    // Highlight selected piece
    if (selectedPiece) {
        const selectedSquare = document.querySelector(`[data-row="${selectedPiece.row}"][data-col="${selectedPiece.col}"]`);
        if (selectedSquare) selectedSquare.classList.add('selected');
    }

    legalMoves.forEach(move => {
        const square = document.querySelector(`[data-row="${move.row}"][data-col="${move.col}"]`);
        if (square) square.classList.add('legal-move');
    });
}

// Get all possible moves for a piece (without check validation)
function getPossibleMoves(row, col, piece) {
    const moves = [];
    const pieceLower = piece.toLowerCase();

    if (pieceLower === 'p') {
        // Pawn moves
        const direction = piece === 'P' ? -1 : 1; // White moves up (-1), black moves down (+1)
        const startRow = piece === 'P' ? 6 : 1;

        // Move forward one square
        const oneStep = row + direction;
        if (oneStep >= 0 && oneStep < 8 && !board[oneStep][col]) {
            moves.push({ row: oneStep, col });

            // Move forward two squares on first move
            const twoStep = row + 2 * direction;
            if (row === startRow && !board[twoStep][col]) {
                moves.push({ row: twoStep, col });
            }
        }

        // Capture diagonally
        for (const dc of [-1, 1]) {
            const newRow = row + direction;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
                const target = board[newRow][newCol];
                if (target && isEnemyPiece(piece, target)) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }
    } else if (pieceLower === 'n') {
        // Knight moves
        const knightMoves = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
        for (const [dr, dc] of knightMoves) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
                const target = board[newRow][newCol];
                if (!target || isEnemyPiece(piece, target)) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }
    } else if (pieceLower === 'k') {
        // King moves (one square in any direction)
        const kingMoves = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [dr, dc] of kingMoves) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
                const target = board[newRow][newCol];
                if (!target || isEnemyPiece(piece, target)) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }
    } else {
        // Sliding pieces (rook, bishop, queen)
        let directions = [];
        if (pieceLower === 'r') {
            directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        } else if (pieceLower === 'b') {
            directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        } else if (pieceLower === 'q') {
            directions = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        }

        for (const [dr, dc] of directions) {
            let newRow = row + dr;
            let newCol = col + dc;

            // Keep sliding until we hit something or the edge
            while (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
                const target = board[newRow][newCol];
                if (!target) {
                    moves.push({ row: newRow, col: newCol });
                } else {
                    // Hit a piece
                    if (isEnemyPiece(piece, target)) {
                        moves.push({ row: newRow, col: newCol });
                    }
                    break; // Stop sliding in this direction
                }
                newRow += dr;
                newCol += dc;
            }
        }
    }

    return moves;
}

// Get legal moves for a piece (excluding moves that leave king in check)
function getLegalMoves(row, col, piece) {
    const possibleMoves = getPossibleMoves(row, col, piece);
    const legalMoves = [];

    for (const move of possibleMoves) {
        // Simulate the move
        const originalTarget = board[move.row][move.col];
        board[move.row][move.col] = piece;
        board[row][col] = '';

        // Check if this move leaves our king in check
        const playerColor = isPieceTurn(piece) ? turn : (turn === 'w' ? 'b' : 'w');
        if (!isInCheck(playerColor)) {
            legalMoves.push(move);
        }

        // Undo the move
        board[row][col] = piece;
        board[move.row][move.col] = originalTarget;
    }

    return legalMoves;
}

// Check if a player is in check
function isInCheck(player) {
    // Find the king
    let kingRow = -1;
    let kingCol = -1;
    const kingPiece = player === 'w' ? 'K' : 'k';

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === kingPiece) {
                kingRow = r;
                kingCol = c;
                break;
            }
        }
        if (kingRow !== -1) break;
    }

    if (kingRow === -1) return false; // King not found (shouldn't happen)

    // Check if any enemy piece can attack the king
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && isEnemyPiece(kingPiece, piece)) {
                const moves = getPossibleMoves(r, c, piece);
                if (moves.some(move => move.row === kingRow && move.col === kingCol)) {
                    return true;
                }
            }
        }
    }

    return false;
}

// Check if a player is in checkmate
function isCheckmate(player) {
    if (!isInCheck(player)) return false;

    // Check if any legal move can get out of check
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && ((player === 'w' && piece === piece.toUpperCase()) ||
                         (player === 'b' && piece === piece.toLowerCase()))) {
                const moves = getLegalMoves(r, c, piece);
                if (moves.length > 0) {
                    return false; // Found a legal move
                }
            }
        }
    }

    return true; // No legal moves, checkmate
}

// Move the piece
function movePiece(row, col) {
    board[row][col] = selectedPiece.piece;
    board[selectedPiece.row][selectedPiece.col] = '';
}

// Deselect the piece
function deselectPiece() {
    selectedPiece = null;
    legalMoves = [];
    const squares = document.querySelectorAll('.square');
    squares.forEach(square => square.classList.remove('legal-move', 'selected'));
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
