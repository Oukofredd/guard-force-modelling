
/*
 * GUARD FORCE MODELLING
 * JavaScript Objects and Classes
 *
 * Demonstrates:
 * - ES2015 classes and constructors
 * - Object relationships
 * - Getters and static methods
 * - Inheritance
 * - Patrol and incident business rules
 */

// --------------------------------------------------
// 1. POSITION
// Represents a geographical location.
// --------------------------------------------------

class Position {
    constructor(lat, lng) {
        this.lat = Number(lat);
        this.lng = Number(lng);
    }

    static fromString(text) {
        const [lat, lng] = text.split(",").map(Number);
        return new Position(lat, lng);
    }

    distanceKmTo(other) {
        const toRadians = degrees => degrees * Math.PI / 180;
        const earthRadiusKm = 6371;

        const lat1 = toRadians(this.lat);
        const lat2 = toRadians(other.lat);
        const deltaLat = toRadians(other.lat - this.lat);
        const deltaLng = toRadians(other.lng - this.lng);

        const a =
            Math.sin(deltaLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLng / 2) ** 2;

        return 2 * earthRadiusKm *
            Math.asin(Math.sqrt(Math.min(1, a)));
    }
}


// --------------------------------------------------
// 2. CLIENT COMPANY
// A company receiving or providing security services.
// --------------------------------------------------

class ClientCompany {
    constructor({ id, name }) {
        this.id = id;
        this.name = name;
        this.sites = [];
    }

    addSite(site) {
        this.sites.push(site);
    }
}


// --------------------------------------------------
// 3. CHECKPOINT
// A physical point that can be scanned during patrol.
// --------------------------------------------------

class Checkpoint {
    constructor({
        checkpointId,
        checkpointName,
        checkpointQRCode,
        checkpointOrder,
        checkpointDuration
    }) {
        this.id = checkpointId;
        this.name = checkpointName;
        this.qr = checkpointQRCode;
        this.order = checkpointOrder;
        this.dwellSeconds = checkpointDuration;
    }

    matches(scannedText) {
        return scannedText === this.qr;
    }
}


// --------------------------------------------------
// 4. ASSET
// A physical item identified by a QR code.
// --------------------------------------------------

class Asset {
    constructor({ id, name, type, qr }) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.qr = qr;
    }

    matches(scannedText) {
        return scannedText === this.qr;
    }
}


// --------------------------------------------------
// 5. SITE
// A protected location belonging to a client.
// --------------------------------------------------

class Site {
    constructor({ id, name, client }) {
        this.id = id;
        this.name = name;
        this.client = client;
        this.checkpoints = [];
        this.posts = [];
        this.patrols = [];
        this.assets = [];
        this.guards = [];
    }

    addCheckpoint(checkpoint) {
        this.checkpoints.push(checkpoint);
    }

    addPost(post) {
        this.posts.push(post);
    }

    addPatrol(patrol) {
        this.patrols.push(patrol);
    }

    addAsset(asset) {
        this.assets.push(asset);
    }

    addGuard(guard) {
        this.guards.push(guard);
    }
}


// --------------------------------------------------
// 6. GUARD POST
// A duty station such as Gate 2 or Control room.
// --------------------------------------------------

class GuardPost {
    constructor({ id, name, site }) {
        this.id = id;
        this.name = name;
        this.site = site;
        this.guard = null;
    }

    assignGuard(guard) {
        this.guard = guard;
    }
}


// --------------------------------------------------
// 7. GUARD
// Stores duty records and the latest GPS position.
// --------------------------------------------------

class Guard {
    constructor({ id, name, company, site }) {
        this.id = id;
        this.name = name;
        this.company = company;
        this.site = site;
        this.clockRecords = [];
        this.lastPosition = null;
        this.lastPositionAt = null;
        this.lastPhoto = null;
    }

