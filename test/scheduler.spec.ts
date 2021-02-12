import 'mocha';
import expect from "expect.js";
import { SimpleScheduler } from '../src/simple-scheduler';
import { DBAdapter } from '../src/db';
import { SequelizeAdapter } from '../src/db/sequelize-adapter'

describe("Create the scheduler", () => {

    let adapter: DBAdapter;
    let scheduler: SimpleScheduler;
    before(() => {
        adapter = new SequelizeAdapter();
        scheduler = new SimpleScheduler(adapter);
    })

    it("should instantiate", () => {
        const runtime = scheduler.runtimeMs();
        expect(runtime).to.be.greaterThan(-1);
    });

    it("should create a recurring job", async () => {
        const job = await scheduler.createRecurringJob("rec1","* * 2")
        expect(job.name).to.be("rec1");
    });
})