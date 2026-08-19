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

function stableAge(name, teamId) {
  const value = slug(`${name}-${teamId}-age`);
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return 22 + (Math.abs(hash) % 13);
}

const PUBLIC_PERSONAS = [
  "gym-rat",
  "media-darling",
  "vocal-leader",
  "quiet-pro",
  "locker-glue",
  "flashy",
  "competitor",
  "mentor",
  "sponge",
];
const HIDDEN_TRAITS = [
  "drama-prone",
  "fragile-ego",
  "instigator",
  "selfish",
  "loyal",
  "thick-skin",
];

function stableHash(value) {
  const key = slug(value);
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function assignPersonality(name, teamId, age) {
  const years = Number.isFinite(age) ? age : 26;
  const pubHash = stableHash(`${name}-${teamId}-persona`);
  let persona = PUBLIC_PERSONAS[pubHash % PUBLIC_PERSONAS.length];
  if (years >= 30 && pubHash % 3 === 0) persona = "mentor";
  if (years <= 23 && pubHash % 3 === 1) persona = "sponge";
  const hidHash = stableHash(`${name}-${teamId}-hidden`);
  const hiddenTrait = hidHash % 100 < 28 ? null : HIDDEN_TRAITS[hidHash % HIDDEN_TRAITS.length];
  return { persona, hiddenTrait, traitRevealed: false };
}

function ensurePersonality(player) {
  if (!player || typeof player !== "object") return player;
  if (!player.persona || player.hiddenTrait === undefined || player.traitRevealed === undefined) {
    const assigned = assignPersonality(player.name || "player", player.team || "FA", player.age);
    if (!player.persona) player.persona = assigned.persona;
    if (player.hiddenTrait === undefined) player.hiddenTrait = assigned.hiddenTrait;
    if (player.traitRevealed === undefined) player.traitRevealed = false;
  }
  return player;
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
    age: stableAge(name, teamId),
    injury: null,
    ...assignPersonality(name, teamId, stableAge(name, teamId)),
  };
}

// Reference the cross-script globals so static analysis understands that these
// factories are intentionally consumed by data.js.
window.GAME_FACTORIES = {
  team,
  p,
  slug,
  stableMood,
  stableAge,
  assignPersonality,
  ensurePersonality,
};
