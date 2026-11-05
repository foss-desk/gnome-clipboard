import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as ClipboardItem from './clipboardItem.js';
import * as utils from './utils.js';
import * as Tooltip from './tooltip.js';

let _ = (s: string) => s;

export function init(gettextFunc: (s: string) => string) {
    _ = gettextFunc;
}

export class MenuItem extends PopupMenu.PopupBaseMenuItem {
    public cbInfo: ClipboardItem.ClipboardItem;
    private _timeLabel: any;
    private _pinBtn: any;

    static {
        GObject.registerClass(this);
    }

    constructor(
        cbInfo: ClipboardItem.ClipboardItem,
        onActivate: (item: MenuItem) => void,
        onPin: (item: MenuItem) => void,
        onRemove: (item: MenuItem) => void,
    ) {
        super({
            style_class: 'clipboard-item',
        });

        this.cbInfo = cbInfo;

        // Main horizontal row
        const row = new St.BoxLayout({
            ...utils.boxOrientation(Clutter.Orientation.HORIZONTAL),
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        // Left: content + meta (stacked vertically, expands)
        const bodyBox = new St.BoxLayout({
            ...utils.boxOrientation(Clutter.Orientation.VERTICAL),
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
        });

        // The item renders its own content; the menu never branches on its type.
        bodyBox.add_child(cbInfo.displayWidget());

        this._timeLabel = new St.Label({
            text: this._formatRelativeTime(cbInfo.copiedAt),
            style_class: 'clipboard-item-meta',
            x_align: Clutter.ActorAlign.START,
        });
        bodyBox.add_child(this._timeLabel);
        row.add_child(bodyBox);

        // Right: action buttons (pin + remove)
        const actionBox = new St.BoxLayout({
            ...utils.boxOrientation(Clutter.Orientation.HORIZONTAL),
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._pinBtn = this._createActionBtn(
            'view-pin-symbolic',
            cbInfo.pinned ? 'pinned' : 'unpinned',
        );
        Tooltip.attachTooltip(this._pinBtn, () => (this.cbInfo.pinned ? _('Unpin') : _('Pin')));
        this._pinBtn.connect('clicked', () => onPin(this));
        actionBox.add_child(this._pinBtn);

        const removeBtn = this._createActionBtn('edit-delete-symbolic', 'remove-icon');
        Tooltip.attachTooltip(removeBtn, () => _('Delete'));
        removeBtn.connect('clicked', () => onRemove(this));
        actionBox.add_child(removeBtn);

        row.add_child(actionBox);
        this.add_child(row);

        this.connect('activate', () => {
            onActivate(this);
        });
    }

    public updateUI() {
        this._timeLabel.set_text(this._formatRelativeTime(this.cbInfo.copiedAt));

        this._pinBtn.remove_style_class_name('pinned');
        this._pinBtn.remove_style_class_name('unpinned');
        this._pinBtn.add_style_class_name(this.cbInfo.pinned ? 'pinned' : 'unpinned');
    }

    private _createActionBtn(iconName: string, extraClass: string) {
        return new St.Button({
            style_class: `item-action-btn ${extraClass}`,
            child: new St.Icon({
                icon_name: iconName,
                icon_size: 14,
                style_class: 'popup-menu-icon',
            }),
            can_focus: true,
            track_hover: true,
        });
    }

    private _formatRelativeTime(timestamp: number): string {
        const diff = (Date.now() - timestamp) / 1000;
        if (diff < 60) return _('Just now');

        const minutes = Math.floor(diff / 60);
        if (diff < 3600) {
            return minutes === 1
                ? _('1 minute ago')
                : _('%d minutes ago').replace('%d', String(minutes));
        }

        const hours = Math.floor(diff / 3600);
        if (diff < 86400) {
            return hours === 1 ? _('1 hour ago') : _('%d hours ago').replace('%d', String(hours));
        }

        const days = Math.floor(diff / 86400);
        return days === 1 ? _('1 day ago') : _('%d days ago').replace('%d', String(days));
    }

    text(): string {
        return this.cbInfo.searchText();
    }
}
