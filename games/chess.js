// Chess Game with Enhanced Features
const boardElement = document.getElementById('chessboard');
const moveHistoryElement = document.getElementById('move-history');
const capturedWhiteElement = document.getElementById('captured-white');
const capturedBlackElement = document.getElementById('captured-black');
const newGameBtn = document.getElementById('new-game-btn');
const undoMoveBtn = document.getElementById('undo-move-btn');

// Initial board setup
const initialBoardState = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

// Piece symbols
const pieceSymbols = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

// Game state
let board = JSON.parse(JSON.stringify(initialBoardState));
let selectedPiece = null;
let legalMoves = [];
let turn = 'w';
let gameOver = false;
let moveHistory = [];
let capturedPieces = { white: [], black: [] };
let lastMove = null;
let castlingRights = { w: { kingSide: true, queenSide: true }, b: { kingSide: true, queenSide: true } };
let enPassantTarget = null;

// Initialize game
function initGame() {
    board = JSON.parse(JSON.stringify(initialBoardState));
    selectedPiece = null;
    legalMoves = [];
    turn = 'w';
    gameOver = false;
    moveHistory = [];
    capturedPieces = { white: [], black: [] };
    lastMove = null;
    castlingRights = { w: { kingSide: true, queenSide: true }, b: { kingSide: true, queenSide: true } };
    enPassantTarget = null;
    createBoard();
    updateMoveHistory();
    updateCapturedPieces();
}

// Create the chessboard
function createBoard() {
    boardElement.innerHTML = '';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((row + col) % 2 === 0 ? 'white' : 'black');
            square.dataset.row = row;
            square.dataset.col = col;

            // Highlight last move
            if (lastMove &&
                ((lastMove.from.row === row && lastMove.from.col === col) ||
                 (lastMove.to.row === row && lastMove.to.col === col))) {
                square.classList.add('last-move');
            }

            square.addEventListener('click', handleSquareClick);

            const piece = board[row][col];
            if (piece) {
                const pieceElement = document.createElement('span');
                pieceElement.className = 'piece';
                pieceElement.textContent = pieceSymbols[piece];
                square.appendChild(pieceElement);
            }
            boardElement.appendChild(square);
        }
    }
    updateGameStatus();
}

// Update game status
function updateGameStatus() {
    let statusDiv = document.getElementById('game-status');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'game-status';
        document.querySelector('#chess-game-area').appendChild(statusDiv);
    }

    if (gameOver) {
        if (isCheckmate(turn)) {
            statusDiv.textContent = `Checkmate! ${turn === 'w' ? 'Black' : 'White'} wins!`;
        } else if (isStalemate(turn)) {
            statusDiv.textContent = `Stalemate! It's a draw!`;
        } else {
            statusDiv.textContent = `Game Over!`;
        }
        statusDiv.className = 'status-gameover';
    } else if (isInCheck(turn)) {
        statusDiv.textContent = `${turn === 'w' ? 'White' : 'Black'}'s turn - CHECK!`;
        statusDiv.className = 'status-check';
    } else {
        statusDiv.textContent = `${turn === 'w' ? 'White' : 'Black'}'s turn`;
        statusDiv.className = 'status-normal';
    }
}

// Handle square clicks
function handleSquareClick(event) {
    if (gameOver) return;

    const square = event.currentTarget;
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);

    if (selectedPiece) {
        if (legalMoves.some(move => move.row === row && move.col === col)) {
            makeMove(row, col);
        } else {
            deselectPiece();
            const piece = board[row][col];
            if (piece && isPieceTurn(piece)) {
                selectPiece(row, col, piece);
            }
        }
    } else {
        const piece = board[row][col];
        if (piece && isPieceTurn(piece)) {
            selectPiece(row, col, piece);
        }
    }
}

// Select a piece
function selectPiece(row, col, piece) {
    selectedPiece = { row, col, piece };
    legalMoves = getLegalMoves(row, col, piece);
    highlightLegalMoves();
}

