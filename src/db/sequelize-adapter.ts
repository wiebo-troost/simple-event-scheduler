import { DataTypes, Model, Sequelize } from "sequelize";
import { DBAdapter, Job } from ".";

class JobsModel extends Model<Job> implements Job {
    id!: number | null;
    name!: string;
    active?: boolean;
    crontab?: string;
    nextRunAt?: Date | null;
    intervalSeconds?: string;
    lastRunAt?: Date;
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
        // this.jobsModel = this.sequelize.define(
        //     opts.modelname,
        //     {
        //       // Model attributes are defined here
        //       id: {
        //         type: DataTypes.INTEGER,
        //         allowNull: false,
        //         primaryKey: true,
        //         autoIncrement: true
        //       },
        //       name: {
        //         type: DataTypes.STRING,
        //       },
        //       active: {
        //         type: DataTypes.SMALLINT,
        //       },
        //       crontab: {
        //         type: DataTypes.STRING,
        //       },
        //       nextRunAt: {
        //         type: DataTypes.DATE,
        //       },
        //       intervalSeconds: {
        //         type: DataTypes.INTEGER,
        //       },
        //       lastRunAt: {
        //         type: DataTypes.DATE,
        //       },
        //       startDate: {
        //         type: DataTypes.DATE,
        //       },
        //       endDate: {
        //         type: DataTypes.DATE,
        //       }
        //     },
        //     {
        //       tableName: opts.tablename,
        //       timestamps: false
        //     }
        //   );
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
                    type: DataTypes.SMALLINT,
                  },
                  crontab: {
                    type: DataTypes.STRING,
                  },
                  nextRunAt: {
                    type: DataTypes.DATE,
                  },
                  intervalSeconds: {
                    type: DataTypes.INTEGER,
                  },
                  lastRunAt: {
                    type: DataTypes.DATE,
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
        .then((jobModel: any) => {
            const j:Job = jobModel.dataValues;
            return j;
        })
    }

    public purgeJobs(query: any): Promise<number> {
        return JobsModel.destroy({where: query})
        .then(result => {
            return result;
        });
    } 

}

export { SequelizeAdapter };
