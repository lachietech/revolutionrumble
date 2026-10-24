// In-memory fixtures only. Never import .env or connect these models to MongoDB.
import Tournament from "../backend/models/Tournament.js";
import Registration from "../backend/models/Registration.js";
import Bowler from "../backend/models/Bowler.js";
import SpotReservation from "../backend/models/SpotReservation.js";
import TournamentResult from "../backend/models/TournamentResult.js";
import EmailTemplate from "../backend/models/EmailTemplate.js";
import { getResendClient } from "../backend/middleware/resend.js";
import nodemailer from "nodemailer";

export function installBrowserFixtures() {
  const state = { failTournaments: false };
  process.env.ADMIN_EMAILS = "admin@example.com";
  process.env.RESEND_API_KEY = "re_fixture_only";
  getResendClient().emails.send = async () => ({
    data: { id: "fixture-mail" },
  });
  nodemailer.createTransport = () => ({
    sendMail: async () => ({ messageId: "fixture-mail" }),
  });
  const tournament = new Tournament({
    _id: "507f1f77bcf86cd799439012",
    name: "Logan City Rumble",
    location: "Logan City Tenpin",
    description:
      "A weekend of great bowling, fierce competition, and unforgettable frames. Join the field and make your mark on the tour.",
    startDate: "2099-11-14T00:00:00+10:00",
    endDate: "2099-11-15T00:00:00+10:00",
    status: "upcoming",
    entryFee: 120,
    paymentInstructions:
      "Test payment instructions. No payment is required in this preview.",
    squads: [
      {
        _id: "507f1f77bcf86cd799439013",
        name: "Saturday A",
        date: "2099-11-14",
        time: "09:00",
        capacity: 24,
        isQualifying: true,
      },
    ],
    format: {
      hasStages: true,
      gamesPerBowler: 3,
      stages: [
        {
          key: "qualifying",
          name: "Qualifying",
          type: "qualifying",
          games: 3,
          advancingBowlers: 1,
        },
        {
          key: "final",
          name: "Final",
          type: "qualifying",
          games: 3,
          carryoverPinfall: true,
          carryoverPercentage: 0,
        },
      ],
    },
  });
  const events = [
    tournament,
    new Tournament({
      ...tournament.toObject(),
      _id: "507f1f77bcf86cd799439022",
      name: "Ashmore Open",
      location: "Ashmore",
      startDate: "2099-12-05",
      entryFee: 95,
    }),
    new Tournament({
      ...tournament.toObject(),
      _id: "507f1f77bcf86cd799439032",
      name: "Toowoomba Challenge",
      location: "Toowoomba",
      startDate: "2099-12-19",
      entryFee: 100,
    }),
  ];
  const bowler = new Bowler({
    _id: "507f1f77bcf86cd799439011",
    email: "bowler@example.com",
    playerName: "Alex Morgan",
    nickname: "AM",
    hand: "right",
    gender: "male",
    currentAverage: 190,
    tournamentAverage: 201,
    highGame: 278,
    highSeries: 690,
    homeCenter: "Logan City",
    tournamentsEntered: [{ tournament: tournament._id, status: "registered" }],
  });
  const registration = new Registration({
    _id: "507f1f77bcf86cd799439014",
    tournament: tournament._id,
    bowler: bowler._id,
    playerName: bowler.playerName,
    email: bowler.email,
    phone: "0400000000",
    gender: "male",
    averageScore: 190,
    assignedSquads: [tournament.squads[0]._id],
    status: "confirmed",
    paymentStatus: "unpaid",
    stageScores: [
      {
        stageIndex: 0,
        scores: [180, 210, 213],
        bonusPins: [0, 0, 0],
        handicap: 0,
        total: 603,
      },
    ],
  });
  const rows = [registration];
  const reservations = [];
  const plain = (value) =>
    value == null ? value : JSON.parse(JSON.stringify(value));
  function query(value, kind) {
    let populate = false;
    const result = {
      then(resolve, reject) {
        let output = value;
        if (populate && kind === "registrations")
          output = (Array.isArray(value) ? value : [value]).map((row) => {
            if (!row) return row;
            return {
              ...plain(row),
              tournament: plain(
                events.find((t) => String(t._id) === String(row.tournament)),
              ),
            };
          });
        if (!Array.isArray(value) && Array.isArray(output)) output = output[0];
        return Promise.resolve(output).then(resolve, reject);
      },
    };
    for (const method of ["sort", "select", "lean"])
      result[method] = () => result;
    result.populate = () => {
      populate = true;
      return result;
    };
    return result;
  }
  Tournament.find = () => {
    if (state.failTournaments) throw new Error('Fixture read failure');
    return query(events.map(plain));
  };
  Tournament.findById = (id) =>
    query(events.find((t) => String(t._id) === String(id)));
  Tournament.prototype.save = async function () {
    const index = events.findIndex((t) => String(t._id) === String(this._id));
    if (index < 0) events.push(this);
    else events[index] = this;
    return this;
  };
  Tournament.findByIdAndUpdate = async (id, update) => {
    const row = events.find((t) => String(t._id) === String(id));
    if (row) Object.assign(row, update.$set || update);
    return row;
  };
  Tournament.findByIdAndDelete = async (id) => {
    const index = events.findIndex((t) => String(t._id) === String(id));
    return index < 0 ? null : events.splice(index, 1)[0];
  };
  Registration.find = (filter = {}) =>
    query(
      rows
        .filter(
          (r) =>
            !filter.tournament ||
            String(r.tournament) === String(filter.tournament),
        )
        .map(plain),
      "registrations",
    );
  Registration.findById = (id) =>
    query(
      rows.find((r) => String(r._id) === String(id)),
      "registrations",
    );
  Registration.findOne = async (filter) =>
    rows.find(
      (r) =>
        r.email === filter.email &&
        String(r.tournament) === String(filter.tournament),
    );
  Registration.countDocuments = async () => rows.length;
  Registration.aggregate = async () => [
    { _id: tournament.squads[0]._id, count: rows.length },
  ];
  Registration.prototype.save = async function () {
    if (!rows.some((r) => String(r._id) === String(this._id))) rows.push(this);
    return this;
  };
  Registration.prototype.populate = async function () {
    return this;
  };
  Registration.findByIdAndUpdate = (id, update) => {
    const row = rows.find((r) => String(r._id) === String(id));
    if (row) Object.assign(row, update.$set || update);
    return query(row, "registrations");
  };
  Registration.updateMany = async () => ({ modifiedCount: 1 });
  Registration.bulkWrite = async operations => {
    let matchedCount = 0;
    for (const { updateOne } of operations) {
      const row = rows.find(r => String(r._id) === String(updateOne.filter._id) && r.currentStage === updateOne.filter.currentStage);
      if (row) { Object.assign(row, updateOne.update.$set); matchedCount++; }
    }
    return { matchedCount };
  };
  Registration.findByIdAndDelete = async (id) => {
    const index = rows.findIndex((r) => String(r._id) === String(id));
    return index < 0 ? null : rows.splice(index, 1)[0];
  };
  Bowler.find = () => query([plain(bowler)]);
  Bowler.findById = () => query(bowler);
  Bowler.findOne = () => query(bowler);
  Bowler.prototype.save = async function () {
    return this;
  };
  TournamentResult.find = () => query([]);
  SpotReservation.findOne = async (filter) =>
    reservations.find(
      (r) =>
        r.sessionId === filter.sessionId && new Date(r.expiresAt) > new Date(),
    ) || null;
  SpotReservation.prototype.save = async function () {
    reservations.push(this);
    return this;
  };
  SpotReservation.aggregate = async () => [];
  SpotReservation.countDocuments = async () => 0;
  SpotReservation.deleteOne = async (filter) => {
    const index = reservations.findIndex(
      (r) => r.sessionId === filter.sessionId,
    );
    if (index >= 0) reservations.splice(index, 1);
    return { deletedCount: index >= 0 ? 1 : 0 };
  };
  const template = {
    name: "registration-confirmation",
    subject: "Your entry for {{tournamentName}}",
    htmlBody: "<h1>Hello {{bowlerName}}</h1>",
    textBody: "Hello {{bowlerName}}",
    save: async () => template,
  };
  EmailTemplate.find = () => query([template]);
  EmailTemplate.findOne = async () => template;
  return { tournament, bowler, registration, rows, events, state };
}
