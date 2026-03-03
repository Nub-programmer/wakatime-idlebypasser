#!/usr/bin/env python3
# random-python-generator.py
# Creates Python files with generated code for a random topic, deletes when
# they reach 200 lines, then restarts with a new topic.

import os
import sys
import time
import random
import string
import signal
import threading
import subprocess
from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path.cwd() / 'generated_py'
# If TARGET_FILE is specified (env or first arg), append to that file instead
# default to a safe generated file so we don't touch main bot files
TARGET_FILE = os.environ.get('TARGET_FILE') or (sys.argv[1] if len(sys.argv) > 1 else None) or 'src/generator/activity-log.py'
TOPICS = ['math', 'string', 'array', 'date', 'crypto', 'dom', 'network', 'logger', 'utils', 'async']

def rand_choice(arr):
    return random.choice(arr)

def rand_int(max_val):
    return random.randint(0, max_val - 1)

def random_string(length):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def generate_line(topic, i):
    r = rand_int(1000)
    switch = rand_int(6)
    if switch == 0:
        return f'# {topic}: comment {i}'
    elif switch == 1:
        return f'{topic}_var_{i} = {repr(random_string(8))}'
    elif switch == 2:
        return f'def {topic}_fn_{i}(): return {repr(r)}'
    elif switch == 3:
        return f'{topic}_arr_{i} = [{rand_int(10)}, {rand_int(10)}, {rand_int(10)}]'
    elif switch == 4:
        prev_var = f'{topic}_var_{max(0, i-1)}' if i > 0 else repr(r)
        return f"print(f'{topic} line {i} ->', {prev_var})"
    else:
        return '# noop'

# Global state for cleanup and refresh
current_cycle_path = None
refresh_thread = None
refresh_stop_event = None
refresh_lock = threading.Lock()

def safe_delete_target(path_to_delete):
    try:
        if path_to_delete and path_to_delete.exists():
            path_to_delete.unlink()
            print(f'[{datetime.now().strftime("%H:%M:%S")}] Cleanup: deleted {path_to_delete}')
    except Exception as e:
        print(f'Cleanup: could not delete target file: {e}')

def cleanup_and_exit(signum=None, frame=None, code=0):
    global refresh_thread, refresh_stop_event
    if refresh_stop_event:
        refresh_stop_event.set()
    if refresh_thread:
        refresh_thread.join(timeout=1.0)
    if current_cycle_path:
        safe_delete_target(current_cycle_path)
    sys.exit(code)

# Register signal handlers
signal.signal(signal.SIGINT, cleanup_and_exit)
signal.signal(signal.SIGTERM, cleanup_and_exit)

def aggressive_refresh_file(fullpath, topic):
    """Ultra-aggressive refresh - MUST write actual content changes for WakaTime"""
    try:
        if not fullpath.exists():
            return
        
        # Read current content
        try:
            content = fullpath.read_text(encoding='utf-8')
        except Exception:
            return
        
        if not content:
            return
        
        lines = content.split('\n')
        if not lines:
            return
        
        # Update header timestamp - THIS creates actual file content change
        if lines[0].startswith('# Topic:'):
            new_timestamp = datetime.now().isoformat()
            old_header = lines[0]
            new_header = f'# Topic: {topic} - {new_timestamp}'
            
            # Only update if different (avoid unnecessary writes, but ensure freshness)
            if old_header != new_header:
                lines[0] = new_header
                new_content = '\n'.join(lines)
                
                # CRITICAL: Write the actual content change
                fullpath.write_text(new_content, encoding='utf-8')
                
                # Force immediate sync
                try:
                    fd = os.open(str(fullpath), os.O_RDWR)
                    os.fsync(fd)
                    os.close(fd)
                except Exception:
                    pass
                
                # Update mtime
                os.utime(str(fullpath), (time.time(), time.time()))
                
                # Use touch command for extra inotify triggers
                try:
                    subprocess.run(['touch', str(fullpath)], timeout=0.5, capture_output=True, check=False)
                except Exception:
                    pass
        
    except Exception:
        # Silent fail
        pass

def continuous_background_refresh():
    """Continuous background refresh - runs every 2 seconds"""
    global current_cycle_path
    
    while not refresh_stop_event.is_set():
        try:
            # Get active path safely
            with refresh_lock:
                active_path = current_cycle_path
            
            # Refresh if file exists
            if active_path and active_path.exists():
                # Extract topic from header
                try:
                    content = active_path.read_text(encoding='utf-8')
                    if content:
                        lines = content.split('\n')
                        if lines and lines[0].startswith('# Topic:'):
                            topic_line = lines[0]
                            parts = topic_line.split(':', 1)
                            if len(parts) > 1:
                                topic_part = parts[1].split('-')[0].strip()
                                topic = topic_part if topic_part else 'utils'
                            else:
                                topic = 'utils'
                        else:
                            topic = 'utils'
                    else:
                        topic = 'utils'
                except Exception:
                    topic = 'utils'
                
                # Aggressive refresh
                aggressive_refresh_file(active_path, topic)
            
        except Exception:
            pass
        
        # Wait 2 seconds
        refresh_stop_event.wait(2.0)

