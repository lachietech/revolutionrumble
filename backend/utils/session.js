export function saveSession(req) {
    return new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
}

export async function regenerateSession(req) {
    const reservationId = req.session.reservationId;
    await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    if (reservationId) req.session.reservationId = reservationId;
}

export function destroySession(req) {
    return new Promise((resolve, reject) => req.session.destroy(err => err ? reject(err) : resolve()));
}
