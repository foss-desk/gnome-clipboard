import St from 'gi://St';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

export class ScrollMenu extends PopupMenu.PopupMenuSection {
    public scrollView: St.ScrollView;
    public scrollViewSection: PopupMenu.PopupMenuSection;

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
        this.actor.add_child(this.scrollView);
    }

    addMenuItem(item: any) {
        this.scrollViewSection.addMenuItem(item);
    }

    removeAll() {
        this.scrollViewSection.removeAll();
    }
}
