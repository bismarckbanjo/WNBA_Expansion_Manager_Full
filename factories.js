// Deterministic data factories used by data.js. Keeping these separate makes
// the large roster file literal-only and prevents player data changing on load.
function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function stableMood(name, teamId) {
  const value = slug(`${name}-${teamId}`);
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return 55 + (Math.abs(hash) % 30);
}

function team(id, name, primary, secondary, status, players) {
  return { id, name, primary, secondary, status, players };
}

function p(
  name,
  pos,
  teamId,
  salary,
  years,
  scouting,
  strengths,
  weaknesses,
  protectedPlayer,
  scoring,
  shooting,
  playmaking,
  defense,
  rebounding,
  athleticism,
  iq,
  potential,
  archetype,
) {
  return {
    id: slug(`${name}-${teamId}`),
    name,
    pos,
    team: teamId,
    salary,
    years,
    scouting,
    strengths,
    weaknesses,
    protected: protectedPlayer,
    ratings: {
      scoring,
      shooting,
      playmaking,
      defense,
      rebounding,
      athleticism,
      iq,
      potential,
    },
    archetype,
    mood: stableMood(name, teamId),
    injury: null,
  };
}

// Reference the cross-script globals so static analysis understands that these
// factories are intentionally consumed by data.js.
window.GAME_FACTORIES = { team, p, slug };
