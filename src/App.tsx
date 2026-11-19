/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BadgeDef,
  DailyCompletionRecord,
  GameMode,
  PersistedState,
  RoundResult,
  SeriesDef,
} from './types/game';
import {
  SERIES_CONFIG,
  buildChallengeSeries,
  buildCustomMixSeries,
  buildDailyShuffleSeries,
} from './config/seriesConfig';
import {
  getTodayDateString,
  makeDailySeed,
  makePracticeSeed,
} from './utils/prng';
import {
  loadPersistedState,
  recordRunCompletion,
  savePersistedState,
} from './utils/storage';
import {
  type ActiveChallengeContext,
  type ChallengePayload,
  buildChallengeUrl,
  parseChallengeFromUrl,
} from './utils/challenge';
import { soundEngine } from './utils/audio';
import { HubScreen } from './components/HubScreen';
import { GameRunner } from './components/GameRunner';
import { SummaryScreen } from './components/SummaryScreen';
import { CustomMixModal } from './components/CustomMixModal';
import { ChallengeLobby } from './components/ChallengeLobby';
import { ChallengeModal } from './components/ChallengeModal';
import { OfflineIndicator } from './components/OfflineIndicator';

type AppView = 'hub' | 'challenge-lobby' | 'playing' | 'summary';

interface ChallengeModalConfig {
  initialGameIds: string[];
  initialSeed: string;
  senderScores?: number[];
  seriesLabel?: string;
  allowLineupSelection: boolean;
  isCounterChallenge: boolean;
}

function clearChallengeUrlParam() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (url.searchParams.has('c')) {
    url.searchParams.delete('c');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }
}

