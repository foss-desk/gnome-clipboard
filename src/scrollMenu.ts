import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Tooltip from './tooltip.js';
import { _ } from './i18n.js';

export class ScrollMenu extends PopupMenu.PopupMenuSection {
    public scrollView: St.ScrollView;
    public scrollViewSection: PopupMenu.PopupMenuSection;

    private _scrollTopBtn: any;

    constructor() {
        super();

        this.scrollView = new St.ScrollView({
            overlay_scrollbars: true,
            style_class: 'scroll-view',
            clip_to_allocation: true,
        });

        this.scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this.scrollViewSection = new PopupMenu.PopupMenuSection();

        // In ESM/GNOME 45+, many objects inherit from Clutter.Actor directly
        this.scrollView.add_child(this.scrollViewSection.actor);

        const adjustment = this.scrollView.get_vadjustment();

        this._scrollTopBtn = new St.Button({
            style_class: 'action-btn scroll-top-btn',
            child: new St.Icon({
                icon_name: 'go-top-symbolic',
                icon_size: 21,
            }),
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.END,
            can_focus: true,
            track_hover: true,
            visible: false,
        });
        Tooltip.attachTooltip(this._scrollTopBtn, () => _('Scroll to Top'));
        this._scrollTopBtn.connect('clicked', () => adjustment.set_value(adjustment.get_lower()));

        // A bin layout stacks the scroll view and the button in the same box,
        // so the button floats over the bottom-right corner instead of taking
        // a row of its own.
        const overlay = new St.Widget({ layout_manager: new Clutter.BinLayout() });
        overlay.add_child(this.scrollView);
        overlay.add_child(this._scrollTopBtn);
        this.actor.add_child(overlay);

        // Show the button only while the list is scrolled away from the top.
        // `notify::value` follows the scroll position; `changed` follows the
        // content growing or shrinking.
        const update = () => {
            this._scrollTopBtn.visible = adjustment.get_value() > adjustment.get_lower();
        };
        adjustment.connect('notify::value', update);
        adjustment.connect('changed', update);
    }

    addMenuItem(item: any) {
        this.scrollViewSection.addMenuItem(item);
    }

    removeAll() {
        this.scrollViewSection.removeAll();
    }
}
