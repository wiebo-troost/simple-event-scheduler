
export interface Job {
    id: number | null;
    name: string;
    active?: boolean;
    cronexp?: string;
    nextRunAt?: Date | null;
    intervalSeconds?: string;
    lastRunTime?: number;
    startDate?: Date | number | null;
    endDate?: Date | number | null;
  }
  
  export abstract class DBAdapter {
    public abstract createJob(job: Job): Promise<Job>;
    public abstract purgeJobs(query: any): Promise<number>;
    public abstract loadJobs(loadIntervalSeconds:number): Promise<Job[]>;
    public abstract claimJobRun(job: Job): Promise<Job | null>;
  }
  