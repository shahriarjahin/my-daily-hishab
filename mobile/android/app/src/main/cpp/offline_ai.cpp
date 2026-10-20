#include <jni.h>
#include "llama.h"
#include <chrono>
#include <mutex>
#include <string>
#include <vector>
#include <algorithm>
#include <stdexcept>

namespace {
std::mutex mutex;
llama_model * model = nullptr;
std::string loaded;
using Clock = std::chrono::steady_clock;
bool expired(void * data) { return Clock::now() > *static_cast<Clock::time_point *>(data); }
std::string utf8(JNIEnv *env, jbyteArray value) {
    const auto n=env->GetArrayLength(value); std::string s(n,'\0');
    env->GetByteArrayRegion(value,0,n,reinterpret_cast<jbyte*>(s.data())); return s;
}
void error(JNIEnv *env,const char *message) { env->ThrowNew(env->FindClass("java/lang/IllegalStateException"),message); }
void quiet(enum ggml_log_level, const char *, void *) {} // Never log user prompts or generated finance text.
}
extern "C" JNIEXPORT void JNICALL Java_com_digitxbd_hishab_OfflineAi_release(JNIEnv *, jclass) {
    std::lock_guard<std::mutex> lock(mutex);if(model)llama_model_free(model);model=nullptr;loaded.clear();
}
extern "C" JNIEXPORT jbyteArray JNICALL Java_com_digitxbd_hishab_OfflineAi_generate(JNIEnv *env,jclass,jbyteArray pathBytes,jbyteArray promptBytes) {
    std::lock_guard<std::mutex> lock(mutex);
    llama_context *ctx=nullptr;llama_sampler *sampler=nullptr;
    try {
        llama_log_set(quiet,nullptr);
        const std::string path=utf8(env,pathBytes),prompt=utf8(env,promptBytes);
        if(prompt.size()>12000)throw std::runtime_error("Keep offline entries short.");
        static bool initialized=false;if(!initialized){llama_backend_init();initialized=true;}
        if(!model||loaded!=path){if(model)llama_model_free(model);model=nullptr;loaded.clear();auto p=llama_model_default_params();p.n_gpu_layers=0;model=llama_model_load_from_file(path.c_str(),p);if(!model)throw std::runtime_error("Could not load offline model. Check available memory.");loaded=path;}
        auto deadline=Clock::now()+std::chrono::seconds(60);
        auto p=llama_context_default_params();p.n_ctx=2048;p.n_batch=256;p.n_ubatch=128;p.n_threads=4;p.n_threads_batch=4;p.abort_callback=expired;p.abort_callback_data=&deadline;
        ctx=llama_init_from_model(model,p);if(!ctx)throw std::runtime_error("Not enough memory for offline AI.");
        const auto vocab=llama_model_get_vocab(model);
        const int n=-llama_tokenize(vocab,prompt.data(),prompt.size(),nullptr,0,true,true);
        if(n<=0||n>1400)throw std::runtime_error("Use a shorter entry for offline AI.");
        std::vector<llama_token> tokens(n);if(llama_tokenize(vocab,prompt.data(),prompt.size(),tokens.data(),n,true,true)<0)throw std::runtime_error("Could not read the entry.");
        for(int pos=0;pos<n;pos+=256){auto batch=llama_batch_get_one(tokens.data()+pos,std::min(256,n-pos));if(llama_decode(ctx,batch)!=0)throw std::runtime_error("Offline AI timed out or could not process this entry.");}
        sampler=llama_sampler_init_greedy();std::string output;bool complete=false;
        for(int i=0;i<384;++i){
            if(expired(&deadline))throw std::runtime_error("Offline AI timed out. Try a shorter entry.");
            auto token=llama_sampler_sample(sampler,ctx,-1);
            if(llama_vocab_is_eog(vocab,token)){complete=true;break;}
            char buffer[1024];int count=llama_token_to_piece(vocab,token,buffer,sizeof(buffer),0,false);
            if(count<0)throw std::runtime_error("Offline AI output could not be decoded.");
            output.append(buffer,count);
            auto batch=llama_batch_get_one(&token,1);if(llama_decode(ctx,batch)!=0)throw std::runtime_error("Offline AI stopped. No records were changed.");
        }
        if(!complete)throw std::runtime_error("Entry is too complex. Split it into smaller entries.");
        llama_sampler_free(sampler);sampler=nullptr;llama_free(ctx);ctx=nullptr;
        auto result=env->NewByteArray(output.size());env->SetByteArrayRegion(result,0,output.size(),reinterpret_cast<const jbyte*>(output.data()));return result;
    }catch(const std::exception &e){if(sampler)llama_sampler_free(sampler);if(ctx)llama_free(ctx);error(env,e.what());return nullptr;}
}
