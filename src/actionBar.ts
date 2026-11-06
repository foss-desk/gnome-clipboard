import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as utils from './utils.js';
import * as Tooltip from './tooltip.js';

let _ = (s: string) => s;

export function init(gettextFunc: (s: string) => string) {
    _ = gettextFunc;
}

export class ActionBar extends PopupMenu.PopupBaseMenuItem {
    private _clearBtn: any;
    private _settingsBtn: any;
    private _prevBtn: any;
    private _nextBtn: any;
    private _enableBtn: any;

    static {
        GObject.registerClass(this);
    }

    constructor() {
        super({
            reactive: false,
            activate: false,
            hover: false,
            can_focus: false,
            style_class: 'action-bar-container',
        });

        const mainBox = new St.BoxLayout({
            ...utils.boxOrientation(Clutter.Orientation.HORIZONTAL),
            x_expand: true,
            style_class: 'action-bar',
        });

        // Navigation Group
        const navBox = new St.BoxLayout({
            ...utils.boxOrientation(Clutter.Orientation.HORIZONTAL),
            style_class: 'nav-group',
        });

        this._prevBtn = this._createIconButton('go-previous-symbolic');
        Tooltip.attachTooltip(this._prevBtn, () => _('Previous Item'));

        this._nextBtn = this._createIconButton('go-next-symbolic');
        Tooltip.attachTooltip(this._nextBtn, () => _('Next Item'));

        navBox.add_child(this._prevBtn);
        navBox.add_child(this._nextBtn);
        mainBox.add_child(navBox);

        // Spacer
        const spacer = new St.Widget({ x_expand: true });
        mainBox.add_child(spacer);

        // Actions Group
        const actionBox = new St.BoxLayout({
            ...utils.boxOrientation(Clutter.Orientation.HORIZONTAL),
            style_class: 'action-group',
        });

        this._clearBtn = this._createIconButton('edit-delete-symbolic', 'action-btn-danger');
        Tooltip.attachTooltip(this._clearBtn, () => _('Clear History'));

        this._settingsBtn = this._createIconButton('emblem-system-symbolic');
        Tooltip.attachTooltip(this._settingsBtn, () => _('Settings'));

        actionBox.add_child(this._clearBtn);
        actionBox.add_child(this._settingsBtn);
        mainBox.add_child(actionBox);

        // Enable Switch
        this._enableBtn = new PopupMenu.PopupSwitchMenuItem(_('Capture'), true);
        this._enableBtn.connect('toggled', (_item: any, _state: boolean) => {
            // We might want to notify or trigger something here,
            // but since ClipboardPanel calls .enable() on every check, it works.
        });
        actionBox.add_child(this._enableBtn);

        this.add_child(mainBox);
    }

    private _createIconButton(iconName: string, extraClass: string = '') {
        return new St.Button({
            style_class: `action-btn ${extraClass}`,
            child: new St.Icon({
                icon_name: iconName,
                icon_size: 16,
            }),
            can_focus: true,
            track_hover: true,
        });
    }

    enableNextButton(enable: boolean) {
        this._nextBtn.reactive = enable;
        this._nextBtn.opacity = enable ? 255 : 100;
    }

    enablePrevButton(enable: boolean) {
        this._prevBtn.reactive = enable;
        this._prevBtn.opacity = enable ? 255 : 100;
    }

    onNextItem(callback: () => void) {
        this._nextBtn.connect('clicked', callback);
    }

    onPrevItem(callback: () => void) {
        this._prevBtn.connect('clicked', callback);
    }

    onClearHistory(callback: () => void) {
        this._clearBtn.connect('clicked', callback);
    }

    onOpenSettings(callback: () => void) {
        this._settingsBtn.connect('clicked', callback);
    }

    enable() {
        return this._enableBtn ? !!this._enableBtn.state : true;
    }

    // Flip the capture switch as if the user had clicked it. Returns the new
    // state so callers can report whether capture is now on or paused.
    toggleCapture(): boolean {
        this._enableBtn.toggle();
        return !!this._enableBtn.state;
    }
}
