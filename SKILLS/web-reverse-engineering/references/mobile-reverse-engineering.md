# Mobile Application Reverse Engineering

Mobile apps often expose simpler APIs than their web counterparts. The reverse engineering pipeline here is distinct from web scraping but shares the same philosophy: start at the highest layer, descend only when necessary.

## Decision Tree

```text
Target is a mobile app
  -> Can you intercept HTTPS traffic with standard proxy?
     -> Yes: Map API endpoints, replicate calls (easiest path)
     -> No: SSL pinning is active
        -> Try Frida/objection to bypass pinning
        -> If that fails, patch APK or use Magisk modules
  -> API calls are signed/encrypted?
     -> Hook crypto functions with Frida to extract keys
     -> Decompile with jadx to find signing logic
  -> Native library (.so) handles security?
     -> Ghidra/radare2 to analyze ARM binary
     -> Frida to hook JNI boundary
```

## Environment Setup

### Android

```bash
# ADB basics
adb devices
adb shell
adb install app.apk
adb logcat | grep -i "target_app"

# Frida server on device
adb push frida-server /data/local/tmp/
adb shell "chmod 755 /data/local/tmp/frida-server"
adb shell "/data/local/tmp/frida-server &"

# objection (Frida wrapper)
pip install objection
objection -g com.target.app explore
```

### iOS

```bash
# Requires jailbroken device or Corellium
# frida-ios-dump for decrypted IPA
pip install frida-tools
frida-ps -U  # list apps on USB-connected device
```

## SSL Pinning Bypass

### Method 1: objection (easiest)

```bash
objection -g com.target.app explore
android sslpinning disable
# or
ios sslpinning disable
```

### Method 2: Frida script

```javascript
// Universal SSL pinning bypass
Java.perform(function () {
  var X509TrustManager = Java.use("javax.net.ssl.X509TrustManager");
  var SSLContext = Java.use("javax.net.ssl.SSLContext");

  var TrustManager = Java.registerClass({
    name: "com.target.bypass.TrustManager",
    implements: [X509TrustManager],
    methods: {
      checkClientTrusted: function () {},
      checkServerTrusted: function () {},
      getAcceptedIssuers: function () { return []; }
    }
  });

  var TrustManagers = [TrustManager.$new()];
  var SSLContext_init = SSLContext.init.overload(
    "[Ljavax/net/ssl/KeyManager;", "[Ljavax/net/ssl/TrustManager;", "Ljava/security/SecureRandom;"
  );
  SSLContext_init.implementation = function (km, tm, random) {
    SSLContext_init.call(this, km, TrustManagers, random);
  };
});
```

### Method 3: Patch APK (last resort)

```bash
# Decompile
apktool d app.apk -o app_dir

# Find and patch pinning logic (search for TrustManager, OkHttp, etc.)
# Then rebuild
apktool b app_dir -o patched.apk
jarsigner -keystore debug.keystore patched.apk alias
```

## Static Analysis

### APK decompilation

```bash
# jadx GUI or CLI
jadx -d output_dir app.apk

# apktool for resources + smali
apktool d app.apk

# GDA (Windows GUI, fast)
# JEB (commercial, most capable)
```

### Key things to find

| Artifact | Search patterns | Tool |
|---|---|---|
| API endpoints | `https://`, `http://`, retrofit annotations | jadx grep |
| API keys | `api_key`, `apikey`, `token`, `secret` | strings / jadx |
| Crypto logic | `Cipher`, `MessageDigest`, `SecretKeySpec` | jadx class tree |
| Native calls | `System.loadLibrary`, `JNI` | jadx + Ghidra |
| Root detection | `su`, `magisk`, `supersu` | grep smali |

## Dynamic Analysis with Frida

### Hook specific class/method

```javascript
Java.perform(function () {
  var TargetClass = Java.use("com.target.app.CryptoUtils");
  TargetClass.signRequest.implementation = function (url, body, timestamp) {
    console.log("URL:", url);
    console.log("Body:", body);
    console.log("Timestamp:", timestamp);
    var result = this.signRequest(url, body, timestamp);
    console.log("Signature:", result);
    return result;
  };
});
```

### Dump network requests

```javascript
Java.perform(function () {
  var OkHttpClient = Java.use("okhttp3.OkHttpClient");
  // Hook interceptors or response body
});
```

## Native Library Analysis

When security logic is in `.so` files:

```bash
# Extract .so from APK
unzip app.apk lib/* -d libs/

# Analyze with Ghidra or radare2
r2 -A libs/arm64-v8a/libtarget.so
# then: ii (imports), iS (sections), afl (functions)

# Or Ghidra GUI for decompilation
```

Frida hook at JNI boundary:

```javascript
Interceptor.attach(Module.findExportByName(null, "Java_com_target_app_Crypto_nativeSign"), {
  onEnter: function (args) {
    console.log("Native sign called");
    console.log("Arg1:", Memory.readUtf8String(args[1]));
  },
  onLeave: function (retval) {
    console.log("Result:", Memory.readUtf8String(retval));
  }
});
```

## iOS Specific

```bash
# Dump decrypted IPA (jailbroken)
frida-ios-dump -u com.target.app -o target.ipa

# Class-dump for headers
class-dump -H target.app -o headers/

# Frida iOS hooking
frida -U -n TargetApp -e "
  var className = 'TargetClass';
  var methodName = '- signRequest:';
  var hook = ObjC.classes[className][methodName];
  Interceptor.attach(hook.implementation, {
    onEnter: function(args) {
      console.log('signRequest called');
    }
  });
"
```

## Replicating Mobile API from Desktop

Once you map the API:

1. Extract all required headers (User-Agent, App-Version, OS-Version, etc.)
2. Reproduce auth flow (often device registration → token)
3. Implement signature/token generation (or use Frida to call native code)
4. Use standard HTTP client with mobile headers

```python
import requests

headers = {
    "User-Agent": "TargetApp/2.1.0 (Android 14; Pixel 7)",
    "X-App-Version": "2.1.0",
    "X-Device-ID": "...",
    "Authorization": "Bearer ...",
    "X-Signature": "...",  # reimplement or intercept from app
}

resp = requests.get("https://api.target.com/v1/feed", headers=headers)
```

## Operational Security

- Use a dedicated test device (don't RE on your daily driver)
- Snapshot/reset the device between sessions
- Some apps detect debuggers, emulators, root; have a bypass strategy ready
- Respect app store policies; this is for your own app's API or public data only

Mobile RE opens APIs that web scraping cannot reach. It is higher effort but often higher reward.
