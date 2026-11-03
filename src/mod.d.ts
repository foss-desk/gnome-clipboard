// GNOME Shell ESM Module Declarations
declare module 'gi://St' { const St: any; export default St; }
declare module 'gi://GObject' { const GObject: any; export default GObject; }
declare module 'gi://Gio' { const Gio: any; export default Gio; }
declare module 'gi://GLib' { const GLib: any; export default GLib; }
declare module 'gi://Meta' { const Meta: any; export default Meta; }
declare module 'gi://Shell' { const Shell: any; export default Shell; }
declare module 'gi://Clutter' { const Clutter: any; export default Clutter; }
declare module 'gi://GdkPixbuf' { const GdkPixbuf: any; export default GdkPixbuf; }
declare module 'gi://Gtk' { const Gtk: any; export default Gtk; }
declare module 'gi://Adw' { const Adw: any; export default Adw; }
declare module 'gi://Gdk' { const Gdk: any; export default Gdk; }
declare namespace Gdk {
    export const KEY_Escape: any;
    export const KEY_BackSpace: any;
    export const KEY_Shift_L: any;
    export const KEY_Shift_R: any;
    export const KEY_Control_L: any;
    export const KEY_Control_R: any;
    export const KEY_Alt_L: any;
    export const KEY_Alt_R: any;
    export const KEY_Meta_L: any;
    export const KEY_Meta_R: any;
    export const KEY_Super_L: any;
    export const KEY_Super_R: any;
}

declare namespace St {
    export type ScrollView = any;
    export type Entry = any;
    export type Widget = any;
    export type Bin = any;
    export const ClipboardType: any;
    export const PolicyType: any;
}

declare namespace Gio {
    export type Settings = any;
    export const SettingsBindFlags: any;
}

declare namespace Adw {
    export type PreferencesWindow = any;
    export type PreferencesPage = any;
    export type PreferencesGroup = any;
    export type ActionRow = any;
}

declare namespace Gtk {
    export type SpinButton = any;
    export type Switch = any;
    export type Adjustment = any;
    export const Align: any;
}

declare module 'resource:///org/gnome/shell/ui/main.js' {
    export const panel: any;
    export function notify(title: string, msg: string): void;
}

declare module 'resource:///org/gnome/shell/ui/popupMenu.js' {
    export class PopupBaseMenuItem {
        constructor(params?: any);
        add_child(child: any): void;
        actor: any;
        connect(signal: string, callback: Function): number;
        disconnect(id: number): void;
        destroy(): void;
        visible: boolean;
        setOrnament(ornament: any): void;
        _ornamentLabel: any;
    }
    export class PopupSeparatorMenuItem extends PopupBaseMenuItem { }
    export class PopupSwitchMenuItem extends PopupBaseMenuItem {
        constructor(label: string, active: boolean, params?: any);
        state: boolean;
    }
    export class PopupMenuSection {
        actor: any;
        addMenuItem(item: any): void;
        removeAll(): void;
        _getMenuItems(): any[];
        connect(signal: string, callback: Function): number;
        disconnect(id: number): void;
    }
    export const Ornament: any;
}

declare module 'resource:///org/gnome/shell/ui/panelMenu.js' {
    export class Button {
        constructor(menuAlignment: number, nameText: string, dontCreateMenu: boolean);
        menu: any;
        add_child(child: any): void;
        emit(signal: string, ...args: any[]): void;
        connect(signal: string, callback: Function): number;
        destroy(): void;
    }
}

declare module 'resource:///org/gnome/shell/ui/modalDialog.js' {
    export class ModalDialog {
        constructor();
        contentLayout: any;
        setButtons(buttons: any[]): void;
        open(): void;
        close(): void;
    }
}

declare module 'resource:///org/gnome/shell/extensions/extension.js' {
    export class Extension {
        uuid: string;
        path: string;
        getSettings(schema?: string): any;
        gettext(msg: string): string;
        openPreferences(): void;
    }
}

declare module 'resource:///org/gnome/shell/extensions/prefs.js' {
    export class ExtensionPreferences {
        dir: any;
        path: string;
        getSettings(schema?: string): any;
        gettext(msg: string): string;
    }
}

declare module 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js' {
    export class ExtensionPreferences {
        dir: any;
        path: string;
        getSettings(schema?: string): any;
        gettext(msg: string): string;
    }
}

declare const global: any;
declare const imports: any;
declare const Clutter: any;