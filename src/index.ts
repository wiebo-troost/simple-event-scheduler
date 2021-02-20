import parser from "cron-parser";
import createDebug from "debug";
import delay from "delay";
import { EventEmitter } from "events";
import { DBAdapter, Job } from "./db";
import { SequelizeAdapter } from "./db/sequelize-adapter";

const debug = createDebug('simple-scheduler')


/**
 * Declares the options that can be specified for creating a new job schedule
 */
export interface JobOptions {
    startDate?: Date;
    endDate?:Date;
    channel?:string;
}

/**
 * Declares the options that can be specified for instantiating a simple event scheduler.
 */
export interface SchedulerOptions {
    defaultChannelName?: string;
    dbLoadIntervalSeconds?: number;
    emittingChannels?: string[]
}

/**
 *  SimpleEventScheduler is an event emitter that
 *  creates recurring and one-time jobs
 */
class SimpleEventScheduler extends EventEmitter {

    private _startDate: Date;
    private _running = false;
    private schedulerOptions: SchedulerOptions;
    private _lastDbLoadTime: number;

    private currentJobs: Job[];

    /**
   * Constructs a new Scheduler object.
   * @param adapter The database adapter to be used for persisting the schedule.
   * @param options Optional SchedulerOptions to change the defaults as needed.
   */
    constructor(private adapter: DBAdapter, options: SchedulerOptions = {}){
        super();
        this.schedulerOptions = {
            defaultChannelName: options.defaultChannelName || "jobs",
            dbLoadIntervalSeconds: options.dbLoadIntervalSeconds || 10,
            emittingChannels: options.emittingChannels
        }
        this.currentJobs = [];
        this._startDate = new Date();
        this._lastDbLoadTime = this._startDate.getTime() - ((this.schedulerOptions.dbLoadIntervalSeconds) as number * 1000) - 1;
    }

    /**
     * Calculate the next runtime for the give cron expression
     * @param cronexp 
     */
    private getNextRunFromCron(cronexp: string): Date {
        const cronOptions = {
            currentDate: new Date()
        }
        const interval = parser.parseExpression(cronexp, cronOptions);
        const ret = new Date(interval.next().getTime());
        return ret;
    }

    /**
     * Common method, called by both createRecurringJob and createOnetimeJob. Creates and returns a 
     * Promise of the Job record with the default values applied.
     * Rejects the Promise when the job name already exists in the database.
     * @param name 
     * @param options 
     */
    private createDefaultJob(name: string, options:JobOptions):Promise<Job> {
        const j: Job = {
            id: -1,
            name,
            channel: options.channel || this.schedulerOptions.defaultChannelName,
            active:true,
            lastRunTime: (new Date()).getTime()
        };
        j.startDate = options.startDate || new Date();
        j.endDate = options.endDate;

        return this.adapter.findJobByName(name)
        .then((val:Job | null) => {
            if (val) {
                throw new Error("Duplicate job")
            }
            else {
                return j
            }
        })

    }

    /**
     * Create a new recurring job using the given name and cron expression. 
     * Throws an Error (rejects the promise) if the name is a duplicate in the database.
     * @param name The name of the new bjo
     * @param cronexp The cron expression that governs when it runs
     * @param options {JobOptions} optional values to be applied to the new Job
     */
    createRecurringJob(name:string, cronexp: string, options: JobOptions = {}):Promise<Job>{
        
        if (!cronexp) {
            throw new Error("cron expression is required for creating a recurring job");
        }

        let nextRunDt: Date;
        try {
            
            // j.cronexp = cronexp;
            nextRunDt = this.getNextRunFromCron(cronexp);
            
        } catch(e) {
            debug(`Invalid cron expression ${e}`);
            throw new Error("Invalid cron expression");
        }

        return this.createDefaultJob(name, options)
        .then((j:Job) => {
            j.nextRunAt = nextRunDt;
            j.cronexp = cronexp;
            return this.adapter.createJob(j);
        });

    }

    /**
     * Create a 'One Time' job to be executed at the given date.
     * Rejects the Promise if the name is a duplicate in the database.
     * @param name 
     * @param runAt 
     * @param options 
     */
    createOnetimeJob(name:string, runAt: Date, options:JobOptions = {}): Promise<Job> {

        return this.createDefaultJob(name, options)
        .then((j: Job) => {
            j.nextRunAt = runAt;
            return this.adapter.createJob(j);
        })

    }

