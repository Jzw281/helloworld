/* ===== Constants ===== */
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const BOARD_SIZES = [9, 13, 19];
const GAMES_KEY = "goDojoGames";
const RATING_KEY = "goDojoPuzzleRating";
const COLOR_NAMES = { [BLACK]: "Black", [WHITE]: "White" };

/* ===== Go Board Engine ===== */
class GoBoard {
  constructor(container, size = 9, options = {}) {
    this.container = container;
    this.size = size;
    this.options = options;
    this.grid = this.createEmptyGrid();
    this.currentPlayer = BLACK;
    this.captures = { [BLACK]: 0, [WHITE]: 0 };
    this.moveCount = 0;
    this.lastMove = null;
    this.onMove = options.onMove || null;
    this.readOnly = options.readOnly || false;
    this.allowedColor = options.allowedColor || null;
    this.frozen = false;
    this.render();
  }

  createEmptyGrid() {
    return Array.from({ length: this.size }, () => Array(this.size).fill(EMPTY));
  }

  setSizeClass() {
    BOARD_SIZES.forEach((s) => this.container.classList.remove(`size-${s}`));
    this.container.classList.add(`size-${this.size}`);
  }

  render() {
    this.container.innerHTML = "";
    this.container.classList.add("go-board");
    this.setSizeClass();
    if (this.options.mini) this.container.classList.add("mini");
    this.container.classList.toggle("readonly", this.readOnly);

    const grid = document.createElement("div");
    grid.className = "board-grid";
    grid.style.gridTemplateColumns = `repeat(${this.size}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${this.size}, 1fr)`;

    const lines = document.createElement("div");
    lines.className = "board-lines";
    this.drawLines(lines);
    this.drawStarPoints(lines);

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const cell = document.createElement("div");
        cell.className = "intersection";
        const stone = this.grid[r][c];
        if (stone !== EMPTY) {
          cell.classList.add("occupied");
          const stoneEl = document.createElement("div");
          stoneEl.className = `stone ${stone === BLACK ? "black" : "white"}`;
          if (this.lastMove && this.lastMove[0] === r && this.lastMove[1] === c) {
            stoneEl.classList.add("last-move");
          }
          cell.appendChild(stoneEl);
        } else if (!this.readOnly) {
          const hover = document.createElement("div");
          hover.className = "hover-stone";
          cell.appendChild(hover);
          const previewColor = this.allowedColor || this.currentPlayer;
          if (previewColor === WHITE) cell.classList.add("preview-white");
        }
        if (!this.readOnly && !this.frozen) {
          cell.addEventListener("click", () => this.handleClick(r, c));
        }
        grid.appendChild(cell);
      }
    }

    this.container.appendChild(lines);
    this.container.appendChild(grid);
  }

  drawLines(container) {
    const pct = (i) => `${(i / (this.size - 1)) * 100}%`;
    for (let i = 0; i < this.size; i++) {
      const h = document.createElement("div");
      h.className = "board-line-h";
      h.style.top = pct(i);
      container.appendChild(h);
      const v = document.createElement("div");
      v.className = "board-line-v";
      v.style.left = pct(i);
      container.appendChild(v);
    }
  }

  drawStarPoints(container) {
    const pct = (i) => `${(i / (this.size - 1)) * 100}%`;
    this.getStarPoints().forEach(([r, c]) => {
      const star = document.createElement("div");
      star.className = "star-point";
      star.style.top = pct(r);
      star.style.left = pct(c);
      container.appendChild(star);
    });
  }

  getStarPoints() {
    if (this.size === 9) return [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]];
    if (this.size === 13) return [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]];
    if (this.size === 19) {
      return [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]];
    }
    return [];
  }

  resize(newSize) {
    this.size = newSize;
    this.reset();
    this.setSizeClass();
  }

  clone() {
    const el = document.createElement("div");
    const board = new GoBoard(el, this.size, { readOnly: true });
    board.grid = this.grid.map((row) => [...row]);
    board.currentPlayer = this.currentPlayer;
    board.captures = { ...this.captures };
    board.moveCount = this.moveCount;
    board.lastMove = this.lastMove ? [...this.lastMove] : null;
    return board;
  }

  handleClick(row, col) {
    if (this.readOnly || this.frozen) return;
    if (this.allowedColor && this.currentPlayer !== this.allowedColor) return;
    const move = this.playAt(row, col);
    if (move && this.onMove) this.onMove(move);
  }

  playAt(row, col) {
    if (this.grid[row][col] !== EMPTY) return null;
    const color = this.currentPlayer;
    const result = this.tryPlay(row, col, color);
    if (!result.ok) return null;

    this.moveCount++;
    this.lastMove = [row, col];
    this.currentPlayer = color === BLACK ? WHITE : BLACK;
    this.render();

    return {
      row,
      col,
      color,
      pass: false,
      captures: result.captures,
      capturesTotal: { ...this.captures },
    };
  }

  playAtForced(row, col, color) {
    const result = this.tryPlay(row, col, color);
    if (!result.ok) return false;
    this.moveCount++;
    this.lastMove = [row, col];
    this.currentPlayer = color === BLACK ? WHITE : BLACK;
    return true;
  }

  pass() {
    const color = this.currentPlayer;
    this.lastMove = null;
    this.currentPlayer = color === BLACK ? WHITE : BLACK;
    this.render();
    return {
      row: -1,
      col: -1,
      color,
      pass: true,
      captures: 0,
      capturesTotal: { ...this.captures },
    };
  }

  tryPlay(row, col, color) {
    if (this.grid[row][col] !== EMPTY) return { ok: false };

    this.grid[row][col] = color;
    const opponent = color === BLACK ? WHITE : BLACK;
    let totalCaptures = 0;

    for (const [nr, nc] of this.neighbors(row, col)) {
      if (this.grid[nr][nc] === opponent) {
        const group = this.getGroup(nr, nc);
        if (this.countLiberties(group) === 0) {
          totalCaptures += group.length;
          this.removeGroup(group);
        }
      }
    }

    const ownGroup = this.getGroup(row, col);
    if (this.countLiberties(ownGroup) === 0) {
      this.grid[row][col] = EMPTY;
      return { ok: false };
    }

    this.captures[color] += totalCaptures;
    return { ok: true, color, captures: totalCaptures };
  }

  neighbors(row, col) {
    return [[0, 1], [0, -1], [1, 0], [-1, 0]]
      .map(([dr, dc]) => [row + dr, col + dc])
      .filter(([r, c]) => r >= 0 && r < this.size && c >= 0 && c < this.size);
  }

  getGroup(row, col) {
    const color = this.grid[row][col];
    if (!color) return [];
    const group = [];
    const visited = new Set();
    const stack = [[row, col]];
    while (stack.length) {
      const [r, c] = stack.pop();
      const key = `${r},${c}`;
      if (visited.has(key) || this.grid[r][c] !== color) continue;
      visited.add(key);
      group.push([r, c]);
      for (const [nr, nc] of this.neighbors(r, c)) {
        if (!visited.has(`${nr},${nc}`)) stack.push([nr, nc]);
      }
    }
    return group;
  }

  countLiberties(group) {
    const liberties = new Set();
    for (const [r, c] of group) {
      for (const [nr, nc] of this.neighbors(r, c)) {
        if (this.grid[nr][nc] === EMPTY) liberties.add(`${nr},${nc}`);
      }
    }
    return liberties.size;
  }

  removeGroup(group) {
    for (const [r, c] of group) this.grid[r][c] = EMPTY;
  }

  hasStones() {
    return this.grid.some((row) => row.some((cell) => cell !== EMPTY));
  }

  getLegalMoves(color) {
    const moves = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] !== EMPTY) continue;
        const trial = this.clone();
        trial.currentPlayer = color;
        if (trial.tryPlay(r, c, color).ok) moves.push([r, c]);
      }
    }
    return moves;
  }

  getCandidateMoves(color) {
    const all = this.getLegalMoves(color);
    if (!this.hasStones()) {
      const center = Math.floor(this.size / 2);
      const stars = this.getStarPoints();
      const preferred = all.filter(([r, c]) => {
        if (stars.some(([sr, sc]) => sr === r && sc === c)) return true;
        return Math.abs(r - center) <= 2 && Math.abs(c - center) <= 2;
      });
      return preferred.length ? preferred : all;
    }

    const near = all.filter(([r, c]) => {
      for (let rr = 0; rr < this.size; rr++) {
        for (let cc = 0; cc < this.size; cc++) {
          if (this.grid[rr][cc] !== EMPTY) {
            if (Math.abs(rr - r) + Math.abs(cc - c) <= 2) return true;
          }
        }
      }
      return false;
    });

    return near.length ? near : all;
  }

  setPosition(stones, nextPlayer = BLACK) {
    this.grid = this.createEmptyGrid();
    this.captures = { [BLACK]: 0, [WHITE]: 0 };
    this.moveCount = 0;
    this.currentPlayer = nextPlayer;
    this.lastMove = null;
    for (const { row, col, color } of stones) {
      this.grid[row][col] = color;
    }
    this.render();
  }

  reset() {
    this.grid = this.createEmptyGrid();
    this.currentPlayer = BLACK;
    this.captures = { [BLACK]: 0, [WHITE]: 0 };
    this.moveCount = 0;
    this.lastMove = null;
    this.frozen = false;
    this.render();
  }
}

