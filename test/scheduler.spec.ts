import "mocha";
import expect from "expect.js";
import delay from "delay";
import { SimpleEventScheduler } from "../src";
import { DBAdapter, Job } from "../src/db";
import { SequelizeAdapter } from "../src/db/sequelize-adapter";
import { Sequelize } from "sequelize";
// import Sequelize from "sequelize";

describe("Create the scheduler", () => {
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
        scheduler = new SimpleEventScheduler(adapter);
      })
      .catch((err) => {
        console.error("Unable to connect to the database:", err);
      });
  });

  beforeEach(() => {
    return adapter.purgeJobs({});
  });

  it("should instantiate", () => {
    expect(scheduler.start).to.be.a(Function);
  });

  it("should create a recurring job", () => {
    return scheduler.createRecurringJob("rec1", "0 15 * * *").then((job) => {
      expect(job.name).to.be("rec1");
      expect(job.id).to.be.greaterThan(0);
      expect(job.nextRunAt).to.be.a(Date);

      const now = new Date().getTime();
      const tomorrow = now + 1000 * 60 * 60 * 24;

      const nrDt = job.nextRunAt as Date;
      const nextRun = nrDt.getTime();
      const nextRunHour = nrDt.getHours();

      expect(nextRun).to.be.greaterThan(now);
      expect(nextRun).to.be.lessThan(tomorrow);
      expect(nextRunHour).to.be(15);

      return job;
    });
  });

  it("should create a one-time job", () => {
    const now = new Date();
    const schedDate = new Date(now.getTime() + 1000 * 60 * 60 * 24);
    schedDate.setHours(15, 0, 0, 0); //tomorrow at 3pm
    return scheduler
      .createOnetimeJob("onetimer1", schedDate)
      .then((job: Job) => {
        expect(job.cronexp).to.be(undefined);
        const nrDt = job.nextRunAt as Date;
        const nextRunHour = nrDt.getHours();
        expect(nextRunHour).to.be(15);
      });
  });

  it("should store jobs in the database", () => {
    const schedDate1 = new Date(new Date().getTime() + 1000 * 60 * 60 * 24);
    schedDate1.setHours(15, 0, 0, 0); //tomorrow at 3pm

    const schedDate2 = new Date(new Date().getTime() + 1000 * 60 * 60 * 24);
    schedDate2.setHours(16, 0, 0, 0); //tomorrow at 4pm

    return scheduler
      .createOnetimeJob("onetimer1", schedDate1)
      .then((job: Job) => {
        return scheduler.createOnetimeJob("onetimer2", schedDate2);
      })
      .then((job2) => {
        //now fetch from the database and check the data
        const JobModel = sequelize.models["JobsModel"];

        return JobModel.findAll();
      })
      .then((data) => {
        expect(data.length).to.be(2);
        const job1: Job = data[0].toJSON() as Job;
        const job2: Job = data[1].toJSON() as Job;
        expect(job1.nextRunAt).to.be.a(Date);
        expect(job1.nextRunAt!.getTime()).to.equal(schedDate1.getTime());
        expect(job2.nextRunAt!.getTime()).to.equal(schedDate2.getTime());
      });
  });

  it('should not allow duplicate jobs', () => {
    const schedDate1 = new Date(new Date().getTime() + 1000 * 60 * 60 * 24);
    schedDate1.setHours(15, 0, 0, 0); //tomorrow at 3pm

    let err:any

    return scheduler
      .createOnetimeJob("onetimer1", schedDate1)
      .then((job: Job) => {
        return scheduler.createOnetimeJob("onetimer1", schedDate1);
      })
      .catch(error => {
        err = error.message;
        return -1;
      })
      .then((val:any) => {
        expect(val).to.equal(-1);
        expect(err).to.equal("Duplicate job");
      });

  });

  it("should delete a job from database", () => {
    const schedDate1 = new Date(new Date().getTime() + 1000 * 60 * 60 * 24);
    schedDate1.setHours(15, 0, 0, 0); //tomorrow at 3pm

    const schedDate2 = new Date(new Date().getTime() + 1000 * 60 * 60 * 24);
    schedDate2.setHours(16, 0, 0, 0); //tomorrow at 4pm

    return scheduler
      .createOnetimeJob("onetimer1", schedDate1)
      .then((job: Job) => {
        return scheduler.createOnetimeJob("onetimer2", schedDate2);
      }).then(job2 => {
        return scheduler.removeJobByName("onetimer2");
      })
      .then((result) => {
        expect(result).to.be(true);
        //now fetch from the database and check the data
        const JobModel = sequelize.models["JobsModel"];

        return JobModel.findAll();
      })
      .then((data) => {
        expect(data.length).to.be(1);
        const job1: Job = data[0].toJSON() as Job;
        expect(job1.name).to.equal("onetimer1");
      });
  });

  describe("process jobs", function () {
    // Note the function above, allows access to the mocha context
    // (fat arrow does not)
    // so we can set the test timeout to 10000, and the delay below to 6000.
    this.timeout(30000);
    afterEach(() => {
      scheduler.stop();
    });

    it("should emit an event for a onetime job", () => {
      const now = new Date();
      const schedDate = new Date(now.getTime() + 1000 * 3);
      //4 seconds from now.

      let events = [];
      scheduler.on("jobs", (eventData: any) => {
        events.push(eventData);
      });

      return scheduler
        .createOnetimeJob("onetime-emit", schedDate)
        .then((job: Job) => {
          scheduler.start();
        })
        .then(() => {
          return delay(9000);
        })
        .then(() => {
          scheduler.stop();
          scheduler.removeAllListeners();
          expect(events.length).to.be(1);
        });
    });

    it("should emit the params for the job", () => {
      const now = new Date();
      const schedDate = new Date(now.getTime() + 1000 * 3);
      //4 seconds from now.

      let events:any[] = [];
      scheduler.on("jobs", (eventData: any) => {
        events.push(eventData);
      });

      const param:any = { valueOne:"Val1", valueTwo:12}; 

      return scheduler
        .createOnetimeJob("onetime-emit", schedDate, {params:JSON.stringify(param)})
        .then((job: Job) => {
          scheduler.start();
        })
        .then(() => {
          return delay(9000);
        })
        .then(() => {
          scheduler.stop();
          scheduler.removeAllListeners();
          expect(events.length).to.be(1);
          const ev:any = events[0];
          const parm = JSON.parse(ev.params);
          expect(parm.valueOne).to.equal("Val1");
          expect(parm.valueTwo).to.equal(12);
        });
    });

    it("should emit events for a recurring job", () => {

      let events = [];
      scheduler.on("jobs", (eventData: any) => {
        // console.log(eventData);
        events.push(eventData);
      });

      return scheduler
        .createRecurringJob("onetime-emit", "*/5 * * * * *")
        .then((job: Job) => {
          scheduler.start();
        })
        .then(() => {
          return delay(25000);
        })
        .then(() => {
          scheduler.stop();
          scheduler.removeAllListeners();
          expect(events.length).to.be.greaterThan(3);
          expect(events.length).to.be.lessThan(6);
        });
    });
  });



  describe("process jobs by channel", function () {
    // Note the function above, allows access to the mocha context
    // (fat arrow does not)
    // so we can set the test timeout to 10000, and the delay below to 6000.
    this.timeout(10000);

    before(() => {
      adapter.purgeJobs({})
      .then(result => {
        return 0;
      })
    });

    afterEach(() => {
      scheduler.stop();
    });

    it("should emit an event on a designated channel for a onetime job", () => {
      const now = new Date();
      const schedDate = new Date(now.getTime() + 1000 * 3);
      //4 seconds from now.

      const channelName: string = "designated-test123"

      let events:any[] = [];
      scheduler.on(channelName, (eventData: any) => {
        events.push(eventData);
      });

      let jobEvents:any[] = [];
      scheduler.on("jobs", (eventData: any) => {
        jobEvents.push(eventData);
      });

      return scheduler
        .createOnetimeJob("designated-onetime-emit", schedDate, {channel:channelName})
        .then((job: Job) => {
          scheduler.start();
        })
        .then(() => {
          return delay(5000);
        })
        .then(() => {
          scheduler.stop();
          scheduler.removeAllListeners();
          expect(events.length).to.be(1);
          expect(jobEvents.length).to.be(0);
        });
    });

    // it("should emit events for a recurring job", () => {

    //   let events = [];
    //   scheduler.on("jobs", (eventData: any) => {
    //     // console.log(eventData);
    //     events.push(eventData);
    //   });

    //   return scheduler
    //     .createRecurringJob("onetime-emit", "*/5 * * * * *")
    //     .then((job: Job) => {
    //       scheduler.start();
    //     })
    //     .then(() => {
    //       return delay(25000);
    //     })
    //     .then(() => {
    //       scheduler.stop();
    //       scheduler.removeAllListeners();
    //       expect(events.length).to.be.greaterThan(3);
    //       expect(events.length).to.be.lessThan(6);
    //     });
    // });
  });

});
