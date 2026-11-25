import type { RoundResult } from '../types/game';

export type ChallengeEditRule = 'lock' | 'swap1' | 'free';

export interface ChallengePayload {
  v: 1;
  seed: string;
  gameIds: string[];
  rule: ChallengeEditRule;
  challengerName: string;
  challengerScores?: number[];
  seriesLabel?: string;
}

export interface ActiveChallengeContext {
  payload: ChallengePayload;
  /** Indices (0..4) that the recipient swapped away from the challenger's original lineup */
  swappedIndices: number[];
  /** Final 5 game IDs the recipient chose to play */
  playedGameIds: string[];
}

export interface HeadToHeadRound {
  roundIndex: number;
  gameId: string;
  gameName: string;
  myScore: number;
  challengerScore: number | null;
  delta: number | null;
  status: 'win' | 'loss' | 'tie' | 'swapped' | 'open';
}

export interface HeadToHeadSummary {
  challengerName: string;
  hasChallengerScores: boolean;
  myOverallAvg: number;
  challengerOverallAvg: number | null;
  matchedCount: number;
  myMatchedAvg: number | null;
  challengerMatchedAvg: number | null;
  wins: number;
  losses: number;
  ties: number;
  verdict: 'win' | 'loss' | 'tie' | 'remixed' | 'open';
  rounds: HeadToHeadRound[];
}

/**
 * Compact 2-character codes keep challenge URLs short, readable, and resilient.
 */
export const GAME_ID_TO_CODE: Record<string, string> = {
  's1-angle-draw': 'a1',
  's1-line-split': 'a2',
  's1-flash-count': 'a3',
  's1-trajectory-drop': 'a4',
  's1-steady-beat': 'a5',
  's2-hue-memory': 'b1',
  's2-odd-tile-out': 'b2',
  's2-area-match': 'b3',
  's2-center-of-mass': 'b4',
  's2-alignment-level': 'b5',
  's3-blind-stopwatch': 'c1',
  's3-circle-fill': 'c2',
  's3-speed-match': 'c3',
  's3-grid-density': 'c4',
  's3-interval-bisect': 'c5',
};

const CODE_TO_GAME_ID: Record<string, string> = Object.fromEntries(
  Object.entries(GAME_ID_TO_CODE).map(([id, code]) => [code, id])
);

const RULE_TO_CODE: Record<ChallengeEditRule, string> = {
  lock: 'l',
  swap1: 's',
  free: 'f',
};

const CODE_TO_RULE: Record<string, ChallengeEditRule> = {
  l: 'lock',
  s: 'swap1',
  f: 'free',
};

export function getRuleCopy(rule: ChallengeEditRule): {
  label: string;
  shortLabel: string;
  senderDescription: string;
  recipientBanner: string;
} {
  switch (rule) {
    case 'lock':
      return {
        label: 'Exact 5 Games',
        shortLabel: 'Locked',
        senderDescription: 'Friend plays your exact 5 games head-to-head.',
        recipientBanner: 'Locked lineup: play these exact 5 games head-to-head.',
      };
    case 'swap1':
      return {
        label: 'Allow 1 Swap',
        shortLabel: '1 Swap Allowed',
        senderDescription: 'Friend can replace 1 of the 5 games with any test they choose.',
        recipientBanner: 'You can swap up to 1 game before starting, then send your remix back.',
      };
    case 'free':
      return {
        label: 'Edit Any / All 5',
        shortLabel: 'Full Remix Allowed',
        senderDescription: 'Friend can swap any game or replace the entire 5-game lineup.',
        recipientBanner: 'Full remix enabled: swap any game or replace the entire lineup.',
      };
  }
}

export function sanitizeChallengerName(name: string): string {
  const cleaned = name.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 24);
  return cleaned || 'A Friend';
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string | null {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (padded.length % 4)) % 4;
    const base64 = padded + '='.repeat(padLength);
    if (typeof atob === 'function') {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

interface WireChallenge {
  v: 1;
  s: string;
  g: string[];
  r: string;
  n: string;
  sc?: number[];
  l?: string;
}

export function encodeChallengePayload(payload: ChallengePayload): string {
  const codes = payload.gameIds
    .slice(0, 5)
    .map((id) => GAME_ID_TO_CODE[id] ?? id);

  const wire: WireChallenge = {
    v: 1,
    s: payload.seed.slice(0, 64),
    g: codes,
    r: RULE_TO_CODE[payload.rule] ?? 's',
    n: sanitizeChallengerName(payload.challengerName),
  };

  if (payload.challengerScores && payload.challengerScores.length === 5) {
    wire.sc = payload.challengerScores.map((s) =>
      Math.max(0, Math.min(100, Math.round(s)))
    );
  }

  if (payload.seriesLabel && payload.seriesLabel.trim()) {
    wire.l = payload.seriesLabel.trim().slice(0, 32);
  }

  return toBase64Url(JSON.stringify(wire));
}

export function decodeChallengePayload(token: string): ChallengePayload | null {
  if (!token || token.length > 1024) return null;
  const raw = fromBase64Url(token.trim());
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<WireChallenge>;
    if (!parsed || parsed.v !== 1) return null;
    if (typeof parsed.s !== 'string' || !parsed.s.trim()) return null;
    if (!Array.isArray(parsed.g) || parsed.g.length !== 5) return null;

    const gameIds = parsed.g.map((entry) => {
      if (typeof entry !== 'string') return '';
      if (CODE_TO_GAME_ID[entry]) return CODE_TO_GAME_ID[entry];
      if (GAME_ID_TO_CODE[entry]) return entry;
      return '';
    });

    // Must be 5 valid, distinct game IDs
    if (gameIds.some((id) => !id)) return null;
    if (new Set(gameIds).size !== 5) return null;

    const rule: ChallengeEditRule =
      typeof parsed.r === 'string' && CODE_TO_RULE[parsed.r]
        ? CODE_TO_RULE[parsed.r]
        : 'swap1';

    let challengerScores: number[] | undefined;
    if (Array.isArray(parsed.sc) && parsed.sc.length === 5) {
      const valid = parsed.sc.every(
        (n) => typeof n === 'number' && Number.isFinite(n)
      );
      if (valid) {
        challengerScores = parsed.sc.map((n) =>
          Math.max(0, Math.min(100, Math.round(n)))
        );
      }
    }

    return {
      v: 1,
      seed: parsed.s.trim().slice(0, 64),
      gameIds,
      rule,
      challengerName: sanitizeChallengerName(
        typeof parsed.n === 'string' ? parsed.n : 'A Friend'
      ),
      challengerScores,
      seriesLabel:
        typeof parsed.l === 'string' && parsed.l.trim()
          ? parsed.l.trim().slice(0, 32)
          : undefined,
    };
  } catch {
    return null;
  }
}

