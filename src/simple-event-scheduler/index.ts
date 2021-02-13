import parser from "cron-parser";
import createDebug from "debug";
import delay from "delay";
import { EventEmitter } from "events";
import { DBAdapter, Job } from "../db";
import { SequelizeAdapter } from "../db/sequelize-adapter";

const debug = createDebug('simple-scheduler')

export interface JobOptions {
    startDate?: Date,
    endDate?:Date
}

/**
 *  SimpleEventScheduler is an event emitter that
 *  creates recurring and one-time jobs
 */
class SimpleEventScheduler extends EventEmitter {

    private _startDate: Date;
    private _running:boolean = false;
    private _dbLoadIntervalSeconds: number = 10;
    private _lastDbLoadTime: number;

    private currentJobs: Job[];

    /**
   * Constructs a new Scheduler object.
   * @param adapter {DBAdapter} The database adapter to be used for persisting the schedule.
   */
    constructor(private adapter: DBAdapter){
        super();
        this.currentJobs = [];
        this._startDate = new Date();
        this._lastDbLoadTime = this._startDate.getTime() - (this._dbLoadIntervalSeconds * 1000) - 1;
    }

    private getNextRunFromCron(cronexp: string): Date {
        const cronOptions:any = {
            currentDate: new Date()
        }
        const interval = parser.parseExpression(cronexp, cronOptions);
        const ret = new Date(interval.next().getTime());
        // [1,2,3].map(() => {
        //     const d = new Date(interval.next().getTime());
        //     debug(`interval next ${d.toString()}`);
        // }) 
        // debug(` **************************************************** nextRunAt: ${ret.toString()}`);
        return ret;
    }

    private createDefaultJob(name: string, options:JobOptions):Job {
        const j: Job = {
            id: -1,
            name,
            active:true,
            lastRunTime: (new Date()).getTime()
        };
        j.startDate = options.startDate || new Date();
        j.endDate = options.endDate;

        return j
    }

    /**
     * 
     * @param name The name of the new bjo
     * @param cronexp The cron expression that governs when it runs
     * @param options {JobOptions} optional values to be applied to the new Job
     */
    createRecurringJob(name:string, cronexp: string, options: JobOptions = {}):Promise<Job>{
        
        if (!cronexp) {
            throw new Error("crontab is required for creating a recurring job");
        }

        const j = this.createDefaultJob(name, options);

        try {
            
            j.cronexp = cronexp;
            j.nextRunAt = this.getNextRunFromCron(cronexp);

        } catch(e) {
            debug(`Invalid cron expression ${e}`);
            throw new Error("Invalid cron expression");
        }


        return this.adapter.createJob(j);

    }

    createOnetimeJob(name:string, runAt: Date, options:JobOptions = {}): Promise<Job> {

        const j = this.createDefaultJob(name, options);
        j.nextRunAt = runAt;

        return this.adapter.createJob(j);
    }

    start(){
        debug("starting");
        
        
        this._running = true;
        this.run();
    }
    
    stop() {
        debug("stopping");
        //sets a flag that prevents the next timeout
        this._running = false;
    }

    run() {
        this.loadJobsIfNeeded()
        .then(() => {
            return this.processJobs()
        })
        .then(() => {
            return delay.range(500,900)
        })
        .catch(err => {
            debug("error in run ", err);
            return;
        })
        .finally(() => {
            if (this._running){
                setTimeout(() => {
                    this.run();
                },100);
            }
        })
    }

    
    private loadJobsIfNeeded():Promise<void>{

        
        return Promise.resolve()
        .then(() => {
            if (this.needToLoadJobs()){
                this._lastDbLoadTime = (new Date()).getTime();
                debug("Loading Jobs from DB");
                return this.adapter.loadJobs(this._dbLoadIntervalSeconds)
                .then(jobs => {
                    this.currentJobs = jobs.sort((a,b) => a.nextRunAt!.getTime() - b.nextRunAt!.getTime())
                })
                
            } else {
                // debug("Loading Jobs *NOT* Needed");
                return;
            }
        })
    }

    private processJobs(): Promise<any> {
        const now = (new Date()).getTime()
        // debug(`process tick ${now}` );
        return Promise.resolve()
        .then(() => {
            // debug(`current Jobs Count: ${this.currentJobs.length} `);
            this.currentJobs.map(async (job) => {
                if (job.nextRunAt!.getTime() < now) {
                    await this.processOneJob(job)
                    .catch(err => {
                        debug("Error processing job: ", err);
                        console.log(err);
                    });
                }
            })
        })
    }

    private processOneJob(job:Job){

        this.calcNextRun(job);
        //debug(`job.nextRun after ${job.nextRunAt}`)

        return this.adapter.claimJobRun(job)
        .then((updatedJob:Job | null) => {
            const ix = this.currentJobs.findIndex(j => j.id === job.id);
            if (ix >= 0){
                this.currentJobs.splice(ix,1);
            } else {
                debug("error replacing the updatedJob in the internal array. Job not found");
            }
            if (updatedJob) {
                debug("emitting for job ")
                this.emit("job", job);
                //now replace the job in the array
                this.currentJobs.push(updatedJob); 
                // debug(`next ${this.currentJobs[0].nextRunAt?.getSeconds()} and now ${(new Date()).getSeconds()}`); 
            } else {
                debug("unable to claim, removing job from this server's list")
                //remove the job from the array,another server has it now.
                //we'll load it again on the next db load.
            }
        });
        
    }

    private needToLoadJobs(): boolean {
        let ret = false;
        const now = (new Date()).getTime();

        return now > (this._lastDbLoadTime + (this._dbLoadIntervalSeconds * 1000));
    }

    private calcNextRun(job: Job){
        if (!job.cronexp) {
            job.active = false;
            job.nextRunAt = null;
            return;
        }

        job.nextRunAt = this.getNextRunFromCron(job.cronexp);
        return;
    }

}

export { SimpleEventScheduler, SequelizeAdapter, DBAdapter };
