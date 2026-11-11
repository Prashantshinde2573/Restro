// Ludo rules, no screen code. Board is the usual 15 × 15 grid.
//
// A token is -1 in its yard, 0–50 on the shared track (counted from its own
// start square), 51–55 in its home lane, 56 when it is home.
// Rules: a 6 brings a token out; exact roll to finish; landing on a rival
// (not on a safe square) sends it back; a 6, a capture or a token reaching
// home gives another roll; three 6s in a row lose the turn.

export type Color = "red" | "green" | "yellow" | "blue";
export const COLORS: Color[] = ["red", "green", "yellow", "blue"];
export type Cell = [row: number, col: number];

/** The 52 shared squares, clockwise, starting at red's start square. */
export const TRACK: Cell[] = (() => {
  const t: Cell[] = [];
  for (let c = 1; c <= 5; c++) t.push([6, c]);
  for (let r = 5; r >= 0; r--) t.push([r, 6]);
  t.push([0, 7]);
  for (let r = 0; r <= 5; r++) t.push([r, 8]);
  for (let c = 9; c <= 14; c++) t.push([6, c]);
  t.push([7, 14]);
  for (let c = 14; c >= 9; c--) t.push([8, c]);
  for (let r = 9; r <= 14; r++) t.push([r, 8]);
  t.push([14, 7]);
  for (let r = 14; r >= 9; r--) t.push([r, 6]);
  for (let c = 5; c >= 0; c--) t.push([8, c]);
  t.push([7, 0]);
  t.push([6, 0]);
  return t;
})();

export const START: Record<Color, number> = { red: 0, green: 13, yellow: 26, blue: 39 };
/** Safe squares: every start square and the star 8 squares after it. */
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export const HOME_LANE: Record<Color, Cell[]> = {
  red: [1, 2, 3, 4, 5].map((c) => [7, c] as Cell),
  green: [1, 2, 3, 4, 5].map((r) => [r, 7] as Cell),
  yellow: [13, 12, 11, 10, 9].map((c) => [7, c] as Cell),
  blue: [13, 12, 11, 10, 9].map((r) => [r, 7] as Cell),
};
/** Where the four tokens wait in the yard. */
export const YARD: Record<Color, Cell[]> = {
  red: [[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]],
  green: [[1.5, 10.5], [1.5, 12.5], [3.5, 10.5], [3.5, 12.5]],
  yellow: [[10.5, 10.5], [10.5, 12.5], [12.5, 10.5], [12.5, 12.5]],
  blue: [[10.5, 1.5], [10.5, 3.5], [12.5, 1.5], [12.5, 3.5]],
};
export const FINISH = 56;

export interface LudoState {
  players: Color[];
  tokens: Record<Color, number[]>;
  turn: number; // index into players
  dice: number | null; // rolled and waiting for a move
  sixes: number; // 6s in a row this turn
  winners: Color[]; // in finishing order
  last?: string; // what just happened (for the screen)
}

/** 2 players sit opposite each other; 3 and 4 go round the board. */
export function newGame(count: 2 | 3 | 4): LudoState {
  const players: Color[] = count === 2 ? ["red", "yellow"] : count === 3 ? ["red", "green", "yellow"] : ["red", "green", "yellow", "blue"];
  return { players, tokens: { red: [-1, -1, -1, -1], green: [-1, -1, -1, -1], yellow: [-1, -1, -1, -1], blue: [-1, -1, -1, -1] }, turn: 0, dice: null, sixes: 0, winners: [] };
}

export const trackIndex = (color: Color, p: number) => (START[color] + p) % 52;

/** Where a token is drawn. */
export function cellOf(color: Color, p: number, i: number): Cell {
  if (p < 0) return YARD[color][i];
  if (p <= 50) return TRACK[trackIndex(color, p)];
  if (p < FINISH) return HOME_LANE[color][p - 51];
  return [7, 7];
}

export const current = (s: LudoState) => s.players[s.turn];

/** Which of the current player's tokens can move with this roll. */
export function movable(s: LudoState, roll = s.dice): number[] {
  if (roll == null) return [];
  const me = current(s);
  return s.tokens[me]
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => (p < 0 ? roll === 6 : p < FINISH && p + roll <= FINISH))
    .map(({ i }) => i);
}

const done = (s: LudoState, c: Color) => s.tokens[c].every((p) => p === FINISH);

function nextTurn(s: LudoState): LudoState {
  const alive = s.players.filter((c) => !s.winners.includes(c));
  if (alive.length <= 1) return { ...s, dice: null, sixes: 0 };
  let t = s.turn;
  do t = (t + 1) % s.players.length;
  while (s.winners.includes(s.players[t]));
  return { ...s, turn: t, dice: null, sixes: 0 };
}

export const gameOver = (s: LudoState) => s.players.length - s.winners.length <= 1;

/** Roll the dice. If nothing can move (or it's a third 6), the turn passes. */
export function roll(s: LudoState, value: number): LudoState {
  if (s.dice != null || gameOver(s)) return s;
  const sixes = value === 6 ? s.sixes + 1 : 0;
  if (sixes === 3) return { ...nextTurn(s), last: "three-sixes" };
  const r = { ...s, dice: value, sixes };
  if (!movable(r).length) return { ...nextTurn(r), last: "no-move" };
  return { ...r, last: undefined };
}

/** Move one token with the rolled value. */
export function move(s: LudoState, token: number): LudoState {
  const roll = s.dice;
  if (roll == null || !movable(s).includes(token)) return s;
  const me = current(s);
  const tokens = { ...s.tokens, [me]: [...s.tokens[me]] } as Record<Color, number[]>;
  const from = tokens[me][token];
  const to = from < 0 ? 0 : from + roll;
  tokens[me][token] = to;
  let captured = false;
  if (to <= 50) {
    const at = trackIndex(me, to);
    if (!SAFE.has(at)) {
      for (const c of s.players) {
        if (c === me) continue;
        tokens[c] = tokens[c].map((p) => {
          if (p >= 0 && p <= 50 && trackIndex(c, p) === at) {
            captured = true;
            return -1;
          }
          return p;
        });
      }
    }
  }
  let next: LudoState = { ...s, tokens, dice: null };
  const finished = to === FINISH;
  if (done(next, me) && !next.winners.includes(me)) next = { ...next, winners: [...next.winners, me] };
  // last one standing gets the final place
  if (gameOver(next)) {
    const left = next.players.find((c) => !next.winners.includes(c));
    return { ...next, winners: left ? [...next.winners, left] : next.winners, last: "over" };
  }
  const again = (roll === 6 || captured || finished) && !next.winners.includes(me);
  if (again) return { ...next, last: captured ? "capture" : finished ? "home" : "six" };
  return { ...nextTurn(next), last: captured ? "capture" : undefined };
}