export function buildChallengeUrl(
  payload: ChallengePayload,
  baseUrl?: string
): string {
  const token = encodeChallengePayload(payload);
  const originAndPath =
    baseUrl ??
    (typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://gamez.app/');
  const cleanBase = originAndPath.split('?')[0].split('#')[0];
  return `${cleanBase}?c=${token}`;
}

export function parseChallengeFromUrl(
  urlOrSearch: string
): ChallengePayload | null {
  try {
    let token: string | null = null;
    if (urlOrSearch.includes('://')) {
      const u = new URL(urlOrSearch);
      token = u.searchParams.get('c');
    } else {
      const search = urlOrSearch.startsWith('?')
        ? urlOrSearch
        : `?${urlOrSearch}`;
      const params = new URLSearchParams(search);
      token = params.get('c');
    }
    if (!token) return null;
    return decodeChallengePayload(token);
  } catch {
    return null;
  }
}

export function computeHeadToHead(
  myRounds: RoundResult[],
  context: ActiveChallengeContext
): HeadToHeadSummary {
  const { payload, swappedIndices } = context;
  const swappedSet = new Set(swappedIndices);
  const hasChallengerScores = Boolean(
    payload.challengerScores && payload.challengerScores.length === 5
  );

  const myOverallAvg =
    myRounds.length > 0
      ? Math.round(
          myRounds.reduce((acc, r) => acc + r.score, 0) / myRounds.length
        )
      : 0;

  const challengerOverallAvg =
    hasChallengerScores && payload.challengerScores
      ? Math.round(
          payload.challengerScores.reduce((acc, s) => acc + s, 0) / 5
        )
      : null;

  let wins = 0;
  let losses = 0;
  let ties = 0;
  let myMatchedSum = 0;
  let challengerMatchedSum = 0;
  let matchedCount = 0;

  const rounds: HeadToHeadRound[] = myRounds.map((round, idx) => {
    const isSwapped =
      swappedSet.has(idx) || round.gameId !== payload.gameIds[idx];

    if (isSwapped) {
      return {
        roundIndex: idx,
        gameId: round.gameId,
        gameName: round.gameName,
        myScore: round.score,
        challengerScore: null,
        delta: null,
        status: 'swapped',
      };
    }

    if (!hasChallengerScores || !payload.challengerScores) {
      return {
        roundIndex: idx,
        gameId: round.gameId,
        gameName: round.gameName,
        myScore: round.score,
        challengerScore: null,
        delta: null,
        status: 'open',
      };
    }

    const cScore = payload.challengerScores[idx];
    const delta = round.score - cScore;
    matchedCount += 1;
    myMatchedSum += round.score;
    challengerMatchedSum += cScore;

    let status: HeadToHeadRound['status'] = 'tie';
    if (delta > 0) {
      status = 'win';
      wins += 1;
    } else if (delta < 0) {
      status = 'loss';
      losses += 1;
    } else {
      ties += 1;
    }

    return {
      roundIndex: idx,
      gameId: round.gameId,
      gameName: round.gameName,
      myScore: round.score,
      challengerScore: cScore,
      delta,
      status,
    };
  });

  const myMatchedAvg =
    matchedCount > 0 ? Math.round(myMatchedSum / matchedCount) : null;
  const challengerMatchedAvg =
    matchedCount > 0 ? Math.round(challengerMatchedSum / matchedCount) : null;

  let verdict: HeadToHeadSummary['verdict'] = 'open';
  if (!hasChallengerScores) {
    verdict = 'open';
  } else if (matchedCount === 0) {
    verdict = 'remixed';
  } else if (myMatchedAvg !== null && challengerMatchedAvg !== null) {
    if (myMatchedAvg > challengerMatchedAvg) verdict = 'win';
    else if (myMatchedAvg < challengerMatchedAvg) verdict = 'loss';
    else verdict = 'tie';
  }

  return {
    challengerName: payload.challengerName,
    hasChallengerScores,
    myOverallAvg,
    challengerOverallAvg,
    matchedCount,
    myMatchedAvg,
    challengerMatchedAvg,
    wins,
    losses,
    ties,
    verdict,
    rounds,
  };
}
