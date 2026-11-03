import GLib from 'gi://GLib';
// In GNOME 45+, imports.byteArray is deprecated. Use standard JS methods or GLib.
// However, GJS still supports it for now, but let's try to be clean.

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as log from './log.js';

export function log_methods(obj: any) {
  var result = [];
  for (var id in obj) {
    try {
      if (typeof (obj[id]) == "function") {
        result.push(id + ": " + obj[id].toString());
      }
    } catch (err) {
      result.push(id + ": inaccessible");
    }
  }

  log.info(result.toString());
}

export function log_object(obj: any) {
  let seen: object[] = [];
  let json = JSON.stringify(obj, function (_key, val) {
    if (val != null && typeof val == "object") {
      if (seen.indexOf(val) >= 0) {
        return;
      }
      seen.push(val);
    }
    return val;
  });
  log.info(json);
}

export function hashCode(text: string): number {
  var hash = 0;
  if (text.length == 0) return hash;
  for (let i = 0; i < text.length; i++) {
    let char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

// Full content checksum, used as the on-disk identity of an image. Keeping the
// complete MD5 hex string (instead of only its 32-bit hashCode) means two
// different images can never collide on the same filename.
export function checksumBytes(bytes: any): string {
  if (!bytes) return '';
  const data = typeof bytes.get_data === 'function' ? bytes.get_data() : bytes;
  return GLib.compute_checksum_for_data(GLib.ChecksumType.MD5, data) ?? '';
}

export function truncate(text: string, length: number): string {
  text = text.trim();
  text = text.replace(/\s+/g, ' ');

  if (text.length > length) {
    text = text.substring(0, length - 1) + '...';
  }

  return text;
}

export function spawnAsync(...args: string[]) {
  try {
    let flags = GLib.SpawnFlags.SEARCH_PATH;
    GLib.spawn_async(null, args, null, flags, null);
  } catch (err) {
    log.error(`an exception occurred: ${err}`);
  }
}

export async function spawnSync(...args: string[]) {
  try {
    let proc = new Gio.Subprocess({
        argv: args,
        flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    });
    proc.init(null);
    
    return new Promise((resolve, reject) => {
        proc.communicate_utf8_async(null, null, (proc: any, res: any) => {
            try {
                let [_stdout, stderr] = proc.communicate_utf8_finish(res);
                if (stderr && stderr.length > 0) {
                    log.error(`an error occurred: ${stderr}`);
                    resolve(false);
                } else {
                    resolve(true);
                }
            } catch (err) {
                log.error(`an exception occurred: ${err}`);
                reject(err);
            }
        });
    });
  } catch (err) {
    log.error(`an exception occurred: ${err}`);
    return false;
  }
}

// St.BoxLayout gained `orientation` in GNOME 48 (deprecating `vertical`);
// GNOME 45-47 only know `vertical` and throw on `orientation`.
const hasBoxOrientation = GObject.Object.find_property.call(St.BoxLayout, 'orientation') !== null;

export function boxOrientation(orientation: number): object {
  if (hasBoxOrientation) {
    return { orientation };
  }
  return { vertical: orientation === Clutter.Orientation.VERTICAL };
}
