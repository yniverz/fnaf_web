// Prints the phone call scripts from js/phone.js as JSON (used by generate_calls.py)
const fs = require('fs'), vm = require('vm');
const ctx = { window: { FNAF: { Audio: {} } } };
ctx.FNAF = ctx.window.FNAF;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('path').join(__dirname, '..', 'js', 'phone.js'), 'utf8'), ctx);
process.stdout.write(JSON.stringify(ctx.FNAF.Phone.SCRIPTS));
