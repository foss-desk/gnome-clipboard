// In GNOME 45+, we can use console methods for logging
// which automatically include the extension name if configured properly,
// but for now we'll stick to a similar pattern as before.

export enum LOG_LEVELS {
    OFF,
    ERROR,
    WARN,
    INFO,
    DEBUG,
}

// We'll need to pass the settings or extension instance here
// or use a global-like way to get settings if available.
// For now, let's keep it simple.

let _settings: any = null;

export function init(settings: any) {
    _settings = settings;
}

export function log_level() {
    if (!_settings) return LOG_LEVELS.INFO;
    return _settings.get_uint('log-level');
}

export function log(text: string) {
    console.log(`Gnome Clipboard: ${text}`);
}

export function error(text: string) {
    if (log_level() >= LOG_LEVELS.ERROR) console.error(`Gnome Clipboard: [ERROR] ${text}`);
}

export function warn(text: string) {
    if (log_level() >= LOG_LEVELS.WARN) console.warn(`Gnome Clipboard: [WARN] ${text}`);
}

export function info(text: string) {
    if (log_level() >= LOG_LEVELS.INFO) console.info(`Gnome Clipboard: [INFO] ${text}`);
}

export function debug(text: string) {
    if (log_level() >= LOG_LEVELS.DEBUG) console.debug(`Gnome Clipboard: [DEBUG] ${text}`);
}