// Make a move
function makeMove(toRow, toCol) {
    const fromRow = selectedPiece.row;
    const fromCol = selectedPiece.col;
    const piece = selectedPiece.piece;
    const capturedPiece = board[toRow][toCol];
    let movingPiece = piece;
    let isEnPassantCapture = false;

    // Check if this is an en passant capture
    if (piece.toLowerCase() === 'p' && enPassantTarget &&
        toRow === enPassantTarget.row && toCol === enPassantTarget.col) {
        isEnPassantCapture = true;
    }

    // Save move history for undo
    moveHistory.push({
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
        piece: piece,
        captured: capturedPiece,
        boardState: JSON.parse(JSON.stringify(board)),
        castlingRights: JSON.parse(JSON.stringify(castlingRights)),
        enPassantTarget: enPassantTarget,
        isEnPassantCapture: isEnPassantCapture
    });

    // Handle castling
    if (piece.toLowerCase() === 'k' && Math.abs(toCol - fromCol) === 2) {
        // King-side castling
        if (toCol === 6) {
            const rook = board[fromRow][7];
            board[fromRow][5] = rook;
            board[fromRow][7] = '';
        }
        // Queen-side castling
        else if (toCol === 2) {
            const rook = board[fromRow][0];
            board[fromRow][3] = rook;
            board[fromRow][0] = '';
        }
    }

    // Handle en passant capture
    if (piece.toLowerCase() === 'p' && enPassantTarget &&
        toRow === enPassantTarget.row && toCol === enPassantTarget.col) {
        const capturedRow = piece === 'P' ? toRow + 1 : toRow - 1;
        const capturedPawn = board[capturedRow][toCol];
        board[capturedRow][toCol] = '';

        const isWhitePiece = capturedPawn === capturedPawn.toUpperCase();
        if (isWhitePiece) {
            capturedPieces.white.push(capturedPawn);
        } else {
            capturedPieces.black.push(capturedPawn);
        }
        updateCapturedPieces();
    }

    // Handle regular captured piece
    if (capturedPiece) {
        const isWhitePiece = capturedPiece === capturedPiece.toUpperCase();
        if (isWhitePiece) {
            capturedPieces.white.push(capturedPiece);
        } else {
            capturedPieces.black.push(capturedPiece);
        }
        updateCapturedPieces();
    }

    // Handle pawn promotion
    if (piece.toLowerCase() === 'p') {
        if ((piece === 'P' && toRow === 0) || (piece === 'p' && toRow === 7)) {
            // Auto-promote to queen
            movingPiece = piece === 'P' ? 'Q' : 'q';
        }
    }

    // Move the piece
    board[toRow][toCol] = movingPiece;
    board[fromRow][fromCol] = '';

    // Update en passant target
    enPassantTarget = null;
    if (piece.toLowerCase() === 'p' && Math.abs(toRow - fromRow) === 2) {
        enPassantTarget = {
            row: piece === 'P' ? fromRow - 1 : fromRow + 1,
            col: fromCol
        };
    }

    // Update castling rights
    if (piece === 'K') {
        castlingRights.w.kingSide = false;
        castlingRights.w.queenSide = false;
    } else if (piece === 'k') {
        castlingRights.b.kingSide = false;
        castlingRights.b.queenSide = false;
    } else if (piece === 'R') {
        if (fromRow === 7 && fromCol === 0) castlingRights.w.queenSide = false;
        if (fromRow === 7 && fromCol === 7) castlingRights.w.kingSide = false;
    } else if (piece === 'r') {
        if (fromRow === 0 && fromCol === 0) castlingRights.b.queenSide = false;
        if (fromRow === 0 && fromCol === 7) castlingRights.b.kingSide = false;
    }

    // Update last move
    lastMove = {
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol }
    };

    deselectPiece();
    turn = turn === 'w' ? 'b' : 'w';

    if (isCheckmate(turn)) {
        gameOver = true;
    } else if (isStalemate(turn)) {
        gameOver = true;
    }

    createBoard();
    updateMoveHistory();
}

