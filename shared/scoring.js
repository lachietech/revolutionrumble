export function includesPinfall(tournament, stageIndex) {
  const format = tournament?.format;
  const stage = format?.hasStages ? format.stages?.[stageIndex] : null;
  const matchStage = stage ? stage.type !== 'qualifying' : format?.scoringMethod && format.scoringMethod !== 'total-pinfall';
  return !matchStage || (stage?.matchPlaySettings?.includePinfall ?? format?.matchPlay?.includePinfall ?? true);
}

export function getHandicapPerGame(tournament, registration) {
  const format = tournament?.format;
  if (!format?.useHandicap) return 0;
  return Math.max(0, Math.round(((format.handicapBase ?? 200) - (registration.averageScore ?? 180)) * ((format.handicapPercentage ?? 90) / 100))) +
    (registration.gender === 'female' && !format.separateDivisions ? format.femaleHandicapPins ?? 8 : 0);
}

export function getStageScoreTotal(registration, stageIndex, tournament) {
  const stageScore = registration.stageScores?.find(
    (score) => score.stageIndex === stageIndex,
  );
  if (!stageScore?.scores?.length) return null;
  const scratchTotal = stageScore.scores.reduce((sum, score) => sum + score, 0);
  const bonusTotal =
    stageScore.bonusPins?.reduce((sum, bonus) => sum + bonus, 0) || 0;
  const handicapTotal = (tournament ? getHandicapPerGame(tournament, registration) : stageScore.handicap || 0) * stageScore.scores.length;
  return (
    (includesPinfall(tournament, stageIndex) ? scratchTotal + handicapTotal : 0) + bonusTotal + (stageScore.carryover || 0)
  );
}

function seedStagePlayers(players, stageIndex, allRegistrations = players, tournament) {
  if (stageIndex <= 0) {
    return [...players]
      .sort((a, b) => a.playerName.localeCompare(b.playerName))
      .map((player, index) => ({ ...player, seed: index + 1 }));
  }

  return [...players]
    .map((player) => ({
      ...player,
      previousStageTotal: getStageScoreTotal(
        allRegistrations.find(
          (registration) =>
            registration._id.toString() === player._id.toString(),
        ) || player,
        stageIndex - 1,
        tournament,
      ),
    }))
    .sort(
      (a, b) =>
        (b.previousStageTotal ?? -1) - (a.previousStageTotal ?? -1) ||
        a.playerName.localeCompare(b.playerName),
    )
    .map((player, index) => ({ ...player, seed: index + 1 }));
}

function buildRoundRobinDraw(players) {
  const seededPlayers = [...players];
  const rotation =
    seededPlayers.length % 2 === 1
      ? [...seededPlayers, null]
      : [...seededPlayers];
  const rounds = Math.max(0, rotation.length - 1);
  const matchupsByPlayer = new Map(
    seededPlayers.map((player) => [player._id.toString(), []]),
  );

  for (let round = 0; round < rounds; round++) {
    for (let index = 0; index < rotation.length / 2; index++) {
      const home = rotation[index];
      const away = rotation[rotation.length - 1 - index];
      if (!home || !away) continue;

      const label = `Round ${round + 1}: #${home.seed} ${home.playerName} vs #${away.seed} ${away.playerName}`;
      matchupsByPlayer.get(home._id.toString())?.push({
        label,
        opponentName: away.playerName,
        opponentSeed: away.seed,
      });
      matchupsByPlayer.get(away._id.toString())?.push({
        label,
        opponentName: home.playerName,
        opponentSeed: home.seed,
      });
    }

    rotation.splice(1, 0, rotation.pop());
  }

  return {
    games: Math.max(0, seededPlayers.length - 1),
    seededPlayers,
    matchupsByPlayer,
  };
}

function buildStepladderDraw(stage, players) {
  const finalists = Math.min(
    Number(stage.stageConfig?.finalists) || players.length,
    players.length,
  );
  const seededPlayers = [...players].slice(0, finalists);
  const games = Math.max(0, finalists - 1);
  const matchupsByPlayer = new Map(
    seededPlayers.map((player) => [player._id.toString(), []]),
  );

  for (let gameIndex = 0; gameIndex < games; gameIndex++) {
    const lowerSeedNumber = finalists - gameIndex;
    const challengerSeedNumber = lowerSeedNumber - 1;
    const lowerPlayer = seededPlayers.find(
      (player) => player.seed === lowerSeedNumber,
    );
    const challenger = seededPlayers.find(
      (player) => player.seed === challengerSeedNumber,
    );
    const lowerName = lowerPlayer?.playerName || `Seed ${lowerSeedNumber}`;
    const challengerName =
      challenger?.playerName || `Seed ${challengerSeedNumber}`;
    const opponentLabel =
      gameIndex === 0
        ? `#${lowerSeedNumber} ${lowerName}`
        : `Winner of Match ${gameIndex}`;
    const label =
      gameIndex === 0
        ? `Match 1: #${lowerSeedNumber} ${lowerName} vs #${challengerSeedNumber} ${challengerName}`
        : `Match ${gameIndex + 1}: Winner of Match ${gameIndex} vs #${challengerSeedNumber} ${challengerName}`;

    if (lowerPlayer) {
      matchupsByPlayer.get(lowerPlayer._id.toString())?.push({
        label,
        opponentName: challengerName,
        opponentSeed: challengerSeedNumber,
      });
    }

    if (challenger) {
      matchupsByPlayer.get(challenger._id.toString())?.push({
        label,
        opponentName: opponentLabel,
        opponentSeed: gameIndex === 0 ? lowerSeedNumber : null,
      });
    }

    seededPlayers
      .filter(
        (player) =>
          player.seed > challengerSeedNumber &&
          player._id.toString() !== lowerPlayer?._id.toString(),
      )
      .forEach((player) => {
        matchupsByPlayer.get(player._id.toString())?.push({
          label: `If advances: ${label}`,
          opponentName: challengerName,
          opponentSeed: challengerSeedNumber,
        });
      });
  }

  return {
    games,
    seededPlayers,
    matchupsByPlayer,
  };
}

export function buildStageDraw(
  stage,
  players,
  stageIndex,
  allRegistrations = players,
  tournament,
) {
  const seededPlayers = seedStagePlayers(players, stageIndex, allRegistrations, tournament);
  if (stage.type === "round_robin") return buildRoundRobinDraw(seededPlayers);
  if (stage.type === "stepladder")
    return buildStepladderDraw(stage, seededPlayers);
  return {
    games: Number(stage.type === 'tri_matchplay' ? stage.stageConfig?.triRounds || stage.games : stage.games) || 1,
    seededPlayers,
    matchupsByPlayer: new Map(),
  };
}

export function getStageGameCount(stage, playerCount, draw) {
  if (draw?.games !== undefined) return Math.max(1, draw.games);
  if (stage.type === "round_robin") return Math.max(1, playerCount - 1);
  if (stage.type === "stepladder")
    return Math.max(
      1,
      Math.min(
        Number(stage.stageConfig?.finalists) || playerCount,
        playerCount,
      ) - 1,
    );
  if (stage.type === "tri_matchplay")
    return Number(stage.stageConfig?.triRounds) || Number(stage.games) || 1;
  return Number(stage.games) || 1;
}

export function getPlayerMatchups(draw, registrationId) {
  return draw?.matchupsByPlayer?.get(registrationId.toString()) || [];
}