    /**
     * Removes the given job from the database, and from the internally cached jobs, so it will not be 
     * emitted again.
     * @param name the name of the job to be removed.
     */
    removeJobByName(name:string):Promise<boolean> {
        return this.adapter.removeJobByName(name)
        .then((result:boolean) => {
            //also remove the job from memory so it won't execute again before the next dbLoad. 
            const ix = this.currentJobs.findIndex(j => j.name === name);
            if (ix >= 0){
                this.currentJobs.splice(ix,1);
            }
            return result;
        });
    }

    /**
     * Start emitting job events as needed
     */
    start():void{
        debug("starting");
        
        //reset the last db load time, so we'll load the jobs from the db on the first .run()
        this._lastDbLoadTime = this._startDate.getTime() - ((this.schedulerOptions.dbLoadIntervalSeconds) as number * 1000) - 1;
        
        this._running = true;
        this.run();
    }
    /**
     * Stop emitting job events.
     */
    stop():void {
        debug("stopping");
        //sets a flag that prevents the next timeout
        this._running = false;
    }

    /**
     * Load the jobs into memory if the DB load time interval has elapsed, 
     * then emit an event for all the jobs that need to be emitted. This is based on their next
     * scheduled time, and channel specifications.
     * 
     * Finally set a timeout to call this method again on a slightly randomized delay. The randomization
     * is needed to ensure the job load is evenly shared by multiple schedulers active on a single
     * pool of jobs.
     */    
    private run():void {
        
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

    /**
     * Reload the jobs in memory from the datbase if the load interval has elapsed.
     */
    private loadJobsIfNeeded():Promise<void>{

        
        return Promise.resolve()
        .then(() => {
            if (this.needToLoadJobs()){
                this._lastDbLoadTime = (new Date()).getTime();
                debug("Loading Jobs from DB");
                return this.adapter.loadJobs(this.schedulerOptions.dbLoadIntervalSeconds as number)
                .then(jobs => {
                    this.currentJobs = jobs;
                })
                
            } else {
                // debug("Loading Jobs *NOT* Needed");
                return;
            }
        })
    }

    /**
     * One time loop though all the jobs in memory. Calls processOneJob
     * if the scheduler has not been stopped, and the job's next runAt is now. 
     */
    private processJobs(): Promise<void> {
        const now = (new Date()).getTime()
        // debug(`process tick ${now}` );
        return Promise.resolve()
        .then(() => {
            // debug(`current Jobs Count: ${this.currentJobs.length} `);
            this.currentJobs.map(async (job) => {
                if (job.nextRunAt && job.nextRunAt.getTime() < now && this._running) {// eslint-disable-line
                    await this.processOneJob(job)
                    .catch(err => {
                        debug("Error processing job: ", err);
                        console.log(err);
                    });
                }
            });
            return;
        })
    }

    /**
     * First claim the job with an acid transaction in the database. If we're not successful with
     * that then the job was claimed by another instance. We will remove it from the internal cache until
     * we reload from the db. (The cache is now stale).
     * If we are successfully claimning the job, then we're updating the job in the database with the next
     * runAt time with the same 'claim' transaction, after which we go ahead and emit the event as configured.
     * @param job 
     */
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
                let doEmit = true;
                if (this.schedulerOptions.emittingChannels && this.schedulerOptions.emittingChannels.length > 0 ) {
                    const channelIx = this.schedulerOptions.emittingChannels.findIndex(c => c === job.channel);
                    doEmit = (channelIx >= 0);
                }
                if (doEmit) {
                    this.emit(job.channel as string, job);
                }
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

    /**
     * Calculate if the dbload interval has elapsed. Returns true if it has.
     */
    private needToLoadJobs(): boolean {
        const now = (new Date()).getTime();

        return now > (this._lastDbLoadTime + (this.schedulerOptions.dbLoadIntervalSeconds as number * 1000));
    }

    /**
     * Calculate the next runAt time for a recurring job, or set it to inactive 
     * if the job is not recurring.
     * @param job 
     */
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

export { SimpleEventScheduler, SequelizeAdapter, DBAdapter, Job };
