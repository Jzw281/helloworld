/* ===== Go Board Engine ===== */
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

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
    this.render();
  }

  createEmptyGrid() {
    return Array.from({ length: this.size }, () =>
      Array(this.size).fill(EMPTY)
    );
  }

  render() {
    this.container.innerHTML = "";
    this.container.classList.add("go-board");
    if (this.options.mini) this.container.classList.add("mini");

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
        cell.dataset.row = r;
        cell.dataset.col = c;

        const stone = this.grid[r][c];
        if (stone !== EMPTY) {
          cell.classList.add("occupied");
          const stoneEl = document.createElement("div");
          stoneEl.className = `stone ${stone === BLACK ? "black" : "white"}`;
          if (this.lastMove && this.lastMove[0] === r && this.lastMove[1] === c) {
            stoneEl.classList.add("last-move");
          }
          cell.appendChild(stoneEl);
        }

        if (!this.readOnly) {
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
    const points = this.getStarPoints();
    const pct = (i) => `${(i / (this.size - 1)) * 100}%`;
    points.forEach(([r, c]) => {
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

  handleClick(row, col) {
    if (this.readOnly) return;
    if (this.grid[row][col] !== EMPTY) return;
    if (this.allowedColor && this.currentPlayer !== this.allowedColor) return;

    const result = this.tryPlay(row, col, this.currentPlayer);
    if (!result.ok) return;

    this.moveCount++;
    this.lastMove = [row, col];
    this.currentPlayer = this.currentPlayer === BLACK ? WHITE : BLACK;
    this.render();

    if (this.onMove) {
      this.onMove({ row, col, color: result.color, captures: result.captures });
    }
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
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    return dirs
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

  setPosition(stones, nextPlayer = BLACK) {
    this.grid = this.createEmptyGrid();
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
    this.render();
  }
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
        text: "Black always plays first. One player takes black stones, the other white. On this site we use a 9×9 board — perfect for learning the fundamentals.",
        stones: [{ row: 4, col: 4, color: BLACK }],
      },
    ],
  },
  {
    id: 2,
    title: "Connecting Stones",
    steps: [
      {
        text: "Stones of the same color that touch horizontally or vertically (not diagonally) form a connected group. They share the same fate — if one is captured, all are captured.",
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
        text: "A liberty is an empty point directly adjacent to a stone or group (up, down, left, or right). This lone white stone has only one liberty — the point marked by the empty intersection next to it.",
        stones: [
          { row: 4, col: 4, color: WHITE },
          { row: 3, col: 4, color: BLACK },
          { row: 4, col: 3, color: BLACK },
          { row: 5, col: 4, color: BLACK },
        ],
      },
      {
        text: "When black plays at the last liberty, the white stone is captured and removed from the board. A group with zero liberties is always removed.",
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
        text: "An eye is an empty point completely surrounded by stones of one color. Groups need two separate eyes to be alive (uncapturable). A group with only one eye can eventually be captured.",
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
        text: "Two eyes means the opponent can never fill both at once. This black group has two eyes at the center — it is alive and can never be captured.",
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
          { row: 3, col: 4, color: BLACK },
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
        text: "The goal of Go is to control more territory than your opponent. Territory is the empty space you surround with your stones. At the end, both players pass and count their points.",
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
        text: "Captured stones also count as points. In area scoring (used here), each empty intersection in your territory plus each prisoner equals one point. Ready to play? Head to the Play tab!",
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
];

/* ===== Puzzles ===== */
const PUZZLES = [
  {
    id: 0,
    title: "Capture the stone",
    difficulty: "Beginner",
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
    desc: "Two white stones are in atari with only one shared liberty. Where does black play to capture both?",
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
    difficulty: "Intermediate",
    desc: "Two white stones are almost surrounded. Find the move that captures both.",
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
];

/* ===== App State ===== */
let currentLesson = 0;
let currentStep = 0;
let currentPuzzle = 0;
let lessonProgress = JSON.parse(localStorage.getItem("goLessonProgress") || "{}");

let lessonBoard;
let playBoard;
let puzzleBoard;
let heroBoard;

/* ===== Navigation ===== */
function showView(viewId) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById(`view-${viewId}`).classList.add("active");

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === viewId);
  });

  if (viewId === "learn") loadLesson(currentLesson);
  if (viewId === "puzzles") loadPuzzle(currentPuzzle);
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
    btn.dataset.lesson = i;
    if (lessonProgress[i]) btn.classList.add("completed");
    if (i === currentLesson) btn.classList.add("active");
    btn.addEventListener("click", () => {
      currentLesson = i;
      currentStep = 0;
      loadLesson(i);
      updateLessonListActive();
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
    const el = document.getElementById("lesson-board");
    lessonBoard = new GoBoard(el, 9, { readOnly: true });
  }
  lessonBoard.setPosition(step.stones);
  updateLessonListActive();
}

function markLessonComplete(index) {
  lessonProgress[index] = true;
  localStorage.setItem("goLessonProgress", JSON.stringify(lessonProgress));
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
    markLessonComplete(currentLesson);
    if (currentLesson < LESSONS.length - 1) {
      currentLesson++;
      currentStep = 0;
      loadLesson(currentLesson);
    }
  }
});

