
export interface Job {
    id: number;
    name: string;
    active?: boolean;
    crontab?: string;
    nextRunAt?: Date | null;
    intervalSeconds?: string;
    lastRunAt?: Date;
    startDate?: Date | number | null;
    endDate?: Date | number | null;
    lastModifiedBy?: string;
  }
  
  export abstract class DBAdapter {
    public abstract createJob(job: Job): Promise<Job>;
  }
  