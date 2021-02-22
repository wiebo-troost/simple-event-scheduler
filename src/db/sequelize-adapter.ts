import { DataTypes, Model, Op, Sequelize } from "sequelize";
import { DBAdapter, Job } from ".";


export interface SequelizeAdapterOptions {
  /**
   * Specify the name of the table that is used for persisting job event schedules.
   */
  tablename?: string; 
}

/**
 * @class JobsModel
 * Sequelize model for the jobs table
 */
class JobsModel extends Model<Job> { }

  /**
   * @class SequelizeAdapter
   * @extends DBAdapter
   * Implements all the functions needed for the scheduler to maintain
   * and persist the job records.
   */
class SequelizeAdapter extends DBAdapter{

    constructor(private sequelize: Sequelize, options?:SequelizeAdapterOptions){ 
        super();
        const opts = options || {}
        this.initModel(opts);
    }
    
    private initModel(opts: SequelizeAdapterOptions){
        opts.tablename = opts.tablename || 'job';
        
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
                  channel: {
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
                  lastRunTime: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                  },
                  startDate: {
                    type: DataTypes.DATE,
                  },
                  endDate: {
                    type: DataTypes.DATE,
                  },
                  params: {
                    type: DataTypes.STRING
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

    
    public purgeJobs(query: any): Promise<number> {// eslint-disable-line
        return JobsModel.destroy({where: query})
        .then(result => {
            return result;
        });
    } 

    /**
     * Loads the jobs from the database that need to be emitted in the given interval.
     * @param loadIntervalSeconds {number} The number of seconds until the next call to this method.
     */
    public loadJobs(loadIntervalSeconds:number):Promise<Job[]>{

      const now = new Date();
      const runtimeCutoff = new Date(now.getTime() + (loadIntervalSeconds * 1000));

      const qry = {
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

    /**
     * This method attempts to update the lastRunTime of the Job to the current timestamp
     * using the currently known value in the where clause. If no other server running the scheduler
     * has updated the record already, then this update will succeed and the updated Job is returned in the promise.
     * In that case the scheduler will emit an event for the Job.
     * However if the update fails, then no events will be emitted for this job until it is reloaded in the next 
     * database load interval.
     * @param job {Job} 
     * @return {Promise<Job | null>}
     */
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

    public findJobByName(name: string):Promise<Job | null> {
      return JobsModel.findOne({
        where: {name}
      })
      .then(result => {
        let j:Job | null = null;
        if (result) {
          j = result.toJSON() as Job;
        }
        return j;
      })
    }

    public removeJobByName(name: string):Promise<boolean> {
      return JobsModel.destroy({
        where: {name}
      })
      .then(result => {
        const ret:boolean = result == 1;
        return ret;
      })
    }
}

export { SequelizeAdapter };
