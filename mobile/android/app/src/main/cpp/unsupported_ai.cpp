#include <jni.h>
extern "C" JNIEXPORT void JNICALL Java_com_digitxbd_hishab_OfflineAi_release(JNIEnv *,jclass) {}
extern "C" JNIEXPORT jbyteArray JNICALL Java_com_digitxbd_hishab_OfflineAi_generate(JNIEnv *env,jclass,jbyteArray,jbyteArray) {
    env->ThrowNew(env->FindClass("java/lang/IllegalStateException"),"Offline AI requires a 64-bit phone.");return nullptr;
}
