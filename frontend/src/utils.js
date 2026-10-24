export const date = (value) =>
  value && !Number.isNaN(new Date(value).getTime())
    ? new Intl.DateTimeFormat("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Australia/Brisbane",
      }).format(new Date(value))
    : "Date to be announced";
export const money = (value) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
export const number = (value) =>
  value === null || value === undefined
    ? "—"
    : Number(value).toLocaleString("en-AU");
export const idOf = (value) => (typeof value === "object" ? value?._id : value);
export const stagesOf = (tournament) =>
  tournament?.format?.hasStages && tournament.format.stages?.length
    ? tournament.format.stages
    : [
        {
          name: "Qualifying",
          type: "qualifying",
          games: tournament?.format?.gamesPerBowler || 3,
        },
      ];
export function registrationState(tournament, now = Date.now()) {
  if (tournament.status !== "upcoming" || tournament.registrationManuallyClosed)
    return { open: false, label: "Registration closed" };
  if (
    tournament.registrationDeadline &&
    new Date(tournament.registrationDeadline).getTime() < now
  )
    return { open: false, label: "Registration closed" };
  if (
    !tournament.registrationManuallyOpened &&
    tournament.registrationOpenDate &&
    new Date(tournament.registrationOpenDate).getTime() > now
  )
    return {
      open: false,
      label: `Opens ${date(tournament.registrationOpenDate)}`,
    };
  return { open: true, label: "Registration open" };
}
export function exportCsv(filename, columns, rows) {
  const escape = (value) =>
    '"' +
    String(value ?? "")
      .replace(/^[=+@\-\t\r]/, (match) => "'" + match)
      .replaceAll('"', '""') +
    '"';
  const csv = [columns, ...rows]
    .map((row) => row.map(escape).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
