
/**
 * @interface Job
 */
export interface Job {
    id: number | null;
    name: string;
    channel?: string;
    active?: boolean;
    cronexp?: string;
    nextRunAt?: Date | null;
    intervalSeconds?: string;
    lastRunTime?: number;
    startDate?: Date | number | null;
    endDate?: Date | number | null;
  }

  export abstract class DBAdapter {

    /**
     * Insert a new job into the database
     * @param job {Job}
     */
    public abstract createJob(job: Job): Promise<Job>;

    /**
     * Delete jobs from the database that match the query. This method is not used
     * by the scheduler, it is available as a convenience method for the user.  
     * @param query The query that selects the job records to be deleted. This 
     * argument must be applicable to sequelize, it is applied to the `where` property 
     * of the options object.
     */
    public abstract purgeJobs(query: any): Promise<number>;
    
    public abstract loadJobs(loadIntervalSeconds:number): Promise<Job[]>;
    
    public abstract claimJobRun(job: Job): Promise<Job | null>;

    public abstract findJobByName(name: string): Promise<Job |null>;

    public abstract removeJobByName(name: string): Promise<boolean>;
  }
  