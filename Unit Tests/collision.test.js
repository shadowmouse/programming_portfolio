// Event Collision Detection Integration Tests (Relies on DB Selection Criteria)
// Uses SQLite for local testing. Can be configured for other DB

import Collision from "../collision"

import moment from "moment-timezone";
import { getDatabase } from "./database.mock"
import { databaseSetup, dropTables, referenceSetup, orderScaffolding } from "./databaseSetup"
import { dummyEvent, dummyOrder } from "./testSupport"

let setupEvents = (database) => {
    return new Promise((res, rej) => {
        // let database = getDatabase();
        let forwardOrder = dummyOrder({
            id: 1,
            owner_id: 1,
            account_id: 1,
            service_id: 1
        });
        let forwardEvent = dummyEvent({
            id: 1,
            order_id: 1,
            service_id: 1,
            start_date: moment("2020-02-07 09:00:00", "YYYY-MM-DD HH:mm:ss"),
            end_date: moment("2020-02-07 10:00:00", "YYYY-MM-DD HH:mm:ss"),
            rate_id: 1
        });
        let backwardOrder = dummyOrder({
            id: 2,
            owner_id: 1,
            account_id: 1,
            service_id: 1
        });
        let backwardEvent = dummyEvent({
            id: 2,
            order_id: 2,
            service_id: 1,
            start_date: moment("2020-02-07 11:00:00", "YYYY-MM-DD HH:mm:ss"),
            end_date: moment("2020-02-07 12:00:00", "YYYY-MM-DD HH:mm:ss"),
            rate_id: 1
        });

        database.models.orders.bulkCreate([forwardOrder, backwardOrder]).then(() => {
            return database.models.events.bulkCreate([forwardEvent, backwardEvent])
        }).then((_results) => {
            res(true);
            return
        }).catch((firstError) => {
            console.log(firstError);
            rej(false)
            return
        });
    })

}

beforeAll(() => {
    // Setup Dummy Database
    let database = getDatabase()
    return database.authenticate().then(() => {
        return dropTables(database);
    }).then(() => {
        return databaseSetup(database);
    })
    .then((proceed) => { 
        if(proceed) { 
            return referenceSetup(database); 
        }
        throw new Error("Database Setup Failed");
    })
    .then((proceed) => {
        if(proceed) { 
            return orderScaffolding(database) 
        }
        throw new Error("Reference Setup Failed");
    })
    .then(() => {
        return setupEvents(database);
    })
    .then(() => {
        return true;
    })
    .catch((err) => {
        throw err;
    });
})

afterAll((done) => {
    let database = getDatabase()
    database.close();
    done()
})



test("Zero Collisions Test - Open", () => {

    let database = getDatabase();

    let rangeStart = moment("2020-02-07 13:00", "YYYY-MM-DD HH:mm")
    let rangeEnd = moment("2020-02-07 15:00:00", "YYYY-MM-DD HH:mm:ss")

    return Collision.getAllCollisions(database, "new", [1], rangeStart, rangeEnd).then((collisions) => {
        expect(collisions.length).toBe(0);
    })

})

test("Zero Collisions Test - Bookended", () => {

    let database = getDatabase();

    let rangeStart = moment("2020-02-07 10:00:00", "YYYY-MM-DD HH:mm:ss")
    let rangeEnd = moment("2020-02-07 11:00:00", "YYYY-MM-DD HH:mm:ss")

    return Collision.getAllCollisions(database, "new", [1], rangeStart, rangeEnd).then((collisions) => {
        expect(collisions.length).toBe(0);
    })

})


test("Forward Collision Test", () => {

    let database = getDatabase();

    let rangeStart = moment("2020-02-07 10:00:00", "YYYY-MM-DD HH:mm:ss")
    let rangeEnd = moment("2020-02-07 11:01:00", "YYYY-MM-DD HH:mm:ss")

    return Collision.getAllCollisions(database, "new", [1], rangeStart, rangeEnd).then((collisions) => {
        expect(collisions.length).toBe(1);
    })

})

test("Backward Collision Test", () => {

    let database = getDatabase();

    let rangeStart = moment("2020-02-07 09:59:00", "YYYY-MM-DD HH:mm:ss")
    let rangeEnd = moment("2020-02-07 11:00:00", "YYYY-MM-DD HH:mm:ss")

    return Collision.getAllCollisions(database, "new", [1], rangeStart, rangeEnd).then((collisions) => {
        expect(collisions.length).toBe(1);
    })

})

test("Overlap Collision Test - Intersecting", () => {

    let database = getDatabase();

    let rangeStart = moment("2020-02-07 09:59:00", "YYYY-MM-DD HH:mm:ss")
    let rangeEnd = moment("2020-02-07 11:01:00", "YYYY-MM-DD HH:mm:ss")

    return Collision.getAllCollisions(database, "new", [1], rangeStart, rangeEnd).then((collisions) => {
        expect(collisions.length).toBe(2);
    })

})

test("Overlap Collision Test - Overlaid", () => {

    let database = getDatabase();

    let rangeStart = moment("2020-02-07 09:15:00", "YYYY-MM-DD HH:mm:ss")
    let rangeEnd = moment("2020-02-07 09:45:00", "YYYY-MM-DD HH:mm:ss")

    return Collision.getAllCollisions(database, "new", [1], rangeStart, rangeEnd).then((collisions) => {
        expect(collisions.length).toBe(1);
    })

})

test("Overlap Collision Test - Overlaying", () => {

    let database = getDatabase();

    let rangeStart = moment("2020-02-07 08:15:00", "YYYY-MM-DD HH:mm:ss")
    let rangeEnd = moment("2020-02-07 10:45:00", "YYYY-MM-DD HH:mm:ss")

    return Collision.getAllCollisions(database, "new", [1], rangeStart, rangeEnd).then((collisions) => {
        expect(collisions.length).toBe(1);
    })

})

test("Overlap Collision Test - Overlaying (Multiple)", () => {

    let database = getDatabase();

    let rangeStart = moment("2020-02-07 08:15:00", "YYYY-MM-DD HH:mm:ss")
    let rangeEnd = moment("2020-02-07 12:45:00", "YYYY-MM-DD HH:mm:ss")

    return Collision.getAllCollisions(database, "new", [1], rangeStart, rangeEnd).then((collisions) => {
        expect(collisions.length).toBe(2);
    })

})


