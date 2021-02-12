
export interface Job {
    id: number | null;
    name: string;
    active?: boolean;
    crontab?: string;
    nextRunAt?: Date | null;
    intervalSeconds?: string;
    lastRunAt?: Date;
    startDate?: Date | number | null;
    endDate?: Date | number | null;
  }
  
  export abstract class DBAdapter {
    public abstract createJob(job: Job): Promise<Job>;
    public abstract purgeJobs(query: any): Promise<number>;
  }
  