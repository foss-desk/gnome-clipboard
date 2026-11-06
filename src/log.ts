export enum LOG_LEVELS {
    OFF,
    ERROR,
    WARN,
    INFO,
    DEBUG,
}

const PREFIX = 'Gnome Clipboard';

let _settings: any = null;

export function init(settings: any) {
    _settings = settings;
}

export function log_level() {
    if (!_settings) return LOG_LEVELS.INFO;
    return _settings.get_uint('log-level');
}

export function error(text: string) {
    if (log_level() >= LOG_LEVELS.ERROR) {
        console.error(`${PREFIX}: [ERROR] ${text}`);
    }
}

export function warn(text: string) {
    if (log_level() >= LOG_LEVELS.WARN) {
        console.warn(`${PREFIX}: [WARN] ${text}`);
    }
}

export function info(text: string) {
    if (log_level() >= LOG_LEVELS.INFO) {
        console.log(`${PREFIX}: [INFO] ${text}`);
    }
}

export function debug(text: string) {
    if (log_level() >= LOG_LEVELS.DEBUG) {
        console.log(`${PREFIX}: [DEBUG] ${text}`);
    }
}
