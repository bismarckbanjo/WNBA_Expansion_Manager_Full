// Pure simulation helpers. These functions do not read or mutate application
// state, which makes their results deterministic and independently testable.
window.GAME_ENGINE = Object.freeze({
  compositeRating(player, ratingKeys, weights) {
    return Math.round(
      ratingKeys.reduce((total, key) => total + player.ratings[key] * weights[key], 0),
    );
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
});