    clockIn(post, at, photo, position) {
        if (this.isOnDutyAt(at)) {
            throw new Error("Guard is already on duty.");
        }

        this.clockRecords.push({
            type: "in",
            at: new Date(at),
            post,
            photo,
            position
        });

        this.lastPhoto = photo;
        this.updatePosition(position, at);
    }

    clockOut(at) {
        if (!this.isOnDutyAt(at)) {
            throw new Error("Guard is not on duty.");
        }

        this.clockRecords.push({
            type: "out",
            at: new Date(at)
        });
    }

    isOnDutyAt(at) {
        const time = new Date(at);

        const latestRecord = this.clockRecords
            .filter(record => record.at <= time)
            .sort((a, b) => b.at - a.at)[0];

        return latestRecord?.type === "in";
    }

    get isOnDuty() {
        return this.isOnDutyAt(new Date());
    }

    dutyStateAt(at) {
        return this.isOnDutyAt(at) ? "On duty" : "Off duty";
    }

    updatePosition(position, at) {
        this.lastPosition = position;
        this.lastPositionAt = new Date(at);
    }

    get gpsState() {
        if (!this.lastPositionAt) return "offline";

        const ageMinutes =
            (Date.now() - this.lastPositionAt.getTime()) / 60000;

        if (ageMinutes <= 5) return "online";
        if (ageMinutes <= 60) return "stale";
        return "offline";
    }

    gpsStateAt(at) {
        if (!this.lastPositionAt) return "offline";

        const ageMinutes =
            (new Date(at) - this.lastPositionAt) / 60000;

        if (ageMinutes <= 5) return "online";
        if (ageMinutes <= 60) return "stale";
        return "offline";
    }
}


// --------------------------------------------------
// 8. PATROL
// Defines a scheduled or on-demand assignment.
// --------------------------------------------------

class Patrol {
    constructor({
        patrolId,
        patrolName,
        origin = "scheduled",
        requestedBy = null,
        site,
        startTime,
        endTime,
        instruction = "",
        location = null,
        pathPoints = [],
        checkpoints = [],
        graceMinutes = 15
    }) {
        this.id = patrolId;
        this.name = patrolName;
        this.origin = origin;
        this.requestedBy = requestedBy;
        this.site = site;
        this.startTime = new Date(startTime);
        this.endTime = new Date(endTime);
        this.instruction = instruction;
        this.location = location
            ? Position.fromString(location)
            : null;

        this.pathPoints = pathPoints.map(
            ([lat, lng]) => new Position(lat, lng)
        );

        this.checkpoints = checkpoints;
        this.graceMinutes = graceMinutes;
        this.runs = [];
    }

    addRun(run) {
        this.runs.push(run);
    }

    // A patrol is done if a run was finished today.
    isDone(at) {
        const date = new Date(at).toDateString();

        return this.runs.some(run =>
            run.finishedAt &&
            run.finishedAt.toDateString() === date
        );
    }

    // The patrol becomes missed/overdue after its
    // deadline plus the grace period, if unfinished.
    isOverdue(at) {
        const deadline = new Date(
            this.endTime.getTime() + this.graceMinutes * 60000
        );

        return new Date(at) > deadline && !this.isDone(at);
    }

    isMissed(at) {
        return this.isOverdue(at) && this.runs.length === 0;
    }
}


// --------------------------------------------------
// 9. SCAN
// A record of visiting one checkpoint.
// --------------------------------------------------

class Scan {
    constructor({ checkpoint, at, position, stepsSinceLast }) {
        this.checkpoint = checkpoint;
        this.at = new Date(at);
        this.position = position;
        this.stepsSinceLast = stepsSinceLast;
    }

    toJSON() {
        return {
            checkpoint: this.checkpoint.name,
            at: this.at.toISOString(),
            position: {
                lat: this.position.lat,
                lng: this.position.lng
            },
            stepsSinceLast: this.stepsSinceLast
        };
    }
}


