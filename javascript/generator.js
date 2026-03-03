
#!/usr/bin/env node
// random-js-generator.js
// Creates JS files with generated code for a random topic, deletes when
// they reach 200 lines, then restarts with a new topic.

const fs = require('fs').promises;
const realFs = require('fs');
const path = require('path');
const { exec } = require('child_process'); 
const { promisify } = require('util');
const execAsync = promisify(exec);

const OUTPUT_DIR = path.join(process.cwd(), 'generated_js');
// If TARGET_FILE is specified (env or first arg), append to that file instead
// default to a safe generated file so we don't touch main bot files
const TARGET_FILE = process.env.TARGET_FILE || process.argv[2] || 'src/generator/activity-log.js';
const TOPICS = ['math', 'string', 'array', 'date', 'crypto', 'dom', 'network', 'logger', 'utils', 'async'];

function randChoice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function randInt(max){ return Math.floor(Math.random()*max); }
function randomString(len){ return Math.random().toString(36).slice(2, 2+len); }

function generateLine(topic, i){
  const r = randInt(1000);
  switch(randInt(6)){
    case 0: return `// ${topic}: comment ${i}`;
    case 1: return `const ${topic}Var${i} = ${JSON.stringify(randomString(8))};`;
    case 2: return `function ${topic}Fn${i}(){ return ${JSON.stringify(r)}; }`;
    case 3: return `const ${topic}Arr${i} = [${randInt(10)}, ${randInt(10)}, ${randInt(10)}];`;
    case 4: return `console.log('${topic} line ${i} ->', ${topic}Var${Math.max(0, i-1)} || ${JSON.stringify(r)});`;
    default: return `// noop`;
  }
}

