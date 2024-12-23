const canvas = document.getElementById('gameOfLifeCanvas');
const ctx = canvas.getContext('2d');
const gridSize = 50;
const cellSize = canvas.width / gridSize;

let grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
let running = true;
let fps = 30;

// DOM Elements
const pauseResumeButton = document.getElementById('pauseResume');
const fpsSlider = document.getElementById('fpsSlider');
const fpsDisplay = document.getElementById('fpsDisplay');
const stepButton = document.getElementById('step');
const resetButton = document.getElementById('reset');
const randomizeButton = document.getElementById('randomize');

// Initialize grid with random values
function randomizeGrid() {
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            grid[i][j] = Math.random() > 0.8 ? 1 : 0;
        }
    }
    drawGrid();
}

// Draw the grid on the canvas
function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            ctx.fillStyle = grid[i][j] ? 'black' : 'white';
            ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
            ctx.strokeStyle = 'gray';
            ctx.strokeRect(j * cellSize, i * cellSize, cellSize, cellSize);
        }
    }
}

// Calculate the next generation
function nextGeneration() {
    const newGrid = grid.map(arr => [...arr]);
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const neighbors = countNeighbors(i, j);
            if (grid[i][j] === 1 && (neighbors < 2 || neighbors > 3)) {
                newGrid[i][j] = 0;
            } else if (grid[i][j] === 0 && neighbors === 3) {
                newGrid[i][j] = 1;
            }
        }
    }
    grid = newGrid;
}

// Count neighbors of a cell
function countNeighbors(x, y) {
    let count = 0;
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;
            const nx = x + i;
            const ny = y + j;
            if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
                count += grid[nx][ny];
            }
        }
    }
    return count;
}

// Handle pause/resume
pauseResumeButton.addEventListener('click', () => {
    running = !running;
    pauseResumeButton.textContent = running ? 'Pause' : 'Resume';
});

// Handle FPS slider
fpsSlider.addEventListener('input', () => {
    fps = fpsSlider.value;
    fpsDisplay.textContent = `${fps} FPS`;
});

// Handle step button
stepButton.addEventListener('click', () => {
    if (!running) {
        nextGeneration();
        drawGrid();
    }
});

// Handle reset button
resetButton.addEventListener('click', () => {
    grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
    drawGrid();
});

// Handle randomize button
randomizeButton.addEventListener('click', () => {
    randomizeGrid();
});

// Handle cell editing with click-and-drag
let isDragging = false;
let firstCellColor = null;

canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);

    // Track the initial color of the clicked cell
    firstCellColor = grid[y][x];
    toggleCell(x, y); // Toggle the first clicked cell
    drawGrid();
});

canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / cellSize);
        const y = Math.floor((e.clientY - rect.top) / cellSize);

        // Toggle all dragged-over cells based on the first clicked cell's color
        if (grid[y][x] !== firstCellColor) {
            toggleCell(x, y);
            drawGrid();
        }
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
    firstCellColor = null; // Reset the first cell color
});

canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    firstCellColor = null; // Reset the first cell color
});

// Toggle cell state
function toggleCell(x, y) {
    grid[y][x] = grid[y][x] === 1 ? 0 : 1;
}

// Game loop
function loop() {
    if (running) {
        nextGeneration();
        drawGrid();
    }
    setTimeout(() => requestAnimationFrame(loop), 1000 / fps);
}

// Initialize and start
randomizeGrid();
drawGrid();
loop();