// --------------------------------------------------
// 10. PATROL RUN
// One actual attempt to carry out a patrol.
// --------------------------------------------------

class PatrolRun {
    constructor({ patrol, guard }) {
        this.patrol = patrol;
        this.guard = guard;
        this.startedAt = null;
        this.finishedAt = null;
        this.scans = [];
        this.note = "";
    }

    start(at) {
        if (this.startedAt) {
            throw new Error("This patrol run has already started.");
        }

        this.startedAt = new Date(at);
    }

    scan(checkpoint, scannedText, at, position, stepsSinceLast) {
        if (!this.startedAt || this.finishedAt) {
            throw new Error("Patrol run is not active.");
        }

        if (this.scans.some(scan =>
            scan.checkpoint.id === checkpoint.id
        )) {
            throw new Error("Checkpoint already scanned in this run.");
        }

        const expected =
            this.patrol.checkpoints[this.scans.length];

        if (!expected || expected.id !== checkpoint.id) {
            throw new Error("Checkpoints must be scanned in order.");
        }

        if (!checkpoint.matches(scannedText)) {
            throw new Error("Incorrect checkpoint QR code.");
        }

        const scanTime = new Date(at);
        const previousScan = this.scans[this.scans.length - 1];

        // A duration checkpoint requires the guard to
        // wait for the required time after arrival.
        if (previousScan &&
            previousScan.checkpoint.dwellSeconds > 0) {
            const waitedSeconds =
                (scanTime - previousScan.at) / 1000;

            if (waitedSeconds <
                previousScan.checkpoint.dwellSeconds) {
                throw new Error("Required waiting time not completed.");
            }
        }

        const record = new Scan({
            checkpoint,
            at: scanTime,
            position,
            stepsSinceLast
        });

        this.scans.push(record);
        return record;
    }

    finish(at, note = "") {
        if (!this.startedAt || this.finishedAt) {
            throw new Error("Patrol run cannot be finished.");
        }

        if (this.scans.length !== this.patrol.checkpoints.length) {
            throw new Error("Not all checkpoints have been scanned.");
        }

        // Enforce the final checkpoint's waiting time too.
        const lastScan = this.scans[this.scans.length - 1];

        if (lastScan.checkpoint.dwellSeconds > 0) {
            const waitedSeconds =
                (new Date(at) - lastScan.at) / 1000;

            if (waitedSeconds < lastScan.checkpoint.dwellSeconds) {
                throw new Error("Required waiting time not completed.");
            }
        }

        this.finishedAt = new Date(at);
        this.note = note;
    }
}


// --------------------------------------------------
// 11. OCCURRENCE
// An entry in the occurrence book.
// --------------------------------------------------

class Occurrence {
    constructor({ id, guard, threat, note, photos, createdAt }) {
        this.id = id;
        this.guard = guard;
        this.threat = threat;
        this.note = note;
        this.photos = photos;
        this.createdAt = new Date(createdAt);
        this.closedAt = null;
    }

    close(at) {
        if (this.closedAt) {
            throw new Error("Occurrence is already closed.");
        }

        this.closedAt = new Date(at);
    }

    get isOpen() {
        return this.closedAt === null;
    }
}


// --------------------------------------------------
// 12. VISITOR
// Records visitor entry and exit.
// --------------------------------------------------

class Visitor {
    constructor({ id, name, company, visiting, timeIn }) {
        this.id = id;
        this.name = name;
        this.company = company;
        this.visiting = visiting;
        this.timeIn = new Date(timeIn);
        this.timeOut = null;
    }

    checkOut(at) {
        if (this.timeOut) {
            throw new Error("Visitor has already checked out.");
        }

        this.timeOut = new Date(at);
    }
}


// --------------------------------------------------
// 13. RESPONDER
// A security vehicle or person responding to incidents.
// --------------------------------------------------

