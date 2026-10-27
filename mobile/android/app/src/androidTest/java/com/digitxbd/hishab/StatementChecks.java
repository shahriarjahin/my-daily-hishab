package com.digitxbd.hishab;

import android.app.Instrumentation;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.os.ParcelFileDescriptor;
import org.json.JSONObject;
import org.json.JSONArray;
import java.io.File;
import java.io.FileOutputStream;

/** Synthetic PDF only; no account login, network calls or ledger writes. */
final class StatementChecks {
    private static String evaluate(Instrumentation instrumentation,MainActivity activity,String script) throws Exception {
        java.util.concurrent.CountDownLatch done=new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.atomic.AtomicReference<String> result=new java.util.concurrent.atomic.AtomicReference<>();
        instrumentation.runOnMainSync(()->activity.getBridge().getWebView().evaluateJavascript(script,value->{result.set(value);done.countDown();}));
        if(!done.await(3,java.util.concurrent.TimeUnit.SECONDS))throw new AssertionError("Native PDF UI did not respond");
        return result.get();
    }
    static int run(Instrumentation instrumentation) throws Exception {
        android.content.Context context=instrumentation.getTargetContext();
        JSONObject model=new JSONObject().put("name","Demo User / পরীক্ষামূলক নাম").put("wallet","All wallets (combined)").put("currency","BDT")
            .put("start","2026-09-27").put("end","2026-10-27").put("generated","2026-10-27 22:00:00 (Dhaka)")
            .put("opening","10,000.00").put("closing","7,000.00").put("debit","3,000.00").put("credit","0.00");
        JSONArray rows=new JSONArray();
        for(int i=0;i<120;i++)rows.put(new JSONObject().put("date","2026-10-"+String.format(java.util.Locale.ROOT,"%02d",i%27+1)+"\n10:15:00")
            .put("reference",String.format(java.util.Locale.ROOT,"TX-%06d",i+1)).put("description",i%2==0?"দুপুরের খাবার / Food / Cash":"Demo purchase / Shopping / Bank")
            .put("debit","25.00").put("credit","0.00").put("balance",String.format(java.util.Locale.ROOT,"%,.2f",10000-(i+1)*25.0)));
        model.put("rows",rows);
        File file=new File(context.getExternalFilesDir(null),"statement-native-test.pdf");
        try(FileOutputStream output=new FileOutputStream(file)){StatementPdf.write(context,model,output);}
        if(file.length()<1000)throw new AssertionError("PDF output is missing");
        int pages;
        try(ParcelFileDescriptor descriptor=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);PdfRenderer renderer=new PdfRenderer(descriptor)){
            pages=renderer.getPageCount();if(pages<3)throw new AssertionError("Multi-page statement was not paginated");
            try(PdfRenderer.Page page=renderer.openPage(0)){
                Bitmap bitmap=Bitmap.createBitmap(page.getWidth()*2,page.getHeight()*2,Bitmap.Config.ARGB_8888);
                page.render(bitmap,null,null,PdfRenderer.Page.RENDER_MODE_FOR_PRINT);
                int header=0,footer=0;
                for(int y=50;y<160;y++)for(int x=68;x<178;x++)if(bitmap.getPixel(x,y)!=Color.WHITE)header++;
                for(int y=1600;y<1660;y++)for(int x=68;x<228;x++)if(bitmap.getPixel(x,y)!=Color.WHITE)footer++;
                if(header<100||footer<50)throw new AssertionError("Statement logos are missing");
                try(FileOutputStream preview=new FileOutputStream(new File(context.getExternalFilesDir(null),"statement-native-preview.png"))){bitmap.compress(Bitmap.CompressFormat.PNG,100,preview);}
                bitmap.recycle();
            }
        }
        JSONObject invalid=new JSONObject(model.toString());invalid.put("start","../../invalid");
        boolean rejected=false;try{StatementPdf.validate(invalid);}catch(Exception expected){rejected=true;}
        if(!rejected)throw new AssertionError("Invalid export date was accepted");
        File picked=new File(context.getCacheDir(),"statement-picker-test.pdf");
        if(picked.exists()&&!picked.delete())throw new AssertionError("Cannot reset synthetic export");
        android.content.IntentFilter filter=new android.content.IntentFilter(android.content.Intent.ACTION_CREATE_DOCUMENT);
        filter.addCategory(android.content.Intent.CATEGORY_OPENABLE);filter.addDataType("application/pdf");
        Instrumentation.ActivityMonitor monitor=instrumentation.addMonitor(filter,new Instrumentation.ActivityResult(android.app.Activity.RESULT_OK,
            new android.content.Intent().setData(android.net.Uri.fromFile(picked))),true);
        try{
            MainActivity activity=(MainActivity)instrumentation.startActivitySync(new android.content.Intent(context,MainActivity.class).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK));
            boolean ready=false;
            for(int i=0;i<100&&!ready;i++){ready="true".equals(evaluate(instrumentation,activity,"Boolean(window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Hishab)"));if(!ready)Thread.sleep(100);}
            if(!ready)throw new AssertionError("Native statement transport unavailable");
            String script="window.__statementCheck='pending';window.Capacitor.Plugins.Hishab.execute({op:'statement',body:JSON.parse("+JSONObject.quote(model.toString())+")}).then(()=>window.__statementCheck='saved').catch(()=>window.__statementCheck='failed');true";
            evaluate(instrumentation,activity,script);
            boolean saved=false;
            for(int i=0;i<100&&!saved;i++){String status=evaluate(instrumentation,activity,"window.__statementCheck");if("\"failed\"".equals(status))throw new AssertionError("PDF picker callback failed");saved="\"saved\"".equals(status);if(!saved)Thread.sleep(100);}
            if(!saved||monitor.getHits()!=1||picked.length()<1000)throw new AssertionError("Native PDF save-document flow failed");
            instrumentation.runOnMainSync(activity::finish);
        }finally{instrumentation.removeMonitor(monitor);}
        return pages;
    }
}