/* ===== Go Bot ===== */
class GoBot {
  constructor(difficulty = "medium") {
    this.difficulty = difficulty;
  }

  chooseMove(board) {
    const color = board.currentPlayer;
    const moves =
      board.size === 19 && board.moveCount < board.size * 2
        ? board.getCandidateMoves(color)
        : board.getLegalMoves(color);

    if (!moves.length) return null;

    if (this.difficulty === "easy" && Math.random() < 0.4) {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    let bestScore = -Infinity;
    let bestMoves = [];

    for (const [row, col] of moves) {
      const score = this.scoreMove(board, row, col, color);
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [[row, col]];
      } else if (score === bestScore) {
        bestMoves.push([row, col]);
      }
    }

    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  scoreMove(board, row, col, color) {
    const trial = board.clone();
    trial.currentPlayer = color;
    const result = trial.tryPlay(row, col, color);
    if (!result.ok) return -9999;

    let score = result.captures * 120;

    const opponent = color === BLACK ? WHITE : BLACK;
    for (const [nr, nc] of trial.neighbors(row, col)) {
      if (trial.grid[nr][nc] === opponent) {
        const g = trial.getGroup(nr, nc);
        const libs = trial.countLiberties(g);
        if (libs === 1) score += 60;
        if (libs === 0) score += 40;
      }
    }

    const ownGroup = trial.getGroup(row, col);
    const origBoard = board.clone();
    origBoard.currentPlayer = color;
    const origTrial = origBoard.clone();
    origTrial.currentPlayer = color;
    if (board.grid[row][col] === EMPTY) {
      const before = board.clone();
      before.currentPlayer = color;
      const bt = before.clone();
      bt.currentPlayer = color;
      // Check if we were in atari before
    }

    for (const [r, c] of ownGroup) {
      for (const [nr, nc] of trial.neighbors(r, c)) {
        if (trial.grid[nr][nc] === color && (nr !== row || nc !== col)) score += 8;
      }
    }

    const center = (board.size - 1) / 2;
    const dist = Math.abs(row - center) + Math.abs(col - center);
    if (board.moveCount < board.size) score += Math.max(0, 12 - dist);

    if (this.difficulty === "hard") {
      score += result.captures * 30;
      score += trial.countLiberties(ownGroup) * 5;
    }

    score += Math.random() * 4;
    return score;
  }
}

/* ===== Game Storage ===== */
function loadGames() {
  try {
    return JSON.parse(localStorage.getItem(GAMES_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveGames(games) {
  localStorage.setItem(GAMES_KEY, JSON.stringify(games.slice(0, 50)));
}

function saveGameRecord(game) {
  const games = loadGames();
  games.unshift(game);
  saveGames(games);
}

/* ===== Lesson Content ===== */
const LESSONS = [
  {
    id: 0,
    title: "Welcome to Go",
    steps: [
      {
        text: "Go (also called Weiqi or Baduk) is a two-player strategy game invented over 4,000 years ago in China. Players take turns placing stones on a grid to surround territory. The player with more territory at the end wins.",
        stones: [],
      },
      {
        text: "Unlike chess, stones don't move once placed — they stay forever unless captured. This makes every move permanent and gives Go its deep, contemplative character.",
        stones: [
          { row: 4, col: 4, color: BLACK },
          { row: 4, col: 5, color: WHITE },
        ],
      },
    ],
  },
  {
    id: 1,
    title: "The Board & Stones",
    steps: [
      {
        text: "A standard Go board is a 19×19 grid, but beginners start on 9×9 or 13×13. Stones are placed on the intersections (where lines cross), not in the squares.",
        stones: [],
      },
      {
        text: "Black always plays first. One player takes black stones, the other white. GoDojo offers 9×9, 13×13, and full 19×19 boards.",
        stones: [{ row: 4, col: 4, color: BLACK }],
      },
    ],
  },
  {
    id: 2,
    title: "Connecting Stones",
    steps: [
      {
        text: "Stones of the same color that touch horizontally or vertically form a connected group. They share the same fate — if one is captured, all are captured.",
        stones: [
          { row: 3, col: 4, color: BLACK },
          { row: 4, col: 4, color: BLACK },
          { row: 5, col: 4, color: BLACK },
        ],
      },
      {
        text: "Connected groups are stronger together. A single stone is weak; a chain of stones can be much harder to attack.",
        stones: [
          { row: 3, col: 3, color: WHITE },
          { row: 3, col: 4, color: WHITE },
          { row: 3, col: 5, color: WHITE },
          { row: 4, col: 4, color: BLACK },
        ],
      },
    ],
  },
  {
    id: 3,
    title: "Liberties & Capturing",
    steps: [
      {
        text: "A liberty is an empty point directly adjacent to a stone or group. This lone white stone has only one liberty left.",
        stones: [
          { row: 4, col: 4, color: WHITE },
          { row: 3, col: 4, color: BLACK },
          { row: 4, col: 3, color: BLACK },
          { row: 5, col: 4, color: BLACK },
        ],
      },
      {
        text: "When black plays at the last liberty, the white stone is captured and removed from the board.",
        stones: [
          { row: 4, col: 4, color: WHITE },
          { row: 3, col: 4, color: BLACK },
          { row: 4, col: 3, color: BLACK },
          { row: 5, col: 4, color: BLACK },
          { row: 4, col: 5, color: BLACK },
        ],
      },
    ],
  },
  {
    id: 4,
    title: "Eyes & Life",
    steps: [
      {
        text: "An eye is an empty point completely surrounded by one color. Groups need two separate eyes to live. A group with only one eye can eventually be captured.",
        stones: [
          { row: 3, col: 3, color: BLACK },
          { row: 3, col: 4, color: BLACK },
          { row: 3, col: 5, color: BLACK },
          { row: 4, col: 3, color: BLACK },
          { row: 5, col: 3, color: BLACK },
          { row: 5, col: 4, color: BLACK },
          { row: 5, col: 5, color: BLACK },
          { row: 4, col: 5, color: BLACK },
        ],
      },
      {
        text: "Two eyes means the opponent can never fill both at once. This black group is alive and can never be captured.",
        stones: [
          { row: 2, col: 3, color: BLACK },
          { row: 2, col: 4, color: BLACK },
          { row: 2, col: 5, color: BLACK },
          { row: 3, col: 2, color: BLACK },
          { row: 4, col: 2, color: BLACK },
          { row: 5, col: 2, color: BLACK },
          { row: 5, col: 3, color: BLACK },
          { row: 5, col: 4, color: BLACK },
          { row: 5, col: 5, color: BLACK },
          { row: 4, col: 5, color: BLACK },
          { row: 3, col: 5, color: BLACK },
          { row: 4, col: 4, color: BLACK },
        ],
      },
    ],
  },
  {
    id: 5,
    title: "Territory & Scoring",
    steps: [
      {
        text: "The goal is to control more territory than your opponent. Territory is empty space surrounded by your stones. Both players pass to end the game, then count points.",
        stones: [
          { row: 1, col: 1, color: BLACK },
          { row: 1, col: 2, color: BLACK },
          { row: 2, col: 1, color: BLACK },
          { row: 6, col: 6, color: WHITE },
          { row: 6, col: 7, color: WHITE },
          { row: 7, col: 6, color: WHITE },
        ],
      },
      {
        text: "Captured stones count as points too. Play games on GoDojo — they're saved automatically so you can review them in Analysis!",
        stones: [
          { row: 0, col: 0, color: BLACK },
          { row: 0, col: 1, color: BLACK },
          { row: 1, col: 0, color: BLACK },
          { row: 8, col: 7, color: WHITE },
          { row: 8, col: 8, color: WHITE },
          { row: 7, col: 8, color: WHITE },
        ],
      },
    ],
  },
  {
    id: 6,
    title: "Opening Strategy",
    steps: [
      {
        text: "The opening (first ~30 moves) sets the tone. Strong players claim corners first — they're easiest to defend. Then sides, then center. Corners are worth more per stone than the middle.",
        stones: [
          { row: 2, col: 2, color: BLACK },
          { row: 6, col: 6, color: WHITE },
          { row: 2, col: 6, color: BLACK },
        ],
      },
      {
        text: "Don't spread too thin. Each stone should work with neighbors to build territory or attack. Random center stones are weak unless they connect to a larger plan.",
        stones: [
          { row: 3, col: 3, color: BLACK },
          { row: 3, col: 4, color: BLACK },
          { row: 4, col: 3, color: BLACK },
          { row: 5, col: 5, color: WHITE },
        ],
      },
    ],
  },
  {
    id: 7,
    title: "Star Points & 3-3",
    steps: [
      {
        text: "The 4-4 point (star point on 9×9) balances corner territory and side influence. It's the most popular opening. Black here threatens to take the corner while building influence toward the center.",
        stones: [{ row: 2, col: 2, color: BLACK }],
      },
      {
        text: "The 3-3 point (one line closer to the corner) takes the corner immediately but gives the opponent outside influence. Trade: safe small territory now vs. potential pressure later.",
        stones: [
          { row: 2, col: 2, color: BLACK },
          { row: 2, col: 3, color: WHITE },
        ],
      },
    ],
  },
  {
    id: 8,
    title: "Common Shapes",
    steps: [
      {
        text: "The tiger's mouth: two stones with a gap — if opponent plays inside, you capture. The empty point is a trap. Recognizing this shape helps you attack and defend corners.",
        stones: [
          { row: 4, col: 3, color: BLACK },
          { row: 4, col: 5, color: BLACK },
          { row: 3, col: 4, color: BLACK },
          { row: 5, col: 4, color: WHITE },
        ],
      },
      {
        text: "The bamboo joint: two pairs of connected stones offset by one. Very hard to cut. When you see this shape, the connection is solid.",
        stones: [
          { row: 3, col: 3, color: BLACK },
          { row: 3, col: 4, color: BLACK },
          { row: 4, col: 4, color: BLACK },
          { row: 4, col: 5, color: BLACK },
        ],
      },
    ],
  },
  {
    id: 9,
    title: "Tactics: Ladder & Net",
    steps: [
      {
        text: "A ladder is a diagonal chase — the chased group has one escape path until it hits a friendly stone (ladder breaker) or the edge. Always read ahead before starting a ladder!",
        stones: [
          { row: 2, col: 2, color: WHITE },
          { row: 3, col: 2, color: BLACK },
          { row: 2, col: 3, color: BLACK },
          { row: 4, col: 3, color: BLACK },
        ],
      },
      {
        text: "A net surrounds stones with gaps they can't slip through. Unlike a ladder, a net often works even without support. Look for stones that block two escape routes at once.",
        stones: [
          { row: 4, col: 3, color: WHITE },
          { row: 3, col: 4, color: BLACK },
          { row: 5, col: 4, color: BLACK },
          { row: 4, col: 5, color: BLACK },
          { row: 4, col: 2, color: BLACK },
        ],
      },
    ],
  },
  {
    id: 10,
    title: "Strategy: Influence vs Territory",
    steps: [
      {
        text: "Territory is confirmed points — corners and sides you've surrounded. Influence is power projecting toward the center. Influence can become territory later, but isn't points yet.",
        stones: [
          { row: 1, col: 1, color: BLACK },
          { row: 1, col: 2, color: BLACK },
          { row: 2, col: 1, color: BLACK },
          { row: 4, col: 4, color: WHITE },
          { row: 5, col: 5, color: WHITE },
        ],
      },
      {
        text: "Thickness is strong, connected stones facing open space. Don't attack with thickness — use it to support attacks elsewhere. Weak groups run; strong groups make the opponent run.",
        stones: [
          { row: 2, col: 4, color: BLACK },
          { row: 3, col: 4, color: BLACK },
          { row: 4, col: 4, color: BLACK },
          { row: 3, col: 3, color: BLACK },
          { row: 3, col: 5, color: BLACK },
          { row: 6, col: 6, color: WHITE },
        ],
      },
    ],
  },
];

/* ===== Puzzle Validation & Generation ===== */
function boardFromStones(size, stones) {
  const b = new GoBoard(document.createElement("div"), size, { readOnly: true });
  b.setPosition(stones, BLACK);
  return b;
}

function countLibertiesAt(board, row, col) {
  if (board.grid[row][col] === EMPTY) return 0;
  return board.countLiberties(board.getGroup(row, col));
}

function validatePuzzle(puzzle) {
  const size = puzzle.size || 9;
  const { stones, solution, player, type = "capture" } = puzzle;

  if (solution.row < 0 || solution.row >= size || solution.col < 0 || solution.col >= size) {
    return { valid: false, reason: "Solution out of bounds" };
  }

  const board = boardFromStones(size, stones);
  if (board.grid[solution.row][solution.col] !== EMPTY) {
    return { valid: false, reason: "Solution point occupied" };
  }

  const targetColor = player === BLACK ? WHITE : BLACK;
  const targetGroups = [];
  const seen = new Set();

  if (type === "capture") {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board.grid[r][c] !== targetColor) continue;
        const key = board
          .getGroup(r, c)
          .map(([gr, gc]) => `${gr},${gc}`)
          .sort()
          .join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        targetGroups.push(board.getGroup(r, c));
      }
    }
    if (targetGroups.length === 0) {
      return { valid: false, reason: "No target stones" };
    }
    for (const group of targetGroups) {
      const groupLibs = board.countLiberties(group);
      if (groupLibs !== 1) {
        return {
          valid: false,
          reason: `Target group has ${groupLibs} liberties, expected 1`,
        };
      }
    }
  }

  const trial = board.clone();
  trial.currentPlayer = player;
  const result = trial.tryPlay(solution.row, solution.col, player);
  if (!result.ok) return { valid: false, reason: "Solution is illegal" };

  if (type === "capture") {
    if (result.captures < 1) {
      return { valid: false, reason: "Solution does not capture" };
    }
    for (const group of targetGroups) {
      for (const [r, c] of group) {
        if (trial.grid[r][c] === targetColor) {
          return { valid: false, reason: "Target stones still on board" };
        }
      }
    }
  }

  if (type === "life") {
    const own = trial.getGroup(solution.row, solution.col);
    if (trial.countLiberties(own) < 2) {
      return { valid: false, reason: "Group not alive after solution" };
    }
  }

  return { valid: true, captures: result.captures };
}

function validateAllPuzzles() {
  const failures = [];
  PUZZLES.forEach((p) => {
    const v = validatePuzzle(p);
    if (!v.valid) failures.push({ id: p.id, title: p.title, reason: v.reason });
  });
  if (failures.length) {
    console.warn("Invalid puzzles:", failures);
  }
  return failures;
}

function generateRatedPuzzle(playerRating) {
  const size = 9;
  const types =
    playerRating < 500
      ? ["capture1"]
      : playerRating < 700
        ? ["capture1", "capture2"]
        : ["capture1", "capture2", "cut"];

  for (let attempt = 0; attempt < 80; attempt++) {
    const type = types[Math.floor(Math.random() * types.length)];
    let puzzle = null;

    if (type === "capture1") puzzle = generateSingleCapture(size);
    else if (type === "capture2") puzzle = generateDoubleCapture(size);
    else puzzle = generateCutCapture(size);

    if (!puzzle) continue;

    const targetRating = Math.max(300, Math.min(1200, playerRating + (Math.random() * 120 - 60)));
    puzzle.generated = true;
    puzzle.difficulty = "Rated";
    puzzle.title = "Rated puzzle";
    puzzle.player = BLACK;
    puzzle.hint = puzzle.hint || "Find the move that captures.";
    puzzle.puzzleRating = Math.round(targetRating);
    puzzle.id = `gen-${Date.now()}-${attempt}`;

    const v = validatePuzzle(puzzle);
    if (v.valid) return puzzle;
  }
  return null;
}

function generateSingleCapture(size) {
  for (let t = 0; t < 40; t++) {
    const row = 2 + Math.floor(Math.random() * (size - 4));
    const col = 2 + Math.floor(Math.random() * (size - 4));
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]].sort(() => Math.random() - 0.5);
    const [lr, lc] = [row + dirs[0][0], col + dirs[0][1]];
    if (lr < 0 || lr >= size || lc < 0 || lc >= size) continue;

    const stones = [{ row, col, color: WHITE }];
    let ok = true;
    for (let i = 1; i < 4; i++) {
      const br = row + dirs[i][0];
      const bc = col + dirs[i][1];
      if (br < 0 || br >= size || bc < 0 || bc >= size) {
        ok = false;
        break;
      }
      if (br === lr && bc === lc) {
        ok = false;
        break;
      }
      stones.push({ row: br, col: bc, color: BLACK });
    }
    if (!ok) continue;

    const puzzle = {
      type: "capture",
      size,
      desc: "Black to play. Capture the white stone.",
      stones,
      solution: { row: lr, col: lc },
    };
    if (validatePuzzle(puzzle).valid) return puzzle;
  }
  return null;
}