class Responder {
    constructor({ id, name, company, responseTypes, position }) {
        this.id = id;
        this.name = name;
        this.company = company;
        this.responseTypes = responseTypes;
        this.position = position;
        this.status = "available";
    }

    dispatch() {
        this.status = "dispatched";
    }

    completeResponse() {
        this.status = "available";
    }
}


// --------------------------------------------------
// 14. INCIDENT
// A security event requiring investigation or response.
// --------------------------------------------------

class Incident {
    constructor({ id, type, guard, position, createdAt }) {
        this.id = id;
        this.type = type;
        this.guard = guard;
        this.position = position;
        this.createdAt = new Date(createdAt);
        this.responder = null;
        this.resolvedAt = null;
        this.lastAlarmAt = null;
    }

    get isCritical() {
        return ["panic", "SOS", "duress"].includes(this.type);
    }

    assignResponder(responder, at) {
        if (this.responder) {
            throw new Error("Incident already has a responder.");
        }

        this.responder = responder;
        responder.dispatch();
    }

    resolve(at) {
        this.resolvedAt = new Date(at);

        if (this.responder) {
            this.responder.completeResponse();
        }
    }

    // Re-sound an unassigned critical alarm every 30 seconds.
    shouldResoundAlarm(at) {
        if (!this.isCritical || this.responder || this.resolvedAt) {
            return false;
        }

        const time = new Date(at);

        if (!this.lastAlarmAt ||
            time - this.lastAlarmAt >= 30000) {
            this.lastAlarmAt = time;
            return true;
        }

        return false;
    }

    // Rank: same company + matching type, same company,
    // matching type, then all remaining responders.
    static rankResponders(incident, responders) {
        const rank = responder => {
            const sameCompany =
                responder.company.id === incident.guard.company.id;

            const matchingType =
                responder.responseTypes.includes(incident.type);

            if (sameCompany && matchingType) return 0;
            if (sameCompany) return 1;
            if (matchingType) return 2;
            return 3;
        };

        return [...responders].sort((a, b) => {
            const rankDifference = rank(a) - rank(b);

            if (rankDifference !== 0) return rankDifference;

            const availability = responder =>
                responder.status === "available" ? 0 : 1;

            const availabilityDifference =
                availability(a) - availability(b);

            if (availabilityDifference !== 0) {
                return availabilityDifference;
            }

            return a.position.distanceKmTo(incident.position) -
                b.position.distanceKmTo(incident.position);
        });
    }
}


// --------------------------------------------------
// 15. INHERITANCE
// A critical incident is a specialised incident.
// --------------------------------------------------

class CriticalIncident extends Incident {
    constructor(details) {
        super(details);

        if (!this.isCritical) {
            throw new Error(
                "CriticalIncident requires panic, SOS or duress."
            );
        }
    }
}


// --------------------------------------------------
// 16. SIMULATE MARY'S SHIFT
// --------------------------------------------------

const date = "2026-10-23T";

// Client and site
const client = new ClientCompany({
    id: 1,
    name: "Ruiru Business Park Client"
});

const site = new Site({
    id: 12,
    name: "Ruiru Business Park",
    client
});

client.addSite(site);

// Guard post
const gate2 = new GuardPost({
    id: 2,
    name: "Gate 2",
    site
});

site.addPost(gate2);

// Checkpoints from the supplied JSON
const checkpoints = [
    new Checkpoint({
        checkpointId: 31,
        checkpointName: "Gate 2",
        checkpointQRCode: "CP-12-GATE2",
        checkpointOrder: 1,
        checkpointDuration: 0
    }),
    new Checkpoint({
        checkpointId: 34,
        checkpointName: "Generator room",
        checkpointQRCode: "CP12-GENROOM",
        checkpointOrder: 2,
        checkpointDuration: 60
    }),
    new Checkpoint({
        checkpointId: 35,
        checkpointName: "Fence corner C",
        checkpointQRCode: "CP12-FENCEC",
        checkpointOrder: 3,
        checkpointDuration: 0
    })
];