async function run(){
  await fs.mkdir(OUTPUT_DIR, {recursive: true});
  // Register cleanup handlers to remove the single-file heartbeat when the
  // process exits so the project doesn't keep the heartbeat file logged.
  const resolvedTarget = TARGET_FILE ? path.resolve(process.cwd(), TARGET_FILE) : null;
  let currentCyclePath = null; // Track current file path for cleanup
  let currentBackgroundInterval = null; // Track background interval for cleanup
  
  function safeDeleteTarget(){
    try{
      // Delete the current cycle file if it exists
      if(currentCyclePath && realFs.existsSync(currentCyclePath)){
        realFs.unlinkSync(currentCyclePath);
        console.log(`[${new Date().toLocaleTimeString()}] Cleanup: deleted ${currentCyclePath}`);
      }
      // Also delete the target file if specified
      if(resolvedTarget && realFs.existsSync(resolvedTarget)){
        realFs.unlinkSync(resolvedTarget);
        console.log(`[${new Date().toLocaleTimeString()}] Cleanup: deleted ${resolvedTarget}`);
      }
    }catch(e){
      console.warn('Cleanup: could not delete target file:', e && e.message ? e.message : e);
    }
  }
  
  function cleanupAndExit(code = 0) {
    // Stop background refresh if running
    if (currentBackgroundInterval) {
      clearInterval(currentBackgroundInterval);
      currentBackgroundInterval = null;
    }
    safeDeleteTarget();
    process.exit(code);
  }
  
  process.on('SIGINT', () => { cleanupAndExit(0); });
  process.on('SIGTERM', () => { cleanupAndExit(0); });
  process.on('uncaughtException', (err) => { 
    console.error('Uncaught exception:', err); 
    cleanupAndExit(1); 
  });
  process.on('exit', () => { cleanupAndExit(0); });
  while(true){
    const topic = randChoice(TOPICS);
    const target = 200; // Fixed target of 200 lines
    let filename;
    let fullpath;
    
    if(TARGET_FILE){
      fullpath = path.resolve(process.cwd(), TARGET_FILE);
      filename = path.basename(fullpath);
      console.log(`\n[${new Date().toLocaleTimeString()}] Starting fresh cycle: ${fullpath} | Topic: ${topic} | Target: ${target} lines`);
      // Ensure parent dir exists
      await fs.mkdir(path.dirname(fullpath), {recursive: true});
    }else{
      filename = `${Date.now()}-${randomString(6)}.js`;
      fullpath = path.join(OUTPUT_DIR, filename);
      console.log(`\n[${new Date().toLocaleTimeString()}] Starting file: ${filename} | Topic: ${topic} | Target: ${target} lines`);
    }

    // Always start fresh - completely clear and recreate the file
    try{
      if(realFs.existsSync(fullpath)){
        await fs.unlink(fullpath);
        console.log(`[${new Date().toLocaleTimeString()}] Cleared existing file: ${filename}`);
      }
    }catch(e){
      // Ignore if file doesn't exist
    }
    
    // Wait a moment to ensure file system operations complete
    await new Promise(r => setTimeout(r, 100));
    
    // Set current cycle path for cleanup
    currentCyclePath = fullpath;
    
    // Create fresh file with header and IIFE using writeFile (not appendFile)
    const header = `// Topic: ${topic} - ${new Date().toISOString()}\n(function(){\n`;
    await fs.writeFile(fullpath, header, 'utf8');
    
    // Force sync to ensure file is created
    try {
      const fd = realFs.openSync(fullpath, 'r+');
      realFs.fsyncSync(fd);
      realFs.closeSync(fd);
    } catch(e) {}

    let lines = 2; // Header and IIFE opening count as 2 lines
    let i = 0;
    let isActive = true; // Flag to control background refresh loop
    
    // Function to force refresh file for WakaTime detection
    async function refreshFileForWakaTime() {
      try {
        if (!realFs.existsSync(fullpath)) return;
        
        const content = realFs.readFileSync(fullpath, 'utf8');
        const lines_array = content.split(/\r?\n/);
        
        // Update header line with new timestamp (triggers change detection)
        if (lines_array.length > 0 && lines_array[0].startsWith('// Topic:')) {
          lines_array[0] = `// Topic: ${topic} - ${new Date().toISOString()}`;
        }
        
        const newContent = lines_array.join('\n');
        
        // Method 1: Write file multiple times with variations to trigger events
        for (let attempt = 0; attempt < 3; attempt++) {
          realFs.writeFileSync(fullpath, newContent);
          const fd = realFs.openSync(fullpath, 'r+');
          realFs.fsyncSync(fd);
          realFs.closeSync(fd);
          await new Promise(r => setTimeout(r, 50));
          
          // Update mtime repeatedly
          const now = new Date();
          realFs.utimesSync(fullpath, now, now);
          await new Promise(r => setTimeout(r, 30));
        }
        
        // Method 2: Use touch command via exec (triggers inotify events)
        try {
          await execAsync(`touch "${fullpath}"`, { timeout: 2000 });
        } catch (touchErr) {}
        
        // Method 3: chmod touch for metadata events
        try {
          const mode = realFs.statSync(fullpath).mode;
          realFs.chmodSync(fullpath, mode);
        } catch (chmodErr) {}
        
        // Method 4: Final aggressive utimes with delays
        for (let i = 0; i < 5; i++) {
          realFs.utimesSync(fullpath, new Date(), new Date());
          await new Promise(r => setTimeout(r, 20));
        }
        
      } catch (err) {
        // Silent fail - refresh is best-effort
      }
    }
    
    // Continuous background refresh loop - runs independently every 2 seconds
    // This keeps WakaTime active by updating file content (timestamp in header)
    // WakaTime needs actual content changes, not just metadata updates
    const BACKGROUND_REFRESH_INTERVAL = 3000; // 2 seconds - frequent but safe
    let isWriting = false; // Simple flag to prevent race conditions
    const backgroundRefreshLoop = setInterval(() => {
      if (!isActive || !realFs.existsSync(fullpath) || isWriting) return;
      
      try {
        // Read current file content
        const content = realFs.readFileSync(fullpath, 'utf8');
        const lines = content.split(/\r?\n/);
        
        // Only update if we have a header line to update
        if (lines.length > 0 && lines[0].startsWith('// Topic:')) {
          // Update timestamp in header - this creates actual content change for WakaTime
          lines[0] = `// Topic: ${topic} - ${new Date().toISOString()}`;
          const newContent = lines.join('\n');
          
          // Write back the updated content (fast, synchronous write)
          realFs.writeFileSync(fullpath, newContent, 'utf8');
          
          // Force sync to disk
          const fd = realFs.openSync(fullpath, 'r+');
          realFs.fsyncSync(fd);
          realFs.closeSync(fd);
        }
        
        // Also update metadata for extra triggers
        const now = new Date();
        realFs.utimesSync(fullpath, now, now);
        
      } catch (err) {
        // Silent fail - background refresh is best-effort
      }
    }, BACKGROUND_REFRESH_INTERVAL);
    
    // Store background interval reference for cleanup
    currentBackgroundInterval = backgroundRefreshLoop;
    
    while(lines < target){
      // Write exactly 2 lines every 2 seconds
      const batch = [];
      for(let j = 0; j < 2 && lines < target; j++){
        batch.push(generateLine(topic, i++));
        lines++;
      }
      const data = batch.join('\n') + '\n';
      
      // Set writing flag to prevent background refresh interference
      isWriting = true;
      
      try{
        // Append with sync write - this creates actual content change for WakaTime
        const fd = realFs.openSync(fullpath, 'a');
        realFs.writeSync(fd, data);
        realFs.fsyncSync(fd); // Force sync to disk
        realFs.closeSync(fd);
        
        // Read and rewrite to trigger "change" event (not just "append")
        // This helps WakaTime detect the modification
        const currentContent = realFs.readFileSync(fullpath, 'utf8');
        realFs.writeFileSync(fullpath, currentContent, 'utf8');
        
        // Force sync again after rewrite
        const fd2 = realFs.openSync(fullpath, 'r+');
        realFs.fsyncSync(fd2);
        realFs.closeSync(fd2);
        
        // Update mtime to trigger WakaTime detection
        const now = new Date();
        realFs.utimesSync(fullpath, now, now);
        
        // Verify the write actually happened
        const stats = realFs.statSync(fullpath);
        if (stats.size === 0) {
          throw new Error('File write failed - file is empty');
        }
        
      }catch(e){
        console.error(`[${new Date().toLocaleTimeString()}] Write error: ${e.message}`);
        // Fallback to async append
        try {
          await fs.appendFile(fullpath, data);
          const now = new Date();
          await fs.utimes(fullpath, now, now);
        } catch(fallbackErr) {
          console.error(`[${new Date().toLocaleTimeString()}] Fallback write also failed: ${fallbackErr.message}`);
        }
      } finally {
        isWriting = false;
      }
      
      console.log(`[${new Date().toLocaleTimeString()}] Writing to ${filename}: +${batch.length} lines (${lines}/${target})`);

      // Wait 1.5 seconds between batches for more frequent updates
      // Background refresh also runs every 2 seconds to keep WakaTime active
      await new Promise(r => setTimeout(r, 1500));
    }
    
    // Append closing IIFE
    await fs.appendFile(fullpath, '})();\n');
    lines++;
    console.log(`[${new Date().toLocaleTimeString()}] ✓ File complete: ${filename} (${lines} lines total)`);

    // Verify line count
    await new Promise(r => setTimeout(r, 250));
    try{
      const content = await fs.readFile(fullpath, 'utf8');
      const parts = content.split(/\r?\n/);
      if(parts.length && parts[parts.length-1] === '') parts.pop();
      const physicalLines = parts.length;
      console.log(`[${new Date().toLocaleTimeString()}] Expected lines: ${lines} | Physical lines: ${physicalLines}`);
    }catch(err){
      console.warn('Could not read file to count lines:', err.message || err);
    }

    // Delete the file when it reaches 200 lines (works for both modes)
    const maxRetries = 5;
    let deleted = false;
    for(let attempt = 1; attempt <= maxRetries; attempt++){
      try{
        await fs.unlink(fullpath);
        console.log(`[${new Date().toLocaleTimeString()}] ✓ Deleted ${filename} (attempt ${attempt})`);
        deleted = true;
        break;
      }catch(err){
        console.warn(`[${new Date().toLocaleTimeString()}] Delete attempt ${attempt} failed: ${err.message || err}. Retrying...`);
        await new Promise(r => setTimeout(r, 500));
      }
    }
    if(!deleted){
      console.error(`[${new Date().toLocaleTimeString()}] ✗ Failed to delete ${filename} after ${maxRetries} attempts`);
    }
    
    // Stop background refresh loop before starting next cycle
    if (currentBackgroundInterval) {
      clearInterval(currentBackgroundInterval);
      currentBackgroundInterval = null;
    }
    isActive = false;
    currentCyclePath = null; // Reset for next cycle

    // Brief pause before starting next cycle
    await new Promise(r => setTimeout(r, 1000));
  }
}

run().catch(err => { console.error(err); process.exit(1); });
      

    //ignore      
