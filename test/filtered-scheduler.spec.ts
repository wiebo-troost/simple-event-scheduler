import "mocha";
import expect from "expect.js";
import delay from "delay";
import { SimpleEventScheduler } from "../src/simple-event-scheduler";
import { DBAdapter, Job } from "../src/db";
import { SequelizeAdapter } from "../src/db/sequelize-adapter";
import { Sequelize } from "sequelize";
// import Sequelize from "sequelize";

describe("The filtered scheduler", function () {
  // Note the function above, allows access to the mocha context
  // (fat arrow does not)
  // so we can set the test timeout to 10000, and the delay below to 6000.
  this.timeout(30000);
  const mySqlHost = process.env.MYSQL_HOST || "localhost";
  const mySqlPort = process.env.MYSQL_PORT || "3306";
  const mySqlUserName = process.env.MYSQL_USERNAME || "agenda";
  const mySqlUserPwd = process.env.MYSQL_PASSWORD || "agenda";

  const agendaDatabase = "agenda_test";

  const sequelize = new Sequelize(agendaDatabase, mySqlUserName, mySqlUserPwd, {
    host: mySqlHost,
    dialect: "mysql",
    logging: false,
  });

  let adapter: DBAdapter;
  let scheduler: SimpleEventScheduler;
  before(() => {
    return sequelize
      .authenticate()
      .then(() => {
        adapter = new SequelizeAdapter(sequelize);
        scheduler = new SimpleEventScheduler(adapter, {emittingChannels:['testing123', 'testing456']});
      })
      .catch((err) => {
        console.error("Unable to connect to the database:", err);
      });
  });

  beforeEach(() => {
    return adapter.purgeJobs({});
  });

  afterEach(() => {
    scheduler.stop();
  });

  it("should only emit event for selected channels", () => {
    const now = new Date();
    const schedDate = new Date(now.getTime() + 1000 * 3);
    //4 seconds from now.

    let events = [];
    let events123 = [];
    let events456 = []
    scheduler.on("jobs", (eventData: any) => {
      events.push(eventData);
    });

    scheduler.on("testing123", (eventData: any) => {
      events123.push(eventData);
    });
    scheduler.on("testing456", (eventData: any) => {
      events456.push(eventData);
    });

    return scheduler
      .createOnetimeJob("onetime-emit", schedDate) //default channel
      .then(() => {
        return scheduler.createOnetimeJob("onetime-emit2", schedDate, {channel: "testing123"}) //default channel
      })
      .then(() => {
        return scheduler.createOnetimeJob("onetime-emit3", schedDate, {channel: "testing456"}) //default channel
      })
      .then((job: Job) => {
        scheduler.start();
      })
      .then(() => {
        return delay(3000);
      })
      .then(() => {
        scheduler.stop();
        scheduler.removeAllListeners();
        expect(events.length).to.be(0); //nothing on jobs
        expect(events123.length).to.be(1);
        expect(events456.length).to.be(1);
      });
  });

});
