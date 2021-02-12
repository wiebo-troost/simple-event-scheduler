import { DataTypes, Model, Op, Sequelize } from "sequelize";
import { DBAdapter, Job } from ".";

class JobsModel extends Model<Job> implements Job {
    id!: number | null;
    name!: string;
    active?: boolean;
    crontab?: string;
    nextRunAt?: Date | null;
    intervalSeconds?: string;
    lastRunTime?: number;
    startDate?: Date | number | null;
    endDate?: Date | number | null;
  }

class SequelizeAdapter extends DBAdapter{

    private options: any;
    

    constructor(private sequelize: Sequelize, options?:any){
        super();
        const opts = options || {}
        this.initModel(opts);
    }
    
    private initModel(opts: any){
        opts.tablename = opts.tablename || 'job';
        opts.modelname = opts.modelname || 'JobsModel';
        this.options = opts;
        
        JobsModel.init(
                {
                  // Model attributes are defined here
                  id: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    primaryKey: true,
                    autoIncrement: true
                  },
                  name: {
                    type: DataTypes.STRING,
                  },
                  active: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                  },
                  cronexp: {
                    type: DataTypes.STRING,
                  },
                  nextRunAt: {
                    type: DataTypes.DATE,
                  },
                  intervalSeconds: {
                    type: DataTypes.INTEGER,
                  },
                  lastRunTime: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                  },
                  startDate: {
                    type: DataTypes.DATE,
                  },
                  endDate: {
                    type: DataTypes.DATE,
                  }
                },
                {
                  sequelize: this.sequelize,
                  tableName: opts.tablename,
                  timestamps: false
                }
        );
    }

    public createJob(job: Job): Promise<Job> {
        // return Promise.resolve(job);
        if (job.id == -1){
            job.id = null;
        }
        return JobsModel.create(job)
        .then((jobModel) => {
            // console.log("toString", jobModel.toJSON());
            const j:Job = jobModel.toJSON() as Job;
            return j;
        })
    }

    public purgeJobs(query: any): Promise<number> {
        return JobsModel.destroy({where: query})
        .then(result => {
            return result;
        });
    } 

    public loadJobs(loadIntervalSeconds:number):Promise<Job[]>{

      const now = new Date();
      const runtimeCutoff = new Date(now.getTime() + (loadIntervalSeconds * 1000));

      const qry:any = {
        where:{
          active:true,
          nextRunAt: {[Op.lte]: runtimeCutoff},
          startDate: {[Op.lte]: now},
          [Op.or]: [
            {endDate: {[Op.gte]: now}},
            {endDate: {[Op.is]: null}},
          ]
        }
      }

      return JobsModel.findAll(qry)
      .then(models => {
        return models.map(m => m.toJSON() as Job)
      });
    }

    public claimJobRun(job: Job): Promise<Job | null>{
      //update the job with the new data, using the lastRuntime
      //in the query, if the updateCount == 1, means this server claimed
      // the run, if updateCount == 0 another scheduler server has it.
      const lastRunTime = job.lastRunTime;
      job.lastRunTime = (new Date()).getTime();

      return JobsModel.update(job,
        {
          where:{
            id: job.id,
            lastRunTime: lastRunTime
          }
        }
        )
        .then(result => {
          let ret: Job | null = null;
          if (result[0] == 1) {
            ret = job;
          }
          return ret;
        });
    }
}

export { SequelizeAdapter };