function generateDoubleCapture(size) {
  for (let t = 0; t < 40; t++) {
    const row = 2 + Math.floor(Math.random() * (size - 4));
    const col = 2 + Math.floor(Math.random() * (size - 4));
    if (col + 2 >= size || row - 1 < 0 || row + 1 >= size || col - 1 < 0) continue;

    const stones = [
      { row, col, color: WHITE },
      { row, col: col + 1, color: WHITE },
      { row: row - 1, col, color: BLACK },
      { row: row - 1, col: col + 1, color: BLACK },
      { row: row + 1, col, color: BLACK },
      { row: row + 1, col: col + 1, color: BLACK },
      { row, col: col - 1, color: BLACK },
    ];

    const puzzle = {
      type: "capture",
      size,
      desc: "Black to play. Capture both white stones.",
      stones,
      solution: { row, col: col + 2 },
    };
    if (validatePuzzle(puzzle).valid) return puzzle;
  }
  return null;
}

function generateCutCapture(size) {
  const row = 4;
  const col = 4;
  const puzzle = {
    type: "capture",
    size,
    desc: "Black to play. Cut and capture both white stones.",
    stones: [
      { row, col: col - 1, color: WHITE },
      { row, col: col + 1, color: WHITE },
      { row: row - 1, col: col - 1, color: BLACK },
      { row: row - 1, col: col + 1, color: BLACK },
      { row: row + 1, col: col - 1, color: BLACK },
      { row: row + 1, col: col + 1, color: BLACK },
      { row, col: col - 2, color: BLACK },
      { row, col: col + 2, color: BLACK },
    ],
    solution: { row, col },
  };
  return validatePuzzle(puzzle).valid ? puzzle : null;
}

