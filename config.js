// Versioned simulation knobs. Saves record the version so future migrations can
// explain balance changes without scattering magic numbers through the engine.
window.GAME_BALANCE = Object.freeze({
  version: 1,
  compositeWeights: Object.freeze({
    scoring: 0.19,
    shooting: 0.14,
    playmaking: 0.14,
    defense: 0.18,
    rebounding: 0.12,
    athleticism: 0.09,
    iq: 0.09,
    potential: 0.05,
  }),
  teamOverallWeights: Object.freeze({ offense: 0.45, defense: 0.4, rebounding: 0.15 }),
  rotationWeights: Object.freeze([2, 1.5, 1.2, 1, 0.8, 0.5, 0.4, 0.3]),
  statShareWeights: Object.freeze([1, 0.82, 0.66, 0.5, 0.4, 0.3, 0.22, 0.16]),
  homeAdvantage: 2.2,
  injuryRate: 0.022,
  moodScoreScale: 0.04,
  tradeDeadlineWeek: 12,
  undoLimit: 5,
  trade: Object.freeze({
    minimumRatio: 0.92,
    goodRatio: 1,
    strongRatio: 1.15,
    protectedRatio: 1.25,
    pickRound1: 420,
    pickRound2: 160,
    pickYearBonus: 20,
  }),
});