// Undo last move
function undoMove() {
    if (moveHistory.length === 0) return;

    const lastMoveData = moveHistory.pop();
    board = JSON.parse(JSON.stringify(lastMoveData.boardState));
    castlingRights = JSON.parse(JSON.stringify(lastMoveData.castlingRights));
    enPassantTarget = lastMoveData.enPassantTarget;

    // Restore captured pieces
    if (lastMoveData.captured || lastMoveData.isEnPassantCapture) {
        const isWhitePiece = lastMoveData.captured ?
            lastMoveData.captured === lastMoveData.captured.toUpperCase() :
            lastMoveData.piece === lastMoveData.piece.toLowerCase(); // If en passant, opposite color of moving piece

        if (isWhitePiece) {
            capturedPieces.white.pop();
        } else {
            capturedPieces.black.pop();
        }
        updateCapturedPieces();
    }

    turn = turn === 'w' ? 'b' : 'w';
    gameOver = false;

    // Update last move highlight
    if (moveHistory.length > 0) {
        const prevMove = moveHistory[moveHistory.length - 1];
        lastMove = {
            from: prevMove.from,
            to: prevMove.to
        };
    } else {
        lastMove = null;
    }

    createBoard();
    updateMoveHistory();
}

// Update move history display
function updateMoveHistory() {
    moveHistoryElement.innerHTML = '';

    if (moveHistory.length === 0) {
        moveHistoryElement.innerHTML = '<div class="history-empty">No moves yet</div>';
        return;
    }

    for (let i = 0; i < moveHistory.length; i++) {
        const move = moveHistory[i];
        const moveNum = Math.floor(i / 2) + 1;
        const isWhite = i % 2 === 0;

        if (isWhite) {
            const moveDiv = document.createElement('div');
            moveDiv.className = 'move-pair';
            moveDiv.innerHTML = `
                <span class="move-number">${moveNum}.</span>
                <span class="move-notation">${formatMove(move)}</span>
            `;
            moveHistoryElement.appendChild(moveDiv);
        } else {
            const lastDiv = moveHistoryElement.lastElementChild;
            lastDiv.innerHTML += `<span class="move-notation">${formatMove(move)}</span>`;
        }
    }

    moveHistoryElement.scrollTop = moveHistoryElement.scrollHeight;
}

// Format move for display
function formatMove(move) {
    const fromCol = String.fromCharCode(97 + move.from.col);
    const fromRow = 8 - move.from.row;
    const toCol = String.fromCharCode(97 + move.to.col);
    const toRow = 8 - move.to.row;
    const pieceSymbol = pieceSymbols[move.piece];
    const arrow = move.captured ? 'x' : '-';
    return `${pieceSymbol}${fromCol}${fromRow}${arrow}${toCol}${toRow}`;
}

// Update captured pieces display
function updateCapturedPieces() {
    capturedWhiteElement.innerHTML = capturedPieces.white.map(p => pieceSymbols[p]).join(' ') || 'None';
    capturedBlackElement.innerHTML = capturedPieces.black.map(p => pieceSymbols[p]).join(' ') || 'None';
}

// Highlight legal moves
function highlightLegalMoves() {
    const squares = document.querySelectorAll('.square');
    squares.forEach(square => square.classList.remove('legal-move', 'selected'));

    if (selectedPiece) {
        const selectedSquare = document.querySelector(`[data-row="${selectedPiece.row}"][data-col="${selectedPiece.col}"]`);
        if (selectedSquare) selectedSquare.classList.add('selected');
    }

    legalMoves.forEach(move => {
        const square = document.querySelector(`[data-row="${move.row}"][data-col="${move.col}"]`);
        if (square) square.classList.add('legal-move');
    });
}

// Deselect piece
function deselectPiece() {
    selectedPiece = null;
    legalMoves = [];
    const squares = document.querySelectorAll('.square');
    squares.forEach(square => square.classList.remove('legal-move', 'selected'));
}