/* ===== Puzzles ===== */
const PUZZLES = [
  {
    id: 0,
    title: "Capture the stone",
    difficulty: "Beginner",
    size: 9,
    type: "capture",
    desc: "White has only one liberty left. Where should black play to capture?",
    stones: [
      { row: 4, col: 4, color: WHITE },
      { row: 3, col: 4, color: BLACK },
      { row: 4, col: 3, color: BLACK },
      { row: 5, col: 4, color: BLACK },
    ],
    solution: { row: 4, col: 5 },
    player: BLACK,
    hint: "Play on the last empty point next to the white stone.",
  },
  {
    id: 1,
    title: "Capture two stones",
    difficulty: "Beginner",
    size: 9,
    desc: "Two white stones share one liberty. Capture both in one move.",
    stones: [
      { row: 4, col: 4, color: WHITE },
      { row: 4, col: 5, color: WHITE },
      { row: 3, col: 4, color: BLACK },
      { row: 3, col: 5, color: BLACK },
      { row: 5, col: 4, color: BLACK },
      { row: 5, col: 5, color: BLACK },
      { row: 4, col: 3, color: BLACK },
    ],
    solution: { row: 4, col: 6 },
    player: BLACK,
    hint: "Play on the last empty point touching both white stones.",
  },
  {
    id: 2,
    title: "Cut and capture",
    difficulty: "Beginner",
    size: 9,
    desc: "Two white stones are separated. Play between them to capture both.",
    stones: [
      { row: 4, col: 3, color: WHITE },
      { row: 4, col: 5, color: WHITE },
      { row: 3, col: 3, color: BLACK },
      { row: 3, col: 5, color: BLACK },
      { row: 5, col: 3, color: BLACK },
      { row: 5, col: 5, color: BLACK },
      { row: 4, col: 2, color: BLACK },
      { row: 4, col: 6, color: BLACK },
    ],
    solution: { row: 4, col: 4 },
    player: BLACK,
    hint: "Play between the two white stones.",
  },
  {
    id: 3,
    title: "Corner capture",
    difficulty: "Beginner",
    size: 9,
    type: "capture",
    desc: "The white stone in the corner has one liberty. Black to capture.",
    stones: [
      { row: 0, col: 1, color: WHITE },
      { row: 1, col: 0, color: BLACK },
      { row: 1, col: 1, color: BLACK },
      { row: 0, col: 0, color: BLACK },
    ],
    solution: { row: 0, col: 2 },
    player: BLACK,
    hint: "Fill the last liberty along the top edge.",
  },
  {
    id: 4,
    title: "Side capture",
    difficulty: "Beginner",
    size: 9,
    type: "capture",
    desc: "The white stone on the edge has only one liberty left.",
    stones: [
      { row: 4, col: 0, color: WHITE },
      { row: 3, col: 0, color: BLACK },
      { row: 5, col: 0, color: BLACK },
    ],
    solution: { row: 4, col: 1 },
    player: BLACK,
    hint: "Play on the only empty point next to white.",
  },
  {
    id: 5,
    title: "Ladder breaker? Capture!",
    difficulty: "Intermediate",
    size: 9,
    desc: "A single white stone is almost surrounded. Find the capturing move.",
    stones: [
      { row: 3, col: 3, color: WHITE },
      { row: 2, col: 3, color: BLACK },
      { row: 4, col: 3, color: BLACK },
      { row: 3, col: 2, color: BLACK },
    ],
    solution: { row: 3, col: 4 },
    player: BLACK,
    hint: "Close off the last liberty above the stone.",
  },
  {
    id: 6,
    title: "Cutting stone",
    difficulty: "Intermediate",
    size: 9,
    type: "capture",
    desc: "White cuts between two black stones. Capture the cutting stone with one move.",
    stones: [
      { row: 4, col: 4, color: BLACK },
      { row: 4, col: 5, color: WHITE },
      { row: 3, col: 5, color: BLACK },
      { row: 5, col: 5, color: BLACK },
      { row: 4, col: 3, color: BLACK },
    ],
    solution: { row: 4, col: 6 },
    player: BLACK,
    hint: "Fill white's last liberty on the right.",
  },
  {
    id: 7,
    title: "Block the escape",
    difficulty: "Intermediate",
    size: 9,
    desc: "White is almost surrounded on the upper side. Play the capturing move.",
    stones: [
      { row: 2, col: 4, color: WHITE },
      { row: 1, col: 4, color: BLACK },
      { row: 3, col: 4, color: BLACK },
      { row: 2, col: 3, color: BLACK },
    ],
    solution: { row: 2, col: 5 },
    player: BLACK,
    hint: "Close off the last open point next to the white stone.",
  },
  {
    id: 8,
    title: "Make two eyes",
    difficulty: "Intermediate",
    size: 9,
    type: "life",
    desc: "White threatens to capture the black group. Black plays inside to make two eyes and live.",
    stones: [
      { row: 3, col: 3, color: BLACK },
      { row: 3, col: 4, color: BLACK },
      { row: 3, col: 5, color: BLACK },
      { row: 4, col: 3, color: BLACK },
      { row: 5, col: 3, color: BLACK },
      { row: 5, col: 4, color: BLACK },
      { row: 5, col: 5, color: BLACK },
      { row: 4, col: 5, color: BLACK },
      { row: 2, col: 3, color: WHITE },
      { row: 2, col: 4, color: WHITE },
      { row: 2, col: 5, color: WHITE },
      { row: 4, col: 2, color: WHITE },
      { row: 5, col: 2, color: WHITE },
      { row: 6, col: 3, color: WHITE },
      { row: 6, col: 4, color: WHITE },
      { row: 6, col: 5, color: WHITE },
      { row: 4, col: 6, color: WHITE },
    ],
    solution: { row: 4, col: 4 },
    player: BLACK,
    hint: "Play inside the group to split the interior into two eyes.",
  },
  {
    id: 9,
    title: "Outside atari",
    difficulty: "Intermediate",
    size: 9,
    desc: "Capture the three white stones on the edge.",
    stones: [
      { row: 0, col: 3, color: WHITE },
      { row: 0, col: 4, color: WHITE },
      { row: 0, col: 5, color: WHITE },
      { row: 1, col: 3, color: BLACK },
      { row: 1, col: 4, color: BLACK },
      { row: 1, col: 5, color: BLACK },
      { row: 0, col: 6, color: BLACK },
    ],
    solution: { row: 0, col: 2 },
    player: BLACK,
    hint: "Edge groups have fewer liberties. Attack from the last open side.",
  },
  {
    id: 10,
    title: "13×13 corner",
    difficulty: "Advanced",
    size: 13,
    desc: "On a larger board — capture white in the corner.",
    stones: [
      { row: 0, col: 1, color: WHITE },
      { row: 1, col: 0, color: BLACK },
      { row: 1, col: 1, color: BLACK },
      { row: 0, col: 0, color: BLACK },
    ],
    solution: { row: 0, col: 2 },
    player: BLACK,
    hint: "Fill white's last liberty along the top edge.",
  },
  {
    id: 11,
    title: "Surround the group",
    difficulty: "Advanced",
    size: 9,
    desc: "The white group has one liberty left in the center. Black to capture five stones.",
    stones: [
      { row: 3, col: 3, color: WHITE },
      { row: 3, col: 4, color: WHITE },
      { row: 3, col: 5, color: WHITE },
      { row: 4, col: 3, color: WHITE },
      { row: 4, col: 5, color: WHITE },
      { row: 2, col: 3, color: BLACK },
      { row: 2, col: 4, color: BLACK },
      { row: 2, col: 5, color: BLACK },
      { row: 3, col: 2, color: BLACK },
      { row: 4, col: 2, color: BLACK },
      { row: 5, col: 3, color: BLACK },
      { row: 5, col: 4, color: BLACK },
      { row: 5, col: 5, color: BLACK },
      { row: 4, col: 6, color: BLACK },
      { row: 3, col: 6, color: BLACK },
    ],
    solution: { row: 4, col: 4 },
    player: BLACK,
    hint: "Play inside the ring to remove the last liberty.",
  },
  {
    id: 12,
    title: "Bottom edge",
    difficulty: "Beginner",
    size: 9,
    type: "capture",
    desc: "Capture the white stone on the bottom edge.",
    stones: [
      { row: 8, col: 4, color: WHITE },
      { row: 7, col: 4, color: BLACK },
      { row: 8, col: 5, color: BLACK },
    ],
    solution: { row: 8, col: 3 },
    player: BLACK,
    hint: "Stones on the edge have fewer escapes.",
  },
  {
    id: 13,
    title: "Narrow gap",
    difficulty: "Beginner",
    size: 9,
    type: "capture",
    desc: "Two white stones in a row — capture both.",
    stones: [
      { row: 4, col: 4, color: WHITE },
      { row: 4, col: 5, color: WHITE },
      { row: 3, col: 4, color: BLACK },
      { row: 3, col: 5, color: BLACK },
      { row: 5, col: 4, color: BLACK },
      { row: 5, col: 5, color: BLACK },
      { row: 4, col: 3, color: BLACK },
    ],
    solution: { row: 4, col: 6 },
    player: BLACK,
    hint: "Fill the shared liberty on the right.",
  },
  {
    id: 14,
    title: "Vertical pair",
    difficulty: "Beginner",
    size: 9,
    type: "capture",
    desc: "Capture both white stones stacked vertically.",
    stones: [
      { row: 4, col: 4, color: WHITE },
      { row: 5, col: 4, color: WHITE },
      { row: 3, col: 4, color: BLACK },
      { row: 6, col: 4, color: BLACK },
      { row: 4, col: 3, color: BLACK },
      { row: 5, col: 3, color: BLACK },
      { row: 5, col: 5, color: BLACK },
    ],
    solution: { row: 4, col: 5 },
    player: BLACK,
    hint: "Attack from the right — one liberty left.",
  },
  {
    id: 15,
    title: "Lose the ladder",
    difficulty: "Intermediate",
    size: 9,
    type: "capture",
    desc: "White is running — cut off the escape with one move.",
    stones: [
      { row: 3, col: 3, color: WHITE },
      { row: 2, col: 3, color: BLACK },
      { row: 4, col: 3, color: BLACK },
      { row: 3, col: 2, color: BLACK },
    ],
    solution: { row: 3, col: 4 },
    player: BLACK,
    hint: "Block the last liberty on the right.",
  },
  {
    id: 16,
    title: "Clamp",
    difficulty: "Intermediate",
    size: 9,
    type: "capture",
    desc: "White thought the corner was safe. Prove otherwise.",
    stones: [
      { row: 1, col: 6, color: WHITE },
      { row: 0, col: 6, color: BLACK },
      { row: 1, col: 5, color: BLACK },
      { row: 2, col: 6, color: BLACK },
    ],
    solution: { row: 1, col: 7 },
    player: BLACK,
    hint: "Fill the last liberty on the right.",
  },
  {
    id: 17,
    title: "Big capture",
    difficulty: "Advanced",
    size: 9,
    type: "capture",
    desc: "A ring of white has one breath left inside.",
    stones: [
      { row: 3, col: 3, color: WHITE },
      { row: 3, col: 4, color: WHITE },
      { row: 3, col: 5, color: WHITE },
      { row: 4, col: 3, color: WHITE },
      { row: 4, col: 5, color: WHITE },
      { row: 2, col: 3, color: BLACK },
      { row: 2, col: 4, color: BLACK },
      { row: 2, col: 5, color: BLACK },
      { row: 3, col: 2, color: BLACK },
      { row: 4, col: 2, color: BLACK },
      { row: 5, col: 3, color: BLACK },
      { row: 5, col: 4, color: BLACK },
      { row: 5, col: 5, color: BLACK },
      { row: 4, col: 6, color: BLACK },
      { row: 3, col: 6, color: BLACK },
    ],
    solution: { row: 4, col: 4 },
    player: BLACK,
    hint: "Play inside the ring.",
  },
  {
    id: 18,
    title: "13×13 side",
    difficulty: "Advanced",
    size: 13,
    type: "capture",
    desc: "Larger board — capture the isolated white stone.",
    stones: [
      { row: 6, col: 6, color: WHITE },
      { row: 5, col: 6, color: BLACK },
      { row: 7, col: 6, color: BLACK },
      { row: 6, col: 5, color: BLACK },
    ],
    solution: { row: 6, col: 7 },
    player: BLACK,
    hint: "Fill the last liberty.",
  },
  {
    id: 19,
    title: "Connect and live",
    difficulty: "Advanced",
    size: 9,
    type: "life",
    desc: "Black is in danger. Play inside the group to create two eyes.",
    stones: [
      { row: 3, col: 3, color: BLACK },
      { row: 3, col: 4, color: BLACK },
      { row: 3, col: 5, color: BLACK },
      { row: 4, col: 3, color: BLACK },
      { row: 5, col: 3, color: BLACK },
      { row: 5, col: 4, color: BLACK },
      { row: 5, col: 5, color: BLACK },
      { row: 4, col: 5, color: BLACK },
      { row: 2, col: 3, color: WHITE },
      { row: 2, col: 4, color: WHITE },
      { row: 2, col: 5, color: WHITE },
      { row: 4, col: 2, color: WHITE },
      { row: 5, col: 2, color: WHITE },
      { row: 6, col: 3, color: WHITE },
      { row: 6, col: 4, color: WHITE },
      { row: 6, col: 5, color: WHITE },
      { row: 4, col: 6, color: WHITE },
    ],
    solution: { row: 4, col: 4 },
    player: BLACK,
    hint: "One move inside splits the space into two eyes.",
  },
];

