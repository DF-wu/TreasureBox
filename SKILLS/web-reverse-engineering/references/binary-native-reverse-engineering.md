# Binary and Native Reverse Engineering

When the target's security logic lives in compiled binaries (desktop apps, native mobile libraries, WASM modules), you need binary RE skills. This is the deepest layer—descend here only when higher layers fail.

## When to Use Binary RE

| Scenario | Approach |
|---|---|
| Native mobile library (.so, .dylib) handles signing | ARM analysis + Frida hooking |
| Desktop app has no web API | Local binary analysis |
| Browser extension or WASM module | WASM decompilation or JS bridge hooking |
| Electron app bundles Node.js | ASAR extraction + source access (often easier) |
| .NET/Mono application | dnSpy/ILSpy for IL decompilation |
| Java application | jadx/jd-gui for bytecode decompilation |
| Python application (frozen/packaged) | pyinstxtractor + uncompyle6 |

## Quick Identification

```bash
# File type
file target_binary

# Strings (quick intel)
strings -n 8 target_binary | grep -i -E "(api|key|token|secret|https|http)"

# Dependencies
ldd target_binary        # Linux
otool -L target_binary   # macOS
dependencywalker         # Windows

# Entropy check (packed/encrypted?)
ent target_binary
```

## Tool Selection by Platform

| Platform | Free | Commercial | Best for |
|---|---|---|---|
| Windows PE | x64dbg, Ghidra, CFF Explorer | IDA Pro, Binary Ninja | Dynamic debugging, malware |
| Linux ELF | Ghidra, radare2, GDB | IDA Pro | Server binaries, CTF |
| macOS Mach-O | Ghidra, radare2, Hopper (eval) | Hopper, IDA Pro | Apple ecosystem |
| Android ARM | Ghidra, radare2 | IDA Pro, JEB | Mobile native libraries |
| iOS ARM64 | Ghidra, radare2 | Hopper, IDA Pro | iOS apps |
| .NET/Mono | dnSpy, ILSpy, dotPeek | Reflector, IDA | C# decompilation |
| Java | jadx, jd-gui, Recaf | JEB | APK, JAR |
| WASM | wasm2wat, wabt | Ghidra WASM | Browser modules |

## Ghidra Quick Start

```bash
# Analyze binary
ghidraRun
# File -> Import -> target_binary
# Analyze (accept defaults)
# Navigate to functions, decompile
```

Key Ghidra features:
- **Decompiler**: Converts assembly to C-like pseudocode
- **Function graph**: Visual control flow
- **Scripting**: Python/Java for automation
- **Type recovery**: Reconstruct structs and function signatures

## radare2 Quick Start

```bash
r2 -A target_binary
# -A = analyze at startup

[0x00000000]> ii    # imports
[0x00000000]> iS    # sections
[0x00000000]> afl   # function list
[0x00000000]> s main  # seek to main
[0x00000000]> pdf   # print disassembly of function
[0x00000000]> pdc   # decompile (basic)
[0x00000000]> V     # visual mode (hex/disasm/graph)
```

## Common Patterns to Find

| Goal | Search patterns |
|---|---|
| Crypto keys | Strings near `AES`, `RSA`, `HMAC`, `SHA256` |
| API endpoints | Hardcoded URLs, `curl_easy_setopt` |
| Anti-debug | `ptrace`, `IsDebuggerPresent`, timing checks |
| Environment checks | `CPUID`, `cpuid`, registry reads |
| Network protocol | `socket`, `connect`, `send`, `recv` |
| Serialization | `protobuf`, `json`, `msgpack`, `bson` |

## Dynamic Analysis

### x64dbg (Windows)

1. Open target executable
2. Set breakpoints on known API calls (Ctrl+G → `CryptEncrypt`, `send`, `recv`)
3. Run and trace execution
4. Inspect registers and stack at breakpoints
5. Modify behavior in real time

### GDB + PEDA/GEF/pwndbg

```bash
gdb ./target
b main
run
info registers
x/10gx $rsp
stepi
continue
```

### Frida for dynamic instrumentation

```javascript
// Hook crypto function
Interceptor.attach(Module.findExportByName(null, "EVP_EncryptInit_ex"), {
  onEnter: function(args) {
    console.log("EVP_EncryptInit_ex called");
    console.log("Key:", hexdump(args[2], {length: 32}));
    console.log("IV:", hexdump(args[3], {length: 16}));
  }
});
```

## .NET / Mono Decompilation

```bash
# dnSpy (Windows GUI, gold standard)
# Open DLL/EXE, browse classes, edit IL in-place

# ILSpy (cross-platform)
dotnet tool install ilspycmd -g
ilspycmd target.dll -o output_dir

# dotPeek (JetBrains, free)
```

## Python Frozen Applications

```bash
# PyInstaller extraction
pip install pyinstxtractor
python pyinstxtractor.py target.exe

# Then decompile .pyc
pip install uncompyle6
uncompyle6 target.pyc > target.py
```

## WASM Analysis

```bash
# Convert to WAT (text format)
wasm2wat target.wasm -o target.wat

# Decompile to C-like
wasm-decompile target.wasm -o target.c

# Or load in Ghidra with WASM plugin
```

Key WASM patterns:
- JavaScript bridge functions (imported from JS)
- Memory layout and data sections
- Call graph from JS entry points

## Electron / NW.js Applications

```bash
# Extract ASAR
npx asar extract app.asar app_dir

# Source is often unobfuscated JS
# Look for:
# - main process code
# - renderer preload scripts
# - Bundled Node modules

# Sometimes better-source-maps exist
# Check for .js.map files
```

## Network Protocol RE

When binary implements a custom protocol:

1. Capture traffic with Wireshark/tcpdump
2. Identify handshake pattern
3. Find serialization/deserialization functions in binary
4. Map field types (length-prefix, varint, fixed-width)
5. Reconstruct message schema
6. Write client in your language of choice

Common serialization:
- Protobuf: `0x08` varint field markers
- MessagePack: `0x81`-`0x8f` map headers
- BSON: `0x00` terminated documents
- Custom: Look for length fields and magic bytes

## Operational Notes

- Binary RE is slow. Budget hours or days, not minutes.
- Start with strings and imports before diving into disassembly.
- Dynamic analysis often beats static analysis for understanding behavior.
- For legal safety, only RE binaries you own or have rights to analyze.
- Document everything: addresses, function names, findings.

Binary RE is the court of last resort. Use it when no API, no web interface, and no mobile interception yields results.
