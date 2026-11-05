import St from 'gi://St';
import GObject from 'gi://GObject';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

let _ = (s: string) => s;

export function init(gettextFunc: (s: string) => string) {
    _ = gettextFunc;
}

export class SearchBox extends PopupMenu.PopupBaseMenuItem {
    public searchEntry: St.Entry;

    static {
        GObject.registerClass(this);
    }

    constructor() {
        super({
            reactive: false,
            can_focus: false,
            style_class: 'search-box-container',
        });

        this.searchEntry = new St.Entry({
            style_class: 'search-box',
            can_focus: true,
            hint_text: _('Search clipboard...'),
            track_hover: true,
            x_expand: true,
        });

        // Add search icon
        const searchIcon = new St.Icon({
            icon_name: 'edit-find-symbolic',
            style_class: 'search-box-icon',
            icon_size: 16,
        });
        this.searchEntry.set_primary_icon(searchIcon);

        // Clear button
        const clearIcon = new St.Icon({
            icon_name: 'edit-clear-symbolic',
            style_class: 'search-box-icon',
            icon_size: 16,
        });

        this.searchEntry.set_secondary_icon(clearIcon);
        this.searchEntry.connect('secondary-icon-clicked', () => {
            this.searchEntry.set_text('');
        });

        this.add_child(this.searchEntry);
    }

    onTextChanged(callback: any) {
        this.searchEntry.get_clutter_text().connect('text-changed', callback);
    }

    getText() {
        return this.searchEntry.get_text();
    }

    setText(text: string) {
        return this.searchEntry.set_text(text);
    }
}
