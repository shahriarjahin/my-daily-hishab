package com.digitxbd.hishab;
import android.app.job.JobParameters;
import android.app.job.JobService;
public final class SyncJob extends JobService {
    @Override public boolean onStartJob(JobParameters params){try{Runtime r=Runtime.get(this);r.network.execute(()->{try{r.sync();jobFinished(params,false);}catch(Exception e){jobFinished(params,true);}});return true;}catch(Exception e){return false;}}
    @Override public boolean onStopJob(JobParameters params){return true;}
}