export default function App() {
  const dateStr = useMemo(() => getTodayDateString(), []);

  const [persisted, setPersisted] = useState<PersistedState>(() => {
    const loaded = loadPersistedState();
    soundEngine.setMuted(loaded.muted);
    return loaded;
  });

  const [mode, setMode] = useState<GameMode>('daily');
  const [view, setView] = useState<AppView>('hub');
  const [activeSeries, setActiveSeries] = useState<SeriesDef | null>(null);
  const [activeSeed, setActiveSeed] = useState<string>('');
  const [summaryRounds, setSummaryRounds] = useState<RoundResult[]>([]);
  const [newBadges, setNewBadges] = useState<BadgeDef[]>([]);
  const [customMixOpen, setCustomMixOpen] = useState(false);

  const [incomingChallenge, setIncomingChallenge] =
    useState<ChallengePayload | null>(null);
  const [activeChallengeContext, setActiveChallengeContext] =
    useState<ActiveChallengeContext | null>(null);
  const [challengeModalConfig, setChallengeModalConfig] =
    useState<ChallengeModalConfig | null>(null);

  // Sync document.body.dataset.state for predictable state inspection
  useEffect(() => {
    if (view === 'hub' || view === 'challenge-lobby') {
      document.body.dataset.state = 'title';
    } else if (view === 'playing') {
      document.body.dataset.state = 'playing';
    } else {
      document.body.dataset.state = 'gameover';
    }
  }, [view]);

  // Sync Tailwind v4 dark class & PWA status bar theme-color meta tag
  useEffect(() => {
    const isDark = persisted.theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', isDark ? '#0B0F17' : '#FAFAFA');
    }
  }, [persisted.theme]);

  const startSeries = useCallback(
    (series: SeriesDef, overrideMode?: GameMode) => {
      const effectiveMode = overrideMode ?? mode;
      const seed =
        effectiveMode === 'daily'
          ? makeDailySeed(dateStr, series.id)
          : makePracticeSeed(series.id);

      // For Practice Daily Shuffle, also re-roll the 5-game lineup with the random seed
      const resolvedSeries =
        series.id === 'daily-shuffle' && effectiveMode === 'practice'
          ? buildDailyShuffleSeries(seed)
          : series;

      setActiveChallengeContext(null);
      setIncomingChallenge(null);
      setActiveSeries(resolvedSeries);
      setActiveSeed(seed);
      setSummaryRounds([]);
      setNewBadges([]);
      setView('playing');
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    },
    [dateStr, mode]
  );

  // Parse incoming ?c=... Challenge Link or ?autostart=1 on load
  useEffect(() => {
    const parsedChallenge = parseChallengeFromUrl(window.location.search);
    if (parsedChallenge) {
      setIncomingChallenge(parsedChallenge);
      setView('challenge-lobby');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startSeries(SERIES_CONFIG[0], 'daily');
    }
  }, [startSeries]);

  const handleToggleMute = useCallback(() => {
    setPersisted((prev) => {
      const nextMuted = !prev.muted;
      soundEngine.setMuted(nextMuted);
      const next = { ...prev, muted: nextMuted };
      savePersistedState(next);
      return next;
    });
  }, []);

  const handleToggleTheme = useCallback(() => {
    soundEngine.playTap();
    setPersisted((prev) => {
      const nextTheme: PersistedState['theme'] =
        prev.theme === 'dark' ? 'light' : 'dark';
      const next = { ...prev, theme: nextTheme };
      savePersistedState(next);
      return next;
    });
  }, []);

  const handleSavePlayerName = useCallback((name: string) => {
    setPersisted((prev) => {
      if (prev.playerName === name) return prev;
      const next = { ...prev, playerName: name };
      savePersistedState(next);
      return next;
    });
  }, []);

  const handleReturnToHub = useCallback(() => {
    clearChallengeUrlParam();
    setIncomingChallenge(null);
    setActiveChallengeContext(null);
    setChallengeModalConfig(null);
    setView('hub');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const handleStartIncomingChallenge = useCallback(
    (context: ActiveChallengeContext) => {
      const challengeSeries = buildChallengeSeries(
        context.playedGameIds,
        context.payload.challengerName
      );
      setActiveChallengeContext(context);
      setActiveSeries(challengeSeries);
      setActiveSeed(context.payload.seed);
      setSummaryRounds([]);
      setNewBadges([]);
      setView('playing');
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    },
    []
  );

  const handleFinishSeries = useCallback(
    (rounds: RoundResult[]) => {
      if (!activeSeries) return;
      const effectiveMode: GameMode =
        activeSeries.id === 'custom-mix' ||
        activeSeries.id === 'friend-challenge'
          ? 'practice'
          : mode;

      setPersisted((prev) => {
        const { nextState, newlyUnlockedBadges } = recordRunCompletion(prev, {
          seriesId: activeSeries.id,
          dateStr,
          mode: effectiveMode,
          rounds,
        });
        savePersistedState(nextState);
        setNewBadges(newlyUnlockedBadges);
        return nextState;
      });

      setSummaryRounds(rounds);
      setView('summary');
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    },
    [activeSeries, dateStr, mode]
  );

  const handleViewCompletedSummary = useCallback(
    (series: SeriesDef, record: DailyCompletionRecord) => {
      setActiveChallengeContext(null);
      setActiveSeries(series);
      setActiveSeed(makeDailySeed(record.date, series.id));
      setSummaryRounds(record.rounds);
      setNewBadges([]);
      setView('summary');
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    },
    []
  );

  const handleStartCustomMix = useCallback(
    (selectedGameIds: string[]) => {
      const mixSeries = buildCustomMixSeries(selectedGameIds);
      setCustomMixOpen(false);
      startSeries(mixSeries, 'practice');
    },
    [startSeries]
  );

  const handleOpenHubChallengeBuilder = useCallback(() => {
    setChallengeModalConfig({
      initialGameIds: SERIES_CONFIG[0].games.map((g) => g.id),
      initialSeed: makePracticeSeed(`challenge-${dateStr}`),
      seriesLabel: SERIES_CONFIG[0].title,
      allowLineupSelection: true,
      isCounterChallenge: false,
    });
  }, [dateStr]);

  const handleOpenSummaryChallengeModal = useCallback(() => {
    if (!activeSeries || summaryRounds.length !== 5) return;
    setChallengeModalConfig({
      initialGameIds: summaryRounds.map((r) => r.gameId),
      initialSeed: activeSeed || makePracticeSeed(activeSeries.id),
      senderScores: summaryRounds.map((r) => r.score),
      seriesLabel: activeChallengeContext
        ? 'Counter-Challenge'
        : activeSeries.title,
      allowLineupSelection: false,
      isCounterChallenge: Boolean(activeChallengeContext),
    });
  }, [activeSeries, summaryRounds, activeSeed, activeChallengeContext]);

  const handlePreviewChallenge = useCallback((payload: ChallengePayload) => {
    const url = buildChallengeUrl(payload);
    const parsedUrl = new URL(url);
    window.history.replaceState(
      {},
      '',
      parsedUrl.pathname + parsedUrl.search
    );
    setChallengeModalConfig(null);
    setActiveChallengeContext(null);
    setIncomingChallenge(payload);
    setView('challenge-lobby');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const nextSeries = useMemo(() => {
    if (!activeSeries) return null;
    const idx = SERIES_CONFIG.findIndex((s) => s.id === activeSeries.id);
    if (idx >= 0 && idx + 1 < SERIES_CONFIG.length) {
      return SERIES_CONFIG[idx + 1];
    }
    if (idx === SERIES_CONFIG.length - 1) {
      return buildDailyShuffleSeries(makeDailySeed(dateStr, 'daily-shuffle'));
    }
    return null;
  }, [activeSeries, dateStr]);

  let content = null;

  if (view === 'challenge-lobby' && incomingChallenge) {
    content = (
      <ChallengeLobby
        payload={incomingChallenge}
        onStartChallenge={handleStartIncomingChallenge}
        onBackToHub={handleReturnToHub}
      />
    );
  } else if (view === 'playing' && activeSeries) {
    content = (
      <GameRunner
        key={`${activeSeed}::${activeSeries.games.map((g) => g.id).join(',')}`}
        series={activeSeries}
        baseSeed={activeSeed}
        mode={
          activeSeries.id === 'custom-mix' ||
          activeSeries.id === 'friend-challenge'
            ? 'practice'
            : mode
        }
        muted={persisted.muted}
        theme={persisted.theme}
        onToggleMute={handleToggleMute}
        onToggleTheme={handleToggleTheme}
        onQuitToHub={handleReturnToHub}
        onFinishSeries={handleFinishSeries}
      />
    );
  } else if (view === 'summary' && activeSeries) {
    content = (
      <SummaryScreen
        series={activeSeries}
        rounds={summaryRounds}
        mode={
          activeSeries.id === 'custom-mix' ||
          activeSeries.id === 'friend-challenge'
            ? 'practice'
            : mode
        }
        dateStr={dateStr}
        nextSeries={nextSeries}
        newlyUnlockedBadges={newBadges}
        activeChallenge={activeChallengeContext}
        onOpenChallengeModal={handleOpenSummaryChallengeModal}
        onPlayNextSeries={(next) => startSeries(next)}
        onReplayPractice={() => startSeries(activeSeries, 'practice')}
        onBackToHub={handleReturnToHub}
      />
    );
  } else {
    content = (
      <HubScreen
        dateStr={dateStr}
        mode={mode}
        persisted={persisted}
        onModeChange={setMode}
        onToggleMute={handleToggleMute}
        onToggleTheme={handleToggleTheme}
        onStartSeries={(series) => startSeries(series)}
        onViewCompletedSummary={handleViewCompletedSummary}
        onOpenCustomMix={() => setCustomMixOpen(true)}
        onOpenChallengeBuilder={handleOpenHubChallengeBuilder}
      />
    );
  }

  return (
    <>
      {content}

      {customMixOpen && (
        <CustomMixModal
          onClose={() => setCustomMixOpen(false)}
          onStartMix={handleStartCustomMix}
        />
      )}

      {challengeModalConfig && (
        <ChallengeModal
          initialGameIds={challengeModalConfig.initialGameIds}
          initialSeed={challengeModalConfig.initialSeed}
          senderScores={challengeModalConfig.senderScores}
          seriesLabel={challengeModalConfig.seriesLabel}
          allowLineupSelection={challengeModalConfig.allowLineupSelection}
          isCounterChallenge={challengeModalConfig.isCounterChallenge}
          initialPlayerName={persisted.playerName}
          dateStr={dateStr}
          onSavePlayerName={handleSavePlayerName}
          onPreviewChallenge={handlePreviewChallenge}
          onClose={() => setChallengeModalConfig(null)}
        />
      )}

      <OfflineIndicator />
    </>
  );
}
