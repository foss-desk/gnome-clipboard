import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

let _ = (s: string) => s;

export function init(gettextFunc: (s: string) => string) {
    _ = gettextFunc;
}

export class ActionBar
  extends PopupMenu.PopupBaseMenuItem {

  private _privateBtn: any;
  private _pinBtn: any;
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
      style_class: 'action-bar',
    })
    
    let mainBox = new St.BoxLayout({
      orientation: Clutter.Orientation.HORIZONTAL,
      x_expand: true,
      style_class: 'action-bar-container'
    });

    // Navigation Group
    let navBox = new St.BoxLayout({
        orientation: Clutter.Orientation.HORIZONTAL,
        style_class: 'nav-group'
    });

    this._prevBtn = this._createIconButton('go-previous-symbolic', _('Previous Item'));
    this._nextBtn = this._createIconButton('go-next-symbolic', _('Next Item'));
    
    navBox.add_child(this._prevBtn);
    navBox.add_child(this._nextBtn);
    mainBox.add_child(navBox);

    // Spacer
    let spacer = new St.Widget({ x_expand: true });
    mainBox.add_child(spacer);

    // Actions Group
    let actionBox = new St.BoxLayout({
        orientation: Clutter.Orientation.HORIZONTAL,
        style_class: 'action-group'
    });

    this._privateBtn = this._createIconButton('view-conceal-symbolic', _('Private Mode'));
    this._pinBtn = this._createIconButton('view-pin-symbolic', _('Pin Current Item'));
    this._clearBtn = this._createIconButton('edit-delete-symbolic', _('Clear History'), 'action-btn-danger');
    this._settingsBtn = this._createIconButton('emblem-system-symbolic', _('Settings'));

    actionBox.add_child(this._privateBtn);
    actionBox.add_child(this._pinBtn);
    actionBox.add_child(this._clearBtn);
    actionBox.add_child(this._settingsBtn);
    mainBox.add_child(actionBox);

    // Enable Switch
    this._enableBtn = new PopupMenu.PopupSwitchMenuItem(_("Service"), true);
    this._enableBtn.connect('toggled', (_item: any, _state: boolean) => {
        // We might want to notify or trigger something here, 
        // but since ClipboardPanel calls .enable() on every check, it works.
    });
    actionBox.add_child(this._enableBtn);

    this.add_child(mainBox);
  }

  private _createIconButton(iconName: string, tooltip: string, extraClass: string = '') {
      let button = new St.Button({
          style_class: `action-btn ${extraClass}`,
          child: new St.Icon({
              icon_name: iconName,
              icon_size: 16
          }),
          can_focus: true,
          track_hover: true,
          // x_align: St.Align.MIDDLE,
          // y_align: St.Align.MIDDLE
      });

      // GNOME Shell doesn't have built-in tooltips for St.Button easily without extra code,
      // but we can set accessibility label at least.
      button.set_accessible_name(tooltip);
      
      return button;
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

  onPin(callback: () => void) {
    this._pinBtn.connect('clicked', callback);
  }

  onTogglePrivateMode(callback: (active: boolean) => void) {
    this._privateBtn.connect('clicked', () => callback(true));
  }
  
  setPrivateMode(active: boolean) {
    if (active) {
      this._privateBtn.add_style_class_name('active-btn');
    } else {
      this._privateBtn.remove_style_class_name('active-btn');
    }
  }

  onOpenSettings(callback: () => void) {
    this._settingsBtn.connect('clicked', callback);
  }

  enable() {
    return this._enableBtn ? !!this._enableBtn.state : true;
  }
}
