package com.digitxbd.hishab;

import android.content.Context;
import android.graphics.*;
import android.graphics.pdf.PdfDocument;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/** Read-only offline PDF rendering; Android's document picker owns the destination. */
final class StatementPdf {
    private static final int WIDTH=595, HEIGHT=842, LEFT=34, BOTTOM=772;
    private static final int GREEN=Color.rgb(22,61,50), INK=Color.rgb(25,44,38), MUTED=Color.rgb(102,113,107);
    private static final int[] COLUMNS={64,62,209,64,64,64};
    private static final String[] KEYS={"date","reference","description","debit","credit","balance"};
    static String text(JSONObject value,String key,int maximum) throws Exception {
        Object raw=value.opt(key);
        if(!(raw instanceof String)||((String)raw).length()>maximum)throw new IllegalArgumentException("Invalid statement field: "+key);
        return (String)raw;
    }
    static void validate(JSONObject value) throws Exception {
        for(String key:new String[]{"name","wallet","generated"})text(value,key,160);
        text(value,"currency",8);
        for(String key:new String[]{"start","end"})if(!text(value,key,10).matches("\\d{4}-\\d{2}-\\d{2}"))throw new IllegalArgumentException("Check the statement dates.");
        for(String key:new String[]{"opening","closing","debit","credit"})amount(value,key);
        JSONArray rows=value.getJSONArray("rows");
        if(rows.length()>100100)throw new IllegalArgumentException("Choose a shorter statement period.");
        for(int i=0;i<rows.length();i++){
            JSONObject row=rows.getJSONObject(i);text(row,"date",32);text(row,"reference",32);text(row,"description",600);
            for(String key:new String[]{"debit","credit","balance"})amount(row,key);
        }
    }
    private static String amount(JSONObject value,String key) throws Exception {
        String s=text(value,key,64);
        if(!s.matches("-?\\d{1,3}(,\\d{3})*\\.\\d{2}"))throw new IllegalArgumentException("Check the statement amounts.");
        return s;
    }
    private static final class Row {
        final StaticLayout[] cells=new StaticLayout[6]; final int height; final boolean bold;
        Row(String[] values,Typeface font,boolean emphasized){
            bold=emphasized;int high=0;
            for(int i=0;i<6;i++){
                TextPaint paint=new TextPaint(Paint.ANTI_ALIAS_FLAG);paint.setTypeface(font);paint.setTextSize(8);paint.setColor(INK);
                cells[i]=StaticLayout.Builder.obtain(values[i],0,values[i].length(),paint,COLUMNS[i]-8)
                    .setAlignment(i>=3?Layout.Alignment.ALIGN_OPPOSITE:Layout.Alignment.ALIGN_NORMAL).setIncludePad(false).build();
                high=Math.max(high,cells[i].getHeight());
            }
            height=Math.max(28,high+14);
        }
    }
    private static void line(Canvas c,float x,float y,String value,Typeface font,float size,int color){
        Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);p.setTypeface(font);p.setTextSize(size);p.setColor(color);c.drawText(value,x,y,p);
    }
    private static void right(Canvas c,float x,float y,String value,Typeface font,float size,int color){
        Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);p.setTypeface(font);p.setTextSize(size);p.setColor(color);p.setTextAlign(Paint.Align.RIGHT);c.drawText(value,x,y,p);
    }
    private static void paragraph(Canvas c,float x,float y,String value,int width,Typeface font,int size){
        TextPaint p=new TextPaint(Paint.ANTI_ALIAS_FLAG);p.setTypeface(font);p.setTextSize(size);p.setColor(INK);
        StaticLayout layout=StaticLayout.Builder.obtain(value,0,value.length(),p,width).setIncludePad(false).build();
        c.save();c.translate(x,y);layout.draw(c);c.restore();
    }
    private static Bitmap image(Context context,String file) throws Exception {
        BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=2;
        try(java.io.InputStream input=context.getAssets().open("public/static/"+file)){
            Bitmap result=BitmapFactory.decodeStream(input,null,options);
            if(result==null)throw new IllegalStateException("Statement logo is unavailable.");
            return result;
        }
    }
    private static void image(Canvas c,Bitmap bitmap,float x,float y,float width,float height){
        float scale=Math.min(width/bitmap.getWidth(),height/bitmap.getHeight());
        c.drawBitmap(bitmap,null,new RectF(x,y,x+bitmap.getWidth()*scale,y+bitmap.getHeight()*scale),new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG));
    }
    static void write(Context context,JSONObject body,OutputStream output) throws Exception {
        validate(body);
        Typeface normal=Typeface.createFromAsset(context.getAssets(),"public/static/NotoSansBengali-400.ttf");
        Typeface bold=Typeface.createFromAsset(context.getAssets(),"public/static/NotoSansBengali-600.ttf");
        List<Row> records=new ArrayList<>();
        records.add(new Row(new String[]{"","","BALANCE AT PERIOD START","","",body.getString("opening")},bold,true));
        JSONArray data=body.getJSONArray("rows");
        for(int i=0;i<data.length();i++){
            JSONObject entry=data.getJSONObject(i);String[] values=new String[6];
            for(int k=0;k<6;k++)values[k]=entry.getString(KEYS[k]);records.add(new Row(values,normal,false));
        }
        if(data.length()==0)records.add(new Row(new String[]{"","","No transactions in this period.","","",""},normal,false));
        records.add(new Row(new String[]{"","","TOTAL / CLOSING BALANCE",body.getString("debit"),body.getString("credit"),body.getString("closing")},bold,true));
        List<List<Row>> pages=new ArrayList<>();List<Row> current=new ArrayList<>();pages.add(current);int cursor=278;
        for(Row row:records){
            if(cursor+row.height>BOTTOM){current=new ArrayList<>();pages.add(current);cursor=130;}
            current.add(row);cursor+=row.height;
        }
        Bitmap logo=image(context,"hishab-logo-v2.png"),credit=null;
        PdfDocument document=new PdfDocument();
        try{
            credit=image(context,"digitxbd-logo.png");
            for(int index=0;index<pages.size();index++){
                PdfDocument.Page page=document.startPage(new PdfDocument.PageInfo.Builder(WIDTH,HEIGHT,index+1).create());
                Canvas c=page.getCanvas();c.drawColor(Color.WHITE);
                image(c,logo,LEFT,25,55,55);line(c,102,43,"HISHAB",Typeface.DEFAULT_BOLD,17,GREEN);
                line(c,102,58,"PERSONAL FINANCE",Typeface.DEFAULT,8,GREEN);
                right(c,561,43,"ACCOUNT STATEMENT",Typeface.DEFAULT_BOLD,12,GREEN);
                right(c,561,59,body.getString("start")+" to "+body.getString("end"),Typeface.DEFAULT,8,GREEN);
                if(index==0){
                    paragraph(c,LEFT,108,"ACCOUNT TITLE",82,bold,8);paragraph(c,126,108,body.getString("name"),195,normal,8);
                    paragraph(c,340,108,"CURRENCY",66,bold,8);paragraph(c,414,108,body.getString("currency"),140,normal,8);
                    paragraph(c,LEFT,140,"WALLET",82,bold,8);paragraph(c,126,140,body.getString("wallet"),195,normal,8);
                    paragraph(c,340,140,"GENERATED",66,bold,8);paragraph(c,414,140,body.getString("generated"),140,normal,8);
                    Paint background=new Paint();background.setColor(Color.rgb(237,244,240));c.drawRect(LEFT,177,561,239,background);
                    String[] labels={"Opening balance","Money out (debit)","Money in (credit)","Closing balance"};
                    String[] keys={"opening","debit","credit","closing"};
                    for(int k=0;k<4;k++){paragraph(c,LEFT+7+k*132,187,labels[k],117,bold,8);paragraph(c,LEFT+7+k*132,213,body.getString(keys[k]),117,bold,8);}
                    line(c,LEFT,256,"STATEMENT FOR THE PERIOD: "+body.getString("start")+" to "+body.getString("end"),Typeface.DEFAULT_BOLD,8,GREEN);
                }
                int top=index==0?262:114;Paint rule=new Paint();rule.setColor(GREEN);rule.setStrokeWidth(.7f);c.drawLine(LEFT,top,561,top,rule);
                String[] headings={"Date / time","Reference","Description","Debit","Credit","Balance"};int x=LEFT;
                for(int k=0;k<6;k++){line(c,x+4,top+11,headings[k],Typeface.DEFAULT_BOLD,8,GREEN);x+=COLUMNS[k];}
                c.drawLine(LEFT,top+16,561,top+16,rule);cursor=top+16;
                int stripe=0;
                for(Row row:pages.get(index)){
                    if(!row.bold&&stripe++%2==0){Paint bg=new Paint();bg.setColor(Color.rgb(247,249,248));c.drawRect(LEFT,cursor,561,cursor+row.height,bg);}
                    if(row.bold)c.drawLine(LEFT,cursor,561,cursor,rule);
                    x=LEFT;
                    for(int k=0;k<6;k++){c.save();c.translate(x+4,cursor+7);row.cells[k].draw(c);c.restore();x+=COLUMNS[k];}
                    cursor+=row.height;
                }
                rule.setColor(Color.rgb(205,211,208));c.drawLine(LEFT,790,561,790,rule);image(c,credit,LEFT,801,80,28);
                line(c,132,808,"Computer-generated personal finance statement. No signature required.",Typeface.DEFAULT,6,MUTED);
                line(c,132,818,"Generated by Hishab. Not a bank-issued statement. Times: Asia/Dhaka.",Typeface.DEFAULT,6,MUTED);
                right(c,561,808,"Page "+(index+1)+" of "+pages.size(),Typeface.DEFAULT,7,MUTED);
                document.finishPage(page);
            }
            document.writeTo(output);
        }finally{document.close();logo.recycle();if(credit!=null)credit.recycle();}
    }
}
