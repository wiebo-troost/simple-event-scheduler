# Simple Event Scheduler

There are a few scheduler solutions avaiable, but few that meet the requirements for 
a microservices 12 factor app.

What you're looking for is a solution that can scale up with your application. Is adaptable to 
many different configuration scenarios, guarantees single delivery of scheduled events, and recovers
from unscheduled down time.

Typically you don't actualy need the scheduler to execute the job, merely receiving the event that 
a job needs to be executed is much better. You already have a fully configured server runtime environment, there is no need to replicate that to a 'job-runner'. If you're in the situation that
you a long running job that consumes a large amount of resources, this scheduler offers the flexibility to run those jobs in a dedicated environment. So it's the best of both worlds! 

# Getting Started
Install the scheduler with `npm install simple-event-scheduler`.
Please refer to the [documentation](https://binaryops-wiebo.github.io/simple-event-scheduler/) for all the details.
# Persistent jobs

The 'jobs' are stored in the database. Database adapters are used to persist the job data in the database of
your choice. When many instances of the scheduler are active in your landscape, the ACID transaction on the 
job record governs which instance gets to emit the event.

# Usage

The Simple Event Scheduler relies on the configuration of its runtime environment. Therefore you need to instantiate a database
adapter with a database connection. The adapter is then passed into the scheduler. In the case of the SequelizeAdapter, you pass in a sequelize instance. 

```
const adapter = new SequelizeAdapter(sequelize);
const scheduler = new SimpleEventScheduler(adapter);

scheduler.start(); //start as needed
scheduler.stop();  //stop as needed.

```

Upon start, the scheduler will load the active jobs from the database. It will periodically go back to the 
database, to synchronize with any potential other scheduler instances. The frequency of database access is configurable.

## Creating Jobs
The scheduler supports one-time jobs, that execute at a given time, and recurring jobs. The recurring jobs are created with a cron expression. Internally cron-parser is used to calculate the next required run date and time of the job.

```
const now = new Date();
const schedDate = new Date(now.getTime() + 1000 * 60 * 60 * 24);
schedDate.setHours(15, 0, 0, 0); //tomorrow at 3pm
return scheduler
    .createOnetimeJob("onetimer1", schedDate)
```      

```
// every 5 seconds
return scheduler
        .createRecurringJob("recurring-emit", "*/5 * * * * *")
```
## Listening to events
By default the scheduler emits all the events, for all the jobs.
```
scheduler.on("jobs", (eventData: any) => {
    //call your function here.
});

```

The string literal "jobs" is the default channel name for events. This default can be changed using the options passed into the scheduler.

The channel for a given job can also be changed using the options passed into the job creation method.

```
//create a job on the `myemail` channel and setup a listener
return scheduler
    .createOnetimeJob("onetimer1", schedDate, {channel:'myemail'})

scheduler.on("myemail",  (eventData: any) => {
    //call your function here.
});
```


## Spread the load by filtering the emitted channels
You can configure the scheduler to only emit jobs for one or a few channels. This facilitates the case where you have some jobs that consume a large amount of resources, or need to be executed in a seperate environment for another reason.

In the example below, only `month-end` and and `log-archive` events are emitted from that scheduler instance. 

```
const scheduler = new SimpleEventScheduler(adapter, {emittingChannels:['month-end', 'log-archive']});
```


# Need Support?
Simple Event Scheduler is developed and maintained by [BinaryOps Software Inc.](https://binaryops.ca) in Canada.