def run():
    global current_cycle_path, refresh_thread, refresh_stop_event
    
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Start continuous background refresh thread
    refresh_stop_event = threading.Event()
    refresh_thread = threading.Thread(
        target=continuous_background_refresh,
        daemon=True
    )
    refresh_thread.start()
    print(f'[{datetime.now().strftime("%H:%M:%S")}] Started background refresh (every 2s)')
    
    while True:
        topic = rand_choice(TOPICS)
        target = 200  # 200 lines
        
        if TARGET_FILE:
            fullpath = Path.cwd() / TARGET_FILE
            filename = fullpath.name
            print(f'\n[{datetime.now().strftime("%H:%M:%S")}] Starting cycle: {fullpath} | Topic: {topic} | Target: {target} lines')
            fullpath.parent.mkdir(parents=True, exist_ok=True)
        else:
            filename = f'{int(time.time() * 1000)}-{random_string(6)}.py'
            fullpath = OUTPUT_DIR / filename
            print(f'\n[{datetime.now().strftime("%H:%M:%S")}] Starting file: {filename} | Topic: {topic} | Target: {target} lines')
        
        # DELETE existing file FIRST - this is critical
        try:
            if fullpath.exists():
                fullpath.unlink()
                print(f'[{datetime.now().strftime("%H:%M:%S")}] ✓ Deleted existing file')
                time.sleep(0.2)  # Wait for filesystem
        except Exception as e:
            print(f'[{datetime.now().strftime("%H:%M:%S")}] Warning: Could not delete: {e}')
        
        # Set current path for background refresh
        with refresh_lock:
            current_cycle_path = fullpath
        
        # Create fresh file with header
        header = f'# Topic: {topic} - {datetime.now().isoformat()}\n'
        try:
            fullpath.write_text(header, encoding='utf-8')
            # Force sync
            fd = os.open(str(fullpath), os.O_RDWR)
            os.fsync(fd)
            os.close(fd)
            
            # Verify creation
            if not fullpath.exists():
                print(f'[{datetime.now().strftime("%H:%M:%S")}] ERROR: File not created!')
                time.sleep(1.0)
                continue
            
            verify_content = fullpath.read_text(encoding='utf-8')
            if not verify_content:
                print(f'[{datetime.now().strftime("%H:%M:%S")}] ERROR: File is empty!')
                time.sleep(1.0)
                continue
                
        except Exception as e:
            print(f'[{datetime.now().strftime("%H:%M:%S")}] ERROR: Failed to create file: {e}')
            time.sleep(1.0)
            continue
        
        lines = 1  # Header is 1 line
        i = 0
        
        # Main writing loop - write 2 lines every 1.5 seconds
        while lines < target:
            # Generate 2 lines
            batch = []
            for j in range(2):
                if lines >= target:
                    break
                batch.append(generate_line(topic, i))
                i += 1
                lines += 1
            
            if not batch:
                break
            
            data = '\n'.join(batch) + '\n'
            
            try:
                # Append to file - use binary mode for reliability
                with open(str(fullpath), 'ab') as f:
                    f.write(data.encode('utf-8'))
                    f.flush()
                    os.fsync(f.fileno())
                
                # Also read and rewrite entire file - this triggers WakaTime change detection
                # This is critical - WakaTime needs to see the file actually change
                current_content = fullpath.read_text(encoding='utf-8')
                fullpath.write_text(current_content, encoding='utf-8')
                
                # Force sync
                fd = os.open(str(fullpath), os.O_RDWR)
                os.fsync(fd)
                os.close(fd)
                
                # Update mtime
                os.utime(str(fullpath), (time.time(), time.time()))
                
                # Verify write
                stats = fullpath.stat()
                if stats.st_size == 0:
                    raise Exception('File is empty after write!')
                
            except Exception as e:
                print(f'[{datetime.now().strftime("%H:%M:%S")}] Write error: {e}')
                import traceback
                traceback.print_exc()
            
            print(f'[{datetime.now().strftime("%H:%M:%S")}] Wrote {len(batch)} lines to {filename} ({lines}/{target})')
            
            # Wait 1.5 seconds
            time.sleep(1.5)
        
        # Verify final file
        print(f'[{datetime.now().strftime("%H:%M:%S")}] ✓ File complete: {filename} ({lines} lines)')
        try:
            content = fullpath.read_text(encoding='utf-8')
            parts = content.split('\n')
            if parts and parts[-1] == '':
                parts.pop()
            physical_lines = len(parts)
            print(f'[{datetime.now().strftime("%H:%M:%S")}] Verified: {physical_lines} physical lines')
        except Exception as err:
            print(f'[{datetime.now().strftime("%H:%M:%S")}] Could not verify: {err}')
        
        # Brief pause before deletion
        time.sleep(0.5)
        
        # Clear path so background refresh stops
        with refresh_lock:
            current_cycle_path = None
        
        # Delete file - MUST DELETE
        max_retries = 10
        deleted = False
        for attempt in range(1, max_retries + 1):
            try:
                if fullpath.exists():
                    # Try to close any open file handles by rewriting first
                    try:
                        fullpath.write_text('', encoding='utf-8')
                        time.sleep(0.1)
                    except Exception:
                        pass
                    
                    fullpath.unlink()
                    time.sleep(0.1)
                    
                    # Verify deletion
                    if not fullpath.exists():
                        print(f'[{datetime.now().strftime("%H:%M:%S")}] ✓ Deleted {filename} (attempt {attempt})')
                        deleted = True
                        break
                    else:
                        raise Exception('File still exists after unlink')
                
            except Exception as err:
                print(f'[{datetime.now().strftime("%H:%M:%S")}] Delete attempt {attempt} failed: {err}')
                time.sleep(0.5)
        
        if not deleted:
            print(f'[{datetime.now().strftime("%H:%M:%S")}] ✗ FAILED to delete {filename} after {max_retries} attempts')
            print(f'[{datetime.now().strftime("%H:%M:%S")}] File still exists at: {fullpath}')
        
        # Pause before next cycle
        time.sleep(1.0)

if __name__ == '__main__':
    try:
        run()
    except KeyboardInterrupt:
        cleanup_and_exit(code=0)
    except Exception as err:
        print(f'Error: {err}')
        import traceback
        traceback.print_exc()
        cleanup_and_exit(code=1)