/* ===== App State ===== */
let currentLesson = 0;
let currentStep = 0;
let currentPuzzle = 0;
let puzzleFilter = "all";
let puzzleMode = "classic";
let activePuzzle = null;
let puzzleRating = parseInt(localStorage.getItem(RATING_KEY) || "400", 10);
let lessonProgress = JSON.parse(localStorage.getItem("goLessonProgress") || "{}");

let lessonBoard;
let playBoard;
let puzzleBoard;
let heroBoard;
let analysisBoard;

let playSize = 9;
let playMode = "bot";
let botDifficulty = "medium";
let humanColor = BLACK;
let bot;
let botThinking = false;
let consecutivePasses = 0;
let gameEnded = false;
let currentGame = null;

let selectedGame = null;
let analysisMoveIndex = 0;

/* ===== Navigation ===== */
function showView(viewId) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById(`view-${viewId}`).classList.add("active");
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === viewId);
  });

  if (viewId === "learn") loadLesson(currentLesson);
  if (viewId === "puzzles") {
    updateRatingDisplay();
    if (puzzleMode === "rated" && !activePuzzle?.generated) loadRatedPuzzle();
    else if (activePuzzle) displayPuzzle(activePuzzle);
    else loadPuzzle(currentPuzzle);
  }
  if (viewId === "analysis") refreshGameList();
}

