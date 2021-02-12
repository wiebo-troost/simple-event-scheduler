import { DBAdapter, Job } from ".";


class SequelizeAdapter extends DBAdapter{

    public createJob(job: Job): Promise<Job> {
        return Promise.resolve(job);
    }

}

export {SequelizeAdapter}