import "mocha";
import expect from "expect.js";
import { SimpleScheduler } from "../src/simple-scheduler";
import { DBAdapter } from "../src/db";
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
  });

  let adapter: DBAdapter;
  let scheduler: SimpleScheduler;
  before(() => {
    return sequelize
    .authenticate()
    .then(() => {
      console.log("Connection has been established successfully.");
      adapter = new SequelizeAdapter(sequelize);
      scheduler = new SimpleScheduler(adapter);
    }).then(() => {
        return adapter.purgeJobs({});
    })
    .catch((err) => {
      console.error("Unable to connect to the database:", err);
    });
  });

  

  it("should instantiate", () => {
    const runtime = scheduler.runtimeMs();
    expect(runtime).to.be.greaterThan(-1);
  });

  it("should create a recurring job", async () => {
    const job = await scheduler.createRecurringJob("rec1", "30 */15 * * * *");
    expect(job.name).to.be("rec1");
    expect(job.id).to.be.greaterThan(0);
    expect(job.nextRunAt).to.be.a(Date);
  });
});
