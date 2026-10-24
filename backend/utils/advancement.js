import {
  buildStageDraw,
  getStageGameCount,
  getStageScoreTotal,
} from "../../shared/scoring.js";

export function planAdvancement(tournament, registrations, stageIndex) {
  const stages = tournament.format?.stages;
  const stage = stages?.[stageIndex];
  const next = stages?.[stageIndex + 1];
  if (
    !tournament.format?.hasStages ||
    !stage ||
    !next ||
    !stage.advancingBowlers
  )
    throw new Error("This stage has no advancement configured");
  const field = registrations.filter(
    (row) =>
      ["confirmed", "pending"].includes(row.status) &&
      ((row.currentStage || 0) === stageIndex ||
        row.stageScores?.some((score) => score.stageIndex === stageIndex)),
  );
  if (field.some((row) => (row.currentStage || 0) > stageIndex))
    throw new Error("This stage has already advanced");
  const draw = buildStageDraw(stage, field, stageIndex, registrations, tournament);
  const games = getStageGameCount(stage, field.length, draw);
  if (
    !field.length ||
    field.some(
      (row) =>
        (row.stageScores?.find((score) => score.stageIndex === stageIndex)
          ?.scores.length || 0) < games,
    )
  )
    throw new Error("Complete and save every bowler’s games before advancing");
  const ranked = [...field].sort(
    (a, b) =>
      getStageScoreTotal(b, stageIndex, tournament) - getStageScoreTotal(a, stageIndex, tournament),
  );
  const cut = stage.advancingBowlers;
  if (
    ranked[cut] &&
    getStageScoreTotal(ranked[cut - 1], stageIndex, tournament) ===
      getStageScoreTotal(ranked[cut], stageIndex, tournament)
  )
    throw new Error("Resolve the tie at the advancement cut before proceeding");
  return ranked.slice(0, cut).map((row) => ({
    registrationId: row._id,
    currentStage: stageIndex + 1,
    stageScores: [
      ...(row.stageScores || []).filter(
        (score) => score.stageIndex !== stageIndex + 1,
      ),
      {
        stageIndex: stageIndex + 1,
        scores: [],
        bonusPins: [],
        handicap: 0,
        total: 0,
        carryover: next.carryoverPinfall
          ? Math.round(
              getStageScoreTotal(row, stageIndex, tournament) *
                ((next.carryoverPercentage ?? 100) / 100),
            )
          : 0,
      },
    ],
  }));
}
