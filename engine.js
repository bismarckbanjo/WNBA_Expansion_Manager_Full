// Pure simulation helpers. These functions do not read or mutate application
// state, which makes their results deterministic and independently testable.
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function playerTraitKeys(player) {
  const keys = [];
  if (player && player.persona) keys.push(player.persona);
  if (player && player.hiddenTrait) keys.push(player.hiddenTrait);
  return keys;
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

window.GAME_ENGINE = Object.freeze({
  compositeRating(player, ratingKeys, weights, chemistryMult) {
    const base = ratingKeys.reduce((total, key) => total + player.ratings[key] * weights[key], 0);
    const mult = Number.isFinite(chemistryMult) ? chemistryMult : 1;
    return Math.round(base * mult);
  },

  nextRandom(state) {
    const nextState = (state + 0x6d2b79f5) | 0;
    let value = nextState;
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return {
      state: nextState,
      value: ((value ^ (value >>> 14)) >>> 0) / 4294967296,
    };
  },

  allocateIntegerTotal(weights, total) {
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    const raw = weights.map((weight) => (weight / weightTotal) * total);
    const values = raw.map(Math.floor);
    let remaining = total - values.reduce((sum, value) => sum + value, 0);
    const order = raw
      .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
      .sort((a, b) => b.fraction - a.fraction);
    for (let i = 0; i < remaining && order.length; i++) values[order[i % order.length].index] += 1;
    return values;
  },

  tensionReport(players, rules) {
    const roster = Array.isArray(players) ? players.filter(Boolean) : [];
    const conflicts = (rules && rules.conflicts) || [];
    const synergies = (rules && rules.synergies) || [];
    const conflictSet = new Set(conflicts.map((pair) => pairKey(pair[0], pair[1])));
    const foundConflicts = [];
    const foundSynergies = [];
    let tension = 0;
    for (let i = 0; i < roster.length; i++) {
      const aKeys = playerTraitKeys(roster[i]);
      for (let j = i + 1; j < roster.length; j++) {
        const bKeys = playerTraitKeys(roster[j]);
        aKeys.forEach((aTrait) => {
          bKeys.forEach((bTrait) => {
            if (conflictSet.has(pairKey(aTrait, bTrait))) {
              tension += 10;
              foundConflicts.push({
                a: roster[i].name,
                b: roster[j].name,
                aId: roster[i].id,
                bId: roster[j].id,
                traits: [aTrait, bTrait],
              });
            }
            synergies.forEach((syn) => {
              const match =
                (syn.a === aTrait && syn.b === bTrait) || (syn.a === bTrait && syn.b === aTrait);
              if (!match) return;
              tension -= 7;
              foundSynergies.push({
                a: roster[i].name,
                b: roster[j].name,
                aId: roster[i].id,
                bId: roster[j].id,
                type: syn.type || "play",
                traits: [aTrait, bTrait],
              });
            });
          });
        });
      }
    }
    return {
      tension: clamp(tension, 0, 100),
      conflicts: foundConflicts,
      synergies: foundSynergies,
    };
  },

  chemistryMultiplier(tension, opts) {
    const options = opts || {};
    const scale = Number.isFinite(options.scale) ? options.scale : 0.0012;
    const factor = Number.isFinite(options.disciplinarianFactor)
      ? options.disciplinarianFactor
      : 0.4;
    let heat = Number.isFinite(tension) ? tension : 0;
    if (options.suppressed) heat *= 0.55;
    let penalty = heat * scale;
    if (options.disciplinarian) penalty *= factor;
    return clamp(1 - penalty, 0.82, 1);
  },

  statShareFactor(player, tension, opts) {
    const options = opts || {};
    const freezeAt = Number.isFinite(options.freezeTension) ? options.freezeTension : 40;
    const freezeFactor = Number.isFinite(options.freezeFactor) ? options.freezeFactor : 0.62;
    const troublemakers = options.troublemakers || [
      "drama-prone",
      "fragile-ego",
      "selfish",
      "instigator",
    ];
    if (!player || !Number.isFinite(tension) || tension < freezeAt) return 1;
    if (!troublemakers.includes(player.hiddenTrait)) return 1;
    const extra = clamp((tension - freezeAt) / 60, 0, 1);
    return clamp(1 - extra * (1 - freezeFactor), freezeFactor, 1);
  },

  mentorDevBonus(players, year, rules) {
    const roster = Array.isArray(players) ? players.filter(Boolean) : [];
    const bonus = {};
    const mentorIds = new Set((rules && rules.mentorPersonas) || ["mentor"]);
    const spongeIds = new Set((rules && rules.receptivePersonas) || ["sponge", "gym-rat"]);
    const mentors = roster.filter(
      (player) =>
        mentorIds.has(player.persona) || (player.age >= 30 && player.persona === "vocal-leader"),
    );
    if (!mentors.length) return bonus;
    roster.forEach((player) => {
      if (mentors.some((mentor) => mentor.id === player.id)) return;
      const young = player.age <= 23 || player.rookieYear === year;
      if (!young || !spongeIds.has(player.persona)) return;
      bonus[player.id] = 0.4;
    });
    return bonus;
  },

  shouldRevealHidden(hiddenTrait, revealed, tension, roll, revealBase) {
    if (!hiddenTrait || revealed) return false;
    const chance = (Number.isFinite(revealBase) ? revealBase : 0.07) + (tension || 0) / 500;
    return roll < chance;
  },

  shouldBlowup(tension, roll, blowupTension, blowupChance) {
    return (
      (tension || 0) >= (Number.isFinite(blowupTension) ? blowupTension : 45) &&
      roll < (Number.isFinite(blowupChance) ? blowupChance : 0.14)
    );
  },

  pairKey,

  pairingStatus(starts, pairAt, pactAt) {
    const shared = Number(starts) || 0;
    const pair = Number.isFinite(pairAt) ? pairAt : 6;
    const pact = Number.isFinite(pactAt) ? pactAt : 12;
    if (shared >= pact) return "pact";
    if (shared >= pair) return "paired";
    return "forming";
  },

  sitBondDelta(player) {
    if (player && player.hiddenTrait === "loyal") return -1;
    if (player && player.persona === "competitor") return -5;
    return -3;
  },

  startBondDelta() {
    return 2;
  },

  captainApproval(nominee, roster, rules) {
    if (!nominee || !Array.isArray(roster) || !roster.length) return 0;
    const conflicts = (rules && rules.conflicts) || [];
    const conflictSet = new Set(conflicts.map((pair) => pairKey(pair[0], pair[1])));
    const nomKeys = playerTraitKeys(nominee);
    let yes = 0;
    roster.forEach((player) => {
      if (player.id === nominee.id) {
        yes += 1;
        return;
      }
      const keys = playerTraitKeys(player);
      const clashes = keys.some((aTrait) =>
        nomKeys.some((bTrait) => conflictSet.has(pairKey(aTrait, bTrait))),
      );
      if (clashes) return;
      if ((player.bond || 50) >= 40) yes += 1;
      else if (player.persona === "locker-glue" || player.hiddenTrait === "loyal") yes += 1;
      else if (player.persona === nominee.persona) yes += 1;
    });
    return yes / roster.length;
  },

  cultureFlags(top8, tension, starId) {
    const rotation = Array.isArray(top8) ? top8.filter(Boolean) : [];
    const competitors = rotation.filter((player) => player.persona === "competitor").length;
    const hasMentor = rotation.some((player) => player.persona === "mentor");
    const hasSponge = rotation.some(
      (player) => player.persona === "sponge" || player.persona === "gym-rat",
    );
    return {
      grit: competitors >= 3,
      lab: hasMentor && hasSponge,
      star: !!starId && rotation.some((player) => player.id === starId),
      calm: (tension || 0) < 25,
    };
  },

  pairingTensionRelief(top8Ids, pairings, knobs) {
    const ids = new Set(Array.isArray(top8Ids) ? top8Ids : []);
    const room = pairings && typeof pairings === "object" ? pairings : {};
    const pairAt = knobs && Number.isFinite(knobs.pairStarts) ? knobs.pairStarts : 6;
    const pactAt = knobs && Number.isFinite(knobs.pactStarts) ? knobs.pactStarts : 12;
    const pairRelief = knobs && Number.isFinite(knobs.pairingTension) ? knobs.pairingTension : 5;
    const pactRelief = knobs && Number.isFinite(knobs.pactTension) ? knobs.pactTension : 10;
    let relief = 0;
    Object.keys(room).forEach((key) => {
      const [a, b] = key.split("|");
      if (!ids.has(a) || !ids.has(b)) return;
      const status = window.GAME_ENGINE.pairingStatus(
        room[key] && room[key].starts,
        pairAt,
        pactAt,
      );
      if (status === "pact") relief += pactRelief;
      else if (status === "paired") relief += pairRelief;
    });
    return relief;
  },

  harvestOutcome(player, ctx) {
    const context = ctx || {};
    const bond = player && Number.isFinite(player.bond) ? player.bond : 50;
    const heat = context.seasonHeat || 0;
    const dramaHeat = Number.isFinite(context.dramaWalkHeat) ? context.dramaWalkHeat : 28;
    const hometown = Number.isFinite(context.hometownBond) ? context.hometownBond : 60;
    const spongeBond = Number.isFinite(context.spongeBond) ? context.spongeBond : 50;
    if (player && player.hiddenTrait === "drama-prone" && heat >= dramaHeat) {
      return { walk: true, salaryMult: 1, tag: "drama" };
    }
    if (player && player.persona === "competitor" && bond < 35) {
      return { walk: true, salaryMult: 1, tag: "minutes" };
    }
    if (player && player.persona === "mentor" && bond >= hometown) {
      return { walk: false, salaryMult: 0.85, tag: "hometown" };
    }
    if (player && player.persona === "sponge" && bond >= spongeBond) {
      return { walk: false, salaryMult: 1, tag: "loyal-kid" };
    }
    if (context.hasInstigator && player && player.hiddenTrait !== "instigator") {
      return { walk: false, salaryMult: 1.15, tag: "poisoned" };
    }
    return { walk: false, salaryMult: 1, tag: null };
  },
});