document.querySelectorAll("[data-view]").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    showView(el.dataset.view);
  });
});

/* ===== Lessons ===== */
function buildLessonList() {
  const list = document.getElementById("lesson-list");
  list.innerHTML = "";
  LESSONS.forEach((lesson, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = lesson.title;
    if (lessonProgress[i]) btn.classList.add("completed");
    if (i === currentLesson) btn.classList.add("active");
    btn.addEventListener("click", () => {
      currentLesson = i;
      currentStep = 0;
      loadLesson(i);
    });
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function updateLessonListActive() {
  document.querySelectorAll("#lesson-list button").forEach((btn, i) => {
    btn.classList.toggle("active", i === currentLesson);
    btn.classList.toggle("completed", !!lessonProgress[i]);
  });
}

function loadLesson(index) {
  const lesson = LESSONS[index];
  currentStep = Math.min(currentStep, lesson.steps.length - 1);
  document.getElementById("lesson-number").textContent = `Lesson ${index + 1}`;
  document.getElementById("lesson-title").textContent = lesson.title;
  const step = lesson.steps[currentStep];
  document.getElementById("lesson-text").textContent = step.text;
  document.getElementById("lesson-step-indicator").textContent =
    `Step ${currentStep + 1} of ${lesson.steps.length}`;
  document.getElementById("lesson-prev").disabled = currentStep === 0;
  document.getElementById("lesson-next").textContent =
    currentStep === lesson.steps.length - 1 ? "Complete ✓" : "Next →";

  if (!lessonBoard) {
    lessonBoard = new GoBoard(document.getElementById("lesson-board"), 9, { readOnly: true });
  }
  lessonBoard.setPosition(step.stones);
  updateLessonListActive();
}

document.getElementById("lesson-prev").addEventListener("click", () => {
  if (currentStep > 0) {
    currentStep--;
    loadLesson(currentLesson);
  }
});

document.getElementById("lesson-next").addEventListener("click", () => {
  const lesson = LESSONS[currentLesson];
  if (currentStep < lesson.steps.length - 1) {
    currentStep++;
    loadLesson(currentLesson);
  } else {
    lessonProgress[currentLesson] = true;
    localStorage.setItem("goLessonProgress", JSON.stringify(lessonProgress));
    if (currentLesson < LESSONS.length - 1) {
      currentLesson++;
      currentStep = 0;
      loadLesson(currentLesson);
    }
  }
});

/* ===== Play Mode ===== */
function createNewGameRecord() {
  return {
    id: Date.now(),
    date: new Date().toISOString(),
    size: playSize,
    mode: playMode,
    botDifficulty: playMode === "bot" ? botDifficulty : null,
    humanColor: playMode === "bot" ? humanColor : null,
    moves: [],
    finalCaptures: { [BLACK]: 0, [WHITE]: 0 },
    result: null,
  };
}

function startNewGame() {
  if (currentGame && currentGame.moves.length > 0 && !currentGame.result) {
    currentGame.result = "Game abandoned";
    saveGameRecord(currentGame);
  }

  currentGame = createNewGameRecord();
  consecutivePasses = 0;
  gameEnded = false;
  botThinking = false;

  if (playBoard && playBoard.size !== playSize) {
    playBoard.resize(playSize);
  } else if (playBoard) {
    playBoard.reset();
  }

  document.getElementById("game-status").textContent = "";
  document.getElementById("game-status").classList.remove("ended");
  document.getElementById("board-size-label").textContent = `${playSize}×${playSize}`;

  updatePlayUI();

  if (playMode === "bot" && humanColor === WHITE) {
    setTimeout(() => botTurn(), 500);
  }
}

function recordMove(move) {
  if (!currentGame || gameEnded) return;
  currentGame.moves.push({
    row: move.row,
    col: move.col,
    color: move.color,
    pass: move.pass,
    captures: move.captures,
  });
  currentGame.finalCaptures = { ...move.capturesTotal };
}

function endGame(message) {
  if (gameEnded) return;
  gameEnded = true;
  playBoard.frozen = true;
  if (currentGame) {
    currentGame.result = message;
    currentGame.finalCaptures = { ...playBoard.captures };
    saveGameRecord(currentGame);
  }
  const status = document.getElementById("game-status");
  status.textContent = `${message} — saved to Analysis`;
  status.classList.add("ended");
}

function updatePlayUI() {
  if (!playBoard) return;
  const isBlack = playBoard.currentPlayer === BLACK;
  const label =
    playMode === "bot"
      ? isBlack
        ? humanColor === BLACK
          ? "Your turn (Black)"
          : "Bot thinking…"
        : humanColor === WHITE
          ? "Your turn (White)"
          : "Bot thinking…"
      : isBlack
        ? "Black to play"
        : "White to play";

  document.getElementById("current-player-label").textContent = label;
  document.getElementById("current-player-stone").className =
    `stone-preview ${isBlack ? "black" : "white"}`;
  document.getElementById("captures-black").textContent = playBoard.captures[BLACK];
  document.getElementById("captures-white").textContent = playBoard.captures[WHITE];
  document.getElementById("move-count").textContent = playBoard.moveCount;
}

function onPlayMove(move) {
  recordMove(move);
  consecutivePasses = 0;
  updatePlayUI();

  if (playMode === "bot" && !gameEnded) {
    const botColor = humanColor === BLACK ? WHITE : BLACK;
    if (playBoard.currentPlayer === botColor) {
      setTimeout(() => botTurn(), 450);
    }
  }
}

function botTurn() {
  if (gameEnded || botThinking || playMode !== "bot") return;
  const botColor = humanColor === BLACK ? WHITE : BLACK;
  if (playBoard.currentPlayer !== botColor) return;

  botThinking = true;
  playBoard.frozen = true;
  playBoard.render();

  const move = bot.chooseMove(playBoard);
  if (!move) {
    const passMove = playBoard.pass();
    recordMove(passMove);
    consecutivePasses++;
    if (consecutivePasses >= 2) endGame("Both players passed");
    botThinking = false;
    playBoard.frozen = gameEnded;
    updatePlayUI();
    return;
  }

  const [row, col] = move;
  const result = playBoard.playAt(row, col);
  if (result) recordMove(result);
  botThinking = false;
  playBoard.frozen = gameEnded;
  updatePlayUI();
}

function initPlayBoard() {
  const el = document.getElementById("play-board");
  playBoard = new GoBoard(el, playSize, { onMove: onPlayMove });
  bot = new GoBot(botDifficulty);
  startNewGame();
}

document.querySelectorAll(".size-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".size-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    playSize = parseInt(tab.dataset.size, 10);
    startNewGame();
  });
});