checkpoints.forEach(checkpoint => site.addCheckpoint(checkpoint));

// Mary's guard record
const mary = new Guard({
    id: 101,
    name: "Mary Wanjiku",
    company: client,
    site
});

site.addGuard(mary);

const gatePosition = Position.fromString("-1.150210,36.958330");

mary.clockIn(
    gate2,
    date + "17:58:00",
    "mary-clock-in.jpg",
    gatePosition
);

gate2.assignGuard(mary);

// On-demand patrol from the provided system record
const instantPatrol = new Patrol({
    patrolId: 61,
    patrolName: "Check perimeter fence, block C",
    origin: "on-demand",
    requestedBy: "Grace Njeri (tenant)",
    site,
    startTime: date + "19:12:00",
    endTime: date + "19:42:00",
    instruction: "Cut in the fence behind the generator room. Start from Gate 2.",
    location: "-1.150640,36.959120",
    pathPoints: [
        [-1.150210, 36.958330],
        [-1.150450, 36.958810]
    ],
    checkpoints
});

site.addPatrol(instantPatrol);

const run = new PatrolRun({
    patrol: instantPatrol,
    guard: mary
});

instantPatrol.addRun(run);
run.start(date + "19:14:00");

run.scan(
    checkpoints[0], "CP-12-GATE2",
    date + "19:14:00", gatePosition, 0
);

run.scan(
    checkpoints[1], "CP12-GENROOM",
    date + "19:16:00", gatePosition, 120
);

run.scan(
    checkpoints[2], "CP12-FENCEC",
    date + "19:20:00", gatePosition, 85
);

run.finish(
    date + "19:31:00",
    "Fence cut 40 cm, photographed."
);

// Occurrence book entry
const occurrence = new Occurrence({
    id: 501,
    guard: mary,
    threat: "Vandalism",
    note: run.note,
    photos: ["fence-photo-1.jpg", "fence-photo-2.jpg"],
    createdAt: date + "19:33:00"
});

// Visitor
const visitor = new Visitor({
    id: 601,
    name: "Example Visitor",
    company: "Example Company",
    visiting: "Accountant, floor 2",
    timeIn: date + "21:05:00"
});

// Panic incident and responder
const panicIncident = new CriticalIncident({
    id: 701,
    type: "panic",
    guard: mary,
    position: gatePosition,
    createdAt: date + "22:40:00"
});

const responder = new Responder({
    id: 801,
    name: "Security Car 1",
    company: client,
    responseTypes: ["panic", "SOS"],
    position: Position.fromString("-1.150640,36.984000")
});

const rankedResponders = Incident.rankResponders(
    panicIncident,
    [responder]
);

panicIncident.assignResponder(
    rankedResponders[0],
    date + "22:41:00"
);

panicIncident.resolve(date + "23:10:00");

// Night patrol: Mary never starts it.
const nightPatrol = new Patrol({
    patrolId: 62,
    patrolName: "Night perimeter round",
    origin: "scheduled",
    site,
    startTime: date + "22:00:00",
    endTime: date + "23:00:00",
    checkpoints: [
        ...checkpoints,
        new Checkpoint({
            checkpointId: 36,
            checkpointName: "Parking B",
            checkpointQRCode: "CP12-PARKINGB",
            checkpointOrder: 4,
            checkpointDuration: 0
        })
    ],
    graceMinutes: 15
});

site.addPatrol(nightPatrol);

// Clock out at 06:00 the following morning.
mary.clockOut("2026-10-24T06:00:00");

// Required outputs
console.log(
    "Mary's duty state at 22:40:",
    mary.dutyStateAt(date + "22:40:00")
);

console.log(
    "Night patrol missed at 23:30:",
    nightPatrol.isMissed(date + "23:30:00")
);
