import { DBAdapter, Job } from "../db";


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

        const j: Job = {
            id: -1,
            name
        }

        return this.adapter.createJob(j);

    }

}

export {SimpleScheduler}