/* ===== Play Mode ===== */
function updatePlayUI() {
  const isBlack = playBoard.currentPlayer === BLACK;
  document.getElementById("current-player-label").textContent =
    isBlack ? "Black to play" : "White to play";
  const preview = document.getElementById("current-player-stone");
  preview.className = `stone-preview ${isBlack ? "black" : "white"}`;
  document.getElementById("captures-black").textContent = playBoard.captures[BLACK];
  document.getElementById("captures-white").textContent = playBoard.captures[WHITE];
  document.getElementById("move-count").textContent = playBoard.moveCount;
}

function initPlayBoard() {
  const el = document.getElementById("play-board");
  playBoard = new GoBoard(el, 9, {
    onMove: () => updatePlayUI(),
  });
  updatePlayUI();
}

document.getElementById("pass-btn").addEventListener("click", () => {
  playBoard.currentPlayer = playBoard.currentPlayer === BLACK ? WHITE : BLACK;
  playBoard.lastMove = null;
  playBoard.render();
  updatePlayUI();
});

document.getElementById("reset-btn").addEventListener("click", () => {
  playBoard.reset();
  updatePlayUI();
});

/* ===== Puzzles ===== */
function buildPuzzleList() {
  const list = document.getElementById("puzzle-list");
  list.innerHTML = "";
  PUZZLES.forEach((puzzle, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = puzzle.title;
    if (i === currentPuzzle) btn.classList.add("active");
    btn.addEventListener("click", () => {
      currentPuzzle = i;
      loadPuzzle(i);
      document.querySelectorAll("#puzzle-list button").forEach((b, j) => {
        b.classList.toggle("active", j === i);
      });
    });
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function loadPuzzle(index) {
  const puzzle = PUZZLES[index];
  document.getElementById("puzzle-difficulty").textContent = puzzle.difficulty;
  document.getElementById("puzzle-title").textContent = puzzle.title;
  document.getElementById("puzzle-desc").textContent = puzzle.desc;

  const feedback = document.getElementById("puzzle-feedback");
  feedback.textContent = "Find the correct move.";
  feedback.className = "puzzle-feedback";

  if (!puzzleBoard) {
    const el = document.getElementById("puzzle-board");
    puzzleBoard = new GoBoard(el, 9, {
      allowedColor: BLACK,
      onMove: (move) => checkPuzzleMove(move),
    });
  }

  puzzleBoard.reset();
  puzzleBoard.setPosition(puzzle.stones, puzzle.player);
  puzzleBoard.allowedColor = puzzle.player;
  puzzleBoard.currentPlayer = puzzle.player;
  puzzleBoard._activePuzzle = index;
}

function checkPuzzleMove(move) {
  const puzzle = PUZZLES[puzzleBoard._activePuzzle];
  const feedback = document.getElementById("puzzle-feedback");
  const correct =
    move.row === puzzle.solution.row && move.col === puzzle.solution.col;

  if (correct) {
    feedback.textContent = "Correct! Well played.";
    feedback.className = "puzzle-feedback success";
    puzzleBoard.readOnly = true;
  } else {
    feedback.textContent = "Not quite — try again. Reset to start over.";
    feedback.className = "puzzle-feedback error";
    setTimeout(() => loadPuzzle(puzzleBoard._activePuzzle), 600);
  }
}

document.getElementById("puzzle-hint").addEventListener("click", () => {
  const puzzle = PUZZLES[currentPuzzle];
  document.getElementById("puzzle-feedback").textContent = `Hint: ${puzzle.hint}`;
});

document.getElementById("puzzle-reset").addEventListener("click", () => {
  puzzleBoard.readOnly = false;
  loadPuzzle(currentPuzzle);
});

/* ===== Hero decorative board ===== */
function initHeroBoard() {
  const el = document.getElementById("hero-board");
  heroBoard = new GoBoard(el, 9, { readOnly: true, mini: true });
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
buildLessonList();
buildPuzzleList();
initPlayBoard();
initHeroBoard();
loadLesson(0);