document.querySelectorAll(".mode-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".mode-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    playMode = tab.dataset.mode;
    document.getElementById("bot-settings").style.display =
      playMode === "bot" ? "block" : "none";
    startNewGame();
  });
});

document.getElementById("bot-difficulty").addEventListener("change", (e) => {
  botDifficulty = e.target.value;
  bot = new GoBot(botDifficulty);
});

document.querySelectorAll(".color-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".color-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    humanColor = parseInt(tab.dataset.color, 10);
    startNewGame();
  });
});

document.getElementById("pass-btn").addEventListener("click", () => {
  if (gameEnded || botThinking) return;
  if (playMode === "bot" && playBoard.currentPlayer !== humanColor) return;

  const move = playBoard.pass();
  recordMove(move);
  consecutivePasses++;
  updatePlayUI();

  if (consecutivePasses >= 2) {
    endGame("Both players passed — count territory to score");
    return;
  }

  if (playMode === "bot" && playBoard.currentPlayer !== humanColor) {
    setTimeout(() => botTurn(), 400);
  }
});

document.getElementById("reset-btn").addEventListener("click", startNewGame);

/* ===== Puzzles ===== */
function updateRatingDisplay(change) {
  document.getElementById("puzzle-rating-value").textContent = puzzleRating;
  const el = document.getElementById("puzzle-rating-change");
  if (change > 0) {
    el.textContent = `+${change} last puzzle`;
    el.className = "rating-change up";
  } else if (change < 0) {
    el.textContent = `${change} last puzzle`;
    el.className = "rating-change down";
  } else {
    el.textContent = "";
    el.className = "rating-change";
  }
}

function adjustRating(puzzle, correct) {
  const diff = puzzle.puzzleRating - puzzleRating;
  let delta;
  if (correct) {
    delta = Math.round(12 + Math.max(0, diff) * 0.05);
    delta = Math.min(25, delta);
  } else {
    delta = -Math.round(8 + Math.max(0, -diff) * 0.04);
    delta = Math.max(-20, delta);
  }
  puzzleRating = Math.max(100, Math.min(2000, puzzleRating + delta));
  localStorage.setItem(RATING_KEY, String(puzzleRating));
  updateRatingDisplay(delta);
  return delta;
}

function buildPuzzleList() {
  const list = document.getElementById("puzzle-list");
  list.innerHTML = "";
  const filtered = PUZZLES.filter(
    (p) => puzzleFilter === "all" || p.difficulty === puzzleFilter
  );

  filtered.forEach((puzzle) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = puzzle.title;
    btn.dataset.puzzle = puzzle.id;
    if (puzzle.id === currentPuzzle && puzzleMode === "classic") btn.classList.add("active");
    btn.addEventListener("click", () => {
      currentPuzzle = puzzle.id;
      puzzleMode = "classic";
      loadPuzzle(puzzle.id);
      document.querySelectorAll("#puzzle-list button").forEach((b) => {
        b.classList.toggle("active", parseInt(b.dataset.puzzle, 10) === puzzle.id);
      });
    });
    li.appendChild(btn);
    list.appendChild(li);
  });
}

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    puzzleFilter = btn.dataset.filter;
    buildPuzzleList();
  });
});

document.querySelectorAll(".puzzle-mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".puzzle-mode-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    puzzleMode = btn.dataset.pmode;
    const isRated = puzzleMode === "rated";
    document.getElementById("classic-puzzle-filters").classList.toggle("hidden", isRated);
    document.getElementById("puzzle-list").classList.toggle("hidden", isRated);
    document.getElementById("rated-next-btn").classList.toggle("hidden", !isRated);
    document.getElementById("puzzle-sidebar-desc").textContent = isRated
      ? "Random puzzles matched to your rating. Gain points for correct answers."
      : "Curated puzzles by difficulty.";
    if (isRated) loadRatedPuzzle();
    else loadPuzzle(currentPuzzle);
  });
});

document.getElementById("rated-next-btn").addEventListener("click", loadRatedPuzzle);

function displayPuzzle(puzzle) {
  activePuzzle = puzzle;
  const size = puzzle.size || 9;

  let badge = puzzle.difficulty;
  if (puzzle.generated && puzzle.puzzleRating) {
    badge = `Rated ~${puzzle.puzzleRating}`;
  }
  document.getElementById("puzzle-difficulty").textContent = badge;
  document.getElementById("puzzle-title").textContent = puzzle.title;
  document.getElementById("puzzle-desc").textContent = puzzle.desc;

  const feedback = document.getElementById("puzzle-feedback");
  feedback.textContent = puzzle.generated
    ? "Solve to gain rating points."
    : "Find the correct move.";
  feedback.className = "puzzle-feedback";

  const el = document.getElementById("puzzle-board");
  if (!puzzleBoard || puzzleBoard.size !== size) {
    puzzleBoard = new GoBoard(el, size, {
      onMove: (move) => checkPuzzleMove(move),
    });
  }

  puzzleBoard.readOnly = false;
  puzzleBoard.allowedColor = puzzle.player || BLACK;
  puzzleBoard.reset();
  puzzleBoard.setPosition(puzzle.stones, puzzle.player || BLACK);
  puzzleBoard.currentPlayer = puzzle.player || BLACK;
  puzzleBoard._activePuzzle = puzzle;
  el.className = `go-board size-${size}`;
}

function loadPuzzle(index) {
  const puzzle = PUZZLES.find((p) => p.id === index) || PUZZLES[0];
  currentPuzzle = puzzle.id;
  puzzleMode = "classic";
  displayPuzzle(puzzle);
}

function loadRatedPuzzle() {
  const puzzle = generateRatedPuzzle(puzzleRating);
  if (!puzzle) {
    document.getElementById("puzzle-feedback").textContent =
      "Could not generate a puzzle — try again.";
    return;
  }
  puzzleMode = "rated";
  displayPuzzle(puzzle);
}

