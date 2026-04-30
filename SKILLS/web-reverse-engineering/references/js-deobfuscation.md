# JavaScript Deobfuscation and Dynamic Analysis

When target sites load obfuscated JavaScript challenge scripts, you need to reverse them to understand signature generation, token mechanisms, or API call sequences.

## Obfuscation Types

| Type | Signature | Approach |
|---|---|---|
| Minification | Single-letter variables, no whitespace | Prettier/Beautify restores readability |
| String encryption | Hex/octal/Unicode escapes | Decrypt at runtime, capture output |
| Control flow flattening | `switch` state machine | AST-based control flow restoration |
| Dead code injection | Unreachable branches | AST pruning |
| Self-defending | Anti-tampering checks | Patch checks or hook `Function.prototype.toString` |
| Virtual machine | Custom bytecode interpreter | Trace VM execution, extract opcodes |
| Domain-locked | `location.host` checks | Override `window.location` before script runs |
| Time-limited | Date-based expiration | Freeze `Date.now()` or override `new Date()` |

## Tool Chain

### Level 1: Surface Cleaning

```bash
# Prettier for minified code
npx prettier --write obfuscated.js

# js-beautify for older/minified bundles
npx js-beautify -f obfuscated.js -o clean.js

# de4js web UI for quick inspection
# https://lelinhtinh.github.io/de4js/
```

### Level 2: AST-Based Deobfuscation

```javascript
// Babel-based deobfuscation pipeline
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const t = require("@babel/types");

const code = fs.readFileSync("obfuscated.js", "utf8");
const ast = parser.parse(code, { sourceType: "script" });

traverse(ast, {
  // Example: fold constant string concatenations
  BinaryExpression(path) {
    if (t.isStringLiteral(path.node.left) && t.isStringLiteral(path.node.right)) {
      path.replaceWith(t.stringLiteral(path.node.left.value + path.node.right.value));
    }
  }
});

fs.writeFileSync("deobfuscated.js", generate(ast).code);
```

Common Babel transforms:
- **Constant folding**: evaluate `1 + 2` → `3`
- **String decryption**: find decrypt function, call it at build time
- **Dead code elimination**: remove unreachable branches
- **Control flow simplification**: unflatten state machines

### Level 3: Dynamic Extraction

When static analysis fails, run the script in a controlled environment and intercept outputs.

```javascript
// Hook console.log to capture intermediate values
const originalLog = console.log;
console.log = function(...args) {
  fs.appendFileSync("intercepted.txt", args.join(" ") + "\n");
  return originalLog.apply(this, args);
};

// Hook common obfuscation patterns
const origToString = Function.prototype.toString;
Function.prototype.toString = function() {
  fs.appendFileSync("functions.txt", origToString.call(this) + "\n---\n");
  return origToString.call(this);
};
```

### Level 4: VM/Bytecode Analysis

For custom VM obfuscators (common in Webpack, some commercial protectors):

1. Identify the VM dispatch loop (usually a `while(true)` + `switch`)
2. Extract the bytecode array
3. Trace execution to build opcode-to-behavior map
4. Write a decoder that translates bytecode back to JS

Tools:
- `de4js` handles some commercial obfuscators (javascript-obfuscator)
- `syncat` for syncfusion-style obfuscation
- Custom scripts for domain-specific VMs

## Practical Workflow

```text
1. Load target page in browser
2. Find obfuscated script in Sources panel
3. Save to file
4. Try prettier/js-beautify first
5. If still unreadable, load in AST explorer (astexplorer.net)
6. Identify encryption/decryption patterns
7. Write Babel transform or dynamic hook
8. Extract the cleartext algorithm
9. Reimplement in your target language
```

## Common Target Patterns

| What you need | Where to look |
|---|---|
| API signing algorithm | XHR/fetch interceptors, before-send hooks |
| Session token refresh | Cookie setters, `document.cookie` assignments |
| Fingerprint generation | Canvas/WebGL context calls, `navigator` property reads |
| Bot challenge solver | `eval`, `Function`, `setTimeout` with string arguments |
| Anti-debug triggers | `debugger` statements, `console` clear calls |

## Browser-Based Dynamic Analysis

```javascript
// Override key globals before challenge script loads
Object.defineProperty(window, "_0x1234", {
  get() { return this.__secret; },
  set(v) {
    console.log("Secret set:", v);
    this.__secret = v;
  }
});

// Freeze Date to bypass time checks
const frozen = new Date("2024-01-01");
Date.now = () => frozen.getTime();
```

## When to Stop

- You have extracted the algorithm you need
- Further deobfuscation yields no new actionable signals
- Time cost exceeds value of understanding (use managed API instead)

Deobfuscation is time-expensive. Use it for recurring high-value targets, not one-off scrapes.
