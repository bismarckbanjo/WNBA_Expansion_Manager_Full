// Pure structural validation for persisted/imported saves.
window.GAME_SCHEMA = Object.freeze({
  isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  },

  isValidPlayer(player, ratingKeys) {
    const record = window.GAME_SCHEMA.isRecord;
    return !!(
      record(player) &&
      typeof player.id === "string" &&
      player.id.length > 0 &&
      typeof player.name === "string" &&
      typeof player.pos === "string" &&
      typeof player.scouting === "string" &&
      typeof player.strengths === "string" &&
      typeof player.weaknesses === "string" &&
      Number.isFinite(player.salary) &&
      Number.isFinite(player.years) &&
      record(player.ratings) &&
      ratingKeys.every(
        (key) =>
          Number.isFinite(player.ratings[key]) &&
          player.ratings[key] >= 0 &&
          player.ratings[key] <= 100,
      )
    );
  },

  isValidTeam(team, ratingKeys) {
    const record = window.GAME_SCHEMA.isRecord;
    return !!(
      record(team) &&
      typeof team.id === "string" &&
      team.id.length > 0 &&
      typeof team.name === "string" &&
      typeof team.primary === "string" &&
      Array.isArray(team.players) &&
      team.players.every((player) => window.GAME_SCHEMA.isValidPlayer(player, ratingKeys))
    );
  },
});
