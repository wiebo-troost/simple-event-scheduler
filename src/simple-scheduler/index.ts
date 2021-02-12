import { DBAdapter, Job } from "../db";
import parser from "cron-parser";


class SimpleScheduler {

    private _startDate: Date;
    constructor(private adapter: DBAdapter){

        this._startDate = new Date();
    }

    runtimeMs(){
        const now = new Date();
        return now.getTime() - this._startDate.getTime();
    }

    createRecurringJob(name:string, crontab: string):Promise<Job>{

        const cronOptions:any = {
            currentDate: new Date()
        }

        if (!crontab) {
            throw new Error("crontab is required for creating a recurring job");
        }
        const j: Job = {
            id: -1,
            name
        }
        try {
            const interval = parser.parseExpression(crontab, cronOptions);
            j.crontab = crontab;
            j.nextRunAt = new Date(interval.next().getTime());
            [1,2,3].map(e => {
                console.log(new Date(interval.next().getTime()));
                return 1;
            })

        } catch(e) {
            console.log("Invalid crontab", e);
            throw new Error("Invalid crontab");
        }


        return this.adapter.createJob(j);

    }

}

export {SimpleScheduler}