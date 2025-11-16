// Canvas Setup
const canvas = document.getElementById('tetris');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-piece');
const nextCtx = nextCanvas.getContext('2d');

// Game Constants
const ROWS = 20;
const COLS = 12;
const BLOCK_SIZE = 20;

// Colors for Tetris pieces
const COLORS = [
    null,
    '#FF0D72', // I
    '#0DC2FF', // J
    '#0DFF72', // L
    '#F538FF', // O
    '#FF8E0D', // S
    '#FFE138', // T
    '#3877FF'  // Z
];

// Tetromino shapes
const SHAPES = [
    [],
    [[1, 1, 1, 1]], // I
    [[2, 0, 0], [2, 2, 2]], // J
    [[0, 0, 3], [3, 3, 3]], // L
    [[4, 4], [4, 4]], // O
    [[0, 5, 5], [5, 5, 0]], // S
    [[0, 6, 0], [6, 6, 6]], // T
    [[7, 7, 0], [0, 7, 7]]  // Z
];

// Game State
let board = [];
let currentPiece = null;
let nextPiece = null;
let score = 0;
let level = 1;
let lines = 0;
let gameOver = false;
let isPaused = false;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

// Initialize board
function createBoard() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

// Create a new piece
function createPiece(type) {
    return {
        shape: SHAPES[type],
        color: type,
        x: Math.floor(COLS / 2) - Math.floor(SHAPES[type][0].length / 2),
        y: 0
    };
}

// Draw a block
function drawBlock(ctx, x, y, color) {
    ctx.fillStyle = COLORS[color];
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

// Draw the board
function drawBoard() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x]) {
                drawBlock(ctx, x, y, board[y][x]);
            }
        }
    }
}

// Draw current piece
function drawPiece(piece, context = ctx, offsetX = 0, offsetY = 0) {
    piece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                drawBlock(context, piece.x + x + offsetX, piece.y + y + offsetY, piece.color);
            }
        });
    });
}

// Draw next piece preview
function drawNextPiece() {
    nextCtx.fillStyle = '#000';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    if (nextPiece) {
        const offsetX = (4 - nextPiece.shape[0].length) / 2;
        const offsetY = (4 - nextPiece.shape.length) / 2;
        
        nextPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    drawBlock(nextCtx, x + offsetX, y + offsetY, nextPiece.color);
                }
            });
        });
    }
}

// Collision detection
function collision(piece, offsetX = 0, offsetY = 0) {
    for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
            if (piece.shape[y][x]) {
                const newX = piece.x + x + offsetX;
                const newY = piece.y + y + offsetY;
                
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

// Merge piece to board
function merge(piece) {
    piece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                if (piece.y + y < 0) {
                    gameOver = true;
                } else {
                    board[piece.y + y][piece.x + x] = piece.color;
                }
            }
        });
    });
}

// Rotate piece
function rotate(piece) {
    const newShape = piece.shape[0].map((_, i) =>
        piece.shape.map(row => row[i]).reverse()
    );
    
    const oldShape = piece.shape;
    piece.shape = newShape;
    
    // Wall kick
    let offset = 0;
    while (collision(piece, offset)) {
        offset = offset > 0 ? -(offset + 1) : -offset + 1;
        if (Math.abs(offset) > piece.shape[0].length) {
            piece.shape = oldShape;
            return;
        }
    }
    piece.x += offset;
}

// Clear completed lines
function clearLines() {
    let linesCleared = 0;
    
    outer: for (let y = ROWS - 1; y >= 0; y--) {
        for (let x = 0; x < COLS; x++) {
            if (!board[y][x]) {
                continue outer;
            }
        }
        
        // Remove line and add new line at top
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(0));
        linesCleared++;
        y++; // Check the same line again
    }
    
    if (linesCleared > 0) {
        lines += linesCleared;
        score += linesCleared * 100 * level;
        
        // Level up every 10 lines
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (level - 1) * 100);
        
        updateScore();
    }
}

// Move piece down
function drop() {
    if (!collision(currentPiece, 0, 1)) {
        currentPiece.y++;
    } else {
        merge(currentPiece);
        clearLines();
        
        if (gameOver) {
            endGame();
            return;
        }
        
        currentPiece = nextPiece;
        nextPiece = createPiece(Math.floor(Math.random() * 7) + 1);
        drawNextPiece();
        
        if (collision(currentPiece)) {
            gameOver = true;
            endGame();
        }
    }
    dropCounter = 0;
}

// Hard drop
function hardDrop() {
    while (!collision(currentPiece, 0, 1)) {
        currentPiece.y++;
        score += 2;
    }
    drop();
    updateScore();
}

// Move piece
function move(dir) {
    if (!collision(currentPiece, dir, 0)) {
        currentPiece.x += dir;
    }
}

// Update score display
function updateScore() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    document.getElementById('lines').textContent = lines;
}

// Game loop
function update(time = 0) {
    if (gameOver || isPaused) return;
    
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    
    if (dropCounter > dropInterval) {
        drop();
    }
    
    drawBoard();
    drawPiece(currentPiece);
    
    requestAnimationFrame(update);
}

// Start game
function startGame() {
    createBoard();
    score = 0;
    level = 1;
    lines = 0;
    gameOver = false;
    isPaused = false;
    dropCounter = 0;
    dropInterval = 1000;
    lastTime = 0;
    
    currentPiece = createPiece(Math.floor(Math.random() * 7) + 1);
    nextPiece = createPiece(Math.floor(Math.random() * 7) + 1);
    
    updateScore();
    drawNextPiece();
    
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('start-btn').textContent = 'Neustart';
    
    update();
}

// End game
function endGame() {
    document.getElementById('final-score').textContent = score;
    document.getElementById('game-over').classList.remove('hidden');
}

// Keyboard controls
document.addEventListener('keydown', event => {
    if (gameOver) return;
    
    switch(event.key) {
        case 'ArrowLeft':
            move(-1);
            break;
        case 'ArrowRight':
            move(1);
            break;
        case 'ArrowDown':
            drop();
            break;
        case 'ArrowUp':
            rotate(currentPiece);
            break;
        case ' ':
            event.preventDefault();
            hardDrop();
            break;
        case 'p':
        case 'P':
            isPaused = !isPaused;
            if (!isPaused) {
                lastTime = performance.now();
                update();
            }
            break;
    }
});

// Button event listeners
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

// Initial board draw
createBoard();
drawBoard();