// Get possible moves (same as before)
function getPossibleMoves(row, col, piece) {
    const moves = [];
    const pieceLower = piece.toLowerCase();

    if (pieceLower === 'p') {
        const direction = piece === 'P' ? -1 : 1;
        const startRow = piece === 'P' ? 6 : 1;
        const oneStep = row + direction;
        if (oneStep >= 0 && oneStep < 8 && !board[oneStep][col]) {
            moves.push({ row: oneStep, col });
            const twoStep = row + 2 * direction;
            if (row === startRow && !board[twoStep][col]) {
                moves.push({ row: twoStep, col });
            }
        }
        for (const dc of [-1, 1]) {
            const newRow = row + direction;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
                const target = board[newRow][newCol];
                if (target && isEnemyPiece(piece, target)) {
                    moves.push({ row: newRow, col: newCol });
                }
                // En passant
                if (enPassantTarget && newRow === enPassantTarget.row && newCol === enPassantTarget.col) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }
    } else if (pieceLower === 'n') {
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

        // Castling
        const color = piece === 'K' ? 'w' : 'b';
        const backRank = piece === 'K' ? 7 : 0;

        // King-side castling
        if (castlingRights[color].kingSide &&
            !board[backRank][5] && !board[backRank][6] &&
            board[backRank][7] === (piece === 'K' ? 'R' : 'r')) {
            // Check if king is in check or passes through check
            if (!isInCheck(color)) {
                const kingInBetween = board[row][col];
                board[row][col] = '';
                board[row][5] = piece;
                const passesCheck = !isInCheck(color);
                board[row][col] = kingInBetween;
                board[row][5] = '';

                if (passesCheck) {
                    moves.push({ row: backRank, col: 6 });
                }
            }
        }

        // Queen-side castling
        if (castlingRights[color].queenSide &&
            !board[backRank][1] && !board[backRank][2] && !board[backRank][3] &&
            board[backRank][0] === (piece === 'K' ? 'R' : 'r')) {
            // Check if king is in check or passes through check
            if (!isInCheck(color)) {
                const kingInBetween = board[row][col];
                board[row][col] = '';
                board[row][3] = piece;
                const passesCheck = !isInCheck(color);
                board[row][col] = kingInBetween;
                board[row][3] = '';

                if (passesCheck) {
                    moves.push({ row: backRank, col: 2 });
                }
            }
        }
    } else {
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
            while (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
                const target = board[newRow][newCol];
                if (!target) {
                    moves.push({ row: newRow, col: newCol });
                } else {
                    if (isEnemyPiece(piece, target)) {
                        moves.push({ row: newRow, col: newCol });
                    }
                    break;
                }
                newRow += dr;
                newCol += dc;
            }
        }
    }

    return moves;
}

// Get legal moves (same as before)
function getLegalMoves(row, col, piece) {
    const possibleMoves = getPossibleMoves(row, col, piece);
    const legalMoves = [];

    for (const move of possibleMoves) {
        const originalTarget = board[move.row][move.col];
        board[move.row][move.col] = piece;
        board[row][col] = '';

        const playerColor = isPieceTurn(piece) ? turn : (turn === 'w' ? 'b' : 'w');
        if (!isInCheck(playerColor)) {
            legalMoves.push(move);
        }

        board[row][col] = piece;
        board[move.row][move.col] = originalTarget;
    }

    return legalMoves;
}

// Check if in check (same as before)
function isInCheck(player) {
    let kingRow = -1, kingCol = -1;
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

    if (kingRow === -1) return false;

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

// Check if checkmate
function isCheckmate(player) {
    if (!isInCheck(player)) return false;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && ((player === 'w' && piece === piece.toUpperCase()) ||
                         (player === 'b' && piece === piece.toLowerCase()))) {
                const moves = getLegalMoves(r, c, piece);
                if (moves.length > 0) {
                    return false;
                }
            }
        }
    }

    return true;
}

// Check if stalemate
function isStalemate(player) {
    if (isInCheck(player)) return false;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && ((player === 'w' && piece === piece.toUpperCase()) ||
                         (player === 'b' && piece === piece.toLowerCase()))) {
                const moves = getLegalMoves(r, c, piece);
                if (moves.length > 0) {
                    return false;
                }
            }
        }
    }

    return true;
}

// Helper functions
function isPieceTurn(piece) {
    return (turn === 'w' && piece === piece.toUpperCase()) || (turn === 'b' && piece === piece.toLowerCase());
}

function isEnemyPiece(piece, target) {
    return (piece === piece.toUpperCase() && target === target.toLowerCase()) ||
           (piece === piece.toLowerCase() && target === target.toUpperCase());
}

// Event listeners
newGameBtn.addEventListener('click', initGame);
undoMoveBtn.addEventListener('click', undoMove);

// Initialize
initGame();