function checkPuzzleMove(move) {
  const puzzle = puzzleBoard._activePuzzle;
  const feedback = document.getElementById("puzzle-feedback");
  const correct =
    move.row === puzzle.solution.row && move.col === puzzle.solution.col;

  if (correct) {
    if (puzzle.generated) {
      const delta = adjustRating(puzzle, true);
      feedback.textContent = `Correct! Rating +${delta}. Loading next…`;
      setTimeout(() => loadRatedPuzzle(), 1400);
    } else {
      feedback.textContent = "Correct! Well played.";
    }
    feedback.className = "puzzle-feedback success";
    puzzleBoard.readOnly = true;
  } else {
    if (puzzle.generated) adjustRating(puzzle, false);
    feedback.textContent = puzzle.generated
      ? "Wrong — rating decreased. Try the next puzzle."
      : "Not quite — try again.";
    feedback.className = "puzzle-feedback error";
    setTimeout(() => {
      if (puzzle.generated) loadRatedPuzzle();
      else displayPuzzle(puzzle);
    }, puzzle.generated ? 1200 : 600);
  }
}

document.getElementById("puzzle-hint").addEventListener("click", () => {
  const puzzle = activePuzzle || PUZZLES.find((p) => p.id === currentPuzzle);
  if (puzzle) {
    document.getElementById("puzzle-feedback").textContent = `Hint: ${puzzle.hint}`;
  }
});

document.getElementById("puzzle-reset").addEventListener("click", () => {
  if (puzzleMode === "rated") loadRatedPuzzle();
  else loadPuzzle(currentPuzzle);
});

/* ===== Analysis ===== */
function formatGameDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function refreshGameList() {
  const games = loadGames();
  const list = document.getElementById("game-list");
  const noMsg = document.getElementById("no-games-msg");
  list.innerHTML = "";

  if (!games.length) {
    noMsg.classList.remove("hidden");
    document.getElementById("analysis-empty").classList.remove("hidden");
    document.getElementById("analysis-panel").classList.add("hidden");
    return;
  }

  noMsg.classList.add("hidden");

  games.forEach((game) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    const modeLabel =
      game.mode === "bot"
        ? `vs Bot (${game.botDifficulty})`
        : "Local 2P";
    btn.innerHTML = `<span class="game-date">${formatGameDate(game.date)}</span><span class="game-detail">${game.size}×${game.size} · ${modeLabel} · ${game.moves.length} moves</span>`;
    if (selectedGame && selectedGame.id === game.id) btn.classList.add("active");
    btn.addEventListener("click", () => loadAnalysisGame(game));
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function loadAnalysisGame(game) {
  selectedGame = game;
  analysisMoveIndex = 0;
  refreshGameList();

  document.getElementById("analysis-empty").classList.add("hidden");
  document.getElementById("analysis-panel").classList.remove("hidden");

  document.getElementById("analysis-badge").textContent = `${game.size}×${game.size}`;
  document.getElementById("analysis-title").textContent = game.result || "Game review";
  const modeLabel =
    game.mode === "bot"
      ? `You played ${COLOR_NAMES[game.humanColor]} vs ${game.botDifficulty} bot`
      : "Local two-player game";
  document.getElementById("analysis-meta").textContent =
    `${formatGameDate(game.date)} · ${modeLabel} · ${game.moves.length} moves`;

  const el = document.getElementById("analysis-board");
  if (!analysisBoard || analysisBoard.size !== game.size) {
    analysisBoard = new GoBoard(el, game.size, { readOnly: true });
  }

  const slider = document.getElementById("analysis-slider");
  slider.max = game.moves.length;
  slider.value = 0;

  buildMoveList(game);
  showAnalysisMove(0);
}

function buildMoveList(game) {
  const ol = document.getElementById("analysis-move-list");
  ol.innerHTML = "";

  const startLi = document.createElement("li");
  startLi.textContent = "Start";
  startLi.dataset.index = 0;
  startLi.addEventListener("click", () => showAnalysisMove(0));
  ol.appendChild(startLi);

  game.moves.forEach((move, i) => {
    const li = document.createElement("li");
    const n = i + 1;
    if (move.pass) {
      li.textContent = `${n}. ${COLOR_NAMES[move.color]} passes`;
      li.classList.add("pass");
    } else {
      const col = String.fromCharCode(65 + move.col);
      const row = game.size - move.row;
      li.textContent = `${n}. ${COLOR_NAMES[move.color]} ${col}${row}`;
    }
    li.dataset.index = n;
    li.addEventListener("click", () => showAnalysisMove(n));
    ol.appendChild(li);
  });
}

function showAnalysisMove(index) {
  if (!selectedGame) return;
  const game = selectedGame;
  analysisMoveIndex = index;

  analysisBoard.reset();
  let capBlack = 0;
  let capWhite = 0;

  for (let i = 0; i < index; i++) {
    const m = game.moves[i];
    if (m.pass) {
      analysisBoard.pass();
    } else {
      analysisBoard.playAtForced(m.row, m.col, m.color);
      capBlack = analysisBoard.captures[BLACK];
      capWhite = analysisBoard.captures[WHITE];
    }
  }

  analysisBoard.readOnly = true;
  analysisBoard.render();

  document.getElementById("analysis-slider").value = index;
  document.getElementById("analysis-cap-black").textContent = capBlack;
  document.getElementById("analysis-cap-white").textContent = capWhite;

  document.getElementById("analysis-move-label").textContent =
    index === 0 ? "Move 0" : `Move ${index} of ${game.moves.length}`;

  let desc = "Starting position";
  if (index > 0) {
    const m = game.moves[index - 1];
    if (m.pass) {
      desc = `${COLOR_NAMES[m.color]} passed`;
    } else {
      const col = String.fromCharCode(65 + m.col);
      const row = game.size - m.row;
      desc = `${COLOR_NAMES[m.color]} played at ${col}${row}`;
      if (m.captures > 0) desc += ` — captured ${m.captures} stone(s)`;
    }
  }
  document.getElementById("analysis-move-desc").textContent = desc;

  document.querySelectorAll("#analysis-move-list li").forEach((li) => {
    li.classList.toggle("active", parseInt(li.dataset.index, 10) === index);
  });

  document.getElementById("analysis-prev").disabled = index === 0;
  document.getElementById("analysis-next").disabled = index >= game.moves.length;
}

document.getElementById("analysis-first").addEventListener("click", () => showAnalysisMove(0));
document.getElementById("analysis-prev").addEventListener("click", () => {
  if (analysisMoveIndex > 0) showAnalysisMove(analysisMoveIndex - 1);
});
document.getElementById("analysis-next").addEventListener("click", () => {
  if (selectedGame && analysisMoveIndex < selectedGame.moves.length) {
    showAnalysisMove(analysisMoveIndex + 1);
  }
});
document.getElementById("analysis-last").addEventListener("click", () => {
  if (selectedGame) showAnalysisMove(selectedGame.moves.length);
});
document.getElementById("analysis-slider").addEventListener("input", (e) => {
  showAnalysisMove(parseInt(e.target.value, 10));
});

document.getElementById("clear-games-btn").addEventListener("click", () => {
  if (confirm("Delete all saved games?")) {
    saveGames([]);
    selectedGame = null;
    refreshGameList();
  }
});

/* ===== Hero board ===== */
function initHeroBoard() {
  heroBoard = new GoBoard(document.getElementById("hero-board"), 9, {
    readOnly: true,
    mini: true,
  });
  heroBoard.setPosition([
    { row: 2, col: 2, color: BLACK },
    { row: 2, col: 6, color: WHITE },
    { row: 4, col: 4, color: BLACK },
    { row: 6, col: 2, color: WHITE },
    { row: 6, col: 6, color: BLACK },
    { row: 3, col: 4, color: WHITE },
    { row: 5, col: 3, color: BLACK },
    { row: 5, col: 5, color: WHITE },
  ]);
}

/* ===== Init ===== */
const puzzleFailures = validateAllPuzzles();
if (puzzleFailures.length) {
  console.error("Fix these puzzles before shipping:", puzzleFailures);
}

buildLessonList();
buildPuzzleList();
updateRatingDisplay();
initPlayBoard();
initHeroBoard();
loadLesson(0);
